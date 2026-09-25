import { useEffect, useState } from "react";
import { Pressable, StyleSheet, Text, View } from "react-native";
import { Image } from "expo-image";
import { useRouter, type Href } from "expo-router";
import { Feather } from "@expo/vector-icons";
import {
  api,
  errorMessage,
  imageSource,
  isActiveStatus,
  ETA_HOURS,
  ORDER_KINDS,
  REPORT_HOURS,
  type Finding,
  type Order,
  type ProjectProfile,
} from "@/lib/api";
import { openPdf } from "@/lib/files";
import { amd, clockRange, clockRangeSpoken, hoursLabel, pct, relative, time, titleCase, yerevanParts } from "@/lib/format";
import { useAsync, useNow } from "@/lib/hooks";
import { useLive } from "@/lib/live";
import { asapWindow, kindLabel } from "@/lib/orders";
import { useAuthed } from "@/lib/session";
import { theme } from "@/lib/theme";
import { Screen } from "@/components/Screen";
import { Header } from "@/components/Header";
import { OrderCard } from "@/components/OrderCard";
import { ReportsList } from "@/components/ReportsList";
import { ShotRail } from "@/components/cards";
import { useOrderAction } from "@/components/TabBar";
import {
  AccentCard,
  Button,
  CardHeader,
  EmptyState,
  ErrorState,
  GlassCard,
  LoadingState,
  Pill,
  SquareButton,
  StatusDot,
  WhiteCard,
} from "@/components/ui";

/** A delivered order keeps a "Report ready" strip on Home for this long. */
const DELIVERED_SHOWCASE_MS = 6 * 3_600_000;

