/*
 * ============================================================
 * ClearURLs
 * ============================================================
 * Copyright (c) 2017–2020 Kevin Röbert
 * Modified by Subham Mahesh (c) 2025 (modified parts only)
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
 * Repository: https://github.com/linkumori/linkumori
 *
 * MODIFICATIONS
 * -------------
 * - Removed DataTables library and replaced with a dependency-free
 *   vanilla JS solution
 * - Unified i18n messages.json for a consistent user experience
 * - Added full client-side pagination controls
 * - Complete internationalization support with number localization
 * - DataTables-style features and responsive design
 * - Removed all inline CSS styling in favor of CSS classes
 * - Added time-based sorting functionality
 * - Promise-based LinkumoriI18n.ready() implementation
 * - Improved timestamp handling for localized dates
 * - Full number localization for all pagination elements
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
/*jshint esversion: 6 */
'use strict';

// ══════════════════════════════════════════════════════════════
// SECTION 1 · SHARED SETUP
// ══════════════════════════════════════════════════════════════

const {
    THEME_STORAGE_KEY,
    DEFAULT_THEME,
    syncBootstrapTheme,
    normalizeTheme
} = globalThis.LinkumoriTheme;

// ── i18n helpers ──────────────────────────────────────────────

/**
 * Primary translation helper (log.js style — supports placeholders).
 */
function translate(key, placeholders = []) {
    try {
        let message = LinkumoriI18n.getMessage(key, placeholders);
        return message || key;
    } catch (error) {
        console.warn('Translation error for key:', key, error);
        return key;
    }
}

/**
 * Short alias used by the live-logger section (logger.js style —
 * accepts a fallback string instead of a placeholders array).
 */
function t(key, fallback) {
    try {
        const msg = LinkumoriI18n.getMessage(key);
        return msg || fallback || key;
    } catch (_) {
        return fallback || key;
    }
}

// ── Number / percent helpers ──────────────────────────────────

function localizeNumber(number) {
    try {
        if (typeof LinkumoriI18n !== 'undefined' && LinkumoriI18n.isReady()) {
            if (typeof LinkumoriI18n.formatNumber === 'function') {
                return LinkumoriI18n.formatNumber(number, { maximumFractionDigits: 0 });
            }
            return LinkumoriI18n.localizeNumbers(String(number));
        }
        return String(number);
    } catch (error) {
        console.warn('Number localization error:', error);
        return String(number);
    }
}

function localizePercent(value, maximumFractionDigits = 1) {
    try {
        const numericValue = Number(value);
        const percentSymbol = translate('percentage_symbol') || '%';
        if (typeof LinkumoriI18n !== 'undefined' && LinkumoriI18n.isReady()) {
            const formattedValue = typeof LinkumoriI18n.formatNumber === 'function'
                ? LinkumoriI18n.formatNumber(numericValue, { maximumFractionDigits })
                : LinkumoriI18n.localizeNumbers(numericValue.toFixed(maximumFractionDigits));
            return `${formattedValue}${percentSymbol}`;
        }
        return `${numericValue.toFixed(maximumFractionDigits)}${percentSymbol}`;
    } catch (error) {
        console.warn('Percentage localization error:', error);
        return `${String(value)}${translate('percentage_symbol') || '%'}`;
    }
}

// ── Modal helpers ─────────────────────────────────────────────

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

// ══════════════════════════════════════════════════════════════
// SECTION 2 · STATIC LOG VIEWER  (log.js)
// ══════════════════════════════════════════════════════════════

/**
 * Apply i18n text to every element decorated with data-i18n /
 * data-i18n-placeholder / data-i18n-title across all three views.
 */
function setI18nText() {
    // Page title
    document.title = translate('log_html_page_title');

    const pageTitle = document.getElementById('page_title');
    if (pageTitle) pageTitle.textContent = translate('log_html_page_title');

    // Generic sweep — covers both log and logger elements
    document.querySelectorAll('[data-i18n]').forEach(element => {
        const key = element.getAttribute('data-i18n');
        const translation = translate(key);
        // Preserve the sort button nested inside the timestamp header
        if (element.id === 'head_4') return;
        if (element.tagName === 'INPUT') {
            element.value = translation;
        } else {
            element.textContent = translation;
        }
    });

    document.querySelectorAll('[data-i18n-placeholder]').forEach(element => {
        element.placeholder = translate(element.getAttribute('data-i18n-placeholder'));
    });

    document.querySelectorAll('[data-i18n-title]').forEach(element => {
        element.title = translate(element.getAttribute('data-i18n-title'));
    });

    // Static log table headers (head_4 kept last — preserves sort button)
    const headIds = ['head_1','head_2','head_3','head_5','head_6','head_7','head_8'];
    headIds.forEach((id, i) => {
        const el = document.getElementById(id);
        if (el) el.textContent = translate(`log_html_table_head_${[1,2,3,5,6,7,8][i]}`);
    });

    const timestampHeader = document.getElementById('head_4');
    const sortButton = document.getElementById('time-sort-btn');
    if (timestampHeader && sortButton) {
        Array.from(timestampHeader.childNodes).forEach(node => {
            if (node.nodeType === Node.TEXT_NODE) timestampHeader.removeChild(node);
        });
        timestampHeader.insertBefore(
            document.createTextNode(translate('log_html_table_head_4')),
            sortButton
        );
    }

    // Log-view button labels
    const resetText  = document.getElementById('reset_log_btn_text');
    const exportText = document.getElementById('export_log_btn_text');
    const importText = document.getElementById('import_log_btn_text');
    if (resetText)  resetText.textContent  = translate('log_html_reset_button');
    if (exportText) exportText.textContent = translate('log_html_export_button');
    if (importText) importText.textContent = translate('log_html_import_button');

    const resetBtn  = document.getElementById('reset_log_btn');
    const exportBtn = document.getElementById('export_log_btn');
    const importBtn = document.getElementById('import_log_btn');
    if (resetBtn)  resetBtn.setAttribute('title',  translate('log_html_reset_button_title'));
    if (exportBtn) exportBtn.setAttribute('title', translate('log_html_export_button_title'));
    if (importBtn) importBtn.setAttribute('title', translate('log_html_import_button_title'));

    // Localize numeric length-select options
    const lengthSelect = document.getElementById('length_select');
    if (lengthSelect) {
        Array.from(lengthSelect.options).forEach(option => {
            if (option.value !== '-1' && !isNaN(Number(option.value))) {
                option.textContent = localizeNumber(option.value);
            }
        });
    }

    // ── Logger view explicit injection ────────────────────────
    // Uses the same LinkumoriI18n pattern as the rest of the file:
    // find by data-i18n attribute, inject via translate().

    const setI18n = (key) => {
        const el = document.querySelector(`[data-i18n="${key}"]`);
        if (el) el.textContent = translate(key);
    };
    const setI18nPlaceholder = (key) => {
        const el = document.querySelector(`[data-i18n-placeholder="${key}"]`);
        if (el) el.placeholder = translate(key);
    };

    setI18n('logger_nav_label');
    setI18n('logger_btn_pause');
    setI18n('logger_btn_clear');
    setI18n('logger_btn_autoscroll');
    setI18n('logger_filter_label');
    setI18nPlaceholder('logger_filter_placeholder');
    setI18n('logger_tab_filter_label');
    setI18n('logger_tab_all');
    setI18n('logger_col_time');
    setI18n('logger_col_action');
    setI18n('logger_col_rule');
    setI18n('logger_col_provider');
    setI18n('logger_col_pattern');
    setI18n('logger_col_type');
    setI18n('logger_col_method');
    setI18n('logger_col_url');
    setI18n('logger_empty_state');
    setI18n('logger_detail_title');
    setI18n('logger_logging_disabled_banner');
}

// ── Reset / Export / Import ───────────────────────────────────

function resetGlobalLog() {
    LinkumoriI18n.ready().then(() => {
        modalConfirm(translate('log_html_reset_confirm')).then(confirmed => {
            if (!confirmed) return;
            browser.runtime.sendMessage({
                function: 'setData',
                params: ['log', JSON.stringify({ log: [] })]
            }).then(() => location.reload()).catch(handleError);
        });
    }).catch(() => {
        modalConfirm(translate('log_html_reset_confirm')).then(confirmed => {
            if (!confirmed) return;
            browser.runtime.sendMessage({
                function: 'setData',
                params: ['log', JSON.stringify({ log: [] })]
            }).then(() => location.reload()).catch(handleError);
        });
    });
}

function exportGlobalLog() {
    browser.runtime.sendMessage({ function: 'getData', params: ['log'] })
        .then(data => {
            const blob = new Blob(
                [JSON.stringify(data.response, null, 2)],
                { type: 'application/json' }
            );
            browser.downloads.download({
                url: URL.createObjectURL(blob),
                filename: 'ClearURLsLogExport.json',
                saveAs: true
            }).catch(handleError);
        }).catch(handleError);
}

