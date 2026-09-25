/**
 * Local notifications for inspection orders (expo-notifications).
 *
 * - One notification per order + status, de-duplicated here (and by a stable
 *   notification identifier, so a repeat replaces instead of stacking).
 * - Two reminders per order: crew arrival (ETA - 15 min) and report due.
 *   They are rescheduled when the times move and cancelled once passed.
 * - Web: every function is a no-op; the in-app OrderToast covers it.
 *
 * This is local-only. It fires while the app is running (status changes seen
 * over SSE/polling) and for the scheduled reminders; background push needs a
 * server and is out of scope for v1.1.
 *
 * The module is required lazily so web bundles never evaluate it and Expo Go
 * only warns once something is actually scheduled.
 */
import { useEffect, useRef } from "react";
import { Platform } from "react-native";
import type * as NotificationsModule from "expo-notifications";
import { isActiveStatus, type Order, type OrderEvent, type OrderEventStatus } from "./api";
import { statusLabel } from "./orders";
import { time } from "./format";

type N = typeof NotificationsModule;

export const ORDER_CHANNEL_ID = "orders";
const MIN = 60_000;
/** Crew-arrival reminder lead, before timeScale. */
export const ETA_REMINDER_LEAD_MS = 15 * MIN;

let mod: N | null | undefined;
function notifications(): N | null {
  if (Platform.OS === "web") return null;
  if (mod === undefined) {
    try {
      // eslint-disable-next-line @typescript-eslint/no-require-imports
      mod = require("expo-notifications") as N;
    } catch {
      mod = null;
    }
  }
  return mod;
}

export const notificationsSupported = Platform.OS !== "web";

/* ------------------------------------------------------------------ setup */

let setupPromise: Promise<void> | null = null;

/**
 * Foreground behaviour + Android channel. Safe to call many times; never
 * prompts. Status notifications stay silent in the foreground (the in-app
 * toast shows them) but land in the list; reminders show a banner.
 */
export function setupNotifications(): Promise<void> {
  const N = notifications();
  if (!N) return Promise.resolve();
  if (!setupPromise) {
    setupPromise = (async () => {
      try {
        N.setNotificationHandler({
          handleNotification: async (n) => {
            const reminder = n.request.content.data?.kind === "reminder";
            return {
              shouldShowBanner: reminder,
              shouldShowList: true,
              shouldPlaySound: reminder,
              shouldSetBadge: false,
            };
          },
        });
        if (Platform.OS === "android") {
          await N.setNotificationChannelAsync(ORDER_CHANNEL_ID, {
            name: "Inspection orders",
            description: "Crew on the way, on site, report ready.",
            importance: N.AndroidImportance.HIGH,
            lightColor: "#0A8FA3",
          });
        }
      } catch {
        // Expo Go / simulator without notification support: stay silent
      }
    })();
  }
  return setupPromise;
}

export type PermissionState = "granted" | "denied" | "undetermined" | "unavailable";

export async function notificationPermission(): Promise<PermissionState> {
  const N = notifications();
  if (!N) return "unavailable";
  try {
    const p = await N.getPermissionsAsync();
    if (p.granted || p.ios?.status === N.IosAuthorizationStatus.PROVISIONAL) return "granted";
    return p.canAskAgain === false || p.status === "denied" ? "denied" : "undetermined";
  } catch {
    return "unavailable";
  }
}

/**
 * Ask once, at a moment that explains itself (right after the first order is
 * placed). Returns true when notifications can be shown.
 */
export async function requestNotificationPermission(): Promise<boolean> {
  const N = notifications();
  if (!N) return false;
  await setupNotifications();
  const state = await notificationPermission();
  if (state === "granted") return true;
  if (state !== "undetermined") return false;
  try {
    const p = await N.requestPermissionsAsync({
      ios: { allowAlert: true, allowSound: true, allowBadge: false },
    });
    return p.granted || p.ios?.status === N.IosAuthorizationStatus.PROVISIONAL;
  } catch {
    return false;
  }
}

/* ------------------------------------------------------------------ dedupe */

/** order id -> statuses already shown (or deliberately skipped as history). */
const seen = new Map<string, Set<OrderEventStatus>>();

function seenSet(orderId: string) {
  let s = seen.get(orderId);
  if (!s) {
    s = new Set();
    seen.set(orderId, s);
  }
  return s;
}

/** Mark everything the order already went through as seen, without notifying (initial loads, own creates). */
export function seedOrderEvents(order: Pick<Order, "id" | "status" | "events">) {
  const s = seenSet(order.id);
  for (const e of order.events ?? []) s.add(e.status);
  s.add(order.status);
}

export function hasSeenOrder(orderId: string) {
  return seen.has(orderId);
}

/**
 * Events not shown yet, oldest first, and mark them shown. For an order this
 * device has never seen: with `announceIfUnseen` only its newest event is
 * returned (a teammate just ordered), otherwise it is seeded silently.
 */
export function takeNewEvents(order: Pick<Order, "id" | "status" | "events">, announceIfUnseen = false): OrderEvent[] {
  if (!seen.has(order.id)) {
    const events = order.events ?? [];
    seedOrderEvents(order);
    const last = events[events.length - 1];
    return announceIfUnseen && last ? [last] : [];
  }
  const s = seenSet(order.id);
  const fresh = (order.events ?? []).filter((e) => !s.has(e.status));
  for (const e of fresh) s.add(e.status);
  s.add(order.status);
  return fresh;
}

