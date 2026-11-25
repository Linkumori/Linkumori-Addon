# Ghostery URL pattern engine

`external_js/linkumori-ghostery-engine.js` is built here from
[`@ghostery/adblocker`](https://github.com/ghostery/adblocker) (MPL-2.0) and
[`tldts-experimental`](https://github.com/remusao/tldts) (MIT). Linkumori uses
it for every URL pattern (`domainPatterns`, and the pattern in front of
`$removeparam`, exceptions and redirections): see
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
