import { memo } from "react";
import { FlatList, Pressable, StyleSheet, Text, View } from "react-native";
import { Image } from "expo-image";
import type { Finding, PhaseVariance, Shot, TimelineItem } from "@/lib/api";
import { imageSource } from "@/lib/api";
import { longDate, pct, shortDate, time, titleCase } from "@/lib/format";
import { statusColor, theme } from "@/lib/theme";
import { AccentCard, CardHeader, EmptyState, Pill, StatusDot, WhiteCard } from "./ui";

/* ------------------------------------------------------------ lag alerts */

/** ORDI "Team Tasks Overview": solid accent card with translucent sub-cards. */
export function LagAlertsCard({
  findings,
  onOpen,
  onFinding,
  limit = 3,
}: {
  findings: Finding[];
  onOpen?: () => void;
  onFinding?: (f: Finding) => void;
  limit?: number;
}) {
  const sorted = [...findings].sort((a, b) => b.daysBehind - a.daysBehind).slice(0, limit);
  return (
    <AccentCard>
      <CardHeader
        title="Lag alerts"
        subtitle={findings.length ? `${findings.length} floor/phase items behind plan` : "Nothing behind plan"}
        tone="onAccent"
        onArrow={onOpen}
        arrowLabel="Open latest report"
      />
      <View style={{ gap: theme.spacing.sm, marginTop: theme.spacing.lg }}>
        {sorted.length === 0 ? (
          <View style={cs.alert}>
            <Text style={cs.alertTitle}>All observed work matches the schedule</Text>
            <Text style={cs.alertText}>The latest flight found no floor or phase behind its planned progress.</Text>
          </View>
        ) : (
          sorted.map((f) => (
            <Pressable
              key={f.id}
              onPress={onFinding ? () => onFinding(f) : undefined}
              accessibilityRole={onFinding ? "button" : undefined}
              accessibilityLabel={`Floor ${f.floor} ${f.phase}, ${f.daysBehind} days behind, observed ${f.observedPct} percent`}
              style={({ pressed }) => [cs.alert, pressed && { opacity: 0.8 }]}
            >
              <Text style={cs.alertTitle}>
                Floor {f.floor} · {titleCase(f.phase)}
              </Text>
              <Text style={cs.alertText} numberOfLines={2}>
                Planned {pct(f.plannedPct)} by {longDate(f.plannedEnd)}, observed {pct(f.observedPct)}.{" "}
                {f.daysBehind} days behind, {f.severity}.
              </Text>
              <View style={cs.pills}>
                <Pill text={`${f.evidence?.length ?? 0} ${(f.evidence?.length ?? 0) === 1 ? "shot" : "shots"}`} tone="white" />
                <Pill text={pct(f.observedPct)} tone="dark" />
              </View>
            </Pressable>
          ))
        )}
      </View>
    </AccentCard>
  );
}

/* ------------------------------------------------------------ shot rail */

export const ShotCard = memo(function ShotCard({
  shot,
  token,
  fresh,
  status,
  onPress,
  width = 200,
}: {
  shot: Shot;
  token: string;
  fresh?: boolean;
  status?: string;
  onPress?: () => void;
  width?: number;
}) {
  return (
    <View>
      <Pressable
        onPress={onPress}
        accessibilityRole="imagebutton"
        accessibilityLabel={`${shot.label ?? titleCase(shot.view) ?? "Drone shot"}, ${shortDate(shot.capturedAt)} ${time(
          shot.capturedAt,
        )}${fresh ? ", new" : ""}. Open full screen`}
        style={({ pressed }) => [cs.shot, { width }, fresh && cs.shotFresh, pressed && { opacity: 0.85 }]}
      >
        <Image
          source={imageSource(shot.thumbUrl || shot.url, token)}
          style={[cs.shotImg, { width: width - 16 }]}
          contentFit="cover"
          transition={200}
          accessibilityIgnoresInvertColors
        />
        <Text style={cs.shotMeta}>
          {shortDate(shot.capturedAt)}
          {"   "}
          {time(shot.capturedAt)}
        </Text>
        <Text style={cs.shotTitle} numberOfLines={1}>
          {shot.label ?? titleCase(shot.view) ?? "Drone shot"}
        </Text>
        <Text style={cs.shotSub} numberOfLines={1}>
          {shot.altM != null ? `${Math.round(shot.altM)} m AGL` : "Altitude n/a"}
          {shot.lat != null ? ` · ${shot.lat.toFixed(4)}, ${shot.lng?.toFixed(4)}` : ""}
        </Text>
        <View style={cs.shotFoot}>
          <Text style={cs.shotStatus}>{fresh ? "Just arrived" : titleCase(shot.view ?? "frame")}</Text>
          <StatusDot color={fresh ? theme.colors.accent : statusColor(status)} />
        </View>
      </Pressable>
    </View>
  );
});

