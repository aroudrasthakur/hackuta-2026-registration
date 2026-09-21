import { PageShell } from "../../components/PageShell";
import { ContactForm } from "./ContactForm";

export default function ContactPage() {
  return (
    <PageShell title="Contact us" subtitle="Questions about HackUTA 2026">
      <ContactForm />
    </PageShell>
  );
}
