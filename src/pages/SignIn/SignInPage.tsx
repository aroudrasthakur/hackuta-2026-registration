import { useMutation } from "convex/react";
import { useCallback, useEffect, useState, type FormEvent, type ReactNode } from "react";
import { Navigate, useNavigate } from "react-router-dom";
import {
  cooldownStatusFromExpiry,
  formatOtpResendLabel,
  getCooldownWaitSeconds,
  getOtpSendErrorMessage,
  mergeCooldownExpiry,
  isOtpRateLimitError,
  OTP_HOURLY_LIMIT_MESSAGE,
  OTP_RESEND_COOLDOWN_SECONDS,
  startCooldownExpiry,
  hasPendingOtpCode,
} from "../../../shared/auth/otpRateLimit";
import { isValidEmailSyntax, normalizeEmail } from "../../../shared/lib/normalizeEmail";
import { OtpCodeInput } from "../../components/OtpCodeInput";
import { SignInShell } from "../../components/SignInShell";
import { useMockAuth } from "../../hooks/useMockAuth";
import { claimLegacyRegistrationRef, getOtpSendCooldownRef } from "../../convex/api";
import { getConvexClient } from "../../convex/client";
import { useApplicantRouting } from "../../hooks/useApplicantRouting";
import { useSessionAuth } from "../../hooks/useSessionAuth";

