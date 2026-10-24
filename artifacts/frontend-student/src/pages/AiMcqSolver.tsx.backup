// AI MCQ Solver. A student pastes any MCQ they're unsure about (question + options, each option on its
// own line starting A. / B. / ...) and gets the best answer, a clear explanation, why each option is
// right or wrong, and a one-line take-home point. The last question and answer are kept in this browser
// tab (sessionStorage) so a refresh or the app being backgrounded doesn't lose them.
<<<<<<< HEAD
//
// Also: a photo of the question can be used instead of typing (shrunk in the browser first), the answer
// can be discussed in a follow-up chat, and a solved question can be saved to the student's notebook.
import { useRef, useState } from 'react';
import { Camera, Check, Lightbulb, NotebookPen, RotateCcw, Send, Sparkles, TriangleAlert, X } from 'lucide-react';
import { aiMcqSolverApi, ApiRequestError, notebookApi, type SolvedMcq, type SolverChatTurn } from '@/lib/api';
=======
import { useRef, useState } from 'react';
import { Check, Lightbulb, RotateCcw, Sparkles, TriangleAlert, X } from 'lucide-react';
import { aiMcqSolverApi, ApiRequestError, type SolvedMcq } from '@/lib/api';
>>>>>>> 7ffca6aeae01139b6c012d9413fb8e00812f4c4f
import { cn } from '@/lib/utils';
import { BrandSpinner, SectionHeader } from '@/lib/shared';

const STORAGE_KEY = 'ai-mcq-solver-v1';
const LETTERS = ['A', 'B', 'C', 'D', 'E', 'F'];
const PLACEHOLDER = `A 45-year-old man has crushing chest pain for 2 hours. ECG shows ST elevation in leads II, III and aVF. Which artery is most likely occluded?
A. Left anterior descending artery
B. Right coronary artery
C. Left circumflex artery
D. Left main coronary artery`;

type Parsed = { question: string; options: string[] };

<<<<<<< HEAD
/** Splits pasted text into a question and its options. Handles the usual layouts:
 *   "A. text" / "A) text" / "(a) text" / "A: text" / "A - text" / "A text" / "Option A: text" / "1. text" (one per line),
 *   a label on its own line with the text on the next line(s) ("A" / "Hjdjd" / "B" / "Shjsjs" ...),
 *   options that wrap over several lines, and everything on one line.
 * Anything stranger returns null and the AI reads the text instead (see solve()). */
