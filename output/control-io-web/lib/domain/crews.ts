/**
 * Demo field crews (car + drone unit + pilot). The dispatch simulator assigns
 * one deterministically per order at "dispatched". Pilots, plates and phone
 * numbers are placeholders ("00" is not a real Armenian area code).
 */
import type { Crew } from "./orderTypes";

export const CREWS: readonly Crew[] = [
  { vehicle: "Toyota Hilux · drone unit 1", plate: "00 AA 001", pilot: "Drone unit 1", pilotPhone: "+374 00 000 101", drone: "DJI Matrice 4E" },
  { vehicle: "Mitsubishi L200 · drone unit 2", plate: "00 AA 002", pilot: "Drone unit 2", pilotPhone: "+374 00 000 102", drone: "DJI Matrice 4E" },
  { vehicle: "Toyota Land Cruiser · drone unit 3", plate: "00 AA 003", pilot: "Drone unit 3", pilotPhone: "+374 00 000 103", drone: "DJI Mavic 3 Enterprise" },
];

/** FNV-1a 32-bit: a small, stable, dependency-free hash (same on every platform). */
export function hash32(s: string): number {
  let h = 0x811c9dc5;
  for (let i = 0; i < s.length; i++) {
    h ^= s.charCodeAt(i);
    h = Math.imul(h, 0x01000193);
  }
  return h >>> 0;
}

/** Deterministic value in [0, 1) derived from a string. */
export function hash01(s: string): number {
  return hash32(s) / 0x1_0000_0000;
}

/** The crew for an order (stable for the same seed, e.g. the order id). */
export function crewFor(seed: string): Crew {
  return { ...CREWS[hash32(`crew:${seed}`) % CREWS.length] };
}
