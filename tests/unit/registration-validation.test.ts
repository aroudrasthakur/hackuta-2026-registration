import { describe, expect, it, vi } from "vitest";
import { MIN_GRADUATION_YEAR } from "../../shared/registration/constants";
import {
  isValidHttpUrl,
  isValidPhone,
  registrationPayloadSchema,
} from "../../shared/registration/schema";
import { INITIAL_FORM, type ApplicationFormData } from "../../shared/registration/types";
import {
  focusFirstInvalidField,
  toggleValue,
  validateApplicationForm,
  validateRegistrationPayload,
} from "../../shared/registration/validation";

function validForm(): ApplicationFormData {
  return {
    ...INITIAL_FORM,
    firstName: "Sam",
    lastName: "Test",
    phone: "5551234567",
    age: "20",
    school: "UT Arlington",
    levelOfStudy: "Undergraduate - Junior",
    major: "Computer Science",
    graduationYear: String(MIN_GRADUATION_YEAR),
    gender: "Male",
    tshirtSize: "M",
    firstHackathon: true,
    hearAbout: "Discord",
    emergencyContactName: "Jane Test",
    emergencyContactPhone: "5559876543",
    codeOfConductAgreed: true,
    mlhDataSharingConsent: true,
  };
}

function validPayloadFromForm() {
  const result = validateApplicationForm(validForm());
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
    const result = validateApplicationForm({ ...validForm(), resume });
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
    const form = validForm();
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
    const form = validForm();
    form.age = "-500";

    const result = validateApplicationForm(form);

    expect(result.success).toBe(false);
  });

  it("rejects invalid graduation years", () => {
    const form = validForm();
    form.graduationYear = "9000";

    const result = validateApplicationForm(form);

    expect(result.success).toBe(false);
  });

  it("requires a description when dietary Other is selected", () => {
    const form = validForm();
    form.dietaryRestrictions = ["Other"];
    form.otherDietary = "";

    const result = validateApplicationForm(form);

    expect(result.success).toBe(false);
    if (!result.success) {
      expect(result.errors.otherDietary).toBe("Please describe your dietary restriction.");
    }
  });

  it("rejects invalid optional URLs", () => {
    const form = validForm();
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
  it("accepts http and https URLs", () => {
    expect(isValidHttpUrl("https://github.com/user")).toBe(true);
    expect(isValidHttpUrl("http://example.com")).toBe(true);
  });

  it("rejects invalid and non-http URLs", () => {
    expect(isValidHttpUrl("not-a-url")).toBe(false);
    expect(isValidHttpUrl("ftp://example.com")).toBe(false);
  });
});

describe("isValidPhone", () => {
  it("accepts normalized phone numbers", () => {
    expect(isValidPhone("555-123-4567")).toBe(true);
  });

  it("rejects too-short numbers", () => {
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
