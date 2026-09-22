const STORAGE_KEY = "hackuta-contact-client-key";

export function getOrCreateContactClientKey(): string {
  if (typeof window === "undefined" || !window.sessionStorage) {
    return "browser-client";
  }

  const existing = window.sessionStorage.getItem(STORAGE_KEY);
  if (existing) return existing;

  const created =
    typeof crypto.randomUUID === "function"
      ? crypto.randomUUID()
      : `contact-${Date.now()}-${Math.random().toString(36).slice(2)}`;

  window.sessionStorage.setItem(STORAGE_KEY, created);
  return created;
}
