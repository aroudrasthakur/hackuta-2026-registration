import type { ReactNode } from "react";
import { useQuery } from "convex/react";
import { useNavigate } from "react-router-dom";
import { OdysseyButton } from "../../components/OdysseyButton";
import { PageShell } from "../../components/PageShell";
import { StormPageFrame } from "../../components/StormPageFrame";
import { useMockAuth } from "../../components/MockAuthProvider";
import { getMyApplicantDashboardRef } from "../../convex/api";
import { getConvexClient } from "../../convex/client";
import { ApplicantTimeline } from "./ApplicantTimeline";
import { useSessionAuth } from "../../hooks/useSessionAuth";

const PROFILE_SHELL = {
  title: "Your Journey",
  subtitle: "HackUTA 2026 applicant dashboard",
} as const;

function ProfilePageShell({ children }: { children: ReactNode }) {
  return (
    <StormPageFrame>
      <PageShell {...PROFILE_SHELL} frameless>
        {children}
      </PageShell>
    </StormPageFrame>
  );
}

export default function ProfilePage() {
  const navigate = useNavigate();
  const { signOut } = useSessionAuth();
  const mockAuth = useMockAuth();
  const client = getConvexClient();
  const dashboard = useQuery(
    getMyApplicantDashboardRef,
    client && !mockAuth.enabled ? {} : "skip",
  );

  const handleSignOut = async () => {
    if (mockAuth.enabled) {
      mockAuth.signOut();
      navigate("/sign-in", { replace: true });
      return;
    }
    await signOut();
    navigate("/sign-in", { replace: true });
  };

  if (!mockAuth.enabled && dashboard === undefined) {
    return (
      <ProfilePageShell>
        <p className="text-sm text-(--ocean)" role="status" aria-live="polite">
          Loading your application…
        </p>
      </ProfilePageShell>
    );
  }

  const mockTimestamp = 1_700_000_000_000;
  const profile = mockAuth.enabled
    ? {
        profile: {
          displayName: "Sam Test",
          verifiedEmail: mockAuth.verifiedEmail,
        },
        registration: mockAuth.hasSubmittedRegistration
          ? {
              status: "submitted",
              eligibilityStatus: "unreviewed",
              submittedAt: mockTimestamp,
              updatedAt: mockTimestamp,
              resumeStatus: "none" as const,
              answers: {
                firstName: "Sam",
                lastName: "Test",
                school: "UT Arlington",
                levelOfStudy: "Undergraduate - Junior",
                graduationYear: 2026,
              },
            }
          : null,
        timeline: [
          {
            id: "email-verified",
            label: "Email verified",
            timestamp: mockTimestamp,
            complete: true,
          },
        ],
      }
    : dashboard;

  if (!profile) {
    return (
      <ProfilePageShell>
        <p className="text-sm text-red-600" role="alert">
          We couldn&apos;t load your application. Please try again.
        </p>
      </ProfilePageShell>
    );
  }

  const registration = profile.registration;

  return (
    <ProfilePageShell>
      <div className="flex flex-col gap-8">
        <div className="border-b-2 border-(--sand) pb-6">
          <h2 className="font-(family-name:--font-display) text-2xl text-(--ink)">
            Your application
          </h2>
          <p className="mt-3 text-sm leading-relaxed text-(--ocean)">
            Track your HackUTA 2026 registration status.
          </p>
        </div>

        <section className="space-y-3">
          <h3 className="text-base font-semibold text-(--ocean)">Profile</h3>
          <dl className="grid gap-2 text-sm">
            <div>
              <dt className="font-medium text-(--ink)">Verified email</dt>
              <dd className="text-(--ocean)">{profile.profile.verifiedEmail ?? "—"}</dd>
            </div>
            {profile.profile.displayName ? (
              <div>
                <dt className="font-medium text-(--ink)">Name</dt>
                <dd className="text-(--ocean)">{profile.profile.displayName}</dd>
              </div>
            ) : null}
          </dl>
        </section>

        {!registration ? (
          <section className="rounded-lg border-2 border-dashed border-(--sand) p-6 text-sm text-(--ocean)">
            <p>You haven&apos;t started an application yet.</p>
            <div className="mt-4">
              <OdysseyButton href="/register">Start application</OdysseyButton>
            </div>
          </section>
        ) : (
          <>
            <section className="space-y-3">
              <h3 className="text-base font-semibold text-(--ocean)">Application status</h3>
              <p className="text-sm capitalize text-(--ink)">{registration.status.replace("-", " ")}</p>
              {registration.submittedAt ? (
                <p className="text-sm text-(--ocean)">
                  Submitted {new Date(registration.submittedAt).toLocaleString()}
                </p>
              ) : (
                <div className="space-y-3">
                  <p className="text-sm text-(--ocean)">Your application is incomplete.</p>
                  <OdysseyButton href="/register">Continue application</OdysseyButton>
                </div>
              )}
              <p className="text-sm text-(--ocean)">
                Resume: {registration.resumeStatus === "attached" ? "Uploaded" : "Not uploaded"}
              </p>
            </section>

            {registration.answers ? (
              <section className="space-y-3">
                <h3 className="text-base font-semibold text-(--ocean)">Submitted details</h3>
                <dl className="grid gap-2 text-sm sm:grid-cols-2">
                  {registration.answers.firstName ? (
                    <div>
                      <dt className="font-medium text-(--ink)">First name</dt>
                      <dd className="text-(--ocean)">{registration.answers.firstName}</dd>
                    </div>
                  ) : null}
                  {registration.answers.lastName ? (
                    <div>
                      <dt className="font-medium text-(--ink)">Last name</dt>
                      <dd className="text-(--ocean)">{registration.answers.lastName}</dd>
                    </div>
                  ) : null}
                  {registration.answers.school ? (
                    <div>
                      <dt className="font-medium text-(--ink)">School</dt>
                      <dd className="text-(--ocean)">{registration.answers.school}</dd>
                    </div>
                  ) : null}
                  {registration.answers.levelOfStudy ? (
                    <div>
                      <dt className="font-medium text-(--ink)">Level of study</dt>
                      <dd className="text-(--ocean)">{registration.answers.levelOfStudy}</dd>
                    </div>
                  ) : null}
                  {registration.answers.graduationYear ? (
                    <div>
                      <dt className="font-medium text-(--ink)">Graduation year</dt>
                      <dd className="text-(--ocean)">{registration.answers.graduationYear}</dd>
                    </div>
                  ) : null}
                </dl>
              </section>
            ) : null}

            <ApplicantTimeline events={profile.timeline} />
          </>
        )}

        <div className="border-t-2 border-(--sand) pt-6">
          <OdysseyButton type="button" onClick={() => void handleSignOut()}>
            Sign out
          </OdysseyButton>
        </div>
      </div>
    </ProfilePageShell>
  );
}
