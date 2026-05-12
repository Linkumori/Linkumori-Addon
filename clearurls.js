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
var domainPatternTrie = typeof LinkumoriHNTrie === 'function' ? new LinkumoriHNTrie() : null; // HNTrie for O(L) domain matching
var globalProviders = []; // Provider[]
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


// FIX: extraExceptions — cross-provider context exceptions collected in clearUrl()
// and injected directly into activeLinkumoriExceptions, bypassing the URL-pattern
// re-check in evaluateLinkumoriRemoveParamRules. They are already pre-qualified by
// page context (documentUrl / originUrl / tab URL) in clearUrl(), so filtering them
// again by the request URL would incorrectly discard them — e.g. the exception
// @@||gemini.google.com$removeparam=ei must stay active for requests to google.com,
// facebook.com, map.google.com, etc. that originate from a gemini.google.com page.
function removeFieldsFormURL(provider, pureUrl, quiet = false, request = null, traceCollector = null, extraExceptions = []) {
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

    const rawRulesMap = provider.getRawRulesMap();
    Object.keys(rawRulesMap).forEach(function (rawRuleStr) {
        const regex = rawRulesMap[rawRuleStr];
        const activeRegex = regex instanceof RegExp ? regex : new RegExp(rawRuleStr, "gi");
        let beforeReplace = url;
        url = url.replace(activeRegex, "");

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
                matchedRuleForTrace = rawRuleStr;
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
            const regex = rulesMap[rule];
            const activeRegex = regex instanceof RegExp ? regex : new RegExp("^"+rule+"$", "gi");
            const beforeFields = fields.toString();
            const beforeFragments = fragments.toString();
            let localChange = false;

            const fieldsToDelete = [];
            for (const field of fields.keys()) {
                const decision = getLinkumoriDecision(field);
                // Only skip when $removeparam is actively removing this field.
                // An exception (handled:true, remove:false) must not suppress
                // independent regex rules — @@$removeparam only excepts that system.
                if (decision.handled && decision.remove) continue;

                if (activeRegex.test(field)) {
                    fieldsToDelete.push(field);
                    localChange = true;
                }
            }
            fieldsToDelete.forEach(field => fields.delete(field));

            const fragmentsToDelete = [];
            for (const fragment of fragments.keys()) {
                const decision = getLinkumoriDecision(fragment);
                if (decision.handled && decision.remove) continue;

                if (activeRegex.test(fragment)) {
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
            providers.push(new Provider(prvKeys[p], data.providers[prvKeys[p]].getOrDefault('completeProvider', false),
                data.providers[prvKeys[p]].getOrDefault('forceRedirection', false)));

            let urlPattern = data.providers[prvKeys[p]].getOrDefault('urlPattern', '');
            let indexPattern = data.providers[prvKeys[p]].getOrDefault('indexPattern', []);
            let domainPatterns = data.providers[prvKeys[p]].getOrDefault('domainPatterns', []);

            if (urlPattern) {
                providers[p].setURLPattern(urlPattern);
                const hasIndex = Array.isArray(indexPattern)
                    ? indexPattern.length > 0
                    : Boolean(indexPattern);
                if (hasIndex) {
                    providers[p].setIndexPattern(indexPattern);
                }
            } else if (domainPatterns.length > 0) {
                providers[p].setURLDomainPattern(domainPatterns);
                if (domainPatternTrie) {
                    for (const pattern of domainPatterns) {
                        domainPatternTrie.add(pattern, providers[p]);
                    }
                }
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

            // Indexing logic
            const lookupTokens = providers[p].getLookupTokens();

            if (lookupTokens.length > 0) {
                for (const token of lookupTokens) {
                    if (!providersByToken[token]) {
                        providersByToken[token] = [];
                    }
                    providersByToken[token].push(providers[p]);
                }
            } else {
                globalProviders.push(providers[p]);
            }
        }
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
            domainPatternTrie = typeof LinkumoriHNTrie === 'function' ? new LinkumoriHNTrie() : null;
            globalProviders = [];
            prvKeys = [];
            return false;
        }

        providersByToken = Object.create(null);
        domainPatternTrie = typeof LinkumoriHNTrie === 'function' ? new LinkumoriHNTrie() : null;
        globalProviders = [];
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

    function Provider(_name, _completeProvider = false, _forceRedirection = false, _isActive = true) {
        let name = _name;
        let urlPattern;
        let urlPatternSource = '';
        let indexPatterns = [];  // domainPattern-syntax hints for providersByToken index only
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
            domainPatterns = patterns || [];
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

        this.isCaneling = function () {
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

        this.applyRule = (enabledRuleMap, disabledRulesArray, rule, isActive = true, compileFn) => {
            if (isActive) {
                if (disabledRulesArray[rule] !== undefined) {
                    delete disabledRulesArray[rule];
                }
                if (enabledRuleMap[rule] === undefined) {
                    enabledRuleMap[rule] = compileFn ? compileFn(rule) : true;
                }
            } else {
                if (enabledRuleMap[rule] !== undefined) {
                    delete enabledRuleMap[rule];
                }
                disabledRulesArray[rule] = true;
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

            this.applyRule(enabled_rules, disabled_rules, rule, isActive, r => new RegExp("^" + r + "$", "i"));
        };

        this.getRules = function () {
            if (!storage.referralMarketing) {
                return Object.keys(Object.assign({}, enabled_rules, enabled_referralMarketing));
            }

            return Object.keys(enabled_rules);
        };

        this.getRulesMap = function () {
            if (!storage.referralMarketing) {
                return Object.assign({}, enabled_rules, enabled_referralMarketing);
            }
            return enabled_rules;
        };

        this.addRawRule = function (rule, isActive = true) {
            this.applyRule(enabled_rawRules, disabled_rawRules, rule, isActive, r => new RegExp(r, "gi"));
        };

        this.getRawRules = function () {
            return Object.keys(enabled_rawRules);
        };

        this.getRawRulesMap = function () {
            return enabled_rawRules;
        };

        this.getLinkumoriRemoveParamRules = function () {
            return enabled_linkumoriRemoveParamRules.slice();
        };

        this.getLinkumoriRemoveParamExceptions = function () {
            return enabled_linkumoriRemoveParamExceptions.slice();
        };

        this.addReferralMarketing = function (rule, isActive = true) {
            this.applyRule(enabled_referralMarketing, disabled_referralMarketing, rule, isActive, r => new RegExp("^" + r + "$", "i"));
        };

        this.addException = function (exception, isActive = true) {
            this.applyRule(enabled_exceptions, disabled_exceptions, exception, isActive, r => new RegExp(exception, "i"));
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

                const exception_regex = enabled_exceptions[exception];
                if (exception_regex instanceof RegExp) {
                    result = exception_regex.test(url);
                } else {
                    result = (new RegExp(exception, "i")).test(url);
                }
            }

            if (!result && enabled_domain_exceptions.length > 0) {
                result = matchDomainPattern(url, enabled_domain_exceptions);
            }

            return result;
        };

        this.addRedirection = function (redirection, isActive = true) {
            this.applyRule(enabled_redirections, disabled_redirections, redirection, isActive, r => new RegExp(redirection, "i"));
        };

        this.addDomainRedirection = function (redirection) {
            if (enabled_domain_redirections.indexOf(redirection) === -1) {
                enabled_domain_redirections.push(redirection);
            }
        };

        this.getRedirection = function (url) {
            let re = null;

            for (const redirection in enabled_redirections) {
                const regex = enabled_redirections[redirection];
                const activeRegex = regex instanceof RegExp ? regex : new RegExp(redirection, "i");
                let result = url.match(activeRegex);

                if (result && result.length > 0 && redirection) {
                    const captured = activeRegex.exec(url);
                    // Guard: [1] is undefined when regex has no capture group.
                    if (captured && captured[1] !== undefined) re = captured[1];
                    break;
                }
            }            
            if (!re && enabled_domain_redirections.length > 0) {
                for (const domainRedirection of enabled_domain_redirections) {
                    if (domainRedirection.includes('$redirect=')) {
                        const [pattern, redirectTarget] = domainRedirection.split('$redirect=');
                        if (matchDomainPattern(url, [pattern.trim()])) {
                            re = redirectTarget;
                            break;
                        }
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
                    for (const token of ctxTokens) {
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
                    globalLinkumoriExceptions.push(...provider.getLinkumoriRemoveParamExceptions());
                }
            }

            // Optimized request provider lookup
            let requestHost = "";
            try {
                requestHost = new URL(request.url).hostname;
            } catch (e) {}
            const requestHostTokens = requestHost.split('.').map(t => t.toLowerCase());

            let requestCandidateProviders = new Set(globalProviders);
            for (const token of requestHostTokens) {
                const tokenProviders = providersByToken[token];
                if (tokenProviders) {
                    for (const p of tokenProviders) {
                        requestCandidateProviders.add(p);
                    }
                }
            }

            // Additionally add providers matching via HNTrie for domainPatterns
            if (domainPatternTrie && requestHost) {
                const hntrieMatches = domainPatternTrie.matches(requestHost);
                if (hntrieMatches) {
                    for (const p of hntrieMatches) {
                        requestCandidateProviders.add(p);
                    }
                }
            }

            const candidates = Array.from(requestCandidateProviders);
            for (let i = 0; i < candidates.length; i++) {
                const provider = candidates[i];
                if (!provider.matchMethod(request)) continue;
                if (!provider.matchResourceType(request)) continue;
                if (provider.matchURL(request.url)) {
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
