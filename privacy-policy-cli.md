# Linkumori CLI Privacy Policy

**Last Updated:** May 07, 2026

Linkumori is a free, non-commercial, open-source tool.

In this document, "CLI tool" refers to `linkumori-cli-tool.js`.

## Why the CLI Exists

*This section is provided for informational purposes only and does not constitute legal advice. If you have questions about licence compliance obligations, consult a qualified legal professional.*

The CLI tool exists primarily to support open-source licence compliance obligations.

Linkumori bundles and modifies third-party code licensed under the GNU Lesser General Public License v3.0 (LGPL-3.0). As we understand it, LGPL-3.0 requires that corresponding source code, modification history, and build instructions be made available to anyone who receives the software. The CLI provides a reproducible, documented build process intended to support these requirements — including generating copyright documentation, commit history, and producing a build that can be independently verified from source.

Beyond compliance, the CLI also handles practical development tasks: merging URL-cleaning rule sets, managing the Public Suffix List, compiling font assets, packaging the extension, and optionally signing it for distribution. These functions exist to support the release workflow, not to collect or process any user data.

## Data Collection

Nothing.

The CLI does not collect, transmit, store, or share any personal data. All operations read and write project files locally on your device. No information is sent to any external server by the CLI itself.

## Build Modes

During a build, the CLI presents two prompts where you choose between offline and online input:

**Rules source** — the CLI asks "Choose a merge mode":
- **Offline** uses the bundled `downloaded-official-rules.json` already present in the source package.
- **Online** downloads the latest ClearURLs rules from the URL configured in `data/url-config.json`.

**Public Suffix List (PSL) source** — the CLI asks "Choose PSL mode":
- **Offline** uses the bundled local PSL file already present in the source package.
- **Online** downloads the latest PSL data from the URL configured in `data/url-config.json`.

Recipients and end users should choose **offline** for both prompts. Offline is the default and recommended choice, and ensures the CLI operates entirely without network requests.

Online mode exists solely for maintainers, developers, packagers, distributors, or advanced recipients who control the relevant endpoint infrastructure or have independently verified and accepted the configured endpoints. Recipients and end users should not run online mode unless they understand and accept the network connections it will make. Before running online mode, you must review `data/url-config.json` and edit or replace it with your own chosen configuration.

Selecting online for either prompt fetches live data that may differ from the official release, producing a build that is functionally equivalent but not binary-identical. If you choose online mode, that choice is your responsibility.

## URL Configuration Transparency

The source package includes `data/url-config.json`, which lists the network locations used by the CLI when online mode is selected. This file exists for transparency and configurability. It makes the upstream rule and Public Suffix List URLs visible outside the CLI source code.

The JSON configuration is generally intended for maintainers, developers, packagers, and distributors who build or redistribute the software. A recipient of the software may also inspect or modify this file before running the CLI. If you change the URLs, the CLI will use the URLs you configured, and any network requests will be made to those configured locations.

Online mode should be used only by a person or organization that controls the physical and virtual layers of the configured endpoint infrastructure, or that has made an independent decision to trust and contact those endpoints. "Physical layer" includes the hardware, hosting, network, and operational control behind the endpoint. "Virtual layer" includes the software, services, operating systems, access controls, logs, and data served by that endpoint. If you do not control or independently trust those layers, you should not use online mode.

Before running online mode, you must make the configuration your own: inspect `data/url-config.json`, decide which endpoints you are willing and legally permitted to contact, and edit or replace the file if necessary. The distributed configuration is a transparency record and a maintainer/developer convenience, not a substitute for your own review or consent.

Providing `data/url-config.json` is not an endorsement, recommendation, warranty, or instruction that recipients should use online mode or contact the listed services. The file is provided so recipients can see what endpoints a maintainer or developer build would contact if online mode is selected.

Whoever modifies, packages, or distributes a version of the software is responsible for ensuring that the configured URLs are appropriate for that distributed version, accurately disclosed to recipients, and compliant with applicable laws and upstream terms. Linkumori provides the JSON configuration for transparency and does not control any alternative endpoints chosen by third parties or by recipients. If you choose to run online mode, you are responsible for that decision and for the consequences of contacting the configured URLs.

Because the CLI is a tool and the URLs are configurable, the configured services are operated by their respective third-party providers. The default configuration may refer to services such as GitHub and the Public Suffix List website, but Linkumori does not operate those services and does not guarantee their availability, behavior, privacy practices, terms, content, security, correctness, or continued operation.

## Network Requests and Third-Party Services

The CLI makes network requests only when you select online mode or use a signed-build workflow. In those cases, data handling is governed entirely by the relevant third-party services.

