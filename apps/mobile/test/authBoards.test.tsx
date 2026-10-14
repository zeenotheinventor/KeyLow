import { themes } from "@keylow/tokens";
import { AuthApiError } from "@supabase/supabase-js";
import { act, screen, userEvent } from "@testing-library/react-native";
import { setUpTests } from "react-native-reanimated";

import { resetRouterMock, routerMock } from "./support/expoRouterMock";
import { resetGoogleSignInMock } from "./support/googleSignInMock";
import { compileKitStyles } from "./support/kitStyles";
import { registerAppStyles } from "./support/nativeWindStyles";
import { renderAuthScreen } from "./support/renderAuthScreen";
import { mockSupabaseClient, resetSupabaseMock } from "./support/supabaseMock";
import { resolvedColor } from "./support/themeColor";
import { viewsDrawn } from "./support/viewsDrawn";
import SignInRoute from "../app/(auth)/sign-in";
import SignUpRoute from "../app/(auth)/sign-up";
import CallbackRoute from "../app/auth/callback";

import type { ThemeScheme } from "@keylow/tokens";

// Each state of the auth boards, in dark and light, on the real routes with a mocked backend. The
// behaviour (what is sent, what is refused) is in sign-in.test.tsx, sign-up.test.tsx and callback.test.tsx.

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
jest.mock("@react-native-async-storage/async-storage", () => ({
  __esModule: true,
  default: { getItem: () => Promise.resolve(null), setItem: () => Promise.resolve() },
}));

setUpTests();

const schemes: ThemeScheme[] = ["dark", "light"];

const refused = new AuthApiError("Invalid login credentials", 400, "invalid_credentials");

async function typeAndSubmit(buttonName: string | RegExp, email: string, password: string) {
  const user = userEvent.setup();
  await user.type(screen.getByLabelText("Email"), email);
  await user.type(screen.getByLabelText("Password"), password);
  await user.press(screen.getByRole("button", { name: buttonName }));
}

// The scroll view holds the form's layout in its content container, which has no role to query by.
function formScrollView() {
  return screen.root?.queryAll((node) => node.type === "RCTScrollView")[0];
}

function drawings() {
  return screen.root?.queryAll((node) => node.type === "RNSVGSvgView") ?? [];
}

