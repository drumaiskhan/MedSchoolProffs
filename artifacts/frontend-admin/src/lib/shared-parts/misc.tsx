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

import { InlineLoading, SectionHeader, cn, initials } from './ui';


export function TeamSection() {
  const q = useQuery({ queryKey: ['site-content'], queryFn: siteContentApi.get });
  const team = q.data?.team || [];
  if (!team.length) return null;
  const card = (m: TeamMember) => <div key={m.id} className="rounded-2xl border border-border bg-card p-5" data-testid={`card-team-${m.id}`}><div className="flex items-center gap-3">{m.photoPath ? <img src={resolveUploadUrl(m.photoPath)!} alt={m.name} loading="lazy" decoding="async" className="size-14 rounded-full border border-border object-cover" /> : <div className="grid size-14 place-items-center rounded-full bg-primary/15 text-sm font-extrabold text-primary">{initials(m.name)}</div>}<div><div className="text-sm font-bold">{m.name}</div><div className="text-xs text-primary">{m.role}</div></div></div>{m.achievementBadge && <span className="mt-3 inline-flex items-center gap-1 rounded-full bg-accent/20 px-2.5 py-1 text-[10px] font-bold text-accent-text"><Trophy size={11} /> {m.achievementBadge}</span>}{m.bio && <p className="mt-3 text-xs leading-5 text-muted-foreground">{m.bio}</p>}{(m.linkedinUrl || m.instagramUrl || m.email) && <div className="mt-3 flex gap-2">{m.linkedinUrl && <a href={m.linkedinUrl} target="_blank" rel="noreferrer" className="grid size-7 place-items-center rounded-full bg-muted text-[10px] font-bold hover:bg-primary/10 hover:text-primary">in</a>}{m.instagramUrl && <a href={m.instagramUrl} target="_blank" rel="noreferrer" className="grid size-7 place-items-center rounded-full bg-muted text-[10px] font-bold hover:bg-primary/10 hover:text-primary">ig</a>}{m.email && <a href={`mailto:${m.email}`} className="grid size-7 place-items-center rounded-full bg-muted hover:bg-primary/10 hover:text-primary"><Mail size={12} /></a>}</div>}</div>;
  return <div className="mt-9"><SectionHeader eyebrow="Behind the platform" title="Our Academic Team" />
    {TEAM_CATEGORIES.map((cat) => { const inCat = team.filter((m) => (m.category ?? 'reviewer') === cat); if (!inCat.length) return null; return <div key={cat} className="mb-6 last:mb-0"><div className="mb-3 text-[11px] font-bold uppercase tracking-wide text-muted-foreground">{TEAM_CATEGORY_LABELS[cat]}</div><div className="grid gap-4 sm:grid-cols-2">{inCat.map(card)}</div></div>; })}
  </div>;
}

// Buckets audit-log rows into the last 7 calendar days (today inclusive),
// summing each MCQ-import-shaped action's `metadata.count` (falling back to
// 1 per row if a row has no count) — powers the "MCQ imports" sparkline on
// the overview. MCQS_BULK_IMPORTED is the file-import commit; MCQ_BULK_CREATED
// covers the "add several manually / from AI drafts" flow, which is import-shaped
// in the same "many questions landed at once" sense.

export function buildMcqImportSeries(entries: AuditLogEntry[]): Array<{ date: string; label: string; count: number }> {
  const days: Array<{ date: string; label: string; count: number }> = [];
  const now = new Date();
  for (let i = 6; i >= 0; i--) {
    const dt = new Date(now.getFullYear(), now.getMonth(), now.getDate() - i);
    const y = dt.getFullYear(); const m = String(dt.getMonth() + 1).padStart(2, '0'); const dd = String(dt.getDate()).padStart(2, '0');
    days.push({ date: `${y}-${m}-${dd}`, label: dt.toLocaleDateString('en-US', { weekday: 'short' }), count: 0 });
  }
  const indexByDate = new Map(days.map((row, i) => [row.date, i]));
  for (const entry of entries) {
    if (entry.action !== 'MCQS_BULK_IMPORTED' && entry.action !== 'MCQ_BULK_CREATED') continue;
    const idx = indexByDate.get(entry.createdAt.slice(0, 10));
    if (idx === undefined) continue;
    let count = 1;
    if (entry.metadata) { try { const parsed = JSON.parse(entry.metadata); if (typeof parsed.count === 'number') count = parsed.count; } catch { /* ignore malformed metadata */ } }
    days[idx].count += count;
  }
  return days;
}

