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

import { Badge, BrandSpinner, ConfirmDialog, DifficultyPicker, EmptyState, InlineLoading, SkeletonPage, SuggestedPathHint, cn } from './ui';
import { DEGREE_OPTIONS, DEGREE_YEAR_OPTIONS, studyYearToNumber } from './groups';


// Standalone "Subjects" settings page — same capability as
// SubjectsTopicsManager (rename, thumbnail, reorder, delete) but reached
// from its own nav entry instead of nested under a specific module in
// Academic content, and showing every subject across every module at
// once (grouped by module, filterable to one).

export function ExplanationCoverage({ onSelectStatus }: { onSelectStatus?: (status: ExplanationStatus) => void }) {
  const summaryQ = useQuery({ queryKey: ['explanation-summary'], queryFn: explanationsApi.summary });
  const bulkGenerate = useMutation({
    mutationFn: () => explanationsApi.bulkGenerate({ limit: 25 }),
    onSuccess: (res) => { queryClient.invalidateQueries({ queryKey: ['explanation-summary'] }); queryClient.invalidateQueries({ queryKey: getListMcqsQueryKey() }); alert(`Generated ${res.generated} explanations${res.failed ? `, ${res.failed} failed` : ''}.`); },
  });
  const s = summaryQ.data;
  const pending = s?.PENDING ?? 0;
  return <div className="mb-6 rounded-2xl border border-border bg-card p-5"><div className="flex flex-wrap items-center justify-between gap-3"><div><h3 className="text-sm font-bold">Explanation coverage</h3><p className="mt-1 text-xs text-muted-foreground">Explanations imported or written by hand start as Approved. Missing ones start Pending — generate them with AI, then review. Click a number to jump to just those questions.</p></div>{pending > 0 && <button onClick={() => bulkGenerate.mutate()} disabled={bulkGenerate.isPending} className="inline-flex items-center gap-1.5 rounded-xl bg-primary px-4 py-2 text-xs font-bold text-primary-foreground disabled:opacity-50" data-testid="button-bulk-generate-explanations"><Sparkles size={13} /> {bulkGenerate.isPending ? 'Generating…' : `Generate up to 25 (${pending} pending)`}</button>}</div>
    <div className="mt-4 grid grid-cols-2 gap-2 sm:grid-cols-4">{(['PENDING', 'AI_GENERATED', 'REVIEWED', 'APPROVED'] as const).map((status) => <button key={status} type="button" onClick={() => onSelectStatus?.(status)} className="rounded-xl bg-muted p-3 text-center transition-colors hover:bg-primary/10" data-testid={`button-filter-explanation-${status}`}><div className="font-display text-xl">{s?.[status] ?? 0}</div><div className="mt-0.5 text-[10px] font-bold uppercase tracking-wide text-muted-foreground">{status.replace('_', ' ')}</div></button>)}</div>
  </div>;
}

export function McqExplanationRow({ mcq }: { mcq: { id: number; explanation?: string | null; explanationStatus?: ExplanationStatus } }) {
  const status = mcq.explanationStatus ?? (mcq.explanation ? 'APPROVED' : 'PENDING');
  const generate = useMutation({ mutationFn: () => explanationsApi.generate(mcq.id), onSuccess: () => { queryClient.invalidateQueries({ queryKey: getListMcqsQueryKey() }); queryClient.invalidateQueries({ queryKey: ['explanation-summary'] }); }, onError: (err: unknown) => toast({ title: 'Could not generate explanation', description: err instanceof ApiRequestError ? err.message : 'Something went wrong — check your connection and try again.', variant: 'destructive' }) });
  const setStatus = useMutation({ mutationFn: (s: ExplanationStatus) => explanationsApi.setStatus(mcq.id, s), onSuccess: () => { queryClient.invalidateQueries({ queryKey: getListMcqsQueryKey() }); queryClient.invalidateQueries({ queryKey: ['explanation-summary'] }); }, onError: (err: unknown) => toast({ title: 'Could not update explanation status', description: err instanceof ApiRequestError ? err.message : 'Something went wrong — check your connection and try again.', variant: 'destructive' }) });
  const reject = useMutation({ mutationFn: () => explanationsApi.reject(mcq.id), onSuccess: () => { queryClient.invalidateQueries({ queryKey: getListMcqsQueryKey() }); queryClient.invalidateQueries({ queryKey: ['explanation-summary'] }); }, onError: (err: unknown) => toast({ title: 'Could not reject explanation', description: err instanceof ApiRequestError ? err.message : 'Something went wrong — check your connection and try again.', variant: 'destructive' }) });
  const toneByStatus: Record<ExplanationStatus, 'amber' | 'blue' | 'green'> = { PENDING: 'amber', AI_GENERATED: 'blue', REVIEWED: 'blue', APPROVED: 'green' };

  return <div className="mt-3 border-t border-border pt-3"><div className="flex flex-wrap items-center gap-2"><span className="text-[10px] font-bold uppercase tracking-wide text-muted-foreground">Explanation:</span><Badge tone={toneByStatus[status]}>{status.replace('_', ' ')}</Badge>
    {status === 'PENDING' && <button onClick={() => generate.mutate()} disabled={generate.isPending} className="inline-flex items-center gap-1 rounded-lg border border-border px-2.5 py-1 text-[11px] font-bold disabled:opacity-50" data-testid={`button-generate-explanation-${mcq.id}`}><Sparkles size={11} /> {generate.isPending ? 'Generating…' : 'Generate with AI'}</button>}
    {status === 'AI_GENERATED' && <><button onClick={() => setStatus.mutate('APPROVED')} className="rounded-lg border border-border px-2.5 py-1 text-[11px] font-bold text-primary" data-testid={`button-approve-explanation-${mcq.id}`}>Approve</button><button onClick={() => reject.mutate()} className="rounded-lg border border-border px-2.5 py-1 text-[11px] font-bold text-destructive" data-testid={`button-reject-explanation-${mcq.id}`}>Reject</button></>}
    {status === 'REVIEWED' && <button onClick={() => setStatus.mutate('APPROVED')} className="rounded-lg border border-border px-2.5 py-1 text-[11px] font-bold text-primary" data-testid={`button-approve-explanation-${mcq.id}`}>Approve</button>}
  </div>{mcq.explanation && <p className="mt-2 text-xs leading-5 text-muted-foreground">{mcq.explanation}</p>}{generate.isError && <p className="mt-1 text-[11px] font-semibold text-destructive">{generate.error instanceof ApiRequestError ? generate.error.message : 'Generation failed.'}</p>}</div>;
}

// MCQ edit form — question text, options (up to 5), correct-answer select,
// explanation. Used both inline (tree view leaf) and could be reused
// elsewhere; kept self-contained with its own save mutation.

export function McqEditForm({ mcq, onDone }: { mcq: AdminMcqRow; onDone: () => void }) {
  const [question, setQuestion] = useState(mcq.question);
  const [options, setOptions] = useState<string[]>([...mcq.options, '', '', '', '', ''].slice(0, 5));
  const [correctAnswer, setCorrectAnswer] = useState(mcq.correctAnswer ?? '');
  const [explanation, setExplanation] = useState(mcq.explanation ?? '');
  // Bug fix: this edit form — the one used for every question in the main
  // bank tree, i.e. how most existing questions actually get touched —
  // had no per-option explanation fields and never sent optionExplanations
  // in its update. So even a question that DID have per-option
  // explanations (imported, or AI-generated) couldn't have them edited
  // here, and a question that didn't could never gain them here — only
  // via the separate bulk-add/AI-generate flows. Index-aligned with
  // `options` above, same convention as those flows.
  const [optionExplanations, setOptionExplanations] = useState<(string | null)[]>([...(mcq.optionExplanations ?? []), null, null, null, null, null].slice(0, 5));
  const [showOptionExplanations, setShowOptionExplanations] = useState(!!mcq.optionExplanations?.some((e) => e?.trim()));
  const [status, setStatus] = useState(mcq.status);
  const [difficulty, setDifficulty] = useState(mcq.difficulty || 'moderate');
  const save = useMutation({
    mutationFn: () => mcqAdminApi.update(mcq.id, {
      question: question.trim(),
      options: options.map((o) => o.trim()).filter(Boolean),
      correctAnswer: correctAnswer.trim() || null,
      explanation: explanation.trim() || null,
      optionExplanations: optionExplanations.slice(0, cleanedOptions.length).some((e) => e?.trim()) ? optionExplanations.slice(0, cleanedOptions.length).map((e) => e?.trim() || null) : null,
      status,
      difficulty,
    }),
    onSuccess: () => { queryClient.invalidateQueries({ queryKey: ['admin-mcqs-tree'] }); queryClient.invalidateQueries({ queryKey: getListMcqsQueryKey() }); onDone(); toast({ title: 'Question updated' }); },
    onError: (err: unknown) => toast({ title: 'Could not save question', description: err instanceof ApiRequestError ? err.message : 'Something went wrong.', variant: 'destructive' }),
  });
  const cleanedOptions = options.map((o) => o.trim()).filter(Boolean);
  return <div className="mt-3 space-y-2 rounded-xl border border-primary/30 bg-primary/10 p-4">
    <textarea value={question} onChange={(e) => setQuestion(e.target.value)} className="min-h-14 w-full rounded-lg border border-border bg-card p-2 text-xs" data-testid={`input-edit-mcq-question-${mcq.id}`} />
    <div className="grid gap-2 sm:grid-cols-2">{[0, 1, 2, 3, 4].map((oi) => <input key={oi} value={options[oi] || ''} onChange={(e) => { const next = [...options]; next[oi] = e.target.value; setOptions(next); }} placeholder={`Option ${String.fromCharCode(65 + oi)}${oi === 4 ? ' (optional)' : ''}`} className="h-9 rounded-lg border border-border bg-card px-2 text-xs" data-testid={`input-edit-mcq-option-${mcq.id}-${oi}`} />)}</div>
    <div className="flex flex-wrap items-center gap-2">
      <span className="text-[11px] font-bold text-muted-foreground">Correct:</span>
      <select value={correctAnswer} onChange={(e) => setCorrectAnswer(e.target.value)} className="h-8 flex-1 rounded-lg border border-border bg-card px-2 text-xs" data-testid={`select-edit-mcq-answer-${mcq.id}`}><option value="">Not set</option>{cleanedOptions.map((opt, oi) => <option key={oi} value={opt}>{String.fromCharCode(65 + oi)}. {opt.slice(0, 40)}</option>)}</select>
      <select value={status} onChange={(e) => setStatus(e.target.value)} className="h-8 rounded-lg border border-border bg-card px-2 text-xs" data-testid={`select-edit-mcq-status-${mcq.id}`}><option value="draft">Draft</option><option value="published">Published</option></select>
      <select value={difficulty} onChange={(e) => setDifficulty(e.target.value)} className="h-8 rounded-lg border border-border bg-card px-2 text-xs capitalize" data-testid={`select-edit-mcq-difficulty-${mcq.id}`}>{['easy', 'moderate', 'hard'].map((x) => <option key={x} value={x}>{x}</option>)}</select>
    </div>
    <textarea value={explanation} onChange={(e) => setExplanation(e.target.value)} placeholder="Explanation (optional)" className="min-h-12 w-full rounded-lg border border-border bg-card p-2 text-xs" data-testid={`input-edit-mcq-explanation-${mcq.id}`} />
    <button type="button" onClick={() => setShowOptionExplanations((v) => !v)} className="inline-flex items-center gap-1 text-[11px] font-bold text-primary" data-testid={`button-toggle-edit-option-explanations-${mcq.id}`}><CircleHelp size={12} /> {showOptionExplanations ? 'Hide' : 'Add'} per-option explanations</button>
    {showOptionExplanations && <div className="space-y-1.5 rounded-lg bg-card p-2.5">{cleanedOptions.map((opt, oi) => <div key={oi} className="flex items-start gap-2"><span className={cn('mt-1.5 grid size-5 shrink-0 place-items-center rounded text-[10px] font-bold', correctAnswer === opt ? 'bg-primary/15 text-primary' : 'bg-destructive/10 text-destructive')}>{String.fromCharCode(65 + oi)}</span><textarea value={optionExplanations[oi] ?? ''} onChange={(e) => { const next = [...optionExplanations]; next[oi] = e.target.value || null; setOptionExplanations(next); }} placeholder={correctAnswer === opt ? 'Why this is correct...' : 'Why this is wrong...'} className="min-h-9 flex-1 rounded-lg border border-border bg-background p-2 text-xs" data-testid={`input-edit-mcq-option-explanation-${mcq.id}-${oi}`} /></div>)}</div>}
    <div className="flex gap-2"><button onClick={() => save.mutate()} disabled={save.isPending || !question.trim() || cleanedOptions.length < 2} className="rounded-lg bg-primary px-3 py-1.5 text-[11px] font-bold text-primary-foreground disabled:opacity-50" data-testid={`button-save-edit-mcq-${mcq.id}`}>{save.isPending ? 'Saving…' : 'Save changes'}</button><button onClick={onDone} className="rounded-lg border border-border px-3 py-1.5 text-[11px] font-bold" data-testid={`button-cancel-edit-mcq-${mcq.id}`}>Cancel</button></div>
  </div>;
}

// One MCQ row at the leaf (topic) level of the tree — badge + edit/delete.
// selectedIds/onToggleSelect are optional — only the main MCQ bank tree
// (McqBankTree) wires these up for bulk selection; McqSourceGroup (used by
// ExamManagePanel/AdminPastPapers, which have their own dedicated delete
// flows) renders this row with no checkbox at all.

export function McqTreeRow({ mcq, selectedIds, onToggleSelect }: { mcq: AdminMcqRow; selectedIds?: Set<number>; onToggleSelect?: (id: number) => void }) {
  const [editing, setEditing] = useState(false);
  const [deleting, setDeleting] = useState(false);
  const remove = useMutation({
    mutationFn: () => mcqAdminApi.remove(mcq.id),
    onSuccess: () => { queryClient.invalidateQueries({ queryKey: ['admin-mcqs-tree'] }); queryClient.invalidateQueries({ queryKey: getListMcqsQueryKey() }); setDeleting(false); },
    onError: (err: unknown) => toast({ title: 'Could not delete question', description: err instanceof ApiRequestError ? err.message : 'Something went wrong.', variant: 'destructive' }),
  });
  return <div className="rounded-xl border border-border bg-card p-3" data-testid={`row-tree-mcq-${mcq.id}`}>
    <div className="flex items-start justify-between gap-3">
      <div className="flex flex-1 items-start gap-2">
        {onToggleSelect && <input type="checkbox" className="mt-1" checked={selectedIds?.has(mcq.id) ?? false} onChange={() => onToggleSelect(mcq.id)} data-testid={`checkbox-select-tree-mcq-${mcq.id}`} />}
        <div className="flex-1"><div className="flex items-center gap-2"><Badge tone={mcq.status === 'published' ? 'green' : 'amber'}>{mcq.status}</Badge><Badge tone={mcq.explanationStatus === 'APPROVED' ? 'green' : mcq.explanationStatus === 'PENDING' ? 'neutral' : 'blue'}>{mcq.explanationStatus.replace('_', ' ')}</Badge></div><p className="mt-2 text-xs font-bold leading-5">{mcq.question}</p></div>
      </div>
      <div className="flex shrink-0 items-center gap-1"><button onClick={() => setEditing((v) => !v)} className="rounded-lg p-1.5 text-muted-foreground hover:bg-muted" data-testid={`button-edit-mcq-${mcq.id}`}><Pencil size={14} /></button><button onClick={() => setDeleting(true)} className="rounded-lg p-1.5 text-muted-foreground hover:bg-destructive/10 hover:text-destructive" data-testid={`button-delete-tree-mcq-${mcq.id}`}><Trash2 size={14} /></button></div>
    </div>
    {editing && <McqEditForm mcq={mcq} onDone={() => setEditing(false)} />}
    {deleting && <ConfirmDialog title="Delete this question?" body="It will be removed from the bank and from any draft exams using it." onCancel={() => setDeleting(false)} onConfirm={() => remove.mutate()} pending={remove.isPending} />}
  </div>;
}

// Topic level — fetched/expanded on demand; shows the MCQs tagged to it.
// Small "delete every question in this module/subject/topic" control, reused
// at all three tree levels — uses the server-side {all:true, filters} bulk
// delete path (unlike the flat list's explicit-id-list approach) since a
// whole module can hold far more questions than the client has loaded here.

export function BulkDeleteInScope({ label, count, filters }: { label: string; count: number; filters: { moduleId?: number; subjectId?: number; topicId?: number } }) {
  const [confirming, setConfirming] = useState(false);
  const bulkDelete = useMutation({
    mutationFn: () => mcqAdminApi.bulkRemove({ all: true, filters }),
    onSuccess: (res) => { queryClient.invalidateQueries({ queryKey: getListMcqsQueryKey() }); queryClient.invalidateQueries({ queryKey: ['admin-mcqs-tree'] }); setConfirming(false); toast({ title: `Deleted ${res.deleted} question${res.deleted === 1 ? '' : 's'}` }); },
    onError: (err: unknown) => toast({ title: 'Bulk delete failed', description: err instanceof ApiRequestError ? err.message : 'Something went wrong.', variant: 'destructive' }),
  });
  if (!count) return null;
  return <>
    <button type="button" onClick={(e) => { e.stopPropagation(); setConfirming(true); }} className="rounded-lg p-1 text-muted-foreground hover:bg-destructive/10 hover:text-destructive" data-testid={`button-delete-all-in-${label.replace(/\s+/g, '-').toLowerCase()}`} aria-label={`Delete all questions in ${label}`}><Trash2 size={13} /></button>
    {confirming && <ConfirmDialog title={`Delete all ${count} question${count === 1 ? '' : 's'} in "${label}"?`} body="This permanently removes every question in this scope — there is no undo." confirmLabel={`Delete all ${count}`} onCancel={() => setConfirming(false)} onConfirm={() => bulkDelete.mutate()} pending={bulkDelete.isPending} />}
  </>;
}

