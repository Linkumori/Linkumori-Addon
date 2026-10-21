// "Which sources load" explorer on rules.html.
// Mirrors loadBundledRules() in core_js/storage.js: which base rule set loads for a given
// combination of settings and remote results, before custom rules go on top.
(function () {
  'use strict';

  // Returns the base rule set and the steps taken to reach it.
  function decide(s) {
    const steps = [];
    const builtIn = s.builtin === 'on';
    const overload = s.overload === 'on' && builtIn;

    if (!builtIn && s.remote === 'off') {
      steps.push('Built-in and remote rules are both off.');
      return { base: [], steps: steps };
    }
    if (s.remote === 'off') {
      steps.push('Remote rules are off, so the built-in rules load.');
      return { base: ['builtin'], steps: steps };
    }

    steps.push('Remote rules are on: every rule file is fetched and checked against its hash.');
    if (s.fetch !== 'none') {
      steps.push(s.fetch === 'ok'
        ? 'Every file passed. They merge, in the order listed, and are saved as the verified cache.'
        : 'Some files passed. Those merge and are saved as the verified cache; the rest are reported in Remote Rules Health.');
      if (overload) {
        steps.push('Overload mode is on: the remote rules merge with the built-in rules, built-in providers first.');
        return { base: ['builtin', 'remote'], merged: true, steps: steps };
      }
      steps.push(s.overload === 'on'
        ? 'Overload mode is on but built-in rules are off, so only the remote rules load.'
        : 'Overload mode is off, so the remote rules replace the built-in ones.');
      return { base: ['remote'], steps: steps };
    }

    steps.push('Every file failed to load or verify.');
    if (s.cache === 'yes') {
      if (overload) {
        steps.push('The verified cache for these files loads, merged with the built-in rules.');
        return { base: ['builtin', 'cache'], merged: true, steps: steps };
      }
      steps.push('The verified cache for these files loads instead.');
      return { base: ['cache'], steps: steps };
    }
    if (builtIn) {
      steps.push('There is no verified cache, so the built-in rules load.');
      return { base: ['builtin'], steps: steps };
    }
    steps.push('There is no verified cache and built-in rules are off.');
    return { base: [], steps: steps };
  }

  const LAYERS = {
    custom: { label: 'Custom rules', note: 'On top: replace matching providers, add the rest', cls: 'rx-o-custom' },
    remote: { label: 'Remote rules', note: 'Files that passed, merged in listed order', cls: 'rx-o-remote' },
    cache: { label: 'Verified cache', note: 'Last remote rules that passed', cls: 'rx-o-cache' },
    builtin: { label: 'Built-in rules', note: 'Ship with the extension', cls: 'rx-o-builtin' }
  };

  document.addEventListener('DOMContentLoaded', function () {
    const root = document.getElementById('rx-explorer');
    if (!root) return;
    const summary = document.getElementById('rx-summary');
    const stack = document.getElementById('rx-stack');
    const path = document.getElementById('rx-path');

    function value(name) {
      const checked = root.querySelector('input[name="rx-' + name + '"]:checked');
      return checked ? checked.value : '';
    }

    function render() {
      const s = {
        builtin: value('builtin'), remote: value('remote'), fetch: value('fetch'),
        cache: value('cache'), overload: value('overload'), custom: value('custom')
      };
      // Only show the questions that matter for the current answers.
      root.querySelector('[data-when="remote"]').hidden = s.remote !== 'on';
      root.querySelector('[data-when="failed"]').hidden = !(s.remote === 'on' && s.fetch === 'none');

      const r = decide(s);
      const layers = (s.custom === 'yes' ? ['custom'] : []).concat(r.base.slice().reverse());
      const steps = r.steps.slice();
      if (s.custom === 'yes') {
        steps.push(r.base.length
          ? 'Your custom rules go on top: each replaces a provider with the same pattern and settings, or is added.'
          : 'Only your custom rules load.');
      }
      steps.push('Providers and rules you switched off are left out.');

      const names = r.base.map(function (k) { return LAYERS[k].label.toLowerCase(); });
      let text;
      if (!layers.length) text = 'No rules load, so nothing is cleaned.';
      else if (!r.base.length) text = 'Only your custom rules run.';
      else {
        text = (r.merged ? names.join(' and ') + ', merged' : names[0]).replace(/^./, function (c) { return c.toUpperCase(); });
        text += s.custom === 'yes' ? ', with your custom rules on top.' : '.';
      }
      summary.textContent = text;

      stack.textContent = '';
      layers.forEach(function (k, i) {
        const el = document.createElement('div');
        el.className = 'rx-layer ' + LAYERS[k].cls;
        if (r.merged && k !== 'custom') el.classList.add('rx-merged');
        const label = document.createElement('b');
        label.textContent = LAYERS[k].label;
        const note = document.createElement('small');
        note.textContent = r.merged && k !== 'custom' ? 'Merged into one set with the layer ' + (i === layers.length - 1 ? 'above' : 'below') : LAYERS[k].note;
        el.appendChild(label);
        el.appendChild(note);
        stack.appendChild(el);
      });
      if (!layers.length) {
        const empty = document.createElement('div');
        empty.className = 'rx-layer rx-empty';
        empty.textContent = 'No rule set';
        stack.appendChild(empty);
      }

      path.textContent = '';
      steps.forEach(function (t) {
        const li = document.createElement('li');
        li.textContent = t;
        path.appendChild(li);
      });
    }

    root.addEventListener('change', render);
    render();
  });

  // Case galleries: one case at a time, picked from a row of buttons. Without this
  // script every case simply shows, one after another.
  document.addEventListener('DOMContentLoaded', function () {
    document.querySelectorAll('[data-cases]').forEach(function (gallery) {
      const cases = Array.from(gallery.querySelectorAll('.case'));
      if (cases.length < 2) return;
      const nav = document.createElement('div');
      nav.className = 'cases-nav';
      nav.setAttribute('role', 'tablist');
      nav.setAttribute('aria-label', gallery.getAttribute('aria-label') || 'Cases');
      const buttons = cases.map(function (c, i) {
        const b = document.createElement('button');
        b.type = 'button';
        b.setAttribute('role', 'tab');
        b.id = c.id + '-tab';
        b.setAttribute('aria-controls', c.id);
        b.innerHTML = '<span class="cases-nav-num">' + (i + 1) + '</span>';
        b.appendChild(document.createTextNode(c.getAttribute('data-case-title')));
        c.setAttribute('role', 'tabpanel');
        c.setAttribute('aria-labelledby', b.id);
        b.addEventListener('click', function () { show(i, true); });
        b.addEventListener('keydown', function (e) {
          const step = e.key === 'ArrowRight' || e.key === 'ArrowDown' ? 1 : e.key === 'ArrowLeft' || e.key === 'ArrowUp' ? -1 : 0;
          if (!step) return;
          e.preventDefault();
          const next = (i + step + cases.length) % cases.length;
          show(next, true);
          buttons[next].focus();
        });
        nav.appendChild(b);
        return b;
      });
      gallery.insertBefore(nav, gallery.firstChild);
      gallery.classList.add('is-picker');

      function show(index, fromUser) {
        cases.forEach(function (c, i) {
          c.classList.toggle('is-active', i === index);
          buttons[i].setAttribute('aria-selected', String(i === index));
          buttons[i].tabIndex = i === index ? 0 : -1;
        });
        if (fromUser && history.replaceState) history.replaceState(null, '', '#' + cases[index].id);
      }
      // A link to a case (rules.html#ov-inherit) opens that case, on load or later.
      function openFromHash() {
        const index = cases.findIndex(function (c) { return '#' + c.id === location.hash; });
        if (index === -1) return false;
        show(index, false);
        gallery.scrollIntoView();
        return true;
      }
      if (!openFromHash()) show(0, false);
      window.addEventListener('hashchange', openFromHash);
    });
  });
})();
