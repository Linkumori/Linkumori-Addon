/*!
 * Linkumori Markdown Parser
 * Based on marked 18.0.2 — https://github.com/markedjs/marked
 * Modified by Subham Mahesh, 2026
 *
 * ============================================================
 * ORIGINAL LICENSE START
 * ============================================================
 *
 * # License information
 *
 * ## Contribution License Agreement
 *
 * If you contribute code to this project, you are implicitly allowing your code
 * to be distributed under the MIT license. You are also implicitly verifying that
 * all code is your original work. `</legalese>`
 *
 * ## Marked
 *
 * Copyright (c) 2018+, MarkedJS (https://github.com/markedjs/)
 * Copyright (c) 2011-2018, Christopher Jeffrey (https://github.com/chjj/)
 *
 * Permission is hereby granted, free of charge, to any person obtaining a copy
 * of this software and associated documentation files (the "Software"), to deal
 * in the Software without restriction, including without limitation the rights
 * to use, copy, modify, merge, publish, distribute, sublicense, and/or sell
 * copies of the Software, and to permit persons to whom the Software is
 * furnished to do so, subject to the following conditions:
 *
 * The above copyright notice and this permission notice shall be included in
 * all copies or substantial portions of the Software.
 *
 * THE SOFTWARE IS PROVIDED "AS IS", WITHOUT WARRANTY OF ANY KIND, EXPRESS OR
 * IMPLIED, INCLUDING BUT NOT LIMITED TO THE WARRANTIES OF MERCHANTABILITY,
 * FITNESS FOR A PARTICULAR PURPOSE AND NONINFRINGEMENT. IN NO EVENT SHALL THE
 * AUTHORS OR COPYRIGHT HOLDERS BE LIABLE FOR ANY CLAIM, DAMAGES OR OTHER
 * LIABILITY, WHETHER IN AN ACTION OF CONTRACT, TORT OR OTHERWISE, ARISING FROM,
 * OUT OF OR IN CONNECTION WITH THE SOFTWARE OR THE USE OR OTHER DEALINGS IN
 * THE SOFTWARE.
 *
 * ## Markdown
 *
 * Copyright © 2004, John Gruber
 * http://daringfireball.net/
 * All rights reserved.
 *
 * Redistribution and use in source and binary forms, with or without
 * modification, are permitted provided that the following conditions are met:
 *
 * * Redistributions of source code must retain the above copyright notice,
 *   this list of conditions and the following disclaimer.
 * * Redistributions in binary form must reproduce the above copyright notice,
 *   this list of conditions and the following disclaimer in the documentation
 *   and/or other materials provided with the distribution.
 * * Neither the name "Markdown" nor the names of its contributors may be used
 *   to endorse or promote products derived from this software without specific
 *   prior written permission.
 *
 * This software is provided by the copyright holders and contributors "as is"
 * and any express or implied warranties, including, but not limited to, the
 * implied warranties of merchantability and fitness for a particular purpose
 * are disclaimed. In no event shall the copyright owner or contributors be
 * liable for any direct, indirect, incidental, special, exemplary, or
 * consequential damages (including, but not limited to, procurement of
 * substitute goods or services; loss of use, data, or profits; or business
 * interruption) however caused and on any theory of liability, whether in
 * contract, strict liability, or tort (including negligence or otherwise)
 * arising in any way out of the use of this software, even if advised of the
 * possibility of such damage.
 *
 * ============================================================
 * ORIGINAL LICENSE END
 * ============================================================
 *
 * ============================================================
 * LINKUMORI MODIFICATIONS
 * ============================================================
 * Copyright (c) 2026 Subham Mahesh (for modified part only)
 *
 * This program is free software: you can redistribute it and/or modify
 * it under the terms of the GNU Lesser General Public License as
 * published by the Free Software Foundation, either version 3 of the
 * License, or (at your option) any later version.
 *
 * This program is distributed in the hope that it will be useful, but
 * WITHOUT ANY WARRANTY; without even the implied warranty of
 * MERCHANTABILITY or FITNESS FOR A PARTICULAR PURPOSE. See the GNU
 * Lesser General Public License for more details.
 *
 * You should have received a copy of the GNU Lesser General Public
 * License along with this program. If not, see
 * <http://www.gnu.org/licenses/>.
 *
 * DESCRIPTION
 * -----------
 * Keeps page favicon aligned with the active Linkumori theme.
 *
 * ============================================================
 * MODIFICATION HISTORY
 * ============================================================
 * 2026-04-26   Subham Mahesh   Created modified version
 *
 * Note: Due to inline constraints, subsequent modifications may not
 * appear here. To view the full history, run:
 *
 *   node linkumori-cli-tool.js
 *
 * Select "Generate Commit History" to produce a Markdown file listing
 * all modifications by file, author, and date.
 *
 * IMPORTANT NOTES
 * ---------------
 * - `git clone` is required before running "Generate Commit History";
 *   otherwise commit history generation will not work.
 * - Older modifications may not appear in the generated COMMIT_HISTORY.md.
 * - If a file's inline notice is limited, check for a separate
 *   file-specific notice and COMMIT_HISTORY.md; if neither exists,
 *   treat the inline notice as the final modification record.
 * - If a separate file-specific notice is provided, check the file's
 *   inline notice and COMMIT_HISTORY.md; if neither exists, treat the
 *   separate notice as the final modification record.
 * - Review individual modified source files for earlier notices.
 * - Some files may not contain inline notices or appear in
 *   COMMIT_HISTORY.md; a separate notice file may be provided instead.
 * - Not all source files have been modified — review notices in all
 *   source files and any separate notice files (.md or .txt).
 *
 * ============================================================
 * Rewritten in clean, readable vanilla JavaScript.
 */

'use strict';

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

/** Returns a fresh copy of the default options object. */
function getDefaults() {
  return {
    async: false,
    breaks: false,
    extensions: null,
    gfm: true,
    hooks: null,
    pedantic: false,
    renderer: null,
    silent: false,
    tokenizer: null,
    walkTokens: null,
  };
}

/** The active defaults (mutated by setOptions / use). */
let defaults = getDefaults();

function changeDefaults(newDefaults) {
  defaults = newDefaults;
}

/** A no-op regex that always returns null — used as a disabled rule slot. */
const noopRule = { exec: () => null };

/**
 * Fluent regex-builder helper.
 * @param {string|RegExp} pattern
 * @param {string} [flags]
 */
function edit(pattern, flags = '') {
  let src = typeof pattern === 'string' ? pattern : pattern.source;
  const obj = {
    replace(name, val) {
      let valSrc = typeof val === 'string' ? val : val.source;
      // strip leading ^ from replacements
      valSrc = valSrc.replace(helpers.caret, '$1');
      src = src.replace(name, valSrc);
      return obj;
    },
    getRegex() {
      return new RegExp(src, flags);
    },
  };
  return obj;
}

/** True when the JS engine supports lookbehind assertions. */
const supportsLookBehind = (() => {
  try {
    return !!new RegExp('(?<=1)(?<!1)');
  } catch {
    return false;
  }
})();

/**
 * Miscellaneous small regexes used throughout the codebase.
 * Centralised here so they are compiled once.
 */
const helpers = {
  codeRemoveIndent:       /^(?: {1,4}| {0,3}\t)/gm,
  outputLinkReplace:      /\\([\[\]])/g,
  indentCodeCompensation: /^(\s+)(?:```)/,
  beginningSpace:         /^\s+/,
  endingHash:             /#$/,
  startingSpaceChar:      /^ /,
  endingSpaceChar:        / $/,
  nonSpaceChar:           /[^ ]/,
  newLineCharGlobal:      /\n/g,
  tabCharGlobal:          /\t/g,
  multipleSpaceGlobal:    /\s+/g,
  blankLine:              /^[ \t]*$/,
  doubleBlankLine:        /\n[ \t]*\n[ \t]*$/,
  blockquoteStart:        /^ {0,3}>/,
  blockquoteSetextReplace:  /\n {0,3}((?:=+|-+) *)(?=\n|$)/g,
  blockquoteSetextReplace2: /^ {0,3}>[ \t]?/gm,
  listReplaceNesting:     /^ {1,4}(?=( {4})*[^ ])/g,
  listIsTask:             /^\[[ xX]\] +\S/,
  listReplaceTask:        /^\[[ xX]\] +/,
  listTaskCheckbox:       /\[[ xX]\]/,
  anyLine:                /\n.*\n/,
  hrefBrackets:           /^<(.*)>$/,
  tableDelimiter:         /[:|]/,
  tableAlignChars:        /^\||\| *$/g,
  tableRowBlankLine:      /\n[ \t]*$/,
  tableAlignRight:        /^ *-+: *$/,
  tableAlignCenter:       /^ *:-+: *$/,
  tableAlignLeft:         /^ *:-+ *$/,
  startATag:              /^<a /i,
  endATag:                /^<\/a>/i,
  startPreScriptTag:      /^<(pre|code|kbd|script)(\s|>)/i,
  endPreScriptTag:        /^<\/(pre|code|kbd|script)(\s|>)/i,
  startAngleBracket:      /^</,
  endAngleBracket:        />$/,
  pedanticHrefTitle:      /^([^'"]*[^\s])\s+(['"])(.*)\2/,
  unicodeAlphaNumeric:    /[\p{L}\p{N}]/u,
  escapeTest:             /[&<>"']/,
  escapeReplace:          /[&<>"']/g,
  escapeTestNoEncode:     /[<>"']|&(?!(#\d{1,7}|#[Xx][a-fA-F0-9]{1,6}|\w+);)/,
  escapeReplaceNoEncode:  /[<>"']|&(?!(#\d{1,7}|#[Xx][a-fA-F0-9]{1,6}|\w+);)/g,
  caret:                  /(^|[^\[])\^/g,
  percentDecode:          /%25/g,
  findPipe:               /\|/g,
  splitPipe:              / \|/,
  slashPipe:              /\\\|/g,
  carriageReturn:         /\r\n|\r/g,
  spaceLine:              /^ +$/gm,
  notSpaceStart:          /^\S*/,
  endingNewline:          /\n$/,

  // Dynamic regex factories
  listItemRegex:    (bullet) => new RegExp(`^( {0,3}${bullet})((?:[\t ][^\\n]*)?(?:\\n|$))`),
  nextBulletRegex:  (indent) => new RegExp(`^ {0,${Math.min(3, indent - 1)}}(?:[*+-]|\\d{1,9}[.)])((?:[ \t][^\\n]*)?(?:\\n|$))`),
  hrRegex:          (indent) => new RegExp(`^ {0,${Math.min(3, indent - 1)}}((?:- *){3,}|(?:_ *){3,}|(?:\\* *){3,})(?:\\n+|$)`),
  fencesBeginRegex: (indent) => new RegExp(`^ {0,${Math.min(3, indent - 1)}}(?:\`\`\`|~~~)`),
  headingBeginRegex:(indent) => new RegExp(`^ {0,${Math.min(3, indent - 1)}}#`),
  htmlBeginRegex:   (indent) => new RegExp(`^ {0,${Math.min(3, indent - 1)}}<(?:[a-z].*>|!--)`, 'i'),
  blockquoteBeginRegex: (indent) => new RegExp(`^ {0,${Math.min(3, indent - 1)}}>`),
};

// ---------------------------------------------------------------------------
// Block-level grammar rules
// ---------------------------------------------------------------------------

