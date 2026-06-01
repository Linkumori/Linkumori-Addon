/*
 * ============================================================
 * Linkumori — Enhanced Custom Rules Editor
 * (with Provider Import Feature and Provider List Modal)
 * ============================================================
 * Copyright (c) 2025 Subham Mahesh
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
 * MODIFICATIONS
 * -------------
 * - Added provider import functionality from bundle/remote rules
 * - Enhanced provider browsing with search and selection
 * - Support for importing from different rule sources
 * - Multi-select provider import with conflict resolution
 * - Real-time provider preview and statistics
 * - Enhanced UI with provider cards and filtering
 * - Added provider list and disabled-rules full-page flows
 * - Fully internationalized (i18n) provider list/editor interface
 * - Added TextMate-style JSON syntax highlighting for the advanced editor
 *
 * ============================================================
 * SVG ICON ATTRIBUTIONS
 * ============================================================
 *
 * EMBEDDED ICONS — Google Material Icons (Modified)
 * --------------------------------------------------
 * License:   Apache License 2.0
 * Source:    https://fonts.google.com/icons
 * Docs:      https://developers.google.com/fonts/docs/material_icons#licensing
 *
 * Note: All icons are embedded in generated HTML via JavaScript.
 * Modifications by Subham Mahesh — see modification history below.
 *
 * - Arrow Drop Down Icon  — derivative of arrow-drop.svg
 *                           fill=currentColor (orig: #e3e3e3),
 *                           width=24, height=24, viewBox/path unchanged
 *                           Used in: FAQ accordion questions
 *
 * - Edit Icon             — derivative of edit.svg
 *                           width=12 (orig: 24), height=12 (orig: 24),
 *                           fill=currentColor (orig: #e3e3e3),
 *                           viewBox/path unchanged
 *                           Used in: provider list edit buttons
 *
 * - Copy/Duplicate Icon   — derivative of copy.svg
 *                           width=12 (orig: 24), height=12 (orig: 24),
 *                           fill=currentColor (orig: #e3e3e3),
 *                           viewBox/path unchanged
 *                           Used in: provider duplicate buttons
 *
 * - Delete Icon           — derivative of delete.svg
 *                           width=12 (orig: 24), height=12 (orig: 24),
 *                           fill=currentColor (orig: #e3e3e3),
 *                           viewBox/path unchanged
 *                           Used in: provider delete buttons
 *
 * - Plus/Add Icon         — derivative of plus.svg
 *                           width=14 (orig: 24), height=14 (orig: 24),
 *                           fill=currentColor (orig: #e3e3e3),
 *                           viewBox/path unchanged
 *                           Used in: add provider actions
 *
 * - Success/Check Icon    — derivative of correct-check.svg
 *                           width=14 (orig: 24), height=14 (orig: 24),
 *                           fill=currentColor (orig: #e3e3e3),
 *                           viewBox/path unchanged
 *                           Used in: enforce rules success feedback
 *
 * - Warning Triangle Icon — derivative of warning.svg
 *                           width=14 (orig: 24), height=14 (orig: 24),
 *                           fill=currentColor (orig: #e3e3e3),
 *                           viewBox/path unchanged
 *                           Used in: enforce rules error feedback
 *
 * ============================================================
 * MODIFICATION HISTORY
 * ============================================================
 * 2025-06-14   Subham Mahesh   File created
 * 2025-08-21   Subham Mahesh   Google Material icon assets updated
 * 2025-09-05   Subham Mahesh   Google Material icon assets updated
 * 2026-04-19   Subham Mahesh   Added JSON editor highlighting; updated icon attribution wording
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

// Global state
let customRules = { providers: {} };
let currentProvider = null;
let isEditing = false;
let hasUnsavedChanges = false;

// Provider import state
let availableRuleSources = {};
let selectedProviders = new Set();
let currentRuleSource = 'bundled';
const IMPORT_EXCLUSIONS_KEY = 'customrules_import_exclusions';
const {
    THEME_STORAGE_KEY,
    LAST_DARK_THEME_STORAGE_KEY,
    LIGHT_THEME_STORAGE_KEY,
    DARK_THEME_STORAGE_KEY,
    DEFAULT_THEME,
    buildThemeTogglePayload,
    syncBootstrapTheme,
    normalizeTheme
} = globalThis.LinkumoriTheme;
let importExclusionsBySource = {};
let clearURLsDisabledRuleIds = [];
let clearURLsProviderSnapshot = null;
let disabledRulesActivationMode = 'pattern';
let userWhitelist = [];
let whitelistSearchTerm = '';
let whitelistStatusTimer = null;

// DOM elements
let providerList, editorContent, editorTitle, editorStatus, saveBtn, editNameBtn, deleteBtn, exitBtn;
let providerModal, providerForm, modalTitle, importFileInput;
let faqModal, faqBtn;
let providerImportModal, providerImportBtn;
let disabledRulesView, disabledRulesBtn;
let providerListView, providerListBtn; // Provider list page view elements
let ruleTestModal = null;
let applyCustomRulesView = null;

// ============================================================================
// LINKUMORI I18N NUMBER LOCALIZATION HELPER FUNCTIONS
// ============================================================================

/**
 * Get localized number string using LinkumoriI18n
 * @param {number} number - Number to localize
 * @returns {string} Localized number string
 */
function getLocalizedNumber(number) {
    try {
        if (typeof LinkumoriI18n !== 'undefined') {
            if (typeof LinkumoriI18n.formatNumber === 'function') {
                return LinkumoriI18n.formatNumber(number, { maximumFractionDigits: 0 });
            }
            if (typeof LinkumoriI18n.localizeNumbers === 'function') {
                return LinkumoriI18n.localizeNumbers(String(number));
            }
        }
    } catch (_) {
    }
    return String(number);
}

function normalizeIndexPatternValue(value) {
    const values = Array.isArray(value)
        ? value
        : (typeof value === 'string'
            ? value.split(/\r?\n|,/)
            : []);
    const normalized = [...new Set(values
        .filter(item => typeof item === 'string')
        .map(item => item.trim())
        .filter(Boolean))];
    if (normalized.length === 0) return '';
    return normalized.length === 1 ? normalized[0] : normalized;
}

function formatIndexPatternValue(value) {
    return Array.isArray(value)
        ? value.filter(item => typeof item === 'string' && item.trim()).join('\n')
        : (typeof value === 'string' ? value : '');
}

function normalizeDomainRedirectionEntry(rule) {
    if (typeof rule === 'string') {
        return rule.trim();
    }
    if (!isPlainObject(rule)) {
        return null;
    }

    const pattern = typeof rule.match === 'string' ? rule.match : rule.matchPattern;
    const action = isPlainObject(rule.action) ? rule.action : null;
    const target = action && typeof action.replacePattern === 'string'
        ? action.replacePattern
        : rule.replacePattern;

    if (typeof pattern !== 'string' || typeof target !== 'string') {
        return null;
    }

    const normalizedPattern = pattern.trim();
    const normalizedTarget = target.trim();
    return normalizedPattern && normalizedTarget
        ? `${normalizedPattern}$redirect=${normalizedTarget}`
        : null;
}

function assertDomainRedirectionSyntax(provider, providerName = '') {
    const rules = Array.isArray(provider?.domainRedirections) ? provider.domainRedirections : [];
    const normalizedRules = [];
    rules.forEach((rule, index) => {
        const normalizedRule = normalizeDomainRedirectionEntry(rule);
        if (typeof normalizedRule !== 'string') {
            throw new Error(`${providerName || 'Provider'}: domainRedirections[${index}] must be a string or redirect rule object`);
        }
        const markerIndex = normalizedRule.indexOf('$redirect=');
        const pattern = markerIndex === -1 ? '' : normalizedRule.slice(0, markerIndex).trim();
        const target = markerIndex === -1 ? '' : normalizedRule.slice(markerIndex + '$redirect='.length).trim();
        if (!pattern || !target) {
            throw new Error(`${providerName || 'Provider'}: invalid domainRedirections entry "${normalizedRule}"`);
        }
        normalizedRules.push(normalizedRule);
    });
    if (provider && Array.isArray(provider.domainRedirections)) {
        provider.domainRedirections = normalizedRules;
    }
}

const OBJECT_STYLE_RULE_FIELDS = Object.freeze([
    'rules',
    'rawRules',
    'referralMarketing',
    'redirections'
]);

const CORE_RULE_ID_PATTERN = /^[a-z0-9][a-z0-9_-]*$/;

function isPlainObject(value) {
    return !!value && typeof value === 'object' && !Array.isArray(value);
}

function countRuleEntries(entries) {
    return Array.isArray(entries) ? entries.length : 0;
}

function getEffectiveRuleKind(rule, fieldName) {
    if (rule && typeof rule.kind === 'string') return rule.kind;
    if (fieldName === 'rawRules') return 'raw';
    if (fieldName === 'redirections') return 'redirection';
    return 'field';
}

function getEffectiveActionType(rule, fieldName) {
    if (rule && isPlainObject(rule.action) && typeof rule.action.type === 'string') {
        return rule.action.type;
    }
    if (fieldName === 'redirections') return 'redirect';
    if (rule && typeof rule.replacePattern === 'string' && rule.replacePattern !== '') return 'rewrite';
    return 'remove';
}

function assertCoreSupportedAction(rule, providerName, fieldName, index) {
    const prefix = `${providerName || 'Provider'}: ${fieldName}[${index}]`;
    const kind = getEffectiveRuleKind(rule, fieldName);
    const actionType = getEffectiveActionType(rule, fieldName);

    if (kind === 'field' && actionType === 'redirect') {
        throw new Error(`${prefix}: field rules do not support redirect actions`);
    }
    if (kind === 'raw' && actionType === 'redirect') {
        throw new Error(`${prefix}: raw rules do not support redirect actions`);
    }
    if (kind === 'redirection' && actionType !== 'redirect') {
        throw new Error(`${prefix}: redirection rules must use a redirect action`);
    }
}

function assertPreprocessorSyntax(preprocessor, prefix) {
    if (!isPlainObject(preprocessor)) {
        throw new Error(`${prefix} must be an object`);
    }
    assertOnlyKeys(preprocessor, ['type', 'inputs'], prefix);
    if (typeof preprocessor.type !== 'string' || preprocessor.type.trim() === '') {
        throw new Error(`${prefix}.type must be a non-empty string`);
    }
    const supported = [
        'urlEncode',
        'urlDecode',
        'doubleUrlEncode',
        'urlEncodeRepeated',
        'doubleUrlDecode',
        'urlDecodeRepeated',
        'base64Encode',
        'base64Decode'
    ];
    if (!supported.includes(preprocessor.type)) {
        throw new Error(`${prefix}.type is not supported`);
    }
    if (preprocessor.inputs !== 'all' &&
        (!Array.isArray(preprocessor.inputs) ||
            preprocessor.inputs.some(input => !Number.isInteger(input) || input < 1))) {
        throw new Error(`${prefix}.inputs must be "all" or an array of positive integers`);
    }
}

function assertObjectStyleRuleSyntax(rule, providerName, fieldName, index) {
    const prefix = `${providerName || 'Provider'}: ${fieldName}[${index}]`;
    if (!isPlainObject(rule)) {
        throw new Error(`${prefix} must be a string or rule object`);
    }

    const usesCanonicalShape = typeof rule.match === 'string';
    const match = usesCanonicalShape ? rule.match : rule.matchPattern;
    if (typeof match !== 'string') {
        throw new Error(`${prefix}.${usesCanonicalShape ? 'match' : 'matchPattern'} must be a string`);
    }
    if (rule.replacePattern !== undefined && typeof rule.replacePattern !== 'string') {
        throw new Error(`${prefix}.replacePattern must be a string`);
    }
    if (rule.action !== undefined) {
        if (!isPlainObject(rule.action) || !['remove', 'rewrite', 'redirect'].includes(rule.action.type)) {
            throw new Error(`${prefix}.action must be remove, rewrite, or redirect`);
        }
        if ((rule.action.type === 'rewrite' || rule.action.type === 'redirect') && typeof rule.action.replacePattern !== 'string') {
            throw new Error(`${prefix}.action.replacePattern must be a string`);
        }
    }
    if (rule.kind !== undefined && !['field', 'raw', 'redirection'].includes(rule.kind)) {
        throw new Error(`${prefix}.kind must be field, raw, or redirection`);
    }
    if (rule.flags !== undefined && typeof rule.flags !== 'string') {
        throw new Error(`${prefix}.flags must be a string`);
    }
    if (rule.active !== undefined && typeof rule.active !== 'boolean') {
        throw new Error(`${prefix}.active must be a boolean`);
    }
    if (rule.activeDefault !== undefined && typeof rule.activeDefault !== 'boolean') {
        throw new Error(`${prefix}.activeDefault must be a boolean`);
    }
    if (rule.id !== undefined && typeof rule.id !== 'string') {
        throw new Error(`${prefix}.id must be a string`);
    }
    if (rule.id !== undefined && !CORE_RULE_ID_PATTERN.test(rule.id)) {
        throw new Error(`${prefix}.id must match ${CORE_RULE_ID_PATTERN.source}`);
    }
    if (rule.aliases !== undefined && (!Array.isArray(rule.aliases) || rule.aliases.some(item => typeof item !== 'string'))) {
        throw new Error(`${prefix}.aliases must be an array of strings`);
    }
    if (Array.isArray(rule.aliases)) {
        rule.aliases.forEach((alias, aliasIndex) => {
            if (!CORE_RULE_ID_PATTERN.test(alias)) {
                throw new Error(`${prefix}.aliases[${aliasIndex}] must match ${CORE_RULE_ID_PATTERN.source}`);
            }
        });
        if (typeof rule.id === 'string' && rule.aliases.includes(rule.id)) {
            throw new Error(`${prefix}.aliases must not contain the rule id itself`);
        }
        if (new Set(rule.aliases).size !== rule.aliases.length) {
            throw new Error(`${prefix}.aliases must be unique`);
        }
    }
    if (rule.description !== undefined && typeof rule.description !== 'string') {
        throw new Error(`${prefix}.description must be a string`);
    }
    if (rule.referralMarketing !== undefined && typeof rule.referralMarketing !== 'boolean') {
        throw new Error(`${prefix}.referralMarketing must be a boolean`);
    }
    if (rule.exceptions !== undefined &&
        (!Array.isArray(rule.exceptions) || rule.exceptions.some(item => typeof item !== 'string'))) {
        throw new Error(`${prefix}.exceptions must be an array of strings`);
    }
    if (rule.requestTypes !== undefined && rule.requestTypes !== 'all' &&
        (!Array.isArray(rule.requestTypes) || rule.requestTypes.some(item => typeof item !== 'string'))) {
        throw new Error(`${prefix}.requestTypes must be "all" or an array of strings`);
    }
    if (rule.preprocessors !== undefined && !Array.isArray(rule.preprocessors)) {
        throw new Error(`${prefix}.preprocessors must be an array`);
    }
    (rule.preprocessors || []).forEach((preprocessor, preprocessorIndex) => {
        assertPreprocessorSyntax(preprocessor, `${prefix}.preprocessors[${preprocessorIndex}]`);
    });
    if (usesCanonicalShape && typeof rule.id !== 'string') {
        throw new Error(`${prefix}.id is required for canonical rule objects`);
    }

    new RegExp(match, rule.flags === undefined ? 'i' : rule.flags);
    (rule.exceptions || []).forEach(exception => new RegExp(exception, 'i'));
    assertCoreSupportedAction(rule, providerName, fieldName, index);
}

function assertRuleEntrySyntax(provider, providerName = '') {
    const occupiedNames = new Map();
    OBJECT_STYLE_RULE_FIELDS.forEach((fieldName) => {
        const entries = provider[fieldName];
        if (!Array.isArray(entries)) {
            return;
        }
        entries.forEach((entry, index) => {
            if (typeof entry === 'string') {
                return;
            }
            assertObjectStyleRuleSyntax(entry, providerName, fieldName, index);
            const names = [];
            if (typeof entry.id === 'string') names.push(entry.id);
            if (Array.isArray(entry.aliases)) names.push(...entry.aliases);
            names.forEach((name) => {
                const firstSeenAt = occupiedNames.get(name);
                const here = `${fieldName}[${index}]`;
                if (firstSeenAt) {
                    throw new Error(`${providerName || 'Provider'} reuses rule id or alias "${name}" in ${here}; first used in ${firstSeenAt}`);
                }
                occupiedNames.set(name, here);
            });
        });
    });
}

// i18n helper function
function i18n(key, ...substitutions) {
    return LinkumoriI18n.getMessage(key, substitutions);
}

const JSON_TEXTMATE_GRAMMAR = Object.freeze({
    name: 'JSON',
    scopeName: 'source.json',
    fileTypes: Object.freeze(['json']),
    patterns: Object.freeze([
        { include: '#object' },
        { include: '#array' },
        { include: '#string' },
        { include: '#number' },
        { include: '#constant' },
        { include: '#punctuation' },
        { include: '#invalid' }
    ]),
    repository: Object.freeze({
        object: Object.freeze({
            name: 'meta.structure.dictionary.json',
            begin: '\\{',
            beginCaptures: Object.freeze({
                0: Object.freeze({ name: 'punctuation.definition.dictionary.begin.json' })
            }),
            end: '\\}',
            endCaptures: Object.freeze({
                0: Object.freeze({ name: 'punctuation.definition.dictionary.end.json' })
            }),
            patterns: Object.freeze([
                { include: '#property' },
                { include: '#array' },
                { include: '#string' },
                { include: '#number' },
                { include: '#constant' },
                { include: '#punctuation' },
                { include: '#invalid' }
            ])
        }),
        array: Object.freeze({
            name: 'meta.structure.array.json',
            begin: '\\[',
            beginCaptures: Object.freeze({
                0: Object.freeze({ name: 'punctuation.definition.array.begin.json' })
            }),
            end: '\\]',
            endCaptures: Object.freeze({
                0: Object.freeze({ name: 'punctuation.definition.array.end.json' })
            }),
            patterns: Object.freeze([
                { include: '#object' },
                { include: '#array' },
                { include: '#string' },
                { include: '#number' },
                { include: '#constant' },
                { include: '#punctuation' },
                { include: '#invalid' }
            ])
        }),
        property: Object.freeze({
            name: 'meta.object-literal.key.json',
            begin: '"',
            beginCaptures: Object.freeze({
                0: Object.freeze({ name: 'punctuation.definition.string.begin.json' })
            }),
            end: '"\\s*(?=:)',
            endCaptures: Object.freeze({
                0: Object.freeze({ name: 'punctuation.definition.string.end.json' })
            }),
            contentName: 'entity.name.tag.json',
            patterns: Object.freeze([{ include: '#escape' }])
        }),
        string: Object.freeze({
            name: 'string.quoted.double.json',
            begin: '"',
            beginCaptures: Object.freeze({
                0: Object.freeze({ name: 'punctuation.definition.string.begin.json' })
            }),
            end: '"',
            endCaptures: Object.freeze({
                0: Object.freeze({ name: 'punctuation.definition.string.end.json' })
            }),
            patterns: Object.freeze([{ include: '#escape' }])
        }),
        escape: Object.freeze({
            name: 'constant.character.escape.json',
            match: '\\\\(?:["\\\\/bfnrt]|u[0-9a-fA-F]{4})'
        }),
        number: Object.freeze({
            name: 'constant.numeric.json',
            match: '-?(?:0|[1-9]\\d*)(?:\\.\\d+)?(?:[eE][+-]?\\d+)?'
        }),
        constant: Object.freeze({
            name: 'constant.language.json',
            match: '\\b(?:true|false|null)\\b'
        }),
        punctuation: Object.freeze({
            name: 'punctuation.separator.dictionary.pair.json',
            match: '[{}\\[\\]:,]'
        }),
        invalid: Object.freeze({
            name: 'invalid.illegal.unexpected-token.json',
            match: '\\S'
        })
    })
});

function getJsonTextMateRule(ruleName) {
    return JSON_TEXTMATE_GRAMMAR.repository[ruleName] || null;
}

function getJsonTextMateScope(ruleName, fieldName = 'name', fallback = 'source.json') {
    const rule = getJsonTextMateRule(ruleName);
    return (rule && rule[fieldName]) || fallback;
}

function getJsonTextMateCaptureScope(ruleName, fieldName, fallback) {
    const rule = getJsonTextMateRule(ruleName);
    return (rule && rule[fieldName] && rule[fieldName][0] && rule[fieldName][0].name) || fallback;
}

function getJsonTextMateClass(scopeName) {
    switch (scopeName) {
        case 'entity.name.tag.json':
            return 'tm-json-key';
        case 'string.quoted.double.json':
            return 'tm-json-string';
        case 'constant.character.escape.json':
            return 'tm-json-escape';
        case 'constant.numeric.json':
            return 'tm-json-number';
        case 'constant.language.json':
            return 'tm-json-constant';
        case 'punctuation.definition.string.begin.json':
        case 'punctuation.definition.string.end.json':
        case 'punctuation.definition.dictionary.json':
        case 'punctuation.definition.dictionary.begin.json':
        case 'punctuation.definition.dictionary.end.json':
        case 'punctuation.definition.array.begin.json':
        case 'punctuation.definition.array.end.json':
        case 'punctuation.separator.dictionary.pair.json':
            return 'tm-json-punctuation';
        case 'invalid.illegal.json':
        case 'invalid.illegal.unexpected-token.json':
            return 'tm-json-invalid';
        default:
            return 'tm-json-text';
    }
}

function wrapJsonTextMateToken(value, scopeName) {
    const className = getJsonTextMateClass(scopeName);
    return `<span class="tm-json ${className}" data-tm-scope="${scopeName}">${escapeHtml(value)}</span>`;
}

function renderJsonTextMateStringContent(value, scopeName) {
    const className = getJsonTextMateClass(scopeName);
    const escapeScope = getJsonTextMateScope('escape', 'name', 'constant.character.escape.json');
    let html = '';
    for (let i = 0; i < value.length; i++) {
        if (value[i] === '\\' && i + 1 < value.length) {
            html += wrapJsonTextMateToken(value.slice(i, i + 2), escapeScope);
            i++;
        } else {
            html += escapeHtml(value[i]);
        }
    }
    return `<span class="tm-json ${className}" data-tm-scope="${scopeName}">${html}</span>`;
}

function renderJsonTextMateString(value, ruleName) {
    const rule = getJsonTextMateRule(ruleName) || getJsonTextMateRule('string');
    const contentScope = rule.contentName || rule.name || 'string.quoted.double.json';
    const beginScope = getJsonTextMateCaptureScope(ruleName, 'beginCaptures', 'punctuation.definition.string.begin.json');
    const endScope = getJsonTextMateCaptureScope(ruleName, 'endCaptures', 'punctuation.definition.string.end.json');
    const hasClosingQuote = value.length > 1 && value[value.length - 1] === '"';
    const contentEnd = hasClosingQuote ? value.length - 1 : value.length;

    let html = wrapJsonTextMateToken(value[0], beginScope);
    if (contentEnd > 1) {
        html += renderJsonTextMateStringContent(value.slice(1, contentEnd), contentScope);
    }
    if (hasClosingQuote) {
        html += wrapJsonTextMateToken(value[value.length - 1], endScope);
    }
    return html;
}

