import { describe, expect, it } from "vitest";
import {
  DURATIONS,
  HOUR,
  MINUTE,
  advanceOrder,
  canCancel,
  cancelAllowedByRole,
  earliestScheduledFor,
  hhmm,
  daylightWindowText,
  initialEstimates,
  scheduleInDaylight,
  scheduleLeadOk,
  statusMessage,
  timeline,
  type DispatchState,
} from "./dispatch";
import { CREWS, crewFor } from "./crews";
import { ORDER_STATUSES, STATUS_ORDER, type OrderStatus } from "./orderTypes";

const T0 = new Date("2026-09-23T08:00:00Z"); // 12:00 in Yerevan

function order(over: Partial<DispatchState> = {}): DispatchState {
  const base: DispatchState = {
    number: "INS-2026-0007",
    priority: "asap",
    status: "requested",
    createdAt: T0,
    scheduledFor: null,
    confirmedAt: null,
    dispatchedAt: null,
    etaArrivalFrom: null,
    etaArrivalTo: null,
    arrivedAt: null,
    flightStartedAt: null,
    flightEndedAt: null,
    reportDueAt: null,
    deliveredAt: null,
    cancelledAt: null,
    crew: null,
    timeScale: 1,
    ...over,
  };
  return { ...base, ...initialEstimates(base) };
}

const plus = (d: Date, ms: number) => new Date(d.getTime() + ms);
const FAR = plus(T0, 7 * 24 * HOUR);

describe("advanceOrder: boundaries", () => {
  it("confirms exactly at createdAt + 5 min, not a millisecond before", () => {
    const o = order();
    const due = plus(T0, DURATIONS.confirmMs);
    expect(advanceOrder(o, plus(due, -1)).order.status).toBe("requested");
    const r = advanceOrder(o, due);
    expect(r.order.status).toBe("confirmed");
    expect(r.order.confirmedAt).toEqual(due);
    expect(r.transitions).toHaveLength(1);
    expect(r.transitions[0]).toMatchObject({ status: "confirmed", at: due });
  });

  it("dispatches 15 min after confirmation and assigns a crew", () => {
    const o = order();
    const due = plus(T0, DURATIONS.confirmMs + DURATIONS.dispatchMs);
    expect(advanceOrder(o, plus(due, -1)).order.status).toBe("confirmed");
    const r = advanceOrder(o, due);
    expect(r.order.status).toBe("dispatched");
    expect(r.order.dispatchedAt).toEqual(due);
    expect(r.order.crew).toEqual(crewFor(o.number));
    expect(CREWS).toContainEqual(r.order.crew);
  });

  it("arrives inside the 3-4 h window after confirmation, then flies after 10 min setup and 45 min flight", () => {
    const r = advanceOrder(order(), FAR);
    const c = r.order.confirmedAt!.getTime();
    const arrived = r.order.arrivedAt!.getTime();
    expect(r.order.etaArrivalFrom!.getTime()).toBe(c + 3 * HOUR);
    expect(r.order.etaArrivalTo!.getTime()).toBe(c + 4 * HOUR);
    expect(arrived).toBeGreaterThanOrEqual(c + 3 * HOUR);
    expect(arrived).toBeLessThanOrEqual(c + 4 * HOUR);
    expect(r.order.flightStartedAt!.getTime()).toBe(arrived + 10 * MINUTE);
    expect(r.order.flightEndedAt!.getTime()).toBe(arrived + 55 * MINUTE);
    expect(r.order.reportDueAt!.getTime()).toBe(arrived + 55 * MINUTE + 12 * HOUR);
  });

  it("each step fires exactly at its projected due time", () => {
    const t = timeline(order());
    const steps: [OrderStatus, Date][] = [
      ["confirmed", t.confirmedAt],
      ["dispatched", t.dispatchedAt],
      ["on_site", t.arrivedAt],
      ["flying", t.flightStartedAt],
      ["processing", t.flightEndedAt],
    ];
    const prev: Record<string, OrderStatus> = { confirmed: "requested", dispatched: "confirmed", on_site: "dispatched", flying: "on_site", processing: "flying" };
    for (const [status, due] of steps) {
      expect(advanceOrder(order(), plus(due, -1)).order.status).toBe(prev[status]);
      expect(advanceOrder(order(), due).order.status).toBe(status);
    }
  });

  it("the arrival point is deterministic per order and differs between orders", () => {
    const a = advanceOrder(order({ number: "INS-2026-0010" }), FAR).order.arrivedAt!.getTime();
    const a2 = advanceOrder(order({ number: "INS-2026-0010" }), FAR).order.arrivedAt!.getTime();
    const b = advanceOrder(order({ number: "INS-2026-0011" }), FAR).order.arrivedAt!.getTime();
    expect(a).toBe(a2);
    expect(a).not.toBe(b);
  });
});

