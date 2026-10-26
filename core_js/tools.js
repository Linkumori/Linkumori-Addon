/*
 * ============================================================
 * ClearURLs
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
 * Upstream:   https://gitlab.com/ClearURLs/ClearUrls/-/blob/m3-migration/core_js/tools.js
 *
 * MODIFICATIONS
 * -------------
 * - Added communication for options page and replaced
 *   browserAction to action API for MV3 compliance
 * - MV3 compliant patches taken from upstream (see Upstream above)
 * - Updated checkLocalURL function to use modern ES6 IP library
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
// ES6 Import for modern IP range checking (only used in checkLocalURL function)

// Needed by the sha256 method
const enc = new TextEncoder();

// Max amount of log entries to prevent performance issues
const logThreshold = 5000;
const LINKUMORI_TROUBLESHOOTER_CAPTURE_TTL_MS = 15 * 60 * 1000;
const LINKUMORI_TROUBLESHOOTER_MAX_CAPTURE_ENTRIES = 250;
const LINKUMORI_TROUBLESHOOTER_MAX_CAPTURE_FAILURES = 100;
const LINKUMORI_TROUBLESHOOTER_SESSION_KEY_PREFIX = 'linkumori_troubleshooter_capture_';
const linkumoriTroubleshooterCaptures = new Map();
const linkumoriTroubleshooterCaptureWriteQueues = new Map();
const linkumoriTroubleshooterCaptureStorageFailures = new Set();
const linkumoriTroubleshooterClosedTabsDuringSessionLoad = new Set();
let linkumoriTroubleshooterCaptureSessionLoaded = false;
const THEME_STORAGE_KEY = 'linkumori-theme';
const DEFAULT_THEME = 'dark';
const SUPPORTED_THEMES = new Set(['light', 'midnight', 'dark', 'icecold', 'sunset', 'legacy']);

function isTroubleshooterCaptureSessionLoaded() {
    return linkumoriTroubleshooterCaptureSessionLoaded;
}

function getTroubleshooterCaptureSessionKey(tabId) {
    return `${LINKUMORI_TROUBLESHOOTER_SESSION_KEY_PREFIX}${tabId}`;
}

function persistTroubleshooterCapture(tabId) {
    const id = Number(tabId);
    const sessionArea = typeof browser !== 'undefined' ? browser.storage?.session : null;
    if (!Number.isInteger(id) || !sessionArea?.set || !sessionArea?.remove) return Promise.resolve(false);

    const capture = linkumoriTroubleshooterCaptures.get(id);
    const snapshot = capture ? {
        active: capture.active !== false,
        startedAt: capture.startedAt,
        endedAt: capture.endedAt || null,
        expiresAt: capture.expiresAt,
        entries: capture.entries.slice(-LINKUMORI_TROUBLESHOOTER_MAX_CAPTURE_ENTRIES).map(entry => ({ ...entry })),
        failures: (capture.failures || []).slice(-LINKUMORI_TROUBLESHOOTER_MAX_CAPTURE_FAILURES).map(failure => ({ ...failure }))
    } : null;
    const key = getTroubleshooterCaptureSessionKey(id);
    const previousWrite = linkumoriTroubleshooterCaptureWriteQueues.get(id) || Promise.resolve();
    const write = previousWrite.catch(() => {}).then(async () => {
        if (snapshot) await sessionArea.set({ [key]: snapshot });
        else await sessionArea.remove(key);
        linkumoriTroubleshooterCaptureStorageFailures.delete(id);
        return true;
    }).catch(() => {
        if (snapshot) linkumoriTroubleshooterCaptureStorageFailures.add(id);
        return false;
    });
    let queuedWrite;
    queuedWrite = write.finally(() => {
        if (linkumoriTroubleshooterCaptureWriteQueues.get(id) === queuedWrite) {
            linkumoriTroubleshooterCaptureWriteQueues.delete(id);
        }
    });
    linkumoriTroubleshooterCaptureWriteQueues.set(id, queuedWrite);
    return queuedWrite;
}

const linkumoriTroubleshooterCaptureSessionReady = (async () => {
    const sessionArea = typeof browser !== 'undefined' ? browser.storage?.session : null;
    if (!sessionArea?.get) {
        linkumoriTroubleshooterCaptureSessionLoaded = true;
        return false;
    }

    const staleKeys = [];
    try {
        const stored = await sessionArea.get(null);
        const now = Date.now();
        const savedCaptures = Object.entries(stored || {}).flatMap(([key, value]) => {
            if (!key.startsWith(LINKUMORI_TROUBLESHOOTER_SESSION_KEY_PREFIX)) return [];
            const tabId = Number(key.slice(LINKUMORI_TROUBLESHOOTER_SESSION_KEY_PREFIX.length));
            if (!Number.isInteger(tabId) || tabId < 0 || !value || typeof value !== 'object' ||
                !Number.isFinite(value.startedAt) || !Number.isFinite(value.expiresAt) || !Array.isArray(value.entries)) {
                staleKeys.push(key);
                return [];
            }
            if (linkumoriTroubleshooterClosedTabsDuringSessionLoad.has(tabId)) {
                staleKeys.push(key);
                return [];
            }
            const capture = {
                active: value.active !== false && now <= value.expiresAt,
                startedAt: value.startedAt,
                endedAt: value.endedAt || (now > value.expiresAt ? value.expiresAt : null),
                expiresAt: value.expiresAt,
                entries: value.entries.slice(-LINKUMORI_TROUBLESHOOTER_MAX_CAPTURE_ENTRIES)
                    .filter(entry => entry && typeof entry === 'object'),
                failures: (Array.isArray(value.failures) ? value.failures : [])
                    .slice(-LINKUMORI_TROUBLESHOOTER_MAX_CAPTURE_FAILURES)
                    .filter(failure => failure && typeof failure === 'object' && typeof failure.url === 'string')
            };
            return [{ tabId, capture }];
        }).sort((left, right) => left.capture.startedAt - right.capture.startedAt);

        savedCaptures.slice(0, Math.max(0, savedCaptures.length - 8)).forEach(({ tabId }) => {
            staleKeys.push(getTroubleshooterCaptureSessionKey(tabId));
        });
        savedCaptures.slice(-8).forEach(({ tabId, capture }) => {
            linkumoriTroubleshooterCaptures.set(tabId, capture);
        });
        if (staleKeys.length > 0) await sessionArea.remove(staleKeys);
    } catch (_) {
        // Keep the troubleshooter usable in browsers that expose but cannot read session storage.
    } finally {
        linkumoriTroubleshooterCaptureSessionLoaded = true;
        linkumoriTroubleshooterClosedTabsDuringSessionLoad.clear();
    }
    return true;
})();

const THEME_ICON_PATHS = {
    light: 'img/linkumori_icon_theme_light.svg',
    midnight: 'img/linkumori_icon_theme_midnight.svg',
    icecold: 'img/linkumori_icon_theme_icecold.svg',
    dark: 'img/linkumori_icon_theme_dark.svg',
    sunset: 'img/linkumori_icon_theme_sunset.svg',
    legacy: 'img/linkumori_icon_theme_legacy.svg'
};
const DISABLED_THEME_ICON_PATHS = {
    legacy: 'img/linkumori_icon_theme_legacy_disabled.svg'
};
const DEFAULT_DISABLED_ICON_PATH = 'img/icon128_gray.png';

function normalizeTheme(theme) {
    const candidate = String(theme || '').toLowerCase();
    return SUPPORTED_THEMES.has(candidate) ? candidate : DEFAULT_THEME;
}

/*
* To support Waterfox.
*/
Array.prototype.rmEmpty = function () {
    return this.filter(v => v);
};

