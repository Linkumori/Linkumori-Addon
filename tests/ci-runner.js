/**
 * Linkumori regression CI runner
 *
 * Launches Firefox with the extension loaded, injects the regression suite
 * into the extension background, navigates to the regression page, waits for
 * completion, then writes results to regression-results.json and exits with a
 * non-zero code if any tests failed.
 
Copyright (C) Subham mahesh 2026


This program is free software; you can redistribute it and/or
modify it under the terms of the GNU Lesser General Public
License as published by the Free Software Foundation; either
version 3 of the License, or (at your option) any later version.

This program is distributed in the hope that it will be useful,
but WITHOUT ANY WARRANTY; without even the implied warranty of
MERCHANTABILITY or FITNESS FOR A PARTICULAR PURPOSE.  See the GNU
Lesser General Public License for more details.

You should have received a copy of the GNU Lesser General Public License
along with this program; if not, write to the Free Software Foundation,
Inc., 51 Franklin Street, Fifth Floor, Boston, MA  02110-1301, USA.


 * Usage:
 *   node tests/ci-runner.js [--xpi path/to/extension.xpi] [--full-battery]
 *
 * Environment variables:
 *   FIREFOX_BINARY   Path to the Firefox binary (default: auto-detect)
 *   EXTENSION_UUID   Fixed UUID to assign the extension (optional override)
 *   CI_TIMEOUT_MS    Max ms to wait for the suite to finish (default: 900000)
 */

import { Builder, By } from 'selenium-webdriver';
import firefox from 'selenium-webdriver/firefox.js';
import { spawnSync } from 'child_process';
import { readFileSync, writeFileSync, existsSync, readdirSync } from 'fs';
import { resolve, join, dirname } from 'path';
import { fileURLToPath } from 'url';

const __dirname = dirname(fileURLToPath(import.meta.url));
const ROOT = resolve(__dirname, '..');
const SUITE_PATH = join(__dirname, 'regression-suite.json');
const RESULTS_PATH = join(__dirname, 'regression-results.json');
const BATCH_SCRIPT_PATH = join(ROOT, 'core_js', 'regression_batch.js');

const EXTENSION_ID = 'linkumori-addon-official@ClearURLs';
const EXTENSION_UUID = process.env.EXTENSION_UUID || 'a7b8c9d0-e1f2-3456-7890-abcdef012345';
const CLI_ARGS = process.argv.slice(2);
const FULL_BATTERY = CLI_ARGS.includes('--full-battery') || process.env.FULL_BATTERY === '1';
function detectFirefox() {
    if (process.env.FIREFOX_BINARY) return process.env.FIREFOX_BINARY;
    const candidates = process.platform === 'darwin'
        ? [
            '/Applications/Firefox.app/Contents/MacOS/firefox',
            '/Applications/Firefox Developer Edition.app/Contents/MacOS/firefox',
            '/Applications/Firefox Nightly.app/Contents/MacOS/firefox'
          ]
        : process.platform === 'win32'
        ? [
            'C:\\Program Files\\Mozilla Firefox\\firefox.exe',
            'C:\\Program Files (x86)\\Mozilla Firefox\\firefox.exe'
          ]
        : ['/usr/bin/firefox', '/usr/bin/firefox-esr'];

    const installed = candidates.find(p => existsSync(p));
    if (installed) return installed;

    const lookup = spawnSync(process.platform === 'win32' ? 'where' : 'which', ['firefox'], {
        encoding: 'utf8'
    });
    const pathMatch = lookup.status === 0 ? lookup.stdout.split(/\r?\n/).find(Boolean) : null;
    return pathMatch || null;
}
const FIREFOX_BINARY = detectFirefox();
const CI_TIMEOUT_MS = parseInt(process.env.CI_TIMEOUT_MS || '900000', 10);

