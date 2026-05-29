/**
 * M31 · Kayıt Ekranı
 * Source: screen-31-register.html — RegisterScreen()
 *
 * Container: height:'100%' flex col padding:'16px 20px 24px' bg:#fff overflowY:auto
 *
 * Top — marginTop:8:
 *   mark.svg 40×40 marginBottom:24
 *   overline "Berber · Dükkan Paneli" 10px bold 0.16em uppercase slate-500
 *   H1 "Hesap Oluştur" 30px bold -0.02em margin:'12px 0 8px' lineHeight:1.05
 *   p  "Dükkanını Sıradaki'ye ekle, randevularını online al." 14px 1.55 fg-2
 *
 * Fields — marginTop:24, gap:14:
 *   Dükkan Adı  placeholder="örn. Keskin Berber"      hint="Müşteriler bu ismi görecek"
 *   E-posta     placeholder="berber@dukkan.com"         emailError
 *   Şifre       placeholder="En az 8 karakter"  secure  passError + PasswordStrength
 *   Şifre Tekrar placeholder="Şifreni tekrar gir" secure confError
 *
 * Fine print — marginTop:16 11px slate-400:
 *   "Kayıt olarak Kullanım Koşulları'nı ve Gizlilik Politikası'nı kabul etmiş olursun."
 *   (links in brand-600 semiBold)
 *
 * CTA — marginTop:auto paddingTop:20 gap:12 alignItems:'center':
 *   Button "Hesap Oluştur" primary lg full disabled={!canRegister}
 *   footer "Hesabın var mı? Giriş yap"
 *
 * Validation (source):
 *   canRegister = shopName.trim()>=2 && email.includes('@') && pass>=8 && pass===passConf
 *   passError   = pass.length>0 && pass.length<8  → 'En az 8 karakter gerekli'
 *   confError   = passConf && pass!==passConf       → 'Şifreler eşleşmiyor'
 *   emailError  = email && !email.includes('@')     → 'Geçerli bir e-posta gir'
 *
 * PasswordStrength: 3 bars
 *   score 1 (<8 chars)   = 'Zayıf'  coral-600
 *   score 2 (8–11 chars) = 'Orta'   umber-600
 *   score 3 (≥12 chars)  = 'Güçlü'  mint-600
 */
import React, { useState } from 'react';
import {
  View,
  Text,
  TextInput,
  StyleSheet,
  TouchableOpacity,
  KeyboardAvoidingView,
  Platform,
  ScrollView,
} from 'react-native';
import * as WebBrowser from 'expo-web-browser';
import { SafeAreaView } from 'react-native-safe-area-context';
import { router } from 'expo-router';
import { colors } from '../../lib/theme';
import { Button } from '../../components/ds/Button';
import { supabase } from '../../lib/supabase';
import { trackEvent } from '../../lib/analytics';

const FN_BASE = process.env.EXPO_PUBLIC_SUPABASE_URL + '/functions/v1';

/* ── PasswordStrength ─────────────────────────────────────────── */
function PasswordStrength({ value }: { value: string }) {
  if (!value) return null;
  const score      = value.length >= 12 ? 3 : value.length >= 8 ? 2 : 1;
  const labels     = ['Zayıf', 'Orta', 'Güçlü'] as const;
  const barColors  = [colors.coral[600], colors.umber[600], colors.mint[600]];
  const activeCol  = barColors[score - 1]!;
  return (
    <View style={ps.wrap}>
      <View style={ps.bars}>
        {[1, 2, 3].map(i => (
          <View
            key={i}
            style={[ps.bar, { backgroundColor: i <= score ? activeCol : colors.slate[200] }]}
          />
        ))}
      </View>
      <Text style={[ps.label, { color: activeCol }]}>{labels[score - 1]}</Text>
    </View>
  );
}

