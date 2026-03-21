[<img src="https://blog.mozilla.org/addons/files/2020/04/get-the-addon-fx-apr-2020.svg" alt="for Firefox" height="60px">](https://addons.mozilla.org/en-US/firefox/addon/linkumori-clean-urls/)
# <sub><img src="https://raw.githubusercontent.com/Linkumori/Linkumori-Addon/main/img/linkumori_icons.svg" width="64px" height="64px"></sub> Linkumori — Clean URLs for Firefox



> ClearURLs hasn't shipped a user whitelist in **four years** of requests. We did.

[![Build and Sign Extension](https://github.com/Linkumori/Linkumori-Addon/actions/workflows/build-and-sign.yml/badge.svg?branch=main)](https://github.com/Linkumori/Linkumori-Addon/actions/workflows/build-and-sign.yml)

Linkumori automatically strips tracking parameters from URLs — silently, instantly, without breaking your browsing. It's built from the ground up for Firefox's Manifest V3 and ships the features that ClearURLs users have been asking for since 2020.

---

## Why Linkumori Instead of ClearURLs?

ClearURLs is a great project. It's also effectively unmaintained, last updated in February 2025, and missing features that users have been requesting for years. Linkumori fixes that.

| Feature | ClearURLs | Linkumori |
|---|---|---|
| Remove tracking parameters | ✅ | ✅ |
| Block hyperlink auditing (ping) | ✅ | ✅ |
| Block ETag tracking | ✅ | ✅ |
| Prevent Google/Yandex search rewrites | ✅ | ✅ |
| **Per-domain whitelist** | ❌ (4yr open issue) | ✅ |
| **Custom rules that override built-ins** | ❌ | ✅ |
| **Disable specific rules without replacing** | ❌ | ✅ |
| **Multiple remote rule sources** | ❌ | ✅ |
| **Overload mode (merge rule sets)** | ❌ | ✅ |
| Firefox MV3 native | ❌ | ✅ |
| Active development | ❌ | ✅ |

---

## What It Does

Every URL you visit gets cleaned before it loads. Tracking parameters — the stuff that follows you across the web — are stripped silently in the background.

**Before:**
```
https://www.amazon.com/dp/exampleProduct/ref=sxin_0_pb?__mk_de_DE=ÅMÅŽÕÑ&keywords=tea&pd_rd_i=exampleProduct&pd_rd_r=8d39e4cd-1e4f-43db-b6e7-72e969a84aa5&pd_rd_w=1pcKM&pd_rd_wg=hYrNl&pf_rd_p=50bbfd25-5ef7-41a2-68d6-74d854b30e30
```

**After:**
```
https://www.amazon.com/dp/exampleProduct
```

No redirect. No popup. No reload. It just works.

---

## Features

**Core features inherited from ClearURLs**
- Removes tracking parameters from URLs automatically in the background
- Blocks some common ad domains (optional)
- Includes a built-in tool to clean multiple URLs at once
- Supports redirection to the destination without tracking services as a middleman
- Adds a context-menu entry so links can be copied quickly and cleanly
- Blocks hyperlink auditing (also known as ping tracking)
- Prevents ETag tracking
- Prevents tracking injection through the History API
- Prevents Google from rewriting search results with tracking elements
- Prevents Yandex from rewriting search results with tracking elements


**The features ClearURLs doesn't have**

- **Whitelist** — exclude any domain from cleaning. One click. Done. No more disabling the whole extension because one site broke.
- **Custom rules with override support** — write your own rules that take precedence over built-in or remote rules
- **Rule disable/restore** — disable specific rules or entire built-in/remote rule sets without creating counter-rules, then restore them anytime
- **Multiple remote rule sources** — load and merge several remote rule sets simultaneously
- **Overload mode** — merges built-in and remote rules together before applying your custom rules on top



---

## Privacy

Linkumori collects nothing. No telemetry. No analytics. No usage data.

- All URL cleaning happens locally in the extension runtime
- Remote rules are **disabled by default** — you opt in
- **Remote rules are for advanced users who own and fully control their own infrastructure — both physical and virtual — end-to-end.** When enabled, your browser makes a network request to the configured endpoint, and whoever controls that server and the hardware beneath it can see your IP address, when you connected, and how often. If you do not administer your own server, do not enable this feature. If you do, point Linkumori at your own endpoint: you control what gets logged, no intermediate party has visibility, and you push updates on your own schedule. Local network addresses work too, keeping the ruleset entirely within your own network — the highest-trust configuration possible.

Full details in [privacy.md](privacy.md).

---

## Permissions

All required permissions are explained in [SECURITY.md](SECURITY.md). The short version: we request only what's needed to clean URLs and nothing more.

---

## Rules

Built-in rules ship with the extension and are updated with each release. Remote rules are fetched from:

```
https://raw.githubusercontent.com/Linkumori/Linkumori-Addon/main/data/linkumori-clearurls-min.json
```

You can also load your own rule sources or disable any rule you don't want.

---

## Install

**[→ Get it on Firefox Add-ons](https://addons.mozilla.org/en-US/firefox/addon/linkumori-clean-urls/)**

Or download a signed build from [Releases](https://github.com/Linkumori/Linkumori-Addon/releases/).

Official Linkumori releases started with **v1.0** on **February 27, 2026**. See [CHANGELOG.md](CHANGELOG.md) for the full version history.

---

## Contribute

Found a site that's breaking? Got a rule to add? [Open an issue](https://github.com/Linkumori/Linkumori-Addon/issues/new) — rule suggestions are especially welcome.

Want to translate Linkumori? Open the [`_locales/en/messages.json`](_locales/en/messages.json) file, translate the values into your language, and submit a pull request to `_locales/{language-code}/messages.json`.

See [CONTRIBUTING.md](CONTRIBUTING.md) for full contribution guidelines.

---

## Built on the shoulders of giants

Linkumori is forked from [ClearURLs](https://github.com/ClearURLs/Addon) and shares its core engine and rule format. We owe a real debt to that project and its contributors. Our goal is not to replace it but to carry it forward — MV3-native, actively maintained, and with the features its users have been asking for.

Third-party libraries and their licenses are listed in [THIRD-PARTY-NOTICE](THIRD-PARTY-NOTICE/).

---

## Star History

![Star History Chart](https://api.star-history.com/svg?repos=Linkumori/Linkumori-Addon&type=Date)

---

[Source](https://github.com/Linkumori/Linkumori-Addon) · [License](License.md) · [Privacy Policy](privacy.md) · [Security](SECURITY.md) · [Changelog](CHANGELOG.md)
