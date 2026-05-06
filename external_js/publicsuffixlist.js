/*
 * ============================================================
 * publicsuffixlist.js
 * ============================================================
 *
 * THIRD-PARTY ATTRIBUTION — publicsuffixlist.js (Dual License)
 * -------------------------------------------------------------
 * An efficient JavaScript implementation for Mozilla Foundation's
 * Public Suffix List <http://publicsuffix.org/list/>
 *
 * Source:     https://github.com/gorhill/publicsuffixlist.js
 * Copyright:  (c) 2013–present Raymond Hill
 *
 * License (upstream dual license — pick one):
 *   GPL v3  — <https://www.gnu.org/licenses/gpl.html>
 *   APL v2  — <http://www.apache.org/licenses/LICENSE-2.0>
 *
 * For Linkumori distribution and compliance tracking, Linkumori
 * complies with the Apache License 2.0 option of the upstream
 * dual license for this file.
 *
 * ============================================================
 * Linkumori Modifications
 * ============================================================
 * Copyright (c) 2026 Subham Mahesh (modified portions only)
 *
 * Modified portions are licensed under the GNU Lesser General
 * Public License as published by the Free Software Foundation,
 * either version 3 of the License, or (at your option) any
 * later version.
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
 * MODIFICATIONS
 * -------------
 * - Removed optional WebAssembly acceleration code and related
 *   state/methods (enableWASM, disableWASM, _wasmMemory,
 *   _wasmPromise, _getPublicSuffixPosWASM), keeping a JS-only
 *   implementation
 * - Simplified buffer allocation to use standard JavaScript typed
 *   arrays only, with no WASM memory growth path
 * - Retained core PSL parsing/matching behavior while adapting
 *   for Linkumori runtime integration and maintenance
 * - Added tldts-inspired fast-path and caching optimizations for
 *   common lookups
 *
 * ============================================================
 * MODIFICATION HISTORY
 * ============================================================
 * 2026-01-25   Subham Mahesh   First modification
 * 2026-02-22   Subham Mahesh   Fast-path and caching optimizations
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

/* jshint
    browser: true,
    eqeqeq: true,
    esversion: 11,
    laxbreak: true,
    module: true,
    node: true,
    strict: global,
    undef: true
*/

/* globals
    exports: true,
    module
*/

'use strict';

                                    // i32 /  i8
const HOSTNAME_SLOT         = 0;    // jshint ignore:line
const LABEL_INDICES_SLOT    = 256;  //  -- / 256 (256/2 => 128 labels max)
const RULES_PTR_SLOT        = 100;  // 100 / 400 (400-256=144 => 144>128)
const SUFFIX_NOT_FOUND_SLOT = 399;  //  -- / 399 (safe, see above)
const CHARDATA_PTR_SLOT     = 101;  // 101 / 404
const EMPTY_STRING          = '';
const SELFIE_MAGIC          = 2;
const LINKUMORI_HOST_CACHE_LIMIT = 2048;
const LINKUMORI_MISS = Object.freeze({ miss: true });
const LINKUMORI_PATTERN_WINDOW = 128;
const LINKUMORI_PATTERN_QUEUE_SIZE = 64;
const LINKUMORI_PATTERN_SAMPLE_MASK = 255; // sample 1 / 256 lookups

/******************************************************************************/

class PublicSuffixList {
    constructor() {
        this.version = '3.0';

        this._pslBuffer32 = null;
        this._pslBuffer8 = null;
        this._pslByteLength = 0;
        this._hostnameArg = EMPTY_STRING;
        this._lastLookupHostname = null;
        this._lastLookupResult = null;

        this._getPublicSuffixPos = this._getPublicSuffixPosJS;
    }

    /**************************************************************************/

    _allocateBuffers(byteLength) {
        this._pslByteLength = byteLength + 3 & ~3;
        if (
            this._pslBuffer32 !== null &&
            this._pslBuffer32.byteLength >= this._pslByteLength
        ) {
            return;
        }
        this._pslBuffer8 = new Uint8Array(this._pslByteLength);
        this._pslBuffer32 = new Uint32Array(this._pslBuffer8.buffer);
        this._hostnameArg = EMPTY_STRING;
        this._lastLookupHostname = null;
        this._lastLookupResult = null;
        this._pslBuffer8[LABEL_INDICES_SLOT] = 0;
    }

    /**************************************************************************/

