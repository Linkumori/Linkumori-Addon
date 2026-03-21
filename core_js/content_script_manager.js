/*
 * ============================================================
 * Linkumori — Managed Content Script Registration
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
 * Repository: https://github.com/linkumori/linkumori
 *
 * DESCRIPTION
 * -----------
 * Keeps optional search result cleanup scripts under one
 * settings toggle.
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
(function () {
    "use strict";

    const SEARCH_LINK_FIX_STORAGE_KEY = 'searchLinkFixEnabled';
    const MANAGED_SCRIPT_IDS = ['linkumori-google-link-fix', 'linkumori-yandex-link-fix'];
    const MANAGED_CONTENT_SCRIPTS = [
        {
            id: 'linkumori-google-link-fix',
            allFrames: true,
            matches: [
                "*://*.google.com/*",
                "*://*.google.ad/*",
                "*://*.google.ae/*",
                "*://*.google.com.af/*",
                "*://*.google.com.ag/*",
                "*://*.google.com.ai/*",
                "*://*.google.al/*",
                "*://*.google.am/*",
                "*://*.google.co.ao/*",
                "*://*.google.com.ar/*",
                "*://*.google.as/*",
                "*://*.google.at/*",
                "*://*.google.com.au/*",
                "*://*.google.az/*",
                "*://*.google.ba/*",
                "*://*.google.com.bd/*",
                "*://*.google.be/*",
                "*://*.google.bf/*",
                "*://*.google.bg/*",
                "*://*.google.com.bh/*",
                "*://*.google.bi/*",
                "*://*.google.bj/*",
                "*://*.google.com.bn/*",
                "*://*.google.com.bo/*",
                "*://*.google.com.br/*",
                "*://*.google.bs/*",
                "*://*.google.bt/*",
                "*://*.google.co.bw/*",
                "*://*.google.by/*",
                "*://*.google.com.bz/*",
                "*://*.google.ca/*",
                "*://*.google.cd/*",
                "*://*.google.cf/*",
                "*://*.google.cg/*",
                "*://*.google.ch/*",
                "*://*.google.ci/*",
                "*://*.google.co.ck/*",
                "*://*.google.cl/*",
                "*://*.google.cm/*",
                "*://*.google.cn/*",
                "*://*.google.com.co/*",
                "*://*.google.co.cr/*",
                "*://*.google.com.cu/*",
                "*://*.google.cv/*",
                "*://*.google.com.cy/*",
                "*://*.google.cz/*",
                "*://*.google.de/*",
                "*://*.google.dj/*",
                "*://*.google.dk/*",
                "*://*.google.dm/*",
                "*://*.google.com.do/*",
                "*://*.google.dz/*",
                "*://*.google.com.ec/*",
                "*://*.google.ee/*",
                "*://*.google.com.eg/*",
                "*://*.google.es/*",
                "*://*.google.com.et/*",
                "*://*.google.fi/*",
                "*://*.google.com.fj/*",
                "*://*.google.fm/*",
                "*://*.google.fr/*",
                "*://*.google.ga/*",
                "*://*.google.ge/*",
                "*://*.google.gg/*",
                "*://*.google.com.gh/*",
                "*://*.google.com.gi/*",
                "*://*.google.gl/*",
                "*://*.google.gm/*",
                "*://*.google.gp/*",
                "*://*.google.gr/*",
                "*://*.google.com.gt/*",
                "*://*.google.gy/*",
                "*://*.google.com.hk/*",
                "*://*.google.hn/*",
                "*://*.google.hr/*",
                "*://*.google.ht/*",
                "*://*.google.hu/*",
                "*://*.google.co.id/*",
                "*://*.google.ie/*",
                "*://*.google.co.il/*",
                "*://*.google.im/*",
                "*://*.google.co.in/*",
                "*://*.google.iq/*",
                "*://*.google.is/*",
                "*://*.google.it/*",
                "*://*.google.je/*",
                "*://*.google.com.jm/*",
                "*://*.google.jo/*",
                "*://*.google.co.jp/*",
                "*://*.google.co.ke/*",
                "*://*.google.com.kh/*",
                "*://*.google.ki/*",
                "*://*.google.kg/*",
                "*://*.google.co.kr/*",
                "*://*.google.com.kw/*",
                "*://*.google.kz/*",
                "*://*.google.la/*",
                "*://*.google.com.lb/*",
                "*://*.google.li/*",
                "*://*.google.lk/*",
                "*://*.google.co.ls/*",
                "*://*.google.lt/*",
                "*://*.google.lu/*",
                "*://*.google.lv/*",
                "*://*.google.com.ly/*",
                "*://*.google.co.ma/*",
                "*://*.google.md/*",
                "*://*.google.me/*",
                "*://*.google.mg/*",
                "*://*.google.mk/*",
                "*://*.google.ml/*",
                "*://*.google.com.mm/*",
                "*://*.google.mn/*",
                "*://*.google.ms/*",
                "*://*.google.com.mt/*",
                "*://*.google.mu/*",
                "*://*.google.mv/*",
                "*://*.google.mw/*",
                "*://*.google.com.mx/*",
                "*://*.google.com.my/*",
                "*://*.google.co.mz/*",
                "*://*.google.com.na/*",
                "*://*.google.com.nf/*",
                "*://*.google.com.ng/*",
                "*://*.google.com.ni/*",
                "*://*.google.ne/*",
                "*://*.google.nl/*",
                "*://*.google.no/*",
                "*://*.google.com.np/*",
                "*://*.google.nr/*",
                "*://*.google.nu/*",
                "*://*.google.co.nz/*",
                "*://*.google.com.om/*",
                "*://*.google.com.pa/*",
                "*://*.google.com.pe/*",
                "*://*.google.com.pg/*",
                "*://*.google.com.ph/*",
                "*://*.google.com.pk/*",
                "*://*.google.pl/*",
                "*://*.google.pn/*",
                "*://*.google.com.pr/*",
                "*://*.google.ps/*",
                "*://*.google.pt/*",
                "*://*.google.com.py/*",
                "*://*.google.com.qa/*",
                "*://*.google.ro/*",
                "*://*.google.ru/*",
                "*://*.google.rw/*",
                "*://*.google.com.sa/*",
                "*://*.google.com.sb/*",
                "*://*.google.sc/*",
                "*://*.google.se/*",
                "*://*.google.com.sg/*",
                "*://*.google.sh/*",
                "*://*.google.si/*",
                "*://*.google.sk/*",
                "*://*.google.com.sl/*",
                "*://*.google.sn/*",
                "*://*.google.so/*",
                "*://*.google.sm/*",
                "*://*.google.sr/*",
                "*://*.google.st/*",
                "*://*.google.com.sv/*",
                "*://*.google.td/*",
                "*://*.google.tg/*",
                "*://*.google.co.th/*",
                "*://*.google.com.tj/*",
                "*://*.google.tk/*",
                "*://*.google.tl/*",
                "*://*.google.tm/*",
                "*://*.google.tn/*",
                "*://*.google.to/*",
                "*://*.google.com.tr/*",
                "*://*.google.tt/*",
                "*://*.google.com.tw/*",
                "*://*.google.co.tz/*",
                "*://*.google.com.ua/*",
                "*://*.google.co.ug/*",
                "*://*.google.co.uk/*",
                "*://*.google.com.uy/*",
                "*://*.google.co.uz/*",
                "*://*.google.com.vc/*",
                "*://*.google.co.ve/*",
                "*://*.google.vg/*",
                "*://*.google.co.vi/*",
                "*://*.google.com.vn/*",
                "*://*.google.vu/*",
                "*://*.google.ws/*",
                "*://*.google.rs/*",
                "*://*.google.co.za/*",
                "*://*.google.co.zm/*",
                "*://*.google.co.zw/*",
                "*://*.google.cat/*"
            ],
            js: ["core_js/google_link_fix.js"],
            runAt: "document_end"
        },
        {
            id: 'linkumori-yandex-link-fix',
            allFrames: true,
            matches: [
                "*://*.yandex.ru/*",
                "*://*.yandex.com/*",
                "*://*.ya.ru/*"
            ],
            js: ["core_js/yandex_link_fix.js"],
            runAt: "document_end"
        }
    ];

    async function getSearchLinkFixEnabled() {
        const items = await browser.storage.local.get([SEARCH_LINK_FIX_STORAGE_KEY]);
        if (typeof items[SEARCH_LINK_FIX_STORAGE_KEY] === 'boolean') {
            return items[SEARCH_LINK_FIX_STORAGE_KEY];
        }

        await browser.storage.local.set({
            [SEARCH_LINK_FIX_STORAGE_KEY]: true
        }).catch(() => {});

        return true;
    }

    async function syncManagedContentScripts() {
        if (!browser.scripting) {
            return;
        }

        await browser.scripting.unregisterContentScripts({
            ids: MANAGED_SCRIPT_IDS
        }).catch(() => {});

        const enabled = await getSearchLinkFixEnabled().catch(() => true);
        if (!enabled) {
            return;
        }

        await browser.scripting.registerContentScripts(MANAGED_CONTENT_SCRIPTS).catch(() => {});
    }

    browser.runtime.onInstalled.addListener(() => {
        syncManagedContentScripts();
    });

    if (browser.runtime.onStartup) {
        browser.runtime.onStartup.addListener(() => {
            syncManagedContentScripts();
        });
    }

    browser.storage.onChanged.addListener((changes, areaName) => {
        if (areaName !== 'local' || !changes) {
            return;
        }

        if (changes[SEARCH_LINK_FIX_STORAGE_KEY]) {
            syncManagedContentScripts();
        }
    });

    syncManagedContentScripts();
})();