/** Forget everything (sign-out). */
export function resetNotifyState() {
  seen.clear();
  reminders.clear();
}

/* ------------------------------------------------------------------ status notifications */

/** Post the status change as a local notification (silent if permission is not granted; never prompts). */
export async function notifyOrderEvent(order: Order, event: OrderEvent): Promise<void> {
  const N = notifications();
  if (!N) return;
  if ((await notificationPermission()) !== "granted") return;
  await setupNotifications();
  try {
    await N.scheduleNotificationAsync({
      identifier: `order-${order.id}-${event.status}`,
      content: {
        title: `${statusLabel(event.status)} · ${order.number}`,
        body: event.message,
        data: { kind: "status", orderId: order.id, status: event.status, url: `/order/${order.id}` },
        sound: false,
      },
      trigger: Platform.OS === "android" ? { channelId: ORDER_CHANNEL_ID } : null,
    });
  } catch {
    // ignore: notifications are a convenience, the screen shows the status
  }
}

/* ------------------------------------------------------------------ reminders */

/** identifier -> scheduled time (ms), so polling does not churn the OS scheduler. */
const reminders = new Map<string, number>();

async function cancelReminder(N: N, id: string) {
  if (!reminders.has(id)) return;
  reminders.delete(id);
  try {
    await N.cancelScheduledNotificationAsync(id);
  } catch {
    // already fired or never scheduled
  }
}

async function scheduleReminder(N: N, id: string, at: number, title: string, body: string, orderId: string) {
  if (reminders.get(id) === at) return;
  await cancelReminder(N, id);
  reminders.set(id, at);
  try {
    await N.scheduleNotificationAsync({
      identifier: id,
      content: { title, body, data: { kind: "reminder", orderId, url: `/order/${orderId}` } },
      trigger: {
        type: N.SchedulableTriggerInputTypes.DATE,
        date: new Date(at),
        ...(Platform.OS === "android" ? { channelId: ORDER_CHANNEL_ID } : {}),
      },
    });
  } catch {
    reminders.delete(id);
  }
}

/**
 * Keep the two reminders for an order in step with its current estimates:
 * crew arrival at etaArrivalFrom - 15 min (scaled), report at reportDueAt.
 * Cancels them once the step is reached or the order ends.
 */
export async function syncOrderReminders(order: Order, now: number = Date.now()): Promise<void> {
  const N = notifications();
  if (!N) return;
  const etaId = `order-${order.id}-eta`;
  const reportId = `order-${order.id}-report`;
  if (!isActiveStatus(order.status)) {
    await Promise.all([cancelReminder(N, etaId), cancelReminder(N, reportId)]);
    return;
  }
  if ((await notificationPermission()) !== "granted") return;
  await setupNotifications();
  const scale = order.timeScale > 0 ? order.timeScale : 1;

  const waitingForCrew = order.status === "requested" || order.status === "confirmed" || order.status === "dispatched";
  const etaFrom = order.etaArrivalFrom ? new Date(order.etaArrivalFrom).getTime() : NaN;
  const etaAt = etaFrom - ETA_REMINDER_LEAD_MS / scale;
  if (waitingForCrew && Number.isFinite(etaAt) && etaAt > now + 5_000) {
    await scheduleReminder(
      N,
      etaId,
      etaAt,
      `Crew arriving soon · ${order.number}`,
      `Car + drone due at ${order.projectName} from ${time(order.etaArrivalFrom)}. Please make sure the site contact is reachable.`,
      order.id,
    );
  } else {
    await cancelReminder(N, etaId);
  }

  const due = order.reportDueAt ? new Date(order.reportDueAt).getTime() : NaN;
  if (Number.isFinite(due) && due > now + 5_000) {
    await scheduleReminder(
      N,
      reportId,
      due,
      `Report due · ${order.number}`,
      `The independent report for ${order.projectName} is due now. Open control.io to download it.`,
      order.id,
    );
  } else {
    await cancelReminder(N, reportId);
  }
}

/** Cancel every scheduled reminder (sign-out). */
export async function clearOrderNotifications(): Promise<void> {
  const N = notifications();
  resetNotifyState();
  if (!N) return;
  try {
    await N.cancelAllScheduledNotificationsAsync();
  } catch {
    // nothing scheduled
  }
}

/* ------------------------------------------------------------------ taps */

/**
 * Call `onOpen(orderId)` when the user taps an order notification, including
 * the one that cold-started the app. Mount once (OrderToast does).
 */
export function useOrderNotificationTaps(onOpen: (orderId: string) => void) {
  const cb = useRef(onOpen);
  cb.current = onOpen;
  useEffect(() => {
    const N = notifications();
    if (!N) return;
    const handled = new Set<string>();
    const handle = (r: NotificationsModule.NotificationResponse | null | undefined) => {
      if (!r) return;
      const id = r.notification.request.identifier;
      const orderId = r.notification.request.content.data?.orderId;
      if (typeof orderId !== "string" || handled.has(id)) return;
      handled.add(id);
      cb.current(orderId);
    };
    let alive = true;
    try {
      N.getLastNotificationResponseAsync()
        .then((r) => {
          if (alive) handle(r);
        })
        .catch(() => {});
    } catch {
      // unsupported
    }
    let sub: { remove: () => void } | undefined;
    try {
      sub = N.addNotificationResponseReceivedListener(handle);
    } catch {
      sub = undefined;
    }
    return () => {
      alive = false;
      sub?.remove();
    };
  }, []);
}
