/*
 * ============================================================
 * Linkumori — about.js
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
(function () {
  'use strict';

  try {
    document.documentElement.classList.add('theme-preload');
  } catch (e) {
    // no-op
  }

  /* ---------------------------
     Configuration
  ----------------------------*/
  const LICENSE_PATH = '../License.md';
  const CONSENT_STORAGE_KEY = 'popupConsentAccepted';
  const CONSENT_VERSION_STORAGE_KEY = 'popupConsentPolicyVersionAccepted';
  const CONSENT_SIGNATURE_STORAGE_KEY = 'popupConsentPolicySignatureAccepted';
  const PRIVACY_VERSION_CONFIG_PATH = 'data/privacy-policy-map.json';
  const {
    THEME_STORAGE_KEY,
    LAST_DARK_THEME_STORAGE_KEY,
    LIGHT_THEME_STORAGE_KEY,
    DARK_THEME_STORAGE_KEY,
    DEFAULT_THEME,
    buildThemeTogglePayload,
    isLightTheme,
    readBootstrapTheme,
    syncBootstrapTheme,
    normalizeTheme
} = globalThis.LinkumoriTheme;
  const CONSENT_TEXT_KEYS = {
    title: 'popup_consent_title',
    description: 'popup_consent_description',
    checkbox: 'popup_consent_checkbox'
  };

  /* ---------------------------
     State Management
  ----------------------------*/
  let state = {
    licenseContent: '',
    privacyContent: '',
    currentPrivacyVersion: '',
    privacyVersionMap: {},
    defaultPrivacyVersion: '',
    isInitialized: false,
  };

  /* --------------------------- 
     Utility Functions
  ----------------------------*/
  function $(id) { 
    return document.getElementById(id); 
  }

  function i18n(key, fallback = null) {
    try {
      if (typeof LinkumoriI18n !== 'undefined' && LinkumoriI18n.getMessage) {
        const message = LinkumoriI18n.getMessage(key);
        return message || fallback || key;
      }
    } catch (e) {
      // Silent fail
    }
    return fallback || key;
  }

  function setHTMLContent(target, html) {
    if (!target) return;
    const parser = new DOMParser();
    const doc = parser.parseFromString(`<!doctype html><body>${html || ''}</body>`, 'text/html');
    target.replaceChildren(...Array.from(doc.body.childNodes));
  }

  function isClearURLsImportMode() {
    try {
      const params = new URLSearchParams(window.location.search || '');
      return params.get('source') === 'clearurls_import';
    } catch (e) {
      return false;
    }
  }

  function getPageSourceMode() {
    try {
      const params = new URLSearchParams(window.location.search || '');
      return params.get('source') || '';
    } catch (e) {
      return '';
    }
  }

  function configureWelcomeSectionVisibility() {
    const sourceMode = getPageSourceMode();
    const guidedMode = sourceMode === 'first_install' || sourceMode === 'clearurls_import';
    const shouldShowWelcome = guidedMode;
    const welcomeHeader = $('welcomeSectionHeader');
    const welcomeCard = $('welcomeSectionCard');
    const privacyHeader = $('privacySectionHeader');
    const privacyCard = $('privacySectionCard');
    const licenseHeader = $('licenseSectionHeader');
    const licenseCard = $('licenseSectionCard');
    const nextButton = $('welcomeNextBtn');

    if (welcomeHeader) {
      welcomeHeader.style.display = shouldShowWelcome ? '' : 'none';
    }
    if (welcomeCard) {
      welcomeCard.style.display = shouldShowWelcome ? '' : 'none';
    }

    const showLegalContentNow = !guidedMode;
    if (privacyHeader) privacyHeader.style.display = showLegalContentNow ? '' : 'none';
    if (privacyCard) privacyCard.style.display = showLegalContentNow ? '' : 'none';
    if (licenseHeader) licenseHeader.style.display = showLegalContentNow ? '' : 'none';
    if (licenseCard) licenseCard.style.display = showLegalContentNow ? '' : 'none';
    if (nextButton) nextButton.style.display = guidedMode ? '' : 'none';
  }

  function getPopupConsentPolicyVersion() {
    const version = Number(globalThis.Linkumoriversion);
    return Number.isInteger(version) && version > 0 ? version : null;
  }

  function getCurrentConsentSignature() {
    const consentPayload = {
      title: i18n(CONSENT_TEXT_KEYS.title, ''),
      description: i18n(CONSENT_TEXT_KEYS.description, ''),
      checkbox: i18n(CONSENT_TEXT_KEYS.checkbox, '')
    };

    const normalized = JSON.stringify(consentPayload).toLowerCase().trim();
    let hash = 0;
    for (let i = 0; i < normalized.length; i++) {
      hash = ((hash << 5) - hash) + normalized.charCodeAt(i);
      hash |= 0;
    }

    return String(hash);
  }

  function getConsentNoticeMessage() {
    const sourceMode = getPageSourceMode();
    if (sourceMode === 'consent_update') {
      return i18n(
        'legal_consent_notice_update',
        'Linkumori legal terms were updated. Review the Privacy Policy and License, then accept to continue using the extension.'
      );
    }

    if (sourceMode === 'first_install') {
      return i18n(
        'legal_consent_notice_first_install',
        'Review the Privacy Policy and License below, then accept to finish setting up Linkumori.'
      );
    }

    if (sourceMode === 'clearurls_import') {
      return i18n(
        'legal_consent_notice_import',
        'Review the Privacy Policy and License below, then accept to finish migrating to Linkumori.'
      );
    }

    return i18n(
      'legal_consent_notice_default',
      'Review the Privacy Policy and License below, then accept to continue using Linkumori.'
    );
  }

  function updateConsentSectionText() {
    const notice = $('legalConsentNotice');
    if (notice) {
      notice.textContent = getConsentNoticeMessage();
    }
  }

  function showWithdrawConsentModal() {
    const modal = $('withdrawConsentModal');
    if (!modal) {
      return;
    }

    modal.style.display = 'flex';
    requestAnimationFrame(() => {
      modal.classList.add('show');
    });

    const closeButton = $('withdrawConsentModalClose');
    if (closeButton) {
      setTimeout(() => {
        try {
          closeButton.focus();
        } catch (e) {
          // no-op
        }
      }, 50);
    }
  }

  function hideWithdrawConsentModal() {
    const modal = $('withdrawConsentModal');
    if (!modal) {
      return;
    }

    modal.classList.remove('show');
    modal.style.display = 'none';
  }

  async function getStoredConsentState() {
    const currentVersion = getPopupConsentPolicyVersion();
    const fallback = {
      accepted: false,
      currentVersion,
      canAccept: currentVersion !== null
    };

    try {
      if (typeof browser === 'undefined' || !browser.storage || !browser.storage.local) {
        return fallback;
      }

      const currentSignature = getCurrentConsentSignature();
      const result = await browser.storage.local.get([
        CONSENT_STORAGE_KEY,
        CONSENT_VERSION_STORAGE_KEY,
        CONSENT_SIGNATURE_STORAGE_KEY
      ]);

      const accepted = result[CONSENT_STORAGE_KEY] === true;
      const acceptedVersion = Number(result[CONSENT_VERSION_STORAGE_KEY] || 0);
      const storedSignature = typeof result[CONSENT_SIGNATURE_STORAGE_KEY] === 'string'
        ? result[CONSENT_SIGNATURE_STORAGE_KEY]
        : '';

      return {
        accepted: Boolean(
          accepted &&
          currentVersion !== null &&
          acceptedVersion === currentVersion &&
          storedSignature === currentSignature
        ),
        currentVersion,
        canAccept: currentVersion !== null
      };
    } catch (e) {
      return fallback;
    }
  }

  function updateConsentSectionUI(consentState) {
    const statusNode = $('legalConsentStatus');
    const statusText = $('legalConsentStatusText');
    const acceptButton = $('legalConsentAcceptBtn');

    if (statusNode) {
      statusNode.classList.toggle('accepted', consentState.accepted);
      statusNode.classList.toggle('not-accepted', !consentState.accepted);
    }

    if (statusText) {
      statusText.textContent = consentState.accepted
        ? i18n(
          'legal_consent_status_accepted',
          'Consent accepted. Linkumori can run with the current legal terms.'
        )
        : i18n(
          'legal_consent_status_required',
          'Consent required. Linkumori is paused until you accept the current legal terms.'
        );
    }

    if (acceptButton) {
      acceptButton.disabled = consentState.accepted || !consentState.canAccept;
      acceptButton.textContent = consentState.accepted
        ? i18n('legal_consent_button_accepted', 'Accepted')
        : i18n('popup_consent_accept_button', 'Accept and continue');
    }

    updateSettingsButtonVisibility(consentState.accepted);
  }

  async function refreshConsentUI() {
    updateConsentSectionText();
    const consentState = await getStoredConsentState();
    updateConsentSectionUI(consentState);
  }

  async function acceptLegalConsent() {
    const acceptButton = $('legalConsentAcceptBtn');
    const policyVersion = getPopupConsentPolicyVersion();

    if (policyVersion === null) {
      showNotification(
        i18n('legal_consent_error_version_unavailable', 'Unable to determine the current consent policy version.'),
        'error'
      );
      return;
    }

    const signature = getCurrentConsentSignature();

    try {
      if (acceptButton) {
        acceptButton.disabled = true;
      }

      await browser.storage.local.set({
        [CONSENT_STORAGE_KEY]: true,
        [CONSENT_VERSION_STORAGE_KEY]: policyVersion,
        [CONSENT_SIGNATURE_STORAGE_KEY]: signature
      });

      await refreshConsentUI();
      showNotification(i18n('legal_consent_saved', 'Consent accepted.'), 'success');
    } catch (e) {
      if (acceptButton) {
        acceptButton.disabled = false;
      }
      showNotification(i18n('legal_consent_save_failed', 'Failed to save consent.'), 'error');
    }
  }

  function applyClearURLsImportWelcomeContent() {
    if (!isClearURLsImportMode()) return;

    const titleNode = document.querySelector('title[data-i18n]');
    if (titleNode) {
      titleNode.setAttribute('data-i18n', 'welcome_migration_title');
    }

    const heading = document.querySelector('h2[data-i18n="welcomeHeading"]');
    if (heading) {
      heading.setAttribute('data-i18n', 'welcome_migration_heading');
    }

    const description = document.querySelector('p[data-i18n="welcomeDescription"]');
    if (description) {
      description.setAttribute('data-i18n', 'welcome_migration_description');
    }

    const mappedFeatureKeys = [
      'welcome_migration_feature_custom_rules',
      'welcome_migration_feature_overload',
      'welcome_migration_feature_whitelist',
      'welcome_migration_feature_remote_sets',
      'welcome_migration_feature_bundled'
    ];
    const featureItems = document.querySelectorAll('ul.features li[data-i18n]');
    featureItems.forEach((item, index) => {
      if (mappedFeatureKeys[index]) {
        item.setAttribute('data-i18n', mappedFeatureKeys[index]);
      }
    });

    const settingsButton = $('openSettingsBtn');
    if (settingsButton) {
      settingsButton.setAttribute('data-i18n', 'welcome_migration_open_settings');
    }
  }



  /* --------------------------- 
     Browser Compatibility Check
  ----------------------------*/


  /* --------------------------- 
     Content Processing
  ----------------------------*/
  function escapeHtml(text) {
    if (typeof text !== 'string') return '';
    const div = document.createElement('div');
    div.textContent = text;
    return div.innerHTML;
  }
  
  function linkify(text) {
    const urlRegex = /(https?:\/\/[^\s'"<>()]+)/gi;
    return text.replace(urlRegex, (url) => {
      const cleanUrl = escapeHtml(url);
      return `<a href="${cleanUrl}" target="_blank" rel="noopener noreferrer">${cleanUrl}</a>`;
    });
  }


  
  /* --------------------------- 
     Markdown Parsing Functions
  ----------------------------*/
  function parseMarkdownToHTML(markdown) {
    if (!markdown || !markdown.trim()) {
      return `<p style="text-align: center; color: var(--text-muted); font-style: italic;">${i18n('loadingContent', 'Loading content...')}</p>`;
    }

    let html = markdown;

    // Process tables first (before other processing)
    html = processMarkdownTables(html);

    // Process horizontal rules
    html = html.replace(/^---+$/gm, '<hr style="border: none; border-top: 2px solid var(--border-color); margin: 24px 0;">');

    // Process headers (must be done before other inline processing)
    html = html.replace(/^######\s+(.+)$/gm, '<h6 style="font-size: 1em; margin: 16px 0 8px 0; font-weight: 600;">$1</h6>');
    html = html.replace(/^#####\s+(.+)$/gm, '<h5 style="font-size: 1.1em; margin: 18px 0 10px 0; font-weight: 600;">$1</h5>');
    html = html.replace(/^####\s+(.+)$/gm, '<h4 style="font-size: 1.2em; margin: 20px 0 12px 0; font-weight: 600;">$1</h4>');
    html = html.replace(/^###\s+(.+)$/gm, '<h3 style="font-size: 1.4em; margin: 24px 0 14px 0; font-weight: 600; color: var(--text-primary);">$1</h3>');
    html = html.replace(/^##\s+(.+)$/gm, '<h2 style="font-size: 1.7em; margin: 28px 0 16px 0; font-weight: 700; color: var(--text-primary);">$1</h2>');
    html = html.replace(/^#\s+(.+)$/gm, '<h1 style="font-size: 2em; margin: 32px 0 20px 0; font-weight: 700; color: var(--text-primary);">$1</h1>');

    // Process code blocks (triple backticks)
    html = html.replace(/```[\s\S]*?```/g, (match) => {
      const code = match.slice(3, -3).trim();
      return `<pre style="background: var(--bg-secondary); padding: 16px; border-radius: 6px; overflow-x: auto; margin: 16px 0;"><code>${escapeHtml(code)}</code></pre>`;
    });

    // Process inline code
    html = html.replace(/`([^`]+)`/g, '<code style="background: var(--bg-secondary); padding: 2px 6px; border-radius: 3px; font-family: monospace; font-size: 0.9em;">$1</code>');

    // Process bold and italic (must be done before links)
    html = html.replace(/\*\*\*(.+?)\*\*\*/g, '<strong><em>$1</em></strong>');
    html = html.replace(/\*\*(.+?)\*\*/g, '<strong>$1</strong>');
    html = html.replace(/\*(.+?)\*/g, '<em>$1</em>');

    // Process markdown links [text](url)
    html = html.replace(/\[([^\]]+)\]\(([^)]+)\)/g, (match, text, url) => {
      const cleanUrl = escapeHtml(url);
      const cleanText = text;
      return `<a href="${cleanUrl}" target="_blank" rel="noopener noreferrer">${cleanText}</a>`;
    });

    // Process standalone URLs (that aren't already in <a> tags)
    html = html.replace(/(^|[^"'>])(https?:\/\/[^\s<>"'()]+)/gi, (match, prefix, url) => {
      const cleanUrl = escapeHtml(url);
      return `${prefix}<a href="${cleanUrl}" target="_blank" rel="noopener noreferrer">${cleanUrl}</a>`;
    });

    // Process unordered lists
    html = processMarkdownLists(html);

    // Process line breaks and paragraphs
    const lines = html.split('\n');
    let processed = [];
    let inParagraph = false;
    let currentParagraph = [];

    for (let i = 0; i < lines.length; i++) {
      const line = lines[i];
      const trimmed = line.trim();

      // Skip empty lines
      if (!trimmed) {
        if (inParagraph && currentParagraph.length > 0) {
          processed.push(`<p style="margin-bottom: 16px; line-height: 1.7;">${currentParagraph.join(' ')}</p>`);
          currentParagraph = [];
          inParagraph = false;
        }
        continue;
      }

      // Check if line is a block element (headers, lists, tables, hr, code)
      const isBlockElement = /^<(h[1-6]|ul|ol|li|table|hr|pre|div)/.test(trimmed);

      if (isBlockElement) {
        // Close any open paragraph
        if (inParagraph && currentParagraph.length > 0) {
          processed.push(`<p style="margin-bottom: 16px; line-height: 1.7;">${currentParagraph.join(' ')}</p>`);
          currentParagraph = [];
          inParagraph = false;
        }
        processed.push(line);
      } else {
        // Regular text line
        if (!inParagraph) {
          inParagraph = true;
        }
        currentParagraph.push(trimmed);
      }
    }

    // Close any remaining paragraph
    if (inParagraph && currentParagraph.length > 0) {
      processed.push(`<p style="margin-bottom: 16px; line-height: 1.7;">${currentParagraph.join(' ')}</p>`);
    }

    return processed.join('\n');
  }

  function processMarkdownTables(text) {
    const lines = text.split('\n');
    const processed = [];
    let inTable = false;
    let tableRows = [];
    let isFirstRow = true;

    for (let i = 0; i < lines.length; i++) {
      const line = lines[i].trim();

      // Check if this is a table row (contains pipes)
      const isPotentialTableRow = line.includes('|');
      
      // Check if this is a separator row (|---|---|)
      const isSeparatorRow = /^\|?\s*[-:]+\s*\|/.test(line);

      if (isPotentialTableRow && !isSeparatorRow) {
        if (!inTable) {
          inTable = true;
          tableRows = [];
          isFirstRow = true;
        }

        // Parse the row
        const cells = line.split('|')
          .map(cell => cell.trim())
          .filter(cell => cell.length > 0);

        if (cells.length > 0) {
          tableRows.push({ cells, isHeader: isFirstRow });
        }
      } else if (isSeparatorRow && inTable) {
        // Skip separator rows
        isFirstRow = false;
        continue;
      } else {
        // End of table or non-table line
        if (inTable && tableRows.length > 0) {
          processed.push(renderMarkdownTable(tableRows));
          tableRows = [];
          inTable = false;
          isFirstRow = true;
        }
        
        if (!isSeparatorRow) {
          processed.push(line);
        }
      }
    }

    // Handle any remaining table
    if (inTable && tableRows.length > 0) {
      processed.push(renderMarkdownTable(tableRows));
    }

    return processed.join('\n');
  }

  function renderMarkdownTable(rows) {
    if (!rows || rows.length === 0) return '';

    let html = '<table style="width: 100%; border-collapse: collapse; margin: 20px 0; font-size: 0.95em;">';
    
    let hasHeader = false;
    for (let i = 0; i < rows.length; i++) {
      const row = rows[i];
      
      if (row.isHeader && !hasHeader) {
        html += '<thead><tr>';
        row.cells.forEach(cell => {
          html += `<th style="border: 1px solid var(--border-color); padding: 12px; text-align: left; background: var(--bg-secondary); font-weight: 600;">${cell}</th>`;
        });
        html += '</tr></thead><tbody>';
        hasHeader = true;
      } else {
        if (!hasHeader) {
          html += '<tbody>';
          hasHeader = true;
        }
        html += '<tr>';
        row.cells.forEach(cell => {
          // Parse markdown within cells (bold, links, etc.)
          let processedCell = cell;
          processedCell = processedCell.replace(/\*\*(.+?)\*\*/g, '<strong>$1</strong>');
          processedCell = processedCell.replace(/`([^`]+)`/g, '<code style="background: var(--bg-tertiary); padding: 1px 4px; border-radius: 2px; font-family: monospace; font-size: 0.85em;">$1</code>');
          processedCell = processedCell.replace(/<br>/g, '<br>');
          
          html += `<td style="border: 1px solid var(--border-color); padding: 12px;">${processedCell}</td>`;
        });
        html += '</tr>';
      }
    }
    
    html += '</tbody></table>';
    return html;
  }

  function processMarkdownLists(text) {
    const lines = text.split('\n');
    const processed = [];
    let inList = false;
    let listItems = [];
    let listType = null; // 'ul' or 'ol'

    for (let i = 0; i < lines.length; i++) {
      const line = lines[i];
      const unorderedMatch = line.match(/^[\s]*[-*+]\s+(.+)$/);
      const orderedMatch = line.match(/^[\s]*\d+\.\s+(.+)$/);

      if (unorderedMatch || orderedMatch) {
        const currentListType = unorderedMatch ? 'ul' : 'ol';
        
        if (!inList) {
          inList = true;
          listType = currentListType;
        } else if (listType !== currentListType) {
          // Different list type, close current and start new
          processed.push(renderMarkdownList(listItems, listType));
          listItems = [];
          listType = currentListType;
        }

        const content = unorderedMatch ? unorderedMatch[1] : orderedMatch[1];
        listItems.push(content);
      } else {
        // Not a list item
        if (inList && listItems.length > 0) {
          processed.push(renderMarkdownList(listItems, listType));
          listItems = [];
          inList = false;
          listType = null;
        }
        processed.push(line);
      }
    }

    // Handle any remaining list
    if (inList && listItems.length > 0) {
      processed.push(renderMarkdownList(listItems, listType));
    }

    return processed.join('\n');
  }

  function renderMarkdownList(items, type = 'ul') {
    if (!items || items.length === 0) return '';

    const tag = type === 'ol' ? 'ol' : 'ul';
    const style = type === 'ol' 
      ? 'margin: 16px 0; padding-left: 24px; line-height: 1.7;'
      : 'margin: 16px 0; padding-left: 24px; line-height: 1.7; list-style-type: disc;';

    let html = `<${tag} style="${style}">`;
    items.forEach(item => {
      html += `<li style="margin-bottom: 8px;">${item}</li>`;
    });
    html += `</${tag}>`;
    return html;
  }

  function processTextContent(text) {
    if (!text || !text.trim()) {
      return `<p style="text-align: center; color: var(--text-muted); font-style: italic;">${i18n('loadingContent', 'Loading content...')}</p>`;
    }
    
    let processedText = escapeHtml(text);
    processedText = linkify(processedText);
    
    // Convert double line breaks to paragraphs
    const paragraphs = processedText.split(/\n\s*\n/).filter(p => p.trim().length > 0);
    return paragraphs.map(p => 
      `<p style="margin-bottom: 16px; line-height: 1.7;">${p.replace(/\n/g, '<br>')}</p>`
    ).join('\n');
  }

  /* --------------------------- 
     File Loading System
  ----------------------------*/
  async function loadTextFile(path, targetId, onSuccess) {
    const target = $(targetId);
    if (!target) {
      return false;
    }
    
    try {
      // Show loading state
      target.className = 'content-area loading';
      const loadingSpan = document.createElement('span');
      loadingSpan.textContent = i18n('loadingContent', 'Loading content...');
      target.replaceChildren(loadingSpan);
      
      const response = await fetch(path, { 
        cache: 'no-cache',
        headers: {
          'Accept': 'text/plain,*/*'
        }
      });
      
      if (!response.ok) {
        throw new Error(`HTTP ${response.status}: ${response.statusText}`);
      }
      
      const text = await response.text();
      
      if (!text || !text.trim()) {
        throw new Error(i18n('fileEmptyError', 'File is empty or unreadable'));
      }
      
      // Determine if this is a markdown file
      const isMarkdown = path.toLowerCase().endsWith('.md') || path.toLowerCase().endsWith('.markdown');
      
      // Process and display content
      target.className = 'content-area';
      if (isMarkdown) {
        setHTMLContent(target, parseMarkdownToHTML(text));
      } else {
        setHTMLContent(target, processTextContent(text));
      }
      target.scrollTop = 0;
      
      // Call success callback
      if (typeof onSuccess === 'function') {
        onSuccess(text);
      }
      return true;
      
    } catch (error) {
      
      // Show error state
      target.className = 'content-area error';
      const wrapper = document.createElement('div');
      wrapper.style.textAlign = 'center';
      wrapper.style.padding = '20px';

      const strong = document.createElement('strong');
      strong.textContent = i18n('loadError', 'Error loading content');
      wrapper.appendChild(strong);
      wrapper.appendChild(document.createElement('br'));
      wrapper.appendChild(document.createElement('br'));

      const message = document.createElement('span');
      message.style.fontSize = '13px';
      message.style.color = 'var(--text-muted)';
      message.textContent = error && error.message ? error.message : '';
      wrapper.appendChild(message);

      target.replaceChildren(wrapper);
      return false;
    }
  }

  async function loadPrivacyVersionMap() {
    const response = await fetch(browser.runtime.getURL(PRIVACY_VERSION_CONFIG_PATH), {
      cache: 'no-cache',
      headers: { 'Accept': 'application/json,*/*' }
    });

    if (!response.ok) {
      throw new Error(`HTTP ${response.status}: ${response.statusText}`);
    }

    const config = await response.json();
    if (!config || !Array.isArray(config.versions) || config.versions.length === 0) {
      throw new Error('Invalid privacy policy map config');
    }

    const mapped = {};
    config.versions.forEach(entry => {
      if (!entry || typeof entry !== 'object') return;
      if (typeof entry.key !== 'string' || !entry.key.trim()) return;
      if (typeof entry.path !== 'string' || !entry.path.trim()) return;
      mapped[entry.key] = {
        path: entry.path,
        labelKey: typeof entry.labelKey === 'string' ? entry.labelKey : null,
        label: typeof entry.label === 'string' ? entry.label : null
      };
    });

    if (Object.keys(mapped).length === 0) {
      throw new Error('No valid privacy version entries');
    }

    state.privacyVersionMap = mapped;
    state.defaultPrivacyVersion = (typeof config.defaultVersion === 'string' && mapped[config.defaultVersion])
      ? config.defaultVersion
      : Object.keys(mapped)[0];
    state.currentPrivacyVersion = state.defaultPrivacyVersion;
  }

  function initializePrivacyVersionSelector() {
    const selector = $('privacyVersionSelector');
    if (!selector) {
      return;
    }

    selector.replaceChildren();
    const versionEntries = Object.entries(state.privacyVersionMap);
    if (versionEntries.length === 0) {
      selector.disabled = true;
      return;
    }

    selector.disabled = false;
    versionEntries.forEach(([versionKey, value]) => {
      const option = document.createElement('option');
      option.value = versionKey;
      option.textContent = value.labelKey ? i18n(value.labelKey, versionKey) : (value.label || versionKey);
      selector.appendChild(option);
    });

    selector.value = state.currentPrivacyVersion;
    selector.addEventListener('change', async () => {
      const selectedVersion = selector.value;
      if (!state.privacyVersionMap[selectedVersion]) {
        return;
      }

      state.currentPrivacyVersion = selectedVersion;
      await loadPrivacyContent(selectedVersion);
    });
  }

  async function loadPrivacyContent(versionKey = state.currentPrivacyVersion) {
    const versionConfig = state.privacyVersionMap[versionKey] || state.privacyVersionMap[state.defaultPrivacyVersion];
    if (!versionConfig) {
      return false;
    }
    state.currentPrivacyVersion = versionKey in state.privacyVersionMap ? versionKey : state.defaultPrivacyVersion;

    disableActionButtons('privacy');
    const loaded = await loadTextFile(versionConfig.path, 'privacyContent', (text) => {
      state.privacyContent = text;
      enableActionButtons('privacy');
    });

    if (!loaded && state.currentPrivacyVersion !== state.defaultPrivacyVersion) {
      showNotification(i18n('privacyVersionLoadFailed', 'Selected policy file not found. Loaded default privacy policy instead.'), 'error');
      state.currentPrivacyVersion = state.defaultPrivacyVersion;
      const selector = $('privacyVersionSelector');
      if (selector) selector.value = state.defaultPrivacyVersion;
      return loadPrivacyContent(state.defaultPrivacyVersion);
    }

    return loaded;
  }

  async function loadLicenseContent() {
    disableActionButtons('license');
    return loadTextFile(LICENSE_PATH, 'licenseContent', (text) => {
      state.licenseContent = text;
      enableActionButtons('license');
    });
  }

  async function loadAllContent() {
    const results = await Promise.allSettled([
      loadLicenseContent(),
      loadPrivacyContent(state.currentPrivacyVersion)
    ]);
    
    const loadedCount = results.filter(r => r.status === 'fulfilled').length;
    return loadedCount > 0;
  }

  function enableActionButtons(type) {
    const buttons = {
      license: ['copyLicenseBtn', 'downloadLicenseBtn'],
      privacy: ['copyPrivacyBtn', 'downloadPrivacyBtn']
    };
    
    const buttonIds = buttons[type];
    if (buttonIds) {
      buttonIds.forEach(id => {
        const btn = $(id);
        if (btn) {
          btn.disabled = false;
          btn.style.opacity = '1';
        }
      });
    }
  }

  function disableActionButtons(type) {
    const buttons = {
      license: ['copyLicenseBtn', 'downloadLicenseBtn'],
      privacy: ['copyPrivacyBtn', 'downloadPrivacyBtn']
    };

    const buttonIds = buttons[type];
    if (buttonIds) {
      buttonIds.forEach(id => {
        const btn = $(id);
        if (btn) {
          btn.disabled = true;
          btn.style.opacity = '0.6';
        }
      });
    }
  }

  /* --------------------------- 
     Permission Management System
  ----------------------------*/
 




  /* --------------------------- 
     Clipboard & Download
  ----------------------------*/
  function copyToClipboard(text, successMessage) {
    if (!text) {
      showNotification(i18n('nothingToCopy', 'Nothing to copy!'), 'error');
      return;
    }

    try {
      // Modern clipboard API
      if (navigator.clipboard && window.isSecureContext) {
        navigator.clipboard.writeText(text)
          .then(() => showNotification(successMessage, 'success'))
          .catch(() => {
            // Fallback
            fallbackCopy(text, successMessage);
          });
      } else {
        fallbackCopy(text, successMessage);
      }
    } catch (error) {
      showNotification(i18n('copyFailed', 'Failed to copy!'), 'error');
    }
  }

  function fallbackCopy(text, successMessage) {
    const textarea = document.createElement('textarea');
    textarea.value = text;
    textarea.style.position = 'fixed';
    textarea.style.opacity = '0';
    document.body.appendChild(textarea);
    textarea.select();
    
    try {
      document.execCommand('copy');
      showNotification(successMessage, 'success');
    } catch (err) {
      showNotification(i18n('copyFailed', 'Failed to copy!'), 'error');
    }
    
    document.body.removeChild(textarea);
  }

  function downloadFile(content, filename, successMessage) {
    if (!content) {
      showNotification(i18n('nothingToDownload', 'Nothing to download!'), 'error');
      return;
    }

    try {
      // Determine if this is markdown content and convert to HTML
      let downloadContent = content;
      let mimeType = 'text/html;charset=utf-8';
      
      // Check if filename suggests markdown content
      const isMarkdown = filename.toLowerCase().includes('license') || filename.toLowerCase().includes('privacy');
      
      if (isMarkdown) {
        // Convert markdown to HTML with proper document structure
        const htmlContent = parseMarkdownToHTML(content);
        downloadContent = `<!DOCTYPE html>
<html lang="en">
<head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <title>${filename.replace('.html', '').replace(/[-_]/g, ' ').replace(/\w\S*/g, (txt) => txt.charAt(0).toUpperCase() + txt.substr(1).toLowerCase())}</title>
    <style>
        body {
            font-family: 'Times New Roman', 'Liberation Serif', 'Georgia', serif;
            line-height: 1.8;
            max-width: 850px;
            margin: 0 auto;
            padding: 40px;
            color: #000000;
            background: #ffffff;
            font-size: 16px;
        }
        h1, h2, h3, h4, h5, h6 {
            font-family: 'Times New Roman', 'Liberation Serif', 'Georgia', serif;
            color: #000000;
            margin-top: 2em;
            margin-bottom: 0.8em;
            font-weight: bold;
            line-height: 1.3;
        }
        h1 {
            font-size: 2.2em;
            text-align: center;
            border-bottom: 2px solid #000000;
            padding-bottom: 0.5em;
        }
        h2 {
            font-size: 1.8em;
            margin-top: 2.5em;
        }
        h3 {
            font-size: 1.5em;
        }
        h4 {
            font-size: 1.3em;
        }
        h5 {
            font-size: 1.1em;
        }
        h6 {
            font-size: 1em;
        }
        p {
            margin-bottom: 1.2em;
            text-align: justify;
            hyphens: auto;
        }
        a {
            color: #0066cc;
            text-decoration: underline;
        }
        a:hover {
            color: #004499;
        }
        code {
            font-family: 'Courier New', 'Liberation Mono', monospace;
            background: #f5f5f5;
            padding: 2px 4px;
            border: 1px solid #dddddd;
            border-radius: 2px;
            font-size: 0.9em;
        }
        pre {
            font-family: 'Courier New', 'Liberation Mono', monospace;
            background: #f8f8f8;
            padding: 20px;
            border: 1px solid #dddddd;
            border-radius: 4px;
            overflow-x: auto;
            margin: 1.5em 0;
            line-height: 1.4;
        }
        table {
            border-collapse: collapse;
            width: 100%;
            margin: 2em 0;
            font-size: 0.95em;
            border: 2px solid #333333;
        }
        th, td {
            border: 1px solid #666666;
            padding: 14px 18px;
            text-align: left;
            vertical-align: top;
        }
        th {
            background: #e8e8e8;
            color: #000000;
            font-weight: bold;
            font-family: 'Times New Roman', 'Liberation Serif', 'Georgia', serif;
            border-bottom: 2px solid #333333;
        }
        tr:nth-child(even) {
            background: #f7f7f7;
        }
        tr:nth-child(odd) {
            background: #ffffff;
        }
        tr:hover {
            background: #f0f0f0;
        }
        hr {
            border: none;
            border-top: 1px solid #000000;
            margin: 3em 0;
            width: 50%;
            margin-left: auto;
            margin-right: auto;
        }
        ul, ol {
            margin: 1.2em 0;
            padding-left: 2em;
        }
        li {
            margin-bottom: 0.5em;
            line-height: 1.6;
        }
        blockquote {
            margin: 1.5em 2em;
            padding: 1em 2em;
            border-left: 4px solid #dddddd;
            background: #f9f9f9;
            font-style: italic;
        }
        strong {
            font-weight: bold;
        }
        em {
            font-style: italic;
        }
        @media print {
            body {
                font-size: 12pt;
                line-height: 1.6;
            }
            h1, h2, h3, h4, h5, h6 {
                page-break-after: avoid;
            }
            p, table, blockquote {
                page-break-inside: avoid;
            }
        }
        @media (max-width: 768px) {
            body {
                padding: 20px;
                font-size: 14px;
            }
            table {
                font-size: 0.85em;
            }
            th, td {
                padding: 8px 10px;
            }
        }
    </style>
</head>
<body>
${htmlContent}
</body>
</html>`;
      }
      
      const blob = new Blob([downloadContent], { type: mimeType });
      const url = URL.createObjectURL(blob);
      const link = document.createElement('a');
      
      link.href = url;
      link.download = filename;
      link.style.display = 'none';
      
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
      
      // Clean up the URL object
      setTimeout(() => URL.revokeObjectURL(url), 100);
      
      showNotification(successMessage, 'success');
    } catch (error) {
      showNotification(i18n('downloadFailed', 'Failed to download!'), 'error');
    }
  }

  /* --------------------------- 
     Notification System
  ----------------------------*/
  function showNotification(message, type = 'info') {
    // Remove any existing notifications
    const existing = document.querySelector('.notification-toast');
    if (existing) {
      existing.remove();
    }

    const palette = {
      success: {
        background: 'color-mix(in srgb, var(--bg-secondary) 88%, var(--accept-button) 12%)',
        border: 'var(--accept-button)',
        text: 'var(--text-primary)'
      },
      error: {
        background: 'color-mix(in srgb, var(--bg-secondary) 88%, var(--withdraw-button) 12%)',
        border: 'var(--withdraw-button)',
        text: 'var(--text-primary)'
      },
      info: {
        background: 'color-mix(in srgb, var(--bg-secondary) 90%, var(--button-primary) 10%)',
        border: 'var(--button-primary)',
        text: 'var(--text-primary)'
      }
    };
    const theme = palette[type] || palette.info;

    const notification = document.createElement('div');
    notification.className = `notification-toast ${type}`;
    notification.textContent = message;
    notification.style.cssText = `
      position: fixed;
      top: 16px;
      right: 16px;
      max-width: min(360px, calc(100vw - 32px));
      padding: 12px 14px;
      background: ${theme.background};
      color: ${theme.text};
      border: 1px solid ${theme.border};
      border-left-width: 3px;
      border-radius: 8px;
      box-shadow: 0 10px 24px var(--shadow-color);
      backdrop-filter: blur(10px);
      z-index: 10000;
      font-size: 13px;
      line-height: 1.45;
      letter-spacing: 0.1px;
      animation: notificationIn 0.18s ease-out forwards;
      transform: translateY(-6px);
      opacity: 0;
    `;

    document.body.appendChild(notification);

    setTimeout(() => {
      notification.style.animation = 'notificationOut 0.16s ease-in forwards';
      setTimeout(() => notification.remove(), 180);
    }, 3000);

    if (!document.getElementById('notificationToastStyles')) {
      const style = document.createElement('style');
      style.id = 'notificationToastStyles';
      style.textContent = `
        @keyframes notificationIn {
          from { opacity: 0; transform: translateY(-6px); }
          to { opacity: 1; transform: translateY(0); }
        }

        @keyframes notificationOut {
          from { opacity: 1; transform: translateY(0); }
          to { opacity: 0; transform: translateY(-4px); }
        }
      `;
      document.head.appendChild(style);
    }
  }

  /* --------------------------- 
     Theme Management
  ----------------------------*/
  function initializeTheme() {
    try {
      const bootTheme = normalizeTheme(
        (typeof readBootstrapTheme === 'function' && readBootstrapTheme()) ||
        document.documentElement.getAttribute('data-theme') ||
        DEFAULT_THEME
      );
      document.documentElement.setAttribute('data-theme', bootTheme);
      syncBootstrapTheme(bootTheme);
      updateThemeButtonAria(bootTheme);

      if (typeof browser !== 'undefined' && browser.storage && browser.storage.local) {
        browser.storage.local.get([THEME_STORAGE_KEY]).then((result) => {
          const savedTheme = result[THEME_STORAGE_KEY] || bootTheme;
          const normalizedTheme = normalizeTheme(savedTheme);
          document.documentElement.setAttribute('data-theme', normalizedTheme);
          syncBootstrapTheme(normalizedTheme);
          updateThemeButtonAria(normalizedTheme);
        }).catch(() => {
          // Keep bootstrap theme if storage read fails.
        });
      }
    } catch (e) {
      document.documentElement.setAttribute('data-theme', normalizeTheme(DEFAULT_THEME));
    }

    // Re-enable transitions after initial theme paint to avoid first-load lag/flicker.
    requestAnimationFrame(() => {
      document.documentElement.classList.remove('theme-preload');
    });
  }

  async function toggleTheme() {
    try {
      const current = normalizeTheme(document.documentElement.getAttribute('data-theme') || DEFAULT_THEME);
      let updatePayload = {};
      let next = DEFAULT_THEME;
      if (typeof browser !== 'undefined' && browser.storage && browser.storage.local) {
        try {
          const result = await browser.storage.local.get([
            LAST_DARK_THEME_STORAGE_KEY,
            LIGHT_THEME_STORAGE_KEY,
            DARK_THEME_STORAGE_KEY
          ]);
          const toggleState = buildThemeTogglePayload(current, result);
          next = toggleState.nextTheme;
          updatePayload = toggleState.payload;
        } catch (e) {
          const fallbackState = buildThemeTogglePayload(current, {});
          next = fallbackState.nextTheme;
          updatePayload = fallbackState.payload;
        }
      } else {
        const fallbackState = buildThemeTogglePayload(current, {});
        next = fallbackState.nextTheme;
        updatePayload = fallbackState.payload;
      }

      const normalizedNext = normalizeTheme(next);
      updatePayload[THEME_STORAGE_KEY] = normalizedNext;

      document.documentElement.setAttribute('data-theme', normalizedNext);
      syncBootstrapTheme(normalizedNext);
      updateThemeButtonAria(normalizedNext);

      if (typeof browser !== 'undefined' && browser.storage && browser.storage.local) {
        try {
          await browser.storage.local.set(updatePayload);
        } catch (e) {
          // no-op
        }
      }
    } catch (e) {
      // no-op
    }
  }

  function updateThemeButtonAria(theme) {
    const btn = $('themeToggle');
    if (btn) {
      const ariaText = isLightTheme(theme)
        ? i18n('switchToDarkTheme', 'Switch to dark theme')
        : i18n('switchToLightTheme', 'Switch to light theme');
      btn.setAttribute('aria-label', ariaText);
    }
  }

  /* --------------------------- 
     Event Binding
  ----------------------------*/
  function bindEventListeners() {

    // Theme toggle
    const themeToggle = $('themeToggle');
    if (themeToggle) {
      themeToggle.addEventListener('click', toggleTheme);
    }

    // File action buttons
    const fileActions = [
      { btnId: 'copyLicenseBtn', action: () => copyToClipboard(state.licenseContent, i18n('licenseCopied', 'License copied!')) },
      { btnId: 'downloadLicenseBtn', action: () => downloadFile(state.licenseContent, 'LICENSE.html', i18n('licenseDownloaded', 'License downloaded!')) },
      { btnId: 'copyPrivacyBtn', action: () => copyToClipboard(state.privacyContent, i18n('privacyCopied', 'Privacy policy copied!')) },
      { btnId: 'downloadPrivacyBtn', action: () => downloadFile(state.privacyContent, 'privacy-policy.html', i18n('privacyDownloaded', 'Privacy policy downloaded!')) }
    ];

    fileActions.forEach(({ btnId, action }) => {
      const btn = $(btnId);
      if (btn) {
        btn.addEventListener('click', action);
      }
    });

    const welcomeNextBtn = $('welcomeNextBtn');
    if (welcomeNextBtn) {
      welcomeNextBtn.addEventListener('click', () => {
        const privacyHeader = $('privacySectionHeader');
        const privacyCard = $('privacySectionCard');
        const licenseHeader = $('licenseSectionHeader');
        const licenseCard = $('licenseSectionCard');

        if (privacyHeader) privacyHeader.style.display = '';
        if (privacyCard) privacyCard.style.display = '';
        if (licenseHeader) licenseHeader.style.display = '';
        if (licenseCard) licenseCard.style.display = '';

        const welcomeHeader = $('welcomeSectionHeader');
        const welcomeCard = $('welcomeSectionCard');
        if (welcomeHeader) welcomeHeader.style.display = 'none';
        if (welcomeCard) welcomeCard.style.display = 'none';

        window.scrollTo({ top: 0, behavior: 'smooth' });
      });
    }

    const consentAcceptButton = $('legalConsentAcceptBtn');
    if (consentAcceptButton) {
      consentAcceptButton.addEventListener('click', () => {
        acceptLegalConsent();
      });
    }

    const withdrawInfoButton = $('legalConsentWithdrawInfoBtn');
    if (withdrawInfoButton) {
      withdrawInfoButton.addEventListener('click', showWithdrawConsentModal);
    }

    const withdrawModalClose = $('withdrawConsentModalClose');
    if (withdrawModalClose) {
      withdrawModalClose.addEventListener('click', hideWithdrawConsentModal);
    }

    const withdrawModalAcknowledge = $('withdrawConsentModalAcknowledge');
    if (withdrawModalAcknowledge) {
      withdrawModalAcknowledge.addEventListener('click', hideWithdrawConsentModal);
    }

    const withdrawModal = $('withdrawConsentModal');
    if (withdrawModal) {
      withdrawModal.addEventListener('click', (event) => {
        if (event.target === withdrawModal) {
          hideWithdrawConsentModal();
        }
      });
    }

    document.addEventListener('keydown', (event) => {
      if (event.key === 'Escape' && $('withdrawConsentModal')?.classList.contains('show')) {
        hideWithdrawConsentModal();
      }
    });



    // Browser storage change listener
    try {
      if (typeof browser !== 'undefined' && browser.storage && browser.storage.onChanged) {
        browser.storage.onChanged.addListener((changes, area) => {
          if (area !== 'local') return; 
          
          if (changes['linkumori-theme']) {
            const newTheme = changes['linkumori-theme'].newValue;
            if (newTheme) {
              document.documentElement.setAttribute('data-theme', normalizeTheme(newTheme));
              syncBootstrapTheme(newTheme);
              updateThemeButtonAria(newTheme);
            }
          }

          if (changes[CONSENT_STORAGE_KEY] || changes[CONSENT_VERSION_STORAGE_KEY] || changes[CONSENT_SIGNATURE_STORAGE_KEY]) {
            refreshConsentUI().catch(() => {
              updateSettingsButtonVisibility(false);
            });
          }
        });
      }
    } catch (e) {
    }
  }

  async function initializeSettingsButtonVisibility() {
    try {
      const consentState = await getStoredConsentState();
      updateConsentSectionUI(consentState);
    } catch (e) {
      updateSettingsButtonVisibility(false);
    }
  }

  function updateSettingsButtonVisibility(consentAccepted) {
    const settingsButton = $('openSettingsBtn');
    if (!settingsButton) return;
    settingsButton.style.display = consentAccepted ? '' : 'none';
  }

  /* --------------------------- 
     Internationalization
  ----------------------------*/
  function setLocalizedContent() {
    
    try {
      // Set document title
      document.title = i18n('aboutPageTitle', 'Linkumori - About');

      // Set all data-i18n elements
      const i18nElements = document.querySelectorAll('[data-i18n]');
      i18nElements.forEach(element => {
        const key = element.getAttribute('data-i18n');
        const fallback = element.textContent.trim() || key;
        element.textContent = i18n(key, fallback);
      });

      // Set all data-i18n-placeholder elements
      const placeholderElements = document.querySelectorAll('[data-i18n-placeholder]');
      placeholderElements.forEach(element => {
        const key = element.getAttribute('data-i18n-placeholder');
        const fallback = element.placeholder || key;
        element.placeholder = i18n(key, fallback);
      });

      // Set all data-i18n-aria elements
      const ariaElements = document.querySelectorAll('[data-i18n-aria]');
      ariaElements.forEach(element => {
        const key = element.getAttribute('data-i18n-aria');
        const fallback = element.getAttribute('aria-label') || key;
        element.setAttribute('aria-label', i18n(key, fallback));
      });

      // Set all data-i18n-alt elements
      const altElements = document.querySelectorAll('[data-i18n-alt]');
      altElements.forEach(element => {
        const key = element.getAttribute('data-i18n-alt');
        const fallback = element.getAttribute('alt') || key;
        element.setAttribute('alt', i18n(key, fallback));
      });

    } catch (error) {
    }
  }

  /* --------------------------- 
     Initialization
  ----------------------------*/


  async function initialize() {
    if (state.isInitialized) {
      return;
    }
    
    try {
      
      // Wait for LinkumoriI18n to be ready
      if (typeof LinkumoriI18n !== 'undefined' && typeof LinkumoriI18n.ready === 'function') {
        await LinkumoriI18n.ready();
      }
      
      // Initialize in proper order
      try {
        await loadPrivacyVersionMap();
      } catch (error) {
        showNotification(i18n('privacyVersionMapLoadFailed', 'Failed to load privacy policy version map.'), 'error');
      }
      configureWelcomeSectionVisibility();
      applyClearURLsImportWelcomeContent();
      setLocalizedContent();
      updateConsentSectionText();
      initializePrivacyVersionSelector();
      initializeTheme();
      bindEventListeners();
      await refreshConsentUI();
      
      // Load content files
      const contentLoaded = await loadAllContent();
      if (!contentLoaded) {
      }
      
      // Initialize permission management
      
      state.isInitialized = true;
      
    } catch (error) {
      
      // Fallback initialization
      try {
        try {
          await loadPrivacyVersionMap();
        } catch (error) {
          showNotification(i18n('privacyVersionMapLoadFailed', 'Failed to load privacy policy version map.'), 'error');
        }
        configureWelcomeSectionVisibility();
        applyClearURLsImportWelcomeContent();
        setLocalizedContent();
        updateConsentSectionText();
        initializePrivacyVersionSelector();
        initializeTheme();
        bindEventListeners();
        await refreshConsentUI();
        state.isInitialized = true;
      } catch (fallbackError) {
      }
    }
  }

  /* --------------------------- 
     Entry Point
  ----------------------------*/
  if (document.readyState === 'loading') {
    initializeTheme();
    document.addEventListener('DOMContentLoaded', initialize);
  } else {
    // Document already loaded
    initializeTheme();
    setTimeout(initialize, 0);
  }

})();
