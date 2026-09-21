import { describe, expect, it } from "vitest";
import { getOtpSendErrorMessage, isOtpRateLimitError } from "../../shared/auth/otpRateLimit";

describe("otp rate limit helpers", () => {
  it("detects server rate-limit messages", () => {
    expect(isOtpRateLimitError("Too many verification requests. Please try again later.")).toBe(
      true,
    );
    expect(isOtpRateLimitError("Please wait before requesting another code.")).toBe(true);
    expect(isOtpRateLimitError("Missing environment variable SITE_URL")).toBe(false);
  });

  it("returns rate-limit messages in production mode", () => {
    expect(
      getOtpSendErrorMessage(
        new Error("Please wait before requesting another code."),
        false,
      ),
    ).toBe("Please wait before requesting another code.");
  });

  it("returns other errors only in dev mode", () => {
    expect(getOtpSendErrorMessage(new Error("Missing SITE_URL"), false)).toBeNull();
    expect(getOtpSendErrorMessage(new Error("Missing SITE_URL"), true)).toBe("Missing SITE_URL");
  });

  it("ignores non-error values and blank messages", () => {
    expect(getOtpSendErrorMessage("not an error", false)).toBeNull();
    expect(getOtpSendErrorMessage(new Error("   "), false)).toBeNull();
  });
});
