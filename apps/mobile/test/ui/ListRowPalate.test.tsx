import { render, screen, userEvent } from "@testing-library/react-native";
import { AccessibilityInfo } from "react-native";
import { setUpTests } from "react-native-reanimated";

import { GroupedList, ListRow } from "../../components/ui";
import { ThemeProvider } from "../../lib/theme";
import { compileKitStyles } from "../support/kitStyles";
import { registerAppStyles } from "../support/nativeWindStyles";

import type { ListRowProps } from "../../components/ui";

// The options the palate lists use: a trailing action with its own accessible name, a snug row that wraps its
// title, the accent title and a row that is a link.

jest.mock("@react-native-async-storage/async-storage", () => ({
  __esModule: true,
  default: { getItem: () => Promise.resolve(null), setItem: () => Promise.resolve() },
}));

setUpTests();

async function renderRow(props: ListRowProps) {
  const user = userEvent.setup();
  await render(
    <ThemeProvider fixedPreference="dark">
      <GroupedList title="Usual foods">
        <ListRow {...props} />
      </GroupedList>
    </ThemeProvider>,
  );
  return user;
}

describe("ListRow options for the palate lists", () => {
  let kitStyles: string;

  beforeAll(async () => {
    kitStyles = await compileKitStyles();
  });

  beforeEach(() => {
    jest.useFakeTimers();
    registerAppStyles(kitStyles);
    jest.spyOn(AccessibilityInfo, "isReduceMotionEnabled").mockResolvedValue(false);
  });

  afterEach(() => {
    jest.useRealTimers();
    jest.restoreAllMocks();
  });

  describe("a trailing action's accessible name", () => {
    it("should name the button as given, and press it", async () => {
      const onPress = jest.fn();
      const user = await renderRow({
        title: "Eggs",
        trailing: { kind: "action", label: "Not true", accessibleName: "Not true: Eggs", onPress },
      });

      await user.press(screen.getByRole("button", { name: "Not true: Eggs" }));

      expect(onPress).toHaveBeenCalledTimes(1);
    });

    it("should keep the label and title name when none is given", async () => {
      await renderRow({
        title: "Eggs",
        trailing: { kind: "action", label: "Undo", onPress: () => undefined },
      });

      expect(screen.getByRole("button", { name: "Undo, Eggs" })).toBeOnTheScreen();
    });
  });

  describe("the snug density", () => {
    it("should let the title wrap, where the usual row cuts it to one line", async () => {
      await renderRow({
        title: "Apples, eating, raw, flesh and skin",
        density: "snug",
        trailing: { kind: "action", label: "Not true", onPress: () => undefined },
      });

      expect(screen.getByText("Apples, eating, raw, flesh and skin").props.numberOfLines).toBe(
        undefined,
      );
    });

    it("should cut the title to one line without it", async () => {
      await renderRow({
        title: "Apples, eating, raw, flesh and skin",
        trailing: { kind: "action", label: "Not true", onPress: () => undefined },
      });

      expect(screen.getByText("Apples, eating, raw, flesh and skin").props.numberOfLines).toBe(1);
    });
  });

  describe("the accent title", () => {
    it("should draw the title as the row's name and press the row", async () => {
      const onPress = jest.fn();
      const user = await renderRow({ title: "Show all 10", titleTone: "accent", onPress });

      await user.press(screen.getByRole("button", { name: "Show all 10" }));

      expect(onPress).toHaveBeenCalledTimes(1);
    });
  });

  describe("the link role", () => {
    it("should announce a row that goes to another screen as a link", async () => {
      await renderRow({
        title: "Foods to avoid",
        subtitle: "None yet",
        role: "link",
        onPress: () => undefined,
      });

      expect(screen.getByRole("link", { name: "Foods to avoid, None yet" })).toBeOnTheScreen();
      expect(screen.queryByRole("button", { name: /Foods to avoid/ })).not.toBeOnTheScreen();
    });

    it("should stay a button without a role", async () => {
      await renderRow({ title: "Foods to avoid", onPress: () => undefined });

      expect(screen.getByRole("button", { name: "Foods to avoid" })).toBeOnTheScreen();
    });
  });
});