/*
* To support Waterfox.
*/
Array.prototype.flatten = function () {
    return this.reduce((a, b) => a.concat(b), []);
};

/**
 * Check if an object is empty.
 * @param  {Object}  obj
 * @return {Boolean}
 */
function isEmpty(obj) {
    return (Object.getOwnPropertyNames(obj).length === 0);
}

/**
 * Translate a string with the i18n API.
 *
 * @param {string} string           Name of the attribute used for localization
 * @param {string[]} placeholders   Array of placeholders
 */
function translate(string, ...placeholders) {
    return LinkumoriI18n.getMessage(string, placeholders);
}

/**
 * Reloads the extension.
 */
function reload() {
    browser.runtime.reload();
}

/**
 * Extract the host without port from an url.
 * @param  {URL} url URL as String
 * @return {String}     host as string
 */
function extractHost(url) {
    return url.hostname;
}

/**
 * Returns true if the url has a local host.
 * Updated to use modern ES6 IP library for better accuracy.
 * @param  {URL} url URL as object
 * @return {boolean}
 */
function checkLocalURL(url) {
    let host = extractHost(url);

    // Handle localhost hostname
    if (host === 'localhost') {
        return true;
    }

    // Ask IP-Ranger whether the host is a valid IP address before trying to
    // parse it. Hostnames that start with a digit (e.g. "2.rome.api.flipkart.com")
    // are not IP addresses; IP.isValid() catches that internally and returns false,
    // so we exit early without hitting the noisy "Invalid IPv4 format" error.
    if (!IP.isValid(host)) {
        return false;
    }

    try {
        // isPrivate() covers RFC 1918, carrier-grade NAT, IPv6 ULA and
        // loopback; isSpecial() covers link-local, multicast, broadcast,
        // reserved ranges (incl. 0.0.0.0/8) and the unspecified address —
        // both see through IPv4-mapped/NAT64 IPv6 embeddings.
        const address = IP.address(host);
        return address.isPrivate() || address.isSpecial();

    } catch (error) {
        // Fallback: if IP parsing fails, check hostname patterns
        console.warn('[ClearURLs] IP parsing failed for host:', host, error);
        return host === 'localhost';
    }
}

