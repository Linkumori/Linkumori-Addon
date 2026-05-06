# Linkumori Rule Syntax Reference

Linkumori supports three related URL-cleaning rule styles:

1. native **ClearURLs provider format**
2. Linkumori's **extended ClearURLs-compatible format**
3. a **focused interoperability subset** of popular uBlock Origin and AdGuard URL-filter syntax

This document explains the syntax Linkumori accepts, what each field or token means, what is intentionally not supported, and how the pieces fit together.

---

## What Linkumori Is Trying To Do

Linkumori is a URL cleaner, not a full adblock engine.

That means the interoperability layer is deliberately narrow:

- it supports URL-cleaning rules
- it supports query-parameter removal rules
- it does not try to implement full network blocking
- it does not try to implement cosmetic filtering
- it does not try to implement scriptlets, redirects, CSP injection, or HTML rewriting

In practice, this means Linkumori accepts the useful URL-pruning subset of popular filter-list syntax, then compiles it into a form that fits Linkumori's own runtime.

---

## Quick Syntax Map

Use this section when you only need to know where a syntax belongs.

| Syntax | Stored in | Purpose |
| --- | --- | --- |
| `providers.{name}.urlPattern` | `ClearURLsData` | Regex matching the full URL for a provider |
| `providers.{name}.domainPatterns` | `ClearURLsData` | Adblock-style domain/URL patterns for a provider |
| `providers.{name}.rules` | `ClearURLsData` | Query/hash parameter-name regexes, plus Linkumori inline `$removeparam` rules |
| `providers.{name}.rawRules` | `ClearURLsData` | Regex replacements applied to the whole URL |
| `providers.{name}.referralMarketing` | `ClearURLsData` | Optional parameter-name regexes controlled by the referral marketing setting |
| `providers.{name}.exceptions` | `ClearURLsData` | Regexes that exempt matching URLs from the provider |
| `providers.{name}.domainExceptions` | `ClearURLsData` | Domain/URL patterns that exempt matching URLs from the provider |
| `providers.{name}.redirections` | `ClearURLsData` | Regexes whose first capture group becomes the redirect target |
| `providers.{name}.domainRedirections` | `ClearURLsData` | Domain/URL patterns with `$redirect=` targets |
| `providers.{name}.methods` | `ClearURLsData` | Optional request method allow-list |
| `providers.{name}.resourceTypes` | `ClearURLsData` | Optional browser webRequest type allow-list |
| `$removeparam` / `$queryprune` filter lines | `LinkumoriURLsData` | uBO/AdGuard-style query-parameter pruning rules |

---

## The Three Formats

### 1. ClearURLs Format

This is the original provider-based structure inherited from ClearURLs.

At a high level, the data looks like this:

```json
{
  "providers": {
    "example": {
      "urlPattern": "^https?:\\/\\/(?:[^/]+\\.)?example\\.com",
      "domainPatterns": ["||example.com^"],
      "rules": ["utm_source", "fbclid"],
      "rawRules": ["\\/ref=[^/?#]*"],
      "referralMarketing": ["tag"],
      "exceptions": ["^https?:\\/\\/example\\.com\\/checkout"],
      "domainExceptions": ["||accounts.example.com^"],
      "redirections": ["^https?:\\/\\/out\\.example\\.com\\/\\?url=([^&]+)"],
      "domainRedirections": ["||go.example.com^$redirect=https://example.com/"],
      "methods": ["GET", "HEAD"],
      "resourceTypes": ["main_frame", "sub_frame"]
    }
  }
}
```

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

Linkumori keeps this format fully usable for its main provider engine in `ClearURLsData`.

Use this format when:

- you want classic ClearURLs compatibility
- you are writing provider-style rules
- you need domain-scoped URL cleaning behavior in the original ClearURLs model

### ClearURLs Provider Fields

#### `urlPattern`

`urlPattern` is a JavaScript regular expression string tested against the full request URL with the `i` flag.

```json
{
  "urlPattern": "^https?:\\/\\/(?:[^/]+\\.)?example\\.com"
}
```

Use `urlPattern` when one regex is enough to decide whether the provider applies.

#### `domainPatterns`

`domainPatterns` is an array of adblock-style URL/domain patterns. It is used when `urlPattern` is absent.

