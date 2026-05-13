/*
 * ============================================================
 * ClearURLs
 * ============================================================
 * Copyright (c) 2017–2025 Kevin Röbert
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
 * - Modified to retrieve additional data
 * - Bundled rule management
 * - Whitelist functionality
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
 *
 * Enhanced message handler with comprehensive error handling and custom rules support
 * @param  request      The message itself. This is a JSON-ifiable object.
 * @param  sender       A runtime.MessageSender object representing the sender of the message.
 * @param  sendResponse A function to call, at most once, to send a response to the message.
 */
function handleMessage(request, sender, sendResponse)
{
    try {
        // Validate request structure
        if (!request || typeof request !== 'object') {
            return Promise.resolve({
                response: false, 
                error: 'Invalid request - must be an object'
            });
        }

        if (!request.function || typeof request.function !== 'string') {
            return Promise.resolve({
                response: false, 
                error: 'Invalid request - missing function property'
            });
        }

        // Handle special cases that require custom logic
        switch (request.function) {
            case "getData":
                return handleGetData(request);
                
            case "setData":
                return handleSetData(request);
                
            case "reloadCustomRules":
                return handleReloadCustomRules(request);
                
            case "getCustomRulesStats":
                return handleGetCustomRulesStats(request);
                
            case "mergeCustomRules":
                return handleMergeCustomRules(request);

            case "getBundledRulesOnly":
                return handleGetBundledRulesOnly();

            case "getExistingLinkumoriDataForImport":
                return handleGetExistingLinkumoriDataForImport();
                
            default:
                // Handle regular function calls
                return handleRegularFunction(request);
        }
    } catch (error) {
        return Promise.resolve({
            response: false, 
            error: `Message handler error: ${error.message}`
        });
    }
}

/**
 * Handle getData requests with enhanced error handling
 */
function handleGetData(request) {
    try {
        const params = Array.isArray(request.params) ? request.params : [];
        const key = params[0];
        
        if (!key || typeof key !== 'string') {
            return Promise.resolve({
                response: null,
                error: 'Invalid key for getData'
            });
        }
        
        if (typeof window.getData === 'function') {
            const result = window.getData(key);
            return Promise.resolve({response: result});
        } else {
            return Promise.resolve({
                response: null,
                error: 'getData function not available'
            });
        }
    } catch (error) {
        return Promise.resolve({
            response: null,
            error: error.message
        });
    }
}

function handleGetBundledRulesOnly() {
    try {
        if (typeof window.getBundledRulesOnly === 'function') {
            return window.getBundledRulesOnly().then(result => ({
                response: result,
                success: true
            })).catch(error => ({
                response: null,
                success: false,
                error: error.message
            }));
        }

        return Promise.resolve({
            response: null,
            success: false,
            error: 'getBundledRulesOnly function not found'
        });
    } catch (error) {
        return Promise.resolve({
            response: null,
            success: false,
            error: error.message
        });
    }
}

function handleGetExistingLinkumoriDataForImport() {
    try {
        if (typeof window.getExistingLinkumoriDataForImport !== 'function') {
            throw new Error('getExistingLinkumoriDataForImport function not available');
        }

        return Promise.resolve({
            response: window.getExistingLinkumoriDataForImport(),
            success: true
        });
    } catch (error) {
        return Promise.resolve({
            response: { rules: [] },
            success: false,
            error: error.message
        });
    }
}

/**
 * Handle setData requests with enhanced error handling and auto-save
 */
function handleSetData(request) {
    try {
        const params = Array.isArray(request.params) ? request.params : [];
        const key = params[0];
        const value = params[1];
        
        if (!key || typeof key !== 'string') {
            return Promise.resolve({
                response: false,
                error: 'Invalid key for setData'
            });
        }
        
        if (typeof window.setData === 'function') {
            window.setData(key, value);
            
            // Auto-save to disk for important data
            if (['custom_rules', 'linkumori_url_custom_rules', 'linkumori_url_disabled_rules', 'userWhitelist', 'ClearURLsData'].includes(key)) {
                if (typeof window.saveOnDisk === 'function') {
                    try {
                        window.saveOnDisk([key]);
                    } catch (error) {
                        // Silent fail for auto-save
                    }
                }
            }
            
            return Promise.resolve({response: "Data saved successfully"});
        } else {
            return Promise.resolve({
                response: false,
                error: 'setData function not available'
            });
        }
    } catch (error) {
        return Promise.resolve({
            response: false,
            error: error.message
        });
    }
}

/**
 * Handle custom rules reloading
 */
function handleReloadCustomRules(request) {
    return new Promise((resolve) => {
        try {
            if (typeof window.reloadCustomRules === 'function') {
                window.reloadCustomRules().then(() => {
                    resolve({
                        response: "Custom rules reloaded successfully",
                        success: true
                    });
                }).catch(error => {
                    resolve({
                        response: "Failed to reload custom rules",
                        success: false,
                        error: error.message
                    });
                });
            } else {
                resolve({
                    response: "Reload function not available",
                    success: false,
                    error: 'reloadCustomRules function not found'
                });
            }
        } catch (error) {
            resolve({
                response: "Failed to reload custom rules",
                success: false,
                error: error.message
            });
        }
    });
}

