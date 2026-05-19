/**
 * StaffScheduleModal
 * ─────────────────
 * Dükkan sahibinin veya personelin günlük çalışma saatlerini
 * düzenleyeceği bottom-sheet stili modal.
 *
 * Özellikler:
 * - Haftanın 7 günü toggle (çalışıyor / tatil)
 * - Çalışma saati: work_start / work_end (HH:MM text input)
 * - Mola: break_start / break_end (opsiyonel)
 * - Kaydet / İptal aksiyonları
 * - Supabase upsert (UNIQUE(staff_id, day_of_week) → konflikt yoktur)
 */

import { useEffect, useState, useCallback } from "react";
import {
  View,
  Text,
  StyleSheet,
  Modal,
  Pressable,
  ScrollView,
  TextInput,
  Switch,
  ActivityIndicator,
  Alert,
  KeyboardAvoidingView,
  Platform,
} from "react-native";
import { X, ArrowRight, Save } from "lucide-react-native";
import { supabase } from "../lib/supabase";
import { T, R, Shadow } from "../lib/theme";

// ── Types ─────────────────────────────────────────────────────────────────────

export interface StaffForModal {
  id: string;
  name: string;
}

interface DaySchedule {
  day_of_week: number;
  is_working: boolean;
  work_start: string;  // "HH:MM"
  work_end: string;    // "HH:MM"
  break_start: string; // "" veya "HH:MM"
  break_end: string;   // "" veya "HH:MM"
}

interface StaffScheduleModalProps {
  visible: boolean;
  staff: StaffForModal | null;
  onClose: () => void;
}

// ── Sabitler ─────────────────────────────────────────────────────────────────

const DAY_LABELS = ["Paz", "Pzt", "Sal", "Çar", "Per", "Cum", "Cmt"];
const DAY_LONG   = ["Pazar", "Pazartesi", "Salı", "Çarşamba", "Perşembe", "Cuma", "Cumartesi"];

const DEFAULT_SCHEDULE: Omit<DaySchedule, "day_of_week"> = {
  is_working: true,
  work_start:  "09:00",
  work_end:    "19:00",
  break_start: "",
  break_end:   "",
};

// ── Helpers ───────────────────────────────────────────────────────────────────

function timeOrNull(t: string): string | null {
  return t.match(/^\d{2}:\d{2}$/) ? t : null;
}

function isValidTime(t: string): boolean {
  if (!t) return true; // boş → opsiyonel alan, geçerli
  if (!/^\d{2}:\d{2}$/.test(t)) return false;
  const [h, m] = t.split(":").map(Number);
  return h! >= 0 && h! < 24 && m! >= 0 && m! < 60;
}

// ── Bileşen ───────────────────────────────────────────────────────────────────

