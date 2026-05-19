import { useState } from "react";
import {
  View,
  Text,
  TextInput,
  TouchableOpacity,
  StyleSheet,
  KeyboardAvoidingView,
  Platform,
  ActivityIndicator,
  Alert,
  ScrollView,
} from "react-native";
import { useRouter } from "expo-router";
import { supabase } from "../../lib/supabase";
import { T, R, Shadow } from "../../lib/theme";

function toSlug(name: string): string {
  return name
    .toLowerCase()
    .replace(/[çÇ]/g, "c").replace(/[ğĞ]/g, "g").replace(/[ıİ]/g, "i")
    .replace(/[öÖ]/g, "o").replace(/[şŞ]/g, "s").replace(/[üÜ]/g, "u")
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-|-$/g, "");
}

function BrandMark() {
  return (
    <View style={brandStyles.outer}>
      {[0, 1, 2, 3, 4].map((i) => (
        <View
          key={i}
          style={[brandStyles.stripe, { left: -20 + i * 14, transform: [{ rotate: "135deg" }] }]}
        />
      ))}
    </View>
  );
}

const brandStyles = StyleSheet.create({
  outer: {
    width: 56,
    height: 56,
    borderRadius: 14,
    backgroundColor: T.brand600,
    overflow: "hidden",
    marginBottom: 24,
    position: "relative",
    ...Shadow.md,
  },
  stripe: {
    position: "absolute",
    top: -20,
    width: 4,
    height: 96,
    backgroundColor: "rgba(220,38,38,0.85)",
  },
});