    // Parse and set a UTF-8 text-based suffix list. Format is same as found at:
    // http://publicsuffix.org/list/
    //
    // `toAscii` is a converter from unicode to punycode. Required since the
    // Public Suffix List contains unicode characters.
    // Suggestion: use <https://github.com/bestiejs/punycode.js>

    parse(text, toAscii) {
        // Use short property names for better minifying results
        const rootRule = {
            l: EMPTY_STRING,    // l => label
            f: 0,               // f => flags
            c: null             // c => children
        };

        // Tree building
        {
            const compareLabels = function(a, b) {
                let n = a.length;
                let d = n - b.length;
                if ( d !== 0 ) { return d; }
                for ( let i = 0; i < n; i++ ) {
                    d = a.charCodeAt(i) - b.charCodeAt(i);
                    if ( d !== 0 ) { return d; }
                }
                return 0;
            };

            const addToTree = function(rule, exception) {
                let node = rootRule;
                let end = rule.length;
                while ( end > 0 ) {
                    const beg = rule.lastIndexOf('.', end - 1);
                    const label = rule.slice(beg + 1, end);
                    end = beg;

                    if ( Array.isArray(node.c) === false ) {
                        const child = { l: label, f: 0, c: null };
                        node.c = [ child ];
                        node = child;
                        continue;
                    }

                    let left = 0;
                    let right = node.c.length;
                    while ( left < right ) {
                        const i = left + right >>> 1;
                        const d = compareLabels(label, node.c[i].l);
                        if ( d < 0 ) {
                            right = i;
                            if ( right === left ) {
                                const child = {
                                    l: label,
                                    f: 0,
                                    c: null
                                };
                                node.c.splice(left, 0, child);
                                node = child;
                                break;
                            }
                            continue;
                        }
                        if ( d > 0 ) {
                            left = i + 1;
                            if ( left === right ) {
                                const child = {
                                    l: label,
                                    f: 0,
                                    c: null
                                };
                                node.c.splice(right, 0, child);
                                node = child;
                                break;
                            }
                            continue;
                        }
                        /* d === 0 */
                        node = node.c[i];
                        break;
                    }
                }
                node.f |= 0b01;
                if ( exception ) {
                    node.f |= 0b10;
                }
            };

            // 2. If no rules match, the prevailing rule is "*".
            addToTree('*', false);

            const mustPunycode = /[^*a-z0-9.-]/;
            const textEnd = text.length;
            let lineBeg = 0;

            while ( lineBeg < textEnd ) {
                let lineEnd = text.indexOf('\n', lineBeg);
                if ( lineEnd === -1 ) {
                    lineEnd = text.indexOf('\r', lineBeg);
                    if ( lineEnd === -1 ) {
                        lineEnd = textEnd;
                    }
                }
                let line = text.slice(lineBeg, lineEnd);
                lineBeg = lineEnd + 1;

                // Ignore comments
                const pos = line.indexOf('//');
                if ( pos !== -1 ) {
                    line = line.slice(0, pos);
                }

                // Ignore surrounding whitespaces
                line = line.trim();

                const exception = line.length > 0 && line.charCodeAt(0) === 0x21 /* '!' */;
                if ( exception ) {
                    line = line.slice(1);
                }

                if ( line.length === 0 ) { continue; }

                if ( mustPunycode.test(line) ) {
                    line = toAscii(line.toLowerCase());
                }

                // https://en.wikipedia.org/wiki/Hostname#Syntax
                if ( line.length > 253 ) { continue; }

                addToTree(line, exception);
            }
        }

        {
            const labelToOffsetMap = new Map();
            const treeData = [];
            const charData = [];

            const allocate = function(n) {
                const ibuf = treeData.length;
                for ( let i = 0; i < n; i++ ) {
                    treeData.push(0);
                }
                return ibuf;
            };

            const storeNode = function(ibuf, node) {
                const nChars = node.l.length;
                const nChildren = node.c !== null
                    ? node.c.length
                    : 0;
                treeData[ibuf+0] = nChildren << 16 | node.f << 8 | nChars;
                // char data
                if ( nChars <= 4 ) {
                    let v = 0;
                    if ( nChars > 0 ) {
                        v |= node.l.charCodeAt(0);
                        if ( nChars > 1 ) {
                            v |= node.l.charCodeAt(1) << 8;
                            if ( nChars > 2 ) {
                                v |= node.l.charCodeAt(2) << 16;
                                if ( nChars > 3 ) {
                                    v |= node.l.charCodeAt(3) << 24;
                                }
                            }
                        }
                    }
                    treeData[ibuf+1] = v;
                } else {
                    let offset = labelToOffsetMap.get(node.l);
                    if ( typeof offset === 'undefined' ) {
                        offset = charData.length;
                        for ( let i = 0; i < nChars; i++ ) {
                            charData.push(node.l.charCodeAt(i));
                        }
                        labelToOffsetMap.set(node.l, offset);
                    }
                    treeData[ibuf+1] = offset;
                }
                // child nodes
                if ( Array.isArray(node.c) === false ) {
                    treeData[ibuf+2] = 0;
                    return;
                }

                const iarray = allocate(nChildren * 3);
                treeData[ibuf+2] = iarray;
                for ( let i = 0; i < nChildren; i++ ) {
                    storeNode(iarray + i * 3, node.c[i]);
                }
            };

            // First 512 bytes are reserved for internal use
            allocate(512 >> 2);

            const iRootRule = allocate(3);
            storeNode(iRootRule, rootRule);
            treeData[RULES_PTR_SLOT] = iRootRule;

            const iCharData = treeData.length << 2;
            treeData[CHARDATA_PTR_SLOT] = iCharData;

            const byteLength = (treeData.length << 2) + (charData.length + 3 & ~3);
            this._allocateBuffers(byteLength);
            this._pslBuffer32.set(treeData);
            this._pslBuffer8.set(charData, treeData.length << 2);
            this._lastLookupHostname = null;
            this._lastLookupResult = null;
        }
    }

