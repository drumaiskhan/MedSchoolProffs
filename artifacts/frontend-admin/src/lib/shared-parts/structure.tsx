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

import { AdminImageUpload } from './misc';
import { Badge, ConfirmDialog, cn } from './ui';


export const YEAR_OPTIONS = [1, 2, 3, 4, 5];

export function ModuleTargetingFields({ programTargetKind, yearTargetNumber, onChange }: { programTargetKind: string; yearTargetNumber: string; onChange: (patch: { programTargetKind?: string; yearTargetNumber?: string }) => void }) {
  return <div className="flex flex-wrap gap-3"><label className="text-xs font-bold">Program<select value={programTargetKind} onChange={(e) => onChange({ programTargetKind: e.target.value })} className="mt-1 h-10 rounded-xl border border-border bg-card px-3 text-xs" data-testid="select-module-program-target"><option value="">All Programs</option><option value="MBBS">MBBS</option><option value="BDS">BDS</option></select></label><label className="text-xs font-bold">Academic year<select value={yearTargetNumber} onChange={(e) => onChange({ yearTargetNumber: e.target.value })} className="mt-1 h-10 rounded-xl border border-border bg-card px-3 text-xs" data-testid="select-module-year-target"><option value="">All Years</option>{YEAR_OPTIONS.map((y) => <option key={y} value={y}>{y}{y === 1 ? 'st' : y === 2 ? 'nd' : y === 3 ? 'rd' : 'th'} Year</option>)}</select></label></div>;
}

// A single module row — exactly the markup AdminContent always rendered,
// just extracted so it can be reused inside each block's group and inside
// the "Unassigned modules" group without redesigning it.

export function ModuleRow({ m, canMoveUp, canMoveDown, onReorder, update, curriculumId, setCurriculumId, editingId, setEditingId, editProgram, setEditProgram, editYear, setEditYear, setDeletingId }: {
  m: AdminModule; canMoveUp: boolean; canMoveDown: boolean; onReorder: (direction: 'up' | 'down') => void;
  update: ReturnType<typeof useMutation<AdminModule, unknown, { id: number; body: Parameters<typeof moduleAdminApi.update>[1] }>>;
  curriculumId: number | null; setCurriculumId: (id: number | null) => void;
  editingId: number | null; setEditingId: (id: number | null) => void;
  editProgram: string; setEditProgram: (v: string) => void; editYear: string; setEditYear: (v: string) => void;
  setDeletingId: (id: number) => void;
}) {
  // Module name previously had no rename UI at all — the Pencil button only
  // ever opened program/year targeting below. Blocks/Subjects/Topics could
  // all be renamed; a Module could not, even though PATCH /modules/:id
  // already accepts a `name`. Local state (not lifted like editProgram/
  // editYear) since it's only ever read/written while this row's own edit
  // panel is open.
  const [editName, setEditName] = useState(m.name);
  // Thumbnail could be set at creation (AddModuleForm) but never changed
  // afterward — the edit panel below had no image control at all, even
  // though PATCH /modules/:id already accepts iconPath (same as Blocks and
  // Subjects, which both already have this in their own edit forms).
  // `undefined` = "leave as-is" (not touched this session), `null` =
  // "explicitly cleared" — same sentinel AdminSubjectsPage's edit form uses,
  // so the save button only sends iconPath when it actually changed.
  const [editIcon, setEditIcon] = useState<string | null | undefined>(undefined);
  const [editIconPreview, setEditIconPreview] = useState<string | null>(null);
  return <div className="border-b border-border p-4 last:border-0 sm:p-5" data-testid={`row-content-module-${m.id}`}>
    <div className="flex flex-wrap items-center gap-x-4 gap-y-2">
      <div className="flex flex-col gap-0.5">
        <button onClick={() => onReorder('up')} disabled={!canMoveUp || update.isPending} className="rounded p-0.5 text-muted-foreground disabled:opacity-25 hover:bg-muted" data-testid={`button-module-move-up-${m.id}`}><ChevronUp size={13} /></button>
        <button onClick={() => onReorder('down')} disabled={!canMoveDown || update.isPending} className="rounded p-0.5 text-muted-foreground disabled:opacity-25 hover:bg-muted" data-testid={`button-module-move-down-${m.id}`}><ChevronDown size={13} /></button>
      </div>
      <div className="grid size-10 shrink-0 place-items-center overflow-hidden rounded-xl bg-primary/15 text-primary">{m.iconUrl ? <img src={resolveUploadUrl(m.iconUrl) ?? undefined} alt="" loading="lazy" decoding="async" className="size-full object-cover" /> : <BookOpen size={18} />}</div>
      <div className="min-w-[8rem] flex-1"><div className="text-sm font-bold">{m.name}</div><div className="mt-1 text-xs text-muted-foreground">{m.subjectCount} subjects · {m.topicCount} topics</div></div>
      <button onClick={() => update.mutate({ id: m.id, body: { active: !m.active } })} disabled={update.isPending} data-testid={`button-toggle-published-${m.id}`}><Badge tone={m.active ? 'green' : 'neutral'}>{m.active ? 'published' : 'draft'}</Badge></button>
      <span className="rounded-full bg-muted px-2.5 py-1 text-[10px] font-bold text-muted-foreground" data-testid={`text-targeting-${m.id}`}>{m.targetingLabel || 'All Programs + All Years'}</span>
      <button onClick={() => setCurriculumId(curriculumId === m.id ? null : m.id)} className={cn('rounded-lg px-3 py-2 text-[11px] font-bold', curriculumId === m.id ? 'bg-primary/10 text-primary' : 'border border-border text-muted-foreground hover:bg-muted')} data-testid={`button-manage-curriculum-${m.id}`}>{curriculumId === m.id ? 'Hide subjects' : 'Subjects & topics'}</button>
      <button onClick={() => { if (editingId === m.id) { setEditingId(null); } else { setEditingId(m.id); setEditName(m.name); setEditProgram(m.programTargetKind || ''); setEditYear(m.yearTargetNumber ? String(m.yearTargetNumber) : ''); setEditIcon(undefined); setEditIconPreview(m.iconUrl ?? null); } }} className="rounded-lg p-2 text-muted-foreground hover:bg-muted" data-testid={`button-content-menu-${m.id}`}><Pencil size={15} /></button>
      <button onClick={() => setDeletingId(m.id)} className="rounded-lg p-2 text-muted-foreground hover:bg-destructive/10 hover:text-destructive" data-testid={`button-delete-module-${m.id}`}><Trash2 size={15} /></button>
    </div>
    {editingId === m.id && <div className="mt-4 space-y-3 border-t border-border pt-4">
      <label className="block text-[11px] font-bold text-muted-foreground">Module name<input value={editName} onChange={(e) => setEditName(e.target.value)} className="mt-1 h-9 w-full max-w-sm rounded-lg border border-border bg-background px-3 text-xs" data-testid={`input-rename-module-${m.id}`} /></label>
      <div className="max-w-sm"><div className="mb-1 text-[11px] font-bold text-muted-foreground">Thumbnail</div><AdminImageUpload currentUrl={editIconPreview || ''} kind="resource" accept="image/png,image/jpeg,image/webp" hint="Optional thumbnail · PNG, JPEG, or WEBP." testId={`input-module-icon-upload-${m.id}`} onUploaded={(storagePath, previewUrl) => { setEditIcon(storagePath); setEditIconPreview(previewUrl); }} /></div>
      <div className="flex flex-wrap items-end gap-3"><ModuleTargetingFields programTargetKind={editProgram} yearTargetNumber={editYear} onChange={(patch) => { if (patch.programTargetKind !== undefined) setEditProgram(patch.programTargetKind); if (patch.yearTargetNumber !== undefined) setEditYear(patch.yearTargetNumber); }} /><button onClick={() => { if (!editName.trim()) return; update.mutate({ id: m.id, body: { name: editName.trim(), programTargetKind: editProgram || null, yearTargetNumber: editYear ? Number(editYear) : null, ...(editIcon !== undefined ? { iconPath: editIcon } : {}) } }, { onSuccess: () => setEditingId(null) } as never); }} disabled={!editName.trim() || update.isPending} className="h-10 rounded-xl bg-primary px-4 text-xs font-bold text-primary-foreground disabled:opacity-50" data-testid={`button-save-targeting-${m.id}`}>Save changes</button></div>
    </div>}
    {curriculumId === m.id && <div className="mt-4 border-t border-border pt-4"><SubjectsTopicsManager moduleId={m.id} breadcrumb={`${m.blockName || 'Other modules'} > ${m.name}`} /></div>}
  </div>;
}

