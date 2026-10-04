import path from 'path';
import react from '@vitejs/plugin-react';
import tailwindcss from '@tailwindcss/vite';
import { defineConfig } from 'vite';

import runtimeErrorOverlay from '@replit/vite-plugin-runtime-error-modal';

// PORT/BASE_PATH are provided automatically on Replit. Outside Replit (local
// dev on any machine, or a platform like Vercel/Netlify/Railway/Render)
// these fall back to sane defaults so `vite dev`/`vite build` just work.
const port = Number(process.env.PORT) || 5173;
const basePath = process.env.BASE_PATH || '/';

// Where the Express API lives during local dev. The frontend proxies
// `/api/*` here so `fetch('/api/...')` works without CORS configuration.
// In production, set VITE_API_BASE_URL instead (see src/lib/api.ts) if the
// frontend and backend are deployed to different domains/platforms.
const apiProxyTarget = process.env.API_PROXY_TARGET || `http://localhost:${Number(process.env.API_PORT) || 3001}`;

export default defineConfig({
  base: basePath,
  plugins: [
    react(),
    tailwindcss(),
    runtimeErrorOverlay(),
    ...(process.env.NODE_ENV !== 'production' &&
    process.env.REPL_ID !== undefined
      ? [
          await import('@replit/vite-plugin-cartographer').then((m) =>
            m.cartographer({
              root: path.resolve(import.meta.dirname, '..'),
            }),
          ),
          await import('@replit/vite-plugin-dev-banner').then((m) =>
            m.devBanner(),
          ),
        ]
      : []),
  ],
  resolve: {
    alias: {
      '@': path.resolve(import.meta.dirname, 'src'),
      '@assets': path.resolve(
        import.meta.dirname,
        '..',
        '..',
        'attached_assets',
      ),
    },
    dedupe: ['react', 'react-dom'],
  },
  root: path.resolve(import.meta.dirname),
  esbuild: { drop: process.env.NODE_ENV === 'production' ? ['debugger'] : [] },
  build: {
    outDir: path.resolve(import.meta.dirname, 'dist/public'),
    emptyOutDir: true,
    target: 'es2020',        // modern phones: less transpiled/polyfilled code
    cssCodeSplit: true,     // each lazy page ships only its own CSS
    chunkSizeWarningLimit: 700,
    rollupOptions: {
      output: {
        // Splits the big, slow-changing dependencies into their own chunk,
        // separate from app code. Browsers fetch chunks in parallel (faster
        // than one giant bundle) and, since this chunk's content barely
        // changes between deploys, it stays cached across app updates
        // instead of being re-downloaded every time app code changes.
        // Function form: heavy libraries get their own long-cached chunks, so
        // the first screen only downloads React + router + query, and charts /
        // Radix / icons load only with the pages that need them.
        manualChunks(id: string) {
          // Rollup's CommonJS interop helper is imported by every chunk that
          // touches a CJS dep. Pin it to vendor so the entry doesn't have to
          // pull the whole charts chunk just to get it.
          if (id.includes('commonjsHelpers')) return 'vendor';
          if (!id.includes('node_modules')) return undefined;
          // clsx / tailwind-merge / cva are used by every component (cn()) —
          // they must live in vendor, not in a chunk only some pages need.
          if (/[\\/]node_modules[\\/](react|react-dom|scheduler|wouter|clsx|tailwind-merge|class-variance-authority|@tanstack[\\/]react-query|@tanstack[\\/]query-core)[\\/]/.test(id)) return 'vendor';
          if (/[\\/]node_modules[\\/](recharts|recharts-scale|react-smooth|d3-[^\\/]+|victory-vendor|decimal\.js-light|internmap|lodash|fast-equals|eventemitter3|tiny-invariant)[\\/]/.test(id)) return 'charts';
          if (/[\\/]node_modules[\\/](framer-motion|motion-dom|motion-utils)[\\/]/.test(id)) return 'motion';
          if (id.includes('@radix-ui') || id.includes('@floating-ui')) return 'radix';
          if (id.includes('lucide-react')) return 'icons';
          return undefined;
        },
      },
    },
  },
  server: {
    port,
    strictPort: true,
    host: '0.0.0.0',
    allowedHosts: true,
    fs: {
      strict: true,
    },
    proxy: process.env.VITE_API_BASE_URL
      ? undefined // frontend calls a full remote API URL — no local proxy needed
      : {
          '/api': {
            target: apiProxyTarget,
            changeOrigin: true,
          },
        },
  },
  preview: {
    port,
    host: '0.0.0.0',
    allowedHosts: true,
  },
});