function importGlobalLog(evt) {
    const file = evt.target.files[0];
    if (!file) return;
    const fileReader = new FileReader();
    fileReader.onload = async function (e) {
        LinkumoriI18n.ready().then(() => {
            try {
                const importedData = JSON.parse(e.target.result);
                if (!importedData || !Array.isArray(importedData.log)) {
                    throw new Error(translate('log_html_import_error_invalid_format'));
                }
                browser.runtime.sendMessage({
                    function: 'setData',
                    params: ['log', e.target.result]
                }).then(() => location.reload(), handleError);
            } catch (err) {
                modalAlert(translate('log_html_import_error') + `\n${err.message}`);
                handleError(err);
            }
        }).catch(() => {
            try {
                const importedData = JSON.parse(e.target.result);
                if (!importedData || !Array.isArray(importedData.log)) {
                    throw new Error(translate('log_html_import_error_invalid_format'));
                }
                browser.runtime.sendMessage({
                    function: 'setData',
                    params: ['log', e.target.result]
                }).then(() => location.reload(), handleError);
            } catch (err) {
                modalAlert(translate('log_html_import_error') + `\n${err.message}`);
                handleError(err);
            }
        });
    };
    fileReader.readAsText(file);
}

// ── Timestamp / date utilities ────────────────────────────────

function toDate(time) {
    if (!time) return '';
    const parsedMillis = toMillis(time);
    const target = parsedMillis !== null ? parsedMillis : time;
    if (window.LinkumoriI18n?.isReady()) {
        if (typeof LinkumoriI18n.formatDateTime === 'function') {
            return LinkumoriI18n.formatDateTime(target, { dateStyle: 'short', timeStyle: 'medium' });
        }
        return LinkumoriI18n.formatDate(target, 'DD/MM/YYYY, HH:mm:ss');
    }
    const fallback = new Date(target).toLocaleString();
    return window.LinkumoriI18n && typeof LinkumoriI18n.localizeNumbers === 'function'
        ? LinkumoriI18n.localizeNumbers(fallback)
        : fallback;
}

function toMillis(value) {
    if (typeof value === 'number' && Number.isFinite(value)) return value;
    if (typeof value === 'string') {
        const trimmed = value.trim();
        const legacyDateMatch = trimmed.match(
            /^(\d{1,2})\/(\d{1,2})\/(\d{4})(?:,\s*|\s+)(\d{1,2}):(\d{2})(?::(\d{2}))?$/
        );
        if (legacyDateMatch) {
            const d = new Date(
                Number(legacyDateMatch[3]),
                Number(legacyDateMatch[2]) - 1,
                Number(legacyDateMatch[1]),
                Number(legacyDateMatch[4]),
                Number(legacyDateMatch[5]),
                Number(legacyDateMatch[6] || 0)
            );
            if (!Number.isNaN(d.getTime())) return d.getTime();
        }
        const asNum = Number(value);
        if (!Number.isNaN(asNum) && Number.isFinite(asNum)) return asNum;
        const asDate = Date.parse(value);
        if (!Number.isNaN(asDate)) return asDate;
    }
    return null;
}

// ── Domain pattern matching (provider inference) ──────────────

function normalizeProviderDomainPatterns(providerData) {
    const patterns = [];
    if (Array.isArray(providerData?.domainPatterns)) {
        providerData.domainPatterns.forEach(p => {
            if (typeof p === 'string' && p.trim()) patterns.push(p.trim());
        });
    } else if (typeof providerData?.domainPatterns === 'string' && providerData.domainPatterns.trim()) {
        patterns.push(providerData.domainPatterns.trim());
    }
    return patterns;
}

function logMatchDomainPattern(url, patterns) {
    if (typeof patterns === 'string') patterns = [patterns];
    if (!Array.isArray(patterns) || patterns.length === 0) return false;

    function escapeRegexChar(char) {
        return /[\\^$.*+?()[\]{}|]/.test(char) ? ('\\' + char) : char;
    }

    function linkumoriTokensToRegexSource(input) {
        let output = '';
        for (let i = 0; i < input.length; i++) {
            const ch = input.charAt(i);
            if (ch === '*') {
                output += '.*';
            } else if (ch === '^') {
                output += '(?:[^0-9A-Za-z_\\-.%]|$)';
            } else {
                output += escapeRegexChar(ch);
            }
        }
        return output;
    }

    function compileTailRegex(tail) {
        let raw = String(tail || '');
        let startAnchor = false;
        let endAnchor   = false;
        if (raw.startsWith('|')) { startAnchor = true; raw = raw.slice(1); }
        if (raw.endsWith('|'))   { endAnchor   = true; raw = raw.slice(0, -1); }
        return new RegExp(
            (startAnchor ? '^' : '') + linkumoriTokensToRegexSource(raw) + (endAnchor ? '$' : ''),
            'i'
        );
    }

    function firstSpecialIndex(input) {
        const slashIndex = input.indexOf('/');
        const caretIndex = input.indexOf('^');
        const pipeIndex  = input.indexOf('|');
        let index = -1;
        if (slashIndex !== -1) index = slashIndex;
        if (caretIndex !== -1 && (index === -1 || caretIndex < index)) index = caretIndex;
        if (pipeIndex  !== -1 && (index === -1 || pipeIndex  < index)) index = pipeIndex;
        return index;
    }

    function isSimpleHostExpression(input) {
        return /^[a-z0-9*.-]+$/i.test(input);
    }

    function parseRegexLiteral(value) {
        const text = String(value || '').trim();
        if (!text.startsWith('/')) return null;
        let escaped = false;
        for (let i = 1; i < text.length; i++) {
            const ch = text.charAt(i);
            if (escaped) { escaped = false; continue; }
            if (ch === '\\') { escaped = true; continue; }
            if (ch === '/') {
                const source = text.slice(1, i);
                const flags  = text.slice(i + 1).replace(/[^dgimsuvy]/g, '');
                try { return new RegExp(source, flags.includes('i') ? flags : flags + 'i'); }
                catch (e) { return null; }
            }
        }
        return null;
    }

    try {
        const urlObj     = new URL(url);
        const hostname   = urlObj.hostname.toLowerCase();
        const pathTarget = (urlObj.pathname + urlObj.search + urlObj.hash).toLowerCase();
        const fullUrl    = url.toLowerCase();

        return patterns.some(pattern => {
            if (!pattern) return false;
            const p = String(pattern).trim();

            const wildcardDomainToRegex = patternValue => {
                let regexPattern = patternValue.replace(/\./g, '\\.');
                if (patternValue.endsWith('.*')) {
                    regexPattern = regexPattern.replace(/\\\.\*$/, '(?:\\.[^.]+)+');
                }
                regexPattern = regexPattern.replace(/\*/g, '[^.]*');
                return `^${regexPattern}$`;
            };

            const matchRootDomainWildcardTld = (hostnameValue, patternValue) => {
                const base = patternValue.slice(0, -2);
                if (!base) return false;
                const hostLabels  = hostnameValue.toLowerCase().split('.');
                const baseLabels  = base.toLowerCase().split('.');
                const tldCountDirect  = hostLabels.length - baseLabels.length;
                const tldCountWithWww = hostLabels.length - (baseLabels.length + 1);
                let directMatch = tldCountDirect >= 1;
                if (directMatch) {
                    for (let i = 0; i < baseLabels.length; i++) {
                        if (hostLabels[i] !== baseLabels[i]) { directMatch = false; break; }
                    }
                    if (directMatch) return true;
                }
                let wwwMatch = tldCountWithWww >= 1 && hostLabels[0] === 'www';
                if (wwwMatch) {
                    for (let i = 0; i < baseLabels.length; i++) {
                        if (hostLabels[i + 1] !== baseLabels[i]) { wwwMatch = false; break; }
                    }
                }
                return wwwMatch;
            };

            const structuredDomainAnchorMatch = patternValue => {
                const body = String(patternValue || '').slice(2).trim();
                if (!body) return false;
                const specialIndex    = firstSpecialIndex(body);
                const hostExpression  = specialIndex === -1 ? body : body.slice(0, specialIndex);
                const tail            = specialIndex === -1 ? '' : body.slice(specialIndex);
                if (!hostExpression || !isSimpleHostExpression(hostExpression)) return null;
                const domain = hostExpression.toLowerCase().trim();
                const domainForMatching = domain.endsWith('.') && !domain.endsWith('..')
                    ? domain.slice(0, -1) + '.*'
                    : domain;
                if (domainForMatching.includes('*')) {
                    const rootTldOnly = domainForMatching.endsWith('.*') && !domainForMatching.startsWith('*.');
                    if (rootTldOnly) {
                        if (!matchRootDomainWildcardTld(hostname, domainForMatching)) return false;
                    } else if (!new RegExp(wildcardDomainToRegex(domainForMatching), 'i').test(hostname)) {
                        return false;
                    }
                } else if (hostname !== domainForMatching && !hostname.endsWith(`.${domainForMatching}`)) {
                    return false;
                }
                let rest = tail;
                if (rest.startsWith('^')) rest = rest.slice(1);
                if (!rest) return true;
                if (rest.startsWith('/') && !/[|*^]/.test(rest)) {
                    return pathTarget.startsWith(rest.toLowerCase());
                }
                return compileTailRegex(rest.toLowerCase()).test(pathTarget);
            };

            if (p.startsWith('||')) {
                const structured = structuredDomainAnchorMatch(p);
                if (structured !== null) return structured;
            }
            const regexLiteral = parseRegexLiteral(p);
            if (regexLiteral) return regexLiteral.test(fullUrl);
            return new RegExp(linkumoriTokensToRegexSource(p), 'i').test(fullUrl);
        });
    } catch (e) {
        return false;
    }
}