// The "Add module" form, scoped to a specific block (or null for
// Unassigned) — pre-fills blockId so a module created from inside a block's
// section lands in that block.
//
// Round 3, item 7: dropped the "Subtitle" input (name + thumbnail only,
// same as the block form) and added the same optional-thumbnail upload
// blocks already had — modules previously had no thumbnail field at all.

export function AddModuleForm({ blockId, onCreate, onDone }: { blockId: number | null; onCreate: ReturnType<typeof useMutation<AdminModule, unknown, Parameters<typeof moduleAdminApi.create>[0]>>; onDone: () => void }) {
  const [program, setProgram] = useState('');
  const [year, setYear] = useState('');
  const [iconPath, setIconPath] = useState<string | null>(null);
  const [iconPreview, setIconPreview] = useState<string | null>(null);
  return <form onSubmit={(e) => { e.preventDefault(); const f = new FormData(e.currentTarget); onCreate.mutate({ name: String(f.get('name')), subtitle: '', active: true, blockId, iconPath: iconPath ?? undefined, programTargetKind: program || null, yearTargetNumber: year ? Number(year) : null }, { onSuccess: onDone }); }} className="mb-5 space-y-3 rounded-2xl border border-primary/30 bg-primary/10 p-5">
    <input required name="name" placeholder="Module name" className="h-10 w-full rounded-xl border border-border bg-card px-3 text-xs" data-testid="input-module-name" />
    <AdminImageUpload currentUrl={iconPreview || ''} kind="resource" accept="image/png,image/jpeg,image/webp" hint="Optional thumbnail · PNG, JPEG, or WEBP." testId="input-module-icon-upload" onUploaded={(storagePath, previewUrl) => { setIconPath(storagePath); setIconPreview(previewUrl); }} />
    <ModuleTargetingFields programTargetKind={program} yearTargetNumber={year} onChange={(patch) => { if (patch.programTargetKind !== undefined) setProgram(patch.programTargetKind); if (patch.yearTargetNumber !== undefined) setYear(patch.yearTargetNumber); }} />
    <p className="text-[11px] text-muted-foreground">This module will be visible to: <span className="font-bold text-primary">{(program || 'All Programs')} + {(year ? `${year}${year === '1' ? 'st' : year === '2' ? 'nd' : year === '3' ? 'rd' : 'th'} Year` : 'All Years')}</span></p>
    <button className="rounded-xl bg-primary px-4 py-2 text-xs font-bold text-primary-foreground" data-testid="button-save-module">Save</button>
  </form>;
}

