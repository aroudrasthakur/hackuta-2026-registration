import { internalMutation } from "./_generated/server";

export const seedHackathon = internalMutation({
  args: {},
  handler: async (ctx) => {
    const slug = "hackuta-2026";
    const existing = await ctx.db
      .query("hackathons")
      .withIndex("by_slug", (q) => q.eq("slug", slug))
      .first();
    if (existing) return existing._id;

    return ctx.db.insert("hackathons", {
      slug,
      name: "HackUTA 2026",
      startsAt: Date.parse("2026-11-14T09:00:00-06:00"),
      endsAt: Date.parse("2026-11-15T18:00:00-06:00"),
      registrationOpensAt: Date.parse("2026-09-01T00:00:00-05:00"),
      registrationClosesAt: Date.parse("2026-11-14T09:00:00-06:00"),
    });
  },
});