import { useEffect, useState, useCallback, useRef } from "react";
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  RefreshControl,
  ActivityIndicator,
  Pressable,
  FlatList,
} from "react-native";
import { Feather } from "@expo/vector-icons";
import { startOfDay, addDays } from "date-fns";
import { supabase } from "../../lib/supabase";
import { useUserRole } from "../../lib/user-context";
import { T, R, Shadow } from "../../lib/theme";

const TZ = "Europe/Istanbul";

// ── Types ────────────────────────────────────────────────────────────────────

interface StaffItem {
  id: string;
  name: string;
  is_active: boolean;
}

interface AppointmentRow {
  id: string;
  staff_id: string;
  status: string;
}

interface DayStats {
  total: number;
  completed: number;
  cancelled: number;
  staffStats: { id: string; name: string; count: number }[];
}

// ── Helpers ──────────────────────────────────────────────────────────────────

function fmtDate(d: Date): string {
  return d.toLocaleDateString("tr-TR", {
    weekday: "long",
    day: "numeric",
    month: "long",
    timeZone: TZ,
  });
}

function initials(s: string): string {
  return s
    .split(/\s+/)
    .filter(Boolean)
    .slice(0, 2)
    .map((x) => x[0]!.toUpperCase())
    .join("");
}

function computeStats(
  appts: AppointmentRow[],
  staff: StaffItem[],
  selectedId: string | null
): DayStats {
  const filtered =
    selectedId ? appts.filter((a) => a.staff_id === selectedId) : appts;

  const staffStats = staff.map((b) => ({
    id: b.id,
    name: b.name,
    count: filtered.filter(
      (a) => a.staff_id === b.id && a.status !== "cancelled"
    ).length,
  }));

  return {
    total: filtered.filter((a) => a.status !== "cancelled").length,
    completed: filtered.filter((a) => a.status === "completed").length,
    cancelled: filtered.filter((a) => a.status === "cancelled").length,
    staffStats: selectedId
      ? staffStats.filter((s) => s.id === selectedId)
      : staffStats,
  };
}

// ── Staff Picker ─────────────────────────────────────────────────────────────

interface StaffPickerProps {
  staff: StaffItem[];
  selectedId: string | null; // null = Tüm Ekip
  onSelect: (id: string | null) => void;
}

function StaffPicker({ staff, selectedId, onSelect }: StaffPickerProps) {
  const ALL = null;
  const items = [{ id: ALL, name: "Tüm Ekip" } as { id: string | null; name: string }, ...staff];

  return (
    <View style={pk.wrap}>
      <FlatList
        data={items}
        horizontal
        showsHorizontalScrollIndicator={false}
        keyExtractor={(item) => item.id ?? "__all__"}
        contentContainerStyle={pk.list}
        renderItem={({ item }) => {
          const active = item.id === selectedId;
          return (
            <Pressable
              onPress={() => onSelect(item.id)}
              style={({ pressed }) => [
                pk.chip,
                active && pk.chipActive,
                pressed && { opacity: 0.75 },
              ]}
            >
              {item.id === null ? (
                <Feather
                  name="users"
                  size={11}
                  color={active ? "#fff" : T.navy}
                  style={{ marginRight: 4 }}
                />
              ) : (
                <View style={[pk.dot, active && pk.dotActive]}>
                  <Text style={[pk.dotTxt, active && pk.dotTxtActive]}>
                    {initials(item.name)}
                  </Text>
                </View>
              )}
              <Text style={[pk.label, active && pk.labelActive]}>
                {item.name}
              </Text>
            </Pressable>
          );
        }}
      />
    </View>
  );
}

