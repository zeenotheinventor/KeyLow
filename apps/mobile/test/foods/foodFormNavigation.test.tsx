import "../support/gestureHandler";

import { act, render, screen, userEvent } from "@testing-library/react-native";
import { ExpoRoot, router } from "expo-router";
import { getMockContext } from "expo-router/testing-library";
import { BackHandler, Text } from "react-native";

import {
  mockCreateFood,
  mockUpdateFood,
  resetApiClientMock,
  savedFoodId,
} from "./support/apiClientMock";
import { resetSearchApiClientMock } from "./support/searchApiClientMock";
import TabsLayout from "../../app/(tabs)/_layout";
import DashboardRoute from "../../app/(tabs)/dashboard";
import MoreRoute from "../../app/(tabs)/more";
import RootLayout from "../../app/_layout";
import EditFoodRoute from "../../app/foods/[id]/edit";
import FoodsLayout from "../../app/foods/_layout";
import FoodSearchRoute from "../../app/foods/index";
import NewFoodRoute from "../../app/foods/new";
import { fakeSession, mockSupabaseClient, resetSupabaseMock } from "../support/supabaseMock";

// The real root, tab and foods layouts, the real search sheet and the real create and edit forms are
// navigated by the real router, with only the data hooks mocked. This test is about how the form is left.
jest.mock("../../global.css", () => ({}));
jest.mock("@react-native-async-storage/async-storage", () => ({
  __esModule: true,
  default: { getItem: () => Promise.resolve(null), setItem: () => Promise.resolve() },
}));
jest.mock("../../lib/supabase", () => ({
  supabase: jest.requireActual<{ mockSupabaseClient: unknown }>("../support/supabaseMock")
    .mockSupabaseClient,
}));
jest.mock(
  "@keylow/api-client",
  () =>
    jest.requireActual<{ mockSearchApiClient: unknown }>("./support/searchApiClientMock")
      .mockSearchApiClient,
);
jest.mock(
  "react-native-safe-area-context",
  () =>
    jest.requireActual<{ default: unknown }>("react-native-safe-area-context/jest/mock").default,
);
jest.mock("expo-status-bar", () => ({ StatusBar: () => null }));

const standIn = (text: string) =>
  function StandIn() {
    return <Text>{text}</Text>;
  };

// The diary has its own tests. Here it is a heading, because these tests are about the shell around it.
function DiaryStandIn() {
  return <Text role="heading">Diary</Text>;
}

const routes = {
  _layout: RootLayout,
  "(tabs)/_layout": TabsLayout,
  "(tabs)/dashboard": DashboardRoute,
  "(tabs)/diary": DiaryStandIn,
  "(tabs)/train": standIn("Train screen"),
  "(tabs)/more": MoreRoute,
  "(tabs)/recipes": standIn("Recipes screen"),
  "(tabs)/weight": standIn("Weight screen"),
  "(tabs)/settings": standIn("Settings screen"),
  "foods/_layout": FoodsLayout,
  "foods/index": FoodSearchRoute,
  "foods/new": NewFoodRoute,
  "foods/scan": standIn("Scan screen"),
  "foods/[id]/index": standIn("Food screen"),
  "foods/[id]/edit": EditFoodRoute,
};

async function renderApp(location: string) {
  await render(<ExpoRoot context={getMockContext(routes)} location={location} />);
}

// The handlers the navigation container registered for the Android back button. The last one registered
// is asked first, and the first to say it handled the press stops it, as the platform does.
const backPressHandlers: Parameters<typeof BackHandler.addEventListener>[1][] = [];

function pressAndroidBackButton(): void {
  for (const handler of [...backPressHandlers].reverse()) {
    if (handler({ type: "hardwareBackPress", timeStamp: 0 }) === true) {
      return;
    }
  }
}

function headerConfigs() {
  return screen.root?.queryAll((node) => node.type === "RNSScreenStackHeaderConfig") ?? [];
}

const searchHeading = () => screen.queryByRole("heading", { name: "Find food" });
const formHeading = (name: string) => screen.queryByRole("heading", { name });

async function openFormFromSearch(path: string, heading: string) {
  const user = userEvent.setup();
  await renderApp("/recipes");
  await act(() => {
    router.push("/foods");
  });
  expect(await screen.findByRole("heading", { name: "Find food" })).toBeOnTheScreen();
  await act(() => {
    router.push(path);
  });
  expect(await screen.findByRole("heading", { name: heading })).toBeOnTheScreen();
  return user;
}

