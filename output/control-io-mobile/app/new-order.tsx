import { useCallback, useEffect, useMemo, useRef, useState, type ReactNode } from "react";
import {
  Animated,
  BackHandler,
  Easing,
  KeyboardAvoidingView,
  Platform,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  View,
} from "react-native";
import { Redirect, useLocalSearchParams, useRouter } from "expo-router";
import { SafeAreaView, useSafeAreaInsets } from "react-native-safe-area-context";
import * as Haptics from "expo-haptics";
import { Feather, MaterialCommunityIcons } from "@expo/vector-icons";
import {
  api,
  errorMessage,
  ETA_HOURS,
  isApiError,
  MIN_SCHEDULE_LEAD_HOURS,
  ORDER_KINDS,
  ORDER_PRIORITIES,
  REPORT_HOURS,
  type CreateOrderInput,
  type Order,
  type OrderKind,
  type OrderPriority,
  type Quote,
} from "@/lib/api";
import { amd, amdSpoken, clockRange, clockRangeSpoken, dayLabel, hoursLabel, time } from "@/lib/format";
import { announce, useAsync, useNow, useReduceMotion } from "@/lib/hooks";
import { useLive } from "@/lib/live";
import { requestNotificationPermission } from "@/lib/notify";
import {
  asapWindow,
  earliestSchedule,
  focusFromFindings,
  KIND_BLURBS,
  KIND_LABELS,
  kindLabel,
  scheduleDays,
  scheduleSlots,
  statusHeadline,
} from "@/lib/orders";
import { useRoles } from "@/lib/roles";
import { useSession } from "@/lib/session";
import { theme } from "@/lib/theme";
import {
  AccentCard,
  BackHeader,
  Button,
  ChoiceCard,
  EmptyState,
  GlassCard,
  Ground,
  KeyValueRow,
  LoadingState,
  ProgressSegments,
  SectionLabel,
  SquareButton,
  TextField,
  type FeatherName,
} from "@/components/ui";

/* ------------------------------------------------------------------ constants */

const HOUR = 3_600_000;
/** Mirrors the server (lib/server/orders.ts PHONE_RE + >= 6 digits). */
const PHONE_RE = /^[0-9+\-() ]{6,20}$/;
const MAX_FOCUS = 20;
const MAX_FOCUS_LEN = 120;
const MAX_NAME = 120;
const MAX_NOTES = 1000;

const STEPS = [
  {
    eyebrow: "What",
    title: "What should we inspect?",
    sub: "Pick the kind of flight. Every order ends in an independent PDF report.",
  },
  {
    eyebrow: "When",
    title: "When should the crew come?",
    sub: "As soon as possible, or a daylight slot that suits the site.",
  },
  {
    eyebrow: "Contact",
    title: "Who meets the crew?",
    sub: "The crew calls this person if they can't find the site or the slot has to move.",
  },
  {
    eyebrow: "Review",
    title: "Check and place the order",
    sub: "Nothing is charged in the app. We send an invoice.",
  },
] as const;
const STEP_COUNT = STEPS.length;
const SUCCESS = STEP_COUNT;

/** Error keys (server issue paths) owned by each step, for jumping back on a 400. */
const STEP_KEYS: readonly (readonly string[])[] = [
  ["kind", "focus"],
  ["priority", "scheduledFor"],
  ["contactName", "contactPhone", "accessNotes"],
];

type Errors = Record<string, string>;
type QuoteKey = `${OrderKind}:${OrderPriority}`;
type QuoteMap = Partial<Record<QuoteKey, Quote>>;

type SubmitError =
  | { type: "conflict"; message: string; orderId: string }
  | { type: "area" | "forbidden" | "invalid" | "generic"; message: string };

const KIND_ICONS: Record<OrderKind, FeatherName> = {
  full: "layers",
  revision: "rotate-ccw",
  targeted: "crosshair",
};

function haptic(kind: "select" | "impact" | "success" | "warning" | "error") {
  if (Platform.OS === "web") return;
  const p =
    kind === "select"
      ? Haptics.selectionAsync()
      : kind === "impact"
        ? Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium)
        : Haptics.notificationAsync(
            kind === "success"
              ? Haptics.NotificationFeedbackType.Success
              : kind === "warning"
                ? Haptics.NotificationFeedbackType.Warning
                : Haptics.NotificationFeedbackType.Error,
          );
  p.catch(() => {});
}

function isKind(v: unknown): v is OrderKind {
  return typeof v === "string" && (ORDER_KINDS as readonly string[]).includes(v);
}

function digits(v: string) {
  return v.match(/\d/g)?.length ?? 0;
}

/** Same rules as CreateOrderSchema on the server. */
function validateContact(name: string, phone: string, notes: string): Errors {
  const e: Errors = {};
  const n = name.trim();
  const p = phone.trim();
  if (!n) e.contactName = "Enter the name of the person meeting the crew.";
  else if (n.length > MAX_NAME) e.contactName = `Keep it under ${MAX_NAME} characters.`;
  if (!p) e.contactPhone = "Enter a phone number the crew can call.";
  else if (!PHONE_RE.test(p)) e.contactPhone = "Use digits, spaces and + - ( ), 6-20 characters.";
  else if (digits(p) < 6) e.contactPhone = "A phone number needs at least 6 digits.";
  if (notes.trim().length > MAX_NOTES) e.accessNotes = `Keep notes under ${MAX_NOTES} characters.`;
  return e;
}

/**
 * Prices for every kind x priority, in two small waves (the "from" prices for
 * step 1 first, then the ASAP ones) so they don't crowd out the page's own
 * requests on a slow connection.
 */
function useQuotes(token: string) {
  const [map, setMap] = useState<QuoteMap>({});
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [attempt, setAttempt] = useState(0);
  useEffect(() => {
    let alive = true;
    setLoading(true);
    setError(null);
    (async () => {
      let firstError: unknown = null;
      let got = 0;
      for (const priority of ["scheduled", "asap"] as const) {
        const settled = await Promise.allSettled(ORDER_KINDS.map((k) => api.quote(token, k, priority)));
        if (!alive) return;
        const wave: QuoteMap = {};
        settled.forEach((r, i) => {
          if (r.status === "fulfilled") {
            wave[`${ORDER_KINDS[i]!}:${priority}`] = r.value;
            got++;
          } else firstError ??= r.reason;
        });
        setMap((m) => ({ ...m, ...wave }));
      }
      if (!alive) return;
      if (firstError && got < ORDER_KINDS.length * ORDER_PRIORITIES.length) {
        setError(errorMessage(firstError, "Price unavailable right now."));
      }
      setLoading(false);
    })();
    return () => {
      alive = false;
    };
  }, [token, attempt]);
  const reload = useCallback(() => setAttempt((a) => a + 1), []);
  return { map, loading, error, reload };
}

/* ------------------------------------------------------------------ screen */

