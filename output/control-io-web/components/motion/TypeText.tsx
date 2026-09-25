"use client";

/**
 * <TypeText as="h2">Every error, in 3D</TypeText>
 *
 * Types a heading out letter by letter when it scrolls into view, with a caret.
 * - Children may mix strings with inline elements (<br/>, <span className=…>);
 *   letters keep counting across them, element props are preserved.
 * - The server HTML holds the real words (letters are only painted in), so
 *   crawlers and no-JS readers get the full heading.
 * - Lifecycle (data-state): "ssr" (server HTML; the only state with the 3 s
 *   JS-failure fallback) -> "idle" (hydrated, hidden until seen, no timer) ->
 *   "play" -> "done". Reduced motion: "static". Runs once per mount.
 * - `eager` (above the fold) is already "play" in the server HTML, so the CSS
 *   types it from first paint instead of waiting for hydration, which can take
 *   seconds on a slow phone; hydration then only marks "done".
 * - a11y="label" (default): a heading gets aria-label with the whole text and
 *   its letter spans are aria-hidden; a generic tag (span/p) gets a visually
 *   hidden copy instead, since aria-label is not allowed there.
 *   a11y="hidden": the whole piece is aria-hidden - for pieces of a split
 *   headline inside a labelled h1/h2, and for decorative lines.
 * - Split headlines: give each piece `delay` = start of the previous piece +
 *   typeDuration(previous) (see typeSequence), `blink={false}` on all but the
 *   last, and `trigger="h2"` so the pieces start together.
 * - The caret colour is `--type-caret` (defaults to the accent; AccentCard
 *   sets it to white).
 */
import {
  Children,
  cloneElement,
  createElement,
  isValidElement,
  useEffect,
  useRef,
  useState,
  type CSSProperties,
  type ElementType,
  type ReactElement,
  type ReactNode,
} from "react";
import s from "./type-text.module.css";
import { letterCount, stepFor, textOf, tokenize, TYPE_MAX_DURATION, TYPE_SPEED } from "./typeTokens";

type State = "ssr" | "idle" | "play" | "done" | "static";

type Props = {
  as?: ElementType;
  children: ReactNode;
  className?: string;
  style?: CSSProperties;
  id?: string;
  /** ms per letter (upper bound) */
  speed?: number;
  /** cap for the whole title, ms */
  maxDuration?: number;
  /** ms before the first letter */
  delay?: number;
  caret?: boolean;
  /** the caret blinks on the last letter before it goes away (off for the non-final pieces of a split headline) */
  blink?: boolean;
  /** type from first paint, without waiting for the viewport or for hydration (above-the-fold only) */
  eager?: boolean;
  a11y?: "label" | "hidden";
  /** CSS selector of an ancestor whose visibility starts the typing (split headlines start as one) */
  trigger?: string;
  [key: string]: unknown;
};

/** The caret blinks 1.5 cycles (on-off-on) on the last letter, then "done" removes it. */
const BLINK_MS = 1500;
/** Without a blink, "done" follows the last letter's 180 ms fade-in. */
const TAIL_MS = 200;
/** Must match the fallback delay in type-text.module.css. */
const FALLBACK_MS = 3000;

const NAMEABLE = /^h[1-6]$/;

/**
 * ms since this piece's CSS typing started, read off the first letter's
 * animation clock (every letter starts in the same style update, only their
 * delays differ). 0 while the animation is still pending or can't be read.
 */
function typingFor(root: HTMLElement): number {
  const anim = root.querySelector(`.${CSS.escape(s.ch)}`)?.getAnimations?.()[0];
  const start = anim?.startTime;
  const now = anim?.timeline?.currentTime;
  return typeof start === "number" && typeof now === "number" ? Math.max(0, now - start) : 0;
}

