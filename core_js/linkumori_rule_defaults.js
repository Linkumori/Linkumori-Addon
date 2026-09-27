/*
 * ============================================================
 * Linkumori — rule file defaults
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
 * A rules file may have a top-level "defaults" block, like the ClearURLs
 * new rule format's: values every rule of that file gets unless it sets
 * its own. They are written into the file's rules when the file is loaded,
 * so after bundled, remote and custom rules are merged, each rule still
 * has its own file's defaults. See docs/filter-syntax.md "defaults".
 *
 * Loaded as a classic script (background, custom rules page) and imported
 * by linkumori-cli-tool.js; all read globalThis.LinkumoriRuleDefaults.
 * ============================================================
 */
(function (root) {
    'use strict';

    const RULE_DEFAULT_KEYS = Object.freeze(['active', 'description', 'requestTypes', 'preprocessors', 'exceptions', 'historyBypassProtection']);
    // Provider "exceptions" is left out: a default such as "active": false
    // must not switch off every exception of the file.
    const RULE_DEFAULT_LISTS = Object.freeze(['rules', 'rawRules', 'referralMarketing', 'redirections', 'fieldRedirections']);
    const PREPROCESSOR_TYPES = Object.freeze(['urlEncode', 'urlDecode', 'doubleUrlEncode', 'doubleUrlDecode', 'base64Encode', 'base64Decode']);

    function isPlainObject(value) {
        return !!value && typeof value === 'object' && !Array.isArray(value);
    }

    // What is wrong with a "defaults" block, as messages ([] when fine or
    // absent).
    function findRuleDefaultsProblems(defaults) {
        if (defaults === undefined) return [];
        if (!isPlainObject(defaults)) return ['"defaults" must be an object'];
        const problems = [];
        Object.keys(defaults).forEach(key => {
            if (!RULE_DEFAULT_KEYS.includes(key)) problems.push(`"defaults" has unknown key "${key}"`);
        });
        ['active', 'historyBypassProtection'].forEach(key => {
            if (key in defaults && typeof defaults[key] !== 'boolean') problems.push(`"defaults.${key}" must be true or false`);
        });
        if ('description' in defaults && typeof defaults.description !== 'string') {
            problems.push('"defaults.description" must be a string');
        }
        if ('requestTypes' in defaults && defaults.requestTypes !== 'all' &&
            !(Array.isArray(defaults.requestTypes) && defaults.requestTypes.every(type => typeof type === 'string' && type.trim()))) {
            problems.push('"defaults.requestTypes" must be "all" or a list of request types');
        }
        if ('exceptions' in defaults) {
            if (!Array.isArray(defaults.exceptions) || !defaults.exceptions.every(item => typeof item === 'string')) {
                problems.push('"defaults.exceptions" must be a list of URL regexes');
            } else {
                defaults.exceptions.forEach(item => {
                    try { new RegExp(item, 'i'); } catch (error) { problems.push(`"defaults.exceptions" has an invalid regex "${item}": ${error.message}`); }
                });
            }
        }
        if ('preprocessors' in defaults) {
            if (!Array.isArray(defaults.preprocessors)) {
                problems.push('"defaults.preprocessors" must be a list');
            } else {
                defaults.preprocessors.forEach((preprocessor, index) => {
                    const where = `"defaults.preprocessors[${index}]"`;
                    if (!isPlainObject(preprocessor) || !PREPROCESSOR_TYPES.includes(preprocessor.type)) {
                        problems.push(`${where} needs a "type": one of ${PREPROCESSOR_TYPES.join(', ')}`);
                    } else if (preprocessor.inputs !== 'all' &&
                        !(Array.isArray(preprocessor.inputs) && preprocessor.inputs.every(n => Number.isInteger(n) && n >= 1))) {
                        problems.push(`${where} "inputs" must be "all" or a list of capture group numbers`);
                    }
                });
            }
        }
        return problems;
    }

    // The defaults that change anything, as copies. Values equal to the
    // built-in defaults ("active": true, "requestTypes": "all", empty
    // lists, …) are left out, so they do not turn plain rules into objects.
    function normalizeRuleDefaults(defaults) {
        if (!isPlainObject(defaults) || findRuleDefaultsProblems(defaults).length > 0) return {};
        const result = {};
        if (defaults.active === false) result.active = false;
        if (typeof defaults.description === 'string' && defaults.description) result.description = defaults.description;
        if (Array.isArray(defaults.requestTypes)) result.requestTypes = defaults.requestTypes.map(type => type.trim());
        if (Array.isArray(defaults.preprocessors) && defaults.preprocessors.length > 0) {
            result.preprocessors = defaults.preprocessors.map(preprocessor => ({
                type: preprocessor.type,
                inputs: Array.isArray(preprocessor.inputs) ? preprocessor.inputs.slice() : 'all'
            }));
        }
        if (Array.isArray(defaults.exceptions) && defaults.exceptions.length > 0) result.exceptions = defaults.exceptions.slice();
        if (defaults.historyBypassProtection === false) result.historyBypassProtection = false;
        return result;
    }

    function copyValue(value) {
        return Array.isArray(value) ? JSON.parse(JSON.stringify(value)) : value;
    }

    // One rule with the defaults it does not set itself. A provider-level
    // "historyBypassProtection" beats the file default.
    function applyToRule(rule, defaults, providerSetsHistory) {
        let object;
        if (typeof rule === 'string') object = { matchPattern: rule };
        else if (isPlainObject(rule) && typeof rule.matchPattern === 'string') object = { ...rule };
        else return rule;
        let changed = false;
        Object.keys(defaults).forEach(key => {
            if (key === 'historyBypassProtection' && providerSetsHistory) return;
            if (Object.prototype.hasOwnProperty.call(object, key)) return;
            object[key] = copyValue(defaults[key]);
            changed = true;
        });
        return changed ? object : rule;
    }

    // `providers` with `defaults` written into every rule of the rule lists.
    // Returns `providers` itself when the defaults change nothing.
    function applyRuleDefaults(providers, defaults) {
        const normalized = normalizeRuleDefaults(defaults);
        if (!isPlainObject(providers) || Object.keys(normalized).length === 0) return providers;
        const result = {};
        Object.entries(providers).forEach(([name, provider]) => {
            if (!isPlainObject(provider)) { result[name] = provider; return; }
            const providerSetsHistory = typeof provider.historyBypassProtection === 'boolean';
            const copy = { ...provider };
            RULE_DEFAULT_LISTS.forEach(list => {
                if (Array.isArray(copy[list])) copy[list] = copy[list].map(rule => applyToRule(rule, normalized, providerSetsHistory));
            });
            result[name] = copy;
        });
        return result;
    }

    // A rules file ({ defaults?, providers, … }) with its defaults written
    // into its rules and the "defaults" block removed, so applying twice
    // changes nothing.
    function applyRuleFileDefaults(rulesData) {
        if (!isPlainObject(rulesData) || !('defaults' in rulesData)) return rulesData;
        const { defaults, ...rest } = rulesData;
        return { ...rest, providers: applyRuleDefaults(rest.providers, defaults) };
    }

    root.LinkumoriRuleDefaults = Object.freeze({
        PREPROCESSOR_TYPES,
        RULE_DEFAULT_KEYS,
        RULE_DEFAULT_LISTS,
        applyRuleDefaults,
        applyRuleFileDefaults,
        findRuleDefaultsProblems,
        normalizeRuleDefaults
    });
})(typeof globalThis !== 'undefined' ? globalThis : this);
