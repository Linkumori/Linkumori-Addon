/*
 * ============================================================
 * ClearURLs / Linkumori — Core Storage & Rule Management System
 * ============================================================
 * Copyright (c) 2017–2020 Kevin Röbert
 * Modified by Subham Mahesh (c) 2025 (modified parts only)
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
 * Upstream:   https://github.com/ClearURLs/Addon/blob/master/build_tools/minifyDataJSON.js
 *
 * Based on ClearURLs v1.28.0 and the ClearURLs MV3 migration patches.
 *
 * MODIFICATIONS
 * -------------
 * - SECURITY:       Mandatory hash verification for remote rules
 *                   with HTTPS enforcement
 * - ARCHITECTURE:   Multi-layer fallback chain
 *                   (remote → cache → bundled → enhanced fallback)
 * - VALIDATION:     Strict security validation preventing
 *                   unauthorized network calls
 * - MERGING:        Intelligent custom rule merging preserving
 *                   user overrides
 * - MANAGEMENT:     Comprehensive whitelist with wildcard and
 *                   exact domain matching
 * - OPTIMIZATION:   Rule minification algorithm removing
 *                   empty/default values
 * - METADATA:       Enhanced rule source tracking and
 *                   verification status
 * - CONFIGURATION:  User-configurable remote rule URLs
 *                   with validation
 * - RESILIENCE:     Graceful degradation with multiple
 *                   recovery mechanisms
 * - INTEGRITY:      SHA-256 hash verification without
 *                   storage persistence conflicts
 * - MONITORING:     Detailed merge statistics and
 *                   verification status tracking
 * - MERGING+:       Grouping by domainPatterns when
 *                   urlPattern is missing
 * - COLLISION:      Unique provider names to prevent overwrites
 * - NORMALIZATION:  domainPatterns handled consistently
 *                   as string or array
 *
 * ============================================================
 * MODIFICATION HISTORY
 * ============================================================
 * 2025-06-14   Subham Mahesh   First modification
 * 2025-08-21   Subham Mahesh   Second modification
 * 2025-09-05   Subham Mahesh   Third modification
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
var storage = [];
var hasPendingSaves = false;
var pendingSaves = new Set();
const POPUP_CONSENT_STORAGE_KEY = 'popupConsentAccepted';
const POPUP_CONSENT_VERSION_STORAGE_KEY = 'popupConsentPolicyVersionAccepted';
const POST_RELOAD_OPEN_URL_STORAGE_KEY = 'postReloadOpenUrl';
var clearurlsStarted = false;

var tempVerificationCache = {
    lastVerification: null,
    isRemoteVerified: false,
    isCacheUsed: false
};
let temporaryPauseUntilBrowserRestart = false;
const IMPORT_EXCLUSIONS_KEY = 'customrules_import_exclusions';
const LINKUMORI_URL_DISABLED_RULES_KEY = 'linkumori_url_disabled_rules';

function linkumoriStorageI18n(key, substitutions = []) {
    return globalThis.LinkumoriI18n.getMessage(key, substitutions);
}

function ensureRemoteRulesHealthShape() {
    const current = storage.remoteRulesHealth;
    if (!current || typeof current !== 'object' || Array.isArray(current)) {
        storage.remoteRulesHealth = {
            lastFetchAttemptAt: null,
            lastFetchSuccessAt: null,
            lastHashVerificationAt: null,
            lastFailureReason: null,
            lastFailureStage: null,
            lastRuleURL: null,
            lastHashURL: null
        };
        return;
    }

    storage.remoteRulesHealth = {
        lastFetchAttemptAt: current.lastFetchAttemptAt || null,
        lastFetchSuccessAt: current.lastFetchSuccessAt || null,
        lastHashVerificationAt: current.lastHashVerificationAt || null,
        lastFailureReason: current.lastFailureReason || null,
        lastFailureStage: current.lastFailureStage || null,
        lastRuleURL: current.lastRuleURL || null,
        lastHashURL: current.lastHashURL || null
    };
}

function updateRemoteRulesHealth(updates = {}, persist = false) {
    ensureRemoteRulesHealthShape();
    storage.remoteRulesHealth = {
        ...storage.remoteRulesHealth,
        ...updates
    };

    if (persist) {
        try {
            saveOnDisk(['remoteRulesHealth']);
        } catch (e) {}
    }
}

function recordRemoteFetchAttempt(ruleURL = null, hashURL = null) {
    const now = new Date().toISOString();
    updateRemoteRulesHealth({
        lastFetchAttemptAt: now,
        lastRuleURL: ruleURL || null,
        lastHashURL: hashURL || null
    }, true);
}

function recordRemoteFetchSuccess(ruleURL = null, hashURL = null) {
    const now = new Date().toISOString();
    updateRemoteRulesHealth({
        lastFetchSuccessAt: now,
        lastFailureReason: null,
        lastFailureStage: null,
        lastRuleURL: ruleURL || null,
        lastHashURL: hashURL || null
    }, true);
}

function recordRemoteFetchFailure(reason, stage = 'unknown', ruleURL = null, hashURL = null) {
    updateRemoteRulesHealth({
        lastFailureReason: typeof reason === 'string' ? reason : String(reason || 'Unknown error'),
        lastFailureStage: stage,
        lastRuleURL: ruleURL || null,
        lastHashURL: hashURL || null
    }, true);
}

function recordHashVerification(verification, ruleURL = null, hashURL = null) {
    updateRemoteRulesHealth({
        lastHashVerificationAt: verification?.timestamp || new Date().toISOString(),
        lastRuleURL: ruleURL || null,
        lastHashURL: hashURL || null
    }, true);
}

function getRemoteRulesHealth() {
    ensureRemoteRulesHealthShape();
    const pauseState = getTemporaryPauseState();
    const linkumoriURLsData = storage.LinkumoriURLsData || {};
    const linkumoriURLsMetadata = linkumoriURLsData.metadata || {};
    const linkumoriRuleCount = Array.isArray(linkumoriURLsData.rules) ? linkumoriURLsData.rules.length : 0;
    const linkumoriRuleStatus = linkumoriURLsMetadata.ruleStatus ||
        (linkumoriRuleCount > 0 ? 'loaded' : (linkumoriURLsMetadata.status || 'not_loaded'));
    return {
        ...storage.remoteRulesHealth,
        hashStatus: storage.hashStatus || 'unknown',
        hashValidationStatus: storage.hashValidationStatus || null,
        isRemoteVerified: !!tempVerificationCache.isRemoteVerified,
        isCacheUsed: !!tempVerificationCache.isCacheUsed,
        lastVerification: tempVerificationCache.lastVerification || null,
        remoteRulesEnabled: !!storage.remoteRulesEnabled,
        linkumoriURLsStatus: linkumoriURLsMetadata.status || linkumoriURLsMetadata.source || 'not_loaded',
        linkumoriURLsRuleStatus: linkumoriRuleStatus,
        linkumoriURLsHashStatus: linkumoriURLsMetadata.hashStatus || 'not_required',
        linkumoriURLsRuleCount: linkumoriRuleCount,
        linkumoriURLsSourceCount: Number(linkumoriURLsMetadata.sourceCount || 0),
        linkumoriURLsFailedSourceCount: Number(linkumoriURLsMetadata.failedSourceCount || 0),
        linkumoriURLsUnsupportedRuleCount: Number(linkumoriURLsMetadata.skippedUnsupportedRuleCount || 0),
        linkumoriURLsDuplicateRuleCount: Number(linkumoriURLsMetadata.skippedDuplicateRuleCount || 0),
        linkumoriURLsLastFetchAttemptAt: linkumoriURLsMetadata.lastFetchAttemptAt || null,
        linkumoriURLsLastFetchSuccessAt: linkumoriURLsMetadata.lastFetchSuccessAt || null,
        linkumoriURLsFailureReason: linkumoriURLsMetadata.lastFailureReason || null,
        temporaryPause: pauseState
    };
}

function clearExpiredTemporaryPause() {
    if (typeof storage.temporaryPauseUntil !== 'number' || storage.temporaryPauseUntil <= 0) {
        return false;
    }

    if (Date.now() < storage.temporaryPauseUntil) {
        return false;
    }

    storage.temporaryPauseUntil = 0;
    try {
        saveOnDisk(['temporaryPauseUntil']);
    } catch (e) {}
    return true;
}

function isTemporarilyPaused() {
    clearExpiredTemporaryPause();
    if (temporaryPauseUntilBrowserRestart) {
        return true;
    }
    return typeof storage.temporaryPauseUntil === 'number' && storage.temporaryPauseUntil > Date.now();
}

function getTemporaryPauseState() {
    clearExpiredTemporaryPause();
    const now = Date.now();
    const timedUntil = (typeof storage.temporaryPauseUntil === 'number' && storage.temporaryPauseUntil > now)
        ? storage.temporaryPauseUntil
        : 0;

    if (temporaryPauseUntilBrowserRestart) {
        return {
            isPaused: true,
            mode: 'until_restart',
            until: null,
            remainingMs: null
        };
    }

    if (timedUntil > 0) {
        return {
            isPaused: true,
            mode: 'timed',
            until: timedUntil,
            remainingMs: Math.max(0, timedUntil - now)
        };
    }

    return {
        isPaused: false,
        mode: 'none',
        until: null,
        remainingMs: 0
    };
}

function pauseCleaningTemporarily(durationMinutes) {
    const minutes = Number(durationMinutes);
    if (!Number.isFinite(minutes) || minutes <= 0) {
        throw new Error('Duration must be a positive number of minutes');
    }

    temporaryPauseUntilBrowserRestart = false;
    storage.temporaryPauseUntil = Date.now() + Math.round(minutes * 60 * 1000);
    saveOnDisk(['temporaryPauseUntil']);
    return getTemporaryPauseState();
}

function pauseCleaningUntilRestart() {
    temporaryPauseUntilBrowserRestart = true;
    storage.temporaryPauseUntil = 0;
    saveOnDisk(['temporaryPauseUntil']);
    return getTemporaryPauseState();
}

function resumeCleaningNow() {
    temporaryPauseUntilBrowserRestart = false;
    storage.temporaryPauseUntil = 0;
    saveOnDisk(['temporaryPauseUntil']);
    return getTemporaryPauseState();
}

/**
 * Generate a grouping key for a provider based on its urlPattern or domainPatterns.
 * @param {object} providerData - The provider object.
 * @param {string} providerName - The provider's name (used as fallback).
 * @returns {string} A key string for grouping.
 */
function getProviderGroupKey(providerData, providerName) {
    const urlPattern = (typeof providerData?.urlPattern === 'string')
        ? providerData.urlPattern.trim()
        : '';
    if (urlPattern) {
        return `url:${urlPattern}`;
    }

    const domainPatterns = [];
    if (Array.isArray(providerData?.domainPatterns)) {
        providerData.domainPatterns.forEach(pattern => {
            if (typeof pattern === 'string' && pattern.trim()) {
                domainPatterns.push(pattern.trim());
            }
        });
    } else if (typeof providerData?.domainPatterns === 'string' && providerData.domainPatterns.trim()) {
        domainPatterns.push(providerData.domainPatterns.trim());
    }

    if (domainPatterns.length > 0) {
        const normalized = [...new Set(domainPatterns)].sort((a, b) => a.localeCompare(b));
        return `domain:${normalized.join('||')}`;
    }

    return `no-pattern:${providerName}`;
}

function normalizeProviderEntries(providers, primaryProviderNames = new Set()) {
    if (Array.isArray(providers)) {
        return providers
            .filter(provider => provider && typeof provider === 'object')
            .map(provider => ({
                name: provider.name,
                data: provider.data,
                isPrimarySource: provider.isPrimarySource === true
            }));
    }

    const normalized = [];
    Object.entries(providers || {}).forEach(([providerName, providerData]) => {
        normalized.push({
            name: providerName,
            data: providerData,
            isPrimarySource: primaryProviderNames.has(providerName)
        });
    });

    return normalized;
}

function getDisabledSignatures(rawExclusions) {
    const signatures = new Set();

    if (Array.isArray(rawExclusions)) {
        rawExclusions.forEach(signature => {
            if (typeof signature === 'string' && signature.trim().length > 0) {
                signatures.add(signature.trim());
            }
        });
        return signatures;
    }

    if (!rawExclusions || typeof rawExclusions !== 'object' || Array.isArray(rawExclusions)) {
        return signatures;
    }

    Object.values(rawExclusions).forEach(sourceSignatures => {
        if (!Array.isArray(sourceSignatures)) {
            return;
        }
        sourceSignatures.forEach(signature => {
            if (typeof signature === 'string' && signature.trim().length > 0) {
                signatures.add(signature.trim());
            }
        });
    });

    return signatures;
}

function isProviderSignatureDisabled(providerData, providerName, disabledSignatures) {
    if (!disabledSignatures || disabledSignatures.size === 0) {
        return false;
    }

    const key = getProviderGroupKey(providerData, providerName);
    if (typeof key !== 'string' || key.startsWith('no-pattern:')) {
        return false;
    }

    return disabledSignatures.has(key);
}

function filterProvidersByDisabledSignatures(providers, disabledSignatures) {
    const filtered = {};
    let removedCount = 0;

    Object.entries(providers || {}).forEach(([providerName, providerData]) => {
        if (isProviderSignatureDisabled(providerData, providerName, disabledSignatures)) {
            removedCount++;
            return;
        }
        filtered[providerName] = providerData;
    });

    return {
        providers: filtered,
        removedCount
    };
}

