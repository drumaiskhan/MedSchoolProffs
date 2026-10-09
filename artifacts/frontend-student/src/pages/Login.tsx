// Auto-extracted route page — code-split via React.lazy() in App.tsx.
import {
  type ReactNode,
  type ComponentProps,
  type TouchEvent,
  useState,
  useEffect,
  useRef,
  createContext,
  useContext,
} from 'react';

import {
  QueryClient,
  QueryClientProvider,
  useMutation,
  useQuery,
  useQueryClient,
} from '@tanstack/react-query';

import {
  Link,
  Route,
  Switch,
  useLocation,
  useParams,
  useSearch,
  Router as WouterRouter,
} from 'wouter';

import {
  ArrowLeft,
  ArrowRight,
  BookOpen,
  Check,
  CheckCircle2,
  ChevronRight,
  CircleHelp,
  Clock3,
  CreditCard,
  FileText,
  Flame,
  FolderOpen,
  LayoutDashboard,
  Library,
  LockKeyhole,
  LogOut,
  Menu,
  MoreHorizontal,
  Pencil,
  Plus,
  ReceiptText,
  Search,
  Settings,
  ShieldCheck,
  Sparkles,
  Stethoscope,
  Target,
  Trash2,
  TrendingUp,
  TrendingDown,
  Minus,
  Users,
  X,
  Zap,
  Bell,
  SlidersHorizontal,
  FileStack,
  NotebookPen,
  Bookmark,
  Flag,
  Trophy,
  MessageSquare,
  Landmark,
  Copy,
  QrCode,
  User as UserIcon,
  Mail,
  Phone,
  Hash,
  GraduationCap,
  Eye,
  EyeOff,
  Smartphone,
  UploadCloud,
  ImageOff,
  RotateCcw,
  ThumbsUp,
  ThumbsDown,
  CheckCheck,
  ClipboardCheck,
  AlertTriangle,
  Link2 as LinkIcon,
  Lightbulb,
  LayoutGrid,
  Presentation,
  Wand2,
  Crown,
  Globe,
  Star,
  Activity,
} from 'lucide-react';

import { applyThemeVars } from '@/lib/theme';

import {
  getListMembershipPlansQueryKey,
  getListPaymentsQueryKey,
  getListMcqsQueryKey,
  getListModulesQueryKey,
  getListStudentsQueryKey,
  getListNotificationsQueryKey,
  getGetCurrentUserQueryKey,
  useApprovePayment,
  useCreateMembershipPlan,
  useCreateMcq,
  useCreateModule,
  useGetAdminDashboard,
  useGetCurrentUser,
  useGetStudentDashboard,
  useListFlashcards,
  useListMembershipPlans,
  useListMcqs,
  useListModules,
  useListNotifications,
  useListPayments,
  useListResources,
  useListStudents,
  useListSubjects,
  useListTopics,
  useRejectPayment,
  useSubmitPayment,
  useUpdateMembershipPlan,
} from '@workspace/api-client-react';

import type {
  AdminDashboard,
  Flashcard,
  Mcq,
  MembershipPlan,
  Module,
  Notification,
  Payment,
  Resource,
  Student,
  Subject,
  Topic,
  User,
} from '@workspace/api-client-react';

import { ErrorBoundary } from '@/components/error-boundary';
import { Toaster } from '@/components/ui/toaster';
import { toast } from '@/hooks/use-toast';
import { useIsMobile } from '@/hooks/use-mobile';
import { TooltipProvider } from '@/components/ui/tooltip';
import NotFound from '@/pages/not-found';

import {
  authApi,
  academicApi,
  settingsApi,
  uploadFile,
  resolveUploadUrl,
  ApiRequestError,
  publicApi,
  pastPapersApi,
  notebookApi,
  savedSessionsApi,
  flaggedMcqsApi,
  feedbackApi,
  type MyFeedbackEntry,
  analyticsApi,
  type ProgressTrend,
  mcqImportApi,
  studentsAdminApi,
  paymentsAdminApi,
  membershipPlansAdminApi,
  mcqAdminApi,
  notificationsApi,
  siteContentApi,
  teamApi,
  moduleAdminApi,
  blocksApi,
  type Block,
  examsAdminApi,
  examsApi,
  explanationsApi,
  booksApi,
  type AdminBookStudent,
  DEFAULT_IMPORT_PATTERNS,
  STUDENT_STATUSES,
  type Institution,
  type Program,
  type AcademicYear,
  type Batch,
  type PastPaper,
  type NotebookEntry,
  type SavedSession,
  type FlaggedMcq,
  type FeedbackEntry,
  type McqCandidate,
  type StudentDetail,
  type SiteContent,
  type TeamMember,
  TEAM_CATEGORIES,
  TEAM_CATEGORY_LABELS,
  type AdminModule,
  type AdminExam,
  type StudentExam,
  type ExamAttemptRow,
  type ExamStartResponse,
  type ExamResult,
  type Exam,
  type ExplanationStatus,
  type PaymentDetails,
  type PaymentMethodConfig,
  aiVisualizerApi,
  type VisualizationSpec,
  LeaderboardRow,
} from '@/lib/api';

import {
  VisualizationRenderer,
  isStepBased,
} from '@/components/visualizer/VisualizationRenderer';

