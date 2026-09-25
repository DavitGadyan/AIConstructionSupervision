import type { ReactNode } from "react";
import { Platform, Pressable, StyleSheet, Text, View, type StyleProp, type ViewStyle } from "react-native";
import { Feather, MaterialCommunityIcons } from "@expo/vector-icons";
import { isActiveStatus, REPORT_HOURS, type Order } from "@/lib/api";
import { amd, clockRange, clockRangeSpoken, countdown, countdownClock, dayTime, time } from "@/lib/format";
import {
  isDelayed,
  kindLabel,
  nextMilestone,
  orderSummary,
  priorityLabel,
  statusColorFor,
  statusHeadline,
  statusLabel,
  statusTone,
} from "@/lib/orders";
import { theme } from "@/lib/theme";
import { RingGauge } from "./RingGauge";
import { Button, CardHeader, GlassCard, Pill } from "./ui";

/** Ring face for an order: countdown to the next milestone, or a final state. */
export function orderRingFace(order: Order, now: number) {
  const m = nextMilestone(order, now);
  if (!m) {
    return order.status === "delivered"
      ? { value: "Ready", caption: "REPORT DELIVERED", pct: 100, spoken: "Report ready" }
      : { value: "--", caption: "CANCELLED", pct: 0, spoken: "Order cancelled" };
  }
  // ~0.5 % steps so the ring animates once a minute-ish, not on every tick
  const pct = Math.round(m.progress * 200) / 2;
  if (m.overdue || m.remainingMs === null || m.remainingMs <= 0) {
    const caption = m.status === "delivered" ? "REPORT DUE NOW" : m.status === "on_site" ? "ANY MINUTE NOW" : "ALMOST THERE";
    return { value: "00:00", caption, pct: 100, spoken: `${m.label}: ${caption.toLowerCase()}` };
  }
  const c = countdownClock(m.remainingMs);
  return {
    value: c.value,
    caption: `${c.unit === "HOURS" ? "HRS" : "MIN"} ${m.caption}`,
    pct,
    spoken: `${m.label} in ${countdown(m.remainingMs)}`,
  };
}

function Tile({ icon, label, value, a11y }: { icon: ReactNode; label: string; value: string; a11y: string }) {
  return (
    <View style={styles.tile} accessible accessibilityLabel={a11y}>
      {icon}
      <View style={{ flex: 1, minWidth: 0 }}>
        <Text style={styles.tileLabel}>{label}</Text>
        {/* adjustsFontSizeToFit is native-only; on web long values ("Tomorrow, 03:22") step down a size instead */}
        <Text
          style={[styles.tileValue, Platform.OS === "web" && value.length > 12 && { fontSize: styles.tileValue.fontSize * 0.86 }]}
          numberOfLines={1}
          adjustsFontSizeToFit
          minimumFontScale={0.8}
        >
          {value}
        </Text>
      </View>
    </View>
  );
}

/**
 * ORDI "Time Tracker" card for the running order (Home): status pill, a ring
 * counting down to the next milestone (arrival, take-off, report), the
 * arrival window and report promise, and a Track button.
 */
export function OrderCard({
  order,
  now,
  onPress,
  onOpenReport,
  style,
}: {
  order: Order;
  /** from useNow(1000) */
  now: number;
  /** open /order/[id] */
  onPress?: () => void;
  /** delivered orders: open the PDF */
  onOpenReport?: () => void;
  style?: StyleProp<ViewStyle>;
}) {
  const face = orderRingFace(order, now);
  const headline = statusHeadline(order, now);
  const arrived = order.arrivedAt;
  const arrival = arrived
    ? { label: "On site", value: time(arrived), a11y: `Crew on site since ${time(arrived)}` }
    : order.etaArrivalFrom
      ? {
          label: "Arrival",
          value: clockRange(order.etaArrivalFrom, order.etaArrivalTo, now),
          a11y: `Arrival ${clockRangeSpoken(order.etaArrivalFrom, order.etaArrivalTo)}`,
        }
      : { label: "Arrival", value: "Setting…", a11y: "Arrival window is being set" };
  const report = order.deliveredAt
    ? { label: "Report", value: `Ready ${time(order.deliveredAt)}`, a11y: `Report delivered at ${time(order.deliveredAt)}` }
    : order.reportDueAt
      ? { label: "Report due", value: dayTime(order.reportDueAt, now), a11y: `Report due ${dayTime(order.reportDueAt, now)}` }
      : {
          label: "Report",
          value: `within ${REPORT_HOURS} h`,
          a11y: `Report within ${REPORT_HOURS} hours after the flight`,
        };
  const delayed = isDelayed(order);

  return (
    <GlassCard blur style={[{ gap: theme.spacing.md }, style]}>
      <CardHeader
        title={kindLabel(order.kind)}
        subtitle={`${order.number} · ${priorityLabel(order.priority)}`}
        onArrow={onPress}
        arrowLabel={`Track ${order.number}`}
        right={
          <Pill
            text={delayed ? "Delayed" : statusLabel(order.status)}
            tone={delayed ? "warn" : statusTone(order.status)}
            style={{ marginRight: onPress ? theme.spacing.sm : 0, marginTop: theme.spacing.sm }}
          />
        }
      />

      <View
        accessible
        accessibilityRole="timer"
        accessibilityLabel={`${headline}. ${face.spoken}.`}
        style={{ alignItems: "center" }}
      >
        <View importantForAccessibility="no-hide-descendants" accessibilityElementsHidden>
          <RingGauge value={face.value} caption={face.caption} earnedPct={face.pct} size={208} />
        </View>
      </View>

      <Text style={styles.headline} accessibilityLiveRegion="none">
        {headline}
      </Text>

      <View style={styles.tiles}>
        <Tile
          icon={<Feather name="clock" size={16} color={theme.colors.accent} />}
          label={arrival.label}
          value={arrival.value}
          a11y={arrival.a11y}
        />
        <Tile
          icon={<Feather name="file-text" size={16} color={theme.colors.accent} />}
          label={report.label}
          value={report.value}
          a11y={report.a11y}
        />
      </View>

      {order.status === "delivered" && onOpenReport ? (
        <Button title="Open report" icon="file-text" onPress={onOpenReport} />
      ) : onPress ? (
        <Button
          title={isActiveStatus(order.status) ? "Track inspection" : "View order"}
          icon="navigation"
          onPress={onPress}
          label={`Track inspection ${order.number}`}
        />
      ) : null}
    </GlassCard>
  );
}

