# Security Policy

## Supported Versions

Only the latest release of Linkumori receives security fixes.

| Version | Supported |
|---------|-----------|
| 1.0.x   | Yes       |
| < 1.0   | No        |

---

## Reporting a Vulnerability

**Do not report security vulnerabilities through public GitHub issues.**

To report a vulnerability, please use GitHub's private vulnerability reporting feature:

1. Go to the [Security tab](https://github.com/Linkumori/Linkumori-Addon/security) of this repository
2. Click **Report a vulnerability**
3. Fill in the details and submit

Alternatively, you may contact the maintainer directly through GitHub: [@subham8907](https://github.com/subham8907)

### What to Include

Please provide as much of the following as possible:

- A description of the vulnerability and its potential impact
- Steps to reproduce the issue
- Affected version(s)
- Firefox version
- Any proof-of-concept code or URL examples (anonymised if needed)
- Suggested fix or mitigation, if known

### Response Timeline

- **Acknowledgement:** within 7 days of receiving your report
- **Initial assessment:** within 14 days
- **Fix or mitigation:** timeline communicated after initial assessment, depending on severity

---

## Scope

The following are considered in scope for security reports:

- **URL processing logic** — incorrect cleaning, data leakage through URLs, or bypass of tracking parameter stripping
- **Custom rules execution** — vulnerabilities introduced by maliciously crafted custom rules (`data/custom-rules.json`)
- **Redirect unwrapping** — open redirect issues or navigation to unintended destinations
- **Storage handling** — unauthorised access to or leakage of extension storage data
- **Content Security Policy bypass** — any way to execute inline scripts or load external scripts despite the extension's CSP (`script-src 'self'`)
- **Permission abuse** — functionality that allows websites to abuse the extension's broad `host_permissions` or `webRequest` access
- **ETag filter bypass** — tracking via ETag headers circumventing the filter
- **History listener bypass** — `history.pushState` tracking not being intercepted

The following are **out of scope**:

- Vulnerabilities in upstream ClearURLs rules (`data/downloaded-official-rules.json`) — report those to the [ClearURLs project](https://github.com/ClearURLs/Addon)
- Vulnerabilities in unmodified third-party libraries bundled in `external_js/` — report those to their respective upstream projects
- Issues requiring physical access to the user's device
- Social engineering attacks against users
- Firefox browser vulnerabilities — report those to [Mozilla](https://www.mozilla.org/en-US/security/bug-bounty/)

---

## Security Design

Linkumori is designed with the following security and privacy principles:

- **All URL processing is local.** No URL data, browsing history, or user settings are transmitted to any external server.
- **No remote code execution.** The extension enforces `script-src 'self'` via Content Security Policy. No inline scripts or external scripts are loaded.
- **No external network requests from extension logic.** The extension does not make outbound requests except for optional rule/hash updates from the ClearURLs upstream (user-controlled).
- **Minimal storage footprint.** Only extension settings and user-defined rules are persisted locally via `browser.storage`.
- **Content scripts are narrowly scoped.** The Google and Yandex link fix content scripts are restricted to specific URL patterns and run only at `document_end`.
- **No data collection.** The extension collects no telemetry, analytics, or user data of any kind.

---

## Disclosure Policy

Linkumori follows a coordinated disclosure model:

1. The reporter submits a private vulnerability report
2. The maintainer acknowledges receipt and assesses severity
3. A fix is developed and tested privately
4. A patched release is published
5. A security advisory is posted on the [GitHub Security Advisories](https://github.com/Linkumori/Linkumori-Addon/security/advisories) page
6. Credit is given to the reporter (unless they request anonymity)

Public disclosure before a fix is available may put users at risk. Please allow reasonable time for a patch before disclosing publicly.

---

## Attribution

Security researchers who responsibly disclose valid vulnerabilities will be credited in the release notes and security advisory, unless anonymity is requested.
