import { useState } from 'react';
import { useMutation, useQuery } from '@tanstack/react-query';
import { AlertTriangle, Download, Loader2, Upload } from 'lucide-react';
import { toast } from '@/hooks/use-toast';
import { ApiRequestError, mcqBackupApi, type AdminBlock, type AdminModule, type BackupScope, type McqRestoreMode, type McqRestoreResult } from '@/lib/api';
import { BackupScopePicker, ConfirmDialog, cn } from '@/lib/shared';

// Export / import for the MCQ bank. The export is a structure backup, not just
// a list of questions: it carries the Block > Module > Subject > Topic tree the
// questions live in (plus past papers and exams), the same idea as the Database
// backup page, but narrowed to what you pick — the whole bank, one program
// (MBBS / BDS), one year of a program, or any single branch. Importing rebuilds
// whatever structure is missing and puts the questions back into it.

const MODES: Array<{ value: McqRestoreMode; label: string; hint: string }> = [
  { value: 'merge', label: 'Add what is missing (recommended)', hint: 'Rebuilds any missing structure and adds only the questions that are not already in the bank. Safe to run twice.' },
  { value: 'append', label: 'Add everything again', hint: 'Rebuilds missing structure and adds every question in the file, even ones already in the bank (creates duplicates).' },
  { value: 'replace', label: 'Replace this backup\u2019s scope', hint: 'Deletes the existing questions the backup covers (and their practice/exam history), then restores the file\u2019s. Everything outside that scope is untouched.' },
];

const plural = (n: number, word: string) => `${n} ${word}${n === 1 ? '' : 's'}`;
const NODE_WORDS: Array<[keyof NonNullable<McqRestoreResult['structure']>, string]> = [
  ['blocks', 'block'], ['modules', 'module'], ['subjects', 'subject'], ['topics', 'topic'], ['pastPapers', 'past paper'], ['exams', 'exam'],
];
function createdSummary(structure: McqRestoreResult['structure']): string {
  if (!structure) return '';
  return NODE_WORDS.filter(([k]) => structure[k].created > 0).map(([k, w]) => plural(structure[k].created, w)).join(', ');
}
function reusedSummary(structure: McqRestoreResult['structure']): string {
  if (!structure) return '';
  return NODE_WORDS.filter(([k]) => structure[k].reused > 0).map(([k, w]) => plural(structure[k].reused, w)).join(', ');
}

function PreviewCard({ preview, mode }: { preview: McqRestoreResult; mode: McqRestoreMode }) {
  const q = preview.questions;
  const created = createdSummary(preview.structure);
  const reused = reusedSummary(preview.structure);
  return (
    <div className="mt-3 space-y-1.5 rounded-xl border border-border bg-muted/40 p-3 text-[11px] leading-5 animate-in fade-in duration-200" data-testid="backup-preview">
      <p className="font-bold text-foreground">
        {preview.scope ? <>Backup of <span className="text-primary">{preview.scope.label}</span></> : 'Whole-bank backup'}
        {preview.legacy && <span className="ml-1.5 rounded bg-accent/20 px-1.5 py-0.5 text-[10px] font-semibold text-accent-text">older format · no structure</span>}
      </p>
      {q && !preview.legacy && <p className="text-muted-foreground"><span className="font-semibold text-foreground">{plural(q.restored, 'question')}</span> will be added{q.skippedExisting ? <>; <span className="font-semibold text-foreground">{q.skippedExisting}</span> already in the bank will be skipped</> : null} ({q.inBackup} in the file).</p>}
      {preview.legacy && <p className="text-muted-foreground"><span className="font-semibold text-foreground">{plural(preview.questions?.restored ?? 0, 'question')}</span> will be added.</p>}
      {!preview.legacy && <p className="text-muted-foreground">Structure: {created ? <>creates <span className="font-semibold text-foreground">{created}</span></> : 'nothing new to create'}{reused ? <>; reuses {reused} that already exist</> : null}.</p>}
      {!preview.legacy && (preview.examLinks ?? 0) > 0 && <p className="text-muted-foreground">{plural(preview.examLinks!, 'exam question link')} will be restored. Restored exams come back as drafts.</p>}
      {mode === 'replace' && <p className="flex items-start gap-1.5 font-semibold text-destructive"><AlertTriangle size={12} className="mt-1 shrink-0" /> {plural(preview.deletedFirst, 'existing question')} will be permanently deleted first, with their practice and exam history. This can{'\u2019'}t be undone.</p>}
      {(q?.skippedMissingLink ?? 0) > 0 && <p className="text-accent-text">{plural(q!.skippedMissingLink!, 'question')} point at a past paper or exam that is not in the file and will be skipped.</p>}
      {(preview.warnings ?? []).map((w) => <p key={w} className="text-accent-text">{w}</p>)}
    </div>
  );
}

