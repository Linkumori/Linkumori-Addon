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
// Ids pinned for rules without an "id" the first time they were switched
// off (see core_js/linkumori_rule_pins.js).
let clearURLsRuleIdPins = [];
let clearURLsProviderSnapshot = null;
let disabledRulesActivationMode = 'pattern';
let userWhitelist = [];
let historyApiWhitelist = [];
let whitelistSearchTerm = '';
let whitelistStatusTimer = null;
const CUSTOM_RULES_WHITELIST_TYPES = Object.freeze({
    general: {
        addFunction: 'addToWhitelist',
        removeFunction: 'removeFromWhitelist'
    },
    history: {
        addFunction: 'addToHistoryApiWhitelist',
        removeFunction: 'removeFromHistoryApiWhitelist'
    }
});

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

// Checks a "|"-prefixed redirect entry: "||go.example.com^$redirect=https://example.com/".
function assertDomainRedirectEntry(entry, label) {
    const markerIndex = entry.indexOf('$redirect=');
    const pattern = markerIndex === -1 ? '' : entry.slice(0, markerIndex).trim();
    const target = markerIndex === -1 ? '' : entry.slice(markerIndex + '$redirect='.length).trim();
    if (!pattern || !target) {
        throw new Error(`${label}: a redirect starting with "|" must look like "||example.com^$redirect=https://target/"`);
    }
}

const OBJECT_STYLE_RULE_FIELDS = Object.freeze([
    'rules',
    'rawRules',
    'referralMarketing',
    'exceptions',
    'redirections',
    'fieldRedirections'
]);

// Lists whose entries are field rules: parameter names, name regexes or
// $removeparam filters.
const FIELD_RULE_LISTS = Object.freeze(['rules', 'referralMarketing', 'fieldRedirections']);

// Lists a rule's `order` can reorder; everything else runs at a fixed step.
const ORDERABLE_RULE_LISTS = Object.freeze(['rules', 'rawRules', 'referralMarketing']);

// Lists where a rule's `"referralMarketing": true` means something.
const REFERRAL_MARKETING_KEY_LISTS = Object.freeze(['rules', 'referralMarketing']);

function isRemoveParamRuleText(text) {
    return getRemoveParamOptions(text) !== null;
}

const CORE_RULE_ID_PATTERN = /^[a-z0-9][a-z0-9_-]*$/;

function isPlainObject(value) {
    return !!value && typeof value === 'object' && !Array.isArray(value);
}

function countRuleEntries(entries) {
    return Array.isArray(entries) ? entries.length : 0;
}

const SUPPORTED_PREPROCESSORS = Object.freeze([
    'urlEncode',
    'urlDecode',
    'doubleUrlEncode',
    'doubleUrlDecode',
    'base64Encode',
    'base64Decode'
]);

function assertPreprocessorSyntax(preprocessor, prefix) {
    if (!isPlainObject(preprocessor)) {
        throw new Error(`${prefix} must be an object`);
    }
    assertOnlyKeys(preprocessor, ['type', 'inputs'], prefix);
    if (typeof preprocessor.type !== 'string' || preprocessor.type.trim() === '') {
        throw new Error(`${prefix}.type must be a non-empty string`);
    }
    if (!SUPPORTED_PREPROCESSORS.includes(preprocessor.type)) {
        throw new Error(`${prefix}.type must be one of: ${SUPPORTED_PREPROCESSORS.join(', ')}`);
    }
    if (preprocessor.inputs !== 'all' &&
        (!Array.isArray(preprocessor.inputs) ||
            preprocessor.inputs.some(input => !Number.isInteger(input) || input < 1))) {
        throw new Error(`${prefix}.inputs must be "all" or an array of positive integers`);
    }
}

const RULE_OBJECT_KEYS = Object.freeze([
    'id', 'aliases', 'matchPattern', 'replacePattern', 'preprocessors', 'requestTypes', 'exceptions',
    'flags', 'order', 'referralMarketing', 'active', 'description', 'historyBypassProtection', 'targetId',
    '_linkumoriActivationIds', '_linkumoriLegacyRuleIds'
]);

function assertObjectStyleRuleSyntax(rule, providerName, fieldName, index) {
    const prefix = `${providerName || 'Provider'}: ${fieldName}[${index}]`;
    if (!isPlainObject(rule)) {
        throw new Error(`${prefix} must be a string or rule object`);
    }
    assertOnlyKeys(rule, RULE_OBJECT_KEYS, prefix);
    if (typeof rule.matchPattern !== 'string') {
        throw new Error(`${prefix}.matchPattern must be a string`);
    }
    if (rule.replacePattern !== undefined && typeof rule.replacePattern !== 'string') {
        throw new Error(`${prefix}.replacePattern must be a string`);
    }
    if (rule.targetId !== undefined) {
        if (typeof rule.targetId !== 'string' || !rule.targetId) throw new Error(`${prefix}.targetId must be a rule id`);
        if (fieldName !== 'rawRules') throw new Error(`${prefix}.targetId only applies to "@@…$rawrule=" exceptions in rawRules`);
    }
    if (rule.flags !== undefined && typeof rule.flags !== 'string') {
        throw new Error(`${prefix}.flags must be a string (regex flags such as "i")`);
    }
    if (rule.referralMarketing !== undefined) {
        if (typeof rule.referralMarketing !== 'boolean') {
            throw new Error(`${prefix}.referralMarketing must be true or false`);
        }
        if (!REFERRAL_MARKETING_KEY_LISTS.includes(fieldName)) {
            throw new Error(`${prefix}.referralMarketing has no effect in ${fieldName}; it only applies in ${REFERRAL_MARKETING_KEY_LISTS.join(', ')}`);
        }
    }
    if (rule.order !== undefined) {
        if (typeof rule.order !== 'number' || !Number.isFinite(rule.order)) {
            throw new Error(`${prefix}.order must be a number`);
        }
        if (!ORDERABLE_RULE_LISTS.includes(fieldName)) {
            throw new Error(`${prefix}.order has no effect in ${fieldName}; it only applies in ${ORDERABLE_RULE_LISTS.join(', ')}`);
        }
        if (isRemoveParamRuleText(rule.matchPattern)) {
            throw new Error(`${prefix}.order has no effect on a $removeparam filter; $removeparam filters always run after the other rules`);
        }
    }
    if (rule.active !== undefined && typeof rule.active !== 'boolean') {
        throw new Error(`${prefix}.active must be a boolean`);
    }
    if (rule.id !== undefined && typeof rule.id !== 'string') {
        throw new Error(`${prefix}.id must be a string`);
    }
    if (rule.id !== undefined && !CORE_RULE_ID_PATTERN.test(rule.id)) {
        throw new Error(`${prefix}.id must match ${CORE_RULE_ID_PATTERN.source}`);
    }
    if (rule.aliases !== undefined &&
        (!Array.isArray(rule.aliases) || rule.aliases.some(alias => typeof alias !== 'string' || !CORE_RULE_ID_PATTERN.test(alias)))) {
        throw new Error(`${prefix}.aliases must be a list of ids matching ${CORE_RULE_ID_PATTERN.source}`);
    }
    if (rule.aliases !== undefined && rule.id !== undefined && rule.aliases.includes(rule.id)) {
        throw new Error(`${prefix}.aliases must not contain the rule's own id`);
    }
    if (rule.description !== undefined && typeof rule.description !== 'string') {
        throw new Error(`${prefix}.description must be a string`);
    }
    if (rule.historyBypassProtection !== undefined && typeof rule.historyBypassProtection !== 'boolean') {
        throw new Error(`${prefix}.historyBypassProtection must be a boolean`);
    }
    if (rule.exceptions !== undefined &&
        (!Array.isArray(rule.exceptions) || rule.exceptions.some(item => typeof item !== 'string'))) {
        throw new Error(`${prefix}.exceptions must be an array of strings`);
    }
    if (rule.requestTypes !== undefined &&
        (!Array.isArray(rule.requestTypes) || rule.requestTypes.some(item => typeof item !== 'string'))) {
        throw new Error(`${prefix}.requestTypes must be an array of strings`);
    }
    if (rule.preprocessors !== undefined && !Array.isArray(rule.preprocessors)) {
        throw new Error(`${prefix}.preprocessors must be an array`);
    }
    (rule.preprocessors || []).forEach((preprocessor, preprocessorIndex) => {
        assertPreprocessorSyntax(preprocessor, `${prefix}.preprocessors[${preprocessorIndex}]`);
    });
    if (rule.matchPattern.trim().startsWith('|') && (fieldName === 'exceptions' || fieldName === 'redirections')) {
        if (fieldName === 'redirections') assertDomainRedirectEntry(rule.matchPattern, prefix);
    } else if (fieldName === 'rawRules' && splitScopedRawRule(rule.matchPattern)) {
        new RegExp(splitScopedRawRule(rule.matchPattern).regex, typeof rule.flags === 'string' ? rule.flags : 'gi');
    } else {
        new RegExp(rule.matchPattern, typeof rule.flags === 'string' ? rule.flags : 'i');
    }
    (rule.exceptions || []).forEach(exception => new RegExp(exception));
}

const PROVIDER_FIELDS = Object.freeze([
    'domainPatterns', 'urlPattern', 'indexPattern', 'rules', 'referralMarketing', 'rawRules',
    'exceptions', 'redirections', 'fieldRedirections', 'completeProvider', 'forceRedirection', 'methods',
    'resourceTypes', 'historyBypassProtection', 'active'
]);
const REMOVEPARAM_VALUE_OPTIONS = new Set(['removeparam', 'domain', 'to', 'method', 'history-bypass-protection']);
const REMOVEPARAM_FLAG_OPTIONS = new Set([
    'first-party', 'third-party', 'strict-first-party', 'strict-third-party', 'match-case',
    'document', 'subdocument', 'script', 'stylesheet', 'image', 'imageset', 'media', 'object',
    'other', 'ping', 'websocket', 'xmlhttprequest', 'font'
]);
const REMOVEPARAM_NEGATABLE_OPTIONS = new Set([
    'document', 'subdocument', 'script', 'stylesheet', 'image', 'imageset', 'media', 'object',
    'other', 'ping', 'websocket', 'xmlhttprequest', 'font'
]);

