// Auto-extracted shared helpers/components/hooks used across page modules.
// Split out of the original monolithic App.tsx so route-level pages can be
// lazy-loaded independently without dragging this along more than once.
import { type ReactNode, type ComponentProps, type TouchEvent, type KeyboardEvent as ReactKeyboardEvent, useId, useState, useEffect, useRef, createContext, useContext } from 'react';
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


// v64 — account-entry shell. Phones/tablets get a navy header with a question that
// answers itself once (the product in one glance) and a sheet the form sits on;
// desktop keeps the two-column layout with the showcase panel. Styles: auth.css.
function AuthMcq() {
  const [picked, setPicked] = useState(() => typeof window !== 'undefined' && !!window.matchMedia?.('(prefers-reduced-motion: reduce)').matches);
  useEffect(() => {
    if (picked) return;
    const t = window.setTimeout(() => setPicked(true), 1200);
    return () => window.clearTimeout(t);
  }, [picked]);
  const opts = ['Radial', 'Axillary', 'Median', 'Ulnar'];
  return <div className="au-mcq" aria-hidden="true">
    <p className="au-mcq__q">Which nerve is at risk in a fracture of the surgical neck of the humerus?</p>
    <div className="au-mcq__opts">{opts.map((t, i) => <div key={t} className={cn('au-mcq__opt', picked && i === 1 && 'is-right')}><span className="au-mcq__key">{picked && i === 1 ? <Check size={12} strokeWidth={3} /> : 'ABCD'[i]}</span>{t}</div>)}</div>
    <p className={cn('au-mcq__why', picked && 'is-on')}><b>Axillary nerve.</b> It wraps the surgical neck, so deltoid weakness is the classic sign.</p>
  </div>;
}

export function AuthLayout({ children, register = false }: { children: ReactNode; register?: boolean }) {
  return <div className="au-shell">
    <div className="au-main">
      <header className="au-hero" data-compact={register ? '' : undefined}>
        <div className="hero-grid" />
        <div className="au-hero__inner">
          <Logo dark />
          <p className="au-hero__line">{register ? 'MCQs for MBBS & BDS students.' : 'Every question comes with the reason why.'}</p>
          {!register && <AuthMcq />}
        </div>
      </header>
      <div className="au-sheet">
        <div className="au-desktop-logo"><Logo /></div>
        <div className="au-sheet__body" data-wide={register ? '' : undefined}>{children}</div>
        <div className="au-foot"><Footer /></div>
      </div>
    </div>
    <div className="relative hidden overflow-hidden bg-sidebar p-14 text-sidebar-foreground lg:flex lg:flex-col lg:justify-between"><Aurora /><div className="relative"><div className="font-mono-app text-[10px] uppercase tracking-[.18em] text-sidebar-foreground/70">Practice &amp; learn — no exam pressure</div><h2 className="mt-8 max-w-lg font-display text-6xl leading-[.93] tracking-[-.04em]">Every MCQ<br /><em className="text-shimmer not-italic" style={{ backgroundImage: 'linear-gradient(100deg, hsl(var(--sidebar-primary)) 10%, #b9f5ea 40%, hsl(var(--sidebar-primary)) 70%)' }}>you'll need.</em></h2></div><div className="relative"><AuthShowcase /></div><div className="relative max-w-sm"><div className="mb-4 h-px bg-sidebar-border" /><p className="text-sm leading-6 text-sidebar-foreground/80">One MCQ bank across every college, subject, and topic for MBBS &amp; BDS students — built for steady daily practice, not timed exams.</p><div className="mt-5 flex items-center gap-2 text-xs font-bold"><span className="grid size-7 place-items-center rounded-full bg-sidebar-primary text-sidebar-primary-foreground"><Check size={14} /></span> Instant explanations on every question</div></div></div>
  </div>;
}

/** Labelled input with an icon chip — the one field style used across sign-in, registration and recovery. */
export function AuthField({ label, icon: Icon, labelAside, hint, trailing, id, className, ...input }: {
  label: ReactNode; icon: typeof UserIcon; labelAside?: ReactNode; hint?: ReactNode; trailing?: ReactNode;
} & ComponentProps<'input'>) {
  const auto = useId();
  const fid = id ?? auto;
  return <div className="au-field">
    <div className="au-label"><label htmlFor={fid}>{label}</label>{labelAside}</div>
    <div className="au-input-wrap">
      <span className="au-ico" aria-hidden="true"><Icon size={16} /></span>
      <input {...input} id={fid} className={cn('au-input', className)} />
      {trailing}
    </div>
    {hint}
  </div>;
}

/** Password field with a show/hide toggle and a Caps Lock warning. Works controlled or uncontrolled. */
export function AuthPassword({ label = 'Password', toggleTestId, onKeyUp, onKeyDown, onBlur, ...props }: Omit<ComponentProps<typeof AuthField>, 'icon' | 'type' | 'trailing' | 'hint'> & { toggleTestId?: string }) {
  const [show, setShow] = useState(false);
  const [caps, setCaps] = useState(false);
  const watch = (e: ReactKeyboardEvent<HTMLInputElement>) => setCaps(!!e.getModifierState?.('CapsLock'));
  return <AuthField {...props} label={label} icon={LockKeyhole} type={show ? 'text' : 'password'} className="au-input--pw"
    onKeyUp={(e) => { watch(e); onKeyUp?.(e); }}
    onKeyDown={(e) => { watch(e); onKeyDown?.(e); }}
    onBlur={(e) => { setCaps(false); onBlur?.(e); }}
    trailing={<button type="button" className="au-eye" aria-label={show ? 'Hide password' : 'Show password'} aria-pressed={show} onClick={() => setShow((v) => !v)} data-testid={toggleTestId}>{show ? <EyeOff size={17} /> : <Eye size={17} />}</button>}
    hint={caps ? <div className="au-hint au-hint--warn" role="status"><AlertTriangle size={13} /> Caps Lock is on</div> : undefined} />;
}

/** Two-step progress for registration. On step 2 the first step becomes a way back. */
export function AuthSteps({ step, onBack }: { step: 1 | 2; onBack?: () => void }) {
  const state = (n: number) => (step > n ? 'done' : step === n ? 'current' : 'todo');
  const dot = (n: number) => <span className="au-step__dot">{state(n) === 'done' ? <Check size={13} strokeWidth={3} /> : n}</span>;
  return <div className="au-steps" role="list" aria-label="Registration progress">
    {step === 2 && onBack
      ? <button type="button" role="listitem" className="au-step" data-state="done" onClick={onBack} data-testid="step-indicator-1">{dot(1)}About you</button>
      : <div role="listitem" className="au-step" data-state={state(1)} aria-current={step === 1 ? 'step' : undefined} data-testid="step-indicator-1">{dot(1)}About you</div>}
    <span className="au-steps__line" data-on={step === 2 ? '' : undefined} />
    <div role="listitem" className="au-step" data-state={state(2)} aria-current={step === 2 ? 'step' : undefined} data-testid="step-indicator-2">{dot(2)}Plan &amp; payment</div>
  </div>;
}

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
