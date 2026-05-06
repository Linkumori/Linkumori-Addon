/*
 * ============================================================
 * Linkumori — LinkumoriI18n
 * Next-Gen Extension & Web Internationalization Engine
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
 * DESCRIPTION
 * -----------
 * JavaScript implementation of the WebExtension i18n.getMessage
 * API. Version 3.1 (Production Ready with Date Formatting).
 *
 * Features:
 * - Promise-based initialization with bulletproof timing
 * - Dynamic language switching without page reloads
 * - Silent by default, optional debug mode
 * - Drop-in replacement for browser.i18n.getMessage
 * - Automatic error handling and graceful fallbacks
 * - 60+ languages with native names and regional variants
 * - Localized date and time formatting via messages.json
 *
 * Usage:
 * LinkumoriI18n.ready(() => {
 *     const text = translate('my_message', ['substitution']);
 *     const formattedDate = LinkumoriI18n.formatDate(
 *         new Date(), 'YYYY-MM-DD HH:mm:ss'
 *     );
 * });
 *
 * ============================================================
 * MODIFICATION HISTORY
 * ============================================================
 * 2025-06-14   Subham Mahesh   File created
 * 2025-08-12   Subham Mahesh   Second modification
 * 2025-08-14   Subham Mahesh   Third modification
 * 2025-08-19   Subham Mahesh   Fourth modification
 * 2025-09-05   Subham Mahesh   Fifth modification
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
const LinkumoriI18n = (() => {
    // Language mappings with proper display names (FIXED ENCODING)
    const LANGUAGE_MAPPINGS = {
        'ar': { name: 'Arabic', region: '', native: 'العربية' },
        'am': { name: 'Amharic', region: '', native: 'አማርኛ' },
        'bg': { name: 'Bulgarian', region: '', native: 'български' },
        'bn': { name: 'Bengali', region: '', native: 'বাংলা' },
        'ca': { name: 'Catalan', region: '', native: 'Català' },
        'cs': { name: 'Czech', region: '', native: 'Čeština' },
        'da': { name: 'Danish', region: '', native: 'Dansk' },
        'de': { name: 'German', region: '', native: 'Deutsch' },
        'el': { name: 'Greek', region: '', native: 'Ελληνικά' },
        'en': { name: 'English', region: '', native: 'English' },
        'en_AU': { name: 'English', region: 'Australia', native: 'English (Australia)' },
        'en_GB': { name: 'English', region: 'Great Britain', native: 'English (UK)' },
        'en_US': { name: 'English', region: 'USA', native: 'English (US)' },
        'es': { name: 'Spanish', region: '', native: 'Español' },
        'es_419': { name: 'Spanish', region: 'Latin America', native: 'Español (Latinoamérica)' },
        'et': { name: 'Estonian', region: '', native: 'Eesti' },
        'fa': { name: 'Persian', region: '', native: 'فارسی' },
        'fi': { name: 'Finnish', region: '', native: 'Suomi' },
        'fil': { name: 'Filipino', region: '', native: 'Filipino' },
        'fr': { name: 'French', region: '', native: 'Français' },
        'gu': { name: 'Gujarati', region: '', native: 'ગુજરાતી' },
        'he': { name: 'Hebrew', region: '', native: 'עברית' },
        'hi': { name: 'Hindi', region: '', native: 'हिन्दी' },
        'hr': { name: 'Croatian', region: '', native: 'Hrvatski' },
        'hu': { name: 'Hungarian', region: '', native: 'Magyar' },
        'id': { name: 'Indonesian', region: '', native: 'Bahasa Indonesia' },
        'it': { name: 'Italian', region: '', native: 'Italiano' },
        'ja': { name: 'Japanese', region: '', native: '日本語' },
        'kn': { name: 'Kannada', region: '', native: 'ಕನ್ನಡ' },
        'ko': { name: 'Korean', region: '', native: '한국어' },
        'lt': { name: 'Lithuanian', region: '', native: 'Lietuvių' },
        'lv': { name: 'Latvian', region: '', native: 'Latviešu' },
        'ml': { name: 'Malayalam', region: '', native: 'മലയാളം' },
        'mr': { name: 'Marathi', region: '', native: 'मराठी' },
        'ms': { name: 'Malay', region: '', native: 'Bahasa Melayu' },
        'nl': { name: 'Dutch', region: '', native: 'Nederlands' },
        'no': { name: 'Norwegian', region: '', native: 'Norsk' },
        'pl': { name: 'Polish', region: '', native: 'Polski' },
        'pt_BR': { name: 'Portuguese', region: 'Brazil', native: 'Português (Brasil)' },
        'pt_PT': { name: 'Portuguese', region: 'Portugal', native: 'Português (Portugal)' },
        'ro': { name: 'Romanian', region: '', native: 'Română' },
        'ru': { name: 'Russian', region: '', native: 'Русский' },
        'sk': { name: 'Slovak', region: '', native: 'Slovenčina' },
        'sl': { name: 'Slovenian', region: '', native: 'Slovenščina' },
        'sr': { name: 'Serbian', region: '', native: 'Српски' },
        'sv': { name: 'Swedish', region: '', native: 'Svenska' },
        'sw': { name: 'Swahili', region: '', native: 'Kiswahili' },
        'ta': { name: 'Tamil', region: '', native: 'தமிழ்' },
        'te': { name: 'Telugu', region: '', native: 'తెలుగు' },
        'th': { name: 'Thai', region: '', native: 'ไทย' },
        'tr': { name: 'Turkish', region: '', native: 'Türkçe' },
        'uk': { name: 'Ukrainian', region: '', native: 'Українська' },
        'vi': { name: 'Vietnamese', region: '', native: 'Tiếng Việt' },
        'zh_CN': { name: 'Chinese', region: 'Mainland China', native: '中文 (简体)' },
        'zh_TW': { name: 'Chinese', region: 'Taiwan and Mainland china', native: '中文 (繁體)' }
    };

    // State management
    let currentLanguage = 'en';
    let currentMessages = {};
    let availableLanguages = [];
    let observers = [];
    
    // Initialization state management
    let initializationState = 'pending'; // 'pending', 'initializing', 'ready', 'failed'
    let initializationPromise = null;
    let initializationError = null;
    const readyCallbacks = [];
    
    // Browser API compatibility
    let browserAPI = null;
    
    /**
     * Better browser API detection with timeout
     */
    const detectBrowserAPI = () => {
        return new Promise((resolve, reject) => {
            let attempts = 0;
            const maxAttempts = 50; // 5 seconds max
            
            const checkAPI = () => {
                attempts++;
                
                // Check for browser APIs
                if (typeof browser !== 'undefined' && browser.runtime) {
                    browserAPI = browser;
                    resolve(browser);
                    return;
                }
                
                if (typeof chrome !== 'undefined' && chrome.runtime) {
                    browserAPI = chrome;
                    resolve(chrome);
                    return;
                }
                
                // Retry or timeout
                if (attempts < maxAttempts) {
                    setTimeout(checkAPI, 100);
                } else {
                    reject(new Error('Browser extension APIs not available'));
                }
            };
            
            checkAPI();
        });
    };

    /**
     * Promise-based initialization with retry mechanism
     */
    const init = async (options = {}) => {
        // Return existing promise if already initializing
        if (initializationPromise) {
            return initializationPromise;
        }
        
        // Return immediately if already ready
        if (initializationState === 'ready') {
            return Promise.resolve();
        }
        
        // Return error if previously failed (unless force retry)
        if (initializationState === 'failed' && !options.forceRetry) {
            return Promise.reject(initializationError);
        }
        
        initializationState = 'initializing';
        
        initializationPromise = (async () => {
            try {
                // Wait for browser APIs to be available
                await detectBrowserAPI();
                
                // Detect available languages
                await detectAvailableLanguages();
                
                // Get saved or detect current language
                const detectedLang = await getPreferredLanguage();
                
                // Load the language
                await loadLanguage(detectedLang);
                
                // Set up language selector
                await setupLanguageSelector();
                
                // Mark as ready
                initializationState = 'ready';
                initializationError = null;
                
                // Notify all waiting callbacks
                readyCallbacks.forEach(callback => {
                    try {
                        callback();
                    } catch (error) {
                        // Silent error handling for callback failures
                    }
                });
                readyCallbacks.length = 0; // Clear the array
                
            } catch (error) {
                initializationState = 'failed';
                initializationError = error;
                
                // Fallback to basic functionality
                currentLanguage = 'en';
                await loadFallbackMessages();
                
                throw error;
            }
        })();
        
        return initializationPromise;
    };

    /**
     * Ready state checking and callback system
     */
    const ready = (callback) => {
        if (typeof callback !== 'function') {
            // Return promise if no callback provided
            return new Promise((resolve) => {
                ready(resolve);
            });
        }
        
        if (initializationState === 'ready') {
            // Already ready, call immediately
            setTimeout(callback, 0);
        } else {
            // Add to queue
            readyCallbacks.push(callback);
            
            // Start initialization if not started
            if (initializationState === 'pending') {
                init().catch(error => {
                    // Silent error handling for auto-initialization failures
                });
            }
        }
    };

    /**
     * Check if the library is ready to use
     */
    const isReady = () => {
        return initializationState === 'ready';
    };

    /**
     * Get initialization state
     */
    const getInitializationState = () => {
        return {
            state: initializationState,
            error: initializationError,
            isReady: initializationState === 'ready'
        };
    };

    /**
     * Extract language code from locale (e.g., 'ar-SA' -> 'ar')
     */
    const extractLanguageCode = (locale) => {
        return locale.split('-')[0].toLowerCase();
    };

    /**
     * Detect available languages from _locales directory
     */
  /**
 * Detect available languages from _locales directory with cross-browser compatibility
 */
