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




// BUGFIX 10: "use strict" moved to prologue (was mid-file, no-op there).
"use strict";

var providers = [];
var providersByToken = Object.create(null);
var globalProviders = [];
var clearurlsProviderSnapshot = createEmptyProviderSnapshot();
var prvKeys = [];
var siteBlockedAlert = 'javascript:void(0)';
var dataHash;
var localDataHash;
var os;
var initializationComplete = false;
// BUGFIX 10: cap cache size to prevent unbounded growth.
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
        disabledRuleIds: [],
        disabledRules: {},
        globalProviders: [],
        providerCount: 0,
        providers: [],
        providersByToken: {},
        ruleIds: {},
        // Pinned rule ids (see core_js/linkumori_rule_pins.js): how each pin
        // matched this load, and the pins that no longer match any rule.
        rulePins: { resolved: [], orphaned: [] }
    };
}

function normalizeClearURLsDisabledRuleIds(value) {
    if (!value) return [];
    if (typeof value === 'string') {
        try { return normalizeClearURLsDisabledRuleIds(JSON.parse(value)); }
        catch (_) { return value.split(/\r?\n/).map(i => i.trim()).filter(Boolean); }
    }
    if (Array.isArray(value)) {
        return [...new Set(value.map(i => String(i || '').trim()).filter(Boolean))];
    }
    return [];
}

function getClearURLsDisabledRuleIdSet() {
    return new Set(normalizeClearURLsDisabledRuleIds(storage.clearurls_disabled_rule_ids));
}

function buildCoreRuntimeRuleId(providerName, ruleId) {
    return `${providerName}::${ruleId}`;
}

function buildCorePatternRuleActivationId(scopeId, ruleId) {
    return `${scopeId}::${ruleId}`;
}

function normalizeCoreRuleActivationIds(value) {
    if (!Array.isArray(value)) return [];
    const out = [];
    const seen = new Set();
    value.forEach(id => {
        const a = String(id || "").trim();
        if (!a || seen.has(a)) return;
        seen.add(a);
        out.push(a);
    });
    return out;
}

// `lookupRuleId(section, matchPattern)` gives the generated id of a rule
// without an "id" (see core_js/linkumori_rule_ids.js).
function attachCoreRuleIdentity(providerName, compiledRule, section, activationScopeIds = [], lookupRuleId = null) {
    const baseId = LinkumoriRuleIds.baseRuleId(section, compiledRule.matchPattern);
    const ruleId = compiledRule.id || (lookupRuleId ? lookupRuleId(section, compiledRule.matchPattern) : baseId);
    // Ids this rule may have had before, so a setting saved under one still
    // applies: its readable id (which it loses once another rule shares it)
    // and the numbered id ("-2", …) storage used to give such rules. A
    // setting saved under a shared readable id switches off every rule that
    // shares it; a rule that was off never comes back on by itself.
    compiledRule.legacyIds = compiledRule.id ? []
        : [...new Set([baseId, ...normalizeCoreRuleAliases(compiledRule._linkumoriLegacyRuleIds)])].filter(id => id !== ruleId);
    const activationIds = normalizeCoreRuleActivationIds(compiledRule._linkumoriActivationIds);
    const fallbackActivationIds = (Array.isArray(activationScopeIds) && activationScopeIds.length > 0
        ? activationScopeIds : [providerName])
        .map(scopeId => buildCorePatternRuleActivationId(scopeId, ruleId));
    compiledRule.id = ruleId;
    compiledRule.aliases = normalizeCoreRuleAliases(compiledRule.aliases).filter(alias => alias !== ruleId);
    compiledRule.providerName = providerName;
    compiledRule.runtimeRuleId = buildCoreRuntimeRuleId(providerName, ruleId);
    compiledRule.activationIds = activationIds.length > 0 ? activationIds : fallbackActivationIds;
    return compiledRule;
}

// Disabled ids saved under a rule's old name (one of its "aliases" or
// legacy ids), keyed by that old id, with the ids they now belong to. One old
// generated id can belong to several rules. Filled while providers are built
// and written back by migrateCoreRuleAliasActivationIds().
let pendingCoreRuleAliasMigrations = new Map();

// True when `activationId` ("<scope>::<ruleId>") is disabled, either as is
// or under one of the rule's previous ids ("<scope>::<previousId>").
function isCoreActivationIdDisabled(activationId, previousIds, disabledRuleIds) {
    if (disabledRuleIds.has(activationId)) return true;
    if (!Array.isArray(previousIds) || previousIds.length === 0) return false;
    const sep = activationId.lastIndexOf("::");
    if (sep === -1) return false;
    const scope = activationId.slice(0, sep);
    for (const previousId of previousIds) {
        const oldActivationId = `${scope}::${previousId}`;
        if (disabledRuleIds.has(oldActivationId)) {
            if (!pendingCoreRuleAliasMigrations.has(oldActivationId)) pendingCoreRuleAliasMigrations.set(oldActivationId, new Set());
            pendingCoreRuleAliasMigrations.get(oldActivationId).add(activationId);
            return true;
        }
    }
    return false;
}

function filterCoreRuleActivationIds(compiledRule, disabledRuleIds) {
    if (!compiledRule || !disabledRuleIds || disabledRuleIds.size === 0) return false;
    const previousIds = (compiledRule.aliases || []).concat(compiledRule.legacyIds || []);
    // A rule is switched off either for its whole provider ("provider::ruleId")
    // or for one of its match patterns ("domainPattern:<pattern>::ruleId").
    if (compiledRule.runtimeRuleId && isCoreActivationIdDisabled(compiledRule.runtimeRuleId, previousIds, disabledRuleIds)) {
        compiledRule.disabledActivationIds = (compiledRule.activationIds || []).slice();
        compiledRule.activationIds = [];
        return true;
    }
    const activationIds = Array.isArray(compiledRule.activationIds) ? compiledRule.activationIds : [];
    if (activationIds.length === 0) return false;
    const active = [], disabled = [];
    activationIds.forEach(aId => (isCoreActivationIdDisabled(aId, previousIds, disabledRuleIds) ? disabled : active).push(aId));
    compiledRule.disabledActivationIds = disabled;
    compiledRule.activationIds = active;
    return active.length === 0;
}

function parseCorePatternActivationScope(activationId) {
    const v = String(activationId || "");
    const sep = v.lastIndexOf("::");
    if (sep === -1) return null;
    const scope = v.slice(0, sep);
    if (scope.startsWith("domainPattern:")) return { type: "domain", pattern: scope.slice(14) };
    if (scope.startsWith("urlPattern:")) return { type: "url", pattern: scope.slice(11) };
    return null;
}

function coreRuleHasActivePatternForUrl(compiledRule, url) {
    const activationIds = Array.isArray(compiledRule?.activationIds) ? compiledRule.activationIds : [];
    const patternScopes = activationIds.map(parseCorePatternActivationScope).filter(s => s && s.pattern);
    if (patternScopes.length === 0) return true;
    return patternScopes.some(scope => {
        if (scope.type === "domain") return matchDomainPattern(url, [scope.pattern]);
        if (scope.type === "url") {
            try { return new RegExp(scope.pattern, "i").test(url); } catch (_) { return false; }
        }
        return false;
    });
}

// Moves disabled ids saved under a rule's previous id to its current id, so
// the rule on/off controls (which only know current ids) can switch it back on.
function migrateCoreRuleAliasActivationIds() {
    if (pendingCoreRuleAliasMigrations.size === 0) return false;
    const current = normalizeClearURLsDisabledRuleIds(storage.clearurls_disabled_rule_ids);
    const migrated = [...new Set(current.flatMap(id => pendingCoreRuleAliasMigrations.has(id) ? [...pendingCoreRuleAliasMigrations.get(id)] : [id]))];
    pendingCoreRuleAliasMigrations = new Map();
    if (migrated.length === current.length && migrated.every((id, i) => id === current[i])) return false;
    storage.clearurls_disabled_rule_ids = migrated;
    if (clearurlsProviderSnapshot) clearurlsProviderSnapshot.disabledRuleIds = migrated.slice();
    if (typeof saveOnDisk === 'function') saveOnDisk(['clearurls_disabled_rule_ids']);
    return true;
}

// Pin changes found while providers are built (new pins for rules that
// were switched off before pins existed, drifted text, disable keys), written
// back by persistCoreRulePinChanges().
let pendingCoreRulePinChanges = [];

function getCoreRulePinSourceListId(providerName) {
    const customProviders = storage.custom_rules && storage.custom_rules.providers;
    if (customProviders && typeof customProviders === 'object' && Object.prototype.hasOwnProperty.call(customProviders, providerName)) return 'custom';
    const source = storage.mergeStats && storage.mergeStats.source;
    return typeof source === 'string' && source ? source : 'built-in';
}

// A rule matched to a pin keeps the pinned id (already set through the id
// lookup); its activation ids, worked out by storage from its current
// text, are moved to that id too.
function applyCoreRulePin(compiledRule) {
    compiledRule.activationIds = normalizeCoreRuleActivationIds((compiledRule.activationIds || []).map(activationId => {
        const sep = activationId.lastIndexOf("::");
        return sep === -1 ? activationId : `${activationId.slice(0, sep)}::${compiledRule.id}`;
    }));
    compiledRule.pinned = true;
}

// The disabled-rule ids that switch this rule off, once
// filterCoreRuleActivationIds() has run.
function getCoreRuleDisableKeys(compiledRule, disabledRuleIds) {
    if (!compiledRule || !disabledRuleIds || disabledRuleIds.size === 0) return [];
    if (compiledRule.runtimeRuleId && disabledRuleIds.has(compiledRule.runtimeRuleId)) return [compiledRule.runtimeRuleId];
    return (compiledRule.disabledActivationIds || []).filter(id => disabledRuleIds.has(id));
}

// A rule without an "id" that is switched off gets a pin if it has none,
// and a pin learns the disable keys it did not know about.
function trackCoreRulePin(providerName, compiledRule, disabledRuleIds, providerPins) {
    const disableKeys = getCoreRuleDisableKeys(compiledRule, disabledRuleIds);
    if (disableKeys.length === 0) return;
    const pin = LinkumoriRulePins.findPin(providerPins, providerName, compiledRule.id);
    if (pin && disableKeys.every(key => pin.disableKeys.includes(key))) return;
    pendingCoreRulePinChanges.push(LinkumoriRulePins.createPin({
        provider: providerName,
        section: compiledRule.section,
        generatedId: compiledRule.id,
        text: compiledRule.matchPattern,
        sourceListId: getCoreRulePinSourceListId(providerName),
        disableKeys
    }));
}

function persistCoreRulePinChanges(lastSeenUpdates) {
    const changes = pendingCoreRulePinChanges;
    pendingCoreRulePinChanges = [];
    if (changes.length === 0 && lastSeenUpdates.length === 0) return false;
    let pins = LinkumoriRulePins.normalizePins(storage[LinkumoriRulePins.PIN_STORAGE_KEY]);
    changes.forEach(pin => { pins = LinkumoriRulePins.upsertPin(pins, pin); });
    lastSeenUpdates.forEach(({ provider, generatedId, text }) => {
        const pin = LinkumoriRulePins.findPin(pins, provider, generatedId);
        if (!pin) return;
        if (text === pin.fingerprintAtToggle.text) delete pin.lastSeenText;
        else pin.lastSeenText = text;
    });
    storage[LinkumoriRulePins.PIN_STORAGE_KEY] = pins;
    if (typeof saveOnDisk === 'function') saveOnDisk([LinkumoriRulePins.PIN_STORAGE_KEY]);
    return true;
}

function describeCoreRulePin(pin, result) {
    return {
        provider: pin.provider,
        section: pin.section,
        generatedId: pin.generatedId,
        sourceListId: pin.sourceListId,
        disableKeys: pin.disableKeys.slice(),
        pinnedText: pin.fingerprintAtToggle.text,
        status: result ? result.status : 'orphaned',
        currentText: result ? result.text : '',
        similarity: result ? result.similarity : 0
    };
}

function getCoreRuleKindForSection(section) {
    if (section === 'rawRules') return 'raw';
    if (section === 'redirections') return 'redirection';
    if (section === 'exceptions') return 'exception';
    // fieldRedirections entries are field rules whose action is "redirect".
    return 'field';
}

function registerCoreRuleInSnapshot(compiledRule) {
    if (!compiledRule || !clearurlsProviderSnapshot) return;
    if (compiledRule.runtimeRuleId && !clearurlsProviderSnapshot.ruleIds[compiledRule.runtimeRuleId]) {
        clearurlsProviderSnapshot.ruleIds[compiledRule.runtimeRuleId] = {
            actionType: compiledRule.actionType,
            id: compiledRule.id,
            // True for an id generated from the rule's text (or pinned for it).
            generated: !!compiledRule.idGenerated,
            kind: getCoreRuleKindForSection(compiledRule.section),
            match: compiledRule.matchPattern,
            activationIds: (compiledRule.activationIds || []).slice(),
            aliases: (compiledRule.aliases || []).slice(),
            providerName: compiledRule.providerName,
            runtimeRuleId: compiledRule.runtimeRuleId,
            section: compiledRule.section
        };
    }
}

function registerDisabledCoreRuleInSnapshot(compiledRule) {
    if (!compiledRule || !clearurlsProviderSnapshot || !compiledRule.runtimeRuleId) return;
    clearurlsProviderSnapshot.disabledRules[compiledRule.runtimeRuleId] = {
        actionType: compiledRule.actionType,
        id: compiledRule.id,
        // True for an id generated from the rule's text (or pinned for it).
        generated: !!compiledRule.idGenerated,
        kind: getCoreRuleKindForSection(compiledRule.section),
        match: compiledRule.matchPattern,
        activationIds: (compiledRule.activationIds || []).slice(),
        disabledActivationIds: (compiledRule.disabledActivationIds || []).slice(),
        aliases: (compiledRule.aliases || []).slice(),
        providerName: compiledRule.providerName,
        runtimeRuleId: compiledRule.runtimeRuleId,
        section: compiledRule.section
    };
}

function normalizeAsciiHostname(value) {
    const host = String(value || '').trim().toLowerCase();
    if (!host) return null;
    if (/^[\x00-\x7F]+$/.test(host)) return host.endsWith('.') ? host.slice(0, -1) : host;
    try { return new URL('http://' + host).hostname.toLowerCase(); }
    catch (e) { return host.endsWith('.') ? host.slice(0, -1) : host; }
}

function getHostnameLookupTokens(hostnameInput) {
    const normalized = normalizeAsciiHostname(hostnameInput);
    const tokens = new Set();
    if (!normalized) return [];
    function addLabels(v) {
        String(v || '').split('.').map(l => l.trim().toLowerCase())
            .filter(l => /^[a-z0-9-]+$/i.test(l)).filter(l => l !== '*')
            .forEach(l => tokens.add(l));
    }
    addLabels(normalized);
    const parsed = parseHostnameWithPsl(normalized);
    if (parsed) { addLabels(parsed.domain); addLabels(parsed.subdomain); }
    return Array.from(tokens);
}

