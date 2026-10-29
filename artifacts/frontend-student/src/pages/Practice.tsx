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
  LayoutGrid, Presentation, Wand2, Crown, Globe, Star, Activity, Shuffle, Play,
  Infinity as InfinityIcon
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
import { authApi, academicApi, settingsApi, uploadFile, resolveUploadUrl, ApiRequestError, publicApi, pastPapersApi, savedMcqsApi, type SessionProgress, savedSessionsApi, flaggedMcqsApi, feedbackApi, type MyFeedbackEntry, analyticsApi, type ProgressTrend, mcqImportApi, studentsAdminApi, paymentsAdminApi, membershipPlansAdminApi, mcqAdminApi, notificationsApi, siteContentApi, teamApi, moduleAdminApi, blocksApi, type Block, examsAdminApi, examsApi, explanationsApi, booksApi, type AdminBookStudent, DEFAULT_IMPORT_PATTERNS, STUDENT_STATUSES, type Institution, type Program, type AcademicYear, type Batch, type PastPaper, type NotebookEntry, type SavedSession, type FlaggedMcq, type FeedbackEntry, type McqCandidate, type StudentDetail, type SiteContent, type TeamMember, TEAM_CATEGORIES, TEAM_CATEGORY_LABELS, type AdminModule, type AdminExam, type StudentExam, type ExamAttemptRow, type ExamStartResponse, type ExamResult, type Exam, type ExplanationStatus, type PaymentDetails, type PaymentMethodConfig, aiVisualizerApi, type VisualizationSpec, LeaderboardRow } from '@/lib/api';

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
import { buildStudySet, recordSession } from '@/lib/study';
import { Badge, EmptyState, PracticeResultCard, SectionHeader, SkeletonPage, cn, difficultyTone, useFocusMode } from '@/lib/shared';
import { queryClient, invalidatePracticeQueries } from '@/lib/query-client';
import { PracticeTimer, useCountdownStore } from '@/lib/countdown';
import { useResumeProgress, type ResumeInfo } from '@/components/study/useResumeProgress';
import { PracticeNotebook } from '@/components/study/PracticeNotebook';
import { HighlighterBar, usePracticeHighlighter } from '@/components/study/PracticeHighlighter';

