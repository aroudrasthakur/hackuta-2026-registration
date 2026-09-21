import { useMutation } from "convex/react";
import { useCallback, useEffect, useState, type FormEvent } from "react";
import { Navigate, useNavigate } from "react-router-dom";
import { isValidEmailSyntax, normalizeEmail } from "../../../shared/lib/normalizeEmail";
import { OdysseyButton } from "../../components/OdysseyButton";
import { PageShell } from "../../components/PageShell";
import { useMockAuth } from "../../components/MockAuthProvider";
import { claimLegacyRegistrationRef } from "../../convex/api";
import { getConvexClient } from "../../convex/client";
import { fieldClass, labelClass, legendClass } from "../Register/components/formFieldStyles";
import { useApplicantRouting } from "../../hooks/useApplicantRouting";
import { useSessionAuth } from "../../hooks/useSessionAuth";

const OTP_SENT_MESSAGE =
  "If this email address can receive messages, we sent a verification code.";
const OTP_INVALID_MESSAGE = "The verification code is invalid or expired.";
const RESEND_COOLDOWN_SECONDS = 60;

function getSendCodeFailureMessage(error: unknown): string {
  if (import.meta.env.DEV && error instanceof Error && error.message.trim()) {
    return error.message;
  }
  return OTP_SENT_MESSAGE;
}

type SignInStep = "email" | "otp";

