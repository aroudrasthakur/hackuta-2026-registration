function localDevOriginVariants(siteUrl: string): string[] {
  try {
    const url = new URL(siteUrl);
    if (url.hostname !== "localhost" && url.hostname !== "127.0.0.1") {
      return [url.origin];
    }

    const port = url.port || (url.protocol === "https:" ? "443" : "80");
    const withPort = (host: string) => `${url.protocol}//${host}${port ? `:${port}` : ""}`;

    return Array.from(
      new Set([url.origin, withPort("localhost"), withPort("127.0.0.1")]),
    );
  } catch {
    return [];
  }
}

export function getRegistrationAllowedOrigins(): string[] {
  const origins = new Set(
    (process.env.REGISTRATION_ALLOWED_ORIGINS ?? "")
      .split(",")
      .map((value) => value.trim())
      .filter(Boolean),
  );

  const siteUrl = process.env.SITE_URL?.trim();
  if (siteUrl) {
    for (const origin of localDevOriginVariants(siteUrl)) {
      origins.add(origin);
    }
  }

  return Array.from(origins);
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
