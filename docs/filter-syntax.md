# Linkumori CLN Format 1.0

Oct 2, 2026 · @Subham

This page describes CLN Format 1.0 in its final form. The changes from the earlier 1.0 text, and why, are in [CLN Format 1.0 (Final)](cln-format-1.0.md).

Linkumori CLN (Clean Link Notation) is the JSON rule format Linkumori uses to strip tracking parameters, rewrite URL text, and redirect around trackers. A rule file is one JSON object with a `providers` object (and, optionally, `cln`, `metadata` and `defaults`). Each key under `providers` is a name you choose; its value is a provider object.

The optional top-level `cln` key names the format version. Its only valid value is `"1.0"`; a file without it loads as 1.0 too, and a file with any other value is rejected (a remote file is not loaded and Remote Rules Health reports it; a built-in or custom file fails `lint-rules`). It is not called `version` because the ClearURLs new rule format already uses that key.

```json
{
  "cln": "1.0",
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

## Provider fields

| Field | What it holds |
| --- | --- |
| `domainPatterns` | which URLs this provider handles — one pattern or an array of patterns (§Patterns below). Use this or `urlPattern`, never both. Example: `"domainPatterns": ["\|\|amazon.*^"]` |
| `urlPattern` | does the same job as `domainPatterns`, but as one regex string tested against the full URL, case-insensitive. Example: `"urlPattern": "^https?:\\/\\/(?:[a-z0-9-]+\\.)*?google\\."` |
| `indexPattern` | only meaningful alongside `urlPattern` — a `\|\|host^`-style hint (or array of them) so the engine only checks this provider against matching hosts, instead of testing the regex on every URL. Example: `"indexPattern": "\|\|google.com^"` |
| `rules` | array of query/fragment parameters to strip. Example: `"rules": ["utm_source", "fbclid"]` |
| `referralMarketing` | same entry syntax as `rules`, but this array only runs while the person has *not* turned on "allow referral marketing" in settings. Example: `"referralMarketing": ["ref", "tag"]` |
| `rawRules` | array of regexes run against the whole URL string; every match is deleted outright. Example: `"rawRules": ["\\/ref=[^/?]*"]` |
| `exceptions` | array of URLs (regex or domain pattern) this provider leaves completely alone — none of its other fields run when one matches. Example: `"exceptions": ["\|\|accounts.google.com^"]` |
| `redirections` | array sending matching requests to a different URL instead of editing them. Example: `"redirections": ["\|\|go.example.com^$redirect=https://example.com/"]` |
| `fieldRedirections` | array naming a parameter whose own value becomes the new URL — used for "click-through" redirect links. Example: `"fieldRedirections": ["redirect", "continue_url"]` |
| `completeProvider` | boolean; `true` blocks every request this provider matches outright (a full domain/URL block, not just parameter stripping) |
| `forceRedirection` | boolean; `true` means a redirect on a page load (`main_frame`) navigates the whole browser tab, not just the underlying network request |
| `methods` | array restricting this provider to specific HTTP methods. Example: `"methods": ["GET"]` |
| `resourceTypes` | array restricting this provider to specific request types. Example: `"resourceTypes": ["main_frame", "xmlhttprequest"]`. Left out, the provider handles every request type |
| `historyBypassProtection` | boolean, default `true`; `false` makes this whole provider skip same-page URL changes made via the History API (`pushState`/`replaceState`), while still applying to ordinary network requests |
| `active` | boolean; `false` disables the entire provider without deleting it from the file |

## Patterns

Used in `domainPatterns`, and in front of `exceptions`, `redirections`, `$removeparam`, and raw rules.

| Pattern | Matches |
| --- | --- |
| `\|\|example.com^` | `example.com` and every subdomain |
| `\|\|example.*^` | `example` on any suffix — `.de`, `.co.uk`, … |
| `\|\|example.com^/path` | that host when the path starts with `/path` |
| `\|https://example.com/` | URLs starting with exactly this text |
| `…\|` | URLs ending with exactly this text |
| `/regex/i` | the full URL as a regex |
| `example.com/path` (no leading `\|`) | contains this text anywhere |
| `*` | everything |

`^` means end-of-host or any separator (`/ ? :` or end of URL). `*` is a wildcard. A single `\|` needs a scheme after it (`\|https://…`) — for a domain you always want `\|\|`.

### Worked example

```
||smile.amazon.*^
```

| Piece | Meaning |
| --- | --- |
| `\|\|` | domain anchor — matches the host and every subdomain |
| `smile.amazon` | the literal label required |
| `.*` | any public suffix — `.com`, `.co.jp`, `.de`, … |
| `^` | end of host — nothing else may follow directly |

