import { useCallback, useState, type ComponentProps, type ReactNode } from "react";
import { Platform, Pressable, StyleSheet, Text, View } from "react-native";
import { BlurView } from "expo-blur";
import { Feather, MaterialCommunityIcons } from "@expo/vector-icons";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import * as Haptics from "expo-haptics";
import { useRouter, type Href, type Tabs } from "expo-router";
import type { Order } from "@/lib/api";
import { useLive } from "@/lib/live";
import { useRoles } from "@/lib/roles";
import { theme } from "@/lib/theme";
import { Button, Sheet, type FeatherName } from "./ui";

export type TabBarProps = Parameters<NonNullable<ComponentProps<typeof Tabs>["tabBar"]>>[0];

const ICONS: Record<string, { label: string; icon: (color: string) => ReactNode }> = {
  index: { label: "Home", icon: (c) => <Feather name="home" size={20} color={c} /> },
  project: {
    label: "Project",
    icon: (c) => <MaterialCommunityIcons name="office-building-outline" size={22} color={c} />,
  },
  activity: { label: "Activity: orders and reports", icon: (c) => <Feather name="activity" size={20} color={c} /> },
  company: { label: "Company", icon: (c) => <Feather name="briefcase" size={20} color={c} /> },
};

/* ------------------------------------------------------------------ order action */

export type OrderActionMode = "track" | "order" | "blocked";

/**
 * The one "Order" action the app offers everywhere (centre tab button, Home
 * card, Project button), so they always agree:
 *  - an order is running on this project -> "Track" /order/[id] (viewers too)
 *  - the user may order                  -> /new-order ("Revision" for inspectors)
 *  - viewer / read-only share            -> an explanation sheet
 * Render `sheet` once wherever `open` is used.
 */
export function useOrderAction() {
  const router = useRouter();
  const { activeOrder } = useLive();
  const roles = useRoles();
  const [explain, setExplain] = useState(false);

  const mode: OrderActionMode = activeOrder ? "track" : roles.canOrder ? "order" : "blocked";
  const shortLabel = mode === "track" ? "Track" : roles.orderLabel;
  const label =
    mode === "track"
      ? `Track ${activeOrder!.number}`
      : roles.isInspector
        ? "Order revision"
        : "Order inspection";
  const hint =
    mode === "track"
      ? "Opens the running inspection"
      : mode === "order"
        ? "Opens the order form"
        : "Explains why ordering isn't available to you";
  const icon: FeatherName = mode === "track" ? "navigation" : mode === "order" ? "plus" : "lock";
  const activeId = activeOrder?.id;

  const open = useCallback(() => {
    if (Platform.OS !== "web") Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium).catch(() => {});
    if (mode === "track" && activeId) router.push(`/order/${activeId}` as Href);
    else if (mode === "order") router.push("/new-order" as Href);
    else setExplain(true);
  }, [mode, activeId, router]);

  const sheet = (
    <OrderBlockedSheet visible={explain} onClose={() => setExplain(false)} reason={roles.orderBlocked} />
  );

  return {
    mode,
    /** "Order" | "Revision" | "Track" (centre button) */
    shortLabel,
    /** "Order inspection" | "Order revision" | "Track INS-2026-0007" */
    label,
    hint,
    icon,
    open,
    sheet,
    activeOrder: activeOrder as Order | null,
    roles,
  };
}

/** Why a viewer / read-only share can't order, and what to do instead. */
export function OrderBlockedSheet({
  visible,
  onClose,
  reason,
}: {
  visible: boolean;
  onClose: () => void;
  reason: { title: string; body: string } | null;
}) {
  return (
    <Sheet
      visible={visible}
      onClose={onClose}
      icon="lock"
      title={reason?.title ?? "Ordering isn't available"}
      body={
        reason?.body ??
        "Your account can follow inspections and open every report. Ask an owner or supervisor to order one."
      }
      actions={<Button title="Got it" onPress={onClose} />}
    >
      <View style={styles.note}>
        <Feather name="eye" size={16} color={theme.colors.accent2} />
        <Text style={styles.noteText}>
          You still get every status change and the independent PDF report as soon as it's ready.
        </Text>
      </View>
    </Sheet>
  );
}

/* ------------------------------------------------------------------ tab bar */

/**
 * ORDI floating pill tab bar: Home · Project · [Order] · Activity · Company.
 * Active tabs fill ink; the raised centre button is the only accent in the
 * bar. It is not a route: it opens the order form, tracks the running order,
 * or explains why ordering is unavailable (useOrderAction).
 */