const pk = StyleSheet.create({
  wrap: {
    marginBottom: 20,
    marginHorizontal: -20, // bleed to screen edges
  },
  list: { paddingHorizontal: 20, gap: 8 },
  chip: {
    flexDirection: "row",
    alignItems: "center",
    paddingVertical: 7,
    paddingHorizontal: 12,
    borderRadius: R.pill,
    borderWidth: 1.5,
    borderColor: T.line,
    backgroundColor: T.surface,
    ...Shadow.card,
  },
  chipActive: {
    backgroundColor: T.navy,
    borderColor: T.navy,
  },
  dot: {
    width: 18,
    height: 18,
    borderRadius: 9,
    backgroundColor: T.avatarFrom,
    alignItems: "center",
    justifyContent: "center",
    marginRight: 5,
  },
  dotActive: { backgroundColor: "rgba(255,255,255,0.25)" },
  dotTxt: { fontSize: 8, fontWeight: "800", color: T.navy },
  dotTxtActive: { color: "#fff" },
  label: { fontSize: 12, fontWeight: "600", color: T.ink },
  labelActive: { color: "#fff" },
});

// ── Dashboard ─────────────────────────────────────────────────────────────────

export default function OwnerDashboard() {
  const { shopId } = useUserRole();

  // raw data (fetched once per refresh)
  const allStaff = useRef<StaffItem[]>([]);
  const allAppts = useRef<AppointmentRow[]>([]);

  const [staff, setStaff] = useState<StaffItem[]>([]);
  const [stats, setStats] = useState<DayStats | null>(null);
  const [selectedStaffId, setSelectedStaffId] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);

  const today = startOfDay(new Date());

  // ── Fetch all data for the shop ──────────────────────────────────────────
  const load = useCallback(async () => {
    if (!shopId) return;
    const dayStart = today.toISOString();
    const dayEnd = addDays(today, 1).toISOString();

    // Dükkanın tüm aktif personeli
    const { data: staffData } = await supabase
      .from("staff")
      .select("id, name, is_active")
      .eq("shop_id", shopId)
      .eq("is_active", true)
      .order("created_at");

    if (!staffData) { setLoading(false); setRefreshing(false); return; }

    // Tüm aktif personelin bugünkü randevuları — shop_id bazlı (tek sorgu)
    const { data: apptData } = await supabase
      .from("appointments")
      .select("id, staff_id, status")
      .in("staff_id", staffData.map((s) => s.id))
      .gte("starts_at", dayStart)
      .lt("starts_at", dayEnd);

    allStaff.current = staffData;
    allAppts.current = apptData ?? [];

    setStaff(staffData);
    setStats(computeStats(allAppts.current, allStaff.current, selectedStaffId));
    setLoading(false);
    setRefreshing(false);
  }, [shopId]); // selectedStaffId intentionally NOT a dep — filter is client-side

  useEffect(() => { load(); }, [load]);

  // ── Client-side filter when picker changes ───────────────────────────────
  const handleSelectStaff = useCallback((id: string | null) => {
    setSelectedStaffId(id);
    setStats(computeStats(allAppts.current, allStaff.current, id));
  }, []);

  function onRefresh() { setRefreshing(true); load(); }

  // ── Render ───────────────────────────────────────────────────────────────
  const pickerLabel =
    selectedStaffId
      ? staff.find((s) => s.id === selectedStaffId)?.name ?? "Personel"
      : "Tüm Ekip";

  return (
    <View style={styles.root}>
      <ScrollView
        contentContainerStyle={styles.scroll}
        showsVerticalScrollIndicator={false}
        refreshControl={
          <RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor={T.navy} />
        }
      >
        <Text style={styles.eyebrow}>DÜKKAN ÖZET</Text>
        <Text style={styles.title}>Bugün</Text>
        <Text style={styles.subtitle}>{fmtDate(today)}</Text>

        {/* ── Staff Picker ── */}
        {!loading && staff.length > 0 && (
          <StaffPicker
            staff={staff}
            selectedId={selectedStaffId}
            onSelect={handleSelectStaff}
          />
        )}

        {loading ? (
          <ActivityIndicator color={T.navy} style={{ marginTop: 40 }} />
        ) : stats ? (
          <>
            {/* ── KPI Cards ── */}
            <View style={styles.kpiRow}>
              <KpiCard icon="calendar" label="Toplam Randevu" value={stats.total} color={T.navy} />
              <KpiCard icon="check-circle" label="Tamamlanan" value={stats.completed} color="#16a34a" />
              <KpiCard icon="x-circle" label="İptal" value={stats.cancelled} color={T.red} />
            </View>

            {/* ── Usta breakdown ── */}
            <Text style={styles.sectionLabel}>
              {selectedStaffId ? "PERSONEL DETAYI" : "USTA BAZINDA"}
            </Text>
            {stats.staffStats.length === 0 ? (
              <Text style={styles.emptyTxt}>Bu personele ait randevu yok.</Text>
            ) : (
              stats.staffStats.map((b) => (
                <Pressable
                  key={b.id}
                  onPress={() =>
                    handleSelectStaff(selectedStaffId === b.id ? null : b.id)
                  }
                  style={({ pressed }) => [
                    styles.barberRow,
                    selectedStaffId === b.id && styles.barberRowActive,
                    pressed && { opacity: 0.8 },
                  ]}
                >
                  <View
                    style={[
                      styles.barberDot,
                      selectedStaffId === b.id && { backgroundColor: "#fff" },
                    ]}
                  />
                  <Text
                    style={[
                      styles.barberName,
                      selectedStaffId === b.id && { color: "#fff" },
                    ]}
                  >
                    {b.name}
                  </Text>
                  <Text
                    style={[
                      styles.barberCount,
                      selectedStaffId === b.id && { color: "rgba(255,255,255,0.8)" },
                    ]}
                  >
                    {b.count} randevu
                  </Text>
                  <Feather
                    name={selectedStaffId === b.id ? "x" : "chevron-right"}
                    size={14}
                    color={selectedStaffId === b.id ? "#fff" : T.muted}
                  />
                </Pressable>
              ))
            )}
          </>
        ) : null}
      </ScrollView>
    </View>
  );
}

