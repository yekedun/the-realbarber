import { useEffect, useState, useCallback, useMemo, useRef } from "react";
import { useRealtimeInvalidation } from "@berber/shared/use-realtime-invalidation";
import {
  View,
  Text,
  StyleSheet,
  ActivityIndicator,
  Alert,
  Pressable,
  ScrollView,
  RefreshControl,
  Animated,
  Easing,
  type LayoutChangeEvent,
} from "react-native";
import { Feather } from "@expo/vector-icons";
import { addDays, startOfDay, startOfWeek, isSameDay } from "date-fns";
import { DEFAULT_TIMEZONE } from "@berber/shared/constants";
import { getDayBoundsUTC } from "@berber/shared/slot-utils";
import { supabase } from "../../lib/supabase";
import { T, R, Shadow, POLE_COLORS } from "../../lib/theme";
import { AddAppointmentModal } from "../../components/AddAppointmentModal";
import { AppointmentDetailSheet } from "../../components/AppointmentDetailSheet";

interface Appointment {
  id: string;
  customer_name: string;
  customer_phone: string | null;
  starts_at: string;
  ends_at: string;
  status: string;
  service_id: string | null;
  services: { name: string; duration_min: number } | null;
}
interface Block {
  id: string;
  starts_at: string;
  ends_at: string;
}
type TimelineItem =
  | { kind: "appt"; key: string; starts_at: string; appt: Appointment }
  | { kind: "block"; key: string; starts_at: string; block: Block };

const TZ = DEFAULT_TIMEZONE;
const DAY_NAMES = ["Pzt", "Sal", "Çar", "Per", "Cum", "Cmt", "Paz"];
const MONTH_NAMES = [
  "Ocak", "Şubat", "Mart", "Nisan", "Mayıs", "Haziran",
  "Temmuz", "Ağustos", "Eylül", "Ekim", "Kasım", "Aralık",
];
const APPT_COLS =
  "id, customer_name, customer_phone, starts_at, ends_at, status, service_id, services(name, duration_min)";

// Timeline grid (m3.jsx: 52 | 28 | 1fr; track is 4px wide, centered in 28 column)
const TIME_COL = 52;
const TRACK_COL = 28;
const TRACK_WIDTH = 4;
const TRACK_LEFT = TIME_COL + TRACK_COL / 2 - TRACK_WIDTH / 2;
const POLE_STRIPE_H = 6; // each stripe height; 4 stripes = 24px period
function fmtHM(iso: string | Date): string {
  const d = typeof iso === "string" ? new Date(iso) : iso;
  return d.toLocaleTimeString("tr-TR", {
    hour: "2-digit",
    minute: "2-digit",
    timeZone: TZ,
  });
}
function durationMin(start: string, end: string): number {
  return Math.max(0, Math.round((new Date(end).getTime() - new Date(start).getTime()) / 60000));
}
function initials(name: string): string {
  return name
    .split(/\s+/)
    .filter(Boolean)
    .slice(0, 2)
    .map((s) => s[0]!.toUpperCase())
    .join("");
}

