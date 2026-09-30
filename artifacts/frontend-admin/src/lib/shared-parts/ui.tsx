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



// Round 3, item 10 (performance) — same over-fetching fix as the student
// app (see its App.tsx for the full rationale): `new QueryClient()` with no
// options refetched on every mount and every window refocus. Admin
// mutations already call invalidateQueries on the specific keys they
// change, so edits still show up immediately — this only avoids redundant
// background refetches of data nothing has touched.

export const cn = (...parts: Array<string | false | undefined | null>) => parts.filter(Boolean).join(' ');

export const initials = (name = 'MedschoolProffs') => name.split(' ').map((n) => n[0]).slice(0, 2).join('').toUpperCase();

export const money = (amount: number, currency = 'PKR') => new Intl.NumberFormat('en-PK', { style: 'currency', currency, maximumFractionDigits: 0 }).format(amount);
// Payment status codes stored in the DB are uppercase (PAYMENT_PENDING_REVIEW,
// APPROVED, REJECTED, VOIDED) — these map them to display labels and badge
// tones. Previously the UI compared these against lowercase literals like
// 'pending', which never matched, so the pending badge (and the filter tabs)
// silently fell through to the wrong tone/empty results.

export const PAYMENT_STATUS_LABEL: Record<string, string> = { PAYMENT_PENDING_REVIEW: 'pending', APPROVED: 'approved', REJECTED: 'rejected', VOIDED: 'voided' };

export const paymentStatusLabel = (status: string) => PAYMENT_STATUS_LABEL[status] || status.toLowerCase();

export const paymentStatusTone = (status: string): 'amber' | 'green' | 'red' | 'neutral' => (status === 'PAYMENT_PENDING_REVIEW' ? 'amber' : status === 'APPROVED' ? 'green' : status === 'VOIDED' ? 'neutral' : 'red');

// Small reusable confirm-before-delete dialog, used by every admin list's
// delete action (task: real confirm modal, not window.confirm).

export function ConfirmDialog({ title, body, confirmLabel = 'Delete', pendingLabel, onConfirm, onCancel, pending, tone = 'destructive', testId = 'delete' }: { title: string; body: string; confirmLabel?: string; pendingLabel?: string; onConfirm: () => void; onCancel: () => void; pending?: boolean; tone?: 'destructive' | 'primary'; testId?: string }) {
  const toneClass = tone === 'primary' ? 'bg-primary text-primary-foreground' : 'bg-destructive text-destructive-foreground';
  return <div className="fixed inset-0 z-[60] grid place-items-center bg-black/40 p-4 animate-in fade-in duration-200" onClick={onCancel}><div onClick={(e) => e.stopPropagation()} className="w-full max-w-sm rounded-2xl bg-card p-6 shadow-2xl animate-in fade-in zoom-in-95 slide-in-from-bottom-2 duration-200"><h3 className="font-bold">{title}</h3><p className="mt-2 text-xs leading-5 text-muted-foreground">{body}</p><div className="mt-5 flex gap-2"><button onClick={onCancel} className="flex-1 rounded-xl border border-border py-2.5 text-xs font-bold transition-transform active:scale-95" data-testid="button-confirm-cancel">Cancel</button><button onClick={onConfirm} disabled={pending} className={cn('flex-1 rounded-xl py-2.5 text-xs font-extrabold transition-transform active:scale-95 disabled:opacity-50', toneClass)} data-testid={`button-confirm-${testId}`}>{pending ? (pendingLabel ?? 'Deleting…') : confirmLabel}</button></div></div></div>;
}

