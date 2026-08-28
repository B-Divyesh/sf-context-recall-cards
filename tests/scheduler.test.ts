import { describe, expect, it } from 'vitest';
import { DAY, clozeSentence, formatDue, isAnswerCorrect, nextMode, scheduleReview } from '../src/scheduler';
import type { RecallCard } from '../src/types';

const card: RecallCard = {
  id: 'one', word: 'último', sentence: 'Perdí el último autobús.', meaning: 'last', language: 'Spanish', source: '',
  createdAt: 1, updatedAt: 1, dueAt: 1, intervalDays: .25, promptMode: 'cloze', reviews: [],
};

describe('recall scheduler', () => {
  it('moves successful prompts through the production sequence', () => {
    expect(nextMode('listen', true)).toBe('cloze');
    expect(nextMode('cloze', true)).toBe('speak');
    expect(nextMode('speak', true)).toBe('listen');
    expect(nextMode('speak', false)).toBe('cloze');
  });

  it('schedules a recalled card later and records its review', () => {
    const reviewed = scheduleReview(card, 'recalled', 10_000);
    expect(reviewed.promptMode).toBe('speak');
    expect(reviewed.dueAt).toBe(10_000 + DAY);
    expect(reviewed.reviews).toHaveLength(1);
    expect(reviewed.reviews[0].grade).toBe('recalled');
  });

  it('keeps an unsuccessful prompt nearby in the same mode', () => {
    const reviewed = scheduleReview(card, 'again', 10_000);
    expect(reviewed.promptMode).toBe('cloze');
    expect(reviewed.dueAt).toBe(10_000 + 10 * 60_000);
  });
});

describe('recall helpers', () => {
  it('clozes every exact phrase without losing punctuation', () => {
    expect(clozeSentence('El último bus, el último.', 'último')).toBe('El _____ bus, el _____.');
  });

  it('checks answers case-insensitively while preserving accents', () => {
    expect(isAnswerCorrect(' ÚLTIMO ', 'último')).toBe(true);
    expect(isAnswerCorrect('ultimo', 'último')).toBe(false);
  });

  it('formats actionable due times', () => {
    expect(formatDue(1_000, 1_000)).toBe('Due now');
    expect(formatDue(DAY, 0)).toBe('In 1 day');
  });
});
