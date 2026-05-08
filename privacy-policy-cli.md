# Linkumori CLI — Privacy Policy

**Last Updated:** May 9, 2026

Linkumori is a free, non-commercial, open-source tool.
"CLI tool" in this document refers to `linkumori-cli-tool.js`.

---

## Why This Tool Exists

The CLI exists mainly to support open-source licence compliance. Linkumori bundles and modifies third-party code under LGPL-3.0, which requires that source code, modification history, and build instructions be made available. The CLI provides a reproducible build process to meet these requirements — generating copyright notices, commit history, and a verifiable build.

It also handles practical tasks: merging URL-cleaning rule sets, managing the Public Suffix List, compiling font assets, packaging, and optionally signing the extension.

> *This is informational only, not legal advice. Consult a legal professional for licence compliance questions.*

---

## Data Collection

**None.** The CLI does not collect, transmit, store, or share any personal data. Everything happens locally on your device. Nothing is sent to any external server by the CLI itself.

---

## Build Modes

When you run a build, the CLI asks two questions:

**1. Rules source** ("Choose a merge mode"):
- **Offline** — uses the bundled `downloaded-official-rules.json` already in the package. *(Default. Recommended.)*
- **Online** — downloads the latest ClearURLs rules from the URL in `data/url-config.json`.

**2. Public Suffix List (PSL) source** ("Choose PSL mode"):
- **Offline** — uses the bundled local PSL file already in the package. *(Default. Recommended.)*
- **Online** — downloads the latest PSL from the URL in `data/url-config.json`.

**Most users should choose Offline for both.** This keeps the CLI fully local with zero network activity.

Online mode is intended only for developers who control or have independently verified the configured endpoints. If you choose **Online**, the build is functionally equivalent but not binary-identical to an offline build. That choice is your responsibility.

---

## URL Configuration (`data/url-config.json`)

This file lists the network locations used by the CLI in online mode. It exists for transparency and configurability — so you can see and change the URLs before running online mode.

Before using online mode, you must:
1. Open `data/url-config.json`
2. Review every URL listed
3. Edit or replace any URL you do not control or trust
4. Only then run online mode

You should only use online mode if you control or independently trust **both** layers of the configured endpoints:
- **Physical layer** — the hardware, hosting, network, and operations behind the endpoint
- **Virtual layer** — the software, services, access controls, logs, and data served by it

The distributed `url-config.json` is a transparency record and a developer convenience — not an instruction or recommendation to use online mode. Whoever modifies, packages, or distributes a version of this software is responsible for ensuring the configured URLs are appropriate, disclosed to recipients, and legally compliant. Linkumori does not control any alternative endpoints chosen by third parties.

---

## Network Requests & Third-Party Services

`data/url-config.json` was added for our own purposes. Before using this tool, you should either delete or edit `data/url-config.json` to reflect your own needs — the distributed file is our configuration, not a recommendation. Network requests are made only when you select online mode or use a signed-build workflow.

**Rules source (online mode only)**
This endpoint is contacted when you select **Online** under the merge mode prompt. The default points to a GitHub-hosted ClearURLs rules source. If you modify `url-config.json`, the CLI contacts your configured URL instead.
- [GitHub Terms of Service](https://docs.github.com/en/site-policy/github-terms/github-terms-of-service)
- [GitHub Privacy Statement](https://docs.github.com/en/site-policy/privacy-policies/github-general-privacy-statement)

**Public Suffix List source (online mode only)**
- [Public Suffix List](https://publicsuffix.org/)

**Mozilla / web-ext (signed builds only)**
This endpoint is contacted only when running a signed-build workflow. The CLI invokes `web-ext` (an external dependency you must install manually), which submits your extension package and API credentials to Mozilla's signing service.
- [Mozilla Legal](https://www.mozilla.org/en-US/about/legal/)

Linkumori does not control, monitor, or store any data from these connections.

---

## Signing Builds

Signing is entirely outside Linkumori's control. Linkumori is not affiliated with Mozilla.

The CLI uses `web-ext` for signing. You must:
- Install and configure `web-ext` yourself
- Keep it updated
- Visit the [Mozilla Developer Hub](https://addons.mozilla.org/developers/) → **Tools → Manage API Keys** to generate your own `WEB_EXT_API_KEY` and `WEB_EXT_API_SECRET`

These credentials belong to your Mozilla developer account. Linkumori never receives, stores, or accesses them. Any data sent during signing is handled solely by `web-ext` and Mozilla. Review Mozilla's terms and conditions before proceeding.

For unsigned local builds, choose Offline for both prompts — no network connection is made at all.

---

## Your Control

You control your privacy exposure entirely:
- Choose **Offline** or **Online** at each build prompt
- Choose **signed** or **unsigned** builds

All consequences of those choices are yours.

---

## Scope of This Policy

This policy applies only to the **official, unmodified** Linkumori CLI as released by the developer. Modified, repackaged, forked, or redistributed versions are outside its scope.

---

## Policy Updates

This policy may be updated from time to time. The "Last Updated" date at the top will reflect any changes.

---

## Related Documents

For full build instructions, reproducibility notes, and offline/online mode details, see `NOTICE.md`.

---

## Applicability & Licences

This policy applies to the fullest extent permitted by law and must remain compatible with the software licence. If any conflict exists between this policy and the software licence, the licence prevails.

All first-party and third-party licences applicable to this CLI or its components remain in full effect and are not superseded or waived by this policy.

---

## Disclaimer of Warranty

THIS CLI TOOL IS PROVIDED "AS IS." ALL EXPRESS OR IMPLIED WARRANTIES — INCLUDING MERCHANTABILITY AND FITNESS FOR A PARTICULAR PURPOSE — ARE DISCLAIMED. THE DEVELOPER AND CONTRIBUTORS ARE NOT LIABLE FOR ANY DIRECT, INDIRECT, INCIDENTAL, SPECIAL, EXEMPLARY, OR CONSEQUENTIAL DAMAGES (INCLUDING LOSS OF DATA, LOSS OF USE, OR BUSINESS INTERRUPTION) ARISING FROM USE OF THIS TOOL, EVEN IF WARNED OF THE POSSIBILITY.

This disclaimer applies to the fullest extent permitted by law.

---

## Translations

This policy is written in English. If any translation conflicts with the English version, English prevails, subject to local law.
