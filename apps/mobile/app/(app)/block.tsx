import { useEffect, useRef, useState } from "react";
import {
  View,
  Text,
  Pressable,
  StyleSheet,
  ActivityIndicator,
  Alert,
  ScrollView,
  Animated,
  Easing,
} from "react-native";
import { T, R, Shadow } from "../../lib/theme";
import { supabase } from "../../lib/supabase";

const DURATIONS = [15, 30, 45, 60, 90, 120] as const;

const REASONS = [
  { id: "walkin" as const, label: "Anlık müşteri", meta: "Şu anda gelen müşteri için" },
  { id: "break" as const, label: "Mola", meta: "Kahve / dinlenme arası" },
  { id: "personal" as const, label: "Kişisel", meta: "Telefon, evrak vs." },
];

const TZ = "Europe/Istanbul";

function fmtNow(d: Date): string {
  return d.toLocaleTimeString("tr-TR", {
    hour: "2-digit",
    minute: "2-digit",
    timeZone: TZ,
  });
}

export default function BlockScreen() {
  const [dur, setDur] = useState<number>(30);
  const [reason, setReason] = useState<"walkin" | "break" | "personal">("break");
  const [loading, setLoading] = useState(false);
  const [now, setNow] = useState<Date>(() => new Date());

  useEffect(() => {
    const id = setInterval(() => setNow(new Date()), 30_000);
    return () => clearInterval(id);
  }, []);

  async function insertBlock(staffId: string) {
    const { error } = await supabase.functions.invoke("create-manual-block", {
      body: {
        staff_id: staffId,
        duration_min: dur,
        reason,
      },
    });

    if (error) {
      let message = error.message;
      const response = (error as { context?: Response }).context;
      if (response) {
        try {
          const payload = await response.json() as { error?: string };
          if (payload.error) message = payload.error;
        } catch {
          // Keep the SDK error message if the response body is unavailable.
        }
      }
      Alert.alert(message.includes("zaten") ? "Çakışma" : "Hata", message);
      return;
    }

    Alert.alert("Takvim kapatıldı", `${dur} dakika kapalı görünecek.`);
  }

  async function handleBlock() {
    setLoading(true);
    try {
      const {
        data: { user },
      } = await supabase.auth.getUser();
      if (!user) throw new Error("Oturum bulunamadı");

      const { data: staff } = await supabase
        .from("staff")
        .select("id")
        .eq("user_id", user.id)
        .single();

      if (!staff) throw new Error("Personel profili bulunamadı");

      await insertBlock(staff.id);
    } catch (err) {
      Alert.alert("Hata", (err as Error).message);
    } finally {
      setLoading(false);
    }
  }

  const reasonObj = REASONS.find((r) => r.id === reason)!;

  return (
    <View style={styles.root}>
      <ScrollView contentContainerStyle={styles.scrollContent} showsVerticalScrollIndicator={false}>
        <Text style={styles.eyebrow}>BLOK EKLE</Text>
        <Text style={styles.title}>Takvimi Kapat</Text>
        <Text style={styles.lead}>Şu andan itibaren seçtiğin süre boyunca takvim kapalı görünür.</Text>

        <NowBadge now={now} />

        <SectionTitle>Süre</SectionTitle>
        <View style={styles.durGrid}>
          {DURATIONS.map((d) => {
            const sel = d === dur;
            return (
              <Pressable
                key={d}
                onPress={() => setDur(d)}
                style={({ pressed }) => [
                  styles.durChip,
                  sel && styles.durChipSel,
                  pressed && { transform: [{ scale: 0.985 }] },
                ]}
              >
                <Text style={[styles.durNum, sel && styles.durNumSel]}>{d}</Text>
                <Text style={styles.durMin}>dakika</Text>
              </Pressable>
            );
          })}
        </View>

        <SectionTitle>Sebep</SectionTitle>
        <View style={styles.reasonList}>
          {REASONS.map((r) => {
            const sel = r.id === reason;
            return (
              <Pressable
                key={r.id}
                onPress={() => setReason(r.id)}
                style={({ pressed }) => [
                  styles.reasonRow,
                  sel && styles.reasonRowSel,
                  pressed && { transform: [{ scale: 0.985 }] },
                ]}
              >
                <View style={[styles.radio, sel && styles.radioSel]}>
                  {sel && <View style={styles.radioInner} />}
                </View>
                <View style={{ flex: 1 }}>
                  <Text style={[styles.reasonLabel, sel && { color: T.brand600 }]}>{r.label}</Text>
                  <Text style={styles.reasonMeta}>{r.meta}</Text>
                </View>
              </Pressable>
            );
          })}
        </View>

        <SectionTitle>Önizleme</SectionTitle>
        <View style={styles.preview}>
          <Text style={styles.previewText}>
            {reasonObj.label.toUpperCase()} · {dur}DK
          </Text>
        </View>
      </ScrollView>

      <View style={styles.fabWrap} pointerEvents="box-none">
        <Pressable
          style={({ pressed }) => [styles.fab, pressed && { transform: [{ scale: 0.985 }] }]}
          onPress={handleBlock}
          disabled={loading}
        >
          {loading ? <ActivityIndicator color="#fff" /> : <Text style={styles.fabText}>Kapat</Text>}
        </Pressable>
      </View>
    </View>
  );
}

