/*
 * ============================================================
 * Linkumori — Minimal Punycode Implementation
 * ============================================================
 *
 * THIRD-PARTY ATTRIBUTION — punycode.js v2.3.1 (MIT License)
 * -------------------------------------------------------------
 * Source:     https://github.com/mathiasbynens/punycode.js
 * Copyright:  Mathias Bynens <https://mathiasbynens.be/>
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
 * - Minimal implementation retaining only toASCII() and toUnicode()
 * - Removed unused features: encode, decode, ucs2, version
 * - Adapted for use in Linkumori settings.js
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
'use strict';

// Punycode algorithm constants (RFC 3492)
const BASE = 36;
const T_MIN = 1;
const T_MAX = 26;
const SKEW = 38;
const DAMP = 700;
const INITIAL_BIAS = 72;
const INITIAL_N = 128;
const DELIMITER = '-';
const MAX_INT = 2147483647;

// Regular expressions for domain processing
const PUNYCODE_PREFIX = /^xn--/;
const NON_ASCII = /[^\0-\x7F]/;
const DOMAIN_SEPARATORS = /[\x2E\u3002\uFF0E\uFF61]/g;

// Error handling
function punycodeError(type) {
    const messages = {
        'overflow': 'Overflow: input needs wider integers to process',
        'not-basic': 'Illegal input >= 0x80 (not a basic code point)',
        'invalid-input': 'Invalid input'
    };
    throw new RangeError(messages[type]);
}

// Convert string to Unicode code points (handles surrogate pairs)
function stringToCodePoints(string) {
    const result = [];
    let i = 0;
    const length = string.length;
    
    while (i < length) {
        const value = string.charCodeAt(i++);
        if (value >= 0xD800 && value <= 0xDBFF && i < length) {
            // High surrogate
            const extra = string.charCodeAt(i++);
            if ((extra & 0xFC00) === 0xDC00) {
                // Low surrogate - combine into full code point
                result.push(((value & 0x3FF) << 10) + (extra & 0x3FF) + 0x10000);
            } else {
                // Unpaired surrogate
                result.push(value);
                i--;
            }
        } else {
            result.push(value);
        }
    }
    return result;
}

// Convert code point to digit (0-35)
function basicToDigit(codePoint) {
    if (codePoint >= 0x30 && codePoint < 0x3A) return 26 + (codePoint - 0x30); // 0-9
    if (codePoint >= 0x41 && codePoint < 0x5B) return codePoint - 0x41;        // A-Z
    if (codePoint >= 0x61 && codePoint < 0x7B) return codePoint - 0x61;        // a-z
    return BASE;
}

// Convert digit to code point
function digitToBasic(digit, flag) {
    // 0-25 → a-z or A-Z, 26-35 → 0-9
    return digit + 22 + 75 * (digit < 26) - ((flag !== 0) << 5);
}

// Bias adaptation algorithm
function adaptBias(delta, numPoints, firstTime) {
    let k = 0;
    delta = firstTime ? Math.floor(delta / DAMP) : delta >> 1;
    delta += Math.floor(delta / numPoints);
    
    const baseMinusTMin = BASE - T_MIN;
    while (delta > baseMinusTMin * T_MAX >> 1) {
        delta = Math.floor(delta / baseMinusTMin);
        k += BASE;
    }
    
    return Math.floor(k + (baseMinusTMin + 1) * delta / (delta + SKEW));
}

// Decode punycode string to Unicode
function decode(input) {
    const output = [];
    const inputLength = input.length;
    let i = 0;
    let n = INITIAL_N;
    let bias = INITIAL_BIAS;

    // Find last delimiter and copy basic code points
    let basic = input.lastIndexOf(DELIMITER);
    if (basic < 0) basic = 0;

    for (let j = 0; j < basic; j++) {
        if (input.charCodeAt(j) >= 0x80) {
            punycodeError('not-basic');
        }
        output.push(input.charCodeAt(j));
    }

    // Main decoding loop
    for (let index = basic > 0 ? basic + 1 : 0; index < inputLength;) {
        const oldi = i;
        
        for (let w = 1, k = BASE; ; k += BASE) {
            if (index >= inputLength) punycodeError('invalid-input');
            
            const digit = basicToDigit(input.charCodeAt(index++));
            if (digit >= BASE) punycodeError('invalid-input');
            if (digit > Math.floor((MAX_INT - i) / w)) punycodeError('overflow');
            
            i += digit * w;
            const t = k <= bias ? T_MIN : (k >= bias + T_MAX ? T_MAX : k - bias);
            
            if (digit < t) break;
            
            const baseMinusT = BASE - t;
            if (w > Math.floor(MAX_INT / baseMinusT)) punycodeError('overflow');
            w *= baseMinusT;
        }

        const out = output.length + 1;
        bias = adaptBias(i - oldi, out, oldi === 0);

        if (Math.floor(i / out) > MAX_INT - n) punycodeError('overflow');
        n += Math.floor(i / out);
        i %= out;

        output.splice(i++, 0, n);
    }

    return String.fromCodePoint(...output);
}

// Encode Unicode string to punycode
function encode(input) {
    const output = [];
    input = stringToCodePoints(input);
    const inputLength = input.length;

    let n = INITIAL_N;
    let delta = 0;
    let bias = INITIAL_BIAS;

    // Handle basic code points
    for (const codePoint of input) {
        if (codePoint < 0x80) {
            output.push(String.fromCharCode(codePoint));
        }
    }

    const basicLength = output.length;
    let handledCPCount = basicLength;

    if (basicLength) output.push(DELIMITER);

    // Main encoding loop
    while (handledCPCount < inputLength) {
        let m = MAX_INT;
        for (const codePoint of input) {
            if (codePoint >= n && codePoint < m) {
                m = codePoint;
            }
        }

        const handledCPCountPlusOne = handledCPCount + 1;
        if (m - n > Math.floor((MAX_INT - delta) / handledCPCountPlusOne)) {
            punycodeError('overflow');
        }

        delta += (m - n) * handledCPCountPlusOne;
        n = m;

        for (const codePoint of input) {
            if (codePoint < n && ++delta > MAX_INT) {
                punycodeError('overflow');
            }
            
            if (codePoint === n) {
                let q = delta;
                for (let k = BASE; ; k += BASE) {
                    const t = k <= bias ? T_MIN : (k >= bias + T_MAX ? T_MAX : k - bias);
                    if (q < t) break;
                    
                    const qMinusT = q - t;
                    const baseMinusT = BASE - t;
                    output.push(String.fromCharCode(digitToBasic(t + qMinusT % baseMinusT, 0)));
                    q = Math.floor(qMinusT / baseMinusT);
                }

                output.push(String.fromCharCode(digitToBasic(q, 0)));
                bias = adaptBias(delta, handledCPCountPlusOne, handledCPCount === basicLength);
                delta = 0;
                ++handledCPCount;
            }
        }

        ++delta;
        ++n;
    }
    
    return output.join('');
}

// Process domains (handles email addresses and domain separators)
function mapDomain(domain, callback) {
    const parts = domain.split('@');
    let result = '';
    
    if (parts.length > 1) {
        // Keep email local part intact
        result = parts[0] + '@';
        domain = parts[1];
    }
    
    // Normalize domain separators to dots
    domain = domain.replace(DOMAIN_SEPARATORS, '.');
    const labels = domain.split('.');
    const encoded = labels.map(callback).join('.');
    
    return result + encoded;
}

// Convert Unicode domain to ASCII (main function used by settings.js)
function toASCII(input) {
    return mapDomain(input, function(string) {
        return NON_ASCII.test(string) ? 'xn--' + encode(string) : string;
    });
}

// Convert punycode domain to Unicode (main function used by settings.js)  
function toUnicode(input) {
    return mapDomain(input, function(string) {
        return PUNYCODE_PREFIX.test(string) 
            ? decode(string.slice(4).toLowerCase()) 
            : string;
    });
}

// Expose the minimal API as a global for legacy/background scripts.
const punycodeApi = { toASCII, toUnicode };

if (typeof globalThis !== 'undefined') {
    globalThis.punycode = punycodeApi;
}

// Keep CommonJS compatibility for tooling/tests.
if (typeof module !== 'undefined' && module.exports) {
    module.exports = punycodeApi;
}
