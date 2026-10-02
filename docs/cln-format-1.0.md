# Linkumori CLN Format 1.0 (Final)

Oct 2, 2026 · @Subham

> **Implementation.** Linkumori implements this document after v100.62.0. The
> rule-by-rule reference is [filter-syntax.md](filter-syntax.md); where the
> engine makes a choice this document leaves open, that page says so. The
> statement under Status and scope that nothing was tested against the engine
> describes the document as written; the worked examples and vectors below
> have since been checked against it.
>
> **Deviations.** Linkumori keeps no compatibility shims, since the custom rules
> editor and Remote Rules Health let people redo both settings:
>
> - A toggle saved under a bare `id` no longer applies (Rule ids and toggles,
>   "Saved toggles"). Toggles keyed `providerKey::id` or by match pattern
>   keep working.
> - Remote files configured before this change get no capabilities for free
>   (Remote file capabilities, "Existing installs"): their `redirect` and
>   `block` entries wait for acceptance like any other file's.

## Status and scope

This document is CLN Format 1.0 in its final form. It supersedes the 1.0 text announced on 2 October 2026, and there is no compatibility mode for that earlier text.

It is written against the [1.0 announcement](https://github.com/orgs/Linkumori/discussions/163). It has not been tested against the Linkumori engine.

**What it keeps.** Every key, array and pattern of the earlier 1.0 text stays valid. A file written for that text loads without edits, so no converter is needed.

**What it changes.** Run order, duplicate handling, toggle ids, filter escaping, and the safety of redirects and remote rule files. There are ten changes in all.

**No backward compatibility.** Every rule in this document applies to every rule file. A file that relied on the earlier behavior runs differently; Changes for existing rule files lists the cases.

## Summary of changes

1.0 final differs from the earlier 1.0 text in ten places, and all ten apply to every rule file.

| # | Change | Earlier 1.0 text | 1.0 final |
| --- | --- | --- | --- |
| 1 | Version key | None documented | Optional top-level `cln`, value `"1.0"` |
| 2 | `order` and stages | An ordered entry runs before every unordered entry, raw rules included | `order` is compared only inside its own stage; raw rules always run before field rules |
| 3 | Whole-number `matchPattern` | Runs ahead of its group, smallest number first | Keeps its array position like any other entry |
| 4 | Position of a replacing definition | Takes the first definition's array index and drops its `order` | Inherits both, unless it sets its own `order` or `"order": null` |
| 5 | `$removeparam` value escapes | A parameter whose name starts with a reserved character cannot be targeted | A backslash makes the next character literal |
| 6 | `@@` match point | Checked against the URL after raw rules have run | Checked against the URL as the provider received it |
| 7 | Toggle ids | Bare `id`, no namespacing; a replaced definition's id switches nothing | `providerKey::id`; replaced ids resolve to the winning definition |
| 8 | Redirect targets | Used verbatim; no check stated | Must be an absolute `http` or `https` URL |
| 9 | Termination | The cycle repeats on each new URL; no bound stated | At most 10 cycles per request; a rewrite applies once per request |
| 10 | Remote file capabilities | A remote file can redirect or block as soon as it loads | Capabilities are derived per file; redirect and block need acceptance |

Rows 8 and 9 may restate what the engine already does. The earlier text is silent on both, so 1.0 final writes them down.

## File structure

A rule file gains one optional top-level key, `cln`, which names the format version. Its only valid value is `"1.0"`.

```json
{
  "cln": "1.0",
  "defaults": { "requestTypes": ["main_frame"] },
  "providers": {
    "shop": {
      "domainPatterns": ["||shop.example^"],
      "rules": ["utm_source"]
    }
  }
}
```

The top-level keys are now `cln`, `providers`, `metadata` and `defaults`. Only `providers` is required.

| `cln` value | Loader behavior |
| --- | --- |
| absent | Loaded as 1.0 |
| `"1.0"` | Loaded as 1.0 |
| anything else | File rejected |

**One 1.0.** There is no separate value for the earlier 1.0 text. A file with no key and a file with `"1.0"` both get the rules in this document.

**Why the key exists.** It lets a later format version be told apart from 1.0 without guessing from the file's shape.

**Why not `version`.** The ClearURLs new rule format uses a top-level `version`, and Linkumori [imports those files](https://github.com/Linkumori/Linkumori-Addon/pull/149). A separate key keeps format detection unambiguous: `version` means ClearURLs, `cln` means CLN.

**Rejection.** A rejected remote file is not loaded and Remote Rules Health reports it as an error. A rejected built-in or custom file fails `lint-rules`.

## Processing order

Raw rules always run before field rules, and `order` only sorts entries inside one stage. This settles the open question in the earlier 1.0 text: the raw to field boundary cannot be crossed.

The stage sequence for each matching provider is unchanged:

1. `exceptions` (skip the provider if one matches)
2. `redirections`
3. `fieldRedirections`
4. `completeProvider`
5. `rawRules`
6. `rules` and `referralMarketing`
7. `$removeparam` filters

Stages 5 and 6 are sorted by one key, which gains a leading `stage` part:

```
(stage, orderGroup, order, rank, arrayIndex)
```

| Part | Value |
| --- | --- |
| `stage` | `0` for a `rawRules` entry; `1` for a `rules` or `referralMarketing` entry |
| `orderGroup` | `0` if the entry is a rule object with a numeric `order`; `1` otherwise |
| `order` | The entry's own `order`. Compared only between two `orderGroup` `0` entries of the same stage. Negative numbers and fractions are allowed |
| `rank` | Which array the entry sits in, from the table below |
| `arrayIndex` | The entry's zero-based position in its own array, with no exceptions |

| Array | `stage` | `rank` |
| --- | --- | --- |
| `rawRules` | `0` | `0` |
| `rules` | `1` | `0` |
| `rules`, object with `"referralMarketing": true` | `1` | `1` |
| `referralMarketing` | `1` | `2` |

Read the key left to right; the first part that differs decides.

- **Stage decides first.** No `order` value moves a field rule ahead of a raw rule.
- **Inside a stage, ordered entries run before unordered ones,** lowest `order` first.
- **At equal `order`, or with none,** entries run by `rank`, then by `arrayIndex`.
- **The key is total.** Every provider has exactly one sequence.

A cleanup that must happen before a raw rule is written as a raw rule. A raw rule is a regex against the whole URL, so it can express any parameter removal.

Three things carry over from the earlier 1.0 text. Entries that are off are left out. `$removeparam` filters run after stage 6. Neither they nor `@@` entries may carry an `order`.

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

With "allow referral marketing" off, the provider runs in this sequence. The last column shows where the earlier 1.0 text put the same entry.

| Run | Entry | `(stage, orderGroup, order, rank, arrayIndex)` | Earlier position |
| --- | --- | --- | --- |
| 1 | `rawRules[1]` `strip-jsessionid` | `(0, 0, 20, 0, 1)` | 2 |
| 2 | `rawRules[0]` the `/ref=` rule | `(0, 1, –, 0, 0)` | 4 |
| 3 | `rules[1]` `token-rewrite` | `(1, 0, 5, 0, 1)` | 1 |
| 4 | `rules[4]` `sid` | `(1, 0, 20, 0, 4)` | 3 |
| 5 | `rules[0]` `utm_source` | `(1, 1, –, 0, 0)` | 5 |
| 6 | `rules[2]` `fbclid` | `(1, 1, –, 0, 2)` | 6 |
| 7 | `rules[3]` `aff-id` | `(1, 1, –, 1, 3)` | 7 |
| 8 | `referralMarketing[0]` `tag` | `(1, 1, –, 2, 0)` | 8 |

The `$removeparam=/^pk_/` filter runs after row 8. In the earlier 1.0 text, `token-rewrite` read the URL before either raw rule had cleaned it. Here both raw rules finish first.

## Whole-number matchPattern entries

An entry written like `"3"` or `"20"` now runs at its array position, the same as any other entry.

In the earlier 1.0 text these entries jumped ahead of their group, smallest number first. The cause is recorded in [the 1.0 docs update](https://github.com/Linkumori/Linkumori-Addon/pull/162): the engine keys these lists by text, and JavaScript lists number-like keys first. 1.0 final removes the two whole-number rows from the rank table and makes `arrayIndex` the array position in every case.

**Engine requirement.** An engine that keys rule lists by text must use a structure that keeps insertion order for every key, such as a `Map`. A plain JavaScript object does not qualify.

**Lint.** The warning for a whole-number entry without an `order` is withdrawn.

### Worked example

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

| Run | Entry | `(stage, orderGroup, order, rank, arrayIndex)` | Earlier position |
| --- | --- | --- | --- |
| 1 | `rawRules[0]` `"r"` | `(0, 1, –, 0, 0)` | 2 |
| 2 | `rawRules[1]` `"3"` | `(0, 1, –, 0, 1)` | 1 |
| 3 | `rules[0]` `"a"` | `(1, 1, –, 0, 0)` | 6 |
| 4 | `rules[1]` `"20"` | `(1, 1, –, 0, 1)` | 5 |
| 5 | `rules[3]` `"b"` | `(1, 1, –, 0, 3)` | 7 |
| 6 | `rules[2]` `"9"` | `(1, 1, –, 1, 2)` | 4 |
| 7 | `referralMarketing[0]` `"rm"` | `(1, 1, –, 2, 0)` | 8 |
| 8 | `referralMarketing[1]` `"5"` | `(1, 1, –, 2, 1)` | 3 |

Every entry runs where the file lists it. Rows 6 to 8 follow the unmarked `rules` entries because of `rank`, not because of their text.

## Same text twice

A definition that replaces an earlier one now keeps the earlier one's position, `order` included, unless it sets its own.

The groups are unchanged: raw (`rawRules`), field (`rules` entries without the referral mark), and referral (marked `rules` objects, then `referralMarketing`). Two entries with the same `matchPattern` text in one group are still one entry. The last definition that isn't off still wins whole: its `id`, its `replacePattern` and every other key.

Two things change.

**Position.** A winning definition without its own `order` takes two things from the earlier definitions that aren't off. Its `arrayIndex` comes from the first one. Its `order` comes from the nearest earlier one that has an `order` key. Under the earlier 1.0 text it took the `arrayIndex` and lost the `order`.

**Ids.** The `id` and `aliases` of every replaced definition resolve to the winner. Under the earlier 1.0 text, toggling them switched nothing. See Rule ids and toggles.

| First definition | Later definition | Earlier 1.0 text | 1.0 final |
| --- | --- | --- | --- |
| `token`, `order: 1` | `"token"` | No `order`; first definition's index | `order: 1`; first definition's index |
| `token`, `order: 1` | `token`, `order: 50` | `order: 50`; own index | Same as earlier |
| `token`, `order: 1` | `token`, `"order": null` | Not defined | No `order`; first definition's index |
| `"token"` | `token` with a `replacePattern` | Rewrite, at first definition's index | Same as earlier |

**`"order": null`** is new. It means "no order, and do not inherit one". It is the explicit way to drop an `order` set by an earlier definition.

**Across field and referral.** Unchanged in substance. While referral-marketing rules run, a referral entry with the same text as a field entry replaces it. Without its own `order` it takes the field entry's place, now including that entry's `order`.

**Raw and field.** Entries with the same text in the raw and field groups still do not collide; both run.

**Within one file.** Two different entries with the same text in one array remain a `lint-rules` error. Inheritance exists for merges across files, not as an authoring feature.

## Overload mode

A remote copy of a built-in rule no longer drops the built-in `order` by accident, and a replaced rule is reported as a notice, not an error.

Four parts of overload mode are unchanged from the earlier 1.0 text:

- **Load order.** Remote files merge with each other in listed order, then with the built-in rules: built-in first, remote after.
- **Which providers merge.** Only those with the same `domainPatterns` or `urlPattern`, and the same `methods`, `resourceTypes`, `completeProvider` and `forceRedirection`.
- **Joining.** `rules`, `rawRules` and `referralMarketing` are each joined in load order.
- **Exact copies.** Only entries that are exactly alike count once while joining.

Two parts change.

**Position inheritance.** The rule in Same text twice applies to the merged provider. A remote copy without an `order` keeps the `order` of the copy it replaces. To drop it, the remote copy sets `"order": null`.

**Remote Rules Health levels.** A rule replaced by a merge is a notice that names the replacing file. An error is reserved for a file or entry that did not load.

| Built-in | Remote | Earlier 1.0 text | 1.0 final |
| --- | --- | --- | --- |
| `token`, `order: 1` | `token`, `order: 50` | `token` at `order: 50` | Same as earlier |
| `token`, `order: 1` | `"token"` | `token` with no `order` | `token` at `order: 1` |
| `token`, `order: 1` | `token`, `"order": null` | Not defined | `token` with no `order` |
| `token`, `order: 1` | file 1: `token`, `order: 20`; file 2: `token`, `order: 30` | `token` at `order: 30` | Same as earlier |
| `token`, `order: 1` | file 1: `token`, `order: 20`; file 2: `"token"` | `token` with no `order` | `token` at `order: 20` |
| `a` `order: 1`, `b` `order: 2` | `b` `order: 1`, `a` `order: 2` | `b`, then `a` | Same as earlier |
| `fromBuiltIn`, `order: 5` | `fromRemote`, `order: 5` | Both; `fromBuiltIn` first | Same as earlier |
| `token` `order: 1` on `site.example` | `token` `order: 50` on `other.example` | Not merged: two providers | Same as earlier |

## Rule ids and toggles

A toggle is now keyed by provider and rule together, as `providerKey::id`, so two providers can use the same rule id without sharing a switch.

The earlier 1.0 text keys the toggle off the rule `id` alone and does not describe namespacing. 1.0 final specifies it.

- **Toggle key.** `providerKey::id`, where `providerKey` is the provider's key under `providers`. Example: `shop::token-rewrite`. An `id` cannot contain a colon, so the key splits at its last `::`.
- **Unique in a provider.** Within one provider of one file, every `id` and every alias is distinct. A repeat is a `lint-rules` error. Generated ids count.
- **Replaced definitions.** When one definition replaces another, the `id` and `aliases` of each replaced definition resolve to the winner. Toggling any of them switches the one rule that runs.
- **Saved toggles.** A toggle saved under a bare `id` keeps working as before. It is saved in the namespaced form the next time the person changes it.
- **Shared provider keys.** Two providers that share a key but do not merge also share toggles for equal ids. Remote Rules Health warns about each such pair.
- **Generated ids.** Unchanged. An id is still generated from the list and the `matchPattern` text when left out, and still changes when that text is edited.

### Worked example

The built-in rules define `token` with `"id": "token-rewrite"` in provider `shop`. A person switches `shop::token-rewrite` off. Later a remote file replaces that rule with a definition whose `id` is `tok`.

|  | Earlier 1.0 text | 1.0 final |
| --- | --- | --- |
| Rule that runs | The remote definition | The remote definition |
| Effect of the saved toggle | None: the replaced id switches nothing | The rule stays off |
| Ids that switch the rule | `tok` | `shop::tok` and `shop::token-rewrite` |

## $removeparam and @@ exceptions

Any parameter name can now be targeted, and an `@@` entry is matched against the URL the provider received.

### Value escapes

A backslash in a `$removeparam` value makes the next character literal. In the earlier 1.0 text the first character after `=` picks the value form, so a parameter named `~foo`, or one starting with `|`, could not be targeted.

- `$removeparam=\~foo` removes the parameter named `~foo`.
- `$removeparam=\|foo` removes the parameter named `|foo`.
- `$removeparam=\/foo/` removes the parameter named `/foo/`.
- `$removeparam=a\,b` removes the parameter named `a,b`. The comma does not start the modifier list.
- `$removeparam=\\foo` removes the parameter named `\foo`.

Three rules bound the feature:

- **Only these five.** `\~`, `\|`, `\/`, `\,` and `\\` are the valid escapes in a name value. A backslash before any other character is a `lint-rules` error.
- **Regex values.** Inside a `/regex/` value the backslash keeps its regex meaning. A comma after a backslash never starts the modifier list, in any value form.
- **Everywhere a value is read.** The escapes apply in `rules`, `referralMarketing`, `fieldRedirections` and `@@` entries.

In a JSON rule file each backslash is written twice: `"$removeparam=\\~foo"`.

### Where @@ is matched

An `@@` entry's pattern and modifiers are checked against the URL as the provider received it at the start of the current cycle. In the earlier 1.0 text they were checked after the provider's raw rules had run, so an exception scoped to a path that a raw rule deletes stopped matching.

```json
{
  "cln": "1.0",
  "providers": {
    "shop": {
      "domainPatterns": ["||shop.example^"],
      "rawRules": ["\\/ref=[^/?]*"],
      "rules": [
        "$removeparam=tag",
        "@@||shop.example^/ref=$removeparam=tag"
      ]
    }
  }
}
```

For `https://shop.example/ref=abc?tag=1`:

|  | Earlier 1.0 text | 1.0 final |
| --- | --- | --- |
| URL the `@@` pattern is checked against | `https://shop.example?tag=1` | `https://shop.example/ref=abc?tag=1` |
| Does the exception match | No | Yes |
| Result | `https://shop.example` | `https://shop.example?tag=1` |

### Unchanged

- An `@@` entry guards only against `$removeparam` filters. A plain `rules` entry still removes its parameter, and raw rules keep their own `@@…$rawrule=` entries.
- An `@@` entry has no place in the run order and cannot carry an `order`.
- An `@@` entry still reaches into other providers' filters on pages its own provider matches. A remote file that does this now shows the `except` capability; see the next section.

## Redirect and block safety

A redirect may only go to an absolute `http` or `https` URL, processing always terminates, and a remote file cannot redirect or block until the person accepts that.

### Redirect targets

A redirect target is valid when it parses as an absolute URL, its scheme is `http` or `https`, and it has a host.

The check covers all three sources of a target: the capture group of a `redirections` regex, the fixed target of a `$redirect=` entry, and the parameter value picked by `fieldRedirections`. It runs after the entry's preprocessors.

- **Invalid target.** No redirect happens. The entry is treated as not matching, and later stages run on the unchanged URL.
- **Cross-origin rewrite.** A raw rule with a `replacePattern` whose result has a different scheme, host or port from its input is a redirect. It needs a valid target and, in a remote file, the `redirect` capability.
- **Lint.** A `$redirect=` entry whose fixed target is not `http` or `https` is a `lint-rules` error.

### Termination

Processing a request ends after a bounded number of cycles. The earlier 1.0 text says the cycle repeats on each new URL and states no bound. Read literally, a rewrite such as `clean-§1§` would apply again on every cycle.

- **Cycle cap.** At most 10 cycles run per request. At the cap, processing stops and the URL is used as it stands. The value 10 is a proposal.
- **Rewrites run once.** An entry with a `replacePattern` applies at most once per request.
- **No-op steps.** A step whose output equals its input is not a change and does not start a new cycle.

### Remote file capabilities

A remote file's capabilities are derived from its content when it loads. A file does not declare them.

| Capability | A file has it when it contains | Active on load |
| --- | --- | --- |
| `strip` | A `rules`, `rawRules` or `referralMarketing` entry, or a `$removeparam` filter | Yes |
| `rewrite` | An entry with a `replacePattern` | Yes |
| `except` | A provider `exceptions` entry or an `@@` entry | Yes |
| `redirect` | A `redirections` or `fieldRedirections` entry, or `forceRedirection` | After acceptance |
| `block` | A provider with `"completeProvider": true` | After acceptance |

- **Built-in and custom rules** hold every capability.
- **Acceptance** is given per remote file and per capability. Until then, that file's redirect or block entries stay inactive and the rest of the file loads.
- **Updates.** When an update gives a file a capability it did not have, the new capability's entries stay inactive until accepted.
- **Existing installs.** The capabilities a remote file already has when the engine first applies this rule count as accepted. Nothing that works today stops.
- **Visibility.** Remote Rules Health lists each remote file's capabilities.

## Conformance

An engine conforms to CLN 1.0 when it reproduces every worked example and table in this document and the vectors below.

### Lint checks

| Check | Level |
| --- | --- |
| `cln` is present and is not `"1.0"` | Error |
| An `id` or alias repeats within one provider | Error |
| A `$redirect=` entry's fixed target is not `http` or `https` | Error |
| Two different entries with the same text sit in one array | Error |
| A `$removeparam` filter or `@@` entry carries an `order`, `null` included | Error |
| A backslash precedes a character that has no escape, in a name value | Error |

The warning for a whole-number `matchPattern` without an `order` is withdrawn. Position no longer depends on it.

### Run-order vectors

The worked examples under Processing order and Whole-number matchPattern entries are normative. So are the result tables under Same text twice, Overload mode and Rule ids and toggles.

### Redirect vectors

The provider matches `site.example` and has `"fieldRedirections": ["redirect"]`.

| Request URL | Result |
| --- | --- |
| `https://site.example/away?redirect=https://real.example/page` | Redirect to `https://real.example/page` |
| `https://site.example/away?redirect=javascript:alert(1)` | No redirect: scheme is not `http` or `https` |
| `https://site.example/away?redirect=ftp://files.example/x` | No redirect: scheme is not `http` or `https` |
| `https://site.example/away?redirect=//real.example/page` | No redirect: not an absolute URL |
| `https://site.example/away?redirect=/local/page` | No redirect: not an absolute URL |

In each "no redirect" row the provider's later stages still run on the request URL.

### Termination vector

The `token-rewrite` rule from Processing order runs against `https://shop.example/?token=abc123`. The result is `https://shop.example/?token=clean-abc123`, and it does not change on any later cycle.

## Changes for existing rule files

Every file written for the earlier 1.0 text is a valid 1.0 final file, so there is no converter and no compatibility mode. Five behaviors change, and a file that relied on one needs an edit.

| What the file has | Earlier behavior | Behavior now | Edit, if the earlier behavior was intended |
| --- | --- | --- | --- |
| A `rules` or `referralMarketing` entry with an `order`, in a provider with raw rules | Ran before unordered raw rules | Runs after every raw rule | Rewrite it as a raw rule |
| A whole-number `matchPattern` without an `order` | Ran ahead of its group | Runs at its array position | Move it earlier in its array |
| An `@@` entry scoped to a path that a raw rule deletes | Did not match | Matches | Narrow or remove the entry |
| A `$removeparam` name value that contains a backslash | Read literally | Read as an escape; an unknown escape is a lint error | Write the backslash twice |
| A remote copy of a built-in rule, without an `order` | Dropped the built-in `order` | Keeps it | Add `"order": null` |

Three engine rules also take effect for every file:

- A redirect to a relative target, or to a scheme other than `http` or `https`, no longer happens.
- A rewrite applies once per request, and processing stops after 10 cycles.
- A newly added remote file's redirects and blocks wait for acceptance. Remote files already installed are unaffected.

Saved toggles keep working.

## Deferred to 2.0

1.0 final leaves the file layout alone, so six known problems stay open for 2.0.

- **One rules array.** The single-array candidate from the 1.0 announcement is still the main design choice. The other candidate, an explicit `stage` key, has little left to add once `order` cannot cross stages.
- **Two spellings for referral marketing.** The `referralMarketing` array and the `"referralMarketing": true` flag both remain.
- **String mini-languages.** One entry string can still be a name, a name regex, a domain pattern or a filter.
- **Steps outside the sort.** Redirects keep their own arrays, and `$removeparam` filters still run last and cannot be ordered.
- **No converter.** The earlier 1.0 text maps concepts to the ClearURLs formats but defines no converter in either direction. 1.0 final does not add one.
- **Generated ids.** An id generated from `matchPattern` text still changes when that text is edited.

## Sources

- [Announcing Linkumori CLN Format 1.0](https://github.com/orgs/Linkumori/discussions/163), discussion #163, read in full on 2 October 2026. Every statement about the earlier 1.0 text comes from it, including the ClearURLs `version` key.
- [Linkumori-Addon pull request #162](https://github.com/Linkumori/Linkumori-Addon/pull/162), from its search excerpt: the cause of whole-number ordering.
- [Linkumori-Addon pull request #149](https://github.com/Linkumori/Linkumori-Addon/pull/149), from its search excerpt: Linkumori reads the ClearURLs formats.

Nothing here was tested against the Linkumori engine. Where the earlier 1.0 text is silent, this document says so and sets a rule.