export default function Home() {
  const { token, projectId, project, user } = useAuthed();
  const router = useRouter();
  const live = useLive();
  const order = useOrderAction();
  const dash = useAsync(() => api.project(token, projectId), [token, projectId], !!projectId);
  const [refreshing, setRefreshing] = useState(false);
  const [notice, setNotice] = useState<string | null>(null);

  // a finding / finished flight / delivered order on the live stream: refetch quietly
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
        api
          .project(token, projectId)
          .then((d) => dash.setData(() => d))
          .catch(() => {}),
        live.refresh(),
        live.refreshProfile(),
        live.refreshOrders(),
      ]);
    } finally {
      setRefreshing(false);
    }
  };

  const profile = live.profile;
  const flights = live.flights ?? [];
  const latestFlight = flights[0];
  const findings = dash.data?.findings ?? [];
  const openShot = (flightId: string, shotId: string) => router.push({ pathname: "/shot", params: { flightId, shotId } });

  // running order -> ring countdown card; otherwise the "Order an inspection" card,
  // with a "Report ready" strip above it for a just-delivered order
  const active = live.activeOrder;
  const latest = live.orders?.[0];
  const recentDelivered =
    !active && latest?.status === "delivered" && latest.deliveredAt && latest.reportUrl
      ? Date.now() - new Date(latest.deliveredAt).getTime() < DELIVERED_SHOWCASE_MS
        ? latest
        : null
      : null;
  const openReport = (o: Order) =>
    openPdf({ id: o.reportId ?? o.id, url: o.reportUrl! }, token, {
      kind: "report",
      title: `${o.number} report`,
    }).catch((e) => setNotice(errorMessage(e, "Couldn't open the report.")));
  const ordersUnknown = live.orders === undefined && !profile && (live.ordersLoading || live.profileLoading);

  return (
    <Screen refreshing={refreshing} onRefresh={onRefresh}>
      <Header alert={!!active || findings.length > 0} />

      <Greeting name={user?.name} roleTag={order.roles.roleTag} org={user?.org?.name} />

      {notice ? (
        <Text style={styles.notice} accessibilityRole="alert">
          {notice}
        </Text>
      ) : null}

      {active ? (
        <LiveOrderCard order={active} onPress={() => router.push(`/order/${active.id}` as Href)} />
      ) : ordersUnknown ? (
        <GlassCard>
          <LoadingState label="Checking inspections…" />
        </GlassCard>
      ) : (
        <>
          {recentDelivered ? (
            <DeliveredStrip
              order={recentDelivered}
              onOpenOrder={() => router.push(`/order/${recentDelivered.id}` as Href)}
              onOpenReport={() => openReport(recentDelivered)}
            />
          ) : null}
          <OrderPromoCard token={token} action={order} />
        </>
      )}

      <ProjectSnapshot
        profile={profile}
        loading={live.profileLoading}
        error={live.profileError}
        onRetry={live.refreshProfile}
        fallbackName={project?.name}
        fallbackAddress={project?.address}
        token={token}
        onOpen={() => router.push("/project" as Href)}
      />

      {dash.loading ? (
        <WhiteCard>
          <LoadingState label="Loading lag alerts…" />
        </WhiteCard>
      ) : dash.error && !dash.data ? (
        <WhiteCard>
          <ErrorState message={dash.error} onRetry={dash.reload} />
        </WhiteCard>
      ) : (
        <LagAlerts
          findings={findings}
          onOpen={() => router.push("/reports")}
          onFinding={(f) => {
            const shotId = f.evidence?.[0];
            const fl = flights.find((x) => x.shots.some((s) => s.id === shotId));
            if (fl && shotId) openShot(fl.id, shotId);
          }}
          canOpenShot={(f) => {
            const shotId = f.evidence?.[0];
            return !!shotId && flights.some((x) => x.shots.some((s) => s.id === shotId));
          }}
        />
      )}

      <SectionHead title="Recent reports" action="See all reports" onPress={() => router.push("/reports")} />
      {profile ? (
        <ReportsList
          reports={profile.recentReports}
          token={token}
          limit={3}
          emptyBody={`Order an inspection and the independent PDF lands here within ${REPORT_HOURS} h of the flight.`}
        />
      ) : live.profileError ? (
        <Text style={styles.muted}>Reports load with the project profile. Pull down to retry.</Text>
      ) : (
        <LoadingState label="Loading reports…" />
      )}

      {/* ORDI Today's Tasks -> latest drone shots */}
      <GlassCard blur style={{ paddingRight: 0 }}>
        <View style={{ paddingRight: theme.spacing.lg }}>
          <CardHeader
            title="Drone shots"
            subtitle={
              latestFlight
                ? `${latestFlight.shots.length} frames · ${relative(latestFlight.capturedAt)}`
                : "Waiting for the first flight"
            }
            onArrow={() => router.push("/flights")}
            arrowLabel="Open all flights"
          />
        </View>
        <View style={{ marginTop: theme.spacing.lg }}>
          {live.loading && !live.flights ? (
            <LoadingState label="Loading shots…" />
          ) : live.error && !live.flights ? (
            <ErrorState message={live.error} onRetry={live.refresh} />
          ) : (
            <ShotRail
              shots={latestFlight?.shots ?? []}
              token={token}
              freshIds={live.freshShotIds}
              status={latestFlight?.status}
              onShot={(s) => latestFlight && openShot(latestFlight.id, s.id)}
            />
          )}
        </View>
        {live.lastMessage ? (
          <Text style={styles.liveMsg} accessibilityLiveRegion="polite">
            {live.lastMessage}
          </Text>
        ) : null}
      </GlassCard>

      {order.sheet}
    </Screen>
  );
}

/* ------------------------------------------------------------------ greeting */

function greetingFor(now: number) {
  const h = yerevanParts(now)?.hour ?? 12;
  if (h >= 5 && h < 12) return "Good morning";
  if (h >= 12 && h < 18) return "Good afternoon";
  return "Good evening";
}

function Greeting({ name, roleTag, org }: { name?: string; roleTag: string; org?: string }) {
  const now = useNow(60_000);
  const first = name?.split(/\s+/)[0];
  return (
    <View style={styles.greeting}>
      <Text style={styles.hello} accessibilityRole="header" numberOfLines={2}>
        {greetingFor(now)}
        {first ? `, ${first}` : ""}
      </Text>
      <View style={styles.roleRow}>
        {roleTag ? <Pill text={roleTag} tone="dark" /> : null}
        {org ? (
          <Text style={styles.org} numberOfLines={1}>
            {org}
          </Text>
        ) : null}
      </View>
    </View>
  );
}