## rules / referralMarketing

Each entry removes a parameter, from the query (`?a=1`) or fragment (`#a=1`):

| Entry | Removes |
| --- | --- |
| `"utm_source"` | that exact parameter |
| `"utm_[a-z]+"` | any parameter whose whole name matches |
| `"$removeparam=fbclid"` | see below — lets you add domain/method/party limits |

To strip a parameter on only *some* of a provider's URLs, put a pattern in front of `$removeparam`:

```json
"rules": ["qid", "||amazon.de^$removeparam=tag"]
```

`referralMarketing` uses the exact same syntax, but only runs while the person hasn't turned on "allow referral marketing."

## $removeparam filters

### Syntax

`[@@][pattern]$removeparam[=value][,modifier,modifier,…]`

Five pieces, four of them optional:

- **`@@`** (optional) — turns this into an *exception*: it keeps a parameter instead of removing it, rather than matching anything itself. See "Exceptions" below.
- **`pattern`** (optional) — a domain pattern (§Patterns) narrowing the filter to only some of the provider's URLs, e.g. `||amazon.de^`. Leave it out and the filter applies to every URL the provider already matches — it can only narrow, never widen, what the provider covers.
- **`$removeparam`** — the keyword itself; always required.
- **`=value`** (optional) — which parameter(s) to target. Leave it out entirely (just `$removeparam`) to remove *every* parameter.
- **`,modifier,modifier,…`** (optional) — comma-separated conditions narrowing *when* the filter fires. Every modifier listed must hold; there's no "or" between them.

### Value

The first character after `=` decides what's targeted:

| Value | Removes |
| --- | --- |
| *(nothing after `=`, or no `=` at all)* | every parameter |
| `~name` | every parameter *except* `name` |
| `/regex/i` | any parameter whose name — or `name=value` together — matches; add `i` for case-insensitive |
| `\|prefix` | any parameter whose name starts with `prefix` |
| `name` | just that one parameter, by exact name |
| `\~name`, `\\|name`, `\/name/` | the parameter with that exact name, `~`, `\|` or `/` included |

A backslash makes the next character literal, so any parameter name can be targeted:

| Value | Removes the parameter named |
| --- | --- |
| `\~foo` | `~foo` |
| `\\|foo` | `\|foo` |
| `\/foo/` | `/foo/` |
| `a\,b` | `a,b` — the comma doesn't start the modifier list |
| `\\foo` | `\foo` |

- **Only these five.** `\~`, `\|`, `\/`, `\,` and `\\` are the escapes in a name value; a backslash before any other character is a `lint-rules` error.
- **Regex values** keep the backslash's regex meaning. A comma after a backslash never starts the modifier list, in any value form.
- **Everywhere a value is read:** `rules`, `referralMarketing`, `fieldRedirections` and `@@` entries.
- **In JSON** each backslash is written twice: `"$removeparam=\\~foo"`.

### Modifiers

Everything after the first comma — one comma-separated condition per modifier. Every modifier listed must hold; there's no "or" between them. `~` in front of a domain, method, or request-type value excludes it instead of requiring it. The four `*-party` modifiers are mutually exclusive with each other (combining opposites is rejected).

| Modifier | Group | Meaning |
| --- | --- | --- |
| `domain=a.com\|~b.com` | Where from/to | the *page* that made the request must (or, with `~`, must not) be one of these — a `\|`-separated list, regex values allowed |
| `to=a.com\|~b.com` | Where from/to | the request's own *target* must (or must not) be one of these, independent of what page made it |
| `method=get\|~post` | Where from/to | the HTTP method must (or must not) be one of `get`, `head`, `options`, `post`, `put`, `patch`, `delete`, `connect` |
| `first-party` | Party | request target shares the page's *registrable* domain — `a.example.com` and `b.example.com` count as the same party |
| `third-party` | Party | request target has a *different* registrable domain than the page |
| `strict-first-party` | Party | request target is the *exact same hostname* as the page |
| `strict-third-party` | Party | request target is any different hostname than the page — even a subdomain counts as third-party here |
| `document` | Request type | the top-level page load itself |
| `subdocument` | Request type | an iframe's own document |
| `script` | Request type | a JavaScript file |
| `stylesheet` | Request type | a CSS file |
| `image` | Request type | an image file |
| `imageset` | Request type | one candidate of an `<img srcset>` set |
| `media` | Request type | an audio or video file |
| `font` | Request type | a web font file |
| `object` | Request type | embedded plugin content (`<object>`, `<embed>`) |
| `xmlhttprequest` | Request type | an XHR or `fetch()` call made by page script |
| `websocket` | Request type | a WebSocket connection |
| `ping` | Request type | a `navigator.sendBeacon()` or link-ping request |
| `other` | Request type | anything not covered by the types above |
| `match-case` | Misc | parameter-name comparison becomes case-sensitive (default: case-folded) |
| `history-bypass-protection=false` | Misc | this filter is skipped on same-page URL changes (`pushState`/`replaceState`), though it still applies to normal network requests. Accepts `true`/`false`, `1`/`0`, or `yes`/`no` |

