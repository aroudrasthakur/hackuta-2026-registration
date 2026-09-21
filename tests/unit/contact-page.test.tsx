import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { MemoryRouter } from "react-router-dom";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { MockAuthProvider } from "../../src/components/MockAuthProvider";
import { SessionAuthProvider } from "../../src/hooks/useSessionAuth";
import ContactPage from "../../src/pages/Contact/ContactPage";
import { ContactForm } from "../../src/pages/Contact/ContactForm";

const { submitContactMock } = vi.hoisted(() => ({
  submitContactMock: vi.fn(),
}));

vi.mock("convex/react", async (importOriginal) => {
  const actual = await importOriginal<typeof import("convex/react")>();
  return {
    ...actual,
    useQuery: () => undefined,
    useAction: () => submitContactMock,
  };
});

vi.mock("@convex-dev/auth/react", () => ({
  useConvexAuth: () => ({ isLoading: false, isAuthenticated: true }),
  useAuthActions: () => ({
    signIn: vi.fn(async () => ({ signingIn: true })),
    signOut: vi.fn(async () => {}),
  }),
}));

vi.mock("../../src/components/SignInStormBackdrop", () => ({
  SignInStormBackdrop: ({ active }: { active?: boolean }) => (
    <div data-testid="storm-backdrop" data-active={active ? "true" : "false"} />
  ),
}));

function renderContactPage() {
  vi.stubEnv("VITE_USE_MOCK_API", "true");
  return render(
    <MemoryRouter>
      <MockAuthProvider>
        <SessionAuthProvider>
          <ContactPage />
        </SessionAuthProvider>
      </MockAuthProvider>
    </MemoryRouter>,
  );
}

function renderContactForm(mockApi = true) {
  vi.stubEnv("VITE_USE_MOCK_API", mockApi ? "true" : "false");
  return render(
    <MemoryRouter>
      <MockAuthProvider>
        <SessionAuthProvider>
          <ContactForm />
        </SessionAuthProvider>
      </MockAuthProvider>
    </MemoryRouter>,
  );
}

describe("ContactPage", () => {
  beforeEach(() => {
    vi.unstubAllEnvs();
    window.localStorage.clear();
  });

  it("renders the contact page shell", () => {
    renderContactPage();
    expect(screen.getByText("Contact us")).toBeInTheDocument();
    expect(
      screen.getByText("Questions about HackUTA 2026"),
    ).toBeInTheDocument();
  });

  it("renders the contact form", () => {
    renderContactPage();
    expect(screen.getByLabelText(/^Name$/i)).toBeInTheDocument();
    expect(screen.getByLabelText(/^Email$/i)).toBeInTheDocument();
    expect(screen.getByLabelText(/^Message$/i)).toBeInTheDocument();
  });

  it("renders the storm frame and weather mood toggle", () => {
    renderContactPage();
    expect(document.querySelector("main.sign-in-page")).toBeInTheDocument();
    expect(screen.getByRole("group", { name: "Weather mood" })).toBeInTheDocument();
    expect(screen.getByTestId("storm-backdrop")).toHaveAttribute("data-active", "true");
  });

  it("calms the storm when the weather toggle is set to Calm", async () => {
    const user = userEvent.setup();
    renderContactPage();

    await user.click(screen.getByRole("button", { name: "Calm" }));

    expect(screen.getByTestId("storm-backdrop")).toHaveAttribute("data-active", "false");
    expect(window.localStorage.getItem("hackuta-weather-mood")).toBe("calm");
  });
});