const blockNewline      = /^(?:[ \t]*(?:\n|$))+/;
const blockCode         = /^((?: {4}| {0,3}\t)[^\n]+(?:\n(?:[ \t]*(?:\n|$))*)?)+/;
const blockFences       = /^ {0,3}(`{3,}(?=[^`\n]*(?:\n|$))|~{3,})([^\n]*)(?:\n|$)(?:|([\s\S]*?)(?:\n|$))(?: {0,3}\1[~`]* *(?=\n|$)|$)/;
const blockHr           = /^ {0,3}((?:-[\t ]*){3,}|(?:_[ \t]*){3,}|(?:\*[ \t]*){3,})(?:\n+|$)/;
const blockHeading      = /^ {0,3}(#{1,6})(?=\s|$)(.*)(?:\n+|$)/;
const bullet            = /(?!\s*\])(?:\\[\s\S]|[^\[\]\\])+/;
const bulletAny         = / {0,3}(?:[*+-]|\d{1,9}[.)])/;

// Setext heading (underline style) — two variants: with and without table
const setextHeadingBase = /^(?!bull |blockCode|fences|blockquote|heading|html|table)((?:.|\n(?!\s*?\n|bull |blockCode|fences|blockquote|heading|html|table))+?)\n {0,3}(=+|-+) *(?:\n+|$)/;
const blockLheading = edit(setextHeadingBase)
  .replace(/bull/g, bulletAny)
  .replace(/blockCode/g, /(?: {4}| {0,3}\t)/)
  .replace(/fences/g,  / {0,3}(?:`{3,}|~{3,})/)
  .replace(/blockquote/g, / {0,3}>/)
  .replace(/heading/g, / {0,3}#{1,6}/)
  .replace(/html/g,    / {0,3}<[^\n>]+>\n/)
  .replace(/\|table/g, '')
  .getRegex();

const blockLheadingGfm = edit(setextHeadingBase)
  .replace(/bull/g, bulletAny)
  .replace(/blockCode/g, /(?: {4}| {0,3}\t)/)
  .replace(/fences/g,  / {0,3}(?:`{3,}|~{3,})/)
  .replace(/blockquote/g, / {0,3}>/)
  .replace(/heading/g, / {0,3}#{1,6}/)
  .replace(/html/g,    / {0,3}<[^\n>]+>\n/)
  .replace(/table/g,   / {0,3}\|?(?:[:\- ]*\|)+[\:\- ]*\n/)
  .getRegex();

// Paragraph base (no table variant)
const paragraphSrc = /^([^\n]+(?:\n(?!hr|heading|lheading|blockquote|fences|list|html|table| +\n)[^\n]+)*)/;
const blockText     = /^[^\n]+/;

// Link definition label
const labelSrc = /(?!\s*\])(?:\\[\s\S]|[^\[\]\\])+/;
const blockDef = edit(/^ {0,3}\[(label)\]: *(?:\n[ \t]*)?([^<\s][^\s]*|<.*?>)(?:(?: +(?:\n[ \t]*)?| *\n[ \t]*)(title))? *(?:\n+|$)/)
  .replace('label', labelSrc)
  .replace('title', /(?:"(?:\\"?|[^"\\])*"|'[^'\n]*(?:\n[^'\n]+)*\n?'|\([^()]*\))/)
  .getRegex();

const blockListItem = edit(/^(bull)([ \t][^\n]+?)?(?:\n|$)/)
  .replace(/bull/g, bulletAny)
  .getRegex();

// Block HTML
const blockTags = 'address|article|aside|base|basefont|blockquote|body|caption|center|col|colgroup|dd|details|dialog|dir|div|dl|dt|fieldset|figcaption|figure|footer|form|frame|frameset|h[1-6]|head|header|hr|html|iframe|legend|li|link|main|menu|menuitem|meta|nav|noframes|ol|optgroup|option|p|param|search|section|summary|table|tbody|td|tfoot|th|thead|title|tr|track|ul';
const htmlComment = /<!--(?:-?>|[\s\S]*?(?:-->|$))/;
const blockHtml = edit(
  '^ {0,3}(?:' +
  '<(script|pre|style|textarea)[\\s>][\\s\\S]*?(?:</\\1>[^\\n]*\\n+|$)|' +
  'comment[^\\n]*(\\n+|$)|' +
  '<\\?[\\s\\S]*?(?:\\?>\\n*|$)|' +
  '<![A-Z][\\s\\S]*?(?:>\\n*|$)|' +
  '<!\\[CDATA\\[[\\s\\S]*?(?:\\]\\]>\\n*|$)|' +
  '</?(tag)(?: +|\\n|/?>)[\\s\\S]*?(?:(?:\\n[ \t]*)+\\n|$)|' +
  '<(?!script|pre|style|textarea)([a-z][\\w-]*)(?:attribute)*? */?>(?=[ \\t]*(?:\\n|$))[\\s\\S]*?(?:(?:\\n[ \t]*)+\\n|$)|' +
  '</(?!script|pre|style|textarea)[a-z][\\w-]*\\s*>(?=[ \\t]*(?:\\n|$))[\\s\\S]*?(?:(?:\\n[ \t]*)+\\n|$))',
  'i'
)
  .replace('comment', htmlComment)
  .replace('tag', blockTags)
  .replace('attribute', / +[a-zA-Z:_][\w.:-]*(?: *= *"[^"\n]*"| *= *'[^'\n]*'| *= *[^\s"'=<>`]+)?/)
  .getRegex();

// Paragraph without lheading (for normal mode)
const normalParagraph = edit(paragraphSrc)
  .replace('hr', blockHr)
  .replace('heading', ' {0,3}#{1,6}(?:\\s|$)')
  .replace('|lheading', '')
  .replace('|table', '')
  .replace('blockquote', ' {0,3}>')
  .replace('fences', ' {0,3}(?:`{3,}(?=[^`\\n]*\\n)|~{3,})[^\\n]*\\n')
  .replace('list', ' {0,3}(?:[*+-]|1[.)])[ \\t]')
  .replace('html', '</?(?:tag)(?: +|\\n|/?>)|<(?:script|pre|style|textarea|!--)')
  .replace('tag', blockTags)
  .getRegex();

// Blockquote
const blockBlockquote = edit(/^( {0,3}> ?(paragraph|[^\n]*)(?:\n|$))+/)
  .replace('paragraph', normalParagraph)
  .getRegex();

// GFM table
const gfmTable = edit(
  '^ *([^\\n ].*)\\n {0,3}((?:\\| *)?:?-+:? *(?:\\| *:?-+:? *)*(?:\\| *)?)' +
  '(?:\\n((?:(?! *\\n|hr|heading|blockquote|code|fences|list|html).*(?:\\n|$))*)\\n*|$)'
)
  .replace('hr', blockHr)
  .replace('heading', ' {0,3}#{1,6}(?:\\s|$)')
  .replace('blockquote', ' {0,3}>')
  .replace('code', '(?: {4}| {0,3}\t)[^\\n]')
  .replace('fences', ' {0,3}(?:`{3,}(?=[^`\\n]*\\n)|~{3,})[^\\n]*\\n')
  .replace('list', ' {0,3}(?:[*+-]|1[.)])[ \\t]')
  .replace('html', '</?(?:tag)(?: +|\\n|/?>)|<(?:script|pre|style|textarea|!--)')
  .replace('tag', blockTags)
  .getRegex();

// GFM paragraph (with table awareness)
const gfmParagraph = edit(paragraphSrc)
  .replace('hr', blockHr)
  .replace('heading', ' {0,3}#{1,6}(?:\\s|$)')
  .replace('|lheading', '')
  .replace('table', gfmTable)
  .replace('blockquote', ' {0,3}>')
  .replace('fences', ' {0,3}(?:`{3,}(?=[^`\\n]*\\n)|~{3,})[^\\n]*\\n')
  .replace('list', ' {0,3}(?:[*+-]|1[.)])[ \\t]')
  .replace('html', '</?(?:tag)(?: +|\\n|/?>)|<(?:script|pre|style|textarea|!--)')
  .replace('tag', blockTags)
  .getRegex();

// Pedantic variants
const pedanticHtml = edit(
  '^ *(?:comment *(?:\\n|\\s*$)|' +
  '<(tag)[\\s\\S]+?</\\1> *(?:\\n{2,}|\\s*$)|' +
  '<tag(?:"[^"]*"|\'[^\']*\'|\\s[^\'"/>\\s]*)*?/?> *(?:\\n{2,}|\\s*$))'
)
  .replace('comment', htmlComment)
  .replace(/tag/g, '(?!(?:a|em|strong|small|s|cite|q|dfn|abbr|data|time|code|var|samp|kbd|sub|sup|i|b|u|mark|ruby|rt|rp|bdi|bdo|span|br|wbr|ins|del|img)\\b)\\w+(?!:|[^\\w\\s@]*@)\\b')
  .getRegex();

const pedanticParagraph = edit(paragraphSrc)
  .replace('hr', blockHr)
  .replace('heading', ' *#{1,6} *[^\n]')
  .replace('lheading', blockLheading)
  .replace('|table', '')
  .replace('blockquote', ' {0,3}>')
  .replace('|fences', '')
  .replace('|list', '')
  .replace('|html', '')
  .replace('|tag', '')
  .getRegex();

/** Compiled block-rule sets keyed by mode. */
const blockRules = {
  normal: {
    blockquote: blockBlockquote,
    code:       blockCode,
    def:        blockDef,
    fences:     blockFences,
    heading:    blockHeading,
    hr:         blockHr,
    html:       blockHtml,
    lheading:   blockLheading,
    list:       blockListItem,
    newline:    blockNewline,
    paragraph:  normalParagraph,
    table:      noopRule,
    text:       blockText,
  },
  gfm: {
    blockquote: blockBlockquote,
    code:       blockCode,
    def:        blockDef,
    fences:     blockFences,
    heading:    blockHeading,
    hr:         blockHr,
    html:       blockHtml,
    lheading:   blockLheadingGfm,
    list:       blockListItem,
    newline:    blockNewline,
    paragraph:  gfmParagraph,
    table:      gfmTable,
    text:       blockText,
  },
  pedantic: {
    blockquote: blockBlockquote,
    code:       blockCode,
    def:        /^ *\[([^\]]+)\]: *<?([^\s>]+)>?(?: +(["(][^\n]+[")]))? *(?:\n+|$)/,
    fences:     noopRule,
    heading:    /^(#{1,6})(.*)(?:\n+|$)/,
    hr:         blockHr,
    html:       pedanticHtml,
    lheading:   /^(.+?)\n {0,3}(=+|-+) *(?:\n+|$)/,
    list:       blockListItem,
    newline:    blockNewline,
    paragraph:  pedanticParagraph,
    table:      noopRule,
    text:       blockText,
  },
};

// ---------------------------------------------------------------------------
// Inline-level grammar rules
// ---------------------------------------------------------------------------

const inlineEscape     = /^\\([!"#$%&'()*+,\-./:;<=>?@\[\]\\^_`{|}~])/;
const inlineCode       = /^(`+)([^`]|[^`][\s\S]*?[^`])\1(?!`)/;
const inlineBr         = /^( {2,}|\\)\n(?!\s*$)/;
const inlineText       = /^(`+|[^`])(?:(?= {2,}\n)|[\s\S]*?(?:(?=[\\<!\[`*_]|\b_|$)|[^ ](?= {2,}\n)))/;

