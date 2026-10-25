/* AdGuard / uBlock Origin filter list → Linkumori CLN 1.0 converter core, for converter.html.
 * Pure functions; no DOM. Exposes `CLNConverter` (browser) or module.exports (Node). */
(function (root) {
  'use strict';

  // ---------------------------------------------------------------------------
  // Preprocessor profiles (!#if tokens that evaluate to true)
  // ---------------------------------------------------------------------------
  const PROFILES = {
    linkumori: {
      label: 'Linkumori (Firefox)',
      hint: 'Not uBO, not AdGuard: keeps generic and !ext_ubol / !adguard_* branches.',
      tokens: ['env_firefox']
    },
    ublock: {
      label: 'uBlock Origin (Firefox)',
      hint: 'Branches meant for uBO on Firefox.',
      tokens: ['ext_ublock', 'env_firefox', 'cap_html_filtering', 'cap_user_stylesheet', 'cap_ipaddress']
    },
    adguardExt: {
      label: 'AdGuard browser extension (Firefox)',
      hint: 'Branches meant for AdGuard’s Firefox extension.',
      tokens: ['adguard', 'adguard_ext_firefox', 'env_firefox']
    },
    adguardWin: {
      label: 'AdGuard for Windows',
      hint: 'Branches meant for the AdGuard desktop app.',
      tokens: ['adguard', 'adguard_app_windows']
    },
    custom: { label: 'Custom tokens', hint: 'Type the !#if tokens that should count as true.', tokens: [] },
    all: { label: 'Keep every branch', hint: 'Ignore !#if / !#else and convert everything.', tokens: [] }
  };

  // ---------------------------------------------------------------------------
  // Modifier tables
  // ---------------------------------------------------------------------------
  const TYPE_ALIASES = {
    document: 'document', doc: 'document',
    subdocument: 'subdocument', frame: 'subdocument',
    script: 'script',
    stylesheet: 'stylesheet', css: 'stylesheet',
    image: 'image', media: 'media', font: 'font', object: 'object',
    xmlhttprequest: 'xmlhttprequest', xhr: 'xmlhttprequest',
    websocket: 'websocket', ping: 'ping', beacon: 'ping', other: 'other'
  };
  const TYPE_ORDER = ['document', 'subdocument', 'script', 'stylesheet', 'image', 'media', 'font',
    'object', 'xmlhttprequest', 'websocket', 'ping', 'other'];
  const PARTY_ALIASES = {
    'first-party': 'first-party', '1p': 'first-party',
    'third-party': 'third-party', '3p': 'third-party',
    'strict-first-party': 'strict-first-party', 'strict1p': 'strict-first-party',
    'strict-third-party': 'strict-third-party', 'strict3p': 'strict-third-party'
  };
  const PARTY_NEGATION = { 'first-party': 'third-party', 'third-party': 'first-party' };
  const PARTY_ORDER = ['first-party', 'third-party', 'strict-first-party', 'strict-third-party'];
  const METHODS = new Set(['get', 'head', 'options', 'post', 'put', 'patch', 'delete', 'connect']);
  const UNSUPPORTED_REASONS = {
    app: 'AdGuard app-only modifier (app=); a browser extension has no equivalent',
    header: 'response-header matching is not part of CLN',
    redirect: 'resource redirects are not URL cleaning',
    'redirect-rule': 'resource redirects are not URL cleaning',
    csp: 'CSP injection is not URL cleaning',
    permissions: 'Permissions-Policy injection is not URL cleaning',
    cookie: 'cookie rules are not URL cleaning',
    stealth: 'Stealth mode rules are AdGuard-only',
    popup: 'popup blocking is not URL cleaning',
    urltransform: '$urltransform has no 1:1 CLN form (use rawRules with replacePattern by hand)',
    uritransform: '$uritransform has no 1:1 CLN form (use rawRules with replacePattern by hand)',
    urlskip: '$urlskip has no 1:1 CLN form (consider fieldRedirections by hand)',
    replace: '$replace edits response bodies, not URLs',
    jsonprune: 'response-body rule', hls: 'response-body rule', network: 'AdGuard network rule',
    removeheader: 'header rule', referrerpolicy: 'header rule'
  };

  // ---------------------------------------------------------------------------
  // Text helpers (mirror Linkumori's own splitters so the output re-parses the same way)
  // ---------------------------------------------------------------------------
  function splitModifiers(text) {
    const parts = [];
    let current = '', inRegex = false, escaped = false;
    for (let i = 0; i < text.length; i++) {
      const ch = text.charAt(i), next = i + 1 < text.length ? text.charAt(i + 1) : '';
      if (!inRegex) {
        if (ch === '\\' && next) { current += ch + next; i++; continue; }
        if (ch === ',') { if (current.trim()) parts.push(current.trim()); current = ''; continue; }
        current += ch;
        if ((ch === '=' || ch === '|') && (next === '/' || (next === '~' && text.charAt(i + 2) === '/'))) {
          current += next === '~' ? '~/' : '/';
          inRegex = true; escaped = false;
          i += next === '~' ? 2 : 1;
        }
        continue;
      }
      current += ch;
      if (escaped) { escaped = false; continue; }
      if (ch === '\\') { escaped = true; continue; }
      if (ch === '/') inRegex = false;
    }
    if (current.trim()) parts.push(current.trim());
    return parts;
  }

  function splitDelimited(value) {
    const values = [];
    let current = '', inRegex = false, escaped = false;
    for (const ch of String(value || '')) {
      if (!inRegex && ch === '|') { if (current.trim()) values.push(current.trim()); current = ''; continue; }
      current += ch;
      if (escaped) { escaped = false; continue; }
      if (ch === '\\') { escaped = true; continue; }
      if (ch === '/') inRegex = !inRegex;
    }
    if (current.trim()) values.push(current.trim());
    return values;
  }

  // Where the options start: after a /regex/ pattern's closing slash, else the first '$'.
  function findModifierStart(text) {
    if (text.startsWith('/')) {
      let escaped = false;
      for (let i = 1; i < text.length; i++) {
        const ch = text.charAt(i);
        if (escaped) { escaped = false; continue; }
        if (ch === '\\') { escaped = true; continue; }
        if (ch === '/') {
          // Only accept this slash as the regex end if a '$' follows it directly;
          // otherwise the pattern is a plain path ("/b/ref=") and the first '$' wins.
          if (text.charAt(i + 1) === '$') return i + 1;
        }
      }
    }
    return text.indexOf('$');
  }

  // Escape every unescaped '/' in a regex body (outside [...] too), so
  // Linkumori's /((?:\\.|[^/])+)/ literal parser sees one regex.
  function escapeInnerSlashes(body) {
    let out = '', escaped = false;
    for (const ch of body) {
      if (escaped) { out += ch; escaped = false; continue; }
      if (ch === '\\') { out += ch; escaped = true; continue; }
      out += ch === '/' ? '\\/' : ch;
    }
    return out;
  }

  function replaceRegexDollars(body) {
    let out = '', inClass = false;
    for (let i = 0; i < body.length; i++) {
      const ch = body[i];
      if (ch === '\\') {
        const next = body[i + 1];
        out += next === '$' ? '\\x24' : ch + (next === undefined ? '' : next);
        i++;
        continue;
      }
      if (inClass) { if (ch === ']') inClass = false; out += ch === '$' ? '\\x24' : ch; continue; }
      if (ch === '[') { inClass = true; out += ch; continue; }
      out += ch === '$' ? '(?![\\s\\S])' : ch;
    }
    return out;
  }

  function isValidRegex(body, flags) {
    try { new RegExp(body, flags || ''); return true; } catch (e) { return false; }
  }

  // ---------------------------------------------------------------------------
  // !#if expression evaluation
  // ---------------------------------------------------------------------------
  function evalCondition(expr, tokenSet) {
    const toks = String(expr).match(/!|&&|\|\||\(|\)|[A-Za-z0-9_]+|\S/g) || [];
    let i = 0;
    function primary() {
      const t = toks[i++];
      if (t === '!') return !primary();
      if (t === '(') {
        const v = orExpr();
        if (toks[i] !== ')') throw new Error('missing )');
        i++;
        return v;
      }
      if (t === undefined) throw new Error('unexpected end');
      if (!/^[A-Za-z0-9_]+$/.test(t)) throw new Error('unexpected “' + t + '”');
      if (t === 'true') return true;
      if (t === 'false') return false;
      return tokenSet.has(t);
    }
    function andExpr() { let v = primary(); while (toks[i] === '&&') { i++; const r = primary(); v = v && r; } return v; }
    function orExpr() { let v = andExpr(); while (toks[i] === '||') { i++; const r = andExpr(); v = v || r; } return v; }
    const v = orExpr();
    if (i < toks.length) throw new Error('unexpected “' + toks[i] + '”');
    return v;
  }

  // ---------------------------------------------------------------------------
  // Cosmetic / scriptlet detection
  // ---------------------------------------------------------------------------
  const COSMETIC_RE = /#@?(?:\$\??|%|\?)?#|\$@?\$|#\+js\(/;

  // ---------------------------------------------------------------------------
  // $removeparam value conversion
  // ---------------------------------------------------------------------------
  function convertValue(raw, notes) {
    if (raw === null || raw === undefined || raw === '') return { text: '' };
    let neg = false, r = raw;
    if (r.startsWith('~')) { neg = true; r = r.slice(1); }
    if (r.startsWith('/')) {
      const last = r.lastIndexOf('/');
      const flags = last > 0 ? r.slice(last + 1) : null;
      if (last > 0 && /^[a-z]*$/i.test(flags)) {
        let body = r.slice(1, last);
        if (!body) return { error: 'empty regex value' };
        const fixed = escapeInnerSlashes(body);
        if (fixed !== body) notes.push('escaped “/” inside the regex value');
        body = fixed;
        if (!isValidRegex(body, flags.includes('i') ? 'i' : '')) return { error: 'regex value does not compile in JavaScript' };
        if (/[^i]/i.test(flags)) notes.push('regex flags other than “i” are ignored by Linkumori');
        // In "~/…=/" a "=" right before a "/" makes lint-rules' splitter start a new
        // regex there; "\=" means the same in JavaScript and parses everywhere.
        if (neg && /(^|[^\\])(\\\\)*=\//.test(body + '/')) {
          let out = '', esc = false;
          for (const ch of body) {
            if (esc) { out += ch; esc = false; continue; }
            if (ch === '\\') { out += ch; esc = true; continue; }
            out += ch === '=' ? '\\=' : ch;
          }
          if (isValidRegex(out, flags.includes('i') ? 'i' : '')) { body = out; notes.push('“=” escaped in the negated regex value for lint-rules'); }
        }
        return { text: (neg ? '~' : '') + '/' + body + '/' + flags };
      }
    }
    // Plain parameter name. AdGuard escapes "," (and "$") with a backslash.
    const name = r.replace(/\\([,$\\])/g, '$1');
    let out = name.replace(/\\/g, '\\\\').replace(/,/g, '\\,');
    if (/^[~|/]/.test(out)) out = '\\' + out;
    return { text: (neg ? '~' : '') + out };
  }

  // ---------------------------------------------------------------------------
  // URL pattern conversion
  // ---------------------------------------------------------------------------
  function convertPattern(pattern, matchCase, notes) {
    let p = pattern.trim();
    if (p === '*' || p === '') return { text: '' };
    if (p.length > 2 && p.startsWith('/') && p.endsWith('/')) {
      let body = escapeInnerSlashes(p.slice(1, -1));
      if (!isValidRegex(body, 'i')) return { error: 'regex URL pattern does not compile in JavaScript' };
      // Some CLN tools split a rule at its first "$", so the pattern must not
      // contain one: "$" anchors become (?![\s\S]), literal "$" becomes \x24.
      const noDollar = replaceRegexDollars(body);
      if (noDollar !== body) {
        if (!isValidRegex(noDollar, 'i')) return { error: 'could not rewrite “$” in the regex URL pattern' };
        notes.push('“$” in the regex pattern rewritten so the rule splits at the right “$”');
        body = noDollar;
      }
      // AdGuard regex patterns are case-insensitive unless $match-case.
      return { text: '/' + body + '/' + (matchCase ? '' : 'i'), regex: true };
    }
    // A plain pattern starting with "/" ("/search.php", "/b/ref=") is read by
    // Linkumori as a possible /regex/: it looks for the closing slash and can
    // split the rule at a "$" inside a later regex value, or take "/news/gi"
    // as a regex. A leading "*" means the same thing (substring match) and
    // avoids both.
    if (p.startsWith('/')) {
      notes.push('prefixed “*” so Linkumori reads the leading “/” as a path, not a regex');
      p = '*' + p;
    }
    return { text: p };
  }

  // ---------------------------------------------------------------------------
  // One network rule
  // ---------------------------------------------------------------------------
  function convertNetworkRule(line, opts) {
    const notes = [];
    let body = line, exc = false;
    if (body.startsWith('@@')) { exc = true; body = body.slice(2); }
    const k = findModifierStart(body);
    if (k === -1) return { status: 'skipped', reason: exc ? 'allowlist rule without modifiers: it only unblocks requests' : 'blocking rule: no $removeparam to convert' };
    const rawPattern = body.slice(0, k);
    const tokens = splitModifiers(body.slice(k + 1).trim());
    const st = {
      hasRemove: false, remove: null, types: new Set(), notTypes: new Set(), party: new Set(),
      domain: [], to: [], method: [], matchCase: false, important: false, badfilter: false
    };
    for (const tok of tokens) {
      let t = tok, neg = false;
      if (t.startsWith('~')) { neg = true; t = t.slice(1); }
      const eq = t.indexOf('=');
      const name = (eq === -1 ? t : t.slice(0, eq)).trim().toLowerCase();
      const val = eq === -1 ? null : t.slice(eq + 1);
      if (name === 'removeparam' || name === 'queryprune') {
        if (neg) return { status: 'skipped', reason: 'negated $removeparam is not valid' };
        if (name === 'queryprune') notes.push('$queryprune renamed to $removeparam');
        st.hasRemove = true; st.remove = val; continue;
      }
      if (TYPE_ALIASES[name] && val === null) { (neg ? st.notTypes : st.types).add(TYPE_ALIASES[name]); continue; }
      if (PARTY_ALIASES[name] && val === null) {
        let p = PARTY_ALIASES[name];
        if (neg) {
          if (!PARTY_NEGATION[p]) return { status: 'skipped', reason: 'unsupported modifier ' + tok };
          p = PARTY_NEGATION[p];
        }
        st.party.add(p); continue;
      }
      if ((name === 'domain' || name === 'from') && val !== null && !neg) { st.domain.push(...splitDelimited(val)); continue; }
      if (name === 'to' && val !== null && !neg) { st.to.push(...splitDelimited(val)); continue; }
      if (name === 'denyallow' && val !== null && !neg) {
        splitDelimited(val).forEach(v => st.to.push(v.startsWith('~') ? v.slice(1) : '~' + v));
        notes.push('$denyallow rewritten as to=~…');
        continue;
      }
      if (name === 'method' && val !== null && !neg) {
        const ms = splitDelimited(val).map(v => v.toLowerCase());
        const bad = ms.find(v => !METHODS.has(v.replace(/^~/, '')));
        if (bad) return { status: 'skipped', reason: 'unsupported HTTP method ' + bad };
        st.method.push(...ms); continue;
      }
      if (name === 'match-case' && val === null) { if (!neg) st.matchCase = true; continue; }
      if (name === 'important' && val === null) { st.important = true; continue; }
      if (name === 'badfilter' && val === null) { st.badfilter = true; continue; }
      if (name === 'all' && val === null) { notes.push('$all dropped (no effect on parameter removal)'); continue; }
      if (/^_+$/.test(name)) continue; // uBO no-op
      const why = UNSUPPORTED_REASONS[name];
      return { status: 'skipped', reason: 'unsupported modifier $' + tok + (why ? ' — ' + why : '') };
    }

    const partyConflict =
      (st.party.has('first-party') && st.party.has('third-party')) ||
      (st.party.has('strict-first-party') && st.party.has('strict-third-party')) ||
      (st.party.has('strict-first-party') && st.party.has('third-party')) ||
      (st.party.has('strict-third-party') && st.party.has('first-party'));
    if (partyConflict) return { status: 'skipped', reason: 'contradictory party modifiers' };

    let docException = false;
    if (!st.hasRemove) {
      if (exc && st.types.has('document') && opts.docExceptions) {
        docException = true;
        st.types.clear(); st.notTypes.clear();
        notes.push('@@…$document turned into @@…$removeparam (keeps every parameter on that page)');
      } else {
        return {
          status: 'skipped',
          reason: exc ? 'allowlist rule that does not touch $removeparam' : 'network rule without $removeparam (blocking, redirect, etc.)'
        };
      }
    }

    if (st.important) {
      if (opts.important === 'skip') return { status: 'skipped', reason: '$important rule (set to skip)' };
      notes.push('$important dropped: CLN has no priority, so @@ exceptions win');
    }

    const value = convertValue(st.remove, notes);
    if (value.error) return { status: 'skipped', reason: value.error };
    const pat = convertPattern(rawPattern, st.matchCase, notes);
    if (pat.error) return { status: 'skipped', reason: pat.error };

    const parsed = {
      exception: exc, pattern: pat.text, value: value.text,
      types: TYPE_ORDER.filter(t => st.types.has(t)), notTypes: TYPE_ORDER.filter(t => st.notTypes.has(t)),
      party: PARTY_ORDER.filter(p => st.party.has(p)),
      domain: st.domain.slice(), to: st.to.slice(), method: st.method.slice(), matchCase: st.matchCase
    };
    return {
      status: exc ? 'exception' : 'converted',
      exception: exc,
      badfilter: st.badfilter,
      pattern: pat.text,
      text: formatRule(parsed),
      notes,
      docException,
      parsed
    };
  }

  // CLN text for a parsed filter.
  function formatRule(p) {
    const parts = ['removeparam' + (p.value ? '=' + p.value : '')];
    p.types.forEach(t => parts.push(t));
    p.notTypes.forEach(t => parts.push('~' + t));
    p.party.forEach(x => parts.push(x));
    if (p.domain.length) parts.push('domain=' + p.domain.join('|'));
    if (p.to.length) parts.push('to=' + p.to.join('|'));
    if (p.method.length) parts.push('method=' + p.method.join('|'));
    if (p.matchCase) parts.push('match-case');
    return (p.exception ? '@@' : '') + p.pattern + '$' + parts.join(',');
  }

  // ---------------------------------------------------------------------------
  // Sites: which provider a rule belongs to
  // ---------------------------------------------------------------------------
  const SLD = new Set(['co', 'com', 'net', 'org', 'gov', 'edu', 'ac', 'ne', 'or', 'go', 'gob', 'mil', 'nic',
    'ltd', 'plc', 'sch', 'web', 'info', 'biz', 'nom', 'gen', 'firm', 'gv', 'in', 'ind']);
  const HOST_RE = /^[a-z0-9-]+(?:\.[a-z0-9-]+)*$/;

  // Registrable-ish site of a host expression: "www.amazon.co.uk" → "amazon.co.uk",
  // "smile.amazon.*" and the prefix form "amazon." → "amazon.*". null when it can't tell.
  function siteOf(hostExpr) {
    let h = String(hostExpr || '').toLowerCase().replace(/^\*\./, '');
    if (/^\d{1,3}(?:\.\d{1,3}){3}$/.test(h)) return h;
    if (h.endsWith('.*') || h.endsWith('.')) {
      const base = h.endsWith('.*') ? h.slice(0, -2) : h.slice(0, -1);
      if (!HOST_RE.test(base)) return null;
      return base.split('.').pop() + '.*';
    }
    if (!HOST_RE.test(h) || !h.includes('.')) return null;
    const l = h.split('.');
    if (l.length >= 3 && l[l.length - 1].length === 2 && SLD.has(l[l.length - 2])) return l.slice(-3).join('.');
    return l.slice(-2).join('.');
  }

  // Host named at the start of a URL pattern ("||host…", "|https://host/…", "://host/…").
  function hostFromPattern(pattern) {
    const p = String(pattern || '').toLowerCase();
    let rest = null;
    if (p.startsWith('||')) rest = p.slice(2);
    else {
      const m = p.match(/^\|?(?:[a-z][a-z0-9+.-]*)?:?\/\/(.*)$/);
      if (m && (p.startsWith('|') || p.startsWith('://') || p.startsWith('//'))) rest = m[1];
    }
    if (rest === null) {
      // ".userapi.com/impg^": a leading dot then a host and a separator
      const dm = p.match(/^\.([a-z0-9-]+(?:\.[a-z0-9-]+)+)[\/^]/);
      return dm ? dm[1] : null;
    }
    const m = rest.match(/^[a-z0-9.*-]+/);
    if (!m) return null;
    let host = m[0];
    // "google.*/search" and "amazon.*" are entities; any other "*" is a wildcard we can't place.
    if (host.endsWith('.*')) { if (host.slice(0, -2).includes('*')) return null; }
    else if (host.includes('*')) return null;
    // "||paypal." (prefix form) is kept as-is; siteOf turns it into "paypal.*".
    return host || null;
  }

  function coreLabel(site) {
    return site.endsWith('.*') ? site.slice(0, -2) : site.split('.')[0];
  }

  // Could two host expressions describe some of the same hosts? (true when unsure)
  function hostsOverlap(a, b) {
    a = String(a).toLowerCase().replace(/^\*\./, ''); b = String(b).toLowerCase().replace(/^\*\./, '');
    if (a === b || a.endsWith('.' + b) || b.endsWith('.' + a)) return true;
    if (a.startsWith('/') || b.startsWith('/')) return true; // regex value
    const sa = siteOf(a), sb = siteOf(b);
    if (!sa || !sb) return true;
    if (sa === sb) return true;
    if (sa.endsWith('.*') || sb.endsWith('.*')) return coreLabel(sa) === coreLabel(sb);
    return false;
  }

  // Could an @@ entry with value `exc` keep a parameter that one of `rules` removes?
  function valueMayAffect(exc, rules) {
    if (!exc || exc.startsWith('~') || exc.startsWith('|')) return rules.length > 0;
    const excRe = exc.match(/^\/((?:\\.|[^/])+)\/([a-z]*)$/i);
    let re = null;
    if (excRe && !exc.startsWith('\\')) { try { re = new RegExp(excRe[1], excRe[2].includes('i') ? 'i' : ''); } catch (e) { return true; } }
    const lit = re ? null : exc.replace(/^\|/, '').replace(/\\([~|/,\\])/g, '$1').toLowerCase();
    return rules.some(r => {
      const v = r.parsed.value;
      if (!v || v.startsWith('~') || v.startsWith('|')) return true;
      const rm = v.match(/^\/((?:\\.|[^/])+)\/([a-z]*)$/i);
      if (rm && !v.startsWith('\\')) {
        if (re) return true; // regex vs regex: assume they can overlap
        try { const rr = new RegExp(rm[1], rm[2].includes('i') ? 'i' : ''); return rr.test(lit) || rr.test(lit + '='); }
        catch (e) { return true; }
      }
      const rl = v.replace(/\\([~|/,\\])/g, '$1').toLowerCase();
      return re ? (re.test(rl) || re.test(rl + '=')) : rl === lit;
    });
  }

  // ---------------------------------------------------------------------------
  // Whole list
  // ---------------------------------------------------------------------------
  const HEADER_KEYS = {
    title: 'name', version: 'version', description: 'description', homepage: 'homepage',
    expires: 'expires', license: 'license', 'last modified': 'lastModified', 'last updated': 'lastModified'
  };

  // "||lazada.(com|co.th|sg)^$removeparam=x" lists several hosts in one pattern.
  // Linkumori's domain patterns have no alternation, so the rule would never
  // match; it becomes one rule per host ("||lazada.com^…", "||lazada.co.th^…").
  // Only a group inside the host is expanded, and only when every alternative
  // is plain host text.
  const HOST_GROUP_RE = /^(@@)?(\|\||\|[a-z][a-z0-9+.-]*:\/\/)([a-z0-9*.-]*)\(([a-z0-9.|-]+)\)([a-z0-9*.()|-]*)(?=[\/^$:?#|]|$)([\s\S]*)$/i;

  function expandHostGroups(line) {
    const m = line.match(HOST_GROUP_RE);
    if (!m) return null;
    const [, exc = '', anchor, before, group, after, rest] = m;
    const alts = group.split('|');
    if (alts.length < 2 || alts.some(a => !a)) return null;
    const out = [];
    for (const a of alts) {
      const next = exc + anchor + before + a + after + rest;
      // A second group in the same host ("||(a|b).(com|net)^") expands too.
      out.push(...(expandHostGroups(next) || [next]));
    }
    return out;
  }

  async function readList(text, ctx, fileLabel, baseUrl, depth, header) {
    if (!ctx.fileOrder.includes(fileLabel)) ctx.fileOrder.push(fileLabel);
    const lines = String(text).replace(/^﻿/, '').split(/\r?\n/);
    const stack = []; // { taking: bool, hadElse: bool }
    const taking = () => stack.every(f => f.taking);
    let inHeader = depth === 0;
    for (let idx = 0; idx < lines.length; idx++) {
      const lineNo = idx + 1;
      const line = lines[idx].trim();
      const ref = { file: fileLabel, line: lineNo, text: line };
      if (!line) continue;

      if (line.startsWith('!#')) {
        const m = line.match(/^!#(\w+)\s*(.*)$/);
        const dir = m ? m[1] : '';
        const arg = m ? m[2].trim() : '';
        if (dir === 'if') {
          let v = true;
          if (ctx.profile !== 'all') {
            try { v = evalCondition(arg, ctx.tokens); }
            catch (e) { v = false; ctx.report.push({ ...ref, status: 'warning', message: 'could not read !#if condition (' + e.message + '); treated as false' }); }
          }
          stack.push({ taking: v, hadElse: false });
        } else if (dir === 'else') {
          const top = stack[stack.length - 1];
          if (!top) ctx.report.push({ ...ref, status: 'warning', message: '!#else without !#if' });
          else if (ctx.profile !== 'all') { top.taking = !top.taking; top.hadElse = true; }
        } else if (dir === 'endif') {
          if (!stack.length) ctx.report.push({ ...ref, status: 'warning', message: '!#endif without !#if' });
          else stack.pop();
        } else if (dir === 'include') {
          if (!taking()) { ctx.stats.excluded++; ctx.report.push({ ...ref, status: 'excluded', message: 'inside a false !#if branch' }); continue; }
          await handleInclude(arg, ref, ctx, baseUrl, depth);
        }
        // other !# directives (e.g. !#safari_cb_affinity) are ignored
        continue;
      }
      if (line.startsWith('!') || (line.startsWith('[') && line.endsWith(']')) || line.startsWith('# ') || line === '#') {
        ctx.stats.comments++;
        if (inHeader) {
          const hm = line.match(/^!\s*([A-Za-z][A-Za-z ]*?)\s*:\s*(.+)$/);
          if (hm) {
            const key = HEADER_KEYS[hm[1].toLowerCase()];
            if (key && !(key in header)) header[key] = hm[2].trim();
          }
        }
        continue;
      }
      inHeader = false;
      if (!taking()) { ctx.stats.excluded++; ctx.report.push({ ...ref, status: 'excluded', message: 'inside a false !#if branch' }); continue; }

      if (COSMETIC_RE.test(line)) {
        ctx.stats.skipped++;
        ctx.report.push({ ...ref, status: 'skipped', message: 'cosmetic / scriptlet rule: CLN only cleans URLs' });
        continue;
      }
      const expanded = expandHostGroups(line);
      if (!expanded && /^(?:@@)?\|\|?[^\/^$]*\(/.test(line)) {
        ctx.report.push({ ...ref, status: 'warning', message: 'host contains “(” that could not be split into hosts; Linkumori patterns have no groups, so this rule will not match' });
      }
      for (const one of expanded || [line]) {
        const res = convertNetworkRule(one, ctx.opts);
        if (res.status === 'skipped') {
          ctx.stats.skipped++;
          ctx.report.push({ ...ref, status: 'skipped', message: res.reason });
          break;
        }
        // One note for the source line, on its first rule.
        if (one === expanded?.[0]) res.notes = ['host group “(…|…)” split into ' + expanded.length + ' rules, one per host'].concat(res.notes);
        ctx.entries.push({ ...res, ref });
      }
    }
    if (stack.length) ctx.report.push({ file: fileLabel, line: lines.length, text: '', status: 'warning', message: stack.length + ' unclosed !#if block(s)' });
  }

  async function handleInclude(arg, ref, ctx, baseUrl, depth) {
    if (!ctx.opts.followIncludes) {
      ctx.report.push({ ...ref, status: 'warning', message: '!#include not followed (turned off)' });
      return;
    }
    if (!baseUrl || !ctx.fetchText) {
      ctx.report.push({ ...ref, status: 'warning', message: '!#include needs the list to be loaded from a URL; add the included file by hand if you need it' });
      return;
    }
    if (depth >= 3) { ctx.report.push({ ...ref, status: 'warning', message: '!#include nested too deep' }); return; }
    let url;
    try { url = new URL(arg, baseUrl); } catch (e) { ctx.report.push({ ...ref, status: 'warning', message: 'bad !#include path' }); return; }
    if (url.origin !== new URL(baseUrl).origin) { ctx.report.push({ ...ref, status: 'warning', message: '!#include to another site ignored (same-origin only, as in uBO)' }); return; }
    let text;
    try { text = await ctx.fetchText(url.href); }
    catch (e) { ctx.report.push({ ...ref, status: 'warning', message: '!#include could not be fetched: ' + e.message }); return; }
    const label = decodeURIComponent(url.pathname.split('/').pop() || url.href);
    ctx.includes.push(url.href);
    ctx.report.push({ ...ref, status: 'info', message: 'included ' + label });
    await readList(text, ctx, label, url.href, depth + 1, {});
  }

  // Rules each provider gets, as [{ site|null, parsed }] (null = the global provider).
  function placeFilter(p, finalSite) {
    const host = hostFromPattern(p.pattern);
    if (host) {
      const s = siteOf(host);
      if (!s) return [{ site: null, parsed: p }];
      const fs = finalSite(s);
      // "||amazon.*^$removeparam=x" in provider "||amazon.*^" needs no pattern of its own.
      // Same for the prefix form "||amazon." in provider "||amazon.*^".
      const lp = p.pattern.toLowerCase();
      const redundant = lp === '||' + fs + '^' || lp === '||' + fs ||
        (fs.endsWith('.*') && lp === '||' + fs.slice(0, -1));
      const pattern = redundant ? '' : p.pattern;
      return [{ site: fs, parsed: Object.assign({}, p, { pattern }) }];
    }
    const incl = p.domain.filter(d => !d.startsWith('~'));
    const excl = p.domain.filter(d => d.startsWith('~'));
    if (!incl.length) return [{ site: null, parsed: p }];
    const bySite = new Map(), unplaced = [];
    for (const d of incl) {
      const s = siteOf(d);
      if (!s) { unplaced.push(d); continue; } // regex, wildcard or bare TLD: stays global
      const fs = finalSite(s);
      if (!bySite.has(fs)) bySite.set(fs, []);
      bySite.get(fs).push(d);
    }
    const out = [];
    for (const [s, ds] of bySite) {
      // domain= is checked against the URL's host, which the provider already narrows to.
      const own = (ds.length === 1 && ds[0].toLowerCase() === s) ? [] : ds;
      const keepExcl = excl.filter(x => hostsOverlap(x.slice(1), s));
      out.push({ site: s, parsed: Object.assign({}, p, { domain: own.concat(keepExcl) }) });
    }
    if (unplaced.length) out.push({ site: null, parsed: Object.assign({}, p, { domain: unplaced.concat(excl) }) });
    return out;
  }

  // A URL pattern as the plain regex Linkumori's rule `exceptions` expect
  // (tested case-insensitively against the whole URL).
  function patternToRegexSource(pattern) {
    const rm = pattern.match(/^\/(.+)\/([a-z]*)$/i);
    if (rm) return rm[1];
    let raw = pattern, prefix = '', suffix = '', domainAnchor = false;
    if (raw.startsWith('||')) { domainAnchor = true; raw = raw.slice(2); prefix = '^[A-Za-z][A-Za-z0-9+.-]*:\\/+(?:[^/?#]*\\.)?'; }
    else if (raw.startsWith('|')) { raw = raw.slice(1); prefix = '^'; }
    if (raw.endsWith('|')) { raw = raw.slice(0, -1); suffix = '$'; }
    let src = '';
    for (let i = 0; i < raw.length; i++) {
      const ch = raw[i];
      if (ch === '*') src += '.*';
      else if (ch === '^') src += raw[i + 1] === '/' ? '(?=[^0-9A-Za-z_\\-.%]|$)' : '(?:[^0-9A-Za-z_\\-.%]|$)';
      else src += /[\\^$.*+?()[\]{}|/]/.test(ch) ? '\\' + ch : ch;
    }
    const boundary = (domainAnchor && !/[/^|]/.test(raw) && !suffix) ? '(?=[:/?#]|$)' : '';
    return prefix + src + boundary + suffix;
  }

  // "@@<pattern>$removeparam" with nothing else keeps every parameter on those URLs.
  function isKeepEverything(p) {
    return p.exception && !p.value && p.pattern && !p.types.length && !p.notTypes.length && !p.party.length &&
      !p.domain.length && !p.to.length && !p.method.length;
  }

  function exceptionScopes(p) {
    const host = hostFromPattern(p.pattern);
    if (host) { const s = siteOf(host); return s ? [s] : null; }
    const incl = p.domain.filter(d => !d.startsWith('~'));
    if (!incl.length) return null;
    const sites = incl.map(siteOf);
    return sites.every(Boolean) ? sites : null;
  }

  async function convert(text, options) {
    const opts = Object.assign({
      profile: 'linkumori', customTokens: '', keyPrefix: 'LUS-', layout: 'site', hoistExceptions: true,
      docExceptions: true, important: 'drop', annotate: false, metadata: true, sourceUrl: '',
      followIncludes: true, fetchText: null, now: new Date()
    }, options || {});
    const profile = PROFILES[opts.profile] || PROFILES.linkumori;
    const tokenList = opts.profile === 'custom'
      ? String(opts.customTokens || '').split(/[\s,]+/).filter(Boolean)
      : profile.tokens;
    const ctx = {
      opts, profile: opts.profile, tokens: new Set(tokenList), fetchText: opts.fetchText,
      entries: [], report: [], includes: [], fileOrder: [], sources: [],
      stats: { comments: 0, excluded: 0, skipped: 0, converted: 0, exceptions: 0, duplicates: 0, badfilters: 0, notes: 0 }
    };
    // One list (string) or several ([{ text, url }]) merged into one rule file.
    const inputs = typeof text === 'string' ? [{ text, url: opts.sourceUrl }] : (text || []);
    for (let i = 0; i < inputs.length; i++) {
      const src = inputs[i];
      if (!src || !String(src.text || '').trim()) continue;
      const url = String(src.url || '').trim();
      let label = url ? decodeURIComponent(url.split('?')[0].split('/').pop() || 'list') : 'list ' + (i + 1);
      if (ctx.fileOrder.includes(label)) label += ' #' + (i + 1);
      const header = {};
      await readList(src.text, ctx, label, url, 0, header);
      ctx.sources.push({ label, url, header });
    }

    // $badfilter: drop the rule it names (same converted text), and itself.
    const bad = new Set(ctx.entries.filter(e => e.badfilter).map(e => e.text));
    const entries = ctx.entries.filter(e => {
      if (e.badfilter) { ctx.stats.badfilters++; ctx.report.push({ ...e.ref, status: 'info', message: '$badfilter applied' }); return false; }
      if (bad.has(e.text)) { ctx.report.push({ ...e.ref, status: 'skipped', message: 'disabled by a $badfilter rule' }); ctx.stats.skipped++; return false; }
      return true;
    });

    // ---- Provider layout
    const prefix = String(opts.keyPrefix == null ? '' : opts.keyPrefix).trim();
    const globalKey = prefix + 'global';
    const bySite = opts.layout !== 'single';

    // Entity sites ("amazon.*") absorb plain sites with the same name ("amazon.co.uk").
    const entityCores = new Set();
    if (bySite) {
      for (const e of entries) {
        const scopes = [];
        const h = hostFromPattern(e.parsed.pattern);
        if (h) scopes.push(siteOf(h));
        else if (!e.exception) e.parsed.domain.filter(d => !d.startsWith('~')).forEach(d => scopes.push(siteOf(d)));
        scopes.forEach(s => { if (s && s.endsWith('.*')) entityCores.add(coreLabel(s)); });
      }
    }
    const finalSite = (s) => (s && !s.endsWith('.*') && !/^\d/.test(s) && entityCores.has(coreLabel(s))) ? coreLabel(s) + '.*' : s;

    const providers = new Map(); // site|null -> { key, site, filters: [], exceptions: [] }
    const prov = (site) => {
      const k = site === null ? null : site;
      if (!providers.has(k)) providers.set(k, { key: site === null ? globalKey : prefix + site, site, filters: [], exceptions: [] });
      return providers.get(k);
    };
    prov(null);

    for (const e of entries) {
      if (e.exception) continue;
      const places = bySite ? placeFilter(e.parsed, finalSite) : [{ site: null, parsed: e.parsed }];
      for (const pl of places) prov(pl.site).filters.push({ source: e, parsed: pl.parsed, text: formatRule(pl.parsed) });
    }
    // Path-only "keep everything" @@ rules would be copied into every provider;
    // the file's defaults.exceptions says the same thing once.
    const fileExceptions = [];
    if (bySite && opts.hoistExceptions) {
      for (const e of entries) {
        if (!e.exception || !isKeepEverything(e.parsed) || hostFromPattern(e.parsed.pattern)) continue;
        const re = patternToRegexSource(e.parsed.pattern);
        try { new RegExp(re, 'i'); } catch (err) { continue; }
        e.hoisted = re;
        if (!fileExceptions.includes(re)) fileExceptions.push(re);
        ctx.stats.exceptions++;
        ctx.report.push({ ...e.ref, status: 'info', message: 'moved to defaults.exceptions (applies to every rule in the file)', output: re });
      }
    }
    // @@ entries only guard filters of their own provider on a page load, so each
    // goes to every provider holding a filter it could guard.
    for (const e of entries) {
      if (!e.exception || e.hoisted) continue;
      const scopes = bySite ? exceptionScopes(e.parsed) : null;
      for (const P of providers.values()) {
        if (!P.filters.length) continue;
        if (P.site !== null && scopes && !scopes.some(s => hostsOverlap(s, P.site))) continue;
        if (bySite && !valueMayAffect(e.parsed.value, P.filters)) continue;
        P.exceptions.push({ source: e, parsed: e.parsed, text: e.text });
      }
    }

    const ordered = [...providers.values()].filter(P => P.filters.length)
      .sort((a, b) => (a.site === null ? -1 : b.site === null ? 1 : a.site.localeCompare(b.site)));
    const usedKeys = new Set();
    const simProviders = [];
    const notedSources = new Set();
    const placedExceptions = new Set();
    let globalFilters = 0, siteFilters = 0;
    const docProviders = {};
    for (const P of ordered) {
      let key = P.key, n = 2;
      while (usedKeys.has(key)) key = P.key + '-' + n++;
      usedKeys.add(key);
      const seen = new Map(), rules = [], sim = [];
      for (const item of P.filters.concat(P.exceptions)) {
        const e = item.source;
        if (seen.has(item.text)) {
          if (!item.parsed.exception) {
            const first = seen.get(item.text);
            ctx.stats.duplicates++;
            ctx.report.push({ ...e.ref, status: 'duplicate', message: 'same CLN text as ' + first.file + ':' + first.line + ' in ' + key, output: item.text });
          }
          continue;
        }
        seen.set(item.text, e.ref);
        rules.push(opts.annotate ? { matchPattern: item.text, description: e.ref.file + ' line ' + e.ref.line + ': ' + e.ref.text } : item.text);
        sim.push({ parsed: item.parsed, ruleText: item.text, ref: e.ref, exception: !!item.parsed.exception, providerKey: key });
        if (item.parsed.exception) placedExceptions.add(e);
        else if (P.site === null) globalFilters++; else siteFilters++;
        if (!notedSources.has(e)) {
          notedSources.add(e);
          if (e.exception) ctx.stats.exceptions++; else ctx.stats.converted++;
          if (e.notes && e.notes.length) {
            ctx.stats.notes++;
            ctx.report.push({ ...e.ref, status: 'note', message: e.notes.join('; '), output: item.text });
          }
        }
      }
      const domainPatterns = P.site === null ? ['*'] : ['||' + P.site + '^'];
      docProviders[key] = { domainPatterns, rules };
      simProviders.push({ key, domainPatterns, entries: sim });
    }
    for (const e of entries) {
      if (e.exception && !e.hoisted && !placedExceptions.has(e)) {
        ctx.report.push({ ...e.ref, status: 'info', message: 'exception dropped: no converted rule removes this parameter on those pages' });
      }
    }

    // Build the CLN document
    const doc = { cln: '1.0' };
    if (opts.metadata) {
      const md = {};
      const keys = ['version', 'description', 'homepage', 'expires', 'license', 'lastModified'];
      if (ctx.sources.length === 1) {
        const s = ctx.sources[0];
        if (s.header.name) md.name = s.header.name + ' (CLN)';
        keys.forEach(k => { if (s.header[k]) md[k] = s.header[k]; });
        if (s.url) md.source = s.url;
      } else {
        const names = ctx.sources.map(s => s.header.name || s.label);
        md.name = names.join(' + ') + ' (CLN, merged)';
        md.description = 'Merged from ' + ctx.sources.length + ' filter lists: ' + names.join('; ') +
          '. Each list keeps its own license.';
        md.sources = ctx.sources.map(s => {
          const o = { name: s.header.name || s.label };
          keys.forEach(k => { if (k !== 'description' && s.header[k]) o[k] = s.header[k]; });
          if (s.url) o.source = s.url;
          return o;
        });
      }
      if (ctx.includes.length) md.includes = ctx.includes.slice();
      md.sourceFormat = 'AdGuard / uBlock Origin filter list';
      md.preprocessorProfile = profile.label + (opts.profile === 'custom' ? ' [' + tokenList.join(', ') + ']' : '');
      md.convertedAt = opts.now.toISOString();
      md.converter = 'AdGuard → Linkumori CLN 1.0 converter';
      doc.metadata = md;
    }
    if (fileExceptions.length) doc.defaults = { exceptions: fileExceptions };
    doc.providers = docProviders;

    const rank = { warning: 0, skipped: 1, note: 2, duplicate: 3, info: 4, excluded: 5 };
    const fileRank = (f) => { const i = ctx.fileOrder.indexOf(f); return i === -1 ? 1e9 : i; };
    ctx.report.sort((a, b) => (fileRank(a.file) - fileRank(b.file)) || a.line - b.line || (rank[a.status] - rank[b.status]));

    return {
      doc,
      json: JSON.stringify(doc, null, 2),
      compactJson: JSON.stringify(doc),
      stats: Object.assign({}, ctx.stats, { providers: Object.keys(docProviders).length, globalFilters, siteFilters }),
      report: ctx.report,
      providers: simProviders,
      fileExceptions,
      header: (ctx.sources[0] || { header: {} }).header,
      sources: ctx.sources.map(s => ({ label: s.label, url: s.url, name: s.header.name || s.label, version: s.header.version || '' })),
      tokens: tokenList
    };
  }

  // ---------------------------------------------------------------------------
  // Approximate simulator (top-level page load, GET, first-party)
  // ---------------------------------------------------------------------------
  function abpToRegex(pattern) {
    let raw = pattern, prefix = '', suffix = '';
    if (raw.startsWith('||')) { raw = raw.slice(2); prefix = '^[a-z][a-z0-9+.-]*:\\/+(?:[^/?#]*\\.)?'; }
    else if (raw.startsWith('|')) { raw = raw.slice(1); prefix = '^'; }
    if (raw.endsWith('|')) { raw = raw.slice(0, -1); suffix = '$'; }
    let src = '';
    for (const ch of raw) {
      if (ch === '*') src += '.*';
      else if (ch === '^') src += '(?:[^0-9A-Za-z_\\-.%]|$)';
      else src += /[\\^$.*+?()[\]{}|/]/.test(ch) ? '\\' + ch : ch;
    }
    return new RegExp(prefix + src + suffix, 'i');
  }

  function patternMatches(pattern, url) {
    if (!pattern || pattern === '*') return true;
    const m = pattern.match(/^\/(.+)\/([a-z]*)$/i);
    if (m && isValidRegex(m[1], m[2])) return new RegExp(m[1], m[2]).test(url);
    try { return abpToRegex(pattern).test(url); } catch (e) { return false; }
  }

  function hostMatches(host, value) {
    const v = value.toLowerCase();
    const rm = v.match(/^\/(.+)\/([a-z]*)$/i);
    if (rm) { try { return new RegExp(rm[1], rm[2]).test(host); } catch (e) { return false; } }
    if (v.endsWith('.*')) {
      const base = v.slice(0, -2).replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
      return new RegExp('(?:^|\\.)' + base + '\\.[a-z0-9-]+(?:\\.[a-z]{2,3})?$').test(host);
    }
    return host === v || host.endsWith('.' + v);
  }

  function hostListOk(host, list) {
    if (!list.length) return true;
    const inc = list.filter(v => !v.startsWith('~')), exc = list.filter(v => v.startsWith('~')).map(v => v.slice(1));
    if (inc.length && !inc.some(v => hostMatches(host, v))) return false;
    if (exc.some(v => hostMatches(host, v))) return false;
    return true;
  }

  function valueMatches(p, name, value) {
    if (!p.value) return true;
    let v = p.value, neg = false;
    if (v.startsWith('~')) { neg = true; v = v.slice(1); }
    let hit;
    const rm = v.match(/^\/((?:\\.|[^/])+)\/([a-z]*)$/i);
    if (rm && !v.startsWith('\\')) {
      const re = new RegExp(rm[1], rm[2].includes('i') ? 'i' : '');
      hit = re.test(name) || re.test(name + '=' + value);
    } else if (v.startsWith('|')) {
      const pre = v.slice(1).replace(/\\([~|/,\\])/g, '$1');
      hit = name.toLowerCase().startsWith(pre.toLowerCase());
    } else {
      const lit = v.replace(/\\([~|/,\\])/g, '$1');
      hit = p.matchCase ? name === lit : name.toLowerCase() === lit.toLowerCase();
    }
    return neg ? !hit : hit;
  }

  function entryApplies(e, url, host) {
    const p = e.parsed;
    if (!patternMatches(p.pattern, url)) return false;
    if (p.types.length && !p.types.includes('document')) return false;
    if (p.notTypes.includes('document')) return false;
    if (p.party.includes('third-party') || p.party.includes('strict-third-party')) return false;
    if (!hostListOk(host, p.domain)) return false;
    if (!hostListOk(host, p.to)) return false;
    if (p.method.length) {
      const inc = p.method.filter(m => !m.startsWith('~')), exc = p.method.filter(m => m.startsWith('~')).map(m => m.slice(1));
      if (inc.length && !inc.includes('get')) return false;
      if (exc.includes('get')) return false;
    }
    return true;
  }

  function providerMatches(P, url, host) {
    return P.domainPatterns.some(dp => {
      if (dp === '*') return true;
      const m = dp.match(/^\|\|(.+)\^$/);
      return m ? hostMatches(host, m[1]) : patternMatches(dp, url);
    });
  }

  // One provider on one URL: { url, removed: [{ name, value, by }], guarded: [{ name, by }] }
  function applyProvider(P, url, fileRes) {
    const u = new URL(url), host = u.hostname.toLowerCase();
    if (fileRes.some(re => re.test(u.href))) return { url: u.href, removed: [], guarded: [] };
    const live = P.entries.filter(e => entryApplies(e, u.href, host));
    const excs = live.filter(e => e.exception), rules = live.filter(e => !e.exception);
    const pairs = u.search ? u.search.slice(1).split('&').filter(s => s !== '') : [];
    const keptPairs = [], removed = [], guarded = [];
    for (const pair of pairs) {
      const eq = pair.indexOf('=');
      let name = eq === -1 ? pair : pair.slice(0, eq), value = eq === -1 ? '' : pair.slice(eq + 1);
      try { name = decodeURIComponent(name.replace(/\+/g, ' ')); } catch (e) { /* keep raw */ }
      try { value = decodeURIComponent(value.replace(/\+/g, ' ')); } catch (e) { /* keep raw */ }
      const hit = rules.find(e => valueMatches(e.parsed, name, value));
      const guard = hit && excs.find(e => valueMatches(e.parsed, name, value));
      if (hit && !guard) removed.push({ name, value, by: hit });
      else { keptPairs.push(pair); if (guard) guarded.push({ name, by: guard }); }
    }
    const out = new URL(u.href);
    out.search = keptPairs.length ? '?' + keptPairs.join('&') : '';
    return { url: out.href, removed, guarded };
  }

  // Like Linkumori: the first matching provider that changes the URL wins,
  // then the next pass starts on the new URL (at most 10 passes).
  function simulate(urlText, providers, fileExceptions) {
    const fileRes = (fileExceptions || []).map(s => { try { return new RegExp(s, 'i'); } catch (e) { return null; } }).filter(Boolean);
    let url;
    try { url = new URL(urlText.trim()).href; } catch (e) { return { error: 'Not a valid absolute URL' }; }
    const removedBy = new Map(), guardedBy = new Map(), steps = [];
    for (let pass = 0; pass < 10; pass++) {
      const host = new URL(url).hostname.toLowerCase();
      let changed = false;
      for (const P of providers) {
        if (!providerMatches(P, url, host)) continue;
        const r = applyProvider(P, url, fileRes);
        r.guarded.forEach(g => { if (!guardedBy.has(g.name)) guardedBy.set(g.name, g.by); });
        if (r.url !== url) {
          r.removed.forEach(x => removedBy.set(x.name, x));
          steps.push({ provider: P.key, url: r.url });
          url = r.url; changed = true;
          break;
        }
      }
      if (!changed) break;
    }
    const orig = new URL(urlText.trim());
    const rows = [];
    for (const pair of (orig.search ? orig.search.slice(1).split('&').filter(Boolean) : [])) {
      const eq = pair.indexOf('=');
      let name = eq === -1 ? pair : pair.slice(0, eq), value = eq === -1 ? '' : pair.slice(eq + 1);
      try { name = decodeURIComponent(name.replace(/\+/g, ' ')); } catch (e) { /* keep raw */ }
      try { value = decodeURIComponent(value.replace(/\+/g, ' ')); } catch (e) { /* keep raw */ }
      if (removedBy.has(name)) rows.push({ name, value, action: 'removed', by: removedBy.get(name).by });
      else if (guardedBy.has(name)) rows.push({ name, value, action: 'kept (exception)', by: guardedBy.get(name) });
      else rows.push({ name, value, action: 'kept', by: null });
    }
    return { result: url, rows, steps };
  }

  const api = { PROFILES, convert, convertNetworkRule, evalCondition, splitModifiers, simulate, siteOf, hostFromPattern, formatRule };
  if (typeof module !== 'undefined' && module.exports) module.exports = api;
  else root.CLNConverter = api;
})(typeof self !== 'undefined' ? self : this);
