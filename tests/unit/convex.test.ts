import { PDFDocument } from "pdf-lib";
import { convexTest } from "convex-test";
import { makeFunctionReference } from "convex/server";
import { describe, expect, it, vi } from "vitest";
import schema from "../../convex/schema";
import { RESUME_UPLOAD_BUCKET } from "../../convex/lib/rateLimitBuckets";
import { MIN_GRADUATION_YEAR } from "../../shared/registration/constants";

const modules = import.meta.glob("../../convex/**/*.ts", { eager: false });
const remove = makeFunctionReference<"mutation">("registrations:deleteResumeUpload");
const reserve = makeFunctionReference<"mutation">("registrations:reserveResumeUpload");
const cleanup = makeFunctionReference<"mutation">("registrations:cleanupExpiredResumeUploads");

type ConvexTestClient = {
  mutation: (name: string, args: unknown) => Promise<{
    ok: boolean;
    isNew?: boolean;
    userId?: string;
    registrationId?: string;
  }>;
  query: (name: string, args: unknown) => Promise<unknown>;
  withIdentity: (identity: { tokenIdentifier: string; subject?: string; email?: string; name?: string }) => ConvexTestClient;
  run: ReturnType<typeof convexTest>["run"];
  fetch: ReturnType<typeof convexTest>["fetch"];
};

const validRegistrationData = {
  firstName: "Sam",
  lastName: "Test",
  phone: "5551234567",
  age: 20,
  school: "UT Arlington",
  levelOfStudy: "Undergraduate - Junior",
  major: "Computer Science",
  graduationYear: MIN_GRADUATION_YEAR,
  gender: "Male",
  raceEthnicity: [] as string[],
  dietaryRestrictions: [] as string[],
  otherDietary: "",
  tshirtSize: "M",
  firstHackathon: true,
  hearAbout: "Discord",
  resumeStorageId: undefined,
  linkedin: undefined,
  github: undefined,
  portfolio: undefined,
  accessibilityNeeds: "",
  emergencyContactName: "Jane Test",
  emergencyContactPhone: "5559876543",
  codeOfConductAgreed: true,
  mlhDataSharingConsent: true,
  mlhCommunicationsConsent: false,
  hackathonId: "hackuta-2026",
};

const TEST_ORIGIN = "https://hackuta.test";
const uploadHeaders = {
  "Content-Type": "application/pdf",
  Origin: TEST_ORIGIN,
  "X-Test-Origin": TEST_ORIGIN,
  "X-Forwarded-For": "192.0.2.10",
};

const createTest = () => convexTest(schema, modules);
type TestInstance = ReturnType<typeof createTest>;

async function drainScheduledFunctions(client: ConvexTestClient) {
  await (client as unknown as TestInstance).finishInProgressScheduledFunctions();
}

async function seedHackathon(t: ConvexTestClient) {
  await t.mutation("seed:seedHackathon", {});
}

async function authTest(identity: {
  tokenIdentifier: string;
  subject?: string;
  email?: string;
  name?: string;
} = { tokenIdentifier: "email|applicant@example.com", email: "applicant@example.com" }) {
  const t = createTest().withIdentity(identity) as unknown as ConvexTestClient;
  await seedHackathon(t);
  await t.mutation("registrations:syncUser", {});
  return t;
}

type RunnableTest = Pick<ReturnType<typeof createTest>, "run">;

async function pdfBytes() {
  const pdf = await PDFDocument.create();
  pdf.addPage([612, 792]);
  return new Uint8Array(await pdf.save()).buffer as ArrayBuffer;
}

async function storeFile(
  t: RunnableTest,
  contents: BlobPart,
  type = "application/pdf",
) {
  const storageId = await t.run((ctx) => ctx.storage.store(new Blob([contents], { type })));
  await t.run((ctx) => (ctx.db.patch as unknown as (
    id: string,
    value: { contentType: string },
  ) => Promise<void>)(storageId, { contentType: type }));
  return storageId;
}

