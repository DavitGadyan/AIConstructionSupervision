import { StyleSheet, Text, View } from "react-native";
import { useRouter, type Href } from "expo-router";
import { SafeAreaView } from "react-native-safe-area-context";
import { Feather } from "@expo/vector-icons";
import { latLng } from "@/lib/format";
import { useLive } from "@/lib/live";
import { isValidLatLng, openInMaps } from "@/lib/map";
import { useAuthed } from "@/lib/session";
import { theme } from "@/lib/theme";
import { MapPreview } from "@/components/MapCard";
import { Button, EmptyState, ErrorState, Ground, LoadingState, SquareButton } from "@/components/ui";

/**
 * Full-screen site map (Leaflet + OSM, pinch and pan) with the address,
 * coordinates, Directions and Open in Maps. Presented as a full-screen modal
 * from the Project screen's map card.
 */
export default function SiteMap() {
  const router = useRouter();
  const { project: summary } = useAuthed();
  const live = useLive();
  const p = live.profile?.project;
  const point = { lat: p?.lat ?? NaN, lng: p?.lng ?? NaN };
  const valid = isValidLatLng(point);
  const name = p?.name ?? summary?.name ?? "Site";
  const address = p?.address ?? summary?.address;
  const close = () => (router.canGoBack() ? router.back() : router.replace("/project" as Href));

  return (
    <Ground>
      <SafeAreaView style={styles.safe} edges={["top", "bottom", "left", "right"]}>
        <View style={styles.top}>
          <SquareButton icon="x" label="Close map" onPress={close} size={theme.iconButton} />
          <View style={styles.titleChip}>
            <Feather name="map-pin" size={14} color={theme.colors.accent} />
            <Text style={styles.titleText} numberOfLines={1} accessibilityRole="header">
              {name}
            </Text>
          </View>
        </View>

        {/* the map sits in its own frame (not under the header or the sheet) so Leaflet's
            zoom buttons and the OpenStreetMap credit stay visible */}
        {valid ? (
          <MapPreview
            lat={point.lat}
            lng={point.lng}
            label={name}
            zoom={17}
            radiusM={60}
            interactive
            a11yLabel={`Interactive map of ${name}. Pinch to zoom, drag to pan.`}
            style={styles.map}
          />
        ) : (
          <View style={[styles.map, styles.center]}>
            {!p && live.profileError && !live.profileLoading ? (
              <ErrorState message={live.profileError} onRetry={live.refreshProfile} />
            ) : !p ? (
              <LoadingState label="Loading the site…" />
            ) : (
              <EmptyState
                icon="map"
                title="No coordinates on file"
                body="The project owner hasn't set the site location yet. The address is below."
              />
            )}
          </View>
        )}

        <View style={styles.sheet}>
          <View style={{ gap: theme.spacing.xs }}>
            <Text style={styles.name} numberOfLines={2}>
              {name}
            </Text>
            {address ? (
              <Text style={styles.addr} selectable numberOfLines={2}>
                {address}
              </Text>
            ) : null}
            {valid ? (
              <View style={styles.coordRow}>
                <Feather name="crosshair" size={13} color={theme.colors.muted} />
                <Text style={styles.coord} selectable>
                  {latLng(point.lat, point.lng)}
                </Text>
              </View>
            ) : null}
          </View>
          {valid ? (
            <View style={styles.actions}>
              <Button
                title="Directions"
                icon="navigation"
                style={styles.action}
                label={`Directions to ${name}`}
                onPress={() => openInMaps({ ...point, label: name }, { directions: true })}
              />
              <Button
                title="Open in Maps"
                icon="map"
                variant="white"
                style={[styles.action, styles.inner]}
                onPress={() => openInMaps({ ...point, label: name })}
              />
            </View>
          ) : null}
        </View>
      </SafeAreaView>
    </Ground>
  );
}

const styles = StyleSheet.create({
  safe: { flex: 1, paddingHorizontal: theme.spacing.gutter, paddingVertical: theme.spacing.sm, gap: theme.spacing.md },
  map: { flex: 1, borderRadius: theme.radius.inner + 4, backgroundColor: theme.colors.glass },
  top: { flexDirection: "row", alignItems: "center", gap: theme.spacing.sm },
  titleChip: {
    flexShrink: 1,
    minHeight: theme.tap,
    flexDirection: "row",
    alignItems: "center",
    gap: theme.spacing.xs + 2,
    paddingHorizontal: theme.spacing.md + 2,
    borderRadius: theme.radius.round,
    backgroundColor: theme.colors.surface,
    ...theme.shadow,
  },
  titleText: { flexShrink: 1, fontFamily: theme.fonts.bodySemi, fontSize: theme.type.label - 1, color: theme.colors.ink },
  center: { justifyContent: "center" },
  sheet: {
    backgroundColor: theme.colors.surface,
    borderRadius: theme.radius.card,
    padding: theme.spacing.lg,
    gap: theme.spacing.md,
    ...theme.shadow,
    shadowOpacity: 0.14,
  },
  name: {
    fontFamily: theme.fonts.displaySemi,
    fontSize: theme.type.h3 + 2,
    color: theme.colors.ink,
    letterSpacing: -0.3,
  },
  addr: { fontFamily: theme.fonts.body, fontSize: theme.type.small + 1, color: theme.colors.muted },
  coordRow: { flexDirection: "row", alignItems: "center", gap: theme.spacing.xs + 2 },
  coord: { fontFamily: theme.fonts.bodyMedium, fontSize: theme.type.small, color: theme.colors.muted },
  actions: { flexDirection: "row", gap: theme.spacing.sm },
  action: { flex: 1, paddingHorizontal: theme.spacing.md },
  inner: { backgroundColor: theme.colors.inner },
});
