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
const {
    THEME_STORAGE_KEY,
    DEFAULT_THEME,
    syncBootstrapTheme,
    normalizeTheme
} = globalThis.LinkumoriTheme;

/**
 * Internationalization helper function
 * Uses browser extension i18n API
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
 * Localize numbers helper function
 */
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

/**
 * Set all i18n text content in the UI
 */
function setI18nText() {
    // Page title
    document.title = translate('log_html_page_title');
    
    // Header
    const pageTitle = document.getElementById('page_title');
    if (pageTitle) pageTitle.textContent = translate('log_html_page_title');
    
    // Apply i18n to all elements with data-i18n attribute (except the timestamp header)
    document.querySelectorAll('[data-i18n]').forEach(element => {
        const key = element.getAttribute('data-i18n');
        const translation = translate(key);
        
        // Skip the timestamp header since it contains the sort button
        if (element.id === 'head_4') {
            return;
        }
        
        if (element.tagName === 'INPUT') {
            element.value = translation;
        } else {
            element.textContent = translation;
        }
    });
    
    // Apply i18n to placeholder attributes
    document.querySelectorAll('[data-i18n-placeholder]').forEach(element => {
        const key = element.getAttribute('data-i18n-placeholder');
        element.placeholder = translate(key);
    });
    
    // Apply i18n to title attributes
    document.querySelectorAll('[data-i18n-title]').forEach(element => {
        const key = element.getAttribute('data-i18n-title');
        element.title = translate(key);
    });
    
    // Set table headers specifically (preserving sort button for timestamp)
    document.getElementById('head_1').textContent = translate('log_html_table_head_1');
    document.getElementById('head_2').textContent = translate('log_html_table_head_2');
    document.getElementById('head_3').textContent = translate('log_html_table_head_3');
    document.getElementById('head_5').textContent = translate('log_html_table_head_5');
    document.getElementById('head_6').textContent = translate('log_html_table_head_6');
    document.getElementById('head_7').textContent = translate('log_html_table_head_7');
    document.getElementById('head_8').textContent = translate('log_html_table_head_8');
    
    // Handle timestamp header specially to preserve sort button
    const timestampHeader = document.getElementById('head_4');
    const sortButton = document.getElementById('time-sort-btn');
    if (timestampHeader && sortButton) {
        // Clear text content but preserve the sort button
        const textNode = document.createTextNode(translate('log_html_table_head_4'));
        // Remove all text nodes but keep the sort button
        Array.from(timestampHeader.childNodes).forEach(node => {
            if (node.nodeType === Node.TEXT_NODE) {
                timestampHeader.removeChild(node);
            }
        });
        // Insert text before the sort button
        timestampHeader.insertBefore(textNode, sortButton);
    }
    
    // Set button texts
    document.getElementById('reset_log_btn_text').textContent = translate('log_html_reset_button');
    document.getElementById('export_log_btn_text').textContent = translate('log_html_export_button');
    document.getElementById('import_log_btn_text').textContent = translate('log_html_import_button');
    
    // Set button titles for accessibility
    document.getElementById('reset_log_btn').setAttribute('title', translate('log_html_reset_button_title'));
    document.getElementById('export_log_btn').setAttribute('title', translate('log_html_export_button_title'));
    document.getElementById('import_log_btn').setAttribute('title', translate('log_html_import_button_title'));
    
    // Localize length selector option display text (preserve values for JavaScript logic)
    const lengthSelect = document.getElementById('length_select');
    if (lengthSelect) {
        Array.from(lengthSelect.options).forEach(option => {
            // Only localize numeric options, skip the "Show All" option
            if (option.value !== '-1' && !isNaN(Number(option.value))) {
                option.textContent = localizeNumber(option.value);
            }
        });
    }
}

/**
 * Reset the global log
 */
function resetGlobalLog() {
    LinkumoriI18n.ready().then(() => {
        modalConfirm(translate('log_html_reset_confirm')).then((confirmed) => {
            if (!confirmed) return;
            let obj = {"log": []};
            browser.runtime.sendMessage({
                function: "setData",
                params: ['log', JSON.stringify(obj)]
            }).then(() => {
                location.reload();
            }).catch(handleError);
        });
    }).catch(error => {
        console.warn('I18n not ready for resetGlobalLog, using fallback');
        modalConfirm(translate('log_html_reset_confirm')).then((confirmed) => {
            if (!confirmed) return;
            let obj = {"log": []};
            browser.runtime.sendMessage({
                function: "setData",
                params: ['log', JSON.stringify(obj)]
            }).then(() => {
                location.reload();
            }).catch(handleError);
        });
    });
}

/**
 * This function exports the global log as a JSON file.
 */
function exportGlobalLog() {
    browser.runtime.sendMessage({
        function: "getData",
        params: ['log']
    }).then((data) => {
        let blob = new Blob([JSON.stringify(data.response, null, 2)], {type: 'application/json'});
        browser.downloads.download({
            'url': URL.createObjectURL(blob),
            'filename': 'ClearURLsLogExport.json',
            'saveAs': true
        }).catch(handleError);
    }).catch(handleError);
}

/**
 * This function imports an exported global log and overwrites the old one.
 */
function importGlobalLog(evt) {
    let file = evt.target.files[0];
    if (!file) return;
    
    let fileReader = new FileReader();

    fileReader.onload = async function(e) {
        LinkumoriI18n.ready().then(() => {
            try {
                // Basic validation to ensure it's a log file
                const importedData = JSON.parse(e.target.result);
                if (!importedData || !Array.isArray(importedData.log)) {
                    throw new Error(translate('log_html_import_error_invalid_format'));
                }
                browser.runtime.sendMessage({
                    function: "setData",
                    params: ["log", e.target.result]
                }).then(() => {
                    location.reload();
                }, handleError);
            } catch(err) {
                modalAlert(translate('log_html_import_error') + `\n${err.message}`);
                handleError(err);
            }
        }).catch(error => {
            console.warn('I18n not ready for importGlobalLog, using fallback');
            try {
                const importedData = JSON.parse(e.target.result);
                if (!importedData || !Array.isArray(importedData.log)) {
                    throw new Error(translate('log_html_import_error_invalid_format'));
                }
                browser.runtime.sendMessage({
                    function: "setData",
                    params: ["log", e.target.result]
                }).then(() => {
                    location.reload();
                }, handleError);
            } catch(err) {
                modalAlert(translate('log_html_import_error') + `\n${err.message}`);
                handleError(err);
            }
        });
    };
    fileReader.readAsText(file);
}

