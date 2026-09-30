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

import { cn } from './ui';


export const DEGREE_OPTIONS = ['MBBS', 'BDS'] as const;

export const DEGREE_YEAR_OPTIONS: Record<string, string[]> = {
  MBBS: ['1st Year', '2nd Year', '3rd Year', '4th Year', 'Final Year'],
  BDS: ['1st Year', '2nd Year', '3rd Year', 'Final Year'],
};

// Turns the Degree + Year picker's own selection straight into the
// programTargetKind/yearTargetNumber pair that actually gates visibility
// (see pastPapersTable's comment) — position within DEGREE_YEAR_OPTIONS is
// the year number, so "Final Year" lands on 5 for MBBS and 4 for BDS
// without needing a separate lookup table to keep in sync.

export function studyYearToNumber(degree: string, studyYear: string): number | undefined {
  const index = (DEGREE_YEAR_OPTIONS[degree] || []).indexOf(studyYear);
  return index >= 0 ? index + 1 : undefined;
}

// Shared classifier for Past papers and Pre-Proffs exams: buckets a flat
// list into MBBS / BDS (whatever a getDegree() callback resolves, falling
// back to "Unspecified" for legacy/untyped rows) and then, inside each of
// those, by whatever getYear() resolves — calendar year for past papers,
// study year for exams. Keeps MBBS before BDS before anything unset, and
// sorts years newest-first within a degree so the page reads as organized
// sections instead of one long flat list.
//
// Optional `getYearSortKey`: when the year groups are actually a study
// year (1st/2nd/.../Final) rather than a calendar year, plain string
// sorting gets "Final Year" wrong (no leading digit to compare against
// "4th Year" etc.) — pass a numeric key per item (e.g. yearTargetNumber)
// and groups sort ascending by it (1st Year first) instead, with any
// group that has no resolvable key sorted last. Omit it to keep the
// original newest-first string sort (past papers' calendar-year grouping,
// and exams' existing behavior — both unaffected by this addition).
export function groupByDegreeYear<T>(items: T[], getDegree: (item: T) => string, getYear: (item: T) => string, getYearSortKey?: (item: T) => number | undefined) {
  const DEGREE_ORDER = ['MBBS', 'BDS'];
  const byDegree = new Map<string, T[]>();
  for (const item of items) {
    const d = getDegree(item) || '';
    if (!byDegree.has(d)) byDegree.set(d, []);
    byDegree.get(d)!.push(item);
  }
  const degrees = [...DEGREE_ORDER.filter((d) => byDegree.has(d)), ...[...byDegree.keys()].filter((d) => !DEGREE_ORDER.includes(d))];
  return degrees.map((degree) => {
    const list = byDegree.get(degree)!;
    const byYear = new Map<string, T[]>();
    for (const item of list) {
      const y = getYear(item) || '';
      if (!byYear.has(y)) byYear.set(y, []);
      byYear.get(y)!.push(item);
    }
    let years: string[];
    if (getYearSortKey) {
      const keyOf = (y: string) => byYear.get(y)!.map(getYearSortKey).find((k) => k !== undefined && !Number.isNaN(k));
      years = [...byYear.keys()].sort((a, b) => {
        const ka = keyOf(a); const kb = keyOf(b);
        if (ka === undefined && kb === undefined) return a.localeCompare(b);
        if (ka === undefined) return 1;
        if (kb === undefined) return -1;
        return ka - kb;
      });
    } else {
      years = [...byYear.keys()].sort((a, b) => b.localeCompare(a, undefined, { numeric: true }));
    }
    return { degree, groups: years.map((year) => ({ year, items: byYear.get(year)! })) };
  });
}

// Generic collapsible section header, matching McqTreeModule's chevron/
// rotate pattern (the MCQ bank tree) — reused here for Past papers so the
// two collapsible trees in the admin app read as the same design language
// rather than two different accordion implementations.

export function CollapsibleGroup({ title, count, icon, defaultOpen = true, nested, testId, children }: { title: string; count: number; icon?: React.ReactNode; defaultOpen?: boolean; nested?: boolean; testId: string; children: React.ReactNode }) {
  const [open, setOpen] = useState(defaultOpen);
  return <div className={nested ? 'mb-4 last:mb-0' : 'mb-7 last:mb-0'}>
    <button type="button" onClick={() => setOpen((v) => !v)} className={cn('flex w-full items-center gap-2 text-left', nested ? 'mb-2 text-[11px] font-bold uppercase tracking-wide text-muted-foreground' : 'mb-3 text-xs font-extrabold uppercase tracking-[.08em] text-primary')} data-testid={`button-toggle-${testId}`}>
      <ChevronRight size={nested ? 13 : 14} className={cn('shrink-0 transition-transform', open && 'rotate-90')} />
      {icon}{title}<span className="ml-auto font-mono-app text-[10px] font-semibold normal-case tracking-normal text-muted-foreground">{count}</span>
    </button>
    {open && children}
  </div>;
}
