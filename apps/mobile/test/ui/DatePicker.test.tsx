import { fireEvent, render, screen, within } from "@testing-library/react-native";

import { DatePicker } from "../../components/ui";
import { ThemeProvider } from "../../lib/theme";
import { compileKitStyles } from "../support/kitStyles";
import { registerAppStyles } from "../support/nativeWindStyles";
import { expectTextsInOrder } from "../support/textsInOrder";
import { resolvedColor } from "../support/themeColor";

import type { DatePickerProps } from "../../components/ui";
import type { ThemeScheme } from "@keylow/tokens";

jest.mock("@react-native-async-storage/async-storage", () => ({
  __esModule: true,
  default: { getItem: () => Promise.resolve(null), setItem: () => Promise.resolve() },
}));

// Thursday 15 October 2026, with Monday 12 and Tuesday 13 complete, as the diary board draws it.
const today = "2026-10-15";

const schemes: ThemeScheme[] = ["dark", "light"];

async function renderPicker(props: Partial<DatePickerProps> = {}, scheme: ThemeScheme = "dark") {
  const onSelect = jest.fn();
  const onMonthChange = jest.fn();
  await render(
    <ThemeProvider fixedPreference={scheme}>
      <DatePicker
        completeDates={["2026-10-12", "2026-10-13"]}
        month="2026-10"
        selectedDate={today}
        today={today}
        onMonthChange={onMonthChange}
        onSelect={onSelect}
        {...props}
      />
    </ThemeProvider>,
  );
  return { onSelect, onMonthChange };
}

function weekRow(index: number) {
  const row = screen.getAllByTestId("week-row")[index];
  if (row === undefined) {
    throw new Error(`The grid has no week ${index + 1}`);
  }
  return within(row);
}

