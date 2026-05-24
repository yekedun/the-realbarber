/**
 * M11 — Staff: Hesabım screen
 */
import React, { useEffect, useState } from 'react';
import {
  View,
  Text,
  ScrollView,
  Share,
  TouchableOpacity,
  StyleSheet,
  Alert,
  SafeAreaView,
} from 'react-native';
import { useRouter } from 'expo-router';
import { colors } from '../../lib/theme';
import { supabase } from '../../lib/supabase';
import { buildBarberLink } from '../../lib/onboarding-utils';

interface Profile {
  name: string;
  email: string;
  barberLink: string | null;
}

export default function HesabimScreen() {
  const router = useRouter();
  const [profile, setProfile] = useState<Profile | null>(null);

  useEffect(() => {
    supabase.auth.getUser().then(({ data: { user } }) => {
      if (!user) return;
      supabase
        .from('staff')
        .select('name, slug, shops(slug)')
        .eq('user_id', user.id)
        .maybeSingle()
        .then(({ data }) => {
          const shopSlug = (data?.shops as any)?.slug ?? null;
          const staffSlug = data?.slug ?? null;
          setProfile({
            name: data?.name ?? user.email?.split('@')[0] ?? '—',
            email: user.email ?? '—',
            barberLink: buildBarberLink(shopSlug, staffSlug),
          });
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

  function handleDeleteAccount() {
    Alert.alert(
      'Hesabı Sil',
      'Hesabınızı silmek istediğinizden emin misiniz? Bu işlem geri alınamaz.',
      [
        { text: 'Vazgeç', style: 'cancel' },
        {
          text: 'Sil',
          style: 'destructive',
          onPress: async () => {
            const { error } = await supabase.functions.invoke('delete-account');
            if (error) {
              Alert.alert('Hata', 'Hesap silinemedi. Lütfen tekrar deneyin.');
              return;
            }
            await supabase.auth.signOut();
            router.replace('/(auth)/login');
          },
        },
      ],
    );
  }

  async function handleShare() {
    if (!profile?.barberLink) return;
    try {
      await Share.share({ message: profile.barberLink });
    } catch {}
  }

  return (
    <SafeAreaView style={styles.safe}>
      <ScrollView
        style={styles.scroll}
        contentContainerStyle={styles.content}
        showsVerticalScrollIndicator={false}
      >
        <View style={styles.header}>
          <Text style={styles.eyebrow}>Ayarlar</Text>
          <Text style={styles.title}>Hesabım</Text>
        </View>

        {/* Profile card */}
        <View style={styles.cardWrap}>
          <View style={styles.card}>
            <Text style={styles.cardOverline}>Personel</Text>
            <Text style={styles.cardName}>{profile?.name ?? '—'}</Text>
            <Text style={styles.cardEmail}>{profile?.email ?? '—'}</Text>
          </View>
        </View>

        {/* Randevu linki — only shown when staff has a slug */}
        {profile?.barberLink ? (
          <View style={styles.linkSection}>
            <Text style={styles.linkSectionLabel}>Randevu Linkim</Text>
            <View style={styles.linkCard}>
              <Text style={styles.linkUrl} numberOfLines={1} ellipsizeMode="tail">
                {profile.barberLink}
              </Text>
              <TouchableOpacity style={styles.shareBtn} onPress={handleShare} activeOpacity={0.75}>
                <Text style={styles.shareBtnText}>Paylaş</Text>
              </TouchableOpacity>
            </View>
            <Text style={styles.linkHint}>
              Müşterilerinle bu linki paylaş — doğrudan sana randevu alabilirler.
            </Text>
          </View>
        ) : null}

        {/* Danger actions */}
        <View style={styles.signOutWrap}>
          <TouchableOpacity style={styles.dangerBtn} onPress={handleSignOut}>
            <Text style={styles.dangerBtnText}>Çıkış Yap</Text>
          </TouchableOpacity>
          <TouchableOpacity style={[styles.dangerBtn, { marginTop: 12 }]} onPress={handleDeleteAccount}>
            <Text style={styles.dangerBtnText}>Hesabımı Sil</Text>
          </TouchableOpacity>
        </View>

        <Text style={styles.footer}>Sıradaki · Usta Ekranı</Text>
      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safe: { flex: 1, backgroundColor: colors.slate[50] },
  scroll: { flex: 1 },
  content: { paddingBottom: 24 },

  header: { paddingHorizontal: 20, paddingTop: 8, paddingBottom: 16 },
  eyebrow: {
    fontFamily: 'Montserrat-SemiBold',
    fontSize: 11,
    letterSpacing: 11 * 0.16,
    textTransform: 'uppercase',
    color: colors.slate[500],
    lineHeight: 11,
  },
  title: {
    fontFamily: 'Montserrat-Bold',
    fontSize: 32,
    letterSpacing: 32 * -0.02,
    color: colors.ink[900],
    marginTop: 10,
    lineHeight: 33.6,
  },

  cardWrap: { paddingHorizontal: 20 },
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
  cardOverline: {
    fontFamily: 'Montserrat-SemiBold',
    fontSize: 11,
    letterSpacing: 11 * 0.14,
    textTransform: 'uppercase',
    color: colors.slate[500],
  },
  cardName: { fontFamily: 'Montserrat-Bold', fontSize: 17, color: colors.ink[900], marginTop: 6 },
  cardEmail: { fontFamily: 'Montserrat-Regular', fontSize: 13, color: colors.slate[500], marginTop: 2 },

  linkSection: { paddingHorizontal: 20, marginTop: 20 },
  linkSectionLabel: {
    fontFamily: 'Montserrat-Bold',
    fontSize: 10,
    letterSpacing: 10 * 0.16,
    textTransform: 'uppercase',
    color: colors.slate[500],
    marginBottom: 8,
  },
  linkCard: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: colors.brand[100],
    borderWidth: 1,
    borderColor: colors.brand[600],
    borderRadius: 12,
    paddingHorizontal: 14,
    paddingVertical: 12,
    gap: 10,
  },
  linkUrl: {
    flex: 1,
    fontFamily: 'Montserrat-SemiBold',
    fontSize: 13,
    color: colors.brand[600],
  },
  shareBtn: {
    backgroundColor: colors.brand[600],
    borderRadius: 8,
    paddingHorizontal: 14,
    paddingVertical: 8,
  },
  shareBtnText: {
    fontFamily: 'Montserrat-SemiBold',
    fontSize: 12,
    color: '#ffffff',
  },
  linkHint: {
    marginTop: 7,
    fontFamily: 'Montserrat-Regular',
    fontSize: 11,
    color: colors.slate[400],
    lineHeight: 16,
  },

  signOutWrap: { paddingHorizontal: 20, paddingTop: 32 },
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

  footer: {
    textAlign: 'center',
    fontFamily: 'Montserrat-Regular',
    fontSize: 11,
    color: colors.slate[400],
    marginTop: 24,
    letterSpacing: 11 * 0.08,
  },
});
