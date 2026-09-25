import type { Locale } from "./config";
import { en, type Dictionary } from "./dictionaries/en";
import { hy } from "./dictionaries/hy";
import { ru } from "./dictionaries/ru";

export type { Dictionary } from "./dictionaries/en";
export * from "./config";

const dictionaries: Record<Locale, Dictionary> = { en, hy, ru };

export function getDictionary(locale: Locale): Dictionary {
  return dictionaries[locale];
}