// Unicode character categories used for emphasis parsing
const unicodePunct     = /[\p{P}\p{S}]/u;
const unicodePunctSpace= /[\s\p{P}\p{S}]/u;
const unicodeNotPunctSpace = /[^\s\p{P}\p{S}]/u;
const inlinePunctuation = edit(/^((?![*_])punctSpace)/, 'u')
  .replace(/punctSpace/g, unicodePunctSpace)
  .getRegex();

// Strikethrough delimiters (GFM ~~ or ~)
const delPunct      = /(?!~)[\p{P}\p{S}]/u;
const delPunctSpace = /(?!~)[\s\p{P}\p{S}]/u;
const delNotPunct   = /(?:[^\s\p{P}\p{S}]|~)/u;

// Link helpers
const linkLabel = /(?:\[(?:\\[\s\S]|[^\[\]\\])*\]|\\[\s\S]|`+(?!`)[^`]*?`+(?!`)|``+(?=\])|[^\[\]\\`])*?/;
const refLinkLabel = /(?!\s*\])(?:\\[\s\S]|[^\[\]\\])+/;

// Block-skip pattern (links and code spans inside inline)
const blockSkip = edit(/link|precode-code|html/, 'g')
  .replace('link', /\[(?:[^\[\]`]|(?<a>`+)[^`]+\k<a>(?!`))*?\]\((?:\\[\s\S]|[^\\\(\)]|\((?:\\[\s\S]|[^\\\(\)])*\))*\)/)
  .replace('precode-', supportsLookBehind ? '(?<!`)()' : '(^^|[^`])')
  .replace('code', /(?<b>`+)[^`]+\k<b>(?!`)/)
  .replace('html', /<(?! )[^<>]*?>/)
  .getRegex();

// Emphasis / strong left-delimiter
const emStrongLDelimBase = /^(?:\*+(?:((?!\*)punct)|([^\s*]))?)|^_+(?:((?!_)punct)|([^\s_]))?/;
const emStrongLDelim     = edit(emStrongLDelimBase, 'u').replace(/punct/g, unicodePunct).getRegex();
const emStrongLDelimGfm  = edit(emStrongLDelimBase, 'u').replace(/punct/g, delPunct).getRegex();

// Emphasis / strong right-delimiter (asterisk variant)
const emStrongRDelimAstSrc =
  '^[^_*]*?__[^_*]*?\\*[^_*]*?(?=__)|[^*]+(?=[^*])|(?!\\*)punct(\\*+)(?=[\\s]|$)' +
  '|notPunctSpace(\\*+)(?!\\*)(?=punctSpace|$)' +
  '|(?!\\*)punctSpace(\\*+)(?=notPunctSpace)' +
  '|[\\s](\\*+)(?!\\*)(?=punct)' +
  '|(?!\\*)punct(\\*+)(?!\\*)(?=punct)' +
  '|notPunctSpace(\\*+)(?=notPunctSpace)';
const emStrongRDelimAst = edit(emStrongRDelimAstSrc, 'gu')
  .replace(/notPunctSpace/g, unicodeNotPunctSpace)
  .replace(/punctSpace/g, unicodePunctSpace)
  .replace(/punct/g, unicodePunct)
  .getRegex();
const emStrongRDelimAstGfm = edit(emStrongRDelimAstSrc, 'gu')
  .replace(/notPunctSpace/g, delNotPunct)
  .replace(/punctSpace/g, delPunctSpace)
  .replace(/punct/g, delPunct)
  .getRegex();

// Emphasis / strong right-delimiter (underscore variant)
const emStrongRDelimUnd = edit(
  '^[^_*]*?\\*\\*[^_*]*?_[^_*]*?(?=\\*\\*)|[^_]+(?=[^_])|(?!_)punct(_+)(?=[\\s]|$)' +
  '|notPunctSpace(_+)(?!_)(?=punctSpace|$)' +
  '|(?!_)punctSpace(_+)(?=notPunctSpace)' +
  '|[\\s](_+)(?!_)(?=punct)' +
  '|(?!_)punct(_+)(?!_)(?=punct)',
  'gu'
)
  .replace(/notPunctSpace/g, unicodeNotPunctSpace)
  .replace(/punctSpace/g, unicodePunctSpace)
  .replace(/punct/g, unicodePunct)
  .getRegex();

// Strikethrough (GFM)
const delLDelimGfm = edit(/^~~?(?:((?!~)punct)|[^\s~])/, 'u').replace(/punct/g, unicodePunct).getRegex();
const delRDelimGfmSrc =
  '^[^~]+(?=[^~])|(?!~)punct(~~?)(?=[\\s]|$)' +
  '|notPunctSpace(~~?)(?!~)(?=punctSpace|$)' +
  '|(?!~)punctSpace(~~?)(?=notPunctSpace)' +
  '|[\\s](~~?)(?!~)(?=punct)' +
  '|(?!~)punct(~~?)(?!~)(?=punct)' +
  '|notPunctSpace(~~?)(?=notPunctSpace)';
const delRDelimGfm = edit(delRDelimGfmSrc, 'gu')
  .replace(/notPunctSpace/g, unicodeNotPunctSpace)
  .replace(/punctSpace/g, unicodePunctSpace)
  .replace(/punct/g, unicodePunct)
  .getRegex();

// Escaped punctuation (inline)
const escapeReplace = edit(/\\(punct)/, 'gu').replace(/punct/g, unicodePunct).getRegex();

// Autolink
const autolink = edit(/^<(scheme:[^\s\x00-\x1f<>]*|email)>/)
  .replace('scheme', /[a-zA-Z][a-zA-Z0-9+.-]{1,31}/)
  .replace('email', /[a-zA-Z0-9.!#$%&'*+/=?^_`{|}~-]+(@)[a-zA-Z0-9](?:[a-zA-Z0-9-]{0,61}[a-zA-Z0-9])?(?:\.[a-zA-Z0-9](?:[a-zA-Z0-9-]{0,61}[a-zA-Z0-9])?)+(?![-_])/)
  .getRegex();

