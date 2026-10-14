// Renders an AI-written 2D interactive widget (v69) inside a locked-down iframe.
// Security: sandbox="allow-scripts" WITHOUT allow-same-origin gives the widget an
// opaque origin (no cookies/storage/API/parent access), and the CSP below blocks
// every network request and external resource. Never inject this HTML into the
// app DOM directly.
import { useEffect, useMemo, useRef, useState } from 'react';
import { Pause, Play } from 'lucide-react';
import type { WidgetSpec } from '@/lib/api';

const CSP = "default-src 'none'; script-src 'unsafe-inline'; style-src 'unsafe-inline'; img-src data:; font-src data:; form-action 'none'; base-uri 'none'";

function isDark() {
  try { return document.documentElement.classList.contains('dark'); } catch { return false; }
}

function buildSrcDoc(html: string, dark: boolean): string {
  const vars = dark
    ? '--bg:transparent;--card:#161f2b;--fg:#e8edf3;--muted:#9fb0c3;--border:#2a3646;--accent:#4fd1b5;'
    : '--bg:transparent;--card:#ffffff;--fg:#14202e;--muted:#5b6b7e;--border:#dbe3ec;--accent:#0f9d8a;';
  return `<!doctype html><html><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1">
<meta http-equiv="Content-Security-Policy" content="${CSP}">
<style>:root{${vars}color-scheme:${dark ? 'dark' : 'light'}}
*{box-sizing:border-box}html,body{margin:0;padding:0}
body{background:var(--bg);color:var(--fg);font:15px/1.5 system-ui,-apple-system,"Segoe UI",Roboto,sans-serif;padding:4px}
svg{max-width:100%;height:auto}
@keyframes msp-flow{to{stroke-dashoffset:-24}}
@keyframes msp-flow-rev{to{stroke-dashoffset:24}}
@keyframes msp-pulse{0%,100%{transform:scale(1)}50%{transform:scale(1.08)}}
@keyframes msp-float{0%,100%{transform:translateY(0)}50%{transform:translateY(-4px)}}
@keyframes msp-blink{0%,100%{opacity:1}50%{opacity:.35}}
@keyframes msp-spin{to{transform:rotate(360deg)}}
.msp-flow{stroke-dasharray:6 6;animation:msp-flow var(--msp-dur,1s) linear infinite}
.msp-flow.msp-rev{animation-name:msp-flow-rev}
.msp-pulse{animation:msp-pulse var(--msp-dur,1s) ease-in-out infinite}
.msp-float{animation:msp-float var(--msp-dur,3s) ease-in-out infinite}
.msp-blink{animation:msp-blink var(--msp-dur,1.2s) ease-in-out infinite}
.msp-spin{animation:msp-spin var(--msp-dur,4s) linear infinite}
body.msp-paused *{animation-play-state:paused!important}
@media (prefers-reduced-motion:reduce){.msp-flow,.msp-pulse,.msp-float,.msp-blink,.msp-spin{animation:none}}input[type=range]{width:100%;accent-color:var(--accent)}
button{font:inherit;color:inherit;cursor:pointer}</style></head><body>${html}
<script>(function(){function post(){try{var h=Math.ceil(document.documentElement.scrollHeight);parent.postMessage({__widgetHeight:h},'*')}catch(e){}}
window.__mspPaused=false;
window.addEventListener('message',function(e){var d=e.data;if(d&&typeof d.__mspPaused==='boolean'){window.__mspPaused=d.__mspPaused;document.body.classList.toggle('msp-paused',d.__mspPaused);try{var svgs=document.querySelectorAll('svg');for(var i=0;i<svgs.length;i++){d.__mspPaused?svgs[i].pauseAnimations():svgs[i].unpauseAnimations()}}catch(x){}}});
window.addEventListener('load',post);window.addEventListener('resize',post);
try{new ResizeObserver(post).observe(document.body)}catch(e){setInterval(post,500)}})();</script></body></html>`;
}

export default function WidgetStage({ spec }: { spec: WidgetSpec }) {
  const ref = useRef<HTMLIFrameElement>(null);
  const [height, setHeight] = useState(520);
  const [paused, setPaused] = useState(false);
  const togglePause = () => {
    const next = !paused;
    setPaused(next);
    try { ref.current?.contentWindow?.postMessage({ __mspPaused: next }, '*'); } catch { /* iframe not ready */ }
  };
  const srcDoc = useMemo(() => buildSrcDoc(spec.html, isDark()), [spec.html]);

  useEffect(() => {
    const onMsg = (e: MessageEvent) => {
      if (e.source !== ref.current?.contentWindow) return;
      const h = (e.data as { __widgetHeight?: unknown } | null)?.__widgetHeight;
      if (typeof h === 'number' && Number.isFinite(h)) setHeight(Math.min(Math.max(h + 8, 240), 1600));
    };
    window.addEventListener('message', onMsg);
    return () => window.removeEventListener('message', onMsg);
  }, []);

  return (
    <div className="rounded-2xl border border-border bg-card p-4 sm:p-5" data-testid="stage-visualizer-widget">
      <div className="flex items-start justify-between gap-3">
        <h2 className="font-display text-lg">{spec.title}</h2>
        <button type="button" onClick={togglePause} aria-pressed={paused} className="inline-flex shrink-0 items-center gap-1.5 rounded-lg border border-border px-2.5 py-1.5 text-[11px] font-bold text-muted-foreground hover:bg-muted hover:text-foreground" data-testid="button-widget-pause">
          {paused ? <Play size={12} /> : <Pause size={12} />}{paused ? 'Play animation' : 'Pause animation'}
        </button>
      </div>
      {spec.description && <p className="mt-1 text-xs leading-6 text-muted-foreground">{spec.description}</p>}
      <iframe
        ref={ref}
        title={spec.title}
        sandbox="allow-scripts"
        referrerPolicy="no-referrer"
        srcDoc={srcDoc}
        style={{ height }}
        className="mt-3 w-full rounded-xl border-0"
        data-testid="iframe-visualizer-widget"
      />
    </div>
  );
}