export default function NewOrderScreen() {
  const { ready, token, projectId } = useSession();
  if (!ready) return null;
  if (!token) return <Redirect href="/login" />;
  if (!projectId) return <Redirect href="/projects" />;
  return <Wizard token={token} projectId={projectId} />;
}

function Wizard({ token, projectId }: { token: string; projectId: string }) {
  const router = useRouter();
  const params = useLocalSearchParams<{ kind?: string }>();
  const session = useSession();
  const live = useLive();
  const roles = useRoles();
  const reduce = useReduceMotion();
  const now = useNow(30_000);

  const close = useCallback(() => (router.canGoBack() ? router.back() : router.replace("/")), [router]);

  /* ---------------- data */

  const dash = useAsync(() => api.project(token, projectId), [token, projectId]);
  const quotes = useQuotes(token);

  const findingsList = dash.data?.findings;
  const suggestions = useMemo(() => focusFromFindings(findingsList ?? [], 8), [findingsList]);
  const revisionFocus = useMemo(() => focusFromFindings(findingsList ?? [], MAX_FOCUS), [findingsList]);
  const openFindings =
    live.profile?.project.id === projectId ? live.profile.status.openFindings : findingsList ? findingsList.length : undefined;

  const projectName = live.profile?.project.name ?? session.project?.name ?? "this project";
  const projectAddress = live.profile?.project.address ?? session.project?.address ?? "";

  /* ---------------- form state */

  const [step, setStep] = useState(0);
  const [kind, setKind] = useState<OrderKind>(isKind(params.kind) ? params.kind : roles.defaultKind);
  const kindTouched = useRef(isKind(params.kind));
  // the org role can arrive after mount (older stored sessions): follow it until the user picks
  useEffect(() => {
    if (!kindTouched.current) setKind(roles.defaultKind);
  }, [roles.defaultKind]);

  const [focus, setFocus] = useState<string[]>([]);
  const [customFocus, setCustomFocus] = useState("");
  const [priority, setPriority] = useState<OrderPriority>("asap");
  const [dayKey, setDayKey] = useState<number | null>(null);
  const [slot, setSlot] = useState<string | null>(null);

  const [contactName, setContactName] = useState(session.user?.name ?? "");
  const [contactPhone, setContactPhone] = useState(session.company?.phone ?? "");
  const [accessNotes, setAccessNotes] = useState("");
  const contactTouched = useRef({ name: false, phone: false });
  // prefill once the session / company answer (never over what the user typed)
  useEffect(() => {
    if (!contactTouched.current.name && session.user?.name) setContactName((v) => v || session.user!.name);
  }, [session.user]);
  useEffect(() => {
    if (!contactTouched.current.phone && session.company?.phone) setContactPhone((v) => v || session.company!.phone!);
  }, [session.company]);

  const [errors, setErrors] = useState<Errors>({});
  const [submitting, setSubmitting] = useState(false);
  const [submitError, setSubmitError] = useState<SubmitError | null>(null);
  const [created, setCreated] = useState<Order | null>(null);

  const clearError = (key: string) =>
    setErrors((e) => {
      if (!(key in e)) return e;
      const { [key]: _drop, ...rest } = e;
      return rest;
    });

  /* ---------------- derived */

  const days = useMemo(() => scheduleDays(now, 7), [now]);
  const firstOpenDay = days.find((d) => d.available)?.dayKey ?? null;
  const activeDay = dayKey ?? firstOpenDay;
  const slots = useMemo(() => (activeDay === null ? [] : scheduleSlots(activeDay, now)), [activeDay, now]);
  const asap = asapWindow(now);
  const quoteMap = quotes.map;
  const quote = quoteMap[`${kind}:${priority}`];
  const orderFocus =
    kind === "targeted" ? focus : kind === "revision" && revisionFocus.length ? revisionFocus : undefined;

  /* ---------------- step motion + announcements */

  const scrollRef = useRef<ScrollView>(null);
  const anim = useRef(new Animated.Value(1)).current;
  const dir = useRef(1);
  const firstStep = useRef(true);
  useEffect(() => {
    scrollRef.current?.scrollTo({ y: 0, animated: false });
    if (reduce) anim.setValue(1);
    else {
      anim.setValue(0);
      Animated.timing(anim, {
        toValue: 1,
        duration: theme.motion.base,
        easing: Easing.out(Easing.cubic),
        useNativeDriver: Platform.OS !== "web",
      }).start();
    }
    if (firstStep.current) {
      firstStep.current = false;
      return;
    }
    // Android and web read the live region on the step label; iOS needs an explicit announcement
    if (Platform.OS === "ios") {
      announce(step === SUCCESS ? "Order placed" : `Step ${step + 1} of ${STEP_COUNT}. ${STEPS[step]!.title}`);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [step]);

  const go = (to: number) => {
    dir.current = to >= step ? 1 : -1;
    setSubmitError(null);
    setStep(to);
  };

  const back = () => {
    if (submitting) return;
    if (step === 0 || step === SUCCESS) close();
    else go(step - 1);
  };

  // Android hardware back steps back through the wizard instead of closing it
  const backRef = useRef(back);
  backRef.current = back;
  useEffect(() => {
    const sub = BackHandler.addEventListener("hardwareBackPress", () => {
      if (step === 0 || step === SUCCESS) return false;
      backRef.current();
      return true;
    });
    return () => sub.remove();
  }, [step]);

  /* ---------------- validation + submit */

  const validate = (s: number): Errors => {
    if (s === 0) {
      if (kind === "targeted" && focus.length === 0) return { focus: "Pick at least one floor or issue, or add your own." };
      if (focus.length > MAX_FOCUS) return { focus: `Pick at most ${MAX_FOCUS} items.` };
    }
    if (s === 1 && priority === "scheduled") {
      if (!slot) return { scheduledFor: "Pick a day and a time slot." };
      if (Date.parse(slot) < earliestSchedule(Date.now())) {
        return { scheduledFor: `That slot is now less than ${MIN_SCHEDULE_LEAD_HOURS} h away. Pick a later one.` };
      }
    }
    if (s === 2) return validateContact(contactName, contactPhone, accessNotes);
    return {};
  };

  const submit = async () => {
    // re-check every step: time moves while the review is open
    for (let s = 0; s < STEP_COUNT - 1; s++) {
      const e = validate(s);
      if (Object.keys(e).length) {
        setErrors((prev) => ({ ...prev, ...e }));
        haptic("warning");
        go(s);
        return;
      }
    }
    const input: CreateOrderInput = {
      projectId,
      kind,
      priority,
      scheduledFor: priority === "scheduled" ? slot : null,
      contactName: contactName.trim(),
      contactPhone: contactPhone.trim(),
      accessNotes: accessNotes.trim() || undefined,
      focus: orderFocus,
    };
    haptic("impact");
    setSubmitting(true);
    setSubmitError(null);
    try {
      const o = await api.createOrder(token, input);
      live.upsertOrder(o);
      setCreated(o);
      haptic("success");
      go(SUCCESS);
      // the moment that explains itself: ask once, right after the first order
      requestNotificationPermission().catch(() => {});
    } catch (e) {
      haptic("error");
      if (isApiError(e, 409) && e.activeOrderId) {
        const orderId = e.activeOrderId;
        setSubmitError({ type: "conflict", message: e.message, orderId });
        live.fetchOrder(orderId).catch(() => {});
      } else if (isApiError(e, 422)) {
        setSubmitError({ type: "area", message: e.message });
      } else if (isApiError(e, 403)) {
        setSubmitError({ type: "forbidden", message: e.message });
      } else if (isApiError(e, 400)) {
        const fe = e.fieldErrors;
        const keys = Object.keys(fe);
        const normalised: Errors = {};
        for (const k of keys) normalised[k.startsWith("focus") ? "focus" : k] = fe[k]!;
        const target = STEP_KEYS.findIndex((ks) => ks.some((k) => k in normalised));
        if (target >= 0) {
          setErrors((prev) => ({ ...prev, ...normalised }));
          go(target);
        } else {
          setSubmitError({ type: "invalid", message: e.message });
        }
      } else {
        setSubmitError({ type: "generic", message: errorMessage(e, "Couldn't place the order.") });
      }
    } finally {
      setSubmitting(false);
    }
  };

  const next = () => {
    if (submitting) return;
    if (step === STEP_COUNT - 1) {
      submit();
      return;
    }
    const e = validate(step);
    setErrors((prev) => {
      const kept: Errors = {};
      for (const [k, v] of Object.entries(prev)) if (!STEP_KEYS[step]?.includes(k)) kept[k] = v;
      return { ...kept, ...e };
    });
    const first = Object.values(e)[0];
    if (first) {
      haptic("warning");
      if (step < 2) setTimeout(() => scrollRef.current?.scrollToEnd({ animated: !reduce }), 50);
      if (Platform.OS === "ios") announce(first);
      return;
    }
    haptic("select");
    go(step + 1);
  };

  /* ---------------- gates */

  const running = !created ? live.activeOrder : null;
  // opening the form while an order runs: explain instead of a form that can only 409.
  // An order that starts mid-way (another user) shows as a banner on the current step.
  if (running && step === 0 && !submitting) {
    return (
      <Gate
        onClose={close}
        icon="truck"
        title="One inspection at a time"
        body={`${running.number} is already running on ${projectName}. Track it, or order again once it's delivered or cancelled.`}
        action={
          <Button
            title={`Track ${running.number}`}
            icon="navigation"
            onPress={() => router.replace({ pathname: "/order/[id]", params: { id: running.id } })}
          />
        }
      />
    );
  }
  if (!created && !roles.canOrder) {
    const why = roles.orderBlocked ?? {
      title: "Ordering isn't available",
      body: "Your account can track inspections on this project but not order them.",
    };
    return <Gate onClose={close} icon="lock" title={why.title} body={why.body} />;
  }

  /* ---------------- render */

  const translateX = anim.interpolate({ inputRange: [0, 1], outputRange: [dir.current * 16, 0] });
  const isSuccess = step === SUCCESS && !!created;
  const meta = STEPS[Math.min(step, STEP_COUNT - 1)]!;

  return (
    <Ground>
      <SafeAreaView style={{ flex: 1 }} edges={["top", "left", "right"]}>
        <KeyboardAvoidingView style={{ flex: 1 }} behavior={Platform.OS === "ios" ? "padding" : undefined}>
          <View style={s.top}>
            <BackHeader
              icon="x"
              backLabel={isSuccess ? "Close" : "Close order form"}
              onBack={close}
              title={isSuccess ? "Order placed" : roles.isInspector && kind === "revision" ? "Order a revision" : "Order an inspection"}
              subtitle={projectName}
            />
            {!isSuccess ? (
              <View style={{ gap: theme.spacing.sm }}>
                <ProgressSegments total={STEP_COUNT} current={step} label="Step" />
                <Text style={s.eyebrow} accessibilityLiveRegion="polite">
                  Step {step + 1} of {STEP_COUNT} · {meta.eyebrow}
                </Text>
              </View>
            ) : null}
          </View>

          <ScrollView
            ref={scrollRef}
            style={{ flex: 1 }}
            contentContainerStyle={s.content}
            keyboardShouldPersistTaps="handled"
            showsVerticalScrollIndicator={false}
          >
            <Animated.View style={{ gap: theme.spacing.md, opacity: anim, transform: reduce ? [] : [{ translateX }] }}>
              {isSuccess ? (
                <SuccessView order={created!} now={now} projectName={projectName} />
              ) : (
                <>
                  <View style={s.titleBlock}>
                    <Text style={s.title} accessibilityRole="header">
                      {meta.title}
                    </Text>
                    <Text style={s.sub}>{meta.sub}</Text>
                  </View>

                  {running && submitError?.type !== "conflict" ? (
                    <SubmitErrorCard
                      error={{
                        type: "conflict",
                        orderId: running.id,
                        message: `Someone just ordered ${running.number} on ${projectName}. Only one inspection runs per project at a time.`,
                      }}
                      conflictNumber={running.number}
                      onTrack={(id) => router.replace({ pathname: "/order/[id]", params: { id } })}
                    />
                  ) : null}

                  {step === 0 ? (
                    <StepWhat
                      kind={kind}
                      onKind={(k) => {
                        kindTouched.current = true;
                        clearError("focus");
                        setKind(k);
                      }}
                      quotes={quoteMap}
                      openFindings={openFindings}
                      suggestions={suggestions}
                      findingsLoading={dash.loading}
                      findingsError={dash.error}
                      onRetryFindings={dash.reload}
                      focus={focus}
                      onToggleFocus={(f) => {
                        clearError("focus");
                        setFocus((cur) => (cur.includes(f) ? cur.filter((x) => x !== f) : [...cur, f]));
                      }}
                      customFocus={customFocus}
                      onCustomFocus={setCustomFocus}
                      onAddCustom={() => {
                        const v = customFocus.trim().slice(0, MAX_FOCUS_LEN);
                        if (!v) return;
                        clearError("focus");
                        setFocus((cur) => (cur.includes(v) || cur.length >= MAX_FOCUS ? cur : [...cur, v]));
                        setCustomFocus("");
                      }}
                      error={errors.focus}
                    />
                  ) : step === 1 ? (
                    <StepWhen
                      now={now}
                      kind={kind}
                      priority={priority}
                      onPriority={(p) => {
                        clearError("scheduledFor");
                        setPriority(p);
                      }}
                      quotes={quoteMap}
                      asap={asap}
                      days={days}
                      dayKey={activeDay}
                      onDay={(d) => {
                        setDayKey(d);
                        setSlot(null);
                      }}
                      slots={slots}
                      slot={slot}
                      onSlot={(iso) => {
                        clearError("scheduledFor");
                        haptic("select");
                        setSlot(iso);
                      }}
                      error={errors.scheduledFor}
                    />
                  ) : step === 2 ? (
                    <StepContact
                      name={contactName}
                      phone={contactPhone}
                      notes={accessNotes}
                      onName={(v) => {
                        contactTouched.current.name = true;
                        clearError("contactName");
                        setContactName(v);
                      }}
                      onPhone={(v) => {
                        contactTouched.current.phone = true;
                        clearError("contactPhone");
                        setContactPhone(v);
                      }}
                      onNotes={(v) => {
                        clearError("accessNotes");
                        setAccessNotes(v);
                      }}
                      errors={errors}
                    />
                  ) : (
                    <StepReview
                      now={now}
                      kind={kind}
                      priority={priority}
                      slot={slot}
                      asap={asap}
                      focus={orderFocus ?? []}
                      openFindings={openFindings}
                      projectName={projectName}
                      projectAddress={projectAddress}
                      contactName={contactName.trim()}
                      contactPhone={contactPhone.trim()}
                      accessNotes={accessNotes.trim()}
                      quote={quote}
                      quotesLoading={quotes.loading}
                      quotesError={quote ? null : (quotes.error ?? (quotes.loading ? null : "Price unavailable right now."))}
                      onRetryQuote={quotes.reload}
                      invoiceTo={session.company?.name ?? session.user?.org.name ?? null}
                      onEdit={go}
                      submitError={submitError}
                      conflictNumber={submitError?.type === "conflict" ? live.ordersById[submitError.orderId]?.number : undefined}
                      onTrack={(id) => router.replace({ pathname: "/order/[id]", params: { id } })}
                    />
                  )}
                </>
              )}
            </Animated.View>
          </ScrollView>

          <BottomBar>
            {isSuccess ? (
              <>
                <Button title="Done" variant="white" onPress={close} style={s.half} label="Done, close the order form" />
                <Button
                  title="Track"
                  icon="navigation"
                  style={s.half}
                  label={`Track inspection ${created!.number}`}
                  onPress={() => router.replace({ pathname: "/order/[id]", params: { id: created!.id } })}
                />
              </>
            ) : (
              <>
                <Button
                  title={step === 0 ? "Cancel" : "Back"}
                  variant="white"
                  onPress={back}
                  disabled={submitting}
                  style={s.half}
                  label={step === 0 ? "Cancel and close the order form" : `Back to ${STEPS[step - 1]!.eyebrow}`}
                />
                <Button
                  title={step === STEP_COUNT - 1 ? "Place order" : "Next"}
                  icon={step === STEP_COUNT - 1 ? "check" : undefined}
                  onPress={next}
                  loading={submitting}
                  style={s.half}
                  label={
                    step === STEP_COUNT - 1
                      ? `Place order${quote ? `, ${amdSpoken(quote.priceAmd)}` : ""}, paid by invoice`
                      : `Next: ${STEPS[step + 1]!.eyebrow}`
                  }
                />
              </>
            )}
          </BottomBar>
        </KeyboardAvoidingView>
      </SafeAreaView>
    </Ground>
  );
}

/* ------------------------------------------------------------------ layout bits */

function BottomBar({ children }: { children: ReactNode }) {
  const insets = useSafeAreaInsets();
  return <View style={[s.bar, { paddingBottom: Math.max(insets.bottom, theme.spacing.lg) }]}>{children}</View>;
}

/** Full-screen explanation when the wizard can't be used (viewer, read-only share, running order). */
function Gate({
  onClose,
  icon,
  title,
  body,
  action,
}: {
  onClose: () => void;
  icon: FeatherName;
  title: string;
  body: string;
  action?: ReactNode;
}) {
  return (
    <Ground>
      <SafeAreaView style={{ flex: 1 }} edges={["top", "left", "right"]}>
        <View style={s.top}>
          <BackHeader icon="x" backLabel="Close" onBack={onClose} title="Order an inspection" />
        </View>
        <ScrollView contentContainerStyle={s.content}>
          <GlassCard>
            <EmptyState icon={icon} title={title} body={body} action={action} />
          </GlassCard>
        </ScrollView>
        <BottomBar>
          <Button title="Close" variant="white" onPress={onClose} style={{ flex: 1 }} />
        </BottomBar>
      </SafeAreaView>
    </Ground>
  );
}

/** Toggle chip (focus areas, schedule days and times). 44pt tall. */
function Chip({
  label,
  selected,
  onPress,
  disabled,
  role = "checkbox",
  a11y,
  hint,
}: {
  label: string;
  selected: boolean;
  onPress: () => void;
  disabled?: boolean;
  role?: "checkbox" | "radio";
  a11y?: string;
  hint?: string;
}) {
  return (
    <Pressable
      onPress={onPress}
      disabled={disabled}
      accessibilityRole={role}
      accessibilityState={{ checked: selected, disabled: !!disabled }}
      accessibilityLabel={a11y ?? label}
      accessibilityHint={hint}
      style={({ pressed }) => [
        s.chip,
        selected && s.chipOn,
        disabled && s.chipDisabled,
        pressed && !disabled && { opacity: 0.75 },
      ]}
    >
      {selected && role === "checkbox" ? <Feather name="check" size={14} color={theme.colors.onAccent} /> : null}
      <Text style={[s.chipText, selected && s.chipTextOn, disabled && s.chipTextDisabled]} numberOfLines={1}>
        {label}
      </Text>
    </Pressable>
  );
}

function FieldError({ text }: { text?: string }) {
  if (!text) return null;
  return (
    <View style={s.errorRow} accessibilityLiveRegion="polite">
      <Feather name="alert-circle" size={15} color={theme.colors.danger} />
      <Text style={s.errorText}>{text}</Text>
    </View>
  );
}

/* ------------------------------------------------------------------ step 1: what */

function StepWhat({
  kind,
  onKind,
  quotes,
  openFindings,
  suggestions,
  findingsLoading,
  findingsError,
  onRetryFindings,
  focus,
  onToggleFocus,
  customFocus,
  onCustomFocus,
  onAddCustom,
  error,
}: {
  kind: OrderKind;
  onKind: (k: OrderKind) => void;
  quotes: QuoteMap;
  openFindings: number | undefined;
  suggestions: string[];
  findingsLoading: boolean;
  findingsError: string | null;
  onRetryFindings: () => void;
  focus: string[];
  onToggleFocus: (f: string) => void;
  customFocus: string;
  onCustomFocus: (v: string) => void;
  onAddCustom: () => void;
  error?: string;
}) {
  const chips = [...suggestions, ...focus.filter((f) => !suggestions.includes(f))];
  const from = (k: OrderKind) => {
    const q = quotes[`${k}:scheduled`];
    return q ? `from ${amd(q.priceAmd)}` : undefined;
  };
  const findingsBadge =
    openFindings === undefined ? undefined : openFindings === 0 ? "No open findings" : `${openFindings} open ${openFindings === 1 ? "finding" : "findings"}`;

  return (
    <View style={{ gap: theme.spacing.sm }} accessibilityRole="radiogroup" accessibilityLabel="Kind of inspection">
      {ORDER_KINDS.map((k) => (
        <ChoiceCard
          key={k}
          title={KIND_LABELS[k]}
          body={
            k === "revision" && openFindings === 0
              ? `${KIND_BLURBS[k]} The latest assessment has none open; the crew re-checks the last flagged areas.`
              : KIND_BLURBS[k]
          }
          icon={KIND_ICONS[k]}
          meta={from(k)}
          badge={k === "revision" ? findingsBadge : undefined}
          selected={kind === k}
          onPress={() => kind !== k && onKind(k)}
        >
          {k === "targeted" ? (
            <View style={{ gap: theme.spacing.md }}>
              <SectionLabel>Floors and issues from the latest assessment</SectionLabel>
              {findingsLoading ? (
                <LoadingState label="Loading findings…" style={{ paddingVertical: theme.spacing.md }} />
              ) : findingsError ? (
                <View style={{ gap: theme.spacing.sm }}>
                  <Text style={s.note}>Couldn't load the findings. You can still add your own below.</Text>
                  <Button title="Try again" variant="ghost" icon="refresh-cw" onPress={onRetryFindings} />
                </View>
              ) : !chips.length ? (
                <Text style={s.note}>No open findings to pick from. Add the floors or issues you want checked.</Text>
              ) : null}
              {chips.length ? (
                <View style={s.chips} accessibilityRole="list" accessibilityLabel="Focus areas">
                  {chips.map((c) => (
                    <Chip key={c} label={c} selected={focus.includes(c)} onPress={() => onToggleFocus(c)} />
                  ))}
                </View>
              ) : null}
              <View style={s.addRow}>
                <TextField
                  label="Add a floor or issue"
                  optional
                  value={customFocus}
                  onChangeText={onCustomFocus}
                  placeholder="e.g. Floor 9 facade cracks"
                  maxLength={MAX_FOCUS_LEN}
                  returnKeyType="done"
                  onSubmitEditing={onAddCustom}
                  style={{ flex: 1 }}
                />
                <SquareButton
                  icon="plus"
                  variant="accent"
                  size={theme.field}
                  label={customFocus.trim() ? `Add ${customFocus.trim()}` : "Add focus area"}
                  onPress={onAddCustom}
                  disabled={!customFocus.trim() || focus.length >= MAX_FOCUS}
                />
              </View>
              <Text style={s.note} accessibilityLiveRegion="polite">
                {focus.length ? `${focus.length} selected` : "Nothing selected yet"}
              </Text>
            </View>
          ) : null}
        </ChoiceCard>
      ))}
      <FieldError text={error} />
    </View>
  );
}

/* ------------------------------------------------------------------ step 2: when */

function StepWhen({
  now,
  kind,
  priority,
  onPriority,
  quotes,
  asap,
  days,
  dayKey,
  onDay,
  slots,
  slot,
  onSlot,
  error,
}: {
  now: number;
  kind: OrderKind;
  priority: OrderPriority;
  onPriority: (p: OrderPriority) => void;
  quotes: QuoteMap;
  asap: { from: string; to: string };
  days: ReturnType<typeof scheduleDays>;
  dayKey: number | null;
  onDay: (d: number) => void;
  slots: ReturnType<typeof scheduleSlots>;
  slot: string | null;
  onSlot: (iso: string) => void;
  error?: string;
}) {
  const qa = quotes[`${kind}:asap`];
  const qs = quotes[`${kind}:scheduled`];
  const surcharge = qa && qs && qs.priceAmd > 0 && qa.priceAmd > qs.priceAmd ? Math.round((qa.priceAmd / qs.priceAmd - 1) * 100) : null;
  const arrival = `${dayLabel(asap.from, now)} ${clockRange(asap.from, asap.to, now)}`;
  const openSlots = slots.filter((x) => !x.disabled).length;

  return (
    <View style={{ gap: theme.spacing.sm }}>
      <View style={{ gap: theme.spacing.sm }} accessibilityRole="radiogroup" accessibilityLabel="When">
        <ChoiceCard
          title="As soon as possible"
          icon="zap"
          body={`Car + drone on site ${hoursLabel(ETA_HOURS)} after we confirm.`}
          meta={qa ? `${amd(qa.priceAmd)}${surcharge ? ` · +${surcharge} % priority` : ""}` : undefined}
          selected={priority === "asap"}
          onPress={() => priority !== "asap" && onPriority("asap")}
          a11yHint={`Crew arrives ${dayLabel(asap.from, now)} ${clockRangeSpoken(asap.from, asap.to)}`}
        >
          <View style={s.windowBox} accessible accessibilityLabel={`Estimated arrival ${dayLabel(asap.from, now)} ${clockRangeSpoken(asap.from, asap.to)}, Yerevan time`}>
            <Feather name="clock" size={18} color={theme.colors.accent} />
            <View style={{ flex: 1 }}>
              <Text style={s.windowLabel}>Estimated arrival · Yerevan time</Text>
              <Text style={s.windowValue}>{arrival}</Text>
            </View>
          </View>
        </ChoiceCard>

        <ChoiceCard
          title="Schedule a slot"
          icon="calendar"
          body={`A daylight slot at least ${MIN_SCHEDULE_LEAD_HOURS} h from now. The crew arrives within the hour you pick.`}
          meta={qs ? amd(qs.priceAmd) : undefined}
          selected={priority === "scheduled"}
          onPress={() => priority !== "scheduled" && onPriority("scheduled")}
        >
          <View style={{ gap: theme.spacing.md }}>
            <SectionLabel>Day</SectionLabel>
            <ScrollView
              horizontal
              showsHorizontalScrollIndicator={false}
              contentContainerStyle={s.dayRow}
              accessibilityRole="radiogroup"
              accessibilityLabel="Day"
              keyboardShouldPersistTaps="handled"
            >
              {days.map((d) => (
                <Chip
                  key={d.dayKey}
                  role="radio"
                  label={d.label}
                  selected={d.dayKey === dayKey}
                  disabled={!d.available}
                  onPress={() => onDay(d.dayKey)}
                  a11y={d.available ? d.label : `${d.label}, fully booked by the ${MIN_SCHEDULE_LEAD_HOURS} hour lead time`}
                />
              ))}
            </ScrollView>
            <SectionLabel>Arrival from · Yerevan time</SectionLabel>
            {openSlots === 0 ? (
              <Text style={s.note}>No slots left on this day. Pick another day.</Text>
            ) : null}
            <View style={s.chips} accessibilityRole="radiogroup" accessibilityLabel="Time slot">
              {slots.map((x) => (
                <Chip
                  key={x.iso}
                  role="radio"
                  label={x.label}
                  selected={slot === x.iso}
                  disabled={x.disabled}
                  onPress={() => onSlot(x.iso)}
                  a11y={x.disabled ? `${x.label}, too soon` : `Arrive between ${x.label} and ${time(Date.parse(x.iso) + HOUR)}`}
                />
              ))}
            </View>
          </View>
        </ChoiceCard>
      </View>
      <FieldError text={error} />
      <View style={s.fine}>
        <Feather name="sun" size={15} color={theme.colors.muted} />
        <Text style={s.fineText}>
          Daylight flying only. Wind, rain or restricted airspace can move the slot; we call the site contact if so.
        </Text>
      </View>
    </View>
  );
}

/* ------------------------------------------------------------------ step 3: contact */

function StepContact({
  name,
  phone,
  notes,
  onName,
  onPhone,
  onNotes,
  errors,
}: {
  name: string;
  phone: string;
  notes: string;
  onName: (v: string) => void;
  onPhone: (v: string) => void;
  onNotes: (v: string) => void;
  errors: Errors;
}) {
  const phoneRef = useRef<TextInput>(null);
  const notesRef = useRef<TextInput>(null);
  return (
    <GlassCard style={{ gap: theme.spacing.lg }}>
      <TextField
        label="Site contact"
        icon="user"
        value={name}
        onChangeText={onName}
        error={errors.contactName}
        autoComplete="name"
        textContentType="name"
        autoCapitalize="words"
        returnKeyType="next"
        maxLength={MAX_NAME}
        onSubmitEditing={() => phoneRef.current?.focus()}
        submitBehavior="submit"
      />
      <TextField
        label="Phone"
        icon="phone"
        value={phone}
        onChangeText={onPhone}
        error={errors.contactPhone}
        hint="The crew calls this number on the way."
        inputRef={phoneRef}
        keyboardType="phone-pad"
        autoComplete="tel"
        textContentType="telephoneNumber"
        placeholder="+374 10 000 000"
        returnKeyType="next"
        maxLength={20}
        onSubmitEditing={() => notesRef.current?.focus()}
        submitBehavior="submit"
      />
      <TextField
        label="Access notes"
        optional
        icon="key"
        value={notes}
        onChangeText={onNotes}
        error={errors.accessNotes}
        hint="Gate code, where to park, who has the roof keys."
        inputRef={notesRef}
        multiline
        maxLength={MAX_NOTES}
      />
    </GlassCard>
  );
}

/* ------------------------------------------------------------------ step 4: review */

function StepReview({
  now,
  kind,
  priority,
  slot,
  asap,
  focus,
  openFindings,
  projectName,
  projectAddress,
  contactName,
  contactPhone,
  accessNotes,
  quote,
  quotesLoading,
  quotesError,
  onRetryQuote,
  invoiceTo,
  onEdit,
  submitError,
  conflictNumber,
  onTrack,
}: {
  now: number;
  kind: OrderKind;
  priority: OrderPriority;
  slot: string | null;
  asap: { from: string; to: string };
  focus: string[];
  openFindings: number | undefined;
  projectName: string;
  projectAddress: string;
  contactName: string;
  contactPhone: string;
  accessNotes: string;
  quote: Quote | undefined;
  quotesLoading: boolean;
  quotesError: string | null;
  onRetryQuote: () => void;
  invoiceTo: string | null;
  onEdit: (step: number) => void;
  submitError: SubmitError | null;
  conflictNumber: string | undefined;
  onTrack: (id: string) => void;
}) {
  const slotEnd = slot ? new Date(Date.parse(slot) + HOUR).toISOString() : null;
  const when =
    priority === "asap"
      ? `ASAP · on site ${dayLabel(asap.from, now)} ${clockRange(asap.from, asap.to, now)}`
      : slot
        ? `${dayLabel(slot, now)} · arrival ${clockRange(slot, slotEnd, now)}`
        : "Pick a slot";
  const inspection =
    kind === "targeted"
      ? `${KIND_LABELS[kind]} · ${focus.length} ${focus.length === 1 ? "area" : "areas"}`
      : kind === "revision"
        ? `${KIND_LABELS[kind]}${openFindings ? ` · ${openFindings} open findings` : ""}`
        : KIND_LABELS[kind];
  const etaHours = quote?.etaHours ?? ETA_HOURS;
  const reportHours = quote?.reportHours ?? REPORT_HOURS;
  const promise: { value: string; label: string; icon: ReactNode }[] = [
    {
      value: "~5 min",
      label: "Order confirmed, crew booked",
      icon: <Feather name="check-circle" size={16} color={theme.colors.onAccent} />,
    },
    {
      value: priority === "asap" ? hoursLabel(etaHours) : slot ? time(slot) : "--:--",
      label: priority === "asap" ? "Car + drone on site" : `Car + drone on site, ${slot ? dayLabel(slot, now).toLowerCase() : ""}`,
      icon: <MaterialCommunityIcons name="quadcopter" size={17} color={theme.colors.onAccent} />,
    },
    {
      value: `≤ ${hoursLabel(reportHours)}`,
      label: "Independent PDF report after the flight",
      icon: <Feather name="file-text" size={16} color={theme.colors.onAccent} />,
    },
  ];

  return (
    <View style={{ gap: theme.spacing.md }}>
      {submitError ? <SubmitErrorCard error={submitError} conflictNumber={conflictNumber} onTrack={onTrack} /> : null}

      <GlassCard padded={false} style={s.summary}>
        <KeyValueRow label="Site" value={projectAddress ? `${projectName} · ${projectAddress}` : projectName} icon="map-pin" />
        <KeyValueRow
          label="Inspection"
          value={inspection}
          icon="layers"
          onPress={() => onEdit(0)}
          actionIcon="edit-2"
          actionLabel="Edit the kind of inspection"
        />
        {focus.length && kind === "targeted" ? (
          <View style={s.focusWrap} accessible accessibilityLabel={`Focus: ${focus.join(", ")}`}>
            {focus.map((f) => (
              <View key={f} style={s.focusPill}>
                <Text style={s.focusPillText} numberOfLines={1}>
                  {f}
                </Text>
              </View>
            ))}
          </View>
        ) : null}
        <KeyValueRow label="When" value={when} icon="clock" onPress={() => onEdit(1)} actionIcon="edit-2" actionLabel="Change when" />
        <KeyValueRow
          label="Site contact"
          value={`${contactName} · ${contactPhone}`}
          icon="user"
          onPress={() => onEdit(2)}
          actionIcon="edit-2"
          actionLabel="Edit the site contact"
        />
        <KeyValueRow
          label="Access notes"
          value={accessNotes}
          placeholder="None"
          icon="key"
          onPress={() => onEdit(2)}
          actionIcon="edit-2"
          actionLabel="Edit the access notes"
          divider={false}
          numberOfLines={3}
        />
      </GlassCard>

      <AccentCard style={{ gap: theme.spacing.md }}>
        <View
          accessible
          accessibilityLabel={
            quote
              ? `Price ${amdSpoken(quote.priceAmd)}, VAT excluded, paid by invoice`
              : quotesLoading
                ? "Loading the price"
                : "Price unavailable"
          }
        >
          <Text style={s.priceLabel}>Price · paid by invoice</Text>
          {quote ? (
            <Text style={s.price}>{amd(quote.priceAmd)}</Text>
          ) : quotesLoading ? (
            <Text style={s.priceMuted}>Loading price…</Text>
          ) : (
            <Text style={s.priceMuted}>{quotesError ?? "Price unavailable right now."}</Text>
          )}
          <Text style={s.onAccentMuted}>
            VAT excluded. {invoiceTo ? `We invoice ${invoiceTo}` : "We send an invoice"} after the report; nothing is charged in
            the app.
          </Text>
        </View>
        {!quote && !quotesLoading ? (
          <Button title="Load price" icon="refresh-cw" variant="white" onPress={onRetryQuote} />
        ) : null}
        {quote?.includes.length ? (
          <View style={{ gap: theme.spacing.xs + 2 }} accessibilityRole="list" accessibilityLabel="Included">
            {quote.includes.map((inc) => (
              <View key={inc} style={s.includeRow}>
                <Feather name="check" size={15} color={theme.colors.onAccent} />
                <Text style={s.includeText}>{inc}</Text>
              </View>
            ))}
          </View>
        ) : null}
        <View style={s.promise} accessibilityRole="list" accessibilityLabel="What happens next">
          {promise.map((p) => (
            <View key={p.label} style={s.promiseItem} accessible accessibilityLabel={`${p.value}: ${p.label}`}>
              {p.icon}
              <Text style={s.promiseValue} numberOfLines={1} adjustsFontSizeToFit minimumFontScale={0.8}>
                {p.value}
              </Text>
              <Text style={s.promiseLabel}>{p.label}</Text>
            </View>
          ))}
        </View>
      </AccentCard>

      <View style={s.fine}>
        <Feather name="info" size={15} color={theme.colors.muted} />
        <Text style={s.fineText}>
          Daylight flying only. Weather or restricted airspace can move the slot; we call {contactName || "the site contact"} if so.
          You can cancel free of charge until the crew is on site.
        </Text>
      </View>
    </View>
  );
}

function SubmitErrorCard({
  error,
  conflictNumber,
  onTrack,
}: {
  error: SubmitError;
  conflictNumber: string | undefined;
  onTrack: (id: string) => void;
}) {
  const content: { icon: FeatherName; title: string } =
    error.type === "conflict"
      ? { icon: "truck", title: conflictNumber ? `${conflictNumber} is already running` : "An inspection is already running" }
      : error.type === "area"
        ? { icon: "map", title: "Outside our service area" }
        : error.type === "forbidden"
          ? { icon: "lock", title: "You can't order on this project" }
          : { icon: "alert-triangle", title: "The order didn't go through" };
  return (
    <View style={s.alert} accessibilityRole="alert">
      <View style={s.alertIcon}>
        <Feather name={content.icon} size={18} color={theme.colors.danger} />
      </View>
      <View style={{ flex: 1, gap: theme.spacing.xs }}>
        <Text style={s.alertTitle}>{content.title}</Text>
        <Text style={s.alertBody}>{error.message}</Text>
        {error.type === "conflict" ? (
          <Button
            title={conflictNumber ? `Track ${conflictNumber}` : "Track the running order"}
            icon="navigation"
            variant="white"
            onPress={() => onTrack(error.orderId)}
            style={{ marginTop: theme.spacing.sm }}
          />
        ) : null}
      </View>
    </View>
  );
}

/* ------------------------------------------------------------------ success */

function SuccessView({ order, now, projectName }: { order: Order; now: number; projectName: string }) {
  const arrival =
    order.etaArrivalFrom && order.etaArrivalTo
      ? `${dayLabel(order.etaArrivalFrom, now)} ${clockRange(order.etaArrivalFrom, order.etaArrivalTo, now)}`
      : order.priority === "scheduled" && order.scheduledFor
        ? `${dayLabel(order.scheduledFor, now)} ${clockRange(order.scheduledFor, new Date(Date.parse(order.scheduledFor) + HOUR).toISOString(), now)}`
        : `${hoursLabel(ETA_HOURS)} after confirmation`;
  return (
    <View style={{ gap: theme.spacing.lg }}>
      <View style={s.successHead} accessible accessibilityLabel={`Order placed. ${order.number}. ${kindLabel(order.kind)} for ${projectName}.`}>
        <View style={s.successIcon}>
          <Feather name="check" size={34} color={theme.colors.onAccent} />
        </View>
        <Text style={s.successEyebrow}>Order placed</Text>
        <Text style={s.successNumber} selectable>
          {order.number}
        </Text>
        <Text style={s.successBody}>
          {kindLabel(order.kind)} for {projectName}. We confirm the crew within minutes and keep you posted at every step.
        </Text>
      </View>
      <GlassCard padded={false} style={s.summary}>
        <KeyValueRow label="Status" value={statusHeadline(order, now)} icon="activity" />
        <KeyValueRow label="Car + drone on site" value={arrival} icon="truck" />
        <KeyValueRow label="Independent report" value={`Within ${REPORT_HOURS} h after the flight`} icon="file-text" />
        <KeyValueRow label="Price" value={`${amd(order.priceAmd)} · paid by invoice`} icon="credit-card" divider={false} />
      </GlassCard>
    </View>
  );
}

/* ------------------------------------------------------------------ styles */

const s = StyleSheet.create({
  top: {
    paddingHorizontal: theme.spacing.gutter,
    paddingTop: theme.spacing.sm,
    paddingBottom: theme.spacing.md,
    gap: theme.spacing.md,
  },
  eyebrow: {
    fontFamily: theme.fonts.bodySemi,
    fontSize: theme.type.micro,
    letterSpacing: 1,
    textTransform: "uppercase",
    color: theme.colors.accent,
  },
  content: {
    paddingHorizontal: theme.spacing.gutter,
    paddingBottom: theme.spacing.xxl,
    gap: theme.spacing.md,
  },
  titleBlock: { gap: theme.spacing.xs + 2, marginBottom: theme.spacing.xs },
  title: {
    fontFamily: theme.fonts.displayBold,
    fontSize: theme.type.h1 + 2,
    lineHeight: (theme.type.h1 + 2) * theme.type.leadingDisplay,
    color: theme.colors.ink,
    letterSpacing: -0.6,
  },
  sub: {
    fontFamily: theme.fonts.body,
    fontSize: theme.type.label,
    lineHeight: theme.type.label * theme.type.leadingBody,
    color: theme.colors.muted,
  },
  bar: {
    flexDirection: "row",
    gap: theme.spacing.sm,
    paddingHorizontal: theme.spacing.gutter,
    paddingTop: theme.spacing.md,
    backgroundColor: theme.colors.groundDeep,
    borderTopWidth: StyleSheet.hairlineWidth,
    borderTopColor: theme.colors.hairline,
  },
  half: { flex: 1, paddingHorizontal: theme.spacing.md },

  chips: { flexDirection: "row", flexWrap: "wrap", gap: theme.spacing.sm },
  dayRow: { gap: theme.spacing.sm, paddingRight: theme.spacing.sm },
  chip: {
    minHeight: theme.tap,
    paddingHorizontal: theme.spacing.lg,
    borderRadius: theme.radius.round,
    backgroundColor: theme.colors.inner,
    borderWidth: 1,
    borderColor: theme.colors.transparent,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: theme.spacing.xs + 2,
    maxWidth: "100%",
  },
  chipOn: { backgroundColor: theme.colors.accent },
  chipDisabled: { backgroundColor: theme.colors.transparent, borderColor: theme.colors.hairline },
  chipText: { fontFamily: theme.fonts.bodyMedium, fontSize: theme.type.small + 1, color: theme.colors.ink, flexShrink: 1 },
  chipTextOn: { color: theme.colors.onAccent, fontFamily: theme.fonts.bodySemi },
  chipTextDisabled: { color: theme.colors.faint, textDecorationLine: "line-through" },

  addRow: { flexDirection: "row", alignItems: "flex-end", gap: theme.spacing.sm },
  note: {
    fontFamily: theme.fonts.body,
    fontSize: theme.type.small,
    lineHeight: theme.type.small * 1.4,
    color: theme.colors.muted,
  },
  errorRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: theme.spacing.sm,
    backgroundColor: theme.colors.dangerSoft,
    borderRadius: theme.radius.btn,
    paddingHorizontal: theme.spacing.md,
    paddingVertical: theme.spacing.sm + 2,
  },
  errorText: { flex: 1, fontFamily: theme.fonts.bodyMedium, fontSize: theme.type.small + 1, color: theme.colors.danger },

  windowBox: {
    flexDirection: "row",
    alignItems: "center",
    gap: theme.spacing.md,
    backgroundColor: theme.colors.accentSoft,
    borderRadius: theme.radius.inner,
    padding: theme.spacing.md,
  },
  windowLabel: { fontFamily: theme.fonts.body, fontSize: theme.type.small, color: theme.colors.muted },
  windowValue: { fontFamily: theme.fonts.displaySemi, fontSize: theme.type.h3, color: theme.colors.ink, marginTop: 2 },

  fine: { flexDirection: "row", gap: theme.spacing.sm, paddingHorizontal: theme.spacing.xs, marginTop: theme.spacing.xs },
  fineText: {
    flex: 1,
    fontFamily: theme.fonts.body,
    fontSize: theme.type.small,
    lineHeight: theme.type.small * 1.45,
    color: theme.colors.muted,
  },

  summary: { paddingHorizontal: theme.spacing.lg, paddingVertical: theme.spacing.xs },
  focusWrap: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: theme.spacing.xs + 2,
    paddingBottom: theme.spacing.md,
    paddingLeft: 36 + theme.spacing.md,
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: theme.colors.hairline,
  },
  focusPill: {
    backgroundColor: theme.colors.surface,
    borderRadius: theme.radius.pill,
    paddingHorizontal: theme.spacing.sm + 2,
    paddingVertical: theme.spacing.xs + 1,
    maxWidth: "100%",
  },
  focusPillText: { fontFamily: theme.fonts.bodyMedium, fontSize: theme.type.small - 1, color: theme.colors.ink },

  priceLabel: {
    fontFamily: theme.fonts.bodySemi,
    fontSize: theme.type.micro,
    letterSpacing: 1,
    textTransform: "uppercase",
    color: theme.colors.onAccentMuted,
  },
  price: {
    fontFamily: theme.fonts.displayBold,
    fontSize: theme.type.display,
    color: theme.colors.onAccent,
    letterSpacing: -0.8,
    marginTop: theme.spacing.xs,
  },
  priceMuted: {
    fontFamily: theme.fonts.displaySemi,
    fontSize: theme.type.h3,
    color: theme.colors.onAccent,
    marginTop: theme.spacing.xs,
  },
  onAccentMuted: {
    fontFamily: theme.fonts.body,
    fontSize: theme.type.small + 1,
    lineHeight: (theme.type.small + 1) * 1.45,
    color: theme.colors.onAccentMuted,
    marginTop: theme.spacing.xs,
  },
  includeRow: { flexDirection: "row", alignItems: "center", gap: theme.spacing.sm },
  includeText: { flex: 1, fontFamily: theme.fonts.bodyMedium, fontSize: theme.type.small + 1, color: theme.colors.onAccent },
  promise: { flexDirection: "row", gap: theme.spacing.sm },
  promiseItem: {
    flex: 1,
    gap: theme.spacing.xs,
    backgroundColor: theme.colors.onAccentCard,
    borderRadius: theme.radius.inner,
    borderWidth: 1,
    borderColor: theme.colors.onAccentBorder,
    padding: theme.spacing.md - 2,
  },
  promiseValue: { fontFamily: theme.fonts.displaySemi, fontSize: theme.type.h3, color: theme.colors.onAccent },
  promiseLabel: {
    fontFamily: theme.fonts.body,
    fontSize: theme.type.micro + 1,
    lineHeight: (theme.type.micro + 1) * 1.35,
    color: theme.colors.onAccentMuted,
  },

  alert: {
    flexDirection: "row",
    gap: theme.spacing.md,
    backgroundColor: theme.colors.surface,
    borderRadius: theme.radius.inner + 6,
    borderWidth: 1.5,
    borderColor: theme.colors.danger,
    padding: theme.spacing.lg,
  },
  alertIcon: {
    width: 36,
    height: 36,
    borderRadius: theme.radius.pill + 2,
    backgroundColor: theme.colors.dangerSoft,
    alignItems: "center",
    justifyContent: "center",
  },
  alertTitle: { fontFamily: theme.fonts.bodySemi, fontSize: theme.type.label, color: theme.colors.ink },
  alertBody: {
    fontFamily: theme.fonts.body,
    fontSize: theme.type.small + 1,
    lineHeight: (theme.type.small + 1) * 1.45,
    color: theme.colors.muted,
  },

  successHead: { alignItems: "center", gap: theme.spacing.sm, paddingTop: theme.spacing.xl },
  successIcon: {
    width: 76,
    height: 76,
    borderRadius: 38,
    backgroundColor: theme.colors.accent,
    alignItems: "center",
    justifyContent: "center",
    marginBottom: theme.spacing.sm,
    ...theme.shadow,
  },
  successEyebrow: {
    fontFamily: theme.fonts.bodySemi,
    fontSize: theme.type.micro,
    letterSpacing: 1,
    textTransform: "uppercase",
    color: theme.colors.accent,
  },
  successNumber: {
    fontFamily: theme.fonts.displayBold,
    fontSize: theme.type.display,
    color: theme.colors.ink,
    letterSpacing: -0.8,
  },
  successBody: {
    fontFamily: theme.fonts.body,
    fontSize: theme.type.label,
    lineHeight: theme.type.label * theme.type.leadingBody,
    color: theme.colors.muted,
    textAlign: "center",
    paddingHorizontal: theme.spacing.md,
  },
});
