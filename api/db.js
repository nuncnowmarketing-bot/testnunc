import sqlite3 from "sqlite3";
import { open } from "sqlite";
import fs from "fs";
import path from "path";
import { fileURLToPath } from "url";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const DB_PATH = path.join(__dirname, "nunc.sqlite");
const SCHEMA_PATH = path.join(__dirname, "schema.sql");

let db;

export async function getDb() {
  if (db) return db;

  db = await open({
    filename: DB_PATH,
    driver: sqlite3.Database
  });

  const schema = fs.readFileSync(SCHEMA_PATH, "utf8");
  await db.exec(schema);

  return db;
}
