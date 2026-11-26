/*
 * ============================================================
 * Linkumori — URL patterns
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
 * Every URL pattern (domainPatterns, and the pattern in front of
 * $removeparam, exceptions and redirections) is compiled once, here, into
 * one object whose match(url) says whether the pattern matches the URL.
 *
 * Matching is done by @ghostery/adblocker's NetworkFilter (Linkumori's
 * minimal port in external_js/linkumori-ghostery-engine.js), the way uBlock
 * Origin and Ghostery match filters: a pattern is parsed once, then matched
 * against each URL.
 *
 * Linkumori's own pattern rules are kept, as changes made to the pattern
 * before Ghostery parses it, or as checks that can only narrow a match:
 *
 *   ^/                "^" right before "/" takes no character, so
 *                     ||host^/path means the path starts with /path
 *   ||host            a host with nothing after it ends at the end of the
 *                     host (parsed as ||host^), so ||example.com does not
 *                     match example.com.evil.org
 *   ||*.host          same as ||host
 *   ||host.* + rest   host on any public suffix, then the rest of the
 *                     pattern right after it: "||amazon.*" followed by
 *                     "/gp/" matches amazon.co.uk/gp/ but not
 *                     amazon.evil.com/gp/ or amazon.de/a/gp/. The suffix
 *                     comes from Linkumori's Public Suffix List
 *                     (external_js/publicsuffixlist.js). While the list
 *                     is loading, or for a host it does not list, the
 *                     pattern is a plain wildcard: "amazon." then
 *                     anything, then the rest.
 *   ||bücher.example  the host is matched in its punycode form
 *   /body/flags       a regex tested against the URL as given
 *   *                 every URL
 *
 * A URL with no host (it does not parse, or has an empty host) matches no
 * pattern.
 *
 * Exposes globalThis.LinkumoriUrlPatterns.
 * ============================================================
 */
