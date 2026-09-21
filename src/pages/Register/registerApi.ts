import { makeFunctionReference } from "convex/server";
import type { RegistrationPayload } from "../../../shared/registration/types";
import { validateResume } from "../../../shared/registration/resume";
import { getConvexClient, normalizeConvexUrl } from "../../convex/client";

const USE_MOCK_API = import.meta.env.VITE_USE_MOCK_API === "true";

function getConvexSiteUrl() {
  const convexUrl = normalizeConvexUrl(import.meta.env.VITE_CONVEX_URL);
  if (USE_MOCK_API) {
    return convexUrl?.replace(".convex.cloud", ".convex.site");
  }
  return normalizeConvexUrl(import.meta.env.VITE_CONVEX_SITE_URL)
    || convexUrl?.replace(".convex.cloud", ".convex.site");
}

function getConvexUrl() {
  return normalizeConvexUrl(import.meta.env.VITE_CONVEX_URL);
}

const SUBMIT_ERROR_MESSAGE = "We couldn't submit your application. Please try again.";

const registerRef = makeFunctionReference<"mutation">("registrations:register");
const deleteResumeUploadRef = makeFunctionReference<"mutation">("registrations:deleteResumeUpload");

export type ResumeUploadSession = {
  storageId: string;
  uploadToken: string;
};

async function callMockMutation<T>(
  mutationPath: string,
  args: Record<string, unknown>,
  authToken: string | null,
): Promise<T> {
  const convexUrl = getConvexUrl();
  if (!convexUrl || !authToken) {
    throw new Error(SUBMIT_ERROR_MESSAGE);
  }

  const response = await fetch(`${convexUrl}/api/mutation`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${authToken}`,
    },
    body: JSON.stringify({ path: mutationPath, args }),
  });
  const data = await response.json().catch(() => ({}));

  if (!response.ok || data.status === "error") {
    throw new Error(SUBMIT_ERROR_MESSAGE);
  }

  return (data.value ?? data) as T;
}

async function callConvexMutation<T>(
  mutationPath: string,
  mutation: typeof registerRef | typeof deleteResumeUploadRef,
  args: Record<string, unknown>,
  authToken: string | null,
): Promise<T> {
  if (USE_MOCK_API) {
    return callMockMutation<T>(mutationPath, args, authToken);
  }

  const client = getConvexClient();
  if (!client || !authToken) {
    throw new Error(SUBMIT_ERROR_MESSAGE);
  }

  try {
    return await client.mutation(mutation, args) as T;
  } catch (error) {
    if (import.meta.env.DEV) {
      console.error("Convex mutation failed:", error);
    }
    const detail = error instanceof Error ? error.message.trim() : "";
    if (import.meta.env.DEV && detail && detail !== "Server Error") {
      throw new Error(detail, { cause: error });
    }
    throw new Error(SUBMIT_ERROR_MESSAGE, { cause: error });
  }
}

export async function uploadResume(file: File): Promise<ResumeUploadSession> {
  const error = validateResume(file);
  if (error) throw new Error(error);
  const convexSiteUrl = getConvexSiteUrl();
  if (!convexSiteUrl) throw new Error(SUBMIT_ERROR_MESSAGE);

  const response = await fetch(`${convexSiteUrl}/resume-upload`, {
    method: "POST",
    headers: { "Content-Type": "application/pdf" },
    body: file,
  });
  const data = await response.json().catch(() => ({}));
  if (
    !response.ok ||
    typeof data.storageId !== "string" ||
    !data.storageId ||
    typeof data.uploadToken !== "string" ||
    !data.uploadToken
  ) {
    throw new Error(SUBMIT_ERROR_MESSAGE);
  }

  return { storageId: data.storageId, uploadToken: data.uploadToken };
}

export async function discardResumeUpload(uploadToken: string) {
  if (USE_MOCK_API) {
    const convexUrl = getConvexUrl();
    if (!convexUrl) return;
    await fetch(`${convexUrl}/api/mutation`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        path: "registrations:deleteResumeUpload",
        args: { uploadToken },
      }),
    }).catch(() => undefined);
    return;
  }

  const client = getConvexClient();
  if (!client) return;
  await client.mutation(deleteResumeUploadRef, { uploadToken }).catch(() => undefined);
}

export async function submitRegistration(
  payload: RegistrationPayload,
  authToken: string | null,
  resumeSession: ResumeUploadSession | null = null,
) {
  return callConvexMutation<{ ok: true }>("registrations:register", registerRef, {
    data: resumeSession ? { ...payload, resumeStorageId: resumeSession.storageId } : payload,
    ...(resumeSession ? { resumeUploadToken: resumeSession.uploadToken } : {}),
  }, authToken);
}
