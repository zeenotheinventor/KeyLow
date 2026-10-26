import "../support/gestureHandler";

import { act, render, screen, userEvent } from "@testing-library/react-native";
import { ExpoRoot, router, Stack } from "expo-router";
import { getMockContext } from "expo-router/testing-library";
import { Pressable, Text } from "react-native";

import { oatBarInGrams } from "./support/plateItems";
import FoodsLayout from "../../app/foods/_layout";
import { usePlate } from "../../lib/plate";
import { ThemeProvider } from "../../lib/theme";
import { resetApiClientMock } from "../foods/support/apiClientMock";

// The real foods layout is navigated by the real router. Its screens are stand-ins that read the plate.
// Nothing is stored in these tests, but the theme reads the phone's small store.
jest.mock("@react-native-async-storage/async-storage", () => ({
  __esModule: true,
  default: {
    getItem: () => Promise.resolve(null),
    setItem: () => Promise.resolve(),
    removeItem: () => Promise.resolve(),
  },
}));
jest.mock("../../global.css", () => ({}));
jest.mock(
  "@keylow/api-client",
  () =>
    jest.requireActual<{ mockApiClient: unknown }>("../foods/support/apiClientMock").mockApiClient,
);
jest.mock("expo-status-bar", () => ({ StatusBar: () => null }));

function PlateScreen({ name }: { name: string }) {
  const plate = usePlate();
  const time = plate.time.isNow ? "now" : plate.time.time;

  return (
    <>
      <Text>{`${name}: ${plate.count} on the plate, time ${time}`}</Text>
      <Pressable
        accessibilityRole="button"
        onPress={() => {
          plate.add((key) => oatBarInGrams(key));
        }}
      >
        <Text>{`Add from ${name}`}</Text>
      </Pressable>
    </>
  );
}

const standIn = (text: string) =>
  function StandIn() {
    return <Text>{text}</Text>;
  };

const routes = {
  _layout: () => <Stack screenOptions={{ headerShown: false }} />,
  index: standIn("Outside the sheet"),
  "foods/_layout": FoodsLayout,
  "foods/index": () => <PlateScreen name="Search" />,
  "foods/new": () => <PlateScreen name="Form" />,
  "foods/[id]/index": standIn("Food screen"),
  "foods/[id]/log": standIn("Picker screen"),
  "foods/[id]/edit": standIn("Edit food screen"),
  "foods/recipe/[id]/log": standIn("Recipe picker screen"),
  "foods/scan": standIn("Scan screen"),
  "foods/quick-add": standIn("Quick add screen"),
};

async function renderApp(location: string) {
  await render(
    <ThemeProvider fixedPreference="dark">
      <ExpoRoot context={getMockContext(routes)} location={location} />
    </ThemeProvider>,
  );
}

describe("the plate in the food sheet's layout", () => {
  beforeEach(() => {
    resetApiClientMock();
  });

  it("should start at now when the sheet was not opened from an hour", async () => {
    await renderApp("/foods?day=2026-10-14");

    expect(await screen.findByText("Search: 0 on the plate, time now")).toBeOnTheScreen();
  });

  it("should start at the hour an hour's plus opened the sheet on", async () => {
    await renderApp("/foods?day=2026-10-14&time=12:00");

    expect(await screen.findByText("Search: 0 on the plate, time 12:00")).toBeOnTheScreen();
  });

  it("should take the sheet's hour only as the starting value", async () => {
    await renderApp("/foods?day=2026-10-14&time=12:00");
    expect(await screen.findByText("Search: 0 on the plate, time 12:00")).toBeOnTheScreen();

    await act(() => {
      router.push("/foods/new?day=2026-10-14&time=15:00");
    });

    expect(await screen.findByText("Form: 0 on the plate, time 12:00")).toBeOnTheScreen();
  });

  it("should not pick up an hour that belongs to a screen outside the sheet", async () => {
    await renderApp("/?time=12:00");
    await act(() => {
      router.push("/foods?day=2026-10-14");
    });

    expect(await screen.findByText("Search: 0 on the plate, time now")).toBeOnTheScreen();
  });

  it("should share one plate between the search and the screens the sheet opens", async () => {
    const user = userEvent.setup();
    await renderApp("/foods?day=2026-10-14");

    await user.press(await screen.findByRole("button", { name: "Add from Search" }));
    await act(() => {
      router.push("/foods/new");
    });

    expect(await screen.findByText("Form: 1 on the plate, time now")).toBeOnTheScreen();
  });

  it("should give the next sheet an empty plate once this one has closed", async () => {
    const user = userEvent.setup();
    await renderApp("/");
    await act(() => {
      router.push("/foods?day=2026-10-14");
    });
    await user.press(await screen.findByRole("button", { name: "Add from Search" }));
    expect(await screen.findByText("Search: 1 on the plate, time now")).toBeOnTheScreen();

    await act(() => {
      router.back();
    });
    expect(await screen.findByText("Outside the sheet")).toBeOnTheScreen();
    await act(() => {
      router.push("/foods?day=2026-10-14");
    });

    expect(await screen.findByText("Search: 0 on the plate, time now")).toBeOnTheScreen();
  });
});
