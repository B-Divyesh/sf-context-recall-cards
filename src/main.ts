import './style.css';
import { checkoutUrl, captureLicenseFromUrl, clearLicense, getLicense, isUnlocked, saveLicense, verifyLicense } from './billing';
import { deleteCard, exportCards, getCards, importCards, parseImport, saveCard } from './db';
import { clozeSentence, formatDue, isAnswerCorrect, scheduleReview } from './scheduler';
import type { PromptMode, RecallCard, ReviewGrade } from './types';

type View = 'today' | 'add' | 'library' | 'ownership';

const FREE_CARD_LIMIT = 25;
const FREE_RECORDING_LIMIT = 5;
const app = document.querySelector<HTMLDivElement>('#app')!;

let cards: RecallCard[] = [];
let view: View = 'today';
let activeReviewId = '';
let reviewRevealed = false;
let clozeResult: 'correct' | 'incorrect' | '' = '';
let addRecording: Blob | undefined;
let addRecordingMime = '';
let recorder: MediaRecorder | undefined;
let recordingStartedAt = 0;
let recordingTimer = 0;
let installPrompt: BeforeInstallPromptEvent | undefined;
let transientMessage = '';
let objectUrls: string[] = [];

interface BeforeInstallPromptEvent extends Event {
  prompt(): Promise<void>;
  userChoice: Promise<{ outcome: 'accepted' | 'dismissed' }>;
}

const icon = (name: 'flame' | 'today' | 'add' | 'library' | 'own' | 'mic' | 'play' | 'download' | 'upload') => {
  const paths: Record<typeof name, string> = {
    flame: '<path d="M12 2c1.2 3.9-.8 5.4-2 7.2-1.2 1.8-1 4.3.9 5.4-.1-2.2 1.3-3.5 2.7-4.9.2 2.7 2.7 3.9 2.4 7A4.2 4.2 0 0 1 12 21a5.8 5.8 0 0 1-5.8-5.9C6.2 10 10.6 8.2 12 2Z"/>',
    today: '<path d="M5 4h14v16H5zM8 2v4m8-4v4M5 9h14"/>',
    add: '<path d="M12 5v14M5 12h14"/>',
    library: '<path d="M4 5.5 9 4v15.5L4 21zm5-1.5 6 2v15l-6-1.5zm6 2 5-1.5v15L15 21z"/>',
    own: '<path d="M6 4h12v16H6zM9 8h6m-6 4h6m-6 4h4"/>',
    mic: '<rect x="9" y="3" width="6" height="12" rx="3"/><path d="M5 11a7 7 0 0 0 14 0m-7 7v3m-4 0h8"/>',
    play: '<path d="m8 5 11 7-11 7Z"/>',
    download: '<path d="M12 3v12m-5-5 5 5 5-5M5 21h14"/>',
    upload: '<path d="M12 17V5m-5 5 5-5 5 5M5 21h14"/>',
  };
  return `<svg aria-hidden="true" viewBox="0 0 24 24">${paths[name]}</svg>`;
};

function esc(value: string): string {
  return value.replace(/[&<>'"]/g, (char) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', "'": '&#39;', '"': '&quot;' })[char] ?? char);
}

function releaseObjectUrls(): void {
  objectUrls.forEach((url) => URL.revokeObjectURL(url));
  objectUrls = [];
}

function audioUrl(blob?: Blob): string {
  if (!blob) return '';
  const url = URL.createObjectURL(blob);
  objectUrls.push(url);
  return url;
}

function routeFromHash(): { view: View; editId?: string } {
  const hash = location.hash.slice(1) || 'today';
  const [path, query = ''] = hash.split('?');
  const parsed: View = ['today', 'add', 'library', 'ownership'].includes(path) ? path as View : 'today';
  return { view: parsed, editId: new URLSearchParams(query).get('edit') ?? undefined };
}

function navLink(target: View, label: string, navIcon: 'today' | 'add' | 'library' | 'own'): string {
  const selected = view === target;
  return `<a href="#${target}" class="nav-link" ${selected ? 'aria-current="page"' : ''}>${icon(navIcon)}<span>${label}</span></a>`;
}