export function TypeText({
  as: Tag = "span",
  children,
  className,
  style,
  speed = TYPE_SPEED,
  maxDuration = TYPE_MAX_DURATION,
  delay = 0,
  caret = true,
  blink = true,
  eager = false,
  a11y = "label",
  trigger,
  ...rest
}: Props) {
  const ref = useRef<HTMLElement>(null);
  const [state, setState] = useState<State>(eager ? "play" : "ssr");
  const full = textOf(children).replace(/\s+/g, " ").trim();
  const total = letterCount(children);
  const step = stepFor(total, speed, maxDuration);
  const blinks = caret && blink;

  useEffect(() => {
    const el = ref.current;
    if (!el) return;
    if (window.matchMedia("(prefers-reduced-motion: reduce)").matches) {
      setState("static");
      return;
    }
    // From the typing's start until the caret is gone (blink, or the last letter's fade-in).
    const length = delay + total * step + (blinks ? BLINK_MS : TAIL_MS);
    let doneTimer: ReturnType<typeof setTimeout> | undefined;
    const finishIn = (ms: number) => {
      doneTimer = setTimeout(() => setState("done"), ms);
    };
    if (eager) {
      // Typing since first paint (the server HTML is "play"): only mark the end,
      // counted from when the CSS started rather than from hydration.
      finishIn(Math.max(0, length - typingFor(el)));
      return () => clearTimeout(doneTimer);
    }
    const target = (trigger && el.closest(trigger)) || el;
    // Hydration that lands after the 3 s fallback: letters on screen, or
    // already scrolled past, may have been read - never hide and retype them.
    // Ones still below the fold go back to hidden and type when seen.
    if (performance.now() >= FALLBACK_MS - 100) {
      const ch = el.querySelector(`.${CSS.escape(s.ch)}`);
      if (ch && getComputedStyle(ch).opacity === "1" && target.getBoundingClientRect().top < window.innerHeight) {
        setState("done");
        return;
      }
    }
    const play = () => {
      setState("play");
      finishIn(length);
    };
    if (typeof IntersectionObserver === "undefined") {
      play();
      return () => clearTimeout(doneTimer);
    }
    setState("idle");
    const io = new IntersectionObserver(
      ([e]) => {
        if (e.isIntersecting) {
          io.disconnect();
          play();
        }
      },
      { threshold: 0.35, rootMargin: "0px 0px -8% 0px" },
    );
    io.observe(target);
    return () => {
      io.disconnect();
      clearTimeout(doneTimer);
    };
  }, [blinks, delay, eager, step, total, trigger]);

  // Render: strings become word/letter spans with a running index; elements are
  // cloned with their children transformed the same way.
  let i = 0;
  const transform = (node: ReactNode, keyBase: string): ReactNode => {
    if (node == null || typeof node === "boolean") return node;
    if (typeof node === "string" || typeof node === "number") {
      return tokenize(String(node)).map((t, k) =>
        t.type === "space" ? (
          t.text
        ) : (
          <span key={`${keyBase}-${k}`} className={s.word}>
            {t.chars.map((c) => {
              const idx = i++;
              return (
                <span key={idx} className={idx === total - 1 ? `${s.ch} ${s.last}` : s.ch} style={{ ["--i" as string]: idx }}>
                  {c}
                </span>
              );
            })}
          </span>
        ),
      );
    }
    if (Array.isArray(node)) return node.map((n, k) => transform(n, `${keyBase}.${k}`));
    if (isValidElement(node)) {
      const el = node as ReactElement<{ children?: ReactNode }>;
      if (el.type === "br" || el.props.children == null) return el;
      return cloneElement(el, undefined, transform(el.props.children, `${keyBase}e`));
    }
    return node;
  };

  const nameable = (typeof Tag === "string" && NAMEABLE.test(Tag)) || rest.role != null;
  const a11yProps =
    a11y === "hidden"
      ? { "aria-hidden": true, "aria-label": undefined }
      : nameable
        ? { "aria-label": (rest["aria-label"] as string | undefined) ?? full }
        : {};

  return createElement(
    Tag,
    {
      ...rest,
      ...a11yProps,
      ref,
      className: className ? `${s.root} ${className}` : s.root,
      style: { ...style, ["--step" as string]: `${step}ms`, ["--delay" as string]: `${delay}ms` },
      "data-state": state,
      "data-caret": caret ? "on" : "off",
      "data-blink": blinks ? "on" : "off",
    },
    a11y === "label" && !nameable ? <span className={s.sr}>{full}</span> : null,
    <span aria-hidden="true">{Children.map(children, (c, k) => transform(c, String(k)))}</span>,
  );
}

export default TypeText;