function readJsonStringEnd(text, start) {
    let index = start + 1;
    while (index < text.length) {
        const character = text[index];
        if (character === '\\') {
            index += 2;
            continue;
        }
        if (character === '"') {
            return index + 1;
        }
        index++;
    }
    return index;
}

function isJsonPropertyName(text, stringEnd) {
    let index = stringEnd;
    while (index < text.length && /\s/.test(text[index])) {
        index++;
    }
    return text[index] === ':';
}

function highlightJsonWithTextMateGrammar(text) {
    if (!text) {
        return ' ';
    }

    let html = '';
    let index = 0;

    while (index < text.length) {
        const character = text[index];

        if (/\s/.test(character)) {
            html += escapeHtml(character);
            index++;
            continue;
        }

        if (character === '"') {
            const end = readJsonStringEnd(text, index);
            const value = text.slice(index, end);
            const ruleName = isJsonPropertyName(text, end) ? 'property' : 'string';
            html += renderJsonTextMateString(value, ruleName);
            index = end;
            continue;
        }

        const rest = text.slice(index);
        const numberRule = getJsonTextMateRule('number');
        const numberMatch = rest.match(new RegExp(`^${numberRule.match}`));
        if (numberMatch) {
            html += wrapJsonTextMateToken(numberMatch[0], numberRule.name);
            index += numberMatch[0].length;
            continue;
        }

        const constantRule = getJsonTextMateRule('constant');
        const constantMatch = rest.match(new RegExp(`^${constantRule.match}`));
        if (constantMatch) {
            html += wrapJsonTextMateToken(constantMatch[0], constantRule.name);
            index += constantMatch[0].length;
            continue;
        }

        const punctuationRule = getJsonTextMateRule('punctuation');
        if (new RegExp(`^${punctuationRule.match}$`).test(character)) {
            html += wrapJsonTextMateToken(character, punctuationRule.name);
            index++;
            continue;
        }

        html += wrapJsonTextMateToken(character, getJsonTextMateScope('invalid', 'name', 'invalid.illegal.json'));
        index++;
    }

    return html;
}

function syncJsonTextMateScroll(jsonEditor) {
    const highlightLayer = document.getElementById('json-editor-highlight');
    if (!jsonEditor || !highlightLayer) {
        return;
    }
    highlightLayer.style.transform = `translate(${-jsonEditor.scrollLeft}px, ${-jsonEditor.scrollTop}px)`;
}

function updateJsonTextMateHighlighting(jsonEditor = document.getElementById('json-editor')) {
    const highlightLayer = document.getElementById('json-editor-highlight');
    if (!jsonEditor || !highlightLayer) {
        return;
    }
    const parser = new DOMParser();
    const highlightDoc = parser.parseFromString(
        `<pre>${highlightJsonWithTextMateGrammar(jsonEditor.value)}</pre>`,
        'text/html'
    );
    highlightLayer.replaceChildren(...highlightDoc.body.firstElementChild.childNodes);
    syncJsonTextMateScroll(jsonEditor);
}

function modalAlert(message) {
    if (window.LinkumoriModal && typeof window.LinkumoriModal.alert === 'function') {
        return window.LinkumoriModal.alert(message);
    }
    console.warn('Modal API missing, alert suppressed:', message);
    return Promise.resolve();
}

function modalConfirm(message) {
    if (window.LinkumoriModal && typeof window.LinkumoriModal.confirm === 'function') {
        return window.LinkumoriModal.confirm(message);
    }
    console.warn('Modal API missing, confirm defaulted to false:', message);
    return Promise.resolve(false);
}

function getHashStatusText(hashStatus) {
    if (!hashStatus) {
        return i18n('status_unknown');
    }

    let statusText = hashStatus;

    switch (hashStatus) {
        case 'remote_verified':
            statusText = i18n('hashStatus_remote_verified');
            break;
        case 'remote_built_in_merged':
            statusText = i18n('hashStatus_remote_built_in_merged');
            break;
        case 'remote_built_in_merged_custom':
            statusText = i18n('hashStatus_remote_built_in_merged_custom');
            break;
        case 'remote_failed':
            statusText = i18n('hashStatus_remote_failed');
            break;
        case 'hash_url_missing':
            statusText = i18n('hashStatus_hash_url_missing');
            break;
        case 'remote_rules_loaded':
            statusText = i18n('remote_rules_loaded');
            break;
        case 'remote_custom_rules_merged':
            statusText = i18n('hash_status_remote_custom_merged');
            break;

        case 'bundled_rules_loaded':
            statusText = i18n('status_builtinOnly');
            break;
        case 'bundled_rules_fallback':
            statusText = i18n('hashStatus_bundled_rules_fallback');
            break;
        case 'custom_only_loaded':
            statusText = i18n('hashStatus_custom_only_loaded');
            break;
        case 'custom_only_no_rules':
            statusText = i18n('hashStatus_custom_only_no_rules');
            break;
        case 'bundled_fallback_loaded':
            statusText = i18n('hashStatus_bundled_fallback_loaded');
            break;

        case 'fallback_rules_used':
            statusText = i18n('status_usingFallback');
            break;
        case 'fallback_rules_used_after_remote_failure':
            statusText = i18n('hashStatus_fallback_rules_used_after_remote_failure');
            break;
        case 'fallback_rules_loaded':
            statusText = i18n('fallback_rules_loaded');
            break;

        case 'cached_rules_used':
            statusText = i18n('status_usingCached');
            break;

        case 'cache_remote_rules_no_hashurl':
            statusText = i18n('hashStatus_cache_remote_rules_no_hashurl');
            break;
        case 'cache_remote_rules_after_remote_failure':
            statusText = i18n('hashStatus_cache_remote_rules_after_remote_failure');
            break;
        case 'cache_remote_rules_after_bundled_failure':
            statusText = i18n('hashStatus_cache_remote_rules_after_bundled_failure');
            break;
        case 'cache_remote_built_in_merged':
            statusText = i18n('hashStatus_cache_remote_built_in_merged');
            break;

        case 'cache_remote_custom_rules_no_hashurl':
            statusText = i18n('hashStatus_cache_remote_custom_rules_no_hashurl');
            break;
        case 'cache_remote_custom_rules_after_remote_failure':
            statusText = i18n('hashStatus_cache_remote_custom_rules_after_remote_failure');
            break;
        case 'cache_remote_custom_rules_after_bundled_failure':
            statusText = i18n('hashStatus_cache_remote_custom_rules_after_bundled_failure');
            break;
        case 'cache_remote_built_in_merged_custom':
            statusText = i18n('hashStatus_cache_remote_built_in_merged_custom');
            break;

        case 'custom_rules_merged':
            statusText = i18n('status_customMerged');
            break;
        case 'custom_rules_failed':
            statusText = i18n('status_customFailed');
            break;
    }

    return statusText;
}

function setHTMLContent(element, html) {
    if (!element) return;
    const parser = new DOMParser();
    const doc = parser.parseFromString(`<!doctype html><body>${html || ''}</body>`, 'text/html');
    element.replaceChildren(...Array.from(doc.body.childNodes));
}

function toDomainPatternArray(value) {
    if (Array.isArray(value)) {
        return value
            .filter(item => typeof item === 'string')
            .map(item => item.trim())
            .filter(item => item.length > 0);
    }

    if (typeof value === 'string' && value.trim().length > 0) {
        return [value.trim()];
    }

    return [];
}

function getProviderSignature(provider) {
    if (!provider || typeof provider !== 'object') {
        return '';
    }

    const urlPattern = typeof provider.urlPattern === 'string'
        ? provider.urlPattern.trim()
        : '';
    if (urlPattern) {
        return `url:${urlPattern}`;
    }

    const domainPatterns = toDomainPatternArray(provider.domainPatterns)
        .map(pattern => pattern.trim())
        .filter(pattern => pattern.length > 0);
    if (domainPatterns.length > 0) {
        const normalized = [...new Set(domainPatterns)].sort((a, b) => a.localeCompare(b));
        return `domain:${normalized.join('||')}`;
    }

    return '';
}

async function loadImportExclusions() {
    try {
        const result = await browser.storage.local.get([IMPORT_EXCLUSIONS_KEY]);
        const stored = result && result[IMPORT_EXCLUSIONS_KEY];
        if (!stored || typeof stored !== 'object' || Array.isArray(stored)) {
            importExclusionsBySource = {};
            return;
        }

        const normalized = {};
        Object.entries(stored).forEach(([source, signatures]) => {
            if (!Array.isArray(signatures)) {
                return;
            }
            const cleaned = signatures
                .filter(sig => typeof sig === 'string' && sig.trim().length > 0)
                .map(sig => sig.trim());
            if (cleaned.length > 0) {
                normalized[source] = [...new Set(cleaned)];
            }
        });
        importExclusionsBySource = normalized;
    } catch (_) {
        importExclusionsBySource = {};
    }
}

async function saveImportExclusions() {
    await browser.storage.local.set({
        [IMPORT_EXCLUSIONS_KEY]: importExclusionsBySource
    });
}

function getExcludedSignaturesForSource(source) {
    const signatures = importExclusionsBySource[source];
    if (!Array.isArray(signatures)) {
        return new Set();
    }
    return new Set(signatures);
}

function getSignatureLabel(signature) {
    if (typeof signature !== 'string') {
        return '';
    }
    if (signature.startsWith('url:')) {
        return signature.substring(4);
    }
    if (signature.startsWith('urlPattern:')) {
        return signature.substring(11);
    }
    if (signature.startsWith('domain:')) {
        return signature.substring(7);
    }
    if (signature.startsWith('domainPattern:')) {
        return signature.substring(14);
    }
    return signature;
}

function getRuleSourceLabel(source) {
    if (source === 'bundled') {
        return i18n('providerImport_activeProviderRules');
    }
    if (source === 'clearurls-rule-ids') {
        return i18n('providerImport_providerRuleIds');
    }
    return source;
}

function getRuleSourceType(source) {
    return availableRuleSources[source]?.type || 'providers';
}

function normalizeClearURLsDisabledRuleIdsValue(value) {
    if (!value) return [];
    if (typeof value === 'string') {
        try {
            return normalizeClearURLsDisabledRuleIdsValue(JSON.parse(value));
        } catch (_) {
            return value.split(/\r?\n/).map(ruleId => ruleId.trim()).filter(Boolean);
        }
    }
    if (Array.isArray(value)) {
        return [...new Set(value.map(ruleId => String(ruleId || '').trim()).filter(Boolean))];
    }
    return [];
}

async function loadClearURLsDisabledRuleIds() {
    try {
        const response = await browser.runtime.sendMessage({
            function: 'getData',
            params: ['clearurls_disabled_rule_ids']
        });
        clearURLsDisabledRuleIds = normalizeClearURLsDisabledRuleIdsValue(response?.response);
    } catch (_) {
        clearURLsDisabledRuleIds = [];
    }
}

async function loadClearURLsProviderSnapshot() {
    try {
        const response = await browser.runtime.sendMessage({
            function: 'getData',
            params: ['clearurlsProviderSnapshot']
        });
        clearURLsProviderSnapshot = response?.response && typeof response.response === 'object'
            ? response.response
            : null;
    } catch (_) {
        clearURLsProviderSnapshot = null;
    }
}

async function saveClearURLsDisabledRuleIds() {
    await browser.runtime.sendMessage({
        function: 'setData',
        params: ['clearurls_disabled_rule_ids', JSON.stringify(clearURLsDisabledRuleIds)]
    });
}

function buildProviderRuntimeRuleId(providerName, ruleId) {
    return `${providerName}::${ruleId}`;
}

function buildProviderPatternRuntimeRuleId(scopeId, ruleId) {
    return `${scopeId}::${ruleId}`;
}

function getProviderRuleScopeAliases(scopeId) {
    const value = String(scopeId || '').trim();
    if (!value) return [];
    const aliases = [value];
    if (value.startsWith('domainPattern:')) {
        aliases.push(`domain:${value.substring(14)}`);
    } else if (value.startsWith('urlPattern:')) {
        aliases.push(`url:${value.substring(11)}`);
    } else if (value.startsWith('domain:')) {
        aliases.push(`domainPattern:${value.substring(7)}`);
    } else if (value.startsWith('url:')) {
        aliases.push(`urlPattern:${value.substring(4)}`);
    }
    return aliases;
}

function getProviderRuleActivationScopeIds(providerName, provider) {
    const urlPattern = typeof provider?.urlPattern === 'string'
        ? provider.urlPattern.trim()
        : '';
    if (urlPattern) {
        return [`urlPattern:${urlPattern}`];
    }

    const domainPatterns = [...new Set(toDomainPatternArray(provider?.domainPatterns))];
    if (domainPatterns.length > 0) {
        return domainPatterns.map(pattern => `domainPattern:${pattern}`);
    }

    return [providerName];
}

function getProviderRuleDisableKeys(scopeId, ruleId, aliases = [], legacyProviderName = '') {
    const scopeAliases = getProviderRuleScopeAliases(scopeId);
    return [
        ...scopeAliases.map(scope => buildProviderPatternRuntimeRuleId(scope, ruleId)),
        ruleId,
        ...aliases.flatMap(alias => scopeAliases.map(scope => buildProviderPatternRuntimeRuleId(scope, alias))),
        ...aliases,
        legacyProviderName ? buildProviderRuntimeRuleId(legacyProviderName, ruleId) : '',
        ...aliases.map(alias => legacyProviderName ? buildProviderRuntimeRuleId(legacyProviderName, alias) : '')
    ].filter(Boolean);
}

function collectProviderRuleIdEntries(providerName, provider) {
    if (!providerName || !provider || typeof provider !== 'object') {
        return [];
    }

    const entries = [];
    const activationScopeIds = getProviderRuleActivationScopeIds(providerName, provider);
    const sections = ['rules', 'rawRules', 'referralMarketing', 'redirections', 'exceptions'];
    sections.forEach(section => {
        const rules = provider[section];
        if (!Array.isArray(rules)) {
            return;
        }
        rules.forEach((rule, index) => {
            if (!rule || typeof rule !== 'object' || typeof rule.id !== 'string' || !rule.id.trim()) {
                return;
            }

            const aliases = Array.isArray(rule.aliases)
                ? rule.aliases.map(alias => String(alias || '').trim()).filter(Boolean)
                : [];
            const disabledIds = new Set(clearURLsDisabledRuleIds);
            activationScopeIds.forEach(scopeId => {
                const runtimeId = buildProviderPatternRuntimeRuleId(scopeId, rule.id);
                const disableKeys = getProviderRuleDisableKeys(scopeId, rule.id, aliases, providerName);
                const disabled = disableKeys.some(key => disabledIds.has(key));

                entries.push({
                    section,
                    index,
                    id: rule.id,
                    runtimeId,
                    scopeId,
                    providerName,
                    aliases,
                    disableKeys,
                    kind: rule.kind || (section === 'rawRules' ? 'raw' : (section === 'redirections' ? 'redirection' : 'field')),
                    match: typeof rule.match === 'string' ? rule.match : '',
                    disabled
                });
            });
        });
    });

    return entries;
}

function renderProviderRuleIdControls(providerName, provider) {
    const container = document.getElementById('provider-rule-id-controls');
    if (!container) {
        return;
    }

    const entries = collectProviderRuleIdEntries(providerName, provider);
    if (entries.length === 0) {
        setHTMLContent(container, `
            <div class="json-key-toolbar-help">${i18n('providerImport_noRuleIds')}</div>
        `);
        return;
    }

    const rows = entries.map(entry => {
        const aliasText = entry.aliases.length > 0 ? ` aliases: ${entry.aliases.join(', ')}` : '';
        const matchText = entry.match ? ` · ${entry.match}` : '';
        const scopeText = entry.scopeId ? ` · ${entry.scopeId}` : '';
        const providerText = entry.providerName ? `${entry.providerName} · ` : '';
        return `
            <li class="provider-disabled-item provider-rule-id-item" data-rule-id="${escapeHtml(entry.runtimeId)}" data-runtime-id="${escapeHtml(entry.runtimeId)}">
                <input type="hidden" class="provider-rule-id-disable-keys" value="${escapeHtml(JSON.stringify(entry.disableKeys))}">
                <span class="provider-disabled-signature" title="${escapeHtml(entry.runtimeId)}">
                    <strong>${escapeHtml(entry.id)}</strong>
                    <span class="provider-disabled-source">${escapeHtml(providerText)}${escapeHtml(entry.section)} · ${escapeHtml(entry.kind)}${escapeHtml(scopeText)}${escapeHtml(matchText)}${escapeHtml(aliasText)}</span>
                </span>
                <button type="button" class="btn btn-sm ${entry.disabled ? 'btn-secondary provider-rule-id-restore-btn' : 'btn-warning provider-rule-id-disable-btn'}">
                    ${entry.disabled ? i18n('providerImport_disabledRestore') : i18n('providerImport_disable')}
                </button>
            </li>
        `;
    }).join('');

    setHTMLContent(container, `
        <ul class="provider-disabled-list">${rows}</ul>
    `);
}

function renderProviderRuleIdControlsFromEditor() {
    if (!currentProvider) {
        return;
    }
    const jsonEditor = document.getElementById('json-editor');
    if (!jsonEditor) {
        return;
    }
    try {
        renderProviderRuleIdControls(currentProvider, JSON.parse(jsonEditor.value));
    } catch (_) {
        const container = document.getElementById('provider-rule-id-controls');
        if (container) {
            setHTMLContent(container, `
                <div class="json-key-toolbar-help">${i18n('providerImport_ruleIdsRequireValidJson')}</div>
            `);
        }
    }
}

async function setClearURLsProviderRuleDisabled(ruleId, shouldDisable, equivalentIds = []) {
    const normalizedId = String(ruleId || '').trim();
    if (!normalizedId) {
        return;
    }

    const disabledSet = new Set(clearURLsDisabledRuleIds);
    if (shouldDisable) {
        disabledSet.add(normalizedId);
    } else {
        disabledSet.delete(normalizedId);
        equivalentIds.forEach(ruleId => disabledSet.delete(ruleId));
    }
    clearURLsDisabledRuleIds = Array.from(disabledSet);
    await saveClearURLsDisabledRuleIds();
    await reloadRulesAfterExclusionChange();
    updateSourceCounts();
    renderProviderRuleIdControlsFromEditor();
}

async function removeExcludedSignature(source, signature) {
    const excludedSet = getExcludedSignaturesForSource(source);
    if (!excludedSet.has(signature)) {
        return;
    }
    excludedSet.delete(signature);
    if (excludedSet.size === 0) {
        delete importExclusionsBySource[source];
    } else {
        importExclusionsBySource[source] = Array.from(excludedSet);
    }
    await saveImportExclusions();
}

async function clearExcludedSignatures(source) {
    if (!importExclusionsBySource[source]) {
        return;
    }
    delete importExclusionsBySource[source];
    await saveImportExclusions();
}

async function reloadRulesAfterExclusionChange() {
    try {
        await browser.runtime.sendMessage({
            function: "reloadCustomRules"
        });
    } catch (_) {
    }
    await updateRulesStatus();
}

function renderImportDisabledList() {
    const listEl = document.getElementById('provider-import-disabled-list');
    const emptyEl = document.getElementById('provider-import-disabled-empty');
    const clearBtn = document.getElementById('provider-import-disabled-clear-btn');
    if (!listEl || !emptyEl || !clearBtn) {
        return;
    }

    const signatures = Array.from(getExcludedSignaturesForSource(currentRuleSource));
    const hasItems = signatures.length > 0;
    listEl.replaceChildren();
    emptyEl.style.display = hasItems ? 'none' : '';
    clearBtn.disabled = !hasItems;

    signatures.sort((a, b) => a.localeCompare(b));
    signatures.forEach(signature => {
        const li = document.createElement('li');
        li.className = 'provider-disabled-item';
        li.dataset.signature = signature;
        setHTMLContent(li, `
            <span class="provider-disabled-signature" title="${escapeHtml(signature)}">${escapeHtml(getSignatureLabel(signature))}</span>
            <button type="button" class="btn btn-sm btn-secondary provider-disabled-restore-btn">${i18n('providerImport_disabledRestore')}</button>
        `);

        const restoreBtn = li.querySelector('.provider-disabled-restore-btn');
        if (restoreBtn) {
            restoreBtn.addEventListener('click', async () => {
                await removeExcludedSignature(currentRuleSource, signature);
                await reloadRulesAfterExclusionChange();
                renderImportDisabledList();
                loadProvidersForSource(currentRuleSource);
                updateSourceCounts();
            });
        }

        listEl.appendChild(li);
    });
}

function isProviderExcluded(source, provider) {
    const signature = getProviderSignature(provider);
    if (!signature) {
        return false;
    }
    return getExcludedSignaturesForSource(source).has(signature);
}

async function excludeProviderSignature(source, providerName) {
    return excludeProviderSignatureInternal(source, providerName, {
        requireConfirm: true,
        showAlert: true,
        refreshUI: true,
        reloadRules: true
    });
}

async function excludeProviderSignatureInternal(source, providerName, options = {}) {
    const {
        requireConfirm = true,
        showAlert = true,
        refreshUI = true,
        reloadRules = true
    } = options;

    const sourceRules = availableRuleSources[source];
    const provider = sourceRules?.providers?.[providerName];
    if (!provider) {
        return { excluded: false, removedFromCustom: 0 };
    }

    const signature = getProviderSignature(provider);
    if (!signature) {
        if (showAlert) {
            await modalAlert(i18n('providerImport_excludeNoPattern'));
        }
        return { excluded: false, removedFromCustom: 0 };
    }

    if (requireConfirm) {
        const confirmed = await modalConfirm(i18n('providerImport_confirmExclude'));
        if (!confirmed) {
            return { excluded: false, removedFromCustom: 0 };
        }
    }

    const excludedSet = getExcludedSignaturesForSource(source);
    if (excludedSet.has(signature)) {
        return { excluded: false, removedFromCustom: 0 };
    }

    excludedSet.add(signature);
    importExclusionsBySource[source] = Array.from(excludedSet);
    await saveImportExclusions();
    selectedProviders.delete(providerName);

    let removedFromCustom = 0;
    const customProviderNames = Object.keys(customRules.providers || {});
    customProviderNames.forEach(name => {
        const customProvider = customRules.providers[name];
        if (getProviderSignature(customProvider) === signature) {
            delete customRules.providers[name];
            removedFromCustom++;
            selectedProviders.delete(name);
            if (currentProvider === name) {
                currentProvider = null;
                isEditing = false;
                hasUnsavedChanges = false;
            }
        }
    });

    if (removedFromCustom > 0) {
        await saveCustomRules();
    } else if (reloadRules) {
        await reloadRulesAfterExclusionChange();
    }

    if (refreshUI) {
        updateProviderCount();
        updateSelectionCount();
        renderImportDisabledList();
        loadProvidersForSource(source);
    }

    if (showAlert) {
        const removedCountText = getLocalizedNumber(removedFromCustom);
        await modalAlert(i18n('providerImport_excludedSuccess', removedCountText));
    }

    return { excluded: true, removedFromCustom };
}

