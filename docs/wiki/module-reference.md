# Module Reference

This page is a codebase map. It groups files by responsibility and summarizes what each file owns.

## Root Runtime

### `manifest.json`

- Declares MV3 extension metadata
- Lists permissions and host permissions
- Defines background script load order
- Wires popup and options surfaces

### `clearurls.js`

- Main request interception engine
- Provider compilation and indexing
- Pattern matching, redirects, cancellation behavior
- Cross-context exception gathering
- Request-context tracking for frames/tabs
- Entry point for CNAME replay fallback

## Core Engine Modules

### `core_js/pureCleaning.js`

- Non-webRequest cleaning path
- Batch/manual cleaning support
- Rule test lab tracing and diagnostics
- Reusable cleanup flow for history updates and UI tools

### `core_js/linkumori_url_filter_interoperability.js`

- Parser for `$removeparam` and `$queryprune`
- Modifier parsing, domain parsing, regex-literal support
- Rule normalization and preparation
- Target/request matching support

### `core_js/linkumori_url_filter_runtime.js`

- Compiled runtime for Linkumori URL filter rules
- Reverse indexes and literal buckets
- Domain tries
- Trie snapshot persistence
- Request token collection and candidate planning
- Final query reconstruction

### `core_js/linkumori_filtering_context.js`

- Per-request normalized context
- Fast method/resource-type bit support
- Source host extraction
- Registrable-domain caching

### `core_js/linkumori_hntrie.js`

- Hostname trie
- Reverse-host storage for subdomain-friendly matching
- Packed snapshot format
- Optional compressed serialization

### `core_js/linkumori_biditrie.js`

- Token trie used for textual token discovery
- Exact-token map plus packed representation
- Supports extracting preselected tokens from parameter text

## Storage And Configuration

### `core_js/storage.js`

- Central settings and rule orchestration
- Bundled data loading
- Remote source configuration and verification
- Custom rule merging
- Linkumori URL filter loading
- Startup consent handling
- Whitelist persistence helpers
- Temporary pause state
- Runtime refresh hooks

### `core_js/message_handler.js`

- Background RPC layer for UI pages
- Get/set data
- Reload or merge custom rules
- Return bundled/current rule snapshots
- Expose stats to editor and diagnostics views

### `core_js/tools.js`

- Shared helpers
- Translation wrapper
- counters and badge helpers
- URL helpers
- SHA-256 helper wrapper
- logging broadcast helpers
- keepalive timer

## Privacy, Safety, And Request Adjuncts

### `core_js/whitelist.js`

- Permanent whitelist evaluation
- Temporary tab whitelist storage
- PSL-aware wildcard matching
- Context-aware whitelist checks

### `core_js/eTagFilter.js`

- Response-header listener
- ETag mutation
- Logging integration
- Whitelist and pause awareness

### `core_js/historyListener.js`

- SPA/History API cleanup
- `webNavigation` listener
- injected `history.replaceState`
- whitelist and pause awareness

### `core_js/linkumori_dns.js`

- CNAME uncloaking support
- DNS cache and TTL management
- canonical-name lookup
- replay-based alias filtering
- safe hostname restoration

### `core_js/content_script_manager.js`

- Managed registration for optional search-result rewrite fix scripts
- Google/Yandex content script lifecycle

### `core_js/google_link_fix.js`

- Search-result link repair for Google pages

### `core_js/yandex_link_fix.js`

- Search-result link repair for Yandex pages

## UI Modules

### `core_js/popup.js`

- Popup state hydration
- global enablement toggles
- whitelist controls
- statistics rendering
- consent-gate UI
- temporary pause UI
- navigation into logger/settings/license views

### `core_js/settings.js`

- Settings page controls
- remote source setup
- visual preferences
- rule-related option persistence

### `core_js/custom_rules_editor.js`

- Full custom provider editor
- Linkumori URL custom-rule modal
- import/export
- disabled provider/rule management
- whitelist management panel
- rule test lab UI
- provider duplication/edit/delete
- source inspection and import selection

### `core_js/log.js`

- Rich logger view
- statistics panels and chart rendering
- live stream connection
- filtering, sorting, detail panes
- import/export of logs

### `core_js/audit.js`

- Rule source inspection UI
- bundled/final/custom/remote source comparison
- metadata display

### `core_js/cleaning_tool.js`

- Manual batch URL cleaning page
- copy-to-clipboard and theme support

### `core_js/context_menu.js`

- Context-menu entry setup
- clean/copy workflows from page interactions

### `core_js/siteBlockedAlert.js`

- Block-page behavior and user messaging

### `core_js/about.js`

- About/legal supporting UI behavior

### `core_js/modal_dialog.js`

- Shared modal logic for page UIs

### `core_js/clipboard-helper.js`

- Clipboard abstraction used by tool surfaces

### `core_js/write_version.js`

- Version display plumbing for UI

### `core_js/consent_config.js`

- Popup consent configuration data

### `core_js/watchdog.js`

- Background health/watchdog support

## External Libraries And Helpers

### `external_js/linkumori_lz4_block.js`

- Custom LZ4 block wrapper
- Compress/decompress helpers
- Used for bundled rules and trie snapshots

### `external_js/publicsuffixlist.js`

- Public suffix service wrapper
- Registrable-domain logic support

### `external_js/regex_analyzer.js`

- Regex token analysis helpers
- Supports best-token extraction for indexing

### `external_js/sha256.js`

- Hash support for rule verification

### `external_js/decode-uri-component.js`

- Safer URL component decoding helper

### `external_js/light-punycode.js`

- Hostname IDN normalization support

### `external_js/IP-Ranger.js`

- IP/local-network helper support

### `external_js/linkumori-i18n.js`

- Extension i18n helper wrapper

### `external_js/theme_bootstrap.js`

- Theme initialization helper

### `external_js/theme_favicon.js`

- Theme-specific favicon support

### `external_js/linkumori-pickr.js`

- Color picker dependency for settings/customization

### `external_js/marked.js`

- Markdown rendering support where used in UI/legal views

## HTML Surfaces

- `html/popup.html`
- `html/settings.html`
- `html/customrules.html`
- `html/log.html`
- `html/audit.html`
- `html/cleaningTool.html`
- `html/legal.html`
- `html/siteBlockedAlert.html`

These pages are thin DOM shells around the corresponding `core_js/*.js` modules.

## CSS And Assets

- `css/settings.css`
- `css/siteBlockedAlert.css`
- `css/linkumori-pickr.min.css`
- `img/`
- `svg/`
- `LinkumorI_HTML_SVG/`

These are mostly UI-facing, with icon assets reused across popup, settings, and editor surfaces.

## Scripts And Tooling

### `linkumori-cli-tool.js`

- Interactive repo utility entry point

### `scripts/git-workflow.js`

- Workflow automation around repository operations

### `scripts/update-changelog-from-commits.js`

- Changelog generation support

### `scripts/sync-i18n-extra.js`

- Locale synchronization helper

### `scripts/amo-upload.js`

- Add-ons distribution helper

### `scripts/pull-origin.js`

- Upstream/source synchronization helper

## Data Files

- compressed bundled rules
- official rule snapshots
- custom rule state
- privacy policy mappings
- public suffix data
- URL configuration

See [Rules, Storage, and Data](./rules-storage-data.md) for their runtime roles.

## Docs Already Present In The Repo

- `README.MD`
- `SECURITY.md`
- `Permissions.md`
- `privacy.md`
- `CONTRIBUTING.md`
- `CHANGELOG.md`

The wiki complements these rather than replacing them.