function normalizeRemoteRuleSetEntry(entry, requireHash = true) {
    if (!entry || typeof entry !== 'object' || Array.isArray(entry)) {
        return null;
    }

    const ruleURL = typeof entry.ruleURL === 'string' ? entry.ruleURL.trim() : '';
    const hashURL = typeof entry.hashURL === 'string' ? entry.hashURL.trim() : '';

    if (!isValidRuleURL(ruleURL)) {
        return null;
    }

    if (requireHash && !isValidRuleURL(hashURL)) {
        return null;
    }

    return { ruleURL, hashURL };
}

function getConfiguredRemoteRuleSets() {
    if (!storage.remoteRulesEnabled) {
        return [];
    }

    const dedupe = new Set();
    const remoteRuleSets = [];

    const primaryRuleURL = typeof storage.ruleURL === 'string' ? storage.ruleURL.trim() : '';
    const primaryHashURL = typeof storage.hashURL === 'string' ? storage.hashURL.trim() : '';
    const hasPrimary = isValidRuleURL(primaryRuleURL) && isValidRuleURL(primaryHashURL);

    if (hasPrimary) {
        const key = `${primaryRuleURL}|||${primaryHashURL}`;
        dedupe.add(key);
        remoteRuleSets.push({ ruleURL: primaryRuleURL, hashURL: primaryHashURL });
    }

    if (Array.isArray(storage.remoteRuleSets)) {
        storage.remoteRuleSets.forEach(entry => {
            const normalized = normalizeRemoteRuleSetEntry(entry, true);
            if (!normalized) {
                return;
            }

            const key = `${normalized.ruleURL}|||${normalized.hashURL}`;
            if (dedupe.has(key)) {
                return;
            }

            dedupe.add(key);
            remoteRuleSets.push(normalized);
        });
    }

    return remoteRuleSets;
}

function getConfiguredLinkumoriURLFilterURLs() {
    if (!storage.remoteRulesEnabled) {
        return [];
    }

    const urls = [];
    const dedupe = new Set();
    const addURL = (ruleURL, hashURL = '') => {
        const cleanRuleURL = typeof ruleURL === 'string' ? ruleURL.trim() : '';
        const cleanHashURL = typeof hashURL === 'string' ? hashURL.trim() : '';
        if (!isValidRuleURL(cleanRuleURL) || cleanHashURL) {
            return;
        }
        if (dedupe.has(cleanRuleURL)) {
            return;
        }
        dedupe.add(cleanRuleURL);
        urls.push(cleanRuleURL);
    };

    addURL(storage.ruleURL, storage.hashURL);

    if (Array.isArray(storage.remoteRuleSets)) {
        storage.remoteRuleSets.forEach(entry => {
            if (!entry || typeof entry !== 'object') return;
            addURL(entry.ruleURL, entry.hashURL);
        });
    }

    return urls;
}

function mergeRemoteProviderGroup(providerGroup) {
    const merged = {
        urlPattern: providerGroup[0].data?.urlPattern,
        rules: [],
        rawRules: [],
        referralMarketing: [],
        exceptions: [],
        redirections: [],
        domainPatterns: [],
        domainExceptions: [],
        domainRedirections: [],
        methods: [],
        resourceTypes: [],
        completeProvider: false,
        forceRedirection: false
    };

    providerGroup.forEach(provider => {
        const data = provider.data || {};

        if (Array.isArray(data.rules)) {
            merged.rules = [...new Set([...merged.rules, ...data.rules])];
        }
        if (Array.isArray(data.rawRules)) {
            merged.rawRules = [...new Set([...merged.rawRules, ...data.rawRules])];
        }
        if (Array.isArray(data.referralMarketing)) {
            merged.referralMarketing = [...new Set([...merged.referralMarketing, ...data.referralMarketing])];
        }
        if (Array.isArray(data.exceptions)) {
            merged.exceptions = [...new Set([...merged.exceptions, ...data.exceptions])];
        }
        if (Array.isArray(data.redirections)) {
            merged.redirections = [...new Set([...merged.redirections, ...data.redirections])];
        }
        // Handle domainPatterns: could be array or string
        if (data.domainPatterns) {
            let patterns = [];
            if (Array.isArray(data.domainPatterns)) {
                patterns = data.domainPatterns;
            } else if (typeof data.domainPatterns === 'string') {
                patterns = [data.domainPatterns];
            }
            if (patterns.length > 0) {
                merged.domainPatterns = [...new Set([...merged.domainPatterns, ...patterns])];
            }
        }
        if (Array.isArray(data.domainExceptions)) {
            merged.domainExceptions = [...new Set([...merged.domainExceptions, ...data.domainExceptions])];
        }
        if (Array.isArray(data.domainRedirections)) {
            merged.domainRedirections = [...new Set([...merged.domainRedirections, ...data.domainRedirections])];
        }
        if (Array.isArray(data.methods)) {
            merged.methods = [...new Set([...merged.methods, ...data.methods])];
        }
        if (Array.isArray(data.resourceTypes)) {
            merged.resourceTypes = [...new Set([...merged.resourceTypes, ...data.resourceTypes])];
        }

        if (data.completeProvider === true) {
            merged.completeProvider = true;
        }
        if (data.forceRedirection === true) {
            merged.forceRedirection = true;
        }
    });

    if (typeof merged.urlPattern !== 'string' || merged.urlPattern.length === 0) {
        delete merged.urlPattern;
    }

    if (merged.rules.length === 0) delete merged.rules;
    if (merged.rawRules.length === 0) delete merged.rawRules;
    if (merged.referralMarketing.length === 0) delete merged.referralMarketing;
    if (merged.exceptions.length === 0) delete merged.exceptions;
    if (merged.redirections.length === 0) delete merged.redirections;
    if (merged.domainPatterns.length === 0) delete merged.domainPatterns;
    if (merged.domainExceptions.length === 0) delete merged.domainExceptions;
    if (merged.domainRedirections.length === 0) delete merged.domainRedirections;
    if (merged.methods.length === 0) delete merged.methods;
    if (merged.resourceTypes.length === 0) delete merged.resourceTypes;
    if (merged.completeProvider !== true) delete merged.completeProvider;
    if (merged.forceRedirection !== true) delete merged.forceRedirection;

    return merged;
}

