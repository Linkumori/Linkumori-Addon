#!/usr/bin/env node
// Renders the Mermaid diagrams in the docs to SVG, in a light and a dark version, so the
// site shows them without loading Mermaid from another host. build-docs.mjs swaps each
// ```mermaid block for the two images, found by a hash of the block's source.
//
//   MMDC=/path/to/mmdc node scripts/make-diagrams.mjs            # docs from `git show main:docs/…`
//   MMDC=/path/to/mmdc node scripts/make-diagrams.mjs ../docs    # docs from a folder
//
// mmdc is @mermaid-js/mermaid-cli. It drives a Chromium browser: set BROWSER to one
// (Microsoft Edge on macOS is used by default).

import { execFileSync } from 'node:child_process';
import { mkdtempSync, readdirSync, readFileSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { diagramHash, DIAGRAM_DOCS, DIAGRAM_DIR, mermaidBlocks } from './diagrams.mjs';

const siteRoot = join(dirname(fileURLToPath(import.meta.url)), '..');
const docsDir = process.argv[2];
const mmdc = process.env.MMDC;
const browser = process.env.BROWSER || '/Applications/Microsoft Edge.app/Contents/MacOS/Microsoft Edge';
if (!mmdc) throw new Error('Set MMDC to the mmdc binary of @mermaid-js/mermaid-cli');

const FONT = '-apple-system, BlinkMacSystemFont, "SF Pro Text", "Helvetica Neue", Helvetica, Arial, sans-serif';

// The site's colour tokens (assets/style.css), light and dark.
const themes = {
  light: { bg: '#ffffff', tile: '#f5f5f7', text: '#1d1d1f', text2: '#616166', line: '#d2d2d7', edge: '#86868b', accent: '#2563eb', cluster: '#fbfbfd' },
  dark: { bg: '#000000', tile: '#1c1c1e', text: '#f5f5f7', text2: '#a1a1a6', line: '#38383c', edge: '#8e8e93', accent: '#3b82f6', cluster: '#101012' }
};

function config(t) {
  return {
    theme: 'base',
    fontFamily: FONT,
    themeVariables: {
      fontFamily: FONT,
      fontSize: '14px',
      background: 'transparent',
      primaryColor: t.tile,
      primaryBorderColor: t.line,
      primaryTextColor: t.text,
      secondaryColor: t.tile,
      tertiaryColor: t.cluster,
      lineColor: t.edge,
      textColor: t.text,
      clusterBkg: t.cluster,
      clusterBorder: t.line,
      titleColor: t.text2,
      edgeLabelBackground: t.bg,
      actorBkg: t.tile,
      actorBorder: t.line,
      actorTextColor: t.text,
      actorLineColor: t.line,
      signalColor: t.text,
      signalTextColor: t.text,
      labelBoxBkgColor: t.tile,
      labelBoxBorderColor: t.line,
      labelTextColor: t.text,
      loopTextColor: t.text2,
      noteBkgColor: t.cluster,
      noteBorderColor: t.line,
      noteTextColor: t.text,
      activationBkgColor: t.tile,
      activationBorderColor: t.accent
    },
    flowchart: { curve: 'basis', padding: 12, nodeSpacing: 36, rankSpacing: 44 },
    sequence: { mirrorActors: false, actorMargin: 40 }
  };
}

// mmdc writes width="100%", which an <img> reads as 300 pixels wide. Give the SVG
// its real size from the viewBox instead.
function setIntrinsicSize(path) {
  const svg = readFileSync(path, 'utf8');
  const root = /<svg\b[^>]*>/.exec(svg)[0];
  const [, , w, h] = /viewBox="([^"]+)"/.exec(root)[1].split(/\s+/).map(Number);
  const fixed = root.replace(/\swidth="[^"]*"/, '').replace(/max-width:\s*[\d.]+px;\s*/, '')
    .replace('<svg', `<svg width="${Math.ceil(w)}" height="${Math.ceil(h)}"`);
  writeFileSync(path, svg.replace(root, fixed));
}

function readDoc(name) {
  if (docsDir) return readFileSync(join(docsDir, name), 'utf8');
  return execFileSync('git', ['show', `main:docs/${name}`], { cwd: siteRoot, encoding: 'utf8' });
}

// mmdc runs in this folder, so it reads no package.json of the project.
const work = mkdtempSync(join(tmpdir(), 'linkumori-diagrams-'));
try {
  writeFileSync(join(work, 'puppeteer.json'), JSON.stringify({ executablePath: browser, headless: 'new' }));
  for (const [name, t] of Object.entries(themes)) writeFileSync(join(work, `${name}.json`), JSON.stringify(config(t)));

  const wanted = new Set();
  for (const doc of DIAGRAM_DOCS) {
    for (const source of mermaidBlocks(readDoc(doc))) {
      const hash = diagramHash(source);
      writeFileSync(join(work, `${hash}.mmd`), source);
      for (const name of Object.keys(themes)) {
        const file = `${hash}-${name}.svg`;
        wanted.add(file);
        execFileSync(mmdc, ['-q', '-p', join(work, 'puppeteer.json'), '-c', join(work, `${name}.json`),
          '-b', 'transparent', '-i', join(work, `${hash}.mmd`), '-o', join(siteRoot, DIAGRAM_DIR, file)], { cwd: work });
      }
      for (const name of Object.keys(themes)) setIntrinsicSize(join(siteRoot, DIAGRAM_DIR, `${hash}-${name}.svg`));
      console.log(`${doc}: ${hash}`);
    }
  }
  // Drop renders of diagrams the docs no longer have.
  for (const file of readdirSync(join(siteRoot, DIAGRAM_DIR))) {
    if (file.endsWith('.svg') && !wanted.has(file)) rmSync(join(siteRoot, DIAGRAM_DIR, file));
  }
} finally {
  rmSync(work, { recursive: true, force: true });
}
