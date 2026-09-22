import { describe, expect, it } from "vitest";
import { validateContactForm } from "../../shared/contact/validation";
import { buildContactEmailContent, escapeHtml } from "../../convex/email/templates";

describe("validateContactForm", () => {
  it("accepts a valid submission", () => {
    const result = validateContactForm({
      name: "Sam Test",
      email: "sam@example.com",
      subject: "Question",
      message: "Hello organizers",
    });
    expect(result.success).toBe(true);
  });

  it("rejects honeypot submissions", () => {
    const result = validateContactForm({
      name: "Sam Test",
      email: "sam@example.com",
      message: "Hello",
      website: "https://spam.example",
    });
    expect(result.success).toBe(false);
  });

  it("rejects HTML markup in contact fields", () => {
    const result = validateContactForm({
      name: "Sam",
      email: "sam@example.com",
      message: "<script>alert(1)</script>",
    });
    expect(result.success).toBe(false);
  });

  it("rejects header injection", () => {
    const result = validateContactForm({
      name: "Sam\r\nBcc: evil@example.com",
      email: "sam@example.com",
      message: "Hello",
    });
    expect(result.success).toBe(false);
  });

  it("rejects oversized messages", () => {
    const result = validateContactForm({
      name: "Sam",
      email: "sam@example.com",
      message: "x".repeat(5001),
    });
    expect(result.success).toBe(false);
  });

  it("rejects empty email addresses", () => {
    const result = validateContactForm({
      name: "Sam",
      email: "   ",
      message: "Hello",
    });
    expect(result.success).toBe(false);
    if (!result.success) {
      expect(result.error).toBe("Please enter a valid email address.");
    }
  });

  it("rejects subjects that are too long", () => {
    const result = validateContactForm({
      name: "Sam",
      email: "sam@example.com",
      subject: "x".repeat(151),
      message: "Hello",
    });
    expect(result.success).toBe(false);
    if (!result.success) {
      expect(result.error).toBe("Subject is too long.");
    }
  });

  it("rejects invalid email syntax", () => {
    const result = validateContactForm({
      name: "Sam",
      email: "not-an-email",
      message: "Hello",
    });
    expect(result.success).toBe(false);
  });

  it("rejects names that are too long", () => {
    const result = validateContactForm({
      name: "x".repeat(101),
      email: "sam@example.com",
      message: "Hello",
    });
    expect(result.success).toBe(false);
  });
});

describe("contact email templates", () => {
  it("escapes HTML in contact messages", () => {
    const content = buildContactEmailContent({
      name: "<script>alert(1)</script>",
      email: "sam@example.com",
      subject: "Hello",
      message: "<b>test</b>",
      submittedAt: Date.now(),
    });
    expect(content.html).not.toContain("<script>");
    expect(content.html).toContain(escapeHtml("<script>alert(1)</script>"));
  });

  it("uses a default subject when none is provided", () => {
    const content = buildContactEmailContent({
      name: "Sam",
      email: "sam@example.com",
      subject: "",
      message: "Hello",
      submittedAt: Date.now(),
    });
    expect(content.subject).toBe("HackUTA website contact form");
  });
});