function shell(content: string): void {
  releaseObjectUrls();
  const dueCount = cards.filter((card) => card.dueAt <= Date.now()).length;
  app.innerHTML = `
    <div class="app-shell">
      <header class="topbar">
        <a class="brand" href="#today" aria-label="Context Recall Cards home">${icon('flame')}<h1><span>Context</span> Recall</h1></a>
        <div class="status-cluster">
          <span class="connection-status" data-online><span></span>${navigator.onLine ? 'On device' : 'Offline · still ready'}</span>
          <button class="button quiet install-button" data-install hidden>Install app</button>
        </div>
      </header>
      <nav class="side-nav" aria-label="Primary">
        <div class="nav-intro"><span>Your field notes</span><strong>${cards.length} context${cards.length === 1 ? '' : 's'}</strong></div>
        ${navLink('today', dueCount ? `Today · ${dueCount}` : 'Today', 'today')}
        ${navLink('add', 'Add context', 'add')}
        ${navLink('library', 'Library', 'library')}
        ${navLink('ownership', 'Ownership', 'own')}
      </nav>
      <main id="main" tabindex="-1">${transientMessage ? `<div class="toast" role="status">${esc(transientMessage)}</div>` : ''}${content}</main>
      <footer>
        <span>Private by default. Made for the words only you meet.</span>
        <span><a href="/privacy/">Privacy</a> · <a href="/terms/">Terms</a> · Hero art generated for this product.</span>
      </footer>
    </div>`;
  const installButton = document.querySelector<HTMLButtonElement>('[data-install]');
  if (installPrompt && installButton) installButton.hidden = false;
}

function modeLabel(mode: PromptMode): string {
  return ({ listen: 'Listen', cloze: 'Cloze', speak: 'Speak' })[mode];
}

function renderToday(): void {
  const due = cards.filter((card) => card.dueAt <= Date.now());
  if (activeReviewId) {
    const card = cards.find((item) => item.id === activeReviewId);
    if (card) {
      renderPractice(card, due.indexOf(card) + 1, due.length);
      return;
    }
  }
  if (!cards.length) {
    shell(`
      <section class="hero" aria-labelledby="welcome-title">
        <picture class="hero-art">
          <source media="(max-width: 600px)" srcset="/assets/recall-room-640.webp" type="image/webp">
          <img src="/assets/recall-room-1280.webp" width="1280" height="853" alt="A quiet rain-lit conservatory desk with a blank notebook and voice recorder" fetchpriority="high" decoding="async">
        </picture>
        <div class="hero-copy">
          <p class="eyebrow">Recall from real life</p>
          <h2 id="welcome-title">Give a word somewhere to live.</h2>
          <p>Write the sentence where you found it. Add your voice if you like. We’ll bring it back as a short listen, cloze, and speak prompt.</p>
          <div class="button-row"><a class="button primary" href="#add">Add your first context</a><a class="button quiet" href="#ownership">How it stays private</a></div>
          <ul class="hero-facts" aria-label="Product features"><li>Works offline</li><li>No account</li><li>Your recordings stay here</li></ul>
        </div>
      </section>`);
    return;
  }
  const next = cards.find((card) => card.dueAt > Date.now());
  shell(`
    <section class="page-heading">
      <div><p class="eyebrow">Today’s return</p><h2>${due.length ? `${due.length} context${due.length === 1 ? '' : 's'} ready` : 'The room is quiet'}</h2></div>
      <p>${due.length ? 'One prompt at a time. Say it before you reveal it.' : next ? `Next context ${formatDue(next.dueAt).toLowerCase()}.` : 'Add another word whenever you meet one.'}</p>
    </section>
    ${due.length ? `
      <section class="today-stage">
        <div class="mode-track" aria-label="Practice sequence"><span>Listen</span><span>Cloze</span><span>Speak</span></div>
        <article class="due-preview">
          <div><p class="card-kicker">Up next · ${modeLabel(due[0].promptMode)}</p><h3>${esc(due[0].word)}</h3><p>${esc(due[0].meaning || due[0].language || 'Your context')}</p></div>
          <button class="button primary" data-start-review="${esc(due[0].id)}">Begin recall</button>
        </article>
        <p class="session-note">About ${Math.max(1, due.length * 2)} min · progress saves after every card</p>
      </section>` : `
      <section class="rest-state">
        <div class="rest-orbit" aria-hidden="true">${icon('flame')}</div>
        <h3>Nothing is due.</h3><p>Spacing does its work in the quiet. Your contexts are saved on this device.</p>
        <a class="button primary" href="#add">Capture another word</a>
      </section>`}
    ${renderRecent()}`);
}

