import { ConvexHttpClient } from "convex/browser";

const convexUrl = process.env.VITE_CONVEX_URL;
const authToken = process.env.CONVEX_AUTH_TOKEN;

if (!convexUrl || !authToken) {
  throw new Error(
    "Set VITE_CONVEX_URL and CONVEX_AUTH_TOKEN before running deployment verification.",
  );
}

const client = new ConvexHttpClient(convexUrl);
client.setAuth(authToken);

const hackathon = await client.query("queries:getHackathonBySlug", {
  slug: "hackuta-2026",
});
if (!hackathon) {
  throw new Error("The deployed hackuta-2026 hackathon record was not found.");
}

const user = await client.mutation("registrations:syncUser", {});
if (!user.ok || !user.userId) {
  throw new Error("Authenticated user synchronization failed.");
}

console.log(`Convex deployment verified for ${hackathon.slug}; user ${user.userId} synchronized.`);