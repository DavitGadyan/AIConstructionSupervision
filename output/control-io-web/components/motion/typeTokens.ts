/**
 * Splits text into words and grapheme clusters for the typewriter effect.
 * Grapheme-aware (Intl.Segmenter) so Armenian, Cyrillic, accented Latin and
 * emoji never split inside a visible letter. Pure - unit tested.
 *
 * No "use client" here on purpose: server components (Hero, PageTitle) import
 * textOf / typeDuration / typeSequence to size headings and to chain the
 * delays of split headlines.
 */
import { isValidElement, type ReactNode } from "react";

export type Token = { type: "space"; text: string } | { type: "word"; chars: string[] };

/** Defaults shared by TypeText and the timing helpers below. */
export const TYPE_SPEED = 34;
export const TYPE_MAX_DURATION = 1500;

const segmenter =
  typeof Intl !== "undefined" && "Segmenter" in Intl ? new Intl.Segmenter(undefined, { granularity: "grapheme" }) : null;

export function graphemes(s: string): string[] {
  if (segmenter) return Array.from(segmenter.segment(s), (g) => g.segment);
  return Array.from(s); // code points: correct for every script we ship
}

export function tokenize(text: string): Token[] {
  const out: Token[] = [];
  for (const part of text.split(/(\s+)/)) {
    if (!part) continue;
    if (/^\s+$/.test(part)) out.push({ type: "space", text: part });
    else out.push({ type: "word", chars: graphemes(part) });
  }
  return out;
}

/** ms between letters: aim for `speed`, but never let a long title take longer than `maxDuration`. */
export function stepFor(chars: number, speed = TYPE_SPEED, maxDuration = TYPE_MAX_DURATION, min = 10) {
  if (chars <= 0) return speed;
  return Math.max(min, Math.min(speed, maxDuration / chars));
}

/** Plain text of a React node: strings and numbers, <br> as a space, element children recursed. */
export function textOf(node: ReactNode): string {
  if (node == null || typeof node === "boolean") return "";
  if (typeof node === "string" || typeof node === "number") return String(node);
  if (Array.isArray(node)) return node.map(textOf).join("");
  if (isValidElement(node)) {
    if (node.type === "br") return " ";
    return textOf((node.props as { children?: ReactNode }).children);
  }
  return "";
}

/** Visible letters (grapheme clusters, whitespace excluded) of a node. */
export function letterCount(node: ReactNode): number {
  return tokenize(textOf(node)).reduce((n, t) => n + (t.type === "word" ? t.chars.length : 0), 0);
}

/**
 * ms from a TypeText's start until the slot after its last letter, i.e. the
 * `delay` the next piece of a split headline needs so the caret hands over
 * without a gap or an overlap. Same inputs as TypeText's speed/maxDuration.
 */
export function typeDuration(node: ReactNode, speed = TYPE_SPEED, maxDuration = TYPE_MAX_DURATION): number {
  const n = letterCount(node);
  return n * stepFor(n, speed, maxDuration);
}

/**
 * Timing for a headline split into sequential pieces (hero, explorer): one
 * shared letter step capped so the whole line fits `maxDuration`, and each
 * piece's delay = start of the previous piece + typeDuration(previous piece).
 * Pass `speed={step}` and `delay={delays[k]}` to piece k.
 */
export function typeSequence(
  pieces: ReactNode[],
  { speed = TYPE_SPEED, maxDuration = TYPE_MAX_DURATION, delay = 0 }: { speed?: number; maxDuration?: number; delay?: number } = {},
): { step: number; delays: number[]; total: number } {
  const step = stepFor(pieces.reduce<number>((n, p) => n + letterCount(p), 0), speed, maxDuration);
  const delays: number[] = [];
  let at = delay;
  for (const p of pieces) {
    delays.push(Math.round(at));
    // A piece types at `step` as long as its own letters fit TypeText's default cap.
    at += typeDuration(p, step);
  }
  return { step, delays, total: Math.round(at - delay) };
}
