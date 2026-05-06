/*
 * ============================================================
 * Linkumori — theme_bootstrap.js
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
 * Provides early theme bootstrapping so HTML pages can apply the
 * saved theme before the rest of the UI scripts finish loading.
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
    const THEME_STORAGE_KEY = 'linkumori-theme';
    const LAST_DARK_THEME_STORAGE_KEY = 'linkumori-last-dark-theme';
    const LIGHT_THEME_STORAGE_KEY = 'linkumori-light-mode-theme';
    const DARK_THEME_STORAGE_KEY = 'linkumori-dark-mode-theme';
    const DEFAULT_THEME = 'dark';
    const SUPPORTED_THEMES = new Set(['light', 'midnight', 'dark', 'icecold', 'sunset', 'legacy']);
    const LIGHT_THEME_OPTIONS = new Set(['light', 'icecold', 'sunset']);
    const normalizeTheme = (theme) => {
        const candidate = String(theme || '').toLowerCase();
        return SUPPORTED_THEMES.has(candidate) ? candidate : DEFAULT_THEME;
    };
    const readBootstrapTheme = () => {
        try {
            return normalizeTheme(localStorage.getItem(THEME_STORAGE_KEY));
        } catch (_) {
            return DEFAULT_THEME;
        }
    };
    const syncBootstrapTheme = (theme) => {
        const normalizedTheme = normalizeTheme(theme);
        try {
            localStorage.setItem(THEME_STORAGE_KEY, normalizedTheme);
        } catch (_) {}
        try {
            document.documentElement.setAttribute('data-theme', normalizedTheme);
        } catch (_) {}
    };
    const isLightTheme = (theme) => LIGHT_THEME_OPTIONS.has(normalizeTheme(theme));
    const sanitizeThemePreferences = (source = {}) => {
        const preferredLightCandidate = normalizeTheme(source[LIGHT_THEME_STORAGE_KEY] || 'light');
        const preferredDarkCandidate = normalizeTheme(source[DARK_THEME_STORAGE_KEY] || source[LAST_DARK_THEME_STORAGE_KEY] || DEFAULT_THEME);
        const preferredLight = isLightTheme(preferredLightCandidate) ? preferredLightCandidate : 'light';
        const preferredDark = isLightTheme(preferredDarkCandidate) ? DEFAULT_THEME : preferredDarkCandidate;
        return { preferredLight, preferredDark };
    };
    const buildThemeTogglePayload = (currentTheme, source = {}) => {
        const normalizedCurrentTheme = normalizeTheme(currentTheme || DEFAULT_THEME);
        const { preferredLight, preferredDark } = sanitizeThemePreferences(source);
        const nextTheme = isLightTheme(normalizedCurrentTheme) ? preferredDark : preferredLight;
        return {
            nextTheme,
            payload: {
                [THEME_STORAGE_KEY]: nextTheme,
                [LIGHT_THEME_STORAGE_KEY]: preferredLight,
                [DARK_THEME_STORAGE_KEY]: preferredDark,
                [LAST_DARK_THEME_STORAGE_KEY]: preferredDark
            }
        };
    };

    globalThis.LinkumoriTheme = {
        THEME_STORAGE_KEY,
        LAST_DARK_THEME_STORAGE_KEY,
        LIGHT_THEME_STORAGE_KEY,
        DARK_THEME_STORAGE_KEY,
        DEFAULT_THEME,
        normalizeTheme,
        isLightTheme,
        sanitizeThemePreferences,
        buildThemeTogglePayload,
        readBootstrapTheme,
        syncBootstrapTheme
    };

    try {
        if (!document.documentElement.hasAttribute('data-theme')) {
            document.documentElement.setAttribute('data-theme', readBootstrapTheme());
        }
    } catch (_) {
        if (!document.documentElement.hasAttribute('data-theme')) {
            document.documentElement.setAttribute('data-theme', DEFAULT_THEME);
        }
    }
})();
