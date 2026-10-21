#!/usr/bin/env node
// Builds cln-1.0.html and filter-syntax.html from the docs on the main branch.
//
//   node scripts/build-docs.mjs            # reads docs with `git show main:docs/…`
//   node scripts/build-docs.mjs ../docs    # reads docs from a folder instead
//
// The converter covers the Markdown these two documents use: headings, paragraphs,
// fenced code, tables, nested lists, block quotes, inline code, links and emphasis.

import { execFileSync } from 'node:child_process';
import { readFileSync, writeFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

const siteRoot = join(dirname(fileURLToPath(import.meta.url)), '..');
const docsDir = process.argv[2];
const REPO = 'https://github.com/Linkumori/Linkumori-Addon';

function readMain(path) {
  return execFileSync('git', ['show', `main:${path}`], { cwd: siteRoot, encoding: 'utf8' });
}

// The extension version shown in the header, from main's manifest.
const VERSION = JSON.parse(readMain('manifest.json')).version;

const pages = [
  {
    source: 'cln-format-1.0.md',
    out: 'cln-1.0.html',
    title: 'CLN Format 1.0 — Linkumori',
    description: 'The Linkumori CLN Format 1.0 (final) standard: file structure, processing order, duplicate handling, toggle ids, $removeparam escapes, redirect safety and conformance.',
    kicker: 'Specification',
    status: 'Final',
    version: '1.0',
    extra: {
      before: 'whole-number-matchpattern-entries',
      file: 'partials/run-order-tool.html',
      toc: { level: 3, id: 'run-order-calculator', text: 'Run-order calculator' }
    },
    scripts: ['assets/run-order.js']
  },
  {
    source: 'filter-syntax.md',
    out: 'filter-syntax.html',
    title: 'Filter syntax — Linkumori',
    description: 'Rule-by-rule reference for Linkumori CLN Format 1.0: provider fields, patterns, $removeparam filters and modifiers, raw rules, redirects, rule objects, defaults and processing order.',
    kicker: 'Reference',
    status: 'Current',
    version: 'CLN 1.0',
    scripts: []
  }
];

const localLinks = {
  'cln-format-1.0.md': 'cln-1.0.html',
  'filter-syntax.md': 'filter-syntax.html'
};

function readDoc(name) {
  if (docsDir) return readFileSync(join(docsDir, name), 'utf8');
  return readMain(`docs/${name}`);
}

function escapeHtml(s) {
  return s.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');
}

// GitHub-style heading slugs, so links written for GitHub keep working.
function slugger() {
  const seen = new Map();
  return function slug(text) {
    const base = text
      .toLowerCase()
      .replace(/<[^>]+>/g, '')
      .replace(/[^\p{L}\p{N}\s_-]/gu, '')
      .trim()
      .replace(/\s/g, '-');
    const n = seen.get(base) || 0;
    seen.set(base, n + 1);
    return n ? `${base}-${n}` : base;
  };
}

function rewriteHref(href) {
  const [path, hash] = href.split('#');
  if (localLinks[path] !== undefined) return localLinks[path] + (hash ? '#' + hash : '');
  if (!path && hash) return '#' + hash;
  if (/^[a-z]+:/i.test(href)) return href;
  return `${REPO}/blob/main/docs/${href}`;
}

function inline(text) {
  const codes = [];
  let s = text.replace(/`([^`]+)`/g, (_, c) => {
    codes.push(`<code>${escapeHtml(c)}</code>`);
    return `\u0000${codes.length - 1}\u0000`;
  });
  s = escapeHtml(s);
  s = s.replace(/\[([^\]]+)\]\(([^)\s]+)\)/g, (_, t, h) => `<a href="${escapeHtml(rewriteHref(h))}">${t}</a>`);
  s = s.replace(/\*\*([^*]+)\*\*/g, '<strong>$1</strong>');
  s = s.replace(/(^|[^*\w])\*([^*\s][^*]*?)\*(?!\w)/g, '$1<em>$2</em>');
  s = s.replace(/\\([\\|*_`~])/g, '$1');
  return s.replace(/\u0000(\d+)\u0000/g, (_, i) => codes[+i]);
}

