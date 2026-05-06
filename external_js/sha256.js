/*
 * ============================================================
 * Linkumori — Minimal SHA-256 Implementation
 * ============================================================
 *
 * THIRD-PARTY ATTRIBUTION — js-sha256 v0.11.1 (MIT License)
 * -------------------------------------------------------------
 * Source:     https://github.com/emn178/js-sha256
 * Copyright:  (c) 2014–2025 Chen, Yi-Cyuan
 *
 * Permission is hereby granted, free of charge, to any person
 * obtaining a copy of this software and associated documentation
 * files (the "Software"), to deal in the Software without
 * restriction, including without limitation the rights to use,
 * copy, modify, merge, publish, distribute, sublicense, and/or
 * sell copies of the Software, and to permit persons to whom the
 * Software is furnished to do so, subject to the following
 * conditions:
 *
 * The above copyright notice and this permission notice shall be
 * included in all copies or substantial portions of the Software.
 *
 * THE SOFTWARE IS PROVIDED "AS IS", WITHOUT WARRANTY OF ANY KIND,
 * EXPRESS OR IMPLIED, INCLUDING BUT NOT LIMITED TO THE WARRANTIES
 * OF MERCHANTABILITY, FITNESS FOR A PARTICULAR PURPOSE AND
 * NONINFRINGEMENT. IN NO EVENT SHALL THE AUTHORS OR COPYRIGHT
 * HOLDERS BE LIABLE FOR ANY CLAIM, DAMAGES OR OTHER LIABILITY,
 * WHETHER IN AN ACTION OF CONTRACT, TORT OR OTHERWISE, ARISING
 * FROM, OUT OF OR IN CONNECTION WITH THE SOFTWARE OR THE USE OR
 * OTHER DEALINGS IN THE SOFTWARE.
 *
 * ============================================================
 * Linkumori Modifications
 * ============================================================
 * Copyright (c) 2025 Subham Mahesh (modified portions only)
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
 * - Minimal implementation retaining only sha256() for storage.js
 * - Adapted for use in Linkumori
 *
 * ============================================================
 * MODIFICATION HISTORY
 * ============================================================
 * 2025-06-14   Subham Mahesh   First modification
 * 2025-08-21   Subham Mahesh   Second modification
 * 2025-09-05   Subham Mahesh   Third modification
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

    // SHA-256 constants
    const K = [
        0x428a2f98, 0x71374491, 0xb5c0fbcf, 0xe9b5dba5, 0x3956c25b, 0x59f111f1, 0x923f82a4, 0xab1c5ed5,
        0xd807aa98, 0x12835b01, 0x243185be, 0x550c7dc3, 0x72be5d74, 0x80deb1fe, 0x9bdc06a7, 0xc19bf174,
        0xe49b69c1, 0xefbe4786, 0x0fc19dc6, 0x240ca1cc, 0x2de92c6f, 0x4a7484aa, 0x5cb0a9dc, 0x76f988da,
        0x983e5152, 0xa831c66d, 0xb00327c8, 0xbf597fc7, 0xc6e00bf3, 0xd5a79147, 0x06ca6351, 0x14292967,
        0x27b70a85, 0x2e1b2138, 0x4d2c6dfc, 0x53380d13, 0x650a7354, 0x766a0abb, 0x81c2c92e, 0x92722c85,
        0xa2bfe8a1, 0xa81a664b, 0xc24b8b70, 0xc76c51a3, 0xd192e819, 0xd6990624, 0xf40e3585, 0x106aa070,
        0x19a4c116, 0x1e376c08, 0x2748774c, 0x34b0bcb5, 0x391c0cb3, 0x4ed8aa4a, 0x5b9cca4f, 0x682e6ff3,
        0x748f82ee, 0x78a5636f, 0x84c87814, 0x8cc70208, 0x90befffa, 0xa4506ceb, 0xbef9a3f7, 0xc67178f2
    ];

    // Initial hash values
    const H = [
        0x6a09e667, 0xbb67ae85, 0x3c6ef372, 0xa54ff53a,
        0x510e527f, 0x9b05688c, 0x1f83d9ab, 0x5be0cd19
    ];

    // Utility functions
    function rotr(n, x) {
        return (x >>> n) | (x << (32 - n));
    }

    function ch(x, y, z) {
        return (x & y) ^ (~x & z);
    }

    function maj(x, y, z) {
        return (x & y) ^ (x & z) ^ (y & z);
    }

    function sigma0(x) {
        return rotr(2, x) ^ rotr(13, x) ^ rotr(22, x);
    }

    function sigma1(x) {
        return rotr(6, x) ^ rotr(11, x) ^ rotr(25, x);
    }

    function gamma0(x) {
        return rotr(7, x) ^ rotr(18, x) ^ (x >>> 3);
    }

    function gamma1(x) {
        return rotr(17, x) ^ rotr(19, x) ^ (x >>> 10);
    }

    // Convert string to UTF-8 bytes
    function stringToBytes(str) {
        const bytes = [];
        for (let i = 0; i < str.length; i++) {
            const code = str.charCodeAt(i);
            if (code < 0x80) {
                bytes.push(code);
            } else if (code < 0x800) {
                bytes.push(0xc0 | (code >> 6));
                bytes.push(0x80 | (code & 0x3f));
            } else if (code < 0xd800 || code >= 0xe000) {
                bytes.push(0xe0 | (code >> 12));
                bytes.push(0x80 | ((code >> 6) & 0x3f));
                bytes.push(0x80 | (code & 0x3f));
            } else {
                // Surrogate pair
                i++;
                const hi = code;
                const lo = str.charCodeAt(i);
                const codePoint = 0x10000 + (((hi & 0x3ff) << 10) | (lo & 0x3ff));
                bytes.push(0xf0 | (codePoint >> 18));
                bytes.push(0x80 | ((codePoint >> 12) & 0x3f));
                bytes.push(0x80 | ((codePoint >> 6) & 0x3f));
                bytes.push(0x80 | (codePoint & 0x3f));
            }
        }
        return bytes;
    }

    /**
     * Simple SHA-256 hash function
     * @param {string} input - String to hash
     * @returns {string} - Hex hash
     */
    function sha256(input) {
        if (typeof input !== 'string') {
            throw new Error('Input must be a string');
        }

        const bytes = stringToBytes(input);
        const bitLength = bytes.length * 8;
        
        // Add padding
        bytes.push(0x80);
        while (bytes.length % 64 !== 56) {
            bytes.push(0);
        }
        
        // Append length as 64-bit big-endian
        for (let i = 7; i >= 0; i--) {
            bytes.push((bitLength >>> (i * 8)) & 0xff);
        }

        // Initialize hash values
        let h = [...H];

        // Process blocks
        for (let blockStart = 0; blockStart < bytes.length; blockStart += 64) {
            const w = new Array(64);
            
            // Copy block into message schedule
            for (let i = 0; i < 16; i++) {
                const offset = blockStart + i * 4;
                w[i] = (bytes[offset] << 24) |
                       (bytes[offset + 1] << 16) |
                       (bytes[offset + 2] << 8) |
                       bytes[offset + 3];
            }

            // Extend message schedule
            for (let i = 16; i < 64; i++) {
                w[i] = (gamma1(w[i - 2]) + w[i - 7] + gamma0(w[i - 15]) + w[i - 16]) >>> 0;
            }

            // Initialize working variables
            let [a, b, c, d, e, f, g, h_temp] = h;

            // Compression
            for (let i = 0; i < 64; i++) {
                const t1 = (h_temp + sigma1(e) + ch(e, f, g) + K[i] + w[i]) >>> 0;
                const t2 = (sigma0(a) + maj(a, b, c)) >>> 0;
                h_temp = g;
                g = f;
                f = e;
                e = (d + t1) >>> 0;
                d = c;
                c = b;
                b = a;
                a = (t1 + t2) >>> 0;
            }

            // Add to hash
            h[0] = (h[0] + a) >>> 0;
            h[1] = (h[1] + b) >>> 0;
            h[2] = (h[2] + c) >>> 0;
            h[3] = (h[3] + d) >>> 0;
            h[4] = (h[4] + e) >>> 0;
            h[5] = (h[5] + f) >>> 0;
            h[6] = (h[6] + g) >>> 0;
            h[7] = (h[7] + h_temp) >>> 0;
        }

        // Convert to hex
        return h.map(val => val.toString(16).padStart(8, '0')).join('');
    }

    // Export
    if (typeof module !== 'undefined' && module.exports) {
        module.exports = sha256;
    } else if (typeof window !== 'undefined') {
        window.sha256 = sha256;
    } else if (typeof self !== 'undefined') {
        self.sha256 = sha256;
    }

    return sha256;
})();