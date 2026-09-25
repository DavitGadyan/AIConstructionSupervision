import { useCallback, useEffect, useState } from "react";
import { Platform, StyleSheet, Text, View } from "react-native";
import { useLocalSearchParams, useRouter } from "expo-router";
import * as Haptics from "expo-haptics";
import { Feather } from "@expo/vector-icons";
import { api, errorMessage, ETA_HOURS, REPORT_HOURS, type Order } from "@/lib/api";
import { hoursLabel } from "@/lib/format";
import { animateLayout, useAsync, useNow } from "@/lib/hooks";
import { useLive } from "@/lib/live";
import { useRoles } from "@/lib/roles";
import { useAuthed } from "@/lib/session";
import { theme } from "@/lib/theme";
import { Screen } from "@/components/Screen";
import { OrderCard, OrderRow } from "@/components/OrderCard";
import { ReportsList } from "@/components/ReportsList";
import {
  AccentCard,
  Button,
  CardHeader,
  EmptyState,
  ErrorState,
  GlassCard,
  LoadingState,
  Pill,
  SectionLabel,
  Segmented,
} from "@/components/ui";

type Tab = "orders" | "reports";

/**
 * Activity: the project's inspection orders (running one pinned on top with
 * its countdown ring, then history) and its report PDFs. `?tab=reports`
 * opens the Reports segment (links from Home / notifications).
 */
export default function Activity() {
  const { token, projectId, project } = useAuthed();
  const router = useRouter();
  const live = useLive();
  const roles = useRoles();
  const params = useLocalSearchParams<{ tab?: string }>();
  const [tab, setTab] = useState<Tab>(params.tab === "reports" ? "reports" : "orders");
  useEffect(() => {
    if (params.tab === "reports" || params.tab === "orders") setTab(params.tab);
  }, [params.tab]);

  /* ---------------- reports */

  const reports = useAsync(async () => {
    const list = await api.reports(token, projectId);
    return [...list].sort((a, b) => (a.createdAt < b.createdAt ? 1 : -1));
  }, [token, projectId], !!projectId);

  // a delivered order (or finished flight) brings a new report
  useEffect(() => {
    if (live.version > 0) reports.refresh();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [live.version]);

  const [generating, setGenerating] = useState(false);
  const [reportError, setReportError] = useState<string | null>(null);
  const generate = async () => {
    setGenerating(true);
    setReportError(null);
    try {
      await api.generateReport(token, projectId);
      if (Platform.OS !== "web") Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success).catch(() => {});
      animateLayout();
      await reports.refresh();
    } catch (e) {
      setReportError(errorMessage(e, "Couldn't generate the report."));
    } finally {
      setGenerating(false);
    }
  };

  /* ---------------- orders */

  const orders = live.orders;
  const active = live.activeOrder;
  const history = (orders ?? []).filter((o) => o.id !== active?.id);
  const now = useNow(1000, tab === "orders" && !!active);
  const [ordersRefreshing, setOrdersRefreshing] = useState(false);
  const refreshOrders = useCallback(async () => {
    setOrdersRefreshing(true);
    try {
      await live.refreshOrders();
    } finally {
      setOrdersRefreshing(false);
    }
  }, [live]);

  const openOrder = (o: Order) => router.push({ pathname: "/order/[id]", params: { id: o.id } });
  const orderNew = () => router.push("/new-order");

  const onRefresh = tab === "orders" ? refreshOrders : reports.refresh;
  const refreshing = tab === "orders" ? ordersRefreshing : reports.refreshing;

  return (
    <Screen refreshing={refreshing} onRefresh={onRefresh}>
      <View style={styles.head}>
        <Text style={styles.title} accessibilityRole="header">
          Activity
        </Text>
        <Text style={styles.sub} numberOfLines={1}>
          Inspections and reports for {project?.name ?? "this project"}
        </Text>
      </View>

      <Segmented<Tab>
        label="Show"
        value={tab}
        onChange={(v) => {
          if (Platform.OS !== "web") Haptics.selectionAsync().catch(() => {});
          setTab(v);
        }}
        options={[
          { value: "orders", label: "Orders", count: orders?.length, a11y: `Orders${orders ? `, ${orders.length}` : ""}${active ? ", one running" : ""}` },
          { value: "reports", label: "Reports", count: reports.data?.length },
        ]}
      />

      {tab === "orders" ? (
        <OrdersPane
          orders={orders}
          active={active}
          history={history}
          now={now}
          loading={live.ordersLoading && !orders}
          error={!orders ? live.ordersError : null}
          onRetry={refreshOrders}
          onOpen={openOrder}
          canOrder={roles.canOrder}
          orderLabel={roles.isInspector ? "Order a revision" : "Order an inspection"}
          blocked={roles.orderBlocked}
          onOrder={orderNew}
        />
      ) : (
        <View style={{ gap: theme.spacing.md }}>
          {roles.canGenerateReport ? (
            <AccentCard style={{ gap: theme.spacing.md }}>
              <CardHeader title="New delay report" subtitle="From the latest assessed flight" tone="onAccent" />
              <Text style={styles.onAccentBody}>
                A signed PDF with the variance, lagging floors and the drone shots that prove them.
              </Text>
              <Button
                title={generating ? "Generating…" : "Generate report"}
                icon="file-plus"
                variant="white"
                onPress={generate}
                loading={generating}
              />
            </AccentCard>
          ) : null}
          {reportError ? (
            <Text style={styles.error} accessibilityRole="alert">
              {reportError}
            </Text>
          ) : null}
          {reports.loading ? (
            <GlassCard>
              <LoadingState label="Loading reports…" />
            </GlassCard>
          ) : reports.error ? (
            <GlassCard>
              <ErrorState message={reports.error} onRetry={reports.reload} />
            </GlassCard>
          ) : (
            <ReportsList
              reports={reports.data ?? []}
              token={token}
              emptyTitle="No reports yet"
              emptyBody={
                roles.canOrder
                  ? `Order an inspection and the independent PDF lands here within ${REPORT_HOURS} h of the flight.`
                  : "Reports appear here as soon as an inspection is delivered."
              }
            />
          )}
        </View>
      )}
    </Screen>
  );
}

