# Linkumori filter syntax

This is the complete syntax for Linkumori rules. The same syntax is used
everywhere rules are written:

- the bundled list, `data/linkumori-clearurls.json`;
- remote rule lists;
- the custom rules editor, including *Import*.

A rule file is **JSON**: one object with a `providers` object, plus an
optional `metadata` object. No other format is read.

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
| `rawRules` | array | Regexes run against the full URL; every match is deleted. They take the pattern and options of a `$removeparam` filter to run only on some URLs, and `@@` entries switch them off (see [§5](#5-rawrules)). |
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
and in front of `$removeparam` and `$rawrule` (also after `@@`).

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
`"referralMarketing": true` (see [§9](#referralmarketing)).

`fieldRedirections` (see [§8](#8-fieldredirections)) takes the same kinds of
entries, but redirects to the parameter's value instead of removing it.

### Domain-specific rules

A plain name or name regex applies to every URL the provider matches. To
remove a parameter only on some of those URLs, write it as a `$removeparam`
filter with a pattern in front ([§2](#2-patterns)). The pattern can use the
same wildcards as `domainPatterns`, so a provider for `||amazon.*^` can
still have rules for one country, one subdomain or one path:

```json
"amazon": {
  "domainPatterns": ["||amazon.*^"],
  "rules": [
    "qid",
    "||amazon.de^$removeparam=tag",
    "||*.amazon.co.uk^$removeparam=/^pd_rd_/",
    "||smile.amazon.*^$removeparam=sr",
    "||amazon.*^/gp/$removeparam=ref_"
  ]
}
```

| Entry | Removes |
|---|---|
| `"qid"` | `qid` on every Amazon URL |
| `"\|\|amazon.de^$removeparam=tag"` | `tag` only on `amazon.de` and its subdomains |
| `"\|\|*.amazon.co.uk^$removeparam=/^pd_rd_/"` | `pd_rd_…` only on `amazon.co.uk` (`*.` changes nothing; same as `\|\|amazon.co.uk^`) |
| `"\|\|smile.amazon.*^$removeparam=sr"` | `sr` only on `smile.amazon` on any public suffix |
| `"\|\|amazon.*^/gp/$removeparam=ref_"` | `ref_` only when the path starts with `/gp/` |

The rule still only runs on URLs the provider matches, so the pattern
narrows the provider's `domainPatterns`; it cannot widen them. The same
works in `referralMarketing` and `fieldRedirections`, and for raw rules
with `$rawrule` ([§5](#5-rawrules)). To keep a parameter on some domains
instead, use an `@@` filter ([§4](#4-removeparam-filters)).

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
| `method=get\|~post` | only for these HTTP methods (`~` excludes): `get`, `head`, `options`, `post`, `put`, `patch`, `delete`, `connect` |
| `first-party`, `third-party`, `strict-first-party`, `strict-third-party` | request party; contradictory pairs such as `first-party,third-party` are rejected |
| `document`, `subdocument`, `script`, `stylesheet`, `image`, `imageset`, `media`, `font`, `object`, `xmlhttprequest`, `websocket`, `ping`, `other` (`~` excludes) | request type |
| `match-case` | case-sensitive parameter names |
| `history-bypass-protection=false` | skip this filter for History API URL changes (`true`/`false`, also `1`/`0`, `yes`/`no`) |

Options have one spelling each. Separate multiple values with `|`.

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

### Patterns and options

A raw rule runs on every URL its provider matches. It can take the same
pattern and options as a `$removeparam` filter (§4) to run only on some of
them, with `rawrule=` last:

`[@@][pattern]$[option,…,]rawrule=regex`

```json
"rawRules": [
  "\\/ref=[^/?]*",
  "||amazon.*^/dp/$rawrule=\\/ref=[^/?]*",
  "||example.com^$third-party,method=get,~xmlhttprequest,rawrule=\\/sid=[^/?]*",
  "$domain=example.com|~shop.example.com,match-case,rawrule=\\/SID"
]
```

- The **pattern** is any pattern from [§2](#2-patterns): `||host^`,
  `||host^/path`, `||host.*^`, `|https://…`, `/regex/i`, plain text, or `*`.
  An empty pattern or `*` means every URL. Like `||example.com^` in
  `domainPatterns`, `||example.com^` here also covers subdomains.
- The **options** go between `$` and `rawrule=`, separated by commas.
- Everything after `rawrule=` is the **regex**, written exactly as in a plain
  entry. It is not split further, so it may contain `$` and `,`.
- The pattern and options only decide **whether** the rule runs. The text
  that is deleted (or rewritten) is still what the regex matches.

Every `$removeparam` option works, with the same meaning as in §4:

| Option | For a raw rule |
|---|---|
| `domain=a.com\|~b.com` | only on pages from these domains (`~` excludes); regexes allowed |
| `to=a.com\|~b.com` | only for requests to these domains (`~` excludes); regexes allowed |
| `method=get\|~post` | only for these HTTP methods (`~` excludes) |
| `first-party`, `third-party`, `strict-first-party`, `strict-third-party` | request party; contradictory pairs are rejected |
| `document`, `subdocument`, `script`, `xmlhttprequest`, … (`~` excludes) | request type; the same list as §4 |
| `match-case` | the regex is case-sensitive (flags `g` instead of `gi`) |
| `history-bypass-protection=false` | skip this rule for History API URL changes |

`removeparam` and a second `rawrule` are not options here and are rejected.
A single `|` without a scheme (`|example.com^$rawrule=…`) is rejected as in
§2.

In a rule object, write the same string as `matchPattern`. `replacePattern`,
`preprocessors`, `exceptions`, `requestTypes`, `order` and the other keys
work as usual, and `§1§`, `§2§`, … are the regex's capture groups:

```json
{
  "id": "amazon-ref-rewrite",
  "matchPattern": "||amazon.*^/dp/$document,rawrule=\\/ref=([^/?]*)",
  "replacePattern": "/ref=clean"
}
```

A rule object's `flags` string applies to the regex after `rawrule=` and
takes precedence over `match-case`.

### @@ exceptions

An entry starting with `@@` keeps raw rules from running where its pattern
and options match, the way an `@@` filter keeps a parameter (§4):

`@@[pattern]$[option,…,]rawrule=[regex]`

As with `@@` `$removeparam` filters, the pattern and `domain=` of an
exception also match the page a request comes from, so
`@@$domain=partner.org,rawrule=` keeps raw rules off every request made by
`partner.org` pages. `match-case` would do nothing on an exception and is
rejected.

An exception says which raw rules it stops in one of three ways. Prefer
`targetId`:

```json
"rawRules": [
  { "id": "ref-strip", "matchPattern": "\\/ref=[^/?]*" },
  "\\/tag-[a-z]+",
  { "matchPattern": "@@||smile.example.com^$rawrule=", "targetId": "ref-strip" },
  "@@||example.com^/checkout/$rawrule="
]
```

- **`targetId`** (rule objects): stops the raw rule with that `id`, or with
  that id in its `aliases`. Above, `smile.example.com` keeps `/ref=…` but
  still loses `/tag-…`. The link survives any edit to the target's
  `matchPattern`, and renaming the target keeps it working as long as the
  old id goes into `aliases` (§9). Leave the regex after `rawrule=` empty.
- **A regex after `rawrule=`** (no `targetId`): stops the raw rules whose
  regex is **the same text**: a plain entry, or the part after `rawrule=`
  of an entry with a pattern or options. This still works, but breaks as soon as the target's
  regex is edited, so the editor and `lint-rules` reject an exception whose
  regex no raw rule in the provider uses. Switch to `targetId` when that
  happens.
- **Nothing after `rawrule=`** (no `targetId`): stops **every** raw rule of
  the provider on those URLs. `rules`, `referralMarketing` and `$removeparam`
  filters still run; to skip the whole provider, use `exceptions` (§6).

An `@@` entry only affects raw rules in its own provider. It never deletes
anything itself, and it applies whatever the `order` of the rules it stops.

As a rule object, write the entry as `matchPattern`, with the `@@`. `id`,
`aliases`, `active`, `description`, `requestTypes` and `exceptions` work as
usual, so an exception can be switched off with the rule on/off controls.
`replacePattern`, `preprocessors`, `order` and `flags` would do nothing and
are rejected.

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
`order` and `referralMarketing` have no effect here and are rejected.

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
  "referralMarketing": true,
  "description": "Rewrite the token instead of removing it",
  "active": true
}
```

| Key | Meaning |
|---|---|
| `matchPattern` | the same string you would write as a plain entry |
| `id` | stable id (`a-z`, `0-9`, `-`, `_`) used by the rule on/off controls. Without it, the rule gets a generated id; see [Rule ids](#rule-ids) |
| `aliases` | the rule's previous ids. A rule switched off under an old id stays off after the rename, and the setting is moved to the new id. Ids and aliases must be unique within a provider |
| `replacePattern` | rewrite instead of remove; `§1§`, `§2§`, … are the captured values (the parameter value for `rules` and `fieldRedirections`, capture groups for `rawRules` / `redirections`) |
| `preprocessors` | applied to captured values first: `urlEncode`, `urlDecode`, `doubleUrlEncode`, `doubleUrlDecode`, `base64Encode`, `base64Decode`; `inputs` is `"all"` or a list like `[1, 2]` |
| `requestTypes` | only for these request types (`"main_frame"`, `"xmlhttprequest"`, …) |
| `exceptions` | URL regexes (case-insensitive) where this one rule does not run. `$removeparam` filters in `rules` and `referralMarketing` ignore it and use `@@` instead; in `fieldRedirections` it works for every entry |
| `flags` | the regex flags for the pattern, as a string (default `i`; `gi` in `rawRules`) |
| `order` | a number: run this rule earlier or later than its list normally runs; see below |
| `referralMarketing` | `true` makes a rule in `rules` a referral-marketing rule; see below |
| `historyBypassProtection` | `false` skips this rule for History API URL changes (like the provider field in §1) |
| `active` | `false` makes the rule off by default |
| `description` | free text |
| `targetId` | only on an `@@…$rawrule=` exception in `rawRules`: the `id` (or alias) of the raw rule it stops; see [§5](#5-rawrules) |

A rule object goes in the list for what it does: `rawRules` for raw rules,
`redirections` for redirects, `fieldRedirections` for parameter-value
redirects, and so on. Other keys are rejected.

### Rule ids

Every rule has an id, whether or not it is an object with an `id`. The rule
on/off controls, `show-rule` and the custom rules editor all use it. A rule
without an `id` gets one from its list and its text:

| List | Entry | Generated id |
|---|---|---|
| `rules` | `"utm_source"` | `field-utm-source` |
| `referralMarketing` | `"tag"` | `referral-tag` |
| `rawRules` | `"\\/ref=[^/?]*"` | `raw-ref` |
| `redirections` | a regex | `redirect-…` |
| `fieldRedirections` | `"continue_url"` | `field-redirect-continue-url` |
| `exceptions` | a regex | `exception-…` |

The text is lowercased, every run of other characters becomes `-`, and the
result is cut at 32 characters. When two rules of a provider with different
text would get the same id (`"$removeparam=rdr"` and `"$removeparam=_rdr"`,
or `"referer"` and `"Referer"`), or an `id` or alias already uses it, each of
those rules gets a hash of its text on the end instead:
`field-removeparam-rdr-15wzedx`. Identical entries in one list share their id.

A generated id changes when the rule's text changes, and when another rule
starts sharing it. Give a rule an `id` when something must keep pointing at
it. When a rule that was switched off gets a hash on its id, it stays off,
and so does every other rule that shared that id.

The first time you switch off a rule without an `id`, its id is fixed:

- In your custom rules, the id is written onto the rule itself (a plain
  entry becomes `{ "id": …, "matchPattern": … }`), together with the ids of
  rules that share its readable id, so theirs do not change either.
- In a built-in or remote list, which you cannot edit, the id is pinned in
  the extension's local storage with the provider, the list and the rule's
  text at that moment. On every load the pin is matched to the provider's
  current rules: the same text, the same generated id, or a text at least
  80% alike. The matched rule keeps the pinned id, so it stays off when a
  list update edits its text. A pin that matches no rule is listed under
  *Orphaned toggles* in Disabled Rules, with a *Remove* button, instead of
  quietly doing nothing.

To choose an id yourself, use *Rename ID* next to the rule in *Provider rule
ID controls* of a custom provider. The rule gets the new `id`, its old id
becomes an alias, and rules switched off under the old id stay off.

Rules you never switched off keep their generated ids, with nothing stored.
*Export custom rules to file* includes the pins (`"rulePins"`) of rules you
switched off, and importing the file switches the same rules off.

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

### referralMarketing

`"referralMarketing": true` on a rule in `rules` makes it count as a
referral-marketing rule: it is skipped while *Allow referral marketing* is
on, as if it were in the `referralMarketing` list. In `referralMarketing` it
changes nothing; in the other lists it is rejected.

The rule keeps the id it has in `rules`, so adding the key to a rule without
an `id` keeps its generated id, and a rule you switched off stays off.

## 10. Checking rules

```bash
node linkumori-cli-tool.js lint-rules                  # validate data/linkumori-clearurls.json
node linkumori-cli-tool.js lint-rules my-rules.json    # validate another file (.json or .json.lz4)
node linkumori-cli-tool.js clearurls                   # rebuild the bundled LZ4 rules
node linkumori-cli-tool.js show-rule ref-strip         # print one rule, wrapped in its list
```

The custom rules editor runs the same checks when you save or import, and
its **Linter** panel under the JSON editor runs them as you type. It lists
every problem in the provider at once (saving stops at the first), with the
warnings below and a warning for a rule template whose placeholder
`matchPattern` (on `example.com` / `example_…`) was not replaced. Besides
invalid JSON, invalid regexes, unknown fields and unknown options, they catch
rules that are valid JSON but would silently do the wrong thing:

| Mistake | Why it is rejected |
|---|---|
| a file that is not JSON (for example YAML), or `providers` that is a list | only Linkumori JSON is read |
| `domainPatterns` and `urlPattern` on one provider | only `domainPatterns` would be used |
| a pattern with a single `\|` and no scheme, like `\|example.com^` | it can never match; use `\|\|example.com^` |
| a regex redirect with no capture group, or more than one | none never redirects; with several, the destination is ambiguous |
| `urlPattern` without `indexPattern` (warning only, in `lint-rules`) | the provider is checked against every URL |
| a `fieldRedirections` entry starting with `@@` | `@@` only works for `$removeparam` filters in `rules` and `referralMarketing`; use a rule object's `exceptions` |
| `referralMarketing` on a rule outside `rules` and `referralMarketing`, or `flags` that is not a string | the key would do nothing there; `flags` only holds regex flags |
| `order` in `exceptions`, `redirections` or `fieldRedirections`, or on a `$removeparam` filter | those always run at a fixed step, so `order` would do nothing |
| `replacePattern`, `preprocessors`, `order` or `flags` on a `rawRules` entry `@@…$rawrule=…` | an `@@` entry only stops other raw rules, so those keys would do nothing |
| an `@@…$rawrule=regex` entry whose regex no raw rule in the provider uses | the exception would never stop anything; point at the rule with `targetId` |
| `targetId` that is not the `id` or an alias of a raw rule in the same provider | the exception would never stop anything |
| `targetId` without `@@`, together with a regex after `rawrule=`, or outside `rawRules` | only an `@@` entry in `rawRules` stops rules, and it names them one way |
| a `rawRules` entry with nothing after `rawrule=` | there is no regex to delete |
| an unknown option before `rawrule=`, or `removeparam` / `rawrule` among the options | only the `$removeparam` options from §4 apply, and `rawrule=` goes last |
| an option value the engine would ignore: empty `domain=` / `to=` / `method=`, an unknown method, `history-bypass-protection=` other than true/false, or contradictory party options | the rule would not do what it says |
| the same entry twice in one list (warning only, in `lint-rules`) | the copy does nothing, and both share one id |

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
  the rule by `id`, alias or generated id ([Rule ids](#rule-ids)) in
  `data/linkumori-clearurls.json` or the given file. If more than one
  provider has that id, it lists them; ask again with `<provider>::<id>`.
  If rules share the readable id you ask for, it lists their ids with the
  hash on the end.
- In the custom rules editor, *Copy rule* is next to each rule in the rule
  id list, which shows every rule of the provider with its id.
