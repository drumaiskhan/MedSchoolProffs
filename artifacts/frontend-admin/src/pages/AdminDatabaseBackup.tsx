// Admin -> Database Backup & Restore. Whole-platform JSON export/import —
// every application table (see lib/fullBackup.ts on the backend), split
// into "Platform content" (curriculum + settings, no student data) and
// "Student data" (accounts + activity, exported separately since restoring
// or sharing it is a bigger deal). Each card can restore that same JSON
// into either this app's own PostgreSQL database (the normal path) or an
// admin-supplied MySQL database (see routes/full-backup-mysql.ts on the
// backend) — the MySQL path is for migrating data to a future MySQL build
// and never changes what database this application itself reads from. See
// the format notes at the bottom of this page.
import { useState } from 'react';
import { useMutation } from '@tanstack/react-query';
import { AlertTriangle, CheckCircle2, Database, Download, Loader2, Plug, ShieldAlert, Upload, Users } from 'lucide-react';
import { SectionHeader, ConfirmDialog, cn } from '@/lib/shared';
import { fullBackupApi, mysqlBackupApi, ApiRequestError, type FullBackupScope, type FullBackupValidation, type FullBackupRestoreResult } from '@/lib/api';
import { toast } from '@/hooks/use-toast';

const SCOPES: Array<{ scope: FullBackupScope; title: string; description: string; icon: typeof Database }> = [
  { scope: 'content', title: 'Platform content', description: 'Colleges, courses, modules, subjects, topics, MCQs, flashcards, books, past papers, exams, OSPE/OSCE, team, plans, coupons, and platform settings (secrets redacted). No student accounts or activity.', icon: Database },
  { scope: 'users', title: 'Student data', description: 'Every student account and their activity — payments, memberships, progress, attempts, notebook, flags, feedback, notifications. Password hashes are never included; students sign in again with "Forgot password" after a restore.', icon: Users },
];

type RestoreTarget = 'postgres' | 'mysql';

