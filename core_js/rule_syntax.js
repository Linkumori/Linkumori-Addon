/*
 * ============================================================
 * Linkumori — Unified rule syntax
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
 * One provider shape, one filter grammar (see docs/rule-syntax.md):
 *
 *   "amazon": {
 *     "match": ["||amazon.*^"],
 *     "rules": [
 *       "$removeparam=qid",
 *       "$removeparam=tag,referral",
 *       "@@||amazon.*^/gp/redirector.html",
 *       "/\\/ref=[^\\/?]+/i$strip"
 *     ]
 *   }
 *
 * The runtime engine (clearurls.js) and the storage merge layer keep their
 * internal, per-section layout. compileProvider() lowers the unified shape
 * into that layout; toCanonicalProvider() converts the older multi-section
 * format into the unified one. Providers without "match" are treated as the
 * older format and are only alias-normalized, so remote ClearURLs lists keep
 * working unchanged.
 * ============================================================
 */
(function (root) {
    'use strict';

    const PROVIDER_KEYS = ['match', 'rules', 'methods', 'resourceTypes', 'active', 'historyBypassProtection'];
    const RULE_OBJECT_KEYS = ['filter', 'id', 'description', 'active', 'replace', 'preprocessors'];
    const LEGACY_PROVIDER_KEYS = [
        'urlPattern', 'indexPattern', 'domainPatterns', 'rawRules', 'referralMarketing', 'exceptions',
        'domainExceptions', 'redirections', 'domainRedirections', 'completeProvider', 'forceRedirection',
        'defaultActive', 'history-bypass-protection', 'syntax'
    ];
    const ACTIONS = ['removeparam', 'redirect', 'strip', 'block'];
    const PARTY_TOKENS = [
        'first-party', '1p', '~third-party', '~3p', 'third-party', '3p', '~first-party', '~1p',
        'strict-first-party', 'strict1p', 'strict-third-party', 'strict3p'
    ];
    const VALUE_MODIFIERS = ['domain', 'from', 'to', 'denyallow', 'method'];
    // Filter request-type names -> webRequest types.
    const REQUEST_TYPES = Object.freeze({
        document: 'main_frame', doc: 'main_frame', popup: 'main_frame',
        subdocument: 'sub_frame', frame: 'sub_frame', iframe: 'sub_frame',
        script: 'script', stylesheet: 'stylesheet', image: 'image', imageset: 'imageset',
        media: 'media', object: 'object', other: 'other', ping: 'ping', websocket: 'websocket',
        xmlhttprequest: 'xmlhttprequest', xhr: 'xmlhttprequest', font: 'font'
    });
    // webRequest types -> canonical filter names (used when converting old rules).
    const WEBREQUEST_TO_FILTER_TYPE = Object.freeze({
        main_frame: 'document', sub_frame: 'subdocument', script: 'script', stylesheet: 'stylesheet',
        image: 'image', imageset: 'imageset', media: 'media', object: 'object', other: 'other',
        ping: 'ping', websocket: 'websocket', xmlhttprequest: 'xmlhttprequest', font: 'font'
    });
    const REGEX_FLAGS = /^[imsu]*$/;

    function isPlainObject(value) {
        return !!value && typeof value === 'object' && !Array.isArray(value);
    }

    function toArray(value) {
        if (Array.isArray(value)) return value;
        if (typeof value === 'string' && value.trim()) return [value];
        return [];
    }

    function isCanonicalProvider(provider) {
        return isPlainObject(provider) && Object.prototype.hasOwnProperty.call(provider, 'match');
    }

    // Escape every unescaped "/" so a regex source can sit inside /.../.
    function escapeRegexSlashes(source) {
        let out = '';
        const text = String(source || '');
        for (let i = 0; i < text.length; i++) {
            const ch = text.charAt(i);
            if (ch === '\\') { out += ch + (i + 1 < text.length ? text.charAt(++i) : ''); continue; }
            out += ch === '/' ? '\\/' : ch;
        }
        return out;
    }

    // "$1" -> "§1§" (engine placeholder) and back.
    function templateToInternal(template) {
        return String(template).replace(/\$(\d+)/g, '§$1§');
    }

    function templateFromInternal(template) {
        return String(template).replace(/§(\d+)§/g, '$$$1');
    }

    // Index just past the closing "/" of a leading regex literal, or -1.
    // Handles escapes and "/" inside character classes.
    function findRegexLiteralEnd(text) {
        let escaped = false, inClass = false;
        for (let i = 1; i < text.length; i++) {
            const ch = text.charAt(i);
            if (escaped) { escaped = false; continue; }
            if (ch === '\\') { escaped = true; continue; }
            if (inClass) { if (ch === ']') inClass = false; continue; }
            if (ch === '[') { inClass = true; continue; }
            if (ch === '/') return i + 1;
        }
        return -1;
    }

    // Split "a,b=/x,y/,c" on commas that are not inside a regex value.
    function splitModifiers(text) {
        const parts = [];
        let current = '', inRegex = false, escaped = false;
        for (let i = 0; i < text.length; i++) {
            const ch = text.charAt(i), next = text.charAt(i + 1);
            if (!inRegex) {
                if (ch === ',') { if (current.trim()) parts.push(current.trim()); current = ''; continue; }
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
        if (current.trim()) parts.push(current.trim());
        return parts;
    }

    /**
     * Parse one filter string. Returns { error } or a description:
     *   exception, pattern, regex ({ source, flags } | null), action
     *   ('removeparam' | 'redirect' | 'strip' | 'block' | null for a plain @@ allow),
     *   modifiers (engine-level tokens, without referral/force), referral, force,
     *   redirectTarget, requestTypes, historyBypassProtection.
     */
    function parseFilter(filterText) {
        let text = typeof filterText === 'string' ? filterText.trim() : '';
        if (!text) return { error: 'empty filter' };
        const result = {
            text, exception: false, pattern: '', regex: null, action: null,
            modifiers: [], referral: false, force: false, redirectTarget: null,
            requestTypes: [], excludeRequestTypes: [], historyBypassProtection: null, removeParamOnly: []
        };
        if (text.startsWith('@@')) { result.exception = true; text = text.slice(2); }

        let modifierText = '', hasModifiers = false;
        if (text.startsWith('/')) {
            const end = findRegexLiteralEnd(text);
            if (end === -1) return { error: 'unterminated /regex/ pattern' };
            let flagEnd = end;
            while (flagEnd < text.length && /[a-z]/i.test(text.charAt(flagEnd))) flagEnd++;
            const flags = text.slice(end, flagEnd);
            const rest = text.slice(flagEnd);
            if (rest && !rest.startsWith('$')) return { error: `unexpected "${rest}" after /regex/` };
            if (!REGEX_FLAGS.test(flags)) return { error: `unsupported regex flags "${flags}" (use i, m, s, u)` };
            const source = text.slice(1, end - 1);
            try { new RegExp(source, flags); } catch (e) { return { error: `invalid regex: ${e.message}` }; }
            result.regex = { source, flags };
            result.pattern = text.slice(0, flagEnd);
            hasModifiers = rest.length > 0;
            modifierText = rest.slice(1);
        } else {
            const dollar = text.indexOf('$');
            result.pattern = (dollar === -1 ? text : text.slice(0, dollar)).trim();
            hasModifiers = dollar !== -1;
            modifierText = dollar === -1 ? '' : text.slice(dollar + 1);
        }

        // $redirect=<target> must come last; its value runs to the end so
        // targets may contain commas.
        const redirectMatch = modifierText.match(/(^|,)\s*redirect=/i);
        if (redirectMatch) {
            result.redirectTarget = modifierText.slice(redirectMatch.index + redirectMatch[0].length).trim();
            modifierText = modifierText.slice(0, redirectMatch.index);
            if (!result.redirectTarget) return { error: '$redirect= needs a target' };
            result.action = 'redirect';
        }
        if (hasModifiers && modifierText.trim() === '' && !result.redirectTarget) {
            return { error: 'empty modifier list after "$"' };
        }

        for (const token of splitModifiers(modifierText)) {
            const lower = token.toLowerCase();
            const name = lower.split('=')[0];
            if (name === 'queryprune') return { error: '"queryprune" was removed; use "removeparam"' };
            if (ACTIONS.includes(name)) {
                if (result.action) return { error: `more than one action ("${result.action}" and "${name}")` };
                if ((name === 'strip' || name === 'block') && lower.includes('=')) return { error: `"${name}" takes no value` };
                result.action = name;
                if (name === 'removeparam') result.modifiers.push(token);
                continue;
            }
            if (lower === 'referral') { result.referral = true; continue; }
            if (lower === 'force') { result.force = true; continue; }
            if (name === 'history-bypass-protection') {
                const v = lower.slice(name.length + 1);
                if (v === 'false') result.historyBypassProtection = false;
                else if (v === 'true') result.historyBypassProtection = true;
                else return { error: 'history-bypass-protection must be true or false' };
                result.modifiers.push(token);
                continue;
            }
            const typeName = lower.replace(/^~/, '');
            if (REQUEST_TYPES[typeName]) {
                (lower.startsWith('~') ? result.excludeRequestTypes : result.requestTypes).push(REQUEST_TYPES[typeName]);
                result.modifiers.push(token);
                continue;
            }
            if (PARTY_TOKENS.includes(lower) || lower === 'match-case' || lower === 'badfilter' ||
                (VALUE_MODIFIERS.includes(name) && lower.includes('='))) {
                result.removeParamOnly.push(name);
                result.modifiers.push(token);
                continue;
            }
            return { error: `unknown modifier "${token}"` };
        }

        const action = result.action;
        if (result.referral && action !== 'removeparam') return { error: '"referral" only applies to $removeparam' };
        if (result.force && action !== 'redirect') return { error: '"force" only applies to $redirect' };
        if (result.removeParamOnly.length > 0 && action !== 'removeparam') {
            return { error: `"${result.removeParamOnly[0]}" only applies to $removeparam` };
        }
        if (result.exception && action && action !== 'removeparam') {
            return { error: `@@ exceptions cannot use $${action}` };
        }
        if (!action && !result.exception) {
            return { error: 'no action: use $removeparam, $redirect, $strip, $block, or an @@ exception' };
        }
        if (action === 'block' && ((result.pattern && result.pattern !== '*') || result.modifiers.length > 0)) {
            return { error: '$block blocks the whole provider; write it as just "$block"' };
        }
        if (action === 'strip' && !result.regex) return { error: '$strip needs a /regex/ pattern' };
        if (action === 'redirect' && !result.regex && !result.redirectTarget) {
            return { error: '$redirect without a target needs a /regex/ with a capture group' };
        }
        if (action === 'redirect' && result.regex && !result.redirectTarget &&
            new RegExp(result.regex.source + '|').exec('').length < 2) {
            return { error: '$redirect without a target needs a capture group in the /regex/' };
        }
        if (action === 'redirect' && !result.regex && /\$\d/.test(result.redirectTarget)) {
            return { error: '$1-style placeholders need a /regex/ pattern' };
        }
        const needsRegexForModifiers = action === 'redirect' || action === 'strip' || (!action && result.exception);
        if (needsRegexForModifiers && !result.regex && result.modifiers.length > 0) {
            return { error: 'modifiers on this rule need a /regex/ pattern' };
        }
        if (needsRegexForModifiers && result.excludeRequestTypes.length > 0) {
            return { error: '~type exclusions only apply to $removeparam' };
        }
        if (!action && result.exception && !result.pattern) return { error: '@@ needs a URL pattern' };
        return result;
    }

    function readRuleEntry(entry) {
        if (typeof entry === 'string') return { filter: entry, extras: null };
        if (!isPlainObject(entry)) return { error: 'rule must be a filter string or an object with "filter"' };
        const filter = typeof entry.filter === 'string' ? entry.filter
            : (typeof entry.matchPattern === 'string' ? entry.matchPattern : null);
        if (filter === null) return { error: 'rule object needs a "filter" string' };
        return { filter, extras: entry };
    }

    function copyRuleIdentity(target, extras) {
        if (!extras) return target;
        if (typeof extras.id === 'string') target.id = extras.id;
        if (typeof extras.description === 'string') target.description = extras.description;
        if (typeof extras.active === 'boolean') target.active = extras.active;
        if (Array.isArray(extras.preprocessors)) target.preprocessors = extras.preprocessors;
        if (Array.isArray(extras._linkumoriActivationIds)) target._linkumoriActivationIds = extras._linkumoriActivationIds;
        return target;
    }

    function rebuildRemoveParamText(parsed) {
        return (parsed.exception ? '@@' : '') + parsed.pattern + '$' + parsed.modifiers.join(',');
    }

    /**
     * Lower a unified provider into the engine's internal sections.
     * Returns { provider, errors }. Invalid rules are dropped and reported.
     */
    function compileProvider(canonical, providerName = 'provider') {
        const errors = [];
        const out = {};
        const push = (key, value) => { (out[key] = out[key] || []).push(value); };

        const match = toArray(canonical.match).map(p => String(p || '').trim()).filter(Boolean);
        if (match.length === 0) errors.push(`${providerName}: "match" needs at least one pattern`);
        else out.domainPatterns = match;
        ['methods', 'resourceTypes'].forEach(key => { if (Array.isArray(canonical[key])) out[key] = canonical[key].slice(); });
        if (typeof canonical.active === 'boolean') out.active = canonical.active;
        if (typeof canonical.historyBypassProtection === 'boolean') out.historyBypassProtection = canonical.historyBypassProtection;
        Object.keys(canonical).forEach(key => {
            if (!PROVIDER_KEYS.includes(key)) errors.push(`${providerName}: unknown key "${key}"`);
        });

        if (canonical.rules !== undefined && !Array.isArray(canonical.rules)) {
            errors.push(`${providerName}: "rules" must be an array`);
        }
        const seenIds = new Set();
        (Array.isArray(canonical.rules) ? canonical.rules : []).forEach((entry, index) => {
            const label = `${providerName}.rules[${index}]`;
            const read = readRuleEntry(entry);
            if (read.error) { errors.push(`${label}: ${read.error}`); return; }
            const { filter, extras } = read;
            if (extras && extras.id !== undefined) {
                if (typeof extras.id !== 'string' || !/^[a-z0-9][a-z0-9_-]*$/.test(extras.id)) {
                    errors.push(`${label}: "id" must be lowercase letters, digits, "-" or "_"`);
                } else if (seenIds.has(extras.id)) {
                    errors.push(`${label}: duplicate id "${extras.id}"`);
                }
                seenIds.add(extras.id);
            }
            if (extras) {
                Object.keys(extras).forEach(key => {
                    if (!RULE_OBJECT_KEYS.includes(key) && key !== 'matchPattern' && key !== '_linkumoriActivationIds') {
                        errors.push(`${label}: unknown key "${key}"`);
                    }
                });
            }
            const parsed = parseFilter(filter);
            if (parsed.error) { errors.push(`${label}: ${parsed.error} — ${filter}`); return; }
            if (extras && typeof extras.replace === 'string' && !['removeparam', 'strip'].includes(parsed.action)) {
                errors.push(`${label}: "replace" only applies to $removeparam and $strip`);
                return;
            }
            const replacePattern = extras && typeof extras.replace === 'string' ? templateToInternal(extras.replace) : null;

            if (parsed.action === 'block') {
                if (!extras || extras.active !== false) out.completeProvider = true;
                return;
            }

            if (parsed.action === 'removeparam') {
                // The engine's $removeparam parser does not know "referral"; drop it.
                const text = parsed.referral ? rebuildRemoveParamText(parsed) : filter.trim();
                const section = parsed.referral ? 'referralMarketing' : 'rules';
                if (!extras) { push(section, text); return; }
                const rule = copyRuleIdentity({ matchPattern: text }, extras);
                if (replacePattern !== null) rule.replacePattern = replacePattern;
                push(section, rule);
                return;
            }

            if (!parsed.regex) {
                if (extras && extras.active === false) return;
                if (parsed.action === 'redirect') push('domainRedirections', `${parsed.pattern}$redirect=${parsed.redirectTarget}`);
                else push('domainExceptions', parsed.pattern);
                if (parsed.force) out.forceRedirection = true;
                return;
            }

            const rule = copyRuleIdentity({
                matchPattern: parsed.regex.source,
                flags: (parsed.action === 'strip' ? 'g' : '') + parsed.regex.flags
            }, extras);
            if (parsed.requestTypes.length > 0) rule.requestTypes = [...new Set(parsed.requestTypes)];
            if (parsed.historyBypassProtection !== null) rule.historyBypassProtection = parsed.historyBypassProtection;
            if (parsed.action === 'redirect') {
                if (parsed.redirectTarget) rule.replacePattern = templateToInternal(parsed.redirectTarget);
                if (parsed.force) out.forceRedirection = true;
                push('redirections', rule);
            } else if (parsed.action === 'strip') {
                if (replacePattern !== null) rule.replacePattern = replacePattern;
                push('rawRules', rule);
            } else {
                push('exceptions', rule);
            }
        });
        return { provider: out, errors };
    }

    // ---------------------------------------------------------------------
    // Older multi-section format
    // ---------------------------------------------------------------------

    function replaceQueryprune(text) {
        return typeof text === 'string'
            ? text.replace(/(\$|,)(\s*)queryprune(?=[=,\s]|$)/gi, '$1$2removeparam')
            : text;
    }

    function normalizeLegacyRuleAliases(rule) {
        if (typeof rule === 'string') return replaceQueryprune(rule);
        if (!isPlainObject(rule)) return rule;
        const next = { ...rule };
        if (typeof next.match === 'string') next.match = replaceQueryprune(next.match);
        if (typeof next.matchPattern === 'string') next.matchPattern = replaceQueryprune(next.matchPattern);
        if (next.active === undefined && typeof next.activeDefault === 'boolean') next.active = next.activeDefault;
        delete next.activeDefault;
        if (next.historyBypassProtection === undefined && typeof next['history-bypass-protection'] === 'boolean') {
            next.historyBypassProtection = next['history-bypass-protection'];
        }
        delete next['history-bypass-protection'];
        return next;
    }

    /** Fold the older format's duplicate spellings into one each. */
    function normalizeLegacyProvider(provider) {
        if (!isPlainObject(provider)) return provider;
        const next = { ...provider };
        if (next.active === undefined && typeof next.defaultActive === 'boolean') next.active = next.defaultActive;
        delete next.defaultActive;
        if (next.historyBypassProtection === undefined && typeof next['history-bypass-protection'] === 'boolean') {
            next.historyBypassProtection = next['history-bypass-protection'];
        }
        delete next['history-bypass-protection'];
        delete next.syntax;
        ['rules', 'referralMarketing', 'rawRules', 'exceptions', 'redirections'].forEach(key => {
            if (Array.isArray(next[key])) next[key] = next[key].map(normalizeLegacyRuleAliases);
        });
        return next;
    }

    function legacyRuleText(rule) {
        if (typeof rule === 'string') return rule;
        if (!isPlainObject(rule)) return '';
        if (typeof rule.match === 'string') return rule.match;
        if (typeof rule.matchPattern === 'string') return rule.matchPattern;
        return '';
    }

    function legacyReplacePattern(rule) {
        if (!isPlainObject(rule)) return null;
        if (isPlainObject(rule.action) && typeof rule.action.replacePattern === 'string') return rule.action.replacePattern;
        return typeof rule.replacePattern === 'string' ? rule.replacePattern : null;
    }

    function legacyTypeModifiers(rule) {
        if (!isPlainObject(rule) || !Array.isArray(rule.requestTypes)) return [];
        return [...new Set(rule.requestTypes
            .map(t => WEBREQUEST_TO_FILTER_TYPE[String(t || '').toLowerCase()])
            .filter(Boolean))];
    }

    function finishRule(filter, rule, extras = {}) {
        const out = { filter };
        if (isPlainObject(rule)) {
            if (typeof rule.id === 'string') out.id = rule.id;
            if (typeof rule.description === 'string' && rule.description) out.description = rule.description;
            if (rule.active === false) out.active = false;
            if (Array.isArray(rule.preprocessors) && rule.preprocessors.length > 0) out.preprocessors = rule.preprocessors;
            // Internal marker added by the storage merge layer; kept so merged
            // rule ids survive a conversion.
            if (Array.isArray(rule._linkumoriActivationIds)) out._linkumoriActivationIds = rule._linkumoriActivationIds;
        }
        Object.assign(out, extras);
        return Object.keys(out).length === 1 ? filter : out;
    }

    function regexLiteral(source, flags) {
        return '/' + escapeRegexSlashes(source) + '/' + String(flags || '').replace(/[gy]/g, '');
    }

    function convertLegacyParamRule(rule, referral, results) {
        const text = replaceQueryprune(legacyRuleText(rule));
        if (!text) return;
        const kind = isPlainObject(rule) && typeof rule.kind === 'string' ? rule.kind : 'field';
        if (kind === 'raw') { convertLegacyRegexRule(rule, 'strip', results); return; }
        if (kind === 'redirection' || (isPlainObject(rule) && isPlainObject(rule.action) && rule.action.type === 'redirect')) {
            convertLegacyRegexRule(rule, 'redirect', results);
            return;
        }
        const extraModifiers = [...legacyTypeModifiers(rule)];
        if (referral) extraModifiers.push('referral');
        if (isPlainObject(rule) && rule.historyBypassProtection === false) extraModifiers.push('history-bypass-protection=false');

        let filter, removeValue;
        const parsed = /\$/.test(text) ? parseFilter(text) : null;
        if (parsed && !parsed.error && parsed.action === 'removeparam') {
            filter = text.trim();
            const token = parsed.modifiers.find(m => /^removeparam/i.test(m)) || 'removeparam';
            removeValue = token.includes('=') ? token.slice(token.indexOf('=') + 1) : '';
        } else {
            const flags = isPlainObject(rule) && typeof rule.flags === 'string' ? rule.flags : 'i';
            removeValue = /^[A-Za-z0-9_:-]+$/.test(text) && flags.includes('i')
                ? text : regexLiteral('^(?:' + text + ')$', flags);
            filter = '$removeparam=' + removeValue;
        }
        const existing = parseFilter(filter);
        const known = existing && !existing.error ? existing.modifiers.map(m => m.toLowerCase()) : [];
        const missing = extraModifiers.filter(m => !known.includes(m.toLowerCase()));
        if (missing.length > 0) filter += ',' + missing.join(',');

        const extras = {};
        const replacePattern = legacyReplacePattern(rule);
        if (replacePattern !== null) extras.replace = templateFromInternal(replacePattern);
        results.push(finishRule(filter, rule, extras));

        // Per-rule URL exceptions become scoped @@ exceptions for the same parameter.
        if (isPlainObject(rule) && Array.isArray(rule.exceptions)) {
            rule.exceptions.filter(e => typeof e === 'string' && e).forEach(ex => {
                results.push('@@' + regexLiteral(ex, '') + '$removeparam' + (removeValue ? '=' + removeValue : '') +
                    (referral ? ',referral' : ''));
            });
        }
    }

    function convertLegacyRegexRule(rule, action, results, force = false) {
        const text = legacyRuleText(rule);
        if (!text) return;
        const flags = isPlainObject(rule) && typeof rule.flags === 'string' ? rule.flags : 'i';
        const modifiers = legacyTypeModifiers(rule);
        if (isPlainObject(rule) && rule.historyBypassProtection === false) modifiers.push('history-bypass-protection=false');
        const replacePattern = legacyReplacePattern(rule);
        const extras = {};
        let filter = (action === 'allow' ? '@@' : '') + regexLiteral(text, flags);
        const tokens = [...modifiers];
        if (action === 'strip') tokens.unshift('strip');
        if (action === 'redirect') {
            if (force) tokens.push('force');
            // redirect=<target> must be the last modifier.
            tokens.push(replacePattern ? 'redirect=' + templateFromInternal(replacePattern) : 'redirect');
        }
        if (action === 'strip' && replacePattern !== null) extras.replace = templateFromInternal(replacePattern);
        if (tokens.length > 0) filter += '$' + tokens.join(',');
        results.push(finishRule(filter, rule, extras));
    }

    /** Convert an older multi-section provider (or a mixed one) to the unified shape. */
    function toCanonicalProvider(provider) {
        if (!isPlainObject(provider)) return { match: [], rules: [] };
        const source = normalizeLegacyProvider(provider);
        const rules = [];
        const match = toArray(source.match).length > 0 ? toArray(source.match).slice()
            : (toArray(source.domainPatterns).length > 0 ? toArray(source.domainPatterns).slice()
                : (typeof source.urlPattern === 'string' && source.urlPattern.trim()
                    ? [regexLiteral(source.urlPattern.trim(), 'i')] : []));

        if (source.completeProvider === true) rules.push('$block');
        if (isCanonicalProvider(provider) && Array.isArray(source.rules)) {
            source.rules.forEach(rule => rules.push(rule));
        } else {
            toArray(source.rules).forEach(rule => convertLegacyParamRule(rule, false, rules));
        }
        toArray(source.referralMarketing).forEach(rule => convertLegacyParamRule(rule, true, rules));
        toArray(source.exceptions).forEach(rule => convertLegacyRegexRule(rule, 'allow', rules));
        toArray(source.domainExceptions).forEach(pattern => rules.push('@@' + String(pattern).trim()));
        toArray(source.redirections).forEach(rule => convertLegacyRegexRule(rule, 'redirect', rules, source.forceRedirection === true));
        toArray(source.domainRedirections).forEach(entry => {
            let text = typeof entry === 'string' ? entry.trim() : '';
            if (isPlainObject(entry)) {
                const pattern = legacyRuleText(entry).trim();
                const target = legacyReplacePattern(entry);
                text = pattern && target ? `${pattern}$redirect=${target.trim()}` : '';
            }
            if (!text) return;
            if (source.forceRedirection === true) text = text.replace(/\$redirect=/i, '$force,redirect=');
            rules.push(text);
        });
        toArray(source.rawRules).forEach(rule => convertLegacyRegexRule(rule, 'strip', rules));

        const out = { match, rules };
        if (Array.isArray(source.methods) && source.methods.length > 0) out.methods = source.methods.slice();
        if (Array.isArray(source.resourceTypes) && source.resourceTypes.length > 0) out.resourceTypes = source.resourceTypes.slice();
        if (source.active === false) out.active = false;
        if (source.historyBypassProtection === false) out.historyBypassProtection = false;
        return out;
    }

    /** Validation errors for one provider in the unified shape. */
    function validateProvider(provider, providerName = 'provider') {
        if (!isPlainObject(provider)) return [`${providerName}: provider must be an object`];
        if (!isCanonicalProvider(provider)) {
            return [`${providerName}: missing "match" (older format — convert it to "match" + "rules")`];
        }
        const errors = compileProvider(provider, providerName).errors;
        LEGACY_PROVIDER_KEYS.forEach(key => {
            if (Object.prototype.hasOwnProperty.call(provider, key)) {
                errors.push(`${providerName}: "${key}" is from the older format; express it in "rules"`);
            }
        });
        return [...new Set(errors)];
    }

    /**
     * Prepare one provider for the storage merge / engine: unified providers
     * are compiled, older ones only get their alias spellings folded.
     */
    function prepareProvider(provider, providerName) {
        if (!isCanonicalProvider(provider)) return normalizeLegacyProvider(provider);
        const { provider: compiled, errors } = compileProvider(provider, providerName);
        if (errors.length > 0 && root.console && typeof root.console.warn === 'function') {
            root.console.warn('[linkumori] rule syntax errors', errors);
        }
        return compiled;
    }

    function prepareRulesData(data) {
        if (!isPlainObject(data) || !isPlainObject(data.providers)) return data;
        const providers = {};
        Object.keys(data.providers).forEach(name => { providers[name] = prepareProvider(data.providers[name], name); });
        return { ...data, providers };
    }

    const api = Object.freeze({
        REQUEST_TYPES,
        compileProvider,
        escapeRegexSlashes,
        isCanonicalProvider,
        normalizeLegacyProvider,
        parseFilter,
        prepareProvider,
        prepareRulesData,
        toCanonicalProvider,
        validateProvider
    });
    root.LinkumoriRuleSyntax = api;
    if (typeof module === 'object' && module && module.exports) module.exports = api;
})(typeof globalThis !== 'undefined' ? globalThis : this);