const detectAvailableLanguages = async () => {
    const languages = [];
    
    // Better error handling and validation for cross-browser compatibility
    const checkLanguage = async (langCode) => {
        try {
            const url = browserAPI.runtime.getURL(`_locales/${langCode}/messages.json`);
            const controller = new AbortController();
            const timeoutId = setTimeout(() => controller.abort(), 5000);
            
            const response = await fetch(url, {
                signal: controller.signal
            });
            
            clearTimeout(timeoutId);
            
            // First check if response is ok
            if (!response.ok) {
                return false;
            }
            
            // CRITICAL FIX: Validate the response content
            try {
                const text = await response.text();
                
                // Check if response is empty (Firefox sometimes returns empty 200 responses)
                if (!text || text.trim().length === 0) {
                    return false;
                }
                
                // Validate JSON structure
                const json = JSON.parse(text);
                
                // Ensure it's an object with at least one valid message
                if (!json || typeof json !== 'object' || Object.keys(json).length === 0) {
                    return false;
                }
                
                // Verify at least one message has proper structure
                const hasValidMessage = Object.values(json).some(msg => 
                    msg && typeof msg === 'object' && typeof msg.message === 'string'
                );
                
                return hasValidMessage;
                
            } catch (parseError) {
                // Invalid JSON or parsing error
                return false;
            }
            
        } catch (error) {
            return false;
        }
    };
    
    // Check languages in parallel but with concurrency limit
    const languageCodes = Object.keys(LANGUAGE_MAPPINGS);
    const concurrency = 5; // Check 5 languages at a time
    
    for (let i = 0; i < languageCodes.length; i += concurrency) {
        const batch = languageCodes.slice(i, i + concurrency);
        const results = await Promise.all(
            batch.map(async (langCode) => ({
                langCode,
                available: await checkLanguage(langCode)
            }))
        );
        
        results.forEach(({ langCode, available }) => {
            if (available) {
                languages.push(langCode);
            }
        });
    }
    
    // Fallback: ensure at least English is available
    if (languages.length === 0) {
        languages.push('en');
    }
    
    availableLanguages = languages.sort();
    
};

    /**
     * Get preferred language from storage or browser detection
     */
    const getPreferredLanguage = async () => {
        try {
            // Better storage error handling
            let savedLang = null;
            try {
                const result = await browserAPI.storage.sync.get('linkumori_language');
                savedLang = result.linkumori_language;
            } catch (storageError) {
                // Storage access failed, using browser language
            }
            
            if (savedLang && availableLanguages.includes(savedLang)) {
                return savedLang;
            }
            
            // Fallback to browser UI language detection
            const browserLang = browserAPI.i18n.getUILanguage();
            
            // Try exact match first
            if (availableLanguages.includes(browserLang)) {
                return browserLang;
            }
            
            // Try base language (e.g., 'en' from 'en-US')
            const baseLang = browserLang.split('-')[0];
            if (availableLanguages.includes(baseLang)) {
                return baseLang;
            }
            
            // Try regional variants
            const regionalVariants = availableLanguages.filter(lang => lang.startsWith(baseLang + '_'));
            if (regionalVariants.length > 0) {
                return regionalVariants[0];
            }
            
            // Final fallback to English
            return availableLanguages.includes('en') ? 'en' : availableLanguages[0];
            
        } catch (error) {
            return 'en';
        }
    };

    /**
     * Load language messages from file
     */
    const loadLanguage = async (langCode) => {
        if (!availableLanguages.includes(langCode)) {
            langCode = 'en';
        }

        try {
            const url = browserAPI.runtime.getURL(`_locales/${langCode}/messages.json`);
            const controller = new AbortController();
            const timeoutId = setTimeout(() => controller.abort(), 10000); // 10 second timeout
            
            const response = await fetch(url, {
                signal: controller.signal
            });
            
            clearTimeout(timeoutId);
            
            if (!response.ok) {
                throw new Error(`Failed to load ${langCode}: ${response.status}`);
            }
            
            const messages = await response.json();
            currentMessages = messages;
            currentLanguage = langCode;
            
            // Better storage error handling
            try {
                await browserAPI.storage.sync.set({ linkumori_language: langCode });
            } catch (storageError) {
                // Failed to save language preference
            }
            
            // Notify observers
            notifyObservers();
            
        } catch (error) {
            
            // If not English, try English as fallback
            if (langCode !== 'en') {
                await loadLanguage('en');
            } else {
                // Even English failed, use hardcoded fallback
                await loadFallbackMessages();
            }
        }
    };

    /**
     * Load minimal fallback state when everything fails
     */
    const loadFallbackMessages = async () => {
        currentMessages = {};
        currentLanguage = 'en';
    };

    /**
     * Set up the language selector dropdown
     */
    const setupLanguageSelector = async () => {
        const selector = document.getElementById('languageSelector');
        if (!selector) return;

        // Clear existing options
        selector.innerHTML = '';

        // Add available languages
        for (const langCode of availableLanguages) {
            const option = document.createElement('option');
            option.value = langCode;
            
            const langInfo = LANGUAGE_MAPPINGS[langCode];
            let displayName = langInfo.native;
            
            // Add region if specified
            if (langInfo.region) {
                displayName = `${langInfo.native} - ${langInfo.region}`;
            }
            
            option.textContent = displayName;
            option.selected = langCode === currentLanguage;
            
            selector.appendChild(option);
        }

        // Set up change handler
        selector.addEventListener('change', async (e) => {
            const newLang = e.target.value;
            if (newLang && newLang !== currentLanguage) {
                await changeLanguage(newLang);
            }
        });

        // Remove loading state
        selector.disabled = false;
        selector.classList.remove('language-loading');
    };

    /**
     * Change the current language
     */
    const changeLanguage = async (langCode) => {
        if (!availableLanguages.includes(langCode)) {
            return;
        }

        const selector = document.getElementById('languageSelector');
        
        try {
            // Show loading state
            if (selector) {
                selector.disabled = true;
                selector.classList.add('language-loading');
            }

            // Load new language
            await loadLanguage(langCode);
            
            // Update selector
            if (selector) {
                selector.value = langCode;
                selector.classList.remove('language-error');
                selector.classList.add('language-success');
                
                // Remove success state after 2 seconds
                setTimeout(() => {
                    selector.classList.remove('language-success');
                }, 2000);
            }

            // Show status message
            showLanguageChangeStatus(langCode, 'success');

        } catch (error) {
            if (selector) {
                selector.classList.add('language-error');
                selector.value = currentLanguage; // Revert to current language
            }
            
            showLanguageChangeStatus(langCode, 'error');
        } finally {
            if (selector) {
                selector.disabled = false;
                selector.classList.remove('language-loading');
            }
        }
    };

    /**
     * Show language change status message
     */
    const showLanguageChangeStatus = (langCode, type) => {
        const statusElement = document.getElementById('statusMessage');
        if (!statusElement) return;

        const langInfo = LANGUAGE_MAPPINGS[langCode];
        let message;
        
        if (type === 'success') {
            message = getMessage('status_language_changed_success', langInfo.native);
            statusElement.className = 'status-message status-success';
        } else {
            message = getMessage('status_language_change_failed', langInfo.native);
            statusElement.className = 'status-message status-error';
        }
        
        statusElement.textContent = message;
        statusElement.style.display = 'block';
        
        // Auto-hide after 3 seconds
        setTimeout(() => {
            statusElement.style.display = 'none';
        }, 3000);
    };

    /**
     * Safe getMessage with better error handling (removed validation)
     */
    const getMessage = (messageName, substitutions, options = {}) => {
        // Check if ready first
        if (initializationState !== 'ready') {
            return messageName;
        }
        
        // Get the message data
        const messageData = currentMessages[messageName];
        if (!messageData || !messageData.message) {
            return messageName; // Return key as fallback
        }

        let message = messageData.message;
        
        // Normalize substitutions to array
        let subsArray = [];
        if (substitutions !== undefined && substitutions !== null) {
            if (Array.isArray(substitutions)) {
                subsArray = substitutions;
            } else {
                subsArray = [substitutions];
            }
        }

        // Process placeholders first
        if (messageData.placeholders) {
            for (const [placeholderName, placeholderData] of Object.entries(messageData.placeholders)) {
                if (placeholderData.content) {
                    let content = placeholderData.content;
                    
                    // Replace $n references in content with substitution values
                    content = content.replace(/\$(\d+)/g, (match, n) => {
                        const index = parseInt(n) - 1;
                        return index >= 0 && index < subsArray.length ? String(subsArray[index]) : '';
                    });
                    
                    // Replace placeholder in message (case insensitive)
                    const placeholderRegex = new RegExp(`\\$${placeholderName}\\$`, 'gi');
                    message = message.replace(placeholderRegex, content);
                }
            }
        }

        // Process direct $n substitutions (for any remaining ones)
        message = message.replace(/\$(\d+)/g, (match, n) => {
            const index = parseInt(n) - 1;
            return index >= 0 && index < subsArray.length ? String(subsArray[index]) : '';
        });

        // Handle escaped dollar signs (convert $$ to $)
        message = message.replace(/\$\$/g, '$');

        // Apply HTML escaping if requested
        if (options.escapeLt) {
            message = message.replace(/</g, '&lt;');
        }

        return message;
    };

    /**
     * Get localized month name from messages.json
     */
    const getLocalizedMonth = (monthIndex) => {
        const monthKey = `month_${monthIndex + 1}`;
        return getMessage(monthKey) || `Month ${monthIndex + 1}`;
    };

    /**
     * Get localized day name from messages.json
     */
    const getLocalizedDay = (dayIndex) => {
        const dayKey = `day_${dayIndex}`;
        return getMessage(dayKey) || `Day ${dayIndex}`;
    };

    /**
     * Get localized number from messages.json
     */
    const getLocalizedNumber = (digit) => {
        const numberKey = `number_${digit}`;
        const localized = getMessage(numberKey);
        return localized !== numberKey ? localized : digit.toString();
    };

    /**
     * Localize numbers to the target language's numeral system
     */
    const localizeNumbers = (str) => {
        return String(str).replace(/[0-9]/g, (digit) => {
            return getLocalizedNumber(digit);
        });
    };

    const intlFormatterCache = new Map();

    const getIntlLocale = () => {
        return (currentLanguage || 'en').replace('_', '-');
    };

    const getIntlFormatter = (type, options = {}) => {
        const locale = getIntlLocale();
        const cacheKey = `${type}:${locale}:${JSON.stringify(options)}`;
        if (intlFormatterCache.has(cacheKey)) {
            return intlFormatterCache.get(cacheKey);
        }

        let formatter = null;
        try {
            switch (type) {
                case 'number':
                    formatter = new Intl.NumberFormat(locale, options);
                    break;
                case 'date':
                    formatter = new Intl.DateTimeFormat(locale, options);
                    break;
                case 'relative':
                    formatter = new Intl.RelativeTimeFormat(locale, options);
                    break;
                default:
                    formatter = null;
                    break;
            }
        } catch (_) {
            formatter = null;
        }

        if (formatter) {
            intlFormatterCache.set(cacheKey, formatter);
        }
        return formatter;
    };

    const formatNumber = (value, options = {}) => {
        const numericValue = Number(value);
        if (!Number.isFinite(numericValue)) {
            return localizeNumbers(String(value));
        }

        const formatter = getIntlFormatter('number', options);
        if (formatter) {
            return formatter.format(numericValue);
        }
        return localizeNumbers(String(numericValue));
    };

    const formatTime = (date = new Date(), options = { hour: '2-digit', minute: '2-digit' }) => {
        const targetDate = date instanceof Date ? date : new Date(date);
        if (Number.isNaN(targetDate.getTime())) {
            return getMessage('invalid_date_label') || localizeNumbers('Invalid Date');
        }
        const formatter = getIntlFormatter('date', options);
        if (formatter) {
            return formatter.format(targetDate);
        }
        return formatDate(targetDate, 'HH:mm');
    };

    const formatDateTime = (date = new Date(), options = { dateStyle: 'medium', timeStyle: 'short' }) => {
        const targetDate = date instanceof Date ? date : new Date(date);
        if (Number.isNaN(targetDate.getTime())) {
            return getMessage('invalid_date_label') || localizeNumbers('Invalid Date');
        }
        const formatter = getIntlFormatter('date', options);
        if (formatter) {
            return formatter.format(targetDate);
        }
        return formatDate(targetDate, 'YYYY-MM-DD HH:mm:ss');
    };

    const formatWeekday = (date = new Date(), style = 'long') => {
        const targetDate = date instanceof Date ? date : new Date(date);
        if (Number.isNaN(targetDate.getTime())) {
            return '';
        }
        const formatter = getIntlFormatter('date', { weekday: style });
        if (formatter) {
            return formatter.format(targetDate);
        }
        return getLocalizedDay(targetDate.getDay());
    };

    const getWeekdayNames = (style = 'long', weekStartsOn = 0) => {
        const formatter = getIntlFormatter('date', { weekday: style });
        const baseSunday = new Date(Date.UTC(2024, 0, 7)); // Sunday
        const names = [];
        for (let i = 0; i < 7; i++) {
            const date = new Date(baseSunday);
            date.setUTCDate(baseSunday.getUTCDate() + ((i + weekStartsOn) % 7));
            if (formatter) {
                names.push(formatter.format(date));
            } else {
                names.push(getLocalizedDay((i + weekStartsOn) % 7));
            }
        }
        return names;
    };

    const formatMonth = (date = new Date(), style = 'long') => {
        const targetDate = date instanceof Date ? date : new Date(date);
        if (Number.isNaN(targetDate.getTime())) {
            return '';
        }
        const formatter = getIntlFormatter('date', { month: style });
        if (formatter) {
            return formatter.format(targetDate);
        }
        return getLocalizedMonth(targetDate.getMonth());
    };

    const getMonthNames = (style = 'long') => {
        const formatter = getIntlFormatter('date', { month: style });
        const names = [];
        for (let month = 0; month < 12; month++) {
            const date = new Date(Date.UTC(2024, month, 1));
            names.push(formatter ? formatter.format(date) : getLocalizedMonth(month));
        }
        return names;
    };

    const formatRelativeTime = (input, base = new Date(), options = { numeric: 'auto' }) => {
        const baseDate = base instanceof Date ? base : new Date(base);
        const targetDate = input instanceof Date ? input : new Date(input);
        if (Number.isNaN(baseDate.getTime()) || Number.isNaN(targetDate.getTime())) {
            return getMessage('invalid_date_label') || localizeNumbers('Invalid Date');
        }

        const diffMs = targetDate.getTime() - baseDate.getTime();
        const absMs = Math.abs(diffMs);
        const units = [
            { unit: 'year', ms: 365 * 24 * 60 * 60 * 1000 },
            { unit: 'month', ms: 30 * 24 * 60 * 60 * 1000 },
            { unit: 'week', ms: 7 * 24 * 60 * 60 * 1000 },
            { unit: 'day', ms: 24 * 60 * 60 * 1000 },
            { unit: 'hour', ms: 60 * 60 * 1000 },
            { unit: 'minute', ms: 60 * 1000 },
            { unit: 'second', ms: 1000 }
        ];

        let chosen = units[units.length - 1];
        for (const candidate of units) {
            if (absMs >= candidate.ms) {
                chosen = candidate;
                break;
            }
        }
        const value = Math.round(diffMs / chosen.ms);

        const formatter = getIntlFormatter('relative', options);
        if (formatter) {
            return formatter.format(value, chosen.unit);
        }

        const absoluteValue = Math.abs(value);
        const suffix = value >= 0 ? 'in' : 'ago';
        return `${localizeNumbers(absoluteValue)} ${chosen.unit}${absoluteValue !== 1 ? 's' : ''} ${suffix}`;
    };

    /**
     * Format date with localized support including numbers
     */
    const formatDate = (date, format = 'YYYY-MM-DD HH:mm:ss') => {
        // Ensure we have a valid Date object
        if (!(date instanceof Date)) {
            date = new Date(date);
        }
        
        if (isNaN(date.getTime())) {
            return getMessage('invalid_date_label') || localizeNumbers('Invalid Date');
        }

        // Pad number with leading zeros
        const pad = (num, length = 2) => String(num).padStart(length, '0');
        
        // Get various date components
        const year = date.getFullYear();
        const month = date.getMonth();
        const day = date.getDate();
        const hours = date.getHours();
        const minutes = date.getMinutes();
        const seconds = date.getSeconds();
        const dayOfWeek = date.getDay();
        
        // Create replacements map
        const replacements = {
            // Year
            'YYYY': year,
            'YY': String(year).slice(-2),
            
            // Month
            'MMMM': getLocalizedMonth(month),
            'MM': pad(month + 1),
            'M': month + 1,
            
            // Day
            'DDDD': getLocalizedDay(dayOfWeek),
            'DD': pad(day),
            'D': day,
            
            // Hour (24-hour)
            'HH': pad(hours),
            'H': hours,
            
            // Hour (12-hour)
            'hh': pad(hours === 0 ? 12 : hours > 12 ? hours - 12 : hours),
            'h': hours === 0 ? 12 : hours > 12 ? hours - 12 : hours,
            
            // Minute
            'mm': pad(minutes),
            'm': minutes,
            
            // Second
            'ss': pad(seconds),
            's': seconds,
            
            // AM/PM
            // Fixed - properly localized
'A': hours >= 12 ? getMessage('time_pm') : getMessage('time_am'),
'a': hours >= 12 ? getMessage('time_pm_lower') : getMessage('time_am_lower')
        };
        
        // Replace tokens in format string
        let result = format;
        for (const [token, value] of Object.entries(replacements)) {
            result = result.replace(new RegExp(token, 'g'), value);
        }
        
        // Localize all numbers in the final result
        return localizeNumbers(result);
    };

    /**
     * Format timestamp for logging with current language
     */
    const formatTimestamp = (timestamp = null, format = 'YYYY-MM-DD HH:mm:ss') => {
        const date = timestamp ? new Date(timestamp) : new Date();
        return formatDate(date, format);
    };

    /**
     * Add observer for language changes
     */
    const addObserver = (callback) => {
        observers.push(callback);
    };

    /**
     * Notify all observers of language changes
     */
    const notifyObservers = () => {
        observers.forEach(callback => {
            try {
                callback(currentLanguage, currentMessages);
            } catch (error) {
                // Silent error handling for observer callback failures
            }
        });
    };

    /**
     * Get current language info
     */
    const getCurrentLanguage = () => ({
        code: currentLanguage,
        info: LANGUAGE_MAPPINGS[currentLanguage],
        available: availableLanguages
    });

    /**
     * Check if a language is available
     */
    const isLanguageAvailable = (langCode) => {
        return availableLanguages.includes(langCode);
    };

    /**
     * Get language information
     */
    const getLanguageInfo = (locale = null) => {
        const currentLocale = locale || currentLanguage;
        const langCode = extractLanguageCode(currentLocale);
        
        return {
            locale: currentLocale,
            languageCode: langCode
        };
    };

    /**
     * Get all language mappings
     */
    const getLanguageMappings = () => {
        return { ...LANGUAGE_MAPPINGS }; // Return a copy to prevent modification
    };

    /**
     * Get language mapping for a specific language code
     */
    const getLanguageMapping = (langCode) => {
        return LANGUAGE_MAPPINGS[langCode] || null;
    };

    /**
     * Get all available message names
     */
    const getMessageNames = () => {
        return Object.keys(currentMessages);
    };

    /**
     * Check if a message exists
     */
    const hasMessage = (messageName) => {
        return !!(currentMessages[messageName] && currentMessages[messageName].message);
    };

    /**
     * Get the current locale (alias for getCurrentLanguage)
     */
    const getUILanguage = () => {
        return currentLanguage;
    };

    // Public API
    return {
        // Core methods
        init,
        ready,
        isReady,
        getInitializationState,
        
        // Translation methods
        getMessage,
        translate: getMessage, // Alias
        
        // Date formatting methods
        formatDate,
        formatTimestamp,
        formatDateTime,
        formatTime,
        formatWeekday,
        getWeekdayNames,
        formatMonth,
        getMonthNames,
        formatRelativeTime,
        formatNumber,
        localizeNumbers,
        
        // Language management
        changeLanguage,
        getCurrentLanguage,
        getUILanguage,
        isLanguageAvailable,
        addObserver,
        
        // Language utilities
        getLanguageInfo,
        getLanguageMappings,
        getLanguageMapping,
        
        // Message utilities
        getMessageNames,
        hasMessage
    };
})();

