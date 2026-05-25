/**
 * M1 · Giriş Ekranı
 * Source: screens.jsx LoginScreen()
 *
 * Layout (source):
 *   height:'100%', display:'flex', flexDirection:'column',
 *   padding:'20px 20px 28px', background:'#fff'
 *
 * Top area — marginTop:60:
 *   img mark.svg 48×48 marginBottom:28
 *   overline "Berber · Dükkan Paneli" 11px semiBold 0.16em uppercase slate-500
 *   H1 "Giriş Yap" 34px bold -0.02em margin:'14px 0 10px' lineHeight:1.05
 *   p  "Randevu panelini açmak için hesabına giriş yap." 16px lineHeight:1.55 fg-2
 *
 * Fields — marginTop:32 gap:14:
 *   TextField label="E-posta" placeholder="berber@dukkan.com"
 *   TextField label="Şifre"   placeholder="••••••••" secure
 *
 * CTA — marginTop:'auto' gap:14 alignItems:'center':
 *   Button variant="primary" size="lg" full disabled={!email||!pass} "Giriş Yap"
 *   footer: "Hesabın yok mu? " + "Kayıt ol" (brand-600 semiBold)
 */
import React, { useState } from 'react';
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  KeyboardAvoidingView,
  Platform,
  ScrollView,
} from 'react-native';
import { router } from 'expo-router';
import { colors } from '../../lib/theme';
import { Button } from '../../components/ds/Button';
import { TextField } from '../../components/ds/TextField';
import { supabase, determineUserRole } from '../../lib/supabase';
import { registerForPushNotifications } from '../../lib/notifications';

export default function LoginScreen() {
  const [email,    setEmail]    = useState('');
  const [password, setPassword] = useState('');
  const [loading,  setLoading]  = useState(false);
  const [error,    setError]    = useState<string | null>(null);

  const canSubmit = email.trim().length > 0 && password.length > 0;

  async function handleLogin() {
    if (!canSubmit || loading) return;
    setLoading(true);
    setError(null);
    try {
      const { data, error: authError } = await supabase.auth.signInWithPassword({
        email: email.trim(),
        password,
      });
      if (authError) { setError(authError.message); return; }
      if (!data.user) return;
      const role = await determineUserRole(data.user.id);
      registerForPushNotifications().catch(() => {});
      if (role === 'owner') router.replace('/(owner)');
      else if (role === 'staff') router.replace('/(app)');
      else setError('Hesabınıza erişim bulunamadı.');
    } finally {
      setLoading(false);
    }
  }

  return (
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
        {/* Top area — marginTop:60 */}
        <View style={styles.topArea}>
          {/* Brand mark — 48×48 marginBottom:28 (ink-900 circle with "S") */}
          <View style={styles.mark}>
            <Text style={styles.markLetter}>S</Text>
          </View>

          {/* Overline — 11px semiBold 0.16em uppercase slate-500 */}
          <Text style={styles.overline}>Berber · Dükkan Paneli</Text>

          {/* H1 — 34px bold -0.02em lineHeight:1.05 margin:'14px 0 10px' */}
          <Text style={styles.title}>Giriş Yap</Text>

          {/* Lead — 16px lineHeight:1.55 fg-2=slate-700 */}
          <Text style={styles.lead}>
            Randevu panelini açmak için hesabına giriş yap.
          </Text>
        </View>

        {/* Fields — marginTop:32, gap:14 */}
        <View style={styles.fields}>
          <TextField
            label="E-posta"
            value={email}
            onChangeText={setEmail}
            placeholder="berber@dukkan.com"
            keyboardType="email-address"
          />
          <TextField
            label="Şifre"
            value={password}
            onChangeText={setPassword}
            placeholder="••••••••"
            secureTextEntry
          />
        </View>

        {/* Spacer pushes CTA to bottom */}
        <View style={styles.spacer} />

        {/* CTA — gap:14 alignItems:'center' */}
        <View style={styles.cta}>
          {error ? (
            <Text style={styles.errorText}>{error}</Text>
          ) : null}
          <Button
            variant="primary"
            size="lg"
            full
            disabled={!canSubmit || loading}
            onPress={handleLogin}
          >
            {loading ? 'Giriş yapılıyor…' : 'Giriş Yap'}
          </Button>
          <View style={styles.footerRow}>
            <Text style={styles.footerText}>Hesabın yok mu? </Text>
            <TouchableOpacity onPress={() => router.push('/(auth)/register')}>
              <Text style={styles.footerLink}>Kayıt ol</Text>
            </TouchableOpacity>
          </View>
        </View>
      </ScrollView>
    </KeyboardAvoidingView>
  );
}

const styles = StyleSheet.create({
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
    paddingTop: 20,
    paddingBottom: 28,
  },

  /* Top area — source: marginTop:60 */
  topArea: {
    marginTop: 60,
  },

  /* Brand mark — 48×48 borderRadius:999 ink-900 bg, "S" letter, marginBottom:28 */
  mark: {
    width: 48,
    height: 48,
    borderRadius: 999,
    backgroundColor: colors.ink[900],
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 28,
  },
  markLetter: {
    fontSize: 22,
    fontFamily: 'Montserrat-Bold',
    color: '#ffffff',
  },

  /* Overline — 11px semiBold letterSpacing:0.16em uppercase slate-500 lineHeight:1 */
  overline: {
    fontSize: 11,
    fontFamily: 'Montserrat-SemiBold',
    letterSpacing: 1.76,           // 0.16em × 11
    textTransform: 'uppercase',
    color: colors.slate[500],
    lineHeight: 11,
  },

  /* H1 — 34px bold -0.02em lineHeight:1.05 margin:'14px 0 10px' */
  title: {
    fontSize: 34,
    fontFamily: 'Montserrat-Bold',
    letterSpacing: -0.68,          // -0.02em × 34
    lineHeight: 36,                // 34 × 1.05 ≈ 36
    color: colors.ink[900],
    marginTop: 14,
    marginBottom: 10,
  },

  /* Lead — 16px Regular lineHeight:1.55 fg-2=slate-700 */
  lead: {
    fontSize: 16,
    fontFamily: 'Montserrat-Regular',
    lineHeight: 25,                // 16 × 1.55 ≈ 25
    color: colors.slate[700],
  },

  /* Fields — marginTop:32, gap:14 */
  fields: {
    marginTop: 32,
    gap: 14,
  },

  /* Spacer — pushes CTA to bottom (marginTop:'auto') */
  spacer: {
    flex: 1,
    minHeight: 24,
  },

  /* CTA — gap:14 alignItems:'center' */
  cta: {
    gap: 14,
    alignItems: 'center',
  },

  /* Footer row */
  footerRow: {
    flexDirection: 'row',
    justifyContent: 'center',
  },
  footerText: {
    fontSize: 13,
    fontFamily: 'Montserrat-Regular',
    color: colors.slate[500],      // fg-3
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
