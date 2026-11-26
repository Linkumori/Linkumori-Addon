/**
 * Centralized whitelist module.
 *
 * General whitelist: entries stored in storage.userWhitelist (persisted).
 * History API whitelist: persisted entries used only by historyListener.js.
 * Temporary whitelist: per-tab in-memory Map, cleared on tab close or restart.
 *
 * Depends on normalizeAsciiHostname and parseHostnameWithPsl from clearurls.js
 * (loaded first) and storage.userWhitelist available at runtime from storage.js.
 *  Subham Mahesh (c) 2026 
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
 * centeralized whitelist module added to manage both permanent and temporary whitelists.
 * ============================================================
 * MODIFICATION HISTORY
 * ============================================================
 * 2026-05-05   Subham Mahesh   First modification

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


// ── Temporary tab whitelist ───────────────────────────────────────────────────

// Map<tabId, Set<domain>> — lost on browser restart, cleared when tab closes.
var temporaryTabWhitelist = new Map();

function addToTemporaryTabWhitelist(domain, tabId) {
    if (!domain || typeof domain !== 'string' || typeof tabId !== 'number' || tabId < 0) {
        return false;
    }
    const cleanDomain = domain.toLowerCase().trim();
    if (!cleanDomain) return false;
    if (!temporaryTabWhitelist.has(tabId)) {
        temporaryTabWhitelist.set(tabId, new Set());
    }
    temporaryTabWhitelist.get(tabId).add(cleanDomain);
    return true;
}

function removeFromTemporaryTabWhitelist(domain, tabId) {
    if (!domain || typeof domain !== 'string' || typeof tabId !== 'number' || tabId < 0) {
        return false;
    }
    const cleanDomain = domain.toLowerCase().trim();
    const tabSet = temporaryTabWhitelist.get(tabId);
    if (!tabSet) return false;
    tabSet.delete(cleanDomain);
    if (tabSet.size === 0) temporaryTabWhitelist.delete(tabId);
    return true;
}

function getTemporaryTabWhitelistForTab(tabId) {
    if (typeof tabId !== 'number' || tabId < 0) return [];
    const tabSet = temporaryTabWhitelist.get(tabId);
    return tabSet ? Array.from(tabSet) : [];
}

// Clear temporary entries when a tab is closed.
browser.tabs.onRemoved.addListener((tabId) => {
    temporaryTabWhitelist.delete(tabId);
});

// ── Pattern matching ──────────────────────────────────────────────────────────

// True for a plain IPv4 pattern or an IPv6 pattern in its stored "[...]" form.
// PERF: patterns are checked against every request, and IP.isValid() throws
// internally for anything that isn't an address, so answers are cached.
const ipLiteralPatternCache = new Map();

function isIpLiteralPattern(value) {
    if (!value || typeof value !== 'string') return false;
    const cached = ipLiteralPatternCache.get(value);
    if (cached !== undefined) return cached;
    const candidate = (value.startsWith('[') && value.endsWith(']')) ? value.slice(1, -1) : value;
    const result = candidate.length > 0 && typeof IP !== 'undefined' && IP.isValid(candidate);
    if (typeof IP !== 'undefined') {
        if (ipLiteralPatternCache.size >= 5000) ipLiteralPatternCache.clear();
        ipLiteralPatternCache.set(value, result);
    }
    return result;
}

// PERF: a pattern's parsed form, by its text. Patterns are checked against
// every request (rule $domain=/to= lists, whitelists), and parsing them
// (lower case, trim, ||...^, hostname normalization) gave the same answer
// each time. Null for a pattern that matches nothing.
const whitelistPatternCache = new Map();

function parseWhitelistHostnamePattern(pattern) {
    const rawPattern = String(pattern || '').toLowerCase().trim();
    if (!rawPattern) return null;
    const cleanPattern = normalizeAsciiHostname(rawPattern.startsWith('||') ? rawPattern.slice(2).replace(/\^$/, '') : rawPattern);
    if (!cleanPattern) return null;
    // IP literal patterns (IPv4, or IPv6 in its bracketed hostname form) match
    // by exact address only — the wildcard/PSL suffix semantics below are for
    // domain names and don't apply to IPs.
    if (isIpLiteralPattern(cleanPattern)) return { kind: 'ip', value: cleanPattern };
    // PSL-aware any-TLD wildcard: example.* or *.example.*
    if (cleanPattern.endsWith('.*')) {
        if (cleanPattern.startsWith('*.')) {
            const base = cleanPattern.slice(2, -2);
            return base ? { kind: 'anyTldSubdomain', value: base } : null;
        }
        const base = cleanPattern.slice(0, -2);
        return base ? { kind: 'anyTld', value: base } : null;
    }
    // Wildcard subdomain: *.example.com matches root + all subdomains.
    if (cleanPattern.startsWith('*.')) {
        const baseDomain = cleanPattern.slice(2);
        return baseDomain ? { kind: 'domain', value: baseDomain } : null;
    }
    return { kind: 'domain', value: cleanPattern };
}

function getWhitelistHostnamePattern(pattern) {
    const key = typeof pattern === 'string' ? pattern : String(pattern || '');
    let parsed = whitelistPatternCache.get(key);
    if (parsed === undefined) {
        parsed = parseWhitelistHostnamePattern(key);
        // The IP check needs IP-Ranger; without it the answer is not kept.
        if (typeof IP !== 'undefined') {
            if (whitelistPatternCache.size >= 5000) whitelistPatternCache.clear();
            whitelistPatternCache.set(key, parsed);
        }
    }
    return parsed;
}

function matchWhitelistHostnamePattern(hostname, pattern) {
    const normalizedHostname = normalizeAsciiHostname(hostname);
    if (!normalizedHostname) return false;

    const parsed = getWhitelistHostnamePattern(pattern);
    if (!parsed) return false;
    const value = parsed.value;

    if (parsed.kind === 'ip') return normalizedHostname === value;

    if (parsed.kind === 'anyTld' || parsed.kind === 'anyTldSubdomain') {
        const psl = parseHostnameWithPsl(normalizedHostname);
        if (!psl || !psl.tld) return false;

        const suffixToken = '.' + psl.tld;
        if (!normalizedHostname.endsWith(suffixToken)) return false;

        const beforeSuffix = normalizedHostname.slice(0, -suffixToken.length);
        if (!beforeSuffix) return false;

        if (parsed.kind === 'anyTldSubdomain') return beforeSuffix.endsWith('.' + value);
        return beforeSuffix === value || beforeSuffix.endsWith('.' + value);
    }

    return normalizedHostname === value || normalizedHostname.endsWith('.' + value);
}

// ── Persistent whitelist checks ───────────────────────────────────────────────

function isHostnameInWhitelist(hostname, whitelist) {
    if (!Array.isArray(whitelist) || whitelist.length === 0) {
        return false;
    }

    const normalizedHostname = String(hostname || '').toLowerCase().trim();
    if (!normalizedHostname) {
        return false;
    }

    return whitelist.some((pattern) => {
        return matchWhitelistHostnamePattern(normalizedHostname, pattern);
    });
}

function isHostnameWhitelisted(hostname) {
    return isHostnameInWhitelist(hostname, storage.userWhitelist);
}

function isHostnameHistoryApiWhitelisted(hostname) {
    return isHostnameInWhitelist(hostname, storage.historyApiWhitelist);
}

function isUrlHistoryApiWhitelisted(url) {
    if (!url || typeof url !== 'string') return false;

    try {
        const urlObj = new URL(url);
        return isHostnameHistoryApiWhitelisted(urlObj.hostname.toLowerCase());
    } catch (e) {
        return false;
    }
}

function isHistoryApiWhitelisted(url) {
    return isUrlHistoryApiWhitelisted(url);
}

// ── Combined check (permanent + temporary) ────────────────────────────────────

function isUrlWhitelistedByEither(url, tabId) {
    try {
        const urlObj = new URL(url);
        const hostname = urlObj.hostname.toLowerCase();

        // Permanent whitelist — full pattern matching (wildcards, PSL-aware).
        if (storage.userWhitelist && storage.userWhitelist.length > 0) {
            if (isHostnameWhitelisted(hostname)) return true;
        }

        // Temporary tab whitelist — same pattern matching as permanent.
        if (tabId >= 0) {
            const tabDomains = getTemporaryTabWhitelistForTab(tabId);
            if (tabDomains.length > 0 && tabDomains.some(p => matchWhitelistHostnamePattern(hostname, p))) {
                return true;
            }
        }
    } catch (e) {}
    return false;
}

function isWhitelisted(url, requestDetails = null) {
    const tabId = (requestDetails && typeof requestDetails.tabId === 'number')
        ? requestDetails.tabId
        : -1;

    if (isUrlWhitelistedByEither(url, tabId)) return true;

    if (!requestDetails || requestDetails.type === 'main_frame') {
        return false;
    }

    // Cached per request, so clearUrl() reuses the same list.
    const contextUrls = requestContextManager.getContextURLs(requestDetails);
    return contextUrls.some((contextUrl) => isUrlWhitelistedByEither(contextUrl, tabId));
}
