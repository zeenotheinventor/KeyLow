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

import { TargetsScreen } from "../components/TargetsScreen";
import { ToastProvider } from "../components/ui";
import { ThemeProvider } from "../lib/theme";
import {
  createDiaryQueryClient,
  diaryBackend,
  diaryClient,
  requestsTo,
  resetDiaryBackend,
  signInDiaryClient,
} from "./support/diaryBackend";
import { resetRouterMock, routerMock } from "./support/expoRouterMock";
import { compileKitStyles } from "./support/kitStyles";
import { registerAppStyles } from "./support/nativeWindStyles";
import { programClient, resetProgramBackend, showGoldenProgram } from "./support/programBackend";
import { pressTwiceInTheSameMoment } from "./support/sameTickPress";
import { resolvedColor } from "./support/themeColor";
import { viewsDrawn } from "./support/viewsDrawn";

import type { QueryClient } from "@tanstack/react-query";
import type { TestInstance } from "test-renderer";

// Targets while a programme runs (`targets · engine`) and the switch to the person's own targets
// (`targets · switch-to-manual`), from the Ki-Lo program canvas.

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

let queryClient: QueryClient;

// The programme client reads the programme tables beside the diary's. It needs the same session to save.
async function signInProgramClient() {
  await signInDiaryClient();
  const { data } = await diaryClient.auth.getSession();
  if (data.session === null) {
    throw new Error("The diary client has no session");
  }
  await programClient.auth.setSession({
    access_token: data.session.access_token,
    refresh_token: data.session.refresh_token,
  });
}

async function renderProgrammeTargets() {
  queryClient = createDiaryQueryClient();
  await render(
    <ThemeProvider fixedPreference="dark">
      <KeyLowProvider client={programClient} queryClient={queryClient}>
        <ToastProvider>
          <TargetsScreen />
        </ToastProvider>
      </KeyLowProvider>
    </ThemeProvider>,
  );
  await screen.findByRole("button", { name: "Set my own targets" });
}

const programmeRow = () =>
  screen.getByRole("button", { name: "Programme, Your weekly check-in sets these targets" });
const setOwnTargets = () => screen.getByRole("button", { name: "Set my own targets" });
const calories = () => screen.getByLabelText("Calories (kcal)");
const save = () => screen.getByRole("button", { name: "Save" });
// The dialog is not one accessible element, or its buttons would be unreachable, so it is found by its heading.
const dialogHeading = () => screen.queryByRole("heading", { name: "Turn off weekly check-ins?" });

async function openSwitchForm() {
  const user = userEvent.setup();
  await user.press(setOwnTargets());
  await screen.findByLabelText("Calories (kcal)");
  return user;
}

function isInside(node: TestInstance | null, ancestor: TestInstance): boolean {
  return node !== null && (node === ancestor || isInside(node.parent, ancestor));
}

// Each attempt to save starts by looking for the active programme to end, so these count the attempts.
const saveAttempts = () =>
  diaryBackend.requests.filter(
    (request) => request.table === "programs" && request.search.includes("select=id%2Cstarted_on"),
  ).length;

const writesTo = (table: string) =>
  diaryBackend.requests.filter((request) => request.table === table && request.method === "PATCH");