export function ShotRail({
  shots,
  token,
  freshIds,
  status,
  onShot,
  width,
}: {
  shots: Shot[];
  token: string;
  freshIds?: Set<string>;
  status?: string;
  onShot: (s: Shot) => void;
  width?: number;
}) {
  if (!shots.length)
    return <EmptyState icon="camera-off" title="No shots yet" body="Frames appear here as the drone uploads them." />;
  // newest first so arrivals land at the start of the rail
  const ordered = [...shots].reverse();
  return (
    <FlatList
      horizontal
      data={ordered}
      keyExtractor={(s) => s.id}
      showsHorizontalScrollIndicator={false}
      contentContainerStyle={{ gap: theme.spacing.md, paddingRight: theme.spacing.lg, paddingBottom: theme.spacing.xs }}
      renderItem={({ item }) => (
        <ShotCard
          shot={item}
          token={token}
          fresh={freshIds?.has(item.id)}
          status={status}
          onPress={() => onShot(item)}
          width={width}
        />
      )}
    />
  );
}

/* ------------------------------------------------------------ schedule */

/** ORDI "AI Smart Schedule": vertical accent line, time labels, grey inner cards. */
export function ScheduleCard({ items, onOpen }: { items: TimelineItem[]; onOpen?: () => void }) {
  // most-lagging first: actual % furthest from 100 among started milestones
  const now = Date.now();
  const rows = [...items]
    .filter((t) => new Date(t.plannedStart).getTime() <= now)
    .sort((a, b) => a.actualPct - b.actualPct)
    .slice(0, 3)
    .sort((a, b) => (a.plannedStart < b.plannedStart ? -1 : 1));

  return (
    <WhiteCard>
      <CardHeader
        title="Planned vs actual"
        subtitle="Milestones from the construction schedule"
        onArrow={onOpen}
        arrowLabel="Open 3D model"
        tone="onWhite"
      />
      {rows.length === 0 ? (
        <EmptyState icon="calendar" title="No milestones due" body="Nothing in the schedule has started yet." />
      ) : (
        <View style={cs.schedule}>
          <View style={cs.scheduleLine} />
          <View style={{ flex: 1, gap: theme.spacing.sm }}>
            {rows.map((t, i) => {
              const overdue = new Date(t.plannedEnd).getTime() < now && t.actualPct < 100;
              return (
                <View key={`${t.floor}-${t.phase}-${i}`} style={{ gap: theme.spacing.sm }}>
                  <Text style={cs.timeLabel}>{longDate(t.plannedStart)}</Text>
                  <View
                    style={cs.slot}
                    accessible
                    accessibilityLabel={`Floor ${t.floor} ${t.phase}. Planned ${longDate(t.plannedStart)} to ${longDate(
                      t.plannedEnd,
                    )}. Actual ${t.actualPct} percent${overdue ? ", overdue" : ""}`}
                  >
                    <Text style={cs.slotDate}>
                      {shortDate(t.plannedStart)} – {shortDate(t.plannedEnd)}
                    </Text>
                    <Text style={cs.slotTitle}>
                      Floor {t.floor} · {titleCase(t.phase)}
                    </Text>
                    <View style={cs.bar}>
                      <View
                        style={[
                          cs.barFill,
                          {
                            width: `${Math.min(100, t.actualPct)}%`,
                            backgroundColor: overdue ? theme.colors.danger : theme.colors.accent,
                          },
                        ]}
                      />
                    </View>
                    <View style={cs.slotFoot}>
                      <Text style={cs.slotMuted}>Actual {pct(t.actualPct)}</Text>
                      <Pill text={overdue ? "Overdue" : "In window"} tone={overdue ? "danger" : "soft"} />
                    </View>
                  </View>
                  {i === rows.length - 1 ? <Text style={cs.timeLabel}>{longDate(t.plannedEnd)}</Text> : null}
                </View>
              );
            })}
          </View>
        </View>
      )}
    </WhiteCard>
  );
}

