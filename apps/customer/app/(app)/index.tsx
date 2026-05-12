import { useEffect, useState, useCallback } from "react";
import {
  View,
  Text,
  ScrollView,
  StyleSheet,
  TouchableOpacity,
  ActivityIndicator,
  RefreshControl,
} from "react-native";
import { SafeAreaView, useSafeAreaInsets } from "react-native-safe-area-context";
import { useRouter } from "expo-router";
import { supabase, SHOP_SLUG } from "../../lib/supabase";
import { T, R, Shadow } from "../../lib/theme";

interface Shop {
  id: string;
  display_name: string;
  bio: string | null;
  working_hours: Record<string, { enabled: boolean; open?: string; close?: string }>;
}
interface Service {
  id: string;
  name: string;
  duration_min: number;
  price_cents: number | null;
}

const DAY_ORDER = ["mon", "tue", "wed", "thu", "fri", "sat", "sun"] as const;
const DAY_TR: Record<string, string> = {
  mon: "Pazartesi", tue: "Salı", wed: "Çarşamba",
  thu: "Perşembe", fri: "Cuma", sat: "Cumartesi", sun: "Pazar",
};

function formatPrice(cents: number | null): string {
  if (!cents) return "Fiyat Sor";
  return `₺${Math.round(cents / 100)}`;
}

function WorkingHoursSection({ hours }: { hours: Shop["working_hours"] }) {
  const days = DAY_ORDER.filter((d) => hours[d]?.enabled);
  if (!days.length) return null;
  return (
    <View style={styles.section}>
      <Text style={styles.sectionTitle}>ÇALIŞMA SAATLERİ</Text>
      {days.map((d) => {
        const h = hours[d]!;
        return (
          <View key={d} style={styles.hoursRow}>
            <Text style={styles.hoursDay}>{DAY_TR[d]}</Text>
            <Text style={styles.hoursTime}>{h.open} – {h.close}</Text>
          </View>
        );
      })}
    </View>
  );
}

function ServiceCard({ service }: { service: Service }) {
  return (
    <View style={styles.serviceCard}>
      <View style={styles.serviceLeft}>
        <Text style={styles.serviceName}>{service.name}</Text>
        <Text style={styles.serviceMeta}>{service.duration_min} dakika</Text>
      </View>
      <Text style={styles.servicePrice}>{formatPrice(service.price_cents)}</Text>
    </View>
  );
}

function ShopInitials({ name }: { name: string }) {
  const letters = name.split(/\s+/).filter(Boolean).slice(0, 2).map((w) => w[0]!.toUpperCase()).join("");
  return (
    <View style={styles.shopAvatar}>
      <Text style={styles.shopAvatarText}>{letters}</Text>
    </View>
  );
}

