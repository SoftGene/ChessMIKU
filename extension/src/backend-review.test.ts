import { describe, expect, it, vi } from 'vitest';
import { ANALYSE, type AnalyseAnswer, type AnalyseMessage, type ExplanationsAnswer, type Language, type MoveClassification } from './backend-messages';
import { createBackendReview, type BackendDeps, type CardState, type GameToSend } from './backend-review';

const ID = '3f2b8c1e-5d4a-4e7b-9c61-0a8d2f4b7e19';
const CLASSES = [{ ply: 1, classification: 'book' }];
const game: GameToSend = {
  externalGameId: 'live/1',
  pgn: '1. e4 1-0',
  moves: [{ ply: 1, san: 'e4', uci: 'e2e4', bestMoveUci: 'e2e4', evalBeforeCp: 30, mateBefore: null, evalAfterCp: 30, mateAfter: null }],
};
const accepted = (ready = false): AnalyseAnswer => ({ status: 'accepted', analysisId: ID, classifications: CLASSES, explanationsReady: ready });
const pending: ExplanationsAnswer = { status: 'explanations', state: 'pending', classifications: CLASSES, explanations: [] };
const ready = (text = 'Why.'): ExplanationsAnswer => ({ status: 'explanations', state: 'ready', classifications: CLASSES, explanations: [{ ply: 1, text }] });

// A backend whose answers come in the given order (then pending), and a clock that moves only by waiting.
function setup(analyseAnswers: AnalyseAnswer[], explanationAnswers: (ExplanationsAnswer | Promise<ExplanationsAnswer>)[], language: Language = 'ru') {
  let clock = 0;
  const waits: number[] = [];
  const sent: AnalyseMessage[] = [];
  const asked: string[] = [];
  const cards: CardState[] = [];
  const classes: MoveClassification[][] = [];
  const deps: BackendDeps = {
    analyse: async (message) => {
      sent.push(message);
      return analyseAnswers.shift() ?? { status: 'unreachable' };
    },
    explanations: async (message) => {
      asked.push(message.analysisId);
      return explanationAnswers.shift() ?? pending;
    },
    wait: async (ms) => {
      waits.push(ms);
      clock += ms;
    },
    now: () => clock,
  };
  const review = createBackendReview(deps, { classes: (list) => classes.push(list), card: (state) => cards.push(state) }, language);
  return { review, waits, sent, asked, cards, classes };
}

const kinds = (cards: CardState[]) => cards.map((card) => card.kind);

