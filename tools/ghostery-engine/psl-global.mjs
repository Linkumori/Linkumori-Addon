// Stands in for 'tldts-experimental' inside the Ghostery bundle. Linkumori
// does not ship tldts: hostnames and public suffixes come from
// external_js/publicsuffixlist.js (globalThis.linkumoriPsl), the same
// Public Suffix List the rest of the add-on uses. That file must be loaded
// before external_js/linkumori-ghostery-engine.js.
//
// Returns the fields of a tldts parse() result that @ghostery/adblocker and
// core_js/linkumori_url_patterns.js read: hostname, domain, publicSuffix.
// The hostname is extracted even while the list is still loading, so URL
// patterns match from the start; domain and publicSuffix stay null until
// the list is ready.
const EMPTY = Object.freeze({ hostname: null, domain: null, publicSuffix: null, subdomain: null, isIp: false });

export function parse(input, options = {}) {
    const psl = globalThis.linkumoriPsl;
    if (!psl || typeof psl.normalizeHostname !== 'function') {
        throw new Error('linkumoriPsl is not loaded (external_js/publicsuffixlist.js)');
    }
    const extracted = options.extractHostname === false
        ? String(input || '')
        : psl.extractHostnameFromInput(input, options.mixedInputs !== false);
    // Like tldts, drop every trailing dot ("tv.apple.com.." is tv.apple.com);
    // normalizeHostname() drops only one.
    const hostname = extracted ? psl.normalizeHostname(String(extracted).replace(/\.+$/, '')) : null;
    if (!hostname) return EMPTY;
    if (psl.isIp(hostname)) {
        return { hostname, domain: null, publicSuffix: null, subdomain: null, isIp: true };
    }
    const parsed = psl.status === 'ready' ? psl.parseNormalizedHostname(hostname) : null;
    if (!parsed || !parsed.listed) {
        return { hostname, domain: null, publicSuffix: null, subdomain: null, isIp: false };
    }
    return {
        hostname,
        domain: parsed.domain || null,
        publicSuffix: parsed.tld || null,
        subdomain: parsed.subdomain || null,
        isIp: false
    };
}
