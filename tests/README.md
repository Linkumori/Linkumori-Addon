# Tests

`regression-suite.json` holds URL cleaning cases. Each case gives the rules
to load, an input URL and the URL expected after cleaning (or
`"expectedBlocked": true` when the request should be blocked).

## Run in Node (no browser)

```sh
npm test                                      # or: bun run test
node tests/run-regression-suite.cjs fragment  # only cases whose id contains "fragment"
node tests/run-regression-suite.cjs -v        # also list passing cases
```

`helpers/addon.cjs` loads the background scripts listed in `manifest.json`,
in order, into a Node `vm` context with a fake `browser` API (in-memory
storage, no network, no tabs). The runner then does what
`html/regression.html` does for each case: it loads the case's rules with
`applyRegressionRuleData`, applies its `storage`, and cleans the input with
`runRuleTestLab` (`provider` cases) or `traceClearURLWebRequestTest`
(`providerWebRequest` cases).

Differences from the browser page:

- No page is loaded. A case that expects the blocked page passes when
  cleaning cancels the request.
- A case's `preferences` are applied for that case, so no case is skipped
  because of your own settings. Built-in rules, remote rules and referral
  marketing stay off, as on the browser page.
- First-run consent is accepted in the harness's in-memory storage only.

The command exits with 1 when any case fails.

## URL shortcut check

`run-url-shortcut-check.cjs` checks the `$removeparam` URL token shortcut
against `matchDomainPattern()`, the full check it stands in for. It uses the
bundled patterns and a few thousand generated ones, with URLs bent to break
the shortcut (words glued to letters, extra path segments, ports, case,
user info, percent-encoding), with the Public Suffix List loaded and not
loaded. It fails on any URL the full check matches but the shortcut would
skip, and checks that the safety net (`linkumoriUrlShortcut`) turns the
shortcut off when it is wrong.

```sh
node tests/run-url-shortcut-check.cjs         # a few seconds
node tests/run-url-shortcut-check.cjs --big   # 5x the generated patterns
```

`npm test` runs both scripts.

## Run in the browser

Open `html/regression.html` from the loaded add-on. It also loads each input
URL in a background tab, which the Node runner cannot do.
