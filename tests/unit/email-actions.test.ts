import { convexTest } from "convex-test";
import { makeFunctionReference } from "convex/server";
import { describe, expect, it } from "vitest";
import schema from "../../convex/schema";

const modules = import.meta.glob("../../convex/**/*.ts", { eager: false });

const sendOtpEmail = makeFunctionReference<"action">("email/sendOtpEmail:sendOtpEmail");
const sendContactEmail = makeFunctionReference<"action">("email/sendContactEmail:sendContactEmail");

describe("email actions", () => {
  it("requires SMTP configuration for OTP email delivery", async () => {
    const test = convexTest(schema, modules);
    await expect(
      test.action(sendOtpEmail, {
        email: "test@example.com",
        code: "123456",
        expiresAt: Date.now() + 10 * 60 * 1000,
      }),
    ).rejects.toThrow("Email is not configured.");
  });

  it("requires SMTP configuration for contact email delivery", async () => {
    const test = convexTest(schema, modules);
    await expect(
      test.action(sendContactEmail, {
        name: "John Doe",
        email: "john@example.com",
        subject: "Test",
        message: "Test message",
        submittedAt: Date.now(),
      }),
    ).rejects.toThrow("Email is not configured.");
  });
});
