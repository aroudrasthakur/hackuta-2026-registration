import { describe, expect, it, vi } from "vitest";
import { registrationPayloadSchema } from "../../shared/registration/schema";
import { INITIAL_FORM } from "../../shared/registration/types";
import {
  focusFirstInvalidField,
  toggleValue,
  validateApplicationForm,
  validateRegistrationPayload,
} from "../../shared/registration/validation";
import { validRegistrationForm } from "../fixtures/validRegistrationForm";

function validPayloadFromForm() {
  const result = validateApplicationForm(validRegistrationForm());
  if (!result.success) {
    throw new Error("Test setup failed: valid form did not validate");
  }

  return result.payload;
}

describe("validateApplicationForm", () => {
  it.each([
    new File(["text"], "resume.txt", { type: "text/plain" }),
    new File([], "resume.pdf", { type: "application/pdf" }),
    new File(["x".repeat(5 * 1024 * 1024 + 1)], "resume.pdf", { type: "application/pdf" }),
  ])("blocks submission of invalid resume files", (resume) => {
    const result = validateApplicationForm({ ...validRegistrationForm(), resume });
    expect(result.success).toBe(false);
    if (!result.success) expect(result.errors.resume).toBeTruthy();
  });

  it("rejects an empty form with field errors", () => {
    const result = validateApplicationForm(INITIAL_FORM);

    expect(result.success).toBe(false);
    if (!result.success) {
      expect(result.errors.firstName).toBe("First name is required.");
      expect(result.errors.codeOfConductAgreed).toBeTruthy();
    }
  });

  it("accepts a valid form and trims whitespace", () => {
    const form = validRegistrationForm();
    form.firstName = "  Sam  ";
    form.lastName = "  Test  ";

    const result = validateApplicationForm(form);

    expect(result.success).toBe(true);
    if (result.success) {
      expect(result.payload.firstName).toBe("Sam");
      expect(result.payload.lastName).toBe("Test");
    }
  });

  it("rejects invalid age values", () => {
    const form = validRegistrationForm();
    form.age = "-500";

    const result = validateApplicationForm(form);

    expect(result.success).toBe(false);
  });

  it("rejects invalid graduation years", () => {
    const form = validRegistrationForm();
    form.graduationYear = "9000";

    const result = validateApplicationForm(form);

    expect(result.success).toBe(false);
  });

  it("rejects schools that are not on the MLH list", () => {
    const form = validRegistrationForm();
    form.school = "UT Arlington" as typeof form.school;

    const result = validateApplicationForm(form);

    expect(result.success).toBe(false);
    if (!result.success) {
      expect(result.errors.school).toContain("school");
    }
  });

  it("requires a description when dietary Allergies is selected", () => {
    const form = validRegistrationForm();
    form.dietaryRestrictions = ["Allergies"];
    form.otherDietary = "";

    const result = validateApplicationForm(form);

    expect(result.success).toBe(false);
    if (!result.success) {
      expect(result.errors.otherDietary).toBe("Please describe your food allergies.");
    }
  });

  it("rejects invalid optional URLs", () => {
    const form = validRegistrationForm();
    form.github = "http://???";

    const result = validateApplicationForm(form);

    expect(result.success).toBe(false);
    if (!result.success) {
      expect(result.errors.github).toBeTruthy();
    }
  });
});

describe("validateRegistrationPayload", () => {
  it("accepts a valid payload", () => {
    const payload = validPayloadFromForm();
    const parsed = registrationPayloadSchema.safeParse(payload);

    expect(parsed.success).toBe(true);
    expect(validateRegistrationPayload(payload).success).toBe(true);
  });

  it("rejects invalid enum values", () => {
    const result = validateRegistrationPayload({
      ...validPayloadFromForm(),
      gender: "asdf",
    });

    expect(result.success).toBe(false);
  });

  it("rejects unexpected fields", () => {
    const result = validateRegistrationPayload({
      ...validPayloadFromForm(),
      injectedField: "nope",
    });

    expect(result.success).toBe(false);
  });

  it("rejects bypass attempts with invalid age", () => {
    const result = validateRegistrationPayload({
      ...validPayloadFromForm(),
      age: -500,
    });

    expect(result.success).toBe(false);
  });

  it("rejects missing consent fields", () => {
    const result = validateRegistrationPayload({
      ...validPayloadFromForm(),
      codeOfConductAgreed: false,
    });

    expect(result.success).toBe(false);
  });
});

describe("isValidHttpUrl", () => {
  it("accepts http and https URLs", async () => {
    const { isValidHttpUrl } = await import("../../shared/registration/schema");
    expect(isValidHttpUrl("https://github.com/user")).toBe(true);
    expect(isValidHttpUrl("http://example.com")).toBe(true);
  });

  it("rejects invalid and non-http URLs", async () => {
    const { isValidHttpUrl } = await import("../../shared/registration/schema");
    expect(isValidHttpUrl("not-a-url")).toBe(false);
    expect(isValidHttpUrl("ftp://example.com")).toBe(false);
  });
});

describe("isValidPhone", () => {
  it("accepts normalized phone numbers", async () => {
    const { isValidPhone } = await import("../../shared/registration/schema");
    expect(isValidPhone("555-123-4567")).toBe(true);
  });

  it("rejects too-short numbers", async () => {
    const { isValidPhone } = await import("../../shared/registration/schema");
    expect(isValidPhone("123")).toBe(false);
  });
});

describe("toggleValue", () => {
  it("adds a value when it is not present", () => {
    expect(toggleValue(["A"], "B")).toEqual(["A", "B"]);
  });

  it("removes a value when it is already present", () => {
    expect(toggleValue(["A", "B"], "A")).toEqual(["B"]);
  });
});

describe("focusFirstInvalidField", () => {
  it("focuses the first invalid field in field order", () => {
    const element = document.createElement("input");
    element.id = "firstName";
    document.body.appendChild(element);
    const focusSpy = vi.spyOn(element, "focus");
    const scrollSpy = vi.spyOn(element, "scrollIntoView");

    focusFirstInvalidField({ lastName: "Required", firstName: "Required" });

    expect(scrollSpy).toHaveBeenCalledWith({ behavior: "smooth", block: "center" });
    expect(focusSpy).toHaveBeenCalledWith({ preventScroll: true });
  });

  it("no-ops when there are no errors", () => {
    expect(() => focusFirstInvalidField({})).not.toThrow();
  });
});
