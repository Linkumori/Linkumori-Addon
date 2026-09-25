/*
 * ============================================================
 * Linkumori — rule migration
 * ============================================================
 * Copyright (c) 2025 Subham Mahesh
 *
 * This program is free software: you can redistribute it and/or modify
 * it under the terms of the GNU Lesser General Public License as published
 * by the Free Software Foundation, either version 3 of the License, or
 * (at your option) any later version.
 *
 * This program is distributed in the hope that it will be useful,
 * but WITHOUT ANY WARRANTY; without even the implied warranty of
 * MERCHANTABILITY or FITNESS FOR A PARTICULAR PURPOSE. See the
 * GNU Lesser General Public License for more details.
 *
 * You should have received a copy of the GNU Lesser General Public License
 * along with this program. If not, see <https://www.gnu.org/licenses/>.
 *
 * ============================================================
 * Rules have one spelling for each thing (docs/rule-syntax.md). This file
 * rewrites the older duplicate spellings into that one form, so custom
 * rules, remote lists and imported files written the old way keep
 * working. The engine itself only understands the current form.
 *
 *   domainRedirections ("||..." entries) -> redirections
 *   domainExceptions   ("||..." entries) -> exceptions
 *   { match, kind, action }             -> { matchPattern, replacePattern } in the right list
 *   defaultActive / activeDefault        -> active
 *   "history-bypass-protection" key      -> historyBypassProtection
 *   urlEncodeRepeated / urlDecodeRepeated -> doubleUrlEncode / doubleUrlDecode
 *   $queryprune, xhr, doc, frame, iframe, popup, 1p, 3p, ~first-party,
 *   ~third-party, strict1p, strict3p, from=  -> full $removeparam names
 *   "syntax" marker                      -> removed
 * ============================================================
 */
