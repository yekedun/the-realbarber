/**
 * M11 — Staff: Hesabım screen
 * Source: index.html → HesabimScreen + screens.jsx (implicit)
 *
 * Layout (exact from index.html HesabimScreen):
 *   height: '100%', overflowY: 'auto', paddingBottom: 24
 *   OverlineHeader eyebrow="Ayarlar" title="Hesabım"
 *   Card (padding 16, margin '0 20px'):
 *     overline "Personel" (11px SemiBold 0.14em uppercase slate-500)
 *     name    "Mehmet Demir"  (17px Bold marginTop 6)
 *     email   "mehmet@dukkan.com" (13px Regular fg-3 marginTop 2)
 *   Button variant="danger" full size="lg" "Çıkış Yap"
 *     (margin '32px 20px 0')
 *   Footer note "Sıradaki · Usta Ekranı"
 *     (textAlign center, 11px, color slate-400, marginTop 24, letterSpacing 0.08em)
 *
 * Sign-out Alert (exact strings from Button onPress):
 *   title:   "Çıkış Yap"
 *   message: "Hesaptan çıkmak istediğinizden emin misiniz?"
 *   buttons: [{ text: 'Vazgeç', style: 'cancel' }, { text: 'Çıkış Yap', style: 'destructive' }]
 */
import React, { useEffect, useState } from 'react';
import {
  View,
  Text,
  ScrollView,
  TouchableOpacity,
  StyleSheet,
  Alert,
  SafeAreaView,
} from 'react-native';
import { useRouter } from 'expo-router';
import { colors } from '../../lib/theme';
import { supabase } from '../../lib/supabase';