/**
 * Return the number of parameters query strings.
 * @param  {String}     url URL as String
 * @return {int}        Number of Parameters
 */
function countFields(url) {
    return [...new URL(url).searchParams].length
}

/**
 * Extract the fragments from an url.
 * @param  {URL} url URL as object
 * @return {URLHashParams}     fragments as URLSearchParams object
 */
function extractFragments(url) {
    return new URLHashParams(url)
}

/**
 * Returns the given URL without searchParams and hash.
 * @param {URL} url the URL as object
 * @return {URL} the url without searchParams and hash
 */
function urlWithoutParamsAndHash(url) {
    let newURL = url.toString();

    if (url.search) {
        newURL = newURL.replace(url.search, "");
    }

    if (url.hash) {
        newURL = newURL.replace(url.hash, "");
    }

    return new URL(newURL);
}

/**
 * Load local saved data, if the browser is offline or
 * some other network trouble.
 */
function loadOldDataFromStore() {
    localDataHash = storage.dataHash;
}

/**
 * Increase by {number} the total counter
 * @param  {int} number
 */
function increaseTotalCounter(number) {
    if (storage.statisticsStatus) {
        storage.totalCounter += number;
        deferSaveOnDisk('totalCounter');
    }
}

/**
 * Increase by one the cleaned counter
 */
function increaseCleanedCounter() {
    if (storage.statisticsStatus) {
        storage.cleanedCounter++;
        deferSaveOnDisk('cleanedCounter');
    }
}

/**
 * Change the icon.
 */
