import type { DataModelFromSchemaDefinition, GenericMutationCtx, GenericQueryCtx } from "convex/server";
import type { Doc, Id } from "../_generated/dataModel";
import type schema from "../schema";

type QueryCtx = GenericQueryCtx<DataModelFromSchemaDefinition<typeof schema>>;
type MutationCtx = GenericMutationCtx<DataModelFromSchemaDefinition<typeof schema>>;

export function getApplication(user: Doc<"users">, hackathonId: string) {
  if (user.applications?.hackathonId === hackathonId) {
    return user.applications;
  }
  return null;
}

export async function writeApplication(
  ctx: MutationCtx,
  userId: Id<"users">,
  application: NonNullable<Doc<"users">["applications"]>,
) {
  const now = Date.now();
  await ctx.db.patch(userId, {
    applications: application,
    updatedAt: now,
  });
}

export async function findUserByResume(
  ctx: QueryCtx | MutationCtx,
  storageId: Id<"_storage">,
) {
  return ctx.db
    .query("users")
    .withIndex("by_resume", (q) => q.eq("applications.resumeStorageId", storageId))
    .first();
}

export async function findUsersByApplicationEmail(
  ctx: QueryCtx | MutationCtx,
  hackathonId: string,
  email: string,
) {
  return ctx.db
    .query("users")
    .withIndex("by_application_status", (q) => q.eq("applications.hackathonId", hackathonId))
    .filter((q) => q.eq(q.field("applications.email"), email))
    .collect();
}

export function projectApplicantAnswers(
  application: NonNullable<Doc<"users">["applications"]>,
) {
  return {
    firstName: application.firstName,
    lastName: application.lastName,
    phone: application.phone,
    age: application.age,
    school: application.school,
    levelOfStudy: application.levelOfStudy,
    major: application.major,
    graduationYear: application.graduationYear,
    gender: application.gender,
    raceEthnicity: application.raceEthnicity,
    dietaryRestrictions: application.dietaryRestrictions,
    otherDietary: application.otherDietary,
    tshirtSize: application.tshirtSize,
    firstHackathon: application.firstHackathon,
    hearAbout: application.hearAbout,
    linkedin: application.linkedin,
    github: application.github,
    portfolio: application.portfolio,
    accessibilityNeeds: application.accessibilityNeeds,
    emergencyContactName: application.emergencyContactName,
    emergencyContactPhone: application.emergencyContactPhone,
    mlhCommunicationsConsent: application.mlhCommunicationsConsent,
  };
}
