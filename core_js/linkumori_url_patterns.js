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
 * one object, and that object answers both questions the engine asks:
 *
 *   match(url)   does the pattern match this URL?
 *   tokens       words every matching URL contains (or null), which the
 *                $removeparam shortcut checks before calling match()
 *
 * Matching is done by @ghostery/adblocker's NetworkFilter (bundled in
 * external_js/linkumori-ghostery-engine.js), the way uBlock Origin and
 * Ghostery match filters: a pattern is parsed once, and its index tokens
 * come from the same parsed filter as its matcher, so the two cannot
 * disagree. Ghostery's Request gives the URL's tokens.
 *
 * Linkumori's own pattern rules are kept, as changes made to the pattern
 * before Ghostery parses it, or as checks that can only narrow a match
 * (so Ghostery's tokens stay valid):
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
 *                     (external_js/publicsuffixlist.js), so these
 *                     patterns match nothing until the list has loaded.
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

    const NEVER = Object.freeze({ kind: 'never', tokens: null, match: () => false });
    const ALWAYS = Object.freeze({ kind: 'all', tokens: null, match: () => true });

    // ---------------------------------------------------------------------
    // URLs
    // ---------------------------------------------------------------------
    // A URL as the patterns read it: Ghostery's Request (null when the URL
    // has no host) and, on first use, its token set. Checks alternate
    // between a request URL and its page URLs, so the last few are kept,
    // then up to URL_CACHE_MAX more.
    const recentUrls = [null, null, null, null];
    const recentEntries = [null, null, null, null];
    let recentNext = 0;
    const urlCache = new Map();

    function makeUrlEntry(url) {
        const entry = { url, request: null, tokenSet: null };
        const g = engine();
        if (!g || typeof url !== 'string' || !url) return entry;
        let host = '';
        try { host = new URL(url).hostname; } catch (_) { return entry; }
        if (!host) return entry;
        try {
            const request = g.Request.fromRawDetails({ url, type: 'xmlhttprequest' });
            if (request && request.hostname) entry.request = request;
        } catch (_) { /* no request: matches nothing */ }
        return entry;
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

    // The URL's tokens as Ghostery indexes requests, or null when the URL
    // matches no pattern anyway.
    function urlTokens(url) {
        const entry = urlEntry(url);
        if (!entry.request) return null;
        if (entry.tokenSet === null) {
            try { entry.tokenSet = new Set(entry.request.getTokens()); }
            catch (_) { entry.tokenSet = null; }
        }
        return entry.tokenSet;
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
            tokens: null,
            match(url) { return !!urlEntry(url).request && re.test(url); }
        };
    }

    // The tokens of a parsed filter, when it has one group of them.
    //
    // @ghostery/adblocker 2.20.3 bug: for a filter that is one word with an
    // end anchor and no start anchor ("fooaff|", "*fooaff|"),
    // tokenizeWithWildcardsInPlace() keeps that word although it may be the
    // end of a longer word: the filter matches .../xfooaff, but the URL's
    // tokens have "xfooaff", not "fooaff" (Ghostery's own engine misses
    // that match too). Such a filter gets no tokens here, so it is always
    // checked with match().
    function filterTokens(filter) {
        const text = typeof filter.filter === 'string' ? filter.filter : '';
        try {
            if (text && !filter.isLeftAnchor() && filter.isRightAnchor() &&
                !/[\x00-\x24\x26-\x2f\x3a-\x40\x5b-\x60\x7b-\x7f]/.test(text)) return null;
        } catch (_) { return null; }
        let groups;
        try { groups = filter.getTokens(); } catch (_) { return null; }
        if (!Array.isArray(groups) || groups.length !== 1 || !groups[0] || groups[0].length === 0) return null;
        return Array.from(new Set(groups[0]));
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
        const tokens = filterTokens(filter);

        if (anySuffixBase === null) {
            return {
                kind: 'ghostery',
                tokens,
                match(url) {
                    const request = urlEntry(url).request;
                    return !!request && filter.match(request);
                }
            };
        }

        // ||host.*rest: the generic filter (whose tokens are the ones above)
        // must match, the host must be base + "." + a public suffix, and
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
            tokens,
            match(url) {
                const request = urlEntry(url).request;
                if (!request || !filter.match(request)) return false;
                let parsed;
                try { parsed = g.parseDomain(request.hostname); } catch (_) { return false; }
                const suffix = parsed && parsed.publicSuffix;
                if (!suffix || request.hostname.length <= suffix.length + 1) return false;
                const beforeSuffix = request.hostname.slice(0, -(suffix.length + 1));
                if (beforeSuffix !== anySuffixBase && !beforeSuffix.endsWith('.' + anySuffixBase)) return false;
                const exact = filterForSuffix(suffix);
                return !!exact && exact.match(request);
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

    // False only when the pattern cannot match the URL: one of its tokens
    // is missing from the URL's tokens.
    function mayMatch(pattern, url) {
        const tokens = compile(pattern).tokens;
        if (!tokens) return true;
        const set = urlTokens(url);
        if (!set) return true;
        for (const t of tokens) if (!set.has(t)) return false;
        return true;
    }

    function clearCaches() {
        compiledCache.clear();
        urlCache.clear();
        for (let i = 0; i < 4; i++) { recentUrls[i] = null; recentEntries[i] = null; }
    }

    root.LinkumoriUrlPatterns = Object.freeze({
        compile,
        matches,
        mayMatch,
        urlTokens,
        clearCaches,
        isReady: () => !!engine()
    });
})(typeof globalThis !== 'undefined' ? globalThis : this);
