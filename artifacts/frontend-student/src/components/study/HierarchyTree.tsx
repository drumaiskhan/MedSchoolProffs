// v91 — one shared Block > Module > Subject > Topic tree for every review tool
// (Flagged questions, Notes, Saved sessions, Mistakes). Each group has its own
// "Practice" button so a student can attempt just that block/module/subject/topic.
import { useState, type ReactNode } from 'react';
import { Link } from 'wouter';
import { ChevronRight, Play } from 'lucide-react';
import { cn } from '@/lib/shared';

/** Where an item sits in the curriculum. Any level may be missing (older data). */
export interface Placement {
  blockName?: string | null; moduleName?: string | null; subjectName?: string | null; topicName?: string | null;
  blockOrder?: number | null; moduleOrder?: number | null; subjectOrder?: number | null; topicOrder?: number | null;
}

/** Link that opens Practice on exactly these questions (capped, de-duplicated). */
export const MAX_PRACTICE_IDS = 50;
export const practiceIdsHref = (ids: number[]) => {
  const unique = [...new Set(ids.filter((n) => Number.isInteger(n) && n > 0))].slice(0, MAX_PRACTICE_IDS);
  return unique.length ? `/practice?set=ids&ids=${unique.join(',')}` : null;
};

type Node<T> = { key: string; label: string; level: 0 | 1 | 2 | 3; order: number; items: T[]; children: Map<string, Node<T>> };
const FALLBACK = ['Unassigned block', 'Unassigned module', 'General', 'General'] as const;
const sortNodes = <T,>(m: Map<string, Node<T>>) => [...m.values()].sort((a, b) => a.order - b.order || a.label.localeCompare(b.label, undefined, { numeric: true }));

interface Props<T> {
  items: T[];
  /** Curriculum placement of an item, or null when it has none at all (e.g. a note not linked to a question). */
  place: (item: T) => Placement | null;
  /** Question ids an item stands for — drives each group's Practice button. Omit to hide the buttons. */
  mcqIds?: (item: T) => number[];
  renderItem: (item: T) => ReactNode;
  /** While searching, every group is shown open. */
  expandAll?: boolean;
  /** Heading for items with no placement. */
  ungroupedLabel?: string;
  unit?: string; // e.g. "question"
  testIdPrefix?: string;
}

