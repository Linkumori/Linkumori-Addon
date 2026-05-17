/**
 * Linkumori regression CI runner
 *
 * Launches Firefox with the extension loaded, injects the regression suite
 * into the extension background, navigates to the regression page, waits for
 * completion, then writes results to regression-results.json and exits with a
 * non-zero code if any tests failed.
 *
 * Usage:
 *   node tests/ci-runner.js [--xpi path/to/extension.xpi]
 *
 * Environment variables:
 *   FIREFOX_BINARY   Path to the Firefox binary (default: "firefox")
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
        : ['/usr/bin/firefox', '/usr/bin/firefox-esr', 'firefox'];
    return candidates.find(p => existsSync(p)) || 'firefox';
}
const FIREFOX_BINARY = detectFirefox();
const CI_TIMEOUT_MS = parseInt(process.env.CI_TIMEOUT_MS || '900000', 10);

function findExistingXpi() {
    const args = process.argv.slice(2);
    const xpiArg = args.indexOf('--xpi');
    if (xpiArg !== -1 && args[xpiArg + 1]) return resolve(args[xpiArg + 1]);

    for (const dir of ['web-ext-artifacts', 'dist']) {
        const base = join(ROOT, dir);
        if (!existsSync(base)) continue;
        const files = readdirSync(base).filter(f => f.endsWith('.zip') || f.endsWith('.xpi'));
        if (files.length > 0) return join(base, files[files.length - 1]);
    }
    return null;
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
        .setBinary(FIREFOX_BINARY)
        .addArguments('-headless')
        .setPreference('extensions.webextensions.uuids', JSON.stringify({ [EXTENSION_ID]: EXTENSION_UUID }))
        .setPreference('xpinstall.signatures.required', false)
        .setPreference('extensions.langpacks.signatures.required', false)
        .setPreference('extensions.autoDisableScopes', 0)
        .setPreference('extensions.enabledScopes', 15)
        .setPreference('browser.tabs.remote.autostart', false);

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
        if (!tc) return { ...r, classification: 'fail' };
        if (r.skippedNav || r.skippedPreference) {
            skipped++;
            return { ...r, classification: r.skippedNav ? 'skipped_nav' : 'skipped_preference' };
        }
        const ok = r.actualOutput === tc.expectedOutput;
        ok ? passed++ : failed++;
        return {
            id: r.id,
            dialect: r.dialect,
            actualOutput: r.actualOutput,
            expectedOutput: tc.expectedOutput,
            passed: ok,
            classification: ok ? 'pass' : 'fail',
            error: r.error || null
        };
    });

    console.log(`[ci] ${passed} passed, ${failed} failed, ${skipped} skipped (nav)`);
    return { total: suite.cases.length, executed: batchResults.length, passed, failed, skippedByNav: skipped, results };
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
        const suite = JSON.parse(readFileSync(SUITE_PATH, 'utf8'));
        console.log(`[ci] Loaded suite: ${suite.cases.length} test cases`);

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
                .forEach(r => console.log(`  FAIL — ${r.dialect} — ${r.id}\n       expected: ${r.expectedOutput}\n       actual:   ${r.actualOutput}`));
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
