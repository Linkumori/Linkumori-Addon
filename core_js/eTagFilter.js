/*
 * ============================================================
 * ClearURLs
 * ============================================================
 * Copyright (c) 2017–2025 Kevin Röbert
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
 * - Removed Firefox flag to allow Firefox users to use this code
 * - Added whitelist check for eTag filtering
 *
 * ============================================================
 * MODIFICATION HISTORY
 * ============================================================
 * 2025-06-14   Subham Mahesh   First modification
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
function eTagFilter(requestDetails) {
    if(!requestDetails.responseHeaders || !storage.eTagFiltering
        || storage.localHostsSkipping && checkLocalURL(new URL(requestDetails.url))) return {};
    
    // ============================================================
    // WHITELIST CHECK - EARLY EXIT BEFORE ANY PROCESSING
    // ============================================================
    if (isWhitelisted(requestDetails.url, requestDetails)) {
        return {}; 
    }

    for(let i=0; i < requestDetails.responseHeaders.length; i++) {
        const header = requestDetails.responseHeaders[i];

        if(header.name.toString().toLowerCase() !== "etag") {
            continue;
        }

        const etag = header.value.toLowerCase();
        const w = etag.startsWith('w');
        const quotes = etag.endsWith('"');

        let len = etag.length;
        if (w) len -= 2;
        if (quotes) len -= 2;

        // insert dummy etag
        requestDetails.responseHeaders[i].value = generateDummyEtag(len, quotes, w);

        pushToLog(requestDetails.url, requestDetails.url, translate("eTag_filtering_log"), {
            logCategory: 'feature',
            requestMethod: requestDetails && typeof requestDetails.method === 'string' ? requestDetails.method : null,
            requestType: requestDetails && typeof requestDetails.type === 'string' ? requestDetails.type : null
        });

        break;
    }

    return {responseHeaders: requestDetails.responseHeaders};
}

/**
 * Generates a random ETag.
 * 
 * Must be ASCII characters placed between double quotes.
 * See: https://developer.mozilla.org/en-US/docs/Web/HTTP/Headers/ETag
 */
function generateDummyEtag(len, quotes = true, w = false) {
    let rtn = randomASCII(len);

    if (quotes) rtn = '"' + rtn + '"';
    if (w) rtn = 'W/' + rtn;

    return rtn;
}


browser.webRequest.onHeadersReceived.addListener(
    eTagFilter,
    {urls: ["<all_urls>"]},
    ["blocking", "responseHeaders"]
);