// Matches the student app's Logo (see its shared.tsx) — a pulsing
// waveform mark plus a continuously shimmering wordmark, instead of a
// static Lucide icon and flat-coloured text with no animation at all.
export function AnimatedBrandMark({ size = 20, className = '' }: { size?: number; className?: string }) {
  return <svg width={size} height={size * 0.625} viewBox="0 0 64 40" aria-hidden="true" className={cn('shrink-0', className)}>
    <style>{`@keyframes admin-brand-mark-pulse { 0% { stroke-dashoffset: 190; opacity: .55; } 55% { stroke-dashoffset: 0; opacity: 1; } 100% { stroke-dashoffset: -190; opacity: .55; } }`}</style>
    <path d="M2 20 H14 L19 6 L27 34 L33 12 L38 20 H62" fill="none" stroke="currentColor" strokeWidth="4" strokeLinecap="round" strokeLinejoin="round" style={{ strokeDasharray: 190, strokeDashoffset: 190, animation: 'admin-brand-mark-pulse 1.7s ease-in-out infinite' }} />
  </svg>;
}

export function Logo({ dark = false }: { dark?: boolean }) {
  return <Link href="/" className="group flex items-center gap-2" data-testid="link-logo">
    <style>{`@keyframes admin-brand-text-shimmer { 0% { background-position: 200% 0; } 50% { background-position: 0% 0; } 100% { background-position: -200% 0; } }`}</style>
    <AnimatedBrandMark size={20} className={dark ? 'text-sidebar-primary' : 'text-primary'} />
    <span
      className={cn(
        'bg-clip-text text-[15px] font-extrabold tracking-[-.03em] text-transparent transition-[animation-duration] duration-300 ease-out group-hover:![animation-duration:1.1s]',
        dark
          ? 'bg-[linear-gradient(100deg,hsl(var(--sidebar-foreground))_20%,#2dd9c4_50%,hsl(var(--sidebar-foreground))_80%)]'
          : 'bg-[linear-gradient(100deg,hsl(var(--primary))_20%,#2dd9c4_50%,hsl(var(--primary))_80%)]',
      )}
      style={{ backgroundSize: '250% 100%', animation: 'admin-brand-text-shimmer 3.4s ease-in-out infinite' }}
    >MedschoolProffs</span>
  </Link>;
}

export type NavItem = [string, string, typeof LayoutDashboard];

export function BrandedLoadingScreen() {
  return <div className="grid min-h-[100dvh] place-items-center" style={{ background: 'hsl(var(--sidebar))' }}>
    <style>{`
      @keyframes boot-wave-draw { 0% { stroke-dashoffset: 190; opacity: .55; } 55% { stroke-dashoffset: 0; opacity: 1; } 100% { stroke-dashoffset: -190; opacity: .55; } }
      @keyframes boot-fade { 0%, 100% { opacity: .6; } 50% { opacity: 1; } }
    `}</style>
    <div className="flex flex-col items-center gap-3.5">
      <svg width="64" height="40" viewBox="0 0 64 40" aria-hidden="true"><path d="M2 20 H14 L19 6 L27 34 L33 12 L38 20 H62" fill="none" stroke="hsl(var(--sidebar-primary))" strokeWidth="4" strokeLinecap="round" strokeLinejoin="round" style={{ strokeDasharray: 190, strokeDashoffset: 190, animation: 'boot-wave-draw 1.7s ease-in-out infinite' }} /></svg>
      <div className="font-display text-xl font-bold tracking-[-.01em]" style={{ color: 'hsl(var(--sidebar-foreground))', animation: 'boot-fade 1.7s ease-in-out infinite' }}>MedschoolProffs</div>
    </div>
  </div>;
}

// Small reusable brand mark used anywhere the app needs an inline
// "loading" indicator — replaces plain spinners / bare "Loading…" text so
// every loading state (not just the full-screen boot one) carries the
// MedschoolProffs wave mark instead of defaulting to blank white.

export function BrandSpinner({ size = 16, className = '' }: { size?: number; className?: string }) {
  return <svg width={size} height={size * 0.625} viewBox="0 0 64 40" aria-hidden="true" role="status" aria-label="Loading" className={cn('brand-spinner shrink-0', className)}>
    <path d="M2 20 H14 L19 6 L27 34 L33 12 L38 20 H62" fill="none" stroke="currentColor" strokeWidth="5" strokeLinecap="round" strokeLinejoin="round" />
  </svg>;
}

