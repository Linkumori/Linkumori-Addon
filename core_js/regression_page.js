/*
 * ============================================================
 * Linkumori — regression page
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
 * Added regression page.
 *
 * ============================================================
 * MODIFICATION HISTORY
 * ============================================================
 * 2026-05-15   Subham Mahesh   File created
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
(async function () {
    'use strict';

    const status = document.getElementById('status');
    const summary = document.getElementById('summary');
    const resultsEl = document.getElementById('results');
    const runButton = document.getElementById('run');
    const exportButton = document.getElementById('export');
    let suite = null;
    let latestReport = null;

    const ciMode = new URLSearchParams(window.location.search).get('ci') === '1';

    await LinkumoriI18n.ready();
    const t = (key, substitutions = []) => LinkumoriI18n.getMessage(key, substitutions);
    document.title = t('regression_page_title');
    document.getElementById('page-title').textContent = t('regression_page_title');
    document.getElementById('page-heading').textContent = t('regression_heading');
    runButton.textContent = t('regression_run_again');
    exportButton.textContent = t('regression_export_results');
    status.textContent = t('regression_loading_suite');

    const call = (fn, params = []) => browser.runtime.sendMessage({ function: fn, params });
    const setData = (key, value) => call('setData', [key, value]);
    const getData = async key => (await call('getData', [key])).response;

    const sleep = ms => new Promise(resolve => setTimeout(resolve, ms));

    async function applyRulesForCase(testCase) {
        const response = await call('applyRegressionRuleData', [{
            providers: testCase.providers || suite.providers || {},
            urlFilterRules: testCase.urlFilterRules || suite.urlFilterRules || []
        }]);
        if (response && response.error) {
            throw new Error(response.error);
        }
        await sleep(75);
        return response && response.response;
    }

    function isBlockedNavigation(url) {
        if (typeof url !== 'string') return false;
        try {
            const parsed = new URL(url);
            return parsed.pathname.endsWith('/html/siteBlockedAlert.html')
                && parsed.searchParams.has('source');
        } catch (_) {
            return false;
        }
    }

    function waitForTab(tabId, expectedBlocked = false) {
        return new Promise(resolve => {
            let finished = false;
            const timer = setTimeout(() => finish('timeout'), 10000);
            const readCurrentUrl = async () => {
                try {
                    return (await browser.tabs.get(tabId)).url || null;
                } catch (_) {
                    return null;
                }
            };
            const finish = async statusValue => {
                if (finished) return;
                finished = true;
                clearTimeout(timer);
                browser.tabs.onUpdated.removeListener(onUpdated);
                resolve({ status: statusValue, url: await readCurrentUrl() });
            };
            const maybeFinish = async statusValue => {
                const currentUrl = await readCurrentUrl();
                if (!currentUrl || currentUrl === 'about:blank') return;
                if (expectedBlocked && !isBlockedNavigation(currentUrl)) return;
                setTimeout(() => finish(statusValue), expectedBlocked ? 150 : 0);
            };
            const onUpdated = (id, info) => {
                if (id !== tabId) return;
                if (info.url && expectedBlocked && isBlockedNavigation(info.url)) {
                    maybeFinish('complete');
                    return;
                }
                if (info.status === 'complete') maybeFinish('complete');
            };
            browser.tabs.onUpdated.addListener(onUpdated);
        });
    }

    async function visit(url, expectedBlocked = false) {
        let tab = null;
        try {
            tab = await browser.tabs.create({ active: false, url: 'about:blank' });
            const loaded = waitForTab(tab.id, expectedBlocked);
            await browser.tabs.update(tab.id, { url });
            return await loaded;
        } catch (_) {
            return { status: 'failed', url: null };
        } finally {
            if (tab && tab.id) {
                try { await browser.tabs.remove(tab.id); } catch (_) {}
            }
        }
    }

    function updateSummary(results, total) {
        const passed = results.filter(result => result.classification === 'pass').length;
        const failed = results.filter(result => result.classification === 'fail').length;
        const skipped = results.filter(result => result.classification === 'skipped_preference').length;
        summary.textContent = t('regression_summary', [results.length, total, passed, failed, skipped]);
    }

    function evaluatePreferences(testCase, extensionSettings) {
        const requirements = testCase.preferences && typeof testCase.preferences === 'object'
            ? testCase.preferences
            : {};
        const mismatches = Object.entries(requirements).filter(([key, expected]) => {
            return extensionSettings[key] !== expected;
        }).map(([key, expected]) => ({
            key,
            expected,
            actual: extensionSettings[key]
        }));
        return { requirements, mismatches };
    }

    function appendResult(result) {
        const row = document.createElement('article');
        const label = result.classification === 'skipped_preference'
            ? 'SKIP'
            : (result.passed ? 'PASS' : 'FAIL');
        row.className = `regression-result ${result.classification === 'fail' ? 'fail' : 'pass'}`;
        const labelEl = document.createElement('strong');
        labelEl.textContent = label;
        row.appendChild(labelEl);
        row.appendChild(document.createTextNode(` — ${result.loadStatus} — ${result.dialect} — ${result.id}`));
        if (result.classification === 'skipped_preference') {
            const note = document.createElement('div');
            note.className = 'regression-urls';
            note.textContent = result.preferenceMismatches
                .map(item => t('regression_preference_mismatch', [item.key, item.expected, item.actual]))
                .join('\n');
            row.appendChild(note);
        }
        if (result.classification === 'fail') {
            const urls = document.createElement('div');
            urls.className = 'regression-urls';
            urls.textContent = result.expectedBlocked
                ? `${t('regression_expected_label')}: blocked page\n${t('regression_actual_label')}:   ${result.actualNavigation || result.actualOutput}`
                : `${t('regression_expected_label')}: ${result.expectedOutput}\n${t('regression_actual_label')}:   ${result.actualOutput}`;
            row.appendChild(urls);
        }
        resultsEl.appendChild(row);
    }

    async function exportResults() {
        if (!latestReport) return;
        const blob = new Blob([JSON.stringify(latestReport, null, 2)], { type: 'application/json' });
        await browser.downloads.download({
            url: URL.createObjectURL(blob),
            filename: `Linkumori-Regression-${new Date().toISOString().slice(0, 19).replace(/:/g, '-')}.json`,
            saveAs: true
        });
    }

    async function run() {
        if (!suite) return;
        const startedAt = new Date().toISOString();
        runButton.disabled = true;
        exportButton.disabled = true;
        latestReport = null;
        resultsEl.innerHTML = '';
        updateSummary([], suite.cases.length);

        let extensionSettings = {};
        const snapshot = {};
        const results = [];
        try {
            const exportedSettingsResponse = await call('storageAsJSON');
            extensionSettings = exportedSettingsResponse && exportedSettingsResponse.response
                ? { ...exportedSettingsResponse.response }
                : {};
            delete extensionSettings.ClearURLsData;
            snapshot.builtInRulesEnabled = await getData('builtInRulesEnabled');
            snapshot.remoteRulesEnabled = await getData('remoteRulesEnabled');
            snapshot.referralMarketing = await getData('referralMarketing');
            snapshot.clearURLsData = await getData('ClearURLsData');
            await call('start');
            await setData('builtInRulesEnabled', false);
            await setData('remoteRulesEnabled', false);
            await setData('referralMarketing', false);

            for (let index = 0; index < suite.cases.length; index++) {
                const testCase = suite.cases[index];
                status.textContent = `${t('regression_running')} ${index + 1} / ${suite.cases.length}: ${testCase.id}`;
                await applyRulesForCase(testCase);
                const skipNav = ciMode && testCase.expectedBlocked !== true;
                const visitResult = skipNav ? { status: 'skipped', url: null } : await visit(testCase.input, testCase.expectedBlocked === true);
                const loadStatus = visitResult.status;
                const fn = testCase.dialect === 'urlFilter' ? 'traceLinkumoriURLFilterRuleTest' : 'runRuleTestLab';
                const params = testCase.dialect === 'urlFilter'
                    ? [testCase.input, testCase.request || {}]
                    : [testCase.input, '', testCase.request || {}];
                const response = await call(fn, params);
                const output = response.response || {};
                const actualOutput = output.output || output.after || testCase.input;
                const actualNavigation = visitResult.url;
                const preferenceState = evaluatePreferences(testCase, extensionSettings);
                const behaviorPassed = testCase.expectedBlocked === true
                    ? isBlockedNavigation(actualNavigation)
                    : actualOutput === testCase.expectedOutput;
                const classification = preferenceState.mismatches.length > 0
                    ? 'skipped_preference'
                    : (behaviorPassed ? 'pass' : 'fail');
                const result = {
                    id: testCase.id,
                    dialect: testCase.dialect,
                    loadStatus,
                    expectedOutput: testCase.expectedOutput,
                    actualOutput,
                    expectedBlocked: testCase.expectedBlocked === true,
                    actualNavigation,
                    passed: classification !== 'fail',
                    behaviorPassed,
                    classification,
                    preferenceRequirements: preferenceState.requirements,
                    preferenceMismatches: preferenceState.mismatches
                };
                results.push(result);
                latestReport = {
                    startedAt,
                    finishedAt: null,
                    extensionSettings,
                    total: suite.cases.length,
                    executed: results.length,
                    passed: results.filter(entry => entry.classification === 'pass').length,
                    failed: results.filter(entry => entry.classification === 'fail').length,
                    skippedByPreference: results.filter(entry => entry.classification === 'skipped_preference').length,
                    results: results.slice()
                };
                exportButton.disabled = false;
                appendResult(result);
                updateSummary(results, suite.cases.length);
                const statusLabel = result.classification === 'skipped_preference'
                    ? 'SKIP'
                    : (result.passed ? 'PASS' : 'FAIL');
                status.textContent = `${statusLabel} ${index + 1} / ${suite.cases.length}: ${testCase.id}`;
                await sleep(25);
            }
            latestReport = {
                startedAt,
                finishedAt: new Date().toISOString(),
                extensionSettings,
                total: suite.cases.length,
                executed: results.length,
                passed: results.filter(entry => entry.classification === 'pass').length,
                failed: results.filter(entry => entry.classification === 'fail').length,
                skippedByPreference: results.filter(entry => entry.classification === 'skipped_preference').length,
                results
            };
            window.linkumoriRegressionReport = latestReport;
            exportButton.disabled = false;
            status.textContent = t('regression_finished');
        } catch (error) {
            status.textContent = `${t('regression_run_failed')}: ${error && error.message ? error.message : String(error)}`;
        } finally {
            const restoreOps = [];
            if ('builtInRulesEnabled' in snapshot) restoreOps.push(setData('builtInRulesEnabled', snapshot.builtInRulesEnabled));
            if ('remoteRulesEnabled' in snapshot) restoreOps.push(setData('remoteRulesEnabled', snapshot.remoteRulesEnabled));
            if ('referralMarketing' in snapshot) restoreOps.push(setData('referralMarketing', snapshot.referralMarketing));
            if ('clearURLsData' in snapshot) restoreOps.push(call('applyRegressionRuleData', [snapshot.clearURLsData]));
            await Promise.allSettled(restoreOps);
            runButton.disabled = false;
        }
    }

    suite = (await call('getPendingRegressionSuite')).response || null;
    if (!suite || !Array.isArray(suite.cases)) {
        status.textContent = t('regression_no_suite');
        runButton.disabled = true;
        return;
    }
    runButton.addEventListener('click', run);
    exportButton.addEventListener('click', exportResults);
    run();
})();
