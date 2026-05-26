import React, { useState } from 'react';
import {
  View, Text, StyleSheet, KeyboardAvoidingView, Platform, ScrollView,
} from 'react-native';
import { router } from 'expo-router';
import { colors } from '../../lib/theme';
import { Button } from '../../components/ds/Button';
import { TextField } from '../../components/ds/TextField';
import { supabase } from '../../lib/supabase';

const FN_BASE = process.env.EXPO_PUBLIC_SUPABASE_URL + '/functions/v1';

export default function GoogleOnboardingScreen() {
  const [shopName, setShopName] = useState('');
  const [phone,    setPhone]    = useState('');
  const [loading,  setLoading]  = useState(false);
  const [error,    setError]    = useState<string | null>(null);

  const canSubmit = shopName.trim().length >= 2 && phone.trim().length >= 10;

  async function handleSubmit() {
    if (!canSubmit || loading) return;
    setLoading(true);
    setError(null);
    try {
      const session = (await supabase.auth.getSession()).data.session;
      const res = await fetch(`${FN_BASE}/register-shop`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${session?.access_token}`,
        },
        body: JSON.stringify({ shop_name: shopName.trim(), phone: phone.trim() }),
      });
      if (!res.ok) {
        const d = await res.json().catch(() => ({}));
        setError(d.error ?? 'Kayıt oluşturulamadı');
        return;
      }
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      router.replace('/(auth)/pending' as any);
    } finally {
      setLoading(false);
    }
  }

  return (
    <KeyboardAvoidingView style={{ flex: 1, backgroundColor: colors.slate[0] }}
      behavior={Platform.OS === 'ios' ? 'padding' : 'height'}>
      <ScrollView contentContainerStyle={styles.content} keyboardShouldPersistTaps="handled">
        <View style={styles.topArea}>
          <View style={styles.mark}><Text style={styles.markLetter}>S</Text></View>
          <Text style={styles.overline}>Berber · Dükkan Paneli</Text>
          <Text style={styles.title}>Dükkanını Tanıt</Text>
          <Text style={styles.lead}>Müşteriler dükkanını bu isimle bulacak.</Text>
        </View>
        <View style={styles.fields}>
          <TextField label="Dükkan Adı" value={shopName} onChangeText={setShopName}
            placeholder="örn. Neco Kuaför" />
          <TextField label="Telefon Numarası" value={phone} onChangeText={setPhone}
            placeholder="05XX XXX XX XX" keyboardType="phone-pad" />
        </View>
        <View style={{ flex: 1, minHeight: 24 }} />
        <View style={styles.cta}>
          {error ? <Text style={styles.errorText}>{error}</Text> : null}
          <Button variant="primary" size="lg" full
            disabled={!canSubmit || loading} onPress={handleSubmit}>
            {loading ? 'Kaydediliyor…' : 'Devam Et'}
          </Button>
        </View>
      </ScrollView>
    </KeyboardAvoidingView>
  );
}

const styles = StyleSheet.create({
  content:    { flexGrow: 1, paddingHorizontal: 20, paddingTop: 20, paddingBottom: 28 },
  topArea:    { marginTop: 60 },
  mark:       { width: 48, height: 48, borderRadius: 999, backgroundColor: colors.ink[900],
                 alignItems: 'center', justifyContent: 'center', marginBottom: 28 },
  markLetter: { fontSize: 22, fontFamily: 'Montserrat-Bold', color: '#fff' },
  overline:   { fontSize: 11, fontFamily: 'Montserrat-SemiBold', letterSpacing: 1.76,
                 textTransform: 'uppercase', color: colors.slate[500] },
  title:      { fontSize: 34, fontFamily: 'Montserrat-Bold', letterSpacing: -0.68,
                 lineHeight: 36, color: colors.ink[900], marginTop: 14, marginBottom: 10 },
  lead:       { fontSize: 16, fontFamily: 'Montserrat-Regular', lineHeight: 25, color: colors.slate[700] },
  fields:     { marginTop: 32, gap: 14 },
  cta:        { gap: 14, alignItems: 'center' },
  errorText:  { fontSize: 13, fontFamily: 'Montserrat-Regular', color: colors.coral[600], textAlign: 'center' },
});
