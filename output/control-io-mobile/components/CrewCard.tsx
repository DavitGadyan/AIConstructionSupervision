import { Linking, StyleSheet, Text, View, type StyleProp, type ViewStyle } from "react-native";
import { Feather, MaterialCommunityIcons } from "@expo/vector-icons";
import { isActiveStatus, type Crew, type OrderStatus } from "@/lib/api";
import { initials, telHref } from "@/lib/format";
import { theme } from "@/lib/theme";
import { AccentCard, Button, CardHeader } from "./ui";

/**
 * ORDI accent card for the assigned crew: pilot, vehicle + plate, drone, and
 * a white "Call pilot" button (tel:). Before dispatch there is no crew yet:
 * the card says when it will appear instead of showing empty rows.
 */
export function CrewCard({
  crew,
  status,
  canCall,
  onCallError,
  style,
}: {
  crew: Crew | null;
  /** order status: calling is offered only while the order is running */
  status?: OrderStatus;
  /** override the default (running order + phone on file) */
  canCall?: boolean;
  /** tel: not supported (tablet / web without a handler) */
  onCallError?: (message: string) => void;
  style?: StyleProp<ViewStyle>;
}) {
  if (!crew) {
    return (
      <AccentCard style={[{ gap: theme.spacing.md }, style]}>
        <CardHeader title="Your crew" subtitle="Assigned when the car sets off" tone="onAccent" />
        <View style={styles.sub}>
          <MaterialCommunityIcons name="car-clock" size={22} color={theme.colors.onAccent} />
          <Text style={styles.subText}>
            {status === "cancelled"
              ? "No crew was dispatched for this order."
              : "We'll show the pilot, vehicle and plate here, with a button to call them."}
          </Text>
        </View>
      </AccentCard>
    );
  }

  const tel = telHref(crew.pilotPhone);
  const callable = (canCall ?? (status ? isActiveStatus(status) : true)) && !!tel;
  const call = async () => {
    if (!tel) return;
    try {
      await Linking.openURL(tel);
    } catch {
      onCallError?.(`Couldn't start a call. The pilot's number is ${crew.pilotPhone}.`);
    }
  };

  return (
    <AccentCard style={[{ gap: theme.spacing.md }, style]}>
      <CardHeader title="Your crew" subtitle={crew.vehicle} tone="onAccent" />
      <View
        style={styles.pilot}
        accessible
        accessibilityLabel={`Pilot ${crew.pilot}${crew.pilotPhone ? `, phone ${crew.pilotPhone}` : ""}`}
      >
        <View style={styles.avatar}>
          <Text style={styles.avatarText}>{initials(crew.pilot)}</Text>
        </View>
        <View style={{ flex: 1 }}>
          <Text style={styles.pilotName}>{crew.pilot}</Text>
          <Text style={styles.muted}>Pilot{crew.pilotPhone ? ` · ${crew.pilotPhone}` : ""}</Text>
        </View>
      </View>
      <View style={styles.facts}>
        <View style={styles.fact} accessible accessibilityLabel={`Number plate ${crew.plate.split("").join(" ")}`}>
          <Feather name="truck" size={16} color={theme.colors.onAccent} />
          <View style={{ flex: 1 }}>
            <Text style={styles.factLabel}>Plate</Text>
            <Text style={styles.factValue}>{crew.plate}</Text>
          </View>
        </View>
        <View style={styles.fact} accessible accessibilityLabel={`Drone ${crew.drone}`}>
          <MaterialCommunityIcons name="quadcopter" size={18} color={theme.colors.onAccent} />
          <View style={{ flex: 1 }}>
            <Text style={styles.factLabel}>Drone</Text>
            <Text style={styles.factValue} numberOfLines={2}>
              {crew.drone}
            </Text>
          </View>
        </View>
      </View>
      {callable ? (
        <Button title="Call pilot" icon="phone" variant="white" onPress={call} label={`Call ${crew.pilot}, ${crew.pilotPhone}`} />
      ) : null}
    </AccentCard>
  );
}

const styles = StyleSheet.create({
  sub: {
    flexDirection: "row",
    alignItems: "center",
    gap: theme.spacing.md,
    backgroundColor: theme.colors.onAccentCard,
    borderRadius: theme.radius.inner,
    borderWidth: 1,
    borderColor: theme.colors.onAccentBorder,
    padding: theme.spacing.md,
  },
  subText: {
    flex: 1,
    fontFamily: theme.fonts.body,
    fontSize: theme.type.small + 1,
    lineHeight: (theme.type.small + 1) * 1.4,
    color: theme.colors.onAccentMuted,
  },
  pilot: {
    flexDirection: "row",
    alignItems: "center",
    gap: theme.spacing.md,
    backgroundColor: theme.colors.onAccentCard,
    borderRadius: theme.radius.inner,
    borderWidth: 1,
    borderColor: theme.colors.onAccentBorder,
    padding: theme.spacing.md,
  },
  avatar: {
    width: theme.tap,
    height: theme.tap,
    borderRadius: theme.radius.btn,
    backgroundColor: theme.colors.surface,
    alignItems: "center",
    justifyContent: "center",
  },
  avatarText: { fontFamily: theme.fonts.displayBold, fontSize: theme.type.label, color: theme.colors.accent },
  pilotName: { fontFamily: theme.fonts.displaySemi, fontSize: theme.type.h3, color: theme.colors.onAccent },
  muted: { fontFamily: theme.fonts.body, fontSize: theme.type.small, color: theme.colors.onAccentMuted, marginTop: 2 },
  facts: { flexDirection: "row", gap: theme.spacing.sm },
  fact: {
    flex: 1,
    flexDirection: "row",
    alignItems: "flex-start",
    gap: theme.spacing.sm,
    backgroundColor: theme.colors.onAccentCard,
    borderRadius: theme.radius.inner,
    borderWidth: 1,
    borderColor: theme.colors.onAccentBorder,
    padding: theme.spacing.md,
  },
  factLabel: { fontFamily: theme.fonts.body, fontSize: theme.type.micro + 1, color: theme.colors.onAccentMuted },
  factValue: { fontFamily: theme.fonts.bodySemi, fontSize: theme.type.label - 1, color: theme.colors.onAccent, marginTop: 2 },
});
