import { buildAssistantSheetThread, threadFromMessages } from "@keylow/core";
import { describeFormPhoto, describeFormVideoLink, EXERCISE_FORM } from "@keylow/core/copy";
import { youtubeWatchUrl } from "@keylow/core/training";
import { act, render, screen, userEvent } from "@testing-library/react-native";
import { openURL } from "expo-linking";
import { AccessibilityInfo } from "react-native";
import { setUpTests } from "react-native-reanimated";

import { AssistantThread } from "../components/AssistantSheet/AssistantThread";
import { ExerciseFormEntry } from "../components/AssistantSheet/ExerciseFormEntry";
import { ThemeProvider } from "../lib/theme";
import { compileKitStyles } from "./support/kitStyles";
import { registerAppStyles } from "./support/nativeWindStyles";

import type { AssistantExerciseFormMedia, AssistantStoredMessage } from "@keylow/core";

jest.mock("@react-native-async-storage/async-storage", () => ({
  __esModule: true,
  default: { getItem: () => Promise.resolve(null), setItem: () => Promise.resolve() },
}));
jest.mock(
  "react-native-safe-area-context",
  () =>
    jest.requireActual<{ default: unknown }>("react-native-safe-area-context/jest/mock").default,
);
jest.mock("expo-linking", () => ({ openURL: jest.fn() }));

setUpTests();

const openURLMock = jest.mocked(openURL);

const squatVideo: AssistantExerciseFormMedia = {
  exerciseName: "Barbell Squat",
  media: {
    kind: "video",
    videoId: "abcdefghijk",
    title: "How to squat with good form",
    channel: "Strength Basics",
  },
};

const curlPhotos: AssistantExerciseFormMedia = {
  exerciseName: "Dumbbell Curl",
  media: { kind: "photos", imagePaths: ["Dumbbell_Curl/0.jpg", "Dumbbell_Curl/1.jpg"] },
};

const inTheme = (children: React.ReactNode) => (
  <ThemeProvider fixedPreference="dark">{children}</ThemeProvider>
);

