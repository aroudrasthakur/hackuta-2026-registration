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

describe("SignInPage", () => {
  beforeEach(() => {
    vi.unstubAllEnvs();
  });

  it("shows the email entry step", () => {
    renderSignIn();
    expect(screen.getByLabelText(/^Email$/i)).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Send code" })).toBeInTheDocument();
  });

  it("rejects an invalid email", async () => {
    const user = userEvent.setup();
    renderSignIn();
    await user.type(screen.getByLabelText(/^Email$/i), "not-an-email");
    await user.click(screen.getByRole("button", { name: "Send code" }));
    expect(screen.getByText("Please enter a valid email address.")).toBeInTheDocument();
  });

  it("shows the segmented OTP step after sending a code", async () => {
    const user = userEvent.setup();
    renderSignIn();
    await user.type(screen.getByLabelText(/^Email$/i), "applicant@example.com");
    await user.click(screen.getByRole("button", { name: "Send code" }));
    expect(screen.getByRole("heading", { name: "Check your email" })).toBeInTheDocument();
    expect(screen.getByText("applicant@example.com")).toBeInTheDocument();
    expect(screen.getAllByRole("textbox")).toHaveLength(6);
  });

  it("preserves leading zeros in OTP entry", async () => {
    const user = userEvent.setup();
    renderSignIn();
    await user.type(screen.getByLabelText(/^Email$/i), "applicant@example.com");
    await user.click(screen.getByRole("button", { name: "Send code" }));
    const cells = screen.getAllByRole("textbox");
    await user.click(cells[0]!);
    await user.paste("042681");
    expect(cells[0]).toHaveValue("0");
    expect(cells[1]).toHaveValue("4");
    expect(cells[5]).toHaveValue("1");
  });
});
