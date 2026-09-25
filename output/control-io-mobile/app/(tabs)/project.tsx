import { useEffect, useState } from "react";
import { StyleSheet, Text, View } from "react-native";
import { Image } from "expo-image";
import { useRouter, type Href } from "expo-router";
import { Feather, MaterialCommunityIcons } from "@expo/vector-icons";
import { api, ETA_HOURS, imageSource, REPORT_HOURS, type ProjectProfile } from "@/lib/api";
import { area, hoursLabel, longDate, pct, relative, titleCase } from "@/lib/format";
import { useAsync, useNow } from "@/lib/hooks";
import { useLive } from "@/lib/live";
import { kindLabel, statusColorFor, statusHeadline } from "@/lib/orders";
import { useAuthed } from "@/lib/session";
import { theme } from "@/lib/theme";
import { Screen } from "@/components/Screen";
import { MapCard } from "@/components/MapCard";
import { DocumentRow } from "@/components/DocumentRow";
import { ReportsList } from "@/components/ReportsList";
import { PhaseBars } from "@/components/cards";
import { useOrderAction } from "@/components/TabBar";
import {
  Button,
  CardHeader,
  EmptyState,
  ErrorState,
  GlassCard,
  KeyValueRow,
  LoadingState,
  Pill,
  SquareButton,
  WhiteCard,
  type FeatherName,
} from "@/components/ui";

/**
 * The development project with all its details: cover + status, the order
 * button, parties and permit, building facts, site map, progress by phase,
 * recent documents and reports, and the way into flights and the 3D model.
 */
