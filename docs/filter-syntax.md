# Linkumori CLN Format 1.0

Sep 27, 2026 · @Subham



Linkumori CLN (Clean Link Notation) is the JSON rule format Linkumori uses to strip tracking parameters, rewrite URL text, and redirect around trackers. A rule file is one JSON object with a `providers` object (and, optionally, `metadata` and `defaults`). Each key under `providers` is a name you choose; its value is a provider object.

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

Because the leading character carries meaning, a parameter actually named `~foo` or starting with `\|` can't be targeted this way — use a plain name-regex entry in `rules` instead.

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

An `@@` entry isn't a step with a place in the run order — where you list it doesn't matter, and it can't carry an `order`. For each parameter, the provider checks its `@@` entries first and its `$removeparam` filters second, and a matching `@@` entry keeps the parameter. It only guards against `$removeparam` filters: a plain `rules` entry such as `"ref"` still removes `ref` (use a rule object's `exceptions` for that), and raw rules have their own `@@…$rawrule=` entries. Its pattern and modifiers are checked against the URL as it stands after the provider's raw rules have run — so an `@@` entry scoped to a path that a raw rule deletes no longer matches.

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
| `https://real-destination.example/page` | its value — becomes the entire new request URL, verbatim |

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
| `order` | number controlling when this entry runs relative to a provider's other `rawRules`/`rules`/`referralMarketing` entries — lower numbers run earlier. Every entry with an `order` runs before every entry without one, raw rules included; entries without `order` keep their default position (raw rules before field rules). Has no effect on `$removeparam` filters, and `lint-rules` rejects it there. The exact sequence is under §Processing order |
| `referralMarketing` | `true`, set on an entry inside `rules`, makes it also behave as a referral-marketing rule without moving it into the separate `referralMarketing` array |
| `active` | `false` disables just this one rule, leaving it in the file for later re-enabling |

### Worked example

Using the `token-rewrite` object above, against a URL containing `?token=abc123`:

| Piece | Meaning |
| --- | --- |
| `matchPattern: "token"` | selects the `token` parameter, same as a plain entry in `rules` |
| `replacePattern: "clean-§1§"` | `§1§` is the parameter's *current value*; the new value becomes `clean-` followed by it |
| `order: 5` | this rewrite runs after any of the provider's `rawRules`/`rules`/`referralMarketing` entries with a lower `order`, and before every entry that has no `order` |

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

For each matching provider: `exceptions` (skip if matched) → `redirections` → `fieldRedirections` → `completeProvider` → `rawRules` → `rules`/`referralMarketing` → `$removeparam` filters. A rule's `order` can move it earlier or later within that middle stretch. First provider to change, redirect, or block the URL wins, then the cycle repeats on the new URL.

### The middle stretch

The middle stretch is every `rawRules`, `rules` and `referralMarketing` entry of the provider, taken together as one list — bare strings and rule objects alike — except `$removeparam` filters and their `@@` exceptions, which always run afterwards (§Exceptions). Entries that are off (`"active": false`, toggled off, or referral-marketing entries while the person allows referral marketing) are left out, and entries with the same text count once (§Same text twice below). The rest run in ascending order of this sort key:

`(orderGroup, order, rank, arrayIndex)`

| Part | Value |
| --- | --- |
| `orderGroup` | `0` if the entry is a rule object with a numeric `order`; `1` otherwise. Every bare string is `1` |
| `order` | the entry's own `order`. Only compared between two `orderGroup` `0` entries — `orderGroup` `1` entries have none, and their position comes from `rank` and `arrayIndex` alone. Negative numbers and fractions are allowed |
| `rank` | which array the entry sits in, from the table below — the same in both groups |
| `arrayIndex` | the entry's zero-based position within its own array (`rules[3]` → `3`) — except for a whole-number `matchPattern` without `order`, where it's the number itself |

| Array | `rank` |
| --- | --- |
| `rawRules`, whole-number `matchPattern` without `order` | `0` |
| `rawRules` | `1` |
| `rules` or `referralMarketing`, whole-number `matchPattern` without `order` | `2` |
| `rules` | `3` |
| `rules`, object with `"referralMarketing": true` | `4` |
| `referralMarketing` | `5` |

A whole-number `matchPattern` with an `order` ranks as any other entry of its array.