// Difficulty + explanation-coverage breakdown for a set of rows — the
// "mcqs analysis" shown inline at every tree level (topic/subject/module),
// computed client-side from data already loaded for the tree, no extra
// requests needed.

export function analyzeMcqRows(rows: AdminMcqRow[]) {
  const easy = rows.filter((r) => r.difficulty === 'easy').length;
  const moderate = rows.filter((r) => r.difficulty === 'moderate').length;
  const hard = rows.filter((r) => r.difficulty === 'hard').length;
  const explained = rows.filter((r) => r.explanationStatus === 'APPROVED').length;
  return { total: rows.length, easy, moderate, hard, explained };
}

// Mixes the order of the questions in a scope (block / module / subject / topic).
export function useShuffleSequence(rows: AdminMcqRow[], label: string) {
  return useMutation({
    mutationFn: () => mcqAdminApi.shuffleSequence(rows.map((r) => r.id)),
    onSuccess: (res) => {
      queryClient.invalidateQueries({ queryKey: ['admin-mcqs-tree'] });
      queryClient.invalidateQueries({ queryKey: getListMcqsQueryKey() });
      toast({ title: `Mixed the sequence of ${res.shuffled} questions in "${label}"` });
    },
    onError: (err: unknown) => toast({ title: 'Could not shuffle the sequence', description: err instanceof ApiRequestError ? err.message : 'Something went wrong.', variant: 'destructive' }),
  });
}
const SEQ_BTN = 'inline-flex items-center gap-1.5 rounded-lg border border-primary/30 bg-primary/10 px-2.5 py-1.5 text-[11px] font-bold text-primary disabled:opacity-50';

export function AnalysisPanel({ rows, label, filters }: { rows: AdminMcqRow[]; label: string; filters: { moduleId?: number; subjectId?: number; topicId?: number; pastPaperId?: number } }) {
  const a = analyzeMcqRows(rows);
  // AI re-classification calls the model per question. The server still
  // caps each individual HTTP call (see CLASSIFY_BATCH_CAP in
  // classify-difficulty.ts) so a single request can't run long enough to
  // hit the hosting platform's gateway timeout — but this one click now
  // drives that capped endpoint in a loop, client-side, until the whole
  // scope (however large) is done, instead of making the admin click
  // "again" themselves for every batch of 30.
  const classify = useMutation({
    mutationFn: async () => {
      let classified = 0;
      let remaining = Infinity;
      const progress = toast({ title: 'Classifying difficulty…', description: `Starting "${label}"…` });
      try {
        while (remaining > 0) {
          const res = await mcqAdminApi.classifyDifficulty({ all: true, filters });
          classified += res.classified;
          remaining = res.remaining;
          if (res.classified === 0) break; // nothing left matched — avoid spinning forever
          progress.update({ id: progress.id, title: 'Classifying difficulty…', description: remaining > 0 ? `${classified} done so far in "${label}" — ${remaining} left…` : `${classified} done in "${label}" — finishing up…` });
        }
      } finally {
        progress.dismiss();
      }
      return { classified };
    },
    onSuccess: (res) => {
      queryClient.invalidateQueries({ queryKey: ['admin-mcqs-tree'] });
      queryClient.invalidateQueries({ queryKey: getListMcqsQueryKey() });
      toast({ title: `AI classified ${res.classified} question${res.classified === 1 ? '' : 's'} in "${label}"` });
    },
    onError: (err: unknown) => toast({ title: 'Could not classify difficulty', description: err instanceof ApiRequestError ? err.message : 'Something went wrong.', variant: 'destructive' }),
  });
  // Backfills per-option explanations for questions in this scope that are
  // missing them. Same loop-until-done shape as classify above: the server
  // endpoint is still batch-capped per call (see
  // OPTION_EXPLANATIONS_BATCH_CAP), but this mutation now keeps calling it
  // — with a running progress toast — until every question in the whole
  // block/module/subject/topic scope has been covered, so a bank of
  // hundreds or thousands of questions is handled in one click.
  const generateOptionExplanations = useMutation({
    mutationFn: async () => {
      let generated = 0;
      let remaining = Infinity;
      const progress = toast({ title: 'Generating option explanations…', description: `Starting "${label}"…` });
      try {
        while (remaining > 0) {
          const res = await mcqAdminApi.generateOptionExplanations({ all: true, filters });
          generated += res.generated;
          remaining = res.remaining;
          if (res.generated === 0) break; // nothing left matched — avoid spinning forever
          progress.update({ id: progress.id, title: 'Generating option explanations…', description: remaining > 0 ? `${generated} done so far in "${label}" — ${remaining} left…` : `${generated} done in "${label}" — finishing up…` });
        }
      } finally {
        progress.dismiss();
      }
      return { generated };
    },
    onSuccess: (res) => {
      queryClient.invalidateQueries({ queryKey: ['admin-mcqs-tree'] });
      queryClient.invalidateQueries({ queryKey: getListMcqsQueryKey() });
      toast({ title: `AI generated option explanations for ${res.generated} question${res.generated === 1 ? '' : 's'} in "${label}"` });
    },
    onError: (err: unknown) => toast({ title: 'Could not generate option explanations', description: err instanceof ApiRequestError ? err.message : 'Something went wrong.', variant: 'destructive' }),
  });
  // Randomly reorders each question's options in this scope (in one shot —
  // it's a local reorder, not an AI call, so unlike classify-difficulty
  // above it isn't batch-capped). Fixes banks where the correct option is
  // suspiciously clustered on one letter (e.g. every answer is "A" after a
  // bulk AI import) — see the endpoint's own comment for why this is safe
  // to do without touching which option is marked correct.
  const shuffle = useMutation({
    mutationFn: () => mcqAdminApi.shuffleOptions({ all: true, filters }),
    onSuccess: (res) => {
      queryClient.invalidateQueries({ queryKey: ['admin-mcqs-tree'] });
      queryClient.invalidateQueries({ queryKey: getListMcqsQueryKey() });
      toast({ title: `Shuffled options on ${res.shuffled} question${res.shuffled === 1 ? '' : 's'}`, description: res.skipped ? `${res.skipped} question${res.skipped === 1 ? '' : 's'} skipped (fewer than 2 options).` : undefined });
    },
    onError: (err: unknown) => toast({ title: 'Could not shuffle options', description: err instanceof ApiRequestError ? err.message : 'Something went wrong.', variant: 'destructive' }),
  });
  const shuffleSeq = useShuffleSequence(rows, label);
  if (!a.total) return <p className="text-[11px] text-muted-foreground">No questions here yet to analyze.</p>;
  return <div>
    <div className="grid grid-cols-2 gap-2 sm:grid-cols-4">
      <div className="rounded-lg bg-primary/10 p-2 text-center"><div className="text-sm font-extrabold text-primary">{a.easy}</div><div className="text-[10px] font-bold uppercase tracking-wide text-muted-foreground">Easy</div></div>
      <div className="rounded-lg bg-accent/10 p-2 text-center"><div className="text-sm font-extrabold text-accent-text">{a.moderate}</div><div className="text-[10px] font-bold uppercase tracking-wide text-muted-foreground">Moderate</div></div>
      <div className="rounded-lg bg-destructive/10 p-2 text-center"><div className="text-sm font-extrabold text-destructive">{a.hard}</div><div className="text-[10px] font-bold uppercase tracking-wide text-muted-foreground">Hard</div></div>
      <div className="rounded-lg bg-muted p-2 text-center"><div className="text-sm font-extrabold">{a.explained}/{a.total}</div><div className="text-[10px] font-bold uppercase tracking-wide text-muted-foreground">Explained</div></div>
    </div>
    <div className="mt-2 flex flex-wrap gap-2">
      <button type="button" disabled={classify.isPending} onClick={(e) => { e.stopPropagation(); classify.mutate(); }} className="inline-flex items-center gap-1.5 rounded-lg border border-primary/30 bg-primary/10 px-2.5 py-1.5 text-[11px] font-bold text-primary disabled:opacity-50" data-testid="button-classify-difficulty" title={`Re-runs AI difficulty classification on every question in "${label}" (${a.total} total) — one click, processed in the background in small batches`}>{classify.isPending ? 'Classifying…' : <><Wand2 size={12} /> AI: classify difficulty (all {a.total})</>}</button>
      <button type="button" disabled={generateOptionExplanations.isPending} onClick={(e) => { e.stopPropagation(); generateOptionExplanations.mutate(); }} className="inline-flex items-center gap-1.5 rounded-lg border border-primary/30 bg-primary/10 px-2.5 py-1.5 text-[11px] font-bold text-primary disabled:opacity-50" data-testid="button-generate-option-explanations" title={`Generates per-option explanations for every question in "${label}" that's missing them — one click, processed in the background in small batches`}>{generateOptionExplanations.isPending ? 'Generating…' : <><Wand2 size={12} /> AI: generate option explanations (all)</>}</button>
      <button type="button" disabled={shuffle.isPending} onClick={(e) => { e.stopPropagation(); shuffle.mutate(); }} className="inline-flex items-center gap-1.5 rounded-lg border border-primary/30 bg-primary/10 px-2.5 py-1.5 text-[11px] font-bold text-primary disabled:opacity-50" data-testid="button-shuffle-options" title="Randomly reorders every question's options in this scope, so the correct answer isn't always the same letter — the correct option moves with its text, it stays correct wherever it lands">{shuffle.isPending ? 'Shuffling…' : <><Shuffle size={12} /> Shuffle option order (all {a.total})</>}</button>
      <button type="button" disabled={shuffleSeq.isPending || rows.length < 2} onClick={(e) => { e.stopPropagation(); shuffleSeq.mutate(); }} className={SEQ_BTN} data-testid="button-shuffle-sequence" title={`Mixes the order of all ${rows.length} questions in "${label}" so they no longer appear grouped by import.`}><Shuffle size={12} /> {shuffleSeq.isPending ? 'Mixing…' : 'Shuffle MCQ sequence'}</button>
    </div>
  </div>;
}

export function AnalysisToggle({ rows, label, filters }: { rows: AdminMcqRow[]; label: string; filters: { moduleId?: number; subjectId?: number; topicId?: number; pastPaperId?: number } }) {
  const [open, setOpen] = useState(false);
  if (!rows.length) return null;
  return <>
    <button type="button" onClick={(e) => { e.stopPropagation(); setOpen((v) => !v); }} className={cn('rounded-lg p-1', open ? 'bg-primary/10 text-primary' : 'text-muted-foreground hover:bg-muted')} data-testid="button-toggle-analysis" aria-label="Analyze this scope"><BarChart3 size={13} /></button>
    {open && <div className="w-full basis-full pt-2" onClick={(e) => e.stopPropagation()}><AnalysisPanel rows={rows} label={label} filters={filters} /></div>}
  </>;
}

// Self-contained "generate AI questions right here" panel for one topic —
// unlike the top-of-page generator (which needs module/subject/topic
// dropdowns filled in first), this already knows its scope from the tree,
// so it's a one-click generate-review-save loop without leaving the row.

export function TopicAiGenerate({ moduleId, subjectId, topicId, topicName }: { moduleId: number; subjectId: number; topicId: number; topicName: string }) {
  const [open, setOpen] = useState(false);
  const [count, setCount] = useState(5);
  const [difficulty, setDifficulty] = useState<'mixed' | 'easy' | 'moderate' | 'hard'>('mixed');
  const [drafts, setDrafts] = useState<GeneratedFlashcard[] extends never ? never : Array<{ question: string; options: string[]; correctAnswer: string; explanation: string; optionExplanations?: (string | null)[]; difficulty?: string }> | null>(null);
  const generate = useMutation({
    mutationFn: () => mcqAdminApi.generateAi(topicId, count, difficulty === 'mixed' ? undefined : difficulty),
    onSuccess: (res) => setDrafts(res.drafts),
    onError: (err: unknown) => toast({ title: 'Could not generate questions', description: err instanceof ApiRequestError ? err.message : 'Something went wrong.', variant: 'destructive' }),
  });
  const save = useMutation({
    mutationFn: () => mcqAdminApi.bulkCreate((drafts ?? []).map((d) => ({ question: d.question, options: d.options, correctAnswer: d.correctAnswer, explanation: d.explanation, optionExplanations: d.optionExplanations ?? undefined, difficulty: d.difficulty ?? 'moderate', moduleId, subjectId, topicId }))),
    onSuccess: (res) => { queryClient.invalidateQueries({ queryKey: ['admin-mcqs-tree'] }); queryClient.invalidateQueries({ queryKey: getListMcqsQueryKey() }); toast({ title: `Added ${res.created} questions to ${topicName}` }); setDrafts(null); setOpen(false); },
    onError: (err: unknown) => toast({ title: 'Could not save questions', description: err instanceof ApiRequestError ? err.message : 'Something went wrong.', variant: 'destructive' }),
  });
  return <>
    <button type="button" onClick={(e) => { e.stopPropagation(); setOpen((v) => !v); }} className={cn('rounded-lg p-1', open ? 'bg-primary/10 text-primary' : 'text-muted-foreground hover:bg-muted')} data-testid={`button-toggle-ai-generate-topic-${topicId}`} aria-label="Generate AI questions for this topic"><Sparkles size={13} /></button>
    {open && <div className="w-full basis-full border-t border-border pt-3" onClick={(e) => e.stopPropagation()}>
      <div className="flex flex-wrap items-center gap-2"><select value={count} onChange={(e) => setCount(Number(e.target.value))} className="h-8 rounded-lg border border-border bg-background px-2 text-xs" data-testid={`select-ai-count-topic-${topicId}`}>{[3, 5, 8, 10].map((n) => <option key={n} value={n}>{n}</option>)}</select><select value={difficulty} onChange={(e) => setDifficulty(e.target.value as typeof difficulty)} className="h-8 rounded-lg border border-border bg-background px-2 text-xs" data-testid={`select-ai-difficulty-topic-${topicId}`}><option value="mixed">Mixed</option><option value="easy">Easy</option><option value="moderate">Moderate</option><option value="hard">Hard</option></select><button type="button" disabled={generate.isPending} onClick={() => generate.mutate()} className="ml-auto inline-flex items-center gap-1.5 rounded-lg bg-primary px-3 py-1.5 text-[11px] font-bold text-primary-foreground disabled:opacity-50" data-testid={`button-generate-topic-${topicId}`}>{generate.isPending ? 'Generating…' : <><Sparkles size={12} /> Generate</>}</button></div>
      {drafts && <div className="mt-3 space-y-2">
        {drafts.map((d, i) => <div key={i} className="rounded-lg bg-muted px-2.5 py-1.5 text-xs"><span className="mr-1.5 rounded bg-card px-1.5 py-0.5 text-[10px] font-bold uppercase">{d.difficulty ?? 'moderate'}</span>{d.question}</div>)}
        {!drafts.length && <p className="text-[11px] text-muted-foreground">AI returned nothing usable — try again.</p>}
        {!!drafts.length && <button type="button" disabled={save.isPending} onClick={() => save.mutate()} className="rounded-lg bg-primary px-3 py-1.5 text-[11px] font-bold text-primary-foreground disabled:opacity-50" data-testid={`button-save-ai-drafts-topic-${topicId}`}>{save.isPending ? 'Saving…' : `Save all ${drafts.length} to ${topicName}`}</button>}
      </div>}
    </div>}
  </>;
}

export function McqTreeTopic({ moduleId, subjectId, topicId, name, mcqsByTopic, selectedIds, onToggleSelect }: { moduleId: number; subjectId: number; topicId: number; name: string; mcqsByTopic: Map<number, AdminMcqRow[]>; selectedIds: Set<number>; onToggleSelect: (id: number) => void }) {
  const [open, setOpen] = useState(false);
  const rows = mcqsByTopic.get(topicId) ?? [];
  return <div className="rounded-lg border border-border bg-background">
    <div className="flex flex-wrap items-center justify-between gap-1 px-3 py-2"><button onClick={() => setOpen((v) => !v)} className="flex flex-1 items-center gap-2 text-left text-xs font-bold" data-testid={`button-tree-topic-${topicId}`}><ChevronRight size={13} className={cn('transition-transform', open && 'rotate-90')} />{name}</button><span className="text-[10px] font-normal text-muted-foreground">{rows.length} question{rows.length === 1 ? '' : 's'}</span><AnalysisToggle rows={rows} label={name} filters={{ topicId }} /><TopicAiGenerate moduleId={moduleId} subjectId={subjectId} topicId={topicId} topicName={name} /><BulkDeleteInScope label={name} count={rows.length} filters={{ topicId }} /></div>
    {open && <div className="space-y-2 border-t border-border p-3">{rows.length ? rows.map((m) => <McqTreeRow key={m.id} mcq={m} selectedIds={selectedIds} onToggleSelect={onToggleSelect} />) : <p className="text-[11px] text-muted-foreground">No questions in this topic yet.</p>}</div>}
  </div>;
}

// Subject level — lazily loads its topics (same query key as TopicsManager, so cache is shared).

export function McqTreeSubject({ moduleId, subjectId, name, mcqsByTopic, selectedIds, onToggleSelect }: { moduleId: number; subjectId: number; name: string; mcqsByTopic: Map<number, AdminMcqRow[]>; selectedIds: Set<number>; onToggleSelect: (id: number) => void }) {
  const [open, setOpen] = useState(false);
  const topicsQ = useQuery({ queryKey: ['admin-topics', subjectId], queryFn: () => topicAdminApi.list(subjectId), enabled: open });
  const topics = topicsQ.data ?? [];
  const subjectRows = [...mcqsByTopic.entries()].filter(([tId]) => topics.some((t) => t.id === tId)).flatMap(([, rows]) => rows);
  return <div className="rounded-xl border border-border bg-card">
    <div className="flex flex-wrap items-center justify-between gap-1 px-4 py-2.5"><button onClick={() => setOpen((v) => !v)} className="flex flex-1 items-center gap-2 text-left text-xs font-bold" data-testid={`button-tree-subject-${subjectId}`}><ChevronRight size={14} className={cn('transition-transform', open && 'rotate-90')} />{name}</button>{open && <><AnalysisToggle rows={subjectRows} label={name} filters={{ subjectId }} /><BulkDeleteInScope label={name} count={subjectRows.length} filters={{ subjectId }} /></>}</div>
    {open && <div className="space-y-2 border-t border-border p-3">{topicsQ.isLoading ? <InlineLoading label="Loading topics…" /> : topics.length ? topics.map((t) => <McqTreeTopic key={t.id} moduleId={moduleId} subjectId={subjectId} topicId={t.id} name={t.name} mcqsByTopic={mcqsByTopic} selectedIds={selectedIds} onToggleSelect={onToggleSelect} />) : <p className="text-[11px] text-muted-foreground">No topics in this subject yet.</p>}</div>}
  </div>;
}

