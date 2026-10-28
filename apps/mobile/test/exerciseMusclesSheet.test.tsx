import { KeyLowProvider } from "@keylow/api-client";
import { describeExerciseMusclesFigureLabel, EXERCISE_MUSCLES } from "@keylow/core/copy";
import { BODY_ARTWORK } from "@keylow/core/training";
import { createClient } from "@supabase/supabase-js";
import { onlineManager } from "@tanstack/react-query";
import { act, cleanup, render, screen, waitFor } from "@testing-library/react-native";
import { setUpTests } from "react-native-reanimated";

import { ExerciseMusclesSheet } from "../components/ExerciseMusclesSheet";
import { resetBodyFigureForTests } from "../lib/bodyFigure/testing";
import { ThemeProvider } from "../lib/theme";
import { createDiaryQueryClient } from "./support/diaryBackend";
import { compileKitStyles } from "./support/kitStyles";
import { registerAppStyles } from "./support/nativeWindStyles";
import { resetTrainBackend, trainBackend, trainFetch } from "./support/trainBackend";

import type { ExerciseMusclesSheetProps } from "../components/ExerciseMusclesSheet";
import type { Database } from "@keylow/api-client";
import type { ExerciseMuscleEntry } from "@keylow/core/schemas";
import type { BodyArtworkFigure } from "@keylow/core/training";
import type { QueryClient } from "@tanstack/react-query";

const mockStorageItems = new Map<string, string>();
const mockReadItem = (key: string) => Promise.resolve(mockStorageItems.get(key) ?? null);
const mockGetItem = jest.fn(mockReadItem);

jest.mock("@react-native-async-storage/async-storage", () => ({
  __esModule: true,
  default: {
    getItem: (key: string) => mockGetItem(key),
    setItem: (key: string, value: string) => {
      mockStorageItems.set(key, value);
      return Promise.resolve();
    },
  },
}));
jest.mock(
  "react-native-safe-area-context",
  () =>
    jest.requireActual<{ default: unknown }>("react-native-safe-area-context/jest/mock").default,
);

setUpTests();

const LEG_PRESS_ID = "00000000-0000-4000-8000-000000000a01";
const CURL_ID = "00000000-0000-4000-8000-000000000a02";

// Quads primary, glutes and hamstrings secondary, calves assisting: the exercise library's Leg Press, in the
// muscle list's order, which is the order a read returns.
const LEG_PRESS_MUSCLES: readonly ExerciseMuscleEntry[] = [
  { muscle_id: "quads", role: "primary", weight: 1 },
  { muscle_id: "glute_max", role: "secondary", weight: 0.5 },
  { muscle_id: "hamstrings", role: "secondary", weight: 0.5 },
  { muscle_id: "calves", role: "stabiliser", weight: 0.2 },
];
const CURL_MUSCLES: readonly ExerciseMuscleEntry[] = [
  { muscle_id: "biceps", role: "primary", weight: 1 },
];

const legPress = { id: LEG_PRESS_ID, name: "Leg Press", muscles: LEG_PRESS_MUSCLES };
const legPressUnknown = { id: LEG_PRESS_ID, name: "Leg Press", muscles: null };
const curl = { id: CURL_ID, name: "Biceps Curl", muscles: CURL_MUSCLES };

// What the server does with a read of one exercise by its id: answers it, fails it or never answers.
let exerciseRead: "answer" | "fail" | "hang" = "answer";
let exerciseReads = 0;

const backendFetch: typeof fetch = (input, init) => {
  const address = typeof input === "string" ? input : input instanceof URL ? input.href : input.url;
  const url = new URL(address);
  if (url.pathname.endsWith("/exercises") && url.searchParams.has("id")) {
    exerciseReads += 1;
    if (exerciseRead === "hang") {
      return new Promise<Response>(() => undefined);
    }
    if (exerciseRead === "fail") {
      return Promise.resolve(
        new Response(JSON.stringify({ code: "XX000", message: "raw", details: null, hint: null }), {
          status: 500,
          headers: { "Content-Type": "application/json" },
        }),
      );
    }
  }

  return trainFetch(input, init);
};