export default function AppointmentsScreen() {
  const [appointments, setAppointments] = useState<Appointment[]>([]);
  const [blocks, setBlocks] = useState<Block[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [staffId, setStaffId] = useState<string | null>(null);
  const [selectedDay, setSelectedDay] = useState<Date>(() => startOfDay(new Date()));
  const [addModalVisible, setAddModalVisible] = useState(false);
  const [editingAppt, setEditingAppt] = useState<Appointment | null>(null);
  const [detailAppt, setDetailAppt] = useState<Appointment | null>(null);
  const [statusActionLoading, setStatusActionLoading] = useState(false);
  const [now, setNow] = useState<Date>(() => new Date());

  const reqIdRef = useRef(0);

  const weekStart = useMemo(
    () => startOfWeek(selectedDay, { weekStartsOn: 1 }),
    [selectedDay]
  );
  const weekDays = useMemo(
    () => Array.from({ length: 7 }, (_, i) => addDays(weekStart, i)),
    [weekStart]
  );

  const [shopId, setShopId] = useState<string | null>(null);

  const fetchStaff = useCallback(async () => {
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) return;
    const { data: staff } = await supabase
      .from("staff")
      .select("id, shop_id")
      .eq("user_id", user.id)
      .single();
    if (staff) {
      setStaffId(staff.id);
      setShopId(staff.shop_id);
    }
  }, []);

  const fetchDay = useCallback(async (bid: string, day: Date) => {
    const reqId = ++reqIdRef.current;
    const { start, end } = getDayBoundsUTC(day, TZ);
    const dayStart = start.toISOString();
    const dayEnd = end.toISOString();
    const [{ data: appts }, { data: blks }] = await Promise.all([
      supabase
        .from("appointments")
        .select(APPT_COLS)
        .eq("staff_id", bid)
        .gte("starts_at", dayStart)
        .lt("starts_at", dayEnd)
        .order("starts_at", { ascending: true }),
      supabase
        .from("blocks")
        .select("id, starts_at, ends_at")
        .eq("staff_id", bid)
        .gte("starts_at", dayStart)
        .lt("starts_at", dayEnd),
    ]);
    if (reqId !== reqIdRef.current) return;
    setAppointments((appts as unknown as Appointment[]) ?? []);
    setBlocks((blks as Block[]) ?? []);
    setLoading(false);
    setRefreshing(false);
  }, []);

  useEffect(() => { fetchStaff(); }, [fetchStaff]);

  useEffect(() => {
    if (!staffId) return;
    setLoading(true);
    fetchDay(staffId, selectedDay);
  }, [staffId, selectedDay, fetchDay]);

  useEffect(() => {
    const id = setInterval(() => setNow(new Date()), 60_000);
    return () => clearInterval(id);
  }, []);

  const realtimeTableFilters = useMemo(() => [
    { table: "appointments" as const, filters: staffId ? [`staff_id=eq.${staffId}`] : [] },
    { table: "blocks" as const,       filters: staffId ? [`staff_id=eq.${staffId}`] : [] },
  ], [staffId]);

  useRealtimeInvalidation({
    client: supabase,
    channelName: `appointments:${staffId ?? "none"}`,
    tableFilters: realtimeTableFilters,
    invalidate: () => { if (staffId) void fetchDay(staffId, selectedDay); },
    enabled: !!staffId,
  });

  const timeline: TimelineItem[] = useMemo(() => {
    const items: TimelineItem[] = [
      ...appointments
        .filter((a) => a.status !== "cancelled")
        .map((a): TimelineItem => ({
          kind: "appt", key: a.id, starts_at: a.starts_at, appt: a,
        })),
      ...blocks.map((b): TimelineItem => ({
        kind: "block", key: `block-${b.id}`, starts_at: b.starts_at, block: b,
      })),
    ];
    return items.sort((x, y) => x.starts_at.localeCompare(y.starts_at));
  }, [appointments, blocks]);

  const onRefresh = useCallback(() => {
    if (!staffId) return;
    setRefreshing(true);
    fetchDay(staffId, selectedDay);
  }, [staffId, selectedDay, fetchDay]);

  const today = new Date();
  const isViewingToday = isSameDay(selectedDay, today);
  const dayMode: "past" | "today" | "future" = isViewingToday
    ? "today"
    : startOfDay(selectedDay).getTime() < startOfDay(today).getTime()
    ? "past"
    : "future";
  const dateLabel = `${selectedDay.getDate()} ${MONTH_NAMES[selectedDay.getMonth()]} ${selectedDay.getFullYear()}, ${DAY_NAMES[(selectedDay.getDay() + 6) % 7]}`;

  const nowInsertIdx = useMemo(() => {
    if (!isViewingToday) return -1;
    const ts = now.getTime();
    for (let i = 0; i < timeline.length; i++) {
      if (new Date(timeline[i]!.starts_at).getTime() > ts) return i;
    }
    return timeline.length;
  }, [timeline, now, isViewingToday]);

  return (
    <View style={styles.root}>
      <Header today={today} selected={selectedDay} onSelect={setSelectedDay} weekDays={weekDays} dateLabel={dateLabel} />

      {loading ? (
        <View style={styles.center}>
          <ActivityIndicator size="large" color={T.navy} />
        </View>
      ) : timeline.length === 0 ? (
        <ScrollView
          contentContainerStyle={styles.emptyWrap}
          refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor={T.navy} />}
        >
          <EmptyDay date={selectedDay} />
        </ScrollView>
      ) : (
        <ScrollView
          style={styles.scroll}
          contentContainerStyle={styles.scrollContent}
          showsVerticalScrollIndicator={false}
          refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor={T.navy} />}
        >
          <Timeline
            items={timeline}
            now={now}
            nowInsertIdx={nowInsertIdx}
            dayMode={dayMode}
            onPressAppt={setDetailAppt}
          />
        </ScrollView>
      )}

      {staffId && (
        <View style={styles.fabWrap} pointerEvents="box-none">
          <Pressable
            style={({ pressed }) => [styles.fab, pressed && styles.fabPressed]}
            onPress={() => setAddModalVisible(true)}
          >
            <Feather name="plus" size={18} color="#fff" />
            <Text style={styles.fabText}>Yeni Randevu</Text>
          </Pressable>
        </View>
      )}

      {staffId && shopId && (
        <AddAppointmentModal
          visible={addModalVisible || !!editingAppt}
          shopId={shopId}
          staffId={staffId}
          initialDate={selectedDay}
          editingAppt={editingAppt}
          onSaved={() => fetchDay(staffId, selectedDay)}
          onClose={() => {
            setAddModalVisible(false);
            setEditingAppt(null);
          }}
        />
      )}

      <AppointmentDetailSheet
        appt={detailAppt}
        onClose={() => setDetailAppt(null)}
        onAction={async (action) => {
          if (!detailAppt) return;
          if (statusActionLoading && (action === "complete" || action === "cancel")) return;
          if (action === "complete") {
            setStatusActionLoading(true);
            const { error } = await supabase.rpc("complete_appointment_with_revenue", {
              p_appointment_id: detailAppt.id,
            });
            setStatusActionLoading(false);
            if (error) {
              Alert.alert("Hata", error.message || "Randevu tamamlanamadi.");
              return;
            }
            if (staffId) await fetchDay(staffId, selectedDay);
            setDetailAppt(null);
            return;
          }
          if (action === "cancel") {
            setStatusActionLoading(true);
            const { error } = await supabase.rpc("cancel_appointment_atomic" as never, {
              p_appointment_id: detailAppt.id,
            } as never);
            setStatusActionLoading(false);
            if (error) {
              Alert.alert("Hata", error.message || "Randevu iptal edilemedi.");
              return;
            }
            if (staffId) await fetchDay(staffId, selectedDay);
            setDetailAppt(null);
            return;
          }
          if (action === "edit") {
            const target = detailAppt;
            setDetailAppt(null);
            // Slight delay so the detail sheet animates out before edit modal slides in
            setTimeout(() => setEditingAppt(target), 220);
          }
        }}
      />
    </View>
  );
}