/**
 * Convert timestamp to date string - IMPROVED VERSION
 * Handles both numeric timestamps and localized date strings
 */
function toDate(time) {
    if (!time) return '';
    const parsedMillis = toMillis(time);
    const target = parsedMillis !== null ? parsedMillis : time;
    
    // LinkumoriI18n handles the conversion internally
    if (window.LinkumoriI18n?.isReady()) {
        if (typeof LinkumoriI18n.formatDateTime === 'function') {
            return LinkumoriI18n.formatDateTime(target, {
                dateStyle: 'short',
                timeStyle: 'medium'
            });
        }
        return LinkumoriI18n.formatDate(target, 'DD/MM/YYYY, HH:mm:ss');
    }
    
    // Fallback also handles conversion
    const fallback = new Date(target).toLocaleString();
    return window.LinkumoriI18n && typeof LinkumoriI18n.localizeNumbers === 'function'
        ? LinkumoriI18n.localizeNumbers(fallback)
        : fallback;
}

function normalizeProviderDomainPatterns(providerData) {
    const patterns = [];

    if (Array.isArray(providerData?.domainPatterns)) {
        providerData.domainPatterns.forEach((pattern) => {
            if (typeof pattern === 'string' && pattern.trim()) patterns.push(pattern.trim());
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
        let endAnchor = false;

        if (raw.startsWith('|')) {
            startAnchor = true;
            raw = raw.slice(1);
        }
        if (raw.endsWith('|')) {
            endAnchor = true;
            raw = raw.slice(0, -1);
        }

        return new RegExp(
            (startAnchor ? '^' : '') + linkumoriTokensToRegexSource(raw) + (endAnchor ? '$' : ''),
            'i'
        );
    }

    function firstSpecialIndex(input) {
        const slashIndex = input.indexOf('/');
        const caretIndex = input.indexOf('^');
        const pipeIndex = input.indexOf('|');

        let index = -1;
        if (slashIndex !== -1) index = slashIndex;
        if (caretIndex !== -1 && (index === -1 || caretIndex < index)) index = caretIndex;
        if (pipeIndex !== -1 && (index === -1 || pipeIndex < index)) index = pipeIndex;
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
            if (escaped) {
                escaped = false;
                continue;
            }
            if (ch === '\\') {
                escaped = true;
                continue;
            }
            if (ch === '/') {
                const source = text.slice(1, i);
                const flags = text.slice(i + 1).replace(/[^dgimsuvy]/g, '');
                try {
                    return new RegExp(source, flags.includes('i') ? flags : flags + 'i');
                } catch (e) {
                    return null;
                }
            }
        }

        return null;
    }

    try {
        const urlObj = new URL(url);
        const hostname = urlObj.hostname.toLowerCase();
        const pathTarget = (urlObj.pathname + urlObj.search + urlObj.hash).toLowerCase();
        const fullUrl = url.toLowerCase();

        return patterns.some((pattern) => {
            if (!pattern) return false;
            const p = String(pattern).trim();

            const wildcardDomainToRegex = (patternValue) => {
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

                const hostLabels = hostnameValue.toLowerCase().split('.');
                const baseLabels = base.toLowerCase().split('.');
                const tldCountDirect = hostLabels.length - baseLabels.length;
                const tldCountWithWww = hostLabels.length - (baseLabels.length + 1);

                let directMatch = tldCountDirect >= 1;
                if (directMatch) {
                    for (let i = 0; i < baseLabels.length; i++) {
                        if (hostLabels[i] !== baseLabels[i]) {
                            directMatch = false;
                            break;
                        }
                    }
                    if (directMatch) return true;
                }

                let wwwMatch = tldCountWithWww >= 1 && hostLabels[0] === 'www';
                if (wwwMatch) {
                    for (let i = 0; i < baseLabels.length; i++) {
                        if (hostLabels[i + 1] !== baseLabels[i]) {
                            wwwMatch = false;
                            break;
                        }
                    }
                }
                return wwwMatch;
            };

            const structuredDomainAnchorMatch = (patternValue) => {
                const body = String(patternValue || '').slice(2).trim();
                if (!body) return false;

                const specialIndex = firstSpecialIndex(body);
                const hostExpression = specialIndex === -1 ? body : body.slice(0, specialIndex);
                const tail = specialIndex === -1 ? '' : body.slice(specialIndex);
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
                if (rest.startsWith('^')) {
                    rest = rest.slice(1);
                }
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

function inferProviderMatch(entry, rulesData) {
    const providers = rulesData?.providers;
    if (!providers || typeof providers !== 'object') return null;

    const testUrl = (typeof entry?.before === 'string' && entry.before) ||
        (typeof entry?.after === 'string' && entry.after) ||
        '';
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
            } catch (e) {
                // Ignore invalid pattern and continue trying others.
            }
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
    return arr.filter((item) => typeof item === 'string' && item.trim()).map((item) => item.trim());
}

function resolveLogContext(entry, rulesData = null) {
    if (!entry || typeof entry !== 'object') {
        return {
            providerName: '',
            patternType: '',
            patternValue: '',
            requestMethod: '',
            providerMethods: [],
            requestType: '',
            providerResourceTypes: []
        };
    }

    let providerName = typeof entry.providerName === 'string' ? entry.providerName : '';
    let patternType = typeof entry.patternType === 'string' ? entry.patternType : '';
    let patternValue = typeof entry.patternValue === 'string' ? entry.patternValue : '';
    let requestMethod = typeof entry.requestMethod === 'string'
        ? entry.requestMethod
        : (typeof entry.method === 'string' ? entry.method : '');
    let providerMethods = toCleanStringArray(entry.providerMethods);
    let requestType = typeof entry.requestType === 'string'
        ? entry.requestType
        : (typeof entry.resourceType === 'string'
            ? entry.resourceType
            : (typeof entry.type === 'string' ? entry.type : ''));
    let providerResourceTypes = toCleanStringArray(entry.providerResourceTypes);
    if (!providerResourceTypes.length) {
        providerResourceTypes = toCleanStringArray(entry.resourceTypes);
    }

    const canInferProvider = shouldInferProviderMatch(entry);
    if (canInferProvider && (!providerName || !patternType || !patternValue || !providerMethods.length || !providerResourceTypes.length || !requestType) && rulesData) {
        const inferred = inferProviderMatch(entry, rulesData);
        if (inferred) {
            providerName = providerName || inferred.providerName || '';
            patternType = patternType || inferred.patternType || '';
            patternValue = patternValue || inferred.patternValue || '';
            if (!providerMethods.length) {
                providerMethods = toCleanStringArray(inferred.providerMethods);
            }
            if (!providerResourceTypes.length) {
                providerResourceTypes = toCleanStringArray(inferred.providerResourceTypes);
            }
            if (!requestType && providerResourceTypes.length === 1) {
                requestType = providerResourceTypes[0];
            }
        }
    }

    return {
        providerName,
        patternType,
        patternValue,
        requestMethod,
        providerMethods,
        requestType,
        providerResourceTypes
    };
}

function getPatternText(context) {
    if (!context.patternType && !context.patternValue) return '-';
    let patternTypeLabel = '';
    if (context.patternType === 'urlPattern') {
        patternTypeLabel = translate('log_provider_pattern_url');
    } else if (context.patternType === 'domainPatterns') {
        patternTypeLabel = translate('log_provider_pattern_domain');
    } else if (context.patternType) {
        patternTypeLabel = context.patternType;
    }

    if (patternTypeLabel && context.patternValue) return `${patternTypeLabel}: ${context.patternValue}`;
    return context.patternValue || patternTypeLabel || '-';
}

function getMethodText(context) {
    const requestMethod = context.requestMethod || '';
    const providerMethods = context.providerMethods || [];
    if (!requestMethod && providerMethods.length === 0) return '-';
    if (requestMethod && providerMethods.length) return `${requestMethod} [${providerMethods.join(', ')}]`;
    return requestMethod || providerMethods.join(', ');
}

function getResourceTypeText(context) {
    const requestType = context.requestType || '';
    const providerResourceTypes = context.providerResourceTypes || [];
    if (!requestType && providerResourceTypes.length === 0) return '-';
    if (requestType && providerResourceTypes.length) return `${requestType} [${providerResourceTypes.join(', ')}]`;
    return requestType || providerResourceTypes.join(', ');
}

function getLogSearchBlob(entry, rulesData = null) {
    const context = resolveLogContext(entry, rulesData);
    return [
        entry.before || '',
        entry.after || '',
        entry.rule || '',
        context.providerName || '',
        getPatternText(context),
        getMethodText(context),
        getResourceTypeText(context)
    ].join(' ').toLowerCase();
}


    

    
    // LinkumoriI18n handles the conversion internally

function handleError(error) {
    console.error(`Error: ${error}`);
}

/**
 * Sort logs by timestamp
 */
function sortLogByTime(logs, order = 'desc') {
    return [...logs].sort((a, b) => {
        // Handle both numeric timestamps and string timestamps
        let timeA = a.timestamp || 0;
        let timeB = b.timestamp || 0;
        
        // Convert string timestamps to numbers if possible
        if (typeof timeA === 'string' && !isNaN(Number(timeA))) {
            timeA = Number(timeA);
        } else if (typeof timeA === 'string') {
            // For localized date strings, try to extract a sortable value
            // This is a fallback - ideally we should store numeric timestamps
            timeA = 0;
        }
        
        if (typeof timeB === 'string' && !isNaN(Number(timeB))) {
            timeB = Number(timeB);
        } else if (typeof timeB === 'string') {
            timeB = 0;
        }
        
        return order === 'desc' ? timeB - timeA : timeA - timeB;
    });
}

/**
 * Update sort button appearance
 */
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

/**
 * Initialize theme on page load
 */
function initializeTheme() {
    document.documentElement.setAttribute('data-theme', normalizeTheme(document.documentElement.getAttribute('data-theme') || DEFAULT_THEME));
    browser.storage.local.get([THEME_STORAGE_KEY]).then((result) => {
        const savedTheme = result[THEME_STORAGE_KEY] || DEFAULT_THEME;
        document.documentElement.setAttribute('data-theme', normalizeTheme(savedTheme));
        syncBootstrapTheme(savedTheme);
    }).catch(() => {
        document.documentElement.setAttribute('data-theme', normalizeTheme(DEFAULT_THEME));
        syncBootstrapTheme(DEFAULT_THEME);
    });
}

/**
 * DataTables-style state persistence
 */
function saveState() {
    const state = {
        page: window.currentPage || 1,
        length: parseInt(document.getElementById('length_select').value),
        search: document.getElementById('search_input').value,
        sortOrder: window.sortOrder || 'desc',
        time: Date.now()
    };
    localStorage.setItem('linkumori-log-state', JSON.stringify(state));
}

function loadState() {
    try {
        const saved = localStorage.getItem('linkumori-log-state');
        if (saved) {
            const state = JSON.parse(saved);
            // Only restore if less than 1 hour old (like DataTables)
            if (Date.now() - state.time < 3600000) {
                window.currentPage = state.page || 1;
                window.sortOrder = state.sortOrder || 'desc';
                document.getElementById('length_select').value = state.length || 25;
                document.getElementById('search_input').value = state.search || '';
                return true;
            }
        }
    } catch (e) {
        console.warn('Failed to load pagination state:', e);
    }
    return false;
}

/**
 * Show/hide loading indicator
 */
function showLoading(show = true) {
    const loadingOverlay = document.getElementById('loading-overlay');
    if (loadingOverlay) {
        if (show) {
            loadingOverlay.classList.add('show');
        } else {
            loadingOverlay.classList.remove('show');
        }
    }
}

/**
 * Show user-friendly error message
 */
function showErrorMessage(message) {
    const errorDiv = document.createElement('div');
    errorDiv.className = 'error-message';
    errorDiv.textContent = message;
    errorDiv.style.animation = 'slideIn 0.3s ease';
    
    document.body.appendChild(errorDiv);
    
    // Auto-remove after 5 seconds
    setTimeout(() => {
        if (errorDiv.parentNode) {
            errorDiv.style.animation = 'slideOut 0.3s ease';
            setTimeout(() => {
                if (errorDiv.parentNode) {
                    errorDiv.parentNode.removeChild(errorDiv);
                }
            }, 300);
        }
    }, 5000);
}

function setupViewNavigation(onViewChange = null) {
    const dashboardBtn = document.getElementById('nav-dashboard');
    const logsBtn = document.getElementById('nav-logs');
    const dashboardView = document.getElementById('dashboard-view');
    const logsView = document.getElementById('logs-view');

    if (!dashboardBtn || !logsBtn || !dashboardView || !logsView) {
        return;
    }

    const applyView = (view) => {
        const isDashboard = view === 'dashboard';
        dashboardBtn.classList.toggle('active', isDashboard);
        logsBtn.classList.toggle('active', !isDashboard);
        dashboardView.classList.toggle('active', isDashboard);
        logsView.classList.toggle('active', !isDashboard);
        localStorage.setItem('linkumori-log-view', isDashboard ? 'dashboard' : 'logs');
        if (typeof onViewChange === 'function') {
            onViewChange(isDashboard ? 'dashboard' : 'logs');
        }
    };

    dashboardBtn.addEventListener('click', () => applyView('dashboard'));
    logsBtn.addEventListener('click', () => applyView('logs'));

    const saved = localStorage.getItem('linkumori-log-view');
    applyView(saved === 'logs' ? 'logs' : 'dashboard');
}

function toMillis(value) {
    if (typeof value === 'number' && Number.isFinite(value)) return value;
    if (typeof value === 'string') {
        const trimmed = value.trim();
        const legacyDateMatch = trimmed.match(/^(\d{1,2})\/(\d{1,2})\/(\d{4})(?:,\s*|\s+)(\d{1,2}):(\d{2})(?::(\d{2}))?$/);
        if (legacyDateMatch) {
            const day = Number(legacyDateMatch[1]);
            const month = Number(legacyDateMatch[2]);
            const year = Number(legacyDateMatch[3]);
            const hour = Number(legacyDateMatch[4]);
            const minute = Number(legacyDateMatch[5]);
            const second = Number(legacyDateMatch[6] || 0);
            const asLocal = new Date(year, month - 1, day, hour, minute, second);
            if (!Number.isNaN(asLocal.getTime())) return asLocal.getTime();
        }
        const asNum = Number(value);
        if (!Number.isNaN(asNum) && Number.isFinite(asNum)) return asNum;
        const asDate = Date.parse(value);
        if (!Number.isNaN(asDate)) return asDate;
    }
    return null;
}

function extractHost(rawUrl) {
    if (typeof rawUrl !== 'string' || rawUrl.trim() === '') return null;
    try {
        return new URL(rawUrl).hostname.toLowerCase();
    } catch (_) {
        return null;
    }
}

function getQueryParamNames(rawUrl) {
    if (typeof rawUrl !== 'string' || rawUrl.trim() === '') return [];
    try {
        const url = new URL(rawUrl);
        const keys = new Set();
        url.searchParams.forEach((_, key) => {
            if (key && typeof key === 'string') keys.add(key);
        });
        return Array.from(keys);
    } catch (_) {
        return [];
    }
}

function countTop(items, limit = 10) {
    const counts = new Map();
    items.forEach((item) => {
        if (!item) return;
        counts.set(item, (counts.get(item) || 0) + 1);
    });
    return Array.from(counts.entries())
        .sort((a, b) => b[1] - a[1] || String(a[0]).localeCompare(String(b[0])))
        .slice(0, limit);
}

function formatStatsDateKey(dateKey) {
    if (typeof dateKey !== 'string' || dateKey.length !== 10) {
        return dateKey;
    }

    const asMillis = Date.parse(`${dateKey}T00:00:00`);
    if (Number.isNaN(asMillis)) {
        return dateKey;
    }

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

function renderStatsRows(tbodyId, rows, emptyLabel = '', localizeFirstColumnAsDate = false) {
    const tbody = document.getElementById(tbodyId);
    if (!tbody) return;
    tbody.innerHTML = '';
    if (rows.length === 0) {
        const tr = document.createElement('tr');
        const td1 = document.createElement('td');
        const td2 = document.createElement('td');
        td1.textContent = emptyLabel || translate('datatable_empty_table');
        td2.textContent = localizeNumber(0);
        tr.appendChild(td1);
        tr.appendChild(td2);
        tbody.appendChild(tr);
        return;
    }
    rows.forEach(([name, count]) => {
        const tr = document.createElement('tr');
        const td1 = document.createElement('td');
        const td2 = document.createElement('td');
        const firstColumnText = localizeFirstColumnAsDate ? formatStatsDateKey(String(name)) : String(name);
        td1.textContent = firstColumnText;
        td2.textContent = localizeNumber(count);
        tr.appendChild(td1);
        tr.appendChild(td2);
        tbody.appendChild(tr);
    });
}

function getThemeColor(name, fallback) {
    const value = getComputedStyle(document.documentElement).getPropertyValue(name);
    const trimmed = typeof value === 'string' ? value.trim() : '';
    return trimmed || fallback;
}

function getChartPalette() {
    return [
        '#2563eb', '#16a34a', '#dc2626', '#f59e0b', '#7c3aed',
        '#0ea5e9', '#14b8a6', '#ef4444', '#84cc16', '#f97316'
    ];
}

function drawPieChart(ctx, width, height, labels, values) {
    const regions = [];
    const total = values.reduce((a, b) => a + b, 0);
    const cx = width * 0.35;
    const cy = height * 0.5;
    const r = Math.min(width, height) * 0.28;
    const palette = getChartPalette();
    let start = -Math.PI / 2;

    if (total <= 0) {
        return regions;
    }

    values.forEach((value, index) => {
        const from = start;
        const angle = (value / total) * Math.PI * 2;
        ctx.beginPath();
        ctx.moveTo(cx, cy);
        ctx.arc(cx, cy, r, start, start + angle);
        ctx.closePath();
        ctx.fillStyle = palette[index % palette.length];
        ctx.fill();
        start += angle;

        regions.push({
            kind: 'slice',
            label: labels[index],
            value,
            contains(x, y) {
                const dx = x - cx;
                const dy = y - cy;
                const dist = Math.sqrt(dx * dx + dy * dy);
                if (dist > r) return false;
                let a = Math.atan2(dy, dx);
                if (a < 0) a += Math.PI * 2;
                let nFrom = from;
                let nTo = from + angle;
                while (nFrom < 0) {
                    nFrom += Math.PI * 2;
                    nTo += Math.PI * 2;
                }
                if (a < nFrom) a += Math.PI * 2;
                return a >= nFrom && a <= nTo;
            }
        });
    });

    // Legend
    const legendX = width * 0.65;
    let legendY = height * 0.2;
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
            kind: 'legend',
            index,
            label,
            value: values[index],
            x: legendX,
            y: rowY,
            w: Math.max(120, width - legendX - 8),
            h: 14,
            contains(x, y) {
                return x >= this.x && x <= this.x + this.w && y >= this.y && y <= this.y + this.h;
            }
        });
        legendY += 18;
    });

    return regions;
}

function renderStatsChart(topRulesSeries) {
    const canvas = document.getElementById('stats-chart-canvas');
    const typeSelect = document.getElementById('stats-chart-type');
    const chartWrap = canvas ? canvas.closest('.chart-wrap') : null;
    if (!canvas || !typeSelect) return;

    const rect = canvas.getBoundingClientRect();
    const dpr = window.devicePixelRatio || 1;
    const width = Math.max(320, Math.floor(rect.width || 800));
    const height = Math.max(220, Math.floor(rect.height || 280));
    canvas.width = Math.floor(width * dpr);
    canvas.height = Math.floor(height * dpr);
    const ctx = canvas.getContext('2d');
    if (!ctx) return;
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    ctx.clearRect(0, 0, width, height);

    const chartState = window.__logChartState || { hiddenPieIndexes: new Set() };
    if (!(chartState.hiddenPieIndexes instanceof Set)) {
        chartState.hiddenPieIndexes = new Set();
    }
    chartState.type = 'pie';
    chartState.topRulesSeries = topRulesSeries;

    const activeSeries = topRulesSeries.filter((_, idx) => !chartState.hiddenPieIndexes.has(idx));
    const labels = activeSeries.map(([label]) => label);
    const values = activeSeries.map(([, value]) => value);
    const total = values.reduce((sum, val) => sum + (Number(val) || 0), 0);
    if (chartWrap) chartWrap.classList.toggle('is-empty', total <= 0);
    if (total <= 0) {
        chartState.regions = [];
        chartState.pieVisibleMap = [];
        window.__logChartState = chartState;
        return;
    }
    const regions = drawPieChart(ctx, width, height, labels, values);
    chartState.regions = regions;
    chartState.pieVisibleMap = activeSeries.map((item) => topRulesSeries.findIndex((x) => x[0] === item[0] && x[1] === item[1]));
    window.__logChartState = chartState;
}

function renderOverallStats(logs, clearUrlsData = null) {
    const safeLogs = Array.isArray(logs) ? logs : [];
    const contexts = safeLogs.map((entry) => resolveLogContext(entry, clearUrlsData));
    const totalEntries = safeLogs.length;
    const changedEntries = safeLogs.filter((x) => (x?.before || '') !== (x?.after || '')).length;
    const rules = safeLogs.map((x) => (typeof x?.rule === 'string' ? x.rule : null)).filter(Boolean);
    const domains = safeLogs.map((x) => extractHost(x?.before)).filter(Boolean);
    const timestamps = safeLogs.map((x) => toMillis(x?.timestamp)).filter((x) => x != null);
    const providers = contexts.map((c) => c.providerName).filter(Boolean);
    const requestMethods = contexts.map((c) => c.requestMethod).filter(Boolean);
    const requestTypes = contexts.map((c) => c.requestType).filter(Boolean);

    const fallbackMethods = [];
    const fallbackResourceTypes = [];
    contexts.forEach((context) => {
        if (!context.requestMethod && Array.isArray(context.providerMethods) && context.providerMethods.length) {
            fallbackMethods.push(...context.providerMethods);
        }
        if (!context.requestType && Array.isArray(context.providerResourceTypes) && context.providerResourceTypes.length) {
            fallbackResourceTypes.push(...context.providerResourceTypes);
        }
    });

    const methodsForStats = requestMethods.length ? requestMethods : fallbackMethods;
    const resourceTypesForStats = requestTypes.length ? requestTypes : fallbackResourceTypes;

    const setText = (id, value) => {
        const el = document.getElementById(id);
        if (el) el.textContent = value;
    };

    setText('stats-total-entries', localizeNumber(totalEntries));
    setText('stats-changed-entries', localizeNumber(changedEntries));
    setText('stats-unique-rules', localizeNumber(new Set(rules).size));
    setText('stats-unique-domains', localizeNumber(new Set(domains).size));
    setText('stats-unique-providers', localizeNumber(new Set(providers).size));
    setText('stats-unique-methods', localizeNumber(new Set(methodsForStats).size));
    setText('stats-unique-resource-types', localizeNumber(new Set(resourceTypesForStats).size));
    setText('stats-earliest', timestamps.length ? toDate(Math.min(...timestamps)) : '-');
    setText('stats-latest', timestamps.length ? toDate(Math.max(...timestamps)) : '-');

    const topRulesSeries = countTop(rules, 10);
    const topDomainsSeries = countTop(domains, 10);
    const topProvidersSeries = countTop(providers, 10);
    const topMethodsSeries = countTop(methodsForStats, 10);
    const topResourceTypesSeries = countTop(resourceTypesForStats, 10);

    renderStatsRows('stats-top-rules', topRulesSeries, translate('log_stats_no_rules'));
    renderStatsRows('stats-top-domains', topDomainsSeries, translate('log_stats_no_domains'));
    renderStatsRows('stats-top-providers', topProvidersSeries, translate('log_stats_no_providers'));
    renderStatsRows('stats-top-methods', topMethodsSeries, translate('log_stats_no_methods'));
    renderStatsRows('stats-top-resource-types', topResourceTypesSeries, translate('log_stats_no_resource_types'));
    renderStatsChart(topRulesSeries);
}

/**
 * DataTables pagination logic with responsive button count
 */
function getPageNumbers(totalPages, currentPage, maxButtons = 7) {
    const pages = [];
    const half = Math.floor(maxButtons / 2);
    const showFirstLast = maxButtons >= 5;
    
    // Helper function to create range of numbers
    function range(start, end) {
        const result = [];
        for (let i = start; i < end; i++) {
            result.push(i);
        }
        return result;
    }
    
    // If total pages fit within max buttons, show all
    if (totalPages <= maxButtons) {
        return range(1, totalPages + 1);
    }
    
    // Handle special cases for mobile/small screens
    if (maxButtons === 3) {
        if (currentPage <= 1) {
            return [1, 2, '...'];
        } else if (currentPage >= totalPages) {
            return ['...', totalPages - 1, totalPages];
        } else {
            return ['...', currentPage, '...'];
        }
    }
    
    if (maxButtons === 5) {
        if (currentPage <= 2) {
            return [1, 2, 3, '...', totalPages];
        } else if (currentPage >= totalPages - 1) {
            return [1, '...', totalPages - 2, totalPages - 1, totalPages];
        } else {
            return [1, '...', currentPage, '...', totalPages];
        }
    }
    
    // Main logic for larger button counts (DataTables standard)
    const boundarySize = showFirstLast ? 2 : 1;
    const leftOffset = showFirstLast ? 1 : 0;
    
    if (currentPage <= half) {
        // Near the beginning
        pages.push(...range(1, maxButtons - boundarySize + 1));
        pages.push('...');
        if (showFirstLast) {
            pages.push(totalPages);
        }
    } else if (currentPage >= totalPages - half) {
        // Near the end
        if (showFirstLast) {
            pages.push(1);
        }
        pages.push('...');
        pages.push(...range(totalPages - (maxButtons - boundarySize) + 1, totalPages + 1));
    } else {
        // In the middle
        if (showFirstLast) {
            pages.push(1);
        }
        pages.push('...');
        pages.push(...range(currentPage - half + leftOffset, currentPage + half - leftOffset + 1));
        pages.push('...');
        if (showFirstLast) {
            pages.push(totalPages);
        }
    }
    
    return pages;
}

/**
 * Create properly styled pagination button with CSS classes
 * NOW WITH LOCALIZED NUMBERS!
 */
function createPaginationButton(text, onClick, action = null) {
    const button = document.createElement('button');
    
    // Localize the button text if it's a number
    if (typeof text === 'number' || (typeof text === 'string' && !isNaN(Number(text)))) {
        button.textContent = localizeNumber(text);
    } else {
        button.textContent = text;
    }
    
    button.className = 'pagination-btn';
    button.addEventListener('click', onClick);
    if (action) {
        button.setAttribute('data-action', action);
    }
    
    return button;
}

/**
 * Show language change status message
 */
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
        
        // Auto-hide after 3 seconds
        setTimeout(() => {
            statusElement.style.display = 'none';
        }, 3000);
    }).catch(error => {
        console.warn('I18n not ready for showLanguageChangeStatus');
    });
}

