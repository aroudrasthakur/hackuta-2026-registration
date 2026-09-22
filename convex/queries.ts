import { query } from "./_generated/server";
import { v } from "convex/values";
import { HACKATHON_ID } from "../shared/registration/constants";
import { resolveAuthenticatedUser } from "./authenticatedUser";
import { isRegistrationAdmin } from "./registrationSecurity";
import { getApplication } from "./lib/applications";

function projectCurrentUser(user: Awaited<ReturnType<typeof resolveAuthenticatedUser>>) {
  return {
    _id: user._id,
    identityKey: user.identityKey,
    authSubject: user.authSubject,
    email: user.email,
    displayName: user.displayName,
    emailVerificationTime: user.emailVerificationTime,
    createdAt: user.createdAt,
    updatedAt: user.updatedAt,
    hasApplication: user.applications != null,
  };
}

export const getCurrentUser = query({
  args: {},
  handler: async (ctx) => projectCurrentUser(await resolveAuthenticatedUser(ctx)),
});

export const getMyApplication = query({
  args: { hackathonId: v.optional(v.string()) },
  handler: async (ctx, { hackathonId = HACKATHON_ID }) => {
    const user = await resolveAuthenticatedUser(ctx);
    return getApplication(user, hackathonId);
  },
});

export const getApplicationsByHackathon = query({
  args: { hackathonId: v.string() },
  handler: async (ctx, { hackathonId }) => {
    const identity = await ctx.auth.getUserIdentity();
    if (!identity) {
      throw new Error("Authentication required.");
    }
    if (!isRegistrationAdmin(identity.tokenIdentifier)) {
      throw new Error("Not authorized to access hackathon registrations.");
    }

    const users = await ctx.db
      .query("users")
      .withIndex("by_application_status", (q) => q.eq("applications.hackathonId", hackathonId))
      .collect();

    const results = users
      .filter((user) => user.applications?.hackathonId === hackathonId)
      .map((user) => ({
        userId: user._id,
        email: user.email ?? user.applications?.email ?? null,
        displayName: user.displayName ?? null,
        application: user.applications!,
      }));

    console.log(
      JSON.stringify({
        event: "admin_applications_access",
        identityKey: identity.tokenIdentifier,
        hackathonId,
        resultCount: results.length,
        at: Date.now(),
      }),
    );

    return results;
  },
});

export const getHackathonBySlug = query({
  args: { slug: v.string() },
  handler: async (ctx, { slug }) => {
    return await ctx.db
      .query("hackathons")
      .withIndex("by_slug", (q) => q.eq("slug", slug))
      .first() || null;
  },
});