    /**************************************************************************/

    _setHostnameArg(hostname) {
        const buf = this._pslBuffer8;
        if ( hostname === this._hostnameArg ) { return buf[LABEL_INDICES_SLOT]; }
        if ( hostname === null || hostname.length === 0 ) {
            this._hostnameArg = EMPTY_STRING;
            return (buf[LABEL_INDICES_SLOT] = 0);
        }
        hostname = hostname.toLowerCase();
        this._hostnameArg = hostname;
        let n = hostname.length;
        if ( n > 255 ) { n = 255; }
        buf[LABEL_INDICES_SLOT] = n;
        let i = n;
        let j = LABEL_INDICES_SLOT + 1;
        while ( i-- ) {
            const c = hostname.charCodeAt(i);
            if ( c === 0x2E /* '.' */ ) {
                buf[j+0] = i + 1;
                buf[j+1] = i;
                j += 2;
            }
            buf[i] = c;
        }
        buf[j] = 0;
        return n;
    }

    /**************************************************************************/

    // Returns an offset to the start of the public suffix.
    //
    // WASM-able, because no information outside the buffer content is required.

    _getPublicSuffixPosJS() {
        const buf8 = this._pslBuffer8;
        const buf32 = this._pslBuffer32;
        const iCharData = buf32[CHARDATA_PTR_SLOT];

        let iNode = this._pslBuffer32[RULES_PTR_SLOT];
        let cursorPos = -1;
        let iLabel = LABEL_INDICES_SLOT;

        // Label-lookup loop
        for (;;) {
            // Extract label indices
            const labelBeg = buf8[iLabel+1];
            const labelLen = buf8[iLabel+0] - labelBeg;
            // Match-lookup loop: binary search
            let r = buf32[iNode+0] >>> 16;
            if ( r === 0 ) { break; }
            const iCandidates = buf32[iNode+2];
            let l = 0;
            let iFound = 0;
            while ( l < r ) {
                const iCandidate = l + r >>> 1;
                const iCandidateNode = iCandidates + iCandidate + (iCandidate << 1);
                const candidateLen = buf32[iCandidateNode+0] & 0x000000FF;
                let d = labelLen - candidateLen;
                if ( d === 0 ) {
                    const iCandidateChar = candidateLen <= 4
                        ? iCandidateNode + 1 << 2
                        : iCharData + buf32[iCandidateNode+1];
                    for ( let i = 0; i < labelLen; i++ ) {
                        d = buf8[labelBeg+i] - buf8[iCandidateChar+i];
                        if ( d !== 0 ) { break; }
                    }
                }
                if ( d < 0 ) {
                    r = iCandidate;
                } else if ( d > 0 ) {
                    l = iCandidate + 1;
                } else /* if ( d === 0 ) */ {
                    iFound = iCandidateNode;
                    break;
                }
            }
            // 2. If no rules match, the prevailing rule is "*".
            if ( iFound === 0 ) {
                if ( buf32[iCandidates + 1] !== 0x2A /* '*' */ ) { break; }
                buf8[SUFFIX_NOT_FOUND_SLOT] = 1;
                iFound = iCandidates;
            }
            iNode = iFound;
            // 5. If the prevailing rule is a exception rule, modify it by
            //    removing the leftmost label.
            if ( (buf32[iNode+0] & 0x00000200) !== 0 ) {
                if ( iLabel > LABEL_INDICES_SLOT ) {
                    return iLabel - 2;
                }
                break;
            }
            if ( (buf32[iNode+0] & 0x00000100) !== 0 ) {
                cursorPos = iLabel;
            }
            if ( labelBeg === 0 ) { break; }
            iLabel += 2;
        }

        return cursorPos;
    }

