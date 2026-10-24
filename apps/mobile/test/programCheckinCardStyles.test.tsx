import "./support/gestureHandler";

import { KeyLowProvider } from "@keylow/api-client";
import { act, render, screen, within } from "@testing-library/react-native";
import { StyleSheet } from "react-native";

import { ProgramScreen } from "../components/ProgramScreen";
import { ThemeProvider } from "../lib/theme";
import { resetCheckinSeenStore, seeCheckinAsAlreadySeen } from "./support/checkinSeenStoreMock";
import { createDiaryQueryClient, resetDiaryBackend } from "./support/diaryBackend";
import { resetRouterMock } from "./support/expoRouterMock";
import { compileKitStyles } from "./support/kitStyles";
import { registerAppStyles } from "./support/nativeWindStyles";
import {
  programClient,
  resetProgramBackend,
  showFiveWeighInDaysCheckin,
  showFloorAboveExpenditureCheckin,
  showGoldenFirstCheckin,
} from "./support/programBackend";
import { resolvedColor } from "./support/themeColor";

import type { ThemeScheme } from "@keylow/tokens";

jest.mock("@react-native-async-storage/async-storage", () => ({
  __esModule: true,
  default: jest.requireActual<{ asyncStorageMock: unknown }>("./support/checkinSeenStoreMock")
    .asyncStorageMock,
}));
jest.mock(
  "expo-router",
  () => jest.requireActual<{ mockExpoRouter: unknown }>("./support/expoRouterMock").mockExpoRouter,
);
jest.mock(
  "react-native-safe-area-context",
  () =>
    jest.requireActual<{ default: unknown }>("react-native-safe-area-context/jest/mock").default,
);

// What the card draws, as the screen resolves it: the badges' tones, and each line's icon and indent.

async function renderProgramScreen(scheme: ThemeScheme = "dark") {
  await render(
    <ThemeProvider fixedPreference={scheme}>
      <KeyLowProvider client={programClient} queryClient={createDiaryQueryClient()}>
        <ProgramScreen />
      </KeyLowProvider>
    </ThemeProvider>,
  );
}

type Instance = NonNullable<ReturnType<typeof screen.getByText>>;

function isInside(node: Instance | null, ancestor: Instance): boolean {
  return node !== null && (node === ancestor || isInside(node.parent, ancestor));
}

// The glyph drawn in the row of a line: lucide names its svg after the icon, and draws it in the stroke colour.
function iconBesideText(card: Instance, text: string): { name: string; color: string } | null {
  const row = within(card).getByText(text).parent;
  const drawing =
    row === null
      ? undefined
      : screen.root?.queryAll((node) => node.type === "RNSVGSvgView" && isInside(node, row))[0];
  return drawing === undefined
    ? null
    : { name: String(drawing.props.className), color: String(drawing.props.stroke) };
}

function parentOf(node: Instance): Instance {
  if (node.parent === null) {
    throw new Error("The element has no parent");
  }
  return node.parent;
}

function styleOf(node: Instance): Record<string, unknown> {
  const style: unknown = StyleSheet.flatten(node.props.style);
  return typeof style === "object" && style !== null
    ? Object.fromEntries(Object.entries(style))
    : {};
}