/* ------------------------------------------------------------------ order */

/** OrderCard with its own 1 s clock, so only the card re-renders while counting down. */
function LiveOrderCard({ order, onPress }: { order: Order; onPress: () => void }) {
  const now = useNow(1000, isActiveStatus(order.status));
  return <OrderCard order={order} now={now} onPress={onPress} />;
}

/** Compact "Report ready" row for an order delivered in the last few hours. */
function DeliveredStrip({
  order,
  onOpenOrder,
  onOpenReport,
}: {
  order: Order;
  onOpenOrder: () => void;
  onOpenReport: () => void;
}) {
  return (
    <WhiteCard style={styles.delivered}>
      <Pressable
        onPress={onOpenOrder}
        accessibilityRole="button"
        accessibilityLabel={`Report ready for ${order.number}, ${kindLabel(order.kind)}, delivered ${time(order.deliveredAt)}`}
        accessibilityHint="Opens the order"
        style={({ pressed }) => [styles.deliveredMain, pressed && { opacity: 0.7 }]}
      >
        <View style={styles.deliveredIcon}>
          <Feather name="check-circle" size={20} color={theme.colors.ok} />
        </View>
        <View style={{ flex: 1, minWidth: 0 }}>
          <Text style={styles.deliveredTitle}>Report ready</Text>
          <Text style={styles.deliveredSub} numberOfLines={1}>
            {order.number} · {kindLabel(order.kind)} · {time(order.deliveredAt)}
          </Text>
        </View>
      </Pressable>
      <SquareButton icon="file-text" label={`Open the ${order.number} report PDF`} variant="inner" onPress={onOpenReport} />
    </WhiteCard>
  );
}

// "from" price: the cheapest kind, scheduled (ASAP costs more). Fetched once per session.
let fromPriceCache: number | null = null;

function useFromPrice(token: string) {
  const [price, setPrice] = useState<number | null>(fromPriceCache);
  useEffect(() => {
    if (fromPriceCache !== null || !token) return;
    let alive = true;
    Promise.all(ORDER_KINDS.map((k) => api.quote(token, k, "scheduled")))
      .then((qs) => {
        fromPriceCache = Math.min(...qs.map((q) => q.priceAmd));
        if (alive) setPrice(fromPriceCache);
      })
      .catch(() => {});
    return () => {
      alive = false;
    };
  }, [token]);
  return price;
}

/**
 * ORDI "Team Tasks Overview" accent card: the promise (3–4 h on site, 12 h
 * report), today's ASAP arrival window, the from-price, and Order now.
 * Viewers get the same promise with "Who can order?" instead.
 */
function OrderPromoCard({ token, action }: { token: string; action: ReturnType<typeof useOrderAction> }) {
  const now = useNow(60_000);
  const price = useFromPrice(token);
  const w = asapWindow(now);
  const blocked = action.mode === "blocked";
  const inspector = action.roles.isInspector;
  const eta = hoursLabel(ETA_HOURS);

  return (
    <AccentCard style={{ gap: theme.spacing.md }}>
      <CardHeader
        title={blocked ? "Inspections on demand" : inspector ? "Order a revision" : "Order an inspection"}
        subtitle="Yerevan & Kotayk · paid by invoice"
        tone="onAccent"
        onArrow={action.open}
        arrowLabel={blocked ? "Who can order inspections" : action.label}
      />
      <View style={styles.promo}>
        <Text style={styles.promoTitle}>Car + drone on site in {eta}</Text>
        <Text style={styles.promoBody}>
          {blocked
            ? `An owner or supervisor orders; you track the crew and get the independent PDF within ${REPORT_HOURS} h of the flight.`
            : `Order now and the crew arrives ${clockRange(w.from, w.to, now)}. Independent PDF report within ${REPORT_HOURS} h of the flight.`}
        </Text>
        <View style={styles.promoFoot}>
          <View style={styles.promoPills}>
            <Pill text={`${eta} on site`} tone="white" />
            <Pill text={`${REPORT_HOURS} h report`} tone="dark" />
          </View>
          {price !== null ? (
            <Text style={styles.promoPrice} accessibilityLabel={`From ${price} drams, VAT excluded`}>
              from {amd(price)}
            </Text>
          ) : null}
        </View>
      </View>
      <Button
        title={blocked ? "Who can order?" : "Order now"}
        icon={blocked ? "lock" : "arrow-right"}
        variant="white"
        onPress={action.open}
        label={
          blocked
            ? "Who can order inspections"
            : `${action.label}. Crew on site ${clockRangeSpoken(w.from, w.to)}`
        }
      />
      <Text style={styles.fine}>Daylight flying only; weather or restricted airspace can move the slot.</Text>
    </AccentCard>
  );
}