const htmlCommentInline = edit(htmlComment).replace('(?:-->|$)', '-->').getRegex();
const inlineTag = edit(
  '^comment|^</[a-zA-Z][\\w:-]*\\s*>' +
  '|^<[a-zA-Z][\\w-]*(?:attribute)*?\\s*/?>' +
  '|^<\\?[\\s\\S]*?\\?>' +
  '|^<![a-zA-Z]+\\s[\\s\\S]*?>' +
  '|^<!\\[CDATA\\[[\\s\\S]*?\\]\\]>'
)
  .replace('comment', htmlCommentInline)
  .replace('attribute', /\s+[a-zA-Z:_][\w.:-]*(?:\s*=\s*"[^"]*"|\s*=\s*'[^']*'|\s*=\s*[^\s"'=<>`]+)?/)
  .getRegex();

// Inline link / image
const inlineLink = edit(/^!?\[(label)\]\(\s*(href)(?:(?:[ \t]+(?:\n[ \t]*)?|\n[ \t]*)(title))?\s*\)/)
  .replace('label', linkLabel)
  .replace('href', /<(?:\\.|[^\n<>\\])+>|[^ \t\n\x00-\x1f]*/)
  .replace('title', /"(?:\\"?|[^"\\])*"|'(?:\\'?|[^'\\])*'|\((?:\\\)?|[^)\\])*\)/)
  .getRegex();

const inlineRefLink = edit(/^!?\[(label)\]\[(ref)\]/)
  .replace('label', linkLabel)
  .replace('ref', refLinkLabel)
  .getRegex();

const inlineNoLink = edit(/^!?\[(ref)\](?:\[\])?/)
  .replace('ref', refLinkLabel)
  .getRegex();

const reflinkSearch = edit('reflink|nolink(?!\\()', 'g')
  .replace('reflink', inlineRefLink)
  .replace('nolink', inlineNoLink)
  .getRegex();

// URL protocol (for GFM autolinks)
const urlProtocol = /[hH][tT][tT][pP][sS]?|[fF][tT][pP]/;

/** Normal inline rules (shared base). */
const inlineRulesNormal = {
  _backpedal:        noopRule,
  anyPunctuation:    escapeReplace,
  autolink,
  blockSkip,
  br:                inlineBr,
  code:              inlineCode,
  del:               noopRule,
  delLDelim:         noopRule,
  delRDelim:         noopRule,
  emStrongLDelim,
  emStrongRDelimAst,
  emStrongRDelimUnd,
  escape:            inlineEscape,
  link:              inlineLink,
  nolink:            inlineNoLink,
  punctuation:       inlinePunctuation,
  reflink:           inlineRefLink,
  reflinkSearch,
  tag:               inlineTag,
  text:              inlineText,
  url:               noopRule,
};

/** GFM inline rules — adds URL autolinks, del, strikethrough. */
const inlineRulesGfm = {
  ...inlineRulesNormal,
  emStrongRDelimAst: emStrongRDelimAstGfm,
  emStrongLDelim:    emStrongLDelimGfm,
  delLDelim:         delLDelimGfm,
  delRDelim:         delRDelimGfm,
  url: edit(/^((?:protocol):\/\/|www\.)(?:[a-zA-Z0-9\-]+\.?)+[^\s<]*|^email/)
    .replace('protocol', urlProtocol)
    .replace('email', /[A-Za-z0-9._+-]+(@)[a-zA-Z0-9-_]+(?:\.[a-zA-Z0-9-_]*[a-zA-Z0-9])+(?![-_])/)
    .getRegex(),
  _backpedal: /(?:[^?!.,:;*_'"~()&]+|\([^)]*\)|&(?![a-zA-Z0-9]+;$)|[?!.,:;*_'"~)]+(?!$))+/,
  del: /^(~~?)(?=[^\s~])((?:\\[\s\S]|[^\\])*?(?:\\[\s\S]|[^\s~\\]))\1(?=[^~]|$)/,
  text: edit(
    /^([`~]+|[^`~])(?:(?= {2,}\n)|(?=[a-zA-Z0-9.!#$%&'*+\/=?_`{\|}~-]+@)|[\s\S]*?(?:(?=[\\<!\[`*~_]|\b_|protocol:\/\/|www\.|$)|[^ ](?= {2,}\n)|[^a-zA-Z0-9.!#$%&'*+\/=?_`{\|}~-](?=[a-zA-Z0-9.!#$%&'*+\/=?_`{\|}~-]+@)))/
  ).replace('protocol', urlProtocol).getRegex(),
};

/** GFM + line-breaks inline rules. */
const inlineRulesBreaks = {
  ...inlineRulesGfm,
  br:   edit(inlineBr).replace('{2,}', '*').getRegex(),
  text: edit(inlineRulesGfm.text).replace('\\b_', '\\b_| {2,}\\n').replace(/\{2,\}/g, '*').getRegex(),
};

/** Pedantic inline rules. */
const inlineRulesPedantic = {
  ...inlineRulesNormal,
  link:    edit(/^!?\[(label)\]\((.*?)\)/).replace('label', linkLabel).getRegex(),
  reflink: edit(/^!?\[(label)\]\s*\[([^\]]*)\]/).replace('label', linkLabel).getRegex(),
};

/** All inline-rule sets keyed by mode. */
const inlineRules = {
  normal:   inlineRulesNormal,
  gfm:      inlineRulesGfm,
  breaks:   inlineRulesBreaks,
  pedantic: inlineRulesPedantic,
};

// ---------------------------------------------------------------------------
// Utility functions
// ---------------------------------------------------------------------------

const escapeMap = { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' };
const escapeChar = (ch) => escapeMap[ch];

/**
 * Escape HTML special characters.
 * @param {string} html
 * @param {boolean} [encode] - When false, skip already-encoded entities.
 */
function escape(html, encode) {
  if (encode) {
    if (helpers.escapeTest.test(html)) {
      return html.replace(helpers.escapeReplace, escapeChar);
    }
  } else if (helpers.escapeTestNoEncode.test(html)) {
    return html.replace(helpers.escapeReplaceNoEncode, escapeChar);
  }
  return html;
}

/**
 * Sanitise a URL for use in href/src attributes.
 * Returns null if the URL cannot be encoded.
 */
function cleanUrl(href) {
  try {
    href = encodeURI(href).replace(helpers.percentDecode, '%');
  } catch {
    return null;
  }
  return href;
}

/**
 * Split a GFM table row into cells, respecting escaped pipes.
 * @param {string} tableRow
 * @param {number} [count] - Expected number of columns (pads or trims).
 */
function splitCells(tableRow, count) {
  // Replace un-escaped pipes with a sentinel space+pipe
  const row = tableRow.replace(helpers.findPipe, (match, offset, str) => {
    let escaped = false;
    let idx = offset;
    while (--idx >= 0 && str[idx] === '\\') escaped = !escaped;
    return escaped ? '|' : ' |';
  });

  const cells = row.split(helpers.splitPipe);
  let i = 0;

  if (!cells[0].trim()) cells.shift();
  if (cells.length > 0 && !cells.at(-1)?.trim()) cells.pop();

  if (count) {
    if (cells.length > count) {
      cells.splice(count);
    } else {
      while (cells.length < count) cells.push('');
    }
  }

  for (; i < cells.length; i++) {
    cells[i] = cells[i].trim().replace(helpers.slashPipe, '|');
  }

  return cells;
}

/**
 * Right-trim a character from a string.
 * @param {string} str
 * @param {string} char
 * @param {boolean} [invert] - When true, trim everything *but* char.
 */
function rtrim(str, char, invert = false) {
  const l = str.length;
  if (l === 0) return '';
  let suffixLen = 0;
  for (; suffixLen < l; suffixLen++) {
    const c = str.charAt(l - suffixLen - 1);
    if ((!invert && c !== char) || (invert && c === char)) {
      break;
    }
  }
  return str.slice(0, l - suffixLen);
}

/**
 * Remove trailing blank lines from a code block / fenced section.
 */
function trimTrailingBlankLines(str) {
  const lines = str.split('\n');
  let last = lines.length - 1;
  while (last >= 0 && helpers.blankLine.test(lines[last])) last--;
  return lines.length - last <= 2 ? str : lines.slice(0, last + 1).join('\n');
}

/**
 * Search for the closing bracket of a nested pair.
 * Returns -1 if not found, -2 if unmatched open bracket remains.
 */
function findClosingBracket(str, pair) {
  if (str.indexOf(pair[1]) === -1) return -1;
  let depth = 0;
  for (let i = 0; i < str.length; i++) {
    if (str[i] === '\\') { i++; }
    else if (str[i] === pair[0]) { depth++; }
    else if (str[i] === pair[1]) {
      depth--;
      if (depth < 0) return i;
    }
  }
  return depth > 0 ? -2 : -1;
}

/**
 * Expand tab characters to spaces (tab stop every 4 columns).
 * @param {string} str
 * @param {number} [startCol=0]
 */
function expandTabs(str, startCol = 0) {
  let col = startCol;
  let out = '';
  for (const ch of str) {
    if (ch === '\t') {
      const spaces = 4 - (col % 4);
      out += ' '.repeat(spaces);
      col += spaces;
    } else {
      out += ch;
      col++;
    }
  }
  return out;
}

/**
 * Build a link / image token from a matched regex result and a resolved href.
 */
function buildOutputLink(cap, link, raw, lexer, rules) {
  const href  = link.href;
  const title = link.title || null;
  const text  = cap[1].replace(rules.other.outputLinkReplace, '$1');

  lexer.state.inLink = true;
  const token = {
    type:   cap[0].charAt(0) === '!' ? 'image' : 'link',
    raw,
    href,
    title,
    text,
    tokens: lexer.inlineTokens(text),
  };
  lexer.state.inLink = false;
  return token;
}

/**
 * Strip the common indentation caused by a fenced code block opening.
 */
function indentCodeCompensation(raw, text, rules) {
  const match = raw.match(rules.other.indentCodeCompensation);
  if (match === null) return text;

  const indent = match[1];
  return text
    .split('\n')
    .map((line) => {
      const m = line.match(rules.other.beginningSpace);
      if (m === null) return line;
      const [spaces] = m;
      return spaces.length >= indent.length ? line.slice(indent.length) : line;
    })
    .join('\n');
}

// ---------------------------------------------------------------------------
// Tokenizer
// ---------------------------------------------------------------------------

class Tokenizer {
  constructor(options) {
    this.options = options || defaults;
  }

  // ---- Block tokenizers ----

  space(src) {
    const cap = this.rules.block.newline.exec(src);
    if (cap && cap[0].length > 0) {
      return { type: 'space', raw: cap[0] };
    }
  }

  code(src) {
    const cap = this.rules.block.code.exec(src);
    if (cap) {
      const raw  = this.options.pedantic ? cap[0] : trimTrailingBlankLines(cap[0]);
      const text = raw.replace(this.rules.other.codeRemoveIndent, '');
      return { type: 'code', raw, codeBlockStyle: 'indented', text };
    }
  }

  fences(src) {
    const cap = this.rules.block.fences.exec(src);
    if (cap) {
      const raw  = cap[0];
      const text = indentCodeCompensation(raw, cap[3] || '', this.rules);
      return {
        type: 'code',
        raw,
        lang: cap[2]
          ? cap[2].trim().replace(this.rules.inline.anyPunctuation, '$1')
          : cap[2],
        text,
      };
    }
  }

  heading(src) {
    const cap = this.rules.block.heading.exec(src);
    if (cap) {
      let text = cap[2].trim();
      if (this.rules.other.endingHash.test(text)) {
        const trimmed = rtrim(text, '#');
        if (this.options.pedantic || !trimmed || this.rules.other.endingSpaceChar.test(trimmed)) {
          text = trimmed.trim();
        }
      }
      return {
        type:   'heading',
        raw:    rtrim(cap[0], '\n'),
        depth:  cap[1].length,
        text,
        tokens: this.lexer.inline(text),
      };
    }
  }

  hr(src) {
    const cap = this.rules.block.hr.exec(src);
    if (cap) return { type: 'hr', raw: rtrim(cap[0], '\n') };
  }

  blockquote(src) {
    const cap = this.rules.block.blockquote.exec(src);
    if (!cap) return;

    let lines = rtrim(cap[0], '\n').split('\n');
    let rawBody = '';
    let textBody = '';
    const tokens = [];

    while (lines.length > 0) {
      let continuous = false;
      const groupLines = [];
      let i;

      for (i = 0; i < lines.length; i++) {
        if (this.rules.other.blockquoteStart.test(lines[i])) {
          groupLines.push(lines[i]);
          continuous = true;
        } else if (!continuous) {
          groupLines.push(lines[i]);
        } else {
          break;
        }
      }

      lines = lines.slice(i);

      const raw  = groupLines.join('\n');
      const text = raw
        .replace(this.rules.other.blockquoteSetextReplace,  '\n    $1')
        .replace(this.rules.other.blockquoteSetextReplace2, '');

      rawBody  = rawBody  ? `${rawBody}\n${raw}`  : raw;
      textBody = textBody ? `${textBody}\n${text}` : text;

      const prevTop = this.lexer.state.top;
      this.lexer.state.top = true;
      this.lexer.blockTokens(text, tokens, true);
      this.lexer.state.top = prevTop;

      if (lines.length === 0) break;

      const last = tokens.at(-1);
      if (last?.type === 'code') break;

      if (last?.type === 'blockquote') {
        // Merge with previous blockquote token
        const prev     = last;
        const merged   = this.blockquote(prev.raw + '\n' + lines.join('\n'));
        tokens[tokens.length - 1] = merged;
        rawBody  = rawBody.slice(0, rawBody.length - prev.raw.length) + merged.raw;
        textBody = textBody.slice(0, textBody.length - prev.text.length) + merged.text;
        break;
      } else if (last?.type === 'list') {
        const prev   = last;
        const merged = this.list(prev.raw + '\n' + lines.join('\n'));
        tokens[tokens.length - 1] = merged;
        rawBody  = rawBody.slice(0, rawBody.length - prev.raw.length) + merged.raw;
        textBody = textBody.slice(0, textBody.length - prev.raw.length) + merged.raw;
        lines = (prev.raw + '\n' + lines.join('\n')).slice(tokens.at(-1).raw.length).split('\n');
        continue;
      }
    }

    return { type: 'blockquote', raw: rawBody, tokens, text: textBody };
  }

  list(src) {
    const cap = this.rules.block.list.exec(src);
    if (!cap) return;

    let bullet = cap[1].trim();
    const ordered = bullet.length > 1;

    const list = {
      type:    'list',
      raw:     '',
      ordered,
      start:   ordered ? +bullet.slice(0, -1) : '',
      loose:   false,
      items:   [],
    };

    bullet = ordered
      ? `\\d{1,9}\\${bullet.slice(-1)}`
      : `\\${bullet}`;
    if (this.options.pedantic) bullet = ordered ? bullet : '[*+-]';

    const itemRegex = this.rules.other.listItemRegex(bullet);
    let blankLast   = false;

    while (src) {
      let atEmptyItem = false;
      let raw = '';
      let itemSrc = '';

      const itemCap = itemRegex.exec(src);
      if (!itemCap || this.rules.block.hr.test(src)) break;

      raw = itemCap[0];
      src = src.substring(raw.length);

      let line       = expandTabs(itemCap[2].split('\n', 1)[0], itemCap[1].length);
      let nextLine   = src.split('\n', 1)[0];
      let emptyItem  = !line.trim();
      let indent     = 0;

      if (this.options.pedantic) {
        indent  = 2;
        itemSrc = line.trimStart();
      } else if (emptyItem) {
        indent = itemCap[1].length + 1;
      } else {
        indent = line.search(this.rules.other.nonSpaceChar);
        indent = indent > 4 ? 1 : indent;
        itemSrc = line.slice(indent);
        indent += itemCap[1].length;
      }

      if (emptyItem && this.rules.other.blankLine.test(nextLine)) {
        raw  += nextLine + '\n';
        src   = src.substring(nextLine.length + 1);
        atEmptyItem = true;
      }

      if (!atEmptyItem) {
        const nextBullet    = this.rules.other.nextBulletRegex(indent);
        const hrPattern     = this.rules.other.hrRegex(indent);
        const fencesBegin   = this.rules.other.fencesBeginRegex(indent);
        const headingBegin  = this.rules.other.headingBeginRegex(indent);
        const htmlBegin     = this.rules.other.htmlBeginRegex(indent);
        const bqBegin       = this.rules.other.blockquoteBeginRegex(indent);

        while (src) {
          const lineRaw = src.split('\n', 1)[0];
          let lineExpanded;

          nextLine     = lineRaw;
          if (this.options.pedantic) {
            nextLine     = nextLine.replace(this.rules.other.listReplaceNesting, '  ');
            lineExpanded = nextLine;
          } else {
            lineExpanded = nextLine.replace(this.rules.other.tabCharGlobal, '    ');
          }

          if (
            fencesBegin.test(nextLine)  || headingBegin.test(nextLine) ||
            htmlBegin.test(nextLine)    || bqBegin.test(nextLine)      ||
            nextBullet.test(nextLine)   || hrPattern.test(nextLine)
          ) break;

          if (lineExpanded.search(this.rules.other.nonSpaceChar) >= indent || !nextLine.trim()) {
            itemSrc += '\n' + lineExpanded.slice(indent);
          } else {
            if (emptyItem || line.replace(this.rules.other.tabCharGlobal, '    ').search(this.rules.other.nonSpaceChar) >= 4
              || fencesBegin.test(line) || headingBegin.test(line) || hrPattern.test(line)) break;
            itemSrc += '\n' + nextLine;
          }

          emptyItem = !nextLine.trim();
          raw  += lineRaw + '\n';
          src   = src.substring(lineRaw.length + 1);
          line  = lineExpanded.slice(indent);
        }
      }

      if (!list.loose) {
        if (blankLast) {
          list.loose = true;
        } else if (this.rules.other.doubleBlankLine.test(raw)) {
          blankLast = true;
        }
      }

      list.items.push({
        type:  'list_item',
        raw,
        task:  !!(this.options.gfm && this.rules.other.listIsTask.test(itemSrc)),
        loose: false,
        text:  itemSrc,
        tokens: [],
      });
      list.raw += raw;
    }

    // Trim the last item
    const lastItem = list.items.at(-1);
    if (!lastItem) return;
    lastItem.raw  = lastItem.raw.trimEnd();
    lastItem.text = lastItem.text.trimEnd();
    list.raw      = list.raw.trimEnd();

    // Tokenize each item
    for (const item of list.items) {
      this.lexer.state.top = false;
      item.tokens = this.lexer.blockTokens(item.text, []);

      if (item.task) {
        item.text = item.text.replace(this.rules.other.listReplaceTask, '');
        if (item.tokens[0]?.type === 'text' || item.tokens[0]?.type === 'paragraph') {
          item.tokens[0].raw  = item.tokens[0].raw.replace(this.rules.other.listReplaceTask, '');
          item.tokens[0].text = item.tokens[0].text.replace(this.rules.other.listReplaceTask, '');
          // Also strip from the matching inlineQueue entry
          for (let q = this.lexer.inlineQueue.length - 1; q >= 0; q--) {
            if (this.rules.other.listIsTask.test(this.lexer.inlineQueue[q].src)) {
              this.lexer.inlineQueue[q].src = this.lexer.inlineQueue[q].src.replace(this.rules.other.listReplaceTask, '');
              break;
            }
          }
        }

        const checkboxMatch = this.rules.other.listTaskCheckbox.exec(item.raw);
        if (checkboxMatch) {
          const checkbox = {
            type:    'checkbox',
            raw:     checkboxMatch[0] + ' ',
            checked: checkboxMatch[0] !== '[ ]',
          };
          item.checked = checkbox.checked;

          if (list.loose) {
            if (item.tokens[0] && ['paragraph', 'text'].includes(item.tokens[0].type) && 'tokens' in item.tokens[0] && item.tokens[0].tokens) {
              item.tokens[0].raw  = checkbox.raw + item.tokens[0].raw;
              item.tokens[0].text = checkbox.raw + item.tokens[0].text;
              item.tokens[0].tokens.unshift(checkbox);
            } else {
              item.tokens.unshift({ type: 'paragraph', raw: checkbox.raw, text: checkbox.raw, tokens: [checkbox] });
            }
          } else {
            item.tokens.unshift(checkbox);
          }
        }
      }

      if (!list.loose) {
        const spaces   = item.tokens.filter((t) => t.type === 'space');
        const hasLines = spaces.length > 0 && spaces.some((t) => this.rules.other.anyLine.test(t.raw));
        list.loose     = hasLines;
      }
    }

    // Promote text tokens to paragraphs for loose lists
    if (list.loose) {
      for (const item of list.items) {
        item.loose = true;
        for (const tok of item.tokens) {
          if (tok.type === 'text') tok.type = 'paragraph';
        }
      }
    }

    return list;
  }

  html(src) {
    const cap = this.rules.block.html.exec(src);
    if (cap) {
      const raw = trimTrailingBlankLines(cap[0]);
      return {
        type:  'html',
        block: true,
        raw,
        pre:   cap[1] === 'pre' || cap[1] === 'script' || cap[1] === 'style',
        text:  raw,
      };
    }
  }

  def(src) {
    const cap = this.rules.block.def.exec(src);
    if (cap) {
      const tag   = cap[1].toLowerCase().replace(this.rules.other.multipleSpaceGlobal, ' ');
      const href  = cap[2]
        ? cap[2].replace(this.rules.other.hrefBrackets, '$1').replace(this.rules.inline.anyPunctuation, '$1')
        : '';
      const title = cap[3]
        ? cap[3].substring(1, cap[3].length - 1).replace(this.rules.inline.anyPunctuation, '$1')
        : cap[3];
      return { type: 'def', tag, raw: rtrim(cap[0], '\n'), href, title };
    }
  }

  table(src) {
    const cap = this.rules.block.table.exec(src);
    if (!cap || !this.rules.other.tableDelimiter.test(cap[2])) return;

    const headers   = splitCells(cap[1]);
    const aligns    = cap[2].replace(this.rules.other.tableAlignChars, '').split('|');
    const rowLines  = cap[3]?.trim()
      ? cap[3].replace(this.rules.other.tableRowBlankLine, '').split('\n')
      : [];

    const token = {
      type:   'table',
      raw:    rtrim(cap[0], '\n'),
      header: [],
      align:  [],
      rows:   [],
    };

    if (headers.length !== aligns.length) return;

    for (const align of aligns) {
      if      (this.rules.other.tableAlignRight.test(align))  token.align.push('right');
      else if (this.rules.other.tableAlignCenter.test(align)) token.align.push('center');
      else if (this.rules.other.tableAlignLeft.test(align))   token.align.push('left');
      else                                                     token.align.push(null);
    }

    for (let i = 0; i < headers.length; i++) {
      token.header.push({
        text:   headers[i],
        tokens: this.lexer.inline(headers[i]),
        header: true,
        align:  token.align[i],
      });
    }

    for (const row of rowLines) {
      token.rows.push(
        splitCells(row, token.header.length).map((cell, col) => ({
          text:   cell,
          tokens: this.lexer.inline(cell),
          header: false,
          align:  token.align[col],
        }))
      );
    }

    return token;
  }

  lheading(src) {
    const cap = this.rules.block.lheading.exec(src);
    if (cap) {
      const text = cap[1].trim();
      return {
        type:  'heading',
        raw:   rtrim(cap[0], '\n'),
        depth: cap[2].charAt(0) === '=' ? 1 : 2,
        text,
        tokens: this.lexer.inline(text),
      };
    }
  }

  paragraph(src) {
    const cap = this.rules.block.paragraph.exec(src);
    if (cap) {
      const text = cap[1].charAt(cap[1].length - 1) === '\n' ? cap[1].slice(0, -1) : cap[1];
      return { type: 'paragraph', raw: cap[0], text, tokens: this.lexer.inline(text) };
    }
  }

  text(src) {
    const cap = this.rules.block.text.exec(src);
    if (cap) return { type: 'text', raw: cap[0], text: cap[0], tokens: this.lexer.inline(cap[0]) };
  }

  // ---- Inline tokenizers ----

  escape(src) {
    const cap = this.rules.inline.escape.exec(src);
    if (cap) return { type: 'escape', raw: cap[0], text: cap[1] };
  }

  tag(src) {
    const cap = this.rules.inline.tag.exec(src);
    if (!cap) return;

    if (!this.lexer.state.inLink && this.rules.other.startATag.test(cap[0])) {
      this.lexer.state.inLink = true;
    } else if (this.lexer.state.inLink && this.rules.other.endATag.test(cap[0])) {
      this.lexer.state.inLink = false;
    }

    if (!this.lexer.state.inRawBlock && this.rules.other.startPreScriptTag.test(cap[0])) {
      this.lexer.state.inRawBlock = true;
    } else if (this.lexer.state.inRawBlock && this.rules.other.endPreScriptTag.test(cap[0])) {
      this.lexer.state.inRawBlock = false;
    }

    return {
      type:         'html',
      raw:          cap[0],
      inLink:       this.lexer.state.inLink,
      inRawBlock:   this.lexer.state.inRawBlock,
      block:        false,
      text:         cap[0],
    };
  }

  link(src) {
    const cap = this.rules.inline.link.exec(src);
    if (!cap) return;

    let href = cap[2].trim();

    if (!this.options.pedantic && this.rules.other.startAngleBracket.test(href)) {
      if (!this.rules.other.endAngleBracket.test(href)) return;
      const trimmedHref = rtrim(href.slice(0, -1), '\\');
      if ((href.length - trimmedHref.length) % 2 === 0) return;
    } else {
      const closingIdx = findClosingBracket(cap[2], '()');
      if (closingIdx === -2) return;
      if (closingIdx > -1) {
        const capLength = (cap[0].indexOf('!') === 0 ? 5 : 4) + cap[1].length + closingIdx;
        cap[2] = cap[2].substring(0, closingIdx);
        cap[0] = cap[0].substring(0, capLength).trim();
        cap[3] = '';
      }
    }

    let title = '';
    if (this.options.pedantic) {
      const pedanticMatch = this.rules.other.pedanticHrefTitle.exec(href);
      if (pedanticMatch) {
        href  = pedanticMatch[1];
        title = pedanticMatch[3];
      }
    } else {
      title = cap[3] ? cap[3].slice(1, -1) : '';
    }

    href = href.trim();
    if (this.rules.other.startAngleBracket.test(href)) {
      href = this.options.pedantic && !this.rules.other.endAngleBracket.test(href)
        ? href.slice(1)
        : href.slice(1, -1);
    }

    return buildOutputLink(
      cap,
      {
        href:  href  && href.replace(this.rules.inline.anyPunctuation, '$1'),
        title: title && title.replace(this.rules.inline.anyPunctuation, '$1'),
      },
      cap[0],
      this.lexer,
      this.rules
    );
  }

  reflink(src, links) {
    let cap;
    if ((cap = this.rules.inline.reflink.exec(src)) || (cap = this.rules.inline.nolink.exec(src))) {
      const ref     = (cap[2] || cap[1]).replace(this.rules.other.multipleSpaceGlobal, ' ');
      const resolved = links[ref.toLowerCase()];
      if (!resolved) {
        const first = cap[0].charAt(0);
        return { type: 'text', raw: first, text: first };
      }
      return buildOutputLink(cap, resolved, cap[0], this.lexer, this.rules);
    }
  }

  emStrong(src, maskedSrc, prevChar = '') {
    const lDelimCap = this.rules.inline.emStrongLDelim.exec(src);
    if (!lDelimCap) return;
    if (!lDelimCap[1] && !lDelimCap[2] && !lDelimCap[3] && !lDelimCap[4]) return;
    if (lDelimCap[4] && prevChar.match(this.rules.other.unicodeAlphaNumeric)) return;

    // Check left delimiter conditions
    if (!(lDelimCap[1] || lDelimCap[3] || '') || !prevChar || this.rules.inline.punctuation.exec(prevChar)) {
      const lLen    = [...lDelimCap[0]].length - 1;
      const isAst   = lDelimCap[0][0] === '*';
      const rDelim  = isAst ? this.rules.inline.emStrongRDelimAst : this.rules.inline.emStrongRDelimUnd;
      rDelim.lastIndex = 0;

      let depth        = lLen;
      let trailingLen  = 0;
      let rDelimCap;
      const slice      = maskedSrc.slice(-1 * src.length + lLen);

      while ((rDelimCap = rDelim.exec(slice)) !== null) {
        const match = rDelimCap[1] || rDelimCap[2] || rDelimCap[3] || rDelimCap[4] || rDelimCap[5] || rDelimCap[6];
        if (!match) continue;

        const rLen = [...match].length;

        if (rDelimCap[3] || rDelimCap[4]) {
          depth += rLen;
          continue;
        } else if ((rDelimCap[5] || rDelimCap[6]) && lLen % 3 && !((lLen + rLen) % 3)) {
          trailingLen += rLen;
          continue;
        }

        depth -= rLen;
        if (depth > 0) continue;

        const consumed  = Math.min(rLen, rLen + depth + trailingLen);
        const firstLen  = [...rDelimCap[0]][0].length;
        const raw       = src.slice(0, lLen + rDelimCap.index + firstLen + consumed);

        if (Math.min(lLen, consumed) % 2) {
          const inner = raw.slice(1, -1);
          return { type: 'em',     raw, text: inner, tokens: this.lexer.inlineTokens(inner) };
        }
        const inner = raw.slice(2, -2);
        return { type: 'strong', raw, text: inner, tokens: this.lexer.inlineTokens(inner) };
      }
    }
  }

  codespan(src) {
    const cap = this.rules.inline.code.exec(src);
    if (cap) {
      let text = cap[2].replace(this.rules.other.newLineCharGlobal, ' ');
      const hasNonSpace  = this.rules.other.nonSpaceChar.test(text);
      const hasBothEnds  = this.rules.other.startingSpaceChar.test(text) && this.rules.other.endingSpaceChar.test(text);
      if (hasNonSpace && hasBothEnds) text = text.substring(1, text.length - 1);
      return { type: 'codespan', raw: cap[0], text };
    }
  }

  br(src) {
    const cap = this.rules.inline.br.exec(src);
    if (cap) return { type: 'br', raw: cap[0] };
  }

  del(src, maskedSrc, prevChar = '') {
    const lCap = this.rules.inline.delLDelim.exec(src);
    if (!lCap) return;
    if (!(lCap[1] || '') || !prevChar || this.rules.inline.punctuation.exec(prevChar)) {
      const lLen    = [...lCap[0]].length - 1;
      const rDelim  = this.rules.inline.delRDelim;
      rDelim.lastIndex = 0;

      let depth = lLen;
      let rCap;
      const slice = maskedSrc.slice(-1 * src.length + lLen);

      while ((rCap = rDelim.exec(slice)) !== null) {
        const match = rCap[1] || rCap[2] || rCap[3] || rCap[4] || rCap[5] || rCap[6];
        if (!match) continue;
        const rLen = [...match].length;
        if (rLen !== lLen) continue;

        if (rCap[3] || rCap[4]) {
          depth += rLen;
          continue;
        }
        depth -= rLen;
        if (depth > 0) continue;

        const consumed = Math.min(rLen, rLen + depth);
        const firstLen = [...rCap[0]][0].length;
        const raw      = src.slice(0, lLen + rCap.index + firstLen + consumed);
        const inner    = raw.slice(lLen, -lLen);
        return { type: 'del', raw, text: inner, tokens: this.lexer.inlineTokens(inner) };
      }
    }
  }

  autolink(src) {
    const cap = this.rules.inline.autolink.exec(src);
    if (cap) {
      const text = cap[1];
      const href = cap[2] === '@' ? 'mailto:' + text : text;
      return {
        type:   'link',
        raw:    cap[0],
        text,
        href,
        tokens: [{ type: 'text', raw: text, text }],
      };
    }
  }

  url(src) {
    let cap;
    if ((cap = this.rules.inline.url.exec(src))) {
      let text, href;
      if (cap[2] === '@') {
        text = cap[0];
        href = 'mailto:' + text;
      } else {
        let prev;
        do {
          prev   = cap[0];
          cap[0] = this.rules.inline._backpedal.exec(cap[0])?.[0] ?? '';
        } while (prev !== cap[0]);
        text = cap[0];
        href = cap[1] === 'www.' ? 'http://' + cap[0] : cap[0];
      }
      return {
        type:   'link',
        raw:    cap[0],
        text,
        href,
        tokens: [{ type: 'text', raw: text, text }],
      };
    }
  }

  inlineText(src) {
    const cap = this.rules.inline.text.exec(src);
    if (cap) {
      return {
        type:    'text',
        raw:     cap[0],
        text:    cap[0],
        escaped: this.lexer.state.inRawBlock,
      };
    }
  }
}

// ---------------------------------------------------------------------------
// Lexer
// ---------------------------------------------------------------------------

class Lexer {
  constructor(options) {
    this.tokens = [];
    this.tokens.links = Object.create(null);
    this.options  = options || defaults;
    this.options.tokenizer = this.options.tokenizer || new Tokenizer();
    this.tokenizer         = this.options.tokenizer;
    this.tokenizer.options = this.options;
    this.tokenizer.lexer   = this;
    this.inlineQueue = [];
    this.state = { inLink: false, inRawBlock: false, top: true };

    const rules = { other: helpers, block: blockRules.normal, inline: inlineRules.normal };
    if (this.options.pedantic) {
      rules.block  = blockRules.pedantic;
      rules.inline = inlineRules.pedantic;
    } else if (this.options.gfm) {
      rules.block  = blockRules.gfm;
      rules.inline = this.options.breaks ? inlineRules.breaks : inlineRules.gfm;
    }
    this.tokenizer.rules = rules;
  }

  static get rules() {
    return { block: blockRules, inline: inlineRules };
  }

  static lex(src, options) {
    return new Lexer(options).lex(src);
  }

  static lexInline(src, options) {
    return new Lexer(options).inlineTokens(src);
  }

  lex(src) {
    src = src.replace(helpers.carriageReturn, '\n');
    this.blockTokens(src, this.tokens);
    for (let i = 0; i < this.inlineQueue.length; i++) {
      const entry = this.inlineQueue[i];
      this.inlineTokens(entry.src, entry.tokens);
    }
    this.inlineQueue = [];
    return this.tokens;
  }

  blockTokens(src, tokens = [], inBlockquote = false) {
    this.tokenizer.lexer = this;
    if (this.options.pedantic) {
      src = src.replace(helpers.tabCharGlobal, '    ').replace(helpers.spaceLine, '');
    }

    let safetyLen = Infinity;

    while (src) {
      if (src.length < safetyLen) {
        safetyLen = src.length;
      } else {
        this.infiniteLoopError(src.charCodeAt(0));
        break;
      }

      let tok;

      // Extension block rules
      if (this.options.extensions?.block?.some((ext) => {
        tok = ext.call({ lexer: this }, src, tokens);
        if (tok) { src = src.substring(tok.raw.length); tokens.push(tok); return true; }
        return false;
      })) continue;

      // Blank line
      if ((tok = this.tokenizer.space(src))) {
        src = src.substring(tok.raw.length);
        const prev = tokens.at(-1);
        tok.raw.length === 1 && prev !== undefined ? (prev.raw += '\n') : tokens.push(tok);
        continue;
      }
      // Indented code block
      if ((tok = this.tokenizer.code(src))) {
        src = src.substring(tok.raw.length);
        const prev = tokens.at(-1);
        if (prev?.type === 'paragraph' || prev?.type === 'text') {
          prev.raw  += (prev.raw.endsWith('\n') ? '' : '\n') + tok.raw;
          prev.text += '\n' + tok.text;
          this.inlineQueue.at(-1).src = prev.text;
        } else {
          tokens.push(tok);
        }
        continue;
      }
      if ((tok = this.tokenizer.fences(src)))    { src = src.substring(tok.raw.length); tokens.push(tok); continue; }
      if ((tok = this.tokenizer.heading(src)))   { src = src.substring(tok.raw.length); tokens.push(tok); continue; }
      if ((tok = this.tokenizer.hr(src)))        { src = src.substring(tok.raw.length); tokens.push(tok); continue; }
      if ((tok = this.tokenizer.blockquote(src))){ src = src.substring(tok.raw.length); tokens.push(tok); continue; }
      if ((tok = this.tokenizer.list(src)))      { src = src.substring(tok.raw.length); tokens.push(tok); continue; }
      if ((tok = this.tokenizer.html(src)))      { src = src.substring(tok.raw.length); tokens.push(tok); continue; }

      // Link definition
      if ((tok = this.tokenizer.def(src))) {
        src = src.substring(tok.raw.length);
        const prev = tokens.at(-1);
        if (prev?.type === 'paragraph' || prev?.type === 'text') {
          prev.raw  += (prev.raw.endsWith('\n') ? '' : '\n') + tok.raw;
          prev.text += '\n' + tok.raw;
          this.inlineQueue.at(-1).src = prev.text;
        } else if (!this.tokens.links[tok.tag]) {
          this.tokens.links[tok.tag] = { href: tok.href, title: tok.title };
          tokens.push(tok);
        }
        continue;
      }

      if ((tok = this.tokenizer.table(src)))  { src = src.substring(tok.raw.length); tokens.push(tok); continue; }
      if ((tok = this.tokenizer.lheading(src))){ src = src.substring(tok.raw.length); tokens.push(tok); continue; }

      // Potentially-truncated src for extension start-block support
      let cutSrc = src;
      if (this.options.extensions?.startBlock) {
        let earliest = Infinity;
        const rest   = src.slice(1);
        this.options.extensions.startBlock.forEach((ext) => {
          const idx = ext.call({ lexer: this }, rest);
          if (typeof idx === 'number' && idx >= 0) earliest = Math.min(earliest, idx);
        });
        if (earliest < Infinity && earliest >= 0) cutSrc = src.substring(0, earliest + 1);
      }

      if (this.state.top && (tok = this.tokenizer.paragraph(cutSrc))) {
        const prev = tokens.at(-1);
        if (inBlockquote && prev?.type === 'paragraph') {
          prev.raw  += (prev.raw.endsWith('\n') ? '' : '\n') + tok.raw;
          prev.text += '\n' + tok.text;
          this.inlineQueue.pop();
          this.inlineQueue.at(-1).src = prev.text;
        } else {
          tokens.push(tok);
        }
        inBlockquote = cutSrc.length !== src.length;
        src = src.substring(tok.raw.length);
        continue;
      }

      if ((tok = this.tokenizer.text(src))) {
        src = src.substring(tok.raw.length);
        const prev = tokens.at(-1);
        if (prev?.type === 'text') {
          prev.raw  += (prev.raw.endsWith('\n') ? '' : '\n') + tok.raw;
          prev.text += '\n' + tok.text;
          this.inlineQueue.pop();
          this.inlineQueue.at(-1).src = prev.text;
        } else {
          tokens.push(tok);
        }
        continue;
      }

      if (src) { this.infiniteLoopError(src.charCodeAt(0)); break; }
    }

    this.state.top = true;
    return tokens;
  }

  inline(src, tokens = []) {
    this.inlineQueue.push({ src, tokens });
    return tokens;
  }

  inlineTokens(src, tokens = []) {
    this.tokenizer.lexer = this;

    let masked = src;
    let match  = null;

    // Mask ref-link bodies so inner punctuation doesn't confuse em/strong parsing
    if (this.tokens.links) {
      const keys = Object.keys(this.tokens.links);
      if (keys.length > 0) {
        while ((match = this.tokenizer.rules.inline.reflinkSearch.exec(masked)) !== null) {
          if (keys.includes(match[0].slice(match[0].lastIndexOf('[') + 1, -1))) {
            masked = masked.slice(0, match.index) + '[' + 'a'.repeat(match[0].length - 2) + ']' + masked.slice(this.tokenizer.rules.inline.reflinkSearch.lastIndex);
          }
        }
      }
    }

    // Mask escaped punctuation
    while ((match = this.tokenizer.rules.inline.anyPunctuation.exec(masked)) !== null) {
      masked = masked.slice(0, match.index) + '++' + masked.slice(this.tokenizer.rules.inline.anyPunctuation.lastIndex);
    }

    // Mask block-skip regions (links / code spans / HTML tags)
    while ((match = this.tokenizer.rules.inline.blockSkip.exec(masked)) !== null) {
      const innerLen = match[2] ? match[2].length : 0;
      masked = masked.slice(0, match.index + innerLen) + '[' + 'a'.repeat(match[0].length - innerLen - 2) + ']' + masked.slice(this.tokenizer.rules.inline.blockSkip.lastIndex);
    }

    // Optional emStrong masking hook
    masked = this.options.hooks?.emStrongMask?.call({ lexer: this }, masked) ?? masked;

    let keepPrev  = false;
    let prevChar  = '';
    let safetyLen = Infinity;

    while (src) {
      if (src.length < safetyLen) {
        safetyLen = src.length;
      } else {
        this.infiniteLoopError(src.charCodeAt(0));
        break;
      }

      if (!keepPrev) prevChar = '';
      keepPrev = false;

      let tok;

      // Extension inline rules
      if (this.options.extensions?.inline?.some((ext) => {
        tok = ext.call({ lexer: this }, src, tokens);
        if (tok) { src = src.substring(tok.raw.length); tokens.push(tok); return true; }
        return false;
      })) continue;

      if ((tok = this.tokenizer.escape(src)))   { src = src.substring(tok.raw.length); tokens.push(tok); continue; }
      if ((tok = this.tokenizer.tag(src)))      { src = src.substring(tok.raw.length); tokens.push(tok); continue; }
      if ((tok = this.tokenizer.link(src)))     { src = src.substring(tok.raw.length); tokens.push(tok); continue; }

      if ((tok = this.tokenizer.reflink(src, this.tokens.links))) {
        src = src.substring(tok.raw.length);
        const prev = tokens.at(-1);
        if (tok.type === 'text' && prev?.type === 'text') {
          prev.raw  += tok.raw;
          prev.text += tok.text;
        } else {
          tokens.push(tok);
        }
        continue;
      }

      if ((tok = this.tokenizer.emStrong(src, masked, prevChar))) { src = src.substring(tok.raw.length); tokens.push(tok); continue; }
      if ((tok = this.tokenizer.codespan(src)))  { src = src.substring(tok.raw.length); tokens.push(tok); continue; }
      if ((tok = this.tokenizer.br(src)))        { src = src.substring(tok.raw.length); tokens.push(tok); continue; }
      if ((tok = this.tokenizer.del(src, masked, prevChar))) { src = src.substring(tok.raw.length); tokens.push(tok); continue; }
      if ((tok = this.tokenizer.autolink(src))) { src = src.substring(tok.raw.length); tokens.push(tok); continue; }
      if (!this.state.inLink && (tok = this.tokenizer.url(src))) { src = src.substring(tok.raw.length); tokens.push(tok); continue; }

      // Cut src for extension startInline positions
      let cutSrc = src;
      if (this.options.extensions?.startInline) {
        let earliest = Infinity;
        const rest   = src.slice(1);
        this.options.extensions.startInline.forEach((ext) => {
          const idx = ext.call({ lexer: this }, rest);
          if (typeof idx === 'number' && idx >= 0) earliest = Math.min(earliest, idx);
        });
        if (earliest < Infinity && earliest >= 0) cutSrc = src.substring(0, earliest + 1);
      }

      if ((tok = this.tokenizer.inlineText(cutSrc))) {
        src = src.substring(tok.raw.length);
        if (tok.raw.slice(-1) !== '_') prevChar = tok.raw.slice(-1);
        keepPrev = true;
        const prev = tokens.at(-1);
        if (prev?.type === 'text') {
          prev.raw  += tok.raw;
          prev.text += tok.text;
        } else {
          tokens.push(tok);
        }
        continue;
      }

      if (src) { this.infiniteLoopError(src.charCodeAt(0)); break; }
    }

    return tokens;
  }

  infiniteLoopError(code) {
    const msg = 'Infinite loop on byte: ' + code;
    if (this.options.silent) {
      console.error(msg);
    } else {
      throw new Error(msg);
    }
  }
}

// ---------------------------------------------------------------------------
// Renderer
// ---------------------------------------------------------------------------

class Renderer {
  constructor(options) {
    this.options = options || defaults;
  }

  space(_token)  { return ''; }
  hr(_token)     { return '<hr>\n'; }
  br(_token)     { return '<br>'; }
  def(_token)    { return ''; }

  code({ text, lang, escaped }) {
    const langStr = (lang || '').match(helpers.notSpaceStart)?.[0];
    const body    = text.replace(helpers.endingNewline, '') + '\n';
    return langStr
      ? `<pre><code class="language-${escape(langStr)}">${escaped ? body : escape(body, true)}</code></pre>\n`
      : `<pre><code>${escaped ? body : escape(body, true)}</code></pre>\n`;
  }

  blockquote({ tokens }) {
    return `<blockquote>\n${this.parser.parse(tokens)}</blockquote>\n`;
  }

  html({ text }) { return text; }

  heading({ tokens, depth }) {
    return `<h${depth}>${this.parser.parseInline(tokens)}</h${depth}>\n`;
  }

  list(token) {
    const tag     = token.ordered ? 'ol' : 'ul';
    const start   = token.ordered && token.start !== 1 ? ` start="${token.start}"` : '';
    const body    = token.items.map((item) => this.listitem(item)).join('');
    return `<${tag}${start}>\n${body}</${tag}>\n`;
  }

  listitem(token) {
    return `<li>${this.parser.parse(token.tokens)}</li>\n`;
  }

  checkbox({ checked }) {
    return '<input ' + (checked ? 'checked="" ' : '') + 'disabled="" type="checkbox"> ';
  }

  paragraph({ tokens }) {
    return `<p>${this.parser.parseInline(tokens)}</p>\n`;
  }

  table(token) {
    let headerRow = '';
    for (const cell of token.header) headerRow += this.tablecell(cell);
    let body = '';
    for (const row of token.rows) {
      let rowHtml = '';
      for (const cell of row) rowHtml += this.tablecell(cell);
      body += this.tablerow({ text: rowHtml });
    }
    if (body) body = `<tbody>${body}</tbody>`;
    return `<table>\n<thead>\n${this.tablerow({ text: headerRow })}</thead>\n${body}</table>\n`;
  }

  tablerow({ text }) {
    return `<tr>\n${text}</tr>\n`;
  }

  tablecell(token) {
    const content = this.parser.parseInline(token.tokens);
    const tag     = token.header ? 'th' : 'td';
    const align   = token.align ? ` align="${token.align}"` : '';
    return `<${tag}${align}>${content}</${tag}>\n`;
  }

  strong({ tokens }) { return `<strong>${this.parser.parseInline(tokens)}</strong>`; }
  em({ tokens })     { return `<em>${this.parser.parseInline(tokens)}</em>`; }
  codespan({ text }) { return `<code>${escape(text, true)}</code>`; }
  del({ tokens })    { return `<del>${this.parser.parseInline(tokens)}</del>`; }

  link({ href, title, tokens }) {
    const text    = this.parser.parseInline(tokens);
    const cleaned = cleanUrl(href);
    if (cleaned === null) return text;
    let html = `<a href="${cleaned}"`;
    if (title) html += ` title="${escape(title)}"`;
    html += `>${text}</a>`;
    return html;
  }

  image({ href, title, text, tokens }) {
    if (tokens) text = this.parser.parseInline(tokens, this.parser.textRenderer);
    const cleaned = cleanUrl(href);
    if (cleaned === null) return escape(text);
    let html = `<img src="${cleaned}" alt="${escape(text)}"`;
    if (title) html += ` title="${escape(title)}"`;
    html += '>';
    return html;
  }

  text(token) {
    if ('tokens' in token && token.tokens) return this.parser.parseInline(token.tokens);
    if ('escaped' in token && token.escaped) return token.text;
    return escape(token.text);
  }
}

// ---------------------------------------------------------------------------
// TextRenderer  (strips all markup, returns plain text)
// ---------------------------------------------------------------------------

class TextRenderer {
  strong({ text })   { return text; }
  em({ text })       { return text; }
  codespan({ text }) { return text; }
  del({ text })      { return text; }
  html({ text })     { return text; }
  text({ text })     { return text; }
  link({ text })     { return '' + text; }
  image({ text })    { return '' + text; }
  br()               { return ''; }
  checkbox({ raw })  { return raw; }
}

// ---------------------------------------------------------------------------
// Parser
// ---------------------------------------------------------------------------

class Parser {
  constructor(options) {
    this.options      = options || defaults;
    this.options.renderer = this.options.renderer || new Renderer();
    this.renderer     = this.options.renderer;
    this.renderer.options = this.options;
    this.renderer.parser  = this;
    this.textRenderer = new TextRenderer();
  }

  static parse(tokens, options) {
    return new Parser(options).parse(tokens);
  }

  static parseInline(tokens, options) {
    return new Parser(options).parseInline(tokens);
  }

  parse(tokens) {
    this.renderer.parser = this;
    let out = '';

    for (const token of tokens) {
      // Extension renderers first
      if (this.options.extensions?.renderers?.[token.type]) {
        const result = this.options.extensions.renderers[token.type].call({ parser: this }, token);
        if (result !== false || !['space','hr','heading','code','table','blockquote','list','html','def','paragraph','text'].includes(token.type)) {
          out += result || '';
          continue;
        }
      }

      switch (token.type) {
        case 'space':      out += this.renderer.space(token);      break;
        case 'hr':         out += this.renderer.hr(token);         break;
        case 'heading':    out += this.renderer.heading(token);    break;
        case 'code':       out += this.renderer.code(token);       break;
        case 'table':      out += this.renderer.table(token);      break;
        case 'blockquote': out += this.renderer.blockquote(token); break;
        case 'list':       out += this.renderer.list(token);       break;
        case 'checkbox':   out += this.renderer.checkbox(token);   break;
        case 'html':       out += this.renderer.html(token);       break;
        case 'def':        out += this.renderer.def(token);        break;
        case 'paragraph':  out += this.renderer.paragraph(token);  break;
        case 'text':       out += this.renderer.text(token);       break;
        default: {
          const msg = `Token with "${token.type}" type was not found.`;
          if (this.options.silent) { console.error(msg); return ''; }
          throw new Error(msg);
        }
      }
    }

    return out;
  }

  parseInline(tokens, renderer = this.renderer) {
    this.renderer.parser = this;
    let out = '';

    for (const token of tokens) {
      // Extension renderers first
      if (this.options.extensions?.renderers?.[token.type]) {
        const result = this.options.extensions.renderers[token.type].call({ parser: this }, token);
        if (result !== false || !['escape','html','link','image','strong','em','codespan','br','del','text'].includes(token.type)) {
          out += result || '';
          continue;
        }
      }

      switch (token.type) {
        case 'escape':   out += renderer.text(token);     break;
        case 'html':     out += renderer.html(token);     break;
        case 'link':     out += renderer.link(token);     break;
        case 'image':    out += renderer.image(token);    break;
        case 'checkbox': out += renderer.checkbox(token); break;
        case 'strong':   out += renderer.strong(token);   break;
        case 'em':       out += renderer.em(token);       break;
        case 'codespan': out += renderer.codespan(token); break;
        case 'br':       out += renderer.br(token);       break;
        case 'del':      out += renderer.del(token);      break;
        case 'text':     out += renderer.text(token);     break;
        default: {
          const msg = `Token with "${token.type}" type was not found.`;
          if (this.options.silent) { console.error(msg); return ''; }
          throw new Error(msg);
        }
      }
    }

    return out;
  }
}

// ---------------------------------------------------------------------------
// Hooks
// ---------------------------------------------------------------------------

class Hooks {
  constructor(options) {
    this.options = options || defaults;
  }

  static passThroughHooks = new Set(['preprocess', 'postprocess', 'processAllTokens', 'emStrongMask']);
  static passThroughHooksRespectAsync = new Set(['preprocess', 'postprocess', 'processAllTokens']);

  preprocess(src)    { return src; }
  postprocess(html)  { return html; }
  processAllTokens(tokens) { return tokens; }
  emStrongMask(src)  { return src; }

  provideLexer(block = this.block) {
    return block ? Lexer.lex : Lexer.lexInline;
  }

  provideParser(block = this.block) {
    return block ? Parser.parse : Parser.parseInline;
  }
}

// ---------------------------------------------------------------------------
// Marked  (main class)
// ---------------------------------------------------------------------------

class Marked {
  constructor(...extensions) {
    this.defaults     = getDefaults();
    this.options      = this.setOptions.bind(this);
    this.parse        = this._parseMarkdown(true);
    this.parseInline  = this._parseMarkdown(false);
    this.Parser       = Parser;
    this.Renderer     = Renderer;
    this.TextRenderer = TextRenderer;
    this.Lexer        = Lexer;
    this.Tokenizer    = Tokenizer;
    this.Hooks        = Hooks;

    this.use(...extensions);
  }

  walkTokens(tokens, callback) {
    let results = [];
    for (const token of tokens) {
      results = results.concat(callback.call(this, token));
      switch (token.type) {
        case 'table': {
          for (const cell of token.header) results = results.concat(this.walkTokens(cell.tokens, callback));
          for (const row of token.rows) {
            for (const cell of row) results = results.concat(this.walkTokens(cell.tokens, callback));
          }
          break;
        }
        case 'list': {
          results = results.concat(this.walkTokens(token.items, callback));
          break;
        }
        default: {
          if (this.defaults.extensions?.childTokens?.[token.type]) {
            this.defaults.extensions.childTokens[token.type].forEach((childKey) => {
              const childTokens = token[childKey].flat(Infinity);
              results = results.concat(this.walkTokens(childTokens, callback));
            });
          } else if (token.tokens) {
            results = results.concat(this.walkTokens(token.tokens, callback));
          }
        }
      }
    }
    return results;
  }

  use(...extensions) {
    const combined = this.defaults.extensions || { renderers: {}, childTokens: {} };

    extensions.forEach((ext) => {
      const opts = { ...ext };
      opts.async = this.defaults.async || opts.async || false;

      // ---- Custom token extensions ----
      if (ext.extensions) {
        ext.extensions.forEach((rule) => {
          if (!rule.name) throw new Error('extension name required');

          if ('renderer' in rule) {
            const prev = combined.renderers[rule.name];
            combined.renderers[rule.name] = prev
              ? function (...args) {
                  const r = rule.renderer.apply(this, args);
                  return r === false ? prev.apply(this, args) : r;
                }
              : rule.renderer;
          }

          if ('tokenizer' in rule) {
            if (!rule.level || !['block', 'inline'].includes(rule.level)) {
              throw new Error("extension level must be 'block' or 'inline'");
            }
            combined[rule.level] = combined[rule.level] || [];
            combined[rule.level].unshift(rule.tokenizer);
            if (rule.start) {
              const key = rule.level === 'block' ? 'startBlock' : 'startInline';
              combined[key] = combined[key] || [];
              combined[key].push(rule.start);
            }
          }

          if ('childTokens' in rule && rule.childTokens) {
            combined.childTokens[rule.name] = rule.childTokens;
          }
        });
        opts.extensions = combined;
      }

      // ---- Custom renderer ----
      if (ext.renderer) {
        const baseRenderer = this.defaults.renderer || new Renderer(this.defaults);
        for (const key in ext.renderer) {
          if (!(key in baseRenderer)) throw new Error(`renderer '${key}' does not exist`);
          if (['options', 'parser'].includes(key)) continue;

          const override = ext.renderer[key];
          const original = baseRenderer[key];
          baseRenderer[key] = (...args) => {
            const result = override.apply(baseRenderer, args);
            return result === false ? (original.apply(baseRenderer, args) || '') : (result || '');
          };
        }
        opts.renderer = baseRenderer;
      }

      // ---- Custom tokenizer ----
      if (ext.tokenizer) {
        const baseTok = this.defaults.tokenizer || new Tokenizer(this.defaults);
        for (const key in ext.tokenizer) {
          if (!(key in baseTok)) throw new Error(`tokenizer '${key}' does not exist`);
          if (['options', 'rules', 'lexer'].includes(key)) continue;

          const override = ext.tokenizer[key];
          const original = baseTok[key];
          baseTok[key] = (...args) => {
            const result = override.apply(baseTok, args);
            return result === false ? original.apply(baseTok, args) : result;
          };
        }
        opts.tokenizer = baseTok;
      }

      // ---- Custom hooks ----
      if (ext.hooks) {
        const baseHooks = this.defaults.hooks || new Hooks();
        for (const key in ext.hooks) {
          if (!(key in baseHooks)) throw new Error(`hook '${key}' does not exist`);
          if (['options', 'block'].includes(key)) continue;

          const override = ext.hooks[key];
          const original = baseHooks[key];

          if (Hooks.passThroughHooks.has(key)) {
            baseHooks[key] = (arg) => {
              if (this.defaults.async && Hooks.passThroughHooksRespectAsync.has(key)) {
                return (async () => {
                  const r = await override.call(baseHooks, arg);
                  return original.call(baseHooks, r);
                })();
              }
              const r = override.call(baseHooks, arg);
              return original.call(baseHooks, r);
            };
          } else {
            baseHooks[key] = (...args) => {
              if (this.defaults.async) {
                return (async () => {
                  let r = await override.apply(baseHooks, args);
                  if (r === false) r = await original.apply(baseHooks, args);
                  return r;
                })();
              }
              let r = override.apply(baseHooks, args);
              if (r === false) r = original.apply(baseHooks, args);
              return r;
            };
          }
        }
        opts.hooks = baseHooks;
      }

      // ---- walkTokens ----
      if (ext.walkTokens) {
        const prevWalk  = this.defaults.walkTokens;
        const newWalk   = ext.walkTokens;
        opts.walkTokens = function (token) {
          let results = [];
          results.push(newWalk.call(this, token));
          if (prevWalk) results = results.concat(prevWalk.call(this, token));
          return results;
        };
      }

      this.defaults = { ...this.defaults, ...opts };
    });

    return this;
  }

  setOptions(options) {
    this.defaults = { ...this.defaults, ...options };
    return this;
  }

  lexer(src, options) {
    return Lexer.lex(src, options ?? this.defaults);
  }

  parser(tokens, options) {
    return Parser.parse(tokens, options ?? this.defaults);
  }

  _parseMarkdown(parseBlock) {
    return (src, userOptions) => {
      const opts    = { ...this.defaults, ...(userOptions || {}) };
      const onError = this._onError(!!opts.silent, !!opts.async);

      if (this.defaults.async === true && userOptions?.async === false) {
        return onError(new Error('marked(): The async option was set to true by an extension. Remove async: false from the parse options object to return a Promise.'));
      }
      if (src === undefined || src === null) {
        return onError(new Error('marked(): input parameter is undefined or null'));
      }
      if (typeof src !== 'string') {
        return onError(new Error('marked(): input parameter is of type ' + Object.prototype.toString.call(src) + ', string expected'));
      }

      if (opts.hooks) {
        opts.hooks.options = opts;
        opts.hooks.block   = parseBlock;
      }

      if (opts.async) {
        return (async () => {
          try {
            let text    = opts.hooks ? await opts.hooks.preprocess(src) : src;
            let tokens  = await (opts.hooks ? await opts.hooks.provideLexer(parseBlock) : (parseBlock ? Lexer.lex : Lexer.lexInline))(text, opts);
            tokens      = opts.hooks ? await opts.hooks.processAllTokens(tokens) : tokens;
            if (opts.walkTokens) await Promise.all(this.walkTokens(tokens, opts.walkTokens));
            let html    = await (opts.hooks ? await opts.hooks.provideParser(parseBlock) : (parseBlock ? Parser.parse : Parser.parseInline))(tokens, opts);
            return opts.hooks ? await opts.hooks.postprocess(html) : html;
          } catch (e) {
            return onError(e);
          }
        })();
      }

      try {
        let text   = opts.hooks ? opts.hooks.preprocess(src) : src;
        let tokens = (opts.hooks ? opts.hooks.provideLexer(parseBlock) : (parseBlock ? Lexer.lex : Lexer.lexInline))(text, opts);
        tokens     = opts.hooks ? opts.hooks.processAllTokens(tokens) : tokens;
        if (opts.walkTokens) this.walkTokens(tokens, opts.walkTokens);
        let html   = (opts.hooks ? opts.hooks.provideParser(parseBlock) : (parseBlock ? Parser.parse : Parser.parseInline))(tokens, opts);
        return opts.hooks ? opts.hooks.postprocess(html) : html;
      } catch (e) {
        return onError(e);
      }
    };
  }

  _onError(silent, isAsync) {
    return (err) => {
      err.message += '\nPlease report this to https://github.com/markedjs/marked.';
      if (silent) {
        const html = '<p>An error occurred:</p><pre>' + escape(err.message + '', true) + '</pre>';
        return isAsync ? Promise.resolve(html) : html;
      }
      if (isAsync) return Promise.reject(err);
      throw err;
    };
  }
}

// ---------------------------------------------------------------------------
// Top-level `marked` function (mirrors the upstream API)
// ---------------------------------------------------------------------------

const markedInstance = new Marked();

function marked(src, options) {
  return markedInstance.parse(src, options);
}

marked.options = marked.setOptions = function (options) {
  markedInstance.setOptions(options);
  marked.defaults = markedInstance.defaults;
  changeDefaults(marked.defaults);
  return marked;
};

marked.getDefaults = getDefaults;
marked.defaults    = defaults;

marked.use = function (...extensions) {
  markedInstance.use(...extensions);
  marked.defaults = markedInstance.defaults;
  changeDefaults(marked.defaults);
  return marked;
};

marked.walkTokens   = (tokens, callback) => markedInstance.walkTokens(tokens, callback);
marked.parseInline  = markedInstance.parseInline.bind(markedInstance);
marked.Parser       = Parser;
marked.parser       = Parser.parse;
marked.Renderer     = Renderer;
marked.TextRenderer = TextRenderer;
marked.Lexer        = Lexer;
marked.lexer        = Lexer.lex;
marked.Tokenizer    = Tokenizer;
marked.Hooks        = Hooks;
marked.parse        = marked;

// Expose on globalThis so a plain <script> tag "just works"
globalThis.marked = marked;

// Also support CommonJS / module environments
if (typeof module !== 'undefined' && module.exports) {
  module.exports = marked;
}