export function InlineLoading({ label = 'Loading…', size = 13 }: { label?: string; size?: number }) {
  return <div className="flex items-center gap-2 py-2 text-[11px] font-semibold text-primary"><BrandSpinner size={size} />{label}</div>;
}

export function SkeletonPage() { return <div className="space-y-5"><div className="flex items-center gap-2 text-primary"><BrandSpinner size={22} /><span className="text-[11px] font-bold uppercase tracking-[.1em]">Loading</span></div><div className="skeleton h-8 w-56 rounded-lg" /><div className="grid gap-4 md:grid-cols-3"><div className="skeleton h-32 rounded-2xl" /><div className="skeleton h-32 rounded-2xl" /><div className="skeleton h-32 rounded-2xl" /></div><div className="skeleton h-72 rounded-2xl" /></div>; }

export function EmptyState({ icon: Icon = FolderOpen, title, body, action }: { icon?: typeof FolderOpen; title: string; body: string; action?: ReactNode }) { return <div className="grid min-h-[260px] place-items-center rounded-2xl border border-dashed border-border bg-card/50 p-8 text-center"><div><div className="mx-auto mb-4 grid size-14 place-items-center rounded-2xl bg-gradient-to-br from-primary/15 to-primary/5 text-primary ring-1 ring-primary/15"><Icon size={24} /></div><h3 className="text-[15px] font-extrabold">{title}</h3><p className="mx-auto mt-2 max-w-sm text-sm leading-6 text-muted-foreground">{body}</p>{action && <div className="mt-5">{action}</div>}</div></div>; }

