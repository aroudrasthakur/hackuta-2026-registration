import { fireEvent, render, screen, waitFor, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { MemoryRouter } from "react-router-dom";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { MIN_GRADUATION_YEAR } from "../../shared/registration/constants";
import { LANDING_URL } from "../../src/constants/site";
import { ApplicationForm } from "../../src/pages/Register/ApplicationForm";
import { SuccessStep } from "../../src/pages/Register/SuccessStep";

vi.mock("../../src/hooks/useSessionAuth", () => ({
  useSessionAuth: () => ({
    isLoading: false,
    isAuthenticated: true,
    signIn: vi.fn(),
    signOut: vi.fn(),
  }),
}));

vi.mock("../../src/hooks/useApplicantRouting", () => ({
  useApplicantRouting: () => ({
    isLoading: false,
    isAuthenticated: true,
    verifiedEmail: "applicant@example.com",
    hasRegistration: false,
    hasSubmittedRegistration: false,
    registrationStatus: null,
  }),
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
    render(
      <MemoryRouter>
        <SuccessStep />
      </MemoryRouter>,
    );

    expect(screen.getByRole("status")).toHaveAttribute("aria-live", "polite");
    expect(screen.getByRole("heading", { name: "Your Journey Begins!" })).toBeInTheDocument();
    expect(screen.getByRole("link", { name: "Back to home" })).toHaveAttribute("href", LANDING_URL);
    expect(screen.getByRole("link", { name: "View your application" })).toHaveAttribute("href", "/profile");
  });
});

describe("ApplicationForm", () => {
  beforeEach(async () => {
    const api = await import("../../src/pages/Register/registerApi");
    vi.mocked(api.submitRegistration).mockResolvedValue({ ok: true });
    vi.mocked(api.uploadResume).mockResolvedValue({ storageId: "resume-id", uploadToken: "upload-token" });
    vi.mocked(api.discardResumeUpload).mockResolvedValue(undefined);
  });

  it("shows the verified email as read-only context", () => {
    render(<ApplicationForm onSubmitted={vi.fn()} />);
    expect(screen.getByText("applicant@example.com")).toBeInTheDocument();
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
    await user.type(screen.getByPlaceholderText("Please specify your dietary restrictions"), "No peanuts");
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
    }), { storageId: "resume-id", uploadToken: "upload-token" });
    finish({ ok: true });
    await waitFor(() => expect(onSubmitted).toHaveBeenCalledOnce());
  }, 10_000);

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
});
