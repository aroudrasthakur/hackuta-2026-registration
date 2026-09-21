import { convexTest } from "convex-test";
import { describe, expect, it } from "vitest";
import schema from "../../convex/schema";

const modules = import.meta.glob("../../convex/**/*.ts", { eager: false });

const validContact = {
  name: "John Doe",
  email: "john@example.com",
  subject: "Question",
  message: "I have a question about the event.",
  clientKey: "valid-key",
};

describe("contact backend", () => {
  it("rejects contact form with missing name", async () => {
    const test = convexTest(schema, modules);
    await expect(
      test.action("contact:submitContactMessage", {
        ...validContact,
        name: "",
      }),
    ).rejects.toThrow("Please enter a valid name.");
  });

  it("rejects contact form with invalid email", async () => {
    const test = convexTest(schema, modules);
    await expect(
      test.action("contact:submitContactMessage", {
        ...validContact,
        email: "invalid-email",
      }),
    ).rejects.toThrow("Please enter a valid email address.");
  });

  it("rejects contact form with missing message", async () => {
    const test = convexTest(schema, modules);
    await expect(
      test.action("contact:submitContactMessage", {
        ...validContact,
        message: "",
      }),
    ).rejects.toThrow("Please enter a message.");
  });

  it("blocks spam when honeypot is filled", async () => {
    const test = convexTest(schema, modules);
    await expect(
      test.action("contact:submitContactMessage", {
        ...validContact,
        website: "http://spam.com",
      }),
    ).rejects.toThrow("Invalid submission.");
  });

  it("returns a generic error when email delivery is unavailable", async () => {
    const test = convexTest(schema, modules);
    await expect(test.action("contact:submitContactMessage", validContact)).rejects.toThrow(
      "We couldn't send your message. Please try again later.",
    );
  });

  it("handles missing client key gracefully", async () => {
    const test = convexTest(schema, modules);
    await expect(
      test.action("contact:submitContactMessage", {
        name: validContact.name,
        email: validContact.email,
        message: validContact.message,
      }),
    ).rejects.toThrow("We couldn't send your message. Please try again later.");
  });

  it("enforces contact rate limits after repeated submissions", async () => {
    const test = convexTest(schema, modules);
    const clientKey = "rate-limit-client";

    for (let index = 0; index < 5; index += 1) {
      await expect(
        test.action("contact:submitContactMessage", {
          ...validContact,
          clientKey,
          message: `Message ${index}`,
        }),
      ).rejects.toThrow("We couldn't send your message. Please try again later.");
    }

    await expect(
      test.action("contact:submitContactMessage", {
        ...validContact,
        clientKey,
        message: "One more message",
      }),
    ).rejects.toThrow("We couldn't send your message. Please try again later.");
  });
});
