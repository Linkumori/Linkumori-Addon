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
const THEME_STORAGE_KEY = 'linkumori-theme';
const DEFAULT_THEME = 'dark';
const SUPPORTED_THEMES = new Set(['light', 'midnight', 'dark', 'icecold', 'sunset', 'legacy']);

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

    // If hostname is not an IP address and not localhost, it's not local
    if (!host.match(/^\d/) && host !== 'localhost') {
        return false;
    }

    try {
        // Use modern IP library for comprehensive local network detection
        const address = IP.address(host);
        
        // Check against all local/private network ranges
        return address.belongsTo([
            "10.0.0.0/8",        // Class A private
            "172.16.0.0/12",     // Class B private
            "192.168.0.0/16",    // Class C private
            "100.64.0.0/10",     // Carrier-grade NAT
            "169.254.0.0/16",    // Link-local
            "127.0.0.0/8"        // Loopback (entire range)
        ]) || address.isLoopback() || address.isLinkLocal();
        
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
Object.prototype.getOrDefault = function (key, defaultValue) {
    return this[key] === undefined ? defaultValue : this[key];
};

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
    if (storage.loggingStatus && limit !== 0 && !isNaN(limit)) {
        while (storage.log.log.length >= limit
        || storage.log.log.length >= logThreshold) {
            storage.log.log.shift();
        }

        const safeProviderMatch = providerMatch && typeof providerMatch === 'object' ? providerMatch : {};

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
            "tabId": typeof safeProviderMatch.tabId === 'number' ? safeProviderMatch.tabId : -1,
            "timestamp": Date.now()
        };

        storage.log.log.push(entry);
        deferSaveOnDisk('log');
        broadcastLogEntry(entry);
    }
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
