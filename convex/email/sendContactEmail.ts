"use node";

import { v } from "convex/values";
import { internalAction } from "../_generated/server";
import { buildContactEmailContent } from "./templates";
import { sendMailMessage } from "./smtp";

export const sendContactEmail = internalAction({
  args: {
    name: v.string(),
    email: v.string(),
    subject: v.string(),
    message: v.string(),
    submittedAt: v.number(),
  },
  handler: async (_ctx, args) => {
    const destination = process.env.CONTACT_EMAIL_TO?.trim();
    if (!destination) {
      throw new Error("Email is not configured.");
    }

    const content = buildContactEmailContent(args);
    await sendMailMessage({
      to: destination,
      subject: content.subject,
      text: content.text,
      html: content.html,
      replyTo: args.email,
      fromName: "HackUTA Website",
    });
  },
});
