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
  LayoutGrid, Presentation, Wand2, Crown, Globe, Star, Activity
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
import { EmptyState, SectionHeader, cn } from '@/lib/shared';
import { ReviewTabs } from '@/components/study/ReviewTabs';
import { queryClient } from '@/lib/query-client';

function FlaggedMcqs() {
  const [, navigate] = useLocation();
  const [filter, setFilter] = useState<'all' | 'open' | 'resolved'>('all');
  const [term, setTerm] = useState('');
  const flags = useQuery({ queryKey: ['flagged-mcqs'], queryFn: flaggedMcqsApi.list });
  // Bug fix: "Remove" used to call the mutation and just hope — no toast on
  // success, and the old backend route silently returned {ok:true} even
  // when nothing was actually deleted (see student-tools.ts), so a failed
  // remove looked identical to a working one. The route now reports real
  // failures (404) and this surfaces both outcomes instead of only errors.
  const remove = useMutation({
    mutationFn: flaggedMcqsApi.remove,
    onSuccess: () => { queryClient.invalidateQueries({ queryKey: ['flagged-mcqs'] }); toast({ title: 'Removed' }); },
    onError: (err: unknown) => toast({ title: 'Could not remove this', description: err instanceof ApiRequestError ? err.message : 'Something went wrong.', variant: 'destructive' }),
  });
  const q = term.trim().toLowerCase();
  const visible = (flags.data || []).filter((f) => (filter === 'all' || f.status === filter) && (!q || `${f.question ?? ''} ${f.path ?? ''} ${f.reason}`.toLowerCase().includes(q)));
  // Group: Block › Module  >  Subject  >  Topic. Missing levels fall back to "Uncategorised"/"General" so nothing disappears.
  const tree = (() => {
    const mods = new Map<string, { key: string; module: string; block: string | null; count: number; subjects: Map<string, { key: string; subject: string; count: number; topics: Map<string, { key: string; topic: string; items: FlaggedMcq[] }> }> }>();
    for (const f of visible) {
      const module = f.moduleName || (f.mcqDeleted ? 'Removed questions' : 'Uncategorised');
      const block = f.blockName ?? null;
      const mk = `m:${block ?? ''}|${module}`;
      const m = mods.get(mk) ?? { key: mk, module, block, count: 0, subjects: new Map() }; mods.set(mk, m); m.count++;
      const subject = f.subjectName || 'General';
      const sk = `${mk}/s:${subject}`;
      const sg = m.subjects.get(sk) ?? { key: sk, subject, count: 0, topics: new Map() }; m.subjects.set(sk, sg); sg.count++;
      const topic = f.topicName || 'General';
      const tk = `${sk}/t:${topic}`;
      const tg = sg.topics.get(tk) ?? { key: tk, topic, items: [] }; sg.topics.set(tk, tg); tg.items.push(f);
    }
    return [...mods.values()]
      .sort((a, b) => a.module.localeCompare(b.module, undefined, { numeric: true }))
      .map((m) => ({ ...m, subjects: [...m.subjects.values()].sort((a, b) => a.subject.localeCompare(b.subject)).map((sg) => ({ ...sg, topics: [...sg.topics.values()].sort((a, b) => a.topic.localeCompare(b.topic)) })) }));
  })();
  // Everything starts collapsed (compact, easy to scan) unless there's only one module or the student is searching.
  const [collapsed, setCollapsed] = useState<Set<string>>(new Set());
  const [touched, setTouched] = useState(false);
  const allKeys = tree.flatMap((m) => [m.key, ...m.subjects.map((x) => x.key)]);
  const defaultCollapsed = () => new Set(tree.length === 1 ? [] : tree.map((m) => m.key));
  const isCollapsed = (key: string) => (q ? false : (touched ? collapsed : defaultCollapsed()).has(key));
  const setAll = (keys: string[]) => { setTouched(true); setCollapsed(new Set(keys)); };
  const toggle = (key: string) => {
    const base = new Set(touched ? collapsed : defaultCollapsed());
    if (base.has(key)) base.delete(key); else base.add(key);
    setTouched(true); setCollapsed(base);
  };
  const renderFlag = (flag: FlaggedMcq) => <div key={flag.id} className="rounded-2xl border border-border bg-card p-4 transition-all hover:shadow-md pf-edit" data-testid={`card-flag-${flag.id}`}>
        <div className="flex flex-wrap items-start justify-between gap-3">
          <div className="min-w-0 flex-1">
            <p className="line-clamp-2 text-sm font-bold" data-testid={`text-flag-question-${flag.id}`}>{flag.question ?? `This question is no longer available (MCQ #${flag.mcqId}).`}</p>
            {flag.reason && <p className="mt-1 text-[11px] text-muted-foreground">{flag.reason}</p>}
            <span className={cn('mt-2 inline-block rounded-full px-2 py-0.5 text-[10px] font-bold', flag.status === 'open' ? 'bg-[#fdeecb] text-[#8a5a12]' : 'bg-[#d7eee4] text-[#164b4b]')}>{flag.status}</span>
          </div>
          <div className="flex shrink-0 items-center gap-2">
            <button onClick={() => navigate(`/practice?mcqId=${flag.mcqId}`)} disabled={flag.mcqDeleted} title={flag.mcqDeleted ? 'This question no longer exists' : undefined} className="rounded-lg bg-primary px-3 py-1.5 text-xs font-bold text-primary-foreground disabled:cursor-not-allowed disabled:opacity-40" data-testid={`button-open-flag-${flag.id}`}>Open</button>
            <button onClick={() => remove.mutate(flag.id)} disabled={remove.isPending} className="rounded-lg border border-border px-3 py-1.5 text-xs font-bold text-destructive disabled:opacity-50" data-testid={`button-unflag-${flag.id}`}>Remove</button>
          </div>
        </div>
      </div>;
  return <div>
    <SectionHeader eyebrow="Your tools" title="Flagged MCQs" description="Questions you bookmarked or flagged for review." />
    <ReviewTabs />
    {!!flags.data?.length && <div className="mb-4 flex flex-wrap items-center gap-2" data-testid="flag-toolbar">
      <div className="flex overflow-hidden rounded-xl border border-border bg-card text-xs font-extrabold">{(['all', 'open', 'resolved'] as const).map((f) => <button key={f} onClick={() => setFilter(f)} className={cn('px-3 py-2 capitalize transition-colors', filter === f ? 'bg-primary text-primary-foreground' : 'text-muted-foreground hover:bg-muted')}>{f}{f !== 'all' && ` · ${flags.data!.filter((x) => x.status === f).length}`}</button>)}</div>
      <input value={term} onChange={(e) => setTerm(e.target.value)} placeholder="Search flagged questions…" className="h-9 min-w-0 flex-1 rounded-xl border border-border bg-card px-3 text-xs" data-testid="input-search-flags" />
      {flags.data.some((f) => f.status === 'open' && !f.mcqDeleted) && <button onClick={() => navigate('/practice?set=flagged&count=20')} className="rounded-xl bg-primary px-3.5 py-2 text-xs font-extrabold text-primary-foreground transition-transform active:scale-95" data-testid="button-practice-flagged">Practice flagged</button>}
    </div>}
    <div className="space-y-3">
      {!!visible.length && !!tree.length && <div className="flex items-center justify-between gap-2 text-[11px] font-bold text-muted-foreground">
        <span data-testid="text-flag-count">{visible.length} question{visible.length === 1 ? '' : 's'} · {tree.length} module{tree.length === 1 ? '' : 's'}</span>
        <span className="flex gap-3"><button onClick={() => setAll([])} className="text-primary underline-offset-2 hover:underline" data-testid="button-expand-all">Expand all</button><button onClick={() => setAll(allKeys)} className="text-primary underline-offset-2 hover:underline" data-testid="button-collapse-all">Collapse all</button></span>
      </div>}
      {tree.map((g) => { const gOpen = !isCollapsed(g.key); return <section key={g.key} className="overflow-hidden rounded-2xl border border-border bg-card" data-testid={`group-module-${g.key}`}>
        <button onClick={() => toggle(g.key)} aria-expanded={gOpen} className="flex w-full items-center gap-2 bg-muted/40 px-4 py-3 text-left transition-colors hover:bg-muted/70">
          <ChevronRight size={16} className={cn('shrink-0 text-primary transition-transform', gOpen && 'rotate-90')} />
          <span className="min-w-0 flex-1"><span className="block truncate text-sm font-extrabold">{g.module}</span>{g.block && <span className="block truncate text-[10px] font-extrabold uppercase tracking-wide text-primary">{g.block}</span>}</span>
          <span className="shrink-0 rounded-full bg-primary/15 px-2 py-0.5 text-[11px] font-extrabold text-primary">{g.count}</span>
        </button>
        {gOpen && <div className="space-y-2 p-3">
          {g.subjects.map((sg) => { const sOpen = !isCollapsed(sg.key); return <div key={sg.key} className="rounded-xl border border-border" data-testid={`group-subject-${sg.key}`}>
            <button onClick={() => toggle(sg.key)} aria-expanded={sOpen} className="flex w-full items-center gap-2 px-3 py-2.5 text-left">
              <ChevronRight size={14} className={cn('shrink-0 text-muted-foreground transition-transform', sOpen && 'rotate-90')} />
              <span className="min-w-0 flex-1 truncate text-[13px] font-extrabold">{sg.subject}</span>
              <span className="shrink-0 rounded-full bg-muted px-2 py-0.5 text-[10px] font-extrabold text-muted-foreground">{sg.count}</span>
            </button>
            {sOpen && <div className="space-y-3 border-t border-border p-3">
              {sg.topics.map((tg) => <div key={tg.key} data-testid={`group-topic-${tg.key}`}>
                <p className="mb-2 flex items-center gap-1.5 text-[11px] font-extrabold uppercase tracking-wide text-muted-foreground"><span className="h-1.5 w-1.5 rounded-full bg-primary" />{tg.topic}<span className="font-bold normal-case">({tg.items.length})</span></p>
                <div className="space-y-3">{tg.items.map(renderFlag)}</div>
              </div>)}
            </div>}
          </div>; })}
        </div>}
      </section>; })}
      {!flags.data?.length && <EmptyState icon={Flag} title="Nothing flagged" body="Flag a question from a practice session to come back to it later." />}
    </div>
  </div>;
}

// Podium/Leaderboard (round 3): reverted from the previous dark/gold "game
// card" palette back to the same light theme + design tokens the rest of
// the app uses (bg-card/border-border/text-foreground, primary accent) —
// per explicit request that this page stop looking different from the rest
// of the site. Medal tones (gold/silver/bronze) are kept as accent colors
// since they're meaningful, just re-picked to sit on a light background
// instead of a dark one.

export default FlaggedMcqs;
