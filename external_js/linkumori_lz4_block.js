/*
 *
 * Stores data as:
 *   magic "LKZ4" + version byte + original length uint32-le + raw LZ4 block
/*
 * ============================================================
 * Linkumori
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
 * ============================================================
 * MODIFICATION HISTORY
 * ============================================================
 * 2026-05-01  Subham Mahesh   First modification

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
(function (root) {
    'use strict';

    const MAGIC = [0x4c, 0x4b, 0x5a, 0x34]; // LKZ4
    const VERSION = 1;
    const MIN_MATCH = 4;
    const MAX_OFFSET = 0xffff;

    function utf8Encode(text) {
        if (typeof TextEncoder !== 'undefined') {
            return new TextEncoder().encode(String(text || ''));
        }
        return Buffer.from(String(text || ''), 'utf8');
    }

    function utf8Decode(bytes) {
        if (typeof TextDecoder !== 'undefined') {
            return new TextDecoder('utf-8').decode(bytes);
        }
        return Buffer.from(bytes).toString('utf8');
    }

    function hash4(input, index) {
        return (
            input[index] |
            (input[index + 1] << 8) |
            (input[index + 2] << 16) |
            (input[index + 3] << 24)
        ) >>> 0;
    }

    function pushLength(output, length) {
        while (length >= 255) {
            output.push(255);
            length -= 255;
        }
        output.push(length);
    }

    function emitSequence(output, input, anchor, literalLength, offset, matchLength) {
        const tokenIndex = output.length;
        const matchTokenLength = Math.max(0, matchLength - MIN_MATCH);
        output.push(
            (Math.min(literalLength, 15) << 4) |
            Math.min(matchTokenLength, 15)
        );

        if (literalLength >= 15) {
            pushLength(output, literalLength - 15);
        }

        for (let i = 0; i < literalLength; i++) {
            output.push(input[anchor + i]);
        }

        if (!offset) return;

        output.push(offset & 0xff, (offset >>> 8) & 0xff);
        if (matchTokenLength >= 15) {
            pushLength(output, matchTokenLength - 15);
        }

        return tokenIndex;
    }

    function compressBlock(input) {
        input = input instanceof Uint8Array ? input : new Uint8Array(input || 0);
        const length = input.length;
        const output = [];

        if (length < MIN_MATCH) {
            emitSequence(output, input, 0, length, 0, 0);
            return new Uint8Array(output);
        }

        const table = new Map();
        let anchor = 0;
        let index = 0;

        while (index <= length - MIN_MATCH) {
            const key = hash4(input, index);
            const ref = table.get(key);
            table.set(key, index);

            if (
                ref !== undefined &&
                index - ref <= MAX_OFFSET &&
                input[ref] === input[index] &&
                input[ref + 1] === input[index + 1] &&
                input[ref + 2] === input[index + 2] &&
                input[ref + 3] === input[index + 3]
            ) {
                let matchLength = MIN_MATCH;
                while (
                    index + matchLength < length &&
                    input[ref + matchLength] === input[index + matchLength]
                ) {
                    matchLength++;
                }

                emitSequence(output, input, anchor, index - anchor, index - ref, matchLength);
                index += matchLength;
                anchor = index;
                continue;
            }

            index++;
        }

        if (anchor < length) {
            emitSequence(output, input, anchor, length - anchor, 0, 0);
        }

        return new Uint8Array(output);
    }

    function decompressBlock(input, outputLength) {
        input = input instanceof Uint8Array ? input : new Uint8Array(input || 0);
        const output = new Uint8Array(outputLength);
        let inputIndex = 0;
        let outputIndex = 0;

        while (inputIndex < input.length) {
            const token = input[inputIndex++];
            let literalLength = token >>> 4;
            if (literalLength === 15) {
                let value;
                do {
                    if (inputIndex >= input.length) throw new Error('Invalid LZ4 literal length');
                    value = input[inputIndex++];
                    literalLength += value;
                } while (value === 255);
            }

            if (inputIndex + literalLength > input.length || outputIndex + literalLength > output.length) {
                throw new Error('Invalid LZ4 literal copy');
            }

            output.set(input.subarray(inputIndex, inputIndex + literalLength), outputIndex);
            inputIndex += literalLength;
            outputIndex += literalLength;

            if (inputIndex >= input.length) break;
            if (inputIndex + 2 > input.length) throw new Error('Invalid LZ4 offset');

            const offset = input[inputIndex] | (input[inputIndex + 1] << 8);
            inputIndex += 2;
            if (offset === 0 || offset > outputIndex) throw new Error('Invalid LZ4 match offset');

            let matchLength = token & 15;
            if (matchLength === 15) {
                let value;
                do {
                    if (inputIndex >= input.length) throw new Error('Invalid LZ4 match length');
                    value = input[inputIndex++];
                    matchLength += value;
                } while (value === 255);
            }
            matchLength += MIN_MATCH;

            if (outputIndex + matchLength > output.length) {
                throw new Error('Invalid LZ4 match copy');
            }

            for (let i = 0; i < matchLength; i++) {
                output[outputIndex + i] = output[outputIndex - offset + i];
            }
            outputIndex += matchLength;
        }

        if (outputIndex !== output.length) {
            throw new Error('Invalid LZ4 output length');
        }

        return output;
    }

    function wrapBlock(block, originalLength) {
        const output = new Uint8Array(9 + block.length);
        output.set(MAGIC, 0);
        output[4] = VERSION;
        output[5] = originalLength & 0xff;
        output[6] = (originalLength >>> 8) & 0xff;
        output[7] = (originalLength >>> 16) & 0xff;
        output[8] = (originalLength >>> 24) & 0xff;
        output.set(block, 9);
        return output;
    }

    function unwrapBlock(input) {
        input = input instanceof Uint8Array ? input : new Uint8Array(input || 0);
        if (
            input.length < 9 ||
            input[0] !== MAGIC[0] ||
            input[1] !== MAGIC[1] ||
            input[2] !== MAGIC[2] ||
            input[3] !== MAGIC[3]
        ) {
            throw new Error('Invalid Linkumori LZ4 payload');
        }
        if (input[4] !== VERSION) {
            throw new Error('Unsupported Linkumori LZ4 version');
        }
        const originalLength = (
            input[5] |
            (input[6] << 8) |
            (input[7] << 16) |
            (input[8] << 24)
        ) >>> 0;

        return {
            originalLength,
            block: input.subarray(9)
        };
    }

    function compress(input) {
        const bytes = typeof input === 'string' ? utf8Encode(input) : new Uint8Array(input || 0);
        return wrapBlock(compressBlock(bytes), bytes.length);
    }

    function decompress(input) {
        const payload = unwrapBlock(input);
        return decompressBlock(payload.block, payload.originalLength);
    }

    function decompressToString(input) {
        return utf8Decode(decompress(input));
    }

    const api = {
        compress,
        decompress,
        decompressToString,
        compressBlock,
        decompressBlock
    };

    root.LinkumoriLZ4 = api;
    if (typeof module !== 'undefined' && module.exports) {
        module.exports = api;
    }
}(typeof globalThis !== 'undefined' ? globalThis : this));
