// Auto-extracted shared helpers/components/hooks used across admin page
// modules. Split out of the original monolithic App.tsx so route-level
// pages can be lazy-loaded independently without duplicating this.
import { type ReactNode, type ComponentProps, useState, useEffect, lazy, Suspense } from 'react';
import { QueryClient, QueryClientProvider, useMutation, useQuery } from '@tanstack/react-query';
import { Link, Route, Switch, useLocation, useSearch, useParams, Router as WouterRouter } from 'wouter';
import {
  ArrowLeft, ArrowRight, BookOpen, Check, CheckCircle2, ChevronRight, ChevronUp, ChevronDown,
  CircleHelp, Clock3, CreditCard, FileText, Flame, FolderOpen,
  LayoutDashboard, Library, LockKeyhole, LogOut, Menu, MoreHorizontal, Pencil, Plus,
  ReceiptText, Search, Settings, ShieldCheck, Sparkles, Stethoscope, Target, Trash2,
  TrendingUp, Users, X, Zap, Bell, SlidersHorizontal, FileStack, NotebookPen, Bookmark,
  Flag, Trophy, MessageSquare, Landmark, Copy, QrCode, User as UserIcon, Mail, Phone, Hash,
  GraduationCap, CalendarDays, Eye, EyeOff, Smartphone, UploadCloud, ImageOff,
  RotateCcw, ThumbsUp, ThumbsDown, CheckCheck, ClipboardCheck, AlertTriangle, Wand2, Layers, BarChart3, ToggleLeft,
  Download, Database, Loader2, GripVertical, Shuffle, Percent
} from 'lucide-react';
import { applyThemeVars, DEFAULT_THEME, readableForegroundHsl } from '@/lib/theme';
import { queryClient } from '@/lib/query-client';
import {
  getListMembershipPlansQueryKey, getListPaymentsQueryKey, getListMcqsQueryKey, getListModulesQueryKey, getListStudentsQueryKey, getListNotificationsQueryKey, getGetCurrentUserQueryKey, getListFlashcardsQueryKey,
  useApprovePayment, useCreateMembershipPlan, useCreateMcq, useCreateModule, useGetAdminDashboard, getGetAdminDashboardQueryKey,
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
import { authApi, academicApi, settingsApi, uploadFile, resolveUploadUrl, ApiRequestError, publicApi, pastPapersApi, notebookApi, savedSessionsApi, flaggedMcqsApi, feedbackApi, analyticsApi, mcqImportApi, flashcardImportApi, mcqBackupApi, studentsAdminApi, paymentsAdminApi, membershipPlansAdminApi, mcqAdminApi, subjectAdminApi, topicAdminApi, flashcardsAdminApi, flashcardsAiApi, booksAdminApi, notificationsApi, siteContentApi, teamApi, moduleAdminApi, blockAdminApi, examsAdminApi, examsApi, explanationsApi, auditApi, adminSearchApi, type AdminSearchResponse, DEFAULT_IMPORT_PATTERNS, STUDENT_STATUSES, type Institution, type Program, type AcademicYear, type Batch, type PastPaper, type NotebookEntry, type SavedSession, type FlaggedMcq, type FeedbackEntry, type McqCandidate, type FlashcardCandidate, type StudentDetail, type SiteContent, type TeamMember, TEAM_CATEGORIES, TEAM_CATEGORY_LABELS, type TeamCategory, type AdminModule, type AdminBlock, type AdminSubject, type AdminTopic, type AdminFlashcard, type GeneratedFlashcard, type AdminMcqRow, type AdminBook, type AdminExam, type StudentExam, type ExamAttemptRow, type ExamStartResponse, type ExamResult, type Exam, type ExplanationStatus, type BankAccount, type PaymentMethodConfig, aiVisualizerAdminApi, type AiVisualizerLogEntry, type AuditLogEntry, type BackupScope } from '@/lib/api';

import { BrandedLoadingScreen, InlineLoading, Logo, NavItem, cn, initials } from './ui';


export const navGroups: Array<{ label: string; items: NavItem[] }> = [
  { label: 'Study desk', items: [
    ['/', 'Overview', LayoutDashboard], ['/modules', 'Modules', BookOpen], ['/practice', 'Practice', Target], ['/exams', 'Pre-Proffs Exams', ClipboardCheck], ['/past-papers', 'Past papers', FileStack], ['/flashcards', 'Flashcards', Zap], ['/resources', 'Resources', FolderOpen],
  ] },
  { label: 'Your tools', items: [
    ['/notebook', 'My notebook', NotebookPen], ['/saved-sessions', 'Saved sessions', Bookmark], ['/flagged-mcqs', 'Flagged MCQs', Flag], ['/leaderboard', 'Leaderboard', Trophy],
  ] },
  { label: 'Your account', items: [
    ['/payments', 'Membership', CreditCard], ['/notifications', 'Notifications', Bell], ['/feedback', 'Send feedback', MessageSquare], ['/profile', 'Profile & access', ShieldCheck],
  ] },
];

export const adminGroups: Array<{ label: string; items: NavItem[] }> = [
  { label: 'Overview', items: [
    ['/admin', 'Admin overview', LayoutDashboard], ['/admin/students', 'Students', Users],
  ] },
  { label: 'Payments', items: [
    ['/admin/plans', 'Subscription plans', CreditCard], ['/admin/coupons', 'Coupon codes', Percent], ['/admin/payments', 'Payments & collection', ReceiptText],
  ] },
  { label: 'Curriculum', items: [
    ['/admin/academic-structure', 'Colleges & courses', FolderOpen], ['/admin/content', 'Academic content', Library], ['/admin/subjects', 'Subjects', BookOpen], ['/admin/topics', 'Topics', CircleHelp],
  ] },
  { label: 'Question banks', items: [
    ['/admin/mcqs', 'MCQ bank', CircleHelp], ['/admin/quality', 'Content quality', ShieldCheck], ['/admin/flashcards', 'Flashcards', Zap], ['/admin/books', 'Books library', BookOpen], ['/admin/book-purchases', 'Book purchases', ReceiptText], ['/admin/past-papers', 'Past papers', FileStack], ['/admin/exams', 'Pre-Proffs Exams', ClipboardCheck], ['/admin/ospe-osce', 'OSPE/OSCE', Stethoscope],
  ] },
  { label: 'Site & team', items: [
    ['/admin/team', 'Academic team', Users], ['/admin/site-content', 'Site content', Landmark],
  ] },
  { label: 'Activity', items: [
    ['/admin/feedback', 'Feedback inbox', MessageSquare], ['/admin/ai-visualizer-logs', 'AI Visualizer activity', Wand2],
  ] },
  { label: 'Workspace', items: [
    ['/admin/settings', 'Platform settings', Settings], ['/admin/database-backup', 'Database backup & restore', Database],
  ] },
];

// Per-group accent for the sidebar's icon tiles — a little colour so the
// groups are recognisable at a glance instead of one uniform column of icons.
const GROUP_TONE: Record<string, string> = {
  Overview: 'bg-sidebar-primary/15 text-sidebar-primary',
  Payments: 'bg-accent/15 text-accent',
  Curriculum: 'bg-chip-info/15 text-chip-info',
  'Question banks': 'bg-chip-violet/15 text-chip-violet',
  'Site & team': 'bg-destructive/15 text-destructive',
  Activity: 'bg-chip-success/15 text-chip-success',
  Workspace: 'bg-sidebar-foreground/15 text-sidebar-foreground',
};

// Header title + section eyebrow for the current route, taken from the same
// nav list the sidebar renders so the two can never disagree (the header
// used to show the raw URL path, e.g. "admin / ai visualizer logs").
function currentPageInfo(location: string): { title: string; group: string } {
  for (const group of adminGroups) {
    for (const [href, label] of group.items) if (href === location) return { title: label, group: group.label };
  }
  if (location === '/admin/payment-details') return { title: 'Payments & collection', group: 'Payments' };
  if (location === '/notifications') return { title: 'Notifications', group: 'Account' };
  if (location === '/profile') return { title: 'Your profile', group: 'Account' };
  return { title: location.slice(1).split('/').filter((p) => p !== 'admin').map((part) => part.replaceAll('-', ' ')).join(' / ') || 'Overview', group: 'Admin' };
}

// Pending-work counts shown as small badges in the sidebar and the mobile
// bottom bar, so the admin sees what needs attention without opening pages.
// Uses the same cached list queries the Students / Payments pages already
// load, so this adds no extra requests once those have been visited.
function useAdminBadges(): Record<string, number> {
  const paymentsQ = useListPayments();
  const studentsQ = useListStudents();
  const pendingPayments = (paymentsQ.data ?? []).filter((p) => p.status === 'PAYMENT_PENDING_REVIEW').length;
  const pendingStudents = (studentsQ.data ?? []).filter((st) => st.status === 'PAYMENT_PENDING_REVIEW').length;
  return { '/admin/payments': pendingPayments, '/admin/students': pendingStudents };
}

const NAV_OPEN_KEY = 'admin-nav-open-groups';
function readOpenGroups(): string[] | null {
  try { const raw = localStorage.getItem(NAV_OPEN_KEY); return raw ? (JSON.parse(raw) as string[]) : null; } catch { return null; }
}

export function SideNav({ user, onClose }: { user: User; onClose: () => void }) {
  const [location] = useLocation();
  const groups = adminGroups;
  const badges = useAdminBadges();
  const notifQ = useListNotifications();
  const unreadCount = (notifQ.data ?? []).filter((n) => !n.read).length;
  // Same public bundle the student app reads — lets an admin see at a glance
  // that a free trial is live (it's easy to forget one is switched on).
  const siteQ = useQuery({ queryKey: ['site-content'], queryFn: siteContentApi.get });
  const trial = siteQ.data?.trial;
  const logout = useMutation({ mutationFn: authApi.logout, onSuccess: () => { queryClient.clear(); window.location.href = '/login'; } });
  const isActive = (href: string) => location === href || (href === '/admin/payments' && location === '/admin/payment-details');
  const activeGroup = groups.find((g) => g.items.some(([href]) => isActive(href)))?.label;
  // Groups are collapsible so the long list stays scannable: the group you are
  // in is always open, the rest remember how you left them.
  const [openGroups, setOpenGroups] = useState<string[]>(() => readOpenGroups() ?? ['Overview', 'Payments']);
  useEffect(() => { if (activeGroup) setOpenGroups((cur) => (cur.includes(activeGroup) ? cur : [...cur, activeGroup])); }, [activeGroup]);
  const toggleGroup = (label: string) => setOpenGroups((cur) => {
    const next = cur.includes(label) ? cur.filter((l) => l !== label) : [...cur, label];
    try { localStorage.setItem(NAV_OPEN_KEY, JSON.stringify(next)); } catch { /* storage unavailable */ }
    return next;
  });
  return <aside className="admin-sidebar fixed inset-y-0 left-0 z-40 flex w-[min(300px,86vw)] flex-col overflow-y-auto bg-sidebar px-3 pb-[max(1rem,env(safe-area-inset-bottom))] pt-[max(1.25rem,env(safe-area-inset-top))] text-sidebar-foreground shadow-2xl animate-in slide-in-from-left duration-200 md:sticky md:top-0 md:h-[100dvh] md:w-[268px] md:shadow-none md:animate-none">
    <div className="mb-4 flex items-center justify-between px-2"><Logo dark /><button className="grid size-10 place-items-center rounded-xl text-sidebar-foreground/70 hover:bg-sidebar-accent md:hidden" onClick={onClose} aria-label="Close menu" data-testid="button-close-menu"><X size={18} /></button></div>
    {trial?.active && <Link href="/admin/settings?tab=access" onClick={onClose} className="mb-3 flex items-center gap-2.5 rounded-xl border border-accent/40 bg-accent/10 px-3 py-2.5 text-[11px] font-bold text-accent transition-colors hover:bg-accent/20" data-testid="chip-admin-trial-live">
      <span className="relative flex size-2"><span className="absolute inline-flex size-full animate-ping rounded-full bg-accent opacity-70" /><span className="relative inline-flex size-2 rounded-full bg-accent" /></span>
      <span className="min-w-0 flex-1"><span className="block">Free trial is live</span><span className="block truncate text-[10px] font-medium text-accent/70">{trial.features.length} feature{trial.features.length === 1 ? '' : 's'}{trial.program ? ` · ${trial.program}` : ''}{trial.years.length ? ` · Yr ${trial.years.join(', ')}` : ''}</span></span>
      <ChevronRight size={13} />
    </Link>}
    <nav className="space-y-1" aria-label="Admin navigation">
      {groups.map((group) => {
        const open = openGroups.includes(group.label);
        const groupBadge = group.items.reduce((sum, [href]) => sum + (badges[href] ?? 0), 0);
        return <div key={group.label}>
          <button type="button" onClick={() => toggleGroup(group.label)} aria-expanded={open} className="flex w-full items-center gap-2 rounded-lg px-3 py-2 text-left font-mono-app text-[10px] font-bold uppercase tracking-[.14em] text-sidebar-foreground/50 transition-colors hover:text-sidebar-foreground/90" data-testid={`button-nav-group-${group.label.toLowerCase().replaceAll(' ', '-')}`}>
            <span className="flex-1">{group.label}</span>
            {!open && groupBadge > 0 && <span className="grid min-w-4 place-items-center rounded-full bg-accent px-1 text-[9px] font-bold leading-4 text-accent-foreground">{groupBadge}</span>}
            <ChevronDown size={12} className={cn('transition-transform', !open && '-rotate-90')} />
          </button>
          {open && <div className="mb-2 space-y-0.5">{group.items.map(([href, label, Icon]) => {
            const active = isActive(href);
            const count = badges[href] ?? 0;
            return <Link key={href} href={href} onClick={onClose} aria-current={active ? 'page' : undefined}
              className={cn('group relative flex min-h-10 items-center gap-3 rounded-xl px-3 py-2 text-[13px] font-semibold transition-colors', active ? 'bg-sidebar-primary/15 text-sidebar-primary' : 'text-sidebar-foreground/75 hover:bg-sidebar-accent/70 hover:text-sidebar-accent-foreground')}
              data-testid={`link-nav-${label.toLowerCase().replaceAll(' ', '-')}`}>
              {active && <span className="absolute left-0 top-1/2 h-5 w-[3px] -translate-y-1/2 rounded-r-full bg-sidebar-primary" />}
              <Icon size={17} strokeWidth={active ? 2.3 : 1.9} className="shrink-0" />
              <span className="min-w-0 flex-1 truncate">{label}</span>
              {count > 0 && <span className="grid min-w-5 place-items-center rounded-full bg-accent px-1.5 text-[10px] font-bold leading-5 text-accent-foreground" aria-label={`${count} pending`}>{count > 99 ? '99+' : count}</span>}
            </Link>;
          })}</div>}
        </div>;
      })}
    </nav>
    <div className="mt-auto pt-5">
      <Link href="/notifications" onClick={onClose} className="mb-2 flex min-h-10 items-center gap-3 rounded-xl px-3 py-2 text-[13px] font-semibold text-sidebar-foreground/75 hover:bg-sidebar-accent/70" data-testid="link-nav-notifications"><Bell size={17} /><span className="flex-1">Notifications</span>{unreadCount > 0 && <span className="grid min-w-5 place-items-center rounded-full bg-accent px-1.5 text-[10px] font-bold leading-5 text-accent-foreground">{unreadCount > 9 ? '9+' : unreadCount}</span>}</Link>
      <div className="flex items-center gap-3 rounded-2xl border border-sidebar-border/70 bg-sidebar-accent/40 px-3 py-2.5">
        <div className="grid size-9 shrink-0 place-items-center rounded-full bg-sidebar-primary text-xs font-extrabold text-sidebar-primary-foreground">{initials(user.name)}</div>
        <div className="min-w-0 flex-1"><div className="truncate text-xs font-bold text-sidebar-foreground">{user.name}</div><div className="truncate text-[10px] text-sidebar-foreground/50">Administrator</div></div>
        <button onClick={() => logout.mutate()} disabled={logout.isPending} className="grid size-9 place-items-center rounded-lg text-sidebar-foreground/60 transition-colors hover:bg-white/10 hover:text-sidebar-foreground disabled:opacity-50" data-testid="button-signout" title="Sign out" aria-label="Sign out"><LogOut size={15} /></button>
      </div>
    </div>
  </aside>;
}

// Every route below is wrapped in <Shell>, so this is the one place that has
// to enforce "must be signed in" and "must be admin for /admin/*" before
// rendering real content — a signed-out or under-privileged user should never
// see so much as a flash of the dashboard/admin UI underneath.

// Universal admin search — a Cmd/Ctrl+K palette hitting GET /admin/search
// (admin-search.ts), so "find a student" (or an MCQ, module, subject,
// topic, exam, or past paper) doesn't require already knowing which of the
// ~10 separate admin pages it lives on. Debounced 300ms so typing doesn't
// fire a query per keystroke; each category caps at a handful of results
// and links straight to the page that owns it. Students deep-link to
// AdminStudents with ?focus=<id>, which opens that student's drawer
// directly (see AdminStudents.tsx) — the other categories currently open
// their list page (no per-row deep link exists yet on those pages), which
// is still a large step up from "guess which page, then use its own local
// search box."
export function AdminGlobalSearch({ open, onClose }: { open: boolean; onClose: () => void }) {
  const [value, setValue] = useState('');
  const [debounced, setDebounced] = useState('');
  useEffect(() => { const t = setTimeout(() => setDebounced(value.trim()), 300); return () => clearTimeout(t); }, [value]);
  useEffect(() => { if (!open) setValue(''); }, [open]);
  const q = useQuery({ queryKey: ['admin-search', debounced], queryFn: () => adminSearchApi.search(debounced), enabled: open && debounced.length >= 2 });
  if (!open) return null;
  const data = q.data;
  const sections: Array<{ key: keyof AdminSearchResponse; label: string; icon: typeof Users; href: (id: number) => string }> = [
    { key: 'students', label: 'Students', icon: Users, href: (id) => `/admin/students?focus=${id}` },
    { key: 'mcqs', label: 'MCQ bank', icon: CircleHelp, href: () => '/admin/mcqs' },
    { key: 'modules', label: 'Modules', icon: BookOpen, href: () => '/admin/content' },
    { key: 'subjects', label: 'Subjects', icon: Library, href: () => '/admin/subjects' },
    { key: 'topics', label: 'Topics', icon: FolderOpen, href: () => '/admin/topics' },
    { key: 'exams', label: 'Pre-Proffs Exams', icon: ClipboardCheck, href: () => '/admin/exams' },
    { key: 'pastPapers', label: 'Past papers', icon: FileStack, href: () => '/admin/past-papers' },
  ];
  const totalResults = data ? sections.reduce((sum, s) => sum + data[s.key].length, 0) : 0;
  return <div className="fixed inset-0 z-40 flex items-start justify-center bg-sidebar/40 px-4 pt-[12vh]" onClick={onClose} data-testid="overlay-admin-search">
    <div className="w-full max-w-xl overflow-hidden rounded-2xl border border-border bg-card shadow-2xl" onClick={(e) => e.stopPropagation()} data-testid="panel-admin-search">
      <div className="flex items-center gap-2.5 border-b border-border px-4 py-3.5"><Search size={16} className="shrink-0 text-muted-foreground" /><input autoFocus value={value} onChange={(e) => setValue(e.target.value)} placeholder="Search students, MCQs, modules, exams..." className="h-6 min-w-0 flex-1 bg-transparent text-sm outline-none placeholder:text-muted-foreground" data-testid="input-admin-search" /><button onClick={onClose} className="shrink-0 rounded p-1 text-muted-foreground hover:bg-muted" data-testid="button-close-admin-search"><X size={15} /></button></div>
      <div className="max-h-[60vh] overflow-y-auto p-2">
        {debounced.length < 2 ? <div className="px-3 py-8 text-center text-xs text-muted-foreground">Type at least 2 characters to search across the whole platform.</div>
          : q.isLoading ? <div className="px-3 py-8 text-center text-xs text-muted-foreground"><InlineLoading label="Searching…" /></div>
          : !totalResults ? <div className="px-3 py-8 text-center text-xs text-muted-foreground">No results for "{debounced}".</div>
          : sections.filter((s) => data![s.key].length).map((s) => <div key={s.key} className="mb-1.5 last:mb-0">
            <div className="px-2.5 py-1.5 text-[10px] font-bold uppercase tracking-[.1em] text-muted-foreground">{s.label}</div>
            {data![s.key].map((r) => <Link key={r.id} href={s.href(r.id)} onClick={onClose} className="flex items-center gap-2.5 rounded-lg px-2.5 py-2.5 text-xs font-semibold text-foreground hover:bg-muted" data-testid={`link-admin-search-${s.key}-${r.id}`}>
              <span className="grid size-7 shrink-0 place-items-center rounded-md bg-muted text-primary"><s.icon size={14} /></span>
              <span className="min-w-0 flex-1"><span className="block truncate">{r.title}</span>{r.subtitle && <span className="block truncate text-[10px] font-normal text-muted-foreground">{r.subtitle}</span>}</span>
              <ChevronRight size={13} className="shrink-0 text-muted-foreground" />
            </Link>)}
          </div>)}
      </div>
    </div>
  </div>;
}

export function Shell({ children }: { children: ReactNode }) {
  const [menuOpen, setMenuOpen] = useState(false);
  const [searchOpen, setSearchOpen] = useState(false);
  useEffect(() => {
    function handleKeydown(e: KeyboardEvent) { if ((e.metaKey || e.ctrlKey) && e.key.toLowerCase() === 'k') { e.preventDefault(); setSearchOpen(true); } }
    window.addEventListener('keydown', handleKeydown);
    return () => window.removeEventListener('keydown', handleKeydown);
  }, []);
  // retry: false — a failed/unusable current-user response should send the
  // user to /login promptly, not spend several silent retries first.
  const userQuery = useGetCurrentUser({ query: { retry: false, queryKey: getGetCurrentUserQueryKey() } });
  const [location, setLocation] = useLocation();
  const isMobile = useIsMobile();
  const user = userQuery.data;
  useEffect(() => { setMenuOpen(false); }, [location]);
  useEffect(() => { document.body.style.overflow = menuOpen ? 'hidden' : ''; return () => { document.body.style.overflow = ''; }; }, [menuOpen]);
  const badges = useAdminBadges();

  useEffect(() => {
    if (userQuery.isLoading) return;
    if (!user || user.role !== 'admin') {
      // A hard navigation (not wouter's client-side setLocation) so any
      // stale/broken React Query cache from the failed session is fully
      // discarded rather than carried into the next render — a soft route
      // change alone was letting a bad cached response resurface the same
      // crash after refresh instead of landing cleanly on the login page.
      // This deployment only serves admin routes — a non-admin account
      // (e.g. a student who signed in here by mistake) must never see admin
      // UI, so it's treated the same as "not signed in" and sent to /login.
      queryClient.clear();
      window.location.href = '/login';
      return;
    }
  }, [user, userQuery.isLoading, setLocation]);

  if (userQuery.isLoading) return <BrandedLoadingScreen />;
  // Was a bare skeleton on a plain white background here — this branch
  // renders on every signed-out page load for the instant before the
  // effect above fires its redirect to /login (see that effect's own
  // comment), so it's not really a "content still loading" state, it's a
  // brief full-page gap exactly like the route Suspense fallback used to
  // be. Same fix: the branded loader instead of a blank-looking page.
  if (!user || user.role !== 'admin') return <BrandedLoadingScreen />;

  const { title, group: pageGroup } = currentPageInfo(location);
  const bottomTabs: Array<[string, string, typeof LayoutDashboard]> = [['/admin', 'Overview', LayoutDashboard], ['/admin/students', 'Students', Users], ['/admin/payments', 'Payments', ReceiptText], ['/admin/mcqs', 'MCQs', CircleHelp]];
  const tabActive = (href: string) => (href === '/admin' ? location === '/admin' : location === href || location.startsWith(`${href}/`) || (href === '/admin/payments' && location === '/admin/payment-details'));
  return <div className="admin-shell flex min-h-[100dvh] bg-background">
    <div className={cn(menuOpen ? 'block' : 'hidden', 'fixed inset-0 z-30 bg-black/50 backdrop-blur-[2px] md:hidden')} onClick={() => setMenuOpen(false)} />
    {(menuOpen || !isMobile) && <SideNav user={user} onClose={() => setMenuOpen(false)} />}
    <main className="admin-main min-w-0 flex-1">
      <header className="admin-header sticky top-0 z-20 flex h-14 items-center justify-between gap-3 border-b border-border/70 bg-background/80 px-3 pt-[env(safe-area-inset-top)] backdrop-blur-xl sm:px-5 md:h-16 md:px-8 md:pt-0">
        <div className="flex min-w-0 items-center gap-2">
          <button className="grid size-10 shrink-0 place-items-center rounded-xl hover:bg-muted md:hidden" onClick={() => setMenuOpen(true)} aria-label="Open menu" data-testid="button-open-menu"><Menu size={20} /></button>
          <div className="min-w-0"><div className="hidden truncate font-mono-app text-[10px] uppercase tracking-[.14em] text-muted-foreground sm:block">Admin · {pageGroup}</div><h1 className="truncate text-[16px] font-extrabold leading-tight tracking-[-.02em] text-foreground md:text-[18px]">{title}</h1></div>
        </div>
        <div className="flex shrink-0 items-center gap-1.5 sm:gap-2">
          <button onClick={() => setSearchOpen(true)} className="hidden h-10 w-[220px] items-center gap-2 rounded-xl border border-border bg-card px-3 text-left text-[12px] text-muted-foreground hover:border-primary/50 sm:flex md:w-[320px]" data-testid="button-open-admin-search"><Search size={14} /><span className="truncate">Search students, MCQs, everything...</span><span className="ml-auto rounded border border-border px-1 text-[9px]">⌘K</span></button>
          <button onClick={() => setSearchOpen(true)} className="grid size-10 place-items-center rounded-xl border border-border bg-card text-muted-foreground hover:bg-muted sm:hidden" aria-label="Search" data-testid="button-open-admin-search-mobile"><Search size={17} /></button>
          <Link href="/notifications" className="relative grid size-10 place-items-center rounded-xl border border-border bg-card text-muted-foreground hover:bg-muted" aria-label="Notifications" data-testid="link-notifications"><Bell size={17} /></Link>
          <Link href="/admin/settings" className="hidden size-10 place-items-center rounded-xl border border-border bg-card text-muted-foreground transition-colors hover:bg-muted hover:text-foreground sm:grid" title="Platform settings" aria-label="Platform settings" data-testid="link-header-settings"><Settings size={16} /></Link>
          <Link href="/profile" className="grid size-10 place-items-center rounded-full bg-primary/15 text-xs font-extrabold text-primary" aria-label="Your profile" data-testid="link-header-profile">{initials(user.name)}</Link>
        </div>
      </header>
      <div className="admin-content page-enter mx-auto w-full max-w-[1400px] px-3 py-5 pb-28 sm:px-5 md:px-8 md:py-8 md:pb-10">{children}</div>
    </main>
    <nav className="admin-bottom-nav fixed inset-x-0 bottom-0 z-20 grid grid-cols-5 border-t border-border/70 bg-background/90 pb-[env(safe-area-inset-bottom)] backdrop-blur-xl md:hidden" aria-label="Quick navigation">
      {bottomTabs.map(([href, label, Icon]) => {
        const active = tabActive(href); const count = badges[href] ?? 0;
        return <Link key={href} href={href} aria-current={active ? 'page' : undefined} className={cn('relative flex min-h-14 flex-col items-center justify-center gap-0.5 text-[10px] font-bold transition-colors', active ? 'text-primary' : 'text-muted-foreground')} data-testid={`tab-${label.toLowerCase()}`}>
          <span className={cn('relative grid h-7 w-12 place-items-center rounded-full transition-colors', active && 'bg-primary/12')}><Icon size={19} strokeWidth={active ? 2.4 : 1.9} />{count > 0 && <span className="absolute -right-0.5 -top-0.5 grid min-w-4 place-items-center rounded-full bg-accent px-1 text-[9px] font-bold leading-4 text-accent-foreground">{count > 99 ? '99+' : count}</span>}</span>{label}
        </Link>;
      })}
      <button type="button" onClick={() => setMenuOpen(true)} className="flex min-h-14 flex-col items-center justify-center gap-0.5 text-[10px] font-bold text-muted-foreground" data-testid="tab-more"><span className="grid h-7 w-12 place-items-center rounded-full"><Menu size={19} /></span>More</button>
    </nav>
    <AdminGlobalSearch open={searchOpen} onClose={() => setSearchOpen(false)} />
  </div>;
}

// Keeps the browser-tab icon in sync with whatever favicon an admin has
// uploaded, without needing a server-rendered <head> per request. Runs once
// per app load and again whenever the cached site-content changes (e.g.
// right after an admin saves a new favicon in Platform settings).

export function useFaviconSync() {
  const { data } = useQuery({ queryKey: ['site-content'], queryFn: siteContentApi.get, staleTime: 5 * 60 * 1000 });
  useEffect(() => {
    if (!data?.faviconUrl) return;
    let link = document.querySelector<HTMLLinkElement>('link[rel="icon"]');
    if (!link) { link = document.createElement('link'); link.rel = 'icon'; document.head.appendChild(link); }
    link.href = resolveUploadUrl(data.faviconUrl) ?? data.faviconUrl;
  }, [data?.faviconUrl]);
}

// See frontend-student's useThemeSync for the full rationale — same
// ['site-content'] query as useFaviconSync above (deduped by react-query),
// applied from AppRoutes so signed-out /login and /admin/login match too.

export function useThemeSync() {
  const { data } = useQuery({ queryKey: ['site-content'], queryFn: siteContentApi.get, staleTime: 5 * 60 * 1000 });
  useEffect(() => { applyThemeVars(data ?? null); }, [data]);
}