// ── Provider inference ────────────────────────────────────────

function inferProviderMatch(entry, rulesData) {
    const providers = rulesData?.providers;
    if (!providers || typeof providers !== 'object') return null;
    const testUrl = (typeof entry?.before === 'string' && entry.before) ||
                    (typeof entry?.after  === 'string' && entry.after)  || '';
    if (!testUrl) return null;
    for (const [providerName, providerData] of Object.entries(providers)) {
        if (!providerData || typeof providerData !== 'object') continue;
        const urlPattern = typeof providerData.urlPattern === 'string' ? providerData.urlPattern : '';
        if (urlPattern) {
            try {
                if (new RegExp(urlPattern, 'i').test(testUrl)) {
                    return {
                        providerName,
                        patternType: 'urlPattern',
                        patternValue: urlPattern,
                        providerMethods: Array.isArray(providerData.methods) ? providerData.methods : [],
                        providerResourceTypes: Array.isArray(providerData.resourceTypes) ? providerData.resourceTypes : []
                    };
                }
            } catch (e) { /* skip invalid pattern */ }
        }
        const domainPatterns = normalizeProviderDomainPatterns(providerData);
        if (domainPatterns.length > 0) {
            for (const pattern of domainPatterns) {
                if (logMatchDomainPattern(testUrl, [pattern])) {
                    return {
                        providerName,
                        patternType: 'domainPatterns',
                        patternValue: pattern,
                        providerMethods: Array.isArray(providerData.methods) ? providerData.methods : [],
                        providerResourceTypes: Array.isArray(providerData.resourceTypes) ? providerData.resourceTypes : []
                    };
                }
            }
        }
    }
    return null;
}

function shouldInferProviderMatch(entry) {
    if (!entry || typeof entry !== 'object') return false;
    const explicitCategory = typeof entry.logCategory === 'string' ? entry.logCategory.toLowerCase() : '';
    if (explicitCategory === 'feature') return false;
    if (explicitCategory === 'provider') return true;
    const ruleText = typeof entry.rule === 'string' ? entry.rule.trim() : '';
    if (!ruleText) return false;
    const featureRules = new Set([
        translate('eTag_filtering_log'),
        translate('log_ping_blocked'),
        translate('log_whitelist_bypass')
    ]);
    if (featureRules.has(ruleText)) return false;
    const providerNarrativeRules = new Set([
        translate('log_redirect'),
        translate('log_domain_blocked')
    ]);
    if (providerNarrativeRules.has(ruleText)) return true;
    const looksNarrative = /\s/.test(ruleText) && !/[\\^$.*+?()[\]{}|]/.test(ruleText);
    if (looksNarrative) return false;
    return true;
}

function toCleanStringArray(arr) {
    if (!Array.isArray(arr)) return [];
    return arr.filter(item => typeof item === 'string' && item.trim()).map(item => item.trim());
}

function resolveLogContext(entry, rulesData = null) {
    if (!entry || typeof entry !== 'object') {
        return { providerName: '', patternType: '', patternValue: '',
                 requestMethod: '', providerMethods: [], requestType: '', providerResourceTypes: [] };
    }
    let providerName  = typeof entry.providerName  === 'string' ? entry.providerName  : '';
    let patternType   = typeof entry.patternType   === 'string' ? entry.patternType   : '';
    let patternValue  = typeof entry.patternValue  === 'string' ? entry.patternValue  : '';
    let requestMethod = typeof entry.requestMethod === 'string' ? entry.requestMethod
        : (typeof entry.method === 'string' ? entry.method : '');
    let providerMethods       = toCleanStringArray(entry.providerMethods);
    let requestType           = typeof entry.requestType === 'string' ? entry.requestType
        : (typeof entry.resourceType === 'string' ? entry.resourceType
            : (typeof entry.type === 'string' ? entry.type : ''));
    let providerResourceTypes = toCleanStringArray(entry.providerResourceTypes);
    if (!providerResourceTypes.length) providerResourceTypes = toCleanStringArray(entry.resourceTypes);
    const canInfer = shouldInferProviderMatch(entry);
    if (canInfer && (!providerName || !patternType || !patternValue ||
        !providerMethods.length || !providerResourceTypes.length || !requestType) && rulesData) {
        const inferred = inferProviderMatch(entry, rulesData);
        if (inferred) {
            providerName  = providerName  || inferred.providerName  || '';
            patternType   = patternType   || inferred.patternType   || '';
            patternValue  = patternValue  || inferred.patternValue  || '';
            if (!providerMethods.length)       providerMethods       = toCleanStringArray(inferred.providerMethods);
            if (!providerResourceTypes.length) providerResourceTypes = toCleanStringArray(inferred.providerResourceTypes);
            if (!requestType && providerResourceTypes.length === 1) requestType = providerResourceTypes[0];
        }
    }
    return { providerName, patternType, patternValue, requestMethod,
             providerMethods, requestType, providerResourceTypes };
}

function getPatternText(context) {
    if (!context.patternType && !context.patternValue) return '-';
    let label = '';
    if (context.patternType === 'urlPattern')    label = translate('log_provider_pattern_url');
    else if (context.patternType === 'domainPatterns') label = translate('log_provider_pattern_domain');
    else if (context.patternType)                label = context.patternType;
    if (label && context.patternValue) return `${label}: ${context.patternValue}`;
    return context.patternValue || label || '-';
}

function getMethodText(context) {
    const { requestMethod, providerMethods = [] } = context;
    if (!requestMethod && providerMethods.length === 0) return '-';
    if (requestMethod && providerMethods.length) return `${requestMethod} [${providerMethods.join(', ')}]`;
    return requestMethod || providerMethods.join(', ');
}

function getResourceTypeText(context) {
    const { requestType, providerResourceTypes = [] } = context;
    if (!requestType && providerResourceTypes.length === 0) return '-';
    if (requestType && providerResourceTypes.length) return `${requestType} [${providerResourceTypes.join(', ')}]`;
    return requestType || providerResourceTypes.join(', ');
}

function getLogSearchBlob(entry, rulesData = null) {
    const context = resolveLogContext(entry, rulesData);
    return [
        entry.before       || '',
        entry.after        || '',
        entry.rule         || '',
        context.providerName || '',
        getPatternText(context),
        getMethodText(context),
        getResourceTypeText(context)
    ].join(' ').toLowerCase();
}

// ── Generic utilities ─────────────────────────────────────────

function handleError(error) {
    console.error(`Error: ${error}`);
}

function extractHost(rawUrl) {
    if (typeof rawUrl !== 'string' || rawUrl.trim() === '') return null;
    try { return new URL(rawUrl).hostname.toLowerCase(); }
    catch (_) { return null; }
}

function getQueryParamNames(rawUrl) {
    if (typeof rawUrl !== 'string' || rawUrl.trim() === '') return [];
    try {
        const url  = new URL(rawUrl);
        const keys = new Set();
        url.searchParams.forEach((_, key) => { if (key) keys.add(key); });
        return Array.from(keys);
    } catch (_) { return []; }
}

function countTop(items, limit = 10) {
    const counts = new Map();
    items.forEach(item => { if (item) counts.set(item, (counts.get(item) || 0) + 1); });
    return Array.from(counts.entries())
        .sort((a, b) => b[1] - a[1] || String(a[0]).localeCompare(String(b[0])))
        .slice(0, limit);
}

function formatStatsDateKey(dateKey) {
    if (typeof dateKey !== 'string' || dateKey.length !== 10) return dateKey;
    const asMillis = Date.parse(`${dateKey}T00:00:00`);
    if (Number.isNaN(asMillis)) return dateKey;
    if (window.LinkumoriI18n?.isReady()) {
        if (typeof LinkumoriI18n.formatDateTime === 'function') {
            return LinkumoriI18n.formatDateTime(asMillis, { dateStyle: 'short' });
        }
        return LinkumoriI18n.formatDate(asMillis, 'DD/MM/YYYY');
    }
    const fallback = new Date(asMillis).toLocaleDateString();
    return window.LinkumoriI18n && typeof LinkumoriI18n.localizeNumbers === 'function'
        ? LinkumoriI18n.localizeNumbers(fallback)
        : fallback;
}

