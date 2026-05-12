import { useEffect, useState } from "react";
import {
  View,
  Text,
  ScrollView,
  StyleSheet,
  TouchableOpacity,
  ActivityIndicator,
} from "react-native";
import { SafeAreaView, useSafeAreaInsets } from "react-native-safe-area-context";
import { useRouter, useLocalSearchParams } from "expo-router";
import { Ionicons } from "@expo/vector-icons";
import { supabase, SHOP_SLUG } from "../../lib/supabase";
import { T, R, Shadow } from "../../lib/theme";

interface Barber {
  id: string;
  name: string;
  role: "admin" | "staff";
}

function paramValue(value: string | string[] | undefined): string {
  return Array.isArray(value) ? value[0] ?? "" : value ?? "";
}

function initials(name: string) {
  return name.split(/\s+/).filter(Boolean).slice(0, 2).map((w) => w[0]!.toUpperCase()).join("");
}

function BarberCard({
  id,
  name,
  subtitle,
  isAny,
  onSelect,
}: {
  id: string;
  name: string;
  subtitle: string;
  isAny?: boolean;
  onSelect: () => void;
}) {
  return (
    <TouchableOpacity
      style={[styles.card, isAny && styles.cardAny]}
      onPress={onSelect}
      activeOpacity={0.82}
    >
      <View style={[styles.avatar, isAny && styles.avatarAny]}>
        {isAny
          ? <Ionicons name="people-outline" size={20} color={T.navy} />
          : <Text style={styles.avatarText}>{initials(name)}</Text>
        }
      </View>
      <View style={styles.info}>
        <Text style={[styles.name, isAny && styles.nameAny]}>{name}</Text>
        <Text style={styles.subtitle}>{subtitle}</Text>
      </View>
      <Ionicons name="chevron-forward" size={16} color={T.mutedAlt} />
    </TouchableOpacity>
  );
}

export default function Step2Barber() {
  const params = useLocalSearchParams<{ sid: string; sname: string; sdur: string; sprice: string }>();
  const [barbers, setBarbers] = useState<Barber[]>([]);
  const [loading, setLoading] = useState(true);
  const router = useRouter();
  const insets = useSafeAreaInsets();

  useEffect(() => {
    (async () => {
      const { data: shop } = await supabase
        .from("shops").select("id").eq("slug", SHOP_SLUG).single();
      if (!shop) { setLoading(false); return; }

      const { data } = await supabase
        .from("staff")
        .select("id, name, role")
        .eq("shop_id", shop.id)
        .eq("is_active", true)
        .order("created_at");
      setBarbers(data ?? []);
      setLoading(false);
    })();
  }, []);

  function go(bid: string, bname: string) {
    const bookingParams = {
      sid: paramValue(params.sid),
      sname: paramValue(params.sname),
      sdur: paramValue(params.sdur),
      sprice: paramValue(params.sprice),
    };

    router.push({
      pathname: "/booking/step3-slot",
      params: { ...bookingParams, bid, bname },
    });
  }

  return (
    <SafeAreaView style={styles.safe} edges={["top"]}>
      <View style={styles.header}>
        <TouchableOpacity style={styles.backBtn} onPress={() => router.back()} activeOpacity={0.7}>
          <Ionicons name="arrow-back" size={22} color={T.ink} />
        </TouchableOpacity>
        <View style={styles.headerCenter}>
          <Text style={styles.headerTitle}>Usta Seç</Text>
          <Text style={styles.headerStep}>2 / 4</Text>
        </View>
        <View style={styles.backBtn} />
      </View>
      <View style={styles.progressTrack}>
        <View style={[styles.progressFill, { width: "50%" }]} />
      </View>

      <ScrollView
        contentContainerStyle={[styles.content, { paddingBottom: insets.bottom + 24 }]}
        showsVerticalScrollIndicator={false}
      >
        {/* Seçilen hizmet özeti */}
        <View style={styles.breadcrumb}>
          <Ionicons name="cut-outline" size={13} color={T.blue} />
          <Text style={styles.breadcrumbText}>
            {params.sname} · {params.sdur} dk
          </Text>
        </View>

        <Text style={styles.question}>Hangi usta ile görüşmek istersiniz?</Text>

        {/* "Fark Etmez" seçeneği — her zaman ilk */}
        <BarberCard
          id="any"
          name="Fark Etmez"
          subtitle="İlk müsait ustaya bağlanırsınız"
          isAny
          onSelect={() => go("any", "Fark Etmez")}
        />

        {loading ? (
          <ActivityIndicator color={T.navy} style={{ marginTop: 16 }} />
        ) : (
          barbers.map((b) => (
            <BarberCard
              key={b.id}
              id={b.id}
              name={b.name}
              subtitle={b.role === "admin" ? "Dukkan sahibi" : "Berber"}
              onSelect={() => go(b.id, b.name)}
            />
          ))
        )}
      </ScrollView>
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

  content: { paddingHorizontal: 20, paddingTop: 24 },

  breadcrumb: {
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
    backgroundColor: T.blueSoft,
    borderRadius: R.pill,
    paddingHorizontal: 12,
    paddingVertical: 6,
    alignSelf: "flex-start",
    marginBottom: 20,
  },
  breadcrumbText: { fontSize: 12, fontWeight: "600", color: T.blue },

  question: {
    fontSize: 20, fontWeight: "700", color: T.ink,
    letterSpacing: -0.3, marginBottom: 16,
  },

  card: {
    flexDirection: "row",
    alignItems: "center",
    backgroundColor: T.surface,
    borderRadius: R.card,
    borderWidth: 1,
    borderColor: T.line,
    paddingHorizontal: 14,
    paddingVertical: 14,
    marginBottom: 10,
    ...Shadow.card,
  },
  cardAny: {
    borderColor: T.navy,
    borderWidth: 1.5,
    backgroundColor: T.blueSoft,
  },
  avatar: {
    width: 40, height: 40, borderRadius: 10,
    backgroundColor: T.surfaceAlt,
    alignItems: "center", justifyContent: "center",
    marginRight: 14,
  },
  avatarAny: { backgroundColor: "#DBEAFE" },
  avatarText: { fontSize: 14, fontWeight: "700", color: T.navy },
  info: { flex: 1 },
  name: { fontSize: 14, fontWeight: "600", color: T.ink, marginBottom: 2 },
  nameAny: { color: T.navy },
  subtitle: { fontSize: 12, fontWeight: "500", color: T.muted },
});
