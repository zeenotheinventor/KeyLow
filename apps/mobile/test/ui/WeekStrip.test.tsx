import { weekOf } from "@keylow/core/diary";
import { themes } from "@keylow/tokens";
import { fireEvent, render, screen } from "@testing-library/react-native";

import { WeekStrip } from "../../components/ui";
import { ThemeProvider } from "../../lib/theme";
import { compileKitStyles } from "../support/kitStyles";
import { registerAppStyles } from "../support/nativeWindStyles";
import { expectTextsInOrder } from "../support/textsInOrder";
import { resolvedColor } from "../support/themeColor";

import type { WeekStripProps } from "../../components/ui";
import type { ThemeScheme } from "@keylow/tokens";

jest.mock("@react-native-async-storage/async-storage", () => ({
  __esModule: true,
  default: { getItem: () => Promise.resolve(null), setItem: () => Promise.resolve() },
}));

// Thursday 15 October 2026, in the week of Monday 12 to Sunday 18.
const today = "2026-10-15";
const completeDays = new Set(["2026-10-12", "2026-10-13"]);

const daysOf = (localDate: string, complete: ReadonlySet<string> = completeDays) =>
  weekOf(localDate).map((day) => ({ localDate: day, isComplete: complete.has(day) }));

const thisWeek = daysOf(today);

type StripOptions = Partial<WeekStripProps> & { scheme?: ThemeScheme };

async function renderStrip({ scheme = "dark", ...props }: StripOptions = {}) {
  const onSelectDay = jest.fn();
  const onWeekChange = jest.fn();
  await render(
    <ThemeProvider fixedPreference={scheme}>
      <WeekStrip
        days={thisWeek}
        selectedDate={today}
        today={today}
        onSelectDay={onSelectDay}
        onWeekChange={onWeekChange}
        {...props}
      />
    </ThemeProvider>,
  );
  return { onSelectDay, onWeekChange };
}

// The columns, the dot and the tick are decoration, and the pill's name says the same in words, so they
// have no role to query by and carry ids instead. The group is not itself an accessibility element, so
// as with the segmented control it is found by its label.
const hidden = { includeHiddenElements: true };

async function swipe(fromX: number, toX: number, fromY = 20, toY = 20) {
  const strip = screen.getByLabelText(/^(This week|Week of)/);
  await fireEvent(strip, "touchStart", { nativeEvent: { pageX: fromX, pageY: fromY } });
  await fireEvent(strip, "touchEnd", { nativeEvent: { pageX: toX, pageY: toY } });
}

const schemes: ThemeScheme[] = ["dark", "light"];