export default function VitrinScreen() {
  const [shop, setShop] = useState<Shop | null>(null);
  const [services, setServices] = useState<Service[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const router = useRouter();
  const insets = useSafeAreaInsets();

  const load = useCallback(async () => {
    const shopRes = await supabase
      .from("shops")
      .select("id, display_name, bio, working_hours")
      .eq("slug", SHOP_SLUG)
      .single();

    if (shopRes.data) setShop(shopRes.data as unknown as Shop);

    const svcQuery = supabase
      .from("services")
      .select("id, name, duration_min, price_cents")
      .eq("is_active", true)
      .order("display_order");
    const svcRes = shopRes.data ? await svcQuery.eq("shop_id", shopRes.data.id) : await svcQuery;
    if (svcRes.data) setServices(svcRes.data);
  }, []);

  useEffect(() => {
    load().finally(() => setLoading(false));
  }, [load]);

  async function onRefresh() {
    setRefreshing(true);
    await load();
    setRefreshing(false);
  }

  if (loading) {
    return (
      <SafeAreaView style={styles.safe}>
        <View style={styles.center}>
          <ActivityIndicator color={T.navy} />
        </View>
      </SafeAreaView>
    );
  }

  return (
    <SafeAreaView style={styles.safe} edges={["top"]}>
      <ScrollView
        contentContainerStyle={[styles.scrollContent, { paddingBottom: 100 + insets.bottom }]}
        refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor={T.navy} />}
        showsVerticalScrollIndicator={false}
      >
        {/* Dükkan Başlığı */}
        <View style={styles.shopHeader}>
          {shop && <ShopInitials name={shop.display_name} />}
          <Text style={styles.eyebrow}>BERBER · MÜŞTERİ UYGULAMASI</Text>
          <Text style={styles.shopName}>{shop?.display_name ?? "—"}</Text>
          {shop?.bio ? <Text style={styles.shopBio}>{shop.bio}</Text> : null}
        </View>

        {/* Çalışma Saatleri */}
        {shop && <WorkingHoursSection hours={shop.working_hours} />}

        {/* Hizmetler */}
        <View style={styles.section}>
          <Text style={styles.sectionTitle}>HİZMETLER</Text>
          {services.length === 0 ? (
            <Text style={styles.empty}>Henüz hizmet eklenmemiş.</Text>
          ) : (
            services.map((s) => <ServiceCard key={s.id} service={s} />)
          )}
        </View>
      </ScrollView>

      {/* Sticky CTA */}
      <View style={[styles.ctaBar, { paddingBottom: insets.bottom + 16 }]}>
        <TouchableOpacity
          style={styles.cta}
          onPress={() => router.push("/booking/step1-service")}
          activeOpacity={0.88}
        >
          <Text style={styles.ctaText}>Randevu Al →</Text>
        </TouchableOpacity>
      </View>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safe: { flex: 1, backgroundColor: T.bg },
  center: { flex: 1, alignItems: "center", justifyContent: "center" },
  scrollContent: { paddingHorizontal: 20, paddingTop: 24 },

  shopHeader: { alignItems: "center", marginBottom: 32 },
  shopAvatar: {
    width: 72,
    height: 72,
    borderRadius: 36,
    backgroundColor: T.blueSoft,
    alignItems: "center",
    justifyContent: "center",
    marginBottom: 16,
  },
  shopAvatarText: { fontSize: 26, fontWeight: "700", color: T.navy },
  eyebrow: {
    fontSize: 11,
    fontWeight: "600",
    color: T.red,
    letterSpacing: 1.4,
    textTransform: "uppercase",
    marginBottom: 8,
  },
  shopName: {
    fontSize: 30,
    fontWeight: "700",
    color: T.ink,
    letterSpacing: -0.5,
    textAlign: "center",
    marginBottom: 8,
  },
  shopBio: {
    fontSize: 14,
    fontWeight: "500",
    color: T.muted,
    textAlign: "center",
    lineHeight: 20,
    paddingHorizontal: 12,
  },

  section: { marginBottom: 28 },
  sectionTitle: {
    fontSize: 11,
    fontWeight: "600",
    color: T.muted,
    letterSpacing: 1.2,
    textTransform: "uppercase",
    marginBottom: 12,
  },

  hoursRow: {
    flexDirection: "row",
    justifyContent: "space-between",
    paddingVertical: 8,
    borderBottomWidth: 1,
    borderBottomColor: T.line,
  },
  hoursDay: { fontSize: 14, fontWeight: "500", color: T.ink },
  hoursTime: { fontSize: 14, fontWeight: "600", color: T.navy, fontVariant: ["tabular-nums"] },

  serviceCard: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    backgroundColor: T.surface,
    borderRadius: R.card,
    borderWidth: 1,
    borderColor: T.line,
    paddingHorizontal: 16,
    paddingVertical: 14,
    marginBottom: 8,
    ...Shadow.card,
  },
  serviceLeft: { flex: 1, marginRight: 12 },
  serviceName: { fontSize: 14, fontWeight: "600", color: T.ink, marginBottom: 3 },
  serviceMeta: { fontSize: 12, fontWeight: "500", color: T.muted },
  servicePrice: { fontSize: 14, fontWeight: "700", color: T.blue },

  empty: { fontSize: 14, color: T.muted, textAlign: "center", paddingVertical: 20 },

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
    justifyContent: "center",
    ...Shadow.cta,
  },
  ctaText: { fontSize: 16, fontWeight: "700", color: "#fff" },
});
