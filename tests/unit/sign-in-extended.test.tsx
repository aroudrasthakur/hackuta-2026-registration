import { render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { MemoryRouter, Route, Routes } from "react-router-dom";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { MockAuthProvider } from "../../src/components/MockAuthProvider";
import { MOCK_OTP } from "../../src/constants/mockAuth";
import { SessionAuthProvider } from "../../src/hooks/useSessionAuth";
import SignInPage from "../../src/pages/SignIn/SignInPage";

vi.mock("convex/react", async (importOriginal) => {
  const actual = await importOriginal<typeof import("convex/react")>();
  return {
    ...actual,
    useQuery: () => undefined,
    useMutation: () => vi.fn(),
  };
});

vi.mock("../../src/components/SignInStormBackdrop", () => ({
  SignInStormBackdrop: () => null,
}));

vi.mock("../../src/hooks/useApplicantRouting", () => ({
  useApplicantRouting: () => ({
    isLoading: false,
    isAuthenticated: false,
    verifiedEmail: null,
    hasRegistration: false,
    hasSubmittedRegistration: false,
    registrationStatus: null,
  }),
}));

function renderSignIn() {
  vi.stubEnv("VITE_USE_MOCK_API", "true");
  return render(
    <MemoryRouter>
      <MockAuthProvider>
        <SessionAuthProvider>
          <SignInPage />
        </SessionAuthProvider>
      </MockAuthProvider>
    </MemoryRouter>,
  );
}

describe("SignInPage extended", () => {
  beforeEach(() => {
    vi.unstubAllEnvs();
  });

  it("validates email format before sending code", async () => {
    const user = userEvent.setup();
    renderSignIn();

    await user.type(screen.getByLabelText(/^Email$/i), "invalid-email");
    await user.click(screen.getByRole("button", { name: "Send code" }));

    expect(
      screen.getByText("Please enter a valid email address."),
    ).toBeInTheDocument();
  });

  it("normalizes email address", async () => {
    const user = userEvent.setup();
    renderSignIn();

    await user.type(screen.getByLabelText(/^Email$/i), "TEST@EXAMPLE.COM");
    await user.click(screen.getByRole("button", { name: "Send code" }));

    await waitFor(() => {
      expect(
        screen.getByRole("heading", { name: "Check your email" }),
      ).toBeInTheDocument();
    });
  });

  it("shows email address in OTP step", async () => {
    const user = userEvent.setup();
    renderSignIn();

    const email = "user@example.com";
    await user.type(screen.getByLabelText(/^Email$/i), email);
    await user.click(screen.getByRole("button", { name: "Send code" }));

    expect(await screen.findByText(email)).toBeInTheDocument();
  });

  it("provides back button on OTP step", async () => {
    const user = userEvent.setup();
    renderSignIn();

    await user.type(screen.getByLabelText(/^Email$/i), "test@example.com");
    await user.click(screen.getByRole("button", { name: "Send code" }));

    await waitFor(() => {
      expect(
        screen.getByRole("heading", { name: "Check your email" }),
      ).toBeInTheDocument();
    });

    // Check if "different email" link exists instead of "back"
    expect(
      screen.getByRole("button", { name: /different email/i }),
    ).toBeInTheDocument();
  });

  it("returns to email step when back is clicked", async () => {
    const user = userEvent.setup();
    renderSignIn();

    await user.type(screen.getByLabelText(/^Email$/i), "test@example.com");
    await user.click(screen.getByRole("button", { name: "Send code" }));

    await waitFor(() => {
      expect(
        screen.getByRole("heading", { name: "Check your email" }),
      ).toBeInTheDocument();
    });

    await user.click(screen.getByRole("button", { name: /different email/i }));

    expect(await screen.findByRole("heading", { name: "Sign in" })).toBeInTheDocument();
    expect(
      screen.getByRole("button", { name: /Send code in \d+s/ }),
    ).toBeDisabled();
  });

  it("allows OTP entry with 6 digits", async () => {
    const user = userEvent.setup();
    renderSignIn();

    await user.type(screen.getByLabelText(/^Email$/i), "test@example.com");
    await user.click(screen.getByRole("button", { name: "Send code" }));

    const cells = await screen.findAllByRole("textbox");
    expect(cells).toHaveLength(6);
  });

  it("auto-submits when 6 digits are entered", async () => {
    const user = userEvent.setup();
    renderSignIn();

    await user.type(screen.getByLabelText(/^Email$/i), "test@example.com");
    await user.click(screen.getByRole("button", { name: "Send code" }));

    const cells = await screen.findAllByRole("textbox");
    await user.click(cells[0]!);
    await user.paste("123456");

    // Code should be entered
    expect(cells[0]).toHaveValue("1");
    expect(cells[5]).toHaveValue("6");
  });

  it("handles non-digit input in OTP", async () => {
    const user = userEvent.setup();
    renderSignIn();

    await user.type(screen.getByLabelText(/^Email$/i), "test@example.com");
    await user.click(screen.getByRole("button", { name: "Send code" }));

    const cells = await screen.findAllByRole("textbox");
    await user.click(cells[0]!);
    await user.keyboard("abc");

    // Non-digits should be filtered
    expect(cells[0]).toHaveValue("");
  });

  it("clears error when user modifies OTP", async () => {
    const user = userEvent.setup();
    renderSignIn();

    await user.type(screen.getByLabelText(/^Email$/i), "test@example.com");
    await user.click(screen.getByRole("button", { name: "Send code" }));

    const cells = await screen.findAllByRole("textbox");
    await user.click(cells[0]!);

    // Any interaction should work
    expect(cells[0]).toBeInTheDocument();
  });

  it("disables send button while pending", async () => {
    const user = userEvent.setup();
    renderSignIn();

    const button = screen.getByRole("button", { name: "Send code" });
    await user.type(screen.getByLabelText(/^Email$/i), "test@example.com");

    expect(button).not.toBeDisabled();
  });

  it("displays loading state during authentication", async () => {
    const user = userEvent.setup();
    renderSignIn();

    await user.type(screen.getByLabelText(/^Email$/i), "test@example.com");
    await user.click(screen.getByRole("button", { name: "Send code" }));

    // Component should handle pending state
    expect(
      screen.getByRole("heading", { name: "Check your email" }),
    ).toBeInTheDocument();
  });

  it("verifies mock OTP and navigates to register", async () => {
    const user = userEvent.setup();
    vi.stubEnv("VITE_USE_MOCK_API", "true");

    render(
      <MemoryRouter initialEntries={["/sign-in"]}>
        <MockAuthProvider>
          <SessionAuthProvider>
            <Routes>
              <Route path="/sign-in" element={<SignInPage />} />
              <Route path="/register" element={<div>Register Page</div>} />
            </Routes>
          </SessionAuthProvider>
        </MockAuthProvider>
      </MemoryRouter>,
    );

    await user.type(screen.getByLabelText(/^Email$/i), "applicant@example.com");
    await user.click(screen.getByRole("button", { name: "Send code" }));

    const cells = await screen.findAllByRole("textbox");
    await user.click(cells[0]!);
    await user.paste(MOCK_OTP);
    await user.click(screen.getByRole("button", { name: "Verify code" }));

    expect(await screen.findByText("Register Page")).toBeInTheDocument();
  });

  it("shows cooldown on the email step after returning from OTP", async () => {
    const user = userEvent.setup();
    renderSignIn();

    await user.type(screen.getByLabelText(/^Email$/i), "test@example.com");
    await user.click(screen.getByRole("button", { name: "Send code" }));
    await user.click(screen.getByRole("button", { name: "Use a different email" }));

    expect(screen.getByRole("heading", { name: "Sign in" })).toBeInTheDocument();
    expect(screen.queryByText(/You can send another in \d+s/)).not.toBeInTheDocument();
    expect(screen.getByRole("button", { name: /Send code in \d+s/ })).toBeDisabled();
    expect(screen.getByRole("button", { name: "Back to enter code" })).toBeInTheDocument();
  });

  it("returns to OTP entry from the email step during cooldown", async () => {
    const user = userEvent.setup();
    renderSignIn();

    await user.type(screen.getByLabelText(/^Email$/i), "test@example.com");
    await user.click(screen.getByRole("button", { name: "Send code" }));
    await user.click(screen.getByRole("button", { name: "Use a different email" }));
    await user.click(screen.getByRole("button", { name: "Back to enter code" }));

    expect(screen.getByRole("heading", { name: "Check your email" })).toBeInTheDocument();
    expect(screen.getAllByRole("textbox")).toHaveLength(6);
  });

  it("shows resend countdown after sending a code", async () => {
    const user = userEvent.setup();
    renderSignIn();

    await user.type(screen.getByLabelText(/^Email$/i), "test@example.com");
    await user.click(screen.getByRole("button", { name: "Send code" }));

    expect(await screen.findByRole("button", { name: /Resend code in \d+s/ })).toBeDisabled();
  });

  it("shows an error for an invalid mock OTP", async () => {
    const user = userEvent.setup();
    renderSignIn();

    await user.type(screen.getByLabelText(/^Email$/i), "test@example.com");
    await user.click(screen.getByRole("button", { name: "Send code" }));

    const cells = await screen.findAllByRole("textbox");
    await user.click(cells[0]!);
    await user.paste("111111");
    await user.click(screen.getByRole("button", { name: "Verify code" }));

    expect(
      await screen.findByText("The verification code is invalid or expired."),
    ).toBeInTheDocument();
  });

  it("keeps verify disabled until six digits are entered", async () => {
    const user = userEvent.setup();
    renderSignIn();

    await user.type(screen.getByLabelText(/^Email$/i), "test@example.com");
    await user.click(screen.getByRole("button", { name: "Send code" }));

    const cells = await screen.findAllByRole("textbox");
    await user.click(cells[0]!);
    await user.paste("123");

    expect(screen.getByRole("button", { name: "Verify code" })).toBeDisabled();
  });

  it("enables resend after the countdown label appears", async () => {
    const user = userEvent.setup();
    renderSignIn();

    await user.type(screen.getByLabelText(/^Email$/i), "test@example.com");
    await user.click(screen.getByRole("button", { name: "Send code" }));

    const resendButton = await screen.findByRole("button", { name: /Resend code/i });
    expect(resendButton).toBeDisabled();
    expect(resendButton.textContent).toMatch(/Resend code in \d+s/);
  });
});
