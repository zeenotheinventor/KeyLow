import { KeyLowProvider } from "@keylow/api-client";
import { act, render, screen, userEvent } from "@testing-library/react-native";

import { ProgramScreen } from "../components/ProgramScreen";
import { ThemeProvider } from "../lib/theme";
import {
  completeDayLog,
  createDiaryQueryClient,
  dayTotalsRow,
  diaryBackend,
  resetDiaryBackend,
} from "./support/diaryBackend";
import { resetRouterMock, routerMock } from "./support/expoRouterMock";
import {
  programBackend,
  programClient,
  resetProgramBackend,
  showGoldenProgram,
  showProgramWithoutSnapshot,
  showSettlingProgram,
} from "./support/programBackend";

jest.mock("@react-native-async-storage/async-storage", () => ({
  __esModule: true,
  default: { getItem: () => Promise.resolve(null), setItem: () => Promise.resolve() },
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

// Moves the date the screen reads to the day a test names and leaves every timer running.
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

const FRIDAY_23_OCTOBER = "2026-10-23T09:00:00Z";
const WEDNESDAY_28_OCTOBER = "2026-10-28T09:00:00Z";

const NOT_MEDICAL_ADVICE =
  "Ki-Lo's estimates and targets are not medical advice. Speak to a doctor before you make big changes to your diet or your weight.";

function setToday(now: string) {
  jest.useFakeTimers({ now: new Date(now), doNotFake: [...ONLY_THE_DATE] });
}

async function renderProgramScreen() {
  await render(
    <ThemeProvider fixedPreference="dark">
      <KeyLowProvider client={programClient} queryClient={createDiaryQueryClient()}>
        <ProgramScreen />
      </KeyLowProvider>
    </ThemeProvider>,
  );
}

// The cards are named by their eyebrow and value, so a screen reader reads one sentence for each.
const heroName = (name: string) => screen.findByLabelText(name);

type Instance = NonNullable<ReturnType<typeof screen.getByText>>;

function isInside(node: Instance | null, ancestor: Instance): boolean {
  return node !== null && (node === ancestor || isInside(node.parent, ancestor));
}

// The icons are decoration with no role, so the drawings inside a line's own row are counted.
function drawingsBesideText(text: string): number {
  const row = screen.getByText(text).parent;
  if (row === null) {
    return 0;
  }
  return (
    screen.root?.queryAll((node) => node.type === "RNSVGSvgView" && isInside(node, row)) ?? []
  ).length;
}

// Every piece of text on the screen, top to bottom, so a test can say what sits under what.
type RenderedNode = string | { children: readonly RenderedNode[] | null };

function textsInOrder(node: RenderedNode | readonly RenderedNode[] | null): string[] {
  if (node === null) {
    return [];
  }
  if (typeof node === "string") {
    return [node];
  }
  if ("children" in node) {
    return textsInOrder(node.children);
  }
  return node.flatMap((child) => textsInOrder(child));
}

describe("the Programme screen", () => {
  beforeEach(() => {
    resetRouterMock();
    resetDiaryBackend();
    resetProgramBackend();
  });

  afterEach(async () => {
    jest.useRealTimers();
    await act(async () => {
      await new Promise((resolve) => setTimeout(resolve, 0));
    });
  });

  describe("while the terms are not accepted", () => {
    beforeEach(() => {
      showGoldenProgram();
      diaryBackend.terms = { terms_accepted_at: null, terms_version: null };
    });

    it("should read nothing of the programme, and say it is loading", async () => {
      await renderProgramScreen();
      // Lets any read that was wrongly started reach the fake database.
      await act(async () => {
        await new Promise((resolve) => setTimeout(resolve, 0));
      });

      expect(screen.getByRole("status", { name: "Loading your programme" })).toBeOnTheScreen();
      expect(
        diaryBackend.requests.filter((request) => !request.search.includes("terms_accepted_at")),
      ).toEqual([]);
    });
  });

  describe("its header", () => {
    beforeEach(() => {
      diaryBackend.hungTables.add("programs");
    });

    it("should be headed Programme", async () => {
      await renderProgramScreen();

      expect(screen.getByRole("heading", { name: "Programme" })).toBeOnTheScreen();
    });

    it("should go back when Back to More is pressed", async () => {
      const user = userEvent.setup();
      await renderProgramScreen();

      await user.press(screen.getByRole("button", { name: "Back to More" }));

      expect(routerMock.back).toHaveBeenCalledTimes(1);
    });

    it("should go to More when a link opened it cold, with nothing to go back to", async () => {
      const user = userEvent.setup();
      routerMock.canGoBack.mockReturnValue(false);
      await renderProgramScreen();

      await user.press(screen.getByRole("button", { name: "Back to More" }));

      expect(routerMock.back).not.toHaveBeenCalled();
      expect(routerMock.replace).toHaveBeenCalledWith("/(tabs)/more");
    });
  });

  describe("with the golden fixture after its third check-in (program: default)", () => {
    beforeEach(() => {
      setToday(FRIDAY_23_OCTOBER);
      showGoldenProgram();
    });

    it("should name the hero by its estimate and its likely range", async () => {
      await renderProgramScreen();

      expect(
        await heroName(
          "Estimated expenditure, 2,580 kilocalories a day, likely 2,430 to 2,730 kcal",
        ),
      ).toBeOnTheScreen();
    });

    it("should not show what the first check-in needs", async () => {
      await renderProgramScreen();
      await screen.findByText("2,580");

      expect(screen.queryByRole("progressbar")).not.toBeOnTheScreen();
      expect(screen.queryByText(/^First check-in Friday/)).not.toBeOnTheScreen();
    });

    it("should show 2,580 kcal with its likely range and the Estimate badge, and no Settling badge", async () => {
      await renderProgramScreen();
      await screen.findByText("2,580");

      expect(screen.getByText("Likely 2,430 to 2,730 kcal")).toBeOnTheScreen();
      expect(screen.getByText("Estimate")).toBeOnTheScreen();
      expect(screen.queryByText("Settling")).not.toBeOnTheScreen();
    });

    it("should say where the estimate comes from and when it was updated", async () => {
      await renderProgramScreen();

      expect(
        await screen.findByText("From your weigh-ins and food log, updated Friday 23 October"),
      ).toBeOnTheScreen();
    });

    it("should show this week's targets, since the day the check-in set them", async () => {
      await renderProgramScreen();

      expect(
        await screen.findByLabelText("This week's targets, 2,140 kilocalories a day"),
      ).toBeOnTheScreen();
      expect(screen.getByText("2,140")).toBeOnTheScreen();
      expect(screen.getByText("Since Fri 23 Oct")).toBeOnTheScreen();
    });

    it("should say what the target is worth a week, at the weight the targets use", async () => {
      await renderProgramScreen();

      expect(
        await screen.findByText("To lose about 0.4 kg a week (0.5% of your weight)."),
      ).toBeOnTheScreen();
    });

    it("should say it in pounds for a user who reads pounds", async () => {
      programBackend.weightUnit = "lb";
      await renderProgramScreen();

      expect(
        await screen.findByText("To lose about 0.9 lb a week (0.5% of your weight)."),
      ).toBeOnTheScreen();
    });

    it("should show the three macros of the targets", async () => {
      await renderProgramScreen();

      expect(await screen.findByLabelText("Protein, 126 g")).toBeOnTheScreen();
      expect(screen.getByLabelText("Carbohydrate, 245 g")).toBeOnTheScreen();
      expect(screen.getByLabelText("Fat, 73 g")).toBeOnTheScreen();
    });

    it("should show the next check-in, in 7 days and then every Friday", async () => {
      await renderProgramScreen();

      expect(
        await screen.findByLabelText("Next check-in, In 7 days, then every Friday, Fri 30 Oct"),
      ).toBeOnTheScreen();
    });

    it("should list the programme's goal, rate, protein and diet style as information", async () => {
      await renderProgramScreen();

      expect(await screen.findByLabelText("Goal, Lose weight")).toBeOnTheScreen();
      expect(screen.getByLabelText("Rate, About 0.4 kg a week, 0.5% a week")).toBeOnTheScreen();
      expect(
        screen.getByLabelText("Protein, 1.6 g per kg, about 126 g a day, Moderate"),
      ).toBeOnTheScreen();
      expect(screen.getByLabelText("Diet style, Balanced")).toBeOnTheScreen();
      expect(screen.getByRole("heading", { name: "Your programme" })).toBeOnTheScreen();
    });

    it("should end with the not-medical-advice line", async () => {
      await renderProgramScreen();

      expect(await screen.findByText(NOT_MEDICAL_ADVICE)).toBeOnTheScreen();
    });

    it("should offer How it works under the programme's details, and not Edit programme yet", async () => {
      await renderProgramScreen();
      await screen.findByText("2,580");

      const texts = textsInOrder(screen.toJSON());
      expect(texts.indexOf("How it works")).toBeGreaterThan(texts.indexOf("Diet style"));
      expect(texts.indexOf("How it works")).toBeLessThan(texts.indexOf(NOT_MEDICAL_ADVICE));
      expect(screen.getByRole("button", { name: "How it works" })).toBeOnTheScreen();
      expect(screen.queryByText("Edit programme")).not.toBeOnTheScreen();
    });

    it("should open the explainer when How it works is pressed", async () => {
      const user = userEvent.setup();
      await renderProgramScreen();

      await user.press(await screen.findByRole("button", { name: "How it works" }));

      expect(routerMock.push).toHaveBeenCalledWith("/more/program/explainer");
    });

    it("should open the explainer once for two quick presses", async () => {
      const user = userEvent.setup();
      await renderProgramScreen();
      const row = await screen.findByRole("button", { name: "How it works" });

      await user.press(row);
      await user.press(row);

      expect(routerMock.push).toHaveBeenCalledTimes(1);
    });

    it("should show a guardrail line in place of the rate line when a guardrail set the target", async () => {
      const [openRow] = diaryBackend.engineTargets;
      if (openRow === undefined) {
        throw new Error("The golden program has targets");
      }
      diaryBackend.engineTargets = [
        {
          ...openRow,
          basis: Object.assign({}, openRow["basis"], {
            clamps: ["max_deficit"],
            ratePctPerWeek: 1,
            effectiveRatePctPerWeek: 0.66,
            trendWeightKg: 130,
          }),
        },
      ];
      await renderProgramScreen();

      expect(
        await screen.findByText(
          "Kept to a 30% deficit, the most Ki-Lo sets. You would lose about 0.9 kg a week (0.66% of your weight), not 1.0%.",
        ),
      ).toBeOnTheScreen();
      expect(screen.queryByText(/^To lose about/)).not.toBeOnTheScreen();
      expect(
        drawingsBesideText(
          "Kept to a 30% deficit, the most Ki-Lo sets. You would lose about 0.9 kg a week (0.66% of your weight), not 1.0%.",
        ),
      ).toBe(1);
    });

    it("should draw no icon before the plain rate line", async () => {
      await renderProgramScreen();
      await screen.findByText("To lose about 0.4 kg a week (0.5% of your weight).");

      expect(drawingsBesideText("To lose about 0.4 kg a week (0.5% of your weight).")).toBe(0);
    });

    it("should keep the weight and say it is maintained, with no Rate row, for a maintain goal", async () => {
      const [row] = diaryBackend.programs;
      diaryBackend.programs = [{ ...row, goal: "maintain", rate_pct_per_week: 0 }];
      await renderProgramScreen();

      expect(await screen.findByLabelText("Goal, Maintain weight")).toBeOnTheScreen();
      expect(screen.queryByLabelText(/^Rate, /)).not.toBeOnTheScreen();
      expect(screen.getByText("To keep your weight about where it is.")).toBeOnTheScreen();
    });

    it("should count the days to the check-in from today in the profile's own zone", async () => {
      // 12:00 UTC is already Saturday 24 October in Auckland, and still Friday 23 October in London.
      setToday("2026-10-23T12:00:00Z");
      diaryBackend.timezone = "Pacific/Auckland";
      await renderProgramScreen();

      expect(
        await screen.findByLabelText("Next check-in, In 6 days, then every Friday, Fri 30 Oct"),
      ).toBeOnTheScreen();
    });
  });

  describe("settling, with the setup canvas's sample man on 28 October (program: settling)", () => {
    beforeEach(() => {
      setToday(WEDNESDAY_28_OCTOBER);
      showSettlingProgram();
    });

    it("should name the hero by his starting estimate and its wide likely range", async () => {
      await renderProgramScreen();

      expect(
        await heroName(
          "Estimated expenditure, 2,413 kilocalories a day, likely 1,950 to 2,880 kcal",
        ),
      ).toBeOnTheScreen();
    });

    it("should show 2,413 kcal with its likely range, and the Settling and Estimate badges", async () => {
      await renderProgramScreen();
      await screen.findByText("2,413");

      expect(screen.getByText("Likely 1,950 to 2,880 kcal")).toBeOnTheScreen();
      expect(screen.getByText("Settling")).toBeOnTheScreen();
      expect(screen.getByText("Estimate")).toBeOnTheScreen();
    });

    it("should say the estimate is a start that the first check-in measures", async () => {
      await renderProgramScreen();

      expect(
        await screen.findByText(
          "A starting estimate from your answers. Your first check-in measures it.",
        ),
      ).toBeOnTheScreen();
      expect(screen.queryByText(/updated/)).not.toBeOnTheScreen();
    });

    it("should show the targets of the start: 1,970 kcal, protein 128, carbohydrate 218 and fat 65", async () => {
      await renderProgramScreen();

      expect(
        await screen.findByLabelText("This week's targets, 1,970 kilocalories a day"),
      ).toBeOnTheScreen();
      expect(screen.getByLabelText("Protein, 128 g")).toBeOnTheScreen();
      expect(screen.getByLabelText("Carbohydrate, 218 g")).toBeOnTheScreen();
      expect(screen.getByLabelText("Fat, 65 g")).toBeOnTheScreen();
      expect(screen.getByText("Since Fri 23 Oct")).toBeOnTheScreen();
    });

    it("should show the first check-in, in 9 days and then every Friday", async () => {
      await renderProgramScreen();

      expect(
        await screen.findByLabelText("First check-in, In 9 days, then every Friday, Fri 6 Nov"),
      ).toBeOnTheScreen();
      expect(screen.queryByLabelText(/^Next check-in/)).not.toBeOnTheScreen();
    });

    describe("what the first check-in needs (program: settling)", () => {
      beforeEach(() => {
        programBackend.weighIns = ["2026-10-28", "2026-10-27", "2026-10-25", "2026-10-23"].map(
          (localDate) => ({ weight_kg: 80, local_date: localDate }),
        );
        diaryBackend.dayLogs = ["2026-10-23", "2026-10-24", "2026-10-26", "2026-10-27"].map(
          completeDayLog,
        );
        diaryBackend.dayTotals = ["2026-10-23", "2026-10-24", "2026-10-26", "2026-10-27"].map(
          (localDate) => dayTotalsRow(localDate, [2000, 100, 200, 70]),
        );
      });

      it("should show the first check-in's date and the three counts of the canvas case", async () => {
        await renderProgramScreen();

        expect(
          await screen.findByText("First check-in Friday 6 November, in 9 days"),
        ).toBeOnTheScreen();
        expect(
          screen.getByText("Until then your targets stay as they are. The check-in needs:"),
        ).toBeOnTheScreen();
        expect(
          screen.getByRole("progressbar", { name: "Days with a weigh-in, 4 of 8" }),
        ).toBeOnTheScreen();
        expect(
          screen.getByRole("progressbar", { name: "Days your weigh-ins cover, 6 of 14" }),
        ).toBeOnTheScreen();
        expect(
          screen.getByRole("progressbar", { name: "Complete days, 4 of 10" }),
        ).toBeOnTheScreen();
        expect(
          screen.getByText(
            "Weigh in on Thursday 5 November, the day before, so your weigh-ins cover the full 14 days.",
          ),
        ).toBeOnTheScreen();
      });

      it("should sit under the hero and above this week's targets", async () => {
        await renderProgramScreen();
        await screen.findByText("First check-in Friday 6 November, in 9 days");

        const texts = textsInOrder(screen.toJSON());
        const at = (text: string) => texts.indexOf(text);

        expect(at("Likely 1,950 to 2,880 kcal")).toBeGreaterThan(-1);
        expect(at("First check-in Friday 6 November, in 9 days")).toBeGreaterThan(
          at("Likely 1,950 to 2,880 kcal"),
        );
        expect(at("This week's targets")).toBeGreaterThan(
          at("First check-in Friday 6 November, in 9 days"),
        );
      });

      it("should not show once a check-in has been made, whether it measured or not", async () => {
        programBackend.snapshots = [
          ...programBackend.snapshots,
          {
            id: "66666666-6666-4666-8666-666666666697",
            program_id: "55555555-5555-4555-8555-555555555555",
            as_of_date: "2026-10-27",
            kind: "checkin",
            mu_kcal: 2413.125,
            var_kcal2: 136000,
            measurement: {
              eligible: false,
              reasons: ["complete_days"],
              spanDays: 14,
              weighDays: 14,
              completeDays: 9,
            },
          },
        ];
        await renderProgramScreen();
        await screen.findByText("2,413");
        // Long enough for any read that was wrongly started to answer.
        await act(async () => {
          await new Promise((resolve) => setTimeout(resolve, 150));
        });

        expect(screen.queryByText(/^First check-in Friday/)).not.toBeOnTheScreen();
        expect(screen.queryByRole("progressbar")).not.toBeOnTheScreen();
        expect(screen.queryByText(/Weigh in on/)).not.toBeOnTheScreen();
      });
    });

    it("should not be settling once a check-in that could not measure exists, so its Not measured card can show", async () => {
      programBackend.snapshots = [
        ...programBackend.snapshots,
        {
          id: "66666666-6666-4666-8666-666666666699",
          program_id: "55555555-5555-4555-8555-555555555555",
          as_of_date: "2026-10-27",
          kind: "checkin",
          mu_kcal: 2413.125,
          var_kcal2: 136000,
          measurement: {
            eligible: false,
            reasons: ["complete_days"],
            spanDays: 14,
            weighDays: 14,
            completeDays: 9,
          },
        },
      ];
      await renderProgramScreen();
      await screen.findByText("2,413");

      expect(screen.queryByText("Settling")).not.toBeOnTheScreen();
      expect(screen.getByLabelText(/^Next check-in/)).toBeOnTheScreen();
      expect(
        screen.getByText("From your weigh-ins and food log, updated Tuesday 27 October"),
      ).toBeOnTheScreen();
    });

    it("should let a check-in win a tie with the start snapshot of the same day", async () => {
      programBackend.snapshots = [
        ...programBackend.snapshots,
        {
          id: "66666666-6666-4666-8666-666666666698",
          program_id: "55555555-5555-4555-8555-555555555555",
          as_of_date: "2026-10-23",
          kind: "checkin",
          mu_kcal: 2413.125,
          var_kcal2: 131021.4,
          measurement: {
            eligible: false,
            reasons: ["span"],
            spanDays: 1,
            weighDays: 1,
            completeDays: 0,
          },
        },
      ];
      await renderProgramScreen();
      await screen.findByText("2,413");

      expect(screen.queryByText("Settling")).not.toBeOnTheScreen();
    });
  });

  describe("with a programme and no snapshot yet, between the wizard's save and its first recompute", () => {
    beforeEach(() => {
      setToday(FRIDAY_23_OCTOBER);
      showProgramWithoutSnapshot();
    });

    it("should show the settling hero worked out from the saved stats, and not an error", async () => {
      await renderProgramScreen();

      expect(
        await heroName(
          "Estimated expenditure, 2,413 kilocalories a day, likely 1,950 to 2,880 kcal",
        ),
      ).toBeOnTheScreen();
      expect(screen.getByText("Settling")).toBeOnTheScreen();
      expect(screen.getByText("Estimate")).toBeOnTheScreen();
      expect(screen.queryByRole("alert")).not.toBeOnTheScreen();
    });

    it("should show the targets the account holds, as the targets read gives them", async () => {
      await renderProgramScreen();

      expect(
        await screen.findByLabelText("This week's targets, 1,970 kilocalories a day"),
      ).toBeOnTheScreen();
      expect(screen.getByLabelText("Protein, 128 g")).toBeOnTheScreen();
      expect(screen.getByLabelText("Carbohydrate, 218 g")).toBeOnTheScreen();
      expect(screen.getByLabelText("Fat, 65 g")).toBeOnTheScreen();
      expect(screen.getByText("Since Fri 23 Oct")).toBeOnTheScreen();
    });

    it("should say what the target is worth a week, and the rate and protein in grams, at the saved weight", async () => {
      await renderProgramScreen();

      expect(
        await screen.findByText("To lose about 0.4 kg a week (0.5% of your weight)."),
      ).toBeOnTheScreen();
      expect(screen.getByLabelText("Rate, About 0.4 kg a week, 0.5% a week")).toBeOnTheScreen();
      expect(
        screen.getByLabelText("Protein, 1.6 g per kg, about 128 g a day, Moderate"),
      ).toBeOnTheScreen();
    });

    it("should show no check-in row while there is no date for it", async () => {
      await renderProgramScreen();
      await screen.findByText("2,413");

      expect(screen.queryByLabelText(/check-in, /)).not.toBeOnTheScreen();
      expect(screen.queryByRole("progressbar")).not.toBeOnTheScreen();
    });
  });

  describe("with no programme (program: no-program)", () => {
    it("should offer to set the targets, in the words of the board", async () => {
      await renderProgramScreen();

      expect(
        await screen.findByRole("heading", { name: "Let Ki-Lo set your targets" }),
      ).toBeOnTheScreen();
      expect(
        screen.getByText(
          "A programme sets your calorie and macro targets from your goal, then checks them each week.",
        ),
      ).toBeOnTheScreen();
    });

    it("should list what a programme does in three points", async () => {
      await renderProgramScreen();
      await screen.findByRole("heading", { name: "Let Ki-Lo set your targets" });

      [
        "Estimates the energy you use, from a few questions about you.",
        "Checks that estimate each week against your weigh-ins and food log.",
        "Adjusts your calorie and macro targets to keep you on pace for your goal.",
      ].forEach((point) => {
        expect(screen.getByText(point)).toBeOnTheScreen();
      });
    });

    it("should open the wizard in recalculate mode when Estimate my targets is pressed", async () => {
      const user = userEvent.setup();
      await renderProgramScreen();

      await user.press(await screen.findByRole("button", { name: "Estimate my targets" }));

      expect(routerMock.push).toHaveBeenCalledWith("/setup?mode=recalculate");
    });

    it("should say the user's own targets stay until they start, when they have one", async () => {
      await renderProgramScreen();

      expect(
        await screen.findByText("Your own targets (2,200 kcal a day) stay until you start."),
      ).toBeOnTheScreen();
    });

    it("should say nothing about own targets when there is none", async () => {
      diaryBackend.targets = {
        target_kcal: null,
        target_protein_g: null,
        target_carbs_g: null,
        target_fat_g: null,
      };
      await renderProgramScreen();
      await screen.findByRole("heading", { name: "Let Ki-Lo set your targets" });

      expect(screen.queryByText(/Your own targets/)).not.toBeOnTheScreen();
    });

    it("should carry the not-medical-advice line", async () => {
      await renderProgramScreen();

      expect(await screen.findByText(NOT_MEDICAL_ADVICE)).toBeOnTheScreen();
    });

    it("should scroll, so a short phone or large text never clips the button or the line", async () => {
      await renderProgramScreen();
      await screen.findByRole("heading", { name: "Let Ki-Lo set your targets" });

      expect(screen.root?.queryAll((node) => node.type === "RCTScrollView")).toHaveLength(1);
    });
  });

  describe("when the programme cannot be read (program: error)", () => {
    beforeEach(() => {
      diaryBackend.failingTables.add("programs");
    });

    it("should say so, with the sentence under it, and offer Try again", async () => {
      await renderProgramScreen();

      expect(
        await screen.findByRole("alert", { name: /Couldn't load your programme/ }),
      ).toBeOnTheScreen();
      expect(
        screen.getByText("Check your connection and try again. Your targets have not changed."),
      ).toBeOnTheScreen();
      expect(screen.getByRole("button", { name: "Try again" })).toBeOnTheScreen();
    });

    it("should show none of the database's own words", async () => {
      await renderProgramScreen();
      await screen.findByRole("button", { name: "Try again" });

      expect(screen.queryByText(/raw database text/)).not.toBeOnTheScreen();
    });

    it("should read again when Try again is pressed, and show what comes back", async () => {
      const user = userEvent.setup();
      await renderProgramScreen();
      await screen.findByRole("button", { name: "Try again" });
      diaryBackend.failingTables.delete("programs");
      showGoldenProgram();

      await user.press(screen.getByRole("button", { name: "Try again" }));

      expect(await screen.findByText("2,580")).toBeOnTheScreen();
    });
  });

  describe("when a read other than the programme's fails", () => {
    it("should show the error state when the targets cannot be read, and read them again on Try again", async () => {
      const user = userEvent.setup();
      diaryBackend.targetsReadFails = true;
      await renderProgramScreen();

      expect(
        await screen.findByRole("alert", { name: /Couldn't load your programme/ }),
      ).toBeOnTheScreen();

      diaryBackend.targetsReadFails = false;
      await user.press(screen.getByRole("button", { name: "Try again" }));

      expect(
        await screen.findByRole("heading", { name: "Let Ki-Lo set your targets" }),
      ).toBeOnTheScreen();
    });

    it("should show the error state when the saved setup cannot be read, and read it again on Try again", async () => {
      const user = userEvent.setup();
      setToday(FRIDAY_23_OCTOBER);
      showProgramWithoutSnapshot();
      diaryBackend.failingTables.add("weigh_ins");
      await renderProgramScreen();

      expect(
        await screen.findByRole("alert", { name: /Couldn't load your programme/ }),
      ).toBeOnTheScreen();

      diaryBackend.failingTables.delete("weigh_ins");
      await user.press(screen.getByRole("button", { name: "Try again" }));

      expect(await screen.findByText("2,413")).toBeOnTheScreen();
    });
  });
});
