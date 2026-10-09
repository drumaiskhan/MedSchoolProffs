// Settings → Access → "Achievements & ranks". Lets an admin change the targets
// students see on Profile → Achievements and the rank steps on the profile hero,
// without a deploy. Saved as one JSON string (ACHIEVEMENT_CONFIG) in the
// existing platform-settings store; only values that differ from the shipped
// defaults are stored, so blank = "use the defaults".
//
// The DEFAULTS below mirror DEFAULT_ACHIEVEMENT_CONFIG in
// frontend-student/src/lib/progressAchievements.ts — they only decide what is
// shown as the placeholder / "reset" value here; the student app falls back to
// its own copy when a field isn't overridden. Keep the two in step.
import { useEffect, useState } from 'react';
import { Plus, RotateCcw, Trash2, Trophy } from 'lucide-react';
import { Button, Callout, Field, Panel, SubSection, TextInput } from '@/lib/admin-ui';

type Rank = { name: string; at: number };
type Overrides = { thresholds?: Record<string, number[]>; minAccuracyQuestions?: number; masteryAccuracy?: number; masteryMinAnswered?: number; ranks?: Rank[] };

const FAMILIES: Array<{ group: string; id: string; label: string; unit: string; defaults: number[] }> = [
  { group: 'Practice', id: 'pr-questions', label: 'Questions answered', unit: 'questions', defaults: [50, 200, 500, 1000, 2500] },
  { group: 'Practice', id: 'pr-unique', label: 'Different questions tried', unit: 'questions', defaults: [25, 100, 300, 750] },
  { group: 'Practice', id: 'pr-sessions', label: 'Practice sessions', unit: 'sessions', defaults: [1, 10, 25, 50, 100] },
  { group: 'Practice', id: 'pr-time', label: 'Time studied', unit: 'minutes', defaults: [60, 300, 600, 1500] },
  { group: 'Practice', id: 'pr-perfect', label: 'Flawless (100%) sessions', unit: 'sessions', defaults: [1, 3, 5] },
  { group: 'Streaks', id: 'pr-streak', label: 'Current streak', unit: 'days', defaults: [3, 7, 14, 30, 60] },
  { group: 'Streaks', id: 'pr-beststreak', label: 'Best streak', unit: 'days', defaults: [7, 14, 30, 60, 100] },
  { group: 'Streaks', id: 'pr-active30', label: 'Active days in last 30', unit: 'days', defaults: [5, 10, 20, 30] },
  { group: 'Mastery', id: 'pr-accuracy', label: 'Overall accuracy', unit: '%', defaults: [70, 80, 90] },
  { group: 'Mastery', id: 'pr-subjects', label: 'Subjects mastered', unit: 'subjects', defaults: [1, 3, 5, 8] },
  { group: 'Milestones', id: 'pr-papers', label: 'Past papers started', unit: 'papers', defaults: [1, 3, 5, 10] },
  { group: 'Milestones', id: 'pr-papers-done', label: 'Past papers completed', unit: 'papers', defaults: [1, 3, 5] },
  { group: 'Milestones', id: 'pr-exams', label: 'Pre-Proffs attempts', unit: 'exams', defaults: [1, 3, 5] },
  { group: 'Milestones', id: 'pr-exams-passed', label: 'Pre-Proffs passed', unit: 'exams', defaults: [1, 3] },
];
const DEFAULT_RANKS: Rank[] = [{ name: 'Intern', at: 0 }, { name: 'Resident', at: 3 }, { name: 'Fellow', at: 8 }, { name: 'Registrar', at: 16 }, { name: 'Consultant', at: 28 }, { name: 'Professor', at: 42 }];
const DEFAULT_GATES = { minAccuracyQuestions: 20, masteryAccuracy: 80, masteryMinAnswered: 5 };
const MAX_TIERS = 5;

const same = (a: number[], b: number[]) => a.length === b.length && a.every((v, i) => v === b[i]);
const parseLadder = (text: string): number[] => Array.from(new Set(text.split(/[,\s]+/).map(Number).filter((n) => Number.isFinite(n) && n > 0))).sort((a, b) => a - b).slice(0, MAX_TIERS);

function parseOverrides(raw: string): Overrides {
  try { const v = raw ? JSON.parse(raw) : {}; return v && typeof v === 'object' && !Array.isArray(v) ? v : {}; } catch { return {}; }
}
function serialize(o: Overrides): string {
  const clean: Overrides = {};
  if (o.thresholds && Object.keys(o.thresholds).length) clean.thresholds = o.thresholds;
  (['minAccuracyQuestions', 'masteryAccuracy', 'masteryMinAnswered'] as const).forEach((k) => { if (o[k] != null && o[k] !== DEFAULT_GATES[k]) clean[k] = o[k]; });
  if (o.ranks && !(o.ranks.length === DEFAULT_RANKS.length && o.ranks.every((r, i) => r.name === DEFAULT_RANKS[i].name && r.at === DEFAULT_RANKS[i].at))) clean.ranks = o.ranks;
  return Object.keys(clean).length ? JSON.stringify(clean) : '';
}

/** Comma-separated ladder, committed on blur / Enter so typing never fights the cursor. */
function LadderInput({ value, defaults, onCommit }: { value: number[]; defaults: number[]; onCommit: (v: number[]) => void }) {
  const [text, setText] = useState(value.join(', '));
  useEffect(() => { setText(value.join(', ')); }, [value.join(',')]); // eslint-disable-line react-hooks/exhaustive-deps
  const commit = () => { const p = parseLadder(text); onCommit(p.length ? p : defaults); setText((p.length ? p : defaults).join(', ')); };
  return <TextInput value={text} inputMode="numeric" placeholder={defaults.join(', ')} onChange={(e) => setText(e.target.value)} onBlur={commit} onKeyDown={(e) => { if (e.key === 'Enter') { e.preventDefault(); commit(); } }} />;
}

