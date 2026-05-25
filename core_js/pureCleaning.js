/*
 * ============================================================
 * ClearURLs
 * ============================================================
 * Copyright (c) 2017–2020 Kevin Röbert
 * Modified by Subham Mahesh (c) 2025–2026 (modified parts only)
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
 * Repository: https://github.com/linkumori/linkumori
 *
 * MODIFICATIONS
 * -------------
 * - Added Rule Test Lab trace helpers for custom-rules diagnostics
 * - Extended cleaning path to expose matched provider/rule/action
 *   metadata
 *
 * ============================================================
 * MODIFICATION HISTORY
 * ============================================================
 * 2025-06-14   Subham Mahesh   First modification
 * 2025-08-21   Subham Mahesh   Second modification
 * 2025-09-05   Subham Mahesh   Third modification
 * 2026-01-25   Subham Mahesh   Fourth modification
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
/*jshint esversion: 6 */

/**
 * Cleans given URLs. Also do automatic redirection.
 *
 * @param  {String} url     url as string
 * @param {boolean} quiet   if the action should be displayed in log and statistics
 * @return {String}         cleaned URL
 */
function pureCleaning(url, quiet = false) {
    let before = url;
    let after = url;
    const sessionRewrites = new Set();

    do {
        before = after;
        after = _cleaning(before, quiet, null, null, 1, '', null, sessionRewrites);
    } while (after !== before); // do recursive cleaning

    return after;
}

function buildProviderMatchDiagnostics(provider, url, testParamName = '') {
    const providerName = typeof provider?.getName === 'function' ? provider.getName() : null;
    const appliedPattern = typeof provider?.getAppliedPatternForUrl === 'function'
        ? provider.getAppliedPatternForUrl(url)
        : { patternType: null, patternValue: null };

    return {
        providerName: providerName || null,
        patternMatched: !!appliedPattern?.patternType,
        patternType: appliedPattern?.patternType || null,
        patternValue: appliedPattern?.patternValue || null,
        testedParam: typeof testParamName === 'string' && testParamName.trim() ? testParamName.trim() : null,
        completeProvider: typeof provider?.isCaneling === 'function' ? !!provider.isCaneling() : null
    };
}

function pureCleaningTrace(url, testParamName = '', requestDetails = null) {
    const sessionRewrites = new Set();
    let before = url;
    let after = url;
    const trace = [];
    const providerDiagnostics = [];
    let iterations = 0;

    do {
        before = after;
        after = _cleaning(before, true, trace, providerDiagnostics, iterations + 1, testParamName, requestDetails, sessionRewrites);
        iterations++;
    } while (after !== before && iterations < 20);

    const firstMatch = trace.length > 0 ? trace[0] : null;
    const firstPatternOnly = providerDiagnostics.find((entry) => entry.patternMatched) || null;
    const primaryDiagnostics = firstMatch
        ? (providerDiagnostics.find((entry) => (
            entry.providerName === firstMatch.providerName && entry.iteration === firstMatch.iteration
        )) || firstPatternOnly)
        : firstPatternOnly;

    return {
        before: url,
        after,
        changed: after !== url,
        iterations,
        matchedProvider: firstMatch?.providerName || primaryDiagnostics?.providerName || null,
        matchedRule: firstMatch?.matchedRule || null,
        patternType: firstMatch?.patternType || primaryDiagnostics?.patternType || null,
        patternValue: firstMatch?.patternValue || primaryDiagnostics?.patternValue || null,
        action: firstMatch?.action || (primaryDiagnostics?.patternMatched ? 'pattern_match_only' : null),
        matchedException: null,
        matchedDomainException: null,
        matchedRedirection: null,
        matchedDomainRedirection: null,
        matchedRuleRegex: firstMatch?.action === 'rule' ? firstMatch.matchedRule : null,
        matchedRawRule: firstMatch?.action === 'raw_rule' ? firstMatch.matchedRule : null,
        matchedReferralMarketing: null,
        matchedRemoveParamRule: firstMatch?.action === 'removeparam' ? firstMatch.matchedRule : null,
        matchedRemoveParamException: null,
        testedParam: primaryDiagnostics?.testedParam || null,
        completeProvider: typeof primaryDiagnostics?.completeProvider === 'boolean'
            ? primaryDiagnostics.completeProvider
            : null,
        trace
    };
}

