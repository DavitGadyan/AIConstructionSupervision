import { StyleSheet, Text, View, type StyleProp, type ViewStyle } from "react-native";
import { Feather, MaterialCommunityIcons } from "@expo/vector-icons";
import type { Order } from "@/lib/api";
import { clockRange, clockRangeSpoken, dayLabel, sameClockMinute, time, yerevanParts } from "@/lib/format";
import { eventFor, isDelayed, stepTimes, type StepTime } from "@/lib/orders";
import { theme } from "@/lib/theme";
import { CardHeader, Pill, WhiteCard, type FeatherName } from "./ui";

const ICONS: Record<StepTime["status"], FeatherName | "quadcopter"> = {
  requested: "inbox",
  confirmed: "check-circle",
  dispatched: "truck",
  on_site: "map-pin",
  flying: "quadcopter",
  processing: "cpu",
  delivered: "file-text",
};

/** A real arrival window; one squeezed into a single minute (demo time scale) reads as a plain "≈" estimate. */
function hasWindow(s: StepTime): s is StepTime & { at: string; windowTo: string } {
  return !!s.at && !!s.windowTo && !sameClockMinute(s.at, s.windowTo);
}

function whenLabel(s: StepTime, now: number): string {
  if (!s.at) return s.state === "skipped" ? "Not reached" : "--:--";
  const sameDay = yerevanParts(s.at)?.dayKey === yerevanParts(now)?.dayKey;
  const day = sameDay ? "" : `${dayLabel(s.at, now)} `;
  if (!s.estimate) return `${day}${time(s.at)}`;
  if (hasWindow(s)) return `${day}${clockRange(s.at, s.windowTo, now)}`;
  if (s.status === "delivered") return `by ${day}${time(s.at)}`;
  return `≈ ${day}${time(s.at)}`;
}

function spoken(s: StepTime, now: number): string {
  const state =
    s.state === "done" ? "done" : s.state === "current" ? "in progress" : s.state === "skipped" ? "not reached" : "upcoming";
  if (!s.at || s.state === "skipped") return `${s.label}, ${state}`;
  const day = dayLabel(s.at, now);
  if (!s.estimate) return `${s.label}, ${state}, at ${day} ${time(s.at)}`;
  if (hasWindow(s)) return `${s.label}, ${state}, expected ${day} ${clockRangeSpoken(s.at, s.windowTo)}`;
  if (s.status === "delivered") return `${s.label}, ${state}, due by ${day} ${time(s.at)}`;
  return `${s.label}, ${state}, estimated around ${day} ${time(s.at)}`;
}

function StepIcon({ name, color }: { name: FeatherName | "quadcopter"; color: string }) {
  return name === "quadcopter" ? (
    <MaterialCommunityIcons name="quadcopter" size={16} color={color} />
  ) : (
    <Feather name={name} size={14} color={color} />
  );
}

/**
 * ORDI "AI Smart Schedule" anatomy for an order: an accent rail on the left,
 * time labels, grey inner slots. Actual times for reached steps, "≈" or a
 * window for estimates; the current step is a white slot with an accent ring.
 * Cancelled orders end with a Cancelled row; a delayed report gets a note.
 */
