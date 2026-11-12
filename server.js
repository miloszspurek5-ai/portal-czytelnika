'use strict';
/**
 * Portal czytelnika Biblioteki ŁSW — samodzielny serwer.
 * Współpracuje z aplikacją desktopową: POST /api/sync + nagłówek X-Sync-Key
 *
 * Uruchomienie:
 *   set SYNC_KEY=twoj-tajny-klucz
 *   node server.js
 */

const http = require('http');
const fs = require('fs');
const path = require('path');
const crypto = require('crypto');
const os = require('os');

const ROOT = __dirname;
const PUBLIC = path.join(ROOT, 'public');
const DATA_DIR = path.join(ROOT, 'data');
const DATA_FILE = path.join(DATA_DIR, 'portal.json');
const PORT = Number(process.env.PORT) || 8787;
const HOST = process.env.HOST || '0.0.0.0';
const SYNC_KEY = String(process.env.SYNC_KEY || '').trim();

const MIME = {
  '.html': 'text/html; charset=utf-8',
  '.js': 'application/javascript; charset=utf-8',
  '.css': 'text/css; charset=utf-8',
  '.json': 'application/json; charset=utf-8',
  '.png': 'image/png',
  '.svg': 'image/svg+xml',
  '.ico': 'image/x-icon',
  '.woff2': 'font/woff2',
};

fs.mkdirSync(DATA_DIR, { recursive: true });

function loadState() {
  try {
    return JSON.parse(fs.readFileSync(DATA_FILE, 'utf8'));
  } catch {
    return {
      books: [],
      loans: [],
      cards: [],
      readerPasswords: {},
      updatedAt: null,
    };
  }
}

function saveState(state) {
  const tmp = DATA_FILE + '.tmp';
  // bez wcięć — mniejszy plik przy 9k+ książek
  fs.writeFileSync(tmp, JSON.stringify(state));
  fs.renameSync(tmp, DATA_FILE);
}

let state = loadState();

/** bookId -> liczba aktywnych wypożyczeń (cache po sync / load) */
let loanCount = new Map();
/** posortowana lista id + pola do szybkiego filtrowania */
let catalogIndex = [];

function rebuildIndex() {
  loanCount = new Map();
  for (const l of state.loans) {
    if (l.returnedAt) continue;
    const id = String(l.bookId);
    loanCount.set(id, (loanCount.get(id) || 0) + 1);
  }
  catalogIndex = state.books.map((b) => {
    const id = String(b.id);
    const quantity = Math.max(0, Number(b.quantity) || 0);
    const available = Math.max(0, quantity - (loanCount.get(id) || 0));
    const title = String(b.title || '');
    const author = String(b.author || '');
    return {
      id,
      title,
      author,
      quantity,
      available,
      // lowercase do wyszukiwania bez toLowerCase na każdym requeście
      _q: (title + ' ' + author).toLowerCase(),
    };
  });
  // stała kolejność: tytuł
  catalogIndex.sort((a, b) => a.title.localeCompare(b.title, 'pl'));
}

rebuildIndex();

function json(res, code, obj) {
  const body = JSON.stringify(obj);
  res.writeHead(code, {
    'Content-Type': 'application/json; charset=utf-8',
    'Cache-Control': 'no-store',
    'Access-Control-Allow-Origin': '*',
    'Access-Control-Allow-Headers': 'Content-Type, X-Sync-Key, Authorization',
    'Access-Control-Allow-Methods': 'GET, POST, OPTIONS',
  });
  res.end(body);
}

function readBody(req) {
  return new Promise((resolve, reject) => {
    const chunks = [];
    let size = 0;
    req.on('data', (c) => {
      size += c.length;
      if (size > 80 * 1024 * 1024) {
        reject(new Error('too big'));
        req.destroy();
        return;
      }
      chunks.push(c);
    });
    req.on('end', () => {
      try {
        resolve(chunks.length ? JSON.parse(Buffer.concat(chunks).toString('utf8')) : {});
      } catch (e) {
        reject(e);
      }
    });
    req.on('error', reject);
  });
}

function checkSyncKey(req) {
  if (!SYNC_KEY) return false;
  const key = req.headers['x-sync-key'];
  return key && String(key) === SYNC_KEY;
}

const sessions = new Map();

function makeToken() {
  return crypto.randomBytes(24).toString('hex');
}

function authCard(req) {
  const h = req.headers.authorization || '';
  const m = /^Bearer\s+(.+)$/i.exec(h);
  if (!m) return null;
  const cardId = sessions.get(m[1]);
  if (!cardId) return null;
  return state.cards.find((c) => String(c.id) === String(cardId)) || null;
}