A whole-number `matchPattern` is one written like `"0"` or `"123"` — digits only, no leading zero, at most `4294967294`. `"007"`, `"-1"` and `"1.5"` aren't whole numbers here.

Read the key left to right; the first part that differs decides. That gives you these rules:

- **Every entry with an `order` runs before every entry without one.** The number is never compared with an array index. `order: 10` doesn't mean "tenth": it means "after the provider's other ordered entries with `order` below 10, and before all of its unordered entries". This is also why an explicit `order` always wins over an implicit position — otherwise `order: 1` would silently lose to whichever unordered entry happens to sit at index 1.
- **Without an `order`, entries keep their default position** (whole numbers aside, below): `rawRules` in array order, then `rules` in array order, then the `rules` objects marked `"referralMarketing": true` in array order, then `referralMarketing` in array order. So `"referralMarketing": true` does move an unordered entry: it runs after the provider's unmarked `rules` entries, and before the `referralMarketing` array. With an `order`, the flag only matters at equal `order`, below.
- **A whole-number `matchPattern` without `order` leaves its place.** It runs ahead of the other unordered entries of its group, smallest number first: in `rawRules`, ahead of the other raw rules; in `rules` or `referralMarketing`, ahead of every unordered `rules` and `referralMarketing` entry, whichever array it sits in. The provider keeps these lists by text, and number-like text sorts first. If its place matters, give it an `order`; `lint-rules` and the editor warn about each one that has none.
- **At equal `order`, entries run in the default order:** `rawRules`, then `rules`, then `rules` objects marked `"referralMarketing": true`, then `referralMarketing`, each by `arrayIndex`. This is the same stage order as without an `order`, so adding an `order` never changes which stage wins a tie. (Earlier versions were inconsistent here: at equal `order`, `rules` and marked `rules` entries ran before `rawRules`, the opposite of the default.) An equal `order` is enough to keep a raw rule ahead of a field rule; a field rule runs before a raw rule only with a strictly lower `order`.
- **Two entries never compare equal** — within one array their `arrayIndex` differs, and two whole numbers in one group are different numbers once the same text counts once. The key is total, so every provider has exactly one sequence.

> **Note — crossing the raw → field boundary.** The sort key makes crossing it well-defined, not safe. Raw rules run first so they can delete things that aren't `name=value` pairs — `/ref=…` path segments, `;jsessionid=…` — before the parameter pass reads the URL. Any `order` on a `rules` or `referralMarketing` entry lifts it above every unordered raw rule; the parameter pass then sees the URL before it's been cleaned, so it can match, rewrite or strip the wrong thing. Leave the boundary intact unless you have a specific reason not to: if one entry in a provider needs an `order`, give its raw rules an `order` too, lower than every field rule's.

### Same text twice

Two entries with the same `matchPattern` text in one group are one entry, and only one definition of it takes effect. The groups are:

| Group | Holds |
| --- | --- |
| raw | `rawRules` |
| field | `rules` entries without `"referralMarketing": true` |
| referral | `rules` objects with `"referralMarketing": true`, then `referralMarketing` |

- **The last definition that isn't off wins, whole** — its `id`, `order`, `replacePattern` and every other key. The earlier definitions do nothing: their `order` has no effect, and toggling their `id` switches nothing. A later definition that's off doesn't remove an earlier one.
- **Its place:** with an `order`, the winning definition sorts by its own `order`, `rank` and `arrayIndex`. Without one, it takes the place of the *first* definition that isn't off.
- **Across field and referral:** while referral-marketing rules run, a referral entry with the same text as a field entry replaces it, whichever comes first in the file, and without an `order` it takes the field entry's place. While the person allows referral marketing, the field entry runs alone.
- Raw and field entries with the same text don't collide — both run.

`lint-rules` and the editor reject two different entries with the same text in one array, and warn about an exact copy. They also warn about the same text in `rules` and `referralMarketing`, and in `rules` with and without `"referralMarketing": true`. `$removeparam` filters don't count here — each one runs.

### Worked example

