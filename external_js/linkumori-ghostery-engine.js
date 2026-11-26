/*
 * ============================================================
 * Linkumori — URL pattern engine
 * ============================================================
 * SPDX-License-Identifier: MPL-2.0 OR LGPL-3.0-or-later
 *
 * Linkumori's own, minimal port of the URL pattern matching in
 * @ghostery/adblocker 2.20.3 (filters/network.js, request.js, utils.js):
 * only what core_js/linkumori_url_patterns.js uses. No filter options,
 * exceptions, request types, domain lists, token indexing, serialization,
 * compression, cosmetic filters, punycode or tldts.
 *
 *   Ported from @ghostery/adblocker
 *     Copyright (c) 2017-present Ghostery GmbH. MPL-2.0.
 *     https://github.com/ghostery/adblocker
 *     License text: THIRD-PARTY-NOTICE/ghostery-adblocker/LICENSE
 *   Linkumori changes Copyright (c) 2026 Subham Mahesh
 *     (LGPL-3.0-or-later)
 *
 * The MPL-2.0 parts carry no "Incompatible With Secondary Licenses"
 * notice, so under MPL-2.0 section 3.3 Linkumori distributes them as part
 * of a Larger Work under the GNU LGPL v3.0 or later, in addition to
 * MPL-2.0. Recipients may use them under either license.
 *
 * Pattern syntax (as in uBlock Origin / Ghostery, without "$options"):
 *   ||host...   host anchor     |...   start anchor     ...|   end anchor
 *   *           any characters  ^      a separator or the end of the URL
 *   /regex/     a regex (case-insensitive)
 *
 * Hostnames and public suffixes come from external_js/publicsuffixlist.js
 * (globalThis.linkumoriPsl), which must be loaded before this file.
 *
 * Exposes globalThis.LinkumoriGhosteryEngine = { NetworkFilter, Request,
 * parseDomain }, used by core_js/linkumori_url_patterns.js.
 * ============================================================
 */
