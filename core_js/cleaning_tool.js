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
 *
 * MODIFICATIONS
 * -------------
 * - Added copy URL button and theme functionality
 * - Integrated LinkumoriI18n for internationalization
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
/*jshint esversion: 6 */
var cleanedURLs = [];
var i = 0;
var length = 0;
const {
    THEME_STORAGE_KEY,
    LAST_DARK_THEME_STORAGE_KEY,
    LIGHT_THEME_STORAGE_KEY,
    DARK_THEME_STORAGE_KEY,
    DEFAULT_THEME,
    buildThemeTogglePayload,
    isLightTheme,
    syncBootstrapTheme,
    normalizeTheme
} = globalThis.LinkumoriTheme;

function loadSavedTheme() {
    return browser.storage.local.get([THEME_STORAGE_KEY])
        .then(result => result[THEME_STORAGE_KEY] || DEFAULT_THEME)
        .catch(() => DEFAULT_THEME);
}

function getSavedThemePair() {
    return browser.storage.local.get([LAST_DARK_THEME_STORAGE_KEY, LIGHT_THEME_STORAGE_KEY, DARK_THEME_STORAGE_KEY])
        .then(result => buildThemeTogglePayload(DEFAULT_THEME, result).payload)
        .catch(() => buildThemeTogglePayload(DEFAULT_THEME, {}).payload);
}

/**
* Load only when document is ready
*/
document.addEventListener('DOMContentLoaded', function() {
    LinkumoriI18n.ready().then(() => {
        setText();
        loadSavedTheme().then(savedTheme => {
            document.documentElement.setAttribute('data-theme', normalizeTheme(savedTheme));
            updateThemeIcons(savedTheme);
        });

        document.getElementById('cleanUrlsButton').onclick = cleanURLs;
        document.getElementById('copyUrlsButton').onclick = copyUrls;
        document.getElementById('themeToggle').onclick = toggleTheme;
    });
});

/**
* This function cleans all URLs line by line in the textarea.
*/
function cleanURLs() {
    const cleanTArea = document.getElementById('outputUrls');
    const dirtyTArea = document.getElementById('inputUrls');
    const urls = dirtyTArea.value.split('\n').filter(url => url.trim() !== ''); // Filter out empty lines
    cleanedURLs = [];
    length = urls.length;

    if (length === 0) {
        cleanTArea.value = ''; // Clear output if no URLs are entered
        return;
    }

    // Reset i for each cleaning operation
    i = 0;
    urls.forEach((url, index) => {
        browser.runtime.sendMessage({
            function: "pureCleaning",
            params: [url]
        }).then((data) => {
            cleanedURLs.push(data.response);
            if (index === length - 1) { // Check if it's the last URL processed
                cleanTArea.value = cleanedURLs.join('\n');
            }
        }, handleError);
    });
}

/**
 * Copies the cleaned URLs to the clipboard.
 */
function copyUrls() {
    const outputUrls = document.getElementById('outputUrls');
    if (outputUrls.value.trim() === '') {
        showCopyStatus(translate('copy_urls_empty')); // Use translated message
        return;
    }

    navigator.clipboard.writeText(outputUrls.value).then(() => {
        showCopyStatus(translate('copy_urls_success')); // Use translated message
    }).catch(err => {
        console.error('Failed to copy URLs: ', err);
        showCopyStatus(translate('copy_urls_fail')); // Use translated message
    });
}

/**
 * Shows a temporary status message for copy operations.
 * @param {string} message The message to display.
 */
function showCopyStatus(message) {
    const copyStatus = document.getElementById('copyStatus');
    copyStatus.textContent = message;
    copyStatus.style.display = 'block';
    setTimeout(() => {
        copyStatus.style.display = 'none';
    }, 2000); // Hide after 2 seconds
}

/**
* Translate a string with LinkumoriI18n.
*
* @param {string} string Name of the attribute used for localization
*/
function translate(string)
{
    return LinkumoriI18n.getMessage(string);
}

