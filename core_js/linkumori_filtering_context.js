/*
 * ============================================================
 * Linkumori — Filtering Context
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
 * MERCHANTABILITY or FITNESS FOR A PARTICULAR PURPOSE. See the GNU
 * Lesser General Public License for more details.
 *
 * You should have received a copy of the GNU Lesser General Public
 * License along with this program. If not, see
 * <http://www.gnu.org/licenses/>.
 *
 * DESCRIPTION
 * -----------
 * Centralized request context for Linkumori URL-filter interoperability.
 * Keeps per-request normalized values and fast bitmasks for request methods
 * and resource types.
 * ============================================================
 * MODIFICATION HISTORY
 * ============================================================
 * 2026-04-27   Subham Mahesh   File created
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
(function() {
    'use strict';

    const RESOURCE_TYPE_BITS = Object.freeze({
        main_frame: 1 << 0,
        sub_frame: 1 << 1,
        script: 1 << 2,
        stylesheet: 1 << 3,
        image: 1 << 4,
        media: 1 << 5,
        font: 1 << 6,
        object: 1 << 7,
        xmlhttprequest: 1 << 8,
        websocket: 1 << 9,
        ping: 1 << 10,
        other: 1 << 11
    });

    const METHOD_BITS = Object.freeze({
        GET: 1 << 0,
        HEAD: 1 << 1,
        OPTIONS: 1 << 2,
        POST: 1 << 3,
        PUT: 1 << 4,
        PATCH: 1 << 5,
        DELETE: 1 << 6,
        CONNECT: 1 << 7
    });

    const DEFAULT_METHOD_MASK =
        METHOD_BITS.GET |
        METHOD_BITS.HEAD |
        METHOD_BITS.OPTIONS;

    function normalizeHostname(value) {
        return String(value || '').toLowerCase().replace(/\.$/, '').trim();
    }

    function getHostname(url) {
        const source = String(url || '');
        const schemeIndex = source.indexOf('://');
        if (schemeIndex === -1) return '';

        let start = schemeIndex + 3;
        const end = source.length;
        const atIndex = source.indexOf('@', start);
        const firstPathIndex = source.slice(start).search(/[/?#]/);
        const authorityEnd = firstPathIndex === -1 ? end : start + firstPathIndex;
        if (atIndex !== -1 && atIndex < authorityEnd) {
            start = atIndex + 1;
        }

        let hostEnd = authorityEnd;
        if (source.charAt(start) === '[') {
            const bracketEnd = source.indexOf(']', start + 1);
            if (bracketEnd !== -1 && bracketEnd < authorityEnd) {
                hostEnd = bracketEnd + 1;
            }
        } else {
            const colonIndex = source.indexOf(':', start);
            if (colonIndex !== -1 && colonIndex < authorityEnd) {
                hostEnd = colonIndex;
            }
        }

        return normalizeHostname(source.slice(start, hostEnd));
    }

    function collectUniqueHostnames(urls) {
        const hosts = [];
        urls.forEach((url) => {
            const host = typeof url === 'string' ? getHostname(url) : '';
            if (host && !hosts.includes(host)) {
                hosts.push(host);
            }
        });
        return hosts;
    }

    class LinkumoriFilteringContext {
        constructor(fullUrl, request = null, registrableDomainResolver = null) {
            this.fullUrl = fullUrl;
            this.request = request;
            this.targetHost = getHostname(fullUrl);
            this.requestMethod = request && typeof request.method === 'string'
                ? request.method.toUpperCase()
                : '';
            this.requestType = request && typeof request.type === 'string'
                ? request.type
                : '';
            this.requestMethodBit = LinkumoriFilteringContext.getMethodBit(this.requestMethod);
            this.requestTypeBit = LinkumoriFilteringContext.getResourceTypeBit(this.requestType);
            this.appName = normalizeHostname(request && typeof request.appName === 'string' ? request.appName : '');
            this.sourceHosts = collectUniqueHostnames([
                request && request.initiator,
                request && request.originUrl,
                request && request.documentUrl
            ]);
            this.domainModifierHosts = collectUniqueHostnames([
                request && request.initiator,
                request && request.originUrl,
                request && request.documentUrl,
                request && request.url,
                fullUrl
            ]);
            this._registrableDomainResolver = typeof registrableDomainResolver === 'function'
                ? registrableDomainResolver
                : null;
            this._registrableDomainCache = Object.create(null);
        }

        registrableDomain(hostname) {
            const normalized = normalizeHostname(hostname);
            if (!normalized) return '';
            if (!this._registrableDomainCache[normalized]) {
                this._registrableDomainCache[normalized] = this._registrableDomainResolver
                    ? this._registrableDomainResolver(normalized)
                    : normalized;
            }
            return this._registrableDomainCache[normalized];
        }

        static getMethodBit(methodName) {
            return METHOD_BITS[String(methodName || '').toUpperCase()] || 0;
        }

        static getResourceTypeBit(resourceType) {
            return RESOURCE_TYPE_BITS[String(resourceType || '').toLowerCase()] || 0;
        }

        static buildMask(values, bitGetter) {
            return (Array.isArray(values) ? values : []).reduce((mask, value) => {
                return mask | bitGetter(value);
            }, 0);
        }

        static create(fullUrl, request = null, registrableDomainResolver = null) {
            return new LinkumoriFilteringContext(fullUrl, request, registrableDomainResolver);
        }
    }

    LinkumoriFilteringContext.RESOURCE_TYPE_BITS = RESOURCE_TYPE_BITS;
    LinkumoriFilteringContext.METHOD_BITS = METHOD_BITS;
    LinkumoriFilteringContext.DEFAULT_METHOD_MASK = DEFAULT_METHOD_MASK;
    LinkumoriFilteringContext.normalizeHostname = normalizeHostname;
    LinkumoriFilteringContext.getHostname = getHostname;

    globalThis.LinkumoriFilteringContext = LinkumoriFilteringContext;
})();
