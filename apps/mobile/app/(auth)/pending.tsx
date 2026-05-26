import React from 'react';
import { Alert, View, Text, StyleSheet } from 'react-native';
import { router, useLocalSearchParams } from 'expo-router';
import { colors } from '../../lib/theme';
import { Button } from '../../components/ds/Button';
import { determineUserRole, supabase } from '../../lib/supabase';
import { routeForRole } from '../../lib/router-guard';

export default function PendingScreen() {
  const { status } = useLocalSearchParams<{ status?: string }>();
  const rejected = status === 'rejected';
  const unknown = status === 'unknown';

  async function handleLogout() {
    await supabase.auth.signOut();
    router.replace('/(auth)/login');
  }

  async function handleRefresh() {
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) {
      router.replace('/(auth)/login');
      return;
    }
    const role = await determineUserRole(user.id);
    if (role === 'unknown') {
      Alert.alert('Durum okunamadı', 'Bağlantını veya veritabanı migration durumunu kontrol edip tekrar dene.');
      return;
    }
    router.replace(routeForRole(role) as any);
  }

  return (
    <View style={styles.screen}>
      <View style={styles.iconWrap}>
        <Text style={styles.icon}>{rejected ? '!' : '?'}</Text>
      </View>
      <Text style={styles.title}>
        {rejected ? 'Başvuru Reddedildi' : unknown ? 'Durum Kontrol Edilemedi' : 'Başvurun Alındı'}
      </Text>
      <Text style={styles.body}>
        {rejected
          ? 'Dükkan başvurun onaylanmadı. Detay için destek ekibiyle iletişime geçebilirsin.'
          : unknown
            ? 'Hesap durumun şu anda okunamadı. Bağlantını kontrol edip tekrar giriş yap.'
            : 'Dükkanın inceleme sürecinde. Onaylandıktan sonra bildirim alacaksın. Genellikle 24 saat içinde yanıt verilir.'}
      </Text>
      <Button variant="primary" size="md" onPress={handleRefresh}>
        Durumu Yenile
      </Button>
      <Button variant="secondary" size="md" onPress={handleLogout}>
        Çıkış Yap
      </Button>
    </View>
  );
}

const styles = StyleSheet.create({
  screen: {
    flex: 1,
    backgroundColor: colors.slate[0],
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: 32,
    gap: 16,
  },
  iconWrap: {
    width: 72,
    height: 72,
    borderRadius: 999,
    backgroundColor: colors.slate[100],
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 8,
  },
  icon: { fontSize: 32 },
  title: {
    fontSize: 24,
    fontFamily: 'Montserrat-Bold',
    color: colors.ink[900],
    textAlign: 'center',
  },
  body: {
    fontSize: 15,
    fontFamily: 'Montserrat-Regular',
    color: colors.slate[500],
    textAlign: 'center',
    lineHeight: 22,
  },
});
