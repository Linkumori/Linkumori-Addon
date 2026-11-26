/*
 * ============================================================
 * Linkumori — remote rule patches
 * ============================================================
 * Copyright (c) 2026 Subham Mahesh
 *
 * This program is free software: you can redistribute it and/or
 * modify it under the terms of the GNU Lesser General Public
 * License as published by the Free Software Foundation, either
 * version 3 of the License, or (at your option) any later version.
 *
 * This program is distributed in the hope that it will be useful,
 * but WITHOUT ANY WARRANTY; without even the implied warranty of
 * MERCHANTABILITY or FITNESS FOR A PARTICULAR PURPOSE. See the GNU
 * Lesser General Public License for more details.
 *
 * You should have received a copy of the GNU Lesser General Public
 * License along with this program. If not, see
 * <http://www.gnu.org/licenses/>.
 *
 * A remote rule file can carry a top-level "patches" array. Each patch
 * replaces one existing rule, found by the same "provider::id" key the
 * rule on/off toggles use, with a new definition:
 *
 *   { "target": "amazon::field-qid", "section": "rules",
 *     "replace": { "matchPattern": "qid", "requestTypes": ["main_frame"] } }
 *
 * See docs/filter-syntax.md §Rule patches.
 *
 * Loaded as a classic script (background) and imported by
 * linkumori-cli-tool.js; all read globalThis.LinkumoriRulePatches.
 * Needs globalThis.LinkumoriRuleIds and globalThis.LinkumoriRuleDefaults.
 * ============================================================
 */
