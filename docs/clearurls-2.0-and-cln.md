# ClearURLs 2.0 and Linkumori CLN Format 1.0

Linkumori's rule format has had two names. Up to release **v100.54.0**
(commit `dc0e443`, 2026-09-20) it was called **Linkumori (ClearURLs 2.0)**.
From **v100.55.0** onward it is **Linkumori CLN Format 1.0** (Clean Link
Notation). This page explains what each name means, how they relate to the
official ClearURLs formats, and why CLN replaced the old name.

For a key-by-key comparison, see
[clearurls-v2-vs-linkumori.md](clearurls-v2-vs-linkumori.md). For the full
CLN syntax, see [filter-syntax.md](filter-syntax.md).

## 1. The four formats

| Format | Owner | Written in | Status |
|---|---|---|---|
| [ClearURLs rule catalog](https://docs.clearurls.xyz/specs/rules) ("old format") | ClearURLs | JSON | official; still published |
| [ClearURLs new rule format](https://docs.clearurls.xyz/specs/new-rules) ("ClearURLs 2.0", `version: 2`) | ClearURLs | YAML, compiled to JSON | official |
| Linkumori (ClearURLs 2.0) | Linkumori | JSON | replaced in v100.55.0 |
| Linkumori CLN Format 1.0 | Linkumori | JSON | current |

The first two are ClearURLs' own specifications. Linkumori does not define
or change them. The last two are Linkumori's formats. The old name borrowed
"ClearURLs 2.0", but Linkumori (ClearURLs 2.0) was never the official
ClearURLs 2.0 format.

## 2. The official ClearURLs formats

### The old format: the rule catalog

The [rule catalog](https://docs.clearurls.xyz/specs/rules) is a JSON file
with a `providers` map. Each provider has a required `urlPattern` regex and
one list per behaviour:

| Key | Holds |
|---|---|
| `rules` | field names to remove |
| `rawRules` | regexes applied to the whole URL |
| `referralMarketing` | fields kept when referral marketing is allowed |
| `exceptions` | URLs the provider leaves alone |
| `redirections` | regexes whose capture group is the redirect target |
| `completeProvider` | block every matching URL |
| `forceRedirection` | enforce redirects on page loads |

ClearURLs publishes it as `data.min.json`, with a SHA-256 hash in
`rules.min.hash`. The download URLs use the minified names
`https://rules2.clearurls.xyz/data.minify.json` and
`https://rules2.clearurls.xyz/rules.minify.hash`. The older `data.json` is
marked as outdated.

### ClearURLs 2.0: the new rule format

The [new rule format](https://docs.clearurls.xyz/specs/new-rules) is
version 2 of ClearURLs' rules. Authors write YAML with `version: 2`, a
`defaults` block and a `providers` map. It is validated, compiled to
canonical JSON, then minified and compressed for distribution.

Its main change replaces "the old split between `rules`, `rawRules`,
`referralMarketing`, and `redirections`" with one `rules` list per provider:

- **Short form:** a plain field name, such as `- utm_source`.
- **Long form:** a rule object with a required `id`, plus `aliases`,
  `kind` (`field`, `raw` or `redirection`), `match`, `active`,
  `description`, `exceptions`, `requestTypes`, `preprocessors`,
  `referralMarketing` and `action` (`remove`, `rewrite` or `redirect`).

## 3. Linkumori (ClearURLs 2.0), up to v100.54.0

This was Linkumori's own JSON format, built from three layers:

1. **The old catalog's lists:** `rules`, `rawRules`, `referralMarketing`,
   `exceptions`, `redirections`, `completeProvider`, `forceRedirection`.
2. **Rule objects in ClearURLs 2.0 spelling:** entries could be objects
   using the official keys (`match`, `kind`, `action.type`,
   `action.replacePattern`, `activeDefault`) along with `id`, `aliases`,
   `preprocessors`, `requestTypes` and per-rule `exceptions`. This is where
   the name came from.
3. **Linkumori additions:** `domainPatterns`, `indexPattern`, `methods`,
   `resourceTypes`, `historyBypassProtection`, `active`, `$removeparam`
   filters with options and `@@` exceptions, `$redirect=` domain redirects,
   and the `base64Decode` preprocessor. It also had separate
   `domainExceptions` and `domainRedirections` lists.

It was never an official ClearURLs 2.0 file. It was JSON, not YAML, had no
`version` or `defaults`, and kept the catalog's separate lists instead of
the single `rules` list. Layer 2 also meant there were two spellings for
the same things: `match` or `matchPattern`, `action.replacePattern` or
`replacePattern`, `activeDefault` or `active`.

## 4. Linkumori CLN Format 1.0, from v100.55.0

v100.55.0 ("simplify rule format and strengthen validation") turned the
three layers into one format with one spelling per concept. Later releases
up to v100.61.0 filled it out. The name "CLN Format 1.0" appears in the
docs from v100.61.0 and in the extension's own text from the release after.

### Why CLN is a unification

CLN takes the best part of each earlier format and puts it in one place:

| From | What CLN keeps |
|---|---|
| The ClearURLs catalog | its provider keys and per-behaviour lists, unchanged |
| ClearURLs 2.0 | its rule-object features: `id`, `aliases`, rewrite via `replacePattern`, `preprocessors`, `requestTypes`, per-rule `exceptions`, `referralMarketing`, `description`, `active` |
| Linkumori | domain patterns, `$removeparam` filters, and the rest in §3 layer 3 |

- **Backwards compatible with the catalog.** An official ClearURLs catalog
  is already a valid CLN file. The published `data.minify.json` (206
  providers, fetched 2026-09-27) passes `lint-rules` with 0 errors. Its
  only warnings are performance hints, plus 5 entries it lists twice.
- **ClearURLs 2.0 features without YAML or a compile step.** Any entry in
  any list can be a plain string or a rule object, so a simple rule stays a
  one-word string and a detailed one gets an object in the same list.
- **One spelling per concept.** `matchPattern`, `replacePattern` and
  `active` are the only spellings, and `domainExceptions` and
  `domainRedirections` became part of `exceptions` and `redirections`.
- **One format everywhere.** Bundled, remote and custom rules, imports and
  exports all use the same JSON, checked by the same linter in the editor
  and in `lint-rules`.

### Added after the rename

These arrived in later releases and exist only in CLN:

| Release | Addition |
|---|---|
| v100.58.0 | `fieldRedirections`, rule `order`, raw rules with patterns and options (`$rawrule=`), `@@…$rawrule=` exceptions and `targetId` |
| v100.59.0 | generated ids for every rule, unique within a provider; pinned ids, so a switched-off rule keeps its setting when its text changes |
| after v100.61.0 | collision checks: two entries whose text means only one takes effect, and ids shared once generated ids count, in the editor, `lint-rules`, imports and remote rules |

## 5. What this means in practice

- **A ClearURLs catalog file:** use it as-is, for example as a remote rule
  set with its hash file.
- **A ClearURLs 2.0 YAML file:** Linkumori does not read YAML or convert
  it. Move the rules by hand, following
  [§15 of the comparison](clearurls-v2-vs-linkumori.md#15-moving-rules-between-the-formats).
- **A file written for Linkumori (ClearURLs 2.0):** rules that use only the
  catalog lists and the Linkumori additions still work. Rewrite the
  ClearURLs 2.0 spellings (`match` → `matchPattern`,
  `action.replacePattern` → `replacePattern`, `activeDefault` → `active`),
  move each `kind`/`action` rule to its list, and fold `domainExceptions`
  and `domainRedirections` into `exceptions` and `redirections`. Then run
  `node linkumori-cli-tool.js lint-rules <file>`.
