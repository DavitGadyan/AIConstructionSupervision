import { useState } from "react";
import { Linking, Pressable, StyleSheet, Text, View } from "react-native";
import { Image } from "expo-image";
import { useRouter } from "expo-router";
import { Feather } from "@expo/vector-icons";
import { imageSource, type Company, type Member } from "@/lib/api";
import { initials, mailHref, prettyUrl, telHref, webHref } from "@/lib/format";
import { orgRoleLabel, roleLabel, useRoles } from "@/lib/roles";
import { useAuthed } from "@/lib/session";
import { theme } from "@/lib/theme";
import { Screen } from "@/components/Screen";
import {
  Button,
  CardHeader,
  ErrorState,
  GlassCard,
  KeyValueRow,
  LoadingState,
  Pill,
  SectionLabel,
  SquareButton,
  type FeatherName,
} from "@/components/ui";

/**
 * Company: the caller's organisation (logo, legal details, contact rows with
 * tap-to-call / mail / web), its members, and the account actions (settings,
 * project switch, sign out). Owners get Edit -> /company-edit.
 */
export default function CompanyScreen() {
  const session = useAuthed();
  const { company, companyLoading, companyError, refreshCompany, user, token, project, signOut } = session;
  const roles = useRoles();
  const router = useRouter();
  const [refreshing, setRefreshing] = useState(false);
  const [linkError, setLinkError] = useState<string | null>(null);
  const [signingOut, setSigningOut] = useState(false);

  const onRefresh = async () => {
    setRefreshing(true);
    try {
      await refreshCompany();
    } finally {
      setRefreshing(false);
    }
  };

  const open = async (href: string | undefined, what: string, value: string) => {
    if (!href) return;
    setLinkError(null);
    try {
      await Linking.openURL(href);
    } catch {
      setLinkError(`Couldn't open ${what}. ${value}`);
    }
  };

  const edit = () => router.push("/company-edit");

  return (
    <Screen refreshing={refreshing} onRefresh={onRefresh}>
      <View style={styles.head}>
        <View style={{ flex: 1 }}>
          <Text style={styles.title} accessibilityRole="header">
            Company
          </Text>
          <Text style={styles.sub} numberOfLines={1}>
            Your organisation on control.io
          </Text>
        </View>
        {roles.canEditCompany && company ? (
          <SquareButton icon="edit-2" label="Edit company profile" onPress={edit} size={theme.iconButton} />
        ) : null}
      </View>

      {!company ? (
        <GlassCard>
          {companyError && !companyLoading ? (
            <ErrorState message={companyError} onRetry={onRefresh} />
          ) : (
            <LoadingState label="Loading company…" />
          )}
        </GlassCard>
      ) : (
        <>
          <Hero company={company} token={token} tag={roles.roleTag} />

          {linkError ? (
            <Text style={styles.error} accessibilityRole="alert">
              {linkError}
            </Text>
          ) : null}

          <GlassCard style={{ gap: theme.spacing.xs }}>
            <CardHeader title="Profile" subtitle="Shown on invoices and inspection reports" />
            <View>
              <KeyValueRow label="Legal name" value={company.legalName} icon="briefcase" />
              <KeyValueRow label="Tax ID" value={company.taxId} icon="hash" />
              <KeyValueRow label="Address" value={company.address} icon="map-pin" numberOfLines={3} />
              <KeyValueRow
                label="Phone"
                value={company.phone}
                icon="phone"
                onPress={() => open(telHref(company.phone), "the phone app", company.phone ?? "")}
                actionIcon="phone"
                actionLabel="Calls this number"
              />
              <KeyValueRow
                label="Email"
                value={company.email}
                icon="mail"
                onPress={() => open(mailHref(company.email), "your mail app", company.email ?? "")}
                actionIcon="send"
                actionLabel="Writes an email"
              />
              <KeyValueRow
                label="Website"
                value={company.website ? prettyUrl(company.website) : null}
                icon="globe"
                onPress={() => open(webHref(company.website), "the website", company.website ?? "")}
                actionIcon="external-link"
                actionLabel="Opens the website"
                divider={false}
              />
            </View>
            {roles.canEditCompany ? (
              <Button title="Edit company profile" icon="edit-2" variant="white" onPress={edit} style={{ marginTop: theme.spacing.sm }} />
            ) : (
              <View style={styles.note}>
                <Feather name="lock" size={14} color={theme.colors.muted} />
                <Text style={styles.noteText}>Only a company owner can edit these details.</Text>
              </View>
            )}
          </GlassCard>

          <Members members={company.members} meId={user?.id} meEmail={user?.email} />
        </>
      )}

      <SectionLabel style={styles.label}>Account</SectionLabel>
      <GlassCard padded={false}>
        <NavRow
          icon="user"
          title={user?.name ?? "Signed in"}
          value={user?.email}
          badge={roles.role ? roleLabel(roles.role) : undefined}
        />
        <NavRow
          icon="map"
          title="Project"
          value={project?.name ?? "None selected"}
          onPress={() => router.push("/projects")}
          hint="Switch project"
        />
        <NavRow icon="settings" title="Settings" value="Live feed, server, about" onPress={() => router.push("/settings")} last />
      </GlassCard>

      <Button
        title="Sign out"
        icon="log-out"
        variant="danger"
        loading={signingOut}
        onPress={async () => {
          setSigningOut(true);
          try {
            await signOut();
          } finally {
            setSigningOut(false);
          }
        }}
      />
    </Screen>
  );
}

