import { cleanup, render, screen, userEvent } from "@testing-library/react-native";
import { setUpTests } from "react-native-reanimated";

import { RoutineCard } from "../components/RoutineCard";
import { ThemeProvider } from "../lib/theme";
import { compileKitStyles } from "./support/kitStyles";
import { registerAppStyles } from "./support/nativeWindStyles";
import { resolvedColor } from "./support/themeColor";

import type { RoutineCardProps } from "../components/RoutineCard";

jest.mock("@react-native-async-storage/async-storage", () => ({
  __esModule: true,
  default: { getItem: () => Promise.resolve(null), setItem: () => Promise.resolve() },
}));

setUpTests();

// The golden Push Pull Legs of the routines · list board: Mon Push, Tue Pull, Thu Legs, Sat Push.
const pushPullLegs: RoutineCardProps = {
  name: "Push Pull Legs",
  days: [
    { name: "Push", weekday: 0 },
    { name: "Pull", weekday: 1 },
    { name: "Legs", weekday: 3 },
    { name: "Push", weekday: 5 },
  ],
  setsPerWeek: 63,
  activeFrom: "2026-09-21",
};

// The week strip is hidden from a screen reader, because the card's name already says the days.
const hidden = { includeHiddenElements: true };

async function renderCard(props: Partial<RoutineCardProps> = {}) {
  await render(
    <ThemeProvider fixedPreference="dark">
      <RoutineCard {...pushPullLegs} {...props} />
    </ThemeProvider>,
  );
}

describe("the routine card", () => {
  let kitStyles: string;

  beforeAll(async () => {
    kitStyles = await compileKitStyles("", ["components/RoutineCard"]);
  });

  beforeEach(() => {
    registerAppStyles(kitStyles);
  });

  afterEach(async () => {
    await cleanup();
  });

  it("should show the name, the Active badge and the days, sets and date it plans from", async () => {
    await renderCard();

    expect(screen.getByRole("heading", { name: "Push Pull Legs" })).toBeOnTheScreen();
    expect(screen.getByText("Active")).toBeOnTheScreen();
    expect(screen.getByText("4 days · 63 sets a week · since Mon 21 Sep")).toBeOnTheScreen();
  });

  it("should draw the week with the routine's days on their weekdays and Rest between them", async () => {
    await renderCard();

    for (const weekday of ["Mon", "Tue", "Wed", "Thu", "Fri", "Sat", "Sun"]) {
      expect(screen.getByText(weekday, hidden)).toBeOnTheScreen();
    }
    expect(screen.getAllByText("Push", hidden)).toHaveLength(2);
    expect(screen.getByText("Pull", hidden)).toBeOnTheScreen();
    expect(screen.getByText("Legs", hidden)).toBeOnTheScreen();
    expect(screen.getAllByText("Rest", hidden)).toHaveLength(3);
  });

  it("should leave since out when the routine has no activation date", async () => {
    await renderCard({ activeFrom: null });

    expect(screen.getByText("4 days · 63 sets a week")).toBeOnTheScreen();
  });

  it("should be named by its days, and be no button, when nothing opens the editor", async () => {
    await renderCard();

    expect(
      screen.getByLabelText(
        "Push Pull Legs, active, 4 days, Monday Tuesday Thursday Saturday, 63 sets a week",
      ),
    ).toBeOnTheScreen();
    expect(screen.queryByRole("button")).not.toBeOnTheScreen();
  });

  it("should be a button that says Edit, and call onPress, when the editor can be opened", async () => {
    const onPress = jest.fn();
    const user = userEvent.setup();
    await renderCard({ onPress });

    await user.press(
      screen.getByRole("button", {
        name: "Push Pull Legs, active, 4 days, Monday Tuesday Thursday Saturday, 63 sets a week. Edit",
      }),
    );

    expect(onPress).toHaveBeenCalledTimes(1);
  });

  it("should draw its border in the accent colour", async () => {
    await renderCard();

    const card = screen.getByLabelText(/^Push Pull Legs, active/).parent;
    expect(card).toHaveStyle({ borderColor: resolvedColor("dark", "accent") });
  });
});