// The "Add block" / edit-block form, with an optional thumbnail upload
// (reuses AdminImageUpload the same way the payment QR code does).
//
// Round 3, item 7: dropped the "Subtitle" input — name + thumbnail only.
// Nothing downstream reads block.subtitle for display anymore either (the
// student Blocks/BlockDetail hero cards show only the name over the
// thumbnail); the field itself stays in the schema/API as an optional,
// no-longer-editable legacy value rather than being ripped out everywhere,
// so any block created before this change doesn't lose the text it has.

export function BlockForm({ initial, onSubmit, pending, onCancel }: { initial?: AdminBlock; onSubmit: (body: Parameters<typeof blockAdminApi.create>[0]) => void; pending: boolean; onCancel: () => void }) {
  const [program, setProgram] = useState(initial?.programTargetKind || '');
  const [year, setYear] = useState(initial?.yearTargetNumber ? String(initial.yearTargetNumber) : '');
  const [iconPath, setIconPath] = useState<string | null>(null);
  const [iconPreview, setIconPreview] = useState<string | null>(initial?.iconUrl ?? null);
  return <form onSubmit={(e) => { e.preventDefault(); const f = new FormData(e.currentTarget); onSubmit({ name: String(f.get('name')), subtitle: initial?.subtitle || '', active: true, iconPath: iconPath ?? undefined, programTargetKind: program || null, yearTargetNumber: year ? Number(year) : null }); }} className="mb-5 space-y-3 rounded-2xl border border-primary/30 bg-primary/10 p-5">
    <input required name="name" defaultValue={initial?.name} placeholder="Block name (e.g. Block A)" className="h-10 w-full rounded-xl border border-border bg-card px-3 text-xs" data-testid="input-block-name" />
    <AdminImageUpload currentUrl={iconPreview || ''} kind="resource" accept="image/png,image/jpeg,image/webp" hint="Optional thumbnail · PNG, JPEG, or WEBP." testId="input-block-icon-upload" onUploaded={(storagePath, previewUrl) => { setIconPath(storagePath); setIconPreview(previewUrl); }} />
    <ModuleTargetingFields programTargetKind={program} yearTargetNumber={year} onChange={(patch) => { if (patch.programTargetKind !== undefined) setProgram(patch.programTargetKind); if (patch.yearTargetNumber !== undefined) setYear(patch.yearTargetNumber); }} />
    <div className="flex gap-2"><button disabled={pending} className="rounded-xl bg-primary px-4 py-2 text-xs font-bold text-primary-foreground" data-testid="button-save-block">Save</button><button type="button" onClick={onCancel} className="rounded-xl border border-border px-4 py-2 text-xs font-bold text-muted-foreground">Cancel</button></div>
  </form>;
}

