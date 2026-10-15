import "react-native-gesture-handler/jestSetup";
import { SNAPSHOT_VERSION } from "@keylow/core/diary";
import { act, render, screen, userEvent, within } from "@testing-library/react-native";
import { setUpTests } from "react-native-reanimated";

import {
  foodFixture,
  foodQuery,
  mockLogFood,
  mockUseFoodWithPortions,
  mockUseProfileTimeZone,
  mockUseRecentFoods,
  portionFixtures,
  portionsQuery,
  profileTimeZone,
  recentFoods,
  resetApiClientMock,
  savedFoodId,
  termsAccepted,
} from "./support/apiClientMock";
import PortionPickerRoute from "../../app/foods/[id]/log";
import { ToastProvider } from "../../components/ui";
import { ThemeProvider } from "../../lib/theme";
import { resetRouterMock, routerMock } from "../support/expoRouterMock";
import { compileKitStyles } from "../support/kitStyles";
import { registerAppStyles } from "../support/nativeWindStyles";

import type { RecentFood } from "@keylow/api-client";
import type { Food } from "@keylow/core/schemas";

// The portion picker on its route, with the data hooks and the router mocked: what the boards draw, the
// amount and unit, the Time row, and what Add logs. The kit parts have their own tests.

jest.mock("@react-native-async-storage/async-storage", () => ({
  __esModule: true,
  default: { getItem: () => Promise.resolve(null), setItem: () => Promise.resolve() },
}));
jest.mock(
  "react-native-safe-area-context",
  () =>
    jest.requireActual<{ default: unknown }>("react-native-safe-area-context/jest/mock").default,
);
jest.mock(
  "expo-router",
  () => jest.requireActual<{ mockExpoRouter: unknown }>("../support/expoRouterMock").mockExpoRouter,
);
jest.mock(
  "@keylow/api-client",
  () => jest.requireActual<{ mockApiClient: unknown }>("./support/apiClientMock").mockApiClient,
);

setUpTests();

const openedAt = new Date("2026-10-15T11:40:30Z");

type Params = { day?: string; time?: string; barcode?: string; recent?: string };

async function renderPicker(params: Params = {}) {
  routerMock.searchParams = { id: savedFoodId, ...params };
  const user = userEvent.setup({ advanceTimers: jest.advanceTimersByTime });
  await render(
    <ThemeProvider fixedPreference="dark">
      <ToastProvider>
        <PortionPickerRoute />
      </ToastProvider>
    </ThemeProvider>,
  );
  return user;
}

function showFood(food: Food) {
  Object.assign(foodQuery, { data: food });
}

const addButton = () => screen.getByRole("button", { name: "Add" });
const amountField = () => screen.getByLabelText(/^Amount/);
const timeRow = (name: string) => screen.getByRole("button", { name });
const hero = (caption: string) => screen.getByLabelText(`Energy and macros, ${caption}`);

async function typeAmount(user: Awaited<ReturnType<typeof renderPicker>>, text: string) {
  await user.clear(amountField());
  if (text !== "") {
    await user.type(amountField(), text);
  }
}

async function advance(milliseconds: number) {
  await act(() => {
    jest.advanceTimersByTime(milliseconds);
  });
}

// Oats last logged yesterday morning, 50 g.
const oatsLastLogged: RecentFood = {
  foodId: savedFoodId,
  entryId: "entry-oats",
  loggedAt: "2026-10-14T07:05:00Z",
  portionId: null,
  snapshot: {
    v: SNAPSHOT_VERSION,
    kind: "food",
    ref: savedFoodId,
    name: "Oat bar",
    basis: "per_100g",
    per100: { kcal: 420, protein_g: 8.5, fat_g: 14, carbs_g: 62, fibre_g: 6.5 },
    quantity: 50,
    unit: "g",
    portion: null,
    density: null,
    resolvedGrams: 50,
    engineVersion: 1,
  },
};

