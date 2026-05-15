import { useEffect, useState, useCallback, useMemo } from "react";
import { useRealtimeInvalidation } from "@berber/shared/use-realtime-invalidation";
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  RefreshControl,
  ActivityIndicator,
  Pressable,
  Alert,
  PanResponder,
  type PanResponderGestureState,
} from "react-native";
import { addDays, startOfDay, startOfWeek, isSameDay } from "date-fns";
import { Feather } from "@expo/vector-icons";
import { DEFAULT_TIMEZONE } from "@berber/shared/constants";
import { getDayBoundsUTC } from "@berber/shared/slot-utils";
import { supabase } from "../../lib/supabase";
import { useUserRole } from "../../lib/user-context";
import { AddAppointmentModal } from "../../components/AddAppointmentModal";
import { T, R, Shadow } from "../../lib/theme";

const TZ = DEFAULT_TIMEZONE;
const DAY_SHORT = ["Pzt", "Sal", "Çar", "Per", "Cum", "Cmt", "Paz"];
const MONTH_SHORT = ["Oca", "Şub", "Mar", "Nis", "May", "Haz", "Tem", "Ağu", "Eyl", "Eki", "Kas", "Ara"];
const CARD_WIDTH = 200;
const COLUMN_GAP = 10;
const COLUMN_PADDING = 12;
const COLUMN_STEP = CARD_WIDTH + COLUMN_GAP;

function fmtHM(iso: string): string {
  return new Date(iso).toLocaleTimeString("tr-TR", { hour: "2-digit", minute: "2-digit", timeZone: TZ });
}
function durationMin(start: string, end: string): number {
  return Math.max(0, Math.round((new Date(end).getTime() - new Date(start).getTime()) / 60000));
}

interface Staff { id: string; name: string }
interface Appt {
  id: string; staff_id: string;
  service_id: string | null;
  customer_name: string; customer_phone: string | null; customer_notes: string | null;
  starts_at: string; ends_at: string;
  status: string;
  services: { name: string; duration_min: number } | null;
}
interface Block {
  id: string; staff_id: string;
  starts_at: string; ends_at: string;
}
type AgendaItem =
  | { kind: "appt"; key: string; starts_at: string; appt: Appt }
  | { kind: "block"; key: string; starts_at: string; block: Block };

interface AppointmentCardProps {
  appt: Appt;
  dragging: boolean;
  onDragStart: (appt: Appt) => void;
  onDragMove: (gesture: PanResponderGestureState) => void;
  onDragEnd: (appt: Appt, gesture: PanResponderGestureState) => void;
  onDragCancel: () => void;
}

function AppointmentCard({
  appt,
  dragging,
  onDragStart,
  onDragMove,
  onDragEnd,
  onDragCancel,
}: AppointmentCardProps) {
  const panResponder = useMemo(
    () => PanResponder.create({
      onMoveShouldSetPanResponder: (_event, gesture) =>
        Math.abs(gesture.dx) > 12 && Math.abs(gesture.dx) > Math.abs(gesture.dy),
      onPanResponderGrant: () => onDragStart(appt),
      onPanResponderMove: (_event, gesture) => onDragMove(gesture),
      onPanResponderRelease: (_event, gesture) => onDragEnd(appt, gesture),
      onPanResponderTerminate: onDragCancel,
    }),
    [appt, onDragCancel, onDragEnd, onDragMove, onDragStart]
  );

  return (
    <View style={[styles.apptCard, dragging && styles.apptCardDragging]}>
      <View style={styles.apptHeader}>
        <Text style={styles.apptTime}>{fmtHM(appt.starts_at)} · {durationMin(appt.starts_at, appt.ends_at)} dk</Text>
        <View style={styles.dragHandle} {...panResponder.panHandlers}>
          <Feather name="move" size={14} color={T.muted} />
        </View>
      </View>
      <Text style={styles.apptName} numberOfLines={1}>{appt.customer_name}</Text>
      {appt.services && <Text style={styles.apptSvc} numberOfLines={1}>{appt.services.name}</Text>}
    </View>
  );
}

function BlockCard({ block }: { block: Block }) {
  return (
    <View style={styles.blockCard}>
      <Text style={styles.blockTime}>{fmtHM(block.starts_at)} Â· {durationMin(block.starts_at, block.ends_at)} dk</Text>
      <Text style={styles.blockTitle}>Bloke</Text>
    </View>
  );
}

