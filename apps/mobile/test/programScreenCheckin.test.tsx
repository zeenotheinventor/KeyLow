import "./support/gestureHandler";

import { KeyLowProvider } from "@keylow/api-client";
import { act, render, screen, within } from "@testing-library/react-native";
import { AccessibilityInfo } from "react-native";

import { ProgramScreen } from "../components/ProgramScreen";
import { ThemeProvider } from "../lib/theme";
import { createDiaryQueryClient, diaryBackend, resetDiaryBackend } from "./support/diaryBackend";
import { resetRouterMock } from "./support/expoRouterMock";
import {
  programBackend,
  programClient,
  resetProgramBackend,
  showFiveWeighInDaysCheckin,
  showFloorAboveExpenditureCheckin,
  showGoldenFirstCheckin,
  showGoldenProgram,
  showMaxDeficitCheckin,
  showNineCompleteDaysCheckin,
} from "./support/programBackend";

const mockStore = jest.requireActual<typeof import("./support/checkinSeenStoreMock")>(
  "./support/checkinSeenStoreMock",
);
jest.mock("@react-native-async-storage/async-storage", () => ({
  __esModule: true,
  default: jest.requireActual<{ asyncStorageMock: unknown }>("./support/checkinSeenStoreMock")
    .asyncStorageMock,
}));
jest.mock(
  "expo-router",
  () => jest.requireActual<{ mockExpoRouter: unknown }>("./support/expoRouterMock").mockExpoRouter,
);
jest.mock(
  "react-native-safe-area-context",
  () =>
    jest.requireActual<{ default: unknown }>("react-native-safe-area-context/jest/mock").default,
);

// Moves the date the screen reads to Friday 9 October, the day of the check-ins, and leaves every timer running.
const ONLY_THE_DATE = [
  "hrtime",
  "nextTick",
  "performance",
  "queueMicrotask",
  "requestAnimationFrame",
  "cancelAnimationFrame",
  "requestIdleCallback",
  "cancelIdleCallback",
  "setImmediate",
  "clearImmediate",
  "setInterval",
  "clearInterval",
  "setTimeout",
  "clearTimeout",
] as const;

async function renderProgramScreen() {
  await render(
    <ThemeProvider fixedPreference="dark">
      <KeyLowProvider client={programClient} queryClient={createDiaryQueryClient()}>
        <ProgramScreen />
      </KeyLowProvider>
    </ThemeProvider>,
  );
}

type Instance = NonNullable<ReturnType<typeof screen.getByText>>;

function isInside(node: Instance | null, ancestor: Instance): boolean {
  return node !== null && (node === ancestor || isInside(node.parent, ancestor));
}

// The icons are decoration with no role, so the drawings inside a line's own row are counted.
function drawingsBesideText(card: Instance, text: string): number {
  const row = within(card).getByText(text).parent;
  if (row === null) {
    return 0;
  }
  return (
    screen.root?.queryAll((node) => node.type === "RNSVGSvgView" && isInside(node, row)) ?? []
  ).length;
}

const dataLine =
  "From your weight trend and the food you logged: 14 weigh-ins and 14 complete days in the last 4 weeks.";
const carriedForwardLine =
  "So your expenditure estimate was carried forward, and it is less certain: likely 2,010 to 2,990 kcal. Your targets were worked out again from it.";
const stepLine =
  "Your expenditure moved 250 kcal, the most it moves in one week. Your weigh-ins and food log pointed to a 415 kcal drop, so it may move again at your next check-in.";
const deficitLine =
  "Kept to a 30% deficit, the most Ki-Lo sets. You would lose about 0.9 kg a week (0.66% of your weight), not 1.0%.";
const floorLine =
  "Raised to 1,200 kcal, the lowest target Ki-Lo sets for you. That is more than your estimated expenditure of 1,094 kcal, so you would gain about 0.1 kg a week (0.24% of your weight), not lose it.";
const doctorLine = "Talk to a doctor or dietitian before you try to lose more weight.";

// The card is a group named "Last check-in, {date}, measured" or "not measured". Its lines are read one by one, so
// it is not one accessible element, and it is found by its label, as the cards above it are.
async function findCard(name: string) {
  return screen.findByLabelText(name);
}

