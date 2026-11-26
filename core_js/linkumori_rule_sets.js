/*
 * ============================================================
 * Linkumori — shared rule sets
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
 * An optional authoring feature of rule source files, expanded by the
 * CLI (linkumori-cli-tool.js) when it reads a rules file. The files it
 * builds (data/linkumori-clearurls.json and the LZ4 bundle) are plain
 * CLN 1.0, so the extension never sees a rule set.
 *
 * A top-level "ruleSets" object names lists of entries. In a provider's
 * rule lists, an entry { "include": "<name>" } stands for that set's
 * entries, in place and in order:
 *
 *   ruleSets:
 *     affiliate-exceptions:
 *       - id: field-mailinglist-removeparam-utm-i
 *         matchPattern: "@@mailinglist$removeparam=/^utm_.*$/i"
 *   providers:
 *     shop:
 *       domainPatterns: ["||shop.example^"]
 *       rules:
 *         - utm_source
 *         - include: affiliate-exceptions
 *
 * Expanding gives exactly the file with the entries written out: each
 * include gets its own copy of the entries, and a file with no
 * "ruleSets" and no include entries is returned as is. A set cannot
 * include another set. See docs/cln-yaml.md "Shared rule sets".
 *
 * Loaded by linkumori-cli-tool.js; reads and writes
 * globalThis.LinkumoriRuleSets.
 * ============================================================
 */
(function (root) {
    'use strict';

    const RULE_SET_SECTIONS = Object.freeze(['rules', 'rawRules', 'referralMarketing', 'redirections', 'fieldRedirections', 'exceptions']);
    const RULE_SET_NAME = /^[a-z0-9][a-z0-9_-]*$/;

    function isPlainObject(value) {
        return !!value && typeof value === 'object' && !Array.isArray(value);
    }

    // True for an { "include": ... } entry (any other keys make it invalid,
    // which findRuleSetProblems reports).
    function isIncludeEntry(entry) {
        return isPlainObject(entry) && Object.prototype.hasOwnProperty.call(entry, 'include');
    }

    function cloneEntry(entry) {
        if (typeof structuredClone === 'function') return structuredClone(entry);
        return JSON.parse(JSON.stringify(entry));
    }

    // { errors: [...], warnings: [...] } for a parsed rules file.
    function findRuleSetProblems(data) {
        const errors = [];
        const warnings = [];
        if (!isPlainObject(data)) return { errors, warnings };
        const hasSets = Object.prototype.hasOwnProperty.call(data, 'ruleSets');
        const sets = hasSets ? data.ruleSets : null;
        if (hasSets && !isPlainObject(sets)) {
            errors.push('"ruleSets" must be an object of named lists');
        }
        const known = new Set();
        if (isPlainObject(sets)) {
            for (const [name, entries] of Object.entries(sets)) {
                if (!RULE_SET_NAME.test(name)) {
                    errors.push(`ruleSets.${name}: a set name uses lowercase letters, digits, "-" and "_", and starts with a letter or digit`);
                    continue;
                }
                if (!Array.isArray(entries) || entries.length === 0) {
                    errors.push(`ruleSets.${name}: must be a non-empty list of entries`);
                    continue;
                }
                entries.forEach((entry, index) => {
                    if (isIncludeEntry(entry)) {
                        errors.push(`ruleSets.${name}[${index}]: a rule set cannot include another set`);
                    }
                });
                known.add(name);
            }
        }
        const used = new Set();
        const providers = isPlainObject(data.providers) ? data.providers : {};
        for (const [providerName, provider] of Object.entries(providers)) {
            if (!isPlainObject(provider)) continue;
            for (const section of RULE_SET_SECTIONS) {
                const list = provider[section];
                if (!Array.isArray(list)) continue;
                list.forEach((entry, index) => {
                    if (!isIncludeEntry(entry)) return;
                    const label = `providers.${providerName}.${section}[${index}]`;
                    const keys = Object.keys(entry);
                    if (keys.length !== 1) {
                        errors.push(`${label}: an include entry has only the "include" key`);
                    }
                    const name = entry.include;
                    if (typeof name !== 'string' || !name) {
                        errors.push(`${label}: "include" must name a rule set`);
                        return;
                    }
                    if (!hasSets) {
                        errors.push(`${label}: includes "${name}", but the file has no "ruleSets"`);
                        return;
                    }
                    if (!known.has(name)) {
                        if (!isPlainObject(sets) || !Object.prototype.hasOwnProperty.call(sets, name)) {
                            errors.push(`${label}: no rule set named "${name}"`);
                        }
                        return;
                    }
                    used.add(name);
                });
            }
        }
        for (const name of known) {
            if (!used.has(name)) warnings.push(`ruleSets.${name}: not included by any provider`);
        }
        return { errors, warnings };
    }

    function fileUsesRuleSets(data) {
        if (!isPlainObject(data)) return false;
        if (Object.prototype.hasOwnProperty.call(data, 'ruleSets')) return true;
        const providers = isPlainObject(data.providers) ? data.providers : {};
        for (const provider of Object.values(providers)) {
            if (!isPlainObject(provider)) continue;
            for (const section of RULE_SET_SECTIONS) {
                const list = provider[section];
                if (Array.isArray(list) && list.some(isIncludeEntry)) return true;
            }
        }
        return false;
    }

    // The file with every include entry replaced by copies of its set's
    // entries and "ruleSets" removed. Throws when findRuleSetProblems finds
    // an error. A file that uses no rule sets is returned unchanged (the
    // same object).
    function expandRuleSets(data) {
        if (!fileUsesRuleSets(data)) return data;
        const { errors } = findRuleSetProblems(data);
        if (errors.length > 0) {
            throw new Error(`Invalid rule sets:\n${errors.map(e => `  - ${e}`).join('\n')}`);
        }
        const sets = data.ruleSets;
        const out = {};
        for (const [key, value] of Object.entries(data)) {
            if (key === 'ruleSets') continue;
            out[key] = value;
        }
        const providers = {};
        for (const [providerName, provider] of Object.entries(data.providers || {})) {
            if (!isPlainObject(provider)) {
                providers[providerName] = provider;
                continue;
            }
            const copy = { ...provider };
            for (const section of RULE_SET_SECTIONS) {
                const list = provider[section];
                if (!Array.isArray(list) || !list.some(isIncludeEntry)) continue;
                const expanded = [];
                for (const entry of list) {
                    if (isIncludeEntry(entry)) {
                        for (const setEntry of sets[entry.include]) expanded.push(cloneEntry(setEntry));
                    } else {
                        expanded.push(entry);
                    }
                }
                copy[section] = expanded;
            }
            providers[providerName] = copy;
        }
        out.providers = providers;
        return out;
    }

    root.LinkumoriRuleSets = Object.freeze({
        RULE_SET_SECTIONS,
        isIncludeEntry,
        fileUsesRuleSets,
        findRuleSetProblems,
        expandRuleSets
    });
})(typeof globalThis !== 'undefined' ? globalThis : this);
