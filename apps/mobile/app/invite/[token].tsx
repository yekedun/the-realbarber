import React, { useEffect, useState } from 'react';
import { View, Text, StyleSheet, ActivityIndicator } from 'react-native';
import { useLocalSearchParams, router } from 'expo-router';
import { colors } from '../../lib/theme';
import { Button } from '../../components/ds/Button';
import { supabase } from '../../lib/supabase';
import { configureGoogleSignIn, signInWithGoogle } from '../../lib/google-auth';

const FN_BASE = process.env.EXPO_PUBLIC_SUPABASE_URL + '/functions/v1';

export default function InviteScreen() {
  const { token } = useLocalSearchParams<{ token: string }>();
  const [state,   setState]   = useState<'checking' | 'ready' | 'signing' | 'error'>('checking');
  const [message, setMessage] = useState('');

  useEffect(() => {
    configureGoogleSignIn();
  }, []);

  useEffect(() => {
    validateToken();
  }, [token]);

  async function validateToken() {
    if (!token) {
      setState('error');
      setMessage('Davet linki geçersiz.');
      return;
    }
    const { data } = await supabase
      .from('invite_tokens')
      .select('id, used_at, expires_at')
      .eq('token', token)
      .maybeSingle();

    if (!data) { setState('error'); setMessage('Davet linki geçersiz.'); return; }
    if (data.used_at) { setState('error'); setMessage('Bu davet linki daha önce kullanılmış.'); return; }
    if (new Date(data.expires_at) < new Date()) {
      setState('error'); setMessage('Davet linkinin süresi dolmuş. Sahipten yeni link isteyin.'); return;
    }
    setState('ready');
  }

  async function handleGoogleSignIn() {
    setState('signing');
    const result = await signInWithGoogle();
    if (result.error) {
      setState('error');
      setMessage(result.error);
      return;
    }

    const session = (await supabase.auth.getSession()).data.session;
    if (!session) {
      setState('error');
      setMessage('Oturum alınamadı, tekrar deneyin.');
      return;
    }
    const res = await fetch(`${FN_BASE}/accept-invite`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${session?.access_token}`,
      },
      body: JSON.stringify({ token }),
    });

    if (!res.ok) {
      const d = await res.json().catch(() => ({}));
      setState('error');
      setMessage(d.error ?? 'Davet kabul edilemedi');
      return;
    }

    router.replace('/');
  }

  if (state === 'checking') return (
    <View style={styles.center}>
      <ActivityIndicator size="large" color={colors.brand[600]} />
      <Text style={styles.sub}>Davet kontrol ediliyor…</Text>
    </View>
  );

  if (state === 'error') return (
    <View style={styles.center}>
      <Text style={styles.icon}>❌</Text>
      <Text style={styles.title}>Geçersiz Davet</Text>
      <Text style={styles.sub}>{message}</Text>
    </View>
  );

  if (state === 'signing') return (
    <View style={styles.center}>
      <ActivityIndicator size="large" color={colors.brand[600]} />
      <Text style={styles.sub}>Giriş yapılıyor…</Text>
    </View>
  );

  return (
    <View style={styles.center}>
      <View style={styles.mark}><Text style={styles.markLetter}>S</Text></View>
      <Text style={styles.title}>Berber Olarak Katıl</Text>
      <Text style={styles.sub}>
        Sıradaki'ye berber olarak eklendiniz. Devam etmek için Google hesabınızla giriş yapın.
      </Text>
      <Button variant="primary" size="lg" full
        onPress={handleGoogleSignIn}>
        Google ile Devam Et
      </Button>
    </View>
  );
}

const styles = StyleSheet.create({
  center:     { flex: 1, backgroundColor: colors.slate[0], alignItems: 'center',
                 justifyContent: 'center', padding: 32, gap: 16 },
  mark:       { width: 56, height: 56, borderRadius: 999, backgroundColor: colors.ink[900],
                 alignItems: 'center', justifyContent: 'center', marginBottom: 8 },
  markLetter: { fontSize: 24, fontFamily: 'Montserrat-Bold', color: '#fff' },
  icon:       { fontSize: 48 },
  title:      { fontSize: 24, fontFamily: 'Montserrat-Bold', color: colors.ink[900],
                 textAlign: 'center' },
  sub:        { fontSize: 15, fontFamily: 'Montserrat-Regular', color: colors.slate[500],
                 textAlign: 'center', lineHeight: 22 },
});
