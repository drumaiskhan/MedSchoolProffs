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

import { CopyRow } from './auth';
import { Badge, cn } from './ui';


export function PaymentDestinationCard({ pd }: { pd?: PaymentDetails }) {
  const accounts = pd?.bankAccounts?.length ? pd.bankAccounts : (pd?.PAYMENT_ACCOUNT_HOLDER || pd?.PAYMENT_BANK_NAME || pd?.PAYMENT_ACCOUNT_NUMBER)
    ? [{ id: 'legacy', label: 'Bank account', accountHolder: pd.PAYMENT_ACCOUNT_HOLDER, bankName: pd.PAYMENT_BANK_NAME, accountNumber: pd.PAYMENT_ACCOUNT_NUMBER, ifsc: pd.PAYMENT_IFSC_OR_ROUTING, branch: '', isPrimary: true }]
    : [];
  const methods = (pd?.methods || []).filter((m) => m.enabled);
  // Selectable destinations: the primary/each bank account, plus each
  // enabled non-bank method (wallets, cash). "Bank Transfer" as a method
  // entry is skipped here since the actual bank accounts already cover it.
  type Destination = { key: string; label: string; icon: 'bank' | 'wallet' | 'cash'; account?: (typeof accounts)[number]; method?: PaymentMethodConfig };
  const destinations: Destination[] = [
    ...accounts.map((a) => ({ key: `bank_${a.id}`, label: a.label || a.bankName || 'Bank account', icon: 'bank' as const, account: a })),
     ...methods.filter((m) => m.type !== 'bank').map((m) => ({ key: `method_${m.key}`, label: m.label, icon: m.type === 'wallet' ? ('wallet' as const) : ('cash' as const), method: m })),
  ];
  const primaryIndex = Math.max(0, destinations.findIndex((d) => d.account?.isPrimary));
  const [selectedKey, setSelectedKey] = useState<string | null>(null);
  useEffect(() => { if (!selectedKey && destinations.length) setSelectedKey(destinations[primaryIndex]?.key ?? destinations[0].key); }, [destinations.length]); // eslint-disable-line react-hooks/exhaustive-deps
  if (!pd) return null;
  const hasAnything = destinations.length || pd.PAYMENT_UPI_ID || pd.PAYMENT_RAAST_ID || pd.PAYMENT_WALLET_NUMBER;
  if (!hasAnything) return null;
  const selected = destinations.find((d) => d.key === selectedKey) ?? destinations[0];

  return <div className="rounded-2xl border border-border bg-muted p-4"><div className="mb-3 flex items-center gap-1.5 text-xs font-extrabold"><Landmark size={14} /> Where to send payment</div>
    {pd.PAYMENT_INSTRUCTIONS && <p className="mb-3 text-[11px] leading-5 text-muted-foreground">{pd.PAYMENT_INSTRUCTIONS}</p>}
    {destinations.length > 1 && <div className="mb-3 flex flex-wrap gap-1.5" role="radiogroup" aria-label="Payment method">{destinations.map((d) => <button key={d.key} type="button" onClick={() => setSelectedKey(d.key)} className={cn('inline-flex items-center gap-1.5 rounded-lg px-3 py-1.5 text-[11px] font-bold', selectedKey === d.key ? 'bg-primary text-primary-foreground' : 'border border-border bg-card text-muted-foreground')} data-testid={`button-select-payment-method-${d.key}`}>{d.icon === 'bank' ? <Landmark size={12} /> : d.icon === 'wallet' ? <Smartphone size={12} /> : <CreditCard size={12} />}{d.label}</button>)}</div>}
    {selected?.account && <div className="rounded-xl bg-card p-3">
      {selected.account.isPrimary && destinations.length > 1 && <div className="mb-1.5"><span className="rounded-full bg-[#d7eee4] px-1.5 py-0.5 text-[9px] font-bold text-[#164b4b]">Primary</span></div>}
      <div className="grid gap-1.5 sm:grid-cols-2">
        {selected.account.accountHolder && <CopyRow label="Account holder" value={selected.account.accountHolder} />}
        {selected.account.bankName && <CopyRow label="Bank" value={selected.account.bankName} />}
        {selected.account.accountNumber && <CopyRow label="Account number" value={selected.account.accountNumber} />}
        {selected.account.ifsc && <CopyRow label="IFSC / routing" value={selected.account.ifsc} />}
      </div>
    </div>}
    {selected?.method && <div className="rounded-xl bg-card p-3">
      <div className="grid gap-1.5 sm:grid-cols-2">
        {selected.method.accountNumber && <CopyRow label={`${selected.method.label} number`} value={selected.method.accountNumber} />}
        {selected.method.accountName && <CopyRow label="Account name" value={selected.method.accountName} />}
      </div>
      {selected.method.instructions && <p className="mt-2 text-[11px] leading-5 text-muted-foreground">{selected.method.instructions}</p>}
    </div>}
    {!destinations.length && (pd.PAYMENT_UPI_ID || pd.PAYMENT_RAAST_ID || pd.PAYMENT_WALLET_NUMBER) && <div className="grid gap-1.5 sm:grid-cols-2">
      {pd.PAYMENT_UPI_ID && <CopyRow label="UPI ID" value={pd.PAYMENT_UPI_ID} />}
      {pd.PAYMENT_RAAST_ID && <CopyRow label="Raast ID" value={pd.PAYMENT_RAAST_ID} />}
      {pd.PAYMENT_WALLET_NUMBER && <CopyRow label={pd.PAYMENT_WALLET_PROVIDER || 'Wallet'} value={pd.PAYMENT_WALLET_NUMBER} />}
    </div>}
    {pd.PAYMENT_QR_CODE_URL && <div className="mt-3 flex justify-center border-t border-border pt-3"><img src={pd.PAYMENT_QR_CODE_URL} alt="Payment QR code" loading="lazy" decoding="async" className="max-h-32 rounded-lg border border-border object-contain" /></div>}
  </div>;
}

