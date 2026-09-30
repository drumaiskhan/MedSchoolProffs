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

import { SectionHeader, cn, initials } from './ui';


export function TeamPhoto({ member, size }: { member: TeamMember; size?: number }) {
  const [broken, setBroken] = useState(false);
  const url = member.photoPath ? resolveUploadUrl(member.photoPath) : null;
  // `size` (px) is optional so the existing 56px avatars are unchanged; the
  // landing page's team showcase passes a larger one.
  const dim = size ? { width: size, height: size } : undefined;
  if (!url || broken) return <div className={cn('grid shrink-0 place-items-center rounded-full bg-[#d7eee4] font-extrabold text-[#164b4b]', !size && 'size-14 text-sm')} style={size ? { ...dim, fontSize: Math.round(size * 0.34) } : undefined}>{initials(member.name)}</div>;
  return <img src={url} alt={member.name} loading="lazy" decoding="async" className={cn('shrink-0 rounded-full border border-border object-cover', !size && 'size-14')} style={dim} onError={() => setBroken(true)} />;
}

export function TeamSection() {
  const q = useQuery({ queryKey: ['site-content'], queryFn: siteContentApi.get });
  const team = q.data?.team || [];
  if (!team.length) return null;
  const card = (m: TeamMember) => <div key={m.id} className="rounded-2xl border border-border bg-card p-5" data-testid={`card-team-${m.id}`}><div className="flex items-center gap-3"><TeamPhoto member={m} /><div><div className="text-sm font-bold">{m.name}</div><div className="text-xs text-primary">{m.role}</div></div></div>{m.achievementBadge && <span className="mt-3 inline-flex items-center gap-1 rounded-full bg-[#fdeecb] px-2.5 py-1 text-[10px] font-bold text-[#8a5a12]"><Trophy size={11} /> {m.achievementBadge}</span>}{m.bio && <p className="mt-3 text-xs leading-5 text-muted-foreground">{m.bio}</p>}{(m.linkedinUrl || m.instagramUrl || m.email) && <div className="mt-3 flex gap-2">{m.linkedinUrl && <a href={m.linkedinUrl} target="_blank" rel="noreferrer" className="grid size-7 place-items-center rounded-full bg-muted text-[10px] font-bold hover:bg-primary/10 hover:text-primary">in</a>}{m.instagramUrl && <a href={m.instagramUrl} target="_blank" rel="noreferrer" className="grid size-7 place-items-center rounded-full bg-muted text-[10px] font-bold hover:bg-primary/10 hover:text-primary">ig</a>}{m.email && <a href={`mailto:${m.email}`} className="grid size-7 place-items-center rounded-full bg-muted hover:bg-primary/10 hover:text-primary"><Mail size={12} /></a>}</div>}</div>;
  return <div className="mt-9"><SectionHeader eyebrow="Behind the platform" title="Our Academic Team" />
    {TEAM_CATEGORIES.map((cat) => { const inCat = team.filter((m) => (m.category ?? 'reviewer') === cat); if (!inCat.length) return null; return <div key={cat} className="mb-6 last:mb-0"><div className="mb-3 text-[11px] font-bold uppercase tracking-wide text-muted-foreground">{TEAM_CATEGORY_LABELS[cat]}</div><div className="grid gap-4 sm:grid-cols-2">{inCat.map(card)}</div></div>; })}
  </div>;
}

// Public testimonials strip, fed by admin-curated 5-star feedback (see
// GET /feedback/featured — unauthenticated, only rows an admin explicitly
// marked featured). Used on Home's landing page; returns null while
// loading/empty so it never leaves a half-built section on the page an
// anonymous visitor lands on first.
export function Testimonials() {
  const q = useQuery({ queryKey: ['feedback-featured'], queryFn: feedbackApi.featured, staleTime: 5 * 60 * 1000 });
  const items = q.data ?? [];
  if (!q.isLoading && items.length === 0) return null;
  return <section id="reviews" className="mx-auto max-w-6xl px-5 py-20 md:px-8">
    <div className="mx-auto max-w-2xl text-center">
      <div className="font-mono-app text-[10px] uppercase tracking-[.16em] text-primary">Reviews</div>
      <h2 className="mt-3 font-display text-4xl tracking-[-.03em]">What students are saying</h2>
    </div>
    {q.isLoading ? <div className="mt-12 grid gap-5 sm:grid-cols-2 lg:grid-cols-3">
      {[0, 1, 2].map((i) => <div key={i} className="skeleton h-48 rounded-2xl" />)}
    </div> : <div className="mt-12 grid gap-5 sm:grid-cols-2 lg:grid-cols-3">
      {items.map((t) => <div key={t.id} className="card-lift rounded-2xl border border-border bg-card p-6" data-testid={`card-testimonial-${t.id}`}>
        <div className="flex items-center gap-0.5">{[1, 2, 3, 4, 5].map((n) => <Star key={n} size={14} className={t.rating >= n ? 'fill-[#e8c34a] text-[#e8c34a]' : 'text-muted-foreground'} />)}</div>
        <p className="mt-3 text-sm leading-6 text-foreground">"{t.message}"</p>
        <div className="mt-4 text-xs font-extrabold text-muted-foreground">{t.name}</div>
      </div>)}
    </div>}
  </section>;
}

