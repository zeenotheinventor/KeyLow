import { fireEvent, render, screen, within } from "@testing-library/react-native";

import { FoodRow, HourRow } from "../../components/ui";
import { ThemeProvider } from "../../lib/theme";
import { compileKitStyles } from "../support/kitStyles";
import { registerAppStyles } from "../support/nativeWindStyles";
import { expectTextsInOrder } from "../support/textsInOrder";
import { resolvedColor } from "../support/themeColor";
import { viewsDrawn } from "../support/viewsDrawn";

import type { HourRowProps } from "../../components/ui";
import type { ThemeScheme } from "@keylow/tokens";

jest.mock("@react-native-async-storage/async-storage", () => ({
  __esModule: true,
  default: { getItem: () => Promise.resolve(null), setItem: () => Promise.resolve() },
}));

// The foods are what @keylow/core writes for the sample day of the boards.
function loggedFood(name: string, caption: string) {
  return (
    <FoodRow
      key={name}
      caption={caption}
      energy="95"
      layout="diary"
      macros={{
        protein: "1.2",
        carbs: "20.3",
        fat: "0.1",
        description: "protein 1.2 grams, fat 0.1 grams, carbohydrate 20.3 grams",
      }}
      nameSegments={[{ text: name, matched: false }]}
      onPress={() => undefined}
    />
  );
}

const porridge = loggedFood("Porridge oats", "08:05 · 50 g");
const milk = loggedFood("Semi-skimmed milk", "08:05 · 200 ml");

type RowOptions = Partial<HourRowProps> & { scheme?: ThemeScheme };

async function renderHourRow({ scheme = "dark", ...props }: RowOptions = {}) {
  const onAdd = jest.fn();
  await render(
    <ThemeProvider fixedPreference={scheme}>
      <HourRow hour={8} isNow={false} label="08:00" onAdd={onAdd} {...props} />
    </ThemeProvider>,
  );
  return { onAdd };
}

const schemes: ThemeScheme[] = ["dark", "light"];

// A list item is not an accessibility element, or a screen reader could not reach the buttons inside it, so
// a role query cannot see it and it is found by its name, which core writes from the hour and its foods.
const hourItem = (name = /^08:00, /) => screen.getByLabelText(name);

