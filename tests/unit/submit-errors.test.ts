import { describe, expect, it } from "vitest";
import {
  isResumeFieldMessage,
  mapConvexErrorToUserMessage,
  mapResumeUploadHttpError,
  SUBMIT_ERROR_MESSAGE,
} from "../../shared/registration/submitErrors";

describe("submit error mapping", () => {
  it("passes through known server messages in production mode", () => {
    expect(
      mapConvexErrorToUserMessage(new Error("You have already submitted an application.")),
    ).toBe("You have already submitted an application.");
  });

  it("maps unknown server failures to a friendly default", () => {
    expect(mapConvexErrorToUserMessage(new Error("Invalid registration data."))).toBe(
      SUBMIT_ERROR_MESSAGE,
    );
  });

  it("treats resume validation messages as field errors", () => {
    expect(mapConvexErrorToUserMessage(new Error("Please select a PDF file."))).toBe(
      "Please select a PDF file.",
    );
    expect(isResumeFieldMessage("Please select a PDF file.")).toBe(true);
  });

  it("maps resume upload HTTP statuses to applicant-friendly copy", () => {
    expect(mapResumeUploadHttpError(422, {})).toBe(
      "The file is not a valid PDF. Please choose another file.",
    );
    expect(mapResumeUploadHttpError(429, { error: "Too many uploads. Please try again later." }))
      .toBe("Too many uploads. Please try again later.");
  });
});
