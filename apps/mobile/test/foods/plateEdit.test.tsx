import "react-native-gesture-handler/jestSetup";

import { SPOON_PORTIONS } from "@keylow/core/nutrition";
import { plateItemOfPickedFood, plateItemOfRecipe } from "@keylow/core/plate";
import { buildFood } from "@keylow/core/testing";
import { QueryClient, QueryClientProvider, onlineManager } from "@tanstack/react-query";
import { act, fireEvent, render, screen, userEvent, within } from "@testing-library/react-native";
import { useEffect, useState } from "react";
import { AccessibilityInfo, BackHandler, Pressable, Text } from "react-native";
import { setUpTests } from "react-native-reanimated";

import {
  foodFixture,
  foodQuery,
  portionFixtures,
  portionsQuery,
  profileTimeZone,
  recipeState,
  resetApiClientMock,
  savedFoodId,
} from "./support/apiClientMock";
import { goldenRecipe, goldenRecipeDetail, goldenRecipeId } from "./support/recipeFixtures";
import { mockLogEntries, resetSearchApiClientMock } from "./support/searchApiClientMock";
import PortionPickerRoute from "../../app/foods/[id]/log";
import RecipeAmountRoute from "../../app/foods/recipe/[id]/log";
import { FoodSearch } from "../../components/FoodSearch";
import { ToastProvider } from "../../components/ui";
import { PlateProvider, usePlate } from "../../lib/plate";
import { ThemeProvider } from "../../lib/theme";
import { chickenAndRice } from "../plate/support/plateItems";
import { trackFieldSelection } from "../support/amountFieldSelection";
import { resetRouterMock, routerMock } from "../support/expoRouterMock";
import { compileKitStyles } from "../support/kitStyles";
import { registerAppStyles } from "../support/nativeWindStyles";

import type { PlateContextValue, PlateItemBuilder } from "../../lib/plate";

// Changing a plate row's unit: the row's name in Your plate opens the portion picker on that row's amount and
// unit, Save puts the row back where it was with the new amount, and Back changes nothing. The search, the
// sheet and the two routes are the real ones, with the router and the data hooks mocked; the router mock
// keeps the search under the picker, as the stack does. The boards are plate · open and portion · plate-edit.

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

const day = "2026-10-15";
const yourPlate = "Your plate";
const milkName = "Semi-skimmed milk";
const teaspoon = SPOON_PORTIONS.find((spoon) => spoon.label === "1 tsp");
if (teaspoon === undefined) {
  throw new Error("Core has no teaspoon");
}

const milkFood = buildFood({
  id: savedFoodId,
  name: milkName,
  basis: "per_100ml",
  kcal: 46,
  protein_g: 3.5,
  carbs_g: 4.8,
  fat_g: 1.7,
});

const milkOf =
  (amount: Parameters<typeof plateItemOfPickedFood>[0]["amount"]): PlateItemBuilder =>
  (key) =>
    plateItemOfPickedFood({ key, food: milkFood, portions: [], amount });

const milkInMillilitres = milkOf({ quantity: 200, unit: "ml" });
const milkInTeaspoons = milkOf({
  quantity: 1,
  unit: "portion",
  portion: teaspoon,
});

const [bar] = portionFixtures;
if (bar === undefined) {
  throw new Error("The fixture has no portion");
}

const oatBarInBars =
  (quantity: number): PlateItemBuilder =>
  (key) =>
    plateItemOfPickedFood({
      key,
      food: foodFixture,
      portions: portionFixtures,
      amount: { quantity, unit: "portion", portion: bar },
    });

// A food that is not the one the route is opened on.
const otherFoodInGrams: PlateItemBuilder = (key) =>
  plateItemOfPickedFood({
    key,
    food: buildFood({ id: "55555555-5555-4555-8555-555555555555", name: "Other food" }),
    portions: [],
    amount: { quantity: 100, unit: "g" },
  });

// A recipe that is not the one the route is opened on.
const otherRecipe: PlateItemBuilder = (key) =>
  plateItemOfRecipe({
    key,
    recipe: { ...goldenRecipe(), id: "00000000-0000-4000-8000-0000000000b2" },
  });

