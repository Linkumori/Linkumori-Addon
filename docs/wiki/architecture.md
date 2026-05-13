# Architecture Overview

## Product Shape

Linkumori is a local-only URL-cleaning extension for Firefox Manifest V3. Its main jobs are:

- remove tracking parameters
- unwrap or redirect tracking links
- block ping-style hyperlink auditing
- mutate ETags
- sanitize History API URL updates
- optionally replay requests through CNAME uncloaking checks
- expose rich user control through whitelists and custom rules

The extension does this without telemetry and without a server dependency for normal operation.

## Runtime Topology

The background script bundle is declared in `manifest.json` and loaded in a deliberate order:

- shared utilities and i18n
- message handling
- parsing support and helper libraries
- cleaning engine pieces
- provider engine
- DNS/whitelist/runtime storage
- optional feature listeners

The important implication is that many modules communicate through globals rather than ES module imports. For example:

- `storage`
- `isWhitelisted`
- `pushToLog`
- `LinkumoriURLFilterInteroperability`
- `LinkumoriDNS`
- `startLinkumoriURLFilterRuntime`

The wiki treats those globals as part of the internal extension API.

## Core Subsystems

### 1. Provider Engine

Owned primarily by:

- `clearurls.js`
- `core_js/pureCleaning.js`

This is the ClearURLs-derived engine enhanced for Linkumori. Providers define:

- target URL patterns
- removal rules
- raw whole-URL rules
- exceptions
- redirect behavior
- request method and resource-type scope

At runtime, providers are not scanned naively. They are pre-indexed by hostname-like tokens into:

- `providersByToken`
- `globalProviders`

The request flow gathers likely providers from the host tokens first, then fully matches only that reduced candidate set.

### 2. Removeparam Interoperability Engine

Owned by:

- `core_js/linkumori_url_filter_interoperability.js`
- `core_js/linkumori_url_filter_runtime.js`
- `core_js/linkumori_filtering_context.js`

This path accepts a focused uBlock/AdGuard-style subset:

- `$removeparam`
- `$queryprune`

It parses those rules into structured objects, prepares them for fast matching, and compiles them into runtime buckets and indexes.

The key data structures are:

- reverse token index
- literal parameter buckets
- regex buckets
- domain tries
- cached request match contexts

### 3. Rules and Storage Manager

Owned by:

- `core_js/storage.js`

This is the largest coordination layer in the repo. It manages:

- settings initialization
- consent-aware startup
- bundled rule loading
- remote rule configuration and verification
- custom-rule merging
- rule disabling and exclusions
- whitelist persistence
- temporary pause state
- health/status data for UI screens

It is not just a storage helper. It is effectively the extension's rule orchestration service.

### 4. Privacy/Safety Features

Owned by:

- `core_js/whitelist.js`
- `core_js/eTagFilter.js`
- `core_js/historyListener.js`
- `core_js/linkumori_dns.js`
- `core_js/content_script_manager.js`

Responsibilities:

- permanent and tab-local whitelists
- ETag replacement
- History API URL cleaning
- CNAME alias replay
- Google/Yandex search-link rewrite fix registration

All of these features are routed through the same central ideas:

- global enablement
- temporary pause awareness
- whitelist respect
- local execution

## Data Flow

At a high level:

1. `storage.js` initializes persisted state and bundled/remote/custom rules.
2. The provider engine rebuilds from `ClearURLsData`.
3. The removeparam runtime rebuilds from `LinkumoriURLsData`.
4. Network requests enter the `onBeforeRequest` listener in `clearurls.js`.
5. Provider cleaning runs first.
6. If no decisive result is returned, optional CNAME replay may run.
7. Parallel feature listeners handle ETags and History API changes.
8. UI surfaces read status and invoke actions through `message_handler.js`.

## Architectural Strengths

- **Compiled matching instead of broad scans**
- **Clear split between provider-style rules and removeparam interoperability**
- **Centralized storage/rule management**
- **Whitelisting applied consistently across multiple cleaning paths**
- **Good operational visibility through logger and audit views**

## Architectural Tradeoffs

- Heavy reliance on globals makes load order important.
- `storage.js` is powerful but large, so changes there have broad blast radius.
- The UI layer is feature-rich and correspondingly dense, especially `popup.js` and `custom_rules_editor.js`.
- There are two cleaning models in play, which is flexible but requires careful coordination.