export function StaffScheduleModal({ visible, staff, onClose }: StaffScheduleModalProps) {
  const [schedules, setSchedules] = useState<DaySchedule[]>([]);
  const [loading, setLoading]     = useState(false);
  const [saving, setSaving]       = useState(false);
  const [selectedDay, setSelectedDay] = useState<number>(1); // Pazartesi default

  // ── Fetch ──────────────────────────────────────────────────────────────────
  const load = useCallback(async () => {
    if (!staff) return;
    setLoading(true);

    const { data } = await supabase
      .from("staff_schedules")
      .select("day_of_week, is_working, work_start, work_end, break_start, break_end")
      .eq("staff_id", staff.id)
      .order("day_of_week");

    const rows = data ?? [];

    // 7 günün hepsini doldur; DB'de kayıt yoksa default değer kullan
    const map = new Map(rows.map((r) => [r.day_of_week, r]));
    const full: DaySchedule[] = Array.from({ length: 7 }, (_, i) => {
      const row = map.get(i);
      return {
        day_of_week: i,
        is_working:  row?.is_working  ?? DEFAULT_SCHEDULE.is_working,
        work_start:  row?.work_start  ? row.work_start.slice(0, 5)  : DEFAULT_SCHEDULE.work_start,
        work_end:    row?.work_end    ? row.work_end.slice(0, 5)    : DEFAULT_SCHEDULE.work_end,
        break_start: row?.break_start ? row.break_start.slice(0, 5) : DEFAULT_SCHEDULE.break_start,
        break_end:   row?.break_end   ? row.break_end.slice(0, 5)   : DEFAULT_SCHEDULE.break_end,
      };
    });
    setSchedules(full);
    setLoading(false);
  }, [staff]);

  useEffect(() => {
    if (visible && staff) load();
  }, [visible, staff, load]);

  // ── Güncelle ───────────────────────────────────────────────────────────────
  function update<K extends keyof DaySchedule>(day: number, key: K, val: DaySchedule[K]) {
    setSchedules((prev) =>
      prev.map((s) => (s.day_of_week === day ? { ...s, [key]: val } : s))
    );
  }

  // ── Kaydet ────────────────────────────────────────────────────────────────
  async function save() {
    if (!staff) return;

    // Validasyon
    for (const s of schedules) {
      if (!s.is_working) continue;
      if (!isValidTime(s.work_start) || !isValidTime(s.work_end)) {
        Alert.alert("Geçersiz Saat", `${DAY_LONG[s.day_of_week]}: çalışma saati HH:MM formatında olmalı.`);
        return;
      }
      if (s.work_start >= s.work_end) {
        Alert.alert("Geçersiz Aralık", `${DAY_LONG[s.day_of_week]}: açılış kapanıştan önce olmalı.`);
        return;
      }
      if (s.break_start || s.break_end) {
        if (!isValidTime(s.break_start) || !isValidTime(s.break_end)) {
          Alert.alert("Geçersiz Mola", `${DAY_LONG[s.day_of_week]}: mola saati HH:MM formatında olmalı.`);
          return;
        }
        if (s.break_start >= s.break_end) {
          Alert.alert("Geçersiz Mola", `${DAY_LONG[s.day_of_week]}: mola başlangıcı bitişten önce olmalı.`);
          return;
        }
      }
    }

    setSaving(true);
    try {
      const rows = schedules.map((s) => ({
        staff_id:    staff.id,
        day_of_week: s.day_of_week,
        is_working:  s.is_working,
        work_start:  s.is_working ? s.work_start : "09:00",
        work_end:    s.is_working ? s.work_end   : "19:00",
        break_start: s.is_working ? timeOrNull(s.break_start) : null,
        break_end:   s.is_working ? timeOrNull(s.break_end)   : null,
      }));

      const { error: upsertError } = await supabase
        .from("staff_schedules")
        .upsert(rows, { onConflict: "staff_id,day_of_week" });

      if (upsertError) throw upsertError;
      Alert.alert("Kaydedildi", `${staff.name} çalışma saatleri güncellendi.`);
      onClose();
    } catch (err) {
      Alert.alert("Hata", (err as Error).message);
    } finally {
      setSaving(false);
    }
  }

  // ── Render ────────────────────────────────────────────────────────────────
  const cur = schedules.find((s) => s.day_of_week === selectedDay);

  return (
    <Modal visible={visible} animationType="slide" presentationStyle="pageSheet" onRequestClose={onClose}>
      <KeyboardAvoidingView style={{ flex: 1 }} behavior={Platform.OS === "ios" ? "padding" : undefined}>
        <View style={styles.root}>
          {/* Header */}
          <View style={styles.header}>
            <View>
              <Text style={styles.eyebrow}>ÇALIŞMA SAATLERİ</Text>
              <Text style={styles.title}>{staff?.name ?? ""}</Text>
            </View>
            <Pressable onPress={onClose} style={styles.closeBtn}>
              <X size={20} color={T.fg1} />
            </Pressable>
          </View>

          {loading ? (
            <ActivityIndicator color={T.brand600} style={{ marginTop: 60 }} />
          ) : (
            <>
              {/* Gün Seçici */}
              <ScrollView
                horizontal
                showsHorizontalScrollIndicator={false}
                contentContainerStyle={styles.dayPicker}
              >
                {schedules.map((s) => {
                  const active = s.day_of_week === selectedDay;
                  return (
                    <Pressable
                      key={s.day_of_week}
                      onPress={() => setSelectedDay(s.day_of_week)}
                      style={[
                        styles.dayChip,
                        active && styles.dayChipActive,
                        !s.is_working && styles.dayChipOff,
                      ]}
                    >
                      <Text style={[styles.dayChipTxt, active && styles.dayChipTxtActive]}>
                        {DAY_LABELS[s.day_of_week]}
                      </Text>
                      {!s.is_working && (
                        <View style={styles.offDot} />
                      )}
                    </Pressable>
                  );
                })}
              </ScrollView>

              {/* Seçili Günün Detayı */}
              {cur && (
                <ScrollView contentContainerStyle={styles.detail} showsVerticalScrollIndicator={false}>
                  <Text style={styles.dayTitle}>{DAY_LONG[cur.day_of_week]}</Text>

                  {/* Çalışıyor mu toggle */}
                  <View style={styles.row}>
                    <View style={{ flex: 1 }}>
                      <Text style={styles.rowLabel}>Çalışıyor</Text>
                      <Text style={styles.rowSub}>
                        {cur.is_working ? "Bu gün aktif" : "Bu gün tatil / kapalı"}
                      </Text>
                    </View>
                    <Switch
                      value={cur.is_working}
                      onValueChange={(v) => update(cur.day_of_week, "is_working", v)}
                      trackColor={{ false: T.border, true: T.brand600 }}
                      thumbColor="#fff"
                    />
                  </View>

                  {cur.is_working && (
                    <>
                      <View style={styles.divider} />

                      {/* Çalışma Saatleri */}
                      <Text style={styles.sectionLabel}>ÇALIŞMA SAATLERİ</Text>
                      <View style={styles.timeRow}>
                        <TimeField
                          label="Açılış"
                          value={cur.work_start}
                          onChange={(v) => update(cur.day_of_week, "work_start", v)}
                        />
                        <ArrowRight size={16} color={T.fg3} style={{ marginTop: 28 }} />
                        <TimeField
                          label="Kapanış"
                          value={cur.work_end}
                          onChange={(v) => update(cur.day_of_week, "work_end", v)}
                        />
                      </View>

                      <View style={styles.divider} />

                      {/* Mola */}
                      <Text style={styles.sectionLabel}>MOLA (OPSİYONEL)</Text>
                      <View style={styles.timeRow}>
                        <TimeField
                          label="Mola Başlangıç"
                          value={cur.break_start}
                          onChange={(v) => update(cur.day_of_week, "break_start", v)}
                          placeholder="--:--"
                        />
                        <ArrowRight size={16} color={T.fg3} style={{ marginTop: 28 }} />
                        <TimeField
                          label="Mola Bitiş"
                          value={cur.break_end}
                          onChange={(v) => update(cur.day_of_week, "break_end", v)}
                          placeholder="--:--"
                        />
                      </View>
                      <Text style={styles.hint}>
                        Mola saatleri müşteri randevu ekranında otomatik kapalı görünür.
                      </Text>
                    </>
                  )}
                </ScrollView>
              )}

              {/* Kaydet Butonu */}
              <View style={styles.footer}>
                <Pressable
                  onPress={save}
                  disabled={saving}
                  style={({ pressed }) => [styles.saveBtn, (pressed || saving) && { opacity: 0.8 }]}
                >
                  {saving ? (
                    <ActivityIndicator color="#fff" />
                  ) : (
                    <>
                      <Save size={16} color="#fff" />
                      <Text style={styles.saveBtnTxt}>Tüm Günleri Kaydet</Text>
                    </>
                  )}
                </Pressable>
              </View>
            </>
          )}
        </View>
      </KeyboardAvoidingView>
    </Modal>
  );
}