/**
 * Initialize the main application
 * This function contains all the main application logic that needs to run after i18n is ready
 */
function initializeApplication() {
    // Initialize theme first (doesn't need i18n)
    initializeTheme();

    // --- State variables ---
    let fullLog = [];
    let clearUrlsData = null;
    window.currentPage = 1;
    window.sortOrder = 'desc'; // Default to newest first

    // --- DOM element references ---
    const tbody = document.getElementById('tbody');
    const searchInput = document.getElementById('search_input');
    const lengthSelect = document.getElementById('length_select');
    const paginationInfo = document.getElementById('pagination-info');
    const paginationControls = document.getElementById('pagination-controls');
    const timeSortBtn = document.getElementById('time-sort-btn');
    const statsChartReload = document.getElementById('stats-chart-reload');
    const statsChartCanvas = document.getElementById('stats-chart-canvas');
    const statsChartTooltip = document.getElementById('stats-chart-tooltip');
    const dashboardView = document.getElementById('dashboard-view');

    const rerenderChartWhenVisible = () => {
        if (!dashboardView || !dashboardView.classList.contains('active')) {
            return;
        }
        const chartState = window.__logChartState;
        if (!chartState) {
            return;
        }
        requestAnimationFrame(() => {
            renderStatsChart(chartState.topRulesSeries || []);
        });
    };

    setupViewNavigation((view) => {
        if (view === 'dashboard') {
            rerenderChartWhenVisible();
        }
    });

    window.addEventListener('resize', rerenderChartWhenVisible);

    // Handle sort button click
    if (timeSortBtn) {
        timeSortBtn.addEventListener('click', function(e) {
            e.stopPropagation();
            window.sortOrder = window.sortOrder === 'desc' ? 'asc' : 'desc';
            updateSortButton(window.sortOrder);
            window.currentPage = 1; // Reset to first page when sorting
            renderTable();
        });
    }

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

    if (statsChartCanvas && statsChartTooltip) {
        const showTooltip = (x, y, text) => {
            statsChartTooltip.textContent = text;
            statsChartTooltip.style.left = `${x}px`;
            statsChartTooltip.style.top = `${y}px`;
            statsChartTooltip.style.opacity = '1';
        };
        const hideTooltip = () => {
            statsChartTooltip.style.opacity = '0';
        };

        statsChartCanvas.addEventListener('mousemove', (evt) => {
            const state = window.__logChartState;
            if (!state || !Array.isArray(state.regions)) {
                hideTooltip();
                return;
            }
            const rect = statsChartCanvas.getBoundingClientRect();
            const x = evt.clientX - rect.left;
            const y = evt.clientY - rect.top;
            const hit = state.regions.find((region) => typeof region.contains === 'function' && region.contains(x, y));
            if (!hit) {
                hideTooltip();
                statsChartCanvas.style.cursor = 'default';
                return;
            }
            statsChartCanvas.style.cursor = hit.kind === 'legend' ? 'pointer' : 'crosshair';
            showTooltip(x, y, `${hit.label}: ${localizeNumber(hit.value)}`);
        });

        statsChartCanvas.addEventListener('mouseleave', () => {
            hideTooltip();
            statsChartCanvas.style.cursor = 'default';
        });

        statsChartCanvas.addEventListener('click', (evt) => {
            const state = window.__logChartState;
            if (!state || state.type !== 'pie' || !Array.isArray(state.regions)) return;
            const rect = statsChartCanvas.getBoundingClientRect();
            const x = evt.clientX - rect.left;
            const y = evt.clientY - rect.top;
            const hit = state.regions.find((region) => region.kind === 'legend' && region.contains(x, y));
            if (!hit) return;

            const originalIndex = state.pieVisibleMap?.[hit.index];
            if (originalIndex == null) return;

            if (state.hiddenPieIndexes.has(originalIndex)) {
                state.hiddenPieIndexes.delete(originalIndex);
            } else {
                state.hiddenPieIndexes.add(originalIndex);
            }
            window.__logChartState = state;
            renderStatsChart(state.topRulesSeries || []);
        });
    }

    // Enhanced renderTable with loading states and sorting
    function renderTable() {
        showLoading(true);
        
        // Use setTimeout to allow UI to update before heavy computation
        setTimeout(() => {
            LinkumoriI18n.ready().then(() => {
                try {
                    // 1. Sort by timestamp first
                    const sortedLog = sortLogByTime(fullLog, window.sortOrder);

                    // 2. Filter
                    const searchTerm = searchInput.value.toLowerCase();
                    const filteredLog = searchTerm
                        ? sortedLog.filter(entry => getLogSearchBlob(entry, clearUrlsData).includes(searchTerm))
                        : sortedLog;

                    // 3. Paginate
                    const itemsPerPage = parseInt(lengthSelect.value, 10);
                    const totalItems = filteredLog.length;
                    const totalPages = Math.ceil(totalItems / itemsPerPage) || 1;
                    if (window.currentPage > totalPages) {
                        window.currentPage = totalPages;
                    }

                    const startIndex = (window.currentPage - 1) * itemsPerPage;
                    const endIndex = startIndex + itemsPerPage;
                    const paginatedLog = itemsPerPage === -1 ? filteredLog : filteredLog.slice(startIndex, endIndex);

                    // 4. Render Table Rows
                    tbody.innerHTML = '';
                    if (paginatedLog.length === 0) {
                        const row = tbody.insertRow();
                        row.className = 'empty-row';
                        const cell = row.insertCell(0);
                        cell.colSpan = 8;
                        cell.textContent = searchTerm ? translate('datatable_zero_records') : translate('datatable_empty_table');
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
                    
                    // 5. Render Pagination Controls
                    if (itemsPerPage !== -1) {
                        renderPagination(totalItems, totalPages, startIndex, Math.min(endIndex, totalItems));
                    } else {
                        // Show all entries, no pagination needed - WITH LOCALIZED NUMBERS
                        paginationInfo.textContent = translate('datatable_showing_all', [localizeNumber(totalItems)]);
                        paginationControls.innerHTML = '';
                    }
                    
                    showLoading(false);
                    saveState(); // Save state after successful render
                } catch (error) {
                    showLoading(false);
                    handleError(error);
                    showErrorMessage(translate('error_rendering_table'));
                }
            }).catch(error => {
                console.warn('I18n not ready for renderTable, using fallback');
                try {
                    // Fallback rendering without translations
                    const sortedLog = sortLogByTime(fullLog, window.sortOrder);
                    const searchTerm = searchInput.value.toLowerCase();
                    const filteredLog = searchTerm
                        ? sortedLog.filter(entry => getLogSearchBlob(entry, clearUrlsData).includes(searchTerm))
                        : sortedLog;

                    const itemsPerPage = parseInt(lengthSelect.value, 10);
                    const totalItems = filteredLog.length;
                    const totalPages = Math.ceil(totalItems / itemsPerPage) || 1;
                    if (window.currentPage > totalPages) {
                        window.currentPage = totalPages;
                    }

                    const startIndex = (window.currentPage - 1) * itemsPerPage;
                    const endIndex = startIndex + itemsPerPage;
                    const paginatedLog = itemsPerPage === -1 ? filteredLog : filteredLog.slice(startIndex, endIndex);

                    tbody.innerHTML = '';
                    if (paginatedLog.length === 0) {
                        const row = tbody.insertRow();
                        row.className = 'empty-row';
                        const cell = row.insertCell(0);
                        cell.colSpan = 8;
                        cell.textContent = searchTerm ? translate('datatable_zero_records') : translate('datatable_empty_table');
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
    
    function renderPagination(totalItems, totalPages, startIndex, endIndex) {
        LinkumoriI18n.ready().then(() => {
            // Update info text - WITH LOCALIZED NUMBERS!
            if (totalItems === 0) {
                paginationInfo.textContent = translate('datatable_info_empty');
            } else {
                const start = startIndex + 1;
                const end = Math.min(endIndex, totalItems);
                paginationInfo.textContent = translate('datatable_showing_entries', [
                    localizeNumber(start), 
                    localizeNumber(end), 
                    localizeNumber(totalItems)
                ]);
            }
            
        
        // Clear old controls
        paginationControls.innerHTML = '';
        if (totalPages <= 1) return;

        // DataTables responsive pagination: Adjust button count based on screen width
        const containerWidth = paginationControls.offsetWidth || window.innerWidth;
        let maxButtons = 7; // Default DataTables standard
        
        // Responsive button count like DataTables
        if (containerWidth < 480) {
            maxButtons = 3; // Mobile: Previous, Current, Next
        } else if (containerWidth < 768) {
            maxButtons = 5; // Tablet: Fewer buttons
        }

        // "First" button with DataTables styling
        const firstButton = createPaginationButton(translate('pagination_first'), () => {
            if (window.currentPage > 1) {
                window.currentPage = 1;
                renderTable();
            }
        });
        firstButton.setAttribute('aria-label', translate('pagination_first_aria'));
        firstButton.setAttribute('data-dt-idx', 'first');
        if (window.currentPage === 1) firstButton.disabled = true;
        paginationControls.appendChild(firstButton);

        // "Previous" button with accessibility
        const prevButton = createPaginationButton(translate('pagination_previous'), () => {
            if (window.currentPage > 1) {
                window.currentPage--;
                renderTable();
            }
        });
        prevButton.setAttribute('aria-label', translate('pagination_previous_aria'));
        prevButton.setAttribute('data-dt-idx', 'previous');
        if (window.currentPage === 1) prevButton.disabled = true;
        paginationControls.appendChild(prevButton);

        // Page number buttons with DataTables logic (responsive count)
        const pages = getPageNumbers(totalPages, window.currentPage, maxButtons);
        pages.forEach((page, index) => {
            if (page === '...') {
                const ellipsis = document.createElement('span');
                ellipsis.textContent = '…'; // Using proper ellipsis character
                ellipsis.className = 'pagination-ellipsis';
                ellipsis.setAttribute('aria-hidden', 'true');
                paginationControls.appendChild(ellipsis);
            } else {
                const pageButton = createPaginationButton(page, () => {
                    if (window.currentPage !== page) {
                        window.currentPage = page;
                        renderTable();
                    }
                });
                
                // DataTables accessibility attributes
                pageButton.setAttribute('aria-label', translate('pagination_page_aria', [localizeNumber(page)]));
                pageButton.setAttribute('data-dt-idx', page);
                
                if (page === window.currentPage) {
                    pageButton.classList.add('active');
                    pageButton.disabled = true;
                    pageButton.setAttribute('aria-current', 'page');
                    pageButton.setAttribute('aria-label', translate('pagination_current_page_aria', [localizeNumber(page)]));
                }
                paginationControls.appendChild(pageButton);
            }
        });

        // "Next" button with accessibility
        const nextButton = createPaginationButton(translate('pagination_next'), () => {
            if (window.currentPage < totalPages) {
                window.currentPage++;
                renderTable();
            }
        });
        nextButton.setAttribute('aria-label', translate('pagination_next_aria'));
        nextButton.setAttribute('data-dt-idx', 'next');
        if (window.currentPage === totalPages) nextButton.disabled = true;
        paginationControls.appendChild(nextButton);

        // "Last" button with accessibility
        const lastButton = createPaginationButton(translate('pagination_last'), () => {
            if (window.currentPage < totalPages) {
                window.currentPage = totalPages;
                renderTable();
            }
        });
        lastButton.setAttribute('aria-label', translate('pagination_last_aria'));
        lastButton.setAttribute('data-dt-idx', 'last');
        if (window.currentPage === totalPages) lastButton.disabled = true;
        paginationControls.appendChild(lastButton);
    }
        )}

    // --- Event Listeners ---
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

    // --- Initial data fetch with state restoration ---
    const stateRestored = loadState(); // Try to restore previous state
    
    // Initialize sort button appearance
    updateSortButton(window.sortOrder);
    
    Promise.all([
        browser.runtime.sendMessage({ function: "getData", params: ['log'] }),
        browser.runtime.sendMessage({ function: "getData", params: ['ClearURLsData'] })
    ])
        .then(([logData, rulesData]) => {
            if (logData && logData.response && Array.isArray(logData.response.log)) {
                fullLog = logData.response.log;
            } else {
                fullLog = [];
            }
            clearUrlsData = rulesData?.response || null;

            renderOverallStats(fullLog, clearUrlsData);
            
            // If state was restored, ensure current page is valid
            if (stateRestored) {
                const itemsPerPage = parseInt(lengthSelect.value, 10);
                if (itemsPerPage !== -1) {
                    const maxPages = Math.ceil(fullLog.length / itemsPerPage);
                    if (window.currentPage > maxPages) {
                        window.currentPage = Math.max(1, maxPages);
                    }
                }
            }
            
            renderTable(); // Initial render
        })
        .catch(error => {
            handleError(error);
            fullLog = [];
            clearUrlsData = null;
            renderOverallStats(fullLog, clearUrlsData);
            renderTable();
            
            // Show user-friendly error message
            LinkumoriI18n.ready().then(() => {
                showErrorMessage(translate('error_loading_data'));
            }).catch(() => {
                showErrorMessage(translate('error_loading_data'));
            });
        });
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

// Main application entry point using Promise-based LinkumoriI18n.ready()
document.addEventListener('DOMContentLoaded', function() {
    // Wait for LinkumoriI18n to be ready using promise-based approach
    LinkumoriI18n.ready().then(() => {
        // Set all i18n text first
        setI18nText();
        
        // Now initialize the entire application
        initializeApplication();
        
    }).catch(error => {
        console.error('Failed to initialize i18n:', error);
        
        // Fallback: Initialize basic functionality without proper i18n
        initializeTheme();
        
        // Show error message to user
        const errorMessage = document.createElement('div');
        errorMessage.className = 'error-message';
        errorMessage.textContent = translate('log_i18n_load_failed');
        document.body.appendChild(errorMessage);
        
        // Try to initialize basic functionality anyway
        try {
            initializeApplication();
        } catch (secondaryError) {
            console.error('Critical initialization failure:', secondaryError);
        }
    });
});
