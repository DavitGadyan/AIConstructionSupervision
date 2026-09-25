import { useState } from "react";
import { ScrollView, StyleSheet, Text, View } from "react-native";
import { Image } from "expo-image";
import { useLocalSearchParams, useRouter } from "expo-router";
import { SafeAreaView } from "react-native-safe-area-context";
import { imageSource } from "@/lib/api";
import { useLive } from "@/lib/live";
import { useAuthed } from "@/lib/session";
import { coord, dateTime, titleCase } from "@/lib/format";
import { theme } from "@/lib/theme";
import { EmptyState, SquareButton } from "@/components/ui";

/** Full-screen drone shot with evidence metadata. */
export default function ShotViewer() {
  const { flightId, shotId } = useLocalSearchParams<{ flightId: string; shotId: string }>();
  const { token } = useAuthed();
  const { flights } = useLive();
  const router = useRouter();
  const [failed, setFailed] = useState(false);
  const [showMeta, setShowMeta] = useState(true);

  const flight = flights?.find((f) => f.id === flightId);
  const shot = flight?.shots.find((s) => s.id === shotId);
  const close = () => (router.canGoBack() ? router.back() : router.replace("/flights"));

  return (
    <View style={styles.root}>
      {shot && !failed ? (
        <Image
          source={imageSource(shot.url, token)}
          placeholder={imageSource(shot.thumbUrl, token)}
          style={StyleSheet.absoluteFill}
          contentFit="contain"
          transition={200}
          onError={() => setFailed(true)}
          accessible
          accessibilityLabel={`Drone shot ${shot.label ?? shot.view ?? ""}`}
        />
      ) : null}
      <SafeAreaView style={styles.safe} edges={["top", "bottom"]}>
        <View style={styles.top}>
          <SquareButton icon="x" label="Close" onPress={close} variant="onAccent" />
          {shot ? (
            <SquareButton
              icon={showMeta ? "eye-off" : "info"}
              label={showMeta ? "Hide details" : "Show details"}
              onPress={() => setShowMeta((v) => !v)}
              variant="onAccent"
            />
          ) : null}
        </View>

        {!shot ? (
          <View style={styles.center}>
            <View style={styles.missing}>
              <EmptyState icon="image" title="Shot not found" body="It may belong to a flight that is no longer loaded." />
            </View>
          </View>
        ) : failed ? (
          <View style={styles.center}>
            <View style={styles.missing}>
              <EmptyState icon="wifi-off" title="Couldn't load image" body="Check your connection and try again." />
            </View>
          </View>
        ) : (
          <View style={{ flex: 1 }} pointerEvents="none" />
        )}

        {shot && showMeta ? (
          <View style={styles.meta}>
            <Text style={styles.metaTitle}>{shot.label ?? titleCase(shot.view) ?? "Drone shot"}</Text>
            <ScrollView style={{ maxHeight: 220 }} contentContainerStyle={{ gap: theme.spacing.sm }}>
              <Row k="Captured" v={dateTime(shot.capturedAt ?? flight?.capturedAt)} />
              <Row k="View" v={titleCase(shot.view) || "-"} />
              <Row k="GPS" v={`${coord(shot.lat)}, ${coord(shot.lng, "E", "W")}`} />
              <Row k="Altitude" v={shot.altM != null ? `${shot.altM.toFixed(1)} m` : "-"} />
              <Row k="SHA-256" v={shot.sha256 ?? "-"} mono />
            </ScrollView>
          </View>
        ) : null}
      </SafeAreaView>
    </View>
  );
}

function Row({ k, v, mono }: { k: string; v: string; mono?: boolean }) {
  return (
    <View style={styles.row} accessible accessibilityLabel={`${k}: ${v}`}>
      <Text style={styles.k}>{k}</Text>
      <Text style={[styles.v, mono && styles.mono]} selectable>
        {v}
      </Text>
    </View>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: theme.colors.scrim },
  safe: { flex: 1, padding: theme.spacing.gutter },
  top: { flexDirection: "row", justifyContent: "space-between" },
  center: { flex: 1, justifyContent: "center" },
  missing: { backgroundColor: theme.colors.glassStrong, borderRadius: theme.radius.card },
  meta: {
    backgroundColor: theme.colors.overlay,
    borderRadius: theme.radius.card - 8,
    borderWidth: 1,
    borderColor: theme.colors.onAccentBorder,
    padding: theme.spacing.lg,
    gap: theme.spacing.md,
  },
  metaTitle: { fontFamily: theme.fonts.displaySemi, fontSize: theme.type.h2, color: theme.colors.onAccent },
  row: { flexDirection: "row", gap: theme.spacing.md },
  k: { width: 76, fontFamily: theme.fonts.body, fontSize: theme.type.small, color: theme.colors.overlayText },
  v: { flex: 1, fontFamily: theme.fonts.bodyMedium, fontSize: theme.type.small, color: theme.colors.onAccent },
  mono: { fontFamily: theme.fonts.body, fontSize: theme.type.micro, letterSpacing: 0.3 },
});
