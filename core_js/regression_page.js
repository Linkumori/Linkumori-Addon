(async function () {
    'use strict';

    const status = document.getElementById('status');
    const summary = document.getElementById('summary');
    const resultsEl = document.getElementById('results');
    const runButton = document.getElementById('run');
    const exportButton = document.getElementById('export');
    let suite = null;
    let latestReport = null;

    const call = (fn, params = []) => browser.runtime.sendMessage({ function: fn, params });
    const setData = (key, value) => call('setData', [key, value]);
    const getData = async key => (await call('getData', [key])).response;

    function waitForTab(tabId) {
        return new Promise(resolve => {
            const timer = setTimeout(() => finish('timeout'), 10000);
            const finish = value => {
                clearTimeout(timer);
                browser.tabs.onUpdated.removeListener(onUpdated);
                resolve(value);
            };
            const onUpdated = (id, info) => {
                if (id === tabId && info.status === 'complete') finish('complete');
            };
            browser.tabs.onUpdated.addListener(onUpdated);
        });
    }

    async function visit(url) {
        let tab = null;
        try {
            tab = await browser.tabs.create({ active: false, url: 'about:blank' });
            const loaded = waitForTab(tab.id);
            await browser.tabs.update(tab.id, { url });
            return await loaded;
        } catch (_) {
            return 'failed';
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
        summary.textContent = `Executed ${results.length} of ${total}. Passed: ${passed}. Failed: ${failed}. Skipped by preference: ${skipped}.`;
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
        row.innerHTML = `<strong>${label}</strong> — ${result.loadStatus} — ${result.dialect} — ${result.id}`;
        if (result.classification === 'skipped_preference') {
            const note = document.createElement('div');
            note.className = 'regression-urls';
            note.textContent = result.preferenceMismatches.map(item => `${item.key}: expected ${item.expected}, actual ${item.actual}`).join('\n');
            row.appendChild(note);
        }
        if (result.classification === 'fail') {
            const urls = document.createElement('div');
            urls.className = 'regression-urls';
            urls.textContent = `expected: ${result.expectedOutput}\nactual:   ${result.actualOutput}`;
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

        const exportedSettingsResponse = await call('storageAsJSON');
        const extensionSettings = exportedSettingsResponse && exportedSettingsResponse.response
            ? { ...exportedSettingsResponse.response }
            : {};
        delete extensionSettings.ClearURLsData;
        const snapshot = {
            builtInRulesEnabled: await getData('builtInRulesEnabled'),
            remoteRulesEnabled: await getData('remoteRulesEnabled'),
            referralMarketing: await getData('referralMarketing'),
            clearURLsData: await getData('ClearURLsData')
        };
        const results = [];
        try {
            await call('start');
            await setData('builtInRulesEnabled', false);
            await setData('remoteRulesEnabled', false);
            await setData('referralMarketing', false);

            for (let index = 0; index < suite.cases.length; index++) {
                const testCase = suite.cases[index];
                status.textContent = `Running ${index + 1} / ${suite.cases.length}: ${testCase.id}`;
                await call('applyRegressionRuleData', [{
                    providers: testCase.providers || suite.providers || {},
                    urlFilterRules: testCase.urlFilterRules || suite.urlFilterRules || []
                }]);
                const loadStatus = await visit(testCase.input);
                const fn = testCase.dialect === 'urlFilter' ? 'traceLinkumoriURLFilterRuleTest' : 'runRuleTestLab';
                const params = testCase.dialect === 'urlFilter'
                    ? [testCase.input, testCase.request || {}]
                    : [testCase.input, '', testCase.request || {}];
                const response = await call(fn, params);
                const output = response.response || {};
                const actualOutput = output.output || output.after || testCase.input;
                const preferenceState = evaluatePreferences(testCase, extensionSettings);
                const behaviorPassed = actualOutput === testCase.expectedOutput;
                const classification = preferenceState.mismatches.length > 0
                    ? 'skipped_preference'
                    : (behaviorPassed ? 'pass' : 'fail');
                const result = {
                    id: testCase.id,
                    dialect: testCase.dialect,
                    loadStatus,
                    expectedOutput: testCase.expectedOutput,
                    actualOutput,
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
                await new Promise(resolve => setTimeout(resolve, 0));
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
            exportButton.disabled = false;
            status.textContent = 'Finished.';
        } finally {
            await setData('builtInRulesEnabled', snapshot.builtInRulesEnabled);
            await setData('remoteRulesEnabled', snapshot.remoteRulesEnabled);
            await setData('referralMarketing', snapshot.referralMarketing);
            await call('applyRegressionRuleData', [snapshot.clearURLsData]);
            runButton.disabled = false;
        }
    }

    suite = (await call('getPendingRegressionSuite')).response || null;
    if (!suite || !Array.isArray(suite.cases)) {
        status.textContent = 'No imported regression suite found.';
        runButton.disabled = true;
        return;
    }
    runButton.addEventListener('click', run);
    exportButton.addEventListener('click', exportResults);
    run();
})();