    /**************************************************************************/

    _fastPathLookup(hostname) {
        const len = hostname.length;
        if (len <= 3) return null;

        // Safe fast path adapted from tldts:
        // only for exactly one-dot hostnames to avoid private suffix mismatches.
        let dotCount = 0;
        for (let i = 0; i < len; i++) {
            if (hostname.charCodeAt(i) === 46 /* '.' */) {
                dotCount += 1;
                if (dotCount > 1) return null;
            }
        }
        if (dotCount !== 1) return null;

        const last = len - 1;
        const c3 = hostname.charCodeAt(last);
        const c2 = hostname.charCodeAt(last - 1);
        const c1 = hostname.charCodeAt(last - 2);
        const c0 = hostname.charCodeAt(last - 3);

        if (c3 === 109 && c2 === 111 && c1 === 99 && c0 === 46) return { publicSuffix: 'com', domain: hostname };
        if (c3 === 103 && c2 === 114 && c1 === 111 && c0 === 46) return { publicSuffix: 'org', domain: hostname };
        if (c3 === 117 && c2 === 100 && c1 === 101 && c0 === 46) return { publicSuffix: 'edu', domain: hostname };
        if (c3 === 118 && c2 === 111 && c1 === 103 && c0 === 46) return { publicSuffix: 'gov', domain: hostname };
        if (c3 === 116 && c2 === 101 && c1 === 110 && c0 === 46) return { publicSuffix: 'net', domain: hostname };

        if (len >= 3) {
            const d2 = hostname.charCodeAt(last);
            const d1 = hostname.charCodeAt(last - 1);
            const d0 = hostname.charCodeAt(last - 2);
            if (d2 === 101 && d1 === 100 && d0 === 46) return { publicSuffix: 'de', domain: hostname };
        }

        return null;
    }

    _lookup(hostname) {
        if ( this._pslBuffer32 === null ) { return { publicSuffix: EMPTY_STRING, domain: EMPTY_STRING }; }
        if ( hostname === this._lastLookupHostname && this._lastLookupResult !== null ) {
            return this._lastLookupResult;
        }

        const fast = this._fastPathLookup(hostname);
        if (fast !== null) {
            this._lastLookupHostname = hostname;
            this._lastLookupResult = fast;
            return fast;
        }

        const hostnameLen = this._setHostnameArg(hostname);
        const buf8 = this._pslBuffer8;
        if ( hostnameLen === 0 || buf8[0] === 0x2E /* '.' */ ) {
            const empty = { publicSuffix: EMPTY_STRING, domain: EMPTY_STRING };
            this._lastLookupHostname = this._hostnameArg;
            this._lastLookupResult = empty;
            return empty;
        }

        const cursorPos = this._getPublicSuffixPos();
        if ( cursorPos === -1 ) {
            const miss = { publicSuffix: EMPTY_STRING, domain: EMPTY_STRING };
            this._lastLookupHostname = this._hostnameArg;
            this._lastLookupResult = miss;
            return miss;
        }

        const beg = buf8[cursorPos + 1];
        const publicSuffix = beg === 0 ? this._hostnameArg : this._hostnameArg.slice(beg);
        const domain = beg === 0
            ? EMPTY_STRING
            : ((buf8[cursorPos + 3] === 0) ? this._hostnameArg : this._hostnameArg.slice(buf8[cursorPos + 3]));

        const result = { publicSuffix, domain };
        this._lastLookupHostname = this._hostnameArg;
        this._lastLookupResult = result;
        return result;
    }

