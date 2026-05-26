import { NativeModules } from 'react-native';
import { supabase } from './supabase';

function getGoogleSignin() {
  if (!NativeModules.RNGoogleSignin) return null;

  try {
    return require('@react-native-google-signin/google-signin').GoogleSignin;
  } catch {
    return null;
  }
}

export function configureGoogleSignIn() {
  const GoogleSignin = getGoogleSignin();
  if (!GoogleSignin) return;

  GoogleSignin.configure({
    webClientId: process.env.EXPO_PUBLIC_GOOGLE_WEB_CLIENT_ID!,
    offlineAccess: false,
  });
}

export async function signInWithGoogle(): Promise<{ error?: string }> {
  const GoogleSignin = getGoogleSignin();
  if (!GoogleSignin) {
    return {
      error: 'Google girişi bu geliştirme sürümünde hazır değil. Dev client veya yeni native build gerekiyor.',
    };
  }

  try {
    await GoogleSignin.hasPlayServices({ showPlayServicesUpdateDialog: true });
    const userInfo = await GoogleSignin.signIn();
    const idToken = userInfo.data?.idToken ?? (userInfo as any).idToken;
    if (!idToken) return { error: 'Google token alınamadı' };

    const { error } = await supabase.auth.signInWithIdToken({
      provider: 'google',
      token: idToken,
    });
    if (error) return { error: error.message };
    return {};
  } catch (e: any) {
    if (e.code === 'SIGN_IN_CANCELLED') return { error: 'İptal edildi' };
    return { error: 'Google ile giriş başarısız' };
  }
}