describe("advanceOrder: catch-up", () => {
  it("applies every due step in one call, each stamped at its due time (not at now)", () => {
    const o = order();
    const t = timeline(o);
    const r = advanceOrder(o, FAR);
    expect(r.transitions.map((x) => x.status)).toEqual(["confirmed", "dispatched", "on_site", "flying", "processing"]);
    expect(r.transitions.map((x) => x.at)).toEqual([t.confirmedAt, t.dispatchedAt, t.arrivedAt, t.flightStartedAt, t.flightEndedAt]);
    const times = r.transitions.map((x) => x.at.getTime());
    for (let i = 1; i < times.length; i++) expect(times[i]).toBeGreaterThan(times[i - 1]);
    for (const x of r.transitions) expect(x.at.getTime()).toBeLessThan(FAR.getTime());
  });

  it("never applies delivered; returns deliveryDue (6 h after the flight, within the 12 h promise)", () => {
    const r = advanceOrder(order(), FAR);
    expect(r.order.status).toBe("processing");
    expect(r.order.deliveredAt).toBeNull();
    expect(r.deliveryDue!.getTime()).toBe(r.order.flightEndedAt!.getTime() + 6 * HOUR);
    expect(r.deliveryDue!.getTime()).toBeLessThanOrEqual(r.order.reportDueAt!.getTime());
    expect(r.deliveryReady).toBe(true);
    expect(r.nextDueAt).toBeNull();
    const early = advanceOrder(order(), plus(r.order.flightEndedAt!, 1));
    expect(early.order.status).toBe("processing");
    expect(early.deliveryReady).toBe(false);
  });

  it("caps processing at the 12 h report promise", () => {
    const r = advanceOrder(order(), FAR, 1, { processingHours: 30 });
    expect(r.deliveryDue).toEqual(r.order.reportDueAt);
  });

  it("returns a patch with only the changed fields", () => {
    const o = order();
    const r = advanceOrder(o, plus(T0, DURATIONS.confirmMs));
    expect(Object.keys(r.patch).sort()).toEqual(["confirmedAt", "status"]);
    expect(advanceOrder(o, T0).patch).toEqual({});
    expect(advanceOrder(o, T0).changed).toBe(false);
  });

  it("does not mutate its input", () => {
    const o = order();
    const copy = structuredClone(o);
    advanceOrder(o, FAR);
    expect(o).toEqual(copy);
  });
});

describe("advanceOrder: idempotence and split-advance equality", () => {
  it("advancing twice to the same time changes nothing the second time", () => {
    for (const now of [T0, plus(T0, 5 * MINUTE), plus(T0, 3.5 * HOUR), plus(T0, 4.2 * HOUR), FAR]) {
      const once = advanceOrder(order(), now);
      const twice = advanceOrder(once.order, now);
      expect(twice.transitions).toEqual([]);
      expect(twice.changed).toBe(false);
      expect(twice.order).toEqual(once.order);
    }
  });

  it("advance(t1) then advance(t2) equals advance(t2) directly", () => {
    const end = timeline(order()).flightEndedAt.getTime() + HOUR;
    const points = Array.from({ length: 40 }, (_, i) => new Date(T0.getTime() + ((end - T0.getTime()) * i) / 39));
    for (let i = 0; i < points.length; i += 3) {
      for (let j = i; j < points.length; j += 4) {
        const direct = advanceOrder(order(), points[j]);
        const a = advanceOrder(order(), points[i]);
        const b = advanceOrder(a.order, points[j]);
        expect(b.order).toEqual(direct.order);
        expect([...a.transitions, ...b.transitions]).toEqual(direct.transitions);
      }
    }
  });

  it("holds for many small steps (a 2 s ticker) at demo scale", () => {
    const direct = advanceOrder(order({ timeScale: 240 }), plus(T0, 10 * MINUTE));
    let o = order({ timeScale: 240 });
    const all = [];
    for (let t = T0.getTime(); t <= T0.getTime() + 10 * MINUTE; t += 2000) {
      const r = advanceOrder(o, new Date(t));
      all.push(...r.transitions);
      o = r.order;
    }
    expect(o).toEqual(direct.order);
    expect(all).toEqual(direct.transitions);
  });
});