export function SocialIcons({ content, dark = false }: { content?: SiteContent; dark?: boolean }) {
  const links: Array<[string, string | undefined]> = [['Facebook', content?.SOCIAL_FACEBOOK], ['YouTube', content?.SOCIAL_YOUTUBE], ['LinkedIn', content?.SOCIAL_LINKEDIN], ['Instagram', content?.SOCIAL_INSTAGRAM]];
  const present = links.filter(([, url]) => url);
  if (!present.length) return null;
  return <div className="flex gap-2.5">{present.map(([label, url]) => <a key={label} href={url} target="_blank" rel="noreferrer" className={cn('grid size-8 place-items-center rounded-full text-xs font-bold transition-colors', dark ? 'bg-white/10 text-white hover:bg-white/20' : 'bg-muted text-muted-foreground hover:bg-primary/10 hover:text-primary')} data-testid={`link-social-${label.toLowerCase()}`}>{label[0]}</a>)}</div>;
}

export function Footer({ variant = 'compact' }: { variant?: 'compact' | 'full' }) {
  const q = useQuery({ queryKey: ['site-content'], queryFn: siteContentApi.get });
  const c = q.data;
  const year = new Date().getFullYear();
  const platformName = c?.PLATFORM_NAME || 'MedschoolProffs';

  if (variant === 'compact') return <div className="flex items-center justify-between gap-3 font-mono-app text-[10px] text-muted-foreground"><span>© {year} {platformName} · {c?.COPYRIGHT_NOTICE || 'All rights reserved.'}</span><SocialIcons content={c} /></div>;

  return <div className="mt-12 overflow-hidden rounded-3xl border border-border bg-card">
    <div className="border-b border-border p-8 text-center"><h3 className="font-display text-2xl text-foreground">Connect With Us</h3><p className="mt-2 text-sm text-muted-foreground">Join our community and stay updated with the latest resources</p><div className="mt-5 flex justify-center"><SocialIcons content={c} /></div></div>
    <div className="grid gap-8 p-8 sm:grid-cols-2">
      <div><h4 className="text-sm font-extrabold text-foreground">{platformName}</h4><p className="mt-2 text-xs leading-6 text-muted-foreground">{c?.PLATFORM_DESCRIPTION || 'Empowering medical students with comprehensive study resources and innovative learning tools to ace their professional exams.'}</p></div>
      <div><h4 className="text-sm font-extrabold text-foreground">Contact Info</h4><div className="mt-3 space-y-2 text-xs text-muted-foreground">{c?.CONTACT_EMAIL && <div className="flex items-center gap-2"><Mail size={13} className="text-primary" /> {c.CONTACT_EMAIL}</div>}{c?.CONTACT_LOCATION && <div className="flex items-center gap-2"><Landmark size={13} className="text-primary" /> {c.CONTACT_LOCATION}</div>}{c?.SUPPORT_HOURS && <div className="flex items-center gap-2"><Clock3 size={13} className="text-primary" /> {c.SUPPORT_HOURS}</div>}</div></div>
      {!!c?.features?.length && <div><h4 className="text-sm font-extrabold text-foreground">Features</h4><div className="mt-3 space-y-2 text-xs text-muted-foreground">{c.features.map((f) => <div key={f} className="flex items-center gap-2"><Check size={13} className="text-primary" /> {f}</div>)}</div></div>}
      {!!c?.quickLinks?.length && <div><h4 className="text-sm font-extrabold text-foreground">Quick Links</h4><div className="mt-3 space-y-2 text-xs text-muted-foreground">{c.quickLinks.map((l) => <Link key={l.label} href={l.url} className="block hover:text-primary">{l.label}</Link>)}</div></div>}
    </div>
    <div className="border-t border-border bg-muted/40 px-8 py-4 text-center font-mono-app text-[10px] text-muted-foreground">© {year} {platformName}. {c?.COPYRIGHT_NOTICE || 'All rights reserved.'}</div>
  </div>;
}