**Configured rules source** — contacted when you select online mode for the rules source ("Choose a merge mode → Online"). By default, the official source package points this URL to a GitHub-hosted ClearURLs rules source. If `data/url-config.json` is changed, the CLI contacts the configured URL instead. The terms and privacy policy of the configured host apply to that connection. For the default GitHub-hosted source:
- [GitHub Terms of Service](https://docs.github.com/en/site-policy/github-terms/github-terms-of-service)
- [GitHub Privacy Statement](https://docs.github.com/en/site-policy/privacy-policies/github-general-privacy-statement)

**Configured Public Suffix List source** — contacted when you select online mode for the PSL source ("Choose PSL mode → Online"). By default, the official source package points this URL to `publicsuffix.org`. If `data/url-config.json` is changed, the CLI contacts the configured URL instead. The terms and privacy policy of the configured host apply to that connection. For the default PSL source:
- [Public Suffix List](https://publicsuffix.org/)

**Mozilla / web-ext signing** — contacted only when you run a signed-build workflow. Linkumori is not affiliated with, endorsed by, sponsored by, or operated by Mozilla. The CLI invokes `web-ext`, which is an external development dependency that you must install and configure manually. If you choose to run signing, `web-ext` submits your extension package and API credentials to Mozilla's signing service. Mozilla's terms apply to that connection:
- [Mozilla Legal](https://www.mozilla.org/en-US/about/legal/)

Linkumori does not control, monitor, or store any data from these connections.

## Signing Builds

Signing is not controlled by Linkumori in any way. Linkumori is not affiliated with Mozilla. The CLI uses `web-ext` to perform signing, and `web-ext` communicates directly with Mozilla's signing service using API credentials that you supply.

`web-ext` is not provided as a managed Linkumori service. You must install it manually, keep it updated, configure it yourself, and decide whether to run it. If `web-ext` or Mozilla's signing service changes behavior, availability, requirements, policies, or terms, those matters are outside Linkumori's control.

To sign an extension, you must first visit the [Mozilla Developer Hub](https://addons.mozilla.org/developers/) — go to **Tools → Manage API Keys** — to generate your own API key (`WEB_EXT_API_KEY`) and API secret (`WEB_EXT_API_SECRET`). This is a manual step you perform in your browser before running the CLI; the CLI itself does not open or connect to this page. These credentials belong to your Mozilla developer account and are your responsibility to manage and protect. Linkumori does not receive, store, or have access to your credentials at any point.

Any data transmitted during signing is handled solely by `web-ext` and Mozilla. Please review Mozilla's own terms and privacy policy before proceeding.

For unsigned local builds, you can remain fully offline by selecting offline for both prompts.

## Your Control

You control the privacy exposure of your workflow by choosing offline or online mode at each build prompt, and by choosing whether to run a signed or unsigned build. Because these decisions are entirely yours, responsibility for lawful use rests with you.

## Scope of This Policy

This Privacy Policy applies exclusively to the **official, unmodified** version of the Linkumori CLI tool as released by the developer. Any version that has been modified, repackaged, forked, or redistributed by a third party is outside the scope of this policy.

## Changes to This Policy

We may update this Privacy Policy from time to time. Any updates will be reflected by revising the "Last Updated" date above.

## Related Documents

For full build instructions, reproducibility notes, and offline/online mode details, read `NOTICE.md`.

## Applicability

This Privacy Policy applies to the fullest extent permitted by applicable law, provided that it remains compatible with the software license governing this CLI tool. In the event of any conflict or inconsistency between this Privacy Policy and the software license, the terms of the software license shall prevail to the extent of such conflict.

For the avoidance of doubt, all first-party and third-party licenses applicable to this CLI tool or any of its components continue to apply in full and are not superseded, waived, or modified by this Privacy Policy. The Recipient of this CLI tool remains bound by all such licenses independently of, and in addition to, the terms set forth herein.

## Disclaimer of Warranty

THIS CLI TOOL IS PROVIDED "AS IS" AND ANY EXPRESS OR IMPLIED WARRANTIES, INCLUDING, BUT NOT LIMITED TO, THE IMPLIED WARRANTIES OF MERCHANTABILITY AND FITNESS FOR A PARTICULAR PURPOSE ARE DISCLAIMED. IN NO EVENT SHALL THE DEVELOPER OR CONTRIBUTORS BE LIABLE FOR ANY DIRECT, INDIRECT, INCIDENTAL, SPECIAL, EXEMPLARY, OR CONSEQUENTIAL DAMAGES (INCLUDING, BUT NOT LIMITED TO, LOSS OF DATA, LOSS OF USE, OR BUSINESS INTERRUPTION) ARISING IN ANY WAY OUT OF THE USE OF THIS TOOL, EVEN IF ADVISED OF THE POSSIBILITY OF SUCH DAMAGE.

This disclaimer applies to the fullest extent permitted by applicable law.

## Translations

This Privacy Policy is written in English. In the event of any conflict between the English version and any translated version, the English version shall prevail, depending on local law.
