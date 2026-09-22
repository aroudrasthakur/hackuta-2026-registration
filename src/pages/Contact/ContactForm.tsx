import { useAction } from "convex/react";
import { useState, type FormEvent } from "react";
import { OdysseyButton } from "../../components/OdysseyButton";
import { isMockApiEnabled } from "../../constants/mockAuth";
import { submitContactMessageRef } from "../../convex/api";
import { getOrCreateContactClientKey } from "../../../shared/contact/clientKey";
import {
  fieldClass,
  labelClass,
  legendClass,
} from "../Register/components/formFieldStyles";

const GENERIC_ERROR = "We couldn't send your message. Please try again later.";

export function ContactForm() {
  const submitContact = useAction(submitContactMessageRef);
  const mockEnabled = isMockApiEnabled();

  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [subject, setSubject] = useState("");
  const [message, setMessage] = useState("");
  const [website, setWebsite] = useState("");
  const [pending, setPending] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);

  const handleSubmit = async (event: FormEvent) => {
    event.preventDefault();
    if (pending) return;

    setPending(true);
    setError(null);
    setSuccess(null);

    try {
      if (mockEnabled) {
        if (website.trim()) {
          setSuccess("Thank you. Your message has been sent.");
          return;
        }
        if (!name.trim() || !email.trim() || !message.trim()) {
          setError("Please complete all required fields.");
          return;
        }
        setSuccess("Thank you. Your message has been sent.");
        setName("");
        setEmail("");
        setSubject("");
        setMessage("");
        setWebsite("");
        return;
      }

      await submitContact({
        name,
        email,
        subject,
        message,
        website,
        clientKey: getOrCreateContactClientKey(),
      });
      setSuccess("Thank you. Your message has been sent.");
      setName("");
      setEmail("");
      setSubject("");
      setMessage("");
      setWebsite("");
    } catch (err) {
      const detail = err instanceof Error ? err.message.trim() : "";
      setError(detail || GENERIC_ERROR);
    } finally {
      setPending(false);
    }
  };

  return (
    <form onSubmit={handleSubmit} noValidate className="flex flex-col gap-6">
      <label className={labelClass} htmlFor="contact-name">
        <span className={legendClass}>Name</span>
        <input
          id="contact-name"
          type="text"
          autoComplete="name"
          required
          maxLength={100}
          value={name}
          onChange={(event) => setName(event.target.value)}
          className={fieldClass(error ?? undefined)}
        />
      </label>

      <label className={labelClass} htmlFor="contact-email">
        <span className={legendClass}>Email</span>
        <input
          id="contact-email"
          type="email"
          autoComplete="email"
          required
          maxLength={254}
          value={email}
          onChange={(event) => setEmail(event.target.value)}
          className={fieldClass(error ?? undefined)}
        />
      </label>

      <label className={labelClass} htmlFor="contact-subject">
        <span className={legendClass}>Subject (optional)</span>
        <input
          id="contact-subject"
          type="text"
          maxLength={150}
          value={subject}
          onChange={(event) => setSubject(event.target.value)}
          className={fieldClass()}
        />
      </label>

      <label className={labelClass} htmlFor="contact-message">
        <span className={legendClass}>Message</span>
        <textarea
          id="contact-message"
          required
          maxLength={5000}
          rows={6}
          value={message}
          onChange={(event) => setMessage(event.target.value)}
          className={fieldClass(error ?? undefined)}
        />
      </label>

      <div className="hidden" aria-hidden="true">
        <label htmlFor="contact-website">
          Website
          <input
            id="contact-website"
            type="text"
            tabIndex={-1}
            autoComplete="off"
            value={website}
            onChange={(event) => setWebsite(event.target.value)}
          />
        </label>
      </div>

      {error ? (
        <p className="text-sm font-medium text-red-600" role="alert">
          {error}
        </p>
      ) : null}
      {success ? (
        <p className="text-sm text-(--ocean)" role="status" aria-live="polite">
          {success}
        </p>
      ) : null}

      <OdysseyButton type="submit" disabled={pending}>
        {pending ? "Sending…" : "Send message"}
      </OdysseyButton>
    </form>
  );
}
