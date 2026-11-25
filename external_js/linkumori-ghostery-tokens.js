/*!
 * Copyright (c) 2017-present Ghostery GmbH. All rights reserved.
 *
 * This Source Code Form is subject to the terms of the Mozilla Public
 * License, v. 2.0. If a copy of the MPL was not distributed with this
 * file, You can obtain one at https://mozilla.org/MPL/2.0/.
 */
/*
 * ============================================================
 * Linkumori — tokenizer adapted from @ghostery/adblocker
 * ============================================================
 * Source:   @ghostery/adblocker 2.20.3, dist/esm/utils.js
 *           https://github.com/ghostery/adblocker
 *           Copyright (c) 2017-present Ghostery GmbH.
 *
 * LICENSES IN THIS FILE
 * ---------------------
 * 1. Code from @ghostery/adblocker
 *    Copyright (c) 2017-present Ghostery GmbH.
 *    License: Mozilla Public License 2.0 (MPL-2.0).
 *    Full text: THIRD-PARTY-NOTICE/ghostery-adblocker/LICENSE and
 *    https://mozilla.org/MPL/2.0/.
 *
 * 2. Code Linkumori added or changed in this file (listed below)
 *    Copyright (c) 2026 Subham Mahesh.
 *    License: MPL-2.0 and GNU Lesser General Public License v3.0 or
 *    later (LGPL-3.0-or-later).
 *
 * DISTRIBUTION UNDER LGPL v3 (MPL-2.0 SECTION 3.3)
 * -------------------------------------------------
 * Linkumori is a Larger Work that combines this file with code under
 * the GNU LGPL v3.0 or later. The LGPL (version 2.1 "or any later
 * versions", so v3.0 too) is a Secondary License (MPL-2.0 section
 * 1.12), and the Ghostery code carries no "Incompatible With Secondary
 * Licenses" notice (Exhibit B). Section 3.3 therefore lets Linkumori
 * distribute this whole file, the Ghostery code included, under the
 * GNU LGPL v3.0 or later in addition to MPL-2.0.
 *
 * As a recipient of Linkumori you may, at your option, use and further
 * distribute this file under either:
 *   - the Mozilla Public License 2.0, or
 *   - the GNU Lesser General Public License v3.0 or later
 *     (https://www.gnu.org/licenses/lgpl-3.0.html).
 *
 * The Ghostery copyright and MPL-2.0 notice above must be kept
 * (MPL-2.0 section 3.4), whichever license you choose.
 *
 * Linkumori modifications (MPL-2.0 and LGPL-3.0-or-later):
 * - Kept only the hashing and tokenizing functions.
 * - Tokens are returned as plain arrays: the fixed-size TOKENS_BUFFER
 *   (and the length limit it imposed) is not used, so every token of a
 *   string is returned.
 * - Exposed on globalThis.LinkumoriGhosteryTokens for the background's
 *   classic scripts instead of as ES module exports.
 * - Added tokenizeNoSkipAscii(): tokenizeNoSkip() with only ASCII
 *   letters, digits and '%' as token characters.
 * ============================================================
 */