/* ------------------------------------------------------------ phases */

/** Earned vs planned per phase (ORDI "Time Analytics" bars, stacked vertically). */
export function PhaseBars({ phases }: { phases: PhaseVariance[] }) {
  if (!phases.length) return <EmptyState icon="bar-chart-2" title="No phase data" />;
  return (
    <View style={{ gap: theme.spacing.md }}>
      {phases.map((p) => {
        const gap = p.plannedPct - p.earnedPct;
        return (
          <View
            key={p.phase}
            accessible
            accessibilityLabel={`${p.phase}: earned ${p.earnedPct.toFixed(0)} percent of planned ${p.plannedPct.toFixed(0)}`}
          >
            <View style={cs.phaseHead}>
              <Text style={cs.phaseName}>{titleCase(p.phase)}</Text>
              <Text style={[cs.phaseGap, { color: gap > 5 ? theme.colors.danger : theme.colors.muted }]}>
                {gap > 0 ? `−${gap.toFixed(0)} pts` : "on plan"}
              </Text>
            </View>
            <View style={cs.phaseTrack}>
              <View style={[cs.phasePlanned, { width: `${Math.min(100, p.plannedPct)}%` }]} />
              <View style={[cs.phaseEarned, { width: `${Math.min(100, p.earnedPct)}%` }]}>
                <Text style={cs.phaseEarnedText}>{pct(p.earnedPct)}</Text>
              </View>
            </View>
          </View>
        );
      })}
      <View style={cs.legend}>
        <View style={[cs.legendSwatch, { backgroundColor: theme.colors.accent }]} />
        <Text style={cs.legendText}>Earned</Text>
        <View style={[cs.legendSwatch, { backgroundColor: theme.colors.accent2 }]} />
        <Text style={cs.legendText}>Planned</Text>
      </View>
    </View>
  );
}

