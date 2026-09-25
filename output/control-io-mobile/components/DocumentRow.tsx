import { useState } from "react";
import { ActivityIndicator, Platform, Pressable, StyleSheet, Text, View, type StyleProp, type ViewStyle } from "react-native";
import { Feather } from "@expo/vector-icons";
import { errorMessage } from "@/lib/api";
import { openPdf } from "@/lib/files";
import { longDate, titleCase } from "@/lib/format";
import { theme } from "@/lib/theme";
import type { FeatherName } from "./ui";

/** Any document shape: ProjectDocument rows or the profile's recentDocuments. */
export interface DocumentLike {
  id: string;
  kind: string;
  title: string;
  pages: number;
  issuedAt: string | null;
  uploadedAt: string;
  url: string;
  issuer?: string | null;
}

const KIND_ICON: Record<string, FeatherName> = {
  schedule: "calendar",
  permit: "award",
  contract: "edit-3",
  other: "file",
};

export function documentKindLabel(kind: string) {
  return kind === "schedule" ? "Schedule" : kind === "permit" ? "Permit" : kind === "contract" ? "Contract" : titleCase(kind) || "Document";
}

/**
 * One project document (schedule, permit, contract): kind icon, title,
 * "Permit · 1 page · issued 16 Feb 2026", open/share affordance. Tap opens
 * the PDF with the session token. `divider` for rows stacked in one card.
 */
export function DocumentRow({
  doc,
  token,
  onError,
  divider = false,
  style,
}: {
  doc: DocumentLike;
  token: string;
  onError?: (message: string) => void;
  divider?: boolean;
  style?: StyleProp<ViewStyle>;
}) {
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const kind = documentKindLabel(doc.kind);
  const pages = `${doc.pages} ${doc.pages === 1 ? "page" : "pages"}`;
  const date = doc.issuedAt ? `issued ${longDate(doc.issuedAt)}` : `added ${longDate(doc.uploadedAt)}`;

  const open = async () => {
    if (busy) return;
    setBusy(true);
    setError(null);
    try {
      await openPdf(doc, token, { kind: "document", title: doc.title });
    } catch (e) {
      const msg = errorMessage(e, "Couldn't open the document.");
      if (onError) onError(msg);
      else setError(msg);
    } finally {
      setBusy(false);
    }
  };

  return (
    <Pressable
      onPress={open}
      disabled={busy}
      accessibilityRole="button"
      accessibilityState={{ busy }}
      accessibilityLabel={`${doc.title}. ${kind}, ${pages}, ${date}`}
      accessibilityHint={Platform.OS === "web" ? "Opens the PDF in a new tab" : "Opens the PDF to view or share"}
      style={({ pressed }) => [styles.row, divider && styles.divider, pressed && { opacity: 0.7 }, style]}
    >
      <View style={styles.icon}>
        <Feather name={KIND_ICON[doc.kind] ?? "file"} size={18} color={theme.colors.accent2} />
      </View>
      <View style={{ flex: 1, gap: 2 }}>
        <Text style={styles.title} numberOfLines={2}>
          {doc.title}
        </Text>
        <Text style={styles.meta} numberOfLines={2}>
          {kind} · {pages} · {date}
        </Text>
        {error ? (
          <Text style={styles.error} accessibilityRole="alert">
            {error}
          </Text>
        ) : null}
      </View>
      <View style={styles.trail}>
        {busy ? (
          <ActivityIndicator color={theme.colors.accent} />
        ) : (
          <Feather name={Platform.OS === "web" ? "external-link" : "share"} size={18} color={theme.colors.ink} />
        )}
      </View>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  row: {
    flexDirection: "row",
    alignItems: "center",
    gap: theme.spacing.md,
    minHeight: theme.field + 8,
    paddingVertical: theme.spacing.sm,
  },
  divider: { borderBottomWidth: StyleSheet.hairlineWidth, borderBottomColor: theme.colors.hairline },
  icon: {
    width: 40,
    height: 40,
    borderRadius: theme.radius.pill + 4,
    backgroundColor: theme.colors.inner,
    alignItems: "center",
    justifyContent: "center",
  },
  title: { fontFamily: theme.fonts.bodySemi, fontSize: theme.type.label - 1, color: theme.colors.ink },
  meta: { fontFamily: theme.fonts.body, fontSize: theme.type.small, color: theme.colors.muted },
  error: { fontFamily: theme.fonts.bodyMedium, fontSize: theme.type.small, color: theme.colors.danger },
  trail: { width: theme.tap, height: theme.tap, alignItems: "center", justifyContent: "center" },
});
