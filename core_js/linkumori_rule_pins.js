/*
 * ============================================================
 * Linkumori — pinned rule ids
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
 * MERCHANTABILITY or FITNESS FOR A PARTICULAR PURPOSE. See the GNU
 * Lesser General Public License for more details.
 *
 * You should have received a copy of the GNU Lesser General Public
 * License along with this program. If not, see
 * <http://www.gnu.org/licenses/>.
 *
 * A rule without an "id" gets one generated from its text (see
 * linkumori_rule_ids.js), so when its text changes upstream its id changes
 * and a setting saved under the old id stops applying. The first time such
 * a rule is switched off, its id is pinned here: a pin records the
 * provider, list, id and the rule's text at that moment. On every load the
 * pin is matched against the provider's current rules (same text, same
 * generated id, or text similar enough) and the matched rule keeps the
 * pinned id however its text has drifted. A pin that matches nothing is
 * reported as orphaned instead of silently doing nothing.
 *
 * Pins are only made for rules someone switched off, so the store stays
 * small; rules with their own "id" never need one.
 *
 * Loaded as a classic script after linkumori_rule_ids.js (background,
 * custom rules page) and imported by linkumori-cli-tool.js; all read
 * globalThis.LinkumoriRulePins.
 * ============================================================
 */
(function (root) {
    'use strict';

    const PIN_STORAGE_KEY = 'clearurls_rule_id_pins';
    // How alike (0–1, see ruleTextSimilarity) a rule's current text must be
    // to the pinned text for the rule to keep the pinned id.
    const SIMILARITY_THRESHOLD = 0.8;

    function getRuleIds() {
        return root.LinkumoriRuleIds;
    }

    function isPlainObject(value) {
        return !!value && typeof value === 'object' && !Array.isArray(value);
    }

    function uniqueStrings(values) {
        return [...new Set((Array.isArray(values) ? values : [])
            .map(value => String(value || '').trim())
            .filter(Boolean))];
    }

    function fingerprintRule(section, text) {
        const value = String(text || '');
        return { text: value, hash: getRuleIds().hashRuleText(`${section}\u0000${value}`) };
    }

    function getBigrams(text) {
        const bigrams = new Map();
        for (let i = 0; i < text.length - 1; i++) {
            const bigram = text.slice(i, i + 2);
            bigrams.set(bigram, (bigrams.get(bigram) || 0) + 1);
        }
        return bigrams;
    }

    // Dice coefficient of the two texts' character pairs: 1 for the same
    // text, 0 for texts with no pair in common.
    function ruleTextSimilarity(left, right) {
        const a = String(left || '');
        const b = String(right || '');
        if (a === b) return 1;
        if (a.length < 2 || b.length < 2) return 0;
        const leftBigrams = getBigrams(a);
        const rightBigrams = getBigrams(b);
        let shared = 0;
        leftBigrams.forEach((count, bigram) => {
            shared += Math.min(count, rightBigrams.get(bigram) || 0);
        });
        return (2 * shared) / (a.length - 1 + b.length - 1);
    }

    function normalizePin(value) {
        if (!isPlainObject(value)) return null;
        const provider = typeof value.provider === 'string' ? value.provider.trim() : '';
        const generatedId = typeof value.generatedId === 'string' ? value.generatedId.trim() : '';
        const section = typeof value.section === 'string' ? value.section : '';
        const fingerprint = isPlainObject(value.fingerprintAtToggle) ? value.fingerprintAtToggle : null;
        if (!provider || !generatedId || !getRuleIds().RULE_ID_SECTIONS.includes(section) ||
            !fingerprint || typeof fingerprint.text !== 'string' || !fingerprint.text) {
            return null;
        }
        const pin = {
            provider,
            section,
            generatedId,
            sourceListId: typeof value.sourceListId === 'string' && value.sourceListId ? value.sourceListId : 'built-in',
            fingerprintAtToggle: fingerprintRule(section, fingerprint.text),
            disableKeys: uniqueStrings(value.disableKeys),
            pinnedAt: typeof value.pinnedAt === 'string' ? value.pinnedAt : ''
        };
        if (typeof value.lastSeenText === 'string' && value.lastSeenText && value.lastSeenText !== fingerprint.text) {
            pin.lastSeenText = value.lastSeenText;
        }
        return pin;
    }

    function getPinKey(provider, generatedId) {
        return `${provider}\u0000${generatedId}`;
    }

    // The pins in `value` (an array, or its JSON), one per provider and id.
    function normalizePins(value) {
        let list = value;
        if (typeof list === 'string') {
            try { list = JSON.parse(list); } catch (_) { list = []; }
        }
        const pins = new Map();
        (Array.isArray(list) ? list : []).forEach(item => {
            const pin = normalizePin(item);
            if (!pin) return;
            const key = getPinKey(pin.provider, pin.generatedId);
            const existing = pins.get(key);
            if (existing) {
                existing.disableKeys = uniqueStrings([...existing.disableKeys, ...pin.disableKeys]);
            } else {
                pins.set(key, pin);
            }
        });
        return [...pins.values()];
    }

    function createPin({ provider, section, generatedId, text, sourceListId, disableKeys }) {
        return normalizePin({
            provider,
            section,
            generatedId,
            sourceListId,
            fingerprintAtToggle: { text },
            disableKeys,
            pinnedAt: new Date().toISOString()
        });
    }

    // Adds `pin`, or merges its disable keys into the pin already there.
    function upsertPin(pins, pin) {
        const next = normalizePins(pins);
        const normalized = normalizePin(pin);
        if (!normalized) return next;
        const existing = next.find(item => item.provider === normalized.provider && item.generatedId === normalized.generatedId);
        if (existing) {
            existing.disableKeys = uniqueStrings([...existing.disableKeys, ...normalized.disableKeys]);
            return next;
        }
        next.push(normalized);
        return next;
    }

    function findPin(pins, provider, generatedId) {
        return (Array.isArray(pins) ? pins : []).find(pin => pin && pin.provider === provider && pin.generatedId === generatedId) || null;
    }

    function getPinTexts(pin) {
        return pin.lastSeenText ? [pin.fingerprintAtToggle.text, pin.lastSeenText] : [pin.fingerprintAtToggle.text];
    }

    // Matches the pins of one provider against its current rules. Returns
    //   overrides: Map "<section>\0<text>" → pinned id, for matched rules
    //     whose generated id is no longer the pinned one;
    //   results: one { pin, status, index, text, similarity } per pin, where
    //     status is "exact" (same text), "id" (same generated id),
    //     "similar" (text above SIMILARITY_THRESHOLD) or "orphaned".
    // Only rules without an "id" are matched, and each rule takes at most
    // one pin: first the pins with the same text, then those with the same
    // generated id, then the most similar pairs first.
    function resolveProviderPins(providerData, pins) {
        const ruleIds = getRuleIds();
        const overrides = new Map();
        const results = [];
        const providerPins = (Array.isArray(pins) ? pins : []).filter(Boolean);
        if (providerPins.length === 0) return { overrides, results };

        const assigned = ruleIds.assignProviderRuleIds(providerData || {});
        const candidates = {};
        ruleIds.RULE_ID_SECTIONS.forEach(section => {
            const seen = new Set();
            candidates[section] = [];
            const list = Array.isArray(providerData && providerData[section]) ? providerData[section] : [];
            list.forEach((rule, index) => {
                const entry = assigned[section][index];
                if (!entry || !entry.generated) return;
                const text = ruleIds.getRuleText(rule);
                if (seen.has(text)) return;
                seen.add(text);
                candidates[section].push({ index, text, id: entry.id });
            });
        });

        const claimed = new Set();
        const matched = new Map();
        const claim = (pin, candidate, status, similarity) => {
            claimed.add(`${pin.section}\u0000${candidate.text}`);
            matched.set(pin, { pin, status, index: candidate.index, text: candidate.text, similarity });
            if (candidate.id !== pin.generatedId) overrides.set(`${pin.section}\u0000${candidate.text}`, pin.generatedId);
        };
        const isFree = (pin, candidate) => !claimed.has(`${pin.section}\u0000${candidate.text}`);

        providerPins.forEach(pin => {
            const texts = getPinTexts(pin);
            const candidate = candidates[pin.section].find(item => isFree(pin, item) && texts.includes(item.text));
            if (candidate) claim(pin, candidate, 'exact', 1);
        });
        providerPins.forEach(pin => {
            if (matched.has(pin)) return;
            const candidate = candidates[pin.section].find(item => isFree(pin, item) && item.id === pin.generatedId);
            if (candidate) claim(pin, candidate, 'id', Math.max(...getPinTexts(pin).map(text => ruleTextSimilarity(text, candidate.text))));
        });
        const pairs = [];
        providerPins.forEach(pin => {
            if (matched.has(pin)) return;
            candidates[pin.section].forEach(candidate => {
                if (!isFree(pin, candidate)) return;
                const similarity = Math.max(...getPinTexts(pin).map(text => ruleTextSimilarity(text, candidate.text)));
                if (similarity >= SIMILARITY_THRESHOLD) pairs.push({ pin, candidate, similarity });
            });
        });
        pairs.sort((a, b) => b.similarity - a.similarity);
        pairs.forEach(({ pin, candidate, similarity }) => {
            if (matched.has(pin) || !isFree(pin, candidate)) return;
            claim(pin, candidate, 'similar', similarity);
        });

        providerPins.forEach(pin => {
            results.push(matched.get(pin) || { pin, status: 'orphaned', index: -1, text: '', similarity: 0 });
        });
        return { overrides, results };
    }

    // Wraps a createRuleIdLookup() lookup so matched rules get their pinned id.
    function withPinnedRuleIds(lookup, overrides) {
        if (!overrides || overrides.size === 0) return lookup;
        return (section, matchPattern) => overrides.get(`${section}\u0000${matchPattern}`) || lookup(section, matchPattern);
    }

    // Pins grouped by provider name.
    function groupPinsByProvider(pins) {
        const byProvider = new Map();
        (Array.isArray(pins) ? pins : []).forEach(pin => {
            if (!byProvider.has(pin.provider)) byProvider.set(pin.provider, []);
            byProvider.get(pin.provider).push(pin);
        });
        return byProvider;
    }

    root.LinkumoriRulePins = Object.freeze({
        PIN_STORAGE_KEY,
        SIMILARITY_THRESHOLD,
        createPin,
        findPin,
        fingerprintRule,
        groupPinsByProvider,
        normalizePins,
        resolveProviderPins,
        ruleTextSimilarity,
        upsertPin,
        withPinnedRuleIds
    });
})(typeof globalThis !== 'undefined' ? globalThis : this);
