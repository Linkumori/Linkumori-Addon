# Current Rule Syntax

This document is derived from the current implementation.

It covers:

1. `ClearURLsData`
2. inline removeparam rules accepted inside `ClearURLsData.providers.*.rules`
3. standalone `LinkumoriURLsData`

## 1. `ClearURLsData`

`ClearURLsData` is provider-based JSON.

Minimal shape:

```json
{
  "providers": {
    "example-provider": {
      "urlPattern": "^https?:\\/\\/(?:[^/]+\\.)?example\\.com",
      "rules": ["utm_[a-z]+", "fbclid"]
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

### `rawRules`

Type:

```json
["\\/ref=[^/?#]*"]
```

Semantics:

- JavaScript regex source
- compiled with `gi`
- applied against the full URL
- matches are removed from the URL text

Use sparingly. This is more powerful and broader than parameter-name cleanup.

### `referralMarketing`

Type:

```json
["tag", "ascsubtag"]
```

Semantics:

- same compilation model as `rules`
- these rules are only merged into active parameter cleanup when the referral-marketing setting allows it

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

### `redirections`

Type:

```json
["^https?:\\/\\/out\\.example\\.com\\/\\?url=([^&]+)"]
```

Semantics:

- JavaScript regex source
- compiled with `i`
- first capture group becomes the redirect target

If capture group 1 is absent, no redirect target is produced.

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
        "||example.com^$removeparam=clid,domain=example.com,method=GET|HEAD"
      ],
      "rawRules": [
        "\\/ref=[^/?#]*"
      ],
      "referralMarketing": [
        "tag"
      ],
      "exceptions": [
        "^https?:\\/\\/example\\.com\\/checkout"
      ],
      "domainExceptions": [
        "||auth.example.com^"
      ],
      "redirections": [
        "^https?:\\/\\/out\\.example\\.com\\/\\?url=([^&]+)"
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

## 2. `LinkumoriURLsData`

`LinkumoriURLsData` is a filter-list-style JSON object.

Typical shape:

```json
{
  "metadata": {
    "name": "Linkumori URL Filters",
    "version": "2026-05-13T00:00:00.000Z"
  },
  "format": "linkumori-url-filter-interoperability",
  "type": "linkumori-url-rules",
  "rules": [
    "||example.com^$removeparam=utm_source",
    "@@||example.com/login^$removeparam=utm_source"
  ]
}
```

Only `rules` are consumed by the runtime. Metadata is used for display, health, and status.

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

### `badfilter`

```txt
||example.com^$removeparam=clid,badfilter
```

Marks the canonical target rule as disabled during runtime rebuild.

### `match-case`

```txt
||example.com^$removeparam=CaseSensitiveName,match-case
```

In the current implementation, this changes URL-pattern matcher case sensitivity and the compiled lookup bucket selected for literal parameters. Literal parameter comparison itself is already performed as exact raw-name equality during final matching.

### Party modifiers

Supported:

```txt
third-party
3p
~third-party
~3p
strict-third-party
strict3p
strict-first-party
strict1p
```

Interpretation:

- `third-party` / `3p`: registrable domain differs
- `~third-party` / `~3p`: first-party only
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

- plain host patterns
- regex literals

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

When no include/exclude content-type modifier is present, the runtime defaults to:

- no request type, or
- `main_frame`

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

If a standalone `LinkumoriURLsData` rule contains an unsupported modifier, the parser rejects the whole rule.

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

## Practical Difference Between The Two Systems

### Use `ClearURLsData` when you need:

- provider bundles
- regex URL selection
- raw URL rewriting
- redirects
- domain redirections
- provider-level exception sets
- custom-provider editing in the Linkumori UI

### Use `LinkumoriURLsData` when you need:

- filter-list-style removeparam rules
- precise modifier-rich matching
- imported uBO/AdGuard-like pruning rules
- strong deduplication and badfilter behavior

## Source-of-Truth Files

This document reflects the current implementation in:

- `clearurls.js`
- `core_js/storage.js`
- `core_js/custom_rules_editor.js`
- `core_js/linkumori_url_filter_interoperability.js`
- `core_js/linkumori_url_filter_runtime.js`
