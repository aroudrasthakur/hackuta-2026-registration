import { query } from "./_generated/server";
import { v } from "convex/values";
import { resolveAuthenticatedUser } from "./authenticatedUser";
import { isRegistrationAdmin } from "./registrationSecurity";

export const getCurrentUser = query({
  args: {},
  handler: async (ctx) => resolveAuthenticatedUser(ctx),
});

/**
 * Get all registrations for a user.
 */
export const getRegistrationsByUser = query({
  args: { userId: v.string() },
  handler: async (ctx, { userId }) => {
    const user = await resolveAuthenticatedUser(ctx);
    if (user._id !== userId) {
      throw new Error("Not authorized to access this user's registrations.");
    }
    return await ctx.db
      .query("registrations")
      .withIndex("by_user_hackathon", (q) => q.eq("userId", user._id))
      .collect();
  },
});

/**
 * Get a specific registration.
 */
export const getRegistration = query({
  args: { registrationId: v.id("registrations") },
  handler: async (ctx, { registrationId }) => {
    const user = await resolveAuthenticatedUser(ctx);
    const registration = await ctx.db.get(registrationId);
    if (!registration || registration.userId !== user._id) {
      throw new Error("Not authorized to access this registration.");
    }
    return registration;
  },
});

/**
 * Get all registrations for a hackathon (admin view).
 */
export const getRegistrationsByHackathon = query({
  args: { hackathonId: v.string() },
  handler: async (ctx, { hackathonId }) => {
    const identity = await ctx.auth.getUserIdentity();
    if (!identity) {
      throw new Error("Authentication required.");
    }
    if (!isRegistrationAdmin(identity.tokenIdentifier)) {
      throw new Error("Not authorized to access hackathon registrations.");
    }
    return await ctx.db
      .query("registrations")
      .withIndex("by_hackathon_status", (q) => q.eq("hackathonId", hackathonId))
      .collect();
  },
});

/**
 * Get a hackathon by slug.
 */
export const getHackathonBySlug = query({
  args: { slug: v.string() },
  handler: async (ctx, { slug }) => {
    return await ctx.db
      .query("hackathons")
      .withIndex("by_slug", (q) => q.eq("slug", slug))
      .first() || null;
  },
});

/**
 * Get the signed-in user's application status for a given hackathon, flattened
 * into the shape the Profile page renders. Returns null if the user has no
 * registration yet (or isn't signed in), instead of throwing, so the page can
 * show an "empty" state rather than an error.
 */
const DEFAULT_HACKATHON_ID = "hackuta-2026";
 
export const getMyProfile = query({
  args: { hackathonId: v.optional(v.string()) },
  handler: async (ctx, { hackathonId }) => {
    const identity = await ctx.auth.getUserIdentity();
    if (!identity) return null;
 
    const user = await resolveAuthenticatedUser(ctx);
    const registration = await ctx.db
      .query("registrations")
      .withIndex("by_user_hackathon", (q) =>
        q.eq("userId", user._id).eq("hackathonId", hackathonId ?? DEFAULT_HACKATHON_ID),
      )
      .first();
 
    if (!registration) return null;
 
    return {
      firstName: registration.answers.firstName ?? "",
      lastName: registration.answers.lastName ?? "",
      hackathonId: registration.hackathonId,
      status: registration.status,
      eligibilityStatus: registration.eligibilityStatus,
      submittedAt: registration.submittedAt ?? null,
      reviewedAt: registration.reviewedAt ?? null,
      updatedAt: registration.updatedAt,
      email: user.email ?? registration.answers.email ?? null,
      displayName: user.displayName ?? null,
    };
  },
});