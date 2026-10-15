// Everything the student "AI MCQ Maker" has filed into the Qbank, laid out the way it was filed:
// Program / Year > Block > Module > Subject > Topic, with a question count and a draft count on
// every level. Before this, admins only saw the questions themselves, with nothing saying where in
// the curriculum the AI had put them. Drafts can be published from any level (e.g. one whole module).
import { useState } from 'react';
import { useMutation, useQuery } from '@tanstack/react-query';
import { Bot, CheckCircle2, ChevronRight, FileText, FolderTree, Layers } from 'lucide-react';
import { mcqAdminApi, STUDENT_AI_SOURCE, ApiRequestError, type AdminMcqRow } from '@/lib/api';
import { McqTreeRow, cn } from '@/lib/shared';
import { Chip, StatTiles } from '@/lib/admin-ui';
import { queryClient } from '@/lib/query-client';
import { toast } from '@/hooks/use-toast';

interface Node { key: string; label: string; level: string; children: Map<string, Node>; rows: AdminMcqRow[] }
const LEVELS = ['Program / year', 'Block', 'Module', 'Subject', 'Topic'];
const newNode = (key: string, label: string, level: string): Node => ({ key, label, level, children: new Map(), rows: [] });

// Each question is appended to every node on its path, so a node's rows are everything below it.
function buildTree(rows: AdminMcqRow[]): Node {
  const root = newNode('root', 'All', 'root');
  for (const row of rows) {
    const p = row.path;
    const scope = [p?.program, p?.year != null ? `Year ${p.year}` : null].filter(Boolean).join(' · ') || 'All years';
    const labels = [scope, p?.block ?? 'No block', p?.module ?? 'No module', p?.subject ?? 'No subject', p?.topic ?? 'No topic'];
    let node = root;
    labels.forEach((label, i) => {
      const key = `${node.key}>${label}`;
      let child = node.children.get(key);
      if (!child) { child = newNode(key, label, LEVELS[i]); node.children.set(key, child); }
      child.rows.push(row);
      node = child;
    });
  }
  return root;
}

const isDraft = (r: AdminMcqRow) => r.status.toLowerCase() !== 'published';

function PublishButton({ rows, label }: { rows: AdminMcqRow[]; label: string }) {
  const drafts = rows.filter(isDraft);
  const publish = useMutation({
    mutationFn: async () => {
      let done = 0;
      for (let i = 0; i < drafts.length; i += 20) { await Promise.all(drafts.slice(i, i + 20).map((r) => mcqAdminApi.publish(r.id))); done += Math.min(20, drafts.length - i); }
      return done;
    },
    onSuccess: (n) => {
      queryClient.invalidateQueries({ queryKey: ['admin-mcqs-tree'] });
      queryClient.invalidateQueries({ queryKey: ['modules'] });
      toast({ title: `Published ${n} question${n === 1 ? '' : 's'}`, description: `From ${label}. Students can see them now.` });
    },
    onError: (err: unknown) => toast({ title: 'Could not publish', description: err instanceof ApiRequestError ? err.message : 'Something went wrong.', variant: 'destructive' }),
  });
  if (!drafts.length) return null;
  return <button type="button" onClick={(e) => { e.stopPropagation(); if (window.confirm(`Publish ${drafts.length} AI-made draft${drafts.length === 1 ? '' : 's'} from "${label}"? They will be visible to students.`)) publish.mutate(); }} disabled={publish.isPending}
    className="shrink-0 rounded-lg bg-accent/15 px-2 py-1 text-[10px] font-bold text-accent-text hover:bg-accent/25 disabled:opacity-50" data-testid={`button-publish-ai-drafts-${label}`}>
    {publish.isPending ? 'Publishing…' : `Publish ${drafts.length} draft${drafts.length === 1 ? '' : 's'}`}
  </button>;
}

function TreeNode({ node, depth, defaultOpen }: { node: Node; depth: number; defaultOpen: boolean }) {
  const [open, setOpen] = useState(defaultOpen);
  const isTopic = node.level === 'Topic';
  const drafts = node.rows.filter(isDraft).length;
  const children = [...node.children.values()].sort((a, b) => a.label.localeCompare(b.label, undefined, { numeric: true }));
  return <div className={cn('rounded-xl border border-border', depth === 0 ? 'bg-card' : 'bg-background')}>
    <div className="flex flex-wrap items-center gap-2 px-3 py-2.5">
      <button type="button" onClick={() => setOpen((v) => !v)} aria-expanded={open} className="flex min-w-0 flex-1 items-center gap-2 text-left" data-testid={`button-ai-tree-${node.level}-${node.label}`}>
        <ChevronRight size={14} className={cn('shrink-0 text-primary transition-transform', open && 'rotate-90')} />
        <span className="shrink-0 rounded bg-muted px-1.5 py-0.5 text-[9px] font-extrabold uppercase tracking-wide text-muted-foreground">{node.level}</span>
        <span className={cn('truncate text-xs', depth < 2 ? 'font-extrabold' : 'font-bold')}>{node.label}</span>
      </button>
      <span className="text-[11px] text-muted-foreground">{node.rows.length} question{node.rows.length === 1 ? '' : 's'}</span>
      {drafts > 0 && <span className="rounded-full bg-accent/15 px-2 py-0.5 text-[10px] font-bold text-accent-text">{drafts} draft{drafts === 1 ? '' : 's'}</span>}
      <PublishButton rows={node.rows} label={node.label} />
    </div>
    {open && <div className="space-y-2 border-t border-border p-3">
      {isTopic ? node.rows.map((r) => <McqTreeRow key={r.id} mcq={r} />) : children.map((c) => <TreeNode key={c.key} node={c} depth={depth + 1} defaultOpen={false} />)}
    </div>}
  </div>;
}

