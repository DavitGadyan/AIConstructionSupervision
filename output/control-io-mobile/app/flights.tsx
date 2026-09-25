import { useEffect, useState } from "react";
import { Pressable, StyleSheet, Text, View } from "react-native";
import { useRouter } from "expo-router";
import { Feather } from "@expo/vector-icons";
import type { Flight } from "@/lib/api";
import { animateLayout } from "@/lib/hooks";
import { useLive } from "@/lib/live";
import { useRoles } from "@/lib/roles";
import { useAuthed } from "@/lib/session";
import { longDate, time, titleCase } from "@/lib/format";
import { statusColor, theme } from "@/lib/theme";
import { Screen } from "@/components/Screen";
import { ShotRail } from "@/components/cards";
import {
  BackHeader,
  Button,
  EmptyState,
  ErrorState,
  GlassCard,
  LoadingState,
  SquareButton,
  StatusDot,
} from "@/components/ui";

export default function Flights() {
  const { token } = useAuthed();
  const live = useLive();
  const router = useRouter();
  const { canUpload } = useRoles();
  const [open, setOpen] = useState<Set<string>>(new Set());
  const [refreshing, setRefreshing] = useState(false);

  // latest flight starts expanded
  const firstId = live.flights?.[0]?.id;
  useEffect(() => {
    if (firstId) setOpen((s) => (s.size ? s : new Set([firstId])));
  }, [firstId]);

  const toggle = (id: string) => {
    animateLayout();
    setOpen((s) => {
      const n = new Set(s);
      if (n.has(id)) n.delete(id);
      else n.add(id);
      return n;
    });
  };

  const onRefresh = async () => {
    setRefreshing(true);
    await live.refresh();
    setRefreshing(false);
  };

  const liveOn = live.mode !== "paused" && live.mode !== "stopped";

  return (
    <Screen tabs={false} refreshing={refreshing} onRefresh={onRefresh}>
      <BackHeader
        title="Flights"
        subtitle={`${live.flights?.length ?? 0} ${live.flights?.length === 1 ? "flight" : "flights"} on this project`}
        right={
          <View style={styles.headActions}>
            <SquareButton
              icon={liveOn ? "pause" : "play"}
              variant="white"
              label={liveOn ? "Pause live feed" : "Resume live feed"}
              onPress={liveOn ? live.pause : live.resume}
            />
            {canUpload ? (
              <SquareButton icon="plus" variant="white" label="Upload new shots" onPress={() => router.push("/upload")} />
            ) : null}
          </View>
        }
      />
      <View style={styles.liveRow}>
        <StatusDot
          size={8}
          color={live.mode === "streaming" ? theme.colors.ok : liveOn ? theme.colors.warn : theme.colors.faint}
        />
        <Text style={styles.sub} accessibilityLiveRegion="polite">
          {live.mode === "streaming"
            ? "Live stream connected"
            : live.mode === "polling"
              ? "Live via polling every 10 s"
              : live.mode === "connecting"
                ? "Connecting to live feed…"
                : live.mode === "paused"
                  ? "Live feed paused"
                  : "Live feed stopped"}
        </Text>
      </View>

      {live.lastMessage ? (
        <View style={styles.banner} accessibilityLiveRegion="polite">
          <Feather name="radio" size={16} color={theme.colors.accent} />
          <Text style={styles.bannerText}>{live.lastMessage}</Text>
        </View>
      ) : null}

      {live.loading && !live.flights ? (
        <LoadingState label="Loading flights…" />
      ) : live.error && !live.flights ? (
        <ErrorState message={live.error} onRetry={live.refresh} />
      ) : !live.flights?.length ? (
        <EmptyState
          icon="navigation"
          title="No flights yet"
          body={
            canUpload
              ? "Upload frames from the drone controller to start the first assessment."
              : "Frames from the next inspection flight land in this feed as the drone uploads them."
          }
          action={
            canUpload ? <Button title="Upload shots" icon="upload" onPress={() => router.push("/upload")} /> : undefined
          }
        />
      ) : (
        live.flights.map((f) => (
          <FlightCard
            key={f.id}
            flight={f}
            token={token}
            expanded={open.has(f.id)}
            onToggle={() => toggle(f.id)}
            freshIds={live.freshShotIds}
            onShot={(shotId) => router.push({ pathname: "/shot", params: { flightId: f.id, shotId } })}
          />
        ))
      )}
    </Screen>
  );
}

