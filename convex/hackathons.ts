import type { GenericMutationCtx, GenericQueryCtx } from "convex/server";
import type { DataModelFromSchemaDefinition } from "convex/server";
import type schema from "./schema";
import { HACKATHON_SCHEDULE } from "../shared/hackathon/schedule";

type DbCtx = GenericQueryCtx<DataModelFromSchemaDefinition<typeof schema>>
  | GenericMutationCtx<DataModelFromSchemaDefinition<typeof schema>>;

const HACKATHON_SEEDS = {
  "hackuta-2026": {
    slug: "hackuta-2026",
    name: "HackUTA 2026",
    ...HACKATHON_SCHEDULE,
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
