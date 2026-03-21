/*
 * ============================================================
 * Linkumori — theme_favicon.js
 * ============================================================
 * Copyright (c) 2025 Subham Mahesh
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
 * DESCRIPTION
 * -----------
 * Keeps page favicon aligned with the active Linkumori theme.
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
(() => {
    const DEFAULT_THEME = 'dark';
    const THEME_STORAGE_KEY = 'linkumori-theme';
    const THEME_ICON_MAP = {
        light: '/img/linkumori_icon_theme_light.svg',
        midnight: '/img/linkumori_icon_theme_midnight.svg',
        dark: '/img/linkumori_icon_theme_dark.svg',
        icecold: '/img/linkumori_icon_theme_icecold.svg',
        sunset: '/img/linkumori_icon_theme_sunset.svg',
        legacy: '/img/linkumori_icon_theme_legacy.svg'
    };
    const SUPPORTED_THEMES = new Set(Object.keys(THEME_ICON_MAP));

    const normalizeTheme = (theme) => {
        try {
            if (globalThis.LinkumoriTheme && typeof globalThis.LinkumoriTheme.normalizeTheme === 'function') {
                return globalThis.LinkumoriTheme.normalizeTheme(theme);
            }
        } catch (_) {}

        const candidate = String(theme || '').toLowerCase();
        return SUPPORTED_THEMES.has(candidate) ? candidate : DEFAULT_THEME;
    };

    const getActiveTheme = () => {
        const attrTheme = document.documentElement.getAttribute('data-theme');
        if (attrTheme) return normalizeTheme(attrTheme);
        try {
            return normalizeTheme(localStorage.getItem(THEME_STORAGE_KEY));
        } catch (_) {
            return DEFAULT_THEME;
        }
    };

    const ensureIconLink = () => {
        let icon = document.querySelector('link[rel="icon"]');
        if (!icon) {
            icon = document.createElement('link');
            icon.setAttribute('rel', 'icon');
            icon.setAttribute('sizes', 'any');
            icon.setAttribute('type', 'image/svg+xml');
            document.head.appendChild(icon);
        }
        return icon;
    };

    const applyThemeFavicon = () => {
        const theme = getActiveTheme();
        const href = THEME_ICON_MAP[theme] || THEME_ICON_MAP[DEFAULT_THEME];
        const icon = ensureIconLink();
        if (icon.getAttribute('href') !== href) {
            icon.setAttribute('href', href);
        }
    };

    const watchThemeAttribute = () => {
        const observer = new MutationObserver((mutations) => {
            for (const mutation of mutations) {
                if (mutation.type === 'attributes' && mutation.attributeName === 'data-theme') {
                    applyThemeFavicon();
                    break;
                }
            }
        });
        observer.observe(document.documentElement, { attributes: true });
    };

    const watchThemeStorage = () => {
        try {
            if (typeof browser !== 'undefined' && browser.storage && browser.storage.onChanged) {
                browser.storage.onChanged.addListener((changes, area) => {
                    if (area === 'local' && changes[THEME_STORAGE_KEY]) {
                        applyThemeFavicon();
                    }
                });
            }
        } catch (_) {}
    };

    applyThemeFavicon();
    watchThemeAttribute();
    watchThemeStorage();
})();
