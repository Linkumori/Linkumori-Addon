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
            edges: Object.create(null),
            values: []
        };
    }

    function createEdge(label, node) {
        return { label, node };
    }

    function commonPrefixLength(left, right) {
        const limit = Math.min(left.length, right.length);
        let index = 0;
        while (index < limit && left.charCodeAt(index) === right.charCodeAt(index)) {
            index += 1;
        }
        return index;
    }

    function addValue(values, value) {
        if (!values.includes(value)) {
            values.push(value);
        }
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

    function reverseHostname(hostname) {
        return hostname.split('').reverse().join('');
    }

    class LinkumoriHNTrie {
        constructor() {
            this.root = createNode();
            this.packed = null;
        }

        add(hostname, value) {
            const normalized = normalizeHostname(hostname);
            if (!normalized) return false;
            this.packed = null;

            const reversed = reverseHostname(normalized);
            let node = this.root;
            let offset = 0;

            while (offset < reversed.length) {
                const key = reversed.charAt(offset);
                const edge = node.edges[key];
                const remaining = reversed.slice(offset);

                if (!edge) {
                    const child = createNode();
                    addValue(child.values, value);
                    node.edges[key] = createEdge(remaining, child);
                    return true;
                }

                const shared = commonPrefixLength(edge.label, remaining);
                if (shared === edge.label.length) {
                    node = edge.node;
                    offset += shared;
                    continue;
                }

                const split = createNode();
                const oldSuffix = edge.label.slice(shared);
                split.edges[oldSuffix.charAt(0)] = createEdge(oldSuffix, edge.node);

                edge.label = edge.label.slice(0, shared);
                edge.node = split;

                const newSuffix = remaining.slice(shared);
                if (!newSuffix) {
                    addValue(split.values, value);
                } else {
                    const child = createNode();
                    addValue(child.values, value);
                    split.edges[newSuffix.charAt(0)] = createEdge(newSuffix, child);
                }
                return true;
            }

            addValue(node.values, value);
            return true;
        }

        matches(hostname) {
            const normalized = normalizeHostname(hostname);
            if (!normalized) return [];
            if (this.packed) {
                return this.matchesPacked(normalized);
            }

            const reversed = reverseHostname(normalized);
            const found = [];
            let node = this.root;
            let offset = 0;

            while (offset < reversed.length) {
                const edge = node.edges[reversed.charAt(offset)];
                if (!edge || !reversed.startsWith(edge.label, offset)) {
                    break;
                }

                offset += edge.label.length;
                node = edge.node;
                if (node.values.length > 0) {
                    const next = reversed.charAt(offset);
                    if (!next || next === '.') {
                        found.push(...node.values);
                    }
                }
            }

            return found;
        }

        optimize() {
            const nodes = [];
            const edges = [];
            const values = [];

            const visit = (node) => {
                const index = nodes.length;
                const record = {
                    edgeStart: 0,
                    edgeCount: 0,
                    valueStart: values.length,
                    valueCount: node.values.length
                };
                nodes.push(record);
                values.push(...node.values);

                const packedEdges = Object.keys(node.edges).sort().map(key => {
                    const edge = node.edges[key];
                    const childIndex = visit(edge.node);
                    return {
                        first: key,
                        label: edge.label,
                        node: childIndex
                    };
                });
                record.edgeStart = edges.length;
                record.edgeCount = packedEdges.length;
                edges.push(...packedEdges);
                return index;
            };

            visit(this.root);
            this.packed = { nodes, edges, values };
            return this.toSelfie();
        }

        toSelfie() {
            return this.packed;
        }

        toCompressedSelfie() {
            if (!globalThis.LinkumoriLZ4 || typeof globalThis.LinkumoriLZ4.compress !== 'function') {
                return null;
            }
            const selfie = this.packed || this.optimize();
            return globalThis.LinkumoriLZ4.compress(JSON.stringify(selfie));
        }

        fromSelfie(selfie) {
            if (
                !selfie ||
                !Array.isArray(selfie.nodes) ||
                !Array.isArray(selfie.edges) ||
                !Array.isArray(selfie.values)
            ) {
                return false;
            }
            this.packed = selfie;
            return true;
        }

        fromCompressedSelfie(payload) {
            if (
                !globalThis.LinkumoriLZ4 ||
                typeof globalThis.LinkumoriLZ4.decompressToString !== 'function'
            ) {
                return false;
            }
            try {
                return this.fromSelfie(JSON.parse(globalThis.LinkumoriLZ4.decompressToString(payload)));
            } catch (e) {
                return false;
            }
        }

        matchesPacked(hostname) {
            const packed = this.packed;
            const reversed = reverseHostname(hostname);
            const found = [];
            let nodeIndex = 0;
            let offset = 0;

            while (offset < reversed.length) {
                const node = packed.nodes[nodeIndex];
                if (!node) break;

                let matchedEdge = null;
                for (let i = 0; i < node.edgeCount; i++) {
                    const edge = packed.edges[node.edgeStart + i];
                    if (
                        edge &&
                        edge.first === reversed.charAt(offset) &&
                        reversed.startsWith(edge.label, offset)
                    ) {
                        matchedEdge = edge;
                        break;
                    }
                }
                if (!matchedEdge) break;

                offset += matchedEdge.label.length;
                nodeIndex = matchedEdge.node;
                const nextNode = packed.nodes[nodeIndex];
                if (!nextNode || nextNode.valueCount === 0) continue;

                const next = reversed.charAt(offset);
                if (!next || next === '.') {
                    for (let i = 0; i < nextNode.valueCount; i++) {
                        found.push(packed.values[nextNode.valueStart + i]);
                    }
                }
            }

            return found;
        }
    }

    globalThis.LinkumoriHNTrie = LinkumoriHNTrie;
})();
