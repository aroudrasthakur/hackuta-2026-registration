import { useMutation } from "convex/react";
import { useEffect, useState } from "react";
import { isMockApiEnabled } from "../constants/mockAuth";
import { syncUserRef } from "../convex/api";
import { getConvexClient } from "../convex/client";
import { useSessionAuth } from "./useSessionAuth";

/** Ensures Convex Auth users exist in the app users table before other queries run. */
export function useAuthenticatedUserSync() {
  const { isAuthenticated, isLoading } = useSessionAuth();
  const syncUser = useMutation(syncUserRef);
  const skipSync = isMockApiEnabled() || !getConvexClient();
  const [synced, setSynced] = useState(false);

  useEffect(() => {
    if (skipSync || isLoading || !isAuthenticated) return;

    let cancelled = false;
    void syncUser({}).finally(() => {
      if (!cancelled) setSynced(true);
    });

    return () => {
      cancelled = true;
      setSynced(false);
    };
  }, [skipSync, isAuthenticated, isLoading, syncUser]);

  if (skipSync) return true;
  if (isLoading || !isAuthenticated) return false;
  return synced;
}
