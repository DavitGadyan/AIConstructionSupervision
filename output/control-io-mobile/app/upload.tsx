import { useState } from "react";
import { Alert, Platform, ScrollView, StyleSheet, Text, TextInput, View } from "react-native";
import { Image } from "expo-image";
import { useRouter } from "expo-router";
import { SafeAreaView } from "react-native-safe-area-context";
import * as ImagePicker from "expo-image-picker";
import * as Location from "expo-location";
import * as Haptics from "expo-haptics";
import { Feather } from "@expo/vector-icons";
import { uploadFlight, type UploadFile } from "@/lib/api";
import { animateLayout } from "@/lib/hooks";
import { useLive } from "@/lib/live";
import { useAuthed } from "@/lib/session";
import { coord } from "@/lib/format";
import { theme } from "@/lib/theme";
import { Button, GlassCard, Ground, SquareButton } from "@/components/ui";

interface Picked {
  asset: ImagePicker.ImagePickerAsset;
  lat?: number;
  lng?: number;
  altM?: number;
  capturedAt?: string;
  gpsFrom: "exif" | "device" | "none";
}

type Exif = Record<string, any>;

function num(v: unknown): number | undefined {
  if (typeof v === "number" && Number.isFinite(v)) return v;
  if (typeof v === "string" && v.trim() !== "" && Number.isFinite(Number(v))) return Number(v);
  if (Array.isArray(v) && v.length === 3) {
    // [deg, min, sec]
    const [d, m, s] = v.map(Number);
    if ([d, m, s].every(Number.isFinite)) return d! + m! / 60 + s! / 3600;
  }
  return undefined;
}

/** Read GPS + capture time from picker EXIF (iOS nests under {GPS}/{Exif}; Android is flat). */
function readExif(exif: Exif | null | undefined) {
  if (!exif) return {};
  const gps: Exif = exif["{GPS}"] ?? {};
  let lat = num(gps.Latitude ?? exif.GPSLatitude);
  let lng = num(gps.Longitude ?? exif.GPSLongitude);
  const alt = num(gps.Altitude ?? exif.GPSAltitude);
  const latRef = String(gps.LatitudeRef ?? exif.GPSLatitudeRef ?? "N");
  const lngRef = String(gps.LongitudeRef ?? exif.GPSLongitudeRef ?? "E");
  if (lat !== undefined && latRef.toUpperCase().startsWith("S")) lat = -Math.abs(lat);
  if (lng !== undefined && lngRef.toUpperCase().startsWith("W")) lng = -Math.abs(lng);
  const raw: unknown = exif["{Exif}"]?.DateTimeOriginal ?? exif.DateTimeOriginal ?? exif.DateTime;
  let capturedAt: string | undefined;
  if (typeof raw === "string") {
    const m = raw.match(/^(\d{4}):(\d{2}):(\d{2})[ T](\d{2}):(\d{2}):(\d{2})/);
    if (m) {
      const d = new Date(+m[1]!, +m[2]! - 1, +m[3]!, +m[4]!, +m[5]!, +m[6]!);
      if (!Number.isNaN(d.getTime())) capturedAt = d.toISOString();
    }
  }
  if (lat === 0 && lng === 0) lat = lng = undefined;
  return { lat, lng, altM: alt, capturedAt };
}

