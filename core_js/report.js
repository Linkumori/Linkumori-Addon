/*
 * ============================================================
 * Linkumori — report.js
 * ============================================================
 * Copyright (c) 2025-2026 Subham Mahesh
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
 * 2025-05-16   Subham Mahesh   Modified report script
 * 2025-05-16   Subham Mahesh   Modified report script
 * 2025-05-16   Subham Mahesh   Modified report script
 * 2025-05-16   Subham Mahesh   Modified report script
 * 2025-05-16   Subham Mahesh   Modified report script
 * 2025-05-17   Subham Mahesh   Modified report script
 * 2025-05-17   Subham Mahesh   Modified report script
 * 2025-05-25   Subham Mahesh   Modified report script
 * 2025-06-13   Subham Mahesh   Modified report script
 * 2026-05-21   Subham Mahesh   Adapted report script for Linkumori i18n and themes
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


/******************************************************************************/

// DOM Helper Functions
function $(selector) {
    return document.querySelector(selector);
}

function getReportI18n() {
    return (typeof globalThis !== 'undefined' && globalThis.LinkumoriI18n)
        ? globalThis.LinkumoriI18n
        : null;
}

async function waitForReportI18n() {
    const i18n = getReportI18n();
    if (!i18n || typeof i18n.ready !== 'function') {
        return null;
    }

    try {
        await i18n.ready();
        return i18n;
    } catch (error) {
        return null;
    }
}

function t(key, substitutions, fallback = '') {
    const i18n = getReportI18n();
    if (
        i18n &&
        typeof i18n.getMessage === 'function' &&
        (!i18n.isReady || i18n.isReady())
    ) {
        const value = i18n.getMessage(key, substitutions);
        if (value && value !== key) {
            return value;
        }
    }

    try {
        if (typeof browser !== 'undefined' && browser.i18n) {
            const value = browser.i18n.getMessage(key, substitutions);
            if (value) {
                return value;
            }
        }
    } catch (error) {
    }

    return fallback || key;
}

function tHtml(key, substitutions, fallback = '') {
    return t(key, substitutions, fallback);
}

function createElement(tag, attributes = {}, textContent = '') {
    const element = document.createElement(tag);
    
    for (const [key, value] of Object.entries(attributes)) {
        element.setAttribute(key, value);
    }
    
    if (textContent) {
        element.textContent = textContent;
    }
    
    return element;
}

/******************************************************************************/

const CONFIG_SECTION_DEFINITIONS = [
    {
        id: 'extension',
        labelKey: 'report_share_extension_info'
    },
    {
        id: 'settings',
        labelKey: 'report_share_settings_info'
    },
    {
        id: 'whitelist',
        labelKey: 'report_share_whitelist_info'
    },
    {
        id: 'customRules',
        labelKey: 'report_share_custom_rules_info'
    },
    {
        id: 'disabledRules',
        labelKey: 'report_share_disabled_rules_info'
    }
];

const DEFAULT_CONFIG_SECTION_SELECTION = CONFIG_SECTION_DEFINITIONS.reduce((selection, section) => {
    selection[section.id] = true;
    return selection;
}, {});

let reportConfigSections = null;

function getConfigSectionLabel(sectionId) {
    const definition = CONFIG_SECTION_DEFINITIONS.find(section => section.id === sectionId);
    return definition ? t(definition.labelKey) : sectionId;
}

function getConfigShareSelection() {
    return CONFIG_SECTION_DEFINITIONS.reduce((selection, section) => {
        const input = document.querySelector(`[data-config-section="${section.id}"]`);
        selection[section.id] = input ? input.checked : DEFAULT_CONFIG_SECTION_SELECTION[section.id];
        return selection;
    }, {});
}

function filterConfigSections(configSections, selection = DEFAULT_CONFIG_SECTION_SELECTION) {
    return Object.entries(configSections).reduce((selected, [sectionId, value]) => {
        if (selection[sectionId]) {
            selected[getConfigSectionLabel(sectionId)] = value;
        }

        return selected;
    }, {});
}

function renderConfigData(configSections, selection = DEFAULT_CONFIG_SECTION_SELECTION) {
    const selectedConfig = filterConfigSections(configSections, selection);

    if (Object.keys(selectedConfig).length === 0) {
        return t('report_no_config_shared');
    }

    return renderData(selectedConfig);
}

function updateConfigPreview() {
    if (!reportConfigSections) {
        return;
    }

    const configData = $('#configData');
    if (configData) {
        configData.textContent = renderConfigData(reportConfigSections, getConfigShareSelection());
    }
}

// Enhanced reportedPage function to handle dropdown options
const reportedPage = (function() {
    const url = new URL(window.location.href);
    try {
        const pageURL = url.searchParams.get('url');
        if (pageURL === null) { return null; }
        
        const parsedURL = new URL(pageURL);
        parsedURL.username = '';
        parsedURL.password = '';
        parsedURL.hash = '';
        
        // Create URL variations for dropdown options
        const originalUrl = parsedURL.href;
        
        // Base domain URL
        const baseUrl = new URL(parsedURL.href);
        baseUrl.pathname = '/';
        baseUrl.search = '';
        
        return {
            hostname: parsedURL.hostname.replace(/^(m|mobile|www)\./, ''),
            cleanedUrl: url.searchParams.get('cleanedUrl'),
            originalUrl: pageURL,
            baseUrl: baseUrl.href
        };
    } catch (error) {
        console.error('Error processing URL parameters:', error);
        const errorMsg = createElement('p', { class: 'error' }, 
            'Error processing URL: ' + error.message);
        document.querySelector('section').prepend(errorMsg);
    }
    return null;
})();

