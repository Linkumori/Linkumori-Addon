# Interoperability Rules Guide

This guide explains Linkumori URL Filter Interoperability rules.

These are not full ClearURLs JSON provider rules. They are plain filter-list lines, similar to rules used by popular content blockers. Linkumori supports only the URL-cleaning part of that world.

## Chapter 1: What Interoperability Rules Are

Interoperability rules are simple text lines stored in:

```json
{
  "urlFilterRules": [
    "||example.com^$removeparam=utm_source"
  ]
}
```

They live inside `ClearURLsData.urlFilterRules`.

They are separate from JSON providers:

```json
{
  "providers": {},
  "urlFilterRules": []
}
```

Use interoperability rules when you want to paste URL-cleaning filter-list syntax directly, instead of writing a full provider object.

## Chapter 2: What Is Supported

Supported:

```txt
$removeparam
$queryprune
@@ exceptions
badfilter
important
domain=
from=
to=
denyallow=
method=
request type modifiers
first-party / third-party
strict-first-party / strict-third-party
match-case
app=
```

Not supported:

```txt
Network blocking rules without $removeparam or $queryprune
Cosmetic filters
Scriptlets
HTML filtering
Request blocking
Full adblock engine behavior
```

Lines without `$removeparam` or `$queryprune` are ignored.

## Chapter 3: Basic Rule Format

Basic shape:

```txt
URL_PATTERN$removeparam=PARAMETER
```

Example:

```txt
||example.com^$removeparam=utm_source
```

Meaning:

```txt
On example.com and its subdomains, remove the query parameter named utm_source.
```

Result:

```txt
https://example.com/?utm_source=x&id=1
-> https://example.com/?id=1
```

## Chapter 4: Where Rules Are Stored

Runtime storage shape:

```json
{
  "ClearURLsData": {
    "providers": {},
    "urlFilterRules": [
      "||example.com^$removeparam=utm_source",
      "*$removeparam=/^utm_/"
    ],
    "urlFilterMetadata": {
      "format": "linkumori-url-filter-interoperability"
    }
  }
}
```

The runtime reads these rules through the unified URL filter data path.

## Chapter 5: Comments And Empty Lines

Empty lines are ignored.

Comment lines are ignored:

```txt
! This is a comment
```

Section headers are ignored:

```txt
[Tracking parameters]
```

## Chapter 6: Remove One Parameter

Rule:

```txt
*$removeparam=utm_source
```

Result:

```txt
https://site.test/?utm_source=x&id=1
-> https://site.test/?id=1
```

The `*` means the URL pattern matches everything.

## Chapter 7: Remove All Query Parameters

Rule:

```txt
*$removeparam
```

Result:

```txt
https://site.test/?a=1&b=2
-> https://site.test/
```

This removes all query parameters from matching URLs.

## Chapter 8: Remove Parameters By Regex

Rule:

```txt
*$removeparam=/^utm_/
```

Result:

```txt
https://site.test/?utm_source=x&utm_campaign=y&id=1
-> https://site.test/?id=1
```

Regex flags:

```txt
*$removeparam=/^utm_/i
```

Only the `i` flag is kept by the parser for interoperability regexes.

## Chapter 9: Remove All Except One Match

Use `~` before the parameter pattern.

```txt
*$removeparam=~id
```

Result:

```txt
https://site.test/?id=1&utm_source=x&fbclid=y
-> https://site.test/?id=1
```

Meaning:

```txt
Remove every parameter except id.
```

## Chapter 10: `$queryprune`

`$queryprune` is accepted as a deprecated alias for `$removeparam`.

These are equivalent:

```txt
*$removeparam=utm_source
*$queryprune=utm_source
```

Prefer new rules with `$removeparam`.

## Chapter 11: URL Pattern Examples

Match all URLs:

```txt
*$removeparam=utm_source
```

Match a domain and subdomains:

```txt
||example.com^$removeparam=utm_source
```

Match a URL prefix:

```txt
|https://example.com/path$removeparam=utm_source
```

Match an exact ending with right anchor:

```txt
https://example.com/path|$removeparam=utm_source
```

Use a regex URL pattern:

```txt
/^https:\/\/([^/]+\.)?example\.com\/track/$removeparam=utm_source
```

## Chapter 12: Exceptions

Start with `@@` to make an exception.

```txt
@@||example.com^$removeparam=utm_source
```

Example rule set:

```txt
*$removeparam=utm_source
@@||example.com^$removeparam=utm_source
```

Result:

```txt
https://other.test/?utm_source=x&id=1
-> https://other.test/?id=1

https://example.com/?utm_source=x&id=1
-> https://example.com/?utm_source=x&id=1
```

## Chapter 13: `important`

`important` makes a removal rule win over normal exceptions.