export default function SignInPage() {
  const navigate = useNavigate();
  const { isAuthenticated, isLoading, signIn } = useSessionAuth();
  const mockAuth = useMockAuth();
  const routing = useApplicantRouting();
  const claimLegacy = useMutation(claimLegacyRegistrationRef);
  const client = getConvexClient();

  const [step, setStep] = useState<SignInStep>("email");
  const [email, setEmail] = useState("");
  const [code, setCode] = useState("");
  const [pending, setPending] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [info, setInfo] = useState<string | null>(null);
  const [resendSeconds, setResendSeconds] = useState(0);

  useEffect(() => {
    if (resendSeconds <= 0) return;
    const timer = window.setTimeout(() => setResendSeconds((value) => value - 1), 1000);
    return () => window.clearTimeout(timer);
  }, [resendSeconds]);

  const routeAfterSignIn = useCallback(async () => {
    if (mockAuth.enabled) {
      navigate(mockAuth.hasSubmittedRegistration ? "/profile" : "/register", { replace: true });
      return;
    }

    if (client) {
      await claimLegacy({});
    }

    const destination = routing.hasSubmittedRegistration ? "/profile" : "/register";
    navigate(destination, { replace: true });
  }, [claimLegacy, client, mockAuth, navigate, routing.hasSubmittedRegistration]);

  useEffect(() => {
    if (!isLoading && isAuthenticated && !routing.isLoading && routing.isAuthenticated) {
      void routeAfterSignIn();
    }
  }, [isAuthenticated, isLoading, routeAfterSignIn, routing.isAuthenticated, routing.isLoading]);

  if (!isLoading && isAuthenticated && routing.isAuthenticated) {
    return (
      <Navigate
        to={routing.hasSubmittedRegistration ? "/profile" : "/register"}
        replace
      />
    );
  }

  const handleSendCode = async (event: FormEvent) => {
    event.preventDefault();
    if (pending) return;

    const normalized = normalizeEmail(email);
    if (!normalized || !isValidEmailSyntax(normalized)) {
      setError("Please enter a valid email address.");
      setInfo(null);
      return;
    }

    setPending(true);
    setError(null);
    setInfo(null);

    try {
      if (mockAuth.enabled) {
        mockAuth.requestOtp(normalized);
        setStep("otp");
        setInfo(OTP_SENT_MESSAGE);
        setResendSeconds(RESEND_COOLDOWN_SECONDS);
        return;
      }

      await signIn("email", { email: normalized });
      setEmail(normalized);
      setStep("otp");
      setInfo(OTP_SENT_MESSAGE);
      setResendSeconds(RESEND_COOLDOWN_SECONDS);
    } catch (error) {
      const message = getSendCodeFailureMessage(error);
      if (import.meta.env.DEV && error instanceof Error) {
        setError(message);
        return;
      }
      setInfo(message);
      setStep("otp");
      setResendSeconds(RESEND_COOLDOWN_SECONDS);
    } finally {
      setPending(false);
    }
  };

  const handleVerifyCode = async (event: FormEvent) => {
    event.preventDefault();
    if (pending) return;

    const normalized = normalizeEmail(email);
    const trimmedCode = code.trim();
    if (!normalized || trimmedCode.length !== 6) {
      setError(OTP_INVALID_MESSAGE);
      return;
    }

    setPending(true);
    setError(null);

    try {
      if (mockAuth.enabled) {
        const ok = mockAuth.verifyOtp(trimmedCode);
        if (!ok) {
          setError(OTP_INVALID_MESSAGE);
          return;
        }
        await routeAfterSignIn();
        return;
      }

      const result = await signIn("email", { email: normalized, code: trimmedCode });
      if (!result.signingIn) {
        setError(OTP_INVALID_MESSAGE);
        return;
      }
      await routeAfterSignIn();
    } catch {
      setError(OTP_INVALID_MESSAGE);
    } finally {
      setPending(false);
    }
  };

  const handleResend = async () => {
    if (pending || resendSeconds > 0) return;
    const normalized = normalizeEmail(email);
    if (!normalized) return;

    setPending(true);
    setError(null);
    try {
      if (mockAuth.enabled) {
        mockAuth.requestOtp(normalized);
      } else {
        await signIn("email", { email: normalized });
      }
      setInfo(OTP_SENT_MESSAGE);
      setResendSeconds(RESEND_COOLDOWN_SECONDS);
    } catch {
      setInfo(OTP_SENT_MESSAGE);
      setResendSeconds(RESEND_COOLDOWN_SECONDS);
    } finally {
      setPending(false);
    }
  };

  return (
    <PageShell title="Sign in" subtitle="Verify your email to continue">
      {step === "email" ? (
        <form onSubmit={handleSendCode} noValidate className="flex flex-col gap-6">
          <label className={labelClass} htmlFor="sign-in-email">
            <span className={legendClass}>Email address</span>
            <input
              id="sign-in-email"
              type="email"
              autoComplete="email"
              inputMode="email"
              required
              value={email}
              onChange={(event) => setEmail(event.target.value)}
              className={fieldClass(error ?? undefined)}
              aria-invalid={!!error}
            />
          </label>

          {error ? (
            <p className="text-sm font-medium text-red-600" role="alert">
              {error}
            </p>
          ) : null}
          {info ? (
            <p className="text-sm text-(--ocean)" role="status" aria-live="polite">
              {info}
            </p>
          ) : null}

          <OdysseyButton type="submit" disabled={pending}>
            {pending ? "Sending…" : "Send verification code"}
          </OdysseyButton>
        </form>
      ) : (
        <form onSubmit={handleVerifyCode} noValidate className="flex flex-col gap-6">
          <p className="text-sm text-(--ocean)">
            Enter the 6-digit code sent to <strong>{email}</strong>.
          </p>

          <label className={labelClass} htmlFor="sign-in-code">
            <span className={legendClass}>Verification code</span>
            <input
              id="sign-in-code"
              type="text"
              inputMode="numeric"
              autoComplete="one-time-code"
              pattern="[0-9]{6}"
              maxLength={6}
              required
              value={code}
              onChange={(event) => setCode(event.target.value.replace(/\D/g, "").slice(0, 6))}
              className={fieldClass(error ?? undefined)}
              aria-invalid={!!error}
            />
          </label>

          {error ? (
            <p className="text-sm font-medium text-red-600" role="alert">
              {error}
            </p>
          ) : null}
          {info ? (
            <p className="text-sm text-(--ocean)" role="status" aria-live="polite">
              {info}
            </p>
          ) : null}

          <div className="flex flex-col gap-3 sm:flex-row">
            <OdysseyButton type="submit" disabled={pending}>
              {pending ? "Verifying…" : "Verify code"}
            </OdysseyButton>
            <OdysseyButton
              type="button"
              disabled={pending || resendSeconds > 0}
              onClick={() => void handleResend()}
            >
              {resendSeconds > 0 ? `Resend in ${resendSeconds}s` : "Resend code"}
            </OdysseyButton>
          </div>

          <button
            type="button"
            className="text-sm text-(--ocean) underline decoration-1 underline-offset-2"
            onClick={() => {
              setStep("email");
              setCode("");
              setError(null);
              setInfo(null);
            }}
          >
            Change email
          </button>
        </form>
      )}
    </PageShell>
  );
}
