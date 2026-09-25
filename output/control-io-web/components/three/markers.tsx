/**
 * Marker visuals shared by the WebGL pins (drei <Html>) and the static
 * no-WebGL fallback. Plain DOM - importing this never pulls in three.js.
 */
export type MarkerSeverity = "critical" | "late" | "watch";
export type MarkerKind = "delay" | "defect" | "safety";

export const SEV_COLOR: Record<MarkerSeverity, string> = {
  critical: "var(--color-danger)",
  late: "var(--color-accent)",
  watch: "var(--color-accent2)",
};

export const SEV_LABEL: Record<MarkerSeverity, string> = { critical: "Critical", late: "Late", watch: "Watch" };
export const KIND_LABEL: Record<MarkerKind, string> = { delay: "Delay", defect: "Defect", safety: "Safety" };

export function KindIcon({ kind, className = "size-4" }: { kind: MarkerKind; className?: string }) {
  if (kind === "delay")
    return (
      <svg viewBox="0 0 16 16" fill="none" className={className} aria-hidden>
        <circle cx="8" cy="8" r="5.6" stroke="currentColor" strokeWidth="1.6" />
        <path d="M8 5v3.2l2 1.4" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round" />
      </svg>
    );
  if (kind === "defect")
    return (
      <svg viewBox="0 0 16 16" fill="none" className={className} aria-hidden>
        <path d="M8.6 2.2L6.4 6.3l3 1.6-2.6 3.4 1 2.5" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round" />
      </svg>
    );
  return (
    <svg viewBox="0 0 16 16" fill="none" className={className} aria-hidden>
      <path d="M8 2.6l5.6 10H2.4L8 2.6z" stroke="currentColor" strokeWidth="1.6" strokeLinejoin="round" />
      <path d="M8 6.8v2.6M8 11.1v.2" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" />
    </svg>
  );
}

/** The pin itself: a real <button>, severity colour, kind icon, pulsing ring. */
export function MarkerButton({
  id,
  label,
  severity,
  kind,
  selected,
  pulse,
  onSelect,
  className,
  style,
}: {
  id: string;
  label: string;
  severity: MarkerSeverity;
  kind: MarkerKind;
  selected: boolean;
  pulse: boolean;
  onSelect?: (id: string) => void;
  className?: string;
  style?: React.CSSProperties;
}) {
  const color = SEV_COLOR[severity];
  return (
    <button
      type="button"
      aria-label={label}
      aria-pressed={selected}
      data-marker={id}
      // Keep OrbitControls (listening on the canvas wrapper) from capturing
      // the pointer, which would swallow the click.
      onPointerDown={(e) => e.stopPropagation()}
      onClick={() => onSelect?.(id)}
      className={`group grid size-11 cursor-pointer place-items-center rounded-full focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-ink ${className ?? "relative"}`}
      style={style}
    >
      {pulse && (
        <span
          aria-hidden
          className="absolute inset-1 animate-ping rounded-full opacity-50"
          style={{ background: color, animationDuration: selected ? "1.2s" : "2.4s" }}
        />
      )}
      <span
        aria-hidden
        className={`relative grid size-9 place-items-center rounded-full text-white shadow-[0_4px_14px_rgba(28,34,38,.35)] ring-2 transition-transform duration-200 group-hover:scale-110 ${selected ? "scale-110 ring-white" : "ring-white/80"}`}
        style={{ background: color }}
      >
        <KindIcon kind={kind} />
      </span>
      {selected && <span aria-hidden className="absolute -inset-0.5 rounded-full ring-2 ring-ink" />}
    </button>
  );
}
