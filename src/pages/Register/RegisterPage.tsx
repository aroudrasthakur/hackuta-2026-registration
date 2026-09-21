import { useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import { PageShell } from "../../components/PageShell";
import { StormPageFrame } from "../../components/StormPageFrame";
import { ApplicationForm } from "./ApplicationForm";
import { SuccessStep } from "./SuccessStep";

export type RegisterStep = "application" | "success";

export default function RegisterPage() {
  const navigate = useNavigate();
  const [step, setStep] = useState<RegisterStep>("application");

  return (
    <StormPageFrame>
      <PageShell
        frameless
        {...(step === "application"
          ? {
              title: "Join the Odyssey",
              subtitle: "Register for HackUTA 2026",
            }
          : {})}
        footer={
          <p className="mt-8 text-center text-xs text-(--mist)">
            Questions?{" "}
            <Link
              to="/contact"
              className="text-(--ocean) underline decoration-1 underline-offset-2 transition-colors hover:text-(--ink)"
            >
              Contact us
            </Link>
          </p>
        }
      >
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
      </PageShell>
    </StormPageFrame>
  );
}
