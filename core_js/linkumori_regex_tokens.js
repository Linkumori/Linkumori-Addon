/*
 * ============================================================
 * Linkumori — Regex Token Extraction
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
 * Linkumori regex token extraction.
 *
 * Uses RegexAnalyzer (public domain / Unlicense) to conservatively extract
 * literal tokens from regex-based $removeparam rules for the reverse index.
 * If a token cannot be proven safe, callers should leave the rule in fallback.
 *
 * ============================================================
 * MODIFICATION HISTORY
 * ============================================================
 * 2026-04-26   Subham Mahesh   File created
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
    'use strict';

    const MIN_TOKEN_LENGTH = 2;
    const BAD_TOKENS = new Set([
        'com', 'www', 'http', 'https', 'net', 'org', 'html', 'php',
        'true', 'false', 'null', 'jpg', 'png', 'gif', 'css', 'js'
    ]);

    function isTokenChar(ch) {
        return /[%0-9A-Za-z]/.test(ch);
    }

    function splitTokens(value) {
        return String(value || '')
            .split(/[^%0-9A-Za-z]+/)
            .map(token => token.toLowerCase())
            .filter(token => token.length >= MIN_TOKEN_LENGTH && !BAD_TOKENS.has(token));
    }

    function bestTokenFromTokenizableLiteral(value) {
        const tokens = [];

        String(value || '').split('\x00').forEach(segment => {
            if (!segment || segment.indexOf('\x01') !== -1) return;
            tokens.push(...splitTokens(segment));
        });

        if (tokens.length === 0) return '';

        return tokens.sort((left, right) => {
            if (left.length !== right.length) return right.length - left.length;
            return left < right ? -1 : left > right ? 1 : 0;
        })[0];
    }

    function tokenizableLiteralFromNode(node) {
        if (!node || typeof node !== 'object') return '';

        switch (node.type) {
            case 1: { // Sequence
                return node.val.map(tokenizableLiteralFromNode).join('');
            }
            case 4: { // Group
                const flags = node.flags || {};
                if (flags.NegativeLookAhead === 1 || flags.NegativeLookBehind === 1) return '\x00';
                if (flags.LookAhead === 1 || flags.LookBehind === 1) return '\x00';
                return tokenizableLiteralFromNode(node.val);
            }
            case 16: { // Quantifier
                const flags = node.flags || {};
                if (flags.min !== undefined && flags.min < 1) return '\x00';
                return tokenizableLiteralFromNode(node.val);
            }
            case 64: { // HexChar
                const flags = node.flags || {};
                return flags.Char || '';
            }
            case 1024: // String
                return String(node.val || '');
            case 2048: // Comment
                return '';
            case 2: // Alternation
            case 8: // CharacterGroup
            case 32: // UnicodeChar
            case 256: // Characters
            case 512: // CharacterRange
            default:
                return '\x01';
            case 128: { // Special
                const flags = node.flags || {};
                if (
                    flags.MatchStart === 1 ||
                    flags.MatchEnd === 1 ||
                    flags.MatchWordBoundary === 1 ||
                    flags.MatchNonWordBoundary === 1
                ) {
                    return '\x00';
                }
                return '\x01';
            }
        }
    }

    function extractBestTokenFromRegex(regexSource) {
        const Regex = globalThis.Regex;
        if (!Regex || typeof Regex.Analyzer !== 'function') return '';

        try {
            const tree = Regex.Analyzer(String(regexSource || ''), false).tree();
            return bestTokenFromTokenizableLiteral(tokenizableLiteralFromNode(tree));
        } catch (e) {
            return '';
        }
    }

    function collectTokensFromText(text) {
        return splitTokens(text);
    }

    globalThis.LinkumoriRegexTokens = {
        extractBestTokenFromRegex,
        collectTokensFromText,
        isTokenChar
    };
})();
