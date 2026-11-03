import "./support/gestureHandler";

import { render, screen, userEvent } from "@testing-library/react-native";
import { ExpoRoot, Stack } from "expo-router";
import { getMockContext } from "expo-router/testing-library";
import { Pressable, Text as MockText } from "react-native";

import FoodsLayout from "../app/foods/_layout";
import { useOpenAssistant } from "../components/AssistantSheetHost";
import { ThemeProvider } from "../lib/theme";
import { resetApiClientMock } from "./foods/support/apiClientMock";

import type { AssistantSheetProps } from "../components/AssistantSheet";

// The food sheet is a modal over the app, so the assistant sheet Describe opens has to be drawn inside it.
// The real foods layout is navigated by the real router, and its search is a stand-in that opens the assistant
// as Describe does. The sheet itself has its own tests, so it is a stand-in too.
jest.mock("@react-native-async-storage/async-storage", () => ({
  __esModule: true,
  default: {
    getItem: () => Promise.resolve(null),
    setItem: () => Promise.resolve(),
    removeItem: () => Promise.resolve(),
  },
}));
jest.mock("../global.css", () => ({}));
jest.mock(
  "@keylow/api-client",
  () =>
    jest.requireActual<{ mockApiClient: unknown }>("./foods/support/apiClientMock").mockApiClient,
);
jest.mock("expo-status-bar", () => ({ StatusBar: () => null }));
jest.mock("../components/AssistantSheet", () => ({
  AssistantSheet: ({ open, localDate, describeAt }: AssistantSheetProps) => (
    <MockText>{`${open ? "Sheet open" : "Sheet closed"} on ${localDate} describing at ${describeAt}`}</MockText>
  ),
}));

function SearchStandIn() {
  const openAssistant = useOpenAssistant();

  return (
    <Pressable
      accessibilityRole="button"
      onPress={() => {
        openAssistant({ localDate: "2026-10-14", describeAt: "13:00" });
      }}
    >
      <MockText>Describe</MockText>
    </Pressable>
  );
}

const standIn = () => null;

const routes = {
  _layout: () => <Stack screenOptions={{ headerShown: false }} />,
  "foods/_layout": FoodsLayout,
  "foods/index": SearchStandIn,
  "foods/new": standIn,
  "foods/[id]/index": standIn,
  "foods/[id]/log": standIn,
  "foods/[id]/edit": standIn,
  "foods/recipe/[id]/log": standIn,
  "foods/scan": standIn,
  "foods/quick-add": standIn,
};

describe("the assistant sheet in the food sheet's layout", () => {
  beforeEach(() => {
    resetApiClientMock();
  });

  it("should open from a screen of the food sheet", async () => {
    const user = userEvent.setup();
    await render(
      <ThemeProvider fixedPreference="dark">
        <ExpoRoot context={getMockContext(routes)} location="/foods?day=2026-10-14&time=13:00" />
      </ThemeProvider>,
    );

    await user.press(await screen.findByRole("button", { name: "Describe" }));

    expect(screen.getByText("Sheet open on 2026-10-14 describing at 13:00")).toBeOnTheScreen();
  });
});
