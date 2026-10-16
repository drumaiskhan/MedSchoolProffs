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
import { SidebarNav, SidebarProfile, type SidebarGroup } from '@/components/nav/SidebarNav';


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

// Hue (HSL degrees) of each page's keycap in the sidebar — same idea as the
// student panel's NAV_HUE, so the glossy icon tiles tint per destination.
const NAV_HUE: Record<string, number> = {
  '/admin': 214, '/admin/students': 172, '/admin/plans': 152, '/admin/coupons': 38, '/admin/payments': 45,
  '/admin/academic-structure': 205, '/admin/content': 228, '/admin/subjects': 190, '/admin/topics': 200,
  '/admin/mcqs': 268, '/admin/quality': 160, '/admin/flashcards': 290, '/admin/books': 22, '/admin/book-purchases': 12,
  '/admin/past-papers': 350, '/admin/exams': 4, '/admin/ospe-osce': 330,
  '/admin/team': 240, '/admin/site-content': 215, '/admin/feedback': 180, '/admin/ai-visualizer-logs': 275,
  '/admin/settings': 210, '/admin/database-backup': 195, '/notifications': 200, '/profile': 240,
};
const NAV_HUE_FALLBACK = 214;

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

export function SideNav({ user, onClose }: { user: User; onClose: () => void }) {
  const [location] = useLocation();
  const badges = useAdminBadges();
  const notifQ = useListNotifications();
  const unreadCount = (notifQ.data ?? []).filter((n) => !n.read).length;
  // Same public bundle the student app reads — lets an admin see at a glance
  // that a free trial is live (it's easy to forget one is switched on).
  const siteQ = useQuery({ queryKey: ['site-content'], queryFn: siteContentApi.get });
  const trial = siteQ.data?.trial;
  const logout = useMutation({ mutationFn: authApi.logout, onSuccess: () => { queryClient.clear(); window.location.href = '/login'; } });
  const isActive = (href: string) => (href === '/admin'
    ? location === '/admin' || location === '/'
    : location === href || location.startsWith(`${href}/`) || (href === '/admin/payments' && location === '/admin/payment-details'));
  const toItem = ([href, label, Icon]: NavItem, badge = 0) => ({
    href, label, icon: Icon,
    hue: NAV_HUE[href] ?? NAV_HUE_FALLBACK,
    locked: false,
    active: isActive(href),
    slug: label.toLowerCase().replaceAll(' ', '-'),
    badge,
  });
  // Same presentation component as the student sidebar (sliding puck, hover
  // ghost, pointer spotlight, keycap icons, tilting profile card).
  const navView: SidebarGroup[] = [
    ...adminGroups.map((group) => ({ label: group.label, items: group.items.map((item) => toItem(item, badges[item[0]] ?? 0)) })),
    { label: 'Account', items: [toItem(['/notifications', 'Notifications', Bell], unreadCount), toItem(['/profile', 'Your profile', UserIcon])] },
  ];
  return <aside className="admin-sidebar fixed inset-y-0 left-0 z-40 flex w-[256px] flex-col overflow-y-auto bg-sidebar px-3.5 py-5 text-sidebar-foreground shadow-xl md:sticky md:top-0 md:h-[100dvh] md:shadow-none">
    <div className="sb-ambient" aria-hidden="true"><i className="sb-orb sb-orb--a" /><i className="sb-orb sb-orb--b" /></div>
    <div className="relative z-[1] mb-6 flex items-center justify-between px-2"><Logo dark /><button className="rounded-lg p-2 text-sidebar-foreground/60 hover:bg-sidebar-accent md:hidden" onClick={onClose} aria-label="Close menu" data-testid="button-close-menu"><X size={18} /></button></div>
    {trial?.active && <Link href="/admin/settings?tab=access" onClick={onClose} className="relative z-[1] mb-4 flex items-center gap-2.5 rounded-xl border border-accent/40 bg-accent/10 px-3 py-2.5 text-[11px] font-bold text-accent transition-colors hover:bg-accent/20" data-testid="chip-admin-trial-live">
      <span className="relative flex size-2"><span className="absolute inline-flex size-full animate-ping rounded-full bg-accent opacity-70" /><span className="relative inline-flex size-2 rounded-full bg-accent" /></span>
      <span className="min-w-0 flex-1"><span className="block">Free trial is live</span><span className="block truncate text-[10px] font-medium text-accent/70">{trial.features.length} feature{trial.features.length === 1 ? '' : 's'}{trial.program ? ` · ${trial.program}` : ''}{trial.years.length ? ` · Yr ${trial.years.join(', ')}` : ''}</span></span>
      <ChevronRight size={13} />
    </Link>}
    <SidebarNav groups={navView} onNavigate={onClose} />
    <div className="relative z-[1] mt-auto pt-6">
      <SidebarProfile initials={initials(user.name)} name={user.name} subtitle="Administrator" onSignOut={() => logout.mutate()} signingOut={logout.isPending} />
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
  const headerNotifQ = useListNotifications();
  const headerUnread = (headerNotifQ.data ?? []).filter((n) => !n.read).length;

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
  const bottomTabs: Array<[string, string, typeof LayoutDashboard]> = [['/admin', 'Home', LayoutDashboard], ['/admin/students', 'Students', Users], ['/admin/payments', 'Payments', ReceiptText], ['/admin/mcqs', 'MCQs', CircleHelp]];
  const tabActive = (href: string) => (href === '/admin' ? location === '/admin' || location === '/' : location === href || location.startsWith(`${href}/`) || (href === '/admin/payments' && location === '/admin/payment-details'));
  const todayLong = new Date().toLocaleDateString('en-US', { weekday: 'long', day: 'numeric', month: 'long', year: 'numeric' });
  const todayShort = new Date().toLocaleDateString('en-US', { weekday: 'short', day: 'numeric', month: 'short' });
  return <div className="admin-shell flex min-h-[100dvh] bg-background">
    <div className={cn(menuOpen ? 'block' : 'hidden', 'sb-scrim fixed inset-0 z-30 bg-[#071e2b]/45 md:hidden')} onClick={() => setMenuOpen(false)} />
    <div className={cn((menuOpen || !isMobile) ? 'block' : 'hidden')}><SideNav user={user} onClose={() => setMenuOpen(false)} /></div>
    <main className="admin-main min-w-0 max-w-full flex-1">
      <header className="admin-header sticky top-0 z-20 flex h-[68px] items-center justify-between border-b border-border/70 bg-background/90 px-4 backdrop-blur-md md:px-8">
        <div className="flex min-w-0 items-center gap-3">
          <button className="rounded-lg p-2 hover:bg-muted md:hidden" onClick={() => setMenuOpen(true)} aria-label="Open menu" data-testid="button-open-menu"><Menu size={20} /></button>
          <div className="min-w-0"><div className="font-mono-app whitespace-nowrap text-[9px] uppercase tracking-[.16em] text-muted-foreground"><span className="hidden md:inline">{todayLong}</span><span className="md:hidden">{todayShort}</span><span className="hidden sm:inline"> · Admin · {pageGroup}</span></div><h1 className="mt-1 block max-w-full overflow-hidden text-ellipsis whitespace-nowrap text-[17px] font-extrabold leading-tight tracking-[-.02em] text-foreground" title={title}>{title}</h1></div>
        </div>
        <div className="relative flex items-center gap-2">
          <button onClick={() => setSearchOpen(true)} className="hidden h-9 w-[220px] items-center gap-2 rounded-xl border border-border bg-card px-3 text-left text-[11px] text-muted-foreground shadow-sm hover:border-primary/50 sm:flex md:w-[340px]" data-testid="button-open-admin-search"><Search size={14} /><span className="truncate">Search students, MCQs, everything…</span><span className="ml-auto rounded border border-border px-1 text-[9px]">⌘K</span></button>
          <button onClick={() => setSearchOpen(true)} className="grid size-9 place-items-center rounded-xl border border-border bg-card text-muted-foreground hover:bg-muted sm:hidden" aria-label="Search" data-testid="button-open-admin-search-mobile"><Search size={16} /></button>
          <Link href="/notifications" className="relative grid size-9 place-items-center rounded-xl border border-border bg-card text-muted-foreground transition-colors hover:bg-muted hover:text-foreground" aria-label="Notifications" data-testid="link-notifications"><Bell size={16} />{headerUnread > 0 && <span className="absolute -right-1 -top-1 grid min-w-4 place-items-center rounded-full bg-[#e5a952] px-1 text-[9px] font-bold leading-4 text-[#183844] ring-2 ring-background" data-testid="badge-header-unread">{headerUnread > 9 ? '9+' : headerUnread}</span>}</Link>
          <Link href="/admin/settings" className="hidden size-9 place-items-center rounded-xl border border-border bg-card text-muted-foreground transition-colors hover:bg-muted hover:text-foreground sm:grid" title="Platform settings" aria-label="Platform settings" data-testid="link-header-settings"><Settings size={16} /></Link>
          <Link href="/profile" className="ml-1 grid size-9 place-items-center rounded-full bg-[#cdebf0] text-[11px] font-extrabold text-[#0d5267] ring-2 ring-transparent transition-shadow hover:ring-primary/30" aria-label="Your profile" data-testid="link-header-profile">{initials(user.name)}</Link>
        </div>
      </header>
      <div className="page-enter admin-content mx-auto w-full max-w-[1400px] px-4 py-6 pb-28 md:px-8 md:py-9">{children}</div>
      <nav aria-label="Quick navigation" className="tabbar-safe fixed inset-x-0 bottom-0 z-20 w-full max-w-full px-3 md:hidden" data-testid="tabbar-mobile">
        <div className="tabbar-dock mx-auto flex w-full max-w-md items-stretch gap-1 rounded-2xl border border-border bg-card/95 p-1.5 backdrop-blur-md">
          {bottomTabs.map(([href, label, Icon]) => {
            const active = tabActive(href); const count = badges[href] ?? 0;
            return <Link key={href} href={href} aria-current={active ? 'page' : undefined} className={cn('relative flex min-w-0 flex-1 flex-col items-center gap-0.5 rounded-xl py-2 text-[10px] font-bold transition-colors', active ? 'tab-key text-primary' : 'text-muted-foreground hover:bg-muted/70')} data-testid={`tab-${label.toLowerCase()}`}>
              <Icon size={19} strokeWidth={active ? 2.4 : 2} />{label}
              {count > 0 && <span className="absolute right-2 top-1 grid min-w-4 place-items-center rounded-full bg-accent px-1 text-[9px] font-bold leading-4 text-accent-foreground">{count > 99 ? '99+' : count}</span>}
            </Link>;
          })}
          <button type="button" onClick={() => setMenuOpen(true)} className="relative flex min-w-0 flex-1 flex-col items-center gap-0.5 rounded-xl py-2 text-[10px] font-bold text-muted-foreground hover:bg-muted/70" aria-label="More — open full menu" data-testid="tab-more"><Menu size={19} />More</button>
        </div>
      </nav>
    </main>
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