export default function OwnerAgenda() {
  const { shopId } = useUserRole();
  const [staff, setStaff]       = useState<Staff[]>([]);
  const [appts, setAppts]       = useState<Appt[]>([]);
  const [blocks, setBlocks]     = useState<Block[]>([]);
  const [loading, setLoading]   = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [selectedDay, setSelectedDay] = useState<Date>(() => startOfDay(new Date()));
  const [modalStaff, setModalStaff] = useState<Staff | null>(null);
  const [draggingId, setDraggingId] = useState<string | null>(null);
  const [dragTargetStaffId, setDragTargetStaffId] = useState<string | null>(null);
  const [scrollX, setScrollX] = useState(0);

  const weekStart = useMemo(() => startOfWeek(selectedDay, { weekStartsOn: 1 }), [selectedDay]);
  const weekDays  = useMemo(() => Array.from({ length: 7 }, (_, i) => addDays(weekStart, i)), [weekStart]);
  const selectedDayKey = useMemo(() => selectedDay.toISOString(), [selectedDay]);
  const itemsByStaff = useMemo(() => {
    const grouped = new Map<string, AgendaItem[]>();
    for (const appt of appts) {
      const group = grouped.get(appt.staff_id);
      const item: AgendaItem = { kind: "appt", key: appt.id, starts_at: appt.starts_at, appt };
      if (group) {
        group.push(item);
      } else {
        grouped.set(appt.staff_id, [item]);
      }
    }
    for (const block of blocks) {
      const group = grouped.get(block.staff_id);
      const item: AgendaItem = { kind: "block", key: `block-${block.id}`, starts_at: block.starts_at, block };
      if (group) {
        group.push(item);
      } else {
        grouped.set(block.staff_id, [item]);
      }
    }
    for (const group of grouped.values()) {
      group.sort((a, b) => a.starts_at.localeCompare(b.starts_at));
    }
    return grouped;
  }, [appts, blocks]);

  const load = useCallback(async () => {
    if (!shopId) return;
    const { start, end } = getDayBoundsUTC(selectedDay, TZ);
    const dayStart = start.toISOString();
    const dayEnd = end.toISOString();

    const { data: staffData } = await supabase
      .from("staff")
      .select("id, name")
      .eq("shop_id", shopId);

    if (!staffData) { setLoading(false); setRefreshing(false); return; }
    // Referans ancak içerik gerçekten değişmişse güncellenir; aksi halde
    // subscription useEffect gereksiz yere yeniden kurulur.
    setStaff((prev) => {
      if (
        prev.length === staffData.length &&
        prev.every((s, i) => s.id === staffData[i]!.id && s.name === staffData[i]!.name)
      ) return prev;
      return staffData;
    });
    const staffIds = staffData.map((b) => b.id);

    if (staffIds.length === 0) {
      setAppts([]);
      setBlocks([]);
      setLoading(false);
      setRefreshing(false);
      return;
    }

    const [{ data: apptList }, { data: blockList }] = await Promise.all([
      supabase
        .from("appointments")
        .select("id, staff_id, service_id, customer_name, customer_phone, customer_notes, starts_at, ends_at, status, services(name, duration_min)")
        .in("staff_id", staffIds)
        .gte("starts_at", dayStart)
        .lt("starts_at", dayEnd)
        .neq("status", "cancelled")
        .order("starts_at"),
      supabase
        .from("blocks")
        .select("id, staff_id, starts_at, ends_at")
        .in("staff_id", staffIds)
        .gte("starts_at", dayStart)
        .lt("starts_at", dayEnd)
        .order("starts_at"),
    ]);

    setAppts((apptList as unknown as Appt[]) ?? []);
    setBlocks((blockList as Block[]) ?? []);
    setLoading(false);
    setRefreshing(false);
  }, [shopId, selectedDay]);

  useEffect(() => { load(); }, [load]);

  const agendaTableFilters = useMemo(() => [
    { table: "appointment_slots" as const, filters: staff.map(m => `staff_id=eq.${m.id}`) },
    { table: "block_slots" as const,       filters: staff.map(m => `staff_id=eq.${m.id}`) },
  ], [staff]);

  useRealtimeInvalidation({
    client: supabase,
    channelName: `owner-agenda:${shopId}:${selectedDayKey}`,
    tableFilters: agendaTableFilters,
    invalidate: load,
    enabled: !!shopId && staff.length > 0,
    debounceMs: 300,
  });

  function onRefresh() { setRefreshing(true); load(); }

  const resolveDropStaff = useCallback((moveX: number): Staff | null => {
    const contentX = scrollX + moveX - COLUMN_PADDING;
    const index = Math.floor(contentX / COLUMN_STEP);
    return staff[index] ?? null;
  }, [scrollX, staff]);

  const moveAppointment = useCallback(async (appt: Appt, targetStaff: Staff) => {
    if (!appt.service_id) {
      Alert.alert("Tasinamadi", "Bu randevunun kayitli hizmeti yok.");
      return;
    }
    if (targetStaff.id === appt.staff_id) return;

    setAppts((current) =>
      current.map((item) => item.id === appt.id ? { ...item, staff_id: targetStaff.id } : item)
    );

    const { error } = await supabase.rpc("update_appointment_atomic" as never, {
      p_appointment_id: appt.id,
      p_staff_id: targetStaff.id,
      p_service_id: appt.service_id,
      p_starts_at: appt.starts_at,
      p_customer_name: appt.customer_name,
      p_customer_phone: appt.customer_phone,
      p_customer_notes: appt.customer_notes,
    } as never);

    if (error) {
      await load();
      if (error.code === "23P01" || error.code === "P0001") {
        Alert.alert("Cakisma", error.message || "Hedef personelde bu saat artik musait degil.");
      } else {
        Alert.alert("Tasinamadi", error.message);
      }
      return;
    }

    await load();
  }, [load]);

  const handleDragStart = useCallback((appt: Appt) => {
    setDraggingId(appt.id);
    setDragTargetStaffId(appt.staff_id);
  }, []);

  const handleDragMove = useCallback((gesture: PanResponderGestureState) => {
    const targetStaff = resolveDropStaff(gesture.moveX);
    setDragTargetStaffId(targetStaff?.id ?? null);
  }, [resolveDropStaff]);

  const handleDragCancel = useCallback(() => {
    setDraggingId(null);
    setDragTargetStaffId(null);
  }, []);

  const handleDragEnd = useCallback((appt: Appt, gesture: PanResponderGestureState) => {
    const targetStaff = resolveDropStaff(gesture.moveX);
    setDraggingId(null);
    setDragTargetStaffId(null);
    if (!targetStaff) return;
    void moveAppointment(appt, targetStaff);
  }, [moveAppointment, resolveDropStaff]);

  return (
    <View style={styles.root}>
      {/* Hafta strip */}
      <View style={styles.weekStrip}>
        <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.weekRow}>
          {weekDays.map((d) => {
            const sel = isSameDay(d, selectedDay);
            const isToday = isSameDay(d, new Date());
            return (
              <Pressable
                key={d.toISOString()}
                onPress={() => setSelectedDay(startOfDay(d))}
                style={[styles.dayChip, sel && styles.dayChipSel, isToday && !sel && styles.dayChipToday]}
              >
                <Text style={[styles.dayName, sel && { color: "#fff" }]}>{DAY_SHORT[d.getDay() === 0 ? 6 : d.getDay() - 1]}</Text>
                <Text style={[styles.dayNum, sel && { color: "#fff" }]}>{d.getDate()}</Text>
              </Pressable>
            );
          })}
        </ScrollView>
      </View>

      {/* Ustalar yan yana */}
      {loading ? (
        <ActivityIndicator color={T.navy} style={{ marginTop: 40 }} />
      ) : (
        <ScrollView
          horizontal
          showsHorizontalScrollIndicator={false}
          scrollEventThrottle={16}
          onScroll={(event) => setScrollX(event.nativeEvent.contentOffset.x)}
          refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor={T.navy} />}
          contentContainerStyle={styles.columnsContainer}
        >
          {staff.map((st) => {
            const staffItems = itemsByStaff.get(st.id) ?? [];
            const apptCount = staffItems.filter((item) => item.kind === "appt").length;
            const blockCount = staffItems.length - apptCount;
            const countLabel = blockCount > 0 ? `${apptCount} randevu · ${blockCount} blok` : `${apptCount} randevu`;
            return (
              <View key={st.id} style={[styles.column, dragTargetStaffId === st.id && styles.columnDropTarget]}>
                {/* Usta başlığı */}
                <View style={styles.colHeader}>
                  <Text style={styles.colName} numberOfLines={1}>{st.name}</Text>
                  <Text style={styles.colCount}>{countLabel}</Text>
                </View>

                {/* Randevular */}
                {staffItems.length === 0 ? (
                  <View style={styles.emptyCol}>
                    <Text style={styles.emptyTxt}>Randevu yok</Text>
                  </View>
                ) : (
                  staffItems.map((item) =>
                    item.kind === "appt" ? (
                      <AppointmentCard
                        key={item.key}
                        appt={item.appt}
                        dragging={draggingId === item.appt.id}
                        onDragStart={handleDragStart}
                        onDragMove={handleDragMove}
                        onDragEnd={handleDragEnd}
                        onDragCancel={handleDragCancel}
                      />
                    ) : (
                      <BlockCard key={item.key} block={item.block} />
                    )
                  )
                )}

                {/* Manuel randevu ekle */}
                <Pressable
                  onPress={() => setModalStaff(st)}
                  style={({ pressed }) => [styles.addBtn, pressed && { opacity: 0.7 }]}
                >
                  <Text style={styles.addBtnTxt}>+ Randevu Ekle</Text>
                </Pressable>
              </View>
            );
          })}
        </ScrollView>
      )}

      {/* Manuel randevu modal */}
      {modalStaff && shopId && (
        <AddAppointmentModal
          visible={!!modalStaff}
          shopId={shopId}
          staffId={modalStaff.id}
          initialDate={selectedDay}
          onSaved={load}
          onClose={() => setModalStaff(null)}
        />
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: T.bg },

  weekStrip: {
    paddingTop: 56,
    paddingBottom: 8,
    borderBottomWidth: 1,
    borderBottomColor: T.line,
    backgroundColor: T.bg,
  },
  weekRow: { paddingHorizontal: 16, gap: 6 },
  dayChip: {
    width: 44, height: 60,
    borderRadius: R.cta,
    borderWidth: 1,
    borderColor: T.line,
    backgroundColor: T.surface,
    alignItems: "center",
    justifyContent: "center",
    gap: 2,
  },
  dayChipSel: { backgroundColor: T.navy, borderColor: T.navy },
  dayChipToday: { borderColor: T.red },
  dayName: { fontSize: 10, fontWeight: "600", color: T.muted, textTransform: "uppercase" },
  dayNum: { fontSize: 18, fontWeight: "700", color: T.ink },

  columnsContainer: { padding: 12, gap: 10, alignItems: "flex-start" },
  column: {
    width: CARD_WIDTH,
    backgroundColor: T.surface,
    borderWidth: 1,
    borderColor: T.line,
    borderRadius: R.card,
    padding: 10,
    gap: 8,
    ...Shadow.card,
  },
  columnDropTarget: {
    borderColor: T.navy,
    backgroundColor: T.blueSoft,
  },
  colHeader: { borderBottomWidth: 1, borderBottomColor: T.line, paddingBottom: 8 },
  colName: { fontSize: 14, fontWeight: "700", color: T.navy },
  colCount: { fontSize: 11, color: T.muted, marginTop: 2 },

  emptyCol: { paddingVertical: 20, alignItems: "center" },
  emptyTxt: { fontSize: 12, color: T.mutedAlt },

  apptCard: {
    padding: 8,
    backgroundColor: T.bg,
    borderRadius: R.input,
    borderLeftWidth: 3,
    borderLeftColor: T.navy,
  },
  apptCardDragging: {
    opacity: 0.65,
    transform: [{ scale: 0.98 }],
  },
  apptHeader: { flexDirection: "row", alignItems: "center", justifyContent: "space-between", gap: 8 },
  dragHandle: {
    width: 28,
    height: 24,
    alignItems: "center",
    justifyContent: "center",
    borderRadius: R.input,
    backgroundColor: T.surface,
  },
  apptTime: { fontSize: 11, color: T.muted, fontWeight: "500" },
  apptName: { fontSize: 13, fontWeight: "600", color: T.ink, marginTop: 2 },
  apptSvc: { fontSize: 11, color: T.muted, marginTop: 1 },
  blockCard: {
    padding: 8,
    backgroundColor: T.surfaceAlt,
    borderRadius: R.input,
    borderWidth: 1,
    borderColor: T.hairAlt,
    borderStyle: "dashed",
  },
  blockTime: { fontSize: 11, color: T.muted, fontWeight: "500" },
  blockTitle: { fontSize: 13, fontWeight: "700", color: T.blockInk, marginTop: 2 },

  addBtn: {
    paddingVertical: 10,
    borderRadius: R.cta,
    borderWidth: 1,
    borderColor: T.navy,
    borderStyle: "dashed",
    alignItems: "center",
    marginTop: 4,
  },
  addBtnTxt: { fontSize: 13, fontWeight: "600", color: T.navy },
});
