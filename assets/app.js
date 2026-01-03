/* assets/app.js
   nunc shared runtime (no build step, no modules).
   Exposes window.NUNC.

   Backend-first single source of truth:
   - API is authoritative for posts + boosts across devices.
   - localStorage is cache only (fast paint / offline-ish), never authority.

   Minimum endpoints assumed:
   - GET    /api/posts
   - POST   /api/posts
   - POST   /api/posts/:id/boost   (supports optional JSON body { add })
   - DELETE /api/posts/:id
*/
(() => {
  'use strict';

  const ONE_DAY_MS = 86400000;

  // ---- API base (hardcoded for now) ----
  const API_BASE = 'https://testnunc.onrender.com';

  // ---- Cache keys (NOT authority) ----
  const CACHE_POSTS_KEY = 'nunc_cache_posts_v1';

  // Legacy keys (read once -> cache; then delete to stop divergence)
  const LEGACY_POST_KEYS = [
    'nunc_posts_v1',
    'nunc_posts',
    'nunc_leaderboard_posts',
    'nunc_leaderboard_v1'
  ];
  const LEGACY_BOOSTS_KEYS = [
    'nunc_boosts_v1'
  ];

  // Cross-tab channel (same origin)
  const BC = ('BroadcastChannel' in window) ? new BroadcastChannel('nunc_ledger') : null;

  const now = () => Date.now();
  const safeJsonParse = (s, fallback) => { try { return JSON.parse(s); } catch { return fallback; } };
  const safeGet = (k, fallback) => { try { return localStorage.getItem(k) ?? fallback; } catch { return fallback; } };
  const safeSet = (k, v) => { try { localStorage.setItem(k, v); return true; } catch { return false; } };
  const safeRemove = (k) => { try { localStorage.removeItem(k); return true; } catch { return false; } };

  // ---- Countries (UN members + Kosovo + Palestine; no other dependencies/non-recognised states) ----
  const COUNTRIES = [
    'Afghanistan','Albania','Algeria','Andorra','Angola','Antigua and Barbuda','Argentina','Armenia','Australia','Austria','Azerbaijan',
    'Bahamas','Bahrain','Bangladesh','Barbados','Belarus','Belgium','Belize','Benin','Bhutan','Bolivia','Bosnia and Herzegovina','Botswana','Brazil','Brunei','Bulgaria','Burkina Faso','Burundi',
    'Cabo Verde','Cambodia','Cameroon','Canada','Central African Republic','Chad','Chile','China','Colombia','Comoros','Congo','Costa Rica',"Côte d’Ivoire",'Croatia','Cuba','Cyprus','Czechia',
    'Denmark','Djibouti','Dominica','Dominican Republic',
    'Ecuador','Egypt','El Salvador','Equatorial Guinea','Eritrea','Estonia','Eswatini','Ethiopia',
    'Fiji','Finland','France',
    'Gabon','Gambia','Georgia','Germany','Ghana','Greece','Grenada','Guatemala','Guinea','Guinea-Bissau','Guyana',
    'Haiti','Honduras','Hungary',
    'Iceland','India','Indonesia','Iran','Iraq','Ireland','Israel','Italy',
    'Jamaica','Japan','Jordan',
    'Kazakhstan','Kenya','Kiribati','Kosovo','Kuwait','Kyrgyzstan',
    'Laos','Latvia','Lebanon','Lesotho','Liberia','Libya','Liechtenstein','Lithuania','Luxembourg',
    'Madagascar','Malawi','Malaysia','Maldives','Mali','Malta','Marshall Islands','Mauritania','Mauritius','Mexico','Micronesia','Moldova','Monaco','Mongolia','Montenegro','Morocco','Mozambique','Myanmar',
    'Namibia','Nauru','Nepal','Netherlands','New Zealand','Nicaragua','Niger','Nigeria','North Korea','North Macedonia','Norway',
    'Oman',
    'Pakistan','Palau','Palestine','Panama','Papua New Guinea','Paraguay','Peru','Philippines','Poland','Portugal','Qatar',
    'Romania','Russia','Rwanda',
    'Saint Kitts and Nevis','Saint Lucia','Saint Vincent and the Grenadines','Samoa','San Marino','Sao Tome and Principe','Saudi Arabia','Senegal','Serbia','Seychelles','Sierra Leone','Singapore','Slovakia','Slovenia','Solomon Islands','Somalia','South Africa','South Korea','South Sudan','Spain','Sri Lanka','Sudan','Suriname','Sweden','Switzerland','Syria',
    'Tajikistan','Tanzania','Thailand','Timor-Leste','Togo','Tonga','Trinidad and Tobago','Tunisia','Turkey','Turkmenistan','Tuvalu',
    'Uganda','Ukraine','United Arab Emirates','United Kingdom','United States','Uruguay','Uzbekistan',
    'Vanuatu','Vatican City','Venezuela','Vietnam',
    'Yemen',
    'Zambia','Zimbabwe'
  ];

  const rand = (arr) => arr[Math.floor(Math.random() * arr.length)];

  // ---- URL rule (block obvious links) ----
  const hasUrl = (s) => /(https?:\/\/|www\.|\.[a-z]{2,})(\/|$)/i.test(String(s || ''));

  // ---- Canonical post schema ----
  // { id, text, country, createdAt, expiresAt, boosts }
  const canonicalizePost = (p) => {
    if (!p || typeof p !== 'object') return null;

    const id = String(p.id || '').trim();
    if (!id) return null;

    const text = String(p.text ?? p.body ?? '').slice(0, 200);
    if (!text) return null;

    const createdAt = Number(p.createdAt ?? p.created_at ?? 0) || 0;

    const expiresAtRaw = Number(p.expiresAt ?? p.expires_at ?? 0) || 0;
    const expiresAt = expiresAtRaw || (createdAt ? (createdAt + ONE_DAY_MS) : 0);

    const country = String(p.country || p.location || '').trim() || '';

    const boosts = Number.isFinite(p.boosts) ? Number(p.boosts) : (
      Number.isFinite(p.score) ? Number(p.score) :
      Number.isFinite(p.points) ? Number(p.points) :
      Number.isFinite(p.boost) ? Number(p.boost) :
      Number.isFinite(p.boostCount) ? Number(p.boostCount) :
      0
    );

    return { id, text, country, createdAt, expiresAt, boosts: Math.max(0, Math.floor(boosts || 0)) };
  };

  const dedupeById = (posts) => {
    const seen = new Set();
    const out = [];
    for (const p of (Array.isArray(posts) ? posts : [])) {
      const cp = canonicalizePost(p);
      if (!cp) continue;
      if (seen.has(cp.id)) continue;
      seen.add(cp.id);
      out.push(cp);
    }
    return out;
  };

  const isAlive = (p, tNow) => {
    if (!p) return false;
    const e = Number(p.expiresAt || 0);
    if (e) return e > tNow;
    const c = Number(p.createdAt || 0);
    if (c) return (tNow - c) < ONE_DAY_MS;
    return true;
  };

  const prunePosts = (posts) => {
    const t = now();
    return (Array.isArray(posts) ? posts : []).filter(p => isAlive(p, t));
  };

  const sortLeaderboardPosts = (posts) => {
    const arr = Array.isArray(posts) ? posts.slice() : [];
    arr.sort((a, b) => {
      const ba = Number(a?.boosts || 0), bb = Number(b?.boosts || 0);
      if (bb !== ba) return bb - ba;
      const ta = Number(a?.createdAt || 0), tb = Number(b?.createdAt || 0);
      if (tb !== ta) return tb - ta;
      return String(a?.id || '').localeCompare(String(b?.id || ''));
    });
    return arr;
  };

  // ---- Cache IO (not authority) ----
  const loadCachedPosts = () => {
    const raw = safeGet(CACHE_POSTS_KEY, '[]');
    const arr = safeJsonParse(raw, []);
    return prunePosts(dedupeById(Array.isArray(arr) ? arr : []));
  };

  const saveCachedPosts = (posts) => {
    const canon = prunePosts(dedupeById(posts));
    safeSet(CACHE_POSTS_KEY, JSON.stringify(canon));
  };

  const migrateLegacyToCacheOnce = () => {
    let merged = loadCachedPosts();

    for (const k of LEGACY_POST_KEYS) {
      const raw = safeGet(k, null);
      if (raw == null) continue;
      const arr = safeJsonParse(raw, []);
      if (Array.isArray(arr) && arr.length) merged = merged.concat(arr);
    }

    for (const bk of LEGACY_BOOSTS_KEYS) {
      const raw = safeGet(bk, null);
      if (raw == null) continue;
      const m = safeJsonParse(raw, {});
      if (!m || typeof m !== 'object') continue;
      merged = merged.map(p => {
        const cp = canonicalizePost(p);
        if (!cp) return p;
        const b = Math.max(0, Math.floor(Number(m[cp.id] ?? 0)));
        if (b > (cp.boosts || 0)) return { ...cp, boosts: b };
        return cp;
      });
    }

    merged = sortLeaderboardPosts(prunePosts(dedupeById(merged)));
    if (merged.length) saveCachedPosts(merged);

    for (const k of LEGACY_POST_KEYS) safeRemove(k);
    for (const k of LEGACY_BOOSTS_KEYS) safeRemove(k);
  };

  // ---- Events / Sync ----
  const signalLedgerUpdate = (payload) => {
    try { if (BC) BC.postMessage({ type: 'ledger_update', t: now(), ...(payload || {}) }); } catch {}
    try { window.dispatchEvent(new CustomEvent('nunc:ledger_update', { detail: payload || {} })); } catch {}
  };

  const watchLedger = (cb, opts) => {
    const fn = (typeof cb === 'function') ? cb : (() => {});
    const options = opts || {};
    const pollMs = Math.max(300, Number(options.pollMs || 1200));

    if (BC) {
      BC.addEventListener('message', (ev) => {
        if (ev && ev.data && ev.data.type === 'ledger_update') fn(ev.data);
      });
    }

    window.addEventListener('storage', (e) => {
      if (!e) return;
      if (e.key === CACHE_POSTS_KEY) fn({ type: 'storage', key: e.key });
    });

    window.addEventListener('nunc:ledger_update', (e) => fn({ type: 'local', detail: e?.detail }));

    let lastSig = '';
    const poll = () => {
      const sig = safeGet(CACHE_POSTS_KEY, '');
      if (sig !== lastSig) {
        lastSig = sig;
        fn({ type: 'poll' });
      }
    };
    poll();
    const id = setInterval(poll, pollMs);
    return () => clearInterval(id);
  };

  // ---- Formatting ----
  const fmtTimeAgo = (ts) => {
    const t = Number(ts || 0);
    if (!t) return '—';
    const diff = Math.max(0, now() - t);
    const mins = Math.floor(diff / 60000);
    if (mins <= 0) return 'just now';
    if (mins < 60) return mins + 'm';
    const hrs = Math.floor(mins / 60);
    if (hrs < 24) return hrs + 'h';
    return '1d';
  };

  const fmtExpiry = (ts) => {
    const t = Number(ts || 0);
    if (!t) return '—';
    const d = new Date(t);
    return d.toLocaleString(undefined, {
      hour: '2-digit',
      minute: '2-digit',
      hour12: false,
      day: '2-digit',
      month: 'short',
      year: 'numeric'
    });
  };

  // ---- API helpers ----
  const apiJson = async (path, opts) => {
    const options = opts || {};
    const res = await fetch(API_BASE + path, {
      method: options.method || 'GET',
      headers: { 'Content-Type': 'application/json', ...(options.headers || {}) },
      body: options.body,
    });
    const data = await res.json().catch(() => ({}));
    if (!res.ok) {
      const err = new Error('HTTP ' + res.status);
      err.status = res.status;
      err.data = data;
      throw err;
    }
    return data;
  };

  // ---- Backend-first operations used by pages ----
  const getLedger = async (opts) => {
    const options = opts || {};
    const preferCache = !!options.preferCache;

    if (preferCache) {
      const cached = sortLeaderboardPosts(loadCachedPosts());
      const boosts = Object.create(null);
      for (const p of cached) boosts[p.id] = Number(p.boosts || 0);
      return { posts: cached, boosts };
    }

    const data = await apiJson('/api/posts', { method: 'GET' });
    const posts = sortLeaderboardPosts(prunePosts(dedupeById(Array.isArray(data.posts) ? data.posts : [])));
    saveCachedPosts(posts);
    signalLedgerUpdate({ op: 'ledger_refresh', n: posts.length });

    const boosts = Object.create(null);
    for (const p of posts) boosts[p.id] = Number(p.boosts || 0);

    return { posts, boosts };
  };

  // ---------------------------------------------------------------------------
  // FIXED: Create post must NOT require an id (server generates id).
  // ---------------------------------------------------------------------------
  const addOrUpdatePost = async (post) => {
    const text = String(post?.text ?? '').trim().slice(0, 200);
    const country = String(post?.country ?? '—').trim().slice(0, 80) || '—';
    const boosts = Math.max(0, Math.floor(Number(post?.boosts ?? 0)));

    // client-side rules (mirror server)
    if (!text) return null;
    if (hasUrl(text)) return null;

    const payload = { text, country, boosts };

    const data = await apiJson('/api/posts', {
      method: 'POST',
      body: JSON.stringify(payload),
    });

    const created = canonicalizePost(data.post);
    if (!created) return null;

    // Update cache immediately
    const cached = loadCachedPosts();
    const merged = sortLeaderboardPosts([created, ...cached.filter(p => p && p.id !== created.id)]);
    saveCachedPosts(merged);
    signalLedgerUpdate({ op: 'post_create', id: created.id });

    return created;
  };

  // addBoosts(postId, add): call API once with { add } (your server supports it)
  const addBoosts = async (postId, add) => {
    const id = String(postId || '').trim();
    const inc = Math.max(0, Math.floor(Number(add || 0)));
    if (!id || inc < 1) return { ok: false, boosts: 0 };

    const data = await apiJson(`/api/posts/${encodeURIComponent(id)}/boost`, {
      method: 'POST',
      body: JSON.stringify({ add: inc }),
    });

    const lastPost = canonicalizePost(data.post);
    if (!lastPost) return { ok: false, boosts: 0 };

    const cached = loadCachedPosts();
    const next = cached.map(p => (p && p.id === id) ? { ...p, boosts: lastPost.boosts } : p);
    const exists = next.some(p => p && p.id === id);
    const merged = sortLeaderboardPosts(exists ? next : [lastPost, ...next]);
    saveCachedPosts(merged);

    signalLedgerUpdate({ op: 'boost_add', id, add: inc, next: lastPost.boosts });
    return { ok: true, boosts: lastPost.boosts };
  };

  const deletePost = async (postId) => {
    const id = String(postId || '').trim();
    if (!id) return { ok: false };

    await apiJson(`/api/posts/${encodeURIComponent(id)}`, { method: 'DELETE' });

    const cached = loadCachedPosts().filter(p => p && p.id !== id);
    saveCachedPosts(sortLeaderboardPosts(cached));
    signalLedgerUpdate({ op: 'post_delete', id });
    return { ok: true };
  };

  const totalsByCountry = (posts) => {
    const totals = Object.create(null);
    for (const c of COUNTRIES) totals[c] = 0;

    const arr = Array.isArray(posts) ? posts : loadCachedPosts();
    for (const p of arr) {
      const c = String(p?.country || '').trim();
      if (!c) continue;
      if (!(c in totals)) totals[c] = 0;
      totals[c] += Number(p?.boosts || 0);
    }
    return totals;
  };

  const sortCountriesByTotals = (totals, list) => {
    const l = Array.isArray(list) ? list.slice() : COUNTRIES.slice();
    const t = totals || totalsByCountry();
    l.sort((a, b) => {
      const ta = Number(t[a] || 0);
      const tb = Number(t[b] || 0);
      if (tb !== ta) return tb - ta;
      return a.localeCompare(b);
    });
    return l;
  };

  migrateLegacyToCacheOnce();

  window.NUNC = Object.freeze({
    API_BASE,
    ONE_DAY_MS,
    CACHE_POSTS_KEY,
    LEGACY_POST_KEYS,
    COUNTRIES,

    now,
    rand,
    hasUrl,

    fmtTimeAgo,
    fmtExpiry,

    loadCachedPosts,
    saveCachedPosts,

    prunePosts,
    sortLeaderboardPosts,

    signalLedgerUpdate,
    watchLedger,

    getLedger,
    addOrUpdatePost,
    addBoosts,
    deletePost,
    totalsByCountry,
    sortCountriesByTotals
  });
})();
