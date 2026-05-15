import { useEffect, useState, useCallback } from "react";
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  Pressable,
  ActivityIndicator,
  Alert,
  Modal,
  TextInput,
} from "react-native";
import { Feather } from "@expo/vector-icons";
import { supabase } from "../../lib/supabase";
import { useUserRole } from "../../lib/user-context";
import { T, R, Shadow } from "../../lib/theme";
import { StaffScheduleModal } from "../../components/StaffScheduleModal";

interface Staff {
  id: string;
  name: string;
  slug: string | null;
  is_active: boolean;
  user_id: string | null;
  commission_type: "none" | "percentage";
  commission_rate_bps: number | null;
}

interface StaffCommissionConfig {
  staff_id: string;
  commission_type: "none" | "percentage";
  commission_rate_bps: number | null;
}

function initials(s: string): string {
  return s.split(/\s+/).filter(Boolean).slice(0, 2).map((x) => x[0]!.toUpperCase()).join("");
}

function toSlug(name: string): string {
  return name
    .toLowerCase()
    .replace(/[çÇ]/g, "c").replace(/[ğĞ]/g, "g").replace(/[ıİ]/g, "i")
    .replace(/[öÖ]/g, "o").replace(/[şŞ]/g, "s").replace(/[üÜ]/g, "u")
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-|-$/g, "");
}

function isValidSlug(s: string): boolean {
  return /^[a-z0-9]([a-z0-9-]*[a-z0-9])?$/.test(s);
}

