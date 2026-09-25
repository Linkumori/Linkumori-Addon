# Linkumori rule syntax

Every provider has the same shape, and every rule is a single filter string
in one grammar. The same syntax is used by the bundled rules
(`data/linkumori-clearurls.json`), custom rules in the editor, and the CLI.
It is implemented once in `core_js/rule_syntax.js`.

```json
{
  "providers": {
    "amazon": {
      "match": ["||amazon.*^"],
      "rules": [
        "$removeparam=qid",
        "$removeparam=/^pd_rd_[a-z]*$/i",
        "$removeparam=tag,referral",
        "@@/^https?:\\/\\/(?:[a-z0-9-]+\\.)*?amazon(?:\\.[a-z]{2,}){1,}\\/gp\\/redirector\\.html/i",
        "/\\/ref=[^\\/?]*/i$strip"
      ]
    }
  }
}
```

## Provider

| Key | Required | Meaning |
|---|---|---|
| `match` | yes | URL patterns the provider applies to (see [Patterns](#patterns)). |
| `rules` | no | Filters, applied in order (see [Filters](#filters)). |
| `methods` | no | Only handle these HTTP methods, e.g. `["GET"]`. |
| `resourceTypes` | no | Only handle these webRequest types, e.g. `["main_frame"]`. |
| `active` | no | `false` switches the whole provider off. |
| `historyBypassProtection` | no | `false` skips this provider's rules when a page changes its URL with the History API (pushState/replaceState). |

## Patterns

Used in `match` and as the optional pattern in front of a filter's `$`.

| Pattern | Matches |
|---|---|
| `\|\|example.com^` | `example.com` and every subdomain |
| `\|\|example.*^` | `example` on any public suffix (`example.de`, `example.co.uk`, …) |
| `\|\|example.com^/path` | only URLs on that host whose path starts with `/path` |
| `\|https://exact.example/` | URLs starting with that text |
| `/regex/i` | the full URL against a regular expression (flags `i`, `m`, `s`, `u`) |
| `*` or empty | everything the provider matches |

Inside `/regex/`, write `/` as `\/`.

## Filters

A filter is `[@@][pattern]$modifiers`. Exactly one action is required,
except for a plain `@@pattern` exception.

| Action | Example | Effect |
|---|---|---|
| `removeparam` | `$removeparam=utm_source` | Remove a query/fragment parameter. |
| | `$removeparam=/^utm_/i` | Remove parameters whose name (or `name=value`) matches. |
| | `$removeparam=~keep` | Remove every parameter except `keep`. |
| | `$removeparam` | Remove all parameters. |
| `redirect` | `/[?&]url=([^&]+)/i$redirect` | Go to the first capture group of the regex. |
| | `/(\d+)/$redirect=https://example.com/item/$1` | Go to a template; `$1`, `$2`, … are capture groups. Must be the last modifier. |
| | `\|\|go.example^$redirect=https://example.com/` | Go to a fixed URL. |
| `strip` | `/\/ref=[^\/?]*/i$strip` | Delete every match of the regex from the URL. |
| `block` | `$block` | Block every request the provider matches. |
| *(none)* `@@` | `@@\|\|example.com^/login` | Exception: the provider leaves matching URLs alone. |

### Modifiers

| Modifier | Applies to | Meaning |
|---|---|---|
| `referral` | `removeparam` | Referral-marketing parameter. Skipped while *Allow referral marketing* is on. |
| `force` | `redirect` | For page loads, navigate the tab to the target instead of redirecting the request. Applies to every redirect of the provider. |
| `domain=a.com\|~b.com` (`from=`) | `removeparam` | Only on pages from these domains (`~` excludes). |
| `to=a.com` | `removeparam` | Only for requests to these domains. |
| `denyallow=a.com` | `removeparam` | Not for requests to these domains. |
| `method=post\|~get` | `removeparam` | Only for these HTTP methods. |
| `first-party` / `1p`, `third-party` / `3p`, `strict-first-party`, `strict-third-party` | `removeparam` | Request party. |
| `match-case` | `removeparam` | Case-sensitive parameter names. |
| `badfilter` | `removeparam` | Cancel an identical filter from another list. |
| `document`, `subdocument`, `script`, `xmlhttprequest`, `image`, … (`~` excludes) | all* | Only for these request types. |
| `history-bypass-protection=false` | all* | Skip this rule for History API URL changes. |

\* On `redirect`, `strip` and `@@` exceptions, these need a `/regex/` pattern, and `~type` exclusions are not available.

### Exceptions

- `@@pattern` alone: the whole provider skips matching URLs.
- `@@pattern$removeparam=name`: keep that parameter on matching URLs or pages,
  across every provider. Add `,referral` to scope it to the referral toggle.

## Rule objects

A rule that needs an id, a description, a default-off state, or a
value rewrite uses an object:

```json
{ "filter": "$removeparam=token", "id": "rewrite-token", "replace": "v2-$1",
  "preprocessors": [{ "type": "urlDecode", "inputs": "all" }], "active": false }
```

| Key | Meaning |
|---|---|
| `filter` | The filter string (required). |
| `id` | Stable id (`a-z`, `0-9`, `-`, `_`), used by the rule on/off controls. |
| `description` | Free text. |
| `active` | `false` makes the rule off by default. |
| `replace` | For `removeparam`: rewrite the value instead of removing it (`$1` is the value). For `strip`: replace matches instead of deleting them (`$1`, … are capture groups). |
| `preprocessors` | `urlEncode`, `urlDecode`, `doubleUrlEncode`, `doubleUrlDecode`, `base64Encode`, `base64Decode` applied to the captured values first. |

## Converting older rule files

The older multi-section format (`urlPattern` / `indexPattern` /
`domainPatterns`, `rules` as bare regexes, `referralMarketing`, `rawRules`,
`exceptions`, `domainExceptions`, `redirections`, `domainRedirections`,
`completeProvider`, `forceRedirection`, `$queryprune`, the
`syntax` marker, `defaultActive`/`activeDefault`, and
`history-bypass-protection` as a key) maps onto the syntax above:

| Older | Now |
|---|---|
| `domainPatterns: [...]` / `urlPattern: "re"` | `match: [...]` / `match: ["/re/i"]` |
| `rules: ["utm_source"]` | `"$removeparam=utm_source"` |
| `rules: ["utm_.*"]` | `"$removeparam=/^(?:utm_.*)$/i"` |
| `referralMarketing: ["tag"]` | `"$removeparam=tag,referral"` |
| `exceptions: ["re"]` | `"@@/re/i"` |
| `domainExceptions: ["\|\|a.com^"]` | `"@@\|\|a.com^"` |
| `redirections: ["re(.*)"]` | `"/re(.*)/i$redirect"` |
| `domainRedirections: ["p$redirect=t"]` | `"p$redirect=t"` |
| `rawRules: ["re"]` | `"/re/i$strip"` |
| `completeProvider: true` | `"$block"` |
| `forceRedirection: true` | `,force` on each `$redirect` |

- **Editor:** converts older providers when it loads or imports them.
- **Files:** `node scripts/convert-rule-syntax.js <file.json> [out.json]`
- **Remote rule lists** in the older format (for example upstream ClearURLs
  `data.min.json`) keep working unchanged: providers without `match` are read
  as the older format.

Rule ids that were generated from the old rule text (rules without an explicit `id`) change
when a rule is rewritten into a filter. A rule that was switched off by such an id
needs to be switched off again.