describe("advanceOrder: time scale", () => {
  it("at scale 240 an ASAP order reaches deliveryDue in under 5 minutes", () => {
    for (const n of ["INS-2026-0001", "INS-2026-0002", "INS-2026-0003", "INS-2026-0099"]) {
      const r = advanceOrder(order({ number: n, timeScale: 240 }), FAR);
      expect(r.order.status).toBe("processing");
      expect(r.deliveryDue!.getTime() - T0.getTime()).toBeLessThan(5 * MINUTE);
    }
  });

  it("uses the scale argument over the stored one when given", () => {
    const r = advanceOrder(order(), plus(T0, 5 * MINUTE / 240), 240);
    expect(r.order.status).toBe("confirmed");
  });

  it("treats a bad scale as real time", () => {
    const r = advanceOrder(order({ timeScale: 0 }), plus(T0, DURATIONS.confirmMs - 1));
    expect(r.order.status).toBe("requested");
  });
});

describe("advanceOrder: scheduled orders", () => {
  const scheduledFor = new Date("2026-09-24T06:00:00Z"); // 10:00 Yerevan, next day

  it("uses [scheduledFor, +1 h] as the window and leaves base 1 h before it opens", () => {
    const o = order({ priority: "scheduled", scheduledFor });
    expect(o.etaArrivalFrom).toEqual(scheduledFor);
    expect(o.etaArrivalTo).toEqual(plus(scheduledFor, HOUR));
    const confirmed = advanceOrder(o, plus(T0, 5 * MINUTE));
    expect(confirmed.order.status).toBe("confirmed");
    expect(advanceOrder(o, plus(scheduledFor, -HOUR - 1)).order.status).toBe("confirmed");
    const dispatched = advanceOrder(o, plus(scheduledFor, -HOUR));
    expect(dispatched.order.status).toBe("dispatched");
    expect(dispatched.order.dispatchedAt).toEqual(plus(scheduledFor, -HOUR));
    const r = advanceOrder(o, FAR);
    expect(r.order.arrivedAt!.getTime()).toBeGreaterThanOrEqual(scheduledFor.getTime());
    expect(r.order.arrivedAt!.getTime()).toBeLessThanOrEqual(scheduledFor.getTime() + HOUR);
    expect(r.order.status).toBe("processing");
  });

  it("says 'around' when a demo time scale squeezes the window into one minute", () => {
    // Created at 12:00:14 -> confirmed 12:00:15.25 -> window 12:01:00.25-12:01:15.25 (15 s at scale 240).
    const createdAt = plus(T0, 14_000);
    const r = advanceOrder(order({ timeScale: 240, createdAt }), plus(createdAt, 5 * MINUTE));
    expect(r.transitions[0].message).toBe("Confirmed. Crew arrives around 12:01.");
  });

  it("says the day when the window is not today", () => {
    const r = advanceOrder(order({ priority: "scheduled", scheduledFor }), plus(T0, 5 * MINUTE));
    expect(r.transitions[0].message).toBe("Confirmed. Crew arrives tomorrow 10:00-11:00.");
  });

  it("never arrives before the crew left base, even for a slot that is already close", () => {
    const soon = plus(T0, 10 * MINUTE);
    const r = advanceOrder(order({ priority: "scheduled", scheduledFor: soon }), FAR);
    const times = [r.order.confirmedAt!, r.order.dispatchedAt!, r.order.arrivedAt!, r.order.flightStartedAt!, r.order.flightEndedAt!].map((d) => d.getTime());
    for (let i = 1; i < times.length; i++) expect(times[i]).toBeGreaterThan(times[i - 1]);
  });
});

describe("advanceOrder: terminal states", () => {
  it("never moves cancelled or delivered orders", () => {
    for (const status of ["cancelled", "delivered"] as const) {
      const o = order({ status, cancelledAt: status === "cancelled" ? plus(T0, MINUTE) : null, deliveredAt: status === "delivered" ? plus(T0, 5 * HOUR) : null });
      const r = advanceOrder(o, FAR);
      expect(r.order.status).toBe(status);
      expect(r.transitions).toEqual([]);
      expect(r.changed).toBe(false);
      expect(r.deliveryDue).toBeNull();
      expect(r.deliveryReady).toBe(false);
    }
  });
});

