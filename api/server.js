import express from "express";
import cors from "cors";
import { getDb } from "./db.js";

const app = express();
const PORT = process.env.PORT || 8787;

app.use(cors({ origin: true }));
app.use(express.json({ limit: "50kb" }));

function clampPostBody(s) {
  const body = (s ?? "").toString().trim();
  if (!body) return null;
  if (body.length > 200) return body.slice(0, 200);
  return body;
}

app.get("/health", (req, res) => res.json({ ok: true }));

// Create post
app.post("/posts", async (req, res) => {
  try {
    const db = await getDb();
    const body = clampPostBody(req.body?.body);
    const country = (req.body?.country ?? "Unknown").toString().trim() || "Unknown";

    if (!body) return res.status(400).json({ error: "Post body required" });

    const createdAt = Date.now();
    const result = await db.run(
      "INSERT INTO posts (body, country, boosts, created_at) VALUES (?, ?, 0, ?)",
      [body, country, createdAt]
    );

    const post = await db.get("SELECT * FROM posts WHERE id = ?", [result.lastID]);
    res.json({ post });
  } catch (e) {
    res.status(500).json({ error: "Server error" });
  }
});

// Latest feed
app.get("/posts", async (req, res) => {
  try {
    const db = await getDb();
    const limit = Math.max(1, Math.min(50, Number(req.query.limit ?? 20)));
    const rows = await db.all(
      "SELECT * FROM posts ORDER BY created_at DESC LIMIT ?",
      [limit]
    );
    res.json({ posts: rows });
  } catch (e) {
    res.status(500).json({ error: "Server error" });
  }
});

// Leaderboard
app.get("/leaderboard", async (req, res) => {
  try {
    const db = await getDb();
    const limit = Math.max(1, Math.min(100, Number(req.query.limit ?? 50)));
    const rows = await db.all(
      "SELECT * FROM posts ORDER BY boosts DESC, created_at DESC LIMIT ?",
      [limit]
    );
    res.json({ posts: rows });
  } catch (e) {
    res.status(500).json({ error: "Server error" });
  }
});

// Boost (atomic)
app.post("/posts/:id/boost", async (req, res) => {
  try {
    const db = await getDb();
    const id = Number(req.params.id);
    const amount = Math.max(1, Math.min(9999, Number(req.body?.amount ?? 1)));

    if (!Number.isFinite(id)) return res.status(400).json({ error: "Bad id" });

    await db.run("BEGIN IMMEDIATE TRANSACTION");
    const found = await db.get("SELECT id, boosts FROM posts WHERE id = ?", [id]);
    if (!found) {
      await db.run("ROLLBACK");
      return res.status(404).json({ error: "Not found" });
    }

    await db.run("UPDATE posts SET boosts = boosts + ? WHERE id = ?", [amount, id]);
    const post = await db.get("SELECT * FROM posts WHERE id = ?", [id]);
    await db.run("COMMIT");

    res.json({ post });
  } catch (e) {
    try {
      const db = await getDb();
      await db.run("ROLLBACK");
    } catch {}
    res.status(500).json({ error: "Server error" });
  }
});

app.listen(PORT, () => {
  console.log(`API listening on http://localhost:${PORT}`);
});
