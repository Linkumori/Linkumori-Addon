/*
 * ============================================================
 * Linkumori — URL Filter Interoperability Parser
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
 * MERCHANTABILITY or FITNESS FOR A PARTICULAR PURPOSE. See the
 * GNU Lesser General Public License for more details.
 *
 * You should have received a copy of the GNU Lesser General Public
 * License along with this program. If not, see
 * <http://www.gnu.org/licenses/>.
 *
 * DESCRIPTION
 * -----------
 * Linkumori URL filter interoperability support.
 *
 * This intentionally supports only the URL-cleaning subset of popular extension
 * filter lists: $removeparam and its deprecated alias $queryprune. It does not
 * implement request blocking, cosmetic filtering, scriptlets, or a full
 * adblock rule engine.
 *
 * ============================================================
 * MODIFICATION HISTORY
 * ============================================================
 * 2026-04-26   Subham Mahesh   File created
 *
 * Note: Due to inline constraints, subsequent modifications may
 * not appear here. To view the full history, run:
 *
 *   node linkumori-cli-tool.js
 *
 * Select "Generate Commit History" to produce a Markdown file
 * listing all modifications by file, author, and date.
 *
 * IMPORTANT NOTES
 * ---------------
 * - git clone is required before running "Generate Commit History";
 *   otherwise commit history generation will not work.
 * - Older modifications may not appear in the generated
 *   COMMIT_HISTORY.md.
 * - If a file's inline notice is limited, check for a separate
 *   file-specific notice and COMMIT_HISTORY.md; if neither exists,
 *   treat the inline notice as the final modification record.
 * - If a separate file-specific notice is provided, check the
 *   file's inline notice and COMMIT_HISTORY.md; if neither exists,
 *   treat the separate notice as the final modification record.
 * - Review individual modified source files for earlier notices.
 * - Some files may not contain notices within the file itself or
 *   may not be listed in COMMIT_HISTORY.md; a separate notice
 *   file may be provided instead.
 * - Not all source files have been modified, but review notices
 *   in all source files and any separate notice files (.md or .txt).
 * ============================================================
 */
