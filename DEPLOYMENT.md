# Google login and Render deployment

The Render build uses Google sign-in and PostgreSQL. The existing Sites build remains a separate preview with platform-owned sign-in; it cannot be switched to this external OAuth stack without migrating hosting. Both share competition logic and UI. No Google passwords are collected or stored. Unknown accounts are denied; only ADMIN_EMAILS and ALLOWED_EMAILS may enter. Only verified Gmail and Google Workspace addresses are accepted. Registration is disabled. The three existing organizer emails should be copied from .env.example into ADMIN_EMAILS. Supply participant emails later in ALLOWED_EMAILS, comma separated.

## Google Cloud setup (organizer-owned)

1. Create/select a Google Cloud project. Configure Google Auth Platform branding, audience, and contact information. Request only openid, email, and profile; no Gmail/Drive permissions.
2. Create an OAuth client of type Web application. Once Render gives you the service URL, set the authorized redirect URI to exactly `https://YOUR-SERVICE.onrender.com/auth/callback`. If using a custom domain, use that domain consistently for APP_ORIGIN and the redirect URI.
3. While Google's OAuth app is in Testing, add approved accounts as Google test users too. The Google test-user list and the application's participant allowlist are separate gates. Review Google's production publishing requirements before the event.
4. Enter GOOGLE_CLIENT_ID and GOOGLE_CLIENT_SECRET in Render's secret environment settings. Do not paste the secret into chat, browser code, source control, or NEXT_PUBLIC variables. The OAuth client ID itself is public by design; it is not a password.

Official reference: https://developers.google.com/identity/openid-connect/openid-connect

## Render deployment

1. Put this project source in a private Git repository and connect it to your Render account. Do not upload node_modules, outputs, .git, .env files, preview images, or local database/runtime folders. An export script is provided: `node scripts/export-render.mjs`.
2. Create a Blueprint using render.yaml. It declares a paid Node web service and paid PostgreSQL database; review Render's current pricing before creation. Do not create paid resources without reviewing the charges.
3. Set GOOGLE_CLIENT_ID, GOOGLE_CLIENT_SECRET, ADMIN_EMAILS, ALLOWED_EMAILS, and APP_ORIGIN using .env.example as a key-name guide. Use Render's HTTPS service URL as APP_ORIGIN, without a trailing slash. The Blueprint wires the internal database connection; public database ingress is disabled.
4. Build: `npm ci --include=dev && npm run build:render`. Pre-deploy schema migration: `npm run db:render`. Start: `npm run start:render`. Render supplies PORT. Migrations use an advisory lock and a journal; existing competition records are preserved. Hosting migration creates a new database, so existing Sites questions/records are not automatically copied. Re-enter questions before the event or arrange a separate reviewed data export/import.
5. Confirm the exact Google callback URL, deploy, and test an allowed participant, a denied participant, each admin, logout, and the timing flow. A new login invalidates older sessions for that Google account. Accounts removed from the allowlist lose application access on their next request after configuration is applied.
6. Enable Google two-step verification/passkeys for all supplied accounts, especially administrators. If organizers issue dedicated Google accounts, transfer passwords privately and use Google's own security controls. The competition site never needs those passwords.

Render reference: https://render.com/docs/blueprint-spec

## Security and timing

OAuth uses a server code exchange, PKCE, one-use database state bound to a browser cookie, nonce validation, and Google's official ID-token verifier. Sessions are random opaque tokens; only their hashes are stored in the database. Cookies are HttpOnly, Secure, SameSite=Lax and host scoped in production. Session lifetime is eight hours. No OAuth tokens are kept after login, and no password table exists. Same-origin checks, per-account throttles, role checks, and output escaping protect application operations. Google handles credential authentication; organizers must protect account recovery and password distribution. For large/public events add host/edge IP-based request limits and rehearse expected concurrency.

Question content is withheld from participants until the server stores their first open. The first start persists across reloads/devices. The first correct solve stores a frozen duration in milliseconds. Leaderboard ranks by points then total solve time, with per-level durations. Unsolved levels show a dash. Old solves without a recorded start also show a dash; missing times are never guessed. Admins may see draft content in the editor; participants cannot. Questions lock once opened.

The answer verifier, stored hashes, Google client secret, and database credentials are server-only. Submitted guesses are visible to the submitting browser and in admin audit logs; this does not reveal the answer key. Google client IDs and a user's own session are inspectable by that browser owner. No system can prevent credential sharing or guarantee zero compromise.

## Checks and configuration still required

`node scripts/test-game.mjs` exercises server-side scoring/timing and security boundaries. `node scripts/test-google.mjs` checks callback/session policy with mocked Google responses; it does not substitute for live OAuth testing. `npm run build:render` builds the portable application. A real Render database, Google OAuth client, final participant list, and live end-to-end sign-in rehearsal are required before this version can be used for the event. The current Sites preview and new Google identity IDs have separate records.