export function AdminAccountSection() {
  const me = useGetCurrentUser();
  const [newEmail, setNewEmail] = useState('');
  const [emailPassword, setEmailPassword] = useState('');
  const [emailError, setEmailError] = useState<string | null>(null);
  const [emailSaved, setEmailSaved] = useState(false);
  const updateEmail = useMutation({
    mutationFn: () => authApi.updateMe({ email: newEmail, currentPassword: emailPassword }),
    onSuccess: () => { setEmailSaved(true); setEmailPassword(''); queryClient.invalidateQueries({ queryKey: getGetCurrentUserQueryKey() }); },
    onError: (err: unknown) => setEmailError(err instanceof ApiRequestError ? err.message : 'Could not update email.'),
  });

  const [currentPassword, setCurrentPassword] = useState('');
  const [newPassword, setNewPassword] = useState('');
  const [passwordError, setPasswordError] = useState<string | null>(null);
  const [passwordSaved, setPasswordSaved] = useState(false);
  const changePassword = useMutation({
    mutationFn: () => authApi.changePassword(currentPassword, newPassword),
    onSuccess: () => { setPasswordSaved(true); setCurrentPassword(''); setNewPassword(''); },
    onError: (err: unknown) => setPasswordError(err instanceof ApiRequestError ? err.message : 'Could not change password.'),
  });

  return <div className="rounded-2xl border border-border bg-card p-6"><h3 className="font-bold">Your account</h3><p className="mt-1 text-xs text-muted-foreground">Currently signed in as <span className="font-bold">{me.data?.email}</span>. Change your login email or password here any time — the account seeded on first deploy should have both changed promptly.</p>
    <div className="mt-5 grid gap-6 sm:grid-cols-2">
      <form onSubmit={(e) => { e.preventDefault(); setEmailError(null); setEmailSaved(false); updateEmail.mutate(); }} className="space-y-2"><div className="text-xs font-bold">Change email</div><input required type="email" value={newEmail} onChange={(e) => setNewEmail(e.target.value)} placeholder="New email address" className="h-10 w-full rounded-xl border border-border bg-background px-3 text-xs" data-testid="input-admin-new-email" /><input required type="password" value={emailPassword} onChange={(e) => setEmailPassword(e.target.value)} placeholder="Current password to confirm" className="h-10 w-full rounded-xl border border-border bg-background px-3 text-xs" data-testid="input-admin-email-confirm-password" />{emailError && <p className="text-[11px] font-semibold text-destructive">{emailError}</p>}{emailSaved && <p className="text-[11px] font-semibold text-primary">Email updated.</p>}<button disabled={updateEmail.isPending} className="rounded-xl border border-border bg-background px-4 py-2 text-xs font-bold disabled:opacity-50" data-testid="button-update-admin-email">{updateEmail.isPending ? 'Saving…' : 'Update email'}</button></form>
      <form onSubmit={(e) => { e.preventDefault(); setPasswordError(null); setPasswordSaved(false); changePassword.mutate(); }} className="space-y-2"><div className="text-xs font-bold">Change password</div><input required type="password" value={currentPassword} onChange={(e) => setCurrentPassword(e.target.value)} placeholder="Current password" className="h-10 w-full rounded-xl border border-border bg-background px-3 text-xs" data-testid="input-admin-current-password" /><input required minLength={8} type="password" value={newPassword} onChange={(e) => setNewPassword(e.target.value)} placeholder="New password" className="h-10 w-full rounded-xl border border-border bg-background px-3 text-xs" data-testid="input-admin-new-password" />{passwordError && <p className="text-[11px] font-semibold text-destructive">{passwordError}</p>}{passwordSaved && <p className="text-[11px] font-semibold text-primary">Password changed.</p>}<button disabled={changePassword.isPending} className="rounded-xl border border-border bg-background px-4 py-2 text-xs font-bold disabled:opacity-50" data-testid="button-change-admin-password">{changePassword.isPending ? 'Saving…' : 'Change password'}</button></form>
    </div>
  </div>;
}

// Small click-to-upload image button, reused for the favicon and the payment
// QR code. Uploads immediately on file selection — the resulting storage
// path is handed back via onUploaded so the caller can stash it in its own
// form state and save it along with everything else on that page.

