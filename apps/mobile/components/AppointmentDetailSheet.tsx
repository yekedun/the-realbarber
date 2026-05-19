import { useEffect, useRef } from "react";
import {
  View,
  Text,
  Modal,
  StyleSheet,
  Pressable,
  Animated,
  Easing,
  Linking,
} from "react-native";
import { Phone, MessageCircle, Pencil } from "lucide-react-native";
import { T, R, Shadow } from "../lib/theme";

interface Appointment {
  id: string;
  customer_name: string;
  customer_phone: string | null;
  starts_at: string;
  ends_at: string;
  status: string;
  services: { name: string; duration_min: number } | null;
}

const TZ = "Europe/Istanbul";
function fmtHM(iso: string): string {
  return new Date(iso).toLocaleTimeString("tr-TR", {
    hour: "2-digit",
    minute: "2-digit",
    timeZone: TZ,
  });
}
function durMin(start: string, end: string): number {
  return Math.max(0, Math.round((new Date(end).getTime() - new Date(start).getTime()) / 60000));
}

export function AppointmentDetailSheet({
  appt,
  onClose,
  onAction,
}: {
  appt: Appointment | null;
  onClose: () => void;
  onAction: (a: "complete" | "cancel" | "edit") => void;
}) {
  const open = !!appt;
  const ty = useRef(new Animated.Value(1)).current;
  const op = useRef(new Animated.Value(0)).current;

  useEffect(() => {
    if (open) {
      Animated.parallel([
        Animated.timing(ty, { toValue: 0, duration: 280, easing: Easing.bezier(0.4, 0, 0.2, 1), useNativeDriver: true }),
        Animated.timing(op, { toValue: 1, duration: 200, useNativeDriver: true }),
      ]).start();
    } else {
      Animated.parallel([
        Animated.timing(ty, { toValue: 1, duration: 240, easing: Easing.bezier(0.4, 0, 0.2, 1), useNativeDriver: true }),
        Animated.timing(op, { toValue: 0, duration: 180, useNativeDriver: true }),
      ]).start();
    }
  }, [open, ty, op]);

  const a = appt;
  const dur = a ? a.services?.duration_min ?? durMin(a.starts_at, a.ends_at) : 0;

  return (
    <Modal visible={open} transparent animationType="none" onRequestClose={onClose}>
      <Animated.View style={[styles.backdrop, { opacity: op }]}>
        <Pressable style={StyleSheet.absoluteFill} onPress={onClose} />
      </Animated.View>

      <Animated.View
        style={[
          styles.sheet,
          {
            transform: [
              {
                translateY: ty.interpolate({ inputRange: [0, 1], outputRange: [0, 600] }),
              },
            ],
          },
        ]}
      >
        <View style={styles.grabberWrap}>
          <View style={styles.grabber} />
        </View>

        {a && (
          <>
            <View style={styles.head}>
              <Text style={styles.eyebrow}>
                {fmtHM(a.starts_at)} · {dur}DK
              </Text>
              <Text style={styles.name}>{a.customer_name}</Text>
              <Text style={styles.svc}>{a.services?.name ?? "Randevu"}</Text>
            </View>

            <View style={styles.actions}>
              <ActionBtn
                icon="phone"
                label="Ara"
                onPress={() => a.customer_phone && Linking.openURL(`tel:${a.customer_phone}`)}
                disabled={!a.customer_phone}
              />
              <ActionBtn
                icon="message-circle"
                label="Mesaj"
                onPress={() => a.customer_phone && Linking.openURL(`sms:${a.customer_phone}`)}
                disabled={!a.customer_phone}
              />
              <ActionBtn icon="edit-2" label="Düzenle" onPress={() => onAction("edit")} variant="muted" />
            </View>

            <View style={styles.foot}>
              <Pressable style={styles.cancelBtn} onPress={() => onAction("cancel")}>
                <Text style={styles.cancelTxt}>İptal Et</Text>
              </Pressable>
              <Pressable style={styles.doneBtn} onPress={() => onAction("complete")}>
                <Text style={styles.doneTxt}>Tamamlandı</Text>
              </Pressable>
            </View>
          </>
        )}
      </Animated.View>
    </Modal>
  );
}

type IconName = "phone" | "message-circle" | "edit-2";

const ICON_MAP: Record<IconName, typeof Phone> = {
  "phone": Phone,
  "message-circle": MessageCircle,
  "edit-2": Pencil,
};

function ActionBtn({
  icon, label, onPress, variant = "blue", disabled = false,
}: {
  icon: IconName;
  label: string;
  onPress: () => void;
  variant?: "blue" | "muted";
  disabled?: boolean;
}) {
  const bg = variant === "muted" ? T.bgSunken : T.accentTint;
  const tone = variant === "muted" ? T.fg1 : T.brand600;
  const IconComponent = ICON_MAP[icon];
  return (
    <Pressable
      style={[styles.action, { backgroundColor: bg, opacity: disabled ? 0.5 : 1 }]}
      onPress={disabled ? undefined : onPress}
    >
      <IconComponent size={18} color={tone} />
      <Text style={[styles.actionLbl, { color: tone }]}>{label}</Text>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  backdrop: { ...StyleSheet.absoluteFillObject, backgroundColor: "rgba(15,23,42,0.45)" },
  sheet: {
    position: "absolute",
    left: 0, right: 0, bottom: 0,
    backgroundColor: T.bgElevated,
    borderTopLeftRadius: R.lg,
    borderTopRightRadius: R.lg,
    paddingBottom: 24,
    ...Shadow.lg,
  },
  grabberWrap: { alignItems: "center", paddingTop: 10, paddingBottom: 6 },
  grabber: { width: 40, height: 4, borderRadius: 4, backgroundColor: T.border },

  head: { paddingHorizontal: 20, paddingTop: 8, paddingBottom: 4 },
  eyebrow: {
    fontSize: 11,
    fontWeight: "700",
    color: T.brand500,
    letterSpacing: 1.2,
    textTransform: "uppercase",
  },
  name: { fontSize: 24, fontWeight: "700", color: T.fg1, marginTop: 4 },
  svc: { fontSize: 14, color: T.fg3, marginTop: 2 },

  actions: {
    paddingHorizontal: 20,
    paddingTop: 14,
    flexDirection: "row",
    gap: 8,
  },
  action: {
    flex: 1,
    paddingVertical: 12,
    paddingHorizontal: 8,
    borderRadius: R.md,
    alignItems: "center",
    gap: 4,
  },
  actionLbl: { fontSize: 12, fontWeight: "600" },

  foot: {
    paddingHorizontal: 20,
    paddingTop: 14,
    flexDirection: "row",
    gap: 8,
  },
  cancelBtn: {
    flex: 1,
    paddingVertical: 12,
    borderRadius: R.md,
    backgroundColor: T.coral100,
    borderWidth: 1,
    borderColor: T.coral100,
    alignItems: "center",
  },
  cancelTxt: { color: T.coral600, fontSize: 14, fontWeight: "600" },
  doneBtn: {
    flex: 1,
    paddingVertical: 12,
    borderRadius: R.md,
    backgroundColor: T.brand600,
    alignItems: "center",
  },
  doneTxt: { color: "#fff", fontSize: 14, fontWeight: "600" },
});
