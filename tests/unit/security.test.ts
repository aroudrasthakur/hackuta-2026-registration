import { describe, expect, it } from "vitest";
import { contentSecurityPolicy } from "../../security/csp";

describe("contentSecurityPolicy", () => {
  it("allows Convex endpoints required by registration", () => {
    expect(contentSecurityPolicy).toContain("https://*.convex.cloud");
    expect(contentSecurityPolicy).toContain("https://*.convex.site");
    expect(contentSecurityPolicy).toContain("require-trusted-types-for 'script'");
  });
});
