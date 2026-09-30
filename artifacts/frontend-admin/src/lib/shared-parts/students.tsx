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

import { Badge, ConfirmDialog, InlineLoading, cn, initials, money } from './ui';


// Device limit for one student: how many devices they may be signed in on at
// once (their own override, else the platform default from Settings →
// Security), the devices currently signed in, and a way to sign any of them
// out — which is also how a student who hit the limit gets unstuck.
function StudentDevicesSection({ studentId }: { studentId: number }) {
  const q = useQuery({ queryKey: ['student-devices', studentId], queryFn: () => studentsAdminApi.devices(studentId) });
  const refresh = () => queryClient.invalidateQueries({ queryKey: ['student-devices', studentId] });
  const fail = (title: string) => (err: unknown) => toast({ title, description: err instanceof ApiRequestError ? err.message : 'Something went wrong — check your connection and try again.', variant: 'destructive' });
  const [draft, setDraft] = useState<string | null>(null);
  const setLimit = useMutation({ mutationFn: (v: number | null) => studentsAdminApi.setDeviceLimit(studentId, v), onSuccess: () => { setDraft(null); refresh(); }, onError: fail('Could not change device limit') });
  const revokeOne = useMutation({ mutationFn: (sessionId: number) => studentsAdminApi.revokeDevice(studentId, sessionId), onSuccess: refresh, onError: fail('Could not sign the device out') });
  const revokeAll = useMutation({ mutationFn: () => studentsAdminApi.revokeAllDevices(studentId), onSuccess: () => { setConfirmAll(false); refresh(); }, onError: fail('Could not reset devices') });
  const [confirmAll, setConfirmAll] = useState(false);
  const d = q.data;
  const shown = draft ?? (d ? String(d.override ?? d.defaultLimit) : '');
  const parsed = /^\d+$/.test(shown.trim()) ? Number(shown.trim()) : NaN;
  const valid = Number.isInteger(parsed) && parsed >= 0 && parsed <= 50;
  const limitText = !d ? '' : d.limit === 0 ? 'unlimited' : String(d.limit);
  return <div><div className="mb-2 flex items-center justify-between"><span className="text-xs font-bold uppercase tracking-wide text-muted-foreground">Devices</span>{d && <span className="text-[11px] font-semibold text-muted-foreground" data-testid="text-device-usage">{d.devices.length} signed in · limit {limitText}</span>}</div>
    {!d ? <InlineLoading /> : <div className="space-y-3">
      <div className="flex flex-wrap items-center gap-2"><input type="number" min={0} max={50} value={shown} onChange={(e) => setDraft(e.target.value)} className="w-16 rounded-lg border border-border bg-background px-2 py-1.5 text-xs font-bold" data-testid="input-device-limit" /><span className="text-[11px] text-muted-foreground">devices at once (0 = unlimited)</span><button onClick={() => setLimit.mutate(parsed)} disabled={!valid || setLimit.isPending || draft === null} className="ml-auto rounded-lg bg-primary px-2.5 py-1.5 text-[10px] font-extrabold text-primary-foreground disabled:opacity-50" data-testid="button-save-device-limit">{setLimit.isPending ? 'Saving…' : 'Save limit'}</button></div>
      <p className="text-[11px] leading-5 text-muted-foreground">{d.override === null ? <>Using the platform default ({d.defaultLimit === 0 ? 'unlimited' : d.defaultLimit}). Saving here gives this student their own limit.</> : <>This student has their own limit. <button onClick={() => setLimit.mutate(null)} disabled={setLimit.isPending} className="font-bold text-primary underline" data-testid="button-device-limit-default">Use the platform default ({d.defaultLimit === 0 ? 'unlimited' : d.defaultLimit}) instead</button>.</>} Lowering the limit never signs anyone out; it only blocks new sign-ins until they're under it.</p>
      <div className="space-y-2">{d.devices.map((dev) => <div key={dev.id} className="flex items-center gap-3 rounded-lg border border-border p-3 text-xs" data-testid={`row-device-${dev.id}`}><Smartphone size={15} className="shrink-0 text-muted-foreground" /><div className="min-w-0 flex-1"><div className="truncate font-bold">{dev.label}</div><div className="mt-0.5 text-[10px] text-muted-foreground">Signed in {new Date(dev.signedInAt).toLocaleDateString()} · last active {new Date(dev.lastSeenAt).toLocaleString()}{dev.ip ? ` · ${dev.ip}` : ''}</div></div><button onClick={() => revokeOne.mutate(dev.id)} disabled={revokeOne.isPending} className="shrink-0 rounded-lg bg-muted px-2.5 py-1.5 text-[10px] font-extrabold hover:bg-muted/70 disabled:opacity-50" data-testid={`button-revoke-device-${dev.id}`}>Sign out</button></div>)}{!d.devices.length && <p className="text-xs text-muted-foreground">Not signed in on any device.</p>}</div>
      {d.devices.length > 0 && <button onClick={() => setConfirmAll(true)} className="text-[11px] font-extrabold text-destructive underline" data-testid="button-reset-devices">Sign out of all devices</button>}
    </div>}
    {confirmAll && <ConfirmDialog title="Sign this student out everywhere?" body="Every device they're signed in on is logged out immediately and its slot is freed, so they can sign in again on up to their limit." confirmLabel="Sign out everywhere" pendingLabel="Signing out…" onCancel={() => setConfirmAll(false)} onConfirm={() => revokeAll.mutate()} pending={revokeAll.isPending} testId="reset-devices" />}
  </div>;
}

