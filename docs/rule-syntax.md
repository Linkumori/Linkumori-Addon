# Linkumori rule syntax

Rules live in `data/linkumori-clearurls.json` (bundled), in remote rule
lists, and in the custom rules editor. All three use the same format.
Remote lists and editor imports may also use the ClearURLs new rule format
or compiled list format; see [§11](#11-clearurls-rule-formats).

Upgrading rules written for Linkumori 100.54.0 or earlier? See
[§12](#12-changes-in-100550) for what changed and how to update them.
Upgrading rules written before `fieldRedirections`, rule `order` and rule
`flags`? See [§13](#13-changes-in-100560).

```json
{
  "providers": {
    "amazon": {
      "domainPatterns": ["||amazon.*^"],
      "rules": ["qid", "$removeparam=/^pd_rd_[a-z]*$/i"],
      "referralMarketing": ["tag"],
      "exceptions": ["||amazon.com^/gp/redirector.html"],
      "rawRules": ["\\/ref=[^/?]*"]
    }
  }
}
```

Each key under `providers` is a provider: a name of your choice (lowercase,
descriptive) mapped to the fields below.

## 1. Provider fields

| Field | Type | What it does |
|---|---|---|
| `domainPatterns` | array or string | Which URLs the provider handles (see [§2](#2-patterns)). Use this **or** `urlPattern`, never both. |
| `urlPattern` | string | Which URLs the provider handles, as a regex matched against the full URL (case-insensitive). |
| `indexPattern` | string or array | Only with `urlPattern`: `\|\|host^` hints so the provider is only checked for those hosts. Without it, a `urlPattern` provider is checked against every URL, which is slow; `lint-rules` warns about it. |
| `rules` | array | Query/fragment parameters to remove (see [§3](#3-rules)). |
| `referralMarketing` | array | Referral/affiliate parameters to remove. Same syntax as `rules`; skipped while *Allow referral marketing* is on. |
| `rawRules` | array | Regexes run against the full URL; every match is deleted. A pattern in front can limit one to some URLs (see [§5](#5-rawrules)). |
| `exceptions` | array | URLs the provider leaves alone (see [§6](#6-exceptions)). |
| `redirections` | array | Where to send the request instead (see [§7](#7-redirections)). Only used while *Enable Third-Party Redirect Bypass* is on. |
| `fieldRedirections` | array | Redirects to a matching parameter's own value instead of removing it (see [§8](#8-fieldredirections)). Only used while *Enable Third-Party Redirect Bypass* is on. |
| `completeProvider` | boolean | `true` blocks every request the provider matches. Only used while *Allow domain blocking* is on. |
| `forceRedirection` | boolean | `true`: for page loads (`main_frame`), redirects navigate the tab instead of redirecting the request. |
| `methods` | array | Only handle these HTTP methods, e.g. `["GET"]`. Default: all. |
| `resourceTypes` | array | Only handle these request types, e.g. `["main_frame", "xmlhttprequest"]`. Default: the request types chosen in settings. |
| `historyBypassProtection` | boolean | `false` skips this provider when a page changes its own URL with the History API (pushState/replaceState). Default `true`. |
| `active` | boolean | `false` switches the provider off. |

A provider with both `domainPatterns` and `urlPattern` is rejected by the
editor and by `lint-rules`, because only `domainPatterns` would be used.
If you need both kinds of match, make two providers.

### How a URL is processed

For each provider that matches the URL, and whose `methods` and
`resourceTypes` allow the request:

1. **`exceptions`**: if one matches, the provider is skipped.
2. **`redirections`**: if one matches, the request is redirected and nothing
   else runs.
3. **`fieldRedirections`**: if a matching parameter is found, the request is
   redirected to its value and nothing else runs.
4. **`completeProvider`**: the request is blocked.
5. **`rawRules`** run on the full URL.
6. **`rules`** and **`referralMarketing`** remove query parameters and
   parameters in the `#` fragment. A parameter already handled by a
   `$removeparam` filter is left to that filter.
7. **`$removeparam` filters** run, minus any `@@` exceptions.

Steps 5 and 6 normally run in that order. A rule object in `rawRules`,
`rules` or `referralMarketing` can set `order` to run earlier or later, even
across that boundary (see [§9](#9-rule-objects)). Steps 1–4 and 7 always
run where they are, whatever the `order` values.

The first provider that changes, redirects or blocks the request decides
the result. The browser then sends the new URL through the same process.

## 2. Patterns

Used by `domainPatterns`, by `|`-prefixed `exceptions` and `redirections`,
and in front of `$removeparam` and `$rawrule`.

| Pattern | Matches |
|---|---|
| `\|\|example.com^` | `example.com` and every subdomain |
| `\|\|example.*^` | `example` on any public suffix (`example.de`, `example.co.uk`, …) |
| `\|\|example.com^/path` | that host (and subdomains) when the path starts with `/path` |
| `\|\|*.example.com^` | same as `\|\|example.com^` |
| `\|https://example.com/` | URLs that start with exactly this text |
| `…\|` (trailing) | URLs that end with exactly this text |
| `/regex/i` | the full URL, as a regular expression (case-sensitive unless you add `i`) |
| `example.com/path` (no `\|`) | URLs that contain this text anywhere |
| `*` | every URL |

`^` marks the end of the host name, or any separator such as `/`, `?`, `:`
or the end of the URL; `*` matches anything. Apart from `/regex/`, patterns
are case-insensitive. A `||` pattern without `^` also matches a host followed
by a port (`example.com:8080`).

`||` (a domain) and `|` (the literal start of the URL) differ by one
character. A single `|` must be followed by a scheme such as `https://`:
URLs always start with one, so `|example.com^` could never match anything.
The editor and `lint-rules` reject it and suggest `||example.com^`.

## 3. rules

Each entry is one of:

| Entry | Example | Removes |
|---|---|---|
| parameter name | `"utm_source"` | `utm_source` |
| name regex | `"utm_[a-z]+"` | any parameter whose whole name matches (case-insensitive; `^…$` is added for you) |
| `$removeparam` filter | `"$removeparam=fbclid"` | see [§4](#4-removeparam-filters) |

`"fbclid"` and `"$removeparam=fbclid"` remove the same thing. Use the plain
name unless you need something from §4.

`rules` apply to parameters in the query (`?a=1`) and in the fragment
(`#a=1`).

`referralMarketing` takes exactly the same entries, including
`$removeparam` filters and `@@` exceptions. A rule object in `rules` can
also count as a referral-marketing rule without moving lists, with
`"flags": ["referralMarketing"]` (see [§9](#9-rule-objects)).

`fieldRedirections` (see [§8](#8-fieldredirections)) takes the same kinds of
entries, but redirects to the parameter's value instead of removing it.

## 4. $removeparam filters

`[@@][pattern]$removeparam[=value][,option…]`

### Value

The first character of the value decides what it means:

| Value | Removes |
|---|---|
| *(none)* | every parameter |
| `~…` | every parameter **except** what follows (`~name`, `~/regex/`, `~\|prefix`) |
| `/regex/i` | parameters whose name, or `name=value`, matches. Case-sensitive unless you add `i`, the only flag used |
| `\|prefix` | parameters whose name starts with `prefix` (case-insensitive) |
| `name` | exactly that parameter (any other first character); case-insensitive unless `match-case` |

Because of this, `$removeparam` cannot target a parameter whose name starts
with `~`, `|` or `/`. Use a plain entry in `rules` for such a name
(`"\\|odd"` as a name regex).

### Pattern

An optional pattern in front limits the filter to matching URLs:
`||example.com^/search$removeparam=q`.

### Options

| Option | Meaning |
|---|---|
| `domain=a.com\|~b.com` | only on pages from these domains (`~` excludes); regexes allowed |
| `to=a.com\|~b.com` | only for requests to these domains (`~` excludes); regexes allowed |
| `denyallow=a.com\|b.com` | not for requests to these domains; plain domains only (no `~`, regexes or `.*`) |
| `method=get\|~post` | only for these HTTP methods (`~` excludes): `get`, `head`, `options`, `post`, `put`, `patch`, `delete`, `connect` |
| `first-party`, `third-party`, `strict-first-party`, `strict-third-party` | request party; contradictory pairs such as `first-party,third-party` are rejected |
| `document`, `subdocument`, `script`, `stylesheet`, `image`, `imageset`, `media`, `font`, `object`, `xmlhttprequest`, `websocket`, `ping`, `other` (`~` excludes) | request type |
| `match-case` | case-sensitive parameter names |
| `history-bypass-protection=false` | skip this filter for History API URL changes (`true`/`false`, also `1`/`0`, `yes`/`no`) |
| `badfilter` | cancel an identical filter (for example one from another list) |

Options have one spelling each. Short forms such as `1p`, `3p`, `xhr`,
`from=` and `$queryprune` are not accepted (see [§12](#12-changes-in-100550)).
Separate multiple values with `|`.

### @@ exceptions

A filter starting with `@@` keeps the parameter instead of removing it:

```json
"rules": [
  "$removeparam=ref",
  "@@||github.com^$removeparam=ref"
]
```

An `@@` exception covers its own provider's URLs, and also requests handled
by other providers when they come from a page this provider matches. In
`referralMarketing` it only applies while referral marketing is blocked.
`@@` is rejected in `fieldRedirections`; use a rule object's `exceptions`
there instead (see [§8](#8-fieldredirections)).

## 5. rawRules

Regexes run against the full URL; every match is deleted.

```json
"rawRules": ["\\/ref=[^/?]*"]
```

Raw rules are case-insensitive and replace every match (flags `gi`). They
run before `rules`, so they can remove text that is not a `name=value`
parameter, such as Amazon's `/ref=…` path segment. To rewrite instead of
delete, use a rule object with `replacePattern` (§9).

### Limiting a raw rule to some URLs

A raw rule runs on every URL its provider matches. To run it only on some of
them, put a pattern in front, the same way a `$removeparam` filter takes one
(§4):

`[pattern]$rawrule=regex`

```json
"rawRules": [
  "\\/ref=[^/?]*",
  "||amazon.*^/dp/$rawrule=\\/ref=[^/?]*"
]
```

- The pattern is any pattern from [§2](#2-patterns): `||host^`,
  `||host^/path`, `|https://…`, `/regex/i`, plain text, or `*`. An empty
  pattern or `*` means every URL, like a plain raw rule.
- Everything after `$rawrule=` is the raw-rule regex, written exactly as in a
  plain entry. It is not split further, so it may contain `$` and `,`.
- The pattern only decides **whether** the rule runs. The text that is
  deleted (or rewritten) is still what the regex matches.
- Like `||example.com^` in `domainPatterns`, `||example.com^` here also covers
  subdomains.

In a rule object, write the same string as `matchPattern`. `replacePattern`,
`preprocessors`, `exceptions`, `order` and the other keys work as usual, and
`§1§`, `§2§`, … are the regex's capture groups:

```json
{
  "id": "amazon-ref-rewrite",
  "matchPattern": "||amazon.*^/dp/$rawrule=\\/ref=([^/?]*)",
  "replacePattern": "/ref=clean"
}
```

A rule object's `flags` string applies to the regex after `$rawrule=`.

`$rawrule` takes no options. `@@` in front is rejected: raw rules have no
`@@` exceptions; use the provider's `exceptions` or the rule object's
`exceptions` instead. A single `|` without a scheme (`|example.com^$rawrule=…`)
is rejected as in §2.

## 6. exceptions

Each entry is either:

- a **regex** matched against the full URL, or
- a **domain pattern** starting with `|`, such as `||example.com^` or
  `||example.com^/login` (see [§2](#2-patterns)).

```json
"exceptions": [
  "^https?:\\/\\/mail\\.google\\.com\\/mail\\/u\\/",
  "||accounts.google.com^"
]
```

If the URL matches an exception, none of the provider's rules run.

Exception regexes are **case-insensitive** everywhere: in this list and in a
rule object's own `exceptions` (§9).

## 7. redirections

Each entry is either:

- a **regex** matched against the full URL. The request is redirected to
  its capture group (URL-decoded), so the regex must have **exactly one**
  `( … )`. Write any other group as `(?: … )`:

  ```json
  "^https?:\\/\\/(?:[a-z0-9-]+\\.)*?google(?:\\.[a-z]{2,}){1,}\\/url\\?.*?(?:url|q)=(https?[^&]+)"
  ```

  The editor and `lint-rules` reject a regex redirect with no capture group
  (it would never redirect) or more than one. A rule object with a
  `replacePattern` (§9) may use several groups, as `§1§`, `§2§`, ….

- a **domain redirect** starting with `|`: every URL matching the pattern
  goes to a fixed address.

  ```json
  "||go.example.com^$redirect=https://example.com/"
  ```

Every redirect target, from either kind, is URL-decoded until no escapes
are left. A target that does not start with `http` gets `http://` in front.

When the target is simply the value of one parameter, `fieldRedirections`
(§8) does the same job without a regex.

## 8. fieldRedirections

Redirects to a parameter's own value. You name the parameter; no whole-URL
regex or capture group is needed.

```json
"fieldRedirections": ["redirect", "continue_url", "$removeparam=/^(u|dest)$/i"]
```

Each entry is the same kind of entry as in `rules` (§3): a parameter name, a
name regex, or a `$removeparam` filter. Here a `$removeparam` filter only
selects the parameter; its pattern, `~`, `/regex/`, `|prefix` and options
work as in §4. `@@` exceptions are rejected; use a rule object's
`exceptions` instead.

- Query parameters are checked before `#` fragment parameters. If several
  parameters match, the first one in the URL wins. Parameters with an
  empty value are skipped.
- The value is URL-decoded until no escapes are left, and becomes the new
  request URL. A target that does not start with `http` gets `http://` in
  front, as in §7.
- A match stops all further processing for the request, as with
  `redirections`: no `rawRules`, `rules`, `referralMarketing` or
  `$removeparam` filters run afterwards.

Because the value comes from the parameter parser, a target that contains
`&` or other query characters is taken whole. A `redirections` regex has to
be written carefully to get this right.

A rule object:

```json
{
  "id": "unwrap-redirect-param",
  "matchPattern": "redirect",
  "preprocessors": [{ "type": "base64Decode", "inputs": "all" }],
  "exceptions": ["^https:\\/\\/example\\.com\\/internal"]
}
```

Rule objects here take the usual keys (§9): `id`, `aliases`,
`preprocessors`, `requestTypes`, `exceptions`, `historyBypassProtection`,
`active` and `description`. `replacePattern` builds the target from the
value, which is `§1§`, for example `"https://www.youtube.com/watch?v=§1§"`.
`order` and tag-style `flags` have no effect here and are rejected.

## 9. Rule objects

Instead of a string, an entry in `rules`, `referralMarketing`, `rawRules`,
`exceptions`, `redirections` or `fieldRedirections` can be an object. Use it
when a rule needs an id, needs to start switched off, needs to run at a
different point, or needs to rewrite instead of remove:

```json
{
  "id": "token-rewrite",
  "matchPattern": "token",
  "replacePattern": "clean-§1§",
  "preprocessors": [{ "type": "urlDecode", "inputs": "all" }],
  "requestTypes": ["main_frame"],
  "exceptions": ["^https:\\/\\/example\\.com\\/keep"],
  "order": 5,
  "flags": ["referralMarketing"],
  "description": "Rewrite the token instead of removing it",
  "active": true
}
```

| Key | Meaning |
|---|---|
| `matchPattern` | the same string you would write as a plain entry |
| `id` | stable id (`a-z`, `0-9`, `-`, `_`) used by the rule on/off controls |
| `aliases` | the rule's previous ids. A rule switched off under an old id stays off after the rename, and the setting is moved to the new id. Ids and aliases must be unique within a provider |
| `replacePattern` | rewrite instead of remove; `§1§`, `§2§`, … are the captured values (the parameter value for `rules` and `fieldRedirections`, capture groups for `rawRules` / `redirections`) |
| `preprocessors` | applied to captured values first: `urlEncode`, `urlDecode`, `doubleUrlEncode`, `doubleUrlDecode`, `base64Encode`, `base64Decode`; `inputs` is `"all"` or a list like `[1, 2]` |
| `requestTypes` | only for these request types (`"main_frame"`, `"xmlhttprequest"`, …) |
| `exceptions` | URL regexes (case-insensitive) where this one rule does not run. `$removeparam` filters in `rules` and `referralMarketing` ignore it and use `@@` instead; in `fieldRedirections` it works for every entry |
| `flags` | a **string** is the regex flags for the pattern (default `i`; `gi` in `rawRules`). An **array** is a list of behavior tags; see below |
| `order` | a number: run this rule earlier or later than its list normally runs; see below |
| `historyBypassProtection` | `false` skips this rule for History API URL changes (like the provider field in §1) |
| `active` | `false` makes the rule off by default |
| `description` | free text |

A rule object goes in the list for what it does: `rawRules` for raw rules,
`redirections` for redirects, `fieldRedirections` for parameter-value
redirects, and so on. Other keys, including the ClearURLs spellings `match`,
`action` and `kind`, are rejected (see [§12](#12-changes-in-100550)).

### order

Without `order`, `rawRules` run first, then `rules` and `referralMarketing`
(§1, steps 5 and 6). With `order`, a rule in one of those three lists runs
at that position instead:

- Rules with an `order` run before rules without one, lowest first.
  Negative and decimal numbers are fine.
- Rules with the same `order` run in the order they are listed: `rules`,
  then `rawRules`, then `referralMarketing`.
- Rules without `order` then run as usual.

```json
"rules": [{ "id": "mark-token", "matchPattern": "token", "replacePattern": "secret", "order": 1 }],
"rawRules": [{ "id": "strip-secret", "matchPattern": "secret", "order": 2 }]
```

Here the `rules` entry rewrites `token=…` to `token=secret` first, and the
raw rule then deletes `secret`. Without the `order` values, the raw rule
would run first and find nothing.

`order` is rejected where it would do nothing:

- in `exceptions`, `redirections` and `fieldRedirections`, which always
  run at their fixed step;
- on `$removeparam` filters, which always run last, together with their
  `@@` exceptions.

### flags (behavior tags)

When `flags` is an array, it lists behavior tags. There is one:

| Tag | Effect | Allowed in |
|---|---|---|
| `referralMarketing` | The rule counts as a referral-marketing rule: it is skipped while *Allow referral marketing* is on, as if it were in the `referralMarketing` list. | `rules` (and `referralMarketing`, where it changes nothing) |

A rule has one `flags` key, so it cannot have regex flags and tags at the
same time. Unknown tags, and tags in a list where they have no effect, are
rejected.

## 10. Checking rules

```bash
node linkumori-cli-tool.js lint-rules   # validate data/linkumori-clearurls.json
node linkumori-cli-tool.js clearurls    # rebuild the bundled LZ4 rules
node linkumori-cli-tool.js lint-rules new-rules.yaml             # also reads the ClearURLs formats
node linkumori-cli-tool.js convert-rules new-rules.yaml out.json # ClearURLs format → Linkumori JSON
node linkumori-cli-tool.js show-rule ref-strip                   # print one rule, wrapped in its list
```

The custom rules editor runs the same checks when you save. Besides
invalid regexes, unknown fields and unknown options, they catch rules that are valid JSON but
would silently do the wrong thing:

| Mistake | Why it is rejected |
|---|---|
| `domainPatterns` and `urlPattern` on one provider | only `domainPatterns` would be used |
| a pattern with a single `\|` and no scheme, like `\|example.com^` | it can never match; use `\|\|example.com^` |
| a regex redirect with no capture group, or more than one | none never redirects; with several, the destination is ambiguous |
| `urlPattern` without `indexPattern` (warning only, in `lint-rules`) | the provider is checked against every URL |
| a `fieldRedirections` entry starting with `@@` | `@@` only works for `$removeparam` filters in `rules` and `referralMarketing`; use a rule object's `exceptions` |
| an unknown tag in a rule's `flags` array, or a tag in a list where it does nothing | only `referralMarketing` exists, and only in `rules` / `referralMarketing` |
| `order` in `exceptions`, `redirections` or `fieldRedirections`, or on a `$removeparam` filter | those always run at a fixed step, so `order` would do nothing |
| a `rawRules` entry `@@…$rawrule=…` | raw rules have no `@@` exceptions; use `exceptions` |
| a `rawRules` entry with nothing after `$rawrule=` | there is no regex to delete |

### Copying a single rule

A rule object does not record which list it is in, so on its own it does
not say whether it is a field, raw or redirect rule. `show-rule` and the
custom rules editor's *Copy rule* button add that when they copy a rule, by
wrapping it in the list it is in right now:

```json
{ "rawRules": [ { "id": "ref-strip", "matchPattern": "/ref=.*" } ] }
```

The list is never stored on the rule, so it cannot go stale if you move the
rule later.

- `show-rule <id> [file]` (also `lint-rules --show-rule <id> [file]`) finds
  the rule by `id` or alias in `data/linkumori-clearurls.json` or the given
  file. If more than one provider has that id, it lists them; ask again
  with `<provider>::<id>`.
- In the custom rules editor, *Copy rule* is next to each rule in the rule
  id list, which shows rules that have an `id`.

## 11. ClearURLs rule formats

Remote rule lists, the custom rules editor's *Import* and `lint-rules` /
`convert-rules` also accept the two newer ClearURLs formats, in JSON or YAML.
They are converted to the format above when loaded; nothing else changes.

| Format | Recognised by | Spec |
|---|---|---|
| Linkumori (this page) | `providers` is an object, no `version` | — |
| ClearURLs new rule format | `version: 2` | [new-rules](https://docs.clearurls.xyz/specs/new-rules) |
| ClearURLs compiled list | `providers` is a list of `{ providerId, … }` | [compiled-lists](https://docs.clearurls.xyz/specs/compiled-lists) |

```yaml
version: 2
defaults:
  active: true
  requestTypes: all
providers:
  example:
    urlPattern: '^https?:\/\/(?:[a-z0-9-]+\.)*?example\.com'
    rules:
      - utm_source
      - id: referral-tag
        aliases: [tag]
        match: 'tag'
        referralMarketing: true
      - id: raw-ref
        kind: raw
        match: '/ref=([^/?]*)'
        action: { type: rewrite, replacePattern: '/clean/§1§' }
```

### How rules are converted

| ClearURLs rule | Linkumori list |
|---|---|
| `kind: field` (default), action `remove` or `rewrite` | `rules` |
| `kind: field` with `referralMarketing: true` | `referralMarketing` |
| `kind: field`, action `redirect` | `fieldRedirections` |
| `kind: raw`, action `remove` or `rewrite` | `rawRules` |
| `kind: raw`, action `redirect` | `redirections` |
| `kind: redirection`, action `redirect` (default) | `redirections` |
| `kind: redirection`, action `rewrite` | `rawRules` |
| `kind: exception` (compiled lists) | `exceptions` |
| `section: fieldRedirections` (compiled lists) | `fieldRedirections` |

`match` becomes `matchPattern`, `action.replacePattern` becomes
`replacePattern`, `requestTypes: all` is dropped, and `defaults` are copied
into every rule that does not set its own value. A short-form string stays a
string. Compiled lists: `activeDefault` becomes `active`, and
`defaultActive: false` on the list or a provider switches the provider off.

As the spec requires, long-form rules need an `id`. Ids and aliases must be
unique within a provider. A redirection cannot `remove`, and a
`referralMarketing` rule cannot `redirect`. Before 100.56.0, a field rule
with a `redirect` action was rejected; it now becomes a `fieldRedirections`
entry.

### Linkumori additions inside the ClearURLs formats

Everything on this page keeps working inside a `version: 2` or compiled file:

- Provider keys `domainPatterns` (instead of `urlPattern`), `indexPattern`,
  `resourceTypes`, `historyBypassProtection` and, in version 2, `active`.
- Short-form `rules` entries and `match` can be any `rules` entry from
  [§3](#3-rules), including `$removeparam` filters and `@@` exceptions.
- Provider `exceptions` and `match` of `kind: redirection` take `|` domain
  patterns, including `||host^$redirect=…` domain redirects.
- `match` of `kind: raw` may start with a pattern:
  `||host^$rawrule=regex` (see [§5](#5-rawrules)).
- Rule keys `flags` (regex flags, or a list of behavior tags), `order` and
  `historyBypassProtection`, and `defaults.historyBypassProtection`.
- The `base64Decode` preprocessor.
- `rawRules`, `referralMarketing`, `redirections` and `fieldRedirections`
  lists next to `rules`.
- A top-level `metadata` object.

Files that use these additions are not valid for ClearURLs itself.

### YAML support

YAML files may use block mappings and lists, `[ … ]` / `{ … }`, single- and
double-quoted strings, `|` / `>` blocks and `#` comments. Anchors, aliases,
tags and multiple documents are rejected. Write regexes in single quotes:
in double quotes, `\d` is an invalid escape.

## 12. Changes in 100.55.0

Linkumori 100.55.0 simplified the rule format. There is now one way to write
each kind of rule, and the custom rules editor and `lint-rules` check it
the same way. This section lists what changed and how to update older rules.

Removed syntax is **not converted automatically** in Linkumori rule files:

- The custom rules editor and `lint-rules` reject it with
  `unknown field "…"`, `unknown key "…"` or an unknown-option error.
- Rules that are already stored or come from a remote list are still
  loaded, but the removed parts are ignored.

Check your custom rules and remote lists after upgrading:

```bash
node linkumori-cli-tool.js lint-rules my-rules.json
```

### What's new

| Change | Details |
|---|---|
| Domain patterns in `exceptions` | An entry starting with `\|`, such as `\|\|example.com^` or `\|\|example.com^/login`, is a domain pattern. Anything else is still a regex. See [§6](#6-exceptions). |
| Domain redirects in `redirections` | `\|\|go.example.com^$redirect=https://example.com/` sends every matching URL to a fixed address. See [§7](#7-redirections). |
| `$removeparam` in `referralMarketing` | `referralMarketing` accepts the same entries as `rules`, including `$removeparam` filters and `@@` exceptions. They only apply while *Allow referral marketing* is off. See [§4](#4-removeparam-filters). |
| ClearURLs formats | Remote lists, editor *Import*, `lint-rules` and the new `convert-rules` command also read the ClearURLs new rule format (`version: 2`) and compiled lists, in JSON or YAML. See [§11](#11-clearurls-rule-formats). |
| Rule `aliases` | A renamed rule keeps its on/off setting: list its old ids in `aliases` and the setting moves to the new id. See [§9](#9-rule-objects). |
| Stricter checks | The editor and `lint-rules` now reject rules that load but can never work: `domainPatterns` together with `urlPattern`, a single `\|` with no scheme (`\|example.com^`), and a regex redirect without exactly one capture group. See [§10](#10-checking-rules). |

### Behaviour changes

- **Exception regexes are case-insensitive.** This covers a rule object's
  own `exceptions` list as well as the provider's. Previously a rule
  object's exceptions were case-sensitive. If you relied on that, spell
  the case out, for example `[Aa]`.
- **Remote lists no longer have to be JSON.** They are read as Linkumori
  JSON, ClearURLs JSON/YAML or a compiled list. The error message for a
  broken list now reads `Invalid remote rules: …`.

### Removed provider fields

| Removed | Use instead |
|---|---|
| `domainExceptions: ["\|\|safe.example.com^"]` | `exceptions: ["\|\|safe.example.com^"]` |
| `domainRedirections: ["\|\|out.example.com^$redirect=https://example.com/"]` | `redirections: ["\|\|out.example.com^$redirect=https://example.com/"]` |
| `defaultActive` | `active` |
| `history-bypass-protection` | `historyBypassProtection` |

Before:

```json
"example": {
  "domainPatterns": ["||example.com^"],
  "exceptions": ["^https?://example\\.com/checkout"],
  "domainExceptions": ["||api.example.com^"],
  "domainRedirections": ["||go.example.com^$redirect=https://example.com/"]
}
```

After:

```json
"example": {
  "domainPatterns": ["||example.com^"],
  "exceptions": ["^https?://example\\.com/checkout", "||api.example.com^"],
  "redirections": ["||go.example.com^$redirect=https://example.com/"]
}
```

### Removed top-level keys

| Removed | Use instead |
|---|---|
| `defaults` in a Linkumori rules file | Set the value on each rule object. `defaults` still works inside a ClearURLs `version: 2` file, where it is copied into each rule on import. |
| Custom rules without the `providers` wrapper (`{ "amazon": { … } }`) | `{ "providers": { "amazon": { … } } }` |

### Removed rule-object keys

In a Linkumori rules file, rule objects only take the keys listed in
[§9](#9-rule-objects). The ClearURLs spellings are accepted
only inside a ClearURLs file, where they are converted on import.

| Removed | Use instead |
|---|---|
| `match` | `matchPattern` |
| `action: { type: "rewrite", replacePattern }` | `replacePattern` |
| `action: { type: "remove" }` | Leave out `replacePattern`. |
| `kind: "raw"` / `"redirection"` / `"exception"` | Put the rule in `rawRules`, `redirections` or `exceptions`. |
| `referralMarketing: true` on a rule | Put the rule in `referralMarketing`, or give it `"flags": ["referralMarketing"]` (100.56.0 and later). |
| `activeDefault` | `active` |
| `requestTypes: "all"` | Leave out `requestTypes`. |
| `history-bypass-protection` | `historyBypassProtection` |

Before:

```json
"rules": [
  { "id": "raw-ref", "kind": "raw", "match": "/ref=([^/?]*)",
    "action": { "type": "rewrite", "replacePattern": "/clean/§1§" } }
]
```

After:

```json
"rawRules": [
  { "id": "raw-ref", "matchPattern": "/ref=([^/?]*)", "replacePattern": "/clean/§1§" }
]
```

### Removed `$removeparam` spellings

Each option now has only its long name.

| Removed | Use instead |
|---|---|
| `$queryprune` | `$removeparam` |
| `from=` | `domain=` |
| `1p`, `~third-party`, `~3p` | `first-party` |
| `3p`, `~first-party`, `~1p` | `third-party` |
| `strict1p` | `strict-first-party` |
| `strict3p` | `strict-third-party` |
| `doc`, `popup` | `document` |
| `frame`, `iframe` | `subdocument` |
| `xhr` | `xmlhttprequest` |

### Removed preprocessor names

| Removed | Use instead |
|---|---|
| `urlEncodeRepeated` | `doubleUrlEncode` |
| `urlDecodeRepeated` | `doubleUrlDecode` |

### Disabled-rule settings

Rules you switched off in older versions stay off. When a rule has been
renamed and lists its old id in `aliases`, the saved setting moves to the
new id the first time the rules load. Provider on/off settings saved in the
old list format are no longer read. Switch those providers off again in the
custom rules editor.

## 13. Changes in 100.56.0

100.56.0 adds one provider list, two rule-object keys and patterns in
`rawRules`. Nothing is removed: existing rule files work unchanged.

| Change | Details |
|---|---|
| `fieldRedirections` | New provider list: redirect to a parameter's own value. Same entries as `rules`. ClearURLs field rules with a `redirect` action now import into it instead of being rejected. See [§8](#8-fieldredirections). |
| Rule `order` | A number on a rule object in `rawRules`, `rules` or `referralMarketing` that moves it earlier or later, also across those lists. See [§9](#9-rule-objects). |
| Rule `flags` as a list | `"flags": ["referralMarketing"]` makes a `rules` entry a referral-marketing rule without moving it. A `flags` string still means regex flags. See [§9](#9-rule-objects). |
| Copying one rule | `show-rule <id>` (or `lint-rules --show-rule <id>`) and the editor's *Copy rule* button wrap the rule in the list it is in. See [§10](#10-checking-rules). |
| Patterns in `rawRules` | `\|\|example.com^$rawrule=regex` runs a raw rule only on URLs the pattern matches, like the pattern in front of `$removeparam`. See [§5](#5-rawrules). |
| New checks | The editor and `lint-rules` reject `@@` in `fieldRedirections`, unknown or misplaced `flags` tags, and `order` where it would do nothing. In `rawRules` they reject `@@…$rawrule=`, an empty regex after `$rawrule=`, and a single `\|` with no scheme. See [§10](#10-checking-rules). |

Adding `flags: ["referralMarketing"]` to a rule without an `id` keeps its
generated id, so a rule you switched off stays off.
