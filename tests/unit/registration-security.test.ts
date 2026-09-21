import { afterEach, describe, expect, it, vi } from "vitest";
import {
  getRegistrationAdminIdentityKeys,
  getRegistrationAllowedOrigins,
  isOriginAllowed,
  isRegistrationAdmin,
} from "../../convex/registrationSecurity";

describe("registrationSecurity", () => {
  afterEach(() => {
    vi.unstubAllEnvs();
  });

  it("rejects origins when the allowlist is empty", () => {
    vi.stubEnv("REGISTRATION_ALLOWED_ORIGINS", "");
    expect(getRegistrationAllowedOrigins()).toEqual([]);
    expect(isOriginAllowed("https://hackuta.org", [])).toBe(false);
    expect(isOriginAllowed(null, [])).toBe(false);
  });

  it("accepts only configured production origins", () => {
    vi.stubEnv("REGISTRATION_ALLOWED_ORIGINS", "https://hackuta.org, https://www.hackuta.org");
    const allowed = getRegistrationAllowedOrigins();
    expect(allowed).toEqual(["https://hackuta.org", "https://www.hackuta.org"]);
    expect(isOriginAllowed("https://hackuta.org", allowed)).toBe(true);
    expect(isOriginAllowed("https://evil.example", allowed)).toBe(false);
  });

  it("rejects admin access when the allowlist is empty", () => {
    vi.stubEnv("REGISTRATION_ADMIN_IDENTITY_KEYS", "");
    expect(getRegistrationAdminIdentityKeys()).toEqual([]);
    expect(isRegistrationAdmin("provider-user")).toBe(false);
  });

  it("accepts only configured organizer identity keys", () => {
    vi.stubEnv("REGISTRATION_ADMIN_IDENTITY_KEYS", "provider-user, organizer-two");
    const admins = getRegistrationAdminIdentityKeys();
    expect(admins).toEqual(["provider-user", "organizer-two"]);
    expect(isRegistrationAdmin("provider-user")).toBe(true);
    expect(isRegistrationAdmin("foreign-user")).toBe(false);
  });
});
