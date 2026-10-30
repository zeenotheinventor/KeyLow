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

jest.mock("@react-native-async-storage/async-storage", () => ({
  __esModule: true,
  default: { getItem: () => Promise.resolve(null), setItem: () => Promise.resolve() },
}));
jest.mock(
  "react-native-safe-area-context",
  () =>
    jest.requireActual<{ default: unknown }>("react-native-safe-area-context/jest/mock").default,
);

// The addresses the questionnaire opens and sends to must be files under app/, or the control that leads
// there opens the not-found screen. The summary's file comes with the ticket that builds it.
const appDirectory = join(__dirname, "..", "..", "app");

describe("the goal addresses and the screens under app/", () => {
  it.each([
    ["the flow", "goal/index.tsx"],
    ["the layout holding the answers", "goal/_layout.tsx"],
    ["a question", "goal/[step].tsx"],
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
    registerAppStyles(kitStyles);
  });

  afterEach(async () => {
    await cleanup();
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
});
