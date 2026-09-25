import { useEffect, useRef } from "react";
import { Pressable, StyleSheet, Text, View } from "react-native";
import { Image } from "expo-image";
import { Redirect, useRouter } from "expo-router";
import { Feather } from "@expo/vector-icons";
import { imageSource, type ProjectSummary } from "@/lib/api";
import { useAsync } from "@/lib/hooks";
import { useSession } from "@/lib/session";
import { relative, titleCase } from "@/lib/format";
import { statusColor, theme } from "@/lib/theme";
import { Screen } from "@/components/Screen";
import { BackHeader, EmptyState, ErrorState, GlassCard, LoadingState, Pill } from "@/components/ui";

export default function Projects() {
  const { token, projectId, loadProjects, selectProject, signOut } = useSession();
  const router = useRouter();
  const q = useAsync(() => loadProjects(), [token], !!token);
  const autoPicked = useRef(false);

  const pick = async (p: ProjectSummary) => {
    await selectProject(p);
    if (router.canGoBack()) router.back();
    else router.replace("/");
  };

  // one project: nothing to choose, go straight in
  useEffect(() => {
    if (!autoPicked.current && q.data && q.data.length === 1 && !projectId) {
      autoPicked.current = true;
      pick(q.data[0]!);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [q.data, projectId]);

  if (!token) return <Redirect href="/login" />;

  return (
    <Screen tabs={false} refreshing={q.refreshing} onRefresh={q.refresh}>
      {projectId ? (
        <BackHeader title="Projects" subtitle="Choose the site you're supervising" style={styles.back} />
      ) : (
        <View style={styles.head}>
          <Text style={styles.title} accessibilityRole="header">
            Projects
          </Text>
          <Text style={styles.sub}>Choose the site you're supervising</Text>
        </View>
      )}

      {q.loading ? (
        <LoadingState label="Loading projects…" />
      ) : q.error ? (
        <ErrorState message={q.error} onRetry={q.reload} />
      ) : !q.data?.length ? (
        <EmptyState
          icon="map"
          title="No projects yet"
          body="Your organisation has no supervised sites. Add one from the web dashboard."
          action={<Text style={styles.link} onPress={signOut} accessibilityRole="button">Sign out</Text>}
        />
      ) : (
        q.data.map((p) => (
          <Pressable
            key={p.id}
            onPress={() => pick(p)}
            accessibilityRole="button"
            accessibilityLabel={`${p.name}${p.shared ? ", shared with your company" : ""}${
              p.access === "read" ? ", track only" : ""
            }, ${p.daysBehind} days behind, status ${p.status}`}
            accessibilityState={{ selected: p.id === projectId }}
          >
            {({ pressed }) => (
              <GlassCard style={[styles.card, pressed && { opacity: 0.8 }, p.id === projectId && styles.selected]}>
                <Image source={imageSource(p.coverUrl, token)} style={styles.cover} contentFit="cover" />
                <View style={{ flex: 1, gap: theme.spacing.xs }}>
                  <Text style={styles.name} numberOfLines={2}>
                    {p.name}
                  </Text>
                  <Text style={styles.meta} numberOfLines={1}>
                    {p.floorsTotal} floors · last flight {relative(p.lastFlightAt)}
                  </Text>
                  <View style={styles.pills}>
                    <Pill text={`${p.daysBehind} d behind`} tone="dark" />
                    <View style={[styles.status, { borderColor: statusColor(p.status) }]}>
                      <Text style={[styles.statusText, { color: statusColor(p.status) }]}>{titleCase(p.status)}</Text>
                    </View>
                    {p.shared ? <Pill text={p.access === "read" ? "Shared · track only" : "Shared"} tone="white" /> : null}
                  </View>
                  {p.shared ? (
                    <Text style={styles.meta} numberOfLines={1}>
                      Developer: {p.developer}
                    </Text>
                  ) : null}
                </View>
                <Feather name="chevron-right" size={20} color={theme.colors.muted} />
              </GlassCard>
            )}
          </Pressable>
        ))
      )}
    </Screen>
  );
}

const styles = StyleSheet.create({
  head: { marginVertical: theme.spacing.md, paddingHorizontal: theme.spacing.xs },
  back: { marginVertical: theme.spacing.xs },
  pills: { flexDirection: "row", flexWrap: "wrap", gap: theme.spacing.xs, marginTop: theme.spacing.xs },
  title: { fontFamily: theme.fonts.displayBold, fontSize: theme.type.h1, color: theme.colors.ink },
  sub: { fontFamily: theme.fonts.body, fontSize: theme.type.label, color: theme.colors.muted },
  card: { flexDirection: "row", alignItems: "center", gap: theme.spacing.md, padding: theme.spacing.md },
  selected: { borderColor: theme.colors.accent, borderWidth: 2 },
  cover: { width: 72, height: 72, borderRadius: theme.radius.inner, backgroundColor: theme.colors.surface },
  name: { fontFamily: theme.fonts.displaySemi, fontSize: theme.type.h3, color: theme.colors.ink },
  meta: { fontFamily: theme.fonts.body, fontSize: theme.type.small, color: theme.colors.muted },
  status: {
    borderWidth: 1,
    borderRadius: theme.radius.pill,
    paddingHorizontal: 10,
    paddingVertical: 5,
  },
  statusText: { fontFamily: theme.fonts.bodyMedium, fontSize: theme.type.micro + 1 },
  link: {
    fontFamily: theme.fonts.bodySemi,
    fontSize: theme.type.label,
    color: theme.colors.accent,
    padding: theme.spacing.md,
  },
});
