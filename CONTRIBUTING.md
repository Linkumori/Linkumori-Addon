# Contributing to Linkumori (Clean URLs)

Thank you for your interest in contributing to Linkumori! This document outlines the guidelines and process for contributing to the project. By participating, you are expected to uphold our [Code of Conduct](CODE_OF_CONDUCT.md).

---

## Table of Contents

1. [Getting Started](#1-getting-started)
2. [Ways to Contribute](#2-ways-to-contribute)
3. [Development Setup](#3-development-setup)
4. [Project Structure](#4-project-structure)
5. [Making Changes](#5-making-changes)
6. [Code Standards](#6-code-standards)
7. [Adding or Updating URL Rules](#7-adding-or-updating-url-rules)
8. [Submitting a Pull Request](#8-submitting-a-pull-request)
9. [Reporting Bugs](#9-reporting-bugs)
10. [Suggesting Features](#10-suggesting-features)
11. [License](#11-license)

---

## 1. Getting Started

Before contributing, please:

- Read this document in full
- Review our [Code of Conduct](CODE_OF_CONDUCT.md)
- Review our [Security Policy](SECURITY.md) — security vulnerabilities must **not** be reported as regular issues
- Familiarise yourself with the [project repository](https://github.com/Linkumori/Linkumori-Addon-MV3-Firefox)

---

## 2. Ways to Contribute

There are many ways to contribute beyond writing code:

- **Bug reports** — found something broken? Open an issue
- **Feature suggestions** — have an idea? Open a discussion or issue
- **URL cleaning rules** — suggest new tracking parameters or providers to add to the ruleset
- **Translations** — help localise the extension for other languages via `_locales/`
- **Documentation** — improve README, wiki, or inline code comments
- **Code** — fix bugs, implement features, or improve performance

---

## 3. Development Setup

### Requirements

Install one of the following runtimes before building:

- [Node.js (current version)](https://nodejs.org/en/download/current)
- [Bun](https://bun.com/docs/installation)

A Unix-based system (macOS or Linux) is recommended. Windows is supported but the build scripts are primarily tested on Unix-like environments.

### Clone the Repository

```bash
git clone https://github.com/Linkumori/Linkumori-Addon.git
cd Linkumori-Addon-MV3-Firefox
```

### Build the Extension (Unsigned)

If Node.js is installed:
```bash
node linkumori-cli-tool.js
```

If Bun is installed:
```bash
bun start
```

Then select: **Build Extension (Full Build)**

Output will be in `web-ext-artifacts/`.

### Load the Extension in Firefox (Temporary)

1. Open `about:debugging#/runtime/this-firefox`
2. Click **Load Temporary Add-on...**
3. Select `web-ext-artifacts/output.zip` or `output.xpi`

### Build a Signed Version

1. Log in to [addons.mozilla.org](https://addons.mozilla.org) and go to **Tools → Manage API Keys** to generate credentials
2. Run the CLI tool and select **Setup Project** — this creates `.env.template`
3. Paste your API keys into `.env.template` and convert it to `.env` when prompted
4. Run the CLI tool again and select **Build & Sign Extension**

---

## 4. Project Structure

```
Linkumori-Addon-MV3-Firefox/
├── core_js/               # Core extension logic (URL cleaning, storage, UI handlers)
├── external_js/           # Third-party libraries (modified and unmodified)
├── html/                  # Extension UI pages (popup, settings, log, etc.)
├── css/                   # Stylesheets
├── img/                   # Extension icons
├── svg/                   # SVG icon sources (including material_icon/)
├── data/                  # Rule data files (custom and official)
├── _locales/en/           # Internationalisation strings
├── Old-Country-Nobility/  # Custom font files
├── manifest.json          # Firefox MV3 extension manifest
├── clearurls.js           # Main entry point
└── linkumori-cli-tool.js  # Build and utility CLI
```

Key files to be aware of:

| File | Purpose |
|------|---------|
| `manifest.json` | Extension configuration, permissions, and entry points |
| `core_js/cleaning_tool.js` | Core URL cleaning logic |
| `core_js/settings.js` | User settings management |
| `core_js/storage.js` | Storage abstraction layer |
| `core_js/tools.js` | Shared utility functions |
| `data/linkumori-clearurls.json` | Canonical bundled ClearURLs source rules |
| `_locales/en/messages.json` | English UI strings |

---

## 5. Making Changes

### Branching

- Always branch off from `main`
- Use descriptive branch names:
  - `fix/issue-description` for bug fixes
  - `feat/feature-description` for new features
  - `docs/what-you-changed` for documentation
  - `rules/provider-name` for new URL cleaning rules

### Commit Messages

Write clear, concise commit messages:

```
fix: correct etag filter false positive on redirect
feat: add support for Yandex tracking parameters
docs: update contributing guidelines
rules: add Amazon affiliate parameter stripping
```

### Generating Commit History

To view full modification history for third-party files, run the CLI tool and select **Generate Commit History**. This produces a `COMMIT_HISTORY.md` with a per-file log of changes.

---

## 6. Code Standards

### General

- Write clean, readable JavaScript — prioritise clarity over cleverness
- Avoid introducing new external dependencies unless absolutely necessary; all third-party code must be reviewed and attributed in `LICENSE.md`
- Do not use inline scripts — the extension enforces `script-src 'self'` via CSP
- Do not make network requests from extension code unless strictly required and clearly documented

### Security & Privacy

- All URL processing must happen **locally** — no data should leave the browser
- Do not add permissions to `manifest.json` without discussion and clear justification
- Be mindful of `host_permissions` scope — the extension already requests broad access and any changes must be carefully considered
- Content scripts should be scoped as narrowly as possible

### Internationalisation (i18n)

- All user-facing strings must use the `linkumori-i18n.js` system and be defined in `_locales/en/messages.json`
- Do not hardcode English strings directly in HTML or JS files

### Third-Party Code

- Any new third-party code must be documented in `LICENSE.md` with copyright holder, license, and any modifications made
- Modified third-party code must include an inline notice referencing the original source
- Licenses must be compatible with LGPL v3.0

---

## 7. Adding or Updating URL Rules

URL cleaning rules tell Linkumori which tracking parameters to strip, which domains to apply them to, and how to handle redirects. Bundled rules live in `data/linkumori-clearurls.json`.

---

### Rule File Structure

Every provider has the same two parts: `match` (where it applies) and `rules` (what it does). Each rule is one filter string. The full reference is [docs/rule-syntax.md](docs/rule-syntax.md).

```json
{
  "providers": {
    "example-shop": {
      "match": ["||example.com^", "||example.*^"],
      "rules": [
        "$removeparam=/^utm_[a-z]+$/i",
        "$removeparam=fbclid",
        "$removeparam=tag,referral",
        "@@||payments.example.com^",
        "/^https?:\\/\\/(?:[a-z0-9-]+\\.)?example\\.com\\/out\\?url=([^&]*)/i$redirect",
        "/;jsessionid=[^?#]*/i$strip"
      ]
    }
  }
}
```

Provider names are arbitrary but should be lowercase and descriptive.

### Provider Fields

| Field | Required | Description |
|---|---|---|
| `match` | Yes | Patterns for the URLs this provider handles: `\|\|example.com^` (site and subdomains), `\|\|example.*^` (any TLD), `\|\|example.com^/path`, or `/regex/i` |
| `rules` | No | Filters, see below |
| `methods` | No | Only handle these HTTP methods, e.g. `["GET"]` |
| `resourceTypes` | No | Only handle these request types, e.g. `["main_frame"]` |
| `active` | No | `false` disables the provider |
| `historyBypassProtection` | No | `false` skips the provider for History API URL changes |

### Filters

| Filter | Effect |
|---|---|
| `$removeparam=name` | Remove a parameter |
| `$removeparam=/^utm_/i` | Remove parameters matching a regex |
| `$removeparam=tag,referral` | Referral/affiliate parameter, kept when the user allows referral marketing |
| `@@\|\|example.com^/login` | Exception: leave matching URLs alone |
| `@@\|\|example.com^$removeparam=id` | Keep one parameter on matching URLs/pages |
| `/regex(capture)/i$redirect` | Unwrap a redirect URL (first capture group) |
| `/regex/i$strip` | Delete matching text from the URL |
| `$block` | Block every request the provider matches |

`$removeparam` also takes `domain=`, `to=`, `denyallow=`, `method=`, party (`1p`/`3p`), request-type and `match-case` modifiers. See [docs/rule-syntax.md](docs/rule-syntax.md) for all of them and for rule objects (`id`, `description`, `active`, `replace`).

### Checking Your Changes

```bash
node linkumori-cli-tool.js lint-rules   # validate data/linkumori-clearurls.json
node linkumori-cli-tool.js clearurls    # rebuild the LZ4 bundle
```

Rules in the older multi-section format (`urlPattern`, `referralMarketing`, `rawRules`, `exceptions`, `redirections`, …) can be converted with `node scripts/convert-rule-syntax.js <file.json>`.

---

### Branch Naming for Rule Changes

Use the `rules/` prefix when branching for rule-only contributions:

```bash
git checkout -b rules/amazon-affiliate-params
git checkout -b rules/new-provider-example-com
```

---

### What Not to Add

- Do not add rules that would break legitimate website functionality
- Do not add `$block` without strong justification and discussion
- Do not use overly broad `match` patterns that could match unintended sites

---

## 8. Submitting a Pull Request

1. Ensure your branch is up to date with `main`
2. Build the extension and test it in Firefox (minimum version 140.0) before submitting
3. Verify no new permissions have been added without justification
4. Open a pull request against `main` with:
   - A clear title describing the change
   - A description of what was changed and why
   - Reference to any related issue numbers (e.g. `Closes #42`)
5. Be responsive to review feedback — maintainers may request changes before merging

Pull requests will be reviewed for:

- Correctness and functionality
- Security and privacy implications
- Code quality and adherence to project standards
- Proper attribution if third-party code is involved

---

## 9. Reporting Bugs

Before opening a bug report, please:

- Check that the issue has not already been reported
- Verify you are running the latest version of the extension
- Try reproducing the issue in a clean Firefox profile

When opening an issue, include:

- Firefox version
- Extension version (visible in `about:addons`)
- Steps to reproduce the issue
- Expected vs actual behaviour
- Any relevant URLs (you may anonymise sensitive parts)
- Browser console errors if applicable (`about:debugging` → Inspect)

> For security vulnerabilities, do **not** open a public issue. Follow the [Security Policy](SECURITY.md) instead.

---

## 10. Suggesting Features

Feature suggestions are welcome. When opening a feature request, please include:

- A clear description of the problem the feature would solve
- A proposed solution or approach if you have one
- Any privacy or permission implications
- Whether you are willing to implement it yourself

---

## 11. License

By contributing to Linkumori, you agree that your contributions will be licensed under the **GNU Lesser General Public License v3.0 or later (LGPL-3.0)**, consistent with the project's existing license. See `LICENSE.md` for full license details.

---

*Thank you for helping make Linkumori better for everyone.*
