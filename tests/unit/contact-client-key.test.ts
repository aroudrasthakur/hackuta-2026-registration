import { afterEach, describe, expect, it } from "vitest";
import { getOrCreateContactClientKey } from "../../shared/contact/clientKey";

describe("getOrCreateContactClientKey", () => {
  afterEach(() => {
    window.sessionStorage.clear();
  });

  it("creates and reuses a stable session key", () => {
    const first = getOrCreateContactClientKey();
    const second = getOrCreateContactClientKey();

    expect(first).toBeTruthy();
    expect(second).toBe(first);
    expect(window.sessionStorage.getItem("hackuta-contact-client-key")).toBe(first);
  });
});
