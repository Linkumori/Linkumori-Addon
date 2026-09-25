#!/usr/bin/env node

/*
 * ============================================================
 * Linkumori
 * ============================================================
 * Copyright (c) 2025 Subham Mahesh
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
 * ============================================================
 * Convert a rules file from the older multi-section provider format
 * (urlPattern/domainPatterns, rules, referralMarketing, rawRules,
 * exceptions, redirections, ...) to the unified "match" + "rules"
 * syntax described in docs/rule-syntax.md.
 *
 *   node scripts/convert-rule-syntax.js <input.json> [output.json]
 *
 * Without an output path the input file is rewritten in place.
 * ============================================================
 */

import fs from 'fs';
import path from 'path';
import vm from 'vm';
import { fileURLToPath } from 'url';

const repoRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');

export function loadRuleSyntax() {
    const context = { console };
    vm.createContext(context);
    const file = path.join(repoRoot, 'core_js/rule_syntax.js');
    vm.runInContext(fs.readFileSync(file, 'utf8'), context, { filename: file });
    return context.LinkumoriRuleSyntax;
}

// Same layout as the bundled rules file: one provider per line.
export function formatRulesFile(data) {
    const lines = Object.entries(data.providers || {})
        .map(([name, provider]) => `    ${JSON.stringify(name)}: ${JSON.stringify(provider)}`)
        .join(',\n');
    const head = Object.entries(data)
        .filter(([key]) => key !== 'providers')
        .map(([key, value]) => `  ${JSON.stringify(key)}: ${JSON.stringify(value, null, 2).replace(/\n/g, '\n  ')},\n`)
        .join('');
    return `{\n${head}  "providers": {\n${lines}\n  }\n}\n`;
}

export function convertRulesData(data, syntax = loadRuleSyntax()) {
    const providers = {};
    const errors = [];
    Object.entries(data.providers || {}).forEach(([name, provider]) => {
        providers[name] = syntax.toCanonicalProvider(provider);
        if (providers[name].rules.length === 0) delete providers[name].rules;
        errors.push(...syntax.validateProvider(providers[name], name));
    });
    return { data: { ...data, providers }, errors };
}

if (process.argv[1] && path.resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
    const [input, output] = process.argv.slice(2);
    if (!input) {
        console.error('usage: node scripts/convert-rule-syntax.js <input.json> [output.json]');
        process.exit(2);
    }
    const source = JSON.parse(fs.readFileSync(input, 'utf8'));
    const { data, errors } = convertRulesData(source);
    fs.writeFileSync(output || input, formatRulesFile(data));
    console.log(`Converted ${Object.keys(data.providers).length} providers -> ${output || input}`);
    if (errors.length > 0) {
        console.error(`${errors.length} rule(s) need attention:`);
        errors.forEach(error => console.error('  ' + error));
        process.exit(1);
    }
}
