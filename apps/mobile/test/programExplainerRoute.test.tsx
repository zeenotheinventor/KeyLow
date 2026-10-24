import { KeyLowProvider } from "@keylow/api-client";
import { act, render, screen, userEvent, waitFor } from "@testing-library/react-native";
import { setUpTests } from "react-native-reanimated";
import { SafeAreaProvider } from "react-native-safe-area-context";

import ProgramExplainerRoute from "../app/(tabs)/more/program/explainer";
import { ThemeProvider } from "../lib/theme";
import { createDiaryQueryClient, diaryBackend, resetDiaryBackend } from "./support/diaryBackend";
import { resetRouterMock, routerMock } from "./support/expoRouterMock";
import {
  programClient,
  resetProgramBackend,
  showProgramWithoutSnapshot,
  showSettlingProgram,
} from "./support/programBackend";

import type { QueryClient } from "@tanstack/react-query";

jest.mock("@react-native-async-storage/async-storage", () => ({
  __esModule: true,
  default: { getItem: () => Promise.resolve(null), setItem: () => Promise.resolve() },
}));
jest.mock(
  "expo-router",
  () => jest.requireActual<{ mockExpoRouter: unknown }>("./support/expoRouterMock").mockExpoRouter,
);
jest.mock("@gorhom/bottom-sheet", () =>
  jest
    .requireActual<{ mockBottomSheet: () => unknown }>("./support/sheetScrollViewMock")
    .mockBottomSheet(),
);

setUpTests();

const frame = { x: 0, y: 0, width: 390, height: 844 };
const insets = { top: 47, right: 0, bottom: 34, left: 0 };

// The programme the settling case saves, started on Friday 23 October with its first check-in on Friday 6 November,
// started on another day or with no check-in date yet.
function changeProgramme(changes: { started_on?: string; next_checkin_date?: string | null }) {
  diaryBackend.programs = diaryBackend.programs.map((row) => ({ ...row, ...changes }));
}

async function renderRoute(queryClient: QueryClient = createDiaryQueryClient()) {
  await render(
    <SafeAreaProvider initialMetrics={{ frame, insets }}>
      <ThemeProvider fixedPreference="dark">
        <KeyLowProvider client={programClient} queryClient={queryClient}>
          <ProgramExplainerRoute />
        </KeyLowProvider>
      </ThemeProvider>
    </SafeAreaProvider>,
  );
}

describe("the programme explainer route", () => {
  beforeEach(() => {
    resetRouterMock();
    resetDiaryBackend();
    resetProgramBackend();
  });

  afterEach(async () => {
    await act(async () => {
      await new Promise((resolve) => setTimeout(resolve, 0));
    });
  });

  describe("with a programme", () => {
    beforeEach(() => {
      showSettlingProgram();
    });

    it("should open the explainer named by its title", async () => {
      await renderRoute();

      expect(
        await screen.findByRole("heading", { name: "How your programme works" }),
      ).toBeOnTheScreen();
      expect(screen.getByRole("heading", { name: "Water, glycogen and muscle" })).toBeOnTheScreen();
    });

    it("should name the weekday of the next check-in date", async () => {
      changeProgramme({ started_on: "2026-10-21", next_checkin_date: "2026-11-06" });
      await renderRoute();

      expect(
        await screen.findByText(/^Every Friday, the day you started, Ki-Lo looks back/),
      ).toBeOnTheScreen();
    });

    it("should name the weekday of the start date while the programme has no check-in date", async () => {
      changeProgramme({ started_on: "2026-10-21", next_checkin_date: null });
      await renderRoute();

      expect(
        await screen.findByText(/^Every Wednesday, the day you started, Ki-Lo looks back/),
      ).toBeOnTheScreen();
    });
  });

  describe("closing", () => {
    beforeEach(() => {
      showSettlingProgram();
    });

    it("should go back from Done", async () => {
      const user = userEvent.setup();
      await renderRoute();

      await user.press(await screen.findByRole("button", { name: "Done" }));

      expect(routerMock.back).toHaveBeenCalledTimes(1);
    });

    it("should replace itself with the Programme screen, not go back, when nothing is behind it", async () => {
      const user = userEvent.setup();
      routerMock.canGoBack.mockReturnValue(false);
      await renderRoute();

      await user.press(await screen.findByRole("button", { name: "Done" }));

      expect(routerMock.back).not.toHaveBeenCalled();
      expect(routerMock.replace).toHaveBeenCalledWith("/more/program");
    });
  });

  it("should present as a transparent modal that fades, with the stack's background cleared", async () => {
    showSettlingProgram();
    await renderRoute();
    await screen.findByRole("heading", { name: "How your programme works" });

    const options = routerMock.screenOptions.at(-1);
    expect(options).toMatchObject({ presentation: "transparentModal", animation: "fade" });
    expect(options).toHaveProperty("contentStyle", undefined);
  });

  it("should be a transparent modal from its first frame, while the programme is still being read", async () => {
    showSettlingProgram();
    await renderRoute();

    expect(screen.queryByRole("heading", { name: "How your programme works" })).toBeNull();
    expect(routerMock.screenOptions.at(-1)).toMatchObject({
      presentation: "transparentModal",
      animation: "fade",
    });
  });

  it("should use the start date for a programme saved before its first recompute", async () => {
    showProgramWithoutSnapshot();
    await renderRoute();

    expect(
      await screen.findByText(/^Every Friday, the day you started, Ki-Lo looks back/),
    ).toBeOnTheScreen();
  });

  describe("when the programme cannot be read", () => {
    it("should go to the Programme screen when there is nothing cached to show", async () => {
      showSettlingProgram();
      diaryBackend.failingTables.add("programs");
      await renderRoute();

      await waitFor(() => {
        expect(routerMock.redirect).toHaveBeenCalledWith("/more/program");
      });
      expect(screen.queryByRole("heading", { name: "How your programme works" })).toBeNull();
    });

    it("should keep the sheet open when a refetch fails and the programme is cached", async () => {
      showSettlingProgram();
      const queryClient = createDiaryQueryClient();
      await renderRoute(queryClient);
      await screen.findByRole("heading", { name: "How your programme works" });

      diaryBackend.failingTables.add("programs");
      await act(async () => {
        await queryClient.refetchQueries();
      });
      // Lets the screen draw what the failed read left.
      await act(async () => {
        await new Promise((resolve) => setTimeout(resolve, 0));
      });

      expect(routerMock.redirect).not.toHaveBeenCalled();
      expect(screen.getByRole("heading", { name: "How your programme works" })).toBeOnTheScreen();
    });
  });

  describe("with no programme", () => {
    it("should send the person to the Programme screen, which says so, and draw no sheet", async () => {
      await renderRoute();

      await waitFor(() => {
        expect(routerMock.redirect).toHaveBeenCalledWith("/more/program");
      });
      expect(screen.queryByRole("dialog")).not.toBeOnTheScreen();
    });
  });
});
