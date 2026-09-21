export const MAX_RESUME_BYTES = 5 * 1024 * 1024;

/**
 * Lightweight client-side checks for immediate UX feedback only.
 * The upload endpoint validates PDF structure with pdf-lib; registration
 * mutations verify storage metadata and a server-issued upload token.
 */
export function validateResume(file: Pick<File, "name" | "type" | "size">): string | undefined {
  if (!file.name.toLowerCase().endsWith(".pdf") || (file.type && file.type !== "application/pdf")) {
    return "Please select a PDF file.";
  }
  if (file.size === 0) return "Your PDF is empty. Please select another file.";
  if (file.size > MAX_RESUME_BYTES) return "Your PDF must be 5 MB or smaller.";
}

export function resumeFileKey(file: File) {
  return `${file.name}:${file.size}:${file.lastModified}`;
}