function changeIcon() {
    const activeTheme = normalizeTheme(storage[THEME_STORAGE_KEY]);
    if (storage.globalStatus) {
        const iconPath = THEME_ICON_PATHS[activeTheme] || THEME_ICON_PATHS[DEFAULT_THEME];
        browser.action.setIcon({path: iconPath}).catch(handleError);
    } else {
        const disabledIconPath = DISABLED_THEME_ICON_PATHS[activeTheme] || DEFAULT_DISABLED_ICON_PATH;
        browser.action.setIcon({path: disabledIconPath}).catch(handleError);
    }
}

browser.storage.onChanged.addListener((changes, areaName) => {
    if (areaName !== 'local' || !changes || typeof storage === 'undefined') {
        return;
    }

    let shouldRefreshIcon = false;

    if (changes.globalStatus) {
        storage.globalStatus = changes.globalStatus.newValue;
        shouldRefreshIcon = true;
    }

    if (changes[THEME_STORAGE_KEY]) {
        storage[THEME_STORAGE_KEY] = normalizeTheme(changes[THEME_STORAGE_KEY].newValue);
        shouldRefreshIcon = true;
    }

    if (shouldRefreshIcon) {
        changeIcon();
    }
});

// Fixed storage listener - properly handle property names with hyphens

/**
 * Get the badged status from the browser storage and put the value
 * into a local variable.
 *
 */
function setBadgedStatus() {
    if (storage.badgedStatus) {
        let color = storage.badged_color;
        browser.action.setBadgeBackgroundColor({
            'color': color
        }).catch(handleError);

        if (getBrowser() === "Firefox") {
            browser.action.setBadgeTextColor({
                color: "#FFFFFF"
            }).catch(handleError);
        }
    }
}

/**
 * Returns the current URL.
 * @return {String} [description]
 */
function getCurrentURL() {
    return currentURL;
}

/**
 * Check for browser.
 */
function getBrowser() {
        return "Firefox";
}

/**
 * Decodes an URL, also one that is encoded multiple times.
 *
 *
 * @param url   the url, that should be decoded
 */
function decodeURL(url) {
    let rtn = decodeUriComponent(url);

    while (isEncodedURI(rtn)) {
        rtn = decodeUriComponent(rtn);
    }

    // Required (e.g., to fix https://github.com/ClearURLs/Addon/issues/71)
    if (!rtn.startsWith('http')) {
        rtn = 'http://' + rtn
    }

    return rtn;
}

/**
 * Returns true, iff the given URI is encoded
 */
function isEncodedURI(uri) {
    return uri !== decodeUriComponent(uri || '')
}

/**
 * Gets the value of at `key` an object. If the resolved value is `undefined`, the `defaultValue` is returned in its place.
 *
 * @param {string} key the key of the object
 * @param {object} defaultValue the default value
 */
Object.defineProperty(Object.prototype, "getOrDefault", {
    configurable: true,
    enumerable: false,
    writable: true,
    value: function (key, defaultValue) {
        return this[key] === undefined ? defaultValue : this[key];
    }
});

function handleError(error) {
    console.error("[ClearURLs ERROR]:" + error);
}

/**
 * Function to log all activities from ClearUrls.
 * Only logging when activated.
 *
 * @param beforeProcessing  the url before the clear process
 * @param afterProcessing   the url after the clear process
 * @param rule              the rule that triggered the process
 * @param providerMatch     provider match metadata (providerName, patternType, patternValue)
 */

// Connected logger UI ports for real-time streaming.
const loggerPorts = new Set();

browser.runtime.onConnect.addListener(port => {
    if (port.name !== 'linkumori-logger') return;
    loggerPorts.add(port);
    port.onDisconnect.addListener(() => loggerPorts.delete(port));
});

function broadcastLogEntry(entry) {
    for (const port of loggerPorts) {
        try {
            port.postMessage({ type: 'entry', data: entry });
        } catch (_) {
            loggerPorts.delete(port);
        }
    }
}

