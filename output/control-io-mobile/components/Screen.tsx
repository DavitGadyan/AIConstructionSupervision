import type { ReactNode } from "react";
import { RefreshControl, ScrollView, StyleSheet, View, type StyleProp, type ViewStyle } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { theme } from "@/lib/theme";
import { Ground } from "./ui";

/**
 * Every screen: gradient ground, safe-area top, scroll view with room at the
 * bottom for the floating tab bar. Pass `scroll={false}` for full-bleed
 * screens (3D) that manage their own layout.
 */
export function Screen({
  children,
  refreshing,
  onRefresh,
  scroll = true,
  tabs = true,
  contentStyle,
}: {
  children: ReactNode;
  refreshing?: boolean;
  onRefresh?: () => void;
  scroll?: boolean;
  tabs?: boolean;
  contentStyle?: StyleProp<ViewStyle>;
}) {
  const bottom = tabs ? theme.spacing.tabClearance : theme.spacing.xxl;
  return (
    <Ground>
      <SafeAreaView style={styles.safe} edges={["top", "left", "right"]}>
        {scroll ? (
          <ScrollView
            contentContainerStyle={[styles.content, { paddingBottom: bottom }, contentStyle]}
            showsVerticalScrollIndicator={false}
            refreshControl={
              onRefresh ? (
                <RefreshControl
                  refreshing={!!refreshing}
                  onRefresh={onRefresh}
                  tintColor={theme.colors.accent}
                  colors={[theme.colors.accent]}
                />
              ) : undefined
            }
          >
            {children}
          </ScrollView>
        ) : (
          <View style={[styles.content, styles.fill, { paddingBottom: bottom - theme.spacing.xl }, contentStyle]}>
            {children}
          </View>
        )}
      </SafeAreaView>
    </Ground>
  );
}

const styles = StyleSheet.create({
  safe: { flex: 1 },
  fill: { flex: 1 },
  content: {
    paddingHorizontal: theme.spacing.gutter,
    paddingTop: theme.spacing.sm,
    gap: theme.spacing.md,
  },
});
