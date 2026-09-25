import Link from "next/link";
import { Logo } from "@/components/ui/primitives";
import { getIndustries } from "@/lib/content/industries";
import { site } from "@/lib/content/site";
import { getDictionary, localizePath, type Locale } from "@/lib/i18n";
import { Container } from "./Container";
import { Icon } from "./icons";
import { LanguageSwitcher } from "./LanguageSwitcher";
import { SIGN_IN_HREF } from "@/lib/siteMode";

export function Footer({ locale }: { locale: Locale }) {
  const t = getDictionary(locale);
  const L = (p: string) => localizePath(p, locale);
  const footerLinks = [
    { label: t.nav.services, href: "/services" },
    { label: t.nav.pricing, href: "/pricing" },
    { label: t.nav.resources, href: "/resources" },
    { label: t.nav.about, href: "/about" },
    { label: t.nav.contact, href: "/contact" },
  ];
  return (
    <footer className="mt-16 px-3 pb-3 md:mt-24 md:px-6 md:pb-6">
      <div className="stage mx-auto max-w-[1480px]">
        <Container className="grid gap-10 py-12 md:grid-cols-2 md:py-16 lg:grid-cols-[1.4fr_1fr_1.2fr_1.3fr]">
          <div>
            <Logo />
            <p className="mt-4 max-w-[36ch] text-[15px] text-muted">{t.footer.blurb}</p>
            <div className="mt-6 flex items-center gap-3">
              <span className="eyebrow">{t.footer.language}</span>
              <LanguageSwitcher locale={locale} labels={t.language} placement="up" align="left" />
            </div>
          </div>

          <div>
            <h2 className="eyebrow mb-4">{t.footer.quickLinks}</h2>
            <ul className="grid gap-2.5 text-[15px]">
              {footerLinks.map((l) => (
                <li key={l.href}><Link href={L(l.href)} className="hover:text-accent-deep">{l.label}</Link></li>
              ))}
              {SIGN_IN_HREF && <li><Link href={SIGN_IN_HREF} className="hover:text-accent-deep">{t.footer.signIn}</Link></li>}
            </ul>
          </div>

          <div>
            <h2 className="eyebrow mb-4">{t.footer.industries}</h2>
            <ul className="grid gap-2.5 text-[15px]">
              {getIndustries(locale).map((i) => (
                <li key={i.slug}><Link href={L(`/industries/${i.slug}`)} className="hover:text-accent-deep">{i.name}</Link></li>
              ))}
            </ul>
          </div>

          <address className="not-italic">
            <h2 className="eyebrow mb-4">{t.footer.contact}</h2>
            <ul className="grid gap-3 text-[15px]">
              <li className="flex items-center gap-3">
                <Icon name="mail" className="size-[18px] text-accent-deep" />
                <a href={`mailto:${site.email}`} className="hover:text-accent-deep">{site.email}</a>
              </li>
              <li className="flex items-center gap-3">
                <Icon name="phone" className="size-[18px] text-accent-deep" />
                <a href={`tel:${site.phone.replace(/\s/g, "")}`} className="tabular hover:text-accent-deep">{site.phone}</a>
              </li>
              <li className="flex items-center gap-3">
                <Icon name="pin" className="size-[18px] text-accent-deep" />
                <span>{t.site.address}</span>
              </li>
            </ul>
          </address>
        </Container>

        <div className="border-t border-line">
          <Container className="flex flex-col gap-2 py-5 text-[13px] text-muted md:flex-row md:items-center md:justify-between">
            <p>{t.footer.rights}</p>
            <p className="uppercase tracking-[0.06em]">{t.footer.tagline}</p>
          </Container>
        </div>

        <p aria-hidden className="display-xl pointer-events-none select-none px-4 text-center text-[20vw] leading-[0.8] text-white/40 md:text-[16vw] xl:text-[230px]">
          CONTROL
        </p>
      </div>
    </footer>
  );
}
