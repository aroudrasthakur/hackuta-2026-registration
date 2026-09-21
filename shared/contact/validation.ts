import { isValidEmailSyntax, normalizeEmail } from "../lib/normalizeEmail";

export const CONTACT_LIMITS = {
  nameMin: 1,
  nameMax: 100,
  emailMax: 254,
  subjectMax: 150,
  messageMin: 1,
  messageMax: 5000,
} as const;

const CRLF_PATTERN = /[\r\n]/;

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

  const name = typeof input.name === "string" ? input.name.trim() : "";
  const emailRaw = typeof input.email === "string" ? input.email.trim() : "";
  const subjectRaw = typeof input.subject === "string" ? input.subject.trim() : "";
  const message = typeof input.message === "string" ? input.message.trim() : "";

  if (name.length < CONTACT_LIMITS.nameMin || name.length > CONTACT_LIMITS.nameMax) {
    return { success: false, error: "Please enter a valid name." };
  }
  if (emailRaw.length === 0 || emailRaw.length > CONTACT_LIMITS.emailMax) {
    return { success: false, error: "Please enter a valid email address." };
  }
  const email = normalizeEmail(emailRaw);
  if (!email || !isValidEmailSyntax(email)) {
    return { success: false, error: "Please enter a valid email address." };
  }
  if (CRLF_PATTERN.test(name) || CRLF_PATTERN.test(emailRaw) || CRLF_PATTERN.test(subjectRaw) || CRLF_PATTERN.test(message)) {
    return { success: false, error: "Invalid submission." };
  }
  if (subjectRaw.length > CONTACT_LIMITS.subjectMax) {
    return { success: false, error: "Subject is too long." };
  }
  if (message.length < CONTACT_LIMITS.messageMin || message.length > CONTACT_LIMITS.messageMax) {
    return { success: false, error: "Please enter a message." };
  }

  return {
    success: true,
    payload: {
      name,
      email,
      subject: subjectRaw,
      message,
    },
  };
}
