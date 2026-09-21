export function getRegistrationAllowedOrigins(): string[] {
  return (process.env.REGISTRATION_ALLOWED_ORIGINS ?? "")
    .split(",")
    .map((value) => value.trim())
    .filter(Boolean);
}

export function isOriginAllowed(origin: string | null, allowed: string[]): origin is string {
  if (allowed.length === 0 || !origin) return false;
  return allowed.includes(origin);
}

export function getRegistrationAdminIdentityKeys(): string[] {
  return (process.env.REGISTRATION_ADMIN_IDENTITY_KEYS ?? "")
    .split(",")
    .map((value) => value.trim())
    .filter(Boolean);
}

export function isRegistrationAdmin(identityKey: string): boolean {
  const admins = getRegistrationAdminIdentityKeys();
  const normalized = identityKey.trim();
  return admins.length > 0 && admins.includes(normalized);
}
