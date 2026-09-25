import { useEffect, useState } from "react";
import { Linking, Platform, StyleSheet, Text, View } from "react-native";
import { Redirect, useLocalSearchParams, useRouter } from "expo-router";
import * as Haptics from "expo-haptics";
import { Feather } from "@expo/vector-icons";
import { api, errorMessage, ETA_HOURS, isActiveStatus, isApiError, REPORT_HOURS, type Order } from "@/lib/api";
import { openPdf, sharePdf } from "@/lib/files";
import { amd, countdown, dayTime, hoursLabel, telHref, time } from "@/lib/format";
import { announce, useAsync, useNow, usePrevious } from "@/lib/hooks";
import { useLive, useOrder } from "@/lib/live";
import {
  isDelayed,
  kindLabel,
  latestEvent,
  nextMilestone,
  priorityLabel,
  statusColorFor,
  statusLabel,
} from "@/lib/orders";
import { useRoles } from "@/lib/roles";
import { useSession } from "@/lib/session";
import { theme } from "@/lib/theme";
import { Screen } from "@/components/Screen";
import { OrderCard } from "@/components/OrderCard";
import { OrderStepper } from "@/components/OrderStepper";
import { CrewCard } from "@/components/CrewCard";
import { MapCard } from "@/components/MapCard";
import {
  AccentCard,
  BackHeader,
  Button,
  CardHeader,
  EmptyState,
  ErrorState,
  GlassCard,
  KeyValueRow,
  LoadingState,
  Pill,
  SectionLabel,
  Sheet,
  StatusDot,
} from "@/components/ui";

function haptic(kind: "success" | "error" | "warning") {
  if (Platform.OS === "web") return;
  Haptics.notificationAsync(
    kind === "success"
      ? Haptics.NotificationFeedbackType.Success
      : kind === "warning"
        ? Haptics.NotificationFeedbackType.Warning
        : Haptics.NotificationFeedbackType.Error,
  ).catch(() => {});
}

export default function OrderScreen() {
  const { ready, token } = useSession();
  const { id } = useLocalSearchParams<{ id: string }>();
  if (!ready) return null;
  if (!token) return <Redirect href="/login" />;
  const orderId = Array.isArray(id) ? id[0] : id;
  return <Tracking token={token} id={orderId ?? ""} />;
}