async function disableSelectedProviders() {
    const selectedNames = Array.from(selectedProviders);
    if (selectedNames.length === 0) {
        return;
    }

    const countText = getLocalizedNumber(selectedNames.length);
    const confirmed = await modalConfirm(i18n('providerImport_disableSelectedConfirm', countText));
    if (!confirmed) {
        return;
    }

    let excludedCount = 0;
    let removedFromCustomTotal = 0;

    for (const providerName of selectedNames) {
        const result = await excludeProviderSignatureInternal(currentRuleSource, providerName, {
            requireConfirm: false,
            showAlert: false,
            refreshUI: false,
            reloadRules: false
        });

        if (result.excluded) {
            excludedCount++;
            removedFromCustomTotal += result.removedFromCustom || 0;
        }
    }

    selectedProviders.clear();
    updateProviderCount();
    updateSelectionCount();
    renderImportDisabledList();
    loadProvidersForSource(currentRuleSource);
    updateSourceCounts();

    if (excludedCount > 0) {
        if (removedFromCustomTotal > 0) {
            await saveCustomRules();
        } else {
            await reloadRulesAfterExclusionChange();
        }
    }

    const excludedText = getLocalizedNumber(excludedCount);
    const removedText = getLocalizedNumber(removedFromCustomTotal);
    await modalAlert(i18n('providerImport_disableSelectedResult', excludedText, removedText));
}

function domainToPunycode(domain) {
    if (!domain || typeof domain !== 'string') {
        return domain;
    }

    try {
        if (domain.startsWith('*.')) {
            const baseDomain = domain.substring(2);
            const punycodeBase = punycode.toASCII(baseDomain);
            return '*.' + punycodeBase;
        }

        return punycode.toASCII(domain);
    } catch (_) {
        return domain;
    }
}

function domainToUnicode(domain) {
    if (!domain || typeof domain !== 'string') {
        return domain;
    }

    try {
        if (domain.startsWith('*.')) {
            const baseDomain = domain.substring(2);
            const unicodeBase = punycode.toUnicode(baseDomain);
            return '*.' + unicodeBase;
        }

        return punycode.toUnicode(domain);
    } catch (_) {
        return domain;
    }
}

function normalizeDomain(domain) {
    if (!domain || typeof domain !== 'string') {
        return domain;
    }

    return domainToPunycode(domain.trim().toLowerCase());
}

function isSpecialDomain(domain) {
    const specialDomains = ['localhost', 'broadcasthost'];
    return specialDomains.includes(domain.toLowerCase());
}

function isValidDomain(domain) {
    if (!domain || typeof domain !== 'string') {
        return false;
    }

    let testDomain = domain.trim().toLowerCase();
    if (!testDomain) {
        return false;
    }

    if (testDomain.startsWith('*.')) {
        testDomain = testDomain.substring(2);
        if (!testDomain) {
            return false;
        }
    }

    if (testDomain.length > 253) {
        return false;
    }

    try {
        const punnycodeDomain = punycode.toASCII(testDomain);
        if (!punnycodeDomain || punnycodeDomain.length === 0) {
            return false;
        }

        const domainRegex = /^[a-zA-Z0-9]([a-zA-Z0-9-]{0,61}[a-zA-Z0-9])?(\.[a-zA-Z0-9]([a-zA-Z0-9-]{0,61}[a-zA-Z0-9])?)*$/;
        const parts = punnycodeDomain.split('.');

        if (parts.length < 2 && !isSpecialDomain(testDomain)) {
            return false;
        }

        for (const part of parts) {
            if (part.length === 0 || part.length > 63) {
                return false;
            }
            if (part.startsWith('-') || part.endsWith('-')) {
                return false;
            }
            if (parts.indexOf(part) === parts.length - 1 && /^\d+$/.test(part)) {
                return false;
            }
        }

        return domainRegex.test(punnycodeDomain);
    } catch (error) {
        console.warn('Punycode conversion failed for domain:', testDomain, error);
        const basicDomainRegex = /^[a-zA-Z0-9]([a-zA-Z0-9-]{0,61}[a-zA-Z0-9])?(\.[a-zA-Z0-9]([a-zA-Z0-9-]{0,61}[a-zA-Z0-9])?)*$/;
        const parts = testDomain.split('.');

        if (parts.length < 2 && !isSpecialDomain(testDomain)) {
            return false;
        }

        for (const part of parts) {
            if (part.length === 0 || part.length > 63) {
                return false;
            }
            if (part.startsWith('-') || part.endsWith('-')) {
                return false;
            }
        }

        return basicDomainRegex.test(testDomain);
    }
}

function setWhitelistStatus(type, message) {
    const status = document.getElementById('customrules-whitelist-status');
    if (!status) return;

    if (whitelistStatusTimer) {
        clearTimeout(whitelistStatusTimer);
        whitelistStatusTimer = null;
    }

    status.classList.remove('success', 'error');
    status.textContent = message || '';
    if (type) {
        status.classList.add(type);
    }

    if (message) {
        whitelistStatusTimer = setTimeout(() => {
            status.classList.remove('success', 'error');
            status.textContent = '';
            whitelistStatusTimer = null;
        }, 3500);
    }
}

function renderWhitelistCount() {
    const countEl = document.getElementById('customrules-whitelist-count');
    if (!countEl) return;

    const localizedCount = getLocalizedNumber(userWhitelist.length);
    countEl.textContent = i18n('whitelist_count').replace('%d', localizedCount);
}

function renderWhitelistList() {
    const list = document.getElementById('customrules-whitelist-list');
    if (!list) return;

    const term = whitelistSearchTerm.trim().toLowerCase();
    const filtered = userWhitelist.filter(domain => !term || domain.toLowerCase().includes(term));

    if (userWhitelist.length === 0) {
        const countEl = document.getElementById('customrules-whitelist-count');
        setHTMLContent(list, `<li class="whitelist-empty">${i18n('whitelist_empty')}</li>`);
        if (countEl) {
            countEl.textContent = '';
        }
        return;
    }

    if (filtered.length === 0) {
        setHTMLContent(list, `<li class="whitelist-empty">${i18n('whitelist_empty')}</li>`);
        renderWhitelistCount();
        addWhitelistRemoveHandlers();
        return;
    }

    const items = filtered.map(domain => `
        <li class="whitelist-item">
            <span class="whitelist-domain" title="${escapeHtml(domain)}">${escapeHtml(domain)}</span>
            <button class="btn btn-danger btn-sm whitelist-remove" data-domain="${escapeHtml(domain)}" title="${i18n('whitelist_remove_button')}">${i18n('whitelist_remove_button')}</button>
        </li>
    `).join('');
    setHTMLContent(list, items);
    renderWhitelistCount();
    addWhitelistRemoveHandlers();
}

function addWhitelistRemoveHandlers() {
    const list = document.getElementById('customrules-whitelist-list');
    if (!list) {
        return;
    }

    list.removeEventListener('click', handleWhitelistRemove);
    list.addEventListener('click', handleWhitelistRemove);
}

function handleWhitelistRemove(event) {
    const target = event.target;
    if (!target.classList.contains('whitelist-remove')) {
        return;
    }

    const domain = target.getAttribute('data-domain');
    if (domain) {
        removeWhitelistDomain(domain);
    }
}

async function loadWhitelist() {
    try {
        const response = await browser.runtime.sendMessage({
            function: "getData",
            params: ["userWhitelist"]
        });
        userWhitelist = response.response || [];

        renderWhitelistList();
        setTimeout(() => {
            addWhitelistRemoveHandlers();
        }, 100);
    } catch (_) {
        userWhitelist = [];
        renderWhitelistList();
        setWhitelistStatus('error', i18n('whitelist_load_failed'));
    }
}

async function addWhitelistDomain() {
    const input = document.getElementById('customrules-whitelist-input');
    if (!input) return;

    const raw = input.value || '';
    if (!raw.trim()) {
        setWhitelistStatus('error', i18n('whitelist_enter_domain'));
        return;
    }
    if (!isValidDomain(raw)) {
        setWhitelistStatus('error', i18n('whitelist_invalid_format'));
        return;
    }

    const punnycodeDomain = normalizeDomain(raw);
    try {
        const response = await browser.runtime.sendMessage({
            function: "addToWhitelist",
            params: [punnycodeDomain]
        });

        if (response && response.response) {
            input.value = '';
            await loadWhitelist();
            setWhitelistStatus('success', i18n('whitelist_added').replace('%s', domainToUnicode(punnycodeDomain)));
        } else {
            setWhitelistStatus('error', i18n('whitelist_already_exists'));
        }
    } catch (_) {
        setWhitelistStatus('error', i18n('whitelist_add_failed'));
    }
}

async function removeWhitelistDomain(domain) {
    if (!domain) {
        return;
    }

    try {
        const response = await browser.runtime.sendMessage({
            function: "removeFromWhitelist",
            params: [domain]
        });

        if (response && response.response) {
            await loadWhitelist();
            setWhitelistStatus('success', i18n('whitelist_removed').replace('%s', domainToUnicode(domain)));
        } else {
            setWhitelistStatus('error', i18n('whitelist_remove_failed'));
        }
    } catch (_) {
        setWhitelistStatus('error', i18n('whitelist_remove_failed'));
    }
}

async function exportWhitelistDomains() {
    let url = null;
    try {
        if (!Array.isArray(userWhitelist) || userWhitelist.length === 0) {
            setWhitelistStatus('error', i18n('whitelist_export_empty'));
            return;
        }

        const payload = JSON.stringify(userWhitelist, null, 2);
        const blob = new Blob([payload], { type: 'application/json' });
        url = URL.createObjectURL(blob);
        const fileName = `Linkumori-Whitelist-${new Date().toISOString().slice(0, 19).replace(/:/g, '-')}.json`;

        await browser.downloads.download({
            url,
            filename: fileName,
            saveAs: true
        });

        setWhitelistStatus('success', i18n('whitelist_export_done'));
    } catch (_) {
        setWhitelistStatus('error', i18n('whitelist_export_failed'));
    } finally {
        if (url) {
            URL.revokeObjectURL(url);
        }
    }
}

async function importWhitelistDomainsFromFile(file) {
    if (!file) return;

    let parsed;
    try {
        const text = await file.text();
        parsed = JSON.parse(text);
    } catch (_) {
        setWhitelistStatus('error', i18n('whitelist_import_parse_failed'));
        return;
    }

    let importedDomains = null;
    if (Array.isArray(parsed)) {
        importedDomains = parsed;
    } else if (parsed && Array.isArray(parsed.userWhitelist)) {
        importedDomains = parsed.userWhitelist;
    }

    if (!Array.isArray(importedDomains)) {
        setWhitelistStatus('error', i18n('whitelist_import_invalid_format'));
        return;
    }

    const normalizedToImport = Array.from(new Set(
        importedDomains
            .filter(item => typeof item === 'string')
            .map(item => item.trim())
            .filter(item => item.length > 0 && isValidDomain(item))
            .map(item => normalizeDomain(item))
    ));

    if (normalizedToImport.length === 0) {
        setWhitelistStatus('error', i18n('whitelist_import_no_valid_domain'));
        return;
    }

    let addedCount = 0;
    for (const domain of normalizedToImport) {
        try {
            const response = await browser.runtime.sendMessage({
                function: "addToWhitelist",
                params: [domain]
            });
            if (response && response.response) {
                addedCount++;
            }
        } catch (_) {
        }
    }

    await loadWhitelist();
    const localizedCount = getLocalizedNumber(addedCount);
    setWhitelistStatus('success', i18n('whitelist_import_done').replace('%s', localizedCount));
}

function setupWhitelistUI() {
    const addBtn = document.getElementById('customrules-whitelist-add-btn');
    const importBtn = document.getElementById('customrules-whitelist-import-btn');
    const exportBtn = document.getElementById('customrules-whitelist-export-btn');
    const importInput = document.getElementById('customrules-whitelist-import-input');
    const input = document.getElementById('customrules-whitelist-input');
    const search = document.getElementById('customrules-whitelist-search');
    const list = document.getElementById('customrules-whitelist-list');
    const examples = document.getElementById('whitelist_examples_text');

    if (!addBtn || !input || !search || !list || !importBtn || !exportBtn || !importInput) {
        return;
    }

    addBtn.onclick = addWhitelistDomain;
    importBtn.onclick = () => {
        importInput.value = '';
        importInput.click();
    };
    exportBtn.onclick = exportWhitelistDomains;
    input.onkeypress = (event) => {
        if (event.key === 'Enter') {
            addWhitelistDomain();
        }
    };
    input.placeholder = i18n('whitelist_input_placeholder');
    if (examples) {
        setHTMLContent(examples, i18n('whitelist_examples_text'));
    }

    search.addEventListener('input', () => {
        whitelistSearchTerm = search.value || '';
        renderWhitelistList();
    });
    importInput.addEventListener('change', async (event) => {
        const file = event.target.files && event.target.files[0];
        await importWhitelistDomainsFromFile(file);
        importInput.value = '';
    });
    addWhitelistRemoveHandlers();
}

function setupCustomRulesViews() {
    const navRules = document.getElementById('nav-custom-rules');
    const navWhitelist = document.getElementById('nav-whitelist');
    const rulesView = document.getElementById('custom-rules-view');
    const whitelistView = document.getElementById('whitelist-view');
    const providerListPageView = document.getElementById('provider-list-view');
    const disabledRulesPageView = document.getElementById('disabled-rules-view');

    if (!navRules || !navWhitelist || !rulesView || !whitelistView || !providerListPageView || !disabledRulesPageView) {
        return;
    }

    // Fragment ↔ view-name mapping
    const HASH_TO_VIEW = {
        '#customrule':    'rules',
        '#whitelist':     'whitelist',
        '#provider-list': 'provider-list',
        '#disabled-rules': 'disabled-rules',
    };
    const VIEW_TO_HASH = {
        'rules':           '#customrule',
        'whitelist':       '#whitelist',
        'provider-list':   '#provider-list',
        'disabled-rules':  '#disabled-rules',
    };

    // Apply DOM classes for the given view — no side effects on the URL
    const applyView = (viewName) => {
        const showWhitelist    = viewName === 'whitelist';
        const showProviderList = viewName === 'provider-list';
        const showDisabledRules = viewName === 'disabled-rules';
        navRules.classList.toggle('active', !showWhitelist);
        navWhitelist.classList.toggle('active', showWhitelist);
        rulesView.classList.toggle('active', !showWhitelist && !showProviderList && !showDisabledRules);
        whitelistView.classList.toggle('active', showWhitelist);
        providerListPageView.classList.toggle('active', showProviderList);
        disabledRulesPageView.classList.toggle('active', showDisabledRules);
    };

    // Navigate by updating the fragment; hashchange handler calls applyView.
    // If the hash is already correct the event won't fire, so apply directly.
    const navigateTo = (viewName) => {
        const hash = VIEW_TO_HASH[viewName] || '#customrule';
        if (window.location.hash === hash) {
            applyView(viewName);
        } else {
            window.location.hash = hash;
        }
    };

    applyCustomRulesView = navigateTo;

    // Navbar button clicks update the fragment
    navRules.addEventListener('click', () => navigateTo('rules'));
    navWhitelist.addEventListener('click', () => navigateTo('whitelist'));

    // React to fragment changes (includes browser back/forward)
    window.addEventListener('hashchange', () => {
        const viewName = HASH_TO_VIEW[window.location.hash] || 'rules';
        applyView(viewName);
    });

    // Seed the fragment on first load if it is missing or unrecognised,
    // then apply the corresponding view
    const initialView = HASH_TO_VIEW[window.location.hash] || 'rules';
    if (!HASH_TO_VIEW[window.location.hash]) {
        history.replaceState(null, '', '#customrule');
    }
    applyView(initialView);
}

function switchCustomRulesView(viewName) {
    if (typeof applyCustomRulesView === 'function') {
        applyCustomRulesView(viewName);
    }
}

/**
 * Initialize i18n for all static elements
 */
function initializeI18n() {
    // Update page title
    document.title = i18n('customRulesEditor_title');
    
    // Update all elements with data-i18n attributes
    const elements = document.querySelectorAll('[data-i18n]');
    elements.forEach(element => {
        const key = element.getAttribute('data-i18n');
        const text = i18n(key);
        if (text && text !== key) {
            element.textContent = text;
        }
    });
    
    // Update all elements with data-i18n-title attributes
    const titleElements = document.querySelectorAll('[data-i18n-title]');
    titleElements.forEach(element => {
        const key = element.getAttribute('data-i18n-title');
        const text = i18n(key);
        if (text && text !== key) {
            element.title = text;
        }
    });
    
    // Update all elements with data-i18n-placeholder attributes
    const placeholderElements = document.querySelectorAll('[data-i18n-placeholder]');
    placeholderElements.forEach(element => {
        const key = element.getAttribute('data-i18n-placeholder');
        const text = i18n(key);
        if (text && text !== key) {
            element.placeholder = text;
        }
    });

    // Update all elements with data-i18n-aria attributes
    const ariaElements = document.querySelectorAll('[data-i18n-aria]');
    ariaElements.forEach(element => {
        const key = element.getAttribute('data-i18n-aria');
        const text = i18n(key);
        if (text && text !== key) {
            element.setAttribute('aria-label', text);
        }
    });

    // Update all elements with data-i18n-alt attributes
    const altElements = document.querySelectorAll('[data-i18n-alt]');
    altElements.forEach(element => {
        const key = element.getAttribute('data-i18n-alt');
        const text = i18n(key);
        if (text && text !== key) {
            element.setAttribute('alt', text);
        }
    });

    const whitelistExamples = document.getElementById('whitelist_examples_text');
    if (whitelistExamples) {
        setHTMLContent(whitelistExamples, i18n('whitelist_examples_text'));
    }
}
     initializeTheme();
/**
 * Initialize the editor when DOM is loaded and LinkumoriI18n is ready
 */
document.addEventListener('DOMContentLoaded', function() {
     initializeTheme();
    initializeEditor();
    
    if (typeof LinkumoriI18n !== 'undefined' && LinkumoriI18n.ready) {
        LinkumoriI18n.ready().then(() => {
            initializeI18n();
            initializeApp();
        }).catch(error => {
            console.error('Error waiting for LinkumoriI18n:', error);
            // Continue with initialization even if LinkumoriI18n fails
            initializeApp();
        });
    } else {
        // Continue with initialization even if LinkumoriI18n is not available
        initializeApp();
    }
});

/**
 * Initialize the main application
 */
function initializeApp() {
    setupCustomRulesViews();
    setupFAQ();
    setupDisabledRulesPage();
    setupProviderImport();
    setupProviderListModal(); // NEW: Setup provider list modal
    setupEventListeners();
    setupWhitelistUI();
    loadWhitelist();
    loadCustomRules(); // Load this last so UI is ready
}

/**
 * Initialize DOM references and setup
 */
function initializeEditor() {
    providerList = document.getElementById('provider-list');
    editorContent = document.getElementById('editor-content');
    editorTitle = document.getElementById('editor-title');
    editorStatus = document.getElementById('editor-status');
    saveBtn = document.getElementById('save-provider-btn');
    editNameBtn = document.getElementById('edit-provider-name-btn');
    deleteBtn = document.getElementById('delete-provider-btn');
    exitBtn = document.getElementById('exit-editor-btn');
    
    providerModal = document.getElementById('provider-modal');
    providerForm = document.getElementById('provider-form');
    modalTitle = document.getElementById('modal-title');
    importFileInput = document.getElementById('import-file-input');
    
    // FAQ elements
    faqModal = document.getElementById('faq-modal');
    faqBtn = document.getElementById('faq-btn');
    
    // Provider import elements
    providerImportModal = document.getElementById('provider-import-modal');
    providerImportBtn = document.getElementById('import-from-rules-btn');
    disabledRulesView = document.getElementById('disabled-rules-view');
    disabledRulesBtn = document.getElementById('disabled-rules-btn');
    
    // Provider list page view elements
    providerListView = document.getElementById('provider-list-view');
    providerListBtn = document.getElementById('provider-list-btn');
    ruleTestModal = document.getElementById('rule-test-modal');
}

// ============================================================================
// NEW: PROVIDER LIST MODAL FUNCTIONALITY
// ============================================================================

/*
 * Required i18n keys for provider list modal:
 * - providerList_button: "List All Providers"
 * - providerList_title: "All Providers"
 * - providerList_searchPlaceholder: "Search providers..."
 * - providerList_rules: "Rules"
 * - providerList_rawRules: "Raw Rules" 
 * - providerList_referral: "Referral"
 * - providerList_exceptions: "Exceptions"
 * - providerList_redirections: "Redirections"
 * - providerList_complete: "Complete"
 * - providerList_noUrlPattern: "No URL pattern"
 * - providerList_edit: "Edit"
 * - providerList_duplicate: "Copy"
 * - providerList_delete: "Delete"
 * - providerList_editTooltip: "Edit Provider"
 * - providerList_duplicateTooltip: "Duplicate Provider"
 * - providerList_deleteTooltip: "Delete Provider"
 * - providerList_noProvidersFound: "No custom providers found."
 * - providerList_createFirst: "Create First Provider"
 * - providerList_confirmDelete: "Are you sure you want to delete provider \"{0}\"?"
 * - providerList_deleteFailed: "Failed to delete provider. Please try again."
 * - providerList_copySuffix: "Copy"
 * - button_close: "Close" (reuses existing key)
 */

/**
 * Setup provider list page functionality
 */
function setupProviderListModal() {
    if (!providerListBtn || !providerListView) {
        return;
    }
    
    // Provider list button click
    providerListBtn.addEventListener('click', showProviderListModal);
    
    // Provider list page close button
    const listPageCloseBtn = document.getElementById('provider-list-close-btn');
    if (listPageCloseBtn) {
        listPageCloseBtn.addEventListener('click', hideProviderListModal);
    }

    // Search functionality
    const searchInput = document.getElementById('provider-list-search');
    if (searchInput) {
        searchInput.addEventListener('input', function() {
            filterProviderList(this.value);
        });
    }
    
    // Return to rules view with Escape key
    document.addEventListener('keydown', function(e) {
        if (e.key === 'Escape' && providerListView && providerListView.classList.contains('active')) {
            hideProviderListModal();
        }
        if (e.key === 'Escape' && disabledRulesView && disabledRulesView.classList.contains('active')) {
            hideDisabledRulesPage();
        }
        if (e.key === 'Escape' && ruleTestModal && ruleTestModal.classList.contains('show')) {
            hideRuleTestLabModal();
        }
    });
}

