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

import { Badge, ConfirmDialog, EmptyState, SkeletonPage, cn, money, paymentStatusLabel, paymentStatusTone } from './ui';
import { AdminImageUpload } from './misc';
import { CollapsibleGroup, groupByDegreeYear, studyYearToNumber } from './groups';


export function PaymentProofsTab() {
  const q = useListPayments();
  const [filter, setFilter] = useState('all');
  const FILTERS: Array<{ key: string; label: string }> = [{ key: 'all', label: 'all' }, { key: 'PAYMENT_PENDING_REVIEW', label: 'pending' }, { key: 'APPROVED', label: 'approved' }, { key: 'REJECTED', label: 'rejected' }, { key: 'VOIDED', label: 'voided' }];
  const approve = useApprovePayment();
  const reject = useRejectPayment();
  const [rejectingId, setRejectingId] = useState<number | null>(null);
  const [reason, setReason] = useState('');
  const [deletingId, setDeletingId] = useState<number | null>(null);
  const [approvingId, setApprovingId] = useState<number | null>(null);
  const removePaymentPermanent = useMutation({ mutationFn: paymentsAdminApi.removePermanent, onSuccess: () => { queryClient.invalidateQueries({ queryKey: getListPaymentsQueryKey() }); setDeletingId(null); }, onError: (err: unknown) => toast({ title: 'Could not delete payment', description: err instanceof ApiRequestError ? err.message : 'Something went wrong.', variant: 'destructive' }) });
  const payments = (q.data ?? []).filter((p) => filter === 'all' || p.status === filter);
  const doApprove = (p: Payment) => approve.mutate({ id: p.id }, { onSuccess: () => { queryClient.invalidateQueries({ queryKey: getListPaymentsQueryKey() }); setApprovingId(null); } });
  const approvingPayment = approvingId !== null ? payments.find((p) => p.id === approvingId) : undefined;
  const doReject = (p: Payment) => { if (!reason.trim()) return; reject.mutate({ id: p.id, data: { reason: reason.trim() } }, { onSuccess: () => { queryClient.invalidateQueries({ queryKey: getListPaymentsQueryKey() }); setRejectingId(null); setReason(''); } }); };
  const isImage = (url: string) => /\.(png|jpe?g|webp)$/i.test(url);

  // Grouped by Program (MBBS/BDS) then Academic year, the same
  // groupByDegreeYear + CollapsibleGroup pattern Books/Past papers/Exams
  // use — a submission with no program or year on file falls into
  // "Unspecified degree" / "No year set", same convention those pages use.
  // A payment already carries its own program/academicYear strings (set at
  // sign-up), so no extra lookup is needed — just a sort key so years order
  // 1st -> Final instead of alphabetically.
  const paymentDegree = (p: Payment) => p.program || '';
  const paymentYear = (p: Payment) => p.academicYear || '';
  const groups = groupByDegreeYear(payments, paymentDegree, paymentYear, (p) => studyYearToNumber(paymentDegree(p), paymentYear(p)));
  const pendingCount = (items: Payment[]) => items.filter((p) => p.status === 'PAYMENT_PENDING_REVIEW').length;

  const renderCard = (p: Payment) => <div key={p.id} className="rounded-2xl border border-border bg-card p-5" data-testid={`card-payment-review-${p.id}`}><div className="flex flex-col gap-4 md:flex-row md:items-start"><div className="grid size-11 shrink-0 place-items-center rounded-xl bg-accent/20 text-accent-text"><ReceiptText size={19} /></div><div className="min-w-0 flex-1"><div className="flex flex-wrap items-center gap-2"><span className="text-sm font-bold">{p.studentName}</span><Badge tone={paymentStatusTone(p.status)}>{paymentStatusLabel(p.status)}</Badge></div><div className="mt-1 text-xs text-muted-foreground">{p.institution} · {p.program} · {p.planName}</div><div className="mt-2 font-mono-app text-[10px] text-muted-foreground">{p.method} · {p.reference} · {p.paymentDate}</div></div><div className="flex items-center gap-4"><div className="text-right"><div className="font-display text-2xl">{money(p.amount, p.currency)}</div><div className="text-[10px] text-muted-foreground">Submitted {p.submittedAt.slice(0, 10)}</div></div><div className="flex gap-2">{p.status === 'PAYMENT_PENDING_REVIEW' && <><button onClick={() => setRejectingId(rejectingId === p.id ? null : p.id)} className="inline-flex items-center gap-1.5 rounded-xl border border-border px-3 py-2 text-[11px] font-bold text-destructive transition-transform hover:bg-destructive/10 active:scale-95" data-testid={`button-reject-payment-${p.id}`}><X size={14} /> Reject</button><button onClick={() => setApprovingId(p.id)} className="inline-flex items-center gap-1.5 rounded-xl bg-primary px-3 py-2 text-[11px] font-extrabold text-primary-foreground shadow-sm transition-transform hover:opacity-90 active:scale-95" data-testid={`button-approve-payment-${p.id}`}><CheckCircle2 size={14} /> Approve</button></>}<button onClick={() => setDeletingId(p.id)} className="grid size-9 place-items-center rounded-xl border border-border text-muted-foreground hover:bg-destructive/10 hover:text-destructive" data-testid={`button-delete-payment-${p.id}`}><Trash2 size={16} /></button></div></div></div>
    {p.proofPath && (() => { const url = resolveUploadUrl(p.proofPath)!; return <div className="mt-4 border-t border-border pt-4">{isImage(p.proofPath!) ? <a href={url} target="_blank" rel="noreferrer" data-testid={`link-proof-${p.id}`}><img src={url} alt="Payment proof" loading="lazy" decoding="async" className="max-h-64 rounded-xl border border-border object-contain" onError={(e) => { (e.currentTarget as HTMLImageElement).style.display = 'none'; const fallback = e.currentTarget.nextElementSibling as HTMLElement | null; if (fallback) fallback.style.display = 'flex'; }} /></a> : <a href={url} target="_blank" rel="noreferrer" className="inline-flex items-center gap-2 rounded-xl border border-border bg-muted px-3 py-2 text-xs font-bold" data-testid={`link-proof-${p.id}`}><FileText size={14} /> View payment proof</a>}{isImage(p.proofPath!) && <div style={{ display: 'none' }} className="hidden max-h-64 items-center gap-2 rounded-xl border border-dashed border-border bg-muted px-3 py-4 text-xs font-semibold text-muted-foreground"><FileText size={14} /> Couldn't load the proof image — <a href={url} target="_blank" rel="noreferrer" className="text-primary underline">open it directly</a> instead.</div>}</div>; })()}
    {rejectingId === p.id && <div className="mt-4 flex gap-2 border-t border-border pt-4"><input value={reason} onChange={(e) => setReason(e.target.value)} placeholder="Reason for rejection (shown to student)" className="h-9 flex-1 rounded-lg border border-border bg-background px-3 text-xs" data-testid={`input-reject-reason-${p.id}`} /><button onClick={() => doReject(p)} disabled={!reason.trim()} className="rounded-lg bg-destructive px-4 text-xs font-bold text-destructive-foreground disabled:opacity-50" data-testid={`button-confirm-reject-${p.id}`}>Confirm reject</button></div>}
  </div>;

  return <div><div className="mb-4 flex justify-end"><div className="flex rounded-xl border border-border bg-card p-1">{FILTERS.map((f) => <button key={f.key} onClick={() => setFilter(f.key)} className={cn('rounded-lg px-3 py-1.5 text-[11px] font-bold capitalize', filter === f.key && 'bg-muted text-primary')} data-testid={`button-payment-filter-${f.label}`}>{f.label}</button>)}</div></div>
    {q.isLoading ? <SkeletonPage /> : payments.length ? groups.map((g) => <CollapsibleGroup key={g.degree || 'unspecified'} defaultOpen icon={<GraduationCap size={14} />} title={g.degree === 'MBBS' || g.degree === 'BDS' ? `${g.degree} colleges` : 'Unspecified degree'} count={g.groups.reduce((sum, yg) => sum + yg.items.length, 0)} testId={`payments-degree-${g.degree || 'unspecified'}`}>
      {g.groups.map((yg) => <CollapsibleGroup key={yg.year || 'no-year'} defaultOpen={pendingCount(yg.items) > 0} title={yg.year ? [yg.year, (g.degree === 'MBBS' || g.degree === 'BDS') ? g.degree : ''].filter(Boolean).join(' ') : 'No year set'} count={yg.items.length} nested testId={`payments-year-${g.degree || 'unspecified'}-${yg.year || 'no-year'}`}>
        <div className="space-y-3">{yg.items.map(renderCard)}</div>
      </CollapsibleGroup>)}
    </CollapsibleGroup>) : <EmptyState icon={ReceiptText} title="Queue is clear" body="No payment submissions match this filter." />}
    {deletingId !== null && <ConfirmDialog title="Permanently delete this payment?" body="This erases the submission for good. If it already activated a membership, that membership itself is not revoked automatically." confirmLabel="Delete forever" onCancel={() => setDeletingId(null)} onConfirm={() => removePaymentPermanent.mutate(deletingId)} pending={removePaymentPermanent.isPending} />}
    {approvingPayment && <ConfirmDialog title="Approve this payment?" body={`This confirms ${money(approvingPayment.amount, approvingPayment.currency)} from ${approvingPayment.studentName} for ${approvingPayment.planName} and activates their membership.`} confirmLabel="Approve payment" pendingLabel="Approving…" tone="primary" testId="approve-payment" onCancel={() => setApprovingId(null)} onConfirm={() => doApprove(approvingPayment)} pending={approve.isPending} />}
  </div>;
}

// The admin-settings key/value bag (raw string values keyed by setting
// name, e.g. PAYMENT_BANK_ACCOUNTS, PAYMENT_UPI_ID) and the setter the tabs
// below call to stage an edit before "Save changes" persists it.
export type PaymentSettingsValues = Record<string, string>;
export type SetSetting = (key: string, value: string) => void;

export const PAYMENT_METHODS: Array<{ value: string; label: string; icon: typeof Landmark }> = [
  { value: 'Bank transfer', label: 'Bank transfer', icon: Landmark },
  { value: 'UPI', label: 'UPI', icon: Smartphone },
  { value: 'Raast', label: 'Raast', icon: Zap },
  { value: 'Mobile wallet', label: 'Mobile wallet', icon: Smartphone },
  { value: 'Card', label: 'Card', icon: CreditCard },
];

export function parseBankAccounts(values: PaymentSettingsValues): BankAccount[] {
  try {
    const parsed = JSON.parse(values.PAYMENT_BANK_ACCOUNTS || '[]');
    if (Array.isArray(parsed) && parsed.length) return parsed;
  } catch { /* fall through to legacy single-account seed below */ }
  // Seed from the legacy single-account fields so upgrading doesn't blank
  // out an account that's already configured and shown to students.
  if (values.PAYMENT_ACCOUNT_HOLDER || values.PAYMENT_BANK_NAME || values.PAYMENT_ACCOUNT_NUMBER) {
    return [{ id: 'legacy', label: 'Primary account', accountHolder: values.PAYMENT_ACCOUNT_HOLDER || '', bankName: values.PAYMENT_BANK_NAME || '', accountNumber: values.PAYMENT_ACCOUNT_NUMBER || '', ifsc: values.PAYMENT_IFSC_OR_ROUTING || '', branch: '', isPrimary: true }];
  }
  return [];
}

export const DEFAULT_METHODS: PaymentMethodConfig[] = [
  { key: 'bank_transfer', label: 'Bank Transfer', type: 'bank', enabled: true, instructions: '' },
  { key: 'raast', label: 'Raast', type: 'wallet', enabled: false, instructions: '' },
  { key: 'jazzcash', label: 'JazzCash', type: 'wallet', enabled: false, instructions: '' },
  { key: 'easypaisa', label: 'EasyPaisa', type: 'wallet', enabled: false, instructions: '' },
  { key: 'cash', label: 'Cash / In person', type: 'cash', enabled: false, instructions: '' },
];

export function parseMethods(values: PaymentSettingsValues): PaymentMethodConfig[] {
  let methods: PaymentMethodConfig[];
  try {
    const parsed = JSON.parse(values.PAYMENT_METHODS_CONFIG || '[]');
    methods = Array.isArray(parsed) && parsed.length ? parsed : DEFAULT_METHODS;
  } catch { methods = DEFAULT_METHODS; }
  // Backfill from the legacy per-method settings keys (PAYMENT_RAAST_NUMBER
  // etc.) so numbers/names entered before this fix still show up here —
  // matches the same backfill GET /payment-details does for students.
  return methods.map((m) => ({
    ...m,
    accountNumber: m.accountNumber || values[`PAYMENT_${m.key.toUpperCase()}_NUMBER`] || '',
    accountName: m.accountName || values[`PAYMENT_${m.key.toUpperCase()}_ACCOUNT_NAME`] || '',
  }));
}

// ── Tab: Collection Details (instructions, currency, QR, legacy wallet fields) ──

export function CollectionDetailsTab({ values, set }: { values: PaymentSettingsValues; set: SetSetting }) {
  return <div className="max-w-2xl space-y-4">
    <div className="rounded-2xl border border-border bg-card p-6"><p className="text-xs leading-5 text-muted-foreground">Students see these details when they submit a payment. Update them any time — changes apply immediately, no redeploy needed.</p>
      <div className="mt-5 grid gap-4 sm:grid-cols-2">
        <label className="text-xs font-bold">Default currency<input value={values.DEFAULT_CURRENCY || ''} onChange={(e) => set('DEFAULT_CURRENCY', e.target.value)} placeholder="PKR" className="mt-2 h-10 w-full rounded-xl border border-border bg-background px-3 text-xs" data-testid="input-currency-payment" /></label>
        <label className="text-xs font-bold">UPI ID<input value={values.PAYMENT_UPI_ID || ''} onChange={(e) => set('PAYMENT_UPI_ID', e.target.value)} className="mt-2 h-10 w-full rounded-xl border border-border bg-background px-3 text-xs font-mono-app" data-testid="input-upi-id" /></label>
        <label className="text-xs font-bold sm:col-span-2">Instructions shown to students<textarea value={values.PAYMENT_INSTRUCTIONS || ''} onChange={(e) => set('PAYMENT_INSTRUCTIONS', e.target.value)} className="mt-2 min-h-20 w-full rounded-xl border border-border bg-background p-3 text-xs" data-testid="input-payment-instructions-admin" /></label>
        <label className="text-xs font-bold sm:col-span-2">Refund policy<textarea value={values.PAYMENT_REFUND_POLICY || ''} onChange={(e) => set('PAYMENT_REFUND_POLICY', e.target.value)} className="mt-2 min-h-16 w-full rounded-xl border border-border bg-background p-3 text-xs" data-testid="input-refund-policy" /></label>
        <label className="text-xs font-bold sm:col-span-2">Late fee / renewal note<input value={values.PAYMENT_LATE_FEE_NOTE || ''} onChange={(e) => set('PAYMENT_LATE_FEE_NOTE', e.target.value)} className="mt-2 h-10 w-full rounded-xl border border-border bg-background px-3 text-xs" data-testid="input-late-fee-note" /></label>
      </div>
    </div>
    <div className="rounded-2xl border border-border bg-card p-6"><h3 className="font-bold">Payment QR code</h3><p className="mt-1 text-xs text-muted-foreground">Shown next to your bank details at sign-up &amp; renewal — a scannable QR is faster than typing an account number.</p><div className="mt-5">
      <AdminImageUpload currentUrl={values.PAYMENT_QR_CODE_URL || ''} kind="resource" accept="image/png,image/jpeg,image/webp" hint="PNG, JPEG, or WEBP · up to 8MB." testId="input-qr-upload" onUploaded={(storagePath) => set('PAYMENT_QR_CODE_PATH', storagePath)} />
    </div></div>
  </div>;
}

// ── Tab: Bank Accounts — multiple accounts, add/edit/remove/set-primary ──

export function BankAccountsTab({ values, set }: { values: PaymentSettingsValues; set: SetSetting }) {
  const accounts = parseBankAccounts(values);
  const [showForm, setShowForm] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);
  const emptyDraft: BankAccount = { id: '', label: '', accountHolder: '', bankName: '', accountNumber: '', ifsc: '', branch: '', isPrimary: accounts.length === 0 };
  const [draft, setDraft] = useState<BankAccount>(emptyDraft);

  const writeAccounts = (next: BankAccount[]) => set('PAYMENT_BANK_ACCOUNTS', JSON.stringify(next));
  const openNew = () => { setDraft({ ...emptyDraft, id: `acct_${Date.now()}` }); setEditingId(null); setShowForm(true); };
  const openEdit = (a: BankAccount) => { setDraft(a); setEditingId(a.id); setShowForm(true); };
  const saveDraft = () => {
    if (!draft.accountHolder.trim() || !draft.bankName.trim()) return;
    let next = editingId ? accounts.map((a) => (a.id === editingId ? draft : a)) : [...accounts, draft];
    if (draft.isPrimary) next = next.map((a) => ({ ...a, isPrimary: a.id === draft.id }));
    writeAccounts(next);
    setShowForm(false);
    setEditingId(null);
  };
  const removeAccount = (id: string) => writeAccounts(accounts.filter((a) => a.id !== id));
  const makePrimary = (id: string) => writeAccounts(accounts.map((a) => ({ ...a, isPrimary: a.id === id })));

  return <div className="max-w-3xl">
    <div className="mb-4 flex items-center justify-between"><p className="text-xs text-muted-foreground">Add every account students can pay into — the primary one is shown first.</p><button onClick={openNew} className="inline-flex items-center gap-2 rounded-xl bg-primary px-4 py-2.5 text-xs font-extrabold text-primary-foreground" data-testid="button-add-bank-account"><Plus size={15} /> Add account</button></div>
    {showForm && <div className="mb-5 rounded-2xl border border-primary/30 bg-primary/10 p-5">
      <div className="grid gap-3 sm:grid-cols-2">
        <label className="text-xs font-bold">Label<input value={draft.label} onChange={(e) => setDraft({ ...draft, label: e.target.value })} placeholder="e.g. Main collection account" className="mt-2 h-10 w-full rounded-xl border border-border bg-card px-3 text-xs" data-testid="input-account-label" /></label>
        <label className="text-xs font-bold">Account holder name<input value={draft.accountHolder} onChange={(e) => setDraft({ ...draft, accountHolder: e.target.value })} className="mt-2 h-10 w-full rounded-xl border border-border bg-card px-3 text-xs" data-testid="input-account-holder" /></label>
        <label className="text-xs font-bold">Bank name<input value={draft.bankName} onChange={(e) => setDraft({ ...draft, bankName: e.target.value })} className="mt-2 h-10 w-full rounded-xl border border-border bg-card px-3 text-xs" data-testid="input-bank-name" /></label>
        <label className="text-xs font-bold">Account number<input value={draft.accountNumber} onChange={(e) => setDraft({ ...draft, accountNumber: e.target.value })} className="mt-2 h-10 w-full rounded-xl border border-border bg-card px-3 text-xs font-mono-app" data-testid="input-account-number" /></label>
        <label className="text-xs font-bold">IFSC / routing code<input value={draft.ifsc} onChange={(e) => setDraft({ ...draft, ifsc: e.target.value })} className="mt-2 h-10 w-full rounded-xl border border-border bg-card px-3 text-xs font-mono-app" data-testid="input-ifsc" /></label>
        <label className="text-xs font-bold">Branch<input value={draft.branch} onChange={(e) => setDraft({ ...draft, branch: e.target.value })} className="mt-2 h-10 w-full rounded-xl border border-border bg-card px-3 text-xs" data-testid="input-branch" /></label>
      </div>
      <label className="mt-3 flex items-center gap-2 text-xs font-bold"><input type="checkbox" checked={draft.isPrimary} onChange={(e) => setDraft({ ...draft, isPrimary: e.target.checked })} className="size-4 accent-primary" data-testid="checkbox-account-primary" /> Set as primary account</label>
      <div className="mt-4 flex gap-2"><button onClick={saveDraft} disabled={!draft.accountHolder.trim() || !draft.bankName.trim()} className="rounded-xl bg-primary px-4 py-2 text-xs font-bold text-primary-foreground disabled:opacity-50" data-testid="button-save-bank-account">{editingId ? 'Save changes' : 'Add account'}</button><button onClick={() => setShowForm(false)} className="rounded-xl border border-border bg-card px-4 py-2 text-xs font-bold" data-testid="button-cancel-bank-account">Cancel</button></div>
    </div>}
    {accounts.length ? <div className="grid gap-3 sm:grid-cols-2">{accounts.map((a) => <div key={a.id} className="rounded-2xl border border-border bg-card p-5" data-testid={`card-bank-account-${a.id}`}>
      <div className="flex items-start justify-between"><div><div className="flex items-center gap-2"><span className="text-sm font-bold">{a.label || a.bankName}</span>{a.isPrimary && <Badge tone="green">Primary</Badge>}</div><div className="mt-1 text-xs text-muted-foreground">{a.accountHolder}</div></div><div className="flex gap-1"><button onClick={() => openEdit(a)} className="rounded-lg p-2 text-muted-foreground hover:bg-muted" data-testid={`button-edit-account-${a.id}`}><Pencil size={14} /></button><button onClick={() => removeAccount(a.id)} className="rounded-lg p-2 text-muted-foreground hover:bg-destructive/10 hover:text-destructive" data-testid={`button-delete-account-${a.id}`}><Trash2 size={14} /></button></div></div>
      <div className="mt-3 space-y-1 font-mono-app text-[11px] text-muted-foreground"><div>{a.bankName}</div><div>{a.accountNumber}</div>{a.ifsc && <div>IFSC/Routing: {a.ifsc}</div>}{a.branch && <div>Branch: {a.branch}</div>}</div>
      {!a.isPrimary && <button onClick={() => makePrimary(a.id)} className="mt-3 text-[11px] font-bold text-primary" data-testid={`button-make-primary-${a.id}`}>Make primary</button>}
    </div>)}</div> : <EmptyState icon={Landmark} title="No bank accounts yet" body="Add one so students know where to send payment." />}
  </div>;
}

// ── Tab: Payment Methods — enable/disable each accepted method + per-method instructions & wallet numbers ──

export function PaymentMethodsTab({ values, set }: { values: PaymentSettingsValues; set: SetSetting }) {
  const methods = parseMethods(values);
  const writeMethods = (next: PaymentMethodConfig[]) => set('PAYMENT_METHODS_CONFIG', JSON.stringify(next));
  const updateMethod = (key: string, patch: Partial<PaymentMethodConfig>) => writeMethods(methods.map((m) => (m.key === key ? { ...m, ...patch } : m)));

  return <div className="max-w-3xl space-y-3">
    <p className="text-xs text-muted-foreground">Toggle which payment methods students can use, and set per-method instructions. Bank Transfer details live under the Bank Accounts tab.</p>
    {methods.map((m) => <div key={m.key} className="rounded-2xl border border-border bg-card p-5" data-testid={`card-method-${m.key}`}>
      <div className="flex items-center justify-between"><div className="flex items-center gap-3"><div className={cn('grid size-10 place-items-center rounded-xl', m.enabled ? 'bg-primary/15 text-primary' : 'bg-muted text-muted-foreground')}>{m.type === 'bank' ? <Landmark size={16} /> : m.type === 'wallet' ? <Smartphone size={16} /> : <CreditCard size={16} />}</div><div><div className="text-sm font-bold">{m.label}</div><div className="text-[11px] text-muted-foreground capitalize">{m.type}</div></div></div>
        <label className="flex cursor-pointer items-center gap-2 text-xs font-bold"><input type="checkbox" checked={m.enabled} onChange={(e) => updateMethod(m.key, { enabled: e.target.checked })} className="size-4 accent-primary" data-testid={`checkbox-method-${m.key}`} />{m.enabled ? 'Enabled' : 'Disabled'}</label>
      </div>
      {m.enabled && <div className="mt-4 space-y-3 border-t border-border pt-4">
        {m.type === 'wallet' && <div className="grid gap-3 sm:grid-cols-2">
          <label className="text-xs font-bold">{m.label} number<input value={m.accountNumber || ''} onChange={(e) => updateMethod(m.key, { accountNumber: e.target.value })} className="mt-2 h-10 w-full rounded-xl border border-border bg-background px-3 text-xs font-mono-app" data-testid={`input-${m.key}-number`} /></label>
          <label className="text-xs font-bold">Account name<input value={m.accountName || ''} onChange={(e) => updateMethod(m.key, { accountName: e.target.value })} className="mt-2 h-10 w-full rounded-xl border border-border bg-background px-3 text-xs" data-testid={`input-${m.key}-account-name`} /></label>
        </div>}
        <label className="text-xs font-bold">Instructions for this method<textarea value={m.instructions} onChange={(e) => updateMethod(m.key, { instructions: e.target.value })} className="mt-2 min-h-16 w-full rounded-xl border border-border bg-background p-3 text-xs" data-testid={`input-${m.key}-instructions`} /></label>
      </div>}
    </div>)}
  </div>;
}

// ── Tab: Stats — derived client-side from the same payments the Proof Review tab uses, no extra endpoint needed ──

export function PaymentStatsTab() {
  const q = useListPayments();
  const payments = q.data ?? [];
  if (q.isLoading) return <SkeletonPage />;
  const total = payments.length;
  const pending = payments.filter((p) => p.status === 'pending').length;
  const approved = payments.filter((p) => p.status === 'approved').length;
  const rejected = payments.filter((p) => p.status === 'rejected').length;
  const revenue = payments.filter((p) => p.status === 'approved').reduce((sum, p) => sum + Number(p.amount), 0);
  const currency = payments[0]?.currency || 'PKR';
  const today = new Date().toISOString().slice(0, 10);
  const todayCount = payments.filter((p) => p.submittedAt.slice(0, 10) === today).length;

  const byMethod = new Map<string, { count: number; total: number }>();
  for (const p of payments) {
    const row = byMethod.get(p.method) || { count: 0, total: 0 };
    row.count += 1; row.total += Number(p.amount);
    byMethod.set(p.method, row);
  }
  const methodRows = [...byMethod.entries()].sort((a, b) => b[1].count - a[1].count);
  const maxCount = Math.max(1, ...methodRows.map(([, v]) => v.count));
  const recent = [...payments].sort((a, b) => b.submittedAt.localeCompare(a.submittedAt)).slice(0, 6);

  const cards: Array<[string, string | number, string]> = [
    ['Total submissions', total, ''],
    ["Today's submissions", todayCount, ''],
    ['Pending review', pending, 'text-accent-text'],
    ['Approved', approved, 'text-primary'],
    ['Rejected', rejected, 'text-destructive'],
    ['Total revenue', money(revenue, currency), 'text-primary'],
  ];

  return <div className="space-y-6">
    <div className="grid grid-cols-2 gap-3 md:grid-cols-3">{cards.map(([label, value, cls]) => <div key={label} className="rounded-2xl border border-border bg-card p-5" data-testid={`card-stat-${label.toLowerCase().replaceAll(' ', '-')}`}><div className="text-[11px] text-muted-foreground">{label}</div><div className={cn('mt-2 font-display text-2xl', cls)}>{value}</div></div>)}</div>
    {!!methodRows.length && <div className="rounded-2xl border border-border bg-card p-6"><h3 className="font-bold">Revenue by method</h3><div className="mt-4 space-y-3">{methodRows.map(([method, v]) => <div key={method} className="flex items-center gap-3"><span className="w-28 shrink-0 text-xs font-semibold capitalize">{method.replace(/_/g, ' ')}</span><div className="h-2 flex-1 rounded-full bg-muted"><div className="h-2 rounded-full bg-primary" style={{ width: `${(v.count / maxCount) * 100}%` }} /></div><span className="w-28 shrink-0 text-right text-[11px] text-muted-foreground">{v.count} · {money(v.total, currency)}</span></div>)}</div></div>}
    {!!recent.length && <div className="rounded-2xl border border-border bg-card p-6"><h3 className="font-bold">Recent submissions</h3><div className="mt-4 space-y-3">{recent.map((p) => <div key={p.id} className="flex items-center gap-3 text-xs"><div className="grid size-8 shrink-0 place-items-center rounded-lg bg-accent/20 text-accent-text"><ReceiptText size={13} /></div><div className="min-w-0 flex-1"><div className="truncate font-bold">{p.studentName}</div><div className="text-[11px] text-muted-foreground">{p.method} · {p.submittedAt.slice(0, 10)}</div></div><Badge tone={p.status === 'pending' ? 'amber' : p.status === 'approved' ? 'green' : 'red'}>{p.status}</Badge></div>)}</div></div>}
    {!total && <EmptyState icon={TrendingUp} title="No submissions yet" body="Stats will fill in as students submit payments." />}
  </div>;
}

export const PAYMENT_TABS = ['Collection Details', 'Bank Accounts', 'Payment Methods', 'Proof Review', 'Stats'] as const;
