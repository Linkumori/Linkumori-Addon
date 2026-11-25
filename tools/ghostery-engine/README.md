# Ghostery URL pattern engine

Two files are built here, kept apart by license:

| File | Contents | License |
| --- | --- | --- |
| `external_js/linkumori-ghostery-engine.js` | [`@ghostery/adblocker`](https://github.com/ghostery/adblocker) `NetworkFilter` and `Request`, its `@remusao/*` dependencies, and Linkumori's glue (`entry.mjs`, `tldts-global.mjs`) | MPL-2.0 OR LGPL-3.0-or-later |
| `external_js/linkumori-tldts.js` | [`tldts-experimental`](https://github.com/remusao/tldts) and `tldts-core`, unmodified | MIT |

The Ghostery bundle contains no MIT code: its import of `tldts-experimental`
is replaced by `tldts-global.mjs`, which calls `globalThis.LinkumoriTldts`
from the separate MIT file. The build fails if anything else tries to pull
tldts into the Ghostery bundle. `linkumori-tldts.js` must be loaded before
`linkumori-ghostery-engine.js` (see `manifest.json`).

Linkumori uses the engine for every URL pattern (`domainPatterns`, and the
pattern in front of `$removeparam`, exceptions and redirections): see
`core_js/linkumori_url_patterns.js`.

```sh
cd tools/ghostery-engine
npm ci            # or: npm install, the first time
npm run build     # writes both files into ../../external_js/
```

Versions are pinned in `package.json` (and `package-lock.json`), so the
output can be rebuilt and compared with the committed files. To update
Ghostery, change the version, rebuild, and run `npm test` from the repository
root: `tests/run-url-shortcut-check.cjs` checks that the shortcut never skips
a pattern the matcher accepts.
