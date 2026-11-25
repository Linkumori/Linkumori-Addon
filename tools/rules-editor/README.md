# Rules editor

A browser editor for Linkumori CLN 1.0 rule files, in JSON or YAML. It's for developers working on
`data/linkumori-clearurls.yaml` or on custom rule files. The same editor is on the website as
[rules-editor.html](https://linkumori.github.io/Linkumori-Addon/rules-editor.html).

It does not need the website, a build step or a network connection.

## Open it

Serve the repository so the editor can load the files in `data/`:

```bash
python3 -m http.server 8000
```

Then open <http://localhost:8000/tools/rules-editor/>.

You can also open `tools/rules-editor/index.html` directly as a `file://` page. Browsers block
`fetch` there, so use **Open file…** to pick a rule file instead of the **Load** buttons.

## What it does

- **Providers list:** lists every provider with its domain pattern and entry count. Click a name to
  jump to it, or use the pencil to edit that provider on its own.
- **Filter:** finds providers by name, domain/URL pattern, rule id or entry, as plain text or regex.
  Add `?q=reddit` to the address to start with a filter.
- **Filtered view:** edit only the matching providers, then **Apply to full file**.
- **Find:** Ctrl/⌘-F in the editor. Enter and Shift-Enter step through matches.
- **JSON ↔ YAML:** converts the whole file. YAML output matches the layout of
  `data/linkumori-clearurls.yaml`.
- **Create patch:** downloads your rule edits as a `patches` file (see *Rule patches* in
  `docs/filter-syntax.md`) instead of a whole copy. It compares the file as you loaded or opened
  it with your edits, and targets each changed rule as `provider::id`, using the same ids as the
  extension (`core_js/linkumori_rule_ids.js`). A patch can only replace a rule, so added or removed
  rules and providers and changed provider keys (such as `domainPatterns`) are listed in the status
  line and the console, not patched.
- **Checks:** syntax errors with line numbers, plus CLN structure: unknown keys, wrong types,
  `domainPatterns` and `urlPattern` together or missing, a missing `matchPattern`, a rule `id` used
  twice in one provider, and regexes that don't compile.
- **Shared rule sets:** `ruleSets` and `{ include: <name> }` entries (see *Shared rule sets* in
  [`docs/cln-yaml.md`](../../docs/cln-yaml.md)) are checked, kept as written when you edit or apply,
  and searched through: a provider that includes a set matches what the set's entries match.

These checks are a quick first pass. Run `lint-rules` from the CLI before committing. Edit the
YAML source, then rebuild the JSON and LZ4 with the CLI. Don't edit the generated files by hand.

## Files

| File | What it is |
| --- | --- |
| `index.html` | The page |
| `code-editor.js` | Our own code editor: a native textarea with syntax colours, line numbers, lint marks and find drawn underneath. No dependencies. Keep it the same as `assets/code-editor.js` on the `website` branch |
| `rules-editor.js` | The rules editor: loading, filtering, checks, the providers list. Keep it the same as `assets/rules-editor.js` on the `website` branch |
| `../../core_js/linkumori_rule_ids.js` | Loaded from the extension for **Create patch**, so patch targets use the engine's rule ids. On the website it must be served next to the page's scripts |
| `rules-editor.css` | Standalone page styles, copied from the website stylesheet |
| `yaml.js` | The [`yaml`](https://github.com/eemeli/yaml) package (ISC license, see `yaml-src/LICENSE-yaml`) as one browser file. Generated, don't edit. It's the only third-party code |
| `yaml-src/` | Source for `yaml.js` |

To rebuild `yaml.js`:

```bash
cd tools/rules-editor/yaml-src && bun install && bun run build
```

`tools/` is listed in `.build-ignore`, so none of this is packaged into the extension.
