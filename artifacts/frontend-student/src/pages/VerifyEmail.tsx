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
import { VisualizationRenderer, isStepBased } from '@/components/visualizer/VisualizationRenderer';
import { StepControls } from '@/components/visualizer/StepControls';
import { ExplanationPanel } from '@/components/visualizer/ExplanationPanel';

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
import { AuthLayout, AuthField, BrandSpinner, IconField } from '@/lib/shared';

function VerifyEmail() {
  const initialEmail = new URLSearchParams(window.location.search).get('email') || '';
  const [email, setEmail] = useState(initialEmail);
  const [otp, setOtp] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [resent, setResent] = useState(false);
  const [done, setDone] = useState(false);

  const verify = useMutation({
    mutationFn: () => authApi.verifyOtp(email.trim().toLowerCase(), otp.trim()),
    onSuccess: () => setDone(true),
    onError: (err: unknown) => setError(err instanceof ApiRequestError ? err.message : 'Something went wrong. Please try again.'),
  });
  const resend = useMutation({
    mutationFn: () => authApi.resendVerification(email.trim().toLowerCase()),
    onSuccess: () => { setResent(true); setError(null); },
    onError: (err: unknown) => setError(err instanceof ApiRequestError ? err.message : 'Could not resend the code. Please try again.'),
  });

  if (done) return <AuthLayout><div className="au-success"><div className="au-success__badge"><svg width="28" height="28" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true"><path d="M5 12.5l4.5 4.5L19 7.5" /></svg></div><h1 className="au-title">Email verified</h1><p className="au-sub">You can now sign in.</p><Link href="/login" className="au-btn mt-7" data-testid="link-verify-login">Go to sign in <ArrowRight size={16} className="au-btn__go" /></Link></div></AuthLayout>;

  return <AuthLayout>
    <h1 className="au-title">Enter your code</h1>
    <p className="au-sub">We emailed a 6-digit verification code to your address. Enter it below to activate your account.</p>
    <form onSubmit={(e) => { e.preventDefault(); setError(null); verify.mutate(); }} className="mt-7">
      <AuthField label="Email" icon={Mail} required type="email" value={email} onChange={(e) => setEmail(e.target.value)} inputMode="email" autoComplete="email" autoCapitalize="none" autoCorrect="off" spellCheck={false} placeholder="you@college.edu" data-testid="input-verify-email" />
      <div className="au-field">
        <div className="au-label"><label htmlFor="verify-otp">Verification code</label></div>
        <input id="verify-otp" required maxLength={6} inputMode="numeric" autoComplete="one-time-code" value={otp} onChange={(e) => setOtp(e.target.value.replace(/[^0-9]/g, ''))} placeholder="000000" className="au-input au-input--plain" style={{ textAlign: 'center', fontSize: '1.5rem', fontWeight: 800, letterSpacing: '.5em', paddingLeft: '1.5rem' }} data-testid="input-verify-otp" />
      </div>
      {error && <div key={error} className="au-alert is-shaking mt-4" role="alert" data-testid="text-verify-error"><AlertTriangle size={16} /><div>{error}</div></div>}
      {resent && !error && <div className="au-ok mt-4">A new code is on its way.</div>}
      <button disabled={verify.isPending || !email || otp.length < 6} className="au-btn mt-5" data-testid="button-verify-submit">{verify.isPending ? <><BrandSpinner size={20} /> Verifying…</> : 'Verify email'}</button>
    </form>
    <p className="mt-6 text-center text-xs text-muted-foreground">Didn't get a code? <button type="button" onClick={() => resend.mutate()} disabled={resend.isPending || !email} className="au-link disabled:opacity-50" data-testid="button-resend-otp">{resend.isPending ? 'Sending…' : 'Resend code'}</button></p>
  </AuthLayout>;
}

// Row icon color cycles through the same --chart-1..5 palette used
// elsewhere (topicAccentStyles) so each subject/exam-board reads as a
// distinct color at a glance, matching the reference design's colored
// paper icons — deterministic per examBoard so the same subject always
// gets the same color rather than reshuffling on refetch.

export default VerifyEmail;
