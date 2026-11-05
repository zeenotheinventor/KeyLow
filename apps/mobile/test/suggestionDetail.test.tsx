import { KeyLowProvider } from "@keylow/api-client";
import { onlineManager } from "@tanstack/react-query";
import {
  act,
  cleanup,
  render,
  screen,
  userEvent,
  waitFor,
  within,
} from "@testing-library/react-native";
import { setUpTests } from "react-native-reanimated";

import {
  longThursdayDetail,
  thursdayDetail,
  thursdayOffer,
} from "../components/SuggestionCard/storyStates";
import { TrainScreen } from "../components/TrainScreen";
import { suggestionDismissedStorageKey } from "../lib/suggestionDismissed";
import { ThemeProvider } from "../lib/theme";
import { createDiaryQueryClient } from "./support/diaryBackend";
import { resetTrainBackend, trainBackend, trainClient } from "./support/trainBackend";
import { goldenRoutine, mondayPush, tuesdayPull } from "./support/trainGoldenWeek";
import { installVirtualClock } from "./support/virtualClock";

import type { SuggestionOfferState } from "../components/SuggestionCard";
import type { SuggestionCardState, UseSuggestionCardInput } from "@keylow/api-client";
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
// Jest does not turn the library's scroll handlers into worklets, so its scroll view cannot render here. The
// plain scroll view stands in for it, as the other sheets' tests have it. The sheet still mounts, opens and closes.
jest.mock("@gorhom/bottom-sheet", () =>
  jest
    .requireActual<{ mockBottomSheet: () => unknown }>("./support/sheetScrollViewMock")
    .mockBottomSheet(),
);

// The shared hook is tested in api-client, with the suggestion, the routine and the writes behind it. Here it is
// the state the screen is given. Offline it gives nothing, as the hook does, so going offline takes the offer away.
let mockCardState: SuggestionCardState = { status: "hidden" };
jest.mock("@keylow/api-client", () => ({
  ...jest.requireActual<object>("@keylow/api-client"),
  useSuggestionCard: (input: UseSuggestionCardInput): SuggestionCardState =>
    input.isOnline ? mockCardState : { status: "hidden" },
}));

jest.mock("../lib/useReadsEnabled", () => ({ useReadsEnabled: () => true }));

// Wednesday 14 October 2026 at 12:00 in London, a rest day before Thursday's Legs.
jest.mock("../lib/useNow", () => ({ useNow: () => new Date("2026-10-14T11:00:00Z") }));

setUpTests();

const accept = jest.fn();
const notices = { onAccepted: jest.fn(), onFailure: jest.fn(), onStart: jest.fn() };
const offer: SuggestionOfferState = { ...thursdayOffer, accept };

let queryClient: QueryClient;

async function renderTrain() {
  queryClient = createDiaryQueryClient();
  await render(
    <ThemeProvider fixedPreference="dark">
      <KeyLowProvider client={trainClient} queryClient={queryClient}>
        <TrainScreen suggestionNotices={notices} />
      </KeyLowProvider>
    </ThemeProvider>,
  );
}

const linkName = thursdayOffer.copy.linkName;
const openLink = () => screen.findByRole("link", { name: linkName });

// The kit's sheet draws its dialog without marking it accessible, so a role query cannot find it. It is found by
// its name, to scope the role queries inside it.
const findTheSheet = () => screen.findByLabelText(thursdayDetail.title);
const queryTheSheet = () => screen.queryByLabelText(thursdayDetail.title);

async function openDetail() {
  await renderTrain();
  await userEvent.setup().press(await openLink());
  return findTheSheet();
}

/** Lets the sheet's exit run its length, after which it leaves nothing behind. */
const afterTheSheetHasClosed = async () => {
  await act(() => jest.advanceTimersByTimeAsync(1000));
};