    /**************************************************************************/

    getPublicSuffix(hostname) {
        return this._lookup(hostname).publicSuffix;
    }

    /**************************************************************************/

    getDomain(hostname) {
        return this._lookup(hostname).domain;
    }

    /**************************************************************************/

    suffixInPSL(hostname) {
        if ( this._pslBuffer32 === null ) { return false; }

        const hostnameLen = this._setHostnameArg(hostname);
        const buf8 = this._pslBuffer8;
        if ( hostnameLen === 0 || buf8[0] === 0x2E /* '.' */ ) {
            return false;
        }

        buf8[SUFFIX_NOT_FOUND_SLOT] = 0;
        const cursorPos = this._getPublicSuffixPos();
        return cursorPos !== -1 &&
               buf8[cursorPos + 1] === 0 &&
               buf8[SUFFIX_NOT_FOUND_SLOT] !== 1;
    }

    /**************************************************************************/

    toSelfie(encoder = null) {
        if ( this._pslBuffer8 === null ) { return ''; }
        if ( encoder !== null ) {
            const bufferStr = encoder.encode(this._pslBuffer8.buffer, this._pslByteLength);
            return `${SELFIE_MAGIC}\t${bufferStr}`;
        }
        return {
            magic: SELFIE_MAGIC,
            buf32: Array.from(
                new Uint32Array(this._pslBuffer8.buffer, 0, this._pslByteLength >>> 2)
            ),
        };
    }

    fromSelfie(selfie, decoder = null) {
        let byteLength = 0;
        if (
            typeof selfie === 'string' &&
            selfie.length !== 0 &&
            decoder !== null
        ) {
            const pos = selfie.indexOf('\t');
            if ( pos === -1 || selfie.slice(0, pos) !== `${SELFIE_MAGIC}` ) {
                return false;
            }
            const bufferStr = selfie.slice(pos + 1);
            byteLength = decoder.decodeSize(bufferStr);
            if ( byteLength === 0 ) { return false; }
            this._allocateBuffers(byteLength);
            decoder.decode(bufferStr, this._pslBuffer8.buffer);
        } else if (
            selfie.magic === SELFIE_MAGIC &&
            Array.isArray(selfie.buf32)
        ) {
            byteLength = selfie.buf32.length << 2;
            this._allocateBuffers(byteLength);
            this._pslBuffer32.set(selfie.buf32);
        } else {
            return false;
        }

        // Important!
        this._hostnameArg = EMPTY_STRING;
        this._lastLookupHostname = null;
        this._lastLookupResult = null;
        this._pslBuffer8[LABEL_INDICES_SLOT] = 0;

        return true;
    }

}

/******************************************************************************/

const publicSuffixListInstance = new PublicSuffixList();

function getPunycodeAPI() {
    if (typeof punycode !== 'undefined' && punycode && typeof punycode.toASCII === 'function') {
        return punycode;
    }
    if (typeof globalThis !== 'undefined' && globalThis.punycode && typeof globalThis.punycode.toASCII === 'function') {
        return globalThis.punycode;
    }
    return null;
}

