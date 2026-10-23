import { themes } from "@keylow/tokens";
import { cleanup, render, screen, userEvent, within } from "@testing-library/react-native";

import { DayScrubber } from "../../components/DayScrubber";
import { ThemeProvider } from "../../lib/theme";
import { compileKitStyles } from "../support/kitStyles";
import { registerAppStyles } from "../support/nativeWindStyles";
import { resolvedColor } from "../support/themeColor";

import type { DayScrubberDay } from "../../components/DayScrubber";

jest.mock("@react-native-async-storage/async-storage", () => ({
  __esModule: true,
  default: { getItem: () => Promise.resolve(null), setItem: () => Promise.resolve() },
}));

const monday: DayScrubberDay = {
  date: "2026-10-12",
  weekday: "Mon",
  dayOfMonth: "12",
  accessibleName: "Monday 12 October, Push, logged",
  dot: "logged",
  isToday: false,
  isDisabled: false,
};
const thursday: DayScrubberDay = {
  date: "2026-10-15",
  weekday: "Thu",
  dayOfMonth: "15",
  accessibleName: "Thursday 15 October, today, Legs in progress",
  dot: "running",
  isToday: true,
  isDisabled: false,
};
const saturday: DayScrubberDay = {
  date: "2026-10-17",
  weekday: "Sat",
  dayOfMonth: "17",
  accessibleName: "Saturday 17 October, Push, planned, available in Projected",
  dot: "planned",
  isToday: false,
  isDisabled: true,
};
const sunday: DayScrubberDay = {
  date: "2026-10-18",
  weekday: "Sun",
  dayOfMonth: "18",
  accessibleName: "Sunday 18 October, rest day, available in Projected",
  dot: "none",
  isToday: false,
  isDisabled: true,
};
const days = [monday, thursday, saturday, sunday];

function renderScrubber(
  selectedDate = "2026-10-15",
  onSelect: (date: string) => void = () => undefined,
) {
  return render(
    <ThemeProvider fixedPreference="dark">
      <DayScrubber days={days} selectedDate={selectedDate} onSelect={onSelect} />
    </ThemeProvider>,
  );
}

const buttonOf = (name: string) => screen.getByRole("button", { name });

