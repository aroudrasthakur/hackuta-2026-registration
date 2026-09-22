import { makeFunctionReference } from "convex/server";
import { v } from "convex/values";
import { action } from "./_generated/server";
import { validateContactForm } from "../shared/contact/validation";

const sendContactEmailRef = makeFunctionReference<"action">("email/sendContactEmail:sendContactEmail");
const assertContactSubmissionAllowedRef = makeFunctionReference<"mutation">(
  "rateLimits:assertContactSubmissionAllowed",
);
const recordContactSubmissionRef = makeFunctionReference<"mutation">(
  "rateLimits:recordContactSubmission",
);

async function clientRateKey(clientKey: string | undefined) {
  const source = clientKey?.trim() || "unknown-client";
  const digest = await crypto.subtle.digest(
    "SHA-256",
    new TextEncoder().encode(source),
  );
  return Array.from(new Uint8Array(digest), (byte) => byte.toString(16).padStart(2, "0")).join("");
}

export const submitContactMessage = action({
  args: {
    name: v.string(),
    email: v.string(),
    subject: v.optional(v.string()),
    message: v.string(),
    website: v.optional(v.string()),
    clientKey: v.optional(v.string()),
  },
  handler: async (ctx, args) => {
    const validation = validateContactForm({
      name: args.name,
      email: args.email,
      subject: args.subject,
      message: args.message,
      website: args.website,
    });

    if (!validation.success) {
      throw new Error(validation.error);
    }

    const rateKey = await clientRateKey(args.clientKey);
    try {
      await ctx.runMutation(assertContactSubmissionAllowedRef, {
        clientKey: rateKey,
        email: validation.payload.email,
      });
      await ctx.runAction(sendContactEmailRef, {
        ...validation.payload,
        submittedAt: Date.now(),
      });
      await ctx.runMutation(recordContactSubmissionRef, {
        clientKey: rateKey,
        email: validation.payload.email,
      });
    } catch {
      throw new Error("We couldn't send your message. Please try again later.");
    }

    return { ok: true as const };
  },
});
