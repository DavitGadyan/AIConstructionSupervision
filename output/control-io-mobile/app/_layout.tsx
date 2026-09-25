import { useEffect } from "react";
import { Stack, useRootNavigationState, useRouter, useSegments } from "expo-router";
import { StatusBar } from "expo-status-bar";
import { useFonts } from "expo-font";
import * as SplashScreen from "expo-splash-screen";
import { SafeAreaProvider } from "react-native-safe-area-context";
import {
  SpaceGrotesk_500Medium,
  SpaceGrotesk_600SemiBold,
  SpaceGrotesk_700Bold,
} from "@expo-google-fonts/space-grotesk";
import { Inter_400Regular, Inter_500Medium, Inter_600SemiBold, Inter_700Bold } from "@expo-google-fonts/inter";
import { theme } from "@/lib/theme";
import { SessionProvider, useSession } from "@/lib/session";
import { LiveProvider } from "@/lib/live";
import { useReduceMotion } from "@/lib/hooks";
import { OrderToast } from "@/components/OrderToast";

// Hold the splash until fonts are in, so the first frame is set in the right
// face rather than flashing a system font and then swapping.
SplashScreen.preventAutoHideAsync().catch(() => {});

/** Screens anyone may see without a session. */
const PUBLIC = new Set(["onboarding", "login"]);

/**
 * The tab group gates itself (app/(tabs)/_layout.tsx). Stack screens pushed
 * above it (flights, order/[id], documents, ...) are not re-rendered by that
 * gate, so a sign-out, an expired token (401) or a deep link / web reload
 * without a session would leave them on screen with no token. Send those back
 * through onboarding -> login -> project picker.
 */
function useStackGuard() {
  const { ready, onboarded, token, projectId } = useSession();
  const segments = useSegments();
  const nav = useRootNavigationState();
  const router = useRouter();
  const top = segments[0] as string | undefined;
  const navReady = !!nav?.key;

  useEffect(() => {
    if (!ready || !navReady || !top || top === "(tabs)" || PUBLIC.has(top)) return;
    if (!onboarded) router.replace("/onboarding");
    else if (!token) router.replace("/login");
    else if (!projectId && top !== "projects") router.replace("/projects");
  }, [ready, navReady, top, onboarded, token, projectId, router]);
}

function Shell() {
  const { ready, token, projectId } = useSession();
  useStackGuard();
  // Reduce Motion: screens swap without sliding or fading
  const reduce = useReduceMotion();
  const anim = <T extends string>(a: T) => (reduce ? ("none" as const) : a);
  // Wait for the stored session (a local read) so a deep link or web reload of a
  // stack screen never renders, and fetches, with an empty token/project.
  if (!ready) return null;
  return (
    <LiveProvider token={token} projectId={projectId}>
      <StatusBar style={theme.mode === "dark" ? "light" : "dark"} />
      <Stack
        screenOptions={{
          headerShown: false,
          contentStyle: { backgroundColor: theme.colors.ground },
          animation: anim("default"),
        }}
      >
        <Stack.Screen name="(tabs)" />
        <Stack.Screen name="onboarding" options={{ animation: anim("fade") }} />
        <Stack.Screen name="login" options={{ animation: anim("fade") }} />
        <Stack.Screen name="projects" />

        {/* v1.1: ordering and tracking (screens by the order unit) */}
        <Stack.Screen name="new-order" options={{ presentation: "modal" }} />
        <Stack.Screen name="order/[id]" />
        <Stack.Screen name="company-edit" options={{ presentation: "modal" }} />

        {/* project detail */}
        <Stack.Screen name="documents" />
        <Stack.Screen name="map" options={{ presentation: "fullScreenModal", animation: anim("fade") }} />

        {/* moved out of the tab bar in v1.1 (same URLs) */}
        <Stack.Screen name="flights" />
        <Stack.Screen name="model" />
        <Stack.Screen name="reports" />
        <Stack.Screen name="settings" />

        <Stack.Screen name="upload" options={{ presentation: "modal" }} />
        <Stack.Screen
          name="shot"
          options={{ presentation: "fullScreenModal", contentStyle: { backgroundColor: theme.colors.scrim } }}
        />
      </Stack>
      {/* in-app banner for order status changes + taps on order notifications (mounted once) */}
      <OrderToast />
    </LiveProvider>
  );
}

export default function RootLayout() {
  const [loaded, error] = useFonts({
    SpaceGrotesk_500Medium,
    SpaceGrotesk_600SemiBold,
    SpaceGrotesk_700Bold,
    Inter_400Regular,
    Inter_500Medium,
    Inter_600SemiBold,
    Inter_700Bold,
  });

  useEffect(() => {
    if (loaded || error) SplashScreen.hideAsync().catch(() => {});
  }, [loaded, error]);

  if (!loaded && !error) return null;

  return (
    <SafeAreaProvider>
      <SessionProvider>
        <Shell />
      </SessionProvider>
    </SafeAreaProvider>
  );
}
