import type { GenericMutationCtx, GenericQueryCtx } from "convex/server";
import type { DataModelFromSchemaDefinition } from "convex/server";
import type schema from "./schema";

type DbCtx = GenericQueryCtx<DataModelFromSchemaDefinition<typeof schema>>
  | GenericMutationCtx<DataModelFromSchemaDefinition<typeof schema>>;

const HACKATHON_SEEDS = {
  "hackuta-2026": {
    slug: "hackuta-2026",
    name: "HackUTA 2026",
    startsAt: Date.parse("2026-11-14T09:00:00-06:00"),
    endsAt: Date.parse("2026-11-15T18:00:00-06:00"),
    registrationOpensAt: Date.parse("2026-09-01T00:00:00-05:00"),
    registrationClosesAt: Date.parse("2026-11-14T09:00:00-06:00"),
  },
} as const;

export async function ensureHackathon(
  ctx: DbCtx,
  slug: string,
) {
  const existing = await ctx.db
    .query("hackathons")
    .withIndex("by_slug", (q) => q.eq("slug", slug))
    .first();
  if (existing) return existing;

  const seed = HACKATHON_SEEDS[slug as keyof typeof HACKATHON_SEEDS];
  if (!seed || !("runMutation" in ctx)) {
    throw new Error("Hackathon not found.");
  }

  const hackathonId = await ctx.db.insert("hackathons", seed);
  const hackathon = await ctx.db.get(hackathonId);
  if (!hackathon) {
    throw new Error("Hackathon could not be initialized.");
  }
  return hackathon;
}
