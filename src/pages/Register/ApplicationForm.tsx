import {
  useCallback,
  useEffect,
  useRef,
  useState,
  type FormEvent,
} from "react";
import { useSessionAuth } from "../../hooks/useSessionAuth";
import { OdysseyButton } from "../../components/OdysseyButton";
import { useApplicantRouting } from "../../hooks/useApplicantRouting";
import {
  inputClass,
  labelClass,
  legendClass,
} from "./components/formFieldStyles";
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
import { FieldError, SelectField, TextField } from "./components/FormFields";
import { CustomCheckbox, CustomRadio } from "./components/CustomCheckbox";
import { ResumeUpload } from "./components/ResumeUpload";
import { fieldClass, fieldsetErrorClass } from "./components/formFieldStyles";
import {
  discardResumeUpload,
  submitRegistration,
  uploadResume,
  type ResumeUploadSession,
} from "./registerApi";
import type {
  ApplicationFormData,
  FieldName,
} from "../../../shared/registration/types";
import { INITIAL_FORM } from "../../../shared/registration/types";
import { resumeFileKey } from "../../../shared/registration/resume";
import {
  isResumeFieldMessage,
  mapConvexErrorToUserMessage,
  SIGN_IN_REQUIRED_MESSAGE,
} from "../../../shared/registration/submitErrors";
import {
  focusFirstInvalidField,
  toggleValue,
  validateApplicationForm,
  type FieldErrors,
} from "../../../shared/registration/validation";

const fieldsetClass = "flex flex-col gap-4 text-sm";

