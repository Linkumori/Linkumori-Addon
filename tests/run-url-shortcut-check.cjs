#!/usr/bin/env node
// Checks the $removeparam URL token shortcut against the full URL pattern
// check it stands in for.
//
// getLinkumoriUrlPatternTokens() lists words a URL pattern needs (from the
// pattern's compiled @ghostery/adblocker filter), and
// matchLinkumoriRemoveParamTarget() skips a rule whose words are missing
// from the URL. That is only safe if matchDomainPattern() can never match
// such a URL. This script tries to break that, with the Public Suffix List
// loaded and not loaded (matchDomainPattern() must give the same answers
// either way):
//
//   - every "$removeparam" URL pattern of the bundled rules, and
//   - generated hostile patterns ("||", "|", "^", "*", "*.", ".*", ports,
//     paths, end anchors, "^" right after the host, ...)
//
// against URLs built from each pattern and then bent: words glued to
// letters (".../xfoo/" for "foo"), extra path segments, upper case, ports,
// user info, sub-domains, trailing dots, percent-encoding, query and
// fragment text. A failure is a pattern and URL that matchDomainPattern()
// accepts but the shortcut would skip.
//
// It also checks the safety net (linkumoriUrlShortcutSkipStands): with a
// shortcut that is wrong on purpose, the rule must still apply and the
// shortcut must turn itself off.
//
//   node tests/run-url-shortcut-check.cjs           # default size
//   node tests/run-url-shortcut-check.cjs --big     # 5x the generated cases
//
// Exits with 1 on any failure.

'use strict';

const fs = require('fs');
const path = require('path');
const vm = require('vm');
const { ROOT, loadAddon } = require('./helpers/addon.cjs');

const BIG = process.argv.includes('--big');
const GENERATED_PATTERNS = BIG ? 15000 : 3000;
const URLS_PER_PATTERN = 24;
const MAX_FAILURES_SHOWN = 15;

