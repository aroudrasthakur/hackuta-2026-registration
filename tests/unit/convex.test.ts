import { PDFDocument } from "pdf-lib";
import { convexTest } from "convex-test";
import { makeFunctionReference } from "convex/server";
import { describe, expect, it, vi } from "vitest";
import schema from "../../convex/schema";
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

async function seedHackathon(t: ConvexTestClient) {
  await t.mutation("seed:seedHackathon", {});
}

async function authTest(identity: {
  tokenIdentifier: string;
  subject?: string;
  email?: string;
  name?: string;
} = { tokenIdentifier: "browser-one" }) {
  const t = createTest().withIdentity(identity) as unknown as ConvexTestClient;
  await seedHackathon(t);
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

    const second = await t.mutation("registrations:register", {
      data: validRegistrationData,
    });
    expect(second.isNew).toBe(false);

    const draft = await t.mutation("registrations:saveDraft", {
      data: { ...validRegistrationData, major: "Engineering" },
    });
    expect(draft.ok).toBe(true);
  });

  it("stores a parser-verified PDF only when the matching capability is supplied", async () => {
    const t = await authTest();
    const upload = await verifiedUpload(t);
    await t.mutation("registrations:register", {
      data: { ...validRegistrationData, resumeStorageId: upload.storageId },
      resumeUploadToken: upload.token,
    });
    const registration = await t.run((ctx) => ctx.db.query("registrations").first());
    expect(registration?.answers.resumeStorageId).toBe(upload.storageId);
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
      tokenIdentifier: "browser-one",
    }) as unknown as ConvexTestClient;

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
      tokenIdentifier: "browser-one",
    }) as unknown as ConvexTestClient;

    const first = await t.mutation("registrations:syncUser", {
      email: " Sam@Example.com ",
      displayName: "Sam Test",
    });
    const second = await t.mutation("registrations:syncUser", {
      email: "sam@example.com",
      displayName: "Sam Updated",
    });

    expect(first.userId).toBe(second.userId);
    await expect(t.query("queries:getCurrentUser", {})).resolves.toMatchObject({
      identityKey: "browser-one",
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
    }) as unknown as ConvexTestClient;
    const firstSync = await first.mutation("registrations:syncUser", {
      email: "sam@example.com",
    });

    const second = base.withIdentity({
      tokenIdentifier: "browser-two",
      subject,
    }) as unknown as ConvexTestClient;
    const secondSync = await second.mutation("registrations:syncUser", {
      email: "sam@example.com",
    });

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
      tokenIdentifier: "browser-one",
    }) as unknown as ConvexTestClient;

    await t.mutation("registrations:syncUser", {
      email: "sam@example.com",
    });

    const duplicateUser = base.withIdentity({
      tokenIdentifier: "browser-two",
    }) as unknown as ConvexTestClient;
    await expect(
      duplicateUser.mutation("registrations:syncUser", {
        email: " SAM@EXAMPLE.COM ",
      }),
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
    await expect(t.mutation("registrations:register", { data })).resolves.toMatchObject({ ok: true, isNew: false });
  });

  it("does not let another application claim a submitted resume", async () => {
    const base = createTest();
    const owner = base.withIdentity({ tokenIdentifier: "resume-owner" }) as unknown as ConvexTestClient;
    await seedHackathon(owner);
    const upload = await verifiedUpload(owner);
    await owner.mutation("registrations:register", {
      data: { ...validRegistrationData, resumeStorageId: upload.storageId },
      resumeUploadToken: upload.token,
    });

    const otherApplicant = base.withIdentity({ tokenIdentifier: "other-applicant" }) as unknown as ConvexTestClient;
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
    for (const upload of [first, second]) {
      await t.mutation("registrations:register", {
        data: { ...validRegistrationData, resumeStorageId: upload.storageId },
        resumeUploadToken: upload.token,
      });
    }
    expect(await t.run((ctx) => ctx.db.system.get("_storage", first.storageId))).toBeNull();
    expect(await t.run((ctx) => ctx.db.system.get("_storage", second.storageId))).not.toBeNull();
  });

  it("scheduled cleanup removes expired rate-limit records", async () => {
    const t = createTest();
    const stale = Date.now() - 31 * 60 * 1000;
    await t.run((ctx) => ctx.db.insert("resumeUploadRequests", { userKey: "stale", createdAt: stale }));
    const clock = vi.spyOn(Date, "now").mockReturnValue(Date.now());
    await t.mutation(cleanup, {});
    expect(await t.run((ctx) => ctx.db.query("resumeUploadRequests").collect())).toEqual([]);
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
    await expect(t.query("queries:getRegistrationsByUser", { userId: "missing" })).rejects.toThrow(
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

  it("only returns registrations for the authenticated user", async () => {
    const t = createTest().withIdentity({
      tokenIdentifier: "provider-user",
      email: "sam@example.com",
    }) as unknown as ConvexTestClient;
    await seedHackathon(t);
    const synced = await t.mutation("registrations:syncUser", {});

    await expect(
      t.query("queries:getRegistrationsByUser", { userId: synced.userId }),
    ).resolves.toEqual([]);

    await expect(
      t.query("queries:getRegistrationsByUser", { userId: "different-user" }),
    ).rejects.toThrow("Not authorized");
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

  it("allows owned registration reads and rejects missing or foreign records", async () => {
    const base = createTest();
    const t = base.withIdentity({
      tokenIdentifier: "provider-user",
    }) as unknown as ConvexTestClient;
    await seedHackathon(t);
    const user = await t.mutation("registrations:syncUser", {});
    const created = await t.mutation("registrations:register", {
      data: validRegistrationData,
    });

    await expect(
      t.query("queries:getRegistration", { registrationId: created.registrationId }),
    ).resolves.toMatchObject({ userId: user.userId });

    const foreignUser = base.withIdentity({
      tokenIdentifier: "foreign-user",
    }) as unknown as ConvexTestClient;
    await foreignUser.mutation("registrations:syncUser", {});
    await expect(
      foreignUser.query("queries:getRegistration", { registrationId: created.registrationId }),
    ).rejects.toThrow("Not authorized");

    await expect(
      t.query("queries:getRegistrationsByHackathon", { hackathonId: "hackuta-2026" }),
    ).resolves.toHaveLength(1);

    await expect(
      foreignUser.query("queries:getRegistrationsByHackathon", { hackathonId: "hackuta-2026" }),
    ).rejects.toThrow("Not authorized to access hackathon registrations");
  });
});
