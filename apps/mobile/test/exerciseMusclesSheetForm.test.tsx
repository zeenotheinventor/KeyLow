import { KeyLowProvider } from "@keylow/api-client";
import { describeFormPhoto, describeFormVideoLink, EXERCISE_MUSCLES } from "@keylow/core/copy";
import { act, cleanup, render, screen, userEvent, waitFor } from "@testing-library/react-native";
import { openURL } from "expo-linking";
import { AccessibilityInfo } from "react-native";
import { setUpTests } from "react-native-reanimated";

import { ExerciseMusclesSheet } from "../components/ExerciseMusclesSheet";
import { resetBodyFigureForTests } from "../lib/bodyFigure/testing";
import { ThemeProvider } from "../lib/theme";
import { createDiaryQueryClient } from "./support/diaryBackend";
import {
  formMediaBackend,
  formMediaClient,
  resetFormMediaBackend,
} from "./support/formMediaBackend";
import { compileKitStyles } from "./support/kitStyles";
import { registerAppStyles } from "./support/nativeWindStyles";
import { resetTrainBackend } from "./support/trainBackend";

import type { ExerciseMusclesSheetProps } from "../components/ExerciseMusclesSheet";
import type { ExerciseMuscleEntry } from "@keylow/core/schemas";
import type { QueryClient } from "@tanstack/react-query";

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

// Jest does not turn the library's scroll handlers into worklets, so the plain scroll view stands in for the
// library's, which the sheet's contents scroll in.
jest.mock("@gorhom/bottom-sheet", () =>
  jest
    .requireActual<{ mockBottomSheet: () => unknown }>("./support/sheetScrollViewMock")
    .mockBottomSheet(),
);

setUpTests();

const SQUAT_ID = "00000000-0000-4000-8000-000000000b01";
const SQUAT_MUSCLES: readonly ExerciseMuscleEntry[] = [
  { muscle_id: "quads", role: "primary", weight: 1 },
  { muscle_id: "calves", role: "stabiliser", weight: 0.2 },
];
const squat = { id: SQUAT_ID, name: "Barbell back squat", muscles: SQUAT_MUSCLES };
const VIDEO_TITLE = "Barbell back squat, step by step";
const VIDEO_CHANNEL = "Strength Basics";
const VIDEO_ROW = {
  video_id: "abcdefghijk",
  video_title: VIDEO_TITLE,
  video_channel: VIDEO_CHANNEL,
  image_paths: null,
};
const PHOTOS_ROW = {
  video_id: null,
  video_title: null,
  video_channel: null,
  image_paths: ["Barbell_Squat/0.jpg", "Barbell_Squat/1.jpg"],
};
const videoName = describeFormVideoLink(VIDEO_TITLE, VIDEO_CHANNEL);

let queryClient: QueryClient;

const sheetOf = (props: ExerciseMusclesSheetProps) => (
  <ThemeProvider fixedPreference="dark">
    <KeyLowProvider client={formMediaClient} queryClient={queryClient}>
      <ExerciseMusclesSheet {...props} />
    </KeyLowProvider>
  </ThemeProvider>
);

const onClose = jest.fn();

type Drawn = { props: Record<string, unknown>; children: (string | Drawn)[] | null };

// The text and the names of everything drawn, in the order it is drawn, so placement is tested as it is read.
function wordsInOrder(nodes: Drawn | Drawn[] | null): string[] {
  if (nodes === null) {
    return [];
  }
  return (Array.isArray(nodes) ? nodes : [nodes]).flatMap((node) => {
    const label = node.props["aria-label"] ?? node.props["accessibilityLabel"];
    return [
      ...(typeof label === "string" ? [label] : []),
      ...(node.children ?? []).flatMap((child) =>
        typeof child === "string" ? [child] : wordsInOrder(child),
      ),
    ];
  });
}

describe("the Muscles it works sheet with the form card", () => {
  let kitStyles: string;

  beforeAll(async () => {
    kitStyles = await compileKitStyles("", [
      "components/ExerciseMusclesSheet",
      "components/ExerciseFormSection",
    ]);
  });

  beforeEach(() => {
    registerAppStyles(kitStyles);
    resetTrainBackend();
    resetFormMediaBackend();
    resetBodyFigureForTests();
    queryClient = createDiaryQueryClient();
    onClose.mockClear();
    jest.spyOn(AccessibilityInfo, "isReduceMotionEnabled").mockResolvedValue(false);
    jest.mocked(openURL).mockResolvedValue(true);
  });

  afterEach(async () => {
    await cleanup();
    queryClient.clear();
    jest.restoreAllMocks();
    jest.mocked(openURL).mockReset();
  });

  it("should show the video card with the muscles under it, and open YouTube when it is pressed", async () => {
    formMediaBackend.rowsByExercise[SQUAT_ID] = VIDEO_ROW;
    await render(sheetOf({ exercise: squat, onClose }));

    await userEvent.press(await screen.findByRole("link", { name: videoName }));

    expect(openURL).toHaveBeenCalledWith("https://www.youtube.com/watch?v=abcdefghijk");
    expect(
      screen.getByRole("listitem", { name: "Quads, Primary · counts 1 set" }),
    ).toBeOnTheScreen();
  });

  it("should place the card under the exercise name and above the muscles caption", async () => {
    formMediaBackend.rowsByExercise[SQUAT_ID] = VIDEO_ROW;
    await render(sheetOf({ exercise: squat, onClose }));
    await screen.findByRole("link", { name: videoName });

    const drawn = wordsInOrder(screen.toJSON());
    const positions = [squat.name, videoName, EXERCISE_MUSCLES.caption].map((words) =>
      drawn.indexOf(words),
    );

    expect(positions).toEqual([...positions].sort((first, second) => first - second));
    expect(positions.every((position) => position >= 0)).toBe(true);
  });

  it("should show the start and end photos for an exercise with no video", async () => {
    formMediaBackend.rowsByExercise[SQUAT_ID] = PHOTOS_ROW;
    await render(sheetOf({ exercise: squat, onClose }));

    expect(
      await screen.findByRole("img", { name: describeFormPhoto(squat.name, "start") }),
    ).toBeOnTheScreen();
    expect(
      screen.getByRole("img", { name: describeFormPhoto(squat.name, "end") }),
    ).toBeOnTheScreen();
  });

  it("should draw the sheet as it was, with no card, for an exercise with no form media", async () => {
    await render(sheetOf({ exercise: squat, onClose }));
    // The read landing and the loading mark leaving arrive independently, so both wait inside one check.
    await waitFor(() => {
      expect(formMediaBackend.reads).toBe(1);
      expect(screen.queryByRole("status")).not.toBeOnTheScreen();
      expect(screen.queryByRole("link")).not.toBeOnTheScreen();
    });

    expect(screen.getByText(EXERCISE_MUSCLES.caption)).toBeOnTheScreen();
    expect(screen.getAllByRole("listitem")).toHaveLength(2);
  });

  it("should read no form media while the sheet is closed", async () => {
    formMediaBackend.rowsByExercise[SQUAT_ID] = VIDEO_ROW;
    await render(sheetOf({ exercise: null, onClose }));

    await act(() => Promise.resolve());

    expect(formMediaBackend.reads).toBe(0);
  });
});