var LinkumoriGhosteryEngine = (() => {
    'use strict';

    // -----------------------------------------------------------------
    // Hostnames
    // -----------------------------------------------------------------
    const EMPTY_DOMAIN = Object.freeze({ hostname: null, domain: null, publicSuffix: null, subdomain: null, isIp: false });

    function psl() {
        const p = globalThis.linkumoriPsl;
        if (!p || typeof p.normalizeHostname !== 'function') {
            throw new Error('linkumoriPsl is not loaded (external_js/publicsuffixlist.js)');
        }
        return p;
    }

    // The URL's hostname, lower case, with every trailing dot dropped
    // ("tv.apple.com.." is tv.apple.com), or '' when it has none.
    function extractHostname(url) {
        const p = psl();
        const extracted = p.extractHostnameFromInput(url, false);
        return extracted ? (p.normalizeHostname(String(extracted).replace(/\.+$/, '')) || '') : '';
    }

    // A hostname's registrable domain and public suffix. The hostname is
    // given even while the Public Suffix List is still loading; domain and
    // publicSuffix stay null until it is ready, and for hosts it does not
    // list.
    function parseDomain(input, options = {}) {
        const p = psl();
        const extracted = options.extractHostname === false
            ? String(input || '')
            : p.extractHostnameFromInput(input, options.mixedInputs !== false);
        const hostname = extracted ? p.normalizeHostname(String(extracted).replace(/\.+$/, '')) : null;
        if (!hostname) return EMPTY_DOMAIN;
        if (p.isIp(hostname)) return { hostname, domain: null, publicSuffix: null, subdomain: null, isIp: true };
        const parsed = p.status === 'ready' ? p.parseNormalizedHostname(hostname) : null;
        if (!parsed || !parsed.listed) return { hostname, domain: null, publicSuffix: null, subdomain: null, isIp: false };
        return {
            hostname,
            domain: parsed.domain || null,
            publicSuffix: parsed.tld || null,
            subdomain: parsed.subdomain || null,
            isIp: false
        };
    }

    // -----------------------------------------------------------------
    // Request: a URL as NetworkFilter.match() reads it.
    // -----------------------------------------------------------------
    class Request {
        static fromRawDetails({ url = '', hostname } = {}) {
            return new Request(String(url), hostname === undefined ? extractHostname(url) : hostname);
        }

        constructor(url, hostname) {
            this.url = url;
            this.hostname = hostname || '';
            this.normalizedUrl = url.toLowerCase();
            this.isHttp = url.startsWith('http:');
            this.isHttps = url.startsWith('https:');
        }
    }

    // -----------------------------------------------------------------
    // NetworkFilter: one parsed pattern.
    // -----------------------------------------------------------------
    const LEFT = 1;          // |pattern, or ||host followed by a path
    const RIGHT = 2;         // pattern|
    const HOST = 4;          // ||host
    const REGEX = 8;         // has * or ^: matched with a RegExp
    const FULL_REGEX = 16;   // /regex/
    const HTTP = 32;         // may match http: URLs
    const HTTPS = 64;        // may match https: URLs

    function isHostnameChar(ch) {
        return (ch >= 97 && ch <= 122) || (ch >= 65 && ch <= 90) || (ch >= 48 && ch <= 57) ||
            ch === 95 || ch === 45 || ch === 46;
    }

    function hasUnescapedOptions(line) {
        let i = line.lastIndexOf('$');
        while (i > 0 && line.charCodeAt(i - 1) === 92) i = line.lastIndexOf('$', i - 1);
        return i !== -1 && line.charCodeAt(i + 1) !== 47;
    }

    // A wildcard pattern as a RegExp: "*" is anything, "^" a separator
    // (not a letter, digit or one of _.%-) or the end of the URL.
    function compileRegex(filter, left, right) {
        let re = filter.replace(/([|.$+?{}()[\]\\])/g, '\\$1').replace(/\*/g, '.*');
        if (!left) while (re.startsWith('.*')) re = re.slice(2);
        if (!right) while (re.endsWith('.*')) re = re.slice(0, -2);
        re = re.replace(/\^/g, '(?:[^\\w\\d_.%-]|$)');
        return new RegExp((left ? '^' : '') + re + (right ? '$' : ''), 'i');
    }

    const MATCH_ALL = /(?:)/;

    // Whether `filterHostname` (from ||host) names `hostname` or one of its
    // parents, on label boundaries (a dot at either end of the filter's
    // hostname, or a following "*", stands for the boundary).
    function isAnchoredByHostname(filterHostname, hostname, followedByWildcard) {
        const fl = filterHostname.length;
        if (fl === 0) return true;
        if (fl > hostname.length) return false;
        if (fl === hostname.length) return filterHostname === hostname;
        const at = hostname.indexOf(filterHostname);
        if (at === -1) return false;
        const endOk = followedByWildcard || hostname.charCodeAt(fl) === 46 || filterHostname.charCodeAt(fl - 1) === 46;
        if (at === 0) return endOk;
        const startOk = hostname.charCodeAt(at - 1) === 46 || filterHostname.charCodeAt(0) === 46;
        if (hostname.length === at + fl) return startOk;
        return endOk && startOk;
    }

    class NetworkFilter {
        // Parses a pattern, or returns null when it is not one ("$options",
        // "@@" exceptions, a regex that does not compile).
        static parse(line) {
            line = String(line);
            if (line.startsWith('@@') || hasUnescapedOptions(line)) return null;

            let mask = HTTP | HTTPS;
            let start = 0;
            let end = line.length;
            let hostname;
            let filter;
            let regex;

            if (end >= 2 && line.charCodeAt(0) === 47 && line.charCodeAt(end - 1) === 47) {
                filter = line;
                try { regex = new RegExp(line.slice(1, -1), 'i'); } catch (_) { return null; }
                return new NetworkFilter(filter, hostname, mask | FULL_REGEX, regex);
            }

            if (end > 0 && line.charCodeAt(end - 1) === 124) { mask |= RIGHT; end--; }
            if (start < end && line.charCodeAt(start) === 124) {
                if (start < end - 1 && line.charCodeAt(start + 1) === 124) { mask |= HOST; start += 2; }
                else { mask |= LEFT; start += 1; }
            }

            if (mask & HOST) {
                let sep = start;
                while (sep < end && isHostnameChar(line.charCodeAt(sep))) sep++;
                hostname = line.slice(start, sep);
                start = sep;
                if (sep < end) {
                    const ch = line.charCodeAt(sep);
                    if (ch === 94) {                       // ||host^
                        if (end - start === 1) { start = end; mask |= RIGHT; }
                        else mask |= REGEX | LEFT;
                    } else if (ch === 42) {                // ||host*
                        mask |= REGEX;
                    } else {                               // ||host/path
                        mask |= LEFT;
                    }
                }
            }

            if (end - start > 0 && line.charCodeAt(end - 1) === 42) end--;
            if (!(mask & HOST) && end - start > 0 && line.charCodeAt(start) === 42) { mask &= ~LEFT; start++; }

            // |http://, |https://, |http*:// and |ws:// alone: a scheme.
            if (mask & LEFT) {
                const rest = line.slice(start, end);
                let schemes = -1;
                if (rest === 'ws://') schemes = 0;
                else if (rest === 'http://') schemes = HTTP;
                else if (rest === 'https://') schemes = HTTPS;
                else if (rest === 'http*://') schemes = HTTP | HTTPS;
                if (schemes !== -1) {
                    mask = (mask & ~(LEFT | HTTP | HTTPS)) | schemes;
                    start = end;
                }
            }

            if (end - start > 0) {
                filter = line.slice(start, end).toLowerCase();
                if (filter.indexOf('^') !== -1 || filter.indexOf('*') !== -1) mask |= REGEX;
            }
            if (hostname !== undefined) hostname = hostname.toLowerCase();
            if ((mask & REGEX) && filter !== undefined) regex = compileRegex(filter, !!(mask & LEFT), !!(mask & RIGHT));
            return new NetworkFilter(filter, hostname, mask, regex);
        }

        constructor(filter, hostname, mask, regex) {
            this.filter = filter;
            this.hostname = hostname;
            this.mask = mask;
            this.regex = regex || MATCH_ALL;
        }

        isLeftAnchor() { return (this.mask & LEFT) !== 0; }
        isRightAnchor() { return (this.mask & RIGHT) !== 0; }
        isHostnameAnchor() { return (this.mask & HOST) !== 0; }
        isRegex() { return (this.mask & REGEX) !== 0; }
        isFullRegex() { return (this.mask & FULL_REGEX) !== 0; }
        hasFilter() { return this.filter !== undefined; }
        getFilter() { return this.filter || ''; }
        getHostname() { return this.hostname || ''; }

        match(request) {
            if ((request.isHttps && !(this.mask & HTTPS)) || (request.isHttp && !(this.mask & HTTP))) return false;
            const url = request.normalizedUrl;
            const pattern = this.getFilter();
            const mask = this.mask;

            if (mask & FULL_REGEX) return this.regex.test(url);

            if (mask & HOST) {
                const host = this.getHostname();
                if (!isAnchoredByHostname(host, request.hostname,
                    this.filter !== undefined && this.filter.charCodeAt(0) === 42)) return false;
                const afterHost = url.indexOf(host) + host.length;
                if (mask & REGEX) return this.regex.test(url.slice(afterHost));
                if ((mask & RIGHT) && (mask & LEFT)) return pattern === url.slice(afterHost);
                if (mask & RIGHT) {
                    if (this.filter === undefined) {
                        return host.length === request.hostname.length || request.hostname.endsWith(host);
                    }
                    return url.endsWith(pattern);
                }
                if (mask & LEFT) return url.startsWith(pattern, afterHost);
                return this.filter === undefined || url.indexOf(pattern, afterHost) !== -1;
            }

            if (mask & REGEX) return this.regex.test(url);
            if ((mask & LEFT) && (mask & RIGHT)) return url === pattern;
            if (mask & LEFT) return url.startsWith(pattern);
            if (mask & RIGHT) return url.endsWith(pattern);
            return this.filter === undefined || url.indexOf(pattern) !== -1;
        }
    }

    return { NetworkFilter, Request, parseDomain };
})();
