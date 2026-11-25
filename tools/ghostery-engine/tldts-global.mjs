// Stands in for 'tldts-experimental' inside the Ghostery bundle: the parser
// itself ships separately in external_js/linkumori-tldts.js (MIT), which
// must be loaded first and exposes globalThis.LinkumoriTldts.
export function parse(url, options) {
    const tldts = globalThis.LinkumoriTldts;
    if (!tldts || typeof tldts.parse !== 'function') {
        throw new Error('LinkumoriTldts is not loaded (external_js/linkumori-tldts.js)');
    }
    return tldts.parse(url, options);
}
