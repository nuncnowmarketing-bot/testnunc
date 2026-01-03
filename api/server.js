// api/server.js
import express from "express";
import cors from "cors";
import pg from "pg";

const { Pool } = pg;

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

if (!process.env.DATABASE_URL) {
  throw new Error("DATABASE_URL not set");
}

// If you use Render's *Internal* DB URL (recommended when DB+API are on Render),
// you can set ssl: false. If you use the *External* DB URL, SSL is required.
// This config works with External URLs too.
const pool = new Pool({
  connectionString: process.env.DATABASE_URL,
  ssl: { rejectUnauthorized: false },
});

async function initDb() {
  await pool.query(`
    CREATE TABLE IF NOT EXISTS posts (
      id TEXT PRIMARY KEY,
      text TEXT NOT NULL,
      country TEXT NOT NULL,
      boosts INTEGER NOT NULL DEFAULT 0,
      created_at BIGINT NOT NULL,
      expires_at BIGINT NOT NULL
    );
    CREATE INDEX IF NOT EXISTS posts_rank_idx
      ON posts (boosts DESC, created_at DESC);
    CREATE INDEX IF NOT EXISTS posts_expires_idx
      ON posts (expires_at);
  `);
}

async function pruneExpired() {
  await pool.query(`DELETE FROM posts WHERE expires_at <= $1`, [now()]);
}

app.get("/", (_req, res) => res.status(200).send("ok"));

app.get("/healthz", async (_req, res) => {
  try {
    await pool.query("SELECT 1");
    res.status(200).json({ ok: true });
  } catch (e) {
    res.status(500).json({ ok: false });
  }
});

app.get("/api/posts", async (_req, res) => {
  try {
    await pruneExpired();
    const { rows } = await pool.query(
      `SELECT id,
              text,
              country,
              boosts,
              created_at AS "createdAt",
              expires_at AS "expiresAt"
         FROM posts
        ORDER BY boosts DESC, created_at DESC`
    );
    res.json({ posts: rows });
  } catch (e) {
    res.status(500).json({ error: "db_error" });
  }
});

app.post("/api/posts", async (req, res) => {
  try {
    const text = String(req.body?.text ?? "").trim();
    const country = String(req.body?.country ?? "—").trim().slice(0, 80) || "—";
    const boosts = Math.max(0, Math.floor(Number(req.body?.boosts ?? 0)));

    if (!text) return res.status(400).json({ error: "empty" });
    if (text.length > 200) return res.status(400).json({ error: "too_long" });
    if (hasUrl(text)) return res.status(400).json({ error: "url_blocked" });

    await pruneExpired();

    const id = genId();
    const createdAt = now();
    const expiresAt = createdAt + ONE_DAY_MS;

    const { rows } = await pool.query(
      `INSERT INTO posts (id, text, country, boosts, created_at, expires_at)
       VALUES ($1,$2,$3,$4,$5,$6)
       RETURNING id, text, country, boosts,
                 created_at AS "createdAt",
                 expires_at AS "expiresAt"`,
      [id, text, country, boosts, createdAt, expiresAt]
    );

    res.status(201).json({ ok: true, post: rows[0] });
  } catch (e) {
    res.status(500).json({ error: "db_error" });
  }
});

app.post("/api/posts/:id/boost", async (req, res) => {
  try {
    const id = String(req.params.id || "");
    const add = Math.max(0, Math.floor(Number(req.body?.add ?? 1)));

    await pruneExpired();

    const { rows } = await pool.query(
      `UPDATE posts
          SET boosts = GREATEST(0, boosts + $2)
        WHERE id = $1
      RETURNING id, text, country, boosts,
                created_at AS "createdAt",
                expires_at AS "expiresAt"`,
      [id, add]
    );

    if (!rows.length) return res.status(404).json({ error: "not_found" });
    res.json({ ok: true, post: rows[0] });
  } catch (e) {
    res.status(500).json({ error: "db_error" });
  }
});

const PORT = process.env.PORT || 3000;

initDb()
  .then(() => {
    app.listen(PORT, () => console.log(`API listening on ${PORT}`));
  })
  .catch((e) => {
    console.error("DB init failed", e);
    process.exit(1);
  });