function Header({
  today, selected, onSelect, weekDays, dateLabel,
}: {
  today: Date;
  selected: Date;
  onSelect: (d: Date) => void;
  weekDays: Date[];
  dateLabel: string;
}) {
  return (
    <View style={styles.header}>
      <View style={styles.headerInner}>
        <Text style={styles.eyebrow}>BERBER · DÜKKAN PANELİ</Text>
        <View style={styles.titleRow}>
          <Text style={styles.title}>Randevular</Text>
          <Text style={styles.dateLabel}>{dateLabel}</Text>
        </View>
      </View>

      <ScrollView
        horizontal
        showsHorizontalScrollIndicator={false}
        contentContainerStyle={styles.stripContent}
      >
        {weekDays.map((d) => {
          const isSel = isSameDay(d, selected);
          const isToday = isSameDay(d, today);
          return (
            <Pressable
              key={d.toISOString()}
              onPress={() => onSelect(d)}
              style={({ pressed }) => [
                styles.day,
                isSel && styles.daySelected,
                !isSel && isToday && styles.dayToday,
                pressed && { transform: [{ scale: 0.985 }] },
              ]}
            >
              <Text style={[styles.dow, isSel && styles.dowSelected]}>
                {DAY_NAMES[(d.getDay() + 6) % 7]}
              </Text>
              <Text style={[styles.dnum, isSel && styles.dnumSelected]}>
                {d.getDate()}
              </Text>
              {isToday && (
                <View
                  style={[styles.todayDot, isSel && styles.todayDotOnSel]}
                />
              )}
            </Pressable>
          );
        })}
      </ScrollView>
    </View>
  );
}

