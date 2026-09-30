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
import { SidebarNav, SidebarProfile, type SidebarGroup } from '@/components/nav/SidebarNav';
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

import { Progress } from './ui';



export const QUICK_LINK_TILES: Array<{ href: string; label: string; sub: string; icon: typeof LayoutGrid; bg: string; fg: string; /** HSL hue for the glossy 3D icon tile on the dashboard. */ hue: number }> = [
  { href: '/blocks', label: 'Modules', sub: 'Explore all modules', icon: LayoutGrid, bg: 'bg-[#dceaf1]', fg: 'text-[#2c6a8f]', hue: 205 },
  { href: '/practice', label: 'Practice MCQs', sub: 'Test your knowledge', icon: Target, bg: 'bg-[#d7eee4]', fg: 'text-[#1f7a5c]', hue: 158 },
  { href: '/flashcards', label: 'Flashcards', sub: 'Revise smarter', icon: Sparkles, bg: 'bg-[#e6dcf5]', fg: 'text-[#6b3fa0]', hue: 268 },
  { href: '/past-papers', label: 'Past Papers', sub: 'Previous exam papers', icon: FileStack, bg: 'bg-[#fbdada]', fg: 'text-[#b8493f]', hue: 4 },
  { href: '/flagged-mcqs', label: 'Bookmarks', sub: 'Saved content', icon: Bookmark, bg: 'bg-[#fff0cb]', fg: 'text-[#94651c]', hue: 38 },
  { href: '/progress', label: 'My Progress', sub: 'Track your growth', icon: TrendingUp, bg: 'bg-[#dde4f7]', fg: 'text-[#3b4f8f]', hue: 228 },
  // Special-cased in the render below (href === OPEN_SEARCH_HREF) to open
  // the QuickJump overlay via a custom event instead of navigating — the
  // Shell that owns QuickJump's open/close state lives outside Dashboard's
  // component tree, so a plain <Link> can't reach it directly.
  { href: '#open-search', label: 'Search', sub: 'Find anything', icon: Search, bg: 'bg-[#dbeafe]', fg: 'text-[#1d4ed8]', hue: 214 },
];

export const OPEN_SEARCH_HREF = '#open-search';

export const OPEN_SEARCH_EVENT = 'medschoolproffs:open-search';
// The "My Progress" tile points at an in-page section (#progress-profile),
// not a route — wouter's <Link> does client-side route navigation, so
// handing it a "#..." href just pushes that literal string as a path (no
// route matches it) instead of scrolling anywhere. That's the bug: the tile
// looked like a normal link but silently did nothing. Special-cased below
// the same way OPEN_SEARCH_HREF already is, so it smooth-scrolls to the
// section (with a brief highlight so it's obvious something happened)
// instead of attempting a "navigation".

// Kept for the dashboard's inline Progress profile card anchor; the "My Progress"
// quick link itself now goes to the full /progress page.
export const PROGRESS_ANCHOR_HREF = '#progress-profile';

// Cycling palette for module tiles (Continue Learning / Recommended) so the
// dashboard reads as multi-subject and colorful rather than one repeated
// tone, matching the reference design's per-subject icon colors.

export const MODULE_TILE_COLORS = [
  { bg: 'bg-[#fbdada]', fg: 'text-[#b8493f]' }, { bg: 'bg-[#dceaf1]', fg: 'text-[#2c6a8f]' },
  { bg: 'bg-[#fff0cb]', fg: 'text-[#94651c]' }, { bg: 'bg-[#e6dcf5]', fg: 'text-[#6b3fa0]' },
  { bg: 'bg-[#d7eee4]', fg: 'text-[#1f7a5c]' }, { bg: 'bg-[#dde4f7]', fg: 'text-[#3b4f8f]' },
];

export function greetingForHour(hour: number): string {
  if (hour < 12) return 'Good morning';
  if (hour < 17) return 'Good afternoon';
  return 'Good evening';
}

export function ModuleCard({ m, i }: { m: Module; i: number }) {
  return <ModulePoster id={m.id} name={m.name} subtitle={m.subtitle} iconUrl={(m as Module & { iconUrl?: string | null }).iconUrl} subjectCount={m.subjectCount} mcqCount={m.mcqCount} progress={m.progress} index={i} />;
}

// Round 3, item 6: Blocks becomes the primary top-level nav item (sidebar
// entry + landing page), instead of being just a grouping/section-header
// inside the old flat Modules page. `/modules` is kept working as a
// redirect to `/blocks` (below) so any old link/bookmark to it still
// lands somewhere correct instead of 404ing or dead-ending. Subjects()'s
// drill-down (`/modules/:id`, "Subjects", topics) is intentionally
// untouched — only what feeds into it (this page) changed.

export function useModulesGrouping() {
  const q = useListModules(); const modules = q.data ?? []; const [search, setSearch] = useState('');
  const blocksQ = useQuery({ queryKey: ['blocks'], queryFn: blocksApi.list });
  const blocks = (blocksQ.data ?? []).filter((b) => b.active).sort((a, b) => a.displayOrder - b.displayOrder);
  const filtered = modules.filter((m) => m.name.toLowerCase().includes(search.toLowerCase()));
  const modulesByBlock = new Map<number, Module[]>();
  const unassigned: Module[] = [];
  for (const m of filtered) {
    const blockId = (m as Module & { blockId?: number | null }).blockId;
    if (blockId != null) {
      if (!modulesByBlock.has(blockId)) modulesByBlock.set(blockId, []);
      modulesByBlock.get(blockId)!.push(m);
    } else unassigned.push(m);
  }
  return { isLoading: q.isLoading || blocksQ.isLoading, modules, blocks, filtered, modulesByBlock, unassigned, search, setSearch };
}

// The full-bleed hero tile used on the Blocks landing page — same visual
// treatment item 7 asks for on module thumbnail cards: cover image behind
// the whole card, name overlaid bottom-left over a gradient scrim, rather
// than the old small icon-tile + label row.

export function BlockHeroCard({ href, name, iconUrl, moduleCount, muted }: { href: string; name: string; iconUrl?: string | null; moduleCount: number; muted?: boolean }) {
  return <BlockPoster href={href} name={name} iconUrl={iconUrl} moduleCount={moduleCount} muted={muted} />;
}

export function topicColorVar(key: string): string {
  let hash = 0;
  for (let i = 0; i < key.length; i++) hash = (hash * 31 + key.charCodeAt(i)) >>> 0;
  return `--chart-${(hash % 5) + 1}`;
}

export function topicAccentStyles(key: string) {
  const v = topicColorVar(key || 'default');
  return {
    badge: { background: `hsl(var(${v}) / 0.16)`, color: `hsl(var(${v}))` },
    border: { borderColor: `hsl(var(${v}) / 0.4)` },
    wash: { background: `hsl(var(${v}) / 0.07)` },
    solidBg: { background: `hsl(var(${v}))` },
    ring: { boxShadow: `0 0 0 3px hsl(var(${v}) / 0.18)` },
  };
}

export function TopicBadge({ label }: { label: string }) {
  return <span className="inline-flex items-center rounded-full px-2.5 py-1 text-[10px] font-bold capitalize" style={topicAccentStyles(label).badge}>{label}</span>;
}

export const AI_VISUALIZER_EXAMPLES = [
  'Create an interactive step-by-step visualization of skeletal muscle contraction, from action potential through calcium release, cross-bridge cycling, and relaxation.',
  'Show me how preload affects stroke volume via the Frank-Starling mechanism.',
  'Explain cardiac output with an interactive HR and SV control.',
  'Compare Type 1 and Type 2 diabetes mellitus.',
];