describe("the suggestion detail sheet on the Train home", () => {
  beforeEach(() => {
    installVirtualClock({ now: new Date("2026-10-14T11:00:00Z") });
    resetTrainBackend();
    trainBackend.routine = goldenRoutine;
    trainBackend.weekSessions = [mondayPush, tuesdayPull];
    mockStored.clear();
    mockCardState = offer;
    accept.mockClear();
  });

  afterEach(async () => {
    await cleanup();
    jest.useRealTimers();
    queryClient.clear();
    await act(() => {
      onlineManager.setOnline(true);
    });
  });

  describe("what opens it", () => {
    it("should stay closed until the card's link is pressed", async () => {
      await renderTrain();
      await openLink();

      expect(queryTheSheet()).toBeNull();
    });

    it("should open on the link in the card's heading, named as core words it", async () => {
      const dialog = await openDetail();

      expect(dialog).toBeOnTheScreen();
    });

    it.each([
      ["accepted", { status: "accepted" }],
      ["nothing", { status: "nothing" }],
      ["no goal", { status: "no_goal" }],
    ] as const)("should draw no link to open on the %s card", async (_name, state) => {
      mockCardState =
        state.status === "accepted"
          ? {
              status: "accepted",
              copy: {
                cardName: "Thursday",
                title: "Thursday's Legs: 19 sets",
                detail: "Now with 3 sets of incline dumbbell press. They count as planned.",
                toast: "Added to Thursday: 3 sets of incline dumbbell press",
                undoAction: "Undo",
                undoActionName: "Undo adding to Thursday",
                startActionName: "Start Legs with the added exercise",
              },
            }
          : state.status === "nothing"
            ? {
                status: "nothing",
                copy: {
                  cardName: "Suggestion for Thursday",
                  title: "Nothing to add for Thursday",
                  body: "Your plan already covers your priorities. Train as planned.",
                },
              }
            : state;
      await renderTrain();
      await screen.findByRole("heading", { name: "Rest day" });

      expect(screen.queryByRole("link")).toBeNull();
    });

    it("should draw no link while the offer has no detail to show", async () => {
      mockCardState = { ...offer, detail: undefined };
      await renderTrain();
      await screen.findByLabelText("Suggestion for Thursday");

      expect(screen.queryByRole("link")).toBeNull();
    });
  });

  describe("what it shows", () => {
    it("should show the day, the headline and the length the card's suggestion holds", async () => {
      const dialog = await openDetail();

      expect(within(dialog).getByText(thursdayDetail.dayLine)).toBeOnTheScreen();
      expect(
        within(dialog).getByRole("heading", { name: thursdayDetail.headline }),
      ).toBeOnTheScreen();
      expect(within(dialog).getByText("6 exercises · 19 sets · about 60 min")).toBeOnTheScreen();
    });

    it("should list six exercises, five marked from the plan and the incline press with its reason", async () => {
      const dialog = await openDetail();

      const rows = within(within(dialog).getByLabelText("Exercises for Thursday")).getAllByRole(
        "listitem",
      );
      expect(rows).toHaveLength(6);
      expect(within(dialog).getAllByText("From your plan")).toHaveLength(5);
      expect(
        within(dialog).getByText(/^Added\. Upper chest is a V-taper priority/),
      ).toBeOnTheScreen();
      expect(within(dialog).getByText("3 × 5 to 8 · RIR 2")).toBeOnTheScreen();
    });

    it("should list an exercise twice when the day holds it twice, with no key clash", async () => {
      const [first] = thursdayDetail.rows;
      if (first === undefined) {
        throw new Error("The detail has no rows");
      }
      mockCardState = { ...offer, detail: { ...thursdayDetail, rows: [first, first] } };
      const errors = jest.spyOn(console, "error").mockImplementation(() => undefined);
      const dialog = await openDetail();

      const rows = within(within(dialog).getByLabelText("Exercises for Thursday")).getAllByRole(
        "listitem",
      );
      expect(rows).toHaveLength(2);
      expect(errors).not.toHaveBeenCalled();
      errors.mockRestore();
    });

    it("should say Ki-Lo keeps the plan under the list", async () => {
      const dialog = await openDetail();

      expect(within(dialog).getByText(thursdayDetail.footnote)).toBeOnTheScreen();
    });

    it("should hold every row in the sheet's one scroll view, with the buttons outside it", async () => {
      mockCardState = { ...offer, detail: longThursdayDetail };
      const dialog = await openDetail();

      const scrollViews = dialog.queryAll((node) => node.type === "RCTScrollView");
      expect(scrollViews).toHaveLength(1);
      const [scrollView] = scrollViews;
      if (scrollView === undefined) {
        throw new Error("The sheet has no scroll view");
      }
      expect(within(scrollView).getAllByRole("listitem")).toHaveLength(14);
      expect(within(scrollView).queryByRole("button", { name: "Add to Thursday" })).toBeNull();
      expect(within(dialog).getByRole("button", { name: "Add to Thursday" })).toBeOnTheScreen();
    });
  });

  describe("what closes it", () => {
    it("should close on Back to Train, and leave nothing behind", async () => {
      const dialog = await openDetail();

      await userEvent.setup().press(within(dialog).getByRole("button", { name: "Back to Train" }));
      await afterTheSheetHasClosed();

      expect(queryTheSheet()).toBeNull();
      expect(accept).not.toHaveBeenCalled();
    });

    it("should add the suggestion once and close on Add to Thursday", async () => {
      const dialog = await openDetail();

      await userEvent
        .setup()
        .press(within(dialog).getByRole("button", { name: "Add to Thursday" }));
      await afterTheSheetHasClosed();

      expect(accept).toHaveBeenCalledTimes(1);
      expect(queryTheSheet()).toBeNull();
    });

    it("should put the day off on this device and close on Not now", async () => {
      const dialog = await openDetail();

      await userEvent
        .setup()
        .press(within(dialog).getByRole("button", { name: "Not now for Thursday's suggestion" }));
      await afterTheSheetHasClosed();

      await waitFor(() => {
        expect(mockStored.get(suggestionDismissedStorageKey)).toBe(JSON.stringify(["2026-10-15"]));
      });
      expect(accept).not.toHaveBeenCalled();
      expect(queryTheSheet()).toBeNull();
    });

    it("should start today's suggestion once and close on Start, named as core words it", async () => {
      const start = jest.fn();
      mockCardState = {
        ...offer,
        isForToday: true,
        accept: undefined,
        start,
        detail: {
          ...thursdayDetail,
          primaryAction: "Start",
          primaryActionName: "Start Legs with the added exercises",
        },
      };
      const dialog = await openDetail();

      await userEvent
        .setup()
        .press(within(dialog).getByRole("button", { name: "Start Legs with the added exercises" }));
      await afterTheSheetHasClosed();

      expect(start).toHaveBeenCalledTimes(1);
      expect(accept).not.toHaveBeenCalled();
      expect(queryTheSheet()).toBeNull();
    });

    it("should draw no Add for a suggestion for today, and keep Not now", async () => {
      mockCardState = { ...offer, isForToday: true, accept: undefined };
      const dialog = await openDetail();

      expect(within(dialog).queryByRole("button", { name: "Add to Thursday" })).toBeNull();
      expect(
        within(dialog).getByRole("button", { name: "Not now for Thursday's suggestion" }),
      ).toBeOnTheScreen();
    });
  });

  describe("when the offer goes while it is open", () => {
    it("should close when the phone goes offline, and not open again when it is back", async () => {
      await openDetail();

      await act(() => {
        onlineManager.setOnline(false);
      });
      await afterTheSheetHasClosed();
      expect(queryTheSheet()).toBeNull();
      expect(accept).not.toHaveBeenCalled();

      await act(() => {
        onlineManager.setOnline(true);
      });
      await afterTheSheetHasClosed();
      expect(await openLink()).toBeOnTheScreen();
      expect(queryTheSheet()).toBeNull();
    });

    it("should close when the offer is for another day, and not open on it", async () => {
      await openDetail();

      mockCardState = { ...offer, day: "2026-10-16" };
      await act(() => {
        onlineManager.setOnline(false);
        onlineManager.setOnline(true);
      });
      await afterTheSheetHasClosed();

      expect(queryTheSheet()).toBeNull();
      expect(await openLink()).toBeOnTheScreen();
    });

    it("should close when the day is added from elsewhere, and not open again when the offer returns", async () => {
      await openDetail();

      mockCardState = {
        status: "accepted",
        copy: {
          cardName: "Thursday",
          title: "Thursday's Legs: 19 sets",
          detail: "Now with 3 sets of incline dumbbell press. They count as planned.",
          toast: "Added to Thursday: 3 sets of incline dumbbell press",
          undoAction: "Undo",
          undoActionName: "Undo adding to Thursday",
          startActionName: "Start Legs with the added exercise",
        },
      };
      await act(() => {
        onlineManager.setOnline(false);
        onlineManager.setOnline(true);
      });
      await afterTheSheetHasClosed();
      expect(queryTheSheet()).toBeNull();

      mockCardState = offer;
      await act(() => {
        onlineManager.setOnline(false);
        onlineManager.setOnline(true);
      });
      await afterTheSheetHasClosed();
      expect(await openLink()).toBeOnTheScreen();
      expect(queryTheSheet()).toBeNull();
    });
  });
});
