#!/usr/bin/env node
'use strict';
// Runs tests/regression-suite.json in Node, without a browser.
//
//   node tests/run-regression-suite.cjs                 # whole suite
//   node tests/run-regression-suite.cjs fragment        # cases whose id contains "fragment"
//   node tests/run-regression-suite.cjs --verbose       # also list passing cases
//   node tests/run-regression-suite.cjs --suite FILE    # another suite file
//
// Each case is run the way html/regression.html runs it: the case's rules
// replace the loaded rules (built-in and remote rules off, referral marketing
// off), its storage is applied, and the URL is cleaned with runRuleTestLab
// ("provider" cases) or traceClearURLWebRequestTest ("providerWebRequest"
// cases). Pages are never loaded, so a case expecting the blocked page is
// judged by whether cleaning cancelled the request. A case's `preferences`
// are applied for that case instead of being compared with your settings,
// so no case is skipped for a setting.
//
// Exits 1 when a case fails, 0 otherwise.

const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');
const { ROOT, loadAddon } = require('./helpers/addon.cjs');

const CASE_STORAGE_KEYS = ['userWhitelist', 'historyApiWhitelist'];
const FORCED_OFF = ['builtInRulesEnabled', 'remoteRulesEnabled', 'referralMarketing'];

function parseArgs(argv) {
    const args = { suite: path.join(ROOT, 'tests', 'regression-suite.json'), filter: null, verbose: false };
    for (let i = 0; i < argv.length; i++) {
        const arg = argv[i];
        if (arg === '--verbose' || arg === '-v') args.verbose = true;
        else if (arg === '--suite') args.suite = path.resolve(argv[++i]);
        else if (arg === '--help' || arg === '-h') args.help = true;
        else args.filter = arg;
    }
    return args;
}

function consentStorage() {
    // Read the current versions the same way the add-on does, so the
    // pre-accepted consent stays valid when the versions are bumped.
    const ctx = {};
    vm.createContext(ctx);
    vm.runInContext(fs.readFileSync(path.join(ROOT, 'core_js', 'consent_config.js'), 'utf8'), ctx);
    return {
        popupConsentAccepted: true,
        popupConsentPolicyVersionAccepted: ctx.Linkumoriversion,
        popupConsentPOSARVersionAccepted: ctx.LinkumoriPOSARversion,
        popupConsentAdultAccepted: true
    };
}

async function main() {
    const args = parseArgs(process.argv.slice(2));
    if (args.help) {
        console.log(fs.readFileSync(__filename, 'utf8').split('\n').slice(2, 18).map(l => l.replace(/^\/\/ ?/, '')).join('\n'));
        return 0;
    }
    const suite = JSON.parse(fs.readFileSync(args.suite, 'utf8'));
    const cases = suite.cases.filter(c => !args.filter || String(c.id).includes(args.filter));

    const addon = await loadAddon({ storage: consentStorage() });
    // Arguments are rebuilt inside the add-on's realm: its objects inherit
    // helpers the add-on adds to Object.prototype (such as getOrDefault).
    const call = (name, ...params) => vm.runInContext(
        `(json) => ${name}(...JSON.parse(json))`, addon)(JSON.stringify(params));

    // The browser page turns these off for the whole run, whatever the
    // person's settings are; a case's preference on them is always met.
    for (const key of FORCED_OFF) call('setData', key, false);
    const baseStorage = Object.fromEntries(CASE_STORAGE_KEYS.map(key => [key, call('getData', key)]));
    // The browser page skips a case whose `preferences` differ from the
    // person's settings. Here there is no person: each case gets the
    // settings it asks for, and they are put back after it.
    const settings = { ...call('storageAsJSON') };
    delete settings.ClearURLsData;

    let lastRules = null;
    const results = { pass: 0, fail: 0, skip: 0 };
    const failures = [];

    for (const testCase of cases) {
        const rules = JSON.stringify({
            activationState: testCase.activationState || suite.activationState || undefined,
            providers: testCase.providers || suite.providers || {}
        });
        if (rules !== lastRules) {
            call('applyRegressionRuleData', JSON.parse(rules));
            lastRules = rules;
        }
        const caseStorage = testCase.storage && typeof testCase.storage === 'object' ? testCase.storage : {};
        for (const key of CASE_STORAGE_KEYS) {
            call('setData', key, Object.prototype.hasOwnProperty.call(caseStorage, key) ? caseStorage[key] : baseStorage[key]);
        }

        const changedSettings = [];
        const mismatches = [];
        for (const [key, expected] of Object.entries(testCase.preferences || {})) {
            if (FORCED_OFF.includes(key) || settings[key] === expected) continue;
            if (!(key in settings)) {
                mismatches.push(`${key}: unknown setting`);
                continue;
            }
            call('setData', key, expected);
            changedSettings.push(key);
        }

        let output = {};
        let error = null;
        try {
            output = testCase.dialect === 'providerWebRequest'
                ? call('traceClearURLWebRequestTest', { ...(testCase.request || {}), url: testCase.input })
                : call('runRuleTestLab', testCase.input, '', testCase.request || {});
            output = (await output) || {};
        } catch (e) {
            error = e;
        }
        const actual = output.output || output.after || testCase.input;
        const blocked = output.cancel === true || output.blocked === true || output.action === 'cancel'
            || (output.result && output.result.cancel === true);
        const passed = !error && (testCase.expectedBlocked === true ? blocked : actual === testCase.expectedOutput);

        for (const key of changedSettings) call('setData', key, settings[key]);

        let label;
        if (mismatches.length > 0) { results.skip++; label = 'SKIP'; }
        else if (passed) { results.pass++; label = 'PASS'; }
        else { results.fail++; label = 'FAIL'; }

        if (label === 'FAIL') {
            const detail = error ? `  error:    ${error && error.stack || error}`
                : testCase.expectedBlocked === true
                    ? `  expected: blocked\n  actual:   ${actual}`
                    : `  input:    ${testCase.input}\n  expected: ${testCase.expectedOutput}\n  actual:   ${actual}`;
            failures.push(`FAIL ${testCase.dialect} — ${testCase.id}\n${detail}`);
        } else if (args.verbose || label === 'SKIP') {
            console.log(`${label} ${testCase.dialect} — ${testCase.id}${mismatches.length ? `\n  ${mismatches.join('\n  ')}` : ''}`);
        }
    }

    for (const failure of failures) console.log(failure);
    console.log(`\n${cases.length} cases: ${results.pass} passed, ${results.fail} failed, ${results.skip} skipped`);
    return results.fail > 0 ? 1 : 0;
}

main().then(code => process.exit(code), error => {
    console.error(error && error.stack || error);
    process.exit(2);
});
