## Important Notice

Some third-party code in this software has been modified by the first party. In accordance with license compliance requirements, these changes are disclosed. Please review the source files, as some modified files include individual modification notices.

### Viewing Modification History

To view modification history that is not included within individual source files due to space constraints, download the source code and run one of the following commands:

**With Node.js installed:**
```bash
node linkumori-cli-tool.js 
```

**Or with Bun installed:**
```bash
bun start
```

Preferably, use a Unix-based system (such as macOS or Linux) to run this script, as it is designed and tested primarily for Unix-like environments.

Then follow these steps:

1. Select **Setup Project**
2. Select **Generate Commit History**

Commit history generation requires a real Git clone (with `.git` history).  
Without `git clone`, you cannot generate commit history.

Clone command:
```bash
git clone https://github.com/Linkumori/Linkumori-Addon.git
```

For every official release, the source package downloadable from GitHub Releases (`source code.zip`) includes `COMMIT_HISTORY.md`.
For all other source distributions, you must generate `COMMIT_HISTORY.md` manually.

If the source code you received already contains `COMMIT_HISTORY.md`, you do not need to generate commit history manually.

**Requirements:**
- Node.js: Download from [nodejs.org](https://nodejs.org/en)
- Or Bun: [bun.com/docs/installation](https://bun.com/docs/installation)

### Important Notes

- Older modifications may not appear in the generated `COMMIT_HISTORY.md`
- If a file's inline modification notice is limited, check for a file-specific separate notice and `COMMIT_HISTORY.md`; if neither exists for that file, treat the inline notice as the final modification record.
- If a file-specific separate notice is provided, check the file's inline notice and `COMMIT_HISTORY.md`; if neither exists for that file, treat the separate notice as the final modification record.
- Review individual modified source files for earlier notices
- Some files may not contain notices within the file itself or may not be listed in `COMMIT_HISTORY.md`; a separate notice file may be provided instead
- Not all source code files have been modified, but review notices in all source files and any separate notice files (`.md` or `.txt`)
- `git clone` is required before running **Generate Commit History**; otherwise commit history generation will not work

# Build Instructions

> **Reproducible Builds — Two Offline Prompts:**
> During a build the CLI presents two separate online/offline choices. Select **offline**
> for both if your goal is a binary-exact build from source:
>
> 1. **Rules source** ("Choose a merge mode") — select **offline** to use the bundled
>    `downloaded-official-rules.json` shipped with this source package instead of
>    downloading the latest ClearURLs rules from GitHub.
>
> 2. **PSL source** ("Choose PSL mode") — select **offline** to use the bundled local
>    Public Suffix List (PSL) file instead of fetching the latest PSL data from the network.
>
> Selecting **online** for either prompt fetches live data that may differ from what was
> used in the official release, producing a build that is functionally equivalent but not
> binary-identical.
>
> This applies to both the unsigned and signed build paths.

## Requirements

### Node.js or Bun (required)
Install [Node.js (current version)](https://nodejs.org/en/download/current) or [Bun](https://bun.com/docs/installation).

### web-ext (required)
`web-ext` is a Node-based application used to build and sign the extension.

Install with Homebrew:
```bash
brew install web-ext
```

Install with npm:
```bash
npm install --global web-ext
```

Install with Bun:
```bash
bun add --global web-ext
```

### FontForge (optional — required for font build step)
FontForge is used in **Step 3/6** to compile the Old Country Nobility font from source
(`.sfd` → `.ttf`). Without it, Step 3/6 is skipped and the build continues using the
pre-built font file already present in the repository.

Install on macOS:
```bash
brew install fontforge
```

Install on Ubuntu/Debian:
```bash
sudo apt-get install fontforge python3-fontforge
```

Install on Fedora:
```bash
sudo dnf install fontforge python3
```

### librsvg (required for SVG icon conversion step)
`rsvg-convert` from `librsvg` is required to generate PNG icons from
`img/linkumori_icons.svg` and `img/linkumori_icon_disabled.svg` during **Step 4/6**.

Install on macOS:
```bash
brew install librsvg
```

Install on Ubuntu/Debian:
```bash
sudo apt-get install librsvg2-bin
```

Install on Fedora:
```bash
sudo dnf install librsvg2-tools
```

Preferably, use a Unix-based system (such as macOS or Linux) to run this script.

## Build Unsigned Version

### 1. Launch the CLI

If Node.js is installed:
```bash
node linkumori-cli-tool.js
```

If Bun is installed:
```bash
bun start
```

### 2. Select option `1` — Build Extension (Full Build)

The CLI runs the following steps automatically:

- **Step 0/6 — PSL prompt:** "Choose PSL mode"
  - Select **`2) Offline`** to use the bundled local PSL file (binary-exact build).
  - Select `1) Online` to download the latest PSL from the network (not binary-exact).
  - *(Prompt only appears if a local PSL file already exists. If none exists, online is used automatically.)*

- **Step 1/6:** Generates copyright documentation.

- **Step 2/6 — Rules prompt:** "Choose a merge mode"
  - Select **`2) Offline`** to use the bundled `downloaded-official-rules.json` (binary-exact build).
  - Select `1) Online` to download the latest ClearURLs rules from GitHub (not binary-exact).
  - *(Prompt only appears if a local rules file already exists. If none exists, online is used automatically.)*

- **Step 3/6:** Builds the Old Country Nobility font (`Old-Country-Nobility.sfd` → `.ttf`) using FontForge.
  *(Requires FontForge — see Requirements. If not installed, this step is skipped and the build continues.)*

- **Step 4/6:** Generates extension icons:
  - `img/linkumori_icons.svg` → `img/icon16.png`, `img/icon19.png`, `img/icon20.png`, `img/icon24.png`, `img/icon30.png`, `img/icon32.png`, `img/icon38.png`, `img/icon48.png`, `img/icon64.png`, `img/icon96.png`, `img/icon128.png`
  - `img/linkumori_icon_disabled.svg` → `img/icon128_gray.png`

- **Step 5/6:** Validates the project structure.

- **Step 6/6:** Packages the extension with `web-ext build`. The output `.zip` is automatically renamed to `.xpi`.

### 3. Output

Built extension is in `web-ext-artifacts/*.xpi`.

---

Alternatively, run non-interactively with offline mode forced:
```bash
node linkumori-cli-tool.js build offline
```

## Build Signed Version

### 1. Get Mozilla API Keys
- Log in to [addons.mozilla.org](https://addons.mozilla.org)
- Go to: **Tools → Manage API Keys**
- Generate your JWT issuer (`WEB_EXT_API_KEY`) and secret (`WEB_EXT_API_SECRET`)

### 2. Setup Project and Configure Credentials

Launch the CLI:
```bash
node linkumori-cli-tool.js
# or
bun start
```

Select **`s) Setup Project`**. This creates `.env.template` and immediately offers to convert it to `.env` — type `y` when prompted.

Open `.env` and fill in your credentials:
```
WEB_EXT_API_KEY=user:12345:67
WEB_EXT_API_SECRET=your-long-api-secret-string-here
WEB_EXT_CHANNEL=unlisted
```

Channel options:
- `unlisted` — signs the extension and downloads a `.xpi` for self-distribution.
- `listed` — submits to the AMO store for review. The CLI exits immediately after submission; approval happens on the AMO dashboard.

### 3. Select option `2` — Build & Sign Extension

The CLI first runs the full build (all 6 steps from the unsigned build above, including the PSL and rules prompts), then signs the result:

- **PSL prompt:** Select **`2) Offline`** for a binary-exact build.
- **Rules prompt:** Select **`2) Offline`** for a binary-exact build.
- After the build completes, the CLI runs `web-ext sign` using the credentials from `.env`.
  - For `unlisted`: signed `.xpi` is saved to `web-ext-artifacts/`.
  - For `listed`: submitted to AMO; the CLI exits and returns control to you.

---

Alternatively, run non-interactively with offline mode forced:
```bash
node linkumori-cli-tool.js build-and-sign offline
```

## Load the Built Extension in Firefox

### Temporary Load
1. Open: `about:debugging#/runtime/this-firefox`
2. Click: **Load Temporary Add-on...**
3. Select: `/<project-folder>/web-ext-artifacts/output.zip` or `output.xpi`

### Install Signed Extension
1. Open: `about:addons`
2. Drag and drop the `.xpi` file into the page