export default function TeamScreen() {
  const { shopId } = useUserRole();
  const [staffList, setStaffList] = useState<Staff[]>([]);
  const [loading, setLoading]   = useState(true);
  const [inviting, setInviting] = useState(false);
  const [modalStaff, setModalStaff] = useState<Staff | null>(null);
  const [commissionEnabled, setCommissionEnabled] = useState(false);
  const [commissionStaff, setCommissionStaff] = useState<Staff | null>(null);
  const [commissionInput, setCommissionInput] = useState("");
  const [savingCommission, setSavingCommission] = useState(false);
  const [addStaffVisible, setAddStaffVisible] = useState(false);
  const [newStaffName, setNewStaffName] = useState("");
  const [slugStaff, setSlugStaff] = useState<Staff | null>(null);
  const [slugInput, setSlugInput] = useState("");
  const [savingSlug, setSavingSlug] = useState(false);

  const load = useCallback(async () => {
    if (!shopId) return;
    const { data: shop } = await supabase
      .from("shops")
      .select("commission_enabled")
      .eq("id", shopId)
      .single();
    setCommissionEnabled(Boolean(shop?.commission_enabled));

    const { data } = await supabase
      .from("staff")
      .select("id, name, slug, is_active, user_id")
      .eq("shop_id", shopId)
      .order("created_at");
    let commissionByStaff = new Map<string, StaffCommissionConfig>();
    if (Boolean(shop?.commission_enabled)) {
      const { data: commissionRows, error: commissionError } = await supabase.rpc("get_staff_commission_configs", {
        p_shop_id: shopId,
      });
      if (commissionError) Alert.alert("Hata", commissionError.message);
      commissionByStaff = new Map(
        ((commissionRows as StaffCommissionConfig[] | null) ?? []).map((row) => [row.staff_id, row])
      );
    }
    setStaffList(
      ((data as Omit<Staff, "commission_type" | "commission_rate_bps">[] | null) ?? []).map((staff) => {
        const commission = commissionByStaff.get(staff.id);
        return {
          ...staff,
          commission_type: commission?.commission_type ?? "none",
          commission_rate_bps: commission?.commission_rate_bps ?? null,
        };
      })
    );
    setLoading(false);
  }, [shopId]);

  useEffect(() => { load(); }, [load]);

  async function handleAddStaff(name: string): Promise<boolean> {
    setInviting(true);
    try {
      const baseSlug = toSlug(name);
      // Aynı shop içinde slug çakışması varsa suffix ekle
      const existingSlugs = new Set(staffList.map((s) => s.slug).filter(Boolean));
      let slug = baseSlug;
      let suffix = 2;
      while (slug && existingSlugs.has(slug)) {
        slug = `${baseSlug}-${suffix++}`;
      }
      const { error } = await supabase
        .from("staff")
        .insert({ shop_id: shopId as string, name, slug: slug || null, role: "staff", is_active: true });
      if (error) throw error;
      Alert.alert("Başarılı", `${name} başarıyla eklendi.`);
      await load();
      return true;
    } catch (err) {
      Alert.alert("Hata", (err as Error).message);
      return false;
    } finally {
      setInviting(false);
    }
  }

  async function handleToggleActive(staffMember: Staff) {
    const action = staffMember.is_active ? "pasif" : "aktif";
    Alert.alert(
      "Durumu Değiştir",
      `${staffMember.name} personelini ${action} yap?`,
      [
        { text: "Vazgeç", style: "cancel" },
        {
          text: staffMember.is_active ? "Pasif yap" : "Aktif yap",
          style: staffMember.is_active ? "destructive" : "default",
          onPress: async () => {
            const { error } = await supabase
              .from("staff")
              .update({ is_active: !staffMember.is_active })
              .eq("id", staffMember.id);
            if (error) { Alert.alert("Hata", error.message); return; }
            await load();
          },
        },
      ]
    );
  }

  function openCommissionModal(staffMember: Staff) {
    setCommissionStaff(staffMember);
    setCommissionInput(staffMember.commission_rate_bps != null ? String(staffMember.commission_rate_bps / 100) : "");
  }

  function closeCommissionModal() {
    if (savingCommission) return;
    setCommissionStaff(null);
    setCommissionInput("");
  }

  async function saveCommission() {
    if (!commissionStaff) return;
    const trimmed = commissionInput.trim().replace(",", ".");
    if (!trimmed) {
      await updateCommission(commissionStaff.id, "none", null);
      return;
    }
    const percent = Number(trimmed);
    if (!Number.isFinite(percent) || percent < 0 || percent > 100) {
      Alert.alert("Geçersiz", "0 ile 100 arasında oran gir.");
      return;
    }
    await updateCommission(commissionStaff.id, "percentage", Math.round(percent * 100));
  }

  async function updateCommission(
    staffId: string,
    commissionType: "none" | "percentage",
    commissionRateBps: number | null
  ) {
    setSavingCommission(true);
    const { error } = await supabase.rpc("update_staff_commission_config", {
      p_staff_id: staffId,
      p_commission_type: commissionType,
      p_commission_rate_bps: commissionType === "percentage" ? (commissionRateBps ?? undefined) : undefined,
    });
    if (error) {
      Alert.alert("Hata", error.message);
      setSavingCommission(false);
      return;
    }
    await load();
    setSavingCommission(false);
    setCommissionStaff(null);
    setCommissionInput("");
  }

  function openSlugModal(staffMember: Staff) {
    setSlugStaff(staffMember);
    setSlugInput(staffMember.slug ?? "");
  }

  function closeSlugModal() {
    if (savingSlug) return;
    setSlugStaff(null);
    setSlugInput("");
  }

  async function saveSlug() {
    if (!slugStaff) return;
    const trimmed = slugInput.trim().toLowerCase();

    if (trimmed && !isValidSlug(trimmed)) {
      Alert.alert("Geçersiz slug", "Sadece küçük harf, rakam ve tire (-) kullanılabilir.");
      return;
    }

    // Aynı dükkan içinde başka birine ait mi kontrol et
    const conflict = staffList.find((s) => s.id !== slugStaff.id && s.slug === trimmed);
    if (trimmed && conflict) {
      Alert.alert("Çakışma", `Bu slug zaten ${conflict.name} tarafından kullanılıyor.`);
      return;
    }

    setSavingSlug(true);
    const { error } = await supabase
      .from("staff")
      .update({ slug: trimmed || null })
      .eq("id", slugStaff.id);
    if (error) {
      Alert.alert("Hata", error.message);
      setSavingSlug(false);
      return;
    }
    await load();
    setSavingSlug(false);
    setSlugStaff(null);
    setSlugInput("");
  }

  return (
    <View style={styles.root}>
      <ScrollView contentContainerStyle={styles.scroll} showsVerticalScrollIndicator={false}>
        <Text style={styles.eyebrow}>EKİP YÖNETİMİ</Text>
        <Text style={styles.title}>Ustalar</Text>

        <Pressable
          onPress={() => {
            setNewStaffName("");
            setAddStaffVisible(true);
          }}
          disabled={inviting}
          style={({ pressed }) => [styles.inviteBtn, (pressed || inviting) && { opacity: 0.8 }]}
        >
          {inviting ? (
            <ActivityIndicator color="#fff" />
          ) : (
            <>
              <Feather name="user-plus" size={16} color="#fff" />
              <Text style={styles.inviteBtnTxt}>Personel ekle</Text>
            </>
          )}
        </Pressable>

        {loading ? (
          <ActivityIndicator color={T.navy} style={{ marginTop: 20 }} />
        ) : staffList.length === 0 ? (
          <View style={styles.empty}>
            <Text style={styles.emptyTxt}>Henüz personel yok. Yeni personel ekleyin.</Text>
          </View>
        ) : (
          <View style={{ gap: 10, marginTop: 8 }}>
            {staffList.map((b) => (
              <View key={b.id} style={[styles.staffCard, !b.is_active && styles.inactiveCard]}>
                <View style={[styles.avatar, !b.is_active && { backgroundColor: T.surfaceAlt }]}>
                  <Text style={[styles.avatarTxt, !b.is_active && { color: T.muted }]}>
                    {initials(b.name)}
                  </Text>
                </View>
                <View style={{ flex: 1, minWidth: 0 }}>
                  <Text style={[styles.staffName, !b.is_active && { color: T.muted }]} numberOfLines={1}>
                    {b.name}
                  </Text>
                  <Text style={[styles.statusChip, b.is_active ? styles.activeChip : styles.inactiveChip]}>
                    {b.is_active ? "Aktif" : "Pasif"}
                  </Text>
                  {b.slug ? (
                    <Text style={styles.slugText} numberOfLines={1}>/{b.slug}</Text>
                  ) : (
                    <Text style={styles.slugMissing}>slug yok</Text>
                  )}
                  {commissionEnabled && (
                    <Text style={styles.commissionText}>
                      {b.commission_type === "percentage" && b.commission_rate_bps != null
                        ? `%${b.commission_rate_bps / 100} komisyon`
                        : "Komisyon yok"}
                    </Text>
                  )}
                </View>
                {commissionEnabled && (
                  <Pressable
                    onPress={() => openCommissionModal(b)}
                    style={({ pressed }) => [styles.iconBtn, pressed && { opacity: 0.7 }]}
                    hitSlop={8}
                  >
                    <Feather name="percent" size={18} color={T.navy} />
                  </Pressable>
                )}
                <Pressable
                  onPress={() => openSlugModal(b)}
                  style={({ pressed }) => [styles.iconBtn, pressed && { opacity: 0.7 }]}
                  hitSlop={8}
                >
                  <Feather name="link" size={18} color={b.slug ? T.navy : T.muted} />
                </Pressable>
                <Pressable
                  onPress={() => setModalStaff(b)}
                  style={({ pressed }) => [styles.iconBtn, pressed && { opacity: 0.7 }]}
                  hitSlop={8}
                >
                  <Feather name="clock" size={18} color={T.blue} />
                </Pressable>
                <Pressable
                  onPress={() => handleToggleActive(b)}
                  style={({ pressed }) => [styles.iconBtn, pressed && { opacity: 0.7 }]}
                  hitSlop={8}
                >
                  <Feather name={b.is_active ? "pause-circle" : "play-circle"} size={22} color={b.is_active ? T.muted : T.navy} />
                </Pressable>
              </View>
            ))}
          </View>
        )}
      </ScrollView>

      <StaffScheduleModal
        visible={modalStaff !== null}
        staff={modalStaff}
        onClose={() => setModalStaff(null)}
      />

      {/* Personel Ekle Modalı */}
      <Modal
        visible={addStaffVisible}
        transparent
        animationType="fade"
        onRequestClose={() => { if (!inviting) setAddStaffVisible(false); }}
      >
        <View style={styles.modalBackdrop}>
          <View style={styles.commissionModal}>
            <Text style={styles.modalTitle}>Personel ekle</Text>
            <Text style={styles.modalText}>Randevu alacak usta adını gir.</Text>
            <TextInput
              value={newStaffName}
              onChangeText={setNewStaffName}
              placeholder="Ad Soyad"
              autoCapitalize="words"
              style={styles.commissionInput}
              editable={!inviting}
            />
            <View style={styles.modalActions}>
              <Pressable
                onPress={() => { if (!inviting) setAddStaffVisible(false); }}
                disabled={inviting}
                style={styles.secondaryBtn}
              >
                <Text style={styles.secondaryText}>Vazgeç</Text>
              </Pressable>
              <Pressable
                onPress={async () => {
                  const name = newStaffName.trim();
                  if (name.length < 2) { Alert.alert("Geçersiz", "Geçerli bir ad gir."); return; }
                  const created = await handleAddStaff(name);
                  if (created) { setAddStaffVisible(false); setNewStaffName(""); }
                }}
                disabled={inviting}
                style={({ pressed }) => [styles.primaryBtn, (pressed || inviting) && { opacity: 0.85 }]}
              >
                {inviting ? <ActivityIndicator color="#fff" /> : <Text style={styles.primaryText}>Ekle</Text>}
              </Pressable>
            </View>
          </View>
        </View>
      </Modal>

      {/* Komisyon Modalı */}
      <Modal visible={commissionStaff !== null} transparent animationType="fade" onRequestClose={closeCommissionModal}>
        <View style={styles.modalBackdrop}>
          <View style={styles.commissionModal}>
            <Text style={styles.modalTitle}>Komisyon Oranı</Text>
            <Text style={styles.modalText}>
              {commissionStaff?.name} için yüzde oran gir. Boş bırakırsan komisyon kapanır.
            </Text>
            <TextInput
              value={commissionInput}
              onChangeText={setCommissionInput}
              placeholder="Örn. 50"
              keyboardType="decimal-pad"
              style={styles.commissionInput}
              editable={!savingCommission}
            />
            <View style={styles.modalActions}>
              <Pressable onPress={closeCommissionModal} disabled={savingCommission} style={styles.secondaryBtn}>
                <Text style={styles.secondaryText}>Vazgeç</Text>
              </Pressable>
              <Pressable
                onPress={saveCommission}
                disabled={savingCommission}
                style={({ pressed }) => [styles.primaryBtn, (pressed || savingCommission) && { opacity: 0.85 }]}
              >
                {savingCommission ? <ActivityIndicator color="#fff" /> : <Text style={styles.primaryText}>Kaydet</Text>}
              </Pressable>
            </View>
          </View>
        </View>
      </Modal>

      {/* Slug Düzenleme Modalı */}
      <Modal visible={slugStaff !== null} transparent animationType="fade" onRequestClose={closeSlugModal}>
        <View style={styles.modalBackdrop}>
          <View style={styles.commissionModal}>
            <Text style={styles.modalTitle}>Randevu Linki</Text>
            <Text style={styles.modalText}>
              {slugStaff?.name} için kısa URL parçası gir (sadece harf, rakam, tire). Boş bırakırsan link devre dışı kalır.
            </Text>
            <TextInput
              value={slugInput}
              onChangeText={(v) => setSlugInput(v.toLowerCase().replace(/[^a-z0-9-]/g, ""))}
              placeholder="ahmet-usta"
              autoCapitalize="none"
              autoCorrect={false}
              style={styles.commissionInput}
              editable={!savingSlug}
            />
            {slugInput.length > 0 && (
              <Text style={styles.slugPreview}>
                siraladaki.app/…/u/{slugInput}
              </Text>
            )}
            <View style={styles.modalActions}>
              <Pressable onPress={closeSlugModal} disabled={savingSlug} style={styles.secondaryBtn}>
                <Text style={styles.secondaryText}>Vazgeç</Text>
              </Pressable>
              <Pressable
                onPress={saveSlug}
                disabled={savingSlug}
                style={({ pressed }) => [styles.primaryBtn, (pressed || savingSlug) && { opacity: 0.85 }]}
              >
                {savingSlug ? <ActivityIndicator color="#fff" /> : <Text style={styles.primaryText}>Kaydet</Text>}
              </Pressable>
            </View>
          </View>
        </View>
      </Modal>
    </View>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: T.bg },
  scroll: { paddingTop: 64, paddingHorizontal: 20, paddingBottom: 40 },

  eyebrow: { fontSize: 11, fontWeight: "600", letterSpacing: 1.4, textTransform: "uppercase", color: T.red, marginBottom: 6 },
  title: { fontSize: 30, fontWeight: "700", letterSpacing: -0.5, color: T.ink, marginBottom: 16 },

  inviteBtn: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 8,
    paddingVertical: 14,
    backgroundColor: T.navy,
    borderRadius: R.cta,
    marginBottom: 20,
    ...Shadow.cta,
  },
  inviteBtnTxt: { color: "#fff", fontSize: 14, fontWeight: "600" },

  empty: { paddingTop: 40, alignItems: "center" },
  emptyTxt: { fontSize: 13, color: T.mutedAlt },

  staffCard: {
    flexDirection: "row",
    alignItems: "center",
    gap: 12,
    padding: 12,
    backgroundColor: T.surface,
    borderWidth: 1,
    borderColor: T.line,
    borderRadius: R.card,
    ...Shadow.card,
  },
  inactiveCard: { opacity: 0.65 },
  avatar: {
    width: 44, height: 44, borderRadius: 12,
    backgroundColor: T.avatarFrom,
    alignItems: "center",
    justifyContent: "center",
  },
  avatarTxt: { fontSize: 16, fontWeight: "700", color: T.navy },
  staffName: { fontSize: 14, fontWeight: "600", color: T.ink },
  statusChip: { fontSize: 10, fontWeight: "600", marginTop: 4, alignSelf: "flex-start" },
  activeChip: { color: "#16a34a" },
  inactiveChip: { color: T.muted },
  slugText: { fontSize: 11, color: T.navy, marginTop: 2, fontWeight: "500" },
  slugMissing: { fontSize: 11, color: T.mutedAlt, marginTop: 2 },
  commissionText: { fontSize: 11, color: T.navy, marginTop: 3, fontWeight: "600" },
  slugPreview: { marginTop: 6, fontSize: 11, color: T.muted, fontStyle: "italic" },

  toggleBtn: { padding: 4 },
  iconBtn:   { padding: 4 },
  modalBackdrop: {
    flex: 1,
    backgroundColor: "rgba(15, 23, 42, 0.38)",
    justifyContent: "center",
    padding: 20,
  },
  commissionModal: {
    backgroundColor: T.surface,
    borderRadius: R.card,
    borderWidth: 1,
    borderColor: T.line,
    padding: 16,
    ...Shadow.card,
  },
  modalTitle: { fontSize: 18, fontWeight: "700", color: T.ink },
  modalText: { marginTop: 6, fontSize: 13, lineHeight: 18, color: T.muted },
  commissionInput: {
    marginTop: 14,
    borderWidth: 1,
    borderColor: T.line,
    borderRadius: R.card,
    paddingHorizontal: 12,
    paddingVertical: 10,
    fontSize: 16,
    color: T.ink,
    backgroundColor: T.bg,
  },
  modalActions: { flexDirection: "row", justifyContent: "flex-end", gap: 10, marginTop: 14 },
  secondaryBtn: { paddingHorizontal: 14, paddingVertical: 10, borderRadius: R.card, backgroundColor: T.surfaceAlt },
  secondaryText: { fontSize: 13, fontWeight: "700", color: T.muted },
  primaryBtn: { minWidth: 88, alignItems: "center", paddingHorizontal: 14, paddingVertical: 10, borderRadius: R.card, backgroundColor: T.navy },
  primaryText: { fontSize: 13, fontWeight: "700", color: "#fff" },
});
