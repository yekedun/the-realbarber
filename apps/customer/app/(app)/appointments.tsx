import { useEffect, useState, useCallback } from "react";
import {
  View,
  Text,
  ScrollView,
  StyleSheet,
  TouchableOpacity,
  ActivityIndicator,
  Alert,
  RefreshControl,
} from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { Ionicons } from "@expo/vector-icons";
import { supabase } from "../../lib/supabase";
import { T, R, Shadow } from "../../lib/theme";

interface Appointment {
  id: string;
  starts_at: string;
  ends_at: string;
  status: string;
  staff: { name: string } | null;
  services: { name: string; duration_min: number } | null;
}

const TZ = "Europe/Istanbul";

function fDate(iso: string) {
  return new Intl.DateTimeFormat("tr-TR", {
    day: "numeric", month: "long", year: "numeric", timeZone: TZ,
  }).format(new Date(iso));
}
function fTime(iso: string) {
  return new Intl.DateTimeFormat("tr-TR", {
    hour: "2-digit", minute: "2-digit", hour12: false, timeZone: TZ,
  }).format(new Date(iso));
}
function fDay(iso: string) {
  return new Intl.DateTimeFormat("tr-TR", {
    weekday: "short", timeZone: TZ,
  }).format(new Date(iso));
}
function initials(name: string) {
  return name.split(/\s+/).filter(Boolean).slice(0, 2).map((w) => w[0]!.toUpperCase()).join("");
}

function UpcomingCard({
  appt,
  onCancel,
  disabled,
}: {
  appt: Appointment;
  onCancel: () => void;
  disabled: boolean;
}) {
  const barber = appt.staff?.name ?? "Usta";
  return (
    <View style={styles.upcomingCard}>
      <View style={styles.upcomingLeft}>
        <View style={styles.avatar}>
          <Text style={styles.avatarText}>{initials(barber)}</Text>
        </View>
        <View style={styles.upcomingInfo}>
          <Text style={styles.upcomingBarber}>{barber}</Text>
          {appt.services && (
            <Text style={styles.upcomingService}>
              {appt.services.name} · {appt.services.duration_min} dk
            </Text>
          )}
          <Text style={styles.upcomingDateTime}>
            {fDay(appt.starts_at)}, {fDate(appt.starts_at)}
            {"\n"}{fTime(appt.starts_at)} – {fTime(appt.ends_at)}
          </Text>
        </View>
      </View>
      <TouchableOpacity
        style={[styles.cancelBtn, disabled && styles.cancelBtnDisabled]}
        onPress={onCancel}
        disabled={disabled}
        activeOpacity={0.8}
      >
        <Text style={styles.cancelText}>İptal</Text>
      </TouchableOpacity>
    </View>
  );
}

function PastCard({ appt }: { appt: Appointment }) {
  const barber = appt.staff?.name ?? "Usta";
  const cancelled = appt.status === "cancelled";
  return (
    <View style={styles.pastRow}>
      <View style={styles.pastLeft}>
        <Text style={[styles.pastBarber, cancelled && styles.pastStrike]}>{barber}</Text>
        <Text style={styles.pastMeta}>
          {appt.services?.name ?? "Hizmet"} · {fDate(appt.starts_at)}
        </Text>
      </View>
      <View style={[styles.check, cancelled && styles.checkCancelled]}>
        <Ionicons name={cancelled ? "close" : "checkmark"} size={11} color={cancelled ? T.red : T.muted} />
      </View>
    </View>
  );
}

function EmptyState({ icon, text }: { icon: string; text: string }) {
  return (
    <View style={styles.emptyWrap}>
      <View style={styles.emptyIcon}>
        <Ionicons name={icon as never} size={26} color={T.mutedAlt} />
      </View>
      <Text style={styles.emptyText}>{text}</Text>
    </View>
  );
}