/**
* Set the text for the UI.
*/
function setText()
{
    document.title = translate('cleanUrlsToolTitle');
    document.getElementById('headerTitle').textContent = translate('cleanUrlsToolHeader');
    document.getElementById('inputUrlsDescription').textContent = translate('inputUrlsDescription');
    document.getElementById('cleanUrlsButton').textContent = translate('cleanUrlsButton');
    document.getElementById('copyUrlsButton').textContent = translate('copyUrlsButton');
    document.getElementById('inputUrlsTitle').textContent = translate('inputUrlsTitle');
    document.getElementById('cleanedUrlsTitle').textContent = translate('cleanedUrlsTitle');
    document.getElementById('inputUrls').placeholder = translate('inputUrlsPlaceholder');
    document.getElementById('outputUrls').placeholder = translate('cleanedUrlsPlaceholder');

    const themeToggle = document.getElementById('themeToggle');
    if (themeToggle) {
        themeToggle.setAttribute('aria-label', translate('themeToggleAriaLabel'));
    }

    const sunIcon = document.getElementById('cleaningToolSunIcon');
    if (sunIcon) {
        sunIcon.setAttribute('alt', translate('sunIconAlt'));
    }

    const moonIcon = document.getElementById('cleaningToolMoonIcon');
    if (moonIcon) {
        moonIcon.setAttribute('alt', translate('moonIconAlt'));
    }
}

/**
 * Toggles the theme between 'light' and 'dark'.
 */function initializeTheme() {
    const themeToggle = document.getElementById('themeToggle');
    const cachedTheme = document.documentElement.getAttribute('data-theme') || DEFAULT_THEME;
    document.documentElement.setAttribute('data-theme', normalizeTheme(cachedTheme));
    updateThemeIcons(cachedTheme);
    loadSavedTheme().then(savedTheme => {
        document.documentElement.setAttribute('data-theme', normalizeTheme(savedTheme));
        syncBootstrapTheme(savedTheme);
        updateThemeIcons(savedTheme);
    });

    if (themeToggle) {
        themeToggle.onclick = toggleTheme;
    }
}

if (browser?.storage?.onChanged) {
    browser.storage.onChanged.addListener((changes) => {
        if (changes[THEME_STORAGE_KEY]?.newValue) {
            const newTheme = changes[THEME_STORAGE_KEY].newValue;
            document.documentElement.setAttribute('data-theme', normalizeTheme(newTheme));
            syncBootstrapTheme(newTheme);
            updateThemeIcons(newTheme);
        }
    });
}

/* ---------------------
   Minimal helper fixes
   (kept separate & minimal)
   --------------------- */

/**
 * Generic error handler used by async operations
 */
function handleError(err) {
    console.error('An error occurred:', err);
    const cleanTArea = document.getElementById('outputUrls');
    if (cleanTArea) {
        cleanTArea.value = ''; // keep behavior simple and visible
    }
}

/**
 * Minimal toggleTheme implementation used earlier in DOMContentLoaded
 */
function toggleTheme() {
    const currentTheme = normalizeTheme(document.documentElement.getAttribute('data-theme') || DEFAULT_THEME);
    getSavedThemePair().then((payloadSource) => {
        const { nextTheme: newTheme, payload } = buildThemeTogglePayload(currentTheme, payloadSource);
        document.documentElement.setAttribute('data-theme', normalizeTheme(newTheme));
        syncBootstrapTheme(newTheme);
        updateThemeIcons(newTheme);
        browser.storage.local.set(payload).catch(() => {});
    });
}

/**
 * Minimal updateThemeIcons to match existing usage (defensive)
 */
function updateThemeIcons(theme) {
    const themeIcon = document.getElementById('themeIcon');
    if (!themeIcon) return;
    themeIcon.classList.remove('icon-theme-dark', 'icon-theme-light');
    if (isLightTheme(theme)) {
        themeIcon.classList.add('icon-theme-light');
        themeIcon.setAttribute('aria-label', translate('theme_light'));
    } else {
        themeIcon.classList.add('icon-theme-dark');
        themeIcon.setAttribute('aria-label', translate('theme_dark'));
    }
}