function highlightJson(code) {
  return escapeHtml(code)
    .replace(/(&quot;(?:[^&]|&(?!quot;))*?&quot;)(\s*:)/g, '<span class="k">$1</span>$2')
    .replace(/(:\s*|\[\s*|,\s*|^\s*)(&quot;(?:[^&]|&(?!quot;))*?&quot;)/gm, '$1<span class="s">$2</span>');
}

function splitRow(line) {
  let row = line.trim();
  if (row.startsWith('|')) row = row.slice(1);
  if (row.endsWith('|') && !row.endsWith('\\|')) row = row.slice(0, -1);
  const cells = [];
  let cur = '';
  for (let i = 0; i < row.length; i++) {
    if (row[i] === '\\' && row[i + 1] === '|') { cur += '\\|'; i++; continue; }
    if (row[i] === '|') { cells.push(cur.trim()); cur = ''; continue; }
    cur += row[i];
  }
  cells.push(cur.trim());
  // In a table cell `\|` is a literal pipe, inside code spans too.
  return cells.map(c => c.replace(/\\\|/g, '|'));
}

function cellInline(text) {
  // Table cells already turned `\|` into `|`; keep other escapes for inline().
  return inline(text.replace(/\|/g, '\\|')).replace(/\\\|/g, '|');
}

function convert(md, ctx) {
  const lines = md.replace(/\r\n/g, '\n').split('\n');
  const out = [];
  let i = 0;

  const isBlank = l => /^\s*$/.test(l);
  const listRe = /^(\s*)([-*]|\d+\.)\s+(.*)$/;

  while (i < lines.length) {
    const line = lines[i];

    if (isBlank(line)) { i++; continue; }

    const fence = /^```(\w*)\s*$/.exec(line);
    if (fence) {
      const body = [];
      i++;
      while (i < lines.length && !/^```\s*$/.test(lines[i])) body.push(lines[i++]);
      i++;
      const code = body.join('\n');
      const html = fence[1] === 'json' ? highlightJson(code) : escapeHtml(code);
      out.push(`<pre><code${fence[1] ? ` class="language-${fence[1]}"` : ''}>${html}</code></pre>`);
      continue;
    }

    const h = /^(#{1,6})\s+(.*)$/.exec(line);
    if (h) {
      const level = h[1].length;
      const text = h[2].trim();
      if (level === 1) {
        // The page hero shows the title.
        ctx.title = text;
      } else {
        const id = ctx.slug(text);
        if (level <= 3) ctx.toc.push({ level, id, text });
        out.push(`<h${level} id="${id}">${inline(text)}</h${level}>`);
      }
      i++;
      continue;
    }

    if (/^>/.test(line)) {
      const body = [];
      while (i < lines.length && /^>/.test(lines[i])) body.push(lines[i++].replace(/^>\s?/, ''));
      out.push(`<div class="callout">${convert(body.join('\n'), ctx)}</div>`);
      continue;
    }

    if (/^\s*\|/.test(line) && i + 1 < lines.length && /^\s*\|?\s*:?-{3,}/.test(lines[i + 1])) {
      const head = splitRow(line);
      i += 2;
      const rows = [];
      while (i < lines.length && /^\s*\|/.test(lines[i])) rows.push(splitRow(lines[i++]));
      const th = head.map(c => `<th scope="col">${cellInline(c)}</th>`).join('');
      const tb = rows.map(r => `<tr>${r.map(c => `<td>${cellInline(c)}</td>`).join('')}</tr>`).join('\n');
      out.push(`<div class="table-wrap"><table>\n<thead><tr>${th}</tr></thead>\n<tbody>\n${tb}\n</tbody>\n</table></div>`);
      continue;
    }

    const li = listRe.exec(line);
    if (li) {
      const indent = li[1].length;
      const ordered = /\d/.test(li[2]);
      const items = [];
      while (i < lines.length) {
        const m = listRe.exec(lines[i]);
        if (!m || m[1].length !== indent || /\d/.test(m[2]) !== ordered) break;
        const body = [m[3]];
        i++;
        let sawBlank = false;
        while (i < lines.length) {
          const l = lines[i];
          if (isBlank(l)) {
            const next = lines.slice(i + 1).find(x => !isBlank(x));
            if (next !== undefined && /^\s+/.test(next) && next.match(/^\s*/)[0].length > indent) {
              body.push('');
              sawBlank = true;
              i++;
              continue;
            }
            break;
          }
          const lead = l.match(/^\s*/)[0].length;
          const sub = listRe.exec(l);
          if (sub && lead === indent) break;
          if (lead > indent || (!sub && !sawBlank && lead === indent && !/^(#|```|\||>)/.test(l.trim()))) {
            body.push(l.slice(Math.min(lead, indent + 2)));
            i++;
            continue;
          }
          break;
        }
        let html = convert(body.join('\n'), ctx);
        const single = /^<p>([\s\S]*)<\/p>$/.exec(html);
        if (single && !single[1].includes('<p>')) html = single[1];
        else html = html.replace(/^<p>([\s\S]*?)<\/p>/, '$1');
        items.push(`<li>${html}</li>`);
      }
      const tag = ordered ? 'ol' : 'ul';
      out.push(`<${tag}>\n${items.join('\n')}\n</${tag}>`);
      continue;
    }

    const para = [];
    while (i < lines.length && !isBlank(lines[i]) && !/^(#{1,6}\s|```|>|\s*\|)/.test(lines[i]) && !listRe.exec(lines[i])) {
      para.push(lines[i++].trim());
    }
    const text = para.join(' ');
    if (ctx.metaPending && /^[A-Z][a-z]{2} \d{1,2}, \d{4}/.test(text)) {
      // "Oct 2, 2026 · @Subham": shown in the page hero.
      ctx.metaPending = false;
      ctx.meta = text.split('·').map(t => t.trim());
    } else {
      out.push(`<p>${inline(text)}</p>`);
    }
  }
  return out.join('\n');
}

function tocHtml(toc) {
  const parts = [];
  let open = false;
  for (const item of toc) {
    const link = `<a href="#${item.id}">${inline(item.text)}</a>`;
    if (item.level === 2) {
      if (open) parts.push('</ol></li>');
      parts.push(`<li>${link}<ol>`);
      open = true;
    } else if (open) {
      parts.push(`<li>${link}</li>`);
    }
  }
  if (open) parts.push('</ol></li>');
  return parts.join('\n').replace(/<ol><\/ol>/g, '');
}

function template(page, ctx, body, toc, current) {
  const nav = [
    ['./#features', 'Features'],
    ['./#compare', 'Compare'],
    ['cln-1.0.html', 'CLN 1.0'],
    ['filter-syntax.html', 'Filter syntax'],
    [REPO, 'GitHub']
  ].map(([href, label]) => `        <a href="${href}"${href === current ? ' aria-current="page"' : ''}>${label}</a>`).join('\n');
  const scripts = page.scripts.map(s => `  <script src="${s}" defer></script>`).join('\n');
  const source = `${REPO}/blob/main/docs/${page.source}`;
  const [date = '', editor = ''] = ctx.meta || [];
  const facts = [
    ['Status', `<span class="status-final">${escapeHtml(page.status)}</span>`],
    ['Version', escapeHtml(page.version)],
    ['Published', escapeHtml(date)],
    ['Editor', escapeHtml(editor)],
    ['Source', `<a href="${source}">docs/${page.source}</a>`]
  ].filter(([, v]) => v).map(([k, v]) => `          <div><dt>${k}</dt><dd>${v}</dd></div>`).join('\n');

  return `<!doctype html>
<html lang="en">
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width, initial-scale=1">
  <title>${escapeHtml(page.title)}</title>
  <meta name="description" content="${escapeHtml(page.description)}">
  <meta name="color-scheme" content="light dark">
  <meta name="theme-color" content="#f5f3ee" media="(prefers-color-scheme: light)">
  <meta name="theme-color" content="#0f1115" media="(prefers-color-scheme: dark)">
  <link rel="icon" href="assets/logo.svg" type="image/svg+xml">
  <link rel="preload" href="assets/fonts/charis-sil-latin-400-normal.woff2" as="font" type="font/woff2" crossorigin>
  <link rel="stylesheet" href="assets/style.css">
  <script src="assets/site.js"></script>
${scripts}
</head>
<body>
  <a class="skip" href="#main">Skip to content</a>
  <!-- Generated by scripts/build-docs.mjs from docs/${page.source}. Edit the source, then rebuild. -->

  <header class="site-header">
    <div class="container">
      <a class="brand" href="./" aria-label="Linkumori home"><img src="assets/logo.svg" alt="" width="28" height="28"><span class="brand-name">Linkumori</span></a>
      <span class="brand-ver">v${VERSION}</span>
      <button class="icon-btn menu-btn" data-menu-toggle aria-controls="site-nav" aria-expanded="false" aria-label="Menu">
        <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" aria-hidden="true"><path d="M4 7h16M4 12h16M4 17h16"/></svg>
      </button>
      <nav class="nav" id="site-nav" aria-label="Main">
${nav}
        <button class="icon-btn" data-theme-toggle aria-label="Toggle theme"></button>
        <a class="btn btn-primary btn-sm nav-cta" href="https://addons.mozilla.org/en-US/firefox/addon/linkumori-clean-urls/">Add to Firefox</a>
      </nav>
    </div>
  </header>

  <header class="doc-hero">
    <div class="container">
      <span class="overline">${escapeHtml(page.kicker)}</span>
      <h1>${inline(ctx.title || page.title)}</h1>
      <dl class="doc-facts">
${facts}
      </dl>
    </div>
  </header>

  <div class="container docs">
    <aside class="toc" aria-label="On this page">
      <details open>
        <summary>Contents</summary>
        <ol>
${toc}
        </ol>
      </details>
    </aside>
    <main id="main" class="prose">
${body}
      <p class="doc-src">Generated from <a href="${source}">docs/${page.source}</a> on the main branch. Found a problem? <a href="${REPO}/issues/new">Open an issue</a>.</p>
    </main>
  </div>

  <footer class="site-footer">
    <div class="container">
      <div class="foot-grid">
        <div>
          <a class="brand" href="./"><img src="assets/logo.svg" alt="" width="26" height="26"><span class="brand-name">Linkumori</span></a>
          <p>Clean URLs for Firefox. Forked from <a href="https://github.com/ClearURLs/Addon">ClearURLs</a>, with thanks to its contributors.</p>
        </div>
        <div>
          <h3>Product</h3>
          <ul>
            <li><a href="./#features">Features</a></li>
            <li><a href="https://addons.mozilla.org/en-US/firefox/addon/linkumori-clean-urls/">Firefox Add-ons</a></li>
            <li><a href="${REPO}/blob/main/CHANGELOG.md">Changelog</a></li>
          </ul>
        </div>
        <div>
          <h3>Standard</h3>
          <ul>
            <li><a href="cln-1.0.html">CLN Format 1.0</a></li>
            <li><a href="filter-syntax.html">Filter syntax</a></li>
            <li><a href="https://github.com/orgs/Linkumori/discussions/163">1.0 announcement</a></li>
          </ul>
        </div>
        <div>
          <h3>Project</h3>
          <ul>
            <li><a href="${REPO}">Source</a></li>
            <li><a href="${REPO}/blob/main/privacy.md">Privacy</a></li>
            <li><a href="${REPO}/blob/main/SECURITY.md">Security</a></li>
            <li><a href="${REPO}/blob/main/License.md">License</a></li>
          </ul>
        </div>
      </div>
      <div class="foot-base"><span>LGPL-3.0-or-later</span><span>No cookies · No trackers · No third-party requests</span></div>
    </div>
  </footer>
</body>
</html>
`;
}

for (const page of pages) {
  const ctx = { slug: slugger(), toc: [], metaPending: true };
  let body = convert(readDoc(page.source), ctx);
  if (page.extra) {
    const marker = `<h2 id="${page.extra.before}">`;
    if (!body.includes(marker)) throw new Error(`${page.source}: no heading #${page.extra.before}`);
    const partial = readFileSync(join(siteRoot, page.extra.file), 'utf8').trim();
    body = body.replace(marker, partial + '\n' + marker);
    const at = ctx.toc.findIndex(t => t.id === page.extra.before);
    ctx.toc.splice(at, 0, page.extra.toc);
  }
  writeFileSync(join(siteRoot, page.out), template(page, ctx, body, tocHtml(ctx.toc), page.out));
  console.log(`${page.out}: ${ctx.toc.length} headings`);
}