function Hero({ company, token, tag }: { company: Company; token: string; tag: string }) {
  const [logoFailed, setLogoFailed] = useState(false);
  const logo = company.logoUrl && !logoFailed ? imageSource(company.logoUrl, token) : undefined;
  return (
    <GlassCard blur style={styles.hero}>
      <View style={styles.logo} accessible accessibilityLabel={`${company.name} logo`}>
        {logo ? (
          <Image source={logo} style={styles.logoImg} contentFit="contain" onError={() => setLogoFailed(true)} />
        ) : (
          <Text style={styles.logoText}>{initials(company.name)}</Text>
        )}
      </View>
      <View style={{ flex: 1, gap: theme.spacing.xs }}>
        <Text style={styles.name} accessibilityRole="header">
          {company.name}
        </Text>
        {company.legalName && company.legalName !== company.name ? (
          <Text style={styles.legal} numberOfLines={2}>
            {company.legalName}
          </Text>
        ) : null}
        <View style={styles.pills}>
          <Pill text={tag || orgRoleLabel(company.role)} tone="accent" />
          <Pill text={`${company.members.length} ${company.members.length === 1 ? "member" : "members"}`} tone="white" />
        </View>
      </View>
    </GlassCard>
  );
}

function Members({ members, meId, meEmail }: { members: Member[]; meId?: string; meEmail?: string }) {
  const order = { owner: 0, supervisor: 1, viewer: 2 } as const;
  const sorted = [...members].sort((a, b) => order[a.role] - order[b.role] || a.name.localeCompare(b.name));
  return (
    <GlassCard style={{ gap: theme.spacing.sm }}>
      <CardHeader title="Members" subtitle="Owners edit the company · viewers only track" />
      {sorted.length ? (
        <View accessibilityRole="list">
          {sorted.map((m, i) => {
            const me = m.id === meId || m.email === meEmail;
            return (
              <View
                key={m.id}
                style={[styles.member, i < sorted.length - 1 && styles.divider]}
                accessible
                accessibilityLabel={`${m.name}${me ? ", you" : ""}, ${roleLabel(m.role)}, ${m.email}`}
              >
                <View style={[styles.avatar, me && { backgroundColor: theme.colors.accent }]}>
                  <Text style={styles.avatarText}>{initials(m.name)}</Text>
                </View>
                <View style={{ flex: 1, minWidth: 0 }}>
                  <Text style={styles.memberName} numberOfLines={1}>
                    {m.name}
                    {me ? <Text style={styles.you}> · You</Text> : null}
                  </Text>
                  <Text style={styles.memberEmail} numberOfLines={1}>
                    {m.email}
                  </Text>
                </View>
                <Pill text={roleLabel(m.role)} tone={m.role === "owner" ? "dark" : m.role === "viewer" ? "soft" : "white"} />
              </View>
            );
          })}
        </View>
      ) : (
        <Text style={styles.noteText}>No members yet.</Text>
      )}
    </GlassCard>
  );
}