Any request-type row above can be written with a leading `~` (e.g. `~xmlhttprequest`) to exclude that type instead of requiring it.

### Worked example

```
||example.com^$removeparam=sid,domain=~partner.com,method=get,third-party
```

| Piece | Meaning |
| --- | --- |
| `\|\|example.com^` | pattern — only on `example.com` |
| `$removeparam=sid` | value — strip the `sid` parameter |
| `domain=~partner.com` | modifier — but not when the page making the request is `partner.com` |
| `method=get` | modifier — and only for GET requests |
| `third-party` | modifier — and only when that page is a different registrable domain than `example.com` |

All four conditions must hold at once for `sid` to be stripped.

### Exceptions (`@@`)

A filter beginning with `@@` keeps the parameter instead of removing it — the pattern and modifiers work exactly the same way, they just flip the outcome:

```json
"rules": ["$removeparam=ref", "@@||github.com^$removeparam=ref"]
```

Here every provider-matched URL loses `ref`, except on `github.com`, where it's kept. An `@@` entry also reaches into *other* providers' filters when the request comes from a page this provider matches — handy for carving out one site from a site-wide rule defined elsewhere.

An `@@` entry isn't a step with a place in the run order — where you list it doesn't matter, and it can't carry an `order`. For each parameter, the provider checks its `@@` entries first and its `$removeparam` filters second, and a matching `@@` entry keeps the parameter. It only guards against `$removeparam` filters: a plain `rules` entry such as `"ref"` still removes `ref` (use a rule object's `exceptions` for that), and raw rules have their own `@@…$rawrule=` entries. Its pattern and modifiers are checked against the URL as the provider received it at the start of the current cycle — before the provider's raw rules run — so an `@@` entry scoped to a path that a raw rule deletes still matches:

```json
"rawRules": ["\\/ref=[^/?]*"],
"rules": ["$removeparam=tag", "@@||shop.example^/ref=$removeparam=tag"]
```

For `https://shop.example/ref=abc?tag=1` the raw rule deletes `/ref=abc`, and `tag` is kept: the `@@` pattern is checked against the URL that still has `/ref=abc`.

## rawRules

Regexes run against the whole URL — every match gets deleted:

```json
"rawRules": ["\\/ref=[^/?]*"]
```

They run *before* `rules`, so they can strip things that aren't `name=value` pairs — like Amazon's `/ref=…` path segment. A raw rule can also carry a pattern and `$removeparam`-style options, with `rawrule=` last: `\|\|amazon.*^/dp/$rawrule=\\/ref=[^/?]*`. An `@@…$rawrule=` entry stops raw rules from running instead of matching anything itself.

### Worked example

```
||amazon.*^/dp/$rawrule=\/ref=[^/?]*
```

| Piece | Meaning |
| --- | --- |
| `\|\|amazon.*^/dp/` | pattern — only on Amazon URLs whose path starts with `/dp/` |
| `$rawrule=` | switches this from a plain regex into a pattern-scoped one |
| `\/ref=[^/?]*` | the regex — deletes `/ref=` and everything after it, up to the next `/` or `?` |

## exceptions

Each entry is a regex against the full URL, or a domain pattern starting with `\|`:

```json
"exceptions": ["^https?:\\/\\/mail\\.google\\.com\\/mail\\/u\\/", "||accounts.google.com^"]
```

If the URL matches, none of the provider's rules run for that request.

### Worked example

```
^https?:\/\/mail\.google\.com\/mail\/u\/
```

| Piece | Meaning |
| --- | --- |
| `^https?:\/\/` | start of the URL, http or https |
| `mail\.google\.com` | the literal host |
| `\/mail\/u\/` | the literal path prefix that must follow |

Any URL matching this stops the whole provider — Gmail keeps its tracking-looking parameters intact.

## redirections

Either a regex with exactly one capture group — the request goes to whatever that group captures:

```
^https?:\/\/(?:[a-z0-9-]+\.)*?google(?:\.[a-z]{2,}){1,}\/url\?.*?(?:url|q)=(https?[^&]+)
```

Or a fixed domain redirect:

```json
"||go.example.com^$redirect=https://example.com/"
```

### Redirect targets

A redirect only happens to an absolute `http` or `https` URL with a host. This holds for all three kinds of target — the capture group (or `replacePattern`) of a `redirections` regex, the fixed target of a `$redirect=` entry, and the parameter value a `fieldRedirections` entry picks — and is checked after the entry's preprocessors (and after percent-decoding). An invalid target makes the entry count as not matching: no redirect happens, and the provider's later stages run on the unchanged URL. `lint-rules` rejects a `$redirect=` entry whose fixed target isn't `http` or `https`.

| Target | Redirects? |
| --- | --- |
| `https://real.example/page` | yes |
| `https%3A%2F%2Freal.example%2Fpage` | yes, to `https://real.example/page` |
| `javascript:alert(1)`, `ftp://files.example/x` | no — scheme is not `http` or `https` |
| `//real.example/page`, `/local/page`, `real.example/page` | no — not an absolute URL |

A raw rule with a `replacePattern` whose result has a different scheme, host or port from its input is a redirect too: it needs a valid target, and in a remote file the `redirect` capability (§Remote file capabilities).

### Worked example

```
^https?:\/\/(?:[a-z0-9-]+\.)*?google(?:\.[a-z]{2,}){1,}\/url\?.*?(?:url|q)=(https?[^&]+)
```

| Piece | Meaning |
| --- | --- |
| `(?:[a-z0-9-]+\.)*?` | any subdomains in front of `google` |
| `google(?:\.[a-z]{2,}){1,}` | `google` on any public suffix |
| `\/url\?` | the redirect endpoint's path |
| `(?:url\|q)=` | either a `url=` or `q=` parameter introduces the target |
| `(https?[^&]+)` | the one capture group — its contents become the redirect URL |

## fieldRedirections

Names a parameter directly — its own value becomes the new URL, no regex needed:

```json
"fieldRedirections": ["redirect", "continue_url"]
```

Same entry types as `rules` (name, name regex, or `$removeparam` filter used just to pick the parameter). Whichever matching parameter comes first in the URL wins.

### Worked example

Given `https://site.example/away?redirect=https://real-destination.example/page`:

| Piece | Meaning |
| --- | --- |
| `redirect` | the parameter name listed in `fieldRedirections` |
| `https://real-destination.example/page` | its value — becomes the entire new request URL, verbatim, as long as it is a valid redirect target (§Redirect targets) |

## Rule objects

Any entry, in any list above, can be an object instead of a string — for a stable id, a custom run order, or a rewrite instead of a delete:

```json
{
  "id": "token-rewrite",
  "matchPattern": "token",
  "replacePattern": "clean-§1§",
  "requestTypes": ["main_frame"],
  "exceptions": ["^https:\\/\\/example\\.com\\/keep"],
  "order": 5,
  "active": true
}
```

