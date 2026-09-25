import { Redirect, Tabs } from "expo-router";
import { useSession } from "@/lib/session";
import { TabBar } from "@/components/TabBar";

/**
 * Auth gate + ORDI floating tab bar. Onboarding -> login -> project picker ->
 * tabs; each redirect only fires when the previous step is done.
 *
 * Tabs: Home · Project · [Order] · Activity · Company. The raised centre Order
 * button is drawn by TabBar and is not a route (it opens /new-order or the
 * running order). Flights, 3D model, Reports, Settings, Documents and Map are
 * stack screens registered in the root layout.
 */
export default function TabsLayout() {
  const { ready, onboarded, token, projectId } = useSession();
  if (!ready) return null;
  if (!onboarded) return <Redirect href="/onboarding" />;
  if (!token) return <Redirect href="/login" />;
  if (!projectId) return <Redirect href="/projects" />;

  return (
    <Tabs screenOptions={{ headerShown: false }} tabBar={(props) => <TabBar {...props} />}>
      <Tabs.Screen name="index" options={{ title: "Home" }} />
      <Tabs.Screen name="project" options={{ title: "Project" }} />
      <Tabs.Screen name="activity" options={{ title: "Activity" }} />
      <Tabs.Screen name="company" options={{ title: "Company" }} />
    </Tabs>
  );
}
