import { onlineManager } from "@tanstack/react-query";
import { act, render, screen, userEvent } from "@testing-library/react-native";
import { AccessibilityInfo, Text as MockText } from "react-native";
import { setUpTests } from "react-native-reanimated";

import { recentFoods, resetApiClientMock } from "./support/apiClientMock";
import { compileFoodSearchStyles } from "./support/foodSearchStyles";
import { resetSearchApiClientMock } from "./support/searchApiClientMock";
import FoodSearchRoute from "../../app/foods/index";
import { AssistantSheetHost } from "../../components/AssistantSheetHost";
import { ToastProvider } from "../../components/ui";
import { PlateProvider } from "../../lib/plate";
import { ThemeProvider } from "../../lib/theme";
import { resetRouterMock, routerMock } from "../support/expoRouterMock";
import { registerAppStyles } from "../support/nativeWindStyles";
import { expectTextsInOrder } from "../support/textsInOrder";

import type { AssistantSheetProps } from "../../components/AssistantSheet";

// The Describe row in Log food, under Quick add (`assistant · describe`, the left phone). The sheet it opens
// has its own tests, so it is a stand-in here that says what it was opened with.

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
jest.mock("expo-router/react-navigation", () => ({ usePreventRemove: () => undefined }));
jest.mock("../../components/AssistantSheet", () => ({
  AssistantSheet: ({ open, localDate, describeAt }: AssistantSheetProps) => (
    <MockText>
      {`${open ? "Sheet open" : "Sheet closed"} on ${localDate}${describeAt === undefined ? "" : ` describing at ${describeAt}`}`}
    </MockText>
  ),
}));

setUpTests();

const describeRow = () =>
  screen.getByRole("button", { name: "Describe, Say what you ate, the assistant logs it" });

async function renderLogSearch(params: Record<string, string>) {
  routerMock.searchParams = params;
  await render(
    <ThemeProvider fixedPreference="dark">
      <ToastProvider>
        <PlateProvider>
          <AssistantSheetHost>
            <FoodSearchRoute />
          </AssistantSheetHost>
        </PlateProvider>
      </ToastProvider>
    </ThemeProvider>,
  );
  return userEvent.setup({ advanceTimers: jest.advanceTimersByTime });
}

describe("the Describe row in Log food", () => {
  let styles: string;

  beforeAll(async () => {
    styles = await compileFoodSearchStyles();
  });

  beforeEach(() => {
    // 12:40 in London on Thursday 15 October 2026.
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

  it("should sit under Quick add and above Recent, with the board's words", async () => {
    recentFoods.current = { data: [], isPending: false, isError: false };
    await renderLogSearch({ day: "2026-10-15", time: "13:00" });

    expectTextsInOrder(
      screen.getAllByText(/^(Quick add|Describe|Say what you ate|Nothing recent)/),
      ["Quick add", "Describe", "Say what you ate, the assistant logs it", "Nothing recent"],
    );
    expect(describeRow()).toBeOnTheScreen();
  });

  it("should be absent from the plain search, which has no log context", async () => {
    await renderLogSearch({});

    expect(screen.queryByRole("button", { name: /^Describe/ })).not.toBeOnTheScreen();
  });

  it("should open the sheet on the day and at the time of the hour's plus", async () => {
    const user = await renderLogSearch({ day: "2026-10-15", time: "13:00" });

    await user.press(describeRow());

    expect(screen.getByText("Sheet open on 2026-10-15 describing at 13:00")).toBeOnTheScreen();
  });

  it("should log to another day, not only today", async () => {
    const user = await renderLogSearch({ day: "2026-10-12", time: "13:00" });

    await user.press(describeRow());

    expect(screen.getByText("Sheet open on 2026-10-12 describing at 13:00")).toBeOnTheScreen();
  });

  it("should open at the time a food would be logged at now when the plus gave no hour", async () => {
    const user = await renderLogSearch({ day: "2026-10-15" });

    await user.press(describeRow());

    expect(screen.getByText("Sheet open on 2026-10-15 describing at 12:40")).toBeOnTheScreen();
  });
});
