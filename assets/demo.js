// A small in-page URL cleaner for the home page.
// It runs a handful of CLN-style providers locally; the extension's engine is far more complete.
(function () {
  'use strict';

  const providers = {
    global: {
      domainPatterns: ['*'],
      rules: ['utm_[a-z_]+', 'fbclid', 'gclid', 'dclid', 'gbraid', 'wbraid', 'msclkid', 'yclid',
        'mc_cid', 'mc_eid', '_hsenc', '_hsmi', 'igshid', 'twclid', 'ttclid', 'mkt_tok', 'oly_[a-z_]+', 'vero_[a-z_]+']
    },
    amazon: {
      domainPatterns: ['||amazon.*^'],
      rawRules: ['\\/ref=[^/?]*'],
      rules: ['pd_rd_[a-z]*', 'pf_rd_[a-z]*', 'qid', 'sr', 'keywords', '__mk_[a-z]{1,3}_[a-z]{1,3}', 'crid', 'sprefix', 'content-id', 'th', 'psc'],
      referralMarketing: ['tag']
    },
    youtube: {
      domainPatterns: ['||youtube.com^', '||youtu.be^'],
      rules: ['si', 'feature', 'pp']
    },
    google: {
      domainPatterns: ['||google.*^'],
      fieldRedirections: ['url', 'q'],
      rules: ['ved', 'ei', 'sca_esv', 'sxsrf', 'gs_lcrp', 'gs_lp', 'oq', 'sclient', 'uact', 'source', 'sourceid', 'iflsig', 'rlz']
    }
  };

  // Matches the `||name.*^` and `||host^` forms against a hostname.
  function hostMatches(pattern, host) {
    if (pattern === '*') return true;
    const m = /^\|\|(.+)\^$/.exec(pattern);
    if (!m) return false;
    const body = m[1];
    const labels = host.split('.');
    for (let i = 0; i < labels.length; i++) {
      const tail = labels.slice(i).join('.');
      if (body.endsWith('.*')) {
        const name = body.slice(0, -2);
        if (tail.startsWith(name + '.') && tail.length > name.length + 1) return true;
      } else if (tail === body) {
        return true;
      }
    }
    return false;
  }

  function nameMatcher(entry) {
    return new RegExp('^(?:' + entry + ')$', 'i');
  }

  function clean(input, allowReferral) {
    let url;
    try { url = new URL(input.trim()); } catch (e) { return null; }
    if (!/^https?:$/.test(url.protocol)) return null;

    const removed = [];
    let redirected = false;

    for (const key of Object.keys(providers)) {
      const p = providers[key];
      if (!p.domainPatterns.some(function (d) { return hostMatches(d, url.hostname); })) continue;

      // fieldRedirections: a parameter whose value is the real destination.
      if (p.fieldRedirections && url.pathname === '/url') {
        for (const field of p.fieldRedirections) {
          const v = url.searchParams.get(field);
          if (!v) continue;
          try {
            const target = new URL(v);
            if (/^https?:$/.test(target.protocol) && target.host) {
              redirected = true;
              const inner = clean(target.href, allowReferral);
              return { url: inner ? inner.url : target.href, removed: ['redirect → ' + target.host].concat(inner ? inner.removed : []), redirected: true };
            }
          } catch (e) { /* not an absolute URL: no redirect */ }
        }
      }

      // rawRules run first, against the whole URL.
      for (const raw of p.rawRules || []) {
        const re = new RegExp(raw, 'g');
        const before = url.href;
        const after = before.replace(re, function (m) { removed.push(m); return ''; });
        if (after !== before) url = new URL(after);
      }

      // rules, then referralMarketing unless referral marketing is allowed.
      const lists = (p.rules || []).concat(allowReferral ? [] : (p.referralMarketing || []));
      const matchers = lists.map(nameMatcher);
      for (const name of Array.from(new Set(url.searchParams.keys()))) {
        if (matchers.some(function (re) { return re.test(name); })) {
          url.searchParams.getAll(name).forEach(function (v) { removed.push(v ? name + '=' + v : name); });
          url.searchParams.delete(name);
        }
      }
    }

    let out = url.href;
    if (!url.search) out = out.replace('?', '');
    return { url: out, removed: removed, redirected: redirected };
  }

  document.addEventListener('DOMContentLoaded', function () {
    const input = document.getElementById('demo-in');
    const output = document.getElementById('demo-out');
    const chips = document.getElementById('demo-removed');
    const referral = document.getElementById('demo-referral');
    const copy = document.getElementById('demo-copy');
    if (!input || !output) return;

    function render() {
      const result = clean(input.value, referral && referral.checked);
      chips.textContent = '';
      if (!result) {
        output.textContent = input.value.trim() ? 'Enter a full http(s) URL.' : '';
        return;
      }
      output.textContent = result.url;
      if (!result.removed.length) {
        const none = document.createElement('span');
        none.className = 'demo-note';
        none.style.margin = '0';
        none.textContent = 'Nothing to remove — this link is already clean.';
        chips.appendChild(none);
      }
      result.removed.forEach(function (r) {
        const c = document.createElement('span');
        c.className = 'chip';
        c.textContent = r.length > 48 ? r.slice(0, 45) + '…' : r;
        c.title = r;
        chips.appendChild(c);
      });
    }

    input.addEventListener('input', render);
    if (referral) referral.addEventListener('change', render);
    document.querySelectorAll('[data-sample]').forEach(function (b) {
      b.addEventListener('click', function () { input.value = b.getAttribute('data-sample'); render(); });
    });
    if (copy) {
      copy.addEventListener('click', function () {
        const text = output.textContent;
        if (!text || !navigator.clipboard) return;
        navigator.clipboard.writeText(text).then(function () {
          copy.textContent = 'Copied';
          setTimeout(function () { copy.textContent = 'Copy'; }, 1400);
        }, function () { /* clipboard blocked */ });
      });
    }
    render();
  });
})();