// The options of a "$removeparam" filter, split on commas outside /regex/
// values, or null when the text is not a $removeparam filter.
function getRemoveParamOptions(text) {
    const body = String(text || '').startsWith('@@') ? String(text).slice(2) : String(text || '');
    let start = -1;
    if (body.startsWith('/')) {
        let escaped = false;
        let inClass = false;
        for (let i = 1; i < body.length; i++) {
            const ch = body.charAt(i);
            if (escaped) { escaped = false; continue; }
            if (ch === '\\') { escaped = true; continue; }
            if (inClass) { if (ch === ']') inClass = false; continue; }
            if (ch === '[') { inClass = true; continue; }
            if (ch === '/') { start = body.indexOf('$', i + 1); break; }
        }
    } else {
        start = body.indexOf('$');
    }
    if (start === -1) return null;
    const options = [];
    let current = '';
    let inRegex = false;
    let escaped = false;
    const text2 = body.slice(start + 1);
    for (let i = 0; i < text2.length; i++) {
        const ch = text2.charAt(i);
        const next = text2.charAt(i + 1);
        if (!inRegex) {
            if (ch === ',') { options.push(current.trim()); current = ''; continue; }
            current += ch;
            if ((ch === '=' || ch === '|') && (next === '/' || (next === '~' && text2.charAt(i + 2) === '/'))) {
                current += next === '~' ? '~/' : '/';
                i += next === '~' ? 2 : 1;
                inRegex = true;
            }
            continue;
        }
        current += ch;
        if (escaped) { escaped = false; continue; }
        if (ch === '\\') { escaped = true; continue; }
        if (ch === '/') inRegex = false;
    }
    options.push(current.trim());
    return options.some(option => /^removeparam(?:=|$)/i.test(option)) ? options : null;
}

function assertKnownFieldsAndOptions(provider, providerName = '') {
    const label = providerName || 'Provider';
    Object.keys(provider).forEach((key) => {
        if (!PROVIDER_FIELDS.includes(key)) {
            throw new Error(`${label}: unknown field "${key}"`);
        }
    });
    FIELD_RULE_LISTS.forEach((fieldName) => {
        (Array.isArray(provider[fieldName]) ? provider[fieldName] : []).forEach((entry, index) => {
            const text = typeof entry === 'string' ? entry
                : (isPlainObject(entry) && typeof entry.matchPattern === 'string' ? entry.matchPattern : '');
            // @@ keeps a parameter; a redirect has nothing to keep.
            if (fieldName === 'fieldRedirections' && text.trim().startsWith('@@')) {
                throw new Error(`${label}: fieldRedirections[${index}] starts with "@@", which only applies to $removeparam filters in rules and referralMarketing; use a rule object's "exceptions" instead`);
            }
            const options = getRemoveParamOptions(text);
            if (!options) return;
            options.forEach((option) => {
                const lower = option.toLowerCase();
                const name = lower.split('=')[0];
                const known = lower.includes('=')
                    ? REMOVEPARAM_VALUE_OPTIONS.has(name)
                    : (lower === 'removeparam' || REMOVEPARAM_FLAG_OPTIONS.has(lower) ||
                        (lower.startsWith('~') && REMOVEPARAM_NEGATABLE_OPTIONS.has(lower.slice(1))));
                if (!known) {
                    throw new Error(`${label}: ${fieldName}[${index}] has unknown $removeparam option "${option}"`);
                }
            });
        });
    });
    (Array.isArray(provider.redirections) ? provider.redirections : []).forEach((entry, index) => {
        if (typeof entry === 'string' && entry.trim().startsWith('|')) {
            assertDomainRedirectEntry(entry, `${label}: redirections[${index}]`);
        }
    });
}

// A rawRules entry can carry the pattern and options of a $removeparam
// filter, with "rawrule=" last: "||amazon.*^$third-party,rawrule=\\/ref=[^/?]*".
// With "@@" in front it is an exception that stops raw rules. Returns the
// pattern (with any "@@"), the option list and the regex; null for a plain regex.
function splitScopedRawRule(matchPattern) {
    const text = String(matchPattern || '');
    const markerRegex = /[$,]rawrule=/ig;
    let marker;
    while ((marker = markerRegex.exec(text))) {
        const start = findRuleModifierStart(text.slice(0, marker.index + 1));
        if (start === -1) continue;
        const optionText = marker.index > start ? text.slice(start + 1, marker.index) : '';
        const options = optionText ? getRemoveParamOptions('$' + optionText + ',removeparam') : [];
        return {
            pattern: text.slice(0, start).trim(),
            options: (options || []).filter(option => option && !/^removeparam$/i.test(option)),
            regex: text.slice(marker.index + marker[0].length)
        };
    }
    return null;
}

// Index of the "$" that starts a filter's options, skipping a leading "@@"
// and a "/regex/" pattern that may itself contain "$"; -1 when there is none.
function findRuleModifierStart(text) {
    const offset = text.startsWith('@@') ? 2 : 0;
    const body = text.slice(offset);
    if (!body.startsWith('/')) return text.indexOf('$', offset);
    let escaped = false, inClass = false;
    for (let i = 1; i < body.length; i++) {
        const ch = body.charAt(i);
        if (escaped) { escaped = false; continue; }
        if (ch === '\\') { escaped = true; continue; }
        if (inClass) { if (ch === ']') inClass = false; continue; }
        if (ch === '[') { inClass = true; continue; }
        if (ch === '/') { const at = body.indexOf('$', i + 1); return at === -1 ? -1 : at + offset; }
    }
    return -1;
}

// What the engine would reject in a raw rule's $removeparam-style options,
// as an error message, or null.
function rawRuleOptionProblem(options, isException) {
    const lower = options.map(option => option.toLowerCase());
    for (const option of lower) {
        const name = option.split('=')[0];
        if (name === 'removeparam' || name === 'rawrule') return `has "${name}" among its options; "rawrule=" goes last, once`;
        const known = option.includes('=') ? REMOVEPARAM_VALUE_OPTIONS.has(name) && name !== 'removeparam'
            : (REMOVEPARAM_FLAG_OPTIONS.has(option) || (option.startsWith('~') && REMOVEPARAM_NEGATABLE_OPTIONS.has(option.slice(1))));
        if (!known) return `has unknown option "${option}"`;
        const value = option.slice(option.indexOf('=') + 1);
        if ((name === 'domain' || name === 'to' || name === 'method') && !value.replace(/\|/g, '').trim()) {
            return `has an empty "${name}=" option`;
        }
        if (name === 'method' && value.split('|').some(m => !['get', 'head', 'options', 'post', 'put', 'patch', 'delete', 'connect'].includes(m.replace(/^~/, '').trim()))) {
            return `has an unknown method in "${option}"`;
        }
        if (name === 'history-bypass-protection' && !['true', 'false', '1', '0', 'yes', 'no'].includes(value.trim())) {
            return `"${option}" must be true or false`;
        }
    }
    const has = option => lower.includes(option);
    if ((has('first-party') && has('third-party')) || (has('strict-first-party') && has('strict-third-party')) ||
        (has('strict-first-party') && has('third-party')) || (has('strict-third-party') && has('first-party'))) {
        return 'has contradictory first-party/third-party options';
    }
    if (isException && has('match-case')) return 'is an "@@" exception, so "match-case" would do nothing';
    return null;
}

// A pattern with a single leading "|" only matches URLs that literally start
// with the rest of it. Without a scheme ("|https://...") nothing can match,
// so "|example.com^" is always a typo for "||example.com^".
function isBrokenSinglePipePattern(pattern) {
    const text = String(pattern || '').trim();
    return text.startsWith('|') && !text.startsWith('||') && !/^\|[a-z][a-z0-9+.-]*:/i.test(text);
}

function singlePipeError(label, pattern) {
    const rest = String(pattern).trim().slice(1);
    return new Error(`${label}: "${pattern}" starts with a single "|", so it only matches URLs that literally begin with "${rest}" and none do (URLs start with "https://"). Use "||${rest}" to match the domain.`);
}

function countCaptureGroups(source, flags) {
    return new RegExp(`${source}|`, flags).exec('').length - 1;
}

// Checks for mistakes that are valid JSON but silently do the wrong thing.
function assertNoSilentMistakes(provider, providerName = '') {
    const label = providerName || 'Provider';
    const hasUrlPattern = typeof provider.urlPattern === 'string' && provider.urlPattern.trim() !== '';
    if (hasUrlPattern && toDomainPatternArray(provider.domainPatterns).length > 0) {
        throw new Error(i18n('customRulesEditor_providerHasBothPatternTypes', label));
    }
    const checkPattern = (pattern, where) => {
        if (isBrokenSinglePipePattern(pattern)) throw singlePipeError(`${label}: ${where}`, pattern);
    };
    toDomainPatternArray(provider.domainPatterns).forEach((pattern, index) => checkPattern(pattern, `domainPatterns[${index}]`));
    toDomainPatternArray(provider.indexPattern).forEach((pattern, index) => checkPattern(pattern, `indexPattern[${index}]`));
    ['exceptions', 'redirections'].forEach((fieldName) => {
        (Array.isArray(provider[fieldName]) ? provider[fieldName] : []).forEach((entry, index) => {
            const text = typeof entry === 'string' ? entry : (isPlainObject(entry) ? entry.matchPattern : '');
            checkPattern(String(text || '').split('$redirect=')[0], `${fieldName}[${index}]`);
        });
    });
    FIELD_RULE_LISTS.forEach((fieldName) => {
        (Array.isArray(provider[fieldName]) ? provider[fieldName] : []).forEach((entry, index) => {
            const text = typeof entry === 'string' ? entry : (isPlainObject(entry) ? String(entry.matchPattern || '') : '');
            const body = text.startsWith('@@') ? text.slice(2) : text;
            if (body.startsWith('/') || !/\$removeparam/i.test(body)) return;
            checkPattern(body.slice(0, body.indexOf('$')), `${fieldName}[${index}]`);
        });
    });
    // What an "@@…$rawrule=" exception can point at: the ids/aliases and the
    // regex text of the provider's other raw rules.
    const rawRuleIds = new Set(), rawRuleRegexes = new Set();
    (Array.isArray(provider.rawRules) ? provider.rawRules : []).forEach((entry) => {
        const text = typeof entry === 'string' ? entry : (isPlainObject(entry) ? String(entry.matchPattern || '') : '');
        const scoped = splitScopedRawRule(text);
        if (scoped && scoped.pattern.startsWith('@@')) return;
        rawRuleRegexes.add(scoped ? scoped.regex : text);
        if (!isPlainObject(entry)) return;
        if (typeof entry.id === 'string') rawRuleIds.add(entry.id);
        if (Array.isArray(entry.aliases)) entry.aliases.forEach(alias => rawRuleIds.add(alias));
    });
    (Array.isArray(provider.rawRules) ? provider.rawRules : []).forEach((entry, index) => {
        const text = typeof entry === 'string' ? entry : (isPlainObject(entry) ? entry.matchPattern : '');
        const scoped = splitScopedRawRule(text);
        const where = `${label}: rawRules[${index}]`;
        const targetId = isPlainObject(entry) ? entry.targetId : undefined;
        if (targetId !== undefined && !(scoped && scoped.pattern.startsWith('@@'))) {
            throw new Error(`${where} has "targetId", which only works on an exception; start matchPattern with "@@" (e.g. "@@||example.com^$rawrule=")`);
        }
        if (!scoped) return;
        const isException = scoped.pattern.startsWith('@@');
        const optionProblem = rawRuleOptionProblem(scoped.options, isException);
        if (optionProblem) throw new Error(`${where} ${optionProblem}`);
        if (isException && typeof targetId === 'string') {
            if (scoped.regex) throw new Error(`${where} has both "targetId" and a regex after "rawrule="; use one of them`);
            if (!rawRuleIds.has(targetId)) throw new Error(`${where} has targetId "${targetId}", but no raw rule in this provider has that id or alias`);
        } else if (isException && scoped.regex && !rawRuleRegexes.has(scoped.regex)) {
            throw new Error(`${where} is an "@@" exception for "${scoped.regex}", but no raw rule in this provider uses that regex. Give the rule an id and point at it with "targetId" instead`);
        }
        if (isException && isPlainObject(entry)) {
            // An @@ entry only names the raw rules it stops; nothing it would rewrite or reorder.
            ['replacePattern', 'preprocessors', 'order', 'flags'].forEach((key) => {
                if (entry[key] !== undefined) throw new Error(`${where} is an "@@" exception, so "${key}" would do nothing`);
            });
        }
        if (!isException && !scoped.regex) throw new Error(`${where} has nothing after "rawrule="; it needs the regex to delete`);
        checkPattern(isException ? scoped.pattern.slice(2).trim() : scoped.pattern, `rawRules[${index}]`);
        if (!scoped.regex) return;
        try { new RegExp(scoped.regex, isPlainObject(entry) && typeof entry.flags === 'string' ? entry.flags : 'gi'); }
        catch (error) { throw new Error(`${where} has an invalid regex after "rawrule=": ${error.message}`); }
    });
    // A regex redirect without replacePattern goes to its first capture group,
    // so it needs exactly one: none never redirects, more than one is a trap.
    (Array.isArray(provider.redirections) ? provider.redirections : []).forEach((entry, index) => {
        const source = typeof entry === 'string' ? entry : (isPlainObject(entry) ? entry.matchPattern : '');
        if (typeof source !== 'string' || source.trim().startsWith('|')) return;
        if (isPlainObject(entry) && typeof entry.replacePattern === 'string' && entry.replacePattern !== '') return;
        let groups;
        try { groups = countCaptureGroups(source, isPlainObject(entry) && entry.flags ? entry.flags : 'i'); } catch (_) { return; }
        if (groups !== 1) {
            throw new Error(`${label}: redirections[${index}] has ${groups} capture groups; it needs exactly one "( … )" around the destination URL (write other groups as "(?: … )")`);
        }
    });
}