function initPslSupport() {
    if (pslSupport.status === 'loading' || pslSupport.status === 'ready') return pslSupport.loadPromise;
    pslSupport.status = 'loading';
    pslSupport.loadPromise = (async () => {
        try {
            const runtimeAPI = browser.runtime;
            if (!runtimeAPI || typeof fetch !== 'function') throw new Error('PSL module/runtime API unavailable');
            const pslService = (typeof globalThis !== 'undefined' && globalThis.linkumoriPsl) ? globalThis.linkumoriPsl : null;
            if (!pslService || typeof pslService.init !== 'function') throw new Error('linkumoriPsl service missing');
            await pslService.init({ dataPath: 'data/public_suffix_list.dat', runtimeAPI });
            if (pslService.status !== 'ready' || !pslService.parser ||
                typeof pslService.parser.getPublicSuffix !== 'function' ||
                typeof pslService.parser.getDomain !== 'function')
                throw new Error('PSL service initialized without usable parser');
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
    if (pslSupport.status === 'ready' && pslSupport.service) {
        if (typeof pslSupport.service.parseNormalizedHostname === 'function') {
            const parsed = pslSupport.service.parseNormalizedHostname(normalizedHostname);
            if (parsed && parsed.listed && parsed.tld) return {
                hostname: parsed.hostname || normalizedHostname,
                tld: parsed.tld || null, domain: parsed.domain || null,
                subdomain: parsed.subdomain || null, listed: true
            };
        }
        if (typeof pslSupport.service.lookupNormalized === 'function') {
            const lookup = pslSupport.service.lookupNormalized(normalizedHostname);
            if (lookup) return lookup;
        }
    }
    if (pslSupport.status !== 'ready' || !pslSupport.parser ||
        typeof pslSupport.parser.getPublicSuffix !== 'function' ||
        typeof pslSupport.parser.getDomain !== 'function') return null;
    try {
        const tld = pslSupport.parser.getPublicSuffix(normalizedHostname) || null;
        if (!tld) return null;
        const domain = pslSupport.parser.getDomain(normalizedHostname) || null;
        let subdomain = null;
        if (domain && normalizedHostname !== domain && normalizedHostname.endsWith('.' + domain))
            subdomain = normalizedHostname.slice(0, -(('.' + domain).length)) || null;
        return { hostname: normalizedHostname, tld, domain, subdomain, listed: true };
    } catch (e) { return null; }
}

function matchRootDomainWildcardTldWithPsl(hostnameValue, pattern) {
    if (pslSupport.status !== 'ready') return false;
    const normalizedHost = normalizeAsciiHostname(hostnameValue);
    const normalizedPattern = normalizeAsciiHostname(pattern);
    if (!normalizedHost || !normalizedPattern || !normalizedPattern.endsWith('.*')) return false;
    const base = normalizedPattern.slice(0, -2);
    if (!base) return false;
    const parsed = parseHostnameWithPsl(normalizedHost);
    if (!parsed || !parsed.tld) return false;
    const suffixToken = '.' + parsed.tld;
    if (!normalizedHost.endsWith(suffixToken)) return false;
    const prefix = normalizedHost.slice(0, -suffixToken.length);
    if (!prefix) return false;
    return prefix === base || prefix.endsWith('.' + base);
}

var requestContextManager = {
    initialized: false,
    tabs: new Map(),

    ensureTab(tabId) {
        let t = this.tabs.get(tabId);
        if (!t) { t = { url: '', frames: new Map() }; this.tabs.set(tabId, t); }
        return t;
    },

    setTabURL(tabId, url) {
        if (typeof tabId !== 'number' || tabId < 0 || typeof url !== 'string' || !url) return;
        const t = this.ensureTab(tabId);
        t.url = url;
        t.frames.set(0, { url, parentFrameId: -1 });
    },

    setFrameURL(tabId, frameId, url, parentFrameId = -1) {
        if (typeof tabId !== 'number' || tabId < 0) return;
        if (typeof frameId !== 'number' || frameId < 0) return;
        if (typeof url !== 'string' || !url) return;
        const t = this.ensureTab(tabId);
        t.frames.set(frameId, { url, parentFrameId });
        if (frameId === 0) t.url = url;
    },

    collectContextURLs(requestDetails) {
        const urls = [];
        if (!requestDetails || typeof requestDetails !== 'object') return urls;
        if (typeof requestDetails.documentUrl === 'string') urls.push(requestDetails.documentUrl);
        if (typeof requestDetails.originUrl === 'string') urls.push(requestDetails.originUrl);
        if (typeof requestDetails.initiator === 'string') urls.push(requestDetails.initiator);
        if (typeof requestDetails.tabUrl === 'string') urls.push(requestDetails.tabUrl);
        if (typeof requestDetails.referrer === 'string') urls.push(requestDetails.referrer);
        const tabId = requestDetails.tabId;
        if (typeof tabId === 'number' && tabId >= 0) {
            const tabCtx = this.tabs.get(tabId);
            if (tabCtx) {
                if (typeof tabCtx.url === 'string' && tabCtx.url) urls.push(tabCtx.url);
                const walkAncestors = (startFrameId) => {
                    if (typeof startFrameId !== 'number' || startFrameId < 0) return;
                    let frameId = startFrameId;
                    const visited = new Set();
                    for (let i = 0; i < 16; i++) {
                        if (visited.has(frameId)) break;
                        visited.add(frameId);
                        const entry = tabCtx.frames.get(frameId);
                        if (!entry) break;
                        if (typeof entry.url === 'string' && entry.url) urls.push(entry.url);
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
        browser.tabs.query({}).then(tabs => {
            if (!Array.isArray(tabs)) return;
            for (const tab of tabs)
                if (typeof tab?.id === 'number' && typeof tab?.url === 'string')
                    this.setTabURL(tab.id, tab.url);
        }).catch(handleError);
        browser.tabs.onUpdated.addListener((tabId, changeInfo, tab) => {
            const u = (changeInfo && typeof changeInfo.url === 'string')
                ? changeInfo.url : (tab && typeof tab.url === 'string' ? tab.url : null);
            if (u) this.setTabURL(tabId, u);
        });
        browser.tabs.onRemoved.addListener(tabId => { this.tabs.delete(tabId); });
        if (browser.webNavigation && browser.webNavigation.onCommitted) {
            browser.webNavigation.onCommitted.addListener(details => {
                // BUGFIX 10: clear stale frame entries on top-level navigation.
                if (details.frameId === 0) {
                    const t = this.tabs.get(details.tabId);
                    if (t) t.frames.clear();
                }
                this.setFrameURL(details.tabId, details.frameId, details.url, details.parentFrameId);
            });
        }
        if (browser.webNavigation && browser.webNavigation.onHistoryStateUpdated)
            browser.webNavigation.onHistoryStateUpdated.addListener(d =>
                this.setFrameURL(d.tabId, d.frameId, d.url, d.parentFrameId));
        if (browser.webNavigation && browser.webNavigation.onReferenceFragmentUpdated)
            browser.webNavigation.onReferenceFragmentUpdated.addListener(d =>
                this.setFrameURL(d.tabId, d.frameId, d.url, d.parentFrameId));
    }
};


// ---------------------------------------------------------------------------
// URLHashParams + Multimap
// ---------------------------------------------------------------------------

class URLHashParams {
    constructor(url) {
        Object.defineProperty(this, "_params", { enumerable: true, configurable: true, writable: true, value: void 0 });
        this._params = new Multimap();
        const hash = url.hash.slice(1);
        const params = hash.split('&');
        for (const p of params) {
            if (!p) continue;
            // BUGFIX 1: old code split on ALL '=' chars which destroyed values
            // containing '=' (base64 padding, JWT tokens, OAuth tokens).
            // Also dropped empty "key=" pairs. Split on the FIRST '=' only.
            const eq = p.indexOf('=');
            if (eq === -1) {
                this._params.put(p, null);  // bare key, no '='
                continue;
            }
            const key = p.slice(0, eq);
            if (!key) continue;
            this._params.put(key, p.slice(eq + 1));  // value may be empty string
        }
    }
    append(name, value = null) { this._params.put(name, value); }
    delete(name) { this._params.delete(name); }
    get(name) {
        // BUGFIX 1: previous code: const [first] = this._params.get(name);
        // if (first) return first; — this returned null for empty-string values.
        for (const value of this._params.get(name)) return value;
        return null;
    }
    getAll(name) { return this._params.get(name); }
    keys() { return this._params.keys(); }
    toString() {
        const rtn = [];
        this._params.forEach((key, value) => {
            // BUGFIX 1: old code treated empty-string value like null (no '=')
            // which silently turned "token=" into "token" on every rewrite.
            // null means no '=' was present; empty string means "key=" was.
            if (value !== null && value !== undefined) rtn.push(key + '=' + value);
            else rtn.push(key);
        });
        return rtn.join('&');
    }
}

class Multimap {
    constructor() {
        Object.defineProperty(this, "_map", { enumerable: true, configurable: true, writable: true, value: void 0 });
        Object.defineProperty(this, "_size", { enumerable: true, configurable: true, writable: true, value: void 0 });
        this._size = 0;
        this._map = new Map();
    }
    get size() { return this._size; }
    get(key) {
        const values = this._map.get(key);
        return values ? new Set(values) : new Set();
    }
    put(key, value) {
        let values = this._map.get(key);
        if (!values) values = new Set();
        const count = values.size;
        values.add(value);
        if (values.size === count) return false;
        this._map.set(key, values);
        this._size++;
        return true;
    }
    has(key) { return this._map.has(key); }
    hasEntry(key, value) { const v = this._map.get(key); return v ? v.has(value) : false; }
    delete(key) {
        const values = this._map.get(key);
        if (values && this._map.delete(key)) { this._size -= values.size; return true; }
        return false;
    }
    deleteEntry(key, value) {
        const values = this._map.get(key);
        if (values) {
            if (!values.delete(value)) return false;
            this._size--;
            return true;
        }
        return false;
    }
    clear() { this._map.clear(); this._size = 0; }
    entries() {
        const self = this;
        function* gen() {
            for (const [key, values] of self._map.entries())
                for (const value of values) yield [key, value];
        }
        return gen();
    }
    values() {
        const self = this;
        function* gen() { for (const [, v] of self.entries()) yield v; }
        return gen();
    }
    keys() { return this._map.keys(); }
    forEach(callback, thisArg) {
        for (const [key, value] of this.entries())
            callback.call(thisArg === undefined ? this : thisArg, key, value, this);
    }
    [Symbol.iterator]() { return this.entries(); }
}

// ---------------------------------------------------------------------------
// matchDomainPattern
// ---------------------------------------------------------------------------

function matchDomainPattern(url, patterns) {
    if (typeof patterns === 'string') patterns = [patterns];
    if (!Array.isArray(patterns) || patterns.length === 0) return false;

    function escapeRegexChar(char) {
        return /[\\^$.*+?()[\]{}|]/.test(char) ? ('\\' + char) : char;
    }

    function linkumoriTokensToRegexSource(input) {
        let output = '';
        for (let i = 0; i < input.length; i++) {
            const ch = input.charAt(i);
            if (ch === '*') output += '.*';
            else if (ch === '^') output += '(?:[^0-9A-Za-z_\\-.%]|$)';
            else output += escapeRegexChar(ch);
        }
        return output;
    }

    function compileLinkumoriRegex(pattern) {
        const cacheKey = String(pattern || '');
        if (linkumoriPatternRegexCache.has(cacheKey)) {
            // BUGFIX 11: refresh recency on hit so eviction below is LRU, not FIFO.
            const cached = linkumoriPatternRegexCache.get(cacheKey);
            linkumoriPatternRegexCache.delete(cacheKey);
            linkumoriPatternRegexCache.set(cacheKey, cached);
            return cached;
        }

        let raw = cacheKey;
        let domainAnchor = false, startAnchor = false, endAnchor = false;
        if (raw.startsWith('||')) { domainAnchor = true; raw = raw.slice(2); }
        else if (raw.startsWith('|')) { startAnchor = true; raw = raw.slice(1); }
        if (raw.endsWith('|')) { endAnchor = true; raw = raw.slice(0, -1); }
        if (domainAnchor) {
            const hb = firstSpecialIndex(raw);
            const hx = hb === -1 ? raw : raw.slice(0, hb);
            if (hx.startsWith('*.')) raw = raw.slice(2);
        }

        const source = linkumoriTokensToRegexSource(raw);
        const prefix = domainAnchor ? '^[A-Za-z][A-Za-z0-9+.-]*:\\/+(?:[^/?#]*\\.)?' : (startAnchor ? '^' : '');
        const suffix = endAnchor ? '$' : '';
        // BUGFIX 3: old boundary was (?=[/?#]|$) — excluded ':' so
        // ||example.com never matched http://example.com:8080/…
        const domainBoundary = (domainAnchor && !raw.endsWith('^') && !endAnchor) ? '(?=[:/?#]|$)' : '';

        let regex = null;
        try { regex = new RegExp(prefix + source + domainBoundary + suffix, 'i'); }
        catch (e) { regex = null; }

        // BUGFIX 11: was a full clear() on overflow, which caused every cached
        // pattern to recompile at once and produced a periodic latency spike.
        // Evict the single oldest (least-recently-used) entry instead so the
        // cache stays warm under steady load.
        if (linkumoriPatternRegexCache.size >= 5000) {
            const oldestKey = linkumoriPatternRegexCache.keys().next().value;
            if (oldestKey !== undefined) linkumoriPatternRegexCache.delete(oldestKey);
        }
        linkumoriPatternRegexCache.set(cacheKey, regex);
        return regex;
    }

    function compileTailRegex(tail) {
        let raw = String(tail || '');
        let startAnchor = false, endAnchor = false;
        if (raw.startsWith('|')) { startAnchor = true; raw = raw.slice(1); }
        if (raw.endsWith('|')) { endAnchor = true; raw = raw.slice(0, -1); }
        const source = linkumoriTokensToRegexSource(raw);
        return new RegExp((startAnchor ? '^' : '') + source + (endAnchor ? '$' : ''), 'i');
    }

    function firstSpecialIndex(input) {
        const s = input.indexOf('/'), c = input.indexOf('^'), p = input.indexOf('|');
        let idx = -1;
        if (s !== -1) idx = s;
        if (c !== -1 && (idx === -1 || c < idx)) idx = c;
        if (p !== -1 && (idx === -1 || p < idx)) idx = p;
        return idx;
    }

    function isSimpleHostExpression(input) { return /^[a-z0-9*.-]+$/i.test(input); }

    function matchHostPattern(hostname, pattern) {
        if (pslSupport.status !== 'ready') return false;
        const normalizedHost = normalizeAsciiHostname(hostname);
        let normalizedPattern = normalizeAsciiHostname(pattern);
        if (!normalizedHost || !normalizedPattern) return false;
        const hostParsed = parseHostnameWithPsl(normalizedHost);
        if (!hostParsed || !hostParsed.tld) return false;
        if (normalizedPattern.startsWith('*.')) normalizedPattern = normalizedPattern.slice(2);
        if (!normalizedPattern) return false;
        const wildcardTld = normalizedPattern.endsWith('.*');
        const basePattern = wildcardTld ? normalizedPattern.slice(0, -2) : normalizedPattern;
        if (!basePattern) return false;
        if (wildcardTld) return matchRootDomainWildcardTldWithPsl(normalizedHost, normalizedPattern);
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
        if (!hostExpr || !isSimpleHostExpression(hostExpr)) return null;

        if (!matchHostPattern(hostname, hostExpr)) {
            // PSL not ready → fall through to regex path.
            if (pslSupport.status !== 'ready') return null;
            // BUGFIX 4: when PSL is ready but the host or pattern is not in PSL
            // (localhost, .lan, custom intranet TLDs) matchHostPattern always
            // fails for structural reasons. Return null so we fall through to
            // compileLinkumoriRegex instead of permanently hard-failing.
            const hostParsed = parseHostnameWithPsl(hostname);
            if (!hostParsed || !hostParsed.tld) return null;
            let base = normalizeAsciiHostname(hostExpr) || '';
            if (base.startsWith('*.')) base = base.slice(2);
            if (!base.endsWith('.*')) {
                const pp = parseHostnameWithPsl(base);
                if (!pp || !pp.tld) return null;
            }
            return false;
        }

        let rest = tail;
        if (rest.startsWith('^')) rest = rest.slice(1);
        if (!rest) return true;
        const pathTarget = (urlObj.pathname + urlObj.search + urlObj.hash).toLowerCase();
        if (rest.startsWith('/') && !/[|*^]/.test(rest)) return pathTarget.startsWith(rest.toLowerCase());
        try { return compileTailRegex(rest.toLowerCase()).test(pathTarget); }
        catch (e) { return false; }
    }

    try {
        const urlObj = new URL(url);
        const hostname = normalizeAsciiHostname(urlObj.hostname);
        if (!hostname) return false;
        const fullUrl = url.toLowerCase();

        return patterns.some(pattern => {
            const p = String(pattern || '').trim();
            if (!p) return false;

            // Regex literal: /body/ or /body/flags
            if (p.charAt(0) === '/') {
                const closingSlash = p.lastIndexOf('/');
                if (closingSlash > 0) {
                    const body = p.slice(1, closingSlash);
                    const flags = p.slice(closingSlash + 1);
                    // BUGFIX 8: only treat as regex when flags are valid flag chars.
                    // Otherwise fall through — plain paths like "/path/to/x" must
                    // use the wildcard/substring path, not return false permanently.
                    if (/^[a-z]*$/i.test(flags)) {
                        try { return new RegExp(body, flags).test(url); }
                        catch (e) { /* fall through */ }
                    }
                }
            }

            const pLower = p.toLowerCase();
            if (pLower.startsWith('||')) {
                const structured = matchStructuredDomainAnchorPattern(pLower, urlObj, hostname);
                if (structured !== null) return structured;
            }

            const regex = compileLinkumoriRegex(pLower);
            if (regex) return regex.test(fullUrl);
            return fullUrl.includes(pLower);
        });
    } catch (e) { return false; }
}


// ---------------------------------------------------------------------------
// Modifier / rule parsing helpers
// ---------------------------------------------------------------------------

function splitLinkumoriModifiers(modifiersText) {
    const text = String(modifiersText || '');
    if (!text) return [];
    const parts = [];
    let current = '', inRegex = false, escaped = false;
    for (let i = 0; i < text.length; i++) {
        const ch = text.charAt(i), next = i + 1 < text.length ? text.charAt(i + 1) : '';
        if (!inRegex) {
            if (ch === ',') { if (current.trim()) parts.push(current.trim()); current = ''; continue; }
            current += ch;
            // A regex literal can start a modifier value ("=/re/") or any later
            // item of a |-separated list ("domain=a.com|/re/"); both must shield
            // commas inside the regex body from being treated as separators.
            if ((ch === '=' || ch === '|') && (next === '/' || (next === '~' && i + 2 < text.length && text.charAt(i + 2) === '/'))) {
                current += next === '~' ? '~/' : '/';
                inRegex = true; escaped = false;
                i += next === '~' ? 2 : 1;
            }
            continue;
        }
        current += ch;
        if (escaped) { escaped = false; continue; }
        if (ch === '\\') { escaped = true; continue; }
        if (ch === '/') inRegex = false;
    }
    if (current.trim()) parts.push(current.trim());
    return parts;
}

function findLinkumoriModifierStart(ruleText) {
    const text = String(ruleText || '');
    if (!text) return -1;
    // BUGFIX 7: the original only special-cased '/^…' patterns.  A rule like
    // /foo$bar/i$removeparam=x has a '$' inside the regex body that is NOT
    // the modifier separator.  Generalise: any rule whose pattern starts with
    // '/' needs us to find the closing unescaped '/' first, then look for '$'.
    if (text.startsWith('/')) {
        let escaped = false;
        for (let i = 1; i < text.length; i++) {
            const ch = text.charAt(i);
            if (escaped) { escaped = false; continue; }
            if (ch === '\\') { escaped = true; continue; }
            if (ch === '/') return text.charAt(i + 1) === '$' ? i + 1 : text.indexOf('$', i + 1);
        }
    }
    return text.indexOf('$');
}

function splitLinkumoriDelimitedValues(rawValue) {
    const values = [];
    let current = '', inRegex = false, escaped = false;
    String(rawValue || '').split('').forEach(ch => {
        if (!inRegex && ch === '|') { if (current.trim()) values.push(current.trim()); current = ''; return; }
        current += ch;
        if (escaped) { escaped = false; return; }
        if (ch === '\\') { escaped = true; return; }
        if (ch === '/') inRegex = !inRegex;
    });
    if (current.trim()) values.push(current.trim());
    return values;
}

function escapeLinkumoriRegExp(value) {
    return String(value || '').replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}

function parseLinkumoriRegexLiteral(value, defaultFlags = '') {
    const text = String(value || '').trim();
    const match = text.match(/^\/((?:\\.|[^/])+)\/([a-z]*)$/i);
    if (!match) return null;
    const flags = match[2] || defaultFlags;
    try { return new RegExp(match[1], flags.includes('i') ? 'i' : ''); } catch (e) { return null; }
}

const LINKUMORI_REMOVE_PARAM_CONTENT_TYPES = Object.freeze({
    document: ["main_frame"], subdocument: ["sub_frame"], script: ["script"],
    stylesheet: ["stylesheet"], image: ["image"], imageset: ["imageset"],
    media: ["media"], object: ["object"], other: ["other"], ping: ["ping"],
    websocket: ["websocket"], xmlhttprequest: ["xmlhttprequest"], font: ["font"]
});

function addLinkumoriRemoveParamRequestTypes(token, parsed) {
    const rawToken = String(token || '').trim();
    if (!rawToken) return false;
    const negated = rawToken.startsWith('~');
    const normalized = (negated ? rawToken.slice(1) : rawToken).trim().toLowerCase();
    const requestTypes = LINKUMORI_REMOVE_PARAM_CONTENT_TYPES[normalized];
    if (!requestTypes) return false;
    const target = negated ? parsed.excludeRequestTypes : parsed.requestTypes;
    requestTypes.forEach(rt => { if (!target.includes(rt)) target.push(rt); });
    return true;
}

function addLinkumoriHostnameValues(rawValue, includes, excludes, includeRegexes, excludeRegexes) {
    splitLinkumoriDelimitedValues(rawValue).forEach(part => {
        const raw = String(part || '').trim();
        if (!raw) return;
        const negated = raw.startsWith('~');
        const value = negated ? raw.slice(1).trim() : raw;
        const regex = parseLinkumoriRegexLiteral(value);
        if (regex) { (negated ? excludeRegexes : includeRegexes).push(regex); return; }
        (negated ? excludes : includes).push(value.toLowerCase());
    });
}

const LINKUMORI_SUPPORTED_METHODS = new Set(['GET', 'HEAD', 'OPTIONS', 'POST', 'PUT', 'PATCH', 'DELETE', 'CONNECT']);

function parseLinkumoriRemoveParamRule(ruleText) {
    const rawRule = String(ruleText || '').trim();
    if (!rawRule) return null;
    if (rawRule.startsWith('!') || rawRule.startsWith('[')) return null;
    let candidate = rawRule, isException = false;
    if (candidate.startsWith('@@')) { isException = true; candidate = candidate.slice(2); }
    const modifierStart = findLinkumoriModifierStart(candidate);
    if (modifierStart === -1) return null;
    const patternPart = candidate.slice(0, modifierStart).trim();
    const modifiersPart = candidate.slice(modifierStart + 1).trim();
    if (!modifiersPart) return null;
    const modifiers = splitLinkumoriModifiers(modifiersPart);
    let removeParamToken = null, domainToken = null, targetToken = null,
        methodToken = null, historyBypassProtectionToken = null, unsupportedModifier = null;
    for (const token of modifiers) {
        if (unsupportedModifier) break;
        const normalized = token.toLowerCase();
        if (normalized === 'removeparam' || normalized.startsWith('removeparam=')) {
            removeParamToken = token; continue;
        }
        if (normalized === 'match-case') continue;
        if (['first-party', 'third-party', 'strict-first-party', 'strict-third-party'].includes(normalized)) continue;
        if (normalized.startsWith('domain=')) {
            domainToken = token.slice(token.indexOf('=') + 1); continue;
        }
        if (normalized.startsWith('to=')) { targetToken = token.slice(token.indexOf('=') + 1); continue; }
        if (normalized.startsWith('method=')) { methodToken = token.slice(token.indexOf('=') + 1); continue; }
        if (normalized.startsWith('history-bypass-protection=')) {
            historyBypassProtectionToken = token.slice(token.indexOf('=') + 1); continue;
        }
        if (addLinkumoriRemoveParamRequestTypes(token, { requestTypes: [], excludeRequestTypes: [] })) continue;
        unsupportedModifier = token;
    }
    if (!removeParamToken) return null;
    if (unsupportedModifier) return null;

    // history-bypass-protection: true (default, missing = true) keeps this rule
    // active when a URL is cleaned because of a History API (pushState/replaceState)
    // update; false exempts this specific rule from that pass only — it still
    // applies to normal network-request cleaning.
    let historyBypassProtection = null;
    if (historyBypassProtectionToken !== null) {
        const v = String(historyBypassProtectionToken).trim().toLowerCase();
        if (['false', '0', 'no'].includes(v)) historyBypassProtection = false;
        else if (['true', '1', 'yes'].includes(v)) historyBypassProtection = true;
        else return null;
    }

    const parsed = {
        raw: rawRule, isException, urlPattern: patternPart || '*',
        removeAll: false, negate: false, literalParam: null, regexParam: null,
        includeDomains: [], excludeDomains: [], includeDomainRegexes: [], excludeDomainRegexes: [],
        includeTargetDomains: [], excludeTargetDomains: [], includeTargetDomainRegexes: [], excludeTargetDomainRegexes: [],
        includeMethods: [], excludeMethods: [],
        firstPartyOnly: false, thirdPartyOnly: false, strictFirstPartyOnly: false, strictThirdPartyOnly: false,
        matchCase: modifiers.some(t => String(t || '').toLowerCase() === 'match-case'),
        historyBypassProtection,
        id: null, activationIds: [],
        requestTypes: [], excludeRequestTypes: [], replacePattern: null, preprocessors: []
    };
    for (const token of modifiers) addLinkumoriRemoveParamRequestTypes(token, parsed);

    const removeValue = removeParamToken.indexOf('=') === -1
        ? '' : removeParamToken.slice(removeParamToken.indexOf('=') + 1).trim();
    if (!removeValue) {
        parsed.removeAll = true;
    } else {
        let value = removeValue;
        if (value.startsWith('~')) { parsed.negate = true; value = value.slice(1).trim(); }
        const regex = parseLinkumoriRegexLiteral(value);
        if (regex) parsed.regexParam = regex;
        else if (value.startsWith('|')) {
            try { parsed.regexParam = new RegExp('^' + escapeLinkumoriRegExp(value.slice(1)), 'i'); }
            catch (e) { return null; }
        } else {
            parsed.literalParam = parsed.matchCase ? value : value.toLowerCase();
        }
    }

    if (domainToken) {
        if (splitLinkumoriDelimitedValues(domainToken).length === 0) return null;
        addLinkumoriHostnameValues(domainToken, parsed.includeDomains, parsed.excludeDomains,
            parsed.includeDomainRegexes, parsed.excludeDomainRegexes);
    }
    if (targetToken) {
        if (splitLinkumoriDelimitedValues(targetToken).length === 0) return null;
        addLinkumoriHostnameValues(targetToken, parsed.includeTargetDomains, parsed.excludeTargetDomains,
            parsed.includeTargetDomainRegexes, parsed.excludeTargetDomainRegexes);
    }
    if (methodToken) {
        const mt = splitLinkumoriDelimitedValues(methodToken);
        if (mt.length === 0 || mt.some(v => !LINKUMORI_SUPPORTED_METHODS.has(String(v || '').replace(/^~/, '').toUpperCase()))) return null;
        mt.forEach(part => {
            const v = String(part || '').trim().toUpperCase();
            if (!v) return;
            if (v.startsWith('~')) parsed.excludeMethods.push(v.slice(1).trim());
            else parsed.includeMethods.push(v);
        });
    }
    modifiers.forEach(token => {
        const n = String(token || '').toLowerCase();
        if (n === 'third-party') parsed.thirdPartyOnly = true;
        else if (n === 'first-party') parsed.firstPartyOnly = true;
        else if (n === 'strict-third-party') parsed.strictThirdPartyOnly = true;
        else if (n === 'strict-first-party') parsed.strictFirstPartyOnly = true;
    });
    if ((parsed.firstPartyOnly && parsed.thirdPartyOnly) ||
        (parsed.strictFirstPartyOnly && parsed.strictThirdPartyOnly) ||
        (parsed.strictFirstPartyOnly && parsed.thirdPartyOnly) ||
        (parsed.strictThirdPartyOnly && parsed.firstPartyOnly)) return null;
    return parsed;
}

function getLinkumoriRemoveParamRuleText(rule) {
    if (typeof rule === 'string') return rule;
    if (rule && typeof rule === 'object' && !Array.isArray(rule) && typeof rule.matchPattern === 'string') {
        return rule.matchPattern;
    }
    return '';
}

function parseLinkumoriRemoveParamRuleDefinition(rule) {
    return parseLinkumoriRemoveParamRule(getLinkumoriRemoveParamRuleText(rule));
}

function getLinkumoriRemoveParamTraceName(linkumoriRule) {
    if (!linkumoriRule) return '$removeparam';
    if (typeof linkumoriRule.id === 'string' && linkumoriRule.id) return linkumoriRule.id;
    if (typeof linkumoriRule.raw === 'string' && linkumoriRule.raw) return linkumoriRule.raw;
    return '$removeparam';
}

function safeDecodeLinkumoriParam(value) {
    try { return decodeURIComponent(String(value || '')); } catch (e) { return String(value || ''); }
}

function linkumoriRemoveParamMatchesRequestType(linkumoriRule, request = null) {
    const requestTypes = Array.isArray(linkumoriRule?.requestTypes) ? linkumoriRule.requestTypes : [];
    const excludeRequestTypes = Array.isArray(linkumoriRule?.excludeRequestTypes) ? linkumoriRule.excludeRequestTypes : [];
    if (requestTypes.length === 0 && excludeRequestTypes.length === 0) return true;
    const requestType = String(request && request.type || "").toLowerCase();
    if (!requestType) return false;
    if (excludeRequestTypes.indexOf(requestType) !== -1) return false;
    return requestTypes.length === 0 || requestTypes.indexOf(requestType) !== -1;
}

function getLinkumoriURLHostname(url) {
    try { return normalizeAsciiHostname(new URL(url).hostname) || ''; } catch (e) { return ''; }
}

function linkumoriHostnameMatchesRegexes(hostname, regexes) {
    if (!hostname || !Array.isArray(regexes) || regexes.length === 0) return false;
    return regexes.some(regex => { try { regex.lastIndex = 0; return regex.test(hostname); } catch (e) { return false; } });
}

function getLinkumoriRequestContextHosts(request, fallbackHost = '') {
    const contextHosts = request
        ? requestContextManager.collectContextURLs(request).map(getLinkumoriURLHostname).filter(Boolean)
        : [];
    return contextHosts.length > 0 ? contextHosts : (fallbackHost ? [fallbackHost] : []);
}

function getLinkumoriDocumentHost(request) {
    const ch = getLinkumoriRequestContextHosts(request);
    return ch.length > 0 ? ch[0] : '';
}

function getLinkumoriRegistrableDomain(hostname) {
    const parsed = parseHostnameWithPsl(hostname);
    return (parsed && parsed.domain) ? parsed.domain : hostname;
}

function linkumoriRemoveParamMatchesParty(linkumoriRule, targetHost, request = null) {
    if (!linkumoriRule.firstPartyOnly && !linkumoriRule.thirdPartyOnly &&
        !linkumoriRule.strictFirstPartyOnly && !linkumoriRule.strictThirdPartyOnly) return true;
    if (!targetHost) return false;
    const documentHost = getLinkumoriDocumentHost(request);
    if (!documentHost) return !linkumoriRule.thirdPartyOnly && !linkumoriRule.strictThirdPartyOnly;
    const sameHost = documentHost === targetHost;
    const sameSite = getLinkumoriRegistrableDomain(documentHost) === getLinkumoriRegistrableDomain(targetHost);
    if (linkumoriRule.strictFirstPartyOnly && !sameHost) return false;
    if (linkumoriRule.strictThirdPartyOnly && sameHost) return false;
    if (linkumoriRule.firstPartyOnly && !sameSite) return false;
    if (linkumoriRule.thirdPartyOnly && sameSite) return false;
    return true;
}

function linkumoriRemoveParamMatchesTargetDomains(linkumoriRule, targetHost) {
    if (!targetHost) return false;
    if (Array.isArray(linkumoriRule.includeTargetDomains) && linkumoriRule.includeTargetDomains.length > 0 &&
        !linkumoriRule.includeTargetDomains.some(p => matchWhitelistHostnamePattern(targetHost, p))) return false;
    if (Array.isArray(linkumoriRule.includeTargetDomainRegexes) && linkumoriRule.includeTargetDomainRegexes.length > 0 &&
        !linkumoriHostnameMatchesRegexes(targetHost, linkumoriRule.includeTargetDomainRegexes)) return false;
    if (Array.isArray(linkumoriRule.excludeTargetDomains) &&
        linkumoriRule.excludeTargetDomains.some(p => matchWhitelistHostnamePattern(targetHost, p))) return false;
    if (linkumoriHostnameMatchesRegexes(targetHost, linkumoriRule.excludeTargetDomainRegexes)) return false;
    return true;
}

function matchLinkumoriRemoveParamTarget(linkumoriRule, fullUrl, request = null, isHistoryUpdate = false) {
    if (!linkumoriRule || !fullUrl) return false;
    if (isHistoryUpdate && linkumoriRule.historyBypassProtection === false) return false;
    if (!coreRuleHasActivePatternForUrl(linkumoriRule, fullUrl)) return false;
    if (!linkumoriRemoveParamMatchesRequestType(linkumoriRule, request)) return false;
    if (linkumoriRule.urlPattern && linkumoriRule.urlPattern !== '*') {
        if (!matchDomainPattern(fullUrl, [linkumoriRule.urlPattern])) {
            if (linkumoriRule.isException && request) {
                const contextUrls = requestContextManager.collectContextURLs(request);
                if (!contextUrls.some(u => u && matchDomainPattern(u, [linkumoriRule.urlPattern]))) return false;
            } else return false;
        }
    }
    let urlHost = getLinkumoriURLHostname(fullUrl);
    if (!urlHost) return false;
    const contextHosts = getLinkumoriRequestContextHosts(request, urlHost);
    if (!linkumoriRemoveParamMatchesParty(linkumoriRule, urlHost, request)) return false;
    if (!linkumoriRemoveParamMatchesTargetDomains(linkumoriRule, urlHost)) return false;
    if (linkumoriRule.includeDomains.length > 0) {
        const dh = (linkumoriRule.isException && request) ? contextHosts : [urlHost];
        if (!linkumoriRule.includeDomains.some(p => dh.some(h => matchWhitelistHostnamePattern(h, p)))) return false;
    }
    if (Array.isArray(linkumoriRule.includeDomainRegexes) && linkumoriRule.includeDomainRegexes.length > 0) {
        const dh = (linkumoriRule.isException && request) ? contextHosts : [urlHost];
        if (!dh.some(h => linkumoriHostnameMatchesRegexes(h, linkumoriRule.includeDomainRegexes))) return false;
    }
    if (linkumoriRule.excludeDomains.length > 0) {
        const dh2 = (linkumoriRule.isException && request) ? contextHosts : [urlHost];
        if (linkumoriRule.excludeDomains.some(p => dh2.some(h => matchWhitelistHostnamePattern(h, p)))) return false;
    }
    if (Array.isArray(linkumoriRule.excludeDomainRegexes) && linkumoriRule.excludeDomainRegexes.length > 0) {
        const dh2 = (linkumoriRule.isException && request) ? contextHosts : [urlHost];
        if (dh2.some(h => linkumoriHostnameMatchesRegexes(h, linkumoriRule.excludeDomainRegexes))) return false;
    }
    if (linkumoriRule.includeMethods.length > 0) {
        const rm = (request && typeof request.method === 'string') ? request.method.toUpperCase() : '';
        if (!linkumoriRule.includeMethods.includes(rm)) return false;
    }
    if (linkumoriRule.excludeMethods.length > 0) {
        const rm = (request && typeof request.method === 'string') ? request.method.toUpperCase() : '';
        if (linkumoriRule.excludeMethods.includes(rm)) return false;
    }
    return true;
}

function linkumoriRemoveParamMatchesName(linkumoriRule, fieldName, values = []) {
    if (!linkumoriRule || !fieldName) return false;
    if (linkumoriRule.removeAll) return true;
    const rawParamName = String(fieldName);
    const paramName = linkumoriRule.matchCase ? rawParamName : rawParamName.toLowerCase();
    let matched = false;
    if (linkumoriRule.regexParam) {
        const paramValues = Array.isArray(values) && values.length > 0 ? values : [''];
        linkumoriRule.regexParam.lastIndex = 0;
        matched = linkumoriRule.regexParam.test(rawParamName) || paramValues.some(value => {
            const pair = rawParamName + '=' + safeDecodeLinkumoriParam(value);
            linkumoriRule.regexParam.lastIndex = 0;
            return linkumoriRule.regexParam.test(pair);
        });
    } else if (linkumoriRule.literalParam !== null) {
        matched = paramName === linkumoriRule.literalParam;
    }
    return linkumoriRule.negate ? !matched : matched;
}

function evaluateLinkumoriRemoveParamRules(fullUrl, rules, request = null, isHistoryUpdate = false) {
    return (rules || []).filter(rule => matchLinkumoriRemoveParamTarget(rule, fullUrl, request, isHistoryUpdate));
}

function resolveLinkumoriParamDecision(fieldName, values, activeRules, activeExceptions) {
    const rawFieldName = String(fieldName || '');
    if (!rawFieldName) return { handled: false, remove: false, matchedRule: null };
    const matchedException = (activeExceptions || []).find(r => linkumoriRemoveParamMatchesName(r, rawFieldName, values));
    if (matchedException) return { handled: true, remove: false, matchedRule: getLinkumoriRemoveParamTraceName(matchedException), rule: matchedException };
    const matchedRule = (activeRules || []).find(r => linkumoriRemoveParamMatchesName(r, rawFieldName, values));
    if (matchedRule) return {
        handled: true,
        remove: matchedRule.replacePattern === null,
        rewrite: matchedRule.replacePattern !== null,
        replacePattern: matchedRule.replacePattern,
        preprocessors: Array.isArray(matchedRule.preprocessors) ? matchedRule.preprocessors : [],
        matchedRule: getLinkumoriRemoveParamTraceName(matchedRule),
        rule: matchedRule
    };
    return { handled: false, remove: false, rewrite: false, matchedRule: null };
}

function linkumoriRemoveParamExceptionMatchesMethod(linkumoriRule, request = null) {
    const rm = (request && typeof request.method === 'string') ? request.method.toUpperCase() : '';
    if (linkumoriRule.includeMethods.length > 0 && !linkumoriRule.includeMethods.includes(rm)) return false;
    if (linkumoriRule.excludeMethods.length > 0 && linkumoriRule.excludeMethods.includes(rm)) return false;
    return true;
}

function linkumoriRemoveParamExceptionMatchesContext(linkumoriRule, contextUrls, request = null) {
    if (!linkumoriRule || !linkumoriRule.isException || !Array.isArray(contextUrls)) return false;
    if (!linkumoriRemoveParamMatchesRequestType(linkumoriRule, request)) return false;
    if (!linkumoriRemoveParamExceptionMatchesMethod(linkumoriRule, request)) return false;
    return contextUrls.some(cu => cu && matchLinkumoriRemoveParamTarget(linkumoriRule, cu, request));
}

function resolveLinkumoriHistoryBypassProtection(rule, defaults) {
    if (rule && typeof rule === 'object') {
        if (typeof rule.historyBypassProtection === 'boolean') return rule.historyBypassProtection;
    }
    if (defaults && typeof defaults === 'object') {
        if (typeof defaults.historyBypassProtection === 'boolean') return defaults.historyBypassProtection;
    }
    // Missing everywhere in the rule chain: default to true (protection stays on for history updates).
    return true;
}

function normalizeCoreRuleAliases(value) {
    if (!Array.isArray(value)) return [];
    return [...new Set(value.filter(alias => typeof alias === "string" && /^[a-z0-9][a-z0-9_-]*$/.test(alias)))];
}

// `"referralMarketing": true` on a rule in `rules` makes it a
// referral-marketing rule without moving it to that list.
function isReferralMarketingRule(rule) {
    return !!rule && typeof rule === "object" && rule.referralMarketing === true;
}

function normalizeCoreRuleOrder(value) {
    return typeof value === "number" && Number.isFinite(value) ? value : null;
}

function normalizeCoreRuleDefinition(rule, defaultFlags = "i", defaults = null) {
    if (typeof rule === "string") {
        return {
            actionType: "remove", active: true, aliases: [], description: "", exceptions: [],
            flags: defaultFlags, order: null, id: null, matchPattern: rule, preprocessors: [],
            replacePattern: null, requestTypes: null, raw: rule,
            historyBypassProtection: resolveLinkumoriHistoryBypassProtection(null, defaults)
        };
    }
    const resolvedRule = rule;
    if (!resolvedRule || typeof resolvedRule !== "object" || Array.isArray(resolvedRule)) return null;
    const matchPattern = resolvedRule.matchPattern;
    if (typeof matchPattern !== "string") return null;
    const replacePattern = typeof resolvedRule.replacePattern === "string" ? resolvedRule.replacePattern : null;
    const actionType = replacePattern !== null ? "rewrite" : "remove";
    const requestTypes = Array.isArray(resolvedRule.requestTypes)
        ? resolvedRule.requestTypes.map(i => String(i || "").toLowerCase()).filter(Boolean) : null;
    return {
        actionType,
        active: typeof resolvedRule.active === "boolean" ? resolvedRule.active : true,
        aliases: normalizeCoreRuleAliases(resolvedRule.aliases),
        description: typeof resolvedRule.description === "string" ? resolvedRule.description : "",
        exceptions: Array.isArray(resolvedRule.exceptions) ? resolvedRule.exceptions.filter(i => typeof i === "string") : [],
        flags: typeof resolvedRule.flags === "string" ? resolvedRule.flags : defaultFlags,
        order: normalizeCoreRuleOrder(resolvedRule.order),
        id: typeof resolvedRule.id === "string" ? resolvedRule.id : null,
        matchPattern,
        preprocessors: Array.isArray(resolvedRule.preprocessors) ? resolvedRule.preprocessors : [],
        replacePattern, requestTypes, raw: resolvedRule,
        historyBypassProtection: resolveLinkumoriHistoryBypassProtection(resolvedRule, defaults),
        _linkumoriActivationIds: normalizeCoreRuleActivationIds(resolvedRule._linkumoriActivationIds),
        _linkumoriLegacyRuleIds: normalizeCoreRuleAliases(resolvedRule._linkumoriLegacyRuleIds)
    };
}

function compileCoreRuleDefinition(rule, defaultFlags = "i", wrapFieldRule = false, defaults = null) {
    const normalized = normalizeCoreRuleDefinition(rule, defaultFlags, defaults);
    if (!normalized) return null;
    const source = wrapFieldRule ? "^" + normalized.matchPattern + "$" : normalized.matchPattern;
    try {
        // Per-rule exceptions are case-insensitive, like provider-level exceptions.
        const exceptionRegexes = normalized.exceptions.map(ex => { try { return new RegExp(ex, "i"); } catch (_) { return null; } }).filter(Boolean);
        return { ...normalized, exceptionRegexes, regex: new RegExp(source, normalized.flags) };
    } catch (_) { return null; }
}

// A rawRules entry may carry the pattern and options of a $removeparam
// filter (§4), with "rawrule=" last so the regex after it is taken whole:
//   "[@@][pattern]$[option,…,]rawrule=regex"
//   "||amazon.*^$third-party,method=get,rawrule=\\/ref=[^/?]*"
// The pattern and options decide where the rule runs; the regex is what it
// deletes. With "@@" in front the entry is an exception instead: it stops
// this provider's raw rules with that regex (all of them when nothing
// follows "rawrule=", or the one named by a rule object's "targetId") where
// its pattern and options match. Returns null for a plain regex, and
// { filter: null } when the pattern or options are invalid.
function parseLinkumoriRawRuleText(text) {
    const trimmed = String(text || '').trim();
    const isException = trimmed.startsWith('@@');
    const body = isException ? trimmed.slice(2) : trimmed;
    const markerRegex = /[$,]rawrule=/ig;
    let marker, modifierStart = -1;
    while ((marker = markerRegex.exec(body))) {
        modifierStart = findLinkumoriModifierStart(body.slice(0, marker.index + 1));
        if (modifierStart !== -1) break;
    }
    if (!marker || modifierStart === -1) return null;
    const pattern = body.slice(0, modifierStart).trim();
    const options = marker.index > modifierStart ? body.slice(modifierStart + 1, marker.index).trim() : '';
    const regex = body.slice(marker.index + marker[0].length);
    const optionTokens = splitLinkumoriModifiers(options);
    const filter = optionTokens.some(t => /^(?:removeparam|rawrule)(?:=|$)/i.test(t)) ? null
        : parseLinkumoriRemoveParamRule((isException ? '@@' : '') + pattern + '$' + (options ? options + ',' : '') + 'removeparam');
    return { isException, pattern, options, regex, filter };
}

function compileRawRuleDefinition(rule, defaults = null) {
    const normalized = normalizeCoreRuleDefinition(rule, "gi", defaults);
    if (!normalized) return null;
    const parsed = parseLinkumoriRawRuleText(normalized.matchPattern);
    if (!parsed) {
        const compiled = compileCoreRuleDefinition(rule, "gi", false, defaults);
        if (!compiled) return null;
        return { ...compiled, rawRegexSource: normalized.matchPattern };
    }
    const filter = parsed.filter;
    if (!filter) return null;
    const historyBypassProtection = filter.historyBypassProtection === false ? false : normalized.historyBypassProtection;
    if (parsed.isException) {
        // Nothing is matched against the URL text; the regex only names the
        // raw rules this exception stops.
        const exceptionRegexes = normalized.exceptions.map(ex => { try { return new RegExp(ex, "i"); } catch (_) { return null; } }).filter(Boolean);
        const targetId = rule && typeof rule === "object" && typeof rule.targetId === "string" && rule.targetId ? rule.targetId : null;
        return { ...normalized, historyBypassProtection, exceptionRegexes, regex: null, isException: true,
            rawRegexSource: parsed.regex, targetId, rawFilter: filter };
    }
    if (!parsed.regex) return null;
    // match-case drops the default "i"; a rule object's own flags string wins.
    const flags = rule && typeof rule === "object" && typeof rule.flags === "string" ? rule.flags
        : (filter.matchCase ? "g" : "gi");
    const compiled = compileCoreRuleDefinition(typeof rule === "string" ? parsed.regex : { ...rule, matchPattern: parsed.regex, flags },
        flags, false, defaults);
    if (!compiled) return null;
    // Keep the full entry as matchPattern so generated ids stay tied to it.
    return { ...compiled, matchPattern: normalized.matchPattern, raw: normalized.raw, historyBypassProtection,
        rawRegexSource: parsed.regex, rawFilter: filter };
}

function getCoreRuleTraceName(compiledRule, fallback) {
    return compiledRule && typeof compiledRule.id === "string" && compiledRule.id ? compiledRule.id : fallback;
}

function coreRuleAppliesToRequest(compiledRule, url, request, isHistoryUpdate = false) {
    if (!compiledRule) return false;
    if (isHistoryUpdate && compiledRule.historyBypassProtection === false) return false;
    // BUGFIX 12: a bare RegExp used to short-circuit straight to `true`,
    // skipping active/exception/request-type checks entirely. Nothing in this
    // file constructs a bare-RegExp "compiled rule" anymore (all rule paths
    // go through compileCoreRuleDefinition / parseLinkumoriRemoveParamRule),
    // so treat it the same as any other compiled rule: test it as the regex
    // it is, with no special bypass.
    if (compiledRule instanceof RegExp) {
        compiledRule.lastIndex = 0;
        return compiledRule.test(url);
    }
    if (compiledRule.active === false) return false;
    if (!coreRuleHasActivePatternForUrl(compiledRule, url)) return false;
    // Pattern and $removeparam-style options of a "…$…rawrule=" raw rule.
    if (compiledRule.rawFilter && !matchLinkumoriRemoveParamTarget(compiledRule.rawFilter, url, request, isHistoryUpdate)) return false;
    if (compiledRule.requestTypes && compiledRule.requestTypes.length > 0) {
        const rt = String(request && request.type || "").toLowerCase();
        if (!rt || compiledRule.requestTypes.indexOf(rt) === -1) return false;
    }
    if (Array.isArray(compiledRule.exceptionRegexes) && compiledRule.exceptionRegexes.length > 0) {
        return !compiledRule.exceptionRegexes.some(regex => { try { regex.lastIndex = 0; return regex.test(url); } catch (_) { return false; } });
    }
    const exceptions = Array.isArray(compiledRule.exceptions) ? compiledRule.exceptions : [];
    return !exceptions.some(ex => { try { return (new RegExp(ex, "i")).test(url); } catch (_) { return false; } });
}

function applyCoreRulePreprocessors(values, preprocessors) {
    let next = values.slice();
    for (const preprocessor of preprocessors || []) {
        if (!preprocessor || typeof preprocessor.type !== "string") continue;
        const indexes = preprocessor.inputs === "all"
            ? next.map((_, i) => i)
            : (Array.isArray(preprocessor.inputs) ? preprocessor.inputs.map(v => Number(v) - 1) : []);
        for (const index of indexes) {
            if (index < 0 || index >= next.length) continue;
            const current = String(next[index] == null ? "" : next[index]);
            try {
                switch (preprocessor.type) {
                    case "urlEncode": next[index] = encodeURIComponent(current); break;
                    case "urlDecode": next[index] = decodeURIComponent(current); break;
                    case "doubleUrlEncode": next[index] = encodeURIComponent(encodeURIComponent(current)); break;
                    case "doubleUrlDecode": next[index] = decodeURIComponent(decodeURIComponent(current)); break;
                    case "base64Encode": next[index] = btoa(unescape(encodeURIComponent(current))); break;
                    case "base64Decode": next[index] = decodeURIComponent(escape(atob(current))); break;
                }
            } catch (e) {
                // BUGFIX 13: preprocessor failures (malformed base64/URI-encoding)
                // used to vanish silently, leaving a stale/undefined value with no
                // trace. Log once with enough context to diagnose which rule and
                // preprocessor step failed, then keep the pre-step value.
                console.warn('[linkumori] preprocessor failed', { type: preprocessor.type, index, error: String(e && e.message || e) });
            }
        }
    }
    return next;
}

function applyCoreReplacePattern(pattern, values) {
    if (pattern === null || pattern === undefined) return "";
    return String(pattern).replace(/§\d+?§/g, placeholder => {
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
        return match.startsWith('?') && nextCharacter === '&' ? '?' : '';
    });
}


// ---------------------------------------------------------------------------
// removeFieldsFormURL
// ---------------------------------------------------------------------------

// BUGFIX 14: extracted from three near-identical inline blocks that used to
// live in removeFieldsFormURL (one for provider rules over query fields, one
// for provider rules over fragments, one for $removeparam over both). Each
// copy independently walked keys, decided delete-vs-rewrite-vs-skip, applied
// preprocessors, and logged — any fix to that logic had to be made three
// times and was easy to miss one of. This is now the single implementation.
//
// `decide(key, values)` returns either:
//   - null / { handled:false }                → leave the param untouched
//   - { handled:true, remove:true }            → delete the param
//   - { handled:true, rewrite:true, replacePattern, preprocessors } → rewrite its value(s)
// `rewriteTracker` is the shared `appliedFieldRewrites` Set (mirrors the
// original cross-pass dedup). `dedupeKey(key, decision)`, if given, builds
// the string identifying this specific rewrite; when omitted, no dedup is
// applied (a `decide` that never rewrites twice for the same key doesn't need it).
function applyParamDecisionsToStore(store, decide, rewriteTracker, dedupeKey) {
    let changed = false;
    const toDelete = [];
    for (const key of Array.from(store.keys())) {
        const decision = decide(key, store.getAll(key));
        if (!decision || !decision.handled) continue;
        if (decision.remove) {
            toDelete.push(key);
            changed = true;
        } else if (decision.rewrite) {
            const dupKey = (rewriteTracker && dedupeKey) ? dedupeKey(key, decision) : null;
            if (dupKey && rewriteTracker.has(dupKey)) continue;
            const currentValues = store.getAll(key);
            store.delete(key);
            currentValues.forEach(value => {
                const vals = applyCoreRulePreprocessors([value], decision.preprocessors);
                store.append(key, applyCoreReplacePattern(decision.replacePattern, vals));
            });
            if (dupKey) rewriteTracker.add(dupKey);
            changed = true;
        }
    }
    toDelete.forEach(k => store.delete(k));
    return changed;
}

function removeFieldsFormURL(provider, pureUrl, quiet = false, request = null, traceCollector = null, extraExceptions = [], sessionRewrites = null, isHistoryUpdate = false) {
    let url = pureUrl;
    let domain = "", fragments = "", fields = "";
    let linkumoriParamRules = provider.getLinkumoriRemoveParamRules();
    let linkumoriParamExceptions = provider.getLinkumoriRemoveParamExceptions();
    let changes = false, actionType = null, matchedRuleForTrace = null;
    let urlObject = new URL(url);
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
        return { changes: false, url, cancel: false, providerMatch, matchedRule: null, action: null };
    }

    let re = storage.redirectionEnabled ? provider.getRedirection(url, request) : null;
    if (re !== null) {
        url = decodeURL(re);
        if (!quiet) {
            pushToLog(pureUrl, url, translate('log_redirect'), providerMatch);
            increaseTotalCounter(1);
            increaseBadged(false, request);
        }
        return { redirect: true, url, providerMatch, matchedRule: translate('log_redirect'), action: 'redirect' };
    }

    if (storage.redirectionEnabled) {
        const fieldRedirect = provider.getFieldRedirection(url, request, isHistoryUpdate);
        if (fieldRedirect) {
            url = decodeURL(fieldRedirect.url);
            if (!quiet) {
                pushToLog(pureUrl, url, translate('log_redirect'), providerMatch);
                increaseTotalCounter(1);
                increaseBadged(false, request);
            }
            return { redirect: true, url, providerMatch, matchedRule: translate('log_redirect'), action: 'redirect' };
        }
    }

    if (provider.isCanceling() && storage.domainBlocking) {
        // BUGFIX 6: counters/badge were incremented even in quiet mode.
        if (!quiet) {
            pushToLog(pureUrl, pureUrl, translate('log_domain_blocked'), providerMatch);
            increaseTotalCounter(1);
            increaseBadged(false, request);
        }
        return { cancel: true, url, providerMatch, matchedRule: translate('log_domain_blocked'), action: 'cancel' };
    }

    // rawRules work on the URL string; rules/referralMarketing work on the
    // parsed query and fragment. Rule `order` can interleave the two, so the
    // URL is parsed when a field rule needs it and written back when a raw
    // rule comes after field rules that changed something.
    let parsed = false, hadParams = false, fieldsDirty = false;
    let linkumoriState = null;

    const buildURLFromParts = () => {
        let finalURL = domain;
        if (fields.toString() !== "") finalURL += "?" + urlSearchParamsToString(fields);
        if (fragments.toString() !== "") finalURL += "#" + fragments.toString();
        return finalURL.replace(/\?&/, "?").replace(/#&/, "#");
    };

    const parseURL = () => {
        if (parsed) return;
        urlObject = new URL(url);
        fields = urlObject.searchParams;
        fragments = extractFragments(urlObject);
        domain = urlWithoutParamsAndHash(urlObject).toString();
        hadParams = fields.toString() !== "" || fragments.toString() !== "";
        fieldsDirty = false;
        linkumoriState = null;
        parsed = true;
    };

    const unparseURL = () => {
        if (!parsed) return;
        if (fieldsDirty) url = buildURLFromParts();
        parsed = false;
    };

    const hasParams = () => fields.toString() !== "" || fragments.toString() !== "";

    const getLinkumoriState = () => {
        if (linkumoriState) return linkumoriState;
        const activeRules = evaluateLinkumoriRemoveParamRules(url, linkumoriParamRules, request, isHistoryUpdate);
        const activeExceptions = [
            ...evaluateLinkumoriRemoveParamRules(url, linkumoriParamExceptions, request, isHistoryUpdate),
            ...(extraExceptions || [])
        ];
        const cache = new Map();
        const getDecision = (paramName, paramValues = []) => {
            // BUGFIX 2: URLHashParams.getAll() returns a Set (Multimap), so fragment
            // values arrived as Sets and were collapsed to [] by Array.isArray().
            // Value-based $removeparam regexes therefore never fired on hash params.
            // Convert Set → Array so fragment and query params behave identically.
            const values = Array.isArray(paramValues) ? paramValues
                : (paramValues instanceof Set ? Array.from(paramValues) : []);
            const cacheKey = String(paramName || '') + "\u0000" + values.join("\u0001");
            if (cache.has(cacheKey)) return cache.get(cacheKey);
            const decision = resolveLinkumoriParamDecision(paramName, values, activeRules, activeExceptions);
            cache.set(cacheKey, decision);
            return decision;
        };
        linkumoriState = { activeRules, activeExceptions, getDecision };
        return linkumoriState;
    };

    const runRawStep = (rawRuleStr, compiled) => {
        unparseURL();
        if (!coreRuleAppliesToRequest(compiled, url, request, isHistoryUpdate)) return;
        if (provider.isRawRuleExcepted(compiled, url, request)) return;
        const activeRegex = compiled && compiled.regex instanceof RegExp ? compiled.regex : new RegExp(rawRuleStr, "gi");
        let beforeReplace = url;
        if (compiled && compiled.replacePattern !== null) {
            url = url.replace(activeRegex, (...args) => {
                const hasNamedGroups = args.length >= 3 && typeof args[args.length - 1] === 'object' && args[args.length - 1] !== null;
                const endIndex = hasNamedGroups ? args.length - 3 : args.length - 2;
                const values = applyCoreRulePreprocessors(args.slice(1, endIndex).map(v => v === undefined ? '' : String(v)), compiled.preprocessors);
                return applyCoreReplacePattern(compiled.replacePattern, values);
            });
        } else {
            url = removeRawRuleMatchesPreservingQueryBoundary(url, activeRegex);
        }
        if (beforeReplace !== url) {
            if (storage.loggingStatus && !quiet) pushToLog(beforeReplace, url, rawRuleStr, providerMatch);
            // BUGFIX 6: badge guard added.
            if (!quiet) increaseBadged(false, request);
            changes = true;
            if (!actionType) actionType = 'raw_rule';
            if (!matchedRuleForTrace) matchedRuleForTrace = getCoreRuleTraceName(compiled, rawRuleStr);
        }
    };

    const runFieldStep = (rule, compiled) => {
        parseURL();
        if (!hasParams()) return;
        if (!coreRuleAppliesToRequest(compiled, url, request, isHistoryUpdate)) return;
        const { getDecision } = getLinkumoriState();
        const activeRegex = compiled && compiled.regex instanceof RegExp ? compiled.regex : new RegExp("^" + rule + "$", "gi");
        const beforeFields = fields.toString(), beforeFragments = fragments.toString();

        // A provider field-style rule matches against the *key name*.
        // If a $removeparam rule already claimed this key this pass,
        // leave it alone — same guard the original had in both its
        // fields loop and its fragments loop.
        const decide = (key, values) => {
            const linkumoriDecision = getDecision(key, values);
            if (linkumoriDecision.handled && (linkumoriDecision.remove || linkumoriDecision.rewrite)) return { handled: false };
            activeRegex.lastIndex = 0;
            if (!activeRegex.test(key)) return { handled: false };
            if (compiled && compiled.replacePattern !== null) {
                return { handled: true, rewrite: true, replacePattern: compiled.replacePattern, preprocessors: compiled.preprocessors };
            }
            return { handled: true, remove: true };
        };
        // Original dedup keys: "<provider>::search::<field>::<rule>" and
        // "<provider>::fragment::<fragment>::<rule>".
        const dedupeKeyFor = (scope) => (key) => provider.getName() + "::" + scope + "::" + key + "::" + rule;

        const fieldsChanged = applyParamDecisionsToStore(fields, decide, appliedFieldRewrites, dedupeKeyFor('search'));
        const fragmentsChanged = applyParamDecisionsToStore(fragments, decide, appliedFieldRewrites, dedupeKeyFor('fragment'));
        const localChange = fieldsChanged || fragmentsChanged;

        if (localChange) {
            changes = true;
            fieldsDirty = true;
            if (!actionType) actionType = 'rule';
            if (!matchedRuleForTrace) matchedRuleForTrace = getCoreRuleTraceName(compiled, rule);
            if (storage.loggingStatus) {
                let tempURL = domain, tempBeforeURL = domain;
                if (fields.toString() !== "") tempURL += "?" + fields.toString();
                if (fragments.toString() !== "") tempURL += "#" + fragments.toString();
                if (beforeFields !== "") tempBeforeURL += "?" + beforeFields;
                if (beforeFragments !== "") tempBeforeURL += "#" + beforeFragments;
                if (!quiet) pushToLog(tempBeforeURL, tempURL, rule, providerMatch);
            }
            // BUGFIX 6: badge guard added.
            if (!quiet) increaseBadged(false, request);
        }
    };

    provider.getOrderedCleaningSteps().forEach(step => {
        if (step.type === 'raw') runRawStep(step.key, step.compiled);
        else runFieldStep(step.key, step.compiled);
    });

    parseURL();
    if (hadParams) {
        const { activeRules: activeLinkumoriRules, activeExceptions: activeLinkumoriExceptions, getDecision: getLinkumoriDecision } = getLinkumoriState();
        if (activeLinkumoriRules.length > 0 || activeLinkumoriExceptions.length > 0) {
            const beforeFields = fields.toString(), beforeFragments = fragments.toString();
            let matchedRuleForLog = null;

            const decide = (key, values) => {
                const decision = getLinkumoriDecision(key, values);
                if (!decision.remove && !decision.rewrite) return { handled: false };
                if (!matchedRuleForLog && decision.matchedRule) matchedRuleForLog = decision.matchedRule;
                return decision;
            };
            // Original dedup keys used the rule that matched *this specific
            // key* (decision.matchedRule), not a hoisted "first match seen"
            // value — keep that per-key precision rather than collapsing it
            // to whatever `matchedRuleForLog` happens to hold at call time.
            const dedupeKeyFor = (scope) => (key, decision) =>
                provider.getName() + "::removeparam-" + scope + "::" + key + "::" + (decision.matchedRule || '$removeparam');

            const fieldsChanged = applyParamDecisionsToStore(fields, decide, appliedFieldRewrites, dedupeKeyFor('search'));
            const fragmentsChanged = applyParamDecisionsToStore(fragments, decide, appliedFieldRewrites, dedupeKeyFor('fragment'));
            const localChange = fieldsChanged || fragmentsChanged;

            if (localChange) {
                changes = true;
                if (!actionType) actionType = 'removeparam';
                if (!matchedRuleForTrace) matchedRuleForTrace = matchedRuleForLog || '$removeparam';
                if (storage.loggingStatus) {
                    let tempURL = domain, tempBeforeURL = domain;
                    if (fields.toString() !== "") tempURL += "?" + fields.toString();
                    if (fragments.toString() !== "") tempURL += "#" + fragments.toString();
                    if (beforeFields !== "") tempBeforeURL += "?" + beforeFields;
                    if (beforeFragments !== "") tempBeforeURL += "#" + beforeFragments;
                    if (!quiet) pushToLog(tempBeforeURL, tempURL, matchedRuleForLog || '$removeparam', providerMatch);
                }
                // BUGFIX 6: badge guard added.
                if (!quiet) increaseBadged(false, request);
            }
        }

        url = buildURLFromParts();
    }

    return { changes, url, providerMatch, matchedRule: matchedRuleForTrace, action: actionType };
}


// ---------------------------------------------------------------------------
// start() — Provider class + clearUrl()
// ---------------------------------------------------------------------------

function start() {
    initPslSupport();
    requestContextManager.init();

    function getKeys(obj) { prvKeys = Object.keys(obj || {}); }

    function createProviders() {
        const data = storage.ClearURLsData;
        if (!data || !data.providers) return;
        providers = [];
        const pins = LinkumoriRulePins.normalizePins(storage[LinkumoriRulePins.PIN_STORAGE_KEY]);
        const pinsByProvider = LinkumoriRulePins.groupPinsByProvider(pins);
        const pinLastSeenUpdates = [];
        pendingCoreRulePinChanges = [];
        for (let p = 0; p < prvKeys.length; p++) {
            const providerData = data.providers[prvKeys[p]];
            if (providerData.getOrDefault('active', true) === false) {
                pinsByProvider.delete(prvKeys[p]);
                continue;
            }
            const providerPins = pinsByProvider.get(prvKeys[p]) || [];
            pinsByProvider.delete(prvKeys[p]);
            const pinResolution = LinkumoriRulePins.resolveProviderPins(providerData, providerPins);
            pinResolution.results.forEach(result => {
                const described = describeCoreRulePin(result.pin, result);
                if (result.status === 'orphaned') {
                    clearurlsProviderSnapshot.rulePins.orphaned.push(described);
                    return;
                }
                clearurlsProviderSnapshot.rulePins.resolved.push(described);
                if (result.status !== 'exact' && result.text !== (result.pin.lastSeenText || result.pin.fingerprintAtToggle.text)) {
                    pinLastSeenUpdates.push({ provider: result.pin.provider, generatedId: result.pin.generatedId, text: result.text });
                }
            });
            const provider = new Provider(prvKeys[p],
                providerData.getOrDefault('completeProvider', false),
                providerData.getOrDefault('forceRedirection', false),
                getClearURLsDisabledRuleIdSet());
            provider.setRuleIdLookup(LinkumoriRulePins.withPinnedRuleIds(LinkumoriRuleIds.createRuleIdLookup(providerData), pinResolution.overrides));
            provider.setRulePins(providerPins, pinResolution.overrides);
            providers.push(provider);

            const urlPattern = providerData.getOrDefault('urlPattern', '');
            const indexPattern = providerData.getOrDefault('indexPattern', []);
            const domainPatterns = providerData.getOrDefault('domainPatterns', []);

            if (Array.isArray(domainPatterns) && domainPatterns.length > 0) provider.setURLDomainPattern(domainPatterns);
            else if (domainPatterns && typeof domainPatterns === 'string') provider.setURLDomainPattern(domainPatterns);
            else if (urlPattern) {
                provider.setURLPattern(urlPattern);
                const hasIndex = Array.isArray(indexPattern) ? indexPattern.length > 0 : Boolean(indexPattern);
                if (hasIndex) provider.setIndexPattern(indexPattern);
            }

            // A provider-level "historyBypassProtection" applies to every rule under
            // this provider that doesn't set its own value inline.
            const providerHistoryBypassProtection = providerData.getOrDefault('historyBypassProtection', undefined);
            const providerDefaults = typeof providerHistoryBypassProtection === 'boolean'
                ? { historyBypassProtection: providerHistoryBypassProtection }
                : null;
            const rules = data.providers[prvKeys[p]].getOrDefault('rules', []);
            for (let r = 0; r < rules.length; r++) provider.addRule(rules[r], true, providerDefaults);
            const rawRules = data.providers[prvKeys[p]].getOrDefault('rawRules', []);
            for (let raw = 0; raw < rawRules.length; raw++) provider.addRawRule(rawRules[raw], true, providerDefaults);
            const referralMarketingRules = data.providers[prvKeys[p]].getOrDefault('referralMarketing', []);
            for (let rm = 0; rm < referralMarketingRules.length; rm++) provider.addReferralMarketing(referralMarketingRules[rm], true, providerDefaults);
            const exceptions = data.providers[prvKeys[p]].getOrDefault('exceptions', []);
            for (let e = 0; e < exceptions.length; e++) provider.addException(exceptions[e], true, providerDefaults);
            const redirections = data.providers[prvKeys[p]].getOrDefault('redirections', []);
            for (let re = 0; re < redirections.length; re++) provider.addRedirection(redirections[re], true, providerDefaults);
            const fieldRedirections = data.providers[prvKeys[p]].getOrDefault('fieldRedirections', []);
            for (let fr = 0; fr < fieldRedirections.length; fr++) provider.addFieldRedirection(fieldRedirections[fr], true, providerDefaults);
            const methods = data.providers[prvKeys[p]].getOrDefault('methods', []);
            for (let m = 0; m < methods.length; m++) provider.addMethod(methods[m]);
            const resourceTypes = data.providers[prvKeys[p]].getOrDefault('resourceTypes', []);
            for (let rt = 0; rt < resourceTypes.length; rt++) provider.addResourceType(resourceTypes[rt]);

            const lookupTokens = provider.getLookupTokens();
            if (lookupTokens.length > 0) {
                for (const token of lookupTokens) {
                    if (!providersByToken[token]) providersByToken[token] = [];
                    providersByToken[token].push(provider);
                }
                if (provider.requiresGlobalFallback()) globalProviders.push(provider);
            } else {
                globalProviders.push(provider);
            }
        }

        const providersByTokenSnapshot = {};
        Object.keys(providersByToken).forEach(token => {
            providersByTokenSnapshot[token] = providersByToken[token].map(p => p.getName());
        });
        clearurlsProviderSnapshot.providerCount = providers.length;
        clearurlsProviderSnapshot.providers = providers.map(p => p.getSnapshotMetadata());
        clearurlsProviderSnapshot.providersByToken = providersByTokenSnapshot;
        clearurlsProviderSnapshot.globalProviders = globalProviders.map(p => p.getName());
        // Pins for providers that are gone altogether.
        pinsByProvider.forEach(providerPins => {
            providerPins.forEach(pin => clearurlsProviderSnapshot.rulePins.orphaned.push(describeCoreRulePin(pin, null)));
        });
        persistCoreRulePinChanges(pinLastSeenUpdates);
        globalThis.linkumoriClearURLProviderSnapshot = clearurlsProviderSnapshot;
    }

    function initializeProviders() {
        if (!rebuildProvidersFromStorage()) return false;
        setupWebRequestListener();
        return true;
    }

    function rebuildProvidersFromStorage() {
        if (!storage.ClearURLsData || !storage.ClearURLsData.providers) {
            providers = []; providersByToken = Object.create(null); globalProviders = [];
            clearurlsProviderSnapshot = createEmptyProviderSnapshot();
            globalThis.linkumoriClearURLProviderSnapshot = clearurlsProviderSnapshot;
            prvKeys = [];
            return false;
        }
        providersByToken = Object.create(null); globalProviders = [];
        clearurlsProviderSnapshot = createEmptyProviderSnapshot();
        clearurlsProviderSnapshot.disabledRuleIds = normalizeClearURLsDisabledRuleIds(storage.clearurls_disabled_rule_ids);
        pendingCoreRuleAliasMigrations = new Map();
        getKeys(storage.ClearURLsData.providers);
        createProviders();
        migrateCoreRuleAliasActivationIds();
        return true;
    }

    function setupWebRequestListener() {
        if (clearurlsWebRequestHandler && browser.webRequest.onBeforeRequest.hasListener(clearurlsWebRequestHandler)) return;

        function hasWebRequestDecision(result) {
            return !!(result && (result.cancel === true || typeof result.redirectUrl === 'string'));
        }

        clearurlsWebRequestHandler = function (requestDetails) {
            if (requestDetails && requestDetails.tabId >= 0) {
                if (requestDetails.type === 'main_frame')
                    requestContextManager.setTabURL(requestDetails.tabId, requestDetails.url);
                else if (requestDetails.type === 'sub_frame')
                    requestContextManager.setFrameURL(requestDetails.tabId, requestDetails.frameId, requestDetails.url, requestDetails.parentFrameId);
            }
            if (isDataURL(requestDetails)) return {};
            const result = clearUrl(requestDetails);
            if (hasWebRequestDecision(result)) return result;
            if (globalThis.LinkumoriDNS && typeof globalThis.LinkumoriDNS.replayCNAMEIfNeeded === 'function')
                return globalThis.LinkumoriDNS.replayCNAMEIfNeeded(requestDetails, clearUrl);
            return result;
        };

        function isDataURL(requestDetails) { return requestDetails.url.substring(0, 4) === "data"; }

        // NOTE: `["blocking"]` requires the webRequest blocking API, which is
        // only available under Manifest V2 (or Firefox's MV3, which still
        // supports it). Chrome's Manifest V3 removed blocking webRequest in
        // favor of declarativeNetRequest, so this listener will silently fail
        // to register — or throw — if this extension is ever built for
        // Chrome MV3. Left as-is rather than guessed at, since migrating this
        // to declarativeNetRequest is a platform decision, not a bugfix.
        browser.webRequest.onBeforeRequest.addListener(
            clearurlsWebRequestHandler,
            { urls: ["<all_urls>"], types: getData("types").concat(getData("pingRequestTypes")) },
            ["blocking"]
        );
    }

    globalThis.updateProviderData = function () {
        const refreshed = rebuildProvidersFromStorage();
        if (refreshed) initializationComplete = true;
        return refreshed;
    };

    let initAttempts = 0;
    const maxInitAttempts = 50;
    function tryInitialize() {
        initAttempts++;
        if (initializeProviders()) { initializationComplete = true; return; }
        if (initAttempts < maxInitAttempts) setTimeout(tryInitialize, 200);
        else { setupWebRequestListener(); console.warn('ClearURLs initialized with limited functionality'); }
    }
    tryInitialize();
    loadOldDataFromStore();
    setBadgedStatus();

    // -----------------------------------------------------------------------
    // Provider
    // -----------------------------------------------------------------------

    function Provider(_name, _completeProvider = false, _forceRedirection = false, _disabledRuleIds = new Set()) {
        const name = _name;
        let urlPattern, urlPatternSource = '';
        let indexPatterns = [], domainPatterns = [];
        const fieldRuleMap = {}, exceptionRuleMap = {};
        const domainExceptionPatterns = [], domainRedirectionRules = [];
        const canceling = _completeProvider;
        const redirectionRuleMap = {}, rawRuleMap = {}, referralMarketingRuleMap = {};
        const rawRuleExceptions = [];
        const linkumoriRemoveParamRules = [], linkumoriRemoveParamExceptions = [];
        const referralMarketingRemoveParamRules = [], referralMarketingRemoveParamExceptions = [];
        const fieldRedirectionRules = [];
        const methods = [], resourceTypes = [];
        // Position of each rule in the provider, used to keep list order when
        // rules are sorted by `order` (see getOrderedCleaningSteps).
        let nextRuleSequence = 0;
        // Generated ids of this provider's rules (see setRuleIdLookup).
        let lookupRuleId = null;
        // Pins of this provider, and "<section>\0<text>" → pinned id for
        // rules whose text drifted from their pin (see setRulePins).
        let rulePins = [], pinnedRuleIds = new Map();

        if (_completeProvider) fieldRuleMap[".*"] = true;

        function getActivationScopeIds() {
            if (domainPatterns.length > 0)
                return [...new Set(domainPatterns.map(p => String(p || '').trim()).filter(Boolean))].map(p => `domainPattern:${p}`);
            if (urlPatternSource) return [`urlPattern:${urlPatternSource}`];
            return [name];
        }

        function activateCompiledRule(compiled, section) {
            if (!compiled) return null;
            compiled.section = section;
            compiled.sequence = nextRuleSequence++;
            const generatedId = !compiled.id;
            attachCoreRuleIdentity(name, compiled, section, getActivationScopeIds(), lookupRuleId);
            compiled.idGenerated = generatedId;
            if (generatedId && pinnedRuleIds.has(`${section}\u0000${compiled.matchPattern}`)) applyCoreRulePin(compiled);
            const disabled = filterCoreRuleActivationIds(compiled, _disabledRuleIds);
            if (generatedId) trackCoreRulePin(name, compiled, _disabledRuleIds, rulePins);
            if (disabled) {
                registerDisabledCoreRuleInSnapshot(compiled); return null;
            }
            registerCoreRuleInSnapshot(compiled);
            return compiled;
        }

        // Set before rules are added: ids depend on all of the provider's rules.
        this.setRuleIdLookup = function (lookup) { lookupRuleId = typeof lookup === 'function' ? lookup : null; };
        this.setRulePins = function (pins, overrides) {
            rulePins = Array.isArray(pins) ? pins : [];
            pinnedRuleIds = overrides instanceof Map ? overrides : new Map();
        };
        this.shouldForceRedirect = function () { return _forceRedirection; };
        this.getName = function () { return name; };
        this.getSnapshotMetadata = function () {
            return { completeProvider: canceling, domainPatterns: domainPatterns.slice(), forceRedirection: _forceRedirection,
                indexPatterns: indexPatterns.slice(), methods: methods.slice(), name, resourceTypes: resourceTypes.slice(), urlPattern: urlPatternSource };
        };

        this.getDomainLookupTokens = function () {
            const tokens = new Set();
            function cleanDomainPattern(pattern) {
                let v = String(pattern || '').trim().toLowerCase();
                if (!v) return '';
                if (v.charAt(0) === '/') return '';
                if (v.startsWith('@@')) v = v.slice(2);
                if (v.startsWith('||')) v = v.slice(2); else if (v.startsWith('|')) v = v.slice(1);
                if (v.endsWith('|')) v = v.slice(0, -1);
                if (v.startsWith('*.')) v = v.slice(2);
                if (v.startsWith('http://')) v = v.slice(7); else if (v.startsWith('https://')) v = v.slice(8);
                const stopIndexes = [v.indexOf('/'), v.indexOf('^'), v.indexOf('$'), v.indexOf('?'), v.indexOf('#')].filter(i => i !== -1);
                if (stopIndexes.length > 0) v = v.slice(0, Math.min(...stopIndexes));
                if (v.endsWith('.*')) v = v.slice(0, -2);
                return v;
            }
            function tokenFromHostnameLikePattern(h) {
                const normalized = normalizeAsciiHostname(h);
                if (!normalized) return [];
                const parsed = parseHostnameWithPsl(normalized);
                if (parsed && parsed.domain && parsed.tld) {
                    const suffix = '.' + parsed.tld;
                    const domainWithoutTld = parsed.domain.endsWith(suffix) ? parsed.domain.slice(0, -suffix.length) : parsed.domain;
                    const labels = domainWithoutTld.split('.').map(l => l.trim()).filter(Boolean);
                    if (labels.length > 0) return [labels[labels.length - 1].toLowerCase()];
                }
                const labels = normalized.split('.').map(l => l.trim())
                    .filter(l => /^[a-z0-9-]+$/i.test(l)).filter(l => l !== '*');
                if (labels.length > 1) return labels.slice(0, -1).map(l => l.toLowerCase());
                return labels.map(l => l.toLowerCase());
            }
            const sources = domainPatterns.length > 0 ? domainPatterns : indexPatterns;
            for (const pattern of sources) {
                const cleaned = cleanDomainPattern(pattern);
                if (!cleaned) continue;
                for (const token of tokenFromHostnameLikePattern(cleaned)) tokens.add(token);
            }
            return Array.from(tokens);
        };

        this.getLookupTokens = function () {
            const tokens = new Set();
            for (const t of this.getDomainLookupTokens()) if (t) tokens.add(t);
            return Array.from(tokens);
        };

        this.requiresGlobalFallback = function () {
            return domainPatterns.some(p => String(p || '').trim().charAt(0) === '/');
        };

        this.setURLPattern = function (urlPatterns) {
            urlPatternSource = urlPatterns || '';
            urlPattern = new RegExp(urlPatterns, "i");
        };

        this.setIndexPattern = function (pattern) {
            function hostnameOnly(p) {
                if (!p) return '';
                let v = String(p).trim();
                const prefix = v.startsWith('||') ? '||' : v.startsWith('|') ? '|' : '';
                const body = v.slice(prefix.length);
                const pathStart = Math.min(...[body.indexOf('/'), body.indexOf('?'), body.indexOf('#')].filter(i => i !== -1).concat([body.length]));
                if (pathStart < body.length) v = prefix + body.slice(0, pathStart);
                return v;
            }
            if (Array.isArray(pattern)) indexPatterns = pattern.map(hostnameOnly).filter(Boolean);
            else if (pattern) indexPatterns = [hostnameOnly(pattern)].filter(Boolean);
            else indexPatterns = [];
        };

        this.setURLDomainPattern = function (patterns) {
            domainPatterns = Array.isArray(patterns) ? patterns : (patterns ? [patterns] : []);
        };

        this.getAppliedPatternForUrl = function (url) {
            if (domainPatterns.length > 0) {
                for (const pattern of domainPatterns) {
                    if (matchDomainPattern(url, [pattern]))
                        return { providerName: name, patternType: 'domainPatterns', patternValue: pattern };
                }
            }
            if (urlPattern && urlPattern.test(url))
                return { providerName: name, patternType: 'urlPattern', patternValue: urlPatternSource || urlPattern.source || '' };
            return { providerName: name, patternType: null, patternValue: null };
        };

        this.isCanceling = function () { return canceling; };

        this.matchURL = function (url) {
            if (domainPatterns.length > 0) return matchDomainPattern(url, domainPatterns) && !this.matchException(url);
            if (urlPattern) return urlPattern.test(url) && !this.matchException(url);
            return false;
        };

        this.matchRequestURL = function (url, request = null) {
            if (domainPatterns.length > 0) return matchDomainPattern(url, domainPatterns) && !this.matchException(url, request);
            if (urlPattern) { urlPattern.lastIndex = 0; return urlPattern.test(url) && !this.matchException(url, request); }
            return false;
        };

        // Shared $removeparam handling for the `rules` and `referralMarketing`
        // sections. Each section keeps its own rule/exception lists so that
        // referral-marketing filters, including their @@ exceptions, are
        // switched off together by the "allow referral marketing" setting.
        // Returns false when `rule` is not a $removeparam filter.
        function addLinkumoriRemoveParamEntry(rule, isActive, defaults, section, targetRules, targetExceptions) {
            const parsedLinkumoriRule = parseLinkumoriRemoveParamRuleDefinition(rule);
            if (!parsedLinkumoriRule) return false;
            const normalizedRule = normalizeCoreRuleDefinition(rule, "i", defaults);
            if (!isActive || (normalizedRule && normalizedRule.active === false)) return true;
            if (normalizedRule) {
                const activeRule = activateCompiledRule(normalizedRule, section);
                if (!activeRule) return true;
                parsedLinkumoriRule.id = activeRule.id;
                parsedLinkumoriRule.activationIds = (activeRule.activationIds || []).slice();
                // BUGFIX 5: only apply canonical requestTypes when the rule itself
                // declared none. Previously this unconditionally clobbered inline
                // type modifiers and wiped all ~type exclusions.
                if (Array.isArray(activeRule.requestTypes) &&
                    parsedLinkumoriRule.requestTypes.length === 0 &&
                    parsedLinkumoriRule.excludeRequestTypes.length === 0) {
                    parsedLinkumoriRule.requestTypes = activeRule.requestTypes.slice();
                }
                parsedLinkumoriRule.replacePattern = activeRule.replacePattern;
                parsedLinkumoriRule.preprocessors = Array.isArray(activeRule.preprocessors) ? activeRule.preprocessors.slice() : [];
                // Only fall back to the canonical object's field when the $-modifier
                // text itself didn't specify history-bypass-protection inline.
                if (parsedLinkumoriRule.historyBypassProtection === null && typeof activeRule.historyBypassProtection === 'boolean') {
                    parsedLinkumoriRule.historyBypassProtection = activeRule.historyBypassProtection;
                }
            }
            (parsedLinkumoriRule.isException ? targetExceptions : targetRules).push(parsedLinkumoriRule);
            return true;
        }

        this.addRule = function (rule, isActive = true, defaults = null) {
            // `"referralMarketing": true` treats the rule as a referral-marketing
            // rule while it stays in `rules`; its id is still generated as a
            // `rules` entry so setting the key keeps its on/off setting.
            const isReferral = isReferralMarketingRule(rule);
            if (addLinkumoriRemoveParamEntry(rule, isActive, defaults, 'rules',
                isReferral ? referralMarketingRemoveParamRules : linkumoriRemoveParamRules,
                isReferral ? referralMarketingRemoveParamExceptions : linkumoriRemoveParamExceptions)) return;
            const compiled = compileCoreRuleDefinition(rule, "i", true, defaults);
            if (!compiled || !isActive || compiled.active === false) return;
            const activeCompiled = activateCompiledRule(compiled, 'rules');
            if (!activeCompiled) return;
            (isReferral ? referralMarketingRuleMap : fieldRuleMap)[activeCompiled.matchPattern] = activeCompiled;
        };

        this.getRulesMap = function () {
            if (!storage.referralMarketing) return Object.assign({}, fieldRuleMap, referralMarketingRuleMap);
            return fieldRuleMap;
        };

        this.addRawRule = function (rule, isActive = true, defaults = null) {
            const compiled = compileRawRuleDefinition(rule, defaults);
            if (!compiled || !isActive || compiled.active === false) return;
            const activeCompiled = activateCompiledRule(compiled, 'rawRules');
            if (!activeCompiled) return;
            if (activeCompiled.isException) rawRuleExceptions.push(activeCompiled);
            else rawRuleMap[activeCompiled.matchPattern] = activeCompiled;
        };

        // True when an "@@…$rawrule=" exception stops this raw rule on `url`.
        // An exception with a targetId stops the rule with that id or alias;
        // otherwise one whose regex is the same text as the rule's, or every
        // raw rule when its regex is empty.
        const rawRuleExceptionTargets = (exception, compiled) => {
            if (exception.targetId) {
                return compiled.id === exception.targetId ||
                    (Array.isArray(compiled.aliases) && compiled.aliases.includes(exception.targetId));
            }
            return exception.rawRegexSource === '' || exception.rawRegexSource === compiled.rawRegexSource;
        };
        this.isRawRuleExcepted = function (compiled, url, request = null) {
            if (!compiled || rawRuleExceptions.length === 0) return false;
            return rawRuleExceptions.some(exception =>
                rawRuleExceptionTargets(exception, compiled) && coreRuleAppliesToRequest(exception, url, request));
        };

        this.getRawRulesMap = function () { return rawRuleMap; };

        // rawRules, rules and referralMarketing as one list in the order they
        // run: entries with an `order` first (lowest first), then the rest in
        // their default order (rawRules before rules/referralMarketing).
        // Ties keep list order. $removeparam filters are not in this list;
        // they always run afterwards, together with their @@ exceptions.
        this.getOrderedCleaningSteps = function () {
            const steps = [];
            Object.keys(rawRuleMap).forEach(key => steps.push({ type: 'raw', key, compiled: rawRuleMap[key], stage: 0 }));
            const rulesMap = this.getRulesMap();
            Object.keys(rulesMap).forEach(key => steps.push({ type: 'field', key, compiled: rulesMap[key], stage: 1 }));
            const orderOf = step => (step.compiled && typeof step.compiled.order === 'number' ? step.compiled.order : null);
            const sequenceOf = step => (step.compiled && typeof step.compiled.sequence === 'number' ? step.compiled.sequence : 0);
            return steps
                .map((step, index) => ({ step, index }))
                .sort((a, b) => {
                    const ao = orderOf(a.step), bo = orderOf(b.step);
                    if (ao !== null || bo !== null) {
                        if (ao === null) return 1;
                        if (bo === null) return -1;
                        if (ao !== bo) return ao - bo;
                        return sequenceOf(a.step) - sequenceOf(b.step);
                    }
                    return a.index - b.index;
                })
                .map(entry => entry.step);
        };
        this.getLinkumoriRemoveParamRules = function () {
            if (!storage.referralMarketing) return linkumoriRemoveParamRules.concat(referralMarketingRemoveParamRules);
            return linkumoriRemoveParamRules.slice();
        };
        this.getLinkumoriRemoveParamExceptions = function () {
            if (!storage.referralMarketing) return linkumoriRemoveParamExceptions.concat(referralMarketingRemoveParamExceptions);
            return linkumoriRemoveParamExceptions.slice();
        };

        this.addReferralMarketing = function (rule, isActive = true, defaults = null) {
            // $removeparam filters and their @@ exceptions work here like in `rules`.
            if (addLinkumoriRemoveParamEntry(rule, isActive, defaults, 'referralMarketing',
                referralMarketingRemoveParamRules, referralMarketingRemoveParamExceptions)) return;
            const compiled = compileCoreRuleDefinition(rule, "i", true, defaults);
            if (!compiled || !isActive || compiled.active === false) return;
            const activeCompiled = activateCompiledRule(compiled, 'referralMarketing');
            if (!activeCompiled) return;
            referralMarketingRuleMap[activeCompiled.matchPattern] = activeCompiled;
        };

        // fieldRedirections take the same entries as `rules`: a parameter name,
        // a name regex, or a $removeparam filter that only selects the
        // parameter. The matching parameter's value becomes the new URL.
        this.addFieldRedirection = function (rule, isActive = true, defaults = null) {
            const parsedLinkumoriRule = parseLinkumoriRemoveParamRuleDefinition(rule);
            if (parsedLinkumoriRule) {
                // @@ makes no sense for a redirect; lint-rules and the editor
                // reject it, and it is ignored here.
                if (parsedLinkumoriRule.isException) return;
                const normalized = normalizeCoreRuleDefinition(rule, "i", defaults);
                if (!normalized || !isActive || normalized.active === false) return;
                const activeRule = activateCompiledRule(normalized, 'fieldRedirections');
                if (!activeRule) return;
                parsedLinkumoriRule.activationIds = (activeRule.activationIds || []).slice();
                if (parsedLinkumoriRule.historyBypassProtection === null && typeof activeRule.historyBypassProtection === 'boolean') {
                    parsedLinkumoriRule.historyBypassProtection = activeRule.historyBypassProtection;
                }
                fieldRedirectionRules.push({ compiled: activeRule, removeParam: parsedLinkumoriRule });
                return;
            }
            const compiled = compileCoreRuleDefinition(rule, "i", true, defaults);
            if (!compiled || !isActive || compiled.active === false) return;
            const activeCompiled = activateCompiledRule(compiled, 'fieldRedirections');
            if (!activeCompiled) return;
            fieldRedirectionRules.push({ compiled: activeCompiled, removeParam: null });
        };

        // The redirect target from the first parameter (in URL order, query
        // before fragment) that a fieldRedirections entry matches, or null.
        this.getFieldRedirection = function (url, request = null, isHistoryUpdate = false) {
            if (fieldRedirectionRules.length === 0) return null;
            const applicable = fieldRedirectionRules.filter(entry => {
                if (!coreRuleAppliesToRequest(entry.compiled, url, request, isHistoryUpdate)) return false;
                return !entry.removeParam || matchLinkumoriRemoveParamTarget(entry.removeParam, url, request, isHistoryUpdate);
            });
            if (applicable.length === 0) return null;
            let urlObject;
            try { urlObject = new URL(url); } catch (_) { return null; }
            const params = [];
            for (const [key, value] of urlObject.searchParams) params.push([key, value]);
            extractFragments(urlObject)._params.forEach((key, value) => params.push([key, value === null ? '' : value]));
            for (const [key, value] of params) {
                if (!value) continue;
                for (const entry of applicable) {
                    let matched;
                    if (entry.removeParam) {
                        matched = linkumoriRemoveParamMatchesName(entry.removeParam, key, [value]);
                    } else {
                        entry.compiled.regex.lastIndex = 0;
                        matched = entry.compiled.regex.test(key);
                    }
                    if (!matched) continue;
                    const values = applyCoreRulePreprocessors([value], entry.compiled.preprocessors);
                    const target = entry.compiled.replacePattern !== null && entry.compiled.replacePattern !== ''
                        ? applyCoreReplacePattern(entry.compiled.replacePattern, values)
                        : values[0];
                    if (target) return { url: target, rule: getCoreRuleTraceName(entry.compiled, entry.compiled.matchPattern) };
                }
            }
            return null;
        };

        this.addException = function (exception, isActive = true, defaults = null) {
            // "exceptions" takes both pattern kinds: domain patterns such as
            // "||example.com^/login" (anything starting with "|") and URL regexes.
            const normalized = normalizeCoreRuleDefinition(exception, "i", defaults);
            const pattern = normalized ? normalized.matchPattern.trim() : '';
            if (pattern.startsWith('|')) {
                if (isActive && normalized.active !== false) this.addDomainException(pattern);
                return;
            }
            const compiled = compileCoreRuleDefinition(exception, "i", false, defaults);
            if (!compiled || !isActive || compiled.active === false) return;
            const activeCompiled = activateCompiledRule(compiled, 'exceptions');
            if (!activeCompiled) return;
            exceptionRuleMap[activeCompiled.matchPattern] = activeCompiled;
        };

        this.addDomainException = function (exception) {
            if (domainExceptionPatterns.indexOf(exception) === -1) domainExceptionPatterns.push(exception);
        };

        this.addMethod = function (method) {
            const n = String(method || '').toUpperCase();
            if (n && methods.indexOf(n) === -1) methods.push(n);
        };
        this.getMethods = function () { return methods.slice(); };
        this.matchMethod = function (details) {
            if (!methods.length) return true;
            return methods.indexOf(String(details['method'] || '').toUpperCase()) > -1;
        };

        this.addResourceType = function (resourceType) {
            const n = String(resourceType || '').toLowerCase();
            if (n && resourceTypes.indexOf(n) === -1) resourceTypes.push(n);
        };
        this.getResourceTypes = function () { return resourceTypes.slice(); };
        this.matchResourceType = function (details) {
            if (!resourceTypes.length) {
                if (storage.types && storage.types.length > 0) return storage.types.indexOf(details['type']) > -1;
                return true;
            }
            return resourceTypes.indexOf(String(details['type'] || '').toLowerCase()) > -1;
        };

        this.matchException = function (url, request = null) {
            if (url === siteBlockedAlert) return true;
            let result = false;
            for (const exception in exceptionRuleMap) {
                if (result) break;
                const exceptionRule = exceptionRuleMap[exception];
                const exceptionRegex = exceptionRule && exceptionRule.regex instanceof RegExp ? exceptionRule.regex
                    : (exceptionRule instanceof RegExp ? exceptionRule : new RegExp(exception, "i"));
                if (coreRuleAppliesToRequest(exceptionRule, url, request)) {
                    exceptionRegex.lastIndex = 0;
                    result = exceptionRegex.test(url);
                }
            }
            if (!result && domainExceptionPatterns.length > 0) result = matchDomainPattern(url, domainExceptionPatterns);
            return result;
        };

        this.addRedirection = function (redirection, isActive = true, defaults = null) {
            // "redirections" takes both kinds: domain redirects such as
            // "||go.example.com^$redirect=https://example.com/" (anything starting
            // with "|") and URL regexes whose first capture group is the target.
            const normalized = normalizeCoreRuleDefinition(redirection, "i", defaults);
            const pattern = normalized ? normalized.matchPattern.trim() : '';
            if (pattern.startsWith('|')) {
                if (isActive && normalized.active !== false) this.addDomainRedirection(pattern);
                return;
            }
            const compiled = compileCoreRuleDefinition(redirection, "i", false, defaults);
            if (!compiled || !isActive || compiled.active === false) return;
            const activeCompiled = activateCompiledRule(compiled, 'redirections');
            if (!activeCompiled) return;
            redirectionRuleMap[activeCompiled.matchPattern] = activeCompiled;
        };

        this.addDomainRedirection = function (redirection) {
            const normalized = typeof redirection === 'string' ? redirection.trim() : '';
            if (normalized.includes('$redirect=') && domainRedirectionRules.indexOf(normalized) === -1) domainRedirectionRules.push(normalized);
        };

        this.getRedirection = function (url, request = null) {
            let re = null;
            for (const redirection in redirectionRuleMap) {
                const compiled = redirectionRuleMap[redirection];
                const activeRegex = compiled && compiled.regex instanceof RegExp ? compiled.regex : new RegExp(redirection, "i");
                if (!coreRuleAppliesToRequest(compiled, url, request)) continue;
                activeRegex.lastIndex = 0;
                const captured = activeRegex.exec(url);
                if (captured && captured.length > 0 && redirection) {
                    const values = applyCoreRulePreprocessors(captured.slice(1), compiled.preprocessors);
                    if (compiled.replacePattern !== null && compiled.replacePattern !== '') re = applyCoreReplacePattern(compiled.replacePattern, values);
                    else if (captured[1] !== undefined) re = values[0];
                    break;
                }
            }
            if (!re && domainRedirectionRules.length > 0) {
                for (const dr of domainRedirectionRules) {
                    if (typeof dr !== 'string' || !dr.includes('$redirect=')) continue;
                    const [pattern, redirectTarget] = dr.split('$redirect=');
                    if (matchDomainPattern(url, [pattern.trim()])) { re = redirectTarget; break; }
                }
            }
            return re;
        };
    } // end Provider

    // -----------------------------------------------------------------------
    // clearUrl()
    // -----------------------------------------------------------------------

    function clearUrl(request) {
        if (typeof isTemporarilyPaused === 'function' && isTemporarilyPaused()) return {};

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
            let result = { changes: false, url: "", redirect: false, cancel: false };

            if (storage.pingBlocking && storage.pingRequestTypes.includes(request.type)) {
                pushToLog(request.url, request.url, translate('log_ping_blocked'), {
                    logCategory: 'feature',
                    requestMethod: request && typeof request.method === 'string' ? request.method : null,
                    requestType: request && typeof request.type === 'string' ? request.type : null,
                    tabId: request && typeof request.tabId === 'number' ? request.tabId : -1
                });
                increaseBadged(false, request);
                increaseTotalCounter(1);
                return { cancel: true };
            }

            // Collect cross-provider @@removeparam exceptions from every provider
            // whose URL pattern matches the current page context.
            const contextUrls = (request.type !== 'main_frame')
                ? requestContextManager.collectContextURLs(request) : [];
            const globalLinkumoriExceptions = [];

            let contextCandidateProviders = new Set(globalProviders);
            for (const ctxUrl of contextUrls) {
                try {
                    const ctxHost = new URL(ctxUrl).hostname;
                    const ctxTokens = getHostnameLookupTokens(ctxHost);
                    const seenCtxTokens = new Set();
                    for (const token of ctxTokens) {
                        if (seenCtxTokens.has(token)) continue;
                        seenCtxTokens.add(token);
                        const tokenProviders = providersByToken[token];
                        if (tokenProviders) for (const p of tokenProviders) contextCandidateProviders.add(p);
                    }
                } catch (e) {
                    // BUGFIX 13: swallowed malformed-context-URL errors with no
                    // trace. A bad documentUrl/initiator/referrer just means this
                    // one context URL contributes no lookup tokens; log for
                    // diagnosability and continue with the rest.
                    console.warn('[linkumori] failed to parse context URL for provider lookup', { url: ctxUrl, error: String(e && e.message || e) });
                }
            }

            for (const provider of contextCandidateProviders) {
                const matchesContext = contextUrls.some(cu => { try { return provider.matchURL(cu); } catch (e) { return false; } });
                if (matchesContext) {
                    const matchedExceptions = provider.getLinkumoriRemoveParamExceptions().filter(er =>
                        linkumoriRemoveParamExceptionMatchesContext(er, contextUrls, request));
                    globalLinkumoriExceptions.push(...matchedExceptions);
                }
            }

            let requestHost = "";
            try { requestHost = new URL(request.url).hostname; } catch (e) {
                // BUGFIX 13: malformed request.url would otherwise fail silently
                // here and fall through to the empty-hostname / no-token path
                // below with no indication why. Log it — a request URL that
                // can't be parsed by `new URL()` is worth knowing about.
                console.warn('[linkumori] failed to parse request URL', { url: request && request.url, error: String(e && e.message || e) });
            }
            const requestHostTokens = getHostnameLookupTokens(requestHost);
            let requestCandidateProviders = new Set(globalProviders);
            const seenRequestTokens = new Set();
            for (const token of requestHostTokens) {
                if (seenRequestTokens.has(token)) continue;
                seenRequestTokens.add(token);
                const tokenProviders = providersByToken[token];
                if (tokenProviders) for (const p of tokenProviders) requestCandidateProviders.add(p);
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
                    if (provider.shouldForceRedirect() && request.type === 'main_frame') {
                        browser.tabs.update(request.tabId, { url: result.url }).catch(handleError);
                        return { cancel: true };
                    }
                    return { redirectUrl: result.url };
                }

                if (result.cancel) {
                    if (request.type === 'main_frame') {
                        const blockingPage = browser.runtime.getURL("html/siteBlockedAlert.html?source=" + encodeURIComponent(request.url));
                        browser.tabs.update(request.tabId, { url: blockingPage }).catch(handleError);
                        return { cancel: true };
                    }
                    return { redirectUrl: siteBlockedAlert };
                }

                if (result.changes) return { redirectUrl: result.url };
            }
        }

        return {};
    }

    globalThis.traceClearURLWebRequestTest = function (requestDetails) {
        const request = { method: 'GET', type: 'main_frame', tabId: -1, ...requestDetails };
        const result = clearUrl(request) || {};
        return {
            input: request.url,
            output: typeof result.redirectUrl === 'string' ? result.redirectUrl : request.url,
            changed: typeof result.redirectUrl === 'string' && result.redirectUrl !== request.url,
            blocked: result.cancel === true,
            raw: result
        };
    };
}
