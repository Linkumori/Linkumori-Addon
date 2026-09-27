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
| `order` | number controlling when this entry runs relative to a provider's other `rawRules`/`rules`/`referralMarketing` entries — lower numbers run earlier. Entries without `order` keep their default position (raw rules before field rules) |
| `referralMarketing` | `true`, set on an entry inside `rules`, makes it also behave as a referral-marketing rule without moving it into the separate `referralMarketing` array |
| `active` | `false` disables just this one rule, leaving it in the file for later re-enabling |

### Worked example

Using the `token-rewrite` object above, against a URL containing `?token=abc123`:

| Piece | Meaning |
| --- | --- |
| `matchPattern: "token"` | selects the `token` parameter, same as a plain entry in `rules` |
| `replacePattern: "clean-§1§"` | `§1§` is the parameter's *current value*; the new value becomes `clean-` followed by it |
| `order: 5` | this rewrite runs at position 5 among the provider's ordered `rawRules`/`rules` entries |

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
- **Complete providers:** a `completeProvider` blocks every request it matches before any rule is looked at, so `requestTypes` and `exceptions` from `defaults` also limit the block. `requestTypes`, together with its rules' own, become the provider's `resourceTypes` unless it sets some. `exceptions` are added to the provider's `exceptions`.
- **Checked:** unknown keys and wrong types are errors in `lint-rules` and the editor, and a remote file with an invalid `defaults` block is rejected.

## Processing order

For each matching provider: `exceptions` (skip if matched) → `redirections` → `fieldRedirections` → `completeProvider` → `rawRules` → `rules`/`referralMarketing` → `$removeparam` filters. A rule's `order` can move it earlier or later within that middle stretch. First provider to change, redirect, or block the URL wins, then the cycle repeats on the new URL.

## User whitelist

Separate from a provider's `exceptions` — this is a site the person has told the extension to leave alone entirely, no rule file involved. Entries look like `example.com`, `*.example.com` (root + subdomains), or `example.*` (any suffix). Whitelisting a page also covers everything it loads.
