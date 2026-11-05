import { existsSync } from "node:fs";
import { join } from "node:path";

import { act, cleanup, render, screen, userEvent } from "@testing-library/react-native";
import { ExpoRoot, router, Slot } from "expo-router";
import { getMockContext } from "expo-router/testing-library";
import { Text } from "react-native";

import GoalIndex from "../../app/goal";
import GoalStepRoute from "../../app/goal/[step]";
import GoalLayout from "../../app/goal/_layout";
import { goalPath, goalQuestionPath } from "../../lib/goalRoutes";
import { ThemeProvider } from "../../lib/theme";
import { compileKitStyles } from "../support/kitStyles";
import { registerAppStyles } from "../support/nativeWindStyles";
import { pressTwiceInTheSameMoment } from "../support/sameTickPress";
import {
  resetTrainingGoalsRead,
  storedGoalRow,
  trainingGoalsRead,
} from "../support/trainingGoalsRead";
import { installVirtualClock } from "../support/virtualClock";

jest.mock("@react-native-async-storage/async-storage", () => ({
  __esModule: true,
  default: { getItem: () => Promise.resolve(null), setItem: () => Promise.resolve() },
}));
jest.mock(
  "react-native-safe-area-context",
  () =>
    jest.requireActual<{ default: unknown }>("react-native-safe-area-context/jest/mock").default,
);

jest.mock("../../lib/useReadsEnabled", () => ({
  useReadsEnabled: jest.requireActual<{ useReadsEnabledMock: unknown }>(
    "../support/trainingGoalsRead",
  ).useReadsEnabledMock,
}));
jest.mock("@keylow/api-client", () => ({
  useTrainingGoals: jest.requireActual<{ useTrainingGoalsMock: unknown }>(
    "../support/trainingGoalsRead",
  ).useTrainingGoalsMock,
}));

// The addresses the questionnaire opens and sends to must be files under app/, or the control that leads
// there opens the not-found screen.
const appDirectory = join(__dirname, "..", "..", "app");

describe("the goal addresses and the screens under app/", () => {
  it.each([
    ["the flow", "goal/index.tsx"],
    ["the layout holding the answers", "goal/_layout.tsx"],
    ["a question", "goal/[step].tsx"],
    ["the summary", "goal/summary.tsx"],
  ])("should have a route file for %s", (_name, file) => {
    expect(existsSync(join(appDirectory, file))).toBe(true);
  });
});

function Providers() {
  return (
    <ThemeProvider fixedPreference="dark">
      <Slot />
    </ThemeProvider>
  );
}

const standIn = (text: string) =>
  function StandIn() {
    return <Text role="heading">{text}</Text>;
  };

async function openAt(location: string) {
  await render(
    <ExpoRoot
      context={getMockContext({
        _layout: Providers,
        index: standIn("Behind the flow"),
        "goal/_layout": GoalLayout,
        "goal/index": GoalIndex,
        "goal/[step]": GoalStepRoute,
        "goal/summary": standIn("The summary"),
      })}
      location={location}
    />,
  );
}

