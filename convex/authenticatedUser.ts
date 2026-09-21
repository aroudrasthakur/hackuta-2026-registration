import { getAuthUserId } from "@convex-dev/auth/server";
import type { DataModelFromSchemaDefinition, GenericMutationCtx, GenericQueryCtx } from "convex/server";
import type schema from "./schema";
import { normalizeEmail } from "./lib/normalizeEmail";

type QueryCtx = GenericQueryCtx<DataModelFromSchemaDefinition<typeof schema>>;
type MutationCtx = GenericMutationCtx<DataModelFromSchemaDefinition<typeof schema>>;

async function findLegacyUser(
  ctx: QueryCtx | MutationCtx,
  identityKey: string,
  authSubject: string | undefined,
) {
  let existing = await ctx.db
    .query("users")
    .withIndex("by_identity_key", (q) => q.eq("identityKey", identityKey.trim()))
    .first();
  if (!existing && authSubject?.trim()) {
    existing = await ctx.db
      .query("users")
      .withIndex("by_auth_subject", (q) => q.eq("authSubject", authSubject.trim()))
      .first();
  }
  return existing;
}

async function upsertLegacyUser(
  ctx: MutationCtx,
  identityKey: string,
  email: string | undefined,
  displayName: string | undefined,
  authSubject: string | undefined = undefined,
) {
  const normalizedIdentityKey = identityKey.trim();
  if (!normalizedIdentityKey) {
    throw new Error("A user identity is required.");
  }

  const normalizedAuthSubject = authSubject?.trim() || undefined;
  const normalizedEmail = normalizeEmail(email);
  const existing = await findLegacyUser(ctx, normalizedIdentityKey, normalizedAuthSubject);

  if (normalizedEmail) {
    const emailOwner = await ctx.db
      .query("users")
      .withIndex("email", (q) => q.eq("email", normalizedEmail))
      .first();

    if (emailOwner && (!existing || emailOwner._id !== existing._id)) {
      throw new Error("That email address is already associated with another user.");
    }
  }

  const now = Date.now();
  if (existing) {
    await ctx.db.patch(existing._id, {
      identityKey: normalizedIdentityKey,
      authSubject: normalizedAuthSubject ?? existing.authSubject,
      email: normalizedEmail ?? existing.email,
      displayName: displayName?.trim() || existing.displayName || undefined,
      updatedAt: now,
    });
    return existing._id;
  }

  return ctx.db.insert("users", {
    identityKey: normalizedIdentityKey,
    authSubject: normalizedAuthSubject,
    email: normalizedEmail,
    displayName: displayName?.trim() || undefined,
    createdAt: now,
    updatedAt: now,
  });
}

async function patchAuthenticatedUser(
  ctx: MutationCtx,
  userId: NonNullable<Awaited<ReturnType<typeof getAuthUserId>>>,
  identityKey: string,
  email: string | undefined,
  displayName: string | undefined,
  authSubject: string | undefined,
) {
  const existing = await ctx.db.get(userId);
  const normalizedEmail = normalizeEmail(email) ?? existing?.email;
  if (normalizedEmail) {
    const emailOwner = await ctx.db
      .query("users")
      .withIndex("email", (q) => q.eq("email", normalizedEmail))
      .first();

    if (emailOwner && emailOwner._id !== userId) {
      throw new Error("That email address is already associated with another user.");
    }
  }

  await ctx.db.patch(userId, {
    identityKey: identityKey.trim(),
    authSubject: authSubject?.trim() || existing?.authSubject || undefined,
    email: normalizedEmail,
    displayName: displayName?.trim() || existing?.displayName || undefined,
    updatedAt: Date.now(),
  });
}

export async function resolveAuthenticatedUser(
  ctx: QueryCtx | MutationCtx,
  profile: { displayName?: string } = {},
) {
  const identity = await ctx.auth.getUserIdentity();
  if (!identity) {
    throw new Error("Authentication required.");
  }

  const verifiedEmail = normalizeEmail(identity.email);
  const displayName = identity.name ?? profile.displayName;
  const authUserId = await getAuthUserId(ctx);
  const authUser = authUserId ? await ctx.db.get(authUserId) : null;

  if (authUser) {
    if ("scheduler" in ctx) {
      await patchAuthenticatedUser(
        ctx,
        authUserId!,
        identity.tokenIdentifier,
        verifiedEmail,
        displayName,
        identity.subject,
      );
      const updatedUser = await ctx.db.get(authUserId!);
      if (updatedUser) return updatedUser;
    }
    return authUser;
  }

  if ("scheduler" in ctx) {
    const legacyUserId = await upsertLegacyUser(
      ctx,
      identity.tokenIdentifier,
      verifiedEmail,
      displayName,
      identity.subject,
    );
    const user = await ctx.db.get(legacyUserId);
    if (user) return user;
  } else {
    const user = await findLegacyUser(ctx, identity.tokenIdentifier, identity.subject);
    if (user) return user;
  }

  throw new Error("Authenticated user has not been synchronized.");
}

export async function resolveAuthenticatedUserId(
  ctx: MutationCtx,
  profile: { displayName?: string } = {},
) {
  const user = await resolveAuthenticatedUser(ctx, profile);
  return user._id;
}
