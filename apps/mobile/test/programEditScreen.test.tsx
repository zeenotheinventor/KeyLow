import { KeyLowProvider } from "@keylow/api-client";
import {
  act,
  cleanup,
  render,
  screen,
  userEvent,
  waitFor,
  within,
} from "@testing-library/react-native";
import { BackHandler } from "react-native";

import { ProgramEditScreen } from "../components/ProgramEditScreen";
import { ToastProvider } from "../components/ui";
import { ThemeProvider } from "../lib/theme";
import { createDiaryQueryClient, diaryBackend, resetDiaryBackend } from "./support/diaryBackend";
import { resetRouterMock, routerMock } from "./support/expoRouterMock";
import {
  SAMPLE_MAN,
  programBackend,
  resetProgramBackend,
  showGoldenProgram,
  showProgramWithoutSnapshot,
} from "./support/programBackend";
import {
  programEditBackend,
  programEditClient,
  resetProgramEditBackend,
  signInProgramEditClient,
} from "./support/programEditBackend";
import { pressTwiceInTheSameMoment } from "./support/sameTickPress";

import type * as ApiClientModule from "@keylow/api-client";
import type { EditProgramInput } from "@keylow/api-client";
import type { QueryClient } from "@tanstack/react-query";

jest.mock("@react-native-async-storage/async-storage", () => ({
  __esModule: true,
  default: { getItem: () => Promise.resolve(null), setItem: () => Promise.resolve() },
}));
// Records what each save hands to the hook, which the write itself does not show: its day is only an age check.
const mockEditProgramInputs: EditProgramInput[] = [];
jest.mock("@keylow/api-client", () => {
  const actual = jest.requireActual<typeof ApiClientModule>("@keylow/api-client");
  return {
    ...actual,
    useEditProgram: () => {
      const mutation = actual.useEditProgram();
      return {
        ...mutation,
        mutateAsync: (input: EditProgramInput) => {
          mockEditProgramInputs.push(input);
          return mutation.mutateAsync(input);
        },
      };
    },
  };
});
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
const ADULT_BIRTH_DATE = "1991-03-14";
// Sixteen on Friday 23 October 2026, as the canvas draws the golden person.
const SIXTEEN_YEAR_OLD_BIRTH_DATE = "2010-06-02";

const SAVE_FAILED = "Your targets have not changed. Check your connection and try again.";
const FOOTNOTE =
  "Saving changes your targets from today. Your expenditure estimate stays at 2,580 kcal a day.";

// Every piece of text on the screen, top to bottom, so a test can say what sits above what.
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

let queryClient: QueryClient;

async function renderEditProgramme() {
  queryClient = createDiaryQueryClient();
  return render(
    <ThemeProvider fixedPreference="dark">
      <KeyLowProvider client={programEditClient} queryClient={queryClient}>
        <ToastProvider>
          <ProgramEditScreen />
        </ToastProvider>
      </KeyLowProvider>
    </ThemeProvider>,
  );
}

// Weigh-ins one a day, oldest first, ending on Thursday 22 October, as the list read answers: newest first.
function weighInsOf(weightsKg: readonly number[]) {
  return weightsKg
    .map((weight_kg, index) => {
      const day = 22 - (weightsKg.length - 1 - index);
      return { weight_kg, local_date: `2026-10-${String(day).padStart(2, "0")}` };
    })
    .reverse();
}

const STEADY_79_02_KG = [79.02, 79.02, 79.02, 79.02, 79.02];

function showGoldenAdult(
  weightsKg: readonly number[] = STEADY_79_02_KG,
  birthDate: string | null = ADULT_BIRTH_DATE,
) {
  showGoldenProgram();
  programBackend.setupProfile = { ...SAMPLE_MAN.setupProfile, birth_date: birthDate };
  programBackend.weighIns = weighInsOf(weightsKg);
}

async function openForm() {
  await renderEditProgramme();
  await screen.findByRole("button", { name: "Save changes" });
}

