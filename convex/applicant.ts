import { v } from "convex/values";
import { mutation, query } from "./_generated/server";
import { HACKATHON_ID } from "../shared/registration/constants";
import { resolveAuthenticatedUser } from "./authenticatedUser";
import { normalizeEmail } from "./lib/normalizeEmail";
import {
  findUsersByApplicationEmail,
  getApplication,
  projectApplicantAnswers,
  writeApplication,
} from "./lib/applications";
import { HACKATHON_SCHEDULE } from "../shared/hackathon/schedule";
import { buildHackathonTimeline } from "../shared/hackathon/timeline";

async function findLegacyApplications(
  ctx: Parameters<typeof resolveAuthenticatedUser>[0],
  hackathonId: string,
  email: string,
) {
  const matches = await findUsersByApplicationEmail(ctx, hackathonId, email);
  return matches.filter((owner) => owner.isAnonymous === true && owner.applications);
}

export const claimLegacyRegistrationIfEligible = mutation({
  args: {
    hackathonId: v.optional(v.string()),
  },
  handler: async (ctx, { hackathonId = HACKATHON_ID }) => {
    try {
      const user = await resolveAuthenticatedUser(ctx);
      const verifiedEmail = normalizeEmail(user.email);
      if (!verifiedEmail) {
        return { claimed: false as const, reason: "no_verified_email" as const };
      }

      if (getApplication(user, hackathonId)) {
        return { claimed: false as const, reason: "already_owned" as const };
      }

      const legacyMatches = await findLegacyApplications(ctx, hackathonId, verifiedEmail);
      if (legacyMatches.length === 0) {
        return { claimed: false as const, reason: "none_found" as const };
      }
      if (legacyMatches.length > 1) {
        console.warn(
          "Ambiguous legacy registration claim for email with multiple anonymous owners.",
        );
        return { claimed: false as const, reason: "ambiguous" as const };
      }

      const legacyOwner = legacyMatches[0]!;
      const legacyApplication = legacyOwner.applications;
      if (!legacyApplication) {
        return { claimed: false as const, reason: "none_found" as const };
      }

      const now = Date.now();
      await writeApplication(ctx, user._id, {
        ...legacyApplication,
        email: verifiedEmail,
        updatedAt: now,
      });

      const {
        _id: _legacyId,
        _creationTime: _legacyCreatedAt,
        applications: _removedApplication,
        ...legacyOwnerFields
      } = legacyOwner;
      void _legacyId;
      void _legacyCreatedAt;
      void _removedApplication;
      await ctx.db.replace(legacyOwner._id, {
        ...legacyOwnerFields,
        updatedAt: now,
      });

      return { claimed: true as const, registrationId: user._id };
    } catch (error) {
      console.error("claimLegacyRegistrationIfEligible failed:", error);
      return { claimed: false as const, reason: "error" as const };
    }
  },
});

export const getApplicantRoutingState = query({
  args: {
    hackathonId: v.optional(v.string()),
  },
  handler: async (ctx, { hackathonId = HACKATHON_ID }) => {
    const identity = await ctx.auth.getUserIdentity();
    if (!identity) {
      return {
        authenticated: false as const,
        verifiedEmail: null,
        hasRegistration: false,
        registrationStatus: null,
      };
    }

    const user = await resolveAuthenticatedUser(ctx);
    const application = getApplication(user, hackathonId);

    const hasSubmittedRegistration =
      application !== null &&
      application.status !== "draft";

    return {
      authenticated: true as const,
      verifiedEmail: normalizeEmail(user.email) ?? null,
      hasRegistration: application !== null,
      registrationStatus: application?.status ?? null,
      hasSubmittedRegistration,
    };
  },
});

export const getMyApplicantDashboard = query({
  args: {
    hackathonId: v.optional(v.string()),
  },
  handler: async (ctx, { hackathonId = HACKATHON_ID }) => {
    const user = await resolveAuthenticatedUser(ctx);
    const application = getApplication(user, hackathonId);

    const hackathon = await ctx.db
      .query("hackathons")
      .withIndex("by_slug", (q) => q.eq("slug", hackathonId))
      .first();

    const resumeStatus: "none" | "attached" = application?.resumeStorageId ? "attached" : "none";
    const applicantAnswers = application ? projectApplicantAnswers(application) : null;
    const timeline = buildHackathonTimeline(
      hackathon
        ? {
            registrationOpensAt: hackathon.registrationOpensAt,
            registrationClosesAt: hackathon.registrationClosesAt,
            decisionsReleasedAt: hackathon.decisionsReleasedAt,
            startsAt: hackathon.startsAt,
          }
        : HACKATHON_SCHEDULE,
    );

    return {
      profile: {
        displayName: user.displayName ?? null,
        verifiedEmail: normalizeEmail(user.email) ?? null,
      },
      registration: application
        ? {
            id: user._id,
            status: application.status,
            eligibilityStatus: application.eligibilityStatus,
            submittedAt: application.submittedAt ?? null,
            updatedAt: application.updatedAt,
            answers: applicantAnswers,
            resumeStatus,
          }
        : null,
      timeline,
      hackathon: hackathon
        ? {
            name: hackathon.name,
            startsAt: hackathon.startsAt,
            endsAt: hackathon.endsAt,
            registrationOpensAt: hackathon.registrationOpensAt,
            registrationClosesAt: hackathon.registrationClosesAt,
            decisionsReleasedAt: hackathon.decisionsReleasedAt ?? null,
          }
        : null,
    };
  },
});
