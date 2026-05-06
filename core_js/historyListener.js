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
 * - Added whitelist check
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
function historyListenerStart() {
    if(storage.historyListenerEnabled) {
        browser.webNavigation.onHistoryStateUpdated.addListener(historyCleaner);
    }
}

/**
* Function that is triggered on history changes. Injects script into page
* to clean links that were pushed to the history stack with the
* history.replaceState method.
* @param  {state object} details The state object is a JavaScript object
* which is associated with the new history entry created by replaceState()
*/
async function historyCleaner(details) {
    if(storage.globalStatus) {
        if (typeof isTemporarilyPaused === 'function' && isTemporarilyPaused()) {
            return;
        }

        // Permanent whitelist check.
        if (isWhitelisted(details.url, details)) {
            return;
        }

        // Temporary tab whitelist check (explicit — webNavigation details
        // are not webRequest details, so context-URL resolution in
        // isWhitelisted may not fire; check directly by tabId here).
        if (
            typeof getTemporaryTabWhitelistForTab === 'function' &&
            typeof details.tabId === 'number' &&
            details.tabId >= 0
        ) {
            try {
                const hostname = new URL(details.url).hostname.toLowerCase();
                const tempDomains = getTemporaryTabWhitelistForTab(details.tabId);
                if (
                    tempDomains.length > 0 &&
                    tempDomains.some(p =>
                        typeof matchWhitelistHostnamePattern === 'function'
                            ? matchWhitelistHostnamePattern(hostname, p)
                            : hostname === p
                    )
                ) {
                    return;
                }
            } catch (e) {}
        }

        const urlBefore = details.url;
        const urlAfter = pureCleaning(details.url);

        if(urlBefore !== urlAfter) {
            
            try {
                // Use the modern scripting API for Manifest V3
                await browser.scripting.executeScript({
                    target: {
                        tabId: details.tabId,
                        frameIds: details.frameId ? [details.frameId] : undefined
                    },
                    func: (cleanUrl) => {
                        history.replaceState(null, "", cleanUrl);
                    },
                    args: [urlAfter]
                });
            } catch (error) {
                onError(error);
            }
        }
    }
}

function onError(error) {
    console.error(`Linkumori Error: ${error}`);
}
