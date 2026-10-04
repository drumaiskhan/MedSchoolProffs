import { type ReactNode, type ComponentProps, useState, useEffect, lazy, Suspense } from 'react';
import { QueryClient, QueryClientProvider, useMutation, useQuery } from '@tanstack/react-query';
import { Link, Route, Switch, useLocation, useSearch, useParams, Router as WouterRouter } from 'wouter';
import {ArrowLeft, ArrowRight, BookOpen, Check, CheckCircle2, ChevronRight, ChevronUp, ChevronDown, CircleHelp, Clock3, CreditCard, FileText, Flame, FolderOpen, LayoutDashboard, Library, LockKeyhole, LogOut, Menu, MoreHorizontal, Pencil, Plus, ReceiptText, Search, Settings, ShieldCheck, Sparkles, Stethoscope, Target, Trash2, TrendingUp, Users, X, Zap, Bell, SlidersHorizontal, FileStack, NotebookPen, Bookmark, Flag, Trophy, MessageSquare, Landmark, Copy, QrCode, User as UserIcon, Mail, Phone, Hash, GraduationCap, CalendarDays, Eye, EyeOff, Smartphone, UploadCloud, ImageOff, RotateCcw, ThumbsUp, ThumbsDown, CheckCheck, ClipboardCheck, AlertTriangle, Wand2, Activity, Layers, BarChart3, ToggleLeft, Download, Database, Loader2} from 'lucide-react';
import { applyThemeVars, DEFAULT_THEME, readableForegroundHsl } from '@/lib/theme';
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
import { authApi, academicApi, settingsApi, uploadFile, resolveUploadUrl, ApiRequestError, publicApi, pastPapersApi, notebookApi, savedSessionsApi, flaggedMcqsApi, feedbackApi, analyticsApi, mcqImportApi, flashcardImportApi, mcqBackupApi, studentsAdminApi, paymentsAdminApi, membershipPlansAdminApi, mcqAdminApi, subjectAdminApi, topicAdminApi, flashcardsAdminApi, flashcardsAiApi, booksAdminApi, notificationsApi, siteContentApi, teamApi, moduleAdminApi, blockAdminApi, examsAdminApi, examsApi, explanationsApi, auditApi, DEFAULT_IMPORT_PATTERNS, STUDENT_STATUSES, type Institution, type Program, type AcademicYear, type Batch, type PastPaper, type NotebookEntry, type SavedSession, type FlaggedMcq, type FeedbackEntry, type McqCandidate, type FlashcardCandidate, type StudentDetail, type SiteContent, type TeamMember, TEAM_CATEGORIES, TEAM_CATEGORY_LABELS, type TeamCategory, type AdminModule, type AdminBlock, type AdminSubject, type AdminTopic, type AdminFlashcard, type GeneratedFlashcard, type AdminMcqRow, type AdminBook, type AdminExam, type StudentExam, type ExamAttemptRow, type ExamStartResponse, type ExamResult, type Exam, type ExplanationStatus, type BankAccount, type PaymentMethodConfig, aiVisualizerAdminApi, type AiVisualizerLogEntry, type AuditLogEntry } from '@/lib/api';
import './index.css';
import { Shell, SkeletonPage, BrandedLoadingScreen, useFaviconSync, useThemeSync } from '@/lib/shared';
import { queryClient } from '@/lib/query-client';
import { pageLoaders, startPrefetching } from '@/lib/routes';

// Round 3, item 10 (performance) — same over-fetching fix as the student
// app (see its App.tsx for the full rationale): `new QueryClient()` with no
// options refetched on every mount and every window refocus. Admin
// mutations already call invalidateQueries on the specific keys they
// change, so edits still show up immediately — this only avoids redundant
// background refetches of data nothing has touched.
// NOTE (perf pass): App.tsx used to define every admin page inline
// (3500+ lines in one chunk). Pages now live under src/pages/ and are
// code-split with React.lazy — only the current route's chunk is
// fetched. Shared chrome (Shell, SideNav, tree components, helper
// hooks) lives in src/lib/shared.tsx and stays in the main bundle
// since nearly every admin route needs it anyway.

