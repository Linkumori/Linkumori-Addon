# Writing CLN Format 1.0 in YAML

This guide covers the YAML form of every CLN 1.0 file section and rule type.
YAML represents the same maps, lists, strings, numbers, and booleans as CLN's
JSON payload; it does not change the CLN data model. This is Linkumori CLN YAML,
not the separate ClearURLs Rules YAML format.

For field behavior and runtime details, see [CLN Format 1.0](filter-syntax.md).
This page shows how to write those fields in YAML.

## Convert, lint, and build

The canonical source is `data/linkumori-clearurls.yaml`. The CLI converts it to
JSON for the extension:

```sh
node linkumori-cli-tool.js lint-rules data/linkumori-clearurls.yaml
node linkumori-cli-tool.js yaml-to-json data/linkumori-clearurls.yaml
node linkumori-cli-tool.js clearurls
```

`yaml-to-json` validates the YAML rules and writes `data/linkumori-clearurls.json`
by default. `clearurls` leaves the YAML source untouched, exports JSON, and
rebuilds the compressed LZ4 bundle. Generated version and build timestamp values
live in the JSON and LZ4 outputs and change only when rule data changes.

## YAML basics

- Indent mappings and sequences with spaces, not tabs.
- A mapping is a set of named fields. A sequence is a list introduced by `-`.
- Quote rule strings, regexes, URLs, patterns, IDs, and parameter names. This
  prevents values such as `yes`, `no`, `on`, dates, or number-like names from
  being read as another YAML type.
- Use YAML booleans for boolean fields and numbers for fields such as `order`.
- Single-quoted strings keep backslashes literal. To include a single quote,
  double it. Double-quoted strings interpret escapes, so write backslashes as
  `\\` there.
- Quote any rule containing `#`; otherwise YAML may read the rest as a comment.

## Complete bundled or custom rules file

This example uses every top-level section and provider field. It uses
`domainPatterns`; use `urlPattern` instead when matching by regular expression.
Do not use both. `indexPattern` is only available with `urlPattern`.

```yaml
cln: "1.0"
metadata:
  name: "Example Linkumori rules"
  version: "1.0.0"
  description: "Example CLN rules in YAML"
defaults:
  active: true
  description: "Default note for rules"
  requestTypes:
    - main_frame
    - xmlhttprequest
  preprocessors:
    - type: urlDecode
      inputs: all
  exceptions:
    - '^https://shop\.example/keep'
  historyBypassProtection: true
providers:
  shop:
    domainPatterns:
      - "||shop.example^"
    rules:
      - "utm_source"
      - id: "token-rewrite"
        aliases:
          - "old-token-rule"
        matchPattern: "token"
        replacePattern: "clean-§1§"
        preprocessors:
          - type: urlDecode
            inputs: all
        requestTypes:
          - main_frame
        exceptions:
          - '^https://shop\.example/keep-token'
        order: 10
        active: true
        flags: "i"
        historyBypassProtection: true
        description: "Rewrite the token parameter value"
      - matchPattern: "aff_id"
        referralMarketing: true
    rawRules:
      - '\/ref=[^/?#]*'
      - id: "strip-session-path"
        matchPattern: ';jsessionid=[^/?#]*'
        flags: "gi"
    referralMarketing:
      - "tag"
    exceptions:
      - "||accounts.shop.example^"
    redirections:
      - "||go.shop.example^$redirect=https://shop.example/"
      - '^https://redirect\.shop\.example/\?url=(https?[^&]+)'
    fieldRedirections:
      - "redirect"
      - "continue_url"
    completeProvider: false
    forceRedirection: false
    methods:
      - GET
      - POST
    resourceTypes:
      - main_frame
      - xmlhttprequest
    historyBypassProtection: true
    active: true
```

### Top-level fields

