import type { PromptMode, RecallCard, ReviewGrade } from './types';

export const DAY = 86_400_000;

export function nextMode(mode: PromptMode, hasAudio: boolean): PromptMode {
  if (mode === 'listen') return 'cloze';
  if (mode === 'cloze') return 'speak';
  return hasAudio ? 'listen' : 'cloze';
}

export function scheduleReview(
  card: RecallCard,
  grade: ReviewGrade,
  now = Date.now(),
): RecallCard {
  const current = Math.max(card.intervalDays, 0.25);
  const intervalDays = grade === 'again'
    ? 0.04
    : grade === 'hard'
      ? Math.max(1, current * 1.4)
      : Math.max(card.reviews.length ? 2 : 1, current * 2.3);
  const promptMode = grade === 'again'
    ? card.promptMode
    : nextMode(card.promptMode, Boolean(card.audio));
  const dueAt = now + intervalDays * DAY;

  return {
    ...card,
    dueAt,
    intervalDays,
    promptMode,
    updatedAt: now,
    reviews: [...card.reviews, { at: now, mode: card.promptMode, grade, nextDueAt: dueAt }],
  };
}

export function clozeSentence(sentence: string, word: string): string {
  const escaped = word.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
  return sentence.replace(new RegExp(escaped, 'giu'), '_____');
}

export function isAnswerCorrect(answer: string, word: string): boolean {
  return answer.trim().localeCompare(word.trim(), undefined, { sensitivity: 'accent' }) === 0;
}

export function formatDue(dueAt: number, now = Date.now()): string {
  const delta = dueAt - now;
  if (delta <= 0) return 'Due now';
  const minutes = Math.ceil(delta / 60_000);
  if (minutes < 60) return `In ${minutes} min`;
  const hours = Math.ceil(minutes / 60);
  if (hours < 24) return `In ${hours} hr`;
  const days = Math.ceil(hours / 24);
  return `In ${days} day${days === 1 ? '' : 's'}`;
}