function renderRecent(): string {
  const recent = [...cards].sort((a, b) => b.updatedAt - a.updatedAt).slice(0, 4);
  if (!recent.length) return '';
  return `<section class="recent-section"><div class="section-title"><h3>Recently visited</h3><a href="#library">See library</a></div><ul class="recent-list">${recent.map((card) => `<li><span class="word-mark">${esc(card.word.slice(0, 1).toUpperCase())}</span><div><strong>${esc(card.word)}</strong><span>${esc(card.sentence)}</span></div><span class="due-label">${formatDue(card.dueAt)}</span></li>`).join('')}</ul></section>`;
}

function renderPractice(card: RecallCard, position: number, total: number): void {
  const hasAudio = Boolean(card.audio);
  const revealed = reviewRevealed || clozeResult === 'correct';
  let prompt = '';
  if (card.promptMode === 'listen') {
    prompt = hasAudio
      ? `<p class="prompt-instruction">Listen to your earlier voice. Which word belongs to this context?</p><button class="record-disc" data-play-card aria-label="Play your recording">${icon('play')}<span>Play recording</span></button>`
      : `<p class="prompt-instruction">Picture the moment. Which word did you save?</p>`;
  } else if (card.promptMode === 'cloze') {
    prompt = `<p class="prompt-instruction">Fill the missing word.</p><blockquote lang="${esc(card.language || 'und')}">${esc(clozeSentence(card.sentence, card.word))}</blockquote><form class="cloze-form" data-cloze><label for="cloze-answer">Your answer</label><div><input id="cloze-answer" name="answer" autocomplete="off" autocapitalize="off"><button class="button secondary" type="submit">Check</button></div>${clozeResult ? `<p class="answer-result ${clozeResult}" role="status">${clozeResult === 'correct' ? 'That’s it.' : `Not yet. Try once more, or reveal the context.`}</p>` : ''}</form>`;
  } else {
    prompt = `<p class="prompt-instruction">Say the word, then the whole sentence, before you reveal it.</p><div class="speak-stage">${icon('mic')}<p>No score, no judgement—listen to yourself and decide.</p><button class="button secondary" data-attempt-record>Record an attempt</button><div data-attempt-result></div></div>`;
  }
  const source = card.source ? `<span>Found in ${esc(card.source)}</span>` : '';
  shell(`
    <section class="practice-page" aria-labelledby="practice-title">
      <div class="practice-topline"><button class="text-button" data-exit-review>← Leave session</button><span>${Math.max(position, 1)} of ${Math.max(total, 1)}</span></div>
      <div class="mode-track active-${card.promptMode}" aria-label="Current prompt: ${modeLabel(card.promptMode)}"><span>Listen</span><span>Cloze</span><span>Speak</span></div>
      <article class="practice-paper">
        <p class="eyebrow">${modeLabel(card.promptMode)} recall</p>
        <h2 id="practice-title" class="visually-hidden">Recall ${esc(card.word)}</h2>
        ${prompt}
        <div class="context-reveal ${revealed ? 'is-revealed' : ''}">
          ${revealed ? `<p class="revealed-word">${esc(card.word)}</p><blockquote lang="${esc(card.language || 'und')}">${esc(card.sentence)}</blockquote>${card.meaning ? `<p>${esc(card.meaning)}</p>` : ''}<div class="context-meta">${source}<span>${esc(card.language || 'Language not set')}</span></div>` : `<button class="button quiet-on-paper" data-reveal>Reveal original context</button>`}
        </div>
      </article>
      ${revealed ? `<fieldset class="grade-row"><legend>How did retrieval feel?</legend><button data-grade="again">Again <small>10 min</small></button><button data-grade="hard">Needed a hint <small>1+ day</small></button><button data-grade="recalled" class="grade-primary">Recalled it <small>Next stage</small></button></fieldset>` : ''}
    </section>`);
  if (card.audio) {
    document.querySelector('[data-play-card]')?.addEventListener('click', () => {
      void new Audio(audioUrl(card.audio)).play();
    });
  }
  queueMicrotask(() => document.querySelector<HTMLInputElement>('#cloze-answer')?.focus());
}