// ── Sorting ───────────────────────────────────────────────────

function sortLogByTime(logs, order = 'desc') {
    return [...logs].sort((a, b) => {
        let timeA = a.timestamp || 0;
        let timeB = b.timestamp || 0;
        if (typeof timeA === 'string') timeA = !isNaN(Number(timeA)) ? Number(timeA) : 0;
        if (typeof timeB === 'string') timeB = !isNaN(Number(timeB)) ? Number(timeB) : 0;
        return order === 'desc' ? timeB - timeA : timeA - timeB;
    });
}

function updateSortButton(sortOrder) {
    const timeSortBtn = document.getElementById('time-sort-btn');
    if (timeSortBtn) {
        timeSortBtn.className = `sort-button active ${sortOrder}`;
        timeSortBtn.setAttribute('title',
            sortOrder === 'desc'
                ? translate('log_html_sort_oldest_first')
                : translate('log_html_sort_newest_first')
        );
    }
}

// ── Theme ─────────────────────────────────────────────────────

function initializeTheme() {
    document.documentElement.setAttribute('data-theme',
        normalizeTheme(document.documentElement.getAttribute('data-theme') || DEFAULT_THEME));
    browser.storage.local.get([THEME_STORAGE_KEY]).then(result => {
        const savedTheme = result[THEME_STORAGE_KEY] || DEFAULT_THEME;
        document.documentElement.setAttribute('data-theme', normalizeTheme(savedTheme));
        syncBootstrapTheme(savedTheme);
    }).catch(() => {
        document.documentElement.setAttribute('data-theme', normalizeTheme(DEFAULT_THEME));
        syncBootstrapTheme(DEFAULT_THEME);
    });
}

// ── State persistence ─────────────────────────────────────────

function saveState() {
    const state = {
        page:      window.currentPage || 1,
        length:    parseInt(document.getElementById('length_select').value),
        search:    document.getElementById('search_input').value,
        sortOrder: window.sortOrder || 'desc',
        time:      Date.now()
    };
    localStorage.setItem('linkumori-log-state', JSON.stringify(state));
}

function loadState() {
    try {
        const saved = localStorage.getItem('linkumori-log-state');
        if (saved) {
            const state = JSON.parse(saved);
            if (Date.now() - state.time < 3600000) {
                window.currentPage = state.page || 1;
                window.sortOrder   = state.sortOrder || 'desc';
                document.getElementById('length_select').value = state.length || 25;
                document.getElementById('search_input').value  = state.search  || '';
                return true;
            }
        }
    } catch (e) { console.warn('Failed to load pagination state:', e); }
    return false;
}

// ── Loading overlay ───────────────────────────────────────────

function showLoading(show = true) {
    const loadingOverlay = document.getElementById('loading-overlay');
    if (loadingOverlay) loadingOverlay.classList.toggle('show', show);
}

// ── Error toast ───────────────────────────────────────────────

function showErrorMessage(message) {
    const errorDiv = document.createElement('div');
    errorDiv.className  = 'error-message';
    errorDiv.textContent = message;
    errorDiv.style.animation = 'slideIn 0.3s ease';
    document.body.appendChild(errorDiv);
    setTimeout(() => {
        if (errorDiv.parentNode) {
            errorDiv.style.animation = 'slideOut 0.3s ease';
            setTimeout(() => { if (errorDiv.parentNode) errorDiv.parentNode.removeChild(errorDiv); }, 300);
        }
    }, 5000);
}

// ── View navigation (EXTENDED: dashboard | logs | logger) ─────

/**
 * Sets up the three-tab navigation.
 * - Activates/deactivates panels and buttons.
 * - Shows the logging-disabled banner only when on the logger tab.
 * - Persists the last active tab to localStorage.
 * - Calls onViewChange(viewName) when the tab changes.
 */
function setupViewNavigation(onViewChange = null) {
    const VIEWS = ['dashboard', 'logs', 'logger'];

    const applyView = (targetView) => {
        VIEWS.forEach(v => {
            const btn   = document.getElementById('nav-' + v);
            const panel = document.getElementById(v + '-view');
            if (btn)   btn.classList.toggle('active',  v === targetView);
            if (panel) panel.classList.toggle('active', v === targetView);
        });

        // The logging-disabled banner is only relevant on the logger tab.
        // updateLoggingBanner() (logger section) controls the 'visible' class;
        // here we gate visibility on whether we are on that tab.
        const banner = document.getElementById('logging-banner');
        if (banner) {
            banner.style.display =
                (targetView === 'logger' && banner.classList.contains('visible'))
                    ? 'block'
                    : 'none';
        }

        localStorage.setItem('linkumori-log-view', targetView);
        if (typeof onViewChange === 'function') onViewChange(targetView);
    };

    VIEWS.forEach(v => {
        const btn = document.getElementById('nav-' + v);
        if (btn) btn.addEventListener('click', () => applyView(v));
    });

    // Restore last viewed tab, defaulting to dashboard
    const saved = localStorage.getItem('linkumori-log-view');
    applyView(VIEWS.includes(saved) ? saved : 'dashboard');
}

// ── Stats rendering ───────────────────────────────────────────

function renderStatsRows(tbodyId, rows, emptyLabel = '', localizeFirstColumnAsDate = false) {
    const tbody = document.getElementById(tbodyId);
    if (!tbody) return;
    tbody.innerHTML = '';
    if (rows.length === 0) {
        const tr  = document.createElement('tr');
        const td1 = document.createElement('td');
        const td2 = document.createElement('td');
        td1.textContent = emptyLabel || translate('datatable_empty_table');
        td2.textContent = localizeNumber(0);
        tr.appendChild(td1); tr.appendChild(td2);
        tbody.appendChild(tr);
        return;
    }
    rows.forEach(([name, count]) => {
        const tr  = document.createElement('tr');
        const td1 = document.createElement('td');
        const td2 = document.createElement('td');
        td1.textContent = localizeFirstColumnAsDate ? formatStatsDateKey(String(name)) : String(name);
        td2.textContent = localizeNumber(count);
        tr.appendChild(td1); tr.appendChild(td2);
        tbody.appendChild(tr);
    });
}

function getThemeColor(name, fallback) {
    const value = getComputedStyle(document.documentElement).getPropertyValue(name);
    return (typeof value === 'string' ? value.trim() : '') || fallback;
}

function getChartPalette() {
    return ['#2563eb','#16a34a','#dc2626','#f59e0b','#7c3aed',
            '#0ea5e9','#14b8a6','#ef4444','#84cc16','#f97316'];
}

function drawPieChart(ctx, width, height, labels, values) {
    const regions = [];
    const total   = values.reduce((a, b) => a + b, 0);
    const cx = width * 0.35;
    const cy = height * 0.5;
    const r  = Math.min(width, height) * 0.28;
    const palette = getChartPalette();
    let start = -Math.PI / 2;
    if (total <= 0) return regions;

    values.forEach((value, index) => {
        const from  = start;
        const angle = (value / total) * Math.PI * 2;
        ctx.beginPath();
        ctx.moveTo(cx, cy);
        ctx.arc(cx, cy, r, start, start + angle);
        ctx.closePath();
        ctx.fillStyle = palette[index % palette.length];
        ctx.fill();
        start += angle;
        regions.push({
            kind: 'slice', label: labels[index], value,
            contains(x, y) {
                const dx = x - cx; const dy = y - cy;
                const dist = Math.sqrt(dx * dx + dy * dy);
                if (dist > r) return false;
                let a = Math.atan2(dy, dx);
                if (a < 0) a += Math.PI * 2;
                let nFrom = from; let nTo = from + angle;
                while (nFrom < 0) { nFrom += Math.PI * 2; nTo += Math.PI * 2; }
                if (a < nFrom) a += Math.PI * 2;
                return a >= nFrom && a <= nTo;
            }
        });
    });

    // Legend
    const legendX = width * 0.65;
    let legendY   = height * 0.2;
    ctx.font = '12px sans-serif';
    labels.forEach((label, index) => {
        const color = palette[index % palette.length];
        ctx.fillStyle = color;
        ctx.fillRect(legendX, legendY, 10, 10);
        ctx.fillStyle = getThemeColor('--text-primary', '#f8fafc');
        const percent = localizePercent((values[index] / total) * 100, 1);
        ctx.fillText(`${label} (${percent})`, legendX + 16, legendY + 9);
        const rowY = legendY - 2;
        regions.push({
            kind: 'legend', index, label, value: values[index],
            x: legendX, y: rowY,
            w: Math.max(120, width - legendX - 8), h: 14,
            contains(x, y) {
                return x >= this.x && x <= this.x + this.w && y >= this.y && y <= this.y + this.h;
            }
        });
        legendY += 18;
    });
    return regions;
}