export default function Upload() {
  const { token, projectId, project } = useAuthed();
  const live = useLive();
  const router = useRouter();
  const [items, setItems] = useState<Picked[]>([]);
  const [pilot, setPilot] = useState("");
  const [drone, setDrone] = useState("");
  const [progress, setProgress] = useState<number | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [done, setDone] = useState(false);
  const [locating, setLocating] = useState(false);

  const close = () => (router.canGoBack() ? router.back() : router.replace("/flights"));

  const deviceLocation = async () => {
    try {
      const perm = await Location.requestForegroundPermissionsAsync();
      if (perm.status !== "granted") return undefined;
      const pos =
        (await Location.getLastKnownPositionAsync({ maxAge: 5 * 60 * 1000 })) ??
        (await Location.getCurrentPositionAsync({ accuracy: Location.Accuracy.Balanced }));
      return pos?.coords;
    } catch {
      return undefined;
    }
  };

  const addAssets = async (assets: ImagePicker.ImagePickerAsset[]) => {
    const parsed: Picked[] = assets.map((a) => {
      const e = readExif(a.exif as Exif | null);
      return {
        asset: a,
        ...e,
        gpsFrom: e.lat !== undefined && e.lng !== undefined ? "exif" : "none",
      };
    });
    // fill missing GPS from the phone - it's standing next to the controller
    if (parsed.some((p) => p.gpsFrom === "none")) {
      setLocating(true);
      const c = await deviceLocation();
      setLocating(false);
      if (c) {
        for (const p of parsed) {
          if (p.gpsFrom === "none") {
            p.lat = c.latitude;
            p.lng = c.longitude;
            p.altM = c.altitude ?? undefined;
            p.gpsFrom = "device";
          }
        }
      }
    }
    animateLayout();
    setItems((prev) => {
      const seen = new Set(prev.map((p) => p.asset.uri));
      return [...prev, ...parsed.filter((p) => !seen.has(p.asset.uri))];
    });
    setDone(false);
    setError(null);
  };

  const pick = async (source: "camera" | "library") => {
    setError(null);
    try {
      if (source === "camera") {
        const perm = await ImagePicker.requestCameraPermissionsAsync();
        if (!perm.granted) {
          setError("Camera permission is needed to take a photo.");
          return;
        }
        const res = await ImagePicker.launchCameraAsync({ mediaTypes: ["images"], exif: true, quality: 0.9 });
        if (!res.canceled) await addAssets(res.assets);
      } else {
        const res = await ImagePicker.launchImageLibraryAsync({
          mediaTypes: ["images"],
          allowsMultipleSelection: true,
          selectionLimit: 30,
          exif: true,
          quality: 1,
        });
        if (!res.canceled) await addAssets(res.assets);
      }
    } catch (e) {
      setError(e instanceof Error ? e.message : "Couldn't open the picker");
    }
  };

  const remove = (uri: string) => {
    animateLayout();
    setItems((prev) => prev.filter((p) => p.asset.uri !== uri));
  };

  const submit = async () => {
    if (!items.length) return;
    setError(null);
    setProgress(0);
    const files: UploadFile[] = items.map((p, i) => {
      const a = p.asset;
      const type = a.mimeType ?? (a.uri.toLowerCase().endsWith(".png") ? "image/png" : "image/jpeg");
      return {
        uri: a.uri,
        name: a.fileName ?? `shot-${i + 1}.${type === "image/png" ? "png" : "jpg"}`,
        type,
        file: Platform.OS === "web" ? (a.file ?? undefined) : undefined,
      };
    });
    const first = items.find((p) => p.lat !== undefined) ?? items[0];
    const times = items.map((p) => p.capturedAt).filter(Boolean).sort() as string[];
    try {
      await uploadFlight(
        token,
        projectId,
        files,
        {
          capturedAt: times[0] ?? new Date().toISOString(),
          pilot: pilot || undefined,
          drone: drone || undefined,
          lat: first?.lat,
          lng: first?.lng,
          altM: first?.altM,
        },
        setProgress,
      );
      if (Platform.OS !== "web") Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success).catch(() => {});
      setDone(true);
      setItems([]);
      live.refresh();
    } catch (e) {
      if (Platform.OS !== "web") Haptics.notificationAsync(Haptics.NotificationFeedbackType.Error).catch(() => {});
      setError(e instanceof Error ? e.message : "Upload failed");
    } finally {
      setProgress(null);
    }
  };

  const uploading = progress !== null;
  const confirmClose = () => {
    if (uploading) {
      if (Platform.OS === "web") return;
      Alert.alert("Upload in progress", "Leaving now will not cancel the upload.", [
        { text: "Stay", style: "cancel" },
        { text: "Leave", onPress: close },
      ]);
    } else close();
  };

  return (
    <Ground>
      <SafeAreaView style={{ flex: 1 }} edges={["top", "bottom", "left", "right"]}>
        <View style={styles.head}>
          <View style={{ flex: 1 }}>
            <Text style={styles.title} accessibilityRole="header">
              Upload shots
            </Text>
            <Text style={styles.sub} numberOfLines={1}>
              {project?.name ?? "Project"} · sent as a mobile flight
            </Text>
          </View>
          <SquareButton icon="x" label="Close upload" onPress={confirmClose} />
        </View>

        <ScrollView contentContainerStyle={styles.body} keyboardShouldPersistTaps="handled">
          <View style={styles.sources}>
            <Button
              title="Camera"
              icon="camera"
              variant="white"
              onPress={() => pick("camera")}
              disabled={uploading}
              style={{ flex: 1 }}
              label="Take a photo with the camera"
            />
            <Button
              title="Library"
              icon="image"
              variant="white"
              onPress={() => pick("library")}
              disabled={uploading}
              style={{ flex: 1 }}
              label="Choose photos from the library"
            />
          </View>
          <Text style={styles.hint}>
            Pick frames exported from the drone controller. GPS and time come from EXIF; if a frame has none, the
            phone's location is attached.
          </Text>

          {done ? (
            <GlassCard style={styles.success}>
              <Feather name="check-circle" size={22} color={theme.colors.ok} />
              <View style={{ flex: 1 }}>
                <Text style={styles.successTitle}>Uploaded</Text>
                <Text style={styles.sub}>Reconstruction and assessment run on the server. Watch it in Flights.</Text>
              </View>
            </GlassCard>
          ) : null}

          {items.length ? (
            <GlassCard style={{ gap: theme.spacing.md }}>
              <Text style={styles.cardTitle}>
                {items.length} {items.length === 1 ? "frame" : "frames"} selected
              </Text>
              {locating ? <Text style={styles.sub}>Getting the phone's location…</Text> : null}
              {items.map((p) => (
                <View key={p.asset.uri} style={styles.item}>
                  <Image source={{ uri: p.asset.uri }} style={styles.thumb} contentFit="cover" />
                  <View style={{ flex: 1 }}>
                    <Text style={styles.itemName} numberOfLines={1}>
                      {p.asset.fileName ?? "Photo"}
                    </Text>
                    <Text style={styles.itemMeta} numberOfLines={1}>
                      {p.lat !== undefined && p.lng !== undefined
                        ? `${coord(p.lat)}, ${coord(p.lng, "E", "W")}`
                        : "No location"}
                    </Text>
                    <Text
                      style={[
                        styles.itemMeta,
                        { color: p.gpsFrom === "exif" ? theme.colors.ok : p.gpsFrom === "device" ? theme.colors.warn : theme.colors.danger },
                      ]}
                    >
                      {p.gpsFrom === "exif" ? "GPS from EXIF" : p.gpsFrom === "device" ? "GPS from phone" : "No GPS"}
                    </Text>
                  </View>
                  <SquareButton
                    icon="trash-2"
                    variant="soft"
                    label={`Remove ${p.asset.fileName ?? "photo"}`}
                    onPress={() => remove(p.asset.uri)}
                    disabled={uploading}
                  />
                </View>
              ))}
            </GlassCard>
          ) : null}

          <GlassCard style={{ gap: theme.spacing.md }}>
            <Text style={styles.cardTitle}>Flight details (optional)</Text>
            <TextInput
              value={pilot}
              onChangeText={setPilot}
              placeholder="Pilot"
              placeholderTextColor={theme.colors.faint}
              style={styles.input}
              accessibilityLabel="Pilot name"
            />
            <TextInput
              value={drone}
              onChangeText={setDrone}
              placeholder="Drone, e.g. DJI Mavic 3 Enterprise"
              placeholderTextColor={theme.colors.faint}
              style={styles.input}
              accessibilityLabel="Drone model"
            />
          </GlassCard>

          {error ? (
            <Text style={styles.error} accessibilityRole="alert">
              {error}
            </Text>
          ) : null}
        </ScrollView>

        <View style={styles.footer}>
          {uploading ? (
            <View
              style={styles.progressWrap}
              accessible
              accessibilityRole="progressbar"
              accessibilityValue={{ min: 0, max: 100, now: Math.round((progress ?? 0) * 100) }}
            >
              <View style={styles.progressTrack}>
                <View style={[styles.progressFill, { width: `${Math.round((progress ?? 0) * 100)}%` }]} />
              </View>
              <Text style={styles.sub}>Uploading… {Math.round((progress ?? 0) * 100)}%</Text>
            </View>
          ) : null}
          <Button
            title={items.length ? `Upload ${items.length} ${items.length === 1 ? "frame" : "frames"}` : "Upload"}
            icon="upload-cloud"
            onPress={submit}
            loading={uploading}
            disabled={!items.length}
          />
        </View>
      </SafeAreaView>
    </Ground>
  );
}

