// server.js (Node + Express API for nunc)
// Stateless demo API: posts + boosts shared across devices.
// Storage: in-memory (resets on redeploy/sleep). Swap to Postgres later.

import express from "express";
import cors from "cors";

const app = express();
app.use(express.json({ limit: "64kb" }));

// CORS: allow GitHub Pages + local dev. Tighten later.
app.use(
  cors({
    origin: true,
    methods: ["GET", "POST", "OPTIONS"],
    allowedHeaders: ["Content-Type"],
  })
);

const ONE_DAY_MS = 86400000;
const now = () => Date.now();
const hasUrl = (s) => /(https?:\/\/|www\.|\.[a-z]{2,})(\/|$)/i.test(String(s || ""));
const genId = () => Math.random().toString(36).slice(2) + now().toString(36);

// ---- In-memory store ----
// posts: Map<id, {id,text,country,createdAt,expiresAt}>
// boosts: Map<id, number>
const posts = new Map();
const boosts = new Map();

function pruneExpired() {
  const t = now();
  for (const [id, p] of posts.entries()) {
    if (Number(p.expiresAt || 0) <= t) {
      posts.delete(id);
      boosts.delete(id);
    }
  }
}

function serializePost(p) {
  const b = Number(boosts.get(p.id) ?? 0);
  return { ...p, boosts: b };
}

function sortedFeed() {
  pruneExpired();
  const arr = [];
  for (const p of posts.values()) arr.push(serializePost(p));
  arr.sort((a, b) => {
    const ba = Number(a.boosts || 0);
    const bb = Number(b.boosts || 0);
    if (bb !== ba) return bb - ba;
    const ta = Number(a.createdAt || 0);
    const tb = Number(b.createdAt || 0);
    if (tb !== ta) return tb - ta;
    return String(a.id).localeCompare(String(b.id));
  });
  return arr;
}

// ---- Routes ----

app.get("/", (_req, res) => {
  res.type("text").send("nunc api ok");
});

// Optional health endpoint (only set Render health check if you keep this)
app.get("/healthz", (_req, res) => {
  res.json({ ok: true, t: now() });
});

// Get ranked posts
app.get("/api/posts", (_req, res) => {
  const feed = sortedFeed();
  res.json({ posts: feed });
});

// Create a post
// body: { text, country, boosts }
app.post("/api/posts", (req, res) => {
  pruneExpired();

  const text = String(req.body?.text ?? "").trim().slice(0, 200);
  const country = String(req.body?.country ?? "—").trim().slice(0, 80) || "—";
  const initialBoosts = Math.max(0, Math.floor(Number(req.body?.boosts ?? 0)));

  if (!text) return res.status(400).json({ error: "empty" });
  if (hasUrl(text)) return res.status(400).json({ error: "url_blocked" });

  const createdAt = now();
  const expiresAt = createdAt + ONE_DAY_MS;
  const id = genId();

  const post = { id, text, country, createdAt, expiresAt };
  posts.set(id, post);
  boosts.set(id, initialBoosts);

  res.json({ post: serializePost(post) });
});

// Boost a post
// body: { add }
app.post("/api/posts/:id/boost", (req, res) => {
  pruneExpired();

  const id = String(req.params.id || "").trim();
  if (!id || !posts.has(id)) return res.status(404).json({ error: "not_found" });

  const add = Math.max(1, Math.floor(Number(req.body?.add ?? 0)));
  const prev = Number(boosts.get(id) ?? 0);
  const next = prev + add;
  boosts.set(id, next);

  res.json({ ok: true, boosts: next });
});

// ---- Start ----
const PORT = process.env.PORT ? Number(process.env.PORT) : 3000;
app.listen(PORT, () => {
  // Render expects you to bind to process.env.PORT
  console.log("nunc api listening on", PORT);
});