export function OrderStepper({
  order,
  now,
  title = "Timeline",
  subtitle = "Actual times, ≈ estimates · Yerevan time",
  embedded = false,
  style,
}: {
  order: Order;
  now: number;
  title?: string;
  subtitle?: string;
  /** render the list only (inside a card you already have) */
  embedded?: boolean;
  style?: StyleProp<ViewStyle>;
}) {
  const steps = stepTimes(order);
  const cancelled = order.status === "cancelled" ? eventFor(order, "cancelled") : undefined;
  const delayed = isDelayed(order);
  const rows = steps.filter((s) => !(order.status === "cancelled" && s.state === "skipped"));
  const showSkippedNote = order.status === "cancelled" && rows.length < steps.length;

  const list = (
    <View style={styles.list} accessibilityRole="list">
      {rows.map((s, i) => {
        const last = i === rows.length - 1 && !cancelled;
        const next = rows[i + 1];
        const lineOn = !!next && (next.state === "done" || next.state === "current");
        const current = s.state === "current";
        const done = s.state === "done";
        return (
          <View key={s.status} style={styles.row} accessible accessibilityLabel={spoken(s, now)}>
            <View style={styles.rail}>
              <View
                style={[
                  styles.dot,
                  done && styles.dotDone,
                  current && styles.dotCurrent,
                  s.state === "upcoming" && styles.dotUpcoming,
                ]}
              >
                {done ? <Feather name="check" size={12} color={theme.colors.onAccent} /> : null}
              </View>
              {!last ? <View style={[styles.line, lineOn && styles.lineOn]} /> : null}
            </View>
            <View style={styles.body}>
              <Text style={[styles.when, current && { color: theme.colors.accent }]}>{whenLabel(s, now)}</Text>
              <View style={[styles.slot, current && styles.slotCurrent]}>
                <View style={styles.slotHead}>
                  <StepIcon
                    name={ICONS[s.status]}
                    color={s.state === "upcoming" ? theme.colors.faint : current ? theme.colors.accent : theme.colors.ink}
                  />
                  <Text style={[styles.slotTitle, s.state === "upcoming" && styles.slotTitleFaint]} numberOfLines={1}>
                    {s.label}
                  </Text>
                  {current ? <Pill text={delayed && s.status === "processing" ? "Delayed" : "Now"} tone={delayed && s.status === "processing" ? "warn" : "accent"} /> : null}
                </View>
                {current || (s.state === "upcoming" && i === rows.findIndex((r) => r.state === "upcoming")) ? (
                  <Text style={styles.slotText}>{s.description}</Text>
                ) : null}
                {current && delayed && s.status === "processing" ? (
                  <Text style={[styles.slotText, { color: theme.colors.warn }]}>
                    {eventFor(order, "delayed")?.message ?? "Report is taking longer than usual. Our team is on it."}
                  </Text>
                ) : null}
              </View>
            </View>
          </View>
        );
      })}
      {cancelled ? (
        <View
          style={styles.row}
          accessible
          accessibilityLabel={`Cancelled at ${dayLabel(cancelled.at, now)} ${time(cancelled.at)}. ${cancelled.message}`}
        >
          <View style={styles.rail}>
            <View style={[styles.dot, styles.dotCancelled]}>
              <Feather name="x" size={12} color={theme.colors.onAccent} />
            </View>
          </View>
          <View style={styles.body}>
            <Text style={styles.when}>{time(cancelled.at)}</Text>
            <View style={[styles.slot, { backgroundColor: theme.colors.dangerSoft }]}>
              <Text style={styles.slotTitle}>Cancelled</Text>
              <Text style={styles.slotText}>
                {cancelled.message}
                {showSkippedNote ? " Later steps did not happen." : ""}
              </Text>
            </View>
          </View>
        </View>
      ) : null}
    </View>
  );

  if (embedded) return <View style={style}>{list}</View>;
  return (
    <WhiteCard style={[{ gap: theme.spacing.lg }, style]}>
      <CardHeader title={title} subtitle={subtitle} tone="onWhite" />
      {list}
    </WhiteCard>
  );
}

const DOT = 20;

const styles = StyleSheet.create({
  list: { gap: 0 },
  row: { flexDirection: "row", gap: theme.spacing.md },
  rail: { width: DOT, alignItems: "center" },
  dot: {
    width: DOT,
    height: DOT,
    borderRadius: DOT / 2,
    marginTop: 1,
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: theme.colors.inner,
    borderWidth: 2,
    borderColor: theme.colors.track,
  },
  dotDone: { backgroundColor: theme.colors.accent, borderColor: theme.colors.accent },
  dotCurrent: { backgroundColor: theme.colors.surface, borderColor: theme.colors.accent, borderWidth: 5 },
  dotUpcoming: { backgroundColor: theme.colors.surface },
  dotCancelled: { backgroundColor: theme.colors.danger, borderColor: theme.colors.danger },
  line: { flex: 1, width: 3, borderRadius: 2, backgroundColor: theme.colors.track, marginVertical: 2 },
  lineOn: { backgroundColor: theme.colors.accent },
  body: { flex: 1, paddingBottom: theme.spacing.md, gap: theme.spacing.xs + 2 },
  when: {
    fontFamily: theme.fonts.bodyMedium,
    fontSize: theme.type.small,
    color: theme.colors.ink,
    lineHeight: DOT + 2,
  },
  slot: {
    backgroundColor: theme.colors.inner,
    borderRadius: theme.radius.inner - 4,
    padding: theme.spacing.md,
    gap: theme.spacing.xs,
    borderWidth: 1.5,
    borderColor: theme.colors.transparent,
  },
  slotCurrent: { backgroundColor: theme.colors.surface, borderColor: theme.colors.accent },
  slotHead: { flexDirection: "row", alignItems: "center", gap: theme.spacing.sm },
  slotTitle: { flex: 1, fontFamily: theme.fonts.bodySemi, fontSize: theme.type.label, color: theme.colors.ink },
  slotTitleFaint: { color: theme.colors.muted, fontFamily: theme.fonts.bodyMedium },
  slotText: {
    fontFamily: theme.fonts.body,
    fontSize: theme.type.small,
    lineHeight: theme.type.small * 1.4,
    color: theme.colors.muted,
  },
});
