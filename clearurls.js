/*
 * ============================================================
 * ClearURLs
 * ============================================================
 * Copyright (c) 2017–2021 Kevin Röbert
 * Modified by Subham Mahesh (c) 2025–2026 (modified parts only)
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
 * Repository: https://github.com/linkumori/linkumori
 *
 * MODIFICATIONS
 * -------------
 * - PERFORMANCE:   Optimized provider initialization and rule matching
 * - INTEGRATION:   Enhanced integration with storage.js rule management
 * - WHITELIST:     Comprehensive whitelist support with wildcard patterns
 * - RELIABILITY:   Improved error handling and initialization retry logic
 * - CLEANUP:       Removed unnecessary permission requests and dependencies
 * - EFFICIENCY:    Streamlined rule application and URL reconstruction
 * - COMPATIBILITY: Enhanced browser compatibility and method checking
 * - SIMPLICITY:    Simple domain pattern matching without complex TLD
 *                  handling
 *
 * ============================================================
 * MODIFICATION HISTORY
 * ============================================================
 * 2025-06-14   Subham Mahesh   First modification
 * 2025-08-21   Subham Mahesh   Second modification
 * 2025-09-05   Subham Mahesh   Third modification
 * 2026-01-25   Subham Mahesh   Fourth modification
 * 2026-02-22   Subham Mahesh   Fifth modification
 * 2026-05-09   Subham Mahesh   Sixth modification(we taken some of patches from clearurls and adapt from ithttps://gitlab.com/ClearURLs/ClearUrls/-/blob/refactoring/clearurls.js?ref_type=heads)
 * 2026-05-11 subham mahesh seventh modification
 Note: Due to inline constraints, subsequent modifications may
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

var providers = [];
// Linkumori optimized indexes
var providersByToken = Object.create(null); // Exact hostname-label lookup table for provider candidates
var globalProviders = []; // Provider[]
var clearurlsProviderSnapshot = createEmptyProviderSnapshot();
var prvKeys = [];
var siteBlockedAlert = 'javascript:void(0)';
var dataHash;
var localDataHash;
var os;
var initializationComplete = false;
var linkumoriPatternRegexCache = new Map();
var clearurlsWebRequestHandler = null;
var pslSupport = {
    status: 'idle',
    parser: null,
    service: null,
    loadPromise: null,
    error: null
};

function createEmptyProviderSnapshot() {
    return {
        aliasRuleIds: {},
        disabledRuleIds: [],
        disabledRules: {},
        globalProviders: [],
        providerCount: 0,
        providers: [],
        providersByToken: {},
        ruleIds: {}
    };
}

function normalizeClearURLsDisabledRuleIds(value) {
    if (!value) return [];
    if (typeof value === 'string') {
        try {
            return normalizeClearURLsDisabledRuleIds(JSON.parse(value));
        } catch (_) {
            return value.split(/\r?\n/).map(item => item.trim()).filter(Boolean);
        }
    }
    if (Array.isArray(value)) {
        return [...new Set(value.map(item => String(item || '').trim()).filter(Boolean))];
    }
    return [];
}

function getClearURLsDisabledRuleIdSet() {
    return new Set(normalizeClearURLsDisabledRuleIds(storage.clearurls_disabled_rule_ids));
}

function createStableRuleHash(value) {
    let hash = 2166136261;
    const text = String(value || '');
    for (let i = 0; i < text.length; i++) {
        hash ^= text.charCodeAt(i);
        hash = Math.imul(hash, 16777619);
    }
    return (hash >>> 0).toString(36);
}

function slugifyCoreRuleIdPart(value) {
    return String(value || '')
        .toLowerCase()
        .replace(/[^a-z0-9]+/g, '-')
        .replace(/^-+|-+$/g, '')
        .replace(/-+/g, '-');
}

function createGeneratedCoreRuleId(section, matchPattern) {
    const prefix = section === 'rawRules'
        ? 'raw'
        : (section === 'redirections' ? 'redirect' : (section === 'referralMarketing' ? 'referral' : (section === 'exceptions' ? 'exception' : 'field')));
    const slug = slugifyCoreRuleIdPart(matchPattern).slice(0, 32);
    return `${prefix}-${slug || createStableRuleHash(matchPattern)}`;
}

function buildCoreRuntimeRuleId(providerName, ruleId) {
    return `${providerName}::${ruleId}`;
}

function normalizeCoreRuleActivationIds(value) {
    if (!Array.isArray(value)) return [];
    const activationIds = [];
    const seen = new Set();
    value.forEach(id => {
        const activationId = String(id || "").trim();
        if (!activationId || seen.has(activationId)) return;
        seen.add(activationId);
        activationIds.push(activationId);
    });
    return activationIds;
}

function attachCoreRuleIdentity(providerName, compiledRule, section) {
    const ruleId = compiledRule.id || createGeneratedCoreRuleId(section, compiledRule.matchPattern);
    const aliases = Array.isArray(compiledRule.aliases) ? compiledRule.aliases : [];
    const activationIds = normalizeCoreRuleActivationIds(compiledRule._linkumoriActivationIds);
    compiledRule.id = ruleId;
    compiledRule.providerName = providerName;
    compiledRule.runtimeRuleId = buildCoreRuntimeRuleId(providerName, ruleId);
    compiledRule.aliasRuntimeIds = aliases.map(alias => buildCoreRuntimeRuleId(providerName, alias));
    compiledRule.activationIds = activationIds.length > 0
        ? activationIds
        : [compiledRule.runtimeRuleId];
    return compiledRule;
}

function coreRuleDisableKeys(compiledRule) {
    const keys = [];
    if (!compiledRule) return keys;
    if (compiledRule.runtimeRuleId) keys.push(compiledRule.runtimeRuleId);
    if (compiledRule.id) keys.push(compiledRule.id);
    (compiledRule.aliasRuntimeIds || []).forEach((aliasRuntimeId, index) => {
        if (aliasRuntimeId) keys.push(aliasRuntimeId);
        const alias = compiledRule.aliases && compiledRule.aliases[index];
        if (alias) keys.push(alias);
    });
    return keys;
}

function filterCoreRuleActivationIds(compiledRule, disabledRuleIds) {
    if (!compiledRule || !disabledRuleIds || disabledRuleIds.size === 0) return false;
    if (coreRuleDisableKeys(compiledRule).some(key => disabledRuleIds.has(key))) {
        compiledRule.disabledActivationIds = (compiledRule.activationIds || []).slice();
        compiledRule.activationIds = [];
        return true;
    }

    const activationIds = Array.isArray(compiledRule.activationIds) ? compiledRule.activationIds : [];
    if (activationIds.length === 0) return false;
    const activeActivationIds = [];
    const disabledActivationIds = [];
    activationIds.forEach(activationId => {
        const localRuleId = String(activationId).split("::").pop();
        const disabled = disabledRuleIds.has(activationId) || disabledRuleIds.has(localRuleId);
        if (disabled) disabledActivationIds.push(activationId);
        else activeActivationIds.push(activationId);
    });
    compiledRule.disabledActivationIds = disabledActivationIds;
    compiledRule.activationIds = activeActivationIds;
    return activeActivationIds.length === 0;
}

function registerCoreRuleInSnapshot(compiledRule) {
    if (!compiledRule || !clearurlsProviderSnapshot) return;
    if (compiledRule.runtimeRuleId && !clearurlsProviderSnapshot.ruleIds[compiledRule.runtimeRuleId]) {
        clearurlsProviderSnapshot.ruleIds[compiledRule.runtimeRuleId] = {
            actionType: compiledRule.actionType,
            aliases: (compiledRule.aliases || []).slice(),
            aliasRuntimeIds: (compiledRule.aliasRuntimeIds || []).slice(),
            id: compiledRule.id,
            kind: compiledRule.kind,
            match: compiledRule.matchPattern,
            activationIds: (compiledRule.activationIds || []).slice(),
            providerName: compiledRule.providerName,
            runtimeRuleId: compiledRule.runtimeRuleId,
            section: compiledRule.section
        };
    }
    (compiledRule.aliasRuntimeIds || []).forEach((aliasRuntimeId) => {
        if (!clearurlsProviderSnapshot.aliasRuleIds[aliasRuntimeId]) {
            clearurlsProviderSnapshot.aliasRuleIds[aliasRuntimeId] = compiledRule.runtimeRuleId;
        }
    });
}

function registerDisabledCoreRuleInSnapshot(compiledRule) {
    if (!compiledRule || !clearurlsProviderSnapshot || !compiledRule.runtimeRuleId) return;
    clearurlsProviderSnapshot.disabledRules[compiledRule.runtimeRuleId] = {
        actionType: compiledRule.actionType,
        aliases: (compiledRule.aliases || []).slice(),
        aliasRuntimeIds: (compiledRule.aliasRuntimeIds || []).slice(),
        id: compiledRule.id,
        kind: compiledRule.kind,
        match: compiledRule.matchPattern,
        activationIds: (compiledRule.activationIds || []).slice(),
        disabledActivationIds: (compiledRule.disabledActivationIds || []).slice(),
        providerName: compiledRule.providerName,
        runtimeRuleId: compiledRule.runtimeRuleId,
        section: compiledRule.section
    };
}

function normalizeAsciiHostname(value) {
    const host = String(value || '').trim().toLowerCase();
    if (!host) return null;

    if (/^[\x00-\x7F]+$/.test(host)) {
        return host.endsWith('.') ? host.slice(0, -1) : host;
    }

    try {
        return new URL('http://' + host).hostname.toLowerCase();
    } catch (e) {
        return host.endsWith('.') ? host.slice(0, -1) : host;
    }
}

function initPslSupport() {
    if (pslSupport.status === 'loading' || pslSupport.status === 'ready') {
        return pslSupport.loadPromise;
    }

    pslSupport.status = 'loading';
    pslSupport.loadPromise = (async () => {
        try {
            const runtimeAPI = browser.runtime;

            if (!runtimeAPI || typeof fetch !== 'function') {
                throw new Error('PSL module/runtime API unavailable');
            }

            const pslService = (typeof globalThis !== 'undefined' && globalThis.linkumoriPsl)
                ? globalThis.linkumoriPsl
                : null;

            if (
                !pslService ||
                typeof pslService.init !== 'function'
            ) {
                throw new Error('linkumoriPsl service missing in external_js/publicsuffixlist.js');
            }

            await pslService.init({
                dataPath: 'data/public_suffix_list.dat',
                runtimeAPI
            });

            if (
                pslService.status !== 'ready' ||
                !pslService.parser ||
                typeof pslService.parser.getPublicSuffix !== 'function' ||
                typeof pslService.parser.getDomain !== 'function'
            ) {
                throw new Error('PSL service initialized without usable parser');
            }

            pslSupport.parser = pslService.parser;
            pslSupport.service = pslService;
            pslSupport.status = 'ready';
            pslSupport.error = null;
        } catch (e) {
            pslSupport.status = 'failed';
            pslSupport.error = e;
            pslSupport.parser = null;
            pslSupport.service = null;
        }
    })();

    return pslSupport.loadPromise;
}

function parseHostnameWithPsl(hostnameInput) {
    const normalizedHostname = normalizeAsciiHostname(hostnameInput);
    if (!normalizedHostname) return null;

    if (
        pslSupport.status === 'ready' &&
        pslSupport.service &&
        typeof pslSupport.service.parseNormalizedHostname === 'function'
    ) {
        const parsed = pslSupport.service.parseNormalizedHostname(
            normalizedHostname
        );

        if (parsed && parsed.listed && parsed.tld) {
            return {
                hostname: parsed.hostname || normalizedHostname,
                tld: parsed.tld || null,
                domain: parsed.domain || null,
                subdomain: parsed.subdomain || null,
                listed: true
            };
        }
    }

    if (
        pslSupport.status === 'ready' &&
        pslSupport.service &&
        typeof pslSupport.service.lookupNormalized === 'function'
    ) {
        const lookup = pslSupport.service.lookupNormalized(normalizedHostname);
        if (lookup) return lookup;
    }

    if (
        pslSupport.status !== 'ready' ||
        !pslSupport.parser ||
        typeof pslSupport.parser.getPublicSuffix !== 'function' ||
        typeof pslSupport.parser.getDomain !== 'function'
    ) {
        return null;
    }

    const hostname = normalizedHostname;

    try {
        const tld = pslSupport.parser.getPublicSuffix(hostname) || null;
        if (!tld) return null;

        const domain = pslSupport.parser.getDomain(hostname) || null;
        let subdomain = null;
        if (domain && hostname !== domain && hostname.endsWith('.' + domain)) {
            const suffixToken = '.' + domain;
            subdomain = hostname.slice(0, -suffixToken.length) || null;
        }

        return {
            hostname,
            tld,
            domain,
            subdomain,
            listed: true
        };
    } catch (e) {
        return null;
    }
}

function matchRootDomainWildcardTldWithPsl(hostnameValue, pattern) {
    if (pslSupport.status !== 'ready') return false;

    const normalizedHost = normalizeAsciiHostname(hostnameValue);
    const normalizedPattern = normalizeAsciiHostname(pattern);
    if (!normalizedHost || !normalizedPattern || !normalizedPattern.endsWith('.*')) {
        return false;
    }

    const base = normalizedPattern.slice(0, -2);
    if (!base) return false;

    const parsed = parseHostnameWithPsl(normalizedHost);
    if (!parsed || !parsed.tld) return false;

    const suffixToken = '.' + parsed.tld;
    if (!normalizedHost.endsWith(suffixToken)) return false;

    const prefix = normalizedHost.slice(0, -suffixToken.length);
    if (!prefix) return false;

    // Match bare domain OR any subdomain (m.example.com, sub.example.com …).
    // The old code only allowed www. as a subdomain variant.
    return prefix === base || prefix.endsWith('.' + base);
}

// Tracks tab/frame URLs so that subrequests from a whitelisted page context
// can be skipped even if the subrequest URL itself is not whitelisted.
var requestContextManager = {
    initialized: false,
    tabs: new Map(),

    ensureTab(tabId) {
        let tabCtx = this.tabs.get(tabId);
        if (!tabCtx) {
            tabCtx = { url: '', frames: new Map() };
            this.tabs.set(tabId, tabCtx);
        }
        return tabCtx;
    },

    setTabURL(tabId, url) {
        if (typeof tabId !== 'number' || tabId < 0) return;
        if (typeof url !== 'string' || url === '') return;
        const tabCtx = this.ensureTab(tabId);
        tabCtx.url = url;
        tabCtx.frames.set(0, { url, parentFrameId: -1 });
    },

    setFrameURL(tabId, frameId, url, parentFrameId = -1) {
        if (typeof tabId !== 'number' || tabId < 0) return;
        if (typeof frameId !== 'number' || frameId < 0) return;
        if (typeof url !== 'string' || url === '') return;
        const tabCtx = this.ensureTab(tabId);
        tabCtx.frames.set(frameId, { url, parentFrameId });
        if (frameId === 0) {
            tabCtx.url = url;
        }
    },

    collectContextURLs(requestDetails) {
        const urls = [];
        if (!requestDetails || typeof requestDetails !== 'object') {
            return urls;
        }

        if (typeof requestDetails.documentUrl === 'string') urls.push(requestDetails.documentUrl);
        if (typeof requestDetails.originUrl === 'string') urls.push(requestDetails.originUrl);
        if (typeof requestDetails.initiator === 'string') urls.push(requestDetails.initiator);
        if (typeof requestDetails.tabUrl === 'string') urls.push(requestDetails.tabUrl);
        if (typeof requestDetails.referrer === 'string') urls.push(requestDetails.referrer);

        const tabId = requestDetails.tabId;
        if (typeof tabId === 'number' && tabId >= 0) {
            const tabCtx = this.tabs.get(tabId);
            if (tabCtx) {
                if (typeof tabCtx.url === 'string' && tabCtx.url) {
                    urls.push(tabCtx.url);
                }

                const walkAncestors = (startFrameId) => {
                    if (typeof startFrameId !== 'number' || startFrameId < 0) return;
                    let frameId = startFrameId;
                    const visited = new Set();
                    for (let i = 0; i < 16; i++) {
                        if (visited.has(frameId)) break;
                        visited.add(frameId);
                        const entry = tabCtx.frames.get(frameId);
                        if (!entry) break;
                        if (typeof entry.url === 'string' && entry.url) {
                            urls.push(entry.url);
                        }
                        if (typeof entry.parentFrameId !== 'number' || entry.parentFrameId < 0) break;
                        frameId = entry.parentFrameId;
                    }
                };

                walkAncestors(requestDetails.frameId);
                walkAncestors(requestDetails.parentFrameId);
            }
        }

        return Array.from(new Set(urls));
    },

    init() {
        if (this.initialized) return;
        this.initialized = true;

        browser.tabs.query({}).then((tabs) => {
            if (!Array.isArray(tabs)) return;
            for (const tab of tabs) {
                if (typeof tab?.id === 'number' && typeof tab?.url === 'string') {
                    this.setTabURL(tab.id, tab.url);
                }
            }
        }).catch(handleError);

        browser.tabs.onUpdated.addListener((tabId, changeInfo, tab) => {
            const candidateUrl = (changeInfo && typeof changeInfo.url === 'string')
                ? changeInfo.url
                : (tab && typeof tab.url === 'string' ? tab.url : null);
            if (candidateUrl) {
                this.setTabURL(tabId, candidateUrl);
            }
        });

        browser.tabs.onRemoved.addListener((tabId) => {
            this.tabs.delete(tabId);
        });

        if (browser.webNavigation && browser.webNavigation.onCommitted) {
            browser.webNavigation.onCommitted.addListener((details) => {
                this.setFrameURL(details.tabId, details.frameId, details.url, details.parentFrameId);
            });
        }
        if (browser.webNavigation && browser.webNavigation.onHistoryStateUpdated) {
            browser.webNavigation.onHistoryStateUpdated.addListener((details) => {
                this.setFrameURL(details.tabId, details.frameId, details.url, details.parentFrameId);
            });
        }
        if (browser.webNavigation && browser.webNavigation.onReferenceFragmentUpdated) {
            browser.webNavigation.onReferenceFragmentUpdated.addListener((details) => {
                this.setFrameURL(details.tabId, details.frameId, details.url, details.parentFrameId);
            });
        }
    }
};

"use strict";

class URLHashParams {
    constructor(url) {
        Object.defineProperty(this, "_params", {
            enumerable: true,
            configurable: true,
            writable: true,
            value: void 0
        });
        this._params = new Multimap();
        const hash = url.hash.slice(1);
        const params = hash.split('&');
        for (const p of params) {
            const param = p.split('=');
            if (!param[0])
                continue;
            const key = param[0];
            let value = null;
            if (param.length === 2 && param[1]) {
                value = param[1];
            }
            this._params.put(key, value);
        }
    }
    append(name, value = null) {
        this._params.put(name, value);
    }
    delete(name) {
        this._params.delete(name);
    }
    get(name) {
        const [first] = this._params.get(name);
        if (first) {
            return first;
        }
        return null;
    }
    getAll(name) {
        return this._params.get(name);
    }
    keys() {
        return this._params.keys();
    }
    toString() {
        const rtn = [];
        this._params.forEach((key, value) => {
            if (value) {
                rtn.push(key + '=' + value);
            }
            else {
                rtn.push(key);
            }
        });
        return rtn.join('&');
    }
}

class Multimap {
    constructor() {
        Object.defineProperty(this, "_map", {
            enumerable: true,
            configurable: true,
            writable: true,
            value: void 0
        });
        Object.defineProperty(this, "_size", {
            enumerable: true,
            configurable: true,
            writable: true,
            value: void 0
        });
        this._size = 0;
        this._map = new Map();
    }
    get size() {
        return this._size;
    }
    get(key) {
        const values = this._map.get(key);
        if (values) {
            return new Set(values);
        }
        else {
            return new Set();
        }
    }
    put(key, value) {
        let values = this._map.get(key);
        if (!values) {
            values = new Set();
        }
        const count = values.size;
        values.add(value);
        if (values.size === count) {
            return false;
        }
        this._map.set(key, values);
        this._size++;
        return true;
    }
    has(key) {
        return this._map.has(key);
    }
    hasEntry(key, value) {
        const values = this._map.get(key);
        if (!values) {
            return false;
        }
        return values.has(value);
    }
    delete(key) {
        const values = this._map.get(key);
        if (values && this._map.delete(key)) {
            this._size -= values.size;
            return true;
        }
        return false;
    }
    deleteEntry(key, value) {
        const values = this._map.get(key);
        if (values) {
            if (!values.delete(value)) {
                return false;
            }
            this._size--;
            return true;
        }
        return false;
    }
    clear() {
        this._map.clear();
        this._size = 0;
    }
    entries() {
        const self = this;
        function* gen() {
            for (const [key, values] of self._map.entries()) {
                for (const value of values) {
                    yield [key, value];
                }
            }
        }
        return gen();
    }
    values() {
        const self = this;
        function* gen() {
            for (const [, value] of self.entries()) {
                yield value;
            }
        }
        return gen();
    }
    keys() {
        return this._map.keys();
    }
    forEach(callback, thisArg) {
        for (const [key, value] of this.entries()) {
            callback.call(thisArg === undefined ? this : thisArg, key, value, this);
        }
    }
    [Symbol.iterator]() {
        return this.entries();
    }
}


function matchDomainPattern(url, patterns) {
    if (typeof patterns === 'string') {
        patterns = [patterns];
    }
    if (!Array.isArray(patterns) || patterns.length === 0) return false;

    function escapeRegexChar(char) {
        return /[\\^$.*+?()[\]{}|]/.test(char) ? ('\\' + char) : char;
    }

    function linkumoriTokensToRegexSource(input) {
        let output = '';
        for (let i = 0; i < input.length; i++) {
            const ch = input.charAt(i);
            if (ch === '*') {
                output += '.*';
            } else if (ch === '^') {
                output += '(?:[^0-9A-Za-z_\\-.%]|$)';
            } else {
                output += escapeRegexChar(ch);
            }
        }
        return output;
    }

    function compileLinkumoriRegex(pattern) {
        const cacheKey = String(pattern || '');
        if (linkumoriPatternRegexCache.has(cacheKey)) {
            return linkumoriPatternRegexCache.get(cacheKey);
        }

        let raw = cacheKey;
        let domainAnchor = false;
        let startAnchor = false;
        let endAnchor = false;

        if (raw.startsWith('||')) {
            domainAnchor = true;
            raw = raw.slice(2);
        } else if (raw.startsWith('|')) {
            startAnchor = true;
            raw = raw.slice(1);
        }

        if (raw.endsWith('|')) {
            endAnchor = true;
            raw = raw.slice(0, -1);
        }

        if (domainAnchor) {
            const hostBoundary = firstSpecialIndex(raw);
            const hostExpr = hostBoundary === -1 ? raw : raw.slice(0, hostBoundary);
            if (hostExpr.startsWith('*.')) {
                raw = raw.slice(2);
            }
        }

        const source = linkumoriTokensToRegexSource(raw);
        const prefix = domainAnchor
            ? '^[A-Za-z][A-Za-z0-9+.-]*:\\/+(?:[^/?#]*\\.)?'
            : (startAnchor ? '^' : '');
        const suffix = endAnchor ? '$' : '';
        // Without a trailing ^ or end-anchor, ||example.com would match
        // example.com.evil.com. Add a host-boundary lookahead in that case.
        // Patterns ending with ^ already compile (?:[^0-9A-Za-z_\-.%]|$).
        const domainBoundary = (domainAnchor && !raw.endsWith('^') && !endAnchor)
            ? '(?=[/?#]|$)' : '';

        let regex = null;
        try {
            regex = new RegExp(prefix + source + domainBoundary + suffix, 'i');
        } catch (e) {
            regex = null;
        }

        linkumoriPatternRegexCache.set(cacheKey, regex);
        return regex;
    }

    function compileTailRegex(tail) {
        let raw = String(tail || '');
        let startAnchor = false;
        let endAnchor = false;

        if (raw.startsWith('|')) {
            startAnchor = true;
            raw = raw.slice(1);
        }
        if (raw.endsWith('|')) {
            endAnchor = true;
            raw = raw.slice(0, -1);
        }

        const source = linkumoriTokensToRegexSource(raw);
        const prefix = startAnchor ? '^' : '';
        const suffix = endAnchor ? '$' : '';
        return new RegExp(prefix + source + suffix, 'i');
    }

    function firstSpecialIndex(input) {
        const slashIndex = input.indexOf('/');
        const caretIndex = input.indexOf('^');
        const pipeIndex = input.indexOf('|');

        let index = -1;
        if (slashIndex !== -1) index = slashIndex;
        if (caretIndex !== -1 && (index === -1 || caretIndex < index)) index = caretIndex;
        if (pipeIndex !== -1 && (index === -1 || pipeIndex < index)) index = pipeIndex;
        return index;
    }

    function isSimpleHostExpression(input) {
        return /^[a-z0-9*.-]+$/i.test(input);
    }

    function matchHostPattern(hostname, pattern) {
        if (pslSupport.status !== 'ready') return false;

        const normalizedHost = normalizeAsciiHostname(hostname);
        let normalizedPattern = normalizeAsciiHostname(pattern);
        if (!normalizedHost || !normalizedPattern) return false;

        const hostParsed = parseHostnameWithPsl(normalizedHost);
        if (!hostParsed || !hostParsed.tld) return false;

        if (normalizedPattern.startsWith('*.')) {
            normalizedPattern = normalizedPattern.slice(2);
        }
        if (!normalizedPattern) return false;

        const wildcardTld = normalizedPattern.endsWith('.*');
        const basePattern = wildcardTld ? normalizedPattern.slice(0, -2) : normalizedPattern;
        if (!basePattern) return false;

        if (wildcardTld) {
            return matchRootDomainWildcardTldWithPsl(normalizedHost, normalizedPattern);
        }

        const patternParsed = parseHostnameWithPsl(basePattern);
        if (!patternParsed || !patternParsed.tld) return false;

        return normalizedHost === basePattern || normalizedHost.endsWith('.' + basePattern);
    }

    function matchStructuredDomainAnchorPattern(pattern, urlObj, hostname) {
        const body = String(pattern || '').slice(2).trim();
        if (!body) return false;

        const specialIndex = firstSpecialIndex(body);
        const hostExpr = specialIndex === -1 ? body : body.slice(0, specialIndex);
        const tail = specialIndex === -1 ? '' : body.slice(specialIndex);

        if (!hostExpr || !isSimpleHostExpression(hostExpr)) {
            return null;
        }

        if (!matchHostPattern(hostname, hostExpr)) {
            // PSL not ready — return null so matchDomainPattern falls through to the
            // compiled regex path instead of hard-failing. Without this, ||domain
            // patterns never match anything during PSL initialisation or when PSL
            // has failed to load, which silently breaks all exception rules.
            if (pslSupport.status !== 'ready') return null;
            return false;
        }

        let rest = tail;
        if (rest.startsWith('^')) {
            // Host boundary is already enforced by URL parsing + host matcher.
            rest = rest.slice(1);
        }

        if (!rest) return true;

        const pathTarget = (urlObj.pathname + urlObj.search + urlObj.hash).toLowerCase();
        if (rest.startsWith('/') && !/[|*^]/.test(rest)) {
            return pathTarget.startsWith(rest.toLowerCase());
        }

        try {
            return compileTailRegex(rest.toLowerCase()).test(pathTarget);
        } catch (e) {
            return false;
        }
    }

    try {
        const urlObj = new URL(url);
        const hostname = normalizeAsciiHostname(urlObj.hostname);
        if (!hostname) return false;
        const fullUrl = url.toLowerCase();

        return patterns.some((pattern) => {
            const p = String(pattern || '').trim();
            if (!p) return false;

            // Regex literal: /pattern/ or /pattern/flags
            // Tested against the original-case full URL so the author controls
            // case sensitivity via the i flag. The closing slash is the last '/'
            // so flags like /pattern/i work correctly.
            if (p.charAt(0) === '/') {
                const closingSlash = p.lastIndexOf('/');
                if (closingSlash > 0) {
                    const body  = p.slice(1, closingSlash);
                    const flags = p.slice(closingSlash + 1);
                    try {
                        return new RegExp(body, flags).test(url);
                    } catch (e) {
                        return false;
                    }
                }
            }

            const pLower = p.toLowerCase();

            if (pLower.startsWith('||')) {
                const structured = matchStructuredDomainAnchorPattern(pLower, urlObj, hostname);
                if (structured !== null) {
                    return structured;
                }
            }

            const regex = compileLinkumoriRegex(pLower);
            if (regex) {
                return regex.test(fullUrl);
            }

            return fullUrl.includes(pLower);
        });
    } catch (e) {
        return false;
    }
}

function splitLinkumoriModifiers(modifiersText) {
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

            if (ch === '=' && next === '/') {
                current += '/';
                inRegex = true;
                escaped = false;
                i++;
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

function parseLinkumoriRemoveParamRule(ruleText) {
    const rawRule = String(ruleText || '').trim();
    if (!rawRule) return null;
    if (rawRule.startsWith('!') || rawRule.startsWith('[')) return null;

    let candidate = rawRule;
    let isException = false;
    if (candidate.startsWith('@@')) {
        isException = true;
        candidate = candidate.slice(2);
    }

    const modifierStart = candidate.indexOf('$');
    if (modifierStart === -1) return null;

    const patternPart = candidate.slice(0, modifierStart).trim();
    const modifiersPart = candidate.slice(modifierStart + 1).trim();
    if (!modifiersPart) return null;

    const modifiers = splitLinkumoriModifiers(modifiersPart);
    let removeParamToken = null;
    let domainToken = null;
    let methodToken = null;

    for (const token of modifiers) {
        const normalized = token.toLowerCase();
        if (normalized === 'removeparam' || normalized.startsWith('removeparam=')) {
            removeParamToken = token;
            continue;
        }
        if (normalized.startsWith('domain=')) {
            domainToken = token.slice(token.indexOf('=') + 1);
            continue;
        }
        if (normalized.startsWith('method=')) {
            methodToken = token.slice(token.indexOf('=') + 1);
            continue;
        }
    }

    if (!removeParamToken) return null;

    const parsed = {
        raw: rawRule,
        isException,
        urlPattern: patternPart || '*',
        removeAll: false,
        negate: false,
        literalParam: null,
        regexParam: null,
        includeDomains: [],
        excludeDomains: [],
        includeMethods: [],
        excludeMethods: []
    };

    const removeValue = removeParamToken.indexOf('=') === -1
        ? ''
        : removeParamToken.slice(removeParamToken.indexOf('=') + 1).trim();

    if (!removeValue) {
        parsed.removeAll = true;
    } else {
        let value = removeValue;
        if (value.startsWith('~')) {
            parsed.negate = true;
            value = value.slice(1).trim();
        }

        const regexMatch = value.match(/^\/(.+)\/([gimsuy]*)$/i);
        if (regexMatch) {
            try {
                parsed.regexParam = new RegExp(regexMatch[1], regexMatch[2] || 'i');
            } catch (e) {
                parsed.regexParam = null;
            }
        } else {
            parsed.literalParam = value.toLowerCase();
        }
    }

    if (domainToken) {
        domainToken.split('|').forEach((part) => {
            const value = String(part || '').trim();
            if (!value) return;

            if (value.startsWith('~')) {
                parsed.excludeDomains.push(value.slice(1).trim().toLowerCase());
            } else {
                parsed.includeDomains.push(value.toLowerCase());
            }
        });
    }

    if (methodToken) {
        methodToken.split('|').forEach((part) => {
            const value = String(part || '').trim().toUpperCase();
            if (!value) return;

            if (value.startsWith('~')) {
                parsed.excludeMethods.push(value.slice(1).trim());
            } else {
                parsed.includeMethods.push(value);
            }
        });
    }

    return parsed;
}

function matchLinkumoriRemoveParamTarget(linkumoriRule, fullUrl, request = null) {
    if (!linkumoriRule || !fullUrl) return false;

    if (linkumoriRule.urlPattern && linkumoriRule.urlPattern !== '*') {
        if (!matchDomainPattern(fullUrl, [linkumoriRule.urlPattern])) {
            // For @@ exception rules, also check the page context (documentUrl,
            // originUrl, initiator, stored tab URL). This lets
            // @@||gemini.google.com$removeparam=ei suppress ei removal on any
            // request — including xmlhttprequests to google.com, facebook.com,
            // map.google.com — that originates from a gemini.google.com page.
            if (linkumoriRule.isException && request) {
                const contextUrls = requestContextManager.collectContextURLs(request);
                if (!contextUrls.some(u => u && matchDomainPattern(u, [linkumoriRule.urlPattern]))) {
                    return false;
                }
            } else {
                return false;
            }
        }
    }

    let urlHost = '';
    try {
        urlHost = normalizeAsciiHostname(new URL(fullUrl).hostname) || '';
    } catch (e) {
        return false;
    }

    if (linkumoriRule.includeDomains.length > 0) {
        // For @@ exception rules, domain= matches the INITIATING PAGE, not the
        // request destination. @@$removeparam=ei,domain=gemini.google.com means
        // "when the page is gemini.google.com don't remove ei from any request".
        const _dh = (linkumoriRule.isException && request)
            ? (() => { const h = requestContextManager.collectContextURLs(request).map(u => { try { return normalizeAsciiHostname(new URL(u).hostname)||''; } catch(e){ return ''; } }).filter(Boolean); return h.length ? h : [urlHost]; })()
            : [urlHost];
        if (!linkumoriRule.includeDomains.some(p => _dh.some(h => matchWhitelistHostnamePattern(h, p)))) return false;
    }

    if (linkumoriRule.excludeDomains.length > 0) {
        const _dh2 = (linkumoriRule.isException && request)
            ? (() => { const h = requestContextManager.collectContextURLs(request).map(u => { try { return normalizeAsciiHostname(new URL(u).hostname)||''; } catch(e){ return ''; } }).filter(Boolean); return h.length ? h : [urlHost]; })()
            : [urlHost];
        if (linkumoriRule.excludeDomains.some(p => _dh2.some(h => matchWhitelistHostnamePattern(h, p)))) return false;
    }

    if (linkumoriRule.includeMethods.length > 0) {
        const requestMethod = (request && typeof request.method === 'string')
            ? request.method.toUpperCase()
            : '';
        if (!linkumoriRule.includeMethods.includes(requestMethod)) return false;
    }

    if (linkumoriRule.excludeMethods.length > 0) {
        const requestMethod = (request && typeof request.method === 'string')
            ? request.method.toUpperCase()
            : '';
        if (linkumoriRule.excludeMethods.includes(requestMethod)) return false;
    }

    return true;
}

function linkumoriRemoveParamMatchesName(linkumoriRule, fieldName) {
    if (!linkumoriRule || !fieldName) return false;
    if (linkumoriRule.removeAll) return true;

    const paramName = String(fieldName).toLowerCase();
    let matched = false;

    if (linkumoriRule.regexParam) {
        matched = linkumoriRule.regexParam.test(paramName);
    } else if (linkumoriRule.literalParam !== null) {
        matched = paramName === linkumoriRule.literalParam;
    }

    return linkumoriRule.negate ? !matched : matched;
}

function evaluateLinkumoriRemoveParamRules(fullUrl, rules, request = null) {
    return (rules || []).filter((rule) => {
        return matchLinkumoriRemoveParamTarget(rule, fullUrl, request);
    });
}

function resolveLinkumoriParamDecision(fieldName, activeRules, activeExceptions) {
    const normalizedFieldName = String(fieldName || '').toLowerCase();
    if (!normalizedFieldName) {
        return {
            handled: false,
            remove: false,
            matchedRule: null
        };
    }

    const matchedException = (activeExceptions || []).find((linkumoriRule) => {
        return linkumoriRemoveParamMatchesName(linkumoriRule, normalizedFieldName);
    });

    if (matchedException) {
        return {
            handled: true,
            remove: false,
            matchedRule: matchedException.raw || null
        };
    }

    const matchedRule = (activeRules || []).find((linkumoriRule) => {
        return linkumoriRemoveParamMatchesName(linkumoriRule, normalizedFieldName);
    });

    if (matchedRule) {
        return {
            handled: true,
            remove: true,
            matchedRule: matchedRule.raw || null
        };
    }

    return {
        handled: false,
        remove: false,
        matchedRule: null
    };
}

function linkumoriRemoveParamExceptionMatchesMethod(linkumoriRule, request = null) {
    const requestMethod = (request && typeof request.method === 'string')
        ? request.method.toUpperCase()
        : '';

    if (linkumoriRule.includeMethods.length > 0 && !linkumoriRule.includeMethods.includes(requestMethod)) {
        return false;
    }

    if (linkumoriRule.excludeMethods.length > 0 && linkumoriRule.excludeMethods.includes(requestMethod)) {
        return false;
    }

    return true;
}

function linkumoriRemoveParamExceptionMatchesContext(linkumoriRule, contextUrls, request = null) {
    if (!linkumoriRule || !linkumoriRule.isException || !Array.isArray(contextUrls)) {
        return false;
    }
    if (!linkumoriRemoveParamExceptionMatchesMethod(linkumoriRule, request)) {
        return false;
    }

    return contextUrls.some((contextUrl) => {
        return contextUrl && matchLinkumoriRemoveParamTarget(linkumoriRule, contextUrl, null);
    });
}


function resolveCoreRuleDefaults(rule, defaults = null) {
    if (!rule || typeof rule !== "object" || Array.isArray(rule)) {
        return rule;
    }

    const safeDefaults = defaults && typeof defaults === "object" ? defaults : {};
    return {
        ...rule,
        ...(rule.active === undefined && typeof safeDefaults.active === "boolean" ? { active: safeDefaults.active } : {}),
        ...(rule.description === undefined && typeof safeDefaults.description === "string" ? { description: safeDefaults.description } : {}),
        ...(rule.requestTypes === undefined && safeDefaults.requestTypes !== undefined ? { requestTypes: safeDefaults.requestTypes } : {}),
        ...(rule.preprocessors === undefined && Array.isArray(safeDefaults.preprocessors) ? { preprocessors: safeDefaults.preprocessors } : {}),
        ...(rule.exceptions === undefined && Array.isArray(safeDefaults.exceptions) ? { exceptions: safeDefaults.exceptions } : {})
    };
}

function normalizeCoreRuleDefinition(rule, defaultFlags = "i", defaults = null) {
    if (typeof rule === "string") {
        const safeDefaults = defaults && typeof defaults === "object" ? defaults : {};
        const requestTypes = safeDefaults.requestTypes === "all"
            ? null
            : (Array.isArray(safeDefaults.requestTypes)
                ? safeDefaults.requestTypes.map((item) => String(item || "").toLowerCase()).filter(Boolean)
                : null);
        return {
            actionType: "remove",
            active: typeof safeDefaults.active === "boolean" ? safeDefaults.active : true,
            aliases: [],
            description: typeof safeDefaults.description === "string" ? safeDefaults.description : "",
            exceptions: Array.isArray(safeDefaults.exceptions) ? safeDefaults.exceptions.filter((item) => typeof item === "string") : [],
            flags: defaultFlags,
            id: null,
            kind: null,
            matchPattern: rule,
            preprocessors: Array.isArray(safeDefaults.preprocessors) ? safeDefaults.preprocessors : [],
            referralMarketing: false,
            replacePattern: null,
            requestTypes,
            raw: rule,
            sourceType: "legacy"
        };
    }

    const resolvedRule = resolveCoreRuleDefaults(rule, defaults);
    if (!resolvedRule || typeof resolvedRule !== "object") {
        return null;
    }

    const isCanonical = typeof resolvedRule.match === "string";
    const matchPattern = isCanonical ? resolvedRule.match : resolvedRule.matchPattern;
    if (typeof matchPattern !== "string") {
        return null;
    }

    const action = resolvedRule.action && typeof resolvedRule.action === "object"
        ? resolvedRule.action
        : null;
    const actionType = action && typeof action.type === "string"
        ? action.type
        : (typeof resolvedRule.replacePattern === "string" ? "rewrite" : "remove");
    const replacePattern = action && typeof action.replacePattern === "string"
        ? action.replacePattern
        : (typeof resolvedRule.replacePattern === "string" ? resolvedRule.replacePattern : null);
    const requestTypes = resolvedRule.requestTypes === "all"
        ? null
        : (Array.isArray(resolvedRule.requestTypes)
            ? resolvedRule.requestTypes.map((item) => String(item || "").toLowerCase()).filter(Boolean)
            : null);
    const sourceType = isCanonical ? "canonical" : "legacy-object";
    const kind = typeof resolvedRule.kind === "string" ? resolvedRule.kind : null;

    if (sourceType === "canonical") {
        const effectiveKind = kind || "field";
        if ((effectiveKind === "field" || effectiveKind === "raw") && actionType === "redirect") {
            return null;
        }
        if (effectiveKind === "redirection" && actionType !== "redirect") {
            return null;
        }
    }

    return {
        actionType,
        active: typeof resolvedRule.active === "boolean"
            ? resolvedRule.active
            : (typeof resolvedRule.activeDefault === "boolean" ? resolvedRule.activeDefault : true),
        aliases: Array.isArray(resolvedRule.aliases) ? resolvedRule.aliases.filter((item) => typeof item === "string") : [],
        description: typeof resolvedRule.description === "string" ? resolvedRule.description : "",
        exceptions: Array.isArray(resolvedRule.exceptions) ? resolvedRule.exceptions.filter((item) => typeof item === "string") : [],
        flags: typeof resolvedRule.flags === "string" ? resolvedRule.flags : defaultFlags,
        id: typeof resolvedRule.id === "string" ? resolvedRule.id : null,
        kind,
        matchPattern,
        preprocessors: Array.isArray(resolvedRule.preprocessors) ? resolvedRule.preprocessors : [],
        referralMarketing: resolvedRule.referralMarketing === true,
        replacePattern,
        requestTypes,
        raw: resolvedRule,
        sourceType,
        _linkumoriActivationIds: normalizeCoreRuleActivationIds(resolvedRule._linkumoriActivationIds)
    };
}

function compileCoreRuleDefinition(rule, defaultFlags = "i", wrapFieldRule = false, defaults = null) {
    const normalized = normalizeCoreRuleDefinition(rule, defaultFlags, defaults);
    if (!normalized) return null;

    const source = wrapFieldRule ? "^" + normalized.matchPattern + "$" : normalized.matchPattern;
    try {
        const exceptionRegexes = normalized.exceptions.map(ex => {
            try { return new RegExp(ex); } catch (_) { return null; }
        }).filter(Boolean);
        return {
            ...normalized,
            exceptionRegexes,
            regex: new RegExp(source, normalized.flags)
        };
    } catch (_) {
        return null;
    }
}

function normalizeCoreDomainRedirection(redirection) {
    if (typeof redirection === "string") {
        return redirection.trim();
    }

    if (!redirection || typeof redirection !== "object" || Array.isArray(redirection)) {
        return null;
    }

    const matchPattern = typeof redirection.match === "string"
        ? redirection.match
        : redirection.matchPattern;
    const action = redirection.action && typeof redirection.action === "object"
        ? redirection.action
        : null;
    const replacePattern = action && typeof action.replacePattern === "string"
        ? action.replacePattern
        : redirection.replacePattern;

    if (typeof matchPattern !== "string" || typeof replacePattern !== "string") {
        return null;
    }

    const pattern = matchPattern.trim();
    const target = replacePattern.trim();
    return pattern && target ? `${pattern}$redirect=${target}` : null;
}

function getCoreRuleTraceName(compiledRule, fallback) {
    return compiledRule && typeof compiledRule.id === "string" && compiledRule.id
        ? compiledRule.id
        : fallback;
}

function coreRuleAppliesToRequest(compiledRule, url, request) {
    // Legacy maps may still contain bare RegExp values from persisted or older
    // in-memory provider instances. Treat those as unconditional rules.
    if (compiledRule instanceof RegExp) return true;
    if (!compiledRule) return false;
    if (compiledRule.active === false) return false;

    if (compiledRule.requestTypes && compiledRule.requestTypes.length > 0) {
        const requestType = String(request && request.type || "").toLowerCase();
        if (!requestType || compiledRule.requestTypes.indexOf(requestType) === -1) return false;
    }

    if (Array.isArray(compiledRule.exceptionRegexes) && compiledRule.exceptionRegexes.length > 0) {
        return !compiledRule.exceptionRegexes.some(regex => {
            try { regex.lastIndex = 0; return regex.test(url); } catch (_) { return false; }
        });
    }

    const exceptions = Array.isArray(compiledRule.exceptions) ? compiledRule.exceptions : [];
    return !exceptions.some((exception) => {
        try { return (new RegExp(exception)).test(url); } catch (_) { return false; }
    });
}

function applyCoreRulePreprocessors(values, preprocessors) {
    let next = values.slice();
    for (const preprocessor of preprocessors || []) {
        if (!preprocessor || typeof preprocessor.type !== "string") continue;
        const indexes = preprocessor.inputs === "all"
            ? next.map((_, index) => index)
            : (Array.isArray(preprocessor.inputs) ? preprocessor.inputs.map((value) => Number(value) - 1) : []);

        for (const index of indexes) {
            if (index < 0 || index >= next.length) continue;
            const current = String(next[index] == null ? "" : next[index]);
            try {
                switch (preprocessor.type) {
                    case "urlEncode":
                        next[index] = encodeURIComponent(current);
                        break;
                    case "urlDecode":
                        next[index] = decodeURIComponent(current);
                        break;
                    case "doubleUrlEncode":
                    case "urlEncodeRepeated":
                        next[index] = encodeURIComponent(encodeURIComponent(current));
                        break;
                    case "doubleUrlDecode":
                    case "urlDecodeRepeated":
                        next[index] = decodeURIComponent(decodeURIComponent(current));
                        break;
                    case "base64Encode":
                        next[index] = btoa(unescape(encodeURIComponent(current)));
                        break;
                    case "base64Decode":
                        next[index] = decodeURIComponent(escape(atob(current)));
                        break;
                }
            } catch (_) {
                // Keep original value when a preprocessor cannot transform it.
            }
        }
    }
    return next;
}

function applyCoreReplacePattern(pattern, values) {
    if (pattern === null || pattern === undefined) return "";
    return String(pattern).replace(/§\d+?§/g, (placeholder) => {
        const index = parseInt(placeholder.slice(1, -1), 10) - 1;
        return values[index] === undefined ? "" : values[index];
    });
}

function removeRawRuleMatchesPreservingQueryBoundary(value, regex) {
    return value.replace(regex, (match, ...args) => {
        const hasNamedGroups = args.length >= 3 && typeof args[args.length - 1] === 'object' && args[args.length - 1] !== null;
        const offsetIndex = hasNamedGroups ? args.length - 3 : args.length - 2;
        const offset = args[offsetIndex];
        const nextCharacter = value[offset + match.length];

        // If a raw rule removes the first query item including its leading '?',
        // keep the query boundary when additional items remain. Otherwise the
        // surviving '&foo=bar' becomes part of the URL path when reparsed.
        return match.startsWith('?') && nextCharacter === '&' ? '?' : '';
    });
}



// FIX: extraExceptions — cross-provider context exceptions collected in clearUrl()
// and injected directly into activeLinkumoriExceptions, bypassing the URL-pattern
// re-check in evaluateLinkumoriRemoveParamRules. They are already pre-qualified by
// page context (documentUrl / originUrl / tab URL) in clearUrl(), so filtering them
// again by the request URL would incorrectly discard them — e.g. the exception
// @@||gemini.google.com$removeparam=ei must stay active for requests to google.com,
// facebook.com, map.google.com, etc. that originate from a gemini.google.com page.
function removeFieldsFormURL(provider, pureUrl, quiet = false, request = null, traceCollector = null, extraExceptions = [], sessionRewrites = null) {
    let url = pureUrl;
    let domain = "";
    let fragments = "";
    let fields = "";
    let linkumoriParamRules = provider.getLinkumoriRemoveParamRules();
    let linkumoriParamExceptions = provider.getLinkumoriRemoveParamExceptions();
    let changes = false;
    let actionType = null;
    let matchedRuleForTrace = null;
    let urlObject = new URL(url);
    // sessionRewrites persists across all cleaning iterations for one URL so that
    // rewrite rules do not re-fire on the same (provider, field, rule) combination
    // in subsequent passes of the pureCleaningTrace loop.
    const appliedFieldRewrites = sessionRewrites instanceof Set ? sessionRewrites : new Set();
    const providerMatch = {
        ...provider.getAppliedPatternForUrl(pureUrl),
        logCategory: 'provider',
        providerMethods: provider.getMethods(),
        providerResourceTypes: provider.getResourceTypes(),
        requestMethod: request && typeof request.method === 'string' ? request.method : null,
        requestType: request && typeof request.type === 'string' ? request.type : null,
        tabId: request && typeof request.tabId === 'number' ? request.tabId : -1,
        aliasURL: request && typeof request.linkumoriAliasURL === 'string' ? request.linkumoriAliasURL : null,
        cname: request && typeof request.linkumoriCNAME === 'string' ? request.linkumoriCNAME : null
    };

    if (storage.localHostsSkipping && checkLocalURL(urlObject)) {
        return {
            "changes": false,
            "url": url,
            "cancel": false,
            "providerMatch": providerMatch,
            "matchedRule": null,
            "action": null
        }
    }

    let re = storage.redirectionEnabled ? provider.getRedirection(url, request) : null;
    if (re !== null) {
        url = decodeURL(re);

        if (!quiet) {
            pushToLog(pureUrl, url, translate('log_redirect'), providerMatch);
            increaseTotalCounter(1);
            increaseBadged(false, request)
        }

        return {
            "redirect": true,
            "url": url,
            "providerMatch": providerMatch,
            "matchedRule": translate('log_redirect'),
            "action": 'redirect'
        }
    }

    if (provider.isCanceling() && storage.domainBlocking) {
        if (!quiet) pushToLog(pureUrl, pureUrl, translate('log_domain_blocked'), providerMatch);
        increaseTotalCounter(1);
        increaseBadged(false, request);
        return {
            "cancel": true,
            "url": url,
            "providerMatch": providerMatch,
            "matchedRule": translate('log_domain_blocked'),
            "action": 'cancel'
        }
    }

    const rawRulesMap = provider.getRawRulesMap();
    Object.keys(rawRulesMap).forEach(function (rawRuleStr) {
        const compiled = rawRulesMap[rawRuleStr];
        if (!coreRuleAppliesToRequest(compiled, url, request)) return;
        const activeRegex = compiled && compiled.regex instanceof RegExp
            ? compiled.regex
            : new RegExp(rawRuleStr, "gi");
        let beforeReplace = url;
        if (compiled && compiled.replacePattern !== null) {
            url = url.replace(activeRegex, (...args) => {
                const hasNamedGroups = args.length >= 3 && typeof args[args.length - 1] === 'object' && args[args.length - 1] !== null;
                const endIndex = hasNamedGroups ? args.length - 3 : args.length - 2;
                const values = applyCoreRulePreprocessors(args.slice(1, endIndex).map((value) => value === undefined ? '' : String(value)), compiled.preprocessors);
                return applyCoreReplacePattern(compiled.replacePattern, values);
            });
        } else {
            url = removeRawRuleMatchesPreservingQueryBoundary(url, activeRegex);
        }

        if (beforeReplace !== url) {
            if (storage.loggingStatus && !quiet) {
                pushToLog(beforeReplace, url, rawRuleStr, providerMatch);
            }

            increaseBadged(false, request);
            changes = true;
            if (!actionType) {
                actionType = 'raw_rule';
            }
            if (!matchedRuleForTrace) {
                matchedRuleForTrace = getCoreRuleTraceName(compiled, rawRuleStr);
            }
        }
    });

    urlObject = new URL(url);
    fields = urlObject.searchParams;
    fragments = extractFragments(urlObject);
    domain = urlWithoutParamsAndHash(urlObject).toString();

    if (fields.toString() !== "" || fragments.toString() !== "") {
        const activeLinkumoriRules = evaluateLinkumoriRemoveParamRules(
            url,
            linkumoriParamRules,
            request
        );
        // Provider exceptions are filtered normally by request URL pattern.
        // extraExceptions are injected directly — pre-qualified by page context
        // in clearUrl(), so re-filtering by request URL would wrongly discard them
        // (e.g. @@||gemini.google.com$removeparam=ei must stay active for requests
        // to google.com, facebook.com, map.google.com from a gemini.google.com page).
        const activeLinkumoriExceptions = [
            ...evaluateLinkumoriRemoveParamRules(url, linkumoriParamExceptions, request),
            ...(extraExceptions || [])
        ];
        const linkumoriDecisionCache = new Map();
        const getLinkumoriDecision = (paramName) => {
            const cacheKey = String(paramName || '').toLowerCase();
            if (linkumoriDecisionCache.has(cacheKey)) {
                return linkumoriDecisionCache.get(cacheKey);
            }

            const decision = resolveLinkumoriParamDecision(
                cacheKey,
                activeLinkumoriRules,
                activeLinkumoriExceptions
            );
            linkumoriDecisionCache.set(cacheKey, decision);
            return decision;
        };

        const rulesMap = provider.getRulesMap();
        Object.keys(rulesMap).forEach(rule => {
            const compiled = rulesMap[rule];
            if (!coreRuleAppliesToRequest(compiled, url, request)) return;
            const activeRegex = compiled && compiled.regex instanceof RegExp
                ? compiled.regex
                : new RegExp("^"+rule+"$", "gi");
            const beforeFields = fields.toString();
            const beforeFragments = fragments.toString();
            let localChange = false;

            const fieldsToDelete = [];
            for (const field of Array.from(fields.keys())) {
                const decision = getLinkumoriDecision(field);
                // Only skip when $removeparam is actively removing this field.
                // An exception (handled:true, remove:false) must not suppress
                // independent regex rules — @@$removeparam only excepts that system.
                if (decision.handled && decision.remove) continue;

                activeRegex.lastIndex = 0;
                if (activeRegex.test(field)) {
                    if (compiled && compiled.replacePattern !== null) {
                        const rewriteKey = provider.getName() + "::search::" + field + "::" + rule;
                        if (appliedFieldRewrites.has(rewriteKey)) continue;
                        const currentValues = fields.getAll(field);
                        fields.delete(field);
                        currentValues.forEach((value) => {
                            const values = applyCoreRulePreprocessors([value], compiled.preprocessors);
                            fields.append(field, applyCoreReplacePattern(compiled.replacePattern, values));
                        });
                        appliedFieldRewrites.add(rewriteKey);
                    } else {
                        fieldsToDelete.push(field);
                    }
                    localChange = true;
                }
            }
            fieldsToDelete.forEach(field => fields.delete(field));

            const fragmentsToDelete = [];
            for (const fragment of Array.from(fragments.keys())) {
                const decision = getLinkumoriDecision(fragment);
                if (decision.handled && decision.remove) continue;

                activeRegex.lastIndex = 0;
                if (activeRegex.test(fragment)) {
                    if (compiled && compiled.replacePattern !== null) {
                        const rewriteKey = provider.getName() + "::fragment::" + fragment + "::" + rule;
                        if (appliedFieldRewrites.has(rewriteKey)) continue;
                        const currentValues = fragments.getAll(fragment);
                        fragments.delete(fragment);
                        currentValues.forEach((value) => {
                            const values = applyCoreRulePreprocessors([value], compiled.preprocessors);
                            fragments.append(fragment, applyCoreReplacePattern(compiled.replacePattern, values));
                        });
                        appliedFieldRewrites.add(rewriteKey);
                    } else {
                        fragmentsToDelete.push(fragment);
                    }
                    localChange = true;
                }
            }
            fragmentsToDelete.forEach(fragment => fragments.delete(fragment));

            if (localChange) {
                changes = true;
                if (!actionType) {
                    actionType = 'rule';
                }
                if (!matchedRuleForTrace) {
                    matchedRuleForTrace = getCoreRuleTraceName(compiled, rule);
                }
                
                if (storage.loggingStatus) {
                    let tempURL = domain;
                    let tempBeforeURL = domain;

                    if (fields.toString() !== "") tempURL += "?" + fields.toString();
                    if (fragments.toString() !== "") tempURL += "#" + fragments.toString();
                    if (beforeFields.toString() !== "") tempBeforeURL += "?" + beforeFields.toString();
                    if (beforeFragments.toString() !== "") tempBeforeURL += "#" + beforeFragments.toString();

                    if (!quiet) pushToLog(tempBeforeURL, tempURL, rule, providerMatch);
                }

                increaseBadged(false, request);
            }
        });

        if (activeLinkumoriRules.length > 0 || activeLinkumoriExceptions.length > 0) {
            const beforeFields = fields.toString();
            const beforeFragments = fragments.toString();
            let localChange = false;
            let matchedRuleForLog = null;

            const fieldsToDelete = [];
            for (const field of fields.keys()) {
                const decision = getLinkumoriDecision(field);
                if (decision.remove) {
                    fieldsToDelete.push(field);
                    localChange = true;
                    if (!matchedRuleForLog && decision.matchedRule) {
                        matchedRuleForLog = decision.matchedRule;
                    }
                }
            }
            fieldsToDelete.forEach((field) => fields.delete(field));

            const fragmentsToDelete = [];
            for (const fragment of fragments.keys()) {
                const decision = getLinkumoriDecision(fragment);
                if (decision.remove) {
                    fragmentsToDelete.push(fragment);
                    localChange = true;
                    if (!matchedRuleForLog && decision.matchedRule) {
                        matchedRuleForLog = decision.matchedRule;
                    }
                }
            }
            fragmentsToDelete.forEach((fragment) => fragments.delete(fragment));

            if (localChange) {
                changes = true;
                if (!actionType) {
                    actionType = 'removeparam';
                }
                if (!matchedRuleForTrace) {
                    matchedRuleForTrace = matchedRuleForLog || '$removeparam';
                }

                if (storage.loggingStatus) {
                    let tempURL = domain;
                    let tempBeforeURL = domain;

                    if (fields.toString() !== "") tempURL += "?" + fields.toString();
                    if (fragments.toString() !== "") tempURL += "#" + fragments.toString();
                    if (beforeFields.toString() !== "") tempBeforeURL += "?" + beforeFields.toString();
                    if (beforeFragments.toString() !== "") tempBeforeURL += "#" + beforeFragments.toString();

                    if (!quiet) pushToLog(tempBeforeURL, tempURL, matchedRuleForLog || '$removeparam', providerMatch);
                }

                increaseBadged(false, request);
            }
        }

        let finalURL = domain;

        if (fields.toString() !== "") finalURL += "?" + urlSearchParamsToString(fields);
        if (fragments.toString() !== "") finalURL += "#" + fragments.toString();

        url = finalURL.replace(/\?&/, "?").replace(/#&/, "#");
    }

    return {
        "changes": changes,
        "url": url,
        "providerMatch": providerMatch,
        "matchedRule": matchedRuleForTrace,
        "action": actionType
    }
}

function start() {
    initPslSupport();
    requestContextManager.init();

    function getKeys(obj) {
        prvKeys = [];
        for (const key in obj) {
            prvKeys.push(key);
        }
    }

    function createProviders() {
        let data = storage.ClearURLsData;
        
        if (!data || !data.providers) {
            return;
        }

        providers = [];

        for (let p = 0; p < prvKeys.length; p++) {
            const providerData = data.providers[prvKeys[p]];
            if (providerData.getOrDefault('active', providerData.getOrDefault('defaultActive', true)) === false) {
                continue;
            }
            const provider = new Provider(prvKeys[p], providerData.getOrDefault('completeProvider', false),
                providerData.getOrDefault('forceRedirection', false), getClearURLsDisabledRuleIdSet());
            providers.push(provider);

            let urlPattern = providerData.getOrDefault('urlPattern', '');
            let indexPattern = providerData.getOrDefault('indexPattern', []);
            let domainPatterns = providerData.getOrDefault('domainPatterns', []);

            if (urlPattern) {
                provider.setURLPattern(urlPattern);
                const hasIndex = Array.isArray(indexPattern)
                    ? indexPattern.length > 0
                    : Boolean(indexPattern);
                if (hasIndex) {
                    provider.setIndexPattern(indexPattern);
                }
            } else if (domainPatterns.length > 0) {
                provider.setURLDomainPattern(domainPatterns);
            }

            const providerDefaults = data && data.defaults && typeof data.defaults === 'object' ? data.defaults : null;
            let rules = data.providers[prvKeys[p]].getOrDefault('rules', []);
            for (let r = 0; r < rules.length; r++) {
                const normalizedRule = normalizeCoreRuleDefinition(rules[r], "i", providerDefaults);
                if (normalizedRule && normalizedRule.sourceType === 'canonical') {
                    if (normalizedRule.kind === 'raw') {
                        provider.addRawRule(rules[r], true, providerDefaults);
                    } else if (normalizedRule.kind === 'redirection' || normalizedRule.actionType === 'redirect') {
                        provider.addRedirection(rules[r], true, providerDefaults);
                    } else if (normalizedRule.referralMarketing === true) {
                        provider.addReferralMarketing(rules[r], true, providerDefaults);
                    } else {
                        provider.addRule(rules[r], true, providerDefaults);
                    }
                    continue;
                }
                provider.addRule(rules[r], true, providerDefaults);
            }

            let rawRules = data.providers[prvKeys[p]].getOrDefault('rawRules', []);
            for (let raw = 0; raw < rawRules.length; raw++) {
                provider.addRawRule(rawRules[raw], true, providerDefaults);
            }

            let referralMarketingRules = data.providers[prvKeys[p]].getOrDefault('referralMarketing', []);
            for (let referralMarketing = 0; referralMarketing < referralMarketingRules.length; referralMarketing++) {
                provider.addReferralMarketing(referralMarketingRules[referralMarketing], true, providerDefaults);
            }

            let exceptions = data.providers[prvKeys[p]].getOrDefault('exceptions', []);
            for (let e = 0; e < exceptions.length; e++) {
                provider.addException(exceptions[e], true, providerDefaults);
            }
            
            let domainExceptions = data.providers[prvKeys[p]].getOrDefault('domainExceptions', []);
            for (let ude = 0; ude < domainExceptions.length; ude++) {
                provider.addDomainException(domainExceptions[ude]);
            }

            let redirections = data.providers[prvKeys[p]].getOrDefault('redirections', []);
            for (let re = 0; re < redirections.length; re++) {
                provider.addRedirection(redirections[re], true, providerDefaults);
            }
            
            let domainRedirections = data.providers[prvKeys[p]].getOrDefault('domainRedirections', []);
            for (let udr = 0; udr < domainRedirections.length; udr++) {
                provider.addDomainRedirection(domainRedirections[udr]);
            }

            let methods = data.providers[prvKeys[p]].getOrDefault('methods', []);
            for (let re = 0; re < methods.length; re++) {
                provider.addMethod(methods[re]);
            }

            let resourceTypes = data.providers[prvKeys[p]].getOrDefault('resourceTypes', []);
            for (let rt = 0; rt < resourceTypes.length; rt++) {
                provider.addResourceType(resourceTypes[rt]);
            }

            // Indexing logic
            const lookupTokens = provider.getLookupTokens();

            if (lookupTokens.length > 0) {
                for (const token of lookupTokens) {
                    if (!providersByToken[token]) {
                        providersByToken[token] = [];
                    }
                    providersByToken[token].push(provider);
                }
                if (provider.requiresGlobalFallback()) {
                    globalProviders.push(provider);
                }
            } else {
                globalProviders.push(provider);
            }
        }

        const providersByTokenSnapshot = {};
        Object.keys(providersByToken).forEach((token) => {
            providersByTokenSnapshot[token] = providersByToken[token].map(provider => provider.getName());
        });
        clearurlsProviderSnapshot.providerCount = providers.length;
        clearurlsProviderSnapshot.providers = providers.map(provider => provider.getSnapshotMetadata());
        clearurlsProviderSnapshot.providersByToken = providersByTokenSnapshot;
        clearurlsProviderSnapshot.globalProviders = globalProviders.map(provider => provider.getName());
        globalThis.linkumoriClearURLProviderSnapshot = clearurlsProviderSnapshot;
    }

    function initializeProviders() {
        if (!rebuildProvidersFromStorage()) {
            return false;
        }

        setupWebRequestListener();

        return true;
    }

    function rebuildProvidersFromStorage() {
        if (!storage.ClearURLsData || !storage.ClearURLsData.providers) {
            providers = [];
            providersByToken = Object.create(null);
            globalProviders = [];
            clearurlsProviderSnapshot = createEmptyProviderSnapshot();
            globalThis.linkumoriClearURLProviderSnapshot = clearurlsProviderSnapshot;
            prvKeys = [];
            return false;
        }

        providersByToken = Object.create(null);
        globalProviders = [];
        clearurlsProviderSnapshot = createEmptyProviderSnapshot();
        clearurlsProviderSnapshot.disabledRuleIds = normalizeClearURLsDisabledRuleIds(storage.clearurls_disabled_rule_ids);
        getKeys(storage.ClearURLsData.providers);
        createProviders();
        return true;
    }

    function setupWebRequestListener() {
        if (clearurlsWebRequestHandler && browser.webRequest.onBeforeRequest.hasListener(clearurlsWebRequestHandler)) {
            return;
        }

        function hasWebRequestDecision(result) {
            return !!(
                result &&
                (
                    result.cancel === true ||
                    typeof result.redirectUrl === 'string'
                )
            );
        }

        clearurlsWebRequestHandler = function (requestDetails) {
            if (requestDetails && requestDetails.tabId >= 0) {
                if (requestDetails.type === 'main_frame') {
                    requestContextManager.setTabURL(requestDetails.tabId, requestDetails.url);
                } else if (requestDetails.type === 'sub_frame') {
                    requestContextManager.setFrameURL(
                        requestDetails.tabId,
                        requestDetails.frameId,
                        requestDetails.url,
                        requestDetails.parentFrameId
                    );
                }
            }

            if (isDataURL(requestDetails)) {
                return {};
            } else {
                const result = clearUrl(requestDetails);
                if (hasWebRequestDecision(result)) {
                    return result;
                }

                if (
                    globalThis.LinkumoriDNS &&
                    typeof globalThis.LinkumoriDNS.replayCNAMEIfNeeded === 'function'
                ) {
                    return globalThis.LinkumoriDNS.replayCNAMEIfNeeded(requestDetails, clearUrl);
                }

                return result;
            }
        };

        function isDataURL(requestDetails) {
            const s = requestDetails.url;
            return s.substring(0, 4) === "data";
        }

        browser.webRequest.onBeforeRequest.addListener(
            clearurlsWebRequestHandler,
            {urls: ["<all_urls>"], types: getData("types").concat(getData("pingRequestTypes"))},
            ["blocking"]
        );
    }

    // Called by storage.js after remote/custom rule refresh to apply changes
    // immediately without reloading the extension background context.
    globalThis.updateProviderData = function () {
        const refreshed = rebuildProvidersFromStorage();
        if (refreshed) {
            initializationComplete = true;
        }
        return refreshed;
    };

    let initAttempts = 0;
    const maxInitAttempts = 50;
    
    function tryInitialize() {
        initAttempts++;
        
        if (initializeProviders()) {
            initializationComplete = true;
            return;
        }
        
        if (initAttempts < maxInitAttempts) {
            setTimeout(tryInitialize, 200);
        } else {
            setupWebRequestListener();
            console.warn('ClearURLs initialized with limited functionality');
        }
    }
    
    tryInitialize();

    loadOldDataFromStore();
    setBadgedStatus();

    function Provider(_name, _completeProvider = false, _forceRedirection = false, _disabledRuleIds = new Set()) {
        const name = _name;
        let urlPattern;
        let urlPatternSource = '';
        let indexPatterns = [];  // domainPattern-syntax hints for providersByToken index only
        let domainPatterns = [];
        const fieldRuleMap = {};
        const exceptionRuleMap = {};
        const domainExceptionPatterns = [];
        const domainRedirectionRules = [];
        const canceling = _completeProvider;
        const redirectionRuleMap = {};
        const rawRuleMap = {};
        const referralMarketingRuleMap = {};
        const linkumoriRemoveParamRules = [];
        const linkumoriRemoveParamExceptions = [];
        const methods = [];
        const resourceTypes = [];

        if (_completeProvider) {
            fieldRuleMap[".*"] = true;
        }

        function activateCompiledRule(compiled, section) {
            if (!compiled) return null;
            compiled.section = section;
            attachCoreRuleIdentity(name, compiled, section);
            if (filterCoreRuleActivationIds(compiled, _disabledRuleIds)) {
                registerDisabledCoreRuleInSnapshot(compiled);
                return null;
            }
            registerCoreRuleInSnapshot(compiled);
            return compiled;
        }

        this.shouldForceRedirect = function () {
            return _forceRedirection;
        };

        this.getName = function () {
            return name;
        };

        this.getSnapshotMetadata = function () {
            return {
                completeProvider: canceling,
                domainPatterns: domainPatterns.slice(),
                forceRedirection: _forceRedirection,
                indexPatterns: indexPatterns.slice(),
                methods: methods.slice(),
                name,
                resourceTypes: resourceTypes.slice(),
                urlPattern: urlPatternSource
            };
        };

        /**
         * Extracts lookup tokens from domainPatterns and indexPattern.
         *
         * domainPatterns — used for both matching (matchURL) and indexing.
         * indexPatterns  — used for indexing only; lets urlPattern providers
         *                  declare their target domains explicitly in the simple
         *                  domainPattern syntax (||youtube.com^) without having
         *                  to infer them by parsing the regex source.
         *
         * Examples:
         *   ||amazon.*^        -> amazon
         *   *.google.com       -> google
         *   example.co.uk      -> example
         *   ||sub.domain.com/  -> domain
         *
         * @return {String[]}
         */
        this.getDomainLookupTokens = function () {
            const tokens = new Set();

            function cleanDomainPattern(pattern) {
                let value = String(pattern || '').trim().toLowerCase();
                if (!value) return '';

                // Regex literals (/pattern/flags) have no hostname to extract —
                // return '' so the provider stays in globalProviders for this pattern.
                if (value.charAt(0) === '/') return '';

                if (value.startsWith('@@')) {
                    value = value.slice(2);
                }

                if (value.startsWith('||')) {
                    value = value.slice(2);
                } else if (value.startsWith('|')) {
                    value = value.slice(1);
                }

                if (value.endsWith('|')) {
                    value = value.slice(0, -1);
                }

                if (value.startsWith('*.')) {
                    value = value.slice(2);
                }

                if (value.startsWith('http://')) {
                    value = value.slice(7);
                } else if (value.startsWith('https://')) {
                    value = value.slice(8);
                }

                const stopIndexes = [
                    value.indexOf('/'),
                    value.indexOf('^'),
                    value.indexOf('$'),
                    value.indexOf('?'),
                    value.indexOf('#')
                ].filter(index => index !== -1);

                if (stopIndexes.length > 0) {
                    value = value.slice(0, Math.min(...stopIndexes));
                }

                if (value.endsWith('.*')) {
                    value = value.slice(0, -2);
                }

                return value;
            }

            function tokenFromHostnameLikePattern(hostnameLikePattern) {
                const normalized = normalizeAsciiHostname(hostnameLikePattern);
                if (!normalized) return [];

                /*
                 * Prefer PSL parsing when available.
                 *
                 * Examples:
                 *   example.co.uk -> parsed.domain = example.co.uk
                 *   google.com    -> parsed.domain = google.com
                 *
                 * Token should be the registrable-domain label:
                 *   example.co.uk -> example
                 *   google.com    -> google
                 */
                const parsed = parseHostnameWithPsl(normalized);
                if (parsed && parsed.domain && parsed.tld) {
                    const suffix = '.' + parsed.tld;
                    const domainWithoutTld = parsed.domain.endsWith(suffix)
                        ? parsed.domain.slice(0, -suffix.length)
                        : parsed.domain;

                    const labels = domainWithoutTld
                        .split('.')
                        .map(label => label.trim())
                        .filter(Boolean);

                    if (labels.length > 0) {
                        return [labels[labels.length - 1].toLowerCase()];
                    }
                }

                /*
                 * Fallback when PSL is not ready during provider creation.
                 * No hardcoded TLDs are used here.
                 *
                 * Returns ALL labels except the last (probable bare TLD like "com",
                 * "uk", "org") so that a provider for sub.example.co.uk is indexed
                 * under both "sub" and "example" — fixing the miss when a sibling
                 * subdomain makes the request and "sub" is not among its tokens.
                 * Indexing under the bare TLD label is skipped to avoid every .com
                 * request pulling in unrelated providers as candidates.
                 * Final matching is still verified by provider.matchURL(), so
                 * extra tokens here create false-positive candidates only, never
                 * false rule application.
                 */
                const labels = normalized
                    .split('.')
                    .map(label => label.trim())
                    .filter(label => /^[a-z0-9-]+$/i.test(label))
                    .filter(label => label !== '*');

                if (labels.length > 1) {
                    return labels.slice(0, -1).map(l => l.toLowerCase());
                }
                return labels.map(l => l.toLowerCase());
            }

            // Combine domainPatterns and indexPatterns into one source list.
            // Both use the same domainPattern syntax so the same pipeline handles them.
            const sources = [...domainPatterns, ...indexPatterns];

            for (const pattern of sources) {
                const cleaned = cleanDomainPattern(pattern);
                if (!cleaned) continue;

                for (const token of tokenFromHostnameLikePattern(cleaned)) {
                    tokens.add(token);
                }
            }

            return Array.from(tokens);
        };

        /**
         * Returns all lookup tokens for this provider.
         *
         * Tokens come exclusively from domainPatterns and indexPattern —
         * both use the domainPattern syntax which maps cleanly to hostname
         * labels. urlPattern never self-indexes: if a provider uses urlPattern
         * without an indexPattern it falls to globalProviders, which is the
         * correct conservative behaviour.
         *
         * @return {String[]}
         */
        this.getLookupTokens = function () {
            const tokens = new Set();
            for (const t of this.getDomainLookupTokens()) {
                if (t) tokens.add(t);
            }
            return Array.from(tokens);
        };

        this.requiresGlobalFallback = function () {
            return domainPatterns.some(pattern => String(pattern || '').trim().charAt(0) === '/');
        };

        this.setURLPattern = function (urlPatterns) {
            urlPatternSource = urlPatterns || '';
            urlPattern = new RegExp(urlPatterns, "i");
        };

        /**
         * Sets the indexPatterns for this provider.
         *
         * indexPattern is HOSTNAME-ONLY. It declares which hostname(s) this
         * provider targets so the engine can index it in providersByToken.
         * providersByToken is queried with dot-split hostname labels, so any
         * path, query, or fragment portion is meaningless and stripped at
         * write time.
         *
         * Valid forms:
         *   "||amazon.com^"          registrable domain, any subdomain
         *   "||amazon.*^"            registrable domain, any TLD
         *   "*.amazon.com"           any subdomain of amazon.com
         *   "*.amazon.*"             any subdomain, any TLD
         *   "amazon.com"             exact hostname (substring fallback)
         *
         * Invalid (path will be stripped, write a warning to console):
         *   "||youtube.com/pagead"   → stored as "||youtube.com"
         *
         * Accepts a single string or an array for providers whose urlPattern
         * covers multiple unrelated hostnames:
         *   ["||youtube.com^", "||youtu.be^"]
         *
         * @param {string|string[]} pattern - hostname-only domainPattern-syntax string or array
         */
        this.setIndexPattern = function (pattern) {
            // Strip everything from the first path separator so callers that
            // accidentally include a path get the hostname portion only.
            function hostnameOnly(p) {
                if (!p) return '';
                let v = String(p).trim();
                // Strip anchors for the path-check, but preserve them in output
                const prefix = v.startsWith('||') ? '||'
                             : v.startsWith('|')  ? '|'
                             : '';
                const body = v.slice(prefix.length);
                const pathStart = Math.min(
                    ...[body.indexOf('/'), body.indexOf('?'), body.indexOf('#')]
                        .filter(i => i !== -1)
                        .concat([body.length])
                );
                if (pathStart < body.length) {
                   
                    // Rebuild: keep prefix + hostname + trailing ^ if present
                    const host = body.slice(0, pathStart);
                    v = prefix + host;
                }
                return v;
            }

            if (Array.isArray(pattern)) {
                indexPatterns = pattern.map(hostnameOnly).filter(Boolean);
            } else if (pattern) {
                indexPatterns = [hostnameOnly(pattern)].filter(Boolean);
            } else {
                indexPatterns = [];
            }
        };

        this.setURLDomainPattern = function (patterns) {
            domainPatterns = Array.isArray(patterns)
                ? patterns
                : (patterns ? [patterns] : []);
        };

        this.getAppliedPatternForUrl = function (url) {
            if (urlPattern && urlPattern.test(url)) {
                return {
                    providerName: name,
                    patternType: 'urlPattern',
                    patternValue: urlPatternSource || urlPattern.source || ''
                };
            }

            if (domainPatterns.length > 0) {
                for (const pattern of domainPatterns) {
                    if (matchDomainPattern(url, [pattern])) {
                        return {
                            providerName: name,
                            patternType: 'domainPatterns',
                            patternValue: pattern
                        };
                    }
                }
            }

            return {
                providerName: name,
                patternType: null,
                patternValue: null
            };
        };

        this.isCanceling = function () {
            return canceling;
        };

        this.matchURL = function (url) {
            if (urlPattern) {
                return urlPattern.test(url) && !(this.matchException(url));
            } else if (domainPatterns.length > 0) {
                return matchDomainPattern(url, domainPatterns) && !(this.matchException(url));
            }
            return false;
        };

        this.matchRequestURL = function (url, request = null) {
            if (urlPattern) {
                urlPattern.lastIndex = 0;
                return urlPattern.test(url) && !(this.matchException(url, request));
            } else if (domainPatterns.length > 0) {
                return matchDomainPattern(url, domainPatterns) && !(this.matchException(url, request));
            }
            return false;
        };

        this.addRule = function (rule, isActive = true, defaults = null) {
            const parsedLinkumoriRule = typeof rule === 'string' ? parseLinkumoriRemoveParamRule(rule) : null;
            if (parsedLinkumoriRule) {
                if (!isActive) return;

                if (parsedLinkumoriRule.isException) {
                    linkumoriRemoveParamExceptions.push(parsedLinkumoriRule);
                } else {
                    linkumoriRemoveParamRules.push(parsedLinkumoriRule);
                }
                return;
            }

            const compiled = compileCoreRuleDefinition(rule, "i", true, defaults);
            if (!compiled || !isActive || compiled.active === false) return;
            const activeCompiled = activateCompiledRule(compiled, 'rules');
            if (!activeCompiled) return;
            fieldRuleMap[activeCompiled.matchPattern] = activeCompiled;
        };

        this.getRulesMap = function () {
            if (!storage.referralMarketing) {
                return Object.assign({}, fieldRuleMap, referralMarketingRuleMap);
            }
            return fieldRuleMap;
        };

        this.addRawRule = function (rule, isActive = true, defaults = null) {
            const compiled = compileCoreRuleDefinition(rule, "gi", false, defaults);
            if (!compiled || !isActive || compiled.active === false) return;
            const activeCompiled = activateCompiledRule(compiled, 'rawRules');
            if (!activeCompiled) return;
            rawRuleMap[activeCompiled.matchPattern] = activeCompiled;
        };

        this.getRawRulesMap = function () {
            return rawRuleMap;
        };

        this.getLinkumoriRemoveParamRules = function () {
            return linkumoriRemoveParamRules.slice();
        };

        this.getLinkumoriRemoveParamExceptions = function () {
            return linkumoriRemoveParamExceptions.slice();
        };

        this.addReferralMarketing = function (rule, isActive = true, defaults = null) {
            const compiled = compileCoreRuleDefinition(rule, "i", true, defaults);
            if (!compiled || !isActive || compiled.active === false) return;
            const activeCompiled = activateCompiledRule(compiled, 'referralMarketing');
            if (!activeCompiled) return;
            referralMarketingRuleMap[activeCompiled.matchPattern] = activeCompiled;
        };

        this.addException = function (exception, isActive = true, defaults = null) {
            const compiled = compileCoreRuleDefinition(exception, "i", false, defaults);
            if (!compiled || !isActive || compiled.active === false) return;
            const activeCompiled = activateCompiledRule(compiled, 'exceptions');
            if (!activeCompiled) return;
            exceptionRuleMap[activeCompiled.matchPattern] = activeCompiled;
        };

        this.addDomainException = function (exception) {
            if (domainExceptionPatterns.indexOf(exception) === -1) {
                domainExceptionPatterns.push(exception);
            }
        };

        this.addMethod = function (method) {
            const normalized = String(method || '').toUpperCase();
            if (normalized && methods.indexOf(normalized) === -1) {
                methods.push(normalized);
            }
        }

        this.getMethods = function () {
            return methods.slice();
        };

        this.matchMethod = function (details) {
            if (!methods.length) return true;
            return methods.indexOf(String(details['method'] || '').toUpperCase()) > -1;
        }

        this.addResourceType = function (resourceType) {
            const normalized = String(resourceType || '').toLowerCase();
            if (normalized && resourceTypes.indexOf(normalized) === -1) {
                resourceTypes.push(normalized);
            }
        };

        this.getResourceTypes = function () {
            return resourceTypes.slice();
        };

        this.matchResourceType = function (details) {
            if (!resourceTypes.length) {
                if (storage.types && storage.types.length > 0) {
                    return storage.types.indexOf(details['type']) > -1;
                }
                return true;
            }
            return resourceTypes.indexOf(String(details['type'] || '').toLowerCase()) > -1;
        };

        this.matchException = function (url, request = null) {
            let result = false;

            if (url === siteBlockedAlert) return true;

            for (const exception in exceptionRuleMap) {
                if (result) break;

                const exceptionRule = exceptionRuleMap[exception];
                const exceptionRegex = exceptionRule && exceptionRule.regex instanceof RegExp
                    ? exceptionRule.regex
                    : (exceptionRule instanceof RegExp ? exceptionRule : new RegExp(exception, "i"));
                if (coreRuleAppliesToRequest(exceptionRule, url, request)) {
                    exceptionRegex.lastIndex = 0;
                    result = exceptionRegex.test(url);
                }
            }

            if (!result && domainExceptionPatterns.length > 0) {
                result = matchDomainPattern(url, domainExceptionPatterns);
            }

            return result;
        };

        this.addRedirection = function (redirection, isActive = true, defaults = null) {
            const compiled = compileCoreRuleDefinition(redirection, "i", false, defaults);
            if (!compiled || !isActive || compiled.active === false) return;
            const activeCompiled = activateCompiledRule(compiled, 'redirections');
            if (!activeCompiled) return;
            redirectionRuleMap[activeCompiled.matchPattern] = activeCompiled;
        };

        this.addDomainRedirection = function (redirection) {
            const normalized = normalizeCoreDomainRedirection(redirection);
            if (normalized && domainRedirectionRules.indexOf(normalized) === -1) {
                domainRedirectionRules.push(normalized);
            }
        };

        this.getRedirection = function (url, request = null) {
            let re = null;

            for (const redirection in redirectionRuleMap) {
                const compiled = redirectionRuleMap[redirection];
                const activeRegex = compiled && compiled.regex instanceof RegExp
                    ? compiled.regex
                    : new RegExp(redirection, "i");
                if (!coreRuleAppliesToRequest(compiled, url, request)) continue;
                activeRegex.lastIndex = 0;
                const captured = activeRegex.exec(url);

                if (captured && captured.length > 0 && redirection) {
                    const values = applyCoreRulePreprocessors(captured.slice(1), compiled.preprocessors);
                    if (compiled.replacePattern !== null && compiled.replacePattern !== '') {
                        re = applyCoreReplacePattern(compiled.replacePattern, values);
                    } else if (captured[1] !== undefined) {
                        re = values[0];
                    }
                    break;
                }
            }            
            if (!re && domainRedirectionRules.length > 0) {
                for (const domainRedirection of domainRedirectionRules) {
                    if (typeof domainRedirection !== 'string' || !domainRedirection.includes('$redirect=')) {
                        continue;
                    }
                    const [pattern, redirectTarget] = domainRedirection.split('$redirect=');
                    if (matchDomainPattern(url, [pattern.trim()])) {
                        re = redirectTarget;
                        break;
                    }
                }
            }

            return re;
        };
    }

    function clearUrl(request) {
        if (typeof isTemporarilyPaused === 'function' && isTemporarilyPaused()) {
            return {};
        }

        if (isWhitelisted(request.url, request)) {
            if (storage.loggingStatus) {
                pushToLog(request.url, request.url, translate('log_whitelist_bypass'), {
                    logCategory: 'feature',
                    requestMethod: request && typeof request.method === 'string' ? request.method : null,
                    requestType: request && typeof request.type === 'string' ? request.type : null,
                    tabId: request && typeof request.tabId === 'number' ? request.tabId : -1
                });
            }
            return {};
        }

        const URLbeforeReplaceCount = countFields(request.url);

        increaseTotalCounter(URLbeforeReplaceCount);

        if (storage.globalStatus) {
            let result = {
                "changes": false,
                "url": "",
                "redirect": false,
                "cancel": false
            };

            if (storage.pingBlocking && storage.pingRequestTypes.includes(request.type)) {
                pushToLog(request.url, request.url, translate('log_ping_blocked'), {
                    logCategory: 'feature',
                    requestMethod: request && typeof request.method === 'string' ? request.method : null,
                    requestType: request && typeof request.type === 'string' ? request.type : null,
                    tabId: request && typeof request.tabId === 'number' ? request.tabId : -1
                });
                increaseBadged(false, request);
                increaseTotalCounter(1);
                return {cancel: true};
            }

            // Collect @@removeparam exceptions from every provider whose URL
            // pattern matches the current page context (documentUrl, originUrl,
            // initiator, stored tab URL, frame ancestors). These cross-provider
            // exceptions are passed into removeFieldsFormURL so that a rule like
            //   @@||gemini.google.com$removeparam=ei
            // suppresses ei removal on ALL requests (facebook.com, map.google.com,
            // etc.) that are loaded from a gemini.google.com page, not just on
            // requests whose destination URL matches gemini.google.com.
            // Context-based exceptions apply only to subrequests (XHR, script,
            // image, etc.) that originate FROM a matched page. For main_frame
            // navigations the documentUrl/initiator/referrer still reference the
            // PREVIOUS page, so collecting context exceptions there would wrongly
            // protect params on the new page just because the user came from a
            // matched URL. e.g. navigating from www.google.com/search to
            // books.google.co.in/?ei=11 would keep ei because the referrer is
            // the search page — but that exception should not apply here.
            const contextUrls = (request.type !== 'main_frame')
                ? requestContextManager.collectContextURLs(request)
                : [];
            const globalLinkumoriExceptions = [];

            // Optimized context provider lookup
            let contextCandidateProviders = new Set(globalProviders);
            for (const ctxUrl of contextUrls) {
                try {
                    const ctxHost = new URL(ctxUrl).hostname;
                    const ctxTokens = ctxHost.split('.').map(t => t.toLowerCase());
                    const seenCtxTokens = new Set();
                    for (const token of ctxTokens) {
                        if (seenCtxTokens.has(token)) continue;
                        seenCtxTokens.add(token);
                        const tokenProviders = providersByToken[token];
                        if (tokenProviders) {
                            for (const p of tokenProviders) {
                                contextCandidateProviders.add(p);
                            }
                        }
                    }
                } catch (e) {}
            }

            for (const provider of contextCandidateProviders) {
                const matchesContext = contextUrls.some(ctxUrl => {
                    try { return provider.matchURL(ctxUrl); } catch (e) { return false; }
                });
                if (matchesContext) {
                    const matchedExceptions = provider.getLinkumoriRemoveParamExceptions().filter((exceptionRule) => {
                        return linkumoriRemoveParamExceptionMatchesContext(exceptionRule, contextUrls, request);
                    });
                    globalLinkumoriExceptions.push(...matchedExceptions);
                }
            }

            // Optimized request provider lookup
            let requestHost = "";
            try {
                requestHost = new URL(request.url).hostname;
            } catch (e) {}
            const requestHostTokens = requestHost.split('.').map(t => t.toLowerCase());

            let requestCandidateProviders = new Set(globalProviders);
            const seenRequestTokens = new Set();
            for (const token of requestHostTokens) {
                if (seenRequestTokens.has(token)) continue;
                seenRequestTokens.add(token);
                const tokenProviders = providersByToken[token];
                if (tokenProviders) {
                    for (const p of tokenProviders) {
                        requestCandidateProviders.add(p);
                    }
                }
            }

            const candidates = Array.from(requestCandidateProviders);
            for (let i = 0; i < candidates.length; i++) {
                const provider = candidates[i];
                if (!provider.matchMethod(request)) continue;
                if (!provider.matchResourceType(request)) continue;
                if (provider.matchRequestURL(request.url, request)) {
                    result = removeFieldsFormURL(provider, request.url, false, request, null, globalLinkumoriExceptions);
                }

                if (result.redirect) {
                    if (provider.shouldForceRedirect() &&
                        request.type === 'main_frame') {
                        browser.tabs.update(request.tabId, {url: result.url}).catch(handleError);
                        return {cancel: true};
                    }

                    return {
                        redirectUrl: result.url
                    };
                }

                if (result.cancel) {
                    if (request.type === 'main_frame') {
                        const blockingPage = browser.runtime.getURL("html/siteBlockedAlert.html?source=" + encodeURIComponent(request.url));
                        browser.tabs.update(request.tabId, {url: blockingPage}).catch(handleError);

                        return {cancel: true};
                    } else {
                        return {
                            redirectUrl: siteBlockedAlert
                        };
                    }
                }

                if (result.changes) {
                    return {
                        redirectUrl: result.url
                    };
                }
            }

            if (typeof globalThis.handleLinkumoriURLFilterRequest === 'function') {
                return globalThis.handleLinkumoriURLFilterRequest(request);
            }
        }

        return {};
    }
}
