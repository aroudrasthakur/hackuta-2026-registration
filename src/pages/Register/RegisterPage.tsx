import { useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import { Logo } from "../../components/art/Logo";
import { Ship } from "../../components/art/Ship";
import { LANDING_URL } from "../../constants/site";
import { ApplicationForm } from "./ApplicationForm";
import { SuccessStep } from "./SuccessStep";

export type RegisterStep = "application" | "success";

export default function RegisterPage() {
  const navigate = useNavigate();
  const [step, setStep] = useState<RegisterStep>("application");

  return (
    <main className="register-page relative min-h-screen overflow-hidden bg-(--clay)">
      {/* Decorative background elements */}
      <div
        className="pointer-events-none absolute inset-0 overflow-hidden"
        aria-hidden="true"
      >
        {/* Greek key pattern border at top */}
        <div className="absolute left-0 right-0 top-0 h-2 bg-[repeating-linear-gradient(90deg,var(--ink)_0,var(--ink)_12px,transparent_12px,transparent_24px,var(--ink)_24px,var(--ink)_36px,transparent_36px,transparent_40px)] opacity-20" />

        {/* Subtle wave pattern */}
        <svg
          className="absolute bottom-0 left-0 w-full opacity-5"
          viewBox="0 0 1200 120"
          preserveAspectRatio="none"
        >
          <path
            d="M0,60 Q300,20 600,60 T1200,60 L1200,120 L0,120 Z"
            fill="var(--ink)"
          />
        </svg>

        {/* Decorative ship in bottom right */}
        <div className="absolute bottom-8 right-8 w-32 opacity-10 md:w-40">
          <Ship tone="ink" rowing={false} />
        </div>
      </div>

      {/* Main content */}
      <div className="relative z-10 mx-auto flex min-h-screen w-full max-w-3xl flex-col items-center px-6 py-12 sm:py-16">
        {/* Logo header */}
        <div className="mb-10 flex flex-col items-center gap-4">
          <a
            href={LANDING_URL}
            aria-label="HackUTA home"
            className="inline-flex transition-opacity hover:opacity-80"
          >
            <Logo
              className="h-14 w-auto sm:h-16"
              variant="light"
              layout="header"
              decorative
            />
          </a>

          {step === "application" && (
            <div className="text-center">
              <h1 className="font-(family-name:--font-display) text-2xl text-(--ink) sm:text-3xl">
                Join the Odyssey
              </h1>
              <p className="mt-2 text-sm text-(--ocean)">
                Register for HackUTA 2026
              </p>
            </div>
          )}
        </div>

        {/* Form card with pottery-inspired design */}
        <div className="relative w-full">
          {/* Decorative corner accents */}
          <div
            className="absolute -left-2 -top-2 h-8 w-8 border-l-2 border-t-2 border-(--ink)/20"
            aria-hidden="true"
          />
          <div
            className="absolute -right-2 -top-2 h-8 w-8 border-r-2 border-t-2 border-(--ink)/20"
            aria-hidden="true"
          />
          <div
            className="absolute -bottom-2 -left-2 h-8 w-8 border-b-2 border-l-2 border-(--ink)/20"
            aria-hidden="true"
          />
          <div
            className="absolute -bottom-2 -right-2 h-8 w-8 border-b-2 border-r-2 border-(--ink)/20"
            aria-hidden="true"
          />

          {/* Main card */}
          <div className="relative overflow-hidden rounded-2xl border-2 border-(--sand) bg-(--light) p-8 shadow-[0_10px_40px_rgba(26,58,82,0.12)] sm:p-12">
            {/* Subtle texture overlay */}
            <div
              className="pointer-events-none absolute inset-0 bg-[radial-gradient(circle_at_50%_120%,rgba(26,58,82,0.02),transparent_60%)]"
              aria-hidden="true"
            />

            <div className="relative z-10">
              {step === "application" ? (
                <ApplicationForm
                  onSubmitted={() => {
                    setStep("success");
                    window.setTimeout(() => navigate("/profile", { replace: true }), 1500);
                  }}
                />
              ) : (
                <SuccessStep />
              )}
            </div>
          </div>
        </div>

        {/* Footer info */}
        <p className="mt-8 text-center text-xs text-(--mist)">
          Questions?{" "}
          <Link
            to="/contact"
            className="text-(--ocean) underline decoration-1 underline-offset-2 transition-colors hover:text-(--ink)"
          >
            Contact us
          </Link>
        </p>
      </div>
    </main>
  );
}
