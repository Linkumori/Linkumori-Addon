/*
 * Linkumori — regression batch runner
 *
 * Injected into an extension page (popup.html) by the CI driver via
 * WebDriver executeScript, which bypasses CSP. Uses getBackgroundPage()
 * to reach the live background globals without touching the manifest.
 */
(function defineRegressionBatch() {
    function entriesFromSnapshotIndex(value) {
        if (!value) return [];
        if (typeof value.entries === 'function') return Array.from(value.entries());
        if (Array.isArray(value)) return value;
        if (typeof value === 'object') return Object.entries(value);
        return [];
    }

    function keysFromSnapshotIndex(value) {
        return entriesFromSnapshotIndex(value).map(([key]) => key);
    }

    async function runCIRegressionBatch() {
        const bgWin = await browser.runtime.getBackgroundPage();

        const suite = typeof bgWin.getPendingRegressionSuite === 'function'
            ? bgWin.getPendingRegressionSuite()
            : null;
        if (!suite || !Array.isArray(suite.cases)) {
            return { error: 'No pending regression suite' };
        }

        const traceFn         = bgWin.traceLinkumoriURLFilterRuleTest;
        const labFn           = bgWin.runRuleTestLab;
        const applyFn         = bgWin.applyRegressionRuleData;
        const getDataFn       = bgWin.getData;
        const setDataFn       = bgWin.setData;
        const startFn         = bgWin.start;
        const storageAsJSONFn = bgWin.storageAsJSON;

        let extensionSettings = {};
        const snapshot = {};

        if (typeof storageAsJSONFn === 'function') {
            const exported = await storageAsJSONFn();
            extensionSettings = exported ? { ...exported } : {};
            delete extensionSettings.ClearURLsData;
        }
        if (typeof getDataFn === 'function') {
            snapshot.builtInRulesEnabled = await getDataFn('builtInRulesEnabled');
            snapshot.remoteRulesEnabled  = await getDataFn('remoteRulesEnabled');
            snapshot.referralMarketing   = await getDataFn('referralMarketing');
            snapshot.clearURLsData       = await getDataFn('ClearURLsData');
        }

        const results = [];
        try {
            if (typeof startFn   === 'function') await startFn();
            if (typeof setDataFn === 'function') {
                await setDataFn('builtInRulesEnabled', false);
                await setDataFn('remoteRulesEnabled',  false);
                await setDataFn('referralMarketing',   false);
            }

            let lastKey = null;
            for (const testCase of suite.cases) {
                if (testCase.expectedBlocked === true) {
                    results.push({ id: testCase.id, dialect: testCase.dialect, skippedNav: true });
                    continue;
                }

                const requirements = testCase.preferences && typeof testCase.preferences === 'object'
                    ? testCase.preferences : {};
                const mismatches = Object.entries(requirements)
                    .filter(([k, v]) => extensionSettings[k] !== v);
                if (mismatches.length > 0) {
                    results.push({ id: testCase.id, dialect: testCase.dialect, skippedPreference: true,
                        mismatches: mismatches.map(([k, v]) => ({ key: k, expected: v, actual: extensionSettings[k] })) });
                    continue;
                }

                if (typeof applyFn === 'function') {
                    const ruleData = {
                        activationState: testCase.activationState || suite.activationState || undefined,
                        defaults: testCase.defaults || suite.defaults || undefined,
                        providers: testCase.providers || suite.providers || {},
                        urlFilterRules: testCase.urlFilterRules || suite.urlFilterRules || []
                    };
                    const key = JSON.stringify(ruleData);
                    if (key !== lastKey) {
                        applyFn(ruleData);
                        lastKey = key;
                    }
                }

                try {
                    let raw = {};
                    if (testCase.dialect === 'urlFilter' && typeof traceFn === 'function') {
                        const r = traceFn(testCase.input, testCase.request || {});
                        raw = (r instanceof Promise ? await r : r) || {};
                    } else if (typeof labFn === 'function') {
                        const r = labFn(testCase.input, '', testCase.request || {});
                        raw = (r instanceof Promise ? await r : r) || {};
                    }
                    let snapshot = null;
                    const snapshotFn = bgWin.getClearUrlsRuntimeSnapshot;
                    if (typeof snapshotFn === 'function' && (testCase.expectedSnapshotRuleIds || testCase.expectedSnapshotAliasRuleIds || testCase.expectedSnapshotProviders)) {
                        const runtimeSnapshot = snapshotFn();
                        snapshot = runtimeSnapshot ? {
                            aliasRuleIds: entriesFromSnapshotIndex(runtimeSnapshot.aliasRuleIds),
                            providerIds: Array.isArray(runtimeSnapshot.providers) ? runtimeSnapshot.providers.map(provider => provider.providerId) : [],
                            providers: Array.isArray(runtimeSnapshot.providers) ? runtimeSnapshot.providers : [],
                            ruleIds: keysFromSnapshotIndex(runtimeSnapshot.ruleIds)
                        } : null;
                    }
                    results.push({
                        id: testCase.id,
                        dialect: testCase.dialect,
                        actualOutput: raw.output || raw.after || testCase.input,
                        matchedProvider: raw.matchedProvider || null,
                        matchedRule: raw.matchedRule || null,
                        snapshot
                    });
                } catch (e) {
                    results.push({ id: testCase.id, dialect: testCase.dialect,
                        actualOutput: testCase.input, error: e.message });
                }
            }
        } finally {
            if (typeof setDataFn === 'function') {
                if ('builtInRulesEnabled' in snapshot) await setDataFn('builtInRulesEnabled', snapshot.builtInRulesEnabled);
                if ('remoteRulesEnabled'  in snapshot) await setDataFn('remoteRulesEnabled',  snapshot.remoteRulesEnabled);
                if ('referralMarketing'   in snapshot) await setDataFn('referralMarketing',   snapshot.referralMarketing);
            }
            if ('clearURLsData' in snapshot && typeof applyFn === 'function') {
                applyFn(snapshot.clearURLsData || { providers: {}, urlFilterRules: [] });
            }
        }

        return { results };
    }

    globalThis.runCIRegressionBatch = runCIRegressionBatch;
})();
