# Current Rule Syntax

This document is derived from the current implementation.

It covers:

1. Linkumori rule dialects
2. `ClearURLsData` provider JSON
3. inline removeparam rules accepted inside `ClearURLsData.providers.*.rules`
4. canonical Linkumori-ClearURLs provider rules
5. consolidated `ClearURLsData.urlFilterRules`

## 1. Linkumori Rule Dialects

The custom-rules editor exposes one provider dialect: `linkumori-clearurls-dialect`. Older providers without `syntax` still load, old ClearURLs provider fields are retained, and new saves use the unified dialect marker.

| Dialect | Saved `syntax` value | Rule home | Notes |
| --- | --- | --- | --- |
| Linkumori-ClearURLs dialect | `linkumori-clearurls-dialect` | `rules[]` plus retained ClearURLs fields | Accepts simple field strings, old ClearURLs `rawRules`, `referralMarketing`, and `redirections`, inline `$removeparam` / `@@$removeparam` filter rules, and canonical rule objects with `id`, `kind`, `match`, and `action`. Supports `indexPattern` as a Linkumori speed hint. |

New saves use `linkumori-clearurls-dialect`.


### Unified Rule Mapping

New cleanup rules should live in `rules[]`, but old ClearURLs provider fields remain valid for compatibility.

| Intent | Unified Linkumori-ClearURLs syntax |
| --- | --- |
| Dialect marker | `"syntax": "linkumori-clearurls-dialect"` |
| Remove query parameter by name | `"rules": ["fbclid"]` or `"rules": [{ "kind": "field", "match": "fbclid", "action": { "type": "remove" } }]` |
| Inline removeparam rule | `"rules": ["||example.com^$removeparam=clid"]` |
| Inline removeparam exception | `"rules": ["@@||example.com/login^$removeparam=clid"]` |
| Referral marketing rule | `"rules": [{ "kind": "field", "match": "tag", "referralMarketing": true, "action": { "type": "remove" } }]` |
| Raw URL cleanup | `"rules": [{ "kind": "raw", "match": "/ref=[^/?#]*", "action": { "type": "remove" } }]` |
| Regex redirect extraction | `"rules": [{ "kind": "redirection", "match": "^https?:\\/\\/example\\.com\\/go\\?target=([^&]+)$", "action": { "type": "redirect", "replacePattern": "§1§" } }]` |
| Old raw URL cleanup | `rawRules` |
| Old referral-marketing cleanup | `referralMarketing` |
| Old regex redirect extraction | `redirections` |
| Provider URL matching | `urlPattern`, `indexPattern`, or `domainPatterns` |
| Provider exceptions | `exceptions`, `domainExceptions` |
| Domain redirections | `domainRedirections` |
| Request constraints | `methods`, `resourceTypes` |

Use simple strings for straightforward field removal, inline `$removeparam` rules for filter-list-compatible behavior, retained ClearURLs fields for old provider parity, and canonical objects when a rule needs stable IDs, raw URL cleanup, redirects, request constraints, aliases, preprocessors, or per-rule exceptions.

### Unified Provider Example

```json
{
  "providers": {
    "example-provider": {
      "syntax": "linkumori-clearurls-dialect",
      "urlPattern": "^https?:\\/\\/(?:[^/]+\\.)?example\\.com",
      "indexPattern": "||example.com^",
      "rules": [
        "utm_[a-z]+",
        "||example.com^$removeparam=clid",
        "@@||example.com/login^$removeparam=clid",
        {
          "id": "remove-utm-source",
          "kind": "field",
          "match": "utm_source",
          "action": { "type": "remove" }
        },
        {
          "id": "remove-ref-raw",
          "kind": "raw",
          "match": "/ref=[^/?#]*",
          "action": { "type": "remove" }
        },
        {
          "id": "extract-target",
          "kind": "redirection",
          "match": "^https?:\\/\\/example\\.com\\/go\\?target=([^&]+)$",
          "action": { "type": "redirect", "replacePattern": "§1§" }
        }
      ],
      "exceptions": ["^https?:\\/\\/example\\.com\\/checkout"],
      "domainExceptions": ["||safe.example.com^"],
      "domainRedirections": ["||example.com^$redirect=https://target.example/"]
    }
  }
}
```