(function (root) {
    'use strict';

    const COMPILED_MAX = 20000;
    const URL_CACHE_MAX = 256;

    const engine = () => root.LinkumoriGhosteryEngine || null;

    const NEVER = Object.freeze({ kind: 'never', match: () => false });
    const ALWAYS = Object.freeze({ kind: 'all', match: () => true });

    // ---------------------------------------------------------------------
    // URLs
    // ---------------------------------------------------------------------
    // A URL as the patterns read it: Ghostery's Request (null when the URL
    // has no host). Checks alternate
    // between a request URL and its page URLs, so the last few are kept,
    // then up to URL_CACHE_MAX more.
    const recentUrls = [null, null, null, null];
    const recentEntries = [null, null, null, null];
    let recentNext = 0;
    const urlCache = new Map();

    // "scheme://[user@]host" up to the end of the host, and its trailing dots.
    const HOST_TRAILING_DOTS = /^([a-z][a-z0-9+.-]*:\/\/(?:[^\/?#@]*@)?[^\/?#:.][^\/?#:]*?)\.+(?=[:\/?#]|$)/i;

    function makeUrlEntry(url) {
        const entry = { url, request: null, requestNoDots: null };
        const g = engine();
        if (!g || typeof url !== 'string' || !url) return entry;
        let host = '';
        try { host = new URL(url).hostname; } catch (_) { return entry; }
        if (!host) return entry;
        try {
            const request = g.Request.fromRawDetails({ url, type: 'xmlhttprequest' });
            if (request && request.hostname) entry.request = request;
        } catch (_) { /* no request: matches nothing */ }
        // A host with trailing dots ("example.com.") names the same host, but
        // a pattern with a path (||example.com/go) is matched against the URL
        // text, where the dot sits between host and path. So the URL is also
        // read with those dots dropped (only the host changes), and a pattern
        // matches if either reading does: one that spells the dot out
        // (|https://www.example.*) still matches the first.
        if (entry.request) {
            const noDots = url.replace(HOST_TRAILING_DOTS, '$1');
            if (noDots !== url) {
                try {
                    const request = g.Request.fromRawDetails({ url: noDots, type: 'xmlhttprequest' });
                    if (request && request.hostname) entry.requestNoDots = request;
                } catch (_) { /* the URL as given still applies */ }
            }
        }
        return entry;
    }

    // filter.match() on the URL as given, or with its host's trailing dots
    // dropped.
    function matchEntry(filter, entry) {
        return filter.match(entry.request) ||
            (entry.requestNoDots !== null && filter.match(entry.requestNoDots));
    }

    function urlEntry(url) {
        for (let i = 0; i < 4; i++) if (recentUrls[i] === url) return recentEntries[i];
        let entry = urlCache.get(url);
        if (entry === undefined) {
            entry = makeUrlEntry(url);
            if (urlCache.size >= URL_CACHE_MAX) urlCache.clear();
            urlCache.set(url, entry);
        }
        recentUrls[recentNext] = url;
        recentEntries[recentNext] = entry;
        recentNext = (recentNext + 1) & 3;
        return entry;
    }

    // ---------------------------------------------------------------------
    // Patterns
    // ---------------------------------------------------------------------
    const compiledCache = new Map();

    function toPunycodeHost(host) {
        if (!/[^\x00-\x7f]/.test(host)) return host;
        try { return new URL('http://' + host).hostname; } catch (_) { return host; }
    }

    // A pattern that Linkumori reads as a regex: /body/ or /body/flags with
    // flag letters only (a path such as /click is not one).
    function compileRegexLiteral(p) {
        if (p.charAt(0) !== '/') return null;
        const closingSlash = p.lastIndexOf('/');
        if (closingSlash <= 0) return null;
        const flags = p.slice(closingSlash + 1);
        if (!/^[a-z]*$/i.test(flags)) return null;
        let re;
        try { re = new RegExp(p.slice(1, closingSlash), flags.replace(/[gy]/g, '')); } catch (_) { return null; }
        return {
            kind: 'regex',
            match(url) { return !!urlEntry(url).request && re.test(url); }
        };
    }

    function compileUncached(pattern) {
        const g = engine();
        let p = String(pattern || '').trim();
        if (!p) return NEVER;
        if (p === '*') return ALWAYS;
        const regex = compileRegexLiteral(p);
        if (regex) return regex;
        if (!g) return NEVER;

        p = p.toLowerCase();
        // "^" right before "/" takes no character in Linkumori: ||host^/go
        // is ||host/go, "the path starts with /go". (Ghostery and uBlock
        // Origin would want a separator and then a "/".)
        p = p.split('^/').join('/');
        let anySuffixBase = null;
        let anySuffixRest = null;
        if (p.startsWith('||')) {
            let body = p.slice(2);
            if (body.startsWith('*.')) body = body.slice(2);
            const hostOnly = !/[\/^|]/.test(body);
            const hostRun = body.match(/^[^\/^|*?#:]*/)[0];
            let host = toPunycodeHost(hostRun);
            let rest = body.slice(hostRun.length);
            // ||host.* : host on any public suffix.
            if (host.endsWith('.') && host.length > 1 && rest.startsWith('*') &&
                (rest.length === 1 || /[\/^|?#:]/.test(rest.charAt(1)))) {
                anySuffixBase = host.slice(0, -1);
                anySuffixRest = rest.slice(1);
                if (hostOnly && anySuffixRest === '') anySuffixRest = '^';
            }
            // ||host : ends at the end of the host.
            if (hostOnly && !rest.endsWith('^') && !rest.endsWith('|')) rest += '^';
            p = '||' + host + rest;
        }

        let filter = null;
        try { filter = g.NetworkFilter.parse(p); } catch (_) { filter = null; }
        if (!filter) return NEVER;

        if (anySuffixBase === null) {
            return {
                kind: 'ghostery',
                match(url) {
                    const entry = urlEntry(url);
                    return !!entry.request && matchEntry(filter, entry);
                }
            };
        }

        // ||host.*rest: the generic filter must match, the host must be base + "." + a public suffix, and
        // ||base.<that suffix>rest must match too.
        const bySuffix = new Map();
        const filterForSuffix = suffix => {
            let f = bySuffix.get(suffix);
            if (f === undefined) {
                try { f = g.NetworkFilter.parse('||' + anySuffixBase + '.' + suffix + anySuffixRest); } catch (_) { f = null; }
                if (bySuffix.size >= 64) bySuffix.clear();
                bySuffix.set(suffix, f);
            }
            return f;
        };
        return {
            kind: 'anySuffix',
            match(url) {
                const entry = urlEntry(url);
                const request = entry.request;
                if (!request || !matchEntry(filter, entry)) return false;
                let parsed;
                try { parsed = g.parseDomain(request.hostname); } catch (_) { parsed = null; }
                const suffix = parsed && parsed.publicSuffix;
                // No suffix: the Public Suffix List is still loading, or it
                // does not list this host (localhost, .lan). As before the
                // Ghostery engine, fall back to the plain wildcard match
                // ("amazon." then anything), which the generic filter is.
                if (!suffix) return true;
                if (request.hostname.length <= suffix.length + 1) return false;
                const beforeSuffix = request.hostname.slice(0, -(suffix.length + 1));
                if (beforeSuffix !== anySuffixBase && !beforeSuffix.endsWith('.' + anySuffixBase)) return false;
                const exact = filterForSuffix(suffix);
                return !!exact && matchEntry(exact, entry);
            }
        };
    }

    function compile(pattern) {
        const key = String(pattern || '');
        let compiled = compiledCache.get(key);
        if (compiled === undefined) {
            compiled = compileUncached(key);
            if (compiledCache.size >= COMPILED_MAX) compiledCache.clear();
            compiledCache.set(key, compiled);
        }
        return compiled;
    }

    function matches(pattern, url) {
        return compile(pattern).match(url);
    }

    function clearCaches() {
        compiledCache.clear();
        urlCache.clear();
        for (let i = 0; i < 4; i++) { recentUrls[i] = null; recentEntries[i] = null; }
    }

    root.LinkumoriUrlPatterns = Object.freeze({
        compile,
        matches,
        clearCaches,
        isReady: () => !!engine()
    });
})(typeof globalThis !== 'undefined' ? globalThis : this);
