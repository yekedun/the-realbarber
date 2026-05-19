import { useEffect, useState, useCallback, useRef, useMemo } from "react";
import { useRealtimeInvalidation } from "@berber/shared/use-realtime-invalidation";
import {
  View,
  StyleSheet,
  ScrollView,
  RefreshControl,
  ActivityIndicator,
  Pressable,
  Text,
} from "react-native";
import { Star, TrendingUp, ChevronRight } from "lucide-react-native";
import { startOfDay, addDays } from "date-fns";
import { supabase } from "../../lib/supabase";
import { useUserRole } from "../../lib/user-context";
import { T, R, S, Type, Shadow } from "../../lib/theme";
import {
  OverlineHeader,
  SectionLabel,
  Card,
  KpiCard,
  Chip,
  ChipRow,
} from "../../components/ds";

const TZ = "Europe/Istanbul";

interface StaffItem {
  id: string;
  name: string;
  is_active: boolean;
}

interface AppointmentRow {
  id: string;
  staff_id: string;
  status: string;
  starts_at: string;
  services: { price_cents: number | null } | null;
}

interface DayStats {
  total: number;
  completed: number;
  cancelled: number;
  revenue: number;
  staffStats: { id: string; name: string; count: number }[];
  topStaff: string | null;
  busiestDay: { date: string; count: number } | null;
}

function fmtDate(d: Date): string {
  return d.toLocaleDateString("tr-TR", {
    weekday: "long",
    day: "numeric",
    month: "long",
    timeZone: TZ,
  });
}

function computeStats(
  appts: AppointmentRow[],
  staff: StaffItem[],
  selectedId: string | null,
  todayStr: string
): DayStats {
  const filtered = selectedId ? appts.filter((a) => a.staff_id === selectedId) : appts;
  const validAppts = filtered.filter((a) => a.status !== "cancelled");
  const todayAppts = filtered.filter((a) => a.starts_at.startsWith(todayStr));
  const validToday = todayAppts.filter((a) => a.status !== "cancelled");
  const revenue = validToday.reduce((sum, a) => sum + (a.services?.price_cents ?? 0), 0) / 100;
  const staffStats = staff.map((b) => ({
    id: b.id,
    name: b.name,
    count: validAppts.filter((a) => a.staff_id === b.id).length,
  }));
  const sortedStaff = [...staffStats].sort((a, b) => b.count - a.count);
  const topStaff = sortedStaff.length > 0 && sortedStaff[0]!.count > 0 ? sortedStaff[0]!.name : null;
  const dayCounts = validAppts.reduce((acc, a) => {
    const day = a.starts_at.split("T")[0]!;
    acc[day] = (acc[day] || 0) + 1;
    return acc;
  }, {} as Record<string, number>);
  let busiestDay = null;
  let maxCount = 0;
  for (const [date, count] of Object.entries(dayCounts)) {
    if (count > maxCount) { maxCount = count; busiestDay = { date, count }; }
  }
  return {
    total: validToday.length,
    completed: todayAppts.filter((a) => a.status === "completed").length,
    cancelled: todayAppts.filter((a) => a.status === "cancelled").length,
    revenue,
    staffStats: selectedId ? staffStats.filter((s) => s.id === selectedId) : staffStats,
    topStaff,
    busiestDay,
  };
}