describe("ContactForm", () => {
  beforeEach(() => {
    vi.unstubAllEnvs();
    submitContactMock.mockReset();
  });

  it("renders all form fields", () => {
    renderContactForm();
    expect(screen.getByLabelText(/^Name$/i)).toBeInTheDocument();
    expect(screen.getByLabelText(/^Email$/i)).toBeInTheDocument();
    expect(screen.getByLabelText(/Subject \(optional\)/i)).toBeInTheDocument();
    expect(screen.getByLabelText(/^Message$/i)).toBeInTheDocument();
    expect(
      screen.getByRole("button", { name: "Send message" }),
    ).toBeInTheDocument();
  });

  it("includes honeypot field for spam prevention", () => {
    renderContactForm();
    expect(screen.getByLabelText("Website")).toBeInTheDocument();
  });

  it("shows error for missing required fields", async () => {
    const user = userEvent.setup();
    renderContactForm();
    await user.click(screen.getByRole("button", { name: "Send message" }));
    expect(
      await screen.findByText("Please complete all required fields."),
    ).toBeInTheDocument();
  });

  it("submits valid contact form successfully", async () => {
    const user = userEvent.setup();
    renderContactForm();

    await user.type(screen.getByLabelText(/^Name$/i), "John Doe");
    await user.type(screen.getByLabelText(/^Email$/i), "john@example.com");
    await user.type(
      screen.getByLabelText(/Subject \(optional\)/i),
      "Question about event",
    );
    await user.type(
      screen.getByLabelText(/^Message$/i),
      "I have a question about the hackathon.",
    );

    await user.click(screen.getByRole("button", { name: "Send message" }));

    expect(
      await screen.findByText("Thank you. Your message has been sent."),
    ).toBeInTheDocument();
  });

  it("blocks spam when honeypot field is filled", async () => {
    const user = userEvent.setup();
    renderContactForm();

    await user.type(screen.getByLabelText(/^Name$/i), "Spammer");
    await user.type(screen.getByLabelText(/^Email$/i), "spam@example.com");
    await user.type(screen.getByLabelText(/^Message$/i), "Spam message");
    await user.type(screen.getByLabelText("Website"), "http://spam.com");

    await user.click(screen.getByRole("button", { name: "Send message" }));

    expect(
      await screen.findByText("Thank you. Your message has been sent."),
    ).toBeInTheDocument();
  });

  it("clears form fields after successful submission", async () => {
    const user = userEvent.setup();
    renderContactForm();

    const nameField = screen.getByLabelText(/^Name$/i);
    const emailField = screen.getByLabelText(/^Email$/i);
    const messageField = screen.getByLabelText(/^Message$/i);

    await user.type(nameField, "John Doe");
    await user.type(emailField, "john@example.com");
    await user.type(messageField, "Test message");

    await user.click(screen.getByRole("button", { name: "Send message" }));

    await screen.findByText("Thank you. Your message has been sent.");

    expect(nameField).toHaveValue("");
    expect(emailField).toHaveValue("");
    expect(messageField).toHaveValue("");
  });

  it("disables submit button while pending", async () => {
    const user = userEvent.setup();
    renderContactForm();

    const button = screen.getByRole("button", { name: "Send message" });
    await user.type(screen.getByLabelText(/^Name$/i), "John Doe");
    await user.type(screen.getByLabelText(/^Email$/i), "john@example.com");
    await user.type(screen.getByLabelText(/^Message$/i), "Test message");

    expect(button).not.toBeDisabled();
  });

  it("submits through the Convex action when mock mode is disabled", async () => {
    submitContactMock.mockResolvedValue(undefined);
    const user = userEvent.setup();
    renderContactForm(false);

    await user.type(screen.getByLabelText(/^Name$/i), "John Doe");
    await user.type(screen.getByLabelText(/^Email$/i), "john@example.com");
    await user.type(screen.getByLabelText(/^Message$/i), "Test message");
    await user.click(screen.getByRole("button", { name: "Send message" }));

    expect(
      await screen.findByText("Thank you. Your message has been sent."),
    ).toBeInTheDocument();
    expect(submitContactMock).toHaveBeenCalled();
  });

  it("shows server errors from the Convex action", async () => {
    submitContactMock.mockRejectedValue(new Error("Rate limit exceeded"));
    const user = userEvent.setup();
    renderContactForm(false);

    await user.type(screen.getByLabelText(/^Name$/i), "John Doe");
    await user.type(screen.getByLabelText(/^Email$/i), "john@example.com");
    await user.type(screen.getByLabelText(/^Message$/i), "Test message");
    await user.click(screen.getByRole("button", { name: "Send message" }));

    expect(await screen.findByText("Rate limit exceeded")).toBeInTheDocument();
  });
});
