(function () {
  const TOKEN_KEY = 'lsw-portal-token';

  function api(path, opts) {
    opts = opts || {};
    const headers = Object.assign({ 'Content-Type': 'application/json' }, opts.headers || {});
    const token = localStorage.getItem(TOKEN_KEY);
    if (token) headers.Authorization = 'Bearer ' + token;
    return fetch(path, Object.assign({}, opts, { headers })).then(async (r) => {
      const data = await r.json().catch(() => ({}));
      if (!r.ok) {
        const err = new Error(data.error || data.detail || ('HTTP ' + r.status));
        err.status = r.status;
        throw err;
      }
      return data;
    });
  }

  function setToken(t) {
    if (t) localStorage.setItem(TOKEN_KEY, t);
    else localStorage.removeItem(TOKEN_KEY);
  }

  function getToken() {
    return localStorage.getItem(TOKEN_KEY);
  }

  function fmtDate(iso) {
    if (!iso) return '—';
    const m = String(iso).match(/^(\d{4})-(\d{2})-(\d{2})/);
    if (m) return Number(m[3]) + '.' + Number(m[2]) + '.' + m[1];
    try {
      return new Date(iso).toLocaleString('pl-PL');
    } catch {
      return iso;
    }
  }

  function shellActive(page) {
    document.querySelectorAll('[data-nav]').forEach((el) => {
      el.classList.toggle('active', el.getAttribute('data-nav') === page);
    });
    const logout = document.getElementById('btn-logout');
    const login = document.getElementById('nav-login');
    const konto = document.getElementById('nav-konto');
    if (getToken()) {
      if (login) login.style.display = 'none';
      if (konto) konto.style.display = '';
      if (logout) logout.style.display = '';
    } else {
      if (login) login.style.display = '';
      if (konto) konto.style.display = 'none';
      if (logout) logout.style.display = 'none';
    }
  }

  function wireLogout() {
    const btn = document.getElementById('btn-logout');
    if (!btn) return;
    btn.addEventListener('click', () => {
      setToken(null);
      location.href = 'index.html';
    });
  }

  // Logo ŁSW ładowane z adresu URL (zmień tutaj, jeśli logo leży gdzie indziej).
  // Dopóki obrazek się nie wczyta (lub gdy go nie ma) widać znaczek „ŁSW”.
  const LOGO_URL = 'https://lsw.edu.pl/images/logo-n1.png';

  function initLogo() {
    document.querySelectorAll('.crest').forEach((el) => {
      const img = new Image();
      img.alt = 'Łużycka Szkoła Wyższa';
      img.onload = () => {
        el.textContent = '';
        el.classList.add('has-logo');
        el.appendChild(img);
      };
      img.src = LOGO_URL;
    });
  }
  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', initLogo);
  else initLogo();

  const ICONS = {
    book: '<svg class="ico" xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M12 7v14"/><path d="M3 18a1 1 0 0 1-1-1V4a1 1 0 0 1 1-1h5a4 4 0 0 1 4 4 4 4 0 0 1 4-4h5a1 1 0 0 1 1 1v13a1 1 0 0 1-1 1h-6a3 3 0 0 0-3 3 3 3 0 0 0-3-3z"/></svg>',
    search: '<svg class="ico" xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><circle cx="11" cy="11" r="8"/><path d="m21 21-4.3-4.3"/></svg>',
    refresh: '<svg class="ico" xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M3 12a9 9 0 0 1 9-9 9.75 9.75 0 0 1 6.74 2.74L21 8"/><path d="M21 3v5h-5"/><path d="M21 12a9 9 0 0 1-9 9 9.75 9.75 0 0 1-6.74-2.74L3 16"/><path d="M8 16H3v5"/></svg>',
    school: '<svg class="ico" xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M22 10v6M2 10l10-5 10 5-10 5z"/><path d="M6 12v5c3 3 9 3 12 0v-5"/></svg>',
    link: '<svg class="ico" xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M15 3h6v6"/><path d="M10 14 21 3"/><path d="M18 13v6a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V8a2 2 0 0 1 2-2h6"/></svg>',
    user: '<svg class="ico" xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M19 21v-2a4 4 0 0 0-4-4H9a4 4 0 0 0-4 4v2"/><circle cx="12" cy="7" r="4"/></svg>'
  };

  // Ikony w nawigacji i pasku górnym (dodawane automatycznie, bez zmian w HTML)
  function initIcons() {
    const add = (sel, icon) => document.querySelectorAll(sel).forEach((el) => {
      if (!el.querySelector('.ico')) el.insertAdjacentHTML('afterbegin', icon);
    });
    add('.topbar-inner > span', ICONS.school);
    add('.topbar-inner > a', ICONS.link);
    add('nav [data-nav="katalog"]', ICONS.book);
    add('nav [data-nav="login"], nav [data-nav="konto"]', ICONS.user);
  }
  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', initIcons);
  else initIcons();

  window.LSW = { icons: ICONS, api, setToken, getToken, fmtDate, shellActive, wireLogout };
})();
