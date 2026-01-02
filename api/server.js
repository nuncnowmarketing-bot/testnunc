<!doctype html>
<html lang="en">
<head>
  <meta charset="utf-8" />
  <meta name="viewport" content="width=device-width,initial-scale=1" />
  <title>nunc — leaderboard</title>
  <style>
    :root{
      --bg:#121212;
      --panel:#161616;
      --panel2:#1b1b1b;
      --text:#ffffff;
      --muted:rgba(255,255,255,0.70);
      --hair:rgba(255,255,255,0.12);
      --pill:rgba(255,255,255,0.06);
      --pillHover:rgba(255,255,255,0.10);
      --danger:#ff4d4d;
      --ok:#7CFCB2;
      --gold:#d4af37;
      --goldBg:rgba(212,175,55,0.15);
      --goldHover:rgba(212,175,55,0.25);
      --focus:rgba(212,175,55,0.55);
    }

    *{box-sizing:border-box}
    html,body{height:100%}
    body{
      margin:0;
      color:var(--text);
      background:var(--bg);
      font-family:Garamond,"EB Garamond","Cormorant Garamond","Times New Roman",serif;
      letter-spacing:0.2px;
    }

    a{color:inherit;text-decoration:none}

    /* fixed background layer to avoid white flash while scrolling */
    .bg{
      position:fixed; inset:0;
      background:radial-gradient(1200px 600px at 50% -10%, rgba(212,175,55,0.10), transparent 60%),
                 radial-gradient(900px 500px at 10% 20%, rgba(255,255,255,0.04), transparent 60%),
                 radial-gradient(900px 500px at 90% 30%, rgba(255,255,255,0.03), transparent 60%),
                 linear-gradient(180deg, #121212, #0e0e0e);
      pointer-events:none;
      z-index:-1;
    }

    header{
      position:sticky; top:0; z-index:10;
      background:rgba(18,18,18,0.88);
      backdrop-filter: blur(10px);
      border-bottom:1px solid var(--hair);
    }
    .topbar{
      max-width:1100px;
      margin:0 auto;
      padding:12px 16px;
      display:flex;
      align-items:center;
      justify-content:space-between;
      gap:12px;
    }
    .brand{
      display:flex; align-items:baseline; gap:10px;
    }
    .logo{
      font-weight:700;
      font-size:20px;
      letter-spacing:0.6px;
    }
    .sub{
      font-size:12px;
      color:var(--muted);
      text-transform:uppercase;
      letter-spacing:1px;
      white-space:nowrap;
    }

    .nav{
      display:flex; gap:10px; flex-wrap:wrap; justify-content:flex-end;
    }
    .pill{
      display:inline-flex;
      align-items:center;
      gap:8px;
      padding:10px 12px;
      border:1px solid var(--hair);
      background:var(--pill);
      color:var(--text);
      border-radius:999px;
      font-size:13px;
      letter-spacing:0.3px;
      transition:background .15s ease, border-color .15s ease, transform .15s ease;
      user-select:none;
    }
    .pill:hover{background:var(--pillHover); transform:translateY(-1px)}
    .pill:focus{outline:none; box-shadow:0 0 0 3px var(--focus)}
    .pill.gold{
      border-color:rgba(212,175,55,0.35);
      background:var(--goldBg);
    }
    .pill.gold:hover{background:var(--goldHover)}
    .pill.danger{
      border-color:rgba(255,77,77,0.35);
      background:rgba(255,77,77,0.10);
    }
    .pill.danger:hover{background:rgba(255,77,77,0.16)}
    .pill.disabled{opacity:.55; pointer-events:none}

    main{
      max-width:1100px;
      margin:0 auto;
      padding:16px 16px 72px;
    }

    .shell{
      border:1px solid var(--hair);
      background:linear-gradient(180deg,var(--panel),var(--panel2));
      border-radius:18px;
      overflow:hidden;
      box-shadow:0 12px 30px rgba(0,0,0,0.35);
    }

    .shellHeader{
      padding:16px;
      border-bottom:1px solid var(--hair);
      display:flex;
      align-items:flex-end;
      justify-content:space-between;
      gap:12px;
      flex-wrap:wrap;
    }
    .title{
      margin:0;
      font-size:22px;
      font-weight:600;
      letter-spacing:0.2px;
    }
    .metaRow{
      display:flex; gap:10px; flex-wrap:wrap; align-items:center; justify-content:flex-end;
      color:var(--muted);
      font-size:13px;
    }
    .badge{
      display:inline-flex;
      align-items:center;
      gap:8px;
      padding:8px 10px;
      border-radius:999px;
      border:1px solid var(--hair);
      background:rgba(255,255,255,0.04);
      white-space:nowrap;
    }
    .dot{
      width:8px; height:8px; border-radius:999px; background:var(--gold);
      box-shadow:0 0 0 3px rgba(212,175,55,0.15);
    }

    .compose{
      padding:16px;
      border-bottom:1px solid var(--hair);
      display:grid;
      grid-template-columns: 1fr 180px 150px;
      gap:10px;
    }
    @media (max-width: 820px){
      .compose{grid-template-columns:1fr; }
    }
    .field{
      display:flex;
      flex-direction:column;
      gap:6px;
    }
    .label{
      font-size:12px;
      color:var(--muted);
      letter-spacing:0.8px;
      text-transform:uppercase;
    }
    input, textarea{
      width:100%;
      border:1px solid var(--hair);
      background:rgba(255,255,255,0.04);
      color:var(--text);
      border-radius:14px;
      padding:12px 12px;
      font-family:inherit;
      font-size:15px;
      outline:none;
    }
    textarea{min-height:52px; max-height:160px; resize:vertical}
    input:focus, textarea:focus{box-shadow:0 0 0 3px var(--focus)}
    .helper{
      display:flex;
      justify-content:space-between;
      gap:10px;
      font-size:12px;
      color:var(--muted);
      margin-top:6px;
    }
    .helper b{color:var(--text); font-weight:600}
    .composeActions{
      padding:0 16px 16px;
      display:flex;
      justify-content:flex-end;
      gap:10px;
      border-bottom:1px solid var(--hair);
    }

    .feed{
      padding:0;
    }

    .row{
      display:grid;
      grid-template-columns: 70px 1fr 160px;
      gap:12px;
      padding:16px;
      border-bottom:1px solid var(--hair);
    }
    @media (max-width: 820px){
      .row{grid-template-columns: 60px 1fr; }
      .actions{grid-column: 1 / -1; justify-content:flex-start;}
    }
    .rank{
      display:flex;
      flex-direction:column;
      gap:8px;
      align-items:flex-start;
    }
    .rankNum{
      font-size:22px;
      font-weight:700;
      letter-spacing:0.4px;
    }
    .boosts{
      display:inline-flex;
      align-items:center;
      gap:8px;
      padding:8px 10px;
      border-radius:999px;
      border:1px solid rgba(212,175,55,0.35);
      background:var(--goldBg);
      font-size:13px;
      white-space:nowrap;
    }
    .content{
      display:flex;
      flex-direction:column;
      gap:10px;
      min-width:0;
    }
    .text{
      font-size:16px;
      line-height:1.35;
      word-wrap:break-word;
      overflow-wrap:anywhere;
    }
    .subline{
      display:flex;
      flex-wrap:wrap;
      gap:10px;
      color:var(--muted);
      font-size:13px;
    }
    .kv{
      display:inline-flex;
      align-items:center;
      gap:6px;
      padding:7px 10px;
      border-radius:999px;
      border:1px solid var(--hair);
      background:rgba(255,255,255,0.03);
      white-space:nowrap;
    }

    .actions{
      display:flex;
      gap:10px;
      justify-content:flex-end;
      align-items:flex-start;
      flex-wrap:wrap;
    }

    .empty{
      padding:22px 16px;
      color:var(--muted);
      font-size:14px;
    }

    footer{
      border-top:1px solid var(--hair);
      color:var(--muted);
      font-size:12px;
      padding:14px 16px;
      text-align:center;
      background:rgba(0,0,0,0.18);
    }

    .errorBar{
      display:none;
      margin:16px 0 0;
      padding:10px 12px;
      border:1px solid rgba(255,77,77,0.35);
      background:rgba(255,77,77,0.10);
      border-radius:14px;
      color:var(--text);
      font-size:13px;
    }
    .errorBar.show{display:block}
    .mono{font-family: ui-monospace, SFMono-Regular, Menlo, Monaco, Consolas, "Liberation Mono", "Courier New", monospace;}
  </style>
</head>

<body>
  <div class="bg" aria-hidden="true"></div>

  <header>
    <div class="topbar">
      <div class="brand">
        <div class="logo">nunc</div>
        <div class="sub">leaderboard</div>
      </div>
      <nav class="nav">
        <a class="pill" href="./explore.html">Explore</a>
        <a class="pill" href="./map.html">Map</a>
        <a class="pill" href="./post.html">Post</a>
        <button class="pill gold" id="refreshBtn" type="button">Refresh</button>
        <button class="pill danger" id="clearBtn" type="button">Local reset</button>
      </nav>
    </div>
  </header>

  <main>
    <section class="shell">
      <div class="shellHeader">
        <h1 class="title">Global ranked feed</h1>
        <div class="metaRow">
          <span class="badge"><span class="dot"></span><span id="apiStatus">API: unknown</span></span>
          <span class="badge">Posts: <b id="count">0</b></span>
          <span class="badge">Updated: <b id="updated">—</b></span>
        </div>
      </div>

      <div class="compose">
        <div class="field">
          <div class="label">Post</div>
          <textarea id="text" maxlength="200" placeholder="Write (max 200 chars). URLs are blocked."></textarea>
          <div class="helper">
            <span><span class="mono">/api/posts</span></span>
            <span><b id="chars">0</b>/200</span>
          </div>
        </div>
        <div class="field">
          <div class="label">Country</div>
          <input id="country" maxlength="80" placeholder="e.g., Ireland" />
          <div class="helper"><span>Ranked by boosts</span><span>&nbsp;</span></div>
        </div>
        <div class="field">
          <div class="label">Initial boosts</div>
          <input id="initialBoosts" type="number" min="0" step="1" value="0" />
          <div class="helper"><span>Saved server-side</span><span>&nbsp;</span></div>
        </div>
      </div>

      <div class="composeActions">
        <button class="pill" id="postBtn" type="button">Submit post</button>
      </div>

      <div class="errorBar" id="errorBar"></div>

      <div class="feed" id="feed"></div>

      <footer>
        This page renders from the API. In-memory store resets on redeploy/sleep.
      </footer>
    </section>
  </main>

  <script>
    // ----------------------------
    // API base selection
    // ----------------------------
    const DEFAULT_RENDER_API = "https://testnunc.onrender.com"; // change if your service URL differs

    function pickApiBase(){
      const host = location.hostname;
      const proto = location.protocol;

      // If you are *on* the Render domain (same-origin), use same origin.
      if (host.endsWith(".onrender.com")) return `${proto}//${host}`;

      // If GitHub Pages, use your Render API.
      if (host.endsWith("github.io")) return DEFAULT_RENDER_API;

      // Local dev: use localhost:3000 by default.
      if (host === "localhost" || host === "127.0.0.1") return "http://localhost:3000";

      // Fallback: use Render API.
      return DEFAULT_RENDER_API;
    }

    const API_BASE = pickApiBase();

    // ----------------------------
    // DOM
    // ----------------------------
    const elFeed = document.getElementById("feed");
    const elCount = document.getElementById("count");
    const elUpdated = document.getElementById("updated");
    const elApiStatus = document.getElementById("apiStatus");
    const elErrorBar = document.getElementById("errorBar");

    const elText = document.getElementById("text");
    const elChars = document.getElementById("chars");
    const elCountry = document.getElementById("country");
    const elInitialBoosts = document.getElementById("initialBoosts");

    const refreshBtn = document.getElementById("refreshBtn");
    const clearBtn = document.getElementById("clearBtn");
    const postBtn = document.getElementById("postBtn");

    // ----------------------------
    // Helpers
    // ----------------------------
    const pad2 = (n) => String(n).padStart(2, "0");
    function fmtLocal(ts){
      const d = new Date(ts);
      return `${d.getFullYear()}-${pad2(d.getMonth()+1)}-${pad2(d.getDate())} ${pad2(d.getHours())}:${pad2(d.getMinutes())}`;
    }
    function showErr(msg){
      elErrorBar.textContent = msg;
      elErrorBar.classList.add("show");
    }
    function clearErr(){
      elErrorBar.textContent = "";
      elErrorBar.classList.remove("show");
    }
    function safeText(s){
      return String(s ?? "").replace(/[&<>"]/g, (ch) => ({ "&":"&amp;","<":"&lt;",">":"&gt;",'"':"&quot;" }[ch]));
    }
    function urlBlockedMessage(code){
      if (code === "url_blocked") return "Blocked: URLs are not allowed in posts.";
      if (code === "empty") return "Blocked: post is empty.";
      return "Request rejected.";
    }

    // ----------------------------
    // API
    // ----------------------------
    async function apiGetPosts(){
      const r = await fetch(`${API_BASE}/api/posts`, { method:"GET" });
      if (!r.ok) throw new Error(`GET /api/posts failed (${r.status})`);
      return r.json();
    }

    async function apiCreatePost({ text, country, boosts }){
      const r = await fetch(`${API_BASE}/api/posts`, {
        method:"POST",
        headers:{ "Content-Type":"application/json" },
        body: JSON.stringify({ text, country, boosts })
      });
      const j = await r.json().catch(() => ({}));
      if (!r.ok) {
        const code = j && j.error ? j.error : "error";
        throw new Error(urlBlockedMessage(code));
      }
      return j;
    }

    async function apiBoost(id, add){
      const r = await fetch(`${API_BASE}/api/posts/${encodeURIComponent(id)}/boost`, {
        method:"POST",
        headers:{ "Content-Type":"application/json" },
        body: JSON.stringify({ add })
      });
      const j = await r.json().catch(() => ({}));
      if (!r.ok) throw new Error(j && j.error ? j.error : `boost failed (${r.status})`);
      return j;
    }

    async function apiHealth(){
      // Your API exposes "/" and "/healthz"
      const r = await fetch(`${API_BASE}/healthz`, { method:"GET" }).catch(() => null);
      if (r && r.ok) return true;
      const r2 = await fetch(`${API_BASE}/`, { method:"GET" }).catch(() => null);
      return !!(r2 && r2.ok);
    }

    // ----------------------------
    // Render
    // ----------------------------
    function renderFeed(posts){
      elFeed.innerHTML = "";
      elCount.textContent = String(posts.length);

      if (!posts.length){
        elFeed.innerHTML = `<div class="empty">No posts yet. Create one above.</div>`;
        return;
      }

      const frag = document.createDocumentFragment();

      posts.forEach((p, idx) => {
        const row = document.createElement("div");
        row.className = "row";

        const rank = document.createElement("div");
        rank.className = "rank";
        rank.innerHTML = `
          <div class="rankNum">#${idx + 1}</div>
          <div class="boosts">Boosts: <b>${Number(p.boosts || 0)}</b></div>
        `;

        const content = document.createElement("div");
        content.className = "content";
        const expiresAt = Number(p.expiresAt || 0);
        const createdAt = Number(p.createdAt || 0);
        content.innerHTML = `
          <div class="text">${safeText(p.text || "")}</div>
          <div class="subline">
            <span class="kv">Country: <b>${safeText(p.country || "—")}</b></span>
            <span class="kv">Posted: <b>${createdAt ? fmtLocal(createdAt) : "—"}</b></span>
            <span class="kv">Expires: <b>${expiresAt ? fmtLocal(expiresAt) : "—"}</b></span>
            <span class="kv mono">ID: ${safeText(p.id || "")}</span>
          </div>
        `;

        const actions = document.createElement("div");
        actions.className = "actions";
        actions.innerHTML = `
          <button class="pill gold" type="button" data-act="boost1" data-id="${safeText(p.id)}">+1 Boost</button>
          <button class="pill gold" type="button" data-act="boost5" data-id="${safeText(p.id)}">+5 Boost</button>
          <button class="pill" type="button" data-act="boost10" data-id="${safeText(p.id)}">+10 Boost</button>
        `;

        row.appendChild(rank);
        row.appendChild(content);
        row.appendChild(actions);

        frag.appendChild(row);
      });

      elFeed.appendChild(frag);
    }

    async function refresh(){
      clearErr();
      elUpdated.textContent = "—";
      const ok = await apiHealth().catch(() => false);
      elApiStatus.textContent = ok ? `API: ok (${API_BASE})` : `API: down (${API_BASE})`;

      if (!ok){
        showErr("API unreachable. Check Render service is Live and CORS is enabled (you already enabled cors()).");
        renderFeed([]);
        return;
      }

      const data = await apiGetPosts();
      renderFeed(Array.isArray(data.posts) ? data.posts : []);
      elUpdated.textContent = fmtLocal(Date.now());
    }

    // ----------------------------
    // Events
    // ----------------------------
    elText.addEventListener("input", () => {
      elChars.textContent = String((elText.value || "").length);
    });

    refreshBtn.addEventListener("click", () => refresh());

    postBtn.addEventListener("click", async () => {
      clearErr();
      const text = String(elText.value || "").trim().slice(0, 200);
      const country = String(elCountry.value || "—").trim().slice(0, 80) || "—";
      const boosts = Math.max(0, Math.floor(Number(elInitialBoosts.value || 0)));

      postBtn.classList.add("disabled");

      try{
        await apiCreatePost({ text, country, boosts });
        elText.value = "";
        elChars.textContent = "0";
        await refresh();
      }catch(e){
        showErr(String(e && e.message ? e.message : e));
      }finally{
        postBtn.classList.remove("disabled");
      }
    });

    elFeed.addEventListener("click", async (ev) => {
      const btn = ev.target.closest("button[data-act][data-id]");
      if (!btn) return;

      const id = btn.getAttribute("data-id");
      const act = btn.getAttribute("data-act");

      let add = 1;
      if (act === "boost5") add = 5;
      if (act === "boost10") add = 10;

      btn.classList.add("disabled");

      try{
        await apiBoost(id, add);
        await refresh();
      }catch(e){
        showErr(String(e && e.message ? e.message : e));
      }finally{
        btn.classList.remove("disabled");
      }
    });

    // Local reset only clears form fields, not server data.
    clearBtn.addEventListener("click", () => {
      elText.value = "";
      elChars.textContent = "0";
      elCountry.value = "";
      elInitialBoosts.value = "0";
      clearErr();
    });

    // initial load + polling
    refresh();
    setInterval(refresh, 15000);
  </script>
</body>
</html>