describe("the Targets screen while a programme runs", () => {
  let kitStyles: string;

  beforeAll(async () => {
    kitStyles = await compileKitStyles("", ["components/TargetsScreen"]);
  });

  beforeEach(async () => {
    registerAppStyles(kitStyles);
    resetRouterMock();
    resetDiaryBackend();
    resetProgramBackend();
    showGoldenProgram();
    await signInProgramClient();
    diaryBackend.requests = [];
  });

  afterEach(async () => {
    jest.restoreAllMocks();
    await cleanup();
    queryClient.clear();
  });

  describe("the engine state", () => {
    it("should be titled Targets with a Back button, and show no form fields", async () => {
      await renderProgrammeTargets();

      expect(screen.getByRole("heading", { name: "Targets" })).toBeOnTheScreen();
      expect(screen.getByRole("button", { name: "Back" })).toBeOnTheScreen();
      expect(screen.queryByLabelText("Calories (kcal)")).not.toBeOnTheScreen();
      expect(screen.queryByRole("button", { name: "Save" })).not.toBeOnTheScreen();
    });

    it("should show the Programme row, which opens the Programme screen", async () => {
      const user = userEvent.setup();
      await renderProgrammeTargets();

      expect(screen.getByText("Your weekly check-in sets these targets")).toBeOnTheScreen();
      await user.press(programmeRow());

      expect(routerMock.push).toHaveBeenCalledTimes(1);
      expect(routerMock.push).toHaveBeenCalledWith("/more/program");
    });

    it("should open the Programme screen once when its row is pressed twice before the screen has moved", async () => {
      await renderProgrammeTargets();

      await pressTwiceInTheSameMoment(programmeRow());

      expect(routerMock.push).toHaveBeenCalledTimes(1);
    });

    it("should say This week, since the date the current targets began", async () => {
      await renderProgrammeTargets();

      expect(screen.getByRole("heading", { name: "This week" })).toBeOnTheScreen();
      expect(await screen.findByText("Since Friday 23 October")).toBeOnTheScreen();
    });

    it("should show the four targets as read-only rows", async () => {
      await renderProgrammeTargets();

      expect(screen.getByLabelText("Calories, 2,140 kcal")).toBeOnTheScreen();
      expect(screen.getByLabelText("Protein, 126 g")).toBeOnTheScreen();
      expect(screen.getByLabelText("Carbohydrate, 245 g")).toBeOnTheScreen();
      expect(screen.getByLabelText("Fat, 73 g")).toBeOnTheScreen();
      expect(
        screen.queryByRole("button", { name: /^(Calories|Protein|Carbohydrate|Fat),/ }),
      ).not.toBeOnTheScreen();
    });

    it.each([
      ["Calories, 2,140 kcal", "calories"],
      ["Protein, 126 g", "protein"],
      ["Carbohydrate, 245 g", "carbs"],
      ["Fat, 73 g", "fat"],
    ] as const)("should draw %s with its own colour as a key inside it", async (rowName, color) => {
      await renderProgrammeTargets();

      const keys = viewsDrawn({
        width: 8,
        height: 8,
        backgroundColor: resolvedColor("dark", color),
      });

      expect(keys).toHaveLength(1);
      expect(isInside(keys[0] ?? null, screen.getByLabelText(rowName))).toBe(true);
    });

    it("should name the list of this week's targets, with the four rows in it", async () => {
      await renderProgrammeTargets();

      const list = screen.getByLabelText("This week's targets");

      expect(list).toHaveProp("role", "list");
      for (const rowName of [
        "Calories, 2,140 kcal",
        "Protein, 126 g",
        "Carbohydrate, 245 g",
        "Fat, 73 g",
      ]) {
        expect(within(list).getByLabelText(rowName)).toBeOnTheScreen();
      }
    });

    it("should keep the Estimate my targets card, which opens the wizard to recalculate", async () => {
      const user = userEvent.setup();
      await renderProgrammeTargets();

      await user.press(
        screen.getByRole("button", {
          name: "Estimate my targets, From a few questions about you and your goal",
        }),
      );

      expect(routerMock.push).toHaveBeenCalledWith("/setup?mode=recalculate");
    });

    it("should say the engine note in place of the manual one", async () => {
      await renderProgrammeTargets();

      expect(
        screen.getByText(
          "Your programme sets these each week. If you set your own, the weekly check-in stops.",
        ),
      ).toBeOnTheScreen();
      expect(screen.queryByText(/You set these yourself for now/)).not.toBeOnTheScreen();
    });

    it("should read the programme summary, which a user with no programme never does", async () => {
      await renderProgrammeTargets();
      await screen.findByText("Since Friday 23 October");

      expect(requestsTo("expenditure_snapshots")).toBeGreaterThan(0);
    });

    it("should still show the targets, with no date and no error, when the programme cannot be read", async () => {
      diaryBackend.failingTables.add("expenditure_snapshots");

      await renderProgrammeTargets();

      expect(screen.getByLabelText("Calories, 2,140 kcal")).toBeOnTheScreen();
      expect(screen.queryByText(/^Since /)).not.toBeOnTheScreen();
      expect(screen.queryByText(/raw database text/)).not.toBeOnTheScreen();
    });
  });

  describe("Set my own targets", () => {
    it("should open the form with this week's numbers and the switch note", async () => {
      await renderProgrammeTargets();

      await openSwitchForm();

      expect(calories()).toHaveDisplayValue("2140");
      expect(screen.getByLabelText("Protein target in grams")).toHaveDisplayValue("126");
      expect(screen.getByLabelText("Carbohydrate target in grams")).toHaveDisplayValue("245");
      expect(screen.getByLabelText("Fat target in grams")).toHaveDisplayValue("73");
      expect(
        screen.getByText("Saving your own targets ends your programme and its weekly check-in."),
      ).toBeOnTheScreen();
      expect(screen.queryByText(/You set these yourself for now/)).not.toBeOnTheScreen();
      expect(screen.queryByRole("button", { name: "Set my own targets" })).not.toBeOnTheScreen();
    });

    it("should draw no Estimate my targets card on the switch form, as the board draws none", async () => {
      await renderProgrammeTargets();

      await openSwitchForm();

      expect(
        screen.queryByRole("button", {
          name: "Estimate my targets, From a few questions about you and your goal",
        }),
      ).not.toBeOnTheScreen();
    });

    it("should draw the dialog in the primary tone: Save my targets the main button, Keep the secondary", async () => {
      await renderProgrammeTargets();
      const user = await openSwitchForm();

      await user.press(save());

      const asking = within(screen.getByLabelText("Turn off weekly check-ins?"));
      expect(asking.getByRole("button", { name: "Save my targets" })).toHaveStyle({
        backgroundColor: resolvedColor("dark", "accent"),
      });
      expect(asking.getByText("Save my targets")).not.toHaveStyle({
        color: resolvedColor("dark", "danger"),
      });
      expect(asking.getByRole("button", { name: "Keep my programme" })).toHaveStyle({
        backgroundColor: resolvedColor("dark", "surface-raised"),
      });
    });

    it("should add the macros up as the form does, with 2000 typed over 2,140", async () => {
      await renderProgrammeTargets();
      const user = await openSwitchForm();

      await user.clear(calories());
      await user.type(calories(), "2000");

      expect(screen.getByText("Macros add up to 2,141 kcal")).toBeOnTheScreen();
    });

    it("should only ask when Save is pressed, and write nothing", async () => {
      await renderProgrammeTargets();
      const user = await openSwitchForm();
      await user.clear(calories());
      await user.type(calories(), "2000");

      await user.press(save());

      expect(dialogHeading()).toBeOnTheScreen();
      expect(diaryBackend.saves).toHaveLength(0);
      expect(writesTo("programs")).toHaveLength(0);
    });

    it("should ask in words, with Save my targets first and Keep my programme second", async () => {
      await renderProgrammeTargets();
      const user = await openSwitchForm();

      await user.press(save());

      const asking = within(screen.getByLabelText("Turn off weekly check-ins?"));
      expect(
        asking.getByText(
          "Saving your own targets ends your programme, so Ki-Lo stops adjusting them each week. You can start one again from Estimate my targets.",
        ),
      ).toBeOnTheScreen();
      const buttons = asking.getAllByRole("button");
      expect(buttons[0]).toHaveAccessibleName("Save my targets");
      expect(buttons[1]).toHaveAccessibleName("Keep my programme");
    });

    describe("Keep my programme", () => {
      it("should close the dialog and change nothing", async () => {
        await renderProgrammeTargets();
        const user = await openSwitchForm();
        await user.clear(calories());
        await user.type(calories(), "2000");
        await user.press(save());

        await user.press(screen.getByRole("button", { name: "Keep my programme" }));

        await waitFor(() => {
          expect(dialogHeading()).not.toBeOnTheScreen();
        });
        expect(diaryBackend.saves).toHaveLength(0);
        expect(writesTo("programs")).toHaveLength(0);
        expect(screen.queryByRole("status")).not.toBeOnTheScreen();
        expect(routerMock.back).not.toHaveBeenCalled();
        expect(calories()).toHaveDisplayValue("2000");
      });
    });

    describe("Save my targets", () => {
      it("should save once, end the programme, and land with Targets saved", async () => {
        await renderProgrammeTargets();
        const user = await openSwitchForm();
        await user.clear(calories());
        await user.type(calories(), "2000");
        await user.press(save());

        await user.press(screen.getByRole("button", { name: "Save my targets" }));

        expect(await screen.findByRole("status")).toHaveTextContent("Targets saved");
        expect(routerMock.back).toHaveBeenCalledTimes(1);
        expect(diaryBackend.saves).toHaveLength(1);
        expect(diaryBackend.saves[0]).toMatchObject({
          target_kcal: 2000,
          target_protein_g: 126,
          target_carbs_g: 245,
          target_fat_g: 73,
        });
        expect(writesTo("programs")).toHaveLength(1);
        expect(dialogHeading()).not.toBeOnTheScreen();
      });

      it("should save once when it is pressed twice before the dialog has moved", async () => {
        await renderProgrammeTargets();
        const user = await openSwitchForm();
        await user.press(save());

        await pressTwiceInTheSameMoment(screen.getByRole("button", { name: "Save my targets" }));

        await screen.findByRole("status");
        expect(diaryBackend.saves).toHaveLength(1);
      });

      it("should save again when the button is pressed again after a failed save", async () => {
        await renderProgrammeTargets();
        const user = await openSwitchForm();
        await user.press(save());
        diaryBackend.failingTables.add("profiles");
        await user.press(screen.getByRole("button", { name: "Save my targets" }));
        await screen.findByText("Not saved. Check your connection and try again.");
        diaryBackend.failingTables.delete("profiles");

        await user.press(save());
        await user.press(screen.getByRole("button", { name: "Save my targets" }));

        expect(await screen.findByRole("status")).toHaveTextContent("Targets saved");
        expect(saveAttempts()).toBe(2);
        expect(diaryBackend.saves).toHaveLength(1);
        expect(screen.queryByText("Not saved. Check your connection and try again.")).toBe(null);
      });

      it("should show the manual screen with the typed numbers once the programme has ended", async () => {
        await renderProgrammeTargets();
        const user = await openSwitchForm();
        await user.clear(calories());
        await user.type(calories(), "2000");
        await user.press(save());
        // What the database holds once the save has ended the programme.
        diaryBackend.programs = [
          { id: "44444444-4444-4444-8444-444444444444", ended_on: "2026-10-24" },
        ];

        await user.press(screen.getByRole("button", { name: "Save my targets" }));

        await screen.findByRole("status");
        await waitFor(() => {
          expect(calories()).toHaveDisplayValue("2000");
        });
        expect(screen.queryByRole("button", { name: "Set my own targets" })).not.toBeOnTheScreen();
        expect(dialogHeading()).not.toBeOnTheScreen();
        expect(screen.queryByText("This week")).not.toBeOnTheScreen();
        expect(screen.queryByLabelText(/^Protein, /)).not.toBeOnTheScreen();
        expect(
          screen.getByText(
            "You set these yourself for now. Later, Ki-Lo will suggest targets from your weight trend.",
          ),
        ).toBeOnTheScreen();
        // Save is now the plain save: pressing it asks nothing.
        await user.press(save());
        expect(dialogHeading()).not.toBeOnTheScreen();
      });

      it("should keep the dialog busy while the save runs", async () => {
        // The save waits for the session read, which this holds until the test lets it go.
        const releases: (() => void)[] = [];
        const readSession = programClient.auth.getUser.bind(programClient.auth);
        jest.spyOn(programClient.auth, "getUser").mockImplementation(
          () =>
            new Promise((resolve) => {
              releases.push(() => {
                resolve(readSession());
              });
            }),
        );
        await renderProgrammeTargets();
        const user = await openSwitchForm();
        await user.press(save());

        await user.press(screen.getByRole("button", { name: "Save my targets" }));

        const asking = () => within(screen.getByLabelText("Turn off weekly check-ins?"));
        const busyConfirm = await waitFor(() => asking().getByRole("button", { busy: true }));
        expect(within(busyConfirm).getByText("Save my targets")).toBeOnTheScreen();
        expect(busyConfirm).toBeBusy();
        expect(routerMock.back).not.toHaveBeenCalled();
        await act(() => {
          releases.forEach((release) => {
            release();
          });
        });
        await screen.findByRole("status");
      });

      it("should close the dialog and say the save failed, with no raw text, when it fails", async () => {
        await renderProgrammeTargets();
        const user = await openSwitchForm();
        await user.press(save());
        diaryBackend.failingTables.add("profiles");

        await user.press(screen.getByRole("button", { name: "Save my targets" }));

        expect(
          await screen.findByText("Not saved. Check your connection and try again."),
        ).toBeOnTheScreen();
        expect(dialogHeading()).not.toBeOnTheScreen();
        expect(routerMock.back).not.toHaveBeenCalled();
        expect(screen.queryByRole("status")).not.toBeOnTheScreen();
        expect(screen.queryByText(/raw database text/)).not.toBeOnTheScreen();
      });
    });
  });

  describe("when the programme's targets change under the screen", () => {
    it("should remount the form on the new numbers, as the manual form does", async () => {
      await renderProgrammeTargets();
      await openSwitchForm();
      const newRow = diaryBackend.engineTargets[0];
      if (newRow === undefined) {
        throw new Error("The golden programme has a current row");
      }
      diaryBackend.engineTargets = [{ ...newRow, calories_kcal: 2100 }];

      await act(() => queryClient.invalidateQueries());

      await waitFor(() => {
        expect(calories()).toHaveDisplayValue("2100");
      });
    });
  });
});