// Auto-initialization with proper timing
(function() {
    let autoInitAttempts = 0;
    const maxAutoInitAttempts = 100; // 10 seconds max
    
    function attemptAutoInit() {
        autoInitAttempts++;
        
        // Check if document is ready
        if (document.readyState === 'loading') {
            if (autoInitAttempts < maxAutoInitAttempts) {
                setTimeout(attemptAutoInit, 100);
            }
            return;
        }
        
        // Start initialization
        LinkumoriI18n.init().catch(error => {
            // Silent error handling for auto-initialization failures
        });
    }
    
    // Start auto-init process
    if (document.readyState === 'loading') {
        document.addEventListener('DOMContentLoaded', attemptAutoInit);
    } else {
        attemptAutoInit();
    }
})();

// Global exports
if (typeof window !== 'undefined') {
    window.LinkumoriI18n = LinkumoriI18n;
    
    // Safe translate function that waits for readiness
    if (typeof translate === 'undefined') {
        window.translate = function(messageName, substitutions, options) {
            if (LinkumoriI18n.isReady()) {
                return LinkumoriI18n.getMessage(messageName, substitutions, options);
            } else {
                return messageName;
            }
        };
        
        // Safe async translate that waits for initialization
        window.translateAsync = async function(messageName, substitutions, options) {
            await LinkumoriI18n.ready();
            return LinkumoriI18n.getMessage(messageName, substitutions, options);
        };
        
        // Global date formatting functions
        window.formatDate = function(date, format) {
            if (LinkumoriI18n.isReady()) {
                return LinkumoriI18n.formatDate(date, format);
            } else {
                return new Date(date).toLocaleString();
            }
        };
        
        window.formatTimestamp = function(timestamp, format) {
            if (LinkumoriI18n.isReady()) {
                return LinkumoriI18n.formatTimestamp(timestamp, format);
            } else {
                return new Date(timestamp || Date.now()).toLocaleString();
            }
        };
        
        window.localizeNumbers = function(str) {
            if (LinkumoriI18n.isReady()) {
                return LinkumoriI18n.localizeNumbers(str);
            } else {
                return str; // Return unchanged if not ready
            }
        };

        window.formatNumber = function(value, options) {
            if (LinkumoriI18n.isReady()) {
                return LinkumoriI18n.formatNumber(value, options);
            }
            return String(value);
        };

        window.formatTime = function(date, options) {
            if (LinkumoriI18n.isReady()) {
                return LinkumoriI18n.formatTime(date, options);
            }
            return new Date(date || Date.now()).toLocaleTimeString();
        };

        window.formatDateTime = function(date, options) {
            if (LinkumoriI18n.isReady()) {
                return LinkumoriI18n.formatDateTime(date, options);
            }
            return new Date(date || Date.now()).toLocaleString();
        };
    }
}
