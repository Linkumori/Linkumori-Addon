/*
 * ============================================================
 * Linkumori — rule format converter
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
 * Reads rule lists written in any of these formats and returns them in the
 * Linkumori format ({ providers: { name: { rules, rawRules, … } } }) that
 * the rest of the add-on uses:
 *
 *   - Linkumori / legacy ClearURLs JSON        → returned unchanged
 *   - ClearURLs new rule format (version: 2)   → converted
 *     https://docs.clearurls.xyz/specs/new-rules
 *   - ClearURLs compiled list format           → converted
 *     https://docs.clearurls.xyz/specs/compiled-lists
 *
 * Text input may be JSON or YAML (the subset the new rule format uses).
 * Linkumori additions (domainPatterns, $removeparam filters, "|" patterns,
 * resourceTypes, historyBypassProtection, …) are accepted inside the
 * ClearURLs formats too; see docs/rule-syntax.md §11.
 *
 * Loaded as a classic script (background, custom rules page) and imported
 * by linkumori-cli-tool.js; both read globalThis.LinkumoriRuleFormats.
 * ============================================================
 */
(function (root) {
    'use strict';

    const RULE_ID_PATTERN = /^[a-z0-9][a-z0-9_-]*$/;
    const PREPROCESSOR_TYPES = ['urlEncode', 'urlDecode', 'doubleUrlEncode', 'doubleUrlDecode', 'base64Encode', 'base64Decode'];
    const RULE_KINDS = ['field', 'raw', 'redirection', 'exception'];
    const ACTION_TYPES = ['remove', 'rewrite', 'redirect'];
    const LEGACY_SECTIONS = ['rules', 'rawRules', 'referralMarketing', 'redirections', 'fieldRedirections', 'exceptions'];
    // Values allowed in a rule's `flags` array (behavior tags). A `flags`
    // string is something else: the rule's regex flags.
    const RULE_BEHAVIOR_FLAGS = ['referralMarketing'];

    // Provider keys Linkumori adds on top of the ClearURLs formats.
    const LINKUMORI_PROVIDER_KEYS = ['domainPatterns', 'indexPattern', 'resourceTypes', 'historyBypassProtection',
        'rawRules', 'referralMarketing', 'redirections', 'fieldRedirections'];
    const V2_PROVIDER_KEYS = ['urlPattern', 'completeProvider', 'forceRedirection', 'methods', 'exceptions', 'rules',
        'active', ...LINKUMORI_PROVIDER_KEYS];
    const COMPILED_PROVIDER_KEYS = ['providerId', 'urlPattern', 'defaultActive', 'completeProvider', 'forceRedirection',
        'methods', 'exceptions', 'rules', ...LINKUMORI_PROVIDER_KEYS];
    const V2_DEFAULT_KEYS = ['active', 'description', 'requestTypes', 'preprocessors', 'exceptions', 'historyBypassProtection'];
    const V2_RULE_KEYS = ['id', 'aliases', 'kind', 'match', 'active', 'description', 'exceptions', 'requestTypes',
        'preprocessors', 'referralMarketing', 'action', 'flags', 'order', 'historyBypassProtection'];
    const COMPILED_RULE_KEYS = ['id', 'aliases', 'kind', 'section', 'match', 'flags', 'order', 'action', 'activeDefault',
        'description', 'exceptions', 'requestTypes', 'preprocessors', 'referralMarketing', 'historyBypassProtection'];

    function isPlainObject(value) {
        return value !== null && typeof value === 'object' && !Array.isArray(value);
    }

    function fail(path, message) {
        throw new Error(path ? `${path}: ${message}` : message);
    }

    function assertKeys(value, allowed, path) {
        Object.keys(value).forEach(key => {
            if (!allowed.includes(key)) fail(path, `unknown key "${key}"`);
        });
    }

    // ------------------------------------------------------------------
    // YAML (the subset rule files need)
    // ------------------------------------------------------------------
    // Block mappings and sequences, flow [ … ] / { … } collections, quoted
    // and plain scalars, "|" and ">" block scalars and comments. Anchors,
    // aliases, tags and multiple documents are rejected rather than guessed.

    function parseYaml(text) {
        const source = String(text || '').replace(/^﻿/, '').replace(/\r\n?/g, '\n');
        const rawLines = source.split('\n');
        const lines = [];
        let started = false;
        for (let i = 0; i < rawLines.length; i++) {
            const raw = rawLines[i];
            const trimmed = raw.trim();
            if (/^---(?:\s|$)/.test(raw)) {
                if (started) fail(`YAML line ${i + 1}`, 'multiple documents are not supported');
                started = true;
                if (trimmed !== '---') fail(`YAML line ${i + 1}`, 'content after "---" is not supported');
                continue;
            }
            if (/^\.\.\.(?:\s|$)/.test(raw)) break;
            started = true;
            const indentMatch = /^[ ]*/.exec(raw);
            const indent = indentMatch[0].length;
            if (raw.charAt(indent) === '\t') fail(`YAML line ${i + 1}`, 'tabs are not allowed for indentation');
            lines.push({ number: i + 1, indent, raw });
        }
        const state = { lines, pos: 0 };
        skipBlank(state);
        if (state.pos >= lines.length) return null;
        const first = lines[state.pos];
        const value = parseBlockNode(state, first.indent, stripComment(first.raw.slice(first.indent)), first);
        skipBlank(state);
        if (state.pos < lines.length) {
            fail(`YAML line ${lines[state.pos].number}`, 'unexpected content (check the indentation)');
        }
        return value;
    }

    function isBlankLine(line) {
        const content = line.raw.slice(line.indent);
        return content === '' || content.charAt(0) === '#';
    }

    function skipBlank(state) {
        while (state.pos < state.lines.length && isBlankLine(state.lines[state.pos])) state.pos++;
    }

    // Removes a trailing "# comment" that sits outside quotes.
    function stripComment(text) {
        let quote = null;
        for (let i = 0; i < text.length; i++) {
            const ch = text.charAt(i);
            if (quote) {
                if (quote === '"' && ch === '\\') { i++; continue; }
                if (ch === quote) {
                    if (quote === "'" && text.charAt(i + 1) === "'") { i++; continue; }
                    quote = null;
                }
                continue;
            }
            if ((ch === '"' || ch === "'") && (i === 0 || /[\s[{,:-]/.test(text.charAt(i - 1)))) { quote = ch; continue; }
            if (ch === '#' && (i === 0 || /\s/.test(text.charAt(i - 1)))) return text.slice(0, i).replace(/\s+$/, '');
        }
        return text.replace(/\s+$/, '');
    }

    // Index of the ":" that ends a mapping key, or -1.
    function findMappingColon(text) {
        let i = 0;
        if (text.charAt(0) === '"' || text.charAt(0) === "'") {
            const quote = text.charAt(0);
            i = 1;
            while (i < text.length) {
                const ch = text.charAt(i);
                if (quote === '"' && ch === '\\') { i += 2; continue; }
                if (ch === quote) {
                    if (quote === "'" && text.charAt(i + 1) === "'") { i += 2; continue; }
                    break;
                }
                i++;
            }
            const rest = text.slice(i + 1);
            const m = /^\s*:(?=\s|$)/.exec(rest);
            return m ? i + 1 + m[0].length - 1 : -1;
        }
        if (text.charAt(0) === '[' || text.charAt(0) === '{') return -1;
        for (; i < text.length; i++) {
            if (text.charAt(i) === ':' && (i + 1 === text.length || text.charAt(i + 1) === ' ')) return i;
        }
        return -1;
    }

    function isSequenceEntry(content) {
        return content === '-' || content.startsWith('- ');
    }

    // Parses the block that starts on the current line, whose content (after
    // `indent` spaces) is `content`.
    function parseBlockNode(state, indent, content, line) {
        if (isSequenceEntry(content)) return parseSequence(state, indent);
        if (findMappingColon(content) !== -1) return parseMapping(state, indent);
        // A lone scalar or flow collection on its own line.
        state.pos++;
        return parseInlineValue(state, content, line, indent);
    }

    function parseSequence(state, indent) {
        const result = [];
        while (true) {
            skipBlank(state);
            if (state.pos >= state.lines.length) break;
            const line = state.lines[state.pos];
            if (line.indent < indent) break;
            if (line.indent > indent) fail(`YAML line ${line.number}`, 'unexpected indentation');
            const content = stripComment(line.raw.slice(line.indent));
            if (!isSequenceEntry(content)) break;
            const rest = content.slice(1).replace(/^ +/, '');
            if (rest === '') {
                state.pos++;
                skipBlank(state);
                const next = state.lines[state.pos];
                if (next && next.indent > indent) {
                    result.push(parseBlockNode(state, next.indent, stripComment(next.raw.slice(next.indent)), next));
                } else {
                    result.push(null);
                }
                continue;
            }
            // "- key: value" opens a mapping whose keys line up with "key".
            const childIndent = line.indent + (content.length - rest.length);
            if (isSequenceEntry(rest) || findMappingColon(rest) !== -1) {
                const virtualRaw = ' '.repeat(childIndent) + rest;
                state.lines[state.pos] = { number: line.number, indent: childIndent, raw: virtualRaw };
                result.push(parseBlockNode(state, childIndent, rest, state.lines[state.pos]));
            } else {
                state.pos++;
                result.push(parseInlineValue(state, rest, line, indent));
            }
        }
        return result;
    }

    function parseMapping(state, indent) {
        const result = {};
        while (true) {
            skipBlank(state);
            if (state.pos >= state.lines.length) break;
            const line = state.lines[state.pos];
            if (line.indent < indent) break;
            if (line.indent > indent) fail(`YAML line ${line.number}`, 'unexpected indentation');
            const content = stripComment(line.raw.slice(line.indent));
            if (isSequenceEntry(content)) break;
            const colon = findMappingColon(content);
            if (colon === -1) fail(`YAML line ${line.number}`, `expected "key: value", got "${content}"`);
            const key = parseKey(content.slice(0, colon).trim(), line);
            if (Object.prototype.hasOwnProperty.call(result, key)) fail(`YAML line ${line.number}`, `duplicate key "${key}"`);
            const rest = content.slice(colon + 1).trim();
            state.pos++;
            if (rest === '') {
                skipBlank(state);
                const next = state.lines[state.pos];
                const nextContent = next ? stripComment(next.raw.slice(next.indent)) : '';
                // Nested block: deeper indentation, or a sequence at the same indentation.
                if (next && (next.indent > indent || (next.indent === indent && isSequenceEntry(nextContent)))) {
                    result[key] = parseBlockNode(state, next.indent, nextContent, next);
                } else {
                    result[key] = null;
                }
            } else {
                result[key] = parseInlineValue(state, rest, line, indent);
            }
        }
        return result;
    }

    function parseKey(text, line) {
        if (text.charAt(0) === '"' || text.charAt(0) === "'") {
            const parsed = readQuoted(text, 0, line);
            if (parsed.end !== text.length) fail(`YAML line ${line.number}`, 'unexpected text after quoted key');
            return parsed.value;
        }
        if (/^[&*!|>%@`]/.test(text) || text.startsWith('? ')) fail(`YAML line ${line.number}`, `unsupported key syntax "${text}"`);
        return text;
    }

    // Value that follows "key:" or "- " on the same line. May continue onto
    // following lines (block scalars, flow collections).
    function parseInlineValue(state, text, line, parentIndent) {
        const first = text.charAt(0);
        if (first === '&' || first === '*' || first === '!') {
            fail(`YAML line ${line.number}`, 'anchors, aliases and tags are not supported');
        }
        if (first === '|' || first === '>') return parseBlockScalar(state, text, line, parentIndent);
        if (first === '[' || first === '{') {
            let flow = text;
            while (!flowIsBalanced(flow)) {
                if (state.pos >= state.lines.length) fail(`YAML line ${line.number}`, `unclosed "${first}"`);
                flow += ' ' + stripComment(state.lines[state.pos].raw.trim());
                state.pos++;
            }
            const parser = { text: flow, pos: 0, line };
            const value = parseFlowValue(parser);
            skipFlowSpace(parser);
            if (parser.pos !== flow.length) fail(`YAML line ${line.number}`, `unexpected text after "${first}…"`);
            return value;
        }
        if (first === '"' || first === "'") {
            const parsed = readQuoted(text, 0, line);
            if (text.slice(parsed.end).trim() !== '') fail(`YAML line ${line.number}`, 'unexpected text after quoted string');
            return parsed.value;
        }
        const next = state.lines[state.pos];
        if (next && !isBlankLine(next) && next.indent > parentIndent &&
            !isSequenceEntry(stripComment(next.raw.slice(next.indent))) &&
            findMappingColon(stripComment(next.raw.slice(next.indent))) === -1) {
            fail(`YAML line ${next.number}`, 'multi-line plain strings are not supported; quote the value');
        }
        if (/:(?:\s|$)/.test(text)) fail(`YAML line ${line.number}`, `"${text}" contains ": "; quote the value`);
        return parsePlainScalar(text);
    }

    function parseBlockScalar(state, header, line, parentIndent) {
        const m = /^([|>])([+-]?)\s*$/.exec(header);
        if (!m) fail(`YAML line ${line.number}`, `unsupported block scalar header "${header}"`);
        const folded = m[1] === '>';
        const chomp = m[2];
        const body = [];
        let blockIndent = -1;
        while (state.pos < state.lines.length) {
            const current = state.lines[state.pos];
            const isEmpty = current.raw.trim() === '';
            if (!isEmpty) {
                if (current.indent <= parentIndent) break;
                if (blockIndent === -1) blockIndent = current.indent;
                if (current.indent < blockIndent) break;
            }
            body.push(isEmpty ? '' : current.raw.slice(blockIndent));
            state.pos++;
        }
        let trailing = 0;
        while (body.length > 0 && body[body.length - 1] === '') { body.pop(); trailing++; }
        let value = folded
            // Folding: a line break becomes a space; each empty line is one newline.
            ? body.reduce((out, part, i) => {
                if (i === 0) return part;
                if (part === '') return out + '\n';
                return out + (body[i - 1] === '' ? '' : ' ') + part;
            }, '')
            : body.join('\n');
        if (chomp === '+') value += '\n'.repeat(trailing + 1);
        else if (chomp !== '-' && body.length > 0) value += '\n';
        return value;
    }

    function flowIsBalanced(text) {
        let depth = 0;
        let quote = null;
        for (let i = 0; i < text.length; i++) {
            const ch = text.charAt(i);
            if (quote) {
                if (quote === '"' && ch === '\\') { i++; continue; }
                if (ch === quote) {
                    if (quote === "'" && text.charAt(i + 1) === "'") { i++; continue; }
                    quote = null;
                }
                continue;
            }
            if (ch === '"' || ch === "'") quote = ch;
            else if (ch === '[' || ch === '{') depth++;
            else if (ch === ']' || ch === '}') depth--;
        }
        return depth <= 0 && !quote;
    }

    function skipFlowSpace(parser) {
        while (parser.pos < parser.text.length && /\s/.test(parser.text.charAt(parser.pos))) parser.pos++;
    }

    function parseFlowValue(parser) {
        skipFlowSpace(parser);
        const ch = parser.text.charAt(parser.pos);
        if (ch === '[') {
            parser.pos++;
            const list = [];
            skipFlowSpace(parser);
            if (parser.text.charAt(parser.pos) === ']') { parser.pos++; return list; }
            while (true) {
                list.push(parseFlowValue(parser));
                skipFlowSpace(parser);
                const sep = parser.text.charAt(parser.pos++);
                if (sep === ']') return list;
                if (sep !== ',') fail(`YAML line ${parser.line.number}`, 'expected "," or "]"');
                skipFlowSpace(parser);
                if (parser.text.charAt(parser.pos) === ']') { parser.pos++; return list; }
            }
        }
        if (ch === '{') {
            parser.pos++;
            const map = {};
            skipFlowSpace(parser);
            if (parser.text.charAt(parser.pos) === '}') { parser.pos++; return map; }
            while (true) {
                skipFlowSpace(parser);
                const key = String(parseFlowScalar(parser, true));
                skipFlowSpace(parser);
                if (parser.text.charAt(parser.pos) !== ':') fail(`YAML line ${parser.line.number}`, 'expected ":" in "{…}"');
                parser.pos++;
                if (Object.prototype.hasOwnProperty.call(map, key)) fail(`YAML line ${parser.line.number}`, `duplicate key "${key}"`);
                map[key] = parseFlowValue(parser);
                skipFlowSpace(parser);
                const sep = parser.text.charAt(parser.pos++);
                if (sep === '}') return map;
                if (sep !== ',') fail(`YAML line ${parser.line.number}`, 'expected "," or "}"');
                skipFlowSpace(parser);
                if (parser.text.charAt(parser.pos) === '}') { parser.pos++; return map; }
            }
        }
        return parseFlowScalar(parser, false);
    }

    function parseFlowScalar(parser, isKey) {
        const ch = parser.text.charAt(parser.pos);
        if (ch === '"' || ch === "'") {
            const parsed = readQuoted(parser.text, parser.pos, parser.line);
            parser.pos = parsed.end;
            return parsed.value;
        }
        const start = parser.pos;
        while (parser.pos < parser.text.length) {
            const c = parser.text.charAt(parser.pos);
            if (c === ',' || c === ']' || c === '}' || c === '[' || c === '{') break;
            if (c === ':' && (isKey || /[\s,\]}]/.test(parser.text.charAt(parser.pos + 1) || ' '))) break;
            parser.pos++;
        }
        const raw = parser.text.slice(start, parser.pos).trim();
        return isKey ? raw : parsePlainScalar(raw);
    }

    function readQuoted(text, start, line) {
        const quote = text.charAt(start);
        let value = '';
        let i = start + 1;
        while (i < text.length) {
            const ch = text.charAt(i);
            if (quote === "'") {
                if (ch === "'") {
                    if (text.charAt(i + 1) === "'") { value += "'"; i += 2; continue; }
                    return { value, end: i + 1 };
                }
                value += ch; i++;
                continue;
            }
            if (ch === '"') return { value, end: i + 1 };
            if (ch !== '\\') { value += ch; i++; continue; }
            const esc = text.charAt(i + 1);
            const simple = { '0': '\0', a: '\x07', b: '\b', t: '\t', n: '\n', v: '\v', f: '\f', r: '\r', e: '\x1b',
                ' ': ' ', '"': '"', '/': '/', '\\': '\\', N: '\x85', _: '\xa0', L: ' ', P: ' ' };
            if (Object.prototype.hasOwnProperty.call(simple, esc)) { value += simple[esc]; i += 2; continue; }
            const width = esc === 'x' ? 2 : esc === 'u' ? 4 : esc === 'U' ? 8 : 0;
            const hex = text.slice(i + 2, i + 2 + width);
            if (!width || !/^[0-9a-fA-F]+$/.test(hex) || hex.length !== width) {
                fail(`YAML line ${line.number}`, `invalid escape "\\${esc}" in double-quoted string (regex backslashes need single quotes or "\\\\")`);
            }
            value += String.fromCodePoint(parseInt(hex, 16));
            i += 2 + width;
        }
        fail(`YAML line ${line.number}`, 'unterminated quoted string');
    }

    function parsePlainScalar(text) {
        const value = text.trim();
        if (value === '' || value === '~' || /^(?:null|Null|NULL)$/.test(value)) return null;
        if (/^(?:true|True|TRUE)$/.test(value)) return true;
        if (/^(?:false|False|FALSE)$/.test(value)) return false;
        if (/^[-+]?(?:0|[1-9][0-9]*)$/.test(value)) return Number(value);
        if (/^[-+]?(?:[0-9]+\.[0-9]*|\.[0-9]+)(?:[eE][-+]?[0-9]+)?$/.test(value)) return Number(value);
        return value;
    }

    // ------------------------------------------------------------------
    // Detection and text parsing
    // ------------------------------------------------------------------

    function detectRuleFormat(data) {
        if (!isPlainObject(data)) return 'unknown';
        if (Array.isArray(data.providers)) return 'clearurls-compiled';
        // Only version 2 and later are ClearURLs new-format files (later ones are
        // then refused); any other "version" is list metadata.
        if (Number(data.version) >= 2) return 'clearurls-v2';
        if (isPlainObject(data.providers)) return 'linkumori';
        return 'unknown';
    }

    // JSON first; anything that is not JSON is read as YAML.
    function parseRuleText(text) {
        const source = String(text || '').replace(/^﻿/, '');
        const trimmed = source.trim();
        if (trimmed.startsWith('{') || trimmed.startsWith('[')) {
            try { return JSON.parse(trimmed); } catch (jsonError) {
                try { return parseYaml(source); } catch (_) { throw new Error(`Invalid JSON: ${jsonError.message}`); }
            }
        }
        return parseYaml(source);
    }

    // ------------------------------------------------------------------
    // Shared rule field helpers
    // ------------------------------------------------------------------

    function readStringList(value, path, label) {
        if (value === undefined || value === null) return [];
        if (!Array.isArray(value) || value.some(item => typeof item !== 'string')) fail(path, `${label} must be a list of strings`);
        return value.slice();
    }

    function readRequestTypes(value, path) {
        if (value === undefined || value === null || value === 'all') return null;
        if (!Array.isArray(value) || value.some(item => typeof item !== 'string' || !item.trim())) {
            fail(path, 'requestTypes must be "all" or a list of request types');
        }
        const types = value.map(item => item.trim().toLowerCase());
        return types.includes('all') ? null : types;
    }

    function readPreprocessors(value, path) {
        if (value === undefined || value === null) return [];
        if (!Array.isArray(value)) fail(path, 'preprocessors must be a list');
        return value.map((item, index) => {
            const itemPath = `${path}.preprocessors[${index}]`;
            if (!isPlainObject(item)) fail(itemPath, 'must be an object with "type" and "inputs"');
            assertKeys(item, ['type', 'inputs'], itemPath);
            if (!PREPROCESSOR_TYPES.includes(item.type)) fail(itemPath, `type must be one of: ${PREPROCESSOR_TYPES.join(', ')}`);
            const inputs = item.inputs === undefined ? 'all' : item.inputs;
            if (inputs !== 'all' && (!Array.isArray(inputs) || inputs.some(n => !Number.isInteger(n) || n < 1))) {
                fail(itemPath, 'inputs must be "all" or a list of capture group numbers (1, 2, …)');
            }
            return { type: item.type, inputs: Array.isArray(inputs) ? inputs.slice() : 'all' };
        });
    }

    function readBoolean(value, path, label) {
        if (value === undefined || value === null) return undefined;
        if (typeof value !== 'boolean') fail(path, `${label} must be true or false`);
        return value;
    }

    function readAction(value, path) {
        if (value === undefined || value === null) return null;
        const action = typeof value === 'string' ? { type: value } : value;
        if (!isPlainObject(action)) fail(path, 'action must be an object like { type: remove }');
        assertKeys(action, ['type', 'replacePattern'], `${path}.action`);
        if (!ACTION_TYPES.includes(action.type)) fail(path, `action.type must be one of: ${ACTION_TYPES.join(', ')}`);
        if (action.replacePattern !== undefined && action.replacePattern !== null && typeof action.replacePattern !== 'string') {
            fail(path, 'action.replacePattern must be a string');
        }
        const replacePattern = typeof action.replacePattern === 'string' ? action.replacePattern : null;
        if (action.type === 'rewrite' && replacePattern === null) fail(path, 'a rewrite action needs a replacePattern');
        if (action.type === 'remove' && replacePattern !== null) fail(path, 'a remove action cannot have a replacePattern');
        return { type: action.type, replacePattern };
    }

    // `flags` is either the regex flags (a string) or behavior tags (a list).
    function readFlags(value, path) {
        if (value === undefined || value === null) return undefined;
        if (typeof value === 'string') return value;
        if (!Array.isArray(value)) fail(path, 'flags must be a string (regex flags) or a list of behavior tags');
        value.forEach(flag => {
            if (!RULE_BEHAVIOR_FLAGS.includes(flag)) fail(path, `unknown flag "${flag}" (known: ${RULE_BEHAVIOR_FLAGS.join(', ')})`);
        });
        return value.slice();
    }

    function readOrder(value, path) {
        if (value === undefined || value === null) return undefined;
        if (typeof value !== 'number' || !Number.isFinite(value)) fail(path, 'order must be a number');
        return value;
    }

    // Which Linkumori list a rule goes into, from its kind and action.
    function resolveSection(kind, actionType, referralMarketing, path) {
        if (referralMarketing && kind !== 'field') fail(path, 'referralMarketing is only allowed on field rules');
        switch (kind) {
            case 'field':
                if (actionType === 'redirect') {
                    if (referralMarketing) fail(path, 'a referralMarketing rule cannot redirect');
                    return 'fieldRedirections';
                }
                return referralMarketing ? 'referralMarketing' : 'rules';
            case 'raw':
                return actionType === 'redirect' ? 'redirections' : 'rawRules';
            case 'redirection':
                if (actionType === 'remove') fail(path, 'redirection rules cannot use a remove action');
                // "rewrite" rebuilds the URL in place instead of redirecting.
                return actionType === 'rewrite' ? 'rawRules' : 'redirections';
            case 'exception':
                if (actionType) fail(path, 'exception rules take no action');
                return 'exceptions';
            default:
                fail(path, `kind must be one of: ${RULE_KINDS.join(', ')}`);
        }
        return null;
    }

    // Tracks rule ids and aliases per provider (they share one namespace).
    function createIdRegistry(path) {
        const seen = new Map();
        return function register(value, label, rulePath) {
            if (!RULE_ID_PATTERN.test(value)) fail(rulePath, `${label} "${value}" must match ${RULE_ID_PATTERN.source}`);
            if (seen.has(value)) fail(rulePath, `${label} "${value}" is already used by ${seen.get(value)} in ${path}`);
            seen.set(value, rulePath);
        };
    }

    function readAliases(value, id, rulePath, registerId) {
        if (value === undefined || value === null) return [];
        if (!Array.isArray(value) || value.some(item => typeof item !== 'string')) fail(rulePath, 'aliases must be a list of rule ids');
        value.forEach(alias => {
            if (alias === id) fail(rulePath, `aliases must not contain the rule's own id "${id}"`);
            registerId(alias, 'alias', rulePath);
        });
        return value.slice();
    }

    // Builds a Linkumori rule object, leaving out anything at its default.
    function buildRuleObject(fields) {
        const rule = {};
        if (fields.id) rule.id = fields.id;
        if (fields.aliases && fields.aliases.length > 0) rule.aliases = fields.aliases;
        rule.matchPattern = fields.matchPattern;
        if (fields.replacePattern !== null && fields.replacePattern !== undefined) rule.replacePattern = fields.replacePattern;
        if (fields.preprocessors && fields.preprocessors.length > 0) rule.preprocessors = fields.preprocessors;
        if (fields.requestTypes) rule.requestTypes = fields.requestTypes;
        if (fields.exceptions && fields.exceptions.length > 0) rule.exceptions = fields.exceptions;
        if (typeof fields.flags === 'string' || Array.isArray(fields.flags)) rule.flags = fields.flags;
        if (typeof fields.order === 'number') rule.order = fields.order;
        if (fields.active === false) rule.active = false;
        if (fields.description) rule.description = fields.description;
        if (typeof fields.historyBypassProtection === 'boolean') rule.historyBypassProtection = fields.historyBypassProtection;
        return rule;
    }

    function isPlainStringRule(rule) {
        return Object.keys(rule).length === 1;
    }

    function pushToSection(provider, section, rule) {
        if (!Array.isArray(provider[section])) provider[section] = [];
        provider[section].push(isPlainStringRule(rule) ? rule.matchPattern : rule);
    }

    // Provider keys shared by the v2 and compiled formats, copied as they are.
    function copyProviderBasics(input, output, path) {
        if (input.urlPattern !== undefined && input.urlPattern !== null) {
            if (typeof input.urlPattern !== 'string') fail(path, 'urlPattern must be a string');
            if (input.urlPattern) output.urlPattern = input.urlPattern;
        }
        if (input.domainPatterns !== undefined && input.domainPatterns !== null) {
            const patterns = typeof input.domainPatterns === 'string' ? [input.domainPatterns]
                : readStringList(input.domainPatterns, path, 'domainPatterns');
            if (patterns.length > 0) output.domainPatterns = patterns;
        }
        if (input.indexPattern !== undefined && input.indexPattern !== null) {
            if (typeof input.indexPattern !== 'string') readStringList(input.indexPattern, path, 'indexPattern');
            output.indexPattern = input.indexPattern;
        }
        if (!output.urlPattern && !output.domainPatterns) fail(path, 'needs a urlPattern (or Linkumori domainPatterns)');
        if (output.urlPattern && output.domainPatterns) fail(path, 'use urlPattern or domainPatterns, not both');
        ['completeProvider', 'forceRedirection', 'historyBypassProtection'].forEach(key => {
            const value = readBoolean(input[key], path, key);
            if (value !== undefined && (value || key === 'historyBypassProtection')) output[key] = value;
        });
        const methods = readStringList(input.methods, path, 'methods').map(m => m.toUpperCase());
        if (methods.length > 0) output.methods = methods;
        const resourceTypes = readStringList(input.resourceTypes, path, 'resourceTypes');
        if (resourceTypes.length > 0) output.resourceTypes = resourceTypes;
        // Linkumori lists (rawRules, redirections, …) are allowed next to the
        // unified "rules" list and keep their usual syntax.
        ['rawRules', 'referralMarketing', 'redirections', 'fieldRedirections'].forEach(section => {
            if (input[section] === undefined || input[section] === null) return;
            if (!Array.isArray(input[section])) fail(path, `${section} must be a list`);
            input[section].forEach(rule => pushToSection(output, section, typeof rule === 'string' ? { matchPattern: rule } : rule));
        });
        if (input.exceptions !== undefined && input.exceptions !== null) {
            if (!Array.isArray(input.exceptions)) fail(path, 'exceptions must be a list');
            input.exceptions.forEach(entry => pushToSection(output, 'exceptions',
                typeof entry === 'string' ? { matchPattern: entry } : entry));
        }
    }

    // ------------------------------------------------------------------
    // ClearURLs new rule format (version 2)
    // ------------------------------------------------------------------

    function readV2Defaults(value) {
        if (value === undefined || value === null) value = {};
        if (!isPlainObject(value)) fail('defaults', 'must be an object');
        assertKeys(value, V2_DEFAULT_KEYS, 'defaults');
        const active = readBoolean(value.active, 'defaults', 'active');
        if (value.description !== undefined && value.description !== null && typeof value.description !== 'string') {
            fail('defaults', 'description must be a string');
        }
        return {
            active: active === undefined ? true : active,
            description: typeof value.description === 'string' ? value.description : '',
            requestTypes: readRequestTypes(value.requestTypes, 'defaults'),
            preprocessors: readPreprocessors(value.preprocessors, 'defaults'),
            exceptions: readStringList(value.exceptions, 'defaults', 'exceptions'),
            historyBypassProtection: readBoolean(value.historyBypassProtection, 'defaults', 'historyBypassProtection')
        };
    }

    function convertV2Rule(entry, defaults, provider, rulePath, registerId) {
        if (typeof entry === 'string') {
            // Short form: a field rule that removes the matched key (or any
            // Linkumori "rules" entry, such as a $removeparam filter).
            if (!entry.trim()) fail(rulePath, 'rule must not be empty');
            pushToSection(provider, 'rules', buildRuleObject({ ...defaults, matchPattern: entry }));
            return;
        }
        if (!isPlainObject(entry)) fail(rulePath, 'rule must be a string or an object');
        if (entry.matchPattern !== undefined) fail(rulePath, 'use "match" instead of "matchPattern" in version 2 rules');
        assertKeys(entry, V2_RULE_KEYS, rulePath);
        if (typeof entry.id !== 'string' || !entry.id) fail(rulePath, 'long-form rules need an id');
        registerId(entry.id, 'id', rulePath);
        const aliases = readAliases(entry.aliases, entry.id, rulePath, registerId);
        if (typeof entry.match !== 'string' || !entry.match) fail(rulePath, 'match must be a non-empty string');
        const kind = entry.kind === undefined || entry.kind === null ? 'field' : entry.kind;
        const action = readAction(entry.action, rulePath);
        const referralMarketing = readBoolean(entry.referralMarketing, rulePath, 'referralMarketing') === true;
        const section = resolveSection(kind, action ? action.type : null, referralMarketing, rulePath);
        const flags = readFlags(entry.flags, rulePath);
        const order = readOrder(entry.order, rulePath);
        if (entry.description !== undefined && entry.description !== null && typeof entry.description !== 'string') {
            fail(rulePath, 'description must be a string');
        }
        const active = readBoolean(entry.active, rulePath, 'active');
        const historyBypassProtection = readBoolean(entry.historyBypassProtection, rulePath, 'historyBypassProtection');
        pushToSection(provider, section, buildRuleObject({
            id: entry.id,
            aliases,
            matchPattern: entry.match,
            replacePattern: action ? action.replacePattern : null,
            preprocessors: entry.preprocessors === undefined ? defaults.preprocessors : readPreprocessors(entry.preprocessors, rulePath),
            requestTypes: entry.requestTypes === undefined ? defaults.requestTypes : readRequestTypes(entry.requestTypes, rulePath),
            exceptions: entry.exceptions === undefined ? defaults.exceptions : readStringList(entry.exceptions, rulePath, 'exceptions'),
            flags,
            order,
            active: active === undefined ? defaults.active : active,
            description: typeof entry.description === 'string' ? entry.description : defaults.description,
            historyBypassProtection: historyBypassProtection === undefined ? defaults.historyBypassProtection : historyBypassProtection
        }));
    }

    function convertV2(data) {
        const version = typeof data.version === 'string' ? Number(data.version) : data.version;
        if (version !== 2) fail('version', `unsupported rule format version "${data.version}" (supported: 2)`);
        assertKeys(data, ['version', 'defaults', 'providers', 'metadata'], '');
        const defaults = readV2Defaults(data.defaults);
        if (!isPlainObject(data.providers)) fail('providers', 'must be a mapping of provider names to providers');
        const providers = {};
        Object.entries(data.providers).forEach(([name, input]) => {
            const path = `providers.${name}`;
            if (!isPlainObject(input)) fail(path, 'must be an object');
            assertKeys(input, V2_PROVIDER_KEYS, path);
            const provider = {};
            copyProviderBasics(input, provider, path);
            if (readBoolean(input.active, path, 'active') === false) provider.active = false;
            if (input.rules !== undefined && input.rules !== null) {
                if (!Array.isArray(input.rules)) fail(path, 'rules must be a list');
                const registerId = createIdRegistry(path);
                input.rules.forEach((entry, index) => convertV2Rule(entry, defaults, provider, `${path}.rules[${index}]`, registerId));
            }
            providers[name] = provider;
        });
        const result = { providers };
        if (isPlainObject(data.metadata)) result.metadata = data.metadata;
        return result;
    }

    // ------------------------------------------------------------------
    // ClearURLs compiled list format
    // ------------------------------------------------------------------

    function convertCompiledRule(entry, provider, rulePath, registerId) {
        if (typeof entry === 'string') {
            pushToSection(provider, 'rules', { matchPattern: entry });
            return;
        }
        if (!isPlainObject(entry)) fail(rulePath, 'rule must be an object');
        assertKeys(entry, COMPILED_RULE_KEYS, rulePath);
        if (typeof entry.id !== 'string' || !entry.id) fail(rulePath, 'id is required');
        registerId(entry.id, 'id', rulePath);
        const aliases = readAliases(entry.aliases, entry.id, rulePath, registerId);
        if (typeof entry.match !== 'string' || !entry.match) fail(rulePath, 'match must be a non-empty string');
        const flags = readFlags(entry.flags, rulePath);
        const order = readOrder(entry.order, rulePath);
        const action = readAction(entry.action, rulePath);
        const referralMarketing = readBoolean(entry.referralMarketing, rulePath, 'referralMarketing') === true;
        let kind = entry.kind;
        if (kind === undefined || kind === null) {
            const bySection = { rules: 'field', referralMarketing: 'field', fieldRedirections: 'field', rawRules: 'raw', redirections: 'redirection', exceptions: 'exception' };
            if (entry.section !== undefined && !LEGACY_SECTIONS.includes(entry.section)) {
                fail(rulePath, `section must be one of: ${LEGACY_SECTIONS.join(', ')}`);
            }
            kind = bySection[entry.section] || 'field';
        }
        let actionType = kind === 'exception' && action && action.type === 'remove' ? null : (action ? action.type : null);
        // A field rule listed under section "fieldRedirections" redirects even without an explicit action.
        if (entry.section === 'fieldRedirections' && kind === 'field' && actionType === null) actionType = 'redirect';
        const section = resolveSection(kind, actionType, referralMarketing || entry.section === 'referralMarketing', rulePath);
        const active = readBoolean(entry.activeDefault, rulePath, 'activeDefault');
        pushToSection(provider, section, buildRuleObject({
            id: entry.id,
            aliases,
            matchPattern: entry.match,
            replacePattern: action ? action.replacePattern : null,
            preprocessors: readPreprocessors(entry.preprocessors, rulePath),
            requestTypes: readRequestTypes(entry.requestTypes, rulePath),
            exceptions: readStringList(entry.exceptions, rulePath, 'exceptions'),
            flags,
            order,
            active: active === undefined ? true : active,
            description: typeof entry.description === 'string' ? entry.description : '',
            historyBypassProtection: readBoolean(entry.historyBypassProtection, rulePath, 'historyBypassProtection')
        }));
    }

    function convertCompiled(data) {
        assertKeys(data, ['id', 'defaultActive', 'providers', 'metadata'], '');
        if (data.id !== undefined && typeof data.id !== 'string') fail('id', 'must be a string');
        const listActive = readBoolean(data.defaultActive, '', 'defaultActive') !== false;
        const providers = {};
        data.providers.forEach((input, index) => {
            const path = `providers[${index}]`;
            if (!isPlainObject(input)) fail(path, 'must be an object');
            assertKeys(input, COMPILED_PROVIDER_KEYS, path);
            const name = input.providerId;
            if (typeof name !== 'string' || !name.trim()) fail(path, 'providerId is required');
            if (Object.prototype.hasOwnProperty.call(providers, name)) fail(path, `duplicate providerId "${name}"`);
            const namedPath = `providers.${name}`;
            const provider = {};
            copyProviderBasics(input, provider, namedPath);
            if (!listActive || readBoolean(input.defaultActive, namedPath, 'defaultActive') === false) provider.active = false;
            if (input.rules !== undefined && input.rules !== null) {
                if (!Array.isArray(input.rules)) fail(namedPath, 'rules must be a list');
                const registerId = createIdRegistry(namedPath);
                input.rules.forEach((entry, ruleIndex) => convertCompiledRule(entry, provider, `${namedPath}.rules[${ruleIndex}]`, registerId));
            }
            providers[name] = provider;
        });
        const result = { providers };
        if (isPlainObject(data.metadata)) result.metadata = data.metadata;
        return result;
    }

    // ------------------------------------------------------------------
    // Public API
    // ------------------------------------------------------------------

    // Returns { format, data } where data is Linkumori format. Throws with a
    // "path: message" error when the input is not a valid rule list.
    function normalizeRuleDocument(input) {
        const data = typeof input === 'string' ? parseRuleText(input) : input;
        const format = detectRuleFormat(data);
        switch (format) {
            case 'linkumori': return { format, data };
            case 'clearurls-v2': return { format, data: convertV2(data) };
            case 'clearurls-compiled': return { format, data: convertCompiled(data) };
            default:
                throw new Error('Not a rule list: expected a "providers" object (Linkumori), "version: 2" (ClearURLs new rule format) or a "providers" list (ClearURLs compiled list)');
        }
    }

    const api = Object.freeze({
        detectRuleFormat,
        normalizeRuleDocument,
        parseRuleText,
        parseYaml,
        RULE_BEHAVIOR_FLAGS,
        RULE_ID_PATTERN
    });

    root.LinkumoriRuleFormats = api;
})(typeof globalThis !== 'undefined' ? globalThis : this);
