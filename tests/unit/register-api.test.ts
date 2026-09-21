import { afterEach, describe, expect, it, vi } from "vitest";
import { MIN_GRADUATION_YEAR } from "../../shared/registration/constants";
import type { RegistrationPayload } from "../../shared/registration/types";

const { mutationMock } = vi.hoisted(() => ({
  mutationMock: vi.fn(),
}));

vi.mock("../../src/convex/client", () => ({
  getConvexClient: () => ({ mutation: mutationMock }),
  normalizeConvexUrl: (url: string | undefined) => {
    const trimmed = url?.trim();
    if (!trimmed) return undefined;
    return trimmed.replace(/\/+$/, "");
  },
}));

const payload: RegistrationPayload = {
  firstName: "Sam",
  lastName: "Test",
  phone: "5551234567",
  age: 20,
  school: "UT Arlington",
  levelOfStudy: "Undergraduate - Junior",
  major: "Computer Science",
  graduationYear: MIN_GRADUATION_YEAR,
  gender: "Male",
  raceEthnicity: [],
  dietaryRestrictions: [],
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

const session = { storageId: "resume-id", uploadToken: "upload-token" };

describe("uploadResume", () => {
  afterEach(() => {
    vi.unstubAllEnvs();
    vi.restoreAllMocks();
    mutationMock.mockReset();
  });

  it.each([
    { storageId: 42, uploadToken: "token" },
    { storageId: "", uploadToken: "token" },
    { storageId: "resume-id", uploadToken: "" },
    {},
  ])("rejects malformed upload responses (%j)", async (response) => {
    vi.stubEnv("VITE_CONVEX_URL", "https://example.convex.cloud");
    vi.resetModules();
    const fetchMock = vi.spyOn(globalThis, "fetch")
      .mockResolvedValueOnce(new Response(JSON.stringify(response), { status: 201 }));
    const { uploadResume } = await import("../../src/pages/Register/registerApi");
    await expect(uploadResume(new File(["%PDF-1.7"], "resume.pdf"))).rejects.toThrow();
    expect(fetchMock).toHaveBeenCalledTimes(1);
  });

  it("rejects an invalid file before contacting the upload API", async () => {
    const fetchMock = vi.spyOn(globalThis, "fetch");
    const { uploadResume } = await import("../../src/pages/Register/registerApi");
    await expect(uploadResume(new File(["text"], "resume.txt"))).rejects.toThrow("Please select a PDF");
    expect(fetchMock).not.toHaveBeenCalled();
  });

  it("does not submit the application when uploading fails", async () => {
    vi.stubEnv("VITE_CONVEX_URL", "https://example.convex.cloud");
    vi.resetModules();
    const fetchMock = vi.spyOn(globalThis, "fetch")
      .mockResolvedValueOnce(new Response("failed", { status: 500 }));
    const { uploadResume } = await import("../../src/pages/Register/registerApi");
    await expect(uploadResume(new File(["%PDF-1.7"], "resume.pdf"))).rejects.toThrow();
    expect(fetchMock).toHaveBeenCalledTimes(1);
  });

  it("returns a server-issued upload session", async () => {
    vi.stubEnv("VITE_CONVEX_URL", "https://example.convex.cloud");
    vi.resetModules();
    vi.spyOn(globalThis, "fetch")
      .mockResolvedValueOnce(new Response(JSON.stringify(session), { status: 201 }));
    const { uploadResume } = await import("../../src/pages/Register/registerApi");
    await expect(uploadResume(new File(["%PDF-1.7"], "resume.pdf"))).resolves.toEqual(session);
  });

  it("normalizes trailing slashes in the upload URL", async () => {
    vi.stubEnv("VITE_CONVEX_URL", "https://example.convex.cloud/");
    vi.stubEnv("VITE_CONVEX_SITE_URL", "");
    vi.resetModules();
    const fetchMock = vi.spyOn(globalThis, "fetch")
      .mockResolvedValueOnce(new Response(JSON.stringify(session), { status: 201 }));
    const { uploadResume } = await import("../../src/pages/Register/registerApi");
    await uploadResume(new File(["%PDF-1.7"], "resume.pdf"));
    expect(fetchMock).toHaveBeenCalledWith(
      "https://example.convex.site/resume-upload",
      expect.any(Object),
    );
  });

  it("derives the upload URL from VITE_CONVEX_URL when mock API is enabled", async () => {
    vi.stubEnv("VITE_CONVEX_URL", "https://registration-test.convex.cloud");
    vi.stubEnv("VITE_CONVEX_SITE_URL", "https://real-deployment.convex.site");
    vi.stubEnv("VITE_USE_MOCK_API", "true");
    vi.resetModules();
    const fetchMock = vi.spyOn(globalThis, "fetch")
      .mockResolvedValueOnce(new Response(JSON.stringify(session), { status: 201 }));
    const { uploadResume } = await import("../../src/pages/Register/registerApi");
    await uploadResume(new File(["%PDF-1.7"], "resume.pdf"));
    expect(fetchMock).toHaveBeenCalledWith(
      "https://registration-test.convex.site/resume-upload",
      expect.any(Object),
    );
  });
});

describe("submitRegistration", () => {
  afterEach(() => {
    vi.unstubAllEnvs();
    vi.restoreAllMocks();
    mutationMock.mockReset();
  });

  it("submits with an existing upload session", async () => {
    vi.stubEnv("VITE_CONVEX_URL", "https://example.convex.cloud");
    vi.stubEnv("VITE_USE_MOCK_API", "false");
    vi.resetModules();
    mutationMock.mockResolvedValue({ ok: true });
    const { submitRegistration } = await import("../../src/pages/Register/registerApi");
    await expect(submitRegistration(payload, "test-token", session)).resolves.toEqual({ ok: true });
    expect(mutationMock).toHaveBeenCalledWith(
      expect.anything(),
      {
        data: { ...payload, resumeStorageId: "resume-id" },
        resumeUploadToken: "upload-token",
      },
    );
  });

  it("throws a friendly error when Convex is not configured", async () => {
    vi.stubEnv("VITE_CONVEX_URL", "");
    vi.stubEnv("VITE_USE_MOCK_API", "false");
    vi.resetModules();
    const { submitRegistration } = await import("../../src/pages/Register/registerApi");
    await expect(submitRegistration(payload, null)).rejects.toThrow(
      "We couldn't submit your application. Please try again.",
    );
  });

  it("submits a valid payload to Convex", async () => {
    vi.stubEnv("VITE_CONVEX_URL", "https://example.convex.cloud");
    vi.stubEnv("VITE_USE_MOCK_API", "false");
    vi.resetModules();
    mutationMock.mockResolvedValue({ ok: true });
    const { submitRegistration } = await import("../../src/pages/Register/registerApi");
    await expect(submitRegistration(payload, "test-token")).resolves.toEqual({ ok: true });
    expect(mutationMock).toHaveBeenCalledWith(expect.anything(), { data: payload });
  });

  it("maps server failures to a friendly error", async () => {
    vi.stubEnv("VITE_CONVEX_URL", "https://example.convex.cloud");
    vi.stubEnv("VITE_USE_MOCK_API", "false");
    vi.resetModules();
    const serverError = new Error("server failure");
    mutationMock.mockRejectedValue(serverError);
    const { submitRegistration } = await import("../../src/pages/Register/registerApi");
    await expect(submitRegistration(payload, "test-token")).rejects.toMatchObject({
      message: "server failure",
      cause: serverError,
    });
  });
});

describe("discardResumeUpload", () => {
  afterEach(() => {
    vi.unstubAllEnvs();
    vi.restoreAllMocks();
    mutationMock.mockReset();
  });

  it("ignores cleanup failures", async () => {
    vi.stubEnv("VITE_CONVEX_URL", "https://example.convex.cloud");
    vi.stubEnv("VITE_USE_MOCK_API", "false");
    vi.resetModules();
    mutationMock.mockRejectedValue(new Error("offline"));
    const { discardResumeUpload } = await import("../../src/pages/Register/registerApi");
    await expect(discardResumeUpload("upload-token")).resolves.toBeUndefined();
  });

  it("requests server cleanup for a pending upload token", async () => {
    vi.stubEnv("VITE_CONVEX_URL", "https://example.convex.cloud");
    vi.stubEnv("VITE_USE_MOCK_API", "false");
    vi.resetModules();
    mutationMock.mockResolvedValue({ ok: true });
    const { discardResumeUpload } = await import("../../src/pages/Register/registerApi");
    await discardResumeUpload("upload-token");
    expect(mutationMock).toHaveBeenCalledWith(expect.anything(), { uploadToken: "upload-token" });
  });
});
