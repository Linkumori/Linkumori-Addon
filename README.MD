<div align="center">

<img src="https://raw.githubusercontent.com/Linkumori/Linkumori-Addon/main/img/linkumori_icons.svg" width="128" height="128" alt="Linkumori logo">

# Linkumori

### Your links, minus the trackers.

**Clean URLs for Firefox.** Built for Manifest V3, with the whitelist and custom rules ClearURLs users have wanted since 2020.

[![Firefox Add-on](https://img.shields.io/amo/v/linkumori-clean-urls?label=Firefox%20Add-on&logo=firefoxbrowser&logoColor=white&color=FF7139)](https://addons.mozilla.org/en-US/firefox/addon/linkumori-clean-urls/)
[![Users](https://img.shields.io/amo/users/linkumori-clean-urls?logo=firefoxbrowser&logoColor=white&color=2ea44f)](https://addons.mozilla.org/en-US/firefox/addon/linkumori-clean-urls/)
[![Build and Sign Extension](https://github.com/Linkumori/Linkumori-Addon/actions/workflows/build-and-sign.yml/badge.svg?branch=main)](https://github.com/Linkumori/Linkumori-Addon/actions/workflows/build-and-sign.yml)
[![License: LGPL v3+](https://img.shields.io/badge/license-LGPL--3.0--or--later-blue)](License.md)
![Manifest V3](https://img.shields.io/badge/manifest-V3-8A2BE2)
![Telemetry](https://img.shields.io/badge/telemetry-none-success)

[<img src="https://blog.mozilla.org/addons/files/2020/04/get-the-addon-fx-apr-2020.svg" alt="Get the add-on for Firefox" height="60">](https://addons.mozilla.org/en-US/firefox/addon/linkumori-clean-urls/)

[**Install**](#install) · [**Features**](#features) · [**vs ClearURLs**](#vs-clearurls) · [**Rules**](#rules) · [**Privacy**](#privacy) · [**Contribute**](#contribute)

</div>

---

## ✨ See the difference

Shopping links like this one carry a pile of tracking parameters:

```diff
- https://www.amazon.com/dp/exampleProduct/ref=sxin_0_pb?__mk_de_DE=ÅMÅŽÕÑ&keywords=tea&pd_rd_i=exampleProduct&pd_rd_r=8d39e4cd-1e4f-43db-b6e7-72e969a84aa5&pd_rd_w=1pcKM&pd_rd_wg=hYrNl&pf_rd_p=50bbfd25-5ef7-41a2-68d6-74d854b30e30
+ https://www.amazon.com/dp/exampleProduct
```

> 🧹 **No popup. No setup.** Linkumori cleans the URL in the background before the page loads.

---

<a id="features"></a>

## 🚀 Features

<table>
<tr>
<td width="50%" valign="top">

### 🛡️ Core protection
*Inherited from ClearURLs*

- 🔗 Removes tracking parameters automatically
- ↪️ Skips tracking middlemen and goes straight to the destination
- 🚫 Blocks some common ad domains (optional)
- 📡 Blocks hyperlink auditing (`ping` tracking)
- 🏷️ Prevents ETag tracking
- 🕰️ Cleans tracking injected through the History API
- 🔍 Stops Google and Yandex rewriting search results with trackers
- 📋 Context-menu entry to copy a clean link
- 🧰 Built-in tool to clean many URLs at once

</td>
<td width="50%" valign="top">

### ⚡ Only in Linkumori
*Features ClearURLs doesn't have*

- ✅ **Whitelist.** Exclude any domain in one click, instead of switching the whole extension off when a site breaks.
- ✍️ **Custom rules.** Write your own rules, and they take priority over built-in and remote rules.
- 🔕 **Disable and restore.** Switch off single rules or whole rule sets without writing counter-rules, and turn them back on any time.
- 🌐 **Multiple remote sources.** Load and merge several remote rule lists at once.
- 🧬 **Overload mode.** Merges built-in and remote rules, then applies your custom rules on top.
- 🩹 **Remote patches.** A remote file can replace rules by id with a `patches` list ([docs](docs/filter-syntax.md)).
- 🎯 **`$removeparam` filters** with `@@` exceptions.
- 🩺 **Per-tab troubleshooter** for working out why a site broke.

</td>
</tr>
</table>

---

<a id="vs-clearurls"></a>

## ⚔️ Linkumori vs ClearURLs

ClearURLs is a great project, and it's active again: **1.28.0** (November 2026) added declarative redirect rules and a large batch of encoding and History API fixes. It is still a **Manifest V2** extension, though, and it still has **no whitelist, no custom rules and only one remote rule URL**. Those gaps are why Linkumori exists.

<div align="center">

| | ClearURLs 1.28.0 | **Linkumori 100.98.0** |
|---|:---:|:---:|
| Remove tracking parameters | ✅ | ✅ |
| Redirect to the real destination | ✅ | ✅ |
| Block hyperlink auditing (`ping`) | ✅ | ✅ |
| Block ETag tracking | ✅ | ✅ |
| Prevent Google/Yandex search rewrites | ✅ | ✅ |
| Clean History API URL changes | ✅ | ✅ |
| **Per-domain whitelist** | ❌ *long-requested* | ✅ |
| **Custom rules that override built-ins** | ❌ | ✅ |
| **Disable rules without replacing them** | ❌ | ✅ |
| **Multiple remote rule sources** | ❌ *one URL* | ✅ |
| **Overload mode (merge rule sets)** | ❌ | ✅ |
| **Remote rule patches by id** | ❌ | ✅ |
| **`$removeparam` + `@@` exceptions** | ❌ | ✅ |
| **Per-tab troubleshooter** | ❌ | ✅ |
| Remote rule download | 🔛 On by default | 🔒 Off, opt-in |
| Manifest version | MV2 | **MV3** |
| Minimum Firefox | 98 | 140 (Android 142) |

</div>

### URL cleaning benchmarks

The benchmarks compare Linkumori 100.107.0 with the URL token index (`aca2b21`) and ClearURLs 1.28.0. Times are per input URL. Lower is faster.

#### Live Firefox 161.0

Both add-ons handled actual Firefox requests using their own catalogs: 1,868 providers for Linkumori and 206 for ClearURLs. A local HTTP proxy served the responses. Timings include synchronous extension callback work across redirects. Each add-on ran first once.

| Workload | Linkumori | ClearURLs | Result across both runs |
|---|---:|---:|---|
| Subresource without a query | **20.8 µs** | 58.2 µs | Linkumori faster in both |
| Generic tracking URL | 349.4 µs | **291.4 µs** | ClearURLs faster in both |
| Amazon product URL | 397.8 µs | 407.4 µs | Winner changed between runs |
| Google search URL | 396.2 µs | 391.6 µs | Winner changed between runs |

The table shows medians of ten batch averages, with 500 timed inputs per workload per add-on. All 2,240 paired final URLs matched, including warmups. Local request completion medians ranged from 0.60 to 0.88 ms for subresources and from 3.64 to 4.86 ms for navigations. [Firefox setup and both run orders](https://github.com/Linkumori/Linkumori-Addon/issues/216#issuecomment-7197731590)

#### Node.js harness

The Node.js runs compare each engine with its own catalog and with both engines using the same 206-provider ClearURLs JSON. These are median times from five batches of 4,000 inputs per workload. Referral marketing was disabled in both engines. [Shared catalog results](https://github.com/Linkumori/Linkumori-Addon/issues/216) · [Own catalog results](https://github.com/Linkumori/Linkumori-Addon/issues/216#issuecomment-7197127302)

| Workload | Linkumori, shared JSON | ClearURLs, shared JSON | Linkumori, own catalog | ClearURLs, own catalog |
|---|---:|---:|---:|---:|
| Subresource without a query | **8.52 µs** | 61.46 µs | **2.81 µs** | 61.95 µs |
| Generic tracking URL | **60.99 µs** | 102.13 µs | **61.83 µs** | 103.45 µs |
| Amazon product URL | **107.60 µs** | 154.08 µs | **137.30 µs** | 152.17 µs |
| Google search URL | **102.10 µs** | 161.66 µs | 165.30 µs | **157.51 µs** |

---

<a id="privacy"></a>

## 🔒 Privacy

<div align="center">

**No telemetry. No analytics. No usage data.**

</div>

- 🏠 All URL cleaning happens locally, inside the extension.
- 📴 Remote rules are **disabled by default**. You have to opt in.

> [!WARNING]
> **Remote rules are for advanced users who run their own infrastructure, physical and virtual, end to end.**
> With remote rules on, your browser sends requests to the endpoint you configure. Whoever controls that server, and the hardware under it, can see your IP address, when you connected and how often.
> If you don't run your own server, leave this feature off. If you do, point Linkumori at your own endpoint: you decide what gets logged, no third party sees the traffic, and you push updates when you choose. A local network address also works, which keeps the rule list entirely inside your own network.

📄 Full details: [privacy.md](privacy.md) · 🔑 Permissions explained: [SECURITY.md](SECURITY.md)

---

<a id="rules"></a>

## 📜 Rules

The built-in rules ship with each release and are regularly synced from the upstream ClearURLs rule list. Bundled, remote and custom rules all use **one JSON format**.

| Guide | What's inside |
|---|---|
| 📘 [Rules format, beginner to advanced](docs/linkumori-rules-format-guide.md) | A plain-language walkthrough |
| 📗 [Filter syntax reference](docs/filter-syntax.md) | `domainPatterns` (`\|\|example.com^`) and `urlPattern` matching; `rules`, `referralMarketing`, `rawRules`, `exceptions`, `redirections` and `fieldRedirections`; `$removeparam` / `$rawrule` filters; rule objects (`id`, `aliases`, `replacePattern`, `order`, `flags`, …); and `lint-rules` |
| 📙 [ClearURLs v2 vs Linkumori format](docs/clearurls-v2-vs-linkumori.md) | Moving rules between the two formats |

---

<a id="install"></a>

## 📦 Install

<div align="center">

### [🦊 Get it on Firefox Add-ons →](https://addons.mozilla.org/en-US/firefox/addon/linkumori-clean-urls/)

or download a signed build from [**Releases**](https://github.com/Linkumori/Linkumori-Addon/releases/)

</div>

---

<a id="contribute"></a>

## 🤝 Contribute

- 🐛 **Is a site broken? Have a rule to suggest?** [Open an issue](https://github.com/Linkumori/Linkumori-Addon/issues/new). Rule suggestions are especially welcome.
- 🌍 **Translate.** Translate the values in [`_locales/en/messages.json`](_locales/en/messages.json) and open a pull request that adds `_locales/{language-code}/messages.json`.
- 🛠️ **Hack on it.** Start with [CONTRIBUTING.md](CONTRIBUTING.md), [runtime-architecture.md](docs/runtime-architecture.md) and the [Maintainer Wiki](docs/wiki/README.md), which covers architecture, runtime flow, rule loading, performance decisions and a file-by-file module map.

---

## 🙏 Built on the shoulders of giants

Linkumori is forked from [**ClearURLs**](https://github.com/ClearURLs/Addon) and shares its core engine and rule format. We owe a real debt to that project and everyone who has contributed to it. Both projects are maintained. Linkumori isn't meant to replace ClearURLs: it's an MV3-native alternative with the features ClearURLs users have been asking for.

Third-party libraries and their licenses are listed in [THIRD-PARTY-NOTICE](THIRD-PARTY-NOTICE/).

---

<div align="center">

**[Source](https://github.com/Linkumori/Linkumori-Addon)** · **[License](License.md)** · **[Privacy Policy](privacy.md)** · **[Security](SECURITY.md)** · **[Changelog](CHANGELOG.md)**

<sub>Made with 🧹 for a cleaner web.</sub>

</div>
