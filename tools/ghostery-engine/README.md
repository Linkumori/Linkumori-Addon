# Ghostery URL pattern engine

`external_js/linkumori-ghostery-engine.js` (MPL-2.0 OR LGPL-3.0-or-later) is
built here from [`@ghostery/adblocker`](https://github.com/ghostery/adblocker)
`NetworkFilter` and `Request`, their `@remusao/*` dependencies, and
Linkumori's glue (`entry.mjs`, `psl-global.mjs`).

tldts is not bundled. Ghostery's import of `tldts-experimental` is replaced by
`psl-global.mjs`, which gets hostnames and public suffixes from
`external_js/publicsuffixlist.js` (`globalThis.linkumoriPsl`), the Public
Suffix List the rest of the add-on uses. Any other tldts import fails the
build. `publicsuffixlist.js` must be loaded before the engine (see
`manifest.json`). Hostnames are extracted even before the list has loaded;
the domain and public suffix are null until it is ready.

Linkumori uses the engine for every URL pattern (`domainPatterns`, and the
pattern in front of `$removeparam`, exceptions and redirections): see
`core_js/linkumori_url_patterns.js`.

```sh
cd tools/ghostery-engine
npm ci            # or: npm install, the first time
npm run build     # writes ../../external_js/linkumori-ghostery-engine.js
```

Versions are pinned in `package.json` (and `package-lock.json`), so the
output can be rebuilt and compared with the committed file. To update
Ghostery, change the version, rebuild, and run `npm test` from the repository
root: `tests/run-url-shortcut-check.cjs` checks that the shortcut never skips
a pattern the matcher accepts.