function catalogPage(query) {
  const q = String(query.q || '').trim().toLowerCase();
  const onlyAvail = query.available === '1' || query.available === 'true';
  let page = parseInt(query.page, 10);
  if (!Number.isFinite(page) || page < 1) page = 1;
  let limit = parseInt(query.limit, 10);
  if (!Number.isFinite(limit) || limit < 1) limit = 48;
  if (limit > 100) limit = 100;

  let list = catalogIndex;
  if (onlyAvail) list = list.filter((b) => b.available > 0);
  if (q) {
    // proste tokeny: wszystkie słowa muszą wystąpić
    const tokens = q.split(/\s+/).filter(Boolean);
    list = list.filter((b) => tokens.every((t) => b._q.includes(t)));
  }

  const total = list.length;
  const pages = Math.max(1, Math.ceil(total / limit));
  if (page > pages) page = pages;
  const start = (page - 1) * limit;
  const slice = list.slice(start, start + limit).map((b) => ({
    id: b.id,
    title: b.title,
    author: b.author,
    quantity: b.quantity,
    available: b.available,
  }));

  return {
    books: slice,
    page,
    limit,
    total,
    pages,
    catalogSize: catalogIndex.length,
    updatedAt: state.updatedAt,
  };
}

async function handleApi(req, res, url) {
  const p = url.pathname;
  const m = req.method;

  if (m === 'OPTIONS') {
    res.writeHead(204, {
      'Access-Control-Allow-Origin': '*',
      'Access-Control-Allow-Headers': 'Content-Type, X-Sync-Key, Authorization',
      'Access-Control-Allow-Methods': 'GET, POST, OPTIONS',
    });
    return res.end();
  }

  if (m === 'POST' && p === '/api/sync') {
    if (!SYNC_KEY) {
      return json(res, 500, {
        detail: 'Ustaw zmienną środowiskową SYNC_KEY przed uruchomieniem serwera.',
      });
    }
    if (!checkSyncKey(req)) {
      return json(res, 401, { detail: 'Nieprawidłowy klucz synchronizacji.' });
    }
    const body = await readBody(req);
    const books = Array.isArray(body.books) ? body.books : [];
    const loans = Array.isArray(body.loans) ? body.loans : [];
    const cards = Array.isArray(body.cards) ? body.cards : [];

    const prevById = new Map(state.cards.map((c) => [String(c.id), c]));
    const nextCards = cards.map((c) => {
      const id = String(c.id);
      const portalOverride = state.readerPasswords[id];
      let password = String(c.password || '');
      let passwordRev = Number(c.passwordRev) || 1;
      if (
        portalOverride &&
        Number(portalOverride.passwordRev) >= passwordRev &&
        portalOverride.password
      ) {
        password = portalOverride.password;
        passwordRev = Number(portalOverride.passwordRev);
      }
      return {
        id,
        number: String(c.number || ''),
        first: String(c.first || ''),
        last: String(c.last || ''),
        major: String(c.major || ''),
        edition: String(c.edition || ''),
        login: String(c.login || '').toLowerCase(),
        password,
        passwordRev,
      };
    });

    state.books = books.map((b) => ({
      id: String(b.id),
      title: String(b.title || ''),
      author: String(b.author || ''),
      quantity: Math.max(0, Number(b.quantity) || 0),
    }));
    state.loans = loans.map((l) => ({
      id: String(l.id),
      bookId: String(l.bookId),
      cardId: l.cardId == null ? null : String(l.cardId),
      borrowedAt: String(l.borrowedAt || ''),
      due: String(l.due || ''),
      returnedAt: l.returnedAt ? String(l.returnedAt) : null,
    }));
    state.cards = nextCards;
    state.updatedAt = new Date().toISOString();
    saveState(state);
    rebuildIndex();

    const readerChanged = Object.entries(state.readerPasswords).map(([id, v]) => ({
      id,
      changedAt: v.changedAt || null,
    }));
    return json(res, 200, {
      ok: true,
      books: state.books.length,
      loans: state.loans.length,
      cards: state.cards.length,
      readerChanged,
    });
  }

  if (m === 'GET' && p === '/api/health') {
    return json(res, 200, {
      ok: true,
      books: state.books.length,
      cards: state.cards.length,
      loans: state.loans.length,
      updatedAt: state.updatedAt,
      syncKeySet: Boolean(SYNC_KEY),
    });
  }

  if (m === 'GET' && p === '/api/catalog') {
    return json(res, 200, catalogPage(Object.fromEntries(url.searchParams)));
  }

  if (m === 'POST' && p === '/api/login') {
    const body = await readBody(req);
    const login = String(body.login || '').trim().toLowerCase();
    const password = String(body.password || '');
    const card = state.cards.find(
      (c) => c.login === login && String(c.password) === password
    );
    if (!card) return json(res, 401, { error: 'Nieprawidłowy login lub hasło.' });
    const token = makeToken();
    sessions.set(token, card.id);
    return json(res, 200, {
      token,
      reader: {
        id: card.id,
        login: card.login,
        first: card.first,
        last: card.last,
        major: card.major,
      },
    });
  }

  if (m === 'GET' && p === '/api/me') {
    const card = authCard(req);
    if (!card) return json(res, 401, { error: 'Brak sesji.' });
    const loans = state.loans
      .filter((l) => String(l.cardId) === String(card.id) && !l.returnedAt)
      .map((l) => {
        const book = state.books.find((b) => String(b.id) === String(l.bookId));
        return {
          id: l.id,
          bookId: l.bookId,
          title: book ? book.title : 'Nieznana pozycja',
          author: book ? book.author : '',
          borrowedAt: l.borrowedAt,
          due: l.due,
        };
      });
    return json(res, 200, {
      reader: {
        id: card.id,
        login: card.login,
        first: card.first,
        last: card.last,
        major: card.major,
      },
      loans,
    });
  }

  if (m === 'POST' && p === '/api/change-password') {
    const card = authCard(req);
    if (!card) return json(res, 401, { error: 'Brak sesji.' });
    const body = await readBody(req);
    const current = String(body.current || '');
    const next = String(body.next || '').trim();
    if (String(card.password) !== current) {
      return json(res, 400, { error: 'Obecne hasło jest nieprawidłowe.' });
    }
    if (next.length < 6) {
      return json(res, 400, { error: 'Nowe hasło musi mieć min. 6 znaków.' });
    }
    const rev = (Number(card.passwordRev) || 1) + 1;
    card.password = next;
    card.passwordRev = rev;
    state.readerPasswords[card.id] = {
      password: next,
      passwordRev: rev,
      changedAt: new Date().toISOString(),
    };
    saveState(state);
    return json(res, 200, { ok: true });
  }

  return json(res, 404, { error: 'nie znaleziono' });
}

