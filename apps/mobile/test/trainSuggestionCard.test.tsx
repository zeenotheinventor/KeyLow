import { KeyLowProvider } from "@keylow/api-client";
import { SUGGESTION_NO_GOAL, TRAIN_TODAY_CARD } from "@keylow/core/copy";
import { onlineManager } from "@tanstack/react-query";
import { act, cleanup, render, screen, userEvent, waitFor } from "@testing-library/react-native";
import { setUpTests } from "react-native-reanimated";

import { TrainScreen } from "../components/TrainScreen";
import { TrainSuggestionCard } from "../components/TrainScreen/TrainSuggestionCard";
import { suggestionDismissedStorageKey } from "../lib/suggestionDismissed";
import { ThemeProvider } from "../lib/theme";
import { createDiaryQueryClient } from "./support/diaryBackend";
import { resetTrainBackend, trainBackend, trainClient } from "./support/trainBackend";
import { goldenRoutine, mondayPush, tuesdayPull } from "./support/trainGoldenWeek";
import { installVirtualClock } from "./support/virtualClock";

import type { TrainScreenProps } from "../components/TrainScreen";
import type { SuggestionCardState, TrainHome, UseSuggestionCardInput } from "@keylow/api-client";
import type { QueryClient } from "@tanstack/react-query";

const mockStored = new Map<string, string>();
jest.mock("@react-native-async-storage/async-storage", () => ({
  __esModule: true,
  default: {
    getItem: (key: string) => Promise.resolve(mockStored.get(key) ?? null),
    setItem: (key: string, value: string) => {
      mockStored.set(key, value);
      return Promise.resolve();
    },
  },
}));
jest.mock(
  "react-native-safe-area-context",
  () =>
    jest.requireActual<{ default: unknown }>("react-native-safe-area-context/jest/mock").default,
);

// The shared hook is tested in api-client. Here it is the state the screen is given, and what it was asked.
let mockCardState: SuggestionCardState = { status: "hidden" };
const mockCardInputs: UseSuggestionCardInput[] = [];
jest.mock("@keylow/api-client", () => ({
  ...jest.requireActual<object>("@keylow/api-client"),
  useSuggestionCard: (input: UseSuggestionCardInput) => {
    mockCardInputs.push(input);
    return mockCardState;
  },
}));

// Whether the account has accepted the current Terms, which the screen's reads wait for.
let mockReadsEnabled = true;
jest.mock("../lib/useReadsEnabled", () => ({ useReadsEnabled: () => mockReadsEnabled }));

// Wednesday 14 October 2026 at 12:00 in London, a rest day before Thursday's Legs.
jest.mock("../lib/useNow", () => ({ useNow: () => new Date("2026-10-14T11:00:00Z") }));

setUpTests();

const accept = jest.fn();
const offer: SuggestionCardState = {
  status: "offer",
  day: "2026-10-15",
  isForToday: false,
  isAccepting: false,
  accept,
  copy: {
    cardName: "Suggestion for Thursday",
    label: "Suggested for Thursday",
    headline: "Legs, plus incline dumbbell press",
    linkName: "Suggested for Thursday: Legs, plus incline dumbbell press. See why",
    sentence: "Add 3 sets of incline dumbbell press to the end of Thursday's Legs.",
    reasonsName: "Why Ki-Lo suggests this for Thursday",
    reasons: [{ kind: "length", text: "Thursday goes from 16 to 19 sets, about 60 minutes" }],
    primaryAction: "Add to Thursday",
    primaryActionName: "Add to Thursday",
    dismissAction: "Not now",
    dismissActionName: "Not now for Thursday's suggestion",
  },
};

const notices = { onAccepted: jest.fn(), onFailure: jest.fn() };

let queryClient: QueryClient;

async function renderTrain(props: TrainScreenProps = { suggestionNotices: notices }) {
  queryClient = createDiaryQueryClient();
  await render(
    <ThemeProvider fixedPreference="dark">
      <KeyLowProvider client={trainClient} queryClient={queryClient}>
        <TrainScreen {...props} />
      </KeyLowProvider>
    </ThemeProvider>,
  );
}

const readyHome: Extract<TrainHome, { status: "ready" }> = {
  status: "ready",
  hasRoutine: true,
  routineId: null,
  hasLoggedSession: true,
  today: null,
  week: null,
  routineDays: [],
  timeZone: "Europe/London",
  savedAt: new Date("2026-10-14T11:00:00Z"),
};