/* ------------------------------------------------------------------ project snapshot */

function severityTone(s?: string): "ok" | "warn" | "danger" | "soft" {
  return s === "on-track" ? "ok" : s === "watch" ? "warn" : s === "late" || s === "critical" ? "danger" : "soft";
}

function ProjectSnapshot({
  profile,
  loading,
  error,
  onRetry,
  fallbackName,
  fallbackAddress,
  token,
  onOpen,
}: {
  profile?: ProjectProfile;
  loading: boolean;
  error: string | null;
  onRetry: () => void;
  fallbackName?: string;
  fallbackAddress?: string;
  token: string;
  onOpen: () => void;
}) {
  if (!profile) {
    return (
      <GlassCard>
        <CardHeader
          title={fallbackName ?? "Project"}
          subtitle={fallbackAddress}
          onArrow={onOpen}
          arrowLabel="Open project details"
        />
        {error && !loading ? (
          <ErrorState message={error} onRetry={onRetry} />
        ) : (
          <LoadingState label="Loading project…" />
        )}
      </GlassCard>
    );
  }
  const p = profile.project;
  const s = profile.status;
  const behind = Math.max(0, Math.round(s.daysBehind));
  return (
    <GlassCard blur style={{ gap: theme.spacing.md }}>
      <Pressable
        onPress={onOpen}
        accessibilityRole="button"
        accessibilityLabel={`${p.name}, ${p.address}. ${behind} days behind, ${titleCase(s.severity)}. Open project details`}
        style={({ pressed }) => [styles.snapHead, pressed && { opacity: 0.8 }]}
      >
        <Image
          source={imageSource(p.coverUrl, token)}
          style={styles.snapCover}
          contentFit="cover"
          transition={200}
          accessibilityIgnoresInvertColors
        />
        <View style={{ flex: 1, minWidth: 0 }}>
          <Text style={styles.snapName} numberOfLines={2}>
            {p.name}
          </Text>
          <Text style={styles.snapAddr} numberOfLines={1}>
            {p.address}
          </Text>
          <View style={styles.snapPills}>
            <Pill text={titleCase(s.severity)} tone={severityTone(s.severity)} />
            {profile.shared ? <Pill text="Shared" tone="white" /> : null}
          </View>
        </View>
        {/* the whole row is the button: a static arrow, not a nested button */}
        <View style={styles.snapArrow} importantForAccessibility="no-hide-descendants" accessibilityElementsHidden>
          <Feather name="arrow-up-right" size={18} color={theme.colors.ink} />
        </View>
      </Pressable>

      <View style={styles.stats}>
        <Stat
          value={String(behind)}
          label={behind === 1 ? "day behind" : "days behind"}
          tone={behind > 21 ? "danger" : behind > 7 ? "warn" : "ink"}
        />
        <Stat value={pct(s.earnedPct)} label={`earned, plan ${pct(s.plannedPct)}`} />
        <Stat value={String(s.openFindings)} label={s.openFindings === 1 ? "open finding" : "open findings"} />
      </View>

      <View
        accessible
        accessibilityRole="progressbar"
        accessibilityLabel={`Earned ${pct(s.earnedPct, 1)} of planned ${pct(s.plannedPct, 1)}`}
        accessibilityValue={{ min: 0, max: 100, now: Math.round(s.earnedPct) }}
      >
        <View style={styles.bar}>
          <View style={[styles.barPlanned, { width: `${Math.min(100, s.plannedPct)}%` }]} />
          <View style={[styles.barEarned, { width: `${Math.min(100, s.earnedPct)}%` }]} />
        </View>
        <View style={styles.barLegend}>
          <Text style={styles.muted}>Earned {pct(s.earnedPct, 1)}</Text>
          <Text style={styles.muted}>Planned {pct(s.plannedPct, 1)}</Text>
        </View>
      </View>

      <View style={styles.snapFoot}>
        <Feather name="navigation" size={13} color={theme.colors.muted} />
        <Text style={styles.muted}>
          Last flight {relative(s.lastFlightAt)} · {p.floorsTotal} storeys
        </Text>
      </View>
    </GlassCard>
  );
}

