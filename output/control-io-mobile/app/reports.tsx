import { useEffect, useState } from "react";
import { Platform, StyleSheet, Text, View } from "react-native";
import * as Haptics from "expo-haptics";
import { Feather } from "@expo/vector-icons";
import { api, errorMessage, type Report } from "@/lib/api";
import { animateLayout, useAsync } from "@/lib/hooks";
import { useLive } from "@/lib/live";
import { useRoles } from "@/lib/roles";
import { useAuthed } from "@/lib/session";
import { theme } from "@/lib/theme";
import { Screen } from "@/components/Screen";
import { ReportsList } from "@/components/ReportsList";
import { useOrderAction } from "@/components/TabBar";
import { AccentCard, BackHeader, Button, ErrorState, GlassCard, LoadingState } from "@/components/ui";

function newestFirst(list: Report[]) {
  return [...list].sort((a, b) => (a.createdAt < b.createdAt ? 1 : -1));
}

/** Every report PDF for the project, newest first; owners/supervisors can generate a new one. */
export default function Reports() {
  const { token, projectId, project } = useAuthed();
  const live = useLive();
  const { canGenerateReport } = useRoles();
  const order = useOrderAction();
  const q = useAsync(async () => newestFirst(await api.reports(token, projectId)), [token, projectId]);
  const [generating, setGenerating] = useState(false);
  const [actionError, setActionError] = useState<string | null>(null);

  // a delivered inspection adds a report: pick it up without a manual refresh
  useEffect(() => {
    if (live.version === 0) return;
    // silently: no spinner, the list stays put
    api
      .reports(token, projectId)
      .then((list) => q.setData(() => newestFirst(list)))
      .catch(() => {});
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [live.version]);

  const generate = async () => {
    setGenerating(true);
    setActionError(null);
    try {
      await api.generateReport(token, projectId);
      if (Platform.OS !== "web") Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success).catch(() => {});
      animateLayout();
      await Promise.all([q.refresh(), live.refreshProfile()]);
    } catch (e) {
      setActionError(errorMessage(e, "Couldn't generate the report."));
    } finally {
      setGenerating(false);
    }
  };

  const count = q.data?.length ?? 0;

  return (
    <Screen tabs={false} refreshing={q.refreshing} onRefresh={q.refresh}>
      <BackHeader
        title="Reports"
        subtitle={q.data ? `${count} ${count === 1 ? "report" : "reports"} · ${project?.name ?? "this project"}` : project?.name}
      />

      {canGenerateReport ? (
        <AccentCard style={{ gap: theme.spacing.md }}>
          <Text style={styles.ctaTitle} accessibilityRole="header">
            New delay report
          </Text>
          <Text style={styles.ctaBody}>
            Builds a signed PDF from the latest assessed flight: variance, lagging floors, and the drone shots that
            prove them.
          </Text>
          <Button
            title={generating ? "Generating…" : "Generate report"}
            icon="file-plus"
            variant="white"
            onPress={generate}
            loading={generating}
          />
        </AccentCard>
      ) : (
        <GlassCard style={styles.note}>
          <View style={styles.noteIcon}>
            <Feather name="shield" size={18} color={theme.colors.accent} />
          </View>
          <View style={{ flex: 1, gap: theme.spacing.sm }}>
            <Text style={styles.noteTitle}>Independent reports</Text>
            <Text style={styles.noteBody}>
              New reports come from an inspection flight: the PDF lands here within 12 h of the flight.
            </Text>
            {order.mode !== "blocked" ? (
              <Button title={order.label} icon={order.icon} variant="white" onPress={order.open} style={styles.noteBtn} />
            ) : null}
          </View>
        </GlassCard>
      )}

      {actionError ? (
        <Text style={styles.error} accessibilityRole="alert">
          {actionError}
        </Text>
      ) : null}

      {q.loading ? (
        <LoadingState label="Loading reports…" />
      ) : q.error && !q.data ? (
        <ErrorState message={q.error} onRetry={q.reload} />
      ) : (
        <ReportsList
          reports={q.data ?? []}
          token={token}
          emptyTitle="No reports yet"
          emptyBody={
            canGenerateReport
              ? "Generate the first one after a flight is assessed, or order an inspection."
              : "The first independent report appears here after an inspection flight."
          }
          onError={setActionError}
        />
      )}
      {order.sheet}
    </Screen>
  );
}

const styles = StyleSheet.create({
  ctaTitle: { fontFamily: theme.fonts.displaySemi, fontSize: theme.type.h2, color: theme.colors.onAccent },
  ctaBody: {
    fontFamily: theme.fonts.body,
    fontSize: theme.type.small + 1,
    lineHeight: (theme.type.small + 1) * 1.45,
    color: theme.colors.onAccentMuted,
  },
  note: { flexDirection: "row", gap: theme.spacing.md, alignItems: "flex-start" },
  noteIcon: {
    width: 40,
    height: 40,
    borderRadius: theme.radius.btn - 2,
    backgroundColor: theme.colors.surface,
    alignItems: "center",
    justifyContent: "center",
  },
  noteTitle: { fontFamily: theme.fonts.displaySemi, fontSize: theme.type.h3, color: theme.colors.ink },
  noteBody: {
    fontFamily: theme.fonts.body,
    fontSize: theme.type.small + 1,
    lineHeight: (theme.type.small + 1) * 1.45,
    color: theme.colors.muted,
  },
  noteBtn: { alignSelf: "flex-start", minHeight: theme.tap + 4 },
  error: { fontFamily: theme.fonts.bodyMedium, fontSize: theme.type.label, color: theme.colors.danger },
});
