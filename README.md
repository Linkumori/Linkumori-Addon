# Linkumori website

This branch contains the source and published files for the [Linkumori website](https://linkumori.github.io/Linkumori-Addon/). The browser extension lives on the repository's `main` branch.

## Site files

| Path | Purpose |
| --- | --- |
| `index.html`, `404.html`, and the other root HTML files | Published pages and browser tools |
| `docs/` | Markdown source for the CLN specification, filter reference, and architecture page |
| `legal/` | Source for the website Privacy Policy and Terms of Use |
| `partials/` | Page sections inserted by the site builder |
| `assets/` | Site styles, scripts, images, fonts, and bundled YAML parser |
| `data/linkumori-clearurls.json` | Example rule file loaded by the rules editor |
| `yaml-src/` | Source package and ISC license for `assets/yaml.js` |
| `scripts/` | Website page, image, and diagram build sources |
| `site-config.json` | Extension version displayed in generated pages |

## Build the pages

Node.js 18 or later is enough to regenerate the pages and sitemap from the local `docs/`, `legal/`, and `partials/` sources:

```bash
node scripts/build-docs.mjs
```

Update `site-config.json` when the extension release version shown on the site changes. The build fingerprints local assets so browsers do not pair a new page with an old cached script or stylesheet.

## Other site assets

The diagrams in `assets/diagrams/` can be regenerated from `docs/runtime-architecture.md` with `@mermaid-js/mermaid-cli` installed:

```bash
MMDC=/path/to/mmdc node scripts/make-diagrams.mjs
```

The share card and PNG icons can be regenerated from `assets/logo.svg` with Pillow, `rsvg-convert`, and the macOS Helvetica Neue and Menlo fonts:

```bash
python3 scripts/make-images.py
```

The popup screenshots are stored in `assets/popup-light.webp` and `assets/popup-dark.webp`.

## Preview and publish

Preview the static site with any file server:

```bash
python3 -m http.server 8000
```

GitHub Pages serves this branch from its root. `.nojekyll` makes Pages serve the files as they are.

## Licensing

Website code and text are LGPL-3.0-or-later unless a file or the [license summary](LICENSE.md) says otherwise. Font files are under the SIL Open Font License 1.1, and the bundled `yaml` parser and serializer are under the ISC License. The Terms of Use list the site's separately licensed parts.