// Module level (top of the tree) — lazily loads its subjects.

export function McqTreeModule({ moduleId, name, mcqCount, mcqsByTopic, selectedIds, onToggleSelect }: { moduleId: number; name: string; mcqCount: number; mcqsByTopic: Map<number, AdminMcqRow[]>; selectedIds: Set<number>; onToggleSelect: (id: number) => void }) {
  const [open, setOpen] = useState(false);
  const subjectsQ = useQuery({ queryKey: ['admin-subjects', moduleId], queryFn: () => subjectAdminApi.list(moduleId), enabled: open });
  const subjects = subjectsQ.data ?? [];
  const moduleRows = [...mcqsByTopic.values()].flat().filter((r) => r.moduleId === moduleId);
  const draftCount = moduleRows.filter((r) => r.status === 'draft').length;
  return <div className="rounded-2xl border border-border bg-card">
    <div className="flex flex-wrap items-center justify-between gap-1 px-5 py-3.5"><button onClick={() => setOpen((v) => !v)} className="flex flex-1 items-center gap-2 text-left text-sm font-extrabold" data-testid={`button-tree-module-${moduleId}`}><ChevronRight size={16} className={cn('transition-transform', open && 'rotate-90')} />{name}</button><span className="text-[11px] text-muted-foreground">{mcqCount} question{mcqCount === 1 ? '' : 's'}</span>{draftCount > 0 && <PublishDraftsButton moduleId={moduleId} draftCount={draftCount} />}<AnalysisToggle rows={moduleRows} label={name} filters={{ moduleId }} /><BulkDeleteInScope label={name} count={mcqCount} filters={{ moduleId }} /></div>
    {open && <div className="space-y-2 border-t border-border p-4">{subjectsQ.isLoading ? <InlineLoading label="Loading subjects…" /> : subjects.length ? subjects.map((s) => <McqTreeSubject key={s.id} moduleId={moduleId} subjectId={s.id} name={s.name} mcqsByTopic={mcqsByTopic} selectedIds={selectedIds} onToggleSelect={onToggleSelect} />) : <p className="text-xs text-muted-foreground">No subjects in this module yet.</p>}</div>}
  </div>;
}

// The badge count next to a module (mcqCount, passed down from
// countByModule) only counts published questions — same rule GET /modules
// uses for students, see getModuleCounts in medschool.ts — so it can sit
// noticeably lower than the true number of questions filed under that
// module if a batch got imported without explicitly publishing (the
// "Respiration shows 406 in the tree above but only 380 on the student
// module card" bug). This button clears the backlog for one module in a
// single request instead of publishing drafts one at a time.

export function PublishDraftsButton({ moduleId, draftCount }: { moduleId: number; draftCount: number }) {
  const publish = useMutation({
    mutationFn: () => mcqAdminApi.publishDrafts(moduleId),
    onSuccess: (res) => {
      toast({ title: 'Drafts published', description: `${res.published} question${res.published === 1 ? '' : 's'} now visible to students.` });
      queryClient.invalidateQueries({ queryKey: ['admin-mcqs'] });
      queryClient.invalidateQueries({ queryKey: ['modules'] });
    },
    onError: (err: unknown) => toast({ title: 'Could not publish drafts', description: err instanceof ApiRequestError ? err.message : 'Something went wrong.', variant: 'destructive' }),
  });
  return <button type="button" onClick={(e) => { e.stopPropagation(); publish.mutate(); }} disabled={publish.isPending} className="rounded-lg bg-accent/15 px-2 py-1 text-[10px] font-bold text-accent-text hover:bg-accent/25 disabled:opacity-50" data-testid={`button-publish-drafts-${moduleId}`} title={`${draftCount} question${draftCount === 1 ? '' : 's'} still in draft — not shown to students`}>
    {publish.isPending ? 'Publishing…' : `Publish ${draftCount} draft${draftCount === 1 ? '' : 's'}`}
  </button>;
}

// Block level only shows the read-only breakdown (no AI-classify button
// here — that endpoint's scope filter takes one moduleId/subjectId/topicId,
// not a whole block's worth of modules at once; classify from the module
// row below instead).

export function BlockAnalysisToggle({ rows, label = 'this block' }: { rows: AdminMcqRow[]; label?: string }) {
  const [open, setOpen] = useState(false);
  const shuffleSeq = useShuffleSequence(rows, label);
  return <>
    <button type="button" onClick={() => setOpen((v) => !v)} className={cn('rounded-lg p-1', open ? 'bg-primary/10 text-primary' : 'text-muted-foreground hover:bg-muted')} data-testid="button-toggle-block-analysis" aria-label="Analyze this block"><BarChart3 size={13} /></button>
    {open && <div className="w-full basis-full pt-1"><AnalysisStats rows={rows} />
      <div className="mt-2"><button type="button" disabled={shuffleSeq.isPending || rows.length < 2} onClick={() => shuffleSeq.mutate()} className={SEQ_BTN} data-testid="button-shuffle-sequence-block" title={`Mixes the order of all ${rows.length} questions across this block's modules.`}><Shuffle size={12} /> {shuffleSeq.isPending ? 'Mixing…' : 'Shuffle MCQ sequence'}</button></div></div>}
  </>;
}

export function AnalysisStats({ rows }: { rows: AdminMcqRow[] }) {
  const a = analyzeMcqRows(rows);
  return <div className="grid grid-cols-2 gap-2 sm:grid-cols-4">
    <div className="rounded-lg bg-primary/10 p-2 text-center"><div className="text-sm font-extrabold text-primary">{a.easy}</div><div className="text-[10px] font-bold uppercase tracking-wide text-muted-foreground">Easy</div></div>
    <div className="rounded-lg bg-accent/10 p-2 text-center"><div className="text-sm font-extrabold text-accent-text">{a.moderate}</div><div className="text-[10px] font-bold uppercase tracking-wide text-muted-foreground">Moderate</div></div>
    <div className="rounded-lg bg-destructive/10 p-2 text-center"><div className="text-sm font-extrabold text-destructive">{a.hard}</div><div className="text-[10px] font-bold uppercase tracking-wide text-muted-foreground">Hard</div></div>
    <div className="rounded-lg bg-muted p-2 text-center"><div className="text-sm font-extrabold">{a.explained}/{a.total}</div><div className="text-[10px] font-bold uppercase tracking-wide text-muted-foreground">Explained</div></div>
  </div>;
}

// The main curriculum-tree MCQ bank (module > subject > topic). Exam- and
// past-paper-owned questions (mcqsTable.examId/pastPaperId set) are
// deliberately NOT shown here anymore — they're their own separate banks,
// managed entirely from the Pre-Proffs Exams and Past papers pages
// (ExamManagePanel's "This exam's questions" / AdminPastPapers' "View
// questions"). This only ever shows main-bank questions: curriculum-tagged,
// or truly unassigned (no module AND no exam AND no past paper).
// Groups blocks by (programTargetKind, yearTargetNumber) — MBBS/BDS > Year >
// Block, the extra top level McqBankTree/FlashcardBankTree nest their
// existing Block > Module > Subject > Topic tree under. Blocks with no
// targeting set (the common case until an admin tags them via BlockForm)
// fall into "Unspecified program" / "All years", not hidden or dropped.

export function groupByProgramYear<T extends { key: string | number; program: string | null; year: number | null }>(groups: T[]): Array<{ programLabel: string; yearLabel: string; groups: T[] }> {
  const buckets = new Map<string, { program: string; year: number | null; groups: T[] }>();
  for (const g of groups) {
    const program = g.program || '';
    const year = g.year ?? null;
    const key = `${program}|${year ?? ''}`;
    const existing = buckets.get(key);
    if (existing) existing.groups.push(g); else buckets.set(key, { program, year, groups: [g] });
  }
  const PROGRAM_ORDER = ['MBBS', 'BDS'];
  return [...buckets.values()]
    .sort((a, b) => {
      const ai = a.program ? PROGRAM_ORDER.indexOf(a.program) : 99; const bi = b.program ? PROGRAM_ORDER.indexOf(b.program) : 99;
      if (ai !== bi) return (ai === -1 ? 98 : ai) - (bi === -1 ? 98 : bi);
      if (a.program !== b.program) return a.program.localeCompare(b.program);
      return (a.year ?? 999) - (b.year ?? 999);
    })
    .map((b) => ({ programLabel: b.program || 'Unspecified program', yearLabel: b.year ? `Year ${b.year}` : 'All years', groups: b.groups }));
}

// Groups a flat list of Blocks into <optgroup>-ready buckets by
// Program + Year, for the plain Block <select> filters used by the
// MCQ/flashcard file-import ("parser") pickers and the AI-generate
// flashcard picker. Those selects used to just list every block
// alphabetically regardless of year, unlike McqBankTree/FlashcardBankTree
// and AdminContent's block cards, which already group Block > Module >
// Subject > Topic under Program > Year (see McqBankTree's own comment on
// "the parser's Block filter below"). This closes that gap using the same
// fallback-to-a-module's-targeting resolution as those trees, so e.g. the
// blocks that make up "Third Year MBBS" open together under one
// "MBBS · Year 3" group in the picker instead of being scattered through
// one long flat list.
export function groupBlocksForPicker(blocks: AdminBlock[], modules: AdminModule[]): Array<{ programLabel: string; yearLabel: string; blocks: AdminBlock[] }> {
  const modulesByBlock = new Map<number, AdminModule[]>();
  for (const m of modules) {
    if (m.blockId == null) continue;
    const list = modulesByBlock.get(m.blockId);
    if (list) list.push(m); else modulesByBlock.set(m.blockId, [m]);
  }
  const leaves = blocks.map((b) => {
    const mods = modulesByBlock.get(b.id) ?? [];
    const fallback = mods.find((m) => m.programTargetKind || m.yearTargetNumber);
    return { key: b.id, block: b, program: b.programTargetKind || fallback?.programTargetKind || null, year: b.yearTargetNumber ?? fallback?.yearTargetNumber ?? null };
  });
  return groupByProgramYear(leaves).map((g) => ({ programLabel: g.programLabel, yearLabel: g.yearLabel, blocks: g.groups.map((l) => l.block) }));
}

// Program (MBBS/BDS) + Year filter for the Flashcards/MCQs admin content
// pickers — narrows the Block dropdown (and therefore Module > Subject >
// Topic beneath it) down to one program/year branch instead of making an
// admin scan every "MBBS · Year 3" / "BDS · Year 2" optgroup by hand.
// Reuses the same effective-program/year resolution as groupBlocksForPicker
// above (a block's own targeting, falling back to one of its modules').
export function filterBlocksByProgramYear(blocks: AdminBlock[], modules: AdminModule[], program: string, yearNumber?: number): AdminBlock[] {
  if (!program && !yearNumber) return blocks;
  const modulesByBlock = new Map<number, AdminModule[]>();
  for (const m of modules) {
    if (m.blockId == null) continue;
    const list = modulesByBlock.get(m.blockId);
    if (list) list.push(m); else modulesByBlock.set(m.blockId, [m]);
  }
  return blocks.filter((b) => {
    const mods = modulesByBlock.get(b.id) ?? [];
    const fallback = mods.find((m) => m.programTargetKind || m.yearTargetNumber);
    const effProgram = b.programTargetKind || fallback?.programTargetKind || null;
    const effYear = b.yearTargetNumber ?? fallback?.yearTargetNumber ?? null;
    if (program && effProgram !== program) return false;
    if (yearNumber && effYear !== yearNumber) return false;
    return true;
  });
}

// Program + Year selects, cascading the same way the Degree/Year picker in
// Past papers/Exams works (DEGREE_OPTIONS -> DEGREE_YEAR_OPTIONS[program] —
// picking MBBS shows all 5 MBBS years, BDS shows its 4), but for filtering
// existing academic content down to one branch rather than tagging a new
// row. Used by AdminFlashcards/AdminMcqs above their Block/Module/Subject/
// Topic pickers so admins can jump straight to the right program/year
// instead of scanning every optgroup.
export function ProgramYearFilter({ program, studyYear, onProgramChange, onStudyYearChange, testIdPrefix }: { program: string; studyYear: string; onProgramChange: (v: string) => void; onStudyYearChange: (v: string) => void; testIdPrefix: string }) {
  return <>
    <select value={program} onChange={(e) => { onProgramChange(e.target.value); onStudyYearChange(''); }} className="h-10 rounded-xl border border-border bg-card px-3 text-xs font-semibold" data-testid={`select-${testIdPrefix}-program`}>
      <option value="">All programs (MBBS/BDS)</option>
      {DEGREE_OPTIONS.map((d) => <option key={d} value={d}>{d}</option>)}
    </select>
    <select value={studyYear} onChange={(e) => onStudyYearChange(e.target.value)} disabled={!program} className="h-10 rounded-xl border border-border bg-card px-3 text-xs font-semibold disabled:opacity-50" data-testid={`select-${testIdPrefix}-year`}>
      <option value="">{program ? 'All years' : 'Pick a program first'}</option>
      {(DEGREE_YEAR_OPTIONS[program] || []).map((y) => <option key={y} value={y}>{y}</option>)}
    </select>
  </>;
}

// Lets an admin narrow a whole-bank backup export/restore down to one
// branch of the curriculum tree (Year > Block > Module > Subject > Topic)
// instead of always covering everything — the picker half of the
// backupScope.ts feature on the server. Shared between AdminMcqs' and
// AdminFlashcards' "Backup / restore" panels since both trees use the same
// Block > Module > Subject > Topic shape and neither cares which bank the
// resulting scope is later applied to.
// Shown in the picker, the confirmation text and the downloaded file's label.
export const BACKUP_PROGRAM_LABEL = { MBBS: 'MBBS', BDS: 'BDS', SHARED: 'Shared' } as const;

