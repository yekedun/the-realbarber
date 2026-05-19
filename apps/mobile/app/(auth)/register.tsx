import { useState } from "react";
import {
  View,
  Text,
  TouchableOpacity,
  StyleSheet,
  KeyboardAvoidingView,
  Platform,
  Alert,
  ScrollView,
} from "react-native";
import Svg, { Rect, Path, Circle } from "react-native-svg";
import { useRouter } from "expo-router";
import { supabase } from "../../lib/supabase";
import { T, Type } from "../../lib/theme";
import { TextField } from "../../components/ds/TextField";
import { Button } from "../../components/ds/Button";

function toSlug(name: string): string {
  return name
    .toLowerCase()
    .replace(/[çÇ]/g, "c").replace(/[ğĞ]/g, "g").replace(/[ıİ]/g, "i")
    .replace(/[öÖ]/g, "o").replace(/[şŞ]/g, "s").replace(/[üÜ]/g, "u")
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-|-$/g, "");
}

function MarkIcon({ size = 48 }: { size?: number }) {
  return (
    <Svg width={size} height={size} viewBox="0 0 64 64">
      <Rect width="64" height="64" rx="14" fill={T.ink900} />
      <Path
        d="M23 16 L41 32 L23 48"
        fill="none"
        stroke="#FFFFFF"
        strokeWidth="5"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
      <Circle cx="46" cy="48" r="2.8" fill={T.brand600} />
    </Svg>
  );
}

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
        <View style={styles.markWrap}>
          <MarkIcon size={56} />
        </View>

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
            <TextField
              label="E-posta"
              value={email}
              onChange={setEmail}
              placeholder="berber@dukkan.com"
            />
            <TextField
              label="Şifre"
              value={password}
              onChange={setPassword}
              placeholder="En az 6 karakter"
              secure
            />
            <TextField
              label="Şifre Tekrar"
              value={confirm}
              onChange={setConfirm}
              placeholder="••••••••"
              secure
            />
            <View style={styles.btnWrap}>
              <Button
                variant="primary"
                size="lg"
                full
                disabled={!email || !password || !confirm}
                onPress={goToStep2}
              >
                Devam Et
              </Button>
            </View>
          </>
        ) : (
          <>
            <TextField
              label="Adın Soyadın"
              value={ownerName}
              onChange={setOwnerName}
              placeholder="Ahmet Yılmaz"
            />
            <TextField
              label="Dükkan Adı"
              value={shopName}
              onChange={setShopName}
              placeholder="Ahmet Berber Salonu"
            />
            <View style={styles.btnWrap}>
              <Button
                variant="primary"
                size="lg"
                full
                loading={loading}
                disabled={!ownerName || !shopName}
                onPress={handleRegister}
              >
                Hesabı Oluştur
              </Button>
            </View>
            <View style={styles.backBtnWrap}>
              <Button
                variant="ghost"
                size="md"
                onPress={() => setStep(1)}
              >
                ← Geri
              </Button>
            </View>
          </>
        )}

        <View style={styles.spacer} />

        <TouchableOpacity onPress={() => router.back()} disabled={loading}>
          <Text style={styles.footer}>
            Zaten hesabın var mı?{" "}
            <Text style={styles.footerLink}>Giriş Yap</Text>
          </Text>
        </TouchableOpacity>
      </ScrollView>
    </KeyboardAvoidingView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: T.bgElevated },
  inner: {
    paddingHorizontal: 24,
    paddingTop: 88,
    paddingBottom: 32,
    minHeight: "100%",
  },
  markWrap: { marginBottom: 24 },
  eyebrow: {
    fontFamily: Type.family,
    fontSize: 11,
    fontWeight: Type.weight.semibold,
    letterSpacing: 1.4,
    textTransform: "uppercase",
    color: T.fg3,
    marginBottom: 6,
  },
  title: {
    fontFamily: Type.family,
    fontSize: 30,
    fontWeight: Type.weight.bold,
    letterSpacing: -0.5,
    color: T.fg1,
    marginBottom: 8,
  },
  lead: {
    fontFamily: Type.family,
    fontSize: 14,
    fontWeight: Type.weight.regular,
    color: T.fg3,
    lineHeight: 21,
    marginBottom: 20,
  },
  stepRow: { flexDirection: "row", alignItems: "center", marginBottom: 24 },
  stepDot: { width: 10, height: 10, borderRadius: 5, backgroundColor: T.border },
  stepDotActive: { backgroundColor: T.brand600 },
  stepLine: { flex: 1, height: 2, backgroundColor: T.border, marginHorizontal: 6 },
  stepLineActive: { backgroundColor: T.brand600 },
  btnWrap: { marginTop: 8 },
  backBtnWrap: { marginTop: 4, alignItems: "center" },
  spacer: { flex: 1, minHeight: 24 },
  footer: {
    fontFamily: Type.family,
    textAlign: "center",
    fontSize: 13,
    fontWeight: Type.weight.regular,
    color: T.fg3,
    paddingBottom: 16,
  },
  footerLink: {
    fontFamily: Type.family,
    color: T.brand600,
    fontWeight: Type.weight.semibold,
  },
});