function NavRow({
  icon,
  title,
  value,
  onPress,
  hint,
  badge,
  last,
}: {
  icon: FeatherName;
  title: string;
  value?: string;
  onPress?: () => void;
  hint?: string;
  badge?: string;
  last?: boolean;
}) {
  const body = (
    <>
      <View style={styles.rowIcon}>
        <Feather name={icon} size={17} color={theme.colors.ink} />
      </View>
      <View style={{ flex: 1, minWidth: 0 }}>
        <Text style={styles.rowTitle} numberOfLines={1}>
          {title}
        </Text>
        {value ? (
          <Text style={styles.rowValue} numberOfLines={1}>
            {value}
          </Text>
        ) : null}
      </View>
      {badge ? <Pill text={badge} tone="soft" /> : null}
      {onPress ? <Feather name="chevron-right" size={18} color={theme.colors.muted} /> : null}
    </>
  );
  const style = [styles.row, !last && styles.divider];
  if (!onPress) {
    return (
      <View style={style} accessible accessibilityLabel={[title, value, badge].filter(Boolean).join(", ")}>
        {body}
      </View>
    );
  }
  return (
    <Pressable
      onPress={onPress}
      accessibilityRole="button"
      accessibilityLabel={value ? `${title}: ${value}` : title}
      accessibilityHint={hint}
      style={({ pressed }) => [...style, pressed && { opacity: 0.7 }]}
    >
      {body}
    </Pressable>
  );
}

const LOGO = 64;

const styles = StyleSheet.create({
  head: { flexDirection: "row", alignItems: "center", gap: theme.spacing.md, marginVertical: theme.spacing.sm },
  title: { fontFamily: theme.fonts.displayBold, fontSize: theme.type.h1, color: theme.colors.ink },
  sub: { fontFamily: theme.fonts.body, fontSize: theme.type.small, color: theme.colors.muted, marginTop: 2 },
  label: { marginTop: theme.spacing.sm, marginLeft: theme.spacing.xs },
  error: { fontFamily: theme.fonts.bodyMedium, fontSize: theme.type.small + 1, color: theme.colors.danger },

  hero: { flexDirection: "row", alignItems: "center", gap: theme.spacing.lg },
  logo: {
    width: LOGO,
    height: LOGO,
    borderRadius: theme.radius.inner + 2,
    backgroundColor: theme.colors.accent2,
    alignItems: "center",
    justifyContent: "center",
    overflow: "hidden",
    borderWidth: 2,
    borderColor: theme.colors.surface,
  },
  logoImg: { width: "100%", height: "100%", backgroundColor: theme.colors.surface },
  logoText: { fontFamily: theme.fonts.displayBold, fontSize: theme.type.h2, color: theme.colors.onAccent },
  name: {
    fontFamily: theme.fonts.displaySemi,
    fontSize: theme.type.h2,
    lineHeight: theme.type.h2 * 1.15,
    color: theme.colors.ink,
    letterSpacing: -0.3,
  },
  legal: { fontFamily: theme.fonts.body, fontSize: theme.type.small, color: theme.colors.muted },
  pills: { flexDirection: "row", flexWrap: "wrap", gap: theme.spacing.xs, marginTop: theme.spacing.xs },

  note: { flexDirection: "row", alignItems: "center", gap: theme.spacing.sm, paddingTop: theme.spacing.sm },
  noteText: { flex: 1, fontFamily: theme.fonts.body, fontSize: theme.type.small, color: theme.colors.muted },

  member: { flexDirection: "row", alignItems: "center", gap: theme.spacing.md, minHeight: theme.field + 8, paddingVertical: theme.spacing.sm },
  avatar: {
    width: 40,
    height: 40,
    borderRadius: theme.radius.btn - 2,
    backgroundColor: theme.colors.accent2,
    alignItems: "center",
    justifyContent: "center",
  },
  avatarText: { fontFamily: theme.fonts.displayBold, fontSize: theme.type.small + 1, color: theme.colors.onAccent },
  memberName: { fontFamily: theme.fonts.bodySemi, fontSize: theme.type.label, color: theme.colors.ink },
  you: { fontFamily: theme.fonts.body, color: theme.colors.accent },
  memberEmail: { fontFamily: theme.fonts.body, fontSize: theme.type.small, color: theme.colors.muted, marginTop: 1 },
  divider: { borderBottomWidth: StyleSheet.hairlineWidth, borderBottomColor: theme.colors.hairline },

  row: {
    flexDirection: "row",
    alignItems: "center",
    gap: theme.spacing.md,
    minHeight: 60,
    paddingHorizontal: theme.spacing.lg,
    paddingVertical: theme.spacing.sm,
  },
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
});
