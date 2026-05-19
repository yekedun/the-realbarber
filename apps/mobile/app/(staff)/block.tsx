import { useEffect, useState } from "react";
import {
  View,
  Text,
  Pressable,
  StyleSheet,
  Alert,
  ScrollView,
} from "react-native";
import { UserCheck, Coffee, User } from "lucide-react-native";
import { T, R, Type, Shadow } from "../../lib/theme";
import { OverlineHeader, SectionLabel, Button } from "../../components/ds";

const REASON_ICONS: Record<"walkin" | "break" | "personal", React.ComponentType<{ size: number; color: string }>> = {
  walkin: UserCheck,
  break: Coffee,
  personal: User,
};
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
        <OverlineHeader eyebrow="BLOK EKLE" title="Takvimi Kapat" meta="Şu andan itibaren seçtiğin süre boyunca takvim kapalı görünür." />

        <NowBadge now={now} />

        <SectionLabel>Süre</SectionLabel>
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

        <SectionLabel>Sebep</SectionLabel>
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
                {(() => {
                  const Icon = REASON_ICONS[r.id];
                  return <Icon size={22} color={sel ? "#fff" : T.ink900} />;
                })()}
                <View style={{ flex: 1 }}>
                  <Text style={[styles.reasonLabel, sel && { color: "#fff" }]}>{r.label}</Text>
                  <Text style={styles.reasonMeta}>{r.meta}</Text>
                </View>
              </Pressable>
            );
          })}
        </View>

        <SectionLabel>Önizleme</SectionLabel>
        <View style={styles.preview}>
          <Text style={styles.previewText}>
            {reasonObj.label.toUpperCase()} · {dur}DK
          </Text>
        </View>
      </ScrollView>

      <View style={styles.fabWrap} pointerEvents="box-none">
        <Button variant="primary" size="lg" full loading={loading} onPress={handleBlock}>
          Kapat
        </Button>
      </View>
    </View>
  );
}

function NowBadge({ now }: { now: Date }) {
  return (
    <View style={styles.nowBadge}>
      <Text style={styles.nowLabel}>ŞU AN · {fmtNow(now)}</Text>
      <Text style={styles.nowSub}>Blok başlangıç saati otomatik atanır.</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: T.bg },
  scrollContent: { paddingTop: 64, paddingHorizontal: 20, paddingBottom: 120 },

  nowBadge: {
    marginTop: 20,
    paddingVertical: 12,
    paddingHorizontal: 14,
    backgroundColor: T.bgElevated,
    borderWidth: 1,
    borderColor: T.border,
    borderRadius: R.md,
  },
  nowLabel: { fontFamily: Type.family, fontWeight: Type.weight.bold, fontSize: 12, color: T.fg1, letterSpacing: 0.4 },
  nowSub: { fontFamily: Type.family, fontSize: 12, color: T.fg3, marginTop: 2 },

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
  durChipSel: { borderColor: T.ink900, backgroundColor: T.ink900 },
  durNum: { fontFamily: Type.family, fontWeight: Type.weight.bold, fontSize: 18, color: T.fg1 },
  durNumSel: { color: "#fff" },
  durMin: { fontFamily: Type.family, fontSize: 11, color: T.fg3, marginTop: 2 },

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
  reasonRowSel: { borderColor: T.ink900, backgroundColor: T.ink900 },
  reasonLabel: { fontFamily: Type.family, fontWeight: Type.weight.semibold, fontSize: 14, color: T.fg1 },
  reasonMeta: { fontFamily: Type.family, fontSize: 12, color: T.fg3, marginTop: 2 },

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
    fontFamily: Type.family,
    fontWeight: Type.weight.bold,
    fontSize: 12,
    letterSpacing: 2,
    color: T.fg3,
    textTransform: "uppercase",
  },

  fabWrap: { position: "absolute", left: 16, right: 16, bottom: 24 },
});
