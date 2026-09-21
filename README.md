# HackUTA 2026 — Registration

Sign-in and application flow for HackUTA 2026. Deployed separately from the
marketing landing page ([hackuta-2026-repository](https://github.com/aroudrasthakur/hackuta-2026-repository)),
which links here from its "Register" call to action.

| Environment | Frontend | Convex deployment |
| --- | --- | --- |
| Production | `register.hackuta.org` | prod |
| Development | `register-dev.hackuta.org` | dev |

## Stack

- Vite + React 19 + TypeScript
- Tailwind CSS v4
- Convex (database, mutations, file storage) with Convex Auth email OTP
- Vitest for unit tests, Playwright for browser tests

## Getting started

```bash
npm install
cp .env.example .env.local   # fill in VITE_CONVEX_URL and friends
node scripts/generateAuthKeys.mjs
npx convex dev               # in a second terminal: pushes schema, prints the deployment URL
npm run dev
```

The dev server runs on `http://127.0.0.1:5273`.

## Convex Auth setup

Automatic anonymous sign-in has been removed. Applicants authenticate with a
six-digit email OTP through Convex Auth's `Email` provider (`@convex-dev/auth@0.0.95`).

Flow:

1. Visitor opens `/sign-in` and enters an email address.
2. Convex Auth creates a hashed, single-use verification code (10-minute expiry).
3. A Node action sends the code through cPanel SMTP.
4. The visitor enters the code; Convex Auth establishes the JWT session.
5. The app claims any eligible legacy anonymous registration, then routes to
   `/register` (new applicant) or `/profile` (existing application).

Sign-out uses Convex Auth's `signOut` and returns the visitor to `/sign-in`.

Required Convex Auth keys (generated locally, stored on the deployment):

- `JWT_PRIVATE_KEY`
- `JWKS`

Generate them with:

```bash
node scripts/generateAuthKeys.mjs
```

Configure Convex Auth's frontend origin on the deployment (`SITE_URL` is required
for email OTP sign-in; `CONVEX_SITE_URL` is provided automatically by Convex):

```bash
# Local dev (while testing against a shared deployment):
npx convex env set SITE_URL http://127.0.0.1:5273

# Production:
npx convex env set SITE_URL https://register.hackuta.org
```

## cPanel SMTP setup

Find SMTP settings in cPanel under **Email Accounts → Connect Devices**.

Set these on the Convex deployment (never as `VITE_*` variables):

```bash
npx convex env set SMTP_HOST mail.example.com
npx convex env set SMTP_PORT 465
npx convex env set SMTP_USER no-reply@example.com
npx convex env set SMTP_PASSWORD your-mailbox-password
npx convex env set EMAIL_FROM no-reply@example.com
npx convex env set CONTACT_EMAIL_TO contact@example.com
```

Port guidance:

- `465` — implicit SSL/TLS (`secure: true`)
- `587` — STARTTLS (`secure: false`)

Configure SPF and DKIM under cPanel **Email Deliverability** for the sending domain.

Test delivery:

1. Request a sign-in code at `/sign-in`.
2. Submit the contact form at `/contact`.

Common failures: wrong mailbox password, blocked outbound SMTP ports, missing SPF/DKIM, or SMTP env vars missing on the Convex deployment.

## Environment variables

Frontend variables are baked in at build time:

| Variable | Purpose |
| --- | --- |
| `VITE_CONVEX_URL` | Convex deployment URL (`https://<name>.convex.cloud`) |
| `VITE_CONVEX_SITE_URL` | Convex HTTP actions URL (`https://<name>.convex.site`) |
| `VITE_LANDING_URL` | Marketing site to link back to |
| `VITE_USE_MOCK_API` | `true` for local dev and CI browser tests; never on live production deploys |

Convex deployment variables:

| Variable | Purpose |
| --- | --- |
| `REGISTRATION_ALLOWED_ORIGINS` | Exact browser origins allowed to upload resumes |
| `REGISTRATION_ADMIN_IDENTITY_KEYS` | Organizer identity keys for admin queries |
| `SMTP_*`, `EMAIL_FROM`, `CONTACT_EMAIL_TO` | cPanel SMTP delivery |
| `JWT_PRIVATE_KEY`, `JWKS` | Convex Auth signing keys |

`REGISTRATION_ALLOWED_ORIGINS` must include `https://register.hackuta.org` in production.

## Mock mode

When `VITE_USE_MOCK_API=true`:

- Convex Auth is bypassed for UI development via `MockAuthProvider`.
- Mock OTP code: `042681`
- Registration and contact submissions succeed locally without SMTP or authenticated Convex mutations.

CI intentionally bakes this into the production bundle for Playwright CSP tests. Live Vercel deploys must leave it unset or `false`.

## Legacy anonymous registrations

Pre-launch deployments may contain anonymous registrations. After verified email
sign-in, the app attempts to claim exactly one legacy registration whose stored
email matches the verified address and whose owner is marked anonymous.
Ambiguous matches require manual admin resolution.

## Scripts

| Script | Description |
| --- | --- |
| `npm run dev` | Vite dev server |
| `npm run build` | Typecheck and build to `dist/` |
| `npm run preview` | Serve `dist/` with production CSP headers |
| `npm run lint` | ESLint over app, Convex, shared, and scripts |
| `npm run typecheck` | App/test types plus the Convex schema |
| `npm run test:unit` | Vitest |
| `npm run test:unit:coverage` | Vitest with 80% istanbul thresholds |
| `npm run test:e2e` | Playwright against the dev server |
| `npm run convex:dev` | Convex dev deployment watcher |
| `npm run convex:deploy` | Push functions and schema to Convex |

Run Playwright against the production build with
`PLAYWRIGHT_USE_BUILD=true npm run test:e2e`.

## Layout

```
convex/              Convex schema, mutations, queries, HTTP actions, auth, email
shared/registration/ Validation and types shared by the client and Convex
shared/contact/      Contact form validation
security/csp.ts      Production CSP; keep in sync with vercel.json
src/pages/Register/  Application form and API client
src/pages/SignIn/    Email OTP sign-in
src/pages/Profile/   Applicant dashboard
src/pages/Contact/   Contact form
tests/               Playwright specs and Vitest unit tests
```

## Security notes

- The production CSP in `security/csp.ts` and the `Content-Security-Policy`
  header in `vercel.json` are asserted to be identical by `tests/register.spec.ts`.
  Change both together.
- Resume uploads go straight to a Convex HTTP action, which validates the PDF
  and issues a short-lived upload token; the token is redeemed by the
  `registrations:register` mutation.
- OTP codes are hashed by Convex Auth, never logged, and never returned in API responses.