function SectionTitle({ children }: { children: string }) {
  return <Text style={styles.sectionTitle}>{children}</Text>;
}

function NowBadge({ now }: { now: Date }) {
  const pulse = useRef(new Animated.Value(0)).current;

  useEffect(() => {
    const loop = Animated.loop(
      Animated.timing(pulse, {
        toValue: 1,
        duration: 1600,
        easing: Easing.out(Easing.ease),
        useNativeDriver: true,
      }),
    );
    loop.start();
    return () => loop.stop();
  }, [pulse]);

  const haloScale = pulse.interpolate({ inputRange: [0, 1], outputRange: [1, 2.7] });
  const haloOpacity = pulse.interpolate({ inputRange: [0, 0.7, 1], outputRange: [0.55, 0, 0] });

  return (
    <View style={styles.nowBadge}>
      <View style={styles.nowDotWrap}>
        <Animated.View
          style={[styles.nowHalo, { transform: [{ scale: haloScale }], opacity: haloOpacity }]}
        />
        <View style={styles.nowDot} />
      </View>
      <View style={{ flex: 1 }}>
        <Text style={styles.nowLabel}>ŞU AN · {fmtNow(now)}</Text>
        <Text style={styles.nowSub}>Blok başlangıç saati otomatik atanır.</Text>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: T.bg },
  scrollContent: { paddingTop: 64, paddingHorizontal: 20, paddingBottom: 120 },

  eyebrow: {
    fontSize: 11,
    fontWeight: "600",
    letterSpacing: 1.4,
    textTransform: "uppercase",
    color: T.fg3,
    marginBottom: 6,
  },
  title: { fontSize: 30, fontWeight: "700", letterSpacing: -0.5, color: T.fg1, marginBottom: 8 },
  lead: { fontSize: 14, color: T.fg3, lineHeight: 21 },

  nowBadge: {
    marginTop: 20,
    paddingVertical: 12,
    paddingHorizontal: 14,
    backgroundColor: T.mint100,
    borderWidth: 1,
    borderColor: T.mint100,
    borderRadius: R.md,
    flexDirection: "row",
    alignItems: "center",
    gap: 12,
  },
  nowDotWrap: { width: 14, height: 14, alignItems: "center", justifyContent: "center" },
  nowHalo: { position: "absolute", width: 14, height: 14, borderRadius: 14, backgroundColor: T.positive },
  nowDot: { width: 14, height: 14, borderRadius: 14, backgroundColor: T.positive },
  nowLabel: { fontSize: 12, fontWeight: "700", color: T.positive, letterSpacing: 0.4 },
  nowSub: { fontSize: 12, color: T.fg3, marginTop: 2 },

  sectionTitle: {
    marginTop: 22,
    marginBottom: 10,
    fontSize: 11,
    fontWeight: "600",
    color: T.fg3,
    textTransform: "uppercase",
    letterSpacing: 0.6,
  },

  durGrid: { flexDirection: "row", flexWrap: "wrap", gap: 8 },
  durChip: {
    width: "31.5%",
    paddingVertical: 14,
    backgroundColor: T.bgElevated,
    borderWidth: 1.5,
    borderColor: T.border,
    borderRadius: R.sm,
    alignItems: "center",
  },
  durChipSel: { borderColor: T.brand600, backgroundColor: T.accentTint },
  durNum: { fontSize: 18, fontWeight: "700", color: T.fg1 },
  durNumSel: { color: T.brand600 },
  durMin: { fontSize: 11, color: T.fg3, marginTop: 2 },

  reasonList: { gap: 8 },
  reasonRow: {
    flexDirection: "row",
    alignItems: "center",
    padding: 14,
    backgroundColor: T.bgElevated,
    borderWidth: 1.5,
    borderColor: T.border,
    borderRadius: R.md,
    gap: 12,
  },
  reasonRowSel: { borderColor: T.brand600, backgroundColor: T.accentTint },
  radio: {
    width: 20,
    height: 20,
    borderRadius: 20,
    borderWidth: 2,
    borderColor: T.slate300,
    alignItems: "center",
    justifyContent: "center",
  },
  radioSel: { borderColor: T.brand600 },
  radioInner: { width: 10, height: 10, borderRadius: 10, backgroundColor: T.brand600 },
  reasonLabel: { fontSize: 14, fontWeight: "600", color: T.fg1 },
  reasonMeta: { fontSize: 12, color: T.fg3, marginTop: 2 },

  preview: {
    paddingVertical: 14,
    paddingHorizontal: 14,
    backgroundColor: T.bgSunken,
    borderWidth: 1,
    borderColor: T.slate300,
    borderStyle: "dashed",
    borderRadius: R.md,
    alignItems: "center",
  },
  previewText: {
    fontSize: 12,
    fontWeight: "700",
    letterSpacing: 2,
    color: T.fg3,
    textTransform: "uppercase",
  },

  fabWrap: { position: "absolute", left: 16, right: 16, bottom: 24 },
  fab: {
    width: "100%",
    paddingVertical: 16,
    backgroundColor: T.brand600,
    borderRadius: R.md,
    alignItems: "center",
    justifyContent: "center",
    ...Shadow.md,
  },
  fabText: { color: "#fff", fontSize: 15, fontWeight: "600" },
});
