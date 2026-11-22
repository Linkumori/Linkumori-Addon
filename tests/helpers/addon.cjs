'use strict';
// Loads the add-on's background scripts into a Node `vm` context with a fake
// WebExtension `browser` API, so the cleaning core can run without a browser.
//
// Scripts are read from manifest.json in their real load order. Every
// browser API the scripts touch at load time is answered by a recording
// stub: event listeners are kept (but never fired), storage lives in memory,
// and fetch() of an extension URL reads the file from the repository.

const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');

const ROOT = path.resolve(__dirname, '..', '..');
const EXTENSION_ORIGIN = 'moz-extension://linkumori-test/';

// A function that also answers any property: `stub.anything.deeper()` works
// and resolves to undefined. Used for APIs no test inspects.
function makeStub(name) {
    const target = function () { return Promise.resolve(undefined); };
    return new Proxy(target, {
        get(obj, prop) {
            if (prop === 'then') return undefined; // never look like a Promise
            if (prop === Symbol.toPrimitive) return () => `[stub ${name}]`;
            if (!(prop in obj)) obj[prop] = makeStub(`${name}.${String(prop)}`);
            return obj[prop];
        },
        apply() { return Promise.resolve(undefined); }
    });
}

function makeEvent() {
    const listeners = new Set();
    return {
        addListener: fn => { listeners.add(fn); },
        removeListener: fn => { listeners.delete(fn); },
        hasListener: fn => listeners.has(fn),
        listeners
    };
}

// Values handed to the add-on are rebuilt with the add-on's own JSON, so
// they inherit from its Object.prototype (which carries getOrDefault).
let realmJSON = JSON;
const toRealm = value => (value === undefined ? undefined : realmJSON.parse(JSON.stringify(value)));

function makeStorageArea(initial = {}) {
    const data = { ...initial };
    const clone = toRealm;
    return {
        data,
        get(keys) {
            if (keys === null || keys === undefined) return Promise.resolve(clone(data));
            const list = typeof keys === 'string' ? [keys] : (Array.isArray(keys) ? keys : Object.keys(keys));
            const out = {};
            for (const key of list) {
                if (key in data) out[key] = clone(data[key]);
                else if (!Array.isArray(keys) && typeof keys === 'object') out[key] = keys[key];
            }
            return Promise.resolve(out);
        },
        set(items) { Object.assign(data, clone(items)); return Promise.resolve(); },
        remove(keys) {
            for (const key of [].concat(keys)) delete data[key];
            return Promise.resolve();
        },
        clear() { for (const key of Object.keys(data)) delete data[key]; return Promise.resolve(); },
        onChanged: makeEvent()
    };
}