function pushToLog(beforeProcessing, afterProcessing, rule, providerMatch = null) {
    const limit = Math.max(0, storage.logLimit);
    const safeProviderMatch = providerMatch && typeof providerMatch === 'object' ? providerMatch : {};
    const tabId = typeof safeProviderMatch.tabId === 'number' ? safeProviderMatch.tabId : -1;
    const capture = tabId >= 0 ? linkumoriTroubleshooterCaptures.get(tabId) : null;
    const captureActive = !!(capture && capture.active !== false && Date.now() <= capture.expiresAt);
    const loggingActive = !!(storage.loggingStatus && limit !== 0 && !isNaN(limit));

    if (!loggingActive && !captureActive) return;

    const entry = {
            "before": beforeProcessing,
            "after": afterProcessing,
            "rule": rule,
            "providerName": typeof safeProviderMatch.providerName === 'string' ? safeProviderMatch.providerName : null,
            "patternType": typeof safeProviderMatch.patternType === 'string' ? safeProviderMatch.patternType : null,
            "patternValue": typeof safeProviderMatch.patternValue === 'string' ? safeProviderMatch.patternValue : null,
            "logCategory": typeof safeProviderMatch.logCategory === 'string' ? safeProviderMatch.logCategory : null,
            "requestMethod": typeof safeProviderMatch.requestMethod === 'string' ? safeProviderMatch.requestMethod : null,
            "method": typeof safeProviderMatch.requestMethod === 'string' ? safeProviderMatch.requestMethod : null,
            "providerMethods": Array.isArray(safeProviderMatch.providerMethods)
                ? safeProviderMatch.providerMethods.filter((m) => typeof m === 'string')
                : null,
            "requestType": typeof safeProviderMatch.requestType === 'string' ? safeProviderMatch.requestType : null,
            "resourceType": typeof safeProviderMatch.requestType === 'string' ? safeProviderMatch.requestType : null,
            "providerResourceTypes": Array.isArray(safeProviderMatch.providerResourceTypes)
                ? safeProviderMatch.providerResourceTypes.filter((t) => typeof t === 'string')
                : null,
            "aliasURL": typeof safeProviderMatch.aliasURL === 'string' ? safeProviderMatch.aliasURL : null,
            "cname": typeof safeProviderMatch.cname === 'string' ? safeProviderMatch.cname : null,
            "resourceURL": typeof safeProviderMatch.resourceURL === 'string' ? safeProviderMatch.resourceURL : beforeProcessing,
            "tabId": tabId,
            "frameId": typeof safeProviderMatch.frameId === 'number' ? safeProviderMatch.frameId : null,
            "matchedRuleId": typeof safeProviderMatch.matchedRuleId === 'string' ? safeProviderMatch.matchedRuleId : null,
            "matchedRuleDisableId": typeof safeProviderMatch.matchedRuleDisableId === 'string' ? safeProviderMatch.matchedRuleDisableId : null,
            "matchedRuleSection": typeof safeProviderMatch.matchedRuleSection === 'string' ? safeProviderMatch.matchedRuleSection : null,
            "timestamp": Date.now()
        };

    if (loggingActive) {
        while (storage.log.log.length >= limit || storage.log.log.length >= logThreshold) {
            storage.log.log.shift();
        }
        storage.log.log.push(entry);
        deferSaveOnDisk('log');
        broadcastLogEntry(entry);
    }

    if (captureActive) {
        capture.entries.push(entry);
        if (capture.entries.length > LINKUMORI_TROUBLESHOOTER_MAX_CAPTURE_ENTRIES) {
            capture.entries.splice(0, capture.entries.length - LINKUMORI_TROUBLESHOOTER_MAX_CAPTURE_ENTRIES);
        }
        persistTroubleshooterCapture(tabId);
    }
}

