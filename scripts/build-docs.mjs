#!/usr/bin/env node
// Builds cln-1.0.html and filter-syntax.html from the docs on the main branch,
// and privacy.html and terms.html from legal/ on this branch.
//
//   node scripts/build-docs.mjs            # reads docs with `git show main:docs/…`
//   node scripts/build-docs.mjs ../docs    # reads docs from a folder instead
//
// The converter covers the Markdown these two documents use: headings, paragraphs,
// fenced code, tables, nested lists, block quotes, inline code, links and emphasis.

import { execFileSync } from 'node:child_process';
import { createHash } from 'node:crypto';
import vm from 'node:vm';
import { existsSync, readFileSync, writeFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { diagramHash, DIAGRAM_DIR } from './diagrams.mjs';
import { overloadCases, customCases, defaultsCases, sourceCases, caseTriggers } from './rules-cases.mjs';

const siteRoot = join(dirname(fileURLToPath(import.meta.url)), '..');
const docsDir = process.argv[2];
const REPO = 'https://github.com/Linkumori/Linkumori-Addon';
const SITE = 'https://linkumori.github.io/Linkumori-Addon/';

function readMain(path) {
  return execFileSync('git', ['show', `main:${path}`], { cwd: siteRoot, encoding: 'utf8' });
}

// Cache-busting: every link to a stylesheet, script or image under assets/ gets ?v=<hash of
// the file>, so a browser never pairs a new page with an old cached script.
const fingerprints = new Map();
function fingerprint(path) {
  if (!fingerprints.has(path)) {
    fingerprints.set(path, createHash('sha256').update(readFileSync(join(siteRoot, path))).digest('hex').slice(0, 10));
  }
  return fingerprints.get(path);
}
function stampAssets(html) {
  return html.replace(/(["'(])((?:[^"'()]*\/)?assets\/[\w./-]+\.(?:css|js|webp|png|svg))(?:\?v=[0-9a-f]+)?(?=["')])/g,
    (_, q, url) => {
      const local = url.replace(/^.*?(assets\/)/, '$1');
      try { return `${q}${url}?v=${fingerprint(local)}`; } catch { return `${q}${url}`; }
    });
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
    notice: 'partials/cln-terms.html',
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
    notice: 'partials/cln-terms.html',
    scripts: []
  },
  {
    source: 'runtime-architecture.md',
    out: 'runtime-architecture.html',
    title: 'Runtime architecture — Linkumori',
    description: 'How Linkumori works inside the browser: the background page, startup, settings, rule loading and merging, the cleaning engine, messaging and the extension pages.',
    kicker: 'For contributors',
    status: 'Current',
    version: 'main',
    wide: true,
    scripts: []
  },
  {
    html: 'partials/rules.html',
    out: 'rules.html',
    title: 'How rules work — Linkumori',
    heading: 'How rules work',
    description: 'How Linkumori picks its rule sources, merges built-in and remote rules in overload mode, applies custom rules on top, and handles toggles, defaults and remote file capabilities, with every case.',
    kicker: 'Guide',
    // The page describes custom rules as they work after 100.66.0, and notes the older behaviour.
    facts: [['Covers', 'Sources, merging, custom rules'], ['Applies to', 'Linkumori after 100.66.0']],
    wide: true,
    scripts: ['assets/rules.js']
  },
  {
    local: 'legal/privacy.md',
    out: 'privacy.html',
    title: 'Privacy Policy — Linkumori',
    description: 'Privacy policy for the Linkumori website: no cookies, analytics or trackers, and hosting by GitHub Pages.',
    kicker: 'Legal',
    scripts: []
  },
  {
    local: 'legal/terms.md',
    out: 'terms.html',
    title: 'Terms of Use — Linkumori',
    description: 'Terms of use for the Linkumori website.',
    kicker: 'Legal',
    scripts: []
  }
];

const localLinks = {
  'cln-format-1.0.md': 'cln-1.0.html',
  'filter-syntax.md': 'filter-syntax.html',
  'runtime-architecture.md': 'runtime-architecture.html'
};

// The legal pages' "Last updated" line goes in the title block instead of the body.
const LAST_UPDATED = /^\*\*Last updated:\*\*\s*(.+)$/m;

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
  // Pages and files of this site stay relative.
  if (/\.html$/.test(path) || path.startsWith('assets/')) return href;
  // Files outside docs/, such as ../manifest.json.
  if (path.startsWith('../')) return `${REPO}/blob/main/${href.slice(3)}`;
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

