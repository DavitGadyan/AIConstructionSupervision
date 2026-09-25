import { createElement, useState } from "react";
import { Platform, StyleSheet, View } from "react-native";
import { WebView } from "react-native-webview";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { embedModelUrl } from "@/lib/api";
import { useLive } from "@/lib/live";
import { useAuthed } from "@/lib/session";
import { longDate } from "@/lib/format";
import { theme } from "@/lib/theme";
import { Screen } from "@/components/Screen";
import { BackHeader, ErrorState, LoadingState, SquareButton } from "@/components/ui";

/** Chrome-less web 3D viewer, embedded. */
export default function Model() {
  const { token, projectId, project } = useAuthed();
  const { flights } = useLive();
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [key, setKey] = useState(0);
  const insets = useSafeAreaInsets();
  const withMesh = flights?.find((f) => f.meshUrl);
  const url = embedModelUrl(projectId, token, withMesh?.id);

  const reload = () => {
    setError(null);
    setLoading(true);
    setKey((k) => k + 1);
  };

  return (
    <Screen scroll={false} tabs={false} contentStyle={{ paddingBottom: Math.max(insets.bottom, theme.spacing.lg) }}>
      <BackHeader
        title="3D model"
        subtitle={withMesh ? `Reconstruction from ${longDate(withMesh.capturedAt)}` : (project?.name ?? undefined)}
        right={<SquareButton icon="refresh-cw" label="Reload 3D model" onPress={reload} />}
      />

      <View style={styles.frame}>
        {error ? (
          <View style={styles.overlay}>
            <ErrorState
              message={`The 3D viewer couldn't load. ${error}. You may be offline or the server is unreachable.`}
              onRetry={reload}
            />
          </View>
        ) : Platform.OS === "web" ? (
          // react-native-webview has no web implementation: use an iframe.
          createElement("iframe", {
            key,
            src: url,
            title: "3D model viewer",
            style: { border: 0, width: "100%", height: "100%", borderRadius: theme.radius.card },
            onLoad: () => setLoading(false),
            allow: "fullscreen",
          })
        ) : (
          <WebView
            key={key}
            source={{ uri: url }}
            style={styles.web}
            onLoadEnd={() => setLoading(false)}
            onError={(e) => {
              setLoading(false);
              setError(e.nativeEvent.description || "Network error");
            }}
            onHttpError={(e) => {
              setLoading(false);
              setError(`Server returned ${e.nativeEvent.statusCode}`);
            }}
            allowsInlineMediaPlayback
            javaScriptEnabled
            domStorageEnabled
            originWhitelist={["*"]}
            accessibilityLabel="Interactive 3D model of the building"
          />
        )}
        {loading && !error ? (
          <View style={[styles.overlay, styles.loadingOverlay]} pointerEvents="none">
            <LoadingState label="Loading 3D model…" />
          </View>
        ) : null}
      </View>
    </Screen>
  );
}

const styles = StyleSheet.create({
  frame: {
    flex: 1,
    borderRadius: theme.radius.card,
    overflow: "hidden",
    backgroundColor: theme.colors.glass,
    borderWidth: 1,
    borderColor: theme.colors.glassBorder,
  },
  web: { flex: 1, backgroundColor: theme.colors.transparent },
  overlay: { position: "absolute", top: 0, left: 0, right: 0, bottom: 0, justifyContent: "center" },
  loadingOverlay: { backgroundColor: theme.colors.glass },
});