```json
{
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

| # | Entry | `(orderGroup, order, rank, arrayIndex)` |
| --- | --- | --- |
| 1 | `rules[1]` `token-rewrite` | `(0, 5, 3, 1)` |
| 2 | `rawRules[1]` `strip-jsessionid` | `(0, 20, 1, 1)` |
| 3 | `rules[4]` `sid` | `(0, 20, 3, 4)` |
| 4 | `rawRules[0]` `"\\/ref=[^/?]*"` | `(1, –, 1, 0)` |
| 5 | `rules[0]` `"utm_source"` | `(1, –, 3, 0)` |
| 6 | `rules[2]` `"fbclid"` | `(1, –, 3, 2)` |
| 7 | `rules[3]` `aff-id` | `(1, –, 4, 3)` |
| 8 | `referralMarketing[0]` `"tag"` | `(1, –, 5, 0)` |

Then `rules[5]` `"$removeparam=/^pk_/"`, with the provider's other `$removeparam` filters — it's outside the sort. With "allow referral marketing" on, 7 and 8 are left out and the rest keep their order.

| Row | Why |
| --- | --- |
| 1 | `order: 5` is the lowest `order` in the provider |
| 2, 3 | same `order: 20`; `rawRules` ranks `1`, `rules` ranks `3` |
| 2, 4 | the ordered raw rule runs before the unordered one, though it sits later in `rawRules` |
| 1, 4 | `token-rewrite` has a lower `order` than the raw rule `strip-jsessionid` *and* runs before the unordered raw rule `/ref=` — `token` is read before `/ref=…` is deleted from the path. See the note above |
| 7 | the unordered `"referralMarketing": true` object runs after every unmarked unordered `rules` entry, then the `referralMarketing` array |

### Worked example — whole numbers and the same text twice

```json
{
  "providers": {
    "traps": {
      "domainPatterns": ["||traps.example^"],
      "rawRules": ["r", "3"],
      "rules": [
        { "id": "dup-early", "matchPattern": "dup", "order": 1 },
        "a",
        "20",
        { "matchPattern": "9", "referralMarketing": true },
        { "id": "dup-late", "matchPattern": "dup", "order": 50 },
        "b"
      ],
      "referralMarketing": ["rm", "5"]
    }
  }
}
```

With "allow referral marketing" off, the provider runs:

| # | Entry | `(orderGroup, order, rank, arrayIndex)` |
| --- | --- | --- |
| 1 | `rules[4]` `dup-late` | `(0, 50, 3, 4)` |
| 2 | `rawRules[1]` `"3"` | `(1, –, 0, 3)` |
| 3 | `rawRules[0]` `"r"` | `(1, –, 1, 0)` |
| 4 | `referralMarketing[1]` `"5"` | `(1, –, 2, 5)` |
| 5 | `rules[3]` `"9"` | `(1, –, 2, 9)` |
| 6 | `rules[2]` `"20"` | `(1, –, 2, 20)` |
| 7 | `rules[1]` `"a"` | `(1, –, 3, 1)` |
| 8 | `rules[5]` `"b"` | `(1, –, 3, 5)` |
| 9 | `referralMarketing[0]` `"rm"` | `(1, –, 5, 0)` |

| Row | Why |
| --- | --- |
| 1 | `dup-early` and `dup-late` are one entry; the later definition wins, so it runs at `order: 50` and `dup-early`'s `order: 1` does nothing. Toggling `dup-early` off switches nothing |
| 2 | `"3"` is a whole number, so it runs ahead of `"r"`, though it's listed after it |
| 4–6 | whole numbers in `rules` and `referralMarketing` run ahead of every other unordered entry of both arrays, smallest first — `"5"` from `referralMarketing` included |

With "allow referral marketing" on, rows 4, 5 and 9 are left out and the rest keep their order.

`lint-rules` rejects this provider — the two `dup` entries are an error, and each whole number without an `order` is a warning. Both are what you'd fix in a real file.

### Possible 2.0 direction

Not part of 1.0 — two candidates, neither decided:

- **An explicit stage.** A `stage` key (`raw` \| `field` \| `referral`) on each entry, with `order` only compared within one stage. Stage order would then never depend on a number, and running a field rule before raw rules would take a visible `"stage"` change in a diff instead of a small `order`.
- **One array.** All three kinds in a single `rules` array whose array order is the run order, each entry saying what kind it is. That would remove the need for `order` entirely.

### Open questions

Left open by this section:

- Whether the raw → field boundary should become uncrossable by `order`, so an `order` alone can't lift a field rule above an unordered raw rule.

## User whitelist

Separate from a provider's `exceptions` — this is a site the person has told the extension to leave alone entirely, no rule file involved. Entries look like `example.com`, `*.example.com` (root + subdomains), or `example.*` (any suffix). Whitelisting a page also covers everything it loads.