export default function Project() {
  const { token, projectId, project: summary } = useAuthed();
  const router = useRouter();
  const live = useLive();
  const order = useOrderAction();
  const dash = useAsync(() => api.project(token, projectId), [token, projectId], !!projectId);
  const [refreshing, setRefreshing] = useState(false);

  // new flight / finding / delivered order: refresh the phase bars quietly
  useEffect(() => {
    if (live.version === 0) return;
    api
      .project(token, projectId)
      .then((d) => dash.setData(() => d))
      .catch(() => {});
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [live.version]);

  const onRefresh = async () => {
    setRefreshing(true);
    try {
      await Promise.all([
        live.refreshProfile(),
        live.refresh(),
        api
          .project(token, projectId)
          .then((d) => dash.setData(() => d))
          .catch(() => {}),
      ]);
    } finally {
      setRefreshing(false);
    }
  };

  const profile = live.profile;
  const flights = live.flights;
  const withMesh = flights?.find((f) => f.meshUrl);

  return (
    <Screen refreshing={refreshing} onRefresh={onRefresh}>
      <View style={styles.titleRow}>
        <View style={{ flex: 1 }}>
          <Text style={styles.title} accessibilityRole="header">
            Project
          </Text>
          <Text style={styles.sub} numberOfLines={1}>
            Development details, documents and site
          </Text>
        </View>
        <SquareButton icon="repeat" label="Switch project" size={theme.iconButton} onPress={() => router.push("/projects")} />
      </View>

      {!profile ? (
        <GlassCard>
          {live.profileError && !live.profileLoading ? (
            <ErrorState message={live.profileError} onRetry={live.refreshProfile} />
          ) : (
            <LoadingState label={`Loading ${summary?.name ?? "project"}…`} />
          )}
        </GlassCard>
      ) : (
        <>
          <Cover profile={profile} token={token} />

          <OrderStrip action={order} />

          <Parties profile={profile} />

          <BuildingFacts profile={profile} />

          <MapCard
            lat={profile.project.lat}
            lng={profile.project.lng}
            address={profile.project.address}
            label={profile.project.name}
            onOpenMap={() => router.push("/map" as Href)}
          />

          <GlassCard>
            <CardHeader title="Progress by phase" subtitle="Earned vs planned at the latest flight" />
            <View style={{ marginTop: theme.spacing.lg }}>
              {dash.loading ? (
                <LoadingState label="Loading progress…" />
              ) : dash.error && !dash.data ? (
                <ErrorState message={dash.error} onRetry={dash.reload} />
              ) : (
                <PhaseBars phases={dash.data?.variance?.byPhase ?? []} />
              )}
            </View>
          </GlassCard>

          <GlassCard>
            <CardHeader
              title="Documents"
              subtitle="Schedule, permit and contracts"
              onArrow={() => router.push("/documents" as Href)}
              arrowLabel="Open all documents"
            />
            {profile.recentDocuments.length === 0 ? (
              <EmptyState
                icon="folder"
                title="No documents yet"
                body="The schedule, permit and contracts appear here once the project owner uploads them."
                style={{ paddingVertical: theme.spacing.lg }}
              />
            ) : (
              <View style={{ marginTop: theme.spacing.sm }}>
                {profile.recentDocuments.slice(0, 5).map((d, i, all) => (
                  <DocumentRow key={d.id} doc={d} token={token} divider={i < all.length - 1} />
                ))}
              </View>
            )}
            <Button
              title="All documents"
              variant="ghost"
              icon="folder"
              onPress={() => router.push("/documents" as Href)}
              style={{ marginTop: theme.spacing.sm }}
            />
          </GlassCard>

          <View style={styles.sectionHead}>
            <Text style={styles.sectionTitle} accessibilityRole="header">
              Reports
            </Text>
            <SquareButton icon="arrow-up-right" label="See all reports" onPress={() => router.push("/reports")} />
          </View>
          <ReportsList
            reports={profile.recentReports}
            token={token}
            limit={3}
            emptyBody={`Order an inspection: the independent PDF lands here within ${REPORT_HOURS} h of the flight.`}
          />

          <GlassCard style={{ paddingVertical: theme.spacing.xs }}>
            <KeyValueRow
              icon="navigation"
              label="Flights"
              value={
                flights
                  ? `${flights.length} ${flights.length === 1 ? "flight" : "flights"} · last ${relative(
                      flights[0]?.capturedAt ?? profile.status.lastFlightAt,
                    )}`
                  : "Loading…"
              }
              onPress={() => router.push("/flights")}
              actionLabel="Opens the flight log and drone shots"
            />
            <KeyValueRow
              icon="box"
              label="3D model"
              value={withMesh ? `Reconstruction from ${longDate(withMesh.capturedAt)}` : "Latest reconstruction"}
              onPress={() => router.push("/model")}
              actionLabel="Opens the interactive 3D model"
            />
            <KeyValueRow
              icon="file-text"
              label="Reports"
              value={`${profile.recentReports.length ? `Latest ${longDate(profile.recentReports[0]!.createdAt)}` : "None yet"}`}
              onPress={() => router.push("/reports")}
              actionLabel="Opens every report PDF"
              divider={false}
            />
          </GlassCard>
        </>
      )}
      {order.sheet}
    </Screen>
  );
}

/* ------------------------------------------------------------------ cover */

function severityTone(s?: string): "ok" | "warn" | "danger" | "soft" {
  return s === "on-track" ? "ok" : s === "watch" ? "warn" : s === "late" || s === "critical" ? "danger" : "soft";
}

function Cover({ profile, token }: { profile: ProjectProfile; token: string }) {
  const p = profile.project;
  const s = profile.status;
  const [failed, setFailed] = useState(false);
  const behind = Math.max(0, Math.round(s.daysBehind));
  const src = imageSource(p.coverUrl, token);
  return (
    <GlassCard blur style={{ gap: theme.spacing.md }}>
      <View style={styles.coverWrap}>
        {src && !failed ? (
          <Image
            source={src}
            style={StyleSheet.absoluteFill}
            contentFit="cover"
            transition={200}
            onError={() => setFailed(true)}
            accessible
            accessibilityLabel={`Latest drone photo of ${p.name}`}
            accessibilityIgnoresInvertColors
          />
        ) : (
          <View style={styles.coverEmpty}>
            <MaterialCommunityIcons name="office-building-outline" size={40} color={theme.colors.accent2} />
          </View>
        )}
        <View style={styles.coverPills} pointerEvents="none">
          <Pill text={titleCase(s.severity)} tone={severityTone(s.severity)} />
          {profile.shared ? <Pill text="Shared" tone="white" /> : null}
          {profile.access === "read" ? <Pill text="Track only" tone="white" /> : null}
        </View>
      </View>
      <View style={{ gap: theme.spacing.xs }}>
        <Text style={styles.name} accessibilityRole="header">
          {p.name}
        </Text>
        <View style={styles.addrRow}>
          <Feather name="map-pin" size={14} color={theme.colors.muted} />
          <Text style={styles.addr} numberOfLines={2}>
            {p.address}
          </Text>
        </View>
      </View>
      <View style={styles.pillRow}>
        <Pill text={`${behind} d behind`} tone="dark" />
        <Pill text={`Earned ${pct(s.earnedPct)} · plan ${pct(s.plannedPct)}`} tone="white" />
        <Pill
          text={`${s.openFindings} open ${s.openFindings === 1 ? "finding" : "findings"}`}
          tone={s.openFindings ? "white" : "soft"}
        />
      </View>
    </GlassCard>
  );
}

/* ------------------------------------------------------------------ order strip */

/** Inline Order / Track button with the promise, mirroring the centre tab button. */
function OrderStrip({ action }: { action: ReturnType<typeof useOrderAction> }) {
  const active = action.activeOrder;
  const now = useNow(30_000, !!active);
  if (active) {
    const color = statusColorFor(active.status);
    return (
      <WhiteCard style={{ gap: theme.spacing.md }}>
        <View style={styles.stripRow}>
          <View style={[styles.stripIcon, { backgroundColor: theme.colors.accentSoft }]}>
            <Feather name="truck" size={20} color={color} />
          </View>
          <View style={{ flex: 1, minWidth: 0 }}>
            <Text style={styles.stripTitle} numberOfLines={1}>
              {kindLabel(active.kind)}
            </Text>
            <Text style={styles.stripSub} numberOfLines={2}>
              {active.number} · {statusHeadline(active, now)}
            </Text>
          </View>
        </View>
        <Button title="Track inspection" icon="navigation" onPress={action.open} label={action.label} />
      </WhiteCard>
    );
  }
  const blocked = action.mode === "blocked";
  return (
    <WhiteCard style={{ gap: theme.spacing.md }}>
      <View style={styles.stripRow}>
        <View style={styles.stripIcon}>
          <MaterialCommunityIcons name="quadcopter" size={22} color={theme.colors.accent} />
        </View>
        <View style={{ flex: 1, minWidth: 0 }}>
          <Text style={styles.stripTitle}>{blocked ? "Inspections on demand" : "Need fresh evidence?"}</Text>
          <Text style={styles.stripSub}>
            Car + drone on site in {hoursLabel(ETA_HOURS)} · independent PDF within {REPORT_HOURS} h of the flight.
          </Text>
        </View>
      </View>
      <Button
        title={blocked ? "Who can order?" : action.label}
        icon={action.icon}
        variant={blocked ? "white" : "accent"}
        onPress={action.open}
        label={blocked ? "Who can order inspections" : action.label}
        style={blocked ? styles.blockedBtn : undefined}
      />
    </WhiteCard>
  );
}

/* ------------------------------------------------------------------ facts */

function Parties({ profile }: { profile: ProjectProfile }) {
  const p = profile.project;
  const rows: { icon: FeatherName; label: string; value: string | null }[] = [
    { icon: "briefcase", label: "Developer", value: p.developer },
    { icon: "tool", label: "General contractor", value: p.contractor },
    { icon: "credit-card", label: "Lender", value: p.lender },
    { icon: "award", label: "Building permit", value: p.permitNo },
  ];
  return (
    <GlassCard style={{ paddingBottom: theme.spacing.xs }}>
      <CardHeader title="Parties & permit" subtitle="Who builds, who finances, who approved it" />
      <View style={{ marginTop: theme.spacing.sm }}>
        {rows.map((r, i) => (
          <KeyValueRow
            key={r.label}
            icon={r.icon}
            label={r.label}
            value={r.value}
            placeholder="Not on file"
            divider={i < rows.length - 1}
          />
        ))}
      </View>
    </GlassCard>
  );
}

function BuildingFacts({ profile }: { profile: ProjectProfile }) {
  const p = profile.project;
  const facts: { label: string; value: string | null }[] = [
    { label: "Building type", value: p.buildingType },
    { label: "Storeys", value: String(p.floorsTotal) },
    { label: "Floor height", value: p.floorHeightM ? `${Number(p.floorHeightM.toFixed(2))} m` : null },
    { label: "Gross area", value: p.grossAreaM2 ? area(p.grossAreaM2) : null },
    { label: "Units", value: p.units != null ? String(p.units) : null },
    { label: "Last flight", value: profile.status.lastFlightAt ? relative(profile.status.lastFlightAt) : null },
    { label: "Start", value: longDate(p.startDate) },
    { label: "Completion", value: longDate(p.plannedCompletion) },
  ];
  const rows: (typeof facts)[] = [];
  for (let i = 0; i < facts.length; i += 2) rows.push(facts.slice(i, i + 2));
  return (
    <WhiteCard style={{ gap: theme.spacing.md }}>
      <CardHeader title="Building" subtitle="Design and schedule on record" tone="onWhite" />
      <View style={{ gap: theme.spacing.sm }}>
        {rows.map((pair, i) => (
          <View key={i} style={styles.factRow}>
            {pair.map((f) => (
              <View key={f.label} style={styles.fact} accessible accessibilityLabel={`${f.label}: ${f.value ?? "not on file"}`}>
                <Text style={styles.factLabel}>{f.label}</Text>
                <Text style={[styles.factValue, !f.value && styles.factMissing]} numberOfLines={2}>
                  {f.value ?? "Not on file"}
                </Text>
              </View>
            ))}
          </View>
        ))}
      </View>
    </WhiteCard>
  );
}

const styles = StyleSheet.create({
  titleRow: { flexDirection: "row", alignItems: "center", gap: theme.spacing.md, marginTop: theme.spacing.xs },
  title: { fontFamily: theme.fonts.displayBold, fontSize: theme.type.h1, color: theme.colors.ink, letterSpacing: -0.6 },
  sub: { fontFamily: theme.fonts.body, fontSize: theme.type.small, color: theme.colors.muted, marginTop: 2 },

  coverWrap: {
    height: 184,
    borderRadius: theme.radius.inner + 4,
    overflow: "hidden",
    backgroundColor: theme.colors.inner,
  },
  coverEmpty: { flex: 1, alignItems: "center", justifyContent: "center" },
  coverPills: {
    position: "absolute",
    top: theme.spacing.md,
    left: theme.spacing.md,
    right: theme.spacing.md,
    flexDirection: "row",
    flexWrap: "wrap",
    gap: theme.spacing.xs,
  },
  name: {
    fontFamily: theme.fonts.displayBold,
    fontSize: theme.type.h2,
    lineHeight: theme.type.h2 * 1.15,
    color: theme.colors.ink,
    letterSpacing: -0.5,
  },
  addrRow: { flexDirection: "row", alignItems: "center", gap: theme.spacing.xs + 2 },
  addr: { flex: 1, fontFamily: theme.fonts.body, fontSize: theme.type.small + 1, color: theme.colors.muted },
  pillRow: { flexDirection: "row", flexWrap: "wrap", gap: theme.spacing.xs },

  stripRow: { flexDirection: "row", alignItems: "center", gap: theme.spacing.md },
  stripIcon: {
    width: theme.tap + 4,
    height: theme.tap + 4,
    borderRadius: theme.radius.btn,
    backgroundColor: theme.colors.inner,
    alignItems: "center",
    justifyContent: "center",
  },
  stripTitle: { fontFamily: theme.fonts.displaySemi, fontSize: theme.type.h3, color: theme.colors.ink },
  stripSub: {
    fontFamily: theme.fonts.body,
    fontSize: theme.type.small + 1,
    lineHeight: (theme.type.small + 1) * 1.4,
    color: theme.colors.muted,
    marginTop: 2,
  },
  blockedBtn: { backgroundColor: theme.colors.inner },

  factRow: { flexDirection: "row", gap: theme.spacing.sm },
  fact: {
    flex: 1,
    backgroundColor: theme.colors.inner,
    borderRadius: theme.radius.inner - 4,
    paddingHorizontal: theme.spacing.md,
    paddingVertical: theme.spacing.sm + 2,
    minHeight: 64,
  },
  factLabel: { fontFamily: theme.fonts.body, fontSize: theme.type.small, color: theme.colors.muted },
  factValue: { fontFamily: theme.fonts.bodySemi, fontSize: theme.type.label, color: theme.colors.ink, marginTop: 2 },
  factMissing: { fontFamily: theme.fonts.body, color: theme.colors.faint },

  sectionHead: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    paddingLeft: theme.spacing.xs,
    marginTop: theme.spacing.xs,
  },
  sectionTitle: {
    fontFamily: theme.fonts.displaySemi,
    fontSize: theme.type.h3 + 2,
    color: theme.colors.ink,
    letterSpacing: -0.3,
  },
});
