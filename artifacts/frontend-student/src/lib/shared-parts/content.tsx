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

import { Badge, cn, initials } from './ui';
import { topicAccentStyles } from './home';


export function PastPaperRowIcon({ examBoard }: { examBoard: string }) {
  const styles = topicAccentStyles(examBoard || 'paper');
  return <span className="grid size-10 shrink-0 place-items-center rounded-xl" style={styles.badge}><FileStack size={18} /></span>;
}

// Past papers don't store an estimated duration server-side (only
// mcqCount) — this mirrors the ~1 min/question pacing convention implied
// by the reference design (120 Q -> 2h, 150 Q -> 2.5h, 100 Q -> 1.5h),
// rounded to the nearest half hour purely for display.

export function pastPaperEstimatedHours(mcqCount: number): number {
  return Math.round((mcqCount / 60) * 2) / 2;
}

export function NotebookCard({ note, onLinkedClick }: { note: NotebookEntry; onLinkedClick: (mcqId: number) => void }) {
  const [editing, setEditing] = useState(false);
  const [title, setTitle] = useState(note.title);
  const [content, setContent] = useState(note.content);
  const update = useMutation({
    mutationFn: () => notebookApi.update(note.id, { title: title.trim(), content: content.trim() }),
    onSuccess: () => { queryClient.invalidateQueries({ queryKey: ['notebook'] }); setEditing(false); toast({ title: 'Note updated' }); },
    onError: (err: unknown) => toast({ title: 'Could not save note', description: err instanceof ApiRequestError ? err.message : 'Something went wrong.', variant: 'destructive' }),
  });
  const remove = useMutation({ mutationFn: () => notebookApi.remove(note.id), onSuccess: () => queryClient.invalidateQueries({ queryKey: ['notebook'] }) });

  if (editing) {
    return <div className="rounded-2xl border border-primary/30 bg-[#eef7f1] p-4" data-testid={`card-note-edit-${note.id}`}>
      <input value={title} onChange={(e) => setTitle(e.target.value)} placeholder="Title (optional)" className="h-10 w-full rounded-xl border border-border bg-card px-3 text-sm" data-testid={`input-edit-note-title-${note.id}`} />
      <textarea value={content} onChange={(e) => setContent(e.target.value)} className="mt-2 min-h-24 w-full rounded-xl border border-border bg-card p-3 text-sm" data-testid={`input-edit-note-content-${note.id}`} />
      <div className="mt-2 flex gap-2"><button disabled={update.isPending || !content.trim()} onClick={() => update.mutate()} className="rounded-xl bg-primary px-4 py-2 text-xs font-bold text-primary-foreground disabled:opacity-50" data-testid={`button-save-note-${note.id}`}>{update.isPending ? 'Saving…' : 'Save'}</button><button onClick={() => { setTitle(note.title); setContent(note.content); setEditing(false); }} className="rounded-xl border border-border bg-card px-4 py-2 text-xs font-bold" data-testid={`button-cancel-note-${note.id}`}>Cancel</button></div>
    </div>;
  }

  return <div className="card-lift rounded-2xl border border-border bg-card p-4" data-testid={`card-note-${note.id}`}>
    {note.title && <div className="text-sm font-extrabold">{note.title}</div>}
    <p className="mt-1 whitespace-pre-wrap text-sm text-muted-foreground">{note.content}</p>
    {note.mcqId != null && <button onClick={() => onLinkedClick(note.mcqId!)} className="mt-2 inline-flex items-center gap-1 rounded-full bg-[#eef2fb] px-2.5 py-1 text-[10px] font-bold text-[#32647b]" data-testid={`button-linked-mcq-${note.id}`}><LinkIcon size={10} /> Linked to a question</button>}
    <div className="mt-3 flex items-center justify-between text-[10px] text-muted-foreground">
      <span>{new Date(note.updatedAt).toLocaleString()}</span>
      <div className="flex items-center gap-3"><button onClick={() => setEditing(true)} className="font-bold text-primary" data-testid={`button-edit-note-${note.id}`}>Edit</button><button onClick={() => remove.mutate()} className="font-bold text-destructive" data-testid={`button-delete-note-${note.id}`}>Delete</button></div>
    </div>
  </div>;
}

