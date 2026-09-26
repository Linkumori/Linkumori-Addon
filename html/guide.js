
/*
 * ============================================================
 * Linkumori — rules guide page
 * ============================================================
 * Copyright (c) 2026 Subham Mahesh
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
 * Added rules guide page.
 *
 * ============================================================
 * MODIFICATION HISTORY
 * ============================================================
 * 2026-05-29   Subham Mahesh   File created
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
 --*/
(function() {
    'use strict';

    const {
        THEME_STORAGE_KEY,
        LAST_DARK_THEME_STORAGE_KEY,
        LIGHT_THEME_STORAGE_KEY,
        DARK_THEME_STORAGE_KEY,
        DEFAULT_THEME,
        normalizeTheme,
        buildThemeTogglePayload,
        readBootstrapTheme,
        syncBootstrapTheme
    } = globalThis.LinkumoriTheme;

    const hasStorage = typeof browser !== 'undefined' && browser.storage && browser.storage.local;

    function translateGuide(key) {
        if (!key) return '';
        if (
            window.LinkumoriI18n &&
            typeof window.LinkumoriI18n.getMessage === 'function' &&
            (!window.LinkumoriI18n.isReady || window.LinkumoriI18n.isReady())
        ) {
            const translated = window.LinkumoriI18n.getMessage(key);
            if (translated && translated !== key) return translated;
        }
        return '';
    }

    function applyGuideI18n() {
        const apply = (attribute, set) => {
            document.querySelectorAll(`[${attribute}]`).forEach((element) => {
                const translated = translateGuide(element.getAttribute(attribute));
                if (translated) set(element, translated);
            });
        };
        apply('data-i18n', (element, text) => { element.textContent = text; });
        apply('data-i18n-html', (element, html) => { element.innerHTML = html; });
        apply('data-i18n-placeholder', (element, text) => { element.placeholder = text; });
        apply('data-i18n-aria', (element, text) => { element.setAttribute('aria-label', text); });
        apply('data-i18n-title', (element, text) => { element.title = text; });
        filterToc();
    }

    // Theme: the same stored theme and light/dark toggle as the other pages.
    function applyTheme(theme) {
        const normalized = normalizeTheme(theme);
        document.documentElement.setAttribute('data-theme', normalized);
        syncBootstrapTheme(normalized);
    }

    function initializeTheme() {
        applyTheme(readBootstrapTheme() || document.documentElement.getAttribute('data-theme') || DEFAULT_THEME);
        if (hasStorage) {
            browser.storage.local.get([THEME_STORAGE_KEY]).then((result) => {
                if (result[THEME_STORAGE_KEY]) applyTheme(result[THEME_STORAGE_KEY]);
            }).catch(() => {});
            browser.storage.onChanged.addListener((changes, areaName) => {
                if (areaName === 'local' && changes[THEME_STORAGE_KEY] && changes[THEME_STORAGE_KEY].newValue) {
                    applyTheme(changes[THEME_STORAGE_KEY].newValue);
                }
            });
        }
        requestAnimationFrame(() => document.documentElement.classList.remove('theme-preload'));

        const toggle = document.getElementById('theme-toggle');
        if (!toggle) return;
        toggle.addEventListener('click', async () => {
            const current = normalizeTheme(document.documentElement.getAttribute('data-theme') || DEFAULT_THEME);
            let preferences = {};
            if (hasStorage) {
                try {
                    preferences = await browser.storage.local.get([
                        LAST_DARK_THEME_STORAGE_KEY,
                        LIGHT_THEME_STORAGE_KEY,
                        DARK_THEME_STORAGE_KEY
                    ]);
                } catch (_) {}
            }
            const { nextTheme, payload } = buildThemeTogglePayload(current, preferences);
            applyTheme(nextTheme);
            if (hasStorage) {
                try {
                    await browser.storage.local.set(payload);
                } catch (_) {}
            }
        });
    }

    // Contents: filter by text and mark the section being read.
    function filterToc() {
        const input = document.getElementById('toc-search');
        const toc = document.getElementById('guide-toc');
        if (!input || !toc) return;
        const query = input.value.trim().toLocaleLowerCase();
        let visibleCount = 0;
        toc.querySelectorAll(':scope > ul > li').forEach((item) => {
            const topMatches = item.querySelector(':scope > a').textContent.toLocaleLowerCase().includes(query);
            let childMatches = false;
            item.querySelectorAll('li').forEach((child) => {
                const matches = topMatches || child.textContent.toLocaleLowerCase().includes(query);
                child.hidden = !matches;
                childMatches = childMatches || matches;
            });
            item.hidden = !(topMatches || childMatches);
            if (!item.hidden) visibleCount++;
        });
        const empty = document.getElementById('toc-empty');
        if (empty) empty.hidden = visibleCount > 0;
    }

    function initializeToc() {
        const input = document.getElementById('toc-search');
        if (input) input.addEventListener('input', filterToc);

        const links = Array.from(document.querySelectorAll('#guide-toc a[href^="#"]'));
        const linkById = new Map(links.map(link => [decodeURIComponent(link.hash.slice(1)), link]));
        const headings = Array.from(document.querySelectorAll('.content h2[id], .content h3[id]'))
            .filter(heading => linkById.has(heading.id));
        if (!headings.length || typeof IntersectionObserver !== 'function') return;

        let activeLink = null;
        const setActive = (id) => {
            const link = linkById.get(id);
            if (!link || link === activeLink) return;
            if (activeLink) {
                activeLink.classList.remove('active');
                activeLink.removeAttribute('aria-current');
            }
            link.classList.add('active');
            link.setAttribute('aria-current', 'location');
            activeLink = link;
            const toc = document.getElementById('guide-toc');
            if (toc) {
                const linkBox = link.getBoundingClientRect();
                const tocBox = toc.getBoundingClientRect();
                if (linkBox.top < tocBox.top || linkBox.bottom > tocBox.bottom) {
                    toc.scrollTop += linkBox.top - tocBox.top - tocBox.height / 2;
                }
            }
        };

        // The active heading is the last one above the top quarter of the view.
        const update = () => {
            const line = window.innerHeight * 0.25;
            let current = headings[0];
            for (const heading of headings) {
                if (heading.getBoundingClientRect().top <= line) current = heading;
                else break;
            }
            setActive(current.id);
        };
        const observer = new IntersectionObserver(update, { rootMargin: '0px 0px -75% 0px' });
        headings.forEach(heading => observer.observe(heading));
        update();
    }

    document.addEventListener('DOMContentLoaded', () => {
        initializeTheme();
        initializeToc();
        applyGuideI18n();
        if (window.LinkumoriI18n && typeof window.LinkumoriI18n.ready === 'function') {
            window.LinkumoriI18n.ready(applyGuideI18n);
        }
    });
})();
