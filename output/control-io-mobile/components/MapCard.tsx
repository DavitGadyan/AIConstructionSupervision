import { createElement, useEffect, useMemo, useRef, useState } from "react";
import { Platform, Pressable, StyleSheet, Text, View, type StyleProp, type ViewStyle } from "react-native";
import { WebView } from "react-native-webview";
import { Feather } from "@expo/vector-icons";
import { latLng } from "@/lib/format";
import { isValidLatLng, leafletHtml, MAP_BASE_URL, openInMaps } from "@/lib/map";
import { theme } from "@/lib/theme";
import { Button, CardHeader, GlassCard } from "./ui";

type MapState = "loading" | "ready" | "error";

/**
 * Leaflet + OSM map in a WebView (iframe srcDoc on web). Non-interactive by
 * default: a transparent button on top takes the tap (`onPress`), so the
 * page never steals scroll gestures. `interactive` for the full /map screen.
 */
export function MapPreview({
  lat,
  lng,
  label,
  zoom = 16,
  interactive = false,
  radiusM,
  onPress,
  a11yLabel,
  style,
}: {
  lat: number;
  lng: number;
  label?: string;
  zoom?: number;
  interactive?: boolean;
  radiusM?: number;
  /** tap on a static preview (default: open the site in Maps) */
  onPress?: () => void;
  a11yLabel?: string;
  style?: StyleProp<ViewStyle>;
}) {
  const [state, setState] = useState<MapState>("loading");
  const iframeRef = useRef<{ contentWindow: unknown } | null>(null);
  const html = useMemo(
    () => leafletHtml({ lat, lng, zoom, label, interactive, radiusM }),
    [lat, lng, zoom, label, interactive, radiusM],
  );
  const press = onPress ?? (() => openInMaps({ lat, lng, label }));

  // web: the iframe posts "ready"/"error" to the parent
  useEffect(() => {
    if (Platform.OS !== "web" || typeof window === "undefined") return;
    const onMsg = (e: MessageEvent) => {
      const d = e.data as { source?: string; type?: string } | undefined;
      // several maps can be on screen: only listen to our own frame
      if (d?.source !== "cio-map" || e.source !== iframeRef.current?.contentWindow) return;
      if (d.type === "ready") setState("ready");
      if (d.type === "error") setState("error");
    };
    window.addEventListener("message", onMsg);
    return () => window.removeEventListener("message", onMsg);
  }, []);

  useEffect(() => setState("loading"), [html]);

  const title = a11yLabel ?? `Map of ${label ?? "the site"}`;
  const frame =
    Platform.OS === "web" ? (
      createElement("iframe", {
        ref: iframeRef,
        srcDoc: html,
        title,
        // not sandboxed: an opaque-origin frame sends no Referer and OSM refuses tiles without one.
        // The page is our own template; Leaflet is pinned with SRI.
        referrerPolicy: "strict-origin-when-cross-origin",
        tabIndex: interactive ? 0 : -1,
        "aria-hidden": interactive ? undefined : true,
        style: { border: 0, width: "100%", height: "100%", display: "block", pointerEvents: interactive ? "auto" : "none" },
      })
    ) : (
      <WebView
        source={{ html, baseUrl: MAP_BASE_URL }}
        originWhitelist={["*"]}
        style={styles.web}
        javaScriptEnabled
        domStorageEnabled={false}
        scrollEnabled={interactive}
        bounces={false}
        overScrollMode="never"
        setBuiltInZoomControls={false}
        showsHorizontalScrollIndicator={false}
        showsVerticalScrollIndicator={false}
        onMessage={(e) => {
          const m = e.nativeEvent.data;
          if (m === "ready") setState("ready");
          if (m === "error") setState("error");
        }}
        onError={() => setState("error")}
        accessibilityElementsHidden={!interactive}
        importantForAccessibility={interactive ? "auto" : "no-hide-descendants"}
        accessibilityLabel={interactive ? title : undefined}
      />
    );

  return (
    <View style={[styles.frame, style]}>
      <View style={StyleSheet.absoluteFill} pointerEvents={interactive ? "auto" : "none"}>
        {frame}
      </View>
      {state !== "ready" ? (
        <View style={[StyleSheet.absoluteFill, styles.placeholder]} pointerEvents="none">
          <View style={styles.pin}>
            <Feather name={state === "error" ? "map" : "map-pin"} size={18} color={theme.colors.accent} />
          </View>
          <Text style={styles.placeholderText}>
            {state === "error" ? `Map unavailable offline\n${latLng(lat, lng)}` : "Loading map…"}
          </Text>
        </View>
      ) : null}
      {!interactive ? (
        <Pressable
          onPress={press}
          style={StyleSheet.absoluteFill}
          accessibilityRole="button"
          accessibilityLabel={title}
          accessibilityHint={onPress ? "Opens the site map" : "Opens the site in your maps app"}
        />
      ) : null}
    </View>
  );
}