function getEditCard(): RecallCard | undefined {
  const { editId } = routeFromHash();
  return cards.find((card) => card.id === editId);
}

function renderAdd(): void {
  const editing = getEditCard();
  if (editing?.audio && !addRecording) {
    addRecording = editing.audio;
    addRecordingMime = editing.audioMime ?? editing.audio.type;
  }
  const atCardLimit = !editing && !isUnlocked() && cards.length >= FREE_CARD_LIMIT;
  const recordings = cards.filter((card) => card.audio).length;
  const atRecordingLimit = !editing?.audio && !isUnlocked() && recordings >= FREE_RECORDING_LIMIT;
  shell(`
    <section class="page-heading compact"><div><p class="eyebrow">Field note ${String(cards.length + (editing ? 0 : 1)).padStart(2, '0')}</p><h2>${editing ? 'Edit this context' : 'Capture a living word'}</h2></div><p>Use a sentence you actually met or wanted to say.</p></section>
    ${atCardLimit ? `<section class="limit-note"><h3>Your free field book is full.</h3><p>You can keep practicing and exporting all ${FREE_CARD_LIMIT} contexts, or unlock unlimited contexts with one purchase.</p><a class="button primary" href="#ownership">See the one-time unlock</a></section>` : `
    <form class="context-form" data-card-form novalidate>
      <input type="hidden" name="id" value="${editing ? esc(editing.id) : ''}">
      <div class="form-grid">
        <div class="field word-field"><label for="word">Word or phrase <span>required</span></label><input id="word" name="word" required maxlength="80" value="${editing ? esc(editing.word) : ''}" autocomplete="off"><p class="field-hint">Exactly as it appears in the sentence.</p></div>
        <div class="field language-field"><label for="language">Language <span>optional</span></label><input id="language" name="language" maxlength="60" value="${editing ? esc(editing.language) : ''}" placeholder="e.g. Spanish"></div>
      </div>
      <div class="field"><label for="sentence">Your sentence <span>required</span></label><textarea id="sentence" name="sentence" required maxlength="500" rows="4">${editing ? esc(editing.sentence) : ''}</textarea><div class="field-footer"><p class="field-hint">The word or phrase must appear here.</p><span data-count>0 / 500</span></div></div>
      <div class="form-grid">
        <div class="field"><label for="meaning">Meaning in this moment <span>optional</span></label><input id="meaning" name="meaning" maxlength="160" value="${editing ? esc(editing.meaning) : ''}" placeholder="What you meant, not a dictionary entry"></div>
        <div class="field"><label for="source">Where you met it <span>optional</span></label><input id="source" name="source" maxlength="100" value="${editing ? esc(editing.source) : ''}" placeholder="At the market, chapter 4…"></div>
      </div>
      <fieldset class="voice-field">
        <legend>Your voice <span>optional</span></legend>
        <p>Record the word and sentence. Audio stays in this browser unless you explicitly export it.</p>
        <div class="recorder-row">
          <button class="button secondary" type="button" data-record ${atRecordingLimit ? 'disabled aria-describedby="record-limit"' : ''}>${icon('mic')}<span>${addRecording ? 'Record again' : 'Start recording'}</span></button>
          <span class="record-status" data-record-status>${addRecording ? 'Recording ready' : 'Not recorded'}</span>
          ${addRecording ? `<button class="text-button" type="button" data-preview-recording>Play</button><button class="text-button danger-text" type="button" data-remove-recording>Remove</button>` : ''}
        </div>
        ${atRecordingLimit ? `<p id="record-limit" class="limit-inline">The free field book includes ${FREE_RECORDING_LIMIT} recordings. <a href="#ownership">Unlock unlimited recording</a>.</p>` : ''}
        <div class="inline-error" data-record-error role="alert"></div>
      </fieldset>
      <div class="inline-error" data-form-error role="alert"></div>
      <div class="form-actions"><a class="button quiet" href="${editing ? '#library' : '#today'}">Cancel</a><button class="button primary" type="submit">${editing ? 'Save changes' : 'Save context'}</button></div>
    </form>`}
    <aside class="writing-prompt"><span aria-hidden="true">“</span><div><h3>A good context is yours.</h3><p>“I missed the <em>último</em> bus home” is easier to retrieve than a definition floating on its own.</p></div></aside>`);
  const sentence = document.querySelector<HTMLTextAreaElement>('#sentence');
  const count = document.querySelector<HTMLElement>('[data-count]');
  const updateCount = () => { if (count && sentence) count.textContent = `${sentence.value.length} / 500`; };
  sentence?.addEventListener('input', updateCount);
  updateCount();
}

