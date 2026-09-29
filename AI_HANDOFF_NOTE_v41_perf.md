# Hand-off note — v41 (student UI performance pass)
Goal: student app felt laggy/slow on phones.

- `artifacts/frontend-student/src/perf.css` (new, imported LAST in main.tsx): under `html[data-fx="lite"]` removes blur filters + backdrop-filter, endless decorative animations, sliding-gradient skeleton shimmer (now an opacity pulse) and staggered entrance animations; touch screens no longer get sticky :hover lift/brightness; `touch-action: manipulation` removes the tap delay.
- `lib/fx.ts`: touch-only devices (phones/tablets) now default to `lite`. Desktop stays `full`. `?fx=full` / `?fx=lite` overrides and is remembered. The BookReader privacy veil keeps its blur (`data-testid^="veil"` is excluded).
- Google Fonts were a render-blocking CSS `@import` + blocking `<link>` (Inter, barely used). Now one non-blocking preload link in index.html.
- Practice timer: seconds live in a tiny external store (`lib/countdown.tsx`); only `<CountdownBadge>` re-renders each second, not the whole Practice page.
- Leaderboard polling: 15 s and paused when the tab is in the background (was 10 s, even in background).
- Not run: `pnpm build` / tsc / on-device profiling (no node_modules or network here). Files were syntax-checked only. TakeExam.tsx / TakeOspeExam.tsx have the same per-second `setSecondsLeft` pattern and could use `lib/countdown.tsx` too.

## v41b addendum — modern visual layer + exam timers + build
- `src/modern.css` (new, imported after profile3d.css and BEFORE perf.css): redefines the shared depth tokens (`--raise-1/2`, `--well`, `--sheen`, `--edge-color`) and adds `--e1/e2/e3`, `--glow`, easing vars. Because `.d3-*`, `.dash-*` and the `.student-shell` card/button rules are all built from those tokens, every signed-in page picks up: hairline-bordered cards with one tight soft shadow (old shadows were 4 layers, 30–50 px blur), solid tactile primary buttons with a primary-tinted glow (no 3 px edge), clean inputs with a soft focus halo, gradient progress fills, calmer header / floating tab bar, dialog pop-in, springy short page rise, tabular numerals, balanced headings. Light + dark have their own tokens. Everything derives from `--primary`, so Design & Branding still re-colours it.
- Rule of thumb: tokens/colour → modern.css; anything that must be switched off on phones → perf.css (loaded last, `html[data-fx="lite"]`).
- `TakeExam.tsx` / `TakeOspeExam.tsx`: per-second `setSecondsLeft` replaced by `useCountdownStore` + `<ExamClock>` (lib/countdown.tsx). Auto-submit at 0 unchanged.
- `vite.config.ts`: function-form manualChunks (vendor / charts / radix / icons), `target: es2020`, `cssCodeSplit`, drops `debugger` in production.
- Verified: files parse; modern.css + perf.css rendered in headless Chromium (light + dark) — tokens resolve, lite skeleton pulse applies, no horizontal overflow at 390 px. NOT run: full `pnpm build`, real pages (Tailwind/JS bundle), on-device profiling. Eyeball each page once after building; if a card looks too flat, raise `--e1` in modern.css.
- Admin app was not restyled in this pass (only the scroll fix).