/**
 * Project "Site location" card: static map preview, address, coordinates,
 * and Open in Maps / Directions. Tapping the map opens `onOpenMap` (the /map
 * screen) when given, else the native Maps app.
 */
export function MapCard({
  lat,
  lng,
  title = "Site location",
  address,
  label,
  height = theme.mapHeight,
  onOpenMap,
  showActions = true,
  style,
}: {
  lat?: number | null;
  lng?: number | null;
  title?: string;
  address?: string | null;
  /** marker / Maps label, usually the project name */
  label?: string;
  height?: number;
  onOpenMap?: () => void;
  showActions?: boolean;
  style?: StyleProp<ViewStyle>;
}) {
  const point = { lat: lat ?? NaN, lng: lng ?? NaN };
  const valid = isValidLatLng(point);
  return (
    <GlassCard style={[{ gap: theme.spacing.md }, style]}>
      <CardHeader
        title={title}
        subtitle={address ?? undefined}
        onArrow={valid ? (onOpenMap ?? (() => openInMaps({ ...point, label }))) : undefined}
        arrowLabel={onOpenMap ? "Open the site map" : "Open the site in Maps"}
      />
      {valid ? (
        <>
          <MapPreview
            lat={point.lat}
            lng={point.lng}
            label={label ?? address ?? undefined}
            onPress={onOpenMap}
            style={{ height }}
          />
          <View style={styles.coordRow}>
            <Feather name="crosshair" size={14} color={theme.colors.muted} />
            <Text style={styles.coord} selectable>
              {latLng(point.lat, point.lng)}
            </Text>
          </View>
          {showActions ? (
            <View style={styles.actions}>
              <Button
                title="Open in Maps"
                icon="map"
                variant="white"
                style={styles.action}
                onPress={() => openInMaps({ ...point, label })}
              />
              <Button
                title="Directions"
                icon="navigation"
                variant="white"
                style={styles.action}
                label={`Directions to ${label ?? "the site"}`}
                onPress={() => openInMaps({ ...point, label }, { directions: true })}
              />
            </View>
          ) : null}
        </>
      ) : (
        <View style={[styles.frame, styles.placeholder, { height: Math.round(height * 0.6) }]}>
          <View style={styles.pin}>
            <Feather name="map-pin" size={18} color={theme.colors.accent2} />
          </View>
          <Text style={styles.placeholderText}>No coordinates on file for this project yet.</Text>
        </View>
      )}
    </GlassCard>
  );
}

const styles = StyleSheet.create({
  frame: {
    borderRadius: theme.radius.inner + 4,
    overflow: "hidden",
    backgroundColor: theme.colors.mapPlaceholder,
    minHeight: 120,
  },
  web: { flex: 1, backgroundColor: theme.colors.mapPlaceholder },
  placeholder: {
    alignItems: "center",
    justifyContent: "center",
    gap: theme.spacing.sm,
    backgroundColor: theme.colors.mapPlaceholder,
    padding: theme.spacing.md,
  },
  pin: {
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: theme.colors.surface,
    alignItems: "center",
    justifyContent: "center",
  },
  placeholderText: {
    fontFamily: theme.fonts.body,
    fontSize: theme.type.small,
    color: theme.colors.muted,
    textAlign: "center",
  },
  coordRow: { flexDirection: "row", alignItems: "center", gap: theme.spacing.xs + 2 },
  coord: { fontFamily: theme.fonts.bodyMedium, fontSize: theme.type.small, color: theme.colors.muted },
  actions: { flexDirection: "row", gap: theme.spacing.sm },
  action: { flex: 1, paddingHorizontal: theme.spacing.md, minHeight: 48 },
});
