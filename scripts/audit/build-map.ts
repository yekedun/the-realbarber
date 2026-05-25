import * as fs from "fs";
import * as path from "path";
import type { IntegrationObject, GapEntry, ObjectKind } from "./types.js";

function fileURLToPath(url: string): string {
  return url.replace(/^file:\/\/\//, '').replace(/\//g, path.sep);
}
const ROOT = path.resolve(fileURLToPath(import.meta.url), "../..");
const MIGRATIONS_DIR = path.join(ROOT, "supabase/migrations");

// ── Pure parsers (testable) ────────────────────────────────────────────────

export function parseTablesFromSql(sql: string): string[] {
  const names: string[] = [];
  for (const m of sql.matchAll(
    /CREATE\s+TABLE\s+(?:IF\s+NOT\s+EXISTS\s+)?(?:public\.)?(\w+)/gi
  )) {
    names.push(m[1].toLowerCase());
  }
  return names;
}

export function parseDroppedTablesFromSql(sql: string): string[] {
  const names: string[] = [];
  for (const m of sql.matchAll(
    /DROP\s+TABLE\s+(?:IF\s+EXISTS\s+)?(?:public\.)?(\w+)/gi
  )) {
    names.push(m[1].toLowerCase());
  }
  return names;
}

export function parseFunctionsFromSql(sql: string): string[] {
  const names: string[] = [];
  for (const m of sql.matchAll(
    /CREATE\s+(?:OR\s+REPLACE\s+)?FUNCTION\s+(?:public\.)?(\w+)\s*\(/gi
  )) {
    names.push(m[1].toLowerCase());
  }
  return names;
}

export function parseTriggersFromSql(sql: string): string[] {
  const names: string[] = [];
  for (const m of sql.matchAll(/CREATE\s+TRIGGER\s+(\w+)/gi)) {
    names.push(m[1].toLowerCase());
  }
  return names;
}

// ── Self-test ──────────────────────────────────────────────────────────────

function assert(cond: boolean, msg: string) {
  if (!cond) throw new Error(`ASSERTION FAILED: ${msg}`);
}

function runSelfTests() {
  console.log("Running build-map self-tests...");

  const sql = `
    CREATE TABLE public.shops (id uuid);
    CREATE TABLE IF NOT EXISTS public.staff (id uuid);
    DROP TABLE IF EXISTS public.old_table;
    CREATE OR REPLACE FUNCTION public.my_fn(p_id uuid) RETURNS void AS $$ $$ language sql;
    CREATE TRIGGER shops_updated_at BEFORE UPDATE ON shops FOR EACH ROW EXECUTE FUNCTION update_updated_at();
  `;

  const tables = parseTablesFromSql(sql);
  assert(tables.includes("shops"), "should find shops");
  assert(tables.includes("staff"), "should find staff");
  assert(!tables.includes("old_table"), "should not include dropped tables in parseTablesFromSql");

  const dropped = parseDroppedTablesFromSql(sql);
  assert(dropped.includes("old_table"), "should find dropped old_table");

  const fns = parseFunctionsFromSql(sql);
  assert(fns.includes("my_fn"), "should find my_fn");

  const triggers = parseTriggersFromSql(sql);
  assert(triggers.includes("shops_updated_at"), "should find trigger");

  console.log("  ✅ All self-tests passed");
}

// ── Main ──────────────────────────────────────────────────────────────────

async function main() {
  if (process.argv.includes("--test")) {
    runSelfTests();
    process.exit(0);
  }
  console.log("build-map: run with --test to validate parsers, full implementation coming soon");
}

main().catch((e) => { console.error(e); process.exit(1); });