```txt
*$removeparam=utm_source,important
@@||example.com^$removeparam=utm_source
```

Result:

```txt
https://example.com/?utm_source=x&id=1
-> https://example.com/?id=1
```

Important notes:

- `important` is allowed on removal rules.
- `important` is not supported on exception rules in this parser.

## Chapter 14: `badfilter`

`badfilter` disables another matching rule.

Original rule:

```txt
||example.com^$removeparam=utm_source
```

Badfilter rule:

```txt
||example.com^$removeparam=utm_source,badfilter
```

Meaning:

```txt
Cancel the original rule.
```

The parser canonicalizes the rule without `badfilter` and removes the target rule from runtime use.

## Chapter 15: Domain Source Modifiers: `domain=` And `from=`

`domain=` and `from=` limit rules by the page or source context.

```txt
*$removeparam=utm_source,domain=example.com
```

Same idea with `from=`:

```txt
*$removeparam=utm_source,from=example.com
```

These check context hostnames such as:

```txt
documentUrl
originUrl
initiator
```

Include multiple domains:

```txt
*$removeparam=utm_source,domain=example.com|shop.example.com
```

Exclude a domain:

```txt
*$removeparam=utm_source,domain=example.com|~safe.example.com
```

Use a regex domain:

```txt
*$removeparam=utm_source,domain=/\.example\.com$/i
```

## Chapter 16: Target Domain Modifier: `to=`

`to=` limits rules by the destination URL host.

```txt
*$removeparam=utm_source,to=example.com
```

This checks the URL being cleaned.

Example:

```txt
Cleaned:
https://example.com/?utm_source=x&id=1

Not cleaned:
https://other.test/?utm_source=x&id=1
```

Exclude target domain:

```txt
*$removeparam=utm_source,to=example.com|~safe.example.com
```

Regex target:

```txt
*$removeparam=utm_source,to=/\.example\.com$/i
```

## Chapter 17: `denyallow=`

`denyallow=` blocks the rule on listed destination domains.

```txt
*$removeparam=utm_source,denyallow=example.com
```

Meaning:

```txt
Remove utm_source generally, but do not apply this rule when the destination host matches example.com.
```

Supported `denyallow=` values are plain domain patterns.

Unsupported in `denyallow=`:

```txt
~negation
example.*
/regex/
```

If unsupported values are used, the whole rule is skipped.

## Chapter 18: HTTP Method Modifier

Limit by HTTP method:

```txt
*$removeparam=utm_source,method=GET
```

Exclude a method:

```txt
*$removeparam=utm_source,method=~POST
```

Multiple methods:

```txt
*$removeparam=utm_source,method=GET|HEAD
```

Supported methods:

```txt
GET
HEAD
OPTIONS
POST
PUT
PATCH
DELETE
CONNECT
```

Default behavior:

```txt
Rules without method= apply only to GET, HEAD, and OPTIONS for the full matcher path.
Fast simple query cleanup also uses those simple methods.
```

## Chapter 19: Resource Type Modifiers

Supported resource type words:

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

Examples:

```txt
*$removeparam=utm_source,script
*$removeparam=utm_source,image
*$removeparam=utm_source,xmlhttprequest
```

Negated resource type:

```txt
*$removeparam=utm_source,~image
```

Mapping:

```txt
document       -> main_frame
doc            -> main_frame
subdocument    -> sub_frame
frame          -> sub_frame
xhr            -> xmlhttprequest
```

## Chapter 20: First-Party And Third-Party

First-party means the destination site and document site share the same registrable domain.

Third-party means they do not.

First-party only:

```txt
*$removeparam=utm_source,first-party
```

Aliases:

```txt
1p
~third-party
~3p
```

Third-party only:

```txt
*$removeparam=utm_source,third-party
```

Aliases:

```txt
3p
~first-party
~1p
```

Strict first-party checks exact same host:

```txt
*$removeparam=utm_source,strict-first-party
*$removeparam=utm_source,strict1p
```

Strict third-party checks not exact same host:

```txt
*$removeparam=utm_source,strict-third-party
*$removeparam=utm_source,strict3p
```

Invalid combinations are skipped, for example:

```txt
*$removeparam=utm_source,first-party,third-party
```

## Chapter 21: `match-case`

By default, literal parameter matching is case-insensitive.

Rule:

```txt
*$removeparam=utm_source
```

Matches:

```txt
utm_source
UTM_SOURCE
Utm_Source
```

Use `match-case` for case-sensitive matching:

```txt
*$removeparam=utm_source,match-case
```

Now it matches:

```txt
utm_source
```

But not:

```txt
UTM_SOURCE
```

## Chapter 22: `app=`

`app=` is parsed for compatibility with filter-list syntax.