// ── TimeField ─────────────────────────────────────────────────────────────────

function TimeField({
  label,
  value,
  onChange,
  placeholder = "09:00",
}: {
  label: string;
  value: string;
  onChange: (v: string) => void;
  placeholder?: string;
}) {
  const invalid = value !== "" && !isValidTime(value);
  return (
    <View style={{ flex: 1 }}>
      <Text style={tf.label}>{label}</Text>
      <TextInput
        style={[tf.input, invalid && tf.inputErr]}
        value={value}
        onChangeText={onChange}
        placeholder={placeholder}
        placeholderTextColor={T.fg4}
        keyboardType="numeric"
        maxLength={5}
        autoCorrect={false}
      />
    </View>
  );
}

const tf = StyleSheet.create({
  label: { fontSize: 11, fontWeight: "600", color: T.fg3, marginBottom: 6, letterSpacing: 0.3 },
  input: {
    backgroundColor: T.bgElevated,
    borderWidth: 1.5,
    borderColor: T.border,
    borderRadius: R.sm,
    paddingHorizontal: 14,
    paddingVertical: 11,
    fontSize: 16,
    fontWeight: "600",
    color: T.fg1,
    textAlign: "center",
  },
  inputErr: { borderColor: T.coral600 },
});

// ── Styles ────────────────────────────────────────────────────────────────────

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: T.bg },

  header: {
    flexDirection: "row",
    alignItems: "flex-start",
    justifyContent: "space-between",
    paddingTop: 20,
    paddingHorizontal: 20,
    paddingBottom: 16,
    borderBottomWidth: 1,
    borderBottomColor: T.border,
    backgroundColor: T.bgElevated,
    ...Shadow.sm,
  },
  eyebrow: { fontSize: 10, fontWeight: "700", letterSpacing: 1.4, color: T.coral600, textTransform: "uppercase", marginBottom: 4 },
  title: { fontSize: 22, fontWeight: "700", color: T.fg1 },
  closeBtn: { padding: 8, backgroundColor: T.bgSunken, borderRadius: R.md },

  dayPicker: { paddingHorizontal: 20, paddingVertical: 14, gap: 8 },
  dayChip: {
    paddingHorizontal: 14,
    paddingVertical: 8,
    borderRadius: R.md,
    borderWidth: 1.5,
    borderColor: T.border,
    backgroundColor: T.bgElevated,
    alignItems: "center",
    ...Shadow.sm,
  },
  dayChipActive: { backgroundColor: T.brand600, borderColor: T.brand600 },
  dayChipOff:    { opacity: 0.55 },
  dayChipTxt:    { fontSize: 12, fontWeight: "600", color: T.fg1 },
  dayChipTxtActive: { color: "#fff" },
  offDot: { width: 5, height: 5, borderRadius: 3, backgroundColor: T.coral600, marginTop: 3 },

  detail: { paddingHorizontal: 20, paddingTop: 4, paddingBottom: 20 },
  dayTitle: { fontSize: 18, fontWeight: "700", color: T.fg1, marginBottom: 16 },

  row: {
    flexDirection: "row",
    alignItems: "center",
    backgroundColor: T.bgElevated,
    borderWidth: 1,
    borderColor: T.border,
    borderRadius: R.md,
    padding: 14,
    gap: 12,
    ...Shadow.sm,
  },
  rowLabel: { fontSize: 14, fontWeight: "600", color: T.fg1 },
  rowSub:   { fontSize: 12, color: T.fg3, marginTop: 2 },

  divider: { height: 1, backgroundColor: T.border, marginVertical: 16 },

  sectionLabel: {
    fontSize: 10,
    fontWeight: "700",
    letterSpacing: 1.2,
    color: T.fg3,
    textTransform: "uppercase",
    marginBottom: 10,
  },
  timeRow: { flexDirection: "row", gap: 12, alignItems: "flex-end" },
  hint:    { fontSize: 11, color: T.fg4, marginTop: 10, lineHeight: 16 },

  footer: {
    padding: 20,
    paddingBottom: Platform.OS === "ios" ? 34 : 20,
    borderTopWidth: 1,
    borderTopColor: T.border,
    backgroundColor: T.bgElevated,
  },
  saveBtn: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 8,
    backgroundColor: T.brand600,
    borderRadius: R.md,
    paddingVertical: 14,
    ...Shadow.md,
  },
  saveBtnTxt: { color: "#fff", fontSize: 14, fontWeight: "700" },
});
