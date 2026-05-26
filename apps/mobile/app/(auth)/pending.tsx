import React from 'react';
import { View, Text, StyleSheet } from 'react-native';
import { colors } from '../../lib/theme';
import { Button } from '../../components/ds/Button';
import { supabase } from '../../lib/supabase';

export default function PendingScreen() {
  async function handleLogout() {
    await supabase.auth.signOut();
    // _layout.tsx session change'i yakalar → login'e yönlendirir
  }

  return (
    <View style={styles.screen}>
      <View style={styles.iconWrap}>
        <Text style={styles.icon}>⏳</Text>
      </View>
      <Text style={styles.title}>Başvurun Alındı</Text>
      <Text style={styles.body}>
        Dükkanın inceleme sürecinde. Onaylandıktan sonra bildirim alacaksın.
        Genellikle 24 saat içinde yanıt verilir.
      </Text>
      <Button variant="secondary" size="md" onPress={handleLogout}>
        Çıkış Yap
      </Button>
    </View>
  );
}

const styles = StyleSheet.create({
  screen:   { flex: 1, backgroundColor: colors.slate[0], alignItems: 'center',
               justifyContent: 'center', paddingHorizontal: 32, gap: 16 },
  iconWrap: { width: 72, height: 72, borderRadius: 999, backgroundColor: colors.slate[100],
               alignItems: 'center', justifyContent: 'center', marginBottom: 8 },
  icon:     { fontSize: 32 },
  title:    { fontSize: 24, fontFamily: 'Montserrat-Bold', color: colors.ink[900], textAlign: 'center' },
  body:     { fontSize: 15, fontFamily: 'Montserrat-Regular', color: colors.slate[500],
               textAlign: 'center', lineHeight: 22 },
});