| Field | YAML shape | Notes |
| --- | --- | --- |
| `cln` | string | Optional format marker; if present, write `"1.0"`. |
| `metadata` | mapping | Optional descriptive metadata. The CLI adds generated `version` and `buildTimestamp` values to JSON/LZ4 outputs without rewriting the YAML source. |
| `defaults` | mapping | Optional defaults applied to rules in this file. |
| `providers` | mapping of provider name to provider mapping | Required for bundled and ordinary custom rule files. |
| `patches` | sequence of patch mappings | Optional; remote rule files only. See [Remote patches](#remote-patches). |

Do not use the ClearURLs v2 top-level `version` field for CLN. CLN's version
marker is `cln: "1.0"`.

### Provider fields

| Field | YAML shape | Notes |
| --- | --- | --- |
| `domainPatterns` | string or sequence of strings | Host/path patterns. Use instead of `urlPattern`, not with it. |
| `urlPattern` | string | Regex checked against the full URL. Use instead of `domainPatterns`. |
| `indexPattern` | string or sequence of strings | Optional host lookup hint for `urlPattern`. |
| `rules` | sequence of strings or rule mappings | Query and fragment parameter rules. |
| `rawRules` | sequence of strings or rule mappings | Regexes applied to the whole URL. |
| `referralMarketing` | sequence of strings or rule mappings | Rules controlled by the allow-referral-marketing setting. |
| `exceptions` | sequence of strings or rule mappings | A match skips the entire provider. |
| `redirections` | sequence of strings or rule mappings | Regex captures or fixed `$redirect=` targets. |
| `fieldRedirections` | sequence of strings or rule mappings | Parameter names whose values supply a redirect URL. |
| `completeProvider` | boolean | `true` blocks every request matched by the provider. |
| `forceRedirection` | boolean | `true` makes a main-frame redirect navigate the tab. |
| `methods` | sequence of strings | Restricts the provider to HTTP methods such as `GET` and `POST`. |
| `resourceTypes` | sequence of strings | Restricts browser request types such as `main_frame` and `xmlhttprequest`. |
| `historyBypassProtection` | boolean | Defaults to `true`; set `false` to skip same-page History API changes. |
| `active` | boolean | `false` disables the provider without removing it. |

Each provider needs either non-empty `domainPatterns` or `urlPattern`.
`indexPattern` is only useful with `urlPattern`.

## Rule entries and objects

An entry in `rules`, `rawRules`, `referralMarketing`, `exceptions`,
`redirections`, or `fieldRedirections` may be a string or a mapping. A mapping
uses `matchPattern` for the text that would otherwise be written as a string:

```yaml
rules:
  - "utm_source"
  - id: "rewrite-campaign"
    aliases:
      - "old-campaign-rule"
    matchPattern: "campaign"
    replacePattern: "clean-§1§"
    preprocessors:
      - type: urlDecode
        inputs: all
    requestTypes:
      - main_frame
    exceptions:
      - '^https://shop\.example/keep-campaign'
    order: 20
    referralMarketing: true
    active: true
    flags: "i"
    historyBypassProtection: false
    description: "Rewrite this value instead of deleting it"
```

Supported rule-object fields:

| Field | Type | Notes |
| --- | --- | --- |
| `matchPattern` | string | Required entry text for its section. |
| `id` | string | Stable rule ID. |
| `aliases` | sequence of strings | Previous IDs for renamed rules. |
| `replacePattern` | string | Rewrites a match; `§1§`, `§2§`, etc. refer to captures or a parameter value. |
| `preprocessors` | sequence of mappings | Transforms captured values before rewrite or redirect. |
| `requestTypes` | sequence of strings | Limits this rule to selected request types. |
| `exceptions` | sequence of strings | URLs this rule alone skips. |
| `order` | number or `null` | Sorts within a processing stage; `$removeparam` filters cannot use it. |
| `referralMarketing` | boolean | On an entry in `rules`, `true` also treats it as referral marketing. |
| `active` | boolean | `false` disables this rule. |
| `flags` | string | Regex flags for this entry. |
| `historyBypassProtection` | boolean | Overrides provider or file defaults for this rule. |
| `description` | string | Reader-facing note; ignored by the engine. |
| `targetId` | string | On a raw-rule `@@…$rawrule=` exception, identifies one raw rule by ID or alias. |

Each preprocessor mapping has a `type` and `inputs`:

```yaml
preprocessors:
  - type: urlDecode
    inputs: all
  - type: base64Decode
    inputs:
      - 1
      - 2
```

Available types are `urlEncode`, `urlDecode`, `doubleUrlEncode`,
`doubleUrlDecode`, `base64Encode`, and `base64Decode`. `inputs` is `all` or a
sequence of capture indexes.

## Patterns and rule strings

`domainPatterns` accepts patterns such as:

| Pattern | Matches |
| --- | --- |
| `"\|\|example.com^"` | The host and its subdomains. |
| `"\|\|example.*^"` | The host name on any suffix. |
| `"\|\|example.com^/path"` | That host when the path starts with `/path`. |
| `"\|https://example.com/"` | URLs beginning with that exact text. |
| `"*"` | Every URL. |

Regexes are strings. Use `/regex/flags` where supported, or plain regex text in
fields that expect regexes. A single `|` anchors exact URL text; use `||` for a
domain anchor.

### `rules` and `referralMarketing`

Use a parameter name for an exact match, a name regex for multiple parameters,
or `$removeparam` when the rule needs conditions:

```yaml
rules:
  - "utm_source"
  - "utm_[a-z]+"
  - "||shop.example^$removeparam=tag,method=get,third-party"
referralMarketing:
  - "ref"
  - "tag"
```

### `$removeparam` filters

The text grammar is `[@@][pattern]$removeparam[=value][,modifier,…]`.

- `$removeparam` with no value removes every parameter.
- `=name` targets that exact parameter; `=~name` removes every parameter
  except that name.
- `=/regex/i` matches a parameter name or `name=value`; `=|prefix` matches a
  name prefix.
- Prefix with `@@` to keep matching parameters. It exempts `$removeparam`
  filters, not ordinary `rules` entries.
- A pattern before `$removeparam` narrows where the filter applies.

Supported modifiers:

| Modifier | Meaning |
| --- | --- |
| `domain=a.com\|~b.com` | Include or exclude the page's domain. |
| `to=a.com\|~b.com` | Include or exclude the request target domain. |
| `method=get\|~post` | Include or exclude HTTP methods. |
| `first-party`, `third-party` | Compare registrable domains. |
| `strict-first-party`, `strict-third-party` | Compare exact hostnames. |
| `document`, `subdocument`, `script`, `stylesheet`, `image`, `imageset`, `media`, `font`, `object`, `xmlhttprequest`, `websocket`, `ping`, `other` | Include a request type; prefix it with `~` to exclude it. |
| `match-case` | Make parameter-name matching case-sensitive. |
| `history-bypass-protection=false` | Skip this filter during same-page History API changes. |

Escapes in parameter names are `\~`, `\|`, `\/`, `\,`, and `\\`. A comma
after a backslash is part of the value, not a modifier separator. Single-quote
YAML strings keep these escapes literal:

```yaml
rules:
  - '$removeparam=\~literal-name'
  - '$removeparam=\/literal-slash-name'
```

### `rawRules`

Raw regex rules run against the whole URL before parameter rules. `$rawrule=`
scopes a regex to a domain pattern; `@@…$rawrule=` exempts matching raw rules:

```yaml
rawRules:
  - '\/ref=[^/?#]*'
  - '||shop.example^/product/$rawrule=\/ref=[^/?#]*'
  - '@@||shop.example^/keep/$rawrule='
```

### `exceptions`

Provider exceptions stop all rule stages for that provider. They accept URL
regexes and domain patterns:

```yaml
exceptions:
  - '^https://accounts\.example/'
  - '||login.example^'
```

Rule-object `exceptions` have the same shape but apply only to that rule.

### `redirections`

Use a regex with exactly one capture group or a fixed `$redirect=` target:

```yaml
redirections:
  - '^https://redirect\.example/\?url=(https?[^&]+)'
  - '||go.example^$redirect=https://example.com/'
```

Targets must be absolute `http` or `https` URLs with a host.

### `fieldRedirections`

List parameter names whose values contain the destination URL:

```yaml
fieldRedirections:
  - "redirect"
  - "continue_url"
```

The first matching parameter in the URL supplies the target.

## Defaults and processing order

The file-level `defaults` mapping supports `active`, `description`,
`requestTypes`, `preprocessors`, `exceptions`, and `historyBypassProtection`:

```yaml
defaults:
  active: true
  description: "Default rule note"
  requestTypes:
    - main_frame
  preprocessors:
    - type: urlDecode
      inputs: all
  exceptions:
    - '^https://example\.com/keep'
  historyBypassProtection: true
```

A rule's own value wins over the default. Provider exceptions are not replaced
by defaults. Processing order is provider exceptions, redirections, field
redirections, complete-provider blocking, raw rules, ordinary and referral
rules, then `$removeparam` filters. `order` sorts within a stage and cannot move
a rule between stages.

## Remote patches

`patches` is for remote rule files only. A remote file can contain patches
without `providers`. Every patch needs `target`, `section`, and `replace`;
`description` is optional:

```yaml
cln: "1.0"
patches:
  - target: "shop::token-rewrite"
    section: rules
    replace:
      matchPattern: "token"
      replacePattern: "safe-§1§"
      order: 20
    description: "Use a different token rewrite"
```

`section` is one of `rules`, `referralMarketing`, `rawRules`, `exceptions`,
`redirections`, or `fieldRedirections`. `replace` is a string or rule object
valid in that section. `target` identifies a loaded rule by provider and ID,
or by its `domainPattern:` / `urlPattern:` key and ID. See
[Rule patches](filter-syntax.md#rule-patches) for matching and runtime behavior.

## Validate before exporting

```sh
node linkumori-cli-tool.js lint-rules path/to/rules.yaml
node linkumori-cli-tool.js yaml-to-json path/to/rules.yaml path/to/rules.json
```

The linter checks CLN keys, types, patterns, rule syntax, and regexes. For
behavior and edge cases, continue with [CLN Format 1.0](filter-syntax.md).
