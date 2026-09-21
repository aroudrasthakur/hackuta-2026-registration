import { makeFunctionReference } from "convex/server";
import type { DataModelFromSchemaDefinition, GenericMutationCtx } from "convex/server";
import { v } from "convex/values";
import { internalMutation, mutation } from "./_generated/server";
import type schema from "./schema";
import { validateRegistrationPayload } from "../shared/registration/validation";
import type { RegistrationPayload } from "../shared/registration/types";
import { MAX_RESUME_BYTES } from "../shared/registration/resume";
import { resolveAuthenticatedUserId } from "./authenticatedUser";
import { ensureHackathon } from "./hackathons";

type MutationCtx = GenericMutationCtx<DataModelFromSchemaDefinition<typeof schema>>;

const RESUME_UPLOAD_WINDOW_MS = 10 * 60 * 1000;
const MAX_RESUME_UPLOADS_PER_WINDOW = 5;
const MAX_GLOBAL_RESUME_UPLOADS_PER_WINDOW = 100;
const RESUME_UPLOAD_EXPIRY_MS = 30 * 60 * 1000;
const CLEANUP_PAGE_SIZE = 100;

const cleanupExpiredResumeUploadsRef = makeFunctionReference<"mutation">(
  "registrations:cleanupExpiredResumeUploads",
);

export const reserveResumeUpload = internalMutation({
  args: {
    requestKey: v.string(),
  },
  handler: async (ctx: MutationCtx, { requestKey }) => {
    const now = Date.now();
    const windowStart = now - RESUME_UPLOAD_WINDOW_MS;
    const [recentClientRequests, recentGlobalRequests] = await Promise.all([
      ctx.db
        .query("resumeUploadRequests")
        .withIndex("by_user_createdAt", (q) => q.eq("userKey", requestKey).gte("createdAt", windowStart))
        .collect(),
      ctx.db
        .query("resumeUploadRequests")
        .withIndex("by_createdAt", (q) => q.gte("createdAt", windowStart))
        .take(MAX_GLOBAL_RESUME_UPLOADS_PER_WINDOW),
    ]);

    if (
      recentClientRequests.length >= MAX_RESUME_UPLOADS_PER_WINDOW ||
      recentGlobalRequests.length >= MAX_GLOBAL_RESUME_UPLOADS_PER_WINDOW
    ) {
      throw new Error("Too many resume upload attempts. Please wait a few minutes and try again.");
    }

    await ctx.db.insert("resumeUploadRequests", { userKey: requestKey, createdAt: now });
  },
});

export const recordVerifiedResumeUpload = internalMutation({
  args: {
    uploadToken: v.string(),
    storageId: v.id("_storage"),
  },
  handler: async (ctx: MutationCtx, { uploadToken, storageId }) => {
    const [existingToken, metadata] = await Promise.all([
      ctx.db
        .query("resumeUploadSessions")
        .withIndex("by_token", (q) => q.eq("token", uploadToken))
        .first(),
      ctx.db.system.get("_storage", storageId),
    ]);
    if (
      existingToken ||
      !metadata ||
      metadata.size === 0 ||
      metadata.size > MAX_RESUME_BYTES
    ) {
      throw new Error("Invalid resume upload.");
    }
    const now = Date.now();
    await ctx.db.insert("resumeUploadSessions", {
      token: uploadToken,
      storageId,
      createdAt: now,
      verifiedAt: now,
    });
    await ctx.scheduler.runAfter(RESUME_UPLOAD_EXPIRY_MS, cleanupExpiredResumeUploadsRef, {});
  },
});

