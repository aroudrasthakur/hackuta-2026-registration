import type { z } from "zod";
import type {
  DIETARY_OPTIONS,
  GENDERS,
  HEAR_ABOUT_OPTIONS,
  LEVELS_OF_STUDY,
  RACE_ETHNICITY_OPTIONS,
  TSHIRT_SIZES,
} from "./constants";
import { registrationPayloadSchema } from "./schema";

export type LevelOfStudy = (typeof LEVELS_OF_STUDY)[number];
export type Gender = (typeof GENDERS)[number];
export type RaceEthnicity = (typeof RACE_ETHNICITY_OPTIONS)[number];
export type DietaryOption = (typeof DIETARY_OPTIONS)[number];
export type TshirtSize = (typeof TSHIRT_SIZES)[number];
export type HearAboutOption = (typeof HEAR_ABOUT_OPTIONS)[number];

export type ApplicationFormData = {
  firstName: string;
  lastName: string;
  phone: string;
  age: string;
  school: string;
  levelOfStudy: LevelOfStudy | "";
  major: string;
  graduationYear: string;
  gender: Gender | "";
  raceEthnicity: RaceEthnicity[];
  dietaryRestrictions: DietaryOption[];
  otherDietary: string;
  tshirtSize: TshirtSize | "";
  firstHackathon: boolean | null;
  hearAbout: HearAboutOption | "";
  resume: File | null;
  linkedin: string;
  github: string;
  portfolio: string;
  accessibilityNeeds: string;
  emergencyContactName: string;
  emergencyContactPhone: string;
  codeOfConductAgreed: boolean;
  mlhDataSharingConsent: boolean;
  mlhCommunicationsConsent: boolean;
};

export type RegistrationPayload = z.infer<typeof registrationPayloadSchema>;

export type FieldName = keyof ApplicationFormData;

export const FIELD_ORDER: FieldName[] = [
  "firstName",
  "lastName",
  "phone",
  "age",
  "school",
  "levelOfStudy",
  "major",
  "graduationYear",
  "gender",
  "otherDietary",
  "tshirtSize",
  "firstHackathon",
  "hearAbout",
  "resume",
  "linkedin",
  "github",
  "portfolio",
  "emergencyContactName",
  "emergencyContactPhone",
  "codeOfConductAgreed",
  "mlhDataSharingConsent",
];

export const INITIAL_FORM: ApplicationFormData = {
  firstName: "",
  lastName: "",
  phone: "",
  age: "",
  school: "",
  levelOfStudy: "",
  major: "",
  graduationYear: "",
  gender: "",
  raceEthnicity: [],
  dietaryRestrictions: [],
  otherDietary: "",
  tshirtSize: "",
  firstHackathon: null,
  hearAbout: "",
  resume: null,
  linkedin: "",
  github: "",
  portfolio: "",
  accessibilityNeeds: "",
  emergencyContactName: "",
  emergencyContactPhone: "",
  codeOfConductAgreed: false,
  mlhDataSharingConsent: false,
  mlhCommunicationsConsent: false,
};

/** Maps validation keys to DOM ids used for focus management. */
export const FIELD_FOCUS_IDS: Partial<Record<FieldName, string>> = {
  firstHackathon: "firstHackathon-yes",
  resume: "resume-upload",
  codeOfConductAgreed: "codeOfConductAgreed",
  mlhDataSharingConsent: "mlhDataSharingConsent",
};
