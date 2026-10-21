# Linkumori website

The static site for [Linkumori](https://github.com/Linkumori/Linkumori-Addon): the extension's features and the CLN Format 1.0 standard.

This branch has no history in common with `main`. It holds only the site.

| File | What it is |
| --- | --- |
| `index.html` | Home page: features, comparison, CLN overview, privacy, install |
| `cln-1.0.html` | CLN Format 1.0 (final), generated from `docs/cln-format-1.0.md`, with a run-order calculator |
| `filter-syntax.html` | Filter syntax reference, generated from `docs/filter-syntax.md` |
| `assets/` | Styles, scripts and the logo |
| `partials/run-order-tool.html` | The calculator markup, placed into `cln-1.0.html` by the build |
| `scripts/build-docs.mjs` | Regenerates the two doc pages |

## Updating the doc pages

The two doc pages are generated. Edit the Markdown on `main`, then rebuild here:

```bash
node scripts/build-docs.mjs
```

It reads `docs/*.md` from the local `main` branch with `git show`. To read from a folder instead, pass its path, for example `node scripts/build-docs.mjs ../Linkumori-Addon/docs`.

## Previewing

Any static file server works:

```bash
python3 -m http.server 8000
```

## Publishing

In the repository settings, under Pages, deploy from this branch's root. The `.nojekyll` file makes GitHub Pages serve the files as they are.

The site loads nothing from third parties: no fonts, analytics or CDNs.

## License

LGPL-3.0-or-later, the same as Linkumori. The logo comes from `img/linkumori_icons.svg` on `main`.
