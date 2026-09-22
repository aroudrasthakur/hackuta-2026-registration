# HackUTA 2026 Registration — API Reference

Backend for the registration app runs on [Convex](https://convex.dev). The frontend talks to Convex through:

- **WebSocket client** — queries, mutations, and actions at `VITE_CONVEX_URL` (`https://<deployment>.convex.cloud`)
- **HTTP actions** — resume upload and Convex Auth OIDC endpoints at `VITE_CONVEX_SITE_URL` (`https://<deployment>.convex.site`)

Function names below use the Convex `module:function` convention (e.g. `registrations:register`).

## Authentication

Auth uses [@convex-dev/auth](https://labs.convex.dev/auth) with a single **email OTP** provider (`provider: "email"`).

### Sign in (action)

**`auth:signIn`**

| Step | Arguments | Result |
| --- | --- | --- |
| Request code | `{ provider: "email", params: { email: "user@example.com" } }` | Sends OTP email; starts rate-limit cooldown |
| Verify code | `{ provider: "email", params: { email: "user@example.com", code: "123456" } }` | Returns `{ signingIn: true }` on success; establishes JWT session |

OTP details:

- 6-digit code, 10-minute expiry
- Hashed at rest; never returned in API responses
- Resend cooldown: **30 seconds**; max **5 sends/hour** per email
- Max **5 failed verification attempts/hour** (Convex Auth)

Client helpers: `shared/auth/otpRateLimit.ts`, `rateLimits:getOtpSendCooldown`.

### Sign out (action)

**`auth:signOut`** — `{}` — invalidates the current session.

### Session check (query)

**`auth:isAuthenticated`** — `{}` — returns whether the client has a valid JWT.

### HTTP — OIDC discovery

Registered by `auth.addHttpRoutes(http)` in `convex/http.ts`:

| Method | Path | Purpose |
| --- | --- | --- |
| `GET` | `/.well-known/openid-configuration` | OIDC discovery (issuer = Convex site URL) |
| `GET` | `/.well-known/jwks.json` | Public JWKS for JWT verification |

No OAuth/social providers are configured.

---

## Public queries

### `queries:getCurrentUser`

**Auth:** required

Returns the signed-in user profile: id, email, displayName, `hasApplication`, etc.

```typescript
{}  // no args
```

### `queries:getMyApplication`

**Auth:** required

Returns the caller’s embedded application object for a hackathon.

```typescript
{ hackathonId?: string }  // default: "hackuta-2026"
```

### `queries:getHackathonBySlug`

**Auth:** none

Public hackathon metadata lookup.

```typescript
{ slug: string }
```

### `applicant:getApplicantRoutingState`

**Auth:** optional (works for signed-out visitors)

Routing helper used by guards and `/` redirect logic.

```typescript
{ hackathonId?: string }  // default: "hackuta-2026"
```

Returns auth status, verified email, registration presence/status, and `hasSubmittedRegistration`.

### `applicant:getMyApplicantDashboard`

**Auth:** required

Profile page payload: application summary, answers, resume status, timeline, hackathon dates.

```typescript
{ hackathonId?: string }
```

### `rateLimits:getOtpSendCooldown`

**Type:** mutation · **Auth:** none

OTP resend cooldown for the sign-in UI. Lookup attempts are rate-limited server-side to reduce email enumeration.

```typescript
{ email: string }
```

Response:

```typescript
{
  waitSeconds: number;        // seconds until next send allowed (0 = ready)
  hourlyLimitReached: boolean // true when 5/hour cap hit
}
```

---

## Public mutations

### `registrations:register` / `registrations:submitRegistration`

**Auth:** required

Validates the registration payload (shared Zod schema), binds a resume via upload token, sets application status to `submitted`, and sends a confirmation email.

```typescript
{
  data: RegistrationPayload;
  resumeUploadToken?: string;
}
```

`submitRegistration` is an alias with the same handler.

Creates the applicant profile and application on first submit. Sign-in alone does not write to the app `users` table (aside from the minimal Convex Auth session record).

### `registrations:deleteResumeUpload`

**Auth:** none (capability-token gated)

Discards an unconsumed resume upload session and deletes orphaned storage.

```typescript
{ uploadToken: string }
```

### `applicant:claimLegacyRegistrationIfEligible`

**Auth:** required

After OTP sign-in, claims a single anonymous legacy registration matching the verified email.

```typescript
{ hackathonId?: string }
```

---

## Public actions

### `contact:submitContactMessage`

**Auth:** none

Validates and rate-limits the contact form, then sends email to `CONTACT_EMAIL_TO`.

```typescript
{
  name: string;
  email: string;
  subject?: string;
  message: string;
  website?: string;   // honeypot — must be empty
  clientKey?: string; // hashed client id for rate limiting
}
```

Rate limit: **5 submissions per 10 minutes** per client key.

---

## HTTP routes

Base URL: `VITE_CONVEX_SITE_URL`

### `POST /resume-upload`

Upload a PDF resume before submitting the application form.

**Auth:** browser origin allowlist (`REGISTRATION_ALLOWED_ORIGINS` + `SITE_URL` origin). No JWT required.

**Request headers:**

| Header | Value |
| --- | --- |
| `Content-Type` | `application/pdf` |
| `Origin` | Must match allowlist |

**Body:** raw PDF bytes (max **5 MB**)

**Success `201`:**

```json
{
  "storageId": "<convex-storage-id>",
  "uploadToken": "<64-char-hex-capability-token>"
}
```

**Errors:**

| Status | Condition |
| --- | --- |
| `403` | Origin not allowed |
| `413` | Empty or > 5 MB |
| `415` | Not `application/pdf` |
| `422` | Invalid PDF structure |
| `429` | Rate limit exceeded |
| `500` | Storage failure |

Rate limits: **5 uploads per client IP / 10 min**, **100 global / 10 min**.

Upload tokens expire in **30 minutes** and are consumed when calling `registrations:register`.

### `OPTIONS /resume-upload`

CORS preflight for resume upload.

---

## Internal functions

These are not callable from the public client. Listed for operators and tests.

### Rate limiting (`rateLimits`)

| Function | Purpose |
| --- | --- |
| `assertOtpSendAllowed` | Throws if OTP cooldown or hourly cap exceeded |
| `recordOtpSend` | Records an OTP send in `rateLimits` bucket `otp_send` |
| `clearOtpSendLimitsForEmail` | Clears OTP limit rows for an email (testing/admin) |
| `assertContactSubmissionAllowed` | Throws if contact rate limit exceeded |
| `recordContactSubmission` | Records contact submission in bucket `contact_form` |

### Resume pipeline (`registrations`)

| Function | Purpose |
| --- | --- |
| `reserveResumeUpload` | Rate-limit gate before storing PDF |
| `recordVerifiedResumeUpload` | Creates upload session after validation |
| `cleanupExpiredResumeUploads` | Purges expired sessions and stale rows (also cron) |

### Email (Node actions)

| Function | Purpose |
| --- | --- |
| `email/sendOtpEmail:sendOtpEmail` | Sends 6-digit OTP via SMTP |
| `email/sendContactEmail:sendContactEmail` | Forwards contact form |
| `email/sendApplicationConfirmationEmail:sendApplicationConfirmationEmail` | Post-submission confirmation |

### Admin / seed

| Function | Purpose |
| --- | --- |
| `admin:resetAllData` | Wipes all app data, auth tables, and storage |
| `seed:seedHackathon` | Inserts `hackuta-2026` hackathon if missing |

### Auth internals

| Function | Purpose |
| --- | --- |
| `auth:store` | Convex Auth internal DB access during sign-in/out |

---

## Admin queries

### `queries:getApplicationsByHackathon`

**Auth:** admin — caller’s `tokenIdentifier` must appear in `REGISTRATION_ADMIN_IDENTITY_KEYS`.

Lists all users with applications for a hackathon.

```typescript
{ hackathonId: string }
```

---

## Rate limits summary

| Bucket | Key | Limit | Window |
| --- | --- | --- | --- |
| `otp_send` | normalized email | 5 sends | 1 hour |
| `otp_send` | normalized email | 30 s cooldown | between sends |
| `contact_form` | client key hash | 5 submissions | 10 minutes |
| `resume_upload` | client IP hash | 5 uploads | 10 minutes |
| `resume_upload` | global | 100 uploads | 10 minutes |

---

## Data model

Schema: `convex/schema.ts`, application fields: `convex/applicationFields.ts`.

### `users`

Extends Convex Auth user records with app fields. Each user holds at most one embedded `applications` object.

Key fields: `email`, `identityKey`, `authSubject`, `displayName`, `isAnonymous`, `applications`.

### Embedded `applications`

| Field | Notes |
| --- | --- |
| `hackathonId` | e.g. `"hackuta-2026"` |
| `status` | `draft` \| `submitted` \| `accepted` \| `waitlisted` \| `rejected` \| `withdrawn` |
| `eligibilityStatus` | `unreviewed` \| `eligible` \| `ineligible` |
| `resumeStorageId` | PDF in Convex `_storage` |
| Applicant fields | name, school, demographics, MLH consents, etc. (see `shared/registration/schema.ts`) |

### `hackathons`

`slug`, `name`, `startsAt`, `endsAt`, `registrationOpensAt`, `registrationClosesAt`.

Seed record (`hackuta-2026`): Nov 14–15, 2026; registration opens Sep 1, 2026.

### `rateLimits`

`bucket`, `key`, `createdAt` — used for OTP, contact, and resume upload throttling.

### `resumeUploadSessions`

`token`, `createdAt`, `storageId`, `verifiedAt`, `consumedAt` — capability tokens from HTTP upload.

### Convex Auth tables

`authSessions`, `authAccounts`, `authRefreshTokens`, `authVerificationCodes`, `authVerifiers`, `authRateLimits` — managed by `@convex-dev/auth`.

---

## Scheduled jobs

| Schedule | Function |
| --- | --- |
| Every 15 minutes | `registrations:cleanupExpiredResumeUploads` |

Defined in `convex/crons.ts`.

---

## Frontend → API map

| UI surface | API |
| --- | --- |
| Sign-in OTP send/verify | `auth:signIn` |
| Sign-out | `auth:signOut` |
| OTP cooldown labels | `rateLimits:getOtpSendCooldown` |
| Legacy claim | `applicant:claimLegacyRegistrationIfEligible` |
| Route guards / `/` redirect | `applicant:getApplicantRoutingState` |
| Profile page | `applicant:getMyApplicantDashboard` |
| Resume upload widget | `POST /resume-upload` |
| Submit application | `registrations:register` |
| Discard resume | `registrations:deleteResumeUpload` |
| Contact form | `contact:submitContactMessage` |

---

## Validation

Registration payloads are validated server-side with the same Zod schema as the client:

- `shared/registration/schema.ts` — field rules and limits
- `shared/registration/constants.ts` — enums (gender, t-shirt size, etc.)
- `shared/contact/validation.ts` — contact form

Resume rules: `shared/registration/resume.ts` (PDF only, max 5 MB).
