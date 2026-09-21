export const LEVELS_OF_STUDY = [
  "High school",
  "Undergraduate - Freshman",
  "Undergraduate - Sophomore",
  "Undergraduate - Junior",
  "Undergraduate - Senior",
  "Graduate",
  "PhD",
  "Other",
] as const;

export const GENDERS = [
  "Male",
  "Female",
  "Non-binary",
  "Prefer to self-describe",
  "Prefer not to answer",
] as const;

export const RACE_ETHNICITY_OPTIONS = [
  "American Indian or Alaska Native",
  "Asian",
  "Black or African American",
  "Hispanic or Latino",
  "Native Hawaiian or Other Pacific Islander",
  "White",
  "Prefer not to answer",
  "Other",
] as const;

export const DIETARY_OPTIONS = [
  "None",
  "Vegetarian",
  "Vegan",
  "Gluten-free",
  "Halal",
  "Kosher",
  "Nut allergy",
  "Other",
] as const;

export const TSHIRT_SIZES = ["XS", "S", "M", "L", "XL", "XXL"] as const;

export const HEAR_ABOUT_OPTIONS = [
  "Instagram",
  "Discord",
  "A friend",
  "School club or class",
  "MLH",
  "Previous HackUTA",
  "Other",
] as const;

export const FIELD_LIMITS = {
  name: 100,
  phone: 30,
  school: 200,
  major: 200,
  url: 2048,
  accessibilityNeeds: 2000,
  otherDietary: 500,
} as const;

const CURRENT_YEAR = new Date().getFullYear();

export const MIN_AGE = 18;
export const MAX_AGE = 120;
export const MIN_GRADUATION_YEAR = CURRENT_YEAR;
export const MAX_GRADUATION_YEAR = CURRENT_YEAR + 10;

export const HACKATHON_ID = "hackuta-2026";

export const MLH_PRIVACY_POLICY_URL = "https://github.com/MLH/mlh-policies/blob/main/privacy-policy.md";
export const MLH_CODE_OF_CONDUCT_URL = "https://static.mlh.io/docs/mlh-code-of-conduct.pdf";
