// Shared page behavior: theme switch, mobile menu, heading anchors, contents highlighting.
(function () {
  'use strict';

  const root = document.documentElement;
  const THEME_KEY = 'linkumori-site-theme';

  function storedTheme() {
    try { return localStorage.getItem(THEME_KEY); } catch (e) { return null; }
  }

  function effectiveTheme() {
    const set = root.getAttribute('data-theme');
    if (set) return set;
    return window.matchMedia('(prefers-color-scheme: dark)').matches ? 'dark' : 'light';
  }

  const saved = storedTheme();
  if (saved === 'light' || saved === 'dark') root.setAttribute('data-theme', saved);

  function syncThemeButton(btn) {
    const dark = effectiveTheme() === 'dark';
    btn.setAttribute('aria-label', dark ? 'Switch to light theme' : 'Switch to dark theme');
    btn.innerHTML = dark
      ? '<svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" aria-hidden="true"><circle cx="12" cy="12" r="4"/><path d="M12 2v2M12 20v2M4.9 4.9l1.4 1.4M17.7 17.7l1.4 1.4M2 12h2M20 12h2M4.9 19.1l1.4-1.4M17.7 6.3l1.4-1.4"/></svg>'
      : '<svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M21 12.8A9 9 0 1 1 11.2 3a7 7 0 0 0 9.8 9.8z"/></svg>';
  }

  document.addEventListener('DOMContentLoaded', function () {
    const themeBtn = document.querySelector('[data-theme-toggle]');
    if (themeBtn) {
      syncThemeButton(themeBtn);
      themeBtn.addEventListener('click', function () {
        const next = effectiveTheme() === 'dark' ? 'light' : 'dark';
        root.setAttribute('data-theme', next);
        try { localStorage.setItem(THEME_KEY, next); } catch (e) { /* storage unavailable */ }
        syncThemeButton(themeBtn);
      });
    }

    const menuBtn = document.querySelector('[data-menu-toggle]');
    const nav = document.getElementById('site-nav');
    if (menuBtn && nav) {
      menuBtn.addEventListener('click', function () {
        const open = nav.classList.toggle('open');
        menuBtn.setAttribute('aria-expanded', String(open));
      });
    }

    // Heading anchors for docs pages.
    document.querySelectorAll('.prose h2[id], .prose h3[id]').forEach(function (h) {
      const a = document.createElement('a');
      a.className = 'anchor';
      a.href = '#' + h.id;
      a.setAttribute('aria-label', 'Link to this section');
      a.textContent = '#';
      h.appendChild(a);
    });

    // Highlight the current section in the contents list.
    const tocLinks = Array.from(document.querySelectorAll('.toc a[href^="#"]'));
    if (tocLinks.length && 'IntersectionObserver' in window) {
      const byId = new Map(tocLinks.map(function (a) { return [a.getAttribute('href').slice(1), a]; }));
      const observer = new IntersectionObserver(function (entries) {
        entries.forEach(function (entry) {
          if (!entry.isIntersecting) return;
          tocLinks.forEach(function (a) { a.classList.remove('active'); });
          const link = byId.get(entry.target.id);
          if (link) link.classList.add('active');
        });
      }, { rootMargin: '-80px 0px -70% 0px' });
      byId.forEach(function (_, id) {
        const el = document.getElementById(id);
        if (el) observer.observe(el);
      });
    }
  });
})();
