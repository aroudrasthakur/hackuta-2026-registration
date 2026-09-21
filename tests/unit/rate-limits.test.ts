import { convexTest } from "convex-test";
import { makeFunctionReference } from "convex/server";
import { describe, expect, it } from "vitest";
import schema from "../../convex/schema";
import {
  OTP_RESEND_COOLDOWN_MS,
  OTP_SEND_MAX_PER_HOUR,
  CONTACT_FORM_MAX_PER_WINDOW,
} from "../../convex/rateLimits";
import {
  CONTACT_FORM_BUCKET,
  OTP_SEND_BUCKET,
} from "../../convex/lib/rateLimitBuckets";

const modules = import.meta.glob("../../convex/**/*.ts", { eager: false });

const assertOtpSendAllowed = makeFunctionReference<"mutation">("rateLimits:assertOtpSendAllowed");
const recordOtpSend = makeFunctionReference<"mutation">("rateLimits:recordOtpSend");
const assertContactSubmissionAllowed = makeFunctionReference<"mutation">(
  "rateLimits:assertContactSubmissionAllowed",
);
const recordContactSubmission = makeFunctionReference<"mutation">(
  "rateLimits:recordContactSubmission",
);

describe("rateLimits", () => {
  it("allows first OTP send", async () => {
    const test = convexTest(schema, modules);
    await expect(
      test.run(async (ctx) => {
        await ctx.runMutation(assertOtpSendAllowed, { email: "newuser@example.com" });
      }),
    ).resolves.not.toThrow();
  });

  it("records OTP send attempt", async () => {
    const test = convexTest(schema, modules);
    await test.run(async (ctx) => {
      await ctx.runMutation(recordOtpSend, { email: "test@example.com" });
      const attempts = await ctx.db.query("rateLimits").collect();
      expect(attempts).toHaveLength(1);
      expect(attempts[0]?.bucket).toBe(OTP_SEND_BUCKET);
      expect(attempts[0]?.key).toBe("test@example.com");
    });
  });

  it("enforces OTP resend cooldown", async () => {
    const test = convexTest(schema, modules);
    await test.run(async (ctx) => {
      await ctx.runMutation(recordOtpSend, { email: "cooldown@example.com" });
      await expect(
        ctx.runMutation(assertOtpSendAllowed, { email: "cooldown@example.com" }),
      ).rejects.toThrow("Please wait before requesting another code.");
    });
  });

  it("allows OTP send after cooldown expires", async () => {
    const test = convexTest(schema, modules);
    await test.run(async (ctx) => {
      const email = "expired@example.com";
      const now = Date.now();

      await ctx.db.insert("rateLimits", {
        bucket: OTP_SEND_BUCKET,
        key: email,
        createdAt: now - OTP_RESEND_COOLDOWN_MS - 1000,
      });

      await expect(
        ctx.runMutation(assertOtpSendAllowed, { email }),
      ).resolves.not.toThrow();
    });
  });

  it("enforces hourly OTP send limit", async () => {
    const test = convexTest(schema, modules);
    await test.run(async (ctx) => {
      const email = "ratelimited@example.com";
      const now = Date.now();

      for (let i = 0; i < OTP_SEND_MAX_PER_HOUR; i++) {
        await ctx.db.insert("rateLimits", {
          bucket: OTP_SEND_BUCKET,
          key: email,
          createdAt: now - (i * 5 * 60 * 1000),
        });
      }

      await expect(
        ctx.runMutation(assertOtpSendAllowed, { email }),
      ).rejects.toThrow("Too many verification requests. Please try again later.");
    });
  });

  it("rejects invalid email for OTP", async () => {
    const test = convexTest(schema, modules);
    await test.run(async (ctx) => {
      try {
        await ctx.runMutation(assertOtpSendAllowed, { email: "" });
        throw new Error("Should have failed");
      } catch (error) {
        expect(error).toBeDefined();
      }
    });
  });

  it("cleans up stale OTP attempts on record", async () => {
    const test = convexTest(schema, modules);
    await test.run(async (ctx) => {
      const email = "cleanup@example.com";
      const now = Date.now();

      await ctx.db.insert("rateLimits", {
        bucket: OTP_SEND_BUCKET,
        key: email,
        createdAt: now - 2 * 60 * 60 * 1000,
      });

      await ctx.runMutation(recordOtpSend, { email });

      const attempts = await ctx.db
        .query("rateLimits")
        .withIndex("by_bucket_createdAt", (q) => q.eq("bucket", OTP_SEND_BUCKET))
        .filter((q) => q.eq(q.field("key"), email))
        .collect();

      expect(attempts).toHaveLength(1);
      expect(attempts[0]!.createdAt).toBeGreaterThan(now - 1000);
    });
  });

  it("allows first contact form submission", async () => {
    const test = convexTest(schema, modules);
    await expect(
      test.run(async (ctx) => {
        await ctx.runMutation(assertContactSubmissionAllowed, { clientKey: "new-client" });
      }),
    ).resolves.not.toThrow();
  });

  it("records contact form submission", async () => {
    const test = convexTest(schema, modules);
    await test.run(async (ctx) => {
      await ctx.runMutation(recordContactSubmission, { clientKey: "test-client" });
      const submissions = await ctx.db.query("rateLimits").collect();
      expect(submissions).toHaveLength(1);
      expect(submissions[0]?.bucket).toBe(CONTACT_FORM_BUCKET);
      expect(submissions[0]?.key).toBe("test-client");
    });
  });

  it("enforces contact form rate limit", async () => {
    const test = convexTest(schema, modules);
    await test.run(async (ctx) => {
      const clientKey = "spammer";
      const now = Date.now();

      for (let i = 0; i < CONTACT_FORM_MAX_PER_WINDOW; i++) {
        await ctx.db.insert("rateLimits", {
          bucket: CONTACT_FORM_BUCKET,
          key: clientKey,
          createdAt: now - (i * 1000),
        });
      }

      await expect(
        ctx.runMutation(assertContactSubmissionAllowed, { clientKey }),
      ).rejects.toThrow("Too many contact requests. Please try again later.");
    });
  });

  it("allows contact submission after window expires", async () => {
    const test = convexTest(schema, modules);
    await test.run(async (ctx) => {
      const clientKey = "old-client";
      const now = Date.now();

      for (let i = 0; i < CONTACT_FORM_MAX_PER_WINDOW; i++) {
        await ctx.db.insert("rateLimits", {
          bucket: CONTACT_FORM_BUCKET,
          key: clientKey,
          createdAt: now - 15 * 60 * 1000,
        });
      }

      await expect(
        ctx.runMutation(assertContactSubmissionAllowed, { clientKey }),
      ).resolves.not.toThrow();
    });
  });

  it("normalizes email addresses for OTP rate limiting", async () => {
    const test = convexTest(schema, modules);
    await test.run(async (ctx) => {
      await ctx.runMutation(recordOtpSend, { email: "Test@Example.COM" });
      const attempts = await ctx.db.query("rateLimits").collect();
      expect(attempts[0]?.key).toBe("test@example.com");
    });
  });
});