const styles = StyleSheet.create({
  head: {
    flexDirection: "row",
    alignItems: "center",
    padding: theme.spacing.gutter,
    paddingBottom: theme.spacing.sm,
    gap: theme.spacing.md,
  },
  title: { fontFamily: theme.fonts.displayBold, fontSize: theme.type.h1, color: theme.colors.ink },
  sub: { fontFamily: theme.fonts.body, fontSize: theme.type.small, color: theme.colors.muted },
  body: { padding: theme.spacing.gutter, gap: theme.spacing.md },
  sources: { flexDirection: "row", gap: theme.spacing.sm },
  hint: {
    fontFamily: theme.fonts.body,
    fontSize: theme.type.small,
    color: theme.colors.muted,
    lineHeight: theme.type.small * 1.45,
  },
  success: { flexDirection: "row", gap: theme.spacing.md, alignItems: "center" },
  successTitle: { fontFamily: theme.fonts.displaySemi, fontSize: theme.type.h3, color: theme.colors.ink },
  cardTitle: { fontFamily: theme.fonts.displaySemi, fontSize: theme.type.h3, color: theme.colors.ink },
  item: { flexDirection: "row", alignItems: "center", gap: theme.spacing.md },
  thumb: { width: 60, height: 60, borderRadius: theme.radius.pill + 4, backgroundColor: theme.colors.surface },
  itemName: { fontFamily: theme.fonts.bodySemi, fontSize: theme.type.label - 1, color: theme.colors.ink },
  itemMeta: { fontFamily: theme.fonts.body, fontSize: theme.type.small - 1, color: theme.colors.muted },
  input: {
    minHeight: 48,
    borderRadius: theme.radius.btn,
    backgroundColor: theme.colors.surface,
    paddingHorizontal: theme.spacing.lg,
    fontFamily: theme.fonts.body,
    fontSize: theme.type.body,
    color: theme.colors.ink,
  },
  error: { fontFamily: theme.fonts.bodyMedium, fontSize: theme.type.label, color: theme.colors.danger },
  footer: { padding: theme.spacing.gutter, gap: theme.spacing.sm },
  progressWrap: { gap: theme.spacing.xs },
  progressTrack: { height: 8, borderRadius: 4, backgroundColor: theme.colors.track, overflow: "hidden" },
  progressFill: { height: 8, borderRadius: 4, backgroundColor: theme.colors.accent },
});