/******************************************************************************/

// Function to populate the URL dropdown with actual values
function populateUrlDropdown() {
    const urlSelect = $('#urlSelect');
    
    // Clear existing options
    urlSelect.innerHTML = '';
    
    if (reportedPage) {
        // Add the full URL option
        const originalOption = createElement('option');
        originalOption.value = 'original';
        originalOption.textContent = reportedPage.originalUrl;
        urlSelect.appendChild(originalOption);
        
        // Add the domain-only option
        const domainOption = createElement('option');
        domainOption.value = 'domain';
        domainOption.textContent = reportedPage.baseUrl;
        urlSelect.appendChild(domainOption);
    }
    
    // Add the custom URL option
    const customOption = createElement('option');
    customOption.value = 'custom';
    customOption.textContent = t('enterCustomUrl', undefined, 'Enter custom URL');
    urlSelect.appendChild(customOption);
}

/******************************************************************************/

function getIssueType() {
    return $('#issueTypeSelect').value;
}

/******************************************************************************/

// Function to update URL displayed based on dropdown selection
function handleUrlDropdownChange() {
    const urlSelect = $('#urlSelect');
    const customUrlContainer = $('#customUrlContainer');
    
    if (urlSelect.value === 'custom') {
        // Show custom URL input field
        customUrlContainer.style.display = 'block';
        $('#customUrlInput').focus();
    } else {
        // Hide custom URL input field
        customUrlContainer.style.display = 'none';
    }
}

// Function to get the selected URL (for report submission)
function getSelectedUrl() {
    const urlSelect = $('#urlSelect');
    
    if (!reportedPage) {
        return $('#customUrlInput').value.trim();
    }
    
    switch (urlSelect.value) {
        case 'original':
            return reportedPage.originalUrl;
        case 'domain':
            return reportedPage.baseUrl;
        case 'custom':
            return $('#customUrlInput').value.trim();
        default:
            return reportedPage.originalUrl;
    }
}

/******************************************************************************/

// Update the updateURLSelectVisibility function
function updateURLSelectVisibility() {
    const issueType = getIssueType();
    const urlRelatedTypes = [
        'tracking-not-removed',
        'url-broken',
        'false-positive'
    ];
    
    const nonUrlTypes = [
        'performance',
        'ui-issue',
        'feature-request',
        'rule-suggestion'
    ];
    
    const urlContainer = document.querySelector('.url-input-container');
    const nsfwContainer = document.querySelector('.nsfw-container');
    
    if (urlRelatedTypes.includes(issueType)) {
        // For URL-related issue types, show URL options and NSFW checkbox
        urlContainer.style.display = 'block';
        nsfwContainer.style.display = 'block';
    } else if (nonUrlTypes.includes(issueType)) {
        // For non-URL related issues, hide both URL input and NSFW checkbox
        urlContainer.style.display = 'none';
        nsfwContainer.style.display = 'none';
        // Reset NSFW checkbox when switching to non-URL issues
        if (document.getElementById('isNSFW')) {
            document.getElementById('isNSFW').checked = false;
        }
    }
}

/******************************************************************************/

// Format data for better readability in the report
function renderData(data, depth = 0) {
    const indent = ' '.repeat(depth * 2); // Doubled indentation for better readability
    
    if (Array.isArray(data)) {
        if (data.length === 0) return `${indent}[]`;
        
        const out = [];
        for (let i = 0; i < data.length; i++) {
            out.push(`${indent}- ${renderData(data[i], depth + 1).trim()}`);
        }
        return out.join('\n');
    }
    
    if (typeof data !== 'object' || data === null) {
        return `${indent}${data}`;
    }
    
    if (Object.keys(data).length === 0) return `${indent}{}`;
    
    const out = [];
    for (const [name, value] of Object.entries(data)) {
        if (typeof value === 'object' && value !== null) {
            out.push(`${indent}${name}:`);
            out.push(renderData(value, depth + 1));
            continue;
        }
        out.push(`${indent}${name}: ${value}`);
    }
    
    return out.join('\n');
}

/******************************************************************************/

