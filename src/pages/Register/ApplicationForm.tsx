import { useCallback, useEffect, useRef, useState, type FormEvent } from "react";
import { useAuthToken } from "@convex-dev/auth/react";
import { OdysseyButton } from "../../components/OdysseyButton";
import {
  DIETARY_OPTIONS,
  FIELD_LIMITS,
  GENDERS,
  HEAR_ABOUT_OPTIONS,
  LEVELS_OF_STUDY,
  MAX_GRADUATION_YEAR,
  MIN_GRADUATION_YEAR,
  MLH_CODE_OF_CONDUCT_URL,
  MLH_PRIVACY_POLICY_URL,
  RACE_ETHNICITY_OPTIONS,
  TSHIRT_SIZES,
} from "./constants";
import {
  FieldError,
  SelectField,
  TextField,
} from "./components/FormFields";
import {
  fieldClass,
  fieldsetErrorClass,
  inputClass,
  labelClass,
  legendClass,
} from "./components/formFieldStyles";
import {
  discardResumeUpload,
  submitRegistration,
  uploadResume,
  type ResumeUploadSession,
} from "./registerApi";
import type { ApplicationFormData, FieldName } from "../../../shared/registration/types";
import { INITIAL_FORM } from "../../../shared/registration/types";
import { resumeFileKey, validateResume } from "../../../shared/registration/resume";
import {
  focusFirstInvalidField,
  toggleValue,
  validateApplicationForm,
  type FieldErrors,
} from "../../../shared/registration/validation";

const checkboxRowClass = "flex items-center gap-2 text-(--color-light)";
const fieldsetClass = "flex flex-col gap-2 text-sm";

