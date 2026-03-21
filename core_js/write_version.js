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
 * - Enhanced error handling and validation
 * - Safe DOM manipulation with fallbacks
 * - Support for additional manifest fields
 * - Improved browser compatibility
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
(function() {
    'use strict';
    
    /**
     * Safely get manifest data with error handling
     * @returns {Object|null} Manifest object or null if unavailable
     */
    function getManifestSafely() {
        try {
            if (typeof browser !== 'undefined' && browser.runtime && browser.runtime.getManifest) {
                return browser.runtime.getManifest();
            }
            
            // Fallback for Chrome/Chromium
            if (typeof chrome !== 'undefined' && chrome.runtime && chrome.runtime.getManifest) {
                return chrome.runtime.getManifest();
            }
            
            return null;
        } catch (error) {
            return null;
        }
    }
    
    /**
     * Safely set element text content with validation
     * @param {string} elementId - ID of the target element
     * @param {string} content - Content to set
     * @param {string} fallback - Fallback content if setting fails
     */
    function setElementTextSafely(elementId, content, fallback = 'Unknown') {
        try {
            const element = document.getElementById(elementId);
            if (element) {
                // ENHANCEMENT: Validate content before setting
                const safeContent = (content && typeof content === 'string') ? content.trim() : fallback;
                element.textContent = safeContent;
                
                // ENHANCEMENT: Set title attribute for accessibility
                if (safeContent !== fallback) {
                    element.setAttribute('title', safeContent);
                }
            }
        } catch (error) {
            // Silent fallback - just continue execution
        }
    }
    
    /**
     * Main function to populate manifest information
     */
    function populateManifestInfo() {
        const manifest = getManifestSafely();
        
        if (!manifest) {
            // ENHANCEMENT: Graceful fallback when manifest is unavailable
            setElementTextSafely('version', 'N/A');
            setElementTextSafely('name', 'Extension');
            return;
        }
        
        // ENHANCEMENT: Set version with validation
        const version = manifest.version || 'Unknown';
        setElementTextSafely('version', version);
        
        // ENHANCEMENT: Set name with validation  
        const name = manifest.name || 'Extension';
        setElementTextSafely('name', name);
        
        // ENHANCEMENT: Optional additional manifest fields
        setElementTextSafely('description', manifest.description, '');
        setElementTextSafely('author', manifest.author, '');
        
        // ENHANCEMENT: Set manifest version if element exists
        if (manifest.manifest_version) {
            setElementTextSafely('manifest_version', `Manifest V${manifest.manifest_version}`);
        }
        
        // ENHANCEMENT: Set homepage URL if available
        if (manifest.homepage_url) {
            setElementTextSafely('homepage', manifest.homepage_url);
            
            // ENHANCEMENT: Make homepage a clickable link if possible
            try {
                const homepageElement = document.getElementById('homepage');
                if (homepageElement && homepageElement.tagName.toLowerCase() === 'a') {
                    homepageElement.href = manifest.homepage_url;
                    homepageElement.target = '_blank';
                    homepageElement.rel = 'noopener noreferrer';
                }
            } catch (linkError) {
                // Continue silently if link setting fails
            }
        }
    }
    
    // ENHANCEMENT: Wait for DOM to be ready before executing
    if (document.readyState === 'loading') {
        document.addEventListener('DOMContentLoaded', populateManifestInfo);
    } else {
        // DOM is already ready
        populateManifestInfo();
    }
    
    // ENHANCEMENT: Re-populate if page becomes visible (for SPAs)
    if (typeof document.addEventListener === 'function') {
        document.addEventListener('visibilitychange', function() {
            if (!document.hidden) {
                populateManifestInfo();
            }
        });
    }
    
})();
