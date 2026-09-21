function escapeHtml(value: string): string {
  return value
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#39;");
}

export function buildOtpEmailContent(code: string) {
  const text = [
    "Your HackUTA verification code",
    "",
    code,
    "",
    "This code expires in 10 minutes.",
    "Do not share this code with anyone.",
    "If you did not request this email, you can safely ignore it.",
  ].join("\n");

  const html = `<!DOCTYPE html>
<html lang="en">
<body style="font-family: sans-serif; color: #1a3a52;">
  <p>Your HackUTA verification code is:</p>
  <p style="font-size: 28px; font-weight: bold; letter-spacing: 0.2em;">${escapeHtml(code)}</p>
  <p>This code expires in <strong>10 minutes</strong>.</p>
  <p>Do not share this code with anyone.</p>
  <p>If you did not request this email, you can safely ignore it.</p>
</body>
</html>`;

  return {
    subject: "Your HackUTA verification code",
    text,
    html,
  };
}

export function buildApplicationConfirmationEmailContent(payload: {
  firstName: string;
  submittedAt: number;
  profileUrl?: string;
}) {
  const greetingName = payload.firstName.trim() || "there";
  const submitted = new Date(payload.submittedAt).toLocaleString("en-US", {
    dateStyle: "long",
    timeStyle: "short",
    timeZone: "America/Chicago",
  });

  const textLines = [
    `Hi ${greetingName},`,
    "",
    "Thank you for applying to HackUTA 2026. We received your application.",
    "",
    `Submitted: ${submitted}`,
    "",
    "Our team will review your application and share updates by email as decisions are released.",
    "You can return to your applicant profile anytime to check your status.",
  ];

  if (payload.profileUrl) {
    textLines.push("", `View your profile: ${payload.profileUrl}`);
  }

  textLines.push(
    "",
    "If you did not submit this application, please contact hello@hackuta.org.",
  );

  const profileLink = payload.profileUrl
    ? `<p><a href="${escapeHtml(payload.profileUrl)}">View your applicant profile</a></p>`
    : "";

  const html = `<!DOCTYPE html>
<html lang="en">
<body style="font-family: sans-serif; color: #1a3a52; line-height: 1.5;">
  <p>Hi ${escapeHtml(greetingName)},</p>
  <p>Thank you for applying to <strong>HackUTA 2026</strong>. We received your application.</p>
  <p><strong>Submitted:</strong> ${escapeHtml(submitted)}</p>
  <p>Our team will review your application and share updates by email as decisions are released. You can return to your applicant profile anytime to check your status.</p>
  ${profileLink}
  <p>If you did not submit this application, please contact <a href="mailto:hello@hackuta.org">hello@hackuta.org</a>.</p>
</body>
</html>`;

  return {
    subject: "HackUTA 2026 application received",
    text: textLines.join("\n"),
    html,
  };
}

export function buildContactEmailContent(payload: {
  name: string;
  email: string;
  subject: string;
  message: string;
  submittedAt: number;
}) {
  const subjectLine = payload.subject || "HackUTA website contact form";
  const submitted = new Date(payload.submittedAt).toISOString();

  const text = [
    "New contact form submission",
    "",
    `Name: ${payload.name}`,
    `Email: ${payload.email}`,
    `Subject: ${subjectLine}`,
    `Submitted at: ${submitted}`,
    "",
    payload.message,
  ].join("\n");

  const html = `<!DOCTYPE html>
<html lang="en">
<body style="font-family: sans-serif; color: #1a3a52;">
  <h2>New contact form submission</h2>
  <p><strong>Name:</strong> ${escapeHtml(payload.name)}</p>
  <p><strong>Email:</strong> ${escapeHtml(payload.email)}</p>
  <p><strong>Subject:</strong> ${escapeHtml(subjectLine)}</p>
  <p><strong>Submitted at:</strong> ${escapeHtml(submitted)}</p>
  <hr />
  <p style="white-space: pre-wrap;">${escapeHtml(payload.message)}</p>
</body>
</html>`;

  return {
    subject: subjectLine,
    text,
    html,
  };
}

export { escapeHtml };
