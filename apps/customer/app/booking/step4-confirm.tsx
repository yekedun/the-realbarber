import { useState, useEffect, useRef } from "react";
import {
  View,
  Text,
  ScrollView,
  StyleSheet,
  TouchableOpacity,
  ActivityIndicator,
  Alert,
} from "react-native";
import { SafeAreaView, useSafeAreaInsets } from "react-native-safe-area-context";
import { useRouter, useLocalSearchParams } from "expo-router";
import { Ionicons } from "@expo/vector-icons";
import { format } from "date-fns";
import { tr } from "date-fns/locale";
import { supabase, SHOP_SLUG } from "../../lib/supabase";
import { getProfile } from "../../lib/customer-profiles";
import { T, R, Shadow } from "../../lib/theme";

const TZ = "Europe/Istanbul";

function paramValue(value: string | string[] | undefined): string {
  return Array.isArray(value) ? value[0] ?? "" : value ?? "";
}

function fTime(iso: string) {
  return new Intl.DateTimeFormat("tr-TR", {
    hour: "2-digit",
    minute: "2-digit",
    hour12: false,
    timeZone: TZ,
  }).format(new Date(iso));
}

function fDate(iso: string) {
  return format(new Date(iso), "d MMMM yyyy, EEEE", { locale: tr });
}

function formatPrice(cents: number): string {
  return cents === 0 ? "Fiyat sor" : `₺${Math.round(cents / 100)}`;
}

async function readFunctionError(error: unknown) {
  const err = error as {
    context?:
      | Response
      | {
          message?: string;
          error?: string;
          code?: string;
          should_refetch_availability?: boolean;
          status?: number;
        };
    message?: string;
  };
  const context = err.context;
  let parsed:
    | {
        message?: string;
        error?: string;
        code?: string;
        should_refetch_availability?: boolean;
      }
    | null = null;
  let status: number | undefined;

  if (context instanceof Response) {
    status = context.status;
    try {
      parsed = await context.clone().json();
    } catch {
      parsed = null;
    }
  } else if (context) {
    status = context.status;
    parsed = context;
  }

  return {
    message: parsed?.error ?? parsed?.message ?? err.message ?? "Bilinmeyen hata",
    shouldRefetch:
      status === 409 ||
      parsed?.code === "BOOKING_CONFLICT" ||
      parsed?.should_refetch_availability === true,
  };
}

function SummaryRow({
  label,
  value,
  valueColor,
}: {
  label: string;
  value: string;
  valueColor?: string;
}) {
  return (
    <View style={styles.row}>
      <Text style={styles.rowLabel}>{label}</Text>
      <Text style={[styles.rowValue, valueColor ? { color: valueColor } : null]}>{value}</Text>
    </View>
  );
}