/**
 * Show provider list page
 */
function showProviderListModal() {
    if (!providerListView) return;
    
    populateProviderListModal();
    switchCustomRulesView('provider-list');
    
    const searchInput = document.getElementById('provider-list-search');
    if (searchInput) {
        searchInput.value = '';
        filterProviderList('');
        searchInput.focus();
    }
}

/**
 * Hide provider list page
 */
function hideProviderListModal() {
    if (!providerListView) return;
    switchCustomRulesView('rules');
    
    if (providerListBtn) {
        providerListBtn.focus();
    }
}

/**
 * Populate the provider list modal with current providers
 */
function populateProviderListModal() {
    const modalContent = document.getElementById('provider-list-modal-content');
    if (!modalContent) {
        console.error('Provider list modal content element not found');
        return;
    }
    
    const providers = Object.keys(customRules.providers);
    
    if (providers.length === 0) {
        setHTMLContent(modalContent, `
            <div class="provider-list-empty">
                <p>${i18n('providerList_noProvidersFound')}</p>
                <button class="btn btn-primary" id="provider-list-create-first-btn">
                    ${i18n('providerList_createFirst')}
                </button>
            </div>
        `);
        
        // Add event listener for the create first button
        const createFirstBtn = document.getElementById('provider-list-create-first-btn');
        if (createFirstBtn) {
            createFirstBtn.addEventListener('click', function() {
                hideProviderListModal();
                showAddProviderModal();
            });
        }
        
        return;
    }
    
    const providerItems = providers.map(providerName => {
        const provider = customRules.providers[providerName];
        return createProviderListItemHTML(providerName, provider);
    }).join('');
    
    setHTMLContent(modalContent, providerItems);
    
    // Add event listeners to edit buttons
    modalContent.querySelectorAll('.provider-list-edit-btn').forEach(btn => {
        btn.addEventListener('click', function() {
            const providerName = this.dataset.provider;
            hideProviderListModal();
            selectProvider(providerName);
        });
    });
    
    // Add event listeners to delete buttons
    modalContent.querySelectorAll('.provider-list-delete-btn').forEach(btn => {
        btn.addEventListener('click', function() {
            const providerName = this.dataset.provider;
            deleteProviderFromList(providerName);
        });
    });
    
    // Add event listeners to duplicate buttons
    modalContent.querySelectorAll('.provider-list-duplicate-btn').forEach(btn => {
        btn.addEventListener('click', function() {
            const providerName = this.dataset.provider;
            duplicateProviderFromList(providerName);
        });
    });
}

/**
 * Create HTML for a provider list item in the modal
 */
function createProviderListItemHTML(providerName, provider) {
    const domainPatterns = toDomainPatternArray(provider.domainPatterns);
    // Calculate provider statistics
    const rulesCount = countRuleEntries(provider.rules);
    const exceptionsCount = countRuleEntries(provider.exceptions);
    const domainPatternsCount = domainPatterns.length;
    const domainExceptionsCount = (provider.domainExceptions || []).length;
    const domainRedirectionsCount = (provider.domainRedirections || []).length;
    
    const stats = [];
    if (rulesCount > 0) stats.push(`${getLocalizedNumber(rulesCount)} ${i18n('providerList_rules')}`);
    if (exceptionsCount > 0) stats.push(`${getLocalizedNumber(exceptionsCount)} ${i18n('providerList_exceptions')}`);
    if (domainPatternsCount > 0) stats.push(`${getLocalizedNumber(domainPatternsCount)} ${i18n('customRulesEditor_domainPatterns')}`);
    if (domainExceptionsCount > 0) stats.push(`${getLocalizedNumber(domainExceptionsCount)} ${i18n('customRulesEditor_domainExceptions')}`);
    if (domainRedirectionsCount > 0) stats.push(`${getLocalizedNumber(domainRedirectionsCount)} ${i18n('customRulesEditor_domainRedirections')}`);
    if (provider.indexPattern) stats.push(`Index: ${provider.indexPattern}`);
    if (provider.completeProvider) stats.push(i18n('providerList_complete'));
    
    return `
        <div class="provider-list-item" data-provider="${escapeHtml(providerName)}">
            <div class="provider-list-item-info">
                <h4 class="provider-list-item-name" title="${escapeHtml(providerName)}">${escapeHtml(providerName)}</h4>
                <p class="provider-list-item-url" title="${escapeHtml(provider.urlPattern || (domainPatterns.length > 0 ? domainPatterns.join(', ') : ''))}">${escapeHtml(provider.urlPattern || (domainPatterns.length > 0 ? `Domain: ${domainPatterns.join(', ')}` : i18n('providerList_noUrlPattern')))}</p>
                <div class="provider-list-item-stats">
                    ${stats.map(stat => `<span class="provider-list-item-stat">${stat}</span>`).join('')}
                </div>
            </div>
            <div class="provider-list-item-actions">
                <button class="btn btn-sm btn-primary provider-list-edit-btn" data-provider="${escapeHtml(providerName)}" title="${i18n('providerList_editTooltip')}">
                    <svg width="12" height="12" viewBox="0 -960 960 960" fill="currentColor">
                        <path d="M200-200h57l391-391-57-57-391 391v57Zm-80 80v-170l528-527q12-11 26.5-17t30.5-6q16 0 31 6t26 18l55 56q12 11 17.5 26t5.5 30q0 16-5.5 30.5T817-647L290-120H120Zm640-584-56-56 56 56Zm-141 85-28-29 57 57-29-28Z"/>
                    </svg>
                    ${i18n('providerList_edit')}
                </button>
                <button class="btn btn-sm btn-warning provider-list-duplicate-btn" data-provider="${escapeHtml(providerName)}" title="${i18n('providerList_duplicateTooltip')}">
                    <svg width="12" height="12" viewBox="0 -960 960 960" fill="currentColor">
                        <path d="M120-220v-80h80v80h-80Zm0-140v-80h80v80h-80Zm0-140v-80h80v80h-80ZM260-80v-80h80v80h-80Zm100-160q-33 0-56.5-23.5T280-320v-480q0-33 23.5-56.5T360-880h360q33 0 56.5 23.5T800-800v480q0 33-23.5 56.5T720-240H360Zm0-80h360v-480H360v480Zm40 240v-80h80v80h-80Zm-200 0q-33 0-56.5-23.5T120-160h80v80Zm340 0v-80h80q0 33-23.5 56.5T540-80ZM120-640q0-33 23.5-56.5T200-720v80h-80Zm420 80Z"/>
                    </svg>
                    ${i18n('providerList_duplicate')}
                </button>
                <button class="btn btn-sm btn-danger provider-list-delete-btn" data-provider="${escapeHtml(providerName)}" title="${i18n('providerList_deleteTooltip')}">
                    <svg width="12" height="12" viewBox="0 -960 960 960" fill="currentColor">
                        <path d="m376-300 104-104 104 104 56-56-104-104 104-104-56-56-104 104-104-104-56 56 104 104-104 104 56 56Zm-96 180q-33 0-56.5-23.5T200-200v-520h-40v-80h200v-40h240v40h200v80h-40v520q0 33-23.5 56.5T680-120H280Zm400-600H280v520h400v-520Zm-400 0v520-520Z"/>
                    </svg>
                    ${i18n('providerList_delete')}
                </button>
            </div>
        </div>
    `;
}

/**
 * Filter provider list based on search term
 */
function filterProviderList(searchTerm) {
    const items = document.querySelectorAll('.provider-list-item');
    const term = searchTerm.toLowerCase().trim();
    
    items.forEach(item => {
        const providerName = item.dataset.provider.toLowerCase();
        const urlPattern = item.querySelector('.provider-list-item-url')?.textContent.toLowerCase() || '';
        
        const matches = providerName.includes(term) || urlPattern.includes(term);
        item.style.display = matches ? 'flex' : 'none';
    });
}

/**
 * Delete provider from list modal
 */
async function deleteProviderFromList(providerName) {
    const confirmed = await modalConfirm(i18n('providerList_confirmDelete', providerName));
    if (!confirmed) {
        return;
    }
    
    try {
        delete customRules.providers[providerName];
        saveCustomRules();
        
        // Update the modal content
        populateProviderListModal();
        
        // Update the main UI
        updateUI();
        
        // If this was the currently edited provider, show empty state
        if (currentProvider === providerName) {
            currentProvider = null;
            isEditing = false;
            hasUnsavedChanges = false;
            showEmptyState();
        }
        
    } catch (error) {
        await modalAlert(i18n('providerList_deleteFailed'));
    }
}

/**
 * Duplicate provider from list modal
 */
function duplicateProviderFromList(providerName) {
    const provider = customRules.providers[providerName];
    if (!provider) return;
    
    let newName = `${providerName}_${i18n('providerList_copySuffix')}`;
    let counter = 1;
    
    while (customRules.providers[newName]) {
        newName = `${providerName}_${i18n('providerList_copySuffix')}_${counter}`;
        counter++;
    }
    
    customRules.providers[newName] = JSON.parse(JSON.stringify(provider));
    saveCustomRules();
    
    // Update the modal content
    populateProviderListModal();
    
    // Update the main UI
    updateUI();
}

/**
 * Delete all providers from editor-panel list view
 */
async function deleteAllProvidersFromPanel() {
    const total = Object.keys(customRules.providers).length;
    if (total === 0) return;

    const confirmationText = i18n('customRulesEditor_confirmDeleteAll', getLocalizedNumber(total));
    const confirmed = await modalConfirm(confirmationText);
    if (!confirmed) {
        return;
    }

    try {
        customRules.providers = {};
        currentProvider = null;
        isEditing = false;
        hasUnsavedChanges = false;
        await saveCustomRules();
        updateUI();
    } catch (error) {
        await modalAlert(i18n('customRulesEditor_deleteAllFailed'));
    }
}

// ============================================================================
// PROVIDER IMPORT FUNCTIONALITY (remote + current rules removed)
// ============================================================================

/**
 * Setup provider import functionality
 */
function setupProviderImport() {
    if (!providerImportBtn || !providerImportModal) {
        return;
    }
    
    // Provider import button click
    providerImportBtn.addEventListener('click', showProviderImportModal);
    
    // Provider import modal close buttons
    const importCloseBtn = document.getElementById('provider-import-modal-close');
    const importCancelBtn = document.getElementById('provider-import-cancel');
    const importConfirmBtn = document.getElementById('provider-import-confirm');
    const disableSelectedBtn = document.getElementById('provider-import-disable-selected');
    const disabledClearBtn = document.getElementById('provider-import-disabled-clear-btn');
    
    if (importCloseBtn) {
        importCloseBtn.addEventListener('click', hideProviderImportModal);
    }
    
    if (importCancelBtn) {
        importCancelBtn.addEventListener('click', hideProviderImportModal);
    }
    
    if (importConfirmBtn) {
        importConfirmBtn.addEventListener('click', confirmProviderImport);
    }
    if (disableSelectedBtn) {
        disableSelectedBtn.addEventListener('click', disableSelectedProviders);
    }

    if (disabledClearBtn) {
        disabledClearBtn.addEventListener('click', async () => {
            const confirmed = await modalConfirm(i18n('providerImport_disabledClearConfirm'));
            if (!confirmed) {
                return;
            }
            await clearExcludedSignatures(currentRuleSource);
            await reloadRulesAfterExclusionChange();
            renderImportDisabledList();
            loadProvidersForSource(currentRuleSource);
            updateSourceCounts();
        });
    }
    
    // Close provider import modal on background click
    providerImportModal.addEventListener('click', function(e) {
        if (e.target === providerImportModal) {
            hideProviderImportModal();
        }
    });
    
    const sourceList = providerImportModal.querySelector('.provider-source-list');
    if (sourceList) {
        sourceList.addEventListener('click', function(e) {
            const item = e.target.closest('.provider-source-item');
            if (!item || !sourceList.contains(item)) {
                return;
            }
            const source = item.dataset.source;
            if (source) {
                selectRuleSource(source);
            }
        });
    }
    
    // Search functionality
    const searchInput = document.getElementById('provider-search');
    if (searchInput) {
        searchInput.addEventListener('input', function() {
            filterProviders(this.value);
        });
    }
    
    // Selection controls
    const selectAllBtn = document.getElementById('select-all-btn');
    const clearSelectionBtn = document.getElementById('clear-selection-btn');
    
    if (selectAllBtn) {
        selectAllBtn.addEventListener('click', selectAllProviders);
    }
    
    if (clearSelectionBtn) {
        clearSelectionBtn.addEventListener('click', clearProviderSelection);
    }
    
    // Close modal with Escape key
    document.addEventListener('keydown', function(e) {
        if (e.key === 'Escape' && providerImportModal && providerImportModal.classList.contains('show')) {
            hideProviderImportModal();
        }
    });

}

function setupDisabledRulesPage() {
    if (disabledRulesBtn) {
        disabledRulesBtn.addEventListener('click', showDisabledRulesPage);
    }
    setupDisabledRulesViewEvents();
}

function setupDisabledRulesViewEvents() {
    if (!disabledRulesView) return;

    const closeBtn = document.getElementById('disabled-rules-page-close-btn');
    const clearAllBtn = document.getElementById('disabled-rules-page-clear-all-btn');

    if (closeBtn) {
        closeBtn.addEventListener('click', hideDisabledRulesPage);
    }
    if (clearAllBtn) {
        clearAllBtn.addEventListener('click', clearAllDisabledRules);
    }
}

async function showDisabledRulesPage() {
    if (!disabledRulesView) return;
    await loadImportExclusions();
    await loadClearURLsDisabledRuleIds();
    await loadClearURLsProviderSnapshot();
    renderDisabledRulesPageContent();
    switchCustomRulesView('disabled-rules');
}

function hideDisabledRulesPage() {
    if (!disabledRulesView) return;
    switchCustomRulesView('rules');
    if (disabledRulesBtn) {
        disabledRulesBtn.focus();
    }
}

async function clearAllDisabledRules() {
    const sources = Object.keys(importExclusionsBySource);
    const hasClearURLsDisabledRuleIds = clearURLsDisabledRuleIds.length > 0;
    if (sources.length === 0 && !hasClearURLsDisabledRuleIds) return;
    const confirmed = await modalConfirm(i18n('providerImport_disabledClearAllConfirm'));
    if (!confirmed) {
        return;
    }

    importExclusionsBySource = {};
    clearURLsDisabledRuleIds = [];
    await saveImportExclusions();
    await saveClearURLsDisabledRuleIds();
    await reloadRulesAfterExclusionChange();
    updateSourceCounts();
    renderProviderRuleIdControlsFromEditor();
    renderDisabledRulesPageContent();
}

function parseActivationId(activationId, fallbackRuleId = '') {
    const parts = String(activationId || '').split('::');
    if (parts.length >= 2) {
        return {
            scopeId: parts.slice(0, -1).join('::'),
            ruleId: parts[parts.length - 1]
        };
    }
    return {
        scopeId: '',
        ruleId: fallbackRuleId || String(activationId || '')
    };
}

function getSnapshotRuleActivationRows() {
    const ruleIds = clearURLsProviderSnapshot?.ruleIds || {};
    const disabled = new Set(clearURLsDisabledRuleIds);
    const rows = [];
    Object.values(ruleIds).forEach(rule => {
        const activationIds = Array.isArray(rule?.activationIds) && rule.activationIds.length > 0
            ? rule.activationIds
            : [rule?.runtimeRuleId || buildProviderRuntimeRuleId(rule?.providerName || '', rule?.id || '')];
        activationIds.forEach(activationId => {
            const runtimeRuleId = String(activationId || '').trim();
            const parsed = parseActivationId(runtimeRuleId, rule.id || '');
            const disableKeys = getProviderRuleDisableKeys(parsed.scopeId, parsed.ruleId, rule.aliases || [], rule.providerName || '');
            if (!runtimeRuleId || disableKeys.some(key => disabled.has(key))) {
                return;
            }
            rows.push({
                runtimeRuleId,
                scopeId: parsed.scopeId,
                providerName: rule.providerName || '',
                ruleId: parsed.ruleId,
                section: rule.section || '',
                kind: rule.kind || '',
                match: rule.match || ''
            });
        });
    });
    rows.sort((a, b) => a.runtimeRuleId.localeCompare(b.runtimeRuleId));
    return rows;
}

function getSnapshotProviderRuleRows() {
    const ruleIds = clearURLsProviderSnapshot?.ruleIds || {};
    const disabled = new Set(clearURLsDisabledRuleIds);
    const rows = [];
    Object.values(ruleIds).forEach(rule => {
        const providerName = rule?.providerName || '';
        const ruleId = rule?.id || '';
        const runtimeRuleId = rule?.runtimeRuleId || buildProviderRuntimeRuleId(providerName, ruleId);
        const aliases = Array.isArray(rule?.aliases) ? rule.aliases : [];
        const disableKeys = [
            runtimeRuleId,
            ruleId,
            ...(Array.isArray(rule?.aliasRuntimeIds) ? rule.aliasRuntimeIds : []),
            ...aliases
        ].filter(Boolean);
        if (!runtimeRuleId || disableKeys.some(key => disabled.has(key))) {
            return;
        }
        rows.push({
            runtimeRuleId,
            providerName,
            ruleId,
            aliases,
            section: rule.section || '',
            kind: rule.kind || '',
            match: rule.match || ''
        });
    });
    rows.sort((a, b) => {
        const providerCompare = (a.providerName || '').localeCompare(b.providerName || '');
        return providerCompare || a.runtimeRuleId.localeCompare(b.runtimeRuleId);
    });
    return rows;
}

function renderRuleActivationSection() {
    const patternRows = getSnapshotRuleActivationRows();
    const providerRows = getSnapshotProviderRuleRows();
    if (patternRows.length === 0 && providerRows.length === 0) {
        return '';
    }

    const modes = [
        {
            mode: 'pattern',
            label: i18n('providerImport_disableByPattern'),
            count: patternRows.length
        },
        {
            mode: 'provider',
            label: i18n('providerImport_disableByProvider'),
            count: providerRows.length
        }
    ].map(item => `
        <button type="button"
            class="provider-filter-nav-btn ${item.mode === disabledRulesActivationMode ? 'active' : ''}"
            data-activation-mode="${escapeHtml(item.mode)}"
            title="${escapeHtml(item.label)}">
            <span>${escapeHtml(item.label)}</span>
            <span class="provider-filter-count">${getLocalizedNumber(item.count)}</span>
        </button>
    `).join('');

    const rows = disabledRulesActivationMode === 'provider' ? providerRows : patternRows;
    const items = rows.map(row => `
        <li class="provider-disabled-item rule-activation-item" data-runtime-id="${escapeHtml(row.runtimeRuleId)}">
            <span class="provider-disabled-signature" title="${escapeHtml(row.runtimeRuleId)}">
                <strong>${escapeHtml(row.ruleId)}</strong>
                <span class="provider-disabled-source">
                    ${row.providerName ? `${escapeHtml(row.providerName)} · ` : ''}${row.scopeId ? `${escapeHtml(row.scopeId)} · ` : ''}${escapeHtml(row.section)} · ${escapeHtml(row.kind)}
                    ${row.match ? ` · ${escapeHtml(row.match)}` : ''}
                </span>
            </span>
            <button type="button" class="btn btn-sm btn-warning rule-activation-disable-btn">${i18n('providerImport_disable')}</button>
        </li>
    `).join('');

    return `
        <div class="provider-disabled-section">
            <div class="provider-disabled-title-row">
                <h5 class="provider-disabled-title">${escapeHtml(i18n('providerImport_ruleActivation'))}</h5>
                <span class="provider-disabled-count-badge">${getLocalizedNumber(rows.length)}</span>
            </div>
            <div class="provider-filter-nav" aria-label="${escapeHtml(i18n('providerImport_providerRuleNav'))}">
                ${modes}
            </div>
            ${rows.length > 0
                ? `<ul class="provider-disabled-list rule-activation-list">${items}</ul>`
                : `<p class="provider-disabled-empty">${escapeHtml(i18n('providerImport_noProviderRuleActivations'))}</p>`}
        </div>
    `;
}