function runRuleTestLab(inputUrl, testParamRaw = '', requestOverrides = {}) {
    const t = (key, fallback) => {
        try {
            const value = translate(key);
            return value || fallback;
        } catch (error) {
            return fallback;
        }
    };

    const rawInput = String(inputUrl || '').trim();
    if (!rawInput) {
        return {
            success: false,
            error: t('rule_test_error_url_required', 'URL is required')
        };
    }

    let normalizedUrl = rawInput;
    if (!/^https?:\/\//i.test(normalizedUrl)) {
        normalizedUrl = `https://${normalizedUrl}`;
    }

    try {
        new URL(normalizedUrl);
    } catch (error) {
        return {
            success: false,
            error: t('rule_test_error_invalid_url', 'Invalid URL format')
        };
    }

    const normalizedTestParam = String(testParamRaw || '').trim();
    let effectiveUrl = normalizedUrl;

    if (normalizedTestParam) {
        try {
            const urlObj = new URL(normalizedUrl);
            const eqIndex = normalizedTestParam.indexOf('=');
            const paramName = (eqIndex === -1
                ? normalizedTestParam
                : normalizedTestParam.slice(0, eqIndex)).trim();
            const paramValue = (eqIndex === -1
                ? '1'
                : normalizedTestParam.slice(eqIndex + 1)).trim();

            if (paramName) {
                const alreadyPresent = urlObj.searchParams.has(paramName);
                if (!alreadyPresent) {
                    urlObj.searchParams.append(paramName, paramValue || '1');
                }
                effectiveUrl = urlObj.toString();
            }
        } catch (error) {
            // Keep normalizedUrl when test param injection fails.
        }
    }

    try {
        const requestDetails = {
            url: effectiveUrl,
            method: 'GET',
            type: 'main_frame',
            tabId: -1,
            ...requestOverrides
        };
        const result = pureCleaningTrace(effectiveUrl, normalizedTestParam, requestDetails);
        const linkumoriURLResult = typeof globalThis.traceLinkumoriURLFilterRuleTest === 'function'
            ? globalThis.traceLinkumoriURLFilterRuleTest(effectiveUrl, {
                ...requestDetails
            })
            : null;
        const linkumoriURLChanged = !!(linkumoriURLResult && linkumoriURLResult.changed);

        return {
            success: true,
            input: effectiveUrl,
            output: result.after,
            changed: result.changed || linkumoriURLChanged,
            matchedProvider: result.matchedProvider,
            matchedRule: result.matchedRule,
            patternType: result.patternType,
            patternValue: result.patternValue,
            action: result.action,
            matchedException: result.matchedException,
            matchedDomainException: result.matchedDomainException,
            matchedRedirection: result.matchedRedirection,
            matchedDomainRedirection: result.matchedDomainRedirection,
            matchedRuleRegex: result.matchedRuleRegex,
            matchedRawRule: result.matchedRawRule,
            matchedReferralMarketing: result.matchedReferralMarketing,
            matchedRemoveParamRule: result.matchedRemoveParamRule,
            matchedRemoveParamException: result.matchedRemoveParamException,
            linkumoriURLChanged,
            linkumoriURLOutput: linkumoriURLResult?.output || null,
            linkumoriURLMatchedRule: linkumoriURLResult?.matchedRule || null,
            linkumoriURLPatternType: linkumoriURLResult?.patternType || null,
            linkumoriURLAction: linkumoriURLResult?.action || null,
            testedParam: result.testedParam,
            completeProvider: result.completeProvider,
            steps: result.trace
        };
    } catch (error) {
        return {
            success: false,
            error: error?.message || t('rule_test_error_failed', 'Rule test failed')
        };
    }
}

/**
 * Internal function to clean the given URL.
 */
function _cleaning(url, quiet = false, traceCollector = null, diagnosticsCollector = null, iteration = 1, testParamName = '', requestDetails = null, sessionRewrites = null) {
    let cleanURL = url;
    const URLbeforeReplaceCount = countFields(url);

    if (!quiet) {
        //Add Fields form Request to global url counter
        increaseTotalCounter(URLbeforeReplaceCount);
    }

    for (let i = 0; i < providers.length; i++) {
        const effectiveRequest = requestDetails
            ? { ...requestDetails, url: cleanURL }
            : null;
        const requestMatches = !effectiveRequest || (
            providers[i].matchMethod(effectiveRequest) &&
            providers[i].matchResourceType(effectiveRequest)
        );
        const providerDiagnostics = requestMatches
            ? buildProviderMatchDiagnostics(providers[i], cleanURL, testParamName)
            : null;
        if (Array.isArray(diagnosticsCollector) && providerDiagnostics) {
            diagnosticsCollector.push({
                ...providerDiagnostics,
                iteration
            });
        }

        let result = {
            "changes": false,
            "url": "",
            "redirect": false,
            "cancel": false
        };

        const providerMatchesUrl = requestMatches && (typeof providers[i].matchRequestURL === 'function'
            ? providers[i].matchRequestURL(cleanURL, effectiveRequest)
            : providers[i].matchURL(cleanURL));
        if (requestMatches && providerMatchesUrl) {
            result = removeFieldsFormURL(providers[i], cleanURL, quiet, effectiveRequest, null, [], sessionRewrites);
            cleanURL = result.url;
        }

        if (Array.isArray(traceCollector) && (result.changes || result.redirect || result.cancel)) {
            const providerMatch = result.providerMatch || {};
            traceCollector.push({
                providerName: providerMatch.providerName || providers[i].getName(),
                patternType: providerMatch.patternType || null,
                patternValue: providerMatch.patternValue || null,
                matchedRule: result.matchedRule || null,
                action: result.action || (result.redirect ? 'redirect' : (result.cancel ? 'cancel' : 'rule')),
                iteration,
                before: url,
                after: result.url
            });
        }

        if (result.redirect) {
            return result.url;
        }
    }

    return cleanURL;
}
