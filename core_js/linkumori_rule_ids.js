/*
 * ============================================================
 * Linkumori — generated rule ids
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
 * Every rule has an id: its own "id", or one generated from its list and
 * text ("utm_source" in rules → "field-utm-source"). The rule on/off
 * controls, show-rule and the custom rules editor all use these ids, so
 * the engine, storage, the editor and the CLI must generate the same ones.
 * See docs/filter-syntax.md §9.
 *
 * Loaded as a classic script (background, custom rules page) and imported
 * by linkumori-cli-tool.js; all read globalThis.LinkumoriRuleIds.
 * ============================================================
 */
(function (root) {
    'use strict';

    // The order ids are assigned in; also the lists that hold rules.
    const RULE_ID_SECTIONS = Object.freeze(['exceptions', 'rules', 'referralMarketing', 'rawRules', 'redirections', 'fieldRedirections']);
    const SECTION_PREFIXES = Object.freeze({
        rules: 'field',
        referralMarketing: 'referral',
        rawRules: 'raw',
        redirections: 'redirect',
        fieldRedirections: 'field-redirect',
        exceptions: 'exception'
    });

    function hashRuleText(value) {
        let hash = 2166136261;
        const text = String(value || '');
        for (let i = 0; i < text.length; i++) {
            hash ^= text.charCodeAt(i);
            hash = Math.imul(hash, 16777619);
        }
        return (hash >>> 0).toString(36);
    }

    function slugifyRuleText(value) {
        return String(value || '')
            .toLowerCase()
            .replace(/[^a-z0-9]+/g, '-')
            .replace(/^-+|-+$/g, '')
            .replace(/-+/g, '-');
    }

    // The readable id for a rule's text: the list prefix and the first 32
    // characters of the slug. Different texts can share it ("rdr" and
    // "_rdr", "referer" and "Referer"), which assignProviderRuleIds resolves.
    function baseRuleId(section, matchPattern) {
        const prefix = SECTION_PREFIXES[section] || 'field';
        const slug = slugifyRuleText(matchPattern).slice(0, 32);
        return `${prefix}-${slug || hashRuleText(matchPattern)}`;
    }

    function getRuleText(rule) {
        if (typeof rule === 'string') return rule;
        if (rule && typeof rule === 'object' && !Array.isArray(rule) && typeof rule.matchPattern === 'string') return rule.matchPattern;
        return '';
    }

    function getExplicitRuleId(rule) {
        return rule && typeof rule === 'object' && !Array.isArray(rule) && typeof rule.id === 'string' && rule.id ? rule.id : null;
    }

    function getListValues(provider, section) {
        const value = provider ? provider[section] : undefined;
        return Array.isArray(value) ? value : [];
    }

    // Ids for every rule of one provider, as { [section]: [ { id, generated } | null ] }
    // in list order (null for an entry without text). A rule without an "id"
    // gets baseRuleId(), unless another rule of the provider with different
    // text would get the same one, or an "id"/"aliases" entry already uses
    // it: then each of those rules gets "<base>-<hash of its text>". The
    // result depends only on which rules the provider has, not their order,
    // and identical rules in one list share their id.
    function assignProviderRuleIds(provider) {
        const reserved = new Set();
        const groups = new Map();
        RULE_ID_SECTIONS.forEach(section => {
            getListValues(provider, section).forEach(rule => {
                const explicitId = getExplicitRuleId(rule);
                if (explicitId) reserved.add(explicitId);
                if (rule && typeof rule === 'object' && Array.isArray(rule.aliases)) {
                    rule.aliases.forEach(alias => { if (typeof alias === 'string') reserved.add(alias); });
                }
                const text = getRuleText(rule);
                if (explicitId || !text) return;
                const base = baseRuleId(section, text);
                if (!groups.has(base)) groups.set(base, new Set());
                groups.get(base).add(`${section}\u0000${text}`);
            });
        });
        const result = {};
        RULE_ID_SECTIONS.forEach(section => {
            result[section] = getListValues(provider, section).map(rule => {
                const explicitId = getExplicitRuleId(rule);
                if (explicitId) return { id: explicitId, generated: false };
                const text = getRuleText(rule);
                if (!text) return null;
                const base = baseRuleId(section, text);
                const shared = groups.get(base).size > 1 || reserved.has(base);
                return { id: shared ? `${base}-${hashRuleText(text)}` : base, generated: true };
            });
        });
        return result;
    }

    // Looks up the id of the rule with this text in `section`, from the
    // result of assignProviderRuleIds().
    function createRuleIdLookup(provider) {
        const assigned = assignProviderRuleIds(provider);
        const byText = new Map();
        RULE_ID_SECTIONS.forEach(section => {
            getListValues(provider, section).forEach((rule, index) => {
                const entry = assigned[section][index];
                if (!entry || !entry.generated) return;
                const key = `${section}\u0000${getRuleText(rule)}`;
                if (!byText.has(key)) byText.set(key, entry.id);
            });
        });
        return (section, matchPattern) => byText.get(`${section}\u0000${matchPattern}`) || baseRuleId(section, matchPattern);
    }

    // Lists checked for two entries with the same text.
    const TEXT_COLLISION_SECTIONS = Object.freeze(['rules', 'rawRules', 'referralMarketing', 'fieldRedirections']);

    // The engine keeps plain raw rules and plain rules / referralMarketing
    // entries in maps keyed by their text, so a later entry with the same
    // text replaces an earlier one. "@@" raw rules, $removeparam filters and
    // fieldRedirections are kept in lists, so each of them still runs.
    function isKeyedByText(section, text, isRemoveParamText) {
        if (section === 'rawRules') return !text.trim().startsWith('@@');
        if (section === 'rules' || section === 'referralMarketing') return !isRemoveParamText(text);
        return false;
    }

    function describeEntry(section, index, rule) {
        const explicitId = getExplicitRuleId(rule);
        return `${section}[${index}]${explicitId ? ` (id "${explicitId}")` : ''}`;
    }

    // Collisions between one provider's rules, as [{ severity, message }]:
    //  1. Two entries of one list with the same text where the engine keeps
    //     only one of them (a short "qid" and { "matchPattern": "qid" }).
    //  2. Two entries that end up with the same id, counting generated ids;
    //     and an "id"/"aliases" entry taking the id a rule without "id"
    //     would get, which moves that rule to "<base>-<hash>" and hands its
    //     saved on/off setting to the other rule.
    // Two explicit ids or aliases that clash, and an entry repeated exactly,
    // are left to the callers, which already report them.
    // `isRemoveParamText(text)` tells whether an entry is a $removeparam filter.
    // `options.ids === false` skips pass 2 (for providers merged from several
    // files, whose rules keep the ids they had in their own file).
    // Pass 1 problems also carry { section, text }.
    function findRuleCollisions(provider, isRemoveParamText, options = {}) {
        const problems = [];
        const error = (message, extra = {}) => problems.push({ severity: 'error', message, ...extra });
        const warning = message => problems.push({ severity: 'warning', message });
        const sameEntry = (a, b) => JSON.stringify(a) === JSON.stringify(b);

        // Pass 1: same text in one list.
        const replaced = new Set();
        TEXT_COLLISION_SECTIONS.forEach(section => {
            const entries = getListValues(provider, section);
            const groups = new Map();
            entries.forEach((rule, index) => {
                const text = getRuleText(rule);
                if (!text || !isKeyedByText(section, text, isRemoveParamText)) return;
                // A rule with "referralMarketing": true goes to the other map.
                const referral = rule && typeof rule === 'object' && rule.referralMarketing === true;
                const key = `${referral}\u0000${text}`;
                if (!groups.has(key)) groups.set(key, []);
                groups.get(key).push(index);
            });
            groups.forEach(indexes => {
                if (indexes.length < 2) return;
                const first = indexes[0];
                indexes.slice(1).forEach(index => {
                    if (sameEntry(entries[first], entries[index])) return;
                    const text = getRuleText(entries[index]);
                    replaced.add(`${section}\u0000${text}`);
                    error(`${describeEntry(section, first, entries[first])} and ${describeEntry(section, index, entries[index])} ` +
                        `both match "${text}"; only one of them takes effect — merge them into one entry`, { section, text });
                });
            });
        });

        if (options.ids === false) return problems;

        // Pass 2: one id for several entries. Explicit ids and aliases are
        // reserved first; generated ids avoid them (assignProviderRuleIds).
        const assigned = assignProviderRuleIds(provider);
        const owners = new Map();
        const addOwner = (name, owner) => {
            if (!owners.has(name)) owners.set(name, []);
            owners.get(name).push(owner);
        };
        RULE_ID_SECTIONS.forEach(section => {
            getListValues(provider, section).forEach((rule, index) => {
                const entry = assigned[section][index];
                if (!entry) return;
                const where = describeEntry(section, index, rule);
                addOwner(entry.id, { where, section, rule, generated: entry.generated });
                if (rule && typeof rule === 'object' && Array.isArray(rule.aliases)) {
                    rule.aliases.forEach(alias => {
                        if (typeof alias === 'string' && alias !== entry.id) {
                            addOwner(alias, { where: `${where} alias`, section, rule, generated: false });
                        }
                    });
                }
            });
        });
        owners.forEach((list, name) => {
            if (list.length < 2 || !list.some(owner => owner.generated)) return;
            if (list.every(owner => owner.generated)) {
                // Generated ids only coincide for the same text in one list.
                const { section, rule } = list[0];
                const text = getRuleText(rule);
                if (list.every(owner => sameEntry(owner.rule, rule))) return;
                if (replaced.has(`${section}\u0000${text}`)) return;
                warning(`${list.map(owner => owner.where).join(', ')} share the generated id "${name}", ` +
                    'so turning one off turns off all of them — give each its own "id"');
                return;
            }
            error(`rule id "${name}" belongs to ${list.map(owner => owner.where).join(' and ')}`);
        });

        RULE_ID_SECTIONS.forEach(section => {
            getListValues(provider, section).forEach((rule, index) => {
                const entry = assigned[section][index];
                if (!entry || !entry.generated) return;
                const base = baseRuleId(section, getRuleText(rule));
                const holders = (owners.get(base) || []).filter(owner => !owner.generated);
                if (entry.id === base || holders.length === 0) return;
                warning(`${holders[0].where} uses "${base}", the id ${describeEntry(section, index, rule)} ` +
                    `"${getRuleText(rule)}" would get, so that rule's id is "${entry.id}" instead and an on/off ` +
                    `setting saved under "${base}" now applies to ${holders[0].where} — pick a different id`);
            });
        });
        return problems;
    }

    // Text JavaScript puts ahead of other object keys, smallest first: digits
    // only, no leading zero, at most 4294967294 ("0", "123"; not "007", "-1",
    // "1.5"). The engine keeps plain raw rules and plain rules /
    // referralMarketing entries in objects keyed by their text, so such an
    // entry without an `order` runs ahead of its list instead of in place.
    function isWholeNumberRuleText(text) {
        return typeof text === 'string' && /^(?:0|[1-9]\d*)$/.test(text) && Number(text) <= 4294967294;
    }

    const hasOrder = rule => !!rule && typeof rule === 'object' && !Array.isArray(rule) && typeof rule.order === 'number';
    const isReferralFlagged = rule => !!rule && typeof rule === 'object' && !Array.isArray(rule) && rule.referralMarketing === true;

    // Warnings about entries that run somewhere else than their place in the
    // file suggests (docs/filter-syntax.md §Processing order), as
    // [{ severity: 'warning', message }]:
    //  1. A whole-number matchPattern without an `order`.
    //  2. findReferralTextCollisions.
    function findRuleOrderWarnings(provider, isRemoveParamText) {
        const problems = [];
        const warning = message => problems.push({ severity: 'warning', message });

        ['rawRules', 'rules', 'referralMarketing'].forEach(section => {
            const ahead = section === 'rawRules' ? 'the other rawRules entries' : 'every rules and referralMarketing entry';
            getListValues(provider, section).forEach(rule => {
                if (hasOrder(rule)) return;
                const text = getRuleText(rule);
                if (!isWholeNumberRuleText(text)) return;
                warning(`${section} "${text}" is a whole number, so it runs ahead of ${ahead} without an "order", ` +
                    'not at its place in the list; give it an "order" if its place matters');
            });
        });
        problems.push(...findReferralTextCollisions(provider, isRemoveParamText));
        return problems;
    }

    // The same text in `rules` and `referralMarketing`, or in `rules` with and
    // without "referralMarketing": true, as [{ severity: 'warning', message,
    // text, kind }]. The engine keeps plain `rules` entries in one object and
    // referral ones (flagged `rules` entries, then `referralMarketing`) in
    // another, and merges the two while referral-marketing rules run, so only
    // one entry takes effect. `kind` names the pair ('flagged-rules',
    // 'referral-rules' or 'referral-flagged'). Same text within one list is
    // findRuleCollisions' pass 1.
    function findReferralTextCollisions(provider, isRemoveParamText) {
        const problems = [];
        const warning = (message, text, kind) => problems.push({ severity: 'warning', message, text, kind });

        // First index of each keyed text among plain and flagged `rules`.
        const plain = new Map(), flagged = new Map();
        getListValues(provider, 'rules').forEach((rule, index) => {
            const text = getRuleText(rule);
            if (!text || !isKeyedByText('rules', text, isRemoveParamText)) return;
            const firsts = isReferralFlagged(rule) ? flagged : plain;
            if (!firsts.has(text)) firsts.set(text, index);
        });
        const replacesPlain = (where, text) => {
            const at = `rules[${plain.get(text)}]`;
            return `${where}, so it replaces ${at} while referral-marketing rules run, and ${at} runs alone when ` +
                'referral marketing is allowed; keep one of them';
        };
        flagged.forEach((index, text) => {
            if (!plain.has(text)) return;
            warning(replacesPlain(`rules[${index}] "${text}" has "referralMarketing": true and is also in rules[${plain.get(text)}] without it`, text),
                text, 'flagged-rules');
        });
        const seen = new Set();
        getListValues(provider, 'referralMarketing').forEach((rule, index) => {
            const text = getRuleText(rule);
            if (!text || seen.has(text) || !isKeyedByText('referralMarketing', text, isRemoveParamText)) return;
            seen.add(text);
            if (plain.has(text)) {
                warning(replacesPlain(`referralMarketing[${index}] "${text}" is also in rules[${plain.get(text)}]`, text),
                    text, 'referral-rules');
            }
            if (flagged.has(text)) {
                warning(`referralMarketing[${index}] "${text}" is also in rules[${flagged.get(text)}] with "referralMarketing": true, ` +
                    `so only referralMarketing[${index}] takes effect; keep one of them`, text, 'referral-flagged');
            }
        });
        return problems;
    }

    root.LinkumoriRuleIds = Object.freeze({
        RULE_ID_SECTIONS,
        assignProviderRuleIds,
        baseRuleId,
        createRuleIdLookup,
        findReferralTextCollisions,
        findRuleCollisions,
        findRuleOrderWarnings,
        isWholeNumberRuleText,
        getRuleText,
        hashRuleText
    });
})(typeof globalThis !== 'undefined' ? globalThis : this);
