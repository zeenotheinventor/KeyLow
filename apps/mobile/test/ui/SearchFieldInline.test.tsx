import { fireEvent, render, screen } from "@testing-library/react-native";
import { Keyboard } from "react-native";
import { setUpTests } from "react-native-reanimated";

import { SearchField } from "../../components/ui";
import { ThemeProvider } from "../../lib/theme";
import { compileKitStyles } from "../support/kitStyles";
import { registerAppStyles } from "../support/nativeWindStyles";
import { viewsDrawn } from "../support/viewsDrawn";

import type { SearchFieldProps } from "../../components/ui";

jest.mock("@react-native-async-storage/async-storage", () => ({
  __esModule: true,
  default: { getItem: () => Promise.resolve(null), setItem: () => Promise.resolve() },
}));

setUpTests();

const defaultProps: SearchFieldProps = {
  label: "Search recipes",
  placeholder: "Search recipes",
  value: "",
  onChangeText: () => undefined,
};

async function renderField(props: Partial<SearchFieldProps> = {}) {
  await render(
    <ThemeProvider fixedPreference="dark">
      <SearchField {...defaultProps} {...props} />
    </ThemeProvider>,
  );
}

// The dock is the one view with a hairline above it and no fill of its own at the bottom while the keyboard is closed.
const docks = () => viewsDrawn({ borderTopWidth: 1, paddingBottom: 0 });

describe("SearchField placed in a screen's content", () => {
  let kitStyles: string;

  beforeAll(async () => {
    kitStyles = await compileKitStyles();
  });

  beforeEach(() => {
    registerAppStyles(kitStyles);
  });

  afterEach(() => {
    jest.restoreAllMocks();
  });

  it("should be docked at the bottom unless the screen places it inline", async () => {
    await renderField();

    expect(docks()).toHaveLength(1);
  });

  it("should draw the field alone when it is inline, with no dock around it", async () => {
    await renderField({ placement: "inline" });

    expect(screen.getByRole("searchbox", { name: "Search recipes" })).toBeOnTheScreen();
    expect(docks()).toHaveLength(0);
  });

  it("should not listen to the keyboard when it is inline, because it is never under it", async () => {
    const addListener = jest.spyOn(Keyboard, "addListener");
    await renderField({ placement: "inline" });

    expect(addListener).not.toHaveBeenCalled();
  });

  it("should still take typing and clear when it is inline", async () => {
    const onChangeText = jest.fn();
    const onClear = jest.fn();
    await renderField({
      placement: "inline",
      value: "chi",
      onChangeText,
      clear: { label: "Clear search", onPress: onClear },
    });

    await fireEvent.changeText(screen.getByRole("searchbox", { name: "Search recipes" }), "chic");
    await fireEvent.press(screen.getByRole("button", { name: "Clear search" }));

    expect(onChangeText).toHaveBeenCalledWith("chic");
    expect(onClear).toHaveBeenCalledTimes(1);
  });

  describe("disabled", () => {
    it("should stop taking text and say it is disabled", async () => {
      await renderField({ placement: "inline", disabled: true });

      const field = screen.getByRole("searchbox", { name: "Search recipes" });
      expect(field).toBeDisabled();
      expect(field).not.toBeEnabled();
    });

    it("should dim the field to 40 percent", async () => {
      await renderField({ placement: "inline", disabled: true });

      expect(viewsDrawn({ opacity: Math.fround(0.4) })).toHaveLength(1);
    });

    it("should not call itself disabled when it is not", async () => {
      await renderField({ placement: "inline" });

      expect(screen.getByRole("searchbox", { name: "Search recipes" })).toBeEnabled();
      expect(viewsDrawn({ opacity: Math.fround(0.4) })).toHaveLength(0);
    });
  });
});
