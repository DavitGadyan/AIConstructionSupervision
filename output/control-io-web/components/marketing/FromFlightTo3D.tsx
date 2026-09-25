import { TypeText } from "@/components/motion/TypeText";
import { getDictionary, type Locale } from "@/lib/i18n";
import { Container } from "./Container";
import { FlightExplainer } from "./FlightExplainer";
import { VideoDialogTrigger } from "./VideoDialog";

/** "From drone flight to 3D model": how every 3D view on the site is made from one drone flight. */
export function FromFlightTo3D({ locale }: { locale: Locale }) {
  const t = getDictionary(locale).home.flightTo3d;
  return (
    <section id="from-flight" aria-labelledby="from-flight-title" className="scroll-mt-6 pt-16 md:pt-24">
      <Container>
        <div className="mb-8 grid gap-6 md:mb-12 md:grid-cols-[1.1fr_1fr] md:items-end">
          <div>
            <p className="eyebrow mb-3">{t.eyebrow}</p>
            <h2 id="from-flight-title" aria-label={`${t.titleLine1} ${t.titleLine2}`} className="font-bold tracking-tight" style={{ fontSize: "var(--size-h1)" }}>
              <TypeText as="span" a11y="hidden" className="block">{t.titleLine1}</TypeText>
              <TypeText as="span" a11y="hidden" className="block">{t.titleLine2}</TypeText>
            </h2>
          </div>
          <div className="md:justify-self-end">
            <p className="max-w-[52ch] text-[17px] text-muted">{t.intro}</p>
            <div className="mt-5 flex flex-wrap gap-2">
              <VideoDialogTrigger
                href="/videos/drone-orbit.mp4"
                labels={{ title: t.videoTitle, close: t.close }}
                className="inline-flex items-center gap-2 rounded-[var(--radius-btn)] bg-ink px-5 py-3 text-[15px] font-medium text-white transition hover:bg-black"
              >
                <svg viewBox="0 0 16 16" className="size-4" aria-hidden fill="currentColor">
                  <path d="M5 3.5v9l7.5-4.5z" />
                </svg>
                {t.watch}
              </VideoDialogTrigger>
              <a href="#explorer" className="inline-flex items-center gap-2 rounded-[var(--radius-btn)] bg-surface px-5 py-3 text-[15px] font-medium text-ink shadow-[var(--shadow-inner)] transition hover:-translate-y-0.5">
                {t.explore}
              </a>
            </div>
          </div>
        </div>
        <FlightExplainer t={t} />
      </Container>
    </section>
  );
}