function consentStorage() {
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

// Deterministic, so a failure can be run again.
function makeRandom(seed) {
    let s = seed >>> 0;
    const next = () => {
        s ^= s << 13; s >>>= 0;
        s ^= s >>> 17;
        s ^= s << 5; s >>>= 0;
        return s;
    };
    const int = n => next() % n;
    const pick = list => list[int(list.length)];
    const chance = p => next() / 0x100000000 < p;
    return { int, pick, chance };
}

// URL patterns of the bundled rules' $removeparam entries (the part before
// "$", without "@@").
function bundledPatterns() {
    const file = path.join(ROOT, 'data', 'linkumori-clearurls.json');
    const out = new Set();
    if (!fs.existsSync(file)) return [];
    const walk = value => {
        if (Array.isArray(value)) { value.forEach(walk); return; }
        if (value && typeof value === 'object') { Object.values(value).forEach(walk); return; }
        if (typeof value !== 'string' || !value.includes('removeparam')) return;
        let p = value.startsWith('@@') ? value.slice(2) : value;
        const dollar = p.indexOf('$');
        if (dollar <= 0) return;
        p = p.slice(0, dollar);
        if (p && p !== '*') out.add(p);
    };
    walk(JSON.parse(fs.readFileSync(file, 'utf8')));
    return [...out];
}

const WORDS = ['foo', 'go', 'ref', 'utm', 'aff', 'id', 'dp', 'gp', 'click', 'track', 'a1', 'x9', '42', 'redirect', 'out', 'r', 'v'];
const HOST_LABELS = ['example', 'shop', 'amazon', 'news', 'cdn', 'a-b', 'x1'];
const SUFFIXES = ['com', 'co.uk', 'de', 'org', 'github.io', 'com.au', 'lan'];
const SEPARATORS = ['/', '?', '&', '=', ':', '_', '-', '.', '%2f', '~', ',', ';'];

function generatePattern(rnd) {
    const word = () => rnd.pick(WORDS);
    const host = () => {
        let h = rnd.pick(HOST_LABELS) + '.' + rnd.pick(SUFFIXES);
        if (rnd.chance(0.15)) h = rnd.pick(HOST_LABELS) + '.*';
        if (rnd.chance(0.15)) h = '*.' + h;
        return h;
    };
    let p = '';
    const start = rnd.int(10);
    if (start < 6) p = '||' + host();
    else if (start < 8) p = '|' + rnd.pick(['https://', 'http://', 'https://www.']) + host();
    else p = rnd.chance(0.5) ? word() : '*' + word();
    const parts = 1 + rnd.int(4);
    for (let i = 0; i < parts; i++) {
        const k = rnd.int(10);
        if (k < 3) p += '^';
        else if (k < 5) p += '/';
        else if (k < 6) p += '*';
        else if (k < 7) p += rnd.pick(['?', '=', '&', '_', '-', '.', ':8080']);
        p += word();
    }
    const tail = rnd.int(10);
    if (tail < 3) p += '^';
    else if (tail < 4) p += '|';
    else if (tail < 5) p += '/';
    else if (tail < 6) p += '*';
    return p;
}

// A URL that pattern `p` may well match, with its wildcards and separators
// filled in at random.
function urlFromPattern(p, rnd) {
    let body = p;
    let scheme = rnd.pick(['https://', 'http://']);
    let prefix;
    if (body.startsWith('||')) {
        body = body.slice(2);
        if (body.startsWith('*.')) body = rnd.pick(['', 'www.', 'a.b.']) + body.slice(2);
        prefix = scheme + rnd.pick(['', '', 'www.', 'm.', 'user:pw@', 'user@x.']);
    } else if (body.startsWith('|')) {
        body = body.slice(1);
        prefix = '';
    } else {
        prefix = scheme + rnd.pick(['example.com', 'shop.example.org', 'news.example']) + rnd.pick(['/', '/p/', '/?q=']);
    }
    body = body.replace(/\|$/, '');
    let out = '';
    for (const ch of body) {
        if (ch === '*') out += rnd.pick(['', 'x', 'xx/yy', 'a.b', '-', 'q=1&', 'zz', '/']);
        else if (ch === '^') out += rnd.pick(['/', '/', '?', '&', ':', '=', ',', '']);
        else out += ch;
    }
    out = out.replace(/\.\*(?=[/?#:]|$)/, '.' + rnd.pick(['com', 'co.uk', 'de', 'com.au']));
    let url = prefix + out;
    if (!/^[a-z]+:\/\//i.test(url)) url = 'https://example.com/' + url;
    return url;
}

// Changes a URL in ways a real request can look.
function bend(url, rnd) {
    let u = url;
    const k = rnd.int(14);
    let parsed = null;
    try { parsed = new URL(u); } catch (_) { return u; }
    const pathStart = u.indexOf('/', u.indexOf('//') + 2);
    switch (k) {
        case 0: // glue a letter in front of a path word: /foo/ -> /xfoo/
            return u.replace(/\/([a-z0-9])/i, (m, c) => '/' + rnd.pick(['x', 'q', '9']) + c);
        case 1: // glue a letter after a word
            return u.replace(/([a-z0-9])([/?&=^]|$)/i, (m, c, s) => c + rnd.pick(['x', '1', 'z']) + s);
        case 2: // extra path segment in front
            return pathStart === -1 ? u + '/a/' : u.slice(0, pathStart) + rnd.pick(['/a', '/x/y', '/go']) + u.slice(pathStart);
        case 3: return u.toUpperCase().replace(/^HTTPS?/, s => s.toLowerCase());
        case 4: parsed.port = rnd.pick(['8080', '443', '1']); return parsed.href;
        case 5: parsed.hostname = rnd.pick(['www.', 'a.', 'xn--bcher-kva.']) + parsed.hostname; return parsed.href;
        case 6: parsed.hostname = parsed.hostname + '.'; return parsed.href;
        case 7: return u + rnd.pick(['?utm_source=a', '#frag', '?a=1&b=2', '&x']);
        case 8: return u.replace(/\//g, (m, i) => (i > 8 && rnd.chance(0.3) ? '%2F' : m));
        case 9: parsed.username = 'u'; return parsed.href;
        case 10: return u.replace(/[a-z]/, c => c + 'é');
        case 11: return u.replace(/\.([a-z]+)(?=[/:?#]|$)/, '.$1' + rnd.pick(['x', 'munity', '.evil']));
        case 12: return u + rnd.pick(['/', '//', '/./x', '/../y']);
        default: return u;
    }
}

async function main() {
    const addon = await loadAddon({ storage: consentStorage() });
    const run = code => vm.runInContext(code, addon);
    const matches = run('matchDomainPattern');
    const mayMatch = run('linkumoriUrlPatternMayMatch');
    const rnd = makeRandom(0x5eed1234);

    const patterns = bundledPatterns();
    const bundledCount = patterns.length;
    // Shapes that broke the shortcut before (when the suffix-list path
    // matched the part after the host anywhere in the path), kept as fixed cases.
    patterns.push('||example.com^foo/', '||example.com^foo^', '||example.com/go^', '||ex*.com^foo/', '||example.com^foo|');
    for (let i = 0; i < GENERATED_PATTERNS; i++) patterns.push(generatePattern(rnd));

    const cases = [];
    for (const p of patterns) {
        for (let i = 0; i < URLS_PER_PATTERN; i++) {
            let url = urlFromPattern(p, rnd);
            const bends = rnd.int(3);
            for (let b = 0; b < bends; b++) url = bend(url, rnd);
            cases.push([p, url]);
        }
    }
    // The fixed shapes against the URLs that broke them.
    cases.push(['||example.com^foo/', 'https://example.com/xfoo/'], ['||example.com^foo^', 'https://example.com/a/xfoo/']);

    const failures = [];
    let checked = 0, matched = 0;
    const answers = [];
    for (const psl of ['ready', 'not loaded']) {
        if (psl !== 'ready') run("pslSupport.status = 'failed'; pslSupport.parser = null; pslSupport.service = null; LinkumoriUrlPatterns.clearCaches(); matchDomainPatternLastUrl = null;");
        cases.forEach(([p, url], i) => {
            checked++;
            let m;
            try { m = matches(url, [p]); } catch (_) { m = false; }
            if (psl === 'ready') answers[i] = m;
            else if (answers[i] !== m) failures.push(`[psl] answer changes when the Public Suffix List is not loaded: pattern ${p}\n    url ${url}`);
            if (!m) return;
            matched++;
            if (!mayMatch(p, [url])) failures.push(`[psl ${psl}] pattern ${p}\n    url ${url}`);
        });
    }

    // Safety net: make the shortcut wrong on purpose (it asks for a word no
    // URL has) and check that a matching rule still applies and the
    // shortcut turns itself off.
    const net = await loadAddon({ storage: consentStorage() });
    const call = (name, ...params) => vm.runInContext(`(json) => ${name}(...JSON.parse(json))`, net)(JSON.stringify(params));
    vm.runInContext('getLinkumoriUrlPatternTokens = () => [0x7fffffff];', net);
    call('setData', 'globalStatus', true);
    call('applyRegressionRuleData', { providers: { ex: {
        urlPattern: '^https?:\\/\\/(?:[a-z0-9-]+\\.)*?example\\.com', indexPattern: '||example.com^',
        rules: ['||example.com^foo/$removeparam=utm_source']
    } } });
    const pslReady = vm.runInContext("pslSupport.status === 'ready'", net);
    const result = await call('traceClearURLWebRequestTest', { url: 'https://example.com/foo/?utm_source=a&id=1', type: 'main_frame' });
    const state = vm.runInContext("typeof linkumoriUrlShortcut === 'object' ? linkumoriUrlShortcut : null", net);
    if (!state) failures.push('safety net: linkumoriUrlShortcut is missing');
    else if (!pslReady) failures.push('safety net: the Public Suffix List did not load, so the check could not run');
    else {
        if (result.output !== 'https://example.com/foo/?id=1') failures.push(`safety net: rule did not apply, got ${result.output}`);
        if (state.enabled !== false || !state.disabledBy) failures.push('safety net: the shortcut did not turn itself off');
    }

    for (const f of failures.slice(0, MAX_FAILURES_SHOWN)) console.log('FAIL ' + f);
    if (failures.length > MAX_FAILURES_SHOWN) console.log(`... and ${failures.length - MAX_FAILURES_SHOWN} more`);
    console.log(`\nURL shortcut: ${patterns.length} patterns (${bundledCount} bundled), ${checked} checks, ` +
        `${matched} matches, ${failures.length} failed; safety net ${failures.some(f => f.startsWith('safety')) ? 'FAILED' : 'ok'}`);
    return failures.length > 0 ? 1 : 0;
}

main().then(code => process.exit(code), error => {
    console.error(error && error.stack || error);
    process.exit(2);
});