function renderDisabledRulesPageContent() {
    const container = document.getElementById('disabled-rules-page-content');
    if (!container) return;

    const sources = Object.keys(importExclusionsBySource).sort((a, b) => a.localeCompare(b));
    if (clearURLsDisabledRuleIds.length > 0 && !sources.includes('clearurls-rule-ids')) {
        sources.push('clearurls-rule-ids');
    }
    const activationSection = renderRuleActivationSection();
    if (sources.length === 0 && !activationSection) {
        setHTMLContent(container, `
            <div class="provider-list-empty">
                <p>${i18n('providerImport_disabledEmpty')}</p>
            </div>
        `);
        return;
    }

    const totalDisabled = sources.reduce((sum, source) => {
        if (source === 'clearurls-rule-ids') {
            return sum + clearURLsDisabledRuleIds.length;
        }
        const list = importExclusionsBySource[source];
        return sum + (Array.isArray(list) ? list.length : 0);
    }, 0);

    const entries = [];
    sources.forEach(source => {
        const signatures = (source === 'clearurls-rule-ids'
                ? clearURLsDisabledRuleIds
            : (importExclusionsBySource[source] || [])).slice().sort((a, b) => a.localeCompare(b));
        signatures.forEach(signature => {
            let kind = 'other';
            if (source === 'clearurls-rule-ids') {
                kind = 'clearURLsRuleId';
            } else if (typeof signature === 'string' && (signature.startsWith('url:') || signature.startsWith('urlPattern:'))) {
                kind = 'urlPattern';
            } else if (typeof signature === 'string' && (signature.startsWith('domain:') || signature.startsWith('domainPattern:'))) {
                kind = 'domainPatterns';
            }
            entries.push({ source, signature, kind });
        });
    });

    const grouped = {
        urlPattern: entries.filter(item => item.kind === 'urlPattern'),
        domainPatterns: entries.filter(item => item.kind === 'domainPatterns'),
        clearURLsRuleId: entries.filter(item => item.kind === 'clearURLsRuleId'),
        other: entries.filter(item => item.kind === 'other')
    };

    const sectionOrder = ['urlPattern', 'domainPatterns', 'clearURLsRuleId', 'other'];
    const sectionTitle = (key) => {
        if (key === 'urlPattern') return i18n('customRulesEditor_urlPattern');
        if (key === 'domainPatterns') return i18n('customRulesEditor_domainPatterns');
        if (key === 'clearURLsRuleId') return i18n('providerImport_providerRuleIds');
        return i18n('customRulesEditor_rules');
    };

    const showSourceLabel = sources.length > 1;
    const sections = sectionOrder
        .filter(key => grouped[key].length > 0)
        .map(key => {
            const items = grouped[key].map(({ source, signature }) => `
                <li class="provider-disabled-item" data-source="${escapeHtml(source)}" data-signature="${escapeHtml(signature)}">
                    <span class="provider-disabled-signature" title="${escapeHtml(signature)}">${escapeHtml(getSignatureLabel(signature))}</span>
                    ${showSourceLabel ? `<span class="provider-disabled-source">${escapeHtml(getRuleSourceLabel(source))}</span>` : ''}
                    <button type="button" class="btn btn-sm btn-primary disabled-rules-restore-btn">${i18n('providerImport_disabledRestore')}</button>
                </li>
            `).join('');

            return `
                <div class="provider-disabled-section">
                    <div class="provider-disabled-title-row">
                        <h5 class="provider-disabled-title">${escapeHtml(sectionTitle(key))}</h5>
                        <span class="provider-disabled-count-badge">${getLocalizedNumber(grouped[key].length)}</span>
                    </div>
                    <ul class="provider-disabled-list">${items}</ul>
                </div>
            `;
        }).join('');

    setHTMLContent(container, `
        <div class="disabled-rules-content">
            <div class="disabled-rules-meta">
                <span>${escapeHtml(i18n('customRulesEditor_total'))}: <strong>${getLocalizedNumber(totalDisabled)}</strong></span>
                <span>${escapeHtml(i18n('providerImport_sources'))}: <strong>${getLocalizedNumber(sources.length)}</strong></span>
            </div>
            ${sections}
            ${activationSection}
        </div>
    `);

    container.querySelectorAll('.provider-filter-nav-btn[data-activation-mode]').forEach(btn => {
        btn.addEventListener('click', () => {
            const mode = btn.dataset.activationMode || 'pattern';
            disabledRulesActivationMode = mode === 'provider' ? 'provider' : 'pattern';
            renderDisabledRulesPageContent();
        });
    });

    container.querySelectorAll('.rule-activation-disable-btn').forEach(btn => {
        btn.addEventListener('click', async (e) => {
            const item = e.target.closest('.rule-activation-item');
            const runtimeId = item?.dataset?.runtimeId;
            if (!runtimeId) return;
            await setClearURLsProviderRuleDisabled(runtimeId, true);
            await loadClearURLsProviderSnapshot();
            renderDisabledRulesPageContent();
        });
    });

    container.querySelectorAll('.disabled-rules-restore-btn').forEach(btn => {
        btn.addEventListener('click', async (e) => {
            const item = e.target.closest('.provider-disabled-item');
            if (!item) return;
            const source = item.dataset.source;
            const signature = item.dataset.signature;
            if (!source || !signature) return;

            if (source === 'clearurls-rule-ids') {
                clearURLsDisabledRuleIds = clearURLsDisabledRuleIds.filter(ruleId => ruleId !== signature);
                await saveClearURLsDisabledRuleIds();
                await reloadRulesAfterExclusionChange();
            } else {
                await removeExcludedSignature(source, signature);
                await reloadRulesAfterExclusionChange();
            }
            updateSourceCounts();
            renderProviderRuleIdControlsFromEditor();
            await loadClearURLsProviderSnapshot();
            renderDisabledRulesPageContent();

            if (providerImportModal && providerImportModal.classList.contains('show')) {
                renderImportDisabledList();
                loadProvidersForSource(currentRuleSource);
            }
        });
    });
}

/**
 * Show provider import modal
 */
async function showProviderImportModal() {
    if (!providerImportModal) return;
    
    // Reset state
    selectedProviders.clear();
    currentRuleSource = 'bundled';
    
    // Show modal
    providerImportModal.classList.add('show');
    document.body.style.overflow = 'hidden';

    await loadImportExclusions();
    
    // Load available rule sources
    await loadAvailableRuleSources();
    
    // Select default source and load providers
    selectRuleSource('bundled');
    
    // Focus management for accessibility
    const firstFocusable = providerImportModal.querySelector('button, [href], input, select, textarea, [tabindex]:not([tabindex="-1"])');
    if (firstFocusable) {
        firstFocusable.focus();
    }
}

/**
 * Hide provider import modal
 */
function hideProviderImportModal() {
    if (!providerImportModal) return;
    
    providerImportModal.classList.remove('show');
    document.body.style.overflow = '';
    
    // Clear state
    selectedProviders.clear();
    availableRuleSources = {};
    
    // Return focus to import button
    if (providerImportBtn) {
        providerImportBtn.focus();
    }
}

/**
 * Load available rule sources
 */
async function loadAvailableRuleSources() {
    try {
        const [bundledResult, activeProviderResult] = await Promise.allSettled([
            loadBundledRulesForImport(),
            loadActiveProviderRulesForImport()
        ]);

        availableRuleSources.bundled = bundledResult.status === 'fulfilled'
            ? bundledResult.value
            : { metadata: { name: 'Bundled Rules', source: 'bundled' }, providers: {} };
        availableRuleSources.activeProviders = activeProviderResult.status === 'fulfilled'
            ? activeProviderResult.value
            : null;
        
        // Update source counts
        updateSourceCounts();
        
    } catch (error) {
        console.error('Error loading rule sources:', error);
        showProviderImportError(i18n('providerImport_failedToLoadSources', error.message));
    }
}

/**
 * Load bundled rules for import
 */
async function loadBundledRulesForImport() {
    try {
        const response = await browser.runtime.sendMessage({
            function: "getBundledRulesOnly"
        });
        
        if (response && response.response && response.response.providers) {
            return response.response;
        }

        throw new Error(i18n('providerImport_noBundledRules'));
    } catch (error) {
        throw new Error(i18n('providerImport_failedToLoadBundled', error.message));
    }
}

async function loadActiveProviderRulesForImport() {
    const response = await browser.runtime.sendMessage({
        function: "getData",
        params: ['ClearURLsData']
    });

    if (response && response.response && response.response.providers) {
        return response.response;
    }

    throw new Error(i18n('providerImport_noBundledRules'));
}

/**
 * Update source counts in the sidebar
 */
function updateSourceCounts() {
    const activeProviderCount = document.getElementById('active-provider-count');
    
    if (activeProviderCount && availableRuleSources.bundled) {
        const activeProviderSource = availableRuleSources.activeProviders || availableRuleSources.bundled;
        const activeProviders = Object.values(activeProviderSource.providers || {});
        const visibleCount = activeProviders.filter(provider => !isProviderExcluded('bundled', provider)).length;
        activeProviderCount.textContent = getLocalizedNumber(visibleCount);
    }
}

/**
 * Select a rule source and display its providers
 */
function selectRuleSource(source) {
    currentRuleSource = source;
    
    // Update source selection UI
    const sourceItems = document.querySelectorAll('.provider-source-item');
    sourceItems.forEach(item => {
        if (item.dataset.source === source) {
            item.classList.add('active');
        } else {
            item.classList.remove('active');
        }
    });
    
    // Clear current selection
    selectedProviders.clear();
    updateSelectionCount();
    renderImportDisabledList();
    
    // Load providers for selected source
    loadProvidersForSource(source);
}

/**
 * Load providers for a specific source
 */
function loadProvidersForSource(source) {
    const providerGrid = document.getElementById('provider-grid');
    if (!providerGrid) return;
    
    const rules = availableRuleSources[source];
    if (!rules || !rules.providers) {
        showProviderImportError(i18n('providerImport_noProvidersAvailable', getRuleSourceLabel(source)));
        return;
    }
    
    const providers = rules.providers;
    const providerNames = Object.keys(providers).filter(name => {
        return !isProviderExcluded(source, providers[name]);
    });
    
    if (providerNames.length === 0) {
        setHTMLContent(providerGrid, `
            <div class="provider-loading">
                <span>${i18n('providerImport_noProvidersFound', getRuleSourceLabel(source))}</span>
            </div>
        `);
        return;
    }
    
    // Create provider cards
    const providerCards = providerNames.map(name => {
        const provider = providers[name];
        return createProviderCard(name, provider, source);
    }).join('');
    
    setHTMLContent(providerGrid, providerCards);
    
    // Add click handlers to provider cards
    const cards = providerGrid.querySelectorAll('.provider-card');
    cards.forEach(card => {
        card.addEventListener('click', function(e) {
            // Don't toggle if clicking on checkbox directly
            if (e.target.type === 'checkbox') return;
            
            toggleProviderSelection(this.dataset.provider);
        });
        
        // Handle checkbox clicks
        const checkbox = card.querySelector('.provider-card-checkbox');
        if (checkbox) {
            checkbox.addEventListener('change', function(e) {
                e.stopPropagation();
                if (this.checked) {
                    addProviderToSelection(card.dataset.provider);
                } else {
                    removeProviderFromSelection(card.dataset.provider);
                }
            });
        }

    });
}

/**
 * Create a provider card HTML
 */
function createProviderCard(name, provider, source) {
    const domainPatterns = toDomainPatternArray(provider.domainPatterns);
    // Calculate provider statistics
    const rulesCount = countRuleEntries(provider.rules);
    const exceptionsCount = countRuleEntries(provider.exceptions);
    const domainPatternsCount = domainPatterns.length;
    const domainExceptionsCount = (provider.domainExceptions || []).length;
    const domainRedirectionsCount = (provider.domainRedirections || []).length;
    
    // Check if provider already exists in custom rules
    const existsInCustom = customRules.providers[name] !== undefined;
    const statusClass = existsInCustom ? 'provider-card-exists' : '';
    const statusText = existsInCustom ? i18n('providerImport_existsInCustom') : '';
    
    return `
        <div class="provider-card ${statusClass}" data-provider="${escapeHtml(name)}" data-source="${source}">
            <div class="provider-card-header">
                <h4 class="provider-card-name" title="${escapeHtml(name)}">${escapeHtml(name)}</h4>
                <input type="checkbox" class="provider-card-checkbox">
            </div>
            <div class="provider-card-url" title="${escapeHtml(provider.urlPattern || (domainPatterns.length > 0 ? domainPatterns.join(', ') : ''))}">${escapeHtml(provider.urlPattern || (domainPatterns.length > 0 ? `Domain: ${domainPatterns.join(', ')}` : i18n('providerImport_noUrlPattern')))}</div>
            <div class="provider-card-stats">
                ${rulesCount > 0 ? `<span class="provider-card-stat" title="${i18n('providerImport_rules')}">${getLocalizedNumber(rulesCount)} ${i18n('providerImport_rulesAbbr')}</span>` : ''}
                ${exceptionsCount > 0 ? `<span class="provider-card-stat" title="${i18n('providerImport_exceptions')}">${getLocalizedNumber(exceptionsCount)} ${i18n('providerImport_exceptionsAbbr')}</span>` : ''}
                ${domainPatternsCount > 0 ? `<span class="provider-card-stat" title="${i18n('providerImport_domainPatterns')}">${getLocalizedNumber(domainPatternsCount)} ${i18n('providerImport_domainPatternsAbbr')}</span>` : ''}
                ${domainExceptionsCount > 0 ? `<span class="provider-card-stat" title="${i18n('providerImport_domainExceptions')}">${getLocalizedNumber(domainExceptionsCount)} ${i18n('providerImport_domainExceptionsAbbr')}</span>` : ''}
                ${domainRedirectionsCount > 0 ? `<span class="provider-card-stat" title="${i18n('providerImport_domainRedirections')}">${getLocalizedNumber(domainRedirectionsCount)} ${i18n('providerImport_domainRedirectionsAbbr')}</span>` : ''}
                ${provider.completeProvider ? `<span class="provider-card-stat" title="${i18n('providerImport_completeProvider')}">${i18n('providerImport_complete')}</span>` : ''}
            </div>
            ${existsInCustom ? `<div style="font-size: 10px; color: var(--button-warning); margin-top: 4px;">${statusText}</div>` : ''}
        </div>
    `;
}

/**
 * Toggle provider selection
 */
function toggleProviderSelection(providerName) {
    const card = document.querySelector(`[data-provider="${providerName}"]`);
    const checkbox = card?.querySelector('.provider-card-checkbox');
    
    if (selectedProviders.has(providerName)) {
        removeProviderFromSelection(providerName);
        if (checkbox) checkbox.checked = false;
    } else {
        addProviderToSelection(providerName);
        if (checkbox) checkbox.checked = true;
    }
}

/**
 * Add provider to selection
 */
function addProviderToSelection(providerName) {
    selectedProviders.add(providerName);
    
    const card = document.querySelector(`[data-provider="${providerName}"]`);
    if (card) {
        card.classList.add('selected');
    }
    
    updateSelectionCount();
}

/**
 * Remove provider from selection
 */
function removeProviderFromSelection(providerName) {
    selectedProviders.delete(providerName);
    
    const card = document.querySelector(`[data-provider="${providerName}"]`);
    if (card) {
        card.classList.remove('selected');
    }
    
    updateSelectionCount();
}

/**
 * Select all visible providers
 */
function selectAllProviders() {
    const visibleCards = document.querySelectorAll('.provider-card:not([style*="display: none"])');
    
    visibleCards.forEach(card => {
        const providerName = card.dataset.provider;
        const checkbox = card.querySelector('.provider-card-checkbox');
        
        if (providerName) {
            addProviderToSelection(providerName);
            if (checkbox) checkbox.checked = true;
        }
    });
}

/**
 * Clear all provider selections
 */
function clearProviderSelection() {
    const selectedCards = document.querySelectorAll('.provider-card.selected');
    
    selectedCards.forEach(card => {
        const providerName = card.dataset.provider;
        const checkbox = card.querySelector('.provider-card-checkbox');
        
        if (providerName) {
            removeProviderFromSelection(providerName);
            if (checkbox) checkbox.checked = false;
        }
    });
    
    selectedProviders.clear();
    updateSelectionCount();
}

/**
 * Filter providers based on search term
 */
function filterProviders(searchTerm) {
    const cards = document.querySelectorAll('.provider-card');
    const term = searchTerm.toLowerCase().trim();
    
    cards.forEach(card => {
        const providerName = card.dataset.provider.toLowerCase();
        const urlPattern = card.querySelector('.provider-card-url')?.textContent.toLowerCase() || '';
        
        const matches = providerName.includes(term) || urlPattern.includes(term);
        card.style.display = matches ? 'block' : 'none';
    });
}

/**
 * Update selection count display
 */
function updateSelectionCount() {
    const selectionCount = document.getElementById('selection-count');
    const importConfirmBtn = document.getElementById('provider-import-confirm');
    const disableSelectedBtn = document.getElementById('provider-import-disable-selected');
    
    const count = selectedProviders.size;
    
    if (selectionCount) {
        selectionCount.textContent = i18n('providerImport_selectedCount', getLocalizedNumber(count));
    }
    
    if (importConfirmBtn) {
        importConfirmBtn.disabled = count === 0;
    }
    if (disableSelectedBtn) {
        disableSelectedBtn.disabled = count === 0;
    }
}

/**
 * Confirm provider import
 */
async function confirmProviderImport() {
    if (selectedProviders.size === 0) {
        return;
    }
    
    const importConfirmBtn = document.getElementById('provider-import-confirm');
    if (importConfirmBtn) {
        importConfirmBtn.disabled = true;
        importConfirmBtn.textContent = i18n('providerImport_importing');
    }
    
    try {
        const rules = availableRuleSources[currentRuleSource];
        if (!rules || !rules.providers) {
            throw new Error(i18n('providerImport_noRulesAvailable'));
        }
        
        let importedCount = 0;
        let skippedCount = 0;
        let overwrittenCount = 0;
        
        for (const providerName of selectedProviders) {
            const provider = rules.providers[providerName];
            if (!provider) {
                skippedCount++;
                continue;
            }

            if (isProviderExcluded(currentRuleSource, provider)) {
                skippedCount++;
                continue;
            }
            
            // Check if provider already exists
            if (customRules.providers[providerName]) {
                overwrittenCount++;
            }
            
            // Import the provider (deep copy to avoid reference issues)
            customRules.providers[providerName] = JSON.parse(JSON.stringify(provider));
            importedCount++;
        }
        
        // Save the updated custom rules
        await saveCustomRules();
        
        // Update UI
        updateUI();
        
        // Hide modal
        hideProviderImportModal();
        
        // Show success message
        const messageLines = [
            i18n('providerImport_completed'),
            i18n('providerImport_importedCount', importedCount)
        ];

        if (overwrittenCount > 0) {
            messageLines.push(i18n('providerImport_overwrittenCount', overwrittenCount));
        }

        if (skippedCount > 0) {
            messageLines.push(i18n('providerImport_skippedCount', skippedCount));
        }

        const message = messageLines.join('\n');
        
        await modalAlert(message);
        
    } catch (error) {
        console.error('Error importing providers:', error);
        await modalAlert(i18n('providerImport_failed', error.message));
    } finally {
        if (importConfirmBtn) {
            importConfirmBtn.disabled = false;
            importConfirmBtn.textContent = i18n('providerImport_import');
        }
    }
}

/**
 * Show provider import error
 */
function showProviderImportError(message) {
    const providerGrid = document.getElementById('provider-grid');
    if (providerGrid) {
        setHTMLContent(providerGrid, `
            <div class="provider-error">
                <span>${escapeHtml(message)}</span>
            </div>
        `);
    }
}

/**
 * Setup FAQ functionality
 */
function setupFAQ() {
    if (!faqBtn || !faqModal) {
        return;
    }
    
    // FAQ button click
    faqBtn.addEventListener('click', showFAQModal);
    
    // FAQ modal close buttons
    const faqCloseBtn = document.getElementById('faq-close-btn');
    const faqModalClose = document.getElementById('faq-modal-close');
    
    if (faqCloseBtn) {
        faqCloseBtn.addEventListener('click', hideFAQModal);
    }
    
    if (faqModalClose) {
        faqModalClose.addEventListener('click', hideFAQModal);
    }
    
    // Close FAQ modal on background click
    faqModal.addEventListener('click', function(e) {
        if (e.target === faqModal) {
            hideFAQModal();
        }
    });
    
    // Setup FAQ accordion functionality
    setupFAQAccordion();
    
    // Close FAQ modal with Escape key
    document.addEventListener('keydown', function(e) {
        if (e.key === 'Escape' && faqModal && faqModal.classList.contains('show')) {
            hideFAQModal();
        }
    });
}

/**
 * Setup FAQ accordion functionality
 */
function setupFAQAccordion() {
    const faqQuestions = document.querySelectorAll('.faq-question');
    
    faqQuestions.forEach(question => {
        // Replace any existing FAQ question icons with the new SVG
        const existingIcon = question.querySelector('.faq-question-icon');
        if (existingIcon) {
            existingIcon.innerHTML = '<svg xmlns="http://www.w3.org/2000/svg" height="24px" viewBox="0 -960 960 960" width="24px" fill="currentColor"><path d="M480-360 280-560h400L480-360Z"/></svg>';
        }
        
        question.addEventListener('click', function() {
            const faqItem = this.closest('.faq-item');
            const answer = faqItem.querySelector('.faq-answer');
            const icon = this.querySelector('.faq-question-icon');
            
            // Toggle active state
            const isActive = this.classList.contains('active');
            
            if (isActive) {
                // Close this item
                this.classList.remove('active');
                answer.classList.remove('active');
            } else {
                // Open this item
                this.classList.add('active');
                answer.classList.add('active');
            }
            
            // Animate icon rotation
            if (icon) {
                icon.style.transform = isActive ? 'rotate(0deg)' : 'rotate(180deg)';
            }
        });
    });
}

/**
 * Show FAQ modal
 */
function showFAQModal() {
    if (!faqModal) return;
    
    faqModal.classList.add('show');
    document.body.style.overflow = 'hidden'; // Prevent background scrolling
    
    // Focus management for accessibility
    const firstFocusable = faqModal.querySelector('button, [href], input, select, textarea, [tabindex]:not([tabindex="-1"])');
    if (firstFocusable) {
        firstFocusable.focus();
    }
}

/**
 * Hide FAQ modal
 */
function hideFAQModal() {
    if (!faqModal) return;
    
    faqModal.classList.remove('show');
    document.body.style.overflow = ''; // Restore background scrolling
    
    // Return focus to FAQ button
    if (faqBtn) {
        faqBtn.focus();
    }
}

// ============================================================================
// MAIN EDITOR FUNCTIONALITY
// ============================================================================

/**
 * Setup all event listeners
 */
function setupEventListeners() {
    // Provider management - with null checks
    const addProviderBtn = document.getElementById('add-provider-btn');
    if (addProviderBtn) {
        addProviderBtn.addEventListener('click', showAddProviderModal);
    }

    // Note: create-first-provider is created dynamically, so we'll handle it in showEmptyState()
    
    // Modal controls - with null checks
    const modalClose = document.getElementById('modal-close');
    const modalCancel = document.getElementById('modal-cancel');
    
    if (modalClose) {
        modalClose.addEventListener('click', hideProviderModal);
    }
    if (modalCancel) {
        modalCancel.addEventListener('click', hideProviderModal);
    }
    if (providerForm) {
        providerForm.addEventListener('submit', handleProviderSubmit);
    }
    
    // Editor controls - with null checks
    if (saveBtn) {
        saveBtn.addEventListener('click', saveCurrentProvider);
    }
    if (editNameBtn) {
        editNameBtn.addEventListener('click', () => {
            if (!currentProvider) return;
            editProviderName(currentProvider);
        });
    }
    if (deleteBtn) {
        deleteBtn.addEventListener('click', deleteCurrentProvider);
    }
    if (exitBtn) {
        exitBtn.addEventListener('click', exitEditor);
    }
    
    // Import/Export - with null checks
    const importRulesBtn = document.getElementById('import-rules-btn');
    const exportRulesBtn = document.getElementById('export-rules-btn');
    
    if (importRulesBtn && importFileInput) {
        importRulesBtn.addEventListener('click', () => importFileInput.click());
    }
    if (exportRulesBtn) {
        exportRulesBtn.addEventListener('click', exportCustomRules);
    }
    if (importFileInput) {
        importFileInput.addEventListener('change', handleFileImport);
    }

    // Enforce rules button - with null checks
    const enforceRulesBtn = document.getElementById('enforce-rules-btn');
    if (enforceRulesBtn) {
        enforceRulesBtn.addEventListener('click', enforceRules);
    }

    const openRuleTestLabBtn = document.getElementById('open-rule-test-lab-btn');
    if (openRuleTestLabBtn) {
        openRuleTestLabBtn.addEventListener('click', showRuleTestLabModal);
    }

    const ruleTestModalClose = document.getElementById('rule-test-modal-close');
    if (ruleTestModalClose) {
        ruleTestModalClose.addEventListener('click', hideRuleTestLabModal);
    }

    const ruleTestModalDismiss = document.getElementById('rule-test-modal-dismiss');
    if (ruleTestModalDismiss) {
        ruleTestModalDismiss.addEventListener('click', hideRuleTestLabModal);
    }

    const ruleTestRunBtn = document.getElementById('rule-test-run-btn');
    if (ruleTestRunBtn) {
        ruleTestRunBtn.addEventListener('click', runRuleTestLabFromUI);
    }

    const ruleTestInput = document.getElementById('rule-test-input');
    const ruleTestParamInput = document.getElementById('rule-test-param-input');
    if (ruleTestInput) {
        ruleTestInput.addEventListener('keydown', (event) => {
            if (event.key === 'Enter') {
                event.preventDefault();
                runRuleTestLabFromUI();
            }
        });
    }
    if (ruleTestParamInput) {
        ruleTestParamInput.addEventListener('keydown', (event) => {
            if (event.key === 'Enter') {
                event.preventDefault();
                runRuleTestLabFromUI();
            }
        });
    }
    
    // Close modal on background click - with null checks
    if (providerModal) {
        providerModal.addEventListener('click', function(e) {
            if (e.target === providerModal) {
                hideProviderModal();
            }
        });
    }

    if (ruleTestModal) {
        ruleTestModal.addEventListener('click', function(e) {
            if (e.target === ruleTestModal) {
                hideRuleTestLabModal();
            }
        });
    }
        
    // Warn before leaving with unsaved changes
    window.addEventListener('beforeunload', function(e) {
        if (hasUnsavedChanges) {
            e.preventDefault();
            e.returnValue = '';
            return '';
        }
    });
}

