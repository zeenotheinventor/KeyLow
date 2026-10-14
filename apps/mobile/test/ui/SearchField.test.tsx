import { themes } from "@keylow/tokens";
import { act, fireEvent, render, screen, userEvent } from "@testing-library/react-native";
import { useState } from "react";
import { Keyboard, Platform, View } from "react-native";
import { setUpTests } from "react-native-reanimated";

import { IconButton, SearchField } from "../../components/ui";
import { ThemeProvider } from "../../lib/theme";
import { compileKitStyles } from "../support/kitStyles";
import { registerAppStyles } from "../support/nativeWindStyles";
import { resolvedColor } from "../support/themeColor";
import { viewsDrawn } from "../support/viewsDrawn";

import type { SearchFieldProps } from "../../components/ui";
import type { ColorName, ThemeScheme } from "@keylow/tokens";

jest.mock("@react-native-async-storage/async-storage", () => ({
  __esModule: true,
  default: { getItem: () => Promise.resolve(null), setItem: () => Promise.resolve() },
}));

setUpTests();

const defaultProps: SearchFieldProps = {
  label: "Search foods",
  placeholder: "Search for a food",
  value: "",
  onChangeText: () => undefined,
};

const scanControl = (
  <IconButton icon="ScanBarcode" label="Scan barcode" size="sm" variant="ghost" />
);

function renderField(props: Partial<SearchFieldProps> = {}, scheme: ThemeScheme = "dark") {
  return render(
    <ThemeProvider fixedPreference={scheme}>
      <SearchField {...defaultProps} {...props} />
    </ThemeProvider>,
  );
}

// A field that keeps what is typed, as a screen does.
function TypingField(props: Partial<SearchFieldProps>) {
  const [value, setValue] = useState("");
  return (
    <ThemeProvider fixedPreference="dark">
      <SearchField {...defaultProps} {...props} value={value} onChangeText={setValue} />
    </ThemeProvider>
  );
}

// Icons are decoration and have no role to query by, so their drawings are counted.
function drawings() {
  return screen.root?.queryAll((node) => node.type === "RNSVGSvgView") ?? [];
}

const schemes: ThemeScheme[] = ["dark", "light"];

type KeyboardListener = Parameters<typeof Keyboard.addListener>[1];

// The keyboard's announcement, with the one edge the dock reads.
const keyboardEvent = (screenY: number) => ({
  duration: 0,
  easing: "keyboard" as const,
  endCoordinates: { screenX: 0, screenY, width: 390, height: 300 },
});

// What `Keyboard.addListener` hands back. A listener only ever calls `remove` on it, so that is all it
// has, and the full emitter subscription is not built.
function subscription(remove: () => void) {
  return { remove } as ReturnType<typeof Keyboard.addListener>;
}

// Stands in for the keyboard and for the window the dock is measured in. The dock's bottom edge is
// `dockBottom` points down the window, and the keyboard's top edge is `keyboardTop`.
function stubKeyboard(dockBottom: number, { deferMeasure = false } = {}) {
  const listeners = new Map<string, KeyboardListener>();
  const unansweredMeasures: (() => void)[] = [];
  jest.spyOn(Keyboard, "addListener").mockImplementation((eventName, listener) => {
    listeners.set(eventName, listener);
    return subscription(() => listeners.delete(eventName));
  });
  // Every view shares one mocked measure, on the class, so the dock's is the one set here. A real
  // measure answers later, so `deferMeasure` holds the answers until the test lets them through.
  jest
    .spyOn(View.prototype, "measureInWindow")
    .mockImplementation((callback: (...edges: number[]) => void) => {
      const answer = () => {
        callback(0, dockBottom - 64, 390, 64);
      };
      if (deferMeasure) {
        unansweredMeasures.push(answer);
      } else {
        answer();
      }
    });
  const showName = Platform.OS === "ios" ? "keyboardWillShow" : "keyboardDidShow";
  const hideName = Platform.OS === "ios" ? "keyboardWillHide" : "keyboardDidHide";
  const announce = (eventName: string, keyboardTop: number) =>
    act(() => {
      listeners.get(eventName)?.(keyboardEvent(keyboardTop));
    });
  return {
    show: (keyboardTop: number) => announce(showName, keyboardTop),
    hide: () => announce(hideName, 0),
    // iOS also announces the keyboard changing height while it is shown.
    changeFrame: (keyboardTop: number) => announce("keyboardWillChangeFrame", keyboardTop),
    answerMeasures: () =>
      act(() => {
        // Answered newest first, as the slow ones can come back after the fast.
        unansweredMeasures
          .splice(0)
          .reverse()
          .forEach((answer) => {
            answer();
          });
      }),
  };
}

