import { notFound } from "next/navigation";
import { isLocale, type Locale } from "./config";

export type LocaleParams = Promise<{ locale: string }>;

/** Reads and validates the [locale] segment; unknown values 404. */
export async function readLocale(params: Promise<{ locale: string }>): Promise<Locale> {
  const { locale } = await params;
  if (!isLocale(locale)) notFound();
  return locale;
}