export function SubjectsTopicsManager({ moduleId, breadcrumb }: { moduleId: number; breadcrumb?: string }) {
  const subjectsQ = useQuery({ queryKey: ['admin-subjects', moduleId], queryFn: () => subjectAdminApi.list(moduleId) });
  const subjects = [...(subjectsQ.data ?? [])].sort((a, b) => (a.displayOrder ?? 0) - (b.displayOrder ?? 0));
  const [expandedSubjectId, setExpandedSubjectId] = useState<number | null>(null);
  const [newSubjectName, setNewSubjectName] = useState('');
  const [newSubjectIcon, setNewSubjectIcon] = useState<string | null>(null);
  const [newSubjectIconPreview, setNewSubjectIconPreview] = useState<string | null>(null);
  const [deletingSubjectId, setDeletingSubjectId] = useState<number | null>(null);
  const [editingSubjectId, setEditingSubjectId] = useState<number | null>(null);
  const [editSubjectName, setEditSubjectName] = useState('');
  // undefined = thumbnail left as-is; null/string = explicitly changed.
  const [editSubjectIcon, setEditSubjectIcon] = useState<string | null | undefined>(undefined);
  const [editSubjectIconPreview, setEditSubjectIconPreview] = useState<string | null>(null);

  const invalidateSubjects = () => { queryClient.invalidateQueries({ queryKey: ['admin-subjects', moduleId] }); queryClient.invalidateQueries({ queryKey: ['admin-subjects-all'] }); };
  const createSubject = useMutation({ mutationFn: subjectAdminApi.create, onSuccess: () => { invalidateSubjects(); setNewSubjectName(''); setNewSubjectIcon(null); setNewSubjectIconPreview(null); }, onError: (err: unknown) => toast({ title: 'Could not create subject', description: err instanceof ApiRequestError ? err.message : 'Something went wrong.', variant: 'destructive' }) });
  const updateSubject = useMutation({ mutationFn: ({ id, body }: { id: number; body: Parameters<typeof subjectAdminApi.update>[1] }) => subjectAdminApi.update(id, body), onSuccess: () => { invalidateSubjects(); setEditingSubjectId(null); }, onError: (err: unknown) => toast({ title: 'Could not update subject', description: err instanceof ApiRequestError ? err.message : 'Something went wrong.', variant: 'destructive' }) });
  const removeSubject = useMutation({ mutationFn: subjectAdminApi.remove, onSuccess: () => { invalidateSubjects(); setDeletingSubjectId(null); }, onError: (err: unknown) => toast({ title: 'Could not delete subject', description: err instanceof ApiRequestError ? err.message : 'Something went wrong.', variant: 'destructive' }) });
  // Renumber-the-whole-list reorder (same fix as AdminInstitutionsList) —
  // avoids the "swap two rows that share the same displayOrder does
  // nothing" trap that made the institution arrows silently do nothing.
  const reorderSubjects = useMutation({
    mutationFn: (rows: { id: number; displayOrder: number }[]) => Promise.all(rows.map((r) => subjectAdminApi.update(r.id, { displayOrder: r.displayOrder }))),
    onSuccess: invalidateSubjects,
    onError: (err: unknown) => toast({ title: 'Could not reorder subjects', description: err instanceof ApiRequestError ? err.message : 'Something went wrong.', variant: 'destructive' }),
  });
  const moveSubject = (index: number, dir: -1 | 1) => {
    const target = index + dir;
    if (target < 0 || target >= subjects.length || reorderSubjects.isPending) return;
    const reordered = [...subjects];
    [reordered[index], reordered[target]] = [reordered[target], reordered[index]];
    reorderSubjects.mutate(reordered.map((s, i) => ({ id: s.id, displayOrder: i })));
  };
  const startEditSubject = (s: AdminSubject) => { setEditingSubjectId(s.id); setEditSubjectName(s.name); setEditSubjectIcon(undefined); setEditSubjectIconPreview(s.iconUrl ?? null); };

  return <div className="rounded-2xl bg-muted/40 p-4">
    {/* Makes the Block > Module > Subjects nesting explicit at the point
        subjects/topics are managed, instead of only being implied by which
        collapsible section this drawer happens to be open under. */}
    {breadcrumb && <div className="mb-2 text-[10px] font-semibold text-muted-foreground" data-testid="text-curriculum-breadcrumb">{breadcrumb} <ChevronRight size={10} className="mx-0.5 inline" /> Subjects</div>}
    <div className="mb-3 text-[11px] font-bold uppercase tracking-wide text-muted-foreground">Subjects</div>
    <div className="space-y-2">{subjects.map((s, i) => <div key={s.id} className="rounded-xl border border-border bg-card">
      <div className="flex items-center gap-2 p-3">
        <div className="flex shrink-0 flex-col">
          <button type="button" disabled={i === 0 || reorderSubjects.isPending} onClick={() => moveSubject(i, -1)} className="grid size-4 place-items-center text-muted-foreground hover:text-foreground disabled:opacity-30" data-testid={`button-move-up-subject-${s.id}`} aria-label="Move up"><ChevronUp size={12} /></button>
          <button type="button" disabled={i === subjects.length - 1 || reorderSubjects.isPending} onClick={() => moveSubject(i, 1)} className="grid size-4 place-items-center text-muted-foreground hover:text-foreground disabled:opacity-30" data-testid={`button-move-down-subject-${s.id}`} aria-label="Move down"><ChevronDown size={12} /></button>
        </div>
        {s.iconUrl && <img src={resolveUploadUrl(s.iconUrl) ?? undefined} alt="" loading="lazy" decoding="async" className="size-8 shrink-0 rounded-lg object-cover" data-testid={`img-subject-thumbnail-${s.id}`} />}
        <button onClick={() => setExpandedSubjectId(expandedSubjectId === s.id ? null : s.id)} className="flex flex-1 items-center gap-2 text-left text-xs font-bold" data-testid={`row-subject-${s.id}`}><ChevronRight size={13} className={cn('transition-transform', expandedSubjectId === s.id && 'rotate-90')} /> {s.name} <span className="font-normal text-muted-foreground">· {s.topicCount} topics</span></button>
        <button onClick={() => startEditSubject(s)} className="rounded-lg p-1.5 text-muted-foreground hover:bg-muted" data-testid={`button-edit-subject-${s.id}`}><Pencil size={13} /></button>
        <button onClick={() => setDeletingSubjectId(s.id)} className="rounded-lg p-1.5 text-muted-foreground hover:bg-destructive/10 hover:text-destructive" data-testid={`button-delete-subject-${s.id}`}><Trash2 size={13} /></button>
      </div>
      {editingSubjectId === s.id && <form onSubmit={(e) => { e.preventDefault(); if (!editSubjectName.trim()) return; updateSubject.mutate({ id: s.id, body: { name: editSubjectName.trim(), ...(editSubjectIcon !== undefined ? { iconPath: editSubjectIcon } : {}) } }); }} className="space-y-2 border-t border-border p-3">
        <input autoFocus value={editSubjectName} onChange={(e) => setEditSubjectName(e.target.value)} className="h-9 w-full rounded-lg border border-border bg-background px-3 text-xs" data-testid={`input-rename-subject-${s.id}`} />
        <AdminImageUpload currentUrl={editSubjectIconPreview || ''} kind="resource" accept="image/png,image/jpeg,image/webp" hint="Optional thumbnail · PNG, JPEG, or WEBP." testId={`input-subject-icon-upload-${s.id}`} onUploaded={(storagePath, previewUrl) => { setEditSubjectIcon(storagePath); setEditSubjectIconPreview(previewUrl); }} />
        <div className="flex gap-2"><button type="submit" disabled={updateSubject.isPending} className="rounded-lg bg-primary px-3 py-1.5 text-[11px] font-bold text-primary-foreground disabled:opacity-50" data-testid={`button-save-subject-${s.id}`}>Save</button><button type="button" onClick={() => setEditingSubjectId(null)} className="rounded-lg border border-border px-3 py-1.5 text-[11px] font-bold text-muted-foreground" data-testid={`button-cancel-edit-subject-${s.id}`}>Cancel</button></div>
      </form>}
      {expandedSubjectId === s.id && <div className="border-t border-border p-3"><TopicsManager subjectId={s.id} /></div>}
    </div>)}{!subjects.length && <p className="text-xs text-muted-foreground">No subjects yet — add one below.</p>}</div>
    <form onSubmit={(e) => { e.preventDefault(); if (newSubjectName.trim()) createSubject.mutate({ moduleId, name: newSubjectName.trim(), active: true, iconPath: newSubjectIcon ?? undefined }); }} className="mt-3 space-y-2 rounded-xl border border-dashed border-border p-3">
      <input value={newSubjectName} onChange={(e) => setNewSubjectName(e.target.value)} placeholder="Add subject, e.g. Anatomy" className="h-9 w-full rounded-lg border border-border bg-background px-3 text-xs" data-testid="input-add-subject" />
      <AdminImageUpload currentUrl={newSubjectIconPreview || ''} kind="resource" accept="image/png,image/jpeg,image/webp" hint="Optional thumbnail · PNG, JPEG, or WEBP." testId="input-new-subject-icon-upload" onUploaded={(storagePath, previewUrl) => { setNewSubjectIcon(storagePath); setNewSubjectIconPreview(previewUrl); }} />
      <button type="submit" disabled={createSubject.isPending || !newSubjectName.trim()} className="rounded-lg bg-primary px-3 py-1.5 text-xs font-bold text-primary-foreground disabled:opacity-50" data-testid="button-add-subject">Add subject</button>
    </form>
    {deletingSubjectId !== null && <ConfirmDialog title="Delete this subject?" body="Its topics go with it. MCQs already tagged to it are kept but will need a new home." onCancel={() => setDeletingSubjectId(null)} onConfirm={() => removeSubject.mutate(deletingSubjectId)} pending={removeSubject.isPending} />}
  </div>;
}

