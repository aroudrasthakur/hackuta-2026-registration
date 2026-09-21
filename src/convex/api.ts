import { makeFunctionReference } from "convex/server";

export const getApplicantRoutingStateRef = makeFunctionReference<
  "query",
  { hackathonId?: string },
  {
    authenticated: boolean;
    verifiedEmail: string | null;
    hasRegistration: boolean;
    registrationStatus: string | null;
    hasSubmittedRegistration?: boolean;
  }
>("applicant:getApplicantRoutingState");

export const getMyApplicantDashboardRef = makeFunctionReference<
  "query",
  { hackathonId?: string }
>("applicant:getMyApplicantDashboard");

export const claimLegacyRegistrationRef = makeFunctionReference<
  "mutation",
  { hackathonId?: string }
>("applicant:claimLegacyRegistrationIfEligible");

export const syncUserRef = makeFunctionReference<
  "mutation",
  { displayName?: string }
>("registrations:syncUser");

export const submitContactMessageRef = makeFunctionReference<
  "action",
  {
    name: string;
    email: string;
    subject?: string;
    message: string;
    website?: string;
    clientKey?: string;
  }
>("contact:submitContactMessage");