// Colours JSON tokens: keys (k), strings (s), numbers (n), and true / false / null (l).
// Works on the raw text, so escaped quotes inside strings stay inside their string.
function highlightJson(code) {
  const token = /"(?:[^"\\\n]|\\.)*"(?=\s*:)|"(?:[^"\\\n]|\\.)*"|-?\b\d+(?:\.\d+)?(?:[eE][+-]?\d+)?\b|\b(?:true|false|null)\b/g;
  let out = '';
  let last = 0;
  for (const m of code.matchAll(token)) {
    out += escapeHtml(code.slice(last, m.index));
    const t = m[0];
    const cls = t[0] === '"' ? (/^\s*:/.test(code.slice(m.index + t.length)) ? 'k' : 's')
      : /^(true|false|null)$/.test(t) ? 'l' : 'n';
    out += `<span class="${cls}">${escapeHtml(t)}</span>`;
    last = m.index + t.length;
  }
  return out + escapeHtml(code.slice(last));
}

// A code listing with a language bar and a Copy button (wired up in site.js).
const LANG_NAMES = { json: 'JSON' };
// A Mermaid diagram, as the light and dark renders from make-diagrams.mjs, with its
// source under them for screen readers and for copying.
function diagram(source, section) {
  const hash = diagramHash(source);
  const file = theme => `${DIAGRAM_DIR}/${hash}-${theme}.svg`;
  for (const theme of ['light', 'dark']) {
    if (!existsSync(join(siteRoot, file(theme)))) throw new Error(`No render of a diagram in "${section}": run scripts/make-diagrams.mjs`);
  }
  const alt = escapeHtml(`Diagram: ${section || 'overview'}. Its Mermaid source follows.`);
  const [, width, height] = /<svg width="(\d+)" height="(\d+)"/.exec(readFileSync(join(siteRoot, file('light')), 'utf8'));
  const img = theme => `<img class="theme-${theme}-only" src="${file(theme)}" width="${width}" height="${height}" alt="${alt}" loading="lazy">`;
  const full = theme => `<a class="theme-${theme}-only" href="${file(theme)}">Open full size</a>`;
  // --w lets the stylesheet keep the text readable: below 70% of full size the
  // diagram scrolls sideways instead of shrinking further.
  return `<figure class="diagram">
  <div class="diagram-scroll" style="--w: ${width}px" tabindex="0" role="group" aria-label="${escapeHtml(`Diagram: ${section || 'overview'}`)}">
    ${img('light')}
    ${img('dark')}
  </div>
  <div class="diagram-links">${full('light')}${full('dark')}</div>
  <details><summary>Diagram source</summary>${codeBlock(escapeHtml(source), 'mermaid')}</details>
</figure>`;
}

function codeBlock(html, lang) {
  const label = LANG_NAMES[lang] || '';
  return `<div class="codeblock"><div class="codeblock-bar"><span class="codeblock-lang">${label}</span>` +
    `<button type="button" class="copy-code" aria-label="Copy${label ? ' ' + label : ''} code">Copy</button></div>` +
    `<pre><code${lang ? ` class="language-${lang}"` : ''}>${html}</code></pre></div>`;
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

// ---------- Case cards for rules.html (data in rules-cases.mjs) ----------

// JSON laid out the way people write rule files: short arrays and objects stay on one line.
function formatJson(value, indent = '', prefix = 0) {
  const inline = v => {
    if (Array.isArray(v)) return `[${v.map(inline).join(', ')}]`;
    if (v && typeof v === 'object') {
      const parts = Object.entries(v).map(([k, x]) => `${JSON.stringify(k)}: ${inline(x)}`);
      return parts.length ? `{ ${parts.join(', ')} }` : '{}';
    }
    return JSON.stringify(v);
  };
  const flat = inline(value);
  // 46 columns fit the narrow panels of a case card without scrolling; `prefix` is
  // the width of the key already written on this line.
  if (indent.length + prefix + flat.length <= 46 || value === null || typeof value !== 'object') return flat;
  const next = indent + '  ';
  if (Array.isArray(value)) return `[\n${value.map(v => next + formatJson(v, next)).join(',\n')}\n${indent}]`;
  return `{\n${Object.entries(value).map(([k, v]) => `${next}${JSON.stringify(k)}: ${formatJson(v, next, JSON.stringify(k).length + 2)}`).join(',\n')}\n${indent}}`;
}

const ORIGIN_LABELS = { builtin: 'Built-in', remote: 'Remote', custom: 'Custom', cache: 'Cache', off: 'Off' };
const tag = (origin, label) => `<span class="rx-tag rx-o-${origin}">${escapeHtml(label || ORIGIN_LABELS[origin] || origin)}</span>`;

function providerDiagram(p) {
  const head = `<div class="rx-prov-head">${p.origin ? tag(p.origin, p.name ? undefined : undefined) : ''}` +
    `${p.name ? `<b class="rx-prov-name">${escapeHtml(p.name)}</b>` : ''}<code>${escapeHtml(p.pattern)}</code>` +
    `${p.note ? `<small>${escapeHtml(p.note)}</small>` : ''}</div>`;
  const rows = p.rows.length
    ? `<ul>${p.rows.map(r => `<li class="rx-o-${r.origin}${r.gone ? ' rx-gone' : ''}"><code>${escapeHtml(r.text)}</code>` +
        `${r.note ? `<small>${escapeHtml(r.note)}</small>` : ''}<span class="rx-row-tag">${escapeHtml(ORIGIN_LABELS[r.origin])}</span></li>`).join('')}</ul>`
    : '';
  return `<div class="rx-prov${p.origin === 'off' ? ' rx-prov-off' : ''}">${p.caption ? `<div class="rx-prov-caption">${escapeHtml(p.caption)}</div>` : ''}${head}${rows}</div>`;
}

// "Triggered by": what you set or did, then what Linkumori does on its own at each load.
function caseTriggerList(id) {
  const triggers = caseTriggers[id];
  if (!triggers) throw new Error(`rules-cases.mjs: no trigger for case ${id}`);
  return `<ol class="case-trigger" aria-label="Triggered by">${triggers.map(([who, text]) =>
    `<li><span class="dm-who dm-${who}">${who === 'you' ? 'You set' : 'Automatic'}</span><span>${escapeHtml(text)}</span></li>`).join('')}</ol>`;
}

function caseCard(c, i) {
  const inputs = c.inputs.map(input => `<div class="case-in">
  <div class="case-label">${tag(input.origin, input.tag || (input.origin === 'off' ? 'Off' : undefined))}<span>${escapeHtml(input.label)}</span></div>
  ${input.json !== undefined ? codeBlock(highlightJson(formatJson(input.json)), 'json') : `<p class="case-text">${escapeHtml(input.text)}</p>`}
</div>`).join('\n');
  const merged = c.merged && Object.keys(c.merged).length
    ? codeBlock(highlightJson(formatJson({ providers: c.merged })), 'json')
    : '<p class="case-text">No provider for this pattern.</p>';
  return `<article class="case" id="${c.id}" data-case-title="${escapeHtml(c.title)}">
<header class="case-head"><span class="case-num">${i + 1}</span><h4>${escapeHtml(c.title)}</h4></header>
${caseTriggerList(c.id)}
<div class="case-body">
<div class="case-inputs">
${inputs}
</div>
<div class="case-arrow" aria-hidden="true">→</div>
<div class="case-out">
  <div class="case-label"><span>What runs</span></div>
  <div class="case-runs">${c.runs.map(providerDiagram).join('')}</div>
  <details class="case-json"><summary>${escapeHtml(c.mergedLabel || 'Merged provider')} as JSON</summary>${merged}</details>
</div>
</div>
<p class="case-explain">${escapeHtml(c.explain)}</p>
</article>`;
}

function caseGallery(cases, label) {
  return `<div class="cases" data-cases aria-label="${escapeHtml(label)}">\n${cases.map(caseCard).join('\n')}\n</div>`;
}

function sourceGallery(cases) {
  const LAYER = { builtin: 'Built-in rules', remote: 'Remote rules', cache: 'Verified cache' };
  return `<div class="src-cases">\n${cases.map(c => `<article class="src-case">
<dl class="src-settings">${Object.entries(c.settings).map(([k, v]) => `<div><dt>${escapeHtml(k)}</dt><dd>${escapeHtml(v)}</dd></div>`).join('')}</dl>
<div class="src-stack">${c.layers.length
    ? c.layers.map(l => `<div class="rx-layer rx-o-${l}${c.merged ? ' rx-merged' : ''}"><b>${LAYER[l]}</b></div>`).join('')
    : '<div class="rx-layer rx-empty">No base rules</div>'}</div>
<p class="src-result">${escapeHtml(c.result)}</p>
</article>`).join('\n')}\n</div>`;
}

// The editor's "Merge from sources" example, worked out by the extension's own planner
// (core_js/linkumori_rule_defaults.js on main), so the page can't drift from it.
function defaultsMergeExample() {
  const sandbox = {};
  sandbox.globalThis = sandbox;
  vm.runInNewContext(readMain('core_js/linkumori_rule_defaults.js'), sandbox);
  const { planRuleDefaultsMerge, resolveRuleDefaultsMerge } = sandbox.LinkumoriRuleDefaults;
  const sources = [
    { name: 'Your defaults', origin: 'custom', label: 'Yours', defaults: { requestTypes: ['main_frame'], exceptions: ['^https:\\/\\/shop\\.example\\/cart'] } },
    { name: 'Built-in rules', origin: 'builtin', defaults: { requestTypes: ['main_frame', 'xmlhttprequest'], historyBypassProtection: false, exceptions: ['^https:\\/\\/shop\\.example\\/login'] } },
    { name: 'rules.example.org', origin: 'remote', defaults: { requestTypes: ['main_frame'], description: 'Shop rules' } }
  ];
  const plan = planRuleDefaultsMerge(sources.map(({ name, defaults }) => ({ name, defaults })));
  const result = resolveRuleDefaultsMerge(plan);
  const show = v => v === undefined ? 'left out' : formatJson(v);
  const notes = [];
  Object.keys(plan.merged).forEach(key => {
    if (plan.combined.some(c => c.key === key)) notes.push([key, 'Added together from every source', 'auto']);
    else notes.push([key, 'Every source agrees', 'auto']);
  });
  plan.conflicts.forEach(c => {
    const opts = c.options.map((o, i) => `${i === c.choice ? '<b>' : ''}${escapeHtml(show(o.value))}${o.combined ? ' (combined)' : ''}` +
      `${o.sources.length ? ' from ' + escapeHtml(o.sources.join(', ')) : ''}${i === c.choice ? '</b>' : ''}`);
    notes.push([c.key, `You choose: ${opts.join(' · ')}. Bold is preselected.`, 'you']);
  });
  const inputs = sources.map(src => `<div class="case-in">
  <div class="case-label">${tag(src.origin, src.label)}<span>${escapeHtml(src.name)}</span></div>
  ${codeBlock(highlightJson(formatJson({ defaults: src.defaults })), 'json')}
</div>`).join('\n');
  return `<article class="case" id="defaults-merge-tool">
<header class="case-head"><span class="case-num"><i aria-hidden="true">✦</i></span><h4>Merge from sources: three defaults blocks</h4></header>
${caseTriggerList('defaults-merge-tool')}
<div class="case-body">
<div class="case-inputs">
${inputs}
</div>
<div class="case-arrow" aria-hidden="true">→</div>
<div class="case-out">
  <div class="case-label"><span>Merged defaults, with the preselected choices</span></div>
  ${codeBlock(highlightJson(formatJson({ defaults: result })), 'json')}
  <ul class="dm-notes">${notes.map(([k, t, who]) => `<li><span class="dm-who dm-${who}">${who === 'you' ? 'You choose' : 'Automatic'}</span><code>${escapeHtml(k)}</code><span>${t}</span></li>`).join('')}</ul>
</div>
</div>
<p class="case-explain">Nothing is stored until you copy the merged block into one of your defaults sets and save. Picking another option for a key changes only that key.</p>
</article>`;
}

const CASE_SLOTS = {
  'cases:defaults-merge': () => defaultsMergeExample(),
  'cases:overload': () => caseGallery(overloadCases, 'Overload mode cases'),
  'cases:custom': () => caseGallery(customCases, 'Custom rule cases'),
  'cases:defaults': () => caseGallery(defaultsCases, 'Defaults cases'),
  'cases:sources': () => sourceGallery(sourceCases)
};

// A column headed `(stage, orderGroup, order, rank, arrayIndex)` is drawn as five
// columns under one "Sort key" heading, each tuple value in its own cell.
const SORT_KEY = '(stage, orderGroup, order, rank, arrayIndex)';
const SORT_PARTS = ['stage', 'orderGroup', 'order', 'rank', 'arrayIndex'];

function sortKeyTable(head, rows, keyCol) {
  const top = head.map((c, i) => i === keyCol
    ? `<th scope="colgroup" colspan="${SORT_PARTS.length}" class="sk-group">Sort key</th>`
    : `<th scope="col" rowspan="2">${cellInline(c)}</th>`).join('');
  // The last key heading ends the second header row, but keeps its border when columns follow it.
  const edge = keyCol < head.length - 1 ? ' sk-edge' : '';
  const sub = SORT_PARTS.map((p, i) => `<th scope="col" class="sk${i ? '' : ' sk-first'}${i === SORT_PARTS.length - 1 ? edge : ''}"><code>${p}</code></th>`).join('');
  const body = rows.map(r => '<tr>' + r.map((c, i) => {
    if (i !== keyCol) return `<td>${cellInline(c)}</td>`;
    const parts = c.replace(/`/g, '').trim().replace(/^\(|\)$/g, '').split(',').map(v => v.trim());
    if (parts.length !== SORT_PARTS.length) throw new Error(`Sort key "${c}" does not have ${SORT_PARTS.length} parts`);
    return parts.map((v, j) => `<td class="sk${j ? '' : ' sk-first'}">${escapeHtml(v)}</td>`).join('');
  }).join('') + '</tr>').join('\n');
  return `<div class="table-wrap"><table class="sk-table">\n<thead><tr>${top}</tr><tr>${sub}</tr></thead>\n<tbody>\n${body}\n</tbody>\n</table></div>`;
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
      if (fence[1] === 'mermaid') {
        out.push(diagram(code, ctx.section));
        continue;
      }
      const html = fence[1] === 'json' ? highlightJson(code) : escapeHtml(code);
      out.push(codeBlock(html, fence[1]));
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
        ctx.section = text.replace(/`/g, '');
        if (level <= 3) ctx.toc.push({ level, id, text });
        out.push(`<h${level} id="${id}">${headingText(text)}</h${level}>`);
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
      const keyCol = head.findIndex(c => c.replace(/`/g, '').trim() === SORT_KEY);
      if (keyCol !== -1) {
        out.push(sortKeyTable(head, rows, keyCol));
        continue;
      }
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

// "4.2 Remote rules" → the section number in its own span, so it can be set apart.
function headingText(text) {
  const m = /^(\d+(?:\.\d+)*)\.?\s+(.+)$/.exec(text);
  return m ? `<span class="h-num">${m[1]}</span>${inline(m[2])}` : inline(text);
}

function tocHtml(toc) {
  const parts = [];
  let open = false;
  for (const item of toc) {
    const link = `<a href="#${item.id}">${headingText(item.text)}</a>`;
    if (item.level === 2) {
      if (open) parts.push('</ol></li>');
      parts.push(`<li>${link}<ol>`);
      open = true;
    } else if (open) {
      parts.push(`<li>${link}</li>`);
    }
  }
  if (open) parts.push('</ol></li>');
  return parts.join('\n').replace(/<ol>\s*<\/ol>/g, '');
}

function template(page, ctx, body, toc, current) {
  const nav = [
    ['./#features', 'Features'],
    ['./#privacy', 'Privacy'],
    ['./#compare', 'Compare'],
    ['rules.html', 'How rules work'],
    ['cln-1.0.html', 'CLN 1.0'],
    ['filter-syntax.html', 'Filter syntax'],
    [REPO, '<svg width="15" height="15" viewBox="0 0 16 16" fill="currentColor" aria-hidden="true"><path d="M8 0C3.58 0 0 3.58 0 8c0 3.54 2.29 6.53 5.47 7.59.4.07.55-.17.55-.38 0-.19-.01-.82-.01-1.49-2.01.37-2.53-.49-2.69-.94-.09-.23-.48-.94-.82-1.13-.28-.15-.68-.52-.01-.53.63-.01 1.08.58 1.23.82.72 1.21 1.87.87 2.33.66.07-.52.28-.87.51-1.07-1.78-.2-3.64-.89-3.64-3.95 0-.87.31-1.59.82-2.15-.08-.2-.36-1.02.08-2.12 0 0 .67-.21 2.2.82.64-.18 1.32-.27 2-.27.68 0 1.36.09 2 .27 1.53-1.04 2.2-.82 2.2-.82.44 1.1.16 1.92.08 2.12.51.56.82 1.27.82 2.15 0 3.07-1.87 3.75-3.65 3.95.29.25.54.73.54 1.48 0 1.07-.01 1.93-.01 2.2 0 .21.15.46.55.38A8.013 8.013 0 0016 8c0-4.42-3.58-8-8-8z"/></svg>GitHub', 'gh']
  ].map(([href, label, cls]) => `        <a ${cls ? `class="${cls}" ` : ''}href="${href}"${href === current ? ' aria-current="page"' : ''}>${label}</a>`).join('\n');
  const scripts = page.scripts.map(s => `  <script src="${s}" defer></script>`).join('\n');
  const onSiteBranch = Boolean(page.local || page.html);
  const sourcePath = page.local || page.html || `docs/${page.source}`;
  const source = `${REPO}/blob/${onSiteBranch ? 'website' : 'main'}/${sourcePath}`;
  const sourceNote = onSiteBranch
    ? `Source: <a href="${source}">${sourcePath}</a> on the website branch.`
    : `Generated from <a href="${source}">${sourcePath}</a> on the main branch. Found a problem? <a href="${REPO}/issues/new">Open an issue</a>.`;
  const [date = '', editor = ''] = ctx.meta || [];
  const facts = (page.facts
    ? page.facts.map(([k, v]) => [k, escapeHtml(v)])
    : page.local
    ? [
        ['Applies to', 'This website'],
        ['Last updated', escapeHtml(ctx.updated || '')]
      ]
    : [
        ['Status', `<span class="status-final">${escapeHtml(page.status)}</span>`],
        ['Version', escapeHtml(page.version)],
        ['Published', escapeHtml(date)],
        ['Editor', escapeHtml(editor)],
        ['Source', `<a href="${source}">${sourcePath}</a>`]
      ]
  ).filter(([, v]) => v).map(([k, v]) => `          <div><dt>${k}</dt><dd>${v}</dd></div>`).join('\n');

  return `<!doctype html>
<html lang="en">
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width, initial-scale=1">
  <title>${escapeHtml(page.title)}</title>
  <meta name="description" content="${escapeHtml(page.description)}">
  <meta name="color-scheme" content="light dark">
  <meta name="theme-color" content="#ffffff" media="(prefers-color-scheme: light)">
  <meta name="theme-color" content="#000000" media="(prefers-color-scheme: dark)">
  <link rel="canonical" href="${SITE}${page.out}">
  <meta property="og:type" content="article">
  <meta property="og:site_name" content="Linkumori">
  <meta property="og:url" content="${SITE}${page.out}">
  <meta property="og:title" content="${escapeHtml(page.title)}">
  <meta property="og:description" content="${escapeHtml(page.description)}">
  <meta property="og:image" content="${SITE}assets/og-image.png">
  <meta property="og:image:width" content="1200">
  <meta property="og:image:height" content="630">
  <meta name="twitter:card" content="summary_large_image">
  <link rel="icon" href="assets/logo.svg" type="image/svg+xml">
  <link rel="icon" href="assets/icon-32.png" type="image/png" sizes="32x32">
  <link rel="apple-touch-icon" href="assets/apple-touch-icon.png">
  <link rel="preload" href="assets/fonts/inter-latin-wght-normal.woff2" as="font" type="font/woff2" crossorigin>
  <link rel="stylesheet" href="assets/style.css">
  <script src="assets/site.js"></script>
${scripts}
</head>
<body>
  <a class="skip" href="#main">Skip to content</a>
  <!-- Generated by scripts/build-docs.mjs from ${sourcePath}. Edit the source, then rebuild. -->

  <header class="site-header">
    <div class="container">
      <a class="brand" href="./" aria-label="Linkumori home"><img src="assets/logo.svg" alt="" width="24" height="24"><span class="brand-name">Linkumori</span></a>
      <span class="brand-ver">v${VERSION}</span>
      <button class="icon-btn menu-btn" data-menu-toggle aria-controls="site-nav" aria-expanded="false" aria-label="Menu">
        <svg width="17" height="17" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" aria-hidden="true"><path d="M4 8h16M4 16h16"/></svg>
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
    <main id="main" class="prose${page.wide ? ' prose-wide' : ''}">
${body}
      <p class="doc-src">${sourceNote}</p>
    </main>
  </div>

  <footer class="site-footer">
    <div class="container">
      <div class="foot-grid">
        <div>
          <a class="brand" href="./"><img src="assets/logo.svg" alt="" width="20" height="20"><span class="brand-name">Linkumori</span></a>
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
            <li><a href="rules.html">How rules work</a></li>
            <li><a href="cln-1.0.html">CLN Format 1.0</a></li>
            <li><a href="filter-syntax.html">Filter syntax</a></li>
            <li><a href="https://github.com/orgs/Linkumori/discussions/163">1.0 announcement</a></li>
          </ul>
        </div>
        <div>
          <h3>Project</h3>
          <ul>
            <li><a href="${REPO}">Source</a></li>
            <li><a href="runtime-architecture.html">Runtime architecture</a></li>
            <li><a href="${REPO}/blob/main/privacy.md">Extension privacy</a></li>
            <li><a href="${REPO}/blob/main/SECURITY.md">Security</a></li>
            <li><a href="${REPO}/blob/main/License.md">License</a></li>
          </ul>
        </div>
      </div>
      <div class="foot-base"><span>LGPL-3.0-or-later · <a href="privacy.html">Privacy Policy</a> · <a href="terms.html">Terms of Use</a> · <a href="https://docs.github.com/en/site-policy/github-terms/github-terms-of-service">GitHub Terms of Service</a></span><span>No cookies · No trackers · No third-party requests</span></div>
    </div>
  </footer>
</body>
</html>
`;
}

for (const page of pages) {
  const ctx = { slug: slugger(), toc: [], metaPending: true };
  if (page.html) {
    // A hand-written HTML page: take its contents list from its own h2 and h3 headings.
    ctx.title = page.heading;
    const body = readFileSync(join(siteRoot, page.html), 'utf8').trim()
      .replace(/<!-- (cases:[a-z-]+) -->/g, (_, slot) => {
        if (!CASE_SLOTS[slot]) throw new Error(`${page.html}: unknown slot ${slot}`);
        return CASE_SLOTS[slot]();
      });
    for (const m of body.matchAll(/<h([23]) id="([^"]+)">([\s\S]*?)<\/h\1>/g)) {
      ctx.toc.push({ level: Number(m[1]), id: m[2], text: m[3].replace(/<[^>]+>/g, '') });
    }
    writeFileSync(join(siteRoot, page.out), stampAssets(template(page, ctx, body, tocHtml(ctx.toc), page.out)));
    console.log(`${page.out}: ${ctx.toc.length} headings`);
    continue;
  }
  let md = page.local ? readFileSync(join(siteRoot, page.local), 'utf8') : readDoc(page.source);
  if (page.local) {
    const m = LAST_UPDATED.exec(md);
    if (!m) throw new Error(`${page.local}: no "**Last updated:**" line`);
    ctx.updated = m[1].trim();
    md = md.replace(LAST_UPDATED, '');
  }
  let body = convert(md, ctx);
  if (page.extra) {
    const marker = `<h2 id="${page.extra.before}">`;
    if (!body.includes(marker)) throw new Error(`${page.source}: no heading #${page.extra.before}`);
    const partial = readFileSync(join(siteRoot, page.extra.file), 'utf8').trim();
    body = body.replace(marker, partial + '\n' + marker);
    const at = ctx.toc.findIndex(t => t.id === page.extra.before);
    ctx.toc.splice(at, 0, page.extra.toc);
  }
  // A note shown above the document, such as what "earlier 1.0 text" and "1.0 final" mean.
  if (page.notice) body = readFileSync(join(siteRoot, page.notice), 'utf8').trim() + '\n' + body;
  writeFileSync(join(siteRoot, page.out), stampAssets(template(page, ctx, body, tocHtml(ctx.toc), page.out)));
  console.log(`${page.out}: ${ctx.toc.length} headings`);
}

// Search engines: every page. (A robots.txt here would be ignored: crawlers only read it
// at the domain root, which this project site doesn't own.)
const urls = ['', ...pages.map(p => p.out)];
writeFileSync(join(siteRoot, 'sitemap.xml'), `<?xml version="1.0" encoding="UTF-8"?>
<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">
${urls.map(u => `  <url><loc>${SITE}${u}</loc></url>`).join('\n')}
</urlset>
`);
console.log(`sitemap.xml: ${urls.length} pages`);

// The hand-written pages get the same fingerprints.
for (const file of ['index.html', '404.html']) {
  const path = join(siteRoot, file);
  writeFileSync(path, stampAssets(readFileSync(path, 'utf8')));
}
console.log('asset links fingerprinted');