const OTP_INVALID_MESSAGE = "The verification code is invalid or expired.";
const OTP_SEND_FAILED_MESSAGE = "We couldn't send a verification code. Please try again later.";

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
  const [cooldownExpiresAt, setCooldownExpiresAt] = useState<number | null>(null);
  const [hourlyLimitReached, setHourlyLimitReached] = useState(false);
  const [cooldownTick, setCooldownTick] = useState(0);
  const [pendingOtpEmail, setPendingOtpEmail] = useState<string | null>(null);
  const [stayOnEmailStep, setStayOnEmailStep] = useState(false);

  const cooldown = cooldownStatusFromExpiry(cooldownExpiresAt, hourlyLimitReached);

  useEffect(() => {
    if (getCooldownWaitSeconds(cooldownExpiresAt) <= 0) return;
    const timer = window.setTimeout(() => setCooldownTick((value) => value + 1), 1000);
    return () => window.clearTimeout(timer);
  }, [cooldownExpiresAt, cooldownTick]);

  const fetchOtpCooldown = useCallback(async (normalized: string) => {
    if (mockAuth.enabled || !client) {
      return { waitSeconds: 0, hourlyLimitReached: false };
    }

    try {
      return await client.query(getOtpSendCooldownRef, { email: normalized });
    } catch {
      return { waitSeconds: 0, hourlyLimitReached: false };
    }
  }, [client, mockAuth.enabled]);

  const syncCooldownFromServer = useCallback(
    (status: Awaited<ReturnType<typeof fetchOtpCooldown>>) => {
      setHourlyLimitReached(status.hourlyLimitReached);
      setCooldownExpiresAt((current) => mergeCooldownExpiry(current, status));
    },
    [],
  );

  const startLocalCooldown = useCallback((waitSeconds: number) => {
    setHourlyLimitReached(false);
    setCooldownExpiresAt(startCooldownExpiry(waitSeconds));
  }, []);

  useEffect(() => {
    if (step !== "email" || mockAuth.enabled) return;

    const normalized = normalizeEmail(email);
    if (!normalized || !isValidEmailSyntax(normalized)) return;

    let cancelled = false;
    const timer = window.setTimeout(() => {
      void fetchOtpCooldown(normalized).then((status) => {
        if (cancelled) return;
        syncCooldownFromServer(status);
        if (hasPendingOtpCode(status) && !stayOnEmailStep && normalized === pendingOtpEmail) {
          setStep("otp");
        }
      });
    }, 300);

    return () => {
      cancelled = true;
      window.clearTimeout(timer);
    };
  }, [
    email,
    fetchOtpCooldown,
    mockAuth.enabled,
    pendingOtpEmail,
    stayOnEmailStep,
    step,
    syncCooldownFromServer,
  ]);

  const routeAfterSignIn = useCallback(async () => {
    if (mockAuth.enabled) {
      navigate(mockAuth.hasSubmittedRegistration ? "/profile" : "/register", { replace: true });
      return;
    }

    if (client) {
      await claimLegacy({}).catch(() => undefined);
    }

    const destination = routing.hasSubmittedRegistration ? "/profile" : "/register";
    navigate(destination, { replace: true });
  }, [claimLegacy, client, mockAuth, navigate, routing.hasSubmittedRegistration]);

  useEffect(() => {
    if (!isLoading && isAuthenticated && !routing.isLoading && routing.isAuthenticated) {
      void routeAfterSignIn();
    }
  }, [isAuthenticated, isLoading, routeAfterSignIn, routing.isAuthenticated, routing.isLoading]);

  const advanceToOtpStep = useCallback((normalized: string) => {
    setPendingOtpEmail(normalized);
    setStayOnEmailStep(false);
    setEmail(normalized);
    setStep("otp");
    setError(null);
  }, []);

  const readOtpSendStatus = useCallback(
    async (normalized: string, retry = true) => {
      let status = await fetchOtpCooldown(normalized);
      if (retry && status.waitSeconds === 0 && !status.hourlyLimitReached) {
        await new Promise((resolve) => window.setTimeout(resolve, 400));
        status = await fetchOtpCooldown(normalized);
      }
      syncCooldownFromServer(status);
      return status;
    },
    [fetchOtpCooldown, syncCooldownFromServer],
  );

  const handleOtpSendFailure = useCallback(
    async (normalized: string, error: unknown) => {
      const status = await readOtpSendStatus(normalized);
      setEmail(normalized);

      if (hasPendingOtpCode(status)) {
        advanceToOtpStep(normalized);
        return;
      }

      if (status.hourlyLimitReached) {
        setError(OTP_HOURLY_LIMIT_MESSAGE);
        return;
      }

      if (error instanceof Error && isOtpRateLimitError(error.message)) {
        advanceToOtpStep(normalized);
        return;
      }

      setError(getOtpSendErrorMessage(error, import.meta.env.DEV) ?? OTP_SEND_FAILED_MESSAGE);
    },
    [advanceToOtpStep, readOtpSendStatus],
  );

  const normalizedEmail = normalizeEmail(email);
  const emailEligibleForCooldown =
    normalizedEmail != null && isValidEmailSyntax(normalizedEmail);
  const emailCooldown = emailEligibleForCooldown
    ? cooldown
    : { waitSeconds: 0, hourlyLimitReached: false };

  if (!isLoading && isAuthenticated && routing.isAuthenticated) {
    return (
      <Navigate
        to={routing.hasSubmittedRegistration ? "/profile" : "/register"}
        replace
      />
    );
  }

  const beginOtpCooldown = async (normalized: string) => {
    const status = await fetchOtpCooldown(normalized);
    setHourlyLimitReached(status.hourlyLimitReached);
    if (status.hourlyLimitReached) return;

    if (status.waitSeconds > 0) {
      setCooldownExpiresAt(startCooldownExpiry(status.waitSeconds));
      return;
    }

    startLocalCooldown(OTP_RESEND_COOLDOWN_SECONDS);
  };

  const sendOtp = async (normalized: string) => {
    if (mockAuth.enabled) {
      mockAuth.requestOtp(normalized);
      advanceToOtpStep(normalized);
      startLocalCooldown(OTP_RESEND_COOLDOWN_SECONDS);
      return;
    }

    await signIn("email", { email: normalized });
    advanceToOtpStep(normalized);
    await beginOtpCooldown(normalized);
  };

  const returnToOtpEntry = () => {
    setStayOnEmailStep(false);
    setStep("otp");
    setError(null);
  };

  const openEmailStep = () => {
    setStayOnEmailStep(true);
    setStep("email");
    setCode("");
    setError(null);
  };

  const handleSendCode = async (event: FormEvent) => {
    event.preventDefault();
    if (pending) return;

    const normalized = normalizeEmail(email);
    if (!normalized || !isValidEmailSyntax(normalized)) {
      setError("Please enter a valid email address.");
      return;
    }

    if (emailCooldown.hourlyLimitReached) return;

    if (emailCooldown.waitSeconds > 0 && normalized === pendingOtpEmail) {
      returnToOtpEntry();
      return;
    }

    setPending(true);
    setError(null);

    const preflight = await fetchOtpCooldown(normalized);
    syncCooldownFromServer(preflight);
    if (hasPendingOtpCode(preflight)) {
      advanceToOtpStep(normalized);
      setPending(false);
      return;
    }
    if (preflight.hourlyLimitReached) {
      setEmail(normalized);
      setError(OTP_HOURLY_LIMIT_MESSAGE);
      setPending(false);
      return;
    }

    try {
      await sendOtp(normalized);
    } catch (error) {
      await handleOtpSendFailure(normalized, error);
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
    if (pending || cooldown.waitSeconds > 0 || cooldown.hourlyLimitReached) return;

    const normalized = normalizeEmail(email);
    if (!normalized) return;

    setPending(true);
    setError(null);

    try {
      await sendOtp(normalized);
    } catch (error) {
      await handleOtpSendFailure(normalized, error);
    } finally {
      setPending(false);
    }
  };

  const canReturnToPendingOtp =
    pendingOtpEmail != null &&
    normalizedEmail === pendingOtpEmail &&
    (emailCooldown.waitSeconds > 0 || emailCooldown.hourlyLimitReached);
  const resendLabel = cooldown.hourlyLimitReached
    ? OTP_HOURLY_LIMIT_MESSAGE
    : formatOtpResendLabel(cooldown.waitSeconds);
  const sendCodeLabel = pending
    ? "Sending…"
    : emailCooldown.hourlyLimitReached
      ? OTP_HOURLY_LIMIT_MESSAGE
      : emailCooldown.waitSeconds > 0
        ? `Send code in ${emailCooldown.waitSeconds}s`
        : "Send code";

  const shellTitle = step === "email" ? "Sign in" : "Check your email";
  const shellSubtitle: ReactNode =
    step === "email" ? (
      "Enter your email to receive a one-time code."
    ) : (
      <>
        We sent a 6-digit code to{" "}
        <span className="sign-in-card__subtitle-email">{email}</span>.
      </>
    );

  return (
    <SignInShell title={shellTitle} subtitle={shellSubtitle}>
      {step === "email" ? (
        <form onSubmit={handleSendCode} noValidate className="sign-in-form">
          <label className="sign-in-field" htmlFor="sign-in-email">
            <span className="sign-in-field__label">Email</span>
            <input
              id="sign-in-email"
              type="email"
              autoComplete="email"
              inputMode="email"
              placeholder="you@example.com"
              required
              value={email}
              onChange={(event) => {
                const nextEmail = event.target.value;
                setEmail(nextEmail);
                setError(null);
                const normalized = normalizeEmail(nextEmail);
                if (pendingOtpEmail && normalized !== pendingOtpEmail) {
                  setPendingOtpEmail(null);
                  setStayOnEmailStep(true);
                  setCooldownExpiresAt(null);
                  setHourlyLimitReached(false);
                }
              }}
              className="sign-in-field__input"
              aria-invalid={!!error}
            />
          </label>

          {error ? (
            <p className="sign-in-message sign-in-message--error" role="alert" aria-live="polite">
              {error}
            </p>
          ) : null}

          <button
            type="submit"
            className="sign-in-btn"
            disabled={pending || emailCooldown.waitSeconds > 0 || emailCooldown.hourlyLimitReached}
          >
            {sendCodeLabel}
          </button>

          {canReturnToPendingOtp ? (
            <button type="button" className="sign-in-link" onClick={returnToOtpEntry}>
              Back to enter code
            </button>
          ) : null}
        </form>
      ) : (
        <form onSubmit={handleVerifyCode} noValidate className="sign-in-form">
          <OtpCodeInput
            value={code}
            onChange={setCode}
            disabled={pending}
            invalid={!!error}
          />

          {error ? (
            <p className="sign-in-message sign-in-message--error" role="alert" aria-live="polite">
              {error}
            </p>
          ) : null}

          <button type="submit" className="sign-in-btn" disabled={pending || code.length !== 6}>
            {pending ? "Verifying…" : "Verify code"}
          </button>

          <div className="sign-in-otp__footer">
            <button
              type="button"
              className="sign-in-resend"
              disabled={pending || cooldown.waitSeconds > 0 || cooldown.hourlyLimitReached}
              onClick={() => void handleResend()}
            >
              {resendLabel}
            </button>
            <button type="button" className="sign-in-link" onClick={openEmailStep}>
              Use a different email
            </button>
          </div>
        </form>
      )}
    </SignInShell>
  );
}
