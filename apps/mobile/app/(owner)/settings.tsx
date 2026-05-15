import { useEffect, useState, useCallback } from "react";
import {
  View,
  Text,
  StyleSheet,
  Pressable,
  ActivityIndicator,
  Alert,
  ScrollView,
} from "react-native";
import { Feather } from "@expo/vector-icons";
import { supabase } from "../../lib/supabase";
import { useUserRole } from "../../lib/user-context";
import { T, R, Shadow } from "../../lib/theme";
import {
  generateWidgetToken,
  listWidgetTokens,
  deleteWidgetToken,
} from "../../lib/widget-bridge";
import type { WorkingHours } from "@berber/shared/types";
import { WorkingHoursEditor } from "../../components/WorkingHoursEditor";

interface TokenMeta {
  id: string;
  label: string;
  last_used_at: string | null;
  created_at: string;
}

function fmtDate(iso: string): string {
  return new Date(iso).toLocaleDateString("tr-TR", { day: "numeric", month: "short", year: "numeric" });
}
function shortId(id: string): string {
  return `wgt_${id.slice(0, 4)}…${id.slice(-4)}`;
}
function initials(s: string): string {
  return s.split(/\s+/).filter(Boolean).slice(0, 2).map((x) => x[0]!.toUpperCase()).join("");
}