function BackupCard({ scope, title, description, icon: Icon, onImported }: { scope: FullBackupScope; title: string; description: string; icon: typeof Database; onImported: (r: FullBackupRestoreResult) => void }) {
  const [target, setTarget] = useState<RestoreTarget>('postgres');
  const [mysqlUrl, setMysqlUrl] = useState('');
  const [file, setFile] = useState<File | null>(null);
  const [validation, setValidation] = useState<FullBackupValidation | null>(null);
  const [confirmWipe, setConfirmWipe] = useState(false);

  const download = useMutation({
    mutationFn: () => fullBackupApi.downloadBackup(scope),
    onError: (err: unknown) => toast({ title: 'Could not download backup', description: err instanceof ApiRequestError ? err.message : 'Something went wrong.', variant: 'destructive' }),
  });

  const testConnection = useMutation({
    mutationFn: () => mysqlBackupApi.testConnection(mysqlUrl),
    onSuccess: (result) => {
      if (result.ok) toast({ title: 'Connected', description: 'This MySQL connection string works.' });
      else toast({ title: 'Connection failed', description: result.error || 'Could not reach this MySQL database.', variant: 'destructive' });
    },
    onError: (err: unknown) => toast({ title: 'Connection failed', description: err instanceof ApiRequestError ? err.message : 'Something went wrong.', variant: 'destructive' }),
  });

  const validate = useMutation({
    mutationFn: (f: File) => (target === 'mysql' ? mysqlBackupApi.validate(f, mysqlUrl) : fullBackupApi.validate(f)),
    onSuccess: (result) => setValidation(result),
    onError: (err: unknown) => { setValidation(null); toast({ title: 'Could not read this backup', description: err instanceof ApiRequestError ? err.message : 'Something went wrong.', variant: 'destructive' }); },
  });

  const restore = useMutation({
    mutationFn: (mode: 'restore-empty' | 'wipe-and-restore') =>
      target === 'mysql' ? mysqlBackupApi.importBackup(file as File, mysqlUrl, mode) : fullBackupApi.importBackup(file as File, mode),
    onSuccess: (result) => {
      onImported(result);
      setFile(null);
      setValidation(null);
      setConfirmWipe(false);
      toast({ title: 'Restore complete', description: `${title} restored${target === 'mysql' ? ' into MySQL' : ''}.` });
    },
    onError: (err: unknown) => toast({ title: 'Restore failed', description: err instanceof ApiRequestError ? err.message : 'Something went wrong.', variant: 'destructive' }),
  });

  const pickFile = (f: File | null) => {
    setFile(f);
    setValidation(null);
    if (f && (target === 'postgres' || mysqlUrl.trim())) validate.mutate(f);
  };

  const switchTarget = (t: RestoreTarget) => {
    setTarget(t);
    setValidation(null);
    setFile(null);
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
      <p className="text-[11px] font-extrabold uppercase tracking-[.08em] text-muted-foreground">Restore into</p>
      <div className="mt-2 inline-flex rounded-xl border border-border bg-background p-1 text-xs font-bold">
        <button onClick={() => switchTarget('postgres')} className={cn('rounded-lg px-3 py-1.5', target === 'postgres' ? 'bg-primary text-primary-foreground' : 'text-muted-foreground')} data-testid={`button-target-postgres-${scope}`}>This database (PostgreSQL)</button>
        <button onClick={() => switchTarget('mysql')} className={cn('rounded-lg px-3 py-1.5', target === 'mysql' ? 'bg-primary text-primary-foreground' : 'text-muted-foreground')} data-testid={`button-target-mysql-${scope}`}>MySQL database</button>
      </div>

      {target === 'mysql' && <div className="mt-3 space-y-2">
        <p className="text-[11px] leading-5 text-muted-foreground">Restores into a separate MySQL database you provide — this does not change what PostgreSQL/Supabase database the live app uses. The connection string is used for this request only and isn't saved.</p>
        <div className="flex flex-wrap items-center gap-2">
          <input
            type="password"
            value={mysqlUrl}
            onChange={(e) => setMysqlUrl(e.target.value)}
            placeholder="mysql://user:pass@host:3306/database"
            className="min-w-[280px] flex-1 rounded-xl border border-border bg-background px-3 py-2 text-xs"
            data-testid={`input-mysql-url-${scope}`}
          />
          <button onClick={() => testConnection.mutate()} disabled={!mysqlUrl.trim() || testConnection.isPending} className="inline-flex items-center gap-2 rounded-xl border border-border bg-background px-3 py-2 text-xs font-bold hover:bg-muted disabled:opacity-50" data-testid={`button-test-connection-${scope}`}>
            {testConnection.isPending ? <Loader2 size={13} className="animate-spin" /> : <Plug size={13} />} Test connection
          </button>
        </div>
      </div>}

      {target === 'postgres' && <p className="mt-3 text-[11px] leading-5 text-muted-foreground">Restoring into a brand-new/empty PostgreSQL database (e.g. right after pointing DATABASE_URL at a fresh Supabase project) automatically prepares the required MedSchoolProffs schema first — no manual table setup needed. An existing database with data keeps the same safety rules below.</p>}


      <label className={cn('mt-3 inline-flex cursor-pointer items-center gap-2 rounded-xl border border-border bg-background px-4 py-2.5 text-xs font-bold hover:bg-muted', target === 'mysql' && !mysqlUrl.trim() && 'pointer-events-none opacity-50')} data-testid={`button-choose-file-${scope}`}>
        <Upload size={14} /> {file ? file.name : 'Choose backup file...'}
        <input type="file" accept=".json,application/json" className="hidden" onChange={(e) => pickFile(e.target.files?.[0] ?? null)} data-testid={`input-file-${scope}`} disabled={target === 'mysql' && !mysqlUrl.trim()} />
      </label>
    </div>

    {validate.isPending && <p className="mt-3 flex items-center gap-2 text-xs text-muted-foreground"><Loader2 size={13} className="animate-spin" /> Reading and validating...</p>}

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
        <ShieldAlert size={15} className="mt-0.5 shrink-0" /> This {target === 'mysql' ? 'MySQL database' : 'server'} already has {title.toLowerCase()} data. Restoring here will create duplicates unless you choose to wipe first.
      </div>}

      {validation.valid && <div className="mt-4 flex flex-wrap gap-2">
        {!validation.targetHasExistingData && <button onClick={() => restore.mutate('restore-empty')} disabled={!canRestore} className="inline-flex items-center gap-2 rounded-xl bg-primary px-4 py-2.5 text-xs font-extrabold text-primary-foreground disabled:opacity-50" data-testid={`button-restore-${scope}`}>
          {restore.isPending ? <Loader2 size={14} className="animate-spin" /> : null} Restore into this database
        </button>}
        {validation.targetHasExistingData && <button onClick={() => setConfirmWipe(true)} disabled={!canRestore} className="inline-flex items-center gap-2 rounded-xl bg-destructive px-4 py-2.5 text-xs font-extrabold text-destructive-foreground disabled:opacity-50" data-testid={`button-wipe-restore-${scope}`}>
          Wipe existing {title.toLowerCase()} and restore
        </button>}
      </div>}
    </div>}

    {confirmWipe && <ConfirmDialog
      title={`Wipe existing ${title.toLowerCase()}?`}
      body={`This permanently deletes every row currently in the ${scope} tables${target === 'mysql' ? ' in this MySQL database' : ''}, then restores this backup in the same transaction. If anything goes wrong the whole operation rolls back — but if it succeeds, there is no undo.`}
      confirmLabel="Wipe and restore"
      tone="destructive"
      pending={restore.isPending}
      onCancel={() => setConfirmWipe(false)}
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
        <li>Dates are ISO-8601 strings; nothing PostgreSQL-specific is written into the file, so the same JSON also restores into a MySQL database using the "MySQL database" option above.</li>
        <li>A MySQL restore is a one-time data migration into a separate database — it doesn't change which database this application reads from. Making the live app run on MySQL instead of PostgreSQL is a separate, larger change not done by this page.</li>
        <li>Platform settings that look like secrets (API keys, SMTP password, the admin signup code) are exported as a placeholder — reconfigure those from Admin → Platform settings after a restore.</li>
        <li>Restoring works best into an empty database. Restoring into one that already has data requires explicitly choosing "wipe and restore," which runs inside a single transaction — a failure rolls back rather than leaving things half-restored.</li>
        <li>A brand-new PostgreSQL database (a freshly created Supabase project, for example) doesn't need its 49 tables created by hand first — restoring into it automatically prepares the required schema before restoring data.</li>
      </ul>
    </div>
  </div>;
}

export default AdminDatabaseBackup;
