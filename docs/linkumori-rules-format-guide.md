# Linkumori Rules Format: Beginner-to-Advanced Guide

Linkumori uses the CLN 1.0 data model. Rules are JSON in the extension,
remote files, custom files, imports and exports. The bundled source is authored
in YAML and exported to JSON by the CLI. A rule file tells Linkumori two things:

1. Which websites a set of rules applies to.
2. What Linkumori should remove or change on those websites.

This document has two parts. Start with the beginner guide, then continue to
the [Advanced guide](#advanced-guide). For every supported option and its
exact behavior, see the [full filter syntax reference](filter-syntax.md).

## A small working example

~~~json
{
  "cln": "1.0",
  "providers": {
    "shop": {
      "domainPatterns": ["||shop.example^"],
      "rules": ["utm_source", "utm_medium", "fbclid"]
    }
  }
}
~~~

This example says: “When a URL is for `shop.example` or one of its subdomains,
remove the `utm_source`, `utm_medium` and `fbclid` parameters.”

For example:

~~~text
Before: https://shop.example/item?color=blue&utm_source=email&fbclid=abc
After:  https://shop.example/item?color=blue
~~~

The address still has `color=blue` because the rules do not mention it.

## How to read the file

Think of the file as a set of website groups. Each group is called a
**provider**.

~~~text
Rule file
└── providers
    └── shop                    A name for this group; choose any name
        ├── domainPatterns      Which websites it applies to
        └── rules               Which URL parameters to remove
~~~

| Part | What it means |
| --- | --- |
| `cln` | The Linkumori format version. `"1.0"` is the current value. This key is optional; files without it are read as 1.0. |
| `providers` | The required object containing the rule groups. |
| `shop` | A label for this provider. You can choose a descriptive name. |
| `domainPatterns` | The websites Linkumori should check. |
| `rules` | The URL parameters Linkumori should remove on those websites. |

## Choosing websites

Put a pattern in `domainPatterns` to tell Linkumori where a provider applies:

~~~json
"domainPatterns": ["||shop.example^"]
~~~

`||shop.example^` matches `shop.example` and its subdomains, such as
`www.shop.example`. You can list more than one pattern:

~~~json
"domainPatterns": ["||shop.example^", "||shop.example.co.uk^"]
~~~

Use `domainPatterns` for the usual domain-based rules. Linkumori also supports
`urlPattern` when you need a regular expression for matching the full URL;
the [pattern reference](filter-syntax.md#patterns) explains that advanced
option.

## Choosing what to remove

Add parameter names to the `rules` list:

~~~json
"rules": ["utm_source", "utm_medium", "fbclid"]
~~~

Each name removes that parameter from the URL's query or fragment. A rule can
also use a regular expression for parameter names. For example,
`utm_[a-z]+` matches names such as `utm_source` and `utm_campaign`.

Rules only apply to URLs that match the provider. A rule for shop.example
does not affect other websites.

## Other useful options

Add these inside a provider when you need them:

| Option | In simple terms |
| --- | --- |
| `referralMarketing` | Removes referral or affiliate parameters while the “allow referral marketing” setting is off. It uses the same entries as `rules`. |
| `exceptions` | Leaves matching URLs alone: none of this provider's rules run on them. |
| `rawRules` | Removes matching text from the full URL with regular expressions. Use this for URL parts such as tracking text in a path, rather than a query parameter. |

These options have more details and examples in the [full reference](filter-syntax.md).

## JSON basics

- Put double quotes around property names and text values.
- Separate items with commas, but do not put a comma after the final item.
- Keep `providers` at the top level, and put each provider's options inside its braces.
- The format version key is `cln`, not `version`.

For example, this is a valid rules list:

~~~json
"rules": ["utm_source", "fbclid"]
~~~

This version is missing the comma between its items:

~~~json
"rules": ["utm_source" "fbclid"]
~~~

## Complete simple template

Copy this template and replace the example domain and parameter names with
your own:

~~~json
{
  "cln": "1.0",
  "providers": {
    "my-site": {
      "domainPatterns": ["||example.com^"],
      "rules": ["utm_source", "fbclid"]
    }
  }
}
~~~

For advanced filters, redirects, rule objects and exact matching behavior,
continue to the [Advanced guide](#advanced-guide).

## Advanced guide

This section shows how to add conditions, exceptions, rewrites and redirects.
It builds on the same provider and JSON structure from the beginner guide.

### Target parameter names with filters

Use <code>$removeparam</code> when a plain parameter name is not flexible
enough. For example:

~~~json
{
  "rules": [
    "$removeparam=/^utm_/i",
    "||shop.example^$removeparam=affiliate",
    "$removeparam=click_id,third-party"
  ]
}
~~~

- <code>$removeparam=/^utm_/i</code> removes parameter names that start with
  <code>utm_</code>. The <code>i</code> makes the match ignore letter case.
- <code>||shop.example^$removeparam=affiliate</code> removes
  <code>affiliate</code> only on matching shop.example URLs.
- <code>$removeparam=click_id,third-party</code> removes <code>click_id</code>
  only when the request is third-party.

Filters can also use options for the page domain, request method and resource
type. If a filter has multiple options, every option must match. See the
[$removeparam reference](filter-syntax.md#removeparam-filters) for the full
syntax.

### Keep a parameter on selected URLs

Start a filter with <code>@@</code> to keep a parameter on URLs that match the
filter:

~~~json
{
  "rules": [
    "$removeparam=ref",
    "@@||shop.example^/partner$removeparam=ref"
  ]
}
~~~

This removes <code>ref</code> normally, but keeps it on matching
<code>shop.example/partner</code> URLs. An <code>@@</code> entry protects
against <code>$removeparam</code> filters; it does not override a plain rule
such as <code>"ref"</code>.

There are two kinds of exceptions:

- Provider-level <code>exceptions</code> skip every rule in that provider for
  matching URLs.
- An <code>@@</code> filter keeps a parameter from a matching
  <code>$removeparam</code> filter.

See the [exception reference](filter-syntax.md#exceptions) for details.

### Clean text outside query parameters

Use <code>rawRules</code> for text anywhere in the URL, including a tracking
segment in the path:

~~~json
{
  "rawRules": ["\\/ref=[^/?]*"]
}
~~~

Each entry is a regular expression against the full URL; matching text is
deleted. Raw rules run before ordinary parameter rules. Use them only when a
normal <code>rules</code> entry cannot describe the part of the URL you need
to clean.

See the [raw rules reference](filter-syntax.md#rawrules) for patterns and
exceptions.

### Rewrite a value instead of removing it

A rule object can rewrite a matching parameter:

~~~json
{
  "rules": [
    {
      "id": "token-rewrite",
      "matchPattern": "token",
      "replacePattern": "clean-§1§",
      "order": 5
    }
  ]
}
~~~

Here, Linkumori keeps the <code>token</code> parameter but changes its value.
For example, <code>?token=abc123</code> becomes
<code>?token=clean-abc123</code>. In a parameter rule, <code>§1§</code> stands
for the current parameter value.

Give a rule an <code>id</code> if you want a stable name for its on/off
setting. <code>order</code> makes one rule run before another within the same
stage. It cannot move an ordinary parameter rule ahead of a raw rule.

See the [rule objects reference](filter-syntax.md#rule-objects) for
<code>aliases</code>, preprocessors, per-rule exceptions and other options.

### Redirect through a destination parameter

Some sites send links through a middle page and put the destination in a
parameter. <code>fieldRedirections</code> tells Linkumori to use that
parameter's value as the destination:

~~~json
{
  "fieldRedirections": ["redirect", "continue_url"]
}
~~~

For example, if a URL contains
<code>?redirect=https://destination.example/page</code>, Linkumori can
navigate directly to that destination. Redirect targets must be absolute
<code>http</code> or <code>https</code> URLs.

For fixed redirects and redirects matched with a regular expression, see the
[redirections reference](filter-syntax.md#redirections).

### Know the processing order

For a matching provider, Linkumori checks these stages in order:

1. Provider-level <code>exceptions</code>
2. <code>redirections</code>
3. <code>fieldRedirections</code>
4. <code>completeProvider</code>
5. <code>rawRules</code>
6. <code>rules</code> and <code>referralMarketing</code>
7. <code>$removeparam</code> filters and their <code>@@</code> exceptions

A numeric <code>order</code> sorts entries only inside their own stage. It
cannot move a parameter rule ahead of a raw rule. See the
[processing order reference](filter-syntax.md#processing-order) for tie
breaking and more examples.

## Full reference

This guide covers common and advanced tasks. The
[full filter syntax reference](filter-syntax.md) documents every field,
pattern, option and edge case.
