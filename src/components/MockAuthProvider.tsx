import {
  createContext,
  useCallback,
  useContext,
  useMemo,
  useState,
  type ReactNode,
} from "react";

export type MockAuthScenario =
  | "signedOut"
  | "otpPending"
  | "signedInNew"
  | "signedInReturning";

type MockAuthContextValue = {
  enabled: boolean;
  isLoading: boolean;
  isAuthenticated: boolean;
  verifiedEmail: string | null;
  hasRegistration: boolean;
  hasSubmittedRegistration: boolean;
  registrationStatus: string | null;
  scenario: MockAuthScenario;
  setScenario: (scenario: MockAuthScenario) => void;
  requestOtp: (email: string) => void;
  verifyOtp: (code: string) => boolean;
  signOut: () => void;
};

const MOCK_OTP = "042681";

const defaultValue: MockAuthContextValue = {
  enabled: false,
  isLoading: false,
  isAuthenticated: false,
  verifiedEmail: null,
  hasRegistration: false,
  hasSubmittedRegistration: false,
  registrationStatus: null,
  scenario: "signedOut",
  setScenario: () => undefined,
  requestOtp: () => undefined,
  verifyOtp: () => false,
  signOut: () => undefined,
};

const MockAuthContext = createContext<MockAuthContextValue>(defaultValue);

export function useMockAuth() {
  return useContext(MockAuthContext);
}

export function isMockApiEnabled() {
  return import.meta.env.VITE_USE_MOCK_API === "true" && !import.meta.env.PROD;
}

function scenarioState(scenario: MockAuthScenario, email: string | null): Omit<
  MockAuthContextValue,
  "enabled" | "scenario" | "setScenario" | "requestOtp" | "verifyOtp" | "signOut"
> {
  switch (scenario) {
    case "signedOut":
      return {
        isLoading: false,
        isAuthenticated: false,
        verifiedEmail: null,
        hasRegistration: false,
        hasSubmittedRegistration: false,
        registrationStatus: null,
      };
    case "otpPending":
      return {
        isLoading: false,
        isAuthenticated: false,
        verifiedEmail: email,
        hasRegistration: false,
        hasSubmittedRegistration: false,
        registrationStatus: null,
      };
    case "signedInNew":
      return {
        isLoading: false,
        isAuthenticated: true,
        verifiedEmail: email ?? "applicant@example.com",
        hasRegistration: false,
        hasSubmittedRegistration: false,
        registrationStatus: null,
      };
    case "signedInReturning":
      return {
        isLoading: false,
        isAuthenticated: true,
        verifiedEmail: email ?? "applicant@example.com",
        hasRegistration: true,
        hasSubmittedRegistration: true,
        registrationStatus: "submitted",
      };
  }
}

export function MockAuthProvider({ children }: { children: ReactNode }) {
  const enabled = isMockApiEnabled();
  const [scenario, setScenarioState] = useState<MockAuthScenario>("signedOut");
  const [pendingEmail, setPendingEmail] = useState<string | null>(null);
  const [verifiedEmail, setVerifiedEmail] = useState<string | null>(null);

  const setScenario = useCallback((next: MockAuthScenario) => {
    setScenarioState(next);
    if (next === "signedOut") {
      setPendingEmail(null);
      setVerifiedEmail(null);
    }
  }, []);

  const requestOtp = useCallback((email: string) => {
    setPendingEmail(email);
    setScenarioState("otpPending");
  }, []);

  const verifyOtp = useCallback(
    (code: string) => {
      if (code !== MOCK_OTP) return false;
      const email = pendingEmail ?? "applicant@example.com";
      setVerifiedEmail(email);
      setScenarioState("signedInNew");
      return true;
    },
    [pendingEmail],
  );

  const signOut = useCallback(() => {
    setScenarioState("signedOut");
    setPendingEmail(null);
    setVerifiedEmail(null);
  }, []);

  const value = useMemo<MockAuthContextValue>(() => {
    if (!enabled) return defaultValue;

    const email = verifiedEmail ?? pendingEmail;
    const base = scenarioState(scenario, email);

    return {
      enabled: true,
      scenario,
      setScenario,
      requestOtp,
      verifyOtp,
      signOut,
      ...base,
    };
  }, [enabled, pendingEmail, requestOtp, scenario, setScenario, verifiedEmail, verifyOtp, signOut]);

  return (
    <MockAuthContext.Provider value={value}>{children}</MockAuthContext.Provider>
  );
}

export { MOCK_OTP };