function renderStatsChart(topRulesSeries) {
    const canvas   = document.getElementById('stats-chart-canvas');
    const chartWrap = canvas ? canvas.closest('.chart-wrap') : null;
    if (!canvas) return;

    const rect   = canvas.getBoundingClientRect();
    const dpr    = window.devicePixelRatio || 1;
    const width  = Math.max(320, Math.floor(rect.width  || 800));
    const height = Math.max(220, Math.floor(rect.height || 280));
    canvas.width  = Math.floor(width  * dpr);
    canvas.height = Math.floor(height * dpr);
    const ctx = canvas.getContext('2d');
    if (!ctx) return;
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    ctx.clearRect(0, 0, width, height);

    const chartState = window.__logChartState || { hiddenPieIndexes: new Set() };
    if (!(chartState.hiddenPieIndexes instanceof Set)) chartState.hiddenPieIndexes = new Set();
    chartState.type         = 'pie';
    chartState.topRulesSeries = topRulesSeries;

    const activeSeries = topRulesSeries.filter((_, idx) => !chartState.hiddenPieIndexes.has(idx));
    const labels = activeSeries.map(([label]) => label);
    const values = activeSeries.map(([, value]) => value);
    const total  = values.reduce((sum, val) => sum + (Number(val) || 0), 0);
    if (chartWrap) chartWrap.classList.toggle('is-empty', total <= 0);
    if (total <= 0) {
        chartState.regions = []; chartState.pieVisibleMap = [];
        window.__logChartState = chartState;
        return;
    }
    const regions = drawPieChart(ctx, width, height, labels, values);
    chartState.regions      = regions;
    chartState.pieVisibleMap = activeSeries.map(item =>
        topRulesSeries.findIndex(x => x[0] === item[0] && x[1] === item[1]));
    window.__logChartState = chartState;
}

function renderOverallStats(logs, clearUrlsData = null) {
    const safeLogs = Array.isArray(logs) ? logs : [];
    const contexts = safeLogs.map(entry => resolveLogContext(entry, clearUrlsData));
    const rules      = safeLogs.map(x => (typeof x?.rule === 'string' ? x.rule : null)).filter(Boolean);
    const domains    = safeLogs.map(x => extractHost(x?.before)).filter(Boolean);
    const timestamps = safeLogs.map(x => toMillis(x?.timestamp)).filter(x => x != null);
    const providers  = contexts.map(c => c.providerName).filter(Boolean);
    const reqMethods = contexts.map(c => c.requestMethod).filter(Boolean);
    const reqTypes   = contexts.map(c => c.requestType).filter(Boolean);
    const fallbackMethods = [], fallbackResTypes = [];
    contexts.forEach(c => {
        if (!c.requestMethod && c.providerMethods?.length) fallbackMethods.push(...c.providerMethods);
        if (!c.requestType   && c.providerResourceTypes?.length) fallbackResTypes.push(...c.providerResourceTypes);
    });
    const methodsForStats   = reqMethods.length  ? reqMethods  : fallbackMethods;
    const resTypesForStats  = reqTypes.length    ? reqTypes    : fallbackResTypes;

    const setText = (id, v) => { const el = document.getElementById(id); if (el) el.textContent = v; };
    setText('stats-total-entries',         localizeNumber(safeLogs.length));
    setText('stats-changed-entries',       localizeNumber(safeLogs.filter(x => (x?.before || '') !== (x?.after || '')).length));
    setText('stats-unique-rules',          localizeNumber(new Set(rules).size));
    setText('stats-unique-domains',        localizeNumber(new Set(domains).size));
    setText('stats-unique-providers',      localizeNumber(new Set(providers).size));
    setText('stats-unique-methods',        localizeNumber(new Set(methodsForStats).size));
    setText('stats-unique-resource-types', localizeNumber(new Set(resTypesForStats).size));
    setText('stats-earliest', timestamps.length ? toDate(Math.min(...timestamps)) : '-');
    setText('stats-latest',   timestamps.length ? toDate(Math.max(...timestamps)) : '-');

    const topRulesSeries      = countTop(rules,          10);
    const topDomainsSeries    = countTop(domains,        10);
    const topProvidersSeries  = countTop(providers,      10);
    const topMethodsSeries    = countTop(methodsForStats,10);
    const topResTypesSeries   = countTop(resTypesForStats,10);

    renderStatsRows('stats-top-rules',          topRulesSeries,     translate('log_stats_no_rules'));
    renderStatsRows('stats-top-domains',        topDomainsSeries,   translate('log_stats_no_domains'));
    renderStatsRows('stats-top-providers',      topProvidersSeries, translate('log_stats_no_providers'));
    renderStatsRows('stats-top-methods',        topMethodsSeries,   translate('log_stats_no_methods'));
    renderStatsRows('stats-top-resource-types', topResTypesSeries,  translate('log_stats_no_resource_types'));
    renderStatsChart(topRulesSeries);
}

// ── Pagination ────────────────────────────────────────────────

function getPageNumbers(totalPages, currentPage, maxButtons = 7) {
    const pages = [];
    const half  = Math.floor(maxButtons / 2);
    const showFirstLast = maxButtons >= 5;

    function range(start, end) {
        const r = [];
        for (let i = start; i < end; i++) r.push(i);
        return r;
    }

    if (totalPages <= maxButtons) return range(1, totalPages + 1);

    if (maxButtons === 3) {
        if (currentPage <= 1)             return [1, 2, '...'];
        if (currentPage >= totalPages)    return ['...', totalPages - 1, totalPages];
        return ['...', currentPage, '...'];
    }
    if (maxButtons === 5) {
        if (currentPage <= 2)             return [1, 2, 3, '...', totalPages];
        if (currentPage >= totalPages - 1)return [1, '...', totalPages - 2, totalPages - 1, totalPages];
        return [1, '...', currentPage, '...', totalPages];
    }

    const boundarySize = showFirstLast ? 2 : 1;
    const leftOffset   = showFirstLast ? 1 : 0;
    if (currentPage <= half) {
        pages.push(...range(1, maxButtons - boundarySize + 1));
        pages.push('...');
        if (showFirstLast) pages.push(totalPages);
    } else if (currentPage >= totalPages - half) {
        if (showFirstLast) pages.push(1);
        pages.push('...');
        pages.push(...range(totalPages - (maxButtons - boundarySize) + 1, totalPages + 1));
    } else {
        if (showFirstLast) pages.push(1);
        pages.push('...');
        pages.push(...range(currentPage - half + leftOffset, currentPage + half - leftOffset + 1));
        pages.push('...');
        if (showFirstLast) pages.push(totalPages);
    }
    return pages;
}

function createPaginationButton(text, onClick, action = null) {
    const button = document.createElement('button');
    button.textContent = (typeof text === 'number' || (typeof text === 'string' && !isNaN(Number(text))))
        ? localizeNumber(text) : text;
    button.className = 'pagination-btn';
    button.addEventListener('click', onClick);
    if (action) button.setAttribute('data-action', action);
    return button;
}

// ── Language change status (used by settings page) ────────────

function showLanguageChangeStatus(langCode, type) {
    LinkumoriI18n.ready().then(() => {
        const statusElement = document.getElementById('statusMessage');
        if (!statusElement) return;
        const langInfo = LANGUAGE_MAPPINGS[langCode];
        let message;
        if (type === 'success') {
            message = translate('status_language_changed_success', langInfo.native);
            statusElement.className = 'status-message status-success';
        } else {
            message = translate('status_language_change_failed', langInfo.native);
            statusElement.className = 'status-message status-error';
        }
        statusElement.textContent = message;
        statusElement.style.display = 'block';
        setTimeout(() => { statusElement.style.display = 'none'; }, 3000);
    }).catch(() => {
        console.warn('I18n not ready for showLanguageChangeStatus');
    });
}

// ── Main application initializer (static log viewer) ──────────

