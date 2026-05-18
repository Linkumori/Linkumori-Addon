# Runtime Pipeline

## Main Request Path

The main network interception path begins in `clearurls.js`.

### Step 1. Listener Registration

`browser.webRequest.onBeforeRequest` is registered for:

- all URLs
- selected request types from settings
- blocking behavior

The listener:

- tracks tab/frame context
- skips `data:` URLs
- calls `clearUrl(requestDetails)`
- optionally invokes CNAME replay through `LinkumoriDNS`

## Step 2. Fast Global Exits

Before serious work happens, the engine quickly rejects:

- globally disabled operation
- temporary pause mode
- whitelisted URLs
- irrelevant cases for some feature-specific paths

The removeparam runtime adds even more short-circuits:

- non-HTTP(S) URL
- no rules loaded
- no query string

These checks matter because the best optimized rule engine is the one you never invoke.

## Step 3. Provider Candidate Lookup

The provider engine builds candidate sets instead of evaluating all providers.

During provider creation:

- hostname/domain hints are turned into lookup tokens
- indexed providers go into `providersByToken`
- everything that cannot be indexed safely falls back to `globalProviders`

During a request:

- hostname labels are extracted
- matching token buckets are unioned into a candidate set
- only those providers proceed to method, resource-type, and URL checks

This is one of the main reasons Linkumori stays responsive with larger rule sets.

## Step 4. Cross-Context Exceptions

For subrequests, the engine collects page-context URLs from:

- `documentUrl`
- `originUrl`
- `initiator`
- remembered tab/frame URLs

It then gathers compatible removeparam exceptions from matching providers, so page-context exceptions can suppress cleaning on dependent requests when needed.

The implementation carefully avoids applying those context exceptions to `main_frame` navigations, where the "previous page" context could create false protection.

## Step 5. Provider Cleaning

If a provider matches:

- parameter rules remove query/hash fields
- raw rules can rewrite whole URL substrings
- redirection rules can produce a redirect target
- cancellation logic can block matching requests

The output shape is standardized into webRequest decisions:

- `{ redirectUrl }`
- `{ cancel: true }`
- `{}`

## Step 6. Removeparam Runtime

The interoperability runtime is separate but conceptually similar.

### Compilation

Rules are parsed, deduplicated, badfiltered, then compiled into:

- `removeAll`
- `negated`
- literal case-sensitive buckets
- literal case-insensitive buckets
- regex buckets
- reverse token index
- include/exclude/denyallow hostname tries

### Request-Time Matching

The runtime:

1. splits the URL into base/query/hash
2. parses query entries
3. collects request tokens from:
   - target URL host
   - source/context URLs
   - parameter names
   - regex-token extraction from `name=value`
4. uses the reverse index to assemble candidate rules
5. uses domain tries and target matching to discard irrelevant candidates
6. evaluates important rules, exceptions, then normal rules
7. rebuilds the URL only when something changed

## Step 7. CNAME Replay

`core_js/linkumori_dns.js` adds a secondary filtering pass for CNAME cloaking cases.

It:

- skips root documents, IP hosts, proxied requests, and unsupported states
- resolves canonical names with a bounded in-memory cache
- replays a sanitized alias request against the filter pipeline
- restores the original hostname in redirects when needed

This design avoids rewriting the user-visible hostname while still letting the cleaner inspect the cloaked alias target.

## Step 8. Auxiliary Request-Time Protections

### ETag Filtering

`core_js/eTagFilter.js` listens on response headers and replaces ETag values with random dummy data when enabled.

It respects:

- global settings
- temporary pause
- whitelist state
- local-host skipping

### History API Cleaning

`core_js/historyListener.js` handles `webNavigation.onHistoryStateUpdated`.

It:

- cleans SPA-style URL updates with `pureCleaning`
- injects `history.replaceState`
- respects permanent and temporary whitelists

## Step 9. Logging And Counters

Across the pipeline, Linkumori records:

- before/after URLs
- matched rules or feature actions
- method/type/tab metadata
- alias/CNAME context when present

The logger UI uses this to show both live and historical cleaning behavior.

