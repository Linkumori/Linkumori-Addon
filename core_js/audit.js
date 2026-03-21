/*
 * ============================================================
 * Linkumori — Audit Script (core_js/audit.js)
 * ============================================================
 * Copyright (c) 2025–2026 Subham Mahesh
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
 * - Loads bundled rules JSON for audit inspection
 * - Loads final merged runtime ClearURLs data
 * - Loads custom rules and latest cached remote rules
 * - Uses LinkumoriI18n for audit page text and status messages
 * - Manages the audit source switcher and FAQ modal interactions
 *
 * ============================================================
 * MODIFICATION HISTORY
 * ============================================================
 * 2025-06-14   Subham Mahesh   First modification
 * 2025-08-21   Subham Mahesh   Second modification
 * 2025-09-05   Subham Mahesh   Third modification
 * 2026-03-14   Subham Mahesh   Fourth modification
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

const sourceState = {
    active: 'bundled',
    bundled: null,
    final: null,
    custom: null,
    remote: null
};

function translate(key, ...placeholders) {
    try {
        return LinkumoriI18n.getMessage(key, placeholders) || '';
    } catch (error) {
        return '';
    }
}

function setHTMLContent(element, html) {
    if (!element) {
        return;
    }

    const parser = new DOMParser();
    const doc = parser.parseFromString(`<!doctype html><body>${html || ''}</body>`, 'text/html');
    element.replaceChildren(...Array.from(doc.body.childNodes));
}

function setElementText(id, key) {
    const element = document.getElementById(id);
    if (!element) {
        return;
    }

    element.textContent = translate(key);
}

function setElementHTML(id, key) {
    const element = document.getElementById(id);
    if (!element) {
        return;
    }

    setHTMLContent(element, translate(key));
}

function formatJson(value) {
    return JSON.stringify(value, null, 2);
}

function countProviders(data) {
    if (!data || typeof data !== 'object' || !data.providers || typeof data.providers !== 'object') {
        return 0;
    }

    return Object.keys(data.providers).length;
}

function setStatus(message, type = 'info') {
    const status = document.getElementById('statusMessage');
    if (!status) {
        return;
    }

    status.textContent = message;
    status.style.display = 'block';
    status.classList.remove('status-success', 'status-error', 'status-info');
    status.classList.add(`status-${type}`);
}

function getSourceDetails(sourceKey) {
    const sourceMap = {
        bundled: {
            buttonKey: 'audit_source_bundled',
            titleKey: 'audit_source_bundled',
            sourceKey: 'audit_source_bundled_description',
            metaLabelKey: 'audit_meta_source_bundled'
        },
        final: {
            buttonKey: 'audit_source_final',
            titleKey: 'audit_source_final',
            sourceKey: 'audit_source_final_description',
            metaLabelKey: 'audit_meta_source_final'
        },
        custom: {
            buttonKey: 'audit_source_custom',
            titleKey: 'audit_source_custom',
            sourceKey: 'audit_source_custom_description',
            metaLabelKey: 'audit_meta_source_custom'
        },
        remote: {
            buttonKey: 'audit_source_remote',
            titleKey: 'audit_source_remote',
            sourceKey: 'audit_source_remote_description',
            metaLabelKey: 'audit_meta_source_remote'
        }
    };

    return sourceMap[sourceKey] || sourceMap.bundled;
}

function buildMetaText(sourceKey, data, charCount) {
    const providerCount = countProviders(data);
    const details = getSourceDetails(sourceKey);
    return translate(
        'audit_meta_template',
        translate(details.metaLabelKey),
        String(providerCount),
        String(charCount)
    );
}

function renderActiveSource() {
    const viewerTitle = document.getElementById('viewerTitle');
    const viewerSource = document.getElementById('viewerSource');
    const viewerMeta = document.getElementById('viewerMeta');
    const viewerJson = document.getElementById('viewerJson');
    const activeKey = sourceState.active;
    const activeData = sourceState[activeKey];

    if (!viewerTitle || !viewerSource || !viewerMeta || !viewerJson) {
        return;
    }

    const details = getSourceDetails(activeKey);
    viewerTitle.textContent = translate(details.titleKey);
    viewerSource.textContent = translate(details.sourceKey);

    if (activeData === null) {
        viewerJson.textContent = '{}';
        viewerJson.classList.remove('is-error');
        viewerMeta.textContent = translate('audit_meta_waiting');
    } else {
        const rendered = formatJson(activeData);
        const hasError = !!activeData.error;
        viewerJson.textContent = rendered;
        viewerJson.classList.toggle('is-error', hasError);
        viewerMeta.textContent = hasError ? translate('audit_meta_error') : buildMetaText(activeKey, activeData, rendered.length);
    }

    document.querySelectorAll('.audit-view-btn').forEach((button) => {
        button.classList.toggle('active', button.dataset.source === activeKey);
    });
}

function setSourceData(sourceKey, data) {
    sourceState[sourceKey] = data;
    renderActiveSource();
}

async function loadBundledRules() {
    const bundledUrl = browser.runtime.getURL('data/linkumori-clearurls-min.json');
    const response = await fetch(bundledUrl, { cache: 'no-store' });

    if (!response.ok) {
        throw new Error(translate('audit_error_bundled_fetch', String(response.status)));
    }

    return response.json();
}

async function loadFinalRules() {
    const response = await browser.runtime.sendMessage({
        function: 'getData',
        params: ['ClearURLsData']
    });

    if (!response || response.response === undefined) {
        throw new Error(translate('audit_error_final_missing'));
    }

    return response.response;
}

async function loadCustomRules() {
    const response = await browser.runtime.sendMessage({
        function: 'getData',
        params: ['custom_rules']
    });

    if (!response || response.response === undefined) {
        throw new Error(translate('audit_error_custom_missing'));
    }

    return response.response;
}

async function loadRemoteRules() {
    const response = await browser.runtime.sendMessage({
        function: 'getData',
        params: ['remoteRulescache']
    });

    if (!response || response.response === undefined) {
        throw new Error(translate('audit_error_remote_cache_missing'));
    }

    const cache = response.response;
    if (!cache || typeof cache !== 'object') {
        return {
            unavailable: true,
            message: translate('audit_remote_unavailable')
        };
    }

    if (!cache.data || typeof cache.data !== 'object') {
        return {
            unavailable: true,
            message: translate('audit_remote_payload_unavailable')
        };
    }

    return cache.data;
}

async function refreshAudit() {
    setStatus(translate('audit_status_loading'), 'info');

    const results = await Promise.allSettled([
        loadBundledRules(),
        loadFinalRules(),
        loadCustomRules(),
        loadRemoteRules()
    ]);

    const bundledResult = results[0];
    const finalResult = results[1];
    const customResult = results[2];
    const remoteResult = results[3];

    if (bundledResult.status === 'fulfilled') {
        setSourceData('bundled', bundledResult.value);
    } else {
        setSourceData('bundled', { error: bundledResult.reason?.message || translate('audit_error_unknown_bundled') });
    }

    if (finalResult.status === 'fulfilled') {
        setSourceData('final', finalResult.value);
    } else {
        setSourceData('final', { error: finalResult.reason?.message || translate('audit_error_unknown_final') });
    }

    if (customResult.status === 'fulfilled') {
        setSourceData('custom', customResult.value);
    } else {
        setSourceData('custom', { error: customResult.reason?.message || translate('audit_error_unknown_custom') });
    }

    if (remoteResult.status === 'fulfilled') {
        setSourceData('remote', remoteResult.value);
    } else {
        setSourceData('remote', { error: remoteResult.reason?.message || translate('audit_error_unknown_remote') });
    }

    const remoteUnavailable = remoteResult.status === 'fulfilled' && remoteResult.value && remoteResult.value.unavailable === true;
    const hasBlockingFailure =
        bundledResult.status !== 'fulfilled' ||
        finalResult.status !== 'fulfilled' ||
        customResult.status !== 'fulfilled' ||
        (remoteResult.status !== 'fulfilled' && !remoteUnavailable);

    if (
        bundledResult.status === 'fulfilled' &&
        finalResult.status === 'fulfilled' &&
        customResult.status === 'fulfilled' &&
        remoteResult.status === 'fulfilled'
    ) {
        if (remoteUnavailable) {
            setStatus(translate('audit_status_remote_unavailable'), 'info');
        } else {
            setStatus(translate('audit_status_loaded'), 'success');
        }
        return;
    }

    if (hasBlockingFailure) {
        setStatus(translate('audit_status_partial_error'), 'error');
    }
}

function initializeTheme() {
    const applyThemeToUI = (theme) => {
        document.documentElement.setAttribute('data-theme', normalizeTheme(theme || DEFAULT_THEME));
        syncBootstrapTheme(theme || DEFAULT_THEME);
    };

    const themeToggle = document.getElementById('themeToggle');
    applyThemeToUI(document.documentElement.getAttribute('data-theme') || DEFAULT_THEME);

    browser.storage.local.get([THEME_STORAGE_KEY]).then((result) => {
        applyThemeToUI(result[THEME_STORAGE_KEY] || DEFAULT_THEME);
    }).catch(() => {
        applyThemeToUI(DEFAULT_THEME);
    });

    if (themeToggle) {
        themeToggle.onclick = async () => {
            const currentTheme = normalizeTheme(document.documentElement.getAttribute('data-theme') || DEFAULT_THEME);
            const result = await browser.storage.local.get([
                LAST_DARK_THEME_STORAGE_KEY,
                LIGHT_THEME_STORAGE_KEY,
                DARK_THEME_STORAGE_KEY
            ]);
            const { nextTheme: newTheme, payload } = buildThemeTogglePayload(currentTheme, result);
            applyThemeToUI(newTheme);
            await browser.storage.local.set(payload);
        };
    }
}

function showFaqModal() {
    const modal = document.getElementById('faqModal');
    if (!modal) {
        return;
    }

    modal.style.display = 'flex';
    requestAnimationFrame(() => {
        modal.classList.add('show');
    });
}

function hideFaqModal() {
    const modal = document.getElementById('faqModal');
    if (!modal) {
        return;
    }

    modal.classList.remove('show');
    setTimeout(() => {
        if (!modal.classList.contains('show')) {
            modal.style.display = 'none';
        }
    }, 300);
}

function setText() {
    document.title = translate('audit_html_page_title');

    setElementText('auditPageTitle', 'audit_html_page_title');
    setElementText('auditBadgeLabel', 'audit_badge_label');
    setElementText('auditSectionTitle', 'audit_section_title');
    setElementText('auditViewerTitle', 'audit_viewer_title');
    setElementText('auditViewerDescription', 'audit_viewer_description');
    setElementText('refreshButton', 'audit_refresh_button');
    setElementText('openFaqButtonText', 'audit_faq_button');
    setElementText('sourceButtonBundled', 'audit_source_bundled');
    setElementText('sourceButtonFinal', 'audit_source_final');
    setElementText('sourceButtonCustom', 'audit_source_custom');
    setElementText('sourceButtonRemote', 'audit_source_remote');
    setElementText('faqModalTitle', 'audit_faq_modal_title');

    setElementText('faqAuditProviderTitle', 'audit_faq_audit_provider_title');
    setElementHTML('faqAuditProviderBody', 'audit_faq_audit_provider_body');
    setElementText('faqOverrideTitle', 'audit_faq_override_title');
    setElementHTML('faqOverrideBody', 'audit_faq_override_body');
    setElementText('faqUrlPatternTitle', 'audit_faq_url_pattern_title');
    setElementHTML('faqUrlPatternBody', 'audit_faq_url_pattern_body');
    setElementText('faqDomainPatternsTitle', 'audit_faq_domain_patterns_title');
    setElementHTML('faqDomainPatternsBody', 'audit_faq_domain_patterns_body');
    setElementText('faqRulesTitle', 'audit_faq_rules_title');
    setElementHTML('faqRulesBody', 'audit_faq_rules_body');
    setElementText('faqExceptionsTitle', 'audit_faq_exceptions_title');
    setElementHTML('faqExceptionsBody', 'audit_faq_exceptions_body');
    setElementText('faqRedirectionsTitle', 'audit_faq_redirections_title');
    setElementHTML('faqRedirectionsBody', 'audit_faq_redirections_body');
    setElementText('faqMethodsResourcesTitle', 'audit_faq_methods_resources_title');
    setElementHTML('faqMethodsResourcesBody', 'audit_faq_methods_resources_body');
    setElementText('faqCompleteForceTitle', 'audit_faq_complete_force_title');
    setElementHTML('faqCompleteForceBody', 'audit_faq_complete_force_body');
    setElementText('faqFieldsTitle', 'audit_faq_fields_title');
    setElementHTML('faqFieldsBody', 'audit_faq_fields_body');
    setElementText('faqIntro', 'audit_faq_intro');

    const themeToggle = document.getElementById('themeToggle');
    if (themeToggle) {
        themeToggle.setAttribute('aria-label', translate('audit_theme_toggle_aria'));
    }

    const sunIcon = document.getElementById('auditSunIcon');
    if (sunIcon) {
        sunIcon.setAttribute('alt', translate('sunIconAlt'));
    }

    const moonIcon = document.getElementById('auditMoonIcon');
    if (moonIcon) {
        moonIcon.setAttribute('alt', translate('moonIconAlt'));
    }

    const closeFaqButton = document.getElementById('closeFaqButton');
    if (closeFaqButton) {
        closeFaqButton.setAttribute('aria-label', translate('audit_faq_close_aria'));
        closeFaqButton.setAttribute('title', translate('audit_faq_close_aria'));
    }
}

function initAuditPage() {
    initializeTheme();

    LinkumoriI18n.ready().then(() => {
        setText();
        renderActiveSource();
        LinkumoriI18n.addObserver(() => {
            setText();
            renderActiveSource();
        });
        return refreshAudit();
    }).catch(() => {
        setText();
        renderActiveSource();
        return refreshAudit();
    });

    const refreshButton = document.getElementById('refreshButton');
    const openFaqButton = document.getElementById('openFaqButton');
    const closeFaqButton = document.getElementById('closeFaqButton');
    const faqModal = document.getElementById('faqModal');

    if (refreshButton) {
        refreshButton.addEventListener('click', () => {
            refreshAudit().catch(error => {
                setStatus(error.message || translate('audit_status_refresh_failed'), 'error');
            });
        });
    }

    if (openFaqButton) {
        openFaqButton.addEventListener('click', showFaqModal);
    }

    if (closeFaqButton) {
        closeFaqButton.addEventListener('click', hideFaqModal);
    }

    if (faqModal) {
        faqModal.addEventListener('click', (event) => {
            if (event.target === faqModal) {
                hideFaqModal();
            }
        });
    }

    document.querySelectorAll('.audit-view-btn').forEach((button) => {
        button.addEventListener('click', () => {
            sourceState.active = button.dataset.source;
            renderActiveSource();
        });
    });
}

browser.storage.onChanged.addListener((changes, namespace) => {
    if (namespace === 'local' && changes[THEME_STORAGE_KEY] && changes[THEME_STORAGE_KEY].newValue) {
        document.documentElement.setAttribute('data-theme', normalizeTheme(changes[THEME_STORAGE_KEY].newValue));
    }
});

document.addEventListener('keydown', (event) => {
    if (event.key === 'Escape') {
        hideFaqModal();
    }
});

if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', initAuditPage);
} else {
    initAuditPage();
}
