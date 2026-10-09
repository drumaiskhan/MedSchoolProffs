// Auto-extracted shared helpers/components/hooks used across page modules.
// Split out of the original monolithic App.tsx so route-level pages can be
// lazy-loaded independently without dragging this along more than once.
import { type ReactNode, type ComponentProps, type TouchEvent, useState, useEffect, useRef, createContext, useContext } from 'react';
import { QueryClient, QueryClientProvider, useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { Link, Route, Switch, useLocation, useParams, useSearch, Router as WouterRouter } from 'wouter';
import {
  ArrowLeft, ArrowRight, BookOpen, Check, CheckCircle2, ChevronRight,
  CircleHelp, Clock3, CreditCard, FileText, Flame, FolderOpen,
  LayoutDashboard, CalendarCheck, Library, LockKeyhole, LogOut, Menu, MoreHorizontal, Pencil, Plus,
  ReceiptText, Search, Settings, ShieldCheck, Sparkles, Stethoscope, Target, Trash2,
  TrendingUp, TrendingDown, Minus, Users, X, Zap, Bell, SlidersHorizontal, FileStack, NotebookPen, Bookmark,
  Flag, Trophy, MessageSquare, Landmark, Copy, QrCode, User as UserIcon, Mail, Phone, Hash,
  GraduationCap, Eye, EyeOff, Smartphone, UploadCloud, ImageOff,
  RotateCcw, ThumbsUp, ThumbsDown, CheckCheck, ClipboardCheck, AlertTriangle, Link2 as LinkIcon, Lightbulb,
  LayoutGrid, Presentation, Wand2, Crown, Globe, Star, Megaphone, Swords
} from 'lucide-react';
import { applyThemeVars } from '@/lib/theme';
import { Aurora, AuthShowcase } from '@/lib/landing-visuals';
import { SubjectIcon, resolveSubjectIcon } from '@/lib/subject-icons';
import { queryClient } from '@/lib/query-client';
import { isNativeApp, clearNativeAuthToken } from '@/lib/native-auth';
import { clearSessionMark } from '@/lib/session-persistence';
import { SidebarNav, SidebarProfile, type SidebarGroup } from '@/components/nav/SidebarNav';
import { AchievementToaster } from '@/components/AchievementToaster';
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
import { CommandPalette, type PalettePage } from '@/components/search/CommandPalette';
import { BlockPoster, ModulePoster } from '@/components/blocks/BlockCards';
import { Toaster } from '@/components/ui/toaster';
import { toast } from '@/hooks/use-toast';
import { useIsMobile } from '@/hooks/use-mobile';
import { TooltipProvider } from '@/components/ui/tooltip';
import NotFound from '@/pages/not-found';
import { authApi, academicApi, settingsApi, uploadFile, resolveUploadUrl, ApiRequestError, publicApi, pastPapersApi, notebookApi, savedSessionsApi, flaggedMcqsApi, feedbackApi, type MyFeedbackEntry, analyticsApi, type ProgressTrend, mcqImportApi, studentsAdminApi, paymentsAdminApi, membershipPlansAdminApi, mcqAdminApi, notificationsApi, siteContentApi, teamApi, moduleAdminApi, blocksApi, type Block, examsAdminApi, examsApi, explanationsApi, booksApi, type AdminBookStudent, DEFAULT_IMPORT_PATTERNS, STUDENT_STATUSES, type Institution, type Program, type AcademicYear, type Batch, type PastPaper, type NotebookEntry, type SavedSession, type FlaggedMcq, type FeedbackEntry, type McqCandidate, type StudentDetail, type SiteContent, type TeamMember, TEAM_CATEGORIES, TEAM_CATEGORY_LABELS, type AdminModule, type AdminExam, type StudentExam, type ExamAttemptRow, type ExamStartResponse, type ExamResult, type Exam, type ExplanationStatus, type PaymentDetails, type PaymentMethodConfig, aiVisualizerApi, type VisualizationSpec, LeaderboardRow } from '@/lib/api';

import { OPEN_SEARCH_EVENT } from './home';
import { NAV_FEATURE, trialEndsLabel, trialFeatureSummary, trialScopeLabel } from './trial';
import { AnimatedBrandMark, BrandedLoadingScreen, cn, initials } from './ui';


// The wordmark used to only shimmer on :hover (group-hover:[background-
// position:0%]) — which never fires on a touch device, so on phones/
// tablets it just sat frozen on whichever frame backgroundPosition:100%
// happened to land on (mostly plain foreground colour, no visible teal).
// It now animates continuously via the same kind of CSS keyframe the
// AnimatedBrandMark icon next to it already uses, so the colour sweep is
// always visible — hover still speeds it up as a nice-to-have, it's no
// longer required to see it move at all. Explicit teal (#2dd9c4, matching
// AnimatedBrandMark/BootScreen) is blended into the gradient so the text
// keeps a visible brand colour instead of relying solely on CSS vars that
// can render as a flat neutral at rest.
export function Logo({ dark = false, href = '/' }: { dark?: boolean; href?: string }) {
  return <Link href={href} className="group flex items-center gap-2" data-testid="link-logo">
    <style>{`@keyframes brand-text-shimmer { 0% { background-position: 200% 0; } 50% { background-position: 0% 0; } 100% { background-position: -200% 0; } }`}</style>
    <AnimatedBrandMark size={22} className={dark ? 'text-sidebar-primary' : 'text-primary'} />
    <span
      className={cn(
        'bg-clip-text text-[15px] font-extrabold tracking-[-.03em] text-transparent transition-[animation-duration] duration-300 ease-out group-hover:![animation-duration:1.1s]',
        dark
          ? 'bg-[linear-gradient(100deg,hsl(var(--sidebar-foreground))_20%,#2dd9c4_50%,hsl(var(--sidebar-foreground))_80%)]'
          : 'bg-[linear-gradient(100deg,hsl(var(--primary))_20%,#2dd9c4_50%,hsl(var(--primary))_80%)]',
      )}
      style={{ backgroundSize: '250% 100%', animation: 'brand-text-shimmer 3.4s ease-in-out infinite' }}
    >MedschoolProffs</span>
  </Link>;
}

type NavItem = [string, string, typeof LayoutDashboard];

export const navGroups: Array<{ label: string; items: NavItem[] }> = [
  { label: 'Study desk', items: [
    ['/dashboard', 'Overview', LayoutDashboard], ['/blocks', 'Blocks', BookOpen], ['/flashcards', 'Flashcards', Zap], ['/past-papers', 'Past papers', FileStack], ['/exams', 'Pre-Proffs Exams', ClipboardCheck], ['/ospe-osce', 'OSPE/OSCE', Stethoscope], ['/books', 'Books', Library], ['/progress', 'My progress', TrendingUp], ['/study', 'Study plan', CalendarCheck], ['/ai-visualizer', 'AI Visualizer', Wand2],
  ] },
  { label: 'Your tools', items: [
    ['/notebook', 'My notebook', NotebookPen], ['/saved-sessions', 'Saved sessions', Bookmark], ['/flagged-mcqs', 'Flagged MCQs', Flag], ['/leaderboard', 'Leaderboard', Trophy], ['/challenge', 'Challenge a friend', Swords],
  ] },
  { label: 'Your account', items: [
    ['/payments', 'Membership', CreditCard], ['/notifications', 'Notifications', Bell], ['/feedback', 'Send feedback', MessageSquare], ['/profile', 'Profile & access', ShieldCheck],
  ] },
];

export function SideNav({ user, onClose }: { user: User; onClose: () => void }) {
  const [location] = useLocation();
  // AI_VISUALIZER_ENABLED off removes the nav link entirely — see the
  // matching enforcement on the route itself (AiVisualizer component below)
  // and on the backend (POST /ai/visualizer refuses directly too).
  const siteContentQ = useQuery({ queryKey: ['site-content'], queryFn: siteContentApi.get });
  const aiVisualizerEnabled = siteContentQ.data?.AI_VISUALIZER_ENABLED !== 'false';
  const groups = aiVisualizerEnabled ? navGroups : navGroups.map((g) => ({ ...g, items: g.items.filter(([href]) => href !== '/ai-visualizer') }));
  // While a feature-limited trial is live, a student without a paid
  // membership sees which sections the trial doesn't include (lock icon,
  // linking to Membership) instead of tapping in and hitting a 403. Purely
  // presentational — the API enforces the same rule (requireMembershipFor).
  const dashboardQ = useGetStudentDashboard();
  const trial = siteContentQ.data?.trial;
  const paidMember = dashboardQ.data?.membershipStatus === 'ACTIVE';
  const isLockedByTrial = (href: string) => {
    const feature = NAV_FEATURE[href];
    return !!(trial?.active && feature && user.role !== 'admin' && !paidMember && dashboardQ.data && !trial.features.includes(feature));
  };
  const notifQ = useListNotifications();
  const unreadCount = (notifQ.data ?? []).filter((n) => !n.read).length;
  // Browser: unchanged — the backend clears the HttpOnly cookie.
  // Native app: call the backend while the bearer token still exists, then
  // always drop the local token (even if the network call failed, so the
  // user is never stuck "signed in" with a token the server may have revoked).
  const finishLogout = () => { clearSessionMark(); queryClient.clear(); window.location.href = '/login'; };
  const logout = useMutation({
    mutationFn: async () => {
      if (!isNativeApp()) return authApi.logout();
      try { await authApi.logout(); } finally { await clearNativeAuthToken(); }
    },
    onSuccess: finishLogout,
    onError: () => { if (isNativeApp()) finishLogout(); },
  });
  const navView: SidebarGroup[] = groups.map((group) => ({
    label: group.label,
    items: group.items.map(([href, label, Icon]) => ({
      href, label, icon: Icon,
      hue: NAV_HUE[href] ?? NAV_HUE_FALLBACK,
      locked: isLockedByTrial(href),
      active: location === href || (href !== '/dashboard' && location.startsWith(`${href}/`)),
      slug: label.toLowerCase().replaceAll(' ', '-'),
      badge: label === 'Notifications' ? unreadCount : 0,
    })),
  }));
  // v43: presentation lives in components/nav/SidebarNav.tsx (sliding puck,
  // pointer spotlight, tilting profile card). Data / trial-lock rules stay here.
  return <aside className="student-sidebar fixed inset-y-0 left-0 z-40 flex w-[256px] flex-col overflow-y-auto bg-sidebar px-3.5 py-5 text-sidebar-foreground shadow-xl md:sticky md:top-0 md:h-[100dvh] md:shadow-none">
    <div className="sb-ambient" aria-hidden="true"><i className="sb-orb sb-orb--a" /><i className="sb-orb sb-orb--b" /></div>
    <div className="relative z-[1] mb-6 flex items-center justify-between px-2"><Logo dark href="/dashboard" /><button className="rounded-lg p-2 text-sidebar-foreground/60 hover:bg-sidebar-accent md:hidden" onClick={onClose} aria-label="Close menu" data-testid="button-close-menu"><X size={18} /></button></div>
    <SidebarNav groups={navView} onNavigate={onClose} />
    <div className="relative z-[1] mt-auto pt-6">
      <SidebarProfile initials={initials(user.name)} name={user.name} subtitle={user.institution || 'Medical student'} onSignOut={() => logout.mutate()} signingOut={logout.isPending} />
    </div>
  </aside>;
}

// Trial-lock check shared by the phone tab bar (SideNav keeps its own copy of
// the same rule): while a feature-limited trial is live, a student without a
// paid membership sees locked sections marked and sent to Membership.
export function useNavLocks(user: Pick<User, 'role'> | null | undefined) {
  const siteContentQ = useQuery({ queryKey: ['site-content'], queryFn: siteContentApi.get });
  const dashboardQ = useGetStudentDashboard();
  const trial = siteContentQ.data?.trial;
  const paidMember = dashboardQ.data?.membershipStatus === 'ACTIVE';
  return (href: string) => {
    const feature = NAV_FEATURE[href];
    return !!(trial?.active && feature && user && user.role !== 'admin' && !paidMember && dashboardQ.data && !trial.features.includes(feature));
  };
}

// Phone-only bottom tab bar: the four most-used study areas + "More" (opens
// the full sidebar menu). Hidden on md+ (sidebar is always visible there) and
// in focus mode (practice / exams / reader) — Shell decides that.
const TAB_ITEMS: Array<{ href: string; label: string; icon: typeof LayoutDashboard; also?: string[] }> = [
  { href: '/dashboard', label: 'Home', icon: LayoutDashboard },
  { href: '/blocks', label: 'Blocks', icon: BookOpen, also: ['/modules', '/subjects', '/practice'] },
  { href: '/exams', label: 'Exams', icon: ClipboardCheck },
  { href: '/flashcards', label: 'Cards', icon: Zap },
];

export function MobileTabBar({ user, onMore }: { user: User; onMore: () => void }) {
  const [location] = useLocation();
  const isLocked = useNavLocks(user);
  const match = (href: string) => location === href || location.startsWith(`${href}/`);
  return <nav aria-label="Quick navigation" className="tabbar-safe fixed inset-x-0 bottom-0 z-20 w-full max-w-full px-3 md:hidden" data-testid="tabbar-mobile">
    <div className="tabbar-dock mx-auto flex w-full max-w-md items-stretch gap-1 rounded-2xl border border-border bg-card/95 p-1.5 backdrop-blur-md">
      {TAB_ITEMS.map(({ href, label, icon: Icon, also }) => {
        const active = match(href) || !!also?.some(match);
        const locked = isLocked(href);
        return <Link key={href} href={locked ? '/payments' : href} aria-current={active ? 'page' : undefined} className={cn('relative flex min-w-0 flex-1 flex-col items-center gap-0.5 rounded-xl py-2 text-[10px] font-bold transition-colors', active ? 'tab-key text-primary' : 'text-muted-foreground hover:bg-muted/70')} data-testid={`tab-${label.toLowerCase()}`}>
          <Icon size={19} strokeWidth={active ? 2.4 : 2} />{label}
          {locked && <LockKeyhole size={9} className="absolute right-3 top-1.5" />}
        </Link>;
      })}
      <button type="button" onClick={onMore} className="relative flex min-w-0 flex-1 flex-col items-center gap-0.5 rounded-xl py-2 text-[10px] font-bold text-muted-foreground hover:bg-muted/70" aria-label="More — open full menu" data-testid="tab-more"><Menu size={19} />More</button>
    </div>
  </nav>;
}

// Hues for the glossy page tiles in the search palette (one per nav destination).
const NAV_HUE: Record<string, number> = {
  '/dashboard': 214, '/progress': 228, '/blocks': 205, '/exams': 4, '/past-papers': 22, '/flashcards': 268, '/ai-visualizer': 290, '/books': 38,
  '/notebook': 172, '/saved-sessions': 190, '/flagged-mcqs': 350, '/leaderboard': 45, '/challenge': 12,
  '/payments': 152, '/notifications': 200, '/feedback': 160, '/profile': 240,
};
const NAV_HUE_FALLBACK = 214;

/** Header search. Thin wrapper: works out which pages this student can see/open, the palette does the rest. */
export function QuickJump({ open, value, onChange, onClose }: { open: boolean; value: string; onChange: (value: string) => void; onClose: () => void }) {
  const siteContentQ = useQuery({ queryKey: ['site-content'], queryFn: siteContentApi.get });
  const userQ = useGetCurrentUser();
  const isLocked = useNavLocks(userQ.data as Pick<User, 'role'> | undefined);
  const aiVisualizerEnabled = siteContentQ.data?.AI_VISUALIZER_ENABLED !== 'false';
  const pages: PalettePage[] = navGroups.flatMap((group) => group.items)
    .filter(([href]) => aiVisualizerEnabled || href !== '/ai-visualizer')
    .map(([href, label, Icon]) => ({ href, label, icon: Icon, hue: NAV_HUE[href] ?? NAV_HUE_FALLBACK, locked: isLocked(href) }));
  return <CommandPalette open={open} value={value} onChange={onChange} onClose={onClose} pages={pages} />;
}

// "Focus mode" — hides the sidebar/collapses it to a slim exit bar during an
// active MCQ practice session or exam attempt, both full-screen /
// distraction-free by intent. Lifted above Shell (rather than local Shell
// state) so Practice()/TakeExam() can set it from inside their own route.
// `strictFocusMode` is a stricter variant used only by the Pre-Proffs exam
// screen: when on, Shell doesn't render the "Exit" button at all (there is
// no click-to-leave affordance in the UI), on top of the normal focus-mode
// sidebar hiding. TakeExam pairs this with its own beforeunload/popstate
// guards below so a student genuinely can't back out of an in-progress
// exam via the header button, a refresh, or the browser's back button —
// only submitting (or running out of time, which auto-submits) leaves.

export const FocusModeContext = createContext<{ focusMode: boolean; setFocusMode: (v: boolean) => void; strictFocusMode: boolean; setStrictFocusMode: (v: boolean) => void }>({ focusMode: false, setFocusMode: () => {}, strictFocusMode: false, setStrictFocusMode: () => {} });
// Lets a page (e.g. TakeExam) override the header's auto-generated,
// URL-derived title — needed because that auto title is just the route
// path with slashes ("Exams / Take / 2"), which surfaces raw numeric
// attempt IDs to students on exam-taking/result pages. A page sets a
// friendly title (the exam/paper name) once it knows it; null falls back
// to the normal path-derived title everywhere else.

export const PageTitleContext = createContext<{ pageTitle: string | null; setPageTitle: (v: string | null) => void }>({ pageTitle: null, setPageTitle: () => {} });

export function usePageTitle(title: string | null | undefined) {
  const { setPageTitle } = useContext(PageTitleContext);
  useEffect(() => {
    setPageTitle(title ?? null);
    return () => setPageTitle(null);
  }, [title, setPageTitle]);
}

// SEO: the app is a client-rendered SPA, so index.html ships one shared
// <title>/description/canonical for every route — without this hook every
// marketing page (About, Pricing, Contact, FAQ, Home) would show identical
// <head> content to search engines and to link previews. Public marketing
// pages call this once on mount to patch those three tags to their own
// values, and it restores index.html's site-wide defaults on unmount so an
// in-app route never inherits a marketing page's title after navigating
// away. Internal app routes (behind login) don't need this — they aren't
// meant to be indexed.
export function useDocumentHead({ title, description, path }: { title?: string; description?: string; path?: string }) {
  useEffect(() => {
    const prevTitle = document.title;
    if (title) document.title = title;

    const descTag = document.querySelector('meta[name="description"]');
    const prevDescription = descTag?.getAttribute('content') ?? null;
    if (description && descTag) descTag.setAttribute('content', description);

    let canonicalTag = document.querySelector('link[rel="canonical"]');
    const prevCanonical = canonicalTag?.getAttribute('href') ?? null;
    const hadCanonical = !!canonicalTag;
    if (path) {
      if (!canonicalTag) {
        canonicalTag = document.createElement('link');
        canonicalTag.setAttribute('rel', 'canonical');
        document.head.appendChild(canonicalTag);
      }
      canonicalTag.setAttribute('href', `https://medschoolproffs.live${path}`);
    }

    return () => {
      document.title = prevTitle;
      if (descTag && prevDescription != null) descTag.setAttribute('content', prevDescription);
      if (canonicalTag) {
        if (prevCanonical != null) canonicalTag.setAttribute('href', prevCanonical);
        else if (!hadCanonical) canonicalTag.remove();
      }
    };
  }, [title, description, path]);
}

export function useFocusMode(active: boolean, strict = false) {
  const { setFocusMode, setStrictFocusMode } = useContext(FocusModeContext);
  useEffect(() => {
    setFocusMode(active);
    setStrictFocusMode(active && strict);
    return () => { setFocusMode(false); setStrictFocusMode(false); };
  }, [active, strict, setFocusMode, setStrictFocusMode]);
}

// Traps the student on the current screen while `active` — used by the
// Pre-Proffs exam so a student can't back out mid-attempt. Blocks the
// browser back/forward button (by immediately re-pushing the current URL
// whenever a `popstate` fires) and warns on refresh/tab-close via the
// standard `beforeunload` confirmation. Neither of these stops a
// programmatic navigation from inside the app (e.g. `setLocation` on
// submit), only user-driven ways of leaving the page.

export function useExamLock(active: boolean) {
  useEffect(() => {
    if (!active) return;
    window.history.pushState(null, '', window.location.href);
    const blockBack = () => window.history.pushState(null, '', window.location.href);
    const warnUnload = (e: BeforeUnloadEvent) => { e.preventDefault(); e.returnValue = ''; };
    window.addEventListener('popstate', blockBack);
    window.addEventListener('beforeunload', warnUnload);
    return () => { window.removeEventListener('popstate', blockBack); window.removeEventListener('beforeunload', warnUnload); };
  }, [active]);
}

// Every route below is wrapped in <Shell>, so this is the one place that has
// to enforce "must be signed in" and "must be admin for /admin/*" before
// rendering real content — a signed-out or under-privileged user should never
// see so much as a flash of the dashboard/admin UI underneath.

// ANNOUNCEMENT_BANNER is stored as a JSON array of strings so admins can
// queue up more than one (see AdminSettings.tsx). Falls back to treating
// the raw value as a single announcement when it isn't valid JSON, so a
// site with the old plain-text value already saved keeps showing it.
function parseAnnouncements(raw: string | null | undefined): string[] {
  if (!raw) return [];
  try {
    const parsed = JSON.parse(raw);
    if (Array.isArray(parsed)) return parsed.map((x) => String(x).trim()).filter(Boolean);
  } catch { /* not JSON — fall through to legacy plain-text handling below */ }
  return raw.trim() ? [raw.trim()] : [];
}

// One-line trial notice. On a phone a 3-line wrapped banner pushed the whole page
// down; now the text scrolls in a single line (two copies back to back, same
// technique as the announcement marquee) and md+ shows it static and centred.
// Motion is off for prefers-reduced-motion, where the text simply wraps.
function TrialBar({ text }: { text: string }) {
  const duration = Math.max(14, text.length * 0.16);
  return <div className="trial-bar" data-testid="banner-global-trial-mode" role="status">
    <Sparkles size={14} className="trial-bar__icon" aria-hidden="true" />
    <div className="trial-bar__viewport">
      <div className="trial-bar__track" style={{ animationDuration: `${duration}s` }}>
        <span>{text}</span>
        <span aria-hidden="true">{text}</span>
      </div>
    </div>
  </div>;
}

export function Shell({ children }: { children: ReactNode }) {
  const [menuOpen, setMenuOpen] = useState(false);
  const [quickJumpOpen, setQuickJumpOpen] = useState(false);
  const [quickJumpValue, setQuickJumpValue] = useState('');
  // Dismiss state for the announcement banner below — cleared on full page
  // reload (e.g. next login) rather than persisted, so a still-current
  // announcement resurfaces for a returning session instead of staying
  // hidden forever from one click weeks ago. Keyed to the announcement's
  // own text (see dismissedAnnouncement below) so publishing a *new*
  // announcement always shows, even if the student dismissed an older one
  // earlier in this same session.
  const [dismissedAnnouncement, setDismissedAnnouncement] = useState<string | null>(null);
  // retry: false — a failed/unusable current-user response should send the
  // user to /login promptly, not spend several silent retries first.
  const userQuery = useGetCurrentUser({ query: { retry: false, queryKey: getGetCurrentUserQueryKey() } });
  const [location, setLocation] = useLocation();
  const isMobile = useIsMobile();
  const user = userQuery.data;
  const { focusMode, strictFocusMode } = useContext(FocusModeContext);
  // Bug fix (React error #310, "Rendered more hooks than during the
  // previous render"): this used to sit after the `if (userQuery.isLoading)
  // return ...` / `if (!user) return ...` branches below. On the very
  // first render (userQuery still loading) that early return skipped this
  // hook entirely; once the query resolved and re-rendered with a user,
  // the branch was skipped and the hook fired — a different hook count
  // between renders, which is exactly what triggers #310. Since Shell
  // wraps every routed page, this crashed on the first load of *any*
  // page (dashboard, flashcards, profile, etc.), not just one route. All
  // hooks now run unconditionally before any early return.
  const { pageTitle } = useContext(PageTitleContext);
  // Same #310 fix — this was declared below the early returns too (right
  // before its "General trial mode" comment, which now sits just above
  // where it's actually used further down).
  const siteContentQ = useQuery({ queryKey: ['site-content'], queryFn: siteContentApi.get });
  // Same query SideNav already runs (shared key, no extra request) — drives the
  // unread dot on the header bell. Must stay up here with the other hooks.
  const headerNotifQ = useListNotifications();
  const headerUnread = (headerNotifQ.data ?? []).filter((n) => !n.read).length;

  useEffect(() => {
    // The topbar search button has always shown a "⌘K" hint — this is the
    // listener that actually makes it work, plus the Dashboard's "Search"
    // quick-link tile (which lives outside this component tree, so it
    // reaches this via a custom event rather than a prop).
    function handleKeydown(e: KeyboardEvent) {
      if ((e.metaKey || e.ctrlKey) && e.key.toLowerCase() === 'k') { e.preventDefault(); setQuickJumpValue(''); setQuickJumpOpen(true); }
    }
    function handleOpenSearchEvent() { setQuickJumpValue(''); setQuickJumpOpen(true); }
    window.addEventListener('keydown', handleKeydown);
    window.addEventListener(OPEN_SEARCH_EVENT, handleOpenSearchEvent);
    return () => { window.removeEventListener('keydown', handleKeydown); window.removeEventListener(OPEN_SEARCH_EVENT, handleOpenSearchEvent); };
  }, []);

  useEffect(() => {
    if (userQuery.isLoading) return;
    if (!user) {
      // A hard navigation (not wouter's client-side setLocation) so any
      // stale/broken React Query cache from the failed session is fully
      // discarded rather than carried into the next render — a soft route
      // change alone was letting a bad cached response resurface the same
      // crash after refresh instead of landing cleanly on the login page.
      queryClient.clear();
      window.location.href = '/login';
      return;
    }
  }, [user, userQuery.isLoading, setLocation]);

  if (userQuery.isLoading) return <BrandedLoadingScreen />;
  // Same fix as the admin app's Shell (see its matching comment): this
  // branch is the brief gap between the query resolving "no user" and the
  // effect above redirecting to /login — not real content-loading, so it
  // gets the branded loader instead of a near-blank skeleton-on-white page.
  if (!user) return <BrandedLoadingScreen />;
  // Admin accounts are allowed to browse the student portal too (e.g. to see
  // what students see) — the reverse is not true, see the equivalent check
  // in frontend-admin/src/App.tsx's Shell, which still blocks students.

  // General trial mode — same site-content query SideNav already runs
  // (shared queryKey, so this doesn't add an extra request), read here
  // too for a top banner reminding the student (and admin, if browsing
  // as one) that every membership-gated page is unlocked for everyone
  // right now. Hidden in focus mode so it doesn't crowd the
  // distraction-free exam/practice header.
  const trial = siteContentQ.data?.trial;
  const globalTrialMode = !!trial?.active;
  const globalTrialScope = trialScopeLabel(trial?.program, trial?.years);
  // Bug fix: admin's "Announcement banner" setting had a live text field
  // and a "blank to hide" contract, but nothing on the student side ever
  // read ANNOUNCEMENT_BANNER or rendered it — so it silently did nothing
  // no matter what an admin typed in. Wired up the same way
  // globalTrialMode's banner already works: read from the same
  // site-content query (no extra request), hidden in focus mode, and
  // dismissible per-session.
  //
  // ANNOUNCEMENT_BANNER is a JSON array of strings (admin's Settings page
  // can queue up more than one), with a fallback for a site that still has
  // the old plain-text value saved so it keeps showing instead of
  // vanishing. Multiple announcements are joined into one continuous
  // scrolling line, separated by a dot.
  const announcements = parseAnnouncements(siteContentQ.data?.ANNOUNCEMENT_BANNER);
  const announcementText = announcements.length ? announcements.join('   •   ') : null;
  const showAnnouncement = Boolean(announcementText) && announcementText !== dismissedAnnouncement;
  // The banner text used to be truncated with an ellipsis, which on a
  // narrow phone screen often cut off most of a longer announcement
  // entirely. It now scrolls continuously instead (two copies of the text
  // back to back, animated left by exactly one copy's width so the loop is
  // seamless) — duration scales with length so a short announcement
  // doesn't fly past and a long one doesn't crawl.
  const marqueeDuration = announcementText ? Math.max(14, announcementText.length * 0.14) : 14;
  // The dashboard's own hero already greets the student by name; repeating the
  // greeting here got cut off to "Good Morning, U…" beside the search/bell/avatar
  // buttons on a phone. The header now just names the page.
  const title = pageTitle ?? (location === '/dashboard' ? 'Dashboard' : location.slice(1).split('/').map((part) => part.replaceAll('-', ' ')).join(' / '));
  // Full date on md+, compact on phones ("Mon, Sep 21") so it never wraps.
  const todayLong = new Date().toLocaleDateString('en-US', { weekday: 'long', day: 'numeric', month: 'long', year: 'numeric' });
  const todayShort = new Date().toLocaleDateString('en-US', { weekday: 'short', day: 'numeric', month: 'short' });

  // IMPORTANT: focus mode and the normal layout used to be two separate
  // `if (focusMode) return <...>` branches with entirely different JSX
  // shapes. Since {children} sat at a different depth/position in each
  // branch, React couldn't match the old subtree to the new one when
  // focusMode flipped — it unmounted and remounted {children} from
  // scratch, wiping its state. That's exactly what broke Practice(): the
  // Timed/Untimed buttons call setMode(...), which flips focusMode from
  // false to true via useFocusMode's effect, which swapped Shell's branch
  // and remounted Practice — resetting `mode` straight back to null, so
  // the student appeared to be bounced back to the "How do you want to
  // practice?" screen no matter which option they picked. Same risk
  // existed on mobile: opening/closing the menu changed whether SideNav
  // was mounted at all, shifting {children}'s sibling index and remounting
  // it too. Fixed by keeping one single tree shape at all times — SideNav
  // and the overlay are always mounted (hidden via CSS instead of
  // conditionally rendered), and {children} always sits inside the same
  // `<main><header/><div>{children}</div></main>` position; only the
  // header's *content* differs between focus and normal mode.
  return <div className="student-shell flex min-h-[100dvh] bg-background">
    <div className={cn(!focusMode && menuOpen ? 'block' : 'hidden', 'sb-scrim fixed inset-0 z-30 bg-[#071e2b]/45 md:hidden')} onClick={() => setMenuOpen(false)} />
    <div className={cn(focusMode ? 'hidden' : (menuOpen || !isMobile) ? 'block' : 'hidden')}><SideNav user={user} onClose={() => setMenuOpen(false)} /></div>
    <main className="min-w-0 max-w-full flex-1">
      {!focusMode && (showAnnouncement || globalTrialMode) && <div className="relative z-20">
        {showAnnouncement && <div className="flex items-center gap-2 overflow-hidden bg-primary px-4 py-1.5 text-[11px] font-bold text-primary-foreground" data-testid="banner-announcement">
          <Megaphone size={12} className="shrink-0" />
          <div className="min-w-0 flex-1 overflow-hidden">
            {/* Two identical copies back to back, each pushed apart by the
                same right margin, animated left by exactly one copy's width
                (marquee's `to` keyframe is translateX(-50%) of this whole
                track, i.e. one copy) — the loop point is invisible since
                copy two is already sitting where copy one started. */}
            <div className="marquee-track flex w-max whitespace-nowrap" style={{ animation: `marquee ${marqueeDuration}s linear infinite` }}>
              <span className="mr-16">{announcementText}</span>
              <span className="mr-16" aria-hidden="true">{announcementText}</span>
            </div>
          </div>
          <button onClick={() => setDismissedAnnouncement(announcementText)} className="ml-1 shrink-0 rounded p-0.5 hover:bg-white/15" aria-label="Dismiss announcement" data-testid="button-dismiss-announcement"><X size={12} /></button>
        </div>}
        {globalTrialMode && trial && <TrialBar text={`Free trial${globalTrialScope ? ` for ${globalTrialScope} students` : ''}: ${trialFeatureSummary(trial.features)} unlocked${trialEndsLabel(trial.endsAt)}.`} />}
      </div>}
      {focusMode
        ? <header className="sticky top-0 z-20 flex h-14 items-center gap-3 border-b border-border/70 bg-background/90 px-4 backdrop-blur-md md:px-8">{strictFocusMode ? <span className="inline-flex items-center gap-1.5 rounded-lg px-2 py-1.5 text-xs font-bold text-muted-foreground" data-testid="text-exam-locked"><LockKeyhole size={13} /> Exam in progress</span> : <button onClick={() => setLocation('/dashboard')} className="inline-flex items-center gap-1.5 rounded-lg px-2 py-1.5 text-xs font-bold text-muted-foreground hover:bg-muted" data-testid="button-exit-focus-mode"><ArrowLeft size={15} /> Exit</button>}<span className="min-w-0 flex-1 truncate whitespace-nowrap text-xs font-bold capitalize text-foreground" title={title}>{title}</span></header>
        : <header className="student-header sticky top-0 z-20 flex h-[68px] items-center justify-between border-b border-border/70 bg-background/90 px-4 backdrop-blur-md md:px-8"><div className="flex min-w-0 items-center gap-3"><button className="rounded-lg p-2 hover:bg-muted md:hidden" onClick={() => setMenuOpen(true)} aria-label="Open menu" data-testid="button-open-menu"><Menu size={20} /></button><div className="min-w-0"><div className="font-mono-app whitespace-nowrap text-[9px] uppercase tracking-[.16em] text-muted-foreground"><span className="hidden md:inline">{todayLong}</span><span className="md:hidden">{todayShort}</span></div><h1 className="mt-1 block max-w-full overflow-hidden text-ellipsis whitespace-nowrap text-[17px] font-extrabold capitalize leading-tight tracking-[-.02em] text-foreground" title={title}>{title}</h1></div></div><div className="relative flex items-center gap-2"><button onClick={() => { setQuickJumpOpen((current) => !current); setQuickJumpValue(''); }} className="hidden h-9 w-[220px] items-center gap-2 rounded-xl border border-border bg-card px-3 text-left text-[11px] text-muted-foreground shadow-sm hover:border-primary/50 sm:flex md:w-[340px]" data-testid="button-open-quick-jump"><Search size={14} /><span className="truncate">Search modules, topics, exams…</span><span className="ml-auto rounded border border-border px-1 text-[9px]">⌘K</span></button><button onClick={() => { setQuickJumpOpen((current) => !current); setQuickJumpValue(''); }} className="grid size-9 place-items-center rounded-xl border border-border bg-card text-muted-foreground hover:bg-muted sm:hidden" aria-label="Search" data-testid="button-open-quick-jump-mobile"><Search size={16} /></button><Link href="/notifications" className="relative grid size-9 place-items-center rounded-xl border border-border bg-card text-muted-foreground transition-colors hover:bg-muted hover:text-foreground" aria-label="Notifications" data-testid="link-notifications"><Bell size={16} />{headerUnread > 0 && <span className="absolute -right-1 -top-1 grid min-w-4 place-items-center rounded-full bg-[#e5a952] px-1 text-[9px] font-bold leading-4 text-[#183844] ring-2 ring-background" data-testid="badge-header-unread">{headerUnread > 9 ? '9+' : headerUnread}</span>}</Link><Link href="/profile" className="ml-1 grid size-9 place-items-center rounded-full bg-[#cdebf0] text-[11px] font-extrabold text-[#0d5267] ring-2 ring-transparent transition-shadow hover:ring-primary/30" aria-label="Profile" data-testid="link-header-profile">{initials(user.name)}</Link><QuickJump open={quickJumpOpen} value={quickJumpValue} onChange={setQuickJumpValue} onClose={() => setQuickJumpOpen(false)} /></div></header>}
      <div className={cn('page-enter student-content', focusMode ? 'px-5 py-6 md:px-10 md:py-8' : 'mx-auto w-full max-w-[1320px] px-4 py-6 pb-28 md:px-8 md:py-9')}>{children}</div>
      {!focusMode && <MobileTabBar user={user} onMore={() => setMenuOpen(true)} />}
      {user.role !== 'admin' && <AchievementToaster userId={user.id} suspended={focusMode || strictFocusMode} />}
    </main>
  </div>;
}

export function useFaviconSync() {
  const { data } = useQuery({ queryKey: ['site-content'], queryFn: siteContentApi.get, staleTime: 5 * 60 * 1000 });
  useEffect(() => {
    if (!data?.faviconUrl) return;
    let link = document.querySelector<HTMLLinkElement>('link[rel="icon"]');
    if (!link) { link = document.createElement('link'); link.rel = 'icon'; document.head.appendChild(link); }
    link.href = resolveUploadUrl(data.faviconUrl) ?? data.faviconUrl;
  }, [data?.faviconUrl]);
}

// Wires the admin's SEO Title/Description (Site Content → SEO, in the
// admin app) and Platform Name into the live document once site content
// loads: <title>, meta description, og:*/twitter:* tags, and the "name"
// field on the Organization/WebSite JSON-LD blocks index.html ships as
// static defaults. Called once from Home (the public landing page) — the
// same page Google actually indexes and where the sitename/breadcrumb
// behavior lives, so that's what this patches.
// One real limitation, same tradeoff useFaviconSync above already makes:
// this only updates the DOM after the JS bundle runs. Google's own
// crawler executes JS, so it sees the admin's values — but a scraper that
// doesn't run JS (some link-preview bots) still reads index.html's
// hardcoded defaults as shipped at build time. If those need to match
// too, index.html itself has to be edited directly.
export function useSeoSync() {
  const { data } = useQuery({ queryKey: ['site-content'], queryFn: siteContentApi.get, staleTime: 5 * 60 * 1000 });
  useEffect(() => {
    if (!data) return;
    const setMeta = (selector: string, content: string) => document.querySelector(selector)?.setAttribute('content', content);
    if (data.SEO_TITLE) {
      document.title = data.SEO_TITLE;
      setMeta('meta[property="og:title"]', data.SEO_TITLE);
      setMeta('meta[name="twitter:title"]', data.SEO_TITLE);
    }
    if (data.SEO_DESCRIPTION) {
      setMeta('meta[name="description"]', data.SEO_DESCRIPTION);
      setMeta('meta[property="og:description"]', data.SEO_DESCRIPTION);
      setMeta('meta[name="twitter:description"]', data.SEO_DESCRIPTION);
    }
    if (data.PLATFORM_NAME) {
      setMeta('meta[property="og:site_name"]', data.PLATFORM_NAME);
      document.querySelectorAll('script[type="application/ld+json"]').forEach((el) => {
        try {
          const json = JSON.parse(el.textContent || '');
          if (json['@type'] === 'Organization' || json['@type'] === 'WebSite') { json.name = data.PLATFORM_NAME; el.textContent = JSON.stringify(json); }
        } catch { /* not one of ours, or malformed — leave it alone */ }
      });
    }
  }, [data]);
}

// Applies the admin's saved Design & Branding colors (see lib/theme.ts) as
// CSS variables on <html>. Shares the same ['site-content'] query as
// useFaviconSync (react-query dedupes by key, so this doesn't add a second
// request) and, crucially, runs from AppRoutes rather than inside Shell —
// so /login, /register, and every other signed-out page are themed too.

export function useThemeSync() {
  const { data } = useQuery({ queryKey: ['site-content'], queryFn: siteContentApi.get, staleTime: 5 * 60 * 1000 });
  useEffect(() => { applyThemeVars(data ?? null); }, [data]);
}