describe('the backend review', () => {
  it('sends the game, shows the classes and asks until the explanations are ready', async () => {
    const { review, waits, sent, cards, classes } = setup([accepted()], [pending, ready()]);

    await review.start(game);

    expect(sent).toEqual([{ type: ANALYSE, ...game, language: 'ru' }]);
    expect(classes).toEqual([CLASSES]);
    expect(kinds(cards)).toEqual(['asking', 'writing', 'writing', 'ready']);
    expect(cards.at(-1)).toEqual({ kind: 'ready', explanations: [{ ply: 1, text: 'Why.' }] });
    expect(waits).toEqual([3000, 3000]);
  });

  it('tells how long it has waited for the explanations', async () => {
    const { review, cards } = setup([accepted()], [pending, pending, ready()]);

    await review.start(game);

    expect(cards.filter((card) => card.kind === 'writing')).toEqual([
      { kind: 'writing', waitedSeconds: 0 },
      { kind: 'writing', waitedSeconds: 3 },
      { kind: 'writing', waitedSeconds: 6 },
    ]);
  });

  it('asks at once when the explanations are ready already', async () => {
    const { review, waits, cards } = setup([accepted(true)], [ready()]);

    await review.start(game);

    expect(waits).toEqual([0]);
    expect(kinds(cards)).toEqual(['asking', 'writing', 'ready']);
  });

  it('asks every 3 s for half a minute, then every 10 s, and stops after 5 minutes', async () => {
    const { review, waits, asked, cards } = setup([accepted()], []);

    await review.start(game);

    expect(waits).toEqual([...Array(10).fill(3000), ...Array(27).fill(10_000)]);
    expect(asked).toHaveLength(37);
    expect(cards.at(-1)).toEqual({ kind: 'timeout' });
  });

  it('says the explanations could not be written', async () => {
    const { review, cards } = setup([accepted()], [pending, { ...pending, state: 'failed' }]);

    await review.start(game);

    expect(cards.at(-1)).toEqual({ kind: 'failed' });
  });

  it('says the quota is used up, and asks nothing more', async () => {
    const { review, cards, asked, classes } = setup([{ status: 'quota', retryAfterSeconds: 18_000 }], []);

    await review.start(game);

    expect(cards).toEqual([{ kind: 'asking' }, { kind: 'quota', retryAfterSeconds: 18_000 }]);
    expect(asked).toEqual([]);
    expect(classes).toEqual([]);
  });

  it('says the server is not reachable', async () => {
    const { review, cards } = setup([{ status: 'unreachable' }], []);

    await review.start(game);

    expect(cards).toEqual([{ kind: 'asking' }, { kind: 'unreachable' }]);
  });

  it('waits out a short busy and sends again', async () => {
    const { review, waits, sent, cards } = setup([{ status: 'busy', retryAfterSeconds: 5 }, accepted(true)], [ready()]);

    await review.start(game);

    expect(sent).toHaveLength(2);
    expect(waits).toEqual([5000, 0]);
    expect(kinds(cards)).toEqual(['asking', 'writing', 'ready']);
  });

  it('says the server is busy when the wait is long', async () => {
    const { review, sent, cards } = setup([{ status: 'busy', retryAfterSeconds: 40 }], []);

    await review.start(game);

    expect(sent).toHaveLength(1);
    expect(cards.at(-1)).toEqual({ kind: 'busy', retryAfterSeconds: 40 });
  });

  it('says the game was rejected, and logs why', async () => {
    const warn = vi.spyOn(console, 'warn').mockImplementation(() => undefined);
    const { review, cards } = setup([{ status: 'rejected', detail: 'pgn: The game is not finished.' }], []);

    await review.start(game);

    expect(cards.at(-1)).toEqual({ kind: 'rejected' });
    expect(warn).toHaveBeenCalledWith('Chess Review: the server rejected the game:', 'pgn: The game is not finished.');
    warn.mockRestore();
  });

  it('waits as long as a busy server asks while it polls', async () => {
    const { review, waits } = setup([accepted()], [{ status: 'busy', retryAfterSeconds: 20 }, ready()]);

    await review.start(game);

    expect(waits).toEqual([3000, 20_000]);
  });

  it('keeps asking when the server is away for a while', async () => {
    const { review, waits, cards } = setup([accepted()], [{ status: 'unreachable' }, ready()]);

    await review.start(game);

    expect(waits).toEqual([3000, 3000]);
    expect(cards.at(-1)?.kind).toBe('ready');
  });

  it('sends again in a new language, and drops what comes for the old one', async () => {
    let release!: (answer: ExplanationsAnswer) => void;
    const late = new Promise<ExplanationsAnswer>((resolve) => (release = resolve));
    const { review, sent, cards } = setup([accepted(), accepted(true)], [late, ready('Proč.')]);

    const first = review.start(game);
    await new Promise((resolve) => setTimeout(resolve, 0));
    const second = review.setLanguage('cs');
    release(ready('Почему.'));
    await Promise.all([first, second]);

    expect(sent.map((message) => message.language)).toEqual(['ru', 'cs']);
    expect(cards.filter((card) => card.kind === 'ready')).toEqual([{ kind: 'ready', explanations: [{ ply: 1, text: 'Proč.' }] }]);
  });

  it('only remembers a language chosen before the game is sent', async () => {
    const { review, sent } = setup([accepted(true)], [ready()]);

    await review.setLanguage('en');
    expect(sent).toEqual([]);
    await review.start(game);

    expect(sent.map((message) => message.language)).toEqual(['en']);
  });

  it('sends nothing when the language does not change', async () => {
    const { review, sent } = setup([accepted(true)], [ready()]);

    await review.start(game);
    await review.setLanguage('ru');

    expect(sent).toHaveLength(1);
  });
});