(function () {
    'use strict';

    const PROVIDER_NAME = 'linkumori-url-filter-interoperability-filter';
    const NOOP_MODIFIERS = new Set(['_', 'noop', 'stealth', 'cookie']);
    const REMOVE_PARAM_RULE_PATTERN = /\$(?:[^,\s]*,)*(?:removeparam|queryprune)(?:[=,\s]|$)/i;
    const CONTENT_TYPE_TO_REQUEST_TYPE = {
        document: ['main_frame'],
        doc: ['main_frame'],
        subdocument: ['sub_frame'],
        frame: ['sub_frame'],
        script: ['script'],
        stylesheet: ['stylesheet'],
        image: ['image'],
        media: ['media'],
        font: ['font'],
        object: ['object'],
        xmlhttprequest: ['xmlhttprequest'],
        xhr: ['xmlhttprequest'],
        websocket: ['websocket'],
        ping: ['ping'],
        other: ['other']
    };
    const SUPPORTED_METHODS = new Set(['GET', 'HEAD', 'OPTIONS', 'POST', 'PUT', 'PATCH', 'DELETE', 'CONNECT']);

    function i18n(key, substitutions = []) {
        return globalThis.LinkumoriI18n.getMessage(key, substitutions);
    }

    function findModifierStart(ruleText) {
        const text = String(ruleText || '');
        if (!text) return -1;

        if (text.startsWith('/^')) {
            let escaped = false;
            for (let i = 1; i < text.length; i++) {
                const ch = text.charAt(i);
                if (escaped) {
                    escaped = false;
                    continue;
                }
                if (ch === '\\') {
                    escaped = true;
                    continue;
                }
                if (ch === '/') {
                    return text.charAt(i + 1) === '$' ? i + 1 : text.indexOf('$', i + 1);
                }
            }
        }

        return text.indexOf('$');
    }

    function safeDecode(value) {
        try {
            return decodeURIComponent(String(value || '').replace(/\+/g, '%20'));
        } catch (e) {
            return String(value || '');
        }
    }

    function splitModifiers(modifiersText) {
        const text = String(modifiersText || '');
        if (!text) return [];

        const parts = [];
        let current = '';
        let inRegex = false;
        let escaped = false;

        for (let i = 0; i < text.length; i++) {
            const ch = text.charAt(i);
            const next = i + 1 < text.length ? text.charAt(i + 1) : '';

            if (!inRegex) {
                if (ch === ',') {
                    if (current.trim()) parts.push(current.trim());
                    current = '';
                    continue;
                }

                current += ch;

                if (
                    ch === '=' &&
                    (
                        next === '/' ||
                        (
                            next === '~' &&
                            i + 2 < text.length &&
                            text.charAt(i + 2) === '/'
                        )
                    )
                ) {
                    current += next === '~' ? '~/' : '/';
                    inRegex = true;
                    escaped = false;
                    i += next === '~' ? 2 : 1;
                }
                continue;
            }

            current += ch;
            if (escaped) {
                escaped = false;
                continue;
            }
            if (ch === '\\') {
                escaped = true;
                continue;
            }
            if (ch === '/') {
                inRegex = false;
            }
        }

        if (current.trim()) parts.push(current.trim());
        return parts;
    }

    function parseRegexLiteral(value) {
        const match = String(value || '').match(/^\/((?:\\.|[^/])+)\/([a-z]*)$/i);
        if (!match) return null;

        const flags = match[2] && match[2].includes('i') ? 'i' : '';
        try {
            return new RegExp(match[1], flags);
        } catch (e) {
            return null;
        }
    }

    function splitDelimitedModifierValues(rawValue) {
        const values = [];
        let current = '';
        let inRegex = false;
        let escaped = false;

        String(rawValue || '').split('').forEach(ch => {
            if (!inRegex && ch === '|') {
                if (current.trim()) values.push(current.trim());
                current = '';
                return;
            }

            current += ch;
            if (escaped) {
                escaped = false;
                return;
            }
            if (ch === '\\') {
                escaped = true;
                return;
            }
            if (ch === '/') {
                inRegex = !inRegex;
            }
        });

        if (current.trim()) values.push(current.trim());
        return values;
    }

    function addDelimitedValues(rawValue, includes, excludes, transform = value => value) {
        splitDelimitedModifierValues(rawValue).forEach(part => {
            const raw = String(part || '').trim();
            if (!raw) return;

            if (raw.startsWith('~')) {
                const value = transform(raw.slice(1).trim());
                if (value) excludes.push(value);
                return;
            }

            const value = transform(raw);
            if (value) includes.push(value);
        });
    }

    function addDomainValues(rawValue, includes, excludes, includeRegexes, excludeRegexes) {
        splitDelimitedModifierValues(rawValue).forEach(part => {
            const raw = String(part || '').trim();
            if (!raw) return;

            const negated = raw.startsWith('~');
            const value = negated ? raw.slice(1).trim() : raw;
            const regex = parseRegexLiteral(value);

            if (regex) {
                (negated ? excludeRegexes : includeRegexes).push(regex);
                return;
            }

            (negated ? excludes : includes).push(value.toLowerCase());
        });
    }

    function addContentType(token, parsed) {
        const raw = String(token || '').trim();
        if (!raw) return false;

        const negated = raw.startsWith('~');
        const name = (negated ? raw.slice(1) : raw).toLowerCase();
        const requestTypes = CONTENT_TYPE_TO_REQUEST_TYPE[name];
        if (!requestTypes) return false;

        const target = negated ? parsed.excludeResourceTypes : parsed.includeResourceTypes;
        requestTypes.forEach(type => {
            if (!target.includes(type)) target.push(type);
        });
        return true;
    }

    function addTargetDomains(rawValue, includes, excludes) {
        addDelimitedValues(rawValue, includes, excludes, value => value.toLowerCase());
    }

    function withoutBadfilterModifier(ruleText) {
        const parsed = parseRemoveParamRule(ruleText, { ignoreBadfilter: true });
        if (parsed && parsed.canonical) return parsed.canonical;
        return String(ruleText || '').trim();
    }

    function parseRemoveParamRule(ruleText, options = {}) {
        const rawRule = String(ruleText || '').trim();
        if (!rawRule || rawRule.startsWith('!') || rawRule.startsWith('[')) return null;

        let candidate = rawRule;
        let isException = false;
        if (candidate.startsWith('@@')) {
            isException = true;
            candidate = candidate.slice(2);
        }

        const modifierStart = findModifierStart(candidate);
        if (modifierStart === -1) return null;

        const patternPart = candidate.slice(0, modifierStart).trim();
        const modifiersPart = candidate.slice(modifierStart + 1).trim();
        if (!modifiersPart) return null;

        const parsed = {
            format: 'linkumori-url-filter-interoperability',
            raw: rawRule,
            isException,
            urlPattern: patternPart || '*',
            removeAll: false,
            negate: false,
            literalParam: null,
            regexParam: null,
            includeDomains: [],
            excludeDomains: [],
            includeDomainRegexes: [],
            excludeDomainRegexes: [],
            includeTargetDomains: [],
            excludeTargetDomains: [],
            includeTargetDomainRegexes: [],
            excludeTargetDomainRegexes: [],
            denyallowDomains: [],
            denyallowDomainRegexes: [],
            includeMethods: [],
            excludeMethods: [],
            includeResourceTypes: [],
            excludeResourceTypes: [],
            firstPartyOnly: false,
            thirdPartyOnly: false,
            strictFirstPartyOnly: false,
            strictThirdPartyOnly: false,
            matchCase: false,
            important: false,
            isBadfilter: false,
            badfilterTarget: null,
            includeApps: [],
            excludeApps: [],
            includeAppRegexes: [],
            excludeAppRegexes: []
        };

        let removeParamToken = null;
        let unsupportedModifier = null;

        splitModifiers(modifiersPart).forEach(token => {
            if (unsupportedModifier) return;

            const normalized = token.toLowerCase();
            if (
                normalized === 'removeparam' ||
                normalized.startsWith('removeparam=') ||
                normalized === 'queryprune' ||
                normalized.startsWith('queryprune=')
            ) {
                removeParamToken = token;
                return;
            }

            if (NOOP_MODIFIERS.has(normalized)) {
                return;
            }

            if (normalized === 'important') {
                if (isException) {
                    unsupportedModifier = token;
                    return;
                }
                parsed.important = true;
                return;
            }

            if (normalized === 'badfilter' && !options.ignoreBadfilter) {
                parsed.isBadfilter = true;
                parsed.badfilterTarget = withoutBadfilterModifier(rawRule);
                return;
            }
            if (normalized === 'badfilter' && options.ignoreBadfilter) {
                return;
            }

            if (normalized === 'match-case') {
                parsed.matchCase = true;
                return;
            }

            if (
                normalized === 'third-party' ||
                normalized === '3p' ||
                normalized === '~first-party' ||
                normalized === '~1p'
            ) {
                parsed.thirdPartyOnly = true;
                return;
            }

            if (
                normalized === 'first-party' ||
                normalized === '1p' ||
                normalized === '~third-party' ||
                normalized === '~3p'
            ) {
                parsed.firstPartyOnly = true;
                return;
            }

            if (normalized === 'strict-third-party' || normalized === 'strict3p') {
                parsed.strictThirdPartyOnly = true;
                return;
            }

            if (normalized === 'strict-first-party' || normalized === 'strict1p') {
                parsed.strictFirstPartyOnly = true;
                return;
            }

            if (normalized.startsWith('domain=') || normalized.startsWith('from=')) {
                const domainValue = token.slice(token.indexOf('=') + 1);
                if (!domainValue || splitDelimitedModifierValues(domainValue).length === 0) {
                    unsupportedModifier = token;
                    return;
                }
                addDomainValues(
                    domainValue,
                    parsed.includeDomains,
                    parsed.excludeDomains,
                    parsed.includeDomainRegexes,
                    parsed.excludeDomainRegexes
                );
                return;
            }

            if (normalized.startsWith('to=')) {
                const targetValue = token.slice(token.indexOf('=') + 1);
                if (!targetValue || splitDelimitedModifierValues(targetValue).length === 0) {
                    unsupportedModifier = token;
                    return;
                }
                addDomainValues(
                    targetValue,
                    parsed.includeTargetDomains,
                    parsed.excludeTargetDomains,
                    parsed.includeTargetDomainRegexes,
                    parsed.excludeTargetDomainRegexes
                );
                return;
            }

            if (normalized.startsWith('denyallow=')) {
                const denyallowValue = token.slice(token.indexOf('=') + 1);
                const denyallowParts = splitDelimitedModifierValues(denyallowValue);
                if (
                    !denyallowValue ||
                    denyallowParts.length === 0 ||
                    denyallowParts.some(value => {
                        const v = String(value || '').trim();
                        return v.startsWith('~') || v.endsWith('.*') || parseRegexLiteral(v) !== null;
                    })
                ) {
                    unsupportedModifier = token;
                    return;
                }
                addDomainValues(
                    denyallowValue,
                    parsed.denyallowDomains,
                    [],
                    parsed.denyallowDomainRegexes,
                    []
                );
                return;
            }

            if (normalized.startsWith('method=')) {
                const methodValue = token.slice(token.indexOf('=') + 1);
                const methodTokens = splitDelimitedModifierValues(methodValue);
                if (
                    methodTokens.length === 0 ||
                    methodTokens.some(value => !SUPPORTED_METHODS.has(String(value || '').replace(/^~/, '').toUpperCase()))
                ) {
                    unsupportedModifier = token;
                    return;
                }
                addDelimitedValues(
                    methodValue,
                    parsed.includeMethods,
                    parsed.excludeMethods,
                    value => value.toUpperCase()
                );
                return;
            }

            if (normalized.startsWith('app=')) {
                const appValue = token.slice(token.indexOf('=') + 1);
                if (!appValue || splitDelimitedModifierValues(appValue).length === 0) {
                    unsupportedModifier = token;
                    return;
                }
                addDomainValues(
                    appValue,
                    parsed.includeApps,
                    parsed.excludeApps,
                    parsed.includeAppRegexes,
                    parsed.excludeAppRegexes
                );
                return;
            }

            if (addContentType(token, parsed)) {
                return;
            }

            unsupportedModifier = token;
        });

        if (!removeParamToken) return null;
        if (unsupportedModifier) return null;
        if (
            (parsed.firstPartyOnly && parsed.thirdPartyOnly) ||
            (parsed.strictFirstPartyOnly && parsed.strictThirdPartyOnly) ||
            (parsed.strictFirstPartyOnly && parsed.thirdPartyOnly) ||
            (parsed.strictThirdPartyOnly && parsed.firstPartyOnly)
        ) {
            return null;
        }

        const removeValue = removeParamToken.indexOf('=') === -1
            ? ''
            : removeParamToken.slice(removeParamToken.indexOf('=') + 1).trim();

        if (!removeValue) {
            parsed.removeAll = true;
            parsed.canonical = canonicalizeRemoveParamRule(parsed);
            return parsed;
        }

        let value = removeValue;
        if (value.startsWith('~')) {
            parsed.negate = true;
            value = value.slice(1).trim();
        }

        const regexParam = parseRegexLiteral(value);
        if (regexParam) {
            parsed.regexParam = regexParam;
        } else if (value.startsWith('|')) {
            try {
                parsed.regexParam = new RegExp('^' + escapeRegExp(value.slice(1)), 'i');
            } catch (e) {
                return null;
            }
        } else {
            const literal = value;
            parsed.literalParam = literal;
        }

        parsed.canonical = canonicalizeRemoveParamRule(parsed);
        return parsed;
    }

    function normalizedRegexSource(regex) {
        if (!regex) return '';
        return '/' + regex.source + '/' + (regex.ignoreCase ? 'i' : '');
    }

    function sortedCopy(values) {
        return (Array.isArray(values) ? values : []).slice().sort();
    }

    function sortedRegexSources(regexes) {
        return (Array.isArray(regexes) ? regexes : [])
            .map(normalizedRegexSource)
            .sort();
    }

    function canonicalizeRemoveParamRule(rule) {
        const modifiers = [];
        let removeValue = '';

        if (rule.removeAll) {
            removeValue = '';
        } else if (rule.regexParam) {
            removeValue = (rule.negate ? '~' : '') + normalizedRegexSource(rule.regexParam);
        } else if (rule.literalParam !== null) {
            removeValue = (rule.negate ? '~' : '') + String(rule.literalParam);
        }

        modifiers.push(removeValue ? 'removeparam=' + removeValue : 'removeparam');

        [
            ['domain', sortedCopy(rule.includeDomains).concat(sortedCopy(rule.excludeDomains).map(value => '~' + value)).concat(sortedRegexSources(rule.includeDomainRegexes)).concat(sortedRegexSources(rule.excludeDomainRegexes).map(value => '~' + value))],
            ['to', sortedCopy(rule.includeTargetDomains).concat(sortedCopy(rule.excludeTargetDomains).map(value => '~' + value)).concat(sortedRegexSources(rule.includeTargetDomainRegexes)).concat(sortedRegexSources(rule.excludeTargetDomainRegexes).map(value => '~' + value))],
            ['denyallow', sortedCopy(rule.denyallowDomains).concat(sortedRegexSources(rule.denyallowDomainRegexes))],
            ['method', sortedCopy(rule.includeMethods).concat(sortedCopy(rule.excludeMethods).map(value => '~' + value))],
            ['app', sortedCopy(rule.includeApps).concat(sortedCopy(rule.excludeApps).map(value => '~' + value)).concat(sortedRegexSources(rule.includeAppRegexes)).concat(sortedRegexSources(rule.excludeAppRegexes).map(value => '~' + value))]
        ].forEach(([name, values]) => {
            if (values.length > 0) modifiers.push(name + '=' + values.join('|'));
        });

        sortedCopy(rule.includeResourceTypes).forEach(value => modifiers.push(value));
        sortedCopy(rule.excludeResourceTypes).forEach(value => modifiers.push('~' + value));

        if (rule.firstPartyOnly) modifiers.push('first-party');
        if (rule.thirdPartyOnly) modifiers.push('third-party');
        if (rule.strictFirstPartyOnly) modifiers.push('strict-first-party');
        if (rule.strictThirdPartyOnly) modifiers.push('strict-third-party');
        if (rule.matchCase) modifiers.push('match-case');
        if (rule.important) modifiers.push('important');

        return (rule.isException ? '@@' : '') +
            (rule.urlPattern || '*') +
            '$' +
            modifiers.sort().join(',');
    }

    function getHostname(url) {
        const source = String(url || '');
        const schemeIndex = source.indexOf('://');
        if (schemeIndex === -1) return '';

        let start = schemeIndex + 3;
        const end = source.length;
        const atIndex = source.indexOf('@', start);
        const firstPathIndex = source.slice(start).search(/[/?#]/);
        const authorityEnd = firstPathIndex === -1 ? end : start + firstPathIndex;
        if (atIndex !== -1 && atIndex < authorityEnd) {
            start = atIndex + 1;
        }

        let hostEnd = authorityEnd;
        if (source.charAt(start) === '[') {
            const bracketEnd = source.indexOf(']', start + 1);
            if (bracketEnd !== -1 && bracketEnd < authorityEnd) {
                hostEnd = bracketEnd + 1;
            }
        } else {
            const colonIndex = source.indexOf(':', start);
            if (colonIndex !== -1 && colonIndex < authorityEnd) {
                hostEnd = colonIndex;
            }
        }

        return normalizeHostname(source.slice(start, hostEnd));
    }

    function normalizeHostname(hostname) {
        return String(hostname || '').toLowerCase().replace(/\.$/, '').trim();
    }

    function parseHostnameWithPublicSuffixList(hostname) {
        const normalized = normalizeHostname(hostname);
        if (!normalized) return null;

        if (
            typeof globalThis.parseHostnameWithPsl === 'function'
        ) {
            const parsed = globalThis.parseHostnameWithPsl(normalized);
            if (parsed && parsed.domain && parsed.tld) return parsed;
        }

        const pslService = globalThis.linkumoriPsl || null;
        if (!pslService || pslService.status !== 'ready') {
            return null;
        }

        try {
            if (typeof pslService.parseNormalizedHostname === 'function') {
                const parsed = pslService.parseNormalizedHostname(normalized);
                if (parsed && parsed.listed && parsed.domain && parsed.tld) {
                    return parsed;
                }
            }

            if (typeof pslService.lookupNormalized === 'function') {
                const parsed = pslService.lookupNormalized(normalized);
                if (parsed && parsed.domain && parsed.tld) {
                    return parsed;
                }
            }

            if (
                pslService.parser &&
                typeof pslService.parser.getPublicSuffix === 'function' &&
                typeof pslService.parser.getDomain === 'function'
            ) {
                const tld = pslService.parser.getPublicSuffix(normalized) || null;
                const domain = pslService.parser.getDomain(normalized) || null;
                if (!tld || !domain) return null;

                let subdomain = null;
                if (normalized !== domain && normalized.endsWith('.' + domain)) {
                    subdomain = normalized.slice(0, -domain.length - 1) || null;
                }

                return {
                    hostname: normalized,
                    tld,
                    domain,
                    subdomain,
                    listed: true
                };
            }
        } catch (e) {
            return null;
        }

        return null;
    }

    function getRegistrableDomain(hostname) {
        const parsed = parseHostnameWithPublicSuffixList(hostname);
        if (parsed && parsed.domain) return parsed.domain;

        const normalized = normalizeHostname(hostname);
        const parts = normalized.split('.').filter(Boolean);
        if (parts.length <= 2) return normalized;
        return parts.slice(-2).join('.');
    }

    function hostnameMatchesWildcardPublicSuffix(hostname, pattern) {
        const normalizedHostname = normalizeHostname(hostname);
        const normalizedPattern = normalizeHostname(pattern);
        if (!normalizedHostname || !normalizedPattern.endsWith('.*')) return false;

        const parsed = parseHostnameWithPublicSuffixList(normalizedHostname);
        if (!parsed || !parsed.tld) return false;

        const base = normalizedPattern.slice(0, -2);
        const suffix = '.' + parsed.tld;
        if (!base || !normalizedHostname.endsWith(suffix)) return false;

        const hostWithoutSuffix = normalizedHostname.slice(0, -suffix.length);
        return hostWithoutSuffix === base || hostWithoutSuffix.endsWith('.' + base);
    }

    function hostnameMatches(hostname, pattern) {
        const normalizedHostname = normalizeHostname(hostname);
        let normalizedPattern = String(pattern || '').toLowerCase().trim();
        if (!normalizedHostname || !normalizedPattern) return false;

        if (normalizedPattern.startsWith('||')) {
            normalizedPattern = normalizedPattern.slice(2).replace(/\^$/, '');
        }
        if (normalizedPattern.startsWith('*.')) {
            normalizedPattern = normalizedPattern.slice(2);
        }

        if (normalizedPattern.endsWith('.*')) {
            return hostnameMatchesWildcardPublicSuffix(normalizedHostname, normalizedPattern);
        }

        return normalizedHostname === normalizedPattern || normalizedHostname.endsWith('.' + normalizedPattern);
    }

    function hostnameMatchesRegex(hostname, regexes) {
        const normalizedHostname = normalizeHostname(hostname);
        if (!normalizedHostname || !Array.isArray(regexes) || regexes.length === 0) return false;

        return regexes.some(regex => {
            regex.lastIndex = 0;
            return regex.test(normalizedHostname);
        });
    }

    function collectSourceHostnames(request) {
        const hosts = [];
        [
            request && request.initiator,
            request && request.originUrl,
            request && request.documentUrl
        ].forEach(url => {
            const host = typeof url === 'string' ? getHostname(url) : '';
            if (host && !hosts.includes(host)) hosts.push(host);
        });
        return hosts;
    }

    function getDocumentHostname(request) {
        const candidates = [
            request && request.documentUrl,
            request && request.originUrl,
            request && request.initiator
        ];
        for (const url of candidates) {
            const host = typeof url === 'string' ? getHostname(url) : '';
            if (host) return host;
        }
        return '';
    }

    function collectDomainModifierHostnames(request) {
        return collectSourceHostnames(request);
    }

    function createRequestMatchContext(fullUrl, request) {
        const ContextClass = globalThis.LinkumoriFilteringContext;
        if (ContextClass && typeof ContextClass.create === 'function') {
            return ContextClass.create(fullUrl, request, getRegistrableDomain);
        }

        const targetHost = getHostname(fullUrl);
        const registrableDomainCache = Object.create(null);

        return {
            fullUrl,
            request,
            targetHost,
            documentHost: getDocumentHostname(request),
            sourceHosts: collectSourceHostnames(request),
            domainModifierHosts: collectDomainModifierHostnames(request),
            requestMethod: request && typeof request.method === 'string'
                ? request.method.toUpperCase()
                : '',
            requestType: request && typeof request.type === 'string'
                ? request.type
                : '',
            requestMethodBit: 0,
            requestTypeBit: 0,
            appName: normalizeHostname(
                request && (typeof request.appName === 'string' ? request.appName
                    : (typeof request.app === 'string' ? request.app : ''))
            ),
            registrableDomain(hostname) {
                const normalized = normalizeHostname(hostname);
                if (!normalized) return '';
                if (!registrableDomainCache[normalized]) {
                    registrableDomainCache[normalized] = getRegistrableDomain(normalized);
                }
                return registrableDomainCache[normalized];
            }
        };
    }

    function escapeRegExp(value) {
        return String(value || '').replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
    }

    function interoperabilityPatternToRegex(pattern) {
        let output = '';
        const text = String(pattern || '');

        for (let i = 0; i < text.length; i++) {
            const ch = text.charAt(i);
            if (ch === '*') {
                output += '.*';
            } else if (ch === '^') {
                output += '(?:[^A-Za-z0-9_\\-.%]|$)';
            } else {
                output += escapeRegExp(ch);
            }
        }

        return output;
    }

    function createInteroperabilityUrlPatternMatcher(pattern, matchCase = false) {
        const rawPattern = String(pattern || '').trim();
        if (!rawPattern || rawPattern === '*' || rawPattern === '||') {
            return { kind: 'all' };
        }

        const regexPattern = parseRegexLiteral(rawPattern);
        if (regexPattern) {
            return { kind: 'regex', regex: regexPattern };
        }

        let regexText = '';
        let source = rawPattern;
        let leftAnchored = false;
        let rightAnchored = false;

        if (source.startsWith('|') && !source.startsWith('||')) {
            leftAnchored = true;
            source = source.slice(1);
        }
        if (source.endsWith('|')) {
            rightAnchored = true;
            source = source.slice(0, -1);
        }

        if (source.startsWith('||')) {
            source = source.slice(2);
            const separatorIndex = source.search(/[/?^*]/);
            const hostPattern = separatorIndex === -1 ? source : source.slice(0, separatorIndex);
            const rest = separatorIndex === -1 ? '' : source.slice(separatorIndex);
            const hostRegex = interoperabilityPatternToRegex(hostPattern);
            regexText = '^[a-z][a-z0-9+.-]*:\\/\\/([^/?#]*\\.)?' + hostRegex;
            regexText += interoperabilityPatternToRegex(rest);
        } else {
            regexText = interoperabilityPatternToRegex(source);
            if (leftAnchored) regexText = '^' + regexText;
        }

        if (rightAnchored) regexText += '$';

        try {
            return {
                kind: 'regex',
                regex: new RegExp(regexText, matchCase ? '' : 'i')
            };
        } catch (e) {
            return {
                kind: 'includes',
                matchCase,
                needle: (matchCase ? rawPattern : rawPattern.toLowerCase()).replace(/\*/g, '')
            };
        }
    }

    function matchPreparedUrlPattern(matcher, fullUrl) {
        if (!matcher) return false;
        if (matcher.kind === 'all') return true;
        if (matcher.kind === 'regex') {
            matcher.regex.lastIndex = 0;
            return matcher.regex.test(fullUrl);
        }
        if (matcher.kind === 'includes') {
            const haystack = matcher.matchCase ? fullUrl : fullUrl.toLowerCase();
            return haystack.includes(matcher.needle);
        }
        return false;
    }

    function getUrlPatternMatcher(rule) {
        if (!rule._linkumoriUrlPatternMatcher) {
            rule._linkumoriUrlPatternMatcher = createInteroperabilityUrlPatternMatcher(
                rule.urlPattern,
                !!rule.matchCase
            );
        }
        return rule._linkumoriUrlPatternMatcher;
    }

    function matchUrlPattern(rule, fullUrl) {
        if (!rule || !fullUrl) return false;
        return matchPreparedUrlPattern(getUrlPatternMatcher(rule), fullUrl);
    }

    function matchAdguardUrlPattern(pattern, fullUrl, matchCase = false) {
        return matchPreparedUrlPattern(
            createInteroperabilityUrlPatternMatcher(pattern, matchCase),
            fullUrl
        );
    }

    function matchUrlPatternLegacy(rule, fullUrl) {
        const host = getHostname(fullUrl);
        if (rule.urlPattern.startsWith('||')) {
            return hostnameMatches(host, rule.urlPattern);
        }

        return fullUrl.toLowerCase().includes(rule.urlPattern.toLowerCase());
    }

    function matchesDomainModifiers(rule, context) {
        const hosts = context.domainModifierHosts;

        if (rule.includeDomains.length > 0) {
            const included = rule.includeDomains.some(pattern => {
                return hosts.some(host => hostnameMatches(host, pattern));
            });
            if (!included) return false;
        }

        if (rule.includeDomainRegexes.length > 0) {
            const included = hosts.some(host => hostnameMatchesRegex(host, rule.includeDomainRegexes));
            if (!included) return false;
        }

        if (rule.excludeDomains.length > 0) {
            const excluded = rule.excludeDomains.some(pattern => {
                return hosts.some(host => hostnameMatches(host, pattern));
            });
            if (excluded) return false;
        }

        if (rule.excludeDomainRegexes.length > 0) {
            const excluded = hosts.some(host => hostnameMatchesRegex(host, rule.excludeDomainRegexes));
            if (excluded) return false;
        }

        return true;
    }

    function matchesTargetDomainModifiers(rule, context) {
        const targetHost = context.targetHost;
        if (!targetHost) return false;

        if (rule.includeTargetDomains.length > 0) {
            const included = rule.includeTargetDomains.some(pattern => hostnameMatches(targetHost, pattern));
            if (!included) return false;
        }

        if (rule.includeTargetDomainRegexes.length > 0 && !hostnameMatchesRegex(targetHost, rule.includeTargetDomainRegexes)) {
            return false;
        }

        if (rule.excludeTargetDomains.length > 0) {
            const excluded = rule.excludeTargetDomains.some(pattern => hostnameMatches(targetHost, pattern));
            if (excluded) return false;
        }

        if (hostnameMatchesRegex(targetHost, rule.excludeTargetDomainRegexes)) {
            return false;
        }

        if (rule.denyallowDomains.length > 0) {
            const denied = rule.denyallowDomains.some(pattern => hostnameMatches(targetHost, pattern));
            if (denied) return false;
        }

        if (hostnameMatchesRegex(targetHost, rule.denyallowDomainRegexes)) {
            return false;
        }

        return true;
    }

    function matchesPartyModifiers(rule, context) {
        if (
            !rule.firstPartyOnly &&
            !rule.thirdPartyOnly &&
            !rule.strictFirstPartyOnly &&
            !rule.strictThirdPartyOnly
        ) {
            return true;
        }

        const targetHost = context.targetHost;
        const documentHost = context.documentHost || '';
        if (!targetHost) {
            return false;
        }

        if (!documentHost) {
            // No referrer is treated as first-party per AdGuard spec
            return !rule.thirdPartyOnly && !rule.strictThirdPartyOnly;
        }

        const sameHost = documentHost === targetHost;
        const targetSite = context.registrableDomain(targetHost);
        const documentSite = context.registrableDomain(documentHost);
        const sameSite = !!targetSite && !!documentSite && targetSite === documentSite;

        if (rule.strictFirstPartyOnly && !sameHost) return false;
        if (rule.strictThirdPartyOnly && sameHost) return false;
        if (rule.firstPartyOnly && !sameSite) return false;
        if (rule.thirdPartyOnly && sameSite) return false;

        return true;
    }

    function matchesMethod(rule, context) {
        const ContextClass = globalThis.LinkumoriFilteringContext;
        if (ContextClass) {
            const requestMethodBit = context.requestMethodBit || 0;
            const includeMask = rule._linkumoriIncludeMethodMask || 0;
            const excludeMask = rule._linkumoriExcludeMethodMask || 0;

            if (includeMask !== 0 && (requestMethodBit === 0 || (includeMask & requestMethodBit) === 0)) {
                return false;
            }
            if (excludeMask !== 0 && requestMethodBit !== 0 && (excludeMask & requestMethodBit) !== 0) {
                return false;
            }
            if (includeMask === 0 && excludeMask === 0 && requestMethodBit !== 0 && (ContextClass.DEFAULT_METHOD_MASK & requestMethodBit) === 0) {
                return false;
            }

            return true;
        }

        const requestMethod = context.requestMethod;
        if (rule.includeMethods.length > 0 && !rule.includeMethods.includes(requestMethod)) {
            return false;
        }
        if (rule.excludeMethods.length > 0 && rule.excludeMethods.includes(requestMethod)) {
            return false;
        }
        if (rule.includeMethods.length === 0 && rule.excludeMethods.length === 0 && requestMethod && !['GET', 'HEAD', 'OPTIONS'].includes(requestMethod)) {
            return false;
        }

        return true;
    }

    function matchesResourceType(rule, context) {
        const requestTypeBit = context.requestTypeBit || 0;
        const includeMask = rule._linkumoriIncludeResourceTypeMask || 0;
        const excludeMask = rule._linkumoriExcludeResourceTypeMask || 0;

        if (includeMask !== 0 && (requestTypeBit === 0 || (includeMask & requestTypeBit) === 0)) {
            return false;
        }
        if (excludeMask !== 0 && requestTypeBit !== 0 && (excludeMask & requestTypeBit) !== 0) {
            return false;
        }
        if (includeMask === 0 && excludeMask === 0) {
            if (Array.isArray(rule.includeResourceTypes) && rule.includeResourceTypes.length > 0) {
                return rule.includeResourceTypes.includes(context.requestType || '');
            }
            if (Array.isArray(rule.excludeResourceTypes) && rule.excludeResourceTypes.length > 0) {
                return !(context.requestType && rule.excludeResourceTypes.includes(context.requestType));
            }
            return true;
        }

        return true;
    }

    function matchesAppModifier(rule, context) {
        // Popular extension $app modifier targets native apps. Browser requests have
        // no app package context, but tests/embedders may pass appName.
        const appName = context.appName;
        if (!appName) {
            return (rule.includeApps.length === 0 && rule.includeAppRegexes.length === 0);
        }

        if (rule.includeApps.length > 0) {
            const included = rule.includeApps.some(pattern => appPatternMatches(appName, pattern));
            if (!included) return false;
        }
        if (hostnameMatchesRegex(appName, rule.includeAppRegexes) === false && rule.includeAppRegexes.length > 0) {
            return false;
        }
        if (rule.excludeApps.some(pattern => appPatternMatches(appName, pattern))) {
            return false;
        }
        if (hostnameMatchesRegex(appName, rule.excludeAppRegexes)) {
            return false;
        }
        return true;
    }

    function appPatternMatches(appName, pattern) {
        const normalizedPattern = String(pattern || '').toLowerCase().trim();
        if (!normalizedPattern) return false;
        if (normalizedPattern.includes('*')) {
            const regex = new RegExp('^' + escapeRegExp(normalizedPattern).replace(/\\\*/g, '.*') + '$');
            return regex.test(appName);
        }
        return appName === normalizedPattern;
    }

    function prepareRule(rule) {
        if (!rule) return rule;
        getUrlPatternMatcher(rule);
        const ContextClass = globalThis.LinkumoriFilteringContext;
        if (ContextClass) {
            rule._linkumoriIncludeMethodMask = ContextClass.buildMask(
                rule.includeMethods,
                ContextClass.getMethodBit
            );
            rule._linkumoriExcludeMethodMask = ContextClass.buildMask(
                rule.excludeMethods,
                ContextClass.getMethodBit
            );
            rule._linkumoriIncludeResourceTypeMask = ContextClass.buildMask(
                rule.includeResourceTypes,
                ContextClass.getResourceTypeBit
            );
            rule._linkumoriExcludeResourceTypeMask = ContextClass.buildMask(
                rule.excludeResourceTypes,
                ContextClass.getResourceTypeBit
            );
        }
        return rule;
    }

    function matchesTargetWithContext(rule, context) {
        return !!(
            rule &&
            context &&
            matchUrlPattern(rule, context.fullUrl) &&
            matchesDomainModifiers(rule, context) &&
            matchesTargetDomainModifiers(rule, context) &&
            matchesPartyModifiers(rule, context) &&
            matchesMethod(rule, context) &&
            matchesResourceType(rule, context) &&
            matchesAppModifier(rule, context)
        );
    }

    function matchesTarget(rule, fullUrl, request = null) {
        return matchesTargetWithContext(
            rule,
            createRequestMatchContext(fullUrl, request)
        );
    }

    function matchesParameter(rule, name, value = '', rawName = null, rawValue = null) {
        if (!rule || !name) return false;
        if (rule.removeAll) return true;

        const normalizedName = String(rawName !== null ? rawName : name || '');
        let matched = false;

        if (rule.regexParam) {
            const normalizedValue = rawValue !== null
                ? safeDecode(rawValue)
                : String(value || '');
            const normalizedPair = `${normalizedName}=${normalizedValue}`;
            rule.regexParam.lastIndex = 0;
            matched = rule.regexParam.test(normalizedPair);
        } else if (rule.literalParam !== null) {
            matched = rule.matchCase
                ? normalizedName === rule.literalParam
                : normalizedName.toLowerCase() === String(rule.literalParam).toLowerCase();
        }

        return rule.negate ? !matched : matched;
    }

    function parseFilterList(text, sourceUrl = '') {
        const rules = [];
        const seen = new Set();
        let unsupportedRuleCount = 0;
        let duplicateRuleCount = 0;
        const sourceText = String(text || '');
        let lineStart = 0;

        while (lineStart <= sourceText.length) {
            let lineEnd = sourceText.indexOf('\n', lineStart);
            if (lineEnd === -1) {
                lineEnd = sourceText.length;
            }

            let rawLine = sourceText.slice(lineStart, lineEnd);
            if (rawLine.endsWith('\r')) {
                rawLine = rawLine.slice(0, -1);
            }
            lineStart = lineEnd + 1;

            const trimmed = rawLine.trim();
            if (!trimmed || trimmed.startsWith('!') || trimmed.startsWith('[')) continue;
            if (!REMOVE_PARAM_RULE_PATTERN.test(trimmed)) continue;
            if (!parseRemoveParamRule(trimmed)) {
                unsupportedRuleCount++;
                continue;
            }
            if (seen.has(trimmed)) {
                duplicateRuleCount++;
                continue;
            }

            seen.add(trimmed);
            rules.push(trimmed);
        }

        if (rules.length === 0) {
            throw new Error(i18n('linkumori_url_filter_no_supported_rules'));
        }

        return {
            metadata: {
                name: i18n('linkumori_url_filter_interoperability_name'),
                version: new Date().toISOString(),
                license: 'filter-list',
                author: i18n('linkumori_url_filter_interoperability_author'),
                source: 'linkumori_url_filter_interoperability',
                sourceURL: sourceUrl || null,
                providerCount: 1,
                supportedRuleCount: rules.length,
                skippedUnsupportedRuleCount: unsupportedRuleCount,
                skippedDuplicateRuleCount: duplicateRuleCount
            },
            format: 'linkumori-url-filter-interoperability',
            rules
        };
    }

    function looksLikeFilterList(text) {
        return REMOVE_PARAM_RULE_PATTERN.test(String(text || ''));
    }

    globalThis.LinkumoriURLFilterInteroperability = {
        PROVIDER_NAME,
        splitModifiers,
        parseRemoveParamRule,
        matchesTarget,
        matchesParameter,
        parseFilterList,
        looksLikeFilterList,
        prepareRule,
        createRequestMatchContext,
        matchesTargetWithContext
    };
})();