describe("DatePicker", () => {
  let kitStyles: string;

  beforeAll(async () => {
    kitStyles = await compileKitStyles();
  });

  beforeEach(() => {
    registerAppStyles(kitStyles);
  });

  describe("the month", () => {
    it("should head the grid with the month and the year", async () => {
      await renderPicker();

      expect(screen.getByRole("heading", { name: "October 2026" })).toBeOnTheScreen();
      // The grid and its rows are not accessibility elements, or the cells in them could not be reached.
      expect(screen.getByLabelText("October 2026")).toHaveProp("role", "grid");
    });

    it("should head the columns M T W T F S S, Monday first", async () => {
      await renderPicker();

      expectTextsInOrder(screen.getAllByText(/^[MTWFS]$/, { includeHiddenElements: true }), [
        "M",
        "T",
        "W",
        "T",
        "F",
        "S",
        "S",
      ]);
    });

    it("should draw a week to a row, the first one starting on the Thursday", async () => {
      await renderPicker();

      expect(screen.getAllByTestId("week-row")).toHaveLength(5);
      const firstWeek = weekRow(0).getAllByRole("button");
      expect(firstWeek).toHaveLength(4);
      ["1 October", "2 October", "3 October", "4 October"].forEach((name, index) => {
        expect(firstWeek[index]).toHaveAccessibleName(name);
      });
      expect(weekRow(1).getAllByRole("button")[0]).toHaveAccessibleName("5 October");
    });

    it("should give a month that starts on a Monday a full first row", async () => {
      await renderPicker({ month: "2026-06", selectedDate: "2026-06-10", today });

      expect(weekRow(0).getAllByRole("button")).toHaveLength(7);
    });
  });

  describe("the days", () => {
    it("should name today, and say it is chosen when it is", async () => {
      await renderPicker();

      expect(screen.getByRole("button", { name: "15 October, today, selected" })).toBeOnTheScreen();
    });

    it("should say only the chosen day is chosen, in its name", async () => {
      await renderPicker({ selectedDate: "2026-10-09" });

      expect(screen.getByRole("button", { name: "9 October, selected" })).toBeOnTheScreen();
      expect(screen.getByRole("button", { name: "15 October, today" })).toBeOnTheScreen();
    });

    it("should end the name of a complete day with complete", async () => {
      await renderPicker();

      expect(screen.getByRole("button", { name: "12 October, complete" })).toBeOnTheScreen();
      expect(screen.getByRole("button", { name: "13 October, complete" })).toBeOnTheScreen();
      expect(screen.getByRole("button", { name: "14 October" })).toBeOnTheScreen();
    });

    it("should draw the success dot on complete days only", async () => {
      await renderPicker();

      const hidden = { includeHiddenElements: true };
      expect(
        within(screen.getByRole("button", { name: "12 October, complete" })).getByTestId(
          "complete-dot",
          hidden,
        ),
      ).toBeOnTheScreen();
      expect(
        within(screen.getByRole("button", { name: "14 October" })).queryByTestId(
          "complete-dot",
          hidden,
        ),
      ).not.toBeOnTheScreen();
    });

    it("should pass the day pressed to onSelect", async () => {
      const { onSelect } = await renderPicker();

      await fireEvent.press(screen.getByRole("button", { name: "9 October" }));

      expect(onSelect).toHaveBeenCalledTimes(1);
      expect(onSelect).toHaveBeenCalledWith("2026-10-09");
    });

    it("should let today be chosen", async () => {
      const { onSelect } = await renderPicker({ selectedDate: "2026-10-09" });

      await fireEvent.press(screen.getByRole("button", { name: "15 October, today" }));

      expect(onSelect).toHaveBeenCalledTimes(1);
      expect(onSelect).toHaveBeenCalledWith(today);
    });

    it("should disable the days after today and not choose them", async () => {
      const { onSelect } = await renderPicker();
      const tomorrow = screen.getByRole("button", { name: "16 October" });

      expect(tomorrow).toBeDisabled();
      expect(screen.getByRole("button", { name: "31 October" })).toBeDisabled();
      await fireEvent.press(tomorrow);

      expect(onSelect).not.toHaveBeenCalled();
    });

    it("should leave the days up to today enabled", async () => {
      await renderPicker();

      expect(screen.getByRole("button", { name: "1 October" })).toBeEnabled();
      expect(screen.getByRole("button", { name: "14 October" })).toBeEnabled();
    });
  });

  describe("the month buttons", () => {
    it("should ask for the month before from Previous month", async () => {
      const { onMonthChange } = await renderPicker();

      await fireEvent.press(screen.getByRole("button", { name: "Previous month" }));

      expect(onMonthChange).toHaveBeenCalledTimes(1);
      expect(onMonthChange).toHaveBeenCalledWith("2026-09");
    });

    it("should cross the year going back", async () => {
      const { onMonthChange } = await renderPicker({ month: "2026-01" });

      await fireEvent.press(screen.getByRole("button", { name: "Previous month" }));

      expect(onMonthChange).toHaveBeenCalledTimes(1);
      expect(onMonthChange).toHaveBeenCalledWith("2025-12");
    });

    it("should ask for the month after from Next month when there is one", async () => {
      const { onMonthChange } = await renderPicker({ month: "2026-08" });

      await fireEvent.press(screen.getByRole("button", { name: "Next month" }));

      expect(onMonthChange).toHaveBeenCalledTimes(1);
      expect(onMonthChange).toHaveBeenCalledWith("2026-09");
    });

    it("should disable Next month in the month of today", async () => {
      const { onMonthChange } = await renderPicker();
      const next = screen.getByRole("button", { name: "Next month" });

      expect(next).toBeDisabled();
      await fireEvent.press(next);

      expect(onMonthChange).not.toHaveBeenCalled();
    });

    it("should keep Previous month enabled in the month of today", async () => {
      await renderPicker();

      expect(screen.getByRole("button", { name: "Previous month" })).toBeEnabled();
    });
  });

  describe("a month in the past", () => {
    it("should have no day disabled", async () => {
      await renderPicker({ month: "2026-09", selectedDate: "2026-09-30" });

      const cells = within(screen.getByLabelText("September 2026")).getAllByRole("button");
      expect(cells).toHaveLength(30);
      for (const cell of cells) {
        expect(cell).toBeEnabled();
      }
    });
  });

  describe.each(schemes)("the look in %s", (scheme) => {
    it("should draw each day as a 44 point circle", async () => {
      await renderPicker({}, scheme);

      expect(screen.getByRole("button", { name: "14 October" })).toHaveStyle({
        width: 44,
        height: 44,
        borderRadius: 9999,
      });
    });

    it("should ring today in the accent, with no fill when another day is chosen", async () => {
      await renderPicker({ selectedDate: "2026-10-09" }, scheme);

      const todayCell = screen.getByRole("button", { name: "15 October, today" });
      expect(todayCell).toHaveStyle({
        borderWidth: 2,
        borderColor: resolvedColor(scheme, "accent"),
      });
      expect(todayCell).not.toHaveStyle({ backgroundColor: resolvedColor(scheme, "accent") });
    });

    it("should fill the chosen day with the accent and write its number in accent-foreground", async () => {
      await renderPicker({ selectedDate: "2026-10-09" }, scheme);

      const cell = screen.getByRole("button", { name: "9 October, selected" });
      expect(cell).toHaveStyle({ backgroundColor: resolvedColor(scheme, "accent") });
      expect(within(cell).getByText("9")).toHaveStyle({
        color: resolvedColor(scheme, "accent-foreground"),
        fontWeight: "600",
      });
    });

    it("should write the number of any other day in the primary text colour, without a ring", async () => {
      await renderPicker({}, scheme);

      const cell = screen.getByRole("button", { name: "14 October" });
      expect(within(cell).getByText("14")).toHaveStyle({
        color: resolvedColor(scheme, "text-primary"),
      });
      expect(cell).not.toHaveStyle({ borderColor: resolvedColor(scheme, "accent") });
    });

    it("should dim a day after today to 40 percent, and no other", async () => {
      // NativeWind keeps an opacity as a 32 bit float.
      await renderPicker({}, scheme);

      expect(screen.getByRole("button", { name: "16 October" })).toHaveStyle({
        opacity: Math.fround(0.4),
      });
      expect(screen.getByRole("button", { name: "14 October" })).not.toHaveStyle({
        opacity: Math.fround(0.4),
      });
    });

    it("should draw the complete dot 4 points across, in the success colour", async () => {
      await renderPicker({}, scheme);

      expect(
        within(screen.getByRole("button", { name: "12 October, complete" })).getByTestId(
          "complete-dot",
          { includeHiddenElements: true },
        ),
      ).toHaveStyle({
        width: 4,
        height: 4,
        backgroundColor: resolvedColor(scheme, "success"),
      });
    });

    it("should dim Next month to 40 percent in the month of today", async () => {
      await renderPicker({}, scheme);

      expect(screen.getByRole("button", { name: "Next month" })).toHaveStyle({
        opacity: Math.fround(0.4),
      });
    });
  });
});