describe("the goal questionnaire under the router", () => {
  let kitStyles: string;

  beforeAll(async () => {
    kitStyles = await compileKitStyles("", ["components/GoalQuestionnaire"]);
  });

  beforeEach(() => {
    installVirtualClock();
    registerAppStyles(kitStyles);
    resetTrainingGoalsRead();
  });

  afterEach(async () => {
    await cleanup();
    jest.useRealTimers();
  });

  it("should open the first question at the flow's address", async () => {
    await openAt(goalPath());

    expect(
      await screen.findByRole("heading", { name: "What are you training for?" }),
    ).toBeOnTheScreen();
  });

  it.each(["0", "7", "summary-not-built", "two"])(
    "should send the address /goal/%s to the first question",
    async (step) => {
      await openAt(`/goal/${step}`);

      expect(
        await screen.findByRole("heading", { name: "What are you training for?" }),
      ).toBeOnTheScreen();
    },
  );

  it("should walk the first three questions with Next and keep every answer when Back returns", async () => {
    const user = userEvent.setup();
    await openAt(goalPath());

    await user.press(await screen.findByRole("radio", { name: /^Both/ }));
    await user.press(screen.getByRole("button", { name: "Next" }));

    await screen.findByRole("heading", { name: "Anything to focus on?" });
    await user.press(screen.getByRole("checkbox", { name: /^Arms/ }));
    await user.press(screen.getByRole("button", { name: "Next" }));

    await screen.findByRole("heading", { name: "How many days a week?" });
    await user.press(screen.getByRole("radio", { name: "5" }));

    await user.press(screen.getByRole("button", { name: "Back" }));
    await screen.findByRole("heading", { name: "Anything to focus on?" });
    expect(screen.getByRole("checkbox", { name: /^Arms/ })).toBeChecked();

    await user.press(screen.getByRole("button", { name: "Back" }));
    await screen.findByRole("heading", { name: "What are you training for?" });
    expect(screen.getByRole("radio", { name: /^Both/ })).toBeChecked();
    // Back leaves the questions it went past, so the first one has nothing behind it again.
    expect(router.canGoBack()).toBe(false);

    await user.press(screen.getByRole("button", { name: "Next" }));
    await user.press(await screen.findByRole("button", { name: "Next" }));
    await screen.findByRole("heading", { name: "How many days a week?" });
    expect(screen.getByRole("radio", { name: "5" })).toBeChecked();
  });

  describe("a link into the middle of the questions", () => {
    it("should send a cold /goal/3 to the first question, which has no Back", async () => {
      await openAt(goalQuestionPath(3));

      expect(
        await screen.findByRole("heading", { name: "What are you training for?" }),
      ).toBeOnTheScreen();
      expect(screen.queryByRole("button", { name: "Back" })).not.toBeOnTheScreen();
      expect(router.canGoBack()).toBe(false);
    });

    it("should send the first unanswered question, not the first, when only some are answered", async () => {
      const user = userEvent.setup();
      await openAt(goalPath());
      await user.press(await screen.findByRole("radio", { name: /^Both/ }));
      await user.press(screen.getByRole("button", { name: "Next" }));
      await screen.findByRole("heading", { name: "Anything to focus on?" });

      await act(() => {
        router.push(goalQuestionPath(5));
      });

      expect(
        await screen.findByRole("heading", { name: "How many days a week?" }),
      ).toBeOnTheScreen();
    });

    it("should still ask before closing when /goal/3 is pushed over the screen behind the flow", async () => {
      const user = userEvent.setup();
      await openAt("/");
      await screen.findByRole("heading", { name: "Behind the flow" });

      await act(() => {
        router.push(goalQuestionPath(3));
      });
      await user.press(await screen.findByRole("radio", { name: /^Both/ }));
      await user.press(screen.getByRole("button", { name: "Close, your answers are not saved" }));

      expect(screen.getByRole("heading", { name: "Your answers are not saved" })).toBeOnTheScreen();
      expect(screen.queryByRole("button", { name: "Back" })).not.toBeOnTheScreen();
    });
  });

  it("should add one second question when Next is pressed twice in the same moment", async () => {
    const user = userEvent.setup();
    await openAt(goalPath());
    await user.press(await screen.findByRole("radio", { name: /^Both/ }));

    await pressTwiceInTheSameMoment(screen.getByRole("button", { name: "Next" }));

    await screen.findByRole("heading", { name: "Anything to focus on?" });
    await user.press(screen.getByRole("button", { name: "Back" }));
    await screen.findByRole("heading", { name: "What are you training for?" });
    expect(router.canGoBack()).toBe(false);
  });

  it("should walk all six questions with Next and reach the summary from the last button", async () => {
    const user = userEvent.setup();
    await openAt(goalPath());

    await user.press(await screen.findByRole("radio", { name: /^Look better/ }));
    await user.press(screen.getByRole("button", { name: "Next" }));
    await screen.findByRole("heading", { name: "Anything to focus on?" });
    await user.press(screen.getByRole("button", { name: "Next" }));
    await user.press(await screen.findByRole("radio", { name: "4" }));
    await user.press(screen.getByRole("button", { name: "Next" }));
    await user.press(await screen.findByRole("radio", { name: "60 min" }));
    await user.press(screen.getByRole("button", { name: "Next" }));
    await user.press(await screen.findByRole("checkbox", { name: "Full gym" }));
    await user.press(screen.getByRole("button", { name: "Next" }));
    await user.press(await screen.findByRole("radio", { name: /^Intermediate/ }));
    await user.press(screen.getByRole("button", { name: "See your priorities" }));

    expect(await screen.findByRole("heading", { name: "The summary" })).toBeOnTheScreen();
  });

  it("should open every question filled when a goal is stored, so a link to the later ones works", async () => {
    const user = userEvent.setup();
    trainingGoalsRead.row = storedGoalRow;
    await openAt(goalPath());

    expect(await screen.findByRole("radio", { name: /^Both/ })).toBeChecked();
    for (const [heading, selected] of [
      ["Anything to focus on?", () => screen.getByRole("checkbox", { name: /^Arms/ })],
      ["How many days a week?", () => screen.getByRole("radio", { name: "5" })],
      ["How long is a session?", () => screen.getByRole("radio", { name: "Other" })],
      ["What can you use?", () => screen.getByRole("checkbox", { name: "Cable" })],
      ["How long have you trained?", () => screen.getByRole("radio", { name: /^Advanced/ })],
    ] as const) {
      await user.press(screen.getByRole("button", { name: /^(Next|See your priorities)$/ }));
      await screen.findByRole("heading", { name: heading });
      expect(selected()).toBeChecked();
    }
  });
});
