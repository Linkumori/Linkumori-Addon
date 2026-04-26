/*
 * ============================================================
 * Linkumori — Token Trie
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
 * Linkumori token trie
 *
 * A small JavaScript trie for URL-filter tokens. This is intentionally much
 * narrower than uBO's BidiTrieContainer: Linkumori only needs fast lookup of
 * parameter/filter tokens for popular extension URL tracking rules.
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

    function createNode() {
        return {
            next: Object.create(null),
            values: []
        };
    }

    class LinkumoriBidiTrie {
        constructor() {
            this.root = createNode();
        }

        add(token, value) {
            const normalized = String(token || '').toLowerCase();
            if (!normalized) return false;

            let node = this.root;
            for (let i = 0; i < normalized.length; i++) {
                const ch = normalized.charAt(i);
                if (!node.next[ch]) {
                    node.next[ch] = createNode();
                }
                node = node.next[ch];
            }

            node.values.push(value);
            return true;
        }

        get(token) {
            const normalized = String(token || '').toLowerCase();
            if (!normalized) return [];

            let node = this.root;
            for (let i = 0; i < normalized.length; i++) {
                node = node.next[normalized.charAt(i)];
                if (!node) return [];
            }

            return node.values;
        }

        collectTokensFromText(text) {
            const found = [];
            const seen = new Set();
            const source = String(text || '').toLowerCase();

            for (let start = 0; start < source.length; start++) {
                let node = this.root;
                for (let i = start; i < source.length; i++) {
                    node = node.next[source.charAt(i)];
                    if (!node) break;
                    if (node.values.length > 0) {
                        node.values.forEach(value => {
                            if (seen.has(value)) return;
                            seen.add(value);
                            found.push(value);
                        });
                    }
                }
            }

            return found;
        }
    }

    globalThis.LinkumoriBidiTrie = LinkumoriBidiTrie;
})();