| Key | Does |
| --- | --- |
| `matchPattern` | required — the exact string that would otherwise be written as a plain entry (a parameter name, a name regex, a `$removeparam` filter, a raw regex, a domain pattern, etc., depending which list this object sits in) |
| `id` | a stable identifier of your choosing (letters, digits, `-`, `_`) that the on/off toggle keys off. Leave it out and one is generated from the list and `matchPattern` text — fine until you edit that text, which changes the generated id and loses anyone's toggle setting |
| `aliases` | array of this rule's previous `id` values. When you rename `id`, add the old one here so a setting someone saved under the old id keeps applying |
| `replacePattern` | present → rewrite the matched text instead of deleting it. Reference capture groups from `matchPattern` (or, for a parameter-based rewrite, the parameter's value) as `§1§`, `§2§`, … Example: `"replacePattern": "clean-§1§"` |
| `preprocessors` | array of transforms applied to captured values before they're used in a rewrite or redirect, in order. Each is `{"type": <name>, "inputs": "all"}` or an index array. Types: `urlEncode`, `urlDecode`, `doubleUrlEncode`, `doubleUrlDecode`, `base64Encode`, `base64Decode` |
| `requestTypes` | array restricting this one rule to specific request types (same names as the `$removeparam` request-type option above) |
| `exceptions` | array of URLs (regex) this specific rule skips, independent of the provider's own `exceptions` |
| `order` | number controlling when this entry runs relative to the other entries of its stage — lower numbers run earlier. Raw rules always run before field rules, whatever their `order`; inside a stage, every entry with an `order` runs before every entry without one. `"order": null` means "no order, and don't inherit one" (§Same text twice). `$removeparam` filters and `@@` entries take no `order`, `null` included — `lint-rules` rejects it there. The exact sequence is under §Processing order |
| `referralMarketing` | `true`, set on an entry inside `rules`, makes it also behave as a referral-marketing rule without moving it into the separate `referralMarketing` array |
| `active` | `false` disables just this one rule, leaving it in the file for later re-enabling |

### Worked example

Using the `token-rewrite` object above, against a URL containing `?token=abc123`:

| Piece | Meaning |
| --- | --- |
| `matchPattern: "token"` | selects the `token` parameter, same as a plain entry in `rules` |
| `replacePattern: "clean-§1§"` | `§1§` is the parameter's *current value*; the new value becomes `clean-` followed by it |
| `order: 5` | this rewrite runs after every raw rule, then after any of the provider's `rules`/`referralMarketing` entries with a lower `order`, and before every field entry that has no `order` |

Result: `?token=abc123` becomes `?token=clean-abc123`.

## defaults

A top-level `defaults` block gives every rule of the file values it doesn't set itself, like the ClearURLs new rule format's `defaults`:

```json
{
  "defaults": { "requestTypes": ["main_frame"], "exceptions": ["^https:\\/\\/example\\.com\\/keep"] },
  "providers": { … }
}
```

| Key | Default for each rule's… |
| --- | --- |
| `active` | `active`; `false` switches every rule of the file off unless it says `"active": true` |
| `description` | `description` |
| `requestTypes` | `requestTypes`; `"all"` (or leaving it out) means every type |
| `preprocessors` | `preprocessors` |
| `exceptions` | `exceptions` |
| `historyBypassProtection` | `historyBypassProtection` |

- **A rule's own value always wins**, and a rule's `exceptions` replace the default list rather than adding to it. A provider's own `historyBypassProtection` beats the file default too.
- **Which lists:** `rules`, `rawRules`, `referralMarketing`, `redirections` and `fieldRedirections`. A provider's `exceptions` list is left alone, so a default can't switch every exception off. `|`-pattern entries (`$redirect=` redirects) only use `active`.
- **Per file:** defaults are written into the file's own rules when it loads. Built-in, each remote file, and custom rules keep their own defaults, including when overload mode merges built-in and remote rules. Custom rules' defaults are edited in the custom rules editor, which also shows the defaults each loaded source uses.
- **Your own defaults:** in the custom rules editor, "Manage rule defaults" opens a form where you can fill in one `defaults` block of your own (and the custom rules' own) and choose where yours replaces the files' own:
  - *Each source's own* (the default): every file uses its own `defaults`, as above.
  - *Yours for built-in and remote rules*: built-in and every remote file use yours, and ignore their own `defaults`. Custom rules keep their own.
  - *Yours for all rules*: every rule uses yours, and no file's own `defaults` is used.

  A rule's own value still wins, and provider `exceptions` are still left alone.
- **Editing a file's own defaults:** the same form can edit the built-in rules' defaults and each loaded remote file's. Your version is stored in the extension, not in the file, and replaces that file's whole `defaults` block wherever the file's own would be used. "Reset to the file's defaults" drops it. An edit for a remote file is kept while that file is not loaded.
- **Merging defaults:** "Merge from sources…" combines the defaults of any sources you tick (your own, built-in, each remote file, custom). The result appears as "Merged defaults" in the list of sets; copy it into one of them, then save. Keys the sources agree on are taken as they are, and `exceptions` are always added together: the exceptions of the set on screen first, then every other source's, without duplicates. For each other key they disagree on you pick one source's value or, for `requestTypes` and `preprocessors`, the combined list (a source that leaves `requestTypes` out keeps every type allowed). Nothing is stored until you save.
- **Complete providers:** a `completeProvider` blocks every request it matches before any rule is looked at, so `requestTypes` and `exceptions` from `defaults` also limit the block. `requestTypes`, together with its rules' own, become the provider's `resourceTypes` unless it sets some. `exceptions` are added to the provider's `exceptions`.
- **Checked:** unknown keys and wrong types are errors in `lint-rules` and the editor, and a remote file with an invalid `defaults` block is rejected.

## Processing order

For each matching provider: `exceptions` (skip if matched) → `redirections` → `fieldRedirections` → `completeProvider` → `rawRules` → `rules`/`referralMarketing` → `$removeparam` filters. A rule's `order` can move it earlier or later within its own stage, never across stages. First provider to change, redirect, or block the URL wins, then the cycle repeats on the new URL (§Termination).

### Run order

Stages 5 and 6 — every `rawRules`, `rules` and `referralMarketing` entry of the provider, bare strings and rule objects alike, except `$removeparam` filters and their `@@` exceptions, which always run afterwards (§Exceptions) — run in ascending order of one sort key:

`(stage, orderGroup, order, rank, arrayIndex)`

| Part | Value |
| --- | --- |
| `stage` | `0` for a `rawRules` entry; `1` for a `rules` or `referralMarketing` entry |
| `orderGroup` | `0` if the entry is a rule object with a numeric `order`; `1` otherwise |
| `order` | the entry's own `order`. Compared only between two `orderGroup` `0` entries of the same stage. Negative numbers and fractions are allowed |
| `rank` | which array the entry sits in, from the table below |
| `arrayIndex` | the entry's zero-based position in its own array, with no exceptions |

| Array | `stage` | `rank` |
| --- | --- | --- |
| `rawRules` | `0` | `0` |
| `rules` | `1` | `0` |
| `rules`, object with `"referralMarketing": true` | `1` | `1` |
| `referralMarketing` | `1` | `2` |

Entries that are off (`"active": false`, toggled off, or referral-marketing entries while the person allows referral marketing) are left out, and entries with the same text count once (§Same text twice). Read the key left to right; the first part that differs decides:

- **Stage decides first.** No `order` value moves a field rule ahead of a raw rule. A cleanup that must happen before a raw rule is written as a raw rule — a raw rule is a regex against the whole URL, so it can express any parameter removal.
- **Inside a stage, ordered entries run before unordered ones,** lowest `order` first. `order: 10` doesn't mean "tenth": it means "after the stage's other ordered entries with `order` below 10, and before all of its unordered entries".
- **At equal `order`, or with none,** entries run by `rank`, then by `arrayIndex`: `rules`, then `rules` objects marked `"referralMarketing": true`, then `referralMarketing`, each in array order. So `"referralMarketing": true` moves an unordered entry after the provider's unmarked `rules` entries.
- **Every entry runs at its array position.** An entry written like `"3"` or `"20"` is no exception: it keeps its place like any other entry. (Under the earlier 1.0 text these jumped ahead of their group, because the engine kept its rule lists in plain objects; it now keeps them in order-preserving maps.)
- **The key is total.** Every provider has exactly one sequence.

### Same text twice

Two entries with the same `matchPattern` text in one group are one entry, and only one definition of it takes effect. The groups are:

| Group | Holds |
| --- | --- |
| raw | `rawRules` |
| field | `rules` entries without `"referralMarketing": true` |
| referral | `rules` objects with `"referralMarketing": true`, then `referralMarketing` |

- **The last definition that isn't off wins, whole** — its `id`, its `replacePattern` and every other key. A later definition that's off doesn't remove an earlier one.
- **Its place.** A winning definition with its own numeric `order` sorts by its own `order`, `rank` and `arrayIndex`. One without its own `order` takes its `rank` and `arrayIndex` from the *first* definition that isn't off, and its `order` from the *nearest* earlier definition that has an `order` key.
- **`"order": null`** means "no order, and do not inherit one". It is the explicit way to drop an `order` set by an earlier definition; the definition then takes the first definition's place.
- **Ids.** The `id` and `aliases` of every replaced definition switch the winner on and off too (§Rule ids and toggles).
- **Across field and referral:** while referral-marketing rules run, a referral entry with the same text as a field entry replaces it. Without its own `order` it takes the field entry's place, including that entry's `order`. While the person allows referral marketing, the field entry runs alone.
- Raw and field entries with the same text don't collide — both run.

| First definition | Later definition | What runs |
| --- | --- | --- |
| `token`, `order: 1` | `"token"` | `order: 1`; first definition's index |
| `token`, `order: 1` | `token`, `order: 50` | `order: 50`; own index |
| `token`, `order: 1` | `token`, `"order": null` | no `order`; first definition's index |
| `"token"` | `token` with a `replacePattern` | the rewrite, at the first definition's index |

Inheritance exists for merges across files, not as an authoring feature: `lint-rules` and the editor reject two different entries with the same text in one array, and warn about an exact copy. They also warn about the same text in `rules` and `referralMarketing`, and in `rules` with and without `"referralMarketing": true`. `$removeparam` filters don't count here — each one runs.

#### Overload mode

In overload mode the built-in rules and your remote rule files load together, and one site can have a provider in more than one of them. Before any rule runs, those providers are merged into one:

1. **Load order.** Your remote files are merged with each other first, in the order you list them. The result is then merged with the built-in rules: built-in providers first, remote ones after.
2. **Which providers merge.** Only providers with the same `domainPatterns` (or the same `urlPattern`) *and* the same `methods`, `resourceTypes`, `completeProvider` and `forceRedirection`. Any other provider stays separate and keeps its own rules.
3. **Joining the lists.** Each of `rules`, `rawRules` and `referralMarketing` is joined in load order — built-in entries first, then each remote file's.
4. **Exact copies.** Only entries that are exactly alike count once while joining. `order` is part of what makes two entries alike, `"order": null` included.

The merged provider then runs like any other, so §Same text twice applies: after a merge the last definition is the remote one — with several remote files, the last-listed file's. A remote copy without an `order` keeps the `order` of the copy it replaces; to drop it, the remote copy sets `"order": null`.

| Built-in | Remote | What runs |
| --- | --- | --- |
| `token`, `order: 1` | `token`, `order: 50` | `token` at `order: 50` |
| `token`, `order: 1` | `"token"` | `token` at `order: 1` |
| `token`, `order: 1` | `token`, `"order": null` | `token` with no `order` |
| `token`, `order: 1` | file 1: `token`, `order: 20`; file 2: `token`, `order: 30` | `token` at `order: 30` |
| `token`, `order: 1` | file 1: `token`, `order: 20`; file 2: `"token"` | `token` at `order: 20` |
| `a` `order: 1`, `b` `order: 2` | `b` `order: 1`, `a` `order: 2` | `b`, then `a` |
| `fromBuiltIn`, `order: 5` | `fromRemote`, `order: 5` | both; `fromBuiltIn` first |
| `token` `order: 1` on `\|\|site.example^` | `token` `order: 50` on `\|\|other.example^` | not merged — two providers |
| `rules`: `"tag"` | `referralMarketing`: `"tag"` | the `referralMarketing` entry replaces the `rules` one while referral-marketing rules run |

Remote Rules Health lists each rule a merge replaces as a **notice** naming the file whose definition won; an **error** is reserved for a file or entry that did not load. It also warns when a merge puts the same text in `rules` from one file and in `referralMarketing` (or a `rules` entry with `"referralMarketing": true`) from another.

### Worked example

```json
{
  "cln": "1.0",
  "providers": {
    "shop": {
      "domainPatterns": ["||shop.example^"],
      "rawRules": [
        "\\/ref=[^/?]*",
        { "id": "strip-jsessionid", "matchPattern": ";jsessionid=[^/?#]*", "order": 20 }
      ],
      "rules": [
        "utm_source",
        { "id": "token-rewrite", "matchPattern": "token", "replacePattern": "clean-§1§", "order": 5 },
        "fbclid",
        { "id": "aff-id", "matchPattern": "aff_id", "referralMarketing": true },
        { "id": "sid", "matchPattern": "sid", "order": 20 },
        "$removeparam=/^pk_/"
      ],
      "referralMarketing": ["tag"]
    }
  }
}
```

With "allow referral marketing" off, the provider runs:

| # | Entry | `(stage, orderGroup, order, rank, arrayIndex)` |
| --- | --- | --- |
| 1 | `rawRules[1]` `strip-jsessionid` | `(0, 0, 20, 0, 1)` |
| 2 | `rawRules[0]` `"\\/ref=[^/?]*"` | `(0, 1, –, 0, 0)` |
| 3 | `rules[1]` `token-rewrite` | `(1, 0, 5, 0, 1)` |
| 4 | `rules[4]` `sid` | `(1, 0, 20, 0, 4)` |
| 5 | `rules[0]` `"utm_source"` | `(1, 1, –, 0, 0)` |
| 6 | `rules[2]` `"fbclid"` | `(1, 1, –, 0, 2)` |
| 7 | `rules[3]` `aff-id` | `(1, 1, –, 1, 3)` |
| 8 | `referralMarketing[0]` `"tag"` | `(1, 1, –, 2, 0)` |

Then `rules[5]` `"$removeparam=/^pk_/"`, with the provider's other `$removeparam` filters — it's outside the sort. With "allow referral marketing" on, 7 and 8 are left out and the rest keep their order. Both raw rules finish before `token-rewrite` reads the URL.

### Worked example — whole numbers

```json
{
  "cln": "1.0",
  "providers": {
    "numbers": {
      "domainPatterns": ["||numbers.example^"],
      "rawRules": ["r", "3"],
      "rules": ["a", "20", { "matchPattern": "9", "referralMarketing": true }, "b"],
      "referralMarketing": ["rm", "5"]
    }
  }
}
```

With "allow referral marketing" off:

| # | Entry | `(stage, orderGroup, order, rank, arrayIndex)` |
| --- | --- | --- |
| 1 | `rawRules[0]` `"r"` | `(0, 1, –, 0, 0)` |
| 2 | `rawRules[1]` `"3"` | `(0, 1, –, 0, 1)` |
| 3 | `rules[0]` `"a"` | `(1, 1, –, 0, 0)` |
| 4 | `rules[1]` `"20"` | `(1, 1, –, 0, 1)` |
| 5 | `rules[3]` `"b"` | `(1, 1, –, 0, 3)` |
| 6 | `rules[2]` `"9"` | `(1, 1, –, 1, 2)` |
| 7 | `referralMarketing[0]` `"rm"` | `(1, 1, –, 2, 0)` |
| 8 | `referralMarketing[1]` `"5"` | `(1, 1, –, 2, 1)` |

Every entry runs where the file lists it. Rows 6 to 8 follow the unmarked `rules` entries because of `rank`, not because of their text.

### Rule ids and toggles

A rule's on/off toggle is keyed by provider and rule together, `providerKey::id` (for example `shop::token-rewrite`), so two providers can use the same rule id without sharing a switch. The custom rules editor may also save it under the provider's match pattern (`domainPattern:||shop.example^::token-rewrite`); both forms work. An `id` can't contain a colon, so a key splits at its last `::`.

- **Unique in a provider.** Within one provider of one file, every `id` and every alias is distinct; a repeat is a `lint-rules` error. Generated ids count.
- **Replaced definitions.** When one definition replaces another (§Same text twice), the `id` and `aliases` of each replaced definition switch the winner. Toggling any of them switches the one rule that runs.
- **No bare ids.** A toggle saved under a bare `id`, without its provider, switches nothing; switch the rule off again in the custom rules editor.
- **Shared keys.** Two providers that share a key but do not merge also share toggles for equal ids. Remote Rules Health warns about each such pair.
- **Generated ids** are unchanged: an id is generated from the list and the `matchPattern` text when left out, and changes when that text is edited.

The built-in rules define `token` with `"id": "token-rewrite"` in provider `shop`, and the person switches `shop::token-rewrite` off. A remote file then replaces that rule with a definition whose `id` is `tok`: the remote definition runs, the saved toggle keeps it off, and both `shop::tok` and `shop::token-rewrite` switch it.

### Termination

Processing a request always ends:

- **Cycle cap.** At most 10 cycles run per request — a cycle being one pass of the providers over the URL, repeated after each change or redirect. At the cap, processing stops and the URL is used as it stands.
- **Rewrites run once.** An entry with a `replacePattern` applies at most once per request. `token-rewrite` above turns `https://shop.example/?token=abc123` into `https://shop.example/?token=clean-abc123`, and that does not change on any later cycle.
- **No-op steps.** A step whose output equals its input is not a change and does not start a new cycle.

### Remote file capabilities

A remote file's capabilities are derived from its content when it loads; a file does not declare them.

| Capability | A file has it when it contains | Active on load |
| --- | --- | --- |
| `strip` | a `rules`, `rawRules` or `referralMarketing` entry, or a `$removeparam` filter | yes |
| `rewrite` | an entry with a `replacePattern` | yes |
| `except` | a provider `exceptions` entry or an `@@` entry | yes |
| `redirect` | a `redirections` or `fieldRedirections` entry, or `forceRedirection` | after acceptance |
| `block` | a provider with `"completeProvider": true` | after acceptance |

- **Built-in and custom rules** hold every capability.
- **Acceptance** is given per remote file and per capability, in Remote Rules Health. Until then that file's redirect or block entries stay inactive — and its raw rules can't rewrite a URL to another origin — while the rest of the file loads.
- **Updates.** When an update gives a file a capability it did not have, the new capability's entries stay inactive until accepted.
- **No carry-over.** Every remote file starts with only `strip`, `rewrite` and `except`, including files configured before capabilities existed; accept `redirect` and `block` in Remote Rules Health.
- **Visibility.** Remote Rules Health lists each remote file's capabilities.

### Possible 2.0 direction

Left for 2.0 (see [CLN Format 1.0 (Final)](cln-format-1.0.md#deferred-to-20)):

- **One rules array.** All three kinds in a single `rules` array whose array order is the run order. An explicit `stage` key has little left to add now that `order` cannot cross stages.
- **Two spellings for referral marketing**, the `referralMarketing` array and the `"referralMarketing": true` flag.
- **String mini-languages**, redirects and `$removeparam` filters outside the sort, a converter to and from the ClearURLs formats, and generated ids that change with their text.

## User whitelist

Separate from a provider's `exceptions` — this is a site the person has told the extension to leave alone entirely, no rule file involved. Entries look like `example.com`, `*.example.com` (root + subdomains), or `example.*` (any suffix). Whitelisting a page also covers everything it loads.