function showRuleTestLabModal() {
    if (!ruleTestModal) {
        return;
    }
    ruleTestModal.classList.add('show');
    const input = document.getElementById('rule-test-input');
    if (input) {
        setTimeout(() => input.focus(), 0);
    }
}

function hideRuleTestLabModal() {
    if (!ruleTestModal) {
        return;
    }
    ruleTestModal.classList.remove('show');
}

function renderRuleTestResult(result) {
    const output = document.getElementById('rule-test-output');
    const status = document.getElementById('rule-test-status');

    if (!output || !status) {
        return;
    }

    if (!result || result.success !== true) {
        status.textContent = result?.error || i18n('customRulesEditor_ruleTestLab_failed');
        output.textContent = '';
        return;
    }

    status.textContent = result.changed
        ? i18n('customRulesEditor_ruleTestLab_success_changed')
        : i18n('customRulesEditor_ruleTestLab_success_unchanged');

    const noValue = i18n('customRulesEditor_ruleTestLab_value_none');
    const changedLabel = result.changed
        ? i18n('customRulesEditor_ruleTestLab_value_true')
        : i18n('customRulesEditor_ruleTestLab_value_false');

    const lines = [
        `${i18n('customRulesEditor_ruleTestLab_field_input')}: ${result.input || noValue}`,
        `${i18n('customRulesEditor_ruleTestLab_field_output')}: ${result.output || noValue}`,
        `${i18n('customRulesEditor_ruleTestLab_field_changed')}: ${changedLabel}`,
        `${i18n('customRulesEditor_ruleTestLab_field_matchedProvider')}: ${result.matchedProvider || noValue}`,
        `${i18n('customRulesEditor_ruleTestLab_field_matchedRule')}: ${result.matchedRule || noValue}`,
        `${i18n('customRulesEditor_ruleTestLab_field_patternType')}: ${result.patternType || noValue}`,
        `${i18n('customRulesEditor_ruleTestLab_field_patternValue')}: ${result.patternValue || noValue}`,
        `${i18n('customRulesEditor_ruleTestLab_field_action')}: ${result.action || noValue}`,
        `${i18n('customRulesEditor_ruleTestLab_field_testedParam')}: ${result.testedParam || noValue}`,
        `${i18n('customRulesEditor_ruleTestLab_field_matchedException')}: ${result.matchedException || noValue}`,
        `${i18n('customRulesEditor_ruleTestLab_field_matchedDomainException')}: ${result.matchedDomainException || noValue}`,
        `${i18n('customRulesEditor_ruleTestLab_field_matchedRedirection')}: ${result.matchedRedirection || noValue}`,
        `${i18n('customRulesEditor_ruleTestLab_field_matchedDomainRedirection')}: ${result.matchedDomainRedirection || noValue}`,
        `${i18n('customRulesEditor_ruleTestLab_field_matchedRuleRegex')}: ${result.matchedRuleRegex || noValue}`,
        `${i18n('customRulesEditor_ruleTestLab_field_matchedRawRule')}: ${result.matchedRawRule || noValue}`,
        `${i18n('customRulesEditor_ruleTestLab_field_matchedReferralMarketing')}: ${result.matchedReferralMarketing || noValue}`,
        `${i18n('customRulesEditor_ruleTestLab_field_matchedRemoveParamRule')}: ${result.matchedRemoveParamRule || noValue}`,
        `${i18n('customRulesEditor_ruleTestLab_field_matchedRemoveParamException')}: ${result.matchedRemoveParamException || noValue}`,
        `${i18n('customRulesEditor_ruleTestLab_field_completeProvider')}: ${
            typeof result.completeProvider === 'boolean'
                ? (result.completeProvider
                    ? i18n('customRulesEditor_ruleTestLab_value_true')
                    : i18n('customRulesEditor_ruleTestLab_value_false'))
                : noValue
        }`
    ];

    output.textContent = lines.join('\n');
}

async function runRuleTestLabFromUI() {
    const inputEl = document.getElementById('rule-test-input');
    const paramEl = document.getElementById('rule-test-param-input');
    const output = document.getElementById('rule-test-output');
    const status = document.getElementById('rule-test-status');

    if (!inputEl || !output || !status) {
        return;
    }

    const candidate = (inputEl.value || '').trim();
    const testParam = (paramEl?.value || '').trim();
    if (!candidate) {
        status.textContent = i18n('customRulesEditor_ruleTestLab_enter_url');
        output.textContent = '';
        return;
    }

    status.textContent = i18n('customRulesEditor_ruleTestLab_testing');

    try {
        const response = await browser.runtime.sendMessage({
            function: 'runRuleTestLab',
            params: [candidate, testParam]
        });
        renderRuleTestResult(response?.response || null);
    } catch (error) {
        status.textContent = i18n('customRulesEditor_ruleTestLab_failed');
        output.textContent = '';
    }
}

/**
 * Exit the current editor session
 */
async function exitEditor() {
    if (hasUnsavedChanges) {
        const confirmed = await modalConfirm(i18n('customRulesEditor_unsavedChanges'));
        if (!confirmed) {
            return;
        }
    }
    
    currentProvider = null;
    isEditing = false;
    hasUnsavedChanges = false;
    
    updateProviderList(); // Remove active state from all providers
    showEmptyState();
}

/**
 * Enforce rules by reloading the extension
 */
async function enforceRules() {
    try {
        await browser.runtime.sendMessage({
            function: "reload",
            params: []
        });
        
        // Show success feedback
        const enforceBtn = document.getElementById('enforce-rules-btn');
        const originalContent = enforceBtn.innerHTML;
        
        setHTMLContent(enforceBtn, `
            <svg width="14" height="14" viewBox="0 -960 960 960" fill="currentColor">
                <path d="M382-240 154-468l57-57 171 171 367-367 57 57-424 424Z"/>
            </svg>
            <span>${i18n('customRulesEditor_enforceSuccess')}</span>
        `);
        enforceBtn.classList.remove('btn-info');
        enforceBtn.classList.add('btn-success');
        
        // Reset after 2 seconds
        setTimeout(() => {
            setHTMLContent(enforceBtn, originalContent);
            enforceBtn.classList.remove('btn-success');
            enforceBtn.classList.add('btn-info');
        }, 2000);
        
    } catch (error) {
        // Show error feedback
        const enforceBtn = document.getElementById('enforce-rules-btn');
        const originalContent = enforceBtn.innerHTML;
        
        setHTMLContent(enforceBtn, `
            <svg width="14" height="14" viewBox="0 -960 960 960" fill="currentColor">
                <path d="m40-120 440-760 440 760H40Zm138-80h604L480-720 178-200Zm302-40q17 0 28.5-11.5T520-280q0-17-11.5-28.5T480-320q-17 0-28.5 11.5T440-280q0 17 11.5 28.5T480-240Zm-40-120h80v-200h-80v200Zm40-100Z"/>
            </svg>
            <span>${i18n('customRulesEditor_enforceError')}</span>
        `);
        enforceBtn.classList.remove('btn-info');
        enforceBtn.classList.add('btn-danger');
        
        // Reset after 3 seconds
        setTimeout(() => {
            setHTMLContent(enforceBtn, originalContent);
            enforceBtn.classList.remove('btn-danger');
            enforceBtn.classList.add('btn-info');
        }, 3000);
    }
}

/**
 * Load custom rules from storage
 */
async function loadCustomRules() {
    try {
        await loadClearURLsDisabledRuleIds();
        const response = await browser.runtime.sendMessage({
            function: "getData",
            params: ['custom_rules']
        });
        
        if (response && response.response) {
            if (typeof response.response === 'string') {
                const data = JSON.parse(response.response);
                customRules = data.providers ? data : { providers: {} };
            } else {
                customRules = response.response.providers ? response.response : { providers: {} };
            }
        } else {
            customRules = { providers: {} };
        }
        
        updateUI();
    } catch (error) {
        customRules = { providers: {} };
        updateUI();
    }
}

/**
 * Save custom rules to storage
 */
async function saveCustomRules() {
    try {
        await browser.runtime.sendMessage({
            function: "setData",
            params: ['custom_rules', JSON.stringify(customRules)]
        });
        
        hasUnsavedChanges = false;
        updateEditorStatus('saved', i18n('status_saved'));
        
        // Notify the background script to reload and re-merge rules
        try {
            await browser.runtime.sendMessage({
                function: "reloadCustomRules"
            });
            
            // Update rules status immediately after reload resolves.
            await updateRulesStatus();
            
        } catch (error) {
            // Background script may not support this
        }
        
    } catch (error) {
        updateEditorStatus('error', i18n('status_saveFailed'));
    }
}

/**
 * Update the entire UI
 */
function updateUI() {
    updateProviderList();
    updateProviderCount();
    updateRulesStatus();

    if (!currentProvider) {
        showEmptyState();
    }
}

/**
 * Update rules status display with localized numbers
 */
async function updateRulesStatus() {
    try {
        await Promise.allSettled([
            loadClearURLsDisabledRuleIds()
        ]);

        const [responseResult, linkumoriDataResult] = await Promise.allSettled([
            browser.runtime.sendMessage({
                function: "getCustomRulesStats"
            }),
            browser.runtime.sendMessage({
                function: "getData",
                params: ['ClearURLsData']
            })
        ]);

        const response = responseResult.status === 'fulfilled' ? responseResult.value : null;
        const linkumoriDataResponse = linkumoriDataResult.status === 'fulfilled' ? linkumoriDataResult.value : null;
        const clearURLsRuntimeData = linkumoriDataResponse?.response || {};
        const hasRuntimeProviders = clearURLsRuntimeData &&
            typeof clearURLsRuntimeData.providers === 'object' &&
            clearURLsRuntimeData.providers !== null;
        
        if (response && response.response) {
            const stats = { ...response.response };
            if (hasRuntimeProviders && !Number.isFinite(Number(stats.runtimeProviders))) {
                stats.runtimeProviders = Object.keys(clearURLsRuntimeData.providers || {}).length;
            }
            
            // Use localized numbers for display
            const customCountElement = document.getElementById('custom-count');
            const builtinCountElement = document.getElementById('builtin-count');
            const totalCountElement = document.getElementById('total-count');
            const disabledCountElement = document.getElementById('disabled-count');
            
            if (customCountElement) {
                customCountElement.textContent = getLocalizedNumber(stats.customProviders || 0);
            }
            if (builtinCountElement) {
                builtinCountElement.textContent = getLocalizedNumber(stats.builtInProviders || 0);
            }
            if (totalCountElement) {
                totalCountElement.textContent = getLocalizedNumber(stats.totalProviders || 0);
            }
            if (disabledCountElement) {
                const disabledTotal = Number(stats.disabledProviders || 0) +
                    clearURLsDisabledRuleIds.length;
                disabledCountElement.textContent = getLocalizedNumber(disabledTotal);
            }
            
            const statusText = getHashStatusText(stats.hashStatus);
            const mergeStatusElement = document.getElementById('merge-status');
            if (mergeStatusElement) {
                mergeStatusElement.textContent = statusText;
            }
        }

    } catch (error) {
        // Set fallback values with localized question marks
        const customCountElement = document.getElementById('custom-count');
        const builtinCountElement = document.getElementById('builtin-count');
        const totalCountElement = document.getElementById('total-count');
        const disabledCountElement = document.getElementById('disabled-count');
        const mergeStatusElement = document.getElementById('merge-status');
        const linkumoriStatusElement = document.getElementById('linkumori-url-rule-status');
        const linkumoriRuntimeCountElement = document.getElementById('linkumori-url-runtime-count');
        const linkumoriCustomCountElement = document.getElementById('linkumori-url-custom-count');
        const linkumoriHashElement = document.getElementById('linkumori-url-hash-status');
        
        if (customCountElement) customCountElement.textContent = '?';
        if (builtinCountElement) builtinCountElement.textContent = '?';
        if (totalCountElement) totalCountElement.textContent = '?';
        if (disabledCountElement) disabledCountElement.textContent = '?';
        if (mergeStatusElement) mergeStatusElement.textContent = i18n('status_unavailable');
        if (linkumoriStatusElement) linkumoriStatusElement.textContent = i18n('status_unavailable');
        if (linkumoriRuntimeCountElement) linkumoriRuntimeCountElement.textContent = '?';
        if (linkumoriCustomCountElement) linkumoriCustomCountElement.textContent = '?';
        if (linkumoriHashElement) linkumoriHashElement.textContent = i18n('status_unavailable');
    }
}

/**
 * Update the provider list in sidebar
 */
function updateProviderList() {
    if (!providerList) return;
    
    const providers = Object.keys(customRules.providers);
    providerList.replaceChildren();
    
    providers.forEach(providerName => {
        const listItem = createProviderListItem(providerName);
        if (listItem) {
            providerList.appendChild(listItem);
        }
    });
}

/**
 * Create a provider list item element
 */
function createProviderListItem(providerName) {
    try {
        const li = document.createElement('li');
        li.className = 'provider-item';
        li.dataset.provider = providerName;
        
        if (currentProvider === providerName) {
            li.classList.add('active');
        }
        
        setHTMLContent(li, `
            <span class="provider-name" title="${escapeHtml(providerName)}">${escapeHtml(providerName)}</span>
            <div class="provider-actions">
                <button class="provider-action-btn edit-provider-btn" data-provider="${escapeHtml(providerName)}" title="${i18n('customRulesEditor_editName')}">
                    <svg width="12" height="12" viewBox="0 -960 960 960" fill="currentColor">
                        <path d="M200-200h57l391-391-57-57-391 391v57Zm-80 80v-170l528-527q12-11 26.5-17t30.5-6q16 0 31 6t26 18l55 56q12 11 17.5 26t5.5 30q0 16-5.5 30.5T817-647L290-120H120Zm640-584-56-56 56 56Zm-141 85-28-29 57 57-29-28Z"/>
                    </svg>
                </button>
                <button class="provider-action-btn duplicate-provider-btn" data-provider="${escapeHtml(providerName)}" title="${i18n('customRulesEditor_duplicate')}">
                    <svg width="12" height="12" viewBox="0 -960 960 960" fill="currentColor">
                        <path d="M120-220v-80h80v80h-80Zm0-140v-80h80v80h-80Zm0-140v-80h80v80h-80ZM260-80v-80h80v80h-80Zm100-160q-33 0-56.5-23.5T280-320v-480q0-33 23.5-56.5T360-880h360q33 0 56.5 23.5T800-800v480q0 33-23.5 56.5T720-240H360Zm0-80h360v-480H360v480Zm40 240v-80h80v80h-80Zm-200 0q-33 0-56.5-23.5T120-160h80v80Zm340 0v-80h80q0 33-23.5 56.5T540-80ZM120-640q0-33 23.5-56.5T200-720v80h-80Zm420 80Z"/>
                    </svg>
                </button>
            </div>
        `);
        
        // Add event listeners
        li.addEventListener('click', (e) => {
            // Don't select if clicking on action buttons
            if (!e.target.closest('.provider-actions')) {
                selectProvider(providerName);
            }
        });
        
        // Edit button
        const editBtn = li.querySelector('.edit-provider-btn');
        if (editBtn) {
            editBtn.addEventListener('click', (e) => {
                e.stopPropagation();
                editProviderName(providerName);
            });
        }
        
        // Duplicate button
        const duplicateBtn = li.querySelector('.duplicate-provider-btn');
        if (duplicateBtn) {
            duplicateBtn.addEventListener('click', (e) => {
                e.stopPropagation();
                duplicateProvider(providerName);
            });
        }
        
        return li;
    } catch (error) {
        console.error('Error creating provider list item:', error);
        return null;
    }
}

/**
 * Update provider count display with localized numbers
 */
function updateProviderCount() {
    const count = Object.keys(customRules.providers).length;
    const countElement = document.getElementById('provider-count');
    
    if (countElement) {
        // Use localized number for display
        countElement.textContent = getLocalizedNumber(count);
        countElement.className = `status-indicator ${count > 0 ? 'status-valid' : 'status-invalid'}`;
    }
}

/**
 * Select and display a provider for editing
 */
async function selectProvider(providerName) {
    if (hasUnsavedChanges) {
        const confirmed = await modalConfirm(i18n('customRulesEditor_unsavedChanges'));
        if (!confirmed) {
            return;
        }
    }
    
    currentProvider = providerName;
    isEditing = true;
    hasUnsavedChanges = false;
    
    updateProviderList(); // Update active state
    showProviderEditor();
}

/**
 * Show the provider editor interface
 */
function showProviderEditor() {
    if (!currentProvider || !customRules.providers[currentProvider]) {
        showEmptyState();
        return;
    }

    if (providerList) {
        providerList.style.display = '';
    }
    
    const provider = customRules.providers[currentProvider];
    
    if (editorTitle) {
        editorTitle.textContent = i18n('customRulesEditor_editing', currentProvider);
    }
    if (editorStatus) {
        editorStatus.style.display = 'inline-flex';
    }
    if (saveBtn) {
        saveBtn.style.display = 'inline-flex';
    }
    if (editNameBtn) {
        editNameBtn.style.display = 'inline-flex';
    }
    if (deleteBtn) {
        deleteBtn.style.display = 'inline-flex';
    }
    if (exitBtn) {
        exitBtn.style.display = 'inline-flex';
    }
    
    if (editorContent) {
        setHTMLContent(editorContent, createProviderEditorHTML(provider));
        setupProviderEditorEvents();
        updateEditorStatus('valid', i18n('status_validJson'));
    }
}

/**
 * Create the HTML for provider editor
 */
function createProviderEditorHTML(provider) {
    provider = normalizeProviderForEditor(provider);
    const hasUrlPattern = typeof provider.urlPattern === 'string' && provider.urlPattern.trim() !== '';
    const domainPatternText = toDomainPatternArray(provider.domainPatterns).join('\n');
    const jsonFieldButtons = getJsonFieldButtons();
    return `
        <div class="editor-layout">
            <section class="editor-section pattern-section">
                <h4 class="editor-section-title">${i18n('customRulesEditor_patternType')}</h4>

                <div class="form-group pattern-type-selector">
                    <div class="radio-group">
                        <label class="radio-option">
                            <input type="radio" name="edit-pattern-type" id="edit-pattern-type-url" value="urlPattern" ${hasUrlPattern ? 'checked' : ''}>
                            <span>${i18n('customRulesEditor_urlPatternOption')}</span>
                        </label>
                        <label class="radio-option">
                            <input type="radio" name="edit-pattern-type" id="edit-pattern-type-domain" value="domainPatterns" ${!hasUrlPattern ? 'checked' : ''}>
                            <span>${i18n('customRulesEditor_domainPatternsOption')}</span>
                        </label>
                    </div>
                </div>

                <div class="form-group" id="edit-url-pattern-group" style="${hasUrlPattern ? '' : 'display:none;'}">
                    <label class="form-label">${i18n('customRulesEditor_urlPattern')}</label>
                    <input type="text" class="form-input" id="edit-url-pattern" value="${escapeHtml(provider.urlPattern || '')}" placeholder="${i18n('customRulesEditor_urlPatternPlaceholder')}">
                </div>

                <div class="form-group" id="edit-index-pattern-group" style="${hasUrlPattern ? '' : 'display:none;'}">
                    <label class="form-label">${i18n('customRulesEditor_indexPattern')}</label>
                    <textarea class="form-input" id="edit-index-pattern" rows="3" placeholder="${i18n('customRulesEditor_indexPatternPlaceholder')}">${escapeHtml(formatIndexPatternValue(provider.indexPattern))}</textarea>
                </div>

                <div class="form-group" id="edit-domain-patterns-group" style="${hasUrlPattern ? 'display:none;' : ''}">
                    <textarea class="form-input" id="edit-domain-patterns" placeholder="${i18n('customRulesEditor_domainPatternsPlaceholder')}" rows="5">${escapeHtml(domainPatternText)}</textarea>
                </div>
            </section>

            <div class="json-editor">
                <div class="json-editor-header">
                    <span class="json-editor-title">${i18n('customRulesEditor_advancedJsonEditor')}</span>
                </div>
                <div class="json-key-toolbar">
                    <div class="json-key-toolbar-title">${i18n('customRulesEditor_jsonToolbarTitle')}</div>
                    <div class="json-key-toolbar-help">${i18n('customRulesEditor_v3ProviderFields')}</div>
                    <div class="json-key-buttons">
                        ${jsonFieldButtons.map(field => `
                            <button type="button" class="btn btn-secondary btn-sm json-key-add-btn" data-json-key="${field.key}" title="${escapeHtml(field.label)}">
                                ${field.key}
                            </button>
                        `).join('')}
                    </div>
                    <div class="json-key-toolbar-help">${i18n('customRulesEditor_v3RuleTemplates')}</div>
                    <div class="json-rule-template-buttons">
                        <button type="button" class="btn btn-secondary btn-sm json-rule-template-btn" data-rule-template="field">+ ${i18n('customRulesEditor_addFieldRule')}</button>
                        <button type="button" class="btn btn-secondary btn-sm json-rule-template-btn" data-rule-template="raw">+ ${i18n('customRulesEditor_addRawRule')}</button>
                        <button type="button" class="btn btn-secondary btn-sm json-rule-template-btn" data-rule-template="redirection">+ ${i18n('customRulesEditor_addRedirectRule')}</button>
                    </div>
                    <div class="json-key-toolbar-help">Linkumori-ClearURLs keeps old ClearURLs fields and adds rules[] strings, $removeparam filters, and canonical objects with id, kind, match, and action.</div>
                </div>
                <div class="json-key-toolbar">
                    <div class="json-key-toolbar-title">${i18n('providerImport_ruleIdControls')}</div>
                    <div class="json-key-toolbar-help">${i18n('providerImport_ruleIdControlsHelp')}</div>
                    <div id="provider-rule-id-controls"></div>
                </div>
                <div class="json-editor-content">
                    <div class="json-textmate-input-shell">
                        <pre class="json-highlight-layer" id="json-editor-highlight" aria-hidden="true"></pre>
                        <textarea class="json-editor-textarea" id="json-editor" placeholder="${i18n('customRulesEditor_jsonPlaceholder')}" wrap="off" spellcheck="false" autocapitalize="off" autocomplete="off">${JSON.stringify(provider, null, 2)}</textarea>
                    </div>
                    <div id="json-validation" style="display: none;"></div>
                </div>
            </div>
        </div>
    `;
}