/**
 * Compact order row for lists (Activity > Orders): status icon, kind +
 * number, headline or final date, price and priority pills, chevron.
 */
export function OrderRow({
  order,
  now,
  onPress,
  style,
}: {
  order: Order;
  now: number;
  onPress?: () => void;
  style?: StyleProp<ViewStyle>;
}) {
  const running = isActiveStatus(order.status);
  const when =
    order.status === "delivered"
      ? `Delivered ${dayTime(order.deliveredAt, now)}`
      : order.status === "cancelled"
        ? `Cancelled ${dayTime(order.events?.find((e) => e.status === "cancelled")?.at ?? order.createdAt, now)}`
        : statusHeadline(order, now);
  const color = statusColorFor(isDelayed(order) ? "delayed" : order.status);
  return (
    <Pressable
      onPress={onPress}
      disabled={!onPress}
      accessibilityRole={onPress ? "button" : undefined}
      accessibilityLabel={`${orderSummary(order, now)}. ${amd(order.priceAmd)}.`}
      accessibilityHint={onPress ? "Opens the order" : undefined}
    >
      {({ pressed }) => (
        <GlassCard style={[styles.row, pressed && { opacity: 0.8 }, style]}>
          <View style={[styles.rowIcon, running && { backgroundColor: theme.colors.accentSoft }]}>
            {order.status === "flying" ? (
              <MaterialCommunityIcons name="quadcopter" size={22} color={color} />
            ) : (
              <Feather
                name={order.status === "delivered" ? "file-text" : order.status === "cancelled" ? "x-circle" : "truck"}
                size={20}
                color={color}
              />
            )}
          </View>
          <View style={{ flex: 1, gap: theme.spacing.xs }}>
            <Text style={styles.rowTitle} numberOfLines={1}>
              {kindLabel(order.kind)} · {order.number}
            </Text>
            <Text style={styles.rowSub} numberOfLines={1}>
              {when}
            </Text>
            <View style={styles.rowPills}>
              <Pill text={statusLabel(order.status)} tone={statusTone(order.status)} />
              <Pill text={amd(order.priceAmd)} tone="white" />
              {order.priority === "scheduled" ? <Pill text="Scheduled" tone="soft" /> : null}
            </View>
          </View>
          {onPress ? <Feather name="chevron-right" size={20} color={theme.colors.ink} /> : null}
        </GlassCard>
      )}
    </Pressable>
  );
}

const styles = StyleSheet.create({
  headline: {
    fontFamily: theme.fonts.displaySemi,
    fontSize: theme.type.h3,
    color: theme.colors.ink,
    textAlign: "center",
  },
  tiles: { flexDirection: "row", gap: theme.spacing.sm },
  tile: {
    flex: 1,
    flexDirection: "row",
    alignItems: "center",
    gap: theme.spacing.sm,
    backgroundColor: theme.colors.surface,
    borderRadius: theme.radius.inner,
    paddingHorizontal: theme.spacing.md,
    paddingVertical: theme.spacing.sm + 2,
    minHeight: theme.field,
  },
  tileLabel: { fontFamily: theme.fonts.body, fontSize: theme.type.micro + 1, color: theme.colors.muted },
  tileValue: { fontFamily: theme.fonts.bodySemi, fontSize: theme.type.small + 1, color: theme.colors.ink, marginTop: 1 },

  row: { flexDirection: "row", alignItems: "center", gap: theme.spacing.md, padding: theme.spacing.md },
  rowIcon: {
    width: 48,
    height: 48,
    borderRadius: theme.radius.inner - 2,
    backgroundColor: theme.colors.surface,
    alignItems: "center",
    justifyContent: "center",
  },
  rowTitle: { fontFamily: theme.fonts.bodySemi, fontSize: theme.type.label, color: theme.colors.ink },
  rowSub: { fontFamily: theme.fonts.body, fontSize: theme.type.small, color: theme.colors.muted },
  rowPills: { flexDirection: "row", flexWrap: "wrap", gap: theme.spacing.xs },
});
