/*
 * ============================================================
 * Linkumori — URL Filter Runtime
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
 * Linkumori URL Filter Runtime
 *
 * Runtime support for LinkumoriURLsData. It intentionally keeps the
 * LinkumoriURLsData parsing/compilation logic separate from ClearURLs provider
 * parsing, while delegating actual webRequest interception to the single
 * onBeforeRequest listener registered in clearurls.js.
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
var linkumoriURLFilterRuntime = {
    started: false,
    rules: [],
    exceptions: [],
    compiled: null,
    lastDataRef: null,
    lastRulesRef: null,
    lastDataVersion: null,
    lastRuleCount: 0
};

function linkumoriURLFilterRuntimeI18n(key, substitutions = []) {
    return globalThis.LinkumoriI18n.getMessage(key, substitutions);
}

function createLinkumoriURLFilterBuckets() {
    return {
        all: [],
        fallback: [],
        reverseIndex: Object.create(null),
        removeAll: [],
        negated: [],
        literalCaseSensitive: Object.create(null),
        literalCaseInsensitive: Object.create(null),
        regex: [],
        tokenTrie: typeof LinkumoriBidiTrie === 'function' ? new LinkumoriBidiTrie() : null,
        includeDomainTrie: typeof LinkumoriHNTrie === 'function' ? new LinkumoriHNTrie() : null,
        excludeDomainTrie: typeof LinkumoriHNTrie === 'function' ? new LinkumoriHNTrie() : null,
        denyallowDomainTrie: typeof LinkumoriHNTrie === 'function' ? new LinkumoriHNTrie() : null
    };
}

function addLinkumoriURLFilterReverseIndexEntry(buckets, token, rule) {
    if (!token) {
        buckets.fallback.push(rule);
        return;
    }

    if (!buckets.reverseIndex[token]) {
        buckets.reverseIndex[token] = [];
    }
    buckets.reverseIndex[token].push(rule);
}

function addLinkumoriURLFilterBucketEntry(bucket, key, rule) {
    if (!bucket[key]) {
        bucket[key] = [];
    }
    bucket[key].push(rule);
}

function addLinkumoriURLFilterRuleToBuckets(buckets, rule, indexToken) {
    buckets.all.push(rule);
    addLinkumoriURLFilterReverseIndexEntry(buckets, indexToken, rule);

    if (buckets.includeDomainTrie && Array.isArray(rule.includeTargetDomains)) {
        rule.includeTargetDomains.forEach(hostname => buckets.includeDomainTrie.add(hostname, rule));
    }
    if (buckets.excludeDomainTrie && Array.isArray(rule.excludeTargetDomains)) {
        rule.excludeTargetDomains.forEach(hostname => buckets.excludeDomainTrie.add(hostname, rule));
    }
    if (buckets.denyallowDomainTrie && Array.isArray(rule.denyallowDomains)) {
        rule.denyallowDomains.forEach(hostname => buckets.denyallowDomainTrie.add(hostname, rule));
    }

    if (rule.removeAll) {
        buckets.removeAll.push(rule);
        return;
    }

    if (rule.negate) {
        buckets.negated.push(rule);
        return;
    }

    if (rule.literalParam !== null) {
        const target = rule.matchCase
            ? buckets.literalCaseSensitive
            : buckets.literalCaseInsensitive;
        addLinkumoriURLFilterBucketEntry(target, rule.literalParam, rule);
        if (buckets.tokenTrie) {
            buckets.tokenTrie.add(rule.literalParam, rule);
        }
        return;
    }

    if (rule.regexParam) {
        buckets.regex.push(rule);
    }
}

function normalizeLinkumoriURLFilterHostnamePattern(pattern) {
    const normalized = String(pattern || '')
        .toLowerCase()
        .replace(/^\|\|/, '')
        .replace(/^\*\./, '')
        .replace(/\^.*$/, '')
        .replace(/[/?#].*$/, '')
        .replace(/\.$/, '')
        .trim();

    if (!normalized || normalized.includes('*') || normalized.startsWith('/') || normalized.includes('|')) {
        return '';
    }
    if (!/^[a-z0-9.-]+$/i.test(normalized) || normalized.indexOf('.') === -1) {
        return '';
    }
    return normalized;
}

function getLinkumoriURLPatternHostnameToken(rule) {
    const pattern = String(rule && rule.urlPattern ? rule.urlPattern : '').trim();
    if (!pattern.startsWith('||')) return '';

    const source = pattern.slice(2);
    const separatorIndex = source.search(/[/?^*|]/);
    const hostname = separatorIndex === -1 ? source : source.slice(0, separatorIndex);
    return normalizeLinkumoriURLFilterHostnamePattern(hostname);
}

function getLinkumoriURLFilterIndexTokenCandidates(rule) {
    const tokens = [];

    if (rule && rule.literalParam !== null) {
        tokens.push('pc:' + String(rule.literalParam));
    }

    if (
        rule &&
        !rule.negate &&
        rule.regexParam &&
        globalThis.LinkumoriRegexTokens &&
        typeof globalThis.LinkumoriRegexTokens.extractBestTokenFromRegex === 'function'
    ) {
        const regexToken = globalThis.LinkumoriRegexTokens.extractBestTokenFromRegex(rule.regexParam.source);
        if (regexToken) tokens.push('t:' + regexToken);
    }

    const patternHost = getLinkumoriURLPatternHostnameToken(rule);
    if (patternHost) {
        tokens.push('h:' + patternHost);
    }

    [
        rule && rule.includeTargetDomains,
        rule && rule.includeDomains
    ].forEach(domainList => {
        if (!Array.isArray(domainList)) return;
        domainList.forEach(pattern => {
            const hostname = normalizeLinkumoriURLFilterHostnamePattern(pattern);
            if (hostname) tokens.push('h:' + hostname);
        });
    });

    return Array.from(new Set(tokens));
}

function chooseLinkumoriURLFilterIndexToken(rule, tokenFrequency) {
    const tokens = getLinkumoriURLFilterIndexTokenCandidates(rule);
    if (tokens.length === 0) return '';

    return tokens.sort((left, right) => {
        const leftFrequency = tokenFrequency[left] || 0;
        const rightFrequency = tokenFrequency[right] || 0;
        if (leftFrequency !== rightFrequency) return leftFrequency - rightFrequency;
        return right.length - left.length;
    })[0];
}

function countLinkumoriURLFilterTokenFrequency(rule, tokenFrequency) {
    const tokens = getLinkumoriURLFilterIndexTokenCandidates(rule);
    for (let i = 0; i < tokens.length; i++) {
        const token = tokens[i];
        tokenFrequency[token] = (tokenFrequency[token] || 0) + 1;
    }
}

function compileLinkumoriURLFilterRules(rules, exceptions) {
    const compiled = {
        rules: createLinkumoriURLFilterBuckets(),
        exceptions: createLinkumoriURLFilterBuckets()
    };
    const tokenFrequency = Object.create(null);
    let ruleId = 0;

    rules.forEach(rule => {
        rule._linkumoriRuleId = ++ruleId;
        countLinkumoriURLFilterTokenFrequency(rule, tokenFrequency);
    });
    exceptions.forEach(rule => {
        rule._linkumoriRuleId = ++ruleId;
        countLinkumoriURLFilterTokenFrequency(rule, tokenFrequency);
    });

    for (let i = 0; i < rules.length; i++) {
        const rule = rules[i];
        const token = chooseLinkumoriURLFilterIndexToken(rule, tokenFrequency);
        addLinkumoriURLFilterRuleToBuckets(compiled.rules, rule, token);
    }
    for (let i = 0; i < exceptions.length; i++) {
        const rule = exceptions[i];
        const token = chooseLinkumoriURLFilterIndexToken(rule, tokenFrequency);
        addLinkumoriURLFilterRuleToBuckets(compiled.exceptions, rule, token);
    }

    return compiled;
}

function rebuildLinkumoriURLFilterRuntimeData() {
    const parser = globalThis.LinkumoriURLFilterInteroperability;
    const data = storage && storage.LinkumoriURLsData ? storage.LinkumoriURLsData : null;
    const rawRules = Array.isArray(data && data.rules) ? data.rules : [];
    const badfilterTargets = new Set();
    const retainedRulesByCanonical = new Map();
    const dataVersion = data && data.metadata && typeof data.metadata.version === 'string'
        ? data.metadata.version
        : null;

    if (
        data &&
        rawRules &&
        linkumoriURLFilterRuntime.lastDataRef === data &&
        linkumoriURLFilterRuntime.lastRulesRef === rawRules &&
        linkumoriURLFilterRuntime.lastDataVersion === dataVersion &&
        linkumoriURLFilterRuntime.lastRuleCount === rawRules.length &&
        linkumoriURLFilterRuntime.compiled
    ) {
        return true;
    }

    linkumoriURLFilterRuntime.rules = [];
    linkumoriURLFilterRuntime.exceptions = [];
    linkumoriURLFilterRuntime.compiled = compileLinkumoriURLFilterRules([], []);

    if (!parser || typeof parser.parseRemoveParamRule !== 'function') {
        return false;
    }

    rawRules.forEach(ruleText => {
        const parsedRule = parser.parseRemoveParamRule(ruleText);
        if (!parsedRule) return;
        if (typeof parser.prepareRule === 'function') {
            parser.prepareRule(parsedRule);
        }

        if (parsedRule.isBadfilter) {
            if (parsedRule.badfilterTarget) {
                badfilterTargets.add(parsedRule.badfilterTarget);
                retainedRulesByCanonical.delete(parsedRule.badfilterTarget);
            }
            return;
        }

        if (retainedRulesByCanonical.has(parsedRule.canonical)) {
            return;
        }
        retainedRulesByCanonical.set(parsedRule.canonical, parsedRule);
    });

    retainedRulesByCanonical.forEach(parsedRule => {
        if (badfilterTargets.has(parsedRule.raw) || badfilterTargets.has(parsedRule.canonical)) {
            return;
        }

        if (parsedRule.isException) {
            linkumoriURLFilterRuntime.exceptions.push(parsedRule);
        } else {
            linkumoriURLFilterRuntime.rules.push(parsedRule);
        }
    });

    linkumoriURLFilterRuntime.compiled = compileLinkumoriURLFilterRules(
        linkumoriURLFilterRuntime.rules,
        linkumoriURLFilterRuntime.exceptions
    );
    linkumoriURLFilterRuntime.lastDataRef = data;
    linkumoriURLFilterRuntime.lastRulesRef = rawRules;
    linkumoriURLFilterRuntime.lastDataVersion = dataVersion;
    linkumoriURLFilterRuntime.lastRuleCount = rawRules.length;

    return true;
}

function shouldRunLinkumoriURLFilterRuntime(requestDetails) {
    if (!storage || !storage.globalStatus) return false;
    if (!requestDetails || typeof requestDetails.url !== 'string') return false;
    if (!/^https?:\/\//i.test(requestDetails.url)) return false;
    if (linkumoriURLFilterRuntime.rules.length === 0 && linkumoriURLFilterRuntime.exceptions.length === 0) return false;

    if (typeof isTemporarilyPaused === 'function' && isTemporarilyPaused()) {
        return false;
    }

    if (isLinkumoriURLFilterWhitelisted(requestDetails)) {
        return false;
    }

    if (storage.types && storage.types.length > 0 && requestDetails.type) {
        return storage.types.indexOf(requestDetails.type) > -1;
    }

    return true;
}

function isLinkumoriURLFilterWhitelisted(requestDetails) {
    if (!requestDetails || typeof requestDetails.url !== 'string') return false;

    if (typeof isWhitelisted === 'function' && isWhitelisted(requestDetails.url, requestDetails)) {
        return true;
    }

    if (!storage || !Array.isArray(storage.userWhitelist) || storage.userWhitelist.length === 0) {
        return false;
    }

    const urls = [
        requestDetails.url,
        requestDetails.initiator,
        requestDetails.originUrl,
        requestDetails.documentUrl
    ].filter(url => typeof url === 'string' && /^https?:\/\//i.test(url));

    return urls.some(url => {
        const hostname = getLinkumoriURLFilterHostname(url);
        if (!hostname) return false;

        return storage.userWhitelist.some(pattern => {
            if (typeof matchWhitelistHostnamePattern === 'function') {
                return matchWhitelistHostnamePattern(hostname, pattern);
            }

            const cleanPattern = String(pattern || '')
                .toLowerCase()
                .replace(/^\|\|/, '')
                .replace(/^\*\./, '')
                .replace(/\^$/, '')
                .replace(/\.$/, '')
                .trim();
            return !!cleanPattern && (hostname === cleanPattern || hostname.endsWith('.' + cleanPattern));
        });
    });
}

function pushUniqueLinkumoriURLFilterRules(target, seen, source) {
    if (!Array.isArray(source)) return;
    for (let i = 0; i < source.length; i++) {
        const rule = source[i];
        const key = rule && rule._linkumoriRuleId ? rule._linkumoriRuleId : (rule && rule.raw ? rule.raw : rule);
        if (seen.has(key)) continue;
        seen.add(key);
        target.push(rule);
    }
}

function getLinkumoriURLFilterHostname(rawUrl) {
    const source = String(rawUrl || '');
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

    return String(source.slice(start, hostEnd) || '').toLowerCase().replace(/\.$/, '').trim();
}

function getLinkumoriURLFilterCandidates(buckets, name) {
    const rules = [];
    const seen = new Set();
    const exactName = String(name || '');
    const lowerName = exactName.toLowerCase();

    pushUniqueLinkumoriURLFilterRules(rules, seen, buckets.removeAll);
    pushUniqueLinkumoriURLFilterRules(rules, seen, buckets.negated);
    if (buckets.tokenTrie) {
        pushUniqueLinkumoriURLFilterRules(rules, seen, buckets.tokenTrie.get(lowerName));
    } else {
        pushUniqueLinkumoriURLFilterRules(rules, seen, buckets.literalCaseSensitive[exactName]);
        pushUniqueLinkumoriURLFilterRules(rules, seen, buckets.literalCaseInsensitive[lowerName]);
    }
    pushUniqueLinkumoriURLFilterRules(rules, seen, buckets.literalCaseSensitive[exactName]);
    pushUniqueLinkumoriURLFilterRules(rules, seen, buckets.regex);

    return rules;
}

function addLinkumoriURLFilterHostnameTokens(tokens, hostname) {
    const normalized = String(hostname || '').toLowerCase().replace(/\.$/, '').trim();
    if (!normalized) return;

    const labels = normalized.split('.').filter(Boolean);
    for (let i = 0; i < labels.length - 1; i++) {
        tokens.add('h:' + labels.slice(i).join('.'));
    }
}

function addLinkumoriURLFilterURLTokens(tokens, rawUrl) {
    if (typeof rawUrl !== 'string' || !/^https?:\/\//i.test(rawUrl)) return;
    const hostname = getLinkumoriURLFilterHostname(rawUrl);
    addLinkumoriURLFilterHostnameTokens(tokens, hostname);
}

function addLinkumoriURLFilterParamTokens(tokens, entries) {
    if (!Array.isArray(entries)) return;
    entries.forEach(entry => {
        const name = String(entry && (entry.rawName || entry.name) ? (entry.rawName || entry.name) : '');
        if (!name) return;
        tokens.add('p:' + name.toLowerCase());
        tokens.add('pc:' + name);
        if (
            globalThis.LinkumoriRegexTokens &&
            typeof globalThis.LinkumoriRegexTokens.collectTokensFromText === 'function'
        ) {
            const pairText = name + '=' + String(entry && entry.value ? entry.value : '');
            globalThis.LinkumoriRegexTokens.collectTokensFromText(pairText).forEach(token => {
                tokens.add('t:' + token);
            });
        }
    });
}

function collectLinkumoriURLFilterRequestTokens(requestDetails, queryEntries, fragmentEntries) {
    const tokens = new Set();

    [
        requestDetails && requestDetails.url,
        requestDetails && requestDetails.initiator,
        requestDetails && requestDetails.originUrl,
        requestDetails && requestDetails.documentUrl
    ].forEach(url => addLinkumoriURLFilterURLTokens(tokens, url));

    addLinkumoriURLFilterParamTokens(tokens, queryEntries);
    addLinkumoriURLFilterParamTokens(tokens, fragmentEntries);

    return tokens;
}

function getLinkumoriURLFilterRequestCandidates(buckets, requestTokens) {
    const candidates = [];
    const seen = new Set();

    pushUniqueLinkumoriURLFilterRules(candidates, seen, buckets.fallback);
    requestTokens.forEach(token => {
        pushUniqueLinkumoriURLFilterRules(candidates, seen, buckets.reverseIndex[token]);
    });

    return candidates;
}

function splitLinkumoriURLFilterURL(rawUrl) {
    const url = String(rawUrl || '');
    const hashIndex = url.indexOf('#');
    const beforeHash = hashIndex === -1 ? url : url.slice(0, hashIndex);
    const hash = hashIndex === -1 ? '' : url.slice(hashIndex);
    const queryIndex = beforeHash.indexOf('?');

    if (queryIndex === -1) {
        return {
            base: beforeHash,
            query: '',
            hasQuery: false,
            hash
        };
    }

    return {
        base: beforeHash.slice(0, queryIndex),
        query: beforeHash.slice(queryIndex + 1),
        hasQuery: true,
        hash
    };
}

function parseLinkumoriURLFilterQuery(query) {
    if (!query) return [];

    return String(query).split('&').map((segment, index) => {
        const separatorIndex = segment.indexOf('=');
        const rawName = separatorIndex === -1 ? segment : segment.slice(0, separatorIndex);
        const rawValue = separatorIndex === -1 ? '' : segment.slice(separatorIndex + 1);

        return {
            index,
            raw: segment,
            rawName,
            rawValue,
            name: rawName,
            value: rawValue
        };
    });
}

function buildLinkumoriURLFilterURL(parts, queryEntries) {
    const query = queryEntries.map(entry => entry.raw).join('&');
    return parts.base + (query ? '?' + query : '') + parts.hash;
}

function getLinkumoriURLFilterTargetMatcher(requestDetails) {
    const parser = globalThis.LinkumoriURLFilterInteroperability;
    const cache = new Map();
    const requestContext = parser && typeof parser.createRequestMatchContext === 'function'
        ? parser.createRequestMatchContext(requestDetails.url, requestDetails)
        : null;
    const hostname = requestContext && requestContext.targetHost
        ? requestContext.targetHost
        : getLinkumoriURLFilterHostname(requestDetails.url);

    return rule => {
        const key = rule && rule.raw ? rule.raw : String(rule);
        if (cache.has(key)) {
            return cache.get(key);
        }

        if (hostname && rule.includeTargetDomains && rule.includeTargetDomains.length > 0) {
            const includeTrie = rule.isException
                ? linkumoriURLFilterRuntime.compiled.exceptions.includeDomainTrie
                : linkumoriURLFilterRuntime.compiled.rules.includeDomainTrie;
            if (includeTrie) {
                const includeMatches = includeTrie.matches(hostname);
                if (!includeMatches.includes(rule)) {
                    cache.set(key, false);
                    return false;
                }
            }
        }

        if (hostname && rule.excludeTargetDomains && rule.excludeTargetDomains.length > 0) {
            const excludeTrie = rule.isException
                ? linkumoriURLFilterRuntime.compiled.exceptions.excludeDomainTrie
                : linkumoriURLFilterRuntime.compiled.rules.excludeDomainTrie;
            if (excludeTrie) {
                const excludeMatches = excludeTrie.matches(hostname);
                if (excludeMatches.includes(rule)) {
                    cache.set(key, false);
                    return false;
                }
            }
        }

        if (hostname && rule.denyallowDomains && rule.denyallowDomains.length > 0) {
            const denyallowTrie = rule.isException
                ? linkumoriURLFilterRuntime.compiled.exceptions.denyallowDomainTrie
                : linkumoriURLFilterRuntime.compiled.rules.denyallowDomainTrie;
            if (denyallowTrie) {
                const denyallowMatches = denyallowTrie.matches(hostname);
                if (denyallowMatches.includes(rule)) {
                    cache.set(key, false);
                    return false;
                }
            }
        }

        const matched = requestContext && typeof parser.matchesTargetWithContext === 'function'
            ? !!parser.matchesTargetWithContext(rule, requestContext)
            : !!parser.matchesTarget(rule, requestDetails.url, requestDetails);
        cache.set(key, matched);
        return matched;
    };
}

function createLinkumoriURLFilterCandidatePlan(ruleCandidates, exceptionCandidates, matchesTarget) {
    const plan = {
        importantRules: [],
        normalRules: [],
        normalExceptions: []
    };

    ruleCandidates.forEach(rule => {
        if (!matchesTarget(rule)) return;
        if (rule.important) {
            plan.importantRules.push(rule);
        } else {
            plan.normalRules.push(rule);
        }
    });

    exceptionCandidates.forEach(rule => {
        if (rule.important) return;
        if (!matchesTarget(rule)) return;
        plan.normalExceptions.push(rule);
    });

    return plan;
}

function findLinkumoriURLFilterDecision(name, value, rawName, rawValue, candidatePlan) {
    const parser = globalThis.LinkumoriURLFilterInteroperability;
    if (!parser || typeof parser.matchesParameter !== 'function') {
        return { remove: false, rule: null, exception: null };
    }

    const importantRule = findLinkumoriURLFilterMatchedRule(
        candidatePlan.importantRules,
        name,
        value,
        rawName,
        rawValue,
        parser
    );
    if (importantRule) {
        return { remove: true, rule: importantRule, exception: null };
    }

    const exception = findLinkumoriURLFilterMatchedRule(
        candidatePlan.normalExceptions,
        name,
        value,
        rawName,
        rawValue,
        parser
    );
    if (exception) {
        return { remove: false, rule: null, exception };
    }

    const rule = findLinkumoriURLFilterMatchedRule(
        candidatePlan.normalRules,
        name,
        value,
        rawName,
        rawValue,
        parser
    );
    return {
        remove: !!rule,
        rule: rule || null,
        exception: null
    };
}

function findLinkumoriURLFilterMatchedRule(candidates, name, value, rawName, rawValue, parser) {
    const directRule = candidates.find(rule => {
        return !rule.negate && parser.matchesParameter(rule, name, value, rawName, rawValue);
    });
    if (directRule) return directRule;

    const negatedRules = candidates.filter(rule => rule.negate);
    if (negatedRules.length === 0) return null;

    return negatedRules.every(rule => parser.matchesParameter(rule, name, value, rawName, rawValue))
        ? negatedRules[0]
        : null;
}

function cleanLinkumoriURLFilterQueryEntries(entries, candidatePlan) {
    const indexesToDelete = new Set();
    let matchedRule = null;

    entries.forEach(entry => {
        const decision = findLinkumoriURLFilterDecision(
            entry.name,
            entry.value,
            entry.rawName,
            entry.rawValue,
            candidatePlan
        );
        if (decision.remove) {
            indexesToDelete.add(entry.index);
            if (!matchedRule && decision.rule) {
                matchedRule = decision.rule.raw || '$removeparam';
            }
        }
    });

    return {
        entries: entries.filter(entry => !indexesToDelete.has(entry.index)),
        changed: indexesToDelete.size > 0,
        matchedRule
    };
}

function cleanLinkumoriURLFilterURL(requestDetails) {
    const parser = globalThis.LinkumoriURLFilterInteroperability;
    if (!parser || typeof parser.matchesTarget !== 'function') {
        return { changed: false, url: requestDetails.url, matchedRule: null };
    }

    if (typeof requestDetails.url !== 'string' || requestDetails.url.indexOf('?') === -1) {
        return { changed: false, url: requestDetails.url, matchedRule: null };
    }

    const compiled = linkumoriURLFilterRuntime.compiled;
    if (!compiled || (compiled.rules.all.length === 0 && compiled.exceptions.all.length === 0)) {
        return { changed: false, url: requestDetails.url, matchedRule: null };
    }

    const matchesTarget = getLinkumoriURLFilterTargetMatcher(requestDetails);
    const parts = splitLinkumoriURLFilterURL(requestDetails.url);
    const queryEntries = parseLinkumoriURLFilterQuery(parts.query);
    const fragmentEntries = [];
    const requestTokens = collectLinkumoriURLFilterRequestTokens(requestDetails, queryEntries, fragmentEntries);
    const ruleCandidates = getLinkumoriURLFilterRequestCandidates(compiled.rules, requestTokens);
    const exceptionCandidates = getLinkumoriURLFilterRequestCandidates(compiled.exceptions, requestTokens);
    const candidatePlan = createLinkumoriURLFilterCandidatePlan(
        ruleCandidates,
        exceptionCandidates,
        matchesTarget
    );
    if (
        candidatePlan.importantRules.length === 0 &&
        candidatePlan.normalRules.length === 0 &&
        candidatePlan.normalExceptions.length === 0
    ) {
        return {
            changed: false,
            url: requestDetails.url,
            matchedRule: null
        };
    }

    const queryResult = cleanLinkumoriURLFilterQueryEntries(
        queryEntries,
        candidatePlan
    );
    if (!queryResult.changed) {
        return {
            changed: false,
            url: requestDetails.url,
            matchedRule: null
        };
    }

    let nextHash = parts.hash;

    const nextUrl = buildLinkumoriURLFilterURL(
        { base: parts.base, hash: nextHash },
        queryResult.entries
    );
    return {
        changed: true,
        url: nextUrl,
        matchedRule: queryResult.matchedRule
    };
}

function handleLinkumoriURLFilterRequest(requestDetails) {
    if (!shouldRunLinkumoriURLFilterRuntime(requestDetails)) {
        return {};
    }

    const result = cleanLinkumoriURLFilterURL(requestDetails);
    if (!result.changed || result.url === requestDetails.url) {
        return {};
    }

    if (storage.loggingStatus && typeof pushToLog === 'function') {
        pushToLog(requestDetails.url, result.url, result.matchedRule || '$removeparam', {
            providerName: linkumoriURLFilterRuntimeI18n('linkumori_url_filter_name'),
            patternType: 'LinkumoriURLsData',
            patternValue: linkumoriURLFilterRuntimeI18n('linkumori_url_filter_log_pattern_value'),
            logCategory: 'provider',
            requestMethod: requestDetails && typeof requestDetails.method === 'string' ? requestDetails.method : null,
            requestType: requestDetails && typeof requestDetails.type === 'string' ? requestDetails.type : null
        });
    }

    if (typeof increaseBadged === 'function') {
        increaseBadged(false, requestDetails);
    }

    return { redirectUrl: result.url };
}

function startLinkumoriURLFilterRuntime() {
    rebuildLinkumoriURLFilterRuntimeData();

    if (linkumoriURLFilterRuntime.started) {
        return true;
    }

    linkumoriURLFilterRuntime.started = true;
    return true;
}

globalThis.startLinkumoriURLFilterRuntime = startLinkumoriURLFilterRuntime;
globalThis.updateLinkumoriURLFilterRuntimeData = rebuildLinkumoriURLFilterRuntimeData;
globalThis.handleLinkumoriURLFilterRequest = handleLinkumoriURLFilterRequest;
