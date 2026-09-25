import { useMemo, useState } from "react";
import { StyleSheet, Text, View } from "react-native";
import { api, type ProjectDocument } from "@/lib/api";
import { useAsync } from "@/lib/hooks";
import { useAuthed } from "@/lib/session";
import { theme } from "@/lib/theme";
import { Screen } from "@/components/Screen";
import { DocumentRow, documentKindLabel } from "@/components/DocumentRow";
import {
  BackHeader,
  EmptyState,
  ErrorState,
  GlassCard,
  LoadingState,
  Segmented,
  type SegmentOption,
} from "@/components/ui";

const KIND_ORDER = ["schedule", "permit", "contract", "other"];

/** Every project document (schedule, permits, contracts), filterable by kind; tap opens the PDF. */
export default function Documents() {
  const { token, projectId, project } = useAuthed();
  const q = useAsync(() => api.documents(token, projectId), [token, projectId], !!projectId);
  const [kind, setKind] = useState<string>("all");
  const [openError, setOpenError] = useState<string | null>(null);

  const docs = useMemo(
    () =>
      [...(q.data ?? [])].sort((a, b) => {
        const ka = KIND_ORDER.indexOf(a.kind);
        const kb = KIND_ORDER.indexOf(b.kind);
        if (ka !== kb) return (ka < 0 ? 99 : ka) - (kb < 0 ? 99 : kb);
        return (b.issuedAt ?? b.uploadedAt) < (a.issuedAt ?? a.uploadedAt) ? -1 : 1;
      }),
    [q.data],
  );

  // only offer the kinds this project actually has
  const options = useMemo<SegmentOption<string>[]>(() => {
    const kinds = Array.from(new Set(docs.map((d) => d.kind)));
    if (kinds.length < 2) return [];
    return [
      { value: "all", label: "All", count: docs.length },
      ...kinds.map((k) => ({
        value: k,
        label: documentKindLabel(k),
        a11y: `${documentKindLabel(k)}, ${docs.filter((d) => d.kind === k).length}`,
      })),
    ];
  }, [docs]);

  const shown = kind === "all" ? docs : docs.filter((d) => d.kind === kind);
  const groups = groupByKind(shown);

  return (
    <Screen tabs={false} refreshing={q.refreshing} onRefresh={q.refresh}>
      <BackHeader
        title="Documents"
        subtitle={q.data ? `${q.data.length} on file · ${project?.name ?? "this project"}` : project?.name}
      />

      {options.length ? (
        <Segmented options={options} value={kind} onChange={setKind} label="Filter documents by kind" />
      ) : null}

      {openError ? (
        <Text style={styles.error} accessibilityRole="alert">
          {openError}
        </Text>
      ) : null}

      {q.loading ? (
        <LoadingState label="Loading documents…" />
      ) : q.error && !q.data ? (
        <ErrorState message={q.error} onRetry={q.reload} />
      ) : shown.length === 0 ? (
        <EmptyState
          icon="folder"
          title="No documents yet"
          body="The construction schedule, building permit and contracts appear here once the project owner uploads them on the web dashboard."
        />
      ) : (
        groups.map(([k, list]) => (
          <View key={k} style={{ gap: theme.spacing.sm }}>
            <Text style={styles.group} accessibilityRole="header">
              {documentKindLabel(k)} · {list.length}
            </Text>
            <GlassCard style={styles.card}>
              {list.map((d, i) => (
                <View key={d.id} style={i < list.length - 1 ? styles.divider : undefined}>
                  <DocumentRow doc={d} token={token} onError={setOpenError} />
                  {d.issuer ? (
                    <Text style={styles.issuer} numberOfLines={1}>
                      Issued by {d.issuer}
                      {d.milestoneCount ? ` · ${d.milestoneCount} milestones read` : ""}
                    </Text>
                  ) : null}
                </View>
              ))}
            </GlassCard>
          </View>
        ))
      )}
      <Text style={styles.foot}>
        Every file is stored with its SHA-256 hash, so the copy you open is the one that was filed.
      </Text>
    </Screen>
  );
}

function groupByKind(list: ProjectDocument[]): [string, ProjectDocument[]][] {
  const map = new Map<string, ProjectDocument[]>();
  for (const d of list) {
    const arr = map.get(d.kind) ?? [];
    arr.push(d);
    map.set(d.kind, arr);
  }
  return Array.from(map.entries());
}

const styles = StyleSheet.create({
  card: { paddingVertical: theme.spacing.xs },
  divider: { borderBottomWidth: StyleSheet.hairlineWidth, borderBottomColor: theme.colors.hairline },
  group: {
    fontFamily: theme.fonts.bodySemi,
    fontSize: theme.type.micro,
    letterSpacing: 1,
    textTransform: "uppercase",
    color: theme.colors.muted,
    marginLeft: theme.spacing.xs,
    marginTop: theme.spacing.xs,
  },
  issuer: {
    fontFamily: theme.fonts.body,
    fontSize: theme.type.small,
    color: theme.colors.muted,
    marginLeft: 40 + theme.spacing.md,
    marginTop: -theme.spacing.xs,
    marginBottom: theme.spacing.sm,
  },
  error: { fontFamily: theme.fonts.bodyMedium, fontSize: theme.type.small + 1, color: theme.colors.danger },
  foot: {
    fontFamily: theme.fonts.body,
    fontSize: theme.type.small,
    lineHeight: theme.type.small * 1.45,
    color: theme.colors.muted,
    textAlign: "center",
    marginTop: theme.spacing.sm,
    paddingHorizontal: theme.spacing.lg,
  },
});