/**
 * Handle custom rules statistics requests
 */
function handleGetCustomRulesStats(request) {
    try {
        // Get custom rules
        const customRulesRaw = (typeof window.getData === 'function')
            ? window.getData('custom_rules') || { providers: {} }
            : { providers: {} };

        const customRules = (customRulesRaw && typeof customRulesRaw === 'object' && !Array.isArray(customRulesRaw))
            ? (customRulesRaw.providers && typeof customRulesRaw.providers === 'object'
                ? customRulesRaw
                : { providers: customRulesRaw })
            : { providers: {} };

        const customProviderCountStored = Object.keys(customRules.providers || {}).length;
        
        // Get built-in rules
        const mergedRules = (typeof window.getData === 'function')
            ? window.getData('ClearURLsData') || { providers: {} }
            : { providers: {} };

        const totalProviderCountMerged = Object.keys(mergedRules.providers || {}).length;

        // Use merge stats from storage as source of truth for built-in count.
        // "total - custom" is incorrect when custom providers are merged/deduplicated by key.
        const mergeStats = (typeof window.getData === 'function')
            ? window.getData('mergeStats') || {}
            : {};

        const hasMergeCustom = typeof mergeStats.customProviders === 'number';
        const hasMergeBuiltIn = typeof mergeStats.bundledProviders === 'number';
        const hasMergeTotal = typeof mergeStats.totalProviders === 'number';
        const hasMergeDisabled = typeof mergeStats.disabledProviders === 'number';

        const customProviderCount = hasMergeCustom
            ? Math.max(0, mergeStats.customProviders)
            : customProviderCountStored;

        const builtInProviderCount = hasMergeBuiltIn
            ? Math.max(0, mergeStats.bundledProviders)
            : Math.max(0, totalProviderCountMerged);

        const totalProviderCount = hasMergeTotal
            ? Math.max(0, mergeStats.totalProviders)
            : Math.max(0, totalProviderCountMerged);

        const disabledProviderCount = hasMergeDisabled
            ? Math.max(0, mergeStats.disabledProviders)
            : 0;
        
        // Get hash status
        const hashStatus = (typeof window.getData === 'function') ? 
            window.getData('hashStatus') || 'unknown' : 
            'unknown';
        
        const stats = {
            customProviders: customProviderCount,
            totalProviders: totalProviderCount,
            builtInProviders: builtInProviderCount,
            disabledProviders: disabledProviderCount,
            hashStatus: hashStatus,
            timestamp: Date.now()
        };
        
        return Promise.resolve({response: stats});
    } catch (error) {
        return Promise.resolve({
            response: {
                customProviders: 0,
                totalProviders: 0,
                builtInProviders: 0,
                disabledProviders: 0,
                hashStatus: 'error',
                error: error.message
            }
        });
    }
}

/**
 * Handle custom rules merging requests
 */
function handleMergeCustomRules(request) {
    return new Promise((resolve) => {
        try {
            if (typeof window.mergeCustomRules === 'function') {
                const params = Array.isArray(request.params) ? request.params : [];
                const bundledRules = params[0] || {};
                
                window.mergeCustomRules(bundledRules).then((mergedRules) => {
                    resolve({
                        response: mergedRules,
                        success: true
                    });
                }).catch(error => {
                    resolve({
                        response: null,
                        success: false,
                        error: error.message
                    });
                });
            } else {
                resolve({
                    response: null,
                    success: false,
                    error: 'mergeCustomRules function not found'
                });
            }
        } catch (error) {
            resolve({
                response: null,
                success: false,
                error: error.message
            });
        }
    });
}

/**
 * Handle regular function calls
 */
function handleRegularFunction(request) {
    try {
        // Get the function from global scope
        let fn = window[request.function];

        if (typeof fn === "function") {
            try {
                // Ensure params is an array
                const params = Array.isArray(request.params) ? request.params : [];
                
                // Execute the function
                let response = fn.apply(null, params);
                
                // Handle both sync and async responses
                if (response instanceof Promise) {
                    return response.then(result => {
                        return {response: result};
                    }).catch(error => {
                        return {
                            response: false, 
                            error: error.message || 'Async function execution failed'
                        };
                    });
                } else {
                    return Promise.resolve({response: response});
                }
            } catch (error) {
                return Promise.resolve({
                    response: false, 
                    error: `Function execution failed: ${error.message}`
                });
            }
        } else {
            return Promise.resolve({
                response: false, 
                error: `Function '${request.function}' not found or not callable`
            });
        }
    } catch (error) {
        return Promise.resolve({
            response: false,
            error: error.message
        });
    }
}

// Register the message listener
browser.runtime.onMessage.addListener(handleMessage);

// Export for testing purposes (if needed)
if (typeof module !== 'undefined' && module.exports) {
    module.exports = { 
        handleMessage,
        handleGetData,
        handleSetData,
        handleReloadCustomRules,
        handleGetCustomRulesStats,
        handleMergeCustomRules,
        handleGetBundledRulesOnly,
        handleGetExistingLinkumoriDataForImport,
        handleRegularFunction
    };
}
