/* assets/app.js
   nunc shared runtime: ledger, sync, formatting, country list, safe storage helpers.
   Exposes window.NUNC (no build step, no modules).

   Single source of truth:
   - Posts live in POSTS_KEY (array of canonical posts)
   - Boost totals live in BOOSTS_KEY (map postId -> boosts)
   - Pages NEVER define keys/countries/pruning/totals/sorting/sync/polling
*/
(() => {
  'use strict';

  const ONE_DAY_MS = 86400000;

  // Canonical keys
  const POSTS_KEY = 'nunc_posts_v1';    // array of posts
  const BOOSTS_KEY = 'nunc_boosts_v1';  // map { [postId]: number }

  // Legacy keys (read + merge + migrate once)
  const LEGACY_POST_KEYS = [
    POSTS_KEY,
    'nunc_posts',
    'nunc_leaderboard_posts',
    'nunc_leaderboard_v1'
  ];

  // Cross-tab channel (same origin)
  const BC = ('BroadcastChannel' in window) ? new BroadcastChannel('nunc_ledger') : null;

  const now = () => Date.now();

  const safeJsonParse = (s, fallback) => {
    try { return JSON.parse(s); } catch (_) { return fallback; }
  };

  const safeGet = (k, fallback) => {
    try { return localStorage.getItem(k) ?? fallback; } catch (_) { return fallback; }
  };

  const safeSet = (k, v) => {
    try { localStorage.setItem(k, v); return true; } catch (_) { return false; }
  };

  const safeRemove = (k) => {
    try { localStorage.removeItem(k); return true; } catch (_) { return false; }
  };

  // ---- Countries (UN members + Kosovo + Palestine; no other dependencies/non-recognised states) ----
  // Keep ordering stable (alphabetical).
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

  // ---- Post schema ----
  // Canonical post:
  // { id, text, country, createdAt, expiresAt, boosts }
  const canonicalizePost = (p) => {
    if (!p || typeof p !== 'object') return null;

    const id = String(p.id || '').trim();
    if (!id) return null;

    const text = String(p.text ?? p.body ?? '').slice(0, 200);
    if (!text) return null;

    const createdAt = Number(p.createdAt ?? p.created_at ?? 0) || 0;

    // Prefer explicit expiresAt; else createdAt + 24h if createdAt exists.
    const expiresAtRaw = Number(p.expiresAt ?? p.expires_at ?? 0) || 0;
    const expiresAt = expiresAtRaw || (createdAt ? (createdAt + ONE_DAY_MS) : 0);

    const country = String(p.country || p.location || '').trim() || '';

    // Try canonical boosts first; then common aliases; finally 0.
    const boosts = (Number.isFinite(p.boosts) ? Number(p.boosts) : NaN);
    const alt =
      Number.isFinite(p.score) ? Number(p.score) :
      Number.isFinite(p.points) ? Number(p.points) :
      Number.isFinite(p.boost) ? Number(p.boost) :
      Number.isFinite(p.boostCount) ? Number(p.boostCount) :
      0;

    return {
      id,
      text,
      country,
      createdAt,
      expiresAt,
      boosts: Number.isFinite(boosts) ? boosts : alt
    };
  };

  const isAlive = (p, tNow) => {
    if (!p) return false;
    const e = Number(p.expiresAt || 0);
    if (e) return e > tNow;
    const c = Number(p.createdAt || 0);
    if (c) return (tNow - c) < ONE_DAY_MS;
    return true;
  };

  // ---- Ledger IO ----
  const loadBoosts = () => {
    const raw = safeGet(BOOSTS_KEY, '{}');
    const m = safeJsonParse(raw, {});
    return (m && typeof m === 'object') ? m : {};
  };

  const saveBoosts = (map) => {
    const m = (map && typeof map === 'object') ? map : {};
    safeSet(BOOSTS_KEY, JSON.stringify(m));
  };

  const loadPostsFromKey = (k) => {
    const raw = safeGet(k, '[]');
    const arr = safeJsonParse(raw, []);
    return Array.isArray(arr) ? arr : [];
  };

  const dedupeById = (posts) => {
    const seen = new Set();
    const out = [];
    for (const p of posts) {
      const cp = canonicalizePost(p);
      if (!cp) continue;
      if (seen.has(cp.id)) continue;
      seen.add(cp.id);
      out.push(cp);
    }
    return out;
  };

  const loadPosts = () => {
    // Read from all legacy keys, merge, dedupe.
    const merged = [];
    for (const k of LEGACY_POST_KEYS) merged.push(...loadPostsFromKey(k));
    return dedupeById(merged);
  };

  const savePosts = (posts) => {
    const arr = Array.isArray(posts) ? posts : [];
    const canon = dedupeById(arr);

    // Write canonical key only.
    safeSet(POSTS_KEY, JSON.stringify(canon));

    // Clean old keys to avoid divergence.
    for (const k of LEGACY_POST_KEYS) {
      if (k !== POSTS_KEY) safeRemove(k);
    }
  };

  const prunePosts = (posts) => {
    const t = now();
    return (Array.isArray(posts) ? posts : []).filter(p => isAlive(p, t));
  };

  const syncBoostsIntoPosts = (posts, boostsMap) => {
    const map = boostsMap || loadBoosts();
    let changed = false;
    const out = (Array.isArray(posts) ? posts : []).map(p => {
      if (!p || !p.id) return p;
      const b = Number(map[p.id] ?? p.boosts ?? 0);
      if (Number(p.boosts || 0) !== b) {
        changed = true;
        return { ...p, boosts: b };
      }
      return p;
    });
    return { posts: out, changed };
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

  // ---- Events / Sync ----
  const signalLedgerUpdate = (payload) => {
    // Cross-tab
    try {
      if (BC) BC.postMessage({ type: 'ledger_update', t: now(), ...(payload || {}) });
    } catch (_) {}

    // Same-tab
    try {
      window.dispatchEvent(new CustomEvent('nunc:ledger_update', { detail: payload || {} }));
    } catch (_) {}
  };

  const watchLedger = (cb, opts) => {
    const fn = (typeof cb === 'function') ? cb : (() => {});
    const options = opts || {};
    const pollMs = Math.max(300, Number(options.pollMs || 900));

    // 1) BroadcastChannel
    if (BC) {
      BC.addEventListener('message', (ev) => {
        if (ev && ev.data && ev.data.type === 'ledger_update') fn(ev.data);
      });
    }

    // 2) storage events (other tabs)
    window.addEventListener('storage', (e) => {
      if (!e) return;
      if (e.key === POSTS_KEY || e.key === BOOSTS_KEY) fn({ type: 'storage', key: e.key });
    });

    // 3) same-tab custom event
    window.addEventListener('nunc:ledger_update', (e) => fn({ type: 'local', detail: e?.detail }));

    // 4) poll fallback (embed/preview environments)
    let lastSig = '';
    const poll = () => {
      const sig = safeGet(POSTS_KEY, '') + '|' + safeGet(BOOSTS_KEY, '');
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
    // 24h clock, with date.
    return d.toLocaleString(undefined, {
      hour: '2-digit',
      minute: '2-digit',
      hour12: false,
      day: '2-digit',
      month: 'short',
      year: 'numeric'
    });
  };

  // ---- URL rule (block obvious links) ----
  const hasUrl = (s) => /(https?:\/\/|www\.|\.[a-z]{2,})(\/|$)/i.test(String(s || ''));

  // ---- High-level operations used by pages ----
  const getLedger = () => {
    const boosts = loadBoosts();
    let posts = prunePosts(loadPosts());
    const synced = syncBoostsIntoPosts(posts, boosts);
    posts = synced.posts;
    if (synced.changed) savePosts(posts);
    return { posts, boosts };
  };

  // Upsert post; seed/merge paid boosts into BOOSTS_KEY so they persist.
  const addOrUpdatePost = (post) => {
    const cp = canonicalizePost(post);
    if (!cp) return null;

    // Seed/merge boosts into canonical boosts map so paid boosts persist.
    const map = loadBoosts();
    const existing = Number(map[cp.id] ?? 0);
    const incoming = Math.max(0, Math.floor(Number(cp.boosts || 0)));
    const seeded = Math.max(existing, incoming);
    if (seeded !== existing) {
      map[cp.id] = seeded;
      saveBoosts(map);
    }
    cp.boosts = seeded;

    let posts = prunePosts(loadPosts());
    const idx = posts.findIndex(p => p && p.id === cp.id);
    if (idx >= 0) posts[idx] = { ...posts[idx], ...cp };
    else posts.unshift(cp);

    posts = sortLeaderboardPosts(posts);
    savePosts(posts);
    signalLedgerUpdate({ op: 'post_upsert', id: cp.id });
    return cp;
  };

  // Add boosts; if boost map has no entry yet, fall back to stored post.boosts (paid boosts).
  const addBoosts = (postId, add) => {
    const id = String(postId || '').trim();
    const inc = Math.max(0, Math.floor(Number(add || 0)));
    if (!id || inc < 1) return { ok: false, boosts: 0 };

    const map = loadBoosts();
    let prev = Number(map[id] ?? 0);

    // If boosts map doesn't yet have this post, fall back to stored post.boosts.
    if (!(id in map)) {
      const posts0 = prunePosts(loadPosts());
      const p = posts0.find(x => x && x.id === id);
      const pb = Number(p?.boosts ?? 0);
      if (Number.isFinite(pb) && pb > prev) prev = pb;
    }

    const next = prev + inc;
    map[id] = next;
    saveBoosts(map);

    // Sync into posts if exists
    let posts = prunePosts(loadPosts());
    const idx = posts.findIndex(p => p && p.id === id);
    if (idx >= 0) {
      posts[idx] = { ...posts[idx], boosts: next };
      posts = sortLeaderboardPosts(posts);
      savePosts(posts);
    }

    signalLedgerUpdate({ op: 'boost_add', id, add: inc, next });
    return { ok: true, boosts: next };
  };

  const totalsByCountry = (posts) => {
    const totals = Object.create(null);
    for (const c of COUNTRIES) totals[c] = 0;

    const arr = Array.isArray(posts) ? posts : getLedger().posts;
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

  // ---- Export: the only public surface area ----
  window.NUNC = Object.freeze({
    // constants
    ONE_DAY_MS,
    POSTS_KEY,
    BOOSTS_KEY,
    LEGACY_POST_KEYS,
    COUNTRIES,

    // utils
    now,
    rand,
    hasUrl,

    // formatting
    fmtTimeAgo,
    fmtExpiry,

    // internal IO (kept public only if pages/tools need it)
    loadPosts,
    savePosts,
    loadBoosts,
    saveBoosts,
    prunePosts,
    syncBoostsIntoPosts,
    sortLeaderboardPosts,

    // sync
    signalLedgerUpdate,
    watchLedger,

    // operations
    getLedger,
    addOrUpdatePost,
    addBoosts,
    totalsByCountry,
    sortCountriesByTotals
  });
})();
