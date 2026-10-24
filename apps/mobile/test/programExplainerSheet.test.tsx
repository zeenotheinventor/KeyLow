import { render, screen, userEvent } from "@testing-library/react-native";
import { setUpTests } from "react-native-reanimated";
import { SafeAreaProvider } from "react-native-safe-area-context";

import { ProgramExplainerSheet } from "../components/ProgramExplainerSheet";
import { ThemeProvider } from "../lib/theme";
import { expectTextsInOrder } from "./support/textsInOrder";

import type { ProgramExplainerSheetProps } from "../components/ProgramExplainerSheet";

jest.mock("@react-native-async-storage/async-storage", () => ({
  __esModule: true,
  default: { getItem: () => Promise.resolve(null), setItem: () => Promise.resolve() },
}));
jest.mock("@gorhom/bottom-sheet", () =>
  jest
    .requireActual<{ mockBottomSheet: () => unknown }>("./support/sheetScrollViewMock")
    .mockBottomSheet(),
);

setUpTests();

const phone = {
  frame: { x: 0, y: 0, width: 390, height: 844 },
  insets: { top: 47, right: 0, bottom: 34, left: 0 },
};

const FRIDAY = "2026-10-23";
const WEDNESDAY = "2026-10-28";

function renderSheet(props: Partial<ProgramExplainerSheetProps> = {}) {
  return render(
    <SafeAreaProvider initialMetrics={phone}>
      <ThemeProvider fixedPreference="dark">
        <ProgramExplainerSheet open checkInDate={FRIDAY} onClose={() => undefined} {...props} />
      </ThemeProvider>
    </SafeAreaProvider>,
  );
}

const NOT_MEDICAL_ADVICE =
  "Ki-Lo's estimates and targets are not medical advice. Speak to a doctor before you make big changes to your diet or your weight.";

// The seven sections as the board draws them, with Friday as the check-in day.
const SECTIONS = [
  {
    title: "Your expenditure",
    text: "The energy you use in a day. Ki-Lo works it out from the food you log and how your weight trend moves: if your trend holds steady while you eat 2,000 kcal a day, you use about 2,000.",
  },
  {
    title: "The weekly check-in",
    text: "Every Friday, the day you started, Ki-Lo looks back over the last 4 weeks. It updates your expenditure, then sets the next week's targets from it. If you have been away, it catches up one week at a time.",
  },
  {
    title: "The first two weeks",
    text: "Your first check-in is two weeks after you start. Until then your expenditure is a starting estimate from your answers, and your targets stay as they are.",
  },
  {
    title: "What a check-in needs",
    text: "In the last 4 weeks: weigh-ins on at least 8 days, covering at least 14 days from the first to the last, and at least 10 complete days. Without them the estimate is carried forward and becomes less certain, and your targets are worked out again from it.",
  },
  {
    title: "The likely range",
    text: "Your expenditure comes with a range. The true figure is inside it 8 times in 10. The range narrows as you weigh in and complete your days.",
  },
  {
    title: "Guardrails",
    text: "Your expenditure moves by at most 250 kcal a week. Your target is never more than 30% below it or 20% above it, and never above 6,000 kcal. When you are losing weight it is never below 1,200 kcal or 90% of the energy you use at rest, whichever is higher. When a guardrail changes your target, the check-in says so.",
  },
  {
    title: "Water, glycogen and muscle",
    text: "Ki-Lo counts 7,700 kcal for each kilogram your trend moves, which assumes the change is mostly fat. In the first weeks of a new deficit you also lose water and glycogen, so your weight falls faster and your expenditure can look higher than it is. If you gain mostly muscle, a kilogram holds less energy, so your expenditure can look lower than it is.",
  },
];

describe("the programme explainer sheet", () => {
  it("should be a dialog named by its title, with the title as its heading", async () => {
    await renderSheet();

    expect(screen.getByLabelText("How your programme works")).toHaveProp("role", "dialog");
    expect(screen.getByRole("heading", { name: "How your programme works" })).toBeOnTheScreen();
  });

  it("should show the seven sections in order, each heading over its words", async () => {
    await renderSheet();

    expectTextsInOrder(screen.getAllByRole("heading"), [
      "How your programme works",
      ...SECTIONS.map((section) => section.title),
    ]);
    expectTextsInOrder(screen.getAllByText(/./), [
      "How your programme works",
      "Done",
      ...SECTIONS.flatMap((section) => [section.title, section.text]),
      NOT_MEDICAL_ADVICE,
    ]);
  });

  it("should say Every Friday, the day you started, for a Friday programme", async () => {
    await renderSheet({ checkInDate: FRIDAY });

    expect(
      screen.getByText(
        /^Every Friday, the day you started, Ki-Lo looks back over the last 4 weeks\./,
      ),
    ).toBeOnTheScreen();
  });

  it("should name the weekday of the programme it is given", async () => {
    await renderSheet({ checkInDate: WEDNESDAY });

    expect(
      screen.getByText(
        /^Every Wednesday, the day you started, Ki-Lo looks back over the last 4 weeks\./,
      ),
    ).toBeOnTheScreen();
    expect(screen.queryByText(/Every Friday/)).not.toBeOnTheScreen();
  });

  it("should state the energy density caveat", async () => {
    await renderSheet();

    expect(screen.getByRole("heading", { name: "Water, glycogen and muscle" })).toBeOnTheScreen();
    expect(
      screen.getByText(/^Ki-Lo counts 7,700 kcal for each kilogram your trend moves/),
    ).toBeOnTheScreen();
  });

  it("should end with the not-medical-advice line", async () => {
    await renderSheet();

    expect(screen.getByText(NOT_MEDICAL_ADVICE)).toBeOnTheScreen();
  });

  it("should scroll, so a small phone reaches the last section and the line", async () => {
    await renderSheet();

    const line = screen.getByText(NOT_MEDICAL_ADVICE);
    let node = line.parent;
    while (node !== null && node.type !== "RCTScrollView") {
      node = node.parent;
    }
    expect(node).not.toBeNull();
  });

  it("should close from Done", async () => {
    const user = userEvent.setup();
    const onClose = jest.fn();
    await renderSheet({ onClose });

    await user.press(screen.getByRole("button", { name: "Done" }));

    expect(onClose).toHaveBeenCalledTimes(1);
  });

  it("should draw nothing once closed", async () => {
    await renderSheet({ open: false });

    expect(screen.queryByRole("dialog")).not.toBeOnTheScreen();
  });
});
