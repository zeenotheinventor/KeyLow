import { controlHeight, iconSize, touchTarget } from "@keylow/tokens";
import { render, screen, userEvent } from "@testing-library/react-native";
import { AccessibilityInfo } from "react-native";
import { setUpTests } from "react-native-reanimated";

import { Button, SheetHeader, Text } from "../../components/ui";
import { ThemeProvider } from "../../lib/theme";
import { compileKitStyles } from "../support/kitStyles";
import { registerAppStyles } from "../support/nativeWindStyles";
import { resolvedColor } from "../support/themeColor";

import type { SheetHeaderProps } from "../../components/ui";
import type { ThemeScheme } from "@keylow/tokens";

jest.mock("@react-native-async-storage/async-storage", () => ({
  __esModule: true,
  default: { getItem: () => Promise.resolve(null), setItem: () => Promise.resolve() },
}));

setUpTests();

const searchHeader: SheetHeaderProps = {
  title: "Find food",
  leading: { icon: "X", label: "Close", onPress: () => undefined },
  trailing: { icon: "Plus", label: "Create a food", onPress: () => undefined },
};

const stackHeader: SheetHeaderProps = {
  variant: "stack",
  title: "New food",
  leading: { icon: "ChevronLeft", label: "Back", onPress: () => undefined },
  trailing: { icon: "X", label: "Close", onPress: () => undefined },
};

function renderHeader(props: SheetHeaderProps, scheme: ThemeScheme = "dark") {
  return render(
    <ThemeProvider fixedPreference={scheme}>
      <SheetHeader {...props} />
    </ThemeProvider>,
  );
}

// An icon in a button is decoration and has no role to query by, so its drawing is looked for.
function drawings() {
  return screen.root?.queryAll((node) => node.type === "RNSVGSvgView") ?? [];
}

// The header's padding is on a plain row with no role, and the empty slot is a spacer. Both are found by
// ids, which exist for this and nothing else.

// What NativeWind resolves a transparent class to.
const transparent = "#00000000";

const schemes: ThemeScheme[] = ["dark", "light"];

function expectButtonsInOrder(names: readonly string[]) {
  const buttons = screen.getAllByRole("button");
  expect(buttons).toHaveLength(names.length);
  names.forEach((name, position) => {
    expect(buttons[position]).toHaveAccessibleName(name);
  });
}

