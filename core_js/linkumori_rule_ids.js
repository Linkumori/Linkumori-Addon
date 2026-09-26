/*
 * ============================================================
 * Linkumori — generated rule ids
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
 * Every rule has an id: its own "id", or one generated from its list and
 * text ("utm_source" in rules → "field-utm-source"). The rule on/off
 * controls, show-rule and the custom rules editor all use these ids, so
 * the engine, storage, the editor and the CLI must generate the same ones.
 * See docs/filter-syntax.md §9.
 *
 * Loaded as a classic script (background, custom rules page) and imported
 * by linkumori-cli-tool.js; all read globalThis.LinkumoriRuleIds.
 * ============================================================
 */
(function (root) {
    'use strict';

    // The order ids are assigned in; also the lists that hold rules.
    const RULE_ID_SECTIONS = Object.freeze(['exceptions', 'rules', 'referralMarketing', 'rawRules', 'redirections', 'fieldRedirections']);
    const SECTION_PREFIXES = Object.freeze({
        rules: 'field',
        referralMarketing: 'referral',
        rawRules: 'raw',
        redirections: 'redirect',
        fieldRedirections: 'field-redirect',
        exceptions: 'exception'
    });

    function hashRuleText(value) {
        let hash = 2166136261;
        const text = String(value || '');
        for (let i = 0; i < text.length; i++) {
            hash ^= text.charCodeAt(i);
            hash = Math.imul(hash, 16777619);
        }
        return (hash >>> 0).toString(36);
    }

    function slugifyRuleText(value) {
        return String(value || '')
            .toLowerCase()
            .replace(/[^a-z0-9]+/g, '-')
            .replace(/^-+|-+$/g, '')
            .replace(/-+/g, '-');
    }

    // The readable id for a rule's text: the list prefix and the first 32
    // characters of the slug. Different texts can share it ("rdr" and
    // "_rdr", "referer" and "Referer"), which assignProviderRuleIds resolves.
    function baseRuleId(section, matchPattern) {
        const prefix = SECTION_PREFIXES[section] || 'field';
        const slug = slugifyRuleText(matchPattern).slice(0, 32);
        return `${prefix}-${slug || hashRuleText(matchPattern)}`;
    }

    function getRuleText(rule) {
        if (typeof rule === 'string') return rule;
        if (rule && typeof rule === 'object' && !Array.isArray(rule) && typeof rule.matchPattern === 'string') return rule.matchPattern;
        return '';
    }

    function getExplicitRuleId(rule) {
        return rule && typeof rule === 'object' && !Array.isArray(rule) && typeof rule.id === 'string' && rule.id ? rule.id : null;
    }

    function getListValues(provider, section) {
        const value = provider ? provider[section] : undefined;
        return Array.isArray(value) ? value : [];
    }

    // Ids for every rule of one provider, as { [section]: [ { id, generated } | null ] }
    // in list order (null for an entry without text). A rule without an "id"
    // gets baseRuleId(), unless another rule of the provider with different
    // text would get the same one, or an "id"/"aliases" entry already uses
    // it: then each of those rules gets "<base>-<hash of its text>". The
    // result depends only on which rules the provider has, not their order,
    // and identical rules in one list share their id.
    function assignProviderRuleIds(provider) {
        const reserved = new Set();
        const groups = new Map();
        RULE_ID_SECTIONS.forEach(section => {
            getListValues(provider, section).forEach(rule => {
                const explicitId = getExplicitRuleId(rule);
                if (explicitId) reserved.add(explicitId);
                if (rule && typeof rule === 'object' && Array.isArray(rule.aliases)) {
                    rule.aliases.forEach(alias => { if (typeof alias === 'string') reserved.add(alias); });
                }
                const text = getRuleText(rule);
                if (explicitId || !text) return;
                const base = baseRuleId(section, text);
                if (!groups.has(base)) groups.set(base, new Set());
                groups.get(base).add(`${section}\u0000${text}`);
            });
        });
        const result = {};
        RULE_ID_SECTIONS.forEach(section => {
            result[section] = getListValues(provider, section).map(rule => {
                const explicitId = getExplicitRuleId(rule);
                if (explicitId) return { id: explicitId, generated: false };
                const text = getRuleText(rule);
                if (!text) return null;
                const base = baseRuleId(section, text);
                const shared = groups.get(base).size > 1 || reserved.has(base);
                return { id: shared ? `${base}-${hashRuleText(text)}` : base, generated: true };
            });
        });
        return result;
    }

    // Looks up the id of the rule with this text in `section`, from the
    // result of assignProviderRuleIds().
    function createRuleIdLookup(provider) {
        const assigned = assignProviderRuleIds(provider);
        const byText = new Map();
        RULE_ID_SECTIONS.forEach(section => {
            getListValues(provider, section).forEach((rule, index) => {
                const entry = assigned[section][index];
                if (!entry || !entry.generated) return;
                const key = `${section}\u0000${getRuleText(rule)}`;
                if (!byText.has(key)) byText.set(key, entry.id);
            });
        });
        return (section, matchPattern) => byText.get(`${section}\u0000${matchPattern}`) || baseRuleId(section, matchPattern);
    }

    root.LinkumoriRuleIds = Object.freeze({
        RULE_ID_SECTIONS,
        assignProviderRuleIds,
        baseRuleId,
        createRuleIdLookup,
        getRuleText,
        hashRuleText
    });
})(typeof globalThis !== 'undefined' ? globalThis : this);