function serveStatic(req, res, pathname) {
  let rel = decodeURIComponent(pathname);
  if (rel === '/') rel = '/index.html';
  const full = path.normalize(path.join(PUBLIC, rel));
  if (!full.startsWith(path.normalize(PUBLIC))) {
    res.writeHead(403);
    return res.end('Forbidden');
  }
  fs.readFile(full, (err, data) => {
    if (err) {
      res.writeHead(404);
      return res.end('Nie znaleziono');
    }
    res.writeHead(200, {
      'Content-Type': MIME[path.extname(full).toLowerCase()] || 'application/octet-stream',
      'Cache-Control': path.extname(full) === '.html' ? 'no-cache' : 'public, max-age=3600',
    });
    res.end(data);
  });
}

const server = http.createServer(async (req, res) => {
  try {
    const url = new URL(req.url || '/', 'http://localhost');
    if (url.pathname.startsWith('/api/')) return await handleApi(req, res, url);
    return serveStatic(req, res, url.pathname);
  } catch (e) {
    try {
      json(res, 500, { error: String(e.message || e) });
    } catch (_) {}
  }
});

function lanIps() {
  const out = [];
  const nets = os.networkInterfaces();
  for (const name of Object.keys(nets)) {
    for (const n of nets[name] || []) {
      if (n.family === 'IPv4' && !n.internal) out.push(n.address);
    }
  }
  return out;
}

server.listen(PORT, HOST, () => {
  console.log('');
  console.log('  Portal Biblioteki ŁSW działa.');
  console.log('  Lokalnie:   http://127.0.0.1:' + PORT + '/');
  lanIps().forEach((ip) => console.log('  W sieci:    http://' + ip + ':' + PORT + '/'));
  console.log('  Książek w indeksie: ' + catalogIndex.length);
  console.log('');
  if (!SYNC_KEY) {
    console.log('  UWAGA: brak SYNC_KEY — aplikacja desktop NIE zsynchronizuje danych.');
    console.log('  Windows:  set SYNC_KEY=moj-tajny-klucz && node server.js');
  } else {
    console.log('  SYNC_KEY ustawiony — wklej ten sam klucz w aplikacji desktop.');
  }
  console.log('');
});
