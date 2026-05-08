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
