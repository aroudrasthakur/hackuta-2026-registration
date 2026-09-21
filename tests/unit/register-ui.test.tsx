import { fireEvent, render, screen, waitFor, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { MIN_GRADUATION_YEAR } from "../../shared/registration/constants";
import { LANDING_URL } from "../../src/constants/site";
import { ApplicationForm } from "../../src/pages/Register/ApplicationForm";
import { SuccessStep } from "../../src/pages/Register/SuccessStep";

vi.mock("@convex-dev/auth/react", () => ({
  useAuthToken: vi.fn(() => "test-token"),
}));

vi.mock("../../src/pages/Register/registerApi", () => ({
  submitRegistration: vi.fn(),
  uploadResume: vi.fn(),
  discardResumeUpload: vi.fn(),
}));

async function fillValidApplication(user: ReturnType<typeof userEvent.setup>) {
  await user.type(screen.getByLabelText(/First name/), "Sam");
  await user.type(screen.getByLabelText(/Last name/), "Test");
  await user.type(screen.getByLabelText(/Phone number/), "5551234567");
  await user.type(screen.getByLabelText(/Age/i), "20");
  await user.type(screen.getByLabelText(/School \/ university/), "UT Arlington");
  await user.selectOptions(screen.getByLabelText(/Level of study/), "Undergraduate - Junior");
  await user.type(screen.getByLabelText(/Major \/ field of study/), "Computer Science");
  await user.type(screen.getByLabelText(/Expected graduation year/), String(MIN_GRADUATION_YEAR));
  await user.selectOptions(screen.getByLabelText(/^Gender/), "Male");
  await user.selectOptions(screen.getByLabelText(/T-shirt size/), "M");
  await user.click(screen.getByLabelText(/^Yes$/));
  await user.selectOptions(screen.getByLabelText(/How did you hear about HackUTA/), "Discord");
  await user.type(screen.getByLabelText(/Emergency contact name/), "Jane Test");
  await user.type(screen.getByLabelText(/Emergency contact phone/), "5559876543");
  await user.click(screen.getByLabelText(/MLH Code of Conduct/));
  await user.click(screen.getByLabelText(/authorize HackUTA to share my registration information/));
}

describe("SuccessStep", () => {
  it("focuses the success heading and links back to the landing site", () => {
    render(<SuccessStep />);

    expect(screen.getByRole("status")).toHaveAttribute("aria-live", "polite");
    expect(screen.getByRole("heading", { name: "You're on the list!" })).toBeInTheDocument();
    expect(screen.getByRole("link", { name: "Back to home" })).toHaveAttribute("href", LANDING_URL);
  });
});

describe("ApplicationForm", () => {
  beforeEach(async () => {
    const api = await import("../../src/pages/Register/registerApi");
    vi.mocked(api.submitRegistration).mockResolvedValue({ ok: true });
    vi.mocked(api.uploadResume).mockResolvedValue({ storageId: "resume-id", uploadToken: "upload-token" });
    vi.mocked(api.discardResumeUpload).mockResolvedValue(undefined);
  });

  it("corrects validation errors and submits optional details with a PDF only once", async () => {
    const user = userEvent.setup();
    const onSubmitted = vi.fn();
    const { submitRegistration, uploadResume } = await import("../../src/pages/Register/registerApi");
    let finish!: (value: { ok: true }) => void;
    vi.mocked(uploadResume).mockClear().mockResolvedValue({ storageId: "resume-id", uploadToken: "upload-token" });
    vi.mocked(submitRegistration).mockClear().mockImplementation(() => new Promise((resolve) => { finish = resolve; }));
    render(<ApplicationForm onSubmitted={onSubmitted} />);
    await user.click(screen.getByRole("button", { name: "Submit application" }));
    await fillValidApplication(user);
    expect(screen.queryByText("First name is required.")).not.toBeInTheDocument();
    await user.click(within(screen.getByRole("group", { name: /Dietary restrictions/ })).getByLabelText(/^Other$/));
    await user.click(screen.getByRole("button", { name: "Submit application" }));
    expect(screen.getByText("Please describe your dietary restriction.")).toBeInTheDocument();
    await user.type(screen.getByPlaceholderText("Tell us more"), "No peanuts");
    await user.type(screen.getByLabelText("LinkedIn (optional)"), "https://linkedin.com/in/sam");
    await user.type(screen.getByLabelText("Portfolio (optional)"), "https://example.com/sam");
    await user.type(screen.getByLabelText(/Accessibility needs/), "Step-free access");
    await user.click(screen.getByLabelText(/^No$/));
    const resume = new File(["%PDF-1.7"], "resume.pdf", { type: "application/pdf" });
    await user.upload(screen.getByLabelText("Resume (optional)"), resume);
    const button = screen.getByRole("button", { name: "Submit application" });
    await user.click(button);
    expect(button).toBeDisabled();
    expect(screen.getByLabelText("Resume (optional)")).toBeDisabled();
    fireEvent.submit(button.closest("form")!);
    expect(submitRegistration).toHaveBeenCalledTimes(1);
    expect(uploadResume).toHaveBeenCalledWith(resume);
    expect(submitRegistration).toHaveBeenCalledWith(expect.objectContaining({
      otherDietary: "No peanuts", linkedin: "https://linkedin.com/in/sam", portfolio: "https://example.com/sam",
      accessibilityNeeds: "Step-free access", firstHackathon: false,
    }), "test-token", { storageId: "resume-id", uploadToken: "upload-token" });
    finish({ ok: true });
    await waitFor(() => expect(onSubmitted).toHaveBeenCalledOnce());
  }, 10_000);

  it("selects and removes a PDF resume", async () => {
    const user = userEvent.setup();
    render(<ApplicationForm onSubmitted={vi.fn()} />);
    const input = screen.getByLabelText("Resume (optional)") as HTMLInputElement;
    const file = new File(["%PDF-1.7"], "resume.pdf", { type: "application/pdf" });
    await user.upload(input, file);
    expect(input.files?.[0]).toBe(file);
    await user.upload(input, []);
    expect(screen.queryByRole("button", { name: "Remove resume" })).not.toBeInTheDocument();
    await user.upload(input, file);
    await user.click(screen.getByRole("button", { name: "Remove resume" }));
    expect(input.files).toHaveLength(0);
  });

  it("shows an inline error for a non-PDF resume", async () => {
    const user = userEvent.setup({ applyAccept: false });
    render(<ApplicationForm onSubmitted={vi.fn()} />);
    await user.upload(screen.getByLabelText("Resume (optional)"), new File(["text"], "resume.docx"));
    expect(screen.getByText("Please select a PDF file.")).toBeInTheDocument();
    expect(screen.getByLabelText("Resume (optional)")).toHaveAttribute("aria-invalid", "true");
  });

  it("clears a resume error after selecting a valid PDF", async () => {
    const user = userEvent.setup({ applyAccept: false });
    render(<ApplicationForm onSubmitted={vi.fn()} />);
    const input = screen.getByLabelText("Resume (optional)");
    await user.upload(input, new File(["text"], "resume.docx"));
    expect(screen.getByText("Please select a PDF file.")).toBeInTheDocument();
    await user.upload(input, new File(["%PDF-1.7"], "resume.pdf", { type: "application/pdf" }));
    expect(screen.queryByText("Please select a PDF file.")).not.toBeInTheDocument();
    expect(input).toHaveAttribute("aria-invalid", "false");
  });

  it("submits a valid application", async () => {
    const user = userEvent.setup();
    const onSubmitted = vi.fn();
    const { submitRegistration } = await import("../../src/pages/Register/registerApi");
    vi.mocked(submitRegistration).mockResolvedValue({ ok: true });

    render(<ApplicationForm onSubmitted={onSubmitted} />);
    await fillValidApplication(user);
    await user.click(screen.getByRole("button", { name: "Submit application" }));

    await waitFor(() => {
      expect(submitRegistration).toHaveBeenCalled();
      expect(onSubmitted).toHaveBeenCalled();
    });
  });

  it("shows an error for invalid optional profile URLs", async () => {
    const user = userEvent.setup();
    render(<ApplicationForm onSubmitted={vi.fn()} />);

    await user.type(screen.getByLabelText(/GitHub \(optional\)/), "not-a-url");
    await user.click(screen.getByRole("button", { name: "Submit application" }));

    expect(await screen.findByText(/Enter a valid github URL/i)).toBeInTheDocument();
  });

  it("supports optional profile fields and consent toggles", async () => {
    const user = userEvent.setup();
    render(<ApplicationForm onSubmitted={vi.fn()} />);

    await user.type(screen.getByLabelText(/GitHub \(optional\)/), "https://github.com/sam");
    await user.click(screen.getByLabelText(/I authorize MLH to send me occasional emails/));
    await user.click(screen.getByLabelText(/Vegetarian/));
    await user.click(screen.getByLabelText(/Asian/));

    expect(screen.getByLabelText(/GitHub \(optional\)/)).toHaveValue("https://github.com/sam");
  });

  it("shows a submit error when the API fails", async () => {
    const user = userEvent.setup();
    const { submitRegistration } = await import("../../src/pages/Register/registerApi");
    vi.mocked(submitRegistration).mockRejectedValue(new Error("network"));

    render(<ApplicationForm onSubmitted={vi.fn()} />);
    await fillValidApplication(user);
    await user.click(screen.getByRole("button", { name: "Submit application" }));

    await waitFor(() => {
      expect(
        screen.getByText("We couldn't submit your application. Please try again."),
      ).toBeInTheDocument();
    });
  });
});