export function AdminImageUpload({ currentUrl, kind, accept, hint, testId, onUploaded }: { currentUrl: string; kind: 'favicon' | 'resource'; accept: string; hint: string; testId: string; onUploaded: (storagePath: string, previewUrl: string | null) => void }) {
  const [uploading, setUploading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [localPreview, setLocalPreview] = useState<string | null>(null);

  const onFile = async (file: File | undefined) => {
    if (!file) return;
    setError(null);
    setUploading(true);
    try {
      const { storagePath, url } = await uploadFile(file, kind);
      setLocalPreview(url);
      onUploaded(storagePath, url);
    } catch (err) {
      setError(err instanceof ApiRequestError ? err.message : 'Upload failed');
    } finally {
      setUploading(false);
    }
  };

  const preview = resolveUploadUrl(localPreview || currentUrl || null);
  const [broken, setBroken] = useState(false);

  return <div className="flex items-center gap-4">
    <label className={cn('grid size-16 shrink-0 cursor-pointer place-items-center rounded-2xl border-2 border-dashed border-border bg-background text-muted-foreground transition-colors hover:border-primary/50', uploading && 'opacity-60')}>
      {preview && !broken ? <img src={preview} alt="Upload preview" className="size-full rounded-2xl object-contain p-1.5" onLoad={() => setBroken(false)} onError={() => setBroken(true)} /> : <ImageOff size={18} />}
      <input type="file" accept={accept} className="hidden" onChange={(e) => { setBroken(false); onFile(e.target.files?.[0]); }} data-testid={testId} />
    </label>
    <div className="min-w-0 flex-1">
      <div className="flex items-center gap-2 text-xs font-bold"><UploadCloud size={13} /> {uploading ? 'Uploading…' : 'Click the tile to upload'}</div>
      <p className="mt-1 text-[11px] leading-4 text-muted-foreground">{hint}</p>
      {error && <p className="mt-1 text-[11px] font-semibold text-destructive">{error}</p>}
      {!error && preview && broken && <p className="mt-1 text-[11px] font-semibold text-destructive">Uploaded, but the file isn't loading back — this usually means local storage isn't configured to persist. See the storage note below.</p>}
    </div>
  </div>;
}

export function FaviconUploader({ currentUrl, onUploaded }: { currentUrl: string; onUploaded: (storagePath: string, previewUrl: string | null) => void }) {
  return <AdminImageUpload currentUrl={currentUrl} kind="favicon" accept="image/png,image/x-icon,image/svg+xml,image/webp" hint="PNG, ICO, SVG, or WEBP · square, under 1MB. Shows in the browser tab for both the student and admin sites." testId="input-favicon-upload" onUploaded={onUploaded} />;
}

export function NotificationBroadcastPanel() {
  const [title, setTitle] = useState('');
  const [body, setBody] = useState('');
  const [type, setType] = useState<'info' | 'success' | 'warning'>('info');
  const [programTargetKind, setProgramTargetKind] = useState('');
  const [yearTargetNumber, setYearTargetNumber] = useState('');
  // A targeted broadcast (program and/or year set) writes one notification
  // row per matching STUDENT — the sending admin is never one of those
  // rows, so it never shows up in their own bell. That made a
  // successfully-sent targeted notification look identical to a silently
  // failed one: a toast flashes past, then there's no lasting evidence it
  // went anywhere. This panel now also lists every broadcast from the
  // audit log (already recorded server-side, with the recipient count) so
  // "did that actually send?" has a real, persistent answer.
  const auditQ = useQuery({ queryKey: ['admin-audit-logs', 'notifications'], queryFn: () => auditApi.list(200) });
  const recentBroadcasts = (auditQ.data || []).filter((a) => a.action === 'NOTIFICATION_BROADCAST').slice(0, 8);

  const send = useMutation({
    mutationFn: () => notificationsApi.broadcast({
      title: title.trim(),
      body: body.trim(),
      type,
      programTargetKind: programTargetKind || null,
      yearTargetNumber: yearTargetNumber ? Number(yearTargetNumber) : null,
    }),
    onSuccess: (res) => {
      setTitle(''); setBody('');
      toast({ title: 'Notification sent', description: res.targetedUsers === null ? 'Delivered to every student.' : res.targetedUsers === 0 ? 'Sent, but no student currently matches that program/year — nothing was delivered.' : `Delivered to ${res.targetedUsers} matching student${res.targetedUsers === 1 ? '' : 's'}.`, variant: res.targetedUsers === 0 ? 'destructive' : undefined });
      queryClient.invalidateQueries({ queryKey: ['admin-audit-logs', 'notifications'] });
    },
    onError: (err: unknown) => toast({ title: 'Could not send notification', description: err instanceof ApiRequestError ? err.message : 'Something went wrong.', variant: 'destructive' }),
  });

  const scopeLabel = `${programTargetKind || 'All programs'} · ${yearTargetNumber ? `${yearTargetNumber}${['th', 'st', 'nd', 'rd'][Number(yearTargetNumber) % 10 > 3 ? 0 : Number(yearTargetNumber) % 10]} Year` : 'All years'}`;

  return <div className="rounded-2xl border border-border bg-card p-6">
    <h3 className="font-bold">Send a notification</h3>
    <p className="mt-1 text-xs text-muted-foreground">Reaches students' notification bells right away. Narrow it to a program and/or year, or leave both as "All" to reach everyone.</p>
    <div className="mt-5 grid gap-4 sm:grid-cols-2">
      <label className="text-xs font-bold sm:col-span-2">Title<input value={title} onChange={(e) => setTitle(e.target.value)} placeholder="e.g. New past paper uploaded" className="mt-2 h-10 w-full rounded-xl border border-border bg-background px-3 text-xs" data-testid="input-notification-title" /></label>
      <label className="text-xs font-bold sm:col-span-2">Message<textarea value={body} onChange={(e) => setBody(e.target.value)} placeholder="What should students know?" className="mt-2 min-h-20 w-full rounded-xl border border-border bg-background p-3 text-xs" data-testid="input-notification-body" /></label>
      <label className="text-xs font-bold">Type<select value={type} onChange={(e) => setType(e.target.value as typeof type)} className="mt-2 h-10 w-full rounded-xl border border-border bg-background px-3 text-xs capitalize" data-testid="select-notification-type">{['info', 'success', 'warning'].map((t) => <option key={t} value={t}>{t}</option>)}</select></label>
      <div />
      <label className="text-xs font-bold">Programme<select value={programTargetKind} onChange={(e) => setProgramTargetKind(e.target.value)} className="mt-2 h-10 w-full rounded-xl border border-border bg-background px-3 text-xs" data-testid="select-notification-program"><option value="">All programs</option><option value="MBBS">MBBS</option><option value="BDS">BDS</option></select></label>
      <label className="text-xs font-bold">Year<select value={yearTargetNumber} onChange={(e) => setYearTargetNumber(e.target.value)} className="mt-2 h-10 w-full rounded-xl border border-border bg-background px-3 text-xs" data-testid="select-notification-year"><option value="">All years</option>{[1, 2, 3, 4, 5, 6].map((y) => <option key={y} value={y}>Year {y}</option>)}</select></label>
    </div>
    <div className="mt-4 flex flex-wrap items-center justify-between gap-3 rounded-xl bg-muted px-4 py-2.5 text-[11px] font-semibold text-muted-foreground"><span>Will reach: {scopeLabel}</span></div>
    <button onClick={() => send.mutate()} disabled={send.isPending || !title.trim() || !body.trim()} className="mt-4 rounded-xl bg-primary px-5 py-3 text-xs font-extrabold text-primary-foreground disabled:opacity-50" data-testid="button-send-notification">{send.isPending ? 'Sending…' : 'Send notification'}</button>

    <div className="mt-6 border-t border-border pt-5">
      <h4 className="text-xs font-bold text-muted-foreground">Recently sent</h4>
      {!recentBroadcasts.length && <p className="mt-2 text-[11px] text-muted-foreground">Nothing sent yet.</p>}
      <div className="mt-3 space-y-2">{recentBroadcasts.map((a) => {
        let meta: { title?: string; body?: string; scope?: string; targetedUsers?: number | null } = {};
        try { meta = a.metadata ? JSON.parse(a.metadata) : {}; } catch { /* older rows had no metadata — fall back to the bare log line below */ }
        const delivered = meta.targetedUsers === null || meta.targetedUsers === undefined ? null : meta.targetedUsers;
        return <div key={a.id} className="flex items-start justify-between gap-3 rounded-xl border border-border bg-background px-3.5 py-2.5" data-testid={`row-recent-broadcast-${a.id}`}>
          <div className="min-w-0"><div className="truncate text-xs font-bold">{meta.title || 'Notification'}</div><div className="mt-0.5 text-[10px] text-muted-foreground">{meta.scope || '—'} · {a.createdAt}</div></div>
          <span className={cn('shrink-0 rounded-full px-2 py-1 text-[10px] font-bold', delivered === 0 ? 'bg-destructive/10 text-destructive' : 'bg-primary/15 text-primary')}>{delivered === null ? 'Everyone' : `${delivered} delivered`}</span>
        </div>;
      })}</div>
    </div>
  </div>;
}

export function FeedbackThread({ feedbackId }: { feedbackId: number }) {
  const repliesQ = useQuery({ queryKey: ['feedback-replies', feedbackId], queryFn: () => feedbackApi.listReplies(feedbackId) });
  const [message, setMessage] = useState('');
  const reply = useMutation({
    mutationFn: () => feedbackApi.reply(feedbackId, message.trim()),
    onSuccess: () => { setMessage(''); queryClient.invalidateQueries({ queryKey: ['feedback-replies', feedbackId] }); queryClient.invalidateQueries({ queryKey: ['admin-feedback'] }); },
    onError: (err: unknown) => toast({ title: 'Could not send reply', description: err instanceof ApiRequestError ? err.message : 'Something went wrong.', variant: 'destructive' }),
  });
  return <div className="mt-4 space-y-3 border-t border-border pt-4">
    {repliesQ.isLoading ? <InlineLoading label="Loading replies…" /> : (repliesQ.data || []).map((r) => <div key={r.id} className={cn('max-w-[85%] rounded-xl p-3 text-xs', r.authorRole === 'admin' ? 'ml-auto bg-primary/10' : 'bg-muted')} data-testid={`row-feedback-reply-${r.id}`}><div className="mb-1 text-[10px] font-bold text-muted-foreground">{r.authorRole === 'admin' ? 'Academic team' : 'Student'} · {new Date(r.createdAt).toLocaleString()}</div>{r.message}</div>)}
    {!repliesQ.isLoading && !repliesQ.data?.length && <p className="text-xs text-muted-foreground">No replies yet — be the first to respond.</p>}
    <div className="flex gap-2"><textarea value={message} onChange={(e) => setMessage(e.target.value)} placeholder="Write a reply…" className="min-h-16 flex-1 rounded-xl border border-border bg-background p-2 text-xs" data-testid={`input-feedback-reply-${feedbackId}`} /><button onClick={() => message.trim() && reply.mutate()} disabled={reply.isPending || !message.trim()} className="self-end rounded-xl bg-primary px-4 py-2 text-xs font-bold text-primary-foreground disabled:opacity-50" data-testid={`button-send-feedback-reply-${feedbackId}`}>{reply.isPending ? 'Sending…' : 'Reply'}</button></div>
  </div>;
}

export function ColorField({ label, value, onChange, testId }: { label: string; value: string; onChange: (value: string) => void; testId: string }) {
  const safe = /^#[0-9a-fA-F]{6}$/.test(value) ? value : '#ffffff';
  return <label className="block text-xs font-bold">{label}
    <div className="mt-2 flex items-center gap-2">
      <span className="relative grid size-10 shrink-0 place-items-center overflow-hidden rounded-lg border border-border" style={{ backgroundColor: safe }}>
        <input type="color" value={safe} onChange={(e) => onChange(e.target.value)} className="absolute inset-0 size-full cursor-pointer opacity-0" data-testid={`input-color-picker-${testId}`} />
      </span>
      <input value={value} onChange={(e) => onChange(e.target.value)} placeholder="#000000" maxLength={7} className="h-10 w-28 rounded-lg border border-border bg-background px-2 font-mono-app text-xs uppercase outline-none focus:ring-2 focus:ring-primary/20" data-testid={`input-color-hex-${testId}`} />
    </div>
  </label>;
}

export function TeamPhoto({ member }: { member: TeamMember }) {
  const [broken, setBroken] = useState(false);
  const url = member.photoPath ? resolveUploadUrl(member.photoPath) : null;
  if (!url || broken) return <div className="grid size-11 shrink-0 place-items-center rounded-full bg-primary/15 text-xs font-extrabold text-primary">{initials(member.name)}</div>;
  return <img src={url} alt={member.name} loading="lazy" decoding="async" className="size-11 shrink-0 rounded-full object-cover" onError={() => setBroken(true)} />;
}