function Practice() {
  const search = useSearch();
  const params = new URLSearchParams(search);
  const topicId = Number(params.get('topic')) || undefined;
  const pastPaperId = Number(params.get('pastPaperId')) || undefined;
  const mcqId = Number(params.get('mcqId')) || undefined;
  // ?resume=<saved session id> re-opens an in-progress session exactly where it was left.
  const resumeId = Number(params.get('resume')) || undefined;
  const [, navigate] = useLocation();
  // v60: ?set=weak|mistakes&count=N builds a mixed set (weak topics / this device's mistakes).
  const studySet = ['weak', 'mistakes', 'flagged', 'ids'].includes(params.get('set') ?? '') ? (params.get('set') as string) : null;
  const studyIds = (params.get('ids') ?? '').split(',').map(Number).filter((n) => Number.isInteger(n) && n > 0);
  const studyCount = [10, 20, 50].includes(Number(params.get('count'))) ? Number(params.get('count')) : 20;
  // Drives the topic empty-state below: an unpaid/unactivated student sees a
  // call to activate, while a paid member sees a loading message instead of
  // an admission that there's genuinely nothing here yet. Same query/queryKey
  // shared.tsx's paidMember check already runs, so this adds no extra request.
  const dashboardQ = useGetStudentDashboard();
  const paidMember = dashboardQ.data?.membershipStatus === 'ACTIVE';
  const baseQ = useListMcqs(studySet ? { mcqId: -1 } : mcqId ? { mcqId } : pastPaperId ? { pastPaperId } : topicId ? { topicId } : undefined);
  const setQ = useQuery({ queryKey: ['study-set', studySet, studyCount, studyIds.join(',')], queryFn: () => buildStudySet(studySet!, studyCount, studyIds), enabled: !!studySet, staleTime: Infinity, gcTime: 0 });
  // Subject-wise past-paper attempt: ?pastPaperId=5&subject=pathology&subject=pharmacology
  // narrows the paper to the questions tagged with those subjects (keys come from
  // GET /past-papers/:id/subjects, chosen on the paper's detail page).
  const subjectKeys = pastPaperId && !studySet && !mcqId ? params.getAll('subject').filter(Boolean) : [];
  const subjectFilterOn = subjectKeys.length > 0;
  const subjectsQ = useQuery({ queryKey: ['past-paper-subjects', pastPaperId], queryFn: () => pastPapersApi.subjects(pastPaperId!), enabled: subjectFilterOn, staleTime: 60_000 });
  const filteredData = (() => {
    if (!subjectFilterOn || !baseQ.data || !subjectsQ.data) return undefined;
    const allowed = new Set(subjectsQ.data.subjects.filter((s) => subjectKeys.includes(s.key)).flatMap((s) => s.mcqIds));
    return baseQ.data.filter((m) => allowed.has(m.id));
  })();
  const q = studySet ? setQ : subjectFilterOn ? { ...baseQ, data: filteredData, isLoading: baseQ.isLoading || subjectsQ.isLoading } as unknown as typeof baseQ : baseQ;
  const [index, setIndex] = useState(0);
  // Every answer picked so far, keyed by mcq id — lets the student jump
  // freely between questions (via the number grid or Prev/Next) without
  // losing earlier answers, matching a real exam engine rather than a
  // strictly-linear drill.
  const [answers, setAnswers] = useState<Record<number, string | null>>({});
  const [flaggedIds, setFlaggedIds] = useState<Set<number>>(new Set());
  // Questions the student has opened and then moved away from — if still unanswered they show yellow (skipped) in the navigator.
  const [visitedIds, setVisitedIds] = useState<Set<number>>(new Set());
  // Full length of the countdown (seconds) so the timer ring can show how much is left.
  const [timerTotal, setTimerTotal] = useState(0);
  // Optimistic overrides on top of the server's saved list (true = saved, false = un-saved).
  const [savedOverride, setSavedOverride] = useState<Record<number, boolean>>({});
  const [panel, setPanel] = useState<'hint' | 'explain' | 'references' | null>(null);
  const [paused, setPaused] = useState(false);
  const [finished, setFinished] = useState(false);
  // Timed/untimed setup gate — null means "not chosen yet, show the setup
  // screen". Timed mode counts DOWN from an exam-style time budget
  // (~90s/question, a standard board-exam pace) rather than counting up,
  // and auto-submits at zero.
  const [mode, setMode] = useState<'timed' | 'untimed' | null>(null);
  // Which card is highlighted on the "before you start" setup screen,
  // before Start is pressed — distinct from `mode`, which is null until
  // the session actually begins (and flips the whole screen over to the
  // live practice view). Timer is highlighted by default to match the
  // reference layout (Timer selected, with the minutes editor open).
  const [pendingMode, setPendingMode] = useState<'timed' | 'untimed'>('timed');
  // null = use the auto-estimated time budget (~1.5 min/question); once the
  // student edits it (stepper, preset chip, or typing directly), their
  // choice sticks even if they flip between Timer/Timeless and back.
  const [customMinutes, setCustomMinutes] = useState<number | null>(null);
  // Ticks live in a store, not state: a per-second setState re-rendered this whole page (see lib/countdown.tsx).
  const countdown = useCountdownStore(0);
  const setRemainingSeconds = countdown.set;
  // "Shuffle question order" toggle on the setup screen — off by default so
  // the set stays in its curated/syllabus order unless the student opts in.
  const [shuffleQuestions, setShuffleQuestions] = useState(false);
  // Difficulty filter on the setup screen — 'all' keeps the full set;
  // otherwise only questions matching that difficulty are offered.
  const [selectedDifficulty, setSelectedDifficulty] = useState<'all' | 'easy' | 'moderate' | 'hard'>('all');
  // Question-count cap on the setup screen. Stored as a mode rather than a
  // raw number so it stays meaningful if the difficulty filter shrinks the
  // available pool below 10/20 — 'all' always means "every question left
  // after the difficulty filter", and '10'/'20' are clamped at use-time.
  const [countMode, setCountMode] = useState<'10' | '20' | 'all' | 'custom'>('20');
  // Student-typed question count (used when countMode === 'custom'); kept as text so the box can be empty while typing.
  const [customCount, setCustomCount] = useState('');
  // The order actually being played this session, locked in once Start is
  // pressed (see the setup screen below) so the question navigator grid
  // stays stable across answers/prev/next even if shuffle is on. null before
  // a session starts, meaning "use the server order".
  const [orderedMcqs, setOrderedMcqs] = useState<Mcq[] | null>(null);
  const mcqs: Mcq[] = q.data ?? [];
  const activeMcqs = orderedMcqs ?? mcqs;
  const current = activeMcqs[index];
  // v89: automatic highlighter — select text in the question / options / explanation and it is highlighted (per question, remembered on this device)
  const hl = usePracticeHighlighter(current?.id ?? 0);
  // Focus mode: on for the duration of an active session (mode chosen,
  // not yet finished) — off during setup and on the results screen.
  useFocusMode(mode !== null && !finished);
  const sessionStartRef = useRef<number>(Date.now());
  // Bug fix: this had no onError at all — if the submit failed (expired
  // membership, network blip, server error), the student saw the results
  // screen render normally with zero indication their session was never
  // recorded, and then wondered why it never showed up on the dashboard or
  // leaderboard. Every other mutation in this file already surfaces
  // failures via toast (see reportFlag/saveSession below) — this matches
  // that convention.
  const submitAnswer = useMutation({
    mutationFn: analyticsApi.submitSession,
    // Network blips / dropped connections (no HTTP response at all) are retried
    // twice automatically; real server answers (4xx/5xx JSON) are not.
    retry: (failureCount: number, err: unknown) => !(err instanceof ApiRequestError) && failureCount < 2,
    retryDelay: (attempt: number) => 1000 * (attempt + 1),
    onSuccess: invalidatePracticeQueries,
    onError: (err: unknown) => toast({ title: 'Session not saved', description: err instanceof ApiRequestError ? err.message : "Couldn't reach the server to record this session — check your connection. Your answers below are still visible; tap Finish again after reconnecting.", variant: 'destructive' }),
  });
  // "Save" = file this question under Saved MCQs (Block › Module › Subject › Topic) to re-attempt later.
  const savedQ = useQuery({ queryKey: ['saved-mcqs'], queryFn: savedMcqsApi.list });
  const saveMcq = useMutation({
    mutationFn: ({ mcqId, save }: { mcqId: number; save: boolean }) => save ? savedMcqsApi.create(mcqId) : savedMcqsApi.removeByMcq(mcqId),
    onSuccess: (_d, v) => { queryClient.invalidateQueries({ queryKey: ['saved-mcqs'] }); toast({ title: v.save ? 'Saved to Saved MCQs' : 'Removed from Saved MCQs' }); },
    onError: (err: unknown, v) => {
      setSavedOverride((prev) => { const n = { ...prev }; delete n[v.mcqId]; return n; });
      toast({ title: 'Could not update saved question', description: err instanceof ApiRequestError ? err.message : 'Something went wrong.', variant: 'destructive' });
    },
  });
  const reportFlag = useMutation({
    mutationFn: flaggedMcqsApi.create,
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ['flagged-mcqs'] }),
    onError: (err: unknown) => toast({ title: 'Could not flag this question', description: err instanceof ApiRequestError ? err.message : 'Something went wrong.', variant: 'destructive' }),
  });
  const saveSession = useMutation({
    mutationFn: savedSessionsApi.create,
    onSuccess: () => { queryClient.invalidateQueries({ queryKey: ['saved-sessions'] }); toast({ title: 'Session saved', description: 'Find it later on the Saved Sessions page.' }); },
    onError: (err: unknown) => toast({ title: 'Could not save this session', description: err instanceof ApiRequestError ? err.message : 'Something went wrong.', variant: 'destructive' }),
  });
  // current can be undefined while loading/empty — askAi's mutationFn is only
  // ever invoked from a click once `current` is guaranteed to exist below,
  // but the hook itself must still be declared unconditionally every render.
  const askAi = useMutation({ mutationFn: () => explanationsApi.askAi(current!.id) });
  // Admin control (Settings > Features > "Ask AI to explain") — off hides
  // the button below entirely. Same query key SideNav uses for
  // AI_VISUALIZER_ENABLED, so this just reuses that cached fetch instead of
  // triggering a second one.
  const siteContentQ = useQuery({ queryKey: ['site-content'], queryFn: siteContentApi.get });
  const aiExplainEnabled = siteContentQ.data?.AI_EXPLAIN_ENABLED !== 'false';
  // Trial-only students are capped at TRIAL_DAILY_MCQ_LIMIT MCQs/UTC-day
  // (admin setting, Settings → Access & trial). `limited` is false for a
  // paying student or an unlimited (0) cap, so nothing below renders for them.
  const trialUsageQ = useQuery({ queryKey: ['trial-mcq-usage'], queryFn: analyticsApi.trialMcqUsage, staleTime: 30_000 });
  const trialUsage = trialUsageQ.data;
  const trialLimited = trialUsage?.limited === true;
  const answeredCount = Object.values(answers).filter((v) => v != null).length;
  const percentAnswered = activeMcqs.length ? Math.round((answeredCount / activeMcqs.length) * 100) : 0;
  // Remaining allowance if the student finished right now — answers already
  // given in this still-open session haven't hit the server yet (submission
  // only happens at Finish/exit), so this is trialUsage.remaining (this
  // morning's count) minus what's been answered live, not just the raw
  // server figure.
  const trialRemainingNow = trialLimited ? Math.max(0, (trialUsage!.remaining ?? 0) - answeredCount) : null;

  // ---- "Start where I left off": progress is auto-saved into Saved Sessions ----
  const resumeData = useResumeProgress();
  const progressOn = useRef(false);            // true only while a resumable session is being played
  const progressChain = useRef<Promise<unknown>>(Promise.resolve()); // serialises PUT/DELETE so a late save can't resurrect a finished session
  const resumeHydrated = useRef(false);
  const canResume = !!(topicId || pastPaperId) && !studySet && !mcqId && !subjectFilterOn;
  const buildProgress = (): SessionProgress | null => {
    if (!canResume || !orderedMcqs?.length || !mode) return null;
    const ans: Record<string, string | null> = {};
    for (const m of orderedMcqs) if (answers[m.id] != null) ans[String(m.id)] = answers[m.id] as string;
    return { kind: 'progress', topicId, pastPaperId, mcqIds: orderedMcqs.map((m) => m.id), answers: ans, index, mode, remainingSeconds: mode === 'timed' ? Math.max(0, Math.round(countdown.get())) : undefined, answered: Object.keys(ans).length, total: orderedMcqs.length };
  };
  const persistProgress = (force = false): Promise<unknown> => {
    const cfg = buildProgress();
    if (!cfg || !progressOn.current || (!force && !cfg.answered)) return Promise.resolve();
    const label = mcqs[0]?.topic || mcqs[0]?.subject || (pastPaperId ? 'Past paper' : 'Practice');
    progressChain.current = progressChain.current
      .then(() => savedSessionsApi.saveProgress({ name: `${label} — ${cfg.answered}/${cfg.total} answered`, config: cfg }))
      .then(() => queryClient.invalidateQueries({ queryKey: ['saved-sessions'] }))
      .catch(() => { /* best-effort: never interrupt the student's practice */ });
    return progressChain.current;
  };
  const clearProgress = () => {
    progressOn.current = false;
    if (!canResume) return;
    progressChain.current = progressChain.current
      .then(() => savedSessionsApi.clearProgress({ topicId, pastPaperId }))
      .then(() => queryClient.invalidateQueries({ queryKey: ['saved-sessions'] }))
      .catch(() => {});
  };
  const resumeFrom = (info: ResumeInfo) => {
    const byId = new Map(mcqs.map((m) => [m.id, m]));
    const list = info.progress.mcqIds.map((id) => byId.get(id)).filter((m): m is Mcq => !!m);
    if (!list.length) return false;
    const ans: Record<number, string | null> = {};
    for (const [k, v] of Object.entries(info.progress.answers)) if (byId.has(Number(k)) && v != null) ans[Number(k)] = v;
    const left = info.progress.remainingSeconds ?? 0;
    const m: 'timed' | 'untimed' = info.progress.mode === 'timed' && left > 0 ? 'timed' : 'untimed';
    progressOn.current = true;
    setOrderedMcqs(list); setAnswers(ans); setIndex(Math.min(info.progress.index, list.length - 1));
    setPendingMode(m); setMode(m); setRemainingSeconds(m === 'timed' ? left : 0); setTimerTotal(m === 'timed' ? left : 0);
    sessionStartRef.current = Date.now();
    return true;
  };

  const finishSession = () => {
    clearProgress();
    const sessionAnswers = activeMcqs.map((m) => ({ mcqId: m.id, selectedAnswer: answers[m.id] ?? null })).filter((a) => a.selectedAnswer != null);
    const durationSeconds = Math.max(0, Math.round((Date.now() - sessionStartRef.current) / 1000));
    try { recordSession(activeMcqs, answers, topicId); } catch { /* ledger is best-effort */ }
    if (sessionAnswers.length) submitAnswer.mutate({ topicId, answers: sessionAnswers, durationSeconds, mode: mode ?? undefined });
    setFinished(true);
  };

  // Force-submit the moment a trial-only student's daily MCQ cap is hit
  // mid-session, instead of letting them keep answering only to have the
  // whole batch rejected at Finish (see trialDailyMcqCapError on the
  // server) — this way whatever they've already answered still gets
  // recorded. `answeredCount > 0` guards against firing before they've
  // touched a question (e.g. a session opened after the cap was already
  // used up elsewhere today).
  useEffect(() => {
    if (!trialLimited || finished || !mode || answeredCount === 0) return;
    if (trialRemainingNow !== 0) return;
    toast({ title: 'Daily trial limit reached', description: `Trial accounts are limited to ${trialUsage?.limit} MCQs a day. This session was submitted with the ${answeredCount} you've answered — come back tomorrow, or ask about upgrading for unlimited access.` });
    finishSession();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [trialRemainingNow, trialLimited, finished, mode, answeredCount]);
  const restartSession = () => { progressOn.current = false; setIndex(0); setAnswers({}); setFlaggedIds(new Set()); setVisitedIds(new Set()); setTimerTotal(0); setPanel(null); setPaused(false); setFinished(false); setMode(null); setRemainingSeconds(0); setPendingMode('timed'); setCustomMinutes(null); setOrderedMcqs(null); setSelectedDifficulty('all'); setCountMode('20'); setCustomCount(''); askAi.reset(); };
  // Starting a session from the (long) setup screen used to leave the page scrolled down to the
  // question navigator. Land on the first question instead.
  useEffect(() => {
    if (!mode) return;
    const id = requestAnimationFrame(() => window.scrollTo?.({ top: 0 }));
    return () => cancelAnimationFrame(id);
  }, [mode]);
  // Redo only the questions missed this session: same screen, same questions, fresh answers, no timer.
  const redoWrong = (wrong: Mcq[]) => {
    if (!wrong.length) return;
    progressOn.current = false; setOrderedMcqs(wrong); setIndex(0); setAnswers({}); setFlaggedIds(new Set()); setVisitedIds(new Set()); setTimerTotal(0); setPanel(null); setPaused(false);
    setFinished(false); setMode('untimed'); setRemainingSeconds(0); sessionStartRef.current = Date.now(); askAi.reset();
    window.scrollTo?.({ top: 0 });
  };

  // Re-open a saved in-progress session once its questions have loaded (?resume=<id>).
  useEffect(() => {
    if (!resumeId || resumeHydrated.current || mode || finished || !mcqs.length || resumeData.isLoading) return;
    resumeHydrated.current = true;
    const info = resumeData.bySession.get(resumeId);
    if (!info || !resumeFrom(info)) toast({ title: "Couldn't restore that session", description: 'It may have been finished or removed. Starting fresh.' });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [resumeId, mcqs.length, resumeData.isLoading, mode, finished]);
  // Auto-save progress shortly after every answer / question change.
  const answeredNow = Object.values(answers).filter((v) => v != null).length;
  useEffect(() => {
    if (!mode || finished || !orderedMcqs || answeredNow === 0) return;
    const t = setTimeout(() => { void persistProgress(); }, 1200);
    return () => clearTimeout(t);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [answers, index, mode, finished, orderedMcqs]);

  useEffect(() => {
    if (mode !== 'timed' || finished || paused) return;
    const id = setInterval(() => setRemainingSeconds((s) => {
      if (s <= 1) { finishSession(); return 0; }
      return s - 1;
    }), 1000);
    return () => clearInterval(id);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [mode, finished, paused]);

  if (!q.isLoading && !mcqs.length) {
    // Topic case only: an unpaid/unactivated student is told to activate;
    // a paid member instead sees a loading message rather than "no
    // questions", since for them an empty result here is treated as
    // content still being fetched, not as truly having nothing to show.
    const topicTitle = topicId ? (paidMember ? 'Loading data' : 'No questions here yet') : 'Pick a topic to practice';
    const topicBody = topicId ? (paidMember ? '' : 'Activate your account to load content') : 'Head to Blocks → a module → a subject → a topic, then hit Start to begin a focused practice session.';
    return <div className="max-w-6xl"><SectionHeader eyebrow="Daily practice" title="Practice with purpose" action={<Link href={pastPaperId ? '/past-papers' : '/blocks'} className="text-xs font-bold text-primary" data-testid="link-practice-back-modules"><ArrowLeft size={13} className="mr-1 inline" /> {pastPaperId ? 'Past papers' : 'Blocks'}</Link>} /><EmptyState icon={Target} title={pastPaperId ? 'No questions in this paper yet' : topicTitle} body={pastPaperId ? "Your academic team hasn't uploaded questions for this past paper yet." : topicBody} /></div>;
  }
  if (q.isLoading) return <SkeletonPage />;

  if (finished) {
    return <div className="max-w-6xl"><SectionHeader eyebrow="Daily practice" title="Session complete" /><PracticeResultCard mcqs={activeMcqs} answers={answers} onRestart={restartSession} onRedoWrong={redoWrong} backHref={pastPaperId ? '/past-papers' : '/blocks'} backLabel={pastPaperId ? 'Back to past papers' : 'Back to blocks'} /></div>;
  }

  if (!mode) {
    // Difficulty mix for this set, shown as quick chips on the hero AND
    // used to drive the "Select Difficulty Level" cards below — 'easy'/
    // 'moderate'/'hard' ordering when present, any other custom labels
    // tacked on after.
    const difficultyCounts = mcqs.reduce<Record<string, number>>((acc, m) => { const key = (m.difficulty || 'moderate').toLowerCase(); acc[key] = (acc[key] ?? 0) + 1; return acc; }, {});
    const difficultyOrder = ['easy', 'moderate', 'hard'];
    const difficultyEntries = Object.entries(difficultyCounts).sort(([a], [b]) => {
      const ia = difficultyOrder.indexOf(a), ib = difficultyOrder.indexOf(b);
      return (ia === -1 ? 99 : ia) - (ib === -1 ? 99 : ib);
    });
    // Questions left after the difficulty filter — this is the pool the
    // question-count cap and the Test Summary below both work off of.
    const difficultyFilteredMcqs = selectedDifficulty === 'all' ? mcqs : mcqs.filter((m) => (m.difficulty || 'moderate').toLowerCase() === selectedDifficulty);
    const availableCount = difficultyFilteredMcqs.length;
    const customN = Math.floor(Number(customCount));
    const customValid = Number.isFinite(customN) && customN >= 1;
    const rawEffectiveCount = countMode === 'all' ? availableCount
      : countMode === 'custom' ? (customValid ? Math.min(customN, availableCount) : 0)
      : Math.min(Number(countMode), availableCount);
    // Trial-only students can't start a set bigger than what's left of their
    // daily MCQ cap (see lib/trial.ts on the server) — clamp the planned
    // test size down to that, same as the live session force-submits once
    // the cap is hit mid-way (see the useEffect above).
    const trialCap = trialLimited ? (trialUsage!.remaining ?? 0) : null;
    const effectiveCount = trialCap !== null ? Math.min(rawEffectiveCount, trialCap) : rawEffectiveCount;
    // 1 minute per question — standard board-exam pacing — based on the
    // actual planned test size, not the full unfiltered set.
    const autoMinutes = Math.max(1, effectiveCount);
    const effectiveMinutes = customMinutes ?? autoMinutes;
    const isAuto = customMinutes === null;
    const difficultyLabels: Record<typeof selectedDifficulty, string> = { all: 'All', easy: 'Easy', moderate: 'Medium', hard: 'Hard' };
    const topicLabel = mcqs[0]?.topic || mcqs[0]?.subject || mcqs[0]?.module || (pastPaperId ? 'Past paper' : 'Practice set');
    const finishClock = pendingMode === 'timed' ? new Date(Date.now() + effectiveMinutes * 60000).toLocaleTimeString([], { hour: 'numeric', minute: '2-digit' }) : null;
    const startSession = () => {
      // Bug fix: this used to take the FIRST N questions of the pool, so
      // picking "10" always gave the same starting 10. When the chosen size
      // (count cap and/or trial cap — see effectiveCount) is smaller than the
      // pool, draw a fresh random sample each time instead. The sample keeps
      // its syllabus order unless "Shuffle question order" is on.
      const picked = randomSample(difficultyFilteredMcqs, effectiveCount);
      setOrderedMcqs(shuffleQuestions ? shuffleArray(picked) : picked);
      setMode(pendingMode);
      setRemainingSeconds(pendingMode === 'timed' ? effectiveMinutes * 60 : 0);
      setTimerTotal(pendingMode === 'timed' ? effectiveMinutes * 60 : 0);
      sessionStartRef.current = Date.now();
      progressOn.current = true;
    };
    return <div className="mx-auto max-w-xl">
      <div className="overflow-hidden rounded-3xl border border-border bg-card shadow-[var(--shadow-md)]">
        {/* Header card — light indigo-tinted band with topic identity + at-a-glance
            counts, replacing the old solid primary-color hero. */}
        <div className="bg-gradient-to-br from-indigo-50 via-indigo-50 to-blue-50 px-5 pb-5 pt-5 sm:px-7 sm:pt-7">
          <div className="flex items-start gap-3">
            <Link href={pastPaperId ? '/past-papers' : '/blocks'} className="mt-2.5 shrink-0 text-indigo-400 transition-colors hover:text-indigo-600" data-testid="link-practice-back-modules"><ArrowLeft size={18} /></Link>
            <div className="grid size-11 shrink-0 place-items-center rounded-xl bg-gradient-to-br from-indigo-500 to-blue-600 text-white shadow-sm"><Target size={20} /></div>
            <div className="min-w-0 pt-0.5">
              <h2 className="truncate text-base font-extrabold text-foreground sm:text-lg" data-testid="text-practice-topic-name">{topicLabel}</h2>
              <p className="mt-0.5 text-xs text-muted-foreground">Select difficulty and question count</p>
            </div>
          </div>
          <div className="mt-5 grid grid-cols-4 text-center">
            <div><div className="text-xl font-extrabold text-blue-600">{mcqs.length}</div><div className="text-[10px] text-muted-foreground">Total</div></div>
            <div><div className="text-xl font-extrabold text-green-600">{difficultyCounts.easy ?? 0}</div><div className="text-[10px] text-muted-foreground">Easy</div></div>
            <div><div className="text-xl font-extrabold text-amber-500">{difficultyCounts.moderate ?? 0}</div><div className="text-[10px] text-muted-foreground">Medium</div></div>
            <div><div className="text-xl font-extrabold text-red-500">{difficultyCounts.hard ?? 0}</div><div className="text-[10px] text-muted-foreground">Hard</div></div>
          </div>
        </div>

        <div className="p-5 sm:p-7">
          {trialLimited && <div
            className={cn(
              'relative mb-5 overflow-hidden rounded-2xl p-4 text-white shadow-[0_8px_24px_-6px_rgba(0,0,0,0.35),inset_0_1px_0_rgba(255,255,255,0.25)]',
              trialCap === 0
                ? 'bg-gradient-to-br from-[#e0654f] via-[#c0503f] to-[#8f3a2e]'
                : 'bg-gradient-to-br from-[#f5b25a] via-[#e5a952] to-[#c17f2a]'
            )}
            data-testid="banner-trial-mcq-limit"
          >
            {/* Subtle glossy highlight + soft glow blob — the "3D" part: a
                faint top sheen plus a blurred circle peeking from the
                corner, both purely decorative and clipped by overflow-hidden. */}
            <div className="pointer-events-none absolute inset-x-0 top-0 h-1/2 bg-gradient-to-b from-white/25 to-transparent" />
            <div className="pointer-events-none absolute -right-6 -top-8 size-28 rounded-full bg-white/20 blur-2xl" />
            <div className="relative flex items-start gap-3">
              <span className="grid size-9 shrink-0 place-items-center rounded-xl bg-white/25 shadow-[inset_0_1px_0_rgba(255,255,255,0.5),0_2px_6px_rgba(0,0,0,0.2)]">
                {trialCap === 0 ? <Clock3 size={16} /> : <Zap size={16} className="fill-white/90" />}
              </span>
              <div className="min-w-0 flex-1">
                <div className="flex flex-wrap items-center justify-between gap-2">
                  <span className="text-[11px] font-extrabold uppercase tracking-wide text-white/90">Trial account</span>
                  {trialCap !== 0 && <span className="font-mono-app rounded-full bg-black/15 px-2 py-0.5 text-[10px] font-extrabold shadow-inner">{trialUsage?.used}/{trialUsage?.limit} today</span>}
                </div>
                <p className="mt-1 text-xs font-semibold leading-5">
                  {trialCap === 0
                    ? <>You've used all {trialUsage?.limit} of today's trial MCQs. Come back tomorrow, or ask about upgrading for unlimited access.</>
                    : <>{trialCap} MCQ{trialCap === 1 ? '' : 's'} left today — this set will be capped at {trialCap}.</>}
                </p>
                {trialCap !== 0 && trialUsage?.limit ? <div className="mt-2.5 h-1.5 w-full overflow-hidden rounded-full bg-black/15 shadow-inner"><div className="h-full rounded-full bg-white/95 shadow-[0_0_6px_rgba(255,255,255,0.8)] transition-all" style={{ width: `${Math.min(100, Math.round(((trialUsage.used ?? 0) / trialUsage.limit) * 100))}%` }} /></div> : null}
              </div>
            </div>
          </div>}
          {(() => {
            const info = subjectFilterOn ? null : (topicId && resumeData.byTopic.get(topicId)) || (pastPaperId && resumeData.byPaper.get(pastPaperId)) || null;
            if (!info) return null;
            return <div className="mb-5 flex items-center gap-3 rounded-2xl border border-primary/30 bg-primary/[0.07] p-3.5" data-testid="banner-resume-session">
              <div className="grid size-10 shrink-0 place-items-center rounded-xl bg-primary text-primary-foreground"><Play size={15} fill="currentColor" /></div>
              <div className="min-w-0 flex-1"><div className="text-xs font-extrabold">Pick up where you left off</div><div className="text-[11px] text-muted-foreground">{info.answered} of {info.total} answered · starting a new test replaces this</div></div>
              <button onClick={() => resumeFrom(info)} className="rounded-xl bg-primary px-3.5 py-2 text-xs font-extrabold text-primary-foreground" data-testid="button-resume-session">Resume</button>
            </div>;
          })()}
          <h3 className="mb-5 text-sm font-extrabold text-foreground">Configure Your Practice Test</h3>

          {difficultyEntries.length > 0 && <div className="mb-5">
            <div className="mb-2 text-[11px] font-bold text-muted-foreground">Select Difficulty Level</div>
            <div className="grid grid-cols-4 gap-2">
              {([
                { key: 'all' as const, count: mcqs.length },
                { key: 'easy' as const, count: difficultyCounts.easy ?? 0 },
                { key: 'moderate' as const, count: difficultyCounts.moderate ?? 0 },
                { key: 'hard' as const, count: difficultyCounts.hard ?? 0 },
              ]).map((opt) => <button key={opt.key} type="button" onClick={() => setSelectedDifficulty(opt.key)} disabled={opt.key !== 'all' && opt.count === 0} className={cn('card-lift rounded-xl border p-2.5 text-center transition-all disabled:opacity-30', selectedDifficulty === opt.key ? 'border-2 border-blue-500 bg-blue-50' : 'border-border bg-card hover:border-blue-300')} data-testid={`button-difficulty-${opt.key}`}>
                {opt.key === 'all'
                  ? <Target size={14} className="mx-auto text-red-500" />
                  : <span className={cn('mx-auto block size-2.5 rounded-full', opt.key === 'easy' ? 'bg-green-500' : opt.key === 'moderate' ? 'bg-amber-500' : 'bg-red-500')} />}
                <div className={cn('mt-1.5 text-[11px] font-extrabold', selectedDifficulty === opt.key && 'text-blue-600')}>{difficultyLabels[opt.key]}</div>
                <div className="text-[10px] text-muted-foreground">{opt.count} qs</div>
              </button>)}
            </div>
          </div>}

          <div className="mb-5">
            <div className="mb-2 text-[11px] font-bold text-muted-foreground">Number of Questions</div>
            <div className="grid grid-cols-3 gap-2">
              {([
                ...(availableCount > 10 ? [{ mode: '10' as const, label: '10', sub: 'Questions' }] : []),
                ...(availableCount > 20 ? [{ mode: '20' as const, label: '20', sub: 'Questions' }] : []),
                { mode: 'all' as const, label: availableCount > 20 ? 'All' : String(availableCount), sub: `${availableCount} MCQ${availableCount === 1 ? '' : 's'}` },
              ]).map((opt) => <button key={opt.mode} type="button" onClick={() => setCountMode(opt.mode)} className={cn('card-lift rounded-xl border p-3 text-center transition-all', countMode === opt.mode ? 'border-2 border-blue-500 bg-blue-50' : 'border-border bg-card hover:border-blue-300')} data-testid={`button-count-${opt.mode}`}>
                <div className={cn('text-sm font-extrabold', countMode === opt.mode && 'text-blue-600')}>{opt.label}</div>
                <div className="text-[10px] text-muted-foreground">{opt.sub}</div>
              </button>)}
            </div>
            <label className={cn('mt-2 flex items-center gap-3 rounded-xl border p-2.5 transition-all', countMode === 'custom' ? 'border-2 border-blue-500 bg-blue-50 dark:bg-blue-500/10' : 'border-border bg-card')}>
              <span className="text-[11px] font-bold text-muted-foreground">Or enter your own number</span>
              <input type="number" inputMode="numeric" min={1} max={availableCount} value={customCount}
                onFocus={() => setCountMode('custom')}
                onChange={(e) => { const v = e.target.value.replace(/[^0-9]/g, ''); setCustomCount(v && Number(v) > availableCount ? String(availableCount) : v); setCountMode('custom'); }}
                placeholder={`1–${availableCount}`}
                className="ml-auto h-9 w-24 rounded-lg border border-border bg-background px-2 text-center text-sm font-extrabold outline-none focus:border-blue-500" data-testid="input-custom-question-count" />
            </label>
            {countMode === 'custom' && !customValid && <p className="mt-1.5 text-[10px] font-bold text-destructive" data-testid="text-custom-count-hint">Enter how many questions you want (1–{availableCount}).</p>}
          </div>

          <div className="mb-5">
            <div className="mb-2 text-[11px] font-bold text-muted-foreground">Timer Mode</div>
            <div className="grid gap-3 sm:grid-cols-2">
              <button onClick={() => setPendingMode('timed')} className={cn('card-lift relative rounded-2xl border p-4 text-left transition-all', pendingMode === 'timed' ? 'border-2 border-blue-500 bg-blue-50' : 'border-border bg-card hover:border-blue-300')} data-testid="button-mode-timed">
                <div className="flex items-center gap-2.5">
                  <span className={cn('grid size-8 shrink-0 place-items-center rounded-lg', pendingMode === 'timed' ? 'bg-blue-500 text-white' : 'bg-muted text-muted-foreground')}><Clock3 size={15} /></span>
                  <span className={cn('text-sm font-extrabold', pendingMode === 'timed' && 'text-blue-600')}>Timer</span>
                </div>
                <p className="mt-2 text-[11px] leading-5 text-muted-foreground">Practice with a countdown and auto-submit when time ends.</p>
              </button>
              <button onClick={() => setPendingMode('untimed')} className={cn('card-lift relative rounded-2xl border p-4 text-left transition-all', pendingMode === 'untimed' ? 'border-2 border-blue-500 bg-blue-50' : 'border-border bg-card hover:border-blue-300')} data-testid="button-mode-untimed">
                <div className="flex items-center gap-2.5">
                  <span className={cn('grid size-8 shrink-0 place-items-center rounded-lg', pendingMode === 'untimed' ? 'bg-blue-500 text-white' : 'bg-muted text-muted-foreground')}><InfinityIcon size={15} /></span>
                  <span className={cn('text-sm font-extrabold', pendingMode === 'untimed' && 'text-blue-600')}>Timeless</span>
                </div>
                <p className="mt-2 text-[11px] leading-5 text-muted-foreground">No time limit. Study at your own pace.</p>
              </button>
            </div>

            {pendingMode === 'timed' && <div className="mt-3 rounded-2xl border border-border bg-muted/40 p-4 text-left">
              <div className="flex items-center justify-between gap-2">
                <div className="text-[11px] font-bold text-muted-foreground">Set your own time</div>
                {finishClock && <span className="inline-flex shrink-0 items-center gap-1 text-[10px] font-semibold text-muted-foreground" data-testid="text-estimated-finish"><Clock3 size={11} /> Ends ~{finishClock}</span>}
              </div>
              <div className="mt-3 flex items-center justify-center gap-3">
                <button type="button" onClick={() => setCustomMinutes(Math.max(1, effectiveMinutes - 5))} className="grid size-10 shrink-0 place-items-center rounded-xl border border-border text-base font-bold transition-transform hover:bg-muted active:scale-95" data-testid="button-timer-minus" aria-label="Subtract 5 minutes">−</button>
                <div className="flex flex-col items-center">
                  <input
                    type="number"
                    min={1}
                    max={480}
                    value={effectiveMinutes}
                    onChange={(e) => setCustomMinutes(Math.max(1, Math.min(480, Number(e.target.value) || 1)))}
                    className="h-11 w-24 rounded-xl border border-border bg-background px-2 text-center text-lg font-mono-app font-extrabold"
                    data-testid="input-timer-minutes"
                  />
                  <span className="mt-1 text-[10px] text-muted-foreground">minutes</span>
                </div>
                <button type="button" onClick={() => setCustomMinutes(Math.min(480, effectiveMinutes + 5))} className="grid size-10 shrink-0 place-items-center rounded-xl border border-border text-base font-bold transition-transform hover:bg-muted active:scale-95" data-testid="button-timer-plus" aria-label="Add 5 minutes">+</button>
              </div>
              <div className="mt-3 flex flex-wrap justify-center gap-1.5">
                {[autoMinutes, 15, 30, 45, 60].filter((v, idx, arr) => v > 0 && arr.indexOf(v) === idx).map((v) => <button key={v} type="button" onClick={() => setCustomMinutes(v)} className={cn('rounded-full border px-2.5 py-1 text-[11px] font-bold transition-colors', effectiveMinutes === v ? 'border-blue-500 bg-blue-500 text-white' : 'border-border text-muted-foreground hover:bg-muted')} data-testid={`button-timer-preset-${v}`}>{v === autoMinutes ? `${v} min (recommended)` : `${v} min`}</button>)}
              </div>
              <p className="mt-2.5 text-center text-[10px] text-muted-foreground">{isAuto ? '~1 min per question' : 'Custom pace'}, based on a {effectiveCount}-question set.</p>
            </div>}
          </div>

          <button type="button" onClick={() => setShuffleQuestions((s) => !s)} className="mb-5 flex w-full items-center justify-between rounded-2xl border border-border bg-muted/40 px-4 py-3 text-left transition-colors hover:bg-muted/60" data-testid="button-toggle-shuffle" aria-pressed={shuffleQuestions}>
            <span className="flex items-center gap-2 text-xs font-bold"><Shuffle size={14} className="text-muted-foreground" /> Shuffle question order</span>
            <span className={cn('relative h-5 w-9 shrink-0 rounded-full transition-colors', shuffleQuestions ? 'bg-blue-500' : 'bg-border')}><span className={cn('absolute top-0.5 size-4 rounded-full bg-white shadow transition-transform', shuffleQuestions ? 'translate-x-4' : 'translate-x-0.5')} /></span>
          </button>

          <div className="mb-6 rounded-2xl bg-muted/40 p-4 text-left" data-testid="panel-test-summary">
            <div className="mb-2.5 text-[11px] font-bold text-muted-foreground">Test Summary</div>
            <div className="grid grid-cols-2 gap-x-3 gap-y-2.5 text-[11px]">
              <div className="flex items-center gap-1.5 text-muted-foreground"><Target size={11} className="shrink-0 text-blue-500" /> Topic: <span className="truncate font-bold text-foreground">{topicLabel}</span></div>
              <div className="flex items-center gap-1.5 text-muted-foreground"><Activity size={11} className="shrink-0 text-blue-500" /> Difficulty: <span className="font-bold text-foreground">{difficultyLabels[selectedDifficulty]}</span></div>
              <div className="flex items-center gap-1.5 text-muted-foreground"><Hash size={11} className="shrink-0 text-blue-500" /> Questions: <span className="font-bold text-foreground">{effectiveCount}</span></div>
              <div className="flex items-center gap-1.5 text-muted-foreground"><Clock3 size={11} className="shrink-0 text-blue-500" /> Mode: <span className="font-bold text-foreground">{pendingMode === 'timed' ? 'Timer' : 'Timeless'}</span></div>
            </div>
          </div>

          <div className="flex justify-center">
            <button
              onClick={startSession}
              disabled={effectiveCount === 0}
              className="dash-key !rounded-full !px-8 !py-3.5 !text-xs disabled:opacity-40 disabled:hover:translate-y-0"
              data-testid="button-start-session"
            ><Play size={13} fill="currentColor" /> Start Test {pendingMode === 'timed' ? `(${effectiveMinutes} min)` : ''}</button>
          </div>
          <button
            onClick={() => saveSession.mutate({ name: `Practice — ${new Date().toLocaleDateString()}`, config: { topicId, pastPaperId } })}
            disabled={saveSession.isPending}
            className="card-lift mt-3 flex w-full items-center justify-center gap-2 rounded-xl border border-border px-4 py-2.5 text-xs font-bold text-muted-foreground hover:bg-muted hover:text-foreground disabled:opacity-50"
            data-testid="button-save-session"
          ><Bookmark size={14} /> {saveSession.isPending ? 'Saving…' : 'Save this filter for later'}</button>
        </div>
      </div>
    </div>;
  }

  if (!current) return <SkeletonPage />;

  // Bug fix: once a question has been answered, lock it — don't let further
  // clicks overwrite `answers[current.id]`. Without this, going back (Prev /
  // Question Navigator) to a question you got wrong and tapping the now
  // green-outlined correct option silently replaced your original wrong
  // answer with the correct one, so both the inline feedback and the
  // results card (PracticeResultCard) would count it as correct even though
  // you answered wrong the first time. Matches real exam behavior: your
  // first pick for a question is final.
  const selectOption = (option: string) => {
    if (paused) return;
    if (answers[current.id] != null) return;
    setAnswers((prev) => ({ ...prev, [current.id]: option }));
  };
  const goTo = (i: number) => { if (current) setVisitedIds((prev) => prev.has(current.id) ? prev : new Set(prev).add(current.id)); setIndex(i); setPanel(null); askAi.reset(); };
  // Flag icon does double duty: it drives the session-local "flag for
  // review" highlight in the number grid (like a real exam engine), AND —
  // when turning a flag ON — persists a report via flaggedMcqsApi so it
  // actually shows up on the standalone Flagged MCQs page for the student
  // (and admins) to revisit later. Un-flagging only clears the in-session
  // highlight; it doesn't delete the persisted report (use the Flagged MCQs
  // page's Remove button for that).
  const toggleFlag = () => setFlaggedIds((prev) => {
    const next = new Set(prev);
    if (next.has(current.id)) { next.delete(current.id); }
    else { next.add(current.id); reportFlag.mutate({ mcqId: current.id, reason: 'Flagged during practice session' }); }
    return next;
  });
  const isSaved = (id: number) => id in savedOverride ? savedOverride[id] : !!savedQ.data?.some((x) => x.mcqId === id && x.source !== 'flagged');
  const saveQuestion = () => {
    const id = current.id; const save = !isSaved(id);
    setSavedOverride((prev) => ({ ...prev, [id]: save }));
    saveMcq.mutate({ mcqId: id, save });
  };
  type NavState = 'current' | 'correct' | 'wrong' | 'answered' | 'skipped' | 'new';
  // Green = correct, red = wrong, yellow = skipped (opened but left unanswered), grey = not seen yet.
  const stateForIndex = (i: number): NavState => {
    const id = activeMcqs[i].id;
    const picked = answers[id];
    if (i === index) return 'current';
    if (picked != null) {
      const correct = activeMcqs[i].correctAnswer;
      if (correct == null) return 'answered';
      return picked === correct ? 'correct' : 'wrong';
    }
    return visitedIds.has(id) ? 'skipped' : 'new';
  };
  // The current question keeps its result colour (so you still see green/red after answering) plus a ring.
  const currentResult = (): NavState => {
    const picked = answers[current.id];
    if (picked == null) return 'new';
    if (current.correctAnswer == null) return 'answered';
    return picked === current.correctAnswer ? 'correct' : 'wrong';
  };
  const navBubbleClass = (st: NavState, i: number) => {
    const res: NavState = st === 'current' ? currentResult() : st;
    return cn('relative grid aspect-square place-items-center rounded-xl text-[12px] font-extrabold tabular-nums transition-all active:scale-90',
      res === 'correct' && 'bg-[#2f9e6e] text-white shadow-[0_2px_6px_-1px_rgba(47,158,110,.55)]',
      res === 'wrong' && 'bg-[#e0584a] text-white shadow-[0_2px_6px_-1px_rgba(224,88,74,.55)]',
      res === 'skipped' && 'bg-[#f2b93b] text-[#5b3d00] shadow-[0_2px_6px_-1px_rgba(242,185,59,.55)]',
      res === 'answered' && 'bg-[#32647b] text-white',
      res === 'new' && 'bg-muted text-muted-foreground',
      st === 'current' && 'ring-2 ring-primary ring-offset-2 ring-offset-card scale-105');
  };

  const controlPanel = <div className="space-y-3">
    <div className="rounded-2xl border border-border bg-card p-3.5">
      <div className="flex items-center justify-between gap-3">
        <div className="min-w-0">{mode === 'timed' ? <PracticeTimer store={countdown} total={timerTotal} paused={paused} /> : <div className="flex items-center gap-2 text-xs font-bold"><span className="grid size-8 place-items-center rounded-full bg-muted"><Clock3 size={14} /></span> Untimed practice</div>}</div>
        <div className="shrink-0 text-right" data-testid="text-practice-count"><div className="font-mono-app text-sm font-extrabold tabular-nums">{index + 1} / {activeMcqs.length}</div><div className="text-[10px] font-bold text-muted-foreground">{percentAnswered}% answered</div></div>
      </div>
      {trialLimited && <div className="mt-2"><span className={cn('inline-flex items-center gap-1 rounded-full px-2.5 py-1 text-[10px] font-extrabold text-white shadow-[0_2px_6px_-1px_rgba(0,0,0,0.3),inset_0_1px_0_rgba(255,255,255,0.35)]', trialRemainingNow === 0 ? 'bg-gradient-to-br from-[#e0654f] to-[#a3402f]' : 'bg-gradient-to-br from-[#f5b25a] to-[#c17f2a]')} data-testid="badge-trial-mcqs-left"><Zap size={10} className="fill-white/90" /> {trialRemainingNow} left today</span></div>}
      <div className="mt-2.5 flex gap-1.5">
        <button onClick={() => setPaused((p) => !p)} className="flex flex-1 items-center justify-center gap-1.5 rounded-lg bg-[#32647b] px-2 py-2 text-[11px] font-bold text-white" data-testid="button-pause-session">{paused ? <><Zap size={12} /> Resume</> : <><Clock3 size={12} /> Pause</>}</button>
        <button onClick={saveQuestion} className={cn('flex flex-1 items-center justify-center gap-1.5 rounded-lg px-2 py-2 text-[11px] font-bold', isSaved(current.id) ? 'bg-[#e6dcf3] text-[#6a4c93]' : 'bg-gradient-to-r from-[#6a4c93] to-[#815276] text-white')} data-testid="button-save-question"><Bookmark size={12} className={isSaved(current.id) ? 'fill-current' : ''} /> {isSaved(current.id) ? 'Saved' : 'Save'}</button>
      </div>
      {canResume && <button onClick={() => { void persistProgress(true).then(() => { progressOn.current = false; navigate('/saved-sessions'); }); }} className="mt-1.5 flex w-full items-center justify-center gap-1.5 rounded-lg border border-border px-2 py-2 text-[11px] font-bold text-foreground hover:bg-muted" data-testid="button-save-exit-session"><Bookmark size={12} /> Save &amp; continue later</button>}
      <button onClick={finishSession} className="mt-1.5 flex w-full items-center justify-center gap-1.5 rounded-lg border border-[#c0503f]/30 px-2 py-2 text-[11px] font-bold text-[#c0503f] hover:bg-[#fff1ed]" data-testid="button-exit-session"><X size={12} /> Exit &amp; submit</button>
    </div>
    <div className="rounded-2xl border border-border bg-card p-3.5">
      <div className="mb-2.5 text-[11px] font-bold text-muted-foreground">Question Navigator</div>
      <div className="grid grid-cols-6 gap-2 sm:grid-cols-8 lg:grid-cols-5 lg:gap-1.5">{activeMcqs.map((m, i) => { const st = stateForIndex(i); return <button key={m.id} onClick={() => goTo(i)} className={navBubbleClass(st, i)} aria-label={`Question ${i + 1}: ${st}`} data-testid={`button-goto-question-${i}`}>{i + 1}{flaggedIds.has(m.id) && <span className="absolute -right-0.5 -top-0.5 size-2.5 rounded-full border-2 border-card bg-[#8b5cf6]" />}</button>; })}</div>
      <div className="mt-3 flex flex-wrap gap-x-3 gap-y-1.5 text-[10px] font-semibold text-muted-foreground"><span className="flex items-center gap-1"><span className="size-2.5 rounded-full bg-[#2f9e6e]" /> Correct</span><span className="flex items-center gap-1"><span className="size-2.5 rounded-full bg-[#e0584a]" /> Wrong</span><span className="flex items-center gap-1"><span className="size-2.5 rounded-full bg-[#f2b93b]" /> Skipped</span><span className="flex items-center gap-1"><span className="size-2.5 rounded-full bg-muted ring-1 ring-border" /> Not seen</span><span className="flex items-center gap-1"><span className="size-2.5 rounded-full ring-2 ring-primary" /> Current</span><span className="flex items-center gap-1"><span className="size-2.5 rounded-full bg-[#8b5cf6]" /> Flagged</span></div>

    </div>
  </div>;

  if (paused) {
    return <div className="max-w-6xl"><SectionHeader eyebrow="Daily practice" title="Practice with purpose" description="Choose how you want to work through these questions." />
      <div className="grid gap-6 lg:grid-cols-[1fr_280px]"><div className="order-2 rounded-3xl border border-border bg-card p-9 text-center lg:order-1"><Clock3 size={28} className="mx-auto text-muted-foreground" /><h2 className="mt-4 font-display text-xl">Session paused</h2><p className="mt-2 text-xs text-muted-foreground">Your progress and timer are on hold. Hit Resume in the panel to keep going.</p></div><div className="order-1 lg:order-2">{controlPanel}</div></div>
    </div>;
  }

  // Breadcrumb (Module > Subject > Topic) + a "Leave" exit action, matching
  // the reference design's Practice MCQs header — Mcq already carries the
  // module/subject/topic names, so no extra fetch is needed.
  // Breadcrumb (Module > Subject > Topic) — Mcq already carries the
  // module/subject/topic names, so no extra fetch is needed. The focus-mode
  // header above already has its own "Exit" back-link (see Shell), so this
  // page doesn't need a second exit affordance duplicating it — "Exit &
  // submit" in the side panel is the one deliberate way to leave mid-set.
  const breadcrumbParts = [current.module, current.subject, current.topic].filter(Boolean);
  return <div className="-mx-5 -my-6 min-h-[calc(100dvh-3.5rem)] px-2.5 pb-[max(1rem,env(safe-area-inset-bottom))] pt-0 md:-mx-10 md:-my-8 md:px-8 md:pb-8 md:pt-0 lg:mx-auto lg:my-0 lg:max-w-none lg:px-6" data-testid="practice-live">
    <div className="grid gap-3 sm:gap-6 lg:grid-cols-[1fr_300px]">
      <div ref={hl.rootRef} onClickCapture={hl.onClickCapture} className="order-1 overflow-hidden rounded-2xl border border-border bg-card shadow-[var(--shadow-2xs)] sm:rounded-3xl" data-highlighter={hl.mode}>
        <div className="bg-gradient-to-br from-indigo-50 via-card to-card px-3.5 pt-4 sm:px-6 sm:pt-6">
        <div className="flex items-center justify-between gap-2"><div className="flex min-w-0 flex-wrap items-center gap-2"><Badge tone={difficultyTone(current.difficulty)}>{current.difficulty}</Badge>{breadcrumbParts.length > 0 && <div className="flex min-w-0 flex-wrap items-center gap-1 text-[11px] font-semibold text-muted-foreground" data-testid="text-practice-breadcrumb">{breadcrumbParts.map((part, i) => <span key={i} className="flex items-center gap-1">{i > 0 && <ChevronRight size={11} />}<span>{part}</span></span>)}</div>}</div><div className="flex shrink-0 flex-wrap items-center justify-end gap-1"><HighlighterBar hl={hl} /><button onClick={toggleFlag} className={cn('rounded-lg p-1.5 transition-transform hover:scale-110', flaggedIds.has(current.id) ? 'text-[#e5a952]' : 'text-muted-foreground hover:text-foreground')} data-testid="button-flag-question"><Flag size={17} fill={flaggedIds.has(current.id) ? 'currentColor' : 'none'} /></button></div></div>
        <h2 className="mt-3 max-w-none pb-4 text-base font-extrabold leading-6 tracking-[-.025em] sm:text-lg sm:leading-7">{hl.render('stem', current.question)}</h2>
        </div>
        <div className="px-3.5 pb-4 sm:px-6 sm:pb-6">
        {/* Compact option rows (py-2.5 instead of p-4, tighter gap) so a
            5-option question plus the hint/explain/references row and the
            prev/next buttons fit one viewport on a normal laptop screen
            without scrolling — this was the whole stack's biggest single
            source of vertical height. */}
        <div className="mt-4 space-y-2">{current.options.map((option, i) => {
          const selected = answers[current.id];
          const isSelected = selected === option;
          const isCorrectOpt = current.correctAnswer != null && option === current.correctAnswer;
          // Immediate right/wrong feedback once the student has picked an
          // option for this question: their pick turns green if it's
          // correct or red if it's wrong, and — if they picked wrong — the
          // actual correct option is also outlined green so they can see
          // it right away instead of only finding out at the end.
          const optionClass = selected == null
            ? 'border-border hover:bg-muted'
            : isSelected && isCorrectOpt ? 'border-[#287058] bg-[#e6f3ed]'
            : isSelected && !isCorrectOpt ? 'border-destructive bg-[#fff1ed]'
            : isCorrectOpt ? 'border-[#287058] bg-[#f3fbf7]'
            : 'border-border opacity-70';
          return <div key={option} role="button" tabIndex={selected != null ? -1 : 0} aria-disabled={selected != null} onClick={() => selectOption(option)} onKeyDown={(e) => { if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); selectOption(option); } }} className={cn('flex w-full items-center gap-2.5 rounded-xl border px-3.5 py-2.5 text-left text-sm shadow-[var(--shadow-2xs)] transition-all', optionClass, selected == null && 'cursor-pointer hover:-translate-y-0.5 hover:shadow-[var(--shadow-xs)]', selected != null && 'cursor-default')} data-testid={`button-answer-${i}`}><span className={cn('grid size-6 shrink-0 place-items-center rounded-lg font-mono-app text-[11px] font-bold transition-colors', selected != null && isSelected && isCorrectOpt && 'bg-[#287058] text-white', selected != null && isSelected && !isCorrectOpt && 'bg-destructive text-white', selected != null && !isSelected && isCorrectOpt && 'bg-[#287058] text-white', (selected == null || (!isSelected && !isCorrectOpt)) && 'bg-muted')}>{String.fromCharCode(65 + i)}</span><span className="flex-1">{hl.render(`o${i}`, option)}</span>{selected != null && isSelected && !isCorrectOpt && <X size={15} className="shrink-0 text-destructive" />}{selected != null && isCorrectOpt && <CheckCircle2 size={15} className="shrink-0 text-[#287058]" />}</div>;
        })}</div>

        <div className="mt-4 flex flex-wrap gap-2">
          <button onClick={() => setPanel(panel === 'hint' ? null : 'hint')} className={cn('inline-flex items-center gap-1.5 rounded-xl px-3.5 py-2 text-xs font-bold', panel === 'hint' ? 'bg-[#e5a952] text-white' : 'border border-[#e5a952]/40 bg-[#fdf6e8] text-[#8a5a12]')} data-testid="button-hint"><Lightbulb size={13} /> Hint</button>
          <button onClick={() => setPanel(panel === 'explain' ? null : 'explain')} className={cn('inline-flex items-center gap-1.5 rounded-xl px-3.5 py-2 text-xs font-bold', panel === 'explain' ? 'bg-[#32647b] text-white' : 'border border-[#32647b]/40 bg-[#dceaf1] text-[#32647b]')} data-testid="button-explain"><CircleHelp size={13} /> Explain</button>
          <button onClick={() => setPanel(panel === 'references' ? null : 'references')} className={cn('inline-flex items-center gap-1.5 rounded-xl px-3.5 py-2 text-xs font-bold', panel === 'references' ? 'bg-[#6a4c93] text-white' : 'border border-[#6a4c93]/40 bg-[#efe8f7] text-[#6a4c93]')} data-testid="button-references"><BookOpen size={13} /> References</button>
        </div>

        {panel === 'hint' && <div className="mt-3 rounded-xl bg-[#fdf6e8] p-3.5 text-xs leading-6 text-[#8a5a12]" data-testid="panel-hint"><div className="mb-1 flex items-center gap-1.5 text-[10px] font-bold uppercase tracking-wide"><Lightbulb size={10} /> Hint</div>{current.hint ? hl.render('hint', current.hint) : 'Re-read the question stem carefully — focus on the specific mechanism or finding it\'s asking about, and rule out options that don\'t fit that exact scenario.'}</div>}
        {panel === 'references' && <div className="mt-3 rounded-xl bg-[#efe8f7] p-3.5 text-xs leading-6 text-[#6a4c93]" data-testid="panel-references"><div className="mb-1 flex items-center gap-1.5 text-[10px] font-bold uppercase tracking-wide"><BookOpen size={10} /> References</div>{current.reference ? hl.render('ref', current.reference) : 'No reference has been attached to this question yet.'}</div>}
        {panel === 'explain' && <div className="mt-3 rounded-xl bg-[#dceaf1] p-3.5 text-xs leading-6 text-[#32647b]" data-testid="panel-explain">
          <div className="mb-1 flex items-center gap-1.5 text-[10px] font-bold uppercase tracking-wide"><CircleHelp size={10} /> Explanation</div>
          {current.optionExplanations?.some((e) => e?.trim()) ? <div className="space-y-2">{current.options.map((opt, oi) => { const optExplanation = current.optionExplanations?.[oi]; const isCorrectOpt = opt === current.correctAnswer; return <div key={opt} className={cn('rounded-lg p-2.5', isCorrectOpt ? 'bg-white/70' : 'bg-white/30')}><div className={cn('text-[11px] font-bold', isCorrectOpt ? 'text-[#287058]' : 'text-[#a34c3e]')}>{String.fromCharCode(65 + oi)}. {opt} {isCorrectOpt ? '(correct)' : ''}</div>{optExplanation && <div className="mt-1 text-[11px] leading-5">{hl.render(`x${oi}`, optExplanation)}</div>}</div>; })}</div> : (current.explanation ? hl.render('ex', current.explanation) : 'No written explanation is available for this question yet.')}
          {aiExplainEnabled && !askAi.data && <button onClick={() => askAi.mutate()} disabled={askAi.isPending} className="mt-3 inline-flex items-center gap-1.5 rounded-lg border border-[#32647b]/30 bg-white/60 px-3 py-1.5 text-[11px] font-bold text-[#32647b] disabled:opacity-50" data-testid="button-ask-ai">{askAi.isPending ? 'Thinking…' : <><Sparkles size={11} /> Ask AI to explain differently</>}</button>}
          {askAi.data && <div className="mt-3 rounded-lg bg-white/60 p-3 text-xs leading-5"><div className="mb-1 flex items-center gap-1.5 text-[10px] font-bold uppercase tracking-wide"><Sparkles size={10} /> AI explanation</div>{hl.render('ai', askAi.data.explanation)}</div>}
          {askAi.isError && <p className="mt-2 text-[11px] font-semibold text-destructive">{askAi.error instanceof ApiRequestError ? askAi.error.message : 'Could not reach AI right now.'}</p>}
        </div>}



        <div className="mt-5 flex items-center justify-between gap-3">
          <button disabled={index === 0} onClick={() => goTo(index - 1)} className="inline-flex items-center gap-1.5 rounded-xl border border-border bg-card px-5 py-2.5 text-xs font-bold disabled:opacity-40" data-testid="button-prev-question"><ArrowLeft size={14} /> Prev</button>
          {index + 1 >= activeMcqs.length ? <button onClick={finishSession} className="inline-flex items-center gap-1.5 rounded-xl bg-primary px-5 py-2.5 text-xs font-extrabold text-primary-foreground shadow-sm transition-all hover:-translate-y-0.5 hover:shadow-md" data-testid="button-finish-session">Finish session <CheckCircle2 size={14} /></button> : <button onClick={() => goTo(index + 1)} className="inline-flex items-center gap-1.5 rounded-xl bg-primary px-5 py-2.5 text-xs font-extrabold text-primary-foreground shadow-sm transition-all hover:-translate-y-0.5 hover:shadow-md" data-testid="button-next-question">Next <ArrowRight size={14} /></button>}
        </div>
        </div>
      </div>
      <div className="order-2">{controlPanel}</div>
    </div>
    <PracticeNotebook mcqId={current.id} questionText={current.question} questionNumber={index + 1} />
  </div>;
}

// Picks `count` random items from `items` (a different subset every call) and
// returns them in their ORIGINAL relative order, so the curated/syllabus order
// survives unless the student also turns on "Shuffle question order". Returns
// a copy of everything when count >= items.length. Never mutates its input.
function randomSample<T>(items: T[], count: number): T[] {
  if (count >= items.length) return [...items];
  const idx = items.map((_, i) => i);
  for (let i = idx.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [idx[i], idx[j]] = [idx[j], idx[i]];
  }
  return idx.slice(0, Math.max(0, count)).sort((a, b) => a - b).map((i) => items[i]);
}

// Fisher–Yates shuffle for the setup screen's "Shuffle question order"
// toggle — returns a new array (never mutates the query-cache array from
// react-query) so switching the toggle off and starting again reliably
// falls back to the original server order.
function shuffleArray<T>(items: T[]): T[] {
  const copy = [...items];
  for (let i = copy.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [copy[i], copy[j]] = [copy[j], copy[i]];
  }
  return copy;
}

// Deterministic per-topic accent color, cycling through the app's existing
// --chart-1..5 CSS variables (same palette already used for analytics
// charts elsewhere) rather than inventing new colors. Same topic name
// always gets the same color, so a student builds a visual association
// with a subject over repeated study sessions instead of colors reshuffling
// on every render.

export default Practice;
