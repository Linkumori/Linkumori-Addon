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

var providers = [];
var prvKeys = [];
var siteBlockedAlert = 'javascript:void(0)';
var dataHash;
var localDataHash;
var os;
var initializationComplete = false;
var linkumoriPatternRegexCache = new Map();
var clearurlsWebRequestHandler = null;
var linkumoriURLPatternAnalyzerStats = {
    total: 0,
    tokenized: 0,
    skippedRegexTests: 0,
    regexTests: 0,
    indexedCandidates: 0,
    fallbackCandidates: 0
};
var linkumoriURLPatternProviderIndex = new Map();
var linkumoriURLPatternFallbackProviders = [];
var linkumoriURLPatternFallbackBitset = null;
var linkumoriURLPatternBitsetWords = 0;
var linkumoriURLPatternAutomaton = null;
var linkumoriURLPatternScratchBitset = null;
var pslSupport = {
    status: 'idle',
    parser: null,
    service: null,
    loadPromise: null,
    error: null
};

function getLinkumoriURLPatternAnalyzerToken(regexSource) {
    if (
        !globalThis.LinkumoriRegexTokens ||
        typeof globalThis.LinkumoriRegexTokens.extractBestTokenFromRegex !== 'function'
    ) {
        return '';
    }

    try {
        return String(globalThis.LinkumoriRegexTokens.extractBestTokenFromRegex(regexSource) || '').toLowerCase();
    } catch (e) {
        return '';
    }
}

function getLinkumoriURLPatternAnalyzerTokens(regexSource) {
    if (
        globalThis.LinkumoriRegexTokens &&
        typeof globalThis.LinkumoriRegexTokens.extractURLPatternTokensFromRegex === 'function'
    ) {
        try {
            const tokens = globalThis.LinkumoriRegexTokens.extractURLPatternTokensFromRegex(regexSource);
            if (Array.isArray(tokens) && tokens.length > 0) {
                return tokens
                    .filter(token => typeof token === 'string' && token)
                    .map(token => token.toLowerCase());
            }
        } catch (e) {}
    }
    return [];
}

function getSerializedLinkumoriURLPatternTokens(providerName, urlPatternSource) {
    const selfie = storage &&
        storage.ClearURLsData &&
        storage.ClearURLsData.metadata &&
        storage.ClearURLsData.metadata.urlPatternSelfie;
    const entries = selfie && selfie.entries;
    if (!entries || typeof entries !== 'object') return [];

    const entry = entries[providerName];
    if (!entry || typeof entry !== 'object') return [];
    if (entry.urlPattern !== urlPatternSource) return [];

    if (Array.isArray(entry.tokens)) {
        return entry.tokens
            .filter(token => typeof token === 'string' && token)
            .map(token => token.toLowerCase());
    }

    return [];
}

function getLinkumoriDomainPatternAnalyzerToken(domainPattern) {
    const pattern = String(domainPattern || '').trim().toLowerCase();
    if (!pattern) return '';

    const regex = parseFilterRegexLiteral(pattern);
    if (regex) {
        return getLinkumoriURLPatternAnalyzerToken(regex.source);
    }

    let raw = pattern;
    if (raw.startsWith('||')) raw = raw.slice(2);
    else if (raw.startsWith('|')) raw = raw.slice(1);
    if (raw.endsWith('|')) raw = raw.slice(0, -1);

    const candidates = raw
        .split(/[\*\^|/]+/)
        .map(part => part.replace(/\\([\\^$.*+?()[\]{}|/])/g, '$1'))
        .map(part => part.replace(/[^a-z0-9._%-]+/g, ''))
        .map(part => part.replace(/^\.+|\.+$/g, ''))
        .filter(part => part.length >= 3);

    if (candidates.length === 0) return '';

    candidates.sort((left, right) => {
        const dotDelta = Number(right.includes('.')) - Number(left.includes('.'));
        if (dotDelta !== 0) return dotDelta;
        return right.length - left.length;
    });

    return candidates[0].toLowerCase();
}

function getSerializedLinkumoriDomainPatternTokens(providerName, domainPatterns) {
    const selfie = storage &&
        storage.ClearURLsData &&
        storage.ClearURLsData.metadata &&
        storage.ClearURLsData.metadata.domainPatternSelfie;
    const entries = selfie && selfie.entries;
    if (!entries || typeof entries !== 'object') return [];

    const entry = entries[providerName];
    if (!entry || typeof entry !== 'object' || !Array.isArray(entry.tokens)) return [];

    const normalizedPatterns = Array.isArray(domainPatterns)
        ? domainPatterns.map(pattern => String(pattern || ''))
        : [];
    const serializedPatterns = Array.isArray(entry.domainPatterns)
        ? entry.domainPatterns.map(pattern => String(pattern || ''))
        : [];

    if (
        normalizedPatterns.length !== serializedPatterns.length ||
        normalizedPatterns.some((pattern, index) => pattern !== serializedPatterns[index])
    ) {
        return [];
    }

    return entry.tokens
        .filter(item => item && typeof item.domainPattern === 'string' && typeof item.token === 'string')
        .filter(item => normalizedPatterns.includes(item.domainPattern))
        .map(item => item.token.toLowerCase())
        .filter(Boolean);
}

function collectLinkumoriURLPatternRequestTokens(url) {
    if (
        globalThis.LinkumoriRegexTokens &&
        typeof globalThis.LinkumoriRegexTokens.collectTokensFromText === 'function'
    ) {
        return globalThis.LinkumoriRegexTokens.collectTokensFromText(url);
    }

    return String(url || '')
        .toLowerCase()
        .split(/[^%0-9a-z]+/)
        .filter(token => token.length >= 2);
}