// Get configuration data sections to include in the report
async function getConfigDataSections() {
    try {
        if (typeof browser === 'undefined' || !browser.runtime) {
            return {
                extension: {
                    error: t('report_browser_api_unavailable')
                }
            };
        }
        
        const manifest = browser.runtime.getManifest();

        const storage = await browser.storage.local.get([
            'globalStatus',
            'loggingStatus',
            'badgedStatus',
            'statisticsStatus',
            'historyApiProtection',
            'updateHyperlinkAuditing', 
            'updateBadgeOnOff',
            'PreventGoogleandyandexscript',
            'remoteRulesEnabled',
            'builtInRulesEnabled',
            'overloadModeEnabled',
            'hashStatus',
            'hashValidationStatus',
            'userWhitelist',
            'custom_rules',
            'disabledExceptionRules',
            'disabledRules',
            'disabledProviders'
        ]);

        return {
            extension: {
                name: manifest.name,
                version: manifest.version,
                browser: getBrowserInfo()
            },
            settings: {
                enabled: storage.globalStatus !== false,
                loggingStatus: storage.loggingStatus === true,
                badgedStatus: storage.badgedStatus !== false,
                statisticsStatus: storage.statisticsStatus !== false,
                historyApiProtection: storage.historyApiProtection !== false,
                hyperlinkAuditingProtection: storage.updateHyperlinkAuditing !== false,
                badgeUpdates: storage.updateBadgeOnOff !== false,
                searchRewriteProtection: storage.PreventGoogleandyandexscript !== false,
                remoteRulesEnabled: storage.remoteRulesEnabled === true,
                builtInRulesEnabled: storage.builtInRulesEnabled !== false,
                overloadModeEnabled: storage.overloadModeEnabled === true,
                hashStatus: storage.hashStatus || 'unknown',
                hashValidationStatus: storage.hashValidationStatus || 'unknown'
            },
            whitelist: {
                whitelistedDomains: storage.userWhitelist || []
            },
            customRules: {
                customRules: storage.custom_rules || {}
            },
            disabledRules: {
                disabledExceptionRules: storage.disabledExceptionRules || [],
                disabledRules: storage.disabledRules || {},
                disabledProviders: storage.disabledProviders || {}
            }
        };
    } catch (error) {
        console.error('Error getting configuration data:', error);
        return {
            extension: {
                error: t('report_config_error') + error.message
            }
        };
    }
}

// Get configuration data to include in the report
async function getConfigData(selection = DEFAULT_CONFIG_SECTION_SELECTION) {
    return renderConfigData(await getConfigDataSections(), selection);
}

/******************************************************************************/

// Open a URL
function openURL(url) {
    try {
        browser.tabs.create({ url });
    } catch (error) {
        console.error('Error opening URL:', error);
        // Fallback to regular window.open if browser API fails
        window.open(url, '_blank');
    }
}

/******************************************************************************/

// Add this helper function to get browser info
function getBrowserInfo() {
    const ua = navigator.userAgent;
    let browser = '';
    let version = '';
    let variant = '';

    // Chromium-based browsers need to be checked first in specific order
    if (/edg/i.test(ua)) {
        browser = 'Edge';
        version = ua.match(/edg\/([\d.]+)/i)?.[1] || '';
        variant = 'Chromium';
    } 
    // Brave needs to be checked before browser
    else if (navigator.brave?.isBrave?.()) {
        browser = 'Brave';
        version = ua.match(/browser\/([\d.]+)/i)?.[1] || '';
        variant = 'Chromium';
    }
    // Opera needs to be checked before browser
    else if (/opr|opera/i.test(ua)) {
        browser = 'Opera';
        version = ua.match(/(opr|opera)\/([\d.]+)/i)?.[2] || '';
        variant = 'Chromium';
    }
    // Vivaldi needs to be checked before browser
    else if (/vivaldi/i.test(ua)) {
        browser = 'Vivaldi';
        version = ua.match(/vivaldi\/([\d.]+)/i)?.[1] || '';
        variant = 'Chromium';
    }
    // Generic browser/Chromium check
    else if (/browser|chromium|crios/i.test(ua)) {
        browser = /chromium/i.test(ua) ? 'Chromium' : 'browser';
        version = ua.match(/(browser|chromium|crios)\/([\d.]+)/i)?.[2] || '';
        // Check if it's ungoogled-chromium
        if (/chromium/i.test(ua) && !navigator.googlebot) {
            variant = 'Ungoogled';
        }
    }
    // Firefox variants
    else if (/firefox|fxios/i.test(ua)) {
        browser = 'Firefox';
        version = ua.match(/(firefox|fxios)\/([\d.]+)/i)?.[2] || '';
        // Check for Firefox forks
        if (/librewolf/i.test(ua)) {
            variant = 'LibreWolf';
        } else if (/waterfox/i.test(ua)) {
            variant = 'Waterfox';
        } else if (/palemoon/i.test(ua)) {
            variant = 'Pale Moon';
        }
    }
    // Safari specific check
    else if (/safari/i.test(ua) && !/browser|chromium|crios/i.test(ua)) {
        browser = 'Safari';
        version = ua.match(/version\/([\d.]+)/i)?.[1] || '';
        // Check for Webkit nightly
        if (/webkit/i.test(ua)) {
            variant = 'WebKit';
        }
    }
    // Unknown browser
    else {
        browser = 'Unknown';
    }

    // Construct the browser string
    let browserString = browser;
    if (version) browserString += ` ${version}`;
    if (variant) browserString += ` (${variant})`;

    return browserString;
}