```txt
*$removeparam=utm_source,app=com.example.browser
```

Browser requests usually do not have an app package context. If no app context is available, rules with positive `app=` includes do not match.

Exclude app:

```txt
*$removeparam=utm_source,app=~com.example.browser
```

Wildcard app pattern:

```txt
*$removeparam=utm_source,app=com.example.*
```

Regex app pattern:

```txt
*$removeparam=utm_source,app=/example/i
```

## Chapter 23: No-Op Modifiers

These modifiers are accepted but ignored:

```txt
_
noop
stealth
cookie
```

Example:

```txt
*$removeparam=utm_source,noop
```

This behaves like:

```txt
*$removeparam=utm_source
```

## Chapter 24: Parameter Matching Details

Literal parameter rule:

```txt
*$removeparam=utm_source
```

Checks the parameter name.

Regex parameter rule:

```txt
*$removeparam=/^utm_/
```

Checks this text:

```txt
name=value
```

Example:

```txt
URL:
https://example.com/?utm_source=news&id=1

Regex sees:
utm_source=news
id=1
```

Prefix form:

```txt
*$removeparam=|utm_
```

This becomes a regex for names starting with `utm_`.

## Chapter 25: Query Only

Interoperability runtime cleans query parameters before `#`.

Cleaned:

```txt
https://example.com/?utm_source=x&id=1
-> https://example.com/?id=1
```

Not cleaned by this runtime path:

```txt
https://example.com/#utm_source=x&id=1
```

For hash parameter cleanup, use the ClearURLs JSON provider rules described in `CLEARURLS_SYNTAX.md`.

## Chapter 26: Unsupported Rules Are Skipped

A rule is skipped if:

- It has no `$removeparam` or `$queryprune`.
- It uses an unsupported modifier.
- Its regex is invalid.
- It has an invalid method.
- It has an invalid `denyallow=` value.
- It combines incompatible party modifiers.
- It is a comment, section header, or empty line.

Example skipped rule:

```txt
||example.com^$script
```

Reason:

```txt
No $removeparam or $queryprune.
```

Example skipped rule:

```txt
*$removeparam=utm_source,unknownmodifier
```

Reason:

```txt
Unsupported modifier.
```

## Chapter 27: Duplicate Rules

Duplicate raw lines are skipped during filter-list parsing.

Example:

```txt
*$removeparam=utm_source
*$removeparam=utm_source
```

Only one is kept.

At runtime, rules are also deduplicated by canonical form.

## Chapter 28: Complete Filter List Example

```txt
! Linkumori URL filter interoperability example

*$removeparam=/^utm_/
*$removeparam=fbclid
*$removeparam=gclid

||example.com^$removeparam=ref
@@||example.com/login^$removeparam=ref

*$removeparam=tracking_id,to=api.example.com,xmlhttprequest,method=GET

||tracker.example^$removeparam=target,third-party
||tracker.example^$removeparam=target,badfilter
```

What this does:

- Removes all `utm_` parameters.
- Removes `fbclid`.
- Removes `gclid`.
- Removes `ref` on `example.com`, except on `/login`.
- Removes `tracking_id` only for `GET` XHR requests to `api.example.com`.
- Adds then cancels the `tracker.example` target rule with `badfilter`.

## Chapter 29: JSON Storage Example

```json
{
  "ClearURLsData": {
    "providers": {},
    "urlFilterRules": [
      "*$removeparam=/^utm_/",
      "*$removeparam=fbclid",
      "||example.com^$removeparam=ref",
      "@@||example.com/login^$removeparam=ref"
    ],
    "urlFilterMetadata": {
      "name": "Linkumori URL Filter Rules",
      "format": "linkumori-url-filter-interoperability",
      "status": "loaded",
      "ruleStatus": "loaded",
      "hashStatus": "not_required"
    }
  }
}
```

## Chapter 30: Quick Copy Templates

Remove one parameter everywhere:

```txt
*$removeparam=utm_source
```

Remove all UTM parameters:

```txt
*$removeparam=/^utm_/
```

Remove all except `id`:

```txt
*$removeparam=~id
```

Run only on a domain:

```txt
||example.com^$removeparam=utm_source
```

Exception:

```txt
@@||example.com^$removeparam=utm_source
```

GET only:

```txt
*$removeparam=utm_source,method=GET
```

XHR only:

```txt
*$removeparam=utm_source,xmlhttprequest
```

Target domain only:

```txt
*$removeparam=utm_source,to=example.com
```

Source page domain only:

```txt
*$removeparam=utm_source,domain=example.com
```

Third-party only:

```txt
*$removeparam=utm_source,third-party
```

Case-sensitive:

```txt
*$removeparam=utm_source,match-case
```
