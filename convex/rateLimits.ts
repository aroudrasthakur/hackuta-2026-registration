import { v } from "convex/values";
import {
  OTP_RESEND_COOLDOWN_SECONDS,
  OTP_SEND_MAX_PER_HOUR,
} from "../shared/auth/otpRateLimit";
import { internalMutation } from "./_generated/server";
import { normalizeEmail } from "./lib/normalizeEmail";
import { CONTACT_FORM_BUCKET, OTP_SEND_BUCKET } from "./lib/rateLimitBuckets";

export const OTP_RESEND_COOLDOWN_MS = OTP_RESEND_COOLDOWN_SECONDS * 1000;
export const OTP_SEND_WINDOW_MS = 60 * 60 * 1000;
export { OTP_SEND_MAX_PER_HOUR };

export const CONTACT_FORM_WINDOW_MS = 10 * 60 * 1000;
export const CONTACT_FORM_MAX_PER_WINDOW = 5;

export const assertOtpSendAllowed = internalMutation({
  args: { email: v.string() },
  handler: async (ctx, { email }) => {
    const normalized = normalizeEmail(email);
    if (!normalized) {
      throw new Error("Invalid email.");
    }

    const now = Date.now();
    const windowStart = now - OTP_SEND_WINDOW_MS;
    const recent = await ctx.db
      .query("rateLimits")
      .withIndex("by_bucket_createdAt", (q) => q.eq("bucket", OTP_SEND_BUCKET))
      .filter((q) =>
        q.and(
          q.eq(q.field("key"), normalized),
          q.gte(q.field("createdAt"), windowStart),
        ),
      )
      .collect();

    if (recent.length >= OTP_SEND_MAX_PER_HOUR) {
      throw new Error("Too many verification requests. Please try again later.");
    }

    const lastSent = recent.reduce((latest, entry) => Math.max(latest, entry.createdAt), 0);
    if (lastSent > 0 && now - lastSent < OTP_RESEND_COOLDOWN_MS) {
      throw new Error("Please wait before requesting another code.");
    }
  },
});

export const recordOtpSend = internalMutation({
  args: { email: v.string() },
  handler: async (ctx, { email }) => {
    const normalized = normalizeEmail(email);
    if (!normalized) return;

    const now = Date.now();
    await ctx.db.insert("rateLimits", {
      bucket: OTP_SEND_BUCKET,
      key: normalized,
      createdAt: now,
    });

    const cutoff = now - OTP_SEND_WINDOW_MS;
    const stale = await ctx.db
      .query("rateLimits")
      .withIndex("by_bucket_createdAt", (q) => q.eq("bucket", OTP_SEND_BUCKET))
      .filter((q) => q.eq(q.field("key"), normalized))
      .collect();

    for (const entry of stale) {
      if (entry.createdAt < cutoff) {
        await ctx.db.delete(entry._id);
      }
    }
  },
});

export const assertContactSubmissionAllowed = internalMutation({
  args: { clientKey: v.string() },
  handler: async (ctx, { clientKey }) => {
    const now = Date.now();
    const windowStart = now - CONTACT_FORM_WINDOW_MS;
    const recent = await ctx.db
      .query("rateLimits")
      .withIndex("by_bucket_createdAt", (q) => q.eq("bucket", CONTACT_FORM_BUCKET))
      .filter((q) =>
        q.and(
          q.eq(q.field("key"), clientKey),
          q.gte(q.field("createdAt"), windowStart),
        ),
      )
      .collect();

    if (recent.length >= CONTACT_FORM_MAX_PER_WINDOW) {
      throw new Error("Too many contact requests. Please try again later.");
    }
  },
});

export const recordContactSubmission = internalMutation({
  args: { clientKey: v.string() },
  handler: async (ctx, { clientKey }) => {
    await ctx.db.insert("rateLimits", {
      bucket: CONTACT_FORM_BUCKET,
      key: clientKey,
      createdAt: Date.now(),
    });
  },
});
