// Stand-in for the WebExtension APIs so html/popup.html can render outside the extension
// for product screenshots. Theme comes from ?theme=light|dark.
(function () {
  const params = new URLSearchParams(location.search);
  const theme = params.get('theme') === 'dark' ? 'dark' : 'light';
  try { localStorage.setItem('linkumori-theme', theme); } catch (e) { /* ignore */ }

  const store = {
    'linkumori-theme': theme,
    popupConsentAccepted: true,
    popupConsentPolicyVersionAccepted: 12,
    popupConsentPOSARVersionAccepted: 2,
    popupConsentAdultAccepted: true,
    popupConsentPolicySignatureAccepted: ''
  };
  const data = {
    globalStatus: true,
    badgedStatus: true,
    loggingStatus: false,
    statisticsStatus: true,
    hashStatus: true,
    totalCounter: 18342,
    cleanedCounter: 4127,
    getCurrentURL: 'https://www.amazon.com/dp/B0EXAMPLE',
    userWhitelist: [],
    historyApiWhitelist: [],
    ClearURLsData: { providers: {} }
  };
  const noop = () => {};
  const event = { addListener: noop, removeListener: noop, hasListener: () => false };
  const pick = (keys) => {
    if (keys == null) return { ...store };
    if (typeof keys === 'string') keys = [keys];
    if (Array.isArray(keys)) return Object.fromEntries(keys.filter(k => k in store).map(k => [k, store[k]]));
    return Object.fromEntries(Object.keys(keys).map(k => [k, k in store ? store[k] : keys[k]]));
  };
  const area = {
    get: async (keys) => pick(keys),
    set: async (obj) => { Object.assign(store, obj); },
    remove: async () => {},
    onChanged: event
  };

  const responses = {
    getData: (p) => ({ response: data[p[0]] }),
    getTemporaryTabWhitelistForTab: () => ({ response: [] }),
    getTemporaryPauseState: () => ({ response: { isPaused: false, mode: 'none', until: null, remainingMs: 0 } })
  };

  window.browser = {
    runtime: {
      id: 'linkumori-addon-official@ClearURLs',
      getURL: (p) => '/' + String(p).replace(/^\//, ''),
      getManifest: () => ({ version: '100.66.0', name: 'ClearURLs(Linkumori)' }),
      sendMessage: async (msg) => (responses[msg && msg.function] || (() => ({ response: true })))(msg.params || []),
      onMessage: event,
      connect: () => ({ onMessage: event, onDisconnect: event, postMessage: noop, disconnect: noop })
    },
    storage: { local: area, sync: area, onChanged: event },
    tabs: {
      query: async () => [{ id: 1, active: true, url: 'https://www.amazon.com/dp/B0EXAMPLE' }],
      create: async () => ({}),
      update: async () => ({})
    },
    windows: { update: async () => ({}) },
    i18n: { getUILanguage: () => 'en', getMessage: () => '' }
  };
  window.chrome = window.browser;
})();
