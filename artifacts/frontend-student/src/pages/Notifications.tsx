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
import { ConfirmDialog, EmptyState, SectionHeader, cn } from '@/lib/shared';
import { queryClient } from '@/lib/query-client';
import { Megaphone, Swords, BellOff, Info } from 'lucide-react';

type NotifKind = 'success' | 'warning' | 'payment' | 'milestone' | 'challenge' | 'announcement' | 'info';
const KIND: Record<NotifKind, { icon: typeof Bell; label: string; tone: string; ring: string }> = {
  success: { icon: CheckCircle2, label: 'Success', tone: 'bg-emerald-500/15 text-emerald-600 dark:text-emerald-400', ring: 'bg-emerald-500' },
  warning: { icon: AlertTriangle, label: 'Needs attention', tone: 'bg-amber-500/15 text-amber-600 dark:text-amber-400', ring: 'bg-amber-500' },
  payment: { icon: CreditCard, label: 'Payment', tone: 'bg-orange-500/15 text-orange-600 dark:text-orange-400', ring: 'bg-orange-500' },
  milestone: { icon: Trophy, label: 'Milestone', tone: 'bg-violet-500/15 text-violet-600 dark:text-violet-400', ring: 'bg-violet-500' },
  challenge: { icon: Swords, label: 'Challenge', tone: 'bg-rose-500/15 text-rose-600 dark:text-rose-400', ring: 'bg-rose-500' },
  announcement: { icon: Megaphone, label: 'Announcement', tone: 'bg-sky-500/15 text-sky-600 dark:text-sky-400', ring: 'bg-sky-500' },
  info: { icon: Info, label: 'Update', tone: 'bg-primary/15 text-primary', ring: 'bg-primary' },
};
const kindOf = (n: Notification): NotifKind => {
  const t = (n.type || '').toLowerCase();
  if (t in KIND) return t as NotifKind;
  if (/challenge/.test(t) || /challenge/i.test(n.title)) return 'challenge';
  if (/announce|broadcast/.test(t)) return 'announcement';
  return 'info';
};
const parseDate = (v: string) => { const d = new Date(v); return Number.isNaN(d.getTime()) ? null : d; };
const timeAgo = (v: string) => {
  const d = parseDate(v); if (!d) return v;
  const sec = Math.max(0, Math.round((Date.now() - d.getTime()) / 1000));
  if (sec < 60) return 'Just now';
  if (sec < 3600) return `${Math.floor(sec / 60)}m ago`;
  if (sec < 86400) return `${Math.floor(sec / 3600)}h ago`;
  if (sec < 86400 * 7) return `${Math.floor(sec / 86400)}d ago`;
  return d.toLocaleDateString(undefined, { day: 'numeric', month: 'short', year: d.getFullYear() === new Date().getFullYear() ? undefined : 'numeric' });
};
const bucketOf = (v: string) => {
  const d = parseDate(v); if (!d) return 'Earlier';
  const start = new Date(); start.setHours(0, 0, 0, 0);
  const day = Math.floor((start.getTime() - new Date(d).setHours(0, 0, 0, 0)) / 86400000);
  if (day <= 0) return 'Today';
  if (day === 1) return 'Yesterday';
  if (day < 7) return 'This week';
  return 'Earlier';
};
const BUCKETS = ['Today', 'Yesterday', 'This week', 'Earlier'];

