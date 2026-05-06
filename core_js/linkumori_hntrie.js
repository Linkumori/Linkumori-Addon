/*
 * ============================================================
 * Linkumori — Hostname Trie
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
 * Linkumori hostname trie
 *
 * Stores hostnames reversed by label, so subdomain matching is cheap:
 * example.com matches example.com, www.example.com, and a.b.example.com.
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

    function normalizeHostname(hostname) {
        return String(hostname || '')
            .toLowerCase()
            .replace(/^\|\|/, '')
            .replace(/^\*\./, '')
            .replace(/\^$/, '')
            .replace(/\.$/, '')
            .trim();
    }

    class LinkumoriHNTrie {
        constructor() {
            this.root = createNode();
        }

        add(hostname, value) {
            const normalized = normalizeHostname(hostname);
            if (!normalized) return false;

            const labels = normalized.split('.').filter(Boolean).reverse();
            let node = this.root;

            labels.forEach(label => {
                if (!node.next[label]) {
                    node.next[label] = createNode();
                }
                node = node.next[label];
            });

            node.values.push(value);
            return true;
        }

        matches(hostname) {
            const normalized = normalizeHostname(hostname);
            if (!normalized) return [];

            const labels = normalized.split('.').filter(Boolean).reverse();
            const found = [];
            let node = this.root;

            for (let i = 0; i < labels.length; i++) {
                node = node.next[labels[i]];
                if (!node) break;
                if (node.values.length > 0) {
                    found.push(...node.values);
                }
            }

            return found;
        }
    }

    globalThis.LinkumoriHNTrie = LinkumoriHNTrie;
})();
