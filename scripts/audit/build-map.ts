import * as fs from "fs";
import * as path from "path";
import type { IntegrationObject, GapEntry, ObjectKind } from "./types.js";

function fileURLToPath(url: string): string {
  return decodeURIComponent(url.replace(/^file:\/\/\//, '').replace(/\//g, path.sep));
}
const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "../..");
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

// ── Source code scanner ───────────────────────────────────────────────────

export interface SourceCallSite {
  file: string;
  calls: string[]; // "from:tableName", "rpc:rpcName", "invoke:fnName", "channel:channelName"
}

export function parseSupabaseCallsFromTs(src: string, filePath: string): SourceCallSite {
  const calls: string[] = [];

  for (const m of src.matchAll(/\.from\(\s*['"`](\w+)['"`]/g))
    calls.push(`from:${m[1]}`);
  for (const m of src.matchAll(/\.rpc\(\s*['"`]([\w]+)['"`]/g))
    calls.push(`rpc:${m[1]}`);
  for (const m of src.matchAll(/functions\.invoke\(\s*['"`]([\w-]+)['"`]/g))
    calls.push(`invoke:${m[1]}`);
  for (const m of src.matchAll(/\.channel\(\s*['"`]([\w\-:]+)['"`]/g))
    calls.push(`channel:${m[1]}`);

  return { file: filePath, calls: [...new Set(calls)] };
}

export function scanDirectory(dir: string): SourceCallSite[] {
  const results: SourceCallSite[] = [];
  if (!fs.existsSync(dir)) return results;

  function walk(d: string) {
    for (const entry of fs.readdirSync(d, { withFileTypes: true })) {
      const full = path.join(d, entry.name);
      if (
        entry.isDirectory() &&
        !["node_modules", ".next", "dist", "__tests__", ".expo"].includes(entry.name)
      ) {
        walk(full);
      } else if (entry.isFile() && /\.(tsx?|jsx?)$/.test(entry.name)) {
        const src = fs.readFileSync(full, "utf8");
        const site = parseSupabaseCallsFromTs(src, full.replace(ROOT + path.sep, ""));
        if (site.calls.length > 0) results.push(site);
      }
    }
  }

  walk(dir);
  return results;
}

// ── Integration map ───────────────────────────────────────────────────────

export interface IntegrationMap {
  objects: IntegrationObject[];
  gaps: GapEntry[];
  sourceSites: SourceCallSite[];
}

const TRIGGER_FN_NAMES = new Set([
  "update_updated_at",
  "sync_appointment_slots",
  "sync_block_slots",
  "ensure_owner_staff",
  "prevent_direct_appointment_scheduling_writes",
]);

export function buildIntegrationMap(): IntegrationMap {
  // 1. Collect objects from migrations
  const sqlFiles = fs.readdirSync(MIGRATIONS_DIR)
    .filter((f) => f.endsWith(".sql"))
    .sort();

  const activeTables = new Set<string>();
  const droppedTables = new Set<string>();
  const functions = new Map<string, string>(); // name → migration filename
  const triggers = new Map<string, string>(); // name → migration filename

  for (const f of sqlFiles) {
    const sql = fs.readFileSync(path.join(MIGRATIONS_DIR, f), "utf8");
    for (const t of parseTablesFromSql(sql)) activeTables.add(t);
    for (const t of parseDroppedTablesFromSql(sql)) {
      activeTables.delete(t);
      droppedTables.add(t);
    }
    for (const fn of parseFunctionsFromSql(sql)) functions.set(fn, f);
    for (const tr of parseTriggersFromSql(sql)) triggers.set(tr, f);
  }

  // 2. Scan source code for Supabase calls
  const sourceSites: SourceCallSite[] = [
    ...scanDirectory(path.join(ROOT, "apps/mobile/app")),
    ...scanDirectory(path.join(ROOT, "apps/mobile/components")),
    ...scanDirectory(path.join(ROOT, "apps/web/src")),
    ...scanDirectory(path.join(ROOT, "supabase/functions")),
  ];

  // 3. Edge functions
  const edgeFnDir = path.join(ROOT, "supabase/functions");
  const edgeFns = fs.readdirSync(edgeFnDir)
    .filter((f) => !f.startsWith("_") && fs.statSync(path.join(edgeFnDir, f)).isDirectory());

  // 4. Build consumer map
  function consumersOf(callPattern: string): string[] {
    return sourceSites
      .filter((s) => s.calls.includes(callPattern))
      .map((s) => s.file);
  }

  const objects: IntegrationObject[] = [];

  for (const t of activeTables) {
    objects.push({
      kind: "table",
      name: t,
      consumers: consumersOf(`from:${t}`),
    });
  }

  for (const [fn, file] of functions) {
    const kind: ObjectKind = TRIGGER_FN_NAMES.has(fn) ? "trigger_fn" : "rpc";
    objects.push({
      kind,
      name: fn,
      definedIn: `supabase/migrations/${file}`,
      consumers: consumersOf(`rpc:${fn}`),
    });
  }

  for (const [tr, file] of triggers) {
    objects.push({
      kind: "trigger",
      name: tr,
      definedIn: `supabase/migrations/${file}`,
      consumers: [],
    });
  }

  for (const fn of edgeFns) {
    objects.push({
      kind: "edge_fn",
      name: fn,
      definedIn: `supabase/functions/${fn}/index.ts`,
      consumers: consumersOf(`invoke:${fn}`),
    });
  }

  // 5. Gap detection
  const gaps: GapEntry[] = [];

  const allFromCalls = new Set(
    sourceSites.flatMap((s) =>
      s.calls.filter((c) => c.startsWith("from:")).map((c) => c.slice(5))
    )
  );
  const allRpcCalls = new Set(
    sourceSites.flatMap((s) =>
      s.calls.filter((c) => c.startsWith("rpc:")).map((c) => c.slice(4))
    )
  );
  const allInvokeCalls = new Set(
    sourceSites.flatMap((s) =>
      s.calls.filter((c) => c.startsWith("invoke:")).map((c) => c.slice(7))
    )
  );

  // CRITICAL: called but not defined
  for (const t of allFromCalls) {
    if (!activeTables.has(t) && !droppedTables.has(t)) {
      gaps.push({
        severity: "CRITICAL",
        object: t,
        kind: "table",
        message: `Table '${t}' is called but not found in migrations`,
      });
    }
    if (droppedTables.has(t)) {
      gaps.push({
        severity: "CRITICAL",
        object: t,
        kind: "table",
        message: `Table '${t}' was DROPped but is still referenced in source code`,
      });
    }
  }

  for (const fn of allRpcCalls) {
    if (!functions.has(fn)) {
      gaps.push({
        severity: "CRITICAL",
        object: fn,
        kind: "rpc",
        message: `RPC '${fn}' is called but not defined in migrations`,
      });
    }
  }

  for (const fn of allInvokeCalls) {
    if (!edgeFns.includes(fn)) {
      gaps.push({
        severity: "CRITICAL",
        object: fn,
        kind: "edge_fn",
        message: `Edge fn '${fn}' is invoked but not found in supabase/functions/`,
      });
    }
  }

  // WARNING: defined but no consumer
  for (const obj of objects) {
    if ((obj.kind === "rpc" || obj.kind === "edge_fn") && obj.consumers.length === 0) {
      gaps.push({
        severity: "WARNING",
        object: obj.name,
        kind: obj.kind,
        message: `Defined but no consumer found — dead code or missing wiring`,
      });
    }
  }

  // WARNING: stale database.types.ts (dropped tables still present)
  const dbTypesPath = path.join(ROOT, "supabase/functions/_shared/database.types.ts");
  if (fs.existsSync(dbTypesPath)) {
    const dbTypes = fs.readFileSync(dbTypesPath, "utf8");
    for (const t of droppedTables) {
      if (new RegExp(`\\b${t}:\\s*\\{`).test(dbTypes)) {
        gaps.push({
          severity: "WARNING",
          object: t,
          kind: "table",
          message: `Table '${t}' was DROPped but still present in database.types.ts — run pnpm db:sync`,
        });
      }
    }
  }

  return { objects, gaps, sourceSites };
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

  // scanner tests
  const tsSrc = `
    supabase.from('appointments').select()
    supabase.rpc('get_shop_dashboard_stats', {})
    supabase.functions.invoke('app-book-appointment', {})
    supabase.channel('appointments:abc')
  `;
  const site = parseSupabaseCallsFromTs(tsSrc, "fake/file.tsx");
  assert(site.calls.includes("from:appointments"), "should find from:appointments");
  assert(site.calls.includes("rpc:get_shop_dashboard_stats"), "should find rpc");
  assert(site.calls.includes("invoke:app-book-appointment"), "should find invoke");
  assert(site.calls.includes("channel:appointments:abc"), "should find channel");
  console.log("  ✅ Scanner self-tests passed");

  console.log("  ✅ All self-tests passed");
}

// ── Main ──────────────────────────────────────────────────────────────────

async function main() {
  if (process.argv.includes("--test")) {
    runSelfTests();
    process.exit(0);
  }

  console.log("🔍 Building integration map...");
  const map = buildIntegrationMap();
  console.log(`  Objects: ${map.objects.length}`);
  console.log(`  Gaps: ${map.gaps.length}`);
  console.log(`  Source files: ${map.sourceSites.length}`);

  const critical = map.gaps.filter((g) => g.severity === "CRITICAL");
  const warnings = map.gaps.filter((g) => g.severity === "WARNING");
  if (critical.length > 0) {
    console.error(`\n🔴 CRITICAL (${critical.length}):`);
    for (const g of critical) console.error(`   [${g.kind}] ${g.object}: ${g.message}`);
  }
  if (warnings.length > 0) {
    console.log(`\n🟡 WARNING (${warnings.length}):`);
    for (const g of warnings) console.log(`   [${g.kind}] ${g.object}: ${g.message}`);
  }
  // output files written in Task 5
}

main().catch((e) => { console.error(e); process.exit(1); });
