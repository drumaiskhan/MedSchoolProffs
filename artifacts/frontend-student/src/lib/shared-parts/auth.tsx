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

import { Footer } from './marketing';
import { cn } from './ui';
import { Logo } from './shell';


export function AuthLayout({ children, register = false }: { children: ReactNode; register?: boolean }) { return <div className="grid min-h-[100dvh] bg-background lg:grid-cols-[.9fr_1.1fr]"><div className="safe-top flex flex-col p-6 md:p-10"><Logo /><div className="mx-auto flex w-full max-w-sm flex-1 items-center py-10">{children}</div><Footer /></div><div className="relative hidden overflow-hidden bg-sidebar p-14 text-sidebar-foreground lg:flex lg:flex-col lg:justify-between"><Aurora /><div className="relative"><div className="font-mono-app text-[10px] uppercase tracking-[.18em] text-sidebar-foreground/70">Practice &amp; learn — no exam pressure</div><h2 className="mt-8 max-w-lg font-display text-6xl leading-[.93] tracking-[-.04em]">Every MCQ<br /><em className="text-shimmer not-italic" style={{ backgroundImage: 'linear-gradient(100deg, hsl(var(--sidebar-primary)) 10%, #b9f5ea 40%, hsl(var(--sidebar-primary)) 70%)' }}>you'll need.</em></h2></div><div className="relative"><AuthShowcase /></div><div className="relative max-w-sm"><div className="mb-4 h-px bg-sidebar-border" /><p className="text-sm leading-6 text-sidebar-foreground/80">One MCQ bank across every college, subject, and topic for MBBS &amp; BDS students — built for steady daily practice, not timed exams.</p><div className="mt-5 flex items-center gap-2 text-xs font-bold"><span className="grid size-7 place-items-center rounded-full bg-sidebar-primary text-sidebar-primary-foreground"><Check size={14} /></span> Instant explanations on every question</div></div></div></div>; }

export function Stepper({ step }: { step: 1 | 2 }) {
  const steps = [{ n: 1, label: 'Your details' }, { n: 2, label: 'Membership & payment' }];
  return <div className="mb-8 flex items-center gap-3">{steps.map((s, i) => <div key={s.n} className="flex items-center gap-3">
    <div className="flex items-center gap-2.5"><div className={cn('grid size-8 shrink-0 place-items-center rounded-full text-xs font-extrabold transition-colors', step > s.n ? 'bg-primary text-primary-foreground' : step === s.n ? 'bg-primary text-primary-foreground ring-4 ring-primary/15' : 'bg-muted text-muted-foreground')} data-testid={`step-indicator-${s.n}`}>{step > s.n ? <Check size={14} /> : s.n}</div><span className={cn('hidden text-xs font-bold sm:inline', step >= s.n ? 'text-foreground' : 'text-muted-foreground')}>{s.label}</span></div>
    {i < steps.length - 1 && <div className={cn('h-0.5 w-8 rounded-full transition-colors sm:w-16', step > s.n ? 'bg-primary' : 'bg-muted')} />}
  </div>)}</div>;
}

export function CopyRow({ label, value }: { label: string; value: string }) {
  const [copied, setCopied] = useState(false);
  return <div className="flex items-center justify-between gap-2 rounded-lg bg-card px-3 py-2"><div className="min-w-0"><div className="text-[10px] text-muted-foreground">{label}</div><div className="truncate font-mono-app text-xs font-bold">{value}</div></div><button type="button" onClick={() => { navigator.clipboard?.writeText(value); setCopied(true); setTimeout(() => setCopied(false), 1500); }} className="shrink-0 rounded-lg p-1.5 text-muted-foreground hover:bg-muted hover:text-foreground" data-testid={`button-copy-${label.toLowerCase().replaceAll(' ', '-')}`}>{copied ? <CheckCheck size={14} className="text-primary" /> : <Copy size={14} />}</button></div>;
}

export function IconField({ icon: Icon, ...props }: { icon: typeof UserIcon } & ComponentProps<'input'>) {
  return <div className="relative"><Icon size={15} className="pointer-events-none absolute left-3.5 top-1/2 -translate-y-1/2 text-muted-foreground" /><input {...props} className="h-11 w-full rounded-xl border border-border bg-card pl-10 pr-3 text-sm outline-none transition-shadow focus:ring-2 focus:ring-primary/20" /></div>;
}

export function PasswordStrength({ value }: { value: string }) {
  const score = [value.length >= 8, /[A-Z]/.test(value), /[0-9]/.test(value), /[^A-Za-z0-9]/.test(value)].filter(Boolean).length;
  if (!value) return null;
  const label = ['Too short', 'Weak', 'Fair', 'Good', 'Strong'][score];
  const color = ['bg-destructive', 'bg-destructive', 'bg-[#e5a952]', 'bg-[#8bcbb8]', 'bg-primary'][score];
  return <div className="mt-2"><div className="flex gap-1">{[0, 1, 2, 3].map((i) => <div key={i} className={cn('h-1 flex-1 rounded-full transition-colors', i < score ? color : 'bg-muted')} />)}</div><div className="mt-1 text-[10px] font-semibold text-muted-foreground">{label}</div></div>;
}

export const PAYMENT_METHODS: Array<{ value: string; label: string; icon: typeof Landmark }> = [
  { value: 'Bank transfer', label: 'Bank transfer', icon: Landmark },
  { value: 'UPI', label: 'UPI', icon: Smartphone },
  { value: 'Raast', label: 'Raast', icon: Zap },
  { value: 'Mobile wallet', label: 'Mobile wallet', icon: Smartphone },
  { value: 'Card', label: 'Card', icon: CreditCard },
];