describe("the check-in summary card as the screen draws it", () => {
  let kitStyles: string;

  beforeAll(async () => {
    kitStyles = await compileKitStyles("", ["components/ProgramScreen"]);
  });

  beforeEach(() => {
    registerAppStyles(kitStyles);
    resetRouterMock();
    resetDiaryBackend();
    resetProgramBackend();
    resetCheckinSeenStore();
    seeCheckinAsAlreadySeen("2026-10-09");
    jest.useFakeTimers({
      now: new Date("2026-10-09T09:00:00Z"),
      doNotFake: [
        "setTimeout",
        "clearTimeout",
        "setInterval",
        "clearInterval",
        "setImmediate",
        "clearImmediate",
        "queueMicrotask",
        "nextTick",
        "performance",
        "hrtime",
        "requestAnimationFrame",
        "cancelAnimationFrame",
        "requestIdleCallback",
        "cancelIdleCallback",
      ],
    });
  });

  afterEach(async () => {
    jest.useRealTimers();
    await act(async () => {
      await new Promise((resolve) => setTimeout(resolve, 0));
    });
  });

  it("should draw the Measured badge neutral, on the sheet surface, in the secondary text colour", async () => {
    showGoldenFirstCheckin();
    await renderProgramScreen();
    const card = await screen.findByLabelText("Last check-in, Friday 9 October, measured");
    const badge = within(card).getByText("Measured");

    expect(styleOf(badge)["color"]).toBe(resolvedColor("dark", "text-secondary"));
    expect(styleOf(parentOf(badge))["backgroundColor"]).toBe(
      resolvedColor("dark", "surface-sheet"),
    );
  });

  it("should draw the Not measured badge in the warning tone, on the warning fill", async () => {
    showFiveWeighInDaysCheckin();
    await renderProgramScreen();
    const card = await screen.findByLabelText("Last check-in, Friday 9 October, not measured");
    const badge = within(card).getByText("Not measured");

    expect(styleOf(badge)["color"]).toBe(resolvedColor("dark", "warning"));
    // The warning fill is the warning colour at 14 percent.
    expect(styleOf(parentOf(badge))["backgroundColor"]).toBe("rgba(255,159,67,0.14)");
  });

  it("should draw a check for the data line and an info mark for a guardrail, in the secondary stroke", async () => {
    showFloorAboveExpenditureCheckin();
    await renderProgramScreen();
    const card = await screen.findByLabelText("Last check-in, Friday 9 October, measured");
    const hex = (color: string) => color.toUpperCase();

    const dataLine = iconBesideText(
      card,
      "From your weight trend and the food you logged: 14 weigh-ins and 14 complete days in the last 4 weeks.",
    );
    const guardrailLine = iconBesideText(
      card,
      "Raised to 1,200 kcal, the lowest target Ki-Lo sets for you. That is more than your estimated expenditure of 1,094 kcal, so you would gain about 0.1 kg a week (0.24% of your weight), not lose it.",
    );

    expect(dataLine?.name).toContain("lucide-circle-check");
    expect(guardrailLine?.name).toContain("lucide-info");
    expect(hex(dataLine?.color ?? "")).toBe("#A9B2C3");
    expect(hex(guardrailLine?.color ?? "")).toBe("#A9B2C3");
  });

  it("should draw the alert for a reason in the warning ink, which is the warning colour in dark", async () => {
    showFiveWeighInDaysCheckin();
    await renderProgramScreen();
    const card = await screen.findByLabelText("Last check-in, Friday 9 October, not measured");

    const reason = iconBesideText(
      card,
      "You weighed in on 5 days. A check-in needs at least 8 in the last 4 weeks.",
    );

    expect(reason?.name).toContain("lucide-circle-alert");
    expect(reason?.color.toUpperCase()).toBe("#FF9F43");
  });

  it("should draw the alert for a reason in the primary text colour in light, where the warning ink is dark", async () => {
    showFiveWeighInDaysCheckin();
    await renderProgramScreen("light");
    const card = await screen.findByLabelText("Last check-in, Friday 9 October, not measured");

    const reason = iconBesideText(
      card,
      "You weighed in on 5 days. A check-in needs at least 8 in the last 4 weeks.",
    );

    expect(reason?.color.toUpperCase()).toBe("#0F131A");
  });

  it("should indent a plain line by the width of an icon, 16 points, and draw no icon", async () => {
    showFloorAboveExpenditureCheckin();
    await renderProgramScreen();
    const card = await screen.findByLabelText("Last check-in, Friday 9 October, measured");

    const advice = within(card).getByText(
      "Talk to a doctor or dietitian before you try to lose more weight.",
    );
    const [spacer] = advice.parent?.children ?? [];

    expect(
      iconBesideText(card, "Talk to a doctor or dietitian before you try to lose more weight."),
    ).toBeNull();
    expect(typeof spacer === "object" && styleOf(spacer)["width"]).toBe(16);
  });
});
