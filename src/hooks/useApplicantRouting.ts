import { useQuery } from "convex/react";
import { getApplicantRoutingStateRef } from "../convex/api";
import { getConvexClient } from "../convex/client";
import { useAuthenticatedUserSync } from "./useAuthenticatedUserSync";
import { useMockAuth } from "./useMockAuth";
import { useSessionAuth } from "./useSessionAuth";

export function useApplicantRouting() {
  const { isAuthenticated, isLoading: authLoading } = useSessionAuth();
  const mockAuth = useMockAuth();
  const client = getConvexClient();
  const userSynced = useAuthenticatedUserSync();

  const routingState = useQuery(
    getApplicantRoutingStateRef,
    client && isAuthenticated && !mockAuth.enabled && userSynced ? {} : "skip",
  );

  if (mockAuth.enabled) {
    return {
      isLoading: mockAuth.isLoading,
      isAuthenticated: mockAuth.isAuthenticated,
      verifiedEmail: mockAuth.verifiedEmail,
      hasRegistration: mockAuth.hasRegistration,
      hasSubmittedRegistration: mockAuth.hasSubmittedRegistration,
      registrationStatus: mockAuth.registrationStatus,
    };
  }

  return {
    isLoading: authLoading || (isAuthenticated && (!userSynced || routingState === undefined)),
    isAuthenticated,
    verifiedEmail: routingState?.verifiedEmail ?? null,
    hasRegistration: routingState?.hasRegistration ?? false,
    hasSubmittedRegistration: routingState?.hasSubmittedRegistration ?? false,
    registrationStatus: routingState?.registrationStatus ?? null,
  };
}