export default function OwnerDashboard() {
  const { shopId } = useUserRole();
  const allStaff = useRef<StaffItem[]>([]);
  const allAppts = useRef<AppointmentRow[]>([]);
  const [staff, setStaff] = useState<StaffItem[]>([]);
  const [stats, setStats] = useState<DayStats | null>(null);
  const [selectedStaffId, setSelectedStaffId] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const today = startOfDay(new Date());

  const load = useCallback(async () => {
    if (!shopId) return;
    const rangeStart = addDays(today, -30).toISOString();
    const rangeEnd = addDays(today, 30).toISOString();
    const { data: staffData } = await supabase
      .from("staff").select("id, name, is_active")
      .eq("shop_id", shopId).eq("is_active", true).order("created_at");
    if (!staffData) { setLoading(false); setRefreshing(false); return; }
    const { data: apptData } = await supabase
      .from("appointments")
      .select("id, staff_id, status, starts_at, services(price_cents)")
      .in("staff_id", staffData.map((s) => s.id))
      .gte("starts_at", rangeStart).lt("starts_at", rangeEnd);
    allStaff.current = staffData;
    allAppts.current = apptData ?? [];
    const todayStr = today.toISOString().split("T")[0]!;
    setStaff(staffData);
    setStats(computeStats(allAppts.current, allStaff.current, selectedStaffId, todayStr));
    setLoading(false);
    setRefreshing(false);
  }, [shopId]);

  useEffect(() => { load(); }, [load]);

  const kpiTableFilters = useMemo(() => [
    { table: "appointments" as const, filters: staff.map(s => `staff_id=eq.${s.id}`) },
  ], [staff]);

  useRealtimeInvalidation({
    client: supabase,
    channelName: `owner-kpi:${shopId}`,
    tableFilters: kpiTableFilters,
    invalidate: load,
    enabled: !!shopId && staff.length > 0,
  });

  const handleSelectStaff = useCallback((id: string | null) => {
    setSelectedStaffId(id);
    const todayStr = startOfDay(new Date()).toISOString().split("T")[0]!;
    setStats(computeStats(allAppts.current, allStaff.current, id, todayStr));
  }, []);

  function onRefresh() { setRefreshing(true); load(); }

  return (
    <View style={styles.root}>
      <ScrollView
        contentContainerStyle={styles.scroll}
        showsVerticalScrollIndicator={false}
        refreshControl={
          <RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor={T.brand600} />
        }
      >
        <OverlineHeader
          eyebrow="DÜKKAN ÖZET"
          title="Bugün"
          meta={fmtDate(today)}
        />

        {!loading && staff.length > 0 && (
          <ChipRow style={styles.chipRow}>
            <Chip
              selected={selectedStaffId === null}
              onPress={() => handleSelectStaff(null)}
            >
              Tüm Ekip
            </Chip>
            {staff.map((s) => (
              <Chip
                key={s.id}
                selected={selectedStaffId === s.id}
                onPress={() => handleSelectStaff(s.id)}
              >
                {s.name}
              </Chip>
            ))}
          </ChipRow>
        )}

        {loading ? (
          <ActivityIndicator color={T.brand600} style={{ marginTop: 40 }} />
        ) : stats ? (
          <>
            <View style={styles.kpiRow}>
              <KpiCard label="Bugün" value={String(stats.total)} />
              <KpiCard label="Tamamlanan" value={String(stats.completed)} accent />
              <KpiCard label="Tahmini ₺" value={String(stats.revenue)} />
            </View>

            <SectionLabel>ÖNGÖRÜLER (30 GÜN)</SectionLabel>
            <Card style={styles.insightCard}>
              <View style={styles.insightItem}>
                <Star size={16} color={T.brand600} />
                <View style={{ flex: 1 }}>
                  <Text style={styles.insightLabel}>En Çok Tercih Edilen</Text>
                  <Text style={styles.insightValue}>{stats.topStaff || "Veri Yok"}</Text>
                </View>
              </View>
              <View style={styles.insightDivider} />
              <View style={styles.insightItem}>
                <TrendingUp size={16} color={T.brand600} />
                <View style={{ flex: 1 }}>
                  <Text style={styles.insightLabel}>En Yoğun Gün</Text>
                  <Text style={styles.insightValue}>
                    {stats.busiestDay
                      ? `${stats.busiestDay.date} (${stats.busiestDay.count} rdv)`
                      : "Veri Yok"}
                  </Text>
                </View>
              </View>
            </Card>

            <SectionLabel>
              {selectedStaffId ? "PERSONEL DETAYI" : "USTA BAZINDA"}
            </SectionLabel>
            {stats.staffStats.length === 0 ? (
              <Text style={styles.emptyTxt}>Bu personele ait randevu yok.</Text>
            ) : (
              stats.staffStats.map((b) => (
                <Pressable
                  key={b.id}
                  onPress={() => handleSelectStaff(selectedStaffId === b.id ? null : b.id)}
                  style={({ pressed }) => [styles.staffRow, pressed && { opacity: 0.8 }]}
                >
                  <View style={[styles.avatar, selectedStaffId === b.id && { backgroundColor: T.brand100 }]}>
                    <Text style={styles.avatarText}>
                      {b.name.split(" ").map((n: string) => n[0] ?? "").join("").slice(0, 2).toUpperCase()}
                    </Text>
                  </View>
                  <View style={{ flex: 1 }}>
                    <Text style={styles.staffName}>{b.name}</Text>
                    <Text style={styles.staffCount}>{b.count} randevu</Text>
                  </View>
                  <ChevronRight size={16} color={T.fg4} />
                </Pressable>
              ))
            )}
          </>
        ) : null}
      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: T.bg },
  scroll: { paddingTop: 64, paddingBottom: 40 },
  chipRow: { marginBottom: S.s5 },
  kpiRow: { flexDirection: "row", gap: 10, marginBottom: 28, paddingHorizontal: S.s5 },
  insightCard: { marginHorizontal: S.s5, marginBottom: 24, padding: 16 },
  insightItem: { flexDirection: "row", alignItems: "center", gap: 12 },
  insightDivider: { height: 1, backgroundColor: T.border, marginVertical: 12 },
  insightLabel: { fontSize: 11, fontFamily: Type.family, color: T.fg3, textTransform: "uppercase", letterSpacing: 0.5, marginBottom: 2 },
  insightValue: { fontSize: 14, fontFamily: Type.family, fontWeight: Type.weight.bold, color: T.fg1 },
  staffRow: {
    flexDirection: "row", alignItems: "center", gap: 12,
    paddingVertical: 12, paddingHorizontal: 16,
    backgroundColor: T.bgElevated, borderWidth: 1, borderColor: T.border,
    borderRadius: R.md, marginHorizontal: S.s5, marginBottom: 8, ...Shadow.sm,
  },
  avatar: {
    width: 36, height: 36, borderRadius: R.pill,
    backgroundColor: T.slate100,
    alignItems: "center", justifyContent: "center",
  },
  avatarText: {
    fontSize: 13, fontFamily: Type.family,
    fontWeight: Type.weight.bold, color: T.ink900,
  },
  staffName: { fontSize: 15, fontFamily: Type.family, fontWeight: Type.weight.semibold, color: T.fg1 },
  staffCount: { fontSize: 12, fontFamily: Type.family, color: T.fg3, marginTop: 2 },
  emptyTxt: { fontSize: 13, fontFamily: Type.family, color: T.fg4, textAlign: "center", paddingVertical: 20 },
});