export function ApplicationForm({
  onSubmitted,
}: {
  onSubmitted: () => void;
}) {
  const [form, setForm] = useState<ApplicationFormData>(INITIAL_FORM);
  const [errors, setErrors] = useState<FieldErrors>({});
  const [submitError, setSubmitError] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);
  const convexAuthToken = useAuthToken();
  const authToken = import.meta.env.VITE_USE_MOCK_API === "true"
    ? "test-token"
    : convexAuthToken;
  const [resumeUpload, setResumeUpload] = useState<{
    fileKey: string;
    session: ResumeUploadSession;
  } | null>(null);
  const resumeInput = useRef<HTMLInputElement>(null);
  const resumeUploadRef = useRef(resumeUpload);

  useEffect(() => {
    resumeUploadRef.current = resumeUpload;
  }, [resumeUpload]);

  const discardPendingResume = useCallback(async () => {
    const pending = resumeUploadRef.current;
    if (!pending) return;
    setResumeUpload(null);
    await discardResumeUpload(pending.session.uploadToken);
  }, []);

  useEffect(() => {
    const cleanupPendingUpload = () => {
      const pending = resumeUploadRef.current;
      if (!pending) return;
      void discardResumeUpload(pending.session.uploadToken);
    };
    window.addEventListener("beforeunload", cleanupPendingUpload);
    return () => {
      window.removeEventListener("beforeunload", cleanupPendingUpload);
      void discardPendingResume();
    };
  }, [discardPendingResume]);

  const updateField = useCallback(
    <K extends keyof ApplicationFormData>(key: K, value: ApplicationFormData[K]) => {
      setForm((prev) => ({ ...prev, [key]: value }));
      setErrors((prev) => {
        if (!prev[key as FieldName]) return prev;
        const next = { ...prev };
        delete next[key as FieldName];
        return next;
      });
    },
    [],
  );

  const handleSubmit = async (event: FormEvent) => {
    event.preventDefault();
    if (submitting) return;

    setSubmitError(null);

    const validation = validateApplicationForm(form);

    if (!validation.success) {
      setErrors(validation.errors);
      focusFirstInvalidField(validation.errors);
      return;
    }

    setErrors({});

    setSubmitting(true);
    try {
      let session: ResumeUploadSession | null = null;
      if (form.resume) {
        const fileKey = resumeFileKey(form.resume);
        if (resumeUpload?.fileKey === fileKey) {
          session = resumeUpload.session;
        } else {
          await discardPendingResume();
          session = await uploadResume(form.resume);
          setResumeUpload({ fileKey, session });
        }
      } else {
        await discardPendingResume();
      }

      await submitRegistration(validation.payload, authToken, session);
      setResumeUpload(null);
      onSubmitted();
    } catch (err) {
      console.error("Registration submission failed", err);
      setSubmitError("We couldn't submit your application. Please try again.");
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <form onSubmit={handleSubmit} noValidate className="flex flex-col gap-6">
      <div>
        <h1 className="font-(family-name:--font-display) text-3xl text-(--color-light)">
          Tell us about yourself
        </h1>
        <p className="mt-2 text-sm text-(--color-mist)">
          Fields marked <span aria-hidden="true">*</span> are required. Your application will be
          saved when submitted.
        </p>
      </div>

      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
        <TextField
          id="firstName"
          label="First name"
          required
          value={form.firstName}
          onChange={(e) => updateField("firstName", e.target.value)}
          autoComplete="given-name"
          maxLength={FIELD_LIMITS.name}
          error={errors.firstName}
        />
        <TextField
          id="lastName"
          label="Last name"
          required
          value={form.lastName}
          onChange={(e) => updateField("lastName", e.target.value)}
          autoComplete="family-name"
          maxLength={FIELD_LIMITS.name}
          error={errors.lastName}
        />
        <TextField
          id="phone"
          label="Phone number"
          required
          type="tel"
          inputMode="tel"
          value={form.phone}
          onChange={(e) => updateField("phone", e.target.value)}
          autoComplete="tel"
          maxLength={FIELD_LIMITS.phone}
          error={errors.phone}
        />
        <TextField
          id="age"
          label="Age"
          required
          type="number"
          inputMode="numeric"
          min={18}
          max={120}
          step={1}
          value={form.age}
          onChange={(e) => updateField("age", e.target.value)}
          autoComplete="off"
          error={errors.age}
        />
        <TextField
          id="school"
          label="School / university"
          required
          value={form.school}
          onChange={(e) => updateField("school", e.target.value)}
          autoComplete="organization"
          maxLength={FIELD_LIMITS.school}
          error={errors.school}
        />
        <SelectField
          id="levelOfStudy"
          label="Level of study"
          required
          value={form.levelOfStudy}
          onChange={(e) =>
            updateField("levelOfStudy", e.target.value as ApplicationFormData["levelOfStudy"])
          }
          error={errors.levelOfStudy}
        >
          {LEVELS_OF_STUDY.map((option) => (
            <option key={option} value={option}>
              {option}
            </option>
          ))}
        </SelectField>
        <TextField
          id="major"
          label="Major / field of study"
          required
          value={form.major}
          onChange={(e) => updateField("major", e.target.value)}
          maxLength={FIELD_LIMITS.major}
          error={errors.major}
        />
        <TextField
          id="graduationYear"
          label="Expected graduation year"
          required
          type="number"
          inputMode="numeric"
          min={MIN_GRADUATION_YEAR}
          max={MAX_GRADUATION_YEAR}
          step={1}
          value={form.graduationYear}
          onChange={(e) => updateField("graduationYear", e.target.value)}
          autoComplete="off"
          error={errors.graduationYear}
        />
      </div>

      <SelectField
        id="gender"
        label="Gender"
        required
        value={form.gender}
        onChange={(e) => updateField("gender", e.target.value as ApplicationFormData["gender"])}
        error={errors.gender}
      >
        {GENDERS.map((option) => (
          <option key={option} value={option}>
            {option}
          </option>
        ))}
      </SelectField>

      <fieldset className={fieldsetClass}>
        <legend className={legendClass}>Race / ethnicity (select all that apply)</legend>
        <div className="grid grid-cols-1 gap-2 sm:grid-cols-2">
          {RACE_ETHNICITY_OPTIONS.map((option) => (
            <label key={option} className={checkboxRowClass}>
              <input
                type="checkbox"
                checked={form.raceEthnicity.includes(option)}
                onChange={() =>
                  updateField("raceEthnicity", toggleValue(form.raceEthnicity, option))
                }
              />
              {option}
            </label>
          ))}
        </div>
      </fieldset>

      <fieldset className={`${fieldsetClass} ${fieldsetErrorClass(!!errors.otherDietary)}`}>
        <legend className={legendClass}>Dietary restrictions (select all that apply)</legend>
        <div className="grid grid-cols-1 gap-2 sm:grid-cols-2">
          {DIETARY_OPTIONS.map((option) => (
            <label key={option} className={checkboxRowClass}>
              <input
                type="checkbox"
                checked={form.dietaryRestrictions.includes(option)}
                onChange={() =>
                  updateField("dietaryRestrictions", toggleValue(form.dietaryRestrictions, option))
                }
              />
              {option}
            </label>
          ))}
        </div>
        {form.dietaryRestrictions.includes("Other") && (
          <>
            <input
              id="otherDietary"
              value={form.otherDietary}
              onChange={(e) => updateField("otherDietary", e.target.value)}
              placeholder="Tell us more"
              aria-invalid={!!errors.otherDietary}
              aria-describedby={errors.otherDietary ? "otherDietary-error" : undefined}
              maxLength={FIELD_LIMITS.otherDietary}
              className={fieldClass(errors.otherDietary)}
            />
            <FieldError id="otherDietary-error" message={errors.otherDietary} />
          </>
        )}
      </fieldset>

      <SelectField
        id="tshirtSize"
        label="T-shirt size"
        required
        value={form.tshirtSize}
        onChange={(e) =>
          updateField("tshirtSize", e.target.value as ApplicationFormData["tshirtSize"])
        }
        error={errors.tshirtSize}
      >
        {TSHIRT_SIZES.map((option) => (
          <option key={option} value={option}>
            {option}
          </option>
        ))}
      </SelectField>

      <fieldset
        className={`${fieldsetClass} ${fieldsetErrorClass(!!errors.firstHackathon)}`}
        aria-describedby={errors.firstHackathon ? "firstHackathon-error" : undefined}
      >
        <legend className={legendClass}>
          Is this your first hackathon?
          <span aria-hidden="true"> *</span>
        </legend>
        <div className="flex gap-4">
          <label className={checkboxRowClass}>
            <input
              id="firstHackathon-yes"
              type="radio"
              name="firstHackathon"
              checked={form.firstHackathon === true}
              onChange={() => updateField("firstHackathon", true)}
            />
            Yes
          </label>
          <label className={checkboxRowClass}>
            <input
              id="firstHackathon-no"
              type="radio"
              name="firstHackathon"
              checked={form.firstHackathon === false}
              onChange={() => updateField("firstHackathon", false)}
            />
            No
          </label>
        </div>
        <FieldError id="firstHackathon-error" message={errors.firstHackathon} />
      </fieldset>

      <SelectField
        id="hearAbout"
        label="How did you hear about HackUTA?"
        required
        value={form.hearAbout}
        onChange={(e) =>
          updateField("hearAbout", e.target.value as ApplicationFormData["hearAbout"])
        }
        error={errors.hearAbout}
      >
        {HEAR_ABOUT_OPTIONS.map((option) => (
          <option key={option} value={option}>
            {option}
          </option>
        ))}
      </SelectField>

      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
        <div className={labelClass}>
          <label htmlFor="resume" className={legendClass}>Resume (optional)</label>
          <input
            ref={resumeInput}
            id="resume"
            type="file"
            accept=".pdf,application/pdf"
            disabled={submitting}
            className={`${fieldClass(errors.resume)} min-w-0 w-full`}
            aria-invalid={!!errors.resume}
            aria-describedby={`resume-help${errors.resume ? " resume-error" : ""}`}
            onChange={(event) => {
              void (async () => {
                const file = event.target.files?.[0] ?? null;
                await discardPendingResume();
                updateField("resume", file);
                const error = file ? validateResume(file) : undefined;
                setErrors((prev) => {
                  const next = { ...prev };
                  if (error) next.resume = error;
                  else delete next.resume;
                  return next;
                });
              })();
            }}
          />
          <p id="resume-help" className="text-xs text-(--color-mist)">PDF only, up to 5 MB. Uploaded when you submit.</p>
          <FieldError id="resume-error" message={errors.resume} />
          {form.resume && (
            <button type="button" disabled={submitting} className="self-start underline underline-offset-4" onClick={() => {
              void (async () => {
                await discardPendingResume();
                updateField("resume", null);
                if (resumeInput.current) resumeInput.current.value = "";
              })();
            }}>Remove resume</button>
          )}
        </div>
        <TextField
          id="linkedin"
          label="LinkedIn (optional)"
          type="url"
          value={form.linkedin}
          onChange={(e) => updateField("linkedin", e.target.value)}
          placeholder="https://"
          autoCapitalize="none"
          spellCheck={false}
          maxLength={FIELD_LIMITS.url}
          error={errors.linkedin}
        />
        <TextField
          id="github"
          label="GitHub (optional)"
          type="url"
          value={form.github}
          onChange={(e) => updateField("github", e.target.value)}
          placeholder="https://"
          autoCapitalize="none"
          spellCheck={false}
          maxLength={FIELD_LIMITS.url}
          error={errors.github}
        />
        <TextField
          id="portfolio"
          label="Portfolio (optional)"
          type="url"
          value={form.portfolio}
          onChange={(e) => updateField("portfolio", e.target.value)}
          placeholder="https://"
          autoCapitalize="none"
          spellCheck={false}
          maxLength={FIELD_LIMITS.url}
          error={errors.portfolio}
        />
      </div>

      <label className={labelClass}>
        <span className={legendClass}>Accessibility needs or accommodations (optional)</span>
        <textarea
          value={form.accessibilityNeeds}
          onChange={(e) => updateField("accessibilityNeeds", e.target.value)}
          rows={2}
          maxLength={FIELD_LIMITS.accessibilityNeeds}
          className={inputClass}
        />
      </label>

      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
        <TextField
          id="emergencyContactName"
          label="Emergency contact name"
          required
          value={form.emergencyContactName}
          onChange={(e) => updateField("emergencyContactName", e.target.value)}
          maxLength={FIELD_LIMITS.name}
          error={errors.emergencyContactName}
        />
        <TextField
          id="emergencyContactPhone"
          label="Emergency contact phone"
          required
          type="tel"
          inputMode="tel"
          value={form.emergencyContactPhone}
          onChange={(e) => updateField("emergencyContactPhone", e.target.value)}
          maxLength={FIELD_LIMITS.phone}
          error={errors.emergencyContactPhone}
        />
      </div>

      <div
        className={`flex flex-col gap-3 rounded-xl border p-4 text-sm ${
          errors.codeOfConductAgreed || errors.mlhDataSharingConsent
            ? "border-red-400"
            : "border-(--color-ocean)/40"
        }`}
      >
        <div className="flex flex-col gap-1">
          <label className={checkboxRowClass} htmlFor="codeOfConductAgreed">
            <input
              id="codeOfConductAgreed"
              type="checkbox"
              required
              checked={form.codeOfConductAgreed}
              onChange={(e) => updateField("codeOfConductAgreed", e.target.checked)}
              aria-invalid={!!errors.codeOfConductAgreed}
              aria-describedby={errors.codeOfConductAgreed ? "codeOfConductAgreed-error" : undefined}
            />
            I have read and agree to the{" "}
            <a
              href={MLH_CODE_OF_CONDUCT_URL}
              target="_blank"
              rel="noopener noreferrer"
              className="underline underline-offset-4"
            >
              MLH Code of Conduct
            </a>
            .
          </label>
          <FieldError id="codeOfConductAgreed-error" message={errors.codeOfConductAgreed} />
        </div>
        <div className="flex flex-col gap-1">
          <label className={checkboxRowClass} htmlFor="mlhDataSharingConsent">
            <input
              id="mlhDataSharingConsent"
              type="checkbox"
              required
              checked={form.mlhDataSharingConsent}
              onChange={(e) => updateField("mlhDataSharingConsent", e.target.checked)}
              aria-invalid={!!errors.mlhDataSharingConsent}
              aria-describedby={
                errors.mlhDataSharingConsent ? "mlhDataSharingConsent-error" : undefined
              }
            />
            I authorize HackUTA to share my registration information with Major League Hacking for
            event administration, ranking, and MLH administration in-line with the{" "}
            <a
              href={MLH_PRIVACY_POLICY_URL}
              target="_blank"
              rel="noopener noreferrer"
              className="underline underline-offset-4"
            >
              MLH Privacy Policy
            </a>
            .
          </label>
          <FieldError id="mlhDataSharingConsent-error" message={errors.mlhDataSharingConsent} />
        </div>
        <label className={checkboxRowClass}>
          <input
            type="checkbox"
            checked={form.mlhCommunicationsConsent}
            onChange={(e) => updateField("mlhCommunicationsConsent", e.target.checked)}
          />
          I authorize MLH to send me occasional emails about relevant events, career opportunities,
          and community announcements (optional).
        </label>
      </div>

      {Object.keys(errors).length > 0 && (
        <p role="alert" className="text-sm text-red-300">
          One or more of your answers is invalid. Please review the fields below.
        </p>
      )}

      {submitError && (
        <p role="alert" className="text-sm text-red-300">
          {submitError}
        </p>
      )}

      <OdysseyButton type="submit" disabled={submitting}>
        {submitting ? "Submitting…" : "Submit application"}
      </OdysseyButton>
    </form>
  );
}