const ps = StyleSheet.create({
  wrap:  { marginTop: -4 },
  bars:  { flexDirection: 'row', gap: 4, marginBottom: 4 },
  bar:   { flex: 1, height: 3, borderRadius: 2 },
  label: { fontSize: 10, fontFamily: 'Montserrat-SemiBold' },
});

/* ── Field ─────────────────────────────────────────────────────── */
interface FieldProps {
  label: string;
  value: string;
  onChange: (v: string) => void;
  placeholder: string;
  secureTextEntry?: boolean;
  keyboardType?: 'default' | 'email-address';
  error?: string | null;
  hint?: string;
}

function Field({
  label,
  value,
  onChange,
  placeholder,
  secureTextEntry = false,
  keyboardType = 'default',
  error,
  hint,
}: FieldProps) {
  const [focused, setFocused] = useState(false);

  const borderColor = error
    ? colors.coral[600]
    : focused
    ? colors.ink[900]
    : colors.slate[200];

  return (
    <View style={f.wrap}>
      {/* Label — 10px bold 0.16em uppercase; coral when error */}
      <Text style={[f.label, error ? f.labelError : null]}>{label}</Text>

      <TextInput
        value={value}
        onChangeText={onChange}
        placeholder={placeholder}
        placeholderTextColor={colors.slate[300]}
        secureTextEntry={secureTextEntry}
        keyboardType={keyboardType}
        autoCapitalize={keyboardType === 'email-address' ? 'none' : 'words'}
        autoCorrect={false}
        onFocus={() => setFocused(true)}
        onBlur={() => setFocused(false)}
        style={[f.input, { borderColor }]}
      />

      {/* Error — 11px semiBold coral-600 with inline icon */}
      {error ? (
        <View style={f.errorRow}>
          <Text style={f.errorIcon}>●</Text>
          <Text style={f.errorMsg}>{error}</Text>
        </View>
      ) : hint ? (
        <Text style={f.hint}>{hint}</Text>
      ) : null}
    </View>
  );
}

const f = StyleSheet.create({
  wrap: { gap: 6 },
  label: {
    fontSize: 10,
    fontFamily: 'Montserrat-Bold',
    letterSpacing: 1.6,            // 0.16em × 10
    textTransform: 'uppercase',
    color: colors.slate[500],
  },
  labelError: { color: colors.coral[600] },
  input: {
    fontSize: 15,
    fontFamily: 'Montserrat-Regular',
    color: colors.ink[900],
    backgroundColor: colors.slate[0],
    borderWidth: 1.5,
    borderRadius: 12,
    paddingHorizontal: 14,
    paddingVertical: 12,
  },
  errorRow: { flexDirection: 'row', alignItems: 'center', gap: 4 },
  errorIcon: { fontSize: 7, color: colors.coral[600] },
  errorMsg: {
    fontSize: 11,
    fontFamily: 'Montserrat-SemiBold',
    color: colors.coral[600],
  },
  hint: {
    fontSize: 11,
    fontFamily: 'Montserrat-Regular',
    color: colors.slate[400],
    lineHeight: 16,                // 11 × 1.45
  },
});