(function (root) {
    'use strict';

    const HASH_INTERNAL_MULT = 37;
    const HASH_SEED = 5011;

    function isDigit(ch) {
        // 48 == '0'
        // 57 == '9'
        return ch >= 48 && ch <= 57;
    }

    function isAlpha(ch) {
        // 65 == 'A'
        // 90 == 'Z'
        // 97 == 'a'
        // 122 === 'z'
        return (ch >= 97 && ch <= 122) || (ch >= 65 && ch <= 90);
    }

    function isAlphaExtended(ch) {
        // 192 -> 450 (Latin letters with diacritics)
        return ch >= 192 && ch <= 450;
    }

    function isCyrillic(ch) {
        // 1024 -> 1279
        return ch >= 1024 && ch <= 1279;
    }

    function isAllowedCode(ch) {
        return (isAlpha(ch) || isDigit(ch) || ch === 37 /* '%' */ || isAlphaExtended(ch) || isCyrillic(ch));
    }

    function fastHashBetween(str, begin, end) {
        let hash = HASH_SEED;
        for (let i = begin; i < end; i += 1) {
            hash = (hash * HASH_INTERNAL_MULT) ^ str.charCodeAt(i);
        }
        return hash >>> 0;
    }

    // Tokens of a filter pattern. A token touching a '*' is left out, and
    // so is the first (or last) token when `skipFirstToken` (or
    // `skipLastToken`) is set. Tokens of one character are left out.
    function tokenizeWithWildcards(pattern, skipFirstToken, skipLastToken) {
        const tokens = [];
        const len = pattern.length;
        let inside = false;
        let precedingCh = 0;
        let start = 0;
        let hash = HASH_SEED;
        for (let i = 0; i < len; i += 1) {
            const ch = pattern.charCodeAt(i);
            if (isAllowedCode(ch) === true) {
                if (inside === false) {
                    hash = HASH_SEED;
                    inside = true;
                    start = i;
                }
                hash = (hash * HASH_INTERNAL_MULT) ^ ch;
            }
            else {
                if (inside === true) {
                    inside = false;
                    if (i - start > 1 && // Ignore tokens of 1 character
                        ch !== 42 && // Ignore tokens followed by a '*'
                        precedingCh !== 42 && // Ignore tokens preceeded by a '*'
                        (skipFirstToken === false || start !== 0)) {
                        tokens.push(hash >>> 0);
                    }
                }
                precedingCh = ch;
            }
        }
        if (skipLastToken === false &&
            inside === true &&
            precedingCh !== 42 && // Ignore tokens preceeded by a '*'
            pattern.length - start > 1) { // Ignore tokens of 1 character
            tokens.push(hash >>> 0);
        }
        return tokens;
    }

    // Every token of a string (such as a URL), none skipped.
    function tokenizeNoSkip(pattern) {
        const tokens = [];
        const len = pattern.length;
        let inside = false;
        let start = 0;
        let hash = HASH_SEED;
        for (let i = 0; i < len; i += 1) {
            const ch = pattern.charCodeAt(i);
            if (isAllowedCode(ch) === true) {
                if (inside === false) {
                    hash = HASH_SEED;
                    inside = true;
                    start = i;
                }
                hash = (hash * HASH_INTERNAL_MULT) ^ ch;
            }
            else if (inside === true) {
                inside = false;
                if (i - start > 1) {
                    tokens.push(hash >>> 0);
                }
            }
        }
        if (inside === true && pattern.length - start > 1) {
            tokens.push(hash >>> 0);
        }
        return tokens;
    }

    function isAsciiTokenCode(ch) {
        return isAlpha(ch) || isDigit(ch) || ch === 37 /* '%' */;
    }

    // tokenizeNoSkip() with ASCII letters, digits and '%' as the only token
    // characters, so any other character (such as an accented letter) ends
    // a token.
    function tokenizeNoSkipAscii(pattern) {
        const tokens = [];
        const len = pattern.length;
        let inside = false;
        let start = 0;
        let hash = HASH_SEED;
        for (let i = 0; i < len; i += 1) {
            const ch = pattern.charCodeAt(i);
            if (isAsciiTokenCode(ch) === true) {
                if (inside === false) {
                    hash = HASH_SEED;
                    inside = true;
                    start = i;
                }
                hash = (hash * HASH_INTERNAL_MULT) ^ ch;
            }
            else if (inside === true) {
                inside = false;
                if (i - start > 1) {
                    tokens.push(hash >>> 0);
                }
            }
        }
        if (inside === true && pattern.length - start > 1) {
            tokens.push(hash >>> 0);
        }
        return tokens;
    }

    root.LinkumoriGhosteryTokens = Object.freeze({
        fastHashBetween,
        tokenizeWithWildcards,
        tokenizeNoSkip,
        tokenizeNoSkipAscii
    });
})(typeof globalThis !== 'undefined' ? globalThis : this);
