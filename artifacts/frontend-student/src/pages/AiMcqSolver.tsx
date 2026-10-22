// AI MCQ Solver. A student pastes any MCQ they're unsure about (question + options, each option on its
// own line starting A. / B. / ...) and gets the best answer, a clear explanation, why each option is
// right or wrong, and a one-line take-home point. The last question and answer are kept in this browser
// tab (sessionStorage) so a refresh or the app being backgrounded doesn't lose them.
import { useRef, useState } from 'react';
import { Check, Lightbulb, RotateCcw, Sparkles, TriangleAlert, X } from 'lucide-react';
import { aiMcqSolverApi, ApiRequestError, type SolvedMcq } from '@/lib/api';
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

function load(): { text: string; parsed: Parsed | null; result: SolvedMcq | null } {
  try { const v = JSON.parse(sessionStorage.getItem(STORAGE_KEY) ?? 'null'); if (v && typeof v.text === 'string') return { text: v.text, parsed: v.parsed ?? null, result: v.result ?? null }; } catch { /* ignore */ }
  return { text: '', parsed: null, result: null };
}

export default function AiMcqSolver() {
  const restored = useRef(load()).current;
  const [text, setText] = useState(restored.text);
  const [parsed, setParsed] = useState<Parsed | null>(restored.parsed);
  const [result, setResult] = useState<SolvedMcq | null>(restored.result);
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
    } catch (e) {
      if (id !== run.current) return;
      setError(e instanceof ApiRequestError ? e.message : 'Something went wrong. Try again.');
    } finally { if (id === run.current) setBusy(false); }
  };
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

      <p className="text-center text-[11px] leading-5 text-muted-foreground">AI can make mistakes. For anything that matters, confirm with your textbook or teacher.</p>
    </div>}
  </div>;
}