// A row whose amount field is empty, so the row is not valid.
const withNoAmount =
  (build: PlateItemBuilder): PlateItemBuilder =>
  (key) => ({ ...build(key), quantity: 0, quantityText: "" });

const rowOpenName = (name: string) => new RegExp(`^${name}, .*, change amount or unit$`);

let plate: PlateContextValue;

function PlateReader() {
  const current = usePlate();
  useEffect(() => {
    plate = current;
  });
  return null;
}

// Puts foods on the plate the way the search's plus and the picker do, so a test can start from a plate.
function PlateFiller({ foods }: { foods: readonly PlateItemBuilder[] }) {
  const { add } = usePlate();

  return (
    <Pressable
      role="button"
      aria-label="Fill the plate"
      onPress={() => {
        for (const build of foods) {
          add(build);
        }
      }}
    >
      <Text>Fill the plate</Text>
    </Pressable>
  );
}

// Draws its children once there is a food on the plate.
function WhenFilled({ children }: { children: React.ReactNode }) {
  return usePlate().count === 0 ? null : children;
}

// The search with a route pushed over it: a push shows the route and takes the search's focus, a back brings
// the search back, as the stack does. The route reads its parameters from the address it was pushed with.
function Flow({ foods }: { foods: readonly PlateItemBuilder[] }) {
  const [pushed, setPushed] = useState<string>();
  useEffect(() => {
    routerMock.push.mockImplementation((target) => {
      const url = new URL(target, "https://app.test");
      routerMock.searchParams = {
        id: url.pathname.split("/").at(-2) ?? "",
        ...Object.fromEntries(url.searchParams.entries()),
      };
      routerMock.isFocused = false;
      setPushed(url.pathname);
    });
    routerMock.back.mockImplementation(() => {
      routerMock.isFocused = true;
      setPushed(undefined);
    });
  }, []);

  return (
    <>
      <FoodSearch
        logging={{
          context: { day },
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
      {pushed === undefined ? null : pushed.includes("/recipe/") ? (
        <RecipeAmountRoute />
      ) : (
        <PortionPickerRoute />
      )}
    </>
  );
}

function Providers({ children }: { children: React.ReactNode }) {
  const [queryClient] = useState(() => new QueryClient());

  return (
    <QueryClientProvider client={queryClient}>
      <ThemeProvider fixedPreference="dark">
        <ToastProvider>
          <PlateProvider>
            <PlateReader />
            {children}
          </PlateProvider>
        </ToastProvider>
      </ThemeProvider>
    </QueryClientProvider>
  );
}

async function renderFlow(foods: readonly PlateItemBuilder[]) {
  const user = userEvent.setup({ advanceTimers: jest.advanceTimersByTime });
  await render(
    <Providers>
      <Flow foods={foods} />
    </Providers>,
  );
  await user.press(screen.getByRole("button", { name: "Fill the plate" }));

  return user;
}

async function advance(milliseconds: number) {
  await act(() => {
    jest.advanceTimersByTime(milliseconds);
  });
}

async function openThePlate(user: ReturnType<typeof userEvent.setup>, count: number) {
  await user.press(
    screen.getByRole("button", { name: `Your plate, ${count} ${count === 1 ? "food" : "foods"}` }),
  );
  await advance(1000);
}

const theRows = () => within(screen.getByLabelText("Foods on your plate"));
const rowNames = () => theRows().getAllByRole("button", { name: /change amount or unit$/ });

// The route on its own, as a link to it opens it.
async function renderRoute(route: "food" | "recipe", params: Record<string, string>) {
  routerMock.searchParams = { id: route === "food" ? savedFoodId : goldenRecipeId, ...params };
  const user = userEvent.setup({ advanceTimers: jest.advanceTimersByTime });
  await render(
    <Providers>{route === "food" ? <PortionPickerRoute /> : <RecipeAmountRoute />}</Providers>,
  );

  return user;
}

// The route on a plate that already holds `foods`, opened on the first row as a link from the sheet does.
// The router mock keeps the route on the screen after a back, so a second press is one the screen could take.
async function renderRouteOnRow(
  route: "food" | "recipe",
  foods: readonly PlateItemBuilder[],
  params: Record<string, string | undefined> = {},
) {
  // A parameter left undefined is not in the address at all.
  const address: Record<string, string | undefined> = {
    id: route === "food" ? savedFoodId : goldenRecipeId,
    day,
    plate: "plate-row-1",
    ...params,
  };
  routerMock.searchParams = Object.fromEntries(
    Object.entries(address).filter((entry): entry is [string, string] => entry[1] !== undefined),
  );
  const user = userEvent.setup({ advanceTimers: jest.advanceTimersByTime });
  await render(
    <Providers>
      <PlateFiller foods={foods} />
      <WhenFilled>{route === "food" ? <PortionPickerRoute /> : <RecipeAmountRoute />}</WhenFilled>
    </Providers>,
  );
  await user.press(screen.getByRole("button", { name: "Fill the plate" }));

  return user;
}

// Pressing a unit chip selects the amount, which the jest preset's text field cannot do.
trackFieldSelection();

describe("changing a plate row's unit", () => {
  let styles: string;

  beforeAll(async () => {
    styles = await compileKitStyles("", [
      "components/FoodSearch",
      "components/PortionPicker",
      "components/FoodDetail",
    ]);
  });

  beforeEach(() => {
    jest.useFakeTimers({ now: new Date("2026-10-15T11:40:30Z") });
    registerAppStyles(styles);
    jest.spyOn(AccessibilityInfo, "isReduceMotionEnabled").mockResolvedValue(false);
    resetRouterMock();
    resetApiClientMock();
    resetSearchApiClientMock();
    Object.assign(foodQuery, { data: milkFood });
    Object.assign(portionsQuery, { data: [] });
    recipeState.current = { status: "ready", recipe: goldenRecipeDetail() };
    onlineManager.setOnline(true);
  });

  afterEach(async () => {
    jest.useRealTimers();
    jest.restoreAllMocks();
    await act(() => {
      onlineManager.setOnline(true);
    });
  });

  describe("a food row", () => {
    it("should push the picker with the day and the row's key when the name is pressed", async () => {
      const user = await renderFlow([milkInMillilitres]);
      await openThePlate(user, 1);

      await user.press(
        within(screen.getByLabelText(yourPlate)).getByRole("button", {
          name: `${milkName}, 200 ml, 92 kilocalories, change amount or unit`,
        }),
      );

      const [row] = plate.items;
      expect(routerMock.push).toHaveBeenCalledTimes(1);
      expect(routerMock.push).toHaveBeenCalledWith(
        `/foods/${savedFoodId}/log?day=${day}&plate=${row?.key}`,
      );
    });

    it("should open the picker on the row's amount and unit, with Save, no Time row and no Delete", async () => {
      const user = await renderFlow([milkInMillilitres]);
      await openThePlate(user, 1);

      await user.press(screen.getByRole("button", { name: rowOpenName(milkName) }));
      await advance(1000);

      expect(screen.getByRole("heading", { name: milkName })).toBeOnTheScreen();
      expect(screen.getByRole("button", { name: "Save" })).toBeEnabled();
      expect(screen.getByLabelText(/^Amount \(ml\)/)).toHaveDisplayValue("200");
      expect(screen.getByRole("radio", { name: "ml", checked: true })).toBeOnTheScreen();
      expect(screen.queryByRole("button", { name: /^Time/ })).not.toBeOnTheScreen();
      expect(screen.queryByRole("button", { name: "Delete" })).not.toBeOnTheScreen();
      expect(screen.queryByRole("button", { name: "Add to plate" })).not.toBeOnTheScreen();
    });

    it("should change the unit and the values of the row in the sheet when Save is pressed, and go back", async () => {
      const user = await renderFlow([milkInMillilitres]);
      await openThePlate(user, 1);
      await user.press(screen.getByRole("button", { name: rowOpenName(milkName) }));

      await user.press(screen.getByRole("radio", { name: "1 tsp" }));
      await user.press(screen.getByRole("button", { name: "Save" }));
      await advance(1000);

      expect(routerMock.back).toHaveBeenCalledTimes(1);
      const sheet = within(screen.getByLabelText(yourPlate));
      expect(
        sheet.getByRole("button", {
          name: `${milkName}, 1 tsp, 2 kilocalories, change amount or unit`,
        }),
      ).toBeOnTheScreen();
      expect(sheet.getByLabelText("Amount of Semi-skimmed milk, tsp")).toHaveDisplayValue("1");
      expect(plate.items).toHaveLength(1);
    });

    it("should keep the row in its place when its unit changes", async () => {
      const user = await renderFlow([milkInMillilitres, chickenAndRice]);
      await openThePlate(user, 2);
      await user.press(screen.getByRole("button", { name: rowOpenName(milkName) }));

      await user.press(screen.getByRole("radio", { name: "1 tsp" }));
      await user.press(screen.getByRole("button", { name: "Save" }));
      await advance(1000);

      const [first, second] = rowNames();
      expect(first).toHaveAccessibleName(rowOpenName(milkName));
      expect(first).toHaveAccessibleName(/, 1 tsp, /);
      expect(second).toHaveAccessibleName(rowOpenName("Chicken and rice"));
    });

    it("should leave the row as it was when Back is pressed, with the sheet still open", async () => {
      const user = await renderFlow([milkInMillilitres]);
      await openThePlate(user, 1);
      await user.press(screen.getByRole("button", { name: rowOpenName(milkName) }));
      await user.press(screen.getByRole("radio", { name: "1 tsp" }));

      await user.press(screen.getByRole("button", { name: "Back" }));
      await advance(1000);

      expect(routerMock.back).toHaveBeenCalledTimes(1);
      expect(
        within(screen.getByLabelText(yourPlate)).getByRole("button", {
          name: `${milkName}, 200 ml, 92 kilocalories, change amount or unit`,
        }),
      ).toBeOnTheScreen();
      expect(plate.items[0]).toMatchObject({ quantity: 200, unit: { kind: "ml" } });
    });

    it("should keep two rows of the same food and unit apart, because only adding merges", async () => {
      const user = await renderFlow([milkInMillilitres, milkInTeaspoons]);
      await openThePlate(user, 2);
      const [, teaspoonRow] = rowNames();
      if (teaspoonRow === undefined) {
        throw new Error("The plate has no second row");
      }
      await user.press(teaspoonRow);

      await user.press(screen.getByRole("radio", { name: "ml" }));
      await user.press(screen.getByRole("button", { name: "Save" }));
      await advance(1000);

      expect(plate.items).toHaveLength(2);
      expect(plate.items.map((item) => item.quantity)).toEqual([200, 100]);
      expect(plate.items.map((item) => (item.kind === "food" ? item.unit.kind : "recipe"))).toEqual(
        ["ml", "ml"],
      );
    });

    it("should leave the covered sheet out of Android's back press, and bring it back with the row", async () => {
      const remove = jest.fn();
      jest.spyOn(BackHandler, "addEventListener").mockReturnValue({ remove });
      const user = await renderFlow([milkInMillilitres]);
      await openThePlate(user, 1);
      expect(remove).not.toHaveBeenCalled();

      await user.press(screen.getByRole("button", { name: rowOpenName(milkName) }));
      await advance(1000);

      expect(remove).toHaveBeenCalledTimes(1);
      expect(screen.queryByLabelText(yourPlate)).not.toBeOnTheScreen();

      await user.press(screen.getByRole("button", { name: "Back" }));
      await advance(1000);

      expect(screen.getByLabelText(yourPlate)).toBeOnTheScreen();
    });

    it("should dim the name and open nothing while the connection is lost", async () => {
      const user = await renderFlow([milkInMillilitres]);
      await openThePlate(user, 1);
      await act(() => {
        onlineManager.setOnline(false);
      });

      const name = screen.getByRole("button", { name: rowOpenName(milkName) });
      await user.press(name);

      expect(name).toBeDisabled();
      expect(routerMock.push).not.toHaveBeenCalled();
      expect(
        within(screen.getByLabelText(yourPlate)).getByRole("button", {
          name: "Remove Semi-skimmed milk from your plate",
        }),
      ).toBeEnabled();
    });

    it("should go back to the search for a key that is not on the plate", async () => {
      await renderRoute("food", { day, plate: "gone" });

      expect(routerMock.dismissTo).toHaveBeenCalledTimes(1);
      expect(routerMock.dismissTo).toHaveBeenCalledWith(`/foods?day=${day}`);
      expect(screen.queryByRole("button", { name: "Save" })).not.toBeOnTheScreen();
    });

    it("should go back to the search for a key that is another food's row", async () => {
      await renderRouteOnRow("food", [otherFoodInGrams]);

      expect(routerMock.dismissTo).toHaveBeenCalledWith(`/foods?day=${day}`);
      expect(screen.queryByRole("button", { name: "Save" })).not.toBeOnTheScreen();
    });

    it("should go back once however often Save is pressed before the screen has gone", async () => {
      await renderRouteOnRow("food", [milkInMillilitres]);
      const save = screen.getByRole("button", { name: "Save" });

      await act(async () => {
        await fireEvent.press(save);
        await fireEvent.press(save);
      });

      expect(routerMock.back).toHaveBeenCalledTimes(1);
      expect(plate.items).toHaveLength(1);
    });

    it("should open on the portion the row is counted in while the food still has it", async () => {
      Object.assign(foodQuery, { data: foodFixture });
      Object.assign(portionsQuery, { data: portionFixtures });
      await renderRouteOnRow("food", [oatBarInBars(2)]);

      expect(screen.getByRole("radio", { name: "1 bar", checked: true })).toBeOnTheScreen();
      expect(screen.getByLabelText(/^Amount \(/)).toHaveDisplayValue("2");
    });

    it("should open on the grams the row came to once its portion has gone", async () => {
      Object.assign(foodQuery, { data: foodFixture });
      Object.assign(portionsQuery, { data: [] });
      await renderRouteOnRow("food", [oatBarInBars(2)]);

      expect(screen.getByRole("radio", { name: "g", checked: true })).toBeOnTheScreen();
      expect(screen.getByLabelText(/^Amount \(/)).toHaveDisplayValue("90");
    });

    it.each([
      ["still being read", { data: undefined, isPending: true, isError: false }],
      ["not readable", { data: undefined, isPending: false, isError: true }],
    ])(
      "should open and save, with no day on the link, with the profile's time zone %s",
      async (_state, zone) => {
        profileTimeZone.current = zone;
        const user = await renderRouteOnRow("food", [milkInMillilitres], { day: undefined });

        await user.press(screen.getByRole("radio", { name: "1 tsp" }));
        await user.press(screen.getByRole("button", { name: "Save" }));

        expect(routerMock.back).toHaveBeenCalledTimes(1);
        expect(plate.items[0]).toMatchObject({ unit: { kind: "portion", label: "1 tsp" } });
      },
    );

    it.each([
      ["grams or millilitres", milkInMillilitres, milkFood, [], "ml", "100"],
      ["a spoon", milkInTeaspoons, milkFood, [], "1 tsp", "1"],
      ["a portion", oatBarInBars(1), foodFixture, portionFixtures, "1 bar", "1"],
    ])(
      "should keep the unit of a row with no amount and start it at that unit's usual amount: %s",
      async (_name, build, food, portions, chip, amount) => {
        Object.assign(foodQuery, { data: food });
        Object.assign(portionsQuery, { data: portions });
        await renderRouteOnRow("food", [withNoAmount(build)]);

        expect(screen.getByRole("radio", { name: chip, checked: true })).toBeOnTheScreen();
        expect(screen.getByLabelText(/^Amount \(/)).toHaveDisplayValue(amount);
      },
    );
  });

  describe("a recipe row", () => {
    it("should open the recipe picker on the row's amount and unit, with Save, no Time row and no Delete", async () => {
      const user = await renderFlow([chickenAndRice]);
      await openThePlate(user, 1);

      await user.press(screen.getByRole("button", { name: rowOpenName("Chicken and rice") }));
      await advance(1000);

      expect(screen.getByRole("heading", { name: "Chicken and rice" })).toBeOnTheScreen();
      expect(screen.getByRole("button", { name: "Save" })).toBeEnabled();
      expect(screen.getByLabelText("Amount (serving)")).toHaveDisplayValue("1");
      expect(screen.getByRole("radio", { name: "1 serving", checked: true })).toBeOnTheScreen();
      expect(screen.queryByRole("button", { name: /^Time/ })).not.toBeOnTheScreen();
      expect(screen.queryByRole("button", { name: "Delete" })).not.toBeOnTheScreen();
    });

    it("should change the row to grams in the sheet when Save is pressed, in its place", async () => {
      const user = await renderFlow([chickenAndRice, milkInMillilitres]);
      await openThePlate(user, 2);
      await user.press(screen.getByRole("button", { name: rowOpenName("Chicken and rice") }));

      await user.press(screen.getByRole("radio", { name: "g" }));
      await user.press(screen.getByRole("button", { name: "Save" }));
      await advance(1000);

      const [first, second] = rowNames();
      expect(first).toHaveAccessibleName(/^Chicken and rice, 100 g, /);
      expect(second).toHaveAccessibleName(rowOpenName(milkName));
      expect(plate.items[0]).toMatchObject({ kind: "recipe", quantity: 100, unit: "g" });
    });

    it("should go back to the search for a key that is not on the plate", async () => {
      await renderRoute("recipe", { day, plate: "gone" });

      expect(routerMock.dismissTo).toHaveBeenCalledWith(`/foods?day=${day}`);
      expect(screen.queryByRole("button", { name: "Save" })).not.toBeOnTheScreen();
    });

    it("should go back to the search for a key that is another recipe's row", async () => {
      await renderRouteOnRow("recipe", [otherRecipe]);

      expect(routerMock.dismissTo).toHaveBeenCalledWith(`/foods?day=${day}`);
      expect(screen.queryByRole("button", { name: "Save" })).not.toBeOnTheScreen();
    });

    it("should go back once however often Save is pressed before the screen has gone", async () => {
      await renderRouteOnRow("recipe", [chickenAndRice]);
      const save = screen.getByRole("button", { name: "Save" });

      await act(async () => {
        await fireEvent.press(save);
        await fireEvent.press(save);
      });

      expect(routerMock.back).toHaveBeenCalledTimes(1);
      expect(plate.items).toHaveLength(1);
    });

    it("should keep the unit of a row with no amount and start it at one serving", async () => {
      await renderRouteOnRow("recipe", [withNoAmount(chickenAndRice)]);

      expect(screen.getByRole("radio", { name: "1 serving", checked: true })).toBeOnTheScreen();
      expect(screen.getByLabelText("Amount (serving)")).toHaveDisplayValue("1");
    });

    it("should keep the grams of a row with no amount and start it at 100 g", async () => {
      await renderRouteOnRow("recipe", [
        withNoAmount((key) =>
          plateItemOfRecipe({ key, recipe: goldenRecipe(), amount: { quantity: 1, unit: "g" } }),
        ),
      ]);

      expect(screen.getByRole("radio", { name: "g", checked: true })).toBeOnTheScreen();
      expect(screen.getByLabelText("Amount (g)")).toHaveDisplayValue("100");
    });
  });

  it("should not log or add anything when a row is saved", async () => {
    const user = await renderFlow([milkInMillilitres]);
    await openThePlate(user, 1);
    await user.press(screen.getByRole("button", { name: rowOpenName(milkName) }));

    await user.press(screen.getByRole("button", { name: "Save" }));

    expect(mockLogEntries).not.toHaveBeenCalled();
    expect(plate.addCount).toBe(1);
  });
});
