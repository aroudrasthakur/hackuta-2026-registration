import type { ZodError } from "zod";
import { HACKATHON_ID } from "./constants";
import { registrationPayloadSchema } from "./schema";
import { validateResume } from "./resume";
import type {
  ApplicationFormData,
  FieldName,
  RegistrationPayload,
} from "./types";
import { FIELD_FOCUS_IDS, FIELD_ORDER } from "./types";

export type FieldErrors = Partial<Record<FieldName, string>>;

function zodErrorToFieldErrors(error: ZodError): FieldErrors {
  const errors: FieldErrors = {};

  for (const issue of error.issues) {
    const field = issue.path[0];
    if (typeof field !== "string" || errors[field as FieldName]) continue;
    errors[field as FieldName] = issue.message;
  }

  return errors;
}

function buildRegistrationCandidate(form: ApplicationFormData) {
  return {
    firstName: form.firstName,
    lastName: form.lastName,
    phone: form.phone,
    age: form.age.trim() === "" ? Number.NaN : Number(form.age.trim()),
    school: form.school,
    levelOfStudy: form.levelOfStudy || undefined,
    major: form.major,
    graduationYear:
      form.graduationYear.trim() === ""
        ? Number.NaN
        : Number(form.graduationYear.trim()),
    gender: form.gender || undefined,
    raceEthnicity: form.raceEthnicity,
    dietaryRestrictions: form.dietaryRestrictions,
    otherDietary: form.otherDietary,
    tshirtSize: form.tshirtSize || undefined,
    firstHackathon: form.firstHackathon ?? undefined,
    hearAbout: form.hearAbout || undefined,
    linkedin: form.linkedin,
    github: form.github,
    portfolio: form.portfolio,
    accessibilityNeeds: form.accessibilityNeeds,
    emergencyContactName: form.emergencyContactName,
    emergencyContactPhone: form.emergencyContactPhone,
    codeOfConductAgreed: form.codeOfConductAgreed ? true : undefined,
    mlhDataSharingConsent: form.mlhDataSharingConsent ? true : undefined,
    mlhCommunicationsConsent: form.mlhCommunicationsConsent,
    hackathonId: HACKATHON_ID,
  };
}

export function validateApplicationForm(form: ApplicationFormData):
  | { success: true; payload: RegistrationPayload }
  | { success: false; errors: FieldErrors } {
  const result = registrationPayloadSchema.safeParse(buildRegistrationCandidate(form));
  const errors = result.success ? {} : zodErrorToFieldErrors(result.error);
  const resumeError = form.resume ? validateResume(form.resume) : undefined;
  if (resumeError) errors.resume = resumeError;

  if (!result.success || resumeError) {
    return { success: false, errors };
  }

  return { success: true, payload: result.data };
}

export function validateRegistrationPayload(data: unknown):
  | { success: true; payload: RegistrationPayload }
  | { success: false } {
  const result = registrationPayloadSchema.safeParse(data);

  if (!result.success) {
    return { success: false };
  }

  return { success: true, payload: result.data };
}

export function focusFirstInvalidField(errors: FieldErrors) {
  const firstInvalidField = FIELD_ORDER.find((field) => errors[field]);
  if (!firstInvalidField) return;

  const elementId = FIELD_FOCUS_IDS[firstInvalidField] ?? firstInvalidField;
  const element = document.getElementById(elementId);

  element?.scrollIntoView({ behavior: "smooth", block: "center" });

  if (element instanceof HTMLElement) {
    element.focus({ preventScroll: true });
  }
}

export function toggleValue<T>(values: T[], value: T): T[] {
  return values.includes(value)
    ? values.filter((item) => item !== value)
    : [...values, value];
}
