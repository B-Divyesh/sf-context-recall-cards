import type { ExportBundle, PortableCard, RecallCard } from './types';

const REAL_DB_NAME = 'context-recall-cards';
const DEMO_DB_NAME = 'demo:context-recall-cards';
const STORE = 'cards';
const DB_VERSION = 1;
let dbName = REAL_DB_NAME;

export function useDemoStorage(enabled: boolean): void {
  dbName = enabled ? DEMO_DB_NAME : REAL_DB_NAME;
}

export const storageNames = { real: REAL_DB_NAME, demo: DEMO_DB_NAME } as const;

function openDb(): Promise<IDBDatabase> {
  return new Promise((resolve, reject) => {
    const request = indexedDB.open(dbName, DB_VERSION);
    request.onupgradeneeded = () => {
      const db = request.result;
      if (!db.objectStoreNames.contains(STORE)) {
        const store = db.createObjectStore(STORE, { keyPath: 'id' });
        store.createIndex('dueAt', 'dueAt');
        store.createIndex('updatedAt', 'updatedAt');
      }
    };
    request.onsuccess = () => resolve(request.result);
    request.onerror = () => reject(request.error ?? new Error('Could not open local storage.'));
  });
}

async function transaction<T>(
  mode: IDBTransactionMode,
  work: (store: IDBObjectStore, resolve: (value: T) => void, reject: (reason: unknown) => void) => void,
): Promise<T> {
  const db = await openDb();
  return new Promise((resolve, reject) => {
    const tx = db.transaction(STORE, mode);
    work(tx.objectStore(STORE), resolve, reject);
    tx.onerror = () => reject(tx.error ?? new Error('Local storage operation failed.'));
    tx.oncomplete = () => db.close();
  });
}

export async function getCards(): Promise<RecallCard[]> {
  return transaction('readonly', (store, resolve, reject) => {
    const request = store.getAll();
    request.onsuccess = () => resolve((request.result as unknown[]).filter(isRecallCard).sort((a, b) => a.dueAt - b.dueAt));
    request.onerror = () => reject(request.error);
  });
}

export async function saveCard(card: RecallCard): Promise<void> {
  return transaction('readwrite', (store, resolve, reject) => {
    const request = store.put(card);
    request.onsuccess = () => resolve();
    request.onerror = () => reject(request.error);
  });
}

export async function deleteCard(id: string): Promise<void> {
  return transaction('readwrite', (store, resolve, reject) => {
    const request = store.delete(id);
    request.onsuccess = () => resolve();
    request.onerror = () => reject(request.error);
  });
}

export async function replaceCards(nextCards: RecallCard[]): Promise<void> {
  if (!nextCards.every(isRecallCard)) throw new Error('Demo data is invalid.');
  const db = await openDb();
  return new Promise((resolve, reject) => {
    const tx = db.transaction(STORE, 'readwrite');
    const store = tx.objectStore(STORE);
    store.clear();
    nextCards.forEach((card) => store.put(card));
    tx.oncomplete = () => { db.close(); resolve(); };
    tx.onerror = () => { db.close(); reject(tx.error ?? new Error('Local storage operation failed.')); };
    tx.onabort = () => { db.close(); reject(tx.error ?? new Error('Local storage operation failed.')); };
  });
}

export function deleteDemoStorage(): Promise<void> {
  return new Promise((resolve, reject) => {
    const request = indexedDB.deleteDatabase(DEMO_DB_NAME);
    request.onsuccess = () => resolve();
    request.onerror = () => reject(request.error ?? new Error('Could not reset demo storage.'));
    request.onblocked = () => reject(new Error('Close another demo tab, then reset again.'));
  });
}

function blobToDataUrl(blob: Blob): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(String(reader.result));
    reader.onerror = () => reject(reader.error);
    reader.readAsDataURL(blob);
  });
}

function dataUrlToBlob(dataUrl: string): Blob {
  const [header, encoded] = dataUrl.split(',');
  if (!header || encoded === undefined || !header.startsWith('data:')) throw new Error('Invalid audio data.');
  const mime = header.match(/^data:([^;]+)/)?.[1] ?? 'audio/webm';
  const bytes = Uint8Array.from(atob(encoded), (char) => char.charCodeAt(0));
  return new Blob([bytes], { type: mime });
}

