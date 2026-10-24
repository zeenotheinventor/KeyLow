import "./support/gestureHandler";

import { KeyLowProvider } from "@keylow/api-client";
import { act, render, screen, within } from "@testing-library/react-native";
import * as Haptics from "expo-haptics";
import { AccessibilityInfo } from "react-native";
import { getAnimatedStyle, setUpTests } from "react-native-reanimated";

import { ProgramScreen } from "../components/ProgramScreen";
import { ThemeProvider } from "../lib/theme";
import {
  animatedOpacity,
  animatedSkewXDegrees,
  animatedTranslateXPoints,
} from "./support/animatedStyle";
import {
  asyncStorageMock,
  resetCheckinSeenStore,
  seeCheckinAsAlreadySeen,
  storedCheckinDate,
} from "./support/checkinSeenStoreMock";
import { createDiaryQueryClient, resetDiaryBackend } from "./support/diaryBackend";
import { resetRouterMock } from "./support/expoRouterMock";
import {
  programClient,
  resetProgramBackend,
  showGoldenFirstCheckin,
} from "./support/programBackend";
import { resolvedColor } from "./support/themeColor";
import { ExpenditureHeroCard } from "../components/ProgramScreen/ExpenditureHeroCard";

import type { ExpenditureHeroView } from "../components/ProgramScreen";

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

setUpTests();

async function advance(milliseconds: number) {
  await act(() => {
    jest.advanceTimersByTime(milliseconds);
  });
}

function reduceMotion(isEnabled: boolean) {
  jest.spyOn(AccessibilityInfo, "isReduceMotionEnabled").mockResolvedValue(isEnabled);
}

const goldenHero: ExpenditureHeroView = {
  name: "Estimated expenditure, 2,580 kilocalories a day, likely 2,430 to 2,730 kcal",
  muKcal: 2579.54,
  rangeText: "Likely 2,430 to 2,730 kcal",
  captionText: "From your weigh-ins and food log, updated Friday 9 October",
  isSettling: false,
};

describe("the expenditure numeral when a check-in has just arrived", () => {
  beforeEach(() => {
    jest.useFakeTimers();
  });

  afterEach(() => {
    jest.useRealTimers();
    jest.restoreAllMocks();
  });

  async function renderHero(arrival: { fromKcal: number } | null, isReducedMotion: boolean) {
    reduceMotion(isReducedMotion);
    await render(
      <ThemeProvider fixedPreference="dark">
        <ExpenditureHeroCard arrival={arrival} view={goldenHero} />
      </ThemeProvider>,
    );

    // The numeral is the same element all the way to its target, whatever it shows first.
    return within(screen.getByLabelText(goldenHero.name));
  }

  it("should start at the previous estimate, 2,574, and count up to 2,580", async () => {
    const hero = await renderHero({ fromKcal: 2574.22 }, false);
    expect(hero.getByText("2,574")).toBeOnTheScreen();

    await advance(900);

    expect(await screen.findByText("2,580")).toBeOnTheScreen();
    expect(screen.queryByText("2,574")).not.toBeOnTheScreen();
  });

  it("should hold the accent for the first 200 ms, while the count runs", async () => {
    const numeral = (await renderHero({ fromKcal: 2574.22 }, false)).getByText("2,574");

    await advance(150);

    expect(getAnimatedStyle(numeral)).toMatchObject({ color: resolvedColor("dark", "accent") });
  });

  it("should be back to the primary text colour once the flash has run", async () => {
    const numeral = (await renderHero({ fromKcal: 2574.22 }, false)).getByText("2,574");

    await advance(200 + 600 + 50);

    expect(getAnimatedStyle(numeral)).toMatchObject({
      color: resolvedColor("dark", "text-primary"),
    });
  });

  it("should show 2,580 at once and never flash with reduced motion", async () => {
    const hero = await renderHero({ fromKcal: 2574.22 }, true);
    // At once: no time has passed since it was drawn.
    const numeral = hero.getByText("2,580");

    for (const milliseconds of [0, 150, 250, 600]) {
      await advance(milliseconds);

      expect(screen.getByText("2,580")).toBeOnTheScreen();
      expect(getAnimatedStyle(numeral)).toMatchObject({
        color: resolvedColor("dark", "text-primary"),
      });
    }
  });

  it("should show 2,580 and no flash when no check-in has just arrived", async () => {
    await renderHero(null, false);

    await advance(150);

    expect(screen.getByText("2,580")).toBeOnTheScreen();
    expect(screen.queryByText("2,574")).not.toBeOnTheScreen();
  });
});

