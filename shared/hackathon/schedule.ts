/** Canonical HackUTA 2026 schedule — keep seed/hackathons.ts in sync. */
export const HACKATHON_SCHEDULE = {
  registrationOpensAt: Date.parse("2026-09-21T00:00:00-05:00"),
  registrationClosesAt: Date.parse("2026-11-07T23:59:59-06:00"),
  startsAt: Date.parse("2026-11-14T09:00:00-06:00"),
  endsAt: Date.parse("2026-11-15T18:00:00-06:00"),
} as const;

export type HackathonTimelineSource = {
  registrationOpensAt: number;
  registrationClosesAt: number;
  decisionsReleasedAt?: number | null;
  startsAt: number;
};

export function resolveHackathonTimelineSource(
  hackathon: HackathonTimelineSource | null | undefined,
): HackathonTimelineSource {
  if (!hackathon) {
    return HACKATHON_SCHEDULE;
  }

  return {
    registrationOpensAt: hackathon.registrationOpensAt,
    registrationClosesAt: hackathon.registrationClosesAt,
    decisionsReleasedAt: hackathon.decisionsReleasedAt ?? null,
    startsAt: hackathon.startsAt,
  };
}
