export type PromptMode = 'listen' | 'cloze' | 'speak';
export type ReviewGrade = 'again' | 'hard' | 'recalled';

export interface ReviewEvent {
  at: number;
  mode: PromptMode;
  grade: ReviewGrade;
  nextDueAt: number;
}

export interface RecallCard {
  id: string;
  word: string;
  sentence: string;
  meaning: string;
  language: string;
  source: string;
  createdAt: number;
  updatedAt: number;
  dueAt: number;
  intervalDays: number;
  promptMode: PromptMode;
  reviews: ReviewEvent[];
  audio?: Blob;
  audioMime?: string;
}

export interface PortableCard extends Omit<RecallCard, 'audio'> {
  audioDataUrl?: string;
}

export interface ExportBundle {
  format: 'context-recall-cards';
  version: 1;
  exportedAt: string;
  cards: PortableCard[];
}