```json
{
  "domainPatterns": [
    "||example.com^",
    "*.example.org",
    "|https://shop.example.net/"
  ]
}
```

Supported tokens in these patterns:

- `*` matches any sequence of characters
- `^` matches a separator or the end of the URL
- `|` at the beginning anchors to the start of the URL
- `|` at the end anchors to the end of the URL
- `||` anchors to a hostname boundary
- `*.example.com` matches subdomains of `example.com`
- `example.*` and `*.example.*` are handled with the public suffix list when available

#### `rules`

`rules` normally contains regular expression fragments for parameter names. Linkumori wraps each entry as `^<rule>$` and tests it case-insensitively against query parameter names and hash-fragment parameter names.

```json
{
  "rules": [
    "utm_[a-z]+",
    "fbclid",
    "ref_?"
  ]
}
```

Examples:

- `"utm_[a-z]+"` removes `utm_source`, `utm_medium`, and similar names
- `"fbclid"` removes only a parameter whose name is `fbclid`
- `"ref_?"` removes `ref` and `ref_`

Linkumori also accepts inline `$removeparam` rules in this array. When a `rules` entry parses as a Linkumori remove-parameter rule, it is handled by the Linkumori removeparam path instead of as a plain parameter-name regex.

```json
{
  "rules": [
    "||example.com^$removeparam=utm_source",
    "@@||example.com/checkout^$removeparam=utm_source"
  ]
}
```