export function TopicsManager({ subjectId }: { subjectId: number }) {
  const topicsQ = useQuery({ queryKey: ['admin-topics', subjectId], queryFn: () => topicAdminApi.list(subjectId) });
  const topics = [...(topicsQ.data ?? [])].sort((a, b) => (a.displayOrder ?? 0) - (b.displayOrder ?? 0));
  const [newTopicName, setNewTopicName] = useState('');
  const [deletingTopicId, setDeletingTopicId] = useState<number | null>(null);
  const [editingTopicId, setEditingTopicId] = useState<number | null>(null);
  const [editTopicName, setEditTopicName] = useState('');
  const invalidateTopics = () => { queryClient.invalidateQueries({ queryKey: ['admin-topics', subjectId] }); queryClient.invalidateQueries({ queryKey: ['admin-topics-all'] }); };
  const createTopic = useMutation({ mutationFn: topicAdminApi.create, onSuccess: () => { invalidateTopics(); setNewTopicName(''); }, onError: (err: unknown) => toast({ title: 'Could not create topic', description: err instanceof ApiRequestError ? err.message : 'Something went wrong.', variant: 'destructive' }) });
  const updateTopic = useMutation({ mutationFn: ({ id, body }: { id: number; body: Parameters<typeof topicAdminApi.update>[1] }) => topicAdminApi.update(id, body), onSuccess: () => { invalidateTopics(); setEditingTopicId(null); }, onError: (err: unknown) => toast({ title: 'Could not rename topic', description: err instanceof ApiRequestError ? err.message : 'Something went wrong.', variant: 'destructive' }) });
  const removeTopic = useMutation({ mutationFn: topicAdminApi.remove, onSuccess: () => { invalidateTopics(); setDeletingTopicId(null); }, onError: (err: unknown) => toast({ title: 'Could not delete topic', description: err instanceof ApiRequestError ? err.message : 'Something went wrong.', variant: 'destructive' }) });
  const reorderTopics = useMutation({
    mutationFn: (rows: { id: number; displayOrder: number }[]) => Promise.all(rows.map((r) => topicAdminApi.update(r.id, { displayOrder: r.displayOrder }))),
    onSuccess: invalidateTopics,
    onError: (err: unknown) => toast({ title: 'Could not reorder topics', description: err instanceof ApiRequestError ? err.message : 'Something went wrong.', variant: 'destructive' }),
  });
  const moveTopic = (index: number, dir: -1 | 1) => {
    const target = index + dir;
    if (target < 0 || target >= topics.length || reorderTopics.isPending) return;
    const reordered = [...topics];
    [reordered[index], reordered[target]] = [reordered[target], reordered[index]];
    reorderTopics.mutate(reordered.map((t, i) => ({ id: t.id, displayOrder: i })));
  };

  return <div>
    <div className="mb-2 text-[11px] font-bold uppercase tracking-wide text-muted-foreground">Topics</div>
    <div className="space-y-1.5">{topics.map((t, i) => <div key={t.id} className="rounded-lg bg-muted px-2.5 py-1.5 text-xs" data-testid={`row-topic-${t.id}`}>
      {editingTopicId === t.id
        ? <form onSubmit={(e) => { e.preventDefault(); if (editTopicName.trim()) updateTopic.mutate({ id: t.id, body: { name: editTopicName.trim() } }); }} className="flex items-center gap-1.5">
            <input autoFocus value={editTopicName} onChange={(e) => setEditTopicName(e.target.value)} className="h-7 min-w-0 flex-1 rounded-lg border border-border bg-background px-2 text-xs" data-testid={`input-rename-topic-${t.id}`} />
            <button type="submit" disabled={updateTopic.isPending} className="rounded-lg bg-primary px-2 py-1 text-[10px] font-bold text-primary-foreground" data-testid={`button-save-topic-${t.id}`}>Save</button>
            <button type="button" onClick={() => setEditingTopicId(null)} className="rounded-lg border border-border px-2 py-1 text-[10px] font-bold" data-testid={`button-cancel-edit-topic-${t.id}`}>Cancel</button>
          </form>
        : <div className="flex items-center justify-between gap-2">
            <div className="flex flex-1 items-center gap-1.5 min-w-0">
              <div className="flex shrink-0 flex-col">
                <button type="button" disabled={i === 0 || reorderTopics.isPending} onClick={() => moveTopic(i, -1)} className="grid size-3.5 place-items-center text-muted-foreground hover:text-foreground disabled:opacity-30" data-testid={`button-move-up-topic-${t.id}`} aria-label="Move up"><ChevronUp size={11} /></button>
                <button type="button" disabled={i === topics.length - 1 || reorderTopics.isPending} onClick={() => moveTopic(i, 1)} className="grid size-3.5 place-items-center text-muted-foreground hover:text-foreground disabled:opacity-30" data-testid={`button-move-down-topic-${t.id}`} aria-label="Move down"><ChevronDown size={11} /></button>
              </div>
              <span className="truncate">{t.name}</span>
            </div>
            <div className="flex shrink-0 items-center gap-2">
              <button onClick={() => { setEditingTopicId(t.id); setEditTopicName(t.name); }} className="text-muted-foreground hover:text-foreground" data-testid={`button-edit-topic-${t.id}`}><Pencil size={12} /></button>
              <button onClick={() => setDeletingTopicId(t.id)} className="text-muted-foreground hover:text-destructive" data-testid={`button-delete-topic-${t.id}`}><Trash2 size={12} /></button>
            </div>
          </div>}
    </div>)}{!topics.length && <p className="text-xs text-muted-foreground">No topics yet.</p>}</div>
    <form onSubmit={(e) => { e.preventDefault(); if (newTopicName.trim()) createTopic.mutate({ subjectId, name: newTopicName.trim(), active: true }); }} className="mt-2 flex gap-2"><input value={newTopicName} onChange={(e) => setNewTopicName(e.target.value)} placeholder="Add topic..." className="h-8 flex-1 rounded-lg border border-border bg-background px-2 text-xs" data-testid="input-add-topic" /><button disabled={createTopic.isPending} className="rounded-lg bg-primary px-2.5 text-xs font-bold text-primary-foreground disabled:opacity-50" data-testid="button-add-topic"><Plus size={12} /></button></form>
    {deletingTopicId !== null && <ConfirmDialog title="Delete this topic?" body="MCQs already tagged to it are kept but will need a new home." onCancel={() => setDeletingTopicId(null)} onConfirm={() => removeTopic.mutate(deletingTopicId)} pending={removeTopic.isPending} />}
  </div>;
}