async function startTabTroubleshooterCapture(tabId) {
    await linkumoriTroubleshooterCaptureSessionReady;
    const id = Number(tabId);
    if (!Number.isInteger(id) || id < 0) return { success: false, error: 'Invalid tab' };
    const now = Date.now();
    linkumoriTroubleshooterCaptures.delete(id);
    linkumoriTroubleshooterCaptures.set(id, {
        active: true,
        startedAt: now,
        expiresAt: now + LINKUMORI_TROUBLESHOOTER_CAPTURE_TTL_MS,
        entries: [],
        failures: []
    });
    const evictedTabIds = [];
    while (linkumoriTroubleshooterCaptures.size > 8) {
        const oldestTabId = linkumoriTroubleshooterCaptures.keys().next().value;
        linkumoriTroubleshooterCaptures.delete(oldestTabId);
        evictedTabIds.push(oldestTabId);
    }
    await Promise.all(evictedTabIds.map(persistTroubleshooterCapture));
    const saved = await persistTroubleshooterCapture(id);
    if (!saved) {
        linkumoriTroubleshooterCaptures.delete(id);
        await persistTroubleshooterCapture(id);
        return { success: false, error: 'Could not save the recording in session storage' };
    }
    return {
        success: true,
        storedInSession: true,
        startedAt: now,
        expiresAt: now + LINKUMORI_TROUBLESHOOTER_CAPTURE_TTL_MS
    };
}

async function stopTabTroubleshooterCapture(tabId) {
    await linkumoriTroubleshooterCaptureSessionReady;
    const id = Number(tabId);
    const capture = Number.isInteger(id) ? linkumoriTroubleshooterCaptures.get(id) : null;
    if (!capture || capture.active === false) return { success: false, error: 'No active recording for this tab' };
    capture.active = false;
    capture.endedAt = Date.now();
    const saved = await persistTroubleshooterCapture(id);
    return { success: true, storedInSession: saved, endedAt: capture.endedAt, entries: capture.entries.length };
}

async function getTabTroubleshooterCapture(tabId) {
    await linkumoriTroubleshooterCaptureSessionReady;
    const id = Number(tabId);
    const capture = Number.isInteger(id) ? linkumoriTroubleshooterCaptures.get(id) : null;
    if (!capture) return { active: false, startedAt: null, entries: [] };
    if (Date.now() > capture.expiresAt) {
        capture.active = false;
        capture.endedAt = capture.endedAt || capture.expiresAt;
    }
    const storedInSession = await persistTroubleshooterCapture(id);
    return {
        active: capture.active !== false,
        startedAt: capture.startedAt,
        endedAt: capture.endedAt || null,
        expiresAt: capture.expiresAt,
        storedInSession: storedInSession && !linkumoriTroubleshooterCaptureStorageFailures.has(id),
        entries: capture.entries.slice(),
        failures: (capture.failures || []).slice()
    };
}

// Requests the browser cancels on purpose (navigation away, a redirect the
// extension made) are not failures of the page.
const LINKUMORI_TROUBLESHOOTER_IGNORED_ERRORS = new Set([
    'NS_BINDING_ABORTED', 'NS_BINDING_REDIRECTED', 'NS_ERROR_ABORT', 'net::ERR_ABORTED', 'net::ERR_BLOCKED_BY_CLIENT'
]);

// Record a request of a recorded tab that failed: a network error, or an
// HTTP status of 400 or more.
function recordTroubleshooterFailure(details, kind) {
    if (!details || !isTabTroubleshooterCaptureActive(details.tabId)) return;
    const capture = linkumoriTroubleshooterCaptures.get(Number(details.tabId));
    if (!capture) return;
    let reason = '';
    if (kind === 'error') {
        const error = String(details.error || '');
        if (!error || LINKUMORI_TROUBLESHOOTER_IGNORED_ERRORS.has(error)) return;
        reason = error;
    } else {
        const statusCode = Number(details.statusCode);
        if (!Number.isFinite(statusCode) || statusCode < 400) return;
        reason = `HTTP ${statusCode}`;
    }
    if (!Array.isArray(capture.failures)) capture.failures = [];
    capture.failures.push({
        url: String(details.url || ''),
        reason,
        requestType: typeof details.type === 'string' ? details.type : '',
        timestamp: Date.now()
    });
    if (capture.failures.length > LINKUMORI_TROUBLESHOOTER_MAX_CAPTURE_FAILURES) {
        capture.failures.splice(0, capture.failures.length - LINKUMORI_TROUBLESHOOTER_MAX_CAPTURE_FAILURES);
    }
    persistTroubleshooterCapture(details.tabId);
}