function findExistingXpi() {
    const xpiArg = CLI_ARGS.indexOf('--xpi');
    if (xpiArg !== -1 && CLI_ARGS[xpiArg + 1]) return resolve(CLI_ARGS[xpiArg + 1]);

    for (const dir of ['web-ext-artifacts', 'dist']) {
        const base = join(ROOT, dir);
        if (!existsSync(base)) continue;
        const files = readdirSync(base).filter(f => f.endsWith('.zip') || f.endsWith('.xpi'));
        if (files.length > 0) return join(base, files[files.length - 1]);
    }
    return null;
}

function toTypeCount(cases, key) {
    return cases.reduce((acc, testCase) => {
        const value = testCase[key] || 'unknown';
        acc[value] = (acc[value] || 0) + 1;
        return acc;
    }, {});
}

function normalizeRegressionSuite(rawSuite, { fullBattery = false } = {}) {
    const suite = rawSuite && typeof rawSuite === 'object' ? rawSuite : {};
    const cases = Array.isArray(suite.cases) ? suite.cases : [];
    const normalizedCases = [];
    const errors = [];
    const seen = new Set();

    cases.forEach((testCase, index) => {
        if (!testCase || typeof testCase !== 'object') {
            errors.push(`case[${index}] must be an object`);
            return;
        }

        const id = String(testCase.id || '').trim();
        if (!id) errors.push(`case[${index}] is missing id`);
        if (seen.has(id)) errors.push(`duplicate regression id: ${id}`);
        seen.add(id);

        const dialect = testCase.dialect || 'provider';
        if (!['provider', 'providerWebRequest'].includes(dialect)) {
            errors.push(`${id || `case[${index}]`} has unsupported dialect: ${dialect}`);
        }

        if (typeof testCase.input !== 'string') {
            errors.push(`${id || `case[${index}]`} is missing string input`);
        }

        const expectedBlocked = testCase.expectedBlocked === true;
        if (!expectedBlocked && typeof testCase.expectedOutput !== 'string') {
            errors.push(`${id || `case[${index}]`} needs expectedOutput or expectedBlocked`);
        }

        if (testCase.fullBattery === true && !fullBattery) return;

        normalizedCases.push({
            providers: suite.providers || {},
            preferences: suite.preferences || {},
            ...testCase,
            id,
            dialect,
            request: normalizeRequest(testCase)
        });
    });

    if (errors.length > 0) {
        throw new Error(`Invalid regression suite:\n${errors.map(e => `  - ${e}`).join('\n')}`);
    }

    return {
        ...suite,
        cases: normalizedCases,
        metadata: {
            ...(suite.metadata || {}),
            fullBattery,
            skippedFullBattery: cases.length - normalizedCases.length,
            byDialect: toTypeCount(normalizedCases, 'dialect')
        }
    };
}

function normalizeRequest(testCase) {
    const request = testCase.request && typeof testCase.request === 'object'
        ? { ...testCase.request }
        : {};
    if (!request.method) request.method = 'GET';
    if (!request.type) request.type = 'main_frame';
    return request;
}

function diffStrings(expected, actual) {
    const exp = String(expected ?? '');
    const act = String(actual ?? '');
    if (exp === act) return { at: -1, expectedTail: '', actualTail: '' };
    let at = 0;
    while (at < exp.length && at < act.length && exp[at] === act[at]) at++;
    return {
        at,
        expectedTail: exp.slice(Math.max(0, at - 24), at + 96),
        actualTail: act.slice(Math.max(0, at - 24), at + 96)
    };
}

function formatCaseLabel(testCase) {
    const request = testCase.request || {};
    return `${testCase.dialect} :: ${testCase.id} [${request.method || 'GET'} ${request.type || 'main_frame'}]`;
}

async function buildExtension() {
    console.log('[ci] Building extension with web-ext...');
    const result = spawnSync(
        'npx', ['web-ext', 'build', '--source-dir', ROOT, '--artifacts-dir', join(ROOT, 'web-ext-artifacts'), '--overwrite-dest'],
        { encoding: 'utf8', stdio: 'inherit' }
    );
    if (result.status !== 0) throw new Error('web-ext build failed');

    const files = readdirSync(join(ROOT, 'web-ext-artifacts'))
        .filter(f => f.endsWith('.zip') || f.endsWith('.xpi'));
    if (files.length === 0) throw new Error('No XPI/ZIP found after build');
    return join(ROOT, 'web-ext-artifacts', files[files.length - 1]);
}

