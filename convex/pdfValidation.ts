import { PDFDocument } from "pdf-lib";

/** Parse and validate resume bytes before storage; do not trust Content-Type alone. */
export async function validateResumePdfBytes(bytes: Uint8Array): Promise<void> {
  const pdf = await PDFDocument.load(bytes, {
    ignoreEncryption: false,
    throwOnInvalidObject: true,
    updateMetadata: false,
  });
  if (pdf.getPageCount() === 0) {
    throw new Error("A resume must have at least one page.");
  }
}
