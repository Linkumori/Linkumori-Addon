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
 * Upstream:   https://gitlab.com/ClearURLs/ClearUrls/-/blob/m3-migration/core_js/badgedHandler.js
 *
 * MODIFICATIONS
 * -------------
 * - MV3 migration patches taken from upstream (see Upstream above)
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
let badges = {};

/**
 * Increases the badged by one.
 */
function increaseBadged(quiet = false, request) {
    if(request === null) return;
    if(!request || typeof request !== 'object') return;

    // Enforce whitelist behavior at badge layer too:
    // whitelisted requests must never increase badge/cleaned counters.
    if (typeof isWhitelisted === 'function' && isWhitelisted(request.url, request)) {
        return;
    }

    if (!quiet) increaseCleanedCounter();

    const tabId = request.tabId;
    const url = request.url;

    if(tabId === -1) return;

    if (badges[tabId] == null) {
        badges[tabId] = {
            counter: 1,
            lastURL: url
        };
    } else {
        badges[tabId].counter += 1;
    }

    if (storage.badgedStatus) {
        // Set badge text
        browser.action.setBadgeText({
            text: (badges[tabId]).counter.toString(), 
            tabId: tabId
        }).catch(handleError);
        
        // SIMPLE FIX: Just read color from storage and apply it
        browser.action.setBadgeBackgroundColor({
            color: storage.badged_color,
            tabId: tabId
        }).catch(handleError);
        
    } else {
        browser.action.setBadgeText({text: "", tabId: tabId}).catch(handleError);
    }
}

/**
 * Call by each tab is updated.
 * And if url has changed.
 */
function handleUpdated(tabId, changeInfo, tabInfo) {
    if(!badges[tabId] || !changeInfo.url) return;

    if (badges[tabId].lastURL !== changeInfo.url) {
        badges[tabId] = {
            counter: 0,
            lastURL: tabInfo.url
        };
    }
}

/**
 * Call by each tab is updated.
 */
browser.tabs.onUpdated.addListener(handleUpdated);
