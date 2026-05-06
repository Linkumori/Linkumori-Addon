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
 * Upstream:   https://gitlab.com/ClearURLs/ClearUrls/-/blob/m3-migration/core_js/context_menu.js
 *
 * MODIFICATIONS
 * -------------
 * - Added localStorage sync flag to enable/disable context menu
 * - Added flag to prevent duplicate removal on extension install
 * - Modified context menu function
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
// Flag to prevent duplicate event listeners
let contextMenuClickListenerRegistered = false;

async function contextMenuStart() {
    try {
        // Always remove existing context menus first
        await browser.contextMenus.removeAll();
        
        if (storage.contextMenuEnabled) {
            LinkumoriI18n.ready().then(() => {
                browser.contextMenus.create({
                    id: "copy-link-to-clipboard",
                    title: translate("clipboard_copy_link"),
                    contexts: ["link"]
                });

                // Only register the click listener once
                if (!contextMenuClickListenerRegistered) {
                    browser.contextMenus.onClicked.addListener(async (info, tab) => {
                        if (info.menuItemId === "copy-link-to-clipboard") {
                            try {
                                const url = pureCleaning(info.linkUrl);
                                
                                // Check if copyToClipboard function exists
                                const results = await browser.scripting.executeScript({
                                    target: { tabId: tab.id },
                                    func: () => typeof copyToClipboard === 'function'
                                });

                                // If function doesn't exist, inject the clipboard helper script
                                if (!results || !results[0] || results[0].result !== true) {
                                    await browser.scripting.executeScript({
                                        target: { tabId: tab.id },
                                        files: ["/core_js/clipboard-helper.js"]
                                    });
                                }

                                // Execute the copy function with the cleaned URL
                                await browser.scripting.executeScript({
                                    target: { tabId: tab.id },
                                    func: (cleanUrl) => {
                                        copyToClipboard(cleanUrl);
                                    },
                                    args: [url]
                                });

                            } catch (error) {
                                console.error("Failed to copy text: " + error);
                            }
                        }
                    });
                    
                    contextMenuClickListenerRegistered = true;
                }
            }); // <-- Close .then()
        } // <-- Close if (storage.contextMenuEnabled)
    } catch (error) {
        handleError(error);
    }
}

// Listen for storage changes to update context menu in real-time
browser.storage.onChanged.addListener((changes, areaName) => {
    if (areaName === 'local' && changes.contextMenuEnabled) {
        // Update storage variable
        storage.contextMenuEnabled = changes.contextMenuEnabled.newValue;
        
        // Restart context menu with new setting
        contextMenuStart();
    }
});

function handleError(error) {
    console.error("Context menu error: " + error);
}