// Every piece of text inside a part of the screen, top to bottom, so a test can say what sits under what.
function textsIn(part: Pick<typeof screen, "getAllByText">): string[] {
  return part.getAllByText(/./).map((node) => [node.props.children].flat().join(""));
}

describe("the check-in summary card on the Programme screen", () => {
  beforeEach(() => {
    resetRouterMock();
    resetDiaryBackend();
    resetProgramBackend();
    mockStore.resetCheckinSeenStore();
    mockStore.seeCheckinAsAlreadySeen("2026-10-09");
    jest.useFakeTimers({ now: new Date("2026-10-09T09:00:00Z"), doNotFake: [...ONLY_THE_DATE] });
  });

  afterEach(async () => {
    jest.useRealTimers();
    jest.restoreAllMocks();
    await act(async () => {
      await new Promise((resolve) => setTimeout(resolve, 0));
    });
  });

  describe("a check-in that measured (checkin-summary: measured)", () => {
    beforeEach(() => {
      showGoldenFirstCheckin();
    });

    it("should be named by the date and that it measured", async () => {
      await renderProgramScreen();

      expect(await findCard("Last check-in, Friday 9 October, measured")).toBeOnTheScreen();
    });

    it("should say the expenditure moved from 2,500 to 2,560 kcal and the calorie target from 2,060 to 2,120 kcal", async () => {
      await renderProgramScreen();
      const card = await findCard("Last check-in, Friday 9 October, measured");

      expect(within(card).getByLabelText("Expenditure: 2,500 to 2,560 kcal")).toBeOnTheScreen();
      expect(within(card).getByLabelText("Calorie target: 2,060 to 2,120 kcal")).toBeOnTheScreen();
    });

    it("should carry the Measured badge and the data line with the counts of the window", async () => {
      await renderProgramScreen();
      const card = await findCard("Last check-in, Friday 9 October, measured");

      expect(within(card).getByText("Measured")).toBeOnTheScreen();
      expect(within(card).getByText("Last check-in")).toBeOnTheScreen();
      expect(within(card).getByText("Friday 9 October")).toBeOnTheScreen();
      expect(within(card).getByText(dataLine)).toBeOnTheScreen();
    });

    it("should draw the data line with one icon and no other line", async () => {
      await renderProgramScreen();
      const card = await findCard("Last check-in, Friday 9 October, measured");

      expect(drawingsBesideText(card, dataLine)).toBe(1);
      expect(within(card).queryByText(/most it moves in one week/)).not.toBeOnTheScreen();
      expect(within(card).queryByText(/^Kept to a/)).not.toBeOnTheScreen();
      expect(within(card).queryByText(/^Raised to/)).not.toBeOnTheScreen();
    });

    it("should sit under this week's targets and above the programme's own settings", async () => {
      await renderProgramScreen();
      await findCard("Last check-in, Friday 9 October, measured");

      const texts = textsIn(screen);
      expect(texts.indexOf("Since Fri 9 Oct")).toBeLessThan(texts.indexOf("Last check-in"));
      expect(texts.indexOf("Last check-in")).toBeLessThan(texts.indexOf("Your programme"));
    });
  });

  describe("guardrails, the step cap and the deficit cap (checkin-summary: guardrail, A)", () => {
    beforeEach(() => {
      showMaxDeficitCheckin();
    });

    it("should say the expenditure fell from 3,408 to 3,158 kcal and the calorie target from 2,390 to 2,220 kcal", async () => {
      await renderProgramScreen();
      const card = await findCard("Last check-in, Friday 9 October, measured");

      expect(within(card).getByLabelText("Expenditure: 3,408 to 3,158 kcal")).toBeOnTheScreen();
      expect(within(card).getByLabelText("Calorie target: 2,390 to 2,220 kcal")).toBeOnTheScreen();
    });

    it("should write the step line with 415 and the deficit line with 0.9 kg and 0.66%, after the data line and in that order", async () => {
      await renderProgramScreen();
      const card = await findCard("Last check-in, Friday 9 October, measured");

      const texts = textsIn(within(card));
      expect(texts.filter((text) => [dataLine, stepLine, deficitLine].includes(text))).toEqual([
        dataLine,
        stepLine,
        deficitLine,
      ]);
    });

    it("should draw each of the three lines with an icon, and no floor line", async () => {
      await renderProgramScreen();
      const card = await findCard("Last check-in, Friday 9 October, measured");

      expect(drawingsBesideText(card, stepLine)).toBe(1);
      expect(drawingsBesideText(card, deficitLine)).toBe(1);
      expect(within(card).queryByText(/^Raised to/)).not.toBeOnTheScreen();
      expect(within(card).queryByText(doctorLine)).not.toBeOnTheScreen();
    });

    it("should write the step line with the size of the drop and not its sign", async () => {
      await renderProgramScreen();
      const card = await findCard("Last check-in, Friday 9 October, measured");

      expect(within(card).getByText(stepLine)).toBeOnTheScreen();
      expect(within(card).queryByText(/-415|−415/)).not.toBeOnTheScreen();
    });

    it("should write only the floor line when the deficit cap and the floor were both recorded, as the floor set the number", async () => {
      const [open] = diaryBackend.engineTargets;
      if (open === undefined) {
        throw new Error("The check-in has targets");
      }
      diaryBackend.engineTargets = [
        {
          ...open,
          basis: Object.assign({}, open["basis"], { clamps: ["max_deficit", "floor"] }),
        },
        ...diaryBackend.engineTargets.slice(1),
      ];
      await renderProgramScreen();
      const card = await findCard("Last check-in, Friday 9 October, measured");

      expect(within(card).getByText(/^Raised to 2,220 kcal/)).toBeOnTheScreen();
      expect(within(card).queryByText(/^Kept to a 30% deficit/)).not.toBeOnTheScreen();
    });

    it("should write the deficit line once, the one guardrail that set the number", async () => {
      await renderProgramScreen();
      const card = await findCard("Last check-in, Friday 9 October, measured");

      expect(within(card).getAllByText(/^Kept to a/)).toHaveLength(1);
    });
  });

  describe("guardrails, the floor above expenditure (checkin-summary: guardrail, B)", () => {
    beforeEach(() => {
      showFloorAboveExpenditureCheckin();
    });

    it("should say the expenditure fell from 1,112 to 1,094 kcal and the calorie target stayed at 1,200 kcal", async () => {
      await renderProgramScreen();
      const card = await findCard("Last check-in, Friday 9 October, measured");

      expect(within(card).getByLabelText("Expenditure: 1,112 to 1,094 kcal")).toBeOnTheScreen();
      expect(
        within(card).getByLabelText("Calorie target: 1,200 kcal, no change"),
      ).toBeOnTheScreen();
    });

    it("should write the floor line for an expenditure below it, and the advice as a plain line with no icon", async () => {
      await renderProgramScreen();
      const card = await findCard("Last check-in, Friday 9 October, measured");

      expect(within(card).getByText(floorLine)).toBeOnTheScreen();
      expect(within(card).getByText(doctorLine)).toBeOnTheScreen();
      expect(drawingsBesideText(card, floorLine)).toBe(1);
      expect(drawingsBesideText(card, doctorLine)).toBe(0);
    });

    it("should put the advice straight after the floor line", async () => {
      await renderProgramScreen();
      const card = await findCard("Last check-in, Friday 9 October, measured");

      const texts = textsIn(within(card));
      expect(texts.indexOf(doctorLine)).toBe(texts.indexOf(floorLine) + 1);
    });

    it("should write no line for the step, which the weekly cap did not cut", async () => {
      await renderProgramScreen();
      const card = await findCard("Last check-in, Friday 9 October, measured");

      expect(within(card).queryByText(/most it moves in one week/)).not.toBeOnTheScreen();
    });
  });

  describe("a check-in that could not measure, 9 complete days (checkin-summary: not-measured, left)", () => {
    beforeEach(() => {
      showNineCompleteDaysCheckin();
    });

    it("should be named as not measured and carry the Not measured badge", async () => {
      await renderProgramScreen();
      const card = await findCard("Last check-in, Friday 9 October, not measured");

      expect(within(card).getByText("Not measured")).toBeOnTheScreen();
      expect(within(card).queryByText("Measured")).not.toBeOnTheScreen();
    });

    it("should say the expenditure was carried forward at 2,500 kcal and the calorie target stayed at 2,060 kcal", async () => {
      await renderProgramScreen();
      const card = await findCard("Last check-in, Friday 9 October, not measured");

      expect(
        within(card).getByLabelText("Expenditure: 2,500 kcal, carried forward"),
      ).toBeOnTheScreen();
      expect(
        within(card).getByLabelText("Calorie target: 2,060 kcal, no change"),
      ).toBeOnTheScreen();
    });

    it("should give the one reason, then the carried-forward line with the likely range, and no data line", async () => {
      await renderProgramScreen();
      const card = await findCard("Last check-in, Friday 9 October, not measured");

      const reason =
        "You completed 9 days. A check-in needs at least 10 complete days in the last 4 weeks.";
      const texts = textsIn(within(card));
      expect(texts.filter((text) => [reason, carriedForwardLine].includes(text))).toEqual([
        reason,
        carriedForwardLine,
      ]);
      expect(within(card).queryByText(/^From your weight trend/)).not.toBeOnTheScreen();
    });

    it("should draw the reason with an icon and the carried-forward line without one", async () => {
      await renderProgramScreen();
      const card = await findCard("Last check-in, Friday 9 October, not measured");

      expect(
        drawingsBesideText(
          card,
          "You completed 9 days. A check-in needs at least 10 complete days in the last 4 weeks.",
        ),
      ).toBe(1);
      expect(drawingsBesideText(card, carriedForwardLine)).toBe(0);
    });
  });

  describe("a check-in that could not measure, too few weigh-ins (checkin-summary: not-measured, right)", () => {
    beforeEach(() => {
      showFiveWeighInDaysCheckin();
    });

    it("should give the span line, then the weigh-days line, then the carried-forward line", async () => {
      await renderProgramScreen();
      const card = await findCard("Last check-in, Friday 9 October, not measured");

      const span =
        "Your weigh-ins cover 9 days, first to last. A check-in needs them to cover at least 14.";
      const weighDays =
        "You weighed in on 5 days. A check-in needs at least 8 in the last 4 weeks.";
      const texts = textsIn(within(card));
      expect(texts.filter((text) => [span, weighDays, carriedForwardLine].includes(text))).toEqual([
        span,
        weighDays,
        carriedForwardLine,
      ]);
      expect(within(card).queryByText(/^You completed/)).not.toBeOnTheScreen();
    });
  });

  describe("after an edit or a recalculation, when the current targets are a recompute row (program: default)", () => {
    beforeEach(() => {
      showGoldenFirstCheckin({ recomputedOn: "2026-10-12", ratePctPerWeek: 0.25 });
    });

    it("should still describe the check-in with its own targets row and the one before it", async () => {
      await renderProgramScreen();
      const card = await findCard("Last check-in, Friday 9 October, measured");

      expect(within(card).getByLabelText("Calorie target: 2,060 to 2,120 kcal")).toBeOnTheScreen();
      expect(within(card).getByLabelText("Expenditure: 2,500 to 2,560 kcal")).toBeOnTheScreen();
    });

    it("should leave this week's targets card with the recompute row's calories", async () => {
      await renderProgramScreen();
      await findCard("Last check-in, Friday 9 October, measured");

      expect(
        screen.getByLabelText("This week's targets, 2,340 kilocalories a day"),
      ).toBeOnTheScreen();
    });
  });

  describe("after an edit on the day of the check-in, which replaces the check-in's row on the same day", () => {
    beforeEach(() => {
      showGoldenFirstCheckin({ recomputedOn: "2026-10-09", ratePctPerWeek: 0.25 });
    });

    it("should still describe the check-in, though its row held for no days", async () => {
      await renderProgramScreen();
      const card = await findCard("Last check-in, Friday 9 October, measured");

      expect(within(card).getByLabelText("Calorie target: 2,060 to 2,120 kcal")).toBeOnTheScreen();
      expect(within(card).getByLabelText("Expenditure: 2,500 to 2,560 kcal")).toBeOnTheScreen();
      expect(
        screen.getByLabelText("This week's targets, 2,340 kilocalories a day"),
      ).toBeOnTheScreen();
    });
  });

  describe("the expenditure before the check-in, from any programme", () => {
    const endedProgrammeSnapshot = {
      id: "66666666-6666-4666-8666-666666666650",
      program_id: "99999999-9999-4999-8999-999999999999",
      as_of_date: "2026-09-04",
      kind: "checkin",
      mu_kcal: 2450,
      var_kcal2: 90000,
      measurement: {
        eligible: false,
        reasons: ["span"],
        spanDays: 1,
        weighDays: 1,
        completeDays: 0,
      },
    };

    it("should move from the ended programme's estimate for a user who returned within 28 days and has no start snapshot", async () => {
      showGoldenFirstCheckin();
      programBackend.snapshots = [
        endedProgrammeSnapshot,
        ...programBackend.snapshots.filter((row) => row["kind"] === "checkin"),
      ];
      await renderProgramScreen();
      const card = await findCard("Last check-in, Friday 9 October, measured");

      expect(within(card).getByLabelText("Expenditure: 2,450 to 2,560 kcal")).toBeOnTheScreen();
    });

    it("should move from the newest snapshot before the check-in, so a snapshot of this programme wins over an older one of the ended programme", async () => {
      showGoldenFirstCheckin();
      programBackend.snapshots = [endedProgrammeSnapshot, ...programBackend.snapshots];
      await renderProgramScreen();
      const card = await findCard("Last check-in, Friday 9 October, measured");

      expect(within(card).getByLabelText("Expenditure: 2,500 to 2,560 kcal")).toBeOnTheScreen();
    });
  });

  describe("the guardrails a check-in records that the canvas does not draw (injected clamps)", () => {
    function recordClamps(clamps: string[]) {
      const [open, ...rest] = diaryBackend.engineTargets;
      if (open === undefined) {
        throw new Error("The check-in has targets");
      }
      diaryBackend.engineTargets = [
        { ...open, basis: Object.assign({}, open["basis"], { clamps }) },
        ...rest,
      ];
    }

    beforeEach(() => {
      showGoldenFirstCheckin();
    });

    it.each([
      [
        "dow_floor",
        "Some days were raised to 1,580 kcal, the lowest daily target Ki-Lo sets for you.",
      ],
      ["dow_range", "Some days were kept between 800 and 6,000 kcal, the range Ki-Lo sets."],
      [
        "macro_fit",
        "Protein was lowered to 127 g so that it fits in 2,120 kcal with the least fat Ki-Lo sets (72 g). Carbohydrate is 0 g.",
      ],
      ["max_rate", "Set to 1.0% a week, the fastest Ki-Lo sets for losing weight."],
      // The golden case never records this clamp. It is injected, so this sentence pins the wiring of the
      // figures (calories, weight, rates), and not a situation a person can be in.
      [
        "profile_max",
        "Capped at 2,120 kcal, the most Ki-Lo sets. You would gain about 0.4 kg a week (0.50% of your weight), not 0.5%.",
      ],
    ])("should write the %s line with its figures", async (clamp, line) => {
      recordClamps([clamp]);
      await renderProgramScreen();
      const card = await findCard("Last check-in, Friday 9 October, measured");

      expect(within(card).getByText(line)).toBeOnTheScreen();
    });

    it("should write the rate line, then the day lines, then the protein line", async () => {
      recordClamps(["macro_fit", "dow_range", "dow_floor", "max_rate"]);
      await renderProgramScreen();
      const card = await findCard("Last check-in, Friday 9 October, measured");

      expect(
        textsIn(within(card)).filter((text) => /^(Set to|Some days|Protein was)/.test(text)),
      ).toEqual([
        "Set to 1.0% a week, the fastest Ki-Lo sets for losing weight.",
        "Some days were raised to 1,580 kcal, the lowest daily target Ki-Lo sets for you.",
        "Some days were kept between 800 and 6,000 kcal, the range Ki-Lo sets.",
        "Protein was lowered to 127 g so that it fits in 2,120 kcal with the least fat Ki-Lo sets (72 g). Carbohydrate is 0 g.",
      ]);
    });
  });

  describe("for a user who reads pounds", () => {
    it("should state the weekly amount in pounds in the deficit line", async () => {
      showMaxDeficitCheckin();
      programBackend.weightUnit = "lb";
      await renderProgramScreen();
      const card = await findCard("Last check-in, Friday 9 October, measured");

      expect(
        within(card).getByText(
          "Kept to a 30% deficit, the most Ki-Lo sets. You would lose about 1.9 lb a week (0.66% of your weight), not 1.0%.",
        ),
      ).toBeOnTheScreen();
    });
  });

  describe("when there is no check-in to describe", () => {
    async function settle() {
      await screen.findByText("Estimated expenditure");
      await act(async () => {
        await new Promise((resolve) => setTimeout(resolve, 150));
      });
    }

    it("should not show for a programme whose newest snapshot is its start", async () => {
      showGoldenFirstCheckin();
      programBackend.snapshots = programBackend.snapshots.filter((row) => row["kind"] === "start");
      await renderProgramScreen();
      await settle();

      expect(screen.queryByLabelText(/^Last check-in/)).not.toBeOnTheScreen();
    });

    it("should not show when the targets history cannot be read, and leave the rest of the screen as it was", async () => {
      showGoldenFirstCheckin();
      programBackend.targetsHistoryFails = true;
      await renderProgramScreen();
      await settle();

      expect(screen.queryByLabelText(/^Last check-in/)).not.toBeOnTheScreen();
      expect(screen.getByLabelText(/^Estimated expenditure, /)).toBeOnTheScreen();
    });

    it("should not show when no targets row came from the check-in", async () => {
      showGoldenFirstCheckin();
      diaryBackend.engineTargets = diaryBackend.engineTargets.map((row) => ({
        ...row,
        basis: Object.assign({}, row["basis"], { source: "recompute" }),
      }));
      await renderProgramScreen();
      await settle();

      expect(screen.queryByLabelText(/^Last check-in/)).not.toBeOnTheScreen();
    });

    it("should not compare the check-in with the targets of a programme that ended", async () => {
      showGoldenFirstCheckin();
      // The programme's own start row is gone, and the row before the check-in's is the ended programme's.
      diaryBackend.engineTargets = diaryBackend.engineTargets.map((row) =>
        row["effective_to"] === "2026-10-09"
          ? {
              ...row,
              effective_from: "2026-08-01",
              program_id: "99999999-9999-4999-8999-999999999999",
            }
          : row,
      );
      await renderProgramScreen();
      await settle();

      expect(screen.queryByLabelText(/^Last check-in/)).not.toBeOnTheScreen();
    });

    it("should not show when no snapshot of any programme came before the check-in, which has no expenditure to move from", async () => {
      showGoldenFirstCheckin();
      programBackend.snapshots = programBackend.snapshots.filter(
        (row) => row["kind"] === "checkin",
      );
      await renderProgramScreen();
      await settle();

      expect(screen.queryByLabelText(/^Last check-in/)).not.toBeOnTheScreen();
    });
  });

  describe("the golden fixture after its third check-in (program: default)", () => {
    it("should say the expenditure moved from 2,574 to 2,580 kcal, the calorie target stayed at 2,140 kcal and 28 days were counted", async () => {
      showGoldenProgram();
      await renderProgramScreen();
      const card = await findCard("Last check-in, Friday 23 October, measured");

      expect(within(card).getByLabelText("Expenditure: 2,574 to 2,580 kcal")).toBeOnTheScreen();
      expect(
        within(card).getByLabelText("Calorie target: 2,140 kcal, no change"),
      ).toBeOnTheScreen();
      expect(
        within(card).getByText(
          "From your weight trend and the food you logged: 28 weigh-ins and 28 complete days in the last 4 weeks.",
        ),
      ).toBeOnTheScreen();
    });
  });

  describe("reduced motion", () => {
    it("should not change what the card says", async () => {
      jest.spyOn(AccessibilityInfo, "isReduceMotionEnabled").mockResolvedValue(true);
      showGoldenFirstCheckin();
      await renderProgramScreen();

      expect(await findCard("Last check-in, Friday 9 October, measured")).toBeOnTheScreen();
    });
  });
});
