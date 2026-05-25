# Changelog
All notable changes to this project will be documented in this file.

The format is based on [Keep a Changelog](https://keepachangelog.com/en/1.0.0/),
and this project adheres to [Semantic Versioning](https://semver.org/spec/v2.0.0.html).

---



---

<!-- Legacy changelog entries below are preserved from the original ClearURLs project -->

## [Unreleased]
### Changed
- No unreleased commit entries.

## [v100.14.0] - 2026-05-25 ([compare](https://github.com/Linkumori/Linkumori-Addon/compare/linkumori-v100.13.0...linkumori-v100.14.0))
### Changed
- Update logic (`2026-05-26`, hash: [`7523239`](https://github.com/Linkumori/Linkumori-Addon/commit/7523239))

## [v100.13.0] - 2026-05-25 ([compare](https://github.com/Linkumori/Linkumori-Addon/compare/linkumori-v100.12.0...linkumori-v100.13.0))
### Fixed
- Resolve .build-ignore relative to script file in CI (`2026-05-26`, hash: [`219d940`](https://github.com/Linkumori/Linkumori-Addon/commit/219d940))

## [v100.12.0] - 2026-05-25 ([compare](https://github.com/Linkumori/Linkumori-Addon/compare/linkumori-v100.11.0...linkumori-v100.12.0))
### Added
- Engine improvements and dialect documentation consolidation (`2026-05-24`, hash: [`53ebce3`](https://github.com/Linkumori/Linkumori-Addon/commit/53ebce3))

### Changed
- Add regression cases for engine improvements (`2026-05-24`, hash: [`035acb7`](https://github.com/Linkumori/Linkumori-Addon/commit/035acb7))
- Address PR review cleanup (`2026-05-25`, hash: [`abcb3a7`](https://github.com/Linkumori/Linkumori-Addon/commit/abcb3a7))
- Address PR review feedback (`2026-05-25`, hash: [`05e8e03`](https://github.com/Linkumori/Linkumori-Addon/commit/05e8e03))
- Align ClearURLs rule identity and provider counts (`2026-05-25`, hash: [`e91cae1`](https://github.com/Linkumori/Linkumori-Addon/commit/e91cae1))
- Align provider context with ClearURLs core (`2026-05-25`, hash: [`e8b6d06`](https://github.com/Linkumori/Linkumori-Addon/commit/e8b6d06))
- Align rule activation with ClearURLs origins (`2026-05-25`, hash: [`439adc0`](https://github.com/Linkumori/Linkumori-Addon/commit/439adc0))
- Pass activation state in regression batch (`2026-05-25`, hash: [`1cbb45f`](https://github.com/Linkumori/Linkumori-Addon/commit/1cbb45f))
- Polish provider import labels (`2026-05-25`, hash: [`5c54395`](https://github.com/Linkumori/Linkumori-Addon/commit/5c54395))
- Remove useless files (`2026-05-25`, hash: [`58e6b69`](https://github.com/Linkumori/Linkumori-Addon/commit/58e6b69))
- Update rules (`2026-05-25`, hash: [`f2db5d1`](https://github.com/Linkumori/Linkumori-Addon/commit/f2db5d1))
- Update translations (`2026-05-26`, hash: [`d780997`](https://github.com/Linkumori/Linkumori-Addon/commit/d780997))

### Fixed
- Apply PR #130 review fixes (`2026-05-24`, hash: [`c1f2a73`](https://github.com/Linkumori/Linkumori-Addon/commit/c1f2a73)) [#130](https://github.com/Linkumori/Linkumori-Addon/issues/130)
- Thread sessionRewrites set through cleaning loop (`2026-05-24`, hash: [`d3c7d2f`](https://github.com/Linkumori/Linkumori-Addon/commit/d3c7d2f))

## [v100.11.0] - 2026-05-24 ([compare](https://github.com/Linkumori/Linkumori-Addon/compare/linkumori-v100.10.0...linkumori-v100.11.0))
### Changed
- Update wiki (`2026-05-23`, hash: [`9ab23c6`](https://github.com/Linkumori/Linkumori-Addon/commit/9ab23c6))

## [v100.10.0] - 2026-05-22 ([compare](https://github.com/Linkumori/Linkumori-Addon/compare/linkumori-v100.9.1...linkumori-v100.10.0))
### Changed
- Address valid cleanup review feedback (`2026-05-22`, hash: [`95dab88`](https://github.com/Linkumori/Linkumori-Addon/commit/95dab88))
- Tool.js now integerate with ip-ranger.js (`2026-05-22`, hash: [`d483341`](https://github.com/Linkumori/Linkumori-Addon/commit/d483341))

### Removed
- Remove redundant runtime snapshot plumbing (`2026-05-22`, hash: [`8294ca3`](https://github.com/Linkumori/Linkumori-Addon/commit/8294ca3))

## [v100.9.1] - 2026-05-21 ([compare](https://github.com/Linkumori/Linkumori-Addon/compare/linkumori-v100.9.0...linkumori-v100.9.1))
### Added
- **nav**: Replace localStorage view state with URL fragment navigation (`2026-05-21`, hash: [`ae7c1f1`](https://github.com/Linkumori/Linkumori-Addon/commit/ae7c1f1))

### Fixed
- **regression**: Resolve 5 failing provider snapshot and preprocessor tests (`2026-05-21`, hash: [`bd9d4e8`](https://github.com/Linkumori/Linkumori-Addon/commit/bd9d4e8))

## [v100.9.0] - 2026-05-21 ([compare](https://github.com/Linkumori/Linkumori-Addon/compare/linkumori-v100.8.0...linkumori-v100.9.0))
### Documentation
- **privacy**: Add Issue Reporting Feature clause and bump consent version (`2026-05-21`, hash: [`6bc4ae1`](https://github.com/Linkumori/Linkumori-Addon/commit/6bc4ae1))

## [v100.8.0] - 2026-05-21 ([compare](https://github.com/Linkumori/Linkumori-Addon/compare/linkumori-v100.7.1...linkumori-v100.8.0))
### Added
- Introduce bug report button and GitHub issue report page (`2026-05-21`, hash: [`9b584c9`](https://github.com/Linkumori/Linkumori-Addon/commit/9b584c9))

### Performance
- Speed up up removeparam matching (`2026-05-21`, hash: [`7c74de5`](https://github.com/Linkumori/Linkumori-Addon/commit/7c74de5))

## [v100.7.1] - 2026-05-20 ([compare](https://github.com/Linkumori/Linkumori-Addon/compare/linkumori-v100.7.0...linkumori-v100.7.1))
### Changed
- Release v100.7.1 (hash: `d6a0dc6`).
- Updated files:
  - `COMMIT_HISTORY.md`

## [v100.7.0] - 2026-05-20 ([compare](https://github.com/Linkumori/Linkumori-Addon/compare/linkumori-v100.6.1...linkumori-v100.7.0))
### Changed
- Create npm-publish-github-packages.yml (`2026-05-20`, hash: [`bd70d63`](https://github.com/Linkumori/Linkumori-Addon/commit/bd70d63))

### Removed
- Delete .github/workflows/npm-publish-github-packages.yml (`2026-05-20`, hash: [`91a6074`](https://github.com/Linkumori/Linkumori-Addon/commit/91a6074))

## [v100.6.1] - 2026-05-20 ([compare](https://github.com/Linkumori/Linkumori-Addon/compare/linkumori-v100.6.0...linkumori-v100.6.1))
### Added
- Implement ClearURLs dialect runtime snapshots (`2026-05-20`, hash: [`6682fbb`](https://github.com/Linkumori/Linkumori-Addon/commit/6682fbb))

### Changed
- Align ClearURLs dialect with core engine (`2026-05-20`, hash: [`e74dfac`](https://github.com/Linkumori/Linkumori-Addon/commit/e74dfac))
- Improve regression runner diagnostics (`2026-05-20`, hash: [`a38c68b`](https://github.com/Linkumori/Linkumori-Addon/commit/a38c68b))

## [v100.6.0] - 2026-05-20 ([compare](https://github.com/Linkumori/Linkumori-Addon/compare/linkumori-v100.5.2...linkumori-v100.6.0))
### Changed
- Name legacy syntax Linkumori ClearURLs dialect (`2026-05-20`, hash: [`fadc702`](https://github.com/Linkumori/Linkumori-Addon/commit/fadc702))
- Rename v3 editor mode to ClearURLs dialect (`2026-05-20`, hash: [`e9fe7f9`](https://github.com/Linkumori/Linkumori-Addon/commit/e9fe7f9))

### Fixed
- Resolve neutral v3 custom rule templates (`2026-05-20`, hash: [`221ffea`](https://github.com/Linkumori/Linkumori-Addon/commit/221ffea))

### Performance
- Performance boost for index (`2026-05-20`, hash: [`587793d`](https://github.com/Linkumori/Linkumori-Addon/commit/587793d))

### Documentation
- Document ClearURLs rule dialects (`2026-05-20`, hash: [`ee64b97`](https://github.com/Linkumori/Linkumori-Addon/commit/ee64b97))
- Document both custom rule dialects side by side (`2026-05-20`, hash: [`38ef20c`](https://github.com/Linkumori/Linkumori-Addon/commit/38ef20c))

## [v100.5.2] - 2026-05-18 ([compare](https://github.com/Linkumori/Linkumori-Addon/compare/linkumori-v100.5.1...linkumori-v100.5.2))
### Changed
- Release v100.5.2 (hash: `596ae98`).
- Updated files:
  - `COMMIT_HISTORY.md`

## [v100.5.1] - 2026-05-18 ([compare](https://github.com/Linkumori/Linkumori-Addon/compare/linkumori-v100.5.0...linkumori-v100.5.1))
### Added
- (rules): introduce Linkumori-native superset format https://gitlab.com/ClearURLs/core/-/merge_requests/4 - Simple removals remain plain strings - Advanced rules use explicit object keys (field/raw/url + remove/rewrite/redirect) - Editor docs, validation, and examples updated to reflect native format (`2026-05-18`, hash: [`0255e8e`](https://github.com/Linkumori/Linkumori-Addon/commit/0255e8e))
- Implement native superset rules across tooling (`2026-05-18`, hash: [`f26f882`](https://github.com/Linkumori/Linkumori-Addon/commit/f26f882))
- Introduce durable native rule identity support (`2026-05-18`, hash: [`112fb7e`](https://github.com/Linkumori/Linkumori-Addon/commit/112fb7e))
- Introduce localized ClearURLs dialect editor mode (`2026-05-19`, hash: [`71b0bb2`](https://github.com/Linkumori/Linkumori-Addon/commit/71b0bb2))
- Introduce rich ClearURLs rule syntax support (`2026-05-18`, hash: [`f0b5911`](https://github.com/Linkumori/Linkumori-Addon/commit/f0b5911))
- Introduce rich syntax support based on clearurls based on dev branch (`2026-05-18`, hash: [`b9b5071`](https://github.com/Linkumori/Linkumori-Addon/commit/b9b5071))

### Changed
- Support canonical v2 ClearURLs rules (`2026-05-18`, hash: [`593757d`](https://github.com/Linkumori/Linkumori-Addon/commit/593757d))
- Support canonical v2 ClearURLs rules (`2026-05-18`, hash: [`6f4c43c`](https://github.com/Linkumori/Linkumori-Addon/commit/6f4c43c))
- Update ci-runner.js (`2026-05-18`, hash: [`0e0cac2`](https://github.com/Linkumori/Linkumori-Addon/commit/0e0cac2))
- Update regression-server.js (`2026-05-18`, hash: [`b72de95`](https://github.com/Linkumori/Linkumori-Addon/commit/b72de95))

### Fixed
- Address native rule review feedback (`2026-05-18`, hash: [`35b5e6b`](https://github.com/Linkumori/Linkumori-Addon/commit/35b5e6b))
- Harden native rule runtime edge cases (`2026-05-18`, hash: [`253ccdd`](https://github.com/Linkumori/Linkumori-Addon/commit/253ccdd))
- Resolve ubo removeparam interoperability (`2026-05-17`, hash: [`645f681`](https://github.com/Linkumori/Linkumori-Addon/commit/645f681))

### Reverted
- Revert "feat: add durable native rule identity support" (reverts `112fb7e`) (`2026-05-18`, hash: [`2c860e7`](https://github.com/Linkumori/Linkumori-Addon/commit/2c860e7))
- Revert "feat:(rules): introduce Linkumori-native superset format" (reverts `0255e8e`) (`2026-05-18`, hash: [`b950ecd`](https://github.com/Linkumori/Linkumori-Addon/commit/b950ecd))
- Revert "fix: address native rule review feedback" (reverts `35b5e6b`) (`2026-05-18`, hash: [`ad980b6`](https://github.com/Linkumori/Linkumori-Addon/commit/ad980b6))
- Revert "fix: harden native rule runtime edge cases" (reverts `253ccdd`) (`2026-05-18`, hash: [`80eda8f`](https://github.com/Linkumori/Linkumori-Addon/commit/80eda8f))

## [v100.5.0] - 2026-05-17 ([compare](https://github.com/Linkumori/Linkumori-Addon/compare/linkumori-v100.4.0...linkumori-v100.5.0))
### Changed
- Release v100.5.0 (hash: `b277cc9`).
- Updated files:
  - `COMMIT_HISTORY.md`

## [v100.4.0] - 2026-05-17 ([compare](https://github.com/Linkumori/Linkumori-Addon/compare/linkumori-v100.3.0...linkumori-v100.4.0))
### Changed
- Run regression suite as single background batch call (`2026-05-17`, hash: [`807b930`](https://github.com/Linkumori/Linkumori-Addon/commit/807b930))

## [v100.3.0] - 2026-05-17 ([compare](https://github.com/Linkumori/Linkumori-Addon/compare/linkumori-v100.2.0...linkumori-v100.3.0))
### Changed
- Release v100.3.0 (hash: `076f0bc`).
- Updated files:
  - `COMMIT_HISTORY.md`

## [v100.2.0] - 2026-05-16 ([compare](https://github.com/Linkumori/Linkumori-Addon/compare/linkumori-v100.1.0...linkumori-v100.2.0))
### Changed
- Release v100.2.0 (hash: `cfdc079`).
- Updated files:
  - `COMMIT_HISTORY.md`

## [v100.1.0] - 2026-05-16 ([compare](https://github.com/Linkumori/Linkumori-Addon/compare/linkumori-v100.0.4...linkumori-v100.1.0))
### Fixed
- Regression suite, URL filter interoperability, and AdGuard spec compliance (`2026-05-16`, hash: [`05de749`](https://github.com/Linkumori/Linkumori-Addon/commit/05de749))

## [v100.0.4] - 2026-05-16 ([compare](https://github.com/Linkumori/Linkumori-Addon/compare/linkumori-v100.0.3...linkumori-v100.0.4))
### Added
- Introduce in-extension regression suite runner (`2026-05-16`, hash: [`0b3aa2b`](https://github.com/Linkumori/Linkumori-Addon/commit/0b3aa2b))

### Changed
- Address regression suite review feedback (`2026-05-16`, hash: [`4df27f5`](https://github.com/Linkumori/Linkumori-Addon/commit/4df27f5))
- Exclude regression suite from builds (`2026-05-16`, hash: [`26696b3`](https://github.com/Linkumori/Linkumori-Addon/commit/26696b3))

## [v100.0.3] - 2026-05-15 ([compare](https://github.com/Linkumori/Linkumori-Addon/compare/linkumori-v100.0.2...linkumori-v100.0.3))
### Changed
- Address pr review feedback (`2026-05-15`, hash: [`327c2fa`](https://github.com/Linkumori/Linkumori-Addon/commit/327c2fa))
- Downloaded latest public suffix list from upstream (`2026-05-15`, hash: [`f4be0b7`](https://github.com/Linkumori/Linkumori-Addon/commit/f4be0b7))

### Fixed
- Resolve url filter syntax handling and provider indexing (`2026-05-15`, hash: [`ca1bcd2`](https://github.com/Linkumori/Linkumori-Addon/commit/ca1bcd2))

### Removed
- Remove inferred main frame source fallback (`2026-05-15`, hash: [`b68dcf1`](https://github.com/Linkumori/Linkumori-Addon/commit/b68dcf1))

## [v100.0.2] - 2026-05-13 ([compare](https://github.com/Linkumori/Linkumori-Addon/compare/linkumori-v100.0.1...linkumori-v100.0.2))
### Changed
- Downloaded latest public suffix list from upstream (`2026-05-13`, hash: [`2b779ed`](https://github.com/Linkumori/Linkumori-Addon/commit/2b779ed))
- Recompile from same source code using new version of fontforge (`2026-05-13`, hash: [`a6386d8`](https://github.com/Linkumori/Linkumori-Addon/commit/a6386d8))

## [v100.0.1] - 2026-05-13 ([compare](https://github.com/Linkumori/Linkumori-Addon/compare/linkumori-v67.0...linkumori-v100.0.1))
### Changed
- Add stable and patch version semantics (`2026-05-13`, hash: [`66dd949`](https://github.com/Linkumori/Linkumori-Addon/commit/66dd949))
- Adjust to manfiest.json (`2026-05-13`, hash: [`1bf5b4a`](https://github.com/Linkumori/Linkumori-Addon/commit/1bf5b4a))
- Update package-lock.json (`2026-05-13`, hash: [`abf3869`](https://github.com/Linkumori/Linkumori-Addon/commit/abf3869))

### Fixed
- Resolve inaccuracy in README.MD (`2026-05-13`, hash: [`9f9e45f`](https://github.com/Linkumori/Linkumori-Addon/commit/9f9e45f))

## [v67.0] - 2026-05-13 ([compare](https://github.com/Linkumori/Linkumori-Addon/compare/linkumori-v66.0...linkumori-v67.0))
### Added
- Introduce updated rules (`2026-05-13`, hash: [`f034c94`](https://github.com/Linkumori/Linkumori-Addon/commit/f034c94))

### Changed
- Improve trie persistence and index pattern generation (`2026-05-13`, hash: [`19ae20a`](https://github.com/Linkumori/Linkumori-Addon/commit/19ae20a))
- Remove more stuff for enchanced speed (`2026-05-13`, hash: [`ba246b8`](https://github.com/Linkumori/Linkumori-Addon/commit/ba246b8))
- Tighten index pattern extraction (`2026-05-13`, hash: [`d102adc`](https://github.com/Linkumori/Linkumori-Addon/commit/d102adc))
- Unify CLI clearurls URL filter output (`2026-05-13`, hash: [`be4caf2`](https://github.com/Linkumori/Linkumori-Addon/commit/be4caf2))
- Unify url filter rules under ClearURLsData (`2026-05-13`, hash: [`b6d7804`](https://github.com/Linkumori/Linkumori-Addon/commit/b6d7804))

### Fixed
- Address PR review findings (`2026-05-13`, hash: [`30afe95`](https://github.com/Linkumori/Linkumori-Addon/commit/30afe95))
- Align settings import with unified ClearURLsData (`2026-05-13`, hash: [`f6bcb1d`](https://github.com/Linkumori/Linkumori-Addon/commit/f6bcb1d))

### Documentation
- Add maintainer wiki and refresh rule syntax (`2026-05-13`, hash: [`e882869`](https://github.com/Linkumori/Linkumori-Addon/commit/e882869))

## [v66.0] - 2026-05-13 ([compare](https://github.com/Linkumori/Linkumori-Addon/compare/linkumori-v65.0...linkumori-v66.0))
### Changed
- Remove useless fuction to get best speed (`2026-05-13`, hash: [`1881a5e`](https://github.com/Linkumori/Linkumori-Addon/commit/1881a5e))
- Update index logic and update matching logic (`2026-05-13`, hash: [`4401705`](https://github.com/Linkumori/Linkumori-Addon/commit/4401705))

## [v65.0] - 2026-05-12 ([compare](https://github.com/Linkumori/Linkumori-Addon/compare/linkumori-v64.0...linkumori-v65.0))
### Added
- Add index pattern in other subsytem (`2026-05-12`, hash: [`13bcb9a`](https://github.com/Linkumori/Linkumori-Addon/commit/13bcb9a))
- Introduce rules with index with cli updated (`2026-05-13`, hash: [`3f92ac8`](https://github.com/Linkumori/Linkumori-Addon/commit/3f92ac8))
- Update all translation added multiple indexpattern in one provider and some bug fixes (`2026-05-12`, hash: [`9cf0177`](https://github.com/Linkumori/Linkumori-Addon/commit/9cf0177))

## [v64.0] - 2026-05-12 ([compare](https://github.com/Linkumori/Linkumori-Addon/compare/linkumori-v63.0...linkumori-v64.0))
### Changed
- Release v64.0 (hash: `d5aa27e`).
- Updated files:
  - `manifest.json`

## [v63.0] - 2026-05-12 ([compare](https://github.com/Linkumori/Linkumori-Addon/compare/linkumori-v62.0...linkumori-v63.0))
### Added
- **provider-index**: Replace regular expression-heuristic token extraction with explicit indexPattern; add regular expression literal support in domainPatterns  ── Problem ──────────────────────────────────────────────────────────  providersByToken was populated by getLookupToken(), which parsed the urlPattern regular expression source to guess which hostname the provider targets. This approach had three compounding failure modes:  1. Alternation groups like (?:youtube\.com|youtu\.be) and optional    groups like (?:accounts\.)?firefox\.com produced no token, silently    falling every affected provider into globalProviders — checked on    every single request regardless of URL.  2. Path-heavy patterns like youtube\.com\/pagead leaked path tokens    ("pagead", "api", "landings") into the index. Those tokens never    appear as dot-split hostname labels at lookup time, so the provider    was indexed under an unreachable key and effectively lost.  3. The PSL fallback in getDomainLookupTokens() returned only the first    (leftmost) hostname label. For sub.example.co.uk that produces "sub"    rather than "example", causing a miss for any sibling subdomain    (other.example.co.uk) whose request tokens do not contain "sub".  All three failures were silent: no error, no warning, rules simply did not apply to matching URLs.  ── Root cause ───────────────────────────────────────────────────────  Trying to infer a hostname from a regular expression is fundamentally unsound. Regular expression is not a hostname description language. Any heuristic that parses urlPattern source will have edge cases, and the failure mode (provider silently goes global or disappears from the index) is invisible.  ── Solution ─────────────────────────────────────────────────────────  Introduce indexPattern — a single domainPattern-syntax string that the rule author declares explicitly alongside urlPattern:    "youtube_pagead": {     "indexPattern": "||youtube.com^",     "urlPattern":   "^https?://(?:[a-z0-9-]+\\.)*?youtube\\.com\\/pagead",     "rules": [...]   }  indexPattern feeds providersByToken only. It is never consulted by matchURL(). urlPattern remains the sole match authority.  Providers that use urlPattern without indexPattern fall to globalProviders — same conservative behaviour as before, no regression. Providers that use only domainPatterns are unchanged; their patterns already fed getDomainLookupTokens() correctly.  ── Changes ──────────────────────────────────────────────────────────  Provider (clearurls.js) - Add indexPattern field (null by default) - Add setIndexPattern(pattern) — stores a domainPattern-syntax string   for index purposes only - Delete getLookupToken() entirely — the 60-line regular expression-parsing   heuristic is removed with no replacement - getDomainLookupTokens() — append indexPattern to the sources list   processed by the existing cleanDomainPattern / PSL pipeline; both   domainPatterns entries and indexPattern now go through the same   well-tested code path - getLookupTokens() — simplified from 10 lines to 4; calls only   getDomainLookupTokens(), no more getLookupToken() or array/string   branching - PSL fallback in getDomainLookupTokens() — returns all labels except   the last (probable bare TLD) instead of only the first, fixing   sibling-subdomain misses when PSL is not yet ready  createProviders() - Read indexPattern from provider data - Call providers[p].setIndexPattern(indexPattern) when urlPattern is   also present  matchDomainPattern() - Add regular expression literal support: patterns starting with / are parsed as   /body/flags and tested against the original-case URL directly,   giving the rule author full control over case sensitivity via flags - cleanDomainPattern() returns '' for /regular expression/ patterns — no hostname   token can be extracted from an arbitrary regular expression, so the provider   correctly stays in globalProviders for that pattern  ── Invariant preserved ──────────────────────────────────────────────  For every provider p and every URL u where matchURL(p, u) is true, at least one token in getLookupTokens(p) appears as a dot-split label in u's hostname. The index remains a correct pre-filter: it may produce false-positive candidates (filtered by matchURL), but never false negatives.  ── Migration ────────────────────────────────────────────────────────  Existing rules require no changes. indexPattern is opt-in. Any urlPattern provider that previously relied on the heuristic extractor and happened to be indexed correctly will now fall to globalProviders until an indexPattern is added — a safe, observable regression rather than the previous silent one (`2026-05-11`, hash: [`7143107`](https://github.com/Linkumori/Linkumori-Addon/commit/7143107))

### Changed
- Change linkumori to "ClearURLs(Linkumori)" in manifest.json (`2026-05-12`, hash: [`965c9de`](https://github.com/Linkumori/Linkumori-Addon/commit/965c9de))

## [v62.0] - 2026-05-11 ([compare](https://github.com/Linkumori/Linkumori-Addon/compare/linkumori-v60.0...linkumori-v62.0))
### Changed
- Update manifest.json (`2026-05-11`, hash: [`e6473b0`](https://github.com/Linkumori/Linkumori-Addon/commit/e6473b0))

## [v60.0] - 2026-05-10 ([compare](https://github.com/Linkumori/Linkumori-Addon/compare/linkumori-v59.0...linkumori-v60.0))
### Changed
- Update privacy-policy-cli.md (`2026-05-09`, hash: [`49134e8`](https://github.com/Linkumori/Linkumori-Addon/commit/49134e8))
- We taken some of patches from clearurls https://gitlab.com/ClearURLs/ClearUrls/-/blob/refactoring/clearurls.js?ref_type=heads and adapt from it to our codebase. We have made some modifications to the original code to fit our requirements and improve performance (`2026-05-09`, hash: [`3ff3614`](https://github.com/Linkumori/Linkumori-Addon/commit/3ff3614))

## [v59.0] - 2026-05-08 ([compare](https://github.com/Linkumori/Linkumori-Addon/compare/linkumori-v58.0...linkumori-v59.0))
### Added
- Introduce Firefox CNAME uncloaking controls (`2026-05-08`, hash: [`30a0ffc`](https://github.com/Linkumori/Linkumori-Addon/commit/30a0ffc))

## [v58.0] - 2026-05-08 ([compare](https://github.com/Linkumori/Linkumori-Addon/compare/linkumori-v57.0...linkumori-v58.0))
### Changed
- Update privacy-policy-cli.md (`2026-05-08`, hash: [`a8abad5`](https://github.com/Linkumori/Linkumori-Addon/commit/a8abad5))

## [v57.0] - 2026-05-08 ([compare](https://github.com/Linkumori/Linkumori-Addon/compare/linkumori-v56.0...linkumori-v57.0))
### Added
- Introduce Firefox DNS CNAME uncloaking and localized settings toggle (`2026-05-08`, hash: [`0032076`](https://github.com/Linkumori/Linkumori-Addon/commit/0032076))

### Changed
- Downloaded latest public suffix list from upstream (`2026-05-08`, hash: [`0032076`](https://github.com/Linkumori/Linkumori-Addon/commit/0032076))
- Reverse some change made earlier reapplied (`2026-05-07`, hash: [`ffac0e0`](https://github.com/Linkumori/Linkumori-Addon/commit/ffac0e0))
- Update audit.js (`2026-05-07`, hash: [`1252062`](https://github.com/Linkumori/Linkumori-Addon/commit/1252062))

### Fixed
- Resolve deprecated Components warning (`2026-05-07`, hash: [`e55a6ce`](https://github.com/Linkumori/Linkumori-Addon/commit/e55a6ce))

## [v56.0] - 2026-05-06
### Changed
- Downloaded latest public suffix list from upstream (`2026-05-06`, hash: [`48e5aad`](https://github.com/Linkumori/Linkumori-Addon/commit/48e5aad))
- Downloaded latest public suffix list from upstream (`2026-05-07`, hash: [`192873b`](https://github.com/Linkumori/Linkumori-Addon/commit/192873b))
- Downloaded latest rules for ClearURLs (`2026-05-06`, hash: [`48e5aad`](https://github.com/Linkumori/Linkumori-Addon/commit/48e5aad))
- Linkumori release (`2026-05-07`, hash: [`192873b`](https://github.com/Linkumori/Linkumori-Addon/commit/192873b))
- Update manifest.json (`2026-05-07`, hash: [`7987ad1`](https://github.com/Linkumori/Linkumori-Addon/commit/7987ad1))

## [1.XX.0] - 2022-XX-XX

### Compatibility note
- Require Firefox >= 55
- Require Chrome >= 37


## [1.27.3] - 2025-02-05

### Changed
- Google Search `window.rwt` detection

### Fixed
- Google Docs
    - [#134](https://github.com/ClearURLs/Addon/issues/134)
    - [#187](https://gitlab.com/ClearURLs/rules/-/issues/187)
    - [#387](https://github.com/ClearURLs/Addon/issues/387)
    - [#393](https://github.com/ClearURLs/Addon/issues/393)
    - [#978](https://gitlab.com/ClearURLs/ClearUrls/-/issues/978)
    - [#980](https://gitlab.com/ClearURLs/ClearUrls/-/issues/980)
    - [#1301](https://gitlab.com/ClearURLs/ClearUrls/-/issues/1301)
    - [#1302](https://gitlab.com/ClearURLs/ClearUrls/-/issues/1302)
    - [#1305](https://gitlab.com/ClearURLs/ClearUrls/-/issues/1305)

### Compatibility note
- Require Firefox >= 55
- Require Chrome >= 37

## [1.27.2] - 2025-01-27

### Fixed
Special thanks to [SunsetTechuila](https://github.com/SunsetTechuila) for providing [PR 415](https://github.com/ClearURLs/Addon/pull/415)
- https://bugzilla.mozilla.org/show_bug.cgi?id=1943562
- https://bugzilla.mozilla.org/show_bug.cgi?id=1942909
- https://bugzilla.mozilla.org/show_bug.cgi?id=1942705
- https://bugzilla.mozilla.org/show_bug.cgi?id=1943842
- https://bugzilla.mozilla.org/show_bug.cgi?id=1943807
- [#407](https://github.com/ClearURLs/Addon/issues/407)
- [#408](https://github.com/ClearURLs/Addon/issues/408)
- [#409](https://github.com/ClearURLs/Addon/issues/409)
- [#410](https://github.com/ClearURLs/Addon/issues/410)
- [#411](https://github.com/ClearURLs/Addon/issues/411)
- [#412](https://github.com/ClearURLs/Addon/issues/412)
- [#413](https://github.com/ClearURLs/Addon/issues/413)

## [1.27.1] - 2025-01-05

### Changed
- Updated dependencies

### Fixed
- [#276](https://github.com/ClearURLs/Addon/issues/276)
- [#196](https://github.com/ClearURLs/Addon/issues/196)
- [!108](https://gitlab.com/ClearURLs/ClearUrls/-/merge_requests/108)
- [Fixed undefined `s` error](https://github.com/ClearURLs/Addon/commit/897c7dc67beab5e1e5f6f4b70b781f5bd3897060)

### Removed
- ETag filtering for Firefox. Since Firefox 85, ETags can no longer be used for tracking users over multiple sites.

### Compatibility note
- Require Firefox >= 55
- Require Chrome >= 37

## [1.26.0] - 2022-11-18

### Compatibility note
- Require Firefox >= 55
- Require Chrome >= 37

### Changed
- The popup window is now responsive

## [1.25.0] - 2022-07-27

### Compatibility note
- Require Firefox >= 55
- Require Chrome >= 37

### Changed
- ETag filtering now generates random values and does no longer delete the header. As a result, filtering also works under Chrome-based browsers
- ETag filtering no longer increases the counter
- ETag filtering is now disabled by default
- Updated rules URL href
- Updated translations. Big update by [IHatePineapples](https://github.com/IHatePineapples)

### Fixed
- [524](https://gitlab.com/KevinRoebert/ClearUrls/-/issues/524)
- [67](https://github.com/ClearURLs/Addon/issues/67)
- [138](https://github.com/ClearURLs/Addon/issues/138)
- [1177](https://gitlab.com/KevinRoebert/ClearUrls/-/issues/1177)
- [234](https://github.com/ClearURLs/Addon/issues/234)
- [191](https://github.com/ClearURLs/Addon/issues/191)

## [1.24.1] - 2022-03-25

### Compatibility note
- Require Firefox >= 55
- Require Chrome >= 37

### Changed
- Replaced self-written URL parser through `URL` and `URLSearchParams` from the Web API

### Fixed
- Fixed [185](https://github.com/ClearURLs/Addon/issues/185)
- Fixed [186](https://github.com/ClearURLs/Addon/issues/186)

## [1.23.1] - 2022-03-23

### Compatibility note
- Require Firefox >= 55
- Require Chrome >= 37

### Removed
- Removed unnecessary `unsafe-eval` content security policy

## [1.23.0] - 2022-03-22

### Compatibility note
- Require Firefox >= 55
- Require Chrome >= 37

### Added
- Added Arabic translation by Essam and kugani
- Added Indonesian translation by Iputucaganesha
- Added `content_security_policy` to `manifest.json`
- Re-Added `applications` to `manifest.json`
- Added recursive cleaning
- Added dark mode support in [!101](https://gitlab.com/KevinRoebert/ClearUrls/-/merge_requests/101). Thanks to [@dannycolin](https://gitlab.com/dannycolin)

### Changed
- Updated `homepage_url` and `author` field in `manifest.json`
- Replaced deprecated `String.prototype.substr()` in [!175](https://github.com/ClearURLs/Addon/pull/175). Thanks to [@CommanderRoot](https://github.com/CommanderRoot)
