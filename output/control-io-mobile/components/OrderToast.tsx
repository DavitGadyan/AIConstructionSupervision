import { useEffect, useRef, useState } from "react";
import { AccessibilityInfo, Animated, Easing, Platform, Pressable, StyleSheet, Text, View } from "react-native";
import { Feather } from "@expo/vector-icons";
import { usePathname, useRouter, type Href } from "expo-router";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { announce, useReduceMotion } from "@/lib/hooks";
import { useLive } from "@/lib/live";
import { useOrderNotificationTaps } from "@/lib/notify";
import { statusColorFor, statusLabel } from "@/lib/orders";
import { theme } from "@/lib/theme";
import { SquareButton } from "./ui";

/**
 * In-app banner for order status changes (the live provider's orderNotice),
 * and the handler for taps on order notifications. Mount once, above the
 * navigator (root layout). Stays out of the way on the order's own tracking
 * screen, which announces changes itself. Auto-hides after 5 s (12 s with a
 * screen reader on); tap opens /order/[id].
 */
export function OrderToast({ onOpen, top }: { onOpen?: (orderId: string) => void; top?: number }) {
  const live = useLive();
  const router = useRouter();
  const pathname = usePathname();
  const insets = useSafeAreaInsets();
  const reduce = useReduceMotion();
  const notice = live.orderNotice;
  const { dismissOrderNotice } = live;
  const anim = useRef(new Animated.Value(0)).current;
  const [screenReader, setScreenReader] = useState(false);

  const open = (orderId: string) => {
    if (onOpen) onOpen(orderId);
    else router.push(`/order/${orderId}` as Href);
  };
  useOrderNotificationTaps(open);

  useEffect(() => {
    AccessibilityInfo.isScreenReaderEnabled()
      .then(setScreenReader)
      .catch(() => {});
    const sub = AccessibilityInfo.addEventListener("screenReaderChanged", setScreenReader);
    return () => sub?.remove();
  }, []);

  const onOwnScreen = !!notice && pathname === `/order/${notice.orderId}`;
  const visible = !!notice && !onOwnScreen;

  // the tracking screen shows it already: drop the notice
  useEffect(() => {
    if (onOwnScreen) dismissOrderNotice();
  }, [onOwnScreen, dismissOrderNotice]);

  useEffect(() => {
    if (!visible || !notice) return;
    if (reduce) anim.setValue(1);
    else {
      anim.setValue(0);
      Animated.timing(anim, {
        toValue: 1,
        duration: theme.motion.base,
        easing: Easing.out(Easing.cubic),
        useNativeDriver: Platform.OS !== "web",
      }).start();
    }
    // iOS has no live regions: announce explicitly (Android/web use accessibilityLiveRegion)
    if (Platform.OS === "ios") announce(`${statusLabel(notice.status)}, ${notice.number}. ${notice.message}`);
    const t = setTimeout(dismissOrderNotice, screenReader ? 12_000 : theme.motion.toast);
    return () => clearTimeout(t);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [notice?.key, visible]);

  if (!visible || !notice) return null;

  const color = statusColorFor(notice.status);
  const translateY = anim.interpolate({ inputRange: [0, 1], outputRange: [-16, 0] });

  return (
    <View pointerEvents="box-none" style={[styles.wrap, { top: top ?? insets.top + theme.spacing.sm }]}>
      <Animated.View
        style={[styles.card, { opacity: anim, transform: reduce ? [] : [{ translateY }] }]}
        accessibilityLiveRegion="polite"
      >
        <Pressable
          onPress={() => {
            dismissOrderNotice();
            open(notice.orderId);
          }}
          accessibilityRole="button"
          accessibilityLabel={`${statusLabel(notice.status)}, ${notice.number}, ${notice.projectName}. ${notice.message}`}
          accessibilityHint="Opens the order"
          style={({ pressed }) => [styles.body, pressed && { opacity: 0.75 }]}
        >
          <View style={[styles.icon, { backgroundColor: notice.status === "delivered" ? theme.colors.okSoft : notice.status === "delayed" ? theme.colors.warnSoft : theme.colors.accentSoft }]}>
            <Feather
              name={notice.status === "delivered" ? "file-text" : notice.status === "cancelled" ? "x-circle" : notice.status === "delayed" ? "alert-triangle" : "truck"}
              size={18}
              color={color}
            />
          </View>
          <View style={{ flex: 1, minWidth: 0 }}>
            <Text style={styles.title} numberOfLines={1}>
              {statusLabel(notice.status)} · {notice.number}
            </Text>
            <Text style={styles.message} numberOfLines={2}>
              {notice.message}
            </Text>
          </View>
        </Pressable>
        <SquareButton icon="x" label="Dismiss" variant="inner" onPress={dismissOrderNotice} />
      </Animated.View>
    </View>
  );
}

const styles = StyleSheet.create({
  wrap: {
    position: "absolute",
    left: theme.spacing.gutter,
    right: theme.spacing.gutter,
    zIndex: 1000,
    elevation: 12,
    alignItems: "center",
  },
  card: {
    width: "100%",
    maxWidth: 520,
    flexDirection: "row",
    alignItems: "center",
    gap: theme.spacing.sm,
    backgroundColor: theme.colors.surface,
    borderRadius: theme.radius.inner + 6,
    paddingVertical: theme.spacing.sm,
    paddingLeft: theme.spacing.md,
    paddingRight: theme.spacing.sm,
    ...theme.shadow,
    shadowOpacity: 0.16,
    elevation: 12,
  },
  body: { flex: 1, flexDirection: "row", alignItems: "center", gap: theme.spacing.md, minHeight: theme.tap },
  icon: {
    width: 40,
    height: 40,
    borderRadius: theme.radius.btn - 2,
    alignItems: "center",
    justifyContent: "center",
  },
  title: { fontFamily: theme.fonts.bodySemi, fontSize: theme.type.label - 1, color: theme.colors.ink },
  message: {
    fontFamily: theme.fonts.body,
    fontSize: theme.type.small,
    lineHeight: theme.type.small * 1.35,
    color: theme.colors.muted,
    marginTop: 1,
  },
});