export function Podium({ rows }: { rows: LeaderboardRow[] }) {
  const [first, second, third] = rows;
  const Slot = ({ row, place }: { row: LeaderboardRow; place: 1 | 2 | 3 }) => {
    const config = {
      1: { height: 'h-32', ring: 'ring-4 ring-[#e8c34a]', bar: 'bg-gradient-to-b from-[#fdeecb] to-[#f7dfa0]', badge: 'bg-[#e8c34a] text-[#4a3a0a]', avatarBg: 'bg-[#fdeecb]', avatarText: 'text-[#8a5a12]', crown: true, size: 'size-20 text-lg' },
      2: { height: 'h-24', ring: 'ring-4 ring-[#c3cbd6]', bar: 'bg-gradient-to-b from-[#eef1f5] to-[#dfe4ea]', badge: 'bg-[#c3cbd6] text-[#33404f]', avatarBg: 'bg-[#eef1f5]', avatarText: 'text-[#495568]', crown: false, size: 'size-16 text-sm' },
      3: { height: 'h-20', ring: 'ring-4 ring-[#d99a5c]', bar: 'bg-gradient-to-b from-[#fbe4d0] to-[#f6d0ac]', badge: 'bg-[#d99a5c] text-[#4a2a0f]', avatarBg: 'bg-[#fbe4d0]', avatarText: 'text-[#8a4b1c]', crown: false, size: 'size-16 text-sm' },
    }[place];
    const order = place === 1 ? 'order-2' : place === 2 ? 'order-1' : 'order-3';
    return <div className={cn('flex flex-1 flex-col items-center', order)} data-testid={`podium-place-${place}`}>
      {config.crown && <Crown size={22} className="mb-1 text-[#e8c34a]" fill="currentColor" />}
      <div className={cn('relative grid place-items-center rounded-full font-extrabold', config.size, config.ring, config.avatarBg, config.avatarText)}>{initials(row.name)}</div>
      <div className="mt-2.5 max-w-[92px] truncate text-center text-xs font-extrabold text-foreground">{row.name}{row.isYou && <span className="block text-[9px] font-bold text-primary">(you)</span>}</div>
      {row.institution && <div className="max-w-[92px] truncate text-center text-[9px] font-semibold text-muted-foreground">{row.institution}</div>}
      <div className="mt-0.5 font-mono-app text-[11px] font-bold text-[#8a5a12]">{row.points} pts</div>
      <div className={cn('mt-3 flex w-full flex-col items-center justify-start rounded-t-2xl border-t border-border pt-2.5', config.height, config.bar)}><span className={cn('grid size-7 place-items-center rounded-full text-xs font-extrabold', config.badge)}>{place}</span></div>
    </div>;
  };
  return <div className="mb-5 flex items-end justify-center gap-3 rounded-3xl border border-border bg-card p-6 pt-9 sm:gap-5">
    {second && <Slot row={second} place={2} />}
    {first && <Slot row={first} place={1} />}
    {third && <Slot row={third} place={3} />}
  </div>;
}