describe("leaving the food form", () => {
  beforeEach(() => {
    backPressHandlers.length = 0;
    jest.spyOn(BackHandler, "addEventListener").mockImplementation((_eventName, handler) => {
      backPressHandlers.push(handler);
      return { remove: jest.fn() };
    });
    resetSupabaseMock();
    resetApiClientMock();
    resetSearchApiClientMock();
    mockSupabaseClient.auth.getSession.mockResolvedValue({
      data: { session: fakeSession },
      error: null,
    });
  });

  afterEach(() => {
    jest.restoreAllMocks();
  });

  describe("the new food form", () => {
    it("should draw its own header and no native one", async () => {
      await renderApp("/foods/new");

      expect(await screen.findByRole("heading", { name: "New food" })).toBeOnTheScreen();
      expect(headerConfigs().every((config) => config.props.hidden === true)).toBe(true);
    });

    it("should return to the search on Back, saving nothing", async () => {
      const user = await openFormFromSearch("/foods/new", "New food");
      await user.type(screen.getByLabelText("Name"), "Oat bar");

      await user.press(screen.getByRole("button", { name: "Back" }));

      expect(await screen.findByRole("heading", { name: "Find food" })).toBeOnTheScreen();
      expect(formHeading("New food")).not.toBeOnTheScreen();
      expect(mockCreateFood).not.toHaveBeenCalled();
    });

    it("should dismiss the whole sheet on Close, back to where it was opened, saving nothing", async () => {
      const user = await openFormFromSearch("/foods/new", "New food");
      await user.type(screen.getByLabelText("Name"), "Oat bar");

      await user.press(screen.getByRole("button", { name: "Close" }));

      expect(await screen.findByText("Recipes screen")).toBeOnTheScreen();
      expect(formHeading("New food")).not.toBeOnTheScreen();
      expect(searchHeading()).not.toBeOnTheScreen();
      expect(mockCreateFood).not.toHaveBeenCalled();
    });

    it("should return to the search on the Android back button, saving nothing", async () => {
      const user = await openFormFromSearch("/foods/new", "New food");
      await user.type(screen.getByLabelText("Name"), "Oat bar");

      await act(() => {
        pressAndroidBackButton();
      });

      expect(await screen.findByRole("heading", { name: "Find food" })).toBeOnTheScreen();
      expect(formHeading("New food")).not.toBeOnTheScreen();
      expect(mockCreateFood).not.toHaveBeenCalled();
    });

    it("should go to the dashboard on Close from a cold link, with nothing under the sheet", async () => {
      const user = userEvent.setup();
      await renderApp("/foods/new");
      expect(await screen.findByRole("heading", { name: "New food" })).toBeOnTheScreen();

      await user.press(screen.getByRole("button", { name: "Close" }));

      expect(await screen.findByRole("button", { name: "Find food" })).toBeOnTheScreen();
      expect(formHeading("New food")).not.toBeOnTheScreen();
    });
  });

  describe("the edit form", () => {
    const editPath = `/foods/${savedFoodId}/edit`;

    it("should draw its own header and no native one", async () => {
      await renderApp(editPath);

      expect(await screen.findByRole("heading", { name: "Edit food" })).toBeOnTheScreen();
      expect(headerConfigs().every((config) => config.props.hidden === true)).toBe(true);
    });

    it("should return to the search on Back, saving nothing", async () => {
      const user = await openFormFromSearch(editPath, "Edit food");
      await user.type(screen.getByLabelText("Name"), " extra");

      await user.press(screen.getByRole("button", { name: "Back" }));

      expect(await screen.findByRole("heading", { name: "Find food" })).toBeOnTheScreen();
      expect(mockUpdateFood).not.toHaveBeenCalled();
    });

    it("should dismiss the whole sheet on Close, saving nothing", async () => {
      const user = await openFormFromSearch(editPath, "Edit food");
      await user.type(screen.getByLabelText("Name"), " extra");

      await user.press(screen.getByRole("button", { name: "Close" }));

      expect(await screen.findByText("Recipes screen")).toBeOnTheScreen();
      expect(mockUpdateFood).not.toHaveBeenCalled();
    });

    it("should return to the search on the Android back button, saving nothing", async () => {
      const user = await openFormFromSearch(editPath, "Edit food");
      await user.type(screen.getByLabelText("Name"), " extra");

      await act(() => {
        pressAndroidBackButton();
      });

      expect(await screen.findByRole("heading", { name: "Find food" })).toBeOnTheScreen();
      expect(mockUpdateFood).not.toHaveBeenCalled();
    });
  });
});
