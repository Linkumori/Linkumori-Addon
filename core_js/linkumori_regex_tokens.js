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
    const MIN_URL_PATTERN_TOKEN_LENGTH = 3;
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

    function sortTokens(tokens) {
        return Array.from(new Set(tokens)).sort((left, right) => {
            if (left.length !== right.length) return right.length - left.length;
            return left < right ? -1 : left > right ? 1 : 0;
        });
    }

    function normalizeURLRegexLiteralToken(input) {
        const cleaned = String(input || '')
            .replace(/[^a-z0-9._/%:@!$&'()*+,;=?#[\]~-]+/gi, '')
            .toLowerCase();
        if (!cleaned) return '';

        // RFC 3986 §3.1: scheme = ALPHA *( ALPHA / DIGIT / "+" / "-" / "." )
        // Regex literals extracted from regex AST may begin with "://" when the
        // scheme letters were consumed by a sibling node (e.g. "https?" → "http"
        // consumed, leaving "://host"). Prepend a dummy ALPHA so the RFC 3986
        // Appendix B parser can recognise the authority component.
        const toParse = /^:\/\//.test(cleaned) ? 'x' + cleaned : cleaned;

        // RFC 3986 Appendix B — canonical URI-reference parser
        const m = toParse.match(/^(?:([^:/?#]+):)?(?:\/\/([^/?#]*))?([^?#]*)(?:\?([^#]*))?(?:#(.*))?$/);
        if (!m) return '';

        const authority = m[2]; // RFC 3986 §3.2
        const path      = m[3]; // RFC 3986 §3.3

        let host;
        if (authority !== undefined) {
            // RFC 3986 §3.2.1 — strip userinfo
            const afterUserinfo = authority.replace(/^[^@]+@/, '');
            // RFC 3986 §3.2.3 — strip port
            host = afterUserinfo.replace(/:\d*$/, '');
        } else {
            // No authority component — treat leading path segment as potential host
            host = (path || '').split(/[/?#]/)[0];
        }

        if (!host || host === 'localhost') return '';

        // Reject raw IPv4 literals — not useful as substring tokens
        if (/^\d{1,3}(?:\.\d{1,3}){3}$/.test(host)) return '';

        if (host.includes('.')) {
            const labels = host.split('.');
            const hostLabelPattern = /^[a-z0-9](?:[-_]*[a-z0-9])*$/;
            const tldPattern = /^(?:[a-z]{2,}|xn--[a-z0-9-]{2,})$/;
            if (
                labels.some(label => !hostLabelPattern.test(label)) ||
                !tldPattern.test(labels[labels.length - 1])
            ) {
                return '';
            }
        }

        return host;
    }

    function tokensFromURLRegexLiteral(value) {
        const normalized = normalizeURLRegexLiteralToken(value);
        if (
            normalized.length >= MIN_URL_PATTERN_TOKEN_LENGTH &&
            /[a-z0-9]/.test(normalized) &&
            !BAD_TOKENS.has(normalized)
        ) {
            return [normalized];
        }

        return splitTokens(value)
            .filter(token => token.length >= MIN_URL_PATTERN_TOKEN_LENGTH);
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

    function requiredURLPatternTokensFromNode(node) {
        if (!node || typeof node !== 'object') return [];

        switch (node.type) {
            case 1: { // Sequence
                const tokens = [];
                node.val.forEach(child => {
                    tokens.push(...requiredURLPatternTokensFromNode(child));
                });
                return sortTokens(tokens);
            }
            case 2: { // Alternation — only tokens present in ALL branches are required
                const alternatives = Array.isArray(node.val) ? node.val : [];
                if (alternatives.length === 0) return [];

                let intersection = null;
                for (let i = 0; i < alternatives.length; i++) {
                    const branchTokens = requiredURLPatternTokensFromNode(alternatives[i]);
                    if (branchTokens.length === 0) return [];
                    if (intersection === null) {
                        intersection = new Set(branchTokens);
                    } else {
                        for (const token of intersection) {
                            if (!branchTokens.includes(token)) intersection.delete(token);
                        }
                        if (intersection.size === 0) return [];
                    }
                }
                return sortTokens(Array.from(intersection || []));
            }
            case 4: { // Group
                const flags = node.flags || {};
                if (
                    flags.NegativeLookAhead === 1 ||
                    flags.NegativeLookBehind === 1 ||
                    flags.LookAhead === 1 ||
                    flags.LookBehind === 1
                ) {
                    return [];
                }
                return requiredURLPatternTokensFromNode(node.val);
            }
            case 16: { // Quantifier
                const flags = node.flags || {};
                if (flags.min !== undefined && flags.min < 1) return [];
                return requiredURLPatternTokensFromNode(node.val);
            }
            case 64: { // HexChar
                const flags = node.flags || {};
                return tokensFromURLRegexLiteral(flags.Char || '');
            }
            case 1024: // String
                return tokensFromURLRegexLiteral(node.val);
            case 128: { // Special
                const flags = node.flags || {};
                if (
                    flags.MatchStart === 1 ||
                    flags.MatchEnd === 1 ||
                    flags.MatchWordBoundary === 1 ||
                    flags.MatchNonWordBoundary === 1
                ) {
                    return [];
                }
                return [];
            }
            case 8: // CharacterGroup
            case 32: // UnicodeChar
            case 256: // Characters
            case 512: // CharacterRange
            case 2048: // Comment
            default:
                return [];
        }
    }

    function extractURLPatternTokensFromRegex(regexSource) {
        const Regex = globalThis.Regex;
        if (!Regex || typeof Regex.Analyzer !== 'function') return [];

        try {
            const tree = Regex.Analyzer(String(regexSource || ''), false).tree();
            return requiredURLPatternTokensFromNode(tree);
        } catch (e) {
            return [];
        }
    }

    function collectTokensFromText(text) {
        return splitTokens(text);
    }

    globalThis.LinkumoriRegexTokens = {
        extractBestTokenFromRegex,
        extractURLPatternTokensFromRegex,
        collectTokensFromText,
        isTokenChar
    };
})();