function initializeApplication() {
    initializeTheme();

    let fullLog      = [];
    let clearUrlsData = null;
    window.currentPage = 1;
    window.sortOrder   = 'desc';

    const tbody              = document.getElementById('tbody');
    const searchInput        = document.getElementById('search_input');
    const lengthSelect       = document.getElementById('length_select');
    const paginationInfo     = document.getElementById('pagination-info');
    const paginationControls = document.getElementById('pagination-controls');
    const timeSortBtn        = document.getElementById('time-sort-btn');
    const statsChartReload   = document.getElementById('stats-chart-reload');
    const statsChartCanvas   = document.getElementById('stats-chart-canvas');
    const statsChartTooltip  = document.getElementById('stats-chart-tooltip');
    const dashboardView      = document.getElementById('dashboard-view');

    const rerenderChartWhenVisible = () => {
        if (!dashboardView || !dashboardView.classList.contains('active')) return;
        const chartState = window.__logChartState;
        if (!chartState) return;
        requestAnimationFrame(() => renderStatsChart(chartState.topRulesSeries || []));
    };

    // Extended navigation — fires rerenderChart when switching to dashboard
    setupViewNavigation(view => {
        if (view === 'dashboard') rerenderChartWhenVisible();
    });

    window.addEventListener('resize', rerenderChartWhenVisible);

    // Sort toggle
    if (timeSortBtn) {
        timeSortBtn.addEventListener('click', function (e) {
            e.stopPropagation();
            window.sortOrder = window.sortOrder === 'desc' ? 'asc' : 'desc';
            updateSortButton(window.sortOrder);
            window.currentPage = 1;
            renderTable();
        });
    }

    // Chart reload
    if (statsChartReload) {
        statsChartReload.addEventListener('click', () => {
            const chartState = window.__logChartState;
            if (chartState && chartState.hiddenPieIndexes instanceof Set) {
                chartState.hiddenPieIndexes.clear();
                window.__logChartState = chartState;
            }
            renderOverallStats(fullLog, clearUrlsData);
        });
    }

    // Chart tooltip + legend toggle
    if (statsChartCanvas && statsChartTooltip) {
        const showTooltip = (x, y, text) => {
            statsChartTooltip.textContent = text;
            statsChartTooltip.style.left  = `${x}px`;
            statsChartTooltip.style.top   = `${y}px`;
            statsChartTooltip.style.opacity = '1';
        };
        const hideTooltip = () => { statsChartTooltip.style.opacity = '0'; };

        statsChartCanvas.addEventListener('mousemove', evt => {
            const state = window.__logChartState;
            if (!state || !Array.isArray(state.regions)) { hideTooltip(); return; }
            const rect = statsChartCanvas.getBoundingClientRect();
            const x = evt.clientX - rect.left;
            const y = evt.clientY - rect.top;
            const hit = state.regions.find(r => typeof r.contains === 'function' && r.contains(x, y));
            if (!hit) { hideTooltip(); statsChartCanvas.style.cursor = 'default'; return; }
            statsChartCanvas.style.cursor = hit.kind === 'legend' ? 'pointer' : 'crosshair';
            showTooltip(x, y, `${hit.label}: ${localizeNumber(hit.value)}`);
        });
        statsChartCanvas.addEventListener('mouseleave', () => {
            hideTooltip(); statsChartCanvas.style.cursor = 'default';
        });
        statsChartCanvas.addEventListener('click', evt => {
            const state = window.__logChartState;
            if (!state || state.type !== 'pie' || !Array.isArray(state.regions)) return;
            const rect = statsChartCanvas.getBoundingClientRect();
            const x = evt.clientX - rect.left;
            const y = evt.clientY - rect.top;
            const hit = state.regions.find(r => r.kind === 'legend' && r.contains(x, y));
            if (!hit) return;
            const originalIndex = state.pieVisibleMap?.[hit.index];
            if (originalIndex == null) return;
            if (state.hiddenPieIndexes.has(originalIndex)) state.hiddenPieIndexes.delete(originalIndex);
            else                                            state.hiddenPieIndexes.add(originalIndex);
            window.__logChartState = state;
            renderStatsChart(state.topRulesSeries || []);
        });
    }

    // ── Render table ───────────────────────────────────────────

    function renderTable() {
        showLoading(true);
        setTimeout(() => {
            LinkumoriI18n.ready().then(() => {
                try {
                    _doRenderTable();
                    showLoading(false);
                    saveState();
                } catch (error) {
                    showLoading(false);
                    handleError(error);
                    showErrorMessage(translate('error_rendering_table'));
                }
            }).catch(() => {
                try {
                    _doRenderTable();
                    showLoading(false);
                    saveState();
                } catch (fallbackError) {
                    showLoading(false);
                    handleError(fallbackError);
                    showErrorMessage(translate('error_rendering_table'));
                }
            });
        }, 10);
    }

    function _doRenderTable() {
        const sortedLog   = sortLogByTime(fullLog, window.sortOrder);
        const searchTerm  = searchInput.value.toLowerCase();
        const filteredLog = searchTerm
            ? sortedLog.filter(entry => getLogSearchBlob(entry, clearUrlsData).includes(searchTerm))
            : sortedLog;

        const itemsPerPage = parseInt(lengthSelect.value, 10);
        const totalItems   = filteredLog.length;
        const totalPages   = Math.ceil(totalItems / itemsPerPage) || 1;
        if (window.currentPage > totalPages) window.currentPage = totalPages;

        const startIndex   = (window.currentPage - 1) * itemsPerPage;
        const endIndex     = startIndex + itemsPerPage;
        const paginatedLog = itemsPerPage === -1 ? filteredLog : filteredLog.slice(startIndex, endIndex);

        tbody.innerHTML = '';
        if (paginatedLog.length === 0) {
            const row  = tbody.insertRow();
            row.className = 'empty-row';
            const cell = row.insertCell(0);
            cell.colSpan = 8;
            cell.textContent = searchTerm
                ? translate('datatable_zero_records')
                : translate('datatable_empty_table');
        } else {
            paginatedLog.forEach(log => {
                const context = resolveLogContext(log, clearUrlsData);
                const row = tbody.insertRow();
                row.insertCell(0).textContent = log.before;
                row.insertCell(1).textContent = log.after;
                row.insertCell(2).textContent = log.rule;
                row.insertCell(3).textContent = context.providerName || '-';
                row.insertCell(4).textContent = getPatternText(context);
                row.insertCell(5).textContent = getMethodText(context);
                row.insertCell(6).textContent = getResourceTypeText(context);
                row.insertCell(7).textContent = toDate(log.timestamp);
            });
        }

        if (itemsPerPage !== -1) {
            renderPagination(totalItems, totalPages, startIndex, Math.min(endIndex, totalItems));
        } else {
            paginationInfo.textContent = translate('datatable_showing_all', [localizeNumber(totalItems)]);
            paginationControls.innerHTML = '';
        }
    }

    // ── Render pagination ──────────────────────────────────────

    function renderPagination(totalItems, totalPages, startIndex, endIndex) {
        LinkumoriI18n.ready().then(() => {
            if (totalItems === 0) {
                paginationInfo.textContent = translate('datatable_info_empty');
            } else {
                paginationInfo.textContent = translate('datatable_showing_entries', [
                    localizeNumber(startIndex + 1),
                    localizeNumber(Math.min(endIndex, totalItems)),
                    localizeNumber(totalItems)
                ]);
            }

            paginationControls.innerHTML = '';
            if (totalPages <= 1) return;

            const containerWidth = paginationControls.offsetWidth || window.innerWidth;
            let maxButtons = 7;
            if (containerWidth < 480) maxButtons = 3;
            else if (containerWidth < 768) maxButtons = 5;

            const mkBtn = (label, cb, aria, dtIdx) => {
                const b = createPaginationButton(label, cb);
                if (aria)  b.setAttribute('aria-label', aria);
                if (dtIdx) b.setAttribute('data-dt-idx', dtIdx);
                return b;
            };

            const firstBtn = mkBtn(translate('pagination_first'), () => {
                if (window.currentPage > 1) { window.currentPage = 1; renderTable(); }
            }, translate('pagination_first_aria'), 'first');
            if (window.currentPage === 1) firstBtn.disabled = true;
            paginationControls.appendChild(firstBtn);

            const prevBtn = mkBtn(translate('pagination_previous'), () => {
                if (window.currentPage > 1) { window.currentPage--; renderTable(); }
            }, translate('pagination_previous_aria'), 'previous');
            if (window.currentPage === 1) prevBtn.disabled = true;
            paginationControls.appendChild(prevBtn);

            getPageNumbers(totalPages, window.currentPage, maxButtons).forEach(page => {
                if (page === '...') {
                    const ellipsis = document.createElement('span');
                    ellipsis.textContent = '…';
                    ellipsis.className = 'pagination-ellipsis';
                    ellipsis.setAttribute('aria-hidden', 'true');
                    paginationControls.appendChild(ellipsis);
                } else {
                    const pageBtn = mkBtn(page, () => {
                        if (window.currentPage !== page) { window.currentPage = page; renderTable(); }
                    }, translate('pagination_page_aria', [localizeNumber(page)]), page);
                    if (page === window.currentPage) {
                        pageBtn.classList.add('active');
                        pageBtn.disabled = true;
                        pageBtn.setAttribute('aria-current', 'page');
                        pageBtn.setAttribute('aria-label', translate('pagination_current_page_aria', [localizeNumber(page)]));
                    }
                    paginationControls.appendChild(pageBtn);
                }
            });

            const nextBtn = mkBtn(translate('pagination_next'), () => {
                if (window.currentPage < totalPages) { window.currentPage++; renderTable(); }
            }, translate('pagination_next_aria'), 'next');
            if (window.currentPage === totalPages) nextBtn.disabled = true;
            paginationControls.appendChild(nextBtn);

            const lastBtn = mkBtn(translate('pagination_last'), () => {
                if (window.currentPage < totalPages) { window.currentPage = totalPages; renderTable(); }
            }, translate('pagination_last_aria'), 'last');
            if (window.currentPage === totalPages) lastBtn.disabled = true;
            paginationControls.appendChild(lastBtn);
        });
    }

    // ── Event listeners (static log) ──────────────────────────

    document.getElementById('reset_log_btn').addEventListener('click', resetGlobalLog);
    document.getElementById('export_log_btn').addEventListener('click', exportGlobalLog);
    document.getElementById('importLog').addEventListener('change', importGlobalLog);

    searchInput.addEventListener('input', () => {
        window.currentPage = 1;
        renderTable();
    });
    lengthSelect.addEventListener('change', () => {
        window.currentPage = 1;
        renderTable();
    });

    // ── Initial data fetch ─────────────────────────────────────

    const stateRestored = loadState();
    updateSortButton(window.sortOrder);

    Promise.all([
        browser.runtime.sendMessage({ function: 'getData', params: ['log'] }),
        browser.runtime.sendMessage({ function: 'getData', params: ['ClearURLsData'] })
    ]).then(([logData, rulesData]) => {
        fullLog       = (logData?.response && Array.isArray(logData.response.log)) ? logData.response.log : [];
        clearUrlsData = rulesData?.response || null;
        renderOverallStats(fullLog, clearUrlsData);
        if (stateRestored) {
            const ipp     = parseInt(lengthSelect.value, 10);
            const maxPages = ipp !== -1 ? Math.ceil(fullLog.length / ipp) : 1;
            if (window.currentPage > maxPages) window.currentPage = Math.max(1, maxPages);
        }
        renderTable();
    }).catch(error => {
        handleError(error);
        fullLog = []; clearUrlsData = null;
        renderOverallStats(fullLog, clearUrlsData);
        renderTable();
        LinkumoriI18n.ready()
            .then(() => showErrorMessage(translate('error_loading_data')))
            .catch(()  => showErrorMessage(translate('error_loading_data')));
    });
}

