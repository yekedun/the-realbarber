import { useEffect, useState, useRef, useCallback } from "react";
import {
  AppState,
  View,
  Text,
  ScrollView,
  FlatList,
  StyleSheet,
  TouchableOpacity,
  ActivityIndicator,
  Alert,
} from "react-native";
import { SafeAreaView, useSafeAreaInsets } from "react-native-safe-area-context";
import { useFocusEffect, useRouter, useLocalSearchParams } from "expo-router";
import { Ionicons } from "@expo/vector-icons";
import { addDays, startOfDay, format } from "date-fns";
import { tr } from "date-fns/locale";
import { supabase, SHOP_SLUG, SUPABASE_URL, SUPABASE_ANON_KEY } from "../../lib/supabase";
import { T, R } from "../../lib/theme";

interface SlotItem {
  starts_at: string;
  ends_at: string;
  available: boolean;
}

interface DayItem {
  date: Date;
  iso: string;
}

function paramValue(value: string | string[] | undefined): string {
  return Array.isArray(value) ? value[0] ?? "" : value ?? "";
}

const TZ = "Europe/Istanbul";
const TODAY = startOfDay(new Date());
const DAYS_AHEAD = 30;

function buildDays(): DayItem[] {
  return Array.from({ length: DAYS_AHEAD }, (_, i) => {
    const d = addDays(TODAY, i);
    return { date: d, iso: format(d, "yyyy-MM-dd") };
  });
}

function fTime(iso: string) {
  return new Intl.DateTimeFormat("tr-TR", {
    hour: "2-digit",
    minute: "2-digit",
    hour12: false,
    timeZone: TZ,
  }).format(new Date(iso));
}

function slotChangeTouchesVisibleStaff(
  payload: { new: Record<string, unknown>; old: Record<string, unknown> },
  staffId: string
) {
  const rows = [payload.new, payload.old];
  return rows.some((row) => {
    const changedStaffId = typeof row.staff_id === "string" ? row.staff_id : "";
    return !staffId || staffId === "any" || changedStaffId === staffId;
  });
}

function DayPill({
  item,
  selected,
  onPress,
}: {
  item: DayItem;
  selected: boolean;
  onPress: () => void;
}) {
  const dayName = format(item.date, "EEE", { locale: tr }).toUpperCase().slice(0, 3);
  const dayNum = format(item.date, "d");
  const isToday = item.iso === format(TODAY, "yyyy-MM-dd");

  return (
    <TouchableOpacity
      style={[styles.dayPill, selected && styles.dayPillSelected]}
      onPress={onPress}
      activeOpacity={0.75}
    >
      <Text style={[styles.dayName, selected && styles.dayNameSelected]}>{dayName}</Text>
      <Text style={[styles.dayNum, selected && styles.dayNumSelected]}>{dayNum}</Text>
      {isToday ? <View style={[styles.todayDot, selected && styles.todayDotSelected]} /> : null}
    </TouchableOpacity>
  );
}

function SlotChip({
  slot,
  selected,
  onPress,
}: {
  slot: SlotItem;
  selected: boolean;
  onPress: () => void;
}) {
  if (!slot.available) {
    return (
      <View style={styles.slotDisabled}>
        <Text style={styles.slotDisabledText}>{fTime(slot.starts_at)}</Text>
      </View>
    );
  }

  return (
    <TouchableOpacity
      style={[styles.slotChip, selected && styles.slotChipSelected]}
      onPress={onPress}
      activeOpacity={0.8}
    >
      <Text style={[styles.slotText, selected && styles.slotTextSelected]}>
        {fTime(slot.starts_at)}
      </Text>
    </TouchableOpacity>
  );
}

