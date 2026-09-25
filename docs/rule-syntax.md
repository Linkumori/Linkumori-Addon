# Linkumori rule syntax

Rules live in `data/linkumori-clearurls.json` (bundled), in remote rule
lists, and in the custom rules editor. All three use the same format.

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

## Provider fields

| Field | Type | What it does |
|---|---|---|
| `domainPatterns` | array | Which URLs the provider handles (see [Patterns](#patterns)). Use this **or** `urlPattern`. |
| `urlPattern` | string | Which URLs the provider handles, as a regex matched against the full URL (case-insensitive). |
| `indexPattern` | string or array | Only with `urlPattern`: `\|\|host^` hints so the provider is only checked for those hosts. Without it, a `urlPattern` provider is checked for every URL. |
| `rules` | array | Query/fragment parameters to remove (see [rules](#rules)). |
| `referralMarketing` | array | Referral/affiliate parameters to remove. Same syntax as `rules`; skipped while *Allow referral marketing* is on. |
| `rawRules` | array | Regexes run against the full URL; every match is deleted. |
| `exceptions` | array | URLs the provider leaves alone (see [exceptions](#exceptions)). |
| `redirections` | array | Where to send the request instead (see [redirections](#redirections)). |
| `completeProvider` | boolean | `true` blocks every request the provider matches. |
| `forceRedirection` | boolean | `true`: for page loads, redirects navigate the tab instead of redirecting the request. |
| `methods` | array | Only handle these HTTP methods, e.g. `["GET"]`. |
| `resourceTypes` | array | Only handle these request types, e.g. `["main_frame", "xmlhttprequest"]`. |
| `historyBypassProtection` | boolean | `false` skips this provider when a page changes its own URL with the History API (pushState/replaceState). Default `true`. |
| `active` | boolean | `false` switches the provider off. |

If a provider has both `domainPatterns` and `urlPattern`, `domainPatterns` is used.

## Patterns

Used by `domainPatterns`, by `|`-prefixed `exceptions` and `redirections`,
and in front of `$removeparam`.

| Pattern | Matches |
|---|---|
| `\|\|example.com^` | `example.com` and every subdomain |
| `\|\|example.*^` | `example` on any public suffix (`example.de`, `example.co.uk`, …) |
| `\|\|example.com^/path` | that host (and subdomains) when the path starts with `/path` |
| `\|https://example.com/` | URLs that start with this text |
| `/regex/i` | the full URL, as a regular expression |
| `*` | every URL |

`^` marks the end of the host name; `*` matches anything.

## rules

Each entry is one of:

| Entry | Example | Removes |
|---|---|---|
| parameter name | `"utm_source"` | `utm_source` |
| name regex | `"utm_[a-z]+"` | any parameter whose whole name matches (case-insensitive) |
| `$removeparam` filter | `"$removeparam=fbclid"` | see below |

`referralMarketing` takes exactly the same entries.

### $removeparam filters

`[@@][pattern]$removeparam[=value][,modifier…]`

| Value | Removes |
|---|---|
| *(none)* | every parameter |
| `name` | that parameter |
| `/regex/i` | parameters whose name, or `name=value`, matches |
| `~name` / `~/regex/` | every parameter **except** the match |
| `\|prefix` | parameters whose name starts with `prefix` |

The optional pattern in front limits the filter to matching URLs:
`||example.com^/search$removeparam=q`.

| Modifier | Meaning |
|---|---|
| `domain=a.com\|~b.com` | only on pages from these domains (`~` excludes); regexes allowed |
| `to=a.com` | only for requests to these domains |
| `denyallow=a.com` | not for requests to these domains |
| `method=get\|~post` | only for these HTTP methods |
| `first-party`, `third-party`, `strict-first-party`, `strict-third-party` | request party |
| `document`, `subdocument`, `script`, `stylesheet`, `image`, `media`, `font`, `object`, `xmlhttprequest`, `websocket`, `ping`, `other` (`~` excludes) | request type |
| `match-case` | case-sensitive parameter names |
| `history-bypass-protection=false` | skip this filter for History API URL changes |
| `badfilter` | cancel an identical filter (for example one from another list) |

**`@@` exceptions:** a filter starting with `@@` keeps the parameter instead
of removing it:

```json
"rules": [
  "$removeparam=ref",
  "@@||github.com^$removeparam=ref"
]
```

An `@@` exception covers its own provider's URLs, and also requests handled
by other providers when they come from a page this provider matches. In
`referralMarketing` it only applies while referral marketing is blocked.

## exceptions

Each entry is either:

- a **regex** matched against the full URL (case-insensitive), or
- a **domain pattern** starting with `|`, such as `||example.com^` or
  `||example.com^/login` (see [Patterns](#patterns)).

```json
"exceptions": [
  "^https?:\\/\\/mail\\.google\\.com\\/mail\\/u\\/",
  "||accounts.google.com^"
]
```

If the URL matches an exception, none of the provider's rules run.
The older `domainExceptions` field is still read for existing rules; new
rules should use `exceptions`.

## redirections

Each entry is either:

- a **regex** matched against the full URL. The request is redirected to its
  first capture group (URL-decoded), so the regex must contain one:

  ```json
  "^https?:\\/\\/(?:[a-z0-9-]+\\.)*?google(?:\\.[a-z]{2,}){1,}\\/url\\?.*?(?:url|q)=(https?[^&]+)"
  ```

- a **domain redirect** starting with `|`: every URL matching the pattern
  goes to a fixed address.

  ```json
  "||go.example.com^$redirect=https://example.com/"
  ```

The older `domainRedirections` field is still read for existing rules; new
rules should use `redirections`.

## Rule objects

Instead of a string, an entry in `rules`, `referralMarketing`, `rawRules`,
`exceptions` or `redirections` can be an object. Use it when a rule needs an
id, needs to start switched off, or needs to rewrite instead of remove:

```json
{
  "id": "token-rewrite",
  "matchPattern": "token",
  "replacePattern": "clean-§1§",
  "preprocessors": [{ "type": "urlDecode", "inputs": "all" }],
  "requestTypes": ["main_frame"],
  "exceptions": ["^https:\\/\\/example\\.com\\/keep"],
  "description": "Rewrite the token instead of removing it",
  "active": true
}
```

| Key | Meaning |
|---|---|
| `matchPattern` | the same string you would write as a plain entry |
| `id` | stable id (`a-z`, `0-9`, `-`, `_`) used by the rule on/off controls |
| `replacePattern` | rewrite instead of remove; `§1§`, `§2§`, … are the captured values (the parameter value for `rules`, capture groups for `rawRules` / `redirections`) |
| `preprocessors` | applied to captured values first: `urlEncode`, `urlDecode`, `doubleUrlEncode`, `doubleUrlDecode`, `base64Encode`, `base64Decode`; `inputs` is `"all"` or a list like `[1, 2]` |
| `requestTypes` | only for these request types (`"main_frame"`, `"xmlhttprequest"`, …) |
| `exceptions` | URL regexes (case-sensitive) where this one rule does not run; not used by `$removeparam` filters, which use `@@` instead |
| `flags` | regex flags for the pattern (default `i`; `gi` in `rawRules`) |
| `active` | `false` makes the rule off by default |
| `description` | free text |

A rule object always goes in the list for what it does: `rawRules` for raw
rules, `redirections` for redirects, and so on.

## Checking rules

```bash
node linkumori-cli-tool.js lint-rules   # validate data/linkumori-clearurls.json
node linkumori-cli-tool.js clearurls    # rebuild the bundled LZ4 rules
```

The custom rules editor validates the same syntax when you save.

## Old spellings

Each of these duplicated another name and is no longer read by the engine.
Custom rules, remote rule lists and imported files that still use them are
rewritten to the current form automatically when they load. The editor and
`lint-rules` report them when they are typed or found in the bundled rules.

| Old | Current |
|---|---|
| `domainRedirections: ["\|\|a.com^$redirect=…"]` | `redirections: ["\|\|a.com^$redirect=…"]` |
| `domainExceptions: ["\|\|a.com^"]` | `exceptions: ["\|\|a.com^"]` |
| `{ "match", "kind", "action" }` rule objects | `{ "matchPattern", "replacePattern" }` in `rules`, `rawRules` or `redirections` |
| `"referralMarketing": true` on a rule object | the rule inside `referralMarketing` |
| `urlEncodeRepeated` / `urlDecodeRepeated` | `doubleUrlEncode` / `doubleUrlDecode` |
| `$queryprune` | `$removeparam` |
| `xhr` | `xmlhttprequest` |
| `doc`, `popup` | `document` |
| `frame`, `iframe` | `subdocument` |
| `1p`, `~third-party` | `first-party` |
| `3p`, `~first-party` | `third-party` |
| `strict1p` / `strict3p` | `strict-first-party` / `strict-third-party` |
| `from=` | `domain=` |
| `defaultActive` (provider), `activeDefault` (rule object) | `active` |
| `"history-bypass-protection"` as a JSON key | `historyBypassProtection` (the `history-bypass-protection=` filter option is unchanged) |
| `"syntax"` marker | nothing (remove it) |
