# Changelog
All notable changes to this project will be documented in this file.

The format is based on [Keep a Changelog](https://keepachangelog.com/en/1.0.0/),
and this project adheres to [Semantic Versioning](https://semver.org/spec/v2.0.0.html).

---

## [Unreleased]

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
