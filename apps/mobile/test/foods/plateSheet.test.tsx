import { onlineManager } from "@tanstack/react-query";
import { act, fireEvent, render, screen, userEvent, within } from "@testing-library/react-native";
import { AccessibilityInfo, BackHandler, Pressable, Text } from "react-native";
import { setUpTests } from "react-native-reanimated";

import { profileTimeZone, resetApiClientMock } from "./support/apiClientMock";
import { compileFoodSearchStyles } from "./support/foodSearchStyles";
import { boardPlate, milk } from "./support/plateSheetItems";
import { mockLogEntries, resetSearchApiClientMock } from "./support/searchApiClientMock";
import { FoodSearch } from "../../components/FoodSearch";
import { ToastProvider } from "../../components/ui";
import { PlateProvider, usePlate } from "../../lib/plate";
import { ThemeProvider } from "../../lib/theme";
import { resetRouterMock, routerMock } from "../support/expoRouterMock";
import { registerAppStyles } from "../support/nativeWindStyles";

import type { PlateItemBuilder } from "../../lib/plate";

// "Your plate": the sheet the plate chip opens in the log search, where the plate is edited before it is
// logged. Time and Clear plate come with the next ticket, so they are not here.

jest.mock(
  "expo-router",
  () => jest.requireActual<{ mockExpoRouter: unknown }>("../support/expoRouterMock").mockExpoRouter,
);
jest.mock(
  "@keylow/api-client",
  () =>
    jest.requireActual<{ mockSearchApiClient: unknown }>("./support/searchApiClientMock")
      .mockSearchApiClient,
);
jest.mock("@react-native-async-storage/async-storage", () => ({
  __esModule: true,
  default: { getItem: () => Promise.resolve(null), setItem: () => Promise.resolve() },
}));
jest.mock(
  "react-native-safe-area-context",
  () =>
    jest.requireActual<{ default: unknown }>("react-native-safe-area-context/jest/mock").default,
);
// Jest does not turn the library's scroll handlers into worklets, so its scroll view is the plain one here.
jest.mock("@gorhom/bottom-sheet", () =>
  jest
    .requireActual<{ mockBottomSheet: () => unknown }>("../support/sheetScrollViewMock")
    .mockBottomSheet(),
);

setUpTests();

const notLogged = "Not logged. Check your connection and try again.";
const milkAmount = "Amount of Semi-skimmed milk, ml";
const logFoods = "Log foods, 4 foods on your plate";
const logFood = "Log food, 1 food on your plate";
const yourPlate = "Your plate";

// Puts foods on the plate the way the search's plus and the picker do, so a test can start from a plate.
function PlateFiller({ foods }: { foods: readonly PlateItemBuilder[] }) {
  const plate = usePlate();

  return (
    <Pressable
      role="button"
      aria-label="Fill the plate"
      onPress={() => {
        for (const build of foods) {
          plate.add(build);
        }
      }}
    >
      <Text>Fill the plate</Text>
    </Pressable>
  );
}

async function renderSearch(foods: readonly PlateItemBuilder[] = boardPlate) {
  const user = userEvent.setup({ advanceTimers: jest.advanceTimersByTime });
  await render(
    <ThemeProvider fixedPreference="dark">
      <ToastProvider>
        <PlateProvider>
          <FoodSearch
            logging={{
              context: { day: "2026-10-15" },
              onOpenRecent: jest.fn(),
              onOpenRecipe: jest.fn(),
              onQuickAdd: jest.fn(),
            }}
            onClose={jest.fn()}
            onCreateFood={jest.fn()}
            onOpenFood={jest.fn()}
            onScanBarcode={jest.fn()}
          />
          <PlateFiller foods={foods} />
        </PlateProvider>
      </ToastProvider>
    </ThemeProvider>,
  );
  await user.press(screen.getByRole("button", { name: "Fill the plate" }));

  return user;
}

async function openThePlate(
  user: ReturnType<typeof userEvent.setup>,
  name = "Your plate, 4 foods",
) {
  await user.press(screen.getByRole("button", { name }));

  return within(screen.getByLabelText(yourPlate));
}

async function advance(milliseconds: number) {
  await act(() => {
    jest.advanceTimersByTime(milliseconds);
  });
}

