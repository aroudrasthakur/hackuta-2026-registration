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

type ApplicationStatus =
  | "draft"
  | "submitted"
  | "accepted"
  | "waitlisted"
  | "rejected"
  | "withdrawn";

type TimelineEvent = {
  id: string;
  label: string;
  timestamp: number | null;
  complete: boolean;
};

function buildTimeline(application: {
  status: ApplicationStatus;
  submittedAt?: number;
  reviewedAt?: number;
  updatedAt: number;
} | null, user: { emailVerificationTime?: number; updatedAt?: number; createdAt?: number }) {
  const events: TimelineEvent[] = [];

  const verifiedAt = user.emailVerificationTime ?? user.updatedAt ?? user.createdAt ?? null;
  events.push({
    id: "email-verified",
    label: "Email verified",
    timestamp: verifiedAt,
    complete: verifiedAt !== null,
  });

  if (application) {
    events.push({
      id: "registration-started",
      label: "Registration started",
      timestamp: application.updatedAt,
      complete: true,
    });

    if (application.submittedAt) {
      events.push({
        id: "application-submitted",
        label: "Application submitted",
        timestamp: application.submittedAt,
        complete: true,
      });
    }

    if (application.status === "submitted" && !application.reviewedAt) {
      events.push({
        id: "under-review",
        label: "Under review",
        timestamp: application.submittedAt ?? null,
        complete: false,
      });
    }

    if (application.reviewedAt) {
      const statusLabels: Record<ApplicationStatus, string> = {
        draft: "Draft saved",
        submitted: "Application submitted",
        accepted: "Accepted",
        waitlisted: "Waitlisted",
        rejected: "Declined",
        withdrawn: "Withdrawn",
      };
      events.push({
        id: `status-${application.status}`,
        label: statusLabels[application.status],
        timestamp: application.reviewedAt,
        complete: true,
      });
    }
  }

  return events;
}

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
    await ctx.db.patch(legacyOwner._id, {
      applications: undefined,
      updatedAt: now,
    });

    return { claimed: true as const, registrationId: user._id };
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
    const timeline = buildTimeline(application, user);

    if (hackathon) {
      timeline.push({
        id: "event-starts",
        label: "Hackathon begins",
        timestamp: hackathon.startsAt,
        complete: Date.now() >= hackathon.startsAt,
      });
      timeline.push({
        id: "event-ends",
        label: "Hackathon ends",
        timestamp: hackathon.endsAt,
        complete: Date.now() >= hackathon.endsAt,
      });
    }

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
          }
        : null,
    };
  },
});
