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
  const [ready, setReady] = useState(() => !getConvexClient() || isMockApiEnabled());

  useEffect(() => {
    if (isMockApiEnabled() || !getConvexClient()) {
      setReady(true);
      return;
    }

    if (isLoading || !isAuthenticated) {
      setReady(false);
      return;
    }

    let cancelled = false;
    void syncUser({}).finally(() => {
      if (!cancelled) setReady(true);
    });

    return () => {
      cancelled = true;
    };
  }, [isAuthenticated, isLoading, syncUser]);

  return ready;
}