export default function HesabimScreen() {
  const router = useRouter();
  const [profile, setProfile] = useState<{ name: string; email: string } | null>(null);

  useEffect(() => {
    supabase.auth.getUser().then(({ data: { user } }) => {
      if (!user) return;
      supabase.from('staff').select('name').eq('user_id', user.id).maybeSingle()
        .then(({ data }) => {
          setProfile({ name: data?.name ?? user.email?.split('@')[0] ?? '—', email: user.email ?? '—' });
        });
    });
  }, []);

  function handleSignOut() {
    Alert.alert(
      'Çıkış Yap',
      'Hesaptan çıkmak istediğinizden emin misiniz?',
      [
        { text: 'Vazgeç', style: 'cancel' },
        {
          text: 'Çıkış Yap',
          style: 'destructive',
          onPress: async () => {
            await supabase.auth.signOut();
            router.replace('/(auth)/login');
          },
        },
      ]
    );
  }

  return (
    <SafeAreaView style={styles.safe}>
      <ScrollView
        style={styles.scroll}
        contentContainerStyle={styles.content}
        showsVerticalScrollIndicator={false}
      >
        {/* OverlineHeader: eyebrow="Ayarlar", title="Hesabım"
            padding: '8px 20px 16px'
            eyebrow: 11px SemiBold 0.16em uppercase slate-500
            title:   32px Bold -0.02em ink-900 marginTop 10 lineHeight 1.05 */}
        <View style={styles.header}>
          <Text style={styles.eyebrow}>Ayarlar</Text>
          <Text style={styles.title}>Hesabım</Text>
        </View>

        {/* Card: padding 16, margin '0 20px'
            bg slate-0, border slate-200, borderRadius 12, shadow 0 1px 2px */}
        <View style={styles.cardWrap}>
          <View style={styles.card}>
            {/* overline "Personel": 11px SemiBold 0.14em uppercase slate-500 */}
            <Text style={styles.cardOverline}>Personel</Text>
            {/* name: 17px Bold marginTop 6 ink-900 */}
            <Text style={styles.cardName}>{profile?.name ?? '—'}</Text>
            {/* email: 13px Regular fg-3 marginTop 2 */}
            <Text style={styles.cardEmail}>{profile?.email ?? '—'}</Text>
          </View>
        </View>

        {/* Button variant="danger" full size="lg" "Çıkış Yap"
            Source: Button danger = transparent bg, border coral-600, color coral-600
            size lg = height 52, paddingHorizontal 20, fontSize 15
            padding: '32px 20px 0' */}
        <View style={styles.signOutWrap}>
          <TouchableOpacity style={styles.dangerBtn} onPress={handleSignOut}>
            <Text style={styles.dangerBtnText}>Çıkış Yap</Text>
          </TouchableOpacity>
        </View>

        {/* Footer note: "Sıradaki · Usta Ekranı"
            textAlign center, 11px, color slate-400, marginTop 24, letterSpacing 0.08em */}
        <Text style={styles.footer}>Sıradaki · Usta Ekranı</Text>
      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safe: {
    flex: 1,
    backgroundColor: colors.slate[50],
  },
  scroll: { flex: 1 },
  content: {
    paddingBottom: 24,
  },

  /* OverlineHeader (components.jsx):
     padding: '8px 20px 16px'
     eyebrow: 11px SemiBold 0.16em uppercase slate-500 lineHeight 1
     title:   32px Bold -0.02em ink-900 marginTop 10 lineHeight 1.05 */
  header: {
    paddingHorizontal: 20,
    paddingTop: 8,
    paddingBottom: 16,
  },
  eyebrow: {
    fontFamily: 'Montserrat-SemiBold',
    fontSize: 11,
    letterSpacing: 11 * 0.16,   // 0.16em
    textTransform: 'uppercase',
    color: colors.slate[500],
    lineHeight: 11,
  },
  title: {
    fontFamily: 'Montserrat-Bold',
    fontSize: 32,
    letterSpacing: 32 * -0.02,  // -0.02em
    color: colors.ink[900],
    marginTop: 10,
    lineHeight: 33.6,           // 1.05
  },

  /* Card wrapper: margin '0 20px' */
  cardWrap: {
    paddingHorizontal: 20,
  },
  /* Card: padding 16, bg slate-0, border slate-200, borderRadius 12, shadow */
  card: {
    padding: 16,
    backgroundColor: colors.slate[0],
    borderWidth: 1,
    borderColor: colors.slate[200],
    borderRadius: 12,
    shadowColor: colors.ink[900],
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.04,
    shadowRadius: 2,
    elevation: 1,
  },
  /* overline "Personel": 11px SemiBold 0.14em uppercase slate-500 */
  cardOverline: {
    fontFamily: 'Montserrat-SemiBold',
    fontSize: 11,
    letterSpacing: 11 * 0.14,   // 0.14em
    textTransform: 'uppercase',
    color: colors.slate[500],
  },
  /* name: 17px Bold marginTop 6 ink-900 */
  cardName: {
    fontFamily: 'Montserrat-Bold',
    fontSize: 17,
    color: colors.ink[900],
    marginTop: 6,
  },
  /* email: 13px Regular fg-3 (slate-500) marginTop 2 */
  cardEmail: {
    fontFamily: 'Montserrat-Regular',
    fontSize: 13,
    color: colors.slate[500],
    marginTop: 2,
  },

  /* Button variant="danger" full size="lg":
     transparent bg, border coral-600, color coral-600, height 52, borderRadius 12
     wrapper: padding '32px 20px 0' */
  signOutWrap: {
    paddingHorizontal: 20,
    paddingTop: 32,
  },
  dangerBtn: {
    height: 52,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: colors.coral[600],
    backgroundColor: 'transparent',
    alignItems: 'center',
    justifyContent: 'center',
  },
  dangerBtnText: {
    fontFamily: 'Montserrat-SemiBold',
    fontSize: 15,
    color: colors.coral[600],
    letterSpacing: 15 * -0.005,
  },

  /* Footer: "Sıradaki · Usta Ekranı"
     textAlign center, 11px, color slate-400, marginTop 24, letterSpacing 0.08em */
  footer: {
    textAlign: 'center',
    fontFamily: 'Montserrat-Regular',
    fontSize: 11,
    color: colors.slate[400],
    marginTop: 24,
    letterSpacing: 11 * 0.08,   // 0.08em
  },
});
