import "react-native-gesture-handler";
import "react-native-reanimated";
import { useCallback, useEffect, useRef, useState } from "react";
import { ActivityIndicator, View } from "react-native";
import { Stack, useRouter, useSegments } from "expo-router";
import { GestureHandlerRootView } from "react-native-gesture-handler";
import { enableFreeze } from "react-native-screens";
import type { Session } from "@supabase/supabase-js";
import { supabase } from "../lib/supabase";
import { getProfile } from "../lib/customer-profiles";
import { T } from "../lib/theme";

enableFreeze(false);

type AuthState = "loading" | "unauthenticated" | "needsSetup" | "ready";

export default function RootLayout() {
  const [authState, setAuthState] = useState<AuthState>("loading");
  const authRequestRef = useRef(0);
  const router = useRouter();
  const segments = useSegments();

  const resolveState = useCallback(async (session: Session | null) => {
    const requestId = ++authRequestRef.current;

    if (!session) {
      if (requestId === authRequestRef.current) {
        setAuthState("unauthenticated");
      }
      return;
    }

    const profile = await getProfile(session.user.id);
    if (requestId === authRequestRef.current) {
      setAuthState(profile ? "ready" : "needsSetup");
    }
  }, []);

  useEffect(() => {
    let mounted = true;

    supabase.auth.getSession().then(({ data: { session } }) => {
      if (mounted) {
        resolveState(session);
      }
    });

    const { data: { subscription } } = supabase.auth.onAuthStateChange((_event, session) => {
      if (mounted) {
        resolveState(session);
      }
    });

    return () => {
      mounted = false;
      authRequestRef.current += 1;
      subscription.unsubscribe();
    };
  }, [resolveState]);

  useEffect(() => {
    if (authState === "loading") return;

    const inAuth = segments[0] === "(auth)";
    const inApp = segments[0] === "(app)";
    const inBooking = segments[0] === "booking";

    if (authState === "unauthenticated" && !inAuth) {
      router.replace("/(auth)/login");
    } else if (authState === "needsSetup" && segments[1] !== "setup") {
      router.replace("/(auth)/setup");
    } else if (authState === "ready" && inAuth) {
      router.replace("/(app)");
    }
    // booking ekranı oturum gerektiriyor ama (app) içinden açılır — redirect yok
    void inApp;
    void inBooking;
  }, [authState, segments, router]);

  return (
    <GestureHandlerRootView style={{ flex: 1 }}>
      {authState === "loading" ? (
        <View style={{ flex: 1, backgroundColor: T.bg, alignItems: "center", justifyContent: "center" }}>
          <ActivityIndicator color={T.navy} />
        </View>
      ) : (
        <Stack
          screenOptions={{
            headerShown: false,
            freezeOnBlur: false,
          }}
        >
          <Stack.Screen name="(auth)" />
          <Stack.Screen name="(app)" />
          <Stack.Screen
            name="booking"
            options={{ presentation: "modal", headerShown: false, animation: "slide_from_bottom" }}
          />
        </Stack>
      )}
    </GestureHandlerRootView>
  );
}
