import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { CreateOrderSchema, simulatorOn } from "./orders";

const NOW = new Date("2026-09-24T04:00:00Z"); // 08:00 in Yerevan

const body = (scheduledFor: string | null) => ({
  projectId: "p1",
  kind: "full",
  priority: "scheduled",
  scheduledFor,
  contactName: "Site manager",
  contactPhone: "+374 00 000 300",
});

function issue(scheduledFor: string | null) {
  const r = CreateOrderSchema.safeParse(body(scheduledFor));
  return r.success ? null : r.error.issues.map((i) => `${i.path.join(".")}: ${i.message}`).join("; ");
}

describe("CreateOrderSchema: scheduledFor", () => {
  beforeEach(() => {
    vi.useFakeTimers();
    vi.setSystemTime(NOW);
  });
  afterEach(() => vi.useRealTimers());

  it("accepts daylight starts (09:00-17:00 Yerevan) at least 3 h ahead", () => {
    expect(issue("2026-09-24T09:00:00Z")).toBeNull(); // 13:00 today
    expect(issue("2026-09-25T05:00:00.000Z")).toBeNull(); // 09:00 tomorrow
    expect(issue("2026-09-25T17:00:00+04:00")).toBeNull(); // 17:00 tomorrow, with an offset
  });
  it("rejects night slots with 400 on scheduledFor", () => {
    expect(issue("2026-09-24T22:00:00Z")).toMatch(/^scheduledFor: We fly in daylight only: start between 09:00 and 17:00 Yerevan time/); // 02:00
    expect(issue("2026-09-25T13:15:00Z")).toMatch(/^scheduledFor: We fly in daylight only/); // 17:15
    expect(issue("2026-09-25T04:30:00Z")).toMatch(/^scheduledFor: We fly in daylight only/); // 08:30
  });
  it("rejects a bare date or a time without a zone", () => {
    expect(issue("2026-09-25")).toMatch(/^scheduledFor: Must be an ISO-8601 date-time with a time zone/);
    expect(issue("2026-09-25T10:00:00")).toMatch(/^scheduledFor: Must be an ISO-8601 date-time with a time zone/);
  });
  it("keeps the lead-time and horizon rules", () => {
    expect(issue("2026-09-24T06:00:00Z")).toMatch(/at least 3 h from now/); // 10:00 today: 2 h ahead
    expect(issue("2027-01-15T06:00:00Z")).toMatch(/within 90 days/);
    expect(issue(null)).toMatch(/Required for a scheduled order/);
  });
});

describe("simulatorOn", () => {
  afterEach(() => vi.unstubAllEnvs());

  it("defaults to on outside production and off in production", () => {
    vi.stubEnv("DISPATCH_SIMULATOR", "");
    vi.stubEnv("NODE_ENV", "development");
    expect(simulatorOn()).toBe(true);
    vi.stubEnv("NODE_ENV", "test");
    expect(simulatorOn()).toBe(true);
    vi.stubEnv("NODE_ENV", "production");
    expect(simulatorOn()).toBe(false);
  });
  it("follows an explicit setting everywhere", () => {
    vi.stubEnv("NODE_ENV", "production");
    vi.stubEnv("DISPATCH_SIMULATOR", "on");
    expect(simulatorOn()).toBe(true);
    vi.stubEnv("NODE_ENV", "development");
    vi.stubEnv("DISPATCH_SIMULATOR", "off");
    expect(simulatorOn()).toBe(false);
    vi.stubEnv("DISPATCH_SIMULATOR", " OFF ");
    expect(simulatorOn()).toBe(false);
  });
});
