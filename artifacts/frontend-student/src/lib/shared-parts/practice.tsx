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

import { Badge, cn } from './ui';

// Turns a just-finished session's score plus the student's recent-vs-prior
// trend into one short, human verdict for the result card and the
// dashboard progress profile. Session score takes priority when it's a
// clear outlier (a great or rough single session is worth saying so even
// if the broader trend is flat); otherwise it falls back to the trend.

export function progressVerdict(sessionScore: number | null, trend?: ProgressTrend | null): { label: string; message: string; tone: 'up' | 'down' | 'flat' | 'new' } {
  const recentAvg = trend?.recentAverage ?? null;
  if (sessionScore != null && recentAvg != null) {
    const diff = sessionScore - recentAvg;
    if (diff >= 15) return { label: 'Great session', tone: 'up', message: `${Math.round(diff)} points above your recent average — that's real progress.` };
    if (diff <= -15) return { label: 'Rough one', tone: 'down', message: `A bit below your recent average — worth another pass on this topic.` };
  }
  if (!trend || trend.trend === 'new') return { label: 'Getting started', tone: 'new', message: 'Keep practicing daily — a trend will show up after a few more sessions.' };
  if (trend.trend === 'up') return { label: 'Improving', tone: 'up', message: `Up ${Math.abs(trend.trendDelta)} points versus the week before. Keep this pace.` };
  if (trend.trend === 'down') return { label: 'Needs more practice', tone: 'down', message: `Down ${Math.abs(trend.trendDelta)} points versus the week before — a bit more daily practice should turn this around.` };
  return { label: 'Steady', tone: 'flat', message: "Holding steady versus last week. Consistent is good — push for a new high next session." };
}

export function ProgressBadge({ tone, label }: { tone: 'up' | 'down' | 'flat' | 'new'; label: string }) {
  const styles = tone === 'up' ? 'bg-[#d7eee4] text-[#164b4b]' : tone === 'down' ? 'bg-[#fff1ed] text-[#8a3a26]' : tone === 'new' ? 'bg-[#dceaf1] text-[#32647b]' : 'bg-muted text-muted-foreground';
  const Icon = tone === 'up' ? TrendingUp : tone === 'down' ? TrendingDown : Minus;
  return <span className={cn('inline-flex items-center gap-1.5 rounded-full px-3 py-1.5 text-[11px] font-bold', styles)}><Icon size={12} /> {label}</span>;
}
// Shown once a practice or past-paper session is finished (the set runs
// out) instead of silently looping back to question one — gives the
// student a clear stopping point plus the improving/steady/needs-practice
// read on where they stand, a full attempted/skipped/correct/wrong
// breakdown, every question with its outcome, and a dedicated "review
// wrong answers" section at the end so mistakes are easy to find again.

