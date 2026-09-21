import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { MemoryRouter } from "react-router-dom";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { MockAuthProvider } from "../../src/components/MockAuthProvider";
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

describe("SignInPage", () => {
  beforeEach(() => {
    vi.unstubAllEnvs();
  });

  it("shows the email entry step", () => {
    renderSignIn();
    expect(screen.getByLabelText(/Email address/)).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Send verification code" })).toBeInTheDocument();
  });

  it("rejects an invalid email", async () => {
    const user = userEvent.setup();
    renderSignIn();
    await user.type(screen.getByLabelText(/Email address/), "not-an-email");
    await user.click(screen.getByRole("button", { name: "Send verification code" }));
    expect(screen.getByText("Please enter a valid email address.")).toBeInTheDocument();
  });

  it("preserves leading zeros in OTP entry", async () => {
    const user = userEvent.setup();
    renderSignIn();
    await user.type(screen.getByLabelText(/Email address/), "applicant@example.com");
    await user.click(screen.getByRole("button", { name: "Send verification code" }));
    const codeInput = screen.getByLabelText(/Verification code/);
    await user.type(codeInput, "042681");
    expect(codeInput).toHaveValue("042681");
  });
});
