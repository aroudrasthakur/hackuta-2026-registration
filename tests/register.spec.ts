import { test, expect } from "./playwright-coverage";
import { MIN_GRADUATION_YEAR } from "../shared/registration/constants";
import { contentSecurityPolicy } from "../security/csp";
import vercelConfig from "../vercel.json" with { type: "json" };

test.describe("registration", () => {
  test("submits a PDF resume with the application under the production CSP", async ({ page }) => {
    const deployedCsp = vercelConfig.headers.flatMap((rule) => rule.headers)
      .find((header) => header.key === "Content-Security-Policy")?.value;
    expect(deployedCsp).toBe(contentSecurityPolicy);

    const resume = Buffer.from("%PDF-1.7\nTest resume\n%%EOF");
    const uploadUrl = "https://registration-test.convex.site/resume-upload";
    const uploadMethods: string[] = [];
    const failedRequests: string[] = [];
    let uploaded = false;
    let authorization: string | undefined;
    let submitted: Record<string, unknown> | undefined;
    page.on("requestfailed", (request) => {
      failedRequests.push(`${request.method()} ${request.url()}: ${request.failure()?.errorText}`);
    });
    await page.route("**/api/mutation", async (route) => {
      const request = route.request();
      if (request.method() === "OPTIONS") {
        await route.fulfill({
          status: 204,
          headers: {
            "Access-Control-Allow-Origin": "*",
            "Access-Control-Allow-Methods": "POST, OPTIONS",
            "Access-Control-Allow-Headers": "Content-Type, Authorization",
          },
        });
        return;
      }
      const { path, args } = request.postDataJSON();
      if (path === "registrations:register") {
        expect(uploaded).toBe(true);
        authorization = request.headers().authorization;
        expect(args.resumeUploadToken).toBe("test-upload-token");
        submitted = args.data;
        await route.fulfill({
          headers: { "Access-Control-Allow-Origin": "*" },
          json: { status: "success", value: { ok: true } },
        });
      } else {
        await route.abort();
      }
    });
    await page.route(uploadUrl, async (route) => {
      const request = route.request();
      uploadMethods.push(request.method());
      if (request.method() === "OPTIONS") {
        await route.fulfill({
          status: 204,
          headers: {
            "Access-Control-Allow-Origin": "*",
            "Access-Control-Allow-Methods": "POST, OPTIONS",
            "Access-Control-Allow-Headers": "Content-Type",
          },
        });
        return;
      }
      expect(request.method()).toBe("POST");
      expect(request.headers()["content-type"]).toBe("application/pdf");
      expect(request.postDataBuffer()).toEqual(resume);
      uploaded = true;
      await route.fulfill({
        status: 201,
        headers: { "Access-Control-Allow-Origin": "*" },
        json: { storageId: "test-resume-id", uploadToken: "test-upload-token" },
      });
    });
    await page.goto("/register");
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
    await page.getByLabel("Resume (optional)").setInputFiles({
      name: "resume.pdf", mimeType: "application/pdf", buffer: resume,
    });
    await page.getByRole("button", { name: "Submit application" }).click();
    await expect.poll(() => submitted, {
      message: `upload methods: ${uploadMethods.join(", ")}; failed requests: ${failedRequests.join(" | ")}`,
    }).toBeDefined();
    await expect(page.getByRole("heading", { name: "You're on the list!" })).toBeVisible();
    expect(authorization).toBe("Bearer test-token");
    expect(submitted).toMatchObject({ firstName: "Sam", resumeStorageId: "test-resume-id" });
  });

  test("loads the application form at /register", async ({ page }) => {
    await page.goto("/register");

    await expect(page.getByRole("heading", { name: "Tell us about yourself" })).toBeVisible();
    await expect(page.getByRole("button", { name: "Submit application" })).toBeVisible();
    await expect(page.locator("main.register-page")).toBeVisible();
  });

  test("shows field errors on empty submit and stays on the form", async ({ page }) => {
    await page.goto("/register");

    await page.getByRole("button", { name: "Submit application" }).click();

    await expect(page.getByText("First name is required.")).toBeVisible();
    await expect(
      page.getByText("One or more of your answers is invalid. Please review the fields below."),
    ).toBeVisible();
    await expect(page.getByRole("heading", { name: "You're on the list!" })).toHaveCount(0);
    await expect(page.getByRole("heading", { name: "Tell us about yourself" })).toBeVisible();
  });

  test("marks invalid fields with aria-invalid", async ({ page }) => {
    await page.goto("/register");

    await page.getByRole("button", { name: "Submit application" }).click();

    await expect(page.locator("#firstName")).toHaveAttribute("aria-invalid", "true");
    await expect(page.locator("#firstName-error")).toContainText("First name is required.");
  });
});