async function launchDriver(xpiPath) {
    const options = new firefox.Options()
        .addArguments('-headless')
        .setPreference('extensions.webextensions.uuids', JSON.stringify({ [EXTENSION_ID]: EXTENSION_UUID }))
        .setPreference('xpinstall.signatures.required', false)
        .setPreference('extensions.langpacks.signatures.required', false)
        .setPreference('extensions.autoDisableScopes', 0)
        .setPreference('extensions.enabledScopes', 15)
        .setPreference('browser.tabs.remote.autostart', false);

    if (FIREFOX_BINARY) {
        options.setBinary(FIREFOX_BINARY);
    }

    const driver = await new Builder()
        .forBrowser('firefox')
        .setFirefoxOptions(options)
        .build();

    await driver.installAddon(xpiPath, true);
    // Give the background scripts a moment to initialise
    await driver.sleep(2000);
    return driver;
}

async function injectSuite(driver, suite) {
    const popupUrl = `moz-extension://${EXTENSION_UUID}/html/popup.html`;
    console.log(`[ci] Navigating to extension popup to inject suite (${suite.cases.length} cases)...`);
    await driver.get(popupUrl);
    await driver.sleep(500);

    const result = await driver.executeAsyncScript(`
        const done = arguments[arguments.length - 1];
        const suite = arguments[0];
        browser.runtime.sendMessage({ function: 'setPendingRegressionSuite', params: [suite] })
            .then(r => done({ ok: true, response: r }))
            .catch(e => done({ ok: false, error: String(e) }));
    `, suite);

    if (!result || !result.ok) {
        throw new Error(`Failed to inject regression suite: ${result && result.error}`);
    }
    console.log('[ci] Suite injected successfully.');
}

async function runBatch(driver, suite) {
    const popupUrl = `moz-extension://${EXTENSION_UUID}/html/popup.html`;
    console.log('[ci] Navigating to popup to run batch...');
    await driver.get(popupUrl);
    await driver.sleep(500);

    // Set script timeout high enough to cover the full suite
    await driver.manage().setTimeouts({ script: CI_TIMEOUT_MS });

    const batchScript = readFileSync(BATCH_SCRIPT_PATH, 'utf8');

    console.log('[ci] Running batch...');
    const start = Date.now();

    // Concatenate into one executeAsyncScript so all code shares one sandbox.
    // WebDriver injection bypasses extension CSP, so this always works.
    const raw = await driver.executeAsyncScript(`
        const done = arguments[arguments.length - 1];
        ${batchScript}
        globalThis.runCIRegressionBatch()
            .then(r => done(r))
            .catch(e => done({ error: String(e) }));
    `);

    const elapsed = Math.round((Date.now() - start) / 1000);
    if (!raw || raw.error) throw new Error(`Batch call failed: ${raw && raw.error}`);

    const batchResults = Array.isArray(raw) ? raw : (raw.results || []);
    if (!Array.isArray(batchResults)) throw new Error('Unexpected batch response shape');

    console.log(`[ci] Batch completed in ${elapsed}s — ${batchResults.length} results received`);

    // Evaluate pass/fail against expectedOutput
    const caseMap = Object.fromEntries(suite.cases.map(c => [c.id, c]));
    let passed = 0, failed = 0, skipped = 0;
    const results = batchResults.map(r => {
        const tc = caseMap[r.id];
        if (!tc) return { ...r, classification: 'fail', label: `unknown :: ${r.id || '(missing id)'}` };
        const label = formatCaseLabel(tc);
        if (r.skippedNav || r.skippedPreference) {
            skipped++;
            return { ...r, label, classification: r.skippedNav ? 'skipped_nav' : 'skipped_preference' };
        }
        const ok = !r.error && r.actualOutput === tc.expectedOutput;
        ok ? passed++ : failed++;
        return {
            id: r.id,
            label,
            dialect: r.dialect,
            request: tc.request,
            actualOutput: r.actualOutput,
            expectedOutput: tc.expectedOutput,
            passed: ok,
            classification: ok ? 'pass' : 'fail',
            diff: ok ? null : diffStrings(tc.expectedOutput, r.actualOutput),
            matchedRule: r.matchedRule || null,
            matchedProvider: r.matchedProvider || null,
            error: r.error || null
        };
    });

    const byDialect = results.reduce((acc, result) => {
        const key = result.dialect || 'unknown';
        acc[key] ||= { passed: 0, failed: 0, skipped: 0 };
        if (result.classification === 'pass') acc[key].passed++;
        else if (result.classification === 'fail') acc[key].failed++;
        else acc[key].skipped++;
        return acc;
    }, {});

    console.log(`[ci] ${passed} passed, ${failed} failed, ${skipped} skipped (nav/preferences)`);
    Object.entries(byDialect).forEach(([dialect, counts]) => {
        console.log(`[ci]   ${dialect}: ${counts.passed} passed, ${counts.failed} failed, ${counts.skipped} skipped`);
    });

    return {
        total: suite.cases.length,
        executed: batchResults.length,
        passed,
        failed,
        skippedByNav: results.filter(r => r.classification === 'skipped_nav').length,
        skippedByPreference: results.filter(r => r.classification === 'skipped_preference').length,
        skippedFullBattery: suite.metadata?.skippedFullBattery || 0,
        byDialect,
        results
    };
}

