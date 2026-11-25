/* Rules editor: open, filter, check and edit CLN 1.0 rule files in JSON or YAML.
 * Uses window.LinkumoriEditor (code-editor.js, our own editor) and window.LinkumoriYAML
 * (yaml.js, the bundled `yaml` package). */
(() => {
  'use strict';
  const $ = id => document.getElementById(id);
  const root = $('re-root');
  if (!root || !window.LinkumoriEditor || !window.LinkumoriYAML) return;
  const { createEditor } = window.LinkumoriEditor;
  const YAML = window.LinkumoriYAML;

  const DRAFT_KEY = 'linkumori-rules-editor-draft';
  // Rule files the "Load" buttons fetch, from the page: data-bundled='[{"label": "…", "url": "…"}]'.
  // The website and the copy in the main repository (tools/rules-editor/) point at different files.
  let BUNDLED = [];
  try { BUNDLED = JSON.parse(root.dataset.bundled || '[]'); } catch { /* none */ }

  // ---- CLN 1.0 vocabulary (filter-syntax.md) ----
  const TOP_KEYS = new Set(['cln', 'metadata', 'providers', 'defaults', 'patches', 'ruleSets']);
  const LIST_KEYS = ['rules', 'referralMarketing', 'rawRules', 'exceptions', 'redirections', 'fieldRedirections'];
  const BOOL_KEYS = ['completeProvider', 'forceRedirection', 'historyBypassProtection', 'active'];
  const PROVIDER_KEYS = new Set([...LIST_KEYS, ...BOOL_KEYS, 'domainPatterns', 'urlPattern', 'indexPattern', 'methods', 'resourceTypes']);
  const RULE_KEYS = new Set(['matchPattern', 'id', 'aliases', 'replacePattern', 'preprocessors', 'requestTypes', 'exceptions',
    'order', 'referralMarketing', 'active', 'flags', 'historyBypassProtection', 'description', 'targetId']);
  const PATTERN_KEYS = ['domainPatterns', 'urlPattern', 'indexPattern'];

  // ---- state ----
  const state = {
    format: 'json',
    view: 'full',          // 'full' | 'filter'
    fullText: '',          // the full document while the filtered view is on screen
    filterKeys: [],        // provider keys shown in the filtered view
    trimmed: false,        // filtered view hides non-matching rules (read-only)
    fileName: 'linkumori-rules',
    loadedText: null,      // text as last loaded, to warn before replacing edits and to diff patches against
    loadedFormat: 'json'
  };

  // ---- parsing ----
  function parse(text, format) {
    return format === 'json' ? JSON.parse(text) : YAML.parse(text);
  }
  function serialize(obj, format) {
    return format === 'json' ? JSON.stringify(obj, null, 2) + '\n' : YAML.stringify(obj, { lineWidth: 0 });
  }
  function detectFormat(text, name = '') {
    if (/\.ya?ml$/i.test(name)) return 'yaml';
    if (/\.json$/i.test(name)) return 'json';
    return /^\s*[{[]/.test(text) ? 'json' : 'yaml';
  }
  // Offset of a JSON.parse error, from either V8's or Firefox's message.
  function jsonErrorPos(err, text) {
    const m = /position (\d+)/.exec(err.message);
    if (m) return Math.min(Number(m[1]), text.length);
    const lc = /line (\d+) column (\d+)/.exec(err.message);
    if (lc) {
      const lines = text.split('\n');
      let pos = 0;
      for (let i = 0; i < Number(lc[1]) - 1 && i < lines.length; i++) pos += lines[i].length + 1;
      return Math.min(pos + Number(lc[2]) - 1, text.length);
    }
    return jsonScanPos(text);
  }
  // Newer Chrome messages carry no offset, so find the first bad character ourselves.
  function jsonScanPos(text) {
    let i = 0;
    const fail = () => { throw i; };
    const ws = () => { while (i < text.length && ' \t\n\r'.includes(text[i])) i++; };
    const lit = w => { if (text.startsWith(w, i)) i += w.length; else fail(); };
    function str() {
      i++;
      while (i < text.length && text[i] !== '"') {
        if (text[i] === '\\') { i++; if (text[i] === 'u') { if (!/^[0-9a-f]{4}$/i.test(text.slice(i + 1, i + 5))) fail(); i += 4; } else if (!'"\\/bfnrt'.includes(text[i])) fail(); }
        else if (text.charCodeAt(i) < 0x20) fail();
        i++;
      }
      if (i >= text.length) fail();
      i++;
    }
    function value() {
      ws();
      const c = text[i];
      if (c === '{') {
        i++; ws();
        if (text[i] === '}') { i++; return; }
        for (;;) { ws(); if (text[i] !== '"') fail(); str(); ws(); if (text[i] !== ':') fail(); i++; value(); ws();
          if (text[i] === ',') { i++; continue; } if (text[i] === '}') { i++; return; } fail(); }
      }
      if (c === '[') {
        i++; ws();
        if (text[i] === ']') { i++; return; }
        for (;;) { value(); ws(); if (text[i] === ',') { i++; continue; } if (text[i] === ']') { i++; return; } fail(); }
      }
      if (c === '"') return str();
      if (c === 't') return lit('true');
      if (c === 'f') return lit('false');
      if (c === 'n') return lit('null');
      const m = /^-?(?:0|[1-9]\d*)(?:\.\d+)?(?:[eE][+-]?\d+)?/.exec(text.slice(i, i + 64));
      if (!m) fail();
      i += m[0].length;
    }
    try { value(); ws(); return i < text.length ? i : 0; } catch (pos) { return Math.min(typeof pos === 'number' ? pos : 0, text.length); }
  }

  // ---- linting ----
  const lintState = { ruleSetNames: new Set() };
  const isMap = YAML.isMap, isSeq = YAML.isSeq, isScalar = YAML.isScalar;
  function pairs(node) { return isMap(node) ? node.items : []; }
  function keyOf(pair) { return isScalar(pair.key) ? String(pair.key.value) : String(pair.key); }
  function rangeOf(node, fallback) {
    const r = node && node.range;
    return r ? { from: r[0], to: Math.max(r[0], r[1]) } : fallback;
  }
  function typeName(node) {
    if (isMap(node)) return 'an object';
    if (isSeq(node)) return 'an array';
    if (isScalar(node)) return node.value === null ? 'null' : `a ${typeof node.value}`;
    return 'empty';
  }
  function regexError(source, flags = '') {
    try { new RegExp(source, flags.replace(/[^dgimsuyv]/g, '')); return null; } catch (e) { return e.message; }
  }
  // The /regex/flags value of a $removeparam filter, if it has one.
  function removeparamRegex(text) {
    const i = text.indexOf('$removeparam=/');
    if (i < 0) return null;
    const value = text.slice(i + 14);
    for (let end = value.length - 1; end > 0; end--) {
      if (value[end] !== '/' || value[end - 1] === '\\') continue;
      const rest = value.slice(end + 1);
      const m = /^([a-z]*)(?:,|$)/.exec(rest);
      if (m) return { source: value.slice(0, end), flags: m[1] };
    }
    return null;
  }

  function lint(text) {
    const out = [];
    const format = state.format;
    if (!text.trim()) return { diagnostics: out, providers: 0 };
    if (format === 'json') {
      try { JSON.parse(text); } catch (e) {
        const at = jsonErrorPos(e, text);
        out.push({ from: at, to: Math.min(at + 1, text.length), severity: 'error', message: `JSON: ${e.message}` });
        return { diagnostics: out, providers: 0 };
      }
    }
    // JSON is valid YAML, so one AST (with source ranges) serves both formats.
    const doc = YAML.parseDocument(text, { prettyErrors: false, uniqueKeys: true });
    for (const e of doc.errors) {
      out.push({ from: e.pos[0], to: Math.max(e.pos[0] + 1, e.pos[1]), severity: 'error', message: `YAML: ${e.message.split('\n')[0]}` });
    }
    if (doc.errors.length) return { diagnostics: out, providers: 0 };
    const whole = { from: 0, to: Math.min(text.length, 1) };
    const add = (node, severity, message, fb = whole) => out.push({ ...rangeOf(node, fb), severity, message });

    const top = doc.contents;
    if (!isMap(top)) { add(top, 'error', 'A rule file must be one object with a "providers" object.'); return { diagnostics: out, providers: 0 }; }
    let providersNode = null, ruleSetsNode = null;
    for (const p of pairs(top)) {
      const k = keyOf(p);
      if (!TOP_KEYS.has(k)) add(p.key, 'warning', `Unknown top-level key "${k}". Known: ${[...TOP_KEYS].join(', ')}.`);
      if (k === 'cln' && !(isScalar(p.value) && String(p.value.value) === '1.0')) add(p.value, 'error', '"cln" must be the string "1.0".');
      if (k === 'providers') providersNode = p;
      if (k === 'ruleSets') ruleSetsNode = p;
    }
    // Shared rule sets (expanded by the CLI, see docs/cln-yaml.md): each set
    // is a list of ordinary entries; providers use them with { include: name }.
    const ruleSetNames = new Set();
    if (ruleSetsNode) {
      if (!isMap(ruleSetsNode.value)) add(ruleSetsNode.value || ruleSetsNode.key, 'error', '"ruleSets" must be an object of named lists.');
      for (const set of pairs(ruleSetsNode.value)) {
        const setName = keyOf(set);
        if (!/^[a-z0-9][a-z0-9_-]*$/.test(setName)) add(set.key, 'error', `Rule set name "${setName}" must use lowercase letters, digits, - and _.`);
        if (!isSeq(set.value) || set.value.items.length === 0) { add(set.value || set.key, 'error', `Rule set "${setName}" must be a non-empty list.`); continue; }
        ruleSetNames.add(setName);
        const seenInSet = new Map();
        for (const entry of set.value.items) {
          if (isMap(entry) && pairs(entry).some(p => keyOf(p) === 'include')) { add(entry, 'error', `Rule set "${setName}" cannot include another set.`); continue; }
          lintEntry(entry, `ruleSets.${setName}`, 'rules', seenInSet, add);
        }
      }
    }
    lintState.ruleSetNames = ruleSetNames;
    if (!providersNode) { add(top, 'error', 'Missing the "providers" object.'); return { diagnostics: out, providers: 0 }; }
    if (!isMap(providersNode.value)) { add(providersNode.value || providersNode.key, 'error', '"providers" must be an object.'); return { diagnostics: out, providers: 0 }; }

    let count = 0;
    for (const prov of pairs(providersNode.value)) {
      count++;
      const name = keyOf(prov);
      const where = rangeOf(prov.key, whole);
      if (!isMap(prov.value)) { add(prov.value || prov.key, 'error', `Provider "${name}" must be an object.`, where); continue; }
      const seen = new Map();
      let hasDomain = false, hasUrl = false;
      for (const field of pairs(prov.value)) {
        const k = keyOf(field), v = field.value;
        if (!PROVIDER_KEYS.has(k)) { add(field.key, 'warning', `"${name}": unknown provider key "${k}".`); continue; }
        if (k === 'domainPatterns') hasDomain = true;
        if (k === 'urlPattern') {
          hasUrl = true;
          if (!isScalar(v) || typeof v.value !== 'string') add(v || field.key, 'error', `"${name}": urlPattern must be a string.`);
          else { const err = regexError(v.value, 'i'); if (err) add(v, 'error', `"${name}": urlPattern is not a valid regex: ${err}`); }
        }
        if (BOOL_KEYS.includes(k) && !(isScalar(v) && typeof v.value === 'boolean')) add(v || field.key, 'error', `"${name}": ${k} must be true or false, not ${typeName(v)}.`);
        if (['methods', 'resourceTypes'].includes(k) && !isSeq(v)) add(v || field.key, 'error', `"${name}": ${k} must be an array.`);
        if (!LIST_KEYS.includes(k)) continue;
        if (!isSeq(v)) { add(v || field.key, 'error', `"${name}": ${k} must be an array, not ${typeName(v)}.`); continue; }
        for (const entry of v.items) lintEntry(entry, name, k, seen, add);
      }
      if (hasDomain && hasUrl) add(prov.key, 'warning', `"${name}" sets both domainPatterns and urlPattern. Use one.`);
      if (!hasDomain && !hasUrl) add(prov.key, 'warning', `"${name}" has no domainPatterns or urlPattern, so it matches nothing.`);
    }
    return { diagnostics: out, providers: count };
  }

  function lintEntry(entry, name, list, seen, add) {
    let pattern = null, patternNode = entry;
    if (isMap(entry) && pairs(entry).some(p => keyOf(p) === 'include')) {
      // { include: <set> } stands for a shared rule set's entries.
      const keys = pairs(entry).map(keyOf);
      if (keys.length !== 1) add(entry, 'error', `"${name}": an include entry has only the "include" key.`);
      const includeNode = pairs(entry).find(p => keyOf(p) === 'include').value;
      const setName = isScalar(includeNode) ? String(includeNode.value ?? '') : '';
      if (!setName) add(includeNode || entry, 'error', `"${name}": "include" must name a rule set.`);
      else if (!lintState.ruleSetNames.has(setName)) add(includeNode, 'error', `"${name}": no rule set named "${setName}".`);
      return;
    }
    if (isScalar(entry)) {
      if (typeof entry.value !== 'string') { add(entry, 'error', `"${name}": ${list} entries must be strings or rule objects.`); return; }
      pattern = entry.value;
    } else if (isMap(entry)) {
      for (const p of pairs(entry)) {
        const k = keyOf(p);
        if (!RULE_KEYS.has(k)) add(p.key, 'warning', `"${name}": unknown rule key "${k}".`);
        if (k === 'matchPattern') { patternNode = p.value; pattern = isScalar(p.value) ? String(p.value.value ?? '') : null; }
        if (k === 'id') {
          const id = isScalar(p.value) ? String(p.value.value) : '';
          if (!/^[\w-]+$/.test(id)) add(p.value, 'warning', `"${name}": rule id "${id}" should use only letters, digits, - and _.`);
          if (seen.has(id)) add(p.value, 'warning', `"${name}": rule id "${id}" is used twice in this provider.`);
          seen.set(id, true);
        }
      }
      if (pattern === null) { add(entry, 'error', `"${name}": rule object in ${list} has no matchPattern.`); return; }
    } else { add(entry, 'error', `"${name}": ${list} entries must be strings or rule objects.`); return; }
    if (!pattern) { add(patternNode, 'error', `"${name}": empty matchPattern in ${list}.`); return; }
    if (list === 'rawRules' && !pattern.startsWith('@@')) {
      const err = regexError(pattern, 'gi');
      if (err) add(patternNode, 'error', `"${name}": raw rule is not a valid regex: ${err}`);
    }
    const rp = removeparamRegex(pattern);
    if (rp) { const err = regexError(rp.source, rp.flags); if (err) add(patternNode, 'error', `"${name}": $removeparam regex doesn't compile: ${err}`); }
  }

  // ---- UI: editor ----
  const problemsEl = $('re-problems');
  const statusEl = $('re-status');
  let lastLint = { diagnostics: [], providers: 0 };

  const editor = createEditor({
    parent: $('re-editor'),
    language: 'json',
    lint(text) {
      lastLint = lint(text);
      renderStatus();
      return lastLint.diagnostics;
    },
    onChange: () => { scheduleDraft(); scheduleFilter(); }
  });

  function lineOf(pos) { return editor.lineAt(pos); }

  let flash = { msg: '', until: 0 };
  function renderStatus(extra) {
    // A one-off message ("Applied", "Copied") stays for a few seconds, even when the linter re-renders.
    if (extra) flash = { msg: extra, until: Date.now() + 5000 };
    else if (Date.now() < flash.until) extra = flash.msg;
    const text = editor.getText();
    const errors = lastLint.diagnostics.filter(d => d.severity === 'error');
    const warnings = lastLint.diagnostics.filter(d => d.severity === 'warning');
    if (!text.trim()) { statusEl.textContent = extra || 'Load the bundled rules, open a file, or paste one in.'; statusEl.className = 're-status'; problemsEl.hidden = true; return; }
    const parts = [
      state.view === 'filter' ? `${state.filterKeys.length.toLocaleString()} of ${countFullProviders().toLocaleString()} providers` : `${lastLint.providers.toLocaleString()} providers`,
      `${editor.lineCount().toLocaleString()} lines`,
      state.format.toUpperCase(),
      errors.length ? `${errors.length} error${errors.length > 1 ? 's' : ''}` : 'no errors',
      `${warnings.length} warning${warnings.length === 1 ? '' : 's'}`
    ];
    if (state.trimmed) parts.push('read-only: trimmed view');
    statusEl.textContent = (extra ? extra + ' · ' : '') + parts.join(' · ');
    statusEl.className = 're-status' + (errors.length ? ' err' : warnings.length ? ' warn' : ' ok');
    const shown = lastLint.diagnostics.slice(0, 50);
    problemsEl.hidden = !shown.length;
    problemsEl.replaceChildren(...shown.map(d => {
      const li = document.createElement('li');
      const b = document.createElement('button');
      b.type = 'button';
      b.className = 're-problem ' + d.severity;
      const ln = document.createElement('span');
      ln.className = 're-line';
      ln.textContent = `Line ${lineOf(d.from)}`;
      b.append(ln, document.createTextNode(d.message));
      b.addEventListener('click', () => editor.goTo(d.from));
      li.append(b);
      return li;
    }));
    if (lastLint.diagnostics.length > shown.length) {
      const li = document.createElement('li');
      li.className = 're-more';
      li.textContent = `…and ${lastLint.diagnostics.length - shown.length} more. Look for the marked line numbers.`;
      problemsEl.append(li);
    }
  }

  let fullCountCache = { text: null, n: 0 };
  function countFullProviders() {
    if (fullCountCache.text !== state.fullText) {
      try { fullCountCache = { text: state.fullText, n: Object.keys(parse(state.fullText, state.format).providers || {}).length }; }
      catch { fullCountCache = { text: state.fullText, n: 0 }; }
    }
    return fullCountCache.n;
  }

  function currentFullText() { return state.view === 'full' ? editor.getText() : state.fullText; }

  // ---- format ----
  const segButtons = [...root.querySelectorAll('.re-seg button')];
  function setFormatUI(format) {
    state.format = format;
    for (const b of segButtons) b.setAttribute('aria-checked', String(b.dataset.format === format));
    editor.setLanguage(format);
  }
  function convertTo(format) {
    if (format === state.format) return;
    // Nothing to convert yet: just switch, so a file can be pasted in the chosen format.
    if (!currentFullText().trim()) { setFormatUI(format); editor.relint(); renderStatus(`Format: ${format.toUpperCase()}`); return; }
    try {
      const full = serialize(parse(currentFullText(), state.format), format);
      const filtered = state.view === 'filter';
      const shown = filtered ? serialize(parse(editor.getText(), state.format), format) : full;
      const unedited = filtered && editor.getText() === state.filteredOriginal;
      state.fullText = full;
      setFormatUI(format);
      editor.setText(shown);
      // Converting is not an edit: leaving the filtered view afterwards shouldn't warn.
      if (unedited) state.filteredOriginal = editor.getText();
      renderStatus(`Converted to ${format.toUpperCase()}`);
    } catch (e) {
      renderStatus(`Can't convert: fix the ${state.format.toUpperCase()} errors first`);
    }
  }
  for (const b of segButtons) b.addEventListener('click', () => convertTo(b.dataset.format));

  $('re-pretty').addEventListener('click', () => {
    try { editor.setText(serialize(parse(editor.getText(), state.format), state.format)); renderStatus('Formatted'); }
    catch { renderStatus('Can\'t format: fix the errors first'); }
  });

  // ---- loading ----
  function loadText(text, format, name) {
    showFull(false);
    setFormatUI(format);
    let shown = text;
    // The bundled JSON is written one provider per line; spread it out for editing.
    if (format === 'json') { try { shown = serialize(JSON.parse(text), 'json'); } catch { /* keep as is, the linter shows why */ } }
    state.fileName = (name || 'linkumori-rules').replace(/\.(json|ya?ml)$/i, '');
    state.loadedText = shown;
    state.loadedFormat = format;
    editor.setText(shown);
    renderStatus(`Opened ${name || 'new file'}`);
    scheduleFilter();
  }
  function confirmReplace() {
    const text = currentFullText();
    return !text.trim() || text === state.loadedText || confirm('Replace the current document? Your edits will be lost.');
  }

  const loadButtons = BUNDLED.map((src, i) => {
    const b = document.createElement('button');
    b.type = 'button';
    b.className = i === 0 ? 'btn btn-primary btn-sm' : 'link-btn';
    b.textContent = src.label || 'Load bundled rules';
    b.addEventListener('click', async () => {
      if (!confirmReplace()) return;
      const name = src.url.split('/').pop();
      renderStatus(`Loading ${name}…`);
      try {
        const res = await fetch(src.url, { cache: 'no-cache' });
        if (!res.ok) throw new Error(`HTTP ${res.status}`);
        const text = await res.text();
        loadText(text, detectFormat(text, name), name);
      } catch (e) {
        renderStatus(location.protocol === 'file:'
          ? `Browsers block loading ${name} from a file:// page. Use Open file…, or serve the repository folder (see the README).`
          : `Couldn't load ${name} (${e.message})`);
      }
    });
    return b;
  });
  $('re-file-group').prepend(...loadButtons);

  $('re-open').addEventListener('change', async e => {
    const file = e.target.files[0];
    e.target.value = '';
    if (!file || !confirmReplace()) return;
    const text = await file.text();
    loadText(text, detectFormat(text, file.name), file.name);
  });

  $('re-new').addEventListener('click', () => {
    if (!confirmReplace()) return;
    const skeleton = { cln: '1.0', providers: { 'example.com': { domainPatterns: ['||example.com^'], rules: ['utm_source', { id: 'example-ref', matchPattern: '$removeparam=ref' }] } } };
    loadText(serialize(skeleton, state.format), state.format, 'custom-rules');
  });

  // Paste or drop a whole file into an empty editor: pick the format from its text.
  editor.dom.addEventListener('paste', () => {
    if (editor.getText().trim()) return;
    setTimeout(() => { const t = editor.getText(); const f = detectFormat(t); if (f !== state.format) setFormatUI(f); }, 0);
  });

  // ---- copy / download ----
  $('re-copy').addEventListener('click', async () => {
    try { await navigator.clipboard.writeText(editor.getText()); renderStatus('Copied'); }
    catch { renderStatus('Couldn\'t copy. Select all and copy instead.'); }
  });
  $('re-download').addEventListener('click', () => {
    const ext = state.format === 'json' ? 'json' : 'yaml';
    const name = `${state.fileName}${state.view === 'filter' ? '-filtered' : ''}.${ext}`;
    const blob = new Blob([editor.getText()], { type: state.format === 'json' ? 'application/json' : 'text/yaml' });
    const a = document.createElement('a');
    a.href = URL.createObjectURL(blob);
    a.download = name;
    a.click();
    setTimeout(() => URL.revokeObjectURL(a.href), 1000);
    renderStatus(`Downloaded ${name}`);
  });

  // ---- patch: the edited rules as a "patches" file (filter-syntax.md §Rule patches) ----
  // Each changed rule becomes { target: "provider::id", section, replace }, with the id the
  // engine gives the rule as loaded (linkumori_rule_ids.js). A patch can only replace a rule,
  // so added or removed rules and providers, and changed provider keys, are reported instead.
  const PATCH_SECTIONS = ['exceptions', 'rules', 'referralMarketing', 'rawRules', 'redirections', 'fieldRedirections'];
  const same = (a, b) => JSON.stringify(a) === JSON.stringify(b);
  const explicitId = e => (e && typeof e === 'object' && typeof e.id === 'string' && e.id ? e.id : null);

  function buildPatches(base, edited, Ids) {
    const patches = [], skipped = [];
    const baseProvs = (base && base.providers) || {}, editProvs = (edited && edited.providers) || {};
    for (const key of Object.keys(editProvs)) if (!(key in baseProvs)) skipped.push(`provider "${key}" was added`);
    for (const key of Object.keys(baseProvs)) {
      if (!(key in editProvs)) { skipped.push(`provider "${key}" was removed`); continue; }
      const before = baseProvs[key] || {}, after = editProvs[key] || {};
      const otherKeys = new Set([...Object.keys(before), ...Object.keys(after)].filter(k => !PATCH_SECTIONS.includes(k)));
      for (const k of otherKeys) if (!same(before[k], after[k])) skipped.push(`"${key}": ${k} changed`);
      const ids = Ids.assignProviderRuleIds(before);
      for (const section of PATCH_SECTIONS) {
        const oldList = Array.isArray(before[section]) ? before[section] : [];
        const newList = Array.isArray(after[section]) ? after[section] : [];
        const usedOld = new Set(), usedNew = new Set();
        const patch = (oi, ni) => {
          usedOld.add(oi); usedNew.add(ni);
          if (same(oldList[oi], newList[ni])) return;
          const id = ids[section][oi] && ids[section][oi].id;
          if (!id) { skipped.push(`"${key}": ${section}[${oi}] has no id to target`); return; }
          patches.push({ target: `${key}::${id}`, section, replace: newList[ni] });
        };
        // Unchanged entries first, then rules that keep their "id", then the rest in list order.
        newList.forEach((e, ni) => {
          const oi = oldList.findIndex((o, i) => !usedOld.has(i) && same(o, e));
          if (oi >= 0) patch(oi, ni);
        });
        newList.forEach((e, ni) => {
          if (usedNew.has(ni) || !explicitId(e)) return;
          const oi = oldList.findIndex((o, i) => !usedOld.has(i) && explicitId(o) === explicitId(e));
          if (oi >= 0) patch(oi, ni);
        });
        const restOld = oldList.map((_, i) => i).filter(i => !usedOld.has(i));
        const restNew = newList.map((_, i) => i).filter(i => !usedNew.has(i));
        const n = Math.min(restOld.length, restNew.length);
        for (let i = 0; i < n; i++) patch(restOld[i], restNew[i]);
        if (restNew.length > n) skipped.push(`"${key}": ${restNew.length - n} rule${restNew.length - n > 1 ? 's' : ''} added to ${section}`);
        if (restOld.length > n) skipped.push(`"${key}": ${restOld.length - n} rule${restOld.length - n > 1 ? 's' : ''} removed from ${section}`);
      }
    }
    return { patches, skipped };
  }

  // A page without the button (an older copy of index.html) just has no patch feature.
  $('re-patch')?.addEventListener('click', () => {
    const Ids = window.LinkumoriRuleIds;
    if (!Ids) { renderStatus('Can\'t create a patch: core_js/linkumori_rule_ids.js didn\'t load'); return; }
    if (state.view === 'filter') { renderStatus('Apply or leave the filtered view first, then create the patch'); return; }
    if (state.loadedText == null) { renderStatus('Can\'t create a patch: open or load the original rule file first'); return; }
    let base, edited;
    try { base = parse(state.loadedText, state.loadedFormat); } catch { renderStatus('Can\'t create a patch: the original file doesn\'t parse'); return; }
    try { edited = parse(editor.getText(), state.format); } catch { renderStatus('Can\'t create a patch: fix the errors first'); return; }
    const { patches, skipped } = buildPatches(base, edited, Ids);
    if (skipped.length) console.info('[rules editor] not in the patch:\n' + skipped.join('\n'));
    const note = skipped.length ? ` · ${skipped.length} change${skipped.length > 1 ? 's' : ''} can't be a patch (${skipped.slice(0, 2).join('; ')}${skipped.length > 2 ? '; …' : ''})` : '';
    if (!patches.length) { renderStatus(`No changed rules to patch${note}`); return; }
    const ext = state.format === 'json' ? 'json' : 'yaml';
    const name = `${state.fileName}-patch.${ext}`;
    const blob = new Blob([serialize({ cln: '1.0', patches }, state.format)], { type: state.format === 'json' ? 'application/json' : 'text/yaml' });
    const a = document.createElement('a');
    a.href = URL.createObjectURL(blob);
    a.download = name;
    a.click();
    setTimeout(() => URL.revokeObjectURL(a.href), 1000);
    renderStatus(`Downloaded ${name}: ${patches.length} patch${patches.length > 1 ? 'es' : ''}${note}`);
  });

  // ---- filtering ----
  const queryEl = $('re-query'), scopeEl = $('re-scope'), regexEl = $('re-regex'), trimEl = $('re-trim');
  const tabFull = $('re-tab-full'), tabFilter = $('re-tab-filter'), countEl = $('re-count');
  const applyBtn = $('re-apply'), outlineEl = $('re-outline');

  function makeMatcher() {
    const q = queryEl.value.trim();
    if (!q) return null;
    if (regexEl.checked) {
      try { const re = new RegExp(q, 'i'); return s => re.test(s); }
      catch { return 'bad'; }
    }
    const needle = q.toLowerCase();
    return s => s.toLowerCase().includes(needle);
  }
  const asList = v => (Array.isArray(v) ? v : v == null ? [] : [v]);
  function entryMatches(entry, scope, test) {
    if (typeof entry === 'string') return scope !== 'id' && test(entry);
    if (!entry || typeof entry !== 'object') return false;
    if (scope === 'id') return test(String(entry.id ?? '')) || asList(entry.aliases).some(a => test(String(a)));
    if (scope === 'match') return test(String(entry.matchPattern ?? ''));
    return test(JSON.stringify(entry));
  }
  function providerMatches(key, prov, scope, test) {
    if ((scope === 'all' || scope === 'key') && test(key)) return true;
    if (!prov || typeof prov !== 'object') return false;
    if ((scope === 'all' || scope === 'pattern') && PATTERN_KEYS.some(k => asList(prov[k]).some(p => test(String(p))))) return true;
    if (scope === 'all' || scope === 'id' || scope === 'match') {
      return LIST_KEYS.some(k => asList(prov[k]).some(e => entryMatches(e, scope, test)));
    }
    return false;
  }
  function trimProvider(prov, scope, test) {
    const copy = { ...prov };
    for (const k of LIST_KEYS) {
      if (!Array.isArray(copy[k])) continue;
      const kept = copy[k].filter(e => entryMatches(e, scope === 'key' || scope === 'pattern' ? 'all' : scope, test));
      if (kept.length) copy[k] = kept; else delete copy[k];
    }
    return copy;
  }

  // The current query against the full document: { test, keys, data }. With no query,
  // every provider is listed so the sidebar works as a provider browser.
  function runFilter() {
    const test = makeMatcher();
    if (test === 'bad') return { test };
    let data;
    try { data = parse(currentFullText(), state.format); } catch { return { test, parseError: true }; }
    const providers = (data && typeof data.providers === 'object' && data.providers) || {};
    const all = Object.keys(providers);
    const keys = test ? all.filter(k => providerMatches(k, providers[k], scopeEl.value, test)) : all;
    return { test, keys, data, total: all.length };
  }

  let filterTimer = 0, lastResult = null;
  function scheduleFilter() {
    clearTimeout(filterTimer);
    filterTimer = setTimeout(updateFilter, 200);
  }
  function updateFilter() {
    // While the filtered view is on screen, the user is editing it: keep its key list.
    if (state.view === 'filter') return;
    const r = runFilter();
    lastResult = r;
    editor.highlight(!regexEl.checked ? queryEl.value.trim() : '');
    if (!r.keys) {
      tabFilter.disabled = true;
      countEl.textContent = r.test === 'bad' ? 'bad regex' : r.parseError ? '—' : '';
      renderOutline(null);
      return;
    }
    tabFilter.disabled = !r.test || r.keys.length === 0;
    countEl.textContent = r.test ? r.keys.length.toLocaleString() : '';
    renderOutline(r.keys, r.data.providers, r.test ? 'match' : 'all', r.total);
  }

  const entryCount = prov => LIST_KEYS.reduce((n, k) => n + (Array.isArray(prov && prov[k]) ? prov[k].length : 0), 0);
  const patternOf = prov => {
    if (!prov) return '';
    const d = asList(prov.domainPatterns);
    if (d.length) return d.join('  ');
    return asList(prov.indexPattern).join('  ') || (prov.urlPattern ? String(prov.urlPattern) : '');
  };

  // Sidebar: every provider (or every match), with its pattern and entry count.
  // Click a name to jump to it; the pencil opens that provider alone for editing.
  function renderOutline(keys, providers, mode, total) {
    if (!keys) {
      const p = document.createElement('p');
      p.className = 're-outline-head';
      p.textContent = editor.getText().trim() ? 'Fix the errors to list providers.' : 'Providers appear here once a file is loaded.';
      outlineEl.replaceChildren(p);
      return;
    }
    const head = document.createElement('p');
    head.className = 're-outline-head';
    head.textContent = mode === 'all' ? `All providers · ${keys.length.toLocaleString()}`
      : mode === 'filter' ? `In this view · ${keys.length.toLocaleString()}`
      : keys.length ? `${keys.length.toLocaleString()} of ${total.toLocaleString()} match` : 'No matching providers';
    const list = document.createElement('ul');
    list.className = 're-prov-list';
    for (const k of keys) {
      const prov = providers[k];
      const li = document.createElement('li');
      li.className = 're-prov';
      const go = document.createElement('button');
      go.type = 'button';
      go.className = 're-prov-go';
      go.title = `Go to ${k}`;
      const name = document.createElement('span');
      name.className = 're-prov-name';
      name.textContent = k;
      const meta = document.createElement('span');
      meta.className = 're-prov-meta';
      const pat = patternOf(prov);
      const n = entryCount(prov);
      meta.textContent = `${n} ${n === 1 ? 'entry' : 'entries'}${pat ? ' · ' + pat : ''}`;
      go.append(name, meta);
      go.addEventListener('click', () => jumpToProvider(k));
      li.append(go);
      if (mode !== 'filter') {
        const edit = document.createElement('button');
        edit.type = 'button';
        edit.className = 're-prov-edit';
        edit.title = `Edit only ${k}`;
        edit.setAttribute('aria-label', `Edit only ${k}`);
        edit.innerHTML = '<svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M12 20h9"/><path d="M16.5 3.5a2.1 2.1 0 0 1 3 3L7 19l-4 1 1-4Z"/></svg>';
        edit.addEventListener('click', () => showFiltered([k]));
        li.append(edit);
      }
      list.append(li);
    }
    outlineEl.replaceChildren(head, list);
  }
  // Arrow keys move between provider names in the sidebar.
  outlineEl.addEventListener('keydown', e => {
    if (e.key !== 'ArrowDown' && e.key !== 'ArrowUp') return;
    const items = [...outlineEl.querySelectorAll('.re-prov-go')];
    const i = items.indexOf(document.activeElement);
    if (i < 0) return;
    e.preventDefault();
    const next = items[Math.max(0, Math.min(items.length - 1, i + (e.key === 'ArrowDown' ? 1 : -1)))];
    next.focus();
    next.scrollIntoView({ block: 'nearest' });
  });

  function jumpToProvider(key) {
    try {
      const doc = YAML.parseDocument(editor.getText());
      const provs = doc.get('providers', true);
      const pair = pairs(provs).find(p => keyOf(p) === key);
      if (pair) editor.goTo(pair.key.range[0]);
    } catch { /* the document doesn't parse; nothing to jump to */ }
  }

  // Opens the filtered view: the current matches, or just `only` (from the sidebar pencil).
  function showFiltered(only) {
    const r = runFilter();
    if (!r.keys) return;
    const keys = only || (r.test ? r.keys : []);
    if (!keys.length) return;
    state.fullText = editor.getText();
    state.filterKeys = keys;
    state.trimmed = !only && trimEl.checked;
    const subset = {};
    for (const k of keys) subset[k] = state.trimmed ? trimProvider(r.data.providers[k], scopeEl.value, r.test) : r.data.providers[k];
    const out = r.data.cln !== undefined ? { cln: r.data.cln, providers: subset } : { providers: subset };
    state.view = 'filter';
    tabFilter.disabled = false;
    countEl.textContent = keys.length.toLocaleString();
    setTabs();
    editor.setText(serialize(out, state.format));
    state.filteredOriginal = editor.getText();
    editor.setReadOnly(state.trimmed);
    renderOutline(keys, subset, 'filter');
    renderStatus(only ? `Editing ${only[0]} — Apply to full file when done` : undefined);
  }
  function showFull(apply) {
    if (state.view !== 'filter') return true;
    if (apply) {
      let full, part;
      try { part = parse(editor.getText(), state.format); } catch { renderStatus('Can\'t apply: fix the errors in the filtered view first'); return false; }
      try { full = parse(state.fullText, state.format); } catch { renderStatus('Can\'t apply: the full file doesn\'t parse'); return false; }
      const edited = (part && part.providers) || {};
      const providers = full.providers || (full.providers = {});
      const removed = state.filterKeys.filter(k => !(k in edited));
      for (const k of removed) delete providers[k];
      const added = Object.keys(edited).filter(k => !state.filterKeys.includes(k));
      // Rebuild in place so edited providers keep their position in the file.
      const rebuilt = {};
      for (const k of Object.keys(providers)) rebuilt[k] = k in edited ? edited[k] : providers[k];
      for (const k of added) rebuilt[k] = edited[k];
      full.providers = rebuilt;
      state.fullText = serialize(full, state.format);
      state.view = 'full';
      editor.setReadOnly(false);
      editor.setText(state.fullText);
      setTabs();
      const changes = [`${Object.keys(edited).length - added.length} updated`];
      if (added.length) changes.push(`${added.length} added`);
      if (removed.length) changes.push(`${removed.length} removed`);
      renderStatus(`Applied: ${changes.join(', ')}`);
    } else {
      const edited = !state.trimmed && editor.getText() !== state.filteredOriginal;
      if (edited && !confirm('Leave the filtered view without applying your edits?')) return false;
      state.view = 'full';
      editor.setReadOnly(false);
      editor.setText(state.fullText);
      setTabs();
    }
    scheduleFilter();
    return true;
  }
  function setTabs() {
    const filtered = state.view === 'filter';
    tabFull.setAttribute('aria-selected', String(!filtered));
    tabFilter.setAttribute('aria-selected', String(filtered));
    applyBtn.hidden = !filtered || state.trimmed;
    for (const el of [queryEl, scopeEl, regexEl, trimEl, ...loadButtons, $('re-new'), $('re-open').parentElement]) {
      el.toggleAttribute('disabled', filtered);
      el.classList.toggle('is-disabled', filtered);
    }
  }

  tabFilter.addEventListener('click', () => { if (state.view !== 'filter') showFiltered(); });
  tabFull.addEventListener('click', () => showFull(false));
  applyBtn.addEventListener('click', () => showFull(true));
  for (const el of [queryEl, scopeEl, regexEl]) el.addEventListener(el === queryEl ? 'input' : 'change', scheduleFilter);
  queryEl.addEventListener('keydown', e => { if (e.key === 'Enter' && !tabFilter.disabled) tabFilter.click(); });


  // ---- draft (this browser only) ----
  let draftTimer = 0;
  function scheduleDraft() {
    clearTimeout(draftTimer);
    draftTimer = setTimeout(() => {
      try {
        const text = currentFullText();
        if (text.length > 4_000_000) return;
        // The loaded original too, so "Create patch" still works after a reload, when it fits.
        const base = state.loadedText != null && text.length + state.loadedText.length <= 4_000_000
          ? { base: state.loadedText, baseFormat: state.loadedFormat } : {};
        localStorage.setItem(DRAFT_KEY, JSON.stringify({ format: state.format, text, name: state.fileName, ...base }));
      } catch { /* storage full or blocked */ }
    }, 800);
  }
  try {
    const draft = JSON.parse(localStorage.getItem(DRAFT_KEY) || 'null');
    if (draft && draft.text) {
      setFormatUI(draft.format === 'yaml' ? 'yaml' : 'json');
      state.fileName = draft.name || state.fileName;
      if (typeof draft.base === 'string') { state.loadedText = draft.base; state.loadedFormat = draft.baseFormat === 'yaml' ? 'yaml' : 'json'; }
      editor.setText(draft.text);
      renderStatus('Restored your last draft');
    }
  } catch { /* no draft */ }

  // ?q= deep link, such as rules-editor.html?q=reddit
  const q = new URLSearchParams(location.search).get('q');
  if (q) queryEl.value = q;
  scheduleFilter();
})();
