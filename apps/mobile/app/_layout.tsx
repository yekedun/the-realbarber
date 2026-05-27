import { Stack, useRouter, useSegments } from 'expo-router';
import { useFonts } from 'expo-font';
import * as SplashScreen from 'expo-splash-screen';
import { useEffect, useRef, useState } from 'react';
import { Session } from '@supabase/supabase-js';
import { supabase, determineUserRole } from '../lib/supabase';
import { isPublicAuthRoute, routeForRole, shouldSkipRoleRouting } from '../lib/router-guard';

SplashScreen.preventAutoHideAsync();

export default function RootLayout() {
  const [loaded] = useFonts({
    'Montserrat-Regular': require('../assets/fonts/Montserrat-Regular.otf'),
    'Montserrat-Medium': require('../assets/fonts/Montserrat-Medium.otf'),
    'Montserrat-SemiBold': require('../assets/fonts/Montserrat-SemiBold.otf'),
    'Montserrat-Bold': require('../assets/fonts/Montserrat-Bold.otf'),
  });
  const [session, setSession] = useState<Session | null | undefined>(undefined);
  const router = useRouter();
  const segments = useSegments();
  const firstSegment = segments[0];
  const routedRef = useRef(false);

  useEffect(() => {
    supabase.auth.getSession().then(({ data: { session } }) => setSession(session));
    const { data: { subscription } } = supabase.auth.onAuthStateChange((_e, newSession) => {
      routedRef.current = false;
      setSession(newSession);
    });
    return () => subscription.unsubscribe();
  }, []);

  useEffect(() => {
    if (!loaded || session === undefined) return;
    SplashScreen.hideAsync();

    if (!session) {
      if (!isPublicAuthRoute(firstSegment)) router.replace('/(auth)/login');
      return;
    }

    if (shouldSkipRoleRouting(firstSegment)) return;
    if (routedRef.current) return;
    routedRef.current = true;

    determineUserRole(session.user.id).then(role => {
      router.replace(routeForRole(role));
    });
  }, [loaded, session, firstSegment]);

  if (!loaded || session === undefined) return null;
  return <Stack screenOptions={{ headerShown: false }} />;
}
