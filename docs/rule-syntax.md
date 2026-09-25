# Linkumori rule syntax

Rules live in `data/linkumori-clearurls.json` (bundled), in remote rule
lists, and in the custom rules editor. All three use the same format.
Remote lists and editor imports may also use the ClearURLs new rule format
or compiled list format; see [§10](#10-clearurls-rule-formats).

Upgrading rules written for Linkumori 100.54.0 or earlier? See
[§11](#11-changes-in-100550) for what changed and how to update them.

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
| `rawRules` | array | Regexes run against the full URL; every match is deleted (see [§5](#5-rawrules)). |
| `exceptions` | array | URLs the provider leaves alone (see [§6](#6-exceptions)). |
| `redirections` | array | Where to send the request instead (see [§7](#7-redirections)). Only used while *Enable Third-Party Redirect Bypass* is on. |
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
3. **`completeProvider`**: the request is blocked.
4. **`rawRules`** run on the full URL.
5. **`rules`** and **`referralMarketing`** remove query parameters and
   parameters in the `#` fragment. A parameter already handled by a
   `$removeparam` filter is left to that filter.
6. **`$removeparam` filters** run, minus any `@@` exceptions.

The first provider that changes, redirects or blocks the request decides
the result. The browser then sends the new URL through the same process.

## 2. Patterns

Used by `domainPatterns`, by `|`-prefixed `exceptions` and `redirections`,
and in front of `$removeparam`.

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
`$removeparam` filters and `@@` exceptions.

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
`from=` and `$queryprune` are not accepted (see [§11](#11-changes-in-100550)).
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

## 5. rawRules

Regexes run against the full URL; every match is deleted.

```json
"rawRules": ["\\/ref=[^/?]*"]
```

Raw rules are case-insensitive and replace every match (flags `gi`). They
run before `rules`, so they can remove text that is not a `name=value`
parameter, such as Amazon's `/ref=…` path segment. To rewrite instead of
delete, use a rule object with `replacePattern` (§8).

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

Every redirect target, from either kind, is URL-decoded until no escapes
are left. A target that does not start with `http` gets `http://` in front.

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
| `historyBypassProtection` | `false` skips this rule for History API URL changes (like the provider field in §1) |
| `active` | `false` makes the rule off by default |
| `description` | free text |

A rule object goes in the list for what it does: `rawRules` for raw rules,
`redirections` for redirects, and so on. Other keys, including the ClearURLs
spellings `match`, `action` and `kind`, are rejected (see
[§11](#11-changes-in-100550)).

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

## 11. Changes in 100.55.0

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
| ClearURLs formats | Remote lists, editor *Import*, `lint-rules` and the new `convert-rules` command also read the ClearURLs new rule format (`version: 2`) and compiled lists, in JSON or YAML. See [§10](#10-clearurls-rule-formats). |
| Rule `aliases` | A renamed rule keeps its on/off setting: list its old ids in `aliases` and the setting moves to the new id. See [§8](#8-rule-objects). |
| Stricter checks | The editor and `lint-rules` now reject rules that load but can never work: `domainPatterns` together with `urlPattern`, a single `\|` with no scheme (`\|example.com^`), and a regex redirect without exactly one capture group. See [§9](#9-checking-rules). |

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
[§8](#8-rule-objects). The ClearURLs spellings are accepted
only inside a ClearURLs file, where they are converted on import.

| Removed | Use instead |
|---|---|
| `match` | `matchPattern` |
| `action: { type: "rewrite", replacePattern }` | `replacePattern` |
| `action: { type: "remove" }` | Leave out `replacePattern`. |
| `kind: "raw"` / `"redirection"` / `"exception"` | Put the rule in `rawRules`, `redirections` or `exceptions`. |
| `referralMarketing: true` on a rule | Put the rule in `referralMarketing`. |
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
