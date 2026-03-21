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
 * - Added theme support
 * - Fixed syntax errors and improved code structure
 * - Added proper initialization flow
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

/**
 * Translate a string with the i18n API.
 * @param {string} string Name of the attribute used for localization
 * @returns {string} Translated string
 */
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

function translate(string) {
    try {
        return LinkumoriI18n.getMessage(string) || string;
    } catch (error) {
        console.warn('Translation failed for:', string);
        return string;
    }
}

function setHTMLContent(element, html) {
    if (!element) return;
    const parser = new DOMParser();
    const doc = parser.parseFromString(`<!doctype html><body>${html || ''}</body>`, 'text/html');
    element.replaceChildren(...Array.from(doc.body.childNodes));
}

/**
 * Set translated text content for page elements
 */
function setText() {
    try {
        document.title = translate('blocked_html_title');
        
        const titleElement = document.getElementById('title');
        if (titleElement) {
            setHTMLContent(titleElement, translate('blocked_html_title'));
        }
        
        const bodyElement = document.getElementById('body');
        if (bodyElement) {
            setHTMLContent(bodyElement, translate('blocked_html_body'));
        }
        
        const pageElement = document.getElementById('page');
        if (pageElement) {
            pageElement.textContent = translate('blocked_html_button');
        }

        const footerPrefix = document.getElementById('siteBlockedFooterPrefix');
        if (footerPrefix) {
            const prefixText = translate('siteblocked_footer_prefix');
            footerPrefix.textContent = (prefixText && prefixText !== 'siteblocked_footer_prefix')
                ? prefixText
                : 'Linkumori v.';
        }
    } catch (error) {
        console.error('Error setting text:', error);
    }
}

/**
 * Initialize theme system
 */
function initializeTheme() {
    try {
        const cachedTheme = document.documentElement.getAttribute('data-theme') || DEFAULT_THEME;
        document.documentElement.setAttribute('data-theme', normalizeTheme(cachedTheme));
        updateThemeIcons(cachedTheme);
        if (typeof browser !== 'undefined' && browser.storage && browser.storage.local) {
            browser.storage.local.get([THEME_STORAGE_KEY]).then(result => {
                const savedTheme = result[THEME_STORAGE_KEY] || DEFAULT_THEME;
                document.documentElement.setAttribute('data-theme', normalizeTheme(savedTheme));
                syncBootstrapTheme(savedTheme);
                updateThemeIcons(savedTheme);
            }).catch(error => {
                console.warn('Failed to load theme from browser storage:', error);
                document.documentElement.setAttribute('data-theme', normalizeTheme(DEFAULT_THEME));
                syncBootstrapTheme(DEFAULT_THEME);
                updateThemeIcons(DEFAULT_THEME);
            });
            return;
        }

        document.documentElement.setAttribute('data-theme', normalizeTheme(DEFAULT_THEME));
        syncBootstrapTheme(DEFAULT_THEME);
        updateThemeIcons(DEFAULT_THEME);
    } catch (error) {
        console.error('Error initializing theme:', error);
        // Fallback to dark theme
        document.documentElement.setAttribute('data-theme', normalizeTheme(DEFAULT_THEME));
    }
}

/**
 * Toggle between light and dark themes
 */
function toggleTheme() {
    try {
        const currentTheme = normalizeTheme(document.documentElement.getAttribute('data-theme') || DEFAULT_THEME);
        const applyAndSaveTheme = async () => {
            const result = await browser.storage.local.get([
                LAST_DARK_THEME_STORAGE_KEY,
                LIGHT_THEME_STORAGE_KEY,
                DARK_THEME_STORAGE_KEY
            ]);
            const { nextTheme: newTheme, payload } = buildThemeTogglePayload(currentTheme, result);
            document.documentElement.setAttribute('data-theme', normalizeTheme(newTheme));
            syncBootstrapTheme(newTheme);
            updateThemeIcons(newTheme);
            await browser.storage.local.set(payload);
        };

        if (typeof browser !== 'undefined' && browser.storage && browser.storage.local) {
            applyAndSaveTheme().catch(error => {
                console.warn('Failed to save theme to browser storage:', error);
            });
        }
    } catch (error) {
        console.error('Error toggling theme:', error);
    }
}

/**
 * Update theme icons based on current theme
 * @param {string} theme - Current theme name
 */
function updateThemeIcons(theme) {
    try {
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
    } catch (error) {
        console.error('Error updating theme icons:', error);
    }
}

/**
 * Generic error handler for async operations
 * @param {Error} err - Error object
 */
function handleError(err) {
    console.error('An error occurred:', err);
    
    // Clear any output areas on error
    const cleanTArea = document.getElementById('outputUrls');
    if (cleanTArea) {
        cleanTArea.value = '';
    }
}

/**
 * Set up the page URL from query parameters
 */
function setupPageURL() {
    try {
        const source = new URLSearchParams(window.location.search).get("source");
        const pageElement = document.getElementById('page');
        
        if (source && pageElement) {
            pageElement.href = decodeURIComponent(source);
        }
    } catch (error) {
        console.error('Error setting up page URL:', error);
    }
}

/**
 * Initialize the page
 */
function initializePage() {
    // Initialize theme first
    initializeTheme();
    
    // Wait for LinkumoriI18n to be ready, then set text and URL
    LinkumoriI18n.ready().then(() => {
        setText();
        setupPageURL();
    }).catch(error => {
        console.error('Error initializing i18n:', error);
        // Fallback - try to set URL anyway
        setupPageURL();
    });
}

// Initialize when DOM is ready
if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', initializePage);
} else {
    initializePage();
}

// Listen for browser storage changes
if (typeof browser !== 'undefined' && browser.storage && browser.storage.onChanged) {
    browser.storage.onChanged.addListener((changes) => {
        if (changes[THEME_STORAGE_KEY]?.newValue) {
            const newTheme = changes[THEME_STORAGE_KEY].newValue;
            document.documentElement.setAttribute('data-theme', normalizeTheme(newTheme));
            syncBootstrapTheme(newTheme);
            updateThemeIcons(newTheme);
        }
    });
}
