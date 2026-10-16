// Auto-extracted route page — code-split via React.lazy() in App.tsx.
import { type ReactNode, type ComponentProps, type TouchEvent, useState, useEffect, useRef, createContext, useContext } from 'react';
import { QueryClient, QueryClientProvider, useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { Link, Route, Switch, useLocation, useParams, useSearch, Router as WouterRouter } from 'wouter';
import {
  ArrowLeft, ArrowRight, BookOpen, Check, CheckCircle2, ChevronRight,
  CircleHelp, Clock3, CreditCard, FileText, Flame, FolderOpen,
  LayoutDashboard, Library, LockKeyhole, LogOut, Menu, MoreHorizontal, Pencil, Plus,
  ReceiptText, Search, Settings, ShieldCheck, Sparkles, Stethoscope, Target, Trash2,
  TrendingUp, TrendingDown, Minus, Users, X, Zap, Bell, SlidersHorizontal, FileStack, NotebookPen, Bookmark,
  Flag, Trophy, MessageSquare, Landmark, Copy, QrCode, User as UserIcon, Mail, Phone, Hash,
  GraduationCap, Eye, EyeOff, Smartphone, UploadCloud, ImageOff,
  RotateCcw, ThumbsUp, ThumbsDown, CheckCheck, ClipboardCheck, AlertTriangle, Link2 as LinkIcon, Lightbulb,
  LayoutGrid, Presentation, Wand2, Crown, Globe, Star, Activity, SkipForward
} from 'lucide-react';
import { applyThemeVars } from '@/lib/theme';
import {
  getListMembershipPlansQueryKey, getListPaymentsQueryKey, getListMcqsQueryKey, getListModulesQueryKey, getListStudentsQueryKey, getListNotificationsQueryKey, getGetCurrentUserQueryKey,
  useApprovePayment, useCreateMembershipPlan, useCreateMcq, useCreateModule, useGetAdminDashboard,
  useGetCurrentUser, useGetStudentDashboard, useListFlashcards, useListMembershipPlans,
  useListMcqs, useListModules, useListNotifications, useListPayments, useListResources,
  useListStudents, useListSubjects, useListTopics, useRejectPayment,
  useSubmitPayment, useUpdateMembershipPlan,
} from '@workspace/api-client-react';
import type {
  AdminDashboard, Flashcard, Mcq, MembershipPlan, Module, Notification, Payment, Resource,
  Student, Subject, Topic, User
} from '@workspace/api-client-react';
import { ErrorBoundary } from '@/components/error-boundary';
import { Toaster } from '@/components/ui/toaster';
import { toast } from '@/hooks/use-toast';
import { useIsMobile } from '@/hooks/use-mobile';
import { TooltipProvider } from '@/components/ui/tooltip';
import NotFound from '@/pages/not-found';
import { authApi, academicApi, settingsApi, uploadFile, resolveUploadUrl, ApiRequestError, publicApi, pastPapersApi, notebookApi, savedSessionsApi, flaggedMcqsApi, feedbackApi, type MyFeedbackEntry, analyticsApi, type ProgressTrend, mcqImportApi, studentsAdminApi, paymentsAdminApi, membershipPlansAdminApi, mcqAdminApi, notificationsApi, siteContentApi, teamApi, moduleAdminApi, blocksApi, type Block, examsAdminApi, examsApi, explanationsApi, booksApi, type AdminBookStudent, DEFAULT_IMPORT_PATTERNS, STUDENT_STATUSES, type Institution, type Program, type AcademicYear, type Batch, type PastPaper, type NotebookEntry, type SavedSession, type FlaggedMcq, type FeedbackEntry, type McqCandidate, type StudentDetail, type SiteContent, type TeamMember, TEAM_CATEGORIES, TEAM_CATEGORY_LABELS, type AdminModule, type AdminExam, type StudentExam, type ExamAttemptRow, type ExamStartResponse, type ExamResult, type Exam, type ExplanationStatus, type PaymentDetails, type PaymentMethodConfig, aiVisualizerApi, type VisualizationSpec, LeaderboardRow } from '@/lib/api';

// Round 3, item 10 (performance) — this was `new QueryClient()` with no
// options, meaning every query defaulted to `staleTime: 0` and refetched
// on every component mount AND every window refocus. For a study app where
// most data (modules, subjects, MCQs, progress) doesn't change
// second-to-second, that's a real over-fetching cost on every navigation
// and every alt-tab back to the app — exactly the "waterfalls/refetch on
// every mount" pattern item 10 flagged as a likely culprit. A 30s
// staleTime means switching between pages you've already visited in the
// last 30s reuses cached data instead of re-hitting the API, and turning
// off refetch-on-window-focus stops a background-tab refocus from firing
// a full page's worth of requests. Individual queries that DO need to
// react fast (the live leaderboard's refetchInterval, mutations that
// invalidateQueries after a save) already set their own options, which
// override these defaults per-query — this only changes the fallback for
// queries that didn't specify anything.
import { Badge, SkeletonPage, cn, difficultyTone, useExamLock, useFocusMode, usePageTitle } from '@/lib/shared';
import { ExamClock, useCountdownStore } from '@/lib/countdown';

// Strict, forward-only exam flow (no Previous, no jumping around):
//  * Questions are served from a queue. "Next" locks the answer and removes the
//    question; "Skip" sends it to the END of the queue (once only).
//  * Skipped questions come back after every other question is done, in a
//    final round where Skip is gone — only Next (the answer is optional there,
//    so a student who truly doesn't know can leave it blank).
//  * When the queue is empty the paper is submitted automatically. The timer
//    still auto-submits too. There is no manual "Submit" button.
//  * Progress survives a refresh (sessionStorage) so reloading can't restart
//    the queue from question 1.
type ExamProgress = { queue: number[]; skipped: number[]; answers: Record<number, string | null> };
const progressKey = (attemptId: number) => `exam-progress-${attemptId}`;
function readProgress(attemptId: number, validIds: number[]): ExamProgress | null {
  try {
    const raw = sessionStorage.getItem(progressKey(attemptId));
    if (!raw) return null;
    const p = JSON.parse(raw) as ExamProgress;
    const ok = new Set(validIds);
    if (!Array.isArray(p.queue) || !p.queue.every((id) => ok.has(id))) return null;
    return { queue: p.queue, skipped: (p.skipped ?? []).filter((id) => ok.has(id)), answers: p.answers ?? {} };
  } catch { return null; }
}
function writeProgress(attemptId: number, p: ExamProgress) { try { sessionStorage.setItem(progressKey(attemptId), JSON.stringify(p)); } catch { /* storage unavailable */ } }

function TakeExam() {
  const params = useParams();
  const attemptId = Number(params.attemptId);
  const [, setLocation] = useLocation();
  const [session, setSession] = useState<ExamStartResponse | null>(null);
  const [queue, setQueue] = useState<number[]>([]);
  const [skipped, setSkipped] = useState<number[]>([]);
  const [answers, setAnswers] = useState<Record<number, string | null>>({});
  const [saving, setSaving] = useState(false);
  const [finishing, setFinishing] = useState(false);
  const submittedRef = useRef(false);
  // Ticks live in a store (lib/countdown.tsx) so the whole exam page doesn't re-render every second.
  const clock = useCountdownStore(0);
  // On for the whole time this screen is mounted. `strict` (true) hides Shell's
  // Exit button, and useExamLock blocks the browser back button and warns on
  // refresh/close.
  useFocusMode(true, true);
  useExamLock(true);
  const submit = useMutation({
    mutationFn: () => examsApi.submit(attemptId),
    onSuccess: () => { try { sessionStorage.removeItem(progressKey(attemptId)); } catch { /* ignore */ } setLocation(`/exams/result/${attemptId}`); },
    onError: () => { submittedRef.current = false; toast({ title: 'Could not submit yet', description: 'Check your connection and tap "Retry submit".', variant: 'destructive' }); },
  });
  const submitOnce = () => { if (submittedRef.current) return; submittedRef.current = true; setFinishing(true); submit.mutate(); };
  const saveAnswer = useMutation({ mutationFn: ({ mcqId, selectedAnswer }: { mcqId: number; selectedAnswer: string | null }) => examsApi.answer(attemptId, mcqId, selectedAnswer) });

  // The attempt was already created server-side (via Exams page's start
  // mutation); this page just needs the question set. Re-calling start is
  // safe — the backend returns the same in-progress attempt's questions.
  const load = useQuery({ queryKey: ['exam-session', attemptId], queryFn: async () => { const exams = await examsApi.list(); const exam = exams.find((e) => e.inProgressAttemptId === attemptId); if (!exam) throw new Error('Attempt not found'); const started = await examsApi.start(exam.id); return { ...started, examTitle: exam.title } as ExamStartResponse & { examTitle: string }; } });
  usePageTitle(load.data ? load.data.examTitle : 'Exam');

  useEffect(() => {
    if (load.data && !session) {
      setSession(load.data);
      const ids = load.data.questions.map((q) => q.id);
      const restored = readProgress(attemptId, ids);
      setQueue(restored ? restored.queue : ids);
      setSkipped(restored ? restored.skipped : []);
      setAnswers(restored ? restored.answers : {});
      // A restored, already-empty queue means the last question was finished before the reload.
      if (restored && restored.queue.length === 0) submitOnce();
      clock.set(Math.max(0, load.data.durationMinutes * 60 - Math.floor((Date.now() - new Date(load.data.startedAt).getTime()) / 1000)));
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [load.data, session]);

  useEffect(() => {
    if (!session) return;
    const timer = setInterval(() => clock.set((s) => {
      if (s <= 1) { clearInterval(timer); submitOnce(); return 0; }
      return s - 1;
    }), 1000);
    return () => clearInterval(timer);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [session]);

  // Keep the paper to itself: no copy / cut / paste / right-click, and a nudge when the tab is left.
  useEffect(() => {
    const block = (e: Event) => e.preventDefault();
    const onHidden = () => { if (document.visibilityState === 'hidden' && !submittedRef.current) toast({ title: 'Stay on the exam', description: 'Leaving this tab during a Pre-Proffs exam is not allowed.', variant: 'destructive' }); };
    document.addEventListener('copy', block); document.addEventListener('cut', block); document.addEventListener('paste', block); document.addEventListener('contextmenu', block);
    document.addEventListener('visibilitychange', onHidden);
    return () => { document.removeEventListener('copy', block); document.removeEventListener('cut', block); document.removeEventListener('paste', block); document.removeEventListener('contextmenu', block); document.removeEventListener('visibilitychange', onHidden); };
  }, []);

  if (load.isLoading || !session) return <SkeletonPage />;
  const total = session.questions.length;
  const byId = new Map(session.questions.map((q) => [q.id, q]));
  const current = queue.length ? byId.get(queue[0]) : undefined;
  const answeredCount = Object.values(answers).filter((v) => v != null).length;
  const doneCount = total - queue.length;
  const examTitle = (load.data as { examTitle?: string } | undefined)?.examTitle;

  if (finishing || !current) {
    return <div className="mx-auto grid min-h-[50vh] max-w-md place-items-center text-center" data-testid="exam-submitting"><div>
      <div className="mx-auto mb-4 grid size-12 place-items-center rounded-2xl bg-primary/10 text-primary"><CheckCircle2 size={24} /></div>
      <h2 className="text-lg font-extrabold">{submit.isError ? 'Submission is taking a moment' : 'Submitting your exam…'}</h2>
      <p className="mt-2 text-xs text-muted-foreground">{submit.isError ? 'Your answers are saved. Retry to finish.' : 'All questions are done. Please don\'t close this page.'}</p>
      {submit.isError && <button onClick={() => submitOnce()} className="mt-5 rounded-xl bg-primary px-5 py-2.5 text-xs font-extrabold text-primary-foreground" data-testid="button-exam-retry-submit">Retry submit</button>}
    </div></div>;
  }

  const revisit = skipped.includes(current.id);
  const selected = answers[current.id] ?? null;
  const skippedLeft = queue.filter((id) => skipped.includes(id)).length;
  const revisitNumber = revisit ? skipped.filter((id) => queue.includes(id)).indexOf(current.id) + 1 : 0;
  const persist = (q: number[], sk: number[], an: Record<number, string | null>) => writeProgress(attemptId, { queue: q, skipped: sk, answers: an });

  const selectAnswer = (opt: string) => {
    if (saving) return;
    const next = { ...answers, [current.id]: opt };
    setAnswers(next); persist(queue, skipped, next);
    saveAnswer.mutate({ mcqId: current.id, selectedAnswer: opt });
  };

  // Locks the answer (re-saves it and waits for the server) and moves on. The last question submits the paper.
  const goNext = async () => {
    if (saving) return;
    if (!revisit && selected == null) return;
    setSaving(true);
    try {
      if (selected != null) await examsApi.answer(attemptId, current.id, selected);
    } catch {
      setSaving(false);
      toast({ title: 'Could not save your answer', description: 'Check your connection and press Next again.', variant: 'destructive' });
      return;
    }
    const rest = queue.slice(1);
    setQueue(rest); persist(rest, skipped, answers);
    setSaving(false);
    if (rest.length === 0) submitOnce();
  };

  // Sends the question to the end of the paper; it returns once (no Skip there) after all the others.
  const goSkip = () => {
    if (saving || revisit) return;
    const rest = [...queue.slice(1), current.id];
    const sk = [...skipped, current.id];
    setQueue(rest); setSkipped(sk); persist(rest, sk, answers);
  };

  return <div className="mx-auto max-w-4xl select-none px-1 sm:px-0" onCopy={(e) => e.preventDefault()}>
    <div className="mb-5 flex flex-wrap items-center justify-between gap-2 rounded-2xl border border-border bg-card px-4 py-3 sm:px-5">
      <div className="min-w-0"><div className="truncate text-xs font-extrabold" data-testid="text-exam-title">{examTitle}</div>
        <div className="text-[11px] text-muted-foreground" data-testid="text-exam-progress">{revisit ? `Skipped question ${revisitNumber} of ${skippedLeft + (revisitNumber - 1)}` : `Question ${Math.min(doneCount + 1, total)} of ${total}`} · {answeredCount} answered{skippedLeft > 0 ? ` · ${skippedLeft} skipped` : ''}</div></div>
      <ExamClock store={clock} />
    </div>
    <div className="mb-4 flex gap-0.5" aria-hidden="true">{session.questions.map((q) => {
      const finished = !queue.includes(q.id);
      const isCurrent = q.id === current.id;
      return <span key={q.id} className={cn('h-1.5 flex-1 rounded-full', isCurrent ? 'bg-primary' : finished ? (answers[q.id] != null ? 'bg-primary/45' : 'bg-muted-foreground/30') : skipped.includes(q.id) ? 'bg-amber-400/80' : 'bg-muted')} />;
    })}</div>
    {revisit && <div className="mb-4 flex items-start gap-2.5 rounded-2xl border border-amber-400/40 bg-amber-400/10 px-4 py-3 text-xs" data-testid="banner-exam-skipped-round"><SkipForward size={15} className="mt-0.5 shrink-0 text-amber-500" /><div><div className="font-extrabold">Skipped question — final attempt</div><div className="mt-0.5 text-muted-foreground">This can't be skipped again. Answer it or leave it blank, then press Next. The exam submits automatically after the last question.</div></div></div>}
    <div className="rounded-3xl border border-border bg-card p-6 md:p-9" key={current.id}><Badge tone={difficultyTone(current.difficulty)}>{current.difficulty}</Badge><h2 className="mt-6 text-xl font-extrabold leading-8">{current.question}</h2>
      <div className="mt-7 space-y-3">{current.options.map((opt, i) => <button key={opt} disabled={saving} onClick={() => selectAnswer(opt)} className={cn('flex w-full items-center gap-3 rounded-xl border p-4 text-left text-sm transition-colors', selected === opt ? 'border-primary bg-[#e6f3ed]' : 'border-border hover:bg-muted')} data-testid={`button-exam-answer-${i}`}><span className="grid size-7 shrink-0 place-items-center rounded-lg bg-muted font-mono-app text-[11px]">{String.fromCharCode(65 + i)}</span>{opt}</button>)}</div></div>
    <div className="mt-5 flex items-center justify-between gap-3">
      <div className="flex items-center gap-1.5 text-[11px] text-muted-foreground"><LockKeyhole size={12} /><span>Forward only — you can't go back.</span></div>
      <div className="flex gap-2">
        {!revisit && <button disabled={saving} onClick={goSkip} className="inline-flex items-center gap-1.5 rounded-xl border border-border bg-card px-4 py-2.5 text-xs font-bold disabled:opacity-40" data-testid="button-exam-skip"><SkipForward size={14} />Skip</button>}
        <button disabled={saving || (!revisit && selected == null)} onClick={goNext} className="inline-flex items-center gap-1.5 rounded-xl bg-primary px-5 py-2.5 text-xs font-extrabold text-primary-foreground disabled:opacity-40" data-testid="button-exam-next">{saving ? 'Saving…' : queue.length === 1 ? 'Finish' : 'Next'}<ArrowRight size={14} /></button>
      </div>
    </div>
  </div>;
}

export default TakeExam;