export function BackupScopePicker({ blocks, allModules, onChange }: { blocks: AdminBlock[]; allModules: AdminModule[]; onChange: (scope: BackupScope | null) => void }) {
  const [level, setLevel] = useState<'all' | 'program' | 'year' | 'block' | 'module' | 'subject' | 'topic'>('all');
  const [programSel, setProgramSel] = useState<'' | 'MBBS' | 'BDS' | 'SHARED'>('');
  const [blockSel, setBlockSel] = useState('');
  const [moduleSel, setModuleSel] = useState('');
  const [subjectSel, setSubjectSel] = useState('');
  const [topicSel, setTopicSel] = useState('');
  const [yearSel, setYearSel] = useState('');
  const subjectsQ = useListSubjects(moduleSel ? { moduleId: Number(moduleSel) } : undefined);
  const topicsQ = useListTopics(subjectSel ? { subjectId: Number(subjectSel) } : undefined);

  // Every academic year that shows up anywhere — a block's own
  // yearTargetNumber, or (same fallback groupBlocksForPicker uses) one of
  // its modules', plus every module's own. Matches the server's notion of
  // a module's "effective year" in backupScope.ts.
  const modulesByBlock = new Map<number, AdminModule[]>();
  for (const m of allModules) { if (m.blockId == null) continue; const list = modulesByBlock.get(m.blockId); if (list) list.push(m); else modulesByBlock.set(m.blockId, [m]); }
  const years = Array.from(new Set([
    ...blocks.map((b) => b.yearTargetNumber ?? (modulesByBlock.get(b.id) ?? []).find((m) => m.yearTargetNumber)?.yearTargetNumber ?? null),
    ...allModules.map((m) => m.yearTargetNumber ?? null),
  ].filter((y): y is number => y != null))).sort((a, b) => a - b);

  const modulesForBlock = blockSel ? allModules.filter((m) => String(m.blockId ?? '') === blockSel) : allModules;
  const blockGroups = groupBlocksForPicker(blocks, allModules);

  useEffect(() => {
    if (level === 'all') { onChange(null); return; }
    if (level === 'program') { onChange(programSel ? { level: 'program', id: 0, label: `${BACKUP_PROGRAM_LABEL[programSel]} · all years`, program: programSel } : null); return; }
    if (level === 'year') { onChange(yearSel ? { level: 'year', id: Number(yearSel), label: `${programSel ? `${BACKUP_PROGRAM_LABEL[programSel]} · ` : ''}Year ${yearSel}`, ...(programSel ? { program: programSel } : {}) } : null); return; }
    if (level === 'block') { onChange(blockSel ? { level: 'block', id: Number(blockSel), label: blocks.find((b) => String(b.id) === blockSel)?.name ?? `Block #${blockSel}` } : null); return; }
    if (level === 'module') { onChange(moduleSel ? { level: 'module', id: Number(moduleSel), label: allModules.find((m) => String(m.id) === moduleSel)?.name ?? `Module #${moduleSel}` } : null); return; }
    if (level === 'subject') { onChange(subjectSel ? { level: 'subject', id: Number(subjectSel), label: (subjectsQ.data || []).find((s) => String(s.id) === subjectSel)?.name ?? `Subject #${subjectSel}` } : null); return; }
    onChange(topicSel ? { level: 'topic', id: Number(topicSel), label: (topicsQ.data || []).find((t) => String(t.id) === topicSel)?.name ?? `Topic #${topicSel}` } : null);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [level, programSel, yearSel, blockSel, moduleSel, subjectSel, topicSel, subjectsQ.data, topicsQ.data]);

  const resetBelow = (next: typeof level) => { setLevel(next); setBlockSel(''); setModuleSel(''); setSubjectSel(''); setTopicSel(''); setYearSel(''); setProgramSel(''); };

  return (
    <div className="flex flex-wrap items-center gap-2">
      <select value={level} onChange={(e) => resetBelow(e.target.value as typeof level)} className="h-9 rounded-lg border border-border bg-background px-2 text-xs font-semibold" data-testid="select-backup-scope-level">
        <option value="all">Whole bank</option>
        <option value="program">One program (MBBS / BDS)</option>
        <option value="year">One year</option>
        <option value="block">One block</option>
        <option value="module">One module</option>
        <option value="subject">One subject</option>
        <option value="topic">One topic</option>
      </select>
      {level === 'program' && <select value={programSel} onChange={(e) => setProgramSel(e.target.value as typeof programSel)} className="h-9 rounded-lg border border-border bg-background px-2 text-xs" data-testid="select-backup-scope-program">
        <option value="">Select program</option>
        <option value="MBBS">MBBS</option><option value="BDS">BDS</option><option value="SHARED">Shared (no program)</option>
      </select>}
      {level === 'year' && <>
        <select value={programSel} onChange={(e) => setProgramSel(e.target.value as typeof programSel)} className="h-9 rounded-lg border border-border bg-background px-2 text-xs" data-testid="select-backup-scope-year-program">
          <option value="">Any program</option>
          <option value="MBBS">MBBS</option><option value="BDS">BDS</option><option value="SHARED">Shared (no program)</option>
        </select>
        <select value={yearSel} onChange={(e) => setYearSel(e.target.value)} className="h-9 rounded-lg border border-border bg-background px-2 text-xs" data-testid="select-backup-scope-year">
          <option value="">Select year</option>{years.map((y) => <option key={y} value={y}>Year {y}</option>)}
        </select>
      </>}
      {level === 'block' && <select value={blockSel} onChange={(e) => setBlockSel(e.target.value)} className="h-9 rounded-lg border border-border bg-background px-2 text-xs" data-testid="select-backup-scope-block">
        <option value="">Select block</option>{blockGroups.map((g) => <optgroup key={`${g.programLabel}-${g.yearLabel}`} label={`${g.programLabel} · ${g.yearLabel}`}>{g.blocks.map((b) => <option key={b.id} value={b.id}>{b.name}</option>)}</optgroup>)}
      </select>}
      {level === 'module' && <>
        <select value={blockSel} onChange={(e) => { setBlockSel(e.target.value); setModuleSel(''); }} className="h-9 rounded-lg border border-border bg-background px-2 text-xs" data-testid="select-backup-scope-module-block">
          <option value="">All blocks</option>{blockGroups.map((g) => <optgroup key={`${g.programLabel}-${g.yearLabel}`} label={`${g.programLabel} · ${g.yearLabel}`}>{g.blocks.map((b) => <option key={b.id} value={b.id}>{b.name}</option>)}</optgroup>)}
        </select>
        <select value={moduleSel} onChange={(e) => setModuleSel(e.target.value)} className="h-9 rounded-lg border border-border bg-background px-2 text-xs" data-testid="select-backup-scope-module">
          <option value="">Select module</option>{modulesForBlock.map((m) => <option key={m.id} value={m.id}>{m.name}</option>)}
        </select>
      </>}
      {level === 'subject' && <>
        <select value={moduleSel} onChange={(e) => { setModuleSel(e.target.value); setSubjectSel(''); }} className="h-9 rounded-lg border border-border bg-background px-2 text-xs" data-testid="select-backup-scope-subject-module">
          <option value="">Select module</option>{allModules.map((m) => <option key={m.id} value={m.id}>{m.name}</option>)}
        </select>
        <select value={subjectSel} onChange={(e) => setSubjectSel(e.target.value)} disabled={!moduleSel} className="h-9 rounded-lg border border-border bg-background px-2 text-xs disabled:opacity-50" data-testid="select-backup-scope-subject">
          <option value="">Select subject</option>{(subjectsQ.data || []).map((s) => <option key={s.id} value={s.id}>{s.name}</option>)}
        </select>
      </>}
      {level === 'topic' && <>
        <select value={moduleSel} onChange={(e) => { setModuleSel(e.target.value); setSubjectSel(''); setTopicSel(''); }} className="h-9 rounded-lg border border-border bg-background px-2 text-xs" data-testid="select-backup-scope-topic-module">
          <option value="">Select module</option>{allModules.map((m) => <option key={m.id} value={m.id}>{m.name}</option>)}
        </select>
        <select value={subjectSel} onChange={(e) => { setSubjectSel(e.target.value); setTopicSel(''); }} disabled={!moduleSel} className="h-9 rounded-lg border border-border bg-background px-2 text-xs disabled:opacity-50" data-testid="select-backup-scope-topic-subject">
          <option value="">Select subject</option>{(subjectsQ.data || []).map((s) => <option key={s.id} value={s.id}>{s.name}</option>)}
        </select>
        <select value={topicSel} onChange={(e) => setTopicSel(e.target.value)} disabled={!subjectSel} className="h-9 rounded-lg border border-border bg-background px-2 text-xs disabled:opacity-50" data-testid="select-backup-scope-topic">
          <option value="">Select topic</option>{(topicsQ.data || []).map((t) => <option key={t.id} value={t.id}>{t.name}</option>)}
        </select>
      </>}
    </div>
  );
}


export function McqBankTree({ modules, blocks, search, statusFilter, difficultyFilter, publishFilter, selectedIds, onToggleSelect }: { modules: AdminModule[]; blocks: AdminBlock[]; search?: string; statusFilter?: ExplanationStatus | null; difficultyFilter?: string | null; publishFilter?: 'published' | 'draft' | null; selectedIds: Set<number>; onToggleSelect: (id: number) => void }) {
  const treeQ = useQuery({ queryKey: ['admin-mcqs-tree'], queryFn: mcqAdminApi.list });
  const allRows = treeQ.data ?? [];
  // Search box + explanation-status filter (the latter driven by clicking a
  // tile in ExplanationCoverage) — this used to only apply to the flat list;
  // now the tree is the only view, so it filters the rows itself.
  const q = (search ?? '').trim().toLowerCase();
  const rows = allRows.filter((r) => (!q || r.question.toLowerCase().includes(q)) && (!statusFilter || r.explanationStatus === statusFilter) && (!difficultyFilter || r.difficulty === difficultyFilter) && (!publishFilter || (publishFilter === 'published') === (r.status.toLowerCase() === 'published')));
  const mcqsByTopic = new Map<number, AdminMcqRow[]>();
  const trulyUnassigned: AdminMcqRow[] = [];
  for (const row of rows) {
    if (row.examId !== null || row.pastPaperId !== null) continue;
    if (row.topicId === null) { trulyUnassigned.push(row); continue; }
    const list = mcqsByTopic.get(row.topicId);
    if (list) list.push(row); else mcqsByTopic.set(row.topicId, [row]);
  }
  const countByModule = new Map<number, number>();
  for (const row of rows) if (row.moduleId !== null && row.examId === null && row.pastPaperId === null) countByModule.set(row.moduleId, (countByModule.get(row.moduleId) ?? 0) + 1);
  if (treeQ.isLoading) return <SkeletonPage />;
  if (!modules.length && !trulyUnassigned.length) return <EmptyState icon={CircleHelp} title="No modules yet" body="Create a module first under Academic content, then come back to browse its questions here." />;
  // Group modules under their Block so the bank tree reads Block > Module >
  // Subject > Topic, same grouping level the parser's Block filter below
  // narrows by.
  const modulesByBlock = new Map<number | 'other', AdminModule[]>();
  for (const m of modules) { const key = m.blockId ?? 'other'; const list = modulesByBlock.get(key); if (list) list.push(m); else modulesByBlock.set(key, [m]); }
  // Every block/module becomes one "leaf" with an effective program/year,
  // then groupByProgramYear buckets all of them together — this is what
  // makes "I tagged my modules as MBBS Year 1 but never touched the block"
  // still land under MBBS > Year 1 instead of Unspecified: a block with no
  // targeting of its own falls back to whatever its modules say, and a
  // module with no block at all is grouped by its own targeting directly
  // instead of being dumped in an undifferentiated "other" bucket.
  const blockLeaves = blocks.filter((b) => modulesByBlock.has(b.id)).map((b) => {
    const mods = modulesByBlock.get(b.id)!;
    const fallback = mods.find((m) => m.programTargetKind || m.yearTargetNumber);
    return { key: `block-${b.id}`, name: b.name, mods, program: b.programTargetKind || fallback?.programTargetKind || null, year: b.yearTargetNumber ?? fallback?.yearTargetNumber ?? null };
  });
  const standaloneLeaves = (modulesByBlock.get('other') ?? []).map((m) => ({ key: `module-${m.id}`, name: m.name, mods: [m], program: m.programTargetKind || null, year: m.yearTargetNumber ?? null }));
  const programYearGroups = groupByProgramYear([...blockLeaves, ...standaloneLeaves]);
  const showBlockLabel = blocks.length > 0 || standaloneLeaves.length > 0;
  return <div className="space-y-4">
    {programYearGroups.map(({ programLabel, yearLabel, groups }) => <McqTreeYearGroup key={`${programLabel}-${yearLabel}`} programLabel={programLabel} yearLabel={yearLabel} groups={groups} showBlockLabel={showBlockLabel} rows={rows} countByModule={countByModule} mcqsByTopic={mcqsByTopic} selectedIds={selectedIds} onToggleSelect={onToggleSelect} />)}
    {!!trulyUnassigned.length && <div className="rounded-2xl border border-dashed border-border bg-card p-4"><p className="mb-3 text-xs font-bold text-muted-foreground">{trulyUnassigned.length} question{trulyUnassigned.length === 1 ? '' : 's'} with no module/subject/topic, exam, or past paper</p><div className="space-y-2">{trulyUnassigned.map((m) => <McqTreeRow key={m.id} mcq={m} selectedIds={selectedIds} onToggleSelect={onToggleSelect} />)}</div></div>}
  </div>;
}

// Top level of the bank tree — one "MBBS/BDS · Year N" group. Collapsed by
// default: clicking it is what rolls out the Blocks (and their nested
// Modules/Subjects/Topics) underneath, instead of dumping every block and
// module open on screen at once.

export function McqTreeYearGroup({ programLabel, yearLabel, groups, showBlockLabel, rows, countByModule, mcqsByTopic, selectedIds, onToggleSelect }: {
  programLabel: string; yearLabel: string;
  groups: Array<{ key: string; name: string; mods: AdminModule[] }>;
  showBlockLabel: boolean; rows: AdminMcqRow[]; countByModule: Map<number, number>; mcqsByTopic: Map<number, AdminMcqRow[]>;
  selectedIds: Set<number>; onToggleSelect: (id: number) => void;
}) {
  const [open, setOpen] = useState(false);
  const groupRows = rows.filter((r) => r.moduleId != null && groups.some((g) => g.mods.some((m) => m.id === r.moduleId)));
  return <div className="rounded-2xl border border-border bg-card">
    <button type="button" onClick={() => setOpen((v) => !v)} className="flex w-full items-center gap-2 px-5 py-3.5 text-left" data-testid={`button-tree-year-${programLabel}-${yearLabel}`}>
      <ChevronRight size={16} className={cn('shrink-0 text-primary transition-transform', open && 'rotate-90')} />
      <GraduationCap size={15} className="shrink-0 text-primary" />
      <h3 className="flex-1 text-sm font-extrabold" data-testid={`text-program-year-group-${programLabel}-${yearLabel}`}>{programLabel} <span className="font-normal text-muted-foreground">· {yearLabel}</span></h3>
      <span className="text-[11px] text-muted-foreground">{groupRows.length} question{groupRows.length === 1 ? '' : 's'}</span>
    </button>
    {open && <div className="space-y-5 border-t border-border p-4">
      {groups.map((g) => { const blockRows = rows.filter((r) => r.moduleId != null && g.mods.some((m) => m.id === r.moduleId)); return <div key={g.key} className="space-y-3">
        {showBlockLabel && <div className="flex flex-wrap items-center justify-between gap-1"><p className="text-[10px] font-extrabold uppercase tracking-wide text-muted-foreground" data-testid={`text-mcq-block-group-${g.key}`}>{g.name}</p>{!!blockRows.length && <BlockAnalysisToggle rows={blockRows} label={g.name} />}</div>}
        {g.mods.map((m) => <McqTreeModule key={m.id} moduleId={m.id} name={m.name} mcqCount={countByModule.get(m.id) ?? 0} mcqsByTopic={mcqsByTopic} selectedIds={selectedIds} onToggleSelect={onToggleSelect} />)}
      </div>; })}
    </div>}
  </div>;
}

// Collapsible group of MCQs that belong to one exam or past paper (no
// module/subject/topic) — same row component as the module tree uses. Used
// by ExamManagePanel/AdminPastPapers, not the main bank tree above anymore.

export function McqSourceGroup({ label, icon: Icon, rows }: { label: string; icon: typeof FolderOpen; rows: AdminMcqRow[] }) {
  const [open, setOpen] = useState(false);
  return <div className="rounded-xl border border-border bg-background">
    <button onClick={() => setOpen((v) => !v)} className="flex w-full items-center justify-between px-3 py-2 text-left text-xs font-bold" data-testid={`button-mcq-source-group-${label}`}><span className="flex items-center gap-2"><ChevronRight size={13} className={cn('transition-transform', open && 'rotate-90')} /><Icon size={13} className="text-primary" />{label}</span><span className="text-[10px] font-normal text-muted-foreground">{rows.length} question{rows.length === 1 ? '' : 's'}</span></button>
    {open && <div className="space-y-2 border-t border-border p-3">{rows.map((m) => <McqTreeRow key={m.id} mcq={m} />)}</div>}
  </div>;
}

export function PastPaperEditForm({ paper, onSave, onCancel, saving, collegeOptions }: { paper: PastPaper; onSave: (body: Partial<PastPaper>) => void; onCancel: () => void; saving: boolean; collegeOptions: string[] }) {
  const [initialDegree, initialStudyYear] = (paper.level || '').split(' - ').map((s) => s.trim());
  const [formDegree, setFormDegree] = useState(DEGREE_OPTIONS.includes(initialDegree as typeof DEGREE_OPTIONS[number]) ? initialDegree : '');
  const [formStudyYear, setFormStudyYear] = useState((DEGREE_YEAR_OPTIONS[initialDegree] || []).includes(initialStudyYear) ? initialStudyYear : '');
  const [formProgramId, setFormProgramId] = useState(paper.programId ? String(paper.programId) : '');
  const programsQ = useQuery({ queryKey: ['admin-programs-flat'], queryFn: () => academicApi.programs(undefined, true) });
  const academicYearsQ = useQuery({ queryKey: ['admin-academic-years-flat', formProgramId], queryFn: () => academicApi.academicYears(formProgramId ? Number(formProgramId) : undefined, true) });
  const composedLevel = [formDegree, formStudyYear].filter(Boolean).join(' - ');

  return <form onSubmit={(e) => {
    e.preventDefault();
    if (!formDegree || !formStudyYear) { toast({ title: 'Degree and year required', description: 'Pick both so this paper only shows to the right students — leaving them blank makes it visible to every year.', variant: 'destructive' }); return; }
    const f = new FormData(e.currentTarget);
    const programId = f.get('programId') ? Number(f.get('programId')) : null;
    const academicYearId = f.get('academicYearId') ? Number(f.get('academicYearId')) : null;
    onSave({
      title: String(f.get('title')), examBoard: String(f.get('examBoard') || ''), year: String(f.get('year') || ''),
      level: composedLevel || String(f.get('level') || ''), programId, academicYearId,
      programTargetKind: formDegree || null, yearTargetNumber: studyYearToNumber(formDegree, formStudyYear) ?? null,
    });
  }} className="grid gap-3 rounded-2xl border border-primary/30 bg-primary/10 p-4 sm:p-5 md:grid-cols-4">
    <input required name="title" defaultValue={paper.title} placeholder="Paper title, e.g. Block A" className="h-11 rounded-xl border border-border bg-card px-3 text-xs outline-none transition-shadow focus:ring-2 focus:ring-primary/25 md:col-span-2" data-testid={`input-edit-paper-title-${paper.id}`} />
    <input name="examBoard" defaultValue={paper.examBoard} list={`edit-paper-college-options-${paper.id}`} placeholder="College, e.g. KMU" className="h-11 rounded-xl border border-border bg-card px-3 text-xs outline-none transition-shadow focus:ring-2 focus:ring-primary/25" data-testid={`input-edit-paper-board-${paper.id}`} />
    <datalist id={`edit-paper-college-options-${paper.id}`}>{collegeOptions.map((c) => <option key={c} value={c} />)}</datalist>
    <input name="year" defaultValue={paper.year} placeholder="Year, e.g. 2024" className="h-11 rounded-xl border border-border bg-card px-3 text-xs outline-none transition-shadow focus:ring-2 focus:ring-primary/25" data-testid={`input-edit-paper-year-${paper.id}`} />

    <div className="rounded-xl border-2 border-primary/40 bg-card/70 p-3 md:col-span-4">
      <p className="mb-2.5 text-[10px] font-extrabold uppercase tracking-[.08em] text-primary">Degree &amp; year (shown to students) — required</p>
      <div className="grid gap-3 sm:grid-cols-2">
        <label className="block">
          <span className="mb-1.5 block text-[11px] font-bold text-muted-foreground">Degree</span>
          <select required value={formDegree} onChange={(e) => { setFormDegree(e.target.value); setFormStudyYear(''); }} className="h-11 w-full rounded-xl border border-border bg-card px-3 text-xs font-semibold outline-none transition-shadow focus:ring-2 focus:ring-primary/25" data-testid={`select-edit-paper-degree-${paper.id}`}>
            <option value="">Select degree…</option>
            {DEGREE_OPTIONS.map((d) => <option key={d} value={d}>{d}</option>)}
          </select>
        </label>
        <label className="block">
          <span className="mb-1.5 block text-[11px] font-bold text-muted-foreground">Year</span>
          <select required value={formStudyYear} onChange={(e) => setFormStudyYear(e.target.value)} disabled={!formDegree} className="h-11 w-full rounded-xl border border-border bg-card px-3 text-xs font-semibold outline-none transition-shadow focus:ring-2 focus:ring-primary/25 disabled:opacity-50" data-testid={`select-edit-paper-study-year-${paper.id}`}>
            <option value="">{formDegree ? 'Select year…' : 'Pick a degree first'}</option>
            {(DEGREE_YEAR_OPTIONS[formDegree] || []).map((y) => <option key={y} value={y}>{y}</option>)}
          </select>
        </label>
      </div>
      <p className="mt-2 text-[11px] font-semibold text-accent-text">Both are required — leaving either blank makes this paper visible to every year, which is the bug this fixes.</p>
    </div>

    <select name="programId" value={formProgramId} onChange={(e) => setFormProgramId(e.target.value)} className="h-11 rounded-xl border border-border bg-card px-3 text-xs outline-none transition-shadow focus:ring-2 focus:ring-primary/25 md:col-span-2" data-testid={`select-edit-paper-program-${paper.id}`}><option value="">All programs (advanced targeting, optional)</option>{(programsQ.data || []).map((p) => <option key={p.id} value={p.id}>{p.name}</option>)}</select>
    <select name="academicYearId" defaultValue={paper.academicYearId ?? ''} disabled={!formProgramId} className="h-11 rounded-xl border border-border bg-card px-3 text-xs outline-none transition-shadow focus:ring-2 focus:ring-primary/25 disabled:opacity-50 md:col-span-2" data-testid={`select-edit-paper-academic-year-${paper.id}`}><option value="">All years</option>{(academicYearsQ.data || []).map((y) => <option key={y.id} value={y.id}>{y.label}</option>)}</select>
    <input name="level" value={composedLevel} onChange={() => {}} placeholder="Level label (auto-filled from Degree + Year above)" className="h-11 rounded-xl border border-border bg-card px-3 text-xs outline-none transition-shadow focus:ring-2 focus:ring-primary/25 md:col-span-2" data-testid={`input-edit-paper-level-${paper.id}`} readOnly />

    <div className="flex flex-col gap-2 sm:flex-row md:col-span-2">
      <button disabled={saving} className="btn-pop flex-1 rounded-xl bg-primary px-4 py-2.5 text-xs font-bold text-primary-foreground shadow-sm sm:flex-none disabled:opacity-50" data-testid={`button-save-edit-paper-${paper.id}`}>{saving ? <span className="inline-flex items-center gap-2"><BrandSpinner size={13} /> Saving…</span> : 'Save changes'}</button>
      <button type="button" onClick={onCancel} className="btn-pop flex-1 rounded-xl border border-border bg-card px-4 py-2.5 text-xs font-bold hover:bg-muted sm:flex-none" data-testid={`button-cancel-edit-paper-${paper.id}`}>Cancel</button>
    </div>
  </form>;
}

// This paper's own question bank — MCQs with pastPaperId set are exclusively
// owned by their paper (no junction table like exams have), so this is a
// straight filter of the same admin MCQ list the main bank tree uses,
// reusing McqTreeRow for edit/delete so it behaves identically to editing a
// question there.

export function PastPaperQuestionsList({ pastPaperId }: { pastPaperId: number }) {
  const treeQ = useQuery({ queryKey: ['admin-mcqs-tree'], queryFn: mcqAdminApi.list });
  const rows = (treeQ.data ?? []).filter((m) => m.pastPaperId === pastPaperId);
  if (treeQ.isLoading) return <InlineLoading />;
  if (!rows.length) return <p className="text-[11px] text-muted-foreground">No questions yet — upload some below.</p>;
  return <div>
    {/* Same AI tools the main MCQ bank's Module -> Subject -> Topic tree
        gets (classify difficulty, generate missing per-option explanations
        — including for the correct option, not just the wrong ones, since
        "missing" here means any incomplete slot — and shuffle option
        order), scoped to just this paper's questions via pastPaperId
        instead of moduleId/subjectId/topicId. */}
    <div className="mb-2 flex items-center justify-end"><AnalysisToggle rows={rows} label={`this paper's questions`} filters={{ pastPaperId }} /></div>
    <div className="max-h-96 space-y-2 overflow-y-auto pr-1">{rows.map((m) => <McqTreeRow key={m.id} mcq={m} />)}</div>
  </div>;
}

// Compact bulk-import widget scoped to one past paper — parses a file into
// candidate MCQs (reusing the same parser as the main MCQ bank) and commits
// them tagged with this paper's id.

export function PastPaperUploader({ pastPaperId, onImported }: { pastPaperId: number; onImported: () => void }) {
  const modulesQ = useListModules();
  const modules = modulesQ.data ?? [];
  const [moduleId, setModuleId] = useState('');
  const subjectsQ = useListSubjects(moduleId ? { moduleId: Number(moduleId) } : undefined);
  const [subjectId, setSubjectId] = useState('');
  const topicsQ = useListTopics(subjectId ? { subjectId: Number(subjectId) } : undefined);
  const [topicId, setTopicId] = useState('');
  const [file, setFile] = useState<File | null>(null);
  const [parsing, setParsing] = useState(false);
  const [parseError, setParseError] = useState<string | null>(null);
  const [candidates, setCandidates] = useState<McqCandidate[]>([]);
  // Same review UI as the MCQ bank / exam-attach importer (see
  // ExamManagePanel above) — full editable fields per candidate, including
  // per-option explanations, instead of the old read-only question/option
  // count summary. The old summary never surfaced optionExplanations at
  // all, so a paper's per-option rationale (even when the file had it and
  // the parser already extracted it — see mcqParser.ts) silently never made
  // it into what got imported for review or committed.
  const updateCandidate = (i: number, patch: Partial<McqCandidate>) => setCandidates((prev) => prev.map((c, ci) => (ci === i ? { ...c, ...patch } : c)));
  const removeCandidate = (i: number) => setCandidates((prev) => prev.filter((_, ci) => ci !== i));
  const commit = useMutation({
    mutationFn: mcqImportApi.commit,
    onSuccess: (res) => { queryClient.invalidateQueries({ queryKey: getListMcqsQueryKey() }); queryClient.invalidateQueries({ queryKey: ['admin-past-papers'] }); setCandidates([]); setFile(null); toast({ title: `Imported ${res.imported} questions`, description: 'Linked to this past paper.' }); onImported(); },
    onError: (err: unknown) => toast({ title: 'Import failed', description: err instanceof ApiRequestError ? err.message : 'Something went wrong.', variant: 'destructive' }),
  });
  const parseFile = async () => {
    if (!file) return;
    setParsing(true); setParseError(null);
    try { setCandidates((await mcqImportApi.parse(file)).candidates); }
    catch (err) { setParseError(err instanceof ApiRequestError ? err.message : 'Could not parse this file.'); }
    finally { setParsing(false); }
  };
  const importAll = () => {
    if (!candidates.length) return;
    const cleaned = candidates.map((c) => ({ ...c, options: c.options.map((o) => o.trim()).filter(Boolean) })).filter((c) => c.options.length >= 2);
    // pastPaperId alone is enough to save these — module/subject/topic below
    // are an optional "also file this under a topic" extra, not a gate.
    commit.mutate({ moduleId: moduleId ? Number(moduleId) : undefined, subjectId: subjectId ? Number(subjectId) : undefined, topicId: topicId ? Number(topicId) : undefined, pastPaperId, status: 'published', mcqs: cleaned });
  };

  return <div>
    <p className="mb-2 text-[11px] text-muted-foreground">Optional — also file these under a module/subject/topic. Not required to import; the past paper is enough on its own.</p>
    <div className="grid gap-2 sm:grid-cols-3"><select value={moduleId} onChange={(e) => { setModuleId(e.target.value); setSubjectId(''); setTopicId(''); }} className="h-9 rounded-lg border border-border bg-background px-2 text-xs" data-testid={`select-paper-module-${pastPaperId}`}><option value="">No module</option>{modules.map((m) => <option key={m.id} value={m.id}>{m.name}</option>)}</select><select value={subjectId} onChange={(e) => { setSubjectId(e.target.value); setTopicId(''); }} disabled={!moduleId} className="h-9 rounded-lg border border-border bg-background px-2 text-xs disabled:opacity-50" data-testid={`select-paper-subject-${pastPaperId}`}><option value="">No subject</option>{(subjectsQ.data || []).map((s) => <option key={s.id} value={s.id}>{s.name}</option>)}</select><select value={topicId} onChange={(e) => setTopicId(e.target.value)} disabled={!subjectId} className="h-9 rounded-lg border border-border bg-background px-2 text-xs disabled:opacity-50" data-testid={`select-paper-topic-${pastPaperId}`}><option value="">No topic</option>{(topicsQ.data || []).map((t) => <option key={t.id} value={t.id}>{t.name}</option>)}</select></div>
    <p className="mt-2 text-[11px] font-semibold text-muted-foreground">Supports .txt, .csv, .xlsx, .xls, .pdf, .docx, and picks up per-option explanations if the file has them.</p>
    <div className="mt-2 flex flex-wrap items-center gap-2"><input type="file" accept=".txt,.csv,.xlsx,.xls,.pdf,.docx" onChange={(e) => setFile(e.target.files?.[0] ?? null)} className="flex-1 rounded-lg border border-dashed border-border bg-background px-2 py-2 text-xs" data-testid={`input-paper-file-${pastPaperId}`} /><button disabled={!file || parsing} onClick={parseFile} className="rounded-lg bg-primary px-3 py-2 text-xs font-bold text-primary-foreground disabled:opacity-50" data-testid={`button-parse-paper-${pastPaperId}`}>{parsing ? 'Reading…' : 'Parse file'}</button></div>
    {parseError && <p className="mt-2 text-[11px] font-semibold text-destructive">{parseError}</p>}
    {candidates.length > 0 && <div className="mt-3 space-y-3">
      <div className="flex flex-wrap items-center justify-between gap-2 text-xs font-bold"><span>{candidates.length} questions found · {candidates.filter((c) => c.needsReview).length} need review</span><button disabled={commit.isPending} onClick={importAll} className="rounded-lg bg-primary px-3 py-1.5 text-[11px] font-extrabold text-primary-foreground disabled:opacity-50" data-testid={`button-import-paper-${pastPaperId}`}>{commit.isPending ? 'Importing…' : `Import ${candidates.length} questions`}</button></div>
      <div className="max-h-96 space-y-2 overflow-y-auto pr-1">{candidates.map((c, i) => <div key={i} className={cn('rounded-xl border bg-card p-3', c.needsReview ? 'border-accent' : 'border-border')} data-testid={`card-paper-candidate-${i}`}>
        <div className="flex items-center justify-between"><span className={cn('rounded-full px-2 py-0.5 text-[10px] font-bold', c.needsReview ? 'bg-accent/20 text-accent-text' : 'bg-primary/15 text-primary')}>{c.needsReview ? 'Needs review' : 'Looks good'}</span><button onClick={() => removeCandidate(i)} className="text-[11px] font-bold text-destructive" data-testid={`button-remove-paper-candidate-${i}`}>Remove</button></div>
        <textarea value={c.question} onChange={(e) => updateCandidate(i, { question: e.target.value })} className="mt-2 min-h-12 w-full rounded-lg border border-border bg-background p-2 text-xs" data-testid={`input-paper-candidate-question-${i}`} />
        <SuggestedPathHint path={c.suggestedPath} />
        <div className="mt-2 grid gap-2 sm:grid-cols-2">{[0, 1, 2, 3, 4].map((oi) => <input key={oi} value={c.options[oi] || ''} onChange={(e) => { const opts = [...c.options]; opts[oi] = e.target.value; updateCandidate(i, { options: opts }); }} placeholder={`Option ${String.fromCharCode(65 + oi)}${oi === 4 ? ' (optional)' : ''}`} className="h-8 rounded-lg border border-border bg-background px-2 text-xs" data-testid={`input-paper-candidate-option-${i}-${oi}`} />)}</div>
        <div className="mt-2 flex items-center gap-2"><span className="text-[11px] font-bold text-muted-foreground">Correct:</span><select value={c.correctAnswer ?? ''} onChange={(e) => updateCandidate(i, { correctAnswer: e.target.value || null })} className="h-8 flex-1 rounded-lg border border-border bg-background px-2 text-xs" data-testid={`select-paper-candidate-answer-${i}`}><option value="">Not set</option>{c.options.map((opt, oi) => opt && <option key={oi} value={opt}>{String.fromCharCode(65 + oi)}. {opt.slice(0, 40)}</option>)}</select></div>
        <div className="mt-2 flex items-center gap-2"><span className="text-[11px] font-bold text-muted-foreground">Difficulty:</span><DifficultyPicker value={c.difficulty} onChange={(v) => updateCandidate(i, { difficulty: v })} testId={`button-paper-candidate-difficulty-${i}`} /></div>
        <div className="mt-2 grid gap-2 sm:grid-cols-2">
          <input value={c.hint ?? ''} onChange={(e) => updateCandidate(i, { hint: e.target.value || null })} placeholder="Hint (optional — shown while attempting)" className="h-8 w-full rounded-lg border border-border bg-background px-2 text-xs" data-testid={`input-paper-candidate-hint-${i}`} />
          <input value={c.reference ?? ''} onChange={(e) => updateCandidate(i, { reference: e.target.value || null })} placeholder="Reference (optional)" className="h-8 w-full rounded-lg border border-border bg-background px-2 text-xs" data-testid={`input-paper-candidate-reference-${i}`} />
        </div>
        {c.options.some((o) => o.trim()) && <details className="mt-2" open={!!c.optionExplanations?.some((e) => e?.trim())}>
          <summary className="cursor-pointer text-[11px] font-bold text-primary">Per-option explanations</summary>
          <div className="mt-2 space-y-1.5">{c.options.map((opt, oi) => opt.trim() && <div key={oi} className="flex items-start gap-2"><span className={cn('mt-1.5 grid size-5 shrink-0 place-items-center rounded text-[10px] font-bold', c.correctAnswer === opt ? 'bg-primary/15 text-primary' : 'bg-destructive/10 text-destructive')}>{String.fromCharCode(65 + oi)}</span><textarea value={c.optionExplanations?.[oi] ?? ''} onChange={(e) => { const next = [...(c.optionExplanations ?? c.options.map(() => null))]; next[oi] = e.target.value || null; updateCandidate(i, { optionExplanations: next }); }} placeholder={c.correctAnswer === opt ? 'Why this is correct...' : 'Why this is wrong...'} className="min-h-8 flex-1 rounded-lg border border-border bg-background p-2 text-xs" data-testid={`input-paper-candidate-option-explanation-${i}-${oi}`} /></div>)}</div>
        </details>}
      </div>)}</div>
    </div>}
  </div>;
}

// Editable row for one flashcard — front/back text, inline edit, delete.
// Mirrors McqTreeRow's shape (edit form replaces the display on click).

export function FlashcardTreeRow({ card }: { card: AdminFlashcard }) {
  const [editing, setEditing] = useState(false);
  const [front, setFront] = useState(card.front);
  const [back, setBack] = useState(card.back);
  const [deleting, setDeleting] = useState(false);
  const invalidate = () => { queryClient.invalidateQueries({ queryKey: ['admin-flashcards-tree'] }); queryClient.invalidateQueries({ queryKey: getListFlashcardsQueryKey() }); };
  const update = useMutation({ mutationFn: () => flashcardsAdminApi.update(card.id, { front: front.trim(), back: back.trim() }), onSuccess: () => { invalidate(); setEditing(false); }, onError: (err: unknown) => toast({ title: 'Could not save flashcard', description: err instanceof ApiRequestError ? err.message : 'Something went wrong.', variant: 'destructive' }) });
  const remove = useMutation({ mutationFn: () => flashcardsAdminApi.remove(card.id), onSuccess: () => { invalidate(); setDeleting(false); }, onError: (err: unknown) => toast({ title: 'Could not delete flashcard', description: err instanceof ApiRequestError ? err.message : 'Something went wrong.', variant: 'destructive' }) });

  if (editing) return <div className="rounded-xl border border-primary/30 bg-primary/10 p-3" data-testid={`row-edit-flashcard-${card.id}`}>
    <textarea value={front} onChange={(e) => setFront(e.target.value)} placeholder="Front" className="min-h-14 w-full rounded-lg border border-border bg-card p-2 text-xs" data-testid={`input-edit-flashcard-front-${card.id}`} />
    <textarea value={back} onChange={(e) => setBack(e.target.value)} placeholder="Back" className="mt-2 min-h-14 w-full rounded-lg border border-border bg-card p-2 text-xs" data-testid={`input-edit-flashcard-back-${card.id}`} />
    <div className="mt-2 flex gap-2"><button type="button" disabled={update.isPending || !front.trim() || !back.trim()} onClick={() => update.mutate()} className="rounded-lg bg-primary px-3 py-1.5 text-[11px] font-bold text-primary-foreground disabled:opacity-50" data-testid={`button-save-flashcard-${card.id}`}>Save</button><button type="button" onClick={() => { setEditing(false); setFront(card.front); setBack(card.back); }} className="rounded-lg border border-border px-3 py-1.5 text-[11px] font-bold text-muted-foreground" data-testid={`button-cancel-edit-flashcard-${card.id}`}>Cancel</button></div>
  </div>;
  return <div className="rounded-xl border border-border bg-card p-3" data-testid={`row-flashcard-${card.id}`}>
    <div className="flex items-start justify-between gap-2"><p className="text-xs font-bold leading-5">{card.front}</p><div className="flex shrink-0 items-center gap-1"><button type="button" onClick={() => setEditing(true)} className="rounded-lg p-1.5 text-muted-foreground hover:bg-muted" data-testid={`button-edit-flashcard-${card.id}`}><Pencil size={13} /></button><button type="button" onClick={() => setDeleting(true)} className="rounded-lg p-1.5 text-muted-foreground hover:bg-destructive/10 hover:text-destructive" data-testid={`button-delete-flashcard-${card.id}`}><Trash2 size={13} /></button></div></div>
    <p className="mt-1.5 text-xs leading-5 text-muted-foreground">{card.back}</p>
    {deleting && <ConfirmDialog title="Delete this flashcard?" body="This cannot be undone." onCancel={() => setDeleting(false)} onConfirm={() => remove.mutate()} pending={remove.isPending} />}
  </div>;
}

// "Delete every flashcard in this scope" — mirrors BulkDeleteInScope for MCQs.

export function FlashcardBulkDeleteInScope({ label, count, filters }: { label: string; count: number; filters: { moduleId?: number; subjectId?: number; topicId?: number } }) {
  const [confirming, setConfirming] = useState(false);
  const bulkDelete = useMutation({
    mutationFn: () => flashcardsAdminApi.bulkRemove({ all: true, filters }),
    onSuccess: (res) => { queryClient.invalidateQueries({ queryKey: ['admin-flashcards-tree'] }); queryClient.invalidateQueries({ queryKey: getListFlashcardsQueryKey() }); setConfirming(false); toast({ title: `Deleted ${res.deleted} flashcard${res.deleted === 1 ? '' : 's'}` }); },
    onError: (err: unknown) => toast({ title: 'Bulk delete failed', description: err instanceof ApiRequestError ? err.message : 'Something went wrong.', variant: 'destructive' }),
  });
  if (!count) return null;
  return <>
    <button type="button" onClick={(e) => { e.stopPropagation(); setConfirming(true); }} className="rounded-lg p-1 text-muted-foreground hover:bg-destructive/10 hover:text-destructive" data-testid={`button-delete-all-flashcards-in-${label.replace(/\s+/g, '-').toLowerCase()}`} aria-label={`Delete all flashcards in ${label}`}><Trash2 size={13} /></button>
    {confirming && <ConfirmDialog title={`Delete all ${count} flashcard${count === 1 ? '' : 's'} in "${label}"?`} body="This removes every flashcard in this scope — there is no undo." confirmLabel={`Delete all ${count}`} onCancel={() => setConfirming(false)} onConfirm={() => bulkDelete.mutate()} pending={bulkDelete.isPending} />}
  </>;
}

export function FlashcardTreeTopic({ topicId, name, cardsByTopic }: { topicId: number; name: string; cardsByTopic: Map<number, AdminFlashcard[]> }) {
  const [open, setOpen] = useState(false);
  const rows = cardsByTopic.get(topicId) ?? [];
  return <div className="rounded-lg border border-border bg-background">
    <div className="flex items-center justify-between px-3 py-2"><button onClick={() => setOpen((v) => !v)} className="flex flex-1 items-center gap-2 text-left text-xs font-bold" data-testid={`button-flashcard-tree-topic-${topicId}`}><ChevronRight size={13} className={cn('transition-transform', open && 'rotate-90')} />{name}</button><span className="text-[10px] font-normal text-muted-foreground">{rows.length} card{rows.length === 1 ? '' : 's'}</span><FlashcardBulkDeleteInScope label={name} count={rows.length} filters={{ topicId }} /></div>
    {open && <div className="space-y-2 border-t border-border p-3">{rows.length ? rows.map((c) => <FlashcardTreeRow key={c.id} card={c} />) : <p className="text-[11px] text-muted-foreground">No flashcards in this topic yet.</p>}</div>}
  </div>;
}

export function FlashcardTreeSubject({ subjectId, name, cardsByTopic }: { subjectId: number; name: string; cardsByTopic: Map<number, AdminFlashcard[]> }) {
  const [open, setOpen] = useState(false);
  const topicsQ = useQuery({ queryKey: ['admin-topics', subjectId], queryFn: () => topicAdminApi.list(subjectId), enabled: open });
  const topics = topicsQ.data ?? [];
  const subjectCount = [...cardsByTopic.entries()].filter(([tId]) => topics.some((t) => t.id === tId)).reduce((sum, [, rows]) => sum + rows.length, 0);
  return <div className="rounded-xl border border-border bg-card">
    <div className="flex items-center justify-between px-4 py-2.5"><button onClick={() => setOpen((v) => !v)} className="flex flex-1 items-center gap-2 text-left text-xs font-bold" data-testid={`button-flashcard-tree-subject-${subjectId}`}><ChevronRight size={14} className={cn('transition-transform', open && 'rotate-90')} />{name}</button>{open && <FlashcardBulkDeleteInScope label={name} count={subjectCount} filters={{ subjectId }} />}</div>
    {open && <div className="space-y-2 border-t border-border p-3">{topicsQ.isLoading ? <InlineLoading label="Loading topics…" /> : topics.length ? topics.map((t) => <FlashcardTreeTopic key={t.id} topicId={t.id} name={t.name} cardsByTopic={cardsByTopic} />) : <p className="text-[11px] text-muted-foreground">No topics in this subject yet.</p>}</div>}
  </div>;
}

export function FlashcardTreeModule({ moduleId, name, cardCount, cardsByTopic }: { moduleId: number; name: string; cardCount: number; cardsByTopic: Map<number, AdminFlashcard[]> }) {
  const [open, setOpen] = useState(false);
  const subjectsQ = useQuery({ queryKey: ['admin-subjects', moduleId], queryFn: () => subjectAdminApi.list(moduleId), enabled: open });
  const subjects = subjectsQ.data ?? [];
  return <div className="rounded-2xl border border-border bg-card">
    <div className="flex items-center justify-between px-5 py-3.5"><button onClick={() => setOpen((v) => !v)} className="flex flex-1 items-center gap-2 text-left text-sm font-extrabold" data-testid={`button-flashcard-tree-module-${moduleId}`}><ChevronRight size={16} className={cn('transition-transform', open && 'rotate-90')} />{name}</button><span className="text-[11px] text-muted-foreground">{cardCount} card{cardCount === 1 ? '' : 's'}</span><FlashcardBulkDeleteInScope label={name} count={cardCount} filters={{ moduleId }} /></div>
    {open && <div className="space-y-2 border-t border-border p-4">{subjectsQ.isLoading ? <InlineLoading label="Loading subjects…" /> : subjects.length ? subjects.map((s) => <FlashcardTreeSubject key={s.id} subjectId={s.id} name={s.name} cardsByTopic={cardsByTopic} />) : <p className="text-xs text-muted-foreground">No subjects in this module yet.</p>}</div>}
  </div>;
}

// Top level of the flashcard bank tree — one "MBBS/BDS · Year N" group.
// Collapsed by default, exactly like McqTreeYearGroup in the MCQ bank:
// clicking it is what rolls out the Blocks (and their nested
// Modules/Subjects/Topics) underneath, instead of dumping every block and
// module open on screen at once.

export function FlashcardTreeYearGroup({ programLabel, yearLabel, groups, showBlockLabel, countByModule, cardsByTopic }: {
  programLabel: string; yearLabel: string;
  groups: Array<{ key: string; name: string; mods: AdminModule[] }>;
  showBlockLabel: boolean; countByModule: Map<number, number>; cardsByTopic: Map<number, AdminFlashcard[]>;
}) {
  const [open, setOpen] = useState(false);
  const groupCount = groups.reduce((sum, g) => sum + g.mods.reduce((s, m) => s + (countByModule.get(m.id) ?? 0), 0), 0);
  return <div className="rounded-2xl border border-border bg-card">
    <button type="button" onClick={() => setOpen((v) => !v)} className="flex w-full items-center gap-2 px-5 py-3.5 text-left" data-testid={`button-flashcard-tree-year-${programLabel}-${yearLabel}`}>
      <ChevronRight size={16} className={cn('shrink-0 text-primary transition-transform', open && 'rotate-90')} />
      <GraduationCap size={15} className="shrink-0 text-primary" />
      <h3 className="flex-1 text-sm font-extrabold" data-testid={`text-flashcard-program-year-group-${programLabel}-${yearLabel}`}>{programLabel} <span className="font-normal text-muted-foreground">· {yearLabel}</span></h3>
      <span className="text-[11px] text-muted-foreground">{groupCount} card{groupCount === 1 ? '' : 's'}</span>
    </button>
    {open && <div className="space-y-5 border-t border-border p-4">
      {groups.map((g) => <div key={g.key} className="space-y-3">
        {showBlockLabel && <p className="text-[10px] font-extrabold uppercase tracking-wide text-muted-foreground" data-testid={`text-flashcard-block-group-${g.key}`}>{g.name}</p>}
        {g.mods.map((m) => <FlashcardTreeModule key={m.id} moduleId={m.id} name={m.name} cardCount={countByModule.get(m.id) ?? 0} cardsByTopic={cardsByTopic} />)}
      </div>)}
    </div>}
  </div>;
}

// Flashcard bank tree (module > subject > topic) — mirrors McqBankTree so
// flashcards get the same "not all crammed onto one screen" browsing and the
// same per-scope permanent delete as the MCQ bank.

export function FlashcardBankTree({ modules, blocks }: { modules: AdminModule[]; blocks: AdminBlock[] }) {
  const treeQ = useQuery({ queryKey: ['admin-flashcards-tree'], queryFn: () => flashcardsAdminApi.list() });
  const rows = treeQ.data ?? [];
  const cardsByTopic = new Map<number, AdminFlashcard[]>();
  const trulyUnassigned: AdminFlashcard[] = [];
  for (const row of rows) {
    if (row.topicId == null) { trulyUnassigned.push(row); continue; }
    const list = cardsByTopic.get(row.topicId);
    if (list) list.push(row); else cardsByTopic.set(row.topicId, [row]);
  }
  const countByModule = new Map<number, number>();
  for (const row of rows) if (row.moduleId != null) countByModule.set(row.moduleId, (countByModule.get(row.moduleId) ?? 0) + 1);
  if (treeQ.isLoading) return <SkeletonPage />;
  if (!modules.length && !trulyUnassigned.length) return <EmptyState icon={Zap} title="No modules yet" body="Create a module first under Academic content, then come back to browse its flashcards here." />;
  const modulesByBlock = new Map<number | 'other', AdminModule[]>();
  for (const m of modules) { const key = m.blockId ?? 'other'; const list = modulesByBlock.get(key); if (list) list.push(m); else modulesByBlock.set(key, [m]); }
  const blockLeaves = blocks.filter((b) => modulesByBlock.has(b.id)).map((b) => {
    const mods = modulesByBlock.get(b.id)!;
    const fallback = mods.find((m) => m.programTargetKind || m.yearTargetNumber);
    return { key: `block-${b.id}`, name: b.name, mods, program: b.programTargetKind || fallback?.programTargetKind || null, year: b.yearTargetNumber ?? fallback?.yearTargetNumber ?? null };
  });
  const standaloneLeaves = (modulesByBlock.get('other') ?? []).map((m) => ({ key: `module-${m.id}`, name: m.name, mods: [m], program: m.programTargetKind || null, year: m.yearTargetNumber ?? null }));
  const programYearGroups = groupByProgramYear([...blockLeaves, ...standaloneLeaves]);
  const showBlockLabel = blocks.length > 0 || standaloneLeaves.length > 0;
  return <div className="space-y-4">
    {programYearGroups.map(({ programLabel, yearLabel, groups }) => <FlashcardTreeYearGroup key={`${programLabel}-${yearLabel}`} programLabel={programLabel} yearLabel={yearLabel} groups={groups} showBlockLabel={showBlockLabel} countByModule={countByModule} cardsByTopic={cardsByTopic} />)}
    {!!trulyUnassigned.length && <div className="rounded-2xl border border-dashed border-border bg-card p-4"><p className="mb-3 text-xs font-bold text-muted-foreground">{trulyUnassigned.length} flashcard{trulyUnassigned.length === 1 ? '' : 's'} with no module/subject/topic</p><div className="space-y-2">{trulyUnassigned.map((c) => <FlashcardTreeRow key={c.id} card={c} />)}</div></div>}
  </div>;
}

// Full edit — every field the create form sets, pre-filled, so admins
// aren't stuck only being able to publish/archive after creation. Uses
// the same `update` mutation the parent already wires to a PATCH.

export function ExamEditForm({ exam, onSave, onCancel, saving }: { exam: AdminExam; onSave: (body: Partial<AdminExam>) => void; onCancel: () => void; saving: boolean }) {
  const toLocalInput = (iso: string) => { const d = new Date(iso); d.setMinutes(d.getMinutes() - d.getTimezoneOffset()); return d.toISOString().slice(0, 16); };
  return <form onSubmit={(e) => {
    e.preventDefault(); const f = new FormData(e.currentTarget);
    onSave({
      title: String(f.get('title')), description: String(f.get('description') || ''),
      programTargetKind: String(f.get('programTargetKind') || '') || null, yearTargetNumber: f.get('yearTargetNumber') ? Number(f.get('yearTargetNumber')) : null,
      durationMinutes: Number(f.get('durationMinutes') || 60), startAt: new Date(String(f.get('startAt'))).toISOString(), endAt: new Date(String(f.get('endAt'))).toISOString(),
      maxAttempts: Number(f.get('maxAttempts') || 1), negativeMarkingEnabled: f.get('negativeMarkingEnabled') === 'on', negativeMarkPerWrong: Number(f.get('negativeMarkPerWrong') || 0),
      passingPercent: f.get('passingPercent') ? Number(f.get('passingPercent')) : null, resultReleaseMode: f.get('resultReleaseMode') as Exam['resultReleaseMode'],
      showMarks: f.get('showMarks') === 'on', showPercentage: f.get('showPercentage') === 'on', showCorrectAnswers: f.get('showCorrectAnswers') === 'on',
    });
  }} className="mt-4 space-y-3 rounded-2xl border border-primary/30 bg-primary/10 p-5">
    <div className="grid gap-3 sm:grid-cols-2"><input required name="title" defaultValue={exam.title} placeholder="Exam title" className="h-10 rounded-xl border border-border bg-card px-3 text-xs" data-testid={`input-edit-exam-title-${exam.id}`} /><input name="description" defaultValue={exam.description} placeholder="Short description" className="h-10 rounded-xl border border-border bg-card px-3 text-xs" data-testid={`input-edit-exam-description-${exam.id}`} /></div>
    <div className="grid gap-3 sm:grid-cols-4"><select name="programTargetKind" defaultValue={exam.programTargetKind ?? ''} className="h-10 rounded-xl border border-border bg-card px-2 text-xs" data-testid={`select-edit-exam-program-${exam.id}`}><option value="">All Programs</option><option value="MBBS">MBBS</option><option value="BDS">BDS</option></select><select name="yearTargetNumber" defaultValue={exam.yearTargetNumber ?? ''} className="h-10 rounded-xl border border-border bg-card px-2 text-xs" data-testid={`select-edit-exam-year-${exam.id}`}><option value="">All Years</option>{[1, 2, 3, 4, 5].map((y) => <option key={y} value={y}>Year {y}</option>)}</select><input required type="number" name="durationMinutes" defaultValue={exam.durationMinutes} placeholder="Duration (min)" className="h-10 rounded-xl border border-border bg-card px-2 text-xs" data-testid={`input-edit-exam-duration-${exam.id}`} /><input required type="number" name="maxAttempts" defaultValue={exam.maxAttempts} min={1} placeholder="Max attempts" className="h-10 rounded-xl border border-border bg-card px-2 text-xs" data-testid={`input-edit-exam-attempts-${exam.id}`} /></div>
    <div className="grid gap-3 sm:grid-cols-2"><label className="text-[11px] font-bold">Opens<input required type="datetime-local" name="startAt" defaultValue={toLocalInput(exam.startAt)} className="mt-1 h-10 w-full rounded-xl border border-border bg-card px-2 text-xs" data-testid={`input-edit-exam-start-${exam.id}`} /></label><label className="text-[11px] font-bold">Closes<input required type="datetime-local" name="endAt" defaultValue={toLocalInput(exam.endAt)} className="mt-1 h-10 w-full rounded-xl border border-border bg-card px-2 text-xs" data-testid={`input-edit-exam-end-${exam.id}`} /></label></div>
    <div className="grid gap-3 sm:grid-cols-3"><label className="text-[11px] font-bold">Passing %<input type="number" name="passingPercent" defaultValue={exam.passingPercent ?? ''} min={0} max={100} placeholder="e.g. 50" className="mt-1 h-10 w-full rounded-xl border border-border bg-card px-2 text-xs" data-testid={`input-edit-exam-passing-${exam.id}`} /></label><label className="text-[11px] font-bold">Result release<select name="resultReleaseMode" defaultValue={exam.resultReleaseMode} className="mt-1 h-10 w-full rounded-xl border border-border bg-card px-2 text-xs" data-testid={`select-edit-exam-release-${exam.id}`}><option value="immediate">Immediately after submit</option><option value="after_end">When exam window closes</option><option value="manual">Manually by admin</option></select></label><label className="text-[11px] font-bold">Negative mark / wrong<input type="number" step="0.25" name="negativeMarkPerWrong" defaultValue={exam.negativeMarkPerWrong} className="mt-1 h-10 w-full rounded-xl border border-border bg-card px-2 text-xs" data-testid={`input-edit-exam-negative-${exam.id}`} /></label></div>
    <div className="flex flex-wrap gap-4 text-xs font-bold"><label className="flex items-center gap-1.5"><input type="checkbox" name="negativeMarkingEnabled" defaultChecked={exam.negativeMarkingEnabled} className="size-4 accent-primary" data-testid={`checkbox-edit-negative-marking-${exam.id}`} /> Enable negative marking</label><label className="flex items-center gap-1.5"><input type="checkbox" name="showMarks" defaultChecked={exam.showMarks} className="size-4 accent-primary" data-testid={`checkbox-edit-show-marks-${exam.id}`} /> Show marks</label><label className="flex items-center gap-1.5"><input type="checkbox" name="showPercentage" defaultChecked={exam.showPercentage} className="size-4 accent-primary" data-testid={`checkbox-edit-show-percentage-${exam.id}`} /> Show percentage</label><label className="flex items-center gap-1.5"><input type="checkbox" name="showCorrectAnswers" defaultChecked={exam.showCorrectAnswers} className="size-4 accent-primary" data-testid={`checkbox-edit-show-answers-${exam.id}`} /> Show correct answers after release</label></div>
    <div className="flex gap-2"><button disabled={saving} className="rounded-xl bg-primary px-4 py-2 text-xs font-bold text-primary-foreground disabled:opacity-50" data-testid={`button-save-edit-exam-${exam.id}`}>{saving ? 'Saving…' : 'Save changes'}</button><button type="button" onClick={onCancel} className="rounded-xl border border-border px-4 py-2 text-xs font-bold" data-testid={`button-cancel-edit-exam-${exam.id}`}>Cancel</button></div>
  </form>;
}

// ---------------------------------------------------------------------------
// Paper maker — auto-builds a Pre-Proffs exam's paper straight from the
// existing curriculum MCQ bank instead of pasting IDs or uploading a file.
// Admin picks MBBS/BDS + Year (defaults to whatever the exam itself is
// targeted at), then drills Block > Module > Subject > Topic — same tree
// shape as McqBankTree — and sets how many MCQs to pull from each Subject
// (optionally narrowed to specific Topics within it). "Generate paper"
// randomly samples that many PUBLISHED, bank-owned questions per subject
// (never touching MCQs already tied to another exam or past paper) and
// hands the resulting id list to the same setQuestions endpoint the manual
// "Set paper" flow already uses — no new backend route needed.
// ---------------------------------------------------------------------------

export type PaperMakerSelection = { count: number; topicIds: number[] | null; topicCounts?: Record<number, number> };

function paperMakerModuleMatches(m: AdminModule, program: string, year: string): boolean {
  const programOk = !program || !m.programTargetKind || m.programTargetKind === program;
  const yearOk = !year || !m.yearTargetNumber || m.yearTargetNumber === Number(year);
  return programOk && yearOk;
}

// Per-topic counts (added alongside the original subject-total + topic
// filter above): lets an admin type an exact MCQ count for an individual
// Topic instead of just narrowing which topics the subject total draws
// from. Whenever any topic has a count > 0 set, generate() draws exactly
// that many from each such topic and ignores the subject's own count
// field/topicIds filter entirely for that subject — see PaperMakerPanel's
// generate() and PaperMakerSubjectRow below.
export function PaperMakerTopicPicker({ subjectId, rows, selection, onChange, onSetTopicCount }: { subjectId: number; rows: AdminMcqRow[]; selection: PaperMakerSelection | undefined; onChange: (topicIds: number[] | null) => void; onSetTopicCount: (topicId: number, count: number) => void }) {
  const topicsQ = useQuery({ queryKey: ['admin-topics', subjectId], queryFn: () => topicAdminApi.list(subjectId) });
  const topics = topicsQ.data ?? [];
  const activeIds = selection?.topicIds ?? null;
  const topicCounts = selection?.topicCounts ?? {};
  const availableByTopic = new Map<number, number>();
  for (const r of rows) { if (r.topicId !== null) availableByTopic.set(r.topicId, (availableByTopic.get(r.topicId) ?? 0) + 1); }
  if (topicsQ.isLoading) return <InlineLoading label="Loading topics…" />;
  if (!topics.length) return <p className="text-[11px] text-muted-foreground">No topics in this subject yet — the count above pulls from the whole subject.</p>;
  return <div className="space-y-2">
    <div className="flex flex-wrap gap-2">
      <button type="button" onClick={() => onChange(null)} className={cn('rounded-full px-2.5 py-1 text-[10px] font-bold', activeIds === null ? 'bg-primary text-primary-foreground' : 'border border-border')} data-testid={`button-papermaker-topics-all-${subjectId}`}>All topics</button>
    </div>
    <div className="flex flex-wrap gap-1.5">{topics.map((t) => { const checked = activeIds === null || activeIds.includes(t.id); return <label key={t.id} className={cn('flex items-center gap-1.5 rounded-full border px-2.5 py-1 text-[10px] font-bold', checked ? 'border-primary/40 bg-primary/10 text-primary' : 'border-border text-muted-foreground')}><input type="checkbox" className="size-3" checked={checked} onChange={(e) => {
      const base = activeIds === null ? topics.map((tt) => tt.id) : activeIds;
      const next = e.target.checked ? [...new Set([...base, t.id])] : base.filter((id) => id !== t.id);
      // Re-selecting every topic collapses back to "All topics" (null) so a
      // freshly created topic is picked up automatically next time, instead
      // of being silently excluded by a stale explicit id list.
      onChange(next.length === topics.length ? null : next);
    }} data-testid={`checkbox-papermaker-topic-${t.id}`} />{t.name} <span className="font-normal opacity-70">({t.questionCount})</span></label>; })}</div>
    <div className="space-y-1 border-t border-border pt-2">
      <p className="text-[10px] font-bold text-muted-foreground">Or set an exact MCQ count per topic (overrides the subject total above for this subject):</p>
      {topics.map((t) => { const avail = availableByTopic.get(t.id) ?? 0; return <div key={t.id} className="flex items-center justify-between gap-2 text-[11px]">
        <span className="min-w-0 flex-1 truncate">{t.name} <span className="font-normal opacity-70">({avail} available)</span></span>
        <input type="number" min={0} max={avail} value={topicCounts[t.id] || ''} onChange={(e) => onSetTopicCount(t.id, Math.max(0, Math.min(Number(e.target.value) || 0, avail)))} placeholder="0" className="h-8 w-16 shrink-0 rounded-lg border border-border bg-card px-2 text-xs font-bold" disabled={!avail} data-testid={`input-papermaker-topic-count-${t.id}`} />
      </div>; })}
    </div>
  </div>;
}

export function PaperMakerSubjectRow({ subject, rows, selection, onSetCount, onSetTopicIds, onSetTopicCount }: { subject: AdminSubject; rows: AdminMcqRow[]; selection: PaperMakerSelection | undefined; onSetCount: (count: number) => void; onSetTopicIds: (topicIds: number[] | null) => void; onSetTopicCount: (topicId: number, count: number) => void }) {
  const [topicsOpen, setTopicsOpen] = useState(false);
  const topicIds = selection?.topicIds ?? null;
  const topicCounts = selection?.topicCounts ?? {};
  const perTopicTotal = Object.values(topicCounts).reduce((sum, n) => sum + (n || 0), 0);
  const usingPerTopic = perTopicTotal > 0;
  const available = topicIds ? rows.filter((r) => r.topicId !== null && topicIds.includes(r.topicId)).length : rows.length;
  const count = usingPerTopic ? perTopicTotal : (selection?.count ?? 0);
  return <div className="rounded-xl border border-border bg-background p-3" data-testid={`row-papermaker-subject-${subject.id}`}>
    <div className="flex flex-wrap items-center justify-between gap-2">
      <div className="min-w-0 flex-1"><p className="truncate text-xs font-bold">{subject.name}</p><p className="text-[10px] text-muted-foreground">{available} published MCQ{available === 1 ? '' : 's'} available{topicIds ? ' (selected topics)' : ''}</p></div>
      <button type="button" onClick={() => setTopicsOpen((v) => !v)} className="rounded-lg border border-border px-2 py-1 text-[10px] font-bold text-muted-foreground" data-testid={`button-papermaker-toggle-topics-${subject.id}`}>{topicsOpen ? 'Hide topics' : 'Topics'}</button>
      <input type="number" min={0} max={available} value={count || ''} onChange={(e) => onSetCount(Math.max(0, Math.min(Number(e.target.value) || 0, available)))} placeholder="0" className="h-9 w-20 rounded-lg border border-border bg-card px-2 text-xs font-bold disabled:opacity-50" data-testid={`input-papermaker-count-${subject.id}`} disabled={!available || usingPerTopic} title={usingPerTopic ? 'Clear the per-topic counts below to set a single subject total instead' : undefined} />
    </div>
    {usingPerTopic && <p className="mt-1 text-[10px] font-bold text-primary">Using per-topic counts ({perTopicTotal} total) — open Topics to adjust.</p>}
    {topicsOpen && <div className="mt-2 border-t border-border pt-2"><PaperMakerTopicPicker subjectId={subject.id} rows={rows} selection={selection} onChange={onSetTopicIds} onSetTopicCount={onSetTopicCount} /></div>}
  </div>;
}

export function PaperMakerModuleGroup({ mod, rowsBySubject, selections, onSetCount, onSetTopicIds, onSetTopicCount }: { mod: AdminModule; rowsBySubject: Map<number, AdminMcqRow[]>; selections: Record<number, PaperMakerSelection>; onSetCount: (subjectId: number, count: number) => void; onSetTopicIds: (subjectId: number, topicIds: number[] | null) => void; onSetTopicCount: (subjectId: number, topicId: number, count: number) => void }) {
  const [open, setOpen] = useState(false);
  const subjectsQ = useQuery({ queryKey: ['admin-subjects', mod.id], queryFn: () => subjectAdminApi.list(mod.id), enabled: open });
  const subjects = (subjectsQ.data ?? []).filter((s) => (rowsBySubject.get(s.id)?.length ?? 0) > 0);
  const moduleAvailable = subjects.reduce((sum, s) => sum + (rowsBySubject.get(s.id)?.length ?? 0), 0);
  return <div className="rounded-2xl border border-border bg-card">
    <button type="button" onClick={() => setOpen((v) => !v)} className="flex w-full items-center gap-2 px-4 py-3 text-left" data-testid={`button-papermaker-module-${mod.id}`}>
      <ChevronRight size={14} className={cn('shrink-0 text-primary transition-transform', open && 'rotate-90')} />
      <span className="flex-1 text-xs font-extrabold">{mod.name}</span>
      <span className="text-[10px] text-muted-foreground">{moduleAvailable} question{moduleAvailable === 1 ? '' : 's'}</span>
    </button>
    {open && <div className="space-y-2 border-t border-border p-3">
      {subjectsQ.isLoading && <InlineLoading label="Loading subjects…" />}
      {!subjectsQ.isLoading && !subjects.length && <p className="text-[11px] text-muted-foreground">No published bank questions under this module yet.</p>}
      {subjects.map((s) => <PaperMakerSubjectRow key={s.id} subject={s} rows={rowsBySubject.get(s.id) ?? []} selection={selections[s.id]} onSetCount={(count) => onSetCount(s.id, count)} onSetTopicIds={(topicIds) => onSetTopicIds(s.id, topicIds)} onSetTopicCount={(topicId, count) => onSetTopicCount(s.id, topicId, count)} />)}
    </div>}
  </div>;
}

export function PaperMakerPanel({ exam }: { exam: AdminExam }) {
  const [open, setOpen] = useState(false);
  const [program, setProgram] = useState(exam.programTargetKind ?? '');
  const [year, setYear] = useState(exam.yearTargetNumber ? String(exam.yearTargetNumber) : '');
  const [selections, setSelections] = useState<Record<number, PaperMakerSelection>>({});
  const [replaceExisting, setReplaceExisting] = useState(true);

  const blocksQ = useQuery({ queryKey: ['admin-blocks'], queryFn: blockAdminApi.listAll, enabled: open });
  const modulesQ = useQuery({ queryKey: ['admin-modules'], queryFn: moduleAdminApi.listAll, enabled: open });
  const mcqsTreeQ = useQuery({ queryKey: ['admin-mcqs-tree'], queryFn: mcqAdminApi.list, enabled: open });
  const existingQuestionsQ = useQuery({ queryKey: ['exam-questions', exam.id], queryFn: () => examsAdminApi.getQuestions(exam.id) });

  const blocks = blocksQ.data ?? [];
  const modules = (modulesQ.data ?? []).filter((m) => paperMakerModuleMatches(m, program, year));
  const eligibleModuleIds = new Set(modules.map((m) => m.id));
  const allRows = mcqsTreeQ.data ?? [];
  // Only PUBLISHED, bank-owned questions (no examId/pastPaperId) are fair
  // game — same "belongs to the general curriculum bank, not someone
  // else's exam/past paper" rule McqBankTree uses, plus excluding drafts
  // so a generated paper never hands students an unfinished question.
  const eligibleRows = allRows.filter((r) => r.status === 'published' && r.examId === null && r.pastPaperId === null && r.moduleId !== null && r.subjectId !== null && eligibleModuleIds.has(r.moduleId));
  const rowsBySubject = new Map<number, AdminMcqRow[]>();
  for (const r of eligibleRows) { const list = rowsBySubject.get(r.subjectId!); if (list) list.push(r); else rowsBySubject.set(r.subjectId!, [r]); }

  const modulesByBlock = new Map<number | 'other', AdminModule[]>();
  for (const m of modules) { const key = m.blockId ?? 'other'; const list = modulesByBlock.get(key); if (list) list.push(m); else modulesByBlock.set(key, [m]); }
  const blocksWithModules = blocks.filter((b) => modulesByBlock.has(b.id));
  const standaloneModules = modulesByBlock.get('other') ?? [];

  // Effective count for a subject: its per-topic counts if any are set,
  // otherwise the subject's own total field — same rule generate() uses.
  const effectiveSubjectCount = (s: PaperMakerSelection) => {
    const perTopicTotal = Object.values(s.topicCounts ?? {}).reduce((sum, n) => sum + (n || 0), 0);
    return perTopicTotal > 0 ? perTopicTotal : (s.count || 0);
  };
  const totalRequested = Object.values(selections).reduce((sum, s) => sum + effectiveSubjectCount(s), 0);
  const subjectsPicked = Object.values(selections).filter((s) => effectiveSubjectCount(s) > 0).length;

  const setQuestions = useMutation({
    mutationFn: (mcqIds: number[]) => examsAdminApi.setQuestions(exam.id, mcqIds),
    onSuccess: (_res, mcqIds) => {
      queryClient.invalidateQueries({ queryKey: ['admin-exams'] });
      queryClient.invalidateQueries({ queryKey: ['exam-questions', exam.id] });
      toast({ title: `Generated a ${mcqIds.length}-question paper` });
      setSelections({});
    },
    onError: (err: unknown) => toast({ title: 'Could not generate paper', description: err instanceof ApiRequestError ? err.message : 'Something went wrong.', variant: 'destructive' }),
  });

  const generate = () => {
    const picked: number[] = [];
    for (const [subjectIdStr, sel] of Object.entries(selections)) {
      const pool = rowsBySubject.get(Number(subjectIdStr)) ?? [];
      const topicCounts = sel.topicCounts ?? {};
      const perTopicEntries = Object.entries(topicCounts).filter(([, c]) => c > 0);
      if (perTopicEntries.length) {
        // Per-topic mode: sample each topic's exact count independently
        // instead of one random draw across the whole subject, so e.g.
        // "5 from Cardiology, 3 from Renal" can't accidentally come back
        // as 8 from Cardiology alone.
        for (const [topicIdStr, topicCount] of perTopicEntries) {
          const topicPool = pool.filter((r) => r.topicId === Number(topicIdStr));
          const shuffled = [...topicPool].sort(() => Math.random() - 0.5);
          picked.push(...shuffled.slice(0, topicCount).map((r) => r.id));
        }
        continue;
      }
      if (!sel.count) continue;
      let filteredPool = pool;
      if (sel.topicIds) filteredPool = filteredPool.filter((r) => r.topicId !== null && sel.topicIds!.includes(r.topicId));
      // Fisher-Yates-ish shuffle (sort-by-random is fine at this scale —
      // subject pools are, at most, a few hundred questions) so each
      // generated paper draws a fresh random subset per subject.
      const shuffled = [...filteredPool].sort(() => Math.random() - 0.5);
      picked.push(...shuffled.slice(0, sel.count).map((r) => r.id));
    }
    if (!picked.length) { toast({ title: 'Set an MCQ count for at least one subject or topic first', variant: 'destructive' }); return; }
    const finalIds = replaceExisting ? picked : [...new Set([...(existingQuestionsQ.data ?? []).map((q) => q.id), ...picked])];
    setQuestions.mutate(finalIds);
  };

  return <div className="rounded-2xl border border-primary/30 bg-primary/10 p-4">
    <button type="button" onClick={() => setOpen((v) => !v)} className="flex w-full items-center gap-2 text-left" data-testid={`button-toggle-papermaker-${exam.id}`}>
      <Wand2 size={15} className="shrink-0 text-primary" />
      <span className="flex-1 text-xs font-extrabold">Paper maker — build this paper from the MCQ bank</span>
      <ChevronRight size={16} className={cn('shrink-0 text-primary transition-transform', open && 'rotate-90')} />
    </button>
    {!open && <p className="mt-1 text-[11px] text-muted-foreground">Pick a year + MBBS/BDS, choose how many MCQs to pull per subject (or set an exact count per topic), and generate the paper automatically from the existing bank.</p>}
    {open && <div className="mt-3 space-y-3">
      <div className="grid gap-2 sm:grid-cols-2">
        <label className="text-[11px] font-bold">Program<select value={program} onChange={(e) => setProgram(e.target.value)} className="mt-1 h-9 w-full rounded-lg border border-border bg-card px-2 text-xs" data-testid={`select-papermaker-program-${exam.id}`}><option value="">All Programs</option><option value="MBBS">MBBS</option><option value="BDS">BDS</option></select></label>
        <label className="text-[11px] font-bold">Year<select value={year} onChange={(e) => setYear(e.target.value)} className="mt-1 h-9 w-full rounded-lg border border-border bg-card px-2 text-xs" data-testid={`select-papermaker-year-${exam.id}`}><option value="">All Years</option>{[1, 2, 3, 4, 5].map((y) => <option key={y} value={y}>Year {y}</option>)}</select></label>
      </div>
      <p className="text-[11px] text-muted-foreground">Defaults to this exam's own targeting — change it to pull from a different year/program's bank if needed.</p>

      {(mcqsTreeQ.isLoading || modulesQ.isLoading) ? <InlineLoading label="Loading the MCQ bank…" /> : <div className="space-y-2">
        {!blocksWithModules.length && !standaloneModules.length && <p className="text-[11px] text-muted-foreground">No modules match that Program/Year yet.</p>}
        {blocksWithModules.map((b) => <div key={b.id} className="space-y-2">
          <p className="text-[10px] font-extrabold uppercase tracking-wide text-muted-foreground">{b.name}</p>
          {(modulesByBlock.get(b.id) ?? []).map((m) => <PaperMakerModuleGroup key={m.id} mod={m} rowsBySubject={rowsBySubject} selections={selections} onSetCount={(subjectId, count) => setSelections((prev) => ({ ...prev, [subjectId]: { topicIds: prev[subjectId]?.topicIds ?? null, topicCounts: prev[subjectId]?.topicCounts, count } }))} onSetTopicIds={(subjectId, topicIds) => setSelections((prev) => ({ ...prev, [subjectId]: { count: prev[subjectId]?.count ?? 0, topicCounts: prev[subjectId]?.topicCounts, topicIds } }))} onSetTopicCount={(subjectId, topicId, count) => setSelections((prev) => ({ ...prev, [subjectId]: { count: prev[subjectId]?.count ?? 0, topicIds: prev[subjectId]?.topicIds ?? null, topicCounts: { ...(prev[subjectId]?.topicCounts ?? {}), [topicId]: count } } }))} />)}
        </div>)}
        {standaloneModules.map((m) => <PaperMakerModuleGroup key={m.id} mod={m} rowsBySubject={rowsBySubject} selections={selections} onSetCount={(subjectId, count) => setSelections((prev) => ({ ...prev, [subjectId]: { topicIds: prev[subjectId]?.topicIds ?? null, topicCounts: prev[subjectId]?.topicCounts, count } }))} onSetTopicIds={(subjectId, topicIds) => setSelections((prev) => ({ ...prev, [subjectId]: { count: prev[subjectId]?.count ?? 0, topicCounts: prev[subjectId]?.topicCounts, topicIds } }))} onSetTopicCount={(subjectId, topicId, count) => setSelections((prev) => ({ ...prev, [subjectId]: { count: prev[subjectId]?.count ?? 0, topicIds: prev[subjectId]?.topicIds ?? null, topicCounts: { ...(prev[subjectId]?.topicCounts ?? {}), [topicId]: count } } }))} />)}
      </div>}

      <div className="flex flex-wrap items-center justify-between gap-2 rounded-xl border border-primary/30 bg-card px-3 py-2.5">
        <div className="text-xs font-bold" data-testid={`text-papermaker-total-${exam.id}`}>Total: {totalRequested} MCQ{totalRequested === 1 ? '' : 's'} across {subjectsPicked} subject{subjectsPicked === 1 ? '' : 's'}</div>
        <label className="flex items-center gap-1.5 text-[11px] font-bold"><input type="checkbox" checked={replaceExisting} onChange={(e) => setReplaceExisting(e.target.checked)} data-testid={`checkbox-papermaker-replace-${exam.id}`} /> Replace this exam's current paper</label>
      </div>
      <button disabled={!totalRequested || setQuestions.isPending} onClick={generate} className="w-full rounded-xl bg-primary px-4 py-2.5 text-xs font-extrabold text-primary-foreground disabled:opacity-50" data-testid={`button-papermaker-generate-${exam.id}`}>{setQuestions.isPending ? 'Generating…' : `Generate paper (${totalRequested} MCQs)`}</button>
    </div>}
  </div>;
}

export function ExamManagePanel({ exam, autoOpenUpload }: { exam: AdminExam; autoOpenUpload?: boolean }) {
  const [mcqIdsInput, setMcqIdsInput] = useState('');
  const setQuestions = useMutation({ mutationFn: (mcqIds: number[]) => examsAdminApi.setQuestions(exam.id, mcqIds), onSuccess: () => queryClient.invalidateQueries({ queryKey: ['admin-exams'] }) });
  const attemptsQ = useQuery({ queryKey: ['exam-attempts', exam.id], queryFn: () => examsAdminApi.attempts(exam.id) });
  const existingQuestionsQ = useQuery({ queryKey: ['exam-questions', exam.id], queryFn: () => examsAdminApi.getQuestions(exam.id) });

  // Bulk upload — same file parser as the MCQ bank (txt/csv/xlsx/pdf/docx,
  // per-option explanations included). Parsed questions attach directly to
  // this exam (examId) and land in their own exam-questions bank — no
  // module/subject/topic needed, same as past-paper imports.
  const [uploadOpen, setUploadOpen] = useState(!!autoOpenUpload);
  const [file, setFile] = useState<File | null>(null);
  const [parsing, setParsing] = useState(false);
  const [parseError, setParseError] = useState<string | null>(null);
  const [candidates, setCandidates] = useState<McqCandidate[]>([]);
  const [replaceExisting, setReplaceExisting] = useState(false);

  const parseFile = async () => {
    if (!file) return;
    setParsing(true); setParseError(null);
    try {
      const res = await mcqImportApi.parse(file);
      setCandidates(res.candidates);
    } catch (err) {
      setParseError(err instanceof ApiRequestError ? err.message : 'Could not read this file.');
    } finally {
      setParsing(false);
    }
  };
  const updateCandidate = (i: number, patch: Partial<McqCandidate>) => setCandidates((prev) => prev.map((c, ci) => (ci === i ? { ...c, ...patch } : c)));
  const removeCandidate = (i: number) => setCandidates((prev) => prev.filter((_, ci) => ci !== i));

  const commitToExam = useMutation({
    mutationFn: async () => {
      // examId places these directly in the exam-questions bank and
      // auto-attaches them to this exam's paper server-side.
      const { ids } = await mcqImportApi.commit({ examId: exam.id, status: 'published', mcqs: candidates });
      if (replaceExisting) {
        const existingIds = (existingQuestionsQ.data ?? []).map((q) => q.id).filter((id) => !ids.includes(id));
        // Explicit "replace" still means only these new questions remain
        // attached — drop anything that isn't one of the freshly imported ids.
        await examsAdminApi.setQuestions(exam.id, ids);
        void existingIds; // old attachment already superseded by the commit route's auto-link + this setQuestions call
      }
      return ids.length;
    },
    onSuccess: (count) => {
      queryClient.invalidateQueries({ queryKey: ['admin-exams'] });
      queryClient.invalidateQueries({ queryKey: ['exam-questions', exam.id] });
      queryClient.invalidateQueries({ queryKey: ['admin-mcqs-tree'] });
      setCandidates([]); setFile(null); setUploadOpen(false);
      toast({ title: `Added ${count} question${count === 1 ? '' : 's'} to this exam` });
    },
    onError: (err: unknown) => toast({ title: 'Could not add questions to this exam', description: err instanceof ApiRequestError ? err.message : 'Something went wrong.', variant: 'destructive' }),
  });

  return <div className="mt-4 space-y-4 border-t border-border pt-4">
    <PaperMakerPanel exam={exam} />
    <div>
      <div className="flex items-center justify-between"><div className="text-xs font-bold">Attach questions</div><button onClick={() => setUploadOpen((v) => !v)} className="inline-flex items-center gap-1.5 rounded-lg border border-border bg-card px-2.5 py-1.5 text-[11px] font-bold" data-testid={`button-toggle-exam-upload-${exam.id}`}><UploadCloud size={12} /> {uploadOpen ? 'Hide' : 'Upload a file'}</button></div>
      <p className="mt-1 text-[11px] text-muted-foreground">Paste MCQ IDs from the MCQ bank (comma-separated) to build this exam's paper, or upload a question file below.</p>
      <div className="mt-2 flex gap-2"><input value={mcqIdsInput} onChange={(e) => setMcqIdsInput(e.target.value)} placeholder="e.g. 12, 13, 14, 20" className="h-9 flex-1 rounded-lg border border-border bg-background px-2 text-xs" data-testid={`input-exam-mcq-ids-${exam.id}`} /><button onClick={() => { const ids = mcqIdsInput.split(',').map((s) => Number(s.trim())).filter((n) => !Number.isNaN(n)); if (ids.length) setQuestions.mutate(ids); }} disabled={setQuestions.isPending} className="rounded-lg bg-primary px-4 text-xs font-bold text-primary-foreground disabled:opacity-50" data-testid={`button-set-exam-questions-${exam.id}`}>Set paper ({exam.questionCount} currently)</button></div>

      {uploadOpen && <div className="mt-3 space-y-3 rounded-2xl border border-primary/30 bg-primary/10 p-4">
        <p className="text-[11px] font-bold">Upload a question file — supports .txt, .csv, .xlsx, .xls, .pdf, .docx, and picks up per-option explanations if the file has them.</p>
        <p className="text-[11px] font-semibold text-muted-foreground">Imported questions attach straight to this exam and live in their own exam-questions bank — no module/subject/topic needed.</p>
        <div className="flex flex-wrap items-center gap-2"><input type="file" accept=".txt,.csv,.xlsx,.xls,.pdf,.docx" onChange={(e) => setFile(e.target.files?.[0] ?? null)} className="flex-1 rounded-lg border border-dashed border-border bg-card px-3 py-2 text-xs" data-testid={`input-exam-file-${exam.id}`} /><button disabled={!file || parsing} onClick={parseFile} className="rounded-lg bg-primary px-4 py-2 text-xs font-bold text-primary-foreground disabled:opacity-50" data-testid={`button-parse-exam-file-${exam.id}`}>{parsing ? 'Reading…' : 'Parse file'}</button></div>
        {parseError && <p className="text-[11px] font-semibold text-destructive">{parseError}</p>}

        {candidates.length > 0 && <div className="space-y-3">
          <div className="flex flex-wrap items-center justify-between gap-2">
            <div className="text-[11px] font-bold">{candidates.length} questions found · {candidates.filter((c) => c.needsReview).length} need review</div>
            <label className="flex items-center gap-1.5 text-[11px] font-bold"><input type="checkbox" checked={replaceExisting} onChange={(e) => setReplaceExisting(e.target.checked)} data-testid={`checkbox-exam-replace-${exam.id}`} /> Replace this exam's current paper instead of adding to it</label>
          </div>
          <div className="max-h-80 space-y-2 overflow-y-auto pr-1">{candidates.map((c, i) => <div key={i} className={cn('rounded-xl border bg-card p-3', c.needsReview ? 'border-accent' : 'border-border')} data-testid={`card-exam-candidate-${i}`}>
            <div className="flex items-center justify-between"><span className={cn('rounded-full px-2 py-0.5 text-[10px] font-bold', c.needsReview ? 'bg-accent/20 text-accent-text' : 'bg-primary/15 text-primary')}>{c.needsReview ? 'Needs review' : 'Looks good'}</span><button onClick={() => removeCandidate(i)} className="text-[11px] font-bold text-destructive" data-testid={`button-remove-exam-candidate-${i}`}>Remove</button></div>
            <textarea value={c.question} onChange={(e) => updateCandidate(i, { question: e.target.value })} className="mt-2 min-h-12 w-full rounded-lg border border-border bg-background p-2 text-xs" data-testid={`input-exam-candidate-question-${i}`} />
            <SuggestedPathHint path={c.suggestedPath} />
            <div className="mt-2 grid gap-2 sm:grid-cols-2">{[0, 1, 2, 3, 4].map((oi) => <input key={oi} value={c.options[oi] || ''} onChange={(e) => { const opts = [...c.options]; opts[oi] = e.target.value; updateCandidate(i, { options: opts }); }} placeholder={`Option ${String.fromCharCode(65 + oi)}${oi === 4 ? ' (optional)' : ''}`} className="h-8 rounded-lg border border-border bg-background px-2 text-xs" data-testid={`input-exam-candidate-option-${i}-${oi}`} />)}</div>
            <div className="mt-2 flex items-center gap-2"><span className="text-[11px] font-bold text-muted-foreground">Correct:</span><select value={c.correctAnswer ?? ''} onChange={(e) => updateCandidate(i, { correctAnswer: e.target.value || null })} className="h-8 flex-1 rounded-lg border border-border bg-background px-2 text-xs" data-testid={`select-exam-candidate-answer-${i}`}><option value="">Not set</option>{c.options.map((opt, oi) => opt && <option key={oi} value={opt}>{String.fromCharCode(65 + oi)}. {opt.slice(0, 40)}</option>)}</select></div>
            <div className="mt-2 flex items-center gap-2"><span className="text-[11px] font-bold text-muted-foreground">Difficulty:</span><DifficultyPicker value={c.difficulty} onChange={(v) => updateCandidate(i, { difficulty: v })} testId={`button-exam-candidate-difficulty-${i}`} /></div>
            <div className="mt-2 grid gap-2 sm:grid-cols-2">
              <input value={c.hint ?? ''} onChange={(e) => updateCandidate(i, { hint: e.target.value || null })} placeholder="Hint (optional — shown while attempting)" className="h-8 w-full rounded-lg border border-border bg-background px-2 text-xs" data-testid={`input-exam-candidate-hint-${i}`} />
              <input value={c.reference ?? ''} onChange={(e) => updateCandidate(i, { reference: e.target.value || null })} placeholder="Reference (optional)" className="h-8 w-full rounded-lg border border-border bg-background px-2 text-xs" data-testid={`input-exam-candidate-reference-${i}`} />
            </div>
            {c.options.some((o) => o.trim()) && <details className="mt-2" open={!!c.optionExplanations?.some((e) => e?.trim())}>
              <summary className="cursor-pointer text-[11px] font-bold text-primary">Per-option explanations</summary>
              <div className="mt-2 space-y-1.5">{c.options.map((opt, oi) => opt.trim() && <div key={oi} className="flex items-start gap-2"><span className={cn('mt-1.5 grid size-5 shrink-0 place-items-center rounded text-[10px] font-bold', c.correctAnswer === opt ? 'bg-primary/15 text-primary' : 'bg-destructive/10 text-destructive')}>{String.fromCharCode(65 + oi)}</span><textarea value={c.optionExplanations?.[oi] ?? ''} onChange={(e) => { const next = [...(c.optionExplanations ?? c.options.map(() => null))]; next[oi] = e.target.value || null; updateCandidate(i, { optionExplanations: next }); }} placeholder={c.correctAnswer === opt ? 'Why this is correct...' : 'Why this is wrong...'} className="min-h-8 flex-1 rounded-lg border border-border bg-background p-2 text-xs" data-testid={`input-exam-candidate-option-explanation-${i}-${oi}`} /></div>)}</div>
            </details>}
          </div>)}</div>
          <button disabled={commitToExam.isPending} onClick={() => commitToExam.mutate()} className="rounded-xl bg-primary px-5 py-2.5 text-xs font-extrabold text-primary-foreground disabled:opacity-50" data-testid={`button-commit-exam-candidates-${exam.id}`}>{commitToExam.isPending ? 'Adding…' : replaceExisting ? `Replace paper with these ${candidates.length} questions` : `Add these ${candidates.length} questions to the exam`}</button>
        </div>}
      </div>}
    </div>
    <div>
      <div className="flex items-center justify-between"><div className="text-xs font-bold">This exam's questions ({existingQuestionsQ.data?.length ?? 0})</div></div>
      <p className="mt-1 text-[11px] text-muted-foreground">The exam's actual paper — whether attached by upload, pasted ID, or set-questions above. Removing one here takes it off this exam's paper only; it stays in whichever bank it came from.</p>
      <div className="mt-2 max-h-72 space-y-1.5 overflow-y-auto pr-1">
        {(existingQuestionsQ.data ?? []).map((q) => <div key={q.id} className="flex items-start justify-between gap-2 rounded-lg bg-muted px-2.5 py-1.5 text-xs" data-testid={`row-exam-question-${q.id}`}>
          <span className="line-clamp-2">{q.question}</span>
          <button onClick={() => setQuestions.mutate((existingQuestionsQ.data ?? []).filter((x) => x.id !== q.id).map((x) => x.id))} disabled={setQuestions.isPending} className="shrink-0 text-[11px] font-bold text-destructive" data-testid={`button-remove-exam-question-${q.id}`}>Remove</button>
        </div>)}
        {existingQuestionsQ.isLoading && <InlineLoading />}
        {!existingQuestionsQ.isLoading && !existingQuestionsQ.data?.length && <p className="text-[11px] text-muted-foreground">No questions attached yet — upload a file or paste IDs above.</p>}
      </div>
    </div>
    <div><div className="text-xs font-bold">Attempts &amp; results</div><div className="mt-2 overflow-x-auto rounded-xl border border-border"><table className="w-full min-w-[620px] text-left text-[11px]"><thead className="bg-muted uppercase tracking-wide text-muted-foreground"><tr><th className="px-3 py-2">Student</th><th className="px-3 py-2">Institution</th><th className="px-3 py-2">Score</th><th className="px-3 py-2">%</th><th className="px-3 py-2">Status</th><th className="px-3 py-2"></th></tr></thead><tbody>{(attemptsQ.data || []).map((a) => <tr key={a.id} className="border-t border-border" data-testid={`row-exam-attempt-${a.id}`}><td className="px-3 py-2 font-bold">{a.studentName}</td><td className="px-3 py-2 text-muted-foreground">{a.institution}</td><td className="px-3 py-2">{a.score}</td><td className="px-3 py-2">{a.percentage}%</td><td className="px-3 py-2">{a.status}</td><td className="px-3 py-2">{a.status !== 'in_progress' && !a.resultsReleasedAt && <button onClick={() => examsAdminApi.releaseOne(a.id)} className="text-primary font-bold" data-testid={`button-release-attempt-${a.id}`}>Release</button>}</td></tr>)}{!attemptsQ.data?.length && <tr><td colSpan={6} className="px-3 py-4 text-center text-muted-foreground">No attempts yet.</td></tr>}</tbody></table></div></div>
  </div>;
}
