/* Linkumori code editor: a small, dependency-free editor for JSON and YAML rule files.
 *
 * A native <textarea> does the editing (typing, selection, undo, IME, screen readers).
 * Its text is transparent; a layer underneath draws the same text with syntax colours,
 * lint marks and search matches. Only the lines in view are drawn, so a 50,000-line
 * rule file stays fast. Exposes window.LinkumoriEditor.createEditor().
 *
 * The same file is used by rules-editor.html on the website branch and by
 * tools/rules-editor/ on main. Keep the two copies identical. */
(() => {
  'use strict';

  const LH = 20;          // line height in px; the textarea and the drawn layer must agree
  const PAD_Y = 6;        // top and bottom padding
  const PAD_X = 12;       // left padding of the code
  const OVERSCAN = 8;     // extra lines drawn above and below the view
  const MAX_DRAW = 20000; // longer lines are drawn without colours
  const MAX_FIND = 20000; // most find matches counted

  const CSS = `
.lke { position: relative; display: flex; flex-direction: column; height: 100%; min-height: 0; background: var(--bg); color: var(--code-text, var(--text)); }
.lke-body { position: relative; flex: 1; display: flex; min-height: 0; }
.lke-gutter { position: relative; flex: none; overflow: hidden; background: var(--bg-alt); border-right: 1px solid var(--line-soft); }
.lke-gutter-inner { position: absolute; left: 0; right: 0; top: 0; will-change: transform; }
.lke-num { height: ${LH}px; padding: 0 10px 0 14px; text-align: right; font: 12px/${LH}px var(--mono); color: var(--text-3); font-variant-numeric: tabular-nums; position: relative; }
.lke-num.cur { color: var(--text); }
.lke-num.err, .lke-num.warn { cursor: help; }
.lke-num.err::before, .lke-num.warn::before { content: ""; position: absolute; left: 4px; top: 7px; width: 6px; height: 6px; border-radius: 50%; }
.lke-num.err::before { background: var(--strike); }
.lke-num.warn::before { background: var(--warn); }
.lke-code { position: relative; flex: 1; min-width: 0; overflow: hidden; }
.lke-layer { position: absolute; inset: 0; overflow: hidden; pointer-events: none; }
.lke-lines { position: absolute; left: 0; top: 0; min-width: 100%; will-change: transform; }
.lke .lke-line, .lke textarea.lke-input { font-family: var(--mono); font-size: 13px; line-height: ${LH}px; font-variant-ligatures: none; letter-spacing: 0; tab-size: 2; -moz-tab-size: 2; white-space: pre; }
.lke-line { height: ${LH}px; padding: 0 ${PAD_X}px; }
.lke-line.cur { background: color-mix(in srgb, var(--blue) 7%, transparent); }
.lke-line.err { background: color-mix(in srgb, var(--strike) 9%, transparent); }
.lke-line.warn { background: color-mix(in srgb, var(--warn) 9%, transparent); }
.lke textarea.lke-input, .lke textarea.lke-input:focus, .lke textarea.lke-input:hover { position: absolute; inset: 0; display: block; width: 100%; height: 100%; min-height: 0; max-width: none; margin: 0; border: 0; border-radius: 0; padding: ${PAD_Y}px ${PAD_X}px; resize: none; outline: none; box-shadow: none; overflow: auto; background: transparent; color: transparent; caret-color: var(--text); -webkit-text-fill-color: transparent; transition: none; }
.lke textarea.lke-input::selection { background: color-mix(in srgb, var(--blue) 30%, transparent); color: transparent; -webkit-text-fill-color: transparent; }
.lke textarea.lke-input:read-only { caret-color: transparent; }
.lke .t-k { color: var(--code-key); }
.lke .t-s { color: var(--code-str); }
.lke .t-n { color: var(--code-num); }
.lke .t-l { color: var(--code-lit); }
.lke .t-c { color: var(--text-3); }
.lke .t-p { color: var(--text-2); }
.lke .m-filter { background: color-mix(in srgb, var(--warn) 28%, transparent); border-radius: 2px; }
.lke .m-find { background: color-mix(in srgb, var(--warn) 30%, transparent); outline: 1px solid color-mix(in srgb, var(--warn) 55%, transparent); }
.lke .m-find-cur { background: color-mix(in srgb, var(--blue) 40%, transparent); outline: 1px solid var(--blue); }
.lke .u-err { text-decoration: underline wavy var(--strike); text-decoration-skip-ink: none; text-underline-offset: 3px; }
.lke .u-warn { text-decoration: underline wavy var(--warn); text-decoration-skip-ink: none; text-underline-offset: 3px; }
.lke-find { display: flex; flex-wrap: wrap; gap: 6px; align-items: center; padding: 6px 8px; background: var(--bg-alt); border-bottom: 1px solid var(--line); font: 13px/1.3 var(--font); }
.lke-find[hidden] { display: none; }
.lke-find input { flex: 1 1 160px; min-width: 0; font: 13px/1.3 var(--mono); padding: 5px 8px; color: var(--text); background: var(--field-bg); border: 1px solid var(--field-line); border-radius: 6px; }
.lke-find input:focus { outline: none; border-color: var(--blue); }
.lke-find button { font: 13px/1 var(--font); padding: 6px 10px; color: var(--text); background: var(--tile); border: 1px solid var(--line); border-radius: 6px; cursor: pointer; }
.lke-find button:hover { border-color: var(--link); color: var(--link); }
.lke-find label { display: inline-flex; gap: 4px; align-items: center; color: var(--text-2); cursor: pointer; }
.lke-find-count { color: var(--text-2); min-width: 70px; font-variant-numeric: tabular-nums; }
`;
  function injectCss() {
    if (document.getElementById('lke-css')) return;
    const style = document.createElement('style');
    style.id = 'lke-css';
    style.textContent = CSS;
    document.head.append(style);
  }

  // ---- syntax colours, one line at a time ----
  // Each tokenizer returns [start, end, class] ranges: k key, s string, n number, l literal, c comment, p punctuation.
  function tokensJSON(line) {
    const out = [];
    const re = /"(?:[^"\\]|\\.)*"?|-?\d+(?:\.\d+)?(?:[eE][+-]?\d+)?|\b(?:true|false|null)\b|[{}[\],:]/g;
    let m;
    while ((m = re.exec(line))) {
      const t = m[0];
      let cls = 'p';
      if (t[0] === '"') cls = /^\s*:/.test(line.slice(re.lastIndex)) ? 'k' : 's';
      else if (t[0] === '-' || (t[0] >= '0' && t[0] <= '9')) cls = 'n';
      else if (t[0] >= 'a' && t[0] <= 'z') cls = 'l';
      out.push([m.index, re.lastIndex, cls]);
    }
    return out;
  }

  const YAML_KEY = /^("(?:[^"\\]|\\.)*"|'(?:[^']|'')*'|[^\s#'"[\]{},|>][^\n]*?)\s*:(?=\s|$)/;
  const YAML_LIT = /^(?:true|false|null|~|yes|no|on|off)$/i;
  const YAML_NUM = /^[-+]?(?:\d[\d_]*(?:\.\d*)?(?:e[-+]?\d+)?|\.\d+|\.inf|\.nan|0x[0-9a-f]+|0o[0-7]+)$/i;
  function quotedEnd(line, i) {
    const q = line[i];
    let j = i + 1;
    while (j < line.length) {
      if (q === '"' && line[j] === '\\') { j += 2; continue; }
      if (line[j] === q) {
        if (q === "'" && line[j + 1] === "'") { j += 2; continue; }
        return j + 1;
      }
      j++;
    }
    return line.length;
  }
  function tokensYAML(line) {
    const out = [];
    const n = line.length;
    let i = 0;
    while (i < n && line[i] === ' ') i++;
    if (i >= n) return out;
    if (line[i] === '#') { out.push([i, n, 'c']); return out; }
    if (i === 0 && (line.startsWith('---') || line.startsWith('...'))) { out.push([0, n, 'p']); return out; }
    while (line[i] === '-' && (i + 1 === n || line[i + 1] === ' ')) {
      out.push([i, i + 1, 'p']);
      i++;
      while (line[i] === ' ') i++;
    }
    const km = YAML_KEY.exec(line.slice(i));
    if (km) {
      out.push([i, i + km[1].length, 'k']);
      const colon = i + km[0].length - 1;
      out.push([colon, colon + 1, 'p']);
      i = colon + 1;
    }
    yamlValue(line, i, out);
    return out;
  }
  function yamlValue(line, i, out) {
    const n = line.length;
    while (i < n && line[i] === ' ') i++;
    if (i >= n) return;
    const c = line[i];
    if (c === '#') { out.push([i, n, 'c']); return; }
    if (c === '"' || c === "'") {
      const end = quotedEnd(line, i);
      out.push([i, end, 's']);
      const hash = line.indexOf('#', end);
      if (hash >= 0 && /^\s*$/.test(line.slice(end, hash))) out.push([hash, n, 'c']);
      return;
    }
    if (c === '|' || c === '>') { out.push([i, n, 'p']); return; }
    if (c === '&' || c === '*' || c === '!') {
      const sp = line.indexOf(' ', i);
      const end = sp < 0 ? n : sp;
      out.push([i, end, 'l']);
      yamlValue(line, end, out);
      return;
    }
    if (c === '[' || c === '{') {
      // Flow collection: brackets and commas as punctuation, the rest as strings.
      const re = /"(?:[^"\\]|\\.)*"?|'(?:[^']|'')*'?|[[\]{},:]|[^[\]{},:"'\s][^[\]{},]*/g;
      re.lastIndex = i;
      let m;
      while ((m = re.exec(line))) {
        const t = m[0].trimEnd();
        if (/^[[\]{},:]$/.test(t)) out.push([m.index, m.index + 1, 'p']);
        else if (t) out.push([m.index, m.index + t.length, YAML_NUM.test(t) ? 'n' : YAML_LIT.test(t) ? 'l' : 's']);
      }
      return;
    }
    // Plain scalar, up to a " #" comment.
    let end = line.indexOf(' #', i);
    if (end < 0) end = n;
    const text = line.slice(i, end).trimEnd();
    out.push([i, i + text.length, YAML_LIT.test(text) ? 'l' : YAML_NUM.test(text) ? 'n' : 's']);
    if (end < n) out.push([end + 1, n, 'c']);
  }
  const TOKENIZERS = { json: tokensJSON, yaml: tokensYAML };

  const escapeHtml = s => s.replace(/[&<>]/g, c => (c === '&' ? '&amp;' : c === '<' ? '&lt;' : '&gt;'));

  // Draws one line: token colours plus mark ranges ([start, end, class]) on top.
  function drawLine(text, tokens, marks) {
    if (!tokens.length && !marks.length) return escapeHtml(text);
    const cuts = new Set([0, text.length]);
    for (const r of tokens) { cuts.add(r[0]); cuts.add(r[1]); }
    for (const r of marks) { cuts.add(Math.max(0, r[0])); cuts.add(Math.min(text.length, r[1])); }
    const points = [...cuts].sort((a, b) => a - b);
    let html = '';
    let ti = 0;
    for (let k = 0; k < points.length - 1; k++) {
      const a = points[k], b = points[k + 1];
      if (a >= b) continue;
      while (ti < tokens.length && tokens[ti][1] <= a) ti++;
      const classes = [];
      if (ti < tokens.length && tokens[ti][0] <= a) classes.push('t-' + tokens[ti][2]);
      for (const r of marks) if (r[0] <= a && r[1] >= b) classes.push(r[2]);
      const seg = escapeHtml(text.slice(a, b));
      html += classes.length ? `<span class="${classes.join(' ')}">${seg}</span>` : seg;
    }
    return html;
  }

  /**
   * createEditor({ parent, doc, language: 'json'|'yaml', readOnly, lint, onChange, label })
   * `lint(text)` returns [{from, to, severity: 'error'|'warning', message}].
   */
  function createEditor({ parent, doc = '', language = 'json', readOnly = false, lint, onChange, label = 'Rule file' }) {
    injectCss();
    const dom = document.createElement('div');
    dom.className = 'lke';
    dom.innerHTML = `
      <div class="lke-find" hidden role="search">
        <input type="text" spellcheck="false" autocomplete="off" placeholder="Find" aria-label="Find in file">
        <label><input type="checkbox" class="lke-case"> Match case</label>
        <span class="lke-find-count" aria-live="polite"></span>
        <button type="button" class="lke-prev" aria-label="Previous match">↑</button>
        <button type="button" class="lke-next" aria-label="Next match">↓</button>
        <button type="button" class="lke-close" aria-label="Close find">Esc</button>
      </div>
      <div class="lke-body">
        <div class="lke-gutter" aria-hidden="true"><div class="lke-gutter-inner"></div></div>
        <div class="lke-code">
          <div class="lke-layer" aria-hidden="true"><div class="lke-lines"></div></div>
          <textarea class="lke-input" wrap="off" spellcheck="false" autocomplete="off" autocapitalize="off" autocorrect="off"></textarea>
        </div>
      </div>`;
    parent.append(dom);
    const q = sel => dom.querySelector(sel);
    const ta = q('.lke-input'), linesEl = q('.lke-lines'), gutter = q('.lke-gutter'), gutterInner = q('.lke-gutter-inner');
    const findBar = q('.lke-find'), findInput = q('.lke-find input'), findCase = q('.lke-case'), findCount = q('.lke-find-count');
    ta.setAttribute('aria-label', label);
    ta.value = doc;
    ta.readOnly = readOnly;

    let lang = language;
    let lineStarts = [0];
    let diagnostics = [];
    let diagByLine = new Map();   // line index -> { sev, msgs, ranges }
    let filterText = '';
    let find = { query: '', matches: [], cur: -1 };
    let curLine = 0;
    let frame = 0;
    let escapeTab = false;

    function indexLines() {
      const text = ta.value;
      const starts = [0];
      let i = -1;
      while ((i = text.indexOf('\n', i + 1)) !== -1) starts.push(i + 1);
      lineStarts = starts;
      gutter.style.width = `${String(starts.length).length * 8 + 30}px`;
    }
    function lineIndexAt(pos) {
      let lo = 0, hi = lineStarts.length - 1;
      while (lo < hi) {
        const mid = (lo + hi + 1) >> 1;
        if (lineStarts[mid] <= pos) lo = mid; else hi = mid - 1;
      }
      return lo;
    }
    function lineText(i, text = ta.value) {
      const end = i + 1 < lineStarts.length ? lineStarts[i + 1] - 1 : text.length;
      return text.slice(lineStarts[i], end);
    }

    function indexDiagnostics() {
      diagByLine = new Map();
      const rank = { error: 2, warning: 1 };
      for (const d of diagnostics) {
        const li = lineIndexAt(d.from);
        const entry = diagByLine.get(li) || { sev: 'warning', msgs: [], ranges: [] };
        if (rank[d.severity] > rank[entry.sev]) entry.sev = d.severity;
        entry.msgs.push(d.message);
        const start = lineStarts[li];
        const lineEnd = li + 1 < lineStarts.length ? lineStarts[li + 1] - 1 : ta.value.length;
        const from = d.from - start;
        const to = Math.max(from + 1, Math.min(d.to, lineEnd) - start);
        entry.ranges.push([from, to, d.severity === 'error' ? 'u-err' : 'u-warn']);
        diagByLine.set(li, entry);
      }
    }

    function draw() {
      frame = 0;
      const text = ta.value;
      const top = ta.scrollTop, left = ta.scrollLeft, height = ta.clientHeight;
      const total = lineStarts.length;
      const first = Math.max(0, Math.floor((top - PAD_Y) / LH) - OVERSCAN);
      const last = Math.min(total - 1, Math.ceil((top + height - PAD_Y) / LH) + OVERSCAN);
      const tokenize = TOKENIZERS[lang] || (() => []);
      const needle = filterText.toLowerCase();
      const findNeedle = find.query && (findCase.checked ? find.query : find.query.toLowerCase());
      const curMatch = find.cur >= 0 ? find.matches[find.cur] : -1;
      let rows = '', nums = '';
      for (let i = first; i <= last; i++) {
        const line = lineText(i, text);
        const diag = diagByLine.get(i);
        let tokens = [];
        const marks = [];
        if (line.length <= MAX_DRAW) {
          tokens = tokenize(line);
          if (needle) {
            const low = line.toLowerCase();
            for (let p = low.indexOf(needle); p !== -1; p = low.indexOf(needle, p + needle.length)) marks.push([p, p + needle.length, 'm-filter']);
          }
          if (findNeedle) {
            const hay = findCase.checked ? line : line.toLowerCase();
            const base = lineStarts[i];
            for (let p = hay.indexOf(findNeedle); p !== -1; p = hay.indexOf(findNeedle, p + findNeedle.length)) {
              marks.push([p, p + findNeedle.length, base + p === curMatch ? 'm-find-cur' : 'm-find']);
            }
          }
          if (diag) marks.push(...diag.ranges);
        }
        const cls = ['lke-line'];
        if (diag) cls.push(diag.sev === 'error' ? 'err' : 'warn');
        else if (i === curLine) cls.push('cur');
        rows += `<div class="${cls.join(' ')}">${drawLine(line, tokens, marks) || ' '}</div>`;
        const ncls = ['lke-num'];
        if (i === curLine) ncls.push('cur');
        if (diag) ncls.push(diag.sev === 'error' ? 'err' : 'warn');
        const title = diag ? ` title="${escapeHtml(diag.msgs.join('\n')).replace(/"/g, '&quot;')}"` : '';
        nums += `<div class="${ncls.join(' ')}"${title}>${i + 1}</div>`;
      }
      const y = PAD_Y + first * LH - top;
      linesEl.style.transform = `translate(${-left}px, ${y}px)`;
      linesEl.innerHTML = rows;
      gutterInner.style.transform = `translateY(${y}px)`;
      gutterInner.innerHTML = nums;
    }
    const scheduleDraw = () => { if (!frame) frame = requestAnimationFrame(draw); };

    // Line-number tooltips need pointer events on the gutter only.
    gutter.style.pointerEvents = 'auto';
    gutter.addEventListener('click', e => {
      const num = e.target.closest('.lke-num');
      if (!num) return;
      const li = Number(num.textContent) - 1;
      const end = li + 1 < lineStarts.length ? lineStarts[li + 1] : ta.value.length;
      ta.focus();
      ta.setSelectionRange(lineStarts[li], end);
    });

    // ---- linting ----
    let lintTimer = 0;
    function runLint() {
      clearTimeout(lintTimer);
      if (!lint) return;
      diagnostics = lint(ta.value) || [];
      indexDiagnostics();
      scheduleDraw();
    }
    const scheduleLint = () => { clearTimeout(lintTimer); lintTimer = setTimeout(runLint, 400); };

    function changed() {
      indexLines();
      // Old marks point at old offsets; drop them until the next lint pass.
      if (diagnostics.length) { diagnostics = []; diagByLine = new Map(); }
      if (find.query) computeFind(false);
      updateCursor();
      scheduleDraw();
      scheduleLint();
      if (onChange) onChange();
    }

    function updateCursor() {
      const li = lineIndexAt(ta.selectionStart);
      if (li !== curLine) { curLine = li; scheduleDraw(); }
    }

    // ---- editing keys ----
    function insert(text) {
      // execCommand keeps the browser's undo history; setRangeText is the fallback.
      if (!document.execCommand('insertText', false, text)) {
        ta.setRangeText(text, ta.selectionStart, ta.selectionEnd, 'end');
        ta.dispatchEvent(new Event('input', { bubbles: true }));
      }
    }
    function indentLines(outdent) {
      const value = ta.value;
      const s = ta.selectionStart, e = ta.selectionEnd;
      const from = value.lastIndexOf('\n', s - 1) + 1;
      const endIdx = value.indexOf('\n', e > s && value[e - 1] === '\n' ? e - 1 : e);
      const to = endIdx === -1 ? value.length : endIdx;
      const block = value.slice(from, to);
      const next = block.split('\n').map(l => (outdent ? l.replace(/^ {1,2}/, '') : '  ' + l)).join('\n');
      ta.setSelectionRange(from, to);
      insert(next);
      ta.setSelectionRange(from, from + next.length);
    }
    ta.addEventListener('keydown', e => {
      const mod = e.metaKey || e.ctrlKey;
      if (mod && !e.altKey && e.key.toLowerCase() === 'f') { e.preventDefault(); openFind(); return; }
      if (e.key === 'Escape') { escapeTab = true; if (!findBar.hidden) closeFind(false); return; }
      if (e.key === 'F3' || (mod && e.key.toLowerCase() === 'g')) { e.preventDefault(); stepFind(e.shiftKey ? -1 : 1); return; }
      if (ta.readOnly) return;
      if (e.key === 'Tab' && !mod && !e.altKey) {
        // Escape then Tab moves focus on, so keyboard users are never trapped.
        if (escapeTab) { escapeTab = false; return; }
        e.preventDefault();
        const multi = ta.value.slice(ta.selectionStart, ta.selectionEnd).includes('\n');
        if (e.shiftKey || multi) indentLines(e.shiftKey); else insert('  ');
        return;
      }
      escapeTab = false;
      if (e.key === 'Enter' && !mod && !e.altKey && !e.isComposing) {
        e.preventDefault();
        const value = ta.value, s = ta.selectionStart;
        const lineStart = value.lastIndexOf('\n', s - 1) + 1;
        const before = value.slice(lineStart, s);
        let indent = /^\s*/.exec(before)[0];
        const trimmed = before.trimEnd();
        const opens = /[{[]$/.test(trimmed) || (lang === 'yaml' && /:$/.test(trimmed));
        if (lang === 'yaml' && /^\s*- /.test(before) && !opens) indent += '  ';
        if (opens) {
          const after = value[ta.selectionEnd];
          const closes = (trimmed.endsWith('{') && after === '}') || (trimmed.endsWith('[') && after === ']');
          insert('\n' + indent + '  ' + (closes ? '\n' + indent : ''));
          if (closes) { const p = ta.selectionStart - indent.length - 1; ta.setSelectionRange(p, p); }
        } else {
          insert('\n' + indent);
        }
      }
    });
    ta.addEventListener('input', changed);
    ta.addEventListener('scroll', scheduleDraw, { passive: true });
    document.addEventListener('selectionchange', () => { if (document.activeElement === ta) updateCursor(); });
    ta.addEventListener('click', updateCursor);
    ta.addEventListener('keyup', updateCursor);
    new ResizeObserver(scheduleDraw).observe(ta);

    // ---- find ----
    function computeFind(keepNearCaret = true) {
      const query = findInput.value;
      find.query = query;
      find.matches = [];
      if (!query) { find.cur = -1; findCount.textContent = ''; scheduleDraw(); return; }
      const hay = findCase.checked ? ta.value : ta.value.toLowerCase();
      const needle = findCase.checked ? query : query.toLowerCase();
      for (let p = hay.indexOf(needle); p !== -1 && find.matches.length < MAX_FIND; p = hay.indexOf(needle, p + needle.length)) find.matches.push(p);
      if (keepNearCaret) {
        const at = ta.selectionStart;
        const idx = find.matches.findIndex(p => p >= at);
        find.cur = find.matches.length ? (idx === -1 ? 0 : idx) : -1;
      } else if (find.cur >= find.matches.length) find.cur = find.matches.length - 1;
      showFindCount();
      scheduleDraw();
    }
    function showFindCount() {
      const n = find.matches.length;
      findCount.textContent = !n ? 'No matches' : `${find.cur + 1} of ${n.toLocaleString()}${n >= MAX_FIND ? '+' : ''}`;
    }
    function revealMatch() {
      if (find.cur < 0) return;
      const pos = find.matches[find.cur];
      scrollToPos(pos, 'center', find.query.length);
      ta.setSelectionRange(pos, pos + find.query.length);
      showFindCount();
      scheduleDraw();
    }
    function stepFind(dir) {
      if (!find.matches.length) return;
      find.cur = (find.cur + dir + find.matches.length) % find.matches.length;
      revealMatch();
    }
    function openFind() {
      findBar.hidden = false;
      const sel = ta.value.slice(ta.selectionStart, ta.selectionEnd);
      if (sel && !sel.includes('\n')) findInput.value = sel;
      findInput.focus();
      findInput.select();
      computeFind();
      scheduleDraw();
    }
    function closeFind(focusEditor = true) {
      findBar.hidden = true;
      find = { query: '', matches: [], cur: -1 };
      scheduleDraw();
      if (focusEditor) ta.focus();
    }
    findInput.addEventListener('input', () => { computeFind(); revealMatch(); });
    findCase.addEventListener('change', () => { computeFind(); revealMatch(); });
    findInput.addEventListener('keydown', e => {
      if (e.key === 'Enter') { e.preventDefault(); stepFind(e.shiftKey ? -1 : 1); }
      if (e.key === 'Escape') { e.preventDefault(); closeFind(); }
    });
    q('.lke-next').addEventListener('click', () => stepFind(1));
    q('.lke-prev').addEventListener('click', () => stepFind(-1));
    q('.lke-close').addEventListener('click', () => closeFind());

    // Width of one character in the editor font, measured once it is drawn.
    let charWidth = 0;
    function measureChar() {
      if (charWidth) return charWidth;
      const probe = document.createElement('span');
      probe.className = 'lke-line';
      probe.style.cssText = 'position:absolute;visibility:hidden;padding:0;height:auto';
      probe.textContent = 'x'.repeat(100);
      linesEl.append(probe);
      charWidth = probe.getBoundingClientRect().width / 100 || 7.8;
      probe.remove();
      return charWidth;
    }
    if (document.fonts) document.fonts.ready.then(() => { charWidth = 0; });

    function scrollToPos(pos, where = 'top', length = 0) {
      const li = lineIndexAt(pos);
      const y = PAD_Y + li * LH;
      ta.scrollTop = where === 'center' ? Math.max(0, y - ta.clientHeight / 2) : Math.max(0, y - 2 * LH);
      // Bring the column into view only when it is off screen, keeping some context.
      const cw = measureChar();
      const x = (pos - lineStarts[li]) * cw;
      const right = x + Math.max(length, 1) * cw + PAD_X * 2;
      const view = ta.clientWidth;
      if (x < ta.scrollLeft) ta.scrollLeft = Math.max(0, x - 6 * cw);
      else if (right > ta.scrollLeft + view) ta.scrollLeft = Math.max(0, right - view + 6 * cw);
      scheduleDraw();
    }

    indexLines();
    scheduleDraw();
    // First pass after the caller has finished setting up (its lint callback may use the editor).
    if (lint) lintTimer = setTimeout(runLint, 0);

    return {
      dom,
      textarea: ta,
      getText: () => ta.value,
      setText(text) {
        ta.value = text;
        ta.setSelectionRange(0, 0);
        ta.scrollTop = 0;
        ta.scrollLeft = 0;
        changed();
        runLint();
      },
      setLanguage(name) { lang = name; scheduleDraw(); },
      setReadOnly(flag) { ta.readOnly = flag; },
      isReadOnly: () => ta.readOnly,
      /** Marks every case-insensitive match of `text` (the filter box), without moving the cursor. */
      highlight(text) { filterText = text || ''; scheduleDraw(); },
      goTo(pos) {
        ta.focus({ preventScroll: true });
        ta.setSelectionRange(pos, pos);
        ta.scrollLeft = 0;
        scrollToPos(pos);
        updateCursor();
      },
      lineAt: pos => lineIndexAt(Math.min(pos, ta.value.length)) + 1,
      lineCount: () => lineStarts.length,
      search: openFind,
      relint: runLint,
      focus: () => ta.focus(),
      destroy() { dom.remove(); }
    };
  }

  window.LinkumoriEditor = { createEditor };
})();
