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

const EXTENSION_ID = 'linkumori-addon-official@ClearURLs';
const EXTENSION_UUID = process.env.EXTENSION_UUID || 'a7b8c9d0-e1f2-3456-7890-abcdef012345';
const FIREFOX_BINARY = process.env.FIREFOX_BINARY || 'firefox';
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

async function runRegressionPage(driver) {
    const regressionUrl = `moz-extension://${EXTENSION_UUID}/html/regression.html?ci=1`;
    console.log(`[ci] Navigating to regression page: ${regressionUrl}`);
    await driver.get(regressionUrl);

    const statusEl = await driver.findElement(By.id('status'));

    // Wait for the suite to auto-start (status changes from "Loading..." or "Running...")
    // then wait for it to finish
    console.log('[ci] Waiting for regression suite to complete...');
    const start = Date.now();

    await driver.wait(async () => {
        const text = await statusEl.getText().catch(() => '');
        if (Date.now() - start > 15000 && text === '') return true; // stuck
        const lower = text.toLowerCase();
        return lower.includes('finished') || lower.includes('failed') || lower.includes('no suite') || lower.includes('run failed');
    }, CI_TIMEOUT_MS, `Regression suite did not finish within ${CI_TIMEOUT_MS / 1000}s`);

    const finalStatus = await statusEl.getText().catch(() => '');
    console.log(`[ci] Status: ${finalStatus}`);
    return finalStatus;
}

async function collectResults(driver) {
    const report = await driver.executeScript('return window.linkumoriRegressionReport || null;');
    if (report) return report;

    // Fallback: parse summary text from DOM
    const summaryText = await driver.findElement(By.id('summary')).getText().catch(() => '');
    return { summaryText, results: [], parsed: true };
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

        // Inject the suite into the extension background
        await injectSuite(driver, suite);

        // Run the regression page
        const finalStatus = await runRegressionPage(driver);

        // Collect results
        const report = await collectResults(driver);
        writeFileSync(RESULTS_PATH, JSON.stringify(report, null, 2));
        console.log(`[ci] Results written to ${RESULTS_PATH}`);

        if (report && typeof report.total === 'number') {
            const { total, executed, passed, failed, skippedByPreference } = report;
            console.log(`\n[ci] Results: ${executed}/${total} executed — ${passed} passed, ${failed} failed, ${skippedByPreference} skipped`);
            if (failed > 0) {
                console.log('\n[ci] Failed cases:');
                (report.results || [])
                    .filter(r => r.classification === 'fail')
                    .forEach(r => console.log(`  FAIL — ${r.dialect} — ${r.id}`));
            }
            exitCode = failed > 0 ? 1 : 0;
        } else if (finalStatus.toLowerCase().includes('finished')) {
            exitCode = 0;
        } else {
            console.log(`[ci] Unknown finish state: ${finalStatus}`);
            exitCode = 1;
        }
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
