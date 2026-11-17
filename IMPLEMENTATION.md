# Singapore Todo — implementation

Next.js 16 / React 19 todo app with SQLite, passkeys, Singapore dates, priorities, recurring todos, reminders, subtasks, tags, templates, search, saved filters, JSON/CSV export, transactional JSON import, and a holiday calendar. The original workshop planning documents are retained.

## Local setup

Requires Node.js 22 or newer and a browser supporting WebAuthn. Native SQLite installation may require the platform's C++ build tools if a prebuilt binary is unavailable.

1. Run `npm ci`.
2. Copy `.env.example` to `.env.local` and replace `JWT_SECRET` with a cryptographically random secret (at least 32 characters).
3. Run `npm run seed` to seed Singapore public holidays.
4. Run `npm run dev`, open http://localhost:3000, enter a username and register a passkey.

Passkeys require localhost or HTTPS. Set `RP_ID` to the hostname without scheme/port and `RP_ORIGIN` to the full browser origin. Changing these invalidates existing passkeys for that relying party. There is no password fallback. Keep access to a registered passkey.

## Verification

- `npm run typecheck` — strict TypeScript
- `npm run lint` — ESLint
- `npm test` — recurrence/timezone/filter unit tests
- `npm run build` — production build
- `npx playwright install chromium` then `npx playwright test` — twelve feature files with real browser WebAuthn using virtual authenticators, authenticated API integration, isolation, and browser rendering checks

The Playwright server uses a separate `test-todos.db`. Every test registers a unique user. Existing development data is preserved. A server already listening on port 3000 is reused locally; stop it first to guarantee the test database and test environment configuration are used. Run `npx playwright test` three times when assessing repeatability. Reports are in `playwright-report/`; failed tests retain traces.

## Behavior

All date display and local date input use Asia/Singapore. Recurring completion creates one next instance and preserves tag associations. Browser notifications require permission and an open app tab; reminders are claimed atomically by polling to avoid duplicate notifications across tabs. The browser/OS may suppress notifications.

Templates capture subtask titles/positions and a relative due-date offset. Tags are excluded. Export JSON includes subtasks and tag names/colors, excludes original IDs, and imports atomically with new IDs. Existing tags are reused case-insensitively. Re-importing intentionally duplicates todos. CSV is an export-only format.

SQLite foreign keys and cascade deletion are enabled. Each authenticated query is scoped to the current user. The holiday table is global. Sessions use signed JWTs in HTTP-only SameSite cookies lasting seven days; production cookies require HTTPS.

## Production deployment

Use a persistent Node server such as Railway with a volume mounted at `/app/data`. Configure `DATABASE_PATH=/app/data/todos.db`, a random `JWT_SECRET`, production `RP_ID`, `RP_ORIGIN` and `RP_NAME`. Deploy the GitHub repository using `railway.json`, run the seed command against the mounted database, and verify passkey registration/login over HTTPS. Back up the volume regularly. Never commit `.env.local`, databases or credentials.

Run `npm run build` and `npm start` for a local production check. Cloud deployment requires an account/project and persistent storage configuration. No hosted deployment is implied by a successful GitHub push. Vercel's ephemeral function filesystem is unsuitable for this app's local persistent SQLite database.

See `IMPLEMENTATION_EVALUATION.md` for the verification record and remaining assessment limits.
