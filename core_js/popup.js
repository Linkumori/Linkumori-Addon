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
 * Upstream:   https://gitlab.com/ClearURLs/ClearUrls/-/tree/m3-migration
 *             https://gitlab.com/ClearURLs/ClearUrls/-/blob/a677797b1c6d41915bbe0db6bc2638e0e1f99ad1/core_js/popup.js
 *
 * MODIFICATIONS
 * -------------
 * - Redesigned UI
 * - Added new buttons
 * - Added whitelist Punycode support
 * - Added bug report support
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
// ===== IMPORT PUNYCODE =====

// ===== ORIGINAL GLOBAL VARIABLES (UNCHANGED) =====
var element = document.getElementById('statistics_value');
var elGlobalPercentage = document.getElementById('statistics_value_global_percentage');
var elProgressbar_blocked = document.getElementById('progress_blocked');
var elTotal = document.getElementById('statistics_total_elements');
var globalPercentage = 0;
var cleanedCounter = 0;  // Initialize with defaults
var totalCounter = 0;
var globalStatus = true;
var badgedStatus = true;
var hashStatus = '';
var firefoxSignatureHash = '';
var loggingStatus = false;
var statisticsStatus = true;
var currentURL = '';
var temporaryPauseState = {
    isPaused: false,
    mode: 'none',
    until: null,
    remainingMs: 0
};
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

// ===== WHITELIST STATE (NEW ADDITION) =====
var userWhitelist = [];
const POPUP_CONSENT_STORAGE_KEY = 'popupConsentAccepted';
const POPUP_CONSENT_VERSION_STORAGE_KEY = 'popupConsentPolicyVersionAccepted';
const POPUP_CONSENT_SIGNATURE_STORAGE_KEY = 'popupConsentPolicySignatureAccepted';
const POPUP_CONSENT_TEXT_KEYS = {
    title: 'popup_consent_title',
    description: 'popup_consent_description',
    checkbox: 'popup_consent_checkbox'
};

function getPopupI18n() {
    return (typeof globalThis !== 'undefined' && globalThis.LinkumoriI18n) ? globalThis.LinkumoriI18n : null;
}

function waitForPopupI18n() {
    const i18n = getPopupI18n();
    if (!i18n || typeof i18n.ready !== 'function') {
        return Promise.resolve(null);
    }

    return i18n.ready().then(() => i18n).catch(() => null);
}

function getPopupI18nMessage(key, substitutions, fallback = '') {
    const i18n = getPopupI18n();
    if (
        i18n &&
        typeof i18n.getMessage === 'function' &&
        typeof i18n.isReady === 'function' &&
        i18n.isReady()
    ) {
        return i18n.getMessage(key, substitutions);
    }

    return `[${key}]`;
}

function getPopupLanguageCode() {
    const i18n = getPopupI18n();
    try {
        if (i18n && typeof i18n.getUILanguage === 'function') {
            return i18n.getUILanguage() || 'en';
        }
        if (i18n && typeof i18n.getCurrentLanguage === 'function') {
            const currentLanguage = i18n.getCurrentLanguage();
            return currentLanguage?.code || 'en';
        }
    } catch (error) {
    }
    return 'en';
}

function applyPopupLanguageLayout() {
    const languageCode = getPopupLanguageCode();
    const normalizedLanguage = String(languageCode || 'en').replace('_', '-');
    const baseLanguage = normalizedLanguage.split('-')[0].toLowerCase();
    const isRtl = ['ar', 'fa', 'he', 'ur'].includes(baseLanguage);

    document.documentElement.lang = normalizedLanguage;
    document.documentElement.dir = isRtl ? 'rtl' : 'ltr';

    requestAnimationFrame(() => {
        const adaptiveElements = Array.from(document.querySelectorAll([
            '.nav-item',
            '.toggle-label',
            '.pause-title',
            '.pause-status',
            '.pause-buttons button',
            '.button-group button',
            '.popup-consent-card button',
            '.popup-consent-card span'
        ].join(',')));

        const hasLongLabels = adaptiveElements.some((item) => {
            const isVisible = item.offsetParent !== null || item.getClientRects().length > 0;
            if (!isVisible) {
                return false;
            }
            const text = (item.textContent || '').trim();
            return text.length > 28;
        });

        document.body.classList.toggle('popup-long-text', hasLongLabels);
    });
}

function getPopupConsentPolicyVersion() {
    const version = Number(globalThis.Linkumoriversion);
    if (!Number.isInteger(version) || version <= 0) {
        throw new Error('Invalid Linkumoriversion');
    }
    return version;
}

function getCurrentConsentSignature() {
    const consentPayload = {
        title: getPopupI18nMessage(POPUP_CONSENT_TEXT_KEYS.title),
        description: getPopupI18nMessage(POPUP_CONSENT_TEXT_KEYS.description),
        checkbox: getPopupI18nMessage(POPUP_CONSENT_TEXT_KEYS.checkbox)
    };

    const normalized = JSON.stringify(consentPayload).toLowerCase().trim();
    let hash = 0;
    for (let i = 0; i < normalized.length; i++) {
        hash = ((hash << 5) - hash) + normalized.charCodeAt(i);
        hash |= 0;
    }
    return String(hash);
}

/**
 * Check whether popup consent was accepted.
 * @returns {Promise<boolean>}
 */
async function hasPopupConsent(policyVersion) {
    try {
        const result = await browser.storage.local.get([
            POPUP_CONSENT_STORAGE_KEY,
            POPUP_CONSENT_VERSION_STORAGE_KEY,
            POPUP_CONSENT_SIGNATURE_STORAGE_KEY
        ]);

        const accepted = result[POPUP_CONSENT_STORAGE_KEY] === true;
        const acceptedVersion = Number(result[POPUP_CONSENT_VERSION_STORAGE_KEY] || 0);
        const storedSignature = typeof result[POPUP_CONSENT_SIGNATURE_STORAGE_KEY] === 'string'
            ? result[POPUP_CONSENT_SIGNATURE_STORAGE_KEY]
            : '';
        const currentSignature = getCurrentConsentSignature();

        if (accepted && acceptedVersion === policyVersion) {
            if (storedSignature !== currentSignature) {
                await browser.storage.local.set({
                    [POPUP_CONSENT_SIGNATURE_STORAGE_KEY]: currentSignature
                });
            }
            return true;
        }

        // Policy version changed: revoke old consent and re-ask.
        if (accepted) {
            await browser.storage.local.set({
                [POPUP_CONSENT_STORAGE_KEY]: false,
                [POPUP_CONSENT_VERSION_STORAGE_KEY]: 0
            });
        }

        return false;
    } catch (error) {
        return false;
    }
}

/**
 * Show or hide popup consent gate.
 * @param {boolean} locked
 */
function setPopupConsentLock(locked) {
    const consentGate = document.getElementById('popupConsentGate');
    if (!consentGate) {
        return;
    }

    if (locked) {
        consentGate.classList.remove('hidden');
    } else {
        consentGate.classList.add('hidden');
    }

    document.body.classList.toggle('consent-locked', locked);
}

/**
 * Initialize popup consent gate behavior.
 */
async function initializePopupConsentGate() {
    const consentGate = document.getElementById('popupConsentGate');
    const consentCheckbox = document.getElementById('popupConsentCheckbox');
    const consentAcceptButton = document.getElementById('popupConsentAccept');
    const consentLegalLink = document.getElementById('popupConsentLegalLink');

    if (!consentGate || !consentCheckbox || !consentAcceptButton || !consentLegalLink) {
        return;
    }

    let policyVersion = 0;
    try {
        policyVersion = getPopupConsentPolicyVersion();
    } catch (error) {
        setPopupConsentLock(true);
        return;
    }

    const consentAccepted = await hasPopupConsent(policyVersion);
    setPopupConsentLock(!consentAccepted);

    if (consentAccepted) {
        return;
    }

    consentCheckbox.checked = false;
    consentAcceptButton.disabled = true;

    consentCheckbox.addEventListener('change', () => {
        consentAcceptButton.disabled = !consentCheckbox.checked;
    });

    consentAcceptButton.addEventListener('click', async () => {
        if (!consentCheckbox.checked) {
            return;
        }

        consentAcceptButton.disabled = true;

        try {
            await browser.storage.local.set({
                [POPUP_CONSENT_STORAGE_KEY]: true,
                [POPUP_CONSENT_VERSION_STORAGE_KEY]: policyVersion,
                [POPUP_CONSENT_SIGNATURE_STORAGE_KEY]: getCurrentConsentSignature()
            });
            setPopupConsentLock(false);
        } catch (error) {
            consentAcceptButton.disabled = false;
        }
    });
}