function Timeline({
  items, now, nowInsertIdx, dayMode, onPressAppt,
}: {
  items: TimelineItem[];
  now: Date;
  nowInsertIdx: number;
  dayMode: "past" | "today" | "future";
  onPressAppt: (a: Appointment) => void;
}) {
  const [trackHeight, setTrackHeight] = useState(0);
  const [nowY, setNowY] = useState<number | null>(null);
  const onLayout = useCallback((e: LayoutChangeEvent) => {
    setTrackHeight(e.nativeEvent.layout.height);
  }, []);
  const onNowLayout = useCallback((e: LayoutChangeEvent) => {
    setNowY(e.nativeEvent.layout.y + e.nativeEvent.layout.height / 2);
  }, []);

  const hasNow = nowInsertIdx !== -1 && dayMode === "today";
  // Past days → full gray, Future days → full barber pole, Today → split at NOW
  const splitY =
    dayMode === "past"
      ? trackHeight
      : dayMode === "future"
      ? 0
      : hasNow && nowY !== null
      ? nowY
      : trackHeight;
  const nowMs = now.getTime();

  return (
    <View style={styles.timeline} onLayout={onLayout}>
      {/* Background track: past gray + future barber pole */}
      <View style={[styles.trackBg, { left: TRACK_LEFT, width: TRACK_WIDTH }]} pointerEvents="none">
        {splitY > 0 && (
          <View style={[styles.trackPast, { height: splitY }]} />
        )}
        {trackHeight - splitY > 0 && (
          <View style={[styles.trackFuture, { top: splitY }]}>
            <BarberPole height={trackHeight - splitY} />
          </View>
        )}
      </View>

      {items.map((item, idx) => (
        <View key={item.key}>
          {idx === nowInsertIdx && <NowRow now={now} onLayout={onNowLayout} />}
          {item.kind === "appt" ? (
            <ApptRow
              appt={item.appt}
              isPast={new Date(item.appt.ends_at).getTime() < nowMs}
              onPress={() => onPressAppt(item.appt)}
            />
          ) : (
            <BlockRow block={item.block} />
          )}
        </View>
      ))}
      {nowInsertIdx === items.length && <NowRow now={now} onLayout={onNowLayout} />}
    </View>
  );
}

function BarberPole({ height }: { height: number }) {
  if (height <= 0) return null;
  const count = Math.ceil(height / POLE_STRIPE_H) + 1;
  return (
    <View style={{ width: TRACK_WIDTH, height, opacity: 0.6, overflow: "hidden" }}>
      {Array.from({ length: count }).map((_, i) => (
        <View
          key={i}
          style={{
            height: POLE_STRIPE_H,
            backgroundColor: POLE_COLORS[i % POLE_COLORS.length]!,
          }}
        />
      ))}
    </View>
  );
}

function ApptRow({
  appt, isPast, onPress,
}: {
  appt: Appointment;
  isPast: boolean;
  onPress: () => void;
}) {
  const isCompleted = appt.status === "completed";
  const treatAsPast = isCompleted || (isPast && appt.status === "confirmed");
  if (treatAsPast) return <DoneRow appt={appt} />;
  return <UpcomingRow appt={appt} onPress={onPress} />;
}

function TimeColumn({
  starts_at,
  ends_at,
  variant,
}: {
  starts_at: string;
  ends_at: string;
  variant: "past" | "future" | "block";
}) {
  const isPast = variant === "past";
  return (
    <View style={styles.timeCol}>
      <Text style={[styles.timeText, isPast && styles.timePast]}>{fmtHM(starts_at)}</Text>
      <Text style={[styles.timeEnd, isPast && styles.timePast]}>{fmtHM(ends_at)}</Text>
    </View>
  );
}

