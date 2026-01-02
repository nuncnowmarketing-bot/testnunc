// api/server.js
import express from "express";
import cors from "cors";

const app = express();
app.use(express.json({ limit: "64kb" }));

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

// posts: Map<id, {id,text,country,boosts,createdAt,expiresAt}>
const posts = new Map();

function pruneExpired() {
  const t = now();
  for (const [id, p] of posts) {
    if (!p || !p.expiresAt || p.expiresAt <= t) posts.delete(id);
  }
}

function sortedPosts() {
  pruneExpired();
  return Array.from(posts.values()).sort((a, b) => {
    const db = Number(b.boosts || 0) - Number(a.boosts || 0);
    if (db !== 0) return db;
    return Number(b.createdAt || 0) - Number(a.createdAt || 0);
  });
}

app.get("/", (_req, res) => res.status(200).send("ok"));
app.get("/healthz", (_req, res) => res.status(200).json({ ok: true }));

app.get("/api/posts", (_req, res) => {
  res.json({ posts: sortedPosts() });
});

app.post("/api/posts", (req, res) => {
  const text = String(req.body?.text ?? "").trim();
  const country = String(req.body?.country ?? "—").trim().slice(0, 80) || "—";
  const boosts = Math.max(0, Math.floor(Number(req.body?.boosts ?? 0)));

  if (!text) return res.status(400).json({ error: "empty" });
  if (text.length > 200) return res.status(400).json({ error: "too_long" });
  if (hasUrl(text)) return res.status(400).json({ error: "url_blocked" });

  const id = genId();
  const createdAt = now();
  const expiresAt = createdAt + ONE_DAY_MS;

  posts.set(id, { id, text, country, boosts, createdAt, expiresAt });
  res.status(201).json({ ok: true, post: posts.get(id) });
});

app.post("/api/posts/:id/boost", (req, res) => {
  const id = String(req.params.id || "");
  const add = Math.max(0, Math.floor(Number(req.body?.add ?? 1)));

  pruneExpired();
  const p = posts.get(id);
  if (!p) return res.status(404).json({ error: "not_found" });

  p.boosts = Math.max(0, Number(p.boosts || 0) + add);
  posts.set(id, p);
  res.json({ ok: true, post: p });
});

const PORT = process.env.PORT || 3000;
app.listen(PORT, () => console.log(`API listening on ${PORT}`));