export function AiMcqReviewPanel() {
  const treeQ = useQuery({ queryKey: ['admin-mcqs-tree'], queryFn: mcqAdminApi.list });
  const [state, setState] = useState<'all' | 'draft' | 'published'>('all');
  const [open, setOpen] = useState(false);
  const aiRows = (treeQ.data ?? []).filter((r) => r.source === STUDENT_AI_SOURCE && r.examId === null && r.pastPaperId === null);
  const shown = aiRows.filter((r) => state === 'all' || (state === 'draft') === isDraft(r));
  const topicCount = new Set(aiRows.filter((r) => r.topicId != null).map((r) => r.topicId)).size;
  const drafts = aiRows.filter(isDraft).length;
  const root = buildTree(shown);
  const top = [...root.children.values()].sort((a, b) => a.label.localeCompare(b.label, undefined, { numeric: true }));

  return <div className="mb-6 rounded-3xl border border-primary/30 bg-primary/5" data-testid="panel-ai-mcq-review">
    <button type="button" onClick={() => setOpen((v) => !v)} aria-expanded={open} className="flex w-full items-center gap-3 px-5 py-4 text-left" data-testid="button-toggle-ai-review">
      <span className="grid size-10 shrink-0 place-items-center rounded-xl bg-primary text-primary-foreground"><Bot size={18} /></span>
      <span className="min-w-0 flex-1">
        <span className="block text-sm font-extrabold">AI MCQ Maker: questions saved to the bank</span>
        <span className="block text-xs text-muted-foreground">Filed automatically under Program / Year &gt; Block &gt; Module &gt; Subject &gt; Topic. Review the drafts before students see them.</span>
      </span>
      {drafts > 0 && <span className="rounded-full bg-accent/15 px-2.5 py-1 text-[11px] font-bold text-accent-text">{drafts} to review</span>}
      <ChevronRight size={16} className={cn('shrink-0 text-primary transition-transform', open && 'rotate-90')} />
    </button>
    {open && <div className="border-t border-primary/20 p-5">
      <StatTiles items={[
        { label: 'AI-made questions', value: aiRows.length.toLocaleString(), icon: Bot, tone: 'blue', testId: 'stat-ai-mcq-total' },
        { label: 'Drafts to review', value: drafts.toLocaleString(), icon: FileText, tone: drafts ? 'amber' : 'neutral', hint: 'Hidden from students until published', testId: 'stat-ai-mcq-drafts' },
        { label: 'Published', value: (aiRows.length - drafts).toLocaleString(), icon: CheckCircle2, tone: 'green', testId: 'stat-ai-mcq-published' },
        { label: 'Topics covered', value: topicCount.toLocaleString(), icon: FolderTree, tone: 'violet', testId: 'stat-ai-mcq-topics' },
      ]} />
      <div className="mb-3 flex flex-wrap items-center gap-1.5">
        {(['all', 'draft', 'published'] as const).map((k) => <Chip key={k} active={state === k} onClick={() => setState(k)} testId={`chip-ai-review-${k}`}><span className="capitalize">{k === 'all' ? `All (${aiRows.length})` : k}</span></Chip>)}
        <span className="ml-auto inline-flex items-center gap-1 text-[11px] text-muted-foreground"><Layers size={12} /> Open a level to see what the AI filed under it</span>
      </div>
      {treeQ.isLoading ? <p className="text-xs text-muted-foreground">Loading…</p>
        : !top.length ? <p className="rounded-2xl border border-dashed border-border bg-card p-6 text-center text-xs text-muted-foreground" data-testid="text-ai-review-empty">{aiRows.length ? 'No questions match this filter.' : 'Nothing here yet. Questions appear as students use the AI MCQ Maker (Settings > Student features controls saving and auto-publishing).'}</p>
        : <div className="space-y-2.5">{top.map((n) => <TreeNode key={n.key} node={n} depth={0} defaultOpen={top.length === 1} />)}</div>}
    </div>}
  </div>;
}
