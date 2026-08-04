#!/usr/bin/env node
/** Apply RLS fix via Supabase Management API is not available — runs SQL using pg if DATABASE_URL set, else prints SQL. */
import { readFileSync, existsSync } from "fs";
import { resolve, dirname } from "path";
import { fileURLToPath } from "url";

const root = resolve(dirname(fileURLToPath(import.meta.url)), "..");
const sqlPath = resolve(root, "supabase/migrations/20260805130000_fix_profiles_rls.sql");
const sql = readFileSync(sqlPath, "utf8");

function loadEnvFile(path) {
  if (!existsSync(path)) return;
  for (const line of readFileSync(path, "utf8").split("\n")) {
    const t = line.trim();
    if (!t || t.startsWith("#")) continue;
    const i = t.indexOf("=");
    if (i === -1) continue;
    const key = t.slice(0, i).trim();
    let val = t.slice(i + 1).trim();
    if ((val.startsWith('"') && val.endsWith('"')) || (val.startsWith("'") && val.endsWith("'"))) {
      val = val.slice(1, -1);
    }
    if (!process.env[key]) process.env[key] = val;
  }
}

loadEnvFile(resolve(root, ".env.local"));

const dbUrl = process.env.DATABASE_URL || process.env.SUPABASE_DB_URL;

if (!dbUrl) {
  console.log("No DATABASE_URL in .env.local — paste this in Supabase SQL Editor:\n");
  console.log(sql);
  process.exit(0);
}

const pg = await import("pg");
const client = new pg.default.Client({ connectionString: dbUrl });
await client.connect();
await client.query(sql);
await client.end();
console.log("Applied fix_profiles_rls migration.");