const radio = (name: string | RegExp) => screen.getByRole("radio", { name });
// The kit's radio group is a named view that is not itself an accessibility element, so it is found by its name.
const group = (name: string) => screen.getByLabelText(name);
const closeButton = () => screen.getByRole("button", { name: "Close" });
const saveButton = () => screen.getByRole("button", { name: "Save changes" });

// The handlers registered for the Android back button. The last one registered is asked first.
const backPressHandlers: Parameters<typeof BackHandler.addEventListener>[1][] = [];

async function pressAndroidBackButton(): Promise<boolean> {
  let wasHandled = false;
  await act(() => {
    for (const handler of [...backPressHandlers].reverse()) {
      if (handler({ type: "hardwareBackPress", timeStamp: 0 }) === true) {
        wasHandled = true;
        return;
      }
    }
  });
  return wasHandled;
}

// Holds the update of the program until the test lets go, so the screen can be looked at while a save is under way.
function holdTheSave(): () => Promise<void> {
  let release: () => void = () => undefined;
  programEditBackend.writeGate = new Promise<void>((resolve) => {
    release = resolve;
  });
  return () =>
    act(() => {
      release();
    });
}

describe("the Edit programme screen", () => {
  beforeEach(async () => {
    resetRouterMock();
    resetDiaryBackend();
    resetProgramBackend();
    resetProgramEditBackend();
    mockEditProgramInputs.length = 0;
    backPressHandlers.length = 0;
    jest.spyOn(BackHandler, "addEventListener").mockImplementation((_eventName, handler) => {
      backPressHandlers.push(handler);
      return {
        remove: () => {
          backPressHandlers.splice(backPressHandlers.indexOf(handler), 1);
        },
      };
    });
    jest.useFakeTimers({ now: new Date(FRIDAY_23_OCTOBER), doNotFake: [...ONLY_THE_DATE] });
    await signInProgramEditClient();
  });

  afterEach(async () => {
    jest.useRealTimers();
    jest.restoreAllMocks();
    await cleanup();
    queryClient.clear();
  });

  describe("while it reads", () => {
    it("should say it is loading", async () => {
      showGoldenAdult();
      diaryBackend.hungTables.add("programs");

      await renderEditProgramme();

      expect(screen.getByRole("status", { name: "Loading your programme" })).toBeOnTheScreen();
      expect(screen.queryByRole("button", { name: "Save changes" })).not.toBeOnTheScreen();
    });

    it("should offer to try again, without the error's own words, when the programme cannot be read", async () => {
      showGoldenAdult();
      diaryBackend.failingTables.add("programs");

      await renderEditProgramme();

      expect(await screen.findByText("Couldn't load your programme")).toBeOnTheScreen();
      expect(screen.getByRole("button", { name: "Try again" })).toBeOnTheScreen();
      expect(screen.queryByText(/raw database text/)).not.toBeOnTheScreen();
    });

    it("should go to the Programme screen when there is no programme to edit", async () => {
      showGoldenAdult();
      diaryBackend.programs = [];

      await renderEditProgramme();

      await waitFor(() => {
        expect(routerMock.redirect).toHaveBeenCalledWith("/more/program");
      });
    });
  });

  describe("the form, prefilled from a lose 0.5% moderate balanced programme (program-edit: default)", () => {
    beforeEach(() => {
      showGoldenAdult();
    });

    it("should be headed Edit programme, with Close on the right", async () => {
      await openForm();

      expect(screen.getByRole("heading", { name: "Edit programme" })).toBeOnTheScreen();
      expect(closeButton()).toBeOnTheScreen();
    });

    it("should head the four groups, with the helpers of the three that have one", async () => {
      await openForm();

      for (const title of ["Goal", "Rate", "Protein", "Diet style"]) {
        expect(screen.getByRole("heading", { name: title })).toBeOnTheScreen();
        expect(group(title)).toBeOnTheScreen();
      }
      expect(
        screen.getByText("As a share of your body weight each week. Slower is easier to keep up."),
      ).toBeOnTheScreen();
      expect(
        screen.getByText("Set first, from your weight. Fat and carbohydrate share the rest."),
      ).toBeOnTheScreen();
      expect(
        screen.getByText(
          "How the calories left after protein are split between fat and carbohydrate.",
        ),
      ).toBeOnTheScreen();
    });

    it("should choose Lose, 0.5% a week, Moderate and Balanced", async () => {
      await openForm();

      expect(radio(/^Lose weight/)).toBeChecked();
      expect(radio(/^0\.5% a week/)).toBeChecked();
      expect(radio(/^Moderate/)).toBeChecked();
      expect(radio(/^Balanced/)).toBeChecked();
      expect(screen.getAllByRole("radio", { checked: true })).toHaveLength(4);
    });

    it("should value the rates in kilograms a week at the trend weight of 79.02 kg", async () => {
      await openForm();

      const rates = within(group("Rate"));
      expect(rates.getByText("0.2 kg")).toBeOnTheScreen();
      expect(rates.getByText("0.4 kg")).toBeOnTheScreen();
      expect(rates.getByText("0.6 kg")).toBeOnTheScreen();
      expect(rates.getByText("0.8 kg")).toBeOnTheScreen();
    });

    it("should value the protein in grams a day at the trend weight of 79.02 kg", async () => {
      await openForm();

      const protein = within(group("Protein"));
      expect(protein.getByText("126 g")).toBeOnTheScreen();
      expect(protein.getByText("158 g")).toBeOnTheScreen();
      expect(protein.getByText("174 g")).toBeOnTheScreen();
    });

    it("should put the note about pregnancy and breastfeeding under the goal cards", async () => {
      await openForm();

      expect(screen.getByText("Pregnant or breastfeeding?")).toBeOnTheScreen();
      expect(
        screen.getByText(
          "Talk to a doctor, midwife or dietitian before you set a goal. Ki-Lo's estimates do not allow for pregnancy or breastfeeding.",
        ),
      ).toBeOnTheScreen();
    });

    it("should say the expenditure estimate stays at the newest snapshot's 2,580 kcal", async () => {
      await openForm();

      expect(await screen.findByText(FOOTNOTE)).toBeOnTheScreen();
    });

    it("should leave the second sentence of the footnote out while no snapshot exists", async () => {
      showProgramWithoutSnapshot();
      programBackend.weighIns = weighInsOf(STEADY_79_02_KG);
      programBackend.setupProfile = { ...SAMPLE_MAN.setupProfile };

      await openForm();

      expect(await screen.findByText("Saving changes your targets from today.")).toBeOnTheScreen();
      expect(screen.queryByText(/Your expenditure estimate stays/)).not.toBeOnTheScreen();
    });

    it("should name the newest snapshot of any programme, an ended programme's included", async () => {
      // The check-ins of 9 and 16 October are the active programme's. An ended programme's estimate of
      // 20 October is newer, and a recompute keeps the user's newest snapshot whichever programme made it.
      programBackend.snapshots = [
        ...programBackend.snapshots.slice(0, 2),
        {
          id: "66666666-6666-4666-8666-666666666699",
          program_id: "55555555-5555-4555-8555-555555555500",
          as_of_date: "2026-10-20",
          kind: "start",
          mu_kcal: 2412,
          var_kcal2: 140625,
          measurement: null,
        },
      ];

      await openForm();

      expect(
        await screen.findByText(
          "Saving changes your targets from today. Your expenditure estimate stays at 2,412 kcal a day.",
        ),
      ).toBeOnTheScreen();
    });

    it("should snap a stored rate that is not a preset to the nearest one", async () => {
      diaryBackend.programs = diaryBackend.programs.map((row) => ({
        ...row,
        rate_pct_per_week: 0.6,
      }));

      await openForm();

      expect(radio(/^0\.5% a week/)).toBeChecked();
    });
  });

  describe("the goal", () => {
    beforeEach(() => {
      showGoldenAdult();
    });

    it("should hide the Rate group for Maintain, and show it again for Gain with the gain cards", async () => {
      const user = userEvent.setup();
      await openForm();

      await user.press(radio(/^Maintain weight/));

      expect(screen.queryByLabelText("Rate")).not.toBeOnTheScreen();
      expect(screen.queryByRole("heading", { name: "Rate" })).not.toBeOnTheScreen();

      await user.press(radio(/^Gain weight/));

      expect(group("Rate")).toBeOnTheScreen();
      expect(radio(/^0\.1% a week/)).toBeOnTheScreen();
      expect(radio(/^0\.25% a week/)).toBeChecked();
    });

    it("should bring the new goal's default rate back when the goal changes", async () => {
      const user = userEvent.setup();
      await openForm();
      await user.press(radio(/^0\.75% a week/));

      await user.press(radio(/^Gain weight/));

      expect(radio(/^0\.25% a week/)).toBeChecked();
    });
  });

  describe("under 18 (program-edit: under-18)", () => {
    beforeEach(() => {
      showGoldenAdult(STEADY_79_02_KG, SIXTEEN_YEAR_OLD_BIRTH_DATE);
    });

    it("should show Lose weight disabled, named for why, and choose Maintain", async () => {
      await openForm();

      expect(radio("Lose weight, Not offered under 18")).toBeDisabled();
      expect(radio(/^Maintain weight/)).toBeChecked();
    });

    it("should not respond when the disabled Lose card is pressed", async () => {
      const user = userEvent.setup();
      await openForm();

      await user.press(radio("Lose weight, Not offered under 18"));

      expect(radio(/^Maintain weight/)).toBeChecked();
    });

    it("should show the note to talk to a health professional in place of the usual one", async () => {
      await openForm();

      expect(screen.getByText("Talk to a health professional")).toBeOnTheScreen();
      expect(screen.queryByText("Pregnant or breastfeeding?")).not.toBeOnTheScreen();
    });

    it("should have no Rate group while Maintain is chosen", async () => {
      await openForm();

      expect(screen.queryByLabelText("Rate")).not.toBeOnTheScreen();
      expect(group("Protein")).toBeOnTheScreen();
      expect(group("Diet style")).toBeOnTheScreen();
    });

    it("should still offer Gain with its rates", async () => {
      const user = userEvent.setup();
      await openForm();

      await user.press(radio(/^Gain weight/));

      expect(group("Rate")).toBeOnTheScreen();
    });
  });

  describe("with no birth date on the profile", () => {
    it("should not offer Lose, as the wizard does not", async () => {
      showGoldenAdult(STEADY_79_02_KG, null);

      await openForm();

      expect(radio("Lose weight, Not offered under 18")).toBeDisabled();
      expect(radio(/^Maintain weight/)).toBeChecked();
    });
  });

  describe("the weight the values are worked out at", () => {
    it("should be the newest trend weight, neither the first nor the latest weigh-in", async () => {
      // A first weigh-in of 74.0 kg, thirteen days at 78.0 kg and a last of 80.0 kg: the trend starts at
      // 74.0 kg (118, 148 and 163 g) and ends at 78.1 kg, so the protein is 125, 156 and 172 g where the
      // raw 80.0 kg would give 128, 160 and 176 g.
      showGoldenAdult([74, ...Array<number>(13).fill(78), 80]);

      await openForm();

      const protein = within(group("Protein"));
      expect(protein.getByText("125 g")).toBeOnTheScreen();
      expect(protein.getByText("156 g")).toBeOnTheScreen();
      expect(protein.getByText("172 g")).toBeOnTheScreen();
    });

    it("should be the weight the current targets were worked out at when there is no weigh-in at all", async () => {
      showGoldenAdult([]);
      diaryBackend.engineTargets = diaryBackend.engineTargets.map((row, index) =>
        index === 0
          ? { ...row, basis: Object.assign({}, row["basis"], { trendWeightKg: 80 }) }
          : row,
      );

      await openForm();

      const protein = within(group("Protein"));
      expect(protein.getByText("128 g")).toBeOnTheScreen();
      expect(protein.getByText("160 g")).toBeOnTheScreen();
      expect(protein.getByText("176 g")).toBeOnTheScreen();
    });

    it("should be the latest weigh-in when the trend cannot be read", async () => {
      showGoldenAdult([...Array<number>(14).fill(78), 80]);
      programEditBackend.weighInListFails = true;

      await openForm();

      const protein = within(group("Protein"));
      expect(protein.getByText("128 g")).toBeOnTheScreen();
      expect(protein.getByText("160 g")).toBeOnTheScreen();
      expect(protein.getByText("176 g")).toBeOnTheScreen();
    });

    it("should write the rates in pounds for someone who weighs in pounds", async () => {
      showGoldenAdult();
      programBackend.weightUnit = "lb";

      await openForm();

      const rates = within(group("Rate"));
      expect(rates.getByText("0.4 lb")).toBeOnTheScreen();
      expect(rates.getByText("0.9 lb")).toBeOnTheScreen();
      expect(rates.getByText("1.3 lb")).toBeOnTheScreen();
      expect(rates.getByText("1.7 lb")).toBeOnTheScreen();
      expect(within(group("Protein")).getByText("126 g")).toBeOnTheScreen();
    });
  });

  describe("the profile's time zone", () => {
    it("should work the age and the day of the save out where the person is, not in UTC", async () => {
      const user = userEvent.setup();
      // Born on 24 October 2008. At 15:00 UTC on 23 October it is 04:00 on 24 October in Auckland, so the
      // person is 18 there and 17 in UTC.
      showGoldenAdult(STEADY_79_02_KG, "2008-10-24");
      diaryBackend.timezone = "Pacific/Auckland";
      jest.setSystemTime(new Date("2026-10-23T15:00:00Z"));
      // The session the client holds expires an hour after it was made, so it is made again at the new time.
      await signInProgramEditClient();

      await openForm();

      expect(radio(/^Lose weight/)).toBeEnabled();
      expect(radio(/^Lose weight/)).toBeChecked();

      await user.press(saveButton());

      await waitFor(() => {
        expect(routerMock.back).toHaveBeenCalledTimes(1);
      });
      expect(mockEditProgramInputs).toHaveLength(1);
      expect(mockEditProgramInputs[0]?.today).toBe("2026-10-24");
    });
  });

  describe("while the terms are not accepted", () => {
    it("should read nothing of the programme, its history included, and say it is loading", async () => {
      showGoldenAdult();
      diaryBackend.terms = { terms_accepted_at: null, terms_version: null };

      await renderEditProgramme();
      // Lets any read that was wrongly started reach the fake database.
      await act(async () => {
        await new Promise((resolve) => setTimeout(resolve, 0));
      });

      expect(screen.getByRole("status", { name: "Loading your programme" })).toBeOnTheScreen();
      expect(
        diaryBackend.requests.filter(
          // The sign in of the test's own client asks who the user is, which is not a read of the screen's.
          (request) => request.table !== "user" && !request.search.includes("terms_accepted_at"),
        ),
      ).toEqual([]);
    });
  });

  describe("Save changes", () => {
    beforeEach(() => {
      showGoldenAdult();
    });

    it("should write the chosen goal, rate, protein and diet once, then work the targets out again", async () => {
      const user = userEvent.setup();
      await openForm();
      await user.press(radio(/^0\.75% a week/));
      await user.press(radio(/^High/));
      await user.press(radio(/^Low fat/));

      await user.press(saveButton());

      await waitFor(() => {
        expect(routerMock.back).toHaveBeenCalledTimes(1);
      });
      expect(programEditBackend.programWrites).toHaveLength(1);
      expect(programEditBackend.programWrites[0]).toMatchObject({
        goal: "lose",
        rate_pct_per_week: 0.75,
        protein_g_per_kg: 2,
        fat_fraction_of_remaining: 0.28,
        split_preset: "low_fat",
      });
      expect(programEditBackend.recomputeBodies).toEqual([{ mode: "recompute" }]);
    });

    it("should write Maintain with its rate of 0 when the goal was changed to it", async () => {
      const user = userEvent.setup();
      await openForm();
      await user.press(radio(/^Maintain weight/));

      await user.press(saveButton());

      await waitFor(() => {
        expect(routerMock.back).toHaveBeenCalledTimes(1);
      });
      expect(programEditBackend.programWrites[0]).toMatchObject({
        goal: "maintain",
        rate_pct_per_week: 0,
      });
    });

    it("should go back to the Programme screen with the Toast Targets saved", async () => {
      const user = userEvent.setup();
      await openForm();

      await user.press(saveButton());

      expect(await screen.findByText("Targets saved")).toBeOnTheScreen();
      expect(routerMock.back).toHaveBeenCalledTimes(1);
      expect(routerMock.replace).not.toHaveBeenCalled();
    });

    it("should go to the Programme screen itself when a link opened this screen cold", async () => {
      const user = userEvent.setup();
      routerMock.canGoBack.mockReturnValue(false);
      await openForm();

      await user.press(saveButton());

      await waitFor(() => {
        expect(routerMock.replace).toHaveBeenCalledWith("/more/program");
      });
      expect(routerMock.back).not.toHaveBeenCalled();
    });

    it("should be busy, with Close dimmed and the Android back button inert, while the save is under way", async () => {
      const user = userEvent.setup();
      const release = holdTheSave();
      await openForm();

      await user.press(saveButton());

      expect(await screen.findByRole("button", { busy: true })).toBeOnTheScreen();
      expect(closeButton()).toBeDisabled();
      expect(await pressAndroidBackButton()).toBe(true);
      expect(routerMock.back).not.toHaveBeenCalled();

      await release();
      await waitFor(() => {
        expect(routerMock.back).toHaveBeenCalledTimes(1);
      });
    });

    it("should save once for two presses in the same moment", async () => {
      const release = holdTheSave();
      await openForm();

      await pressTwiceInTheSameMoment(saveButton());
      await release();

      await waitFor(() => {
        expect(routerMock.back).toHaveBeenCalledTimes(1);
      });
      expect(programEditBackend.programWrites).toHaveLength(1);
      expect(programEditBackend.recomputeBodies).toHaveLength(1);
    });

    it("should allow the swipe back until a save starts, then stop it until the screen has gone", async () => {
      const user = userEvent.setup();
      const release = holdTheSave();
      await openForm();
      const gestureEnabled = () => routerMock.screenOptions.at(-1);

      expect(gestureEnabled()).toEqual({ gestureEnabled: true });

      await user.press(saveButton());
      await screen.findByRole("button", { busy: true });

      expect(gestureEnabled()).toEqual({ gestureEnabled: false });

      await release();
      await waitFor(() => {
        expect(routerMock.back).toHaveBeenCalledTimes(1);
      });
      expect(gestureEnabled()).toEqual({ gestureEnabled: false });
    });

    it("should allow the swipe back again when the save failed", async () => {
      const user = userEvent.setup();
      programEditBackend.writeFails = true;
      await openForm();

      await user.press(saveButton());
      await screen.findByText(SAVE_FAILED);

      expect(routerMock.screenOptions.at(-1)).toEqual({ gestureEnabled: true });
    });

    it("should keep Close and the button inert after the save until the screen has gone", async () => {
      const user = userEvent.setup();
      await openForm();

      await user.press(saveButton());
      await waitFor(() => {
        expect(routerMock.back).toHaveBeenCalledTimes(1);
      });
      await user.press(closeButton());
      await user.press(screen.getByRole("button", { busy: true }));

      expect(closeButton()).toBeDisabled();
      expect(routerMock.back).toHaveBeenCalledTimes(1);
      expect(programEditBackend.programWrites).toHaveLength(1);
    });

    it("should do nothing more once the screen has gone before the save settled", async () => {
      const user = userEvent.setup();
      const release = holdTheSave();
      await openForm();
      await user.press(saveButton());
      await screen.findByRole("button", { busy: true });

      await cleanup();
      await release();
      await act(async () => {
        await new Promise((resolve) => setTimeout(resolve, 0));
      });

      expect(programEditBackend.programWrites).toHaveLength(1);
      expect(routerMock.back).not.toHaveBeenCalled();
    });
  });

  describe("a save that fails (program-edit: save-error)", () => {
    beforeEach(() => {
      showGoldenAdult();
    });

    it.each([
      ["the update is refused", () => (programEditBackend.writeFails = true)],
      ["the recompute after it is refused", () => (programEditBackend.recompute = "is-refused")],
      [
        "the connection drops during the recompute",
        () => (programEditBackend.recompute = "network-fails"),
      ],
    ])("should say the targets have not changed, and stay, when %s", async (_name, fail) => {
      const user = userEvent.setup();
      fail();
      await openForm();
      await user.press(radio(/^0\.75% a week/));

      await user.press(saveButton());

      expect(await screen.findByText(SAVE_FAILED)).toBeOnTheScreen();
      expect(routerMock.back).not.toHaveBeenCalled();
      expect(screen.queryByText("Targets saved")).not.toBeOnTheScreen();
      expect(radio(/^0\.75% a week/)).toBeChecked();
      expect(closeButton()).toBeEnabled();
      expect(screen.queryByRole("button", { busy: true })).not.toBeOnTheScreen();
    });

    it("should never show the error's own words", async () => {
      const user = userEvent.setup();
      programEditBackend.writeFails = true;
      await openForm();

      await user.press(saveButton());
      await screen.findByText(SAVE_FAILED);

      expect(screen.queryByText(/refused/)).not.toBeOnTheScreen();
      expect(screen.queryByText(/79\.02/)).not.toBeOnTheScreen();
    });

    it("should keep the footnote under the banner", async () => {
      const user = userEvent.setup();
      programEditBackend.writeFails = true;
      await openForm();
      await screen.findByText(FOOTNOTE);

      await user.press(saveButton());

      expect(await screen.findByText(SAVE_FAILED)).toBeOnTheScreen();
      expect(screen.getByText(FOOTNOTE)).toBeOnTheScreen();
    });

    it("should read the banner before the footnote", async () => {
      const user = userEvent.setup();
      programEditBackend.writeFails = true;
      await openForm();
      await screen.findByText(FOOTNOTE);

      await user.press(saveButton());
      await screen.findByText(SAVE_FAILED);

      const texts = textsInOrder(screen.toJSON());
      expect(texts.indexOf(SAVE_FAILED)).toBeGreaterThan(-1);
      expect(texts.indexOf(SAVE_FAILED)).toBeLessThan(texts.indexOf(FOOTNOTE));
    });

    it("should save again from the same button, and drop the banner, when the retry works", async () => {
      const user = userEvent.setup();
      programEditBackend.writeFails = true;
      await openForm();
      await user.press(saveButton());
      await screen.findByText(SAVE_FAILED);
      programEditBackend.writeFails = false;

      await user.press(saveButton());

      await waitFor(() => {
        expect(routerMock.back).toHaveBeenCalledTimes(1);
      });
      expect(screen.queryByText(SAVE_FAILED)).not.toBeOnTheScreen();
      expect(programEditBackend.programWrites).toHaveLength(2);
    });
  });

  describe("Close", () => {
    beforeEach(() => {
      showGoldenAdult();
    });

    it("should leave with no write and no question, even after choices were changed", async () => {
      const user = userEvent.setup();
      await openForm();
      await user.press(radio(/^Gain weight/));

      await user.press(closeButton());

      expect(routerMock.back).toHaveBeenCalledTimes(1);
      expect(programEditBackend.programWrites).toEqual([]);
      expect(programEditBackend.recomputeBodies).toEqual([]);
      expect(screen.queryByRole("alertdialog")).not.toBeOnTheScreen();
    });

    it("should go to the Programme screen itself when a link opened this screen cold", async () => {
      const user = userEvent.setup();
      routerMock.canGoBack.mockReturnValue(false);
      await openForm();

      await user.press(closeButton());

      expect(routerMock.replace).toHaveBeenCalledWith("/more/program");
      expect(routerMock.back).not.toHaveBeenCalled();
    });

    it("should let the Android back button take its way when nothing is being saved", async () => {
      await openForm();

      expect(await pressAndroidBackButton()).toBe(false);
    });
  });
});
