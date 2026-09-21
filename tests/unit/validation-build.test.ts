import { describe, expect, it } from "vitest";
import { MIN_GRADUATION_YEAR } from "../../shared/registration/constants";
import { isValidPhone } from "../../shared/registration/schema";
import { INITIAL_FORM, type ApplicationFormData } from "../../shared/registration/types";
import { validateApplicationForm } from "../../shared/registration/validation";

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

describe("validateApplicationForm candidate building", () => {
  it("treats blank numeric fields as invalid numbers", () => {
    const form = validForm();
    form.age = "   ";
    form.graduationYear = "";

    const result = validateApplicationForm(form);
    expect(result.success).toBe(false);
  });

  it("maps unchecked consent to undefined", () => {
    const form = validForm();
    form.codeOfConductAgreed = false;
    form.mlhDataSharingConsent = false;
    form.mlhCommunicationsConsent = false;

    const result = validateApplicationForm(form);
    expect(result.success).toBe(false);
  });
});

describe("isValidPhone boundaries", () => {
  it("accepts 7-15 digit numbers", () => {
    expect(isValidPhone("1234567")).toBe(true);
    expect(isValidPhone("123456789012345")).toBe(true);
  });

  it("rejects numbers outside the allowed range", () => {
    expect(isValidPhone("123456")).toBe(false);
    expect(isValidPhone("1234567890123456")).toBe(false);
  });
});
