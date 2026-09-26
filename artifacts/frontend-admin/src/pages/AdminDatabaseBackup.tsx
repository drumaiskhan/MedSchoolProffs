// Admin -> Database Backup & Restore. Whole-platform JSON export/import —
// every application table (see lib/fullBackup.ts on the backend). Three
// scopes, same underlying tables: "Full Database Backup" (everything, one
// file — the migration path), "Platform content" (curriculum + settings, no
// student data), and "Student data" (accounts + activity) — the latter two
// exported separately since sharing/restoring just one of them is sometimes
// the smaller, safer move. Each card restores that same JSON back into this
// app's own PostgreSQL database. See the format notes at the bottom of this
// page.
//
// This used to also offer restoring into an admin-supplied MySQL database
// (routes/full-backup-mysql.ts on the backend, driven by
// scripts/src/mysql-restore/). That route — and its mysql2 dependency —
// has been removed from the API server entirely: MedSchoolProffs is
// PostgreSQL/Supabase-only, and having mysql2 reachable from the API's own
// dependency graph was causing it to crash on startup
// (ERR_MODULE_NOT_FOUND: mysql2 is a dependency of the standalone
// scripts/mysql-restore CLI tool, not of api-server, so pnpm's strict
// per-package isolation meant Node could never resolve it there). The CLI
// tool itself (`pnpm --filter scripts run restore:mysql`) still exists for
// a one-off MySQL migration outside the running app, if that's ever needed
// again — it just isn't wired into this admin page anymore.
import { useEffect, useState } from 'react';
import { useMutation } from '@tanstack/react-query';
import { AlertTriangle, Archive, CheckCircle2, Database, Download, Loader2, ShieldAlert, Upload, Users } from 'lucide-react';
import { SectionHeader, ConfirmDialog, cn } from '@/lib/shared';
import { fullBackupApi, ApiRequestError, type FullBackupScope, type FullBackupValidation, type FullBackupRestoreResult } from '@/lib/api';
import { toast } from '@/hooks/use-toast';

const SCOPES: Array<{ scope: FullBackupScope; title: string; description: string; icon: typeof Database }> = [
  { scope: 'full', title: 'Full Database Backup', description: 'Everything in one portable JSON file — platform content and student data together (50 of the app\'s 55 tables; the other 5 are live sessions, one-time tokens, raw webhook events, and the audit log, none of which a restore needs). This is the file to use for a complete migration to a new empty PostgreSQL/Supabase database.', icon: Archive },
  { scope: 'content', title: 'Platform content', description: 'Colleges, courses, modules, subjects, topics, MCQs, flashcards, books, past papers, exams, OSPE/OSCE, team, plans, coupons, MCQ import profiles, and platform settings (secrets redacted). No student accounts or activity.', icon: Database },
  { scope: 'users', title: 'Student data', description: 'Every student account and their activity — payments, memberships, progress, attempts, notebook, flags, feedback, notifications. Password hashes are never included; students sign in again with "Forgot password" after a restore.', icon: Users },
];

