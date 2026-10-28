import { KeyLowProvider } from "@keylow/api-client";
import { BODY_MAP, describeExerciseMusclesFigureLabel, EXERCISE_MUSCLES } from "@keylow/core/copy";
import { exerciseRoleValues } from "@keylow/core/training";
import { createClient } from "@supabase/supabase-js";
import { act, cleanup, render, screen, userEvent, waitFor } from "@testing-library/react-native";
import { AccessibilityInfo } from "react-native";
import { setUpTests } from "react-native-reanimated";

import { resetBody3DSupportForTests } from "../components/BodyView/testing";
import { ExerciseMusclesSheet } from "../components/ExerciseMusclesSheet";
import { resetBodyFigureForTests } from "../lib/bodyFigure/testing";
import { resetBodyMapRendererForTests } from "../lib/bodyMapRenderer/testing";
import { ThemeProvider } from "../lib/theme";
import { createDiaryQueryClient } from "./support/diaryBackend";
import { compileKitStyles } from "./support/kitStyles";
import { registerAppStyles } from "./support/nativeWindStyles";
import { resetTrainBackend, trainFetch } from "./support/trainBackend";

import type { ExerciseMusclesSheetProps } from "../components/ExerciseMusclesSheet";
import type { Body3DProps } from "../components/ui";
import type { Database } from "@keylow/api-client";
import type { ExerciseMuscleEntry } from "@keylow/core/schemas";
import type { QueryClient } from "@tanstack/react-query";

