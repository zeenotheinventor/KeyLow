import { SUGGESTION_NO_GOAL } from "@keylow/core/copy";
import { cleanup, render, screen, userEvent } from "@testing-library/react-native";
import { setUpTests } from "react-native-reanimated";

import { SuggestionCard } from "../components/SuggestionCard";
import { thursdayDetail, thursdayOffer } from "../components/SuggestionCard/storyStates";
import { ThemeProvider } from "../lib/theme";
import { installVirtualClock } from "./support/virtualClock";

import type { SuggestionCardProps, SuggestionOfferState } from "../components/SuggestionCard";

jest.mock("@react-native-async-storage/async-storage", () => ({
  __esModule: true,
  default: { getItem: () => Promise.resolve(null), setItem: () => Promise.resolve() },
}));

setUpTests();

const offerState: SuggestionOfferState = { ...thursdayOffer, accept: undefined };

// The offer on the day itself, worded as core words it for today: Start in place of Add.
const startWords = {
  primaryAction: "Start",
  primaryActionName: "Start Legs with the added exercises",
};
const todayOfferState: SuggestionOfferState = {
  ...offerState,
  isForToday: true,
  detail: { ...thursdayDetail, ...startWords },
  copy: { ...thursdayOffer.copy, label: "Suggested for today", ...startWords },
};

function renderCard(props: SuggestionCardProps) {
  return render(
    <ThemeProvider fixedPreference="dark">
      <SuggestionCard {...props} />
    </ThemeProvider>,
  );
}