async function main() {
    let xpiPath = null;
    let driver = null;
    let exitCode = 1;

    try {
        // Build (or locate) the extension XPI
        xpiPath = await buildExtension().catch(() => {
            const existing = findExistingXpi();
            if (existing) { console.log(`[ci] Using existing XPI: ${existing}`); return existing; }
            throw new Error('Could not build or find extension XPI');
        });
        console.log(`[ci] Using XPI: ${xpiPath}`);

        // Load the regression suite
        const rawSuite = JSON.parse(readFileSync(SUITE_PATH, 'utf8'));
        const suite = normalizeRegressionSuite(rawSuite, { fullBattery: FULL_BATTERY });
        console.log(`[ci] Loaded suite: ${suite.cases.length} test cases`);
        if (suite.metadata?.skippedFullBattery) {
            console.log(`[ci] Skipped ${suite.metadata.skippedFullBattery} full-battery cases; pass --full-battery to include them.`);
        }
        Object.entries(suite.metadata?.byDialect || {}).forEach(([dialect, count]) => {
            console.log(`[ci]   ${dialect}: ${count} cases`);
        });

        // Launch Firefox with the extension
        driver = await launchDriver(xpiPath);

        // Inject suite and run batch in background
        await injectSuite(driver, suite);
        const report = await runBatch(driver, suite);

        writeFileSync(RESULTS_PATH, JSON.stringify(report, null, 2));
        console.log(`[ci] Results written to ${RESULTS_PATH}`);

        if (report.failed > 0) {
            console.log('\n[ci] Failed cases:');
            report.results
                .filter(r => r.classification === 'fail')
                .forEach(r => {
                    console.log(`  FAIL — ${r.label}\n       expected: ${r.expectedOutput}\n       actual:   ${r.actualOutput}`);
                    if (r.diff) {
                        console.log(`       first diff @ ${r.diff.at}\n       expected tail: ${r.diff.expectedTail}\n       actual tail:   ${r.diff.actualTail}`);
                    }
                    if (r.error) console.log(`       error: ${r.error}`);
                });
        }
        exitCode = report.failed > 0 ? 1 : 0;
    } catch (err) {
        console.error('[ci] Fatal error:', err.message || err);
        exitCode = 1;
    } finally {
        if (driver) await driver.quit().catch(() => {});
    }

    console.log(`\n[ci] Exiting with code ${exitCode}`);
    process.exit(exitCode);
}

main();