export function McqBackupPanel({ blocks, allModules, onRestored }: { blocks: AdminBlock[]; allModules: AdminModule[]; onRestored: () => void }) {
  // ---- export ----------------------------------------------------------------
  const [scope, setScope] = useState<BackupScope | null>(null);
  const download = useMutation({
    mutationFn: () => mcqBackupApi.downloadBackup(scope),
    onSuccess: ({ filename, counts }) => {
      const parts = counts ? [plural(counts.questions, 'question'), counts.blocks ? plural(counts.blocks, 'block') : '', counts.modules ? plural(counts.modules, 'module') : '', counts.subjects ? plural(counts.subjects, 'subject') : '', counts.topics ? plural(counts.topics, 'topic') : '', counts.pastPapers ? plural(counts.pastPapers, 'past paper') : '', counts.exams ? plural(counts.exams, 'exam') : ''].filter(Boolean).join(' · ') : filename;
      toast({ title: 'Backup downloaded', description: parts });
    },
    onError: (err: unknown) => toast({ title: 'Could not download backup', description: err instanceof ApiRequestError ? err.message : 'Something went wrong.', variant: 'destructive' }),
  });

  // ---- import ----------------------------------------------------------------
  const [file, setFile] = useState<File | null>(null);
  const [fileKey, setFileKey] = useState(0); // remounts the <input> so the same file can be picked again
  const [mode, setMode] = useState<McqRestoreMode>('merge');
  const [confirmOpen, setConfirmOpen] = useState(false);

  // Dry run whenever the file or the mode changes — shows exactly what the
  // import will do before anything is written.
  const preview = useQuery({
    queryKey: ['mcq-backup-preview', file?.name, file?.size, file?.lastModified, mode],
    queryFn: () => mcqBackupApi.previewBackup(file!, mode),
    enabled: !!file,
    retry: false,
    staleTime: Infinity,
    gcTime: 0,
  });

  const restore = useMutation({
    mutationFn: () => mcqBackupApi.importBackup(file!, mode),
    onSuccess: (res) => {
      onRestored();
      setFile(null); setFileKey((k) => k + 1); setConfirmOpen(false);
      const restored = res.questions?.restored ?? res.restored ?? 0;
      const where = res.scope ? ` (${res.scope.label})` : '';
      const bits: string[] = [];
      const created = createdSummary(res.structure);
      if (created) bits.push(`Created ${created}.`);
      if (res.questions?.skippedExisting) bits.push(`${plural(res.questions.skippedExisting, 'question')} already existed.`);
      if (res.mode === 'replace') bits.push(`Replaced ${res.scope ? 'that scope' : 'the whole bank'} (${plural(res.deletedFirst, 'old question')} removed first).`);
      if (res.questions?.skippedMissingLink) bits.push(`${plural(res.questions.skippedMissingLink, 'question')} skipped (missing past paper/exam).`);
      toast({ title: `Restored ${plural(restored, 'question')}${where}`, description: bits.join(' ') || 'Added to the bank.' });
    },
    onError: (err: unknown) => { setConfirmOpen(false); toast({ title: 'Restore failed — nothing was changed', description: err instanceof ApiRequestError ? err.message : 'Something went wrong.', variant: 'destructive' }); },
  });

  const previewError = preview.error instanceof ApiRequestError ? preview.error.message : preview.error ? 'Could not read this file.' : null;
  const canImport = !!file && !!preview.data && !preview.isFetching && !restore.isPending;
  const modeInfo = MODES.find((m) => m.value === mode)!;

  return (
    <div className="mt-4 space-y-4 rounded-2xl border border-border bg-card p-5 animate-in fade-in slide-in-from-top-2 duration-300">
      {/* ------------------------------ Export ------------------------------ */}
      <div>
        <p className="text-xs font-bold">Export backup</p>
        <p className="mt-1 text-[11px] text-muted-foreground">
          Downloads one JSON file with the questions <span className="font-semibold text-foreground">and the structure around them</span> — blocks, modules, subjects, topics, past papers and exams — with every field (explanations, hints, difficulty, tags) intact. Choose the whole bank, a whole program (MBBS or BDS), one year of a program, or any single branch.
        </p>
        <div className="mt-3"><BackupScopePicker blocks={blocks} allModules={allModules} onChange={setScope} /></div>
        <p className="mt-2 text-[11px] text-muted-foreground">
          {scope ? <>Exporting <span className="font-semibold text-foreground">{scope.label}</span> with its full structure.</> : 'Exporting the whole bank — every program and year, past papers and exams included.'}
        </p>
        <button disabled={download.isPending} onClick={() => download.mutate()} className="mt-3 inline-flex items-center gap-1.5 rounded-xl bg-primary px-4 py-2 text-xs font-extrabold text-primary-foreground transition-transform hover:scale-[1.03] active:scale-95 disabled:opacity-50 disabled:hover:scale-100" data-testid="button-download-backup">
          {download.isPending ? <Loader2 size={13} className="animate-spin" /> : <Download size={13} />} {download.isPending ? 'Preparing…' : 'Export backup'}
        </button>
      </div>

      {/* ------------------------------ Import ------------------------------ */}
      <div className="border-t border-border pt-4">
        <p className="text-xs font-bold">Import backup</p>
        <p className="mt-1 text-[11px] text-muted-foreground">
          Restore a file made by Export. Missing blocks, modules, subjects and topics are rebuilt automatically and every question goes back into its own place — even into a database where the ids are different. Existing structure with the same names is reused, not copied.
        </p>
        <div className="mt-3 flex flex-wrap items-center gap-3">
          <input key={fileKey} type="file" accept=".json,application/json" onChange={(e) => setFile(e.target.files?.[0] ?? null)} className="min-w-[12rem] flex-1 rounded-xl border border-dashed border-border bg-background px-3 py-2.5 text-xs transition-colors focus-within:border-primary" data-testid="input-backup-file" />
          <select value={mode} onChange={(e) => setMode(e.target.value as McqRestoreMode)} className="h-10 rounded-xl border border-border bg-background px-3 text-xs transition-colors focus:border-primary" data-testid="select-backup-mode">
            {MODES.map((m) => <option key={m.value} value={m.value}>{m.label}</option>)}
          </select>
          <button disabled={!canImport} onClick={() => setConfirmOpen(true)} className="inline-flex items-center gap-1.5 rounded-xl bg-primary px-5 py-2.5 text-xs font-extrabold text-primary-foreground transition-transform hover:scale-[1.03] active:scale-95 disabled:opacity-50 disabled:hover:scale-100" data-testid="button-restore-backup">
            {restore.isPending ? <Loader2 size={13} className="animate-spin" /> : <Upload size={13} />} {restore.isPending ? 'Restoring…' : 'Import backup'}
          </button>
        </div>
        <p className={cn('mt-2 text-[11px]', mode === 'replace' ? 'font-semibold text-destructive' : 'text-muted-foreground')}>{modeInfo.hint}</p>
        {file && preview.isFetching && <p className="mt-3 inline-flex items-center gap-1.5 text-[11px] text-muted-foreground"><Loader2 size={12} className="animate-spin" /> Checking <span className="font-semibold text-foreground">{file.name}</span>…</p>}
        {file && previewError && <p className="mt-3 text-[11px] font-semibold text-destructive" data-testid="backup-preview-error">{previewError}</p>}
        {file && preview.data && !preview.isFetching && <PreviewCard preview={preview.data} mode={mode} />}
      </div>

      {confirmOpen && preview.data && (
        <ConfirmDialog
          title={mode === 'replace' ? 'Replace with this backup?' : 'Import this backup?'}
          body={mode === 'replace'
            ? `${plural(preview.data.deletedFirst, 'existing question')} will be permanently deleted first (with practice and exam history), then ${plural(preview.data.questions?.restored ?? 0, 'question')} restored${createdSummary(preview.data.structure) ? ` and ${createdSummary(preview.data.structure)} created` : ''}. If anything fails, nothing is changed.`
            : `${plural(preview.data.questions?.restored ?? 0, 'question')} will be added${createdSummary(preview.data.structure) ? ` and ${createdSummary(preview.data.structure)} created` : ''}. If anything fails, nothing is changed.`}
          confirmLabel={mode === 'replace' ? 'Delete and restore' : 'Import'}
          pendingLabel="Restoring…"
          tone={mode === 'replace' ? 'destructive' : 'primary'}
          onCancel={() => setConfirmOpen(false)}
          onConfirm={() => restore.mutate()}
          pending={restore.isPending}
        />
      )}
    </div>
  );
}
