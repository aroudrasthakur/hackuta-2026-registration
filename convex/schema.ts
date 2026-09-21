import { defineSchema, defineTable } from 'convex/server';
import { v } from 'convex/values';
import { authTables } from '@convex-dev/auth/server';
import { registrationAnswers } from './registrationAnswers';

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
  })
    .index('email', ['email'])
    .index('phone', ['phone'])
    .index('by_identity_key', ['identityKey'])
    .index('by_auth_subject', ['authSubject']),

  hackathons: defineTable({
    slug: v.string(),
    name: v.string(),
    startsAt: v.number(),
    endsAt: v.number(),
    registrationOpensAt: v.number(),
    registrationClosesAt: v.number(),
  }).index('by_slug', ['slug']),

  registrations: defineTable({
    userId: v.id('users'),
    hackathonId: v.string(),
    status: v.union(
      v.literal('draft'),
      v.literal('submitted'),
      v.literal('accepted'),
      v.literal('waitlisted'),
      v.literal('rejected'),
      v.literal('withdrawn'),
    ),
    eligibilityStatus: v.union(
      v.literal('unreviewed'),
      v.literal('eligible'),
      v.literal('ineligible'),
    ),
    answers: registrationAnswers,
    submittedAt: v.optional(v.number()),
    reviewedAt: v.optional(v.number()),
    reviewedBy: v.optional(v.string()),
    checkedInAt: v.optional(v.number()),
    updatedAt: v.number(),
  })
    .index('by_user_hackathon', ['userId', 'hackathonId'])
    .index('by_resume', ['answers.resumeStorageId'])
    .index('by_hackathon_status', ['hackathonId', 'status']),

  resumeUploadRequests: defineTable({
    userKey: v.string(),
    createdAt: v.number(),
  })
    .index('by_user_createdAt', ['userKey', 'createdAt'])
    .index('by_createdAt', ['createdAt']),

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
