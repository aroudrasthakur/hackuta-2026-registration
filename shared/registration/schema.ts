import { z } from "zod";
import { COUNTRIES_OF_RESIDENCE } from "./countries";
import {
  DIETARY_OPTIONS,
  FIELD_LIMITS,
  GENDERS,
  HACKATHON_ID,
  HEAR_ABOUT_OPTIONS,
  LEVELS_OF_STUDY,
  MAJOR_OTHER_OPTION,
  MAJORS,
  MAX_AGE,
  MAX_GRADUATION_YEAR,
  MIN_AGE,
  MIN_GRADUATION_YEAR,
  RACE_ETHNICITY_OPTIONS,
  TSHIRT_SIZES,
} from "./constants";
import { MLH_SCHOOLS_SET } from "./mlhSchools";

export function isValidPhone(value: string) {
  const digits = value.replace(/\D/g, "");
  return digits.length >= 7 && digits.length <= 15;
}

export function isValidHttpUrl(value: string) {
  try {
    const url = new URL(value);
    return url.protocol === "http:" || url.protocol === "https:";
  } catch {
    return false;
  }
}

function optionalHttpUrl(label: string) {
  return z
    .string()
    .trim()
    .max(FIELD_LIMITS.url, `${label} is too long.`)
    .optional()
    .transform((value) => value || undefined)
    .refine((value) => value === undefined || isValidHttpUrl(value), {
      message: `Enter a valid ${label.toLowerCase()} URL.`,
    });
}

const COUNTRIES_SET = new Set<string>(COUNTRIES_OF_RESIDENCE);
const MAJORS_SET = new Set<string>(MAJORS);

const levelOfStudySchema = z.enum(LEVELS_OF_STUDY, {
  message: "Please select a level of study.",
});
const genderSchema = z.enum(GENDERS, { message: "Please select a gender." });
const raceEthnicitySchema = z.enum(RACE_ETHNICITY_OPTIONS);
const dietaryOptionSchema = z.enum(DIETARY_OPTIONS);
const tshirtSizeSchema = z.enum(TSHIRT_SIZES, {
  message: "Please select a t-shirt size.",
});
const hearAboutSchema = z.enum(HEAR_ABOUT_OPTIONS, {
  message: "Please select how you heard about HackUTA.",
});

const requiredInteger = (label: string, min: number, max: number) =>
  z
    .number({ message: `${label} is required.` })
    .refine((value) => !Number.isNaN(value), `${label} is required.`)
    .pipe(
      z
        .number()
        .int(`${label} must be a whole number.`)
        .min(min, `${label} must be between ${min} and ${max}.`)
        .max(max, `${label} must be between ${min} and ${max}.`),
    );

export const registrationPayloadSchema = z
  .object({
    firstName: z
      .string()
      .trim()
      .min(1, "First name is required.")
      .max(FIELD_LIMITS.name, "First name is too long."),
    lastName: z
      .string()
      .trim()
      .min(1, "Last name is required.")
      .max(FIELD_LIMITS.name, "Last name is too long."),
    phone: z
      .string()
      .trim()
      .min(1, "Phone number is required.")
      .max(FIELD_LIMITS.phone, "Phone number is too long.")
      .refine(isValidPhone, "Enter a valid phone number."),
    age: requiredInteger("Age", MIN_AGE, MAX_AGE),
    school: z
      .string()
      .trim()
      .min(1, "Please select a school or university.")
      .max(FIELD_LIMITS.school, "School name is too long.")
      .refine((value) => MLH_SCHOOLS_SET.has(value), "Please select a school from the list."),
    countryOfResidence: z
      .string()
      .trim()
      .min(1, "Please select your country of residence.")
      .refine((value) => COUNTRIES_SET.has(value), "Please select a country from the list."),
    levelOfStudy: levelOfStudySchema,
    major: z
      .string()
      .trim()
      .min(1, "Please select a major or field of study.")
      .max(FIELD_LIMITS.major, "Major is too long.")
      .refine(
        (value) => MAJORS_SET.has(value) || (value !== MAJOR_OTHER_OPTION && value.length > 0),
        "Please select a major from the list or describe your field of study.",
      ),
    graduationYear: requiredInteger(
      "Graduation year",
      MIN_GRADUATION_YEAR,
      MAX_GRADUATION_YEAR,
    ),
    gender: genderSchema,
    raceEthnicity: z.array(raceEthnicitySchema).default([]),
    otherRaceEthnicity: z
      .string()
      .trim()
      .max(FIELD_LIMITS.otherRaceEthnicity, "Race / ethnicity details are too long.")
      .optional()
      .transform((value) => value || undefined),
    dietaryRestrictions: z.array(dietaryOptionSchema).default([]),
    otherDietary: z
      .string()
      .trim()
      .max(FIELD_LIMITS.otherDietary, "Dietary details are too long.")
      .optional()
      .transform((value) => value || undefined),
    tshirtSize: tshirtSizeSchema,
    firstHackathon: z.boolean({
      message: "Please let us know if this is your first hackathon.",
    }),
    hearAbout: hearAboutSchema,
    resumeStorageId: z.string().min(1).max(128).optional(),
    linkedin: optionalHttpUrl("LinkedIn"),
    github: optionalHttpUrl("GitHub"),
    portfolio: optionalHttpUrl("Portfolio"),
    accessibilityNeeds: z
      .string()
      .trim()
      .max(FIELD_LIMITS.accessibilityNeeds, "Accessibility details are too long.")
      .optional()
      .transform((value) => value || undefined),
    emergencyContactName: z
      .string()
      .trim()
      .min(1, "Emergency contact name is required.")
      .max(FIELD_LIMITS.name, "Emergency contact name is too long."),
    emergencyContactPhone: z
      .string()
      .trim()
      .min(1, "Emergency contact phone is required.")
      .max(FIELD_LIMITS.phone, "Emergency contact phone is too long.")
      .refine(isValidPhone, "Enter a valid phone number."),
    codeOfConductAgreed: z.literal(true, {
      message: "You must agree to the MLH Code of Conduct to continue.",
    }),
    mlhDataSharingConsent: z.literal(true, {
      message: "You must authorize sharing your info with MLH to register.",
    }),
    mlhCommunicationsConsent: z.boolean(),
    hackathonId: z.literal(HACKATHON_ID).default(HACKATHON_ID),
  })
  .strict()
  .superRefine((data, ctx) => {
    if (data.dietaryRestrictions.includes("Allergies") && !data.otherDietary) {
      ctx.addIssue({
        code: "custom",
        path: ["otherDietary"],
        message: "Please describe your food allergies.",
      });
    }
    if (data.raceEthnicity.includes("Other (Please Specify)") && !data.otherRaceEthnicity) {
      ctx.addIssue({
        code: "custom",
        path: ["otherRaceEthnicity"],
        message: "Please specify your race or ethnicity.",
      });
    }
  });