function Tracking({ token, id }: { token: string; id: string }) {
  const router = useRouter();
  const live = useLive();
  const session = useSession();
  const roles = useRoles();
  const { order, error, loading, refreshing, reload } = useOrder(id || null);
  const running = !!order && isActiveStatus(order.status);
  const now = useNow(1000, running);

  const [notice, setNotice] = useState<string | null>(null);
  const [confirmCancel, setConfirmCancel] = useState(false);
  const [cancelling, setCancelling] = useState(false);
  const [cancelError, setCancelError] = useState<string | null>(null);
  const [pdfBusy, setPdfBusy] = useState<"open" | "share" | null>(null);

  // A polite announcement only when the status itself changes (not on every countdown tick).
  // Android and web read the live-region line below; iOS has no live regions.
  const status = order ? (isDelayed(order) ? "delayed" : order.status) : undefined;
  const prevStatus = usePrevious(status);
  useEffect(() => {
    if (!order || !status || !prevStatus || prevStatus === status) return;
    if (Platform.OS === "ios") announce(`${statusLabel(status)}. ${latestEvent(order)?.message ?? ""}`);
    if (status === "delivered") haptic("success");
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [status]);

  // the order may no longer be cancellable by the time the sheet is confirmed
  useEffect(() => {
    if (confirmCancel && order && !order.canCancel && !cancelling) setConfirmCancel(false);
  }, [confirmCancel, order, cancelling]);

  // site coordinates: the current project's profile, or the order's own project
  const profileMatch = live.profile && order && live.profile.project.id === order.projectId ? live.profile : undefined;
  const remoteProfile = useAsync(
    () => api.projectProfile(token, order!.projectId),
    [token, order?.projectId],
    !!order && !profileMatch,
  );
  const site = (profileMatch ?? remoteProfile.data)?.project;

  const cancel = async () => {
    if (!order) return;
    setCancelling(true);
    setCancelError(null);
    try {
      const o = await api.cancelOrder(token, order.id);
      live.upsertOrder(o);
      setConfirmCancel(false);
      haptic("success");
    } catch (e) {
      haptic("error");
      if (isApiError(e, 409)) {
        setCancelError(e.message || "The crew is already on site, so this order can no longer be cancelled.");
        reload();
      } else {
        setCancelError(errorMessage(e, "Couldn't cancel the order."));
      }
    } finally {
      setCancelling(false);
    }
  };

  const pdf = async (mode: "open" | "share") => {
    if (!order?.reportUrl || pdfBusy) return;
    setPdfBusy(mode);
    setNotice(null);
    const file = { id: order.reportId ?? order.id, url: order.reportUrl };
    const opts = { kind: "report" as const, title: `${order.number} inspection report` };
    try {
      if (mode === "open") await openPdf(file, token, opts);
      else await sharePdf(file, token, opts);
    } catch (e) {
      setNotice(errorMessage(e, "Couldn't open the report."));
    } finally {
      setPdfBusy(null);
    }
  };

  /* ---------------- states */

  if (!order) {
    const notFound = !!error && /not found|404/i.test(error);
    return (
      <Screen tabs={false} refreshing={false} onRefresh={reload}>
        <BackHeader title="Inspection" subtitle="Order tracking" />
        <GlassCard>
          {loading || (!error && !!id) ? (
            <LoadingState label="Loading the order…" />
          ) : notFound || !id ? (
            <EmptyState
              icon="search"
              title="Order not found"
              body="It may have been removed, or the project is no longer shared with your company."
              action={<Button title="Go to Activity" variant="white" icon="activity" onPress={() => router.replace("/activity")} />}
            />
          ) : (
            <ErrorState message={error ?? "Couldn't load the order."} onRetry={reload} />
          )}
        </GlassCard>
      </Screen>
    );
  }

  const delayed = isDelayed(order);
  const last = latestEvent(order);
  const cancelledAt = order.events.find((e) => e.status === "cancelled")?.at ?? null;
  const canOrderAgain = order.projectId === session.projectId && roles.canOrder && !live.activeOrder;
  const statusName = delayed ? "Delayed" : statusLabel(order.status);
  const statusMessage = last?.message ?? statusName;

  return (
    <Screen tabs={false} refreshing={refreshing} onRefresh={reload}>
      <BackHeader title={order.number} subtitle={order.projectName} />

      {/* the only live region on the screen: changes with the status, not with the clock */}
      <View
        style={styles.statusLine}
        accessibilityLiveRegion="polite"
        accessible
        accessibilityLabel={`Status: ${statusName}. ${statusMessage}`}
      >
        <StatusDot color={statusColorFor(delayed ? "delayed" : order.status)} size={10} />
        <Text style={styles.statusText} numberOfLines={2}>
          {statusMessage}
        </Text>
        <Text style={styles.statusTime}>{time(last?.at ?? order.createdAt)}</Text>
      </View>

      {error ? (
        <Text style={styles.stale} accessibilityRole="alert">
          Couldn't refresh: {error}. Showing the last known status.
        </Text>
      ) : null}

      {order.status === "cancelled" ? (
        <GlassCard style={{ gap: theme.spacing.md }}>
          <CardHeader title="Order cancelled" subtitle={`${kindLabel(order.kind)} · ${order.number}`} />
          <Text style={styles.cancelledText}>
            {`Cancelled ${cancelledAt ? dayTime(cancelledAt, now) : ""} before the crew reached the site. Nothing is invoiced.`}
          </Text>
          {canOrderAgain ? (
            <Button title="Order again" icon="plus" onPress={() => router.push("/new-order")} label="Order a new inspection" />
          ) : null}
        </GlassCard>
      ) : (
        <OrderCard order={order} now={now} />
      )}

      {delayed ? (
        <View style={styles.warn} accessibilityRole="alert">
          <Feather name="alert-triangle" size={18} color={theme.colors.warn} />
          <Text style={styles.warnText}>
            {last?.message ?? "Report is taking longer than usual. Our team is on it."} We'll notify you as soon as it's ready.
          </Text>
        </View>
      ) : null}

      <ReportCard order={order} now={now} busy={pdfBusy} onOpen={() => pdf("open")} onShare={() => pdf("share")} />

      {notice ? (
        <Text style={styles.stale} accessibilityRole="alert">
          {notice}
        </Text>
      ) : null}

      <OrderStepper order={order} now={now} />

      {order.status !== "cancelled" || order.crew ? (
        <CrewCard crew={order.crew} status={order.status} onCallError={setNotice} />
      ) : null}

      <MapCard
        title="Site"
        lat={site?.lat}
        lng={site?.lng}
        address={site?.address ?? order.projectAddress}
        label={order.projectName}
      />

      <Details order={order} now={now} onError={setNotice} />

      {order.canCancel ? (
        <View style={{ gap: theme.spacing.sm }}>
          <Button
            title="Cancel inspection"
            icon="x-circle"
            variant="danger"
            onPress={() => {
              setCancelError(null);
              setConfirmCancel(true);
            }}
            label={`Cancel inspection ${order.number}`}
          />
          <Text style={styles.cancelNote}>Free of charge until the crew is on site.</Text>
        </View>
      ) : null}

      <Sheet
        visible={confirmCancel}
        onClose={() => !cancelling && setConfirmCancel(false)}
        tone="danger"
        icon="x-circle"
        title={`Cancel ${order.number}?`}
        body={
          order.crew
            ? `${order.crew.pilot} is already on the way. We'll call them back; nothing is invoiced.`
            : "The crew won't be dispatched and nothing is invoiced. You can order again at any time."
        }
        actions={
          <>
            {cancelError ? (
              <Text style={styles.sheetError} accessibilityRole="alert">
                {cancelError}
              </Text>
            ) : null}
            <Button
              title="Cancel inspection"
              variant="danger"
              icon="x-circle"
              loading={cancelling}
              onPress={cancel}
              label={`Yes, cancel inspection ${order.number}`}
            />
            <Button title="Keep the order" variant="ghost" onPress={() => setConfirmCancel(false)} disabled={cancelling} />
          </>
        }
      />
    </Screen>
  );
}

/* ------------------------------------------------------------------ report */

function ReportCard({
  order,
  now,
  busy,
  onOpen,
  onShare,
}: {
  order: Order;
  now: number;
  busy: "open" | "share" | null;
  onOpen: () => void;
  onShare: () => void;
}) {
  if (order.status === "cancelled") return null;

  if (order.status === "delivered" && order.reportUrl) {
    return (
      <AccentCard style={{ gap: theme.spacing.md }}>
        <CardHeader
          title="Report ready"
          subtitle={order.deliveredAt ? `Delivered ${dayTime(order.deliveredAt, now)}` : "Independent PDF report"}
          tone="onAccent"
        />
        <View style={styles.reportBox}>
          <Feather name="file-text" size={22} color={theme.colors.onAccent} />
          <Text style={styles.reportBoxText}>
            Independent PDF: progress against the schedule, lagging floors and the drone shots that prove them. Hashed so
            it can stand as evidence.
          </Text>
        </View>
        <View style={styles.row2}>
          <Button
            title="Open PDF"
            icon="external-link"
            variant="white"
            style={styles.half}
            loading={busy === "open"}
            disabled={!!busy}
            onPress={onOpen}
            label={`Open the report for ${order.number}`}
          />
          <Button
            title="Share"
            icon="share"
            variant="white"
            style={styles.half}
            loading={busy === "share"}
            disabled={!!busy}
            onPress={onShare}
            label={`Share the report for ${order.number}`}
          />
        </View>
      </AccentCard>
    );
  }

  const m = nextMilestone(order, now);
  const due = order.reportDueAt ? Date.parse(order.reportDueAt) : null;
  const processing = order.status === "processing";
  const left = due !== null ? due - now : null;
  const headline = processing
    ? left !== null && left > 0
      ? `Due in ${countdown(left)}`
      : "Due any minute"
    : order.flightEndedAt
      ? "Being prepared"
      : `Within ${REPORT_HOURS} h after the flight`;
  const sub =
    due !== null
      ? `${processing ? "Due by" : "Expected by"} ${dayTime(order.reportDueAt, now)} · Yerevan time`
      : `The countdown starts when the drone lands.`;
  const progress = processing && m ? m.progress : 0;

  return (
    <GlassCard style={{ gap: theme.spacing.md }}>
      <CardHeader title="Independent report" subtitle={`PDF within ${REPORT_HOURS} h of the flight`} />
      <View style={styles.dueRow} accessible accessibilityLabel={`${headline}. ${sub}`}>
        <View style={styles.dueIcon}>
          <Feather name="file-text" size={20} color={theme.colors.accent} />
        </View>
        <View style={{ flex: 1 }}>
          <Text style={styles.dueValue}>{headline}</Text>
          <Text style={styles.dueSub}>{sub}</Text>
        </View>
      </View>
      {processing ? (
        <View style={styles.track} importantForAccessibility="no-hide-descendants" accessibilityElementsHidden>
          <View style={[styles.fill, { width: `${Math.round(progress * 100)}%` }]} />
        </View>
      ) : null}
      <Text style={styles.dueNote}>We'll notify you the moment it's ready. You can open and share it from here.</Text>
    </GlassCard>
  );
}

/* ------------------------------------------------------------------ details */

function Details({ order, now, onError }: { order: Order; now: number; onError: (m: string) => void }) {
  const call = async (phone: string) => {
    const href = telHref(phone);
    if (!href) return;
    try {
      await Linking.openURL(href);
    } catch {
      onError(`Couldn't start a call. The number is ${phone}.`);
    }
  };
  return (
    <GlassCard style={{ gap: theme.spacing.xs }}>
      <CardHeader title="Order details" subtitle={`Placed ${dayTime(order.createdAt, now)}`} />
      <View>
        <KeyValueRow label="Order number" value={order.number} icon="hash" />
        <KeyValueRow label="Inspection" value={kindLabel(order.kind)} icon="layers" />
        <KeyValueRow
          label="When"
          value={
            order.priority === "scheduled" && order.scheduledFor
              ? `Scheduled · ${dayTime(order.scheduledFor, now)}`
              : `${priorityLabel(order.priority)} · on site in ${hoursLabel(ETA_HOURS)}`
          }
          icon="clock"
        />
        <KeyValueRow label="Price" value={`${amd(order.priceAmd)} · VAT excl., paid by invoice`} icon="credit-card" />
        <KeyValueRow label="Requested by" value={order.requestedBy.name} icon="user" />
        <KeyValueRow
          label="Site contact"
          value={`${order.contactName} · ${order.contactPhone}`}
          icon="phone"
          onPress={telHref(order.contactPhone) ? () => call(order.contactPhone) : undefined}
          actionIcon="phone"
          actionLabel={`Calls ${order.contactName}`}
        />
        <KeyValueRow label="Access notes" value={order.accessNotes} placeholder="None" icon="key" numberOfLines={4} />
        <KeyValueRow
          label="Site"
          value={`${order.projectName} · ${order.projectAddress}`}
          icon="map-pin"
          divider={order.focus.length > 0}
        />
        {order.focus.length ? (
          <View style={styles.focus} accessible accessibilityLabel={`Focus: ${order.focus.join(", ")}`}>
            <SectionLabel>Focus</SectionLabel>
            <View style={styles.focusChips}>
              {order.focus.map((f) => (
                <Pill key={f} text={f} tone="white" />
              ))}
            </View>
          </View>
        ) : null}
      </View>
    </GlassCard>
  );
}

const styles = StyleSheet.create({
  statusLine: {
    flexDirection: "row",
    alignItems: "center",
    gap: theme.spacing.sm,
    backgroundColor: theme.colors.glassStrong,
    borderRadius: theme.radius.btn,
    borderWidth: 1,
    borderColor: theme.colors.glassBorder,
    paddingHorizontal: theme.spacing.md,
    paddingVertical: theme.spacing.sm + 2,
    minHeight: theme.tap,
  },
  statusText: { flex: 1, fontFamily: theme.fonts.bodyMedium, fontSize: theme.type.small + 1, color: theme.colors.ink },
  statusTime: { fontFamily: theme.fonts.bodyMedium, fontSize: theme.type.small, color: theme.colors.muted },
  stale: {
    fontFamily: theme.fonts.bodyMedium,
    fontSize: theme.type.small + 1,
    lineHeight: (theme.type.small + 1) * 1.4,
    color: theme.colors.danger,
    marginHorizontal: theme.spacing.xs,
  },
  warn: {
    flexDirection: "row",
    alignItems: "flex-start",
    gap: theme.spacing.sm,
    backgroundColor: theme.colors.warnSoft,
    borderRadius: theme.radius.inner,
    padding: theme.spacing.md,
  },
  warnText: {
    flex: 1,
    fontFamily: theme.fonts.bodyMedium,
    fontSize: theme.type.small + 1,
    lineHeight: (theme.type.small + 1) * 1.4,
    color: theme.colors.ink,
  },
  reportBox: {
    flexDirection: "row",
    alignItems: "center",
    gap: theme.spacing.md,
    backgroundColor: theme.colors.onAccentCard,
    borderRadius: theme.radius.inner,
    borderWidth: 1,
    borderColor: theme.colors.onAccentBorder,
    padding: theme.spacing.md,
  },
  reportBoxText: {
    flex: 1,
    fontFamily: theme.fonts.body,
    fontSize: theme.type.small + 1,
    lineHeight: (theme.type.small + 1) * 1.4,
    color: theme.colors.onAccentMuted,
  },
  row2: { flexDirection: "row", gap: theme.spacing.sm },
  half: { flex: 1, paddingHorizontal: theme.spacing.md },
  dueRow: { flexDirection: "row", alignItems: "center", gap: theme.spacing.md },
  dueIcon: {
    width: 48,
    height: 48,
    borderRadius: theme.radius.inner - 2,
    backgroundColor: theme.colors.surface,
    alignItems: "center",
    justifyContent: "center",
  },
  dueValue: { fontFamily: theme.fonts.displaySemi, fontSize: theme.type.h3 + 2, color: theme.colors.ink },
  dueSub: { fontFamily: theme.fonts.body, fontSize: theme.type.small, color: theme.colors.muted, marginTop: 2 },
  dueNote: {
    fontFamily: theme.fonts.body,
    fontSize: theme.type.small,
    lineHeight: theme.type.small * 1.4,
    color: theme.colors.muted,
  },
  track: { height: 6, borderRadius: 3, backgroundColor: theme.colors.track, overflow: "hidden" },
  fill: { height: 6, borderRadius: 3, backgroundColor: theme.colors.accent },
  focus: { gap: theme.spacing.sm, paddingTop: theme.spacing.md },
  focusChips: { flexDirection: "row", flexWrap: "wrap", gap: theme.spacing.xs + 2 },
  cancelledText: {
    fontFamily: theme.fonts.body,
    fontSize: theme.type.label - 1,
    lineHeight: (theme.type.label - 1) * theme.type.leadingBody,
    color: theme.colors.muted,
  },
  cancelNote: {
    fontFamily: theme.fonts.body,
    fontSize: theme.type.small,
    color: theme.colors.muted,
    textAlign: "center",
  },
  sheetError: {
    fontFamily: theme.fonts.bodyMedium,
    fontSize: theme.type.small + 1,
    lineHeight: (theme.type.small + 1) * 1.4,
    color: theme.colors.danger,
  },
});