describe("WeekStrip", () => {
  let kitStyles: string;

  beforeAll(async () => {
    kitStyles = await compileKitStyles();
  });

  beforeEach(() => {
    registerAppStyles(kitStyles);
  });

  describe("what it says", () => {
    it("should be a group named This week when the week holds today", async () => {
      await renderStrip();

      expect(screen.getByLabelText("This week")).toHaveProp("role", "group");
    });

    it("should be named by its Monday when it is another week", async () => {
      await renderStrip({ days: daysOf("2026-10-07"), selectedDate: "2026-10-07" });

      expect(screen.getByLabelText("Week of Mon 5 October")).toHaveProp("role", "group");
    });

    it("should have a button for each day, named by core with today and complete, selected being its own state", async () => {
      await renderStrip();

      expect(screen.getAllByRole("button")).toHaveLength(7);
      expect(screen.getByRole("button", { name: "Monday 12 October, complete" })).toBeOnTheScreen();
      expect(
        screen.getByRole("button", { name: "Tuesday 13 October, complete" }),
      ).toBeOnTheScreen();
      expect(screen.getByRole("button", { name: "Wednesday 14 October" })).toBeOnTheScreen();
      expect(screen.getByRole("button", { name: "Thursday 15 October, today" })).toBeOnTheScreen();
      expect(screen.getByRole("button", { name: "Sunday 18 October" })).toBeOnTheScreen();
    });

    it("should mark only the selected day as selected", async () => {
      await renderStrip({ selectedDate: "2026-10-14" });

      expect(screen.getByRole("button", { name: "Wednesday 14 October" })).toBeSelected();
      expect(screen.getByRole("button", { name: "Thursday 15 October, today" })).not.toBeSelected();
      expect(screen.getAllByRole("button", { selected: true })).toHaveLength(1);
    });

    it("should print the date number over a two letter day, Monday to Sunday", async () => {
      await renderStrip();

      expectTextsInOrder(screen.getAllByText(/^[A-Z][a-z]$/), [
        "Mo",
        "Tu",
        "We",
        "Th",
        "Fr",
        "Sa",
        "Su",
      ]);
      expectTextsInOrder(screen.getAllByText(/^\d+$/), ["12", "13", "14", "15", "16", "17", "18"]);
    });

    it("should read a week across a month end as 26 to 31 and then 1", async () => {
      await renderStrip({
        days: daysOf("2026-10-28"),
        selectedDate: "2026-10-28",
        today: "2026-11-02",
      });

      expectTextsInOrder(screen.getAllByText(/^\d+$/), ["26", "27", "28", "29", "30", "31", "1"]);
      expect(screen.getByRole("button", { name: "Sunday 1 November" })).toBeOnTheScreen();
    });
  });

  describe("choosing a day", () => {
    it("should call onSelectDay with the date of a day that is pressed", async () => {
      const { onSelectDay } = await renderStrip();

      await fireEvent.press(screen.getByRole("button", { name: "Wednesday 14 October" }));

      expect(onSelectDay).toHaveBeenCalledTimes(1);
      expect(onSelectDay).toHaveBeenCalledWith("2026-10-14");
    });

    it("should not call onSelectDay for a day that is still to come, and say it is disabled", async () => {
      const { onSelectDay } = await renderStrip();
      const future = screen.getByRole("button", { name: "Friday 16 October" });

      await fireEvent.press(future);

      expect(onSelectDay).not.toHaveBeenCalled();
      expect(future).toBeDisabled();
    });

    it("should not disable today or a past day", async () => {
      await renderStrip();

      expect(screen.getByRole("button", { name: "Wednesday 14 October" })).toBeEnabled();
      expect(screen.getByRole("button", { name: "Thursday 15 October, today" })).toBeEnabled();
    });
  });

  describe("changing week", () => {
    it("should go to the previous week on a swipe to the right", async () => {
      const { onWeekChange } = await renderStrip();

      await swipe(100, 260);

      expect(onWeekChange).toHaveBeenCalledTimes(1);
      expect(onWeekChange).toHaveBeenCalledWith("previous");
    });

    it("should go to the next week on a swipe to the left in an earlier week", async () => {
      const { onWeekChange } = await renderStrip({
        days: daysOf("2026-10-07"),
        selectedDate: "2026-10-07",
      });

      await swipe(260, 100);

      expect(onWeekChange).toHaveBeenCalledTimes(1);
      expect(onWeekChange).toHaveBeenCalledWith("next");
    });

    it("should not go past the current week on a swipe to the left", async () => {
      const { onWeekChange } = await renderStrip();

      await swipe(260, 100);

      expect(onWeekChange).not.toHaveBeenCalled();
    });

    it("should not go forward either from a week that starts after today", async () => {
      const { onWeekChange } = await renderStrip({
        days: daysOf("2026-10-22"),
        selectedDate: today,
      });

      await swipe(260, 100);

      expect(onWeekChange).not.toHaveBeenCalled();
    });

    it("should still go back from a week that starts after today", async () => {
      const { onWeekChange } = await renderStrip({
        days: daysOf("2026-10-22"),
        selectedDate: today,
      });

      await swipe(100, 260);

      expect(onWeekChange).toHaveBeenCalledWith("previous");
    });

    it("should change week when the drag is across at least twice as far as it is down", async () => {
      const { onWeekChange } = await renderStrip();

      await swipe(100, 200, 20, 70);

      expect(onWeekChange).toHaveBeenCalledWith("previous");
    });

    it("should not change week when a 100 point drag is 60 points down, which is under twice as far across", async () => {
      const { onWeekChange } = await renderStrip();

      await swipe(100, 200, 20, 80);

      expect(onWeekChange).not.toHaveBeenCalled();
    });

    it("should not change week on a short drag", async () => {
      const { onWeekChange } = await renderStrip();

      await swipe(100, 130);

      expect(onWeekChange).not.toHaveBeenCalled();
    });

    it("should not change week on a drag that is mostly vertical", async () => {
      const { onWeekChange } = await renderStrip();

      await swipe(100, 170, 20, 200);

      expect(onWeekChange).not.toHaveBeenCalled();
    });
  });

  describe("what sits under each pill", () => {
    it("should put a dot under today and a tick under each complete day", async () => {
      await renderStrip();

      expect(screen.getAllByTestId("today-dot", hidden)).toHaveLength(1);
      expect(screen.getAllByTestId("complete-tick", hidden)).toHaveLength(2);
    });

    it("should put a tick under today instead of the dot when today is complete", async () => {
      await renderStrip({ days: daysOf(today, new Set([...completeDays, today])) });

      expect(screen.queryByTestId("today-dot", hidden)).not.toBeOnTheScreen();
      expect(screen.getAllByTestId("complete-tick", hidden)).toHaveLength(3);
    });

    it("should put neither under a day that is incomplete and not today", async () => {
      await renderStrip({ days: daysOf(today, new Set()), selectedDate: "2026-10-14" });

      expect(screen.queryByTestId("complete-tick", hidden)).not.toBeOnTheScreen();
      expect(screen.getAllByTestId("today-dot", hidden)).toHaveLength(1);
    });
  });

  describe("how it is drawn", () => {
    it("should lay the days out in seven equal columns with 6 point gaps", async () => {
      await renderStrip();

      expect(screen.getByLabelText(/^(This week|Week of)/)).toHaveStyle({
        flexDirection: "row",
        columnGap: 6,
      });
      expect(screen.getAllByTestId("day-column", hidden)).toHaveLength(7);
      for (const column of screen.getAllByTestId("day-column", hidden)) {
        expect(column).toHaveStyle({ flexGrow: 1, flexBasis: "0%" });
      }
    });

    it("should draw each pill 56 high, with a 1 point border and the pill radius", async () => {
      await renderStrip();

      expect(screen.getByRole("button", { name: "Wednesday 14 October" })).toHaveStyle({
        height: 56,
        borderWidth: 1,
        borderRadius: 999,
      });
    });

    it("should draw each pill at most 48 wide", async () => {
      await renderStrip();

      for (const slot of screen.getAllByTestId("day-pill-slot", hidden)) {
        expect(slot).toHaveStyle({ width: "100%", maxWidth: 48 });
      }
    });

    it("should draw a day that is still to come at 40 per cent", async () => {
      await renderStrip();

      // NativeWind keeps an opacity as a 32 bit float.
      expect(screen.getByRole("button", { name: "Friday 16 October" })).toHaveStyle({
        opacity: Math.fround(0.4),
      });
      expect(screen.getByRole("button", { name: "Wednesday 14 October" })).not.toHaveStyle({
        opacity: Math.fround(0.4),
      });
    });

    it("should give each pill a 12 point status row, and draw the dot 6 points across", async () => {
      await renderStrip();

      for (const row of screen.getAllByTestId("day-status", hidden)) {
        expect(row).toHaveStyle({ height: 12 });
      }
      expect(screen.getByTestId("today-dot", hidden)).toHaveStyle({ width: 6, height: 6 });
    });
  });

  describe.each(schemes)("its colours in %s", (scheme) => {
    it("should fill the selected pill with surface-raised and give it the strong border", async () => {
      await renderStrip({ scheme });

      expect(screen.getByRole("button", { name: "Thursday 15 October, today" })).toHaveStyle({
        backgroundColor: resolvedColor(scheme, "surface-raised"),
        borderColor: resolvedColor(scheme, "border-strong"),
      });
    });

    it("should give a pill that is not selected the plain border and no fill", async () => {
      await renderStrip({ scheme });
      const pill = screen.getByRole("button", { name: "Wednesday 14 October" });

      expect(pill).toHaveStyle({ borderColor: resolvedColor(scheme, "border") });
      expect(pill).not.toHaveStyle({ backgroundColor: resolvedColor(scheme, "surface-raised") });
    });

    it("should set the date in the primary text colour and the day in muted", async () => {
      await renderStrip({ scheme });

      expect(screen.getByText("14")).toHaveStyle({ color: resolvedColor(scheme, "text-primary") });
      expect(screen.getByText("We")).toHaveStyle({ color: resolvedColor(scheme, "text-muted") });
    });

    it("should draw the dot in the accent colour", async () => {
      await renderStrip({ scheme });

      expect(screen.getByTestId("today-dot", hidden)).toHaveStyle({
        backgroundColor: resolvedColor(scheme, "accent"),
      });
    });

    it("should draw the tick in the success colour", async () => {
      await renderStrip({ scheme });

      expect(JSON.stringify(screen.toJSON())).toContain(`"stroke":"${themes[scheme].success}"`);
    });
  });
});
