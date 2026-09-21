import { useMutation } from "convex/react";

import { useCallback, useEffect, useState, type FormEvent, type ReactNode } from "react";

import { Navigate, useNavigate } from "react-router-dom";

import {

  getOtpSendErrorMessage,

  OTP_RESEND_COOLDOWN_SECONDS,

} from "../../../shared/auth/otpRateLimit";

import { isValidEmailSyntax, normalizeEmail } from "../../../shared/lib/normalizeEmail";

import { OtpCodeInput } from "../../components/OtpCodeInput";

import { SignInShell } from "../../components/SignInShell";

import { useMockAuth } from "../../hooks/useMockAuth";

import { claimLegacyRegistrationRef } from "../../convex/api";

import { getConvexClient } from "../../convex/client";

import { useApplicantRouting } from "../../hooks/useApplicantRouting";

import { useSessionAuth } from "../../hooks/useSessionAuth";



const OTP_INVALID_MESSAGE = "The verification code is invalid or expired.";



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



  if (!isLoading && isAuthenticated && routing.isAuthenticated) {

    return (

      <Navigate

        to={routing.hasSubmittedRegistration ? "/profile" : "/register"}

        replace

      />

    );

  }



  const sendOtp = async (normalized: string) => {

    if (mockAuth.enabled) {

      mockAuth.requestOtp(normalized);

      setEmail(normalized);

      setStep("otp");

      setResendSeconds(OTP_RESEND_COOLDOWN_SECONDS);

      return;

    }



    await signIn("email", { email: normalized });

    setEmail(normalized);

    setStep("otp");

    setResendSeconds(OTP_RESEND_COOLDOWN_SECONDS);

  };



  const handleSendCode = async (event: FormEvent) => {

    event.preventDefault();

    if (pending) return;



    const normalized = normalizeEmail(email);

    if (!normalized || !isValidEmailSyntax(normalized)) {

      setError("Please enter a valid email address.");

      return;

    }



    setPending(true);

    setError(null);



    try {

      await sendOtp(normalized);

    } catch (sendError) {

      const rateLimitMessage = getOtpSendErrorMessage(sendError, import.meta.env.DEV);

      if (rateLimitMessage) {

        setError(rateLimitMessage);

        return;

      }

      setEmail(normalized);

      setStep("otp");

      setResendSeconds(OTP_RESEND_COOLDOWN_SECONDS);

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

      await sendOtp(normalized);

    } catch (sendError) {

      const rateLimitMessage = getOtpSendErrorMessage(sendError, import.meta.env.DEV);

      setError(rateLimitMessage ?? "Could not resend the code. Please try again later.");

    } finally {

      setPending(false);

    }

  };



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

              onChange={(event) => setEmail(event.target.value)}

              className="sign-in-field__input"

              aria-invalid={!!error}

            />

          </label>



          {error ? (

            <p className="sign-in-message sign-in-message--error" role="alert">

              {error}

            </p>

          ) : null}



          <button type="submit" className="sign-in-btn" disabled={pending}>

            {pending ? "Sending…" : "Send code"}

          </button>

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

            <p className="sign-in-message sign-in-message--error" role="alert">

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

              disabled={pending || resendSeconds > 0}

              onClick={() => void handleResend()}

            >

              {resendSeconds > 0 ? `Resend code in ${resendSeconds}s` : "Resend code"}

            </button>

            <button

              type="button"

              className="sign-in-link"

              onClick={() => {

                setStep("email");

                setCode("");

                setError(null);

                setResendSeconds(0);

              }}

            >

              Use a different email

            </button>

          </div>

        </form>

      )}

    </SignInShell>

  );

}