describe("SearchField", () => {
  let kitStyles: string;

  beforeAll(async () => {
    kitStyles = await compileKitStyles();
  });

  beforeEach(() => {
    registerAppStyles(kitStyles);
  });

  describe("the field", () => {
    it("should be a search box named by its label", async () => {
      await renderField();

      expect(screen.getByRole("searchbox", { name: "Search foods" })).toBeOnTheScreen();
    });

    it("should show its placeholder while it is empty", async () => {
      await renderField();

      expect(screen.getByPlaceholderText("Search for a food")).toBeOnTheScreen();
    });

    it("should show what it holds", async () => {
      await renderField({ value: "stock cubes" });

      expect(screen.getByDisplayValue("stock cubes")).toBeOnTheScreen();
    });

    it("should hand on what is typed", async () => {
      const onChangeText = jest.fn();
      await renderField({ onChangeText });

      await fireEvent.changeText(screen.getByRole("searchbox", { name: "Search foods" }), "oats");

      expect(onChangeText).toHaveBeenCalledWith("oats");
    });

    it("should hand on a submit from the keyboard", async () => {
      const onSubmitEditing = jest.fn();
      await renderField({ onSubmitEditing });

      await fireEvent(screen.getByRole("searchbox", { name: "Search foods" }), "submitEditing");

      expect(onSubmitEditing).toHaveBeenCalledTimes(1);
    });

    it("should ask the keyboard for a search key and leave the text as typed", async () => {
      await renderField();

      expect(screen.getByRole("searchbox", { name: "Search foods" })).toHaveProp(
        "returnKeyType",
        "search",
      );
      expect(screen.getByRole("searchbox", { name: "Search foods" })).toHaveProp(
        "autoCapitalize",
        "none",
      );
      expect(screen.getByRole("searchbox", { name: "Search foods" })).toHaveProp(
        "autoCorrect",
        false,
      );
    });

    it("should draw a search icon at its start", async () => {
      await renderField();

      expect(drawings()).toHaveLength(1);
    });
  });

  describe("above the keyboard", () => {
    const dockLifted = (lift: number) => viewsDrawn({ paddingBottom: lift, borderTopWidth: 1 });

    afterEach(() => {
      jest.restoreAllMocks();
    });

    it("should sit on the bottom edge while the keyboard is closed", async () => {
      stubKeyboard(800);
      await renderField();

      expect(dockLifted(0)).toHaveLength(1);
    });

    it("should rise by as much of the dock as the keyboard covers", async () => {
      const keyboard = stubKeyboard(800);
      await renderField();

      await keyboard.show(560);

      expect(dockLifted(240)).toHaveLength(1);
    });

    it("should not rise when the keyboard stops short of it", async () => {
      const keyboard = stubKeyboard(500);
      await renderField();

      await keyboard.show(560);

      expect(dockLifted(0)).toHaveLength(1);
    });

    it("should come back down when the keyboard goes", async () => {
      const keyboard = stubKeyboard(800);
      await renderField();
      await keyboard.show(560);

      await keyboard.hide();

      expect(dockLifted(0)).toHaveLength(1);
    });

    it("should follow the keyboard changing height while it is shown", async () => {
      const keyboard = stubKeyboard(800);
      await renderField();
      await keyboard.show(560);

      await keyboard.changeFrame(500);

      expect(dockLifted(300)).toHaveLength(1);
    });

    it("should stay down when the keyboard goes before the measure of its arrival answers", async () => {
      const keyboard = stubKeyboard(800, { deferMeasure: true });
      await renderField();
      await keyboard.show(560);
      await keyboard.hide();

      await keyboard.answerMeasures();

      expect(dockLifted(0)).toHaveLength(1);
    });

    it("should use the newest measure when an older one answers last", async () => {
      const keyboard = stubKeyboard(800, { deferMeasure: true });
      await renderField();
      await keyboard.show(560);
      await keyboard.changeFrame(500);

      await keyboard.answerMeasures();

      expect(dockLifted(300)).toHaveLength(1);
    });

    it("should stop listening when it goes away", async () => {
      const remove = jest.fn();
      jest.spyOn(Keyboard, "addListener").mockReturnValue(subscription(remove));
      const view = await renderField();

      await view.unmount();

      expect(remove).toHaveBeenCalledTimes(Platform.OS === "ios" ? 3 : 2);
    });
  });

  describe("the trailing slot", () => {
    it("should hold the control it is given", async () => {
      await renderField({ trailing: scanControl });

      expect(screen.getByRole("button", { name: "Scan barcode" })).toBeOnTheScreen();
    });
  });

  describe("the clear control", () => {
    const clear = { label: "Clear search", onPress: jest.fn() };

    beforeEach(() => {
      clear.onPress.mockClear();
    });

    it("should not be there unless the screen asks for one", async () => {
      await renderField({ value: "oats" });

      expect(screen.queryByRole("button", { name: "Clear search" })).not.toBeOnTheScreen();
    });

    it("should not be there while the field is empty", async () => {
      await renderField({ clear });

      expect(screen.queryByRole("button", { name: "Clear search" })).not.toBeOnTheScreen();
    });

    it("should come with the first character, and go with the last", async () => {
      const user = userEvent.setup();
      await render(<TypingField clear={clear} />);
      expect(screen.queryByRole("button", { name: "Clear search" })).not.toBeOnTheScreen();

      await user.type(screen.getByRole("searchbox", { name: "Search foods" }), "o");
      expect(screen.getByRole("button", { name: "Clear search" })).toBeOnTheScreen();

      await user.clear(screen.getByRole("searchbox", { name: "Search foods" }));
      expect(screen.queryByRole("button", { name: "Clear search" })).not.toBeOnTheScreen();
    });

    it("should call its callback when pressed", async () => {
      const user = userEvent.setup();
      await renderField({ value: "oats", clear });

      await user.press(screen.getByRole("button", { name: "Clear search" }));

      expect(clear.onPress).toHaveBeenCalledTimes(1);
    });

    it("should sit before the trailing control", async () => {
      await renderField({ value: "oats", clear, trailing: scanControl });

      const [first, second] = screen.getAllByRole("button");
      expect(first).toHaveAccessibleName("Clear search");
      expect(second).toHaveAccessibleName("Scan barcode");
    });
  });

  describe.each(schemes)("in the %s scheme", (scheme) => {
    const colorOf = (name: ColorName) => resolvedColor(scheme, name);

    it("should be a 44 point box on the raised surface with a border, rounded medium", async () => {
      await renderField({}, scheme);
      await screen.findByRole("searchbox", { name: "Search foods" });

      const [box] = viewsDrawn({
        backgroundColor: colorOf("surface-raised"),
        borderColor: colorOf("border"),
        height: 44,
        borderRadius: 12,
        borderWidth: 1,
      });
      expect(box).toHaveStyle({
        flexDirection: "row",
        alignItems: "center",
        paddingLeft: 16,
        paddingRight: 4,
        columnGap: 8,
      });
    });

    it("should turn its border to the accent while it has focus, and back when it loses it", async () => {
      await renderField({}, scheme);
      const field = await screen.findByRole("searchbox", { name: "Search foods" });
      expect(viewsDrawn({ borderColor: colorOf("accent"), height: 44 })).toHaveLength(0);

      await fireEvent(field, "focus");
      expect(viewsDrawn({ borderColor: colorOf("accent"), height: 44 })).toHaveLength(1);

      await fireEvent(field, "blur");
      expect(viewsDrawn({ borderColor: colorOf("accent"), height: 44 })).toHaveLength(0);
    });

    it("should write in the primary text colour in Geist regular at 16, in a 40 point input", async () => {
      await renderField({ value: "oats" }, scheme);

      expect(await screen.findByRole("searchbox", { name: "Search foods" })).toHaveStyle({
        color: colorOf("text-primary"),
        fontFamily: "Geist-Regular",
        fontSize: 16,
        height: 40,
      });
    });

    it("should draw its placeholder and its search icon in the muted text colour", async () => {
      await renderField({}, scheme);

      expect(await screen.findByPlaceholderText("Search for a food")).toHaveProp(
        "placeholderTextColor",
        themes[scheme]["text-muted"],
      );
      expect(drawings()[0]).toHaveProp("stroke", themes[scheme]["text-muted"]);
    });

    it("should be docked: a hairline above it on the background, padded 16 across, 8 above and 12 below", async () => {
      await renderField({}, scheme);
      await screen.findByRole("searchbox", { name: "Search foods" });

      expect(
        viewsDrawn({
          backgroundColor: colorOf("background"),
          borderTopWidth: 1,
          borderColor: colorOf("border"),
        }),
      ).toHaveLength(1);
      expect(
        viewsDrawn({ paddingLeft: 16, paddingRight: 16, paddingTop: 8, paddingBottom: 12 }),
      ).toHaveLength(1);
    });
  });
});
