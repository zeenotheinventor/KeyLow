import "../support/gestureHandler";

import { KeyLowProvider } from "@keylow/api-client";
import { addCalendarDays, toLocalDate } from "@keylow/core/dates";
import { render, screen } from "@testing-library/react-native";

import { WeightScreen } from "../../components/WeightScreen";
import { ThemeProvider } from "../../lib/theme";
import { resetRouterMock } from "../support/expoRouterMock";
import {
  createWeightQueryClient,
  resetWeightBackend,
  weightBackend,
  weightClient,
  weighInRow,
} from "../support/weightBackend";

jest.mock("@react-native-async-storage/async-storage", () => ({
  __esModule: true,
  default: { getItem: () => Promise.resolve(null), setItem: () => Promise.resolve() },
}));
jest.mock(
  "expo-router",
  () => jest.requireActual<{ mockExpoRouter: unknown }>("../support/expoRouterMock").mockExpoRouter,
);
jest.mock(
  "react-native-safe-area-context",
  () =>
    jest.requireActual<{ default: unknown }>("react-native-safe-area-context/jest/mock").default,
);

async function renderWeightScreen() {
  await render(
    <ThemeProvider fixedPreference="dark">
      <KeyLowProvider client={weightClient} queryClient={createWeightQueryClient()}>
        <WeightScreen />
      </KeyLowProvider>
    </ThemeProvider>,
  );
}

const today = () => toLocalDate(new Date(), "Europe/London");

type Instance = NonNullable<ReturnType<typeof screen.getByRole>>;

function isInsideScrollView(node: Instance | null): boolean {
  return node !== null && (node.type === "RCTScrollView" || isInsideScrollView(node.parent));
}

describe("the trend card on the Weight screen", () => {
  beforeEach(() => {
    resetRouterMock();
    resetWeightBackend();
  });

  it("should scroll with the rows, above the Weigh-ins heading and the first row", async () => {
    weightBackend.weighIns = [
      weighInRow({ localDate: today(), utcTime: "07:30", weightKg: 82, timeZone: "UTC" }),
      weighInRow({
        localDate: addCalendarDays(today(), -1),
        utcTime: "07:30",
        weightKg: 82.2,
        timeZone: "UTC",
      }),
    ];
    await renderWeightScreen();

    const card = await screen.findByLabelText("Trend weight");
    const heading = screen.getByRole("heading", { name: "Weigh-ins" });
    const firstRow = screen.getAllByLabelText(/^Today, 07:30/)[0];
    const inOrder = screen.root?.queryAll(() => true) ?? [];

    expect(isInsideScrollView(card)).toBe(true);
    expect(inOrder.indexOf(card)).toBeLessThan(inOrder.indexOf(heading));
    expect(inOrder.indexOf(heading)).toBeLessThan(inOrder.indexOf(firstRow ?? heading));
  });

  it("should not show while the weigh-ins load", async () => {
    weightBackend.weighInReadsHang = true;
    await renderWeightScreen();

    expect(await screen.findByRole("status", { name: "Loading your weigh-ins" })).toBeOnTheScreen();
    expect(screen.queryByLabelText("Trend weight")).not.toBeOnTheScreen();
  });

  it("should not show when the weigh-ins fail to load", async () => {
    weightBackend.weighInReadsFail = true;
    await renderWeightScreen();

    expect(await screen.findByText("Couldn't load your weigh-ins")).toBeOnTheScreen();
    expect(screen.queryByLabelText("Trend weight")).not.toBeOnTheScreen();
  });

  it("should not show when there are no weigh-ins", async () => {
    await renderWeightScreen();

    expect(await screen.findByText("No weigh-ins yet")).toBeOnTheScreen();
    expect(screen.queryByLabelText("Trend weight")).not.toBeOnTheScreen();
  });
});
