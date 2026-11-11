import { KeyLowProvider } from "@keylow/api-client";
import { EXERCISE_FORM, describeFormPhoto, describeFormVideoLink } from "@keylow/core/copy";
import { onlineManager } from "@tanstack/react-query";
import { act, cleanup, render, screen, userEvent, waitFor } from "@testing-library/react-native";
import { openURL } from "expo-linking";
import { AccessibilityInfo } from "react-native";
import { setUpTests } from "react-native-reanimated";

import { ExerciseFormSection } from "../components/ExerciseFormSection";
import { ThemeProvider } from "../lib/theme";
import { createDiaryQueryClient, diaryBackend, resetDiaryBackend } from "./support/diaryBackend";
import {
  formMediaBackend,
  formMediaClient,
  resetFormMediaBackend,
} from "./support/formMediaBackend";
import { compileKitStyles } from "./support/kitStyles";
import { registerAppStyles } from "./support/nativeWindStyles";

import type { QueryClient } from "@tanstack/react-query";

jest.mock("@react-native-async-storage/async-storage", () => ({
  __esModule: true,
  default: { getItem: () => Promise.resolve(null), setItem: () => Promise.resolve() },
}));
jest.mock("expo-linking", () => ({ openURL: jest.fn() }));
setUpTests();

const SQUAT_ID = "00000000-0000-4000-8000-000000000b01";
const SQUAT_NAME = "Barbell back squat";
const VIDEO_TITLE = "Barbell back squat, step by step";
const VIDEO_CHANNEL = "Strength Basics";
const VIDEO_ROW = {
  video_id: "abcdefghijk",
  video_title: VIDEO_TITLE,
  video_channel: VIDEO_CHANNEL,
  image_paths: ["Barbell_Squat/0.jpg", "Barbell_Squat/1.jpg"],
};
const PHOTOS_ROW = {
  video_id: null,
  video_title: null,
  video_channel: null,
  image_paths: ["Barbell_Squat/0.jpg", "Barbell_Squat/1.jpg"],
};

let queryClient: QueryClient;
let kitStyles: string;

async function renderSection(isOpen: boolean) {
  queryClient = createDiaryQueryClient();
  const sectionOf = (open: boolean) => (
    <ThemeProvider fixedPreference="dark">
      <KeyLowProvider client={formMediaClient} queryClient={queryClient}>
        <ExerciseFormSection exerciseId={SQUAT_ID} exerciseName={SQUAT_NAME} isOpen={open} />
      </KeyLowProvider>
    </ThemeProvider>
  );
  const view = await render(sectionOf(isOpen));

  return {
    open: () => view.rerender(sectionOf(true)),
    close: () => view.rerender(sectionOf(false)),
  };
}

describe("ExerciseFormSection", () => {
  beforeAll(async () => {
    kitStyles = await compileKitStyles();
  });

  beforeEach(() => {
    registerAppStyles(kitStyles);
    resetFormMediaBackend();
    resetDiaryBackend();
    jest.spyOn(AccessibilityInfo, "isReduceMotionEnabled").mockResolvedValue(false);
    jest.mocked(openURL).mockResolvedValue(true);
  });

  afterEach(async () => {
    await cleanup();
    await act(() => {
      onlineManager.setOnline(true);
    });
    queryClient.clear();
    jest.restoreAllMocks();
    jest.mocked(openURL).mockReset();
  });

  it("should show the video as a link to YouTube that opens it when pressed", async () => {
    formMediaBackend.rowsByExercise[SQUAT_ID] = VIDEO_ROW;
    await renderSection(true);

    const link = await screen.findByRole("link", {
      name: describeFormVideoLink(VIDEO_TITLE, VIDEO_CHANNEL),
    });
    await userEvent.press(link);

    expect(openURL).toHaveBeenCalledWith("https://www.youtube.com/watch?v=abcdefghijk");
  });

  it("should show the start and end photos of the exercise when it has no video", async () => {
    formMediaBackend.rowsByExercise[SQUAT_ID] = PHOTOS_ROW;
    await renderSection(true);

    expect(
      await screen.findByRole("img", { name: describeFormPhoto(SQUAT_NAME, "start") }),
    ).toBeOnTheScreen();
    expect(
      screen.getByRole("img", { name: describeFormPhoto(SQUAT_NAME, "end") }),
    ).toBeOnTheScreen();
  });

  it("should show nothing for an exercise with no form media", async () => {
    await renderSection(true);

    await waitFor(() => {
      expect(formMediaBackend.reads).toBe(1);
    });
    await act(() => Promise.resolve());
    expect(screen.queryByRole("status")).not.toBeOnTheScreen();
    expect(screen.queryByRole("link")).not.toBeOnTheScreen();
    expect(screen.queryAllByRole("img")).toHaveLength(0);
  });

  it("should show the loading card while the read is out", async () => {
    formMediaBackend.read = "hang";
    await renderSection(true);

    expect(
      await screen.findByRole("status", { name: EXERCISE_FORM.loadingName }),
    ).toBeOnTheScreen();
  });

  it("should say the guide is unavailable when the phone is offline and holds nothing", async () => {
    await act(() => {
      onlineManager.setOnline(false);
    });
    await renderSection(true);

    expect(await screen.findByText(EXERCISE_FORM.unavailable)).toBeOnTheScreen();
    expect(formMediaBackend.reads).toBe(0);
  });

  it("should say the guide is unavailable when the read fails", async () => {
    formMediaBackend.read = "fail";
    await renderSection(true);

    expect(await screen.findByText(EXERCISE_FORM.unavailable)).toBeOnTheScreen();
  });

  it("should read nothing while the sheet is closed, then read once it opens", async () => {
    formMediaBackend.rowsByExercise[SQUAT_ID] = VIDEO_ROW;
    const section = await renderSection(false);

    await act(() => Promise.resolve());
    expect(formMediaBackend.reads).toBe(0);

    await section.open();

    expect(
      await screen.findByRole("link", { name: describeFormVideoLink(VIDEO_TITLE, VIDEO_CHANNEL) }),
    ).toBeOnTheScreen();
    expect(formMediaBackend.reads).toBe(1);
  });

  it("should keep the card it showed while the sheet closes, so an offline card does not turn to loading", async () => {
    await act(() => {
      onlineManager.setOnline(false);
    });
    const section = await renderSection(true);
    expect(await screen.findByText(EXERCISE_FORM.unavailable)).toBeOnTheScreen();

    await section.close();

    expect(screen.getByText(EXERCISE_FORM.unavailable)).toBeOnTheScreen();
    expect(screen.queryByRole("status", { name: EXERCISE_FORM.loadingName })).not.toBeOnTheScreen();
  });

  it("should read nothing before the Terms are accepted", async () => {
    formMediaBackend.rowsByExercise[SQUAT_ID] = VIDEO_ROW;
    diaryBackend.terms = { terms_accepted_at: null, terms_version: null };
    await renderSection(true);

    // The gate's own read has answered that the Terms are not accepted, and the form media is still not read.
    await waitFor(() => {
      expect(
        diaryBackend.requests.some((request) => request.search.includes("terms_accepted_at")),
      ).toBe(true);
    });
    await act(() => Promise.resolve());
    expect(formMediaBackend.reads).toBe(0);
  });
});