function renderLibrary(query = ''): void {
  const normalized = query.trim().toLocaleLowerCase();
  const filtered = cards.filter((card) => [card.word, card.sentence, card.meaning, card.language, card.source].some((value) => value.toLocaleLowerCase().includes(normalized)));
  shell(`
    <section class="page-heading compact"><div><p class="eyebrow">Your field book</p><h2>${cards.length} personal context${cards.length === 1 ? '' : 's'}</h2></div><a class="button primary" href="#add">Add context</a></section>
    <label class="search-box" for="library-search"><span class="visually-hidden">Search contexts</span><input type="search" id="library-search" placeholder="Search words, sentences, places…" value="${esc(query)}"><kbd>/</kbd></label>
    ${cards.length ? `<ul class="library-list">${filtered.map((card) => `
      <li class="library-card">
        <div class="library-card-top"><span class="mode-pill">${modeLabel(card.promptMode)} · ${formatDue(card.dueAt)}</span>${card.audio ? `<span class="audio-pill">${icon('mic')} Voice</span>` : ''}</div>
        <h3>${esc(card.word)}</h3><p class="library-sentence" lang="${esc(card.language || 'und')}">${esc(card.sentence)}</p>
        <div class="library-meta"><span>${esc(card.language || 'No language label')}</span>${card.source ? `<span>${esc(card.source)}</span>` : ''}<span>${card.reviews.length} review${card.reviews.length === 1 ? '' : 's'}</span></div>
        <div class="library-actions"><a class="text-button" href="#add?edit=${encodeURIComponent(card.id)}">Edit</a><button class="text-button danger-text" data-delete="${esc(card.id)}">Delete</button></div>
      </li>`).join('')}</ul>${filtered.length === 0 ? `<div class="empty-search"><h3>No contexts match “${esc(query)}”.</h3><p>Try a word, language, or place.</p></div>` : ''}` : `<section class="rest-state"><h3>Your field book is empty.</h3><p>Add a sentence from something you read, heard, or wanted to say.</p><a class="button primary" href="#add">Add your first context</a></section>`}`);
  const search = document.querySelector<HTMLInputElement>('#library-search');
  search?.addEventListener('input', () => renderLibrary(search.value));
}

function renderOwnership(): void {
  const unlocked = isUnlocked();
  const token = getLicense();
  shell(`
    <section class="ownership-hero">
      <p class="eyebrow">Local by design</p><h2>Your words should not need an account.</h2><p>Contexts, review history, and voice recordings live in this browser’s private storage. Nothing is uploaded by the app.</p>
      <div class="privacy-diagram" aria-label="Your sentence, voice and review schedule stay together on this device"><span>Your sentence</span><i>+</i><span>Your voice</span><i>+</i><span>Schedule</span><b>On this device</b></div>
    </section>
    <section class="ownership-grid">
      <div class="ownership-panel"><p class="eyebrow">Data ownership</p><h3>Take the whole field book with you.</h3><p>Export a JSON backup with contexts, review history, and recordings. Import uses the newest edit when a card already exists.</p><div class="button-row"><button class="button secondary" data-export>${icon('download')} Export backup</button><label class="button quiet file-button">${icon('upload')} Import backup<input type="file" data-import accept="application/json,.json"></label></div><p class="fine-print">Exports can contain your voice. The app asks before creating one.</p></div>
      <div class="ownership-panel purchase-panel">
        <p class="eyebrow">One-time unlock</p><h3>${unlocked ? 'Your field book is unlocked.' : '$12 once. Keep writing.'}</h3>
        <p>${unlocked ? 'Unlimited contexts and recordings are available on this device.' : `The free field book includes ${FREE_CARD_LIMIT} contexts and ${FREE_RECORDING_LIMIT} voice recordings. Unlock unlimited contexts and recordings—no subscription.`}</p>
        ${unlocked ? `<div class="license-active"><span>✓</span><div><strong>License active</strong><small>${esc(token.slice(0, 6))}…${esc(token.slice(-4))}</small></div></div><button class="text-button danger-text" data-remove-license>Remove from this device</button>` : `<a class="button primary full" href="${checkoutUrl}">Buy the one-time unlock</a><details><summary>Have a license? Restore purchase</summary><form data-license-form><label for="license-token">License token</label><input id="license-token" name="license" autocomplete="off" required><button class="button secondary" type="submit">Verify and unlock</button><p class="inline-error" data-license-error role="alert"></p></form></details>`}
        <p class="fine-print">Checkout is hosted by Sociobot; Dodo is merchant of record. Refunds are handled there and revoke the license. <a href="/terms/">Terms</a></p>
      </div>
    </section>`);
}

