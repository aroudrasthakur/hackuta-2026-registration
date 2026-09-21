import { afterEach, describe, expect, it, vi } from "vitest";
import {
  buildApplicationConfirmationEmailContent,
  buildOtpEmailContent,
} from "../../convex/email/templates";

describe("buildApplicationConfirmationEmailContent", () => {
  it("confirms receipt and includes profile link when available", () => {
    const content = buildApplicationConfirmationEmailContent({
      firstName: "Sam",
      submittedAt: Date.parse("2026-11-01T12:00:00.000Z"),
      profileUrl: "http://127.0.0.1:5273/profile",
    });

    expect(content.subject).toBe("HackUTA 2026 application received");
    expect(content.text).toContain("Hi Sam");
    expect(content.text).toContain("received your application");
    expect(content.text).toContain("http://127.0.0.1:5273/profile");
    expect(content.html).toContain("View your applicant profile");
  });
});

describe("buildOtpEmailContent", () => {
  it("includes the code and expiry guidance without leaking secrets", () => {
    const content = buildOtpEmailContent("042681");
    expect(content.text).toContain("042681");
    expect(content.text).toContain("10 minutes");
    expect(content.subject).toBe("Your HackUTA verification code");
  });
});

describe("smtp config", () => {
  afterEach(() => {
    vi.unstubAllEnvs();
  });

  it("requires SMTP environment variables", async () => {
    vi.resetModules();
    const { getSmtpConfig } = await import("../../convex/email/smtp");
    expect(() => getSmtpConfig()).toThrow("Email is not configured.");
  });

  it("derives secure transport from port 465", async () => {
    vi.stubEnv("SMTP_HOST", "mail.example.com");
    vi.stubEnv("SMTP_PORT", "465");
    vi.stubEnv("SMTP_USER", "no-reply@example.com");
    vi.stubEnv("SMTP_PASSWORD", "secret");
    vi.stubEnv("EMAIL_FROM", "no-reply@example.com");
    vi.resetModules();
    const { getSmtpConfig } = await import("../../convex/email/smtp");
    expect(getSmtpConfig()).toMatchObject({ secure: true, port: 465 });
  });

  it("uses STARTTLS mode for port 587", async () => {
    vi.stubEnv("SMTP_HOST", "mail.example.com");
    vi.stubEnv("SMTP_PORT", "587");
    vi.stubEnv("SMTP_USER", "no-reply@example.com");
    vi.stubEnv("SMTP_PASSWORD", "secret");
    vi.stubEnv("EMAIL_FROM", "no-reply@example.com");
    vi.resetModules();
    const { getSmtpConfig } = await import("../../convex/email/smtp");
    expect(getSmtpConfig()).toMatchObject({ secure: false, port: 587 });
  });
});
