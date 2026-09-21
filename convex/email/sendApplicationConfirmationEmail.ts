"use node";

import { v } from "convex/values";
import { internalAction } from "../_generated/server";
import { buildApplicationConfirmationEmailContent } from "./templates";
import { sendMailMessage } from "./smtp";

export const sendApplicationConfirmationEmail = internalAction({
  args: {
    email: v.string(),
    firstName: v.string(),
    submittedAt: v.number(),
  },
  handler: async (_ctx, { email, firstName, submittedAt }) => {
    const profileUrl = process.env.SITE_URL?.trim().replace(/\/+$/, "");
    const content = buildApplicationConfirmationEmailContent({
      firstName,
      submittedAt,
      profileUrl: profileUrl ? `${profileUrl}/profile` : undefined,
    });

    await sendMailMessage({
      to: email,
      subject: content.subject,
      text: content.text,
      html: content.html,
      fromName: "HackUTA",
    });
  },
});