const client = createClient<Database>("http://localhost:54321", "anon-key", {
  auth: { persistSession: false, autoRefreshToken: false },
  global: { fetch: backendFetch },
});

let queryClient: QueryClient;

const sheetOf = (props: ExerciseMusclesSheetProps) => (
  <ThemeProvider fixedPreference="dark">
    <KeyLowProvider client={client} queryClient={queryClient}>
      <ExerciseMusclesSheet {...props} />
    </KeyLowProvider>
  </ThemeProvider>
);

const onClose = jest.fn();

// The body a figure is drawn as, found by the outline of its side among the paths it draws.
function drawnBody(name: string): BodyArtworkFigure | null {
  const [figure] = screen.queryAllByRole("img", { name });
  const drawn = (["male", "female"] as const).filter(
    (body) =>
      figure?.queryAll(
        (node) =>
          node.type === "RNSVGPath" &&
          Object.getOwnPropertyDescriptor(node.props, "d")?.value ===
            BODY_ARTWORK[body].front.outline,
      ).length === 1,
  );
  return drawn[0] ?? null;
}

describe("the Muscles it works sheet", () => {
  let kitStyles: string;

  beforeAll(async () => {
    kitStyles = await compileKitStyles("", ["components/ExerciseMusclesSheet"]);
  });

  beforeEach(() => {
    registerAppStyles(kitStyles);
    resetTrainBackend();
    exerciseRead = "answer";
    exerciseReads = 0;
    mockStorageItems.clear();
    mockGetItem.mockReset();
    mockGetItem.mockImplementation(mockReadItem);
    resetBodyFigureForTests();
    queryClient = createDiaryQueryClient();
    trainBackend.exercises = [
      {
        id: LEG_PRESS_ID,
        name: "Leg Press",
        equipment: "machine",
        mechanic: "compound",
        source: "free_exercise_db",
        exercise_muscles: LEG_PRESS_MUSCLES,
      },
    ];
    onClose.mockClear();
  });

  afterEach(async () => {
    await cleanup();
    await act(() => {
      onlineManager.setOnline(true);
    });
    queryClient.clear();
  });

  describe("with the muscles known", () => {
    it("should be a dialog named for the exercise, with the exercise as its heading", async () => {
      await render(sheetOf({ exercise: legPress, onClose }));

      expect(screen.getByLabelText("Leg Press")).toHaveProp("role", "dialog");
      expect(screen.getByRole("heading", { name: "Leg Press" })).toBeOnTheScreen();
      expect(screen.getByText(EXERCISE_MUSCLES.caption)).toBeOnTheScreen();
    });

    it("should draw the front and the back of the body, each named for the exercise", async () => {
      await render(sheetOf({ exercise: legPress, onClose }));

      expect(
        await screen.findByRole("img", {
          name: describeExerciseMusclesFigureLabel({ name: "Leg Press", side: "front" }),
        }),
      ).toBeOnTheScreen();
      expect(
        screen.getByRole("img", {
          name: describeExerciseMusclesFigureLabel({ name: "Leg Press", side: "back" }),
        }),
      ).toBeOnTheScreen();
    });

    it("should list one row for each role, named in words, and explain how a set counts", async () => {
      await render(sheetOf({ exercise: legPress, onClose }));

      expect(screen.getAllByRole("listitem")).toHaveLength(3);
      expect(
        screen.getByRole("listitem", { name: "Quads, Primary · counts 1 set" }),
      ).toBeOnTheScreen();
      expect(
        screen.getByRole("listitem", { name: "Glutes, Hamstrings, Secondary · counts half" }),
      ).toBeOnTheScreen();
      expect(
        screen.getByRole("listitem", { name: "Calves, Assisting · counts a fifth" }),
      ).toBeOnTheScreen();
      expect(screen.getByText(EXERCISE_MUSCLES.explanation)).toBeOnTheScreen();
    });

    it("should have no row for a role that has no muscles", async () => {
      await render(sheetOf({ exercise: curl, onClose }));

      expect(screen.getAllByRole("listitem")).toHaveLength(1);
      expect(
        screen.getByRole("listitem", { name: "Biceps, Primary · counts 1 set" }),
      ).toBeOnTheScreen();
      expect(screen.queryByText(/Secondary/)).not.toBeOnTheScreen();
      expect(screen.queryByText(/Assisting/)).not.toBeOnTheScreen();
    });

    it("should make no request for the muscles", async () => {
      await render(sheetOf({ exercise: legPress, onClose }));
      await act(() => Promise.resolve());

      expect(screen.getAllByRole("listitem")).toHaveLength(3);
      expect(exerciseReads).toBe(0);
    });
  });

  describe("the figures", () => {
    const frontName = describeExerciseMusclesFigureLabel({ name: "Leg Press", side: "front" });

    it("should be drawn as the female figure when that is the setting", async () => {
      mockStorageItems.set("bodyMap.figure", "female");

      await render(sheetOf({ exercise: legPress, onClose }));

      expect(await screen.findByRole("img", { name: frontName })).toBeOnTheScreen();
      expect(drawnBody(frontName)).toBe("female");
    });

    it("should be drawn as the male figure when none was chosen", async () => {
      await render(sheetOf({ exercise: legPress, onClose }));

      expect(await screen.findByRole("img", { name: frontName })).toBeOnTheScreen();
      expect(drawnBody(frontName)).toBe("male");
    });

    it("should not be drawn until the stored setting has been read, so the wrong body never shows", async () => {
      let finishRead: (value: string | null) => void = () => undefined;
      mockGetItem.mockImplementation(
        () =>
          new Promise<string | null>((resolve) => {
            finishRead = resolve;
          }),
      );

      await render(sheetOf({ exercise: legPress, onClose }));

      expect(screen.queryAllByRole("img")).toHaveLength(0);
      expect(screen.getByRole("heading", { name: "Leg Press" })).toBeOnTheScreen();
      await act(() => {
        finishRead("female");
      });
      expect(await screen.findByRole("img", { name: frontName })).toBeOnTheScreen();
      expect(drawnBody(frontName)).toBe("female");
    });
  });

  describe("with the muscles not known", () => {
    it("should show the loading rows, with no row and no explanation, while the read is pending", async () => {
      exerciseRead = "hang";
      await render(sheetOf({ exercise: legPressUnknown, onClose }));

      expect(screen.getByRole("heading", { name: "Leg Press" })).toBeOnTheScreen();
      expect(screen.getByText(EXERCISE_MUSCLES.caption)).toBeOnTheScreen();
      expect(await screen.findAllByRole("img")).toHaveLength(2);
      expect(screen.getByRole("status", { name: EXERCISE_MUSCLES.loadingName })).toBeOnTheScreen();
      expect(screen.queryAllByRole("listitem")).toHaveLength(0);
      expect(screen.queryByText(EXERCISE_MUSCLES.explanation)).not.toBeOnTheScreen();
    });

    it("should show the rows once the read answers", async () => {
      await render(sheetOf({ exercise: legPressUnknown, onClose }));

      expect(
        await screen.findByRole("listitem", { name: "Quads, Primary · counts 1 set" }),
      ).toBeOnTheScreen();
      expect(screen.getAllByRole("listitem")).toHaveLength(3);
      expect(screen.queryByRole("status")).not.toBeOnTheScreen();
      expect(screen.getByText(EXERCISE_MUSCLES.explanation)).toBeOnTheScreen();
    });

    it("should say the muscles are not available offline, with no row and no explanation", async () => {
      await act(() => {
        onlineManager.setOnline(false);
      });
      await render(sheetOf({ exercise: legPressUnknown, onClose }));

      expect(await screen.findByText(EXERCISE_MUSCLES.offline)).toBeOnTheScreen();
      expect(screen.getByRole("heading", { name: "Leg Press" })).toBeOnTheScreen();
      expect(await screen.findAllByRole("img")).toHaveLength(2);
      expect(screen.queryByRole("status")).not.toBeOnTheScreen();
      expect(screen.queryAllByRole("listitem")).toHaveLength(0);
      expect(screen.queryByText(EXERCISE_MUSCLES.explanation)).not.toBeOnTheScreen();
    });

    it("should say the muscles could not be loaded when the read fails", async () => {
      exerciseRead = "fail";
      await render(sheetOf({ exercise: legPressUnknown, onClose }));

      expect(await screen.findByText(EXERCISE_MUSCLES.failed)).toBeOnTheScreen();
      expect(screen.getByRole("heading", { name: "Leg Press" })).toBeOnTheScreen();
      expect(screen.queryByRole("status")).not.toBeOnTheScreen();
      expect(screen.queryAllByRole("listitem")).toHaveLength(0);
      expect(screen.queryByText(EXERCISE_MUSCLES.explanation)).not.toBeOnTheScreen();
    });
  });

  describe("as it opens and closes", () => {
    it("should draw nothing while no exercise is set", async () => {
      await render(sheetOf({ exercise: null, onClose }));
      await act(() => Promise.resolve());

      expect(screen.queryByRole("heading")).not.toBeOnTheScreen();
      expect(screen.queryByLabelText("Leg Press")).not.toBeOnTheScreen();
    });

    it("should keep the last exercise on show while the sheet closes", async () => {
      const { rerender } = await render(sheetOf({ exercise: legPress, onClose }));

      await rerender(sheetOf({ exercise: null, onClose }));

      expect(screen.getByRole("heading", { name: "Leg Press" })).toBeOnTheScreen();
      expect(screen.getByLabelText("Leg Press")).toHaveProp("role", "dialog");
      expect(screen.getAllByRole("listitem")).toHaveLength(3);
    });

    it("should keep the muscles it read on show while the sheet closes, with no loading rows", async () => {
      const { rerender } = await render(sheetOf({ exercise: legPressUnknown, onClose }));
      await screen.findByRole("listitem", { name: "Quads, Primary · counts 1 set" });

      // Closed, the hook has no map for the exercise and reports loading, which must not reach the screen.
      await rerender(sheetOf({ exercise: null, onClose }));

      expect(screen.queryByRole("status")).not.toBeOnTheScreen();
      expect(screen.getByRole("heading", { name: "Leg Press" })).toBeOnTheScreen();
      expect(screen.getAllByRole("listitem")).toHaveLength(3);
      expect(screen.getByText(EXERCISE_MUSCLES.explanation)).toBeOnTheScreen();
    });

    it("should keep a failed read on show while the sheet closes", async () => {
      exerciseRead = "fail";
      const { rerender } = await render(sheetOf({ exercise: legPressUnknown, onClose }));
      await screen.findByText(EXERCISE_MUSCLES.failed);

      await rerender(sheetOf({ exercise: null, onClose }));

      expect(screen.queryByRole("status")).not.toBeOnTheScreen();
      expect(screen.getByText(EXERCISE_MUSCLES.failed)).toBeOnTheScreen();
    });

    it("should show the next exercise when the sheet opens on another", async () => {
      const { rerender } = await render(sheetOf({ exercise: legPress, onClose }));
      await rerender(sheetOf({ exercise: null, onClose }));

      await rerender(sheetOf({ exercise: curl, onClose }));

      await waitFor(() => {
        expect(screen.getByRole("heading", { name: "Biceps Curl" })).toBeOnTheScreen();
      });
      expect(screen.queryByRole("heading", { name: "Leg Press" })).not.toBeOnTheScreen();
      expect(screen.getAllByRole("listitem")).toHaveLength(1);
    });
  });
});
