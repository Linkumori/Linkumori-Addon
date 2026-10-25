// AdGuard → CLN converter page (converter.html). The conversion itself is in converter-core.js.
(function () {
  'use strict';
  const C = window.CLNConverter;
  const $ = (id) => document.getElementById(id);
  if (!C || !$('cv-sources')) return;

  const framed = (() => { try { return window.self !== window.top; } catch (e) { return true; } })();
  let lastResult = null;
  let reportFilter = 'problems';

  function esc(s) { return String(s).replace(/[&<>"]/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c])); }
  function setMsg(el, kind, text) {
    el.className = 'tool-msg cv-msg' + (kind ? ' is-' + kind : '');
    el.textContent = text;
    el.hidden = !text;
  }

  // ---- Preprocessor target
  Object.entries(C.PROFILES).forEach(([key, p]) => {
    const o = document.createElement('option');
    o.value = key; o.textContent = p.label;
    $('cv-profile').appendChild(o);
  });
  function syncProfile() {
    const p = C.PROFILES[$('cv-profile').value];
    $('cv-profile-hint').textContent = p.hint + (p.tokens.length ? ' True: ' + p.tokens.join(', ') + '.' : '');
    $('cv-tokens').hidden = $('cv-profile').value !== 'custom';
  }
  $('cv-profile').addEventListener('change', () => { syncProfile(); autoConvert(); });
  syncProfile();

  if (framed) $('cv-download').hidden = true;

  // ---- Source lists
  // List addresses the person typed, remembered in this browser only (no built-in addresses).
  const STORE_KEY = 'linkumori-converter-list-urls';
  function loadSavedUrls() {
    try {
      const v = JSON.parse(localStorage.getItem(STORE_KEY) || '[]');
      return Array.isArray(v) ? v.filter(u => typeof u === 'string') : [];
    } catch (e) { return []; }
  }
  function saveUrls() {
    try { localStorage.setItem(STORE_KEY, JSON.stringify(sources.map(s => s.url.value.trim()).filter(Boolean))); }
    catch (e) { /* storage unavailable */ }
  }

  const sources = [];
  let sourceSeq = 0;
  function lineCount(t) { return t ? t.split(/\r?\n/).length : 0; }
  function listTitle(text) { const m = String(text).match(/^﻿?!\s*Title:\s*(.+)$/mi); return m ? m[1].trim() : ''; }
  function sourcesChanged() {
    const loaded = sources.filter(s => s.ta.value.trim());
    const lines = loaded.reduce((n, s) => n + lineCount(s.ta.value), 0);
    setMsg($('cv-convert-msg'), '', loaded.length
      ? loaded.length + ' list' + (loaded.length === 1 ? '' : 's') + ', ' + lines.toLocaleString() + ' lines ready.'
      : 'Load a list first.');
  }

  async function fetchText(url) {
    const res = await fetch(url, { cache: 'no-store' });
    if (!res.ok) throw new Error('HTTP ' + res.status);
    return await res.text();
  }

  function addSource(url) {
    const id = ++sourceSeq;
    const box = document.createElement('div');
    box.className = 'cv-source';
    box.innerHTML =
      '<div class="cv-source-head"><span class="cv-source-name"></span><span class="cv-source-actions">' +
      '<button type="button" class="link-btn cv-fetch">Fetch</button>' +
      '<button type="button" class="link-btn cv-remove" aria-label="Remove this list">Remove</button></span></div>' +
      '<label class="tool-label" for="cv-url-' + id + '">List address</label>' +
      '<input id="cv-url-' + id + '" class="cv-input" type="url" spellcheck="false" autocomplete="off" placeholder="https://…/filter.txt">' +
      '<div class="code-field cv-list-field">' +
        '<div class="code-field-bar"><label for="cv-text-' + id + '">Or paste the list</label>' +
        '<label class="link-btn cv-file-btn">Choose file<input type="file" class="visually-hidden" accept=".txt,text/plain"></label></div>' +
        '<textarea id="cv-text-' + id + '" class="cv-list" spellcheck="false" autocapitalize="off" autocomplete="off" wrap="off" placeholder="Paste or drop a .txt file"></textarea>' +
      '</div>' +
      '<span class="cv-hint cv-list-hint">The address is still used for metadata and <code>!#include</code>.</span>' +
      '<p class="tool-msg cv-msg" role="status" aria-live="polite" hidden></p>';
    const s = {
      box, url: box.querySelector('input[type=url]'), ta: box.querySelector('textarea'),
      nameEl: box.querySelector('.cv-source-name'), st: box.querySelector('.cv-msg'), fetchBtn: box.querySelector('.cv-fetch')
    };
    if (url) s.url.value = url;
    s.setName = () => { s.nameEl.textContent = listTitle(s.ta.value) || ('List ' + (sources.indexOf(s) + 1)); };
    s.status = (kind, text) => setMsg(s.st, kind, text);
    s.ta.addEventListener('input', () => { s.setName(); sourcesChanged(); });
    s.url.addEventListener('input', saveUrls);
    s.fetch = async () => {
      const u = s.url.value.trim();
      if (!u) { s.status('err', 'Enter an address first.'); return false; }
      s.fetchBtn.disabled = true; s.status('busy', 'Fetching…');
      try {
        const text = await fetchText(u);
        s.ta.value = text; s.setName(); sourcesChanged();
        s.status('ok', 'Loaded ' + lineCount(text).toLocaleString() + ' lines.');
        return true;
      } catch (e) {
        s.status('err', 'Could not fetch this list (' + (e.message || e) + '). ' +
          (framed ? 'This page is not allowed to reach other sites. ' : '') +
          'Open the address in a new tab, select all and paste it into this box, or save it and drop the file here.');
        return false;
      } finally { s.fetchBtn.disabled = false; }
    };
    s.fetchBtn.addEventListener('click', async () => { if (await s.fetch()) run(); });
    box.querySelector('.cv-remove').addEventListener('click', () => {
      sources.splice(sources.indexOf(s), 1); box.remove();
      sources.forEach(x => x.setName()); sourcesChanged(); saveUrls(); autoConvert();
      if (!sources.length) addSource();
    });
    const loadFile = (file) => {
      if (!file) return;
      const r = new FileReader();
      r.onload = () => {
        s.ta.value = String(r.result); s.setName(); sourcesChanged();
        s.status('ok', 'Loaded ' + lineCount(s.ta.value).toLocaleString() + ' lines from ' + file.name + '.');
        run();
      };
      r.onerror = () => s.status('err', 'Could not read ' + file.name + '.');
      r.readAsText(file);
    };
    box.querySelector('input[type=file]').addEventListener('change', (e) => loadFile(e.target.files[0]));
    ['dragenter', 'dragover'].forEach(ev => box.addEventListener(ev, (e) => { e.preventDefault(); box.classList.add('is-over'); }));
    ['dragleave', 'drop'].forEach(ev => box.addEventListener(ev, () => box.classList.remove('is-over')));
    box.addEventListener('drop', (e) => { e.preventDefault(); if (e.dataTransfer.files[0]) loadFile(e.dataTransfer.files[0]); });
    sources.push(s); $('cv-sources').appendChild(box); s.setName(); sourcesChanged();
    return s;
  }

  $('cv-add').addEventListener('click', () => addSource().url.focus());
  $('cv-fetch-all').addEventListener('click', async () => {
    $('cv-fetch-all').disabled = true;
    try {
      const results = await Promise.all(sources.filter(s => s.url.value.trim()).map(s => s.fetch()));
      if (results.some(Boolean)) await run();
    } finally { $('cv-fetch-all').disabled = false; }
  });
  const savedUrls = loadSavedUrls();
  if (savedUrls.length) savedUrls.forEach(u => addSource(u)); else addSource();

  // ---- Convert
  function options() {
    return {
      profile: $('cv-profile').value, customTokens: $('cv-tokens').value,
      docExceptions: $('cv-docexc').checked,
      important: $('cv-important').value, annotate: $('cv-annotate').checked, metadata: $('cv-meta').checked,
      followIncludes: $('cv-includes').checked, fetchText,
      layout: $('cv-layout').value, keyPrefix: $('cv-key').value, hoistExceptions: $('cv-hoist').checked
    };
  }
  let running = false;
  async function run() {
    const input = sources.filter(s => s.ta.value.trim()).map(s => ({ text: s.ta.value, url: s.url.value.trim() }));
    if (!input.length) { setMsg($('cv-convert-msg'), 'err', 'Load a list first.'); return; }
    if (running) return;
    running = true;
    $('cv-convert').disabled = true;
    setMsg($('cv-convert-msg'), 'busy', 'Converting…');
    try {
      lastResult = await C.convert(input, options());
      render();
      setMsg($('cv-convert-msg'), 'ok', 'Done. Changing an option converts again.');
    } catch (e) {
      setMsg($('cv-convert-msg'), 'err', 'Conversion failed: ' + (e.message || e));
    } finally { running = false; $('cv-convert').disabled = false; }
  }
  let timer = null;
  function autoConvert() { if (!lastResult) return; clearTimeout(timer); timer = setTimeout(run, 250); }
  $('cv-convert').addEventListener('click', run);
  ['cv-key', 'cv-tokens'].forEach(id => $(id).addEventListener('input', autoConvert));
  ['cv-layout', 'cv-hoist', 'cv-includes', 'cv-docexc', 'cv-annotate', 'cv-meta', 'cv-important']
    .forEach(id => $(id).addEventListener('change', autoConvert));
  function syncLayout() {
    $('cv-global-name').textContent = $('cv-key').value.trim() + 'global';
    $('cv-hoist').disabled = $('cv-layout').value !== 'site';
  }
  $('cv-layout').addEventListener('change', syncLayout);
  $('cv-key').addEventListener('input', syncLayout);
  syncLayout();
  $('cv-format').addEventListener('change', () => lastResult && renderOutput());

  // ---- Results
  function stat(n, label, cls) {
    return '<div class="cv-stat' + (cls ? ' ' + cls : '') + '"><dd>' + Number(n).toLocaleString() + '</dd><dt>' + label + '</dt></div>';
  }
  function outputText() { return $('cv-format').value === 'compact' ? lastResult.compactJson : lastResult.json; }
  function renderOutput() {
    const t = outputText();
    $('cv-out').value = t;
    const n = lastResult.stats.providers;
    $('cv-size').textContent = (new Blob([t]).size / 1024).toFixed(0) + ' KB · ' + n + ' provider' + (n === 1 ? '' : 's');
  }
  function render() {
    const s = lastResult.stats;
    $('cv-stats').innerHTML =
      stat(s.converted, 'filters converted', 'is-good') +
      stat(s.exceptions, '<code>@@</code> exceptions', 'is-good') +
      stat(s.providers, s.providers === 1 ? 'provider' : 'providers') +
      (s.providers > 1 ? stat(s.globalFilters, 'filters for every site') : '') +
      stat(s.skipped, 'skipped', s.skipped ? 'is-warn' : '') +
      stat(s.notes, 'converted with a note') +
      stat(s.excluded, 'excluded by <code>!#if</code>') +
      stat(s.duplicates, 'duplicates merged');
    renderOutput();
    [['cv-results', 'cv-results-empty'], ['cv-report', 'cv-report-empty'], ['cv-test', 'cv-test-empty']].forEach(([show, hide]) => {
      $(show).hidden = false; $(hide).hidden = true;
    });
    renderFilters(); renderReport(); runTest();
  }

  // ---- Report
  const GROUPS = {
    problems: { label: 'Skipped and warnings', match: r => r.status === 'skipped' || r.status === 'warning' },
    note: { label: 'Notes', match: r => r.status === 'note' },
    excluded: { label: 'Excluded by !#if', match: r => r.status === 'excluded' },
    duplicate: { label: 'Duplicates', match: r => r.status === 'duplicate' },
    info: { label: 'Info', match: r => r.status === 'info' },
    all: { label: 'All', match: () => true }
  };
  function renderFilters() {
    const rep = lastResult.report;
    $('cv-filters').innerHTML = '';
    Object.entries(GROUPS).forEach(([key, g]) => {
      const n = rep.filter(g.match).length;
      if (!n && key !== 'problems' && key !== 'all') return;
      const b = document.createElement('button');
      b.type = 'button';
      b.setAttribute('aria-pressed', String(key === reportFilter));
      b.innerHTML = esc(g.label) + ' <span class="cv-count">' + n.toLocaleString() + '</span>';
      b.addEventListener('click', () => { reportFilter = key; renderFilters(); renderReport(); });
      $('cv-filters').appendChild(b);
    });
  }
  function renderReport() {
    const q = $('cv-search').value.trim().toLowerCase();
    const rows = lastResult.report.filter(GROUPS[reportFilter].match)
      .filter(r => !q || (r.text + ' ' + r.message + ' ' + (r.output || '')).toLowerCase().includes(q));
    const LIMIT = 800;
    $('cv-report-body').innerHTML = rows.length ? rows.slice(0, LIMIT).map(r =>
      '<tr><td class="cv-line">' + esc(r.file) + ':' + r.line + '</td>' +
      '<td><span class="cv-badge cv-b-' + r.status + '">' + r.status + '</span></td>' +
      '<td>' + esc(r.message) + (r.output ? '<code class="cv-output">→ ' + esc(r.output) + '</code>' : '') + '</td>' +
      '<td><code>' + esc(r.text.length > 240 ? r.text.slice(0, 240) + '…' : r.text) + '</code></td></tr>').join('')
      : '<tr><td colspan="4" class="cv-none">Nothing here' + (reportFilter === 'problems' && !q ? ': every rule converted.' : '.') + '</td></tr>';
    $('cv-report-more').textContent = rows.length > LIMIT
      ? 'Showing the first ' + LIMIT + ' of ' + rows.length.toLocaleString() + '. Search to narrow it down.' : '';
  }
  $('cv-search').addEventListener('input', () => lastResult && renderReport());

  // ---- Copy and download
  function flash(btn, text) { const old = btn.textContent; btn.textContent = text; setTimeout(() => { btn.textContent = old; }, 1600); }
  $('cv-copy').addEventListener('click', async () => {
    try { await navigator.clipboard.writeText(outputText()); flash($('cv-copy'), 'Copied'); }
    catch (e) { $('cv-out').focus(); $('cv-out').select(); flash($('cv-copy'), 'Press Ctrl/⌘+C'); }
  });
  $('cv-download').addEventListener('click', () => {
    const blob = new Blob([outputText()], { type: 'application/json' });
    const a = document.createElement('a');
    const used = lastResult.sources || [];
    const srcName = used.length === 1 ? (used[0].url.split('/').pop() || '').replace(/\.txt$/i, '') : (used.length > 1 ? 'merged' : '');
    let base;
    try { base = decodeURIComponent(srcName); } catch (e) { base = srcName; }
    base = (base || 'rules').replace(/[^A-Za-z0-9._-]+/g, '-');
    a.href = URL.createObjectURL(blob); a.download = base + '.cln.json';
    document.body.appendChild(a); a.click(); a.remove();
    setTimeout(() => URL.revokeObjectURL(a.href), 2000);
  });

  // ---- Try a URL
  function runTest() {
    if (!lastResult) return;
    const out = $('cv-test-out');
    if (!$('cv-test-url').value.trim()) { out.innerHTML = ''; return; }
    const res = C.simulate($('cv-test-url').value, lastResult.providers, lastResult.fileExceptions);
    if (res.error) { out.innerHTML = '<p class="tool-msg err">' + esc(res.error) + '</p>'; return; }
    const rows = res.rows.map(r =>
      '<tr><td><code>' + esc(r.name) + '</code></td><td><code>' + esc(r.value) + '</code></td>' +
      '<td><span class="cv-badge ' + (r.action === 'removed' ? 'cv-b-removed' : 'cv-b-kept') + '">' + esc(r.action) + '</span></td>' +
      '<td>' + (r.by ? '<code>' + esc(r.by.ruleText) + '</code> <span class="muted">(' + esc(r.by.providerKey) + ' · line ' + r.by.ref.line + ')</span>' : '<span class="muted">—</span>') + '</td></tr>').join('');
    const passes = res.steps.length
      ? '<p class="tool-msg">' + res.steps.length + ' pass' + (res.steps.length === 1 ? '' : 'es') + ': ' + res.steps.map(s => esc(s.provider)).join(' → ') + '</p>'
      : '';
    out.innerHTML = '<div class="sim-final"><p class="sim-result"><b>Result</b></p><code class="sim-url">' + res.result.split(/(?=[\/?&;#])/).map(esc).join('<wbr>') + '</code></div>' + passes +
      (res.rows.length
        ? '<div class="table-wrap cv-test-wrap"><table class="cv-table"><thead><tr><th scope="col">Parameter</th><th scope="col">Value</th><th scope="col">Result</th><th scope="col">Rule</th></tr></thead><tbody>' + rows + '</tbody></table></div>'
        : '<p class="tool-msg">The URL has no query parameters.</p>');
  }
  $('cv-test-form').addEventListener('submit', (e) => { e.preventDefault(); runTest(); });
})();