/**
 * Setup event listeners for provider editor
 */
function setupProviderEditorEvents() {
    const jsonEditor = document.getElementById('json-editor');
    if (jsonEditor) {
        jsonEditor.addEventListener('input', handleJsonEditorInput);
        jsonEditor.addEventListener('scroll', () => syncJsonTextMateScroll(jsonEditor));
        updateJsonTextMateHighlighting(jsonEditor);
    }
    if (editorContent) {
        editorContent.removeEventListener('click', handleJsonKeyButtonClick);
        editorContent.removeEventListener('click', handleProviderRuleIdControlsClick);
        editorContent.addEventListener('click', handleJsonKeyButtonClick);
        editorContent.addEventListener('click', handleProviderRuleIdControlsClick);
    }
    setupPatternEditorEvents();
    syncPatternEditorFromJson();
    renderProviderRuleIdControlsFromEditor();
}

function handleJsonEditorInput() {
    updateJsonTextMateHighlighting();
    validateAndUpdateJSON();
    syncPatternEditorFromJson();
    renderProviderRuleIdControlsFromEditor();
}

async function handleProviderRuleIdControlsClick(event) {
    const disableBtn = event.target.closest('.provider-rule-id-disable-btn');
    const restoreBtn = event.target.closest('.provider-rule-id-restore-btn');
    if (!disableBtn && !restoreBtn) {
        return;
    }

    const item = event.target.closest('.provider-rule-id-item');
    const ruleId = item?.dataset?.ruleId || item?.dataset?.runtimeId;
    if (!ruleId) {
        return;
    }

    let equivalentIds = [];
    const equivalentInput = item.querySelector('.provider-rule-id-disable-keys');
    try {
        equivalentIds = JSON.parse(equivalentInput?.value || '[]');
    } catch (_) {
        equivalentIds = [];
    }

    await setClearURLsProviderRuleDisabled(ruleId, !!disableBtn, equivalentIds);
}

function setupPatternEditorEvents() {
    const urlRadio = document.getElementById('edit-pattern-type-url');
    const domainRadio = document.getElementById('edit-pattern-type-domain');
    const urlInput = document.getElementById('edit-url-pattern');
    const indexInput = document.getElementById('edit-index-pattern');
    const domainInput = document.getElementById('edit-domain-patterns');

    if (urlRadio) {
        urlRadio.addEventListener('change', () => {
            updatePatternEditorDisplay();
            applyPatternEditorToJson();
        });
    }
    if (domainRadio) {
        domainRadio.addEventListener('change', () => {
            updatePatternEditorDisplay();
            applyPatternEditorToJson();
        });
    }
    if (urlInput) {
        urlInput.addEventListener('input', applyPatternEditorToJson);
    }
    if (indexInput) {
        indexInput.addEventListener('input', applyPatternEditorToJson);
    }
    if (domainInput) {
        domainInput.addEventListener('input', applyPatternEditorToJson);
    }
}

function updatePatternEditorDisplay() {
    const urlRadio = document.getElementById('edit-pattern-type-url');
    const urlGroup = document.getElementById('edit-url-pattern-group');
    const indexGroup = document.getElementById('edit-index-pattern-group');
    const domainGroup = document.getElementById('edit-domain-patterns-group');
    const useUrl = !!(urlRadio && urlRadio.checked);

    if (urlGroup) urlGroup.style.display = useUrl ? 'block' : 'none';
    if (indexGroup) indexGroup.style.display = useUrl ? 'block' : 'none';
    if (domainGroup) domainGroup.style.display = useUrl ? 'none' : 'block';
}

function applyPatternEditorToJson() {
    const jsonEditor = document.getElementById('json-editor');
    const validation = document.getElementById('json-validation');
    const urlRadio = document.getElementById('edit-pattern-type-url');
    const urlInput = document.getElementById('edit-url-pattern');
    const domainInput = document.getElementById('edit-domain-patterns');
    if (!jsonEditor) return;

    let provider;
    try {
        provider = JSON.parse(jsonEditor.value);
    } catch (error) {
        if (validation) {
            validation.style.display = 'block';
            validation.className = 'json-editor-error';
            validation.textContent = i18n('customRulesEditor_jsonError', error.message);
        }
        updateEditorStatus('invalid', i18n('status_invalidJson'));
        return;
    }

    const useUrlPattern = !!(urlRadio && urlRadio.checked);
    if (useUrlPattern) {
        delete provider.domainPatterns;
        const value = (urlInput?.value || '').trim();
        const indexValue = normalizeIndexPatternValue(document.getElementById('edit-index-pattern')?.value || '');

        if (value) {
            provider.urlPattern = value;
        } else {
            delete provider.urlPattern;
        }

        if (indexValue) {
            provider.indexPattern = indexValue;
        } else {
            delete provider.indexPattern;
        }
    } else {
        delete provider.urlPattern;
        delete provider.indexPattern;
        const domainPatterns = (domainInput?.value || '')
            .split('\n')
            .map(p => p.trim())
            .filter(p => p !== '');
        if (domainPatterns.length > 0) {
            provider.domainPatterns = domainPatterns;
        } else {
            delete provider.domainPatterns;
        }
    }

    jsonEditor.value = JSON.stringify(provider, null, 2);
    updateJsonTextMateHighlighting(jsonEditor);
    validateAndUpdateJSON();
}

function syncPatternEditorFromJson() {
    const jsonEditor = document.getElementById('json-editor');
    const urlRadio = document.getElementById('edit-pattern-type-url');
    const domainRadio = document.getElementById('edit-pattern-type-domain');
    const urlInput = document.getElementById('edit-url-pattern');
    const indexInput = document.getElementById('edit-index-pattern');
    const domainInput = document.getElementById('edit-domain-patterns');
    if (!jsonEditor || !urlRadio || !domainRadio) return;

    try {
        const provider = JSON.parse(jsonEditor.value);
        const hasUrlPattern = typeof provider.urlPattern === 'string' && provider.urlPattern.trim() !== '';
        const domainPatterns = toDomainPatternArray(provider.domainPatterns);

        if (hasUrlPattern) {
            urlRadio.checked = true;
            domainRadio.checked = false;
            if (urlInput) urlInput.value = provider.urlPattern;
            if (indexInput) indexInput.value = formatIndexPatternValue(provider.indexPattern);
            if (domainInput) domainInput.value = '';
        } else {
            urlRadio.checked = false;
            domainRadio.checked = true;
            if (urlInput) urlInput.value = '';
            if (indexInput) indexInput.value = '';
            if (domainInput) domainInput.value = domainPatterns.join('\n');
        }
        updatePatternEditorDisplay();
    } catch (error) {
        // Keep current pattern editor state when JSON is invalid.
    }
}

const LINKUMORI_CLEARURLS_DIALECT_SYNTAX = 'linkumori-clearurls-dialect';

function createProviderSkeleton() {
    return {
        syntax: LINKUMORI_CLEARURLS_DIALECT_SYNTAX,
        urlPattern: '',
        rules: []
    };
}

function compactProviderForEditor(provider) {
    const next = JSON.parse(JSON.stringify(provider || {}));
    next.syntax = LINKUMORI_CLEARURLS_DIALECT_SYNTAX;
    const optionalArrays = ['rules', 'rawRules', 'referralMarketing', 'redirections', 'domainPatterns', 'exceptions', 'domainExceptions', 'domainRedirections', 'methods', 'resourceTypes'];

    optionalArrays.forEach((key) => {
        if (Array.isArray(next[key]) && next[key].length === 0) delete next[key];
    });
    ['urlPattern', 'indexPattern'].forEach((key) => {
        if (typeof next[key] === 'string' && next[key].trim() === '') delete next[key];
    });
    if (next.completeProvider === false) delete next.completeProvider;
    if (next.forceRedirection === false) delete next.forceRedirection;
    return next;
}

function normalizeProviderForEditor(provider) {
    const next = JSON.parse(JSON.stringify(provider || {}));
    next.syntax = LINKUMORI_CLEARURLS_DIALECT_SYNTAX;
    if (!Array.isArray(next.rules)) next.rules = [];
    return next;
}

function getJsonFieldButtons() {
    const fields = ['rules', 'rawRules', 'referralMarketing', 'redirections', 'exceptions', 'domainExceptions', 'domainRedirections', 'completeProvider', 'forceRedirection', 'urlPattern', 'indexPattern', 'domainPatterns', 'methods', 'resourceTypes'];
    const labels = {
        rules: i18n('customRulesEditor_rules'),
        rawRules: i18n('customRulesEditor_rawRules'),
        referralMarketing: i18n('customRulesEditor_referralMarketing'),
        redirections: i18n('customRulesEditor_redirections'),
        exceptions: i18n('customRulesEditor_exceptions'),
        domainExceptions: i18n('customRulesEditor_domainExceptions'),
        domainRedirections: i18n('customRulesEditor_domainRedirections'),
        completeProvider: i18n('customRulesEditor_completeProvider'),
        forceRedirection: i18n('customRulesEditor_forceRedirection'),
        urlPattern: i18n('customRulesEditor_urlPattern'),
        indexPattern: i18n('customRulesEditor_indexPattern'),
        domainPatterns: i18n('customRulesEditor_domainPatterns'),
        methods: i18n('customRulesEditor_httpMethods'),
        resourceTypes: i18n('customRulesEditor_resourceTypes')
    };
    return fields.map(key => ({ key, label: labels[key] }));
}


function createCanonicalRuleTemplate(kind) {
    const idBase = kind === 'redirection' ? 'redirect-rule' : `${kind}-rule`;
    const inertMatch = '(?!)';
    if (kind === 'raw') {
        return {
            id: idBase,
            kind: 'raw',
            match: inertMatch,
            description: '',
            aliases: [],
            exceptions: [],
            requestTypes: 'all',
            preprocessors: [],
            activeDefault: true,
            action: { type: 'remove' }
        };
    }
    if (kind === 'redirection') {
        return {
            id: idBase,
            kind: 'redirection',
            match: inertMatch,
            description: '',
            aliases: [],
            exceptions: [],
            requestTypes: 'all',
            preprocessors: [],
            activeDefault: true,
            action: { type: 'redirect', replacePattern: '' }
        };
    }
    return {
        id: idBase,
        kind: 'field',
        match: inertMatch,
        description: '',
        aliases: [],
        exceptions: [],
        requestTypes: 'all',
        preprocessors: [],
        activeDefault: true,
        action: { type: 'remove' }
    };
}

function createUniqueRuleId(provider, baseId) {
    const occupied = new Set((provider.rules || [])
        .filter(rule => isPlainObject(rule) && typeof rule.id === 'string')
        .map(rule => rule.id));
    if (!occupied.has(baseId)) return baseId;
    let counter = 2;
    while (occupied.has(`${baseId}-${counter}`)) counter++;
    return `${baseId}-${counter}`;
}

/**
 * Get default value for provider JSON key
 */
function getDefaultValueForJsonKey(key) {
    const defaults = {
        rules: [],
        rawRules: [],
        referralMarketing: [],
        redirections: [],
        exceptions: [],
        domainExceptions: [],
        domainRedirections: [],
        completeProvider: false,
        forceRedirection: false,
        urlPattern: '',
        indexPattern: '',
        domainPatterns: [],
        methods: [],
        resourceTypes: []
    };

    if (!Object.prototype.hasOwnProperty.call(defaults, key)) return undefined;
    const value = defaults[key];
    return Array.isArray(value) ? [] : value;
}

/**
 * Handle add-field button clicks in JSON editor
 */
function handleJsonKeyButtonClick(e) {
    const templateButton = e.target.closest('.json-rule-template-btn');
    if (templateButton) {
        addCanonicalRuleTemplate(templateButton.dataset.ruleTemplate);
        return;
    }

    const button = e.target.closest('.json-key-add-btn');
    if (!button) return;

    const key = button.dataset.jsonKey;
    if (!key) return;

    addJsonFieldIfMissing(key);
}

function addCanonicalRuleTemplate(kind) {
    const jsonEditor = document.getElementById('json-editor');
    const validation = document.getElementById('json-validation');
    if (!jsonEditor || !['field', 'raw', 'redirection'].includes(kind)) return;

    try {
        const provider = normalizeProviderForEditor(JSON.parse(jsonEditor.value));
        const template = createCanonicalRuleTemplate(kind);
        template.id = createUniqueRuleId(provider, template.id);
        provider.rules.push(template);
        jsonEditor.value = JSON.stringify(compactProviderForEditor(provider), null, 2);
        updateJsonTextMateHighlighting(jsonEditor);
        renderProviderRuleIdControlsFromEditor();
        hasUnsavedChanges = true;
        if (validation) validation.style.display = 'none';
    } catch (error) {
        if (validation) {
            validation.style.display = 'block';
            validation.className = 'json-editor-error';
            validation.textContent = i18n('customRulesEditor_jsonError', error.message);
        }
    }
}

/**
 * Add provider field into JSON editor if missing
 */
function addJsonFieldIfMissing(key) {
    const jsonEditor = document.getElementById('json-editor');
    const validation = document.getElementById('json-validation');
    if (!jsonEditor) return;

    let provider;
    try {
        provider = JSON.parse(jsonEditor.value);
    } catch (error) {
        if (validation) {
            validation.style.display = 'block';
            validation.className = 'json-editor-error';
            validation.textContent = i18n('customRulesEditor_jsonError', error.message);
        }
        updateEditorStatus('invalid', i18n('status_invalidJson'));
        return;
    }

    // Keep URL pattern and domain patterns mutually exclusive.
    if (key === 'urlPattern') {
        delete provider.domainPatterns;
        if (!Object.prototype.hasOwnProperty.call(provider, 'urlPattern')) {
            provider.urlPattern = getDefaultValueForJsonKey('urlPattern');
        }
    } else if (key === 'domainPatterns') {
        delete provider.urlPattern;
        if (!Object.prototype.hasOwnProperty.call(provider, 'domainPatterns')) {
            provider.domainPatterns = getDefaultValueForJsonKey('domainPatterns');
        }
    } else if (!Object.prototype.hasOwnProperty.call(provider, key)) {
        const defaultValue = getDefaultValueForJsonKey(key);
        if (defaultValue !== undefined) {
            provider[key] = defaultValue;
        }
    }

    provider.syntax = LINKUMORI_CLEARURLS_DIALECT_SYNTAX;
    jsonEditor.value = JSON.stringify(provider, null, 2);
    updateJsonTextMateHighlighting(jsonEditor);
    if (validation) {
        validation.style.display = 'none';
    }
    syncPatternEditorFromJson();
    renderProviderRuleIdControlsFromEditor();
    hasUnsavedChanges = true;
    updateEditorStatus('valid', i18n('status_validJsonUnsaved'));
}

/**
 * Validate and update JSON in real-time
 */
function validateAndUpdateJSON() {
    const jsonEditor = document.getElementById('json-editor');
    const validation = document.getElementById('json-validation');
    if (!jsonEditor || !validation) return;

    try {
        const provider = JSON.parse(jsonEditor.value);
        assertProviderArrayFields(provider, currentProvider || '');
        assertRuleEntrySyntax(provider, currentProvider || '');
        updateJsonTextMateHighlighting(jsonEditor);
        validation.style.display = 'none';
        hasUnsavedChanges = true;
        updateEditorStatus('valid', i18n('status_validJsonUnsaved'));
    } catch (error) {
        updateJsonTextMateHighlighting(jsonEditor);
        validation.style.display = 'block';
        validation.className = 'json-editor-error';
        validation.textContent = i18n('customRulesEditor_jsonError', error.message);
        updateEditorStatus('invalid', i18n('status_invalidJson'));
    }
}

/**
 * Save current provider from JSON editor
 */
async function saveCurrentProvider() {
    if (!currentProvider) return;
    
    try {
        const jsonEditor = document.getElementById('json-editor');
        if (!jsonEditor || !jsonEditor.value.trim()) {
            await modalAlert(i18n('customRulesEditor_jsonRequired'));
            return;
        }
        const provider = JSON.parse(jsonEditor.value);
        assertProviderArrayFields(provider, currentProvider || '');
        assertRuleEntrySyntax(provider, currentProvider || '');
        assertDomainRedirectionSyntax(provider, currentProvider || '');
        provider.indexPattern = normalizeIndexPatternValue(provider.indexPattern);
        if (!provider.indexPattern) delete provider.indexPattern;
        provider.syntax = LINKUMORI_CLEARURLS_DIALECT_SYNTAX;
        
        // Validate required fields - either urlPattern or domainPatterns must be present
        const normalizedDomainPatterns = toDomainPatternArray(provider.domainPatterns);
        if ((!provider.urlPattern || provider.urlPattern.trim() === '') &&
            normalizedDomainPatterns.length === 0) {
            await modalAlert(i18n('customRulesEditor_urlPatternOrDomainPatternsRequired'));
            return;
        }
        
        // Validate mutual exclusivity
        if (provider.urlPattern && provider.urlPattern.trim() !== '' &&
            normalizedDomainPatterns.length > 0) {
            await modalAlert(i18n('customRulesEditor_urlPatternAndDomainPatternsExclusive'));
            return;
        }
        
        // Validate URL pattern as regex if present
        if (provider.urlPattern && provider.urlPattern.trim() !== '') {
            try {
                new RegExp(provider.urlPattern);
            } catch (error) {
                await modalAlert(i18n('customRulesEditor_invalidUrlPattern', error.message));
                return;
            }
        }
        
        // Validate domain patterns format if present
        if (normalizedDomainPatterns.length > 0) {
            provider.domainPatterns = normalizedDomainPatterns;
            for (const pattern of normalizedDomainPatterns) {
                if (!pattern || pattern.trim() === '') {
                    await modalAlert(i18n('customRulesEditor_emptyDomainPattern'));
                    return;
                }
                // Basic validation for domain pattern format
                if (!pattern.includes('.') && !pattern.startsWith('||') && !pattern.includes('*')) {
                    await modalAlert(i18n('customRulesEditor_invalidDomainPattern', pattern));
                    return;
                }
            }
        }
        
        customRules.providers[currentProvider] = compactProviderForEditor(provider);
        await saveCustomRules();
        
    } catch (error) {
        updateEditorStatus('error', i18n('status_saveFailed'));
    }
}

/**
 * Delete current provider
 */
async function deleteCurrentProvider() {
    if (!currentProvider) return;
    
    const confirmed = await modalConfirm(i18n('customRulesEditor_confirmDelete', currentProvider));
    if (!confirmed) {
        return;
    }
    
    try {
        delete customRules.providers[currentProvider];
        await saveCustomRules();
        
        currentProvider = null;
        isEditing = false;
        hasUnsavedChanges = false;
        
        updateUI();
        showEmptyState();
        
    } catch (error) {
        updateEditorStatus('error', i18n('status_deleteFailed'));
    }
}

/**
 * Show empty state
 */
function showEmptyState() {
    if (!editorTitle) return;

    const hasProviders = Object.keys(customRules.providers).length > 0;
    if (providerList) {
        providerList.style.display = hasProviders ? 'none' : '';
    }

    editorTitle.textContent = i18n('customRulesEditor_selectProvider');
    
    if (editorStatus) editorStatus.style.display = 'none';
    if (saveBtn) saveBtn.style.display = 'none';
    if (editNameBtn) editNameBtn.style.display = 'none';
    if (deleteBtn) deleteBtn.style.display = 'none';
    if (exitBtn) exitBtn.style.display = 'none';
    
    if (editorContent) {
        if (hasProviders) {
            const providerNames = Object.keys(customRules.providers).sort((a, b) => a.localeCompare(b));
            const listItemsHTML = providerNames.map(providerName => {
                const provider = customRules.providers[providerName];
                return createProviderListItemHTML(providerName, provider);
            }).join('');

            setHTMLContent(editorContent, `
                <div class="provider-list-page">
                    <div class="provider-list-page-header">
                        <h3 class="modal-title">${i18n('providerList_title')}</h3>
                        <button class="btn btn-danger btn-sm" id="editor-delete-all-btn">${i18n('customRulesEditor_deleteAll')}</button>
                    </div>
                    <input type="text" class="provider-list-search" id="editor-provider-list-search" data-i18n-placeholder="providerList_searchPlaceholder" placeholder="${i18n('providerList_searchPlaceholder')}">
                    <div class="provider-list-modal-content" id="editor-provider-list-content">
                        ${listItemsHTML}
                    </div>
                </div>
            `);

            const searchInput = document.getElementById('editor-provider-list-search');
            if (searchInput) {
                searchInput.addEventListener('input', function() {
                    const term = this.value.toLowerCase().trim();
                    const items = editorContent.querySelectorAll('.provider-list-item');
                    items.forEach(item => {
                        const providerName = item.querySelector('.provider-list-item-name')?.textContent.toLowerCase() || '';
                        const urlPattern = item.querySelector('.provider-list-item-url')?.textContent.toLowerCase() || '';
                        const matches = providerName.includes(term) || urlPattern.includes(term);
                        item.style.display = matches ? 'flex' : 'none';
                    });
                });
            }

            const deleteAllBtn = document.getElementById('editor-delete-all-btn');
            if (deleteAllBtn) {
                deleteAllBtn.addEventListener('click', async (e) => {
                    e.preventDefault();
                    await deleteAllProvidersFromPanel();
                });
            }

            editorContent.querySelectorAll('.provider-list-item').forEach(item => {
                item.addEventListener('click', () => {
                    const providerName = item.dataset.provider;
                    if (providerName) {
                        selectProvider(providerName);
                    }
                });
            });

            editorContent.querySelectorAll('.provider-list-edit-btn').forEach(btn => {
                btn.addEventListener('click', (e) => {
                    e.stopPropagation();
                    const providerName = btn.dataset.provider;
                    if (providerName) {
                        selectProvider(providerName);
                    }
                });
            });

            editorContent.querySelectorAll('.provider-list-delete-btn').forEach(btn => {
                btn.addEventListener('click', (e) => {
                    e.stopPropagation();
                    const providerName = btn.dataset.provider;
                    if (providerName) {
                        deleteProviderFromList(providerName);
                    }
                });
            });

            editorContent.querySelectorAll('.provider-list-duplicate-btn').forEach(btn => {
                btn.addEventListener('click', (e) => {
                    e.stopPropagation();
                    const providerName = btn.dataset.provider;
                    if (providerName) {
                        duplicateProviderFromList(providerName);
                    }
                });
            });
        } else {
            setHTMLContent(editorContent, `
                <div class="empty-state">
                    <h3>${i18n('customRulesEditor_welcome')}</h3>
                    <p>${i18n('customRulesEditor_description')}</p>
                    <button class="btn btn-primary" id="empty-state-add-btn">
                        <svg width="14" height="14" viewBox="0 -960 960 960" fill="currentColor">
                            <path d="M440-120v-320H120v-80h320v-320h80v320h320v80H520v320h-80Z"/>
                        </svg>
                        ${i18n('customRulesEditor_createFirst')}
                    </button>
                </div>
            `);

            const addBtn = document.getElementById('empty-state-add-btn');
            if (addBtn) {
                addBtn.addEventListener('click', showAddProviderModal);
            }
        }
    }
}