## 2. `ClearURLsData`

`ClearURLsData` is provider-based JSON. Providers use the Linkumori-ClearURLs dialect.

Minimal Linkumori-ClearURLs shape:

```json
{
  "providers": {
    "example-provider": {
      "syntax": "linkumori-clearurls-dialect",
      "urlPattern": "^https?:\\/\\/(?:[^/]+\\.)?example\\.com",
      "rules": ["utm_[a-z]+", "fbclid"]
    }
  }
}
```

Minimal canonical-object rule inside Linkumori-ClearURLs:

```json
{
  "providers": {
    "example-provider": {
      "syntax": "linkumori-clearurls-dialect",
      "urlPattern": "^https?:\\/\\/(?:[^/]+\\.)?example\\.com",
      "indexPattern": "||example.com^",
      "rules": [
        {
          "id": "remove-utm-source",
          "kind": "field",
          "match": "utm_source",
          "action": { "type": "remove" }
        }
      ]
    }
  }
}
```

Each provider may contain the fields below.

## Provider Fields

### `completeProvider`

Type:

```json
true
```

When `true`, the provider starts with an internal catch-all rule equivalent to `.*`.

Used by the runtime as a "complete provider" switch.

### `forceRedirection`

Type:

```json
true
```

When a matching redirect occurs on a `main_frame` request, Linkumori may update the active tab and cancel the original request instead of only returning a redirect URL.

### `urlPattern`

Type:

```json
"^https?:\\/\\/(?:[^/]+\\.)?example\\.com"
```

Semantics:

- JavaScript regex source
- compiled with the `i` flag
- matched against the full URL

Rules:

- a provider must have either `urlPattern` or `domainPatterns`
- the editor treats `urlPattern` and `domainPatterns` as mutually exclusive

### `indexPattern`

Type:

```json
"||example.com^"
```

or:

```json
["||example.com^", "||example.net^"]
```

Semantics:

- indexing hint only
- used when a provider uses `urlPattern`
- does not change actual matching behavior
- helps place the provider in `providersByToken`

Supported hostname-style forms in the current engine:

```txt
||amazon.com^
||amazon.*^
*.amazon.com
*.amazon.*
amazon.com
```

Notes:

- path/query/fragment text is stripped
- use it as a host-only optimization hint

### `domainPatterns`

Type:

```json
["||example.com^", "*.example.net", "|https://shop.example.org/"]
```

Semantics:

- pattern list used for actual provider matching
- also reused for provider indexing
- evaluated by the adblock-style domain-pattern matcher

The current matcher accepts:

- `*`
- `^`
- leading `|`
- trailing `|`
- leading `||`
- hostname wildcards like `*.example.com`
- public-suffix-style wildcard TLD forms like `example.*`

### `rules`

Type:

```json
["utm_[a-z]+", "fbclid", "ref_?"]
```

Default behavior:

- entries are JavaScript regex fragments
- compiled as `^<rule>$`
- matched case-insensitively against parameter names

Examples:

```json
["fbclid"]
```

matches only parameter name:

```txt
fbclid
```

```json
["utm_[a-z]+"]
```

matches names like:

```txt
utm_source
utm_medium
```