function BackupCard({ scope, title, description, icon: Icon, onImported }: { scope: FullBackupScope; title: string; description: string; icon: typeof Database; onImported: (r: FullBackupRestoreResult) => void }) {
  const [file, setFile] = useState<File | null>(null);
  const [validation, setValidation] = useState<FullBackupValidation | null>(null);
  const [confirmWipe, setConfirmWipe] = useState(false);
  // A full restore of a large export (30k+ rows across dozens of tables)
  // can legitimately run for minutes — each batch is its own round-trip to
  // Postgres. Before this, the only UI feedback during that whole window
  // was a small spinner icon with unchanged button text, which looks
  // identical whether the restore is working or actually stuck. This timer
  // gives a visible, ticking "still alive" signal for as long as the
  // restore.isPending mutation is in flight, and a bounded round-trip: it
  // starts counting the moment the fetch is sent and stops the moment a
  // response (success or error) comes back — it says nothing about what's
  // happening server-side, only that the browser hasn't given up.
  const [restoreElapsedSec, setRestoreElapsedSec] = useState(0);

  const download = useMutation({
    mutationFn: () => fullBackupApi.downloadBackup(scope),
    onError: (err: unknown) => toast({ title: 'Could not download backup', description: err instanceof ApiRequestError ? err.message : 'Something went wrong.', variant: 'destructive' }),
  });

  const validate = useMutation({
    mutationFn: (f: File) => fullBackupApi.validate(f),
    onSuccess: (result) => setValidation(result),
    onError: (err: unknown) => { setValidation(null); toast({ title: 'Could not read this backup', description: err instanceof ApiRequestError ? err.message : 'Something went wrong.', variant: 'destructive' }); },
  });

  const restore = useMutation({
    mutationFn: (mode: 'restore-empty' | 'wipe-and-restore') => fullBackupApi.importBackup(file as File, mode),
    onSuccess: (result) => {
      onImported(result);
      setFile(null);
      setValidation(null);
      setConfirmWipe(false);
      toast({ title: 'Restore complete', description: `${title} restored.` });
    },
    onError: (err: unknown) => toast({ title: 'Restore failed', description: err instanceof ApiRequestError ? err.message : 'Something went wrong.', variant: 'destructive' }),
  });

  // See restoreElapsedSec's declaration above for why this exists. Ticks
  // once a second only while the restore request is actually in flight;
  // resets to 0 as soon as it isn't (success, error, or not started).
  useEffect(() => {
    if (!restore.isPending) { setRestoreElapsedSec(0); return; }
    setRestoreElapsedSec(0);
    const startedAt = Date.now();
    const id = window.setInterval(() => setRestoreElapsedSec(Math.floor((Date.now() - startedAt) / 1000)), 1000);
    return () => window.clearInterval(id);
  }, [restore.isPending]);

  const pickFile = (f: File | null) => {
    setFile(f);
    setValidation(null);
    if (f) validate.mutate(f);
  };

  const errors = validation?.issues.filter((i) => i.level === 'error') ?? [];
  const warnings = validation?.issues.filter((i) => i.level === 'warning') ?? [];
  const canRestore = !!validation?.valid && !restore.isPending;

  return <div className="rounded-2xl border border-border bg-card p-5" data-testid={`card-backup-${scope}`}>
    <div className="flex items-start gap-3">
      <div className="grid size-10 shrink-0 place-items-center rounded-xl bg-primary/10 text-primary"><Icon size={18} /></div>
      <div>
        <h3 className="text-[15px] font-extrabold">{title}</h3>
        <p className="mt-1 text-xs leading-5 text-muted-foreground">{description}</p>
      </div>
    </div>

    <div className="mt-4 flex flex-wrap gap-2">
      <button onClick={() => download.mutate()} disabled={download.isPending} className="inline-flex items-center gap-2 rounded-xl bg-primary px-4 py-2.5 text-xs font-extrabold text-primary-foreground disabled:opacity-50" data-testid={`button-export-${scope}`}>
        {download.isPending ? <Loader2 size={14} className="animate-spin" /> : <Download size={14} />} Export {title.toLowerCase()}
      </button>
    </div>

    <div className="mt-4 border-t border-border/60 pt-4">
      <p className="text-[11px] font-extrabold uppercase tracking-[.08em] text-muted-foreground">Restore into this database (PostgreSQL)</p>
      <p className="mt-3 text-[11px] leading-5 text-muted-foreground">Restoring into a brand-new/empty PostgreSQL database (e.g. right after pointing DATABASE_URL at a fresh Supabase project) automatically prepares the required MedSchoolProffs schema first — no manual table setup needed. An existing database with data keeps the same safety rules below.</p>

      <label className="mt-3 inline-flex cursor-pointer items-center gap-2 rounded-xl border border-border bg-background px-4 py-2.5 text-xs font-bold hover:bg-muted" data-testid={`button-choose-file-${scope}`}>
        <Upload size={14} /> {file ? file.name : 'Choose backup file...'}
        <input type="file" accept=".json,application/json" className="hidden" onChange={(e) => pickFile(e.target.files?.[0] ?? null)} data-testid={`input-file-${scope}`} />
      </label>
    </div>

    {/* Explicit phase indicator — idle / file selected / validating / validation
        complete / restoring / restore completed / restore failed. Restoring
        is the phase that most needs to be unambiguous: it's the one that can
        legitimately run for minutes, and before this it looked identical to
        "nothing is happening." */}
    {validate.isPending && <p className="mt-3 flex items-center gap-2 text-xs text-muted-foreground"><Loader2 size={13} className="animate-spin" /> Validating...</p>}
    {!validate.isPending && file && !validation && !validate.isError && <p className="mt-3 text-xs text-muted-foreground">File selected — waiting to validate.</p>}
    {restore.isPending && <p className="mt-3 flex items-center gap-2 text-xs font-bold text-primary" data-testid={`text-restoring-${scope}`}>
      <Loader2 size={13} className="animate-spin" /> Restoring… {restoreElapsedSec}s elapsed. Large backups can take several minutes — this is expected; watch the API server's terminal for "[full-backup] batch inserted" lines to confirm it's still progressing.
    </p>}
    {restore.isSuccess && <p className="mt-3 flex items-center gap-2 text-xs font-bold text-primary"><CheckCircle2 size={13} /> Restore completed.</p>}
    {restore.isError && <p className="mt-3 flex items-center gap-2 text-xs font-bold text-destructive"><AlertTriangle size={13} /> Restore failed — see the error above.</p>}

    {validation && <div className="mt-4 rounded-xl border border-border bg-background p-4">
      <div className="flex items-center gap-2 text-xs font-extrabold">
        {validation.valid ? <CheckCircle2 size={15} className="text-primary" /> : <AlertTriangle size={15} className="text-destructive" />}
        {validation.valid ? 'Valid backup' : 'This backup failed validation'}
        {validation.exportedAt && <span className="font-normal text-muted-foreground">· exported {new Date(validation.exportedAt).toLocaleString()}</span>}
      </div>

      <div className="mt-3 grid grid-cols-2 gap-x-4 gap-y-1 text-[11px] sm:grid-cols-3">
        {Object.entries(validation.counts).map(([key, count]) => <div key={key} className="flex justify-between gap-2 border-b border-border/60 py-1"><span className="text-muted-foreground">{key}</span><span className="font-bold">{count.toLocaleString()}</span></div>)}
      </div>

      {errors.length > 0 && <ul className="mt-3 space-y-1 text-[11px] text-destructive">{errors.map((e, i) => <li key={i}>✗ {e.message}</li>)}</ul>}
      {warnings.length > 0 && <ul className="mt-3 space-y-1 text-[11px] text-amber-600">{warnings.map((w, i) => <li key={i}>⚠ {w.message}</li>)}</ul>}

      {validation.valid && validation.targetHasExistingData && <div className="mt-3 flex items-start gap-2 rounded-lg border border-amber-300 bg-amber-50 p-3 text-[11px] font-semibold text-amber-800" data-testid={`warning-existing-data-${scope}`}>
        <ShieldAlert size={15} className="mt-0.5 shrink-0" /> This server already has {title.toLowerCase()} data. Restoring here will create duplicates unless you choose to wipe first.
      </div>}

      {validation.valid && <div className="mt-4 flex flex-wrap gap-2">
        {!validation.targetHasExistingData && <button onClick={() => restore.mutate('restore-empty')} disabled={!canRestore} className="inline-flex items-center gap-2 rounded-xl bg-primary px-4 py-2.5 text-xs font-extrabold text-primary-foreground disabled:opacity-50" data-testid={`button-restore-${scope}`}>
          {restore.isPending ? <><Loader2 size={14} className="animate-spin" /> Restoring… {restoreElapsedSec}s</> : 'Restore into this database'}
        </button>}
        {validation.targetHasExistingData && <button onClick={() => setConfirmWipe(true)} disabled={!canRestore} className="inline-flex items-center gap-2 rounded-xl bg-destructive px-4 py-2.5 text-xs font-extrabold text-destructive-foreground disabled:opacity-50" data-testid={`button-wipe-restore-${scope}`}>
          {restore.isPending ? <><Loader2 size={14} className="animate-spin" /> Restoring… {restoreElapsedSec}s</> : `Wipe existing ${title.toLowerCase()} and restore`}
        </button>}
      </div>}
    </div>}

    {confirmWipe && <ConfirmDialog
      title={`Wipe existing ${title.toLowerCase()}?`}
      body="This permanently deletes every row currently in the tables this backup covers, then restores this backup in the same transaction. If anything goes wrong the whole operation rolls back — but if it succeeds, there is no undo."
      confirmLabel="Wipe and restore"
      // Without this, the dialog's default "Deleting…" label during a
      // restore that's actually still running for minutes reads as if
      // deletion (the wipe) is what's taking so long — misleading when
      // it's really the subsequent insert of 30k+ rows.
      pendingLabel={`Restoring… ${restoreElapsedSec}s`}
      tone="destructive"
      pending={restore.isPending}
      // Backdrop click on ConfirmDialog fires onCancel, which previously
      // just hid the dialog while leaving restore.mutate() running
      // unseen in the background — closing the dialog looked like
      // cancelling, but the restore transaction was not actually
      // stoppable from here. Ignoring cancel while pending keeps the
      // progress visible until the request actually resolves.
      onCancel={() => { if (!restore.isPending) setConfirmWipe(false); }}
      onConfirm={() => restore.mutate('wipe-and-restore')}
    />}
  </div>;
}

