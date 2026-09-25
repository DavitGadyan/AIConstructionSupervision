import type { ReactNode } from "react";
import { Linking, Platform, Pressable, StyleSheet, Text, View } from "react-native";
import { useRouter } from "expo-router";
import Constants from "expo-constants";
import { Feather } from "@expo/vector-icons";
import { API_URL } from "@/lib/api";
import { useLive } from "@/lib/live";
import { useRoles } from "@/lib/roles";
import { useSession } from "@/lib/session";
import { initials } from "@/lib/format";
import { theme } from "@/lib/theme";
import { Screen } from "@/components/Screen";
import { BackHeader, Button, GlassCard, SectionLabel, type FeatherName } from "@/components/ui";

export default function Settings() {
  const { user, company, project, signOut, resetOnboarding } = useSession();
  const { canUpload, roleTag } = useRoles();
  const live = useLive();
  const router = useRouter();
  const version = Constants.expoConfig?.version ?? "0.1.0";
  const liveOn = live.mode !== "paused" && live.mode !== "stopped";

  return (
    <Screen tabs={false}>
      <BackHeader title="Settings" subtitle="Account, site and connection" />

      <GlassCard style={styles.account}>
        <View style={styles.avatar}>
          <Text style={styles.avatarText}>{initials(user?.name)}</Text>
        </View>
        <View style={{ flex: 1 }}>
          <Text style={styles.name}>{user?.name ?? "Signed in"}</Text>
          <Text style={styles.meta}>{user?.email}</Text>
          <Text style={styles.meta}>{company?.name ?? user?.org?.name}</Text>
          {roleTag ? <Text style={styles.role}>{roleTag}</Text> : null}
        </View>
      </GlassCard>

      <SectionLabel style={styles.label}>Site</SectionLabel>
      <GlassCard padded={false}>
        <Row icon="map-pin" title="Project" value={project?.name ?? "None"} onPress={() => router.push("/projects")} />
        <Row
          icon="radio"
          title="Live feed"
          value={liveOn ? (live.mode === "streaming" ? "Streaming" : "Polling") : "Paused"}
          onPress={liveOn ? live.pause : live.resume}
          a11yHint={liveOn ? "Pauses the live feed" : "Resumes the live feed"}
        />
        {canUpload ? (
          <Row icon="upload" title="Upload shots" onPress={() => router.push("/upload")} last />
        ) : (
          <Row icon="upload" title="Upload shots" value="Only the project owner's team uploads flights" last />
        )}
      </GlassCard>

      <SectionLabel style={styles.label}>Connection</SectionLabel>
      <GlassCard padded={false}>
        <Row icon="server" title="API server" value={API_URL} last />
      </GlassCard>

      <SectionLabel style={styles.label}>About</SectionLabel>
      <GlassCard padded={false}>
        <Row icon="info" title="control.io field app" value={`v${version} · ${Platform.OS}`} />
        <Row icon="play-circle" title="Replay introduction" onPress={resetOnboarding} />
        <Row
          icon="globe"
          title="Open web dashboard"
          onPress={() => Linking.openURL(API_URL).catch(() => {})}
          last
        />
      </GlassCard>
      <Text style={styles.about}>
        Drone-verified construction supervision. Flights are reconstructed in 3D and compared with the construction
        schedule; every report is hashed so it can stand as evidence.
      </Text>

      <Button title="Sign out" icon="log-out" variant="danger" onPress={signOut} />
    </Screen>
  );
}

function Row({
  icon,
  title,
  value,
  onPress,
  last,
  a11yHint,
}: {
  icon: FeatherName;
  title: string;
  value?: string;
  onPress?: () => void;
  last?: boolean;
  a11yHint?: string;
}): ReactNode {
  return (
    <Pressable
      onPress={onPress}
      disabled={!onPress}
      accessibilityRole={onPress ? "button" : "text"}
      accessibilityLabel={value ? `${title}: ${value}` : title}
      accessibilityHint={a11yHint}
      style={({ pressed }) => [styles.row, !last && styles.divider, pressed && { opacity: 0.7 }]}
    >
      <View style={styles.rowIcon}>
        <Feather name={icon} size={17} color={theme.colors.ink} />
      </View>
      <View style={{ flex: 1 }}>
        <Text style={styles.rowTitle}>{title}</Text>
        {value ? (
          <Text style={styles.rowValue} numberOfLines={1}>
            {value}
          </Text>
        ) : null}
      </View>
      {onPress ? <Feather name="chevron-right" size={18} color={theme.colors.muted} /> : null}
    </Pressable>
  );
}

const styles = StyleSheet.create({
  account: { flexDirection: "row", alignItems: "center", gap: theme.spacing.md },
  avatar: {
    width: 56,
    height: 56,
    borderRadius: theme.radius.inner,
    backgroundColor: theme.colors.accent2,
    alignItems: "center",
    justifyContent: "center",
  },
  avatarText: { fontFamily: theme.fonts.displayBold, fontSize: theme.type.h3, color: theme.colors.onAccent },
  name: { fontFamily: theme.fonts.displaySemi, fontSize: theme.type.h3, color: theme.colors.ink },
  meta: { fontFamily: theme.fonts.body, fontSize: theme.type.small, color: theme.colors.muted },
  role: { fontFamily: theme.fonts.bodySemi, fontSize: theme.type.small, color: theme.colors.ink, marginTop: 2 },
  label: { marginTop: theme.spacing.sm, marginLeft: theme.spacing.xs },
  row: {
    flexDirection: "row",
    alignItems: "center",
    gap: theme.spacing.md,
    minHeight: 60,
    paddingHorizontal: theme.spacing.lg,
    paddingVertical: theme.spacing.sm,
  },
  divider: { borderBottomWidth: StyleSheet.hairlineWidth, borderBottomColor: theme.colors.hairline },
  rowIcon: {
    width: 36,
    height: 36,
    borderRadius: theme.radius.pill + 2,
    backgroundColor: theme.colors.surface,
    alignItems: "center",
    justifyContent: "center",
  },
  rowTitle: { fontFamily: theme.fonts.bodyMedium, fontSize: theme.type.label, color: theme.colors.ink },
  rowValue: { fontFamily: theme.fonts.body, fontSize: theme.type.small, color: theme.colors.muted },
  about: {
    fontFamily: theme.fonts.body,
    fontSize: theme.type.small,
    lineHeight: theme.type.small * 1.5,
    color: theme.colors.muted,
    marginVertical: theme.spacing.sm,
    marginHorizontal: theme.spacing.xs,
  },
});