// ── KpiCard ──────────────────────────────────────────────────────────────────

function KpiCard({
  icon,
  label,
  value,
  color,
}: {
  icon: string;
  label: string;
  value: number;
  color: string;
}) {
  return (
    <View style={[styles.kpiCard, { borderTopColor: color, borderTopWidth: 3 }]}>
      <Feather name={icon as never} size={18} color={color} />
      <Text style={[styles.kpiValue, { color }]}>{value}</Text>
      <Text style={styles.kpiLabel}>{label}</Text>
    </View>
  );
}

// ── Styles ────────────────────────────────────────────────────────────────────

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: T.bg },
  scroll: { paddingTop: 64, paddingHorizontal: 20, paddingBottom: 40 },

  eyebrow: {
    fontSize: 11,
    fontWeight: "600",
    letterSpacing: 1.4,
    textTransform: "uppercase",
    color: T.red,
    marginBottom: 6,
  },
  title: { fontSize: 30, fontWeight: "700", letterSpacing: -0.5, color: T.ink },
  subtitle: { fontSize: 13, color: T.muted, marginTop: 4, marginBottom: 20 },

  kpiRow: { flexDirection: "row", gap: 10, marginBottom: 28 },
  kpiCard: {
    flex: 1,
    paddingVertical: 14,
    paddingHorizontal: 10,
    backgroundColor: T.surface,
    borderWidth: 1,
    borderColor: T.line,
    borderRadius: R.card,
    alignItems: "center",
    gap: 6,
    ...Shadow.card,
  },
  kpiValue: { fontSize: 26, fontWeight: "800" },
  kpiLabel: { fontSize: 10, color: T.muted, textAlign: "center", fontWeight: "500" },

  sectionLabel: {
    fontSize: 11,
    fontWeight: "600",
    color: T.muted,
    letterSpacing: 0.6,
    textTransform: "uppercase",
    marginBottom: 10,
  },
  barberRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 10,
    paddingVertical: 12,
    paddingHorizontal: 14,
    backgroundColor: T.surface,
    borderWidth: 1,
    borderColor: T.line,
    borderRadius: R.card,
    marginBottom: 8,
    ...Shadow.card,
  },
  barberRowActive: {
    backgroundColor: T.navy,
    borderColor: T.navy,
  },
  barberDot: { width: 8, height: 8, borderRadius: 4, backgroundColor: T.navy },
  barberName: { flex: 1, fontSize: 14, fontWeight: "600", color: T.ink },
  barberCount: { fontSize: 13, color: T.muted, fontWeight: "500" },

  emptyTxt: { fontSize: 13, color: T.mutedAlt, textAlign: "center", paddingVertical: 20 },
});