function Stat({ value, label, tone = "ink" }: { value: string; label: string; tone?: "ink" | "warn" | "danger" }) {
  const color = tone === "danger" ? theme.colors.danger : tone === "warn" ? theme.colors.warn : theme.colors.ink;
  return (
    <View style={styles.stat} accessible accessibilityLabel={`${value} ${label}`}>
      <Text style={[styles.statValue, { color }]} numberOfLines={1} adjustsFontSizeToFit minimumFontScale={0.7}>
        {value}
      </Text>
      <Text style={styles.statLabel} numberOfLines={2}>
        {label}
      </Text>
    </View>
  );
}

/* ------------------------------------------------------------------ lag alerts */

/** ORDI "AI Smart Schedule" white card: the floors/phases furthest behind, on grey inner slots. */
function LagAlerts({
  findings,
  onOpen,
  onFinding,
  canOpenShot,
  limit = 3,
}: {
  findings: Finding[];
  onOpen: () => void;
  onFinding: (f: Finding) => void;
  canOpenShot: (f: Finding) => boolean;
  limit?: number;
}) {
  const sorted = [...findings].sort((a, b) => b.daysBehind - a.daysBehind).slice(0, limit);
  return (
    <WhiteCard style={{ gap: theme.spacing.md }}>
      <CardHeader
        title="Lag alerts"
        subtitle={
          findings.length
            ? `${findings.length} floor/phase ${findings.length === 1 ? "item" : "items"} behind plan`
            : "Nothing behind plan"
        }
        onArrow={onOpen}
        arrowLabel="Open reports"
        tone="onWhite"
      />
      {sorted.length === 0 ? (
        <EmptyState
          icon="check-circle"
          title="On schedule"
          body="The latest flight found no floor or phase behind its planned progress."
          style={{ paddingVertical: theme.spacing.lg }}
        />
      ) : (
        <View style={styles.alerts}>
          <View style={styles.alertLine} />
          <View style={{ flex: 1, gap: theme.spacing.sm }}>
            {sorted.map((f) => {
              const color = f.daysBehind > 21 ? theme.colors.danger : f.daysBehind > 7 ? theme.colors.warn : theme.colors.accent2;
              const tappable = canOpenShot(f);
              return (
                <Pressable
                  key={f.id}
                  onPress={tappable ? () => onFinding(f) : undefined}
                  disabled={!tappable}
                  accessibilityRole={tappable ? "button" : undefined}
                  accessibilityLabel={`Floor ${f.floor} ${f.phase}: ${f.daysBehind} days behind. Planned ${Math.round(
                    f.plannedPct,
                  )} percent, observed ${Math.round(f.observedPct)} percent`}
                  accessibilityHint={tappable ? "Opens the drone shot that shows it" : undefined}
                  style={({ pressed }) => [styles.alert, pressed && { opacity: 0.75 }]}
                >
                  <View style={styles.alertHead}>
                    <StatusDot color={color} size={8} />
                    <Text style={styles.alertTitle} numberOfLines={1}>
                      Floor {f.floor} · {titleCase(f.phase)}
                    </Text>
                    <Text style={[styles.alertDays, { color }]}>{f.daysBehind} d</Text>
                  </View>
                  <View style={styles.alertTrack}>
                    <View style={[styles.alertPlanned, { width: `${Math.min(100, f.plannedPct)}%` }]} />
                    <View style={[styles.alertObserved, { width: `${Math.min(100, f.observedPct)}%`, backgroundColor: color }]} />
                  </View>
                  <View style={styles.alertFoot}>
                    <Text style={styles.muted}>
                      Observed {pct(f.observedPct)} of {pct(f.plannedPct)} planned
                    </Text>
                    {tappable ? <Feather name="camera" size={14} color={theme.colors.muted} /> : null}
                  </View>
                </Pressable>
              );
            })}
          </View>
        </View>
      )}
    </WhiteCard>
  );
}