// ══════════════════════════════════════════════════════════════
// SECTION 3 · LIVE LOGGER  (logger.js)
// ══════════════════════════════════════════════════════════════

// ── Action classification ─────────────────────────────────────

const BLOCKED_RULES = new Set(['log_domain_blocked', 'domain_blocked', 'blocked']);
const ALLOWED_RULES = new Set(['log_whitelist_bypass', 'whitelist_bypass', 'allowed', 'whitelisted']);
const REDIRECT_RULES = new Set(['log_redirect', 'redirect', 'redirected']);

function classifyEntry(entry) {
    const rule = String(entry.rule || '').toLowerCase();
    if (BLOCKED_RULES.has(rule))  return 'blocked';
    if (ALLOWED_RULES.has(rule))  return 'allowed';
    if (REDIRECT_RULES.has(rule)) return 'redirected';
    if (entry.before !== entry.after) return 'modified';
    return 'info';
}

// ── Timestamp formatting (live, HH:mm:ss only) ────────────────

function formatTime(ts) {
    const d  = new Date(ts);
    const hh = String(d.getHours()).padStart(2, '0');
    const mm = String(d.getMinutes()).padStart(2, '0');
    const ss = String(d.getSeconds()).padStart(2, '0');
    return `${hh}:${mm}:${ss}`;
}

// ── Logger state ──────────────────────────────────────────────

let allEntries      = [];
let filteredEntries = [];
let paused          = false;
let autoScroll      = true;
let selectedIndex   = -1;
let filterText      = '';
let selectedTabId   = 'all';
let port            = null;
let loggingEnabled  = false;

const MAX_ENTRIES = 5000;

// ── Logger DOM refs ───────────────────────────────────────────

// Populated in initLogger() after DOM is ready
let logTbody, emptyState, statusBar, footerStatus, liveDot,
    btnPause, btnClear, btnScroll, filterInput, tabFilter,
    logScroll, detailPanel, detailInner, detailClose, loggingBanner;

// ── HTML escaping ─────────────────────────────────────────────

