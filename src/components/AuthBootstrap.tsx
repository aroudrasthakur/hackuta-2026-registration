import { useEffect, type ReactNode } from "react";
import { useAuthActions, useConvexAuth } from "@convex-dev/auth/react";

export function AuthBootstrap({ children }: { children: ReactNode }) {
  const { isLoading, isAuthenticated } = useConvexAuth();
  const { signIn } = useAuthActions();

  useEffect(() => {
    if (!isLoading && !isAuthenticated) {
      void signIn("anonymous");
    }
  }, [isAuthenticated, isLoading, signIn]);

  return children;
}