// ===== TEXT TO HTML CONVERSION FUNCTIONS (NEW ADDITION) =====

/**
 * Utility function to safely escape HTML characters (from text converter)
 */
function escapeHtmlCharacters(text) {
    if (typeof text !== 'string') return '';
    return text
        .replace(/&/g, '&amp;')
        .replace(/</g, '&lt;')
        .replace(/>/g, '&gt;')
        .replace(/"/g, '&quot;')
        .replace(/'/g, '&#39;');
}

function getLocalizedText(key, fallback) {
    const translated = translate(key);
    if (translated && translated !== `[${key}]`) {
        return translated;
    }
    return fallback;
}

/**
 * Function to convert URLs to clickable links (from text converter)
 */
function makeLinksClickable(text) {
    if (typeof text !== 'string') return '';
    // More robust URL regex that handles various URL formats
    const urlRegex = /(https?:\/\/(?:[-\w.])+(?::[0-9]+)?(?:\/(?:[\w/_.])*)?(?:\?(?:[\w&=%.])*)?(?:#(?:[\w.])*)?)/gi;
    return text.replace(urlRegex, function(url) {
        // Ensure the URL doesn't break HTML structure
        const cleanUrl = url.replace(/['"<>]/g, '');
        return `<a href="${cleanUrl}" target="_blank" rel="noopener noreferrer">${cleanUrl}</a>`;
    });
}

/**
 * Convert plain text to formatted HTML using exact same logic from text converter
 * @param {string} inputText - The plain text to convert
 * @returns {string} - The formatted HTML
 */
function convertTextToHtml(inputText) {
    try {
        if (!inputText || !inputText.trim()) {
            return '<p>No content available.</p>';
        }
        
        // Use the same conversion options as the text converter
        const preserveLineBreaks = true;
        const createParagraphs = true;
        const linkifyUrlsEnabled = true;
        const escapeHtmlEnabled = true;
        
        let processedText = inputText;
        
        // Step 1: Escape HTML characters if enabled (do this first)
        if (escapeHtmlEnabled) {
            processedText = escapeHtmlCharacters(processedText);
        }
        
        // Step 2: Convert URLs to links if enabled (do this after escaping)
        if (linkifyUrlsEnabled) {
            processedText = makeLinksClickable(processedText);
        }
        
        // Step 3: Handle paragraphs and line breaks (exact same logic from converter)
        if (createParagraphs) {
            // Split by double line breaks to create paragraphs
            const paragraphs = processedText.split(/\n\s*\n/);
            processedText = paragraphs
                .filter(function(p) { return p.trim().length > 0; })
                .map(function(p) {
                    let paragraph = p.trim();
                    if (preserveLineBreaks) {
                        paragraph = paragraph.replace(/\n/g, '<br>');
                    }
                    return `<p>${paragraph}</p>`;
                })
                .join('\n');
        } else if (preserveLineBreaks) {
            processedText = processedText.replace(/\n/g, '<br>');
        }
        
        // If no paragraphs and no line breaks, wrap in a paragraph
        if (!createParagraphs && !preserveLineBreaks && processedText.trim()) {
            processedText = `<p>${processedText}</p>`;
        }
        
        return processedText || '<p>No content to display.</p>';
        
    } catch (error) {
        console.error('Error during text conversion:', error);
        return '<div class="error">Error converting text to HTML. Please try again.</div>';
    }
}


// ===== PUNYCODE UTILITY FUNCTIONS (NEW ADDITION) =====
/**
 * Convert domain to punycode format for storage
 * @param {string} domain - Domain to convert
 * @returns {string} Punycode domain
 */
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
    } catch (error) {
        return domain;
    }
}

/**
 * Convert domain from punycode to Unicode for display
 * @param {string} domain - Punycode domain to convert
 * @returns {string} Unicode domain
 */
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
    } catch (error) {
        return domain;
    }
}

/**
 * Normalize domain for comparison (convert to punycode)
 * @param {string} domain - Domain to normalize
 * @returns {string} Normalized domain
 */
function normalizeDomain(domain) {
    if (!domain || typeof domain !== 'string') {
        return domain;
    }
    
    return domainToPunycode(domain.trim().toLowerCase());
}

// ===== WHITELIST FUNCTIONS (NEW ADDITION) =====

/**
 * Get current tab domain using activeTab API
 * @returns {Promise<string|null>} Current domain or null
 */
async function getCurrentTabDomain() {
    try {
        
        // Check if we have the necessary permissions
        if (!browser.tabs || !browser.tabs.query) {
            return null;
        }
        
        // Use activeTab API to get current active tab
        const tabs = await browser.tabs.query({ 
            active: true, 
            currentWindow: true 
        });
        
        if (!tabs || tabs.length === 0) {
            return null;
        }
        
        const currentTab = tabs[0];
        
        if (!currentTab.url) {
            return null;
        }
        
        // Skip special browser pages that can't be whitelisted
        // List of special URL prefixes and hostnames to skip
        const specialPrefixes = [
            'chrome://',
            'chrome-extension://',
            'moz-extension://',
            'about:',
            'edge://',
            'opera://',
            'file://'
        ];
        const specialHostnames = [
            'addons.mozilla.org',
            'accounts-static.cdn.mozilla.net',
            'accounts.firefox.com',
            'addons.cdn.mozilla.net',
            'api.accounts.firefox.com',
            'content.cdn.mozilla.net',
            'discovery.addons.mozilla.org',
            'install.mozilla.org',
            'oauth.accounts.firefox.com',
            'profile.accounts.firefox.com',
            'support.mozilla.org',
            'sync.services.mozilla.com'
        ];

        // Check for special prefixes
        if (specialPrefixes.some(prefix => currentTab.url.startsWith(prefix))) {
            return null;
        }

        // Check for special hostnames after parsing URL
        try {
            const urlObj = new URL(currentTab.url);
            if (specialHostnames.includes(urlObj.hostname)) {
            return null;
            }
        } catch (e) {
            // Ignore URL parse errors here, will be handled below
        }
        
        try {
            const url = new URL(currentTab.url);
            const domain = url.hostname;
            
            // Skip empty or invalid hostnames
            if (!domain || domain === '') {
                return null;
            }
            
            return domain;
            
        } catch (urlError) {
            return null;
        }
        
    } catch (error) {
        return null;
    }
}

/**
 * Load whitelist from background script
 * @returns {Promise<Array>} Whitelist array
 */
async function loadWhitelist() {
    try {
        const response = await browser.runtime.sendMessage({
            function: "getData",
            params: ["userWhitelist"]
        });
        
        const whitelist = response.response || [];
        userWhitelist = Array.isArray(whitelist) ? whitelist : [];
        return userWhitelist;
    } catch (error) {
        
        // Fallback to direct storage
        try {
            const value = await getFromStorageDirectly("userWhitelist");
            const whitelist = value || [];
            userWhitelist = Array.isArray(whitelist) ? whitelist : [];
            return userWhitelist;
        } catch (directError) {
            userWhitelist = [];
            return [];
        }
    }
}

/**
 * Handle whitelist change (add/remove domain)
 * @param {string} domain - Domain to add/remove (in punycode)
 * @param {boolean} shouldAdd - True to add, false to remove
 * @returns {Promise<boolean>} Success status
 */
async function handleWhitelistChange(domain, shouldAdd) {
    try {
        const action = shouldAdd ? "addToWhitelist" : "removeFromWhitelist";
        
        const response = await browser.runtime.sendMessage({
            function: action,
            params: [domain]
        });
        
        if (response && response.response) {
            return true;
        } else {
            return false;
        }
    } catch (error) {
        
        // Fallback to direct storage
        try {
            const currentWhitelist = await getFromStorageDirectly("userWhitelist") || [];
            let updatedWhitelist = Array.isArray(currentWhitelist) ? currentWhitelist : [];
            
            if (shouldAdd) {
                if (!updatedWhitelist.includes(domain)) {
                    updatedWhitelist = [...updatedWhitelist, domain];
                }
            } else {
                updatedWhitelist = updatedWhitelist.filter(d => d !== domain);
            }
            
            await browser.storage.local.set({
                userWhitelist: JSON.stringify(updatedWhitelist)
            });
            
            return true;
        } catch (storageError) {
            return false;
        }
    }
}

/**
 * Handle dynamic whitelist toggle button click
 */
async function handleDynamicWhitelistToggle() {
    // Get current domain using activeTab API
    const domain = await getCurrentTabDomain();
    
    if (!domain) {
        const errorMsg = translate('errorMessages_getCurrentDomain') || 
                        'Unable to access this page. Whitelist is only available for regular websites (not browser pages like chrome://, about:, etc.)';
        alert(errorMsg);
        return;
    }

    const asciiDomain = normalizeDomain(domain);
    const isWhitelisted = Array.isArray(userWhitelist) && userWhitelist.some(d => 
        normalizeDomain(d) === asciiDomain
    );
    
    const unicodeDomain = domainToUnicode(domain);
    const displayDomain = asciiDomain !== unicodeDomain ? 
        `${unicodeDomain} (${asciiDomain})` : domain;
    
    // Get button for immediate feedback
    const button = document.getElementById('singledynamicwhitelistunwhitelistbutton');
    
    // Show loading state immediately
    if (button) {
        const loadingTemplateKey = isWhitelisted
            ? 'popup_dynamic_whitelist_loading_remove'
            : 'popup_dynamic_whitelist_loading_add';
        const loadingTemplateFallback = isWhitelisted
            ? 'Removing %s...'
            : 'Adding %s...';
        const loadingText = getLocalizedText(loadingTemplateKey, loadingTemplateFallback)
            .replace('%s', displayDomain);
        button.textContent = loadingText;
        button.setAttribute('title', loadingText);
        button.setAttribute('aria-label', loadingText);
        button.disabled = true;
        applyPopupLanguageLayout();
    }
    
    // Update local state immediately for instant UI response
    if (!isWhitelisted) {
        // Adding to whitelist
        if (!userWhitelist.includes(asciiDomain)) {
            userWhitelist.push(asciiDomain);
        }
    } else {
        // Removing from whitelist
        userWhitelist = userWhitelist.filter(d => d !== asciiDomain);
    }
    
    // Update button immediately with new state
    await updateDynamicWhitelistButton();
    
    // Now try to sync with backend
    const success = await handleWhitelistChange(asciiDomain, !isWhitelisted);
    
    if (success) {
        // Show success feedback
        // Brief success indication without overriding theme colors.
        if (button) {
            button.disabled = false;
            button.classList.add('whitelist-feedback-success');
            setTimeout(() => {
                button.classList.remove('whitelist-feedback-success');
            }, 800);
        }
    } else {
        // Revert local state on failure
        if (!isWhitelisted) {
            // Failed to add, remove from local state
            userWhitelist = userWhitelist.filter(d => d !== asciiDomain);
        } else {
            // Failed to remove, add back to local state
            if (!userWhitelist.includes(asciiDomain)) {
                userWhitelist.push(asciiDomain);
            }
        }
        
        // Update button back to original state
        await updateDynamicWhitelistButton();
        
        // Show error with domain name
        const errorMsg = translate('whitelist_update_failed') || 
                        `Failed to update whitelist for ${displayDomain}`;
        alert(errorMsg);
        
        if (button) {
            button.disabled = false;
        }
    }
}

/**
 * Update dynamic whitelist button text and visibility
 */
async function updateDynamicWhitelistButton() {
    await waitForPopupI18n();

    const button = document.getElementById('singledynamicwhitelistunwhitelistbutton');
    
    if (!button) {
        return;
    }
    
    // Get current domain using activeTab API
    const domain = await getCurrentTabDomain();
    
    if (!domain) {
        // Show button with generic text as fallback
        button.style.display = 'block';
        const fallbackText = getPopupI18nMessage(
            'addcurrentdomain_to_whitelist',
            undefined,
            'Add current domain to whitelist'
        );
        const unavailableTitle = getLocalizedText(
            'popup_dynamic_whitelist_unavailable_title',
            'Cannot detect domain for this page'
        );
        const unavailableAria = getLocalizedText(
            'popup_dynamic_whitelist_unavailable_aria',
            'Whitelist button disabled because this page has no supported domain'
        );
        button.textContent = fallbackText;
        button.disabled = true;
        button.setAttribute('title', unavailableTitle);
        button.setAttribute('aria-label', unavailableAria);
        applyPopupLanguageLayout();
        return;
    }

    const asciiDomain = normalizeDomain(domain);
    const isWhitelisted = Array.isArray(userWhitelist) && userWhitelist.some(d => 
        normalizeDomain(d) === asciiDomain
    );

    // Create clear, prominent domain display
    const unicodeDomain = domainToUnicode(domain);
    const displayDomain = asciiDomain !== unicodeDomain ? 
        `${unicodeDomain} (${asciiDomain})` : domain;
    
    // Create descriptive button text with action and domain prominently displayed
    let buttonText = '';
    if (isWhitelisted) {
        buttonText = getPopupI18nMessage('removeDomainFromWhitelist', [displayDomain], `Remove ${displayDomain} from whitelist`);
    } else {
        buttonText = getPopupI18nMessage('addDomainToWhitelist', [displayDomain], `Add ${displayDomain} to whitelist`);
    }
    
    // Update button properties
    button.textContent = buttonText;
    button.style.display = 'block';
    button.disabled = false; // Ensure button is enabled
    button.setAttribute('title', buttonText);
    button.setAttribute('aria-label', buttonText);
    
    // Update visual state classes for proper styling
    button.classList.remove('whitelisted', 'not-whitelisted');
    if (isWhitelisted) {
        button.classList.add('whitelisted');
    } else {
        button.classList.add('not-whitelisted');
    }

    applyPopupLanguageLayout();
    
    // Set helpful tooltip with current status

    
}

/**
 * Update all dynamic buttons
 */
async function updateAllDynamicButtons() {
    await updateDynamicWhitelistButton();
    // Add other dynamic button updates here if needed
}

// ===== ORIGINAL FUNCTIONS (UNCHANGED) =====

/**
 * Initialize navigation system
 */
function initializeNavigation() {
    const navItems = document.querySelectorAll('.nav-item');
    const mainContent = document.getElementById('mainContent');
    const licenseContent = document.getElementById('licenseContent');
    
    if (!navItems.length || !mainContent || !licenseContent) {
        return;
    }
    
    // Set initial state - main content visible
    showMainContent();
    
    navItems.forEach(navItem => {
        navItem.addEventListener('click', () => {
            const target = navItem.getAttribute('data-target');
            
            // Remove active class from all nav items
            navItems.forEach(item => item.classList.remove('active'));
            
            // Add active class to clicked nav item
            navItem.classList.add('active');
            
            // Show appropriate content
            if (target === 'mainContent') {
                showMainContent();
            } else if (target === 'licenseContent') {
                showLicenseContent();
            }
        });
    });
}

/**
 * Show main content and hide license content
 */
function showMainContent() {
    const mainContent = document.getElementById('mainContent');
    const licenseContent = document.getElementById('licenseContent');
    
    if (mainContent && licenseContent) {
        mainContent.style.display = 'flex';
        licenseContent.style.display = 'none';
    }
}

/**
 * Show license content and hide main content
 */
function showLicenseContent() {
    const mainContent = document.getElementById('mainContent');
    const licenseContent = document.getElementById('licenseContent');
    
    if (mainContent && licenseContent) {
        mainContent.style.display = 'none';
        licenseContent.style.display = 'block';
    }
}

/**
 * Initialize theme system
 */
function initializeTheme() {
    const themeToggle = document.getElementById('themeToggle');
    document.documentElement.setAttribute('data-theme', normalizeTheme(document.documentElement.getAttribute('data-theme') || DEFAULT_THEME));

    browser.storage.local.get([THEME_STORAGE_KEY]).then((result) => {
        const savedTheme = result[THEME_STORAGE_KEY] || DEFAULT_THEME;
        document.documentElement.setAttribute('data-theme', normalizeTheme(savedTheme));
        syncBootstrapTheme(savedTheme);
    }).catch(() => {
        document.documentElement.setAttribute('data-theme', normalizeTheme(DEFAULT_THEME));
        syncBootstrapTheme(DEFAULT_THEME);
    });

    if (themeToggle) {
        themeToggle.onclick = async () => {
            const currentTheme = normalizeTheme(document.documentElement.getAttribute('data-theme') || DEFAULT_THEME);
            const result = await browser.storage.local.get([
                LAST_DARK_THEME_STORAGE_KEY,
                LIGHT_THEME_STORAGE_KEY,
                DARK_THEME_STORAGE_KEY
            ]);
            const { nextTheme: newTheme, payload: updatePayload } = buildThemeTogglePayload(currentTheme, result);
            document.documentElement.setAttribute('data-theme', normalizeTheme(newTheme));
            syncBootstrapTheme(newTheme);
            await browser.storage.local.set(updatePayload);
        };
    }
}


/**
 * Initialize storage change listener with LinkumoriI18n integration
 */
function initializeStorageListener() {
    // Define the storage change handler
    const storageChangeHandler = (changes, areaName) => {
        try {
            
            // Handle specific storage changes
            Object.keys(changes).forEach(key => {
                const { oldValue, newValue } = changes[key];
                
                switch (key) {
                    case 'cleanedCounter':
                        cleanedCounter = newValue || 0;
                        // Use the new localized statistics update
                        updateStatisticsWithLocalization();
                        break;
                        
                    case 'totalCounter':
                        totalCounter = newValue || 0;
                        // Use the new localized statistics update
                        updateStatisticsWithLocalization();
                        break;
                        
                    case 'globalStatus':
                        globalStatus = newValue;
                        setSwitchButton('globalStatus', 'globalStatus');
                        changeVisibility('globalStatus', 'globalStatus');
                        break;
                        
                    case 'badgedStatus':
                        badgedStatus = newValue;
                        setSwitchButton('tabcounter', 'badgedStatus');
                        changeVisibility('tabcounter', 'badgedStatus');
                        break;
                        
                    case 'loggingStatus':
                        loggingStatus = newValue;
                        setSwitchButton('logging', 'loggingStatus');
                        changeVisibility('logging', 'loggingStatus');
                        break;
                        
                    case 'statisticsStatus':
                        statisticsStatus = newValue;
                        setSwitchButton('statistics', 'statisticsStatus');
                        changeVisibility('statistics', 'statisticsStatus');
                        break;
                    case THEME_STORAGE_KEY:
                        if (typeof newValue === 'string' && newValue.trim() !== '') {
                            document.documentElement.setAttribute('data-theme', normalizeTheme(newValue));
                            syncBootstrapTheme(newValue);
                        }
                        break;
                    case 'userWhitelist':
                        // Update whitelist and dynamic button
                        let parsedWhitelist = newValue;
                        if (typeof newValue === 'string') {
                            try {
                                parsedWhitelist = JSON.parse(newValue);
                            } catch (parseError) {
                                parsedWhitelist = [];
                            }
                        }
                        userWhitelist = Array.isArray(parsedWhitelist) ? parsedWhitelist : [];
                        updateAllDynamicButtons();
                        break;
                    case 'temporaryPauseUntil':
                        loadTemporaryPauseState().then(() => {
                            renderTemporaryPauseState();
                        });
                        break;
                        
                    default:
                        break;
                }
            });
        } catch (error) {
        }
    };
    
    // Add the listener
    if (browser.storage && browser.storage.onChanged) {
        browser.storage.onChanged.addListener(storageChangeHandler);
    }
}

/**
 * FIXED: Direct storage access as fallback when background script is suspended
 */
async function getFromStorageDirectly(key) {
    try {
        const result = await browser.storage.local.get([key]);
        
        let value = result[key];
        
        // Handle JSON parsing for specific keys
        if (value && typeof value === 'string') {
            try {
                switch(key) {
                    case 'ClearURLsData':
                    case 'log':
                    case 'userWhitelist':
                        value = JSON.parse(value);
                        break;
                    case 'types':
                        value = value.split(',');
                        break;
                }
            } catch (e) {
            }
        }
        
        return value;
        
    } catch (error) {
        return getDefaultValue(key);
    }
}

/**
 * Get default value for a data key
 */
function getDefaultValue(key) {
    switch(key) {
        case 'cleanedCounter':
        case 'totalCounter':
            return 0;
        case 'globalStatus':
        case 'badgedStatus':
        case 'statisticsStatus':
            return true;
        case 'loggingStatus':
            return false;
        case 'getCurrentURL':
            return '';
        case 'hashStatus':
            return 'no_rules_loaded';
        case 'userWhitelist':
            return [];
        default:
            return null;
    }
}

function formatLocalizedNumber(value, options = {}) {
    const numericValue = Number(value);
    if (!Number.isFinite(numericValue)) {
        return '0';
    }

    const i18n = getPopupI18n();
    if (i18n) {
        if (typeof i18n.formatNumber === 'function') {
            return i18n.formatNumber(numericValue, options);
        }
        if (typeof i18n.localizeNumbers === 'function') {
            return i18n.localizeNumbers(numericValue.toLocaleString(undefined, options));
        }
    }

    return numericValue.toLocaleString(undefined, options);
}

function formatPauseRemaining(ms) {
    const safeMs = Number(ms) || 0;
    if (safeMs <= 0) {
        return translate('popup_pause_less_than_minute');
    }

    const totalMinutes = Math.ceil(safeMs / 60000);
    if (totalMinutes < 60) {
        return `${formatLocalizedNumber(totalMinutes, { maximumFractionDigits: 0 })} ${translate('popup_pause_unit_min_short')}`;
    }

    const hours = Math.floor(totalMinutes / 60);
    const minutes = totalMinutes % 60;
    if (minutes === 0) {
        return `${formatLocalizedNumber(hours, { maximumFractionDigits: 0 })} ${translate('popup_pause_unit_hour_short')}`;
    }
    return `${formatLocalizedNumber(hours, { maximumFractionDigits: 0 })}${translate('popup_pause_unit_hour_short')} ${formatLocalizedNumber(minutes, { maximumFractionDigits: 0 })}${translate('popup_pause_unit_min_short')}`;
}

async function loadTemporaryPauseState() {
    try {
        const response = await browser.runtime.sendMessage({
            function: "getTemporaryPauseState",
            params: []
        });
        temporaryPauseState = response?.response || temporaryPauseState;
    } catch (error) {
        temporaryPauseState = {
            isPaused: false,
            mode: 'none',
            until: null,
            remainingMs: 0
        };
    }
}

function renderTemporaryPauseState() {
    const statusEl = document.getElementById('temporaryPauseStatus');
    if (!statusEl) {
        return;
    }

    if (!temporaryPauseState || !temporaryPauseState.isPaused) {
        statusEl.textContent = translate('popup_pause_status_active');
        applyPopupLanguageLayout();
        return;
    }

    if (temporaryPauseState.mode === 'until_restart') {
        statusEl.textContent = translate('popup_pause_status_until_restart');
        applyPopupLanguageLayout();
        return;
    }

    const remainingText = formatPauseRemaining(temporaryPauseState.remainingMs);
    statusEl.textContent = translate('popup_pause_status_timed').replace('%s', remainingText);
    applyPopupLanguageLayout();
}

async function setTemporaryPause(minutes = null) {
    try {
        const functionName = minutes === null ? 'pauseCleaningUntilRestart' : 'pauseCleaningTemporarily';
        const params = minutes === null ? [] : [minutes];
        const response = await browser.runtime.sendMessage({
            function: functionName,
            params
        });

        temporaryPauseState = response?.response || temporaryPauseState;
        renderTemporaryPauseState();
    } catch (error) {
        alert(translate('popup_pause_error_update'));
    }
}

async function clearTemporaryPause() {
    try {
        const response = await browser.runtime.sendMessage({
            function: "resumeCleaningNow",
            params: []
        });
        temporaryPauseState = response?.response || temporaryPauseState;
        renderTemporaryPauseState();
    } catch (error) {
        alert(translate('popup_pause_error_resume'));
    }
}

/**
 * Refresh all data from storage
 */
async function refreshAllData() {
    try {
        
        await loadData("cleanedCounter");
        await loadData("totalCounter");
        await loadData("globalStatus");
        await loadData("badgedStatus");
        await loadData("loggingStatus");
        await loadData("statisticsStatus");
        await loadTemporaryPauseState();
        // Load whitelist
        await loadWhitelist();
        
        // Update UI
        setSwitchButton("globalStatus", "globalStatus");
        setSwitchButton("tabcounter", "badgedStatus");
        setSwitchButton("logging", "loggingStatus");
        setSwitchButton("statistics", "statisticsStatus");
        
        // Use promise-based approach for statistics
        updateStatisticsWithLocalization();
        
        // Update visibility
        changeVisibility('globalStatus', 'globalStatus');
        changeVisibility('tabcounter', 'badgedStatus');
        changeVisibility('logging', 'loggingStatus');
        changeVisibility('statistics', 'statisticsStatus');
        
        // Update dynamic buttons
        await updateAllDynamicButtons();
        renderTemporaryPauseState();
        
    } catch (error) {
    }
}

/**
 * Cleanup function for when popup is closed
 */
function cleanup() {
}

/**
 * Handle window unload event
 */
window.addEventListener('beforeunload', cleanup);

/**
 * Handle window focus event to refresh data
 */
window.addEventListener('focus', () => {
    refreshAllData().catch(error => {
    });
});

/**
 * Handle visibility change to refresh data when popup becomes visible
 */
document.addEventListener('visibilitychange', () => {
    if (!document.hidden) {
        refreshAllData().catch(error => {
        });
    }
});

/**
 * Add keyboard shortcuts for manual refresh and debugging
 */
document.addEventListener('keydown', (event) => {
    // Ctrl+R or F5 for manual refresh
    if ((event.ctrlKey && event.key === 'r') || event.key === 'F5') {
        event.preventDefault();
        refreshAllData().catch(error => {
        });
    }
    
    // Ctrl+D for debug info
    if (event.ctrlKey && event.key === 'd') {
        event.preventDefault();
    }
});

/**
* Initialize the UI.
*/
function init() {
    
    // Initialize theme first
    initializeTheme();
    
    // Initialize navigation system
    initializeNavigation();
    
    // Initialize storage change listener
    initializeStorageListener();
    
    setSwitchButton("globalStatus", "globalStatus");
    setSwitchButton("tabcounter", "badgedStatus");
    setSwitchButton("logging", "loggingStatus");
    setSwitchButton("statistics", "statisticsStatus");
    
    // Use promise-based approach for statistics
    updateStatisticsWithLocalization();
    
    // Update visibility
    changeVisibility('globalStatus', 'globalStatus');
    changeVisibility('tabcounter', 'badgedStatus');
    changeVisibility('logging', 'loggingStatus');
    changeVisibility('statistics', 'statisticsStatus');
    renderTemporaryPauseState();
    
    // Log bundled rules status for debugging
    logBundledRulesStatus();
}

function applyLoadedPopupState() {
    setSwitchButton("globalStatus", "globalStatus");
    setSwitchButton("tabcounter", "badgedStatus");
    setSwitchButton("logging", "loggingStatus");
    setSwitchButton("statistics", "statisticsStatus");
    updateStatisticsWithLocalization();
    changeVisibility('globalStatus', 'globalStatus');
    changeVisibility('tabcounter', 'badgedStatus');
    changeVisibility('logging', 'loggingStatus');
    changeVisibility('statistics', 'statisticsStatus');
    renderTemporaryPauseState();
}

/**
* FIXED: Better statistics calculation with LinkumoriI18n localization
*/
/**
* FIXED: Simplified statistics calculation - direct LinkumoriI18n conversion
* Replace the existing changeStatistics() function with this version
*/
function changeStatistics() {
    try {
        if (!element) element = document.getElementById('statistics_value');
        if (!elGlobalPercentage) elGlobalPercentage = document.getElementById('statistics_value_global_percentage');
        if (!elProgressbar_blocked) elProgressbar_blocked = document.getElementById('progress_blocked');
        if (!elTotal) elTotal = document.getElementById('statistics_total_elements');
        
        if (!element || !elGlobalPercentage || !elProgressbar_blocked || !elTotal) {
            setTimeout(() => changeStatistics(), 100);
            return;
        }

        // Ensure we have valid numbers
        const cleaned = cleanedCounter || 0;
        const total = totalCounter || 0;

        // Calculate percentage: clamped to [0, 100], 1 decimal max, no trailing zero
        let percentage = 0;
        if (total > 0 && cleaned > 0) {
            percentage = Math.min(100, (cleaned / total) * 100);
        }
        percentage = parseFloat(percentage.toFixed(1));
        if (isNaN(percentage)) percentage = 0;

        globalPercentage = percentage;

        // Format values with locale-aware grouping/digits.
        const localizedCleaned = formatLocalizedNumber(cleaned, { maximumFractionDigits: 0 });
        const localizedTotal = formatLocalizedNumber(total, { maximumFractionDigits: 0 });
        const localizedPercentage = formatLocalizedNumber(percentage, { maximumFractionDigits: 1 });

        // Get localized percentage symbol
        const percentageSymbol = getPopupI18nMessage('percentage_symbol', undefined, '%');

        // Update elements with localized numbers
        element.textContent = localizedCleaned;
        elGlobalPercentage.textContent = localizedPercentage + percentageSymbol;
        elTotal.textContent = localizedTotal;

        // Progress bar width (always use standard percentage for CSS)
        elProgressbar_blocked.style.width = percentage + '%';
        
    } catch (error) {
        console.error('Error in changeStatistics:', error);
    }
}

/**
 * Enhanced function to update statistics with better LinkumoriI18n integration
 * Uses promise-based approach with LinkumoriI18n.ready().then() for consistency
 */
function updateStatisticsWithLocalization() {
    const i18n = getPopupI18n();
    if (i18n && typeof i18n.isReady === 'function' && !i18n.isReady() && typeof i18n.ready === 'function') {
        // Use promise-based approach
        i18n.ready().then(() => {
            changeStatistics();
        }).catch(error => {
            console.error('Error waiting for LinkumoriI18n:', error);
            // Fallback to standard statistics update
            changeStatistics();
        });
    } else {
        // Already ready or not available
        changeStatistics();
    }
}

/**
* Log bundled rules status for debugging
*/
function logBundledRulesStatus() {
    browser.runtime.sendMessage({
        function: "getData",
        params: ["ClearURLsData"]
    }).then(data => {
        const rulesData = data.response;
        if (rulesData && rulesData.providers) {
            const providerCount = Object.keys(rulesData.providers).length;
        }
    }).catch(error => {
        // Don't fail completely if this doesn't work
    });
}

/**
* Set the value of a switch button.
* @param {string} id      HTML id
* @param {string} varname js internal variable name
*/
function setSwitchButton(id, varname) {
    const element = document.getElementById(id);
    if (!element) {
        return;
    }
    
    let isActive = false;
    
    // Get the current value from the variable
    switch(varname) {
        case "globalStatus":
            isActive = globalStatus;
            break;
        case "badgedStatus":
            isActive = badgedStatus;
            break;
        case "loggingStatus":
            isActive = loggingStatus;
            break;
        case "statisticsStatus":
            isActive = statisticsStatus;
            break;
        default:
            isActive = false;
            break;
    }
    
    // Update the visual state
    if (isActive) {
        element.classList.add('active');
    } else {
        element.classList.remove('active');
    }
}

/**
* Change the value of a switch button.
* @param  {string} id        HTML id
* @param  {string} storageID storage internal id
*/
function changeSwitchButton(id, storageID) {
    let element = document.getElementById(id);
    
    if (!element) {
        return;
    }

    // Set initial visibility
    changeVisibility(id, storageID);

    element.onclick = async function(){
        const isActive = element.classList.contains('active');
        const newValue = !isActive;
        
        if (newValue) {
            element.classList.add('active');
        } else {
            element.classList.remove('active');
        }

        try {
            // Try background script first
            await browser.runtime.sendMessage({
                function: "setData",
                params: [storageID, newValue]
            });
            
            if(storageID === "globalStatus"){
                try {
                    await browser.runtime.sendMessage({
                        function: "changeIcon",
                        params: []
                    });
                } catch (iconError) {
                }
            }
            
            changeVisibility(id, storageID);

            try {
                await browser.runtime.sendMessage({
                    function: "saveOnExit",
                    params: []
                });
            } catch (saveError) {
            }
            
        } catch (error) {
            
            // FIXED: Fallback to direct storage when background script is suspended
            try {
                await browser.storage.local.set({[storageID]: newValue});
                changeVisibility(id, storageID);
            } catch (storageError) {
                // Revert UI change on complete failure
                if (newValue) {
                    element.classList.remove('active');
                } else {
                    element.classList.add('active');
                }
            }
        }
    };
}

/**
* Change the visibility of sections.
*/
function changeVisibility(id, storageID) {
    let element;

    switch(storageID) {
        case "loggingStatus":
            element = document.getElementById('log_section');
            break;
        case "statisticsStatus":
            element = document.getElementById('statistic_section');
            break;
        default:
            return;
    }

    if(element) {
        const toggleElement = document.getElementById(id);
        let isActive;
        
        if (toggleElement && toggleElement.classList.contains('active')) {
            isActive = true;
        } else {
            switch(storageID) {
                case "loggingStatus":
                    isActive = loggingStatus;
                    break;
                case "statisticsStatus":
                    isActive = statisticsStatus;
                    break;
                default:
                    isActive = false;
            }
        }
        
        if(isActive) {
            element.style.display = 'block';
        } else {
            element.style.display = 'none';
        }
    }
}

/**
* FIXED: Reset the global statistic with better error handling
*/
async function resetGlobalCounter() {
    try {
        // Try background script first
        await Promise.all([
            browser.runtime.sendMessage({
                function: "setData",
                params: ['cleanedCounter', 0]
            }),
            browser.runtime.sendMessage({
                function: "setData",
                params: ['totalCounter', 0]
            })
        ]);

        try {
            await browser.runtime.sendMessage({
                function: "saveOnExit",
                params: []
            });
        } catch (saveError) {
        }
        
    } catch (error) {
        
        // FIXED: Fallback to direct storage
        try {
            await browser.storage.local.set({
                'cleanedCounter': 0,
                'totalCounter': 0
            });
        } catch (storageError) {
            return; // Don't update UI if we couldn't save
        }
    }

    // Update local variables and UI
    cleanedCounter = 0;
    totalCounter = 0;
    updateStatisticsWithLocalization();
    
    // Show feedback
    const resetBtn = document.getElementById('reset_counter_btn');
    if (resetBtn) {
        const originalText = resetBtn.textContent;
        const originalBg = resetBtn.style.backgroundColor;
        
        // Use promise-based approach for localized feedback
        waitForPopupI18n().then((i18n) => {
            resetBtn.textContent = (i18n && typeof i18n.getMessage === 'function')
                ? (i18n.getMessage('statistics_reset_success') || originalText)
                : originalText;
        }).catch(() => {
            resetBtn.textContent = originalText;
        });
        
        resetBtn.style.backgroundColor = '#28a745';
        
        setTimeout(() => {
            resetBtn.textContent = originalText;
            resetBtn.style.backgroundColor = originalBg;
        }, 1500);
    }
}

/**
 * FIXED: Robust data loading with direct storage fallback
 * This ensures popup always loads even when background script is suspended
 */
async function loadData(name, varName = name) {
    try {
        
        // Try background script first (with short timeout)
        try {
            const data = await Promise.race([
                browser.runtime.sendMessage({
                    function: "getData",
                    params: [name]
                }),
                new Promise((_, reject) => 
                    setTimeout(() => reject(new Error('Background script timeout')), 1000)
                )
            ]);
            
            // FIXED: Use global variables instead of eval()
            setGlobalVariable(varName, data.response !== undefined ? data.response : getDefaultValue(name));
            return data;
            
        } catch (backgroundError) {
            
            // Fallback to direct storage
            const value = await getFromStorageDirectly(name);
            setGlobalVariable(varName, value !== undefined ? value : getDefaultValue(name));
            return { response: getGlobalVariable(varName) };
        }
        
    } catch (error) {
        
        // Set default value
        setGlobalVariable(varName, getDefaultValue(name));
        return { response: getGlobalVariable(varName) };
    }
}

/**
 * FIXED: Helper function to set global variables safely
 */
function setGlobalVariable(varName, value) {
    switch(varName) {
        case 'cleanedCounter':
            cleanedCounter = value;
            break;
        case 'totalCounter':
            totalCounter = value;
            break;
        case 'globalStatus':
            globalStatus = value;
            break;
        case 'badgedStatus':
            badgedStatus = value;
            break;
        case 'hashStatus':
            hashStatus = value;
            break;
        case 'loggingStatus':
            loggingStatus = value;
            break;
        case 'statisticsStatus':
            statisticsStatus = value;
            break;
        case 'currentURL':
            currentURL = value;
            break;
        default:
            break;
    }
}

/**
 * FIXED: Helper function to get global variables safely (no eval)
 */
function getGlobalVariable(varName) {
    switch(varName) {
        case 'cleanedCounter':
            return cleanedCounter;
        case 'totalCounter':
            return totalCounter;
        case 'globalStatus':
            return globalStatus;
        case 'badgedStatus':
            return badgedStatus;
        case 'hashStatus':
            return hashStatus;
        case 'loggingStatus':
            return loggingStatus;
        case 'statisticsStatus':
            return statisticsStatus;
        case 'currentURL':
            return currentURL;
        default:
            return null;
    }
}

/**
* FIXED: Initialize the popup with robust error handling and LinkumoriI18n integration
* This ensures the popup ALWAYS displays something, even if background script is suspended
*/
(async function initializePopup() {
    try {
        const i18nReadyPromise = waitForPopupI18n();
        const consentGatePromise = i18nReadyPromise
            .then(() => initializePopupConsentGate())
            .catch(() => initializePopupConsentGate().catch(() => {}));

        // Paint the popup immediately, then refresh when LinkumoriI18n is ready.
        init();
        setText();
        
        // FIXED: Load data with better error handling - don't fail completely if some data can't be loaded
        const dataPromises = [
            loadData("cleanedCounter").catch(error => {
                cleanedCounter = 0;
                return { response: 0 };
            }),
            loadData("totalCounter").catch(error => {
                totalCounter = 0;
                return { response: 0 };
            }),
            loadData("globalStatus").catch(error => {
                globalStatus = true;
                return { response: true };
            }),
            loadData("badgedStatus").catch(error => {
                badgedStatus = true;
                return { response: true };
            }),
            loadData("hashStatus").catch(error => {
                hashStatus = 'no_data';
                return { response: 'no_data' };
            }),
            loadData("loggingStatus").catch(error => {
                loggingStatus = false;
                return { response: false };
            }),
            loadData("statisticsStatus").catch(error => {
                statisticsStatus = true;
                return { response: true };
            }),
            loadData("getCurrentURL", "currentURL").catch(error => {
                currentURL = '';
                return { response: '' };
            }),
            loadTemporaryPauseState().catch(() => {
                temporaryPauseState = {
                    isPaused: false,
                    mode: 'none',
                    until: null,
                    remainingMs: 0
                };
                return { response: temporaryPauseState };
            }),
            loadWhitelist().catch(error => {
                userWhitelist = [];
                return [];
            })
        ];
        
        // Set up event handlers
        const resetBtn = document.getElementById('reset_counter_btn');
        if (resetBtn) {
            resetBtn.onclick = resetGlobalCounter;
        }
        
        // Set up dynamic whitelist button with activeTab API
        const dynamicWhitelistBtn = document.getElementById('singledynamicwhitelistunwhitelistbutton');
        if (dynamicWhitelistBtn) {
            dynamicWhitelistBtn.addEventListener('click', handleDynamicWhitelistToggle);
            
            // Force show the button initially
            dynamicWhitelistBtn.style.display = 'block';
            const detectingText = getLocalizedText('popup_dynamic_whitelist_detecting', 'Detecting domain...');
            dynamicWhitelistBtn.textContent = detectingText;
            dynamicWhitelistBtn.setAttribute('title', detectingText);
            dynamicWhitelistBtn.setAttribute('aria-label', detectingText);
            applyPopupLanguageLayout();
        }
        
        // Set up toggle switches
        changeSwitchButton("globalStatus", "globalStatus");
        changeSwitchButton("tabcounter", "badgedStatus");
        changeSwitchButton("logging", "loggingStatus");
        changeSwitchButton("statistics", "statisticsStatus");
        renderTemporaryPauseState();

        const pause15mBtn = document.getElementById('pause15mBtn');
        if (pause15mBtn) {
            pause15mBtn.onclick = () => setTemporaryPause(15);
        }

        const pause1hBtn = document.getElementById('pause1hBtn');
        if (pause1hBtn) {
            pause1hBtn.onclick = () => setTemporaryPause(60);
        }

        const pauseUntilRestartBtn = document.getElementById('pauseUntilRestartBtn');
        if (pauseUntilRestartBtn) {
            pauseUntilRestartBtn.onclick = () => setTemporaryPause(null);
        }

        const resumePauseBtn = document.getElementById('resumePauseBtn');
        if (resumePauseBtn) {
            resumePauseBtn.onclick = clearTemporaryPause;
        }
        
        // Set up navigation links
        const loggingPage = document.getElementById('loggingPage');
        if (loggingPage) {
            loggingPage.onclick = () => {
                browser.tabs.create({url: browser.runtime.getURL('./html/log.html')});
            };
        }
        
        const settingsBtn = document.getElementById('settings');
        if (settingsBtn) {
            settingsBtn.onclick = () => {
                browser.tabs.create({url: browser.runtime.getURL('./html/settings.html')});
            };
        }
        
        const cleaningToolsBtn = document.getElementById('cleaning_tools_icon');
        if (cleaningToolsBtn) {
            cleaningToolsBtn.onclick = () => {
                browser.tabs.create({url: browser.runtime.getURL('./html/cleaningTool.html')});
            };
        }
        const customrulesBtn =document.getElementById('customrules');
        if (customrulesBtn) {
            customrulesBtn.onclick = () => {
                browser.tabs.create({url: browser.runtime.getURL('./html/customrules.html')})
            }
        }

        const whitelistPageBtn = document.getElementById('whitelist_page');
        if (whitelistPageBtn) {
            whitelistPageBtn.onclick = () => {
                localStorage.setItem('customrules-active-view', 'whitelist');
                browser.tabs.create({url: browser.runtime.getURL('./html/customrules.html')});
            };
        }
        
        // Set up legal link
        const legalLink = document.getElementById('legalLink');
        if (legalLink) {
            legalLink.onclick = () => {
                browser.tabs.create({url: browser.runtime.getURL('./html/legal.html')});
            };
        }
        
        
        // Hydrate stored state without blocking first render.
        Promise.all(dataPromises).then(async () => {
            applyLoadedPopupState();

            try {
                await updateAllDynamicButtons();
            } catch (buttonError) {
                const button = document.getElementById('singledynamicwhitelistunwhitelistbutton');
                if (button) {
                    button.style.display = 'block';
                    const fallbackText = getLocalizedText('addcurrentdomain_to_whitelist', 'Add current domain to whitelist');
                    button.textContent = fallbackText;
                    button.setAttribute('title', fallbackText);
                    button.setAttribute('aria-label', fallbackText);
                    applyPopupLanguageLayout();
                }
            }
        }).catch(() => {});
        
        // Also try updating after a short delay to ensure everything is ready
        setTimeout(async () => {
            try {
                await updateAllDynamicButtons();
            } catch (delayedError) {
            }
        }, 500);
        
        // Re-apply text once LinkumoriI18n finishes loading the preferred language.
        i18nReadyPromise.then(() => {
            setText();
            updateStatisticsWithLocalization();
            renderTemporaryPauseState();
        }).catch(error => {
            setText();
            changeStatistics();
        });

        await consentGatePromise;
    } catch (error) {
        
        // EMERGENCY FALLBACK: Initialize with defaults and basic UI
        cleanedCounter = 0;
        totalCounter = 0;
        globalStatus = true;
        badgedStatus = true;
        loggingStatus = false;
        statisticsStatus = true;
        currentURL = '';
        userWhitelist = [];
        
        // Still try to initialize basic UI
        try {
            init();
            setText();
            waitForPopupI18n().then(() => {
                setText();
                // Even in fallback, try to update statistics with localization
                updateStatisticsWithLocalization();
            }).catch(() => {
                setText();
                changeStatistics();
            });
        } catch (uiError) {
        }
    }
})();

/**
* Set the text for the UI.
*/
function setText() {
    
    try {
        document.title = translate('popup_html_page_title');

        // Set navigation labels
        injectText('nav_main_label', 'popup_nav_main');
        injectText('nav_license_label', 'popup_nav_license');
        
        // Set toggle labels and tooltips
        injectText('configs_switch_filter', 'popup_html_configs_switch_filter');
        injectText('configs_switch_log', 'popup_html_configs_switch_log');
        injectText('configs_switch_badges', 'popup_html_configs_switch_badges');
        injectText('configs_switch_statistics', 'configs_switch_statistics');
        injectText('temporaryPauseTitle', 'popup_temporary_pause_title');
        injectText('pause15mBtn', 'popup_pause_15m');
        injectText('pause1hBtn', 'popup_pause_1h');
        injectText('pauseUntilRestartBtn', 'popup_pause_until_restart');
        injectText('resumePauseBtn', 'popup_pause_resume_now');
        
        // Set statistics labels and tooltips
        injectText('statistics_elements', 'popup_html_statistics_elements');
        injectText('statistics_blocked', 'popup_html_statistics_blocked');
        injectText('statistics_percentage', 'popup_html_statistics_percentage');
        
        // Set button labels and tooltips
        injectText('reset_counter_btn', 'popup_html_statistics_reset_button');
        injectText('loggingPage', 'popup_html_log_head');
        injectText('settings', 'popup_html_settings_button');
        injectText('customrules', 'customrules');
        injectText('whitelist_page', 'popup_html_whitelist_button');
        const cleaningToolsIcon = document.getElementById('cleaning_tools_icon');
        if (cleaningToolsIcon) {
            const toolsTitle = translate('popup_html_tools_button_title');
            cleaningToolsIcon.setAttribute('title', toolsTitle);
            cleaningToolsIcon.setAttribute('aria-label', toolsTitle);
        }
        const themeToggle = document.getElementById('themeToggle');
        if (themeToggle) {
            const themeAria = getLocalizedText('popup_theme_toggle_aria', 'Toggle theme');
            themeToggle.setAttribute('title', themeAria);
            themeToggle.setAttribute('aria-label', themeAria);
        }

        // Consent gate text
        injectText('popupConsentTitle', 'popup_consent_title');
        injectText('popupConsentDescription', 'popup_consent_description');
        injectText('popupConsentCheckboxLabel', 'popup_consent_checkbox');
        injectText('popupConsentLegalLink', 'popup_consent_legal_button');
        injectText('popupConsentAccept', 'popup_consent_accept_button');

        // Set license section titles (only titles are translatable)
        injectText('license_title', 'license_title');
        injectText('license_description', 'popup_html_license_description');
        injectText('license_links_title', 'license_links_title');
        injectText('license_third_party_title', 'license_third_party_title');
        injectText('license_version_label', 'popup_html_version_label');
        injectText('license_firefox_signature_label', 'popup_html_firefox_signature_title');
        const signatureTitle = translate('popup_html_firefox_signature_title');
        if (signatureTitle && signatureTitle !== '[popup_html_firefox_signature_title]') {
            const signatureLabelElement = document.getElementById('license_firefox_signature_label');
            if (signatureLabelElement) {
                signatureLabelElement.setAttribute('title', signatureTitle);
            }
            const signatureValueElement = document.getElementById('license_firefox_signature_value');
            if (signatureValueElement && !signatureValueElement.getAttribute('title')) {
                signatureValueElement.setAttribute('title', signatureTitle);
            }
        }
        injectText('legalLink', 'popup_consent_legal_button');
        injectText('license_lgpl_link', 'popup_html_lgpl_link');
        injectText('license_source_repo_link', 'popup_html_source_code_repository');
        injectText('license_source_repo_link_direct', 'popup_html_source_code_releases');
        injectText('license_report_issues_link', 'popup_html_report_issues');
        injectText('license_clearurls_migration_link', 'popup_html_clearurls_migration_repository');
        injectText('license_clearurls_addon_link', 'popup_html_clearurls_addon_repository');
        
        // Set license version (get from manifest or version element)
        const versionElement = document.getElementById('version');
        const licenseVersionElement = document.getElementById('license_version');
        const nameElement = document.getElementById('name');
        const licenseNameElement = document.getElementById('license_name');
        if (versionElement && licenseVersionElement) {
            // Wait a bit for the version to be set by write_version.js
            setTimeout(() => {
                const version = versionElement.textContent || 'Unknown';
                const i18n = getPopupI18n();
                const localizedVersion = (i18n && typeof i18n.localizeNumbers === 'function')
                    ? i18n.localizeNumbers(version)
                    : version;
                versionElement.textContent = localizedVersion;
                licenseVersionElement.textContent = localizedVersion;
                if (nameElement && licenseNameElement) {
                    licenseNameElement.textContent = nameElement.textContent || '';
                    if (nameElement.getAttribute('title')) {
                        licenseNameElement.setAttribute('title', nameElement.getAttribute('title'));
                    }
                }
                applyPopupLanguageLayout();
            }, 100);
        }

        updateFirefoxSignatureDisplay();
        applyPopupLanguageLayout();
        
    } catch (error) {
        // Don't fail completely if text setting fails
    }
}

function updateFirefoxSignatureDisplay() {
    (async () => {
        try {
            const signatureElement = document.getElementById('license_firefox_signature_value');
            if (!signatureElement) {
                return;
            }
            const signatureTitle = translate('popup_html_firefox_signature_title');

            if (!firefoxSignatureHash) {
                firefoxSignatureHash = await resolveFirefoxSignatureHash();
            }

            if (firefoxSignatureHash) {
                signatureElement.textContent = firefoxSignatureHash;
                if (signatureTitle && signatureTitle !== '[popup_html_firefox_signature_title]') {
                    signatureElement.setAttribute('title', `${signatureTitle} ${firefoxSignatureHash}`);
                } else {
                    signatureElement.setAttribute('title', firefoxSignatureHash);
                }
                return;
            }

            const unavailable = translate('popup_html_firefox_signature_unavailable');
            signatureElement.textContent = (unavailable && unavailable !== '[popup_html_firefox_signature_unavailable]')
                ? unavailable
                : 'Unavailable since it is unsigned';
            signatureElement.removeAttribute('title');
        } catch (error) {
        }
    })();
}

async function resolveFirefoxSignatureHash() {
    if (typeof browser === 'undefined' || !browser.runtime || typeof browser.runtime.getURL !== 'function') {
        return '';
    }

    const candidates = [
        'META-INF/MOZILLA.SF',
        'META-INF/mozilla.sf'
    ];

    for (const candidate of candidates) {
        try {
            const url = browser.runtime.getURL(candidate);
            const response = await fetch(url, { cache: 'no-store' });
            if (!response || !response.ok) {
                continue;
            }

            const text = await response.text();
            if (!text || text.trim() === '') {
                continue;
            }

            const digest = extractSfManifestDigest(text);
            if (digest) {
                return digest;
            }
        } catch (error) {
            // Try next candidate path.
        }
    }

    return '';
}

function extractSfManifestDigest(signatureText) {
    const lines = signatureText.split(/\r?\n/);

    for (let i = 0; i < lines.length; i++) {
        const match = lines[i].match(/^SHA256-Digest-Manifest:\s*(.*)$/i);
        if (!match) {
            continue;
        }

        let value = (match[1] || '').trim();

        // Support folded continuation lines in RFC822-style signature files.
        while (i + 1 < lines.length && /^\s+/.test(lines[i + 1])) {
            value += lines[i + 1].trim();
            i++;
        }

        return value;
    }

    return '';
}

/**
* Helper function to inject the translated text and tooltip.
* @param   {string}    id ID of the HTML element
* @param   {string}    attribute Name of the attribute used for localization
*/
function injectText(id, attribute) {
    try {
        const object = document.getElementById(id);
        if (!object) {
            return;
        }
        
        const translatedText = translate(attribute);
        if (translatedText && translatedText !== `[${attribute}]`) {
            object.textContent = translatedText;
        } else {
            // Fallback to a generic label if translation fails
            const fallbackText = getFallbackText(attribute, id);
            object.textContent = fallbackText;
        }

        const tooltip = translate(attribute + "_title");
        if (tooltip && tooltip !== "" && tooltip !== `[${attribute}_title]`) {
            object.setAttribute('title', tooltip);
            if (object.matches('button, a, input, [role="button"]')) {
                object.setAttribute('aria-label', tooltip);
            }
        } else if (object.matches('button, a, input, [role="button"]') && object.textContent) {
            object.setAttribute('aria-label', object.textContent);
        }
    } catch (error) {
    }
}

/**
* Get fallback text when translation is not available
* @param {string} attribute Translation attribute name
* @param {string} id Element ID
* @returns {string} Fallback text
*/
function getFallbackText(attribute, id) {
    // Provide English fallbacks for navigation and license section titles only
    const fallbacks = {
        'popup_nav_main': 'Main',
        'popup_nav_license': 'License',
        'license_title': 'License',
        'license_description': 'View detailed license and privacy information by clicking the Legal link below.',
        'license_links_title': 'Links',
        'popup_html_version_label': 'Version:',
        'popup_html_firefox_signature_title': 'Firefox Add-on Signature',
        'popup_html_firefox_signature_unavailable': 'Unavailable since it is unsigned',
        'popup_html_gpl_link': 'GNU General Public License v3.0',
        'popup_html_lgpl_link': 'GNU General Lesser Public License v3.0',
        'popup_html_source_code_repository': 'Source Code Repository',
        'popup_html_source_code_releases': 'Source Code Releases',
        'popup_html_report_issues': 'Report Issues',
        'popup_html_clearurls_migration_repository': 'ClearURLs MV3 Migration Repository',
        'popup_html_clearurls_addon_repository': 'ClearURLs addons V1.27.3 Repository',
        'license_third_party_title': 'Third Party Components',
        'popup_consent_title': 'Consent required',
        'popup_consent_description': 'Please read Privacy Policy and License. We do not collect data. All data stays on your device and is not transmitted to us.',
        'popup_consent_checkbox': 'I have read and accept the Privacy Policy and License.',
        'popup_consent_legal_button': 'Read Legal',
        'popup_consent_accept_button': 'Accept and continue',
        'popup_html_whitelist_button': 'Whitelist'
    };
    
    return fallbacks[attribute] || id.replace(/_/g, ' ').replace(/([A-Z])/g, ' $1').trim();
}

/**
* Translate a string with the i18n API.
* @param {string} string Name of the attribute used for localization
*/
function translate(key) {
    try {
        return getPopupI18nMessage(key, undefined, `[${key}]`);
    } catch (error) {
        return `[${key}]`;
    }
}

/**
* Handle errors gracefully
* @param {Error} error
*/
function handleError(error) {
}
