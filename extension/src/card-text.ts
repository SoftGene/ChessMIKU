import type { Language } from './backend-messages';
import type { CardState } from './backend-review';

interface Texts {
  title: string;
  noMistakes: string;
  waitingEngine: string;
  noEngine: string;
  asking: string;
  writing: string;
  unreachable: string;
  quota(hours: number | null): string;
  busy(seconds: number): string;
  rejected: string;
  failed: string;
  timeout: string;
  classes: Record<string, string>;
}

// The card speaks the language of the explanations (design T7.3, section 7); the rest of the window is English.
const TEXTS: Record<Language, Texts> = {
  ru: {
    title: 'Ключевые моменты',
    noMistakes: 'В партии нет ошибок — объяснять нечего.',
    waitingEngine: 'Классы ходов и объяснения появятся, когда движок досчитает партию.',
    noEngine: 'Движок не запустился — без его оценок классов ходов и объяснений нет.',
    asking: 'Спрашиваем сервер…',
    writing: 'Пишем объяснения ключевых моментов…',
    unreachable: 'Сервер недоступен: классов ходов и объяснений в этот раз нет. Разбор движком работает.',
    quota: (hours) =>
      `Разборы с объяснениями на сегодня кончились. Обновятся в 00:00 UTC, ${hours === null ? 'меньше чем через час' : `примерно через ${hours} ч`}. Разбор движком работает.`,
    busy: (seconds) => `Сервер занят. Попробуйте через ${seconds} с.`,
    rejected: 'Сервер не принял эту партию, поэтому классов ходов и объяснений нет.',
    failed: 'Объяснения в этот раз не получились. Откройте разбор позже — попробуем снова.',
    timeout: 'Объяснения ещё пишутся. Откройте разбор позже.',
    classes: {
      best: 'лучший',
      excellent: 'отличный',
      good: 'хороший',
      book: 'книжный',
      inaccuracy: 'неточность',
      mistake: 'ошибка',
      miss: 'упущенная возможность',
      blunder: 'зевок',
    },
  },
  cs: {
    title: 'Klíčové momenty',
    noMistakes: 'V partii nejsou chyby — není co vysvětlovat.',
    waitingEngine: 'Hodnocení tahů a vysvětlení se objeví, až engine partii dopočítá.',
    noEngine: 'Engine se nespustil — bez jeho hodnocení nejsou hodnocení tahů ani vysvětlení.',
    asking: 'Ptáme se serveru…',
    writing: 'Píšeme vysvětlení klíčových momentů…',
    unreachable: 'Server není dostupný: hodnocení tahů a vysvětlení tentokrát nejsou. Rozbor enginem funguje.',
    quota: (hours) =>
      `Rozbory s vysvětlením na dnešek došly. Obnoví se v 00:00 UTC, ${hours === null ? 'za méně než hodinu' : `zhruba za ${hours} h`}. Rozbor enginem funguje.`,
    busy: (seconds) => `Server je vytížený. Zkuste to za ${seconds} s.`,
    rejected: 'Server tuto partii nepřijal, proto hodnocení tahů a vysvětlení nejsou.',
    failed: 'Vysvětlení se tentokrát nepovedla. Otevřete rozbor později — zkusíme to znovu.',
    timeout: 'Vysvětlení se ještě píšou. Otevřete rozbor později.',
    classes: {
      best: 'nejlepší',
      excellent: 'výborný',
      good: 'dobrý',
      book: 'teorie',
      inaccuracy: 'nepřesnost',
      mistake: 'chyba',
      miss: 'promarněná šance',
      blunder: 'hrubá chyba',
    },
  },
  en: {
    title: 'Key moments',
    noMistakes: 'No mistakes in this game — nothing to explain.',
    waitingEngine: 'Move classes and explanations come once the engine finishes.',
    noEngine: 'The engine did not start — without its evaluations there are no move classes or explanations.',
    asking: 'Asking the server…',
    writing: 'Writing explanations of the key moments…',
    unreachable: 'The server is not reachable: no move classes or explanations this time. The engine review works.',
    quota: (hours) =>
      `Today's reviews with explanations are used up. They renew at 00:00 UTC, ${hours === null ? 'in less than an hour' : `in about ${hours} h`}. The engine review works.`,
    busy: (seconds) => `The server is busy. Try again in ${seconds} s.`,
    rejected: 'The server did not accept this game, so there are no move classes or explanations.',
    failed: 'The explanations could not be written this time. Open the review later to try again.',
    timeout: 'The explanations are still being written. Open the review later.',
    classes: {
      best: 'best',
      excellent: 'excellent',
      good: 'good',
      book: 'book',
      inaccuracy: 'inaccuracy',
      mistake: 'mistake',
      miss: 'miss',
      blunder: 'blunder',
    },
  },
};

export const cardTitle = (language: Language) => TEXTS[language].title;
export const noMistakesText = (language: Language) => TEXTS[language].noMistakes;

/** The name of a class in the language of the explanations; a class we do not know keeps the contract's word. */
export const className = (language: Language, cls: string) => (Object.hasOwn(TEXTS[language].classes, cls) ? TEXTS[language].classes[cls] : cls);

/** The line the card shows while it has no explanations to show. */
export function cardMessage(language: Language, state: Exclude<CardState, { kind: 'ready' }>): string {
  const texts = TEXTS[language];
  switch (state.kind) {
    case 'waiting-engine':
      return texts.waitingEngine;
    case 'no-engine':
      return texts.noEngine;
    case 'asking':
      return texts.asking;
    case 'writing':
      return texts.writing;
    case 'unreachable':
      return texts.unreachable;
    case 'quota':
      // Retry-After is the time to 00:00 UTC.
      return texts.quota(state.retryAfterSeconds < 3600 ? null : Math.ceil(state.retryAfterSeconds / 3600));
    case 'busy':
      return texts.busy(state.retryAfterSeconds);
    case 'rejected':
      return texts.rejected;
    case 'failed':
      return texts.failed;
    case 'timeout':
      return texts.timeout;
  }
}
