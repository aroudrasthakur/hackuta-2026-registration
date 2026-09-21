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
});
