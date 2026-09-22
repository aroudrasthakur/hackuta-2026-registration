# Architecture

High-level structure of the registration codebase.

## System context

```
hackuta.com (marketing) ──link──► register.hackuta.com (this app)
                                        │
                                        ├── Vite/React SPA (Vercel)
                                        └── Convex (DB, auth, HTTP, storage, cron)
```

Related repos: marketing site (`hackuta-2026-repository`), future profile split (`hackuta-2026-profile`), organizer admin (`hackuta-2026-admin` — separate Convex deployment).

## Repository layout

```
convex/                     Backend — queries, mutations, actions, HTTP, cron
  auth.ts                   @convex-dev/auth email OTP
  http.ts                   Resume upload + Auth OIDC routes
  registrations.ts          Submit application, resume sessions
  applicant.ts              Routing, profile dashboard, legacy claim
  contact.ts                Contact form action
  rateLimits.ts             OTP, contact, upload throttling
  pdfValidation.ts          Server-side PDF parse
  registrationSecurity.ts   Origin allowlist
  email/                    SMTP actions + HTML templates
  lib/                      Shared Convex helpers

shared/                     Isomorphic code (client + Convex)
  registration/             Zod schema, types, validation, resume policy
  contact/                  Contact validation, client key
  auth/                     OTP rate-limit helpers
  lib/                      sanitizeInput, normalizeEmail
  hackathon/                Schedule/timeline constants

src/                        React SPA
  pages/SignIn|Register|Profile|Contact
  convex/client.ts          ConvexReactClient wiring
  hooks/                    Auth, routing, applicant state

security/                   CSP + response headers (sync with vercel.json)
tests/                      Vitest unit + Playwright e2e
docs/                       This documentation set
```

## Request flows

### Sign-in

```
/sign-in → auth:signIn (request OTP) → SMTP
         → auth:signIn (verify) → JWT session
         → claimLegacyRegistrationIfEligible (if eligible)
         → route to /register or /profile
```

### Application submit

```
/register form → client Zod validate
              → POST /resume-upload (optional PDF)
              → registrations:register { data, resumeUploadToken }
              → confirmation email (internal action)
```

Email in `data` is ignored; server uses verified auth email.

### Contact

```
/contact → contact:submitContactMessage → validate → rate limit → SMTP
```

## Data model

Single `users` table extends Convex Auth records. Each user has **one embedded** `applications` object (not a separate applications table).

| Table | Purpose |
| --- | --- |
| `users` | Auth profile + embedded application |
| `hackathons` | Event metadata and registration window |
| `rateLimits` | Sliding-window counters (OTP, contact, upload) |
| `resumeUploadSessions` | Capability tokens linking upload → registration |
| `_storage` | Resume PDF blobs |
| Auth tables | Sessions, OTP codes (managed by `@convex-dev/auth`) |

Schema: `convex/schema.ts`. Field validators: `convex/applicationFields.ts`.

## Shared validation pattern

Client and server import the same modules under `shared/`:

- **Registration:** `registrationPayloadSchema` in `schema.ts`; server entry `validateRegistrationPayload()` in `validation.ts`
- **Contact:** `validateContactForm()` in `shared/contact/validation.ts`
- **Sanitization:** `shared/lib/sanitizeInput.ts` used inside Zod transforms and contact validation

Client validation gives immediate field feedback; server validation is authoritative.

## Frontend routing

| Path | Guard | Purpose |
| --- | --- | --- |
| `/` | routing query | Redirect to sign-in, register, or profile |
| `/sign-in` | public | OTP auth |
| `/register` | auth, not submitted | Application form |
| `/profile` | auth | Applicant dashboard (read-only) |
| `/contact` | public | Contact form |

Route guards use `applicant:getApplicantRoutingState`.

## Deployment split

| Component | Host | Config |
| --- | --- | --- |
| SPA | Vercel | `VITE_*` env vars, `vercel.json` headers |
| Backend | Convex Cloud | `npx convex env set`, separate dev/prod deployments |

Dev deployment: `standing-manatee-425`. Production: `brilliant-ostrich-892`.

## Key design decisions

1. **Embedded application** — one app per user simplifies auth and profile reads; tradeoff is no multi-hackathon applicants without schema change.
2. **Capability-token resume upload** — HTTP upload is unauthenticated; security is origin allowlist + token redemption at mutation time.
3. **Duplicate mutation aliases** — `register` and `submitRegistration` share one handler (public API stability).
4. **Mock mode** — `VITE_USE_MOCK_API` for CI/UI dev only; never on production Vercel.

## Related docs

- [API.md](API.md) — endpoint reference
- [SECURITY.md](SECURITY.md)
- [TESTING.md](TESTING.md)
