// Run-order calculator for the CLN 1.0 page.
// Sorts a provider's stage 5 and 6 entries by (stage, orderGroup, order, rank, arrayIndex),
// after resolving entries with the same text as "Same text twice" describes.
(function () {
  'use strict';

  const SAMPLES = {
    shop: {
      cln: '1.0',
      providers: {
        shop: {
          domainPatterns: ['||shop.example^'],
          rawRules: [
            '\\/ref=[^/?]*',
            { id: 'strip-jsessionid', matchPattern: ';jsessionid=[^/?#]*', order: 20 }
          ],
          rules: [
            'utm_source',
            { id: 'token-rewrite', matchPattern: 'token', replacePattern: 'clean-§1§', order: 5 },
            'fbclid',
            { id: 'aff-id', matchPattern: 'aff_id', referralMarketing: true },
            { id: 'sid', matchPattern: 'sid', order: 20 },
            '$removeparam=/^pk_/'
          ],
          referralMarketing: ['tag']
        }
      }
    },
    numbers: {
      cln: '1.0',
      providers: {
        numbers: {
          domainPatterns: ['||numbers.example^'],
          rawRules: ['r', '3'],
          rules: ['a', '20', { matchPattern: '9', referralMarketing: true }, 'b'],
          referralMarketing: ['rm', '5']
        }
      }
    }
  };

  function isFilter(text) {
    return text.startsWith('@@') || /\$removeparam(?:[=,]|$)/.test(text);
  }

  function hasOwn(obj, key) {
    return Object.prototype.hasOwnProperty.call(obj, key);
  }

  // Turns one array of a provider into definition records.
  function collect(provider, arrayName, defaults, warnings, filters) {
    const list = provider[arrayName];
    if (list === undefined) return [];
    if (!Array.isArray(list)) { warnings.push('"' + arrayName + '" is not an array.'); return []; }
    const out = [];
    list.forEach(function (raw, index) {
      const obj = typeof raw === 'string' ? { matchPattern: raw } : raw;
      if (!obj || typeof obj !== 'object' || typeof obj.matchPattern !== 'string') {
        warnings.push(arrayName + '[' + index + '] has no matchPattern text.');
        return;
      }
      const label = arrayName + '[' + index + ']';
      if (arrayName !== 'rawRules' && isFilter(obj.matchPattern)) {
        if (hasOwn(obj, 'order')) warnings.push(label + ': a $removeparam filter or @@ entry cannot carry an order (lint-rules error).');
        filters.push({ label: label, text: obj.matchPattern,
          referral: arrayName === 'referralMarketing' || obj.referralMarketing === true,
          active: hasOwn(obj, 'active') ? obj.active !== false : defaults.active !== false });
        return;
      }
      const active = hasOwn(obj, 'active') ? obj.active !== false : defaults.active !== false;
      let rank = 0;
      if (arrayName === 'rules' && obj.referralMarketing === true) rank = 1;
      if (arrayName === 'referralMarketing') rank = 2;
      if (hasOwn(obj, 'order') && obj.order !== null && typeof obj.order !== 'number') {
        warnings.push(label + ': order must be a number or null.');
      }
      out.push({
        label: label,
        name: obj.id ? obj.id : JSON.stringify(obj.matchPattern),
        text: obj.matchPattern,
        stage: arrayName === 'rawRules' ? 0 : 1,
        group: arrayName === 'rawRules' ? 'raw' : rank === 0 ? 'field' : 'referral',
        rank: rank,
        arrayIndex: index,
        hasOrderKey: hasOwn(obj, 'order'),
        order: typeof obj.order === 'number' ? obj.order : null,
        active: active,
        replacePattern: typeof obj.replacePattern === 'string' ? obj.replacePattern : null,
        flags: typeof obj.flags === 'string' ? obj.flags : null
      });
    });
    return out;
  }

  // Resolves definitions with the same text inside one group into one entry each.
  function resolveGroup(defs) {
    const byText = new Map();
    defs.forEach(function (d) {
      if (!d.active) return;
      if (!byText.has(d.text)) byText.set(d.text, []);
      byText.get(d.text).push(d);
    });
    const result = [];
    byText.forEach(function (list) {
      const winner = list[list.length - 1];
      const first = list[0];
      const entry = Object.assign({}, winner, { notes: [] });
      if (list.length > 1) {
        entry.notes.push('replaces ' + list.slice(0, -1).map(function (d) { return d.label; }).join(', '));
      }
      if (winner.hasOrderKey && winner.order !== null) {
        // Its own order, rank and arrayIndex.
      } else {
        entry.rank = first.rank;
        entry.arrayIndex = first.arrayIndex;
        entry.posFrom = first.label;
        if (first !== winner) entry.notes.push('position of ' + first.label);
        if (!winner.hasOrderKey) {
          for (let i = list.length - 2; i >= 0; i--) {
            if (list[i].hasOrderKey) {
              entry.order = list[i].order;
              if (list[i].order !== null) entry.notes.push('order from ' + list[i].label);
              break;
            }
          }
        } else {
          entry.order = null;
          entry.notes.push('"order": null, nothing inherited');
        }
      }
      result.push(entry);
    });
    return result;
  }

  function compute(provider, defaults, allowReferral) {
    const warnings = [];
    const filters = [];
    const raw = collect(provider, 'rawRules', defaults, warnings, filters);
    const rules = collect(provider, 'rules', defaults, warnings, filters);
    const referralArray = collect(provider, 'referralMarketing', defaults, warnings, filters);

    const field = rules.filter(function (d) { return d.group === 'field'; });
    const referralDefs = rules.filter(function (d) { return d.group === 'referral'; }).concat(referralArray);

    let entries = resolveGroup(raw);
    let fieldEntries = resolveGroup(field);

    if (!allowReferral) {
      const referralEntries = resolveGroup(referralDefs);
      referralEntries.forEach(function (r) {
        const idx = fieldEntries.findIndex(function (f) { return f.text === r.text; });
        if (idx === -1) return;
        const f = fieldEntries[idx];
        fieldEntries.splice(idx, 1);
        r.notes.push('replaces field entry ' + f.label);
        if (!(r.hasOrderKey && r.order !== null)) {
          r.rank = f.rank;
          r.arrayIndex = f.arrayIndex;
          r.order = r.hasOrderKey ? null : f.order;
          r.notes.push('takes its place');
        }
      });
      entries = entries.concat(fieldEntries, referralEntries);
    } else {
      entries = entries.concat(fieldEntries);
    }

    entries.forEach(function (e) {
      e.orderGroup = typeof e.order === 'number' ? 0 : 1;
    });
    entries.sort(function (a, b) {
      return (a.stage - b.stage) ||
        (a.orderGroup - b.orderGroup) ||
        (a.orderGroup === 0 ? a.order - b.order : 0) ||
        (a.rank - b.rank) ||
        (a.arrayIndex - b.arrayIndex);
    });
    return { entries: entries, warnings: warnings, filters: filters };
  }

  // ---- Simulation: a URL through the sorted entries, one step at a time ----

  // A rewrite's §1§, §2§, … from the captured values.
  function fillReplace(pattern, values) {
    return pattern.replace(/§(\d+)§/g, function (_, n) { const v = values[Number(n) - 1]; return v === undefined ? '' : v; });
  }

  function decode(text) {
    try { return decodeURIComponent(text.replace(/\+/g, ' ')); } catch (e) { return text; }
  }

  // The query and the fragment as lists of raw "name=value" parts, so parts
  // nothing touches keep their exact text.
  function splitUrl(url) {
    const hashAt = url.indexOf('#');
    const beforeHash = hashAt === -1 ? url : url.slice(0, hashAt);
    const hash = hashAt === -1 ? null : url.slice(hashAt + 1);
    const queryAt = beforeHash.indexOf('?');
    return {
      base: queryAt === -1 ? beforeHash : beforeHash.slice(0, queryAt),
      query: queryAt === -1 ? null : beforeHash.slice(queryAt + 1).split('&').filter(Boolean),
      hash: hash === null ? null : (hash.indexOf('=') === -1 ? hash : hash.split('&').filter(Boolean)),
      hashIsParams: hash !== null && hash.indexOf('=') !== -1
    };
  }

  function joinUrl(parts) {
    let url = parts.base;
    if (parts.query && parts.query.length) url += '?' + parts.query.join('&');
    if (parts.hash !== null) {
      if (parts.hashIsParams) { if (parts.hash.length) url += '#' + parts.hash.join('&'); }
      else url += '#' + parts.hash;
    }
    return url;
  }

  // Calls `decide(name, value)` for every query and fragment parameter; it
  // returns null to keep the part, '' to drop it, or new raw part text,
  // which goes to the end of its list, as the engine writes a rewrite.
  function editParams(url, decide) {
    const parts = splitUrl(url);
    const edit = function (list) {
      const moved = [];
      const kept = list.reduce(function (out, part) {
        const eq = part.indexOf('=');
        const name = decode(eq === -1 ? part : part.slice(0, eq));
        const value = eq === -1 ? '' : decode(part.slice(eq + 1));
        const result = decide(name, value, part);
        if (result === null) out.push(part);
        else if (result !== '') moved.push(result);
        return out;
      }, []);
      return kept.concat(moved);
    };
    if (parts.query) parts.query = edit(parts.query);
    if (parts.hashIsParams) parts.hash = edit(parts.hash);
    return joinUrl(parts);
  }

  // The query as the engine writes it once it has changed it: each value
  // encoded, a parameter without a value written without "=". The fragment
  // stays as it is.
  function engineQuery(url) {
    const parts = splitUrl(url);
    if (!parts.query) return url;
    parts.query = parts.query.map(function (part) {
      const eq = part.indexOf('=');
      const name = decode(eq === -1 ? part : part.slice(0, eq));
      const value = eq === -1 ? '' : decode(part.slice(eq + 1));
      return value ? name + '=' + encodeURIComponent(value) : name;
    });
    return joinUrl(parts);
  }

  function makeRegex(source, flags) {
    try { return new RegExp(source, flags); } catch (e) { return null; }
  }

  // The name test of a $removeparam filter: "=name", "=/regex/flags", or every name.
  function removeParamTest(text) {
    const at = text.search(/\$removeparam(?:[=,]|$)/);
    const tail = text.slice(at + '$removeparam'.length);
    const value = tail.charAt(0) === '=' ? tail.slice(1).split(/,(?=[a-z~-]+(?:=|,|$))/)[0] : '';
    if (!value) return function () { return true; };
    const literal = /^\/(.*)\/([a-z]*)$/i.exec(value);
    if (literal) {
      const re = makeRegex(literal[1], literal[2]);
      return function (name, raw) { return !!re && (re.lastIndex = 0, re.test(raw)); };
    }
    return function (name) { return name === value; };
  }

  // One step on the URL; `rewritten` remembers rewrites, which apply once.
  function applyEntry(entry, url, rewritten) {
    if (entry.stage === 0) {
      let source = entry.text;
      const scoped = /[$,]rawrule=/i.exec(source);
      if (scoped) source = source.slice(scoped.index + scoped[0].length);
      if (!source) return url;
      const re = makeRegex(source, entry.flags || 'gi');
      if (!re) return url;
      if (entry.replacePattern !== null) {
        if (rewritten.has(entry.label)) return url;
        const next = url.replace(re, function () {
          const args = Array.prototype.slice.call(arguments);
          const groups = args.slice(1, typeof args[args.length - 1] === 'object' ? -3 : -2);
          return fillReplace(entry.replacePattern, groups.map(function (g) { return g === undefined ? '' : g; }));
        });
        if (next !== url) rewritten.add(entry.label);
        return next;
      }
      return url.replace(re, '').replace(/\?&/, '?').replace(/&&+/g, '&').replace(/[?&]$/, '');
    }
    const re = makeRegex('^(?:' + entry.text + ')$', entry.flags || 'i');
    if (!re) return url;
    if (entry.replacePattern !== null && rewritten.has(entry.label)) return url;
    let changed = false;
    const next = editParams(url, function (name, value) {
      if (!re.test(name)) return null;
      changed = true;
      if (entry.replacePattern === null) return '';
      return encodeURIComponent(name) + '=' + encodeURIComponent(fillReplace(entry.replacePattern, [value]));
    });
    if (changed && entry.replacePattern !== null) rewritten.add(entry.label);
    return next;
  }

  function applyFilters(filters, url) {
    if (!filters.length) return url;
    const keep = filters.filter(function (f) { return f.text.slice(0, 2) === '@@'; }).map(function (f) { return removeParamTest(f.text); });
    const drop = filters.filter(function (f) { return f.text.slice(0, 2) !== '@@'; }).map(function (f) { return removeParamTest(f.text); });
    return editParams(url, function (name, value, raw) {
      if (keep.some(function (t) { return t(name, raw); })) return null;
      return drop.some(function (t) { return t(name, raw); }) ? '' : null;
    });
  }

  // Every pass while the URL changes, at most 10 (CLN 1.0 Termination).
  function simulate(entries, filters, start) {
    const passes = [];
    const rewritten = new Set();
    const seen = new Set([start]);
    let current = start;
    for (let pass = 1; pass <= 10; pass++) {
      const steps = [];
      let url = current;
      entries.forEach(function (entry, index) {
        const before = url;
        url = applyEntry(entry, url, rewritten);
        steps.push({ entryIndex: index, label: entry.label, name: entry.name, before: before, after: url });
      });
      if (filters.length) {
        const before = url;
        url = applyFilters(filters, url);
        steps.push({ entryIndex: -1, label: '$removeparam', name: '$removeparam filters', before: before, after: url });
      }
      // Like the engine, a pass that changed the URL writes its query out again.
      if (url !== current) {
        const written = engineQuery(url);
        if (written !== url && steps.length) steps[steps.length - 1].after = written;
        url = written;
      }
      passes.push({ before: current, after: url, steps: steps });
      if (url === current || seen.has(url)) break;
      seen.add(url);
      current = url;
    }
    return passes;
  }

  // a → b as [kind, text] parts, compared by URL part, for highlighting.
  function diffUrls(a, b) {
    const split = function (t) { return t.split(/([\/?&#;])/).filter(function (p) { return p !== ''; }); };
    const x = split(a), y = split(b);
    const lcs = [];
    for (let i = 0; i <= x.length; i++) lcs.push(new Array(y.length + 1).fill(0));
    for (let i = x.length - 1; i >= 0; i--) {
      for (let j = y.length - 1; j >= 0; j--) {
        lcs[i][j] = x[i] === y[j] ? lcs[i + 1][j + 1] + 1 : Math.max(lcs[i + 1][j], lcs[i][j + 1]);
      }
    }
    const parts = [];
    const push = function (kind, text) {
      const last = parts[parts.length - 1];
      if (last && last[0] === kind) last[1] += text; else parts.push([kind, text]);
    };
    let i = 0, j = 0;
    while (i < x.length && j < y.length) {
      if (x[i] === y[j]) { push('same', x[i]); i++; j++; }
      else if (lcs[i + 1][j] >= lcs[i][j + 1]) push('del', x[i++]);
      else push('ins', y[j++]);
    }
    while (i < x.length) push('del', x[i++]);
    while (j < y.length) push('ins', y[j++]);
    return parts;
  }

  let lastResult = null;
  let rerunSimulation = function () {};

  document.addEventListener('DOMContentLoaded', function () {
    const input = document.getElementById('ro-input');
    if (!input) return;
    const select = document.getElementById('ro-provider');
    const referral = document.getElementById('ro-referral');
    const msg = document.getElementById('ro-msg');
    const out = document.getElementById('ro-out');
    const after = document.getElementById('ro-after');

    function cell(row, html, className) {
      const td = document.createElement('td');
      td.innerHTML = html;
      if (className) td.className = className;
      row.appendChild(td);
    }

    function esc(s) {
      return String(s).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
    }

    function run(keepSelection) {
      out.textContent = '';
      after.textContent = '';
      msg.className = 'tool-msg';
      let file;
      try {
        file = JSON.parse(input.value);
      } catch (e) {
        msg.className = 'tool-msg err';
        msg.textContent = 'Not valid JSON: ' + e.message;
        return;
      }
      const errors = [];
      if (file && hasOwn(file, 'cln') && file.cln !== '1.0') errors.push('cln is ' + JSON.stringify(file.cln) + ': the file is rejected. Its only valid value is "1.0".');
      const providers = file && file.providers;
      if (!providers || typeof providers !== 'object') {
        msg.className = 'tool-msg err';
        msg.textContent = 'The file needs a "providers" object.';
        return;
      }
      const keys = Object.keys(providers);
      const previous = select.value;
      select.textContent = '';
      keys.forEach(function (k) {
        const o = document.createElement('option');
        o.value = k;
        o.textContent = k;
        select.appendChild(o);
      });
      if (keepSelection && keys.includes(previous)) select.value = previous;
      if (!keys.length) { msg.textContent = 'No providers in the file.'; return; }

      const provider = providers[select.value];
      const defaults = (file.defaults && typeof file.defaults === 'object') ? file.defaults : {};
      const result = compute(provider, defaults, referral.checked);

      result.entries.forEach(function (e, i) {
        const tr = document.createElement('tr');
        cell(tr, String(i + 1));
        // Array position on top, the rule's id or text underneath.
        cell(tr, '<span class="ro-pos">' + esc(e.label) + '</span><span class="ro-name' + (e.name.startsWith('"') ? ' ro-text' : '') + '">' + esc(e.name) + '</span>');
        // One cell per part of (stage, orderGroup, order, rank, arrayIndex).
        [e.stage, e.orderGroup, e.orderGroup === 0 ? e.order : '–', e.rank, e.arrayIndex].forEach(function (v, j) {
          cell(tr, esc(v), j ? 'sk' : 'sk sk-first');
        });
        cell(tr, esc(e.notes.join('; ')), 'ro-notes');
        out.appendChild(tr);
      });
      // The Notes column only shows when some entry has a note.
      out.closest('table').classList.toggle('no-notes', !result.entries.some(function (e) { return e.notes.length; }));
      if (!result.entries.length) {
        const tr = document.createElement('tr');
        cell(tr, '');
        const empty = document.createElement('td');
        empty.colSpan = 6;
        empty.textContent = 'No entries run in stages 5 and 6.';
        tr.appendChild(empty);
        cell(tr, '', 'ro-notes');
        out.appendChild(tr);
      }
      const shownFilters = result.filters.filter(function (f) { return !(referral.checked && f.referral); });
      if (shownFilters.length) {
        after.innerHTML = 'Then, outside the sort: ' + shownFilters.map(function (f) { return '<code>' + esc(f.label + ' ' + JSON.stringify(f.text)) + '</code>'; }).join(', ') + '.';
      }
      lastResult = { entries: result.entries, filters: shownFilters.filter(function (f) { return f.active; }) };
      rerunSimulation();
      const all = errors.concat(result.warnings);
      if (all.length) {
        msg.className = 'tool-msg err';
        msg.innerHTML = '<ul>' + all.map(function (w) { return '<li>' + esc(w) + '</li>'; }).join('') + '</ul>';
      } else {
        msg.textContent = result.entries.length + ' entries in run order' + (referral.checked ? ', referral marketing allowed.' : ', referral marketing not allowed.');
      }
    }

    function load(sample) {
      input.value = JSON.stringify(SAMPLES[sample], null, 2);
      run(false);
    }

    let timer;
    input.addEventListener('input', function () { clearTimeout(timer); timer = setTimeout(function () { run(true); }, 200); });
    select.addEventListener('change', function () { run(true); });
    referral.addEventListener('change', function () { run(true); });
    document.getElementById('ro-sample').addEventListener('click', function () { load('shop'); });
    document.getElementById('ro-numbers').addEventListener('click', function () { load('numbers'); });

    // Simulation player
    const simForm = document.getElementById('ro-sim-form');
    const simUrl = document.getElementById('ro-url');
    const simOut = document.getElementById('ro-sim-out');
    const sim = { url: '', frames: [], cursor: 0, timer: null, result: '' };

    function framesFor(passes, start) {
      const frames = [{ kind: 'start', url: start, caption: 'The URL before any step' }];
      passes.forEach(function (pass, p) {
        if (pass.before === pass.after) {
          frames.push({ kind: 'done', url: pass.after, caption: 'Pass ' + (p + 1) + ' changes nothing, so cleaning stops' });
          return;
        }
        pass.steps.forEach(function (step, s) {
          frames.push({
            kind: 'step', url: step.after, before: step.before, entryIndex: step.entryIndex,
            changed: step.before !== step.after,
            caption: 'Pass ' + (p + 1) + ' · step ' + (s + 1) + ' of ' + pass.steps.length + ': ' + step.name +
              (step.before === step.after ? ' · no change' : '')
          });
        });
      });
      const last = passes[passes.length - 1];
      if (last && last.before !== last.after) frames.push({ kind: 'limit', url: last.after, caption: 'Stopped: 10 passes, or the URL came back to an earlier one' });
      return frames;
    }

    // Lets long URLs wrap before / ? & ; # rather than in the middle of a word.
    function urlText(s) { return s.split(/(?<![:\/])(?=\/)|(?=[?&;#])/).map(esc).join('<wbr>'); }

    function urlHtml(frame) {
      if (!frame.before || frame.before === frame.url) return urlText(frame.url);
      return diffUrls(frame.before, frame.url).map(function (part) {
        return part[0] === 'same' ? urlText(part[1]) : '<' + part[0] + '>' + urlText(part[1]) + '</' + part[0] + '>';
      }).join('');
    }

    const ICONS = {
      first: '<path d="M6 5v14M18 6l-8 6 8 6z"/>',
      prev: '<path d="M15 6l-6 6 6 6"/>',
      play: '<path d="M8 5.5v13l10-6.5z"/>',
      pause: '<path d="M8.5 5.5v13M15.5 5.5v13"/>',
      next: '<path d="M9 6l6 6-6 6"/>',
      last: '<path d="M18 5v14M6 6l8 6-8 6z"/>'
    };

    function highlightRow(frame) {
      out.querySelectorAll('tr.is-sim').forEach(function (tr) { tr.classList.remove('is-sim'); });
      if (frame && frame.kind === 'step' && frame.entryIndex >= 0 && out.rows[frame.entryIndex]) {
        out.rows[frame.entryIndex].classList.add('is-sim');
      }
    }

    function stop() { clearInterval(sim.timer); sim.timer = null; }

    function render(focusAction) {
      if (!sim.frames.length) { simOut.textContent = ''; highlightRow(null); return; }
      const frame = sim.frames[sim.cursor];
      const last = sim.frames.length - 1;
      const button = function (action, label, disabled, icon) {
        return '<button type="button" class="sim-btn" data-sim="' + action + '" aria-label="' + label + '" title="' + label + '"' + (disabled ? ' disabled' : '') + '>' +
          '<svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">' + ICONS[icon || action] + '</svg></button>';
      };
      simOut.innerHTML =
        '<div class="sim-player">' +
          '<div class="sim-controls" role="group" aria-label="Step through the simulation">' +
            button('first', 'Start', sim.cursor === 0) + button('prev', 'Previous', sim.cursor === 0) +
            button('play', sim.timer ? 'Pause' : 'Play', false, sim.timer ? 'pause' : 'play') +
            button('next', 'Next', sim.cursor >= last) + button('last', 'End', sim.cursor >= last) +
          '</div>' +
          '<p class="sim-caption" aria-live="polite">' + esc(frame.caption) + '</p>' +
          '<code class="sim-url">' + urlHtml(frame) + '</code>' +
        '</div>' +
        '<div class="sim-final"><p class="sim-result"><b>Result</b></p><code class="sim-url">' + urlText(sim.result) + '</code></div>' +
        '<ol class="sim-timeline">' + sim.frames.map(function (f, i) {
          return '<li class="' + (i === sim.cursor ? 'is-current' : '') + (f.kind === 'step' && !f.changed ? ' is-unchanged' : '') + '">' +
            '<button type="button" data-frame="' + i + '"' + (i === sim.cursor ? ' aria-current="step"' : '') + '>' + esc(f.caption) + '</button></li>';
        }).join('') + '</ol>';
      highlightRow(frame);
      if (focusAction) {
        const target = simOut.querySelector('[data-sim="' + focusAction + '"]:not([disabled])') || simOut.querySelector('[data-sim="play"]');
        if (target) target.focus();
      }
    }

    function go(cursor, focusAction) {
      sim.cursor = Math.max(0, Math.min(cursor, sim.frames.length - 1));
      if (sim.cursor >= sim.frames.length - 1) stop();
      render(focusAction);
    }

    function simulateNow(keepCursor) {
      stop();
      if (!sim.url || !lastResult) { sim.frames = []; render(); return; }
      const start = sim.url;
      let valid = false;
      try { valid = /^https?:$/.test(new URL(start).protocol); } catch (e) { valid = false; }
      if (!valid) {
        sim.frames = [];
        simOut.innerHTML = '<p class="tool-msg err">Enter a full http:// or https:// URL, such as https://shop.example/?utm_source=x.</p>';
        highlightRow(null);
        return;
      }
      const passes = simulate(lastResult.entries, lastResult.filters, start);
      sim.frames = framesFor(passes, start);
      sim.result = passes.length ? passes[passes.length - 1].after : start;
      if (!keepCursor) sim.cursor = 0;
      go(sim.cursor);
    }
    rerunSimulation = function () { simulateNow(true); };

    // Steps forward on its own until the last frame.
    function play(focusAction) {
      stop();
      if (!sim.frames.length) return;
      if (sim.cursor >= sim.frames.length - 1) sim.cursor = 0;
      sim.timer = setInterval(function () { go(sim.cursor + 1); }, 900);
      render(focusAction);
    }

    // Run starts from the first step and plays, so a run always shows: the
    // first frame alone looks the same as before it.
    simForm.addEventListener('submit', function (event) {
      event.preventDefault();
      sim.url = simUrl.value.trim();
      simulateNow(false);
      play();
    });
    simOut.addEventListener('click', function (event) {
      const frameButton = event.target.closest('[data-frame]');
      if (frameButton) { stop(); go(Number(frameButton.getAttribute('data-frame'))); return; }
      const action = event.target.closest('[data-sim]');
      if (!action || action.disabled) return;
      const name = action.getAttribute('data-sim');
      if (name === 'play') {
        if (sim.timer) { stop(); render('play'); return; }
        play('play');
        return;
      }
      stop();
      go({ first: 0, prev: sim.cursor - 1, next: sim.cursor + 1, last: sim.frames.length - 1 }[name], name);
    });

    // The worked example runs on a sample URL straight away.
    simUrl.value = 'https://shop.example/item/ref=abc;jsessionid=XYZ?token=abc123&sid=9&utm_source=x&fbclid=y&aff_id=1&tag=t&pk_campaign=c&keep=1';
    sim.url = simUrl.value;
    load('shop');
  });
})();
