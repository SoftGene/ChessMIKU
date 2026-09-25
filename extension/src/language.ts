import { isLanguage, type Language } from './backend-messages';

const KEY = 'chess-review.language';

/** The first of the browser's languages the explanations come in ("ru-RU" is "ru"); else English. */
export function defaultLanguage(preferred: readonly string[]): Language {
  for (const tag of preferred) {
    const base = tag.toLowerCase().split('-')[0];
    if (isLanguage(base)) {
      return base;
    }
  }
  return 'en';
}

/** The language chosen in the window before, or the browser's. */
export function readLanguage(preferred: readonly string[], storage: Pick<Storage, 'getItem'> | undefined = globalThis.localStorage): Language {
  try {
    const saved = storage?.getItem(KEY);
    if (isLanguage(saved)) {
      return saved;
    }
  } catch {
    // Blocked storage: the browser's language.
  }
  return defaultLanguage(preferred);
}

export function writeLanguage(language: Language, storage: Pick<Storage, 'setItem'> | undefined = globalThis.localStorage): void {
  try {
    storage?.setItem(KEY, language);
  } catch {
    // Blocked storage: the choice holds for this window only.
  }
}