async function verifiedUpload(t: RunnableTest, token: string = crypto.randomUUID()) {
  const storageId = await storeFile(t, await pdfBytes());
  await t.run((ctx) => ctx.db.insert("resumeUploadSessions", {
    token,
    storageId,
    createdAt: Date.now(),
    verifiedAt: Date.now(),
  }));
  return { storageId, token };
}

describe("convex registrations", () => {
  it("creates and updates registrations", async () => {
    const t = await authTest();

    const first = await t.mutation("registrations:register", {
      data: validRegistrationData,
    });
    expect(first.ok).toBe(true);
    expect(first.isNew).toBe(true);

    await drainScheduledFunctions(t);

    await expect(t.mutation("registrations:register", {
      data: validRegistrationData,
    })).rejects.toThrow("already submitted");

    const draft = await t.mutation("registrations:saveDraft", {
      data: { ...validRegistrationData, major: "Engineering" },
    });
    expect(draft.ok).toBe(true);
  }, 15_000);

  it("stores a parser-verified PDF only when the matching capability is supplied", async () => {
    const t = await authTest();
    const upload = await verifiedUpload(t);
    await t.mutation("registrations:register", {
      data: { ...validRegistrationData, resumeStorageId: upload.storageId },
      resumeUploadToken: upload.token,
    });
    const user = await t.run((ctx) => ctx.db.query("users").first());
    expect(user?.applications?.resumeStorageId).toBe(upload.storageId);
    const session = await t.run((ctx) => ctx.db.query("resumeUploadSessions").first());
    expect(session?.consumedAt).toEqual(expect.any(Number));
  }, 10_000);

  it("rejects a storage ID without its matching upload capability", async () => {
    const t = await authTest();
    const upload = await verifiedUpload(t);
    await expect(t.mutation("registrations:register", {
      data: { ...validRegistrationData, resumeStorageId: upload.storageId },
      resumeUploadToken: "wrong-token",
    })).rejects.toThrow("valid PDF resume");
  });

  it.each([
    ["application/pdf", ""],
    ["text/plain", "not a pdf"],
    ["application/pdf", "x".repeat(5 * 1024 * 1024 + 1)],
  ])("rejects invalid stored file metadata (%s)", async (type, contents) => {
    const t = await authTest();
    const storageId = await storeFile(t, contents, type);
    await expect(t.mutation("registrations:register", {
      data: { ...validRegistrationData, resumeStorageId: storageId },
    })).rejects.toThrow("valid PDF resume");
  });

  it("rate limits by an API-derived client key, independent of applicant PII", async () => {
    const t = createTest();
    for (let index = 0; index < 5; index += 1) {
      await t.mutation(reserve, { requestKey: "hashed-network-client" });
    }
    await expect(t.mutation(reserve, { requestKey: "hashed-network-client" }))
      .rejects.toThrow("Too many resume upload attempts");
  });

  it("allows another upload once the rate-limit window passes", async () => {
    const t = createTest();
    for (let index = 0; index < 5; index += 1) {
      await t.mutation(reserve, { requestKey: "hashed-network-client" });
    }
    const now = Date.now();
    const clock = vi.spyOn(Date, "now").mockReturnValue(now + 11 * 60 * 1000);
    await expect(t.mutation(reserve, { requestKey: "hashed-network-client" })).resolves.toBeNull();
    clock.mockRestore();
  });

  it("accepts the submitRegistration alias", async () => {
    const t = await authTest();
    await expect(t.mutation("registrations:submitRegistration", { data: validRegistrationData }))
      .resolves.toMatchObject({ ok: true, isNew: true });
  });

  it("rejects invalid registration payloads", async () => {
    const t = await authTest();
    await expect(t.mutation("registrations:register", {
      data: { ...validRegistrationData, age: -1 },
    })).rejects.toThrow("Invalid registration data.");
  });

  it("auto-seeds hackuta-2026 on first registration", async () => {
    const t = createTest().withIdentity({
      tokenIdentifier: "email|applicant@example.com",
      email: "applicant@example.com",
    }) as unknown as ConvexTestClient;
    await t.mutation("registrations:syncUser", {});

    await expect(
      t.query("queries:getHackathonBySlug", { slug: "hackuta-2026" }),
    ).resolves.toBeNull();
    await t.mutation("registrations:register", { data: validRegistrationData });
    await expect(
      t.query("queries:getHackathonBySlug", { slug: "hackuta-2026" }),
    ).resolves.toMatchObject({ slug: "hackuta-2026", name: "HackUTA 2026" });
  });

  it("rejects unauthenticated registration", async () => {
    const t = createTest() as unknown as ConvexTestClient;

    await expect(
      t.mutation("registrations:register", { data: validRegistrationData }),
    ).rejects.toThrow("Authentication required.");
  });

  it("reuses one user for repeated synchronization", async () => {
    const t = createTest().withIdentity({
      tokenIdentifier: "email|sam@example.com",
      email: "sam@example.com",
    }) as unknown as ConvexTestClient;

    const first = await t.mutation("registrations:syncUser", {
      displayName: "Sam Test",
    });
    const second = await t.mutation("registrations:syncUser", {
      displayName: "Sam Updated",
    });

    expect(first.userId).toBe(second.userId);
    await expect(t.query("queries:getCurrentUser", {})).resolves.toMatchObject({
      identityKey: "email|sam@example.com",
      email: "sam@example.com",
      displayName: "Sam Updated",
    });
  });

  it("reuses one user when the identity key changes but the auth subject stays the same", async () => {
    const base = createTest();
    const subject = "stable-auth-subject";
    const first = base.withIdentity({
      tokenIdentifier: "browser-one",
      subject,
      email: "sam@example.com",
    }) as unknown as ConvexTestClient;
    const firstSync = await first.mutation("registrations:syncUser", {});

    const second = base.withIdentity({
      tokenIdentifier: "browser-two",
      subject,
      email: "sam@example.com",
    }) as unknown as ConvexTestClient;
    const secondSync = await second.mutation("registrations:syncUser", {});

    expect(firstSync.userId).toBe(secondSync.userId);
    await expect(second.query("queries:getCurrentUser", {})).resolves.toMatchObject({
      identityKey: "browser-two",
      authSubject: subject,
      email: "sam@example.com",
    });
    expect(await second.run((ctx) => ctx.db.query("users").collect())).toHaveLength(1);
  });

  it("rejects duplicate normalized emails", async () => {
    const base = createTest();
    const t = base.withIdentity({
      tokenIdentifier: "email|sam@example.com",
      email: "sam@example.com",
    }) as unknown as ConvexTestClient;

    await t.mutation("registrations:syncUser", {});

    const duplicateUser = base.withIdentity({
      tokenIdentifier: "email|other@example.com",
      email: "sam@example.com",
    }) as unknown as ConvexTestClient;
    await expect(
      duplicateUser.mutation("registrations:syncUser", {}),
    ).rejects.toThrow("already associated");
  });

  it("rejects unauthenticated user synchronization", async () => {
    const t = createTest() as unknown as ConvexTestClient;

    await expect(t.mutation("registrations:syncUser", {})).rejects.toThrow(
      "Authentication required.",
    );
  });
});

