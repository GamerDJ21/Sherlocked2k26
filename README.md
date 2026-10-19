# Sherlocked 2K26 — individual event

Two builds share the competition UI and server logic: the current Sites preview (Vinext/D1 and platform sign-in), and the Render-ready Google-login build (Next.js/PostgreSQL). See DEPLOYMENT.md for the Google setup and hosting handoff. Synced project sources remain untouched.

## Participation

On Render, sign in with an approved Google account. On the Sites preview, platform sign-in is retained. Individual enrollment is automatic: no team creation, joining, or invitations. Every account has its own score, submissions, solved cases, and activity. A short stable suffix distinguishes participants with identical display names. Existing legacy team records remain in storage for audit purposes; shared team scores are not assigned to individuals or included in the individual leaderboard.

Correct answers earn fixed points once per participant/question. Wrong answers carry no penalty. Text ignores capitalization and extra spaces; numbers compare exact finite numeric values. Server time enforces opening and closing times. Attempts have a five-second cooldown. The first question open records a server start before returning its content; the first correct answer freezes its duration. Reopening never resets it. Leaderboard ties use lower total solve time, then participant name. Per-level and total durations are shown. Legacy solves without start timestamps show a dash.

## Administration

The runtime secret ADMIN_EMAILS is a comma-separated allowlist of ChatGPT emails. The three organizer emails supplied in chat are configured. Admin APIs check roles server-side. Set runtime values through Sites and deploy a saved version to apply them. Keep existing audience settings; application role membership does not itself grant access to a private Site.

Control room creates/edits short-text, multiple-choice (2–8 options), and numeric questions. Set opening/closing times in the browser's local timezone and publish. Correct answers must be re-entered when editing and never appear in client responses. Questions lock once opened.

## Local development and deployment

Use Node 24+. Run npm ci, then npm run build to generate dist/server/wrangler.json. Apply drizzle/0000_awesome_lord_tyger.sql once to local D1:

    node --import ./scripts/sites-env.mjs ./node_modules/wrangler/bin/wrangler.js d1 execute DB --local --config dist/server/wrangler.json --persist-to .wrangler/state --file drizzle/0000_awesome_lord_tyger.sql

Run npm run dev. The starter supports loopback-only mock sign-in as seedy@sites.test. For local admin checks only, put ADMIN_EMAILS=seedy@sites.test in ignored .dev.vars. Production identity comes from trusted Sites dispatch; do not expose the Worker directly where callers can forge identity headers.

.openai/hosting.json retains the existing Site ID and D1 binding DB. Use the Sites source helper to sync/push the exact source commit, build using the Sites build helper, and publish the matching artifact. Sites applies committed Drizzle migrations. Windows packaging can use the shipped prepare-site-build.cjs validator and native tar when Bash is unavailable; include hosting.json and .openai/drizzle in the artifact. The remote build fallback previously rejected the Windows npm lockfile; a validated local artifact avoids that path.

## Privacy and verification

Five-second polling updates leaderboard and admin feeds. Activity records only question-open, page visibility, and 30-second heartbeats. Answer submissions have server timestamps. No raw keystrokes, clipboard, screenshots, location, or other-tab monitoring. Presence signals are indicative, not proof of misconduct. Each participant’s expandable activity panel displays up to 50 recent events and submissions; older records remain in D1. Organizers should choose a retention period and back up the database before competition day.

Run node scripts/test-game.mjs and node node_modules/typescript/bin/tsc --noEmit. Integration checks include authenticated individual enrollment, separate scores, immediate submission after opening a question, duplicate-score prevention, server deadlines, answer secrecy, role checks, event allowlist, cross-origin rejection, and legacy team endpoint rejection.

Google-login handoff: DEPLOYMENT.md and render.yaml. Participant accounts are allowlisted through ALLOWED_EMAILS; no Google passwords are collected. Live Google login requires organizer-owned OAuth credentials and a Render deployment.

Admins can select an existing question and click Remove question. It disappears from the participant list and rejects new opens/answers, while scores, timings, and audit logs remain intact. Removed questions can be restored as drafts from the admin panel.