describe("the day scrubber", () => {
  let kitStyles: string;

  beforeAll(async () => {
    kitStyles = await compileKitStyles("", ["components/DayScrubber"]);
  });

  beforeEach(() => {
    registerAppStyles(kitStyles);
  });

  afterEach(async () => {
    await cleanup();
  });

  describe("what it announces", () => {
    it("should be a group named Day shown, with a button for each day", async () => {
      await renderScrubber();

      // The group is not itself an accessibility element, so that each day stays one for a screen reader.
      const group = screen.getByLabelText("Day shown");

      expect(group).toHaveProp("role", "group");
      expect(within(group).getAllByRole("button")).toHaveLength(4);
    });

    it("should name each day with the name it is given", async () => {
      await renderScrubber();

      for (const { accessibleName } of days) {
        expect(buttonOf(accessibleName)).toBeOnTheScreen();
      }
    });

    it("should announce the chosen day as selected and no other", async () => {
      await renderScrubber("2026-10-12");

      expect(
        screen.getByRole("button", { name: monday.accessibleName, selected: true }),
      ).toBeOnTheScreen();
      expect(screen.getAllByRole("button", { selected: true })).toHaveLength(1);
    });

    it("should announce a day that cannot be chosen as disabled, and name why", async () => {
      await renderScrubber();

      expect(buttonOf(saturday.accessibleName)).toBeDisabled();
      expect(buttonOf(sunday.accessibleName)).toBeDisabled();
      expect(buttonOf(monday.accessibleName)).toBeEnabled();
    });
  });

  describe("what it draws", () => {
    it("should write the weekday and the date numeral of each day", async () => {
      await renderScrubber();

      for (const { accessibleName, weekday, dayOfMonth } of days) {
        const day = within(buttonOf(accessibleName));
        expect(day.getByText(weekday)).toBeOnTheScreen();
        expect(day.getByText(dayOfMonth)).toBeOnTheScreen();
      }
    });

    it("should draw each day 52 points tall, on the surface with the plain border", async () => {
      await renderScrubber("2026-10-12");

      expect(buttonOf(thursday.accessibleName)).toHaveStyle({
        height: 52,
        borderWidth: 1,
        borderColor: resolvedColor("dark", "border"),
        backgroundColor: resolvedColor("dark", "surface"),
      });
    });

    it("should draw the chosen day with the accent border and the accent fill", async () => {
      await renderScrubber("2026-10-12");

      expect(buttonOf(monday.accessibleName)).toHaveStyle({
        borderColor: resolvedColor("dark", "accent"),
        backgroundColor: themes.dark["accent-muted"],
      });
    });

    it("should draw a day that cannot be chosen at 40 percent", async () => {
      await renderScrubber();

      expect(buttonOf(saturday.accessibleName)).toHaveStyle({ opacity: Math.fround(0.4) });
      expect(buttonOf(monday.accessibleName)).not.toHaveStyle({ opacity: Math.fround(0.4) });
    });

    it("should set the date numeral 14 over 16, as the boards draw it", async () => {
      await renderScrubber();

      expect(within(buttonOf(monday.accessibleName)).getByText("12")).toHaveStyle({
        fontSize: 14,
        lineHeight: 16,
      });
    });

    it("should name today in the primary colour and bold, and the other days in the secondary", async () => {
      await renderScrubber();

      expect(within(buttonOf(thursday.accessibleName)).getByText("Thu")).toHaveStyle({
        color: resolvedColor("dark", "text-primary"),
        fontFamily: "Geist-SemiBold",
      });
      expect(within(buttonOf(monday.accessibleName)).getByText("Mon")).toHaveStyle({
        color: resolvedColor("dark", "text-secondary"),
      });
    });
  });

  describe("the dot", () => {
    // The dot is decoration inside a button that names the day, so it is found by its place in the button.
    const dotOf = (name: string) => {
      const children = buttonOf(name).children;
      return children[children.length - 1];
    };

    it("should be a filled secondary dot, 6 points across, for a logged day", async () => {
      await renderScrubber();

      expect(dotOf(monday.accessibleName)).toHaveStyle({
        width: 6,
        height: 6,
        backgroundColor: resolvedColor("dark", "text-secondary"),
        borderColor: resolvedColor("dark", "text-secondary"),
      });
    });

    it("should be an accent dot for a session in progress", async () => {
      await renderScrubber();

      expect(dotOf(thursday.accessibleName)).toHaveStyle({
        backgroundColor: resolvedColor("dark", "accent"),
        borderColor: resolvedColor("dark", "accent"),
      });
    });

    it("should be a muted ring for a planned day", async () => {
      await renderScrubber();

      expect(dotOf(saturday.accessibleName)).toHaveStyle({
        borderWidth: 1.5,
        borderColor: resolvedColor("dark", "text-muted"),
        backgroundColor: "#00000000",
      });
    });

    it("should be drawn as nothing for a rest or missed day", async () => {
      await renderScrubber();

      expect(dotOf(sunday.accessibleName)).toHaveStyle({
        width: 6,
        height: 6,
        backgroundColor: "#00000000",
        borderColor: "#00000000",
      });
    });
  });

  describe("choosing", () => {
    it("should tell which day was pressed", async () => {
      const onSelect = jest.fn();
      await renderScrubber("2026-10-15", onSelect);
      const user = userEvent.setup();

      await user.press(buttonOf(monday.accessibleName));

      expect(onSelect).toHaveBeenCalledWith("2026-10-12");
    });

    it("should not tell of a press on a day that cannot be chosen", async () => {
      const onSelect = jest.fn();
      await renderScrubber("2026-10-15", onSelect);
      const user = userEvent.setup();

      await user.press(buttonOf(saturday.accessibleName));

      expect(onSelect).not.toHaveBeenCalled();
    });
  });
});