export async function exportCards(cards: RecallCard[]): Promise<ExportBundle> {
  const portable: PortableCard[] = [];
  for (const card of cards) {
    const { audio, ...rest } = card;
    portable.push({ ...rest, audioDataUrl: audio ? await blobToDataUrl(audio) : undefined });
  }
  return { format: 'context-recall-cards', version: 1, exportedAt: new Date().toISOString(), cards: portable };
}

export function parseImport(value: unknown): RecallCard[] {
  const bundle = value as Partial<ExportBundle>;
  if (bundle.format !== 'context-recall-cards' || bundle.version !== 1 || !Array.isArray(bundle.cards)) {
    throw invalidImport();
  }
  const ids = new Set<string>();
  return bundle.cards.map((raw) => {
    if (!isPortableCard(raw) || ids.has(raw.id)) throw invalidImport();
    ids.add(raw.id);
    const { audioDataUrl, ...card } = raw;
    try {
      return { ...card, audio: audioDataUrl ? dataUrlToBlob(audioDataUrl) : undefined };
    } catch {
      throw invalidImport();
    }
  });
}

export async function importCards(incoming: RecallCard[]): Promise<number> {
  if (!incoming.every(isRecallCard) || new Set(incoming.map((card) => card.id)).size !== incoming.length) throw invalidImport();
  const db = await openDb();
  return new Promise((resolve, reject) => {
    const tx = db.transaction(STORE, 'readwrite');
    const store = tx.objectStore(STORE);
    let changed = 0;
    const existingRequest = store.getAll();
    existingRequest.onerror = () => reject(existingRequest.error ?? new Error('Local storage operation failed.'));
    existingRequest.onsuccess = () => {
      const existing = new Map((existingRequest.result as unknown[]).filter(isRecallCard).map((card) => [card.id, card]));
      incoming.forEach((card) => {
        const current = existing.get(card.id);
        if (!current || card.updatedAt > current.updatedAt) {
          store.put(card);
          changed += 1;
        }
      });
    };
    tx.oncomplete = () => { db.close(); resolve(changed); };
    tx.onerror = () => { db.close(); reject(tx.error ?? new Error('Local storage operation failed.')); };
    tx.onabort = () => { db.close(); reject(tx.error ?? new Error('Local storage operation failed.')); };
  });
}

function invalidImport(): Error {
  return new Error('That backup is not a valid Context Recall Cards export. Nothing was imported.');
}

function isPlainObject(value: unknown): value is Record<string, unknown> {
  return Boolean(value) && typeof value === 'object' && !Array.isArray(value);
}

function isFiniteNumber(value: unknown): value is number {
  return typeof value === 'number' && Number.isFinite(value);
}

function isReview(value: unknown): boolean {
  return isPlainObject(value)
    && isFiniteNumber(value.at)
    && isFiniteNumber(value.nextDueAt)
    && ['listen', 'cloze', 'speak'].includes(String(value.mode))
    && ['again', 'hard', 'recalled'].includes(String(value.grade));
}

export function isRecallCard(value: unknown): value is RecallCard {
  return isPlainObject(value)
    && typeof value.id === 'string' && value.id.length > 0
    && typeof value.word === 'string' && value.word.length > 0 && value.word.length <= 80
    && typeof value.sentence === 'string' && value.sentence.length > 0 && value.sentence.length <= 500
    && value.sentence.toLocaleLowerCase().includes(value.word.toLocaleLowerCase())
    && typeof value.meaning === 'string' && value.meaning.length <= 160
    && typeof value.language === 'string' && value.language.length <= 60
    && typeof value.source === 'string' && value.source.length <= 100
    && isFiniteNumber(value.createdAt) && isFiniteNumber(value.updatedAt) && isFiniteNumber(value.dueAt)
    && isFiniteNumber(value.intervalDays) && value.intervalDays >= 0
    && ['listen', 'cloze', 'speak'].includes(String(value.promptMode))
    && Array.isArray(value.reviews) && value.reviews.every(isReview)
    && (value.audio === undefined || value.audio instanceof Blob)
    && (value.audioMime === undefined || typeof value.audioMime === 'string');
}

function isPortableCard(value: unknown): value is PortableCard {
  if (!isPlainObject(value)) return false;
  const { audioDataUrl, ...card } = value;
  return isRecallCard(card) && (audioDataUrl === undefined || typeof audioDataUrl === 'string');
}