/* ── RegisterScreen ─────────────────────────────────────────────── */
export default function RegisterScreen() {
  const [shopName, setShopName] = useState('');
  const [email,    setEmail]    = useState('');
  const [pass,     setPass]     = useState('');
  const [passConf, setPassConf] = useState('');
  const [touched,  setTouched]  = useState(false);
  const [loading,  setLoading]  = useState(false);
  const [error,    setError]    = useState<string | null>(null);

  /* Validation — shown once user attempts submit */
  const passError  = touched && pass.length > 0 && pass.length < 8
    ? 'En az 8 karakter gerekli'
    : null;
  const confError  = touched && passConf.length > 0 && pass !== passConf
    ? 'Şifreler eşleşmiyor'
    : null;
  const emailError = touched && email.length > 0 && !email.includes('@')
    ? 'Geçerli bir e-posta gir'
    : null;

  const canRegister =
    shopName.trim().length >= 2 &&
    email.includes('@') &&
    pass.length >= 8 &&
    pass === passConf;

  async function handleSubmit() {
    setTouched(true);
    if (!canRegister || loading) return;
    setLoading(true);
    setError(null);
    try {
      const { data: authData, error: signUpError } = await supabase.auth.signUp({
        email: email.trim(),
        password: pass,
        options: { data: { shop_name: shopName.trim() } },
      });
      if (signUpError || !authData.user || !authData.session) {
        setError(signUpError?.message ?? 'Kayıt başarısız.');
        return;
      }

      const res = await fetch(`${FN_BASE}/register-shop`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${authData.session.access_token}`,
        },
        body: JSON.stringify({ shop_name: shopName.trim() }),
      });
      if (!res.ok) {
        const d = await res.json().catch(() => ({}));
        setError(d.error ?? 'Dükkan oluşturulamadı');
        return;
      }

      trackEvent('register_success');
      router.replace('/(auth)/pending' as any);
    } finally {
      setLoading(false);
    }
  }

  return (
    <SafeAreaView style={styles.safeArea}>
      <KeyboardAvoidingView
        style={styles.kav}
        behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
      >
      <ScrollView
        style={styles.screen}
        contentContainerStyle={styles.content}
        keyboardShouldPersistTaps="handled"
        bounces={false}
      >
        {/* Top — marginTop:8 */}
        <View style={styles.top}>
          {/* Brand mark — 40×40 ink-900 circle with "S", marginBottom:24 */}
          <View style={styles.mark}>
            <Text style={styles.markLetter}>S</Text>
          </View>

          {/* Overline — 10px bold 0.16em uppercase slate-500 */}
          <Text style={styles.overline}>Berber · Dükkan Paneli</Text>

          {/* H1 — 30px bold -0.02em margin:'12px 0 8px' lineHeight:1.05 */}
          <Text style={styles.title}>Hesap Oluştur</Text>

          {/* Lead — 14px Regular 1.55 fg-2 margin:0 */}
          <Text style={styles.lead}>
            Dükkanını Sıradaki&apos;ye ekle, randevularını online al.
          </Text>
        </View>

        {/* Fields — marginTop:24 gap:14 */}
        <View style={styles.fields}>
          <Field
            label="Dükkan Adı"
            value={shopName}
            onChange={setShopName}
            placeholder="örn. Keskin Berber"
            hint="Müşteriler bu ismi görecek"
          />
          <Field
            label="E-posta"
            value={email}
            onChange={setEmail}
            placeholder="berber@dukkan.com"
            keyboardType="email-address"
            error={emailError}
          />

          {/* Şifre + PasswordStrength — wrapped in a View */}
          <View>
            <Field
              label="Şifre"
              value={pass}
              onChange={setPass}
              placeholder="En az 8 karakter"
              secureTextEntry
              error={passError}
            />
            {!passError && (
              <View style={styles.strengthWrap}>
                <PasswordStrength value={pass} />
              </View>
            )}
          </View>

          <Field
            label="Şifre Tekrar"
            value={passConf}
            onChange={setPassConf}
            placeholder="Şifreni tekrar gir"
            secureTextEntry
            error={confError}
          />
        </View>

        {/* Fine print — marginTop:16 11px slate-400 lineHeight:1.55 */}
        <Text style={styles.finePrint}>
          {"Kayıt olarak "}
          <Text
            style={styles.finePrintLink}
            onPress={() => WebBrowser.openBrowserAsync("https://siradaki.app/kullanim-kosullari")}
          >{"Kullanım Koşulları"}</Text>
          {"’nı ve "}
          <Text
            style={styles.finePrintLink}
            onPress={() => WebBrowser.openBrowserAsync("https://siradaki.app/gizlilik-politikasi")}
          >{"Gizlilik Politikası"}</Text>
          {"’nı kabul etmiş olursun."}
        </Text>

        {/* Spacer — marginTop:'auto' */}
        <View style={styles.spacer} />

        {/* CTA — paddingTop:20 gap:12 alignItems:'center' */}
        <View style={styles.cta}>
          {error ? (
            <Text style={styles.errorText}>{error}</Text>
          ) : null}
          <Button
            variant="primary"
            size="lg"
            full
            disabled={!canRegister || loading}
            onPress={handleSubmit}
          >
            {loading ? 'Hesap oluşturuluyor…' : 'Hesap Oluştur'}
          </Button>
          <View style={styles.footerRow}>
            <Text style={styles.footerText}>Hesabın var mı? </Text>
            <TouchableOpacity onPress={() => router.back()}>
              <Text style={styles.footerLink}>Giriş yap</Text>
            </TouchableOpacity>
          </View>
        </View>
      </ScrollView>
      </KeyboardAvoidingView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safeArea: {
    flex: 1,
    backgroundColor: colors.slate[0],
  },
  kav: {
    flex: 1,
    backgroundColor: colors.slate[0],
  },
  screen: {
    flex: 1,
    backgroundColor: colors.slate[0],
  },
  content: {
    flexGrow: 1,
    paddingHorizontal: 20,
    paddingTop: 16,
    paddingBottom: 24,
  },

  /* Top — marginTop:40 */
  top: { marginTop: 40 },

  /* Mark — 40×40 ink-900 borderRadius:999 marginBottom:24 */
  mark: {
    width: 40,
    height: 40,
    borderRadius: 999,
    backgroundColor: colors.ink[900],
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 24,
  },
  markLetter: {
    fontSize: 18,
    fontFamily: 'Montserrat-Bold',
    color: '#ffffff',
  },

  /* Overline — 10px bold 0.16em uppercase slate-500 */
  overline: {
    fontSize: 10,
    fontFamily: 'Montserrat-Bold',
    letterSpacing: 1.6,            // 0.16em × 10
    textTransform: 'uppercase',
    color: colors.slate[500],
  },

  /* H1 — 30px bold -0.02em margin:'12px 0 8px' lineHeight:1.05 */
  title: {
    fontSize: 30,
    fontFamily: 'Montserrat-Bold',
    letterSpacing: -0.6,           // -0.02em × 30
    lineHeight: 32,                // 30 × 1.05 ≈ 32
    color: colors.ink[900],
    marginTop: 12,
    marginBottom: 8,
  },

  /* Lead — 14px Regular 1.55 fg-2=slate-700 margin:0 */
  lead: {
    fontSize: 14,
    fontFamily: 'Montserrat-Regular',
    lineHeight: 22,                // 14 × 1.55 ≈ 22
    color: colors.slate[700],
  },

  /* Fields — marginTop:24, gap:14 */
  fields: { marginTop: 24, gap: 14 },

  /* PasswordStrength below Şifre field */
  strengthWrap: { marginTop: 8 },

  /* Fine print — marginTop:16 */
  finePrint: {
    marginTop: 16,
    fontSize: 11,
    fontFamily: 'Montserrat-Regular',
    color: colors.slate[400],
    lineHeight: 17,                // 11 × 1.55
  },
  finePrintLink: {
    fontFamily: 'Montserrat-SemiBold',
    color: colors.brand[600],
  },

  /* Spacer */
  spacer: { flex: 1, minHeight: 20 },

  /* CTA — paddingTop:20 gap:12 */
  cta: {
    paddingTop: 20,
    gap: 12,
    alignItems: 'center',
  },

  /* Footer */
  footerRow: { flexDirection: 'row', justifyContent: 'center' },
  footerText: {
    fontSize: 13,
    fontFamily: 'Montserrat-Regular',
    color: colors.slate[500],
  },
  footerLink: {
    fontSize: 13,
    fontFamily: 'Montserrat-SemiBold',
    color: colors.brand[600],
  },
  errorText: {
    fontSize: 13,
    fontFamily: 'Montserrat-Regular',
    color: colors.coral[600],
    textAlign: 'center',
  },
});