const cs = StyleSheet.create({
  alert: {
    backgroundColor: theme.colors.onAccentCard,
    borderRadius: theme.radius.inner,
    borderWidth: 1,
    borderColor: theme.colors.onAccentBorder,
    padding: theme.spacing.md,
  },
  alertTitle: { fontFamily: theme.fonts.displaySemi, fontSize: theme.type.h3 - 1, color: theme.colors.onAccent },
  alertText: {
    fontFamily: theme.fonts.body,
    fontSize: theme.type.small,
    lineHeight: theme.type.small * 1.4,
    color: theme.colors.onAccentMuted,
    marginTop: theme.spacing.xs,
  },
  pills: { flexDirection: "row", gap: theme.spacing.xs, marginTop: theme.spacing.md },

  shot: {
    backgroundColor: theme.colors.surface,
    borderRadius: theme.radius.inner + 4,
    padding: theme.spacing.sm - 2,
    borderWidth: 2,
    borderColor: theme.colors.transparent,
    ...theme.shadow,
  },
  shotFresh: { borderColor: theme.colors.accent },
  shotImg: { height: 112, borderRadius: theme.radius.inner - 4, backgroundColor: theme.colors.inner },
  shotMeta: {
    fontFamily: theme.fonts.body,
    fontSize: theme.type.small,
    color: theme.colors.faint,
    marginTop: theme.spacing.md,
    paddingHorizontal: theme.spacing.xs,
  },
  shotSub: {
    fontFamily: theme.fonts.body,
    fontSize: theme.type.small,
    color: theme.colors.muted,
    marginTop: 2,
  },
  shotTitle: {
    fontFamily: theme.fonts.bodySemi,
    fontSize: theme.type.label,
    color: theme.colors.ink,
    marginTop: theme.spacing.xs,
    paddingHorizontal: theme.spacing.xs,
  },
  shotFoot: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    marginTop: theme.spacing.lg,
    paddingHorizontal: theme.spacing.xs,
    paddingBottom: theme.spacing.xs,
  },
  shotStatus: { fontFamily: theme.fonts.body, fontSize: theme.type.small, color: theme.colors.muted },

  schedule: { flexDirection: "row", marginTop: theme.spacing.lg, gap: theme.spacing.md },
  scheduleLine: { width: 3, borderRadius: 2, backgroundColor: theme.colors.accent },
  timeLabel: { fontFamily: theme.fonts.bodyMedium, fontSize: theme.type.small - 1, color: theme.colors.ink },
  slot: { backgroundColor: theme.colors.inner, borderRadius: theme.radius.inner - 4, padding: theme.spacing.md },
  slotDate: { fontFamily: theme.fonts.body, fontSize: theme.type.small, color: theme.colors.faint },
  slotTitle: {
    fontFamily: theme.fonts.bodySemi,
    fontSize: theme.type.label,
    color: theme.colors.ink,
    marginTop: theme.spacing.xs,
  },
  bar: {
    height: 6,
    borderRadius: 3,
    backgroundColor: theme.colors.track,
    marginTop: theme.spacing.sm,
    overflow: "hidden",
  },
  barFill: { height: 6, borderRadius: 3 },
  slotFoot: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    marginTop: theme.spacing.sm,
  },
  slotMuted: { fontFamily: theme.fonts.body, fontSize: theme.type.small, color: theme.colors.muted },

  phaseHead: { flexDirection: "row", justifyContent: "space-between", marginBottom: theme.spacing.xs },
  phaseName: { fontFamily: theme.fonts.bodyMedium, fontSize: theme.type.label - 1, color: theme.colors.ink },
  phaseGap: { fontFamily: theme.fonts.bodyMedium, fontSize: theme.type.small },
  phaseTrack: {
    height: 26,
    borderRadius: theme.radius.pill,
    backgroundColor: theme.colors.surface,
    overflow: "hidden",
    justifyContent: "center",
  },
  phasePlanned: {
    position: "absolute",
    left: 0,
    top: 0,
    bottom: 0,
    backgroundColor: theme.colors.accent2,
    opacity: 0.28,
    borderRadius: theme.radius.pill,
  },
  phaseEarned: {
    position: "absolute",
    left: 0,
    top: 0,
    bottom: 0,
    backgroundColor: theme.colors.accent,
    borderRadius: theme.radius.pill,
    justifyContent: "center",
    paddingLeft: theme.spacing.sm,
    minWidth: 44,
  },
  phaseEarnedText: { fontFamily: theme.fonts.bodyMedium, fontSize: theme.type.micro, color: theme.colors.onAccent },
  legend: { flexDirection: "row", alignItems: "center", gap: theme.spacing.xs },
  legendSwatch: { width: 10, height: 10, borderRadius: 3, marginLeft: theme.spacing.sm },
  legendText: { fontFamily: theme.fonts.body, fontSize: theme.type.small, color: theme.colors.muted },
});
