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

  it("rejects invalid SMTP ports", async () => {
    vi.stubEnv("SMTP_HOST", "mail.example.com");
    vi.stubEnv("SMTP_PORT", "not-a-port");
    vi.stubEnv("SMTP_USER", "no-reply@example.com");
    vi.stubEnv("SMTP_PASSWORD", "secret");
    vi.stubEnv("EMAIL_FROM", "no-reply@example.com");
    vi.resetModules();
    const { getSmtpConfig } = await import("../../convex/email/smtp");
    expect(() => getSmtpConfig()).toThrow("Email is not configured.");
  });
});

describe("sendMailMessage", () => {
  afterEach(() => {
    vi.unstubAllEnvs();
    vi.resetModules();
    vi.doUnmock("nodemailer");
  });

  it("sends mail with optional reply-to metadata", async () => {
    const sendMail = vi.fn().mockResolvedValue({});
    const createTransport = vi.fn(() => ({ sendMail }));

    vi.doMock("nodemailer", () => ({
      default: { createTransport },
    }));

    vi.stubEnv("SMTP_HOST", "mail.example.com");
    vi.stubEnv("SMTP_PORT", "587");
    vi.stubEnv("SMTP_USER", "no-reply@example.com");
    vi.stubEnv("SMTP_PASSWORD", "secret");
    vi.stubEnv("EMAIL_FROM", "no-reply@example.com");
    vi.resetModules();

    const { sendMailMessage } = await import("../../convex/email/smtp");
    await sendMailMessage({
      to: "applicant@example.com",
      subject: "Test",
      text: "Hello",
      html: "<p>Hello</p>",
      replyTo: "support@example.com",
      fromName: "HackUTA Team",
    });

    expect(createTransport).toHaveBeenCalledWith(
      expect.objectContaining({ requireTLS: true, secure: false }),
    );
    expect(sendMail).toHaveBeenCalledWith(
      expect.objectContaining({
        to: "applicant@example.com",
        replyTo: "support@example.com",
        from: expect.stringContaining("HackUTA Team"),
      }),
    );
  });

  it("reuses the cached transporter for repeated sends", async () => {
    const sendMail = vi.fn().mockResolvedValue({});
    const createTransport = vi.fn(() => ({ sendMail }));

    vi.doMock("nodemailer", () => ({
      default: { createTransport },
    }));

    vi.stubEnv("SMTP_HOST", "mail.example.com");
    vi.stubEnv("SMTP_PORT", "465");
    vi.stubEnv("SMTP_USER", "no-reply@example.com");
    vi.stubEnv("SMTP_PASSWORD", "secret");
    vi.stubEnv("EMAIL_FROM", "no-reply@example.com");
    vi.resetModules();

    const { sendMailMessage } = await import("../../convex/email/smtp");
    const payload = {
      to: "applicant@example.com",
      subject: "Test",
      text: "Hello",
      html: "<p>Hello</p>",
    };

    await sendMailMessage(payload);
    await sendMailMessage(payload);

    expect(createTransport).toHaveBeenCalledTimes(1);
    expect(sendMail).toHaveBeenCalledTimes(2);
  });
});