// A real-world MBBS college and a BDS college are different institutions
// even when they share a university name, so "kind" lives on the
// institution row itself (see schema/medschool.ts) — this list is now
// split into an MBBS tab and a BDS tab instead of one flat list, and
// adding a college requires picking which one it is. Institutions saved
// before this existed have kind="" and surface under a third "Unset" tab
// (hidden once nothing is left in it) so nothing silently disappears.

export const INSTITUTION_KIND_TABS: Array<{ key: 'MBBS' | 'BDS'; label: string }> = [
  { key: 'MBBS', label: 'MBBS colleges' },
  { key: 'BDS', label: 'BDS colleges' },
];

export function AdminInstitutionsList({ selectedId, onSelect }: { selectedId: number | null; onSelect: (id: number) => void }) {
  const institutions = useQuery({ queryKey: ['admin-institutions'], queryFn: () => academicApi.institutions() });
  const invalidate = () => queryClient.invalidateQueries({ queryKey: ['admin-institutions'] });
  const [kindTab, setKindTab] = useState<'MBBS' | 'BDS' | ''>('MBBS');
  const [name, setName] = useState('');
  const [addKind, setAddKind] = useState<'MBBS' | 'BDS'>('MBBS');
  const [renamingId, setRenamingId] = useState<number | null>(null);
  const [renameValue, setRenameValue] = useState('');
  const [deletingPermanentId, setDeletingPermanentId] = useState<number | null>(null);
  // Keep the "Add college" form's type in step with whichever tab is open
  // — adding a college while looking at the BDS tab should default to
  // adding a BDS college, not silently add it to MBBS. Only follows real
  // tabs; the Unset tab has no matching add-kind, so it's left alone.
  useEffect(() => { if (kindTab === 'MBBS' || kindTab === 'BDS') setAddKind(kindTab); }, [kindTab]);

  const createInstitution = useMutation({ mutationFn: academicApi.createInstitution, onSuccess: invalidate, onError: (err: unknown) => toast({ title: 'Could not create institution', description: err instanceof ApiRequestError ? err.message : 'Something went wrong.', variant: 'destructive' }) });
  const renameInstitution = useMutation({ mutationFn: ({ id, name }: { id: number; name: string }) => academicApi.updateInstitution(id, { name }), onSuccess: () => { invalidate(); setRenamingId(null); }, onError: (err: unknown) => toast({ title: 'Could not rename institution', description: err instanceof ApiRequestError ? err.message : 'Something went wrong.', variant: 'destructive' }) });
  const toggleInstitution = useMutation({ mutationFn: ({ id, active }: { id: number; active: boolean }) => academicApi.updateInstitution(id, { active }), onSuccess: invalidate });
  const updateInstitutionKind = useMutation({ mutationFn: ({ id, kind }: { id: number; kind: string }) => academicApi.updateInstitution(id, { kind }), onSuccess: invalidate, onError: (err: unknown) => toast({ title: 'Could not update college type', description: err instanceof ApiRequestError ? err.message : 'Something went wrong.', variant: 'destructive' }) });
  const removePermanent = useMutation({ mutationFn: academicApi.removeInstitutionPermanent, onSuccess: () => { invalidate(); setDeletingPermanentId(null); }, onError: (err: unknown) => toast({ title: 'Could not permanently delete institution', description: err instanceof ApiRequestError ? err.message : 'Something went wrong.', variant: 'destructive' }) });
  // Custom ordering — persisted via the existing `displayOrder` column
  // (already read by GET /institutions' ORDER BY and already accepted by
  // PATCH /institutions/:id; nothing new needed server-side).
  //
  // Root cause of "the arrows don't move anything": institutions created
  // from the "Add institution" form below never send a displayOrder, so
  // they're all persisted at the same default (0). Swapping two rows that
  // share the same displayOrder swaps 0 with 0 — a no-op the admin sees as
  // "nothing moved." Renumbering the *whole* list to a unique, sequential
  // 0..n-1 order on every move (instead of swapping just the two neighbors)
  // self-heals that — every click leaves the list with no duplicate
  // displayOrder values, so the next click always has something real to
  // swap, with no backend migration needed. This renumbers within the
  // active tab only, which is fine — MBBS and BDS colleges are never
  // shown in the same list, so their displayOrder spaces don't need to
  // stay globally unique, only unique within each kind.
  const reorder = useMutation({
    mutationFn: (rows: { id: number; displayOrder: number }[]) =>
      Promise.all(rows.map((r) => academicApi.updateInstitution(r.id, { displayOrder: r.displayOrder }))),
    onSuccess: invalidate,
    onError: (err: unknown) => toast({ title: 'Could not reorder institutions', description: err instanceof ApiRequestError ? err.message : 'Something went wrong.', variant: 'destructive' }),
  });
  const allInstitutions = institutions.data || [];
  const unsetCount = allInstitutions.filter((i) => !i.kind).length;
  const tabs = unsetCount > 0 ? [...INSTITUTION_KIND_TABS, { key: '' as const, label: 'Unset' }] : INSTITUTION_KIND_TABS;
  const orderedInstitutions = allInstitutions.filter((i) => (i.kind || '') === kindTab).sort((x, y) => x.displayOrder - y.displayOrder || x.name.localeCompare(y.name));
  const moveInstitution = (index: number, dir: -1 | 1) => {
    const target = index + dir;
    if (target < 0 || target >= orderedInstitutions.length || reorder.isPending) return;
    const reordered = [...orderedInstitutions];
    [reordered[index], reordered[target]] = [reordered[target], reordered[index]];
    reorder.mutate(reordered.map((inst, i) => ({ id: inst.id, displayOrder: i })));
  };
  // Drag-and-drop reorder — much faster than the up/down arrows below for
  // moving something more than one or two spots (dragging KMC from #1 to
  // #12 is one gesture instead of eleven clicks). Native HTML5 DnD, no
  // extra dependency. The arrows stay alongside it for one-spot nudges and
  // for anyone who can't (or doesn't want to) drag — same renumber-the-
  // whole-list reorder() mutation either way, so both controls stay in
  // sync and neither can produce the duplicate-displayOrder "arrows don't
  // move anything" bug described above.
  const [dragIndex, setDragIndex] = useState<number | null>(null);
  const [dragOverIndex, setDragOverIndex] = useState<number | null>(null);
  const dropInstitution = (targetIndex: number) => {
    if (dragIndex === null || dragIndex === targetIndex || reorder.isPending) { setDragIndex(null); setDragOverIndex(null); return; }
    const reordered = [...orderedInstitutions];
    const [moved] = reordered.splice(dragIndex, 1);
    reordered.splice(targetIndex, 0, moved);
    reorder.mutate(reordered.map((inst, i) => ({ id: inst.id, displayOrder: i })));
    setDragIndex(null);
    setDragOverIndex(null);
  };

  return <div className="rounded-3xl border border-border bg-card p-5 shadow-sm">
    <div className="flex items-center gap-2.5"><div className="grid size-8 shrink-0 place-items-center rounded-xl bg-primary/15 text-primary"><Landmark size={16} /></div><div><h4 className="text-xs font-extrabold uppercase tracking-wide text-muted-foreground">Institutions</h4></div></div>
    <p className="mt-1.5 text-[11px] text-muted-foreground">The colleges students can register under, split by MBBS and BDS since they're different institutions — drag a row by its handle to reorder, or use the arrows for a one-spot nudge. Manage programmes, years, and batches below.</p>
    <div className="mt-3 flex gap-1.5 rounded-xl bg-muted p-1">
      {tabs.map((t) => <button key={t.key} type="button" onClick={() => setKindTab(t.key)} className={cn('flex-1 rounded-lg py-1.5 text-[11px] font-bold transition-all', kindTab === t.key ? 'bg-card text-primary shadow-sm' : 'text-muted-foreground hover:text-foreground')} data-testid={`tab-institution-kind-${t.key || 'unset'}`}>{t.label} <span className="font-mono-app text-[10px] opacity-70">({allInstitutions.filter((i) => (i.kind || '') === t.key).length})</span></button>)}
    </div>
    <div className="mt-3 space-y-1.5">
      {orderedInstitutions.map((i: Institution, idx) => <div
        key={i.id}
        onClick={() => onSelect(i.id)}
        onDragOver={(e) => { if (dragIndex !== null) { e.preventDefault(); if (dragOverIndex !== idx) setDragOverIndex(idx); } }}
        onDrop={(e) => { e.preventDefault(); dropInstitution(idx); }}
        className={cn(
          'flex items-center justify-between gap-2 rounded-xl border border-transparent px-3 py-2 text-xs cursor-pointer hover:bg-muted transition-all',
          selectedId === i.id && 'border-primary/20 bg-primary/10 font-bold shadow-sm',
          dragIndex === idx && 'opacity-40',
          dragOverIndex === idx && dragIndex !== idx && 'ring-2 ring-primary/50',
        )}
        data-testid={`row-institution-${i.id}`}
      >
        <div className="flex flex-1 items-center gap-2 min-w-0">
          <div
            draggable
            onClick={(e) => e.stopPropagation()}
            onDragStart={(e) => { setDragIndex(idx); e.dataTransfer.effectAllowed = 'move'; }}
            onDragEnd={() => { setDragIndex(null); setDragOverIndex(null); }}
            className="grid size-5 shrink-0 cursor-grab place-items-center text-muted-foreground hover:text-foreground active:cursor-grabbing"
            data-testid={`handle-drag-institution-${i.id}`}
            aria-label="Drag to reorder"
          ><GripVertical size={13} /></div>
          <div className="flex shrink-0 flex-col" onClick={(e) => e.stopPropagation()}>
            <button type="button" disabled={idx === 0 || reorder.isPending} onClick={() => moveInstitution(idx, -1)} className="grid size-4 place-items-center text-muted-foreground hover:text-foreground disabled:opacity-30" data-testid={`button-move-up-institution-${i.id}`} aria-label="Move up"><ChevronUp size={12} /></button>
            <button type="button" disabled={idx === orderedInstitutions.length - 1 || reorder.isPending} onClick={() => moveInstitution(idx, 1)} className="grid size-4 place-items-center text-muted-foreground hover:text-foreground disabled:opacity-30" data-testid={`button-move-down-institution-${i.id}`} aria-label="Move down"><ChevronDown size={12} /></button>
          </div>
          <div className={cn('grid size-7 shrink-0 place-items-center rounded-lg text-[11px] font-extrabold', i.kind === 'BDS' ? 'bg-info/15 text-info' : i.kind === 'MBBS' ? 'bg-primary/15 text-primary' : 'bg-muted text-muted-foreground')}>{i.name.trim().charAt(0).toUpperCase() || '?'}</div>
          {renamingId === i.id
            ? <form onClick={(e) => e.stopPropagation()} onSubmit={(e) => { e.preventDefault(); if (renameValue.trim()) renameInstitution.mutate({ id: i.id, name: renameValue.trim() }); }} className="flex flex-1 items-center gap-1.5">
                <input autoFocus value={renameValue} onChange={(e) => setRenameValue(e.target.value)} className="h-7 min-w-0 flex-1 rounded-lg border border-border bg-background px-2 text-xs" data-testid={`input-rename-institution-${i.id}`} />
                <button type="submit" className="rounded-lg bg-primary px-2 py-1 text-[10px] font-bold text-primary-foreground" data-testid={`button-save-rename-institution-${i.id}`}>Save</button>
                <button type="button" onClick={() => setRenamingId(null)} className="rounded-lg border border-border px-2 py-1 text-[10px] font-bold" data-testid={`button-cancel-rename-institution-${i.id}`}>Cancel</button>
              </form>
            : <span className={cn('flex-1 truncate', !i.active && 'text-muted-foreground line-through')}>{i.name}</span>}
        </div>
        {renamingId !== i.id && <div className="flex shrink-0 items-center gap-2" onClick={(e) => e.stopPropagation()}>
          {/* Always editable, not just while unset — an admin who typed a
              college into the wrong tab (or is fixing a legacy row) needs
              a way to correct it, not just set it once. */}
          <select value={i.kind || ''} onChange={(e) => updateInstitutionKind.mutate({ id: i.id, kind: e.target.value })} className="h-6 rounded-md border border-border bg-background px-1 text-[10px] font-bold" data-testid={`select-institution-kind-${i.id}`}><option value="">Unset</option><option value="MBBS">MBBS</option><option value="BDS">BDS</option></select>
          <button type="button" onClick={() => { setRenamingId(i.id); setRenameValue(i.name); }} className="text-[10px] font-bold text-primary" data-testid={`button-rename-institution-${i.id}`}>Rename</button>
          <button type="button" onClick={() => toggleInstitution.mutate({ id: i.id, active: !i.active })} className="text-[10px] font-bold text-primary" data-testid={`button-toggle-institution-${i.id}`}>{i.active ? 'Archive' : 'Activate'}</button>
          {/* No longer gated behind "archived first" — the backend already
              safely refuses (with a clear error) if programs/students are
              still attached, so there's no need to force admins through
              Archive before they can even attempt a permanent delete. */}
          <button type="button" onClick={() => setDeletingPermanentId(i.id)} className="text-[10px] font-bold text-destructive" data-testid={`button-delete-permanent-institution-${i.id}`}>Delete permanently</button>
        </div>}
      </div>)}
      {!orderedInstitutions.length && <p className="text-xs text-muted-foreground">{kindTab === '' ? 'Nothing left unset.' : `No ${kindTab} colleges yet — add one below.`}</p>}
    </div>
    <form onSubmit={(e) => { e.preventDefault(); if (name.trim()) { createInstitution.mutate({ name: name.trim(), kind: addKind, active: true }); setName(''); } }} className="mt-3 flex gap-1.5">
      <input value={name} onChange={(e) => setName(e.target.value)} placeholder="Add college, e.g. King Edward Medical University" className="h-9 min-w-0 flex-1 rounded-lg border border-border bg-background px-3 text-xs" data-testid="input-add-institution" />
      <select value={addKind} onChange={(e) => setAddKind(e.target.value as 'MBBS' | 'BDS')} className="h-9 rounded-lg border border-border bg-background px-2 text-xs font-bold" data-testid="select-add-institution-kind"><option value="MBBS">MBBS</option><option value="BDS">BDS</option></select>
      <button className="rounded-lg bg-primary px-3 text-xs font-bold text-primary-foreground" data-testid="button-add-institution"><Plus size={13} /></button>
    </form>
    {deletingPermanentId !== null && <ConfirmDialog title="Delete this institution permanently?" body="This erases it for good — there is no undo. Any programmes, academic years, and batches under it are deleted along with it. Only blocked if students are still assigned to it — reassign or remove them first." confirmLabel="Delete forever" onCancel={() => setDeletingPermanentId(null)} onConfirm={() => removePermanent.mutate(deletingPermanentId)} pending={removePermanent.isPending} />}
  </div>;
}
