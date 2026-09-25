import type { Metadata } from "next";
import { PageHero } from "@/components/marketing/Container";
import { CtaCard, IndustriesGrid } from "@/components/marketing/HomeSections";
import { JsonLd } from "@/components/marketing/JsonLd";
import { Breadcrumbs } from "@/components/ui/primitives";
import { breadcrumbLd } from "@/lib/content/site";
import { getDictionary, localizePath } from "@/lib/i18n";
import { pageMetadata } from "@/lib/i18n/metadata";
import { readLocale, type LocaleParams } from "@/lib/i18n/params";

export async function generateMetadata({ params }: { params: LocaleParams }): Promise<Metadata> {
  const locale = await readLocale(params);
  const t = getDictionary(locale).meta.industries;
  return pageMetadata({ locale, path: "/industries", title: t.title, description: t.description });
}

export default async function IndustriesPage({ params }: { params: LocaleParams }) {
  const locale = await readLocale(params);
  const t = getDictionary(locale);
  const crumbs = [
    { name: t.common.home, href: localizePath("/", locale) },
    { name: t.industriesPage.title, href: localizePath("/industries", locale) },
  ];
  return (
    <>
      <PageHero crumbs={<Breadcrumbs items={crumbs} label={t.common.breadcrumb} />} title={t.industriesPage.title} sub={t.industriesPage.sub} />
      <IndustriesGrid locale={locale} headingLevel="none" />
      <CtaCard locale={locale} />
      <JsonLd data={breadcrumbLd(crumbs)} />
    </>
  );
}