function OrdersPane({
  orders,
  active,
  history,
  now,
  loading,
  error,
  onRetry,
  onOpen,
  canOrder,
  orderLabel,
  blocked,
  onOrder,
}: {
  orders: Order[] | undefined;
  active: Order | null;
  history: Order[];
  now: number;
  loading: boolean;
  error: string | null;
  onRetry: () => void;
  onOpen: (o: Order) => void;
  canOrder: boolean;
  orderLabel: string;
  blocked: { title: string; body: string } | null;
  onOrder: () => void;
}) {
  if (loading) {
    return (
      <GlassCard>
        <LoadingState label="Loading inspections…" />
      </GlassCard>
    );
  }
  if (error) {
    return (
      <GlassCard>
        <ErrorState message={error} onRetry={onRetry} />
      </GlassCard>
    );
  }

  const cta =
    !active && canOrder ? (
      <AccentCard style={{ gap: theme.spacing.md }}>
        <CardHeader title={orderLabel} subtitle="Independent drone inspection on demand" tone="onAccent" />
        <View style={styles.promise}>
          <View style={styles.promiseItem} accessible accessibilityLabel={`Car and drone on site in ${hoursLabel(ETA_HOURS)}`}>
            <Feather name="truck" size={16} color={theme.colors.onAccent} />
            <Text style={styles.promiseValue}>{hoursLabel(ETA_HOURS)}</Text>
            <Text style={styles.promiseLabel}>Car + drone on site</Text>
          </View>
          <View style={styles.promiseItem} accessible accessibilityLabel={`PDF report within ${REPORT_HOURS} hours of the flight`}>
            <Feather name="file-text" size={16} color={theme.colors.onAccent} />
            <Text style={styles.promiseValue}>{hoursLabel(REPORT_HOURS)}</Text>
            <Text style={styles.promiseLabel}>Independent PDF report</Text>
          </View>
        </View>
        <Button title="Order now" icon="plus" variant="white" onPress={onOrder} label={orderLabel} />
      </AccentCard>
    ) : null;

  if (!orders?.length) {
    return (
      <View style={{ gap: theme.spacing.md }}>
        {cta}
        <GlassCard>
          <EmptyState
            icon="truck"
            title="No inspections yet"
            body={
              canOrder
                ? "Order one and follow the crew here, from dispatch to the PDF report."
                : (blocked?.body ?? "Inspections ordered on this project show up here.")
            }
          />
        </GlassCard>
      </View>
    );
  }

  return (
    <View style={{ gap: theme.spacing.md }}>
      {active ? (
        <View style={{ gap: theme.spacing.sm }}>
          <View style={styles.sectionRow}>
            <SectionLabel style={styles.label}>In progress</SectionLabel>
            <Pill text="Live" tone="accent" />
          </View>
          <OrderCard order={active} now={now} onPress={() => onOpen(active)} />
        </View>
      ) : (
        cta
      )}
      {!active && !canOrder && blocked ? (
        <View style={styles.info}>
          <Feather name="info" size={16} color={theme.colors.muted} />
          <Text style={styles.infoText}>{blocked.title}. You can still follow every inspection and open its report.</Text>
        </View>
      ) : null}
      {history.length ? (
        <View style={{ gap: theme.spacing.sm }}>
          <SectionLabel style={styles.label}>History</SectionLabel>
          {history.map((o) => (
            <OrderRow key={o.id} order={o} now={now} onPress={() => onOpen(o)} />
          ))}
        </View>
      ) : null}
    </View>
  );
}