export function ErrorState({ retry }: { retry?: () => void }) { return <div className="rounded-2xl border border-destructive/30 bg-destructive/10 p-6 text-sm text-destructive"><div className="flex items-center gap-2 font-bold"><CircleHelp size={17} /> We couldn't load this view.</div><p className="mt-2 text-destructive">Check your connection, then try again.</p>{retry && <button onClick={retry} className="mt-4 rounded-lg bg-destructive px-3 py-2 text-xs font-bold text-white" data-testid="button-retry">Try again</button>}</div>; }

export function Badge({ children, tone = 'neutral' }: { children: ReactNode; tone?: 'neutral' | 'green' | 'amber' | 'red' | 'blue' }) { return <span className={cn('inline-flex items-center rounded-full px-2.5 py-1 text-[10px] font-bold capitalize', tone === 'green' && 'bg-primary/15 text-primary', tone === 'amber' && 'bg-accent/20 text-accent-text', tone === 'red' && 'bg-destructive/15 text-destructive', tone === 'blue' && 'bg-info/15 text-info', tone === 'neutral' && 'bg-muted text-muted-foreground')}>{children}</span>; }

// Round 3, item 5 — compact three-way Easy/Medium/Hard segmented control
// (colored dot + label, one pill highlighted as selected), styled after the
// emedcrack.com reference the admin pointed to, replacing a plain <select>
// for difficulty wherever MCQs render as individual tiles/rows during bulk
// upload/review (the manual single-add form and the MCQ edit form keep
// their existing <select> — those are forms, not per-row tiles, so they
// were out of scope for this swap). Keeps the same 'easy'|'moderate'|'hard'
// values as everywhere else in the app.

export function DifficultyPicker({ value, onChange, testId }: { value: string; onChange: (v: 'easy' | 'moderate' | 'hard') => void; testId?: string }) {
  const options: Array<{ value: 'easy' | 'moderate' | 'hard'; label: string; dot: string; active: string }> = [
    { value: 'easy', label: 'Easy', dot: 'bg-primary', active: 'bg-primary/15 text-primary border-primary' },
    { value: 'moderate', label: 'Medium', dot: 'bg-accent', active: 'bg-accent/20 text-accent-text border-accent' },
    { value: 'hard', label: 'Hard', dot: 'bg-destructive', active: 'bg-destructive/15 text-destructive border-destructive' },
  ];
  return <div className="inline-flex items-center gap-1.5 rounded-full border border-border bg-background p-1">
    {options.map((opt) => <button key={opt.value} type="button" onClick={() => onChange(opt.value)} className={cn('inline-flex items-center gap-1.5 rounded-full px-2.5 py-1 text-[10px] font-bold transition-colors', value === opt.value ? cn('border', opt.active) : 'text-muted-foreground hover:text-foreground')} data-testid={testId ? `${testId}-${opt.value}` : undefined}><span className={cn('size-1.5 rounded-full', opt.dot)} />{opt.label}</button>)}
  </div>;
}

// Read-only readout of a parsed candidate's suggestedPath (see
// ParsedMcqCandidate.suggestedPath in mcqParser.ts) — shown on an import
// candidate card when the source file tagged that row with its place in
// the curriculum (e.g. an "enriched" export with Block/Module/Subject/
// Chapter columns). Informational only: it does not create or match any
// Block/Module/Subject/Topic row, and picking it up automatically is still
// open — see AI_HANDOFF_ENRICHED_IMPORT.md.
export function SuggestedPathHint({ path }: { path?: { block: string | null; module: string | null; subject: string | null; topic: string | null } | null }) {
  const parts = path ? [path.block, path.module, path.subject, path.topic].filter((p): p is string => !!p) : [];
  if (!parts.length) return null;
  return <p className="mt-2 text-[11px] font-semibold text-muted-foreground">Suggested from file: {parts.join(' › ')} <span className="font-normal">(not applied automatically — file under a module/subject/topic above if you want it there)</span></p>;
}

export function Progress({ value, color = 'bg-primary' }: { value: number; color?: string }) { return <div className="h-1.5 overflow-hidden rounded-full bg-muted"><div className={cn('h-full rounded-full transition-all', color)} style={{ width: `${Math.min(100, Math.max(0, value))}%` }} /></div>; }

export function SectionHeader({ eyebrow, title, action }: { eyebrow?: string; title: string; action?: ReactNode }) { return <div className="mb-5 flex flex-wrap items-end justify-between gap-x-4 gap-y-2"><div className="flex items-stretch gap-3"><span className="w-1 shrink-0 rounded-full bg-gradient-to-b from-primary to-primary/30" /><div>{eyebrow && <div className="font-mono-app text-[10px] font-bold uppercase tracking-[.16em] text-primary">{eyebrow}</div>}<h2 className="mt-0.5 text-[22px] font-extrabold leading-tight tracking-[-.03em]">{title}</h2></div></div>{action}</div>; }

export function Stat({ label, value }: { label: string; value: string | number }) { return <div className="rounded-xl bg-card/70 p-3 text-center"><div className="font-display text-2xl">{value}</div><div className="mt-0.5 text-[10px] text-muted-foreground">{label}</div></div>; }

// Audit log actions are consistent SCREAMING_SNAKE_CASE codes (MCQ_CREATED,
// BLOCK_ARCHIVED, ...) — humanized generically rather than via a hardcoded
// per-action lookup table, so it stays correct for every action the backend
// logs today or adds later without needing updates here.

export function humanizeAuditAction(action: string): string {
  const s = action.toLowerCase().replaceAll('_', ' ');
  return s.charAt(0).toUpperCase() + s.slice(1);
}

export function timeAgo(iso: string): string {
  const diffMs = Date.now() - new Date(iso).getTime();
  const mins = Math.floor(diffMs / 60000);
  if (mins < 1) return 'just now';
  if (mins < 60) return `${mins}m ago`;
  const hours = Math.floor(mins / 60);
  if (hours < 24) return `${hours}h ago`;
  return `${Math.floor(hours / 24)}d ago`;
}
