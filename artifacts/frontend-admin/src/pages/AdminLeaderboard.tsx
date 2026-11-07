// Admin leaderboard editor — add/remove points or move a student up/down in
// rank. Adjustments are stored as a signed points offset on top of earned
// points (see routes/admin-leaderboard.ts), so they show on the student
// leaderboard immediately and can be reset at any time.
import { useState } from 'react';
import { useMutation, useQuery } from '@tanstack/react-query';
import { ArrowUp, ArrowDown, Plus, Minus, RotateCcw, Search, Trophy } from 'lucide-react';
import { SectionHeader, EmptyState, Badge, cn } from '@/lib/shared';
import { leaderboardAdminApi, ApiRequestError, type AdminLeaderboardRow } from '@/lib/api';
import { toast } from '@/hooks/use-toast';
import { queryClient } from '@/lib/query-client';

const RANGES: Array<[string, string]> = [['7d', '7 days'], ['30d', '30 days'], ['3m', '3 months'], ['1y', '1 year']];

function LeaderboardRowEditor({ row, range, onChanged }: { row: AdminLeaderboardRow; range: string; onChanged: (r: AdminLeaderboardRow) => void }) {
  const [amount, setAmount] = useState('10');
  const [places, setPlaces] = useState('1');
  const [exactRank, setExactRank] = useState('');
  const n = Math.trunc(Number(amount));
  const p = Math.trunc(Number(places));
  const onError = (err: unknown) => toast({ title: 'Could not update leaderboard', description: err instanceof ApiRequestError ? err.message : 'Something went wrong.', variant: 'destructive' });
  const done = (verb: string) => (r: AdminLeaderboardRow) => { onChanged(r); queryClient.invalidateQueries({ queryKey: ['admin-leaderboard'] }); queryClient.invalidateQueries({ queryKey: ['leaderboard'] }); toast({ title: `${row.name} ${verb}`, description: `Now rank #${r.rank} with ${r.points} points.` }); };

  const addPoints = useMutation({ mutationFn: (sign: 1 | -1) => leaderboardAdminApi.addPoints(row.userId, sign * n, range), onSuccess: done('updated'), onError });
  const move = useMutation({ mutationFn: (dir: 'up' | 'down') => leaderboardAdminApi.move(row.userId, dir, p, range), onSuccess: done('moved'), onError });
  const setRank = useMutation({ mutationFn: () => leaderboardAdminApi.setRank(row.userId, Math.trunc(Number(exactRank)), range), onSuccess: done('moved'), onError });
  const reset = useMutation({ mutationFn: () => leaderboardAdminApi.reset(row.userId, range), onSuccess: done('reset'), onError });
  const busy = addPoints.isPending || move.isPending || setRank.isPending || reset.isPending;
  const amountOk = Number.isFinite(n) && n > 0;
  const placesOk = Number.isFinite(p) && p > 0;
  const rankOk = Number.isFinite(Number(exactRank)) && Number(exactRank) >= 1 && exactRank !== '';
  const input = 'h-9 w-20 rounded-lg border border-border bg-background px-2 text-xs font-mono-app';
  const btn = 'inline-flex h-9 items-center gap-1 rounded-lg border border-border bg-background px-2.5 text-[11px] font-bold transition-colors hover:bg-muted disabled:opacity-40';

  return <div className="space-y-3 border-t border-border bg-muted/20 px-4 py-4" data-testid={`editor-leaderboard-${row.userId}`}>
    <div className="flex flex-wrap items-end gap-x-6 gap-y-3">
      <div>
        <div className="mb-1 text-[10px] font-bold uppercase tracking-wide text-muted-foreground">Points</div>
        <div className="flex items-center gap-1.5">
          <input type="number" min={1} value={amount} onChange={(e) => setAmount(e.target.value)} className={input} data-testid={`input-points-${row.userId}`} />
          <button disabled={busy || !amountOk} onClick={() => addPoints.mutate(1)} className={cn(btn, 'text-primary')} data-testid={`button-add-points-${row.userId}`}><Plus size={13} /> Add</button>
          <button disabled={busy || !amountOk} onClick={() => addPoints.mutate(-1)} className={cn(btn, 'text-destructive')} data-testid={`button-remove-points-${row.userId}`}><Minus size={13} /> Remove</button>
        </div>
      </div>
      <div>
        <div className="mb-1 text-[10px] font-bold uppercase tracking-wide text-muted-foreground">Move rank</div>
        <div className="flex items-center gap-1.5">
          <input type="number" min={1} value={places} onChange={(e) => setPlaces(e.target.value)} className={input} data-testid={`input-places-${row.userId}`} />
          <button disabled={busy || !placesOk || row.rank <= 1} onClick={() => move.mutate('up')} className={cn(btn, 'text-primary')} data-testid={`button-rank-up-${row.userId}`}><ArrowUp size={13} /> Up</button>
          <button disabled={busy || !placesOk} onClick={() => move.mutate('down')} className={cn(btn, 'text-destructive')} data-testid={`button-rank-down-${row.userId}`}><ArrowDown size={13} /> Down</button>
        </div>
      </div>
      <div>
        <div className="mb-1 text-[10px] font-bold uppercase tracking-wide text-muted-foreground">Set exact rank</div>
        <div className="flex items-center gap-1.5">
          <input type="number" min={1} placeholder="#" value={exactRank} onChange={(e) => setExactRank(e.target.value)} className={input} data-testid={`input-exact-rank-${row.userId}`} />
          <button disabled={busy || !rankOk} onClick={() => setRank.mutate()} className={btn} data-testid={`button-set-rank-${row.userId}`}>Set</button>
        </div>
      </div>
      {row.adjustment !== 0 && <button disabled={busy} onClick={() => reset.mutate()} className={btn} data-testid={`button-reset-adjustment-${row.userId}`}><RotateCcw size={13} /> Reset to earned</button>}
    </div>
    <p className="text-[10px] text-muted-foreground">Earned from practice: <b>{row.earnedPoints}</b> · Admin adjustment: <b>{row.adjustment > 0 ? `+${row.adjustment}` : row.adjustment}</b>. Moving rank adjusts points so the student lands in that spot for the selected period.</p>
  </div>;
}

