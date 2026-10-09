import { createRoot } from 'react-dom/client';
import { setBaseUrl } from '@workspace/api-client-react';

import App from './App';
import { ErrorBoundary } from '@/components/error-boundary';

import './index.css';
import './profile3d.css';
import './premium3d.css'; // v62: profile hero, achievement coins, leaderboard arena
import './modern.css'; // shared visual layer: tokens + surfaces for every section
import './auth.css'; // v64: sign-in / registration screens
import './connect3d.css'; // v64: Profile → About → Connect with us
import './redo3d.css'; // v65: practice results → Redo wrong answers
import './smooth.css'; // leaderboard smoothness (cheaper rows, no per-frame layout)
import './dash3d.css'; // dashboard depth layer (2.5D: gradients, edges, parallax — no real 3D transforms)
import './perf.css'; // must stay last: overrides the heavy effects on phones
import { initFx } from '@/lib/fx';
import { initThemePref } from '@/lib/theme';
import { initializeGithubLiveUpdate } from '@/lib/github-live-update';
import { initNativeAuth, isNativeApp } from '@/lib/native-auth';
import { initSessionPersistence } from '@/lib/session-persistence';
import { authApi } from '@/lib/api';

// v43: stamps <html data-fx="full|lite"> before first paint (see lib/fx.ts).
initFx();
initThemePref();

void initializeGithubLiveUpdate();

// Split deployments (frontend on Vercel/Netlify, backend on Railway/Render)
// set VITE_API_BASE_URL to the backend's origin at build time. Same-origin
// deployments leave it unset and requests stay relative ("/api/...").
if (import.meta.env.VITE_API_BASE_URL) {
  setBaseUrl(import.meta.env.VITE_API_BASE_URL);
}

async function bootstrap() {
  // Native app only: restore the saved bearer token and register it with the
  // generated API client BEFORE first render, so the first /auth/me already
  // carries it (no false 401). On the web this branch is skipped entirely, so
  // rendering stays synchronous and cookie-only.
  if (isNativeApp()) await initNativeAuth();

  // Login without "Remember me": if the app was closed without signing out,
  // sign that session out now, before the first /auth/me can reuse it.
  await initSessionPersistence(() => authApi.logout());

  createRoot(document.getElementById('root')!, {
    // Keeps caught errors off reportError(), which would raise the dev overlay.
    onCaughtError: (error, errorInfo) => {
      console.error(error, errorInfo.componentStack);
    },
  }).render(
    <ErrorBoundary>
      <App />
    </ErrorBoundary>,
  );
}

void bootstrap();