function Notifications() {
  const q = useListNotifications();
  const ns: Notification[] = q.data ?? [];
  const markRead = useMutation({ mutationFn: notificationsApi.markRead, onSuccess: () => queryClient.invalidateQueries({ queryKey: getListNotificationsQueryKey() }) });
  const unread = ns.filter((n) => !n.read);
  const markAll = () => unread.forEach((n) => markRead.mutate(n.id));
  const [tab, setTab] = useState<'all' | 'unread' | NotifKind>('all');
  const [term, setTerm] = useState('');
  const [expanded, setExpanded] = useState<Set<number>>(new Set());

  // "Clear all" here only affects this student's own view — their personal
  // notifications are deleted, and any broadcast announcements are hidden
  // just for them (classmates still see them). See notificationsApi.clearMine.
  const [confirmingClearAll, setConfirmingClearAll] = useState(false);
  const clearAll = useMutation({
    mutationFn: notificationsApi.clearMine,
    onSuccess: () => { queryClient.invalidateQueries({ queryKey: getListNotificationsQueryKey() }); setConfirmingClearAll(false); },
    onError: (err: unknown) => toast({ title: 'Could not clear notifications', description: err instanceof ApiRequestError ? err.message : 'Something went wrong.', variant: 'destructive' }),
  });

  const kinds = (Object.keys(KIND) as NotifKind[]).filter((k) => ns.some((n) => kindOf(n) === k));
  const needle = term.trim().toLowerCase();
  const visible = ns.filter((n) => (tab === 'all' || (tab === 'unread' ? !n.read : kindOf(n) === tab)) && (!needle || `${n.title} ${n.body}`.toLowerCase().includes(needle)));
  const groups = BUCKETS.map((b) => ({ b, items: visible.filter((n) => bucketOf(n.createdAt) === b) })).filter((g) => g.items.length);
  const open = (n: Notification) => {
    setExpanded((prev) => { const x = new Set(prev); if (x.has(n.id)) x.delete(n.id); else x.add(n.id); return x; });
    if (!n.read) markRead.mutate(n.id);
  };

  const pills: Array<{ key: 'all' | 'unread' | NotifKind; label: string; n?: number }> = [
    { key: 'all', label: 'All', n: ns.length },
    { key: 'unread', label: 'Unread', n: unread.length },
    ...kinds.map((k) => ({ key: k, label: KIND[k].label, n: ns.filter((x) => kindOf(x) === k).length })),
  ];

  return <div className="max-w-3xl">
    {/* Hero summary */}
    <div className="relative mb-5 overflow-hidden rounded-3xl border border-border bg-gradient-to-br from-primary/15 via-card to-card p-5 sm:p-6" data-testid="notifications-hero">
      <div className="pointer-events-none absolute -right-10 -top-10 size-40 rounded-full bg-primary/15 blur-3xl" />
      <div className="relative flex flex-wrap items-center justify-between gap-4">
        <div className="flex items-center gap-4">
          <div className="relative grid size-14 place-items-center rounded-2xl bg-primary text-primary-foreground shadow-lg shadow-primary/25">
            <Bell size={24} />
            {unread.length > 0 && <span className="absolute -right-1.5 -top-1.5 grid min-w-5 place-items-center rounded-full border-2 border-card bg-destructive px-1 text-[10px] font-extrabold leading-5 text-white" data-testid="badge-unread-count">{unread.length > 99 ? '99+' : unread.length}</span>}
          </div>
          <div>
            <p className="text-[11px] font-extrabold uppercase tracking-widest text-primary">Stay oriented</p>
            <h1 className="text-2xl font-extrabold tracking-tight">Notifications</h1>
            <p className="text-xs text-muted-foreground" data-testid="text-notification-summary">{unread.length ? `${unread.length} unread of ${ns.length}` : ns.length ? `You're all caught up · ${ns.length} total` : 'Nothing here yet'}</p>
          </div>
        </div>
        <div className="flex items-center gap-2">
          {unread.length > 0 && <button onClick={markAll} className="inline-flex items-center gap-1.5 rounded-xl bg-primary px-3.5 py-2 text-xs font-extrabold text-primary-foreground transition-transform active:scale-95" data-testid="button-mark-all-read"><CheckCheck size={14} /> Mark all read</button>}
          {ns.length > 0 && <button onClick={() => setConfirmingClearAll(true)} className="inline-flex items-center gap-1.5 rounded-xl border border-border bg-card/70 px-3.5 py-2 text-xs font-extrabold text-destructive backdrop-blur transition-colors hover:bg-destructive/10" data-testid="button-clear-all-notifications"><Trash2 size={14} /> Clear all</button>}
        </div>
      </div>
    </div>

    {/* Filters + search */}
    {ns.length > 0 && <div className="sticky top-0 z-10 -mx-1 mb-4 space-y-2 bg-background/85 px-1 py-2 backdrop-blur" data-testid="notification-toolbar">
      <div className="relative">
        <Search size={14} className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground" />
        <input value={term} onChange={(e) => setTerm(e.target.value)} placeholder="Search notifications…" className="h-10 w-full rounded-xl border border-border bg-card pl-9 pr-3 text-xs outline-none focus:border-primary" data-testid="input-search-notifications" />
      </div>
      <div className="-mx-1 flex gap-1.5 overflow-x-auto px-1 pb-1">
        {pills.map((p) => <button key={p.key} onClick={() => setTab(p.key)} className={cn('inline-flex shrink-0 items-center gap-1.5 rounded-full border px-3.5 py-1.5 text-xs font-extrabold transition-all active:scale-95', tab === p.key ? 'border-primary bg-primary text-primary-foreground shadow-sm' : 'border-border bg-card text-muted-foreground hover:text-foreground')} data-testid={`filter-notifications-${p.key}`}>{p.label}{!!p.n && <span className={cn('rounded-full px-1.5 text-[10px]', tab === p.key ? 'bg-white/25' : 'bg-muted')}>{p.n}</span>}</button>)}
      </div>
    </div>}

    {/* Timeline */}
    <div className="space-y-6">
      {groups.map((g) => <section key={g.b} data-testid={`notification-group-${g.b}`}>
        <h2 className="mb-2 px-1 text-[11px] font-extrabold uppercase tracking-widest text-muted-foreground">{g.b}</h2>
        <div className="space-y-2.5">
          {g.items.map((n) => {
            const k = KIND[kindOf(n)]; const Icon = k.icon; const isOpen = expanded.has(n.id);
            return <article key={n.id} onClick={() => open(n)} className={cn('group relative flex cursor-pointer gap-3.5 overflow-hidden rounded-2xl border p-4 pl-5 transition-all hover:-translate-y-0.5 hover:shadow-md', n.read ? 'border-border bg-card' : 'border-primary/30 bg-primary/[0.06] shadow-sm')} data-testid={`row-notification-${n.id}`}>
              <span className={cn('absolute inset-y-0 left-0 w-1', n.read ? 'bg-transparent' : k.ring)} />
              <div className={cn('grid size-11 shrink-0 place-items-center rounded-2xl', k.tone)}><Icon size={19} /></div>
              <div className="min-w-0 flex-1">
                <div className="flex items-start justify-between gap-2">
                  <h3 className={cn('text-sm leading-snug', n.read ? 'font-bold' : 'font-extrabold')}>{n.title}</h3>
                  <span className="mt-0.5 shrink-0 text-[10px] font-bold text-muted-foreground" title={n.createdAt}>{timeAgo(n.createdAt)}</span>
                </div>
                <p className={cn('mt-1 text-xs leading-5 text-muted-foreground', !isOpen && 'line-clamp-2')}>{n.body}</p>
                <div className="mt-2 flex items-center gap-2">
                  <span className={cn('rounded-full px-2 py-0.5 text-[10px] font-extrabold', k.tone)}>{k.label}</span>
                  {!n.read && <span className="inline-flex items-center gap-1 text-[10px] font-extrabold text-primary"><span className="size-1.5 animate-pulse rounded-full bg-primary" />New</span>}
                  {!n.read && <button onClick={(e) => { e.stopPropagation(); markRead.mutate(n.id); }} className="ml-auto rounded-lg border border-border px-2.5 py-1 text-[10px] font-bold text-muted-foreground transition-colors hover:bg-muted hover:text-foreground" data-testid={`button-mark-read-${n.id}`}>Mark read</button>}
                </div>
              </div>
            </article>;
          })}
        </div>
      </section>)}

      {ns.length > 0 && !visible.length && <div className="rounded-2xl border border-dashed border-border p-8 text-center text-xs text-muted-foreground" data-testid="notifications-no-match">No notifications match this filter. <button onClick={() => { setTab('all'); setTerm(''); }} className="font-extrabold text-primary">Reset filters</button></div>}
      {!ns.length && !q.isLoading && <div className="rounded-3xl border border-border bg-card p-10 text-center" data-testid="notifications-empty">
        <div className="mx-auto mb-4 grid size-16 place-items-center rounded-2xl bg-primary/10 text-primary"><BellOff size={28} /></div>
        <h3 className="text-base font-extrabold">All caught up</h3>
        <p className="mx-auto mt-1 max-w-xs text-xs leading-5 text-muted-foreground">Nothing new right now. Payment updates, challenges, milestones and announcements will show up here.</p>
      </div>}
      {q.isLoading && <div className="space-y-2.5">{[0, 1, 2].map((i) => <div key={i} className="h-24 animate-pulse rounded-2xl bg-muted" />)}</div>}
    </div>
    {confirmingClearAll && <ConfirmDialog title="Clear all notifications?" body="This clears every notification from your list. Announcements are just hidden from you — other students still see them. There is no undo." confirmLabel="Clear all" onCancel={() => setConfirmingClearAll(false)} onConfirm={() => clearAll.mutate()} pending={clearAll.isPending} />}
  </div>;
}

// Renders every configured way to pay: the enabled methods with their own
// numbers/instructions, every bank account (falling back to the legacy
// single-account fields for older deployments that haven't set up the
// array yet), and the QR code if one's been uploaded. Shared by the
// membership page and the sign-up flow so both stay in sync automatically.

export default Notifications;
