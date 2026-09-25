import { useState } from "react";
import { ActivityIndicator, Platform, Pressable, StyleSheet, Text, View, type StyleProp, type ViewStyle } from "react-native";
import { Feather } from "@expo/vector-icons";
import { errorMessage } from "@/lib/api";
import { openPdf } from "@/lib/files";
import { longDate, time } from "@/lib/format";
import { theme } from "@/lib/theme";
import { EmptyState, GlassCard, Pill } from "./ui";

/** Any report shape: full Report rows or the profile's recentReports. */
export interface ReportLike {
  id: string;
  createdAt: string;
  daysBehind: number;
  url: string;
  pages?: number;
  sha256?: string | null;
}

/**
 * Report PDFs as glass rows: date, days-behind / pages / Latest pills, hash.
 * Tap opens the PDF (web: new tab; phone: share sheet). Handles its own
 * busy state per row; errors go to `onError` or show inline.
 */
export function ReportsList({
  reports,
  token,
  limit,
  latestId,
  emptyTitle = "No reports yet",
  emptyBody = "Order an inspection and the independent PDF lands here.",
  onError,
  style,
}: {
  reports: readonly ReportLike[];
  token: string;
  limit?: number;
  /** marks one row "Latest" (default: the newest by createdAt) */
  latestId?: string | null;
  emptyTitle?: string;
  emptyBody?: string;
  onError?: (message: string) => void;
  style?: StyleProp<ViewStyle>;
}) {
  const [opening, setOpening] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const sorted = [...reports].sort((a, b) => (a.createdAt < b.createdAt ? 1 : -1));
  const shown = limit ? sorted.slice(0, limit) : sorted;
  const latest = latestId === undefined ? sorted[0]?.id : latestId;

  const open = async (r: ReportLike) => {
    if (opening) return;
    setOpening(r.id);
    setError(null);
    try {
      await openPdf(r, token, { kind: "report", title: `control.io report ${longDate(r.createdAt)}` });
    } catch (e) {
      const msg = errorMessage(e, "Couldn't open the PDF.");
      if (onError) onError(msg);
      else setError(msg);
    } finally {
      setOpening(null);
    }
  };

  if (!shown.length) return <EmptyState icon="file-text" title={emptyTitle} body={emptyBody} style={style} />;

  return (
    <View style={[{ gap: theme.spacing.sm }, style]}>
      {error ? (
        <Text style={styles.error} accessibilityRole="alert">
          {error}
        </Text>
      ) : null}
      {shown.map((r) => {
        const busy = opening === r.id;
        return (
          <Pressable
            key={r.id}
            onPress={() => open(r)}
            disabled={busy}
            accessibilityRole="button"
            accessibilityState={{ busy }}
            accessibilityLabel={`Report from ${longDate(r.createdAt)}, ${r.daysBehind} days behind${
              r.pages ? `, ${r.pages} pages` : ""
            }${r.id === latest ? ", latest" : ""}`}
            accessibilityHint={Platform.OS === "web" ? "Opens the PDF in a new tab" : "Opens the PDF to view or share"}
          >
            {({ pressed }) => (
              <GlassCard style={[styles.row, pressed && { opacity: 0.8 }]}>
                <View style={styles.icon}>
                  <Feather name="file-text" size={20} color={theme.colors.accent} />
                </View>
                <View style={{ flex: 1, gap: theme.spacing.xs }}>
                  <Text style={styles.title} numberOfLines={1}>
                    {longDate(r.createdAt)} · {time(r.createdAt)}
                  </Text>
                  <View style={styles.pills}>
                    <Pill text={`${r.daysBehind} d behind`} tone="dark" />
                    {r.pages ? <Pill text={`${r.pages} pages`} tone="white" /> : null}
                    {r.id === latest ? <Pill text="Latest" tone="accent" /> : null}
                  </View>
                  {r.sha256 ? (
                    <Text style={styles.hash} numberOfLines={1}>
                      SHA-256 {r.sha256}
                    </Text>
                  ) : null}
                </View>
                <View style={styles.trail}>
                  {busy ? (
                    <ActivityIndicator color={theme.colors.accent} />
                  ) : (
                    <Feather name={Platform.OS === "web" ? "external-link" : "share"} size={20} color={theme.colors.ink} />
                  )}
                </View>
              </GlassCard>
            )}
          </Pressable>
        );
      })}
    </View>
  );
}

const styles = StyleSheet.create({
  row: { flexDirection: "row", alignItems: "center", gap: theme.spacing.md, padding: theme.spacing.md },
  icon: {
    width: 48,
    height: 48,
    borderRadius: theme.radius.inner - 2,
    backgroundColor: theme.colors.surface,
    alignItems: "center",
    justifyContent: "center",
  },
  title: { fontFamily: theme.fonts.bodySemi, fontSize: theme.type.label, color: theme.colors.ink },
  pills: { flexDirection: "row", flexWrap: "wrap", gap: theme.spacing.xs },
  hash: { fontFamily: theme.fonts.body, fontSize: theme.type.micro, color: theme.colors.faint },
  trail: { width: theme.tap, height: theme.tap, alignItems: "center", justifyContent: "center" },
  error: { fontFamily: theme.fonts.bodyMedium, fontSize: theme.type.small + 1, color: theme.colors.danger },
});