async function upsertRegistration(
  ctx: MutationCtx,
  data: RegistrationPayload,
  status: "draft" | "submitted",
  resumeUploadToken?: string,
) {
  const userId = await resolveAuthenticatedUserId(ctx, {
    displayName: `${data.firstName} ${data.lastName}`,
  });
  const { hackathonId, resumeStorageId: rawStorageId, ...fields } = data;
  await ensureHackathon(ctx, hackathonId);

  const existing = await ctx.db
    .query("registrations")
    .withIndex("by_user_hackathon", (q) => q.eq("userId", userId).eq("hackathonId", hackathonId))
    .first();
  const resumeStorageId = rawStorageId
    ? ctx.db.system.normalizeId("_storage", rawStorageId)
    : undefined;

  if (rawStorageId) {
    const now = Date.now();
    const metadata = resumeStorageId
      ? await ctx.db.system.get("_storage", resumeStorageId)
      : null;
    const attachment = resumeStorageId
      ? await ctx.db
        .query("registrations")
        .withIndex("by_resume", (q) => q.eq("answers.resumeStorageId", resumeStorageId))
        .first()
      : null;

    if (attachment && attachment._id !== existing?._id) {
      throw new Error("This resume is already attached to another application.");
    }

    const retainingOwnResume = !!attachment && attachment._id === existing?._id;
    const session = resumeUploadToken
      ? await ctx.db
        .query("resumeUploadSessions")
        .withIndex("by_token", (q) => q.eq("token", resumeUploadToken))
        .first()
      : null;
    const validSession = !!(
      session &&
      !session.consumedAt &&
      session.storageId === resumeStorageId &&
      session.verifiedAt &&
      session.createdAt >= now - RESUME_UPLOAD_EXPIRY_MS
    );

    // New attachments must come from the HTTP upload route, which parses bytes with
    // pdf-lib before storage and issues a short-lived capability token (verifiedAt).
    if (
      !metadata ||
      metadata.contentType !== "application/pdf" ||
      metadata.size === 0 ||
      metadata.size > MAX_RESUME_BYTES ||
      (!retainingOwnResume && !validSession)
    ) {
      throw new Error("Please upload a valid PDF resume of 5 MB or smaller.");
    }

    if (validSession && session) {
      await ctx.db.patch(session._id, { consumedAt: now });
    }
  }

  const answers = { ...fields, resumeStorageId: resumeStorageId ?? undefined };

  if (existing) {
    const previousResume = existing.answers.resumeStorageId;
    await ctx.db.patch(existing._id, {
      answers,
      status,
      submittedAt: status === "submitted" ? Date.now() : undefined,
      updatedAt: Date.now(),
    });
    if (previousResume && previousResume !== resumeStorageId) {
      await ctx.storage.delete(previousResume);
    }
    return { registrationId: existing._id, isNew: false, ok: true as const };
  }

  const registrationId = await ctx.db.insert("registrations", {
    userId,
    hackathonId,
    status,
    eligibilityStatus: "unreviewed",
    answers,
    submittedAt: status === "submitted" ? Date.now() : undefined,
    updatedAt: Date.now(),
  });

  return { registrationId, isNew: true, ok: true as const };
}

function parseRegistrationData(data: unknown): RegistrationPayload {
  const result = validateRegistrationPayload(data);
  if (!result.success) throw new Error("Invalid registration data.");
  return result.payload;
}

const registrationArgs = {
  data: v.any(),
  resumeUploadToken: v.optional(v.string()),
};

export const register = mutation({
  args: registrationArgs,
  handler: async (ctx, { data, resumeUploadToken }) =>
    upsertRegistration(ctx, parseRegistrationData(data), "submitted", resumeUploadToken),
});

export const submitRegistration = mutation({
  args: registrationArgs,
  handler: async (ctx, { data, resumeUploadToken }) =>
    upsertRegistration(ctx, parseRegistrationData(data), "submitted", resumeUploadToken),
});

export const saveDraft = mutation({
  args: registrationArgs,
  handler: async (ctx, { data, resumeUploadToken }) =>
    upsertRegistration(ctx, parseRegistrationData(data), "draft", resumeUploadToken),
});

export const deleteResumeUpload = mutation({
  args: { uploadToken: v.string() },
  handler: async (ctx: MutationCtx, { uploadToken }) => {
    const session = await ctx.db
      .query("resumeUploadSessions")
      .withIndex("by_token", (q) => q.eq("token", uploadToken))
      .first();
    if (!session || session.consumedAt) return { ok: true as const };

    if (session.storageId) {
      const attachment = await ctx.db
        .query("registrations")
        .withIndex("by_resume", (q) => q.eq("answers.resumeStorageId", session.storageId))
        .first();
      if (!attachment) await ctx.storage.delete(session.storageId);
    }
    await ctx.db.delete(session._id);
    return { ok: true as const };
  },
});

export const cleanupExpiredResumeUploads = internalMutation({
  args: {},
  handler: async (ctx: MutationCtx) => {
    const cutoff = Date.now() - RESUME_UPLOAD_EXPIRY_MS;
    const expiredSessions = await ctx.db
      .query("resumeUploadSessions")
      .withIndex("by_createdAt", (q) => q.lt("createdAt", cutoff))
      .take(CLEANUP_PAGE_SIZE);
    for (const session of expiredSessions) {
      if (session.storageId) {
        const attachment = await ctx.db
          .query("registrations")
          .withIndex("by_resume", (q) => q.eq("answers.resumeStorageId", session.storageId))
          .first();
        if (!attachment) await ctx.storage.delete(session.storageId);
      }
      await ctx.db.delete(session._id);
    }

    const expiredRequests = await ctx.db
      .query("resumeUploadRequests")
      .withIndex("by_createdAt", (q) => q.lt("createdAt", cutoff))
      .take(CLEANUP_PAGE_SIZE);
    for (const request of expiredRequests) await ctx.db.delete(request._id);

    if (
      expiredSessions.length === CLEANUP_PAGE_SIZE ||
      expiredRequests.length === CLEANUP_PAGE_SIZE
    ) {
      await ctx.scheduler.runAfter(0, cleanupExpiredResumeUploadsRef, {});
    }
  },
});

export const syncUser = mutation({
  args: {
    email: v.optional(v.string()),
    displayName: v.optional(v.string()),
  },
  handler: async (ctx, { email, displayName }) => {
    const userId = await resolveAuthenticatedUserId(ctx, { email, displayName });
    return { userId, ok: true as const };
  },
});
