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
 * Separate runtime for LinkumoriURLsData. This intentionally does not modify
 * ClearURLs providers or clearurls.js. It only applies popular extension
 * $removeparam/$queryprune URL tracking filters stored in LinkumoriURLsData.
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
    compiled: null
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

function compileLinkumoriURLFilterRules(rules, exceptions) {
    const compiled = {
        rules: createLinkumoriURLFilterBuckets(),
        exceptions: createLinkumoriURLFilterBuckets()
    };
    const tokenFrequency = Object.create(null);
    let ruleId = 0;

    rules.concat(exceptions).forEach(rule => {
        rule._linkumoriRuleId = ++ruleId;
        rule._linkumoriIndexTokenCandidates = getLinkumoriURLFilterIndexTokenCandidates(rule);
        rule._linkumoriIndexTokenCandidates.forEach(token => {
            tokenFrequency[token] = (tokenFrequency[token] || 0) + 1;
        });
    });

    rules.forEach(rule => {
        const token = chooseLinkumoriURLFilterIndexToken(rule, tokenFrequency);
        rule._linkumoriIndexToken = token || '';
        addLinkumoriURLFilterRuleToBuckets(compiled.rules, rule, token);
    });
    exceptions.forEach(rule => {
        const token = chooseLinkumoriURLFilterIndexToken(rule, tokenFrequency);
        rule._linkumoriIndexToken = token || '';
        addLinkumoriURLFilterRuleToBuckets(compiled.exceptions, rule, token);
    });

    return compiled;
}

function rebuildLinkumoriURLFilterRuntimeData() {
    const parser = globalThis.LinkumoriURLFilterInteroperability;
    const data = storage && storage.LinkumoriURLsData ? storage.LinkumoriURLsData : null;
    const rawRules = Array.isArray(data && data.rules) ? data.rules : [];
    const parsedRules = [];
    const badfilterTargets = new Set();
    const seenCanonicalRules = new Set();

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
            }
            return;
        }

        if (seenCanonicalRules.has(parsedRule.canonical)) {
            return;
        }
        seenCanonicalRules.add(parsedRule.canonical);

        parsedRules.push(parsedRule);
    });

    parsedRules.forEach(parsedRule => {
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
    source.forEach(rule => {
        const key = rule && rule._linkumoriRuleId ? rule._linkumoriRuleId : (rule && rule.raw ? rule.raw : rule);
        if (seen.has(key)) return;
        seen.add(key);
        target.push(rule);
    });
}

function getLinkumoriURLFilterHostname(rawUrl) {
    try {
        return new URL(rawUrl).hostname.toLowerCase();
    } catch (e) {
        return '';
    }
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
        const name = String(entry && entry.name ? entry.name : '');
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

function safeDecodeLinkumoriURLFilterComponent(value) {
    try {
        return decodeURIComponent(String(value || '').replace(/\+/g, '%20'));
    } catch (e) {
        return String(value || '');
    }
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
            name: safeDecodeLinkumoriURLFilterComponent(rawName),
            value: safeDecodeLinkumoriURLFilterComponent(rawValue)
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
    const hostname = getLinkumoriURLFilterHostname(requestDetails.url);
    const requestContext = parser && typeof parser.createRequestMatchContext === 'function'
        ? parser.createRequestMatchContext(requestDetails.url, requestDetails)
        : null;

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

function findLinkumoriURLFilterDecision(name, value, candidatePlan) {
    const parser = globalThis.LinkumoriURLFilterInteroperability;
    if (!parser || typeof parser.matchesParameter !== 'function') {
        return { remove: false, rule: null, exception: null };
    }

    const importantRule = findLinkumoriURLFilterMatchedRule(
        candidatePlan.importantRules,
        name,
        value,
        parser
    );
    if (importantRule) {
        return { remove: true, rule: importantRule, exception: null };
    }

    const exception = findLinkumoriURLFilterMatchedRule(
        candidatePlan.normalExceptions,
        name,
        value,
        parser
    );
    if (exception) {
        return { remove: false, rule: null, exception };
    }

    const rule = findLinkumoriURLFilterMatchedRule(
        candidatePlan.normalRules,
        name,
        value,
        parser
    );
    return {
        remove: !!rule,
        rule: rule || null,
        exception: null
    };
}

function findLinkumoriURLFilterMatchedRule(candidates, name, value, parser) {
    const directRule = candidates.find(rule => {
        return !rule.negate && parser.matchesParameter(rule, name, value);
    });
    if (directRule) return directRule;

    const negatedRules = candidates.filter(rule => rule.negate);
    if (negatedRules.length === 0) return null;

    return negatedRules.every(rule => parser.matchesParameter(rule, name, value))
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

    try {
        new URL(requestDetails.url);
    } catch (e) {
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
    const queryResult = cleanLinkumoriURLFilterQueryEntries(
        queryEntries,
        candidatePlan
    );

    let nextHash = parts.hash;

    const nextUrl = buildLinkumoriURLFilterURL(
        { base: parts.base, hash: nextHash },
        queryResult.entries
    );
    const changed = queryResult.changed;
    return {
        changed,
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

    if (!browser || !browser.webRequest || !browser.webRequest.onBeforeRequest) {
        return false;
    }

    browser.webRequest.onBeforeRequest.addListener(
        handleLinkumoriURLFilterRequest,
        { urls: ['<all_urls>'], types: getData('types').concat(getData('pingRequestTypes')) },
        ['blocking']
    );

    linkumoriURLFilterRuntime.started = true;
    return true;
}

globalThis.startLinkumoriURLFilterRuntime = startLinkumoriURLFilterRuntime;
globalThis.updateLinkumoriURLFilterRuntimeData = rebuildLinkumoriURLFilterRuntimeData;