// Lazy: Student360 pulls in recharts + framer-motion (~400 kB). Only needed
// once a student drawer is opened, so it must not sit in the entry bundle.
const Student360Panel = lazy(() => import('@/components/Student360').then((m) => ({ default: m.Student360Panel })));
// Admin can edit everything about a student's profile: name, email, phone,
// roll number, college, program (MBBS/BDS) and academic year. The PATCH
// endpoint re-points the student's program/year records the same way
// sign-up does, so content visibility follows the change immediately.
function EditStudentDetails({ s, onSaved }: { s: StudentDetail; onSaved: () => void }) {
  const [open, setOpen] = useState(false);
  const [form, setForm] = useState({ name: '', email: '', phone: '', rollNumber: '', institutionId: 0, programKind: '' as '' | 'MBBS' | 'BDS', yearNumber: 0 });
  const reset = () => setForm({ name: s.name, email: s.email, phone: s.phone ?? '', rollNumber: s.rollNumber ?? '', institutionId: s.institutionId ?? 0, programKind: (s.programKind ?? '') as '' | 'MBBS' | 'BDS', yearNumber: s.yearNumber ?? 0 });
  const institutions = useQuery({ queryKey: ['institutions', 'edit-student', form.programKind], queryFn: () => academicApi.institutions(undefined, form.programKind || undefined), enabled: open });
  const maxYear = form.programKind === 'BDS' ? 4 : 5;
  const save = useMutation({
    mutationFn: () => studentsAdminApi.update(s.id, {
      name: form.name.trim(), email: form.email.trim(), phone: form.phone.trim(), rollNumber: form.rollNumber.trim(),
      ...(form.institutionId && form.programKind && form.yearNumber ? { institutionId: form.institutionId, programKind: form.programKind, yearNumber: form.yearNumber } : {}),
    }),
    onSuccess: () => { toast({ title: 'Student details saved' }); onSaved(); setOpen(false); },
    onError: (err: unknown) => toast({ title: 'Could not save details', description: err instanceof ApiRequestError ? err.message : 'Something went wrong — check your connection and try again.', variant: 'destructive' }),
  });
  const input = 'mt-1 h-9 w-full rounded-lg border border-border bg-background px-3 text-xs';
  if (!open) return <button type="button" onClick={() => { reset(); setOpen(true); }} className="inline-flex items-center gap-1.5 rounded-lg border border-border px-3 py-1.5 text-xs font-bold hover:bg-muted" data-testid="button-edit-student"><Pencil size={12} /> Edit details</button>;
  return <div className="space-y-3 rounded-xl border border-border bg-background p-4 text-xs" data-testid="form-edit-student">
    <div className="grid gap-3 sm:grid-cols-2">
      <label className="font-bold">Name<input className={input} value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} data-testid="input-edit-name" /></label>
      <label className="font-bold">Email<input className={input} type="email" value={form.email} onChange={(e) => setForm({ ...form, email: e.target.value })} data-testid="input-edit-email" /></label>
      <label className="font-bold">Phone<input className={input} value={form.phone} onChange={(e) => setForm({ ...form, phone: e.target.value })} data-testid="input-edit-phone" /></label>
      <label className="font-bold">Roll number<input className={input} value={form.rollNumber} onChange={(e) => setForm({ ...form, rollNumber: e.target.value })} data-testid="input-edit-roll" /></label>
    </div>
    <div><div className="font-bold">Program</div><div className="mt-1 flex gap-2">{(['MBBS', 'BDS'] as const).map((k) => <button type="button" key={k} onClick={() => setForm({ ...form, programKind: k, institutionId: form.programKind === k ? form.institutionId : 0, yearNumber: Math.min(form.yearNumber, k === 'BDS' ? 4 : 5) })} className={cn('h-9 flex-1 rounded-lg border text-xs font-bold', form.programKind === k ? 'border-primary bg-primary/10 text-primary' : 'border-border bg-card hover:bg-muted')} data-testid={`button-edit-program-${k}`}>{k}</button>)}</div></div>
    <label className="block font-bold">College
      <select className={input} value={form.institutionId || ''} onChange={(e) => setForm({ ...form, institutionId: Number(e.target.value) })} disabled={!form.programKind} data-testid="select-edit-college">
        <option value="">{form.programKind ? 'Select college' : 'Choose a program first'}</option>
        {(institutions.data ?? []).map((i) => <option key={i.id} value={i.id}>{i.name}</option>)}
        {form.institutionId && !(institutions.data ?? []).some((i) => i.id === form.institutionId) && <option value={form.institutionId}>{s.institution ?? 'Current college'}</option>}
      </select>
    </label>
    <div><div className="font-bold">Academic year</div><div className="mt-1 grid grid-cols-5 gap-2">{Array.from({ length: maxYear }, (_, i) => i + 1).map((y) => <button type="button" key={y} onClick={() => setForm({ ...form, yearNumber: y })} disabled={!form.programKind} className={cn('h-9 rounded-lg border text-xs font-bold disabled:opacity-40', form.yearNumber === y ? 'border-primary bg-primary/10 text-primary' : 'border-border bg-card hover:bg-muted')} data-testid={`button-edit-year-${y}`}>{y}</button>)}</div></div>
    <div className="flex justify-end gap-2 pt-1"><button type="button" onClick={() => setOpen(false)} className="rounded-lg border border-border px-3 py-1.5 font-bold hover:bg-muted">Cancel</button><button type="button" onClick={() => save.mutate()} disabled={save.isPending || form.name.trim().length < 2 || !form.email.trim()} className="rounded-lg bg-primary px-4 py-1.5 font-bold text-primary-foreground disabled:opacity-50" data-testid="button-save-student">{save.isPending ? 'Saving…' : 'Save changes'}</button></div>
  </div>;
}