function createLinkumoriURLPatternAutomaton(tokenToProviders) {
    const root = { next: new Map(), fail: null, outputs: [] };

    for (const [token, providerList] of tokenToProviders.entries()) {
        if (!token) continue;
        let node = root;
        for (let i = 0; i < token.length; i++) {
            const ch = token.charAt(i);
            if (!node.next.has(ch)) {
                node.next.set(ch, { next: new Map(), fail: root, outputs: [] });
            }
            node = node.next.get(ch);
        }
        node.outputs.push(providerList);
    }

    const queue = [];
    for (const child of root.next.values()) {
        child.fail = root;
        queue.push(child);
    }

    while (queue.length > 0) {
        const current = queue.shift();
        for (const [ch, child] of current.next.entries()) {
            let fail = current.fail;
            while (fail && fail !== root && !fail.next.has(ch)) {
                fail = fail.fail;
            }
            child.fail = fail && fail.next.has(ch) ? fail.next.get(ch) : root;
            if (child.fail.outputs.length > 0) {
                child.outputs = child.outputs.concat(child.fail.outputs);
            }
            queue.push(child);
        }
    }

    root.fail = root;
    return root;
}

function createLinkumoriProviderBitset() {
    return new Uint32Array(linkumoriURLPatternBitsetWords || 1);
}

function addLinkumoriProviderToBitset(bitset, provider) {
    if (!bitset || !provider || typeof provider.getProviderIndex !== 'function') return;
    const index = provider.getProviderIndex();
    if (index < 0) return;
    bitset[index >>> 5] |= (1 << (index & 31));
}

function orLinkumoriProviderBitset(target, source) {
    if (!target || !source) return;
    const length = Math.min(target.length, source.length);
    for (let i = 0; i < length; i++) {
        target[i] |= source[i];
    }
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

    return prefix === base || prefix === ('www.' + base);
}

function parseFilterRegexLiteral(value) {
    const text = String(value || '').trim();
    if (!text.startsWith('/')) return null;

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
            const source = text.slice(1, i);
            const flags = text.slice(i + 1).replace(/[^dgimsuvy]/g, '');
            try {
                return new RegExp(source, flags.includes('i') ? flags : flags + 'i');
            } catch (e) {
                return null;
            }
        }
    }

    return null;
}

