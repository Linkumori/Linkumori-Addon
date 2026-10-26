/*
 * ============================================================
 * Linkumori — popup tab troubleshooter
 * ============================================================
 * Copyright (c) 2026 Subham Mahesh
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
 * The popup's tab troubleshooter: recording, findings grouped by rule,
 * failed requests, the "did Linkumori break this page?" check, the rule
 * search, and export.
 *
 * ============================================================
 * MODIFICATION HISTORY
 * ============================================================
 * 2026-10-26   Subham Mahesh   Moved out of popup.js and extended
 *
 * Note: Due to inline constraints, subsequent modifications may
 * not appear here. To view the full history, run:
 *
 *   node linkumori-cli-tool.js
 *
 * Select "Generate Commit History" to produce a Markdown file
 * listing all modifications by file, author, and date.
 * ============================================================
 */
(function () {
    'use strict';

    // English text. Each key is looked up as "troubleshooter_<key>" in the
    // locale files; a missing translation falls back to this text.
    const TS_TEXT = {
        launch: 'Troubleshoot this tab (experimental)',
        back: 'Back',
        experimental: 'Experimental',
        experimental_warning: 'Experimental: this troubleshooter is not fully stable. Its results can be wrong, and it switches rules off while it tests. If something looks wrong afterwards, check your rules in the custom rules editor, or use Stop search to switch them back on.',
        back_aria: 'Back to extension controls',
        title: 'Tab troubleshooter',
        page: 'Page',
        about_summary: 'How recording works',
        about_note: 'Opening this view may check the page URL, but records nothing. Recording stays off until you choose Start recording. Starting reloads this tab to capture its resource requests. Captured URLs stay in session storage for this browser session and are cleared when this tab closes or the browser session ends. Recording stops after 15 minutes unless you stop it sooner. Resource URLs may contain private query data.',
        start: 'Start recording',
        starting: 'Starting…',
        recording: 'Recording…',
        stop: 'Stop recording',
        refresh: 'Refresh',
        copy: 'Copy summary',
        export: 'Export',
        export_title: 'Save the recording as a JSON file. Resource URLs may contain private query data.',
        category: 'Category',
        category_all: 'All categories',
        category_url_rules: 'URL rules',
        category_redirects: 'Redirects',
        category_protection: 'Protection and bypasses',
        resource_type: 'Resource type',
        type_all: 'All resource types',
        search_placeholder: 'Search rules, providers and URLs',
        timer: 'Recording $1 · $2 left',
        status_checking: 'Checking this tab…',
        status_no_tab: 'No active tab is available.',
        status_not_web: 'This page does not allow URL rule scanning. Open a regular http or https webpage.',
        status_off: 'Recording is off. Start recording to inspect resource URLs loaded by this page.',
        status_active: '$1 URL change(s) captured so far. New ones appear here automatically.',
        status_stopped: 'Recording stopped. $1 URL change(s) captured.',
        status_not_saved: 'Recording data could not be saved in session storage. $1 URL change(s) may be lost if the extension restarts.',
        status_started: 'Recording started and the tab is reloading. Captured URLs appear here as the page loads.',
        status_stopped_saved: 'Recording stopped. $1 URL change(s) captured and saved for this browser session.',
        status_stopped_unsaved: 'Recording stopped. $1 URL change(s) captured, but session storage could not save them.',
        status_need_web: 'Open a regular http or https webpage first.',
        status_start_failed: 'Could not start recording for this tab.',
        status_stop_failed: 'Could not stop recording for this tab.',
        status_read_failed: 'Could not read this tab. Try closing and reopening the popup.',
        status_copied: 'Summary copied.',
        status_copy_failed: 'Could not copy the summary.',
        status_exported: 'Recording exported.',
        status_export_failed: 'Could not export the recording.',
        status_report_failed: 'Could not open the report form.',
        status_rule_changed_on: 'Rule enabled; reload the tab to compare.',
        status_rule_changed_off: 'Rule disabled; reload the tab to compare.',
        status_rule_failed: 'Could not update this rule.',
        empty_web: 'No rule changes found yet. Start recording to inspect this page’s resource URLs.',
        empty_not_web: 'This browser page cannot be scanned.',
        empty_filtered: 'No findings match these filters.',
        showing_first: 'Showing the first $1 rules.',
        hits: '$1 hit(s)',
        failed_badge: '$1 failed',
        rule_id: 'Rule ID: $1',
        rule_id_protection: 'Built-in protection action (no rule ID)',
        rule_id_missing: 'Rule ID: unavailable for this finding',
        rule_unresolved: 'Could not resolve this rule ID in the current ruleset.',
        source_observed: 'Observed request',
        source_page: 'Page URL check',
        changes: 'What changed: $1',
        affected_urls: 'Affected URLs ($1)',
        more_urls: '…and $1 more',
        after: 'After Linkumori',
        failed_after: 'Failed after Linkumori changed it: $1',
        advice_enabled: 'This rule is enabled. Turn it off and reload to compare the page.',
        advice_disabled: 'This rule is disabled. Turn it on and reload to restore its behavior.',
        advice_protection: 'This is a built-in protection action, not an individual rule.',
        advice_review: 'Review the affected URL before changing rules.',
        report: 'Report this rule',
        disable_rule: 'Disable rule',
        enable_rule: 'Enable rule',
        disable_rule_aria: 'Disable rule $1',
        enable_rule_aria: 'Enable rule $1',
        saving: 'Saving…',
        change_removed: 'removed $1',
        change_added: 'added $1',
        change_changed: 'changed $1',
        change_redirect: 'redirected to $1',
        change_path: 'path changed',
        change_fragment: 'fragment changed',
        change_other: 'URL changed',
        change_blocked: 'blocked on purpose',
        failures_summary: '$1 request(s) failed on this page; $2 right after Linkumori changed the URL',
        diag_idle_title: 'Is this page broken?',
        diag_idle_text: 'Find the rule that breaks it: the rules that ran on this page are switched off a few at a time, and you say whether the page is fixed. Not sure Linkumori is the cause? Check with cleaning paused first.',
        diag_idle_button: 'Check with cleaning paused first',
        diag_paused_title: 'Cleaning is paused for $1 in this tab',
        diag_paused_text: 'The tab reloaded without cleaning. Does the page work now?',
        diag_yes_works: 'Yes, it works',
        diag_no_broken: 'No, still broken',
        diag_cancel: 'Cancel',
        diag_done: 'Done',
        diag_not_linkumori_title: 'Probably not Linkumori',
        diag_not_linkumori_text: 'The page was still broken with cleaning paused, so the problem is likely elsewhere: the site itself, another extension or the network.',
        diag_linkumori_title: 'Linkumori is likely the cause',
        diag_linkumori_text: 'The page works with cleaning paused. Find the rule: some rules are switched off, the tab reloads, and you say whether the page is fixed. Every rule is switched back on at the end.',
        diag_linkumori_no_rules: 'The tab is reloading with cleaning back on, to record which rules run on this page. They appear here in a moment. If none do, use the page until it breaks.',
        diag_find_button: 'Find the rule ($1 rules)',
        diag_bisect_title: 'Finding the rule — round $1 (about $2 rounds in total)',
        diag_bisect_text: 'These $1 rules are switched off for this test ($2 rules are still suspected). The tab reloaded. Is the page fixed now?',
        diag_yes_fixed: 'Yes, fixed',
        diag_no_still: 'No, still broken',
        diag_found_title: 'Found it',
        diag_found_text: 'The page breaks because of rule $1$2. It is switched on again.',
        diag_found_provider: ' ($1)',
        diag_disable_culprit: 'Disable this rule',
        diag_report_culprit: 'Report it',
        diag_culprit_disabled: 'Rule switched off. Reload the tab to check.',
        diag_not_found_title: 'No single rule found',
        diag_not_found_text: 'Switching off rules one group at a time did not fix the page, so it is probably caused by several rules together, or by a protection setting. Every rule is switched back on.',
        diag_failed: 'Could not run the check: $1',
        diag_off_title: 'Found it',
        diag_off_text: 'The page breaks because of rule $1$2. It stays switched off so the page works; all other rules are back on. Reload the tab to check.',
        diag_reload_tab: 'Reload tab',
        diag_enable_again: 'Turn it back on',
        diag_culprit_enabled: 'Rule switched back on. Reload the tab to check.',
        diag_find_record: 'Record and find the rule',
        diag_idle_recording: 'Recording which rules run on this page. Use the page until it breaks; the rules show up here.',
        advice_in_search: 'Switched off for now by the rule search. It comes back on when the search ends.',
        advice_search_running: 'The rule search is running. Change rules after it ends.',
        diag_skip_round: 'Skip these rules',
        diag_skip_found: 'Skip — turn it back on',
        diag_keep_off: 'Keep it off',
        diag_skipped: 'Rule search skipped; every rule is on again.',
        diag_kept_off: 'Rule $1 stays off.',
        diag_bisect_text_one: 'This rule is switched off for this test ($1 rules are still suspected). The tab reloaded. Is the page fixed now?',
        diag_testing_rules: 'Switched off for this test:',
        diag_testing_more: '…and $1 more',
        diag_stop_search: 'Stop search',
        diag_skipped_round: 'Skipped: those rules are back on and left out. Testing the rest.',
        diag_not_found_skipped: 'No rule found among the rules tested. $1 rule(s) you skipped were not tested. Every rule is on again.',
        working: 'Working…',
        diag_record_again: 'Record again',
        diag_recorded_fresh: 'Old recording cleared. Recording this tab again from a fresh load.',
        clear: 'Clear',
        clear_title: 'Clear this tab\'s recording, findings and finished rule search. Rules stay as they are.',
        status_cleared: 'Cleared. Rules stay as they are.',
        status_cleared_off: 'Cleared. Rule $1 stays off.',
        diag_outdated_title: 'Reload Linkumori to use this check',
        diag_outdated_text: 'Linkumori was updated, but its background part is still running the old version. Reload the extension (for a temporary add-on: about:debugging → This Firefox → Reload), or restart Firefox.'
    };

    function ts(key, ...subs) {
        let text = '';
        if (typeof getPopupI18nMessage === 'function') {
            try {
                const translated = getPopupI18nMessage(`troubleshooter_${key}`, subs);
                if (translated && translated !== `troubleshooter_${key}` && translated !== `[troubleshooter_${key}]`) {
                    text = translated;
                }
            } catch (_) {
                // Fall back to English below.
            }
        }
        if (!text) {
            text = (TS_TEXT[key] || key).replace(/\$(\d+)/g, (match, n) => {
                const value = subs[Number(n) - 1];
                return value === undefined ? '' : String(value);
            });
        }
        return text;
    }

    function applyStaticText() {
        document.querySelectorAll('[data-ts]').forEach(node => { node.textContent = ts(node.dataset.ts); });
        document.querySelectorAll('[data-ts-aria]').forEach(node => node.setAttribute('aria-label', ts(node.dataset.tsAria)));
        document.querySelectorAll('[data-ts-placeholder]').forEach(node => { node.placeholder = ts(node.dataset.tsPlaceholder); });
        document.querySelectorAll('[data-ts-title]').forEach(node => { node.title = ts(node.dataset.tsTitle); });
    }

    const MAX_GROUPS = 60;
    const MAX_URLS_PER_GROUP = 10;
    const $ = id => document.getElementById(id);

    // An updated popup can talk to a background that still runs the old
    // code (a temporary add-on that was not reloaded). It then rejects the
    // new functions; report that as "outdated" rather than a raw error.
    function isOutdatedBackgroundError(error) {
        return /is not allowed|not found or not callable/.test(String(error || ''));
    }

    async function message(functionName, params = []) {
        const response = await browser.runtime.sendMessage({ function: functionName, params });
        if (response && isOutdatedBackgroundError(response.error)) {
            const error = new Error(ts('diag_outdated_text'));
            error.outdatedBackground = true;
            throw error;
        }
        return response;
    }

    function el(tag, className, text) {
        const node = document.createElement(tag);
        if (className) node.className = className;
        if (text !== undefined && text !== null) node.textContent = String(text);
        return node;
    }

    let lastClickedButton = null;

    function button(label, className, onClick) {
        const node = el('button', className, label);
        node.type = 'button';
        if (onClick) {
            node.addEventListener('click', event => {
                lastClickedButton = node;
                return onClick(event);
            });
        }
        return node;
    }

    // Long URLs are clamped to a few lines; click or press Enter to show all of it.
    function urlBlock(url, className = 'troubleshooter-url') {
        const node = el('code', className, url);
        node.title = url;
        node.tabIndex = 0;
        node.setAttribute('role', 'button');
        node.setAttribute('aria-expanded', 'false');
        const toggle = () => {
            const expanded = node.classList.toggle('expanded');
            node.setAttribute('aria-expanded', String(expanded));
        };
        node.addEventListener('click', () => {
            // Leave a text selection alone so the URL can still be copied.
            if (window.getSelection && String(window.getSelection())) return;
            toggle();
        });
        node.addEventListener('keydown', event => {
            if (event.key === 'Enter' || event.key === ' ') {
                event.preventDefault();
                toggle();
            }
        });
        return node;
    }

    function formatDuration(ms) {
        const totalSeconds = Math.max(0, Math.floor(ms / 1000));
        return `${String(Math.floor(totalSeconds / 60)).padStart(2, '0')}:${String(totalSeconds % 60).padStart(2, '0')}`;
    }

    function stripHash(url) {
        const index = String(url || '').indexOf('#');
        return index === -1 ? String(url || '') : String(url).slice(0, index);
    }

    // What Linkumori did to one URL, in a few words.
    function describeChange(before, after) {
        if (!after || before === after) return [ts('change_blocked')];
        let a;
        let b;
        try {
            a = new URL(before);
            b = new URL(after);
        } catch (_) {
            return [ts('change_other')];
        }
        if (a.host !== b.host || a.protocol !== b.protocol) return [ts('change_redirect', b.host)];
        const parts = [];
        const beforeKeys = [...new Set(a.searchParams.keys())];
        const afterKeys = [...new Set(b.searchParams.keys())];
        const removed = beforeKeys.filter(key => !b.searchParams.has(key));
        const added = afterKeys.filter(key => !a.searchParams.has(key));
        const changed = beforeKeys.filter(key => b.searchParams.has(key) &&
            a.searchParams.getAll(key).join('\u0000') !== b.searchParams.getAll(key).join('\u0000'));
        if (removed.length) parts.push(ts('change_removed', removed.join(', ')));
        if (changed.length) parts.push(ts('change_changed', changed.join(', ')));
        if (added.length) parts.push(ts('change_added', added.join(', ')));
        if (a.pathname !== b.pathname) parts.push(ts('change_path'));
        if (a.hash !== b.hash) parts.push(ts('change_fragment'));
        return parts.length ? parts : [ts('change_other')];
    }

    // ── State ────────────────────────────────────────────────────────────
    let refreshGeneration = 0;
    let timerInterval = null;
    let pollTick = 0;
    let captureState = null;
    let lastData = null;
    let searchDebounce = null;
    // The page URL check is the slowest call; reuse it for the same URL
    // for a short while. "Refresh" always runs it again.
    const TRACE_CACHE_MS = 60000;
    let traceCache = null;

    function stopTimer() {
        if (timerInterval) clearInterval(timerInterval);
        timerInterval = null;
        captureState = null;
        const timer = $('troubleshooterTimer');
        if (timer) timer.hidden = true;
    }

    function renderTimer() {
        const timer = $('troubleshooterTimer');
        if (!timer || !captureState) return;
        const now = Date.now();
        timer.textContent = ts('timer', formatDuration(now - captureState.startedAt), formatDuration(captureState.expiresAt - now));
        timer.title = new Date(captureState.startedAt).toLocaleTimeString();
        timer.hidden = false;
    }

    // While recording: tick every second, and every 3 seconds pick up new
    // captured URLs and failed requests.
    function startTimer(capture, tabId) {
        captureState = {
            tabId,
            startedAt: capture.startedAt,
            expiresAt: capture.expiresAt,
            count: capture.entries.length + capture.failures.length
        };
        renderTimer();
        if (timerInterval) return;
        pollTick = 0;
        timerInterval = setInterval(async () => {
            const state = captureState;
            const panel = $('troubleshooterPanel');
            if (!state || !panel || panel.hidden) {
                stopTimer();
                return;
            }
            renderTimer();
            if (Date.now() >= state.expiresAt) {
                stopTimer();
                refresh({ quiet: true });
                return;
            }
            pollTick = (pollTick + 1) % 3;
            if (pollTick !== 0) return;
            try {
                const response = await message('getTabTroubleshooterCapture', [state.tabId]);
                const capture = response?.response;
                if (!capture || captureState !== state) return;
                const count = (capture.entries || []).length + (capture.failures || []).length;
                if (!capture.active || count !== state.count) {
                    state.count = count;
                    refresh({ quiet: true });
                }
            } catch (_) {
                // Try again on the next poll.
            }
        }, 1000);
    }

    async function getActiveTab() {
        const [tab] = await browser.tabs.query({ active: true, currentWindow: true });
        return tab && typeof tab.id === 'number' ? tab : null;
    }

    function isWebUrl(url) {
        return /^https?:\/\//i.test(url || '');
    }

    // ── Data ─────────────────────────────────────────────────────────────

    function getCategory(entry) {
        if (entry?.logCategory === 'feature') return 'protection';
        if (['redirections', 'fieldRedirections'].includes(entry?.matchedRuleSection)) return 'redirects';
        return 'url-rules';
    }

    function buildFindings(tab, capture, trace) {
        const findings = [];
        capture.entries.forEach(entry => findings.push({
            pageUrl: tab.url,
            resourceUrl: entry.resourceURL || entry.before || entry.url || tab.url,
            after: entry.after || '',
            rule: entry.rule || 'Unknown rule',
            providerName: entry.providerName || '',
            requestType: entry.requestType || '',
            matchedRuleSection: entry.matchedRuleSection || '',
            patternType: entry.patternType || '',
            patternValue: entry.patternValue || '',
            matchedRuleId: entry.matchedRuleId || null,
            matchedRuleDisableId: entry.matchedRuleDisableId || entry.matchedRuleId || null,
            category: getCategory(entry),
            source: 'observed'
        }));
        if (trace?.success && Array.isArray(trace.steps)) {
            trace.steps.forEach(step => findings.push({
                pageUrl: tab.url,
                resourceUrl: step.before || tab.url,
                after: step.after || '',
                rule: step.matchedRule || 'Unknown rule',
                providerName: step.providerName || '',
                requestType: 'main_frame',
                matchedRuleSection: step.matchedRuleSection || '',
                patternType: step.patternType || '',
                patternValue: step.patternValue || '',
                matchedRuleId: step.matchedRuleId || null,
                matchedRuleDisableId: step.matchedRuleDisableId || step.matchedRuleId || null,
                category: step.action === 'redirect' || ['redirections', 'fieldRedirections'].includes(step.matchedRuleSection)
                    ? 'redirects' : 'url-rules',
                source: 'page'
            }));
        }

        // Link each change to a request that then failed.
        const failuresByUrl = new Map();
        capture.failures.forEach(failure => {
            const key = stripHash(failure.url);
            if (!failuresByUrl.has(key)) failuresByUrl.set(key, failure);
        });
        const linkedFailures = new Set();
        const seen = new Set();
        const unique = [];
        findings.forEach(finding => {
            const key = [finding.source, finding.matchedRuleId || finding.rule, finding.resourceUrl, finding.after].join('\u0000');
            if (seen.has(key)) return;
            seen.add(key);
            // A blocked request (same URL before and after) fails on purpose;
            // only a URL Linkumori rewrote can fail because of the rewrite.
            const rewritten = finding.after && finding.after !== finding.resourceUrl;
            const failure = rewritten ? failuresByUrl.get(stripHash(finding.after)) : null;
            if (failure) {
                finding.failure = failure;
                linkedFailures.add(failure);
            }
            finding.changes = describeChange(finding.resourceUrl, finding.after);
            unique.push(finding);
        });
        return { findings: unique, linkedFailures: linkedFailures.size };
    }

    function groupFindings(findings) {
        const groups = new Map();
        findings.forEach(finding => {
            // One card per rule: the same rule can be logged under its
            // provider key and under a pattern key.
            const key = [finding.matchedRuleId || finding.matchedRuleDisableId || finding.rule,
                finding.providerName, finding.category].join('\u0000');
            if (!groups.has(key)) {
                groups.set(key, {
                    key,
                    rule: finding.rule,
                    providerName: finding.providerName,
                    category: finding.category,
                    matchedRuleId: finding.matchedRuleId,
                    identity: finding.category === 'protection' ? null : {
                        runtimeRuleId: finding.matchedRuleId || '',
                        disableId: finding.matchedRuleDisableId || '',
                        ruleId: finding.rule || '',
                        providerName: finding.providerName || '',
                        section: finding.matchedRuleSection || '',
                        patternType: finding.patternType || '',
                        patternValue: finding.patternValue || ''
                    },
                    hits: [],
                    sources: new Set(),
                    requestTypes: new Set(),
                    changes: new Set(),
                    failed: 0
                });
            }
            const group = groups.get(key);
            // Prefer the pattern key (what the engine actually switches) for the toggle.
            if (group.identity && finding.matchedRuleDisableId && finding.matchedRuleDisableId !== finding.matchedRuleId &&
                group.identity.disableId === group.identity.runtimeRuleId) {
                group.identity.disableId = finding.matchedRuleDisableId;
                group.identity.patternType = finding.patternType || group.identity.patternType;
                group.identity.patternValue = finding.patternValue || group.identity.patternValue;
            }
            group.hits.push(finding);
            group.sources.add(finding.source);
            if (finding.requestType) group.requestTypes.add(finding.requestType);
            finding.changes.forEach(change => group.changes.add(change));
            if (finding.failure) group.failed++;
        });
        return [...groups.values()].sort((left, right) =>
            (right.failed > 0) - (left.failed > 0) || right.hits.length - left.hits.length);
    }

    async function loadRuleStates(groups) {
        const requests = new Map();
        await Promise.all(groups.map(async group => {
            if (!group.identity) return;
            const key = JSON.stringify(group.identity);
            if (!requests.has(key)) {
                requests.set(key, message('getTroubleshooterRuleState', [group.identity]).catch(() => null));
            }
            group.ruleState = (await requests.get(key))?.response || null;
        }));
    }

    // Fetch everything for the active tab; render() draws it.
    async function refresh(options = {}) {
        const quiet = options.quiet === true;
        const generation = ++refreshGeneration;
        const isStale = () => generation !== refreshGeneration;
        const status = $('troubleshooterStatus');
        if (!status) return;
        if (!quiet) status.textContent = ts('status_checking');

        try {
            const tab = await getActiveTab();
            if (isStale()) return;
            if (!tab || !tab.url) {
                status.textContent = ts('status_no_tab');
                $('troubleshooterPage').replaceChildren();
                stopTimer();
                lastData = null;
                render();
                return;
            }
            const isWebPage = isWebUrl(tab.url);
            const [captureResponse, traceResponse, diagnosisResponse] = await Promise.all([
                message('getTabTroubleshooterCapture', [tab.id]).catch(() => null),
                !isWebPage ? Promise.resolve(null)
                    : (!options.fresh && traceCache && traceCache.url === tab.url && Date.now() - traceCache.at < TRACE_CACHE_MS)
                        ? Promise.resolve(traceCache.response)
                        : message('runRuleTestLab', [tab.url, '', { type: 'main_frame', method: 'GET', tabId: tab.id, frameId: 0 }])
                            .then(response => {
                                traceCache = { url: tab.url, at: Date.now(), response };
                                return response;
                            })
                            .catch(() => null),
                message('getTroubleshooterDiagnosis', [tab.id])
                    .catch(error => (error?.outdatedBackground ? { outdated: true } : null))
            ]);
            if (isStale()) return;

            const capture = captureResponse?.response || { active: false, entries: [] };
            if (!Array.isArray(capture.entries)) capture.entries = [];
            if (!Array.isArray(capture.failures)) capture.failures = [];
            const { findings, linkedFailures } = buildFindings(tab, capture, traceResponse?.response);
            const groups = groupFindings(findings);
            const diagnosisData = diagnosisResponse?.response;
            if (diagnosisData?.phase === 'found' && diagnosisData.culprit?.identity) {
                const culpritState = await message('getTroubleshooterRuleState', [diagnosisData.culprit.identity]).catch(() => null);
                diagnosisData.culpritState = culpritState?.response || null;
            }
            await loadRuleStates(groups.slice(0, MAX_GROUPS * 2));
            if (isStale()) return;

            // The count on "Find the rule" comes from the background, which
            // decides what the search tests, so the button never over-promises.
            const diagnosisPhase = diagnosisResponse?.response?.phase || 'idle';
            let bisectCount = null;
            if (isWebPage && (diagnosisPhase === 'idle' || diagnosisPhase === 'checked')) {
                const candidates = bisectCandidates({ groups });
                if (candidates.length) {
                    const countResponse = await message('countTroubleshooterBisectRules', [candidates.map(group => group.identity)]).catch(() => null);
                    if (Number.isInteger(countResponse?.response?.count)) bisectCount = countResponse.response.count;
                } else {
                    bisectCount = 0;
                }
                if (isStale()) return;
            }

            lastData = {
                bisectCount,
                tab,
                isWebPage,
                capture,
                groups,
                findings,
                linkedFailures,
                diagnosis: diagnosisResponse?.outdated
                    ? { phase: 'outdated' }
                    : diagnosisResponse?.response || { phase: 'idle' }
            };

            if (capture.active && Number.isFinite(capture.startedAt) && Number.isFinite(capture.expiresAt)) {
                startTimer(capture, tab.id);
            } else {
                stopTimer();
            }

            if (capture.storedInSession === false) {
                status.textContent = ts('status_not_saved', capture.entries.length);
            } else if (capture.active) {
                status.textContent = ts('status_active', capture.entries.length);
            } else if (capture.startedAt) {
                status.textContent = ts('status_stopped', capture.entries.length);
            } else if (!isWebPage) {
                status.textContent = ts('status_not_web');
            } else {
                status.textContent = ts('status_off');
            }
            render();
        } catch (error) {
            if (isStale()) return;
            status.textContent = ts('status_read_failed');
        }
    }

    // ── Rendering ────────────────────────────────────────────────────────

    function renderHeader(data) {
        const pageLabel = $('troubleshooterPage');
        if (pageLabel) {
            pageLabel.replaceChildren(...(data ? [
                el('span', 'troubleshooter-page-label', ts('page')),
                urlBlock(data.tab.url, 'troubleshooter-page-url')
            ] : []));
        }
        const scanButton = $('troubleshooterScan');
        const stopButton = $('troubleshooterStop');
        const active = !!data?.capture?.active;
        if (scanButton) {
            scanButton.disabled = active || !data?.isWebPage;
            scanButton.textContent = active ? ts('recording') : ts('start');
        }
        if (stopButton) {
            stopButton.hidden = !active;
            stopButton.disabled = false;
        }
        const hasData = !!(data && (data.findings.length || data.capture.failures.length));
        ['troubleshooterCopy', 'troubleshooterExport'].forEach(id => {
            const node = $(id);
            if (node) node.disabled = !hasData;
        });
        const clearButton = $('troubleshooterClear');
        if (clearButton) {
            const phase = data?.diagnosis?.phase || 'idle';
            // Not while a search or pause check runs: those have Stop/Cancel.
            clearButton.disabled = !(hasData || data?.capture?.startedAt || ['found', 'not-found', 'checked'].includes(phase)) ||
                phase === 'bisect' || phase === 'paused';
        }
    }

    function renderFailures(data) {
        const box = $('troubleshooterFailures');
        if (!box) return;
        const failures = data?.capture?.failures || [];
        box.hidden = failures.length === 0;
        if (box.hidden) return;
        const summary = el('summary', '', ts('failures_summary', failures.length, data.linkedFailures));
        const list = el('div', 'troubleshooter-failure-list');
        failures.slice(-20).reverse().forEach(failure => {
            const item = el('div', 'troubleshooter-failure');
            item.appendChild(el('p', '', [failure.reason, failure.requestType].filter(Boolean).join(' · ')));
            item.appendChild(urlBlock(failure.url));
            list.appendChild(item);
        });
        const wasOpen = box.open;
        box.replaceChildren(summary, list);
        box.open = wasOpen;
    }

    function renderTypeFilter(data) {
        const typeFilter = $('troubleshooterTypeFilter');
        if (!typeFilter) return;
        const types = [...new Set((data?.findings || []).map(finding => finding.requestType).filter(Boolean))].sort();
        const selected = typeFilter.value;
        const all = el('option', '', ts('type_all'));
        all.value = 'all';
        typeFilter.replaceChildren(all, ...types.map(type => {
            const option = el('option', '', type);
            option.value = type;
            return option;
        }));
        typeFilter.value = types.includes(selected) ? selected : 'all';
    }

    function groupMatches(group, category, type, query) {
        if (category !== 'all' && group.category !== category) return false;
        if (type !== 'all' && !group.requestTypes.has(type)) return false;
        if (!query) return true;
        const haystack = [group.rule, group.providerName, group.matchedRuleId, ...group.changes,
            ...group.hits.flatMap(hit => [hit.resourceUrl, hit.after])].join('\n').toLowerCase();
        return haystack.includes(query);
    }

    function renderRuleToggle(group, actions, status) {
        const state = group.ruleState;
        const toggleKey = JSON.stringify(group.identity);
        const ruleButton = button('', 'troubleshooter-rule-action');
        ruleButton.dataset.ruleToggleKey = toggleKey;
        const update = (node, enabled) => {
            node.textContent = enabled ? ts('disable_rule') : ts('enable_rule');
            node.classList.toggle('troubleshooter-rule-disable', enabled);
            node.classList.toggle('troubleshooter-rule-enable', !enabled);
            node.setAttribute('aria-label', enabled ? ts('disable_rule_aria', group.rule) : ts('enable_rule_aria', group.rule));
        };
        update(ruleButton, state.enabled);
        ruleButton.addEventListener('click', async () => {
            const requested = !state.enabled;
            ruleButton.disabled = true;
            ruleButton.textContent = ts('saving');
            try {
                const response = await message('setTroubleshooterRuleEnabled', [group.identity, requested]);
                if (!response?.response?.success) throw new Error(response?.response?.error || ts('status_rule_failed'));
                state.enabled = response.response.enabled;
                state.disabled = response.response.disabled;
                document.querySelectorAll('[data-rule-toggle-key]').forEach(node => {
                    if (node.dataset.ruleToggleKey === toggleKey) update(node, state.enabled);
                });
                status.textContent = state.enabled ? ts('status_rule_changed_on') : ts('status_rule_changed_off');
            } catch (error) {
                update(ruleButton, !requested);
                status.textContent = error?.message || ts('status_rule_failed');
            } finally {
                document.querySelectorAll('[data-rule-toggle-key]').forEach(node => {
                    if (node.dataset.ruleToggleKey === toggleKey) node.disabled = false;
                });
            }
        });
        actions.appendChild(ruleButton);
    }

    function renderGroup(group, status) {
        const card = el('article', 'troubleshooter-card');
        card.dataset.groupKey = group.key;
        if (group.failed) card.classList.add('troubleshooter-card-failed');

        const header = el('div', 'troubleshooter-card-header');
        header.appendChild(el('strong', '', group.rule));
        header.appendChild(el('span', 'troubleshooter-badge', ts('hits', group.hits.length)));
        if (group.failed) header.appendChild(el('span', 'troubleshooter-badge troubleshooter-badge-failed', ts('failed_badge', group.failed)));
        card.appendChild(header);

        const categoryLabel = group.category === 'redirects' ? ts('category_redirects')
            : group.category === 'protection' ? ts('category_protection') : ts('category_url_rules');
        const sources = [...group.sources].map(source => source === 'page' ? ts('source_page') : ts('source_observed'));
        card.appendChild(el('p', '', [categoryLabel, group.providerName, ...sources, ...group.requestTypes].filter(Boolean).join(' · ')));

        const displayRuleId = group.ruleState?.ruleId || group.matchedRuleId;
        card.appendChild(el('p', '', displayRuleId ? ts('rule_id', displayRuleId)
            : group.category === 'protection' ? ts('rule_id_protection') : ts('rule_id_missing')));
        if (group.changes.size) card.appendChild(el('p', 'troubleshooter-changes', ts('changes', [...group.changes].join('; '))));

        const details = el('details', 'troubleshooter-hits');
        details.appendChild(el('summary', '', ts('affected_urls', group.hits.length)));
        group.hits.slice(0, MAX_URLS_PER_GROUP).forEach(hit => {
            const item = el('div', 'troubleshooter-hit');
            item.appendChild(urlBlock(hit.resourceUrl));
            if (hit.after && hit.after !== hit.resourceUrl) {
                item.appendChild(el('p', '', ts('after')));
                item.appendChild(urlBlock(hit.after));
            }
            if (hit.failure) item.appendChild(el('p', 'troubleshooter-hit-failed', ts('failed_after', hit.failure.reason)));
            details.appendChild(item);
        });
        if (group.hits.length > MAX_URLS_PER_GROUP) {
            details.appendChild(el('p', '', ts('more_urls', group.hits.length - MAX_URLS_PER_GROUP)));
        }
        // Open by default when there is only one URL, or a failure to show.
        details.open = group.hits.length === 1 || group.failed > 0;
        card.appendChild(details);

        const state = group.ruleState;
        const diagnosis = lastData?.diagnosis || {};
        const searchRunning = diagnosis.phase === 'bisect';
        const inThisRound = searchRunning && state?.runtimeRuleId &&
            (diagnosis.testingRuleIds || []).includes(state.runtimeRuleId);
        card.appendChild(el('p', '', inThisRound ? ts('advice_in_search')
            : searchRunning && state?.available ? ts('advice_search_running')
            : state?.available
                ? (state.enabled ? ts('advice_enabled') : ts('advice_disabled'))
                : group.category === 'protection' ? ts('advice_protection') : ts('advice_review')));

        const actions = el('div', 'troubleshooter-card-actions');
        const first = group.hits[0];
        actions.appendChild(button(ts('report'), '', () => {
            openReport(first.pageUrl, first.resourceUrl, group.rule, group.providerName, summaryForGroup(group))
                .catch(() => { status.textContent = ts('status_report_failed'); });
        }));
        // No switching while the rule search runs: it switches rules itself.
        if (state?.available) {
            if (!searchRunning) renderRuleToggle(group, actions, status);
        } else if (group.category !== 'protection') {
            card.appendChild(el('p', '', ts('rule_unresolved')));
        }
        card.appendChild(actions);
        return card;
    }

    function render() {
        const data = lastData;
        const status = $('troubleshooterStatus');
        const results = $('troubleshooterResults');
        renderHeader(data);
        renderDiagnosis(data);
        renderFailures(data);
        renderTypeFilter(data);
        if (!results) return;
        const fragment = document.createDocumentFragment();
        if (!data) {
            results.replaceChildren();
            return;
        }
        if (data.groups.length === 0) {
            fragment.appendChild(el('p', 'troubleshooter-empty', data.isWebPage ? ts('empty_web') : ts('empty_not_web')));
        } else {
            const category = $('troubleshooterCategoryFilter')?.value || 'all';
            const type = $('troubleshooterTypeFilter')?.value || 'all';
            const query = ($('troubleshooterSearch')?.value || '').trim().toLowerCase();
            const visible = data.groups.filter(group => groupMatches(group, category, type, query));
            if (visible.length === 0) {
                fragment.appendChild(el('p', 'troubleshooter-empty', ts('empty_filtered')));
            }
            visible.slice(0, MAX_GROUPS).forEach(group => fragment.appendChild(renderGroup(group, status)));
            if (visible.length > MAX_GROUPS) fragment.appendChild(el('p', 'troubleshooter-empty', ts('showing_first', MAX_GROUPS)));
        }
        // Keep open URL lists open across an auto-refresh.
        const openKeys = new Set([...results.querySelectorAll('.troubleshooter-card')]
            .filter(card => card.querySelector('details')?.open)
            .map(card => card.dataset.groupKey));
        fragment.querySelectorAll('.troubleshooter-card').forEach(card => {
            if (openKeys.has(card.dataset.groupKey)) card.querySelector('details').open = true;
        });
        results.replaceChildren(fragment);
    }

    // ── Diagnosis: pause check and rule search ───────────────────────────

    function bisectCandidates(data) {
        const seen = new Set();
        return (data?.groups || []).filter(group => {
            if (!group.identity || !group.ruleState?.available || !group.ruleState.enabled) return false;
            const key = group.ruleState.runtimeRuleId || group.ruleState.toggleId || JSON.stringify(group.identity);
            if (seen.has(key)) return false;
            seen.add(key);
            return true;
        });
    }

    // Candidates the search can test; empty when the background says none.
    function findableCandidates(data) {
        const candidates = bisectCandidates(data);
        return data?.bisectCount === 0 ? [] : candidates;
    }

    function findCount(data, candidates) {
        return Number.isInteger(data?.bisectCount) ? data.bisectCount : candidates.length;
    }

    async function runDiagnosisStep(functionName, params, reloadAfter) {
        const status = $('troubleshooterStatus');
        const box = $('troubleshooterDiagnosis');
        box?.querySelectorAll('button').forEach(node => { node.disabled = true; });
        // Show at once that the click registered; the step can take a moment.
        if (lastClickedButton && box?.contains(lastClickedButton)) lastClickedButton.textContent = ts('working');
        try {
            const tab = await getActiveTab();
            if (!tab) throw new Error(ts('status_no_tab'));
            const response = await message(functionName, [tab.id, ...params]);
            if (!response?.response?.success) throw new Error(response?.response?.error || response?.error || 'unknown error');
            const diagnosis = response.response.diagnosis;
            if (reloadAfter === true || (typeof reloadAfter === 'function' && reloadAfter(diagnosis))) {
                await browser.tabs.reload(tab.id);
            }
            await refresh({ quiet: true });
        } catch (error) {
            if (status) {
                status.textContent = error?.outdatedBackground
                    ? error.message
                    : ts('diag_failed', error?.message || '');
            }
            box?.querySelectorAll('button').forEach(node => { node.disabled = false; });
        }
    }

    function diagnosisBox(title, text, buttons, tone, extra = null) {
        const box = $('troubleshooterDiagnosis');
        if (!box) return;
        box.className = `troubleshooter-diagnosis${tone ? ` troubleshooter-diagnosis-${tone}` : ''}`;
        const row = el('div', 'troubleshooter-diagnosis-actions');
        buttons.forEach(node => row.appendChild(node));
        box.replaceChildren(...[el('strong', '', title), el('p', '', text), extra, row].filter(Boolean));
        box.hidden = false;
    }

    // The rules a round switched off, by name.
    function testingRulesList(rules) {
        if (!Array.isArray(rules) || rules.length === 0) return null;
        const shown = 8;
        const wrap = el('div', 'troubleshooter-testing');
        wrap.appendChild(el('p', 'troubleshooter-testing-label', ts('diag_testing_rules')));
        const list = el('ul', 'troubleshooter-testing-list');
        rules.slice(0, shown).forEach(rule => {
            const item = el('li');
            item.appendChild(el('code', '', rule.label));
            if (rule.providerName) item.appendChild(el('span', '', ` (${rule.providerName})`));
            list.appendChild(item);
        });
        wrap.appendChild(list);
        if (rules.length > shown) wrap.appendChild(el('p', 'troubleshooter-testing-label', ts('diag_testing_more', rules.length - shown)));
        return wrap;
    }

    function renderDiagnosis(data) {
        const box = $('troubleshooterDiagnosis');
        if (!box) return;
        if (!data || !data.isWebPage) {
            box.hidden = true;
            return;
        }
        const diagnosis = data.diagnosis || { phase: 'idle' };
        const host = (() => {
            try { return new URL(data.tab.url).hostname; } catch (_) { return ''; }
        })();
        const reloadIfRunning = next => next?.phase === 'bisect';
        const cancel = button(ts('diag_cancel'), 'troubleshooter-back',
            () => runDiagnosisStep('cancelTroubleshooterDiagnosis', [], true));
        const done = button(ts('diag_done'), 'troubleshooter-back',
            () => runDiagnosisStep('cancelTroubleshooterDiagnosis', [], false));

        switch (diagnosis.phase) {
        case 'outdated':
            diagnosisBox(ts('diag_outdated_title'), ts('diag_outdated_text'), [], 'warning');
            return;
        case 'paused':
            diagnosisBox(ts('diag_paused_title', diagnosis.domain || host), ts('diag_paused_text'), [
                button(ts('diag_yes_works'), 'troubleshooter-primary',
                    // Reload with cleaning back on, so the rules that run get recorded.
                    () => runDiagnosisStep('answerTroubleshooterPauseCheck', [true], true)),
                button(ts('diag_no_broken'), '',
                    () => runDiagnosisStep('answerTroubleshooterPauseCheck', [false], true)),
                cancel
            ], 'active');
            return;
        case 'checked':
            if (diagnosis.verdict === 'linkumori') {
                const candidates = findableCandidates(data);
                const buttons = [];
                if (candidates.length) {
                    buttons.push(button(ts('diag_find_button', findCount(data, candidates)), 'troubleshooter-primary',
                        () => runDiagnosisStep('startTroubleshooterBisect', [candidates.map(group => group.identity)], reloadIfRunning)));
                }
                buttons.push(done);
                diagnosisBox(ts('diag_linkumori_title'),
                    candidates.length ? ts('diag_linkumori_text') : ts('diag_linkumori_no_rules'), buttons, 'warning');
            } else {
                diagnosisBox(ts('diag_not_linkumori_title'), ts('diag_not_linkumori_text'), [done], 'ok');
            }
            return;
        case 'bisect':
            diagnosisBox(ts('diag_bisect_title', diagnosis.round, Math.max(diagnosis.round, diagnosis.round + diagnosis.roundsLeft - 1)),
                diagnosis.testing === 1
                    ? ts('diag_bisect_text_one', diagnosis.suspects)
                    : ts('diag_bisect_text', diagnosis.testing, diagnosis.suspects), [
                    button(ts('diag_yes_fixed'), 'troubleshooter-primary',
                        () => runDiagnosisStep('answerTroubleshooterBisect', [true], true)),
                    button(ts('diag_no_still'), '',
                        () => runDiagnosisStep('answerTroubleshooterBisect', [false], true)),
                    // Skip: these rules go back on and leave the search; it carries on.
                    button(ts('diag_skip_round'), '', async () => {
                        await runDiagnosisStep('answerTroubleshooterBisect', [false, true], true);
                        $('troubleshooterStatus').textContent = ts('diag_skipped_round');
                    }),
                    // Stop: end the search, every rule back on.
                    button(ts('diag_stop_search'), 'troubleshooter-back', async () => {
                        await runDiagnosisStep('cancelTroubleshooterDiagnosis', [], true);
                        $('troubleshooterStatus').textContent = ts('diag_skipped');
                    })
                ], 'active', testingRulesList(diagnosis.testingRules));
            return;
        case 'found': {
            const culprit = diagnosis.culprit || {};
            const label = culprit.label || culprit.ruleId || '';
            const provider = culprit.providerName ? ts('diag_found_provider', culprit.providerName) : '';
            const setCulprit = (enabled, doneText) => async event => {
                const node = event.currentTarget;
                node.disabled = true;
                try {
                    const response = await message('setTroubleshooterRuleEnabled', [culprit.identity, enabled]);
                    if (!response?.response?.success) throw new Error(response?.response?.error || '');
                    await refresh({ quiet: true });
                    $('troubleshooterStatus').textContent = doneText;
                } catch (error) {
                    $('troubleshooterStatus').textContent = error?.message || ts('status_rule_failed');
                    node.disabled = false;
                }
            };
            const report = button(ts('diag_report_culprit'), '', () => {
                openReport(data.tab.url, '', label, culprit.providerName || '',
                    `Troubleshooter: the page works with cleaning paused, and the rule search points to rule ${label}${culprit.providerName ? ` (${culprit.providerName})` : ''}.`)
                    .catch(() => { $('troubleshooterStatus').textContent = ts('status_report_failed'); });
            });
            if (diagnosis.culpritState?.available && diagnosis.culpritState.enabled === false) {
                // Already switched off: offer the next step instead of the same button again.
                const reload = button(ts('diag_reload_tab'), 'troubleshooter-primary', async () => {
                    try {
                        await browser.tabs.reload(data.tab.id);
                    } catch (_) {
                        // The tab may have closed.
                    }
                });
                reload.className = 'troubleshooter-back';
                // Keep it off: accept the fix and end the search.
                const keepOff = button(ts('diag_keep_off'), 'troubleshooter-primary', async () => {
                    await runDiagnosisStep('cancelTroubleshooterDiagnosis', [], false);
                    $('troubleshooterStatus').textContent = ts('diag_kept_off', label);
                });
                // Skip: turn the rule back on, end the search, and reload.
                const skip = button(ts('diag_skip_found'), '', async event => {
                    const node = event.currentTarget;
                    node.disabled = true;
                    try {
                        const response = await message('setTroubleshooterRuleEnabled', [culprit.identity, true]);
                        if (!response?.response?.success) throw new Error(response?.response?.error || '');
                    } catch (error) {
                        $('troubleshooterStatus').textContent = error?.message || ts('status_rule_failed');
                        node.disabled = false;
                        return;
                    }
                    await runDiagnosisStep('cancelTroubleshooterDiagnosis', [], true);
                    $('troubleshooterStatus').textContent = ts('diag_skipped');
                });
                diagnosisBox(ts('diag_off_title'), ts('diag_off_text', label, provider), [
                    keepOff,
                    skip,
                    reload,
                    report,
                    button(ts('clear'), 'troubleshooter-back', () => clearTroubleshooter(label))
                ], 'ok');
                return;
            }
            diagnosisBox(ts('diag_found_title'), ts('diag_found_text', label, provider), [
                button(ts('diag_disable_culprit'), 'troubleshooter-rule-action troubleshooter-rule-disable',
                    setCulprit(false, ts('diag_culprit_disabled'))),
                report,
                done,
                button(ts('clear'), 'troubleshooter-back', () => clearTroubleshooter())
            ], 'warning');
            return;
        }
        case 'not-found':
            diagnosisBox(ts('diag_not_found_title'),
                diagnosis.skipped ? ts('diag_not_found_skipped', diagnosis.skipped) : ts('diag_not_found_text'), [done], 'ok');
            return;
        default: {
            // The rule search needs a recording to know which rules run;
            // start one if needed (a running recording is kept).
            const ensureRecording = async () => {
                if (data.capture?.active) return true;
                try {
                    const response = await message('startTabTroubleshooterCapture', [data.tab.id]);
                    if (!response?.response?.success) throw new Error(response?.response?.error || ts('status_start_failed'));
                    return true;
                } catch (error) {
                    $('troubleshooterStatus').textContent = error?.message || ts('status_start_failed');
                    return false;
                }
            };
            // Clear the old recording of this tab and record it again from a
            // reload, so the search only sees rules from the current page load.
            const recordFresh = async event => {
                const node = event.currentTarget;
                node.disabled = true;
                try {
                    const response = await message('startTabTroubleshooterCapture', [data.tab.id]);
                    if (!response?.response?.success) throw new Error(response?.response?.error || ts('status_start_failed'));
                } catch (error) {
                    $('troubleshooterStatus').textContent = error?.message || ts('status_start_failed');
                    node.disabled = false;
                    return;
                }
                traceCache = null;
                try {
                    await browser.tabs.reload(data.tab.id);
                } catch (_) {
                    // The tab may have closed.
                }
                await refresh({ quiet: true });
                $('troubleshooterStatus').textContent = ts('diag_recorded_fresh');
            };
            const candidates = findableCandidates(data);
            const find = candidates.length
                ? button(ts('diag_find_button', findCount(data, candidates)), 'troubleshooter-primary',
                    () => runDiagnosisStep('startTroubleshooterBisect', [candidates.map(group => group.identity)], reloadIfRunning))
                : button(ts('diag_find_record'), 'troubleshooter-primary', recordFresh);
            const recordAgain = candidates.length ? button(ts('diag_record_again'), '', recordFresh) : null;
            const pauseFirst = button(ts('diag_idle_button'), '', async () => {
                if (await ensureRecording()) await runDiagnosisStep('startTroubleshooterPauseCheck', [host], true);
            });
            const recordingWithoutRules = !candidates.length && data.capture?.active;
            if (recordingWithoutRules) find.disabled = true;
            diagnosisBox(ts('diag_idle_title'),
                recordingWithoutRules ? ts('diag_idle_recording') : ts('diag_idle_text'), [find, recordAgain, pauseFirst].filter(Boolean));
        }
        }
    }

    // Forget this tab's recording, findings and finished search. Rules are
    // left as they are; keptOffLabel names a rule the person kept off.
    async function clearTroubleshooter(keptOffLabel = '') {
        const status = $('troubleshooterStatus');
        try {
            const tab = await getActiveTab();
            if (!tab) throw new Error(ts('status_no_tab'));
            const phase = lastData?.diagnosis?.phase;
            // A running search or pause check is ended properly (rules back on).
            if (phase && phase !== 'idle') await message('cancelTroubleshooterDiagnosis', [tab.id]).catch(() => null);
            await message('clearTabTroubleshooterCapture', [tab.id]);
            traceCache = null;
            stopTimer();
            const results = $('troubleshooterResults');
            if (results) results.replaceChildren();
            await refresh({ quiet: true });
            status.textContent = keptOffLabel ? ts('status_cleared_off', keptOffLabel) : ts('status_cleared');
        } catch (error) {
            status.textContent = error?.message || ts('status_read_failed');
        }
    }

    // ── Report, copy, export ─────────────────────────────────────────────

    function summaryForGroup(group) {
        const lines = [`Troubleshooter: rule ${group.rule}${group.providerName ? ` (${group.providerName})` : ''}, ${group.hits.length} hit(s) on this page.`];
        if (group.changes.size) lines.push(`What changed: ${[...group.changes].join('; ')}`);
        if (group.failed) lines.push(`${group.failed} request(s) failed right after this rule changed the URL.`);
        return lines.join('\n');
    }

    function openReport(pageUrl, resourceUrl, rule, providerName, context) {
        const reportUrl = new URL(browser.runtime.getURL('html/report.html'));
        if (pageUrl) reportUrl.searchParams.set('url', pageUrl);
        if (resourceUrl) reportUrl.searchParams.set('affectedUrl', resourceUrl);
        if (rule) reportUrl.searchParams.set('affectedRule', rule);
        if (providerName) reportUrl.searchParams.set('affectedProvider', providerName);
        if (context) reportUrl.searchParams.set('troubleshooterContext', String(context).slice(0, 1500));
        return browser.tabs.create({ url: reportUrl.toString() });
    }

    function buildTextSummary(data) {
        const lines = [`Linkumori troubleshooter — ${data.tab.url}`];
        if (data.capture.startedAt) {
            lines.push(`Recording: ${new Date(data.capture.startedAt).toISOString()}${data.capture.active ? ' (active)' : ''}, ${data.capture.entries.length} URL change(s), ${data.capture.failures.length} failed request(s).`);
        }
        const diagnosis = data.diagnosis || {};
        if (diagnosis.verdict === 'linkumori') lines.push('Pause check: the page works with cleaning paused.');
        if (diagnosis.verdict === 'not-linkumori') lines.push('Pause check: the page is still broken with cleaning paused.');
        if (diagnosis.phase === 'found' && diagnosis.culprit) lines.push(`Rule search: ${diagnosis.culprit.label || diagnosis.culprit.ruleId}${diagnosis.culprit.providerName ? ` (${diagnosis.culprit.providerName})` : ''}.`);
        lines.push('');
        data.groups.forEach(group => {
            lines.push(`- ${group.rule}${group.providerName ? ` [${group.providerName}]` : ''}: ${group.hits.length} hit(s)${group.failed ? `, ${group.failed} failed` : ''}${group.changes.size ? ` — ${[...group.changes].join('; ')}` : ''}`);
        });
        return lines.join('\n');
    }

    async function copySummary() {
        const status = $('troubleshooterStatus');
        if (!lastData) return;
        try {
            await navigator.clipboard.writeText(buildTextSummary(lastData));
            status.textContent = ts('status_copied');
        } catch (_) {
            status.textContent = ts('status_copy_failed');
        }
    }

    async function exportRecording() {
        const status = $('troubleshooterStatus');
        if (!lastData) return;
        try {
            const data = lastData;
            const payload = {
                format: 'linkumori-troubleshooter',
                version: 1,
                exportedAt: new Date().toISOString(),
                extensionVersion: browser.runtime.getManifest?.().version || '',
                pageUrl: data.tab.url,
                recording: {
                    active: !!data.capture.active,
                    startedAt: data.capture.startedAt || null,
                    endedAt: data.capture.endedAt || null
                },
                diagnosis: data.diagnosis,
                rules: data.groups.map(group => ({
                    rule: group.rule,
                    ruleId: group.ruleState?.ruleId || group.matchedRuleId || null,
                    provider: group.providerName,
                    category: group.category,
                    requestTypes: [...group.requestTypes],
                    changes: [...group.changes],
                    failed: group.failed,
                    hits: group.hits.map(hit => ({
                        before: hit.resourceUrl,
                        after: hit.after,
                        requestType: hit.requestType,
                        source: hit.source,
                        failure: hit.failure ? hit.failure.reason : null
                    }))
                })),
                failedRequests: data.capture.failures
            };
            const blob = new Blob([JSON.stringify(payload, null, 2)], { type: 'application/json' });
            const url = URL.createObjectURL(blob);
            let host = 'page';
            try { host = new URL(data.tab.url).hostname || host; } catch (_) {}
            const stamp = new Date().toISOString().replace(/[:.]/g, '-');
            const filename = `linkumori-troubleshooter-${host}-${stamp}.json`.replace(/[^a-z0-9._-]/gi, '_');
            if (browser.downloads?.download) {
                await browser.downloads.download({ url, filename, saveAs: true });
                setTimeout(() => URL.revokeObjectURL(url), 60000);
            } else {
                const link = el('a');
                link.href = url;
                link.download = filename;
                link.click();
                setTimeout(() => URL.revokeObjectURL(url), 60000);
            }
            status.textContent = ts('status_exported');
        } catch (_) {
            status.textContent = ts('status_export_failed');
        }
    }

    // ── Panel wiring ─────────────────────────────────────────────────────

    const panel = $('troubleshooterPanel');
    const mainContent = $('mainContent');
    const navBar = $('popupNavBar');
    const openButton = $('openTroubleshooter');
    const backButton = $('troubleshooterBack');

    function openPanel(focusBack = true) {
        if (!panel || !mainContent) return;
        mainContent.style.display = 'none';
        const license = $('licenseContent');
        if (license) license.style.display = 'none';
        if (navBar) navBar.style.display = 'none';
        panel.hidden = false;
        if (focusBack) backButton?.focus();
        refresh();
    }

    function closePanel() {
        if (!panel || !mainContent) return;
        panel.hidden = true;
        stopTimer();
        if (navBar) navBar.style.display = '';
        mainContent.style.display = '';
        const license = $('licenseContent');
        if (license) license.style.display = 'none';
        openButton?.focus();
    }

    applyStaticText();
    // Translations load asynchronously; apply them again once ready.
    if (typeof waitForPopupI18n === 'function') {
        Promise.resolve(waitForPopupI18n()).then(() => {
            applyStaticText();
            if (panel && !panel.hidden && lastData) render();
        }).catch(() => {});
    }

    openButton?.addEventListener('click', () => openPanel());
    backButton?.addEventListener('click', closePanel);
    $('troubleshooterRefresh')?.addEventListener('click', () => refresh({ fresh: true }));
    $('troubleshooterCopy')?.addEventListener('click', copySummary);
    $('troubleshooterExport')?.addEventListener('click', exportRecording);
    $('troubleshooterClear')?.addEventListener('click', () => clearTroubleshooter());
    $('troubleshooterCategoryFilter')?.addEventListener('change', render);
    $('troubleshooterTypeFilter')?.addEventListener('change', render);
    $('troubleshooterSearch')?.addEventListener('input', () => {
        clearTimeout(searchDebounce);
        searchDebounce = setTimeout(render, 150);
    });

    const scanButton = $('troubleshooterScan');
    scanButton?.addEventListener('click', async () => {
        const status = $('troubleshooterStatus');
        if (scanButton.disabled) return;
        scanButton.disabled = true;
        scanButton.textContent = ts('starting');
        let started = false;
        try {
            const tab = await getActiveTab();
            if (!tab || !isWebUrl(tab.url)) {
                status.textContent = ts('status_need_web');
                return;
            }
            const response = await message('startTabTroubleshooterCapture', [tab.id]);
            if (!response?.response?.success) throw new Error(response?.response?.error || ts('status_start_failed'));
            started = true;
            await browser.tabs.reload(tab.id);
            await refresh({ quiet: true });
            status.textContent = ts('status_started');
        } catch (error) {
            status.textContent = error?.message || ts('status_start_failed');
            if (started) refresh({ quiet: true });
        } finally {
            if (!started) {
                scanButton.disabled = false;
                scanButton.textContent = ts('start');
            }
        }
    });

    const stopButton = $('troubleshooterStop');
    stopButton?.addEventListener('click', async () => {
        const status = $('troubleshooterStatus');
        if (stopButton.disabled) return;
        stopButton.disabled = true;
        try {
            const tab = await getActiveTab();
            if (!tab) throw new Error('No active tab');
            const response = await message('stopTabTroubleshooterCapture', [tab.id]);
            if (!response?.response?.success) throw new Error('Could not stop recording');
            stopTimer();
            await refresh({ quiet: true });
            status.textContent = response.response.storedInSession
                ? ts('status_stopped_saved', response.response.entries)
                : ts('status_stopped_unsaved', response.response.entries);
        } catch (_) {
            status.textContent = ts('status_stop_failed');
            stopButton.disabled = false;
        }
    });

    // Reopen where the person left off: straight into the troubleshooter
    // while a recording or a check is running for this tab.
    (async () => {
        try {
            const tab = await getActiveTab();
            if (!tab || !panel || !panel.hidden) return;
            const [capture, diagnosis] = await Promise.all([
                message('getTabTroubleshooterCapture', [tab.id]).catch(() => null),
                message('getTroubleshooterDiagnosis', [tab.id]).catch(() => null)
            ]);
            const recording = !!capture?.response?.active;
            const phase = diagnosis?.response?.phase || 'idle';
            if (recording || phase !== 'idle') openPanel(false);
        } catch (_) {
            // Stay on the main view.
        }
    })();
}());
