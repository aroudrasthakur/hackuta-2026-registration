import { PageShell } from "../../components/PageShell";
import { StormPageFrame } from "../../components/StormPageFrame";
import { ContactForm } from "./ContactForm";

export default function ContactPage() {
  return (
    <StormPageFrame>
      <PageShell title="Contact us" subtitle="Questions about HackUTA 2026" frameless>
        <ContactForm />
      </PageShell>
    </StormPageFrame>
  );
}