function render(): void {
  view = routeFromHash().view;
  transientMessage = transientMessage || '';
  if (view === 'add') renderAdd();
  else if (view === 'library') renderLibrary();
  else if (view === 'ownership') renderOwnership();
  else renderToday();
}

function announce(message: string): void {
  transientMessage = message;
  render();
  window.setTimeout(() => {
    if (transientMessage === message) {
      transientMessage = '';
      document.querySelector('.toast')?.remove();
    }
  }, 4200);
}

async function startRecording(button: HTMLButtonElement, destination: 'card' | 'attempt'): Promise<void> {
  const error = document.querySelector<HTMLElement>('[data-record-error]');
  if (!navigator.mediaDevices?.getUserMedia || !window.MediaRecorder) {
    if (error) error.textContent = 'Recording is not supported in this browser. You can still save and practice the context.';
    return;
  }
  try {
    const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
    const chunks: Blob[] = [];
    recorder = new MediaRecorder(stream);
    recorder.ondataavailable = (event) => { if (event.data.size) chunks.push(event.data); };
    recorder.onstop = () => {
      stream.getTracks().forEach((track) => track.stop());
      window.clearInterval(recordingTimer);
      const blob = new Blob(chunks, { type: recorder?.mimeType || 'audio/webm' });
      if (destination === 'card') {
        addRecording = blob;
        addRecordingMime = blob.type;
        renderAdd();
      } else {
        const result = document.querySelector<HTMLElement>('[data-attempt-result]');
        if (result) {
          const url = audioUrl(blob);
          result.innerHTML = `<audio controls src="${url}">Your browser cannot play this attempt.</audio><p>This attempt disappears when you leave the card.</p>`;
        }
        button.innerHTML = `${icon('mic')} Record again`;
      }
    };
    recorder.start();
    recordingStartedAt = Date.now();
    button.textContent = 'Stop recording';
    button.dataset.stopRecording = destination;
    const status = document.querySelector<HTMLElement>('[data-record-status]');
    const update = () => {
      const seconds = Math.floor((Date.now() - recordingStartedAt) / 1000);
      if (status) status.textContent = `Recording · ${Math.floor(seconds / 60)}:${String(seconds % 60).padStart(2, '0')}`;
      if (seconds >= 120 && recorder?.state === 'recording') recorder.stop();
    };
    update();
    recordingTimer = window.setInterval(update, 500);
  } catch {
    if (error) error.textContent = 'Microphone access was not available. Allow it in your browser settings, or save without audio.';
  }
}