function findLinkumoriModifierStart(ruleText) {
    const text = String(ruleText || '');
    if (!text) return -1;

    if (text.startsWith('/')) {
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
        const literalRegex = parseFilterRegexLiteral(raw);
        if (literalRegex) {
            linkumoriPatternRegexCache.set(cacheKey, literalRegex);
            return literalRegex;
        }

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

        const source = linkumoriTokensToRegexSource(raw);
        const prefix = domainAnchor
            ? '^[A-Za-z][A-Za-z0-9+.-]*:\\/+(?:[^/?#]*\\.)?'
            : (startAnchor ? '^' : '');
        const suffix = endAnchor ? '$' : '';

        let regex = null;
        try {
            regex = new RegExp(prefix + source + suffix, 'i');
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

    function matchWildcardSubdomainAcrossAnyTld(hostname, patternBase) {
        const parsed = parseHostnameWithPsl(hostname);
        if (!parsed || !parsed.tld) return false;

        const suffixToken = '.' + parsed.tld;
        if (!hostname.endsWith(suffixToken)) return false;

        const prefix = hostname.slice(0, -suffixToken.length);
        if (!prefix || prefix === patternBase) return false;
        return prefix.endsWith('.' + patternBase);
    }

    function matchHostPattern(hostname, pattern) {
        if (pslSupport.status !== 'ready') return false;

        const normalizedHost = normalizeAsciiHostname(hostname);
        const rawPattern = String(pattern || '').trim().toLowerCase();
        const trailingDotWildcardTld = rawPattern.endsWith('.') && !rawPattern.endsWith('..');
        const normalizedPattern = trailingDotWildcardTld
            ? rawPattern.slice(0, -1) + '.*'
            : normalizeAsciiHostname(pattern);
        if (!normalizedHost || !normalizedPattern) return false;

        const hostParsed = parseHostnameWithPsl(normalizedHost);
        if (!hostParsed || !hostParsed.tld) return false;

        const wildcardSubdomain = normalizedPattern.startsWith('*.');
        const corePattern = wildcardSubdomain ? normalizedPattern.slice(2) : normalizedPattern;
        if (!corePattern) return false;

        const wildcardTld = corePattern.endsWith('.*');
        const basePattern = corePattern.endsWith('.*')
            ? corePattern.slice(0, -2)
            : corePattern;
        if (!basePattern) return false;

        if (wildcardTld && wildcardSubdomain) {
            return matchWildcardSubdomainAcrossAnyTld(normalizedHost, basePattern);
        }

        if (wildcardTld) {
            return matchRootDomainWildcardTldWithPsl(normalizedHost, basePattern + '.*');
        }

        const patternParsed = parseHostnameWithPsl(basePattern);
        if (!patternParsed || !patternParsed.tld) return false;

        if (wildcardSubdomain) {
            return normalizedHost !== basePattern && normalizedHost.endsWith('.' + basePattern);
        }

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
            const p = String(pattern || '').trim().toLowerCase();
            if (!p) return false;

            if (p.startsWith('||')) {
                const structured = matchStructuredDomainAnchorPattern(p, urlObj, hostname);
                if (structured !== null) {
                    return structured;
                }
            }

            const regex = compileLinkumoriRegex(p);
            if (regex) {
                return regex.test(fullUrl);
            }

            return fullUrl.includes(p);
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

function parseFilterDomainRedirection(ruleText) {
    const rawRule = String(ruleText || '').trim();
    if (!rawRule || rawRule.startsWith('!') || rawRule.startsWith('[')) return null;

    let candidate = rawRule;
    let isException = false;
    if (candidate.startsWith('@@')) {
        isException = true;
        candidate = candidate.slice(2);
    }

    const modifierStart = findLinkumoriModifierStart(candidate);
    if (modifierStart === -1) return null;

    const pattern = candidate.slice(0, modifierStart).trim() || '*';
    const modifiers = splitLinkumoriModifiers(candidate.slice(modifierStart + 1));
    let redirectTarget = null;
    let hasRedirect = false;

    modifiers.forEach((modifier) => {
        const normalized = modifier.toLowerCase();
        if (
            normalized === 'redirect' ||
            normalized === 'redirect-rule' ||
            normalized.startsWith('redirect=') ||
            normalized.startsWith('redirect-rule=') ||
            normalized.startsWith('rewrite=')
        ) {
            hasRedirect = true;
            if (modifier.includes('=')) {
                redirectTarget = modifier.slice(modifier.indexOf('=') + 1).trim();
                const priorityIndex = redirectTarget.lastIndexOf(':');
                if (priorityIndex > -1 && /^\d+$/.test(redirectTarget.slice(priorityIndex + 1))) {
                    redirectTarget = redirectTarget.slice(0, priorityIndex);
                }
            }
        }
    });

    if (!hasRedirect) return null;

    return {
        raw: rawRule,
        isException,
        pattern,
        redirectTarget: redirectTarget || null
    };
}

function analyzeRemoveParamRegex(regexSource) {
    const source = String(regexSource || '');
    const RegexAnalyzer = globalThis.Regex;

    if (!RegexAnalyzer || typeof RegexAnalyzer.Analyzer !== 'function') {
        return {
            ok: true,
            token: ''
        };
    }

    try {
        RegexAnalyzer.Analyzer(source, false).tree();
    } catch (e) {
        return {
            ok: false,
            token: ''
        };
    }

    return {
        ok: true,
        token: globalThis.LinkumoriRegexTokens &&
            typeof globalThis.LinkumoriRegexTokens.extractBestTokenFromRegex === 'function'
            ? globalThis.LinkumoriRegexTokens.extractBestTokenFromRegex(source)
            : ''
    };
}

function parseRemoveParamRegex(value) {
    const text = String(value || '').trim();
    if (!text.startsWith('/')) return null;

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
            const source = text.slice(1, i);
            const rawFlags = text.slice(i + 1);
            const flags = rawFlags.includes('i') ? 'i' : '';
            const analysis = analyzeRemoveParamRegex(source);
            if (!analysis.ok) return null;

            try {
                return {
                    regex: new RegExp(source, flags),
                    source,
                    flags,
                    token: analysis.token
                };
            } catch (e) {
                return null;
            }
        }
    }

    return null;
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

    const modifierStart = findLinkumoriModifierStart(candidate);
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
        if (
            normalized === 'removeparam' ||
            normalized.startsWith('removeparam=') ||
            normalized === 'queryprune' ||
            normalized.startsWith('queryprune=')
        ) {
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

        const parsedRegex = parseRemoveParamRegex(value);
        if (parsedRegex) {
            parsed.regexParam = parsedRegex.regex;
            parsed.regexSource = parsedRegex.source;
            parsed.regexToken = parsedRegex.token;
        } else if (value.startsWith('/')) {
            return null;
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

    if (
        linkumoriRule.urlPattern &&
        linkumoriRule.urlPattern !== '*' &&
        !matchDomainPattern(fullUrl, [linkumoriRule.urlPattern])
    ) {
        return false;
    }

    let urlHost = '';
    try {
        urlHost = normalizeAsciiHostname(new URL(fullUrl).hostname) || '';
    } catch (e) {
        return false;
    }

    if (linkumoriRule.includeDomains.length > 0) {
        const hasIncluded = linkumoriRule.includeDomains.some((pattern) => {
            return matchFilterDomainModifierHostname(urlHost, pattern);
        });
        if (!hasIncluded) return false;
    }

    if (linkumoriRule.excludeDomains.length > 0) {
        const hasExcluded = linkumoriRule.excludeDomains.some((pattern) => {
            return matchFilterDomainModifierHostname(urlHost, pattern);
        });
        if (hasExcluded) return false;
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

function matchFilterDomainModifierHostname(hostname, pattern) {
    const normalizedHost = normalizeAsciiHostname(hostname);
    const rawPattern = String(pattern || '').trim().toLowerCase();
    if (!normalizedHost || !rawPattern) return false;

    const regex = parseFilterRegexLiteral(rawPattern);
    if (regex) return regex.test(normalizedHost);

    const domainPattern = '||' + rawPattern;
    return matchDomainPattern('https://' + normalizedHost + '/', [domainPattern]) ||
        matchDomainPattern('http://' + normalizedHost + '/', [domainPattern]);
}

function linkumoriRemoveParamMatchesName(linkumoriRule, fieldName, fieldValue = '') {
    if (!linkumoriRule || !fieldName) return false;
    if (linkumoriRule.removeAll) return true;

    const paramName = String(fieldName).toLowerCase();
    const paramValue = String(fieldValue || '').toLowerCase();
    const normalizedParamPair = paramName + '=' + paramValue;
    let matched = false;

    if (linkumoriRule.regexParam) {
        linkumoriRule.regexParam.lastIndex = 0;
        matched = linkumoriRule.regexParam.test(normalizedParamPair);
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

function resolveLinkumoriParamDecision(fieldName, activeRules, activeExceptions, fieldValue = '') {
    const normalizedFieldName = String(fieldName || '').toLowerCase();
    if (!normalizedFieldName) {
        return {
            handled: false,
            remove: false,
            matchedRule: null
        };
    }

    const matchedException = (activeExceptions || []).find((linkumoriRule) => {
        return linkumoriRemoveParamMatchesName(linkumoriRule, normalizedFieldName, fieldValue);
    });

    if (matchedException) {
        return {
            handled: true,
            remove: false,
            matchedRule: matchedException.raw || null
        };
    }

    const matchedRule = (activeRules || []).find((linkumoriRule) => {
        return linkumoriRemoveParamMatchesName(linkumoriRule, normalizedFieldName, fieldValue);
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



function isHostnameWhitelisted(hostname) {
    if (!storage.userWhitelist || storage.userWhitelist.length === 0) {
        return false;
    }

    const normalizedHostname = String(hostname || '').toLowerCase().trim();
    if (!normalizedHostname) {
        return false;
    }

    return storage.userWhitelist.some((pattern) => {
        return matchWhitelistHostnamePattern(normalizedHostname, pattern);
    });
}

function matchWhitelistHostnamePattern(hostname, pattern) {
    const normalizedHostname = normalizeAsciiHostname(hostname);
    if (!normalizedHostname) return false;

    const rawPattern = String(pattern || '').toLowerCase().trim();
    if (!rawPattern) return false;

    const cleanPattern = normalizeAsciiHostname(rawPattern.startsWith('||') ? rawPattern.slice(2).replace(/\^$/, '') : rawPattern);
    if (!cleanPattern) return false;

    // PSL-aware any-TLD wildcard: example.* or *.example.*
    if (cleanPattern.endsWith('.*')) {
        const parsed = parseHostnameWithPsl(normalizedHostname);
        if (!parsed || !parsed.tld) return false;

        const suffixToken = '.' + parsed.tld;
        if (!normalizedHostname.endsWith(suffixToken)) return false;

        const beforeSuffix = normalizedHostname.slice(0, -suffixToken.length);
        if (!beforeSuffix) return false;

        if (cleanPattern.startsWith('*.')) {
            const base = cleanPattern.slice(2, -2);
            if (!base) return false;
            return beforeSuffix.endsWith('.' + base);
        }

        const base = cleanPattern.slice(0, -2);
        if (!base) return false;
        return beforeSuffix === base || beforeSuffix.endsWith('.' + base);
    }

    // Existing wildcard host behavior: *.example.com includes root + subdomains.
    if (cleanPattern.startsWith('*.')) {
        const baseDomain = cleanPattern.slice(2);
        if (!baseDomain) return false;
        return normalizedHostname === baseDomain || normalizedHostname.endsWith('.' + baseDomain);
    }

    return normalizedHostname === cleanPattern || normalizedHostname.endsWith('.' + cleanPattern);
}

function isUrlWhitelisted(url) {
    if (!url || typeof url !== 'string') return false;

    try {
        const urlObj = new URL(url);
        const hostname = urlObj.hostname.toLowerCase();
        return isHostnameWhitelisted(hostname);
    } catch (e) {
        return false;
    }
}

function isWhitelisted(url, requestDetails = null) {
    if (!storage.userWhitelist || storage.userWhitelist.length === 0) {
        return false;
    }

    if (isUrlWhitelisted(url)) {
        return true;
    }

    const contextUrls = requestContextManager.collectContextURLs(requestDetails);
    return contextUrls.some((contextUrl) => isUrlWhitelisted(contextUrl));
}

function removeFieldsFormURL(provider, pureUrl, quiet = false, request = null, traceCollector = null) {
    let url = pureUrl;
    let domain = "";
    let fragments = "";
    let fields = "";
    let rules = provider.getRules();
    let linkumoriParamRules = provider.getLinkumoriRemoveParamRules();
    let linkumoriParamExceptions = provider.getLinkumoriRemoveParamExceptions();
    let changes = false;
    let actionType = null;
    let matchedRuleForTrace = null;
    let rawRules = provider.getRawRules();
    let urlObject = new URL(url);
    const providerMatch = {
        ...provider.getAppliedPatternForUrl(pureUrl),
        logCategory: 'provider',
        providerMethods: provider.getMethods(),
        providerResourceTypes: provider.getResourceTypes(),
        requestMethod: request && typeof request.method === 'string' ? request.method : null,
        requestType: request && typeof request.type === 'string' ? request.type : null
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

    let re = storage.redirectionEnabled ? provider.getRedirection(url) : null;
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

    if (provider.isCaneling() && storage.domainBlocking) {
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

    rawRules.forEach(function (rawRule) {
        let beforeReplace = url;
        url = url.replace(new RegExp(rawRule, "gi"), "");

        if (beforeReplace !== url) {
            if (storage.loggingStatus && !quiet) {
                pushToLog(beforeReplace, url, rawRule, providerMatch);
            }

            increaseBadged(false, request);
            changes = true;
            if (!actionType) {
                actionType = 'raw_rule';
            }
            if (!matchedRuleForTrace) {
                matchedRuleForTrace = rawRule;
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
        const activeLinkumoriExceptions = evaluateLinkumoriRemoveParamRules(
            url,
            linkumoriParamExceptions,
            request
        );
        const linkumoriDecisionCache = new Map();
        const getLinkumoriDecision = (paramName, paramValue = '') => {
            const cacheKey = String(paramName || '').toLowerCase() + '\x00' + String(paramValue || '').toLowerCase();
            if (linkumoriDecisionCache.has(cacheKey)) {
                return linkumoriDecisionCache.get(cacheKey);
            }

            const decision = resolveLinkumoriParamDecision(
                paramName,
                activeLinkumoriRules,
                activeLinkumoriExceptions,
                paramValue
            );
            linkumoriDecisionCache.set(cacheKey, decision);
            return decision;
        };

        rules.forEach(rule => {
            const beforeFields = fields.toString();
            const beforeFragments = fragments.toString();
            let localChange = false;

            const fieldsToDelete = [];
            for (const field of fields.keys()) {
                const decision = getLinkumoriDecision(field);
                if (decision.handled) continue;

                if (new RegExp("^"+rule+"$", "gi").test(field)) {
                    fieldsToDelete.push(field);
                    localChange = true;
                }
            }
            fieldsToDelete.forEach(field => fields.delete(field));

            const fragmentsToDelete = [];
            for (const fragment of fragments.keys()) {
                const decision = getLinkumoriDecision(fragment);
                if (decision.handled) continue;

                if (new RegExp("^"+rule+"$", "gi").test(fragment)) {
                    fragmentsToDelete.push(fragment);
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
                    matchedRuleForTrace = rule;
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

            const fieldsToKeepByDeletedName = new Map();
            const fieldNamesWithRemoval = new Set();
            for (const [field, value] of fields.entries()) {
                if (!fieldsToKeepByDeletedName.has(field)) {
                    fieldsToKeepByDeletedName.set(field, []);
                }
                const decision = getLinkumoriDecision(field, value);
                if (decision.remove) {
                    fieldNamesWithRemoval.add(field);
                    localChange = true;
                    if (!matchedRuleForLog && decision.matchedRule) {
                        matchedRuleForLog = decision.matchedRule;
                    }
                } else {
                    fieldsToKeepByDeletedName.get(field).push(value);
                }
            }
            fieldNamesWithRemoval.forEach((field) => {
                const valuesToKeep = fieldsToKeepByDeletedName.get(field) || [];
                fields.delete(field);
                valuesToKeep.forEach((value) => fields.append(field, value));
            });

            const fragmentsToKeepByDeletedName = new Map();
            const fragmentNamesWithRemoval = new Set();
            for (const [fragment, value] of fragments.entries()) {
                if (!fragmentsToKeepByDeletedName.has(fragment)) {
                    fragmentsToKeepByDeletedName.set(fragment, []);
                }
                const decision = getLinkumoriDecision(fragment, value);
                if (decision.remove) {
                    fragmentNamesWithRemoval.add(fragment);
                    localChange = true;
                    if (!matchedRuleForLog && decision.matchedRule) {
                        matchedRuleForLog = decision.matchedRule;
                    }
                } else {
                    fragmentsToKeepByDeletedName.get(fragment).push(value);
                }
            }
            fragmentNamesWithRemoval.forEach((fragment) => {
                const valuesToKeep = fragmentsToKeepByDeletedName.get(fragment) || [];
                fragments.delete(fragment);
                valuesToKeep.forEach((value) => fragments.append(fragment, value));
            });

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

        url = finalURL.replace(new RegExp("\\?&"), "?").replace(new RegExp("#&"), "#");
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
        linkumoriURLPatternProviderIndex = new Map();
        linkumoriURLPatternFallbackProviders = [];
        linkumoriURLPatternFallbackBitset = null;
        linkumoriURLPatternBitsetWords = 0;
        linkumoriURLPatternAutomaton = null;
        linkumoriURLPatternScratchBitset = null;
        linkumoriURLPatternAnalyzerStats.total = 0;
        linkumoriURLPatternAnalyzerStats.tokenized = 0;
        linkumoriURLPatternAnalyzerStats.skippedRegexTests = 0;
        linkumoriURLPatternAnalyzerStats.regexTests = 0;
        linkumoriURLPatternAnalyzerStats.indexedCandidates = 0;
        linkumoriURLPatternAnalyzerStats.fallbackCandidates = 0;

        for (let p = 0; p < prvKeys.length; p++) {
            providers.push(new Provider(prvKeys[p], data.providers[prvKeys[p]].getOrDefault('completeProvider', false),
                data.providers[prvKeys[p]].getOrDefault('forceRedirection', false)));

            let urlPattern = data.providers[prvKeys[p]].getOrDefault('urlPattern', '');
            let domainPatterns = data.providers[prvKeys[p]].getOrDefault('domainPatterns', []);
            
            if (urlPattern) {
                providers[p].setURLPattern(urlPattern);
            } else if (domainPatterns.length > 0) {
                providers[p].setURLDomainPattern(domainPatterns);
            }

            let rules = data.providers[prvKeys[p]].getOrDefault('rules', []);
            for (let r = 0; r < rules.length; r++) {
                providers[p].addRule(rules[r]);
            }

            let rawRules = data.providers[prvKeys[p]].getOrDefault('rawRules', []);
            for (let raw = 0; raw < rawRules.length; raw++) {
                providers[p].addRawRule(rawRules[raw]);
            }

            let referralMarketingRules = data.providers[prvKeys[p]].getOrDefault('referralMarketing', []);
            for (let referralMarketing = 0; referralMarketing < referralMarketingRules.length; referralMarketing++) {
                providers[p].addReferralMarketing(referralMarketingRules[referralMarketing]);
            }

            let exceptions = data.providers[prvKeys[p]].getOrDefault('exceptions', []);
            for (let e = 0; e < exceptions.length; e++) {
                providers[p].addException(exceptions[e]);
            }
            
            let domainExceptions = data.providers[prvKeys[p]].getOrDefault('domainExceptions', []);
            for (let ude = 0; ude < domainExceptions.length; ude++) {
                providers[p].addDomainException(domainExceptions[ude]);
            }

            let redirections = data.providers[prvKeys[p]].getOrDefault('redirections', []);
            for (let re = 0; re < redirections.length; re++) {
                providers[p].addRedirection(redirections[re]);
            }
            
            let domainRedirections = data.providers[prvKeys[p]].getOrDefault('domainRedirections', []);
            for (let udr = 0; udr < domainRedirections.length; udr++) {
                providers[p].addDomainRedirection(domainRedirections[udr]);
            }

            let methods = data.providers[prvKeys[p]].getOrDefault('methods', []);
            for (let re = 0; re < methods.length; re++) {
                providers[p].addMethod(methods[re]);
            }

            let resourceTypes = data.providers[prvKeys[p]].getOrDefault('resourceTypes', []);
            for (let rt = 0; rt < resourceTypes.length; rt++) {
                providers[p].addResourceType(resourceTypes[rt]);
            }

            providers[p].setProviderIndex(p);
            indexProviderForURLPattern(providers[p]);
        }

        convertURLPatternProviderIndexToBitsets();
        linkumoriURLPatternAutomaton = createLinkumoriURLPatternAutomaton(linkumoriURLPatternProviderIndex);
    }

    function indexProviderForURLPattern(provider) {
        const tokens = provider && typeof provider.getURLPatternAnalyzerTokens === 'function'
            ? provider.getURLPatternAnalyzerTokens()
            : [];

        if (!Array.isArray(tokens) || tokens.length === 0) {
            linkumoriURLPatternFallbackProviders.push(provider);
            return;
        }

        for (const token of tokens) {
            if (!token) continue;
            if (!linkumoriURLPatternProviderIndex.has(token)) {
                linkumoriURLPatternProviderIndex.set(token, []);
            }
            linkumoriURLPatternProviderIndex.get(token).push(provider);
        }
    }

    function convertURLPatternProviderIndexToBitsets() {
        linkumoriURLPatternBitsetWords = Math.max(1, Math.ceil(providers.length / 32));
        linkumoriURLPatternFallbackBitset = createLinkumoriProviderBitset();
        linkumoriURLPatternScratchBitset = createLinkumoriProviderBitset();

        for (const provider of linkumoriURLPatternFallbackProviders) {
            addLinkumoriProviderToBitset(linkumoriURLPatternFallbackBitset, provider);
        }

        for (const [token, providerList] of linkumoriURLPatternProviderIndex.entries()) {
            const bitset = createLinkumoriProviderBitset();
            for (const provider of providerList) {
                addLinkumoriProviderToBitset(bitset, provider);
            }
            linkumoriURLPatternProviderIndex.set(token, bitset);
        }
    }

    function forEachURLPatternCandidateProvider(url, callback) {
        if (!linkumoriURLPatternAutomaton || !linkumoriURLPatternProviderIndex || linkumoriURLPatternProviderIndex.size === 0) {
            for (let i = 0; i < providers.length; i++) {
                callback(providers[i]);
            }
            return providers.length;
        }

        const candidateBits = linkumoriURLPatternScratchBitset || createLinkumoriProviderBitset();
        if (linkumoriURLPatternFallbackBitset) {
            candidateBits.set(linkumoriURLPatternFallbackBitset);
        } else {
            candidateBits.fill(0);
        }

        const lowerUrl = String(url || '').toLowerCase();
        let node = linkumoriURLPatternAutomaton;

        for (let i = 0; i < lowerUrl.length; i++) {
            const ch = lowerUrl.charAt(i);
            while (node !== linkumoriURLPatternAutomaton && !node.next.has(ch)) {
                node = node.fail;
            }
            if (node.next.has(ch)) {
                node = node.next.get(ch);
            }
            if (node.outputs.length === 0) continue;

            for (let o = 0; o < node.outputs.length; o++) {
                orLinkumoriProviderBitset(candidateBits, node.outputs[o]);
            }
        }

        let candidateCount = 0;
        for (let wordIndex = 0; wordIndex < candidateBits.length; wordIndex++) {
            let word = candidateBits[wordIndex];
            while (word !== 0) {
                const bit = word & -word;
                const bitIndex = 31 - Math.clz32(bit);
                const providerIndex = (wordIndex << 5) + bitIndex;
                if (providerIndex < providers.length) {
                    candidateCount++;
                    callback(providers[providerIndex]);
                }
                word ^= bit;
            }
        }

        linkumoriURLPatternAnalyzerStats.indexedCandidates += Math.max(0, candidateCount - linkumoriURLPatternFallbackProviders.length);
        linkumoriURLPatternAnalyzerStats.fallbackCandidates += linkumoriURLPatternFallbackProviders.length;
        return candidateCount;
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
            prvKeys = [];
            return false;
        }

        getKeys(storage.ClearURLsData.providers);
        createProviders();
        return true;
    }

    function setupWebRequestListener() {
        if (clearurlsWebRequestHandler && browser.webRequest.onBeforeRequest.hasListener(clearurlsWebRequestHandler)) {
            return;
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
                return clearUrl(requestDetails);
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

    function Provider(_name, _completeProvider = false, _forceRedirection = false, _isActive = true) {
        let name = _name;
        let urlPattern;
        let urlPatternSource = '';
        let urlPatternAnalyzerTokens = [];
        let urlPatternAlwaysMatches = false;
        let domainPatternAnalyzerTokens = [];
        let providerIndex = 0;
        let domainPatterns = [];
        let enabled_rules = {};
        let disabled_rules = {};
        let enabled_exceptions = {};
        let disabled_exceptions = {};
        let enabled_domain_exceptions = [];
        let enabled_domain_redirections = [];
        let canceling = _completeProvider;
        let enabled_redirections = {};
        let disabled_redirections = {};
        let active = _isActive;
        let enabled_rawRules = {};
        let disabled_rawRules = {};
        let enabled_referralMarketing = {};
        let disabled_referralMarketing = {};
        let enabled_linkumoriRemoveParamRules = [];
        let enabled_linkumoriRemoveParamExceptions = [];
        let methods = [];
        let resourceTypes = [];

        if (_completeProvider) {
            enabled_rules[".*"] = true;
        }

        this.shouldForceRedirect = function () {
            return _forceRedirection;
        };

        this.getName = function () {
            return name;
        };

        this.setProviderIndex = function (index) {
            providerIndex = Number(index) || 0;
        };

        this.getProviderIndex = function () {
            return providerIndex;
        };

        this.getURLPatternAnalyzerTokens = function () {
            const tokens = [];
            for (const token of urlPatternAnalyzerTokens) {
                if (token) tokens.push(token);
            }
            for (const token of domainPatternAnalyzerTokens) {
                if (token) tokens.push(token);
            }
            return [...new Set(tokens)];
        };

        this.setURLPattern = function (urlPatterns) {
            urlPatternSource = urlPatterns || '';
            urlPattern = new RegExp(urlPatterns, "i");
            urlPatternAlwaysMatches = urlPattern.source === '.*' || urlPatternSource === '.*';
            urlPatternAnalyzerTokens =
                getSerializedLinkumoriURLPatternTokens(name, urlPatternSource);
            if (urlPatternAnalyzerTokens.length === 0) {
                urlPatternAnalyzerTokens =
                    getLinkumoriURLPatternAnalyzerTokens(urlPattern.source || urlPatternSource);
            }
            urlPatternAnalyzerTokens = [...new Set(urlPatternAnalyzerTokens)];
            linkumoriURLPatternAnalyzerStats.total++;
            if (urlPatternAnalyzerTokens.length > 0) linkumoriURLPatternAnalyzerStats.tokenized++;
        };

        this.setURLDomainPattern = function (patterns) {
            domainPatterns = patterns || [];
            domainPatternAnalyzerTokens =
                getSerializedLinkumoriDomainPatternTokens(name, domainPatterns);

            if (domainPatternAnalyzerTokens.length === 0) {
                domainPatternAnalyzerTokens = domainPatterns
                    .map(pattern => getLinkumoriDomainPatternAnalyzerToken(pattern))
                    .filter(Boolean);
            }

            domainPatternAnalyzerTokens = [...new Set(domainPatternAnalyzerTokens)];
            linkumoriURLPatternAnalyzerStats.total++;
            if (domainPatternAnalyzerTokens.length > 0) linkumoriURLPatternAnalyzerStats.tokenized++;
        };

        this.testURLPattern = function (url) {
            if (!urlPattern) return false;
            if (urlPatternAlwaysMatches) return true;

            linkumoriURLPatternAnalyzerStats.regexTests++;
            urlPattern.lastIndex = 0;
            return urlPattern.test(url);
        };

        this.getAppliedPatternForUrl = function (url) {
            if (urlPattern && this.testURLPattern(url)) {
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

        this.isCaneling = function () {
            return canceling;
        };

        this.matchURL = function (url) {
            if (urlPattern) {
                return this.testURLPattern(url) && !(this.matchException(url));
            } else if (domainPatterns.length > 0) {
                return matchDomainPattern(url, domainPatterns) && !(this.matchException(url));
            }
            return false;
        };

        this.applyRule = (enabledRuleArray, disabledRulesArray, rule, isActive = true) => {
            if (isActive) {
                enabledRuleArray[rule] = true;

                if (disabledRulesArray[rule] !== undefined) {
                    delete disabledRulesArray[rule];
                }
            } else {
                disabledRulesArray[rule] = true;

                if (enabledRuleArray[rule] !== undefined) {
                    delete enabledRuleArray[rule];
                }
            }
        };

        this.addRule = function (rule, isActive = true) {
            const parsedLinkumoriRule = parseLinkumoriRemoveParamRule(rule);
            if (parsedLinkumoriRule) {
                if (!isActive) return;

                if (parsedLinkumoriRule.isException) {
                    enabled_linkumoriRemoveParamExceptions.push(parsedLinkumoriRule);
                } else {
                    enabled_linkumoriRemoveParamRules.push(parsedLinkumoriRule);
                }
                return;
            }

            this.applyRule(enabled_rules, disabled_rules, rule, isActive);
        };

        this.getRules = function () {
            if (!storage.referralMarketing) {
                return Object.keys(Object.assign(enabled_rules, enabled_referralMarketing));
            }

            return Object.keys(enabled_rules);
        };

        this.addRawRule = function (rule, isActive = true) {
            this.applyRule(enabled_rawRules, disabled_rawRules, rule, isActive);
        };

        this.getRawRules = function () {
            return Object.keys(enabled_rawRules);
        };

        this.getLinkumoriRemoveParamRules = function () {
            return enabled_linkumoriRemoveParamRules.slice();
        };

        this.getLinkumoriRemoveParamExceptions = function () {
            return enabled_linkumoriRemoveParamExceptions.slice();
        };

        this.addReferralMarketing = function (rule, isActive = true) {
            this.applyRule(enabled_referralMarketing, disabled_referralMarketing, rule, isActive);
        };

        this.addException = function (exception, isActive = true) {
            if (isActive) {
                enabled_exceptions[exception] = true;

                if (disabled_exceptions[exception] !== undefined) {
                    delete disabled_exceptions[exception];
                }
            } else {
                disabled_exceptions[exception] = true;

                if (enabled_exceptions[exception] !== undefined) {
                    delete enabled_exceptions[exception];
                }
            }
        };

        this.addDomainException = function (exception) {
            if (enabled_domain_exceptions.indexOf(exception) === -1) {
                enabled_domain_exceptions.push(exception);
            }
        };

        this.addMethod = function (method) {
            if (methods.indexOf(method) === -1) {
                methods.push(method);
            }
        }

        this.getMethods = function () {
            return methods.slice();
        };

        this.matchMethod = function (details) {
            if (!methods.length) return true;
            return methods.indexOf(details['method']) > -1;
        }

        this.addResourceType = function (resourceType) {
            if (resourceTypes.indexOf(resourceType) === -1) {
                resourceTypes.push(resourceType);
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
            return resourceTypes.indexOf(details['type']) > -1;
        };

        this.matchException = function (url) {
            let result = false;

            if (url === siteBlockedAlert) return true;

            for (const exception in enabled_exceptions) {
                if (result) break;

                let exception_regex = new RegExp(exception, "i");
                result = exception_regex.test(url);
            }
            
            if (!result && enabled_domain_exceptions.length > 0) {
                result = matchDomainPattern(url, enabled_domain_exceptions);
            }

            return result;
        };

        this.addRedirection = function (redirection, isActive = true) {
            if (isActive) {
                enabled_redirections[redirection] = true;

                if (disabled_redirections[redirection] !== undefined) {
                    delete disabled_redirections[redirection];
                }
            } else {
                disabled_redirections[redirection] = true;

                if (enabled_redirections[redirection] !== undefined) {
                    delete enabled_redirections[redirection];
                }
            }
        };

        this.addDomainRedirection = function (redirection) {
            if (enabled_domain_redirections.indexOf(redirection) === -1) {
                enabled_domain_redirections.push(redirection);
            }
        };

        this.getRedirection = function (url) {
            let re = null;

            for (const redirection in enabled_redirections) {
                let result = (url.match(new RegExp(redirection, "i")));

                if (result && result.length > 0 && redirection) {
                    re = (new RegExp(redirection, "i")).exec(url)[1];

                    break;
                }
            }
            
            if (!re && enabled_domain_redirections.length > 0) {
                const matchingRedirectExceptions = enabled_domain_redirections
                    .map(parseFilterDomainRedirection)
                    .filter((rule) => rule && rule.isException && matchDomainPattern(url, [rule.pattern]));

                for (const domainRedirection of enabled_domain_redirections) {
                    const parsedDomainRedirection = parseFilterDomainRedirection(domainRedirection);
                    if (!parsedDomainRedirection || parsedDomainRedirection.isException) continue;

                    if (
                        parsedDomainRedirection.redirectTarget &&
                        matchDomainPattern(url, [parsedDomainRedirection.pattern]) &&
                        !matchingRedirectExceptions.some((exceptionRule) => {
                            return !exceptionRule.redirectTarget ||
                                exceptionRule.redirectTarget === parsedDomainRedirection.redirectTarget;
                        })
                    ) {
                        re = parsedDomainRedirection.redirectTarget;
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
                    requestType: request && typeof request.type === 'string' ? request.type : null
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
                    requestType: request && typeof request.type === 'string' ? request.type : null
                });
                increaseBadged(false, request);
                increaseTotalCounter(1);
                return {cancel: true};
            }

            let providerResponse = null;
            const candidateProviderCount = forEachURLPatternCandidateProvider(request.url, provider => {
                if (providerResponse) return;

                if (!provider.matchMethod(request)) return;
                if (!provider.matchResourceType(request)) return;
                if (provider.matchURL(request.url)) {
                    result = removeFieldsFormURL(provider, request.url, false, request);
                }

                if (result.redirect) {
                    if (provider.shouldForceRedirect() &&
                        request.type === 'main_frame') {
                        browser.tabs.update(request.tabId, {url: result.url}).catch(handleError);
                        providerResponse = {cancel: true};
                        return;
                    }

                    providerResponse = {
                        redirectUrl: result.url
                    };
                    return;
                }

                if (result.cancel) {
                    if (request.type === 'main_frame') {
                        const blockingPage = browser.runtime.getURL("html/siteBlockedAlert.html?source=" + encodeURIComponent(request.url));
                        browser.tabs.update(request.tabId, {url: blockingPage}).catch(handleError);

                        providerResponse = {cancel: true};
                        return;
                    } else {
                        providerResponse = {
                            redirectUrl: siteBlockedAlert
                        };
                        return;
                    }
                }

                if (result.changes) {
                    providerResponse = {
                        redirectUrl: result.url
                    };
                    return;
                }
            });
            linkumoriURLPatternAnalyzerStats.skippedRegexTests += Math.max(0, providers.length - candidateProviderCount);

            if (providerResponse) return providerResponse;

            if (typeof globalThis.handleLinkumoriURLFilterRequest === 'function') {
                return globalThis.handleLinkumoriURLFilterRequest(request);
            }
        }

        return {};
    }
}