function AdminLeaderboard() {
  const [range, setRange] = useState('30d');
  const [search, setSearch] = useState('');
  const [openId, setOpenId] = useState<number | null>(null);
  const q = useQuery({ queryKey: ['admin-leaderboard', range], queryFn: () => leaderboardAdminApi.list(range) });
  const rows = (q.data?.rows ?? []).filter((r) => `${r.name} ${r.email} ${r.institution ?? ''}`.toLowerCase().includes(search.toLowerCase()));

  return <div>
    <SectionHeader eyebrow="People operations" title="Leaderboard" action={<div className="flex gap-1">{RANGES.map(([v, label]) => <button key={v} onClick={() => setRange(v)} className={cn('rounded-lg px-3 py-1.5 text-[11px] font-bold', range === v ? 'bg-primary text-primary-foreground' : 'bg-muted text-muted-foreground')} data-testid={`button-lb-range-${v}`}>{label}</button>)}</div>} />
    <p className="mb-4 text-xs text-muted-foreground">Add or remove points, or move a student up or down the student leaderboard. Changes apply to every time period and show to students right away; each change is recorded in the audit log.</p>
    <div className="relative mb-4 max-w-sm"><Search size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground" /><input value={search} onChange={(e) => setSearch(e.target.value)} placeholder="Search students…" className="h-10 w-full rounded-xl border border-border bg-background pl-9 pr-3 text-xs" data-testid="input-search-leaderboard" /></div>
    {q.isLoading ? <div className="text-xs text-muted-foreground">Loading…</div> : rows.length === 0 ? <EmptyState icon={Trophy} title="No students found" body="Try a different search." /> :
      <div className="overflow-hidden rounded-2xl border border-border bg-card">
        {rows.map((r) => <div key={r.userId} className="border-b border-border last:border-b-0" data-testid={`row-leaderboard-${r.userId}`}>
          <button type="button" onClick={() => setOpenId(openId === r.userId ? null : r.userId)} className="flex w-full items-center gap-3 px-4 py-3 text-left transition-colors hover:bg-muted/30">
            <span className="w-10 shrink-0 font-display text-sm text-primary">#{r.rank}</span>
            <span className="min-w-0 flex-1"><span className="block truncate text-sm font-bold">{r.name}</span><span className="block truncate text-[10px] text-muted-foreground">{r.email}{r.institution ? ` · ${r.institution}` : ''}</span></span>
            {r.adjustment !== 0 && <Badge tone={r.adjustment > 0 ? 'green' : 'red'}>{r.adjustment > 0 ? `+${r.adjustment}` : r.adjustment} adj.</Badge>}
            <span className="w-20 shrink-0 text-right font-mono-app text-sm font-bold">{r.points}<span className="ml-1 text-[10px] font-normal text-muted-foreground">pts</span></span>
          </button>
          {openId === r.userId && <LeaderboardRowEditor row={r} range={range} onChanged={() => undefined} />}
        </div>)}
      </div>}
  </div>;
}

export default AdminLeaderboard;