const mockStorageItems = new Map<string, string>();
jest.mock("@react-native-async-storage/async-storage", () => ({
  __esModule: true,
  default: {
    getItem: (key: string) => Promise.resolve(mockStorageItems.get(key) ?? null),
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

// A build without expo-gl has no ExpoGL native module. Every other lookup is the real one.
const mockHasGlModule = jest.fn(() => true);
jest.mock("expo", () => {
  const actual = jest.requireActual<typeof import("expo")>("expo");
  return {
    ...actual,
    requireOptionalNativeModule: (name: string): unknown =>
      name === "ExpoGL" && !mockHasGlModule() ? null : actual.requireOptionalNativeModule(name),
  };
});

// GL does not run in Jest. The stand-in is one image with the label it is given, and the tests read the
// props it was drawn with and call the ones the stage listens to.
const mockBody3D = jest.fn<undefined, [Body3DProps]>();
jest.mock("../components/ui/Body3D", () => {
  const { createElement } = jest.requireActual<typeof import("react")>("react");
  const { View } = jest.requireActual<typeof import("react-native")>("react-native");
  return {
    Body3D: (props: Body3DProps) => {
      mockBody3D(props);
      return createElement(View, { accessible: true, "aria-label": props.label, role: "img" });
    },
  };
});

// Stands in for gorhom so a test can see whether the sheet lets a drag on its contents move it. What gorhom
// does with the gesture on a device is in the library's own tests and on the device.
const mockSheet: { canDragFromContent: boolean | undefined } = { canDragFromContent: undefined };
jest.mock("@gorhom/bottom-sheet", () => {
  const { forwardRef, useImperativeHandle } = jest.requireActual<typeof import("react")>("react");
  const FakeSheet = forwardRef<
    unknown,
    { children: React.ReactNode; enableContentPanningGesture: boolean }
  >(function FakeSheet({ children, enableContentPanningGesture }, ref) {
    mockSheet.canDragFromContent = enableContentPanningGesture;
    useImperativeHandle(ref, () => ({ close: () => undefined, snapToIndex: () => undefined }));
    return children;
  });
  return {
    __esModule: true,
    default: FakeSheet,
    BottomSheetView: ({ children }: never) => children,
    BottomSheetTextInput: () => null,
    BottomSheetScrollView: ({ children }: never) => children,
  };
});

setUpTests();

const LEG_PRESS_ID = "00000000-0000-4000-8000-000000000a01";

// Quads primary, glutes and hamstrings secondary, calves assisting: the exercise library's Leg Press.
const LEG_PRESS_MUSCLES: readonly ExerciseMuscleEntry[] = [
  { muscle_id: "quads", role: "primary", weight: 1 },
  { muscle_id: "glute_max", role: "secondary", weight: 0.5 },
  { muscle_id: "hamstrings", role: "secondary", weight: 0.5 },
  { muscle_id: "calves", role: "stabiliser", weight: 0.2 },
];
const legPress = { id: LEG_PRESS_ID, name: "Leg Press", muscles: LEG_PRESS_MUSCLES };
const curl = {
  id: "00000000-0000-4000-8000-000000000a02",
  name: "Biceps Curl",
  muscles: [{ muscle_id: "biceps", role: "primary", weight: 1 }] satisfies ExerciseMuscleEntry[],
};

const client = createClient<Database>("http://localhost:54321", "anon-key", {
  auth: { persistSession: false, autoRefreshToken: false },
  global: { fetch: trainFetch },
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

// The sheet is on the workout screen, closed, long before it is opened, so the stored figure and renderer have been
// read by the time it opens. It is mounted closed and settled, and then opened.
async function renderSheet(props: Partial<ExerciseMusclesSheetProps> = {}) {
  const rendered = await render(sheetOf({ exercise: null, onClose }));
  await act(async () => {
    await Promise.resolve();
  });
  await rendered.rerender(sheetOf({ exercise: legPress, onClose, ...props }));
  return rendered;
}

const lastBody3DProps = (): Body3DProps => {
  const props = mockBody3D.mock.calls.at(-1)?.[0];
  if (props === undefined) {
    throw new Error("The 3D body has not been drawn.");
  }
  return props;
};

async function callBody3D(call: (props: Body3DProps) => void) {
  const props = lastBody3DProps();
  await act(() => {
    call(props);
  });
}

const drawFirstFrame = () =>
  callBody3D((props) => {
    props.onFirstFrame?.();
  });

const frontName = describeExerciseMusclesFigureLabel({ name: "Leg Press", side: "front" });
const backName = describeExerciseMusclesFigureLabel({ name: "Leg Press", side: "back" });
const frontButton = () => screen.getByRole("radio", { name: BODY_MAP.sideSwitch.front });
const backButton = () => screen.getByRole("radio", { name: BODY_MAP.sideSwitch.back });

describe("the Muscles it works sheet in 3D", () => {
  let kitStyles: string;

  beforeAll(async () => {
    kitStyles = await compileKitStyles("", [
      "components/ExerciseMusclesSheet",
      "components/BodyMapFigures",
      "components/BodyView",
    ]);
  });

  beforeEach(() => {
    registerAppStyles(kitStyles);
    resetTrainBackend();
    mockStorageItems.clear();
    mockStorageItems.set("bodyMap.renderer", "3d");
    resetBodyFigureForTests();
    resetBodyMapRendererForTests();
    resetBody3DSupportForTests();
    mockHasGlModule.mockReturnValue(true);
    mockBody3D.mockClear();
    mockSheet.canDragFromContent = undefined;
    onClose.mockClear();
    queryClient = createDiaryQueryClient();
    jest.spyOn(AccessibilityInfo, "isReduceMotionEnabled").mockResolvedValue(false);
  });

  afterEach(async () => {
    await cleanup();
    queryClient.clear();
    jest.restoreAllMocks();
  });

  describe("when 3D is chosen and the phone can draw it", () => {
    it("should draw one body, named for the exercise and the front", async () => {
      await renderSheet();
      await drawFirstFrame();

      expect(screen.getAllByRole("img")).toHaveLength(1);
      expect(screen.getByRole("img", { name: frontName })).toBeOnTheScreen();
    });

    it("should colour the body by role", async () => {
      await renderSheet();

      expect(lastBody3DProps().scale).toBe("role");
      expect(lastBody3DProps().values).toEqual(exerciseRoleValues(LEG_PRESS_MUSCLES));
    });

    it("should offer Front and Back in a control named Side shown, with Front chosen", async () => {
      await renderSheet();

      expect(screen.getByLabelText(BODY_MAP.sideSwitch.name)).toBeOnTheScreen();
      expect(frontButton()).toBeChecked();
      expect(backButton()).not.toBeChecked();
    });

    it("should say to drag and to pinch, and not to long-press, which the sheet does not offer", async () => {
      await renderSheet();

      expect(screen.getByText(EXERCISE_MUSCLES.rotateHint)).toBeOnTheScreen();
      expect(lastBody3DProps().onLongPressMuscle).toBeUndefined();
    });

    it("should turn the body to the back when Back is pressed", async () => {
      await renderSheet();
      await drawFirstFrame();

      await userEvent.press(backButton());

      expect(backButton()).toBeChecked();
      expect(lastBody3DProps().side).toBe("back");
      expect(screen.getByRole("img", { name: backName })).toBeOnTheScreen();
    });

    it("should move to Back when a drag settles the body on the back", async () => {
      await renderSheet();

      await callBody3D((props) => {
        props.onSideChange?.("back");
      });

      expect(backButton()).toBeChecked();
      expect(frontButton()).not.toBeChecked();
    });

    it("should keep the heading, the rows and the explanation", async () => {
      await renderSheet();

      expect(screen.getByRole("heading", { name: "Leg Press" })).toBeOnTheScreen();
      expect(screen.getByText(EXERCISE_MUSCLES.caption)).toBeOnTheScreen();
      expect(screen.getAllByRole("listitem")).toHaveLength(3);
      expect(screen.getByText(EXERCISE_MUSCLES.explanation)).toBeOnTheScreen();
    });

    it("should not let a drag on the contents move the sheet, so a drag turns the body", async () => {
      await renderSheet();

      expect(mockSheet.canDragFromContent).toBe(false);
    });

    it("should draw no body once the sheet has closed", async () => {
      const { rerender } = await renderSheet();
      expect(screen.getAllByRole("img")).toHaveLength(1);

      await rerender(sheetOf({ exercise: null, onClose }));

      await waitFor(() => {
        expect(screen.queryAllByRole("img")).toHaveLength(0);
      });
    });

    it("should draw no body while the sheet has never been opened", async () => {
      await renderSheet({ exercise: null });

      expect(mockBody3D).not.toHaveBeenCalled();
    });
  });

  describe("when the 2D figures are the ones to draw", () => {
    const expectTheTwoFigures = () => {
      expect(screen.queryByRole("radio")).not.toBeOnTheScreen();
      expect(screen.queryByText(EXERCISE_MUSCLES.rotateHint)).not.toBeOnTheScreen();
      expect(screen.getByRole("img", { name: frontName })).toBeOnTheScreen();
      expect(screen.getByRole("img", { name: backName })).toBeOnTheScreen();
      expect(mockBody3D).not.toHaveBeenCalled();
      expect(mockSheet.canDragFromContent).toBe(true);
    };

    it("should draw the front and the back when 2D is chosen", async () => {
      mockStorageItems.set("bodyMap.renderer", "2d");

      await renderSheet();

      expectTheTwoFigures();
    });

    it("should draw the front and the back for the female figure", async () => {
      mockStorageItems.set("bodyMap.figure", "female");

      await renderSheet();

      expectTheTwoFigures();
    });

    it("should draw the front and the back in a build without the GL module", async () => {
      mockHasGlModule.mockReturnValue(false);

      await renderSheet();

      expectTheTwoFigures();
    });

    it("should draw the front and the back the next time, once 3D has failed", async () => {
      const first = await renderSheet();
      await callBody3D((props) => {
        props.onError?.();
      });
      await first.unmount();
      mockBody3D.mockClear();

      await renderSheet();

      expectTheTwoFigures();
    });

    it("should keep the heading, the rows and the explanation", async () => {
      mockStorageItems.set("bodyMap.renderer", "2d");

      await renderSheet();

      expect(screen.getByRole("heading", { name: "Leg Press" })).toBeOnTheScreen();
      expect(screen.getAllByRole("listitem")).toHaveLength(3);
      expect(screen.getByText(EXERCISE_MUSCLES.explanation)).toBeOnTheScreen();
    });
  });

  describe("when 3D fails while the sheet is open", () => {
    it("should keep the stage with the 2D figure of the side shown", async () => {
      await renderSheet();
      await userEvent.press(backButton());

      await callBody3D((props) => {
        props.onError?.();
      });

      expect(screen.getAllByRole("img")).toHaveLength(1);
      expect(screen.getByRole("img", { name: backName })).toBeOnTheScreen();
      expect(backButton()).toBeChecked();
    });

    it("should keep the sheet from moving with a drag on the contents until it is opened again", async () => {
      const { rerender } = await renderSheet();
      await callBody3D((props) => {
        props.onError?.();
      });
      // The library swaps the view that carries the contents when this changes, which would remount them.
      expect(mockSheet.canDragFromContent).toBe(false);

      await rerender(sheetOf({ exercise: null, onClose }));
      expect(mockSheet.canDragFromContent).toBe(false);
      await waitFor(() => {
        expect(screen.queryAllByRole("img")).toHaveLength(0);
      });
      await rerender(sheetOf({ exercise: legPress, onClose }));

      expect(mockSheet.canDragFromContent).toBe(true);
      expect(screen.queryByRole("radio")).not.toBeOnTheScreen();
      expect(screen.getAllByRole("img")).toHaveLength(2);
    });
  });

  describe("when another exercise opens", () => {
    it("should face the body to the front again", async () => {
      const { rerender } = await renderSheet();
      await userEvent.press(backButton());
      expect(backButton()).toBeChecked();

      await rerender(sheetOf({ exercise: curl, onClose }));

      expect(frontButton()).toBeChecked();
      expect(lastBody3DProps().side).toBe("front");
    });
  });
});
