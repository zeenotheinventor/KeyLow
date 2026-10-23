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

// The controls the boards draw on this screen that open screens later tickets build are not drawn yet.

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
    buttons: ["Back to More", "How the trend works", "Add weigh-in"],
  },
  {
    name: "error",
    prepare: () => {
      weightBackend.weighInReadsFail = true;
    },
    settled: () => screen.findByRole("button", { name: "Try again" }),
    buttons: ["Back to More", "How the trend works", "Add weigh-in", "Try again"],
  },
  {
    name: "empty",
    prepare: () => undefined,
    settled: () => screen.findByRole("heading", { name: "No weigh-ins yet" }),
    buttons: ["Back to More", "How the trend works", "Add weigh-in", "Add weigh-in"],
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
    // Each row opens its weigh-in in the sheet. The times are the London clock of the day, so they are not fixed.
    buttons: [
      "Back to More",
      "How the trend works",
      "Add weigh-in",
      /^Today, \d\d:\d\d · Health Connect, 81\.6 kg$/,
      /^Yesterday, \d\d:\d\d · Added by you, 81\.9 kg$/,
    ],
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
      for (const name of ["Connect Health Connect"]) {
        expect(screen.queryByRole("button", { name })).not.toBeOnTheScreen();
        expect(screen.queryByRole("link", { name })).not.toBeOnTheScreen();
      }
    },
  );
});
