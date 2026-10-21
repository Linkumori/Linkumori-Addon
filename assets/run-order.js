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
        filters.push(label + ' ' + JSON.stringify(obj.matchPattern));
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
        active: active
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

  document.addEventListener('DOMContentLoaded', function () {
    const input = document.getElementById('ro-input');
    if (!input) return;
    const select = document.getElementById('ro-provider');
    const referral = document.getElementById('ro-referral');
    const msg = document.getElementById('ro-msg');
    const out = document.getElementById('ro-out');
    const after = document.getElementById('ro-after');

    function cell(row, html) {
      const td = document.createElement('td');
      td.innerHTML = html;
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
        cell(tr, '<code>' + esc(e.label) + '</code> ' + (e.name.startsWith('"') ? '<code>' + esc(e.name) + '</code>' : esc(e.name)));
        cell(tr, '<code>(' + [e.stage, e.orderGroup, e.orderGroup === 0 ? e.order : '–', e.rank, e.arrayIndex].join(', ') + ')</code>');
        cell(tr, esc(e.notes.join('; ')));
        out.appendChild(tr);
      });
      if (!result.entries.length) {
        const tr = document.createElement('tr');
        cell(tr, '');
        cell(tr, 'No entries run in stages 5 and 6.');
        cell(tr, '');
        cell(tr, '');
        out.appendChild(tr);
      }
      if (result.filters.length) {
        after.innerHTML = 'Then, outside the sort: ' + result.filters.map(function (f) { return '<code>' + esc(f) + '</code>'; }).join(', ') + '.';
      }
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
    load('shop');
  });
})();