function TrackColumn({ variant }: { variant: "past" | "future" | "block" }) {
  const diamondStyle =
    variant === "future"
      ? styles.diamondNavy
      : variant === "block"
      ? styles.diamondSlate
      : styles.diamondPast;
  return (
    <View style={styles.trackCol}>
      <View style={[styles.diamond, diamondStyle]} />
      <View style={[styles.diamond, diamondStyle]} />
    </View>
  );
}

function DoneRow({ appt }: { appt: Appointment }) {
  const dur = appt.services?.duration_min ?? durationMin(appt.starts_at, appt.ends_at);
  return (
    <View style={styles.row}>
      <TimeColumn starts_at={appt.starts_at} ends_at={appt.ends_at} variant="past" />
      <TrackColumn variant="past" />
      <View style={styles.doneCard}>
        <View style={styles.doneMain}>
          <Text style={styles.doneName} numberOfLines={1}>
            {appt.customer_name}
          </Text>
          <Text style={styles.doneSub} numberOfLines={1}>
            {appt.services?.name ?? "Randevu"} · {dur}dk
          </Text>
        </View>
        <View style={styles.doneCheck}>
          <Feather name="check" size={11} color={T.muted} />
        </View>
      </View>
    </View>
  );
}

function UpcomingRow({ appt, onPress }: { appt: Appointment; onPress: () => void }) {
  return (
    <View style={styles.row}>
      <TimeColumn starts_at={appt.starts_at} ends_at={appt.ends_at} variant="future" />
      <TrackColumn variant="future" />
      <Pressable style={({ pressed }) => [styles.upCard, pressed && { opacity: 0.95 }]} onPress={onPress}>
        <View style={styles.avatar}>
          <Text style={styles.avatarTxt}>{initials(appt.customer_name) || "?"}</Text>
        </View>
        <View style={styles.upMain}>
          <Text style={styles.upName} numberOfLines={1}>{appt.customer_name}</Text>
          <Text style={styles.upSub} numberOfLines={1}>{appt.services?.name ?? "Randevu"}</Text>
        </View>
        <Feather name="chevron-right" size={16} color={T.muted} />
      </Pressable>
    </View>
  );
}

function BlockRow({ block }: { block: Block }) {
  const dur = durationMin(block.starts_at, block.ends_at);
  return (
    <View style={styles.row}>
      <TimeColumn starts_at={block.starts_at} ends_at={block.ends_at} variant="block" />
      <TrackColumn variant="block" />
      <View style={styles.blockCard}>
        <Text style={styles.blockText}>BLOKE · {dur}dk</Text>
      </View>
    </View>
  );
}

function NowRow({ now, onLayout }: { now: Date; onLayout: (e: LayoutChangeEvent) => void }) {
  const pulse = useRef(new Animated.Value(0)).current;
  useEffect(() => {
    const loop = Animated.loop(
      Animated.timing(pulse, {
        toValue: 1,
        duration: 1600,
        easing: Easing.out(Easing.ease),
        useNativeDriver: true,
      })
    );
    loop.start();
    return () => loop.stop();
  }, [pulse]);

  const haloScale = pulse.interpolate({ inputRange: [0, 1], outputRange: [1, 2.7] });
  const haloOpacity = pulse.interpolate({ inputRange: [0, 0.7, 1], outputRange: [0.55, 0, 0] });

  return (
    <View style={styles.nowRow} onLayout={onLayout}>
      <View style={styles.timeCol}>
        <Text style={styles.nowTime}>{fmtHM(now)}</Text>
      </View>
      <View style={styles.trackCol}>
        <View style={styles.nowDotWrap}>
          <Animated.View
            style={[styles.nowHalo, { transform: [{ scale: haloScale }], opacity: haloOpacity }]}
          />
          <View style={styles.nowDot} />
        </View>
      </View>
      <View style={styles.nowLine} />
    </View>
  );
}