// Add this helper function to get hostname from URL
function getHostnameFromUrl(url) {
    try {
        return new URL(url).hostname.replace(/^(m\.|mobile\.|www\.)/, '');
    } catch (e) {
        console.error('Error parsing URL:', e);
        return 'unknown-domain';
    }
}

/******************************************************************************/

// Helper function to safely decode URL components
function safeDecodeUrl(url) {
    try {
        const parsedUrl = new URL(url);
        
        // Start building the decoded URL manually
        let decodedUrl = `${parsedUrl.protocol}//${parsedUrl.host}`;
        
        // Decode pathname
        try {
            decodedUrl += decodeURIComponent(parsedUrl.pathname);
        } catch (e) {
            decodedUrl += parsedUrl.pathname; // Keep original if decoding fails
        }
        
        // Decode search parameters manually (don't use URLSearchParams.toString())
        if (parsedUrl.search) {
            const searchParams = [];
            for (const [key, value] of parsedUrl.searchParams) {
                try {
                    const decodedKey = decodeURIComponent(key);
                    const decodedValue = decodeURIComponent(value);
                    searchParams.push(`${decodedKey}=${decodedValue}`);
                } catch (e) {
                    // If decoding fails, keep original
                    searchParams.push(`${key}=${value}`);
                }
            }
            
            if (searchParams.length > 0) {
                decodedUrl += '?' + searchParams.join('&');
            }
        }
        
        // Add hash if present
        if (parsedUrl.hash) {
            try {
                decodedUrl += decodeURIComponent(parsedUrl.hash);
            } catch (e) {
                decodedUrl += parsedUrl.hash; // Keep original if decoding fails
            }
        }
        
        return decodedUrl;
    } catch (error) {
        console.warn('Error decoding URL:', error);
        // Fallback to simple decodeURIComponent for the entire URL
        try {
            return decodeURIComponent(url);
        } catch (fallbackError) {
            console.warn('Fallback decoding also failed:', fallbackError);
            // Return original URL if all decoding attempts fail
            return url;
        }
    }
}

/******************************************************************************/

