"use node";

import { v } from "convex/values";
import { internalAction } from "../_generated/server";
import { buildApplicationConfirmationEmailContent } from "./templates";
import { sendMailMessage } from "./smtp";

export const sendApplicationConfirmationEmail = internalAction({
  args: {
    email: v.string(),
    firstName: v.string(),
    lastName: v.string(),
    submittedAt: v.number(),
  },
  handler: async (_ctx, { email, firstName, lastName, submittedAt }) => {
    const websiteUrl = process.env.HACKUTA_WEBSITE_URL?.trim().replace(/\/+$/, "");
    const content = buildApplicationConfirmationEmailContent({
      applicantName: `${firstName} ${lastName}`.trim(),
      submittedAt,
      ...(websiteUrl ? { websiteUrl } : {}),
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
