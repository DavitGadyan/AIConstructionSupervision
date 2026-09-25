import { TypeText } from "@/components/motion/TypeText";
import { GlassCard, Pill } from "@/components/ui/primitives";
import { Icon } from "./icons";

/**
 * ORDI TaskTable anatomy as an FAQ: header row, then white rows that expand.
 * Native <details> so it works without JavaScript and is keyboard-operable.
 */
export function FaqTable({
  items,
  title = "Frequently asked questions",
  subtitle,
  headingLevel = "h2",
  id,
  labels = { question: "Question", topic: "Topic" },
}: {
  labels?: { question: string; topic: string };
  items: { q: string; a: string; topic?: string }[];
  title?: string;
  subtitle?: string;
  headingLevel?: "h2" | "h3";
  id?: string;
}) {
  const hasTopic = items.some((i) => i.topic);
  return (
    <GlassCard as="div">
      <div className="mb-4">
        <TypeText as={headingLevel} id={id} className="font-display text-[22px] font-bold md:text-[26px]">
          {title}
        </TypeText>
        {subtitle && <p className="mt-1 text-[14px] text-muted">{subtitle}</p>}
      </div>
      <div className="hidden grid-cols-[1fr_120px_40px] gap-4 px-4 pb-3 text-[14px] font-medium text-ink/80 md:grid" aria-hidden>
        <span>{labels.question}</span>
        <span>{hasTopic ? labels.topic : ""}</span>
        <span />
      </div>
      <div className="grid gap-2">
        {items.map((f) => (
          <details key={f.q} className="inner group rounded-[12px] [&_summary::-webkit-details-marker]:hidden">
            <summary className="grid cursor-pointer list-none grid-cols-[1fr_40px] items-center gap-4 rounded-[12px] px-4 py-3.5 md:grid-cols-[1fr_120px_40px]">
              <span className="font-medium">{f.q}</span>
              <span className="hidden md:block">{f.topic && <Pill tone="light">{f.topic}</Pill>}</span>
              <span className="grid size-8 place-items-center justify-self-end rounded-[10px] bg-page transition group-open:rotate-180">
                <Icon name="chevron" className="size-4" />
              </span>
            </summary>
            <p className="px-4 pb-4 text-[15px] text-muted md:pr-[180px]">{f.a}</p>
          </details>
        ))}
      </div>
    </GlassCard>
  );
}