describe("resume HTTP validation and lifecycle", () => {
  it("handles CORS preflight without a response body", async () => {
    const t = createTest();
    const preflight = await t.fetch("/resume-upload", {
      method: "OPTIONS",
      headers: { Origin: TEST_ORIGIN, "X-Test-Origin": TEST_ORIGIN },
    });
    expect(preflight.status).toBe(204);
    expect(await preflight.text()).toBe("");
  });

  it("rejects uploads without an allowed browser origin", async () => {
    const t = createTest();
    const result = await t.fetch("/resume-upload", {
      method: "POST",
      headers: { "Content-Type": "application/pdf", "X-Forwarded-For": "192.0.2.10" },
      body: await pdfBytes(),
    });
    expect(result.status).toBe(403);
  });

  it("rejects uploads from a disallowed origin", async () => {
    const t = createTest();
    const result = await t.fetch("/resume-upload", {
      method: "POST",
      headers: {
        "Content-Type": "application/pdf",
        Origin: "https://evil.example",
        "X-Forwarded-For": "192.0.2.10",
      },
      body: await pdfBytes(),
    });
    expect(result.status).toBe(403);
  });

  it("parses, stores, and binds a valid PDF through the HTTP upload route", async () => {
    const t = await authTest();
    const result = await t.fetch("/resume-upload", {
      method: "POST",
      headers: uploadHeaders,
      body: await pdfBytes(),
    });
    expect(result.status).toBe(201);
    const upload = await result.json() as { storageId: string; uploadToken: string };
    await t.run((ctx) => (ctx.db.patch as unknown as (
      id: string,
      value: { contentType: string },
    ) => Promise<void>)(upload.storageId, { contentType: "application/pdf" }));
    await expect(t.mutation("registrations:register", {
      data: { ...validRegistrationData, resumeStorageId: upload.storageId },
      resumeUploadToken: upload.uploadToken,
    })).resolves.toMatchObject({ ok: true, isNew: true });
  });

  it("rejects a file that only has a PDF-looking prefix", async () => {
    const t = createTest();
    const result = await t.fetch("/resume-upload", {
      method: "POST",
      headers: uploadHeaders,
      body: "%PDF-1.7\nnot actually a PDF",
    });
    expect(result.status).toBe(422);
    expect(await t.run((ctx) => ctx.db.system.query("_storage").collect())).toEqual([]);
  });

  it("accepts PDF content types with parameters", async () => {
    const t = createTest();
    const result = await t.fetch("/resume-upload", {
      method: "POST",
      headers: { ...uploadHeaders, "Content-Type": "application/pdf; charset=binary" },
      body: await pdfBytes(),
    });
    expect(result.status).toBe(201);
  });

  it("rejects non-PDF content types before reading the body", async () => {
    const t = createTest();
    const result = await t.fetch("/resume-upload", {
      method: "POST",
      headers: { ...uploadHeaders, "Content-Type": "text/plain" },
      body: await pdfBytes(),
    });
    expect(result.status).toBe(415);
  });

  it("rejects empty uploads and oversized bodies", async () => {
    const t = createTest();
    expect((await t.fetch("/resume-upload", {
      method: "POST",
      headers: uploadHeaders,
      body: new Uint8Array(),
    })).status).toBe(413);

    expect((await t.fetch("/resume-upload", {
      method: "POST",
      headers: uploadHeaders,
      body: new Uint8Array(5 * 1024 * 1024 + 1),
    })).status).toBe(413);
  });

  it("rate limits repeated uploads from the same client address", async () => {
    const t = createTest();
    for (let index = 0; index < 5; index += 1) {
      const ok = await t.fetch("/resume-upload", {
        method: "POST",
        headers: uploadHeaders,
        body: await pdfBytes(),
      });
      expect(ok.status).toBe(201);
    }
    const limited = await t.fetch("/resume-upload", {
      method: "POST",
      headers: uploadHeaders,
      body: await pdfBytes(),
    });
    expect(limited.status).toBe(429);
  });

  it("rejects CORS preflight from a disallowed origin", async () => {
    const t = createTest();
    const preflight = await t.fetch("/resume-upload", {
      method: "OPTIONS",
      headers: { Origin: "https://evil.example" },
    });
    expect(preflight.status).toBe(403);
  });

  it("keeps an attached resume and permits idempotent resubmission", async () => {
    const t = await authTest();
    const upload = await verifiedUpload(t);
    const data = { ...validRegistrationData, resumeStorageId: upload.storageId };
    await t.mutation("registrations:register", { data, resumeUploadToken: upload.token });
    await t.mutation("registrations:deleteResumeUpload", { uploadToken: upload.token });
    expect(await t.run((ctx) => ctx.db.system.get("_storage", upload.storageId))).not.toBeNull();
    await expect(t.mutation("registrations:register", { data })).rejects.toThrow(
      "already submitted",
    );
  });

  it("does not let another application claim a submitted resume", async () => {
    const base = createTest();
    const owner = base.withIdentity({
      tokenIdentifier: "email|owner@example.com",
      email: "owner@example.com",
    }) as unknown as ConvexTestClient;
    await seedHackathon(owner);
    await owner.mutation("registrations:syncUser", {});
    const upload = await verifiedUpload(owner);
    await owner.mutation("registrations:register", {
      data: { ...validRegistrationData, resumeStorageId: upload.storageId },
      resumeUploadToken: upload.token,
    });

    const otherApplicant = base.withIdentity({
      tokenIdentifier: "email|other@example.com",
      email: "other@example.com",
    }) as unknown as ConvexTestClient;
    await otherApplicant.mutation("registrations:syncUser", {});
    await expect(otherApplicant.mutation("registrations:register", {
      data: { ...validRegistrationData, firstName: "Other", resumeStorageId: upload.storageId },
    })).rejects.toThrow("already attached");
  });

  it("ignores delete requests for consumed upload capabilities", async () => {
    const t = await authTest();
    const upload = await verifiedUpload(t);
    await t.mutation("registrations:register", {
      data: { ...validRegistrationData, resumeStorageId: upload.storageId },
      resumeUploadToken: upload.token,
    });
    await expect(t.mutation("registrations:deleteResumeUpload", { uploadToken: upload.token })).resolves.toEqual({ ok: true });
    expect(await t.run((ctx) => ctx.db.system.get("_storage", upload.storageId))).not.toBeNull();
  });

  it("deletes an unconsumed upload only with its capability", async () => {
    const t = createTest();
    const upload = await verifiedUpload(t);
    await t.mutation(remove, { uploadToken: "guessed-or-wrong-token" });
    expect(await t.run((ctx) => ctx.db.system.get("_storage", upload.storageId))).not.toBeNull();
    await t.mutation(remove, { uploadToken: upload.token });
    expect(await t.run((ctx) => ctx.db.system.get("_storage", upload.storageId))).toBeNull();
  });

  it("deletes replaced resumes", async () => {
    const t = await authTest();
    const first = await verifiedUpload(t);
    const second = await verifiedUpload(t);
    await t.mutation("registrations:saveDraft", {
      data: { ...validRegistrationData, resumeStorageId: first.storageId },
      resumeUploadToken: first.token,
    });
    await t.mutation("registrations:saveDraft", {
      data: { ...validRegistrationData, resumeStorageId: second.storageId },
      resumeUploadToken: second.token,
    });
    await t.mutation("registrations:register", {
      data: { ...validRegistrationData, resumeStorageId: second.storageId },
      resumeUploadToken: second.token,
    });
    expect(await t.run((ctx) => ctx.db.system.get("_storage", first.storageId))).toBeNull();
    expect(await t.run((ctx) => ctx.db.system.get("_storage", second.storageId))).not.toBeNull();
  });

  it("scheduled cleanup removes expired rate-limit records", async () => {
    const t = createTest();
    const stale = Date.now() - 31 * 60 * 1000;
    await t.run((ctx) => ctx.db.insert("rateLimits", {
      bucket: RESUME_UPLOAD_BUCKET,
      key: "stale",
      createdAt: stale,
    }));
    const clock = vi.spyOn(Date, "now").mockReturnValue(Date.now());
    await t.mutation(cleanup, {});
    expect(await t.run((ctx) => ctx.db.query("rateLimits").collect())).toEqual([]);
    clock.mockRestore();
  });

  it("scheduled cleanup removes expired unassociated files but preserves attached files", async () => {
    const t = await authTest();
    const orphan = await verifiedUpload(t, "orphan-token");
    const attached = await verifiedUpload(t, "attached-token");
    await t.mutation("registrations:register", {
      data: { ...validRegistrationData, resumeStorageId: attached.storageId },
      resumeUploadToken: attached.token,
    });
    const now = Date.now();
    const clock = vi.spyOn(Date, "now").mockReturnValue(now + 31 * 60 * 1000);
    await t.mutation("registrations:cleanupExpiredResumeUploads", {});
    expect(await t.run((ctx) => ctx.db.system.get("_storage", orphan.storageId))).toBeNull();
    expect(await t.run((ctx) => ctx.db.system.get("_storage", attached.storageId))).not.toBeNull();
    clock.mockRestore();
  });
});