function assertRuleEntrySyntax(provider, providerName = '') {
    assertKnownFieldsAndOptions(provider, providerName);
    assertNoSilentMistakes(provider, providerName);
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
            // Ids and aliases share one namespace per provider.
            if (Array.isArray(entry.aliases)) names.push(...entry.aliases);
            names.forEach((name) => {
                const firstSeenAt = occupiedNames.get(name);
                const here = `${fieldName}[${index}]`;
                if (firstSeenAt) {
                    throw new Error(`${providerName || 'Provider'} reuses rule id "${name}" in ${here}; first used in ${firstSeenAt}`);
                }
                occupiedNames.set(name, here);
            });
        });
    });
}

// ============================================================================
// LINTER
// ============================================================================

function getRuleEntryText(entry) {
    if (typeof entry === 'string') return entry;
    return isPlainObject(entry) && typeof entry.matchPattern === 'string' ? entry.matchPattern : '';
}

function getRuleEntryNames(entry) {
    if (!isPlainObject(entry)) return [];
    return [entry.id, ...(Array.isArray(entry.aliases) ? entry.aliases : [])].filter(name => typeof name === 'string');
}

function tryRuleEntrySyntax(provider, providerName) {
    try {
        assertProviderArrayFields(provider, providerName);
        assertRuleEntrySyntax(provider, providerName);
        return null;
    } catch (error) {
        return error.message;
    }
}

// Every problem in a provider at once; saving stops at the first one.
// Errors are what saving rejects. Warnings are what `lint-rules` warns about
// (docs/filter-syntax.md §10), plus template placeholders left in place.
// Returns [{ severity: 'error' | 'warning', message }].
function lintProvider(provider, providerName = '') {
    const label = providerName || 'Provider';
    const problems = [];
    const error = message => problems.push({ severity: 'error', message });
    const warning = message => problems.push({ severity: 'warning', message });
    if (!isPlainObject(provider)) {
        error(`${label} must be a JSON object`);
        return problems;
    }

    // Provider fields, checked without the rule lists.
    const base = {};
    Object.keys(provider).forEach((key) => {
        if (!PROVIDER_FIELDS.includes(key)) {
            error(`${label}: unknown field "${key}"`);
        } else if (!OBJECT_STYLE_RULE_FIELDS.includes(key)) {
            base[key] = provider[key];
        }
    });
    const baseProblem = tryRuleEntrySyntax(base, label);
    if (baseProblem) error(baseProblem);
    const hasUrlPattern = typeof provider.urlPattern === 'string' && provider.urlPattern.trim() !== '';
    if (!hasUrlPattern && toDomainPatternArray(provider.domainPatterns).length === 0) {
        error(i18n('customRulesEditor_urlPatternOrDomainPatternsRequired'));
    }
    if (hasUrlPattern) {
        try {
            new RegExp(provider.urlPattern);
        } catch (regexError) {
            error(i18n('customRulesEditor_invalidUrlPattern', regexError.message));
        }
        if (!normalizeIndexPatternValue(provider.indexPattern)) {
            warning(i18n('customRulesEditor_lintNoIndexPattern', label));
        }
    }

    // Each entry is checked in a copy of the provider holding only that
    // entry, so one broken entry does not hide the others. An "@@" raw rule
    // exception also gets the raw rules it can point at.
    const probeBase = baseProblem ? {} : base;
    const rawRules = Array.isArray(provider.rawRules) ? provider.rawRules : [];
    const rawRuleContext = [];
    const rawRuleContextNames = new Set();
    rawRules.forEach((entry) => {
        if (getRuleEntryText(entry).trim().startsWith('@@')) return;
        const names = getRuleEntryNames(entry);
        if (names.some(name => rawRuleContextNames.has(name))) return;
        if (tryRuleEntrySyntax({ rawRules: [entry] }, label)) return;
        names.forEach(name => rawRuleContextNames.add(name));
        rawRuleContext.push(entry);
    });

    const occupiedNames = new Map();
    OBJECT_STYLE_RULE_FIELDS.forEach((list) => {
        const entries = provider[list];
        if (entries === undefined) return;
        if (!Array.isArray(entries)) {
            error(`${label}: ${list} must be an array`);
            return;
        }
        const seenEntries = new Set();
        entries.forEach((entry, index) => {
            const here = `${list}[${index}]`;
            const text = getRuleEntryText(entry);
            const names = getRuleEntryNames(entry);
            let context = [];
            if (list === 'rawRules' && text.trim().startsWith('@@')) {
                context = rawRuleContext.filter(rule =>
                    rule !== entry && !getRuleEntryNames(rule).some(name => names.includes(name)));
            }
            const probeIndex = context.length;
            const problem = tryRuleEntrySyntax({ ...probeBase, [list]: [...context, entry] }, label);
            if (problem) error(problem.split(`${list}[${probeIndex}]`).join(here));

            names.forEach((name) => {
                const firstSeenAt = occupiedNames.get(name);
                if (firstSeenAt) {
                    error(`${label} reuses rule id "${name}" in ${here}; first used in ${firstSeenAt}`);
                } else {
                    occupiedNames.set(name, here);
                }
            });

            const key = JSON.stringify(entry);
            if (seenEntries.has(key)) {
                warning(i18n('customRulesEditor_lintDuplicateEntry', here, text || key));
            }
            seenEntries.add(key);
            if (RULE_TEMPLATE_PLACEHOLDERS.has(text)) {
                warning(i18n('customRulesEditor_lintPlaceholder', here, text));
            } else if (text.trim() === '(?!)') {
                warning(i18n('customRulesEditor_lintNeverMatches', here));
            }
        });
    });
    return problems;
}

// The editor lints on every keystroke from two places; both share the
// result for the same text. null when the text is not JSON.
let lastEditorLint = { key: null, problems: null };

function lintEditorText(jsonText) {
    const key = `${currentProvider || ''}\u0000${jsonText}`;
    if (lastEditorLint.key !== key) {
        let problems = null;
        try {
            problems = lintProvider(JSON.parse(jsonText), currentProvider || '');
        } catch (_) {
            problems = null;
        }
        lastEditorLint = { key, problems };
    }
    return lastEditorLint.problems;
}

function renderProviderLint(jsonText) {
    const container = document.getElementById('json-lint');
    if (!container) return;
    const problems = lintEditorText(jsonText);
    if (!problems) {
        // The JSON error itself is shown in #json-validation.
        container.hidden = true;
        setHTMLContent(container, '');
        return;
    }
    const errorCount = problems.filter(problem => problem.severity === 'error').length;
    const warningCount = problems.length - errorCount;
    const summary = problems.length === 0
        ? i18n('customRulesEditor_lintClean')
        : i18n('customRulesEditor_lintSummary', getLocalizedNumber(errorCount), getLocalizedNumber(warningCount));
    const items = problems.map(problem => `
        <li class="json-lint-item json-lint-${problem.severity}">
            <span class="json-lint-badge">${i18n(problem.severity === 'error' ? 'customRulesEditor_lintError' : 'customRulesEditor_lintWarning')}</span>
            <span class="json-lint-message">${escapeHtml(problem.message)}</span>
        </li>
    `).join('');
    container.hidden = false;
    container.dataset.state = errorCount > 0 ? 'error' : (warningCount > 0 ? 'warning' : 'clean');
    setHTMLContent(container, `
        <div class="json-lint-header">
            <span class="json-lint-title">${i18n('customRulesEditor_lintTitle')}</span>
            <span class="json-lint-summary">${escapeHtml(summary)}</span>
        </div>
        ${items ? `<ul class="json-lint-list">${items}</ul>` : ''}
    `);
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

        case 'cache_remote_rules_after_remote_failure':
            statusText = i18n('hashStatus_cache_remote_rules_after_remote_failure');
            break;
        case 'cache_remote_rules_after_bundled_failure':
            statusText = i18n('hashStatus_cache_remote_rules_after_bundled_failure');
            break;
        case 'cache_remote_built_in_merged':
            statusText = i18n('hashStatus_cache_remote_built_in_merged');
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
    await loadClearURLsRuleIdPins();
}

async function loadClearURLsRuleIdPins() {
    try {
        const response = await browser.runtime.sendMessage({
            function: 'getData',
            params: [LinkumoriRulePins.PIN_STORAGE_KEY]
        });
        clearURLsRuleIdPins = LinkumoriRulePins.normalizePins(response?.response);
    } catch (_) {
        clearURLsRuleIdPins = [];
    }
}