export function MyFeedbackThread({ item }: { item: MyFeedbackEntry }) {
  const [open, setOpen] = useState(false);
  const [message, setMessage] = useState('');
  const reply = useMutation({
    mutationFn: () => feedbackApi.reply(item.id, message.trim()),
    onSuccess: () => { setMessage(''); queryClient.invalidateQueries({ queryKey: ['my-feedback'] }); },
    onError: (err: unknown) => toast({ title: 'Could not send reply', description: err instanceof ApiRequestError ? err.message : 'Something went wrong.', variant: 'destructive' }),
  });
  const statusTone = item.status === 'open' ? 'bg-[#4e3c12] text-[#e6cda8]' : item.status === 'replied' ? 'bg-[#1c3745] text-[#afd0df]' : 'bg-[#1c4533] text-[#a8e6e6]';
  return <div className="rounded-2xl border border-border bg-card p-5" data-testid={`card-my-feedback-${item.id}`}>
    <div className="flex items-start justify-between gap-4"><div className="flex-1"><div className="flex items-center gap-2"><span className="rounded-full bg-muted px-2 py-0.5 text-[10px] font-bold capitalize">{item.category}</span><span className={cn('rounded-full px-2 py-0.5 text-[10px] font-bold capitalize', statusTone)}>{item.status === 'replied' ? 'Team replied' : item.status}</span>{!!item.rating && <span className="flex items-center gap-0.5" data-testid={`text-my-feedback-rating-${item.id}`}>{[1, 2, 3, 4, 5].map((n) => <Star key={n} size={11} className={item.rating! >= n ? 'fill-[#e8c34a] text-[#e8c34a]' : 'text-muted-foreground'} />)}</span>}</div><p className="mt-2 text-sm leading-6">{item.message}</p><div className="mt-2 text-[10px] text-muted-foreground">{new Date(item.createdAt).toLocaleString()}</div></div>{item.replies.length > 0 && <button onClick={() => setOpen((v) => !v)} className="shrink-0 rounded-lg border border-border px-3 py-1.5 text-[11px] font-bold" data-testid={`button-toggle-my-thread-${item.id}`}>{open ? 'Hide' : `${item.replies.length} repl${item.replies.length === 1 ? 'y' : 'ies'}`}</button>}</div>
    {open && <div className="mt-4 space-y-2 border-t border-border pt-4">{item.replies.map((r) => <div key={r.id} className={cn('max-w-[85%] rounded-xl p-3 text-xs', r.authorRole === 'admin' ? 'bg-[#1c452a]' : 'ml-auto bg-muted')}><div className="mb-1 text-[10px] font-bold text-muted-foreground">{r.authorRole === 'admin' ? 'Academic team' : 'You'} · {new Date(r.createdAt).toLocaleString()}</div>{r.message}</div>)}</div>}
    {item.status !== 'open' && <div className="mt-3 flex gap-2"><textarea value={message} onChange={(e) => setMessage(e.target.value)} placeholder="Reply to the team…" className="min-h-12 flex-1 rounded-xl border border-border bg-background p-2 text-xs" data-testid={`input-my-feedback-reply-${item.id}`} /><button onClick={() => message.trim() && reply.mutate()} disabled={reply.isPending || !message.trim()} className="self-end rounded-xl bg-primary px-4 py-2 text-xs font-bold text-primary-foreground disabled:opacity-50" data-testid={`button-send-my-feedback-reply-${item.id}`}>{reply.isPending ? '…' : 'Reply'}</button></div>}
  </div>;
}

export function ExamCard({ exam, onStart }: { exam: StudentExam; onStart: () => void }) {
  const scopeLabel = `${exam.programTargetKind || 'All Programs'} · ${exam.yearTargetNumber ? `${exam.yearTargetNumber}${['th', 'st', 'nd', 'rd'][exam.yearTargetNumber % 10 > 3 ? 0 : exam.yearTargetNumber % 10]} Year` : 'All Years'}`;
  return <div className="rounded-2xl border border-border bg-card p-5" data-testid={`card-exam-${exam.id}`}>
    <div className="flex items-start justify-between gap-3"><div><h3 className="text-sm font-extrabold">{exam.title}</h3><p className="mt-1 text-xs text-muted-foreground">{exam.description}</p></div><Badge tone={exam.windowStatus === 'open' ? 'green' : exam.windowStatus === 'upcoming' ? 'blue' : 'neutral'}>{exam.windowStatus}</Badge></div>
    <div className="mt-3 flex flex-wrap gap-3 text-[11px] text-muted-foreground"><span className="inline-flex items-center gap-1"><Clock3 size={12} /> {exam.durationMinutes} min</span><span>{scopeLabel}</span><span>{exam.attemptsUsed}/{exam.maxAttempts} attempts used</span>{exam.negativeMarkingEnabled && <span className="inline-flex items-center gap-1 text-[#e0b5ae]"><AlertTriangle size={12} /> -{exam.negativeMarkPerWrong} per wrong</span>}</div>
    <div className="mt-4">{exam.inProgressAttemptId ? <Link href={`/exams/take/${exam.inProgressAttemptId}`} className="inline-flex items-center gap-1.5 rounded-xl bg-[#4e3612] px-4 py-2 text-xs font-bold text-[#acd3e2]" data-testid={`button-resume-exam-${exam.id}`}>Resume exam <ArrowRight size={13} /></Link> : exam.canStart ? <button onClick={onStart} className="inline-flex items-center gap-1.5 rounded-xl bg-primary px-4 py-2 text-xs font-bold text-primary-foreground" data-testid={`button-start-exam-${exam.id}`}><ClipboardCheck size={14} /> Start exam</button> : <span className="text-[11px] font-semibold text-muted-foreground">{exam.windowStatus === 'upcoming' ? `Opens ${new Date(exam.startAt).toLocaleString(undefined, { dateStyle: 'medium', timeStyle: 'short' })}` : exam.windowStatus === 'closed' ? 'Window closed' : 'No attempts remaining'}</span>}</div>
  </div>;
}