async function handleCardSubmit(form: HTMLFormElement): Promise<void> {
  const data = new FormData(form);
  const id = String(data.get('id') ?? '');
  const existing = cards.find((card) => card.id === id);
  const word = String(data.get('word') ?? '').trim();
  const sentence = String(data.get('sentence') ?? '').trim();
  const error = form.querySelector<HTMLElement>('[data-form-error]');
  if (!word || !sentence) {
    if (error) error.textContent = 'Add both the word and the sentence where you used it.';
    (!word ? form.querySelector<HTMLInputElement>('#word') : form.querySelector<HTMLTextAreaElement>('#sentence'))?.focus();
    return;
  }
  if (!sentence.toLocaleLowerCase().includes(word.toLocaleLowerCase())) {
    if (error) error.textContent = `“${word}” does not appear in your sentence yet. Add it exactly as written.`;
    form.querySelector<HTMLTextAreaElement>('#sentence')?.focus();
    return;
  }
  const now = Date.now();
  const card: RecallCard = {
    id: existing?.id ?? crypto.randomUUID(),
    word,
    sentence,
    meaning: String(data.get('meaning') ?? '').trim(),
    language: String(data.get('language') ?? '').trim(),
    source: String(data.get('source') ?? '').trim(),
    createdAt: existing?.createdAt ?? now,
    updatedAt: now,
    dueAt: existing?.dueAt ?? now,
    intervalDays: existing?.intervalDays ?? 0.25,
    promptMode: existing?.promptMode ?? (addRecording ? 'listen' : 'cloze'),
    reviews: existing?.reviews ?? [],
    audio: addRecording,
    audioMime: addRecordingMime || undefined,
  };
  await saveCard(card);
  cards = await getCards();
  addRecording = undefined;
  location.hash = 'today';
  announce(existing ? 'Changes saved on this device.' : 'Context saved. It is ready for its first recall.');
}

async function grade(card: RecallCard, gradeValue: ReviewGrade): Promise<void> {
  await saveCard(scheduleReview(card, gradeValue));
  cards = await getCards();
  const nextDue = cards.find((item) => item.dueAt <= Date.now() && item.id !== card.id);
  reviewRevealed = false;
  clozeResult = '';
  activeReviewId = nextDue?.id ?? '';
  if (!nextDue) announce('Session complete. Your next return is scheduled.');
  else renderToday();
}

document.addEventListener('click', async (event) => {
  const target = event.target as HTMLElement;
  const start = target.closest<HTMLElement>('[data-start-review]');
  if (start) { activeReviewId = start.dataset.startReview ?? ''; reviewRevealed = false; clozeResult = ''; renderToday(); return; }
  if (target.closest('[data-exit-review]')) { activeReviewId = ''; reviewRevealed = false; renderToday(); return; }
  if (target.closest('[data-reveal]')) { reviewRevealed = true; renderToday(); return; }
  const gradeButton = target.closest<HTMLElement>('[data-grade]');
  if (gradeButton && activeReviewId) {
    const card = cards.find((item) => item.id === activeReviewId);
    if (card) await grade(card, gradeButton.dataset.grade as ReviewGrade);
    return;
  }
  const recordButton = target.closest<HTMLButtonElement>('[data-record], [data-attempt-record]');
  if (recordButton) {
    if (recorder?.state === 'recording') recorder.stop();
    else await startRecording(recordButton, recordButton.hasAttribute('data-record') ? 'card' : 'attempt');
    return;
  }
  if (target.closest('[data-preview-recording]') && addRecording) { await new Audio(audioUrl(addRecording)).play(); return; }
  if (target.closest('[data-remove-recording]')) { addRecording = undefined; addRecordingMime = ''; renderAdd(); return; }
  const remove = target.closest<HTMLElement>('[data-delete]');
  if (remove) {
    const card = cards.find((item) => item.id === remove.dataset.delete);
    if (card && window.confirm(`Delete “${card.word}” and its review history${card.audio ? ' and recording' : ''}? This cannot be undone.`)) {
      await deleteCard(card.id); cards = await getCards(); announce('Context deleted.');
    }
    return;
  }
  if (target.closest('[data-export]')) {
    if (!cards.length) { announce('There are no contexts to export yet.'); return; }
    if (!window.confirm('Create a private backup now? It includes your sentences, review history, and any voice recordings. Share the file only if you choose to.')) return;
    const bundle = await exportCards(cards);
    const url = URL.createObjectURL(new Blob([JSON.stringify(bundle, null, 2)], { type: 'application/json' }));
    const link = document.createElement('a'); link.href = url; link.download = `context-recall-cards-${new Date().toISOString().slice(0, 10)}.json`; link.click(); URL.revokeObjectURL(url);
    announce('Private backup exported.'); return;
  }
  if (target.closest('[data-remove-license]')) {
    if (window.confirm('Remove this license from this device? Your contexts and recordings will not be deleted.')) { clearLicense(); renderOwnership(); }
    return;
  }
  if (target.closest('[data-install]') && installPrompt) {
    await installPrompt.prompt(); await installPrompt.userChoice; installPrompt = undefined; render();
  }
});

