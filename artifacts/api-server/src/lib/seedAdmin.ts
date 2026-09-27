import { eq } from "drizzle-orm";
import { db, usersTable } from "@workspace/db";
import { hashPassword } from "./auth";
import { logger } from "./logger";
import { REDACTED_SECRET_PLACEHOLDER } from "./fullBackup";

const DEFAULT_ADMIN_EMAIL = "umais0khan@gmail.com";
const DEFAULT_ADMIN_PASSWORD = "Umaiskhan000";

/**
 * On first boot (no admin account exists yet), creates one using
 * DEFAULT_ADMIN_EMAIL/DEFAULT_ADMIN_PASSWORD env vars if set, otherwise the
 * hardcoded defaults below. This exists so a fresh deploy (Railway, Render,
 * local dev) has a working admin login immediately — no manual SQL insert,
 * no ADMIN_SIGNUP_CODE bootstrap dance.
 *
 * The seeded account should have its email/password changed from
 * Admin -> Platform settings -> Your account right after first login —
 * that's exactly what that panel is for. On Railway/Render, set
 * DEFAULT_ADMIN_EMAIL / DEFAULT_ADMIN_PASSWORD as real env vars instead of
 * relying on the hardcoded fallback, if you'd rather not have this
 * repository's default credentials be the ones that get seeded.
 *
 * Called after normalizeLegacyRoles(), so any legacy "superadmin" row has
 * already become "admin" by the time this checks for an existing admin.
 *
 * Restore repair (legacy safety net): full-backup restores now carry real
 * passwordHash values (see lib/fullBackup.ts), so a restored admin logs in
 * with their original password and this branch normally never fires. It's
 * kept in case an old backup file — from before passwords were included —
 * gets restored and still has the literal string "__REDACTED__" in that
 * column; without this check, that row would count as "an admin exists"
 * and the app would boot with an admin permanently unable to log in. When
 * that placeholder is found, this resets the row back to
 * DEFAULT_ADMIN_EMAIL/DEFAULT_ADMIN_PASSWORD (or the env vars, if set) so
 * there's still a way in.
 */
export async function seedDefaultAdmin(): Promise<void> {
  const email = (process.env.DEFAULT_ADMIN_EMAIL || DEFAULT_ADMIN_EMAIL).toLowerCase().trim();
  const password = process.env.DEFAULT_ADMIN_PASSWORD || DEFAULT_ADMIN_PASSWORD;

  const [existingAdmin] = await db.select().from(usersTable).where(eq(usersTable.role, "admin"));
  if (existingAdmin) {
    if (existingAdmin.passwordHash === REDACTED_SECRET_PLACEHOLDER) {
      const passwordHash = await hashPassword(password);
      await db.update(usersTable).set({ passwordHash }).where(eq(usersTable.id, existingAdmin.id));
      logger.info(
        { email: existingAdmin.email },
        "[seed] Restored admin had a redacted password hash — reset it to DEFAULT_ADMIN_EMAIL/DEFAULT_ADMIN_PASSWORD so login works again. Change it from Admin -> Platform settings -> Your account.",
      );
    }
    return;
  }

  const [emailTaken] = await db.select().from(usersTable).where(eq(usersTable.email, email));
  if (emailTaken) {
    logger.warn({ email }, "[seed] Default admin email is already taken by a non-admin account — skipping admin seed. Create an admin manually via /admin-signup/1.");
    return;
  }

  const passwordHash = await hashPassword(password);
  await db.insert(usersTable).values({
    name: "Admin",
    email,
    passwordHash,
    role: "admin",
    status: "ACTIVE",
    emailVerified: true,
  });

  logger.info({ email }, "[seed] Created default admin account — change its email/password from Admin -> Platform settings -> Your account as soon as you log in.");
}