export default function RegisterScreen() {
  const router = useRouter();
  const [step, setStep] = useState<1 | 2>(1);
  const [loading, setLoading] = useState(false);

  // Step 1
  const [email, setEmail]           = useState("");
  const [password, setPassword]     = useState("");
  const [confirm, setConfirm]       = useState("");

  // Step 2
  const [ownerName, setOwnerName]   = useState("");
  const [shopName, setShopName]     = useState("");

  function goToStep2() {
    if (!email || !password || !confirm) return;
    if (password.length < 6) {
      Alert.alert("Şifre Kısa", "Şifre en az 6 karakter olmalı.");
      return;
    }
    if (password !== confirm) {
      Alert.alert("Şifreler Uyuşmuyor", "Şifre ve tekrar aynı olmalı.");
      return;
    }
    setStep(2);
  }

  async function handleRegister() {
    const nameT = ownerName.trim();
    const shopT = shopName.trim();
    if (nameT.length < 2 || shopT.length < 2) {
      Alert.alert("Eksik Bilgi", "Ad ve dükkan adı en az 2 karakter olmalı.");
      return;
    }

    setLoading(true);
    try {
      // 1. Auth user oluştur
      const { data: authData, error: signUpError } = await supabase.auth.signUp({
        email: email.trim().toLowerCase(),
        password,
      });
      if (signUpError) throw signUpError;
      const user = authData.user;
      if (!user) throw new Error("Kullanıcı oluşturulamadı.");

      // 2. Slug üret (benzersizlik için 23505 çakışmasında 3 kez suffix dene)
      const baseSlug = toSlug(shopT) || "dukkan";
      let createdShopId: string | null = null;
      let lastError: unknown = null;
      for (let attempt = 0; attempt < 3 && !createdShopId; attempt++) {
        const slug = attempt === 0
          ? baseSlug
          : `${baseSlug}-${Math.floor(Math.random() * 9000) + 1000}`;
        const { data: shop, error: shopError } = await supabase
          .from("shops")
          .insert({ owner_user_id: user.id, display_name: shopT, slug })
          .select("id")
          .single();
        if (shopError) {
          lastError = shopError;
          if (shopError.code === "23505") continue; // slug collision → retry
          throw shopError;
        }
        if (!shop) { lastError = new Error("Dükkan oluşturulamadı."); continue; }
        createdShopId = shop.id;
      }
      if (!createdShopId) throw (lastError as Error) ?? new Error("Dükkan oluşturulamadı.");

      // 3. Owner staff oluştur; başarısız olursa orphan shop'u temizle.
      try {
        await createOwnerStaff(createdShopId, user.id, nameT);
      } catch (staffErr) {
        await supabase.from("shops").delete().eq("id", createdShopId);
        throw staffErr;
      }
      // Auth state change will trigger RouterGuard → owner dashboard
    } catch (err) {
      Alert.alert("Kayıt Başarısız", (err as Error).message);
      setLoading(false);
    }
  }

  async function createOwnerStaff(shopId: string, userId: string, name: string) {
    const { error } = await supabase
      .from("staff")
      .insert({ shop_id: shopId, user_id: userId, name, role: "admin", is_active: true });
    if (error) throw error;
  }

  return (
    <KeyboardAvoidingView
      style={styles.container}
      behavior={Platform.OS === "ios" ? "padding" : undefined}
    >
      <ScrollView
        contentContainerStyle={styles.inner}
        keyboardShouldPersistTaps="handled"
        showsVerticalScrollIndicator={false}
      >
        <BrandMark />

        <Text style={styles.eyebrow}>BERBER · DÜKKAN PANELİ</Text>
        <Text style={styles.title}>Hesap Oluştur</Text>
        <Text style={styles.lead}>
          {step === 1
            ? "Dükkan panelinize erişmek için hesap oluşturun."
            : "Dükkanınız ve adınız hakkında bilgi verin."}
        </Text>

        <View style={styles.stepRow}>
          <View style={[styles.stepDot, step >= 1 && styles.stepDotActive]} />
          <View style={[styles.stepLine, step >= 2 && styles.stepLineActive]} />
          <View style={[styles.stepDot, step >= 2 && styles.stepDotActive]} />
        </View>

        {step === 1 ? (
          <>
            <View style={styles.field}>
              <Text style={styles.label}>E-POSTA</Text>
              <TextInput
                style={styles.input}
                placeholder="berber@dukkan.com"
                placeholderTextColor={T.fg4}
                value={email}
                onChangeText={setEmail}
                autoCapitalize="none"
                keyboardType="email-address"
                autoCorrect={false}
              />
            </View>
            <View style={styles.field}>
              <Text style={styles.label}>ŞİFRE</Text>
              <TextInput
                style={styles.input}
                placeholder="En az 6 karakter"
                placeholderTextColor={T.fg4}
                value={password}
                onChangeText={setPassword}
                secureTextEntry
              />
            </View>
            <View style={styles.field}>
              <Text style={styles.label}>ŞİFRE TEKRAR</Text>
              <TextInput
                style={styles.input}
                placeholder="••••••••"
                placeholderTextColor={T.fg4}
                value={confirm}
                onChangeText={setConfirm}
                secureTextEntry
              />
            </View>
            <TouchableOpacity
              style={[styles.button, (!email || !password || !confirm) && styles.buttonDisabled]}
              onPress={goToStep2}
              disabled={!email || !password || !confirm}
              activeOpacity={0.9}
            >
              <Text style={styles.buttonText}>Devam Et →</Text>
            </TouchableOpacity>
          </>
        ) : (
          <>
            <View style={styles.field}>
              <Text style={styles.label}>ADINI SOYADIN</Text>
              <TextInput
                style={styles.input}
                placeholder="Ahmet Yılmaz"
                placeholderTextColor={T.fg4}
                value={ownerName}
                onChangeText={setOwnerName}
                autoCapitalize="words"
              />
            </View>
            <View style={styles.field}>
              <Text style={styles.label}>DÜKKAN ADI</Text>
              <TextInput
                style={styles.input}
                placeholder="Ahmet Berber Salonu"
                placeholderTextColor={T.fg4}
                value={shopName}
                onChangeText={setShopName}
                autoCapitalize="words"
              />
            </View>
            <TouchableOpacity
              style={[styles.button, (loading || !ownerName || !shopName) && styles.buttonDisabled]}
              onPress={handleRegister}
              disabled={loading || !ownerName || !shopName}
              activeOpacity={0.9}
            >
              {loading
                ? <ActivityIndicator color="#fff" />
                : <Text style={styles.buttonText}>Hesabı Oluştur</Text>
              }
            </TouchableOpacity>
            <TouchableOpacity
              style={styles.backBtn}
              onPress={() => setStep(1)}
              disabled={loading}
            >
              <Text style={styles.backBtnText}>← Geri</Text>
            </TouchableOpacity>
          </>
        )}

        <View style={styles.spacer} />

        <TouchableOpacity onPress={() => router.back()} disabled={loading}>
          <Text style={styles.footer}>
            Zaten hesabın var mı? <Text style={styles.footerLink}>Giriş Yap</Text>
          </Text>
        </TouchableOpacity>
      </ScrollView>
    </KeyboardAvoidingView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: T.bg },
  inner: {
    paddingHorizontal: 24,
    paddingTop: 88,
    paddingBottom: 32,
    minHeight: "100%",
  },
  eyebrow: {
    fontSize: 11,
    fontWeight: "600",
    letterSpacing: 1.4,
    textTransform: "uppercase",
    color: T.coral600,
    marginBottom: 6,
  },
  title: { fontSize: 30, fontWeight: "700", letterSpacing: -0.5, color: T.fg1, marginBottom: 8 },
  lead: { fontSize: 14, color: T.fg3, lineHeight: 21, marginBottom: 20 },
  stepRow: { flexDirection: "row", alignItems: "center", marginBottom: 24 },
  stepDot: { width: 10, height: 10, borderRadius: 5, backgroundColor: T.border },
  stepDotActive: { backgroundColor: T.brand600 },
  stepLine: { flex: 1, height: 2, backgroundColor: T.border, marginHorizontal: 6 },
  stepLineActive: { backgroundColor: T.brand600 },
  field: { marginBottom: 16 },
  label: {
    fontSize: 11,
    fontWeight: "600",
    letterSpacing: 0.6,
    color: T.fg3,
    textTransform: "uppercase",
    marginBottom: 6,
  },
  input: {
    width: "100%",
    paddingHorizontal: 14,
    paddingVertical: 14,
    backgroundColor: T.bg,
    borderWidth: 1.5,
    borderColor: T.border,
    borderRadius: R.sm,
    fontSize: 14,
    color: T.fg1,
  },
  button: {
    marginTop: 8,
    width: "100%",
    paddingVertical: 16,
    backgroundColor: T.brand600,
    borderRadius: R.md,
    alignItems: "center",
    justifyContent: "center",
    ...Shadow.md,
  },
  buttonDisabled: { opacity: 0.6 },
  buttonText: { color: "#fff", fontWeight: "600", fontSize: 15 },
  backBtn: { marginTop: 12, alignItems: "center", paddingVertical: 8 },
  backBtnText: { fontSize: 14, color: T.fg3, fontWeight: "500" },
  spacer: { flex: 1, minHeight: 24 },
  footer: { textAlign: "center", fontSize: 13, color: T.fg3, paddingBottom: 16 },
  footerLink: { color: T.brand600, fontWeight: "600" },
});