// Updated URL Preview Modal with decoded URL display
function showUrlPreview(url) {
    return new Promise((resolve) => {
        // Create modal overlay
        const overlay = createElement('div', {
            class: 'url-preview-modal',
            style: `
                position: fixed;
                top: 0;
                left: 0;
                width: 100%;
                height: 100%;
                background: rgba(0, 0, 0, 0.7);
                z-index: 10000;
                display: flex;
                align-items: center;
                justify-content: center;
                padding: 20px;
                box-sizing: border-box;
            `
        });

        // Create modal content
        const modal = createElement('div', {
            style: `
                background: var(--bg-secondary);
                border-radius: 8px;
                padding: 24px;
                max-width: 700px;
                width: 100%;
                max-height: 85vh;
                overflow-y: auto;
                box-shadow: 0 10px 25px var(--shadow-color);
                color: var(--text-secondary);
                border: 1px solid var(--border-color);
            `
        });

        // Create header with i18n
        const header = createElement('h3', {
            style: 'margin-top: 0; margin-bottom: 16px; color: var(--text-secondary); font-size: 18px;'
        });

        // Create warning text with i18n
        const warning = createElement('p', {
            style: 'margin-bottom: 16px; font-size: 14px; line-height: 1.5; color: var(--text-secondary);'
        });

        // Create URL display section
        const urlSection = createElement('div', {
            style: 'margin-bottom: 16px;'
        });

        // Encoded URL display label (main display - always visible)
        const encodedUrlLabel = createElement('label', {
            style: 'display: block; margin-bottom: 8px; font-weight: 500; color: var(--text-secondary);'
        });

        // Encoded URL display (main display - always visible)
        const encodedUrlDisplay = createElement('div', {
            style: `
                background: var(--bg-primary);
                border: 1px solid var(--border-color);
                border-radius: 4px;
                padding: 12px;
                font-family: monospace;
                font-size: 11px;
                word-break: break-all;
                max-height: 200px;
                overflow-y: auto;
                user-select: all;
                cursor: text;
                color: var(--text-secondary);
                white-space: pre-wrap;
                margin-bottom: 16px;
            `
        });

        // Set the original encoded URL (always visible)
        encodedUrlDisplay.textContent = url;

        // Decoded URL section in a collapsible dropdown
        const showDecodedSection = createElement('details', {
            style: 'margin-bottom: 16px;'
        });

        const decodedSummary = createElement('summary', {
            style: 'cursor: pointer; color: var(--text-muted); font-size: 12px; margin-bottom: 8px;'
        });

        const decodedUrlDisplay = createElement('div', {
            style: `
                background: var(--bg-primary);
                border: 1px solid var(--border-color);
                border-radius: 4px;
                padding: 12px;
                font-family: monospace;
                font-size: 10px;
                word-break: break-all;
                max-height: 120px;
                overflow-y: auto;
                user-select: all;
                cursor: text;
                color: var(--text-muted);
                white-space: pre-wrap;
                margin-top: 8px;
            `
        });

        // Set the decoded URL for better readability
        const decodedUrl = safeDecodeUrl(url);
        decodedUrlDisplay.textContent = decodedUrl;

        // Create security notice
        const securityNotice = createElement('div', {
            style: `
                background: rgba(59, 130, 246, 0.1);
                border: 1px solid var(--button-primary);
                border-radius: 4px;
                padding: 12px;
                margin-bottom: 16px;
                font-size: 13px;
                color: var(--text-secondary);
                display: flex;
                align-items: flex-start;
                gap: 8px;
            `
        });

        const securityIcon = createElement('span', {
            style: 'flex-shrink: 0;'
        }, '🔒');

        const securityText = createElement('span');

        securityNotice.appendChild(securityIcon);
        securityNotice.appendChild(securityText);

        // Create button container
        const buttonContainer = createElement('div', {
            style: 'display: flex; gap: 12px; justify-content: flex-end; flex-wrap: wrap;'
        });

        // Create copy URL button
        const copyButton = createElement('button', {
            style: `
                padding: 8px 16px;
                background: var(--bg-tertiary);
                color: var(--text-primary);
                border: none;
                border-radius: 4px;
                cursor: pointer;
                font-size: 13px;
                font-family: "Liberation Serif";
                transition: all 0.2s ease;
            `
        });

        // Create cancel button
        const cancelButton = createElement('button', {
            style: `
                padding: 8px 16px;
                background: var(--button-danger);
                color: var(--text-primary);
                border: none;
                border-radius: 4px;
                cursor: pointer;
                font-size: 13px;
                font-family: "Liberation Serif";
                transition: all 0.2s ease;
            `
        });

        // Create proceed button
        const proceedButton = createElement('button', {
            style: `
                padding: 8px 16px;
                background: var(--button-primary);
                color: var(--text-primary);
                border: none;
                border-radius: 4px;
                cursor: pointer;
                font-size: 13px;
                font-family: "Liberation Serif";
                transition: all 0.2s ease;
                font-weight: 500;
            `
        });

        // Set text content with i18n fallbacks
    header.textContent = t('urlPreviewTitle', undefined, 'URL Preview');
    warning.textContent = t('urlPreviewWarning', undefined, 'Please review the URL that will be opened. This URL contains the information you entered and will redirect you to GitHub.');
    encodedUrlLabel.textContent = t('urlPreviewEncodedUrl', undefined, 'URL to be opened (technical format):');
    decodedSummary.textContent = t('urlPreviewShowDecoded', undefined, 'Show readable format (decoded URL)');
    copyButton.textContent = t('urlPreviewCopy', undefined, 'Copy URL');
    cancelButton.textContent = t('urlPreviewCancelButton', undefined, 'Cancel');
    proceedButton.textContent = t('urlPreviewProceedButton', undefined, 'Open GitHub');
    const span = createElement('span');
    span.innerHTML = tHtml('urlPreviewSecurityNotice', undefined, 'This URL will redirect you to GitHub. Your data will be subject to GitHub privacy policy once redirected.');
    securityText.appendChild(span);

        // Add hover effects
        const addHoverEffect = (button) => {
            button.addEventListener('mouseenter', () => {
                button.style.transform = 'translateY(-1px)';
            });
            button.addEventListener('mouseleave', () => {
                button.style.transform = 'translateY(0)';
            });
        };

        [copyButton, cancelButton, proceedButton].forEach(addHoverEffect);

        // Add event listener for copy button (copies the original encoded URL)
        copyButton.addEventListener('click', async () => {
            try {
                // Always copy the original encoded URL (the one that actually works)
                await navigator.clipboard.writeText(url);
                const originalText = copyButton.textContent;
                copyButton.textContent = t('urlPreviewCopied', undefined, 'Copied!');
                setTimeout(() => {
                    copyButton.textContent = originalText;
                }, 2000);
            } catch (err) {
                console.error('Failed to copy URL:', err);
                // Fallback: select the encoded URL text for manual copying (main display)
                encodedUrlDisplay.focus();
                const selection = window.getSelection();
                const range = document.createRange();
                range.selectNodeContents(encodedUrlDisplay);
                selection.removeAllRanges();
                selection.addRange(range);
            }
        });

        cancelButton.addEventListener('click', () => {
            document.body.removeChild(overlay);
            resolve(false);
        });

        proceedButton.addEventListener('click', () => {
            document.body.removeChild(overlay);
            resolve(true);
        });

        // Close on escape key
        const handleKeydown = (e) => {
            if (e.key === 'Escape') {
                document.body.removeChild(overlay);
                document.removeEventListener('keydown', handleKeydown);
                resolve(false);
            }
        };
        document.addEventListener('keydown', handleKeydown);

        // Close on overlay click (but not modal click)
        overlay.addEventListener('click', (e) => {
            if (e.target === overlay) {
                document.body.removeChild(overlay);
                resolve(false);
            }
        });

        // Assemble the decoded URL section (collapsible)
        showDecodedSection.appendChild(decodedSummary);
        showDecodedSection.appendChild(decodedUrlDisplay);

        // Assemble URL section
        urlSection.appendChild(encodedUrlLabel);
        urlSection.appendChild(encodedUrlDisplay);
        urlSection.appendChild(showDecodedSection);
        
        // Assemble button container
        buttonContainer.appendChild(copyButton);
        buttonContainer.appendChild(cancelButton);
        buttonContainer.appendChild(proceedButton);

        // Assemble modal
        modal.appendChild(header);
        modal.appendChild(warning);
        modal.appendChild(urlSection);
        modal.appendChild(securityNotice);
        modal.appendChild(buttonContainer);

        overlay.appendChild(modal);
        document.body.appendChild(overlay);

        // Focus the proceed button
        setTimeout(() => proceedButton.focus(), 100);
    });
}

