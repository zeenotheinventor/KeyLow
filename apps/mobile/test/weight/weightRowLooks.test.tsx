import "../support/gestureHandler";

import { KeyLowProvider } from "@keylow/api-client";
import { addCalendarDays, toLocalDate } from "@keylow/core/dates";
import { themes } from "@keylow/tokens";
import { render, screen } from "@testing-library/react-native";

import { Icon } from "../../components/ui";
import { WeightScreen } from "../../components/WeightScreen";
import { ThemeProvider } from "../../lib/theme";
import { resetRouterMock } from "../support/expoRouterMock";
import { compileKitStyles } from "../support/kitStyles";
import { registerAppStyles } from "../support/nativeWindStyles";
import { resolvedColor } from "../support/themeColor";
import { viewsDrawn } from "../support/viewsDrawn";
import {
  createWeightQueryClient,
  resetWeightBackend,
  weightBackend,
  weightClient,
  weighInRow,
} from "../support/weightBackend";

import type { IconName } from "../../components/ui";

// What a row of the list draws for its source and for a reading the trend left out.

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

type Instance = NonNullable<ReturnType<typeof screen.getByRole>>;

function isInside(node: Instance | null, ancestor: Instance): boolean {
  return node !== null && (node === ancestor || isInside(node.parent, ancestor));
}

// The drawing of an icon is its paths, so two icons are the same when their path data is.
function pathDataIn(container: Instance | null): string[] {
  return (
    screen.root
      ?.queryAll(
        (node) => node.type === "RNSVGPath" && (container === null || isInside(node, container)),
      )
      .map((node) => String(node.props.d)) ?? []
  );
}

async function pathDataOf(name: IconName): Promise<string[]> {
  await render(
    <ThemeProvider fixedPreference="dark">
      <Icon name={name} />
    </ThemeProvider>,
  );
  const paths = pathDataIn(null);
  await screen.unmount();

  return paths;
}

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

describe("a row of the Weight list", () => {
  let kitStyles: string;

  beforeAll(async () => {
    kitStyles = await compileKitStyles();
  });

  beforeEach(() => {
    resetRouterMock();
    resetWeightBackend();
    registerAppStyles(kitStyles);
  });

  it("should draw a heart for a Health Connect reading and a pencil for a manual one", async () => {
    const heart = await pathDataOf("Heart");
    const pencil = await pathDataOf("Pencil");
    weightBackend.weighIns = [
      weighInRow({
        localDate: today(),
        utcTime: "07:42",
        weightKg: 81.6,
        source: "health_connect",
        timeZone: "UTC",
      }),
      weighInRow({
        localDate: addCalendarDays(today(), -1),
        utcTime: "07:50",
        weightKg: 81.9,
        timeZone: "UTC",
      }),
    ];
    await renderWeightScreen();

    const imported = await screen.findByLabelText(/^Today, 07:42 · Health Connect/);
    const manual = screen.getByLabelText(/^Yesterday, 07:50 · Added by you/);

    expect(heart).not.toEqual(pencil);
    expect(pathDataIn(imported)).toEqual(heart);
    expect(pathDataIn(manual)).toEqual(pencil);
  });

  it("should draw the left-out badge in the warning tone and mute only that reading's weight", async () => {
    const days = Array.from({ length: 10 }, (_, index) => addCalendarDays("2026-10-09", -index));
    weightBackend.weighIns = [
      weighInRow({ localDate: today(), utcTime: "07:42", weightKg: 82, timeZone: "UTC" }),
      weighInRow({
        localDate: addCalendarDays(today(), -1),
        utcTime: "07:50",
        weightKg: 82,
        timeZone: "UTC",
      }),
      weighInRow({ localDate: "2026-10-10", utcTime: "08:00", weightKg: 99, timeZone: "UTC" }),
      ...days.map((localDate) =>
        weighInRow({ localDate, utcTime: "07:30", weightKg: 82, timeZone: "UTC" }),
      ),
    ];
    await renderWeightScreen();

    const row = await screen.findByLabelText(/Left out of trend, 99.0 kg$/);

    expect(screen.getAllByText("Left out of trend")).toHaveLength(1);
    expect(
      viewsDrawn({ height: 20, backgroundColor: themes.dark["warning-muted"] }).filter((node) =>
        isInside(node, row),
      ),
    ).toHaveLength(1);
    expect(screen.getByText("99.0 kg")).toHaveStyle({
      color: resolvedColor("dark", "text-muted"),
    });
    expect(screen.getAllByText("82.0 kg")[0]).toHaveStyle({
      color: resolvedColor("dark", "text-primary"),
    });
  });
});