The inline provider parser supports the smaller form documented in [Provider Inline `$removeparam`](#provider-inline-removeparam).

#### `rawRules`

`rawRules` contains JavaScript regular expression strings applied directly to the whole URL with the `gi` flags. Matches are replaced with an empty string.

```json
{
  "rawRules": [
    "\\/ref=[^/?#]*"
  ]
}
```

Use raw rules sparingly. They are powerful because they can remove arbitrary URL text, not only query parameters.

#### `referralMarketing`

`referralMarketing` has the same shape as `rules`: entries are parameter-name regex fragments. They are only included when the referral marketing setting allows them.

```json
{
  "referralMarketing": [
    "tag",
    "ascsubtag"
  ]
}
```

#### `exceptions`

`exceptions` contains JavaScript regular expression strings tested against the full URL with the `i` flag. If an exception matches, the provider does not clean that URL.

```json
{
  "exceptions": [
    "^https?:\\/\\/example\\.com\\/checkout"
  ]
}
```

#### `domainExceptions`

`domainExceptions` contains the same pattern syntax as `domainPatterns`. If one matches, the provider does not clean that URL.

```json
{
  "domainExceptions": [
    "||accounts.example.com^"
  ]
}
```

#### `redirections`

`redirections` contains JavaScript regular expression strings tested against the full URL with the `i` flag. The first capture group is decoded and used as the redirect URL.

```json
{
  "redirections": [
    "^https?:\\/\\/out\\.example\\.com\\/\\?url=([^&]+)"
  ]
}
```

The expression must contain a capture group. If the first capture group is absent, there is no redirect target.

#### `domainRedirections`

`domainRedirections` uses a domain/URL pattern followed by `$redirect=`.

```json
{
  "domainRedirections": [
    "||go.example.com^$redirect=https://example.com/"
  ]
}
```

When the pattern matches, the text after `$redirect=` is used as the redirect target.

#### `methods`

`methods` is an optional allow-list of request methods. If omitted or empty, all methods match at the provider level.

```json
{
  "methods": ["GET", "HEAD", "OPTIONS"]
}
```

Values should use the browser request method spelling, normally uppercase.

#### `resourceTypes`

`resourceTypes` is an optional allow-list of browser `webRequest` resource types. If omitted or empty, Linkumori falls back to the globally enabled request types.

```json
{
  "resourceTypes": ["main_frame", "sub_frame", "xmlhttprequest"]
}
```

Common values include:

- `main_frame`
- `sub_frame`
- `script`
- `stylesheet`
- `image`
- `media`
- `font`
- `object`
- `xmlhttprequest`
- `websocket`
- `ping`
- `other`

#### `completeProvider`

`completeProvider: true` turns the provider into a blocking provider when domain blocking is enabled. Internally it also enables a catch-all rule.

```json
{
  "completeProvider": true
}
```

#### `forceRedirection`

`forceRedirection: true` is preserved on the provider object and can be used to mark a provider whose redirect behavior should be forced by callers.

```json
{
  "forceRedirection": true
}
```

---

### 2. Linkumori Format

Linkumori extends the ClearURLs approach rather than replacing it.

The important idea is:

- **ClearURLsData** remains the main provider-style rule store
- **LinkumoriURLsData** is used for interoperable `$removeparam` / `$queryprune` style rules

So "Linkumori format" is best understood as:

- the original ClearURLs provider format, plus
- Linkumori-specific support for imported interoperability rules, plus
- runtime features and metadata ClearURLs never had

That makes Linkumori a practical superset for URL cleaning, while still keeping the ClearURLs provider model intact.

### What Linkumori Adds Beyond ClearURLs

- custom rules merged on top of bundled rules
- per-provider enable/disable flows
- remote rule source support
- imported interoperability rules compiled into `LinkumoriURLsData`
- support for modern `$removeparam` / `$queryprune` list styles
- more explicit metadata and merge status tracking

### `LinkumoriURLsData`

Interoperability filter lines are stored separately from provider JSON:

```json
{
  "metadata": {
    "name": "Linkumori URL Filter",
    "version": "1",
    "sourceCount": 1,
    "supportedRuleCount": 3
  },
  "rules": [
    "*$removeparam=utm_source",
    "||example.com^$removeparam=fbclid,document",
    "@@||example.com/checkout^$removeparam=utm_source"
  ]
}
```

Only the `rules` array is required for runtime matching. `metadata` is used for status displays, source tracking, and diagnostics.

---

### 3. Interoperability Subset

The interoperability parser exists for one job:

> accept the URL-cleaning subset of popular uBlock Origin and AdGuard filter syntax and convert it into Linkumori-compatible runtime data.

It intentionally supports only:

- `$removeparam`
- deprecated alias `$queryprune`
- their related scoping modifiers

It intentionally does **not** support the full grammar of uBO or AdGuard.

---

## Supported Rule Shape

The supported rule family looks like this:

```text
<url-pattern>$removeparam
<url-pattern>$removeparam=<value>
<url-pattern>$queryprune=<value>
@@<url-pattern>$removeparam=<value>
```

Where:

- `<url-pattern>` uses adblock-style URL pattern syntax
- `@@` creates an exception rule
- `$queryprune` is treated as an alias for `$removeparam`

---

## Supported URL Pattern Syntax

Linkumori supports the common URL-pattern pieces used by URL-cleaning rules:

- `*` wildcard
- `^` separator placeholder
- `|` left or right anchoring
- `||` hostname-style anchoring
- regex literal patterns like `/.../`

Examples:

```text
*$removeparam=utm_source
||example.com^$removeparam=utm_medium
|https://example.com/path?$removeparam=ref
/^https:\/\/example\.com\/.*$/$removeparam=foo
```

Notes:

- `||example.com^` means hostname-oriented matching
- `*` matches broadly
- regex patterns are accepted for URL-pattern matching too

---

## Supported Remove-Parameter Forms

### Remove all query parameters

```text
||example.com^$removeparam
```

### Remove one literal parameter

```text
||example.com^$removeparam=utm_source
```

### Remove by regex

```text
||example.com^$removeparam=/^utm_/
```

Regex literals use JavaScript regular expression syntax and are matched against `name=value`, not only the parameter name. A regex like `/^utm_/` works for parameter names because `name=value` starts with the name. A regex can also inspect values:

```text
*$removeparam=/^ref=.*affiliate/
```

The interoperability parser preserves the `i` flag when provided; other flags are ignored for canonical matching.

### Remove by prefix

A value that starts with `|` is treated as an anchored parameter-name prefix match.

```text
||example.com^$removeparam=|utm_
```

This is compiled like a case-insensitive `^utm_` parameter-name regex.

### Negated parameter match

This means "remove everything except what matches this token".

```text
||example.com^$removeparam=~utm_source
||example.com^$removeparam=~/^utm_/
```

### Deprecated alias

```text
||example.com^$queryprune=fbclid
```

This is normalized internally to the same behavior as `removeparam`.

---

## Supported Modifiers

The parser supports the following modifier set around `removeparam/queryprune`.

### Domain/source scoping

```text
domain=example.com
from=example.com
```

- `from=` is treated the same as `domain=`
- supports multiple values with `|`
- supports negation with `~`
- supports regex literals

Examples:

```text
*$removeparam=utm_source,domain=example.com|example.org
*$removeparam=utm_source,domain=example.com|~shop.example.com
*$removeparam=utm_source,domain=/^news\./
```

### Target-domain scoping

```text
to=example.com
```

This scopes the rule to the destination host being cleaned.

Example:

```text
*$removeparam=gclid,to=example.com
```

### denyallow

```text
denyallow=example.com
```

This excludes matching target domains from the rule.

Example:

```text
*$removeparam=utm_source,denyallow=login.example.com
```

### Method scoping

```text
method=GET
method=GET|HEAD
method=GET|~POST
```

Methods are normalized to uppercase.

### Resource-type scoping

Supported content-type tokens:

- `document`
- `doc`
- `subdocument`
- `frame`
- `script`
- `stylesheet`
- `image`
- `media`
- `font`
- `object`
- `xmlhttprequest`
- `xhr`
- `websocket`
- `ping`
- `other`

Negation is supported with `~`.

Examples:

```text
*$removeparam=utm_source,document
*$removeparam=utm_source,image,script
*$removeparam=utm_source,~image
```

Resource types are separate comma modifiers. Do not join resource-type tokens with `|`; `|` is for values inside modifiers such as `domain=`, `to=`, `method=`, and `app=`.

### Party modifiers

Supported:

- `third-party`
- `3p`
- `~third-party`
- `~3p`
- `strict-third-party`
- `strict3p`
- `strict-first-party`
- `strict1p`

Behavior:

- `~third-party` acts as first-party-only
- `third-party` acts as same-site third-party filtering
- `strict-*` variants compare exact host
- non-strict variants compare registrable domain / site

### Case sensitivity

```text
match-case
```

`match-case` affects URL-pattern matching. Literal parameter names are compared as written, so list authors should usually use lowercase parameter names unless a case-specific parameter is intentional.

### Important

```text
important
```

Accepted and preserved in canonical form.

### badfilter

```text
badfilter
```

Accepted so that a rule can disable a matching interoperability rule.

### app

```text
app=com.example.browser
```

Supported by the parser, but in normal browser web requests there is usually no native app identity. This is mostly useful for tests or embedders that provide `appName`.

`app=` supports multiple values with `|`, negation with `~`, and regex literals.

### Ignored no-op modifiers

These are accepted but treated as no-ops:

- `_`
- `noop`
- `stealth`
- `cookie`

---

## Important Defaults

These defaults matter a lot because they are easy to miss.

### Default allowed methods

If you do **not** specify `method=...`, Linkumori defaults to:

- `GET`
- `HEAD`
- `OPTIONS`

Non-default methods are ignored unless you explicitly allow them.

### Default resource type

If you do **not** specify request/resource-type modifiers, the interoperability runtime defaults to:

- `main_frame`

So imported interoperability rules are conservative by default and mainly target document navigations unless you explicitly scope them wider.

### Query only

The interoperability runtime currently cleans:

- URL query parameters

It does **not** currently prune hash-fragment parameters in the interoperability path.

---

## Exception Rules

Exception rules use `@@`.

Example:

```text
@@||example.com^$removeparam=utm_source
```

This creates a removeparam exception for matching requests.

Linkumori compiles rules and exceptions separately, then applies the exception plan during runtime matching.

`important` rules take precedence over non-important exceptions. Non-important exceptions take precedence over normal rules.

---

## Provider Inline `$removeparam`

Provider `rules` can also contain Linkumori `$removeparam` entries. This is a smaller compatibility path inside the ClearURLs provider engine, separate from `LinkumoriURLsData`.

Supported shape:

```text
<url-pattern>$removeparam
<url-pattern>$removeparam=<value>
@@<url-pattern>$removeparam=<value>
```

Supported remove values:

- empty value removes all query and hash-fragment parameters
- literal parameter names
- regex literals such as `/^utm_/`
- negation with `~`

Supported modifiers:

- `domain=example.com|~shop.example.com`
- `method=GET|HEAD|~POST`

Important differences from the full interoperability parser:

- `$queryprune` is not parsed in this provider-inline path
- `to=`, `from=`, `denyallow=`, resource types, party modifiers, `match-case`, `important`, `badfilter`, and `app=` are not supported here
- parameter names are matched case-insensitively
- both query parameters and hash-fragment parameters can be cleaned in this provider path

Use `LinkumoriURLsData` for modern uBO/AdGuard-style filter-list imports. Use provider inline `$removeparam` only when you need removeparam behavior attached to a ClearURLs provider.

---

## Unsupported Features

If a rule includes unsupported modifiers or unrelated adblock features, Linkumori does not try to partially emulate the full adblock engine.

For filter-list imports, lines that do not mention `$removeparam` or `$queryprune` are ignored. Lines that look like remove-parameter rules but contain unsupported syntax are counted as skipped unsupported rules. Comment lines beginning with `!`, section/header lines beginning with `[`, blank lines, and exact duplicate lines are skipped.

Examples of intentionally unsupported categories:

- request blocking rules as a whole
- cosmetic filters
- HTML filters
- scriptlets
- redirect rules
- response-header rules
- CSP modifiers
- full procedural filtering
- general-purpose AdGuard/uBO syntax outside URL-cleaning

Practical rule of thumb:

> if the rule is really about removing query parameters from URLs, there is a good chance it fits.
>
> if the rule is about blocking, hiding, rewriting page behavior, or emulating a full content blocker, it is out of scope.

---

## Canonicalization Behavior

Imported interoperability rules are normalized into a canonical internal form.

That means Linkumori may:

- normalize `queryprune` to `removeparam`
- sort modifiers
- normalize case where appropriate
- preserve exception semantics
- preserve parsed regex/literal intent

This helps with:

- deduplication
- stable comparisons
- `badfilter` handling
- deterministic runtime compilation

---

## Examples

### Basic examples

Remove one parameter everywhere:

```text
*$removeparam=utm_source
```

Remove all parameters on a host:

```text
||example.com^$removeparam
```

Remove all `utm_*` parameters by regex:

```text
*$removeparam=/^utm_/
```

Only on third-party requests:

```text
*$removeparam=fbclid,third-party
```

Only when navigating to a specific target:

```text
*$removeparam=gclid,to=example.com
```

Only for XHR:

```text
*$removeparam=token,xhr
```

Allow one parameter and remove the rest:

```text
||example.com^$removeparam=~id
```

Add an exception:

```text
@@||example.com^$removeparam=utm_source
```

Disable another interoperability rule:

```text
||example.com^$removeparam=utm_source,badfilter
```

---

## How This Relates To ClearURLs Rules

The provider-style ClearURLs engine and the interoperability engine are separate on purpose.

### ClearURLs side

Use `ClearURLsData` when you want:

- provider-based matching
- classic ClearURLs-style `rules`, `exceptions`, `redirections`, and provider metadata

### Interoperability side

Use `LinkumoriURLsData` when you want:

- imported `$removeparam` / `$queryprune` rules
- subset compatibility with uBO / AdGuard URL-cleaning lists

### Runtime architecture

At runtime:

- ClearURLs provider processing runs first
- Linkumori interoperability URL cleaning runs through the same webRequest listener afterward
- both share one interception path, but keep separate rule models

This is intentional. It lets Linkumori support multiple ecosystems without turning the extension into a full generic adblock parser.

---

## Best Practices For Filter Authors

If you want your list to work well in Linkumori:

- stick to `removeparam` / `queryprune`
- use standard adblock-style URL patterns
- add explicit resource-type modifiers when you need non-document requests
- add explicit `method=` modifiers for non-GET behavior
- avoid unrelated adblock modifiers
- prefer simple literal parameter names where possible
- use regex only when you really need pattern matching

If you are writing a list specifically for Linkumori, the safest mental model is:

> write URL-cleaning rules, not full blocker rules.

---

## Short Version

Linkumori is:

- fully compatible with its ClearURLs-style provider engine
- extended with its own richer rule-management model
- compatible with a practical subset of uBlock Origin / AdGuard `removeparam` syntax

Linkumori is **not**:

- a full uBO parser
- a full AdGuard parser
- a general adblock engine

It is a URL-cleaning engine with interoperability support where that support makes sense.