describe("convex queries", () => {
  it("returns null for missing records", async () => {
    const t = createTest() as unknown as ConvexTestClient;

    await expect(t.query("queries:getHackathonBySlug", { slug: "missing" })).resolves.toBeNull();
    await expect(t.query("queries:getMyApplication", {})).rejects.toThrow(
      "Authentication required.",
    );
  });

  it("seeds hackuta-2026 idempotently and finds it by slug", async () => {
    const t = createTest() as unknown as ConvexTestClient;

    const first = await t.mutation("seed:seedHackathon", {});
    const second = await t.mutation("seed:seedHackathon", {});

    expect(first).toBe(second);
    await expect(
      t.query("queries:getHackathonBySlug", { slug: "hackuta-2026" }),
    ).resolves.toMatchObject({ slug: "hackuta-2026", name: "HackUTA 2026" });
  });

  it("returns null when the authenticated user has no application", async () => {
    const t = createTest().withIdentity({
      tokenIdentifier: "provider-user",
      email: "sam@example.com",
    }) as unknown as ConvexTestClient;
    await seedHackathon(t);
    await t.mutation("registrations:syncUser", {});

    await expect(t.query("queries:getMyApplication", {})).resolves.toBeNull();
  });

  it("returns the synchronized current user", async () => {
    const t = createTest().withIdentity({
      tokenIdentifier: "provider-user",
      email: "sam@example.com",
      name: "Sam Test",
    }) as unknown as ConvexTestClient;
    await seedHackathon(t);

    await t.mutation("registrations:syncUser", {});

    await expect(t.query("queries:getCurrentUser", {})).resolves.toMatchObject({
      identityKey: "provider-user",
      email: "sam@example.com",
      displayName: "Sam Test",
    });
  });

  it("rejects a provider identity that has not been synchronized", async () => {
    const t = createTest().withIdentity({
      tokenIdentifier: "unsynchronized-user",
    }) as unknown as ConvexTestClient;
    await seedHackathon(t);

    await expect(t.query("queries:getCurrentUser", {})).rejects.toThrow(
      "has not been synchronized",
    );
  });

  it("allows owned application reads and admin hackathon listings", async () => {
    const base = createTest();
    vi.stubEnv("REGISTRATION_ADMIN_IDENTITY_KEYS", "email|sam@example.com");
    const t = base.withIdentity({
      tokenIdentifier: "email|sam@example.com",
      email: "sam@example.com",
    }) as unknown as ConvexTestClient;
    await seedHackathon(t);
    await t.mutation("registrations:syncUser", {});
    await t.mutation("registrations:register", {
      data: validRegistrationData,
    });

    await expect(
      t.query("queries:getMyApplication", {}),
    ).resolves.toMatchObject({ status: "submitted", hackathonId: "hackuta-2026" });

    const foreignUser = base.withIdentity({
      tokenIdentifier: "email|foreign@example.com",
      email: "foreign@example.com",
    }) as unknown as ConvexTestClient;
    await foreignUser.mutation("registrations:syncUser", {});
    await expect(foreignUser.query("queries:getMyApplication", {})).resolves.toBeNull();

    await expect(
      t.query("queries:getApplicationsByHackathon", { hackathonId: "hackuta-2026" }),
    ).resolves.toHaveLength(1);

    await expect(
      foreignUser.query("queries:getApplicationsByHackathon", { hackathonId: "hackuta-2026" }),
    ).rejects.toThrow("Not authorized to access hackathon registrations");
  });
});