export function AchievementConfigPanel({ value, onChange }: { value: string; onChange: (json: string) => void }) {
  const o = parseOverrides(value);
  const ladder = (id: string, def: number[]) => (Array.isArray(o.thresholds?.[id]) ? (o.thresholds![id] as number[]) : def);
  const ranks = Array.isArray(o.ranks) && o.ranks.length ? o.ranks : DEFAULT_RANKS;
  const gate = (k: keyof typeof DEFAULT_GATES) => (typeof o[k] === 'number' ? (o[k] as number) : DEFAULT_GATES[k]);
  const update = (patch: Overrides) => onChange(serialize({ ...o, ...patch }));
  const setLadder = (id: string, def: number[], v: number[]) => {
    const t = { ...(o.thresholds ?? {}) };
    if (same(v, def)) delete t[id]; else t[id] = v;
    update({ thresholds: t });
  };
  const setRanks = (r: Rank[]) => update({ ranks: r });
  const groups = Array.from(new Set(FAMILIES.map((f) => f.group)));

  return <Panel icon={Trophy} title="Achievements & ranks" testId="panel-achievement-config"
    description="Set the targets students work toward on Profile → Achievements, and the rank steps on their profile. Leave a field on its default to keep the built-in value."
    action={value ? <Button size="sm" variant="ghost" icon={RotateCcw} onClick={() => onChange('')} data-testid="button-reset-achievements">Reset all to defaults</Button> : undefined}>
    {groups.map((g) => <SubSection key={g} title={g} description={g === 'Practice' ? 'Up to five targets per badge, lowest first — they map to Bronze, Silver, Gold, Platinum and Legend.' : undefined}>
      <div className="grid gap-4 sm:grid-cols-2">
        {FAMILIES.filter((f) => f.group === g).map((f) => <Field key={f.id} label={<>{f.label} <span className="font-normal text-muted-foreground">({f.unit})</span></>} hint={`Default: ${f.defaults.join(', ')}`}>
          <LadderInput value={ladder(f.id, f.defaults)} defaults={f.defaults} onCommit={(v) => setLadder(f.id, f.defaults, v)} />
        </Field>)}
      </div>
    </SubSection>)}

    <SubSection title="Fairness gates" description="Stops a lucky first few answers from unlocking accuracy and mastery badges.">
      <div className="grid gap-4 sm:grid-cols-3">
        <Field label="Questions before accuracy counts" hint={`Default: ${DEFAULT_GATES.minAccuracyQuestions}`}><TextInput type="number" min={0} value={gate('minAccuracyQuestions')} onChange={(e) => update({ minAccuracyQuestions: Math.max(0, Math.round(Number(e.target.value) || 0)) })} /></Field>
        <Field label="Mastery accuracy (%)" hint={`Default: ${DEFAULT_GATES.masteryAccuracy}`}><TextInput type="number" min={1} max={100} value={gate('masteryAccuracy')} onChange={(e) => update({ masteryAccuracy: Math.min(100, Math.max(1, Math.round(Number(e.target.value) || 1))) })} /></Field>
        <Field label="Questions per mastered subject" hint={`Default: ${DEFAULT_GATES.masteryMinAnswered}`}><TextInput type="number" min={1} value={gate('masteryMinAnswered')} onChange={(e) => update({ masteryMinAnswered: Math.max(1, Math.round(Number(e.target.value) || 1)) })} /></Field>
      </div>
    </SubSection>

    <SubSection title="Profile ranks" description="A student's rank rises with the number of badges they've unlocked. The first rank always starts at 0 badges; two to ten ranks.">
      <div className="space-y-2.5">
        {ranks.map((r, i) => <div key={i} className="flex items-center gap-2.5">
          <span className="grid size-8 shrink-0 place-items-center rounded-lg bg-muted text-[11px] font-extrabold text-muted-foreground">{i + 1}</span>
          <TextInput className="flex-1" aria-label={`Rank ${i + 1} name`} value={r.name} maxLength={24} onChange={(e) => setRanks(ranks.map((x, j) => (j === i ? { ...x, name: e.target.value } : x)))} />
          <TextInput className="w-28" type="number" min={0} aria-label={`Badges needed for rank ${i + 1}`} disabled={i === 0} value={r.at} onChange={(e) => setRanks(ranks.map((x, j) => (j === i ? { ...x, at: Math.max(0, Math.round(Number(e.target.value) || 0)) } : x)))} />
          <span className="w-12 text-[11px] text-muted-foreground">badges</span>
          <Button size="sm" variant="ghost" icon={Trash2} aria-label={`Remove rank ${i + 1}`} disabled={i === 0 || ranks.length <= 2} onClick={() => setRanks(ranks.filter((_, j) => j !== i))} />
        </div>)}
      </div>
      <div className="mt-3"><Button size="sm" icon={Plus} disabled={ranks.length >= 10} onClick={() => setRanks([...ranks, { name: 'New rank', at: (ranks[ranks.length - 1]?.at ?? 0) + 5 }])}>Add rank</Button></div>
    </SubSection>
    <div className="mt-6"><Callout tone="info">Changing a target changes which badges count as unlocked for every student immediately. A badge whose target changes may show a fresh "unlocked" notification once.</Callout></div>
  </Panel>;
}