export function ApplicationForm({ onSubmitted }: { onSubmitted: () => void }) {
  const [form, setForm] = useState<ApplicationFormData>(INITIAL_FORM);
  const [errors, setErrors] = useState<FieldErrors>({});
  const [submitError, setSubmitError] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);
  const { isAuthenticated } = useSessionAuth();
  const routing = useApplicantRouting();
  const [resumeUpload, setResumeUpload] = useState<{
    fileKey: string;
    session: ResumeUploadSession;
  } | null>(null);
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
    <K extends keyof ApplicationFormData>(
      key: K,
      value: ApplicationFormData[K],
    ) => {
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
    if (!isAuthenticated && !routing.isAuthenticated) {
      setSubmitError(SIGN_IN_REQUIRED_MESSAGE);
      return;
    }

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
          try {
            session = await uploadResume(form.resume);
            setResumeUpload({ fileKey, session });
          } catch (err) {
            const message = mapConvexErrorToUserMessage(err);
            setErrors((prev) => ({ ...prev, resume: message }));
            focusFirstInvalidField({ resume: message });
            return;
          }
        }
      } else {
        await discardPendingResume();
      }

      await submitRegistration(validation.payload, session);
      setResumeUpload(null);
      onSubmitted();
    } catch (err) {
      console.error("Registration submission failed", err);
      const message = mapConvexErrorToUserMessage(err);
      if (isResumeFieldMessage(message)) {
        setErrors((prev) => ({ ...prev, resume: message }));
        focusFirstInvalidField({ resume: message });
      } else {
        setSubmitError(message);
      }
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <form onSubmit={handleSubmit} noValidate className="flex flex-col gap-8">
      {routing.verifiedEmail ? (
        <div className="rounded-lg border-2 border-(--sand) bg-white px-4 py-3">
          <p className={legendClass}>Verified email</p>
          <p
            className={`${inputClass} mt-1 border-0 bg-transparent px-0 py-0 text-(--ink)`}
          >
            {routing.verifiedEmail}
          </p>
        </div>
      ) : null}

      {/* Header */}
      <div className="border-b-2 border-(--sand) pb-6">
        <h2 className="font-(family-name:--font-display) text-2xl text-(--ink)">
          Tell us about yourself
        </h2>
        <p className="mt-3 text-sm leading-relaxed text-(--ocean)">
          Fields marked with{" "}
          <span className="font-semibold" aria-hidden="true">
            *
          </span>{" "}
          are required. Your application will be saved when submitted.
        </p>
      </div>

      {/* Personal Information Section */}
      <section className="space-y-6">
        <h3 className="flex items-center gap-2 text-base font-semibold text-(--ocean)">
          <span
            className="inline-block h-1 w-8 bg-(--ocean)"
            aria-hidden="true"
          ></span>
          Personal Information
        </h3>

        <div className="grid grid-cols-1 gap-5 sm:grid-cols-2">
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
              updateField(
                "levelOfStudy",
                e.target.value as ApplicationFormData["levelOfStudy"],
              )
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
      </section>

      {/* Demographics Section */}
      <section className="space-y-6">
        <h3 className="flex items-center gap-2 text-base font-semibold text-(--ocean)">
          <span
            className="inline-block h-1 w-8 bg-(--ocean)"
            aria-hidden="true"
          ></span>
          Demographics
        </h3>

        <SelectField
          id="gender"
          label="Gender"
          required
          value={form.gender}
          onChange={(e) =>
            updateField(
              "gender",
              e.target.value as ApplicationFormData["gender"],
            )
          }
          error={errors.gender}
        >
          {GENDERS.map((option) => (
            <option key={option} value={option}>
              {option}
            </option>
          ))}
        </SelectField>

        <fieldset className={fieldsetClass}>
          <legend className={legendClass}>
            Race / ethnicity (select all that apply)
          </legend>
          <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
            {RACE_ETHNICITY_OPTIONS.map((option) => (
              <CustomCheckbox
                key={option}
                id={`race-${option.replace(/\s+/g, "-").toLowerCase()}`}
                label={option}
                checked={form.raceEthnicity.includes(option)}
                onChange={() =>
                  updateField(
                    "raceEthnicity",
                    toggleValue(form.raceEthnicity, option),
                  )
                }
              />
            ))}
          </div>
        </fieldset>
      </section>

      {/* Event Preferences Section */}
      <section className="space-y-6">
        <h3 className="flex items-center gap-2 text-base font-semibold text-(--ocean)">
          <span
            className="inline-block h-1 w-8 bg-(--ocean)"
            aria-hidden="true"
          ></span>
          Event Preferences
        </h3>

        <fieldset
          className={`${fieldsetClass} ${fieldsetErrorClass(!!errors.otherDietary)}`}
        >
          <legend className={legendClass}>
            Dietary restrictions (select all that apply)
          </legend>
          <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
            {DIETARY_OPTIONS.map((option) => (
              <CustomCheckbox
                key={option}
                id={`dietary-${option.replace(/\s+/g, "-").toLowerCase()}`}
                label={option}
                checked={form.dietaryRestrictions.includes(option)}
                onChange={() =>
                  updateField(
                    "dietaryRestrictions",
                    toggleValue(form.dietaryRestrictions, option),
                  )
                }
              />
            ))}
          </div>
          {form.dietaryRestrictions.includes("Other") && (
            <>
              <input
                id="otherDietary"
                value={form.otherDietary}
                onChange={(e) => updateField("otherDietary", e.target.value)}
                placeholder="Please specify your dietary restrictions"
                aria-invalid={!!errors.otherDietary}
                aria-describedby={
                  errors.otherDietary ? "otherDietary-error" : undefined
                }
                maxLength={FIELD_LIMITS.otherDietary}
                className={fieldClass(errors.otherDietary)}
              />
              <FieldError
                id="otherDietary-error"
                message={errors.otherDietary}
              />
            </>
          )}
        </fieldset>

        <SelectField
          id="tshirtSize"
          label="T-shirt size"
          required
          value={form.tshirtSize}
          onChange={(e) =>
            updateField(
              "tshirtSize",
              e.target.value as ApplicationFormData["tshirtSize"],
            )
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
          aria-describedby={
            errors.firstHackathon ? "firstHackathon-error" : undefined
          }
        >
          <legend className={legendClass}>
            Is this your first hackathon?
            <span aria-hidden="true"> *</span>
          </legend>
          <div className="flex gap-6">
            <CustomRadio
              id="firstHackathon-yes"
              name="firstHackathon"
              label="Yes"
              checked={form.firstHackathon === true}
              onChange={() => updateField("firstHackathon", true)}
            />
            <CustomRadio
              id="firstHackathon-no"
              name="firstHackathon"
              label="No"
              checked={form.firstHackathon === false}
              onChange={() => updateField("firstHackathon", false)}
            />
          </div>
          <FieldError
            id="firstHackathon-error"
            message={errors.firstHackathon}
          />
        </fieldset>
      </section>

      {/* Additional Information Section */}
      <section className="space-y-6">
        <h3 className="flex items-center gap-2 text-base font-semibold text-(--ocean)">
          <span
            className="inline-block h-1 w-8 bg-(--ocean)"
            aria-hidden="true"
          ></span>
          Additional Information
        </h3>

        <div className="space-y-5">
          <SelectField
            id="hearAbout"
            label="How did you hear about HackUTA?"
            required
            value={form.hearAbout}
            onChange={(e) =>
              updateField(
                "hearAbout",
                e.target.value as ApplicationFormData["hearAbout"],
              )
            }
            error={errors.hearAbout}
          >
            {HEAR_ABOUT_OPTIONS.map((option) => (
              <option key={option} value={option}>
                {option}
              </option>
            ))}
          </SelectField>

          <div className="grid grid-cols-1 gap-5 sm:grid-cols-2">
            <div className="sm:col-span-2">
              <ResumeUpload
                file={form.resume}
                error={errors.resume}
                disabled={submitting}
                onChange={(file) => {
                  void (async () => {
                    await discardPendingResume();
                    updateField("resume", file);
                    if (!file) {
                      setErrors((prev) => {
                        const next = { ...prev };
                        delete next.resume;
                        return next;
                      });
                    }
                  })();
                }}
                onError={(error) => {
                  setErrors((prev) => {
                    const next = { ...prev };
                    if (error) next.resume = error;
                    else delete next.resume;
                    return next;
                  });
                }}
              />
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
            <span className={legendClass}>
              Accessibility needs or accommodations (optional)
            </span>
            <textarea
              value={form.accessibilityNeeds}
              onChange={(e) =>
                updateField("accessibilityNeeds", e.target.value)
              }
              rows={3}
              maxLength={FIELD_LIMITS.accessibilityNeeds}
              className={inputClass}
            />
          </label>
        </div>
      </section>

      {/* Emergency Contact Section */}
      <section className="space-y-6">
        <h3 className="flex items-center gap-2 text-base font-semibold text-(--ocean)">
          <span
            className="inline-block h-1 w-8 bg-(--ocean)"
            aria-hidden="true"
          ></span>
          Emergency Contact
        </h3>

        <div className="grid grid-cols-1 gap-5 sm:grid-cols-2">
          <TextField
            id="emergencyContactName"
            label="Emergency contact name"
            required
            value={form.emergencyContactName}
            onChange={(e) =>
              updateField("emergencyContactName", e.target.value)
            }
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
            onChange={(e) =>
              updateField("emergencyContactPhone", e.target.value)
            }
            maxLength={FIELD_LIMITS.phone}
            error={errors.emergencyContactPhone}
          />
        </div>
      </section>

      {/* Agreements Section */}
      <section className="space-y-4">
        <h3 className="flex items-center gap-2 text-base font-semibold text-(--ocean)">
          <span
            className="inline-block h-1 w-8 bg-(--ocean)"
            aria-hidden="true"
          ></span>
          Required Agreements
        </h3>

        <div
          className={`flex flex-col gap-4 rounded-xl border-2 bg-white p-5 text-sm ${
            errors.codeOfConductAgreed || errors.mlhDataSharingConsent
              ? "border-red-400 bg-red-50"
              : "border-(--sand)"
          }`}
        >
          <div className="flex flex-col gap-1">
            <CustomCheckbox
              id="codeOfConductAgreed"
              label={
                <>
                  I have read and agree to the{" "}
                  <a
                    href={MLH_CODE_OF_CONDUCT_URL}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="underline underline-offset-4 text-(--ocean) hover:text-(--ink) transition-colors font-semibold"
                  >
                    MLH Code of Conduct
                  </a>
                  .
                </>
              }
              required
              checked={form.codeOfConductAgreed}
              onChange={(e) =>
                updateField("codeOfConductAgreed", e.target.checked)
              }
              aria-invalid={!!errors.codeOfConductAgreed}
              aria-describedby={
                errors.codeOfConductAgreed
                  ? "codeOfConductAgreed-error"
                  : undefined
              }
            />
            <FieldError
              id="codeOfConductAgreed-error"
              message={errors.codeOfConductAgreed}
            />
          </div>
          <div className="flex flex-col gap-1">
            <CustomCheckbox
              id="mlhDataSharingConsent"
              label={
                <>
                  I authorize HackUTA to share my registration information with
                  Major League Hacking for event administration, ranking, and
                  MLH administration in-line with the{" "}
                  <a
                    href={MLH_PRIVACY_POLICY_URL}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="underline underline-offset-4 text-(--ocean) hover:text-(--ink) transition-colors font-semibold"
                  >
                    MLH Privacy Policy
                  </a>
                  .
                </>
              }
              required
              checked={form.mlhDataSharingConsent}
              onChange={(e) =>
                updateField("mlhDataSharingConsent", e.target.checked)
              }
              aria-invalid={!!errors.mlhDataSharingConsent}
              aria-describedby={
                errors.mlhDataSharingConsent
                  ? "mlhDataSharingConsent-error"
                  : undefined
              }
            />
            <FieldError
              id="mlhDataSharingConsent-error"
              message={errors.mlhDataSharingConsent}
            />
          </div>
          <CustomCheckbox
            id="mlhCommunicationsConsent"
            label="I authorize MLH to send me occasional emails about relevant events, career opportunities, and community announcements (optional)."
            checked={form.mlhCommunicationsConsent}
            onChange={(e) =>
              updateField("mlhCommunicationsConsent", e.target.checked)
            }
          />
        </div>
      </section>

      {/* Error Summary and Submit */}
      {Object.keys(errors).length > 0 && (
        <div
          role="alert"
          className="rounded-lg border-2 border-red-400 bg-red-50 p-4 text-sm font-medium text-red-700"
        >
          ⚠ One or more of your answers is invalid. Please review the fields
          above.
        </div>
      )}

      {submitError && (
        <div
          role="alert"
          className="rounded-lg border-2 border-red-400 bg-red-50 p-4 text-sm font-medium text-red-700"
        >
          {submitError}
        </div>
      )}

      <div className="flex justify-center pt-2">
        <OdysseyButton type="submit" disabled={submitting}>
          {submitting ? "Submitting your application…" : "Submit application"}
        </OdysseyButton>
      </div>
    </form>
  );
}