export function HierarchyTree<T>({ items, place, mcqIds, renderItem, expandAll, ungroupedLabel = 'Not linked to a topic', unit = 'item', testIdPrefix = 'tree' }: Props<T>) {
  const roots = new Map<string, Node<T>>();
  const ungrouped: T[] = [];
  const keysByLevel: string[][] = [[], [], [], []];
  for (const item of items) {
    const p = place(item);
    if (!p) { ungrouped.push(item); continue; }
    const names = [p.blockName, p.moduleName, p.subjectName, p.topicName];
    const orders = [p.blockOrder, p.moduleOrder, p.subjectOrder, p.topicOrder];
    let level = roots; let path = '';
    for (let i = 0; i < 4; i++) {
      const label = names[i] || FALLBACK[i];
      path += `/${i}:${label}`;
      let node = level.get(path);
      if (!node) { node = { key: path, label, level: i as 0 | 1 | 2 | 3, order: orders[i] ?? 1e9, items: [], children: new Map() }; level.set(path, node); keysByLevel[i].push(path); }
      node.items.push(item);
      level = node.children;
    }
  }
  const tree = sortNodes(roots);
  const allGroupKeys = keysByLevel.slice(0, 3).flat(); // topics hold the cards directly, but are not collapsible
  // Everything starts collapsed, except a lone chain: while a level has exactly one node, that node starts open.
  const defaultCollapsed = () => {
    const set = new Set(allGroupKeys);
    let level = tree;
    while (level.length === 1) { set.delete(level[0].key); level = sortNodes(level[0].children); }
    return set;
  };
  const [collapsed, setCollapsed] = useState<Set<string>>(new Set());
  const [touched, setTouched] = useState(false);
  const isOpen = (key: string) => expandAll || !(touched ? collapsed : defaultCollapsed()).has(key);
  const toggle = (key: string) => { const base = new Set(touched ? collapsed : defaultCollapsed()); if (base.has(key)) base.delete(key); else base.add(key); setTouched(true); setCollapsed(base); };
  const setAll = (keys: string[]) => { setTouched(true); setCollapsed(new Set(keys)); };

  const practiceLink = (group: T[], tid: string) => {
    if (!mcqIds) return null;
    const href = practiceIdsHref(group.flatMap(mcqIds));
    return href ? <Link href={href} onClick={(e) => e.stopPropagation()} className="inline-flex shrink-0 items-center gap-1 rounded-lg bg-primary px-2.5 py-1 text-[10px] font-extrabold text-primary-foreground transition-transform active:scale-95" data-testid={`${testIdPrefix}-practice-${tid}`}><Play size={10} />Practice</Link> : null;
  };

  const renderNode = (n: Node<T>): ReactNode => {
    if (n.level === 3) return <div key={n.key} data-testid={`${testIdPrefix}-topic-${n.key}`}>
      <div className="mb-2 flex items-center gap-1.5">
        <p className="flex min-w-0 flex-1 items-center gap-1.5 text-[11px] font-extrabold uppercase tracking-wide text-muted-foreground"><span className="h-1.5 w-1.5 shrink-0 rounded-full bg-primary" /><span className="truncate">{n.label}</span><span className="font-bold normal-case">({n.items.length})</span></p>
        {practiceLink(n.items, n.key)}
      </div>
      <div className="space-y-3">{n.items.map((it, i) => <div key={i}>{renderItem(it)}</div>)}</div>
    </div>;
    const open = isOpen(n.key);
    const styles = [
      { wrap: 'overflow-hidden rounded-2xl border border-border bg-card', head: 'bg-muted/40 px-4 py-3 hover:bg-muted/70', text: 'text-sm', icon: 16, badge: 'bg-primary/15 text-primary text-[11px]', body: 'space-y-2 p-3' },
      { wrap: 'rounded-xl border border-border', head: 'px-3 py-2.5', text: 'text-[13px]', icon: 14, badge: 'bg-primary/10 text-primary text-[10px]', body: 'space-y-2 border-t border-border p-3' },
      { wrap: 'rounded-lg border border-border', head: 'px-3 py-2', text: 'text-xs', icon: 13, badge: 'bg-muted text-muted-foreground text-[10px]', body: 'space-y-3 border-t border-border p-3' },
    ][n.level];
    return <section key={n.key} className={styles.wrap} data-testid={`${testIdPrefix}-${['block', 'module', 'subject'][n.level]}-${n.key}`}>
      <div className={cn('flex items-center gap-2 transition-colors', styles.head)}>
        <button onClick={() => toggle(n.key)} aria-expanded={open} className="flex min-w-0 flex-1 items-center gap-2 text-left">
          <ChevronRight size={styles.icon} className={cn('shrink-0 text-primary transition-transform', open && 'rotate-90')} />
          <span className={cn('min-w-0 flex-1 truncate font-extrabold', styles.text)}>{n.label}</span>
          <span className={cn('shrink-0 rounded-full px-2 py-0.5 font-extrabold', styles.badge)}>{n.items.length}</span>
        </button>
        {practiceLink(n.items, n.key)}
      </div>
      {open && <div className={styles.body}>{sortNodes(n.children).map(renderNode)}</div>}
    </section>;
  };

  if (!items.length) return null;
  return <div className="space-y-3">
    {tree.length > 0 && <div className="flex items-center justify-between gap-2 text-[11px] font-bold text-muted-foreground">
      <span data-testid={`${testIdPrefix}-count`}>{items.length} {unit}{items.length === 1 ? '' : 's'} · {tree.length} block{tree.length === 1 ? '' : 's'}</span>
      <span className="flex gap-3"><button onClick={() => setAll([])} className="text-primary underline-offset-2 hover:underline" data-testid={`${testIdPrefix}-expand-all`}>Expand all</button><button onClick={() => setAll(allGroupKeys)} className="text-primary underline-offset-2 hover:underline" data-testid={`${testIdPrefix}-collapse-all`}>Collapse all</button></span>
    </div>}
    {tree.map(renderNode)}
    {ungrouped.length > 0 && <section className="rounded-2xl border border-border bg-card p-3" data-testid={`${testIdPrefix}-ungrouped`}>
      <p className="mb-2 px-1 text-[11px] font-extrabold uppercase tracking-wide text-muted-foreground">{ungroupedLabel} <span className="font-bold normal-case">({ungrouped.length})</span></p>
      <div className="space-y-3">{ungrouped.map((it, i) => <div key={i}>{renderItem(it)}</div>)}</div>
    </section>}
  </div>;
}
