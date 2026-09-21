export const OTP_RESEND_COOLDOWN_SECONDS = 60;
export const OTP_SEND_MAX_PER_HOUR = 5;

const RATE_LIMIT_PATTERNS = [
  /too many verification requests/i,
  /please wait before requesting another code/i,
];

export function isOtpRateLimitError(message: string) {
  return RATE_LIMIT_PATTERNS.some((pattern) => pattern.test(message));
}

export function getOtpSendErrorMessage(error: unknown, devMode: boolean): string | null {
  if (!(error instanceof Error) || !error.message.trim()) {
    return null;
  }

  const message = error.message.trim();
  if (isOtpRateLimitError(message)) {
    return message;
  }

  if (devMode) {
    return message;
  }

  return null;
}
