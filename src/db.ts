import type { ExportBundle, PortableCard, RecallCard } from './types';

const DB_NAME = 'context-recall-cards';
const STORE = 'cards';
const DB_VERSION = 1;

function openDb(): Promise<IDBDatabase> {
  return new Promise((resolve, reject) => {
    const request = indexedDB.open(DB_NAME, DB_VERSION);
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
    request.onsuccess = () => resolve((request.result as RecallCard[]).sort((a, b) => a.dueAt - b.dueAt));
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
    throw new Error('Choose a Context Recall Cards JSON export (version 1).');
  }
  return bundle.cards.map((raw) => {
    if (!raw || typeof raw.id !== 'string' || typeof raw.word !== 'string' || typeof raw.sentence !== 'string') {
      throw new Error('The export contains an invalid card.');
    }
    const { audioDataUrl, ...card } = raw;
    return { ...card, audio: audioDataUrl ? dataUrlToBlob(audioDataUrl) : undefined } as RecallCard;
  });
}

export async function importCards(incoming: RecallCard[]): Promise<number> {
  const existing = new Map((await getCards()).map((card) => [card.id, card]));
  let changed = 0;
  for (const card of incoming) {
    const current = existing.get(card.id);
    if (!current || card.updatedAt > current.updatedAt) {
      await saveCard(card);
      changed += 1;
    }
  }
  return changed;
}