if (typeof browser !== 'undefined' && browser.webRequest?.onErrorOccurred?.addListener) {
    browser.webRequest.onErrorOccurred.addListener(
        details => recordTroubleshooterFailure(details, 'error'),
        { urls: ['<all_urls>'] }
    );
}
if (typeof browser !== 'undefined' && browser.webRequest?.onCompleted?.addListener) {
    browser.webRequest.onCompleted.addListener(
        details => recordTroubleshooterFailure(details, 'http'),
        { urls: ['<all_urls>'] }
    );
}

if (typeof browser !== 'undefined' && browser.tabs?.onRemoved?.addListener) {
    browser.tabs.onRemoved.addListener((tabId) => {
        if (!linkumoriTroubleshooterCaptureSessionLoaded) {
            linkumoriTroubleshooterClosedTabsDuringSessionLoad.add(tabId);
        }
        linkumoriTroubleshooterCaptures.delete(tabId);
        persistTroubleshooterCapture(tabId);
    });
}

function isTabTroubleshooterCaptureActive(tabId) {
    const id = Number(tabId);
    const capture = Number.isInteger(id) ? linkumoriTroubleshooterCaptures.get(id) : null;
    return !!(capture && capture.active !== false && Date.now() <= capture.expiresAt);
}
/**
 * Checks if the storage is available.
 */
function isStorageAvailable() {
    return storage.ClearURLsData.length !== 0;
}

/**
 * This method calculates the SHA-256 hash as HEX string of the given message.
 * This method uses the native hashing implementations of the SubtleCrypto interface which is supported by all browsers
 * that implement the Web Cryptography API specification and is based on:
 * https://developer.mozilla.org/en-US/docs/Web/API/SubtleCrypto/digest
 *
 * @param message message for which the hash should be calculated
 * @returns {Promise<string>} SHA-256 of the given message
 */
async function sha256(message) {
    const msgUint8 = enc.encode(message);
    const hashBuffer = await crypto.subtle.digest('SHA-256', msgUint8);
    const hashArray = Array.from(new Uint8Array(hashBuffer));

    return hashArray.map(b => b.toString(16).padStart(2, '0')).join('');
}

/**
 * Generates a non-secure random ASCII string of length {@code len}.
 * 
 * @returns non-secure random ASCII
 */
function randomASCII(len) {
    return [...Array(len)].map(() => (~~(Math.random() * 36)).toString(36)).join('');
}

/**
 * Returns an URLSearchParams as string.
 * Does handle spaces correctly.
 */
function urlSearchParamsToString(searchParams) {
    const rtn = []

    searchParams.forEach((value, key) => {
        if (value) {
            rtn.push(key + '=' + encodeURIComponent(value))
        } else {
            rtn.push(key)
        }
    })

    return rtn.join('&')
}

function opensettings(){
     browser.runtime.openOptionsPage();
}

const keepAlive = () => setInterval(browser.runtime.getPlatformInfo, 20e3);
browser.runtime.onStartup.addListener(keepAlive);
keepAlive();

browser.windows.onFocusChanged.addListener((windowId) => {
    if (windowId !== browser.windows.WINDOW_ID_NONE) {
    }
});

browser.alarms.onAlarm.addListener((alarm) => {
    if (alarm.name === 'firstInstallAlarm') {
    }
});