const styles = StyleSheet.create({
  head: { marginVertical: theme.spacing.sm },
  title: { fontFamily: theme.fonts.displayBold, fontSize: theme.type.h1, color: theme.colors.ink },
  sub: { fontFamily: theme.fonts.body, fontSize: theme.type.small, color: theme.colors.muted, marginTop: 2 },
  label: { marginLeft: theme.spacing.xs },
  sectionRow: { flexDirection: "row", alignItems: "center", justifyContent: "space-between" },
  onAccentBody: {
    fontFamily: theme.fonts.body,
    fontSize: theme.type.small + 1,
    lineHeight: (theme.type.small + 1) * 1.45,
    color: theme.colors.onAccentMuted,
  },
  error: { fontFamily: theme.fonts.bodyMedium, fontSize: theme.type.label, color: theme.colors.danger },
  promise: { flexDirection: "row", gap: theme.spacing.sm },
  promiseItem: {
    flex: 1,
    gap: theme.spacing.xs,
    backgroundColor: theme.colors.onAccentCard,
    borderRadius: theme.radius.inner,
    borderWidth: 1,
    borderColor: theme.colors.onAccentBorder,
    padding: theme.spacing.md,
  },
  promiseValue: { fontFamily: theme.fonts.displaySemi, fontSize: theme.type.h2, color: theme.colors.onAccent },
  promiseLabel: { fontFamily: theme.fonts.body, fontSize: theme.type.small, color: theme.colors.onAccentMuted },
  info: {
    flexDirection: "row",
    alignItems: "flex-start",
    gap: theme.spacing.sm,
    backgroundColor: theme.colors.glass,
    borderRadius: theme.radius.inner,
    borderWidth: 1,
    borderColor: theme.colors.glassBorder,
    padding: theme.spacing.md,
  },
  infoText: {
    flex: 1,
    fontFamily: theme.fonts.body,
    fontSize: theme.type.small + 1,
    lineHeight: (theme.type.small + 1) * 1.4,
    color: theme.colors.muted,
  },
});
