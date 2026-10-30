/*
 * Linkumori popup whitelist manager.
 * Uses the popup's shared Punycode and IP helpers and stores domain names in
 * their ASCII form, while showing Unicode domains for readability.
 */
(function () {
    'use strict';

    const $ = (id) => document.getElementById(id);
    const DOMAIN_LABEL = /^[a-z0-9][a-z0-9-]{0,61}[a-z0-9]$/i;
    let searchTerm = '';
    let statusTimer = null;

    function localized(key, fallback, substitutions = []) {
        let value = '';
        try {
            if (typeof getPopupI18nMessage === 'function') {
                value = getPopupI18nMessage(key, substitutions);
            }
        } catch (_) {}

        if (!value || value === key || value === `[${key}]`) value = fallback;
        substitutions.forEach((replacement, index) => {
            value = value
                .replaceAll(`$${index + 1}`, String(replacement))
                .replace('%s', String(replacement));
        });
        return value;
    }

    function cleanDomainInput(value) {
        const input = String(value || '').trim().toLowerCase();
        if (!input) return null;

        const wildcard = input.startsWith('*.');
        if (input.includes('*') && !wildcard) return null;
        const base = wildcard ? input.slice(2) : input;
        if (!base) return null;

        if (typeof canonicalizeIpEntry === 'function') {
            const canonicalIp = canonicalizeIpEntry(base);
            if (canonicalIp !== null) return wildcard ? null : canonicalIp;
        }

        let ascii;
        try {
            if (typeof punycode === 'undefined' || typeof punycode.toASCII !== 'function') return null;
            ascii = punycode.toASCII(base).toLowerCase();
        } catch (_) {
            return null;
        }

        if (!ascii || ascii.length > 253) return null;
        const labels = ascii.split('.');
        if (labels.some((label) => label.length > 63 || !DOMAIN_LABEL.test(label))) return null;
        return wildcard ? `*.${ascii}` : ascii;
    }

    function textForDomain(domain) {
        return typeof domainToUnicode === 'function' ? domainToUnicode(domain) : domain;
    }

    function setStatus(type, message) {
        const status = $('popupWhitelistStatus');
        if (!status) return;
        if (statusTimer) clearTimeout(statusTimer);
        status.className = `whitelist-status${type ? ` ${type}` : ''}`;
        status.textContent = message || '';
        if (message) {
            statusTimer = setTimeout(() => {
                status.className = 'whitelist-status';
                status.textContent = '';
                statusTimer = null;
            }, 3500);
        }
    }

    function applyText() {
        const title = $('whitelistTitle');
        if (title) title.textContent = localized('whitelist_section_title', 'Domain Whitelist');

        const description = $('whitelistDescription');
        if (description) {
            description.textContent = localized(
                'whitelist_section_description',
                'Domains and IP addresses added here bypass URL cleaning. Tracking parameters will be preserved on these sites.'
            );
        }

        const input = $('popupWhitelistInput');
        if (input) input.placeholder = localized('whitelist_input_placeholder', 'example.com, *.example.com, or 192.168.1.1');
        const inputLabel = $('popupWhitelistInputLabel');
        if (inputLabel) inputLabel.textContent = localized('popup_whitelist_input_label', 'Domain or IP address');
        const hint = $('popupWhitelistHint');
        if (hint) hint.textContent = localized(
            'popup_whitelist_input_hint',
            'Use a domain, *.example.com, or an IP address. International domain names are converted to Punycode when saved.'
        );

        const scopeLabel = $('popupWhitelistScopeLabel');
        if (scopeLabel) scopeLabel.textContent = localized('whitelist_mode_label', 'Whitelist scope');
        const scopeHint = $('popupWhitelistScopeHint');
        if (scopeHint) scopeHint.textContent = localized(
            'popup_whitelist_scope_hint',
            'General bypasses all URL cleaning; History API only skips cleaning after same-page navigation.'
        );
        const generalOption = $('popupWhitelistScope')?.querySelector('option[value="general"]');
        if (generalOption) generalOption.textContent = localized('whitelist_mode_general', 'General whitelist');
        const historyOption = $('popupWhitelistScope')?.querySelector('option[value="history"]');
        if (historyOption) historyOption.textContent = localized('whitelist_mode_history_api', 'History API only');

        const add = $('popupWhitelistAdd');
        if (add) add.textContent = localized('whitelist_add_button', 'Add');
        const search = $('popupWhitelistSearch');
        if (search) search.placeholder = localized('whitelist_search_placeholder', 'Search whitelisted domains');
        const searchLabel = $('popupWhitelistSearchLabel');
        if (searchLabel) searchLabel.textContent = localized('whitelist_search_placeholder', 'Search');

        renderEntries();
        renderPunycodePreview();
        if (typeof applyPopupLanguageLayout === 'function') applyPopupLanguageLayout();
    }

    function allEntries() {
        const general = Array.isArray(userWhitelist) ? userWhitelist : [];
        const history = Array.isArray(historyApiWhitelist) ? historyApiWhitelist : [];
        return [
            ...general.map((domain) => ({ domain, scope: 'general' })),
            ...history.map((domain) => ({ domain, scope: 'history' }))
        ].filter((entry) => typeof entry.domain === 'string')
            .sort((a, b) => a.domain.localeCompare(b.domain) || a.scope.localeCompare(b.scope));
    }

    function renderEntries() {
        const list = $('popupWhitelistEntries');
        if (!list) return;

        const entries = allEntries();
        const query = searchTerm.trim().toLowerCase();
        const visible = entries.filter(({ domain, scope }) => {
            if (!query) return true;
            const unicode = textForDomain(domain);
            const scopeLabel = scope === 'history'
                ? localized('whitelist_type_history_api', 'History API only')
                : localized('whitelist_type_general', 'General');
            return domain.toLowerCase().includes(query) ||
                unicode.toLowerCase().includes(query) || scopeLabel.toLowerCase().includes(query);
        });

        const count = $('popupWhitelistCount');
        if (count) {
            const locale = typeof getPopupLanguageCode === 'function' ? getPopupLanguageCode() : 'en';
            const formatted = new Intl.NumberFormat(locale || 'en').format(entries.length);
            count.textContent = localized('whitelist_exception_count', `${formatted} exception(s)`).replace('%d', formatted);
        }

        const fragment = document.createDocumentFragment();
        if (visible.length === 0) {
            const empty = document.createElement('li');
            empty.className = 'empty-message';
            empty.textContent = localized('whitelist_exception_empty', 'No whitelist exceptions');
            fragment.appendChild(empty);
        } else {
            visible.forEach(({ domain, scope }) => {
                const item = document.createElement('li');
                item.className = 'whitelist-popup-item';

                const entry = document.createElement('div');
                entry.className = 'whitelist-popup-entry';

                const displayDomain = textForDomain(domain);
                const domainLabel = document.createElement('span');
                domainLabel.className = 'whitelist-popup-domain';
                domainLabel.textContent = displayDomain;
                domainLabel.title = domain;
                entry.appendChild(domainLabel);

                if (displayDomain !== domain) {
                    const asciiLabel = document.createElement('code');
                    asciiLabel.className = 'whitelist-popup-ascii';
                    asciiLabel.textContent = domain;
                    entry.appendChild(asciiLabel);
                }

                const scopeLabel = document.createElement('span');
                scopeLabel.className = 'whitelist-popup-scope';
                scopeLabel.textContent = scope === 'history'
                    ? localized('whitelist_type_history_api', 'History API only')
                    : localized('whitelist_type_general', 'General');
                entry.appendChild(scopeLabel);

                const remove = document.createElement('button');
                remove.type = 'button';
                remove.className = 'whitelist-popup-remove';
                remove.dataset.domain = domain;
                remove.dataset.scope = scope;
                remove.textContent = localized('whitelist_remove_button', 'Remove');
                remove.setAttribute('aria-label', `${localized('whitelist_remove_button', 'Remove')} ${displayDomain}`);

                item.append(entry, remove);
                fragment.appendChild(item);
            });
        }
        list.replaceChildren(fragment);
    }

    function renderPunycodePreview() {
        const preview = $('popupWhitelistPunycode');
        const input = $('popupWhitelistInput');
        if (!preview || !input) return;

        const ascii = cleanDomainInput(input.value);
        if (!ascii) {
            preview.textContent = '';
            return;
        }
        const unicode = textForDomain(ascii);
        preview.textContent = unicode !== ascii
            ? localized('popup_whitelist_punycode_preview', `Punycode: ${ascii}`, [ascii])
            : '';
    }

    async function refreshEntries() {
        const [generalResponse, historyResponse] = await Promise.all([
            browser.runtime.sendMessage({ function: 'getData', params: ['userWhitelist'] }),
            browser.runtime.sendMessage({ function: 'getData', params: ['historyApiWhitelist'] })
        ]);

        if (generalResponse?.error || historyResponse?.error) {
            throw new Error('Could not load whitelist');
        }
        userWhitelist = Array.isArray(generalResponse?.response) ? generalResponse.response : [];
        historyApiWhitelist = Array.isArray(historyResponse?.response) ? historyResponse.response : [];
        renderEntries();
    }

    async function addDomain(event) {
        event.preventDefault();
        const input = $('popupWhitelistInput');
        const submit = $('popupWhitelistAdd');
        const raw = input?.value || '';
        if (!raw.trim()) {
            setStatus('error', localized('whitelist_enter_domain', 'Please enter a domain name'));
            input?.focus();
            return;
        }

        const domain = cleanDomainInput(raw);
        if (!domain) {
            setStatus('error', localized('whitelist_invalid_format', 'Enter a valid domain, wildcard, or IP address.'));
            input?.focus();
            return;
        }

        const scope = $('popupWhitelistScope')?.value === 'history' ? 'history' : 'general';
        const list = scope === 'history' ? historyApiWhitelist : userWhitelist;
        if (list.some((entry) => entry.toLowerCase() === domain)) {
            setStatus('error', localized('whitelist_already_exists', 'Domain already in whitelist or invalid'));
            return;
        }

        if (submit) submit.disabled = true;
        try {
            const response = await browser.runtime.sendMessage({
                function: scope === 'history' ? 'addToHistoryApiWhitelist' : 'addToWhitelist',
                params: [domain]
            });
            if (!response?.response) {
                setStatus('error', localized('whitelist_already_exists', 'Domain already in whitelist or invalid'));
                return;
            }

            input.value = '';
            renderPunycodePreview();
            await refreshEntries();
            const display = textForDomain(domain);
            const key = scope === 'history' ? 'whitelist_added_history_api' : 'whitelist_added_general';
            const fallback = scope === 'history'
                ? `Added ${display} as a History API exception`
                : `Added ${display} to general whitelist`;
            setStatus('success', localized(key, fallback).replace('%s', display));
        } catch (_) {
            setStatus('error', localized('whitelist_add_failed', 'Failed to add domain to whitelist'));
        } finally {
            if (submit) submit.disabled = false;
        }
    }

    async function removeDomain(button) {
        const domain = button.dataset.domain;
        const scope = button.dataset.scope === 'history' ? 'history' : 'general';
        if (!domain) return;

        button.disabled = true;
        try {
            const response = await browser.runtime.sendMessage({
                function: scope === 'history' ? 'removeFromHistoryApiWhitelist' : 'removeFromWhitelist',
                params: [domain]
            });
            if (!response?.response) throw new Error('Remove failed');
            await refreshEntries();
            const display = textForDomain(domain);
            const key = scope === 'history' ? 'whitelist_removed_history_api' : 'whitelist_removed_general';
            const fallback = scope === 'history'
                ? `Removed History API exception for ${display}`
                : `Removed ${display} from general whitelist`;
            setStatus('success', localized(key, fallback).replace('%s', display));
        } catch (_) {
            setStatus('error', localized('whitelist_remove_failed', 'Failed to remove domain from whitelist'));
            button.disabled = false;
        }
    }

    const panel = $('whitelistPanel');
    const mainContent = $('mainContent');

    async function openPanel() {
        if (!panel || !mainContent) return;
        mainContent.style.display = 'none';
        const license = $('licenseContent');
        if (license) license.style.display = 'none';
        const troubleshooter = $('troubleshooterPanel');
        if (troubleshooter) troubleshooter.hidden = true;
        panel.hidden = false;
        applyText();
        try {
            await refreshEntries();
            setStatus('', '');
        } catch (_) {
            setStatus('error', localized('whitelist_load_failed', 'Failed to load whitelist'));
        }
    }

    $('whitelist_page')?.addEventListener('click', openPanel);
    $('popupWhitelistForm')?.addEventListener('submit', addDomain);
    $('popupWhitelistInput')?.addEventListener('input', renderPunycodePreview);
    $('popupWhitelistSearch')?.addEventListener('input', (event) => {
        searchTerm = event.target.value || '';
        renderEntries();
    });
    $('popupWhitelistEntries')?.addEventListener('click', (event) => {
        const button = event.target.closest('.whitelist-popup-remove');
        if (button) removeDomain(button);
    });

    applyText();
    if (typeof waitForPopupI18n === 'function') {
        Promise.resolve(waitForPopupI18n()).then(applyText).catch(() => {});
    }
})();