/******************************************************************************/

// Updated reportIssue function with URL preview
async function reportIssue() {
    // Check if consent checkbox is checked
    const consentCheckbox = $('#consentCheckbox');
    if (!consentCheckbox?.checked) {
        alert(t('consentRequired', undefined, 'Please check the consent checkbox to proceed.'));
        return;
    }

    const issueType = getIssueType();
    if (issueType === '[unknown]') {
        alert(t('issueTypeRequired', undefined, 'Please select an issue type.'));
        return;
    }
    
    try {
        // Base GitHub URL using the template
        const githubURL = new URL('https://github.com/Linkumori/Linkumori-Addon/issues/new');
        githubURL.searchParams.set('template', 'Issue.yaml');
        
        // Define which issue types are URL-related
        const urlRelatedTypes = ['tracking-not-removed', 'url-broken', 'false-positive'];
        const isUrlRelatedIssue = urlRelatedTypes.includes(issueType);
        
        // Only get and validate URL for URL-related issue types
        let finalUrl = '';
        if (isUrlRelatedIssue) {
            finalUrl = getSelectedUrl();
            
            if (!finalUrl) {
                alert(t('urlRequired', undefined, 'Please provide a URL.'));
                return;
            }

            if (!validateUrl(finalUrl)) {
                alert(t('urlInvalid', undefined, 'Please enter a valid URL.'));
                return;
            }
        }

        // Get additional comments and format description for the issue template
        const additionalInfo = $('#additionalInfo').value.trim();
        
        // Prepare the configuration information the user selected to share.
        if (!reportConfigSections) {
            reportConfigSections = await getConfigDataSections();
        }
        const configData = renderConfigData(reportConfigSections, getConfigShareSelection());
        
        // Create a proper title for the issue
        let title;
        
        if (isUrlRelatedIssue) {
            let hostname;
            const urlSelect = $('#urlSelect');
            
            if (urlSelect.value === 'custom') {
                const customUrl = $('#customUrlInput').value.trim();
                hostname = getHostnameFromUrl(customUrl);
            } else if (reportedPage) {
                hostname = urlSelect.value === 'domain' ? 
                    getHostnameFromUrl(reportedPage.baseUrl) : 
                    getHostnameFromUrl(reportedPage.originalUrl);
            } else {
                hostname = 'unknown-domain';
            }
            
            title = `${hostname}: ${issueType}`;
        } else {
            // For non-URL issues, capitalize first letter
            title = issueType.split('-')
                .map(word => word.charAt(0).toUpperCase() + word.slice(1))
                .join(' ');
        }

        // Add NSFW tag if needed
        if ($('#isNSFW')?.checked) {
            title = `[nsfw] ${title}`;
        }
        
        // Set the title parameter
        githubURL.searchParams.set('title', title);
        
        // Set appropriate labels based on issue type
        let labels = [];
        let type = [];       
        switch (issueType) {
            case 'tracking-not-removed':
                labels.push('Url parameter not removed');
                type.push('bug');
                break;
            case 'url-broken':
                labels.push('URL Broken');
                type.push('bug');
                break;
            case 'false-positive':
                labels.push('False Positive');
                type.push('bug');
                break;
            case 'ui-issue':
                labels.push('UI Issue');
                type.push('bug');
                break;
            case 'performance':
                labels.push('Performance');
                type.push('bug');
                break;
            case 'feature-request':
                labels.push('Feature Request');
                type.push('Feature');
                break;
            case 'rule-suggestion':
                labels.push('Rule Suggestion');
                type.push('Feature');
                break;
            default:
                labels.push('Needs triage');
                type.push('bug');
        }
        
        githubURL.searchParams.set('labels', labels.join(','));
        githubURL.searchParams.set('type', type.join(','));
        
        // Format description text for the template
        let descriptionText = `Issue Type: ${issueType}\n`;
        
        if (isUrlRelatedIssue && finalUrl) {
            descriptionText += `URL: ${finalUrl}\n`;
            
            if (reportedPage?.cleanedUrl) {
                descriptionText += `Cleaned URL: ${reportedPage.cleanedUrl}\n`;
            }
        }
        
        if ($('#isNSFW')?.checked) {
            descriptionText += `Content Warning: This issue contains NSFW content.\n`;
        }
        
        if (additionalInfo) {
            descriptionText += `\nAdditional Comments:\n${additionalInfo}\n`;
        }
        
        descriptionText += `\nShared Configuration:\n${configData}`;
        
        // Set the description parameter for the template
        githubURL.searchParams.set('description', descriptionText);
        
        // Show URL preview before proceeding
        const shouldProceed = await showUrlPreview(githubURL.href);
        
        if (shouldProceed) {
            openURL(githubURL.href);
        } else {
            console.log('User cancelled URL redirection');
        }
    } catch (error) {
        console.error('Error creating GitHub issue:', error);
        alert(t('errorCreatingIssue', undefined, 'Error creating GitHub issue: ') + error.message);
    }
}

