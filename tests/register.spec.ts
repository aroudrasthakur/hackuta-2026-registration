import { test, expect, type Page } from "./playwright-coverage";
import { MIN_GRADUATION_YEAR } from "../shared/registration/constants";
import { contentSecurityPolicy } from "../security/csp";
import { MOCK_OTP } from "../src/components/MockAuthProvider";
import vercelConfig from "../vercel.json" with { type: "json" };

async function signInAsNewApplicant(page: Page) {
  await page.goto("/sign-in");
  await page.getByLabel("Email", { exact: true }).fill("applicant@example.com");
  await page.getByRole("button", { name: "Send code" }).click();
  await expect(page.getByRole("heading", { name: "Check your email" })).toBeVisible();

  const otpCells = page.locator(".sign-in-otp__cell");
  await otpCells.first().click();
  await page.keyboard.type(MOCK_OTP);
  await page.getByRole("button", { name: "Verify code" }).click();
  await page.waitForURL("**/register");
}

async function fillApplicationForm(page: Page) {
  await page.getByLabel("First name", { exact: false }).fill("Sam");
  await page.getByLabel("Last name", { exact: false }).fill("Test");
  await page.getByLabel("Phone number", { exact: false }).fill("5551234567");
  await page.locator("#age").fill("20");
  await page.getByLabel("School / university", { exact: false }).fill("UT Arlington");
  await page.getByLabel("Level of study", { exact: false }).selectOption("Undergraduate - Junior");
  await page.getByLabel("Major / field of study", { exact: false }).fill("Computer Science");
  await page.getByLabel("Expected graduation year", { exact: false }).fill(String(MIN_GRADUATION_YEAR));
  await page.locator("#gender").selectOption("Male");
  await page.getByLabel("T-shirt size", { exact: false }).selectOption("M");
  await page.getByLabel("Yes", { exact: true }).check();
  await page.getByLabel("How did you hear about HackUTA?", { exact: false }).selectOption("Discord");
  await page.getByLabel("Emergency contact name", { exact: false }).fill("Jane Test");
  await page.getByLabel("Emergency contact phone", { exact: false }).fill("5559876543");
  await page.locator("#codeOfConductAgreed").check();
  await page.locator("#mlhDataSharingConsent").check();
}

test.describe("registration", () => {
  test("submits a PDF resume with the application under the production CSP", async ({ page }) => {
    const deployedCsp = vercelConfig.headers.flatMap((rule) => rule.headers)
      .find((header) => header.key === "Content-Security-Policy")?.value;
    expect(deployedCsp).toBe(contentSecurityPolicy);

    const resume = Buffer.from("%PDF-1.7\nTest resume\n%%EOF");

    await signInAsNewApplicant(page);
    await fillApplicationForm(page);
    await page.getByLabel("Resume (optional)").setInputFiles({
      name: "resume.pdf",
      mimeType: "application/pdf",
      buffer: resume,
    });
    await page.getByRole("button", { name: "Submit application" }).click();

    await expect(page.getByRole("heading", { name: "Your Journey Begins!" })).toBeVisible({
      timeout: 15_000,
    });
  });

  test("loads the application form at /register after mock sign-in", async ({ page }) => {
    await signInAsNewApplicant(page);

    await expect(page.getByRole("heading", { name: "Tell us about yourself" })).toBeVisible();
    await expect(page.getByRole("button", { name: "Submit application" })).toBeVisible();
    await expect(page.locator("main.sign-in-page")).toBeVisible();
    await expect(page.getByRole("group", { name: "Weather mood" })).toBeVisible();
  });

  test("shows field errors on empty submit and stays on the form", async ({ page }) => {
    await signInAsNewApplicant(page);
    await page.getByRole("button", { name: "Submit application" }).click();

    await expect(page.getByText("First name is required.")).toBeVisible();
    await expect(
      page.getByText("One or more of your answers is invalid. Please review the fields below."),
    ).toBeVisible();
    await expect(page.getByRole("heading", { name: "Your Journey Begins!" })).toHaveCount(0);
    await expect(page.getByRole("heading", { name: "Tell us about yourself" })).toBeVisible();
  });

  test("marks invalid fields with aria-invalid", async ({ page }) => {
    await signInAsNewApplicant(page);
    await page.getByRole("button", { name: "Submit application" }).click();

    await expect(page.locator("#firstName")).toHaveAttribute("aria-invalid", "true");
    await expect(page.locator("#firstName-error")).toContainText("First name is required.");
  });

  test("calms and re-enrages the storm backdrop from the register page", async ({ page }) => {
    await signInAsNewApplicant(page);

    await expect(page.getByRole("button", { name: "Enrage" })).toHaveAttribute("aria-pressed", "true");
    await page.getByRole("button", { name: "Calm" }).click();
    await expect(page.getByRole("button", { name: "Calm" })).toHaveAttribute("aria-pressed", "true");
    await page.getByRole("button", { name: "Enrage" }).click();
    await expect(page.getByRole("button", { name: "Enrage" })).toHaveAttribute("aria-pressed", "true");
  });
});