function FlightCard({
  flight,
  token,
  expanded,
  onToggle,
  freshIds,
  onShot,
}: {
  flight: Flight;
  token: string;
  expanded: boolean;
  onToggle: () => void;
  freshIds: Set<string>;
  onShot: (id: string) => void;
}) {
  const fresh = flight.shots.filter((s) => freshIds.has(s.id)).length;
  const color = statusColor(flight.status);
  return (
    <GlassCard style={{ paddingRight: expanded ? 0 : theme.spacing.lg }}>
      <Pressable
        onPress={onToggle}
        accessibilityRole="button"
        accessibilityState={{ expanded }}
        accessibilityLabel={`Flight ${longDate(flight.capturedAt)} ${time(flight.capturedAt)}, ${flight.status}, ${
          flight.shots.length
        } shots${flight.daysBehind != null ? `, ${flight.daysBehind} days behind` : ""}`}
        style={[styles.flightHead, expanded && { paddingRight: theme.spacing.lg }]}
      >
        <View style={{ flex: 1 }}>
          <Text style={styles.flightDate}>
            {longDate(flight.capturedAt)} · {time(flight.capturedAt)}
          </Text>
          <Text style={styles.flightMeta} numberOfLines={1}>
            {[flight.drone, flight.pilot, flight.source && titleCase(flight.source)].filter(Boolean).join(" · ") ||
              "Drone flight"}
          </Text>
          <View style={styles.statsRow}>
            <View style={[styles.statusPill, { borderColor: color }]}>
              <StatusDot color={color} size={7} />
              <Text style={[styles.statusText, { color }]}>{titleCase(flight.status)}</Text>
            </View>
            <Stat icon="layers" text={`${flight.floorsDetected ?? "–"} floors`} />
            <Stat icon="clock" text={flight.daysBehind != null ? `${flight.daysBehind} d behind` : "pending"} />
            <Stat icon="camera" text={`${flight.shots.length}${fresh ? ` (+${fresh})` : ""}`} accent={fresh > 0} />
          </View>
        </View>
        <Feather name={expanded ? "chevron-up" : "chevron-down"} size={20} color={theme.colors.ink} />
      </Pressable>
      {expanded ? (
        <View style={{ marginTop: theme.spacing.lg }}>
          <ShotRail
            shots={flight.shots}
            token={token}
            freshIds={freshIds}
            status={flight.status}
            onShot={(s) => onShot(s.id)}
            width={176}
          />
        </View>
      ) : null}
    </GlassCard>
  );
}

function Stat({ icon, text, accent }: { icon: "layers" | "clock" | "camera"; text: string; accent?: boolean }) {
  const c = accent ? theme.colors.accent : theme.colors.muted;
  return (
    <View style={styles.stat}>
      <Feather name={icon} size={13} color={c} />
      <Text style={[styles.statText, { color: c }]}>{text}</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  headActions: { flexDirection: "row", gap: theme.spacing.sm },
  liveRow: { flexDirection: "row", alignItems: "center", gap: theme.spacing.xs + 2, paddingHorizontal: theme.spacing.xs },
  sub: { fontFamily: theme.fonts.body, fontSize: theme.type.small, color: theme.colors.muted },
  banner: {
    flexDirection: "row",
    alignItems: "center",
    gap: theme.spacing.sm,
    backgroundColor: theme.colors.accentSoft,
    borderRadius: theme.radius.inner,
    padding: theme.spacing.md,
  },
  bannerText: { fontFamily: theme.fonts.bodyMedium, fontSize: theme.type.small, color: theme.colors.ink, flex: 1 },
  flightHead: { flexDirection: "row", alignItems: "center", gap: theme.spacing.md, minHeight: theme.tap },
  flightDate: { fontFamily: theme.fonts.displaySemi, fontSize: theme.type.h3, color: theme.colors.ink },
  flightMeta: {
    fontFamily: theme.fonts.body,
    fontSize: theme.type.small,
    color: theme.colors.muted,
    marginTop: theme.spacing.xxs,
  },
  statsRow: {
    flexDirection: "row",
    flexWrap: "wrap",
    alignItems: "center",
    gap: theme.spacing.md,
    marginTop: theme.spacing.md,
  },
  statusPill: {
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
    borderWidth: 1,
    borderRadius: theme.radius.pill,
    paddingHorizontal: 8,
    paddingVertical: 4,
  },
  statusText: { fontFamily: theme.fonts.bodyMedium, fontSize: theme.type.micro + 1 },
  stat: { flexDirection: "row", alignItems: "center", gap: 4 },
  statText: { fontFamily: theme.fonts.bodyMedium, fontSize: theme.type.small },
});
