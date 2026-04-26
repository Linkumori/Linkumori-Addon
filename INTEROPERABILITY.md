# Linkumori Interoperability Guide

Linkumori supports three related URL-cleaning rule styles:

1. native **ClearURLs provider format**
2. Linkumori's **extended ClearURLs-compatible format**
3. a **focused interoperability subset** of popular uBlock Origin and AdGuard URL-filter syntax

This document explains what is supported, what is intentionally not supported, and how the pieces fit together.

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

## The Three Formats

### 1. ClearURLs Format

This is the original provider-based structure inherited from ClearURLs.

At a high level, a provider contains things like:

- `urlPattern`
- `domainPatterns`
- `rules`
- `rawRules`
- `exceptions`
- `redirections`
- `methods`
- `resourceTypes`

Linkumori keeps this format fully usable for its main provider engine in `ClearURLsData`.

Use this format when:

- you want classic ClearURLs compatibility
- you are writing provider-style rules
- you need domain-scoped URL cleaning behavior in the original ClearURLs model

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
*$removeparam=utm_source,image|script
*$removeparam=utm_source,~image
```

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

Without this modifier, matching is case-insensitive where applicable.

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

---

## Unsupported Features

If a rule includes unsupported modifiers or unrelated adblock features, Linkumori does not try to partially emulate the full adblock engine.

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