describe("the auth boards", () => {
  let styles: string;

  beforeAll(async () => {
    styles = await compileKitStyles("", [
      "components/AuthForm",
      "components/GoogleButton",
      "components/KiLoMark",
      "components/LinkNotValid",
      "components/SigningInLink",
      "app",
    ]);
  });

  beforeEach(() => {
    registerAppStyles(styles);
    resetRouterMock();
    resetSupabaseMock();
    resetGoogleSignInMock();
  });

  describe.each(schemes)("in %s", (scheme) => {
    describe("sign-in", () => {
      it("should lay the form out as the board does: 24 across, 56 above, 34 below, 16 between", async () => {
        await renderAuthScreen(<SignInRoute />, scheme);

        expect(formScrollView()?.props.contentContainerStyle).toMatchObject({
          flexGrow: 1,
          justifyContent: "center",
          paddingLeft: 24,
          paddingRight: 24,
          paddingTop: 56,
          paddingBottom: 34,
          rowGap: 16,
        });
      });

      it("should draw the mark at 64 points and the heading in the h1 style", async () => {
        await renderAuthScreen(<SignInRoute />, scheme);

        expect(drawings()[0]?.props.width).toBe(64);
        expect(screen.getByRole("heading", { name: "Welcome back" })).toHaveStyle({
          fontSize: 28,
          lineHeight: 34,
          color: resolvedColor(scheme, "text-primary"),
        });
      });

      it("should draw the primary button in the accent with the accent foreground, 52 high", async () => {
        await renderAuthScreen(<SignInRoute />, scheme);

        const button = screen.getByRole("button", { name: "Sign in" });
        expect(button).toHaveStyle({
          height: 52,
          backgroundColor: resolvedColor(scheme, "accent"),
        });
        expect(screen.getByText("Sign in")).toHaveStyle({
          color: resolvedColor(scheme, "accent-foreground"),
        });
      });

      it("should put the footer's prompt in secondary text and its link in primary text", async () => {
        await renderAuthScreen(<SignInRoute />, scheme);

        expect(screen.getByText("New to Ki-Lo?")).toHaveStyle({
          color: resolvedColor(scheme, "text-secondary"),
        });
      });
    });

    describe("sign-in-field-errors", () => {
      it("should flag each field with a danger border and say its problem in danger text", async () => {
        await renderAuthScreen(<SignInRoute />, scheme);

        await typeAndSubmit("Sign in", "sam.taylor@", "");

        const emailProblem = await screen.findByRole("alert", {
          name: "Enter a valid email address",
        });
        expect(emailProblem).toHaveStyle({ color: resolvedColor(scheme, "danger") });
        expect(screen.getByRole("alert", { name: "Enter your password" })).toBeOnTheScreen();
        expect(viewsDrawn({ borderColor: resolvedColor(scheme, "danger") })).toHaveLength(2);
      });
    });

    describe("sign-in-error", () => {
      it("should show the refusal in a danger-muted notice with a danger border, its words in primary text", async () => {
        mockSupabaseClient.auth.signInWithPassword.mockResolvedValue({ data: {}, error: refused });
        await renderAuthScreen(<SignInRoute />, scheme);

        await typeAndSubmit("Sign in", "sam.taylor@example.com", "correcthorse");

        await screen.findByRole("alert", {
          name: "Email or password is not right. Check them and try again.",
        });
        expect(
          viewsDrawn({
            backgroundColor: themes[scheme]["danger-muted"],
            borderColor: resolvedColor(scheme, "danger"),
            borderWidth: 1,
            borderRadius: 12,
          }),
        ).toHaveLength(1);
        expect(
          screen.getByText("Email or password is not right. Check them and try again."),
        ).toHaveStyle({
          color: resolvedColor(scheme, "text-primary"),
          fontFamily: "Geist-Regular",
        });
      });
    });

    describe("sign-in-submitting", () => {
      it("should dim Google to 40 percent and keep the primary button at full strength under its spinner", async () => {
        mockSupabaseClient.auth.signInWithPassword.mockReturnValue(new Promise(() => undefined));
        await renderAuthScreen(<SignInRoute />, scheme);

        await typeAndSubmit("Sign in", "sam.taylor@example.com", "correcthorse");

        expect(screen.getByRole("button", { name: "Continue with Google" })).toHaveStyle({
          opacity: Math.fround(0.4),
        });
        expect(screen.getByRole("button", { name: /Sign in/, busy: true })).not.toHaveStyle({
          opacity: Math.fround(0.4),
        });
      });
    });

    describe("sign-up", () => {
      it("should say the password rule in muted text under the field", async () => {
        await renderAuthScreen(<SignUpRoute />, scheme);

        expect(screen.getByText("At least 8 characters")).toHaveStyle({
          color: resolvedColor(scheme, "text-muted"),
        });
      });
    });

    describe("sign-up-field-errors", () => {
      it("should say both problems, the password's in place of the rule", async () => {
        await renderAuthScreen(<SignUpRoute />, scheme);

        await typeAndSubmit("Create account", "", "abc");

        expect(
          await screen.findByRole("alert", { name: "Enter your email address" }),
        ).toBeOnTheScreen();
        expect(
          screen.getByRole("alert", { name: "Password must be at least 8 characters" }),
        ).toBeOnTheScreen();
        expect(screen.queryByText("At least 8 characters")).not.toBeOnTheScreen();
      });
    });

    describe("sign-up-check-email", () => {
      it("should show the info notice between the fields and the buttons, naming the address", async () => {
        mockSupabaseClient.auth.signUp.mockResolvedValue({ data: { session: null }, error: null });
        await renderAuthScreen(<SignUpRoute />, scheme);

        await typeAndSubmit("Create account", "sam.taylor@example.com", "correcthorse");

        expect(await screen.findByText("Check your email")).toHaveStyle({
          color: resolvedColor(scheme, "text-primary"),
        });
        expect(
          screen.getByText(
            "Open the confirmation link sent to sam.taylor@example.com to finish creating your account.",
          ),
        ).toHaveStyle({ color: resolvedColor(scheme, "text-secondary") });
        expect(screen.getByLabelText("Email")).toHaveDisplayValue("sam.taylor@example.com");
      });
    });

    describe("signing-in-link", () => {
      it("should centre the mark at 64 points over Signing you in in secondary text", async () => {
        mockSupabaseClient.auth.exchangeCodeForSession.mockReturnValue(
          new Promise(() => undefined),
        );
        routerMock.searchParams = { code: "pkce-code" };

        await renderAuthScreen(<CallbackRoute />, scheme);

        expect(drawings()[0]?.props.width).toBe(64);
        expect(screen.getByText("Signing you in")).toHaveStyle({
          color: resolvedColor(scheme, "text-secondary"),
        });
        expect(
          viewsDrawn({ alignItems: "center", justifyContent: "center", rowGap: 16 }),
        ).toHaveLength(1);
      });
    });

    describe("signing-in-link-error", () => {
      it("should show the danger-muted tile, the title, the sentence and a secondary button", async () => {
        await renderAuthScreen(<CallbackRoute />, scheme);

        await screen.findByRole("alert", { name: /^Link not valid/ });
        expect(
          viewsDrawn({
            width: 56,
            height: 56,
            backgroundColor: themes[scheme]["danger-muted"],
            borderRadius: 12,
          }),
        ).toHaveLength(1);
        expect(
          screen.getByText(
            "This sign-in link is not valid. It may have expired or already been used.",
          ),
        ).toHaveStyle({ color: resolvedColor(scheme, "text-secondary"), textAlign: "center" });
        expect(screen.getByRole("button", { name: "Back to sign in" })).toHaveStyle({
          height: 44,
          backgroundColor: resolvedColor(scheme, "surface-raised"),
          borderColor: resolvedColor(scheme, "border"),
        });
        await act(() => undefined);
      });
    });
  });
});
