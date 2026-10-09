// Auto-extracted route page — code-split via React.lazy() in App.tsx.
import { type ReactNode, type ComponentProps, type TouchEvent, useSyncExternalStore, useState, useEffect, useRef, createContext, useContext } from 'react';
import { QueryClient, QueryClientProvider, useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { Link, Route, Switch, useLocation, useParams, useSearch, Router as WouterRouter } from 'wouter';
import {
  ArrowLeft, ArrowRight, BookOpen, Check, CheckCircle2, ChevronRight,
  CircleHelp, Clock3, CreditCard, FileText, Flame, FolderOpen,
  LayoutDashboard, Library, LockKeyhole, LogOut, Menu, MoreHorizontal, Pencil, Plus,
  ReceiptText, Search, Settings, ShieldCheck, Sparkles, Stethoscope, Target, Trash2,
  TrendingUp, TrendingDown, Minus, Users, X, Zap, Bell, SlidersHorizontal, FileStack, NotebookPen, Bookmark,
  Flag, Trophy, MessageSquare, Landmark, Copy, QrCode, User as UserIcon, Mail, Phone, Hash,
  GraduationCap, Eye, EyeOff, Smartphone, UploadCloud, ImageOff,
  RotateCcw, ThumbsUp, ThumbsDown, CheckCheck, ClipboardCheck, AlertTriangle, Link2 as LinkIcon, Lightbulb,
  LayoutGrid, Presentation, Wand2, Crown, Globe, Star, Activity, Sun, Moon, Monitor, Info,
} from 'lucide-react';
import { applyThemeVars, getStoredThemePref, setThemePref, subscribeThemePref, type ThemePref } from '@/lib/theme';
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
import { Toaster } from '@/components/ui/toaster';
import { toast } from '@/hooks/use-toast';
import { useIsMobile } from '@/hooks/use-mobile';
import { TooltipProvider } from '@/components/ui/tooltip';
import NotFound from '@/pages/not-found';
import { authApi, academicApi, settingsApi, uploadFile, resolveUploadUrl, ApiRequestError, publicApi, pastPapersApi, notebookApi, savedSessionsApi, flaggedMcqsApi, feedbackApi, type MyFeedbackEntry, analyticsApi, type ProgressTrend, mcqImportApi, studentsAdminApi, paymentsAdminApi, membershipPlansAdminApi, mcqAdminApi, notificationsApi, siteContentApi, teamApi, moduleAdminApi, blocksApi, type Block, examsAdminApi, examsApi, explanationsApi, booksApi, type AdminBookStudent, DEFAULT_IMPORT_PATTERNS, STUDENT_STATUSES, type Institution, type Program, type AcademicYear, type Batch, type PastPaper, type NotebookEntry, type SavedSession, type FlaggedMcq, type FeedbackEntry, type McqCandidate, type StudentDetail, type SiteContent, type TeamMember, TEAM_CATEGORIES, TEAM_CATEGORY_LABELS, type AdminModule, type AdminExam, type StudentExam, type ExamAttemptRow, type ExamStartResponse, type ExamResult, type Exam, type ExplanationStatus, type PaymentDetails, type PaymentMethodConfig, aiVisualizerApi, type VisualizationSpec, LeaderboardRow } from '@/lib/api';
import { VisualizationRenderer, isStepBased } from '@/components/visualizer/VisualizationRenderer';
import { StepControls } from '@/components/visualizer/StepControls';
import { ExplanationPanel } from '@/components/visualizer/ExplanationPanel';

// Round 3, item 10 (performance) — this was `new QueryClient()` with no
// options, meaning every query defaulted to `staleTime: 0` and refetched
// on every component mount AND every window refocus. For a study app where
// most data (modules, subjects, MCQs, progress) doesn't change
// second-to-second, that's a real over-fetching cost on every navigation
// and every alt-tab back to the app — exactly the "waterfalls/refetch on
// every mount" pattern item 10 flagged as a likely culprit. A 30s
// staleTime means switching between pages you've already visited in the
// last 30s reuses cached data instead of re-hitting the API, and turning
// off refetch-on-window-focus stops a background-tab refocus from firing
// a full page's worth of requests. Individual queries that DO need to
// react fast (the live leaderboard's refetchInterval, mutations that
// invalidateQueries after a save) already set their own options, which
// override these defaults per-query — this only changes the fallback for
// queries that didn't specify anything.
import { ProfileHero, MembershipPass } from '@/components/profile/ProfileVisuals';
import { ProfileAbout } from '@/components/profile/ProfileAbout';
import { Badge, ErrorState, IconField, PasswordStrength, SectionHeader, SkeletonPage, TeamSection, cn, initials } from '@/lib/shared';
import { ProgressAchievements } from '@/components/ProgressAchievements';
import { computeProgressAchievements, profileRank } from '@/lib/progressAchievements';
import { SegTabs } from '@/lib/fx3d';
import { useAchievementConfig } from '@/lib/useAchievementConfig';
import { queryClient } from '@/lib/query-client';

const PROFILE_TABS = [
  { id: 'overview', label: 'Overview', icon: UserIcon },
  { id: 'achievements', label: 'Achievements', icon: Trophy },
  { id: 'account', label: 'Account', icon: Settings },
  { id: 'appearance', label: 'Appearance', icon: Sun },
  { id: 'about', label: 'About', icon: Info },
] as const;
type ProfileTab = (typeof PROFILE_TABS)[number]['id'];
const tabFromSearch = (search: string): ProfileTab => {
  const t = new URLSearchParams(search).get('tab');
  return PROFILE_TABS.some((x) => x.id === t) ? (t as ProfileTab) : 'overview';
};

function Profile() {
  // Bug fix: this used to read `useGetCurrentUser()` from the generated
  // api-client-react hooks, which types /auth/me's response as the
  // codegen `User` shape (id/name/email/role/status/institution/program
  // only — see lib/api-zod/src/generated/types/user.ts). That's a
  // type-level ceiling, not a server one: /auth/me itself now also
  // resolves and returns the student's real MBBS/BDS programKind,
  // academicYear label/yearNumber, and profile picture (see userPublicView
  // in auth.ts) — those fields were just invisible here because this
  // page's `q.data` was typed too narrowly to see them. Switched to the
  // richer local `AuthUser` type via `authApi.me`, reusing the exact same
  // query key (`getGetCurrentUserQueryKey()`) so this stays the same cache
  // entry the rest of the app already invalidates on login/update — no
  // other page needs to change.
  const q = useQuery({ queryKey: getGetCurrentUserQueryKey(), queryFn: authApi.me });
  // Bug fix (React error #310, "Rendered more hooks than during the
  // previous render"): useState/useMutation/useGetStudentDashboard used to
  // be declared after the `if (q.isLoading) return ...` / `if (!q.data)
  // return ...` early returns above. Those branches only fire on some
  // renders (e.g. the very first one, before the query resolves), so the
  // hooks after them ran a different number of times render-to-render —
  // which crashed this page with #310 as soon as the current-user query
  // finished loading. All hooks now run unconditionally, before any early
  // return.
  const [editing, setEditing] = useState(false);
  // Profile picture — deliberately its own bit of state and its own
  // upload step, separate from the name/phone form fields: the picture
  // itself is optional (a student can save their name/phone without ever
  // touching it), and it uploads immediately on file choice via the
  // existing POST /uploads/profile-picture (same endpoint AdminTeam.tsx's
  // photo picker already uses for team members) rather than waiting for
  // the whole form's "Save changes".
  const [pendingPicture, setPendingPicture] = useState<{ storagePath: string; previewUrl: string } | null>(null);
  const [pictureUploading, setPictureUploading] = useState(false);
  const [pictureError, setPictureError] = useState<string | null>(null);
  const update = useMutation({ mutationFn: authApi.updateMe, onSuccess: () => { queryClient.invalidateQueries({ queryKey: getGetCurrentUserQueryKey() }); setEditing(false); setPendingPicture(null); } });
  // Password change — its own form and its own mutation, separate from
  // the name/phone/picture form above, since /auth/change-password is a
  // distinct endpoint (it verifies currentPassword server-side and, on
  // success, revokes every session for this account — see auth.ts — so
  // this one has to end in a redirect to /login rather than staying on
  // the page like the details save does).
  const [currentPassword, setCurrentPassword] = useState('');
  const [newPassword, setNewPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [passwordError, setPasswordError] = useState<string | null>(null);
  const changePassword = useMutation({
    mutationFn: () => authApi.changePassword(currentPassword, newPassword),
    onSuccess: () => { queryClient.clear(); window.location.href = '/login'; },
    onError: (err: unknown) => setPasswordError(err instanceof ApiRequestError ? err.message : 'Could not change password.'),
  });
  const resetPasswordFields = () => { setCurrentPassword(''); setNewPassword(''); setConfirmPassword(''); setPasswordError(null); };
  const dashboard = useGetStudentDashboard();
  // Appearance (Light / Dark / Auto) — saved on this device only.
  const storedPref = useSyncExternalStore(subscribeThemePref, () => getStoredThemePref() ?? 'site');
  const activePref: ThemePref = storedPref === 'site' ? (document.documentElement.classList.contains('dark') ? 'dark' : 'light') : storedPref;
  // Tabs — ?tab=achievements deep-links (used by the achievement toast).
  const search = useSearch();
  const [tab, setTab] = useState<ProfileTab>(() => tabFromSearch(search));
  useEffect(() => { setTab(tabFromSearch(search)); }, [search]);
  const selectTab = (t: ProfileTab) => {
    setTab(t);
    try { const url = new URL(window.location.href); if (t === 'overview') url.searchParams.delete('tab'); else url.searchParams.set('tab', t); window.history.replaceState(window.history.state, '', url); } catch { /* ignore */ }
  };
  // Same query key as the Progress page + achievement toast, so this is a shared cache entry.
  const progressQ = useQuery({ queryKey: ['progress-overview'], queryFn: analyticsApi.overview, staleTime: 30_000, retry: false });
  const achCfg = useAchievementConfig();
  const achievementList = progressQ.data ? computeProgressAchievements(progressQ.data, achCfg) : null;
  const nextAchievement = achievementList?.filter((a) => !a.earned).sort((x, y) => y.progress - x.progress)[0];
  const earnedCount = achievementList ? achievementList.filter((a) => a.earned).length : 0;
  const rank = achievementList ? profileRank(earnedCount, achCfg.ranks) : null;
  if (q.isLoading) return <SkeletonPage />;
  if (!q.data) return <ErrorState retry={() => q.refetch()} />;
  const u = q.data;
  const daysRemaining = dashboard.data?.membershipExpiry ? Math.max(0, Math.ceil((new Date(dashboard.data.membershipExpiry).getTime() - Date.now()) / 86400000)) : null;
  // "MBBS · 3rd Year" when both are known; falls back gracefully for any
  // account that (still) has neither set.
  const programYearLabel = [u.programKind, u.academicYear].filter(Boolean).join(' · ') || u.program || 'Medical student';
  const avatarUrl = pendingPicture?.previewUrl ?? resolveUploadUrl(u.profilePictureUrl ?? u.profilePicturePath);

  const handlePictureChange = async (file: File | undefined | null) => {
    if (!file) return;
    setPictureUploading(true); setPictureError(null);
    try {
      const res = await uploadFile(file, 'profile-picture');
      setPendingPicture({ storagePath: res.storagePath, previewUrl: URL.createObjectURL(file) });
    } catch (err) {
      setPictureError(err instanceof ApiRequestError ? err.message : 'Could not upload that photo. Try a smaller image.');
    } finally {
      setPictureUploading(false);
    }
  };

  return <div className="max-w-4xl"><SectionHeader eyebrow="Your account" title="Profile & access" description="Your membership, achievements, account details and settings." />
  <SegTabs<ProfileTab> ariaLabel="Profile sections" scroll className="mt-4" value={tab} onChange={selectTab}
    options={PROFILE_TABS.map((t) => ({ value: t.id, testId: `tab-profile-${t.id}`, label: <><t.icon size={13} />{t.label}{t.id === 'achievements' && achievementList ? <span className="ach-count">{earnedCount}</span> : null}</> }))} />
  {tab === 'overview' && <div className="mt-5 grid gap-5">
  <div className="grid gap-5 md:grid-cols-2"><ProfileHero name={u.name} programYear={programYearLabel} avatarUrl={avatarUrl} isActive={dashboard.data?.membershipStatus === 'ACTIVE'} streak={dashboard.data?.streak ?? 0} progress={dashboard.data?.progress ?? 0} days={daysRemaining} rank={rank} earned={earnedCount} total={achievementList?.length} /><MembershipPass name={u.name} manageHref="/payments" /></div>
    {achievementList && <button type="button" onClick={() => selectTab('achievements')} className="pfx-sum group no-3d" data-testid="card-profile-achievements-summary">
      <span className="pfx-sum__icon"><Trophy size={20} /></span>
      <span className="min-w-0 flex-1"><span className="block text-xs font-extrabold">Achievements · {earnedCount} of {achievementList.length} unlocked</span><span className="mt-0.5 block truncate text-[11px] text-muted-foreground">{nextAchievement ? `Next up: ${nextAchievement.label} (${nextAchievement.current}/${nextAchievement.target})` : 'Every badge unlocked — legend!'}</span>
        <span className="ach-meter mt-2 block"><i style={{ width: `${Math.round((earnedCount / achievementList.length) * 100)}%` }} /></span></span>
      <ArrowRight size={15} className="shrink-0 text-muted-foreground transition-transform group-hover:translate-x-0.5" />
    </button>}
    <TeamSection />
  </div>}
  {tab === 'achievements' && <div className="mt-5">{progressQ.isLoading ? <SkeletonPage /> : progressQ.data ? <ProgressAchievements overview={progressQ.data} /> : <ErrorState retry={() => progressQ.refetch()} />}</div>}
  {tab === 'account' && <>
  <div className="mt-5 grid gap-5">
    <div className="rounded-2xl border border-border bg-card p-6"><div className="flex items-center justify-between"><h3 className="font-bold">Personal details</h3><button onClick={() => { setEditing((v) => !v); setPendingPicture(null); setPictureError(null); resetPasswordFields(); }} className="inline-flex items-center gap-1 text-xs font-bold text-primary hover:opacity-80" data-testid="button-edit-profile"><Pencil size={13} /> {editing ? 'Cancel' : 'Edit'}</button></div>
      {editing ? <><form onSubmit={(e) => { e.preventDefault(); const f = new FormData(e.currentTarget); update.mutate({ name: String(f.get('name')), phone: String(f.get('phone') || ''), ...(pendingPicture ? { profilePicturePath: pendingPicture.storagePath } : {}) }); }} className="pf-edit mt-6 grid gap-4 sm:grid-cols-2">
        {/* Optional — a student can save name/phone changes without ever picking a photo. */}
        <label className="text-xs font-bold sm:col-span-2">Profile picture <span className="font-normal text-muted-foreground">(optional)</span>
          <div className="mt-2 flex items-center gap-3">
            {avatarUrl ? <img src={avatarUrl} alt="" className="size-12 rounded-xl border border-border object-cover" /> : <div className="grid size-12 place-items-center rounded-xl bg-[#d7eee4] text-sm font-extrabold text-[#164b4b]">{initials(u.name)}</div>}
            <input type="file" accept="image/png,image/jpeg,image/webp" onChange={(e) => handlePictureChange(e.target.files?.[0])} className="flex-1 rounded-xl border border-dashed border-border bg-card px-3 py-2 text-xs" data-testid="input-profile-picture" />
          </div>
          {pictureUploading && <p className="mt-1 text-[11px] text-muted-foreground">Uploading…</p>}
          {pictureError && <p className="mt-1 text-[11px] text-destructive">{pictureError}</p>}
        </label>
        <label className="text-xs font-bold sm:col-span-2">Full name<div className="mt-2"><IconField icon={UserIcon} required name="name" defaultValue={u.name} data-testid="input-edit-name" /></div></label>
        <label className="text-xs font-bold">Phone<div className="mt-2"><IconField icon={Phone} name="phone" defaultValue={(u as { phone?: string }).phone ?? ''} data-testid="input-edit-phone" /></div></label>
        <div className="flex items-end sm:col-span-2"><button disabled={update.isPending || pictureUploading} className="rounded-xl bg-primary px-5 py-2.5 text-xs font-extrabold text-primary-foreground disabled:opacity-50" data-testid="button-save-profile">{update.isPending ? 'Saving…' : 'Save changes'}</button></div>
      </form>
      <form onSubmit={(e) => { e.preventDefault(); setPasswordError(null); if (newPassword !== confirmPassword) { setPasswordError('New passwords do not match.'); return; } changePassword.mutate(); }} className="mt-6 grid gap-4 border-t border-border pt-6 sm:grid-cols-2">
        <div className="sm:col-span-2"><h4 className="text-xs font-bold">Password</h4><p className="mt-1 text-[11px] text-muted-foreground">Changing your password signs you out everywhere — you'll need to log back in with the new one.</p></div>
        <label className="text-xs font-bold sm:col-span-2">Current password<div className="mt-2"><IconField icon={LockKeyhole} required type={showPassword ? 'text' : 'password'} value={currentPassword} onChange={(e) => setCurrentPassword(e.target.value)} autoComplete="current-password" data-testid="input-current-password" /></div></label>
        <label className="text-xs font-bold">New password<div className="mt-2"><IconField icon={LockKeyhole} required minLength={8} type={showPassword ? 'text' : 'password'} value={newPassword} onChange={(e) => setNewPassword(e.target.value)} autoComplete="new-password" data-testid="input-new-password" /></div><PasswordStrength value={newPassword} /></label>
        <label className="text-xs font-bold">Confirm new password<div className="mt-2"><IconField icon={LockKeyhole} required minLength={8} type={showPassword ? 'text' : 'password'} value={confirmPassword} onChange={(e) => setConfirmPassword(e.target.value)} autoComplete="new-password" data-testid="input-confirm-password" /></div></label>
        <label className="flex items-center gap-2 text-[11px] font-semibold text-muted-foreground sm:col-span-2"><input type="checkbox" checked={showPassword} onChange={(e) => setShowPassword(e.target.checked)} data-testid="checkbox-show-password" />{showPassword ? <EyeOff size={13} /> : <Eye size={13} />} Show passwords</label>
        {passwordError && <p className="text-[11px] font-semibold text-destructive sm:col-span-2" data-testid="text-password-error">{passwordError}</p>}
        <div className="flex items-end sm:col-span-2"><button disabled={changePassword.isPending || !currentPassword || !newPassword} className="rounded-xl border border-border bg-background px-5 py-2.5 text-xs font-extrabold disabled:opacity-50" data-testid="button-change-password">{changePassword.isPending ? 'Updating…' : 'Update password'}</button></div>
      </form></>
      : <div className="mt-6 grid gap-5 sm:grid-cols-2">{[['Full name', u.name], ['Email address', u.email], ['Institution', u.institution || 'Not added'], ['Programme', u.programKind || u.program || 'Not added'], ['Academic year', u.academicYear || 'Not added']].map(([label, value]) => <div key={label} className="pf-row"><div className="text-[10px] font-bold uppercase tracking-[.12em] text-muted-foreground">{label}</div><div className="mt-2 text-sm font-semibold">{value}</div></div>)}</div>}
    </div></div>
  </>}
  {tab === 'appearance' && <>
  <div className="mt-5 rounded-2xl border border-border bg-card p-6" data-testid="card-appearance"><h3 className="font-bold">Appearance</h3><p className="mt-1 text-xs text-muted-foreground">Choose how MedSchoolProffs looks on this device. Auto follows your phone's setting.</p>
    <div role="radiogroup" aria-label="Theme" className="mt-4 grid grid-cols-3 gap-2 rounded-2xl bg-muted p-1.5">{([['light', 'Light', Sun], ['dark', 'Dark', Moon], ['auto', 'Auto', Monitor]] as const).map(([value, label, Icon]) => <button key={value} type="button" role="radio" aria-checked={activePref === value} onClick={() => setThemePref(value)} className={`flex items-center justify-center gap-1.5 rounded-xl px-3 py-2.5 text-xs font-extrabold transition-all ${activePref === value ? 'bg-primary text-primary-foreground shadow-sm' : 'text-muted-foreground hover:text-foreground'}`} data-testid={`button-theme-${value}`}><Icon size={14} />{label}</button>)}</div></div>
  </>}
  {tab === 'about' && <ProfileAbout />}
  </div>;
}

export default Profile;