(function (root) {
    'use strict';

    const PATCH_KEYS = Object.freeze(['target', 'section', 'replace', 'description']);
    const REDIRECT_SECTIONS = Object.freeze(['redirections', 'fieldRedirections']);
    const ACTIVATION_IDS_KEY = '_linkumoriActivationIds';
    const SOURCE_KEY = '_linkumoriSource';
    const NO_REDIRECT_KEY = '_linkumoriNoRedirect';

    const ruleIds = () => root.LinkumoriRuleIds;
    const ruleDefaults = () => root.LinkumoriRuleDefaults;

    function isPlainObject(value) {
        return !!value && typeof value === 'object' && !Array.isArray(value);
    }

    // "amazon::field-qid" → { scope: "amazon", ruleId: "field-qid" }; a key
    // splits at its last "::", like a toggle key. null when malformed.
    function splitPatchTarget(target) {
        if (typeof target !== 'string') return null;
        const at = target.lastIndexOf('::');
        if (at <= 0) return null;
        const scope = target.slice(0, at).trim();
        const ruleId = target.slice(at + 2).trim();
        if (!scope || !ruleId || ruleId.includes(':')) return null;
        return { scope, ruleId };
    }

    function getReplaceText(replace) {
        if (typeof replace === 'string') return replace.trim();
        if (isPlainObject(replace) && typeof replace.matchPattern === 'string') return replace.matchPattern.trim();
        return '';
    }

    // What is wrong with a "patches" array, as messages ([] when fine or
    // absent).
    function findRulePatchProblems(patches) {
        if (patches === undefined) return [];
        if (!Array.isArray(patches)) return ['"patches" must be an array'];
        const problems = [];
        const sections = ruleIds().RULE_ID_SECTIONS;
        patches.forEach((patch, index) => {
            const where = `patches[${index}]`;
            if (!isPlainObject(patch)) {
                problems.push(`${where} must be an object`);
                return;
            }
            Object.keys(patch).forEach(key => {
                if (!PATCH_KEYS.includes(key)) problems.push(`${where} has unknown key "${key}"`);
            });
            if (!splitPatchTarget(patch.target)) {
                problems.push(`${where}.target must be "<provider>::<rule id>", like a rule toggle key`);
            }
            if (!sections.includes(patch.section)) {
                problems.push(`${where}.section must be one of ${sections.map(s => `"${s}"`).join(', ')}`);
            }
            if (!('replace' in patch)) {
                problems.push(`${where} needs "replace": the rule that takes the target's place`);
            } else if (!getReplaceText(patch.replace)) {
                problems.push(`${where}.replace must be a rule: non-empty text, or an object with a non-empty "matchPattern"`);
            } else if (isPlainObject(patch.replace)) {
                const { id, aliases } = patch.replace;
                if (id !== undefined && (typeof id !== 'string' || !id || id.includes(':'))) {
                    problems.push(`${where}.replace.id must be non-empty text without ":"`);
                }
                if (aliases !== undefined && (!Array.isArray(aliases) || aliases.some(alias => typeof alias !== 'string' || !alias))) {
                    problems.push(`${where}.replace.aliases must be an array of non-empty text`);
                }
            }
            if ('description' in patch && typeof patch.description !== 'string') {
                problems.push(`${where}.description must be a string`);
            }
        });
        return problems;
    }

    // The replacement rules of a "patches" array as a rules-file-shaped
    // object, so its capabilities can be derived like a provider's.
    function patchesAsProviders(patches) {
        const provider = {};
        (Array.isArray(patches) ? patches : []).forEach(patch => {
            if (!isPlainObject(patch) || !ruleIds().RULE_ID_SECTIONS.includes(patch.section) || !getReplaceText(patch.replace)) return;
            if (!provider[patch.section]) provider[patch.section] = [];
            provider[patch.section].push(patch.replace);
        });
        return { providers: Object.keys(provider).length > 0 ? { patches: provider } : {} };
    }

    function getRuleIdsOf(rule, assigned) {
        const ids = [];
        if (assigned && assigned.id) ids.push(assigned.id);
        if (isPlainObject(rule)) {
            if (typeof rule.id === 'string' && rule.id) ids.push(rule.id);
            if (Array.isArray(rule.aliases)) rule.aliases.forEach(alias => { if (typeof alias === 'string' && alias) ids.push(alias); });
            // The id the rule had in its own file, before merging.
            if (Array.isArray(rule[ACTIVATION_IDS_KEY])) {
                rule[ACTIVATION_IDS_KEY].forEach(activationId => {
                    const text = String(activationId || '');
                    const at = text.lastIndexOf('::');
                    if (at >= 0) ids.push(text.slice(at + 2));
                });
            }
        }
        return ids;
    }

    const unique = values => [...new Set(values.filter(value => typeof value === 'string' && value))];

    // The replacement for `oldRule`: it keeps the old rule's id unless it
    // sets its own (then the old id becomes an alias), keeps its on/off
    // toggles, and is marked with the patch file it came from.
    function buildReplacement(patch, oldRule, oldId, scopeIds, patchSet) {
        let rule = typeof patch.replace === 'string'
            ? { matchPattern: patch.replace.trim() }
            : JSON.parse(JSON.stringify(patch.replace));
        const defaults = patchSet.defaults;
        if (isPlainObject(defaults) && Object.keys(defaults).length > 0 &&
            ruleDefaults().RULE_DEFAULT_LISTS.includes(patch.section)) {
            rule = ruleDefaults().applyRuleDefaults({ patched: { [patch.section]: [rule] } }, defaults).patched[patch.section][0];
            if (typeof rule === 'string') rule = { matchPattern: rule };
        }
        const oldAliases = isPlainObject(oldRule) && Array.isArray(oldRule.aliases) ? oldRule.aliases : [];
        if (typeof rule.id !== 'string' || !rule.id) rule.id = oldId;
        const aliases = unique([...(Array.isArray(rule.aliases) ? rule.aliases : []), oldId, ...oldAliases])
            .filter(alias => alias !== rule.id);
        if (aliases.length > 0) rule.aliases = aliases;
        else delete rule.aliases;
        const oldActivationIds = isPlainObject(oldRule) && Array.isArray(oldRule[ACTIVATION_IDS_KEY]) ? oldRule[ACTIVATION_IDS_KEY] : [];
        rule[ACTIVATION_IDS_KEY] = unique([...oldActivationIds, ...scopeIds.map(scope => `${scope}::${rule.id}`)]);
        if (patchSet.source) rule[SOURCE_KEY] = patchSet.source;
        if (patch.section === 'rawRules' && !patchSet.capabilities.includes('redirect')) rule[NO_REDIRECT_KEY] = true;
        return rule;
    }

    // Applies one patch to one provider. Returns the patched provider, or
    // null when no rule of it matches.
    function patchProvider(providerName, providerData, patch, target, patchSet, options) {
        const data = options.attachActivationIds(providerName, providerData);
        const list = Array.isArray(data[patch.section]) ? data[patch.section] : [];
        const assigned = ruleIds().assignProviderRuleIds(data)[patch.section] || [];
        const matches = [];
        list.forEach((rule, index) => {
            if (getRuleIdsOf(rule, assigned[index]).includes(target.ruleId)) matches.push(index);
        });
        if (matches.length === 0) return null;
        const first = matches[0];
        const oldRule = list[first];
        const oldId = (isPlainObject(oldRule) && typeof oldRule.id === 'string' && oldRule.id) ||
            (assigned[first] && assigned[first].id) || target.ruleId;
        const replacement = buildReplacement(patch, oldRule, oldId, options.getScopeIds(providerName, data), patchSet);
        // Every other definition of the same rule is folded into the one
        // replacement, so the old one does not keep running beside it.
        const dropped = new Set(matches.slice(1));
        dropped.forEach(index => {
            const extra = list[index];
            if (isPlainObject(extra) && Array.isArray(extra[ACTIVATION_IDS_KEY])) {
                replacement[ACTIVATION_IDS_KEY] = unique([...replacement[ACTIVATION_IDS_KEY], ...extra[ACTIVATION_IDS_KEY]]);
            }
        });
        data[patch.section] = list
            .map((rule, index) => (index === first ? replacement : rule))
            .filter((rule, index) => !dropped.has(index));
        return data;
    }

    // `rulesData` with every patch of `patchSets` applied, in order, and a
    // result per patch: { source, target, section, status, providers, message }
    // where status is "applied", "unmatched" or "skipped".
    // patchSets: [{ source, patches, defaults, capabilities }]
    // options.getScopeIds(providerName, providerData) → toggle scopes
    // options.attachActivationIds(providerName, providerData) → provider
    //   with its rules' toggle keys attached
    function applyRulePatches(rulesData, patchSets, options) {
        const results = [];
        if (!isPlainObject(rulesData) || !isPlainObject(rulesData.providers) || !Array.isArray(patchSets)) {
            return { rules: rulesData, results };
        }
        const providers = { ...rulesData.providers };
        patchSets.forEach(patchSet => {
            const patches = Array.isArray(patchSet && patchSet.patches) ? patchSet.patches : [];
            const capabilities = Array.isArray(patchSet.capabilities) ? patchSet.capabilities : [];
            const set = { source: patchSet.source || null, defaults: patchSet.defaults, capabilities };
            patches.forEach(patch => {
                const target = splitPatchTarget(patch && patch.target);
                const base = { source: set.source, target: patch && patch.target, section: patch && patch.section, providers: [] };
                if (!target) {
                    results.push({ ...base, status: 'skipped', message: 'invalid target' });
                    return;
                }
                if (REDIRECT_SECTIONS.includes(patch.section) && !capabilities.includes('redirect')) {
                    results.push({ ...base, status: 'skipped', message: 'needs the "redirect" capability, which this file has not been given' });
                    return;
                }
                Object.keys(providers).forEach(providerName => {
                    const providerData = providers[providerName];
                    if (!isPlainObject(providerData)) return;
                    if (providerName !== target.scope && !options.getScopeIds(providerName, providerData).includes(target.scope)) return;
                    const patched = patchProvider(providerName, providerData, patch, target, set, options);
                    if (!patched) return;
                    providers[providerName] = patched;
                    base.providers.push(providerName);
                });
                results.push(base.providers.length > 0
                    ? { ...base, status: 'applied', message: `replaced in ${base.providers.join(', ')}` }
                    : { ...base, status: 'unmatched', message: 'no loaded rule has this provider and id' });
            });
        });
        return { rules: { ...rulesData, providers }, results };
    }

    root.LinkumoriRulePatches = Object.freeze({
        PATCH_KEYS,
        applyRulePatches,
        findRulePatchProblems,
        patchesAsProviders,
        splitPatchTarget
    });
})(typeof globalThis !== 'undefined' ? globalThis : this);
