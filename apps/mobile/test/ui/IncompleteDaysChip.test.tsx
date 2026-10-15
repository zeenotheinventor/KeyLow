import { themes } from "@keylow/tokens";
import { render, screen, userEvent } from "@testing-library/react-native";

import { IncompleteDaysChip } from "../../components/ui";
import { ThemeProvider } from "../../lib/theme";
import { compileKitStyles } from "../support/kitStyles";
import { registerAppStyles } from "../support/nativeWindStyles";
import { resolvedColor } from "../support/themeColor";
import { viewsDrawn } from "../support/viewsDrawn";

import type { IncompleteDaysChipProps } from "../../components/ui";
import type { ThemeScheme } from "@keylow/tokens";

jest.mock("@react-native-async-storage/async-storage", () => ({
  __esModule: true,
  default: { getItem: () => Promise.resolve(null), setItem: () => Promise.resolve() },
}));

function renderChip(props: IncompleteDaysChipProps = {}, scheme: ThemeScheme = "dark") {
  return render(
    <ThemeProvider fixedPreference={scheme}>
      <IncompleteDaysChip {...props} />
    </ThemeProvider>,
  );
}

const schemes: ThemeScheme[] = ["dark", "light"];

describe("IncompleteDaysChip", () => {
  let kitStyles: string;

  beforeAll(async () => {
    kitStyles = await compileKitStyles();
  });

  beforeEach(() => {
    registerAppStyles(kitStyles);
  });

  describe("what it says", () => {
    it("should say all days are complete at zero", async () => {
      await renderChip({ count: 0 });

      expect(screen.getByText("All days complete this week")).toBeOnTheScreen();
    });

    it("should say the week is complete when no count is given", async () => {
      await renderChip();

      expect(screen.getByText("All days complete this week")).toBeOnTheScreen();
    });

    it("should count one incomplete day in the singular", async () => {
      await renderChip({ count: 1 });

      expect(screen.getByText("1 incomplete day this week")).toBeOnTheScreen();
    });

    it("should count several incomplete days in the plural", async () => {
      await renderChip({ count: 2 });

      expect(screen.getByText("2 incomplete days this week")).toBeOnTheScreen();
    });
  });

  describe("pressing", () => {
    it("should not be a button when it has nothing to do", async () => {
      await renderChip({ count: 2 });

      expect(screen.queryByRole("button")).not.toBeOnTheScreen();
    });

    it("should be a button named by its words when it can be pressed", async () => {
      const user = userEvent.setup();
      const onPress = jest.fn();
      await renderChip({ count: 2, onPress });

      await user.press(screen.getByRole("button", { name: "2 incomplete days this week" }));

      expect(onPress).toHaveBeenCalledTimes(1);
    });

    it("should reach a 44 point target past its 28 point height", async () => {
      await renderChip({ count: 2, onPress: () => undefined });

      expect(screen.getByRole("button", { name: "2 incomplete days this week" })).toHaveProp(
        "hitSlop",
        { top: 8, bottom: 8 },
      );
    });
  });

  describe.each(schemes)("in the %s scheme", (scheme) => {
    it("should draw a pill 28 points high in the warning fill while days are incomplete", async () => {
      await renderChip({ count: 1 }, scheme);
      await screen.findByText("1 incomplete day this week");

      expect(
        viewsDrawn({
          minHeight: 28,
          borderRadius: 999,
          backgroundColor: themes[scheme]["warning-muted"],
        }),
      ).toHaveLength(1);
    });

    it("should draw the pill in the success fill when none are", async () => {
      await renderChip({ count: 0 }, scheme);
      await screen.findByText("All days complete this week");

      expect(
        viewsDrawn({
          minHeight: 28,
          borderRadius: 999,
          backgroundColor: themes[scheme]["success-muted"],
        }),
      ).toHaveLength(1);
    });

    // Warning and success are too faint as light-mode text, so the words fall back to the primary text
    // colour there, as the badge does.
    it("should colour the words of a warning chip in the warning ink", async () => {
      await renderChip({ count: 1 }, scheme);

      expect(screen.getByText("1 incomplete day this week")).toHaveStyle({
        color: resolvedColor(scheme, scheme === "dark" ? "warning" : "text-primary"),
      });
    });

    it("should colour the words of a success chip in success in dark and the primary text colour in light", async () => {
      await renderChip({ count: 0 }, scheme);

      expect(screen.getByText("All days complete this week")).toHaveStyle({
        color: resolvedColor(scheme, scheme === "dark" ? "success" : "text-primary"),
      });
    });
  });
});