describe("SheetHeader", () => {
  let kitStyles: string;

  beforeAll(async () => {
    kitStyles = await compileKitStyles();
  });

  beforeEach(() => {
    registerAppStyles(kitStyles);
    jest.spyOn(AccessibilityInfo, "isReduceMotionEnabled").mockResolvedValue(false);
  });

  afterEach(() => {
    jest.restoreAllMocks();
  });

  describe("the sheet header, which heads the search sheet", () => {
    it("should head the sheet with its title between a close control and a create control", async () => {
      await renderHeader(searchHeader);

      expect(screen.getByRole("heading", { name: "Find food" })).toBeOnTheScreen();
      expect(screen.getByRole("button", { name: "Close" })).toBeOnTheScreen();
      expect(screen.getByRole("button", { name: "Create a food" })).toBeOnTheScreen();
    });

    it("should call the handler of the control that is pressed", async () => {
      const user = userEvent.setup();
      const onClose = jest.fn();
      const onCreate = jest.fn();
      await renderHeader({
        ...searchHeader,
        leading: { icon: "X", label: "Close", onPress: onClose },
        trailing: { icon: "Plus", label: "Create a food", onPress: onCreate },
      });

      await user.press(screen.getByRole("button", { name: "Create a food" }));
      expect(onCreate).toHaveBeenCalledTimes(1);
      expect(onClose).not.toHaveBeenCalled();

      await user.press(screen.getByRole("button", { name: "Close" }));
      expect(onClose).toHaveBeenCalledTimes(1);
    });

    it("should set the title in the h2 style, centred", async () => {
      await renderHeader(searchHeader);

      expect(screen.getByRole("heading", { name: "Find food" })).toHaveStyle({
        fontSize: 20,
        lineHeight: 26,
        textAlign: "center",
      });
    });

    it("should draw 20 point icons in 44 point raised, bordered controls", async () => {
      await renderHeader(searchHeader);

      expect(drawings()).toHaveLength(2);
      for (const drawing of drawings()) {
        expect(drawing).toHaveProp("width", iconSize.md);
      }
      expect(screen.getByRole("button", { name: "Close" })).toHaveStyle({
        height: controlHeight.md,
        width: touchTarget,
        borderWidth: 1,
      });
    });

    it("should give 16 points at the sides and 12 above and below", async () => {
      await renderHeader(searchHeader);

      expect(screen.getByTestId("sheet-header")).toHaveStyle({
        paddingLeft: 16,
        paddingRight: 16,
        paddingTop: 12,
        paddingBottom: 12,
      });
    });
  });

  describe("the stack header, which heads a view inside the sheet", () => {
    it("should head the view with its title between a back control and a close control", async () => {
      await renderHeader(stackHeader);

      expect(screen.getByRole("heading", { name: "New food" })).toBeOnTheScreen();
      expect(screen.getByRole("button", { name: "Back" })).toBeOnTheScreen();
      expect(screen.getByRole("button", { name: "Close" })).toBeOnTheScreen();
    });

    it("should set the title in strong body text, centred", async () => {
      await renderHeader(stackHeader);

      expect(screen.getByRole("heading", { name: "New food" })).toHaveStyle({
        fontFamily: "Geist-SemiBold",
        fontSize: 16,
        lineHeight: 24,
        textAlign: "center",
      });
    });

    it("should draw the back icon at 24 points and the close icon at 22, as the frames do", async () => {
      await renderHeader(stackHeader);

      const [back, close] = drawings();
      expect(back).toHaveProp("width", iconSize.lg);
      expect(close).toHaveProp("width", 22);
    });

    it("should draw 44 point controls with no fill and no border", async () => {
      await renderHeader(stackHeader);

      const back = screen.getByRole("button", { name: "Back" });
      expect(back).toHaveStyle({ height: controlHeight.md, width: touchTarget });
      expect(back.props.style).not.toHaveProperty("borderWidth", 1);
    });

    it("should give 16 points at the sides, 12 above and 8 below", async () => {
      await renderHeader(stackHeader);

      expect(screen.getByTestId("sheet-header")).toHaveStyle({
        paddingLeft: 16,
        paddingRight: 16,
        paddingTop: 12,
        paddingBottom: 8,
      });
    });

    it("should leave the title out of the headings when the view has its own, as the food detail does", async () => {
      await renderHeader({ ...stackHeader, title: "Food", isTitleHeading: false });

      expect(screen.queryByRole("heading")).not.toBeOnTheScreen();
      expect(screen.getByText("Food")).toBeOnTheScreen();
    });
  });

  describe("without a trailing control", () => {
    it("should draw only the leading control, and keep the title in the middle", async () => {
      await renderHeader({ ...searchHeader, trailing: undefined });

      expect(screen.getAllByRole("button")).toHaveLength(1);
      expect(screen.getByRole("heading", { name: "Find food" })).toBeOnTheScreen();
      // The title is centred by two slots of one width, so the empty one still takes its 44 points.
      expect(screen.getByTestId("sheet-header-empty-slot")).toHaveStyle({ width: touchTarget });
    });
  });

  describe("without a leading control, as the first step of the setup has it", () => {
    const withoutLeading: SheetHeaderProps = {
      title: "About you",
      subtitle: "Step 1 of 8",
      trailing: undefined,
    };

    it("should draw no control at all when it has no leading and no trailing control", async () => {
      await renderHeader(withoutLeading);

      expect(screen.queryByRole("button")).not.toBeOnTheScreen();
      expect(screen.getByRole("heading", { name: "About you" })).toBeOnTheScreen();
      expect(screen.getByText("Step 1 of 8")).toBeOnTheScreen();
    });

    it("should keep the empty 44 point slot at the left, so the title stays centred", async () => {
      await renderHeader(withoutLeading);

      expect(screen.getByTestId("sheet-header-leading-empty-slot")).toHaveStyle({
        width: touchTarget,
      });
      // The two slots are one width, so the title sits in the middle of the header.
      expect(screen.getByTestId("sheet-header-empty-slot")).toHaveStyle({ width: touchTarget });
    });

    it("should draw only the close control at the right, as recalculate's first step has", async () => {
      await renderHeader({
        ...withoutLeading,
        trailing: { icon: "X", label: "Close", onPress: () => undefined },
      });

      expectButtonsInOrder(["Close"]);
      expect(screen.getByTestId("sheet-header-leading-empty-slot")).toBeOnTheScreen();
      expect(screen.queryByTestId("sheet-header-empty-slot")).not.toBeOnTheScreen();
    });

    it("should call the handler of the close control that is pressed", async () => {
      const user = userEvent.setup();
      const onClose = jest.fn();
      await renderHeader({
        ...withoutLeading,
        trailing: { icon: "X", label: "Close", onPress: onClose },
      });

      await user.press(screen.getByRole("button", { name: "Close" }));

      expect(onClose).toHaveBeenCalledTimes(1);
    });

    it("should draw the empty slot in the stack header too", async () => {
      await renderHeader({ ...withoutLeading, variant: "stack" });

      expect(screen.getByTestId("sheet-header-leading-empty-slot")).toHaveStyle({
        width: touchTarget,
      });
    });

    it("should draw no empty slot at the left when there is a leading control", async () => {
      await renderHeader(searchHeader);

      expect(screen.queryByTestId("sheet-header-leading-empty-slot")).not.toBeOnTheScreen();
    });
  });

  describe("with two trailing controls, as the recipe view has Edit and More", () => {
    const editAndMore = [
      { icon: "Pencil", label: "Edit Chicken and rice", onPress: () => undefined },
      { icon: "Ellipsis", label: "More", onPress: () => undefined },
    ] as const;

    it("should draw both controls after the title, each reachable by its name", async () => {
      await renderHeader({ ...stackHeader, title: "Chicken and rice", trailing: editAndMore });

      expect(screen.getByRole("heading", { name: "Chicken and rice" })).toBeOnTheScreen();
      expect(screen.getByRole("button", { name: "Back" })).toBeOnTheScreen();
      expect(screen.getByRole("button", { name: "Edit Chicken and rice" })).toBeOnTheScreen();
      expect(screen.getByRole("button", { name: "More" })).toBeOnTheScreen();
      expect(screen.getAllByRole("button")).toHaveLength(3);
    });

    it("should draw the pair in the sheet header's look: 20 point icons in raised, bordered buttons", async () => {
      await renderHeader({ ...searchHeader, title: "Chicken and rice", trailing: editAndMore });

      expect(drawings()).toHaveLength(3);
      for (const drawing of drawings()) {
        expect(drawing).toHaveProp("width", iconSize.md);
      }
      for (const name of ["Edit Chicken and rice", "More"]) {
        expect(screen.getByRole("button", { name })).toHaveStyle({
          height: controlHeight.md,
          width: touchTarget,
          borderWidth: 1,
        });
      }
    });

    it("should call the handler of the control that is pressed", async () => {
      const user = userEvent.setup();
      const onEdit = jest.fn();
      const onMore = jest.fn();
      await renderHeader({
        ...stackHeader,
        trailing: [
          { icon: "Pencil", label: "Edit Chicken and rice", onPress: onEdit },
          { icon: "Ellipsis", label: "More", onPress: onMore },
        ],
      });

      await user.press(screen.getByRole("button", { name: "More" }));
      expect(onMore).toHaveBeenCalledTimes(1);
      expect(onEdit).not.toHaveBeenCalled();

      await user.press(screen.getByRole("button", { name: "Edit Chicken and rice" }));
      expect(onEdit).toHaveBeenCalledTimes(1);
    });

    it("should sit the two controls side by side with 8 points between them, 44 points each", async () => {
      await renderHeader({ ...stackHeader, trailing: editAndMore });

      expect(screen.getByTestId("sheet-header-trailing")).toHaveStyle({
        flexDirection: "row",
        columnGap: 8,
      });
      for (const name of ["Edit Chicken and rice", "More"]) {
        expect(screen.getByRole("button", { name })).toHaveStyle({
          height: controlHeight.md,
          width: touchTarget,
        });
      }
    });

    it("should not draw the empty slot, because the controls fill it", async () => {
      await renderHeader({ ...stackHeader, trailing: editAndMore });

      expect(screen.queryByTestId("sheet-header-empty-slot")).not.toBeOnTheScreen();
    });

    it("should keep a long title to one line, truncated, in the space the controls leave", async () => {
      const title = "Slow cooked chicken and rice with spinach and a very long name";
      await renderHeader({ ...stackHeader, title, trailing: editAndMore });

      const heading = screen.getByRole("heading", { name: title });
      expect(heading).toHaveProp("numberOfLines", 1);
      expect(heading).toHaveStyle({ flexGrow: 1, textAlign: "center" });
    });

    it("should say a disabled control is disabled and not call its handler", async () => {
      const user = userEvent.setup();
      const onEdit = jest.fn();
      const onMore = jest.fn();
      await renderHeader({
        ...stackHeader,
        trailing: [
          { icon: "Pencil", label: "Edit Chicken and rice", disabled: true, onPress: onEdit },
          { icon: "Ellipsis", label: "More", disabled: true, onPress: onMore },
        ],
      });

      const edit = screen.getByRole("button", { name: "Edit Chicken and rice" });
      expect(edit).toBeDisabled();
      // NativeWind hands the opacity over as a 32 bit float.
      expect(edit).toHaveStyle({ opacity: Math.fround(0.4) });
      expect(screen.getByRole("button", { name: "More" })).toBeDisabled();

      await user.press(edit);
      await user.press(screen.getByRole("button", { name: "More" }));
      expect(onEdit).not.toHaveBeenCalled();
      expect(onMore).not.toHaveBeenCalled();
    });

    it("should leave a control that is not disabled enabled", async () => {
      await renderHeader({ ...stackHeader, trailing: editAndMore });

      expect(screen.getByRole("button", { name: "More" })).toBeEnabled();
    });
  });

  it("should disable a single trailing control too", async () => {
    const onPress = jest.fn();
    await renderHeader({
      ...searchHeader,
      trailing: { icon: "Plus", label: "Create a food", disabled: true, onPress },
    });

    expect(screen.getByRole("button", { name: "Create a food" })).toBeDisabled();
  });

  it("should keep a long title to one line", async () => {
    await renderHeader({ ...searchHeader, title: "A very long name for a food somebody saved" });

    expect(
      screen.getByRole("heading", { name: "A very long name for a food somebody saved" }),
    ).toHaveProp("numberOfLines", 1);
  });

  describe.each(schemes)("in the %s scheme", (scheme) => {
    it("should draw the sheet header's controls on the raised surface", async () => {
      await renderHeader(searchHeader, scheme);

      expect(await screen.findByRole("button", { name: "Close" })).toHaveStyle({
        backgroundColor: resolvedColor(scheme, "surface-raised"),
        borderColor: resolvedColor(scheme, "border"),
      });
    });

    it("should draw the stack header's controls clear", async () => {
      await renderHeader(stackHeader, scheme);

      expect(await screen.findByRole("button", { name: "Back" })).toHaveStyle({
        backgroundColor: transparent,
      });
    });

    it("should set the title in the primary text colour", async () => {
      await renderHeader(searchHeader, scheme);

      expect(await screen.findByRole("heading", { name: "Find food" })).toHaveStyle({
        color: resolvedColor(scheme, "text-primary"),
      });
    });
  });

  describe("a subtitle and a trailing slot", () => {
    it("should draw the subtitle under the title, and keep the title as the heading", async () => {
      await renderHeader({
        ...searchHeader,
        trailing: undefined,
        subtitle: "30:00 · 8 of 16 sets",
      });

      expect(screen.getByRole("heading", { name: "Find food" })).toBeOnTheScreen();
      expect(screen.getByText("30:00 · 8 of 16 sets")).toBeOnTheScreen();
    });

    it("should draw the trailing slot in place of the empty slot when there is no trailing control", async () => {
      await renderHeader({
        ...searchHeader,
        trailing: undefined,
        trailingSlot: <Text>Finish</Text>,
      });

      expect(screen.getByText("Finish")).toBeOnTheScreen();
      expect(screen.queryByTestId("sheet-header-empty-slot")).not.toBeOnTheScreen();
    });

    it("should draw a trailing control first and the slot after it, as the routine editor has More and Save", async () => {
      await renderHeader({
        ...searchHeader,
        leading: { icon: "ChevronLeft", label: "Cancel editing", onPress: () => undefined },
        trailing: { icon: "Ellipsis", label: "More for this routine", onPress: () => undefined },
        trailingSlot: <Button size="sm">Save</Button>,
      });

      expectButtonsInOrder(["Cancel editing", "More for this routine", "Save"]);
      expect(screen.queryByTestId("sheet-header-empty-slot")).not.toBeOnTheScreen();
      expect(screen.getByRole("heading", { name: "Find food" })).toBeOnTheScreen();
    });

    it("should draw a pair of trailing controls first and the slot after them", async () => {
      await renderHeader({
        ...searchHeader,
        trailing: [
          { icon: "Pencil", label: "Edit Chicken and rice", onPress: () => undefined },
          { icon: "Ellipsis", label: "More", onPress: () => undefined },
        ],
        trailingSlot: <Button size="sm">Save</Button>,
      });

      expectButtonsInOrder(["Close", "Edit Chicken and rice", "More", "Save"]);
    });

    it("should leave the empty slot as it was when neither is given", async () => {
      await renderHeader({ ...searchHeader, trailing: undefined });

      expect(screen.getByTestId("sheet-header-empty-slot")).toBeOnTheScreen();
    });
  });
});
