import { isValidEmailSyntax, normalizeEmail } from "../lib/normalizeEmail";
import {
  assertSafePlainText,
  containsCrlf,
  sanitizeEmailHeaderValue,
  sanitizePlainText,
} from "../lib/sanitizeInput";

export const CONTACT_LIMITS = {
  nameMin: 1,
  nameMax: 100,
  emailMax: 254,
  subjectMax: 150,
  messageMin: 1,
  messageMax: 5000,
} as const;

export type ContactFormInput = {
  name: string;
  email: string;
  subject?: string;
  message: string;
  website?: string;
};

export type ContactFormPayload = {
  name: string;
  email: string;
  subject: string;
  message: string;
};

export function validateContactForm(input: ContactFormInput):
  | { success: true; payload: ContactFormPayload }
  | { success: false; error: string } {
  if (typeof input.website === "string" && input.website.trim().length > 0) {
    return { success: false, error: "Invalid submission." };
  }

  const name = assertSafePlainText(typeof input.name === "string" ? input.name : "");
  const emailRaw = sanitizePlainText(typeof input.email === "string" ? input.email : "");
  const subjectRaw = sanitizePlainText(typeof input.subject === "string" ? input.subject : "");
  const message = assertSafePlainText(
    typeof input.message === "string" ? input.message : "",
    { allowNewlines: true },
  );

  if (!name || name.length < CONTACT_LIMITS.nameMin || name.length > CONTACT_LIMITS.nameMax) {
    return { success: false, error: "Please enter a valid name." };
  }
  if (emailRaw.length === 0 || emailRaw.length > CONTACT_LIMITS.emailMax) {
    return { success: false, error: "Please enter a valid email address." };
  }
  const email = normalizeEmail(emailRaw);
  if (!email || !isValidEmailSyntax(email)) {
    return { success: false, error: "Please enter a valid email address." };
  }
  if (containsCrlf(emailRaw) || containsCrlf(subjectRaw)) {
    return { success: false, error: "Invalid submission." };
  }
  if (subjectRaw.length > CONTACT_LIMITS.subjectMax) {
    return { success: false, error: "Subject is too long." };
  }
  if (!message || message.length < CONTACT_LIMITS.messageMin || message.length > CONTACT_LIMITS.messageMax) {
    return { success: false, error: "Please enter a message." };
  }

  let subject: string;
  try {
    subject = subjectRaw
      ? sanitizeEmailHeaderValue(subjectRaw, CONTACT_LIMITS.subjectMax)
      : "";
  } catch {
    return { success: false, error: "Invalid submission." };
  }

  return {
    success: true,
    payload: {
      name,
      email,
      subject,
      message,
    },
  };
}