async function saveClearURLsRuleIdPins() {
    await browser.runtime.sendMessage({
        function: 'setData',
        params: [LinkumoriRulePins.PIN_STORAGE_KEY, clearURLsRuleIdPins]
    });
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

// A rule is off when it is switched off for this match pattern
// ("<scope>::<ruleId>") or for its whole provider ("<provider>::<ruleId>").
function getProviderRuleDisableKeys(scopeId, ruleId, providerName = '') {
    return [
        scopeId ? buildProviderPatternRuntimeRuleId(scopeId, ruleId) : '',
        providerName ? buildProviderRuntimeRuleId(providerName, ruleId) : ''
    ].filter(Boolean);
}

function collectProviderRuleIdEntries(providerName, provider) {
    if (!providerName || !provider || typeof provider !== 'object') {
        return [];
    }

    const entries = [];
    const activationScopeIds = getProviderRuleActivationScopeIds(providerName, provider);
    // Every rule has an id: its own "id", or one generated from its list and
    // text, the same way the engine generates it.
    const assignedIds = LinkumoriRuleIds.assignProviderRuleIds(provider);
    // Rules matched to a pin keep the pinned id, as in the engine.
    const pinnedIds = LinkumoriRulePins.resolveProviderPins(provider,
        clearURLsRuleIdPins.filter(pin => pin.provider === providerName)).overrides;
    const disabledIds = new Set(clearURLsDisabledRuleIds);
    const sections = ['rules', 'rawRules', 'referralMarketing', 'redirections', 'fieldRedirections', 'exceptions'];
    sections.forEach(section => {
        const rules = provider[section];
        if (!Array.isArray(rules)) {
            return;
        }
        const listed = new Set();
        rules.forEach((rule, index) => {
            const generatedAssigned = assignedIds[section][index];
            const pinnedId = generatedAssigned && generatedAssigned.generated
                ? pinnedIds.get(`${section}\u0000${LinkumoriRuleIds.getRuleText(rule)}`)
                : null;
            const assigned = pinnedId ? { id: pinnedId, generated: true } : generatedAssigned;
            // Identical entries share one id; list it once. Domain-pattern
            // exceptions and redirections ("||…") cannot be switched off by id.
            if (!assigned || listed.has(assigned.id) ||
                ((section === 'exceptions' || section === 'redirections') && LinkumoriRuleIds.getRuleText(rule).trim().startsWith('|'))) {
                return;
            }
            listed.add(assigned.id);

            activationScopeIds.forEach(scopeId => {
                const runtimeId = buildProviderPatternRuntimeRuleId(scopeId, assigned.id);
                const disableKeys = getProviderRuleDisableKeys(scopeId, assigned.id, providerName);
                const disabled = disableKeys.some(key => disabledIds.has(key));

                entries.push({
                    section,
                    index,
                    id: assigned.id,
                    generated: assigned.generated,
                    runtimeId,
                    scopeId,
                    providerName,
                    disableKeys,
                    kind: section === 'rawRules' ? 'raw' : (section === 'redirections' ? 'redirection' : (section === 'exceptions' ? 'exception' : 'field')),
                    match: LinkumoriRuleIds.getRuleText(rule),
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
        const matchText = entry.match ? ` · ${entry.match}` : '';
        const scopeText = entry.scopeId ? ` · ${entry.scopeId}` : '';
        const providerText = entry.providerName ? `${entry.providerName} · ` : '';
        return `
            <li class="provider-disabled-item provider-rule-id-item" data-rule-id="${escapeHtml(entry.runtimeId)}" data-runtime-id="${escapeHtml(entry.runtimeId)}" data-provider-name="${escapeHtml(entry.providerName)}" data-scope-id="${escapeHtml(entry.scopeId)}" data-canonical-id="${escapeHtml(entry.id)}">
                <input type="hidden" class="provider-rule-id-disable-keys" value="${escapeHtml(JSON.stringify(entry.disableKeys))}">
                <input type="hidden" class="provider-rule-id-pin-target" value="${escapeHtml(JSON.stringify({
                    providerName: entry.providerName,
                    section: entry.section,
                    ruleId: entry.id,
                    match: entry.match,
                    generated: entry.generated
                }))}">
                <span class="provider-disabled-signature" title="${escapeHtml(entry.runtimeId)}">
                    <strong>${escapeHtml(entry.id)}</strong>
                    <span class="provider-disabled-source">${escapeHtml(providerText)}${escapeHtml(entry.section)} · ${escapeHtml(entry.kind)}${escapeHtml(scopeText)}${escapeHtml(matchText)}</span>
                </span>
                <span class="provider-rule-id-actions">
                    <button type="button" class="btn btn-sm btn-secondary provider-rule-id-copy-btn" data-section="${escapeHtml(entry.section)}" data-index="${entry.index}">
                        ${i18n('customRulesEditor_copyRule')}
                    </button>
                    <button type="button" class="btn btn-sm btn-secondary provider-rule-id-rename-btn" data-section="${escapeHtml(entry.section)}" data-index="${entry.index}" data-rule-id="${escapeHtml(entry.id)}">
                        ${i18n('customRulesEditor_renameRuleId')}
                    </button>
                    <button type="button" class="btn btn-sm ${entry.disabled ? 'btn-secondary provider-rule-id-restore-btn' : 'btn-warning provider-rule-id-disable-btn'}">
                        ${entry.disabled ? i18n('providerImport_disabledRestore') : i18n('providerImport_disable')}
                    </button>
                </span>
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
    renderProviderLint(jsonEditor.value);
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

// The custom provider (its name in customRules) that a runtime provider
// comes from, when it has a rule with this text in `section`. Storage renames
// a custom provider "<name>_1", … when a built-in one has its name.
function findCustomProviderForRule(providerName, section, match) {
    const providers = isPlainObject(customRules?.providers) ? customRules.providers : {};
    return [...new Set([providerName, String(providerName || '').replace(/_\d+$/, '')])].find(name =>
        isPlainObject(providers[name]) && Array.isArray(providers[name][section]) &&
        providers[name][section].some(rule => LinkumoriRuleIds.getRuleText(rule) === match)) || null;
}

// Writes the generated id of the rule with this text onto the rule itself
// (a bare string becomes { "id", "matchPattern" }). Rules that share its
// readable id get theirs written too: once one of them has an "id", the
// others would otherwise be given different ids. Returns true if the
// provider changed.
function writeGeneratedRuleIdsIntoProvider(provider, section, match, ruleId) {
    if (!isPlainObject(provider)) return false;
    const assignedIds = LinkumoriRuleIds.assignProviderRuleIds(provider);
    const base = LinkumoriRuleIds.baseRuleId(section, match);
    let changed = false;
    LinkumoriRuleIds.RULE_ID_SECTIONS.forEach(list => {
        if (!Array.isArray(provider[list])) return;
        provider[list] = provider[list].map((rule, index) => {
            const assigned = assignedIds[list][index];
            if (!assigned || !assigned.generated) return rule;
            const text = LinkumoriRuleIds.getRuleText(rule);
            const isTarget = list === section && text === match;
            if (!isTarget && LinkumoriRuleIds.baseRuleId(list, text) !== base) return rule;
            const id = isTarget && ruleId ? ruleId : assigned.id;
            changed = true;
            return typeof rule === 'string' ? { id, matchPattern: rule } : { id, ...rule };
        });
    });
    return changed;
}

// Same as writeGeneratedRuleIdsIntoProvider, for the provider open in the
// JSON editor. Keeps the editor's saved/unsaved state.
function writeGeneratedRuleIdsIntoEditor(providerName, section, match, ruleId) {
    const jsonEditor = document.getElementById('json-editor');
    if (!jsonEditor || !providerName || providerName !== currentProvider) return false;
    let provider;
    try {
        provider = JSON.parse(jsonEditor.value);
    } catch (_) {
        return false;
    }
    if (!writeGeneratedRuleIdsIntoProvider(provider, section, match, ruleId)) return false;
    jsonEditor.value = JSON.stringify(provider, null, 2);
    updateJsonTextMateHighlighting(jsonEditor);
    return true;
}

async function getClearURLsRuleSourceListId() {
    try {
        const response = await browser.runtime.sendMessage({ function: 'getData', params: ['mergeStats'] });
        const source = response?.response?.source;
        return typeof source === 'string' && source ? source : 'built-in';
    } catch (_) {
        return 'built-in';
    }
}

// Gives a rule without an "id" a stable one before it is first switched off,
// so the setting keeps applying when the rule's text changes:
// - a rule the user wrote (in custom rules) gets its id written onto it;
// - any other rule (built-in or remote list) gets a pin in the local pin
//   store, matched to the rule's current text on every load.
// `target` is { providerName, section, ruleId, match, generated }.
async function pinRuleIdBeforeDisable(target, disableKey) {
    if (!target || !target.generated || !target.ruleId || !target.match || !target.providerName) {
        return;
    }
    const existing = LinkumoriRulePins.findPin(clearURLsRuleIdPins, target.providerName, target.ruleId);
    if (existing) {
        if (!existing.disableKeys.includes(disableKey)) {
            existing.disableKeys.push(disableKey);
            await saveClearURLsRuleIdPins();
        }
        return;
    }

    const customProviderName = findCustomProviderForRule(target.providerName, target.section, target.match);
    if (customProviderName) {
        writeGeneratedRuleIdsIntoProvider(customRules.providers[customProviderName], target.section, target.match, target.ruleId);
        writeGeneratedRuleIdsIntoEditor(customProviderName, target.section, target.match, target.ruleId);
        await browser.runtime.sendMessage({
            function: 'setData',
            params: ['custom_rules', JSON.stringify(customRules)]
        });
        return;
    }
    // A rule only in the editor so far: the id is saved with the provider.
    if (writeGeneratedRuleIdsIntoEditor(target.providerName, target.section, target.match, target.ruleId)) {
        hasUnsavedChanges = true;
        updateEditorStatus('valid', i18n('status_validJsonUnsaved'));
        return;
    }

    clearURLsRuleIdPins = LinkumoriRulePins.upsertPin(clearURLsRuleIdPins, LinkumoriRulePins.createPin({
        provider: target.providerName,
        section: target.section,
        generatedId: target.ruleId,
        text: target.match,
        sourceListId: await getClearURLsRuleSourceListId(),
        disableKeys: [disableKey]
    }));
    await saveClearURLsRuleIdPins();
}

// Keeps each pin's disable keys to the ones still switched off. The pin
// itself stays, so the rule keeps its id if it is switched off again.
async function syncClearURLsRuleIdPinsWithDisabledIds() {
    const disabled = new Set(clearURLsDisabledRuleIds);
    let changed = false;
    clearURLsRuleIdPins.forEach(pin => {
        const kept = pin.disableKeys.filter(key => disabled.has(key));
        if (kept.length !== pin.disableKeys.length) {
            pin.disableKeys = kept;
            changed = true;
        }
    });
    if (changed) {
        await saveClearURLsRuleIdPins();
    }
}

async function setClearURLsProviderRuleDisabled(ruleId, shouldDisable, equivalentIds = [], pinTarget = null) {
    const normalizedId = String(ruleId || '').trim();
    if (!normalizedId) {
        return;
    }

    const disabledSet = new Set(clearURLsDisabledRuleIds);
    if (shouldDisable) {
        await pinRuleIdBeforeDisable(pinTarget, normalizedId);
        disabledSet.add(normalizedId);
    } else {
        disabledSet.delete(normalizedId);
        equivalentIds.forEach(ruleId => disabledSet.delete(ruleId));
    }
    clearURLsDisabledRuleIds = Array.from(disabledSet);
    await saveClearURLsDisabledRuleIds();
    if (!shouldDisable) {
        await syncClearURLsRuleIdPinsWithDisabledIds();
    }
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

    const trimmed = domain.trim().toLowerCase();
    const canonicalIp = canonicalizeIpEntry(trimmed);
    if (canonicalIp !== null) {
        return canonicalIp;
    }

    return domainToPunycode(trimmed);
}

function isSpecialDomain(domain) {
    const specialDomains = ['localhost', 'broadcasthost'];
    return specialDomains.includes(domain.toLowerCase());
}

// Strips a wrapping "[...]" (the form IPv6 literals take in a URL's hostname).
function stripIpv6Brackets(value) {
    if (typeof value !== 'string') return value;
    return (value.startsWith('[') && value.endsWith(']')) ? value.slice(1, -1) : value;
}

// True for a bare IPv4 address or an IPv6 address (with or without [brackets]).
function isValidIpLiteral(value) {
    if (!value || typeof value !== 'string') return false;
    const candidate = stripIpv6Brackets(value);
    if (!candidate) return false;
    return typeof IP !== 'undefined' && IP.isValid(candidate);
}

// Canonicalizes a validated IP whitelist entry for storage: IPv4 is kept as
// typed, IPv6 is compressed to its canonical form and wrapped in brackets so
// it matches the hostname a browser reports for an IPv6 literal URL.
// Returns null when the value isn't an IP literal (caller should fall back
// to domain-name handling).
function canonicalizeIpEntry(value) {
    if (!value || typeof value !== 'string') return null;
    const candidate = stripIpv6Brackets(value);
    if (!candidate || typeof IP === 'undefined' || !IP.isValid(candidate)) {
        return null;
    }
    try {
        const addr = IP.address(candidate);
        return addr.type === 'ipv6' ? '[' + addr.toString() + ']' : candidate;
    } catch (_) {
        return candidate;
    }
}

function isValidDomain(domain) {
    if (!domain || typeof domain !== 'string') {
        return false;
    }

    let testDomain = domain.trim().toLowerCase();
    if (!testDomain) {
        return false;
    }

    const hasWildcard = testDomain.startsWith('*.');
    const withoutWildcard = hasWildcard ? testDomain.substring(2) : testDomain;

    // IP addresses are whitelisted by exact address only — wildcards aren't supported.
    if (isValidIpLiteral(withoutWildcard)) {
        return !hasWildcard;
    }

    if (hasWildcard) {
        testDomain = withoutWildcard;
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

function getWhitelistText(key, fallback, ...substitutions) {
    try {
        const text = i18n(key, ...substitutions);
        return text && text !== key ? text : fallback;
    } catch (_) {
        return fallback;
    }
}

function getWhitelistExceptionType() {
    const select = document.getElementById('customrules-whitelist-mode');
    return select && CUSTOM_RULES_WHITELIST_TYPES[select.value] ? select.value : 'general';
}

function getWhitelistExceptionTypeLabel(type) {
    return type === 'history'
        ? getWhitelistText('whitelist_type_history_api', 'History API only')
        : getWhitelistText('whitelist_type_general', 'General');
}

function getWhitelistEntries() {
    const generalEntries = Array.isArray(userWhitelist)
        ? userWhitelist.map(domain => ({ domain, type: 'general' }))
        : [];
    const historyEntries = Array.isArray(historyApiWhitelist)
        ? historyApiWhitelist.map(domain => ({ domain, type: 'history' }))
        : [];

    return [...generalEntries, ...historyEntries]
        .filter(entry => typeof entry.domain === 'string')
        .sort((left, right) => {
            const domainOrder = left.domain.localeCompare(right.domain);
            return domainOrder || left.type.localeCompare(right.type);
        });
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

    const localizedCount = getLocalizedNumber(getWhitelistEntries().length);
    countEl.textContent = getWhitelistText(
        'whitelist_exception_count',
        `${localizedCount} exception(s)`
    ).replace('%d', localizedCount);
}

function renderWhitelistList() {
    const list = document.getElementById('customrules-whitelist-list');
    if (!list) return;

    const entries = getWhitelistEntries();
    const term = whitelistSearchTerm.trim().toLowerCase();
    const filtered = entries.filter((entry) => {
        if (!term) {
            return true;
        }
        return entry.domain.toLowerCase().includes(term) ||
            getWhitelistExceptionTypeLabel(entry.type).toLowerCase().includes(term);
    });

    if (entries.length === 0) {
        const countEl = document.getElementById('customrules-whitelist-count');
        setHTMLContent(list, `<li class="whitelist-empty">${getWhitelistText('whitelist_exception_empty', 'No whitelist exceptions')}</li>`);
        if (countEl) {
            countEl.textContent = '';
        }
        return;
    }

    if (filtered.length === 0) {
        setHTMLContent(list, `<li class="whitelist-empty">${getWhitelistText('whitelist_exception_empty', 'No whitelist exceptions')}</li>`);
        renderWhitelistCount();
        addWhitelistRemoveHandlers();
        return;
    }

    const removeLabel = getWhitelistText('whitelist_remove_button', 'Remove');
    const items = filtered.map(({ domain, type }) => `
        <li class="whitelist-item">
            <div class="whitelist-entry">
                <span class="whitelist-domain" title="${escapeHtml(domain)}">${escapeHtml(domain)}</span>
                <span class="whitelist-type whitelist-type-${escapeHtml(type)}">${escapeHtml(getWhitelistExceptionTypeLabel(type))}</span>
            </div>
            <button type="button" class="btn btn-danger btn-sm whitelist-remove" data-domain="${escapeHtml(domain)}" data-whitelist-type="${escapeHtml(type)}" title="${escapeHtml(removeLabel)}">${escapeHtml(removeLabel)}</button>
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
    const type = target.getAttribute('data-whitelist-type');
    if (domain && CUSTOM_RULES_WHITELIST_TYPES[type]) {
        removeWhitelistDomain(domain, type);
    }
}

async function loadWhitelist() {
    try {
        const [generalResponse, historyResponse] = await Promise.all([
            browser.runtime.sendMessage({
                function: "getData",
                params: ["userWhitelist"]
            }),
            browser.runtime.sendMessage({
                function: "getData",
                params: ["historyApiWhitelist"]
            })
        ]);
        userWhitelist = Array.isArray(generalResponse?.response) ? generalResponse.response : [];
        historyApiWhitelist = Array.isArray(historyResponse?.response) ? historyResponse.response : [];

        renderWhitelistList();
        setTimeout(() => {
            addWhitelistRemoveHandlers();
        }, 100);
    } catch (_) {
        userWhitelist = [];
        historyApiWhitelist = [];
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
    const type = getWhitelistExceptionType();
    const whitelistType = CUSTOM_RULES_WHITELIST_TYPES[type];
    try {
        const response = await browser.runtime.sendMessage({
            function: whitelistType.addFunction,
            params: [punnycodeDomain]
        });

        if (response && response.response) {
            input.value = '';
            await loadWhitelist();
            const key = type === 'history' ? 'whitelist_added_history_api' : 'whitelist_added_general';
            const fallback = type === 'history'
                ? `Added ${domainToUnicode(punnycodeDomain)} as a History API exception`
                : `Added ${domainToUnicode(punnycodeDomain)} to general whitelist`;
            setWhitelistStatus('success', getWhitelistText(key, fallback).replace('%s', domainToUnicode(punnycodeDomain)));
        } else {
            setWhitelistStatus('error', i18n('whitelist_already_exists'));
        }
    } catch (_) {
        setWhitelistStatus('error', i18n('whitelist_add_failed'));
    }
}

async function removeWhitelistDomain(domain, type = 'general') {
    if (!domain) {
        return;
    }

    const whitelistType = CUSTOM_RULES_WHITELIST_TYPES[type];
    if (!whitelistType) {
        return;
    }

    try {
        const response = await browser.runtime.sendMessage({
            function: whitelistType.removeFunction,
            params: [domain]
        });

        if (response && response.response) {
            await loadWhitelist();
            const key = type === 'history' ? 'whitelist_removed_history_api' : 'whitelist_removed_general';
            const fallback = type === 'history'
                ? `Removed History API exception for ${domainToUnicode(domain)}`
                : `Removed ${domainToUnicode(domain)} from general whitelist`;
            setWhitelistStatus('success', getWhitelistText(key, fallback).replace('%s', domainToUnicode(domain)));
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
        if (getWhitelistEntries().length === 0) {
            setWhitelistStatus('error', i18n('whitelist_export_empty'));
            return;
        }

        const payload = JSON.stringify({
            formatVersion: 2,
            userWhitelist: Array.isArray(userWhitelist) ? userWhitelist : [],
            historyApiWhitelist: Array.isArray(historyApiWhitelist) ? historyApiWhitelist : []
        }, null, 2);
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

    let importedDomainsByType = null;
    if (parsed && typeof parsed === 'object' && !Array.isArray(parsed)) {
        const generalEntries = Array.isArray(parsed.userWhitelist) ? parsed.userWhitelist : [];
        const historyEntries = Array.isArray(parsed.historyApiWhitelist) ? parsed.historyApiWhitelist : [];
        if (Array.isArray(parsed.userWhitelist) || Array.isArray(parsed.historyApiWhitelist)) {
            importedDomainsByType = { general: generalEntries, history: historyEntries };
        }
    }

    if (!importedDomainsByType) {
        setWhitelistStatus('error', i18n('whitelist_import_invalid_format'));
        return;
    }

    const normalizedByType = Object.fromEntries(Object.entries(importedDomainsByType).map(([type, domains]) => [
        type,
        Array.from(new Set(
            domains
                .filter(item => typeof item === 'string')
                .map(item => item.trim())
                .filter(item => item.length > 0 && isValidDomain(item))
                .map(item => normalizeDomain(item))
        ))
    ]));

    if (normalizedByType.general.length === 0 && normalizedByType.history.length === 0) {
        setWhitelistStatus('error', i18n('whitelist_import_no_valid_domain'));
        return;
    }

    let addedCount = 0;
    for (const [type, domains] of Object.entries(normalizedByType)) {
        const whitelistType = CUSTOM_RULES_WHITELIST_TYPES[type];
        for (const domain of domains) {
            try {
                const response = await browser.runtime.sendMessage({
                    function: whitelistType.addFunction,
                    params: [domain]
                });
                if (response && response.response) {
                    addedCount++;
                }
            } catch (_) {
            }
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
    const mode = document.getElementById('customrules-whitelist-mode');
    const search = document.getElementById('customrules-whitelist-search');
    const list = document.getElementById('customrules-whitelist-list');
    const examples = document.getElementById('whitelist_examples_text');

    if (!addBtn || !input || !mode || !search || !list || !importBtn || !exportBtn || !importInput) {
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
                <button type="button" class="btn btn-primary" id="provider-list-create-first-btn">
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
    
    const stats = [];
    if (rulesCount > 0) stats.push(`${getLocalizedNumber(rulesCount)} ${i18n('providerList_rules')}`);
    if (exceptionsCount > 0) stats.push(`${getLocalizedNumber(exceptionsCount)} ${i18n('providerList_exceptions')}`);
    if (domainPatternsCount > 0) stats.push(`${getLocalizedNumber(domainPatternsCount)} ${i18n('customRulesEditor_domainPatterns')}`);
    if (provider.indexPattern) stats.push(`Index: ${provider.indexPattern}`);
    if (provider.completeProvider) stats.push(i18n('providerList_complete'));
    if (provider.historyBypassProtection === false) stats.push(i18n('providerList_historyBypassProtection'));
    
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
                <button type="button" class="btn btn-sm btn-primary provider-list-edit-btn" data-provider="${escapeHtml(providerName)}" title="${i18n('providerList_editTooltip')}">
                    <svg width="12" height="12" viewBox="0 -960 960 960" fill="currentColor" aria-hidden="true" focusable="false">
                        <path d="M200-200h57l391-391-57-57-391 391v57Zm-80 80v-170l528-527q12-11 26.5-17t30.5-6q16 0 31 6t26 18l55 56q12 11 17.5 26t5.5 30q0 16-5.5 30.5T817-647L290-120H120Zm640-584-56-56 56 56Zm-141 85-28-29 57 57-29-28Z"/>
                    </svg>
                    ${i18n('providerList_edit')}
                </button>
                <button type="button" class="btn btn-sm btn-warning provider-list-duplicate-btn" data-provider="${escapeHtml(providerName)}" title="${i18n('providerList_duplicateTooltip')}">
                    <svg width="12" height="12" viewBox="0 -960 960 960" fill="currentColor" aria-hidden="true" focusable="false">
                        <path d="M120-220v-80h80v80h-80Zm0-140v-80h80v80h-80Zm0-140v-80h80v80h-80ZM260-80v-80h80v80h-80Zm100-160q-33 0-56.5-23.5T280-320v-480q0-33 23.5-56.5T360-880h360q33 0 56.5 23.5T800-800v480q0 33-23.5 56.5T720-240H360Zm0-80h360v-480H360v480Zm40 240v-80h80v80h-80Zm-200 0q-33 0-56.5-23.5T120-160h80v80Zm340 0v-80h80q0 33-23.5 56.5T540-80ZM120-640q0-33 23.5-56.5T200-720v80h-80Zm420 80Z"/>
                    </svg>
                    ${i18n('providerList_duplicate')}
                </button>
                <button type="button" class="btn btn-sm btn-danger provider-list-delete-btn" data-provider="${escapeHtml(providerName)}" title="${i18n('providerList_deleteTooltip')}">
                    <svg width="12" height="12" viewBox="0 -960 960 960" fill="currentColor" aria-hidden="true" focusable="false">
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
    await syncClearURLsRuleIdPinsWithDisabledIds();
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
            const disableKeys = getProviderRuleDisableKeys(parsed.scopeId, parsed.ruleId, rule.providerName || '');
            if (!runtimeRuleId || disableKeys.some(key => disabled.has(key))) {
                return;
            }
            rows.push({
                runtimeRuleId,
                scopeId: parsed.scopeId,
                providerName: rule.providerName || '',
                ruleId: parsed.ruleId,
                generated: !!rule.generated,
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
        if (!runtimeRuleId || disabled.has(runtimeRuleId)) {
            return;
        }
        rows.push({
            runtimeRuleId,
            providerName,
            ruleId,
            generated: !!rule.generated,
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

// Pins that match no rule any more (see core_js/linkumori_rule_pins.js)
// but still have rules switched off under them, with the keys that do.
// A key that also switches off a live rule (another provider can share the
// same match-pattern scope and id) stays with that rule.
function getOrphanedToggleRows() {
    const orphaned = Array.isArray(clearURLsProviderSnapshot?.rulePins?.orphaned)
        ? clearURLsProviderSnapshot.rulePins.orphaned
        : [];
    if (orphaned.length === 0) return [];
    const disabled = new Set(clearURLsDisabledRuleIds);
    const liveKeys = new Set();
    Object.values(clearURLsProviderSnapshot?.disabledRules || {}).forEach(rule => {
        if (rule?.runtimeRuleId) liveKeys.add(rule.runtimeRuleId);
        (rule?.disabledActivationIds || []).forEach(id => liveKeys.add(id));
    });
    return orphaned.map(pin => ({
        ...pin,
        keys: (Array.isArray(pin.disableKeys) ? pin.disableKeys : []).filter(key => disabled.has(key) && !liveKeys.has(key))
    })).filter(pin => pin.keys.length > 0)
        .sort((a, b) => `${a.provider}::${a.generatedId}`.localeCompare(`${b.provider}::${b.generatedId}`));
}

function renderOrphanedTogglesSection(rows) {
    if (rows.length === 0) {
        return '';
    }
    const items = rows.map(row => `
        <li class="provider-disabled-item orphaned-toggle-item" data-provider="${escapeHtml(row.provider)}" data-generated-id="${escapeHtml(row.generatedId)}">
            <span class="provider-disabled-signature" title="${escapeHtml(row.keys.join('\n'))}">
                <strong>${escapeHtml(row.generatedId)}</strong>
                <span class="provider-disabled-source">
                    ${escapeHtml(row.provider)} · ${escapeHtml(row.section)} · ${escapeHtml(row.pinnedText)}
                </span>
                <span class="provider-disabled-source">${escapeHtml(i18n('providerImport_orphanedToggleReason'))}</span>
            </span>
            <button type="button" class="btn btn-sm btn-danger orphaned-toggle-remove-btn">${i18n('providerImport_orphanedToggleRemove')}</button>
        </li>
    `).join('');
    return `
        <div class="provider-disabled-section orphaned-toggles-section">
            <div class="provider-disabled-title-row">
                <h5 class="provider-disabled-title">${escapeHtml(i18n('providerImport_orphanedToggles'))}</h5>
                <span class="provider-disabled-count-badge">${getLocalizedNumber(rows.length)}</span>
            </div>
            <ul class="provider-disabled-list">${items}</ul>
        </div>
    `;
}

// Drops an orphaned pin and the disabled-rule ids saved under it.
async function removeOrphanedToggle(provider, generatedId) {
    const row = getOrphanedToggleRows().find(item => item.provider === provider && item.generatedId === generatedId);
    const keys = new Set(row ? row.keys : []);
    clearURLsDisabledRuleIds = clearURLsDisabledRuleIds.filter(ruleId => !keys.has(ruleId));
    clearURLsRuleIdPins = clearURLsRuleIdPins.filter(pin => !(pin.provider === provider && pin.generatedId === generatedId));
    await saveClearURLsRuleIdPins();
    await saveClearURLsDisabledRuleIds();
    await reloadRulesAfterExclusionChange();
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
        <li class="provider-disabled-item rule-activation-item" data-runtime-id="${escapeHtml(row.runtimeRuleId)}" data-pin-target="${escapeHtml(JSON.stringify({
            providerName: row.providerName,
            section: row.section,
            ruleId: row.ruleId,
            match: row.match,
            generated: row.generated
        }))}">
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

    // Toggles whose rule is gone upstream are listed on their own, at the
    // bottom, instead of among the ids that still switch a rule off.
    const orphanedRows = getOrphanedToggleRows();
    const orphanedKeys = new Set(orphanedRows.flatMap(row => row.keys));
    const activeDisabledRuleIds = clearURLsDisabledRuleIds.filter(ruleId => !orphanedKeys.has(ruleId));
    const orphanedSection = renderOrphanedTogglesSection(orphanedRows);
    const sources = Object.keys(importExclusionsBySource).sort((a, b) => a.localeCompare(b));
    if (activeDisabledRuleIds.length > 0 && !sources.includes('clearurls-rule-ids')) {
        sources.push('clearurls-rule-ids');
    }
    const activationSection = renderRuleActivationSection();
    if (sources.length === 0 && !activationSection && !orphanedSection) {
        setHTMLContent(container, `
            <div class="provider-list-empty">
                <p>${i18n('providerImport_disabledEmpty')}</p>
            </div>
        `);
        return;
    }

    const totalDisabled = sources.reduce((sum, source) => {
        if (source === 'clearurls-rule-ids') {
            return sum + activeDisabledRuleIds.length;
        }
        const list = importExclusionsBySource[source];
        return sum + (Array.isArray(list) ? list.length : 0);
    }, 0);

    const entries = [];
    sources.forEach(source => {
        const signatures = (source === 'clearurls-rule-ids'
                ? activeDisabledRuleIds
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
            ${orphanedSection}
        </div>
    `);

    container.querySelectorAll('.orphaned-toggle-remove-btn').forEach(btn => {
        btn.addEventListener('click', async (e) => {
            const item = e.target.closest('.orphaned-toggle-item');
            if (!item) return;
            await removeOrphanedToggle(item.dataset.provider || '', item.dataset.generatedId || '');
            updateSourceCounts();
            renderProviderRuleIdControlsFromEditor();
            await loadClearURLsProviderSnapshot();
            renderDisabledRulesPageContent();
        });
    });

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
            let pinTarget = null;
            try {
                pinTarget = JSON.parse(item.dataset.pinTarget || 'null');
            } catch (_) {
                pinTarget = null;
            }
            await setClearURLsProviderRuleDisabled(runtimeId, true, [], pinTarget);
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
                await syncClearURLsRuleIdPinsWithDisabledIds();
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
                ${provider.completeProvider ? `<span class="provider-card-stat" title="${i18n('providerImport_completeProvider')}">${i18n('providerImport_complete')}</span>` : ''}
                ${provider.historyBypassProtection === false ? `<span class="provider-card-stat" title="${i18n('providerList_historyBypassProtection')}">${i18n('providerImport_historyBypassProtectionAbbr')}</span>` : ''}
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
            existingIcon.innerHTML = '<svg xmlns="http://www.w3.org/2000/svg" height="24px" viewBox="0 -960 960 960" width="24px" fill="currentColor" aria-hidden="true" focusable="false"><path d="M480-360 280-560h400L480-360Z"/></svg>';
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
            <svg width="14" height="14" viewBox="0 -960 960 960" fill="currentColor" aria-hidden="true" focusable="false">
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
            <svg width="14" height="14" viewBox="0 -960 960 960" fill="currentColor" aria-hidden="true" focusable="false">
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
        
        if (customCountElement) customCountElement.textContent = '?';
        if (builtinCountElement) builtinCountElement.textContent = '?';
        if (totalCountElement) totalCountElement.textContent = '?';
        if (disabledCountElement) disabledCountElement.textContent = '?';
        if (mergeStatusElement) mergeStatusElement.textContent = i18n('status_unavailable');
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
                <button type="button" class="provider-action-btn edit-provider-btn" data-provider="${escapeHtml(providerName)}" title="${i18n('customRulesEditor_editName')}" aria-label="${escapeHtml(i18n('customRulesEditor_editName'))}">
                    <svg width="12" height="12" viewBox="0 -960 960 960" fill="currentColor" aria-hidden="true" focusable="false">
                        <path d="M200-200h57l391-391-57-57-391 391v57Zm-80 80v-170l528-527q12-11 26.5-17t30.5-6q16 0 31 6t26 18l55 56q12 11 17.5 26t5.5 30q0 16-5.5 30.5T817-647L290-120H120Zm640-584-56-56 56 56Zm-141 85-28-29 57 57-29-28Z"/>
                    </svg>
                </button>
                <button type="button" class="provider-action-btn duplicate-provider-btn" data-provider="${escapeHtml(providerName)}" title="${i18n('customRulesEditor_duplicate')}" aria-label="${escapeHtml(i18n('customRulesEditor_duplicate'))}">
                    <svg width="12" height="12" viewBox="0 -960 960 960" fill="currentColor" aria-hidden="true" focusable="false">
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
                        ${Object.entries(RULE_TEMPLATES).map(([kind, template]) => `
                            <button type="button" class="btn btn-secondary btn-sm json-rule-template-btn" data-rule-template="${kind}" title="${escapeHtml(template.list)}">+ ${i18n(template.labelKey)}</button>
                        `).join('')}
                    </div>
                    <div class="json-key-toolbar-help">${i18n('customRulesEditor_ruleTemplatesHelp')}</div>
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
                    <div class="json-lint" id="json-lint" aria-live="polite"></div>
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

// A rule object on its own does not say which list it belongs to, so the
// copy is wrapped in that list: { "rawRules": [ { … } ] }. This is worked
// out from where the rule is now, never stored on the rule.
function buildRuleExport(section, rule) {
    const clean = isPlainObject(rule) ? { ...rule } : rule;
    if (isPlainObject(clean)) {
        delete clean._linkumoriActivationIds;
        delete clean._linkumoriLegacyRuleIds;
    }
    return { [section]: [clean] };
}

async function copyProviderRuleFromEditor(section, index) {
    const jsonEditor = document.getElementById('json-editor');
    if (!jsonEditor) return;
    let provider;
    try {
        provider = JSON.parse(jsonEditor.value);
    } catch (_) {
        updateEditorStatus('invalid', i18n('status_invalidJson'));
        return;
    }
    const rule = Array.isArray(provider?.[section]) ? provider[section][index] : undefined;
    if (rule === undefined) return;
    try {
        await navigator.clipboard.writeText(JSON.stringify(buildRuleExport(section, rule), null, 2));
        updateEditorStatus('valid', i18n('customRulesEditor_ruleCopied'));
    } catch (_) {
        updateEditorStatus('error', i18n('customRulesEditor_ruleCopyFailed'));
    }
}

const RULE_ID_PATTERN = /^[a-z0-9][a-z0-9_-]*$/;

// Every id and alias the provider's rules use, except the rule with this
// text in `section`.
function getProviderRuleIdsInUse(provider, section, match) {
    const used = new Set();
    const assignedIds = LinkumoriRuleIds.assignProviderRuleIds(provider);
    LinkumoriRuleIds.RULE_ID_SECTIONS.forEach(list => {
        (Array.isArray(provider[list]) ? provider[list] : []).forEach((rule, index) => {
            if (list === section && LinkumoriRuleIds.getRuleText(rule) === match) return;
            const assigned = assignedIds[list][index];
            if (assigned) used.add(assigned.id);
            if (isPlainObject(rule) && Array.isArray(rule.aliases)) {
                rule.aliases.forEach(alias => { if (typeof alias === 'string') used.add(alias); });
            }
        });
    });
    return used;
}

// Gives the rule with this text in `section` the id `newId`, keeping
// `oldId` as an alias so settings saved under it still apply. Rules that
// shared its generated id get theirs written first, so theirs stay the
// same. Returns true if the rule was found.
function renameRuleIdInProvider(provider, section, match, oldId, newId) {
    if (!isPlainObject(provider) || !Array.isArray(provider[section]) ||
        !provider[section].some(rule => LinkumoriRuleIds.getRuleText(rule) === match)) {
        return false;
    }
    writeGeneratedRuleIdsIntoProvider(provider, section, match, oldId);
    provider[section] = provider[section].map(rule => {
        if (LinkumoriRuleIds.getRuleText(rule) !== match) return rule;
        const next = typeof rule === 'string' ? { matchPattern: rule } : { ...rule };
        const aliases = [...new Set([...(Array.isArray(next.aliases) ? next.aliases : []), oldId])]
            .filter(alias => alias && alias !== newId);
        const renamed = { id: newId, ...next, id: newId };
        if (aliases.length > 0) renamed.aliases = aliases;
        else delete renamed.aliases;
        return renamed;
    });
    return true;
}

// Moves disabled-rule ids and pins saved under a rule's old id to its new id.
function moveRuleIdSettings(providerName, provider, oldId, newId) {
    const keys = new Map();
    getProviderRuleActivationScopeIds(providerName, provider).forEach(scopeId => {
        const oldKeys = getProviderRuleDisableKeys(scopeId, oldId, providerName);
        const newKeys = getProviderRuleDisableKeys(scopeId, newId, providerName);
        oldKeys.forEach((key, index) => keys.set(key, newKeys[index]));
    });
    clearURLsDisabledRuleIds = [...new Set(clearURLsDisabledRuleIds.map(key => keys.get(key) || key))];
    // The rule now has its own "id", so it no longer needs a pin.
    clearURLsRuleIdPins = clearURLsRuleIdPins.filter(pin => !(pin.provider === providerName && pin.generatedId === oldId));
}

async function renameProviderRuleId(section, index, oldId) {
    const jsonEditor = document.getElementById('json-editor');
    if (!jsonEditor || !currentProvider || !oldId) return;
    let provider;
    try {
        provider = JSON.parse(jsonEditor.value);
    } catch (_) {
        updateEditorStatus('invalid', i18n('status_invalidJson'));
        return;
    }
    const rule = Array.isArray(provider?.[section]) ? provider[section][index] : undefined;
    const match = LinkumoriRuleIds.getRuleText(rule);
    if (!match) return;

    const answer = window.LinkumoriModal && typeof window.LinkumoriModal.prompt === 'function'
        ? await window.LinkumoriModal.prompt(i18n('customRulesEditor_renameRuleIdPrompt', oldId), oldId)
        : { confirmed: false, value: '' };
    if (!answer || !answer.confirmed) return;
    const newId = String(answer.value || '').trim();
    if (!newId || newId === oldId) return;
    if (!RULE_ID_PATTERN.test(newId)) {
        await modalAlert(i18n('customRulesEditor_renameRuleIdInvalid', newId));
        return;
    }
    if (getProviderRuleIdsInUse(provider, section, match).has(newId)) {
        await modalAlert(i18n('customRulesEditor_renameRuleIdTaken', newId));
        return;
    }

    renameRuleIdInProvider(provider, section, match, oldId, newId);
    jsonEditor.value = JSON.stringify(provider, null, 2);
    updateJsonTextMateHighlighting(jsonEditor);

    // Saved right away when the rule is already saved, so the switched-off
    // settings moved to the new id keep matching it.
    const savedProvider = customRules?.providers?.[currentProvider];
    if (renameRuleIdInProvider(savedProvider, section, match, oldId, newId)) {
        moveRuleIdSettings(currentProvider, savedProvider, oldId, newId);
        await browser.runtime.sendMessage({
            function: 'setData',
            params: ['custom_rules', JSON.stringify(customRules)]
        });
        await saveClearURLsRuleIdPins();
        await saveClearURLsDisabledRuleIds();
        await reloadRulesAfterExclusionChange();
        updateSourceCounts();
    } else {
        hasUnsavedChanges = true;
    }
    updateEditorStatus('valid', i18n(hasUnsavedChanges ? 'status_validJsonUnsaved' : 'customRulesEditor_ruleIdRenamed', newId));
    renderProviderRuleIdControlsFromEditor();
}

// Asks whether a rule is switched off for its whole provider
// ("<provider>::<ruleId>") or only for this URL/domain pattern
// ("<scope>::<ruleId>"). Resolves with the key to store, or null when
// the dialog is dismissed. Without a pattern there is nothing to ask.
async function chooseProviderRuleDisableKey(providerName, scopeId, ruleId) {
    const providerKey = providerName ? buildProviderRuntimeRuleId(providerName, ruleId) : '';
    const patternKey = scopeId && scopeId !== providerName
        ? buildProviderPatternRuntimeRuleId(scopeId, ruleId)
        : '';
    if (!providerKey || !patternKey) {
        return providerKey || patternKey || null;
    }
    if (!window.LinkumoriModal || typeof window.LinkumoriModal.choose !== 'function') {
        return patternKey;
    }
    return window.LinkumoriModal.choose(
        i18n('customRulesEditor_disableRuleScopePrompt', ruleId),
        [
            {
                value: providerKey,
                label: i18n('customRulesEditor_disableRuleForProvider'),
                detail: providerKey
            },
            {
                value: patternKey,
                label: i18n('customRulesEditor_disableRuleForPattern'),
                detail: patternKey
            }
        ],
        { title: i18n('customRulesEditor_disableRuleScopeTitle') }
    );
}

async function handleProviderRuleIdControlsClick(event) {
    const copyBtn = event.target.closest('.provider-rule-id-copy-btn');
    if (copyBtn) {
        await copyProviderRuleFromEditor(copyBtn.dataset.section, Number(copyBtn.dataset.index));
        return;
    }
    const renameBtn = event.target.closest('.provider-rule-id-rename-btn');
    if (renameBtn) {
        await renameProviderRuleId(renameBtn.dataset.section, Number(renameBtn.dataset.index), renameBtn.dataset.ruleId || '');
        return;
    }
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
    let pinTarget = null;
    try {
        pinTarget = JSON.parse(item.querySelector('.provider-rule-id-pin-target')?.value || 'null');
    } catch (_) {
        pinTarget = null;
    }

    if (disableBtn) {
        const disableKey = await chooseProviderRuleDisableKey(
            item.dataset.providerName || '',
            item.dataset.scopeId || '',
            item.dataset.canonicalId || ''
        );
        if (!disableKey) {
            return;
        }
        await setClearURLsProviderRuleDisabled(disableKey, true, equivalentIds, pinTarget);
        return;
    }

    await setClearURLsProviderRuleDisabled(ruleId, false, equivalentIds, pinTarget);
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

function createProviderSkeleton() {
    return {
        urlPattern: '',
        rules: []
    };
}

function compactProviderForEditor(provider) {
    const next = JSON.parse(JSON.stringify(provider || {}));
    const optionalArrays = ['rules', 'rawRules', 'referralMarketing', 'redirections', 'fieldRedirections', 'domainPatterns', 'exceptions', 'methods', 'resourceTypes'];

    optionalArrays.forEach((key) => {
        if (Array.isArray(next[key]) && next[key].length === 0) delete next[key];
    });
    ['urlPattern', 'indexPattern'].forEach((key) => {
        if (typeof next[key] === 'string' && next[key].trim() === '') delete next[key];
    });
    if (next.completeProvider === false) delete next.completeProvider;
    if (next.forceRedirection === false) delete next.forceRedirection;
    if (next.historyBypassProtection === true) delete next.historyBypassProtection;
    return next;
}

function normalizeProviderForEditor(provider) {
    const next = JSON.parse(JSON.stringify(provider || {}));
    if (!Array.isArray(next.rules)) next.rules = [];
    return next;
}

function getJsonFieldButtons() {
    const fields = ['rules', 'rawRules', 'referralMarketing', 'redirections', 'fieldRedirections', 'exceptions', 'completeProvider', 'forceRedirection', 'historyBypassProtection', 'urlPattern', 'indexPattern', 'domainPatterns', 'methods', 'resourceTypes'];
    const labels = {
        rules: i18n('customRulesEditor_rules'),
        rawRules: i18n('customRulesEditor_rawRules'),
        referralMarketing: i18n('customRulesEditor_referralMarketing'),
        redirections: i18n('customRulesEditor_redirections'),
        fieldRedirections: i18n('customRulesEditor_fieldRedirections'),
        exceptions: i18n('customRulesEditor_exceptions'),
        completeProvider: i18n('customRulesEditor_completeProvider'),
        forceRedirection: i18n('customRulesEditor_forceRedirection'),
        historyBypassProtection: i18n('customRulesEditor_historyBypassProtection'),
        urlPattern: i18n('customRulesEditor_urlPattern'),
        indexPattern: i18n('customRulesEditor_indexPattern'),
        domainPatterns: i18n('customRulesEditor_domainPatterns'),
        methods: i18n('customRulesEditor_httpMethods'),
        resourceTypes: i18n('customRulesEditor_resourceTypes')
    };
    return fields.map(key => ({ key, label: labels[key] }));
}


// "+ rule" buttons: the list each template goes into and the rule object it
// adds, in the rule object syntax of docs/filter-syntax.md §9. Every
// matchPattern is a placeholder on example.com / example_…, which the linter
// flags until it is replaced.
const RULE_TEMPLATES = Object.freeze({
    field: Object.freeze({
        list: 'rules',
        labelKey: 'customRulesEditor_addFieldRule',
        rule: Object.freeze({ id: 'field-rule', matchPattern: '$removeparam=example_param' })
    }),
    referral: Object.freeze({
        list: 'referralMarketing',
        labelKey: 'customRulesEditor_addReferralRule',
        rule: Object.freeze({ id: 'referral-rule', matchPattern: 'example_ref' })
    }),
    raw: Object.freeze({
        list: 'rawRules',
        labelKey: 'customRulesEditor_addRawRule',
        rule: Object.freeze({ id: 'raw-rule', matchPattern: '\\/example_ref=[^/?]*' })
    }),
    rawException: Object.freeze({
        list: 'rawRules',
        labelKey: 'customRulesEditor_addRawExceptionRule',
        // targetId is filled in with a raw rule of the provider.
        rule: Object.freeze({ id: 'raw-exception', matchPattern: '@@||example.com^$rawrule=', targetId: '' })
    }),
    redirection: Object.freeze({
        list: 'redirections',
        labelKey: 'customRulesEditor_addRedirectRule',
        // Exactly one capture group: the destination URL.
        rule: Object.freeze({ id: 'redirect-rule', matchPattern: '^https?:\\/\\/example\\.com\\/out\\?.*?url=(https?[^&]+)' })
    }),
    fieldRedirection: Object.freeze({
        list: 'fieldRedirections',
        labelKey: 'customRulesEditor_addFieldRedirectRule',
        rule: Object.freeze({ id: 'field-redirect-rule', matchPattern: 'example_url' })
    }),
    exception: Object.freeze({
        list: 'exceptions',
        labelKey: 'customRulesEditor_addExceptionRule',
        rule: Object.freeze({ id: 'exception-rule', matchPattern: '||example.com^/login' })
    })
});

const RULE_TEMPLATE_PLACEHOLDERS = new Set(Object.values(RULE_TEMPLATES).map(template => template.rule.matchPattern));

function createUniqueRuleId(provider, baseId) {
    const occupied = new Set(OBJECT_STYLE_RULE_FIELDS
        .flatMap(list => (Array.isArray(provider[list]) ? provider[list] : []))
        .filter(isPlainObject)
        .flatMap(rule => [rule.id, ...(Array.isArray(rule.aliases) ? rule.aliases : [])])
        .filter(id => typeof id === 'string'));
    if (!occupied.has(baseId)) return baseId;
    let counter = 2;
    while (occupied.has(`${baseId}-${counter}`)) counter++;
    return `${baseId}-${counter}`;
}

// The id of the provider's last raw rule that has an "id" and is not itself
// an "@@" exception, or null.
function findRawRuleTargetId(provider) {
    const candidates = (Array.isArray(provider.rawRules) ? provider.rawRules : []).filter(rule =>
        isPlainObject(rule) && typeof rule.id === 'string' &&
        !String(rule.matchPattern || '').trim().startsWith('@@'));
    return candidates.length > 0 ? candidates[candidates.length - 1].id : null;
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
        fieldRedirections: [],
        exceptions: [],
        completeProvider: false,
        forceRedirection: false,
        historyBypassProtection: false,
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
    const definition = RULE_TEMPLATES[kind];
    if (!jsonEditor || !definition) return;
    const list = definition.list;

    try {
        const provider = normalizeProviderForEditor(JSON.parse(jsonEditor.value));
        if (!Array.isArray(provider[list])) provider[list] = [];
        const template = { ...definition.rule };
        if (kind === 'rawException') {
            // An exception names the raw rule it stops; add one to stop if
            // the provider has none with an id.
            let targetId = findRawRuleTargetId(provider);
            if (!targetId) {
                const rawRule = { ...RULE_TEMPLATES.raw.rule };
                rawRule.id = createUniqueRuleId(provider, rawRule.id);
                provider[list].push(rawRule);
                targetId = rawRule.id;
            }
            template.targetId = targetId;
        }
        template.id = createUniqueRuleId(provider, template.id);
        provider[list].push(template);
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
        JSON.parse(jsonEditor.value);
        updateJsonTextMateHighlighting(jsonEditor);
        validation.style.display = 'none';
        hasUnsavedChanges = true;
        // Rule problems are listed by the linter (#json-lint).
        if (lintEditorText(jsonEditor.value).some(problem => problem.severity === 'error')) {
            updateEditorStatus('invalid', i18n('status_invalidJson'));
        } else {
            updateEditorStatus('valid', i18n('status_validJsonUnsaved'));
        }
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
        provider.indexPattern = normalizeIndexPatternValue(provider.indexPattern);
        if (!provider.indexPattern) delete provider.indexPattern;
            
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
                        <button type="button" class="btn btn-danger btn-sm" id="editor-delete-all-btn">${i18n('customRulesEditor_deleteAll')}</button>
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
                    <button type="button" class="btn btn-primary" id="empty-state-add-btn">
                        <svg width="14" height="14" viewBox="0 -960 960 960" fill="currentColor" aria-hidden="true" focusable="false">
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
            },
            // Pinned ids of switched-off rules from built-in and remote
            // lists, so importing reproduces the same toggles.
            rulePins: getExportableRuleIdPins()
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

// Pins with the disable keys still switched off under them; pins with none
// left are not worth carrying to another browser.
function getExportableRuleIdPins() {
    const disabled = new Set(clearURLsDisabledRuleIds);
    return clearURLsRuleIdPins
        .map(pin => ({ ...pin, disableKeys: pin.disableKeys.filter(key => disabled.has(key)) }))
        .filter(pin => pin.disableKeys.length > 0);
}

// Adds imported pins and switches off the rules they were switched off for.
async function importRuleIdPins(pins) {
    if (pins.length === 0) return;
    pins.forEach(pin => {
        clearURLsRuleIdPins = LinkumoriRulePins.upsertPin(clearURLsRuleIdPins, pin);
    });
    clearURLsDisabledRuleIds = [...new Set([...clearURLsDisabledRuleIds, ...pins.flatMap(pin => pin.disableKeys)])];
    await saveClearURLsRuleIdPins();
    await saveClearURLsDisabledRuleIds();
    await reloadRulesAfterExclusionChange();
}

// Accepts this editor's export ({ clearurlsCustomRules: { providers } }) and a
// plain Linkumori rules file ({ providers }), both JSON.
function getProvidersFromImportedCustomRules(imported) {
    if (!isPlainObject(imported)) {
        return null;
    }
    const container = isPlainObject(imported.clearurlsCustomRules) ? imported.clearurlsCustomRules : imported;
    return isPlainObject(container.providers) ? container.providers : null;
}

function assertOnlyKeys(value, allowedKeys, label) {
    Object.keys(value || {}).forEach((key) => {
        if (!allowedKeys.includes(key)) {
            throw new Error(`${label} has unknown key "${key}"`);
        }
    });
}

function validateImportedProviders(providersData) {
    if (!providersData || Object.keys(providersData).length === 0) {
        throw new Error(i18n('customRulesEditor_noProvidersInFile'));
    }

    for (const [name, provider] of Object.entries(providersData)) {
        assertProviderArrayFields(provider, name);
        assertRuleEntrySyntax(provider, name);
        provider.indexPattern = normalizeIndexPatternValue(provider.indexPattern);
        if (!provider.indexPattern) delete provider.indexPattern;
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
        'fieldRedirections',
        'exceptions',
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
            const imported = JSON.parse(String(event.target.result || '').replace(/^\uFEFF/, ''));

            if (!imported || typeof imported !== 'object' || Array.isArray(imported)) {
                throw new Error(i18n('customRulesEditor_invalidFileStructure'));
            }

            const providersData = getProvidersFromImportedCustomRules(imported);
            const hasProviderRules = providersData && Object.keys(providersData).length > 0;
            const importedPins = LinkumoriRulePins.normalizePins(imported.rulePins)
                .filter(pin => pin.disableKeys.length > 0);

            if (!hasProviderRules && importedPins.length === 0) {
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
                await importRuleIdPins(importedPins);

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