function extensionPathFromURL(url) {
    const text = String(url);
    if (text.startsWith(EXTENSION_ORIGIN)) return text.slice(EXTENSION_ORIGIN.length).split(/[?#]/)[0];
    if (!/^[a-z][a-z0-9+.-]*:/i.test(text)) return text.replace(/^\/+/, '').split(/[?#]/)[0];
    return null;
}

function makeResponse(buffer, url) {
    return {
        ok: true,
        status: 200,
        url,
        headers: { get: () => null },
        text: () => Promise.resolve(buffer.toString('utf8')),
        json: () => Promise.resolve(realmJSON.parse(buffer.toString('utf8'))),
        arrayBuffer: () => Promise.resolve(buffer.buffer.slice(buffer.byteOffset, buffer.byteOffset + buffer.byteLength))
    };
}

function makeBrowser(localStorageData) {
    const messages = JSON.parse(fs.readFileSync(path.join(ROOT, '_locales', 'en', 'messages.json'), 'utf8'));
    const getMessage = (key, substitutions) => {
        const entry = messages[key];
        if (!entry) return '';
        const subs = [].concat(substitutions === undefined ? [] : substitutions).map(String);
        return entry.message.replace(/\$(\d+)/g, (_, n) => subs[Number(n) - 1] ?? '');
    };
    const manifest = JSON.parse(fs.readFileSync(path.join(ROOT, 'manifest.json'), 'utf8'));
    const browser = makeStub('browser');
    const events = new Map();
    const eventFor = name => {
        if (!events.has(name)) events.set(name, makeEvent());
        return events.get(name);
    };
    // Namespaces whose onX events are listened to at load time.
    const withEvents = (name, extra = {}) => new Proxy(extra, {
        get(obj, prop) {
            if (prop in obj) return obj[prop];
            if (typeof prop === 'string' && /^on[A-Z]/.test(prop)) return eventFor(`${name}.${prop}`);
            obj[prop] = makeStub(`${name}.${String(prop)}`);
            return obj[prop];
        }
    });
    const real = {
        runtime: withEvents('runtime', {
            id: 'linkumori-test',
            getURL: p => EXTENSION_ORIGIN + String(p).replace(/^\/+/, ''),
            getManifest: () => toRealm(manifest),
            getPlatformInfo: () => Promise.resolve({ os: 'linux', arch: 'x86-64' }),
            getBrowserInfo: () => Promise.resolve({ name: 'Firefox', vendor: 'Mozilla', version: '140.0' }),
            sendMessage: () => Promise.resolve(undefined),
            lastError: null
        }),
        i18n: withEvents('i18n', {
            getMessage,
            getUILanguage: () => 'en',
            getAcceptLanguages: () => Promise.resolve(['en'])
        }),
        storage: withEvents('storage', {
            local: makeStorageArea(localStorageData),
            session: makeStorageArea(),
            sync: makeStorageArea(),
            managed: makeStorageArea()
        }),
        tabs: withEvents('tabs', {
            query: () => Promise.resolve([]),
            get: () => Promise.reject(new Error('no tabs in the Node harness'))
        }),
        webRequest: withEvents('webRequest'),
        webNavigation: withEvents('webNavigation'),
        contextMenus: withEvents('contextMenus'),
        menus: withEvents('menus'),
        commands: withEvents('commands'),
        alarms: withEvents('alarms'),
        action: withEvents('action'),
        browserAction: withEvents('browserAction'),
        permissions: withEvents('permissions', { contains: () => Promise.resolve(false) }),
        downloads: withEvents('downloads'),
        dns: withEvents('dns', { resolve: () => Promise.reject(new Error('no DNS in the Node harness')) }),
        scripting: withEvents('scripting'),
        idle: withEvents('idle')
    };
    return new Proxy(browser, {
        get(obj, prop) { return prop in real ? real[prop] : obj[prop]; }
    });
}

/**
 * Load the add-on and wait until its rules are ready.
 * Returns the vm context (the add-on's global scope).
 */
async function loadAddon({ storage = {}, quiet = true } = {}) {
    const manifest = JSON.parse(fs.readFileSync(path.join(ROOT, 'manifest.json'), 'utf8'));
    const browser = makeBrowser(storage);
    const silent = () => {};
    const sandboxConsole = quiet
        ? { log: silent, info: silent, debug: silent, warn: silent, error: silent, trace: silent, group: silent, groupEnd: silent, groupCollapsed: silent, table: silent, time: silent, timeEnd: silent }
        : console;
    const context = {
        browser,
        chrome: browser,
        console: sandboxConsole,
        URL, URLSearchParams, TextEncoder, TextDecoder, AbortController, Blob,
        atob, btoa, queueMicrotask,
        setTimeout, clearTimeout, setInterval, clearInterval,
        crypto: globalThis.crypto,
        performance: globalThis.performance,
        navigator: { userAgent: 'Mozilla/5.0 (X11; Linux x86_64; rv:140.0) Gecko/20100101 Firefox/140.0', language: 'en', languages: ['en'], onLine: false },
        fetch: async (url) => {
            const rel = extensionPathFromURL(url);
            if (rel === null) throw new TypeError(`network access is disabled in the Node harness: ${url}`);
            return makeResponse(fs.readFileSync(path.join(ROOT, rel)), String(url));
        }
    };
    // Firefox runs background scripts in a page, so a few scripts look at
    // `document` at load time. Nothing is ever rendered.
    const element = () => makeStub('element');
    context.document = {
        readyState: 'complete',
        documentElement: element(),
        head: element(),
        body: element(),
        addEventListener: () => {},
        removeEventListener: () => {},
        createElement: element,
        createTextNode: element,
        getElementById: () => null,
        querySelector: () => null,
        querySelectorAll: () => []
    };
    context.addEventListener = () => {};
    context.removeEventListener = () => {};
    context.globalThis = context;
    context.self = context;
    context.window = undefined;
    vm.createContext(context);
    realmJSON = vm.runInContext('JSON', context);
    context.structuredClone = toRealm;

    for (const script of manifest.background.scripts) {
        const file = path.join(ROOT, script);
        vm.runInContext(fs.readFileSync(file, 'utf8'), context, { filename: file });
    }

    await waitFor(() => vm.runInContext(
        "typeof isCleaningStarted === 'function' && isCleaningStarted()", context), 'the cleaning core to start');
    return context;
}

async function waitFor(check, what, timeoutMs = 15000) {
    const started = Date.now();
    while (!check()) {
        if (Date.now() - started > timeoutMs) throw new Error(`timed out waiting for ${what}`);
        await new Promise(resolve => setTimeout(resolve, 10));
    }
}

module.exports = { ROOT, loadAddon, waitFor };