/******************************************************************************/

// Updated findExistingIssues function with URL preview
async function findExistingIssues() {
    // Check if the user has provided consent
    if (!$('#findExistingConsentCheckbox').checked) {
        alert(t('findExistingConsentRequired', undefined, 'Please confirm that you understand how your data will be used by checking the consent box.'));
        return;
    }

    const issueType = getIssueType();
    let searchQuery = [];
    
    // Get URL and hostname based on current selection
    let finalUrl = '';
    let hostname = '';
    const urlSelect = $('#urlSelect');
    
    // Get URL based on selection
    if (urlSelect.value === 'custom') {
        finalUrl = $('#customUrlInput').value.trim();
        if (finalUrl && validateUrl(finalUrl)) {
            hostname = getHostnameFromUrl(finalUrl);
        }
    } else if (reportedPage) {
        finalUrl = urlSelect.value === 'domain' ? reportedPage.baseUrl : reportedPage.originalUrl;
        hostname = getHostnameFromUrl(finalUrl);
    }

    // Build search query with hostname if available
    if (hostname && hostname !== 'unknown-domain') {
        // Add the exact hostname for precise matching
        searchQuery.push(hostname);
        
        // If it's a subdomain, also add the main domain
        const domainParts = hostname.split('.');
        if (domainParts.length > 2) {
            const mainDomain = domainParts.slice(-2).join('.');
            if (mainDomain !== hostname) {
                searchQuery.push(mainDomain);
            }
        }
    }

    // Add issue type if valid
    if (issueType && issueType !== '[unknown]') {
        searchQuery.push(issueType);
    }

    // Add NSFW tag if checked
    if ($('#isNSFW')?.checked) {
        searchQuery.push('nsfw');
    }

    try {
        const url = new URL('https://github.com/Linkumori/Linkumori-Addon/issues');
        let queryString = 'is:issue';
        
        if (searchQuery.length > 0) {
            // Add hostname with exact match quotes
            queryString += ` "${searchQuery[0]}"`;
            
            // Add remaining terms
            const remainingTerms = searchQuery.slice(1)
                .filter(Boolean)
                .map(term => term.includes('.') ? `"${term}"` : term)
                .join(' ');
                
            if (remainingTerms) {
                queryString += ' ' + remainingTerms;
            }
        }
        
        queryString += ' sort:updated-desc';
        url.searchParams.set('q', queryString);
        
        // Show URL preview before proceeding
        const shouldProceed = await showUrlPreview(url.href);
        
        if (shouldProceed) {
            openURL(url.href);
        }
    } catch (error) {
        console.error('Error finding existing issues:', error);
        alert(t('errorFindingIssues', undefined, 'Error finding existing issues: ') + error.message);
    }
}

/******************************************************************************/

// URL validation function
function validateUrl(url) {
    try {
        new URL(url);
        return true;
    } catch {
        return false;
    }
}

/******************************************************************************/



/******************************************************************************/

// Enhanced initialization for the report page
async function initReportPage() {
    try {
        // Get configuration data
        reportConfigSections = await getConfigDataSections();
        updateConfigPreview();

        CONFIG_SECTION_DEFINITIONS.forEach(section => {
            const input = document.querySelector(`[data-config-section="${section.id}"]`);
            if (input) {
                input.addEventListener('change', updateConfigPreview);
            }
        });
        
        // Populate the URL dropdown with actual URLs
        populateUrlDropdown();
        
        // Create consent checkboxes based on the new YAML template
        
        // Add event listener for issue type selection
        $('#issueTypeSelect').addEventListener('change', updateURLSelectVisibility);
        
        // Add event listener for URL dropdown
        $('#urlSelect').addEventListener('change', handleUrlDropdownChange);
        
        // Set up event listeners for buttons
        $('#reportIssueButton').addEventListener('click', reportIssue);
        
        if ($('#findExistingButton')) {
            $('#findExistingButton').addEventListener('click', findExistingIssues);
        }
        
        // Initial visibility setup based on current issue type
        updateURLSelectVisibility();
    } catch (error) {
        console.error('Error initializing report page:', error);
        const errorMsg = createElement('p', { class: 'error' }, 
            'Error initializing page: ' + error.message);
        document.querySelector('section').prepend(errorMsg);
    }
}
 
/******************************************************************************/