function EmptyDay({ date }: { date: Date }) {
  return (
    <View style={styles.empty}>
      <View style={styles.emptyIconWrap}>
        <Feather name="calendar" size={28} color={T.muted} />
      </View>
      <Text style={styles.emptyTitle}>Henüz randevu yok</Text>
      <Text style={styles.emptyBody}>
        {date.getDate()} {MONTH_NAMES[date.getMonth()]} için randevu bulunmuyor.{"\n"}
        Yeni Randevu butonuna basarak ekleyebilirsiniz.
      </Text>
    </View>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: T.bg },

  // Header
  header: {
    backgroundColor: T.bg,
    borderBottomWidth: 1,
    borderBottomColor: T.line,
    paddingTop: 56,
    paddingBottom: 12,
  },
  headerInner: { paddingHorizontal: 20, paddingTop: 8, paddingBottom: 14 },
  eyebrow: {
    fontSize: 11,
    fontWeight: "600",
    letterSpacing: 1.4,
    textTransform: "uppercase",
    color: T.red,
    marginBottom: 4,
  },
  titleRow: {
    flexDirection: "row",
    alignItems: "baseline",
    justifyContent: "space-between",
    gap: 12,
  },
  title: { fontSize: 30, fontWeight: "700", letterSpacing: -0.5, color: T.ink },
  dateLabel: { fontSize: 12, color: T.muted, fontWeight: "500" },

  stripContent: { paddingHorizontal: 20, paddingBottom: 4, gap: 8 },
  day: {
    width: 48,
    height: 64,
    borderRadius: 14,
    borderWidth: 1,
    borderColor: T.line,
    backgroundColor: T.surface,
    alignItems: "center",
    justifyContent: "center",
  },
  dayToday: { borderWidth: 1.5, borderColor: T.red },
  daySelected: {
    backgroundColor: T.ink,
    borderColor: T.ink,
    ...Shadow.pill,
  },
  dow: {
    fontSize: 10,
    fontWeight: "600",
    letterSpacing: 0.5,
    textTransform: "uppercase",
    color: T.muted,
    marginBottom: 2,
  },
  dowSelected: { color: "rgba(255,255,255,0.7)" },
  dnum: { fontSize: 20, fontWeight: "700", color: T.ink },
  dnumSelected: { color: "#fff" },
  todayDot: {
    width: 4, height: 4, borderRadius: 4,
    backgroundColor: T.red,
    marginTop: 3,
  },
  todayDotOnSel: { backgroundColor: "#fff" },

  // Body
  scroll: { flex: 1, backgroundColor: T.bg },
  scrollContent: { paddingTop: 6, paddingBottom: 110, paddingHorizontal: 0 },

  // Timeline
  timeline: { position: "relative" },
  trackBg: { position: "absolute", top: 0, bottom: 0 },
  trackPast: {
    position: "absolute",
    top: 0,
    left: 0,
    right: 0,
    backgroundColor: T.past,
    borderRadius: 2,
  },
  trackFuture: { position: "absolute", left: 0, right: 0, bottom: 0, borderRadius: 2 },

  // Row
  row: { flexDirection: "row", alignItems: "stretch", paddingHorizontal: 0 },
  timeCol: {
    width: TIME_COL,
    paddingRight: 10,
    paddingVertical: 12,
    alignItems: "flex-end",
    justifyContent: "space-between",
  },
  timeText: {
    fontSize: 12,
    fontWeight: "600",
    color: T.ink,
    fontVariant: ["tabular-nums"],
  },
  timeEnd: {
    fontSize: 11,
    fontWeight: "500",
    color: T.muted,
    fontVariant: ["tabular-nums"],
  },
  timePast: { color: T.mutedAlt, fontWeight: "500" },
  trackCol: {
    width: TRACK_COL,
    alignItems: "center",
    justifyContent: "space-between",
    paddingVertical: 14,
  },
  diamond: {
    width: 10,
    height: 10,
    transform: [{ rotate: "45deg" }],
    zIndex: 2,
  },
  diamondPast: {
    backgroundColor: T.past,
    borderWidth: 2,
    borderColor: T.bg,
  },
  diamondNavy: {
    backgroundColor: T.navy,
    borderWidth: 2,
    borderColor: "#fff",
    ...Shadow.card,
  },
  diamondSlate: {
    backgroundColor: "#94A3B8",
    borderWidth: 2,
    borderColor: T.bg,
  },

  // Done card (past)
  doneCard: {
    flex: 1,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    paddingVertical: 10,
    paddingRight: 14,
    paddingBottom: 14,
  },
  doneMain: { flex: 1, paddingRight: 10 },
  doneName: {
    fontSize: 14,
    fontWeight: "600",
    color: T.mutedAlt,
    textDecorationLine: "line-through",
    textDecorationColor: T.mutedAlt,
  },
  doneSub: { fontSize: 12, color: T.mutedAlt, marginTop: 2 },
  doneCheck: {
    width: 18, height: 18, borderRadius: 9,
    backgroundColor: T.line,
    alignItems: "center",
    justifyContent: "center",
  },

  // Upcoming card
  upCard: {
    flex: 1,
    flexDirection: "row",
    alignItems: "center",
    gap: 12,
    backgroundColor: T.surface,
    borderRadius: R.card,
    borderWidth: 1,
    borderColor: T.line,
    paddingVertical: 12,
    paddingHorizontal: 14,
    marginRight: 14,
    marginBottom: 14,
    ...Shadow.card,
  },
  avatar: {
    width: 36, height: 36, borderRadius: 10,
    backgroundColor: T.avatarFrom,
    alignItems: "center",
    justifyContent: "center",
  },
  avatarTxt: { fontSize: 14, fontWeight: "700", color: T.navy },
  upMain: { flex: 1, minWidth: 0 },
  upName: { fontSize: 14, fontWeight: "600", color: T.ink },
  upSub: { fontSize: 12, color: T.blue, marginTop: 2, fontWeight: "500" },

  // Block card
  blockCard: {
    flex: 1,
    backgroundColor: T.surfaceAlt,
    borderRadius: R.card,
    borderWidth: 1,
    borderColor: T.hairAlt,
    borderStyle: "dashed",
    paddingVertical: 14,
    paddingHorizontal: 14,
    marginRight: 14,
    marginBottom: 14,
    alignItems: "center",
  },
  blockText: {
    fontSize: 12,
    fontWeight: "700",
    letterSpacing: 2,
    color: T.blockInk,
    textTransform: "uppercase",
  },

  // Now row
  nowRow: {
    flexDirection: "row",
    alignItems: "center",
    minHeight: 28,
    marginBottom: 6,
  },
  nowTime: {
    fontSize: 12,
    fontWeight: "700",
    color: T.red,
    fontVariant: ["tabular-nums"],
  },
  nowDotWrap: { width: 14, height: 14, alignItems: "center", justifyContent: "center" },
  nowHalo: {
    position: "absolute",
    width: 14, height: 14, borderRadius: 14,
    backgroundColor: T.red,
  },
  nowDot: {
    width: 14, height: 14, borderRadius: 14,
    backgroundColor: T.red,
  },
  nowLine: {
    flex: 1,
    height: 2,
    backgroundColor: T.red,
    borderRadius: 2,
    marginRight: 18,
  },

  // Empty
  emptyWrap: { flexGrow: 1, justifyContent: "center" },
  empty: { padding: 60, alignItems: "center" },
  emptyIconWrap: {
    width: 64, height: 64, borderRadius: 32,
    backgroundColor: T.surfaceAlt,
    alignItems: "center",
    justifyContent: "center",
    marginBottom: 16,
  },
  emptyTitle: { fontSize: 16, fontWeight: "600", color: T.ink, marginBottom: 6 },
  emptyBody: { fontSize: 13, color: T.muted, textAlign: "center", lineHeight: 19 },

  // FAB
  fabWrap: {
    position: "absolute",
    left: 16,
    right: 16,
    bottom: 24,
    zIndex: 20,
  },
  fab: {
    width: "100%",
    paddingVertical: 16,
    backgroundColor: T.navy,
    borderRadius: R.fab,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 8,
    ...Shadow.cta,
  },
  fabPressed: { transform: [{ scale: 0.985 }] },
  fabText: { color: "#fff", fontSize: 15, fontWeight: "600" },

  center: { flex: 1, alignItems: "center", justifyContent: "center", padding: 24 },
});