export function parseMcq(text: string): Parsed | null {
  // Drop pasted answer keys so they never leak into an option ("Answer: B", "Ans - C").
  const lines = text.split(/\r?\n/).map((l) => l.trim()).filter((l) => l && !/^(?:correct\s+)?(?:answer|ans|key)\s*[:=\-–]/i.test(l));
  type Cand = { idx: number; n: number; rest: string; style: 'punct' | 'bare' | 'space' };
  const letterRe = /^\(?(?:[Oo]ption\s+)?([A-Fa-f])(\s*[\).:\-–—]\s*|\s+|$)(.*)$/;
  const digitRe = /^\(?(?:[Oo]ption\s+)?([1-6])(\s*[\).:\-–—]\s*|$)(.*)$/;
  const candidates = (re: RegExp, letters: boolean): Cand[] => {
    const out: Cand[] = [];
    lines.forEach((l, idx) => {
      const m = re.exec(l); if (!m) return;
      const sep = m[2]; const spaceOnly = sep !== '' && sep.trim() === '';
      if (spaceOnly && m[1] !== m[1].toUpperCase()) return; // "a patient ..." is a sentence, not option a
      const rest = m[3].trim();
      out.push({ idx, n: letters ? 'ABCDEF'.indexOf(m[1].toUpperCase()) : Number(m[1]) - 1, rest, style: !rest && sep.trim() === '' ? 'bare' : spaceOnly ? 'space' : 'punct' });
    });
    return out;
  };
  // Try every labelling style on its own (so "A" / "A only" lines aren't mixed up), take the last complete A,B,C... run
  // in each (labelled statements in the stem aren't the options), then keep the longest run; on a tie the later one,
  // because options come after the stem.
  let best: { len: number; start: number; parsed: Parsed } | null = null;
  for (const [all, style] of [[candidates(letterRe, true), 'punct'], [candidates(letterRe, true), 'bare'], [candidates(letterRe, true), 'space'], [candidates(digitRe, false), 'punct'], [candidates(digitRe, false), 'bare']] as const) {
    const cands = all.filter((c) => c.style === style);
    for (let st = cands.length - 1; st >= 0; st--) {
      if (cands[st].n !== 0) continue;
      const chain: Cand[] = [cands[st]];
      for (let k = 1; k < 6; k++) { const next = cands.find((c) => c.idx > chain[chain.length - 1].idx && c.n === k); if (!next) break; chain.push(next); }
      if (chain.length < 2) continue;
      const question = lines.slice(0, chain[0].idx).join('\n').trim();
      const options = chain.map((c, i) => [c.rest, ...lines.slice(c.idx + 1, i + 1 < chain.length ? chain[i + 1].idx : undefined)].filter(Boolean).join(' ').trim());
      if (!question || !options.every(Boolean)) continue;
      if (!best || chain.length > best.len || (chain.length === best.len && chain[0].idx > best.start)) best = { len: chain.length, start: chain[0].idx, parsed: { question, options } };
      break; // the last valid run for this style is enough
    }
  }
  if (best) return best.parsed;
=======
/** Splits pasted text into a question and its options. Accepts "A." "A)" "(A)" "A:" "A-", one per line, or all on one line. */
export function parseMcq(text: string): Parsed | null {
  const lines = text.split(/\r?\n/).map((l) => l.trim()).filter(Boolean);
  const optRe = /^\(?([A-Fa-f])[\).:\-]\s*(.+)$/;
  const firstOpt = lines.findIndex((l, i) => { const m = optRe.exec(l); return !!m && m[1].toUpperCase() === 'A' && lines.slice(i + 1).some((x) => /^\(?[Bb][\).:\-]\s*\S/.test(x)); });
  if (firstOpt > 0) {
    const options: string[] = []; let expect = 0; const extra: string[] = [];
    for (const l of lines.slice(firstOpt)) {
      const m = optRe.exec(l);
      if (m && m[1].toUpperCase() === LETTERS[expect]) { options.push(m[2].trim()); expect++; }
      else if (options.length) options[options.length - 1] += ' ' + l; // wrapped option text
      else extra.push(l);
    }
    const question = [...lines.slice(0, firstOpt), ...extra].join('\n').trim();
    if (question && options.length >= 2) return { question, options: options.slice(0, 6) };
  }
>>>>>>> 7ffca6aeae01139b6c012d9413fb8e00812f4c4f
  // Everything on one line / one paragraph: "... A. foo B. bar C. baz D. qux"
  const flat = lines.join(' ');
  const re = /(?:^|\s)\(?([A-Fa-f])[\).:]\s+/g; const hits: Array<{ i: number; end: number; letter: string }> = [];
  for (let m = re.exec(flat); m; m = re.exec(flat)) hits.push({ i: m.index, end: m.index + m[0].length, letter: m[1].toUpperCase() });
  const a = hits.findIndex((h) => h.letter === 'A');
  if (a >= 0) {
    const seq: typeof hits = []; for (const h of hits.slice(a)) if (h.letter === LETTERS[seq.length]) seq.push(h);
    if (seq.length >= 2) {
      const question = flat.slice(0, seq[0].i).trim();
      const options = seq.map((h, k) => flat.slice(h.end, k + 1 < seq.length ? seq[k + 1].i : undefined).trim());
      if (question && options.every(Boolean)) return { question, options: options.slice(0, 6) };
    }
  }
  return null;
}

const CONFIDENCE: Record<SolvedMcq['confidence'], { label: string; cls: string }> = {
  high: { label: 'High confidence', cls: 'border-emerald-500/40 bg-emerald-500/10 text-emerald-700 dark:text-emerald-300' },
  medium: { label: 'Fairly sure', cls: 'border-amber-500/40 bg-amber-500/10 text-amber-700 dark:text-amber-300' },
  low: { label: 'Not sure — check this one', cls: 'border-red-500/40 bg-red-500/10 text-red-700 dark:text-red-300' },
};

<<<<<<< HEAD
type Saved = { text: string; parsed: Parsed | null; result: SolvedMcq | null; chat: SolverChatTurn[] };
function load(): Saved {
  try { const v = JSON.parse(sessionStorage.getItem(STORAGE_KEY) ?? 'null'); if (v && typeof v.text === 'string') return { text: v.text, parsed: v.parsed ?? null, result: v.result ?? null, chat: Array.isArray(v.chat) ? v.chat : [] }; } catch { /* ignore */ }
  return { text: '', parsed: null, result: null, chat: [] };
}

const wordCount = (t: string) => (t.trim() ? t.trim().split(/\s+/).length : 0);

/** Shrinks a photo in the browser (max 1600 px, JPEG) so uploads are fast on mobile data. Returns base64 without the data: prefix. */
async function shrinkPhoto(file: File): Promise<string> {
  const url = URL.createObjectURL(file);
  try {
    const img = await new Promise<HTMLImageElement>((resolve, reject) => { const i = new Image(); i.onload = () => resolve(i); i.onerror = () => reject(new Error('Could not read that image')); i.src = url; });
    const scale = Math.min(1, 1600 / Math.max(img.naturalWidth, img.naturalHeight));
    const c = document.createElement('canvas'); c.width = Math.max(1, Math.round(img.naturalWidth * scale)); c.height = Math.max(1, Math.round(img.naturalHeight * scale));
    const ctx = c.getContext('2d'); if (!ctx) throw new Error('Could not read that image');
    ctx.fillStyle = '#fff'; ctx.fillRect(0, 0, c.width, c.height); ctx.drawImage(img, 0, 0, c.width, c.height);
    return c.toDataURL('image/jpeg', 0.85).split(',')[1];
  } finally { URL.revokeObjectURL(url); }
}

function notebookText(p: Parsed, r: SolvedMcq): string {
  const opts = p.options.map((o, i) => `${LETTERS[i]}. ${o}${i === r.answerIndex ? '  ✓' : ''}`).join('\n');
  const why = p.options.map((_, i) => r.optionExplanations[i] ? `${LETTERS[i]}: ${r.optionExplanations[i]}` : '').filter(Boolean).join('\n');
  return `${p.question}\n\n${opts}\n\nAnswer: ${r.answer}. ${p.options[r.answerIndex]}\n\n${r.explanation}${why ? `\n\nEach option:\n${why}` : ''}${r.keyPoint ? `\n\nRemember: ${r.keyPoint}` : ''}`;
=======
function load(): { text: string; parsed: Parsed | null; result: SolvedMcq | null } {
  try { const v = JSON.parse(sessionStorage.getItem(STORAGE_KEY) ?? 'null'); if (v && typeof v.text === 'string') return { text: v.text, parsed: v.parsed ?? null, result: v.result ?? null }; } catch { /* ignore */ }
  return { text: '', parsed: null, result: null };
>>>>>>> 7ffca6aeae01139b6c012d9413fb8e00812f4c4f
}

export default function AiMcqSolver() {
  const restored = useRef(load()).current;
  const [text, setText] = useState(restored.text);
  const [parsed, setParsed] = useState<Parsed | null>(restored.parsed);
  const [result, setResult] = useState<SolvedMcq | null>(restored.result);
<<<<<<< HEAD
  const [chat, setChat] = useState<SolverChatTurn[]>(restored.chat);
  const [photos, setPhotos] = useState<Array<{ id: number; preview: string; data: string }>>([]);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [followUp, setFollowUp] = useState('');
  const [chatBusy, setChatBusy] = useState(false);
  const [noteState, setNoteState] = useState<'idle' | 'saving' | 'saved'>('idle');
  const run = useRef(0);
  const photoId = useRef(0);
  const chatEnd = useRef<HTMLDivElement | null>(null);

  const persist = (t: string, p: Parsed | null, r: SolvedMcq | null, c: SolverChatTurn[] = []) => { try { sessionStorage.setItem(STORAGE_KEY, JSON.stringify({ text: t, parsed: p, result: r, chat: c })); } catch { /* storage blocked */ } };

  const addPhotos = async (files: FileList | null) => {
    if (!files?.length) return;
    setError(null);
    try {
      const room = 3 - photos.length; const added: typeof photos = [];
      for (const file of Array.from(files).slice(0, Math.max(0, room))) {
        if (!file.type.startsWith('image/')) continue;
        const data = await shrinkPhoto(file);
        added.push({ id: ++photoId.current, preview: `data:image/jpeg;base64,${data}`, data });
      }
      if (added.length) setPhotos((p) => [...p, ...added].slice(0, 3));
      else if (room <= 0) setError('You can add up to 3 photos at a time.');
    } catch (e) { setError(e instanceof Error ? e.message : 'Could not read that photo.'); }
  };

  const solve = async () => {
    setError(null);
    if (photos.length) {
      const id = ++run.current; setBusy(true); setResult(null); setParsed(null); setChat([]); setNoteState('idle');
      try {
        const r = await aiMcqSolverApi.solveImage(photos.map((ph) => ({ mime: 'image/jpeg' as const, data: ph.data })));
        if (id !== run.current) return;
        const p: Parsed = { question: r.question, options: r.options };
        const asText = `${r.question}\n${r.options.map((o, i) => `${LETTERS[i]}. ${o}`).join('\n')}`;
        setParsed(p); setResult(r); setText(asText); setPhotos([]); persist(asText, p, r, []);
      } catch (e) {
        if (id !== run.current) return;
        setError(e instanceof ApiRequestError ? e.message : 'Something went wrong. Try again.');
      } finally { if (id === run.current) setBusy(false); }
      return;
    }
    const p = parseMcq(text);
    if (!p) {
      // Unusual layout: let the AI work out which part is the question and which are the options, then solve it.
      const id = ++run.current; setBusy(true); setResult(null); setParsed(null); setChat([]); setNoteState('idle');
      try {
        const r = await aiMcqSolverApi.solveText(text);
        if (id !== run.current) return;
        const found: Parsed = { question: r.question, options: r.options };
        setParsed(found); setResult(r); persist(text, found, r, []);
      } catch (e) {
        if (id !== run.current) return;
        setError(e instanceof ApiRequestError ? e.message : 'Something went wrong. Try again.');
      } finally { if (id === run.current) setBusy(false); }
      return;
    }
    const id = ++run.current; setBusy(true); setResult(null); setParsed(p); setChat([]); setNoteState('idle');
    try {
      const r = await aiMcqSolverApi.solve(p);
      if (id !== run.current) return;
      setResult(r); persist(text, p, r, []);
=======
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const run = useRef(0);

  const persist = (t: string, p: Parsed | null, r: SolvedMcq | null) => { try { sessionStorage.setItem(STORAGE_KEY, JSON.stringify({ text: t, parsed: p, result: r })); } catch { /* storage blocked */ } };

  const solve = async () => {
    setError(null);
    const p = parseMcq(text);
    if (!p) { setError('I couldn\'t find the options. Put the question first, then each option on its own line starting with A., B., C., D.'); return; }
    const id = ++run.current; setBusy(true); setResult(null); setParsed(p);
    try {
      const r = await aiMcqSolverApi.solve(p);
      if (id !== run.current) return;
      setResult(r); persist(text, p, r);
>>>>>>> 7ffca6aeae01139b6c012d9413fb8e00812f4c4f
    } catch (e) {
      if (id !== run.current) return;
      setError(e instanceof ApiRequestError ? e.message : 'Something went wrong. Try again.');
    } finally { if (id === run.current) setBusy(false); }
  };
<<<<<<< HEAD
  const reset = () => { run.current++; setText(''); setParsed(null); setResult(null); setError(null); setBusy(false); setChat([]); setPhotos([]); setFollowUp(''); setNoteState('idle'); persist('', null, null, []); };

  const ask = async (message: string) => {
    const m = message.trim(); if (!m || !parsed || !result || chatBusy) return;
    const history = chat.slice(-10);
    const withQ: SolverChatTurn[] = [...chat, { role: 'student', text: m }];
    setChat(withQ); setFollowUp(''); setChatBusy(true); setError(null);
    setTimeout(() => chatEnd.current?.scrollIntoView({ behavior: 'smooth', block: 'nearest' }), 50);
    try {
      const { reply } = await aiMcqSolverApi.followUp({ question: parsed.question, options: parsed.options, answer: result.answer, explanation: result.explanation, history, message: m });
      const next: SolverChatTurn[] = [...withQ, { role: 'tutor', text: reply }];
      setChat(next); persist(text, parsed, result, next);
      setTimeout(() => chatEnd.current?.scrollIntoView({ behavior: 'smooth', block: 'nearest' }), 50);
    } catch (e) {
      setChat(chat); setFollowUp(m); // put the message back so nothing is lost
      setError(e instanceof ApiRequestError ? e.message : 'Something went wrong. Try again.');
    } finally { setChatBusy(false); }
  };

  const saveToNotebook = async () => {
    if (!parsed || !result || noteState !== 'idle') return;
    setNoteState('saving');
    try {
      await notebookApi.create({ title: `MCQ: ${parsed.question.replace(/\s+/g, ' ').slice(0, 70)}`, content: notebookText(parsed, result) });
      setNoteState('saved');
    } catch (e) { setNoteState('idle'); setError(e instanceof ApiRequestError ? e.message : 'Could not save to your notebook. Try again.'); }
  };

  return <div className="mx-auto max-w-3xl">
    <SectionHeader eyebrow="Study tools" title="AI MCQ Solver" description="Stuck on an MCQ? Paste it in any layout — A. / A) / (a) / 1. / the letter on its own line, statements, anything — and get the answer with a proper explanation." />

    <div className="rounded-2xl border border-border bg-card p-4 sm:p-5">
      <label htmlFor="mcq-solver-input" className="text-[11px] font-extrabold uppercase tracking-wide text-muted-foreground">Paste your MCQ</label>
      <textarea id="mcq-solver-input" value={text} maxLength={9000} onChange={(e) => { setText(e.target.value); if (error) setError(null); }} placeholder={PLACEHOLDER}
        className="mt-1.5 min-h-56 w-full resize-y rounded-xl border border-border bg-background p-3 text-sm leading-6 outline-none focus:ring-2 focus:ring-primary/20" data-testid="textarea-mcq-solver" />
      <div className="mt-1 text-right text-[10px] text-muted-foreground" data-testid="text-mcq-solver-words">{wordCount(text)} words · long clinical vignettes are fine</div>

      <div className="mt-2 flex flex-wrap items-center gap-2">
        {photos.map((ph) => <div key={ph.id} className="relative size-16 overflow-hidden rounded-xl border border-border">
          <img src={ph.preview} alt="Question photo" className="size-full object-cover" />
          <button type="button" onClick={() => setPhotos((p) => p.filter((x) => x.id !== ph.id))} aria-label="Remove photo" className="absolute right-0.5 top-0.5 grid size-5 place-items-center rounded-full bg-black/70 text-white"><X size={11} /></button>
        </div>)}
        {photos.length < 3 && <label className="inline-flex cursor-pointer items-center gap-1.5 rounded-xl border border-dashed border-primary/50 bg-primary/5 px-3 py-2 text-xs font-extrabold text-primary hover:bg-primary/10" data-testid="button-mcq-solver-photo">
          <Camera size={15} />{photos.length ? 'Add another photo' : 'Use a photo of the question'}
          <input type="file" accept="image/*" multiple className="hidden" onChange={(e) => { void addPhotos(e.target.files); e.target.value = ''; }} data-testid="input-mcq-solver-photo" />
        </label>}
      </div>
      {photos.length > 0 && <div className="mt-1.5 text-[11px] text-muted-foreground">The AI will read the question from {photos.length === 1 ? 'this photo' : 'these photos'} (the typed box is ignored). Make sure the whole question and all options are visible.</div>}

      {error && <div className="mt-2 rounded-xl border border-destructive/30 bg-destructive/5 p-3 text-xs text-destructive" data-testid="text-mcq-solver-error">{error}</div>}
      <div className="mt-3 flex flex-wrap items-center gap-2">
        <button type="button" onClick={() => void solve()} disabled={busy || (!photos.length && text.trim().length < 12)}
          className="inline-flex items-center gap-2 rounded-xl bg-primary px-5 py-2.5 text-sm font-extrabold text-primary-foreground disabled:opacity-50" data-testid="button-mcq-solver-solve">
          <Sparkles size={16} />{busy ? 'Thinking…' : 'Get answer'}
        </button>
        {(text || result || photos.length > 0) && <button type="button" onClick={reset} className="inline-flex items-center gap-1.5 rounded-xl border border-border px-4 py-2.5 text-sm font-bold text-muted-foreground hover:bg-muted" data-testid="button-mcq-solver-clear"><RotateCcw size={14} />New question</button>}
=======
  const reset = () => { run.current++; setText(''); setParsed(null); setResult(null); setError(null); setBusy(false); persist('', null, null); };

  return <div className="mx-auto max-w-3xl">
    <SectionHeader eyebrow="Study tools" title="AI MCQ Solver" description="Stuck on an MCQ? Paste it here — question first, then each option on its own line — and get the answer with a proper explanation." />

    <div className="rounded-2xl border border-border bg-card p-4 sm:p-5">
      <label htmlFor="mcq-solver-input" className="text-[11px] font-extrabold uppercase tracking-wide text-muted-foreground">Paste your MCQ</label>
      <textarea id="mcq-solver-input" value={text} maxLength={3500} onChange={(e) => { setText(e.target.value); if (error) setError(null); }} placeholder={PLACEHOLDER}
        className="mt-1.5 min-h-56 w-full resize-y rounded-xl border border-border bg-background p-3 text-sm leading-6 outline-none focus:ring-2 focus:ring-primary/20" data-testid="textarea-mcq-solver" />
      {error && <div className="mt-2 rounded-xl border border-destructive/30 bg-destructive/5 p-3 text-xs text-destructive" data-testid="text-mcq-solver-error">{error}</div>}
      <div className="mt-3 flex flex-wrap items-center gap-2">
        <button type="button" onClick={() => void solve()} disabled={busy || text.trim().length < 12}
          className="inline-flex items-center gap-2 rounded-xl bg-primary px-5 py-2.5 text-sm font-extrabold text-primary-foreground disabled:opacity-50" data-testid="button-mcq-solver-solve">
          <Sparkles size={16} />{busy ? 'Thinking…' : 'Get answer'}
        </button>
        {(text || result) && <button type="button" onClick={reset} className="inline-flex items-center gap-1.5 rounded-xl border border-border px-4 py-2.5 text-sm font-bold text-muted-foreground hover:bg-muted" data-testid="button-mcq-solver-clear"><RotateCcw size={14} />New question</button>}
>>>>>>> 7ffca6aeae01139b6c012d9413fb8e00812f4c4f
      </div>
    </div>

    {busy && <div className="mt-6 grid place-items-center gap-2 py-8 text-xs text-muted-foreground" data-testid="status-mcq-solver-loading"><BrandSpinner />Working through the options…</div>}

    {result && parsed && <div className="mt-5 space-y-4" data-testid="card-mcq-solver-result">
      <div className="rounded-2xl border border-emerald-500/40 bg-emerald-500/5 p-4 sm:p-5">
        <div className="flex flex-wrap items-center gap-2">
          <span className="grid size-9 place-items-center rounded-full bg-emerald-500 text-base font-black text-white" data-testid="text-mcq-solver-answer">{result.answer}</span>
          <div className="min-w-0 flex-1"><div className="text-[11px] font-extrabold uppercase tracking-wide text-muted-foreground">Best answer</div><div className="text-sm font-extrabold leading-5">{parsed.options[result.answerIndex]}</div></div>
          <span className={cn('rounded-full border px-2.5 py-1 text-[10px] font-extrabold', CONFIDENCE[result.confidence].cls)}>{CONFIDENCE[result.confidence].label}</span>
        </div>
        <p className="mt-3 whitespace-pre-line text-sm leading-6">{result.explanation}</p>
      </div>

      {result.caveat && <div className="flex items-start gap-2 rounded-xl border border-amber-500/40 bg-amber-500/10 p-3 text-xs leading-5"><TriangleAlert size={15} className="mt-0.5 shrink-0 text-amber-600" /><span>{result.caveat}</span></div>}

      <div className="rounded-2xl border border-border bg-card p-4" data-testid="list-mcq-solver-options">
        <div className="mb-2 text-[11px] font-extrabold uppercase tracking-wide text-muted-foreground">Every option</div>
        <div className="space-y-2">
          {parsed.options.map((opt, i) => {
            const right = i === result.answerIndex;
            return <div key={i} className={cn('flex items-start gap-2.5 rounded-xl border p-3 text-xs leading-5', right ? 'border-emerald-500/40 bg-emerald-500/5' : 'border-border')}>
              <span className={cn('mt-0.5 grid size-5 shrink-0 place-items-center rounded-full text-[10px] font-black', right ? 'bg-emerald-500 text-white' : 'bg-muted text-muted-foreground')}>{right ? <Check size={12} strokeWidth={3} /> : <X size={11} strokeWidth={3} />}</span>
              <div className="min-w-0"><div className="font-bold">{LETTERS[i]}. {opt}</div>{result.optionExplanations[i] && <div className="mt-0.5 text-muted-foreground">{result.optionExplanations[i]}</div>}</div>
            </div>;
          })}
        </div>
      </div>

      {result.keyPoint && <div className="flex items-start gap-2.5 rounded-2xl border border-primary/25 bg-primary/5 p-4 text-sm leading-6"><Lightbulb size={18} className="mt-0.5 shrink-0 text-primary" /><div><div className="text-[11px] font-extrabold uppercase tracking-wide text-primary">Remember this</div>{result.keyPoint}</div></div>}

<<<<<<< HEAD
      <div className="rounded-2xl border border-border bg-card p-4" data-testid="card-mcq-solver-chat">
        <div className="mb-2 text-[11px] font-extrabold uppercase tracking-wide text-muted-foreground">Still confused? Ask a follow-up</div>
        {chat.length === 0 && <div className="mb-3 flex flex-wrap gap-2">
          {['Explain in simpler words', 'Give me a mnemonic', ...(parsed.options.length > 1 ? [`Why not option ${LETTERS[result.answerIndex === 0 ? 1 : 0]}?`] : []), 'I think the answer is different'].map((q) => <button key={q} type="button" disabled={chatBusy} onClick={() => void ask(q)} className="rounded-full border border-border px-3 py-1.5 text-[11px] font-semibold text-muted-foreground hover:bg-muted hover:text-foreground disabled:opacity-50">{q}</button>)}
        </div>}
        {chat.length > 0 && <div className="mb-3 max-h-96 space-y-2 overflow-y-auto" aria-live="polite">
          {chat.map((t, i) => <div key={i} className={cn('max-w-[92%] whitespace-pre-line rounded-2xl px-3.5 py-2 text-xs leading-5', t.role === 'student' ? 'ml-auto bg-primary text-primary-foreground' : 'bg-muted')}>{t.text}</div>)}
          {chatBusy && <div className="inline-flex items-center gap-2 rounded-2xl bg-muted px-3.5 py-2 text-xs text-muted-foreground"><BrandSpinner />Thinking…</div>}
          <div ref={chatEnd} />
        </div>}
        <form onSubmit={(e) => { e.preventDefault(); void ask(followUp); }} className="flex items-end gap-2">
          <textarea value={followUp} maxLength={800} rows={1} onChange={(e) => setFollowUp(e.target.value)} onKeyDown={(e) => { if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); void ask(followUp); } }}
            placeholder="e.g. Why is C wrong? Or: explain the mechanism" className="max-h-28 min-h-10 flex-1 resize-none rounded-xl border border-border bg-background px-3 py-2 text-sm outline-none focus:ring-2 focus:ring-primary/20" data-testid="textarea-mcq-solver-followup" />
          <button type="submit" disabled={chatBusy || followUp.trim().length < 2} aria-label="Send" className="grid size-10 shrink-0 place-items-center rounded-xl bg-primary text-primary-foreground disabled:opacity-50" data-testid="button-mcq-solver-send"><Send size={16} /></button>
        </form>
      </div>

      <div className="flex flex-wrap items-center justify-center gap-2">
        <button type="button" onClick={() => void saveToNotebook()} disabled={noteState !== 'idle'} className="inline-flex items-center gap-1.5 rounded-xl border border-border px-4 py-2.5 text-xs font-extrabold hover:bg-muted disabled:opacity-70" data-testid="button-mcq-solver-save">
          {noteState === 'saved' ? <><Check size={14} className="text-emerald-600" />Saved to My notebook</> : <><NotebookPen size={14} />{noteState === 'saving' ? 'Saving…' : 'Save to My notebook'}</>}
        </button>
      </div>

=======
>>>>>>> 7ffca6aeae01139b6c012d9413fb8e00812f4c4f
      <p className="text-center text-[11px] leading-5 text-muted-foreground">AI can make mistakes. For anything that matters, confirm with your textbook or teacher.</p>
    </div>}
  </div>;
}