// Setup theme toggle and NSFW checkbox functionality
document.addEventListener('DOMContentLoaded', async function() {
    await waitForReportI18n();

    const i18n = getReportI18n();
    const languageCode = i18n && typeof i18n.getUILanguage === 'function'
        ? i18n.getUILanguage()
        : 'en';
    const normalizedLanguage = String(languageCode || 'en').replace('_', '-');
    const baseLanguage = normalizedLanguage.split('-')[0].toLowerCase();
    document.documentElement.lang = normalizedLanguage;
    document.documentElement.dir = ['ar', 'fa', 'he', 'ur'].includes(baseLanguage) ? 'rtl' : 'ltr';

    const themeToggle = document.getElementById('themeToggle');
    if (themeToggle) {
         themeToggle.addEventListener('click', async function() {
            const theme = globalThis.LinkumoriTheme || {};
            const {
                THEME_STORAGE_KEY = 'linkumori-theme',
                LIGHT_THEME_STORAGE_KEY = 'linkumori-light-mode-theme',
                DARK_THEME_STORAGE_KEY = 'linkumori-dark-mode-theme',
                LAST_DARK_THEME_STORAGE_KEY = 'linkumori-last-dark-theme',
                DEFAULT_THEME = 'dark',
                buildThemeTogglePayload,
                normalizeTheme,
                syncBootstrapTheme
            } = theme;
            const currentTheme = typeof normalizeTheme === 'function'
                ? normalizeTheme(document.documentElement.getAttribute('data-theme') || DEFAULT_THEME)
                : (document.documentElement.getAttribute('data-theme') || DEFAULT_THEME);

            if (typeof buildThemeTogglePayload === 'function') {
                const result = await browser.storage.local.get([
                    LAST_DARK_THEME_STORAGE_KEY,
                    LIGHT_THEME_STORAGE_KEY,
                    DARK_THEME_STORAGE_KEY
                ]);
                const { nextTheme, payload } = buildThemeTogglePayload(currentTheme, result);
                const normalizedNextTheme = typeof normalizeTheme === 'function'
                    ? normalizeTheme(nextTheme)
                    : nextTheme;

                if (typeof syncBootstrapTheme === 'function') {
                    syncBootstrapTheme(normalizedNextTheme);
                } else {
                    document.documentElement.setAttribute('data-theme', normalizedNextTheme);
                }
                await browser.storage.local.set(payload);
            } else {
                const nextTheme = currentTheme === 'light' ? 'dark' : 'light';
                document.documentElement.setAttribute('data-theme', nextTheme);
                localStorage.setItem(THEME_STORAGE_KEY, nextTheme);
                await browser.storage.local.set({ [THEME_STORAGE_KEY]: nextTheme });
            }
        });

        // Listen for theme changes from other parts of the extension
        browser.storage.onChanged.addListener((changes, namespace) => {
            if (namespace === 'local' && changes['linkumori-theme']) {
                const nextTheme = changes['linkumori-theme'].newValue;
                if (globalThis.LinkumoriTheme && typeof globalThis.LinkumoriTheme.syncBootstrapTheme === 'function') {
                    globalThis.LinkumoriTheme.syncBootstrapTheme(nextTheme);
                } else {
                    document.documentElement.setAttribute('data-theme', nextTheme);
                }
            }
        });
    }

    // Add translation helper function
    function translateElement(element) {
        const messageKey = element.getAttribute('data-i18n');
        if (messageKey) {
            const translated = t(messageKey);
            if (translated) {
                if (messageKey === 'consentMessage' || messageKey === 'findExistingConsentMessage') {
                    element.innerHTML = tHtml(messageKey);
                } else {
                    element.textContent = translated;
                }
            }
        }

        const placeholderKey = element.getAttribute('data-i18n-placeholder');
        if (placeholderKey) {
            element.setAttribute('placeholder', t(placeholderKey));
        }

        const titleKey = element.getAttribute('data-i18n-title');
        if (titleKey) {
            element.setAttribute('title', t(titleKey));
        }

        const ariaKey = element.getAttribute('data-i18n-aria');
        if (ariaKey) {
            element.setAttribute('aria-label', t(ariaKey));
        }
    }

    // Initialize translations
    function initTranslations() {
        // Translate all elements with data-i18n attribute
        document.querySelectorAll('[data-i18n], [data-i18n-placeholder], [data-i18n-title], [data-i18n-aria]').forEach(translateElement);
        document.title = t('reportIssueTitle', undefined, document.title || 'Report Issue');
        
        // Special handling for dynamic elements
        const urlSelect = $('#urlSelect');
        if (urlSelect) {
            const customOption = urlSelect.querySelector('option[value="custom"]');
            if (customOption) {
                customOption.textContent = t('enterCustomUrl', undefined, 'Enter custom URL');
            }
        }
        
        // Translate consent checkboxes
        document.querySelectorAll('.consent-checkbox').forEach((checkbox, index) => {
            const messageKey = `consent${index + 1}`;
            const label = checkbox.nextElementSibling;
            if (label && t(messageKey)) {
                label.textContent = t(messageKey);
            }
        });
    }

    // Initialize translations
    initTranslations();
    
    // Setup NSFW checkbox
    const nsfwCheckbox = document.getElementById('isNSFW');
    if (nsfwCheckbox) {
        const checkboxWrap = nsfwCheckbox.closest('.checkbox');
        if (checkboxWrap) {
            nsfwCheckbox.addEventListener('change', function() {
                if (nsfwCheckbox.checked) {
                    checkboxWrap.classList.add('checked');
                } else {
                    checkboxWrap.classList.remove('checked');
                }
            });
        }
    }
    
    // Initialize the report page after DOM is ready
    initReportPage();
});
