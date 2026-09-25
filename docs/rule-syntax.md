# Linkumori rule syntax

Rules live in `data/linkumori-clearurls.json` (bundled), in remote rule
lists, and in the custom rules editor. All three use the same format.
Remote lists and editor imports may also use the ClearURLs new rule format
or compiled list format; see [§10](#10-clearurls-rule-formats).

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
| `domainPatterns` | array | Which URLs the provider handles (see [§2](#2-patterns)). Use this **or** `urlPattern`, never both. |
| `urlPattern` | string | Which URLs the provider handles, as a regex matched against the full URL (case-insensitive). |
| `indexPattern` | string or array | Only with `urlPattern`: `\|\|host^` hints so the provider is only checked for those hosts. Without it, a `urlPattern` provider is checked against every URL, which is slow; `lint-rules` warns about it. |
| `rules` | array | Query/fragment parameters to remove (see [§3](#3-rules)). |
| `referralMarketing` | array | Referral/affiliate parameters to remove. Same syntax as `rules`; skipped while *Allow referral marketing* is on. |
| `rawRules` | array | Regexes run against the full URL; every match is deleted (see [§5](#5-rawrules)). |
| `exceptions` | array | URLs the provider leaves alone (see [§6](#6-exceptions)). |
| `redirections` | array | Where to send the request instead (see [§7](#7-redirections)). |
| `completeProvider` | boolean | `true` blocks every request the provider matches. |
| `forceRedirection` | boolean | `true`: for page loads, redirects navigate the tab instead of redirecting the request. |
| `methods` | array | Only handle these HTTP methods, e.g. `["GET"]`. |
| `resourceTypes` | array | Only handle these request types, e.g. `["main_frame", "xmlhttprequest"]`. |
| `historyBypassProtection` | boolean | `false` skips this provider when a page changes its own URL with the History API (pushState/replaceState). Default `true`. |
| `active` | boolean | `false` switches the provider off. |

A provider with both `domainPatterns` and `urlPattern` is rejected by the
editor and by `lint-rules`, because only `domainPatterns` would be used.
If you need both kinds of match, make two providers.

## 2. Patterns

Used by `domainPatterns`, by `|`-prefixed `exceptions` and `redirections`,
and in front of `$removeparam`.

| Pattern | Matches |
|---|---|
| `\|\|example.com^` | `example.com` and every subdomain |
| `\|\|example.*^` | `example` on any public suffix (`example.de`, `example.co.uk`, …) |
| `\|\|example.com^/path` | that host (and subdomains) when the path starts with `/path` |
| `\|https://example.com/` | URLs that start with exactly this text |
| `/regex/i` | the full URL, as a regular expression |
| `*` | every URL |

`^` marks the end of the host name; `*` matches anything.

`||` (a domain) and `|` (the literal start of the URL) differ by one
character. A single `|` must be followed by a scheme such as `https://`:
URLs always start with one, so `|example.com^` could never match anything.
The editor and `lint-rules` reject it and suggest `||example.com^`.

## 3. rules

Each entry is one of:

| Entry | Example | Removes |
|---|---|---|
| parameter name | `"utm_source"` | `utm_source` |
| name regex | `"utm_[a-z]+"` | any parameter whose whole name matches (case-insensitive) |
| `$removeparam` filter | `"$removeparam=fbclid"` | see [§4](#4-removeparam-filters) |

`"fbclid"` and `"$removeparam=fbclid"` remove the same thing. Use the plain
name unless you need something from §4.

`referralMarketing` takes exactly the same entries.

## 4. $removeparam filters

`[@@][pattern]$removeparam[=value][,option…]`

### Value

The first character of the value decides what it means:

| Value | Removes |
|---|---|
| *(none)* | every parameter |
| `~…` | every parameter **except** what follows (`~name`, `~/regex/`, `~\|prefix`) |
| `/regex/i` | parameters whose name, or `name=value`, matches |
| `\|prefix` | parameters whose name starts with `prefix` |
| `name` | exactly that parameter (any other first character) |

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
| `to=a.com` | only for requests to these domains |
| `denyallow=a.com` | not for requests to these domains |
| `method=get\|~post` | only for these HTTP methods |
| `first-party`, `third-party`, `strict-first-party`, `strict-third-party` | request party |
| `document`, `subdocument`, `script`, `stylesheet`, `image`, `media`, `font`, `object`, `xmlhttprequest`, `websocket`, `ping`, `other` (`~` excludes) | request type |
| `match-case` | case-sensitive parameter names |
| `history-bypass-protection=false` | skip this filter for History API URL changes |
| `badfilter` | cancel an identical filter (for example one from another list) |

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

## 5. rawRules

Regexes run against the full URL; every match is deleted.

```json
"rawRules": ["\\/ref=[^/?]*"]
```

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
rule object's own `exceptions` (§8).

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
  `replacePattern` (§8) may use several groups, as `§1§`, `§2§`, ….

- a **domain redirect** starting with `|`: every URL matching the pattern
  goes to a fixed address.

  ```json
  "||go.example.com^$redirect=https://example.com/"
  ```

## 8. Rule objects

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
| `aliases` | the rule's previous ids. A rule switched off under an old id stays off after the rename, and the setting is moved to the new id. Ids and aliases must be unique within a provider |
| `replacePattern` | rewrite instead of remove; `§1§`, `§2§`, … are the captured values (the parameter value for `rules`, capture groups for `rawRules` / `redirections`) |
| `preprocessors` | applied to captured values first: `urlEncode`, `urlDecode`, `doubleUrlEncode`, `doubleUrlDecode`, `base64Encode`, `base64Decode`; `inputs` is `"all"` or a list like `[1, 2]` |
| `requestTypes` | only for these request types (`"main_frame"`, `"xmlhttprequest"`, …) |
| `exceptions` | URL regexes (case-insensitive) where this one rule does not run; not used by `$removeparam` filters, which use `@@` instead |
| `flags` | regex flags for the pattern (default `i`; `gi` in `rawRules`) |
| `active` | `false` makes the rule off by default |
| `description` | free text |

A rule object goes in the list for what it does: `rawRules` for raw rules,
`redirections` for redirects, and so on.

## 9. Checking rules

```bash
node linkumori-cli-tool.js lint-rules   # validate data/linkumori-clearurls.json
node linkumori-cli-tool.js clearurls    # rebuild the bundled LZ4 rules
node linkumori-cli-tool.js lint-rules new-rules.yaml             # also reads the ClearURLs formats
node linkumori-cli-tool.js convert-rules new-rules.yaml out.json # ClearURLs format → Linkumori JSON
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

## 10. ClearURLs rule formats

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
| `kind: raw`, action `remove` or `rewrite` | `rawRules` |
| `kind: raw`, action `redirect` | `redirections` |
| `kind: redirection`, action `redirect` (default) | `redirections` |
| `kind: redirection`, action `rewrite` | `rawRules` |
| `kind: exception` (compiled lists) | `exceptions` |

`match` becomes `matchPattern`, `action.replacePattern` becomes
`replacePattern`, `requestTypes: all` is dropped, and `defaults` are copied
into every rule that does not set its own value. A short-form string stays a
string. Compiled lists: `activeDefault` becomes `active`, and
`defaultActive: false` on the list or a provider switches the provider off.

As the spec requires, long-form rules need an `id`. Ids and aliases must be
unique within a provider. A field rule cannot `redirect`, and a redirection
cannot `remove`.

### Linkumori additions inside the ClearURLs formats

Everything on this page keeps working inside a `version: 2` or compiled file:

- Provider keys `domainPatterns` (instead of `urlPattern`), `indexPattern`,
  `resourceTypes`, `historyBypassProtection` and, in version 2, `active`.
- Short-form `rules` entries and `match` can be any `rules` entry from
  [§3](#3-rules), including `$removeparam` filters and `@@` exceptions.
- Provider `exceptions` and `match` of `kind: redirection` take `|` domain
  patterns, including `||host^$redirect=…` domain redirects.
- Rule keys `flags` and `historyBypassProtection`, and
  `defaults.historyBypassProtection`.
- The `base64Decode` preprocessor.
- `rawRules`, `referralMarketing` and `redirections` lists next to `rules`.
- A top-level `metadata` object.

Files that use these additions are not valid for ClearURLs itself.

### YAML support

YAML files may use block mappings and lists, `[ … ]` / `{ … }`, single- and
double-quoted strings, `|` / `>` blocks and `#` comments. Anchors, aliases,
tags and multiple documents are rejected. Write regexes in single quotes:
in double quotes, `\d` is an invalid escape.
