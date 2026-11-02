# Workspace login security — November 2, 2026

Staff can sign in with their existing password or the approved Google account.
Authenticator-app TOTP is optional: tick “Set up optional two-step verification
(staff)” on the login form to enroll. Without that choice, existing password-only
accounts sign in normally. Once enrolled, both password and Google sign-in require
the authenticator or a recovery code. Only confirmation of a working code enables
MFA. Ten single-use recovery codes are displayed once and should be saved.
The abandoned mandatory-enrollment rollout was corrected immediately; restarting
the service invalidated pending setup challenges. Existing password-only sessions
are accepted for accounts that have not enabled MFA.

Google uses the existing Better Auth Google OAuth connection and registered callback.
The additional workspace bridge is bound to a short-lived secure browser cookie and
a single-use flow. Only verified Google identities for the existing approved Gary
and Leanne staff accounts are accepted. It does not provision users or authorize
arbitrary Google accounts. Enrolled MFA is also enforced after Google sign-in.
Live Google initiation and forged-callback rejection were verified; completing the
real Google account consent/sign-in requires the account owner.

MFA-verified staff sessions expire in eight hours; other sessions retain seven days.
Password resets do not remove MFA. If both authenticator and recovery codes are lost,
an administrator must independently verify identity before recovery; there is no
public MFA bypass or disable endpoint.

## Limits and storage
- Login: 30 attempts per IP and 10 per normalized email per 15 minutes.
- Reset requests: 10 per IP per 15 minutes and 3 per email per hour.
- Reset verification/password changes/MFA: IP limits; MFA also has ten attempts per
  user per 15 minutes and five per challenge. Successful attempts count too.
- Responses include HTTP 429 and Retry-After. Limits persist across restarts.
- Eight-kilobyte auth payload limit; passwords are bounded at 1024 characters.
- New passwords require at least 12 characters; existing passwords still work.
- Cookies are Secure, HttpOnly, SameSite=Lax. Browser writes reject foreign origins.
- Reset emails use a fixed trusted URL; reset links are no longer logged.
- TOTP secrets use AES-256-GCM. Recovery codes are hashed. Private state and its
  encryption key live under data/login-security with restricted filesystem modes.
  Back up this directory securely alongside portal users; never publish or commit it.
- Rate state uses atomic synchronous file replacement and assumes one Node process.
  Move to shared transactional storage before running multiple API workers.
- Only the loopback reverse proxy is trusted for X-Forwarded-For. The rightmost
  address is used because OpenLiteSpeed appends the connecting client's address.

## Deployment configuration
The production OpenLiteSpeed vhost has HTTP-to-HTTPS redirects before proxy routing,
excluding ACME challenge URLs for certificate renewal. Its root static context adds
HSTS (max-age=31536000, no includeSubDomains), nosniff, frame and referrer headers.
Keep these vhost settings during future hosting migrations. Auth asset references
use portal-auth.js?v=security-google-20261102. Do not regenerate the site from an older
workspace that lacks the security changes.

## Verification
Run `node tests/login-security.test.mjs` from the repository root. It copies source
to a temporary directory and creates fixture accounts, never production users.
It covers RFC 6238 vectors, enrollment, replay prevention, single-use recovery,
password-change invalidation of challenges, session enforcement for enrolled accounts, secure cookies,
origin rejection, payload limits, account throttling, reset throttling and the Google
bridge (unverified/unapproved/missing accounts, replay and MFA preservation).
Optional local browser checks: LOGIN_BROWSER_TEST=1 with Edge and Playwright under
tmp/shift-preview-tools. Tested at 1440px and 390px.

Live verification used only an absent example.invalid account: HTTPS redirects,
security headers, the exact published JS, foreign-origin rejection, and 429 limits.
No real staff password, authenticator or recovery code was used in verification.
This is targeted login hardening, not a penetration test or a guarantee against all attacks.
