export interface RpcProbeConfig {
  name: string;
  // Minimal args to call via service_role. null = skip with reason
  args: Record<string, unknown> | null;
  skipReason?: string;
}

export interface EdgeFnProbeConfig {
  name: string;
  // Expected HTTP status for anon caller (empty body)
  expectedAnonStatus: number;
  // Expected HTTP status for service_role caller (empty body)
  // 400 = fn received request, rejected due to missing/invalid body = fn is ALIVE
  // 5xx = server error = fn is BROKEN
  expectedServiceStatus: number;
  body: Record<string, unknown>;
}

// Static RPCs that can be called without runtime data
const STATIC_RPC_PROBES: RpcProbeConfig[] = [
  {
    name: "schedule_day_bounds",
    args: {
      p_working_hours: { mon: ["09:00", "18:00"] },
      p_date: "2026-06-01",
      p_timezone: "Europe/Istanbul",
    },
  },
];

// RPCs that require runtime data (shopId/staffId) — filled in probe.ts at runtime
const RUNTIME_RPC_PROBES: RpcProbeConfig[] = [
  { name: "get_occupied_ranges", args: null, skipReason: "requires staff_id + date — filled at runtime" },
  { name: "get_shop_occupied_ranges", args: null, skipReason: "requires shop_id + date — filled at runtime" },
  { name: "get_staff_day_hours", args: null, skipReason: "requires staff_id + date — filled at runtime" },
  { name: "get_shop_dashboard_stats", args: null, skipReason: "requires shop_id — filled at runtime" },
  { name: "get_commission_report", args: null, skipReason: "requires shop_id — filled at runtime" },
  { name: "get_staff_commission_configs", args: null, skipReason: "requires shop_id — filled at runtime" },
  { name: "staff_is_inside_work_window", args: null, skipReason: "requires staff_id + timestamps — filled at runtime" },
  { name: "schedule_has_conflict", args: null, skipReason: "requires staff_id + timestamps — filled at runtime" },
];

// Mutating RPCs — tested in trigger probe (Task 10) to avoid side effects here
const MUTATION_RPC_PROBES: RpcProbeConfig[] = [
  { name: "create_appointment_atomic", args: null, skipReason: "mutating — tested in trigger probe" },
  { name: "update_appointment_atomic", args: null, skipReason: "mutating — tested in trigger probe" },
  { name: "cancel_appointment_atomic", args: null, skipReason: "mutating — tested in trigger probe" },
  { name: "complete_appointment_with_revenue", args: null, skipReason: "mutating — tested in trigger probe" },
  { name: "create_block_atomic", args: null, skipReason: "mutating — tested in trigger probe" },
  { name: "update_staff_commission_config", args: null, skipReason: "mutating — tested in trigger probe" },
];

export const RPC_PROBES: RpcProbeConfig[] = [
  ...STATIC_RPC_PROBES,
  ...RUNTIME_RPC_PROBES,
  ...MUTATION_RPC_PROBES,
];

export const EDGE_FN_PROBES: EdgeFnProbeConfig[] = [
  // Auth-required fns: anon → 401, service_role with empty body → 400 (fn alive, bad input)
  { name: "app-book-appointment",   expectedAnonStatus: 401, expectedServiceStatus: 400, body: {} },
  { name: "app-cancel-appointment", expectedAnonStatus: 401, expectedServiceStatus: 400, body: {} },
  { name: "block-walkin",           expectedAnonStatus: 401, expectedServiceStatus: 400, body: {} },
  { name: "create-manual-block",    expectedAnonStatus: 401, expectedServiceStatus: 400, body: {} },
  { name: "create-widget-token",    expectedAnonStatus: 401, expectedServiceStatus: 400, body: {} },
  { name: "delete-account",         expectedAnonStatus: 401, expectedServiceStatus: 400, body: {} },
  { name: "invite-barber",          expectedAnonStatus: 401, expectedServiceStatus: 400, body: {} },
  // Widget fns: may accept anon with shop_slug — empty body → 400 (fn alive)
  { name: "widget-book-appointment",  expectedAnonStatus: 400, expectedServiceStatus: 400, body: {} },
  { name: "widget-get-availability",  expectedAnonStatus: 400, expectedServiceStatus: 400, body: {} },
];