describe("what the card on the Train home gives the shared hook", () => {
  beforeEach(() => {
    mockCardInputs.length = 0;
    mockReadsEnabled = true;
    mockCardState = { status: "hidden" };
  });

  afterEach(async () => {
    await cleanup();
    await act(() => {
      onlineManager.setOnline(true);
    });
  });

  const renderCard = () =>
    render(
      <ThemeProvider fixedPreference="dark">
        <TrainSuggestionCard home={readyHome} notices={notices} />
      </ThemeProvider>,
    );

  it("should leave the reads off while the account has not accepted the Terms", async () => {
    mockReadsEnabled = false;
    await renderCard();

    expect(mockCardInputs.at(-1)?.enabled).toBe(false);
  });

  it("should let the reads run once the Terms are accepted", async () => {
    await renderCard();

    expect(mockCardInputs.at(-1)?.enabled).toBe(true);
  });

  it("should tell the hook the phone is offline when it is", async () => {
    await act(() => {
      onlineManager.setOnline(false);
    });
    await renderCard();

    expect(mockCardInputs.at(-1)?.isOnline).toBe(false);
  });

  it("should tell the hook the phone is online when it is", async () => {
    await renderCard();

    expect(mockCardInputs.at(-1)?.isOnline).toBe(true);
  });
});

describe("the suggestion card on the Train home", () => {
  beforeEach(() => {
    installVirtualClock({ now: new Date("2026-10-14T11:00:00Z") });
    resetTrainBackend();
    trainBackend.routine = goldenRoutine;
    trainBackend.weekSessions = [mondayPush, tuesdayPull];
    mockStored.clear();
    mockCardInputs.length = 0;
    mockReadsEnabled = true;
    mockCardState = offer;
    accept.mockClear();
    notices.onAccepted.mockClear();
    notices.onFailure.mockClear();
  });

  afterEach(async () => {
    await cleanup();
    jest.useRealTimers();
    queryClient.clear();
  });

  it("should sit under the rest day card and above the body map, as the boards compose it", async () => {
    await renderTrain();
    await screen.findByRole("button", { name: "Show projected" });

    // The body map card has no name of its own, so its view button stands for it. Order is the tree's.
    const tree = JSON.stringify(screen.toJSON());
    const positionOf = (text: string) => tree.indexOf(text);
    expect(positionOf("Today")).toBeGreaterThan(-1);
    expect(positionOf("Suggestion for Thursday")).toBeGreaterThan(
      positionOf('"aria-label":"Today"'),
    );
    expect(positionOf("Show projected")).toBeGreaterThan(positionOf("Suggestion for Thursday"));
  });

  it("should draw no card when the screen is given no notices, so Add can never be a dead control", async () => {
    await renderTrain({});
    await screen.findByRole("heading", { name: TRAIN_TODAY_CARD.restTitle });

    expect(screen.queryByLabelText("Suggestion for Thursday")).not.toBeOnTheScreen();
  });

  it("should ask the shared hook for the home it is on and give it the notices", async () => {
    await renderTrain();
    await screen.findByLabelText("Suggestion for Thursday");

    const asked = mockCardInputs.at(-1);
    expect(asked?.home.status).toBe("ready");
    expect(asked?.notices).toBe(notices);
    expect(asked?.isOnline).toBe(true);
  });

  it("should give the hook the time the clock shows", async () => {
    await renderTrain();
    await screen.findByLabelText("Suggestion for Thursday");

    expect(mockCardInputs.at(-1)?.now.toISOString()).toBe("2026-10-14T11:00:00.000Z");
  });

  it("should add the suggestion when Add to Thursday is pressed", async () => {
    await renderTrain();

    await userEvent.setup().press(await screen.findByRole("button", { name: "Add to Thursday" }));

    expect(accept).toHaveBeenCalledTimes(1);
  });

  it("should store the day and give it back to the hook when Not now is pressed", async () => {
    await renderTrain();

    await userEvent
      .setup()
      .press(await screen.findByRole("button", { name: "Not now for Thursday's suggestion" }));

    await waitFor(() => {
      expect(mockCardInputs.at(-1)?.dismissedDays).toEqual(["2026-10-15"]);
    });
    expect(mockStored.get(suggestionDismissedStorageKey)).toBe(JSON.stringify(["2026-10-15"]));
  });

  it("should hand the hook the days a past visit put off", async () => {
    mockStored.set(suggestionDismissedStorageKey, JSON.stringify(["2026-10-15"]));
    await renderTrain();

    await waitFor(() => {
      expect(mockCardInputs.at(-1)?.dismissedDays).toEqual(["2026-10-15"]);
    });
  });

  it("should open the goal questionnaire from the no goal card with the screen's onSetGoal", async () => {
    mockCardState = { status: "no_goal" };
    const onSetGoal = jest.fn();
    await renderTrain({ suggestionNotices: notices, onSetGoal });

    await userEvent
      .setup()
      .press(await screen.findByRole("button", { name: SUGGESTION_NO_GOAL.action }));

    expect(onSetGoal).toHaveBeenCalledTimes(1);
  });
});
