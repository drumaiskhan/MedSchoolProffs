# Fix: password-reset email link ("This site can't be reached" / DNS_PROBE_FINISHED_NXDOMAIN)

## What was happening

The screenshots show the reset link resolving to `r.support.medschoolproffs.live`, which
has no DNS record at all. That host isn't one of ours — it's **Brevo's click-tracking
redirect**. Brevo rewrites every link in a transactional email (HTML buttons and plain-text
URLs alike) through a per-account tracking host before sending it, and this cannot be turned
off per-message or per-account. If your Brevo sending domain has a **branded subdomain**
configured (so the tracking host is `r.<your-subdomain>` instead of Brevo's own
`r.brevolinks.com`), but the DNS record for that host was never added, every rewritten link
in every transactional email — reset password, verification, everything — dies with
`DNS_PROBE_FINISHED_NXDOMAIN`, even though the URL printed in the email body looks correct.

The second screenshot (Gmail hiding the images and flagging the message as suspicious) is a
downstream symptom of the same thing: a link that resolves to a broken/unrecognized host is
one of the signals spam filters use.

## The real fix — DNS (do this in Brevo + your DNS provider)

1. In Brevo: **Senders, Domains & Dedicated IPs → your sending domain → branded subdomain
   setup**. Brevo will show you the exact CNAME record it expects for the tracking host
   (something like `r.support` → `some-target.brevo.com` — copy the exact value Brevo shows,
   don't reuse the example here).
2. Add that CNAME record at your DNS provider for `support.medschoolproffs.live` (or whichever
   subdomain the email came from).
3. Wait for DNS propagation (can take up to a few hours), then use Brevo's "Verify" button on
   the domain.
4. Send a test email (Admin → Platform settings → Email → *Send test email*) and confirm the
   link now resolves.

If you don't want a branded subdomain at all, you can instead remove that configuration in
Brevo so links fall back to Brevo's own always-working tracking domain
(`click.brevo.com`/`r.brevolinks.com`) — simpler, at the cost of the link visibly going
through Brevo's domain instead of yours.

## The safety net (shipped in this change)

A password reset should never be fully dependent on a third party's redirect being healthy.
The reset email now also prints the raw reset **code** as plain text (not a link), and the
`/reset-password` page in both the student and admin apps accepts that code pasted in when
there's no `?token=` in the URL. So even if a tracking-domain DNS record is ever missing or
broken again, a student/admin can still complete a reset by pasting the code shown in the
email instead of clicking the (possibly broken) link.

Changed:
- `artifacts/api-server/src/lib/email.ts` — `resetPasswordEmailHtml` now includes the plain
  reset code alongside the link.
- `artifacts/api-server/src/routes/auth.ts` — `POST /auth/reset-password` accepts a bare code,
  a pasted full link, or a code with stray whitespace, and resolves all three to the same
  token.
- `artifacts/frontend-student/src/pages/ResetPassword.tsx` and
  `artifacts/frontend-admin/src/pages/ResetPassword.tsx` — show a "paste your code" field when
  the page is opened with no `?token=` in the URL.
- `artifacts/frontend-student/src/pages/ForgotPassword.tsx` and
  `artifacts/frontend-admin/src/pages/ForgotPassword.tsx` — the "check your email" confirmation
  now links to that fallback.

No architecture, auth logic, routes, or database schema changed.
