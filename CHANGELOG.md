# Changelog
All notable changes to this project will be documented in this file.

The format is based on [Keep a Changelog](https://keepachangelog.com/en/1.0.0/),
and this project adheres to [Semantic Versioning](https://semver.org/spec/v2.0.0.html).

---

## [Unreleased]
### Changed
- No unreleased commit entries.

## [v41.0] - 2026-05-03 ([compare](https://github.com/Linkumori/Linkumori-Addon/compare/linkumori-v40.0...linkumori-v41.0))
### Changed
- Release v41.0 (hash: `172d264`).
- Updated files:
  - `manifest.json`

## [v40.0] - 2026-05-02 ([compare](https://github.com/Linkumori/Linkumori-Addon/compare/linkumori-v39.0...linkumori-v40.0))
### Fixed
- Chain all matching providers for cumulative parameter stripping (`2026-05-02`, hash: [`8eea825`](https://github.com/Linkumori/Linkumori-Addon/commit/8eea825))

## [v39.0] - 2026-05-02 ([compare](https://github.com/Linkumori/Linkumori-Addon/compare/linkumori-v38.0...linkumori-v39.0))
### Changed
- Add more correctes in speed and remove duplicate index tokens (`2026-05-01`, hash: [`9f394df`](https://github.com/Linkumori/Linkumori-Addon/commit/9f394df))
- Downloaded latest public suffix list from upstream (`2026-05-01`, hash: [`9f394df`](https://github.com/Linkumori/Linkumori-Addon/commit/9f394df))

### Performance
- **clearurls**: Index URL patterns with serialized token bitmaps (`2026-05-01`, hash: [`c98330d`](https://github.com/Linkumori/Linkumori-Addon/commit/c98330d))
- **clearurls**: Serialize domain pattern tokens for indexed matching (`2026-05-01`, hash: [`9aa1398`](https://github.com/Linkumori/Linkumori-Addon/commit/9aa1398))

### Removed
- Remove duplicated token logic instead index only used tokens (`2026-05-02`, hash: [`e2f83cf`](https://github.com/Linkumori/Linkumori-Addon/commit/e2f83cf))

## [v38.0] - 2026-05-01 ([compare](https://github.com/Linkumori/Linkumori-Addon/compare/linkumori-v37.0...linkumori-v38.0))
### Added
- Introduce LZ4 compression for rules bundle and Aho-Corasick URL pattern index (`2026-05-01`, hash: [`4c0255f`](https://github.com/Linkumori/Linkumori-Addon/commit/4c0255f))
- Introduce Linkumori interoperability custom rule support (`2026-05-01`, hash: [`cc2f55a`](https://github.com/Linkumori/Linkumori-Addon/commit/cc2f55a))

### Changed
- Downloaded latest public suffix list from upstream (`2026-05-01`, hash: [`4c0255f`](https://github.com/Linkumori/Linkumori-Addon/commit/4c0255f))
- Generated rules JSON minified (`2026-05-01`, hash: [`4c0255f`](https://github.com/Linkumori/Linkumori-Addon/commit/4c0255f))
- Support HTTP normalization in clearurls (`2026-05-01`, hash: [`060911e`](https://github.com/Linkumori/Linkumori-Addon/commit/060911e))

## [v37.0] - 2026-04-30 ([compare](https://github.com/Linkumori/Linkumori-Addon/compare/linkumori-v36.0...linkumori-v37.0))
### Added
- Introduce interoperability mode toggle (`2026-04-29`, hash: [`fcce060`](https://github.com/Linkumori/Linkumori-Addon/commit/fcce060))

## [v36.0] - 2026-04-29 ([compare](https://github.com/Linkumori/Linkumori-Addon/compare/linkumori-v35.0...linkumori-v36.0))
### Changed
- Downloaded latest public suffix list from upstream (`2026-04-29`, hash: [`1a582bf`](https://github.com/Linkumori/Linkumori-Addon/commit/1a582bf))

### Performance
- Optimizeize URL filtering and externalize CLI URLs (`2026-04-29`, hash: [`4791ceb`](https://github.com/Linkumori/Linkumori-Addon/commit/4791ceb))

### Documentation
- Docs updated legal documentation (`2026-04-29`, hash: [`1a582bf`](https://github.com/Linkumori/Linkumori-Addon/commit/1a582bf))

## [v35.0] - 2026-04-27 ([compare](https://github.com/Linkumori/Linkumori-Addon/compare/linkumori-v34.0...linkumori-v35.0))
### Changed
- Update Template.md (`2026-04-27`, hash: [`ecab753`](https://github.com/Linkumori/Linkumori-Addon/commit/ecab753))

## [v34.0] - 2026-04-27 ([compare](https://github.com/Linkumori/Linkumori-Addon/compare/linkumori-v33.0...linkumori-v34.0))
### Documentation
- Doc update docs inaccuracy (`2026-04-27`, hash: [`c639ca8`](https://github.com/Linkumori/Linkumori-Addon/commit/c639ca8))
- Doc update privacy policy and INTEROPERABILITY document (`2026-04-27`, hash: [`92aa1b9`](https://github.com/Linkumori/Linkumori-Addon/commit/92aa1b9))

## [v33.0] - 2026-04-27 ([compare](https://github.com/Linkumori/Linkumori-Addon/compare/linkumori-v32.0...linkumori-v33.0))
### Changed
- Add new file for performance (`2026-04-27`, hash: [`484fb7b`](https://github.com/Linkumori/Linkumori-Addon/commit/484fb7b))
- Generated rules JSON minified (`2026-04-27`, hash: [`484fb7b`](https://github.com/Linkumori/Linkumori-Addon/commit/484fb7b))

## [v32.0] - 2026-04-27 ([compare](https://github.com/Linkumori/Linkumori-Addon/compare/linkumori-v31.0...linkumori-v32.0))
### Changed
- Resolve date (`2026-04-26`, hash: [`5eb230d`](https://github.com/Linkumori/Linkumori-Addon/commit/5eb230d))
- Update author file (`2026-04-26`, hash: [`297301f`](https://github.com/Linkumori/Linkumori-Addon/commit/297301f))
- We meged two runtime into one webrequest listner (`2026-04-26`, hash: [`b683108`](https://github.com/Linkumori/Linkumori-Addon/commit/b683108))

### Fixed
- Resolve information (`2026-04-26`, hash: [`860cdd2`](https://github.com/Linkumori/Linkumori-Addon/commit/860cdd2))

### Documentation
- Document Linkumori interoperability rules (`2026-04-26`, hash: [`9aad0de`](https://github.com/Linkumori/Linkumori-Addon/commit/9aad0de))

## [v31.0] - 2026-04-26 ([compare](https://github.com/Linkumori/Linkumori-Addon/compare/linkumori-v30.0...linkumori-v31.0))
### Added
- Introduce MarkedJS legal notices and fix popup consent flash (`2026-04-26`, hash: [`d2f4cb1`](https://github.com/Linkumori/Linkumori-Addon/commit/d2f4cb1))

## [v30.0] - 2026-04-26 ([compare](https://github.com/Linkumori/Linkumori-Addon/compare/linkumori-v29.0...linkumori-v30.0))
### Fixed
- Resolve translation (`2026-04-26`, hash: [`2e637be`](https://github.com/Linkumori/Linkumori-Addon/commit/2e637be))

## [v29.0] - 2026-04-26 ([compare](https://github.com/Linkumori/Linkumori-Addon/compare/linkumori-v28.0...linkumori-v29.0))
### Added
- **url-filters**: Introduce Linkumori URL filter interoperability runtime (`2026-04-26`, hash: [`360ca4c`](https://github.com/Linkumori/Linkumori-Addon/commit/360ca4c))

### Changed
- Downloaded latest public suffix list from upstream (`2026-04-26`, hash: [`360ca4c`](https://github.com/Linkumori/Linkumori-Addon/commit/360ca4c))

## [v28.0] - 2026-04-24 ([compare](https://github.com/Linkumori/Linkumori-Addon/compare/linkumori-v27.0...linkumori-v28.0))
### Changed
- Downloaded latest public suffix list from upstream (`2026-04-24`, hash: [`4580839`](https://github.com/Linkumori/Linkumori-Addon/commit/4580839))

### Documentation
- Update Privacy Policy (April 24, 2026) (`2026-04-24`, hash: [`6891f79`](https://github.com/Linkumori/Linkumori-Addon/commit/6891f79))

## [v27.0] - 2026-04-19 ([compare](https://github.com/Linkumori/Linkumori-Addon/compare/linkumori-v26.0...linkumori-v27.0))
### Changed
- Update notices and fix web-ext lint warnings (`2026-04-19`, hash: [`27419e5`](https://github.com/Linkumori/Linkumori-Addon/commit/27419e5))

### Fixed
- Resolve manifest (`2026-04-19`, hash: [`515c53a`](https://github.com/Linkumori/Linkumori-Addon/commit/515c53a))

## [v26.0] - 2026-04-19 ([compare](https://github.com/Linkumori/Linkumori-Addon/compare/linkumori-v25.0...linkumori-v26.0))
### Changed
- Release v26.0 (hash: `7980364`).
- Updated files:
  - `manifest.json`

## [v25.0] - 2026-04-19 ([compare](https://github.com/Linkumori/Linkumori-Addon/compare/linkumori-v24.0...linkumori-v25.0))
### Changed
- Downloaded latest public suffix list from upstream (`2026-04-19`, hash: [`381248b`](https://github.com/Linkumori/Linkumori-Addon/commit/381248b))

## [v24.0] - 2026-04-12 ([compare](https://github.com/Linkumori/Linkumori-Addon/compare/linkumori-v23.0...linkumori-v24.0))
### Changed
- Normalize privacy policy placeholders in locales (`2026-04-12`, hash: [`93ad3f4`](https://github.com/Linkumori/Linkumori-Addon/commit/93ad3f4))

## [v23.0] - 2026-04-12 ([compare](https://github.com/Linkumori/Linkumori-Addon/compare/linkumori-v22.0...linkumori-v23.0))
### Changed
- Release v23.0 (hash: `a2f7674`).
- Updated files:
  - `manifest.json`

## [v22.0] - 2026-04-11 ([compare](https://github.com/Linkumori/Linkumori-Addon/compare/linkumori-v21.0...linkumori-v22.0))
### Changed
- Normalize English privacy policy label across locales (`2026-04-11`, hash: [`b5795d7`](https://github.com/Linkumori/Linkumori-Addon/commit/b5795d7))

## [v21.0] - 2026-04-11 ([compare](https://github.com/Linkumori/Linkumori-Addon/compare/linkumori-v20.0...linkumori-v21.0))
### Changed
- Add missing translations and updated existing ones for various locales list of added new translation am 	Amharic bg 	Bulgarian bn 	Bengali ca 	Catalan cs 	Czech da 	Danish el 	Greek en_GB 	English (UK) en_US 	English (US) es_419 	Spanish (Latin America) et 	Estonian fi 	Finnish fil 	Filipino gu 	Gujarati he 	Hebrew hi 	Hindi hr 	Croatian kn 	Kannada lt 	Lithuanian lv 	Latvian ml 	Malayalam mr 	Marathi nb 	Norwegian Bokmål or 	Oriya pt 	Portuguese (generic) ro 	Romanian sk 	Slovak sr 	Serbian sw 	Swahili ta 	Tamil te 	Telugu vi 	Vietnamese (`2026-04-11`, hash: [`a9b44a8`](https://github.com/Linkumori/Linkumori-Addon/commit/a9b44a8))
- Downloaded latest public suffix list from upstream (`2026-04-11`, hash: [`f1a8e5e`](https://github.com/Linkumori/Linkumori-Addon/commit/f1a8e5e))
- Update template.md also for clarification earlier commit didnot add portuguese generic (`2026-04-11`, hash: [`ef9ee5b`](https://github.com/Linkumori/Linkumori-Addon/commit/ef9ee5b))

## [v20.0] - 2026-04-10 ([compare](https://github.com/Linkumori/Linkumori-Addon/compare/linkumori-v19.0...linkumori-v20.0))
### Changed
- Add more clarification in privacy policy (`2026-04-11`, hash: [`a0ec6cd`](https://github.com/Linkumori/Linkumori-Addon/commit/a0ec6cd))
- Downloaded latest public suffix list from upstream (`2026-04-10`, hash: [`83462ea`](https://github.com/Linkumori/Linkumori-Addon/commit/83462ea))

## [v19.0] - 2026-04-06 ([compare](https://github.com/Linkumori/Linkumori-Addon/compare/linkumori-v18.0...linkumori-v19.0))
### Changed
- Release v19.0 (hash: `3573dbd`).
- Updated files:
  - `manifest.json`

## [v18.0] - 2026-04-06 ([compare](https://github.com/Linkumori/Linkumori-Addon/compare/linkumori-v17.0...linkumori-v18.0))
### Changed
- Release v18.0 (hash: `cd8f312`).
- Updated files:
  - `manifest.json`

## [v17.0] - 2026-04-05 ([compare](https://github.com/Linkumori/Linkumori-Addon/compare/linkumori-v16.0...linkumori-v17.0))
### Changed
- Release v17.0 (hash: `3ccf9ce`).
- Updated files:
  - `manifest.json`

## [v16.0] - 2026-04-04 ([compare](https://github.com/Linkumori/Linkumori-Addon/compare/linkumori-v15.0...linkumori-v16.0))
### Added
- **i18n**: Introduce  i18n files (`2026-04-04`, hash: [`8a1dadb`](https://github.com/Linkumori/Linkumori-Addon/commit/8a1dadb))
- **i18n**: Introduce locale license notices for multiple languages (`2026-04-04`, hash: [`7683c5b`](https://github.com/Linkumori/Linkumori-Addon/commit/7683c5b))

### Changed
- Folder rename pt-PT to pt_PT (`2026-04-04`, hash: [`0f75deb`](https://github.com/Linkumori/Linkumori-Addon/commit/0f75deb))
- Update template.md (`2026-04-04`, hash: [`ec37ba7`](https://github.com/Linkumori/Linkumori-Addon/commit/ec37ba7))

### Removed
- Remove extra directory (`2026-04-04`, hash: [`d105377`](https://github.com/Linkumori/Linkumori-Addon/commit/d105377))

## [v15.0] - 2026-04-02 ([compare](https://github.com/Linkumori/Linkumori-Addon/compare/linkumori-v14.0...linkumori-v15.0))
### Added
- Introduce Hungarian language (`2026-04-02`, hash: [`35ad3fa`](https://github.com/Linkumori/Linkumori-Addon/commit/35ad3fa))

### Changed
- Add French (`2026-04-02`, hash: [`e253572`](https://github.com/Linkumori/Linkumori-Addon/commit/e253572))
- Add Italian (`2026-04-02`, hash: [`dcade46`](https://github.com/Linkumori/Linkumori-Addon/commit/dcade46))
- Add es translation (`2026-04-02`, hash: [`4887eb0`](https://github.com/Linkumori/Linkumori-Addon/commit/4887eb0))
- Add indonesian and updated template.md (`2026-04-03`, hash: [`cd89036`](https://github.com/Linkumori/Linkumori-Addon/commit/cd89036))
- Add russian (`2026-04-02`, hash: [`797d270`](https://github.com/Linkumori/Linkumori-Addon/commit/797d270))

## [v14.0] - 2026-04-02 ([compare](https://github.com/Linkumori/Linkumori-Addon/compare/linkumori-v13.0...linkumori-v14.0))
### Added
- Introduce arabic language (`2026-04-02`, hash: [`5d01e04`](https://github.com/Linkumori/Linkumori-Addon/commit/5d01e04))

### Changed
- Downloaded latest public suffix list from upstream (`2026-04-02`, hash: [`143419f`](https://github.com/Linkumori/Linkumori-Addon/commit/143419f))

## [v13.0] - 2026-04-02 ([compare](https://github.com/Linkumori/Linkumori-Addon/compare/linkumori-v12.0...linkumori-v13.0))
### Changed
- Release v13.0 (hash: `c6a56e6`).
- Updated files:
  - `manifest.json`

## [v12.0] - 2026-04-01 ([compare](https://github.com/Linkumori/Linkumori-Addon/compare/linkumori-v11.0...linkumori-v12.0))
### Added
- Introduce legal page optional feature toggles and translations (`2026-04-01`, hash: [`c0e79a7`](https://github.com/Linkumori/Linkumori-Addon/commit/c0e79a7))

## [v11.0] - 2026-04-01 ([compare](https://github.com/Linkumori/Linkumori-Addon/compare/linkumori-v10.0...linkumori-v11.0))
### Changed
- Correction of date in readme (`2026-03-31`, hash: [`e7cc17e`](https://github.com/Linkumori/Linkumori-Addon/commit/e7cc17e))
- Update consent configuration (`2026-04-01`, hash: [`ba0e593`](https://github.com/Linkumori/Linkumori-Addon/commit/ba0e593))
- Update privacy policy (`2026-04-01`, hash: [`51057c4`](https://github.com/Linkumori/Linkumori-Addon/commit/51057c4))

## [v10.0] - 2026-03-31 ([compare](https://github.com/Linkumori/Linkumori-Addon/compare/linkumori-v9.0...linkumori-v10.0))
### Changed
- Update amo-upload.js (`2026-03-31`, hash: [`9ede4a1`](https://github.com/Linkumori/Linkumori-Addon/commit/9ede4a1))

## [v9.0] - 2026-03-31 ([compare](https://github.com/Linkumori/Linkumori-Addon/compare/linkumori-v8.0...linkumori-v9.0))
### Changed
- Update amo-upload.js (`2026-03-31`, hash: [`c2ab8d6`](https://github.com/Linkumori/Linkumori-Addon/commit/c2ab8d6))

## [v8.0] - 2026-03-31 ([compare](https://github.com/Linkumori/Linkumori-Addon/compare/linkumori-v7.0...linkumori-v8.0))
### Changed
- Create amo-upload.js (`2026-03-31`, hash: [`0f262cd`](https://github.com/Linkumori/Linkumori-Addon/commit/0f262cd))
- Update amo-upload.js (`2026-03-31`, hash: [`aad3c8f`](https://github.com/Linkumori/Linkumori-Addon/commit/aad3c8f))
- Update build-and-sign.yml (`2026-03-31`, hash: [`02cbdbe`](https://github.com/Linkumori/Linkumori-Addon/commit/02cbdbe))

## [v7.0] - 2026-03-31 ([compare](https://github.com/Linkumori/Linkumori-Addon/compare/linkumori-v6.0...linkumori-v7.0))
### Changed
- Update license documentation generator code (`2026-03-31`, hash: [`817de44`](https://github.com/Linkumori/Linkumori-Addon/commit/817de44))

## [v6.0] - 2026-03-31 ([compare](https://github.com/Linkumori/Linkumori-Addon/compare/linkumori-v5.0...linkumori-v6.0))
### Changed
- Update APACHE-2.0.txt (`2026-03-31`, hash: [`20365c3`](https://github.com/Linkumori/Linkumori-Addon/commit/20365c3))

## [v5.0] - 2026-03-30 ([compare](https://github.com/Linkumori/Linkumori-Addon/compare/linkumori-v4.0...linkumori-v5.0))
### Changed
- Update update-changelog-from-commits.js (`2026-03-31`, hash: [`c48843b`](https://github.com/Linkumori/Linkumori-Addon/commit/c48843b))

## [v4.0] - 2026-03-29 ([compare](https://github.com/Linkumori/Linkumori-Addon/compare/linkumori-v3.0...linkumori-v4.0))
### Changed
- Updated `data/public_suffix_list.dat` with latest public suffix data (`2026-03-29`, hash: [`8de65c4`](https://github.com/Linkumori/Linkumori-Addon/commit/8de65c4))

## [v3.0] - 2026-03-27 ([compare](https://github.com/Linkumori/Linkumori-Addon/compare/linkumori-v2.0...linkumori-v3.0))
### Changed
- Version bump (`2026-03-27`, hash: [`ed7456d`](https://github.com/Linkumori/Linkumori-Addon/commit/ed7456d))

## [v2.0] - 2026-03-26 ([compare](https://github.com/Linkumori/Linkumori-Addon/compare/linkumori-v1.0...linkumori-v2.0))
### Added
- Add `Permissions.md` so users can read what permissions the extension uses (`2026-03-23`, hash: [`c5d7f14`](https://github.com/Linkumori/Linkumori-Addon/commit/c5d7f14))
- Add clarification to third-party notices (`2026-03-24`, hash: [`fc94edc`](https://github.com/Linkumori/Linkumori-Addon/commit/fc94edc))

### Changed
- Updated ClearURLs rules data (`downloaded-official-rules.json`, `linkumori-clearurls-min.json`) (`2026-03-26`, hash: [`8c3ed13`](https://github.com/Linkumori/Linkumori-Addon/commit/8c3ed13))

## [v1.0] - 2026-03-23
### Added
- First soft release — initial project files, core JS, HTML pages, icons, locales, licenses, and third-party notices (`2026-03-23`, hash: [`348cc86`](https://github.com/Linkumori/Linkumori-Addon/commit/348cc86))

---

<!-- Legacy changelog entries below are preserved from the original ClearURLs project -->

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
