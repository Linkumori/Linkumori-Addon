/*
 * ============================================================
 * Linkumori — Firefox DNS/CNAME support
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
 * first modified on 8 may 2026
 *  MODIFICATIONS
 * -------------
 * - Added communication for options page and replaced
 *   browserAction to action API for MV3 compliance
 * - MV3 compliant patches taken from upstream (see Upstream above)
 * - Updated checkLocalURL function to use modern ES6 IP library
 *
 * ============================================================
 * MODIFICATION HISTORY
 * ============================================================
 * 08-May-2026  Subham Mahesh   First modification
 *
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
 
(function() {
    'use strict';

    const DNS_CACHE_TTL_MS = 10 * 60 * 1000;
    const DNS_CACHE_MAX = 512;
    const dnsCache = new Map();
    const reIPv4 = /^\d+\.\d+\.\d+\.\d+$/;

    function now() {
        return Date.now();
    }

    function normalizeHostname(value) {
        const host = String(value || '').trim().toLowerCase();
        return host.endsWith('.') ? host.slice(0, -1) : host;
    }

    function hostnameFromURL(rawUrl) {
        try {
            return normalizeHostname(new URL(rawUrl).hostname);
        } catch (e) {
            return '';
        }
    }

    function isIPAddress(hostname) {
        if (!hostname) return false;
        if (hostname.charAt(0) === '[') return true;
        return reIPv4.test(hostname);
    }

    function fallbackRegistrableDomain(hostname) {
        const parts = normalizeHostname(hostname).split('.').filter(Boolean);
        if (parts.length <= 2) return parts.join('.');
        return parts.slice(-2).join('.');
    }

    function registrableDomain(hostname) {
        const normalized = normalizeHostname(hostname);
        if (!normalized) return '';

        const psl = globalThis.linkumoriPsl;
        if (psl && typeof psl.parseNormalizedHostname === 'function') {
            try {
                const parsed = psl.parseNormalizedHostname(normalized);
                if (parsed && parsed.domain) return parsed.domain;
            } catch (e) {}
        }
        if (psl && typeof psl.lookupNormalized === 'function') {
            try {
                const lookedUp = psl.lookupNormalized(normalized);
                if (lookedUp && lookedUp.domain) return lookedUp.domain;
            } catch (e) {}
        }

        return fallbackRegistrableDomain(normalized);
    }

    function sameRegistrableDomain(left, right) {
        const leftDomain = registrableDomain(left);
        const rightDomain = registrableDomain(right);
        return !!leftDomain && leftDomain === rightDomain;
    }

    function shouldResolve(requestDetails, hostname) {
        if (!requestDetails || requestDetails.linkumoriAliasURL) return false;
        if (
            typeof storage !== 'undefined' &&
            storage &&
            storage.linkumoriCNAMEUncloakEnabled === false
        ) {
            return false;
        }
        if (requestDetails.type === 'main_frame') return false;
        if (!/^https?:\/\//i.test(requestDetails.url || '')) return false;
        if (!hostname || isIPAddress(hostname)) return false;

        if (
            typeof browser === 'undefined' ||
            !browser.dns ||
            typeof browser.dns.resolve !== 'function'
        ) {
            return false;
        }

        return true;
    }

    function trimCache() {
        while (dnsCache.size > DNS_CACHE_MAX) {
            const firstKey = dnsCache.keys().next().value;
            dnsCache.delete(firstKey);
        }
    }

    function cacheRecord(hostname, record) {
        dnsCache.set(hostname, {
            record,
            promise: null,
            expiresAt: now() + DNS_CACHE_TTL_MS
        });
        trimCache();
        return record;
    }

    function cachePromise(hostname, promise) {
        dnsCache.set(hostname, {
            record: null,
            promise,
            expiresAt: now() + DNS_CACHE_TTL_MS
        });
        trimCache();
        return promise;
    }

    function readCacheEntry(hostname) {
        const entry = dnsCache.get(hostname);
        if (!entry) return null;
        if (entry.promise || entry.expiresAt >= now()) return entry;
        dnsCache.delete(hostname);
        return null;
    }

    function canonicalNameFromRecord(hostname, record) {
        const cname = normalizeHostname(record && record.canonicalName);
        if (!cname || cname === hostname) return '';
        if (sameRegistrableDomain(hostname, cname)) return '';
        return cname;
    }

    async function resolveCanonicalName(hostname) {
        const cached = readCacheEntry(hostname);
        if (cached) {
            const record = cached.promise ? await cached.promise : cached.record;
            return record && record.cname ? record.cname : '';
        }

        const promise = browser.dns.resolve(hostname, ['canonical_name'])
            .then(
                record => cacheRecord(hostname, {
                    cname: canonicalNameFromRecord(hostname, record)
                }),
                () => cacheRecord(hostname, { cname: '' })
            );

        const record = await cachePromise(hostname, promise);
        return record && record.cname ? record.cname : '';
    }

    function replaceHostname(rawUrl, fromHostname, toHostname) {
        try {
            const url = new URL(rawUrl);
            if (normalizeHostname(url.hostname) !== normalizeHostname(fromHostname)) {
                return '';
            }
            url.hostname = toHostname;
            return url.toString();
        } catch (e) {
            return '';
        }
    }

    function hasBlockingDecision(result) {
        return !!(
            result &&
            (
                result.cancel === true ||
                typeof result.redirectUrl === 'string'
            )
        );
    }

    function restoreOriginalHostname(result, aliasRequest) {
        if (!result || typeof result.redirectUrl !== 'string') return result;

        const restoredURL = replaceHostname(
            result.redirectUrl,
            aliasRequest.linkumoriCNAME,
            aliasRequest.linkumoriOriginalHostname
        );
        if (!restoredURL) return result;

        return Object.assign({}, result, { redirectUrl: restoredURL });
    }

    async function replayCNAMEIfNeeded(requestDetails, filterRequest) {
        if (typeof filterRequest !== 'function') return {};

        const originalHostname = hostnameFromURL(requestDetails && requestDetails.url);
        if (!shouldResolve(requestDetails, originalHostname)) return {};

        const cname = await resolveCanonicalName(originalHostname);
        if (!cname) return {};

        const aliasURL = replaceHostname(requestDetails.url, originalHostname, cname);
        if (!aliasURL || aliasURL === requestDetails.url) return {};

        const aliasRequest = Object.assign({}, requestDetails, {
            url: aliasURL,
            linkumoriAliasURL: requestDetails.url,
            linkumoriOriginalHostname: originalHostname,
            linkumoriCNAME: cname
        });
        const result = filterRequest(aliasRequest) || {};

        return hasBlockingDecision(result)
            ? restoreOriginalHostname(result, aliasRequest)
            : {};
    }

    globalThis.LinkumoriDNS = {
        replayCNAMEIfNeeded,
        _test: {
            canonicalNameFromRecord,
            replaceHostname,
            registrableDomain,
            sameRegistrableDomain
        }
    };
})();
