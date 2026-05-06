/*
 * ============================================================
 * ClearURLs
 * ============================================================
 * Copyright (c) 2017–2020 Kevin Röbert
 * Modified by Subham Mahesh (c) 2025–2026 (modified parts only)
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
 * Upstream:   https://gitlab.com/ClearURLs/ClearUrls/-/blob/m3-migration/core_js/watchdog.js
 *
 * MODIFICATIONS
 * -------------
 * - Changed dirtyurl and cleanurl
 * - Watchdog now skips when both remote and built-in rules are disabled
 *
 * DESCRIPTION
 * -----------
 * This script checks at fixed intervals that ClearURLs is working
 * properly. In issue #203, some users reported that the filter
 * function stops working after some time without any recognizable
 * reason. This watchdog restarts the add-on when the check fails.
 *
 * ============================================================
 * MODIFICATION HISTORY
 * ============================================================
 * 2025-06-14   Subham Mahesh   First modification
 * 2026-02-18   Subham Mahesh   Watchdog skips when both remote
 *                               and built-in rules are disabled
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
const __dirtyURL = "https://linkumori.com?utm_source=addon";
const __cleanURL = new URL("https://linkumori.com").toString();

browser.alarms.create("watchdog", {
    periodInMinutes: 1,
});

browser.alarms.onAlarm.addListener(function (alarmInfo) {
    if (alarmInfo.name === "watchdog" && isStorageAvailable() && storage.globalStatus) {
        if (typeof hasPopupConsentForStartup === 'function' && !hasPopupConsentForStartup()) {
            return;
        }

        if (typeof isTemporarilyPaused === 'function' && isTemporarilyPaused()) {
            return;
        }

        // If neither remote nor built‑in rules are enabled, there is no baseline
        // rule set to test – the watchdog would always fail, so we skip.
        if (!storage.remoteRulesEnabled && !storage.builtInRulesEnabled) {
            return;
        }

        if (new URL(pureCleaning(__dirtyURL, true)).toString() !== __cleanURL) {
            storage.watchDogErrorCount += 1;
            saveOnExit();
            if (storage.watchDogErrorCount < 3) reload();
        } else if (storage.watchDogErrorCount > 0) {
            storage.watchDogErrorCount = 0;
            saveOnExit();
        }
    }
});
