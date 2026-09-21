import {
  defineSchema,
  defineTable,
  type DataModelFromSchemaDefinition,
  type GenericMutationCtx,
  type GenericQueryCtx,
} from "convex/server";
import { v } from "convex/values";
import {
  OTP_RESEND_COOLDOWN_SECONDS,
  OTP_SEND_MAX_PER_HOUR,
} from "../../shared/auth/otpRateLimit";
import { normalizeEmail } from "./normalizeEmail";
import { OTP_SEND_BUCKET } from "./rateLimitBuckets";

/** Minimal schema for typing — full schema auth tables break GenericDataModel in CI. */
// eslint-disable-next-line @typescript-eslint/no-unused-vars -- typeof inference only
const rateLimitOnlySchema = defineSchema({
  rateLimits: defineTable({
    bucket: v.string(),
    key: v.string(),
    createdAt: v.number(),
  }).index("by_bucket_createdAt", ["bucket", "createdAt"]),
});

type RateLimitDataModel = DataModelFromSchemaDefinition<typeof rateLimitOnlySchema>;
type OtpSendLookupCtx =
  | Pick<GenericQueryCtx<RateLimitDataModel>, "db">
  | Pick<GenericMutationCtx<RateLimitDataModel>, "db">;

export const OTP_RESEND_COOLDOWN_MS = OTP_RESEND_COOLDOWN_SECONDS * 1000;
export const OTP_SEND_WINDOW_MS = 60 * 60 * 1000;

export type OtpSendStatus = {
  waitSeconds: number;
  hourlyLimitReached: boolean;
};

export async function lookupOtpSendStatus(
  ctx: OtpSendLookupCtx,
  email: string,
  now = Date.now(),
): Promise<OtpSendStatus> {
  const normalized = normalizeEmail(email);
  if (!normalized) {
    return { waitSeconds: 0, hourlyLimitReached: false };
  }

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
    return { waitSeconds: 0, hourlyLimitReached: true };
  }

  const lastSent = recent.reduce((latest, entry) => Math.max(latest, entry.createdAt), 0);
  if (lastSent > 0) {
    const remainingMs = OTP_RESEND_COOLDOWN_MS - (now - lastSent);
    if (remainingMs > 0) {
      return {
        waitSeconds: Math.ceil(remainingMs / 1000),
        hourlyLimitReached: false,
      };
    }
  }

  return { waitSeconds: 0, hourlyLimitReached: false };
}