function AdminDatabaseBackup() {
  const [lastResult, setLastResult] = useState<FullBackupRestoreResult | null>(null);

  return <div>
    <SectionHeader eyebrow="Workspace" title="Database Backup & Restore" />
    <p className="mb-5 max-w-2xl text-xs leading-6 text-muted-foreground">
      Export the whole platform as portable JSON, or restore from a previous export. This is separate from the MCQ-bank-only backup under MCQ bank — use this for a full snapshot before a risky change, moving to a new server, or preparing for a future database migration. Only admins can export or restore.
    </p>

    <div className="grid gap-4 lg:grid-cols-2">
      {SCOPES.map((s) => <BackupCard key={s.scope} {...s} onImported={setLastResult} />)}
    </div>

    {lastResult && <div className={cn('mt-5 rounded-2xl border p-5 text-xs', 'border-primary/30 bg-primary/5')} data-testid="text-last-restore-result">
      <div className="flex items-center gap-2 font-extrabold"><CheckCircle2 size={15} className="text-primary" /> Last restore — {lastResult.scope}, {lastResult.mode === 'wipe-and-restore' ? 'wiped and restored' : 'restored into empty tables'}</div>
      <div className="mt-3 grid grid-cols-2 gap-x-4 gap-y-1 sm:grid-cols-4">
        {Object.entries(lastResult.restored).map(([key, count]) => <div key={key} className="flex justify-between gap-2 border-b border-border/60 py-1"><span className="text-muted-foreground">{key}</span><span className="font-bold">{count.toLocaleString()}</span></div>)}
      </div>
    </div>}

    <div className="mt-6 rounded-2xl border border-dashed border-border p-5 text-[11px] leading-5 text-muted-foreground">
      <p className="font-bold text-foreground">Format notes</p>
      <ul className="mt-2 list-disc space-y-1 pl-4">
        <li>Every row keeps its original database id, and every foreign key is preserved — a restored MCQ still points at the right topic, a restored payment still points at the right student.</li>
        <li>Platform settings that look like secrets (API keys, SMTP password, the admin signup code) are exported as a placeholder — reconfigure those from Admin → Platform settings after a restore.</li>
        <li>Restoring works best into an empty database. Restoring into one that already has data requires explicitly choosing "wipe and restore," which runs inside a single transaction — a failure rolls back rather than leaving things half-restored.</li>
        <li>A brand-new PostgreSQL database (a freshly created Supabase project, for example) doesn't need its tables created by hand first — restoring into it automatically prepares the required schema before restoring data.</li>
        <li>Use "Full Database Backup" for a complete migration — it's the same JSON either way, just every table in one file instead of two.</li>
      </ul>
    </div>
  </div>;
}

export default AdminDatabaseBackup;
