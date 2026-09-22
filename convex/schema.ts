import { defineSchema, defineTable } from 'convex/server';
import { v } from 'convex/values';
import { authTables } from '@convex-dev/auth/server';
import { application } from './applicationFields';

export default defineSchema({
  ...authTables,
  users: defineTable({
    name: v.optional(v.string()),
    image: v.optional(v.string()),
    email: v.optional(v.string()),
    emailVerificationTime: v.optional(v.number()),
    phone: v.optional(v.string()),
    phoneVerificationTime: v.optional(v.number()),
    isAnonymous: v.optional(v.boolean()),
    identityKey: v.optional(v.string()),
    authSubject: v.optional(v.string()),
    displayName: v.optional(v.string()),
    createdAt: v.optional(v.number()),
    updatedAt: v.optional(v.number()),
    applications: v.optional(application),
  })
    .index('email', ['email'])
    .index('phone', ['phone'])
    .index('by_identity_key', ['identityKey'])
    .index('by_auth_subject', ['authSubject'])
    .index('by_resume', ['applications.resumeStorageId'])
    .index('by_application_status', ['applications.hackathonId', 'applications.status']),

  hackathons: defineTable({
    slug: v.string(),
    name: v.string(),
    startsAt: v.number(),
    endsAt: v.number(),
    registrationOpensAt: v.number(),
    registrationClosesAt: v.number(),
    decisionsReleasedAt: v.optional(v.number()),
  }).index('by_slug', ['slug']),

  rateLimits: defineTable({
    bucket: v.string(),
    key: v.string(),
    createdAt: v.number(),
  })
    .index('by_bucket_createdAt', ['bucket', 'createdAt']),

  resumeUploadSessions: defineTable({
    token: v.string(),
    createdAt: v.number(),
    storageId: v.optional(v.id('_storage')),
    verifiedAt: v.optional(v.number()),
    consumedAt: v.optional(v.number()),
  })
    .index('by_token', ['token'])
    .index('by_storage', ['storageId'])
    .index('by_createdAt', ['createdAt']),
});
