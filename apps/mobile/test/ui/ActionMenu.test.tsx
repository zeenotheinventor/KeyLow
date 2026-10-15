import { themes } from "@keylow/tokens";
import { fireEvent, render, screen, within } from "@testing-library/react-native";

import { ActionMenu } from "../../components/ui";
import { ThemeProvider } from "../../lib/theme";
import { compileKitStyles } from "../support/kitStyles";
import { registerAppStyles } from "../support/nativeWindStyles";
import { resolvedColor } from "../support/themeColor";

import type { ActionMenuProps } from "../../components/ui";
import type { ThemeScheme } from "@keylow/tokens";

jest.mock("@react-native-async-storage/async-storage", () => ({
  __esModule: true,
  default: { getItem: () => Promise.resolve(null), setItem: () => Promise.resolve() },
}));

const schemes: ThemeScheme[] = ["dark", "light"];

// The icon is decoration, so its drawing is looked for, in the order the items are listed.
const drawings = () => screen.root?.queryAll((node) => node.type === "RNSVGSvgView") ?? [];

async function renderMenu(props: Partial<ActionMenuProps> = {}, scheme: ThemeScheme = "dark") {
  const copy = jest.fn();
  const remove = jest.fn();
  await render(
    <ThemeProvider fixedPreference={scheme}>
      <ActionMenu
        items={[
          { label: "Copy yesterday", icon: "Copy", onPress: copy },
          { label: "Delete day", icon: "Trash2", destructive: true, onPress: remove },
        ]}
        {...props}
      />
    </ThemeProvider>,
  );
  return { copy, remove };
}

// NativeWind keeps an opacity as a 32 bit float.
const dimmed = { opacity: Math.fround(0.4) };

describe("ActionMenu", () => {
  let kitStyles: string;

  beforeAll(async () => {
    kitStyles = await compileKitStyles();
  });

  beforeEach(() => {
    registerAppStyles(kitStyles);
  });

  describe("what it says", () => {
    it("should list the items as buttons named by their labels", async () => {
      await renderMenu();

      expect(screen.getByRole("button", { name: "Copy yesterday" })).toBeOnTheScreen();
      expect(screen.getByRole("button", { name: "Delete day" })).toBeOnTheScreen();
    });

    it("should head the menu with its title when it has one", async () => {
      await renderMenu({ title: "Day actions" });

      expect(screen.getByRole("heading", { name: "Day actions" })).toBeOnTheScreen();
    });

    it("should have no heading without a title", async () => {
      await renderMenu();

      expect(screen.queryByRole("heading")).not.toBeOnTheScreen();
    });

    it("should write an item's caption under its label and read it with the name", async () => {
      await renderMenu({
        items: [
          {
            label: "Copy yesterday",
            icon: "Copy",
            caption: "Nothing logged yesterday",
            onPress: jest.fn(),
          },
        ],
      });

      expect(screen.getByText("Nothing logged yesterday")).toBeOnTheScreen();
      expect(
        screen.getByRole("button", { name: "Copy yesterday, Nothing logged yesterday" }),
      ).toBeOnTheScreen();
    });
  });

  describe("pressing", () => {
    it("should call the item's onPress, and no other item's", async () => {
      const { copy, remove } = await renderMenu();

      await fireEvent.press(screen.getByRole("button", { name: "Copy yesterday" }));

      expect(copy).toHaveBeenCalledTimes(1);
      expect(remove).not.toHaveBeenCalled();
    });

    it("should not call onPress of a disabled item", async () => {
      const onPress = jest.fn();
      await renderMenu({
        items: [{ label: "Copy yesterday", icon: "Copy", disabled: true, onPress }],
      });
      const item = screen.getByRole("button", { name: "Copy yesterday" });

      expect(item).toBeDisabled();
      await fireEvent.press(item);

      expect(onPress).not.toHaveBeenCalled();
    });

    it("should leave an item enabled unless it is disabled", async () => {
      await renderMenu();

      expect(screen.getByRole("button", { name: "Copy yesterday" })).toBeEnabled();
    });
  });

  describe.each(schemes)("the look in %s", (scheme) => {
    it("should make each item 52 points high", async () => {
      await renderMenu({}, scheme);

      expect(screen.getByRole("button", { name: "Copy yesterday" })).toHaveStyle({
        minHeight: 52,
      });
    });

    it("should write a label in the primary text colour", async () => {
      await renderMenu({}, scheme);

      expect(screen.getByText("Copy yesterday")).toHaveStyle({
        color: resolvedColor(scheme, "text-primary"),
      });
    });

    // The status colours are never small text in light, where they are too faint (Q14): the label falls back
    // to the primary text colour and the danger colour stays on the icon, as a Badge does.
    it("should write a destructive item's label in the danger colour in dark and in the primary text in light", async () => {
      await renderMenu({}, scheme);

      expect(screen.getByText("Delete day")).toHaveStyle({
        color: resolvedColor(scheme, scheme === "dark" ? "danger" : "text-primary"),
      });
    });

    it("should dim a disabled item's label and icon but not its caption", async () => {
      await renderMenu(
        {
          items: [
            {
              label: "Copy yesterday",
              icon: "Copy",
              caption: "Nothing logged yesterday",
              disabled: true,
              onPress: jest.fn(),
            },
          ],
        },
        scheme,
      );
      const item = within(screen.getByRole("button", { name: /^Copy yesterday/ }));

      expect(item.getByText("Copy yesterday")).toHaveStyle(dimmed);
      expect(item.getByTestId("action-menu-icon", { includeHiddenElements: true })).toHaveStyle(
        dimmed,
      );
      expect(item.getByText("Nothing logged yesterday")).not.toHaveStyle(dimmed);
      expect(item.getByText("Nothing logged yesterday")).toHaveStyle({
        color: resolvedColor(scheme, "text-muted"),
      });
    });

    it("should draw an icon in the secondary text colour and a destructive item's in danger", async () => {
      await renderMenu({}, scheme);

      const [copyIcon, deleteIcon] = drawings();
      expect(copyIcon).toHaveProp("stroke", themes[scheme]["text-secondary"]);
      expect(deleteIcon).toHaveProp("stroke", themes[scheme].danger);
    });

    it("should not dim an enabled item", async () => {
      await renderMenu({}, scheme);

      expect(screen.getByText("Copy yesterday")).not.toHaveStyle(dimmed);
    });
  });
});