describe("the suggestion card", () => {
  beforeEach(() => {
    installVirtualClock();
  });

  afterEach(async () => {
    await cleanup();
    jest.useRealTimers();
  });

  describe("the offer", () => {
    it("should draw the label, the headline, the sentence and each reason in a list named for the day", async () => {
      await renderCard({ state: offerState });

      expect(screen.getByLabelText("Suggestion for Thursday")).toBeOnTheScreen();
      expect(screen.getByText("Suggested for Thursday")).toBeOnTheScreen();
      expect(screen.getByText("Legs, plus incline dumbbell press")).toBeOnTheScreen();
      expect(
        screen.getByText("Add 3 sets of incline dumbbell press to the end of Thursday's Legs."),
      ).toBeOnTheScreen();
      expect(screen.getByLabelText("Why Ki-Lo suggests this for Thursday")).toBeOnTheScreen();
      expect(screen.getAllByRole("listitem")).toHaveLength(3);
      expect(screen.getByText("Upper chest is ready now: heat 13 %")).toBeOnTheScreen();
    });

    it("should open the detail from the heading's link, named as core words it", async () => {
      const onOpenDetail = jest.fn();
      await renderCard({ state: offerState, onOpenDetail });

      await userEvent.setup().press(
        screen.getByRole("link", {
          name: "Suggested for Thursday: Legs, plus incline dumbbell press. See why",
        }),
      );

      expect(onOpenDetail).toHaveBeenCalledTimes(1);
    });

    it("should draw no link when it is given no handler to open the detail", async () => {
      await renderCard({ state: offerState });

      expect(screen.queryByRole("link")).toBeNull();
    });

    it("should draw no link when the offer holds no detail to open", async () => {
      await renderCard({
        state: { ...offerState, detail: undefined },
        onOpenDetail: jest.fn(),
      });

      expect(screen.queryByRole("link")).toBeNull();
    });

    it("should call accept when Add to Thursday is pressed", async () => {
      const accept = jest.fn();
      await renderCard({ state: { ...offerState, accept } });

      await userEvent.setup().press(screen.getByRole("button", { name: "Add to Thursday" }));

      expect(accept).toHaveBeenCalledTimes(1);
    });

    it("should not call accept while the suggestion is being added", async () => {
      const accept = jest.fn();
      await renderCard({ state: { ...offerState, accept, isAccepting: true } });

      await userEvent.setup().press(screen.getByRole("button", { busy: true }));

      expect(accept).not.toHaveBeenCalled();
    });

    it("should call onDismiss with the suggestion's day when Not now is pressed", async () => {
      const onDismiss = jest.fn();
      await renderCard({ state: offerState, onDismiss });

      await userEvent
        .setup()
        .press(screen.getByRole("button", { name: "Not now for Thursday's suggestion" }));

      expect(onDismiss).toHaveBeenCalledWith("2026-10-15");
    });

    it("should draw no Add button for today's suggestion, and keep Not now", async () => {
      await renderCard({
        state: { ...offerState, isForToday: true, accept: undefined },
        onDismiss: jest.fn(),
      });

      expect(screen.queryByRole("button", { name: "Add to Thursday" })).toBeNull();
      expect(
        screen.getByRole("button", { name: "Not now for Thursday's suggestion" }),
      ).toBeOnTheScreen();
    });

    it("should call start when Start is pressed on today's suggestion, named as core words it", async () => {
      const start = jest.fn();
      await renderCard({ state: { ...todayOfferState, start } });

      await userEvent
        .setup()
        .press(screen.getByRole("button", { name: "Start Legs with the added exercises" }));

      expect(start).toHaveBeenCalledTimes(1);
    });

    it("should show Start busy and not call start while a start is under way", async () => {
      const start = jest.fn();
      await renderCard({ state: { ...todayOfferState, start }, isStarting: true });

      await userEvent.setup().press(screen.getByRole("button", { busy: true }));

      expect(start).not.toHaveBeenCalled();
    });

    it("should leave Add to a day to come alone while a start is under way elsewhere", async () => {
      await renderCard({ state: { ...offerState, accept: jest.fn() }, isStarting: true });

      expect(screen.queryByRole("button", { busy: true })).toBeNull();
    });

    it("should draw no Not now when it is given no handler", async () => {
      await renderCard({ state: offerState });

      expect(screen.queryByRole("button", { name: /Not now/ })).toBeNull();
    });
  });

  describe("the accepted card", () => {
    it("should draw the day's new length and what now counts as planned", async () => {
      await renderCard({
        state: {
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
        },
      });

      expect(screen.getByLabelText("Thursday")).toBeOnTheScreen();
      expect(screen.getByText("Thursday's Legs: 19 sets")).toBeOnTheScreen();
      expect(
        screen.getByText("Now with 3 sets of incline dumbbell press. They count as planned."),
      ).toBeOnTheScreen();
    });
  });

  describe("the accepted card for today", () => {
    const acceptedWords = {
      cardName: "Today",
      title: "Today's Legs: 19 sets",
      detail: "Now with 3 sets of incline dumbbell press. They count as planned.",
      toast: "Added to today: 3 sets of incline dumbbell press",
      undoAction: "Undo",
      undoActionName: "Undo adding to today",
      startActionName: "Start Legs with the added exercise",
    };

    it("should draw Start, which calls start", async () => {
      const start = jest.fn();
      await renderCard({ state: { status: "accepted", copy: acceptedWords, start } });

      await userEvent
        .setup()
        .press(screen.getByRole("button", { name: "Start Legs with the added exercise" }));

      expect(start).toHaveBeenCalledTimes(1);
    });

    it("should draw no Start for a day to come", async () => {
      await renderCard({ state: { status: "accepted", copy: acceptedWords } });

      expect(screen.queryByRole("button")).toBeNull();
    });
  });

  describe("the nothing to add card", () => {
    it("should draw the title and the reason", async () => {
      await renderCard({
        state: {
          status: "nothing",
          copy: {
            cardName: "Suggestion for Thursday",
            title: "Nothing to add for Thursday",
            body: "Your plan already covers your priorities. Train as planned.",
          },
        },
      });

      expect(screen.getByLabelText("Suggestion for Thursday")).toBeOnTheScreen();
      expect(screen.getByText("Nothing to add for Thursday")).toBeOnTheScreen();
      expect(
        screen.getByText("Your plan already covers your priorities. Train as planned."),
      ).toBeOnTheScreen();
    });
  });

  describe("the no goal card", () => {
    it("should call onSetGoal when Set your goal is pressed", async () => {
      const onSetGoal = jest.fn();
      await renderCard({ state: { status: "no_goal" }, onSetGoal });

      expect(screen.getByLabelText(SUGGESTION_NO_GOAL.sectionName)).toBeOnTheScreen();
      await userEvent
        .setup()
        .press(screen.getByRole("button", { name: SUGGESTION_NO_GOAL.action }));

      expect(onSetGoal).toHaveBeenCalledTimes(1);
    });

    it("should draw no button when it is given no handler, so nothing is a dead control", async () => {
      await renderCard({ state: { status: "no_goal" } });

      expect(screen.queryByRole("button")).toBeNull();
    });
  });

  it("should draw nothing when the card is hidden", async () => {
    await renderCard({ state: { status: "hidden" } });

    expect(screen.queryByLabelText(/./)).toBeNull();
  });
});