export function SubscriptionStatusCard({ plans, payments }: { plans: MembershipPlan[]; payments: { planName: string; status: string; submittedAt: string }[] }) {
  const dashboard = useGetStudentDashboard();
  const d = dashboard.data;
  const isActive = d?.membershipStatus === 'ACTIVE';
  const daysRemaining = d?.membershipExpiry ? Math.max(0, Math.ceil((new Date(d.membershipExpiry).getTime() - Date.now()) / 86400000)) : null;
  const latestPending = payments.find((p) => p.status === 'pending');
  const currentPlanName = payments.find((p) => p.status === 'approved')?.planName;
  const expiringSoon = isActive && daysRemaining !== null && daysRemaining <= 7;

  return <div className={cn('rounded-2xl border p-6', isActive ? (expiringSoon ? 'border-[#e5a952] bg-[#fdf6e8]' : 'border-primary/30 bg-[#eef7f1]') : 'border-border bg-card')} data-testid="card-subscription-status">
    <div className="flex flex-wrap items-center justify-between gap-4"><div className="flex items-center gap-3"><div className={cn('grid size-11 place-items-center rounded-xl', isActive ? 'bg-primary text-primary-foreground' : 'bg-muted text-muted-foreground')}><ShieldCheck size={19} /></div><div><div className="flex items-center gap-2 text-sm font-extrabold">{isActive ? 'Active subscription' : latestPending ? 'Payment under review' : 'No active subscription'}<Badge tone={isActive ? (expiringSoon ? 'amber' : 'green') : latestPending ? 'amber' : 'neutral'}>{isActive ? (expiringSoon ? 'expiring soon' : 'live') : latestPending ? 'pending review' : 'inactive'}</Badge></div><p className="mt-1 text-xs text-muted-foreground">{currentPlanName ? `${currentPlanName} plan` : 'No plan on record'}{isActive && d?.membershipExpiry ? ` · renews ${new Date(d.membershipExpiry).toLocaleDateString()}` : ''}</p></div></div>
      <div className="text-right"><div className="font-display text-3xl">{isActive && daysRemaining !== null ? daysRemaining : '—'}</div><div className="text-[10px] font-bold uppercase tracking-wide text-muted-foreground">{isActive ? 'days remaining' : latestPending ? 'awaiting approval' : 'get started below'}</div></div>
    </div>
  </div>;
}