describe("portion picker", () => {
  let kitStyles: string;

  beforeAll(async () => {
    kitStyles = await compileKitStyles();
  });

  beforeEach(() => {
    jest.useFakeTimers({ now: openedAt });
    registerAppStyles(kitStyles);
    resetRouterMock();
    resetApiClientMock();
  });

  afterEach(() => {
    jest.useRealTimers();
    jest.restoreAllMocks();
  });

  describe("loading the food", () => {
    it("should ask for the food and its portions by the id in the route", async () => {
      await renderPicker();

      expect(mockUseFoodWithPortions).toHaveBeenCalledWith(savedFoodId);
    });

    it("should say the food was not found for an id that is not a food id, without asking for it", async () => {
      routerMock.searchParams = { id: "oat-bar" };
      await render(
        <ThemeProvider fixedPreference="dark">
          <ToastProvider>
            <PortionPickerRoute />
          </ToastProvider>
        </ThemeProvider>,
      );

      expect(screen.getByRole("heading", { name: "Food not found" })).toBeOnTheScreen();
      expect(mockUseFoodWithPortions).not.toHaveBeenCalledWith("oat-bar");
    });

    it("should show the loading state while the food loads", async () => {
      Object.assign(foodQuery, { data: undefined });
      await renderPicker();

      expect(screen.getByRole("status", { name: "Loading food" })).toBeOnTheScreen();
    });

    it("should wait for the profile's time zone, because the time is read in it", async () => {
      profileTimeZone.current = { data: undefined, isPending: true, isError: false };
      await renderPicker();

      expect(screen.getByRole("status", { name: "Loading food" })).toBeOnTheScreen();
      expect(screen.queryByRole("button", { name: "Add" })).not.toBeOnTheScreen();
    });

    it("should say it could not load when the time zone could not be read", async () => {
      profileTimeZone.current = { data: undefined, isPending: false, isError: true };
      await renderPicker();

      expect(within(screen.getByRole("alert")).getByText("Food not loaded")).toBeOnTheScreen();
    });

    it("should read the time in the profile's zone, not the device's", async () => {
      profileTimeZone.current = { data: "America/New_York", isPending: false, isError: false };
      await renderPicker({ day: "2026-10-15" });

      expect(timeRow("Time, now, 07:40, change")).toBeOnTheScreen();
    });

    it("should say the food could not be loaded when it failed", async () => {
      Object.assign(foodQuery, { data: undefined, isError: true });
      await renderPicker();

      expect(within(screen.getByRole("alert")).getByText("Food not loaded")).toBeOnTheScreen();
    });
  });

  describe("the default serving", () => {
    it("should be headed by the food's name, with Back", async () => {
      const user = await renderPicker();

      expect(screen.getByRole("heading", { name: "Oat bar" })).toBeOnTheScreen();
      await user.press(screen.getByRole("button", { name: "Back" }));
      expect(routerMock.back).toHaveBeenCalledTimes(1);
    });

    it("should start at one of the default portion, with the hero for it", async () => {
      await renderPicker();

      expect(amountField()).toHaveDisplayValue("1");
      expect(screen.getByRole("radio", { name: "1 bar", checked: true })).toBeOnTheScreen();
      expect(hero("For 1 bar (45 g)")).toBeOnTheScreen();
      expect(within(hero("For 1 bar (45 g)")).getByText("189")).toBeOnTheScreen();
    });

    it("should start at 100 g when the food has no default portion", async () => {
      Object.assign(portionsQuery, { data: [] });
      await renderPicker();

      expect(amountField()).toHaveDisplayValue("100");
      expect(screen.getByRole("radio", { name: "g", checked: true })).toBeOnTheScreen();
      expect(hero("For 100 g")).toBeOnTheScreen();
    });

    it("should list the food's portions, then g, as chips", async () => {
      await renderPicker();

      const chips = screen.getAllByRole("radio");
      expect(chips).toHaveLength(3);
      ["1 bar", "Box of 6", "g"].forEach((name, index) => {
        expect(chips[index]).toHaveAccessibleName(name);
      });
    });

    it("should list the food's own values per 100 g under the hero", async () => {
      await renderPicker();

      const list = screen.getByLabelText("Per 100 g");
      expect(within(list).getByLabelText("Energy, 420 kcal")).toBeOnTheScreen();
      expect(within(list).getByLabelText("Protein, 8.5 g")).toBeOnTheScreen();
      expect(within(list).getByLabelText("Carbohydrate, 62 g")).toBeOnTheScreen();
      expect(within(list).getByLabelText("Fat, 14 g")).toBeOnTheScreen();
    });
  });

  describe("the amount and the unit", () => {
    it("should work the hero out again for the unit and the amount typed", async () => {
      const user = await renderPicker();

      await user.press(screen.getByRole("radio", { name: "g" }));
      await typeAmount(user, "150");

      expect(hero("For 150 g")).toBeOnTheScreen();
      expect(within(hero("For 150 g")).getByText("630")).toBeOnTheScreen();
    });

    it("should count portions of the one chosen", async () => {
      const user = await renderPicker();

      await user.press(screen.getByRole("radio", { name: "Box of 6" }));
      await typeAmount(user, "2");

      expect(hero("For 2 × Box of 6 (540 g)")).toBeOnTheScreen();
    });

    it("should name the amount field by its unit", async () => {
      const user = await renderPicker();
      // The portion "1 bar" gives the noun "bar", as the board writes "medium" and "pot".
      expect(screen.getByLabelText("Amount (bar)")).toBeOnTheScreen();

      await user.press(screen.getByRole("radio", { name: "g" }));

      expect(screen.getByLabelText("Amount (g)")).toBeOnTheScreen();
    });

    it("should say portion or portions when the label has no noun", async () => {
      Object.assign(portionsQuery, {
        data: [{ ...portionFixtures[0], label: "30 g", grams: 30 }],
      });
      const user = await renderPicker();
      expect(screen.getByLabelText("Amount (portion)")).toBeOnTheScreen();

      await typeAmount(user, "2");

      expect(screen.getByLabelText("Amount (portions)")).toBeOnTheScreen();
    });
  });

  describe("an amount that is not above 0", () => {
    it("should say so, dim Add and draw dashes in the hero", async () => {
      const user = await renderPicker();

      await typeAmount(user, "");

      expect(screen.getByText("Enter an amount above 0.")).toBeOnTheScreen();
      expect(addButton()).toBeDisabled();
      expect(hero("For this amount")).toBeOnTheScreen();
      expect(within(hero("For this amount")).getAllByText("–")).toHaveLength(4);
    });

    it("should not log when Add is pressed", async () => {
      const user = await renderPicker();
      await typeAmount(user, "0");

      await user.press(addButton());

      expect(mockLogFood).not.toHaveBeenCalled();
    });
  });

  describe("the Time row", () => {
    it("should read Now and the current time when opened from the dock or the centre plus", async () => {
      await renderPicker({ day: "2026-10-15" });

      expect(timeRow("Time, now, 12:40, change")).toBeOnTheScreen();
      expect(screen.getByText("Now · 12:40")).toBeOnTheScreen();
    });

    it("should read Now and the current clock time on a past day", async () => {
      await renderPicker({ day: "2026-10-14" });

      expect(timeRow("Time, now, 12:40, change")).toBeOnTheScreen();
    });

    it("should read the hour an hour's plus was pressed on, not Now", async () => {
      await renderPicker({ day: "2026-10-14", time: "12:00" });

      expect(timeRow("Time, 12:00, change")).toBeOnTheScreen();
      expect(screen.queryByText(/Now/)).not.toBeOnTheScreen();
    });

    it("should open the time picker, and read the time chosen in it", async () => {
      const user = await renderPicker({ day: "2026-10-15" });

      await user.press(timeRow("Time, now, 12:40, change"));
      await user.press(
        within(screen.getByRole("spinbutton", { name: "Hours" })).getByRole("option", {
          name: "17",
        }),
      );
      await user.press(
        within(screen.getByRole("spinbutton", { name: "Minutes" })).getByRole("option", {
          name: "25",
        }),
      );
      await user.press(screen.getByRole("button", { name: "Done" }));
      await advance(1000);

      expect(timeRow("Time, 17:25, change")).toBeOnTheScreen();
    });
  });

  describe("Add", () => {
    it("should log the default serving at the moment the screen opened, as the Time row shows", async () => {
      const user = await renderPicker({ day: "2026-10-15" });

      await user.press(addButton());

      expect(mockLogFood).toHaveBeenCalledTimes(1);
      expect(mockLogFood).toHaveBeenCalledWith({
        food: foodFixture,
        quantity: 1,
        unit: "portion",
        portion: portionFixtures[0],
        loggedAt: "2026-10-15T11:40:30.000Z",
        localDate: "2026-10-15",
      });
    });

    it("should log at the preset hour when opened from an hour's plus", async () => {
      const user = await renderPicker({ day: "2026-10-14", time: "12:00" });

      await user.press(addButton());

      expect(mockLogFood).toHaveBeenCalledWith(
        expect.objectContaining({
          loggedAt: "2026-10-14T11:00:00.000Z",
          localDate: "2026-10-14",
        }),
      );
    });

    it("should log at the current clock time on a past day", async () => {
      const user = await renderPicker({ day: "2026-10-14" });

      await user.press(addButton());

      expect(mockLogFood).toHaveBeenCalledWith(
        expect.objectContaining({
          loggedAt: "2026-10-14T11:40:00.000Z",
          localDate: "2026-10-14",
        }),
      );
    });

    it("should log at the time chosen in the time picker", async () => {
      const user = await renderPicker({ day: "2026-10-15" });
      await user.press(timeRow("Time, now, 12:40, change"));
      await user.press(
        within(screen.getByRole("spinbutton", { name: "Hours" })).getByRole("option", {
          name: "17",
        }),
      );
      await user.press(screen.getByRole("button", { name: "Done" }));
      await advance(1000);

      await user.press(addButton());

      expect(mockLogFood).toHaveBeenCalledWith(
        expect.objectContaining({
          loggedAt: "2026-10-15T16:40:00.000Z",
          localDate: "2026-10-15",
        }),
      );
    });

    it("should log the amount and unit that were chosen", async () => {
      const user = await renderPicker({ day: "2026-10-15" });
      await user.press(screen.getByRole("radio", { name: "g" }));
      await typeAmount(user, "150");

      await user.press(addButton());

      const [input] = mockLogFood.mock.calls[0] ?? [];
      expect(input).toMatchObject({ quantity: 150, unit: "g" });
      expect(input).not.toHaveProperty("portion");
    });

    it("should work on today when the sheet carries no day at all", async () => {
      const user = await renderPicker();

      await user.press(addButton());

      expect(mockLogFood).toHaveBeenCalledWith(
        expect.objectContaining({ loggedAt: "2026-10-15T11:40:30.000Z" }),
      );
    });

    describe("while it saves", () => {
      let finishSaving: () => void;

      beforeEach(() => {
        mockLogFood.mockReturnValue(
          new Promise((resolve) => {
            finishSaving = () => {
              resolve({});
            };
          }),
        );
      });

      it("should show Add as working and log only once however often it is pressed", async () => {
        const user = await renderPicker({ day: "2026-10-15" });

        await user.press(addButton());
        await user.press(screen.getByRole("button", { name: /Add/, busy: true }));

        expect(screen.getByRole("button", { name: /Add/, busy: true })).toBeOnTheScreen();
        expect(mockLogFood).toHaveBeenCalledTimes(1);
      });

      it("should close the sheet to the diary and show the Added toast when it has saved", async () => {
        const user = await renderPicker({ day: "2026-10-15" });
        await user.press(addButton());

        await act(() => {
          finishSaving();
        });

        expect(screen.getByRole("status", { name: /Added/ })).toBeOnTheScreen();
        expect(screen.getByText("Added")).toBeOnTheScreen();
        expect(routerMock.parentGoBack).toHaveBeenCalledTimes(1);
      });
    });

    describe("when it cannot save", () => {
      beforeEach(() => {
        mockLogFood.mockRejectedValue(new Error("network down while logging 150 g"));
      });

      it("should say it was not saved, keep the sheet open and let Add be pressed again", async () => {
        const user = await renderPicker({ day: "2026-10-15" });

        await user.press(addButton());

        expect(
          screen.getByRole("alert", { name: /Not saved\. Check your connection and try again\./ }),
        ).toBeOnTheScreen();
        expect(screen.queryByText("Added")).not.toBeOnTheScreen();
        expect(routerMock.parentGoBack).not.toHaveBeenCalled();
        expect(addButton()).toBeEnabled();
      });

      it("should clear the notice when Add is pressed again and saves", async () => {
        const user = await renderPicker({ day: "2026-10-15" });
        await user.press(addButton());
        mockLogFood.mockResolvedValue({});

        await user.press(addButton());

        expect(screen.queryByRole("alert", { name: /Not saved/ })).not.toBeOnTheScreen();
        expect(routerMock.parentGoBack).toHaveBeenCalledTimes(1);
      });
    });
  });

  describe("the terms gate", () => {
    it("should read neither the time zone nor Recent while the Terms are not accepted", async () => {
      termsAccepted.current = false;
      await renderPicker({ day: "2026-10-15", recent: "1" });

      expect(mockUseProfileTimeZone).toHaveBeenCalled();
      expect(
        mockUseProfileTimeZone.mock.calls.every(([options]) => options?.enabled === false),
      ).toBe(true);
      expect(mockUseRecentFoods).toHaveBeenCalled();
      expect(mockUseRecentFoods.mock.calls.every(([options]) => options?.enabled === false)).toBe(
        true,
      );
    });

    it("should read both once the Terms are accepted", async () => {
      await renderPicker({ day: "2026-10-15", recent: "1" });

      expect(
        mockUseProfileTimeZone.mock.calls.every(([options]) => options?.enabled === true),
      ).toBe(true);
      expect(mockUseRecentFoods.mock.calls.every(([options]) => options?.enabled === true)).toBe(
        true,
      );
    });
  });

  describe("a profile that has no time zone", () => {
    beforeEach(() => {
      profileTimeZone.current = { data: null, isPending: false, isError: false };
    });

    it("should read the time in UTC", async () => {
      await renderPicker({ day: "2026-10-15" });

      // 11:40 UTC, where London would read 12:40.
      expect(timeRow("Time, now, 11:40, change")).toBeOnTheScreen();
    });

    it("should log in UTC", async () => {
      const user = await renderPicker({ day: "2026-10-14", time: "12:00" });

      await user.press(addButton());

      expect(mockLogFood.mock.calls[0]?.[0]).toMatchObject({
        loggedAt: "2026-10-14T12:00:00.000Z",
        localDate: "2026-10-14",
      });
    });
  });

  describe("a food that is missing a value without being flagged", () => {
    beforeEach(() => {
      showFood({ ...foodFixture, carbs_g: null, quality: {} });
    });

    it("should be reviewed first like a flagged one: no Add, no Time row, and the gap named", async () => {
      await renderPicker({ day: "2026-10-15" });

      expect(screen.getByText("Needs review")).toBeOnTheScreen();
      expect(
        screen.getByText(
          "Carbohydrate is not given for this food. Copy it to your foods and fill the gap before you log it.",
        ),
      ).toBeOnTheScreen();
      expect(screen.queryByRole("button", { name: "Add" })).not.toBeOnTheScreen();
      expect(screen.queryByRole("button", { name: /^Time/ })).not.toBeOnTheScreen();
      expect(screen.getByRole("button", { name: "Copy to your foods" })).toBeOnTheScreen();
    });
  });

  describe("a food that must be reviewed first", () => {
    beforeEach(() => {
      showFood({
        ...foodFixture,
        carbs_g: null,
        quality: { suspect: true, fields_missing: ["carbs_g"] },
      });
    });

    it("should show the review notice with no action of its own", async () => {
      await renderPicker({ day: "2026-10-15" });

      expect(screen.getByText("Needs review")).toBeOnTheScreen();
      expect(
        screen.getByText(
          "Carbohydrate is not given for this food. Copy it to your foods and fill the gap before you log it.",
        ),
      ).toBeOnTheScreen();
      expect(screen.getAllByRole("button", { name: /Copy to your foods/ })).toHaveLength(1);
    });

    it("should offer Copy to your foods in place of Add, with no Time row", async () => {
      await renderPicker({ day: "2026-10-15" });

      expect(screen.queryByRole("button", { name: "Add" })).not.toBeOnTheScreen();
      expect(screen.queryByRole("button", { name: /^Time/ })).not.toBeOnTheScreen();
      expect(screen.getByRole("button", { name: "Copy to your foods" })).toBeOnTheScreen();
    });

    it("should open the copy form for the food", async () => {
      const user = await renderPicker({ day: "2026-10-15" });

      await user.press(screen.getByRole("button", { name: "Copy to your foods" }));

      expect(routerMock.push).toHaveBeenCalledWith(`/foods/new?from=${savedFoodId}`);
    });

    it("should say carbohydrate is not given, in the hero and in the list", async () => {
      await renderPicker({ day: "2026-10-15" });

      expect(screen.getByLabelText("Carbs, not given")).toBeOnTheScreen();
      expect(
        within(screen.getByLabelText("Per 100 g")).getByLabelText("Carbohydrate, not given"),
      ).toBeOnTheScreen();
    });
  });

  describe("from Recent", () => {
    beforeEach(() => {
      recentFoods.current = { data: [oatsLastLogged], isPending: false, isError: false };
    });

    it("should start at the amount last logged and say when it was", async () => {
      await renderPicker({ day: "2026-10-15", recent: "1" });

      expect(amountField()).toHaveDisplayValue("50");
      expect(screen.getByRole("radio", { name: "g", checked: true })).toBeOnTheScreen();
      expect(screen.getByText("Last logged 50 g, yesterday")).toBeOnTheScreen();
      expect(hero("For 50 g")).toBeOnTheScreen();
    });

    it("should log that amount when Add is pressed without a change", async () => {
      const user = await renderPicker({ day: "2026-10-15", recent: "1" });

      await user.press(addButton());

      expect(mockLogFood).toHaveBeenCalledWith(
        expect.objectContaining({ quantity: 50, unit: "g" }),
      );
    });

    it("should wait for the recent foods rather than start at the default and jump", async () => {
      recentFoods.current = { data: undefined, isPending: true, isError: false };
      await renderPicker({ day: "2026-10-15", recent: "1" });

      expect(screen.getByRole("status", { name: "Loading food" })).toBeOnTheScreen();
    });

    it("should start at the default serving when the food is not among the recent ones", async () => {
      recentFoods.current = { data: [], isPending: false, isError: false };
      await renderPicker({ day: "2026-10-15", recent: "1" });

      expect(amountField()).toHaveDisplayValue("1");
      expect(screen.queryByText(/Last logged/)).not.toBeOnTheScreen();
    });

    it("should ignore the recent foods when the picker was not opened from Recent", async () => {
      await renderPicker({ day: "2026-10-15" });

      expect(amountField()).toHaveDisplayValue("1");
      expect(screen.queryByText(/Last logged/)).not.toBeOnTheScreen();
    });
  });

  describe("from a scan", () => {
    it("should say which code was scanned, beside the food's source", async () => {
      await renderPicker({ day: "2026-10-15", barcode: "5201054013410" });

      expect(screen.getByText("Scanned 5201054013410")).toBeOnTheScreen();
    });

    it("should say nothing about a scan when it was not opened by one", async () => {
      await renderPicker({ day: "2026-10-15" });

      expect(screen.queryByText(/Scanned/)).not.toBeOnTheScreen();
    });
  });
});