Important: `rules` also accepts a special inline removeparam syntax. That separate grammar is documented in [Inline Removeparam Rules](#inline-removeparam-rules).

Advanced cleanup behavior can live in `rules[]` or the retained ClearURLs fields. Use `rawRules` for old full-URL cleanup parity, `redirections` for old regex redirect parity, and `referralMarketing` for old referral-marketing parity. Use canonical `rules[]` objects with `kind: "raw"`, `kind: "redirection"`, or `referralMarketing: true` when you need IDs, actions, preprocessors, request constraints, or per-rule exceptions.

### `exceptions`

Type:

```json
["^https?:\\/\\/example\\.com\\/checkout"]
```

Semantics:

- JavaScript regex source
- compiled with `i`
- if one matches the full URL, the provider does not run

### `domainExceptions`

Type:

```json
["||accounts.example.com^"]
```

Semantics:

- same pattern family as `domainPatterns`
- if one matches, the provider does not run

### `domainRedirections`

Type:

```json
["||go.example.com^$redirect=https://example.com/"]
```

Semantics:

- pattern before `$redirect=`
- redirect target after `$redirect=`
- if the pattern matches, the target is returned

### `methods`

Type:

```json
["GET", "HEAD", "OPTIONS"]
```

Semantics:

- provider-level request method allow-list
- if omitted or empty, the provider does not restrict by method

### `resourceTypes`

Type:

```json
["main_frame", "sub_frame", "script", "xmlhttprequest"]
```

Semantics:

- provider-level browser request type allow-list
- if omitted or empty, runtime falls back to global extension request-type settings

## Full `ClearURLsData` Example

```json
{
  "providers": {
    "example": {
      "completeProvider": false,
      "forceRedirection": false,
      "urlPattern": "^https?:\\/\\/(?:[^/]+\\.)?example\\.com",
      "indexPattern": ["||example.com^", "||links.example.net^"],
      "rules": [
        "utm_[a-z]+",
        "fbclid",
        "||example.com^$removeparam=clid,domain=example.com,method=GET|HEAD",
        {
          "id": "remove-ref-raw",
          "kind": "raw",
          "match": "\\/ref=[^/?#]*",
          "action": { "type": "remove" }
        },
        {
          "id": "referral-tag",
          "kind": "field",
          "match": "tag",
          "referralMarketing": true,
          "action": { "type": "remove" }
        },
        {
          "id": "extract-out-url",
          "kind": "redirection",
          "match": "^https?:\\/\\/out\\.example\\.com\\/\\?url=([^&]+)",
          "action": { "type": "redirect", "replacePattern": "§1§" }
        }
      ],
      "exceptions": [
        "^https?:\\/\\/example\\.com\\/checkout"
      ],
      "domainExceptions": [
        "||auth.example.com^"
      ],
      "domainRedirections": [
        "||go.example.com^$redirect=https://example.com/"
      ],
      "methods": [
        "GET",
        "HEAD"
      ],
      "resourceTypes": [
        "main_frame",
        "sub_frame"
      ]
    }
  }
}
```

## Inline Removeparam Rules

These are accepted **inside `ClearURLsData.providers.*.rules`**.

They are parsed by the provider engine's own lightweight parser, not by the standalone Linkumori URL filter parser.

### Supported Shape

```txt
pattern$removeparam[=value][,domain=...][,method=...]
@@pattern$removeparam[=value][,domain=...][,method=...]
```

### Supported Pieces

#### Exception marker

```txt
@@
```

Marks an exception rule.

#### URL pattern

Examples:

```txt
||example.com^
*
```

The provider engine matches this with its domain-pattern matcher.

#### `removeparam`

Supported forms:

```txt
$removeparam
$removeparam=clid
$removeparam=~clid
$removeparam=/^utm_/
```

Behavior:

- no value removes all parameters
- literal removes one lowercase-normalized parameter name
- `~value` negates the test
- regex literals are supported

#### `domain=`

Supported form:

```txt
domain=example.com|~bad.example.com
```

Behavior:

- includes and excludes are supported
- for exception rules, domain context can be resolved against the initiating page context

#### `method=`

Supported form:

```txt
method=GET|HEAD|~POST
```

Behavior:

- uppercase normalized internally
- include and exclude methods are supported

### Inline Example

```json
{
  "providers": {
    "inline-example": {
      "domainPatterns": ["||example.com^"],
      "rules": [
        "||example.com^$removeparam=clid,domain=example.com,method=GET|HEAD",
        "@@||example.com/account^$removeparam=clid"
      ]
    }
  }
}
```

## 4. Canonical Linkumori-ClearURLs Provider Rules

The Linkumori-ClearURLs dialect keeps provider-level fields such as `urlPattern`, `indexPattern`, `domainPatterns`, `rawRules`, `referralMarketing`, `exceptions`, `domainExceptions`, `redirections`, `domainRedirections`, `methods`, `resourceTypes`, `completeProvider`, and `forceRedirection`, while also allowing new cleanup behavior in `rules[]`.

Supported rule fields:

| Field | Type | Meaning |
| --- | --- | --- |
| `id` | string | Required for canonical object rules. Must match `^[a-z0-9][a-z0-9_-]*$`. The editor generates unique IDs when adding templates. |
| `kind` | `field`, `raw`, or `redirection` | Selects parameter-name cleanup, raw URL rewrite, or redirect extraction. Missing `kind` defaults to field-style cleanup. |
| `match` | string | JavaScript regex source or literal-like field pattern, depending on `kind`. |
| `action` | object | Currently supports `remove`, `rewrite`, and `redirect` shapes. |
| `active` | boolean | Explicit activation switch evaluated at build time. When `false` the rule is excluded entirely. Takes priority over `activeDefault`. |
| `activeDefault` | boolean | Fallback activation flag used when `active` is absent. When `false` the rule is inactive by default. |
| `flags` | string | Regex flags for the `match` pattern. Default is `"i"` for `field` and `redirection` rules, `"gi"` for `raw` rules. Override only when custom case sensitivity is needed. |
| `requestTypes` | `"all"` or string array | Limits the rule to specific browser request types such as `main_frame`, `sub_frame`, `script`, `xmlhttprequest`, `image`, `media`, `font`, `ping`. Omit or use `"all"` for no restriction. Values are normalized to lowercase. |
| `exceptions` | string array | Per-rule URL exception patterns. Each entry is a JavaScript regex source compiled without flags. If any pattern matches the full request URL the rule is skipped, independently of provider-level `exceptions`. Exception regexes are precompiled at provider build time. |
| `preprocessors` | array | Optional preprocessing steps before replacement/redirect actions. Supported types: `urlEncode`, `urlDecode`, `doubleUrlEncode`/`urlEncodeRepeated`, `doubleUrlDecode`/`urlDecodeRepeated`, `base64Encode`, `base64Decode`. |
| `aliases` | array | Optional extra rule identifiers for the same rule intent. They use the same pattern as `id`, must be unique, and must not repeat the rule `id`. Stored on compiled rules but not currently used for activation lookups. |
| `description` | string | Human-facing note. Stored on compiled rules. |
| `referralMarketing` | boolean | Marks a field rule as referral-marketing-sensitive. When the user enables referral-marketing filtering, these rules are included alongside normal field rules. |

Runtime-only properties (not user-specified, set by the engine at build time):

| Property | Value | Meaning |
| --- | --- | --- |
| `section` | `rules`, `rawRules`, `referralMarketing`, `exceptions`, or `redirections` | Reflects which rule section the compiled rule was stored in. Derived from the `addRule` / `addRawRule` / `addReferralMarketing` / `addException` / `addRedirection` call path. Useful for introspection and logging. |
| `exceptionRegexes` | `RegExp[]` | Precompiled form of the `exceptions` array. Built once at provider initialization. Used by `coreRuleAppliesToRequest` to avoid per-request `new RegExp()` allocation. |

Supported action combinations follow ClearURLs core:

- `field` rules support `remove` and `rewrite`
- `raw` rules support `remove` and `rewrite`
- `redirection` rules support `redirect`
- `field`/`raw` redirect actions and non-redirect redirection rules are rejected by the editor and ignored by the runtime

### Field rule

```json
{
  "id": "remove-fbclid",
  "kind": "field",
  "match": "fbclid",
  "action": { "type": "remove" }
}
```

Field rules match query parameter names and remove matching parameters.

### Raw rule

```json
{
  "id": "remove-raw-ref",
  "kind": "raw",
  "match": "/ref=[^/?#]*",
  "action": { "type": "remove" }
}
```

Raw rules apply against the full URL text. Use them only when parameter-name cleanup is not expressive enough.

### Field rule with requestTypes and per-rule exceptions

```json
{
  "id": "remove-session-xhr",
  "kind": "field",
  "match": "session_[a-z]+",
  "action": { "type": "remove" },
  "requestTypes": ["xmlhttprequest", "script"],
  "exceptions": ["^https?:\\/\\/example\\.com\\/auth"]
}
```

`requestTypes` restricts the rule to XHR and script requests only. `exceptions` prevents the rule from firing on the authentication path, independently of the provider-level `exceptions` list. Both are evaluated at request time using regexes precompiled at provider build time.

### Redirection rule

```json
{
  "id": "extract-target",
  "kind": "redirection",
  "match": "^https?:\\/\\/example\\.com\\/go\\?target=([^&]+)$",
  "action": {
    "type": "redirect",
    "replacePattern": "§1§"
  },
  "preprocessors": [
    { "type": "urlDecode", "inputs": [1] }
  ]
}
```

Redirection rules extract or rewrite a destination URL. `§1§`, `§2§`, etc. reference regex capture groups from `match`.

### Canonical Linkumori-ClearURLs example

```json
{
  "providers": {
    "example": {
      "syntax": "linkumori-clearurls-dialect",
      "urlPattern": "^https?:\\/\\/(?:[^/]+\\.)?example\\.com",
      "indexPattern": "||example.com^",
      "forceRedirection": true,
      "exceptions": ["^https?:\\/\\/example\\.com\\/checkout"],
      "rules": [
        {
          "id": "remove-utm-source",
          "kind": "field",
          "match": "utm_source",
          "action": { "type": "remove" }
        },
        {
          "id": "remove-raw-ref",
          "kind": "raw",
          "match": "/ref=[^/?#]*",
          "action": { "type": "remove" }
        },
        {
          "id": "extract-target",
          "kind": "redirection",
          "match": "^https?:\\/\\/example\\.com\\/go\\?target=([^&]+)$",
          "action": { "type": "redirect", "replacePattern": "§1§" },
          "preprocessors": [{ "type": "urlDecode", "inputs": [1] }]
        }
      ]
    }
  }
}
```

## 5. `ClearURLsData.urlFilterRules`

Standalone removeparam-style filter rules now live inside the unified `ClearURLsData` JSON object.

Typical shape:

```json
{
  "metadata": {
    "name": "Provider Rules"
  },
  "providers": {},
  "urlFilterMetadata": {
    "name": "Linkumori URL Filters",
    "version": "2026-05-13T00:00:00.000Z"
  },
  "urlFilterRules": [
    "||example.com^$removeparam=utm_source",
    "@@||example.com/login^$removeparam=utm_source"
  ]
}
```

Only `urlFilterRules` are consumed by the removeparam runtime. `urlFilterMetadata` is used for display, health, and status.

## uBlock Origin Compatibility

This is a uBlock-Origin-like subset, not a full uBlock Origin static network filter engine.

Matches uBO for the core `$removeparam` behavior:

- `queryprune` is accepted as a deprecated alias of `removeparam`.
- `removeparam` with no value removes all query parameters.
- literal values remove one query parameter name.
- regex literal values are tested against `name=value`.
- `@@` exception rules, `badfilter`, `match-case`, `domain=`/`from=`, `to=`, `method=`, party modifiers, and request-type modifiers are supported in the standalone parser.

Known differences from uBO:

- Linkumori intentionally rejects any standalone rule that is not `$removeparam`/`$queryprune`.
- uBO supports the broader EasyList/ABP static network filter language; Linkumori does not implement request blocking, cosmetic filters, scriptlets, redirects, CSP, `urlskip`, `replace`, `uritransform`, or other non-cleaning modifiers here.
- uBO documents `important` as applying only to network block filters. Linkumori accepts `important` on standalone removal rules and uses it only to run those removals before normal `$removeparam` exceptions.
- uBO documents `denyallow` as requiring `domain=` in normal static network filters. Linkumori accepts `denyallow=` without requiring `domain=` because it is used only as a target-host rejection check for URL-cleaning rules.
- Linkumori accepts `stealth` and `cookie` as no-op modifiers for importer tolerance. They do not make Linkumori implement uBO or AdGuard cookie/stealth behavior.

## Standalone Rule Grammar

General shape:

```txt
[@@]pattern$modifier,modifier,modifier
```

The rule must contain:

```txt
removeparam
```

or:

```txt
queryprune
```

`queryprune` is accepted as an alias.

## Supported URL Patterns

The parser supports:

- `*`
- `||`
- adblock-style host patterns like `||example.com^`
- leading `|` anchor
- trailing `|` anchor
- wildcards `*`
- separator `^`
- regex literal patterns like `/^https?:\\/\\/example\\.com\\//i`

Pattern matching is compiled into an internal matcher and reused.

## Supported Parameter Removal Forms

### Remove all parameters

```txt
||example.com^$removeparam
```

### Remove one literal parameter

```txt
||example.com^$removeparam=utm_source
```

### Negated parameter rule

```txt
||example.com^$removeparam=~session_id
```

Semantically, this matches parameters that are **not** the named value.

### Regex parameter test

```txt
||example.com^$removeparam=/^utm_[a-z_]+/
```

Regex matching is performed against:

```txt
name=value
```

not only against the parameter name.

### Prefix-style shorthand

If a value begins with `|`, the runtime converts it into a regex anchored at the start.

Example:

```txt
||example.com^$removeparam=|utm_
```

## Supported Modifiers

### `important`

```txt
||example.com^$removeparam=clid,important
```

Important removal rules run before normal exceptions.

`important` is valid only on removal rules. Exception rules with `important` are rejected by the standalone parser.

### `badfilter`

```txt
||example.com^$removeparam=clid,badfilter
```

Marks the canonical target rule as disabled during runtime rebuild.

### `match-case`

```txt
||example.com^$removeparam=CaseSensitiveName,match-case
```

In the current implementation, this changes URL-pattern matcher case sensitivity and literal parameter comparison. Without `match-case`, literal parameter names are compared case-insensitively. Regex parameter values keep the flags from the regex literal.

### Party modifiers

Supported:

```txt
third-party
3p
first-party
1p
~third-party
~3p
~first-party
~1p
strict-third-party
strict3p
strict-first-party
strict1p
```

Interpretation:

- `third-party` / `3p`: registrable domain differs
- `first-party` / `1p` / `~third-party` / `~3p`: registrable domain matches
- `~first-party` / `~1p`: third-party only
- `strict-third-party`: host must differ
- `strict-first-party`: host must match exactly

### Source-domain modifiers

Supported aliases:

```txt
domain=
from=
```

Examples:

```txt
domain=example.com|~bad.example.com
from=example.com|/trusted\\..+/i
```

Accepted values:

- plain host patterns
- negated values with `~`
- regex literals
- `|`-separated lists

These match against source/context hostnames, not only the destination URL.

### Target-domain modifier

```txt
to=tracker.example|~safe.example|/cdn\\..+/i
```

Matches the request target host.

Supports:

- plain host patterns
- negations with `~`
- regex literals

### `denyallow=`

```txt
denyallow=ads.example|metrics.example
```

If the target host matches one of these, the rule is rejected.

Supports:

- plain host patterns only

Unsupported `denyallow` values reject the whole rule. That includes negated values with `~`, regex literals, and wildcard public-suffix forms ending in `.*`.

### `method=`

```txt
method=GET|HEAD|~POST
```

Supported behavior:

- include list
- exclude list
- values normalized uppercase

When no `method=` is provided, the runtime defaults to:

- `GET`
- `HEAD`
- `OPTIONS`

### Content-type modifiers

Supported positive and negated forms are derived from:

```txt
document
doc
subdocument
frame
script
stylesheet
image
media
font
object
xmlhttprequest
xhr
websocket
ping
other
```

Negate with `~`, for example:

```txt
~image
~script
```

When no include/exclude content-type modifier is present, untyped `$removeparam` rules apply across request types. Add content-type modifiers when a rule should be limited to document, script, image, or another request family.

### `app=`

```txt
app=com.example.browser|~com.example.bad|/trusted\\..+/i
```

This is implemented for parity with popular rule syntax and for embedders/tests that supply `appName`.

In normal browser requests, if there is no app context:

- rules with positive app requirements do not match
- rules with only exclusions can still be acceptable

### No-op accepted modifiers

The parser accepts and ignores:

```txt
_
noop
stealth
cookie
```

They do not change matching.

## Unsupported Modifier Behavior

If a standalone `ClearURLsData.urlFilterRules` rule contains an unsupported modifier, the parser rejects the whole rule.

During list import:

- unsupported rules are counted
- duplicate exact lines are counted
- empty/comment/header lines are skipped

Skipped line types:

```txt
! comment
[Header]
```

## Standalone Examples

### Literal removal

```txt
||example.com^$removeparam=utm_source
```

### Exception

```txt
@@||example.com/login^$removeparam=utm_source
```

### Regex + target restriction

```txt
||example.com^$removeparam=/^utm_.+=/,to=shop.example.com
```

### Third-party only, script requests

```txt
||tracker.example^$removeparam=clid,third-party,script
```

### Method-limited rule

```txt
||example.com^$removeparam=clid,method=GET|HEAD
```

### Badfilter

```txt
||example.com^$removeparam=clid,badfilter
```

## Practical Difference Between The Systems

### Use Linkumori-ClearURLs dialect when you need:

- provider bundles
- regex URL selection with `urlPattern`
- `indexPattern` speed hints
- inline `$removeparam` and `@@$removeparam` rules
- canonical object rules in `rules[]`
- one rule object carrying `id`, `kind`, `match`, and `action`
- retained ClearURLs fields: `rawRules`, `referralMarketing`, and `redirections`
- raw URL rewriting
- redirects
- domain redirections
- provider-level exception sets

### Use `ClearURLsData.urlFilterRules` when you need:

- filter-list-style removeparam rules
- precise modifier-rich matching
- imported uBO/AdGuard-like pruning rules
- strong deduplication and badfilter behavior

## Engine Implementation Notes

### Provider token lookup dedup

When resolving candidate providers for a request, the engine splits the request hostname into dot-separated labels and walks `providersByToken`. Duplicate labels (e.g. the two `a` tokens in `a.a.com`) are skipped using a per-lookup `Set`, avoiding redundant map reads while still relying on the candidate `Set` for provider deduplication.

### Field rewrite loop guard

When a canonical rule carries a `replacePattern` (rewrite action), a per-call `Set` named `appliedFieldRewrites` tracks `(provider, source, field, rule)` tuples and prevents the same rewrite from applying more than once within a single URL cleaning call. The guard resets on every new request; it is not shared across calls.

### Per-rule exception precompilation

Each `exceptions` entry on a canonical rule object is compiled into a `RegExp` once during provider initialization and stored on the compiled rule as `exceptionRegexes`. The engine uses these cached instances in `coreRuleAppliesToRequest` rather than constructing a new `RegExp` per request. A string-based fallback path remains for legacy compiled rules that predate this optimization.

### Rule section tracking

Every compiled rule produced by `addRule`, `addRawRule`, `addReferralMarketing`, `addException`, or `addRedirection` carries a `section` string set at build time. This mirrors the `section` field on `CompiledRule` in clearurls-core and enables introspection, logging, and trace output without requiring the caller to know which internal map holds the rule.

## Source-of-Truth Files

This document reflects the current implementation in:

- `clearurls.js`
- `core_js/storage.js`
- `core_js/custom_rules_editor.js`
- `core_js/linkumori_url_filter_interoperability.js`
- `core_js/linkumori_url_filter_runtime.js`