describe("the Programme screen on the first open after a new check-in", () => {
  beforeEach(() => {
    resetRouterMock();
    resetDiaryBackend();
    resetProgramBackend();
    resetCheckinSeenStore();
    jest.mocked(Haptics.impactAsync).mockClear();
    jest.useFakeTimers({ now: new Date("2026-10-09T09:00:00Z") });
    showGoldenFirstCheckin();
  });

  afterEach(() => {
    jest.useRealTimers();
    jest.restoreAllMocks();
  });

  async function renderProgramScreen() {
    return render(
      <ThemeProvider fixedPreference="dark">
        <KeyLowProvider client={programClient} queryClient={createDiaryQueryClient()}>
          <ProgramScreen />
        </KeyLowProvider>
      </ThemeProvider>,
    );
  }

  const cardName = "Last check-in, Friday 9 October, measured";

  it("should count the hero up from the previous estimate, 2,500 to 2,560", async () => {
    reduceMotion(false);
    await renderProgramScreen();
    const hero = await screen.findByLabelText(/^Estimated expenditure, /);

    expect(within(hero).queryByText("2,560")).not.toBeOnTheScreen();
    await advance(900);
    expect(within(hero).getByText("2,560")).toBeOnTheScreen();
  });

  it("should cut the card in from the side, and settle it on its place", async () => {
    reduceMotion(false);
    await renderProgramScreen();
    const card = await screen.findByLabelText(cardName);

    // The card is found a moment after it is mounted, which is part way through the cut-in.
    expect(animatedTranslateXPoints(card)).not.toBe(0);
    await advance(400);
    expect(getAnimatedStyle(card)).toMatchObject({
      opacity: 1,
      transform: [{ translateX: 0 }, { skewX: "0deg" }],
    });
    expect(animatedSkewXDegrees(card)).toBe(0);
  });

  it("should count the hero up on a second open with the programme already held, the store being read after it", async () => {
    reduceMotion(false);
    const queryClient = createDiaryQueryClient();
    const open = () => (
      <ThemeProvider fixedPreference="dark">
        <KeyLowProvider client={programClient} queryClient={queryClient}>
          <ProgramScreen />
        </KeyLowProvider>
      </ThemeProvider>
    );
    seeCheckinAsAlreadySeen("2026-10-09");
    const first = await render(open());
    await screen.findByLabelText(cardName);
    await advance(900);
    await first.unmount();
    // The device has not seen this check-in, and the programme is in the query cache when the screen opens.
    resetCheckinSeenStore();

    await render(open());
    const hero = await screen.findByLabelText(/^Estimated expenditure, /);

    expect(within(hero).getByText("2,500")).toBeOnTheScreen();
    // The first frame tells the count its target, and the count then runs in the frames after it.
    await advance(20);
    await advance(900);
    expect(within(hero).getByText("2,560")).toBeOnTheScreen();
    expect(storedCheckinDate()).toBe("2026-10-09");
  });

  it("should show the hero and the card with no motion, and no skeleton, when the device's store cannot be read", async () => {
    reduceMotion(false);
    asyncStorageMock.getItem.mockRejectedValueOnce(new Error("unreadable"));
    await renderProgramScreen();
    const card = await screen.findByLabelText(cardName);
    const hero = screen.getByLabelText(/^Estimated expenditure, /);

    expect(screen.queryByRole("status", { name: "Loading your programme" })).not.toBeOnTheScreen();
    expect(within(hero).getByText("2,560")).toBeOnTheScreen();
    expect(animatedOpacity(card)).toBe(1);
    expect(getAnimatedStyle(card)).toMatchObject({ transform: [] });
    await advance(100);
    expect(Haptics.impactAsync).not.toHaveBeenCalled();
    expect(asyncStorageMock.setItem).not.toHaveBeenCalled();
  });

  it("should only fade the card with reduced motion", async () => {
    reduceMotion(true);
    await renderProgramScreen();
    const card = await screen.findByLabelText(cardName);
    await advance(400);

    expect(getAnimatedStyle(card)).toMatchObject({ opacity: 1, transform: [] });
  });

  it("should play the complete haptic, two heavy impacts, and remember the check-in's date", async () => {
    reduceMotion(false);
    await renderProgramScreen();
    await screen.findByLabelText(cardName);
    await advance(100);

    expect(Haptics.impactAsync).toHaveBeenCalledTimes(2);
    expect(Haptics.impactAsync).toHaveBeenCalledWith(Haptics.ImpactFeedbackStyle.Heavy);
    expect(storedCheckinDate()).toBe("2026-10-09");
  });

  it("should do none of it on the next open: the hero is at its figure, the card is drawn and no haptic plays", async () => {
    seeCheckinAsAlreadySeen("2026-10-09");
    reduceMotion(false);
    await renderProgramScreen();
    const card = await screen.findByLabelText(cardName);
    const hero = screen.getByLabelText(/^Estimated expenditure, /);
    await advance(100);

    expect(within(hero).getByText("2,560")).toBeOnTheScreen();
    expect(animatedOpacity(card)).toBe(1);
    expect(getAnimatedStyle(card)).toMatchObject({ transform: [] });
    expect(Haptics.impactAsync).not.toHaveBeenCalled();
  });

  it("should do none of it a second time in the same run, after the screen is closed and opened again", async () => {
    reduceMotion(false);
    const first = await renderProgramScreen();
    await screen.findByLabelText(cardName);
    await advance(900);
    await first.unmount();
    jest.mocked(Haptics.impactAsync).mockClear();

    await renderProgramScreen();
    await screen.findByLabelText(cardName);
    const hero = screen.getByLabelText(/^Estimated expenditure, /);
    await advance(100);

    expect(within(hero).getByText("2,560")).toBeOnTheScreen();
    expect(Haptics.impactAsync).not.toHaveBeenCalled();
  });
});