/**
 * Show add/edit provider modal
 */
function showAddProviderModal(editProvider = null) {
    if (!providerModal || !modalTitle || !providerForm) {
        console.error('Provider modal elements not found');
        return;
    }
    
    const isEdit = editProvider !== null;
    
    modalTitle.textContent = isEdit ? i18n('customRulesEditor_editProvider') : i18n('customRulesEditor_addNewProvider');
    
    if (isEdit && customRules.providers[editProvider]) {
        const provider = customRules.providers[editProvider];
        const providerNameInput = document.getElementById('provider-name');
        const urlPatternInput = document.getElementById('url-pattern');
        const indexPatternInput = document.getElementById('index-pattern');
        const domainPatternsInput = document.getElementById('domain-patterns');
        const completeProviderInput = document.getElementById('complete-provider');
        const forceRedirectionInput = document.getElementById('force-redirection');
        const urlPatternRadio = document.getElementById('pattern-type-url');
        const domainPatternsRadio = document.getElementById('pattern-type-domain');

        if (providerNameInput) providerNameInput.value = editProvider;
        if (completeProviderInput) completeProviderInput.checked = provider.completeProvider || false;
        if (forceRedirectionInput) forceRedirectionInput.checked = provider.forceRedirection || false;

        // Set pattern type and values based on provider data
        if (provider.urlPattern) {
            if (urlPatternRadio) urlPatternRadio.checked = true;
            if (urlPatternInput) urlPatternInput.value = provider.urlPattern;
            if (indexPatternInput) indexPatternInput.value = formatIndexPatternValue(provider.indexPattern);
            if (domainPatternsInput) domainPatternsInput.value = '';
        } else if (toDomainPatternArray(provider.domainPatterns).length > 0) {
            if (domainPatternsRadio) domainPatternsRadio.checked = true;
            if (domainPatternsInput) domainPatternsInput.value = toDomainPatternArray(provider.domainPatterns).join('\n');
            if (urlPatternInput) urlPatternInput.value = '';
            if (indexPatternInput) indexPatternInput.value = '';
        } else {
            // Default to URL pattern for new providers
            if (urlPatternRadio) urlPatternRadio.checked = true;
            if (urlPatternInput) urlPatternInput.value = '';
            if (indexPatternInput) indexPatternInput.value = '';
            if (domainPatternsInput) domainPatternsInput.value = '';
        }

        updatePatternTypeDisplay();
    } else {
        providerForm.reset();
        const indexPatternInput = document.getElementById('index-pattern');
        if (indexPatternInput) indexPatternInput.value = '';
        // Default to URL pattern for new providers
        const urlPatternRadio = document.getElementById('pattern-type-url');        if (urlPatternRadio) urlPatternRadio.checked = true;
        updatePatternTypeDisplay();
    }
    
    // Setup pattern type change listeners
    setupPatternTypeListeners();
    
    providerForm.dataset.editProvider = editProvider || '';
    providerModal.classList.add('show');
}

/**
 * Setup pattern type change listeners
 */
function setupPatternTypeListeners() {
    const urlPatternRadio = document.getElementById('pattern-type-url');
    const domainPatternsRadio = document.getElementById('pattern-type-domain');
    
    if (urlPatternRadio) {
        urlPatternRadio.addEventListener('change', updatePatternTypeDisplay);
    }
    if (domainPatternsRadio) {
        domainPatternsRadio.addEventListener('change', updatePatternTypeDisplay);
    }
}

/**
 * Update pattern type display based on radio selection
 */
function updatePatternTypeDisplay() {
    const urlPatternRadio = document.getElementById('pattern-type-url');
    const urlPatternGroup = document.getElementById('url-pattern-group');
    const indexPatternGroup = document.getElementById('index-pattern-group');
    const domainPatternsGroup = document.getElementById('domain-patterns-group');

    if (urlPatternRadio && urlPatternRadio.checked) {
        if (urlPatternGroup) urlPatternGroup.style.display = 'block';
        if (indexPatternGroup) indexPatternGroup.style.display = 'block';
        if (domainPatternsGroup) domainPatternsGroup.style.display = 'none';
    } else {
        if (urlPatternGroup) urlPatternGroup.style.display = 'none';
        if (indexPatternGroup) indexPatternGroup.style.display = 'none';
        if (domainPatternsGroup) domainPatternsGroup.style.display = 'block';
    }
}
/**
 * Hide provider modal
 */
function hideProviderModal() {
    if (!providerModal || !providerForm) {
        return;
    }
    
    providerModal.classList.remove('show');
    providerForm.reset();
    delete providerForm.dataset.editProvider;
}

/**
 * Handle provider form submission
 */
async function handleProviderSubmit(e) {
    e.preventDefault();
    
    const formData = new FormData(providerForm);
    const providerName = formData.get('provider-name') || document.getElementById('provider-name').value;
    const patternType = formData.get('pattern-type');
    const urlPattern = document.getElementById('url-pattern').value || '';
    const indexPattern = normalizeIndexPatternValue(document.getElementById('index-pattern').value || '');
    const domainPatternsText = document.getElementById('domain-patterns').value || '';
    const domainPatterns = domainPatternsText.split('\n').map(p => p.trim()).filter(p => p !== '');
    const completeProvider = document.getElementById('complete-provider').checked;
    const forceRedirection = document.getElementById('force-redirection').checked;
    
    const editProvider = providerForm.dataset.editProvider;
    const isEdit = editProvider !== '';
    
    // Validation
    if (!providerName) {
        await modalAlert(i18n('customRulesEditor_providerNameRequired'));
        return;
    }
    
    // Validate pattern type selection
    if (patternType === 'urlPattern') {
        if (!urlPattern || urlPattern.trim() === '') {
            await modalAlert(i18n('customRulesEditor_urlPatternRequired'));
            return;
        }
        
        // Validate regex
        try {
            new RegExp(urlPattern);
        } catch (error) {
            await modalAlert(i18n('customRulesEditor_invalidUrlPattern', error.message));
            return;
        }
    } else if (patternType === 'domainPatterns') {
        if (domainPatterns.length === 0) {
            await modalAlert(i18n('customRulesEditor_domainPatternsRequired'));
            return;
        }
        
        // Validate domain patterns
        for (const pattern of domainPatterns) {
            if (!pattern.includes('.') && !pattern.startsWith('||') && !pattern.includes('*')) {
                await modalAlert(i18n('customRulesEditor_invalidDomainPattern', pattern));
                return;
            }
        }
    } else {
        await modalAlert(i18n('customRulesEditor_patternTypeRequired'));
        return;
    }
    
    // Check for duplicate name (only if not editing the same provider)
    if (!isEdit && customRules.providers[providerName]) {
        await modalAlert(i18n('customRulesEditor_providerNameExists'));
        return;
    }
    
    // Build provider object.
    // For edits/renames, preserve existing advanced fields (rules, exceptions, etc.)
    // and only update values exposed by this modal.
    const existingProvider = (isEdit && customRules.providers[editProvider])
        ? customRules.providers[editProvider]
        : null;
    const provider = existingProvider
        ? JSON.parse(JSON.stringify(existingProvider))
        : createProviderSkeleton();
    const syntaxAdjustedProvider = normalizeProviderForEditor(provider);

    if (completeProvider) syntaxAdjustedProvider.completeProvider = true;
    else delete syntaxAdjustedProvider.completeProvider;
    if (forceRedirection) syntaxAdjustedProvider.forceRedirection = true;
    else delete syntaxAdjustedProvider.forceRedirection;

    // Update selected pattern type and clear the mutually exclusive field.
    if (patternType === 'urlPattern') {
        syntaxAdjustedProvider.urlPattern = urlPattern;
        if (indexPattern) syntaxAdjustedProvider.indexPattern = indexPattern;
        else delete syntaxAdjustedProvider.indexPattern;
        delete syntaxAdjustedProvider.domainPatterns;
    } else if (patternType === 'domainPatterns') {
        syntaxAdjustedProvider.domainPatterns = domainPatterns;
        delete syntaxAdjustedProvider.urlPattern;
        delete syntaxAdjustedProvider.indexPattern;
    }
    
    try {
        // If editing and name changed, remove old entry
        if (isEdit && editProvider !== providerName) {
            delete customRules.providers[editProvider];
        }
        
        customRules.providers[providerName] = compactProviderForEditor(syntaxAdjustedProvider);
        await saveCustomRules();
        
        hideProviderModal();
        updateUI();
        await selectProvider(providerName);
        
    } catch (error) {
        await modalAlert(i18n('customRulesEditor_failedToSaveProvider'));
    }
}

/**
 * Edit provider name
 */
function editProviderName(providerName) {
    showAddProviderModal(providerName);
}

/**
 * Duplicate provider
 */
function duplicateProvider(providerName) {
    const provider = customRules.providers[providerName];
    if (!provider) return;
    
    let newName = `${providerName}_${i18n('customRulesEditor_copy')}`;
    let counter = 1;
    
    while (customRules.providers[newName]) {
        newName = `${providerName}_${i18n('customRulesEditor_copy')}_${counter}`;
        counter++;
    }
    
    customRules.providers[newName] = JSON.parse(JSON.stringify(provider));
    saveCustomRules();
    updateUI();
    selectProvider(newName);
}

/**
 * Export custom rules to file
 */
async function exportCustomRules() {
    try {
        const exportData = {
            format: 'linkumori-custom-rules-export',
            version: 1,
            exportedAt: new Date().toISOString(),
            clearurlsCustomRules: {
                providers: customRules.providers || {}
            }
        };

        const blob = new Blob([JSON.stringify(exportData, null, 2)], { type: 'application/json' });
        const url = URL.createObjectURL(blob);
        
        browser.downloads.download({
            url: url,
            filename: 'linkumori_custom_rules.json',
            saveAs: true
        }).then(() => {
            // Success
        }).catch(error => {
            // Fallback for browsers that don't support downloads API
            const a = document.createElement('a');
            a.href = url;
            a.download = 'linkumori_custom_rules.json';
            document.body.appendChild(a);
            a.click();
            document.body.removeChild(a);
            URL.revokeObjectURL(url);
        });
        
    } catch (error) {
        await modalAlert(i18n('customRulesEditor_exportFailed'));
    }
}

function getProvidersFromImportedCustomRules(imported) {
    if (!imported || typeof imported !== 'object' || Array.isArray(imported)) {
        return null;
    }

    const candidates = [
        imported.clearurlsCustomRules,
        imported.custom_rules,
        imported.customRules,
        imported
    ];

    for (const candidate of candidates) {
        if (!candidate || typeof candidate !== 'object' || Array.isArray(candidate)) {
            continue;
        }
        if (candidate.providers && typeof candidate.providers === 'object' && !Array.isArray(candidate.providers)) {
            if (candidate.version === 2) {
                validateImportedV2Document(candidate);
                return applyImportedV2Defaults(candidate.providers, candidate.defaults);
            }
            return candidate.providers;
        }
    }

    const reservedKeys = new Set([
        'format',
        'version',
        'exportedAt',
        'clearurlsCustomRules',
        'custom_rules',
        'customRules'
    ]);
    const keys = Object.keys(imported).filter(key => !reservedKeys.has(key));
    if (keys.length > 0 && keys.every(key => typeof imported[key] === 'object' && imported[key] !== null && !Array.isArray(imported[key]))) {
        return keys.reduce((providers, key) => {
            providers[key] = imported[key];
            return providers;
        }, {});
    }

    return null;
}

function assertRequestTypesSelection(value, label) {
    if (value === 'all') return;
    if (!Array.isArray(value) || value.some(item => typeof item !== 'string')) {
        throw new Error(`${label} must be "all" or an array of strings`);
    }
}

function assertOnlyKeys(value, allowedKeys, label) {
    Object.keys(value || {}).forEach((key) => {
        if (!allowedKeys.includes(key)) {
            throw new Error(`${label}.${key} is not allowed in ClearURLs core v2`);
        }
    });
}

function validateImportedV2Document(document) {
    if (!document || document.version !== 2) {
        throw new Error('Imported v2 document must use version: 2');
    }
    assertOnlyKeys(document, ['version', 'defaults', 'providers'], 'Imported v2 document');
    if (!isPlainObject(document.defaults)) {
        throw new Error('Imported v2 document must include defaults');
    }
    assertOnlyKeys(document.defaults, ['active', 'description', 'requestTypes', 'preprocessors', 'exceptions'], 'Imported v2 defaults');
    if (typeof document.defaults.active !== 'boolean') {
        throw new Error('Imported v2 defaults.active must be a boolean');
    }
    if (document.defaults.description !== undefined && typeof document.defaults.description !== 'string') {
        throw new Error('Imported v2 defaults.description must be a string');
    }
    assertRequestTypesSelection(document.defaults.requestTypes, 'Imported v2 defaults.requestTypes');
    if (!Array.isArray(document.defaults.preprocessors)) {
        throw new Error('Imported v2 defaults.preprocessors must be an array');
    }
    document.defaults.preprocessors.forEach((preprocessor, index) => {
        assertPreprocessorSyntax(preprocessor, `Imported v2 defaults.preprocessors[${index}]`);
    });
    if (!Array.isArray(document.defaults.exceptions) || document.defaults.exceptions.some(item => typeof item !== 'string')) {
        throw new Error('Imported v2 defaults.exceptions must be an array of strings');
    }
    if (!isPlainObject(document.providers)) {
        throw new Error('Imported v2 providers must be an object');
    }
    Object.entries(document.providers).forEach(([providerName, provider]) => {
        if (!isPlainObject(provider)) {
            throw new Error(`Imported v2 provider "${providerName}" must be an object`);
        }
        assertOnlyKeys(provider, ['completeProvider', 'exceptions', 'forceRedirection', 'methods', 'rules', 'urlPattern'], `Imported v2 provider "${providerName}"`);
        if (typeof provider.urlPattern !== 'string') {
            throw new Error(`Imported v2 provider "${providerName}" must include urlPattern`);
        }
        if (provider.rules !== undefined && !Array.isArray(provider.rules)) {
            throw new Error(`Imported v2 provider "${providerName}".rules must be an array`);
        }
        if (provider.exceptions !== undefined &&
            (!Array.isArray(provider.exceptions) || provider.exceptions.some(item => typeof item !== 'string'))) {
            throw new Error(`Imported v2 provider "${providerName}".exceptions must be an array of strings`);
        }
        if (provider.methods !== undefined &&
            (!Array.isArray(provider.methods) || provider.methods.some(item => typeof item !== 'string'))) {
            throw new Error(`Imported v2 provider "${providerName}".methods must be an array of strings`);
        }
        (provider.rules || []).forEach((rule, index) => {
            if (isPlainObject(rule)) {
                assertOnlyKeys(rule, ['action', 'active', 'aliases', 'description', 'exceptions', 'id', 'kind', 'match', 'preprocessors', 'referralMarketing', 'requestTypes'], `Imported v2 provider "${providerName}".rules[${index}]`);
                if (isPlainObject(rule.action)) {
                    assertOnlyKeys(rule.action, ['type', 'replacePattern'], `Imported v2 provider "${providerName}".rules[${index}].action`);
                }
            }
        });
        assertRuleEntrySyntax(provider, providerName);
    });
}

function applyImportedV2Defaults(providers, defaults) {
    const result = JSON.parse(JSON.stringify(providers || {}));
    Object.values(result).forEach((provider) => {
        if (!provider || !Array.isArray(provider.rules)) return;
        provider.rules = provider.rules.map((rule) => {
            if (!isPlainObject(rule) || typeof rule.match !== 'string') return rule;
            return {
                ...rule,
                ...(rule.active === undefined && typeof defaults.active === 'boolean' ? { active: defaults.active } : {}),
                ...(rule.description === undefined && typeof defaults.description === 'string' ? { description: defaults.description } : {}),
                ...(rule.requestTypes === undefined && defaults.requestTypes !== undefined ? { requestTypes: defaults.requestTypes } : {}),
                ...(rule.preprocessors === undefined && Array.isArray(defaults.preprocessors) ? { preprocessors: defaults.preprocessors } : {}),
                ...(rule.exceptions === undefined && Array.isArray(defaults.exceptions) ? { exceptions: defaults.exceptions } : {})
            };
        });
    });
    return result;
}

function validateImportedProviders(providersData) {
    if (!providersData || Object.keys(providersData).length === 0) {
        throw new Error(i18n('customRulesEditor_noProvidersInFile'));
    }

    for (const [name, provider] of Object.entries(providersData)) {
        assertProviderArrayFields(provider, name);
        assertRuleEntrySyntax(provider, name);
        assertDomainRedirectionSyntax(provider, name);
        provider.indexPattern = normalizeIndexPatternValue(provider.indexPattern);
        if (!provider.indexPattern) delete provider.indexPattern;
        provider.syntax = LINKUMORI_CLEARURLS_DIALECT_SYNTAX;
        const normalizedDomainPatterns = toDomainPatternArray(provider.domainPatterns);
        if (!provider.urlPattern && normalizedDomainPatterns.length === 0) {
            throw new Error(i18n('customRulesEditor_providerMissingUrlPatternOrDomainPatterns', name));
        }

        if (provider.urlPattern && normalizedDomainPatterns.length > 0) {
            throw new Error(i18n('customRulesEditor_providerHasBothPatternTypes', name));
        }

        if (provider.urlPattern) {
            new RegExp(provider.urlPattern);
        }

        if (normalizedDomainPatterns.length > 0) {
            provider.domainPatterns = normalizedDomainPatterns;
            for (const pattern of normalizedDomainPatterns) {
                if (!pattern || pattern.trim() === '') {
                    throw new Error(i18n('customRulesEditor_providerHasEmptyDomainPattern', name) || `Provider "${name}" has empty domain patterns`);
                }
            }
        }
    }
}

function assertProviderArrayFields(provider, providerName = '') {
    [
        'rules',
        'rawRules',
        'referralMarketing',
        'redirections',
        'exceptions',
        'domainExceptions',
        'domainRedirections',
        'methods',
        'resourceTypes'
    ].forEach((key) => {
        if (provider[key] !== undefined && !Array.isArray(provider[key])) {
            throw new Error(`${providerName || 'Provider'}: ${key} must be an array`);
        }
    });
}

/**
 * Handle file import
 */
async function handleFileImport(e) {
    const file = e.target.files[0];
    if (!file) return;
    
    const reader = new FileReader();
    reader.onload = async function(event) {
        try {
            const imported = JSON.parse(event.target.result);

            if (!imported || typeof imported !== 'object' || Array.isArray(imported)) {
                throw new Error(i18n('customRulesEditor_invalidFileStructure'));
            }

            const providersData = getProvidersFromImportedCustomRules(imported);
            const hasProviderRules = providersData && Object.keys(providersData).length > 0;

            if (!hasProviderRules) {
                throw new Error(i18n('customRulesEditor_invalidFileStructure'));
            }

            if (hasProviderRules) {
                validateImportedProviders(providersData);
            }

            const confirmed = await modalConfirm(i18n('customRulesEditor_importConfirm'));
            if (confirmed) {
                if (hasProviderRules) {
                    customRules = { providers: providersData };
                    await saveCustomRules();
                }

                await updateRulesStatus();
                updateUI();
                showEmptyState();
            }
            
        } catch (error) {
            await modalAlert(i18n('customRulesEditor_importFailed', error.message));
        } finally {
            // Reset file input
            e.target.value = '';
        }
    };
    
    reader.readAsText(file);
}

/**
 * Update editor status indicator
 */
function updateEditorStatus(type, message) {
    if (!editorStatus) return;
    
    editorStatus.className = `status-indicator status-${type}`;
    editorStatus.textContent = message;
}

/**
 * Setup theme toggle functionality
 */
function initializeTheme() {
    const themeToggle = document.getElementById('theme-toggle') || document.getElementById('themeToggle');
    document.documentElement.setAttribute('data-theme', normalizeTheme(document.documentElement.getAttribute('data-theme') || DEFAULT_THEME));
    browser.storage.local.get([THEME_STORAGE_KEY]).then((result) => {
        const savedTheme = result[THEME_STORAGE_KEY] || DEFAULT_THEME;
        document.documentElement.setAttribute('data-theme', normalizeTheme(savedTheme));
        syncBootstrapTheme(savedTheme);
    }).catch(() => {
        document.documentElement.setAttribute('data-theme', normalizeTheme(DEFAULT_THEME));
        syncBootstrapTheme(DEFAULT_THEME);
    });
    
    // Apply saved theme
    if (themeToggle) {
        themeToggle.onclick = async () => {
            const currentTheme = normalizeTheme(document.documentElement.getAttribute('data-theme') || DEFAULT_THEME);
            const result = await browser.storage.local.get([
                LAST_DARK_THEME_STORAGE_KEY,
                LIGHT_THEME_STORAGE_KEY,
                DARK_THEME_STORAGE_KEY
            ]);
            const { nextTheme: newTheme, payload } = buildThemeTogglePayload(currentTheme, result);

            // Apply theme
            document.documentElement.setAttribute('data-theme', normalizeTheme(newTheme));
            syncBootstrapTheme(newTheme);
            await browser.storage.local.set(payload);
        };
    }
}
/**
 * Initialize theme on page load
 */


/**
 * Escape HTML to prevent XSS
 */
function escapeHtml(text) {
    const div = document.createElement('div');
    div.textContent = text;
    return div.innerHTML;
}

if (typeof browser !== 'undefined' && browser.storage && browser.storage.onChanged) {
    browser.storage.onChanged.addListener((changes, areaName) => {
        if (areaName !== 'local') {
            return;
        }

        if (changes[THEME_STORAGE_KEY] && changes[THEME_STORAGE_KEY].newValue) {
            document.documentElement.setAttribute('data-theme', normalizeTheme(changes[THEME_STORAGE_KEY].newValue));
            syncBootstrapTheme(changes[THEME_STORAGE_KEY].newValue);
        }
    });
}