export default function Step4Confirm() {
  const rawParams = useLocalSearchParams<{
    sid: string;
    sname: string;
    sdur: string;
    sprice: string;
    bid: string;
    bname: string;
    slot: string;
  }>();
  const params = {
    sid: paramValue(rawParams.sid),
    sname: paramValue(rawParams.sname),
    sdur: paramValue(rawParams.sdur),
    sprice: paramValue(rawParams.sprice),
    bid: paramValue(rawParams.bid),
    bname: paramValue(rawParams.bname),
    slot: paramValue(rawParams.slot),
  };
  const [loading, setLoading] = useState(false);
  const submittingRef = useRef(false);
  const [customerName, setCustomerName] = useState("");
  const [customerPhone, setCustomerPhone] = useState<string | null>(null);
  const router = useRouter();
  const insets = useSafeAreaInsets();

  useEffect(() => {
    (async () => {
      const {
        data: { user },
      } = await supabase.auth.getUser();
      if (!user) return;
      const profile = await getProfile(user.id);
      if (profile) {
        setCustomerName(profile.full_name);
        setCustomerPhone(profile.phone);
      }
    })();
  }, []);

  async function handleConfirm() {
    if (submittingRef.current) return;

    if (!SHOP_SLUG || !params.sid || !params.slot) {
      Alert.alert("Randevu alinamadi", "Dukkan, hizmet veya saat bilgisi eksik. Lutfen hizmet seciminden tekrar deneyin.");
      return;
    }

    if (!customerName) {
      Alert.alert("Hata", "Profil bilgileri yüklenemedi. Lütfen tekrar deneyin.");
      return;
    }

    submittingRef.current = true;
    setLoading(true);
    const { data, error } = await supabase.functions.invoke("customer-book-appointment", {
      body: {
        shop_slug: SHOP_SLUG,
        service_id: params.sid,
        staff_id: params.bid === "any" ? null : params.bid,
        starts_at: params.slot,
        customer_name: customerName,
        customer_phone: customerPhone,
      },
    });
    submittingRef.current = false;
    setLoading(false);

    if (error) {
      const { message, shouldRefetch } = await readFunctionError(error);

      if (shouldRefetch) {
        Alert.alert("Saat doldu", message, [
          {
            text: "Yeni saat seç",
            onPress: () =>
              router.replace({
                pathname: "/booking/step3-slot",
                params: {
                  sid: params.sid,
                  sname: params.sname,
                  sdur: params.sdur,
                  sprice: params.sprice,
                  bid: params.bid,
                  bname: params.bname,
                },
              }),
          },
        ]);
        return;
      }

      Alert.alert("Randevu alınamadı", message);
      return;
    }

    const result = data as {
      appointment_id: string;
      staff_name?: string;
      barber_display_name?: string;
    };
    router.replace({
      pathname: "/booking/success",
      params: {
        sname: params.sname,
        bname: result.staff_name || result.barber_display_name || params.bname,
        slot: params.slot,
        apptId: result.appointment_id,
      },
    });
  }

  return (
    <SafeAreaView style={styles.safe} edges={["top"]}>
      <View style={styles.header}>
        <TouchableOpacity style={styles.backBtn} onPress={() => router.back()} activeOpacity={0.7}>
          <Ionicons name="arrow-back" size={22} color={T.ink} />
        </TouchableOpacity>
        <View style={styles.headerCenter}>
          <Text style={styles.headerTitle}>Yeni Randevu</Text>
          <Text style={styles.headerStep}>3 / 3</Text>
        </View>
        <View style={styles.backBtn} />
      </View>
      <View style={styles.progressTrack}>
        <View style={styles.progressFill} />
      </View>

      <ScrollView
        contentContainerStyle={[styles.content, { paddingBottom: insets.bottom + 100 }]}
        showsVerticalScrollIndicator={false}
      >
        <Text style={styles.eyebrow}>ADIM 3</Text>
        <Text style={styles.title}>Onay</Text>

        <View style={styles.card}>
          <View style={styles.shopRow}>
            <View style={styles.avatar}>
              <Text style={styles.avatarText}>MY</Text>
            </View>
            <View style={styles.shopInfo}>
              <Text style={styles.shopName}>Mert'in Yeri</Text>
              <Text style={styles.shopAddress}>Bağdat Cad. 142, Kadıköy</Text>
            </View>
          </View>

          <SummaryRow label="Servis" value={params.sname} />
          <SummaryRow label="Süre" value={`${params.sdur} dk`} />
          <SummaryRow label="Berber" value={params.bname} />
          <SummaryRow label="Tarih" value={fDate(params.slot)} />
          <SummaryRow label="Saat" value={fTime(params.slot)} />
          <SummaryRow
            label="Toplam"
            value={formatPrice(Number(params.sprice))}
            valueColor={T.navy}
          />
        </View>

        <Text style={styles.sectionTitle}>Müşteri bilgileri</Text>
        <View style={styles.card}>
          <View style={styles.profileRow}>
            <View style={styles.profileAvatar}>
              <Ionicons name="person" size={18} color={T.navy} />
            </View>
            <View style={styles.profileInfo}>
              <Text style={styles.profileName}>{customerName || "—"}</Text>
              {customerPhone ? <Text style={styles.profilePhone}>{customerPhone}</Text> : null}
            </View>
          </View>
        </View>

        <View style={styles.notice}>
          <Text style={styles.noticeText}>
            Randevuyu onayladığınızda berbere bilgi gider. Randevudan 3 saat öncesine kadar
            iptal edebilirsiniz.
          </Text>
        </View>
      </ScrollView>

      <View style={[styles.ctaBar, { paddingBottom: insets.bottom + 16 }]}>
        <TouchableOpacity
          style={[styles.cta, loading && styles.ctaDisabled]}
          onPress={handleConfirm}
          disabled={loading}
          activeOpacity={0.88}
        >
          {loading ? (
            <ActivityIndicator color="#fff" />
          ) : (
            <Text style={styles.ctaText}>Randevuyu onayla</Text>
          )}
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
  headerStep: { fontSize: 11, fontWeight: "600", color: T.navy, marginTop: 1 },
  progressTrack: { height: 4, backgroundColor: T.line },
  progressFill: { height: 4, backgroundColor: T.navy, width: "100%" },
  content: { paddingHorizontal: 20, paddingTop: 20 },
  eyebrow: {
    fontSize: 11,
    fontWeight: "600",
    color: T.red,
    letterSpacing: 1.4,
    textTransform: "uppercase",
    marginBottom: 6,
  },
  title: {
    fontSize: 24,
    fontWeight: "700",
    color: T.ink,
    letterSpacing: -0.3,
    marginBottom: 16,
  },
  card: {
    backgroundColor: T.surface,
    borderRadius: R.card,
    borderWidth: 1,
    borderColor: T.line,
    paddingHorizontal: 16,
    paddingVertical: 14,
    marginBottom: 16,
    ...Shadow.card,
  },
  shopRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 12,
    marginBottom: 10,
  },
  avatar: {
    width: 44,
    height: 44,
    borderRadius: 10,
    backgroundColor: T.blueSoft,
    alignItems: "center",
    justifyContent: "center",
  },
  avatarText: { fontSize: 16, fontWeight: "700", color: T.navy },
  shopInfo: { flex: 1 },
  shopName: { fontSize: 14, fontWeight: "600", color: T.ink },
  shopAddress: { fontSize: 12, color: T.muted, marginTop: 2 },
  row: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    paddingVertical: 10,
    borderBottomWidth: 1,
    borderBottomColor: T.line,
  },
  rowLabel: { fontSize: 13, color: T.muted },
  rowValue: {
    fontSize: 14,
    fontWeight: "600",
    color: T.ink,
    textAlign: "right",
    flexShrink: 1,
    marginLeft: 12,
  },
  sectionTitle: {
    fontSize: 11,
    fontWeight: "600",
    color: T.muted,
    letterSpacing: 0.6,
    textTransform: "uppercase",
    marginBottom: 10,
  },
  profileRow: { flexDirection: "row", alignItems: "center" },
  profileAvatar: {
    width: 40,
    height: 40,
    borderRadius: 10,
    backgroundColor: T.blueSoft,
    alignItems: "center",
    justifyContent: "center",
    marginRight: 14,
  },
  profileInfo: { flex: 1 },
  profileName: { fontSize: 15, fontWeight: "600", color: T.ink },
  profilePhone: { fontSize: 13, fontWeight: "500", color: T.muted, marginTop: 2 },
  notice: {
    padding: 12,
    backgroundColor: T.surfaceAlt,
    borderRadius: R.card,
  },
  noticeText: {
    fontSize: 12,
    color: T.muted,
    lineHeight: 18,
  },
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
    ...Shadow.cta,
  },
  ctaDisabled: { opacity: 0.5, elevation: 0, shadowOpacity: 0 },
  ctaText: { fontSize: 15, fontWeight: "700", color: "#fff" },
});
