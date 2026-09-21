import { Component, type ReactNode } from "react";
import { Link } from "react-router-dom";
import { useConvexAuth } from "@convex-dev/auth/react";
import { useQuery } from "convex/react";
import { Logo } from "../../components/art/Logo";
import { api } from "../../../convex/_generated/api";

type Profile = {
  firstName: string;
  lastName: string;
  hackathonId: string;
  status: "draft" | "submitted" | "accepted" | "waitlisted" | "rejected" | "withdrawn";
  eligibilityStatus: "unreviewed" | "eligible" | "ineligible";
  submittedAt: number | null;
  reviewedAt: number | null;
  updatedAt: number;
};

const STATUS_COPY: Record<Profile["status"], { label: string; detail: string }> = {
  draft: { label: "Draft", detail: "Your application is saved but has not been submitted." },
  submitted: { label: "Under review", detail: "Your application is in the review queue." },
  accepted: { label: "Accepted", detail: "You are in. We will send the next steps by email." },
  waitlisted: { label: "Waitlisted", detail: "We will contact you if a place becomes available." },
  rejected: { label: "Not selected", detail: "Thank you for taking the time to apply." },
  withdrawn: { label: "Withdrawn", detail: "This application is no longer active." },
};

const ELIGIBILITY_COPY: Record<Profile["eligibilityStatus"], string> = {
  unreviewed: "Eligibility review pending",
  eligible: "Eligibility confirmed",
  ineligible: "Eligibility requirements not met",
};

function formatDate(timestamp: number | null) {
  if (!timestamp) return "Not available";

  return new Intl.DateTimeFormat("en-US", {
    month: "long",
    day: "numeric",
    year: "numeric",
  }).format(timestamp);
}

// Convex queries throw during render if the subscription itself errors
// (e.g. an unexpected server exception). useQuery has no "error" return
// value the way a fetch().catch() does, so we catch that with a boundary
// instead, to preserve the old "error" UI state.
class ProfileErrorBoundary extends Component<
  { children: ReactNode; fallback: ReactNode },
  { hasError: boolean }
> {
  state = { hasError: false };
  static getDerivedStateFromError() {
    return { hasError: true };
  }
  render() {
    return this.state.hasError ? this.props.fallback : this.props.children;
  }
}

function ProfileCardBody() {
  const { isAuthenticated, isLoading: authLoading } = useConvexAuth();
  const profile = useQuery(
    api.queries.getMyProfile,
    isAuthenticated ? {} : "skip",
  ) as Profile | null | undefined;

  const state: "loading" | "ready" | "empty" | "auth" =
    authLoading
      ? "loading"
      : !isAuthenticated
        ? "auth"
        : profile === undefined
          ? "loading"
          : profile
            ? "ready"
            : "empty";

  const status = profile ? STATUS_COPY[profile.status] : null;

  return (
    <>
      {state === "loading" && <p className="text-(--color-ocean)">Loading your application...</p>}
      {state === "auth" && (
        <div role="alert">
          <h2 className="font-(family-name:--font-display) text-3xl">Sign in required</h2>
          <p className="mt-3 text-(--color-ocean)">Please sign in with the account used for your application.</p>
        </div>
      )}
      {state === "empty" && (
        <div>
          <h2 className="font-(family-name:--font-display) text-3xl">No application found</h2>
          <p className="mt-3 text-(--color-ocean)">We could not find an application for this account.</p>
        </div>
      )}
      {state === "ready" && profile && status && (
        <div>
          <div className="flex flex-wrap items-start justify-between gap-4 border-b border-(--color-ocean)/50 pb-6">
            <div>
              <p className="text-sm uppercase tracking-[0.16em] text-(--color-ocean)">Applicant</p>
              <h2 className="mt-2 font-(family-name:--font-display) text-4xl text-(--color-ink)">{profile.firstName} {profile.lastName}</h2>
            </div>
            <span className="border border-(--color-ocean)/70 px-3 py-2 text-sm uppercase tracking-[0.12em] text-(--color-ocean)">
              {status.label}
            </span>
          </div>
          <p className="mt-6 text-xl text-(--color-ink)">{status.detail}</p>
          <dl className="mt-8 grid gap-5 border-t border-(--color-ocean)/50 pt-6 sm:grid-cols-2">
            <div>
              <dt className="text-sm text-(--color-ocean)">Application submitted</dt>
              <dd className="mt-1 text-(--color-ink)">{formatDate(profile.submittedAt)}</dd>
            </div>
            <div>
              <dt className="text-sm text-(--color-ocean)">Eligibility</dt>
              <dd className="mt-1 text-(--color-ink)">{ELIGIBILITY_COPY[profile.eligibilityStatus]}</dd>
            </div>
            <div>
              <dt className="text-sm text-(--color-ocean)">Last updated</dt>
              <dd className="mt-1 text-(--color-ink)">{formatDate(profile.updatedAt)}</dd>
            </div>
          </dl>
          <p className="mt-8 border-l-2 border-(--color-ocean) pl-4 text-sm text-(--color-ocean)">
            This page is view only. Questions about your application? Reply to the HackUTA email you received.
          </p>
        </div>
      )}
    </>
  );
}

const errorFallback = (
  <div role="alert">
    <h2 className="font-(family-name:--font-display) text-3xl">We could not load your profile</h2>
    <p className="mt-3 text-(--color-mist)">Please try again in a moment.</p>
  </div>
);

export default function ProfilePage() {
  return (
    <main className="min-h-screen bg-(--color-clay) text-(--color-ink)">
      <div className="mx-auto flex min-h-screen w-full max-w-5xl flex-col px-6 py-8 sm:px-10 sm:py-12">
        <header className="flex items-center justify-between gap-6">
          <Link to="/" aria-label="HackUTA home" className="inline-flex">
            <Logo className="h-10 w-auto" variant="dark" layout="header" decorative />
          </Link>
          <Link
            to="/"
            className="text-sm uppercase tracking-[0.12em] text-(--color-ink) underline decoration-(--color-ocean) underline-offset-8"
          >
            Home
          </Link>
        </header>

        <section className="grid flex-1 content-center gap-8 py-16 lg:grid-cols-[1fr_1.15fr] lg:gap-16">
          <div>
            <p className="mb-4 text-sm uppercase tracking-[0.2em] text-(--color-ocean)">Applicant portal</p>
            <h1 className="max-w-xl font-(family-name:--font-display) text-5xl leading-[0.95] text-(--color-ink) sm:text-7xl">
              Your HackUTA journey
            </h1>
            <p className="mt-6 max-w-md text-lg text-(--color-ocean)">
              This is your private application record. We will update it here as decisions are made.
            </p>
          </div>

          <div className="border border-(--color-ocean)/60 bg-(--color-light) p-6 shadow-2xl sm:p-10">
            <ProfileErrorBoundary fallback={errorFallback}>
              <ProfileCardBody />
            </ProfileErrorBoundary>
          </div>
        </section>
      </div>
    </main>
  );
}