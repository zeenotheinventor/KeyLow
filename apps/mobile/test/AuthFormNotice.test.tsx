import { screen } from "@testing-library/react-native";

import { resetRouterMock } from "./support/expoRouterMock";
import { renderAuthScreen } from "./support/renderAuthScreen";
import { AuthForm } from "../components/AuthForm";
import { Banner } from "../components/ui";

jest.mock("@react-native-async-storage/async-storage", () => ({
  __esModule: true,
  default: { getItem: () => Promise.resolve(null), setItem: () => Promise.resolve() },
}));

jest.mock(
  "expo-router",
  () => jest.requireActual<{ mockExpoRouter: unknown }>("./support/expoRouterMock").mockExpoRouter,
);
jest.mock("@react-native-google-signin/google-signin", () => ({
  GoogleSignin: jest.requireActual<{ mockGoogleSignin: unknown }>("./support/googleSignInMock")
    .mockGoogleSignin,
}));
jest.mock("../lib/supabase", () => ({
  supabase: jest.requireActual<{ mockSupabaseClient: unknown }>("./support/supabaseMock")
    .mockSupabaseClient,
}));

const footer = {
  prompt: "New to Ki-Lo?",
  linkLabel: "Create account",
  href: "/(auth)/sign-up",
} as const;

function form(notice?: React.ReactNode) {
  return (
    <AuthForm
      footer={footer}
      heading="Welcome back"
      notice={notice}
      passwordRule="required"
      submitLabel="Sign in"
      onSubmit={() => Promise.resolve({ status: "done" })}
    />
  );
}

describe("AuthForm notice", () => {
  beforeEach(() => {
    resetRouterMock();
  });

  it("should draw the notice it is given", async () => {
    await renderAuthScreen(
      form(<Banner sentence title="Your account has been deleted." variant="success" />),
    );

    expect(screen.getByRole("status")).toHaveTextContent("Your account has been deleted.");
  });

  it("should draw no notice when it is given none", async () => {
    await renderAuthScreen(form());

    expect(screen.queryByRole("status")).not.toBeOnTheScreen();
  });

  it("should read the notice above the heading and the fields, as the Sign in board draws it", async () => {
    await renderAuthScreen(
      form(<Banner sentence title="Your account has been deleted." variant="success" />),
    );

    const drawn = JSON.stringify(screen.toJSON());

    expect(drawn.indexOf("Your account has been deleted.")).toBeGreaterThan(-1);
    expect(drawn.indexOf("Your account has been deleted.")).toBeLessThan(
      drawn.indexOf("Welcome back"),
    );
    expect(drawn.indexOf("Welcome back")).toBeLessThan(drawn.indexOf("Email"));
  });
});