describe("messages", () => {
  it("formats times in Yerevan (UTC+4)", () => {
    expect(hhmm(new Date("2026-09-23T10:10:00Z"))).toBe("14:10");
    expect(hhmm(new Date("2026-09-23T23:55:00Z"))).toBe("03:55");
  });

  it("matches the API.md examples", () => {
    const r = advanceOrder(order(), FAR);
    const byStatus = Object.fromEntries(r.transitions.map((t) => [t.status, t.message]));
    expect(statusMessage("requested", r.order)).toBe("Order INS-2026-0007 received.");
    expect(byStatus.confirmed).toBe(`Confirmed. Crew arrives between ${hhmm(r.order.etaArrivalFrom!)} and ${hhmm(r.order.etaArrivalTo!)}.`);
    expect(byStatus.dispatched).toBe(`${r.order.crew!.pilot} is on the way (${r.order.crew!.plate}).`);
    expect(byStatus.on_site).toBe("Crew on site.");
    expect(byStatus.flying).toBe("Drone in the air.");
    expect(byStatus.processing).toMatch(/^Flight done\. Report due by (tomorrow )?\d\d:\d\d\.$/);
    expect(statusMessage("delivered", r.order)).toBe("Report ready.");
    expect(statusMessage("cancelled", r.order)).toBe("Order cancelled.");
    expect(statusMessage("delayed", r.order)).toBe("Report is taking longer than usual. Our team is on it.");
  });
});

describe("canCancel", () => {
  const cancellable: OrderStatus[] = ["requested", "confirmed", "dispatched"];

  it("allows cancelling only before the crew is on site", () => {
    for (const s of ORDER_STATUSES) {
      expect(canCancel(s, { role: "owner", access: "write", orderedByCallerOrg: true })).toBe(cancellable.includes(s));
    }
    expect(STATUS_ORDER.indexOf("on_site")).toBe(3);
  });

  it("follows the roles matrix", () => {
    const rows: [string, "read" | "order" | "write" | null, boolean, boolean][] = [
      // role, access, orderedByCallerOrg, expected
      ["owner", "write", true, true],
      ["owner", "write", false, true], // own-org owner: any order on the project
      ["supervisor", "write", false, true],
      ["viewer", "read", true, false],
      ["viewer", "write", true, false], // a viewer never cancels, whatever the access
      ["owner", "order", true, true], // shared org: its own orders
      ["supervisor", "order", true, true],
      ["owner", "order", false, false], // ... but not the owner org's orders
      ["owner", "read", true, false], // read-only share
      ["owner", null, true, false],
    ];
    for (const [role, access, mine, expected] of rows) {
      expect(canCancel("requested", { role, access, orderedByCallerOrg: mine })).toBe(expected);
      expect(cancelAllowedByRole({ role, access, orderedByCallerOrg: mine })).toBe(expected);
      expect(canCancel("on_site", { role, access, orderedByCallerOrg: mine })).toBe(false);
    }
  });
});

describe("schedule lead", () => {
  it("requires scheduled slots at least 3 h ahead (real time)", () => {
    expect(earliestScheduledFor(T0)).toEqual(plus(T0, 3 * HOUR));
    expect(scheduleLeadOk(plus(T0, 3 * HOUR), T0)).toBe(true);
    expect(scheduleLeadOk(plus(T0, 3 * HOUR - 1), T0)).toBe(false);
    expect(scheduleLeadOk(plus(T0, -HOUR), T0)).toBe(false);
  });
});

describe("daylight slots", () => {
  // Asia/Yerevan = UTC+4 all year: 09:00 Yerevan = 05:00Z, 17:00 Yerevan = 13:00Z.
  it("accepts starts from 09:00 to 17:00 Yerevan time, both inclusive", () => {
    expect(scheduleInDaylight(new Date("2026-09-25T05:00:00Z"))).toBe(true); // 09:00
    expect(scheduleInDaylight(new Date("2026-09-25T09:30:00Z"))).toBe(true); // 13:30
    expect(scheduleInDaylight(new Date("2026-09-25T12:45:00Z"))).toBe(true); // 16:45
    expect(scheduleInDaylight(new Date("2026-09-25T13:00:00Z"))).toBe(true); // 17:00
  });
  it("rejects night and edge-of-day starts", () => {
    expect(scheduleInDaylight(new Date("2026-09-25T04:59:59Z"))).toBe(false); // 08:59:59
    expect(scheduleInDaylight(new Date("2026-09-25T13:00:01Z"))).toBe(false); // 17:00:01
    expect(scheduleInDaylight(new Date("2026-09-24T22:00:00Z"))).toBe(false); // 02:00 next day
    expect(scheduleInDaylight(new Date("2026-09-25T00:00:00Z"))).toBe(false); // a bare date: 04:00
    expect(scheduleInDaylight(new Date("2026-09-25T20:00:00Z"))).toBe(false); // 00:00
  });
  it("names the bounds for messages", () => {
    expect(daylightWindowText()).toBe("09:00 and 17:00");
  });
});
