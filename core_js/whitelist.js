/**
 * Centralized whitelist module.
 *
 * Permanent whitelist: entries stored in storage.userWhitelist (persisted).
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

function isInTemporaryTabWhitelist(domain, tabId) {
    if (!domain || typeof domain !== 'string' || typeof tabId !== 'number' || tabId < 0) {
        return false;
    }
    const cleanDomain = domain.toLowerCase().trim();
    const tabSet = temporaryTabWhitelist.get(tabId);
    return tabSet ? tabSet.has(cleanDomain) : false;
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

    // Wildcard subdomain: *.example.com matches root + all subdomains.
    if (cleanPattern.startsWith('*.')) {
        const baseDomain = cleanPattern.slice(2);
        if (!baseDomain) return false;
        return normalizedHostname === baseDomain || normalizedHostname.endsWith('.' + baseDomain);
    }

    return normalizedHostname === cleanPattern || normalizedHostname.endsWith('.' + cleanPattern);
}

// ── Permanent whitelist checks ────────────────────────────────────────────────

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

    const contextUrls = requestContextManager.collectContextURLs(requestDetails);
    return contextUrls.some((contextUrl) => isUrlWhitelistedByEither(contextUrl, tabId));
}