export function TabBar({ state, navigation, descriptors }: TabBarProps) {
  const insets = useSafeAreaInsets();
  const order = useOrderAction();
  const routes = state.routes.filter(
    (r) => (descriptors[r.key]?.options as { href?: unknown } | undefined)?.href !== null,
  );
  const centreAt = Math.min(2, routes.length);

  const tab = (route: (typeof state.routes)[number]) => {
    const focused = state.routes[state.index]?.key === route.key;
    const meta = ICONS[route.name] ?? {
      label: descriptors[route.key]?.options.title ?? route.name,
      icon: (c: string) => <Feather name="circle" size={20} color={c} />,
    };
    const onPress = () => {
      const event = navigation.emit({ type: "tabPress", target: route.key, canPreventDefault: true });
      if (!focused && !event.defaultPrevented) {
        if (Platform.OS !== "web") Haptics.selectionAsync().catch(() => {});
        navigation.navigate(route.name, route.params);
      }
    };
    return (
      <Pressable
        key={route.key}
        onPress={onPress}
        onLongPress={() => navigation.emit({ type: "tabLongPress", target: route.key })}
        accessibilityRole="tab"
        accessibilityState={{ selected: focused }}
        accessibilityLabel={meta.label}
        hitSlop={3}
        style={({ pressed }) => [styles.tab, focused && styles.tabActive, pressed && !focused && styles.pressed]}
      >
        {meta.icon(focused ? theme.colors.onAccent : theme.colors.ink)}
      </Pressable>
    );
  };

  const blocked = order.mode === "blocked";
  const centre = (
    <Pressable
      key="__order"
      onPress={order.open}
      accessibilityRole="button"
      accessibilityLabel={blocked ? `${order.label}, not available for your role` : order.label}
      accessibilityHint={order.hint}
      style={({ pressed }) => [
        styles.centre,
        blocked && styles.centreBlocked,
        pressed && { backgroundColor: blocked ? theme.colors.accent2 : theme.colors.accentPressed, transform: [{ scale: 0.97 }] },
      ]}
    >
      {order.mode === "order" ? (
        <MaterialCommunityIcons name="quadcopter" size={24} color={theme.colors.onAccent} />
      ) : (
        <Feather name={order.icon} size={20} color={theme.colors.onAccent} />
      )}
      <Text style={styles.centreText} numberOfLines={1} maxFontSizeMultiplier={1.2}>
        {order.shortLabel}
      </Text>
      {order.mode === "track" ? <View style={styles.liveDot} /> : null}
    </Pressable>
  );

  return (
    <View pointerEvents="box-none" style={[styles.wrap, { bottom: Math.max(insets.bottom, theme.spacing.md) }]}>
      <View style={styles.pill} accessibilityRole="tablist">
        {/* the glass layer clips to the pill; the pill itself doesn't, so the centre can rise above it */}
        <View style={styles.glassLayer} pointerEvents="none">
          {Platform.OS !== "android" ? (
            <BlurView intensity={40} tint="light" style={StyleSheet.absoluteFill} />
          ) : null}
        </View>
        {routes.slice(0, centreAt).map(tab)}
        {centre}
        {routes.slice(centreAt).map(tab)}
      </View>
      {order.sheet}
    </View>
  );
}

const TAB = 50;
const CENTRE = 62;

const styles = StyleSheet.create({
  wrap: { position: "absolute", left: 0, right: 0, alignItems: "center" },
  pill: {
    flexDirection: "row",
    alignItems: "flex-end",
    gap: 6,
    padding: 6,
    borderRadius: theme.radius.card - 6,
    borderWidth: 1,
    borderColor: theme.colors.glassBorder,
    ...theme.shadow,
  },
  glassLayer: {
    position: "absolute",
    top: 0,
    right: 0,
    bottom: 0,
    left: 0,
    borderRadius: theme.radius.card - 7,
    overflow: "hidden",
    backgroundColor: theme.colors.glass,
  },
  tab: {
    width: TAB,
    height: TAB,
    borderRadius: theme.radius.inner,
    backgroundColor: theme.colors.surface,
    alignItems: "center",
    justifyContent: "center",
  },
  tabActive: { backgroundColor: theme.colors.ink },
  pressed: { opacity: 0.7 },
  centre: {
    width: CENTRE,
    height: CENTRE,
    // rises ~14pt above the pill without making the pill taller
    marginTop: -(CENTRE - TAB) - 20,
    marginBottom: 6,
    borderRadius: theme.radius.inner + 4,
    backgroundColor: theme.colors.accent,
    borderWidth: 3,
    borderColor: theme.colors.surface,
    alignItems: "center",
    justifyContent: "center",
    gap: 1,
    ...theme.shadow,
    shadowColor: theme.colors.accent,
    shadowOpacity: 0.35,
    shadowRadius: 14,
    elevation: 6,
  },
  centreBlocked: { backgroundColor: theme.colors.accent2, shadowColor: theme.colors.shadow, shadowOpacity: 0.12 },
  centreText: {
    fontFamily: theme.fonts.bodySemi,
    fontSize: theme.type.micro,
    color: theme.colors.onAccent,
    letterSpacing: 0.2,
  },
  liveDot: {
    position: "absolute",
    top: 7,
    right: 8,
    width: 8,
    height: 8,
    borderRadius: 4,
    backgroundColor: theme.colors.onAccent,
  },
  note: {
    flexDirection: "row",
    gap: theme.spacing.sm,
    alignItems: "flex-start",
    backgroundColor: theme.colors.inner,
    borderRadius: theme.radius.inner,
    padding: theme.spacing.md,
  },
  noteText: {
    flex: 1,
    fontFamily: theme.fonts.body,
    fontSize: theme.type.small + 1,
    lineHeight: (theme.type.small + 1) * 1.4,
    color: theme.colors.muted,
  },
});
