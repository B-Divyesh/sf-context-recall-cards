import { describe, expect, it } from 'vitest';
import { parseImport } from '../src/db';

const validCard = {
  id: 'card-1',
  word: 'último',
  sentence: 'Perdí el último autobús.',
  meaning: 'last',
  language: 'Spanish',
  source: 'home',
  createdAt: 1,
  updatedAt: 2,
  dueAt: 3,
  intervalDays: 0.25,
  promptMode: 'cloze',
  reviews: [],
};

describe('backup import validation', () => {
  it('accepts a complete version 1 export', () => {
    expect(parseImport({ format: 'context-recall-cards', version: 1, cards: [validCard] })).toMatchObject([validCard]);
  });

  it('rejects partial cards before any persistence can begin', () => {
    expect(() => parseImport({
      format: 'context-recall-cards', version: 1,
      cards: [{ id: 'bad', word: 'hola', sentence: 'hola' }],
    })).toThrow('Nothing was imported');
  });

  it('rejects malformed audio and duplicate identities atomically', () => {
    expect(() => parseImport({
      format: 'context-recall-cards', version: 1,
      cards: [{ ...validCard, audioDataUrl: 'not-a-data-url' }, validCard],
    })).toThrow('Nothing was imported');
  });
});