function esc(str) {
    return String(str || '')
        .replace(/&/g, '&amp;')
        .replace(/</g, '&lt;')
        .replace(/>/g, '&gt;')
        .replace(/"/g, '&quot;');
}

// ── Filtering ─────────────────────────────────────────────────

function matchesFilter(entry, filter) {
    if (!filter) return true;
    const lower = filter.toLowerCase();
    return (
        (entry.before        || '').toLowerCase().includes(lower) ||
        (entry.after         || '').toLowerCase().includes(lower) ||
        (entry.rule          || '').toLowerCase().includes(lower) ||
        (entry.providerName  || '').toLowerCase().includes(lower) ||
        (entry.patternValue  || '').toLowerCase().includes(lower) ||
        (entry.requestType   || '').toLowerCase().includes(lower) ||
        (entry.requestMethod || '').toLowerCase().includes(lower)
    );
}

function matchesTabFilter(entry) {
    if (selectedTabId === 'all') return true;
    return entry.tabId === selectedTabId;
}

function applyFilter() {
    filteredEntries = allEntries.filter(
        e => matchesFilter(e, filterText) && matchesTabFilter(e)
    );
}

// ── Row rendering ─────────────────────────────────────────────

function buildRow(entry, index) {
    const action   = classifyEntry(entry);
    const url      = entry.before || '';
    const rule     = String(entry.rule || '').replace(/^log_/, '');
    const provider = entry.providerName  || '';
    const pattern  = entry.patternValue  || '';
    const type     = entry.requestType   || '';
    const method   = (entry.requestMethod || '').toUpperCase();

    const tr = document.createElement('tr');
    tr.className   = `action-${action}`;
    tr.dataset.index = index;
    tr.innerHTML = `
        <td class="cell-time">${esc(formatTime(entry.timestamp))}</td>
        <td><span class="badge badge-${action}">${esc(action)}</span></td>
        <td title="${esc(entry.rule || '')}">${esc(rule)}</td>
        <td title="${esc(provider)}">${esc(provider)}</td>
        <td class="cell-pattern" title="${esc(pattern)}">${esc(pattern)}</td>
        <td>${esc(type)}</td>
        <td>${esc(method)}</td>
        <td title="${esc(url)}">${esc(url)}</td>
    `;
    tr.addEventListener('click', () => selectRow(index, tr));
    return tr;
}

// ── Full re-render ────────────────────────────────────────────

function renderAll() {
    logTbody.innerHTML = '';
    selectedIndex = -1;
    detailPanel.classList.remove('open');

    const slice = filteredEntries.slice(-MAX_ENTRIES);
    const frag  = document.createDocumentFragment();
    slice.forEach((entry, i) => frag.appendChild(buildRow(entry, i)));
    logTbody.appendChild(frag);

    updateEmptyState();
    updateStatusBar();
    if (autoScroll) scrollToBottom();
}

// ── Append single live row ────────────────────────────────────

function appendRow(entry) {
    if (!matchesFilter(entry, filterText) || !matchesTabFilter(entry)) return;

    if (logTbody.children.length >= MAX_ENTRIES) {
        logTbody.removeChild(logTbody.firstChild);
        Array.from(logTbody.children).forEach((el, i) => { el.dataset.index = i; });
    }

    const index = filteredEntries.length - 1;
    logTbody.appendChild(buildRow(entry, index));

    updateEmptyState();
    updateStatusBar();
    if (autoScroll) scrollToBottom();
}

// ── Detail panel ──────────────────────────────────────────────

function selectRow(index, trEl) {
    const prev = logTbody.querySelector('tr.selected');
    if (prev) prev.classList.remove('selected');

    if (selectedIndex === index) {
        selectedIndex = -1;
        detailPanel.classList.remove('open');
        return;
    }

    selectedIndex = index;
    trEl.classList.add('selected');

    const entry = filteredEntries[index];
    if (!entry) return;

    const urlChanged  = entry.before !== entry.after;
    const beforeClass = urlChanged ? 'url-before' : 'url-same';
    const afterClass  = urlChanged ? 'url-after'  : 'url-same';

    const fields = [
        ['logger_detail_before',   entry.before,                              beforeClass],
        ['logger_detail_after',    entry.after,                               afterClass],
        ['logger_detail_rule',     entry.rule,                                ''],
        ['logger_detail_provider', entry.providerName,                        ''],
        ['logger_detail_pattern',  entry.patternValue || entry.patternType,   ''],
        ['logger_detail_type',     entry.requestType,                         ''],
        ['logger_detail_method',   entry.requestMethod,                       ''],
        ['logger_detail_time',     new Date(entry.timestamp).toLocaleString(),''],
    ].filter(([, val]) => val);

    detailInner.innerHTML = fields.map(([key, val, cls]) => `
        <div class="detail-field">
            <div class="detail-label">${esc(t(key, key.replace('logger_detail_', '')))}</div>
            <div class="detail-value ${cls}">${esc(val)}</div>
        </div>
    `).join('');

    detailPanel.classList.add('open');
}

// ── Logger helpers ────────────────────────────────────────────

function scrollToBottom() {
    logScroll.scrollTop = logScroll.scrollHeight;
}

function updateEmptyState() {
    emptyState.classList.toggle('visible', filteredEntries.length === 0);
}

function updateStatusBar() {
    const total = allEntries.length;
    const shown = filteredEntries.length;
    const label = t('logger_status_entries', 'entries');
    statusBar.textContent   = (filterText || selectedTabId !== 'all')
        ? `${shown} / ${total} ${label}`
        : `${total} ${label}`;
    footerStatus.textContent = statusBar.textContent;
}

function updateLiveDot() {
    liveDot.classList.toggle('paused',       paused);
    liveDot.classList.toggle('disconnected', port === null);
}

function updateBtnPause() {
    if (paused) {
        btnPause.textContent = t('logger_btn_resume', '▶ Resume');
        btnPause.classList.remove('btn-primary');
        btnPause.classList.add('btn-secondary', 'active');
    } else {
        btnPause.textContent = t('logger_btn_pause', '⏸ Pause');
        btnPause.classList.remove('btn-secondary', 'active');
        btnPause.classList.add('btn-primary');
    }
}

function updateBtnScroll() {
    btnScroll.classList.toggle('active', autoScroll);
}

/**
 * Controls the logging-disabled banner.
 * Marks the banner with 'visible' class when logging is off;
 * actual display is gated by setupViewNavigation on the logger tab.
 */
function updateLoggingBanner() {
    if (!loggingBanner) return;
    loggingBanner.classList.toggle('visible', !loggingEnabled);
    // Only show the banner if we are currently on the logger tab
    const onLoggerTab = document.getElementById('logger-view')?.classList.contains('active');
    loggingBanner.style.display = (!loggingEnabled && onLoggerTab) ? 'block' : 'none';
}

// ── Logger toolbar event listeners ───────────────────────────

function bindLoggerToolbarEvents() {
    btnPause.addEventListener('click', () => {
        paused = !paused;
        updateBtnPause();
        updateLiveDot();
    });

    btnClear.addEventListener('click', () => {
        allEntries      = [];
        filteredEntries = [];
        selectedIndex   = -1;
        detailPanel.classList.remove('open');
        logTbody.innerHTML = '';
        updateEmptyState();
        updateStatusBar();
    });

    btnScroll.addEventListener('click', () => {
        autoScroll = !autoScroll;
        updateBtnScroll();
        if (autoScroll) scrollToBottom();
    });

    filterInput.addEventListener('input', () => {
        filterText = filterInput.value.trim();
        applyFilter();
        renderAll();
    });

    tabFilter.addEventListener('change', () => {
        const val = tabFilter.value;
        selectedTabId = val === 'all' ? 'all' : Number(val);
        applyFilter();
        renderAll();
    });

    // Disable auto-scroll when user scrolls up manually
    logScroll.addEventListener('scroll', () => {
        const nearBottom = logScroll.scrollHeight - logScroll.scrollTop - logScroll.clientHeight < 40;
        if (!nearBottom && autoScroll) {
            autoScroll = false;
            updateBtnScroll();
        }
    });

    detailClose.addEventListener('click', () => {
        detailPanel.classList.remove('open');
        const prev = logTbody.querySelector('tr.selected');
        if (prev) prev.classList.remove('selected');
        selectedIndex = -1;
    });
}

// ── Tab filter management ─────────────────────────────────────

function buildTabLabel(tab) {
    const title = (tab.title || tab.url || `Tab ${tab.id}`).slice(0, 50);
    return `[${tab.id}] ${title}`;
}

function populateTabFilter(tabs) {
    const current = tabFilter.value;
    while (tabFilter.options.length > 1) tabFilter.remove(1);
    tabs
        .filter(t => t.id !== browser.tabs.TAB_ID_NONE)
        .sort((a, b) => a.id - b.id)
        .forEach(tab => {
            const opt = document.createElement('option');
            opt.value       = String(tab.id);
            opt.textContent = buildTabLabel(tab);
            tabFilter.appendChild(opt);
        });
    if (current !== 'all' && [...tabFilter.options].some(o => o.value === current)) {
        tabFilter.value = current;
    } else if (current !== 'all') {
        tabFilter.value = 'all';
        selectedTabId   = 'all';
        applyFilter();
        renderAll();
    }
}

async function loadTabs() {
    try {
        const tabs = await browser.tabs.query({});
        populateTabFilter(tabs);
    } catch (_) {}
}

browser.tabs.onCreated.addListener(() => loadTabs());
browser.tabs.onRemoved.addListener(() => loadTabs());
browser.tabs.onUpdated.addListener((_id, changeInfo) => {
    if (changeInfo.title !== undefined || changeInfo.url !== undefined) loadTabs();
});

// ── Port connection (real-time streaming) ─────────────────────

function connectPort() {
    try {
        port = browser.runtime.connect({ name: 'linkumori-logger' });
    } catch (_) {
        port = null;
        updateLiveDot();
        return;
    }

    updateLiveDot();

    port.onMessage.addListener(msg => {
        if (!msg || msg.type !== 'entry') return;
        if (paused) return;

        const entry = msg.data;
        allEntries.push(entry);
        filteredEntries.push(entry);

        if (allEntries.length > MAX_ENTRIES) {
            allEntries.shift();
            filteredEntries = allEntries.filter(
                e => matchesFilter(e, filterText) && matchesTabFilter(e)
            );
            renderAll();
        } else {
            appendRow(entry);
        }
    });

    port.onDisconnect.addListener(() => {
        port = null;
        updateLiveDot();
        setTimeout(connectPort, 2000);
    });
}

// ── Load historical entries for the live logger ───────────────

async function loadInitialLoggerData() {
    try {
        const [logResp, statusResp] = await Promise.all([
            browser.runtime.sendMessage({ function: 'getData', params: ['log'] }),
            browser.runtime.sendMessage({ function: 'getData', params: ['loggingStatus'] }),
        ]);

        loggingEnabled = !!statusResp?.response;
        updateLoggingBanner();

        const logData = logResp?.response;
        const entries = Array.isArray(logData?.log) ? logData.log : [];

        allEntries = entries;
        applyFilter();
        renderAll();
    } catch (err) {
        console.error('Linkumori logger: failed to load initial data', err);
    }
}

// ── Live logger entry point ───────────────────────────────────

async function initLogger() {
    // DOM refs (safe to read here — DOMContentLoaded has already fired)
    logTbody      = document.getElementById('log-tbody');
    emptyState    = document.getElementById('empty-state');
    statusBar     = document.getElementById('status-bar');
    footerStatus  = document.getElementById('footer-status');
    liveDot       = document.getElementById('live-dot');
    btnPause      = document.getElementById('btn-pause');
    btnClear      = document.getElementById('btn-clear');
    btnScroll     = document.getElementById('btn-scroll');
    filterInput   = document.getElementById('filter-input');
    tabFilter     = document.getElementById('tab-filter');
    logScroll     = document.getElementById('log-scroll-container');
    detailPanel   = document.getElementById('detail-panel');
    detailInner   = document.getElementById('detail-panel-inner');
    detailClose   = document.getElementById('detail-close');
    loggingBanner = document.getElementById('logging-banner');

    // i18n already applied by setI18nText() before initLogger() is called;
    // just sync the dynamic button states that depend on runtime variables.
    updateBtnPause();
    updateBtnScroll();
    updateLiveDot();
    updateEmptyState();
    bindLoggerToolbarEvents();

    await Promise.all([loadInitialLoggerData(), loadTabs()]);
    connectPort();
}

// ══════════════════════════════════════════════════════════════
// SECTION 4 · STORAGE LISTENER + ENTRY POINT
// ══════════════════════════════════════════════════════════════

if (typeof browser !== 'undefined' && browser.storage && browser.storage.onChanged) {
    browser.storage.onChanged.addListener((changes, areaName) => {
        if (areaName !== 'local') return;
        if (changes[THEME_STORAGE_KEY]?.newValue) {
            document.documentElement.setAttribute(
                'data-theme', normalizeTheme(changes[THEME_STORAGE_KEY].newValue));
            syncBootstrapTheme(changes[THEME_STORAGE_KEY].newValue);
        }
    });
}

/**
 * Single DOMContentLoaded entry point.
 * Waits for LinkumoriI18n, then boots both subsystems.
 */
document.addEventListener('DOMContentLoaded', function () {
    LinkumoriI18n.ready().then(() => {
        setI18nText();
        initializeApplication();
        initLogger();
    }).catch(error => {
        console.error('Failed to initialize i18n:', error);
        initializeTheme();

        const errorDiv = document.createElement('div');
        errorDiv.className   = 'error-message';
        errorDiv.textContent = translate('log_i18n_load_failed');
        document.body.appendChild(errorDiv);

        try {
            initializeApplication();
            initLogger();
        } catch (secondaryError) {
            console.error('Critical initialization failure:', secondaryError);
        }
    });
});