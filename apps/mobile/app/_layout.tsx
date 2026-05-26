import { Stack, useRouter, useSegments } from 'expo-router';
import { useFonts } from 'expo-font';
import * as SplashScreen from 'expo-splash-screen';
import { useEffect, useRef, useState } from 'react';
import { Session } from '@supabase/supabase-js';
import { supabase, determineUserRole } from '../lib/supabase';

SplashScreen.preventAutoHideAsync();

export default function RootLayout() {
  const [loaded] = useFonts({
    'Montserrat-Regular':  require('../assets/fonts/Montserrat-Regular.otf'),
    'Montserrat-Medium':   require('../assets/fonts/Montserrat-Medium.otf'),
    'Montserrat-SemiBold': require('../assets/fonts/Montserrat-SemiBold.otf'),
    'Montserrat-Bold':     require('../assets/fonts/Montserrat-Bold.otf'),
  });
  const [session, setSession] = useState<Session | null | undefined>(undefined);
  const router = useRouter();
  const segments = useSegments();
  // Guard against infinite routing loop — segments is a new array ref every render
  const routedRef = useRef(false);

  useEffect(() => {
    supabase.auth.getSession().then(({ data: { session } }) => setSession(session));
    const { data: { subscription } } = supabase.auth.onAuthStateChange((_e, newSession) => {
      // Reset routing guard on auth state change (login / logout)
      routedRef.current = false;
      setSession(newSession);
    });
    return () => subscription.unsubscribe();
  }, []);

  useEffect(() => {
    if (!loaded || session === undefined) return;
    SplashScreen.hideAsync();

    if (!session) {
      const inAuth = segments[0] === '(auth)';
      if (!inAuth) router.replace('/(auth)/login');
      return;
    }

    // Already in the correct group — no need to route again
    const inOwner = segments[0] === '(owner)';
    const inApp   = segments[0] === '(app)';
    if (inOwner || inApp) return;

    // Only run role determination once per session
    if (routedRef.current) return;
    routedRef.current = true;

    determineUserRole(session.user.id).then(role => {
      if (role === 'owner')          router.replace('/(owner)');
      else if (role === 'staff')     router.replace('/(app)');
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      else if (role === 'pending')   router.replace('/(auth)/pending' as any);
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      else if (role === 'rejected')  router.replace('/(auth)/pending' as any);
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      else                           router.replace('/(auth)/google-onboarding' as any);
    });
  }, [loaded, session]); // segments intentionally excluded — use routedRef guard instead

  if (!loaded || session === undefined) return null;
  return <Stack screenOptions={{ headerShown: false }} />;
}