describe("the Your plate sheet", () => {
  let styles: string;

  beforeAll(async () => {
    styles = await compileFoodSearchStyles();
  });

  beforeEach(() => {
    jest.useFakeTimers({ now: new Date("2026-10-15T11:40:30Z") });
    registerAppStyles(styles);
    jest.spyOn(AccessibilityInfo, "isReduceMotionEnabled").mockResolvedValue(false);
    resetRouterMock();
    resetApiClientMock();
    resetSearchApiClientMock();
    onlineManager.setOnline(true);
  });

  afterEach(async () => {
    jest.useRealTimers();
    jest.restoreAllMocks();
    await act(() => {
      onlineManager.setOnline(true);
    });
  });

  describe("the plate chip", () => {
    it("should be named for the count once there is a food on the plate", async () => {
      await renderSearch();

      expect(screen.getByRole("button", { name: "Your plate, 4 foods" })).toBeOnTheScreen();
    });

    it("should say one food for a plate of one", async () => {
      await renderSearch([milk]);

      expect(screen.getByRole("button", { name: "Your plate, 1 food" })).toBeOnTheScreen();
    });

    it("should not be there while the plate is empty", async () => {
      await renderSearch([]);

      expect(screen.queryByRole("button", { name: /^Your plate/ })).not.toBeOnTheScreen();
    });

    it("should keep the title in the middle of the header, with a slot as wide as the chip at each end", async () => {
      await renderSearch();

      expect(screen.getByTestId("sheet-header-leading-slot")).toBeOnTheScreen();
      expect(screen.getByTestId("sheet-header-trailing-slot")).toBeOnTheScreen();
    });

    it("should open nothing until it is pressed", async () => {
      await renderSearch();

      expect(screen.queryByLabelText(yourPlate)).not.toBeOnTheScreen();
    });
  });

  describe("opening it", () => {
    it("should be a dialog headed Your plate, with the count beside the heading", async () => {
      const user = await renderSearch();

      const sheet = await openThePlate(user);

      expect(sheet.getByRole("heading", { name: yourPlate })).toBeOnTheScreen();
      expect(sheet.getByText("4 foods")).toBeOnTheScreen();
    });

    it("should say 1 food for a plate of one", async () => {
      const user = await renderSearch([milk]);

      const sheet = await openThePlate(user, "Your plate, 1 food");

      expect(sheet.getByText("1 food")).toBeOnTheScreen();
    });

    it("should list the four foods by name in a list called Foods on your plate", async () => {
      const user = await renderSearch();

      const sheet = await openThePlate(user);

      const rows = within(sheet.getByLabelText("Foods on your plate"));
      for (const name of [
        "Chicken and rice",
        "Greek yoghurt 0% fat",
        "Banana",
        "Semi-skimmed milk",
      ]) {
        expect(rows.getByText(name)).toBeOnTheScreen();
      }
    });

    it("should say Recipe under the recipe, and show each row's amount and its values", async () => {
      const user = await renderSearch();

      const sheet = await openThePlate(user);

      expect(sheet.getByText("Recipe")).toBeOnTheScreen();
      expect(sheet.getByLabelText(milkAmount)).toHaveProp("value", "200");
      expect(sheet.getByText("92")).toBeOnTheScreen();
    });

    it("should show what is on the plate and what the day comes to with it", async () => {
      const user = await renderSearch();

      const sheet = await openThePlate(user);

      expect(sheet.getByText("On your plate")).toBeOnTheScreen();
      expect(sheet.getByText("658 kcal")).toBeOnTheScreen();
      expect(sheet.getByText("Protein 57 g")).toBeOnTheScreen();
      expect(sheet.getByText("Carbs 79 g")).toBeOnTheScreen();
      expect(sheet.getByText("Fat 12 g")).toBeOnTheScreen();
      expect(sheet.getByText("Today with your plate")).toBeOnTheScreen();
      expect(
        sheet.getByRole("group", {
          name: /^Today with your plate\. Calories: 1,697 of 2,200 kilocalories, 658 on your plate\. /,
        }),
      ).toBeOnTheScreen();
    });

    it("should name the day when the search was opened for another one", async () => {
      const user = await renderSearch();
      jest.setSystemTime(new Date("2026-10-16T11:40:30Z"));

      const sheet = await openThePlate(user);

      expect(sheet.getByText("Yesterday with your plate")).toBeOnTheScreen();
    });

    it("should draw no strip, and still show the totals, until the day is known", async () => {
      const { eatenDay } = jest.requireActual<typeof import("./support/searchApiClientMock")>(
        "./support/searchApiClientMock",
      );
      eatenDay.current = { data: undefined, isError: false };
      const user = await renderSearch();

      const sheet = await openThePlate(user);

      expect(sheet.getByText("658 kcal")).toBeOnTheScreen();
      expect(sheet.queryByText("Today with your plate")).not.toBeOnTheScreen();
      expect(sheet.queryByRole("group")).not.toBeOnTheScreen();
    });

    it("should have Log foods, named for the count, and no Time row or Clear plate yet", async () => {
      const user = await renderSearch();

      const sheet = await openThePlate(user);

      expect(sheet.getByRole("button", { name: logFoods })).toBeEnabled();
      expect(sheet.queryByRole("button", { name: "Clear plate" })).not.toBeOnTheScreen();
      expect(sheet.queryByText("Time")).not.toBeOnTheScreen();
    });

    it("should say Log food for a plate of one", async () => {
      const user = await renderSearch([milk]);

      const sheet = await openThePlate(user, "Your plate, 1 food");

      expect(sheet.getByRole("button", { name: logFood })).toHaveTextContent("Log food");
    });

    it("should write the name of a row as plain text until the picker is wired to it, with no button", async () => {
      const user = await renderSearch();

      const sheet = await openThePlate(user);

      expect(sheet.getByText("Semi-skimmed milk")).toBeOnTheScreen();
      expect(sheet.queryByRole("button", { name: /change amount or unit/ })).not.toBeOnTheScreen();
    });

    it("should not show 0 foods while the sheet closes on its last food", async () => {
      const user = await renderSearch([milk]);
      const sheet = await openThePlate(user, "Your plate, 1 food");

      await user.press(
        sheet.getByRole("button", { name: "Remove Semi-skimmed milk from your plate" }),
      );

      expect(screen.queryByText("0 foods")).not.toBeOnTheScreen();
    });

    it("should name the totals card", async () => {
      const user = await renderSearch();

      const sheet = await openThePlate(user);

      expect(sheet.getByLabelText("Totals")).toBeOnTheScreen();
    });
  });

  describe("closing it", () => {
    it("should keep the plate when the screen reader's escape gesture closes it", async () => {
      const user = await renderSearch();
      await openThePlate(user);

      await fireEvent(screen.getByLabelText(yourPlate), "accessibilityEscape");
      await advance(1000);

      expect(screen.queryByLabelText(yourPlate)).not.toBeOnTheScreen();
      expect(screen.getByRole("button", { name: "Your plate, 4 foods" })).toBeOnTheScreen();
    });

    it("should close on the Android back button, and take the press", async () => {
      const addListener = jest.spyOn(BackHandler, "addEventListener");
      const user = await renderSearch();
      await openThePlate(user);

      const pressBack = addListener.mock.calls.at(-1)?.[1];
      let isHandled: boolean | null | undefined;
      await act(() => {
        isHandled = pressBack?.({ type: "hardwareBackPress", timeStamp: 0 });
      });
      await advance(1000);

      expect(isHandled).toBe(true);
      expect(screen.queryByLabelText(yourPlate)).not.toBeOnTheScreen();
      expect(screen.getByRole("button", { name: "Your plate, 4 foods" })).toBeOnTheScreen();
    });

    it("should open again with the plate as it was", async () => {
      const user = await renderSearch();
      await openThePlate(user);
      await fireEvent(screen.getByLabelText(yourPlate), "accessibilityEscape");
      await advance(1000);

      const sheet = await openThePlate(user);

      expect(sheet.getByText("4 foods")).toBeOnTheScreen();
    });
  });

  describe("changing an amount", () => {
    it("should update the row, the totals and both strips as the amount is typed", async () => {
      const user = await renderSearch();
      const sheet = await openThePlate(user);

      await fireEvent.changeText(sheet.getByLabelText(milkAmount), "300");

      expect(sheet.getByLabelText(milkAmount)).toHaveProp("value", "300");
      expect(sheet.getByText("138")).toBeOnTheScreen();
      expect(sheet.getByText("704 kcal")).toBeOnTheScreen();
      expect(
        sheet.getByRole("group", { name: /^Today with your plate\. Calories: 1,743 of 2,200 / }),
      ).toBeOnTheScreen();
      // The search's own strip, under the dim, follows too.
      expect(
        screen.getAllByRole("group", {
          name: /^Today with your plate\. Calories: 1,743 of 2,200 kilocalories, 704 on your plate/,
        }),
      ).toHaveLength(2);
    });

    it("should say Enter an amount above 0 under the row for a 0, and dim Log foods", async () => {
      const user = await renderSearch();
      const sheet = await openThePlate(user);

      await fireEvent.changeText(sheet.getByLabelText(milkAmount), "0");

      expect(sheet.getByText("Enter an amount above 0.")).toBeOnTheScreen();
      expect(sheet.getByRole("button", { name: logFoods })).toBeDisabled();
    });

    it("should say the same for an empty field, and count the row as nothing", async () => {
      const user = await renderSearch();
      const sheet = await openThePlate(user);

      await fireEvent.changeText(sheet.getByLabelText(milkAmount), "");

      expect(sheet.getByText("Enter an amount above 0.")).toBeOnTheScreen();
      expect(sheet.getByText("566 kcal")).toBeOnTheScreen();
      expect(sheet.getByRole("button", { name: logFoods })).toBeDisabled();
    });

    it("should bring Log foods back once the amount is above 0 again", async () => {
      const user = await renderSearch();
      const sheet = await openThePlate(user);
      await fireEvent.changeText(sheet.getByLabelText(milkAmount), "0");

      await fireEvent.changeText(sheet.getByLabelText(milkAmount), "250");

      expect(sheet.queryByText("Enter an amount above 0.")).not.toBeOnTheScreen();
      expect(sheet.getByRole("button", { name: logFoods })).toBeEnabled();
    });
  });

  describe("removing a food", () => {
    it("should take the row off at once, with no toast, and drop the count everywhere", async () => {
      const user = await renderSearch();
      const sheet = await openThePlate(user);

      await user.press(sheet.getByRole("button", { name: "Remove Banana from your plate" }));

      expect(sheet.queryByText("Banana")).not.toBeOnTheScreen();
      expect(sheet.getByText("3 foods")).toBeOnTheScreen();
      expect(sheet.getByText("563 kcal")).toBeOnTheScreen();
      expect(
        sheet.getByRole("button", { name: "Log foods, 3 foods on your plate" }),
      ).toBeOnTheScreen();
      expect(screen.getByRole("button", { name: "Your plate, 3 foods" })).toBeOnTheScreen();
      expect(screen.queryByText(/Undo/)).not.toBeOnTheScreen();
    });

    it("should close the sheet when the last food is removed, and take the chip and Log foods with it", async () => {
      const user = await renderSearch([milk]);
      const sheet = await openThePlate(user, "Your plate, 1 food");

      await user.press(
        sheet.getByRole("button", { name: "Remove Semi-skimmed milk from your plate" }),
      );
      await advance(1000);

      expect(screen.queryByLabelText(yourPlate)).not.toBeOnTheScreen();
      expect(screen.queryByRole("button", { name: /^Your plate/ })).not.toBeOnTheScreen();
      expect(screen.queryByRole("button", { name: /^Log foods?\b/ })).not.toBeOnTheScreen();
    });

    it("should leave the sheet shut when a food is put on the emptied plate", async () => {
      const user = await renderSearch([milk]);
      const sheet = await openThePlate(user, "Your plate, 1 food");
      await user.press(
        sheet.getByRole("button", { name: "Remove Semi-skimmed milk from your plate" }),
      );
      await advance(1000);

      await user.press(screen.getByRole("button", { name: "Fill the plate" }));

      expect(screen.queryByLabelText(yourPlate)).not.toBeOnTheScreen();
      expect(screen.getByRole("button", { name: "Your plate, 1 food" })).toBeOnTheScreen();
    });
  });

  describe("Log foods in the sheet", () => {
    it("should write the whole plate once, and take the person to the diary", async () => {
      const user = await renderSearch();
      const sheet = await openThePlate(user);

      await user.press(sheet.getByRole("button", { name: logFoods }));

      expect(mockLogEntries).toHaveBeenCalledTimes(1);
      expect(mockLogEntries.mock.calls[0]?.[0]).toHaveLength(4);
      expect(routerMock.push).toHaveBeenCalledWith(expect.stringContaining("2026-10-15"));
      expect(screen.queryByText(notLogged)).not.toBeOnTheScreen();
    });

    it("should dim and disable everything in the sheet while it logs, keeping the spinner at full strength", async () => {
      mockLogEntries.mockReturnValue(new Promise(() => undefined));
      const user = await renderSearch();
      const sheet = await openThePlate(user);

      await user.press(sheet.getByRole("button", { name: logFoods }));

      expect(sheet.getByRole("button", { name: logFoods })).toBeBusy();
      expect(sheet.getByRole("button", { name: logFoods })).toBeDisabled();
      expect(sheet.getByLabelText(milkAmount)).toBeDisabled();
      expect(sheet.getByRole("button", { name: "Remove Banana from your plate" })).toBeDisabled();
      expect(screen.getByRole("button", { name: "Your plate, 4 foods" })).toBeDisabled();
    });

    it("should not close while it logs, because its answer would be lost", async () => {
      mockLogEntries.mockReturnValue(new Promise(() => undefined));
      const addListener = jest.spyOn(BackHandler, "addEventListener");
      const user = await renderSearch();
      const sheet = await openThePlate(user);
      await user.press(sheet.getByRole("button", { name: logFoods }));

      const pressBack = addListener.mock.calls.at(-1)?.[1];
      await act(() => {
        pressBack?.({ type: "hardwareBackPress", timeStamp: 0 });
      });
      await advance(1000);

      expect(screen.getByLabelText(yourPlate)).toBeOnTheScreen();
    });

    it("should say it was not logged in the sheet, keep the sheet and the plate, and bring the button back", async () => {
      mockLogEntries.mockRejectedValue(new Error("network down while logging Banana"));
      const user = await renderSearch();
      const sheet = await openThePlate(user);

      await user.press(sheet.getByRole("button", { name: logFoods }));

      expect(await sheet.findByText(notLogged)).toBeOnTheScreen();
      expect(sheet.getByRole("alert")).toBeOnTheScreen();
      expect(sheet.getByRole("button", { name: logFoods })).toBeEnabled();
      expect(sheet.getByText("4 foods")).toBeOnTheScreen();
      expect(sheet.getByLabelText(milkAmount)).toBeEnabled();
      expect(routerMock.push).not.toHaveBeenCalled();
    });

    it("should take the sentence away when the log is tried again", async () => {
      mockLogEntries.mockRejectedValueOnce(new Error("network down"));
      const user = await renderSearch();
      const sheet = await openThePlate(user);
      await user.press(sheet.getByRole("button", { name: logFoods }));
      await sheet.findByText(notLogged);

      mockLogEntries.mockReturnValue(new Promise(() => undefined));
      await user.press(sheet.getByRole("button", { name: logFoods }));

      expect(sheet.queryByText(notLogged)).not.toBeOnTheScreen();
    });

    it("should not show the sentence again when the sheet is opened after a failure", async () => {
      mockLogEntries.mockRejectedValue(new Error("network down"));
      const user = await renderSearch();
      const sheet = await openThePlate(user);
      await user.press(sheet.getByRole("button", { name: logFoods }));
      await sheet.findByText(notLogged);
      await fireEvent(screen.getByLabelText(yourPlate), "accessibilityEscape");
      await advance(1000);

      const reopened = await openThePlate(user);

      expect(reopened.queryByText(notLogged)).not.toBeOnTheScreen();
    });
  });

  describe("offline", () => {
    it("should dim Log foods only: the amounts and the X still work", async () => {
      onlineManager.setOnline(false);
      const user = await renderSearch();
      const sheet = await openThePlate(user);

      expect(sheet.getByRole("button", { name: logFoods })).toBeDisabled();
      expect(sheet.getByLabelText(milkAmount)).toBeEnabled();
      expect(sheet.getByRole("button", { name: "Remove Banana from your plate" })).toBeEnabled();
      await fireEvent.changeText(sheet.getByLabelText(milkAmount), "300");
      expect(sheet.getByText("704 kcal")).toBeOnTheScreen();
    });

    it("should not write when the dimmed button is pressed", async () => {
      onlineManager.setOnline(false);
      const user = await renderSearch();
      const sheet = await openThePlate(user);

      await user.press(sheet.getByRole("button", { name: logFoods }));

      expect(mockLogEntries).not.toHaveBeenCalled();
      expect(sheet.queryByText(notLogged)).not.toBeOnTheScreen();
    });
  });

  describe("before the profile's time zone is known", () => {
    it("should dim Log foods, with nothing to say about it", async () => {
      profileTimeZone.current = { data: undefined, isPending: true, isError: false };
      const user = await renderSearch();
      const sheet = await openThePlate(user);

      expect(sheet.getByRole("button", { name: logFoods })).toBeDisabled();
    });
  });
});
