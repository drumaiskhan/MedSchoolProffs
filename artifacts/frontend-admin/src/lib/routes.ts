// Single source of truth for the lazy page chunks. App.tsx wraps these in
// React.lazy(); the prefetcher below calls the very same import() functions,
// so the browser fetches each chunk once and a later navigation finds it
// already in the module cache (no spinner, no network wait).
export const pageLoaders = {
  Login: () => import('@/pages/Login'),
  AdminSignup: () => import('@/pages/AdminSignup'),
  ForgotPassword: () => import('@/pages/ForgotPassword'),
  ResetPassword: () => import('@/pages/ResetPassword'),
  VerifyEmail: () => import('@/pages/VerifyEmail'),
  Notifications: () => import('@/pages/Notifications'),
  Profile: () => import('@/pages/Profile'),
  AdminOverview: () => import('@/pages/AdminOverview'),
  AdminStudents: () => import('@/pages/AdminStudents'),
  AdminPaymentsHub: () => import('@/pages/AdminPaymentsHub'),
  AdminPlans: () => import('@/pages/AdminPlans'),
  AdminAcademicStructure: () => import('@/pages/AdminAcademicStructure'),
  AdminContent: () => import('@/pages/AdminContent'),
  AdminSubjectsPage: () => import('@/pages/AdminSubjectsPage'),
  AdminTopicsPage: () => import('@/pages/AdminTopicsPage'),
  AdminQualityCenter: () => import('@/pages/AdminQualityCenter'),
  AdminMcqs: () => import('@/pages/AdminMcqs'),
  AdminFlashcards: () => import('@/pages/AdminFlashcards'),
  AdminBooks: () => import('@/pages/AdminBooks'),
  AdminBookPurchases: () => import('@/pages/AdminBookPurchases'),
  AdminCoupons: () => import('@/pages/AdminCoupons'),
  AdminPastPapers: () => import('@/pages/AdminPastPapers'),
  AdminExams: () => import('@/pages/AdminExams'),
  AdminOspeOsce: () => import('@/pages/AdminOspeOsce'),
  AdminFeedback: () => import('@/pages/AdminFeedback'),
  AdminAiVisualizerLogs: () => import('@/pages/AdminAiVisualizerLogs'),
  AdminSiteContent: () => import('@/pages/AdminSiteContent'),
  AdminTeam: () => import('@/pages/AdminTeam'),
  AdminSettings: () => import('@/pages/AdminSettings'),
  AdminDatabaseBackup: () => import('@/pages/AdminDatabaseBackup'),
} as const;

type PageName = keyof typeof pageLoaders;

// URL -> page chunk. Longest prefix wins (see resolve()).
const ROUTES: Array<[string, PageName]> = [
  ['/notifications', 'Notifications'], ['/profile', 'Profile'],
  ['/admin/students', 'AdminStudents'], ['/admin/payments', 'AdminPaymentsHub'], ['/admin/payment-details', 'AdminPaymentsHub'],
  ['/admin/plans', 'AdminPlans'], ['/admin/coupons', 'AdminCoupons'], ['/admin/academic-structure', 'AdminAcademicStructure'],
  ['/admin/content', 'AdminContent'], ['/admin/subjects', 'AdminSubjectsPage'], ['/admin/topics', 'AdminTopicsPage'],
  ['/admin/quality', 'AdminQualityCenter'], ['/admin/mcqs', 'AdminMcqs'], ['/admin/flashcards', 'AdminFlashcards'],
  ['/admin/books', 'AdminBooks'], ['/admin/book-purchases', 'AdminBookPurchases'], ['/admin/past-papers', 'AdminPastPapers'],
  ['/admin/exams', 'AdminExams'], ['/admin/ospe-osce', 'AdminOspeOsce'], ['/admin/feedback', 'AdminFeedback'],
  ['/admin/ai-visualizer-logs', 'AdminAiVisualizerLogs'], ['/admin/site-content', 'AdminSiteContent'], ['/admin/team', 'AdminTeam'],
  ['/admin/settings', 'AdminSettings'], ['/admin/database-backup', 'AdminDatabaseBackup'], ['/admin', 'AdminOverview'], ['/', 'AdminOverview'],
];

const started = new Set<PageName>();
function load(name: PageName) {
  if (started.has(name)) return;
  started.add(name);
  pageLoaders[name]().catch(() => started.delete(name)); // allow a retry if the network blipped
}

function resolve(pathname: string): PageName | undefined {
  const base = import.meta.env.BASE_URL.replace(/\/$/, '');
  const p = (base && pathname.startsWith(base) ? pathname.slice(base.length) : pathname) || '/';
  let best: [string, PageName] | undefined;
  for (const r of ROUTES) if ((p === r[0] || p.startsWith(r[0] + '/')) && (!best || r[0].length > best[0].length)) best = r;
  return best?.[1];
}

/** Start downloading the chunk for a path (no-op if already started). */
export function prefetchRoute(pathname: string) { const n = resolve(pathname); if (n) load(n); }

// Heavy chunks (pdf.js etc.) are left to hover/tap prefetch instead of idle.
const IDLE_ORDER: PageName[] = [
  'AdminOverview', 'AdminStudents', 'AdminMcqs', 'AdminQualityCenter', 'AdminContent', 'AdminPaymentsHub',
  'AdminFlashcards', 'AdminSubjectsPage', 'AdminTopicsPage', 'AdminExams', 'AdminPastPapers', 'AdminPlans',
  'AdminFeedback', 'AdminSettings', 'Notifications', 'Profile',
];

/**
 * Called once from App. (1) Warms the chunks of the pages an admin visits most,
 * one at a time while the browser is idle, so the first click is instant.
 * (2) Any link hovered / focused / touched starts its own chunk immediately.
 */
export function startPrefetching() {
  const conn = (navigator as any).connection;
  const constrained = !!conn && (conn.saveData || /(^|-)2g$/.test(conn.effectiveType || ''));

  const onIntent = (e: Event) => {
    const a = (e.target as Element | null)?.closest?.('a[href]') as HTMLAnchorElement | null;
    if (!a || a.origin !== location.origin) return;
    prefetchRoute(a.pathname);
  };
  document.addEventListener('pointerover', onIntent, { passive: true });
  document.addEventListener('focusin', onIntent, { passive: true });
  document.addEventListener('touchstart', onIntent, { passive: true });
  if (constrained) return;

  const idle: (cb: () => void) => void = (window as any).requestIdleCallback
    ? (cb) => (window as any).requestIdleCallback(cb, { timeout: 3000 })
    : (cb) => setTimeout(cb, 400);
  let i = 0;
  const next = () => {
    if (i >= IDLE_ORDER.length) return;
    load(IDLE_ORDER[i++]);
    idle(next);
  };
  const kick = () => idle(next);
  if (document.readyState === 'complete') kick(); else window.addEventListener('load', kick, { once: true });
}
