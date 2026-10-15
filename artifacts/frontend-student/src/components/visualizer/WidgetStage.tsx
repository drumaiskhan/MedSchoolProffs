// Renders an AI-written 2D interactive widget (v69) inside a locked-down iframe.
// Security: sandbox="allow-scripts" WITHOUT allow-same-origin gives the widget an
// opaque origin (no cookies/storage/API/parent access), and the CSP below blocks
// every network request and external resource. Never inject this HTML into the
// app DOM directly.
import { useEffect, useMemo, useRef, useState } from 'react';
import { Pause, Play } from 'lucide-react';
import type { WidgetSpec } from '@/lib/api';

const CSP = "default-src 'none'; script-src 'unsafe-inline'; style-src 'unsafe-inline'; img-src data:; font-src data:; form-action 'none'; base-uri 'none'";

// Safety net for AI widgets that print raw LaTeX ("$\bar{g}_{Na}$"): the sandbox has no
// math renderer, so convert the common subset to plain HTML (sub/sup/Greek/macron)
// in every text node, now and whenever the widget's own script updates the text.
const LATEX_FIX_SCRIPT = String.raw`(function(){
var G={alpha:'α',beta:'β',gamma:'γ',delta:'δ',Delta:'Δ',mu:'μ',pi:'π',sigma:'σ',tau:'τ',theta:'θ',lambda:'λ',omega:'ω',Omega:'Ω',phi:'φ',rho:'ρ',epsilon:'ε',kappa:'κ',eta:'η',cdot:'·',times:'×',pm:'±',approx:'≈',leq:'≤',geq:'≥',le:'≤',ge:'≥',neq:'≠',to:'→',rightarrow:'→',leftarrow:'←',infty:'∞',degree:'°',propto:'∝'};
function esc(t){return t.replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;');}
function grp(t,i){ if(t[i]==='{'){var d=0,j=i;for(;j<t.length;j++){if(t[j]==='{')d++;else if(t[j]==='}'){d--;if(d===0)break;}}return [t.slice(i+1,j),j+1];} return [t[i]||'',i+1]; }
function conv(t){
  var out='',i=0;
  while(i<t.length){
    var c=t[i];
    if(c==='\\'){
      var m=/^\\([A-Za-z]+|.)/.exec(t.slice(i));
      if(!m){i++;continue;}
      var name=m[1];i+=m[0].length;
      if(name==='bar'||name==='overline'||name==='hat'||name==='dot'){var r=grp(t,i);i=r[1];var inner=conv(r[0]);out+= inner.length===1? inner+(name==='hat'?'\u0302':name==='dot'?'\u0307':'\u0304') : '<span style="text-decoration:overline">'+inner+'</span>';}
      else if(name==='text'||name==='mathrm'||name==='mathbf'||name==='textbf'||name==='mathit'||name==='operatorname'){var r2=grp(t,i);i=r2[1];out+=conv(r2[0]);}
      else if(name==='frac'){var a=grp(t,i);var b=grp(t,a[1]);i=b[1];out+='('+conv(a[0])+')/('+conv(b[0])+')';}
      else if(name==='left'||name==='right'||name===','||name===';'||name==='!'||name==='quad'){}
      else if(name==='%'||name==='$'||name==='_'||name==='{'||name==='}'||name==='&'){out+=name;}
      else if(G[name]){out+=G[name];}
      else{out+=name;}
    } else if(c==='_'||c==='^'){
      var g=grp(t,i+1);i=g[1];out+='<'+(c==='_'?'sub':'sup')+'>'+conv(g[0])+'</'+(c==='_'?'sub':'sup')+'>';
    } else if(c==='{'||c==='}'){i++;}
    else{out+=esc(c);i++;}
  }
  return out;
}
var RE=/\$([^$\n]{1,160}?)\$/g, SKIP={SCRIPT:1,STYLE:1,TEXTAREA:1,TITLE:1};
function fix(root){
  var w=document.createTreeWalker(root,NodeFilter.SHOW_TEXT,null),n,list=[];
  while((n=w.nextNode())){ if(n.parentNode&&SKIP[n.parentNode.nodeName])continue; if(n.nodeValue&&n.nodeValue.indexOf('$')>-1)list.push(n); }
  list.forEach(function(node){
    var v=node.nodeValue,changed=false;
    var html='',last=0,mm;RE.lastIndex=0;
    while((mm=RE.exec(v))){
      if(!/[\\_^{}]/.test(mm[1]))continue;
      html+=esc(v.slice(last,mm.index))+conv(mm[1]);last=mm.index+mm[0].length;changed=true;
    }
    if(!changed)return;
    html+=esc(v.slice(last));
    var span=document.createElement('span');span.innerHTML=html;node.parentNode.replaceChild(span,node);
  });
}
var busy=false;function run(){if(busy)return;busy=true;setTimeout(function(){try{fix(document.body);}catch(e){}busy=false;},30);}
try{fix(document.body);}catch(e){}
try{new MutationObserver(run).observe(document.body,{childList:true,subtree:true,characterData:true});}catch(e){}
})();`;

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
try{new ResizeObserver(post).observe(document.body)}catch(e){setInterval(post,500)}})();</script><script>${LATEX_FIX_SCRIPT}</script></body></html>`;
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