export default function Step3Slot() {
  const rawParams = useLocalSearchParams<{
    sid: string;
    sname: string;
    sdur: string;
    sprice: string;
    bid: string;
    bname: string;
  }>();
  const params = {
    sid: paramValue(rawParams.sid),
    sname: paramValue(rawParams.sname),
    sdur: paramValue(rawParams.sdur),
    sprice: paramValue(rawParams.sprice),
    bid: paramValue(rawParams.bid),
    bname: paramValue(rawParams.bname),
  };
  const [days] = useState<DayItem[]>(buildDays);
  const [selectedDay, setSelectedDay] = useState<DayItem>(days[0]!);
  const [slots, setSlots] = useState<SlotItem[]>([]);
  const [slotsLoading, setSlotsLoading] = useState(false);
  const [selectedSlot, setSelectedSlot] = useState<SlotItem | null>(null);
  const reqRef = useRef(0);
  const mountedRef = useRef(true);
  const refetchTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const dayListRef = useRef<FlatList<DayItem>>(null);

  useEffect(() => {
    return () => {
      mountedRef.current = false;
      reqRef.current += 1;
    };
  }, []);

  const fetchSlots = useCallback(
    async (day: DayItem) => {
      if (!SHOP_SLUG || !params.sid || !day.iso) {
        if (!mountedRef.current) return;
        setSlots([]);
        setSelectedSlot(null);
        Alert.alert("Musaitlik Alinamadi", "Dukkan veya hizmet bilgisi eksik. Lutfen hizmet seciminden tekrar deneyin.");
        return;
      }

      if (!mountedRef.current) return;
      setSlotsLoading(true);
      setSlots([]);
      setSelectedSlot(null);
      const id = ++reqRef.current;

      const url = new URL(`${SUPABASE_URL}/functions/v1/get-availability`);
      url.searchParams.set("shop_slug", SHOP_SLUG);
      url.searchParams.set("slug", SHOP_SLUG);
      url.searchParams.set("date", day.iso);
      url.searchParams.set("service_id", params.sid);
      if (params.bid && params.bid !== "any") url.searchParams.set("staff_id", params.bid);

      try {
        const res = await fetch(url.toString(), {
          headers: {
            apikey: SUPABASE_ANON_KEY,
            "Content-Type": "application/json",
          },
        });
        if (!mountedRef.current || id !== reqRef.current) return;

        const data = (await res.json()) as { error?: string; slots?: SlotItem[] };
        if (!mountedRef.current || id !== reqRef.current) return;
        if (!res.ok) {
          Alert.alert("Musaitlik Alinamadi", data.error ?? "Lutfen tekrar deneyin.");
          setSlots([]);
          return;
        }

        setSlots((data.slots ?? []).filter((s) => s.available));
      } catch {
        if (!mountedRef.current || id !== reqRef.current) return;
        Alert.alert("Baglanti Hatasi", "Musaitlik bilgisi alinamadi.");
      } finally {
        if (mountedRef.current && id === reqRef.current) setSlotsLoading(false);
      }
    },
    [params.sid, params.bid]
  );

  useFocusEffect(
    useCallback(() => {
      fetchSlots(selectedDay);
    }, [fetchSlots, selectedDay])
  );

  useEffect(() => {
    const subscription = AppState.addEventListener("change", (state) => {
      if (state === "active") fetchSlots(selectedDay);
    });
    return () => subscription.remove();
  }, [fetchSlots, selectedDay]);

  useEffect(() => {
    const scheduleRefetch = () => {
      if (refetchTimerRef.current) clearTimeout(refetchTimerRef.current);
      refetchTimerRef.current = setTimeout(() => fetchSlots(selectedDay), 350);
    };

    const channel = supabase
      .channel(`customer-slots-${selectedDay.iso}-${params.bid || "any"}`)
      .on(
        "postgres_changes",
        { event: "*", schema: "public", table: "appointment_slots" },
        (payload) => {
          if (slotChangeTouchesVisibleStaff(payload, params.bid)) scheduleRefetch();
        }
      )
      .subscribe();

    return () => {
      if (refetchTimerRef.current) {
        clearTimeout(refetchTimerRef.current);
        refetchTimerRef.current = null;
      }
      supabase.removeChannel(channel);
    };
  }, [fetchSlots, params.bid, selectedDay]);

  function selectDay(day: DayItem, index: number) {
    setSelectedDay(day);
    dayListRef.current?.scrollToIndex({ index, animated: true, viewPosition: 0.3 });
  }

  function proceed() {
    if (!selectedSlot) return;
    router.push({
      pathname: "/booking/step4-confirm",
      params: { ...params, slot: selectedSlot.starts_at },
    });
  }

  const availableCount = slots.length;

  return (
    <SafeAreaView style={styles.safe} edges={["top"]}>
      <View style={styles.header}>
        <TouchableOpacity style={styles.backBtn} onPress={() => router.back()} activeOpacity={0.7}>
          <Ionicons name="arrow-back" size={22} color={T.ink} />
        </TouchableOpacity>
        <View style={styles.headerCenter}>
          <Text style={styles.headerTitle}>Gun & Saat</Text>
          <Text style={styles.headerStep}>3 / 4</Text>
        </View>
        <View style={styles.backBtn} />
      </View>
      <View style={styles.progressTrack}>
        <View style={[styles.progressFill, { width: "75%" }]} />
      </View>

      <View style={styles.breadcrumbRow}>
        <View style={styles.breadcrumb}>
          <Ionicons name="cut-outline" size={12} color={T.blue} />
          <Text style={styles.breadcrumbText}>{params.sname}</Text>
        </View>
        <View style={styles.breadcrumb}>
          <Ionicons name="person-outline" size={12} color={T.blue} />
          <Text style={styles.breadcrumbText}>{params.bname}</Text>
        </View>
      </View>

      <View style={styles.dayStrip}>
        <FlatList
          ref={dayListRef}
          data={days}
          horizontal
          showsHorizontalScrollIndicator={false}
          keyExtractor={(d) => d.iso}
          contentContainerStyle={{ paddingHorizontal: 16, gap: 8 }}
          renderItem={({ item, index }) => (
            <DayPill
              item={item}
              selected={item.iso === selectedDay.iso}
              onPress={() => selectDay(item, index)}
            />
          )}
          getItemLayout={(_, i) => ({ length: 52, offset: (52 + 8) * i, index: i })}
          onScrollToIndexFailed={() => {}}
        />
      </View>

      <ScrollView
        contentContainerStyle={[styles.slotsContent, { paddingBottom: insets.bottom + 100 }]}
        showsVerticalScrollIndicator={false}
      >
        <Text style={styles.sectionTitle}>
          {format(selectedDay.date, "d MMMM yyyy", { locale: tr })}
          {availableCount > 0 ? ` · ${availableCount} uygun saat` : ""}
        </Text>

        {slotsLoading ? (
          <ActivityIndicator color={T.navy} style={{ marginTop: 32 }} />
        ) : slots.length === 0 ? (
          <View style={styles.emptyWrap}>
            <Ionicons name="calendar-outline" size={32} color={T.mutedAlt} />
            <Text style={styles.emptyTitle}>Bu gun icin uygun saat yok</Text>
            <Text style={styles.emptyBody}>Lutfen baska bir gun secin.</Text>
          </View>
        ) : (
          <View style={styles.slotsGrid}>
            {slots.map((s) => (
              <SlotChip
                key={s.starts_at}
                slot={s}
                selected={selectedSlot?.starts_at === s.starts_at}
                onPress={() => setSelectedSlot(s)}
              />
            ))}
          </View>
        )}
      </ScrollView>

      <View style={[styles.ctaBar, { paddingBottom: insets.bottom + 16 }]}>
        <TouchableOpacity
          style={[styles.cta, !selectedSlot && styles.ctaDisabled]}
          onPress={proceed}
          disabled={!selectedSlot}
          activeOpacity={0.88}
        >
          <Text style={styles.ctaText}>
            {selectedSlot ? `${fTime(selectedSlot.starts_at)} secildi · Devam Et →` : "Saat Secin"}
          </Text>
        </TouchableOpacity>
      </View>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safe: { flex: 1, backgroundColor: T.bg },

  header: {
    flexDirection: "row",
    alignItems: "center",
    paddingHorizontal: 16,
    paddingVertical: 12,
    borderBottomWidth: 1,
    borderBottomColor: T.line,
    backgroundColor: T.bg,
  },
  backBtn: { width: 40, height: 40, alignItems: "center", justifyContent: "center" },
  headerCenter: { flex: 1, alignItems: "center" },
  headerTitle: { fontSize: 15, fontWeight: "700", color: T.ink },
  headerStep: { fontSize: 11, fontWeight: "600", color: T.muted, marginTop: 1 },

  progressTrack: { height: 3, backgroundColor: T.line },
  progressFill: { height: 3, backgroundColor: T.navy },

  breadcrumbRow: {
    flexDirection: "row",
    gap: 8,
    paddingHorizontal: 16,
    paddingTop: 12,
    paddingBottom: 4,
  },
  breadcrumb: {
    flexDirection: "row",
    alignItems: "center",
    gap: 5,
    backgroundColor: T.blueSoft,
    borderRadius: R.pill,
    paddingHorizontal: 10,
    paddingVertical: 5,
  },
  breadcrumbText: { fontSize: 12, fontWeight: "600", color: T.blue },

  dayStrip: {
    paddingVertical: 14,
    borderBottomWidth: 1,
    borderBottomColor: T.line,
  },
  dayPill: {
    width: 44,
    height: 66,
    borderRadius: 12,
    alignItems: "center",
    justifyContent: "center",
    paddingVertical: 8,
    backgroundColor: T.surface,
    borderWidth: 1,
    borderColor: T.line,
  },
  dayPillSelected: { backgroundColor: T.navy, borderColor: T.navy },
  dayName: {
    fontSize: 10,
    fontWeight: "600",
    color: T.muted,
    letterSpacing: 0.5,
    textTransform: "uppercase",
    marginBottom: 4,
  },
  dayNameSelected: { color: "rgba(255,255,255,0.7)" },
  dayNum: { fontSize: 20, fontWeight: "700", color: T.ink },
  dayNumSelected: { color: "#fff" },
  todayDot: { width: 5, height: 5, borderRadius: 3, backgroundColor: T.red, marginTop: 4 },
  todayDotSelected: { backgroundColor: "#fff" },

  slotsContent: { paddingHorizontal: 20, paddingTop: 20 },
  sectionTitle: {
    fontSize: 14,
    fontWeight: "600",
    color: T.ink,
    marginBottom: 16,
  },
  slotsGrid: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: 10,
  },
  slotChip: {
    width: "30%",
    paddingVertical: 12,
    borderRadius: R.card,
    borderWidth: 1.5,
    borderColor: T.navy,
    backgroundColor: T.surface,
    alignItems: "center",
  },
  slotChipSelected: { backgroundColor: T.navy, borderColor: T.navy },
  slotText: { fontSize: 14, fontWeight: "600", color: T.navy, fontVariant: ["tabular-nums"] },
  slotTextSelected: { color: "#fff" },
  slotDisabled: {
    width: "30%",
    paddingVertical: 12,
    borderRadius: R.card,
    borderWidth: 1,
    borderColor: T.line,
    backgroundColor: T.surfaceAlt,
    alignItems: "center",
  },
  slotDisabledText: {
    fontSize: 14,
    fontWeight: "500",
    color: T.mutedAlt,
    fontVariant: ["tabular-nums"],
  },

  emptyWrap: { alignItems: "center", paddingTop: 48, gap: 8 },
  emptyTitle: { fontSize: 15, fontWeight: "600", color: T.ink },
  emptyBody: { fontSize: 13, fontWeight: "500", color: T.muted },

  ctaBar: {
    position: "absolute",
    bottom: 0,
    left: 0,
    right: 0,
    paddingHorizontal: 20,
    paddingTop: 16,
    backgroundColor: T.bg,
    borderTopWidth: 1,
    borderTopColor: T.line,
  },
  cta: {
    backgroundColor: T.navy,
    borderRadius: R.cta,
    paddingVertical: 16,
    alignItems: "center",
  },
  ctaDisabled: { opacity: 0.35 },
  ctaText: { fontSize: 15, fontWeight: "700", color: "#fff" },
});