function deriveNameFromUrlPattern(urlPattern) {
    try {
        // Unescape common regex escapes: \/ -> /  and  \. -> .
        const s = urlPattern
            .replace(/\\\//g, '/')
            .replace(/\\\./g, '.');

        // Strip protocol boilerplate: ^https?://
        const withoutProtocol = s.replace(/^\^?https?\??:\/\//, '');

        // Strip leading non-capturing group prefix e.g. (?:[a-z0-9-]+.)*?
        const withoutPrefix = withoutProtocol.replace(/^\(\?:[^)]+\)\*\??/, '');

        // Match a domain-like pattern at the start of what remains
        const m = withoutPrefix.match(/^([a-z0-9][a-z0-9-]*(?:\.[a-z]{2,})*\.?)/i);
        if (m && m[1]) {
            return m[1].replace(/\.$/, '').toLowerCase();
        }

        // Fallback: find any domain-like token anywhere in the remaining string
        const anyDomain = withoutPrefix.match(/\b([a-z0-9][a-z0-9-]+(?:\.[a-z]{2,})+)/i);
        if (anyDomain) return anyDomain[1].toLowerCase();

        // Last resort: strip all regex meta-chars and return text
        const text = withoutPrefix
            .replace(/[^a-z0-9.]/gi, '')
            .replace(/^\.+|\.+$/g, '');
        if (text.length >= 2) return text.toLowerCase();
    } catch (_) {}
    return null;
}

function deriveNameFromDomainPatterns(patterns) {
    const nonWildcard = patterns.filter(p => !p.startsWith('*') && !p.startsWith('.'));
    const candidates = nonWildcard.length > 0 ? nonWildcard : patterns;
    const sorted = [...candidates].sort((a, b) => a.length - b.length);
    return sorted[0].replace(/^\*\./, '').trim() || null;
}

// When baseName already collides, try to append the first meaningful path
// segment from the URL pattern: youtube.com + /pagead → youtube.com_pagead
function derivePathQualifiedName(providerGroup, baseName) {
    for (const provider of providerGroup) {
        const up = provider.data?.urlPattern;
        if (typeof up !== 'string') continue;
        const s = up.replace(/\\\//g, '/').replace(/\\\./g, '.').replace(/\\\-/g, '-');
        const m = s.match(/[a-z0-9](?:\.[a-z]{2,})*\/?\/([a-z][a-z0-9_-]{1,})/i);
        if (m && m[1]) return `${baseName}_${m[1].toLowerCase()}`;
    }
    return null;
}

function createMergedRemoteProviderName(providerGroup) {
    // 1. Try urlPattern from any provider in the group
    for (const provider of providerGroup) {
        const up = provider.data?.urlPattern;
        if (typeof up === 'string' && up.trim()) {
            const derived = deriveNameFromUrlPattern(up.trim());
            if (derived) return derived;
        }
    }

    // 2. Try domainPatterns field
    const allDomainPatterns = [];
    for (const provider of providerGroup) {
        const dp = provider.data?.domainPatterns;
        if (Array.isArray(dp)) allDomainPatterns.push(...dp.filter(Boolean));
        else if (typeof dp === 'string' && dp.trim()) allDomainPatterns.push(dp.trim());
    }
    if (allDomainPatterns.length > 0) {
        const derived = deriveNameFromDomainPatterns(allDomainPatterns);
        if (derived) return derived;
    }

    // 3. Fallback: primary source name, or shortest existing name.
    // Strip artificial _N suffixes added during key-dedup so e.g. "dell.com_1"
    // recovers its clean name "dell.com".
    const stripSuffix = name => name.replace(/_\d+$/, '');
    const prioritized = providerGroup.filter(provider => provider.isPrimarySource);
    if (prioritized.length > 0) return stripSuffix(prioritized[0].name);
    const names = providerGroup.map(provider => provider.name);
    names.sort((a, b) => a.length - b.length);
    return stripSuffix(names[0]);
}

function mergeRemoteProvidersByUrlPattern(providers, primaryProviderNames = new Set()) {
    const providerGroups = {}; // key → array of providers

    const normalizedProviders = normalizeProviderEntries(providers, primaryProviderNames);

    normalizedProviders.forEach(provider => {
        const providerName = typeof provider.name === 'string' && provider.name.trim() !== ''
            ? provider.name
            : 'provider';
        const providerData = provider.data;
        const key = getProviderGroupKey(providerData, providerName);
        if (key.startsWith('no-pattern:')) {
            return;
        }
        if (!providerGroups[key]) {
            providerGroups[key] = [];
        }
        providerGroups[key].push({
            name: providerName,
            data: providerData,
            isPrimarySource: provider.isPrimarySource === true
        });
    });

    const mergedProviders = {};
    const usedNames = new Set();

    Object.values(providerGroups).forEach(providerGroup => {
        let finalProvider;
        if (providerGroup.length === 1) {
            finalProvider = providerGroup[0].data;
        } else {
            finalProvider = mergeRemoteProviderGroup(providerGroup);
        }

        const baseName = createMergedRemoteProviderName(providerGroup);
        let finalName = baseName;
        if (usedNames.has(finalName)) {
            const pathName = derivePathQualifiedName(providerGroup, baseName);
            if (pathName && !usedNames.has(pathName)) {
                finalName = pathName;
            } else {
                let counter = 1;
                do { finalName = `${baseName}_${counter++}`; } while (usedNames.has(finalName));
            }
        }
        usedNames.add(finalName);
        mergedProviders[finalName] = finalProvider;
    });

    return mergedProviders;
}

function mergeRemoteRulesSources(successfulSources, failedSources = []) {
    const combinedProviders = [];
    let mergedMetadata = null;

    successfulSources.forEach((source, sourceIndex) => {
        const providers = source.rules?.providers || {};
        Object.entries(providers).forEach(([providerName, providerData]) => {
            combinedProviders.push({
                name: providerName,
                data: providerData,
                isPrimarySource: sourceIndex === 0
            });
        });

        if (!mergedMetadata && source.rules?.metadata) {
            mergedMetadata = { ...source.rules.metadata };
        }
    });

    const mergedProviders = mergeRemoteProvidersByUrlPattern(combinedProviders);
    const mergedRules = { providers: mergedProviders };
    const mergedProviderCount = Object.keys(mergedProviders).length;

    if (mergedProviderCount === 0) {
        throw new Error('No providers found after merging remote rule sources');
    }

    const hasRemoteMetadata = !!(mergedMetadata && typeof mergedMetadata === 'object' && !Array.isArray(mergedMetadata));

    if (hasRemoteMetadata) {
        const mergedMetadataName = 'Merged Remote Rules';
        const singleSourceMetadataName = mergedMetadata?.name || 'Remote Rules';

        mergedRules.metadata = {
            ...(mergedMetadata || {}),
            name: successfulSources.length > 1 ? mergedMetadataName : singleSourceMetadataName,
            source: successfulSources.length > 1 ? 'remote_merged' : 'remote',
            sourceURL: successfulSources.length > 1 ? 'multiple' : successfulSources[0].ruleURL,
            providerCount: mergedProviderCount,
            mergedSourceCount: successfulSources.length,
            failedSourceCount: failedSources.length,
            remoteSources: successfulSources.map(source => ({
                ruleURL: source.ruleURL,
                hashURL: source.hashURL,
                providerCount: Object.keys(source.rules?.providers || {}).length
            })),
            failedSources: failedSources.map(source => ({
                ruleURL: source.ruleURL,
                hashURL: source.hashURL,
                error: source.error
            }))
        };
    } else {
        mergedRules.metadata = {
            source: successfulSources.length > 1 ? 'remote_merged' : 'remote',
            sourceURL: successfulSources.length > 1 ? 'multiple' : successfulSources[0].ruleURL,
            providerCount: mergedProviderCount,
            mergedSourceCount: successfulSources.length,
            failedSourceCount: failedSources.length,
            remoteSources: successfulSources.map(source => ({
                ruleURL: source.ruleURL,
                hashURL: source.hashURL,
                providerCount: Object.keys(source.rules?.providers || {}).length
            })),
            failedSources: failedSources.map(source => ({
                ruleURL: source.ruleURL,
                hashURL: source.hashURL,
                error: source.error
            }))
        };
    }

    return mergedRules;
}

function mergeRemoteWithBundledRules(remoteRules, bundledRules) {
    const remoteProviders = remoteRules?.providers || {};
    const bundledProviders = bundledRules?.providers || {};
    const combinedProviders = [];

    Object.entries(bundledProviders).forEach(([providerName, providerData]) => {
        combinedProviders.push({
            name: providerName,
            data: providerData,
            isPrimarySource: false
        });
    });

    Object.entries(remoteProviders).forEach(([providerName, providerData]) => {
        combinedProviders.push({
            name: providerName,
            data: providerData,
            isPrimarySource: true
        });
    });

    const mergedProviders = mergeRemoteProvidersByUrlPattern(combinedProviders);
    const mergedProviderCount = Object.keys(mergedProviders).length;

    const remoteMetadata = (remoteRules?.metadata && typeof remoteRules.metadata === 'object' && !Array.isArray(remoteRules.metadata))
        ? remoteRules.metadata
        : null;

    const metadata = remoteMetadata ? { ...remoteMetadata } : {};
    metadata.name = 'Merged Remote + Built-in Rules';
    metadata.source = 'remote_built_in_merged';
    metadata.sourceURL = 'multiple';
    metadata.providerCount = mergedProviderCount;

    return {
        metadata,
        providers: mergedProviders
    };
}

function areValidRemoteURLsPresent() {

     if (!storage.remoteRulesEnabled) {
        return false;
    }

    return getConfiguredRemoteRuleSets().length > 0;
}

function saveOnExit() {
    saveOnDisk(Object.keys(storage));
}

function storageAsJSON() {
    let json = {};
    
    const version = browser.runtime.getManifest().version;
    const extensionname = browser.runtime.getManifest().name;
    const rulesInfo = getRulesInfo();
    
    json.exportMetadata = {
        ExtensionName: extensionname,
        extensionVersion: version,
        exportDate: new Date().toISOString(),
        rulesName: rulesInfo.name,
        rulesVersion: rulesInfo.version,
        rulesLicense: rulesInfo.license
    };
    
    Object.entries(storage).forEach(([key, value]) => {
        // Skip ClearURLsData, linkumori-theme and dataHash from export
        if (
            key !== 'ClearURLsData' &&
            key !== 'linkumori-theme' &&
            key !== 'dataHash' &&
            key !== POST_RELOAD_OPEN_URL_STORAGE_KEY
        ) {
            json[key] = storageDataAsString(key);
        }
    });

    return json;
}

function minifyCustomRules(data) {
    if (!data || !data.providers) {
        return null;
    }
    
    let minifiedData = { providers: {} };
    
    for (let provider in data.providers) {
        let self = {};
        let hasContent = false;
        
        if (data.providers[provider].completeProvider === true) {
            self.completeProvider = true;
            hasContent = true;
        }
        
        if (data.providers[provider].forceRedirection === true) {
            self.forceRedirection = true;
            hasContent = true;
        }
        
        if (data.providers[provider].urlPattern && data.providers[provider].urlPattern !== "") {
            self.urlPattern = data.providers[provider].urlPattern;
            hasContent = true;
        }
        
        if (data.providers[provider].rules && data.providers[provider].rules.length !== 0) {
            self.rules = data.providers[provider].rules;
            hasContent = true;
        }
        
        if (data.providers[provider].rawRules && data.providers[provider].rawRules.length !== 0) {
            self.rawRules = data.providers[provider].rawRules;
            hasContent = true;
        }
        
        if (data.providers[provider].referralMarketing && data.providers[provider].referralMarketing.length !== 0) {
            self.referralMarketing = data.providers[provider].referralMarketing;
            hasContent = true;
        }
        
        if (data.providers[provider].exceptions && data.providers[provider].exceptions.length !== 0) {
            self.exceptions = data.providers[provider].exceptions;
            hasContent = true;
        }
        
        if (data.providers[provider].redirections && data.providers[provider].redirections.length !== 0) {
            self.redirections = data.providers[provider].redirections;
            hasContent = true;
        }
        
        if (data.providers[provider].domainPatterns && data.providers[provider].domainPatterns.length !== 0) {
            self.domainPatterns = data.providers[provider].domainPatterns;
            hasContent = true;
        }
        
        if (data.providers[provider].domainExceptions && data.providers[provider].domainExceptions.length !== 0) {
            self.domainExceptions = data.providers[provider].domainExceptions;
            hasContent = true;
        }
        
        if (data.providers[provider].domainRedirections && data.providers[provider].domainRedirections.length !== 0) {
            self.domainRedirections = data.providers[provider].domainRedirections;
            hasContent = true;
        }
        
        if (data.providers[provider].methods && data.providers[provider].methods.length !== 0) {
            self.methods = data.providers[provider].methods;
            hasContent = true;
        }
        
        if (data.providers[provider].resourceTypes && data.providers[provider].resourceTypes.length !== 0) {
            self.resourceTypes = data.providers[provider].resourceTypes;
            hasContent = true;
        }
        
        if (hasContent) {
            minifiedData.providers[provider] = self;
        }
    }
    
    if (Object.keys(minifiedData.providers).length === 0) {
        return null;
    }
    
    return minifiedData;
}

function storageDataAsString(key) {
    let value = storage[key];

    switch (key) {
        case "ClearURLsData":
            return null;
        case "log":
            return JSON.stringify(value);
        case "userWhitelist":
            if (Array.isArray(value)) {
                return JSON.stringify(value);
            } else if (typeof value === 'string') {
                return value;
            } else {
                return JSON.stringify([]);
            }
        case "custom_rules":
            const minifiedRules = minifyCustomRules(value);
            if (minifiedRules === null) {
                return JSON.stringify({ providers: {} });
            }
            return JSON.stringify(minifiedRules);
        case "linkumori_url_custom_rules":
            try {
                return JSON.stringify(value && typeof value === 'object' ? value : { rules: [] });
            } catch (e) {
                return JSON.stringify({ rules: [] });
            }
        case "remoteRulescache":
            try { return JSON.stringify(value); } catch (e) { return JSON.stringify(null); }
        case "LinkumoriURLsData":
            try { return JSON.stringify(value); } catch (e) { return JSON.stringify({ format: 'linkumori-url-filter-interoperability', rules: [] }); }
        case "types":
            return value.toString();
        default:
            return value;
    }
}

function deleteFromDisk(key) {
    browser.storage.local.remove(key).catch(handleError);
}

function saveOnDisk(keys) {
    let json = {};

    keys.forEach(function (key) {
        const value = storageDataAsString(key);
        if (value !== null) {
            json[key] = value;
        }
    });

    browser.storage.local.set(json).catch(handleError);
}

function deferSaveOnDisk(key) {
    if (hasPendingSaves) {
        pendingSaves.add(key);
        return;
    }

    browser.alarms.create("deferSaveOnDisk", {
        delayInMinutes: 1
    });

    hasPendingSaves = true;
}

browser.alarms.onAlarm.addListener(function (alarmInfo) {
    if (alarmInfo.name === "deferSaveOnDisk") {
        saveOnDisk(Array.from(pendingSaves));
        pendingSaves.clear();
        hasPendingSaves = false;
    }
});

async function verifyRulesHash(rulesData, expectedHash) {
    const verificationResult = {
        verified: false,
        computedHash: null,
        expectedHash: expectedHash,
        hashMatch: false,
        timestamp: new Date().toISOString(),
        error: null
    };
    
    try {
        const computedHash = await sha256(rulesData);
        verificationResult.computedHash = computedHash;
        
        verificationResult.hashMatch = computedHash === expectedHash;
        verificationResult.verified = verificationResult.hashMatch;
        
        if (!verificationResult.verified) {
            verificationResult.error = `Hash mismatch: expected ${expectedHash}, got ${computedHash}`;
        }
        
    } catch (error) {
        verificationResult.error = `Hash computation failed: ${error.message}`;
    }
    
    return verificationResult;
}

function saveRemoteRulesCache(remoteRules, meta) {
    if (!storage.remoteRulescache || typeof storage.remoteRulescache !== 'object') {
        storage.remoteRulescache = {};
    }

    storage.remoteRulescache = {
        verified: true,
        data: remoteRules
    };

    try {
        saveOnDisk(['remoteRulescache']);
    } catch (e) {
    }
}

function loadRemoteRulesFromCache(expectedHash = null, cacheReason = 'cache_used') {
    const cache = storage.remoteRulescache;

    if (!cache || typeof cache !== 'object' || Array.isArray(cache)) {
        return null;
    }

    if (cache.verified === false) {
        return null;
    }

    const cachedData = cache.data;
    if (!cachedData || typeof cachedData !== 'object' || !cachedData.providers || Object.keys(cachedData.providers).length === 0) {
        return null;
    }

    storage.rulesMetadata = null;
    
    if (cachedData.metadata) {
        storage.rulesMetadata = cachedData.metadata;
        storage.rulesMetadata.source = 'remote_cache';
        storage.rulesMetadata.sourceURL = 'cache';
    }

    storage.hashStatus = `cache_remote_rules_${cacheReason}`;
    tempVerificationCache.isRemoteVerified = false;
    tempVerificationCache.isCacheUsed = true;
    updateRemoteRulesHealth({
        lastFailureStage: 'cache_fallback',
        lastFailureReason: storage.hashFailureReason || storage.remoteRulesHealth?.lastFailureReason || null
    }, true);

    return cachedData;
}

function saveEmptyLinkumoriURLsData(status = 'empty') {
    storage.LinkumoriURLsData = {
        metadata: {
            name: linkumoriStorageI18n('linkumori_url_filter_name'),
            source: 'linkumori_urls_empty',
            status,
            ruleStatus: status,
            hashStatus: 'not_required',
            sourceCount: 0,
            supportedRuleCount: 0,
            skippedUnsupportedRuleCount: 0,
            skippedDuplicateRuleCount: 0
        },
        format: 'linkumori-url-filter-interoperability',
        rules: []
    };
    saveOnDisk(['LinkumoriURLsData']);
    return storage.LinkumoriURLsData;
}

function parseLinkumoriURLCustomRulesData() {
    const customData = storage.linkumori_url_custom_rules || { rules: [] };
    const rawRules = Array.isArray(customData.rules)
        ? customData.rules
        : (typeof customData === 'string' ? customData.split(/\r?\n/) : []);
    const text = rawRules
        .map(rule => typeof rule === 'string' ? rule.trim() : '')
        .filter(Boolean)
        .join('\n');

    if (!text) {
        return null;
    }

    if (!globalThis.LinkumoriURLFilterInteroperability ||
        typeof globalThis.LinkumoriURLFilterInteroperability.parseFilterList !== 'function') {
        throw new Error(linkumoriStorageI18n('linkumori_url_filter_parser_unavailable'));
    }

    const parsed = globalThis.LinkumoriURLFilterInteroperability.parseFilterList(text, 'linkumori_url_custom_rules');
    parsed.metadata = {
        ...(parsed.metadata || {}),
        name: linkumoriStorageI18n('linkumori_url_filter_custom_name'),
        source: 'linkumori_urls_custom',
        sourceURL: 'linkumori_url_custom_rules',
        status: 'loaded',
        ruleStatus: 'loaded',
        hashStatus: 'not_required',
        lastFetchAttemptAt: null,
        lastFetchSuccessAt: null
    };
    return parsed;
}

function getLinkumoriURLCustomSource() {
    try {
        const parsed = parseLinkumoriURLCustomRulesData();
        if (!parsed) {
            return null;
        }
        return {
            url: 'linkumori_url_custom_rules',
            data: parsed
        };
    } catch (error) {
        return {
            url: 'linkumori_url_custom_rules',
            error: error?.message || linkumoriStorageI18n('linkumori_url_filter_custom_failed')
        };
    }
}

function mergeLinkumoriURLFilterSources(successfulSources, failedSources = []) {
    const rules = [];
    const seen = new Set();
    const disabledRules = new Set(Array.isArray(storage[LINKUMORI_URL_DISABLED_RULES_KEY])
        ? storage[LINKUMORI_URL_DISABLED_RULES_KEY].map(rule => String(rule || '').trim()).filter(Boolean)
        : []);
    let skippedUnsupportedRuleCount = 0;
    let skippedDuplicateRuleCount = 0;
    let disabledRuleCount = 0;
    let lastFetchAttemptAt = null;
    let lastFetchSuccessAt = null;

    successfulSources.forEach(source => {
        const sourceRules = Array.isArray(source.data?.rules) ? source.data.rules : [];
        skippedUnsupportedRuleCount += Number(source.data?.metadata?.skippedUnsupportedRuleCount || 0);
        skippedDuplicateRuleCount += Number(source.data?.metadata?.skippedDuplicateRuleCount || 0);
        lastFetchAttemptAt = source.data?.metadata?.lastFetchAttemptAt || lastFetchAttemptAt;
        lastFetchSuccessAt = source.data?.metadata?.lastFetchSuccessAt || lastFetchSuccessAt;

        sourceRules.forEach(rule => {
            if (disabledRules.has(rule)) {
                disabledRuleCount++;
                return;
            }
            if (seen.has(rule)) {
                skippedDuplicateRuleCount++;
                return;
            }
            seen.add(rule);
            rules.push(rule);
        });
    });

    return {
        metadata: {
            name: successfulSources.length > 1
                ? linkumoriStorageI18n('linkumori_url_filter_merged_name')
                : (successfulSources[0]?.data?.metadata?.name || linkumoriStorageI18n('linkumori_url_filter_single_name')),
            source: successfulSources.length > 1 ? 'linkumori_urls_merged' : (successfulSources[0]?.data?.metadata?.source || 'linkumori_urls_remote'),
            status: failedSources.length > 0 ? 'partially_loaded' : 'loaded',
            ruleStatus: failedSources.length > 0 ? 'partially_loaded' : 'loaded',
            hashStatus: 'not_required',
            sourceURL: successfulSources.length > 1 ? 'multiple' : successfulSources[0]?.url || null,
            sourceCount: successfulSources.length,
            failedSourceCount: failedSources.length,
            supportedRuleCount: rules.length,
            disabledRuleCount,
            skippedUnsupportedRuleCount,
            skippedDuplicateRuleCount,
            lastFetchAttemptAt,
            lastFetchSuccessAt,
            lastFailureReason: failedSources.length > 0
                ? linkumoriStorageI18n('linkumori_url_filter_sources_failed_count', [String(failedSources.length)])
                : null,
            remoteSources: successfulSources.map(source => ({
                ruleURL: source.url,
                supportedRuleCount: Array.isArray(source.data?.rules) ? source.data.rules.length : 0
            })),
            failedSources
        },
        format: 'linkumori-url-filter-interoperability',
        rules
    };
}

async function fetchLinkumoriURLFilter(url) {
    const fetchedAt = new Date().toISOString();
    recordRemoteFetchAttempt(url, null);
    try {
        const response = await fetch(url, {
            method: 'GET',
            cache: 'no-store'
        });
        if (!response.ok) {
            throw new Error(`HTTP ${response.status}: ${response.statusText}`);
        }

        const text = await response.text();
        if (!text || text.trim().length === 0) {
            throw new Error(linkumoriStorageI18n('linkumori_url_filter_remote_empty'));
        }
        if (!globalThis.LinkumoriURLFilterInteroperability ||
            typeof globalThis.LinkumoriURLFilterInteroperability.parseFilterList !== 'function') {
            throw new Error(linkumoriStorageI18n('linkumori_url_filter_parser_unavailable'));
        }

        const parsed = globalThis.LinkumoriURLFilterInteroperability.parseFilterList(text, url);
        recordRemoteFetchSuccess(url, null);
        parsed.metadata = {
            ...(parsed.metadata || {}),
            status: 'loaded',
            ruleStatus: 'loaded',
            hashStatus: 'not_required',
            lastFetchAttemptAt: fetchedAt,
            lastFetchSuccessAt: new Date().toISOString()
        };
        return parsed;
    } catch (error) {
        recordRemoteFetchFailure(error?.message || linkumoriStorageI18n('linkumori_url_filter_fetch_failed'), 'linkumori_url_filter_fetch', url, null);
        throw error;
    }
}

async function loadLinkumoriURLFilters() {
    const customSource = getLinkumoriURLCustomSource();
    const successful = [];
    const failed = [];

    if (customSource) {
        if (customSource.data) {
            successful.push(customSource);
        } else {
            failed.push({
                ruleURL: customSource.url,
                error: customSource.error || linkumoriStorageI18n('linkumori_url_filter_custom_failed')
            });
        }
    }

    const urls = getConfiguredLinkumoriURLFilterURLs();
    if (!storage.remoteRulesEnabled || urls.length === 0) {
        if (successful.length > 0) {
            storage.LinkumoriURLsData = mergeLinkumoriURLFilterSources(successful, failed);
            if (!storage.remoteRulesEnabled) {
                storage.LinkumoriURLsData.metadata.remoteStatus = 'remote_disabled';
            } else {
                storage.LinkumoriURLsData.metadata.remoteStatus = 'no_hashless_sources';
            }
            saveOnDisk(['LinkumoriURLsData']);
            return storage.LinkumoriURLsData;
        }

        const emptyStatus = !storage.remoteRulesEnabled ? 'remote_disabled' : 'no_hashless_sources';
        const empty = saveEmptyLinkumoriURLsData(emptyStatus);
        if (failed.length > 0) {
            empty.metadata.failedSources = failed;
            empty.metadata.failedSourceCount = failed.length;
            empty.metadata.lastFailureReason = failed[0]?.error || linkumoriStorageI18n('linkumori_url_filter_custom_failed');
            saveOnDisk(['LinkumoriURLsData']);
        }
        return empty;
    }

    const results = await Promise.allSettled(urls.map(async url => ({
        url,
        data: await fetchLinkumoriURLFilter(url)
    })));

    results.forEach((result, index) => {
        const url = urls[index];
        if (result.status === 'fulfilled') {
            successful.push(result.value);
        } else {
            failed.push({
                ruleURL: url,
                error: result.reason?.message || linkumoriStorageI18n('linkumori_url_filter_unknown_error')
            });
        }
    });

    if (successful.length === 0) {
        const empty = saveEmptyLinkumoriURLsData('all_sources_failed');
        empty.metadata.failedSources = failed;
        empty.metadata.failedSourceCount = failed.length;
        empty.metadata.lastFailureReason = failed[0]?.error || linkumoriStorageI18n('linkumori_url_filter_all_sources_failed');
        saveOnDisk(['LinkumoriURLsData']);
        return empty;
    }

    storage.LinkumoriURLsData = mergeLinkumoriURLFilterSources(successful, failed);
    saveOnDisk(['LinkumoriURLsData']);
    return storage.LinkumoriURLsData;
}

function reloadLinkumoriURLFilters() {
    return loadLinkumoriURLFilters().then((data) => {
        let appliedLive = false;
        if (typeof globalThis.updateLinkumoriURLFilterRuntimeData === 'function') {
            appliedLive = !!globalThis.updateLinkumoriURLFilterRuntimeData();
        }
        return {
            data,
            appliedLive
        };
    });
}

function fetchRemoteRules(url, expectedHash = null, hashURLForHealth = null) {
    return new Promise((resolve, reject) => {
        const hashUrlForHealth = hashURLForHealth || storage.hashURL || null;
        recordRemoteFetchAttempt(url, hashUrlForHealth);

        if (!storage.remoteRulesEnabled) {
            const error = new Error('Remote rules are disabled');
            recordRemoteFetchFailure(error.message, 'remote_disabled', url, hashUrlForHealth);
            reject(error);
            return;
        }

        if (!areValidRemoteURLsPresent()) {
            const error = new Error('SECURITY BLOCK: Network calls require both valid ruleURL and hashURL');
            recordRemoteFetchFailure(error.message, 'invalid_remote_urls', url, hashUrlForHealth);
            reject(error);
            return;
        }
        
        if (!url || typeof url !== 'string' || url.trim() === '') {
            const error = new Error('Invalid URL provided');
            recordRemoteFetchFailure(error.message, 'invalid_rule_url', url, hashUrlForHealth);
            reject(error);
            return;
        }

        if (!expectedHash || typeof expectedHash !== 'string' || expectedHash.trim() === '') {
            const error = new Error('SECURITY ERROR: Hash verification is MANDATORY for remote rules. No expected hash provided.');
            recordRemoteFetchFailure(error.message, 'missing_expected_hash', url, hashUrlForHealth);
            reject(error);
            return;
        }

       fetch(url)
       .then(response => {
            if (!response.ok) {
                throw new Error(`HTTP ${response.status}: ${response.statusText}`);
            }
            return response.text();
        })
        .then(async data => {
            if (!data || data.trim().length === 0) {
                throw new Error('Remote rules file is empty');
            }

            const verification = await verifyRulesHash(data, expectedHash);
            
            tempVerificationCache.lastVerification = verification;
            tempVerificationCache.isRemoteVerified = verification.verified;
            tempVerificationCache.isCacheUsed = false;
            recordHashVerification(verification, url, hashUrlForHealth);

            if (!verification.verified) {
                const securityError = new Error(`SECURITY ERROR: ${verification.error}`);
                recordRemoteFetchFailure(securityError.message, 'hash_verification', url, hashUrlForHealth);
                reject(securityError);
                return;
            }

            let remoteRulesData;
            try {
                remoteRulesData = JSON.parse(data);
            } catch (parseError) {
                throw new Error(`Invalid JSON in remote rules: ${parseError.message}`);
            }

            if (!remoteRulesData || typeof remoteRulesData !== 'object') {
                throw new Error('Remote rules file does not contain valid object');
            }

            storage.rulesMetadata = null;
            
            if (remoteRulesData.metadata) {
                storage.rulesMetadata = remoteRulesData.metadata;
                storage.rulesMetadata.source = 'remote';
                storage.rulesMetadata.sourceURL = url;
            }

            const remoteRules = remoteRulesData;

            if (!remoteRules.providers || typeof remoteRules.providers !== 'object') {
                throw new Error('Remote rules missing providers object');
            }

            const providerCount = Object.keys(remoteRules.providers).length;
            if (providerCount === 0) {
                throw new Error('No providers found in remote rules');
            }

            storage.hashStatus = "remote_verified";
            storage.hashFailureReason = null;
            recordRemoteFetchSuccess(url, hashUrlForHealth);

            saveRemoteRulesCache(remoteRules, {
                ruleURL: url,
                hashURL: storage.hashURL || '',
                expectedHash: expectedHash,
                computedHash: verification.computedHash,
                timestamp: verification.timestamp
            });

            resolve(remoteRules);
        })
        .catch(error => {
            storage.hashFailureReason = error.message;
            storage.hashStatus = "remote_failed";
            tempVerificationCache.isRemoteVerified = false;
            recordRemoteFetchFailure(error.message, 'remote_fetch', url, hashUrlForHealth);
            reject(error);
        });
    });
}

function fetchRemoteHash(hashUrl, ruleURLForHealth = null) {
    return new Promise((resolve, reject) => {
        const ruleUrlForHealth = ruleURLForHealth || storage.ruleURL || null;
        recordRemoteFetchAttempt(ruleUrlForHealth, hashUrl);

        if (!storage.remoteRulesEnabled) {
            const error = new Error('Remote rules are disabled');
            recordRemoteFetchFailure(error.message, 'remote_disabled', ruleUrlForHealth, hashUrl);
            reject(error);
            return;
        }

        if (!areValidRemoteURLsPresent()) {
            const error = new Error('SECURITY BLOCK: Network calls require both valid ruleURL and hashURL');
            recordRemoteFetchFailure(error.message, 'invalid_remote_urls', ruleUrlForHealth, hashUrl);
            reject(error);
            return;
        }
        
        if (!hashUrl || typeof hashUrl !== 'string' || hashUrl.trim() === '') {
            const error = new Error('Invalid hash URL provided');
            recordRemoteFetchFailure(error.message, 'invalid_hash_url', ruleUrlForHealth, hashUrl);
            reject(error);
            return;
        }

        fetch(hashUrl, {
            method: 'GET',
            cache: 'no-store'
        })
        .then(response => {
            if (!response.ok) {
                throw new Error(`HTTP ${response.status}: ${response.statusText}`);
            }
            return response.text();
        })
        .then(hash => {
            const cleanHash = hash.trim();
            if (!cleanHash) {
                throw new Error('Remote hash is empty');
            }
            
            if (!/^[a-fA-F0-9]{32,128}$/.test(cleanHash)) {
                throw new Error('Invalid hash format received');
            }
            
            recordRemoteFetchSuccess(ruleUrlForHealth, hashUrl);
            resolve(cleanHash);
        })
        .catch(error => {
            recordRemoteFetchFailure(error.message, 'hash_fetch', ruleUrlForHealth, hashUrl);
            reject(error);
        });
    });
}

async function fetchBundledRulesRaw() {
    const payload = await fetchBundledRulesText();
    const rawRulesData = JSON.parse(payload.text);
    validateBundledRulesData(rawRulesData);
    return rawRulesData;
}

async function fetchBundledRulesText() {
    const compressedURL = browser.runtime.getURL('data/linkumori-clearurls-min.json.lz4');
    if (
        !globalThis.LinkumoriLZ4 ||
        typeof globalThis.LinkumoriLZ4.decompressToString !== 'function'
    ) {
        throw new Error('Linkumori LZ4 decoder is not available');
    }

    const compressedResponse = await fetch(compressedURL);
    if (!compressedResponse.ok) {
        throw new Error(`HTTP ${compressedResponse.status}: ${compressedResponse.statusText} - LZ4 rules file not accessible`);
    }

    const compressedBytes = new Uint8Array(await compressedResponse.arrayBuffer());
    const text = globalThis.LinkumoriLZ4.decompressToString(compressedBytes);
    if (!text || text.trim().length === 0) {
        throw new Error('LZ4 rules file is empty after decompression');
    }
    validateBundledRulesData(JSON.parse(text));

    return {
        text,
        source: 'bundled_lz4'
    };
}

function validateBundledRulesData(rawRulesData) {
    if (!rawRulesData || typeof rawRulesData !== 'object') {
        throw new Error('Rules file does not contain a valid object');
    }
    if (!rawRulesData.providers || typeof rawRulesData.providers !== 'object') {
        throw new Error('Rules file missing providers object');
    }
    if (Object.keys(rawRulesData.providers).length === 0) {
        throw new Error('No providers found in rules file');
    }
}

function normalizeRulesForProviderImport(rulesData, fallbackName, fallbackSource) {
    const providers = (rulesData && typeof rulesData === 'object' && rulesData.providers && typeof rulesData.providers === 'object')
        ? rulesData.providers
        : {};
    const metadata = (rulesData && typeof rulesData === 'object' && rulesData.metadata && typeof rulesData.metadata === 'object')
        ? rulesData.metadata
        : {};

    return {
        ...rulesData,
        metadata: {
            ...metadata,
            name: metadata.name || fallbackName,
            source: metadata.source || fallbackSource
        },
        providers
    };
}

async function getBundledRulesOnly() {
    const bundledRules = await fetchBundledRulesRaw();
    return normalizeRulesForProviderImport(bundledRules, 'Bundled Rules', 'bundled');
}

function getExistingLinkumoriDataForImport() {
    const data = storage.LinkumoriURLsData || {};
    return {
        metadata: {
            ...(data.metadata || {}),
            name: data.metadata?.name || 'Linkumori URL Filters',
            source: data.metadata?.source || 'linkumori_urls_data'
        },
        format: 'linkumori-url-filter-interoperability',
        type: 'linkumori-url-rules',
        rules: Array.isArray(data.rules) ? data.rules : []
    };
}

function loadBundledRules() {
    if (storage.builtInRulesEnabled === false && !storage.remoteRulesEnabled) {
        storage.hashStatus = "custom_only_loaded";
        storage.hashValidationStatus = 'not_applicable';
        tempVerificationCache.isRemoteVerified = false;
        recordRemoteFetchFailure('Remote rules are disabled', 'remote_disabled');
        return loadCustomOnlyRules();
    }

    if (!areValidRemoteURLsPresent()) {
        const hasLinkumoriURLFilters = getConfiguredLinkumoriURLFilterURLs().length > 0;
        storage.hashStatus = "no_remote_urls";
        storage.hashValidationStatus = 'not_applicable';
        tempVerificationCache.isRemoteVerified = false;
        if (hasLinkumoriURLFilters) {
            updateRemoteRulesHealth({
                lastFailureReason: null,
                lastFailureStage: null
            }, true);
        } else {
            recordRemoteFetchFailure('No valid remote rule/hash URL pairs configured', 'invalid_remote_urls');
        }

        if (storage.builtInRulesEnabled === false) {
            storage.hashStatus = "custom_only_loaded";
            return loadCustomOnlyRules();
        }

        return loadBundledRulesInternal(false);
    }

    const configuredRemoteSets = getConfiguredRemoteRuleSets();

    if (configuredRemoteSets.length === 0) {
        storage.hashStatus = "invalid_remote_urls";
        storage.hashValidationStatus = 'failed_validation';
        tempVerificationCache.isRemoteVerified = false;
        recordRemoteFetchFailure('Remote rule sets are invalid', 'invalid_remote_urls');

        if (storage.builtInRulesEnabled === false) {
            storage.hashStatus = "custom_only_loaded";
            return loadCustomOnlyRules();
        }

        return loadBundledRulesInternal(false);
    }

    const fetchJobs = configuredRemoteSets.map(set => {
        return fetchRemoteHash(set.hashURL, set.ruleURL)
            .then(remoteHash => fetchRemoteRules(set.ruleURL, remoteHash, set.hashURL))
            .then(rules => ({
                ruleURL: set.ruleURL,
                hashURL: set.hashURL,
                rules
            }));
    });

    return Promise.allSettled(fetchJobs)
        .then(async results => {
            const successful = [];
            const failed = [];

            results.forEach((result, index) => {
                const set = configuredRemoteSets[index];
                if (result.status === 'fulfilled') {
                    successful.push(result.value);
                } else {
                    failed.push({
                        ruleURL: set.ruleURL,
                        hashURL: set.hashURL,
                        error: result.reason?.message || 'Unknown remote source error'
                    });
                }
            });

            if (successful.length === 0) {
                throw new Error(failed.map(item => item.error).join('; ') || 'All remote sources failed');
            }

            const mergedRemoteRules = mergeRemoteRulesSources(successful, failed);
            let finalRules = mergedRemoteRules;

            if (storage.overloadModeEnabled === true && storage.builtInRulesEnabled !== false) {
                try {
                    const bundledRules = await fetchBundledRulesRaw();
                    finalRules = mergeRemoteWithBundledRules(mergedRemoteRules, bundledRules);
                } catch (e) {
                }
            }

            storage.rulesMetadata = finalRules.metadata;
            storage.hashFailureReason = failed.length > 0
                ? failed.map(item => item.error).join('; ')
                : null;
            if (failed.length > 0) {
                recordRemoteFetchFailure(storage.hashFailureReason, 'partial_remote_failure');
            } else {
                recordRemoteFetchSuccess(successful[0]?.ruleURL || null, successful[0]?.hashURL || null);
            }

            if (storage.overloadModeEnabled === true && storage.builtInRulesEnabled !== false) {
                storage.hashStatus = "remote_built_in_merged";
                storage.hashValidationStatus = failed.length > 0 ? 'partially_verified' : 'verified';
            } else {
                if (successful.length > 1 && failed.length === 0) {
                    storage.hashStatus = "remote_rules_merged";
                    storage.hashValidationStatus = 'verified';
                } else if (successful.length > 1 && failed.length > 0) {
                    storage.hashStatus = "remote_rules_partially_merged";
                    storage.hashValidationStatus = 'partially_verified';
                } else if (successful.length === 1 && failed.length > 0) {
                    storage.hashStatus = "remote_partially_verified";
                    storage.hashValidationStatus = 'partially_verified';
                } else {
                    storage.hashStatus = "remote_verified";
                    storage.hashValidationStatus = 'verified';
                }
            }

            tempVerificationCache.isRemoteVerified = true;
            tempVerificationCache.isCacheUsed = false;

            saveRemoteRulesCache(mergedRemoteRules, {
                sourceCount: successful.length,
                failedSourceCount: failed.length,
                timestamp: new Date().toISOString()
            });

            return mergeCustomRules(finalRules);
        })
        .catch(async (error) => {
            storage.hashValidationStatus = 'failed';
            tempVerificationCache.isRemoteVerified = false;
            const failureMessage = storage.hashFailureReason || error?.message || 'All remote sources failed';
            storage.hashFailureReason = failureMessage;
            recordRemoteFetchFailure(failureMessage, 'all_remote_failed');
            
            const cacheRules = loadRemoteRulesFromCache(null, 'after_remote_failure');
            if (cacheRules) {
                storage.hashValidationStatus = 'cache_used_after_remote_failure';

                if (storage.overloadModeEnabled === true && storage.builtInRulesEnabled !== false) {
                    try {
                        const bundledRules = await fetchBundledRulesRaw();
                        const mergedCachedRules = mergeRemoteWithBundledRules(cacheRules, bundledRules);
                        storage.hashStatus = "cache_remote_built_in_merged";
                        return mergeCustomRules(mergedCachedRules);
                    } catch (mergeError) {
                        // Fall back to cached remote-only rules when bundled rules cannot be loaded.
                    }
                }

                return mergeCustomRules(cacheRules);
            }

            if (storage.builtInRulesEnabled === false) {
                storage.hashStatus = "custom_only_loaded";
                return loadCustomOnlyRules();
            }

            return loadBundledRulesInternal(true);
        });
}

function loadBundledRulesInternal(isFallback = false) {
    if (storage.builtInRulesEnabled === false) {
        storage.hashStatus = "custom_only_loaded";
        return loadCustomOnlyRules();
    }

    return fetchBundledRulesRaw()
        .then(async rawRulesData => {
            validateBundledRulesData(rawRulesData);
            
            if (!rawRulesData || typeof rawRulesData !== 'object') {
                throw new Error('Rules file does not contain a valid object');
            }
            
            if (rawRulesData.metadata) {
                storage.rulesMetadata = rawRulesData.metadata;
                storage.rulesMetadata.source = 'bundled';
            }
            
            const bundledRules = rawRulesData;
            
            if (!bundledRules.providers || typeof bundledRules.providers !== 'object') {
                throw new Error('Rules file missing providers object');
            }
            
            const providerCount = Object.keys(bundledRules.providers).length;
            if (providerCount === 0) {
                throw new Error('No providers found in rules file');
            }
            
            const bundledRulesHash = await sha256(JSON.stringify(bundledRules, Object.keys(bundledRules).sort()));
            storage.dataHash = bundledRulesHash;
            
            if (isFallback) {
                storage.hashStatus = "bundled_rules_fallback";
            } else {
                storage.hashStatus = "bundled_rules_loaded";
            }
            
            return mergeCustomRules(bundledRules);
        })
        .catch(error => {
            const cacheRules = loadRemoteRulesFromCache(null, 'after_bundled_failure');
            if (cacheRules) {
                storage.hashValidationStatus = 'cache_used_bundled_failed';
                return mergeCustomRules(cacheRules);
            }
            
            if (storage.ClearURLsData && Object.keys(storage.ClearURLsData).length > 0) {
                storage.hashStatus = "cached_rules_used";
                return storage.ClearURLsData;
            }

            if (storage.builtInRulesEnabled === false) {
                storage.hashStatus = "custom_only_loaded";
                return loadCustomOnlyRules();
            }

            const fallbackRules = getEnhancedFallbackRules();
            if (isFallback) {
                storage.hashStatus = "fallback_rules_used_after_remote_failure";
            } else {
                storage.hashStatus = "fallback_rules_used";
            }
            return mergeCustomRules(fallbackRules);
        });
}

function getEnhancedFallbackRules() {
    return {
        "metadata": {
            "name": "Enhanced Fallback Rules",
            "version": "1.0.0",
            "license": "LGPL-3.0-or-later",
            "author": "Linkumori",
            "source": "fallback"
        },
        "providers": {
            "globalRules": {
                "urlPattern": ".*",
                "completeProvider": false,
                "rules": [
                    "(?:%3F)?utm(?:_[a-z_]*)?",
                    "(?:%3F)?ga_[a-z_]+",
                    "(?:%3F)?fbclid",
                    "(?:%3F)?gclid",
                    "(?:%3F)?_ga",
                    "(?:%3F)?_gl",
                    "(?:%3F)?twclid",
                    "(?:%3F)?msclkid",
                    "(?:%3F)?dclid",
                    "(?:%3F)?srsltid"
                ],
                "referralMarketing": [
                    "(?:%3F)?ref_?",
                    "(?:%3F)?referrer"
                ],
                "rawRules": [],
                "exceptions": [],
                "redirections": [],
                "forceRedirection": false
            },
            "fallback-google": {
                "urlPattern": "^https?:\\/\\/(?:[a-z0-9-]+\\.)*?google(?:\\.[a-z]{2,}){1,}",
                "completeProvider": false,
                "rules": [
                    "ved", "ei", "uact", "cd", "cad", 
                    "gws_rd", "source", "gs_l"
                ],
                "referralMarketing": ["referrer"],
                "rawRules": [],
                "exceptions": [
                    "^https?:\\/\\/(?:docs|accounts)\\.google(?:\\.[a-z]{2,}){1,}"
                ],
                "redirections": [],
                "forceRedirection": false
            },
            "fallback-amazon": {
                "urlPattern": "^https?:\\/\\/(?:[a-z0-9-]+\\.)*?amazon(?:\\.[a-z]{2,}){1,}",
                "completeProvider": false,
                "rules": [
                    "ref_?", "tag", "pf_rd_[a-z]*", "qid", "sr"
                ],
                "referralMarketing": ["tag"],
                "rawRules": ["\\/ref=[^/?]*"],
                "exceptions": [],
                "redirections": [],
                "forceRedirection": false
            }
        }
    };
}

function parseFilterRegexLiteralSourceForSelfie(value) {
    const text = String(value || '').trim();
    if (!text.startsWith('/')) return null;
    let escaped = false;
    for (let i = 1; i < text.length; i++) {
        const ch = text.charAt(i);
        if (escaped) { escaped = false; continue; }
        if (ch === '\\') { escaped = true; continue; }
        if (ch === '/') return text.slice(1, i);
    }
    return null;
}

function createURLPatternTokensForSelfie(regexSource) {
    const rt = globalThis.LinkumoriRegexTokens;
    if (rt && typeof rt.extractURLPatternTokensFromRegex === 'function') {
        try {
            const tokens = rt.extractURLPatternTokensFromRegex(regexSource);
            if (Array.isArray(tokens) && tokens.length > 0) return tokens;
        } catch (e) {}
    }
    if (rt && typeof rt.extractBestTokenFromRegex === 'function') {
        try {
            const single = String(rt.extractBestTokenFromRegex(regexSource) || '').toLowerCase();
            if (single) return [single];
        } catch (e) {}
    }
    return [];
}

function createDomainPatternTokenForSelfie(domainPattern) {
    const pattern = String(domainPattern || '').trim().toLowerCase();
    if (!pattern) return '';
    const regexSource = parseFilterRegexLiteralSourceForSelfie(pattern);
    if (regexSource) {
        const rt = globalThis.LinkumoriRegexTokens;
        if (rt && typeof rt.extractBestTokenFromRegex === 'function') {
            try {
                return String(rt.extractBestTokenFromRegex(regexSource) || '').toLowerCase();
            } catch (e) {}
        }
        return '';
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

function generateURLPatternSelfie(rulesData) {
    const providers = rulesData?.providers && typeof rulesData.providers === 'object' ? rulesData.providers : {};
    const entries = {};
    let tokenizedProviderCount = 0;
    for (const [providerName, provider] of Object.entries(providers)) {
        if (!provider || typeof provider.urlPattern !== 'string' || !provider.urlPattern.trim()) continue;
        let tokens = [];
        try {
            tokens = createURLPatternTokensForSelfie(new RegExp(provider.urlPattern, 'i').source);
        } catch (e) {
            tokens = [];
        }
        if (tokens.length > 0) tokenizedProviderCount++;
        entries[providerName] = { urlPattern: provider.urlPattern, tokens };
    }
    return {
        format: 'linkumori-url-pattern-selfie',
        version: 1,
        generatedAt: new Date().toISOString(),
        rulesVersion: rulesData?.metadata?.version || null,
        providerCount: Object.keys(entries).length,
        tokenizedProviderCount,
        entries
    };
}

function generateDomainPatternSelfie(rulesData) {
    const providers = rulesData?.providers && typeof rulesData.providers === 'object' ? rulesData.providers : {};
    const entries = {};
    let tokenizedPatternCount = 0;
    let tokenizedProviderCount = 0;
    for (const [providerName, provider] of Object.entries(providers)) {
        const domainPatterns = Array.isArray(provider?.domainPatterns)
            ? provider.domainPatterns.filter(pattern => typeof pattern === 'string' && pattern.trim())
            : [];
        if (domainPatterns.length === 0) continue;
        const tokens = domainPatterns.map(domainPattern => {
            const token = createDomainPatternTokenForSelfie(domainPattern);
            if (token) tokenizedPatternCount++;
            return { domainPattern, token };
        });
        if (tokens.some(item => item.token)) tokenizedProviderCount++;
        entries[providerName] = { domainPatterns, tokens };
    }
    return {
        format: 'linkumori-domain-pattern-selfie',
        version: 1,
        generatedAt: new Date().toISOString(),
        rulesVersion: rulesData?.metadata?.version || null,
        providerCount: Object.keys(entries).length,
        tokenizedProviderCount,
        patternCount: Object.values(entries).reduce((total, entry) => total + entry.domainPatterns.length, 0),
        tokenizedPatternCount,
        entries
    };
}

function injectTokenSelfiesIntoData(data) {
    if (!data || typeof data !== 'object') return data;
    const metadata = data.metadata && typeof data.metadata === 'object' ? data.metadata : {};
    metadata.urlPatternSelfie = generateURLPatternSelfie(data);
    metadata.domainPatternSelfie = generateDomainPatternSelfie(data);
    data.metadata = metadata;
    return data;
}

function loadCustomOnlyRules() {
    return new Promise(async (resolve) => {
        try {
            const result = await browser.storage.local.get(['custom_rules', IMPORT_EXCLUSIONS_KEY]);
            let customRules = null;

            if (result.custom_rules) {
                if (typeof result.custom_rules === 'string') {
                    customRules = JSON.parse(result.custom_rules);
                } else {
                    customRules = result.custom_rules;
                }
            }

            if (customRules && typeof customRules === 'object' && !customRules.providers) {
                customRules = { providers: customRules };
            }

            const providers = (customRules && customRules.providers && typeof customRules.providers === 'object')
                ? customRules.providers
                : {};
            const disabledSignatures = getDisabledSignatures(result[IMPORT_EXCLUSIONS_KEY]);
            const filteredCustom = filterProvidersByDisabledSignatures(providers, disabledSignatures);
            const providerCount = Object.keys(filteredCustom.providers).length;

            storage.rulesMetadata = {
                name: 'Custom Rules Only',
                source: 'custom_only',
                providerCount
            };

            storage.ClearURLsData = injectTokenSelfiesIntoData({
                metadata: storage.rulesMetadata,
                providers: filteredCustom.providers
            });

            storage.mergeStats = {
                bundledProviders: 0,
                customProviders: providerCount,
                overriddenProviders: 0,
                totalProviders: providerCount,
                overriddenProviderNames: [],
                filteredBundledProviders: 0,
                newCustomProviders: providerCount,
                disabledProviders: filteredCustom.removedCount
            };

            storage.hashStatus = providerCount > 0 ? 'custom_only_loaded' : 'custom_only_no_rules';
            storage.dataHash = await sha256(JSON.stringify(storage.ClearURLsData, Object.keys(storage.ClearURLsData).sort()));

            saveOnDisk(['ClearURLsData', 'dataHash', 'hashStatus', 'mergeStats']);
            resolve(storage.ClearURLsData);
        } catch (error) {
            storage.rulesMetadata = {
                name: 'Custom Rules Only',
                source: 'custom_only',
                providerCount: 0
            };
            storage.ClearURLsData = {
                metadata: storage.rulesMetadata,
                providers: {}
            };
            storage.mergeStats = {
                bundledProviders: 0,
                customProviders: 0,
                overriddenProviders: 0,
                totalProviders: 0,
                overriddenProviderNames: [],
                filteredBundledProviders: 0,
                newCustomProviders: 0,
                disabledProviders: 0,
                error: error.message
            };
            storage.hashStatus = 'custom_only_no_rules';
            storage.dataHash = "custom-only-fallback-" + Date.now();
            saveOnDisk(['ClearURLsData', 'dataHash', 'hashStatus', 'mergeStats']);
            resolve(storage.ClearURLsData);
        }
    });
}

function mergeCustomRules(bundledRules) {
    return new Promise(async (resolve) => {
        try {
            const result = await browser.storage.local.get(['custom_rules', IMPORT_EXCLUSIONS_KEY]);
            const disabledSignatures = getDisabledSignatures(result[IMPORT_EXCLUSIONS_KEY]);
            let customRules = null;
            let customProviderCount = 0;
            
            if (result.custom_rules) {
                try {
                    if (typeof result.custom_rules === 'string') {
                        customRules = JSON.parse(result.custom_rules);
                    } else {
                        customRules = result.custom_rules;
                    }
                    
                    if (customRules && customRules.providers) {
                        customProviderCount = Object.keys(customRules.providers).length;
                    } else if (customRules && typeof customRules === 'object' && !customRules.providers) {
                        customProviderCount = Object.keys(customRules).length;
                        customRules = { providers: customRules };
                    }
                } catch (error) {
                    customRules = null;
                }
            }
            
            if (result.hasOwnProperty('custom_rules') && 
                customRules && 
                customRules.providers && 
                Object.keys(customRules.providers).length === 0) {
                customProviderCount = 0;
                customRules = { providers: {} };
            }
            
            const bundledProvidersRaw = bundledRules?.providers || {};
            const filteredBundled = filterProvidersByDisabledSignatures(bundledProvidersRaw, disabledSignatures);
            const customProvidersRaw = (customRules && customRules.providers && typeof customRules.providers === 'object')
                ? customRules.providers
                : {};
            const filteredCustom = filterProvidersByDisabledSignatures(customProvidersRaw, disabledSignatures);
            const activeCustomProviderCount = Object.keys(filteredCustom.providers).length;
            const totalDisabledProviders = filteredBundled.removedCount + filteredCustom.removedCount;
            const filteredBundledRules = {
                ...bundledRules,
                providers: filteredBundled.providers
            };

            if (!customRules || activeCustomProviderCount === 0) {
                if (!filteredBundledRules.metadata?.urlPatternSelfie) {
                    injectTokenSelfiesIntoData(filteredBundledRules);
                }
                storage.ClearURLsData = filteredBundledRules;
                storage.mergeStats = {
                    source: bundledRules?.metadata?.source || 'bundled',
                    bundledProviders: Object.keys(filteredBundled.providers || {}).length,
                    customProviders: 0,
                    overriddenProviders: 0,
                    totalProviders: Object.keys(filteredBundled.providers || {}).length,
                    overriddenProviderNames: [],
                    disabledProviders: totalDisabledProviders
                };
                
                const ruleString = JSON.stringify(filteredBundledRules, Object.keys(filteredBundledRules).sort());
                const hash = await sha256(ruleString);
                storage.dataHash = hash;
                const isOverloadStatus = typeof storage.hashStatus === 'string' &&
                    storage.hashStatus.startsWith('remote_built_in_');
                
                if (
                    (storage.hashStatus && storage.hashStatus.startsWith('cache_remote_rules_')) ||
                    storage.hashStatus === 'cache_remote_built_in_merged'
                ) {
                } else if (isOverloadStatus) {
                    storage.hashStatus = "remote_built_in_merged";
                } else if (tempVerificationCache.isRemoteVerified) {
                    storage.hashStatus = "remote_rules_loaded";
                } else if (storage.hashStatus === "hash_url_missing") {
                    storage.hashStatus = "bundled_fallback_loaded";
                } else if (storage.hashStatus === "bundled_rules_fallback") {
                    storage.hashStatus = "bundled_rules_fallback";
                } else if (storage.hashStatus === "fallback_rules_used_after_remote_failure") {
                    storage.hashStatus = "fallback_rules_used_after_remote_failure";
                } else if (storage.hashStatus === "fallback_rules_used") {
                    storage.hashStatus = "fallback_rules_loaded";
                } else {
                    storage.hashStatus = "bundled_rules_loaded";
                }
            } else {
                // Build match keys while preserving all providers (including duplicate keys).
                const baseProviders = filteredBundled.providers || {};
                const baseEntries = Object.entries(baseProviders).map(([name, data]) => ({
                    name,
                    data,
                    key: getProviderGroupKey(data, name)
                })).filter(entry => !entry.key.startsWith('no-pattern:') && !disabledSignatures.has(entry.key));

                const baseGroupsByKey = new Map();
                baseEntries.forEach(entry => {
                    if (!baseGroupsByKey.has(entry.key)) {
                        baseGroupsByKey.set(entry.key, []);
                    }
                    baseGroupsByKey.get(entry.key).push({
                        name: entry.name,
                        data: entry.data,
                        isPrimarySource: true
                    });
                });
                
                const customProviders = filteredCustom.providers || {};
                const customEntries = Object.entries(customProviders).map(([name, data]) => ({
                    name,
                    data,
                    key: getProviderGroupKey(data, name)
                })).filter(entry => !entry.key.startsWith('no-pattern:') && !disabledSignatures.has(entry.key));

                const customGroupsByKey = new Map();
                customEntries.forEach(entry => {
                    if (!customGroupsByKey.has(entry.key)) {
                        customGroupsByKey.set(entry.key, []);
                    }
                    customGroupsByKey.get(entry.key).push({
                        name: entry.name,
                        data: entry.data,
                        isPrimarySource: true
                    });
                });
                
                const customKeysSet = new Set(customEntries.map(entry => entry.key));
                const baseKeysSet = new Set(baseEntries.map(entry => entry.key));
                const overriddenBaseEntries = baseEntries.filter(entry => customKeysSet.has(entry.key));
                const nonOverriddenBaseKeys = Array.from(baseGroupsByKey.keys()).filter(key => !customKeysSet.has(key));
                const overridingCustomEntries = customEntries.filter(entry => baseKeysSet.has(entry.key));
                const overriddenProviderNames = overriddenBaseEntries.map(entry => entry.name);

                const finalProviders = {};
                const usedNames = new Set();

                // Add merged base providers by key that are NOT overridden
                for (const key of nonOverriddenBaseKeys) {
                    const baseGroup = baseGroupsByKey.get(key) || [];
                    if (baseGroup.length === 0) {
                        continue;
                    }
                    const mergedProvider = mergeRemoteProviderGroup(baseGroup);
                    const mergedName = createMergedRemoteProviderName(baseGroup);
                    let finalName = mergedName;
                    if (usedNames.has(finalName)) {
                        const pathName = derivePathQualifiedName(baseGroup, mergedName);
                        if (pathName && !usedNames.has(pathName)) {
                            finalName = pathName;
                        } else {
                            let counter = 1;
                            do { finalName = `${mergedName}_${counter++}`; } while (usedNames.has(finalName));
                        }
                    }
                    usedNames.add(finalName);
                    finalProviders[finalName] = mergedProvider;
                }

                // Add merged custom providers by key (they replace any with same key)
                for (const customGroup of customGroupsByKey.values()) {
                    const mergedProvider = mergeRemoteProviderGroup(customGroup);
                    const mergedName = createMergedRemoteProviderName(customGroup);
                    let finalName = mergedName;
                    if (usedNames.has(finalName)) {
                        const pathName = derivePathQualifiedName(customGroup, mergedName);
                        if (pathName && !usedNames.has(pathName)) {
                            finalName = pathName;
                        } else {
                            let counter = 1;
                            do { finalName = `${mergedName}_${counter++}`; } while (usedNames.has(finalName));
                        }
                    }
                    usedNames.add(finalName);
                    finalProviders[finalName] = mergedProvider;
                }

                // Remove duplicate domain patterns across providers while keeping providers separate.
                const claimedDomainPatterns = new Set();
                Object.keys(finalProviders).forEach(providerName => {
                    const provider = finalProviders[providerName];
                    if (!provider || typeof provider !== 'object') {
                        return;
                    }

                    const hasUrlPattern = typeof provider.urlPattern === 'string' && provider.urlPattern.trim() !== '';
                    const domainPatterns = Array.isArray(provider.domainPatterns)
                        ? provider.domainPatterns.filter(pattern => typeof pattern === 'string' && pattern.trim() !== '')
                        : [];

                    if (domainPatterns.length > 0) {
                        const uniqueForProvider = [];
                        domainPatterns.forEach(pattern => {
                            const normalized = pattern.trim();
                            if (!claimedDomainPatterns.has(normalized)) {
                                claimedDomainPatterns.add(normalized);
                                uniqueForProvider.push(normalized);
                            }
                        });

                        if (uniqueForProvider.length > 0) {
                            provider.domainPatterns = uniqueForProvider;
                        } else {
                            delete provider.domainPatterns;
                        }
                    }

                    const hasDomainPatterns = Array.isArray(provider.domainPatterns) && provider.domainPatterns.length > 0;
                    if (!hasUrlPattern && !hasDomainPatterns) {
                        delete finalProviders[providerName];
                    }
                });
                
                const mergedRules = {
                    providers: finalProviders
                };
                
                if (bundledRules.metadata) {
                    mergedRules.metadata = { ...bundledRules.metadata };
                }
                injectTokenSelfiesIntoData(mergedRules);

                // Compute stats
                const bundledProviderNames = baseEntries.map(entry => entry.name);
                const customProviderNames = customEntries.map(entry => entry.name);
                
                storage.mergeStats = {
                    source: bundledRules?.metadata?.source || 'bundled',
                    bundledProviders: bundledProviderNames.length,
                    customProviders: customProviderNames.length,
                    overriddenProviders: overriddenBaseEntries.length,
                    totalProviders: Object.keys(finalProviders).length,
                    overriddenProviderNames: overriddenProviderNames,
                    filteredBundledProviders: nonOverriddenBaseKeys.length,
                    newCustomProviders: customProviderNames.length - overridingCustomEntries.length,
                    disabledProviders: totalDisabledProviders
                };
                
                storage.ClearURLsData = mergedRules;
                const ruleStringmerge = JSON.stringify(mergedRules, Object.keys(mergedRules).sort());
                const hashmerge = await sha256(ruleStringmerge);
                storage.dataHash = hashmerge;
                const isOverloadStatus = typeof storage.hashStatus === 'string' &&
                    storage.hashStatus.startsWith('remote_built_in_');
                
                if (storage.hashStatus && storage.hashStatus.startsWith('cache_remote_rules_')) {
                    storage.hashStatus = storage.hashStatus.replace('cache_remote_rules_', 'cache_remote_custom_rules_');
                } else if (storage.hashStatus === 'cache_remote_built_in_merged') {
                    storage.hashStatus = 'cache_remote_built_in_merged_custom';
                } else if (isOverloadStatus) {
                    storage.hashStatus = "remote_built_in_merged_custom";
                } else if (tempVerificationCache.isRemoteVerified) {
                    storage.hashStatus = "remote_custom_rules_merged";
                } else {
                    storage.hashStatus = "custom_rules_merged";
                }
            }
            
            saveOnDisk(['ClearURLsData', 'dataHash', 'hashStatus', 'mergeStats']);
            resolve(storage.ClearURLsData);
            
        } catch (error) {
            storage.ClearURLsData = bundledRules;
            storage.dataHash = "bundled-fallback-" + Date.now();
            storage.hashStatus = "custom_rules_failed";
            storage.mergeStats = {
                source: bundledRules?.metadata?.source || 'bundled',
                bundledProviders: Object.keys(bundledRules.providers || {}).length,
                customProviders: 0,
                overriddenProviders: 0,
                totalProviders: Object.keys(bundledRules.providers || {}).length,
                overriddenProviderNames: [],
                disabledProviders: 0,
                error: error.message
            };
            
            saveOnDisk(['ClearURLsData', 'dataHash', 'hashStatus', 'mergeStats']);
            resolve(storage.ClearURLsData);
        }
    });
}

function reloadCustomRules() {
    return loadBundledRules().then(() => loadLinkumoriURLFilters()).then(() => {
        let appliedLive = false;
        if (typeof globalThis.updateProviderData === 'function') {
            appliedLive = !!globalThis.updateProviderData();
        }
        if (typeof globalThis.updateLinkumoriURLFilterRuntimeData === 'function') {
            globalThis.updateLinkumoriURLFilterRuntimeData();
        }
        
        return {
            data: storage.ClearURLsData,
            appliedLive
        };
    }).catch(error => {
        throw error;
    });
}

async function refreshRemoteRulesNow() {
    try {
        const reloadResult = await reloadCustomRules();
        return {
            success: true,
            health: getRemoteRulesHealth(),
            hashStatus: storage.hashStatus || 'unknown',
            appliedLive: !!(reloadResult && reloadResult.appliedLive)
        };
    } catch (error) {
        return {
            success: false,
            error: error?.message || 'Failed to refresh remote rules',
            health: getRemoteRulesHealth(),
            hashStatus: storage.hashStatus || 'unknown'
        };
    }
}

function isValidRuleURL(url) {
    if (!url || typeof url !== 'string') {
        return false;
    }
    
    const trimmed = url.trim();
    if (trimmed === '') {
        return false;
    }
    
    try {
        const urlObj = new URL(trimmed);
        
        if (urlObj.protocol !== 'https:') {
            return false;
        }
        
        if (!urlObj.hostname || urlObj.hostname.length === 0) {
            return false;
        }
        
        return true;
    } catch (error) {
        return false;
    }
}

   

function normalizeRemoteRulescacheShape() {
    const v = storage.remoteRulescache;

    if (typeof v === 'string') {
        try { storage.remoteRulescache = JSON.parse(v); } catch { storage.remoteRulescache = null; }
    }

    if (!storage.remoteRulescache || typeof storage.remoteRulescache !== 'object' || Array.isArray(storage.remoteRulescache)) {
        storage.remoteRulescache = null;
        return;
    }

    if (typeof storage.remoteRulescache.verified === 'undefined') {
        storage.remoteRulescache.verified = true;
        deferSaveOnDisk('remoteRulescache');
    }
}

function getPopupConsentPolicyVersion() {
    const configuredVersion = Number(globalThis.Linkumoriversion);
    if (Number.isInteger(configuredVersion) && configuredVersion > 0) {
        return configuredVersion;
    }

    return null;
}

function revokePopupConsentVersionMismatch() {
    storage[POPUP_CONSENT_STORAGE_KEY] = false;
    storage[POPUP_CONSENT_VERSION_STORAGE_KEY] = 0;

    browser.storage.local.set({
        [POPUP_CONSENT_STORAGE_KEY]: false,
        [POPUP_CONSENT_VERSION_STORAGE_KEY]: 0
    }).catch(() => {});

    if (browser.tabs && typeof browser.tabs.create === 'function') {
        browser.tabs.create({
            url: 'html/legal.html?source=consent_update',
        }).catch(() => {});
    }
}

function hasPopupConsentForStartup() {
    if (storage[POPUP_CONSENT_STORAGE_KEY] !== true) {
        return false;
    }

    const currentPolicyVersion = getPopupConsentPolicyVersion();
    if (currentPolicyVersion === null) {
        return false;
    }

    const acceptedPolicyVersion = Number(storage[POPUP_CONSENT_VERSION_STORAGE_KEY] || 0);
    if (acceptedPolicyVersion === currentPolicyVersion) {
        return true;
    }

    revokePopupConsentVersionMismatch();
    return false;
}

function consumePostReloadOpenUrl() {
    const queuedUrl = typeof storage[POST_RELOAD_OPEN_URL_STORAGE_KEY] === 'string'
        ? storage[POST_RELOAD_OPEN_URL_STORAGE_KEY].trim()
        : '';

    if (!queuedUrl) {
        return;
    }

    storage[POST_RELOAD_OPEN_URL_STORAGE_KEY] = '';
    browser.storage.local.set({
        [POST_RELOAD_OPEN_URL_STORAGE_KEY]: ''
    }).catch(() => {});

    const safeUrl = queuedUrl.startsWith('html/') ? queuedUrl : '';
    if (!safeUrl) {
        return;
    }

    if (browser.tabs && typeof browser.tabs.create === 'function') {
        browser.tabs.create({
            url: safeUrl,
        }).catch(() => {});
    }
}

function startClearurlsIfConsentGranted() {
    if (clearurlsStarted) {
        return true;
    }

    if (!hasPopupConsentForStartup()) {
        return false;
    }

    if (typeof start === 'function') {
        start();
        clearurlsStarted = true;
        return true;
    }

    return false;
}

function initLinkumoriPublicSuffixList() {
    const pslService = globalThis.linkumoriPsl || null;
    if (!pslService || typeof pslService.init !== 'function') {
        return Promise.resolve(false);
    }

    if (pslService.status === 'ready') {
        return Promise.resolve(true);
    }

    return pslService.init({
        dataPath: 'data/public_suffix_list.dat',
        runtimeAPI: browser.runtime
    }).then(() => true).catch(error => {
        console.warn('[Linkumori] Public suffix list initialization failed:', error);
        return false;
    });
}

function genesis() {
    browser.storage.local.get(null).then((items) => {
        initStorage(items);
        consumePostReloadOpenUrl();

        initLinkumoriPublicSuffixList().then(() => loadBundledRules()).then(() => loadLinkumoriURLFilters()).then(() => {
            startClearurlsIfConsentGranted();
            if (hasPopupConsentForStartup() && typeof globalThis.startLinkumoriURLFilterRuntime === 'function') {
                globalThis.startLinkumoriURLFilterRuntime();
            }
            changeIcon();
            contextMenuStart();
            historyListenerStart();
            
        }).catch(error => {
            startClearurlsIfConsentGranted();
            if (hasPopupConsentForStartup() && typeof globalThis.startLinkumoriURLFilterRuntime === 'function') {
                globalThis.startLinkumoriURLFilterRuntime();
            }
            changeIcon();
            contextMenuStart();
            historyListenerStart();
        });
    }, handleError);
}

function getData(key) {
    return storage[key];
}

function getEntireData() {
    return storage;
}

function setData(key, value) {
    switch (key) {
        case "ClearURLsData":
        case "LinkumoriURLsData":
        case "log":
            if (typeof value === 'string') {
                storage[key] = JSON.parse(value);
            } else {
                storage[key] = value;
            }
            break;
        case "custom_rules":
        case "linkumori_url_custom_rules":
            if (typeof value === 'string') {
                storage[key] = JSON.parse(value);
            } else {
                storage[key] = value;
            }
            break;
        case "linkumori_url_disabled_rules":
            if (typeof value === 'string') {
                try {
                    const parsed = JSON.parse(value);
                    storage[key] = Array.isArray(parsed)
                        ? parsed.map(rule => String(rule || '').trim()).filter(Boolean)
                        : [];
                } catch (_) {
                    storage[key] = value.split(/\r?\n/).map(rule => rule.trim()).filter(Boolean);
                }
            } else if (Array.isArray(value)) {
                storage[key] = value.map(rule => String(rule || '').trim()).filter(Boolean);
            } else {
                storage[key] = [];
            }
            break;
        case "userWhitelist":
            if (typeof value === 'string') {
                try {
                    storage[key] = JSON.parse(value);
                } catch (e) {
                    storage[key] = value ? [value] : [];
                }
            } else if (Array.isArray(value)) {
                storage[key] = value;
            } else if (value === null || value === undefined) {
                storage[key] = [];
            } else {
                storage[key] = [];
            }
            break;
        case "hashURL":
        case "ruleURL":
            if (value && typeof value === 'string' && value.trim() !== '') {
                const cleanURL = value.trim();
                if (isValidRuleURL(cleanURL)) {
                    storage[key] = cleanURL;
                } else {
                }
            } else {
                storage[key] = '';
            }
            break;
        case "remoteRuleSets": {
            let parsed = value;
            if (typeof value === 'string') {
                try {
                    parsed = JSON.parse(value);
                } catch (e) {
                    parsed = [];
                }
            }

            if (!Array.isArray(parsed)) {
                storage[key] = [];
                break;
            }

            const dedupe = new Set();
            storage[key] = parsed
                .map(entry => normalizeRemoteRuleSetEntry(entry, false))
                .filter(entry => {
                    if (!entry) {
                        return false;
                    }
                    const pairKey = `${entry.ruleURL}|||${entry.hashURL}`;
                    if (dedupe.has(pairKey)) {
                        return false;
                    }
                    dedupe.add(pairKey);
                    return true;
                });
            break;
        }
        case "types":
            if (typeof value === 'string') {
                storage[key] = value.split(',');
            } else {
                storage[key] = value;
            }
            break;
        case "logLimit":
            storage[key] = Math.max(0, Number(value));
            break;
        case "remoteRulesEnabled":
        case "overloadModeEnabled":
        case "builtInRulesEnabled":
        case "linkumoriInteroperabilityMode":
        case "redirectionEnabled":
            storage[key] = value === true || value === "true";
            break;
        case "redirection":
        case "domainredirection":
        case "domainRedirection":
            storage.redirectionEnabled = value === true || value === "true";
            delete storage[key];
            deleteFromDisk(key);
            saveOnExit();
            break;
        case "globalurlcounter":
            storage["totalCounter"] = value;
            delete storage[key];
            deleteFromDisk(key);
            saveOnExit();
            break;
        case "globalCounter":
            storage["cleanedCounter"] = value;
            delete storage[key];
            deleteFromDisk(key);
            saveOnExit();
            break;
        case "remoteRulescache": {
            let parsed = null;
            try {
                parsed = (typeof value === 'string') ? JSON.parse(value) : value;
            } catch (e) {
                parsed = null;
            }
            if (parsed && typeof parsed === 'object' && !Array.isArray(parsed)) {
                storage[key] = parsed;
            } else {
                storage[key] = null;
            }
            break;
        }
        case "remoteRulesHealth": {
            let parsed = null;
            try {
                parsed = (typeof value === 'string') ? JSON.parse(value) : value;
            } catch (e) {
                parsed = null;
            }
            storage[key] = parsed;
            ensureRemoteRulesHealthShape();
            break;
        }
        case "temporaryPauseUntil":
            storage[key] = Number(value) > 0 ? Number(value) : 0;
            break;
        default:
            storage[key] = value;
    }
}

function initStorage(items) {
    initSettings();

    if (!isEmpty(items)) {
        Object.entries(items).forEach(([key, value]) => {
            setData(key, value);
        });
    }

    normalizeRemoteRulescacheShape();
    ensureRemoteRulesHealthShape();
    clearExpiredTemporaryPause();
}

function initSettings() {
    storage.ClearURLsData = [];
    storage.LinkumoriURLsData = {
        metadata: {
            name: linkumoriStorageI18n('linkumori_url_filter_name'),
            source: 'linkumori_urls_empty',
            status: 'not_loaded',
            ruleStatus: 'not_loaded',
            hashStatus: 'not_required',
            sourceCount: 0,
            supportedRuleCount: 0
        },
        format: 'linkumori-url-filter-interoperability',
        rules: []
    };
    storage.dataHash = "";
    storage.builtInRulesEnabled = true;
    storage.linkumoriInteroperabilityMode = true;
    storage.remoteRulesEnabled = false;
    storage.disableGatekeeper = false;
    storage.overloadModeEnabled = false;
    storage.rulesMetadata = null;
    storage.badgedStatus = true;
    storage.globalStatus = true;
    storage.totalCounter = 0;
    storage.cleanedCounter = 0;
    storage.hashStatus = "bundled_rules_pending";
    storage.loggingStatus = false;
    storage.log = {"log": []};
    storage.statisticsStatus = true;
    storage.badged_color = "#2563eb";
    storage['linkumori-theme'] = 'dark';
    storage['linkumori-light-mode-theme'] = 'light';
    storage['linkumori-dark-mode-theme'] = 'dark';
    storage['linkumori-last-dark-theme'] = 'dark';
    storage.remoteRulescache = null;
    storage.remoteRulesHealth = {
        lastFetchAttemptAt: null,
        lastFetchSuccessAt: null,
        lastHashVerificationAt: null,
        lastFailureReason: null,
        lastFailureStage: null,
        lastRuleURL: null,
        lastHashURL: null
    };
    storage.remoteRuleSets = [];
    storage.temporaryPauseUntil = 0;
    
    storage.hashURL = "";
    storage.ruleURL = "";
    
    storage.contextMenuEnabled = true;
    storage.historyListenerEnabled = true;
    storage.searchLinkFixEnabled = false;
    storage.localHostsSkipping = true;
    storage.referralMarketing = false;
    storage.logLimit = 100;
    storage.domainBlocking = true;
    storage.pingBlocking = true;
    storage.redirectionEnabled = false;
    storage.eTagFiltering = false;
    storage.watchDogErrorCount = 0;
    storage.userWhitelist = [];
    storage.custom_rules = { providers: {} };
    storage.linkumori_url_custom_rules = { rules: [] };
    storage.linkumori_url_disabled_rules = [];
    storage.popupConsentAccepted = false;
    storage.popupConsentPolicyVersionAccepted = 0;
    storage[POST_RELOAD_OPEN_URL_STORAGE_KEY] = '';
    
        storage.types = ["font", "image", "imageset", "main_frame", "media", "object", "object_subrequest", "other", "script", "stylesheet", "sub_frame", "websocket", "xml_dtd", "xmlhttprequest", "xslt"];
        storage.pingRequestTypes = ["ping", "beacon"];
}

function loadOldDataFromStore() {
    localDataHash = storage.dataHash;
}

function storeHashStatus(status_code) {
    storage.hashStatus = status_code;
}

function getRulesMetadata() {
    return storage.rulesMetadata || null;
}

function getRulesInfo() {
    const metadata = getRulesMetadata();
    const providers = storage.ClearURLsData?.providers || {};
    const providerCount = Object.keys(providers).length;
    
    // Handle case when metadata is null or undefined
    return {
        hasMetadata: !!metadata,
        name: metadata?.name || 'Unknown',
        version: metadata?.version || 'Unknown',
        license: metadata?.license || 'Unknown',
        author: metadata?.author || 'Unknown',
        lastUpdated: metadata?.lastUpdated || 'Unknown',
        source: metadata?.source || 'Unknown',
        sourceURL: metadata?.sourceURL || 'N/A',
        actualProviderCount: providerCount,
        expectedProviderCount: metadata?.providerCount || 'Unknown',
        hashStatus: storage.hashStatus || 'Unknown'
    };
}

function addToWhitelist(domain) {
    if (!storage.userWhitelist) {
        storage.userWhitelist = [];
    }
    
    if (!domain || typeof domain !== 'string') {
        return false;
    }
    
    const cleanDomain = domain.toLowerCase().trim();
    
    if (!cleanDomain || !isValidWhitelistDomain(cleanDomain)) {
        return false;
    }
    
    if (storage.userWhitelist.includes(cleanDomain)) {
        return false;
    }
    
    storage.userWhitelist.push(cleanDomain);
    
    try {
        saveOnDisk(['userWhitelist']);
    } catch (error) {
    }
    
    return true;
}

function removeFromWhitelist(domain) {
    if (!storage.userWhitelist || storage.userWhitelist.length === 0) {
        return false;
    }
    
    if (!domain || typeof domain !== 'string') {
        return false;
    }
    
    const cleanDomain = domain.toLowerCase().trim();
    
    const index = storage.userWhitelist.indexOf(cleanDomain);
    
    if (index > -1) {
        storage.userWhitelist.splice(index, 1);
        
        try {
            saveOnDisk(['userWhitelist']);
        } catch (error) {
        }
        
        return true;
    }
    
    return false;
}

function getWhitelist() {
    const result = storage.userWhitelist || [];
    return result;
}

function clearWhitelist() {
    storage.userWhitelist = [];
    
    try {
        saveOnDisk(['userWhitelist']);
    } catch (error) {
    }
    
    return true;
}

function isInWhitelist(domain) {
    if (!storage.userWhitelist || storage.userWhitelist.length === 0) {
        return false;
    }
    
    const cleanDomain = domain.toLowerCase().trim();
    const result = storage.userWhitelist.includes(cleanDomain);
    return result;
}

function isValidWhitelistDomain(domain) {
    if (!domain || typeof domain !== 'string') {
        return false;
    }
    
    let testDomain = domain;
    
    if (domain.startsWith('*.')) {
        testDomain = domain.substring(2);
        if (!testDomain) {
            return false;
        }
    }
    
    const domainRegex = /^[a-zA-Z0-9][a-zA-Z0-9-]{0,61}[a-zA-Z0-9](?:\.[a-zA-Z0-9][a-zA-Z0-9-]{0,61}[a-zA-Z0-9])*$/;
    const isValid = domainRegex.test(testDomain);
    
    return isValid;
}

function getWhitelistStats() {
    const whitelist = storage.userWhitelist || [];
    const wildcardCount = whitelist.filter(domain => domain.startsWith('*.')).length;
    const exactCount = whitelist.length - wildcardCount;
    
    const stats = {
        total: whitelist.length,
        exact: exactCount,
        wildcard: wildcardCount,
        domains: whitelist
    };
    
    return stats;
}

function getCustomRulesMergeInfo() {
    const mergedData = getData('ClearURLsData') || { providers: {} };
    const customRules = getData('custom_rules') || { providers: {} };
    const hashStatus = getData('hashStatus') || 'unknown';
    const mergeStats = getData('mergeStats') || {};
    
    const allProviders = Object.keys(mergedData.providers || {});
    const customProviderNames = Object.keys(customRules.providers || {});
    
    const mergedCustomProviders = customProviderNames.filter(name => 
        allProviders.includes(name)
    );
    const missingCustomProviders = customProviderNames.filter(name => 
        !allProviders.includes(name)
    );
    
    const info = {
        totalProviders: allProviders.length,
        customProvidersStored: customProviderNames.length,
        customProvidersMerged: mergedCustomProviders.length,
        customProvidersMissing: missingCustomProviders.length,
        hashStatus: hashStatus,
        customProviderNames: customProviderNames,
        mergedCustomProviders: mergedCustomProviders,
        missingCustomProviders: missingCustomProviders,
        sampleBuiltInProviders: allProviders.filter(name => 
            !customProviderNames.includes(name)
        ).slice(0, 5),
        mergeSuccess: missingCustomProviders.length === 0 && customProviderNames.length > 0,
        
        mergeStats: mergeStats,
        overriddenProviders: mergeStats.overriddenProviders || 0,
        overriddenProviderNames: mergeStats.overriddenProviderNames || [],
        newCustomProviders: mergeStats.newCustomProviders || 0,
        filteredBundledProviders: mergeStats.filteredBundledProviders || 0,
        
        providerAnalysis: {
            bundled: {
                total: mergeStats.bundledProviders || 0,
                active: mergeStats.filteredBundledProviders || 0,
                overridden: mergeStats.overriddenProviders || 0
            },
            custom: {
                total: mergeStats.customProviders || 0,
                overrides: mergeStats.overriddenProviders || 0,
                new: mergeStats.newCustomProviders || 0
            },
            final: {
                total: allProviders.length,
                bundledActive: mergeStats.filteredBundledProviders || 0,
                customActive: mergeStats.customProviders || 0
            }
        },
        
        remoteVerificationStatus: tempVerificationCache.isRemoteVerified
    };
    
    return info;
}

function getHashVerificationStatus() {
    return {
        isRemoteVerified: tempVerificationCache.isRemoteVerified,
        isCacheUsed: tempVerificationCache.isCacheUsed,
        lastVerification: tempVerificationCache.lastVerification,
        hashStatus: storage.hashStatus || 'unknown'
    };
}

function getNetworkCallStatus() {
    const configuredRemoteSets = getConfiguredRemoteRuleSets();
    const hasValidUrls = configuredRemoteSets.length > 0;
    const firstRemoteSet = configuredRemoteSets[0] || { ruleURL: '', hashURL: '' };

    return {
        networkCallsAllowed: hasValidUrls,
        ruleURL: firstRemoteSet.ruleURL,
        hashURL: firstRemoteSet.hashURL,
        ruleURLValid: isValidRuleURL(firstRemoteSet.ruleURL),
        hashURLValid: isValidRuleURL(firstRemoteSet.hashURL),
        configuredRemoteSourceCount: configuredRemoteSets.length,
        hashStatus: storage.hashStatus || 'unknown',
        remoteVerified: tempVerificationCache.isRemoteVerified,
        message: hasValidUrls ? 
            `Network calls permitted - ${configuredRemoteSets.length} remote source(s) valid` :
            'Network calls BLOCKED - missing or invalid remote source pairs'
    };
}

genesis();

browser.storage.onChanged.addListener((changes, areaName) => {
    if (areaName !== 'local' || !changes) {
        return;
    }

    const hasConsentChange = Boolean(changes[POPUP_CONSENT_STORAGE_KEY]);
    const hasConsentVersionChange = Boolean(changes[POPUP_CONSENT_VERSION_STORAGE_KEY]);

    if (!hasConsentChange && !hasConsentVersionChange) {
        return;
    }

    if (hasConsentChange) {
        storage[POPUP_CONSENT_STORAGE_KEY] = changes[POPUP_CONSENT_STORAGE_KEY].newValue === true;
    }

    if (hasConsentVersionChange) {
        storage[POPUP_CONSENT_VERSION_STORAGE_KEY] = Number(
            changes[POPUP_CONSENT_VERSION_STORAGE_KEY].newValue || 0
        );
    }

    if (hasPopupConsentForStartup()) {
        startClearurlsIfConsentGranted();
        if (typeof globalThis.startLinkumoriURLFilterRuntime === 'function') {
            globalThis.startLinkumoriURLFilterRuntime();
        }
    }
});

browser.storage.local.get(['firstInstall']).then(result => {
    if (!result.firstInstall) {
        browser.tabs.create({
            url: 'html/legal.html?source=first_install',
        });
        browser.storage.local.set({ firstInstall: true });
    }
});