describe("HourRow", () => {
  let kitStyles: string;

  beforeAll(async () => {
    kitStyles = await compileKitStyles();
  });

  beforeEach(() => {
    registerAppStyles(kitStyles);
  });

  describe("the add button", () => {
    it("should be a button named by core, such as Add food at 08:00", async () => {
      await renderHourRow();

      expect(screen.getByRole("button", { name: "Add food at 08:00" })).toBeOnTheScreen();
    });

    it("should call onAdd with the hour number when it is pressed", async () => {
      const { onAdd } = await renderHourRow({ hour: 8, label: "08:00" });

      await fireEvent.press(screen.getByRole("button", { name: "Add food at 08:00" }));

      expect(onAdd).toHaveBeenCalledTimes(1);
      expect(onAdd).toHaveBeenCalledWith(8);
    });

    it("should call onAdd with 23 for the last hour, and not with the hour of the list", async () => {
      const { onAdd } = await renderHourRow({ hour: 23, label: "23:00" });

      await fireEvent.press(screen.getByRole("button", { name: "Add food at 23:00" }));

      expect(onAdd).toHaveBeenCalledWith(23);
    });

    it("should be disabled, dimmed to 40 percent and not call onAdd when addDisabled is set", async () => {
      const { onAdd } = await renderHourRow({ addDisabled: true, children: porridge });
      const add = screen.getByRole("button", { name: "Add food at 08:00" });

      await fireEvent.press(add);

      expect(add).toBeDisabled();
      expect(add).toHaveStyle({ opacity: Math.fround(0.4) });
      expect(onAdd).not.toHaveBeenCalled();
    });

    it("should leave the foods readable and pressable when addDisabled is set", async () => {
      await renderHourRow({ addDisabled: true, children: porridge });

      expect(screen.getByRole("button", { name: /^Porridge oats/ })).toBeEnabled();
    });

    it("should be enabled and at full strength by default", async () => {
      await renderHourRow();
      const add = screen.getByRole("button", { name: "Add food at 08:00" });

      expect(add).toBeEnabled();
      expect(add).not.toHaveStyle({ opacity: Math.fround(0.4) });
    });
  });

  describe("the hour chip", () => {
    it("should read the hour label and be named by it when it is not the current hour", async () => {
      await renderHourRow({ hour: 11, label: "11:00" });

      expect(screen.getByLabelText("11:00")).toBeOnTheScreen();
      expect(screen.getByText("11:00")).toBeOnTheScreen();
    });

    it("should be named 11:00, now for the current hour", async () => {
      await renderHourRow({ hour: 11, label: "11:00", isNow: true });

      expect(screen.getByLabelText("11:00, now")).toBeOnTheScreen();
      expect(screen.queryByLabelText("11:00")).not.toBeOnTheScreen();
    });

    it("should still read only the hour label on screen for the current hour, the dot being decoration", async () => {
      await renderHourRow({ hour: 11, label: "11:00", isNow: true });

      expectTextsInOrder(screen.getAllByText(/\d/), ["11:00"]);
    });

    it.each(schemes)(
      "should carry a 6 point accent dot only for the current hour in %s",
      async (scheme) => {
        await renderHourRow({ hour: 11, label: "11:00", isNow: true, scheme });

        expect(
          viewsDrawn({ width: 6, height: 6, backgroundColor: resolvedColor(scheme, "accent") }),
        ).toHaveLength(1);
      },
    );

    it("should have no dot when it is not the current hour", async () => {
      await renderHourRow({ hour: 11, label: "11:00" });

      expect(viewsDrawn({ width: 6, height: 6 })).toHaveLength(0);
    });

    it.each(schemes)(
      "should be a 28 point pill on the raised surface with a 1 point border in %s",
      async (scheme) => {
        await renderHourRow({ scheme });

        expect(screen.getByLabelText("08:00")).toHaveStyle({
          height: 28,
          borderRadius: 999,
          borderWidth: 1,
          borderColor: resolvedColor(scheme, "border"),
          backgroundColor: resolvedColor(scheme, "surface-raised"),
          paddingLeft: 12,
          paddingRight: 12,
        });
      },
    );
  });

  describe("an hour with foods", () => {
    it("should show the foods under the chip, in the order they are given", async () => {
      await renderHourRow({ children: [porridge, milk] });

      expectTextsInOrder(screen.getAllByText(/^(08:00|Porridge oats|Semi-skimmed milk)$/), [
        "08:00",
        "Porridge oats",
        "Semi-skimmed milk",
      ]);
    });

    it("should draw an hour with no foods as just the chip and the add button", async () => {
      await renderHourRow();

      expect(screen.getAllByRole("button")).toHaveLength(1);
      expect(screen.queryByText(/kcal/)).not.toBeOnTheScreen();
    });

    it("should draw the foods in one card, with a hairline between them and none above the first", async () => {
      await renderHourRow({ children: [porridge, milk] });

      expect(viewsDrawn({ borderTopWidth: 1 })).toHaveLength(1);
    });

    it("should draw a single food with no hairline", async () => {
      await renderHourRow({ children: porridge });

      expect(viewsDrawn({ borderTopWidth: 1 })).toHaveLength(0);
    });

    it("should leave an hour with no children without a card", async () => {
      await renderHourRow({ children: null });

      expect(viewsDrawn({ borderRadius: 20 })).toHaveLength(0);
    });

    it("should indent the card 8 points past the guide line's padding and leave 8 below it", async () => {
      await renderHourRow({ children: porridge });
      const [card] = viewsDrawn({ borderRadius: 20 });

      expect(card?.parent).toHaveStyle({ marginLeft: 8, marginBottom: 8 });
    });
  });

  describe("the guide line and the row", () => {
    it.each(schemes)(
      "should have a 1 point guide line 6 points in with 14 points of padding after it in %s",
      async (scheme) => {
        await renderHourRow({ scheme });

        expect(hourItem()).toHaveStyle({
          marginLeft: 6,
          paddingLeft: 14,
          borderLeftWidth: 1,
          borderColor: resolvedColor(scheme, "border"),
        });
      },
    );

    it.each(schemes)(
      "should draw a 7 point node on the line, raised fill and strong border, in %s",
      async (scheme) => {
        await renderHourRow({ scheme });

        expect(
          viewsDrawn({
            width: 7,
            height: 7,
            borderRadius: 999,
            borderWidth: 1,
            backgroundColor: resolvedColor(scheme, "surface-raised"),
            borderColor: resolvedColor(scheme, "border-strong"),
          }),
        ).toHaveLength(1);
      },
    );

    it("should put the node's centre on the line and level with the chip", async () => {
      await renderHourRow();
      const [node] = viewsDrawn({ width: 7, height: 7 });

      // The line is 1 point wide at the row's left edge, so a 7 point node reaches 4 points out, and its
      // centre is 3.5 down from a top of 19, level with the 28 point chip's centre in a 44 point row.
      expect(node).toHaveStyle({ position: "absolute", left: -4, top: 19 });
      expect(node).toBeOnTheScreen();
    });

    it("should be at least 44 points high, holding the chip and the add button side by side", async () => {
      await renderHourRow();
      const [row] = viewsDrawn({ minHeight: 44, flexDirection: "row" });

      expect(row).toHaveStyle({ alignItems: "center", justifyContent: "space-between" });
      expect(row).toContainElement(screen.getByLabelText("08:00"));
      expect(row).toContainElement(screen.getByRole("button", { name: "Add food at 08:00" }));
    });

    it("should give the add button a 44 point square touch target of its own", async () => {
      await renderHourRow();

      expect(screen.getByRole("button", { name: "Add food at 08:00" })).toHaveStyle({
        height: 44,
        width: 44,
      });
    });

    it("should give the chip 8 points of margin from the line's padding", async () => {
      await renderHourRow();

      expect(screen.getByLabelText("08:00")).toHaveStyle({ marginLeft: 8 });
    });

    it("should hand onLayout to the row's own view so a screen can measure where the hour starts", async () => {
      const onLayout = jest.fn();
      await renderHourRow({ onLayout });

      // Not fired as an event: a fired event finds the handler on the component's own props and not on the view.
      expect(hourItem()).toHaveProp("onLayout", onLayout);
    });
  });

  describe("list semantics", () => {
    it("should be a list item that is not itself an accessibility element, so its buttons stay reachable", async () => {
      await renderHourRow({ children: porridge });

      const item = hourItem();
      expect(item).toHaveProp("role", "listitem");
      expect(item).not.toHaveProp("accessible", true);
      expect(within(item).getAllByRole("button")).toHaveLength(2);
    });

    it.each([
      [[], "08:00, nothing logged"],
      [[porridge], "08:00, 1 food"],
      [[porridge, milk, loggedFood("Banana", "08:10 · 1 medium")], "08:00, 3 foods"],
    ])("should name the list item by core from the foods it holds, %#", async (foods, name) => {
      await renderHourRow({ children: foods });

      expect(screen.getByLabelText(name)).toHaveProp("role", "listitem");
    });

    it("should count the foods inside a fragment and skip empty children", async () => {
      await renderHourRow({
        children: (
          <>
            {null}
            {porridge}
            <>{milk}</>
            {false}
          </>
        ),
      });

      expect(screen.getByLabelText("08:00, 2 foods")).toBeOnTheScreen();
    });
  });
});