// Route-level code splitting: each admin page ships as its own chunk and
// is only fetched when that route is actually visited.
const Login = lazy(pageLoaders.Login);
const AdminSignup = lazy(pageLoaders.AdminSignup);
const ForgotPassword = lazy(pageLoaders.ForgotPassword);
const ResetPassword = lazy(pageLoaders.ResetPassword);
const VerifyEmail = lazy(pageLoaders.VerifyEmail);
const Notifications = lazy(pageLoaders.Notifications);
const Profile = lazy(pageLoaders.Profile);
const AdminOverview = lazy(pageLoaders.AdminOverview);
const AdminStudents = lazy(pageLoaders.AdminStudents);
const AdminPaymentsHub = lazy(pageLoaders.AdminPaymentsHub);
const AdminPlans = lazy(pageLoaders.AdminPlans);
const AdminAcademicStructure = lazy(pageLoaders.AdminAcademicStructure);
const AdminContent = lazy(pageLoaders.AdminContent);
const AdminSubjectsPage = lazy(pageLoaders.AdminSubjectsPage);
const AdminTopicsPage = lazy(pageLoaders.AdminTopicsPage);
const AdminQualityCenter = lazy(pageLoaders.AdminQualityCenter);
const AdminMcqs = lazy(pageLoaders.AdminMcqs);
const AdminFlashcards = lazy(pageLoaders.AdminFlashcards);
const AdminBooks = lazy(pageLoaders.AdminBooks);
const AdminBookPurchases = lazy(pageLoaders.AdminBookPurchases);
const AdminCoupons = lazy(pageLoaders.AdminCoupons);
const AdminPastPapers = lazy(pageLoaders.AdminPastPapers);
const AdminExams = lazy(pageLoaders.AdminExams);
const AdminOspeOsce = lazy(pageLoaders.AdminOspeOsce);
const AdminFeedback = lazy(pageLoaders.AdminFeedback);
const AdminAiVisualizerLogs = lazy(pageLoaders.AdminAiVisualizerLogs);
const AdminSiteContent = lazy(pageLoaders.AdminSiteContent);
const AdminTeam = lazy(pageLoaders.AdminTeam);
const AdminSettings = lazy(pageLoaders.AdminSettings);
const AdminDatabaseBackup = lazy(pageLoaders.AdminDatabaseBackup);

function AppRoutes() {
 useFaviconSync();
 useThemeSync();
 // See matching comment in frontend-student/src/App.tsx — SkeletonPage
 // has no header/sidebar of its own, so as a route-level Suspense
 // fallback it rendered as bare skeleton blocks on a blank white page.
 // BrandedLoadingScreen matches the initial boot / session-restore loader.
 return <Suspense fallback={<BrandedLoadingScreen />}><Switch><Route path="/login" component={Login} /><Route path="/admin/login" component={Login} /><Route path="/admin-signup/1" component={AdminSignup} /><Route path="/forgot-password" component={ForgotPassword} /><Route path="/reset-password" component={ResetPassword} /><Route path="/verify-email" component={VerifyEmail} /><Route path="/notifications"><Shell><Notifications /></Shell></Route><Route path="/profile"><Shell><Profile /></Shell></Route><Route path="/"><Shell><AdminOverview /></Shell></Route><Route path="/admin"><Shell><AdminOverview /></Shell></Route><Route path="/admin/students"><Shell><AdminStudents /></Shell></Route><Route path="/admin/payments"><Shell><AdminPaymentsHub initialTab="Proof Review" /></Shell></Route><Route path="/admin/plans"><Shell><AdminPlans /></Shell></Route><Route path="/admin/coupons"><Shell><AdminCoupons /></Shell></Route><Route path="/admin/payment-details"><Shell><AdminPaymentsHub initialTab="Collection Details" /></Shell></Route><Route path="/admin/academic-structure"><Shell><AdminAcademicStructure /></Shell></Route><Route path="/admin/content"><Shell><AdminContent /></Shell></Route><Route path="/admin/subjects"><Shell><AdminSubjectsPage /></Shell></Route><Route path="/admin/topics"><Shell><AdminTopicsPage /></Shell></Route><Route path="/admin/quality"><Shell><AdminQualityCenter /></Shell></Route><Route path="/admin/mcqs"><Shell><AdminMcqs /></Shell></Route><Route path="/admin/flashcards"><Shell><AdminFlashcards /></Shell></Route><Route path="/admin/books"><Shell><AdminBooks /></Shell></Route><Route path="/admin/book-purchases"><Shell><AdminBookPurchases /></Shell></Route><Route path="/admin/past-papers"><Shell><AdminPastPapers /></Shell></Route><Route path="/admin/exams"><Shell><AdminExams /></Shell></Route><Route path="/admin/ospe-osce"><Shell><AdminOspeOsce /></Shell></Route><Route path="/admin/feedback"><Shell><AdminFeedback /></Shell></Route><Route path="/admin/ai-visualizer-logs"><Shell><AdminAiVisualizerLogs /></Shell></Route><Route path="/admin/site-content"><Shell><AdminSiteContent /></Shell></Route><Route path="/admin/team"><Shell><AdminTeam /></Shell></Route><Route path="/admin/settings"><Shell><AdminSettings /></Shell></Route><Route path="/admin/database-backup"><Shell><AdminDatabaseBackup /></Shell></Route><Route component={NotFound} /></Switch></Suspense>; }
function App() { useEffect(() => { startPrefetching(); }, []); return <QueryClientProvider client={queryClient}><TooltipProvider><WouterRouter base={import.meta.env.BASE_URL.replace(/\/$/, '')}><ErrorBoundary><AppRoutes /></ErrorBoundary></WouterRouter><Toaster /></TooltipProvider></QueryClientProvider>; }

export default App;
