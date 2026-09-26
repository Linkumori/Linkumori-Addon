# ClearURLs rule format 2 and the Linkumori format compared

This page compares the ClearURLs rule formats with the Linkumori format,
key by key. Use it to read rules written for one and write them for the
other.

- **ClearURLs:** taken from the ClearURLs specifications: the
  [new rule format](https://docs.clearurls.xyz/specs/new-rules) (last updated
  2026-06-09), the
  [compiled list format](https://docs.clearurls.xyz/specs/compiled-lists) and
  the [rule catalog](https://docs.clearurls.xyz/specs/rules). Where those
  pages do not say something, this page says so rather than guessing.
- **Linkumori:** described in full in [filter-syntax.md](filter-syntax.md).

Linkumori reads only its own JSON format. It does not convert ClearURLs
files, so moving rules across is done by hand, following
[§15](#15-moving-rules-between-the-formats).

## 1. At a glance

| | ClearURLs format 2 | Linkumori |
|---|---|---|
| Authoring format | YAML (`version: 2`) | JSON |
| Shipped as | compiled JSON list (the YAML compiled, minified and compressed) | the same JSON; the bundled list is LZ4-compressed |
| Older format | legacy JSON catalog (`rules`, `rawRules`, …), still published | the legacy catalog's lists, plus extensions |
| Rule layout | one `rules` list per provider; each rule has a `kind` and an `action` | one list per behaviour: `rules`, `rawRules`, `redirections`, … |
| Defaults | a `defaults` block copied into every rule | none; each rule sets its own values |
| Provider match | `urlPattern` regex (required) | `domainPatterns` (`\|\|example.com^`) or `urlPattern` |
| Simple rule | short form: `- utm_source` | plain string: `"utm_source"` |
| Detailed rule | long form, with a required `id` | rule object; `id` optional |
| Rule ids | `id` required on long-form rules; short-form ids are generated but not guaranteed stable | every rule has an id, its own or a generated one with a documented scheme |
| Runtime id | `listId::providerId::ruleId` | `provider::ruleId`, or `domainPattern:<p>::ruleId` / `urlPattern:<p>::ruleId` |
| Parameter filters with options | — | `$removeparam` filters with patterns, options and `@@` exceptions |

## 2. Files

### ClearURLs

ClearURLs has three file formats:

| Format | Role | Top-level keys |
|---|---|---|
| New rule format (YAML) | what people write | `version` (currently `2`), `defaults`, `providers` (map: name → provider) |
| Compiled list (JSON) | what the runtime loads; "no YAML parsing or schema validation" at runtime | `id` (list id), `defaultActive` (whole list on/off), `providers` (**array** of providers) |
| Legacy catalog (JSON) | the older format, still published as `data.min.json` with a SHA-256 file `rules.min.hash` (lowercase) | `providers` (map) |

The recommended workflow is: write YAML, validate and compile it to
canonical JSON, then minify and compress that for distribution.

### Linkumori

Linkumori has one format for bundled, remote and custom rules:

```json
{
  "metadata": { "name": "…", "version": "…" },
  "providers": { "amazon": { "domainPatterns": ["||amazon.*^"], "rules": ["qid"] } }
}
```

- `providers` is a map: name → provider.
- `metadata` is optional.
- There is no `version` key and no `defaults` block.
- The bundled list is built from `data/linkumori-clearurls.json` into an
  LZ4 file.
- Remote lists must come with a hash URL. The SHA-256 of the list's raw
  text must match it, or the list is rejected.

## 3. Provider keys

| Key | ClearURLs YAML | ClearURLs compiled | ClearURLs legacy | Linkumori |
|---|---|---|---|---|
| name | map key | `providerId` | map key | map key |
| `urlPattern` | **required**; regex | required | required | regex, case-insensitive; or use `domainPatterns` |
| `domainPatterns` | — | — | — | `\|\|example.com^`, `\|\|example.*^`, `\|\|host^/path`, … ([§2](filter-syntax.md#2-patterns)) |
| `indexPattern` | — | — | — | `\|\|host^` hints for a `urlPattern` provider, so it is only checked on those hosts |
| `completeProvider` | block matching requests (if domain blocking is on) | same | same; "incompatible with rules/exceptions/redirections" | block matching requests (if domain blocking is on); `exceptions` and `redirections` are still checked first |
| `forceRedirection` | redirects are enforced for `main_frame` | same | same | same: the tab navigates instead of the request being redirected |
| `methods` | list of HTTP methods | same | — | same |
| `resourceTypes` | — | — | — | request types the provider handles |
| `exceptions` | provider-level URL regexes | as rules with `kind: exception` | URL regexes | URL regexes, or `\|`-prefixed domain patterns |
| `rules` | every rule of the provider (§4) | every rule of the provider | field names | field rules only (§4) |
| `rawRules`, `referralMarketing`, `redirections` | — (expressed as `kind` / `action` in `rules`) | — | yes | yes, extended (§12) |
| `fieldRedirections` | — | — | — | redirect to a parameter's own value |
| on/off | — | `defaultActive` | — | `active` |
| `historyBypassProtection` | — | — | — | `false` skips the provider for History API URL changes |

## 4. How rules are organised

ClearURLs format 2 puts every rule in one `rules` list, and each rule says
what it is with `kind` and what it does with `action`. Linkumori keeps one
list per behaviour, like the legacy catalog, so a rule's list says what it
is.

| ClearURLs `kind` + `action` | Linkumori list |
|---|---|
| `field` (default) + `remove` (default) | `rules` |
| `field` + `rewrite` | `rules`, rule object with `replacePattern` |
| `field` + `referralMarketing: true` | `referralMarketing`, or `rules` with `"referralMarketing": true` |
| `field` + `redirect` | not described by the ClearURLs spec. The closest Linkumori list is `fieldRedirections` (redirect to the parameter's value) |
| `raw` + `remove` | `rawRules` |
| `raw` + `rewrite` | `rawRules`, rule object with `replacePattern` |
| `raw` + `redirect` | not described; closest is `redirections` |
| `redirection` + `redirect` | `redirections` |
| `redirection` + `rewrite` | not described; closest is `rawRules` with `replacePattern` |
| `exception` (compiled lists only) | `exceptions` |

In compiled lists, a rule's `section` keeps the legacy list name ("for
legacy-compatible logical categorization"), for example `"section": "rules"`.

## 5. Rule forms

### Short form and plain strings

ClearURLs short form:

```yaml
rules:
  - utm_source
  - fbclid
```

Linkumori plain strings:

```json
"rules": ["utm_source", "fbclid"]
```

Both mean "remove this field", using the default for everything else.

- **ClearURLs** allows the short form only for a `field` rule with a `remove`
  action that overrides no default and is not marked `referralMarketing`.
- **Linkumori** allows a plain string in every list. What it means depends
  on the list: a field name or name regex in `rules`, a regex in `rawRules`,
  and so on. In field lists it can also be a `$removeparam` filter
  (`"$removeparam=fbclid"`).

### Long form and rule objects

ClearURLs long form:

```yaml
- id: rewrite-token
  match: token
  preprocessors:
    - type: base64Encode
      inputs: [1]
  action:
    type: rewrite
    replacePattern: 'wrapped-§1§'
```

Linkumori rule object (in `rules`):

```json
{
  "id": "rewrite-token",
  "matchPattern": "token",
  "preprocessors": [{ "type": "base64Encode", "inputs": [1] }],
  "replacePattern": "wrapped-§1§"
}
```

In both, this keeps the key `token` and rewrites a value such as `test` to
`wrapped-dGVzdA==`.

- **ClearURLs** requires an `id` on every long-form rule.
- **Linkumori** does not; a rule object without `id` gets a generated one
  (§9).

## 6. Rule keys

| ClearURLs YAML | ClearURLs compiled | Linkumori | Notes |
|---|---|---|---|
| `id` | `id` | `id` | both `^[a-z0-9][a-z0-9_-]*$`, unique in the provider across ids and aliases. Required on ClearURLs long form; optional in Linkumori |
| `aliases` | `aliases` | `aliases` | same rules in both: slugs, not the rule's own id, unique across ids and aliases. Used to keep toggles after a rename |
| `kind` | `kind` | — | Linkumori uses the list instead (§4) |
| — | `section` | — | legacy list name; Linkumori uses the list |
| `match` | `match` | `matchPattern` | the regex (or, in Linkumori, any entry string such as a `$removeparam` filter) |
| — | `flags` | `flags` | regex flags as a string. Linkumori defaults: `i`, and `gi` in `rawRules` |
| `action.type` | `action.type` | — | Linkumori: `remove` if there is no `replacePattern`, `rewrite` if there is; `redirect` by list |
| `action.replacePattern` | `action.replacePattern` | `replacePattern` | `§1§`, `§2§`, … in both |
| `active` | `activeDefault` | `active` | default `true` |
| `description` | `description` | `description` | free text |
| `exceptions` | `exceptions` | `exceptions` | rule-level URL regexes. Linkumori: case-insensitive; `$removeparam` filters use `@@` instead |
| `requestTypes` | `requestTypes` | `requestTypes` | ClearURLs: `all` or a list. Linkumori: a list only; leave it out for all types |
| `preprocessors` | `preprocessors` | `preprocessors` | §10 |
| `referralMarketing` | `referralMarketing` | `referralMarketing` | `true` on a field rule. Linkumori also accepts it in the `referralMarketing` list, where it changes nothing |
| — | — | `order` | run a rule earlier or later, across `rules`, `rawRules` and `referralMarketing` |
| — | — | `historyBypassProtection` | `false` skips the rule for History API URL changes |
| — | — | `targetId` | on an `@@…$rawrule=` exception: the raw rule it stops |

## 7. Actions

| Action | ClearURLs | Linkumori |
|---|---|---|
| `remove` | deletes the matched field, or removes the raw match from the URL | the default: a rule without `replacePattern` |
| `rewrite`, field rule | keeps the key and replaces its value; the value is `§1§` | rule object in `rules` with `replacePattern`; the value is `§1§` |
| `rewrite`, raw rule | spec: "rebuilds the full URL string from regex capture groups". Its example (`match: '/ref=([^/?]*)'`, `replacePattern: '/clean/§1§'`) reads as replacing the match | rule object in `rawRules` with `replacePattern`: every match is replaced, and the rest of the URL is kept |
| `redirect` | builds a target URL from capture groups (`replacePattern: '§1§'`) and navigates to it | `redirections`: a plain regex redirects to its one capture group; a rule object's `replacePattern` can use several. Also `\|\|host^$redirect=URL` and `fieldRedirections` |

## 8. Matching

| Topic | ClearURLs | Linkumori |
|---|---|---|
| Field rule target | query and fragment keys | query and fragment parameter names |
| Field rule anchoring | the compiled example stores `^utm_source$` | `^…$` is added to the entry for you |
| Field rule case | compiled example: flags `i` | case-insensitive (flags `i`) |
| Raw rules | the full URL string | the full URL, every match, case-insensitive (`gi`) |
| Redirections | legacy: capture group 1, decoded with `decodeURIComponent()`; format 2: `replacePattern` | a plain regex needs exactly one capture group; the target is URL-decoded until no escapes are left; `http://` is added if there is no scheme |
| Exceptions | URL regexes; case not stated | case-insensitive regexes, or `\|` domain patterns |
| `urlPattern` case | not stated | case-insensitive |
| Order of steps within a provider | not stated on the spec pages | exceptions → redirections → field redirections → complete provider → raw rules → field rules → `$removeparam` ([filter-syntax.md §1](filter-syntax.md#how-a-url-is-processed)) |
| Legacy field names | the legacy catalog turns a field into the URL regex `(?:&\|[/?#&])(?:<field>=[^&]*)` | the name is matched against each parsed parameter |

## 9. Rule ids and toggles

| | ClearURLs | Linkumori |
|---|---|---|
| Explicit id | `id`, required on long-form rules | `id`, optional |
| Rules without an id | "deterministic fallback ids", which are "not a persistence contract" | generated from the list and text, e.g. `utm_source` in `rules` → `field-utm-source` (the same shape as the id in ClearURLs' compiled example). When ids would collide, a hash of the text is added ([Rule ids](filter-syntax.md#rule-ids)) |
| Stable across edits | only explicit ids | only explicit ids; a generated id changes with the rule's text |
| Renames | `aliases` | `aliases`; toggles saved under an alias move to the new id |
| Runtime id | `listId::providerId::ruleId`, e.g. `core::google::field-utm-source` | `provider::ruleId` (the whole provider) or `domainPattern:<pattern>::ruleId` / `urlPattern:<pattern>::ruleId` (one match pattern) |
| Several lists | kept apart by the list id | providers from different sources are merged; a custom provider replaces a bundled one with the same pattern |

## 10. Preprocessors and `replacePattern`

Both formats write preprocessors the same way:

```yaml
preprocessors:
  - type: doubleUrlDecode
    inputs: [1]        # or: all
```

| Type | ClearURLs ("common supported types") | Linkumori |
|---|---|---|
| `urlEncode` | yes | yes |
| `urlDecode` | yes | yes |
| `doubleUrlEncode` | yes | yes |
| `doubleUrlDecode` | yes | yes |
| `base64Encode` | yes | yes |
| `base64Decode` | not listed | yes |

`inputs` is `all` or a list of capture group numbers in both formats.
Preprocessors change the captured values before `replacePattern` uses them.
`replacePattern` uses `§1§`, `§2§`, … in both: `'§1§://§2§.clearurls.xyz/'`
with groups `['https', 'test']` gives `https://test.clearurls.xyz/`.

## 11. Request types, methods, on/off

| | ClearURLs | Linkumori |
|---|---|---|
| Rule request types | `requestTypes: all` or a list such as `['main_frame', 'sub_frame']` | `requestTypes` list; leave it out for all types |
| Provider request types | — | `resourceTypes` |
| Request types in filters | — | `$removeparam` / `$rawrule` options: `document`, `subdocument`, `xmlhttprequest`, … and `~type` |
| Methods | provider `methods` | provider `methods`, and `method=get\|~post` in filters |
| Rule on/off | `active` (compiled: `activeDefault`) | `active` |
| Provider on/off | compiled `defaultActive` | `active` |
| Whole list on/off | compiled `defaultActive` on the list | remote lists and built-in rules are switched on/off in settings |
| Defaults | `defaults`: `active`, `description`, `requestTypes`, `preprocessors`, `exceptions` | none; the provider's `historyBypassProtection` is the only provider-wide rule default |

## 12. What only Linkumori has

| Feature | Syntax | Reference |
|---|---|---|
| Domain patterns | `"domainPatterns": ["\|\|amazon.*^"]`, `\|\|host^/path`, `\|https://…`, `/regex/` | [§2](filter-syntax.md#2-patterns) |
| Index hints for `urlPattern` | `"indexPattern": ["\|\|google.*^"]` | [§1](filter-syntax.md#1-provider-fields) |
| `$removeparam` filters | `[@@][pattern]$removeparam[=value][,option…]`; value `name`, `/regex/`, `\|prefix`, `~…`, or nothing (all) | [§4](filter-syntax.md#4-removeparam-filters) |
| Filter options | `domain=`, `to=`, `method=`, `first-party`, `third-party`, `strict-first-party`, `strict-third-party`, request types, `match-case`, `history-bypass-protection=` | [§4](filter-syntax.md#options) |
| Keeping a parameter | `"@@\|\|github.com^$removeparam=ref"` | [§4](filter-syntax.md#-exceptions) |
| Rules for one domain or path | `"\|\|amazon.de^$removeparam=tag"` | [§3](filter-syntax.md#domain-specific-rules) |
| Raw rules with patterns and options | `"\|\|example.com^$third-party,rawrule=\\/sid=[^/?]*"` | [§5](filter-syntax.md#5-rawrules) |
| Stopping raw rules | `"@@\|\|example.com^/checkout/$rawrule="`, or a rule object with `targetId` | [§5](filter-syntax.md#-exceptions-1) |
| Domain exceptions | `"exceptions": ["\|\|accounts.google.com^"]` | [§6](filter-syntax.md#6-exceptions) |
| Fixed-address redirects | `"\|\|go.example.com^$redirect=https://example.com/"` | [§7](filter-syntax.md#7-redirections) |
| Redirect to a parameter's value | `"fieldRedirections": ["continue_url"]` | [§8](filter-syntax.md#8-fieldredirections) |
| Step order | `"order": 1` | [§9](filter-syntax.md#order) |
| History API opt-out | `historyBypassProtection` on providers and rules, `history-bypass-protection=` in filters | [§1](filter-syntax.md#1-provider-fields) |
| Provider request types | `"resourceTypes": ["main_frame"]` | [§1](filter-syntax.md#1-provider-fields) |
| `base64Decode` preprocessor | `{ "type": "base64Decode", "inputs": "all" }` | [§9](filter-syntax.md#9-rule-objects) |
| Ids for every rule | generated, with collision handling; toggles per provider or per match pattern | [Rule ids](filter-syntax.md#rule-ids) |
| Checks | `lint-rules` and the editor reject rules that load but would do the wrong thing | [§10](filter-syntax.md#10-checking-rules) |

## 13. What only ClearURLs format 2 has

| Feature | Syntax |
|---|---|
| YAML authoring | `version: 2` files; comments, block lists |
| Defaults block | `defaults: { active, description, requestTypes, preprocessors, exceptions }` |
| One rule list with `kind` and `action` | `kind: field\|raw\|redirection` (compiled also `exception`), `action: { type: remove\|rewrite\|redirect }` |
| `requestTypes: all` | the string `all` |
| List-level id and switch | compiled `id`, `defaultActive`; runtime ids `listId::providerId::ruleId` |
| `section` | compiled lists record the legacy list name |
| Conversion tools | `convert-rules` (legacy JSON → YAML, asks for defaults), `new-rules-to-json` (YAML → minified JSON), `new-rules-to-legacy` (YAML → legacy JSON). The last drops `id` and `aliases`, and fails on features the legacy format cannot hold, such as preprocessors |

## 14. The same provider in both formats

The ClearURLs spec's complete example:

```yaml
version: 2

defaults:
  active: true
  requestTypes: all
  preprocessors: []
  exceptions: []

providers:
  example:
    urlPattern: '^https?:\/\/(?:[a-z0-9-]+\.)*?example\.com'
    forceRedirection: true
    rules:
      - utm_source
      - id: 'referral-tag'
        match: 'tag'
        referralMarketing: true
      - id: 'raw-ref'
        kind: raw
        match: '/ref=([^/?]*)'
        action:
          type: rewrite
          replacePattern: '/clean/§1§'
      - id: 'redirect-target'
        kind: redirection
        match: '^https?:\/\/(?:[a-z0-9-]+\.)*?example\.com\/go\?.*target=([^&]+)'
        preprocessors:
          - type: doubleUrlDecode
            inputs: [1]
        action:
          type: redirect
          replacePattern: '§1§'
```

The same rules in Linkumori (this passes `lint-rules`):

```json
{
  "providers": {
    "example": {
      "domainPatterns": ["||example.com^"],
      "forceRedirection": true,
      "rules": [
        "utm_source",
        { "id": "referral-tag", "matchPattern": "tag", "referralMarketing": true }
      ],
      "rawRules": [
        { "id": "raw-ref", "matchPattern": "/ref=([^/?]*)", "replacePattern": "/clean/§1§" }
      ],
      "redirections": [
        {
          "id": "redirect-target",
          "matchPattern": "^https?:\\/\\/(?:[a-z0-9-]+\\.)*?example\\.com\\/go\\?.*target=([^&]+)",
          "preprocessors": [{ "type": "doubleUrlDecode", "inputs": [1] }],
          "replacePattern": "§1§"
        }
      ]
    }
  }
}
```

What changed:

- The `defaults` all match Linkumori's own defaults, so they are dropped.
- `urlPattern` became `domainPatterns`, so the provider is only checked for
  `example.com`. Keeping `urlPattern` also works; then add
  `"indexPattern": ["||example.com^"]`.
- Each long-form rule moved to the list its `kind` and `action` stand for.
  `match` became `matchPattern`, and `action.replacePattern` became
  `replacePattern`.
- `referral-tag` could equally go in the `referralMarketing` list, without
  the key.
- In JSON, every backslash of a regex is written twice.

## 15. Moving rules between the formats

### From ClearURLs to Linkumori

1. Drop `version`. Copy any `defaults` that differ from Linkumori's into the
   rules that need them: `active: false`, a `description`, a
   `requestTypes` list, `preprocessors`, `exceptions`. `requestTypes: all`,
   `active: true` and empty lists need nothing.
2. Keep the provider name as its key. In compiled lists, use `providerId`
   as the key. If the list's or the provider's `defaultActive` is `false`,
   give the provider `"active": false`.
3. Keep `urlPattern` and add an `indexPattern`, or replace it with
   `domainPatterns`.
4. Keep `completeProvider`, `forceRedirection`, `methods` and provider
   `exceptions` as they are.
5. Put short-form rules in `rules` unchanged.
6. For long-form rules, pick the list with the table in §4, then:
   - rename `match` to `matchPattern`;
   - move `action.replacePattern` to `replacePattern`, and drop `action`;
   - drop `kind`, and `section` (compiled lists);
   - rename `activeDefault` (compiled lists) to `active`;
   - drop `requestTypes: all`;
   - keep `id`, `aliases`, `description`, `exceptions`, `preprocessors`,
     `flags` and `referralMarketing` as they are.
7. Compiled field rules are stored anchored (`^utm_source$`). Linkumori adds
   `^…$` again, which does no harm, but you can remove the anchors.
8. Run `node linkumori-cli-tool.js lint-rules my-rules.json`.

### From Linkumori to ClearURLs

These have no equivalent in ClearURLs format 2, so rewrite them or leave
them out:

- `domainPatterns`: write a `urlPattern` regex;
- `indexPattern` and `resourceTypes`: drop them;
- `$removeparam` filters with a pattern or options, `~`, `|prefix` values
  and `@@` exceptions: write plain field regexes where possible;
- `$rawrule` patterns and options, `@@…$rawrule=` exceptions and
  `targetId`;
- `|`-prefixed exceptions and `$redirect=` domain redirects: write regexes;
- `fieldRedirections`: write a `redirection` rule whose regex captures the
  parameter's value;
- `order` and `historyBypassProtection`;
- the `base64Decode` preprocessor (not listed by ClearURLs);
- rules without an `id` that need stable toggles: add an explicit `id` in
  the long form.
