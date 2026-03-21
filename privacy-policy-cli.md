# Linkumori CLI Privacy Policy

**Last Updated:** March 21, 2026

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
- **Online** downloads the latest ClearURLs rules from GitHub.

**Public Suffix List (PSL) source** — the CLI asks "Choose PSL mode":
- **Offline** uses the bundled local PSL file already present in the source package.
- **Online** downloads the latest PSL data from the network.

End users must choose **offline** for both prompts. Offline is the default and recommended choice, and ensures the CLI operates entirely without network requests.

Online mode exists solely for the first-party development workflow — for example, testing against the latest upstream rules before a release. No other users are required to use online mode.

Selecting online for either prompt fetches live data that may differ from the official release, producing a build that is functionally equivalent but not binary-identical.

## Network Requests and Third-Party Services

The CLI makes network requests only when you select online mode or use a signed-build workflow. In those cases, data handling is governed entirely by the relevant third-party services.

**GitHub** — contacted when you select online mode for the rules source ("Choose a merge mode → Online"). The CLI fetches the latest ClearURLs rules from a GitHub-hosted source. GitHub's terms and privacy policy apply to that connection:
- [GitHub Terms of Service](https://docs.github.com/en/site-policy/github-terms/github-terms-of-service)
- [GitHub Privacy Statement](https://docs.github.com/en/site-policy/privacy-policies/github-general-privacy-statement)

**Public Suffix List** — contacted when you select online mode for the PSL source ("Choose PSL mode → Online"). The CLI fetches the latest PSL data from `publicsuffix.org`. Their policy applies to that connection:
- [Public Suffix List](https://publicsuffix.org/)

**Mozilla** — contacted only when you run a signed-build workflow. The CLI submits your extension package and API credentials to Mozilla's signing service via `web-ext`. Mozilla's terms apply to that connection:
- [Mozilla Legal](https://www.mozilla.org/en-US/about/legal/)

Linkumori does not control, monitor, or store any data from these connections.

## Signing Builds

Signing is not controlled by Linkumori in any way. The CLI uses `web-ext` to perform signing, which communicates directly with Mozilla's signing service using API credentials that you supply.

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

## Disclaimer of Warranty

THIS CLI TOOL IS PROVIDED "AS IS" AND ANY EXPRESS OR IMPLIED WARRANTIES, INCLUDING, BUT NOT LIMITED TO, THE IMPLIED WARRANTIES OF MERCHANTABILITY AND FITNESS FOR A PARTICULAR PURPOSE ARE DISCLAIMED. IN NO EVENT SHALL THE DEVELOPER OR CONTRIBUTORS BE LIABLE FOR ANY DIRECT, INDIRECT, INCIDENTAL, SPECIAL, EXEMPLARY, OR CONSEQUENTIAL DAMAGES (INCLUDING, BUT NOT LIMITED TO, LOSS OF DATA, LOSS OF USE, OR BUSINESS INTERRUPTION) ARISING IN ANY WAY OUT OF THE USE OF THIS TOOL, EVEN IF ADVISED OF THE POSSIBILITY OF SUCH DAMAGE.

This disclaimer applies to the fullest extent permitted by applicable law.

## Translations

This Privacy Policy is written in English. In the event of any conflict between the English version and any translated version, the English version shall prevail, depending on local law.