export default function OwnerSettingsScreen() {
  const { shopId } = useUserRole();
  const [tokens, setTokens]     = useState<TokenMeta[]>([]);
  const [loading, setLoading]   = useState(true);
  const [generating, setGenerating] = useState(false);
  const [account, setAccount]   = useState<{ name: string; email: string }>({ name: "Sahip", email: "" });
  const [commissionEnabled, setCommissionEnabled] = useState(false);
  const [savingCommission, setSavingCommission] = useState(false);
  const [workingHours, setWorkingHours] = useState<WorkingHours | null>(null);

  const loadAccount = useCallback(async () => {
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) return;
    const { data: shop } = await supabase
      .from("shops")
      .select("display_name, commission_enabled, working_hours")
      .or(`owner_user_id.eq.${user.id},owner_id.eq.${user.id}`)
      .single();
    setAccount({ name: shop?.display_name ?? "Dükkan", email: user.email ?? "" });
    setCommissionEnabled(Boolean(shop?.commission_enabled));
    setWorkingHours((shop?.working_hours as unknown as WorkingHours) ?? null);
  }, []);

  const loadTokens = useCallback(async () => {
    try {
      const data = await listWidgetTokens();
      setTokens((data as TokenMeta[]) ?? []);
    } catch (err) {
      Alert.alert("Hata", (err as Error).message);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    loadAccount();
    loadTokens();
  }, [loadAccount, loadTokens]);

  async function handleGenerate() {
    setGenerating(true);
    try {
      const token = await generateWidgetToken();
      Alert.alert("Token Oluşturuldu", `Widget'ınıza otomatik yüklendi.\n\nToken ID: ${token.id.slice(0, 8)}…`);
      await loadTokens();
    } catch (err) {
      Alert.alert("Hata", (err as Error).message);
    } finally {
      setGenerating(false);
    }
  }

  function handleDelete(tokenId: string) {
    Alert.alert("Token sil", "Bu token silinirse widget çalışmayı durduracak.", [
      { text: "İptal", style: "cancel" },
      {
        text: "Sil",
        style: "destructive",
        onPress: async () => {
          try {
            await deleteWidgetToken(tokenId);
            setTokens((prev) => prev.filter((t) => t.id !== tokenId));
          } catch (err) {
            Alert.alert("Hata", (err as Error).message);
          }
        },
      },
    ]);
  }

  function handleSignOut() {
    Alert.alert("Çıkış", "Hesaptan çıkmak istediğine emin misin?", [
      { text: "Vazgeç", style: "cancel" },
      { text: "Çıkış yap", style: "destructive", onPress: () => supabase.auth.signOut() },
    ]);
  }

  async function handleToggleCommission() {
    if (!shopId || savingCommission) return;
    const next = !commissionEnabled;
    setSavingCommission(true);
    setCommissionEnabled(next);
    const { error } = await supabase
      .from("shops")
      .update({ commission_enabled: next })
      .eq("id", shopId);
    if (error) {
      setCommissionEnabled(!next);
      Alert.alert("Hata", error.message);
    }
    setSavingCommission(false);
  }

  return (
    <View style={styles.root}>
      <ScrollView contentContainerStyle={styles.scrollContent} showsVerticalScrollIndicator={false}>
        <Text style={styles.eyebrow}>DÜKKAN AYARLARI</Text>
        <Text style={styles.title}>Ayarlar</Text>
        <Text style={styles.lead}>Widget tokenlarını yönet ve hesabından çıkış yap.</Text>

        <View style={styles.accountCard}>
          <View style={styles.avatar}>
            <Text style={styles.avatarTxt}>{initials(account.name) || "D"}</Text>
          </View>
          <View style={{ flex: 1, minWidth: 0 }}>
            <Text style={styles.accountName} numberOfLines={1}>{account.name}</Text>
            <Text style={styles.accountEmail} numberOfLines={1}>{account.email}</Text>
            <Text style={styles.ownerBadge}>Dükkan Sahibi</Text>
          </View>
        </View>

        <View style={styles.secHead}>
          <Text style={styles.secLabel}>OPERASYON MODÜLLERİ</Text>
          <Text style={styles.secCount}>{commissionEnabled ? "Açık" : "Kapalı"}</Text>
        </View>

        <Pressable
          onPress={handleToggleCommission}
          disabled={savingCommission}
          style={({ pressed }) => [styles.moduleRow, (pressed || savingCommission) && { opacity: 0.85 }]}
        >
          <View style={styles.tokenIcon}>
            <Feather name="percent" size={18} color={T.navy} />
          </View>
          <View style={{ flex: 1, minWidth: 0 }}>
            <Text style={styles.tokenLabel}>Komisyon takibi</Text>
            <Text style={styles.tokenMeta} numberOfLines={2}>
              {commissionEnabled ? "Personel komisyonu ve kazanç raporu açık." : "Randevu akışı değişmez."}
            </Text>
          </View>
          <Text style={[styles.moduleState, commissionEnabled && styles.moduleStateOn]}>
            {commissionEnabled ? "Açık" : "Kapalı"}
          </Text>
        </Pressable>

        <View style={styles.secHead}>
          <Text style={styles.secLabel}>ÇALIŞMA SAATLERİ</Text>
        </View>

        {shopId && workingHours !== null && (
          <WorkingHoursEditor
            shopId={shopId}
            initialHours={workingHours}
          />
        )}

        <View style={styles.secHead}>
          <Text style={styles.secLabel}>WIDGET TOKENLARI</Text>
          <Text style={styles.secCount}>{tokens.length} adet</Text>
        </View>

        <Pressable
          onPress={handleGenerate}
          disabled={generating}
          style={({ pressed }) => [styles.generateBtn, (pressed || generating) && { opacity: 0.85 }]}
        >
          {generating ? (
            <ActivityIndicator color="#fff" />
          ) : (
            <>
              <Feather name="plus" size={16} color="#fff" />
              <Text style={styles.generateText}>Yeni Token Oluştur</Text>
            </>
          )}
        </Pressable>

        {loading ? (
          <ActivityIndicator color={T.navy} style={{ marginTop: 12 }} />
        ) : tokens.length === 0 ? (
          <View style={styles.empty}>
            <Feather name="lock" size={28} color={T.mutedAlt} />
            <Text style={styles.emptyTitle}>Henüz token yok</Text>
          </View>
        ) : (
          <View style={{ gap: 8 }}>
            {tokens.map((t) => (
              <View key={t.id} style={styles.tokenRow}>
                <View style={styles.tokenIcon}>
                  <Feather name="key" size={18} color={T.navy} />
                </View>
                <View style={{ flex: 1, minWidth: 0 }}>
                  <Text style={styles.tokenLabel} numberOfLines={1}>{t.label}</Text>
                  <Text style={styles.tokenMeta} numberOfLines={1}>
                    {shortId(t.id)} · son {t.last_used_at ? fmtDate(t.last_used_at) : fmtDate(t.created_at)}
                  </Text>
                </View>
                <Pressable
                  onPress={() => handleDelete(t.id)}
                  style={({ pressed }) => [styles.deleteBtn, pressed && { opacity: 0.85 }]}
                >
                  <Text style={styles.deleteText}>Sil</Text>
                </Pressable>
              </View>
            ))}
          </View>
        )}

        <Pressable
          style={({ pressed }) => [styles.signOut, pressed && { opacity: 0.9 }]}
          onPress={handleSignOut}
        >
          <Text style={styles.signOutText}>Çıkış yap</Text>
        </Pressable>

        <Text style={styles.version}>Berber Panel · Sahip Ekranı</Text>
      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: T.bg },
  scrollContent: { paddingTop: 64, paddingHorizontal: 20, paddingBottom: 32 },

  eyebrow: { fontSize: 11, fontWeight: "600", letterSpacing: 1.4, textTransform: "uppercase", color: T.red, marginBottom: 6 },
  title: { fontSize: 30, fontWeight: "700", letterSpacing: -0.5, color: T.ink, marginBottom: 8 },
  lead: { fontSize: 14, color: T.muted, lineHeight: 21 },

  accountCard: {
    marginTop: 22, paddingVertical: 14, paddingHorizontal: 14,
    backgroundColor: T.surface, borderWidth: 1, borderColor: T.line,
    borderRadius: R.card, flexDirection: "row", alignItems: "center", gap: 12, ...Shadow.card,
  },
  avatar: { width: 44, height: 44, borderRadius: 12, backgroundColor: T.avatarFrom, alignItems: "center", justifyContent: "center" },
  avatarTxt: { fontSize: 16, fontWeight: "700", color: T.navy },
  accountName: { fontSize: 14, fontWeight: "600", color: T.ink },
  accountEmail: { fontSize: 12, color: T.muted, marginTop: 2 },
  ownerBadge: { fontSize: 10, fontWeight: "600", color: T.navy, marginTop: 3 },

  secHead: { marginTop: 26, marginBottom: 12, flexDirection: "row", alignItems: "baseline", justifyContent: "space-between" },
  secLabel: { fontSize: 11, fontWeight: "600", color: T.muted, letterSpacing: 0.6, textTransform: "uppercase" },
  secCount: { fontSize: 11, color: T.mutedAlt, fontWeight: "500" },

  generateBtn: {
    width: "100%", paddingVertical: 14, backgroundColor: T.navy, borderRadius: R.cta,
    flexDirection: "row", alignItems: "center", justifyContent: "center", gap: 8, marginBottom: 12, ...Shadow.cta,
  },
  generateText: { color: "#fff", fontSize: 14, fontWeight: "600" },

  tokenRow: {
    paddingVertical: 12, paddingHorizontal: 12, backgroundColor: T.surface,
    borderWidth: 1, borderColor: T.line, borderRadius: R.card,
    flexDirection: "row", alignItems: "center", gap: 12, ...Shadow.card,
  },
  tokenIcon: { width: 36, height: 36, borderRadius: 10, backgroundColor: T.surfaceAlt, alignItems: "center", justifyContent: "center" },
  tokenLabel: { fontSize: 14, fontWeight: "600", color: T.ink },
  tokenMeta: { fontSize: 11, color: T.muted, marginTop: 2 },
  moduleRow: {
    paddingVertical: 12, paddingHorizontal: 12, backgroundColor: T.surface,
    borderWidth: 1, borderColor: T.line, borderRadius: R.card,
    flexDirection: "row", alignItems: "center", gap: 12, ...Shadow.card,
  },
  moduleState: { fontSize: 12, fontWeight: "700", color: T.muted },
  moduleStateOn: { color: "#059669" },
  deleteBtn: { paddingVertical: 8, paddingHorizontal: 10, backgroundColor: T.redSoft, borderWidth: 1, borderColor: T.redBorder, borderRadius: R.card },
  deleteText: { fontSize: 12, fontWeight: "600", color: T.red },

  empty: { paddingVertical: 30, alignItems: "center", gap: 8 },
  emptyTitle: { fontSize: 14, color: T.muted },

  signOut: {
    marginTop: 28, paddingVertical: 14, backgroundColor: T.redSoft,
    borderWidth: 1, borderColor: T.redBorder, borderRadius: R.card, alignItems: "center",
  },
  signOutText: { color: T.red, fontSize: 14, fontWeight: "600" },
  version: { marginTop: 18, textAlign: "center", fontSize: 11, color: T.mutedAlt },
});
