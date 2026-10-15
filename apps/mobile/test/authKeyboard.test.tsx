import { fireEvent } from "@testing-library/react-native";
import { Platform } from "react-native";

import { resetRouterMock } from "./support/expoRouterMock";
import {
  focusFieldAt,
  holdFrames,
  scrollViewOnScreen,
  stubScrollViewAt,
} from "./support/focusedField";
import { resetGoogleSignInMock } from "./support/googleSignInMock";
import { stubKeyboard } from "./support/keyboardStub";
import { compileKitStyles } from "./support/kitStyles";
import { registerAppStyles } from "./support/nativeWindStyles";
import { renderAuthScreen } from "./support/renderAuthScreen";
import { resetSupabaseMock } from "./support/supabaseMock";
import { viewsDrawn } from "./support/viewsDrawn";
import SignInRoute from "../app/(auth)/sign-in";
import SignUpRoute from "../app/(auth)/sign-up";

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

// The scroll area's frame fills the screen, and the keyboard's cover is padding at its bottom, so the
// form is scrolled in what is left above the keyboard. On Android only that frame is both a view that
// grows to fill the screen and padded at the bottom.
const frameKeptAboveKeyboard = (cover: number) => viewsDrawn({ flexGrow: 1, paddingBottom: cover });

const screens = [
  { name: "sign-in", Route: SignInRoute },
  { name: "sign-up", Route: SignUpRoute },
];

describe.each(screens)("$name screen above the keyboard", ({ Route }) => {
  let styles: string;

  beforeAll(async () => {
    styles = await compileKitStyles("", ["components/AuthForm"]);
  });

  beforeEach(() => {
    resetRouterMock();
    resetSupabaseMock();
    resetGoogleSignInMock();
    registerAppStyles(styles);
  });

  afterEach(() => {
    jest.restoreAllMocks();
  });

  describe("on Android", () => {
    beforeEach(() => {
      jest.replaceProperty(Platform, "OS", "android");
    });

    it("should leave no room under the form while the keyboard is closed", async () => {
      stubKeyboard(800);
      await renderAuthScreen(<Route />);

      expect(frameKeptAboveKeyboard(0)).toHaveLength(1);
    });

    it("should make room under the form as tall as the keyboard", async () => {
      const keyboard = stubKeyboard(800);
      await renderAuthScreen(<Route />);

      await keyboard.show(560);

      expect(frameKeptAboveKeyboard(240)).toHaveLength(1);
    });

    it("should scroll the focused field clear of the keyboard, from where the form is scrolled to", async () => {
      // The scroll view ends at 800, and the field ends at 850, so 50 and the room to spare are hidden.
      const keyboard = stubKeyboard(800);
      focusFieldAt(750, 100);
      const frames = holdFrames();
      const scrollTo = stubScrollViewAt(100, 700);
      await renderAuthScreen(<Route />);
      await fireEvent.scroll(scrollViewOnScreen(), { nativeEvent: { contentOffset: { y: 200 } } });

      await keyboard.show(560);
      await frames.run();

      expect(scrollTo).toHaveBeenCalledWith({ y: 200 + 50 + 16, animated: false });
    });

    it("should take the room away when the keyboard goes", async () => {
      const keyboard = stubKeyboard(800);
      await renderAuthScreen(<Route />);
      await keyboard.show(560);
      expect(frameKeptAboveKeyboard(240)).toHaveLength(1);

      await keyboard.hide();

      expect(frameKeptAboveKeyboard(240)).toHaveLength(0);
      expect(frameKeptAboveKeyboard(0)).toHaveLength(1);
    });
  });

  describe("on iOS", () => {
    beforeEach(() => {
      jest.replaceProperty(Platform, "OS", "ios");
    });

    it("should leave the room to the screen's padding view when the keyboard shows", async () => {
      const keyboard = stubKeyboard(800);
      await renderAuthScreen(<Route />);

      await keyboard.show(560);

      expect(frameKeptAboveKeyboard(240)).toHaveLength(0);
    });
  });
});