import { ResultInsights } from '@/components/study/ResultInsights';
export function PracticeResultCard({ mcqs, answers, backHref, backLabel, onRestart, onRedoWrong }: { mcqs: Mcq[]; answers: Record<number, string | null>; backHref: string; backLabel: string; onRestart: () => void; onRedoWrong?: (wrong: Mcq[]) => void }) {
  const total = mcqs.length;
  const attempted = mcqs.filter((m) => answers[m.id] != null).length;
  const correct = mcqs.filter((m) => answers[m.id] != null && answers[m.id] === m.correctAnswer).length;
  const wrong = mcqs.filter((m) => answers[m.id] != null && answers[m.id] !== m.correctAnswer).length;
  const skipped = total - attempted;
  const scorePercent = attempted ? Math.round((correct / attempted) * 100) : 0;
  const trend = useQuery({ queryKey: ['progress-trend'], queryFn: analyticsApi.progress });
  const verdict = progressVerdict(scorePercent, trend.data);
  const statusFor = (m: Mcq): 'correct' | 'wrong' | 'skipped' => {
    const a = answers[m.id];
    if (a == null) return 'skipped';
    return a === m.correctAnswer ? 'correct' : 'wrong';
  };
  const wrongMcqs = mcqs.filter((m) => statusFor(m) === 'wrong');
  const statusStyles: Record<'correct' | 'wrong' | 'skipped', string> = {
    correct: 'border-[#d7eee4] bg-[#f3fbf7]',
    wrong: 'border-[#f0d3cc] bg-[#fff6f3]',
    skipped: 'border-border bg-muted/30',
  };
  const statusBadge: Record<'correct' | 'wrong' | 'skipped', { tone: 'green' | 'red' | 'neutral'; label: string }> = {
    correct: { tone: 'green', label: 'Correct' },
    wrong: { tone: 'red', label: 'Wrong' },
    skipped: { tone: 'neutral', label: 'Skipped' },
  };
  return <div data-testid="card-practice-result">
    <div className="mx-auto max-w-lg rounded-3xl border border-border bg-card p-8 text-center">
      <div className={cn('mx-auto grid size-16 place-items-center rounded-full', verdict.tone === 'down' ? 'bg-destructive/10 text-destructive' : 'bg-[#d7eee4] text-[#164b4b]')}>{verdict.tone === 'down' ? <RotateCcw size={26} /> : <CheckCircle2 size={28} />}</div>
      <div className="mt-5 font-display text-5xl">{scorePercent}%</div>
      <div className="mt-1 text-xs text-muted-foreground">{correct} correct of {attempted} attempted</div>
      <div className="mt-4 flex justify-center">{!trend.isLoading && <ProgressBadge tone={verdict.tone} label={verdict.label} />}</div>
      {!trend.isLoading && <p className="mx-auto mt-3 max-w-sm text-xs leading-5 text-muted-foreground" data-testid="text-result-verdict">{verdict.message}</p>}
      {/* Attempted / Skipped / Correct / Wrong breakdown — the counts a
          student needs at a glance, distinct from the score % above (which
          is correct-of-attempted, not correct-of-total). */}
      <div className="mt-6 grid grid-cols-4 gap-2 text-center">
        <div className="rounded-xl bg-muted/40 py-3"><div className="font-display text-lg" data-testid="text-result-attempted">{attempted}</div><div className="text-[10px] font-bold text-muted-foreground">Attempted</div></div>
        <div className="rounded-xl bg-[#f3fbf7] py-3"><div className="font-display text-lg text-[#164b4b]" data-testid="text-result-correct">{correct}</div><div className="text-[10px] font-bold text-muted-foreground">Correct</div></div>
        <div className="rounded-xl bg-[#fff6f3] py-3"><div className="font-display text-lg text-[#a34c3e]" data-testid="text-result-wrong">{wrong}</div><div className="text-[10px] font-bold text-muted-foreground">Wrong</div></div>
        <div className="rounded-xl bg-muted/40 py-3"><div className="font-display text-lg" data-testid="text-result-skipped">{skipped}</div><div className="text-[10px] font-bold text-muted-foreground">Skipped</div></div>
      </div>
      {onRedoWrong && wrongMcqs.length > 0 && <button type="button" onClick={() => onRedoWrong(wrongMcqs)} className="redo3d mt-7" data-testid="button-redo-wrong">
        <span className="redo3d__face"><span className="redo3d__icon"><RotateCcw size={20} strokeWidth={2.6} /></span><span className="redo3d__text"><span className="redo3d__title">Redo wrong answers</span><span className="redo3d__sub">{wrongMcqs.length === 1 ? '1 question to fix' : `${wrongMcqs.length} questions to fix`}</span></span></span>
      </button>}
      <div className="mt-4 flex flex-wrap justify-center gap-2"><button onClick={onRestart} className="rounded-xl bg-primary px-5 py-2.5 text-xs font-extrabold text-primary-foreground" data-testid="button-practice-again"><RotateCcw size={13} className="mr-1.5 inline" /> Practice again</button><Link href={backHref} className="rounded-xl border border-border bg-card px-5 py-2.5 text-xs font-bold" data-testid="link-result-back">{backLabel}</Link></div>
    </div>
    <ResultInsights mcqs={mcqs} answers={answers} />

    {/* Every question with its outcome, in original order. */}
    {total > 0 && <div className="mx-auto mt-8 max-w-3xl">
      <h3 className="text-sm font-extrabold">All questions</h3>
      <div className="mt-3 space-y-2.5">{mcqs.map((m, i) => { const status = statusFor(m); const badge = statusBadge[status]; return <div key={m.id} className={cn('rounded-2xl border p-4', statusStyles[status])} data-testid={`row-result-question-${i}`}>
        <div className="flex items-start justify-between gap-3"><div className="text-xs font-bold text-muted-foreground">Q{i + 1}</div><Badge tone={badge.tone}>{badge.label}</Badge></div>
        <p className="mt-1 text-sm font-bold leading-5">{m.question}</p>
        {status !== 'skipped' && <div className="mt-2 text-xs">
          <span className={cn('font-bold', status === 'correct' ? 'text-[#287058]' : 'text-[#a34c3e]')}>Your answer: {answers[m.id]}</span>
          {status === 'wrong' && m.correctAnswer && <span className="ml-3 font-bold text-[#287058]">Correct answer: {m.correctAnswer}</span>}
        </div>}
        {status === 'skipped' && m.correctAnswer && <div className="mt-2 text-xs font-bold text-muted-foreground">Correct answer: {m.correctAnswer}</div>}
      </div>; })}</div>
    </div>}

    {/* Wrong questions again, on their own, at the very end — a quick
        review list without needing to scroll back through everything. */}
    {!!wrongMcqs.length && <div className="mx-auto mt-8 max-w-3xl">
      <h3 className="text-sm font-extrabold text-[#a34c3e]">Review wrong answers ({wrongMcqs.length})</h3>
      <div className="mt-3 space-y-2.5">{wrongMcqs.map((m, i) => <div key={m.id} className="rounded-2xl border border-[#f0d3cc] bg-[#fff6f3] p-4" data-testid={`row-review-wrong-${i}`}>
        <p className="text-sm font-bold leading-5">{m.question}</p>
        <div className="mt-2 text-xs"><span className="font-bold text-[#a34c3e]">Your answer: {answers[m.id]}</span>{m.correctAnswer && <span className="ml-3 font-bold text-[#287058]">Correct answer: {m.correctAnswer}</span>}</div>
        {/* Per-option breakdown when the question has one (same pattern as
            ExamResult.tsx's review) — this used to only show the single
            whole-question m.explanation and silently dropped
            m.optionExplanations even though it's on the same object. */}
        {m.optionExplanations?.some((e) => e?.trim())
          ? <div className="mt-2 space-y-1.5">{m.options.map((opt, oi) => { const optExplanation = m.optionExplanations?.[oi]; const isCorrectOpt = opt === m.correctAnswer; return <div key={opt} className={cn('rounded-lg px-2.5 py-1.5 text-[11px]', isCorrectOpt ? 'bg-[#e6f3ed]' : opt === answers[m.id] ? 'bg-white/70' : 'bg-muted/30')}><div className={cn('font-bold', isCorrectOpt ? 'text-[#287058]' : 'text-muted-foreground')}>{String.fromCharCode(65 + oi)}. {opt}{isCorrectOpt ? ' (correct)' : ''}</div>{optExplanation && <div className="mt-0.5 leading-5 text-muted-foreground">{optExplanation}</div>}</div>; })}</div>
          : m.explanation && <p className="mt-2 text-[11px] leading-5 text-muted-foreground">{m.explanation}</p>}
      </div>)}</div>
    </div>}
  </div>;
}
