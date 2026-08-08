#!/usr/bin/env node
import { createClient } from "@supabase/supabase-js";
import { readFileSync, existsSync } from "fs";
import { resolve, dirname } from "path";
import { fileURLToPath } from "url";

const root = resolve(dirname(fileURLToPath(import.meta.url)), "..");

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

const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
const anon = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;

const coach = createClient(url, anon);

const email = "coach@test.playbookschool.dev";
const password = "TestCoach123!";

const { data: signIn, error } = await coach.auth.signInWithPassword({ email, password });
console.log("signIn error:", error?.message ?? "none");
console.log("user_metadata:", signIn.user?.user_metadata);

const { data: sync, error: syncErr } = await coach.rpc("sync_profile_from_auth");
console.log("sync_profile:", sync?.role, syncErr?.message ?? "");

const { data: getMy, error: getErr } = await coach.rpc("get_my_profile");
console.log("get_my_profile:", getMy?.role, getErr?.message ?? "");

const { data: row, error: rowErr } = await coach.from("profiles").select("role").eq("id", signIn.user.id).maybeSingle();
console.log("direct profiles:", row?.role, rowErr?.message ?? "");

function homeForUser(profile, user) {
  const isCoach = profile?.role === "coach" || user?.user_metadata?.role === "coach";
  return isCoach ? "/coach/playbook" : "/player/today";
}

console.log("would redirect to:", homeForUser(sync ?? getMy ?? row, signIn.user));