document.addEventListener('submit', async (event) => {
  event.preventDefault();
  const form = event.target as HTMLFormElement;
  if (form.matches('[data-card-form]')) { await handleCardSubmit(form); return; }
  if (form.matches('[data-cloze]')) {
    const card = cards.find((item) => item.id === activeReviewId);
    const answer = String(new FormData(form).get('answer') ?? '');
    if (card) { clozeResult = isAnswerCorrect(answer, card.word) ? 'correct' : 'incorrect'; renderToday(); }
    return;
  }
  if (form.matches('[data-license-form]')) {
    const token = String(new FormData(form).get('license') ?? '').trim();
    const error = form.querySelector<HTMLElement>('[data-license-error]');
    if (!token) { if (error) error.textContent = 'Paste the license token from your receipt.'; return; }
    saveLicense(token);
    const verdict = await verifyLicense(true);
    if (verdict?.valid) { announce('Purchase restored. Unlimited contexts and recordings are ready.'); }
    else { clearLicense(); if (error) error.textContent = verdict ? 'That license is not active for this product.' : 'Could not verify right now. Check your connection and try again.'; }
  }
});

document.addEventListener('change', async (event) => {
  const input = (event.target as HTMLElement).closest<HTMLInputElement>('[data-import]');
  const file = input?.files?.[0];
  if (!file) return;
  try {
    const imported = parseImport(JSON.parse(await file.text()) as unknown);
    const count = await importCards(imported);
    cards = await getCards();
    announce(count ? `Imported ${count} newer context${count === 1 ? '' : 's'}.` : 'Everything in that backup is already current.');
  } catch (error) {
    announce(error instanceof Error ? error.message : 'That backup could not be imported.');
  }
  input.value = '';
});

window.addEventListener('hashchange', () => {
  const nextRoute = routeFromHash();
  if (nextRoute.view === 'add' && view !== 'add') {
    const editing = cards.find((card) => card.id === nextRoute.editId);
    addRecording = editing?.audio;
    addRecordingMime = editing?.audioMime ?? editing?.audio?.type ?? '';
  }
  activeReviewId = '';
  reviewRevealed = false;
  render();
});
window.addEventListener('online', render);
window.addEventListener('offline', render);
window.addEventListener('beforeinstallprompt', (event) => { event.preventDefault(); installPrompt = event as BeforeInstallPromptEvent; render(); });
document.addEventListener('keydown', (event) => {
  if (event.key === '/' && view === 'library' && document.activeElement?.tagName !== 'INPUT') { event.preventDefault(); document.querySelector<HTMLInputElement>('#library-search')?.focus(); }
});

async function registerServiceWorker(): Promise<void> {
  if (!('serviceWorker' in navigator)) return;
  const registration = await navigator.serviceWorker.register('/sw.js');
  registration.addEventListener('updatefound', () => {
    const worker = registration.installing;
    worker?.addEventListener('statechange', () => {
      if (worker.state === 'installed' && navigator.serviceWorker.controller) {
        const toast = document.createElement('div');
        toast.className = 'update-toast';
        toast.setAttribute('role', 'status');
        toast.innerHTML = '<span>A fresh version is ready.</span><button>Update now</button>';
        toast.querySelector('button')?.addEventListener('click', () => registration.waiting?.postMessage({ type: 'SKIP_WAITING' }));
        document.body.append(toast);
      }
    });
  });
  let reloading = false;
  navigator.serviceWorker.addEventListener('controllerchange', () => { if (!reloading) { reloading = true; location.reload(); } });
}

async function init(): Promise<void> {
  captureLicenseFromUrl();
  try { cards = await getCards(); }
  catch { transientMessage = 'Local storage is unavailable. Check private browsing settings before adding a context.'; }
  render();
  void registerServiceWorker();
  const before = isUnlocked();
  const verdict = await verifyLicense();
  if (before && verdict?.valid === false) announce('This license is no longer active. Your saved contexts remain available.');
}

void init();