const linkumoriPsl = {
    status: 'idle',
    parser: publicSuffixListInstance,
    loadPromise: null,
    error: null,
    hostCache: new Map(),
    mapCacheEnabled: false,
    lastHostname: null,
    lastResult: null,
    patternSampleCounter: 0,
    patternWindowSamples: 0,
    patternRepeatSamples: 0,
    patternRecentQueue: [],
    patternRecentCounts: new Map(),

    normalizeHostname(hostname) {
        if (typeof hostname !== 'string') {
            hostname = String(hostname || '');
        }
        let start = 0;
        let end = hostname.length;
        while (start < end && hostname.charCodeAt(start) <= 32) start += 1;
        while (end > start && hostname.charCodeAt(end - 1) <= 32) end -= 1;
        if (start >= end) return null;

        let needsLower = false;
        for (let i = start; i < end; i++) {
            const c = hostname.charCodeAt(i);
            if (c >= 65 && c <= 90) {
                needsLower = true;
                break;
            }
        }

        let value = (start === 0 && end === hostname.length)
            ? hostname
            : hostname.slice(start, end);
        if (needsLower) value = value.toLowerCase();
        if (value.endsWith('.')) value = value.slice(0, -1);
        return value || null;
    },

    isIp(hostname) {
        if (!hostname) return false;
        const firstChar = hostname.charCodeAt(0);
        const startsLikeIpv4 = firstChar >= 48 && firstChar <= 57;
        const startsLikeIpv6 = hostname.startsWith('[');
        // IPv6 can only begin with hex chars a-f/A-F (or digit), so reject
        // common hostname starts without scanning for ':'.
        if (
            !startsLikeIpv4 &&
            !startsLikeIpv6 &&
            ((firstChar >= 103 && firstChar <= 122) || (firstChar >= 71 && firstChar <= 90))
        ) {
            return false;
        }
        if (!startsLikeIpv4 && !startsLikeIpv6 && hostname.indexOf(':') === -1) {
            return false;
        }
        const plain = hostname.startsWith('[') && hostname.endsWith(']')
            ? hostname.slice(1, -1)
            : hostname;

        // IPv4
        const ipv4Parts = plain.split('.');
        if (ipv4Parts.length === 4) {
            let isV4 = true;
            for (let i = 0; i < 4; i++) {
                const part = ipv4Parts[i];
                if (!/^\d+$/.test(part)) { isV4 = false; break; }
                const n = Number(part);
                if (n < 0 || n > 255) { isV4 = false; break; }
            }
            if (isV4) return true;
        }

        // IPv6 (supports compressed forms)
        if (plain.includes(':')) {
            const zoneSplit = plain.split('%');
            const ipv6 = zoneSplit[0];
            const groups = ipv6.split('::');
            if (groups.length > 2) return false;
            const left = groups[0] ? groups[0].split(':').filter(Boolean) : [];
            const right = groups[1] ? groups[1].split(':').filter(Boolean) : [];
            const all = left.concat(right);
            for (let i = 0; i < all.length; i++) {
                if (!/^[0-9a-f]{1,4}$/i.test(all[i])) return false;
            }
            if (groups.length === 1) return all.length === 8;
            return all.length < 8;
        }

        return false;
    },

    isValidHostnameLight(hostname) {
        if (!hostname || hostname.length > 253) return false;
        if (hostname.startsWith('.') || hostname.endsWith('.')) return false;
        const labels = hostname.split('.');
        if (labels.length === 0) return false;
        for (let i = 0; i < labels.length; i++) {
            const label = labels[i];
            if (!label || label.length > 63) return false;
            if (label.startsWith('-') || label.endsWith('-')) return false;
            if (!/^[a-z0-9-]+$/i.test(label)) return false;
        }
        return true;
    },

    extractHostnameFromInput(input, mixedInputs = true) {
        const raw = String(input || '').trim();
        if (!raw) return null;

        const extractByString = (value) => {
            let s = String(value || '').trim();
            if (!s) return null;

            s = s.replace(/^[a-z][a-z0-9+.-]*:\/\//i, '');
            const slash = s.search(/[/?#]/);
            if (slash !== -1) s = s.slice(0, slash);
            if (!s) return null;

            const at = s.lastIndexOf('@');
            if (at !== -1) s = s.slice(at + 1);
            if (!s) return null;

            if (s.startsWith('[')) {
                const close = s.indexOf(']');
                return close !== -1 ? s.slice(0, close + 1) : s;
            }

            const firstColon = s.indexOf(':');
            const lastColon = s.lastIndexOf(':');
            if (firstColon !== -1 && firstColon === lastColon) {
                s = s.slice(0, firstColon);
            }
            return s || null;
        };

        if (!mixedInputs) {
            if (typeof URL === 'function') {
                try {
                    return new URL(raw).hostname || null;
                } catch (e) {
                    return extractByString(raw);
                }
            }
            return extractByString(raw);
        }

        // Fast-path: already looks like hostname (no scheme/path/query/auth).
        if (!/[/?#@\s]/.test(raw) && !raw.includes('://')) {
            return raw;
        }

        if (typeof URL === 'function') {
            try {
                return new URL(raw).hostname || null;
            } catch (e) {
                // Retry by assuming scheme-less URL.
                try {
                    return new URL('http://' + raw).hostname || null;
                } catch (e2) {
                    return extractByString(raw);
                }
            }
        }

        return extractByString(raw);
    },



    emptyResult() {
        return { hostname: null, tld: null, domain: null, subdomain: null, listed: false };
    },

    resetRuntimeCaches() {
        this.hostCache.clear();
        this.lastHostname = null;
        this.lastResult = null;
        this.mapCacheEnabled = false;
        this.patternSampleCounter = 0;
        this.patternWindowSamples = 0;
        this.patternRepeatSamples = 0;
        this.patternRecentQueue.length = 0;
        this.patternRecentCounts.clear();
    },

    touchPattern(hostname) {
        this.patternSampleCounter += 1;
        if ((this.patternSampleCounter & LINKUMORI_PATTERN_SAMPLE_MASK) !== 0) return;

        this.patternWindowSamples += 1;
        const count = this.patternRecentCounts.get(hostname) || 0;
        if (count > 0) {
            this.patternRepeatSamples += 1;
        }
        this.patternRecentCounts.set(hostname, count + 1);
        this.patternRecentQueue.push(hostname);

        if (this.patternRecentQueue.length > LINKUMORI_PATTERN_QUEUE_SIZE) {
            const oldest = this.patternRecentQueue.shift();
            const oldestCount = this.patternRecentCounts.get(oldest) || 0;
            if (oldestCount <= 1) this.patternRecentCounts.delete(oldest);
            else this.patternRecentCounts.set(oldest, oldestCount - 1);
        }

        if (this.patternWindowSamples >= LINKUMORI_PATTERN_WINDOW) {
            const ratio = this.patternRepeatSamples / this.patternWindowSamples;
            if (!this.mapCacheEnabled && ratio >= 0.06) {
                this.mapCacheEnabled = true;
            } else if (this.mapCacheEnabled && ratio < 0.02) {
                this.mapCacheEnabled = false;
                this.hostCache.clear();
            }
            this.patternWindowSamples = 0;
            this.patternRepeatSamples = 0;
        }
    },

    cacheSet(hostname, value) {
        if (!this.mapCacheEnabled) return;
        this.hostCache.set(hostname, value);
        if (this.hostCache.size > LINKUMORI_HOST_CACHE_LIMIT) {
            const first = this.hostCache.keys().next();
            if (!first.done) this.hostCache.delete(first.value);
        }
    },

    isCacheableHost(hostname) {
        const firstDot = hostname.indexOf('.');
        if (firstDot === -1) return false;
        return hostname.indexOf('.', firstDot + 1) !== -1;
    },

    lookupNormalized(hostname) {
        if (this.status !== 'ready' || !this.parser || !hostname) return null;

        if (hostname === this.lastHostname) {
            return this.lastResult === LINKUMORI_MISS ? null : this.lastResult;
        }

        const raw = typeof this.parser._lookup === 'function'
            ? this.parser._lookup(hostname)
            : { publicSuffix: this.parser.getPublicSuffix(hostname), domain: this.parser.getDomain(hostname) };

        const tld = raw && raw.publicSuffix ? raw.publicSuffix : null;
        if (!tld) {
            this.lastHostname = hostname;
            this.lastResult = LINKUMORI_MISS;
            return null;
        }

        const domain = raw.domain || null;
        let subdomain = null;
        if (domain) {
            const hostLen = hostname.length;
            const domainLen = domain.length;
            if (
                hostLen > domainLen &&
                hostname.charCodeAt(hostLen - domainLen - 1) === 46 &&
                hostname.endsWith(domain)
            ) {
                subdomain = hostname.slice(0, hostLen - domainLen - 1) || null;
            }
        }

        const result = { hostname, tld, domain, subdomain, listed: true };
        this.lastHostname = hostname;
        this.lastResult = result;
        return result;
    },

    lookup(hostnameInput) {
        const hostname = this.normalizeHostname(hostnameInput);
        return this.lookupNormalized(hostname);
    },

    normalizeHostnameNoExtract(input) {
        if (typeof input === 'string') {
            const len = input.length;
            if (len === 0) return null;

            let start = 0;
            let end = len;
            while (start < end && input.charCodeAt(start) <= 32) start += 1;
            while (end > start && input.charCodeAt(end - 1) <= 32) end -= 1;
            if (start >= end) return null;

            let value = input;
            if (start !== 0 || end !== len) {
                value = input.slice(start, end);
            }

            if (value.endsWith('.')) {
                value = value.slice(0, -1);
            }
            if (!value) return null;

            // Fast-path: if already lowercase ASCII hostname-ish string, avoid
            // the extra scan in normalizeHostname().
            let needsNormalize = false;
            for (let i = 0; i < value.length; i++) {
                const c = value.charCodeAt(i);
                if (c >= 65 && c <= 90) {
                    needsNormalize = true;
                    break;
                }
            }
            return needsNormalize ? this.normalizeHostname(value) : value;
        }
        return this.normalizeHostname(input);
    },

    parseNormalizedHostname(hostname) {
        if (this.status !== 'ready' || !this.parser || !hostname) {
            return this.emptyResult();
        }

        const raw = typeof this.parser._lookup === 'function'
            ? this.parser._lookup(hostname)
            : { publicSuffix: this.parser.getPublicSuffix(hostname), domain: this.parser.getDomain(hostname) };

        const suffix = raw && raw.publicSuffix ? raw.publicSuffix : null;
        if (!suffix) {
            return { hostname, listed: false };
        }

        const domain = raw.domain || null;
        const hostnameLen = hostname.length;
        const domainLen = domain ? domain.length : 0;
        let subdomain = null;
        if (domainLen > 0 && hostnameLen > domainLen &&
            hostname.charCodeAt(hostnameLen - domainLen - 1) === 46 &&
            hostname.endsWith(domain)
        ) {
            subdomain = hostname.slice(0, hostnameLen - domainLen - 1) || null;
        }

        return { hostname, tld: suffix, domain, subdomain, listed: true };
    },

    parse(input, options = {}) {
        const extractHostname = options.extractHostname !== false;
        const mixedInputs = options.mixedInputs !== false;
        const detectIp = options.detectIp !== false;
        const validateHostname = options.validateHostname !== false;
        if (this.status !== 'ready' || !this.parser) return this.emptyResult();

        // Fast path for Linkumori clearurls usage:
        // parse(hostname, { extractHostname:false, mixedInputs:false, detectIp:true,
        // validateHostname:false })
        if (
            extractHostname === false &&
            validateHostname === false &&
            detectIp === true
        ) {
            const hostnameFast = this.normalizeHostnameNoExtract(input);
            if (!hostnameFast) return this.emptyResult();

            if (this.isIp(hostnameFast)) {
                return { hostname: hostnameFast, tld: null, domain: null, subdomain: null, listed: false };
            }

            return this.parseNormalizedHostname(hostnameFast);
        }

        let extracted;
        if (extractHostname) {
            extracted = this.extractHostnameFromInput(input, mixedInputs);
        } else if (typeof input === 'string') {
            extracted = input;
        } else {
            extracted = String(input || '');
        }

        const hostname = this.normalizeHostname(extracted);
        if (!hostname) return this.emptyResult();

        if (detectIp && this.isIp(hostname)) {
            return { hostname, tld: null, domain: null, subdomain: null, listed: false };
        }

        if (validateHostname && !this.isValidHostnameLight(hostname)) {
            return this.emptyResult();
        }

        return this.parseNormalizedHostname(hostname);
    },

    async init({ dataPath = 'data/public_suffix_list.dat', runtimeAPI = browser.runtime, punycodeAPI = null } = {}) {
        if (this.status === 'loading' || this.status === 'ready') {
            return this.loadPromise;
        }

        this.status = 'loading';
        this.loadPromise = (async () => {
            try {
                const runtime = runtimeAPI;
                if (!runtime || typeof runtime.getURL !== 'function' || typeof fetch !== 'function') {
                    throw new Error('PSL module/runtime API unavailable');
                }

                const ascii = punycodeAPI || getPunycodeAPI();
                if (!ascii || typeof ascii.toASCII !== 'function') {
                    throw new Error('punycode.toASCII unavailable from light-punycode.js');
                }

                const response = await fetch(runtime.getURL(dataPath));
                if (!response.ok) {
                    throw new Error(`Unable to load public suffix list data (status ${response.status})`);
                }

                const listText = await response.text();
                const toAscii = (hostnameLabel) => ascii.toASCII(String(hostnameLabel || ''));
                this.parser.parse(listText, toAscii);
                this.resetRuntimeCaches();
                this.status = 'ready';
                this.error = null;
            } catch (e) {
                this.status = 'failed';
                this.error = e;
                throw e;
            }
        })();

        return this.loadPromise;
    }
};

if (typeof globalThis !== 'undefined') {
    globalThis.publicSuffixList = publicSuffixListInstance;
    globalThis.linkumoriPsl = linkumoriPsl;
}

if (typeof module !== 'undefined' && module.exports) {
    module.exports = {
        publicSuffixList: publicSuffixListInstance,
        linkumoriPsl
    };
}

/******************************************************************************/