export default function AppointmentsScreen() {
  const [appointments, setAppointments] = useState<Appointment[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [cancellingIds, setCancellingIds] = useState<Set<string>>(() => new Set());

  const load = useCallback(async () => {
    // RLS policy "appointments_customer_select" otomatik filtreler — ek eq gerekmiyor
    const { data } = await supabase
      .from("appointments")
      .select("id, starts_at, ends_at, status, staff(name), services(name, duration_min)")
      .order("starts_at", { ascending: false }) as unknown as { data: Appointment[] | null };
    setAppointments(data ?? []);
  }, []);

  useEffect(() => {
    load().finally(() => setLoading(false));
  }, [load]);

  async function onRefresh() {
    setRefreshing(true);
    await load();
    setRefreshing(false);
  }

  function setCancelling(apptId: string, cancelling: boolean) {
    setCancellingIds((prev) => {
      const next = new Set(prev);
      if (cancelling) next.add(apptId);
      else next.delete(apptId);
      return next;
    });
  }

  async function readCancelError(error: unknown) {
    const err = error as {
      context?: Response | { error?: string; message?: string; status?: number };
      message?: string;
    };
    const context = err.context;
    if (context instanceof Response) {
      try {
        const body = (await context.clone().json()) as { error?: string; message?: string };
        return body.error ?? body.message ?? err.message ?? "Randevu iptal edilemedi.";
      } catch {
        return err.message ?? "Randevu iptal edilemedi.";
      }
    }
    return context?.error ?? context?.message ?? err.message ?? "Randevu iptal edilemedi.";
  }

  async function handleCancel(apptId: string) {
    if (cancellingIds.has(apptId)) return;

    Alert.alert(
      "Randevuyu İptal Et",
      "Bu randevuyu iptal etmek istediğinizden emin misiniz?",
      [
        { text: "Vazgeç", style: "cancel" },
        {
          text: "İptal Et",
          style: "destructive",
          onPress: async () => {
            setCancelling(apptId, true);
            try {
              const { error } = await supabase.functions.invoke("customer-cancel-appointment", {
                body: { appointment_id: apptId },
              });
              if (error) {
                const message = await readCancelError(error);
                await load();
                Alert.alert("Randevu güncellendi", message);
              } else {
                await load();
              }
            } finally {
              setCancelling(apptId, false);
            }
          },
        },
      ]
    );
  }
  const now = new Date();
  const upcoming = appointments.filter(
    (a) => new Date(a.starts_at) > now && a.status === "confirmed"
  );
  const past = appointments.filter(
    (a) => new Date(a.starts_at) <= now || a.status !== "confirmed"
  );

  return (
    <SafeAreaView style={styles.safe}>
      <ScrollView
        contentContainerStyle={styles.content}
        refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor={T.navy} />}
        showsVerticalScrollIndicator={false}
      >
        <Text style={styles.eyebrow}>RANDEVULARIM</Text>
        <Text style={styles.title}>Randevularım</Text>

        {loading ? (
          <ActivityIndicator color={T.navy} style={{ marginTop: 40 }} />
        ) : (
          <>
            <Text style={styles.sectionLabel}>YAKLAŞANLAR</Text>
            {upcoming.length === 0
              ? <EmptyState icon="calendar-outline" text="Yaklaşan randevunuz yok" />
              : upcoming.map((a) => (
                  <UpcomingCard
                    key={a.id}
                    appt={a}
                    onCancel={() => handleCancel(a.id)}
                    disabled={cancellingIds.has(a.id)}
                  />
                ))
            }

            <View style={styles.divider} />

            <Text style={styles.sectionLabel}>GEÇMİŞ</Text>
            {past.length === 0
              ? <EmptyState icon="time-outline" text="Geçmiş randevu bulunamadı" />
              : past.map((a) => <PastCard key={a.id} appt={a} />)
            }
          </>
        )}
      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safe: { flex: 1, backgroundColor: T.bg },
  content: { paddingHorizontal: 20, paddingTop: 24, paddingBottom: 48 },

  eyebrow: {
    fontSize: 11, fontWeight: "600", color: T.red,
    letterSpacing: 1.4, textTransform: "uppercase", marginBottom: 6,
  },
  title: {
    fontSize: 30, fontWeight: "700", color: T.ink,
    letterSpacing: -0.5, marginBottom: 28,
  },
  sectionLabel: {
    fontSize: 11, fontWeight: "600", color: T.muted,
    letterSpacing: 1.2, textTransform: "uppercase", marginBottom: 12,
  },
  divider: { height: 1, backgroundColor: T.line, marginVertical: 24 },

  upcomingCard: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    backgroundColor: T.surface,
    borderRadius: R.card,
    borderWidth: 1,
    borderColor: T.line,
    paddingHorizontal: 14,
    paddingVertical: 14,
    marginBottom: 10,
    ...Shadow.card,
  },
  upcomingLeft: { flexDirection: "row", alignItems: "flex-start", flex: 1, marginRight: 10 },
  avatar: {
    width: 36, height: 36, borderRadius: 10,
    backgroundColor: T.blueSoft,
    alignItems: "center", justifyContent: "center",
    marginRight: 12, marginTop: 1,
  },
  avatarText: { fontSize: 13, fontWeight: "700", color: T.navy },
  upcomingInfo: { flex: 1 },
  upcomingBarber: { fontSize: 14, fontWeight: "600", color: T.ink, marginBottom: 2 },
  upcomingService: { fontSize: 12, fontWeight: "500", color: T.blue, marginBottom: 4 },
  upcomingDateTime: { fontSize: 12, fontWeight: "500", color: T.muted, lineHeight: 17 },
  cancelBtn: {
    backgroundColor: T.redSoft,
    borderWidth: 1,
    borderColor: T.redBorder,
    borderRadius: R.card,
    paddingHorizontal: 10,
    paddingVertical: 7,
  },
  cancelBtnDisabled: { opacity: 0.5 },
  cancelText: { fontSize: 12, fontWeight: "600", color: T.red },

  pastRow: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    paddingVertical: 11,
    borderBottomWidth: 1,
    borderBottomColor: T.line,
  },
  pastLeft: { flex: 1, marginRight: 10 },
  pastBarber: { fontSize: 14, fontWeight: "500", color: T.ink, marginBottom: 2 },
  pastStrike: { textDecorationLine: "line-through", color: T.mutedAlt },
  pastMeta: { fontSize: 12, fontWeight: "500", color: T.muted },
  check: {
    width: 22, height: 22, borderRadius: 11,
    backgroundColor: T.surfaceAlt,
    borderWidth: 1, borderColor: T.line,
    alignItems: "center", justifyContent: "center",
  },
  checkCancelled: { backgroundColor: T.redSoft, borderColor: T.redBorder },

  emptyWrap: { alignItems: "center", paddingVertical: 28 },
  emptyIcon: {
    width: 56, height: 56, borderRadius: 28,
    backgroundColor: T.surfaceAlt,
    alignItems: "center", justifyContent: "center", marginBottom: 12,
  },
  emptyText: { fontSize: 14, color: T.muted, fontWeight: "500" },
});
