import type { Metadata } from "next";
import { ContactForm } from "@/components/marketing/ContactForm";
import { Container, PageHero } from "@/components/marketing/Container";
import { TypeText } from "@/components/motion/TypeText";
import { Icon } from "@/components/marketing/icons";
import { JsonLd } from "@/components/marketing/JsonLd";
import { Breadcrumbs } from "@/components/ui/primitives";
import { absoluteUrl, breadcrumbLd, site } from "@/lib/content/site";
import { getDictionary, localizePath } from "@/lib/i18n";
import { pageMetadata } from "@/lib/i18n/metadata";
import { readLocale, type LocaleParams } from "@/lib/i18n/params";

export async function generateMetadata({ params }: { params: LocaleParams }): Promise<Metadata> {
  const locale = await readLocale(params);
  const t = getDictionary(locale).meta.contact;
  return pageMetadata({ locale, path: "/contact", title: t.title, description: t.description });
}

export default async function ContactPage({ params }: { params: LocaleParams }) {
  const locale = await readLocale(params);
  const d = getDictionary(locale);
  const t = d.contactPage;
  const L = (p: string) => localizePath(p, locale);
  const crumbs = [
    { name: d.common.home, href: L("/") },
    { name: t.title, href: L("/contact") },
  ];
  const contactLd = {
    "@context": "https://schema.org",
    "@type": "ContactPage",
    inLanguage: locale,
    name: t.ldName,
    url: absoluteUrl(L("/contact")),
    mainEntity: {
      "@id": `${site.url}/#organization`,
      contactPoint: { "@type": "ContactPoint", contactType: "sales", email: site.email, telephone: site.phone, availableLanguage: ["en", "hy", "ru"] },
    },
  };
  return (
    <>
      <PageHero
        crumbs={<Breadcrumbs items={crumbs} label={d.common.breadcrumb} />}
        title={t.title}
        sub={t.sub}
      />
      <section aria-labelledby="form-title" className="section-pad">
        <Container className="grid gap-6 lg:grid-cols-[1.5fr_1fr]">
          <div className="glass p-5 md:p-8">
            <TypeText as="h2" id="form-title" className="font-display text-[24px] font-bold">
              {t.formTitle}
            </TypeText>
            <p className="mt-1 text-[15px] text-muted">{t.required}</p>
            <ContactForm email={site.email} t={d.contactForm} lang={locale} />
          </div>
          <address className="grid content-start gap-3 not-italic">
            <h2 className="eyebrow">{t.direct}</h2>
            {[
              { icon: "mail" as const, label: t.email, value: site.email, href: `mailto:${site.email}` },
              { icon: "phone" as const, label: t.phone, value: site.phone, href: `tel:${site.phone.replace(/\s/g, "")}` },
              { icon: "pin" as const, label: t.office, value: d.site.address },
            ].map((c) => (
              <div key={c.label} className="inner flex items-center gap-4 p-4">
                <span className="grid size-11 shrink-0 place-items-center rounded-[var(--radius-btn)] bg-accent-soft text-accent-deep">
                  <Icon name={c.icon} />
                </span>
                <span>
                  <span className="block text-[13px] text-muted">{c.label}</span>
                  {c.href ? (
                    <a href={c.href} className="font-medium hover:text-accent-deep">{c.value}</a>
                  ) : (
                    <span className="font-medium">{c.value}</span>
                  )}
                </span>
              </div>
            ))}
          </address>
        </Container>
      </section>
      <JsonLd data={[breadcrumbLd(crumbs), contactLd]} />
    </>
  );
}