describe("the form media of an exercise in the assistant thread", () => {
  let kitStyles: string;

  beforeAll(async () => {
    kitStyles = await compileKitStyles("", ["components/AssistantSheet"]);
  });

  beforeEach(() => {
    registerAppStyles(kitStyles);
    jest.spyOn(AccessibilityInfo, "isReduceMotionEnabled").mockResolvedValue(false);
    openURLMock.mockResolvedValue(true);
  });

  afterEach(() => {
    jest.restoreAllMocks();
    openURLMock.mockReset();
  });

  describe("the video card", () => {
    it("should be one link named from the title and the channel", async () => {
      await render(inTheme(<ExerciseFormEntry exercise={squatVideo} />));

      expect(
        screen.getByRole("link", {
          name: describeFormVideoLink("How to squat with good form", "Strength Basics"),
        }),
      ).toBeOnTheScreen();
      expect(screen.getByText(EXERCISE_FORM.opensInYouTube)).toBeOnTheScreen();
    });

    it("should open the watch address the app built from the video id", async () => {
      await render(inTheme(<ExerciseFormEntry exercise={squatVideo} />));

      const user = userEvent.setup();
      await user.press(screen.getByRole("link"));

      expect(openURLMock).toHaveBeenCalledTimes(1);
      expect(openURLMock).toHaveBeenCalledWith(youtubeWatchUrl("abcdefghijk"));
    });
  });

  describe("the photos card", () => {
    it("should show the start photo, named for the exercise", async () => {
      await render(inTheme(<ExerciseFormEntry exercise={curlPhotos} />));

      expect(
        screen.getByRole("img", { name: describeFormPhoto("Dumbbell Curl", "start") }),
      ).toBeOnTheScreen();
      expect(screen.getByText(EXERCISE_FORM.startLabel)).toBeOnTheScreen();
    });

    it("should show both photos side by side with Reduce Motion on", async () => {
      jest.spyOn(AccessibilityInfo, "isReduceMotionEnabled").mockResolvedValue(true);
      await render(inTheme(<ExerciseFormEntry exercise={curlPhotos} />));
      await act(async () => {
        await Promise.resolve();
      });

      expect(screen.getByText(EXERCISE_FORM.startLabel)).toBeOnTheScreen();
      expect(screen.getByText(EXERCISE_FORM.endLabel)).toBeOnTheScreen();
      expect(
        screen.getByRole("img", { name: describeFormPhoto("Dumbbell Curl", "end") }),
      ).toBeVisible();
    });

    it("should hold no button and no link", async () => {
      await render(inTheme(<ExerciseFormEntry exercise={curlPhotos} />));

      expect(screen.queryAllByRole("button")).toHaveLength(0);
      expect(screen.queryAllByRole("link")).toHaveLength(0);
    });
  });

  describe("the thread", () => {
    const replyWords = "Here are both form guides.";
    const turnId = "00000000-0000-4000-8000-0000000000a1";
    const toolUse = (id: string) => ({
      type: "tool_use",
      id,
      name: "show_exercise_form",
      input: {},
    });

    // The turn as the function stores it: the cards come with the tool results, before the words that follow.
    const storedTurn: AssistantStoredMessage[] = [
      {
        id: "m1",
        turnId,
        role: "user",
        content: [{ type: "text", text: "How do I do a squat and a curl?" }],
        display: null,
        turnStatus: "complete",
      },
      {
        id: "m2",
        turnId,
        role: "assistant",
        content: [toolUse("call-1"), toolUse("call-2")],
        display: null,
        turnStatus: "complete",
      },
      {
        id: "m3",
        turnId,
        role: "user",
        content: [
          { type: "tool_result", tool_use_id: "call-1", content: "done" },
          { type: "tool_result", tool_use_id: "call-2", content: "done" },
        ],
        display: {
          "call-1": { exerciseFormMedia: squatVideo },
          "call-2": { exerciseFormMedia: curlPhotos },
        },
        turnStatus: "complete",
      },
      {
        id: "m4",
        turnId,
        role: "assistant",
        content: [{ type: "text", text: replyWords }],
        display: null,
        turnStatus: "complete",
      },
    ];

    const viewOf = (thread: ReturnType<typeof buildAssistantSheetThread>) =>
      inTheme(
        <AssistantThread
          canAnswer
          thread={thread}
          timeZone="Europe/London"
          onAnswer={jest.fn()}
          onAskAgain={jest.fn()}
          onOpenCardLink={jest.fn()}
          onTryAgain={jest.fn()}
        />,
      );

    it("should draw two cards for two entries, after the reply, when the conversation is reopened", async () => {
      const thread = buildAssistantSheetThread({
        items: threadFromMessages(storedTurn, []),
        sent: null,
        live: null,
        isStreaming: false,
      });

      await render(viewOf(thread));

      expect(screen.getAllByRole("link")).toHaveLength(1);
      expect(
        screen.getByRole("img", { name: describeFormPhoto("Dumbbell Curl", "start") }),
      ).toBeOnTheScreen();
      const drawn = JSON.stringify(screen.toJSON());
      const positions = [replyWords, "Strength Basics", EXERCISE_FORM.startLabel].map((words) =>
        drawn.indexOf(words),
      );
      expect(positions.every((position) => position >= 0)).toBe(true);
      expect(positions).toEqual([...positions].sort((first, second) => first - second));
    });

    it("should draw the card of a live turn under its reply", async () => {
      const thread = buildAssistantSheetThread({
        items: [],
        sent: { text: "How do I squat?", afterItemId: null },
        live: {
          text: "Here is a form guide.",
          cards: [],
          clarify: null,
          confirm: null,
          answerMeta: null,
          status: null,
          stopped: false,
          notice: null,
          outcome: "complete",
          exerciseFormMedia: [squatVideo],
        },
        isStreaming: false,
      });

      await render(viewOf(thread));

      expect(screen.getByRole("link")).toBeOnTheScreen();
    });

    it("should draw a turn with no such entry as it did before", async () => {
      const thread = buildAssistantSheetThread({
        items: threadFromMessages(storedTurn.slice(0, 1), []),
        sent: null,
        live: null,
        isStreaming: false,
      });

      await render(viewOf(thread));

      expect(screen.queryAllByRole("link")).toHaveLength(0);
      expect(screen.queryAllByRole("img")).toHaveLength(0);
    });
  });
});