import { StepControls } from '@/components/visualizer/StepControls';
import { ExplanationPanel } from '@/components/visualizer/ExplanationPanel';

import { AuthLayout, AuthField, AuthPassword, BrandSpinner } from '@/lib/shared';
import { queryClient } from '@/lib/query-client';

// Android/Capacitor authentication.
// This is a no-op on the normal website.
import {
  isNativeApp,
  setNativeAuthToken,
} from '@/lib/native-auth';
import { markSession } from '@/lib/session-persistence';

function Login() {
  const [, setLocation] = useLocation();

  const [error, setError] = useState<string | null>(null);
  // Bumped on every failed attempt so the error banner remounts and shakes again.
  const [errorTick, setErrorTick] = useState(0);
  const [unverifiedEmail, setUnverifiedEmail] = useState<string | null>(null);
  const [resendDone, setResendDone] = useState(false);
  // "Remember me": ticked = stay signed in; unticked = signed out when the app is closed.
  const [remember, setRemember] = useState(true);

  const login = useMutation({
    mutationFn: authApi.login,

    onSuccess: async (res, vars) => {
      const keep = vars.rememberMe !== false;
      markSession(keep);

      // Native Android/iOS app:
      // persist the JWT before loading authenticated pages.
      if (isNativeApp()) {
        try {
          await setNativeAuthToken(res.token, keep);
        } catch (err) {
          console.warn('Could not persist native auth token:', err);
        }
      }

      await queryClient.invalidateQueries();

      setLocation('/dashboard');
    },

    onError: (err: unknown, vars) => {
      setResendDone(false);
      setErrorTick((n) => n + 1);

      if (err instanceof ApiRequestError) {
        setError(err.message);

        const code = (err.data as { code?: string } | null)?.code;

        setUnverifiedEmail(
          code === 'EMAIL_NOT_VERIFIED'
            ? vars.email
            : null
        );
      } else {
        // Temporarily expose the real Android/network/runtime error
        // instead of hiding it behind the generic message.
        const message =
          err instanceof Error
            ? `${err.name}: ${err.message}`
            : `Unknown login error: ${String(err)}`;

        console.error('Login failed:', err);

        setError(message);
        setUnverifiedEmail(null);
      }
    },
  });

  const resend = useMutation({
    mutationFn: (email: string) =>
      authApi.resendVerification(email),

    onSuccess: () => setResendDone(true),
  });

  return (
    <AuthLayout>
      <h1 className="au-title">Welcome back</h1>
      <p className="au-sub">Sign in to pick up your practice where you left it.</p>

      <form
        onSubmit={(e) => {
          e.preventDefault();
          setError(null);
          setUnverifiedEmail(null);

          const f = new FormData(e.currentTarget);

          login.mutate({
            email: String(f.get('email')).trim(),
            password: String(f.get('password')),
            rememberMe: remember,
          });
        }}
        className="mt-7"
      >
        <AuthField
          label="Email"
          icon={Mail}
          required
          name="email"
          type="email"
          inputMode="email"
          autoComplete="email"
          autoCapitalize="none"
          autoCorrect="off"
          spellCheck={false}
          placeholder="you@college.edu"
          data-testid="input-login-email"
        />

        <AuthPassword
          required
          name="password"
          autoComplete="current-password"
          placeholder="Your password"
          labelAside={
            <Link
              href="/forgot-password"
              className="au-link"
              data-testid="button-forgot-password"
            >
              Forgot password?
            </Link>
          }
          toggleTestId="button-toggle-login-password"
          data-testid="input-login-password"
        />

        <label className="au-remember" data-testid="label-remember-me">
          <input
            type="checkbox"
            checked={remember}
            onChange={(e) => setRemember(e.target.checked)}
            data-testid="checkbox-remember-me"
          />
          <span>
            Remember me
            <small>
              {remember
                ? 'Stay signed in on this device.'
                : 'You’ll be signed out when you close the app.'}
            </small>
          </span>
        </label>

        {error && (
          <div
            key={errorTick}
            className="au-alert is-shaking mt-4"
            role="alert"
            data-testid="text-login-error"
          >
            <AlertTriangle size={16} />

            <div>
              {error}

              {unverifiedEmail && (
                <div className="mt-1.5">
                  {resendDone ? (
                    <span className="font-bold text-primary">
                      Verification email sent — check your inbox.
                    </span>
                  ) : (
                    <button
                      type="button"
                      onClick={() => resend.mutate(unverifiedEmail)}
                      disabled={resend.isPending}
                      data-testid="button-resend-verification"
                    >
                      {resend.isPending
                        ? 'Sending…'
                        : 'Resend verification email'}
                    </button>
                  )}
                </div>
              )}
            </div>
          </div>
        )}

        <button
          disabled={login.isPending}
          className="au-btn mt-5"
          data-testid="button-login-submit"
        >
          {login.isPending ? (
            <>
              <BrandSpinner size={20} /> Signing in…
            </>
          ) : (
            <>
              Sign in <ArrowRight size={16} className="au-btn__go" />
            </>
          )}
        </button>
      </form>

      <div className="au-or">New to MedschoolProffs?</div>

      <Link
        href="/register"
        className="au-btn au-btn--ghost"
        data-testid="link-register"
      >
        Create a student account
      </Link>
    </AuthLayout>
  );
}

export default Login;