export function StudentDrawer({ id, onClose }: { id: number; onClose: () => void }) {
  const detail = useQuery({ queryKey: ['student-detail', id], queryFn: () => studentsAdminApi.detail(id) });
  const invalidate = () => { queryClient.invalidateQueries({ queryKey: ['student-detail', id] }); queryClient.invalidateQueries({ queryKey: getListStudentsQueryKey() }); };
  const updateStatus = useMutation({
    mutationFn: ({ status, emailVerified, message }: { status: string; emailVerified?: boolean; message?: string }) => studentsAdminApi.updateStatus(id, status, emailVerified, message),
    onSuccess: () => { invalidate(); setRejecting(false); setRejectMessage(''); },
    onError: (err: unknown) => toast({ title: 'Could not update status', description: err instanceof ApiRequestError ? err.message : 'Something went wrong — check your connection and try again.', variant: 'destructive' }),
  });
  // Rejecting needs a message for the student — same reveal-an-input-then-
  // confirm pattern as the payment reject flow in PaymentProofsTab below,
  // just at the account level.
  const [rejecting, setRejecting] = useState(false);
  const [rejectMessage, setRejectMessage] = useState('');
  const confirmReject = () => { if (!rejectMessage.trim()) return; updateStatus.mutate({ status: 'REJECTED', message: rejectMessage.trim() }); };
  const [confirmingActivate, setConfirmingActivate] = useState(false);
  const verifyEmail = useMutation({
    mutationFn: () => studentsAdminApi.verifyEmail(id),
    onSuccess: invalidate,
    onError: (err: unknown) => toast({ title: 'Could not verify email', description: err instanceof ApiRequestError ? err.message : 'Something went wrong — check your connection and try again.', variant: 'destructive' }),
  });
  const [trialDays, setTrialDays] = useState(7);
  const startTrial = useMutation({
    mutationFn: (durationDays: number) => studentsAdminApi.startTrial(id, durationDays),
    onSuccess: invalidate,
    onError: (err: unknown) => toast({ title: 'Could not start trial', description: err instanceof ApiRequestError ? err.message : 'Something went wrong — check your connection and try again.', variant: 'destructive' }),
  });
  const endTrial = useMutation({
    mutationFn: () => studentsAdminApi.endTrial(id),
    onSuccess: invalidate,
    onError: (err: unknown) => toast({ title: 'Could not end trial', description: err instanceof ApiRequestError ? err.message : 'Something went wrong — check your connection and try again.', variant: 'destructive' }),
  });
  const s: StudentDetail | undefined = detail.data;
  return <div className="fixed inset-0 z-50 flex justify-end bg-black/30" onClick={onClose}><div onClick={(e) => e.stopPropagation()} className="h-full w-full max-w-xl overflow-y-auto bg-card p-6 shadow-2xl animate-in slide-in-from-right duration-200">
    <div className="flex items-center justify-between"><h3 className="text-lg font-extrabold">Student profile</h3><button onClick={onClose} className="rounded-lg p-2 hover:bg-muted" data-testid="button-close-drawer"><X size={16} /></button></div>
    {!s ? <div className="mt-8"><InlineLoading /></div> : <div className="mt-6 space-y-6">
      <div className="flex items-center gap-3"><div className="grid size-12 place-items-center rounded-full bg-primary/15 text-sm font-extrabold text-primary">{initials(s.name)}</div><div><div className="font-bold">{s.name}</div><div className="text-xs text-muted-foreground">{s.email}</div></div></div>
      <div className="grid grid-cols-2 gap-3 text-xs"><div><div className="text-muted-foreground">Phone</div><div className="mt-0.5 font-bold">{s.phone || '—'}</div></div><div><div className="text-muted-foreground">Roll number</div><div className="mt-0.5 font-bold">{s.rollNumber || '—'}</div></div><div><div className="text-muted-foreground">Institution</div><div className="mt-0.5 font-bold">{s.institution || '—'}</div></div><div><div className="text-muted-foreground">Programme</div><div className="mt-0.5 font-bold">{s.program || '—'}</div></div><div><div className="text-muted-foreground">Year / batch</div><div className="mt-0.5 font-bold">{s.academicYear || '—'} · {s.batch || '—'}</div></div><div><div className="text-muted-foreground">Streak</div><div className="mt-0.5 font-bold">{s.currentStreak}d (best {s.longestStreak}d)</div></div><div><div className="text-muted-foreground">Joined</div><div className="mt-0.5 font-bold">{new Date(s.joinedAt).toLocaleDateString()}</div></div><div><div className="text-muted-foreground">Email verified</div>{s.emailVerified ? <div className="mt-0.5 font-bold text-primary">Yes</div> : <button onClick={() => verifyEmail.mutate()} disabled={verifyEmail.isPending} className="mt-0.5 inline-flex items-center gap-1 text-[11px] font-extrabold text-destructive underline disabled:opacity-50" data-testid="button-verify-email">{verifyEmail.isPending ? 'Verifying…' : 'No · verify now'}</button>}</div></div>
      <EditStudentDetails s={s} onSaved={invalidate} />
      <Suspense fallback={<InlineLoading label="Loading student overview…" />}><Student360Panel s={s} /></Suspense>
      {s.activeMembership && !s.activeMembership.isTrial && <div className="rounded-xl bg-primary/10 p-3 text-xs font-semibold text-primary">Active membership until {new Date(s.activeMembership.expiresAt).toLocaleDateString()}</div>}
      {!s.emailVerified && s.status !== 'ACTIVE' && <div className="rounded-xl border border-accent/40 bg-accent/10 p-3 text-[11px] leading-5 text-accent-text"><strong>Heads up:</strong> this student's email isn't verified yet, so they can't sign in at all even if you set their status below — the "No · verify now" link above (or "Activate now" here) clears that separately.</div>}
      <div><div className="mb-2 flex items-center justify-between"><span className="text-xs font-bold uppercase tracking-wide text-muted-foreground">Account status</span>{s.status !== 'ACTIVE' && <button onClick={() => setConfirmingActivate(true)} disabled={updateStatus.isPending} className="inline-flex items-center gap-1.5 rounded-lg bg-primary px-3 py-1.5 text-[10px] font-extrabold text-primary-foreground shadow-sm transition-transform active:scale-95 disabled:opacity-50" data-testid="button-activate-now"><ShieldCheck size={13} /> {updateStatus.isPending ? 'Activating…' : 'Approve student'}</button>}</div><p className="mb-2 text-[11px] text-muted-foreground">Status controls what the student can access. Moving to Verified, Payment review, or Active also clears the email-verification gate automatically.</p><div className="flex flex-wrap gap-2">{STUDENT_STATUSES.filter((status) => status !== 'DELETED').map((status) => <button key={status} onClick={() => status === 'REJECTED' ? setRejecting(true) : updateStatus.mutate({ status })} disabled={updateStatus.isPending} className={cn('rounded-lg px-2.5 py-1.5 text-[10px] font-bold', s.status === status ? 'bg-primary text-primary-foreground' : 'bg-muted hover:bg-muted/70')} data-testid={`button-status-${status}`}>{status.replace(/_/g, ' ')}</button>)}</div>
        {rejecting && <div className="mt-3 flex gap-2 border-t border-border pt-3"><input autoFocus value={rejectMessage} onChange={(e) => setRejectMessage(e.target.value)} placeholder="Message for the student (why they're being rejected)" className="h-9 flex-1 rounded-lg border border-border bg-background px-3 text-xs" data-testid="input-reject-student-message" /><button onClick={confirmReject} disabled={!rejectMessage.trim() || updateStatus.isPending} className="rounded-lg bg-destructive px-4 text-xs font-bold text-destructive-foreground disabled:opacity-50" data-testid="button-confirm-reject-student">{updateStatus.isPending ? 'Rejecting…' : 'Confirm reject'}</button><button onClick={() => { setRejecting(false); setRejectMessage(''); }} className="rounded-lg border border-border px-3 text-xs font-bold text-muted-foreground" data-testid="button-cancel-reject-student">Cancel</button></div>}
        {s.status === 'REJECTED' && s.statusMessage && <div className="mt-3 rounded-xl border border-destructive/30 bg-destructive/10 p-3 text-[11px] leading-5 text-destructive"><strong>Rejection message sent to student:</strong> {s.statusMessage}</div>}
      </div>
      {/* Trial mode: grant temporary access for a chosen number of days
          without a payment, or end it early. Uses the same membership
          grant as "Activate now" above, just tagged isTrial so it shows
          up distinctly here and the admin can revoke it before it expires
          without having to remember to also downgrade the account status. */}
      <div><div className="mb-2 text-xs font-bold uppercase tracking-wide text-muted-foreground">Trial access</div>
        {s.activeMembership?.isTrial
          ? <div className="flex items-center justify-between rounded-xl bg-info/15 p-3 text-xs font-semibold text-info"><span>Trial active until {new Date(s.activeMembership.expiresAt).toLocaleDateString()}</span><button onClick={() => endTrial.mutate()} disabled={endTrial.isPending} className="rounded-lg bg-white/70 px-2.5 py-1.5 text-[10px] font-extrabold text-info disabled:opacity-50" data-testid="button-end-trial">{endTrial.isPending ? 'Ending…' : 'End trial'}</button></div>
          : <div className="flex items-center gap-2"><input type="number" min={1} max={365} value={trialDays} onChange={(e) => setTrialDays(Math.max(1, Math.min(365, Number(e.target.value) || 1)))} className="w-16 rounded-lg border border-border bg-background px-2 py-1.5 text-xs font-bold" data-testid="input-trial-days" /><span className="text-[11px] text-muted-foreground">days</span><button onClick={() => startTrial.mutate(trialDays)} disabled={startTrial.isPending} className="ml-auto rounded-lg bg-primary px-2.5 py-1.5 text-[10px] font-extrabold text-primary-foreground disabled:opacity-50" data-testid="button-start-trial">{startTrial.isPending ? 'Starting…' : 'Start trial'}</button></div>}
      </div>
      <StudentDevicesSection studentId={id} />
      <div><div className="mb-2 text-xs font-bold uppercase tracking-wide text-muted-foreground">Payment history</div><div className="space-y-2">{s.payments.map((p) => <div key={p.id} className="rounded-lg border border-border p-3 text-xs"><div className="flex items-center justify-between"><span className="font-bold">{p.planName}</span><Badge tone={p.status === 'APPROVED' ? 'green' : p.status === 'REJECTED' ? 'red' : 'amber'}>{p.status}</Badge></div><div className="mt-1 text-muted-foreground">{money(p.amount, p.currency)} · {p.method} · {p.paymentDate}</div>{p.proofPath && <a href={resolveUploadUrl(p.proofPath)!} target="_blank" rel="noreferrer" className="mt-1.5 inline-flex items-center gap-1 text-[11px] font-bold text-primary" data-testid={`link-drawer-proof-${p.id}`}><FileText size={11} /> View payment proof</a>}</div>)}{!s.payments.length && <p className="text-xs text-muted-foreground">No payments yet.</p>}</div></div>
    </div>}
    {confirmingActivate && s && <ConfirmDialog title="Approve this student?" body={`This activates ${s.name}'s account and marks their email as verified, giving them full access immediately.`} confirmLabel="Approve student" pendingLabel="Approving…" tone="primary" testId="activate-student" onCancel={() => setConfirmingActivate(false)} onConfirm={() => { updateStatus.mutate({ status: 'ACTIVE', emailVerified: true }); setConfirmingActivate(false); }} pending={updateStatus.isPending} />}
  </div></div>;
}
