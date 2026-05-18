# Rules, Storage, and Data

## Rule Families

Linkumori maintains two major rule universes.

### 1. `ClearURLsData`

Provider-oriented structure used by the legacy/main cleaning engine.

Typical provider fields:

- `urlPattern`
- `domainPatterns`
- `rules`
- `rawRules`
- `referralMarketing`
- `exceptions`
- `domainExceptions`
- `redirections`
- `domainRedirections`
- `methods`
- `resourceTypes`

`rules` is now the canonical Linkumori authoring array. It accepts:

- compact string removals such as `"utm_source"`
- native advanced objects such as `{ "field": "session", "rewrite": "clean" }`
- native raw objects such as `{ "raw": "...", "rewrite": "..." }`
- native redirect objects such as `{ "url": "...", "redirect": "§1§" }`

Legacy `rawRules`, `referralMarketing`, and `redirections` still load for compatibility, but new advanced authoring should stay inside `rules` so one provider has one behavioral rule stream.

This path powers the long-standing ClearURLs-style behavior and Linkumori's extended provider editing model.

### 2. `ClearURLsData.urlFilterRules`

Filter-list-style rule lines stored inside the unified `ClearURLsData` container and used by the interoperability runtime.

Supported syntax is intentionally narrow:

- `$removeparam`
- `$queryprune`

This path is parsed by `linkumori_url_filter_interoperability.js` and executed by `linkumori_url_filter_runtime.js`.

## Bundled Data Assets

Important files under `data/`:

- `linkumori-clearurls-min.json.lz4`
  - compressed bundled provider rules
- `downloaded-official-rules.json`
  - reference rule payload
- `downloaded-official-rules.min.hash`
  - integrity material
- `custom-rules.json`
  - editable custom provider/rule storage
- `public_suffix_list.dat`
  - hostname/TLD correctness support
- `privacy-policy-map.json`
  - privacy/legal UI data
- `url-config.json`
  - URL-related configuration

## Bundled Rule Loading

`storage.js` loads bundled rules through:

1. `browser.runtime.getURL(...)`
2. fetch compressed bytes
3. LZ4 decompression via `external_js/linkumori_lz4_block.js`
4. JSON validation
5. normalization into internal rule structures

This reduces shipped asset size and keeps the bundled ruleset compact.

## Remote Rule Sources

`storage.js` supports:

- one or more configured remote provider sources
- one or more Linkumori URL filter sources
- optional hash verification
- health tracking for UI diagnostics
- fallback to cached or bundled data

The remote flow records:

- fetch attempt time
- success time
- hash verification time
- failure stage and reason
- source URLs used

## Custom Rules

The custom rules system supports:

- local provider editing
- import/export
- merge into active data
- disabling imported providers by signature
- Linkumori removeparam custom rules
- disabled rule tracking
- native advanced-rule template insertion in the editor
- ClearURLs v2 import normalization into Linkumori-native rules

Native advanced rules may carry `id`, `aliases`, and `description`. `id` is not
required for execution, but it enables durable rule lifecycle state:

- `clearurls_disabled_rule_ids` stores disabled native-rule ids
- a bare id disables matching rules globally
- `provider/id` disables one provider's rule
- `aliases` keep older disable choices valid after a rule rename

Most of that orchestration lives in:

- `core_js/storage.js`
- `core_js/custom_rules_editor.js`
- `core_js/message_handler.js`

## Merge Strategy

There are several merge layers:

1. bundled providers
2. optional remote providers
3. custom providers
4. optional Linkumori URL filter sources
5. local Linkumori URL custom rules

`storage.js` keeps metadata about:

- source counts
- unsupported/skipped rules
- duplicate rules
- failed sources
- final status

This makes the system debuggable instead of opaque.

## Whitelist Data

Permanent whitelist:

- persisted in `storage.userWhitelist`

Temporary whitelist:

- `Map<tabId, Set<domain>>`
- in-memory only
- cleared on tab close or restart

Matching supports:

- exact hostnames
- subdomain-style wildcard matching
- `example.*`
- `*.example.*`
- PSL-aware matching when the public suffix service is ready

## Temporary Pause

`storage.js` supports:

- timed pause
- pause until browser restart
- resume now

The state is reused across:

- request cleaning
- ETag filtering
- history cleaning

## Consent-Aware Startup

`storage.js` contains startup gating tied to popup consent policy state.

This influences when cleaning engines start, and is part of why initialization logic in `storage.js` is more involved than a simple "load defaults" routine.

## Message Boundary

`core_js/message_handler.js` is the control-plane bridge between UI pages and the background logic.

It handles tasks like:

- read storage
- write storage
- reload custom rules
- merge custom rules
- request bundled/current rule views
- return rule statistics

That keeps UI modules from mutating the rule engine directly.
