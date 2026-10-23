import { act, cleanup, screen, waitFor, within } from "@testing-library/react-native";
import { setUpTests } from "react-native-reanimated";

import { ONLY_THE_DATE, SHEET_NOW, renderWeighInSheet } from "../support/weighInSheetHarness";
import {
  createWeightQueryClient,
  resetWeightBackend,
  weightBackend,
} from "../support/weightBackend";

import type { QueryClient } from "@tanstack/react-query";

jest.mock("@react-native-async-storage/async-storage", () => ({
  __esModule: true,
  default: { getItem: () => Promise.resolve(null), setItem: () => Promise.resolve() },
}));

setUpTests();

let queryClient: QueryClient;

const renderSheet = () => renderWeighInSheet(queryClient);

const dateRow = () => screen.getByRole("button", { name: /^Date/ });
const timeRow = () => screen.getByRole("button", { name: /^Time/ });
const hours = () => screen.getByRole("spinbutton", { name: "Hours" });
const minutes = () => screen.getByRole("spinbutton", { name: "Minutes" });
const done = () => screen.getByRole("button", { name: "Done" });
const saveButton = () => screen.getByRole("button", { name: /^Sav/ });

describe("the weigh-in sheet, date and time", () => {
  beforeEach(() => {
    jest.useFakeTimers({ now: SHEET_NOW, doNotFake: [...ONLY_THE_DATE] });
    resetWeightBackend();
    queryClient = createWeightQueryClient();
  });

  afterEach(async () => {
    jest.useRealTimers();
    jest.restoreAllMocks();
    await cleanup();
    queryClient.clear();
  });

  async function typeWeight(user: Awaited<ReturnType<typeof renderSheet>>["user"], text: string) {
    await user.type(screen.getByLabelText("Weight (kg)"), text);
  }

  describe("the time on today", () => {
    it("should open the time picker from the Time row, on the time the row shows", async () => {
      const { user } = await renderSheet();

      await user.press(timeRow());

      expect(screen.getByLabelText("Time")).toHaveProp("role", "dialog");
      expect(within(hours()).getByRole("option", { name: "08", selected: true })).toBeOnTheScreen();
      expect(
        within(minutes()).getByRole("option", { name: "15", selected: true }),
      ).toBeOnTheScreen();
    });

    it("should offer no hour after now", async () => {
      const { user } = await renderSheet();

      await user.press(timeRow());

      expect(within(hours()).getByRole("option", { name: "08" })).toBeOnTheScreen();
      expect(within(hours()).queryByRole("option", { name: "09" })).not.toBeOnTheScreen();
    });

    it("should offer no minute after now in the hour of now", async () => {
      const { user } = await renderSheet();

      await user.press(timeRow());

      expect(within(minutes()).getByRole("option", { name: "15" })).toBeOnTheScreen();
      expect(within(minutes()).queryByRole("option", { name: "16" })).not.toBeOnTheScreen();
    });

    it("should offer every minute in an earlier hour", async () => {
      const { user } = await renderSheet();
      await user.press(timeRow());

      await user.press(within(hours()).getByRole("option", { name: "07" }));

      expect(within(minutes()).getAllByRole("option")).toHaveLength(60);
    });

    it("should add the weigh-in at the time chosen, read in the profile's zone", async () => {
      const { user } = await renderSheet();
      await typeWeight(user, "81.4");
      await user.press(timeRow());
      await user.press(within(hours()).getByRole("option", { name: "07" }));
      await user.press(within(minutes()).getByRole("option", { name: "30" }));
      await user.press(done());

      expect(within(timeRow()).getByText("07:30")).toBeOnTheScreen();
      await user.press(saveButton());

      await act(async () => {
        await Promise.resolve();
      });
      expect(weightBackend.addedRows[0]).toMatchObject({
        measured_at: "2026-10-17T06:30:00.000Z",
        local_date: "2026-10-17",
      });
    });
  });

  describe("the date", () => {
    it("should open the date picker from the Date row, with no day after today on offer", async () => {
      const { user } = await renderSheet();

      await user.press(dateRow());

      expect(screen.getByLabelText("Choose a date")).toHaveProp("role", "dialog");
      expect(screen.getByRole("button", { name: "17 October, today, selected" })).toBeEnabled();
      expect(screen.getByRole("button", { name: "18 October" })).toBeDisabled();
    });

    it("should read Yesterday, with its date, once yesterday is chosen, and close the picker", async () => {
      const { user } = await renderSheet();
      await user.press(dateRow());

      await user.press(screen.getByRole("button", { name: "16 October" }));

      expect(within(dateRow()).getByText("Yesterday, Fri 16 Oct")).toBeOnTheScreen();
      await waitFor(() => {
        expect(screen.queryByLabelText("Choose a date")).not.toBeOnTheScreen();
      });
    });

    it("should add the weigh-in on the day chosen, at the time the row shows", async () => {
      const { user } = await renderSheet();
      await typeWeight(user, "81.4");
      await user.press(dateRow());
      await user.press(screen.getByRole("button", { name: "16 October" }));

      await user.press(saveButton());

      await act(async () => {
        await Promise.resolve();
      });
      expect(weightBackend.addedRows[0]).toMatchObject({
        measured_at: "2026-10-16T07:15:00.000Z",
        local_date: "2026-10-16",
      });
    });

    it("should offer every hour and minute on an earlier day", async () => {
      const { user } = await renderSheet();
      await user.press(dateRow());
      await user.press(screen.getByRole("button", { name: "16 October" }));

      await user.press(timeRow());

      expect(within(hours()).getAllByRole("option")).toHaveLength(24);
      expect(within(minutes()).getAllByRole("option")).toHaveLength(60);
    });

    it("should bring a later time on an earlier day back to now when today is chosen again", async () => {
      const { user } = await renderSheet();
      await user.press(dateRow());
      await user.press(screen.getByRole("button", { name: "16 October" }));
      await user.press(timeRow());
      await user.press(within(hours()).getByRole("option", { name: "20" }));
      await user.press(done());
      expect(within(timeRow()).getByText("20:15")).toBeOnTheScreen();

      await user.press(dateRow());
      await user.press(screen.getByRole("button", { name: "17 October, today" }));

      expect(within(timeRow()).getByText("08:15")).toBeOnTheScreen();
      expect(within(dateRow()).getByText("Today, Sat 17 Oct")).toBeOnTheScreen();
    });
  });
});