/* ------------------------------------------------------------------ section head */

function SectionHead({ title, action, onPress }: { title: string; action: string; onPress: () => void }) {
  return (
    <View style={styles.sectionHead}>
      <Text style={styles.sectionTitle} accessibilityRole="header">
        {title}
      </Text>
      <SquareButton icon="arrow-up-right" label={action} onPress={onPress} variant="white" />
    </View>
  );
}

const styles = StyleSheet.create({
  greeting: { paddingHorizontal: theme.spacing.xs, marginTop: theme.spacing.xs, gap: theme.spacing.sm },
  hello: {
    fontFamily: theme.fonts.displayBold,
    fontSize: theme.type.h1,
    lineHeight: theme.type.h1 * 1.12,
    color: theme.colors.ink,
    letterSpacing: -0.6,
  },
  roleRow: { flexDirection: "row", alignItems: "center", gap: theme.spacing.sm },
  org: { flex: 1, fontFamily: theme.fonts.body, fontSize: theme.type.small, color: theme.colors.muted },
  notice: { fontFamily: theme.fonts.bodyMedium, fontSize: theme.type.small + 1, color: theme.colors.danger },

  delivered: { flexDirection: "row", alignItems: "center", gap: theme.spacing.sm, paddingVertical: theme.spacing.md },
  deliveredMain: { flex: 1, flexDirection: "row", alignItems: "center", gap: theme.spacing.md, minHeight: theme.tap },
  deliveredIcon: {
    width: theme.tap,
    height: theme.tap,
    borderRadius: theme.radius.btn,
    backgroundColor: theme.colors.okSoft,
    alignItems: "center",
    justifyContent: "center",
  },
  deliveredTitle: { fontFamily: theme.fonts.displaySemi, fontSize: theme.type.h3, color: theme.colors.ink },
  deliveredSub: { fontFamily: theme.fonts.body, fontSize: theme.type.small, color: theme.colors.muted, marginTop: 1 },

  promo: {
    backgroundColor: theme.colors.onAccentCard,
    borderRadius: theme.radius.inner,
    borderWidth: 1,
    borderColor: theme.colors.onAccentBorder,
    padding: theme.spacing.md,
    gap: theme.spacing.xs,
  },
  promoTitle: { fontFamily: theme.fonts.displaySemi, fontSize: theme.type.h3, color: theme.colors.onAccent },
  promoBody: {
    fontFamily: theme.fonts.body,
    fontSize: theme.type.small + 1,
    lineHeight: (theme.type.small + 1) * 1.42,
    color: theme.colors.onAccentMuted,
  },
  promoFoot: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    flexWrap: "wrap",
    gap: theme.spacing.sm,
    marginTop: theme.spacing.sm,
  },
  promoPills: { flexDirection: "row", gap: theme.spacing.xs },
  promoPrice: { fontFamily: theme.fonts.bodySemi, fontSize: theme.type.small + 1, color: theme.colors.onAccent },
  fine: {
    fontFamily: theme.fonts.body,
    fontSize: theme.type.micro + 1,
    lineHeight: (theme.type.micro + 1) * 1.4,
    color: theme.colors.onAccentMuted,
    textAlign: "center",
  },

  snapHead: { flexDirection: "row", alignItems: "flex-start", gap: theme.spacing.md },
  snapArrow: {
    width: theme.tap,
    height: theme.tap,
    borderRadius: theme.radius.btn,
    backgroundColor: theme.colors.surface,
    alignItems: "center",
    justifyContent: "center",
  },
  snapCover: {
    width: 72,
    height: 72,
    borderRadius: theme.radius.inner,
    backgroundColor: theme.colors.inner,
  },
  snapName: {
    fontFamily: theme.fonts.displaySemi,
    fontSize: theme.type.h3 + 1,
    lineHeight: (theme.type.h3 + 1) * 1.15,
    color: theme.colors.ink,
    letterSpacing: -0.3,
  },
  snapAddr: { fontFamily: theme.fonts.body, fontSize: theme.type.small, color: theme.colors.muted, marginTop: 2 },
  snapPills: { flexDirection: "row", gap: theme.spacing.xs, marginTop: theme.spacing.sm },
  stats: { flexDirection: "row", gap: theme.spacing.sm },
  stat: {
    flex: 1,
    backgroundColor: theme.colors.surface,
    borderRadius: theme.radius.inner,
    paddingVertical: theme.spacing.sm + 2,
    paddingHorizontal: theme.spacing.md,
    minHeight: 68,
  },
  statValue: { fontFamily: theme.fonts.displaySemi, fontSize: theme.type.h2, letterSpacing: -0.4 },
  statLabel: {
    fontFamily: theme.fonts.body,
    fontSize: theme.type.micro + 1,
    lineHeight: (theme.type.micro + 1) * 1.3,
    color: theme.colors.muted,
    marginTop: 2,
  },
  bar: {
    height: 10,
    borderRadius: 5,
    backgroundColor: theme.colors.surface,
    overflow: "hidden",
  },
  barPlanned: {
    position: "absolute",
    left: 0,
    top: 0,
    bottom: 0,
    backgroundColor: theme.colors.accent2,
    opacity: 0.3,
    borderRadius: 5,
  },
  barEarned: { position: "absolute", left: 0, top: 0, bottom: 0, backgroundColor: theme.colors.accent, borderRadius: 5 },
  barLegend: { flexDirection: "row", justifyContent: "space-between", marginTop: theme.spacing.xs + 2 },
  snapFoot: { flexDirection: "row", alignItems: "center", gap: theme.spacing.xs + 2 },
  muted: { fontFamily: theme.fonts.body, fontSize: theme.type.small, color: theme.colors.muted },

  alerts: { flexDirection: "row", gap: theme.spacing.md },
  alertLine: { width: 3, borderRadius: 2, backgroundColor: theme.colors.accent },
  alert: {
    backgroundColor: theme.colors.inner,
    borderRadius: theme.radius.inner - 4,
    padding: theme.spacing.md,
    gap: theme.spacing.sm,
    minHeight: theme.tap,
  },
  alertHead: { flexDirection: "row", alignItems: "center", gap: theme.spacing.sm },
  alertTitle: { flex: 1, fontFamily: theme.fonts.bodySemi, fontSize: theme.type.label, color: theme.colors.ink },
  alertDays: { fontFamily: theme.fonts.displaySemi, fontSize: theme.type.label },
  alertTrack: { height: 6, borderRadius: 3, backgroundColor: theme.colors.track, overflow: "hidden" },
  alertPlanned: {
    position: "absolute",
    left: 0,
    top: 0,
    bottom: 0,
    backgroundColor: theme.colors.accent2,
    opacity: 0.35,
    borderRadius: 3,
  },
  alertObserved: { position: "absolute", left: 0, top: 0, bottom: 0, borderRadius: 3 },
  alertFoot: { flexDirection: "row", alignItems: "center", justifyContent: "space-between" },

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
  liveMsg: {
    fontFamily: theme.fonts.bodyMedium,
    fontSize: theme.type.small,
    color: theme.colors.ink,
    marginTop: theme.spacing.md,
  },
});
