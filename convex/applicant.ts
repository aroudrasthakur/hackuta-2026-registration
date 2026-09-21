import { v } from "convex/values";
import { mutation, query } from "./_generated/server";
import { HACKATHON_ID } from "../shared/registration/constants";
import { resolveAuthenticatedUser } from "./authenticatedUser";
import { normalizeEmail } from "./lib/normalizeEmail";

type RegistrationStatus =
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

function buildTimeline(registration: {
  status: RegistrationStatus;
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

  if (registration) {
    events.push({
      id: "registration-started",
      label: "Registration started",
      timestamp: registration.updatedAt,
      complete: true,
    });

    if (registration.submittedAt) {
      events.push({
        id: "application-submitted",
        label: "Application submitted",
        timestamp: registration.submittedAt,
        complete: true,
      });
    }

    if (registration.status === "submitted" && !registration.reviewedAt) {
      events.push({
        id: "under-review",
        label: "Under review",
        timestamp: registration.submittedAt ?? null,
        complete: false,
      });
    }

    if (registration.reviewedAt) {
      const statusLabels: Record<RegistrationStatus, string> = {
        draft: "Draft saved",
        submitted: "Application submitted",
        accepted: "Accepted",
        waitlisted: "Waitlisted",
        rejected: "Declined",
        withdrawn: "Withdrawn",
      };
      events.push({
        id: `status-${registration.status}`,
        label: statusLabels[registration.status],
        timestamp: registration.reviewedAt,
        complete: true,
      });
    }
  }

  return events;
}

async function findLegacyRegistrations(
  ctx: Parameters<typeof resolveAuthenticatedUser>[0],
  hackathonId: string,
  email: string,
) {
  const matches = await ctx.db
    .query("registrations")
    .withIndex("by_hackathon_status", (q) => q.eq("hackathonId", hackathonId))
    .filter((q) => q.eq(q.field("answers.email"), email))
    .collect();

  const legacy = [];
  for (const registration of matches) {
    const owner = await ctx.db.get(registration.userId);
    if (owner?.isAnonymous === true) {
      legacy.push(registration);
    }
  }
  return legacy;
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

    const existing = await ctx.db
      .query("registrations")
      .withIndex("by_user_hackathon", (q) => q.eq("userId", user._id))
      .filter((q) => q.eq(q.field("hackathonId"), hackathonId))
      .first();
    if (existing) {
      return { claimed: false as const, reason: "already_owned" as const };
    }

    const legacyMatches = await findLegacyRegistrations(ctx, hackathonId, verifiedEmail);
    if (legacyMatches.length === 0) {
      return { claimed: false as const, reason: "none_found" as const };
    }
    if (legacyMatches.length > 1) {
      console.warn(
        "Ambiguous legacy registration claim for email with multiple anonymous owners.",
      );
      return { claimed: false as const, reason: "ambiguous" as const };
    }

    const legacy = legacyMatches[0]!;
    await ctx.db.patch(legacy._id, {
      userId: user._id,
      updatedAt: Date.now(),
    });

    return { claimed: true as const, registrationId: legacy._id };
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
    const registration = await ctx.db
      .query("registrations")
      .withIndex("by_user_hackathon", (q) => q.eq("userId", user._id))
      .filter((q) => q.eq(q.field("hackathonId"), hackathonId))
      .first();

    const hasSubmittedRegistration =
      registration !== null &&
      registration.status !== "draft";

    return {
      authenticated: true as const,
      verifiedEmail: normalizeEmail(user.email) ?? null,
      hasRegistration: registration !== null,
      registrationStatus: registration?.status ?? null,
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
    const registration = await ctx.db
      .query("registrations")
      .withIndex("by_user_hackathon", (q) => q.eq("userId", user._id))
      .filter((q) => q.eq(q.field("hackathonId"), hackathonId))
      .first();

    const hackathon = await ctx.db
      .query("hackathons")
      .withIndex("by_slug", (q) => q.eq("slug", hackathonId))
      .first();

    let resumeStatus: "none" | "attached" = "none";
    if (registration?.answers.resumeStorageId) {
      resumeStatus = "attached";
    }

    const answers = registration?.answers;
    const applicantAnswers = answers
      ? {
          firstName: answers.firstName,
          lastName: answers.lastName,
          phone: answers.phone,
          age: answers.age,
          school: answers.school,
          levelOfStudy: answers.levelOfStudy,
          major: answers.major,
          graduationYear: answers.graduationYear,
          gender: answers.gender,
          raceEthnicity: answers.raceEthnicity,
          dietaryRestrictions: answers.dietaryRestrictions,
          otherDietary: answers.otherDietary,
          tshirtSize: answers.tshirtSize,
          firstHackathon: answers.firstHackathon,
          hearAbout: answers.hearAbout,
          linkedin: answers.linkedin,
          github: answers.github,
          portfolio: answers.portfolio,
          accessibilityNeeds: answers.accessibilityNeeds,
          emergencyContactName: answers.emergencyContactName,
          emergencyContactPhone: answers.emergencyContactPhone,
          mlhCommunicationsConsent: answers.mlhCommunicationsConsent,
        }
      : null;

    const timeline = buildTimeline(registration, user);

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
      registration: registration
        ? {
            id: registration._id,
            status: registration.status,
            eligibilityStatus: registration.eligibilityStatus,
            submittedAt: registration.submittedAt ?? null,
            updatedAt: registration.updatedAt,
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
