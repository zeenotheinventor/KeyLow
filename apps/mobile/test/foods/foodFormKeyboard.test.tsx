import { fireEvent, render } from "@testing-library/react-native";
import { Platform } from "react-native";

import { FoodForm } from "../../components/FoodForm";
import { ThemeProvider } from "../../lib/theme";
import {
  focusFieldAt,
  holdFrames,
  scrollViewOnScreen,
  stubScrollViewAt,
} from "../support/focusedField";
import { stubKeyboard } from "../support/keyboardStub";
import { compileKitStyles } from "../support/kitStyles";
import { registerAppStyles } from "../support/nativeWindStyles";
import { viewsDrawn } from "../support/viewsDrawn";

jest.mock("@react-native-async-storage/async-storage", () => ({
  __esModule: true,
  default: { getItem: () => Promise.resolve(null), setItem: () => Promise.resolve() },
}));
jest.mock(
  "react-native-safe-area-context",
  () =>
    jest.requireActual<{ default: unknown }>("react-native-safe-area-context/jest/mock").default,
);

// The footer's top hairline picks it out of the form's views. Its bottom padding is the 12 points the
// boards give it, plus whatever the keyboard covers of it.
const footerPadded = (paddingBottom: number) => viewsDrawn({ paddingBottom, borderTopWidth: 1 });

async function renderForm() {
  return render(
    <ThemeProvider fixedPreference="dark">
      <FoodForm submitLabel="Create food" onSubmit={() => Promise.resolve()} />
    </ThemeProvider>,
  );
}

describe("food form above the keyboard", () => {
  let styles: string;

  beforeAll(async () => {
    styles = await compileKitStyles("", ["components/FoodForm"]);
  });

  beforeEach(() => {
    registerAppStyles(styles);
  });

  afterEach(() => {
    jest.restoreAllMocks();
  });

  describe("on Android", () => {
    beforeEach(() => {
      jest.replaceProperty(Platform, "OS", "android");
    });

    it("should keep the footer on the bottom edge while the keyboard is closed", async () => {
      stubKeyboard(800);
      await renderForm();

      expect(footerPadded(12)).toHaveLength(1);
    });

    it("should lift the footer by the height of the keyboard that covers it", async () => {
      const keyboard = stubKeyboard(800);
      await renderForm();

      await keyboard.show(560);

      expect(footerPadded(240 + 12)).toHaveLength(1);
    });

    it("should scroll the focused field clear of the lifted footer, from where the form is scrolled to", async () => {
      // The scroll view ends at 800, and the field ends at 850, so 50 and the room to spare are hidden.
      const keyboard = stubKeyboard(800);
      focusFieldAt(750, 100);
      const frames = holdFrames();
      const scrollTo = stubScrollViewAt(100, 700);
      await renderForm();
      await fireEvent.scroll(scrollViewOnScreen(), {
        nativeEvent: { contentOffset: { y: 200 } },
      });

      await keyboard.show(560);
      await frames.run();

      expect(scrollTo).toHaveBeenCalledWith({ y: 200 + 50 + 16, animated: false });
    });

    it("should lower the footer when the keyboard goes", async () => {
      const keyboard = stubKeyboard(800);
      await renderForm();
      await keyboard.show(560);
      expect(footerPadded(240 + 12)).toHaveLength(1);

      await keyboard.hide();

      expect(footerPadded(240 + 12)).toHaveLength(0);
      expect(footerPadded(12)).toHaveLength(1);
    });
  });

  describe("on iOS", () => {
    beforeEach(() => {
      jest.replaceProperty(Platform, "OS", "ios");
    });

    it("should leave the footer where it is when the keyboard shows, as the screen's padding view moves it", async () => {
      const keyboard = stubKeyboard(800);
      await renderForm();

      await keyboard.show(560);

      expect(footerPadded(12)).toHaveLength(1);
    });
  });
});
