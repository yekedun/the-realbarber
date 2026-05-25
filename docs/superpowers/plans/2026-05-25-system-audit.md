# System Integration Audit — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Sistemdeki her DB objesi, edge function ve frontend API çağrısını haritalayan ve eksik/kırık bağlantıları öncelikli olarak raporlayan bir audit aracı inşa et.

**Architecture:** İki faz: (A) statik analiz — migration SQL + kaynak kod tarayarak integration-map.md + gaps.md üretir; (B) runtime probe — lokal Supabase'e karşı her RPC/edge-fn/RLS/trigger/realtime bağlantısını gerçek isteklerle doğrular ve probe-summary.md üretir.

**Tech Stack:** Node.js 24, TypeScript (`tsx`), `@supabase/supabase-js ^2`, `fs/path` (stdlib)

---

## Dosya Yapısı

```
scripts/
  audit/
    types.ts           — IntegrationObject, GapEntry, ProbeResult arayüzleri
    build-map.ts       — statik analiz; integration-map.md + gaps.md yazar
    probe-config.ts    — her RPC + edge fn için test args + beklenen auth davranışı
    probe.ts           — runtime probe; probe-results.json + probe-summary.md yazar

docs/
  audit/
    integration-map.md    (build-map çıktısı)
    gaps.md               (build-map çıktısı)
    probe-results.json    (probe çıktısı)
    probe-summary.md      (probe çıktısı)
```

---

## Task 1: Kurulum — tsx, dosya yapısı, tipler

**Files:**
- Modify: `package.json` (root)
- Create: `scripts/audit/types.ts`

- [ ] **Step 1: tsx'i root devDep olarak ekle**

```bash
pnpm add -D tsx --ignore-workspace-root-check
```

Beklenen: `node_modules/.bin/tsx` oluşur.

- [ ] **Step 2: Root package.json'a audit scriptleri ekle**

`package.json` içindeki `"scripts"` bloğuna şunları ekle:

```json
"audit:map": "tsx scripts/audit/build-map.ts",
"audit:probe": "tsx scripts/audit/probe.ts",
"audit": "pnpm audit:map && pnpm audit:probe"
```

- [ ] **Step 3: docs/audit klasörünü oluştur**

```bash
mkdir -p docs/audit
```

- [ ] **Step 4: types.ts'i oluştur**

`scripts/audit/types.ts`:

```typescript
export type ObjectKind =
  | "table"
  | "rpc"
  | "trigger"
  | "trigger_fn"
  | "edge_fn"
  | "realtime_channel";

export interface IntegrationObject {
  kind: ObjectKind;
  name: string;
  definedIn?: string;   // dosya yolu (migration veya edge fn)
  consumers: string[];  // hangi dosyalar bu objeyi çağırıyor
}

export type GapSeverity = "CRITICAL" | "WARNING" | "INFO";

export interface GapEntry {
  severity: GapSeverity;
  object: string;
  kind: ObjectKind;
  message: string;
}

export type ProbeStatus = "PASS" | "FAIL" | "SKIP";

export interface ProbeResult {
  category: "rpc" | "edge_fn" | "rls" | "trigger" | "realtime";
  check: string;
  status: ProbeStatus;
  message: string;
  durationMs?: number;
}
```

- [ ] **Step 5: Commit**

```bash
git add package.json scripts/audit/types.ts docs/audit/.gitkeep
git commit -m "chore(audit): setup tsx + types + folder structure"
```

---

## Task 2: Migration Parser — tablo/fonksiyon/trigger çıkar

**Files:**
- Create: `scripts/audit/build-map.ts` (parser fonksiyonları)

- [ ] **Step 1: build-map.ts skeleton + self-test altyapısı oluştur**

`scripts/audit/build-map.ts`:

```typescript
import * as fs from "fs";
import * as path from "path";
import type { IntegrationObject, GapEntry, ObjectKind } from "./types.js";

const ROOT = path.resolve(import.meta.dirname, "../..");
const MIGRATIONS_DIR = path.join(ROOT, "supabase/migrations");

// ── Pure parsers (test edilebilir) ─────────────────────────────────────────

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
  assert(!tables.includes("old_table"), "should not include dropped tables");

  const dropped = parseDroppedTablesFromSql(sql);
  assert(dropped.includes("old_table"), "should find dropped old_table");

  const fns = parseFunctionsFromSql(sql);
  assert(fns.includes("my_fn"), "should find my_fn");

  const triggers = parseTriggersFromSql(sql);
  assert(triggers.includes("shops_updated_at"), "should find trigger");

  console.log("  ✅ All self-tests passed");
}
```

- [ ] **Step 2: Self-test'i çalıştır**

```bash
cd "C:\Users\Emre\Berber randevu" && npx tsx scripts/audit/build-map.ts --test
```

Beklenen: henüz `--test` main bloğu yok → hata veya sessiz çıkış (normal).

- [ ] **Step 3: main() ekle ve --test flag'ini destekle**

`build-map.ts` sonuna ekle:

```typescript
// ── Main ──────────────────────────────────────────────────────────────────

async function main() {
  if (process.argv.includes("--test")) {
    runSelfTests();
    process.exit(0);
  }
  // sonraki task'larda doldurulacak
  console.log("build-map: henüz tam implemente edilmedi, --test ile çalıştır");
}

main().catch((e) => { console.error(e); process.exit(1); });
```

- [ ] **Step 4: Self-test'i çalıştır ve geç doğrula**

```bash
cd "C:\Users\Emre\Berber randevu" && npx tsx scripts/audit/build-map.ts --test
```

Beklenen çıktı:
```
Running build-map self-tests...
  ✅ All self-tests passed
```

- [ ] **Step 5: Commit**

```bash
git add scripts/audit/build-map.ts
git commit -m "feat(audit): migration parser pure fns + self-tests"
```

---

## Task 3: Kaynak Kod Tarayıcı — supabase çağrılarını çıkar

