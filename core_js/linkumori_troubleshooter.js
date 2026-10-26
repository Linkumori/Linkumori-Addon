/*
 * ============================================================
 * Linkumori — tab troubleshooter diagnosis
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
 * Answers "did Linkumori break this page, and which rule?" for one tab.
 *
 * 1. Pause check: cleaning is paused for the tab's site (temporary tab
 *    whitelist), the tab reloads, and the person says whether the page
 *    works now.
 * 2. Rule hunt: the rules that fired on the tab are split in half. One
 *    half is switched off, the tab reloads, and the person says whether
 *    the page is fixed. The half that holds the culprit is kept and split
 *    again, until one rule is left. Every rule switched off for a test is
 *    switched back on afterwards.
 *
 * The state is kept in session storage, so it survives the popup closing
 * and the background page unloading.
 *
 * ============================================================
 * MODIFICATION HISTORY
 * ============================================================
 * 2026-10-26   Subham Mahesh   File created
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

const LINKUMORI_DIAGNOSIS_KEY_PREFIX = 'linkumori_troubleshooter_diagnosis_';
const LINKUMORI_DIAGNOSIS_MAX_RULES = 64;
const linkumoriDiagnoses = new Map();
let linkumoriDiagnosesLoaded = null;

function getDiagnosisSessionArea() {
    return typeof browser !== 'undefined' ? browser.storage?.session || null : null;
}

function loadTroubleshooterDiagnoses() {
    if (linkumoriDiagnosesLoaded) return linkumoriDiagnosesLoaded;
    linkumoriDiagnosesLoaded = (async () => {
        const area = getDiagnosisSessionArea();
        if (!area?.get) return;
        try {
            const stored = await area.get(null);
            Object.entries(stored || {}).forEach(([key, value]) => {
                if (!key.startsWith(LINKUMORI_DIAGNOSIS_KEY_PREFIX) || !value || typeof value !== 'object') return;
                const tabId = Number(key.slice(LINKUMORI_DIAGNOSIS_KEY_PREFIX.length));
                if (!Number.isInteger(tabId) || tabId < 0) return;
                linkumoriDiagnoses.set(tabId, value);
                // The temporary tab whitelist lives in memory, so a pause
                // check has to be put back after the background restarts.
                if (value.phase === 'paused' && value.domain && typeof addToTemporaryTabWhitelist === 'function') {
                    addToTemporaryTabWhitelist(value.domain, tabId);
                }
            });
        } catch (_) {
            // Session storage unreadable: start without saved diagnoses.
        }
    })();
    return linkumoriDiagnosesLoaded;
}

async function saveTroubleshooterDiagnosis(tabId) {
    const area = getDiagnosisSessionArea();
    if (!area?.set) return false;
    const key = `${LINKUMORI_DIAGNOSIS_KEY_PREFIX}${tabId}`;
    try {
        const state = linkumoriDiagnoses.get(tabId);
        if (state) await area.set({ [key]: state });
        else await area.remove(key);
        return true;
    } catch (_) {
        return false;
    }
}

function publicTroubleshooterDiagnosis(state) {
    if (!state) return { phase: 'idle' };
    const out = {
        phase: state.phase,
        domain: state.domain || '',
        verdict: state.verdict || null,
        round: state.round || 0,
        totalRules: Array.isArray(state.rules) ? state.rules.length : 0,
        suspects: Array.isArray(state.suspects) ? state.suspects.length : 0,
        testing: Array.isArray(state.testing) ? state.testing.length : 0,
        roundsLeft: Array.isArray(state.suspects) && state.suspects.length > 1
            ? Math.ceil(Math.log2(state.suspects.length)) : 0,
        culprit: null
    };
    if (Number.isInteger(state.culprit) && state.rules?.[state.culprit]) {
        out.culprit = { ...state.rules[state.culprit] };
    }
    return out;
}

function normalizeTabId(tabId) {
    const id = Number(tabId);
    return Number.isInteger(id) && id >= 0 ? id : null;
}

async function getTroubleshooterDiagnosis(tabId) {
    await loadTroubleshooterDiagnoses();
    const id = normalizeTabId(tabId);
    return publicTroubleshooterDiagnosis(id === null ? null : linkumoriDiagnoses.get(id));
}

// Step 1: pause cleaning for the tab's site. The popup reloads the tab.
async function startTroubleshooterPauseCheck(tabId, domain) {
    await loadTroubleshooterDiagnoses();
    const id = normalizeTabId(tabId);
    const cleanDomain = String(domain || '').toLowerCase().trim();
    if (id === null || !cleanDomain) return { success: false, error: 'Invalid tab' };
    const current = linkumoriDiagnoses.get(id);
    if (current?.phase === 'bisect') return { success: false, error: 'A rule search is already running for this tab' };
    // Leave a whitelist entry the person made themselves alone.
    const alreadyPaused = typeof getTemporaryTabWhitelistForTab === 'function' &&
        getTemporaryTabWhitelistForTab(id).includes(cleanDomain);
    if (!alreadyPaused && typeof addToTemporaryTabWhitelist === 'function') {
        addToTemporaryTabWhitelist(cleanDomain, id);
    }
    linkumoriDiagnoses.set(id, {
        phase: 'paused',
        domain: cleanDomain,
        addedPause: !alreadyPaused,
        startedAt: Date.now()
    });
    await saveTroubleshooterDiagnosis(id);
    return { success: true, diagnosis: publicTroubleshooterDiagnosis(linkumoriDiagnoses.get(id)) };
}

function endTroubleshooterPause(id, state) {
    if (state?.addedPause && state.domain && typeof removeFromTemporaryTabWhitelist === 'function') {
        removeFromTemporaryTabWhitelist(state.domain, id);
    }
}

// The person's answer to "does the page work with cleaning paused?".
async function answerTroubleshooterPauseCheck(tabId, worksNow) {
    await loadTroubleshooterDiagnoses();
    const id = normalizeTabId(tabId);
    const state = id === null ? null : linkumoriDiagnoses.get(id);
    if (!state || state.phase !== 'paused') return { success: false, error: 'No pause check is running for this tab' };
    endTroubleshooterPause(id, state);
    linkumoriDiagnoses.set(id, {
        phase: 'checked',
        domain: state.domain,
        verdict: worksNow === true ? 'linkumori' : 'not-linkumori',
        startedAt: state.startedAt
    });
    await saveTroubleshooterDiagnosis(id);
    return { success: true, diagnosis: publicTroubleshooterDiagnosis(linkumoriDiagnoses.get(id)) };
}

async function applyTroubleshooterTestRound(state) {
    const testing = state.suspects.slice(0, Math.ceil(state.suspects.length / 2));
    state.testing = testing;
    state.round = (state.round || 0) + 1;
    return globalThis.setTroubleshooterRulesEnabledBatch(
        testing.map(index => ({ identity: state.rules[index].identity, enabled: false })));
}

async function restoreTroubleshooterTestRound(state) {
    if (!Array.isArray(state?.testing) || state.testing.length === 0) return;
    const testing = state.testing;
    state.testing = [];
    await globalThis.setTroubleshooterRulesEnabledBatch(
        testing.map(index => ({ identity: state.rules[index].identity, enabled: true })));
}

// Step 2: find the rule. identities are the rules that fired on this tab,
// as the popup knows them. The popup reloads the tab after each round.
async function startTroubleshooterBisect(tabId, identities) {
    await loadTroubleshooterDiagnoses();
    const id = normalizeTabId(tabId);
    if (id === null) return { success: false, error: 'Invalid tab' };
    if (typeof globalThis.getTroubleshooterRuleState !== 'function' ||
        typeof globalThis.setTroubleshooterRulesEnabledBatch !== 'function') {
        return { success: false, error: 'Rules are still loading. Try again in a moment.' };
    }
    const previous = linkumoriDiagnoses.get(id);
    if (previous?.phase === 'bisect') await restoreTroubleshooterTestRound(previous);
    if (previous?.phase === 'paused') endTroubleshooterPause(id, previous);

    // Only rules that are on now can be tested; one entry per switch.
    const seen = new Set();
    const rules = [];
    (Array.isArray(identities) ? identities : []).forEach(identity => {
        if (!identity || typeof identity !== 'object') return;
        const ruleState = globalThis.getTroubleshooterRuleState(identity);
        if (!ruleState?.available || !ruleState.enabled || seen.has(ruleState.toggleId)) return;
        seen.add(ruleState.toggleId);
        rules.push({
            identity,
            ruleId: ruleState.ruleId,
            providerName: ruleState.providerName,
            section: ruleState.section,
            label: String(identity.ruleId || ruleState.ruleId || '')
        });
    });
    if (rules.length === 0) {
        return { success: false, error: 'None of the rules that fired on this page can be switched off.' };
    }
    if (rules.length > LINKUMORI_DIAGNOSIS_MAX_RULES) rules.length = LINKUMORI_DIAGNOSIS_MAX_RULES;

    const state = {
        phase: 'bisect',
        domain: previous?.domain || '',
        verdict: previous?.verdict || null,
        startedAt: Date.now(),
        rules,
        suspects: rules.map((_, index) => index),
        testing: [],
        round: 0,
        culprit: null
    };
    if (state.suspects.length === 1) {
        state.phase = 'found';
        state.culprit = 0;
    } else {
        const result = await applyTroubleshooterTestRound(state);
        if (!result?.success) return { success: false, error: result?.error || 'Could not switch the rules off' };
    }
    linkumoriDiagnoses.set(id, state);
    await saveTroubleshooterDiagnosis(id);
    return { success: true, diagnosis: publicTroubleshooterDiagnosis(state) };
}

// The person's answer to "is the page fixed now?" for the current round.
async function answerTroubleshooterBisect(tabId, fixedNow) {
    await loadTroubleshooterDiagnoses();
    const id = normalizeTabId(tabId);
    const state = id === null ? null : linkumoriDiagnoses.get(id);
    if (!state || state.phase !== 'bisect') return { success: false, error: 'No rule search is running for this tab' };
    const testing = state.testing.slice();
    const tested = new Set(testing);
    const wasConfirming = state.confirming === true;
    state.confirming = false;
    state.suspects = fixedNow === true
        ? state.suspects.filter(index => tested.has(index))
        : state.suspects.filter(index => !tested.has(index));
    await restoreTroubleshooterTestRound(state);

    if (state.suspects.length === 0) {
        // "Not fixed" with nothing left to test: no single rule explains it.
        state.phase = 'not-found';
    } else if (state.suspects.length === 1 && (fixedNow === true || wasConfirming)) {
        // Switching this rule off (alone or in its group) fixed the page.
        state.phase = 'found';
        state.culprit = state.suspects[0];
    } else if (state.suspects.length === 1) {
        // Only reached by elimination, never tested on its own: confirm it,
        // so "still broken" every round does not blame an innocent rule.
        state.confirming = true;
        state.testing = state.suspects.slice();
        state.round = (state.round || 0) + 1;
        const result = await globalThis.setTroubleshooterRulesEnabledBatch(
            state.testing.map(index => ({ identity: state.rules[index].identity, enabled: false })));
        if (!result?.success) state.phase = 'not-found';
    } else {
        const result = await applyTroubleshooterTestRound(state);
        if (!result?.success) {
            state.phase = 'not-found';
        }
    }
    await saveTroubleshooterDiagnosis(id);
    return { success: true, diagnosis: publicTroubleshooterDiagnosis(state) };
}

// Stop and put everything back: rules on again, pause removed.
async function cancelTroubleshooterDiagnosis(tabId) {
    await loadTroubleshooterDiagnoses();
    const id = normalizeTabId(tabId);
    if (id === null) return { success: false, error: 'Invalid tab' };
    const state = linkumoriDiagnoses.get(id);
    if (state?.phase === 'bisect') await restoreTroubleshooterTestRound(state);
    if (state?.phase === 'paused') endTroubleshooterPause(id, state);
    linkumoriDiagnoses.delete(id);
    await saveTroubleshooterDiagnosis(id);
    return { success: true, diagnosis: publicTroubleshooterDiagnosis(null) };
}

if (typeof browser !== 'undefined' && browser.tabs?.onRemoved?.addListener) {
    browser.tabs.onRemoved.addListener(async (tabId) => {
        await loadTroubleshooterDiagnoses();
        if (!linkumoriDiagnoses.has(tabId)) return;
        // Never leave rules switched off because the tab was closed mid-test.
        await cancelTroubleshooterDiagnosis(tabId);
    });
}

loadTroubleshooterDiagnoses();
