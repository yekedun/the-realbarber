import { useState } from "react";
import {
  View,
  Text,
  KeyboardAvoidingView,
  Platform,
  Alert,
  StyleSheet,
  TouchableOpacity,
} from "react-native";
import Svg, { Rect, Path, Circle } from "react-native-svg";
import { useRouter } from "expo-router";
import { supabase } from "../../lib/supabase";
import { T, S, Type } from "../../lib/theme";
import { TextField } from "../../components/ds/TextField";
import { Button } from "../../components/ds/Button";

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

export default function LoginScreen() {
  const router = useRouter();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [loading, setLoading] = useState(false);

  async function handleLogin() {
    if (!email || !password) return;
    setLoading(true);
    const { error } = await supabase.auth.signInWithPassword({ email, password });
    if (error) Alert.alert("Giriş Başarısız", error.message);
    setLoading(false);
  }

  return (
    <KeyboardAvoidingView
      style={styles.container}
      behavior={Platform.OS === "ios" ? "padding" : undefined}
    >
      <View style={styles.inner}>
        <View style={styles.mark}>
          <MarkIcon size={48} />
        </View>

        <Text style={styles.eyebrow}>BERBER · DÜKKAN PANELİ</Text>
        <Text style={styles.title}>Giriş Yap</Text>
        <Text style={styles.lead}>
          Randevu panelini açmak için hesabına giriş yap.
        </Text>

        <View style={styles.fields}>
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
            placeholder="••••••••"
            secure
          />
        </View>

        <View style={styles.cta}>
          <Button
            variant="primary"
            size="lg"
            full
            loading={loading}
            disabled={!email || !password}
            onPress={handleLogin}
          >
            Giriş Yap
          </Button>
          <TouchableOpacity
            onPress={() => router.push("/(auth)/register" as any)}
            disabled={loading}
          >
            <Text style={styles.registerText}>
              Hesabın yok mu?{" "}
              <Text style={styles.registerLink}>Kayıt ol</Text>
            </Text>
          </TouchableOpacity>
        </View>
      </View>
    </KeyboardAvoidingView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: T.bgElevated,
  },
  inner: {
    flex: 1,
    paddingHorizontal: S.s5,
    paddingTop: 60,
    paddingBottom: S.s6,
  },
  mark: {
    marginBottom: 28,
  },
  eyebrow: {
    fontSize: 11,
    fontFamily: Type.family,
    fontWeight: Type.weight.semibold,
    letterSpacing: 1.76,
    textTransform: "uppercase",
    color: T.fg3,
    marginBottom: 14,
  },
  title: {
    fontSize: 34,
    fontFamily: Type.family,
    fontWeight: Type.weight.bold,
    letterSpacing: -0.68,
    color: T.fg1,
    marginBottom: 10,
    lineHeight: 37,
  },
  lead: {
    fontSize: 16,
    fontFamily: Type.family,
    color: T.fg2,
    lineHeight: 24,
    marginBottom: 32,
  },
  fields: {
    gap: 14,
  },
  cta: {
    marginTop: "auto",
    gap: 14,
    alignItems: "center",
  },
  registerText: {
    fontSize: 13,
    fontFamily: Type.family,
    color: T.fg3,
    textAlign: "center",
  },
  registerLink: {
    color: T.brand600,
    fontWeight: Type.weight.semibold,
  },
});
