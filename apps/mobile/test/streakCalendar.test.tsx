import { render, screen, within } from "@testing-library/react-native";

import { StreakCalendar } from "../components/StreakCalendar";
import { ThemeProvider } from "../lib/theme";
import { compileKitStyles } from "./support/kitStyles";
import { registerAppStyles } from "./support/nativeWindStyles";
import { novemberCalendar } from "./support/streakFixtures";
import { resolvedColor } from "./support/themeColor";

import type { StreakCalendarProps } from "../components/StreakCalendar";

jest.mock("@react-native-async-storage/async-storage", () => ({
  __esModule: true,
  default: { getItem: () => Promise.resolve(null), setItem: () => Promise.resolve() },
}));

const board: StreakCalendarProps = {
  today: "2026-11-19",
  calendar: novemberCalendar(),
  current: 11,
  longest: 31,
  freezesHeld: 3,
};

describe("StreakCalendar", () => {
  let styles: string;

  beforeAll(async () => {
    styles = await compileKitStyles("", ["components/StreakCalendar"]);
  });

  beforeEach(() => {
    registerAppStyles(styles);
  });

  async function renderCalendar(props: StreakCalendarProps = board) {
    await render(
      <ThemeProvider fixedPreference="dark">
        <StreakCalendar {...props} />
      </ThemeProvider>,
    );
  }

  it("should head the sheet and say how to keep the streak going", async () => {
    await renderCalendar();

    expect(screen.getByRole("heading", { name: "Your streak" })).toBeOnTheScreen();
    expect(screen.getByText("Complete a day in the Diary to keep it going.")).toBeOnTheScreen();
  });

  it("should show the current, longest and freezes held", async () => {
    await renderCalendar();

    expect(screen.getByLabelText("11 current days")).toBeOnTheScreen();
    expect(screen.getByLabelText("31 longest")).toBeOnTheScreen();
    expect(screen.getByLabelText("3 freezes held")).toBeOnTheScreen();
  });

  it("should name the month", async () => {
    await renderCalendar();

    expect(screen.getByRole("heading", { name: "November 2026" })).toBeOnTheScreen();
    expect(screen.getByText("Mon to Sun")).toBeOnTheScreen();
  });

  it("should mark a frozen day with a snowflake and a name that says so", async () => {
    await renderCalendar();

    expect(screen.getByLabelText("14, frozen")).toBeOnTheScreen();
  });

  it("should set a frozen day's number in the protein ink", async () => {
    await renderCalendar();

    expect(within(screen.getByLabelText("14, frozen")).getByText("14")).toHaveStyle({
      color: resolvedColor("dark", "protein-ink"),
    });
  });

  it("should set the freezes held value in the protein ink and leave the others", async () => {
    await renderCalendar();

    expect(within(screen.getByLabelText("3 freezes held")).getByText("3")).toHaveStyle({
      color: resolvedColor("dark", "protein-ink"),
    });
    expect(within(screen.getByLabelText("11 current days")).getByText("11")).toHaveStyle({
      color: resolvedColor("dark", "text-primary"),
    });
  });

  it("should name today as not complete yet when it is at risk", async () => {
    await renderCalendar();

    expect(screen.getByLabelText("19, today, not complete yet")).toBeOnTheScreen();
  });

  it("should name each day as core's calendar has it", async () => {
    await renderCalendar();

    expect(screen.getByLabelText("1, complete")).toBeOnTheScreen();
    expect(screen.getByLabelText("7, missed")).toBeOnTheScreen();
    expect(screen.getByLabelText("30")).toBeOnTheScreen();
  });

  it("should draw every day of the month once", async () => {
    await renderCalendar();

    for (const day of ["1", "15", "29", "30"]) {
      expect(screen.getAllByText(day)).toHaveLength(1);
    }
  });

  it("should show the legend and the freeze explanation", async () => {
    await renderCalendar();

    for (const word of ["Complete", "Frozen", "Missed", "Today, at risk"]) {
      expect(screen.getByText(word)).toBeOnTheScreen();
    }
    expect(
      screen.getByText(
        "You earn a freeze for every 7 days in a row, and from Gold and Platinum badges, level-ups and more. There is no limit to how many you hold.",
      ),
    ).toBeOnTheScreen();
  });

  it("should show a streak of nothing", async () => {
    await renderCalendar({
      today: "2026-11-19",
      calendar: novemberCalendar("2026-11-19", { "2026-11-14": "missed", "2026-11-19": "at_risk" }),
      current: 0,
      longest: 0,
      freezesHeld: 0,
    });

    expect(screen.getByLabelText("0 current days")).toBeOnTheScreen();
    expect(screen.getByLabelText("0 freezes held")).toBeOnTheScreen();
    expect(screen.queryByLabelText("14, frozen")).not.toBeOnTheScreen();
  });
});