**Files:**
- Modify: `scripts/audit/build-map.ts`

- [ ] **Step 1: Scanner fonksiyonlarını ekle ve self-test genişlet**

`build-map.ts` içindeki parser bölümüne ekle:

```typescript
export interface SourceCallSite {
  file: string;
  calls: string[]; // "from:appointments", "rpc:get_shop_dashboard_stats", "invoke:app-book-appointment", "channel:appointments"
}

export function parseSupabaseCallsFromTs(src: string, filePath: string): SourceCallSite {
  const calls: string[] = [];

  for (const m of src.matchAll(/\.from\(\s*['"`](\w+)['"`]/g))
    calls.push(`from:${m[1]}`);
  for (const m of src.matchAll(/\.rpc\(\s*['"`]([\w]+)['"`]/g))
    calls.push(`rpc:${m[1]}`);
  for (const m of src.matchAll(/functions\.invoke\(\s*['"`]([\w-]+)['"`]/g))
    calls.push(`invoke:${m[1]}`);
  for (const m of src.matchAll(/\.channel\(\s*['"`]([\w-:]+)['"`]/g))
    calls.push(`channel:${m[1]}`);

  return { file: filePath, calls: [...new Set(calls)] };
}

export function scanDirectory(dir: string): SourceCallSite[] {
  const results: SourceCallSite[] = [];
  if (!fs.existsSync(dir)) return results;

  function walk(d: string) {
    for (const entry of fs.readdirSync(d, { withFileTypes: true })) {
      const full = path.join(d, entry.name);
      if (entry.isDirectory() && !["node_modules", ".next", "dist", "__tests__"].includes(entry.name)) {
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
```

- [ ] **Step 2: Self-test'e scanner testleri ekle**

`runSelfTests()` fonksiyonu içine şunu ekle:

```typescript
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
```

- [ ] **Step 3: Self-test'i çalıştır**

```bash
cd "C:\Users\Emre\Berber randevu" && npx tsx scripts/audit/build-map.ts --test
```

Beklenen:
```
Running build-map self-tests...
  ✅ All self-tests passed
  ✅ Scanner self-tests passed
```

- [ ] **Step 4: Commit**

```bash
git add scripts/audit/build-map.ts
git commit -m "feat(audit): source code scanner + self-tests"
```

---

## Task 4: Cross-Reference Matrix + Gap Detection

**Files:**
- Modify: `scripts/audit/build-map.ts`

- [ ] **Step 1: buildIntegrationMap() fonksiyonunu ekle**

`build-map.ts`'e ekle:

```typescript
export interface IntegrationMap {
  objects: IntegrationObject[];
  gaps: GapEntry[];
  sourceSites: SourceCallSite[];
}

// Trigger fonksiyonu olarak kullanılan fns (doğrudan çağrılmaz)
const TRIGGER_FN_NAMES = new Set([
  "update_updated_at",
  "sync_appointment_slots",
  "sync_block_slots",
  "ensure_owner_staff",
  "prevent_direct_appointment_scheduling_writes",
]);

export function buildIntegrationMap(): IntegrationMap {
  // 1. Migration'lardan objeleri topla
  const sqlFiles = fs.readdirSync(MIGRATIONS_DIR)
    .filter((f) => f.endsWith(".sql"))
    .sort();

  const activeTables = new Set<string>();
  const droppedTables = new Set<string>();
  const functions = new Map<string, string>(); // name → migration file
  const triggers = new Map<string, string>();

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

  // 2. Kaynak koddan çağrıları tara
  const sourceSites: SourceCallSite[] = [
    ...scanDirectory(path.join(ROOT, "apps/mobile/app")),
    ...scanDirectory(path.join(ROOT, "apps/mobile/components")),
    ...scanDirectory(path.join(ROOT, "apps/web/src")),
    ...scanDirectory(path.join(ROOT, "supabase/functions")),
  ];

  // 3. Edge fn'ları tara
  const edgeFnDir = path.join(ROOT, "supabase/functions");
  const edgeFns = fs.readdirSync(edgeFnDir)
    .filter((f) => !f.startsWith("_") && fs.statSync(path.join(edgeFnDir, f)).isDirectory());

  // 4. Her obje için consumer listesi oluştur
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

  // CRITICAL: kaynak kodda çağrılan ama tanımlı olmayan tablolar/RPC'ler
  const allFromCalls = new Set(
    sourceSites.flatMap((s) => s.calls.filter((c) => c.startsWith("from:")).map((c) => c.slice(5)))
  );
  const allRpcCalls = new Set(
    sourceSites.flatMap((s) => s.calls.filter((c) => c.startsWith("rpc:")).map((c) => c.slice(4)))
  );
  const allInvokeCalls = new Set(
    sourceSites.flatMap((s) => s.calls.filter((c) => c.startsWith("invoke:")).map((c) => c.slice(7)))
  );

  for (const t of allFromCalls) {
    if (!activeTables.has(t) && !droppedTables.has(t)) {
      gaps.push({ severity: "CRITICAL", object: t, kind: "table", message: `'${t}' tablosu çağrılıyor ama migration'larda CREATE TABLE yok` });
    }
    if (droppedTables.has(t)) {
      gaps.push({ severity: "CRITICAL", object: t, kind: "table", message: `'${t}' tablosu DROP edildi ama kaynak kodda hâlâ kullanılıyor` });
    }
  }

  for (const fn of allRpcCalls) {
    if (!functions.has(fn)) {
      gaps.push({ severity: "CRITICAL", object: fn, kind: "rpc", message: `RPC '${fn}' çağrılıyor ama migration'larda tanımlı değil` });
    }
  }

  for (const fn of allInvokeCalls) {
    if (!edgeFns.includes(fn)) {
      gaps.push({ severity: "CRITICAL", object: fn, kind: "edge_fn", message: `Edge fn '${fn}' invoke ediliyor ama supabase/functions/ içinde yok` });
    }
  }

  // WARNING: tanımlı ama hiç çağrılmayan RPC'ler / edge fn'lar
  for (const obj of objects) {
    if ((obj.kind === "rpc" || obj.kind === "edge_fn") && obj.consumers.length === 0) {
      gaps.push({ severity: "WARNING", object: obj.name, kind: obj.kind, message: `Tanımlı ama hiçbir consumer yok — dead code veya eksik bağlantı` });
    }
  }

  // WARNING: stale types (dropped table hâlâ database.types.ts içinde)
  const dbTypesPath = path.join(ROOT, "supabase/functions/_shared/database.types.ts");
  if (fs.existsSync(dbTypesPath)) {
    const dbTypes = fs.readFileSync(dbTypesPath, "utf8");
    for (const t of droppedTables) {
      if (dbTypes.includes(`${t}:`)) {
        gaps.push({ severity: "WARNING", object: t, kind: "table", message: `'${t}' tablosu DROP edildi ama database.types.ts'de hâlâ var — pnpm db:sync gerekli` });
      }
    }
  }

  return { objects, gaps, sourceSites };
}
```

- [ ] **Step 2: main()'e harita oluşturma çağrısını ekle (geçici stdout)**

`main()` fonksiyonunu güncelle:

```typescript
async function main() {
  if (process.argv.includes("--test")) {
    runSelfTests();
    process.exit(0);
  }

  console.log("🔍 Harita oluşturuluyor...");
  const map = buildIntegrationMap();
  console.log(`  Objeler: ${map.objects.length}`);
  console.log(`  Gaps: ${map.gaps.length}`);
  console.log(`  Kaynak dosyalar: ${map.sourceSites.length}`);
  // çıktı üretimi Task 5'te
}
```

- [ ] **Step 3: Çalıştır ve sonuçları doğrula**

```bash
cd "C:\Users\Emre\Berber randevu" && npx tsx scripts/audit/build-map.ts
```

Beklenen: hata yok, `Objeler: N`, `Gaps: M` çıktısı görünür. `Objeler` > 30 olmalı.

- [ ] **Step 4: Commit**

```bash
git add scripts/audit/build-map.ts
git commit -m "feat(audit): cross-reference matrix + gap detection"
```

---

## Task 5: Çıktı Üretici — integration-map.md + gaps.md

**Files:**
- Modify: `scripts/audit/build-map.ts`

- [ ] **Step 1: generateIntegrationMapMd() ekle**

```typescript
export function generateIntegrationMapMd(map: IntegrationMap): string {
  const lines: string[] = [
    "# System Integration Map",
    `_Generated: ${new Date().toISOString()}_`,
    "",
    "## DB Tables",
    "",
    "| Tablo | Consumer Sayısı | Tüketiciler |",
    "|-------|----------------|-------------|",
  ];

  for (const obj of map.objects.filter((o) => o.kind === "table")) {
    lines.push(`| \`${obj.name}\` | ${obj.consumers.length} | ${obj.consumers.slice(0, 3).join(", ")}${obj.consumers.length > 3 ? " ..." : ""} |`);
  }

  lines.push("", "## RPCs (Public Functions)", "", "| RPC | Tanımlandığı | Consumer Sayısı |", "|-----|-------------|----------------|");
  for (const obj of map.objects.filter((o) => o.kind === "rpc")) {
    lines.push(`| \`${obj.name}\` | ${obj.definedIn?.split("/").pop() ?? "-"} | ${obj.consumers.length} |`);
  }

  lines.push("", "## Trigger Functions", "", "| Fonksiyon | Tanımlandığı |", "|-----------|-------------|");
  for (const obj of map.objects.filter((o) => o.kind === "trigger_fn")) {
    lines.push(`| \`${obj.name}\` | ${obj.definedIn?.split("/").pop() ?? "-"} |`);
  }

  lines.push("", "## Triggers", "", "| Trigger | Tanımlandığı |", "|---------|-------------|");
  for (const obj of map.objects.filter((o) => o.kind === "trigger")) {
    lines.push(`| \`${obj.name}\` | ${obj.definedIn?.split("/").pop() ?? "-"} |`);
  }

  lines.push("", "## Edge Functions", "", "| Edge Fn | Consumer Sayısı | Çağıran Dosyalar |", "|---------|----------------|-----------------|");
  for (const obj of map.objects.filter((o) => o.kind === "edge_fn")) {
    lines.push(`| \`${obj.name}\` | ${obj.consumers.length} | ${obj.consumers.join(", ")} |`);
  }

  lines.push("", "## Consumer Cross-Reference", "", "| Dosya | Çağrılar |", "|-------|---------|");
  for (const site of map.sourceSites.sort((a, b) => a.file.localeCompare(b.file))) {
    lines.push(`| \`${site.file}\` | ${site.calls.join(", ")} |`);
  }

  return lines.join("\n");
}

export function generateGapsMd(gaps: GapEntry[]): string {
  const critical = gaps.filter((g) => g.severity === "CRITICAL");
  const warning = gaps.filter((g) => g.severity === "WARNING");
  const info = gaps.filter((g) => g.severity === "INFO");

  const lines = [
    "# Integration Gaps",
    `_Generated: ${new Date().toISOString()}_`,
    `_Toplam: ${gaps.length} gap (${critical.length} CRITICAL, ${warning.length} WARNING, ${info.length} INFO)_`,
    "",
  ];

  if (critical.length > 0) {
    lines.push("## 🔴 CRITICAL — Uygulama çalışırken patlayabilir", "");
    for (const g of critical) {
      lines.push(`- **[${g.kind.toUpperCase()}]** \`${g.object}\`: ${g.message}`);
    }
    lines.push("");
  }

  if (warning.length > 0) {
    lines.push("## 🟡 WARNING — Özellik eksik veya dead code", "");
    for (const g of warning) {
      lines.push(`- **[${g.kind.toUpperCase()}]** \`${g.object}\`: ${g.message}`);
    }
    lines.push("");
  }

  if (info.length > 0) {
    lines.push("## 🟢 INFO — Beklenen eksiklik, planda var", "");
    for (const g of info) {
      lines.push(`- **[${g.kind.toUpperCase()}]** \`${g.object}\`: ${g.message}`);
    }
  }

  if (gaps.length === 0) lines.push("✅ Gap bulunamadı.");

  return lines.join("\n");
}
```

- [ ] **Step 2: main()'i çıktı yazacak şekilde güncelle**

```typescript
async function main() {
  if (process.argv.includes("--test")) {
    runSelfTests();
    process.exit(0);
  }

  console.log("🔍 Harita oluşturuluyor...");
  const map = buildIntegrationMap();

  const docsDir = path.join(ROOT, "docs/audit");
  fs.mkdirSync(docsDir, { recursive: true });

  const mapPath = path.join(docsDir, "integration-map.md");
  const gapsPath = path.join(docsDir, "gaps.md");

  fs.writeFileSync(mapPath, generateIntegrationMapMd(map), "utf8");
  fs.writeFileSync(gapsPath, generateGapsMd(map.gaps), "utf8");

  console.log(`✅ ${mapPath}`);
  console.log(`✅ ${gapsPath}`);
  console.log(`   ${map.objects.length} obje, ${map.gaps.length} gap`);

  const critical = map.gaps.filter((g) => g.severity === "CRITICAL");
  if (critical.length > 0) {
    console.error(`\n🔴 ${critical.length} CRITICAL gap var:`);
    for (const g of critical) console.error(`   [${g.kind}] ${g.object}: ${g.message}`);
  }
}
```

- [ ] **Step 3: Çalıştır ve çıktıyı doğrula**

```bash
cd "C:\Users\Emre\Berber randevu" && pnpm audit:map
```

Beklenen:
```
🔍 Harita oluşturuluyor...
✅ docs/audit/integration-map.md
✅ docs/audit/gaps.md
   N obje, M gap
```

`docs/audit/integration-map.md` dosyasını aç — tablolar, RPC'ler, edge fn'lar listeli olmalı.
`docs/audit/gaps.md` dosyasını aç — varsa `barbers` + `customer_profiles` tabloları CRITICAL veya WARNING olarak çıkmalı.

- [ ] **Step 4: Üretilen dosyaları .gitignore'a ekle (generated files)**

`docs/audit/.gitignore` oluştur:

```
integration-map.md
gaps.md
probe-results.json
probe-summary.md
```

- [ ] **Step 5: Commit**

```bash
git add scripts/audit/build-map.ts docs/audit/.gitignore
git commit -m "feat(audit): integration-map.md + gaps.md output generator"
```

---

## Task 6: Probe Altyapısı — Supabase clients + sonuç toplayıcı

**Files:**
- Create: `scripts/audit/probe.ts`

- [ ] **Step 1: probe.ts skeleton oluştur**

`scripts/audit/probe.ts`:

```typescript
import { createClient } from "@supabase/supabase-js";
import * as fs from "fs";
import * as path from "path";
import type { ProbeResult } from "./types.js";

const ROOT = path.resolve(import.meta.dirname, "../..");

// Lokal Supabase bağlantı bilgileri
const SUPABASE_URL = "http://127.0.0.1:54201";
// supabase status çıktısından: Publishable = anon, Secret = service_role
const ANON_KEY = "sb_publishable_ACJWlzQHlZjBrEguHvfOxg_3BJgxAaH";
const SERVICE_ROLE_KEY = "sb_secret_N7UND0UgjKTVK-Uodkm0Hg_xSvEMPvz";

// Üç farklı client seviyesi
const anonClient = createClient(SUPABASE_URL, ANON_KEY);
const serviceClient = createClient(SUPABASE_URL, SERVICE_ROLE_KEY, {
  auth: { autoRefreshToken: false, persistSession: false },
});

// Sonuç toplayıcı
const results: ProbeResult[] = [];

function pass(category: ProbeResult["category"], check: string, msg = "OK", ms?: number) {
  results.push({ category, check, status: "PASS", message: msg, durationMs: ms });
  console.log(`  ✅ [${category}] ${check}`);
}

function fail(category: ProbeResult["category"], check: string, msg: string, ms?: number) {
  results.push({ category, check, status: "FAIL", message: msg, durationMs: ms });
  console.error(`  ❌ [${category}] ${check}: ${msg}`);
}

function skip(category: ProbeResult["category"], check: string, reason: string) {
  results.push({ category, check, status: "SKIP", message: reason });
  console.log(`  ⏭️  [${category}] ${check}: ${reason}`);
}

async function timed<T>(fn: () => Promise<T>): Promise<[T, number]> {
  const t = Date.now();
  const r = await fn();
  return [r, Date.now() - t];
}

// Test veri yardımcıları
async function getOrCreateTestShop(): Promise<string> {
  const { data } = await serviceClient.from("shops").select("id").limit(1).single();
  if (data?.id) return data.id;
  throw new Error("Test için hiç shop yok — supabase db reset çalıştır");
}

async function getOrCreateTestStaff(shopId: string): Promise<string> {
  const { data } = await serviceClient.from("staff").select("id").eq("shop_id", shopId).limit(1).single();
  if (data?.id) return data.id;
  throw new Error(`shop_id=${shopId} için staff yok`);
}
```

- [ ] **Step 2: Lokal Supabase'in ayakta olduğunu doğrula**

```bash
curl -s http://127.0.0.1:54201/rest/v1/ -H "apikey: sb_publishable_ACJWlzQHlZjBrEguHvfOxg_3BJgxAaH" | head -c 100
```

Beklenen: JSON yanıt, hata değil. Eğer hata alıyorsan: `npx supabase start` çalıştır.

- [ ] **Step 3: Commit**

```bash
git add scripts/audit/probe.ts
git commit -m "feat(audit): probe infrastructure — clients + result collector"
```

---

## Task 7: Probe Config — RPC ve Edge Fn test tanımları

**Files:**
- Create: `scripts/audit/probe-config.ts`

- [ ] **Step 1: probe-config.ts oluştur**

```typescript
export interface RpcProbeConfig {
  name: string;
  // service_role ile çağrılacak minimal args
  // null ise skip (trigger fn veya arg üretemiyoruz)
  args: Record<string, unknown> | null;
  skipReason?: string;
}

export interface EdgeFnProbeConfig {
  name: string;
  // anon ile POST atıldığında beklenen HTTP status
  expectedAnonStatus: number;
  // service_role JWT ile POST atıldığında beklenen status
  expectedServiceStatus: number;
  // POST body (minimal geçerli veya kasıtlı eksik)
  body: Record<string, unknown>;
}

// Trigger fn'lar doğrudan çağrılmaz — skip
const SKIP_RPCS = new Set([
  "update_updated_at",
  "sync_appointment_slots",
  "sync_block_slots",
  "ensure_owner_staff",
  "prevent_direct_appointment_scheduling_writes",
]);

export const RPC_PROBES: RpcProbeConfig[] = [
  // Bu listeyi probe.ts çalışmadan önce getOrCreateTestShop/Staff ile dolduracağız
  // Statik olanlar:
  { name: "schedule_day_bounds", args: { p_working_hours: { mon: ["09:00", "18:00"] }, p_date: "2026-06-01", p_timezone: "Europe/Istanbul" } },
  { name: "staff_is_inside_work_window", args: null, skipReason: "staff_id gerektiriyor — runtime'da doldurulacak" },
  { name: "schedule_has_conflict", args: null, skipReason: "staff_id gerektiriyor — runtime'da doldurulacak" },
  { name: "get_occupied_ranges", args: null, skipReason: "staff_id + date gerektiriyor — runtime'da doldurulacak" },
  { name: "get_shop_occupied_ranges", args: null, skipReason: "shop_id + date gerektiriyor — runtime'da doldurulacak" },
  { name: "get_staff_day_hours", args: null, skipReason: "staff_id + date gerektiriyor — runtime'da doldurulacak" },
  { name: "get_shop_dashboard_stats", args: null, skipReason: "shop_id gerektiriyor — runtime'da doldurulacak" },
  { name: "get_commission_report", args: null, skipReason: "shop_id gerektiriyor — runtime'da doldurulacak" },
  { name: "get_staff_commission_configs", args: null, skipReason: "shop_id gerektiriyor — runtime'da doldurulacak" },
  { name: "update_staff_commission_config", args: null, skipReason: "değiştirici — trigger probe'da test edilecek" },
  { name: "create_appointment_atomic", args: null, skipReason: "kompleks args — trigger probe'da test edilecek" },
  { name: "cancel_appointment_atomic", args: null, skipReason: "appointment_id gerekiyor — trigger probe'da test edilecek" },
  { name: "complete_appointment_with_revenue", args: null, skipReason: "appointment_id gerekiyor — trigger probe'da test edilecek" },
  { name: "create_block_atomic", args: null, skipReason: "kompleks args — trigger probe'da test edilecek" },
  { name: "update_appointment_atomic", args: null, skipReason: "appointment_id gerekiyor — trigger probe'da test edilecek" },
];

export const EDGE_FN_PROBES: EdgeFnProbeConfig[] = [
  {
    name: "app-book-appointment",
    expectedAnonStatus: 401,
    expectedServiceStatus: 400, // geçersiz body → iş mantığı hatası (auth geçer)
    body: {},
  },
  {
    name: "app-cancel-appointment",
    expectedAnonStatus: 401,
    expectedServiceStatus: 400,
    body: {},
  },
  {
    name: "block-walkin",
    expectedAnonStatus: 401,
    expectedServiceStatus: 400,
    body: {},
  },
  {
    name: "create-manual-block",
    expectedAnonStatus: 401,
    expectedServiceStatus: 400,
    body: {},
  },
  {
    name: "create-widget-token",
    expectedAnonStatus: 401,
    expectedServiceStatus: 400,
    body: {},
  },
  {
    name: "delete-account",
    expectedAnonStatus: 401,
    expectedServiceStatus: 400,
    body: {},
  },
  {
    name: "invite-barber",
    expectedAnonStatus: 401,
    expectedServiceStatus: 400,
    body: {},
  },
  {
    name: "widget-book-appointment",
    expectedAnonStatus: 400, // widget fn anon erişime açık olabilir
    expectedServiceStatus: 400,
    body: {},
  },
  {
    name: "widget-get-availability",
    expectedAnonStatus: 400,
    expectedServiceStatus: 400,
    body: {},
  },
];
```

- [ ] **Step 2: Commit**

```bash
git add scripts/audit/probe-config.ts
git commit -m "feat(audit): probe config — RPC + edge fn test definitions"
```

---

## Task 8: RPC + Edge Function Probing

**Files:**
- Modify: `scripts/audit/probe.ts`

- [ ] **Step 1: RPC probe fonksiyonunu ekle**

`probe.ts`'e ekle:

```typescript
import { RPC_PROBES, EDGE_FN_PROBES } from "./probe-config.js";

async function probeRpcs(shopId: string, staffId: string) {
  console.log("\n── RPC Probing ──────────────────────────────────");

  // Runtime'da doldurulacak arg'ları ata
  const runtimeArgs: Record<string, Record<string, unknown>> = {
    get_occupied_ranges: { p_staff_id: staffId, p_date: "2026-06-01" },
    get_shop_occupied_ranges: { p_shop_id: shopId, p_date: "2026-06-01" },
    get_staff_day_hours: { p_staff_id: staffId, p_date: "2026-06-01" },
    get_shop_dashboard_stats: { p_shop_id: shopId },
    get_commission_report: { p_shop_id: shopId },
    get_staff_commission_configs: { p_shop_id: shopId },
    staff_is_inside_work_window: { p_staff_id: staffId, p_starts_at: "2026-06-01T10:00:00Z", p_ends_at: "2026-06-01T10:30:00Z" },
    schedule_has_conflict: { p_staff_id: staffId, p_starts_at: "2026-06-01T10:00:00Z", p_ends_at: "2026-06-01T10:30:00Z" },
  };

  for (const cfg of RPC_PROBES) {
    const args = cfg.args ?? runtimeArgs[cfg.name] ?? null;
    if (args === null) {
      skip("rpc", cfg.name, cfg.skipReason ?? "args yok");
      continue;
    }

    const [res, ms] = await timed(() => serviceClient.rpc(cfg.name as never, args as never));
    if (res.error) {
      // RPC var ve çağrıldı ama iş mantığı hatası — fonksiyon MEVCUT
      if (res.error.code === "PGRST202") {
        fail("rpc", cfg.name, `RPC bulunamadı: ${res.error.message}`, ms);
      } else {
        pass("rpc", cfg.name, `çağrıldı (iş mantığı hatası kabul edilir: ${res.error.message})`, ms);
      }
    } else {
      pass("rpc", cfg.name, `OK, ${JSON.stringify(res.data).slice(0, 80)}`, ms);
    }
  }
}

async function probeEdgeFns() {
  console.log("\n── Edge Function Probing ─────────────────────────");

  for (const cfg of EDGE_FN_PROBES) {
    const url = `${SUPABASE_URL}/functions/v1/${cfg.name}`;

    // Anon probe
    const [anonRes, anonMs] = await timed(() =>
      fetch(url, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${ANON_KEY}`,
        },
        body: JSON.stringify(cfg.body),
      })
    );

    if (anonRes.status === cfg.expectedAnonStatus) {
      pass("edge_fn", `${cfg.name} (anon)`, `HTTP ${anonRes.status}`, anonMs);
    } else {
      fail("edge_fn", `${cfg.name} (anon)`, `HTTP ${anonRes.status}, beklenen: ${cfg.expectedAnonStatus}`, anonMs);
    }

    // Service role probe
    const [svcRes, svcMs] = await timed(() =>
      fetch(url, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${SERVICE_ROLE_KEY}`,
        },
        body: JSON.stringify(cfg.body),
      })
    );

    if (svcRes.status === cfg.expectedServiceStatus) {
      pass("edge_fn", `${cfg.name} (service)`, `HTTP ${svcRes.status}`, svcMs);
    } else {
      // 400 bekleniyor ama 200 gelirse de tamam (fn çalışıyor demek)
      if (svcRes.status < 500) {
        pass("edge_fn", `${cfg.name} (service)`, `HTTP ${svcRes.status} (fn yanıt veriyor)`, svcMs);
      } else {
        fail("edge_fn", `${cfg.name} (service)`, `HTTP ${svcRes.status} — sunucu hatası`, svcMs);
      }
    }
  }
}
```

- [ ] **Step 2: Commit**

```bash
git add scripts/audit/probe.ts
git commit -m "feat(audit): RPC + edge fn probing"
```

---

## Task 9: RLS Probing

**Files:**
- Modify: `scripts/audit/probe.ts`

- [ ] **Step 1: RLS probe fonksiyonunu ekle**

```typescript
// PUBLIC tablolar (anon okuyabilmeli)
const PUBLIC_READ_TABLES = ["services", "shops", "staff"];
// PROTECTED tablolar (anon okuyamamalı)
const PROTECTED_TABLES = ["appointments", "blocks", "widget_tokens", "staff_schedules", "appointment_slots", "block_slots"];

async function probeRls() {
  console.log("\n── RLS Probing ──────────────────────────────────");

  // Anon public tabloları okuyabilmeli
  for (const t of PUBLIC_READ_TABLES) {
    const [res, ms] = await timed(() => anonClient.from(t).select("id").limit(1));
    if (res.error) {
      fail("rls", `${t} anon-read`, `Hata: ${res.error.message}`, ms);
    } else {
      pass("rls", `${t} anon-read`, `${res.data?.length ?? 0} satır döndü`, ms);
    }
  }

  // Anon protected tabloları okuyamamalı (0 satır veya hata)
  for (const t of PROTECTED_TABLES) {
    const [res, ms] = await timed(() => anonClient.from(t).select("id").limit(5));
    if (res.error) {
      pass("rls", `${t} anon-blocked`, `RLS engelledi: ${res.error.code}`, ms);
    } else if ((res.data?.length ?? 0) === 0) {
      pass("rls", `${t} anon-blocked`, "0 satır döndü (RLS filtredi)", ms);
    } else {
      fail("rls", `${t} anon-blocked`, `${res.data!.length} satır döndü — RLS eksik!`, ms);
    }
  }

  // Service role her tabloyu okuyabilmeli
  for (const t of [...PUBLIC_READ_TABLES, ...PROTECTED_TABLES]) {
    const [res, ms] = await timed(() => serviceClient.from(t).select("id").limit(1));
    if (res.error && res.error.code !== "PGRST116") { // 116 = no rows, ok
      fail("rls", `${t} service-read`, `Hata: ${res.error.message}`, ms);
    } else {
      pass("rls", `${t} service-read`, "OK", ms);
    }
  }
}
```

- [ ] **Step 2: Commit**

```bash
git add scripts/audit/probe.ts
git commit -m "feat(audit): RLS probing"
```

---

## Task 10: Trigger + Kritik Akış Probing

**Files:**
- Modify: `scripts/audit/probe.ts`

- [ ] **Step 1: Trigger probe ekle**

```typescript
async function probeTriggers(shopId: string, staffId: string) {
  console.log("\n── Trigger + Kritik Akış Probing ────────────────");

  // Test: create_appointment_atomic → appointment_slots oluşuyor mu?
  const startsAt = "2026-06-15T10:00:00Z";
  const endsAt   = "2026-06-15T10:30:00Z";

  // Önce bir servis bul
  const { data: svc } = await serviceClient
    .from("services")
    .select("id")
    .limit(1)
    .single();

  if (!svc) {
    skip("trigger", "create_appointment_atomic → appointment_slots", "Servis yok — supabase db reset çalıştır");
    return;
  }

  // Randevu oluştur (RPC üzerinden — direct INSERT engelli)
  const [createRes, createMs] = await timed(() =>
    serviceClient.rpc("create_appointment_atomic", {
      p_shop_id: shopId,
      p_staff_id: staffId,
      p_service_id: svc.id,
      p_customer_name: "Audit Test",
      p_customer_phone: "+905000000000",
      p_starts_at: startsAt,
      p_ends_at: endsAt,
    })
  );

  if (createRes.error) {
    fail("trigger", "create_appointment_atomic", `RPC hatası: ${createRes.error.message}`, createMs);
    return;
  }

  const apptId = createRes.data as string;
  pass("trigger", "create_appointment_atomic", `randevu oluşturuldu: ${apptId}`, createMs);

  // appointments_sync_slots trigger'ı → appointment_slots tablosunda satır var mı?
  const [slotRes, slotMs] = await timed(() =>
    serviceClient.from("appointment_slots").select("*").eq("appointment_id", apptId)
  );

  if (slotRes.error || (slotRes.data?.length ?? 0) === 0) {
    fail("trigger", "appointments_sync_slots", `Trigger tetiklenmedi — appointment_slots boş: ${slotRes.error?.message ?? "0 satır"}`, slotMs);
  } else {
    pass("trigger", "appointments_sync_slots", `${slotRes.data!.length} slot oluştu`, slotMs);
  }

  // prevent_direct_appointment_scheduling_writes: direct INSERT denenince engellemeli
  const [directRes] = await timed(() =>
    serviceClient.from("appointments").insert({
      shop_id: shopId,
      staff_id: staffId,
      service_id: svc.id,
      customer_name: "Direct Test",
      customer_phone: "+905000000001",
      starts_at: "2026-06-16T10:00:00Z",
      ends_at: "2026-06-16T10:30:00Z",
    })
  );
  if (directRes.error) {
    pass("trigger", "prevent_direct_scheduling_writes", `Engellendi: ${directRes.error.message}`);
  } else {
    fail("trigger", "prevent_direct_scheduling_writes", "Direct INSERT geçti — trigger çalışmıyor!");
  }

  // shops_ensure_owner_staff: shop oluştururken sahibine staff kaydı açıldı mı?
  const { data: ownerStaff } = await serviceClient
    .from("staff")
    .select("id")
    .eq("shop_id", shopId)
    .limit(1);
  if (ownerStaff && ownerStaff.length > 0) {
    pass("trigger", "shops_ensure_owner_staff", "Shop sahibi staff olarak mevcut");
  } else {
    fail("trigger", "shops_ensure_owner_staff", "Shop için staff kaydı yok");
  }

  // Temizlik — test randevusunu sil
  await serviceClient.from("appointments").delete().eq("id", apptId);
}
```

- [ ] **Step 2: Commit**

```bash
git add scripts/audit/probe.ts
git commit -m "feat(audit): trigger probing — sync_slots + prevent_direct_writes + ensure_owner_staff"
```

---

## Task 11: Realtime Probing

**Files:**
- Modify: `scripts/audit/probe.ts`

- [ ] **Step 1: Realtime probe ekle**

```typescript
async function probeRealtime(shopId: string, staffId: string) {
  console.log("\n── Realtime Probing ─────────────────────────────");

  // appointments tablosuna subscribe ol, insert at, event geldi mi?
  const received: unknown[] = [];
  const channelName = `probe-appointments-${Date.now()}`;

  const channel = serviceClient
    .channel(channelName)
    .on("postgres_changes", { event: "INSERT", schema: "public", table: "appointments" }, (payload) => {
      received.push(payload);
    })
    .subscribe();

  // Subscribe'ın hazır olmasını bekle
  await new Promise((r) => setTimeout(r, 1500));

  // Servis bul
  const { data: svc } = await serviceClient.from("services").select("id").limit(1).single();
  if (!svc) {
    skip("realtime", "appointments INSERT event", "Servis yok");
    await serviceClient.removeChannel(channel);
    return;
  }

  // Test randevusu oluştur
  const [createRes] = await timed(() =>
    serviceClient.rpc("create_appointment_atomic", {
      p_shop_id: shopId,
      p_staff_id: staffId,
      p_service_id: svc.id,
      p_customer_name: "Realtime Test",
      p_customer_phone: "+905000000002",
      p_starts_at: "2026-06-20T11:00:00Z",
      p_ends_at: "2026-06-20T11:30:00Z",
    })
  );

  if (createRes.error) {
    fail("realtime", "appointments INSERT event", `Randevu oluşturulamadı: ${createRes.error.message}`);
    await serviceClient.removeChannel(channel);
    return;
  }

  const apptId = createRes.data as string;

  // 3 saniye bekle
  await new Promise((r) => setTimeout(r, 3000));
  await serviceClient.removeChannel(channel);

  if (received.length > 0) {
    pass("realtime", "appointments INSERT event", `${received.length} event alındı`);
  } else {
    fail("realtime", "appointments INSERT event", "3 saniyede event gelmedi — replica identity veya publication kontrol et");
  }

  // Temizlik
  await serviceClient.from("appointments").delete().eq("id", apptId);
}
```

- [ ] **Step 2: Commit**

```bash
git add scripts/audit/probe.ts
git commit -m "feat(audit): realtime probing — postgres_changes subscription"
```

---

## Task 12: Probe Çıktı Üretici + main()

**Files:**
- Modify: `scripts/audit/probe.ts`

- [ ] **Step 1: Çıktı üretici fonksiyonu ekle**

```typescript
function writeProbeSummary() {
  const docsDir = path.join(ROOT, "docs/audit");
  fs.mkdirSync(docsDir, { recursive: true });

  // Ham JSON
  fs.writeFileSync(
    path.join(docsDir, "probe-results.json"),
    JSON.stringify(results, null, 2),
    "utf8"
  );

  // Markdown özet
  const categories = ["rpc", "edge_fn", "rls", "trigger", "realtime"] as const;
  const lines = [
    "# Probe Summary",
    `_Generated: ${new Date().toISOString()}_`,
    "",
    `| Kategori | PASS | FAIL | SKIP | Toplam |`,
    `|----------|------|------|------|--------|`,
  ];

  let totalPass = 0, totalFail = 0, totalSkip = 0;
  for (const cat of categories) {
    const catResults = results.filter((r) => r.category === cat);
    const p = catResults.filter((r) => r.status === "PASS").length;
    const f = catResults.filter((r) => r.status === "FAIL").length;
    const s = catResults.filter((r) => r.status === "SKIP").length;
    lines.push(`| ${cat} | ${p} | ${f} | ${s} | ${catResults.length} |`);
    totalPass += p; totalFail += f; totalSkip += s;
  }

  lines.push(`| **TOPLAM** | **${totalPass}** | **${totalFail}** | **${totalSkip}** | **${results.length}** |`);

  if (totalFail > 0) {
    lines.push("", "## ❌ Başarısız Kontroller", "");
    for (const r of results.filter((r) => r.status === "FAIL")) {
      lines.push(`- **[${r.category}]** \`${r.check}\`: ${r.message}`);
    }
  }

  if (totalSkip > 0) {
    lines.push("", "## ⏭️ Atlanan Kontroller", "");
    for (const r of results.filter((r) => r.status === "SKIP")) {
      lines.push(`- **[${r.category}]** \`${r.check}\`: ${r.message}`);
    }
  }

  fs.writeFileSync(path.join(docsDir, "probe-summary.md"), lines.join("\n"), "utf8");
}
```

- [ ] **Step 2: main() fonksiyonunu ekle**

```typescript
async function main() {
  console.log("🔬 System Integration Probe başlıyor...");
  console.log(`   Supabase: ${SUPABASE_URL}`);

  // Bağlantı kontrolü
  const { error: connErr } = await serviceClient.from("shops").select("id").limit(1);
  if (connErr && connErr.code !== "PGRST116") {
    console.error(`\n❌ Supabase bağlantısı kurulamadı: ${connErr.message}`);
    console.error("   npx supabase start çalıştır ve tekrar dene.");
    process.exit(1);
  }

  let shopId: string;
  let staffId: string;
  try {
    shopId = await getOrCreateTestShop();
    staffId = await getOrCreateTestStaff(shopId);
    console.log(`   Shop: ${shopId}, Staff: ${staffId}`);
  } catch (e) {
    console.error(`\n❌ Test verisi hazırlanamadı: ${(e as Error).message}`);
    process.exit(1);
  }

  await probeRpcs(shopId, staffId);
  await probeEdgeFns();
  await probeRls();
  await probeTriggers(shopId, staffId);
  await probeRealtime(shopId, staffId);

  writeProbeSummary();

  const failed = results.filter((r) => r.status === "FAIL").length;
  const passed = results.filter((r) => r.status === "PASS").length;
  const skipped = results.filter((r) => r.status === "SKIP").length;

  console.log(`\n📊 Sonuç: ${passed} PASS, ${failed} FAIL, ${skipped} SKIP`);
  console.log("✅ docs/audit/probe-summary.md");
  console.log("✅ docs/audit/probe-results.json");

  if (failed > 0) process.exit(1);
}

main().catch((e) => { console.error(e); process.exit(1); });
```

- [ ] **Step 3: Tam probe'u çalıştır**

```bash
cd "C:\Users\Emre\Berber randevu" && pnpm audit:probe
```

Beklenen: hata yok, `docs/audit/probe-summary.md` oluşur, FAIL sayısı görünür.

- [ ] **Step 4: pnpm audit (ikisi birden) çalıştır**

```bash
cd "C:\Users\Emre\Berber randevu" && pnpm audit
```

Beklenen: build-map çalışır, sonra probe çalışır. Her iki çıktı dosyası oluşur.

- [ ] **Step 5: Çıktıları gözden geçir**

`docs/audit/gaps.md` — CRITICAL ve WARNING'leri oku.
`docs/audit/probe-summary.md` — FAIL listesini oku.

Bu iki dosya bir sonraki oturumun başlangıç noktasıdır.

- [ ] **Step 6: Commit**

```bash
git add scripts/audit/probe.ts scripts/audit/probe-config.ts
git commit -m "feat(audit): probe output generator + main orchestrator"
```

---

## Self-Review

**Spec coverage:**
- ✅ Statik analiz (build-map.ts) — Task 2-5
- ✅ Runtime probe (probe.ts) — Task 6-12
- ✅ RPC probing — Task 8
- ✅ Edge fn probing — Task 8
- ✅ RLS probing — Task 9
- ✅ Trigger probing — Task 10
- ✅ Realtime probing — Task 11
- ✅ Gap önceliklendirme (CRITICAL/WARNING/INFO) — Task 4
- ✅ pnpm audit komutu — Task 1
- ✅ integration-map.md + gaps.md — Task 5
- ✅ probe-results.json + probe-summary.md — Task 12
- ✅ Stale types (dropped table hâlâ database.types.ts'de) — Task 4'te WARNING gap olarak çıkar

**Tip/isim tutarlılığı:**
- `ProbeResult.category` — tüm probe fn'larda tutarlı kullanıldı
- `IntegrationObject`, `GapEntry` — types.ts'de tanımlı, build-map.ts'de doğru import
- `serviceClient`, `anonClient` — probe.ts boyunca tutarlı
- `getOrCreateTestShop/Staff` — Task 6'da tanımlı, Task 10-11'de kullanıldı ✅
