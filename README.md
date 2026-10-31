# Linkumori website

The static site for [Linkumori](https://github.com/Linkumori/Linkumori-Addon): the extension's features and the CLN Format 1.0 standard.

This branch is based on `main` and includes the extension source alongside the static site.

| File | What it is |
| --- | --- |
| `index.html` | Home page: features, comparison, CLN overview, privacy, install |
| `cln-1.0.html` | CLN Format 1.0 (final), generated from `docs/cln-format-1.0.md`, with a run-order calculator |
| `filter-syntax.html` | Filter syntax reference, generated from `docs/filter-syntax.md` |
| `rules.html` | How rules work: sources, merging, remote rule patches, custom rules, toggles, defaults and capabilities, built from `partials/rules.html`, with the source explorer and case picker in `assets/rules.js`. Every case card (input JSON, what runs, resulting JSON) comes from `scripts/rules-cases.mjs` |
| `converter.html` | AdGuard / uBlock Origin `$removeparam` lists to one CLN 1.0 rule file, built from `partials/converter.html`. The conversion is in `assets/converter-core.js` (no DOM; also loads in Node with `require`), the page in `assets/converter.js` |
| `privacy.html`, `terms.html` | The site's Privacy Policy and Terms of Use, generated from `legal/privacy.md` and `legal/terms.md` |
| `assets/` | Styles, scripts and the logo |
| `assets/og-image.png`, `assets/icon-32.png`, `assets/apple-touch-icon.png` | Share card and PNG icons, rendered by `scripts/make-images.py` |
| `assets/popup-light.webp`, `assets/popup-dark.webp` | Screenshots of the real extension popup, taken by `scripts/capture-popup.sh` |
| `404.html` | Shown by GitHub Pages for any missing path |
| `sitemap.xml` | Every page, written by `scripts/build-docs.mjs` |
| `partials/run-order-tool.html` | The calculator markup, placed into `cln-1.0.html` by the build |
| `scripts/build-docs.mjs` | Regenerates the generated specification, reference, architecture, rules, converter and legal pages plus the sitemap |

## Updating the doc pages

The specification, reference, runtime, rules, converter and legal pages are generated. Edit the spec Markdown on `main` (or the local `docs/` copy), `partials/rules.html`, `scripts/rules-cases.mjs`, `partials/converter.html`, or `legal/*.md` here (keep the legal `**Last updated:**` line current), then rebuild:

```bash
node scripts/build-docs.mjs
```

By default it reads `docs/*.md` from the local `main` branch with `git show`; pass `docs` to build from this branch's local copies. It also stamps every link to a file in `assets/` with `?v=` and a hash of that file, in the generated pages and in `index.html` and `404.html`, so browsers never pair a new page with an old cached script or stylesheet. Run it after changing anything in `assets/`, including after `scripts/make-images.py` or `scripts/capture-popup.sh`. To read from another folder, pass its path, for example `node scripts/build-docs.mjs ../Linkumori-Addon/docs`.

## Regenerating the images

`scripts/make-images.py` draws the share card and renders the icons from `assets/logo.svg`. It needs Pillow, `rsvg-convert`, and the Helvetica Neue and Menlo fonts that come with macOS:

```bash
python3 scripts/make-images.py
```

## Updating the popup screenshots

The home page shows the real extension popup (`html/popup.html` on `main`). After the popup changes, retake both themes:

```bash
scripts/capture-popup.sh
```

It loads the popup from `main` with `scripts/popup-shot/shot-stub.js` standing in for the extension APIs, so the counters and the current site are sample values. It needs Microsoft Edge or Google Chrome, ImageMagick and Python 3.

## Previewing

Any static file server works:

```bash
python3 -m http.server 8000
```

## Publishing

In the repository settings, under Pages, deploy from this branch's root. The `.nojekyll` file makes GitHub Pages serve the files as they are.

The site loads nothing from third parties: no analytics, CDNs or hosted fonts. Text is set in Inter and code in JetBrains Mono, both served from `assets/fonts` under the SIL Open Font License (see `assets/fonts/README.md`).

## License

LGPL-3.0-or-later, the same as Linkumori, except the fonts in `assets/fonts`, which are under the SIL Open Font License 1.1 (see `assets/fonts/README.md`). The documentation pages and their diagrams follow the license of the docs they are built from. The site's [Terms of Use](legal/terms.md) list each one. The logo comes from `img/linkumori_icons.svg` on `main`.