describe("convex applicant auth flows", () => {
  it("returns unauthenticated routing state without identity", async () => {
    const t = createTest() as unknown as ConvexTestClient;
    await expect(t.query("applicant:getApplicantRoutingState", {})).resolves.toMatchObject({
      authenticated: false,
      verifiedEmail: null,
      hasRegistration: false,
    });
  });

  it("returns routing state for authenticated users", async () => {
    const t = await authTest();
    await expect(t.query("applicant:getApplicantRoutingState", {})).resolves.toMatchObject({
      authenticated: true,
      verifiedEmail: "applicant@example.com",
      hasRegistration: false,
    });
  });

  it("returns hasSubmittedRegistration false for draft status", async () => {
    const t = await authTest();
    await t.mutation("registrations:saveDraft", { data: validRegistrationData });
    await expect(t.query("applicant:getApplicantRoutingState", {})).resolves.toMatchObject({
      hasRegistration: true,
      hasSubmittedRegistration: false,
      registrationStatus: "draft",
    });
  });

  it("returns none_found when no legacy registrations exist", async () => {
    const t = await authTest({ tokenIdentifier: "email|newuser@example.com", email: "newuser@example.com" });
    await expect(t.mutation("applicant:claimLegacyRegistrationIfEligible", {})).resolves.toMatchObject({
      claimed: false,
      reason: "none_found",
    });
  });

  it("returns already_owned when user already has a registration", async () => {
    const t = await authTest();
    await t.mutation("registrations:register", { data: validRegistrationData });
    await drainScheduledFunctions(t);
    await expect(t.mutation("applicant:claimLegacyRegistrationIfEligible", {})).resolves.toMatchObject({
      claimed: false,
      reason: "already_owned",
    });
  });

  it("claims a single legacy anonymous registration after verified sign-in", async () => {
    const base = createTest();
    await seedHackathon(base as unknown as ConvexTestClient);

    const anonymousUserId = await base.run(async (ctx) => {
      return ctx.db.insert("users", {
        isAnonymous: true,
        createdAt: Date.now(),
        updatedAt: Date.now(),
      });
    });

    await base.run(async (ctx) => {
      await ctx.db.patch(anonymousUserId, {
        applications: {
          hackathonId: "hackuta-2026",
          status: "submitted",
          eligibilityStatus: "unreviewed",
          firstName: validRegistrationData.firstName,
          lastName: validRegistrationData.lastName,
          email: "legacy@example.com",
          submittedAt: Date.now(),
          updatedAt: Date.now(),
        },
      });
    });

    const t = base.withIdentity({
      tokenIdentifier: "email|legacy@example.com",
      email: "legacy@example.com",
    }) as unknown as ConvexTestClient;

    await expect(t.mutation("applicant:claimLegacyRegistrationIfEligible", {})).resolves.toMatchObject({
      claimed: true,
    });

    await expect(t.query("applicant:getApplicantRoutingState", {})).resolves.toMatchObject({
      hasRegistration: true,
      registrationStatus: "submitted",
    });
  });

  it("does not claim ambiguous legacy registrations", async () => {
    const base = createTest();
    await seedHackathon(base as unknown as ConvexTestClient);

    for (let index = 0; index < 2; index += 1) {
      const anonymousUserId = await base.run(async (ctx) => ctx.db.insert("users", {
        isAnonymous: true,
        createdAt: Date.now(),
        updatedAt: Date.now(),
      }));
      await base.run(async (ctx) => {
        await ctx.db.patch(anonymousUserId, {
          applications: {
            hackathonId: "hackuta-2026",
            status: "submitted",
            eligibilityStatus: "unreviewed",
            firstName: validRegistrationData.firstName,
            lastName: validRegistrationData.lastName,
            email: "legacy@example.com",
            submittedAt: Date.now(),
            updatedAt: Date.now(),
          },
        });
      });
    }

    const t = base.withIdentity({
      tokenIdentifier: "email|legacy@example.com",
      email: "legacy@example.com",
    }) as unknown as ConvexTestClient;

    await expect(t.mutation("applicant:claimLegacyRegistrationIfEligible", {})).resolves.toMatchObject({
      claimed: false,
      reason: "ambiguous",
    });
  });

  it("stores the verified email on submitted registrations", async () => {
    const t = await authTest();
    await t.mutation("registrations:register", { data: validRegistrationData });
    await drainScheduledFunctions(t);
    const user = await t.run((ctx) => ctx.db.query("users").first());
    expect(user?.applications?.email).toBe("applicant@example.com");
  });

  it("returns dashboard data with registration and timeline", async () => {
    const t = await authTest();
    await t.mutation("registrations:register", { data: validRegistrationData });
    await drainScheduledFunctions(t);

    await expect(t.query("applicant:getMyApplicantDashboard", {})).resolves.toMatchObject({
      profile: {
        verifiedEmail: "applicant@example.com",
      },
      registration: {
        status: "submitted",
        resumeStatus: "none",
      },
    });
  });

  it("includes hackathon event timeline when hackathon exists", async () => {
    const t = await authTest();
    const now = Date.now();
    await t.run(async (ctx) => {
      await ctx.db.insert("hackathons", {
        slug: "hackuta-2026",
        name: "HackUTA 2026",
        startsAt: now + 7 * 24 * 60 * 60 * 1000,
        endsAt: now + 9 * 24 * 60 * 60 * 1000,
        registrationOpensAt: now - 30 * 24 * 60 * 60 * 1000,
        registrationClosesAt: now + 1 * 24 * 60 * 60 * 1000,
      });
    });

    const dashboard = await t.query("applicant:getMyApplicantDashboard", {}) as {
      timeline: Array<{ id: string }>;
      hackathon: { name: string } | null;
    };

    expect(dashboard.hackathon?.name).toBe("HackUTA 2026");
    expect(dashboard.timeline.some((event) => event.id === "event-starts")).toBe(true);
    expect(dashboard.timeline.some((event) => event.id === "event-ends")).toBe(true);
  });

  it("returns resume status as attached when resume exists", async () => {
    const t = await authTest();
    const upload = await verifiedUpload(t);
    await t.mutation("registrations:register", {
      data: { ...validRegistrationData, resumeStorageId: upload.storageId },
      resumeUploadToken: upload.token,
    });
    await drainScheduledFunctions(t);

    await expect(t.query("applicant:getMyApplicantDashboard", {})).resolves.toMatchObject({
      registration: {
        resumeStatus: "attached",
      },
    });
  });

  it("includes reviewed status labels in the applicant timeline", async () => {
    const t = await authTest();
    await t.mutation("registrations:register", { data: validRegistrationData });
    await drainScheduledFunctions(t);

    await t.run(async (ctx) => {
      const user = await ctx.db.query("users").first();
      if (!user?.applications) {
        throw new Error("Expected application");
      }
      await ctx.db.patch(user._id, {
        applications: {
          ...user.applications,
          status: "accepted",
          reviewedAt: Date.now(),
        },
      });
    });

    const dashboard = await t.query("applicant:getMyApplicantDashboard", {}) as {
      timeline: Array<{ label: string }>;
    };

    expect(dashboard.timeline.some((event) => event.label === "Accepted")).toBe(true);
  });

  it("returns no_verified_email when claiming legacy registration without email", async () => {
    const t = createTest().withIdentity({
      tokenIdentifier: "email|",
    }) as unknown as ConvexTestClient;

    await expect(t.mutation("applicant:claimLegacyRegistrationIfEligible", {})).resolves.toMatchObject({
      claimed: false,
      reason: "no_verified_email",
    });
  });
});
