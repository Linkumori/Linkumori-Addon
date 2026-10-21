# Linkumori website

The static site for [Linkumori](https://github.com/Linkumori/Linkumori-Addon): the extension's features and the CLN Format 1.0 standard.

This branch has no history in common with `main`. It holds only the site.

| File | What it is |
| --- | --- |
| `index.html` | Home page: features, comparison, CLN overview, privacy, install |
| `cln-1.0.html` | CLN Format 1.0 (final), generated from `docs/cln-format-1.0.md`, with a run-order calculator |
| `filter-syntax.html` | Filter syntax reference, generated from `docs/filter-syntax.md` |
| `privacy.html`, `terms.html` | The site's Privacy Policy and Terms of Use, generated from `legal/privacy.md` and `legal/terms.md` |
| `assets/` | Styles, scripts and the logo |
| `assets/fonts/` | Charis SIL, self-hosted, with its license (`OFL.txt`) |
| `assets/og-image.png`, `assets/icon-32.png`, `assets/apple-touch-icon.png` | Share card and PNG icons, rendered by `scripts/make-images.py` |
| `404.html` | Shown by GitHub Pages for any missing path |
| `sitemap.xml` | Every page, written by `scripts/build-docs.mjs` |
| `partials/run-order-tool.html` | The calculator markup, placed into `cln-1.0.html` by the build |
| `scripts/build-docs.mjs` | Regenerates the two doc pages |

## Updating the doc pages

The doc and legal pages are generated. Edit the spec Markdown on `main`, or `legal/*.md` here (keep the `**Last updated:**` line current), then rebuild:

```bash
node scripts/build-docs.mjs
```

It reads `docs/*.md` from the local `main` branch with `git show`. To read from a folder instead, pass its path, for example `node scripts/build-docs.mjs ../Linkumori-Addon/docs`.

## Regenerating the images

`scripts/make-images.py` draws the share card with the site's own font and renders the icons from `assets/logo.svg`. It needs Pillow, fontTools with brotli, and `rsvg-convert`:

```bash
python3 scripts/make-images.py
```

## Previewing

Any static file server works:

```bash
python3 -m http.server 8000
```

## Publishing

In the repository settings, under Pages, deploy from this branch's root. The `.nojekyll` file makes GitHub Pages serve the files as they are.

The site loads nothing from third parties: no analytics or CDNs, and its typeface is served from `assets/fonts/`.

## License

LGPL-3.0-or-later, the same as Linkumori. The logo comes from `img/linkumori_icons.svg` on `main`.

The Charis SIL font files in `assets/fonts/` are Copyright (c) 1997-2022 SIL International and licensed separately under the SIL Open Font License 1.1; see `assets/fonts/OFL.txt` and `assets/fonts/README.md`.