(function (root) {
    'use strict';

    const RULE_LISTS = ['rules', 'referralMarketing', 'rawRules', 'exceptions', 'redirections'];

    const FILTER_OPTION_NAMES = Object.freeze({
        queryprune: 'removeparam',
        xhr: 'xmlhttprequest',
        doc: 'document',
        popup: 'document',
        frame: 'subdocument',
        iframe: 'subdocument',
        '1p': 'first-party',
        '~third-party': 'first-party',
        '~3p': 'first-party',
        '3p': 'third-party',
        '~first-party': 'third-party',
        '~1p': 'third-party',
        strict1p: 'strict-first-party',
        strict3p: 'strict-third-party'
    });
    const NEGATABLE_TYPE_NAMES = Object.freeze({
        xhr: 'xmlhttprequest', doc: 'document', popup: 'document', frame: 'subdocument', iframe: 'subdocument'
    });
    const PREPROCESSOR_NAMES = Object.freeze({
        urlEncodeRepeated: 'doubleUrlEncode',
        urlDecodeRepeated: 'doubleUrlDecode'
    });

    function isPlainObject(value) {
        return !!value && typeof value === 'object' && !Array.isArray(value);
    }

    // Index of the "$" that starts a filter's option list, or -1.
    function findOptionsStart(text) {
        if (text.startsWith('/')) {
            let escaped = false, inClass = false;
            for (let i = 1; i < text.length; i++) {
                const ch = text.charAt(i);
                if (escaped) { escaped = false; continue; }
                if (ch === '\\') { escaped = true; continue; }
                if (inClass) { if (ch === ']') inClass = false; continue; }
                if (ch === '[') { inClass = true; continue; }
                if (ch === '/') return text.indexOf('$', i + 1);
            }
            return -1;
        }
        return text.indexOf('$');
    }

    // Split "a,b=/x,y/,c" on commas that are not inside a /regex/ value.
    function splitOptions(text) {
        const parts = [];
        let current = '', inRegex = false, escaped = false;
        for (let i = 0; i < text.length; i++) {
            const ch = text.charAt(i), next = text.charAt(i + 1);
            if (!inRegex) {
                if (ch === ',') { parts.push(current); current = ''; continue; }
                current += ch;
                if ((ch === '=' || ch === '|') && (next === '/' || (next === '~' && text.charAt(i + 2) === '/'))) {
                    current += next === '~' ? '~/' : '/';
                    i += next === '~' ? 2 : 1;
                    inRegex = true; escaped = false;
                }
                continue;
            }
            current += ch;
            if (escaped) { escaped = false; continue; }
            if (ch === '\\') { escaped = true; continue; }
            if (ch === '/') inRegex = false;
        }
        parts.push(current);
        return parts;
    }

    function renameOption(option) {
        const trimmed = option.trim();
        const lower = trimmed.toLowerCase();
        const eq = lower.indexOf('=');
        const name = eq === -1 ? lower : lower.slice(0, eq);
        const value = eq === -1 ? '' : trimmed.slice(eq);
        if (name === 'from') return 'domain' + value;
        if (name === 'queryprune') return 'removeparam' + value;
        if (eq === -1 && FILTER_OPTION_NAMES[lower]) return FILTER_OPTION_NAMES[lower];
        if (eq === -1 && lower.startsWith('~') && NEGATABLE_TYPE_NAMES[lower.slice(1)]) {
            return '~' + NEGATABLE_TYPE_NAMES[lower.slice(1)];
        }
        return trimmed;
    }

    /** Rewrite old option names in a $removeparam filter; other strings are returned as-is. */
    function migrateFilterText(text) {
        if (typeof text !== 'string') return text;
        const body = text.startsWith('@@') ? text.slice(2) : text;
        const start = findOptionsStart(body);
        if (start === -1) return text;
        const options = splitOptions(body.slice(start + 1));
        if (!options.some(o => /^\s*(?:removeparam|queryprune)(?:=|\s*$)/i.test(o))) return text;
        const prefix = text.slice(0, text.length - body.length) + body.slice(0, start + 1);
        return prefix + options.map(renameOption).join(',');
    }

    function migratePreprocessors(preprocessors) {
        return preprocessors.map(p => (isPlainObject(p) && PREPROCESSOR_NAMES[p.type])
            ? { ...p, type: PREPROCESSOR_NAMES[p.type] } : p);
    }

    /** Returns { list, rule }: the list the rule belongs in and the rewritten rule. */
    function migrateRule(rule, list) {
        if (typeof rule === 'string') return { list, rule: migrateFilterText(rule) };
        if (!isPlainObject(rule)) return { list, rule };
        const next = { ...rule };
        const action = isPlainObject(next.action) ? next.action : null;
        let target = list;
        if (list === 'rules') {
            if (next.kind === 'raw') target = 'rawRules';
            else if (next.kind === 'redirection' || (action && action.type === 'redirect')) target = 'redirections';
            else if (next.referralMarketing === true) target = 'referralMarketing';
        }
        if (typeof next.match === 'string' && typeof next.matchPattern !== 'string') next.matchPattern = next.match;
        if (action && typeof action.replacePattern === 'string' && typeof next.replacePattern !== 'string') {
            next.replacePattern = action.replacePattern;
        }
        if (next.active === undefined && typeof next.activeDefault === 'boolean') next.active = next.activeDefault;
        if (next.historyBypassProtection === undefined && typeof next['history-bypass-protection'] === 'boolean') {
            next.historyBypassProtection = next['history-bypass-protection'];
        }
        ['match', 'kind', 'action', 'referralMarketing', 'activeDefault', 'history-bypass-protection'].forEach(key => { delete next[key]; });
        if (Array.isArray(next.preprocessors)) next.preprocessors = migratePreprocessors(next.preprocessors);
        if (typeof next.matchPattern === 'string') next.matchPattern = migrateFilterText(next.matchPattern);
        return { list: target, rule: next };
    }

    function domainRedirectionText(entry) {
        if (typeof entry === 'string') return entry.trim();
        if (!isPlainObject(entry)) return '';
        const pattern = typeof entry.matchPattern === 'string' ? entry.matchPattern
            : (typeof entry.match === 'string' ? entry.match : '');
        const target = typeof entry.replacePattern === 'string' ? entry.replacePattern
            : (isPlainObject(entry.action) && typeof entry.action.replacePattern === 'string' ? entry.action.replacePattern : '');
        return pattern.trim() && target.trim() ? `${pattern.trim()}$redirect=${target.trim()}` : '';
    }

    function pushUnique(list, value) {
        const key = typeof value === 'string' ? value : JSON.stringify(value);
        if (!list.some(item => (typeof item === 'string' ? item : JSON.stringify(item)) === key)) list.push(value);
    }

    /** Rewrite one provider into the current spelling. The input is not modified. */
    function migrateProvider(provider) {
        if (!isPlainObject(provider)) return provider;
        const next = { ...provider };
        if (next.active === undefined && typeof next.defaultActive === 'boolean') next.active = next.defaultActive;
        if (next.historyBypassProtection === undefined && typeof next['history-bypass-protection'] === 'boolean') {
            next.historyBypassProtection = next['history-bypass-protection'];
        }
        delete next.defaultActive;
        delete next['history-bypass-protection'];
        delete next.syntax;

        const lists = {};
        RULE_LISTS.forEach(list => { lists[list] = []; });
        RULE_LISTS.forEach(list => {
            (Array.isArray(provider[list]) ? provider[list] : []).forEach(rule => {
                const migrated = migrateRule(rule, list);
                pushUnique(lists[migrated.list], migrated.rule);
            });
        });

        // Domain patterns start with "|"; other old entries would be read as
        // regexes in the merged list, so they stay in the old field.
        const keepDomainRedirections = [];
        (Array.isArray(provider.domainRedirections) ? provider.domainRedirections : []).forEach(entry => {
            const text = domainRedirectionText(entry);
            if (!text) return;
            if (text.startsWith('|')) pushUnique(lists.redirections, text);
            else keepDomainRedirections.push(text);
        });
        const keepDomainExceptions = [];
        (Array.isArray(provider.domainExceptions) ? provider.domainExceptions : []).forEach(entry => {
            const text = typeof entry === 'string' ? entry.trim() : '';
            if (!text) return;
            if (text.startsWith('|')) pushUnique(lists.exceptions, text);
            else keepDomainExceptions.push(text);
        });

        RULE_LISTS.forEach(list => {
            if (lists[list].length > 0 || Array.isArray(provider[list])) next[list] = lists[list];
            else delete next[list];
        });
        if (keepDomainRedirections.length > 0) next.domainRedirections = keepDomainRedirections;
        else delete next.domainRedirections;
        if (keepDomainExceptions.length > 0) next.domainExceptions = keepDomainExceptions;
        else delete next.domainExceptions;
        return next;
    }

    function migrateProviders(providers) {
        if (!isPlainObject(providers)) return providers;
        const result = {};
        Object.keys(providers).forEach(name => { result[name] = migrateProvider(providers[name]); });
        return result;
    }

    function migrateRulesData(data) {
        if (!isPlainObject(data) || !isPlainObject(data.providers)) return data;
        return { ...data, providers: migrateProviders(data.providers) };
    }

    const api = Object.freeze({ migrateFilterText, migrateProvider, migrateProviders, migrateRulesData });
    root.LinkumoriRuleMigration = api;
})(typeof globalThis !== 'undefined' ? globalThis : this);
