import "../support/gestureHandler";

import { KeyLowProvider } from "@keylow/api-client";
import { addCalendarDays, toLocalDate } from "@keylow/core/dates";
import { render, screen, waitFor } from "@testing-library/react-native";

import { WeightScreen } from "../../components/WeightScreen";
import { ThemeProvider } from "../../lib/theme";
import { resetRouterMock } from "../support/expoRouterMock";
import { expectAccessibleNamesInOrder } from "../support/namesInOrder";
import {
  createWeightQueryClient,
  resetWeightBackend,
  weightBackend,
  weightClient,
  weighInRow,
} from "../support/weightBackend";

// The controls the boards draw on this screen open screens that later tickets build, so none is drawn yet.

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
  await waitFor(() => {
    expect(weightBackend.weighInRequestCount).toBeGreaterThan(0);
  });
}

const states = [
  {
    name: "loading",
    prepare: () => {
      weightBackend.weighInReadsHang = true;
    },
    settled: () => screen.getByRole("status", { name: "Loading your weigh-ins" }),
    buttons: ["Back to More"],
  },
  {
    name: "error",
    prepare: () => {
      weightBackend.weighInReadsFail = true;
    },
    settled: () => screen.findByRole("button", { name: "Try again" }),
    buttons: ["Back to More", "Try again"],
  },
  {
    name: "empty",
    prepare: () => undefined,
    settled: () => screen.findByRole("heading", { name: "No weigh-ins yet" }),
    buttons: ["Back to More"],
  },
  {
    name: "list",
    prepare: () => {
      weightBackend.weighIns = [
        weighInRow({
          localDate: toLocalDate(new Date(), "Europe/London"),
          utcTime: "07:42",
          weightKg: 81.6,
          source: "health_connect",
        }),
        weighInRow({
          localDate: addCalendarDays(toLocalDate(new Date(), "Europe/London"), -1),
          utcTime: "07:50",
          weightKg: 81.9,
        }),
      ];
    },
    settled: () => screen.findByRole("heading", { name: "Weigh-ins" }),
    buttons: ["Back to More"],
  },
];

describe("the Weight screen's controls", () => {
  beforeEach(() => {
    resetRouterMock();
    resetWeightBackend();
  });

  it.each(states)(
    "should be only $buttons in the $name state, with none of the buttons later tickets add",
    async ({ prepare, settled, buttons }) => {
      prepare();
      await renderWeightScreen();
      await settled();

      expectAccessibleNamesInOrder(screen.getAllByRole("button"), buttons);
      for (const name of ["Add weigh-in", "How the trend works", "Connect Health Connect"]) {
        expect(screen.queryByRole("button", { name })).not.toBeOnTheScreen();
        expect(screen.queryByRole("link", { name })).not.toBeOnTheScreen();
      }
    },
  );
});
