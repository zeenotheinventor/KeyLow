import { buildAssistantSheetThread } from "@keylow/core";
import { describeExerciseMusclesFigureLabel, EXERCISE_MUSCLES } from "@keylow/core/copy";
import { BODY_ARTWORK } from "@keylow/core/training";
import { act, cleanup, render, screen } from "@testing-library/react-native";
import { setUpTests } from "react-native-reanimated";

import { AssistantThread } from "../components/AssistantSheet/AssistantThread";
import { ExerciseMusclesEntry } from "../components/AssistantSheet/ExerciseMusclesEntry";
import { resetBody3DSupportForTests } from "../components/BodyView/testing";
import { resetBodyFigureForTests } from "../lib/bodyFigure/testing";
import { resetBodyMapRendererForTests } from "../lib/bodyMapRenderer/testing";
import { ThemeProvider } from "../lib/theme";
import { compileKitStyles } from "./support/kitStyles";
import { registerAppStyles } from "./support/nativeWindStyles";

import type { Body3DProps } from "../components/ui";
import type { AssistantExerciseMuscles } from "@keylow/core";
import type { BodyArtworkFigure } from "@keylow/core/training";

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

// GL does not run in Jest. The stand-in records that the 3D body was asked for, which this card never does.
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

setUpTests();

const romanianDeadlift: AssistantExerciseMuscles = {
  exerciseName: "Romanian Deadlift",
  muscles: [
    { muscle_id: "hamstrings", role: "primary" },
    { muscle_id: "lower_back", role: "secondary" },
    { muscle_id: "glute_max", role: "secondary" },
    { muscle_id: "calves", role: "stabiliser" },
  ],
};

const seatedLegCurl: AssistantExerciseMuscles = {
  exerciseName: "Seated Leg Curl",
  muscles: [{ muscle_id: "hamstrings", role: "primary" }],
};

const figureName = (name: string, side: "front" | "back") =>
  describeExerciseMusclesFigureLabel({ name, side });

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

const inTheme = (children: React.ReactNode) => (
  <ThemeProvider fixedPreference="dark">{children}</ThemeProvider>
);

describe("the muscles of an exercise in the assistant thread", () => {
  let kitStyles: string;

  beforeAll(async () => {
    kitStyles = await compileKitStyles("", [
      "components/AssistantSheet",
      "components/ExerciseMusclesSheet",
    ]);
  });

  beforeEach(() => {
    registerAppStyles(kitStyles);
    mockStorageItems.clear();
    mockGetItem.mockReset();
    mockGetItem.mockImplementation(mockReadItem);
    mockBody3D.mockClear();
    resetBodyFigureForTests();
    resetBodyMapRendererForTests();
    resetBody3DSupportForTests();
  });

  afterEach(async () => {
    await cleanup();
  });

  describe("the card", () => {
    it("should have the exercise as its heading, with the caption under it", async () => {
      await render(inTheme(<ExerciseMusclesEntry exercise={romanianDeadlift} />));

      expect(screen.getByRole("heading", { name: "Romanian Deadlift" })).toBeOnTheScreen();
      expect(screen.getByText(EXERCISE_MUSCLES.caption)).toBeOnTheScreen();
    });

    it("should draw the front and the back, each named for the exercise", async () => {
      await render(inTheme(<ExerciseMusclesEntry exercise={romanianDeadlift} />));

      expect(
        await screen.findByRole("img", { name: figureName("Romanian Deadlift", "front") }),
      ).toBeOnTheScreen();
      expect(
        screen.getByRole("img", { name: figureName("Romanian Deadlift", "back") }),
      ).toBeOnTheScreen();
      expect(screen.getAllByRole("img")).toHaveLength(2);
    });

    it("should list one row for each role, named in words, under the list's label", async () => {
      await render(inTheme(<ExerciseMusclesEntry exercise={romanianDeadlift} />));

      // A list is not an accessibility element to Testing Library, so it is found by its label.
      expect(screen.getByLabelText(EXERCISE_MUSCLES.listLabel)).toHaveProp("role", "list");
      expect(screen.getAllByRole("listitem")).toHaveLength(3);
      expect(
        screen.getByRole("listitem", { name: "Hamstrings, Primary · counts 1 set" }),
      ).toBeOnTheScreen();
      expect(
        screen.getByRole("listitem", { name: "Lower back, Glutes, Secondary · counts half" }),
      ).toBeOnTheScreen();
      expect(
        screen.getByRole("listitem", { name: "Calves, Assisting · counts a fifth" }),
      ).toBeOnTheScreen();
    });

    it("should give a map with one role one row", async () => {
      await render(inTheme(<ExerciseMusclesEntry exercise={seatedLegCurl} />));

      expect(screen.getAllByRole("listitem")).toHaveLength(1);
      expect(
        screen.getByRole("listitem", { name: "Hamstrings, Primary · counts 1 set" }),
      ).toBeOnTheScreen();
    });

    it("should hold no button and leave the explanation to the sheet", async () => {
      await render(inTheme(<ExerciseMusclesEntry exercise={romanianDeadlift} />));
      await screen.findAllByRole("img");

      expect(screen.queryAllByRole("button")).toHaveLength(0);
      expect(screen.queryByText(EXERCISE_MUSCLES.explanation)).not.toBeOnTheScreen();
    });

    it("should draw the male figure when none was chosen", async () => {
      await render(inTheme(<ExerciseMusclesEntry exercise={romanianDeadlift} />));
      const front = figureName("Romanian Deadlift", "front");

      expect(await screen.findByRole("img", { name: front })).toBeOnTheScreen();
      expect(drawnBody(front)).toBe("male");
    });

    it("should draw the female figure when that is the setting", async () => {
      mockStorageItems.set("bodyMap.figure", "female");
      await render(inTheme(<ExerciseMusclesEntry exercise={romanianDeadlift} />));
      const front = figureName("Romanian Deadlift", "front");

      expect(await screen.findByRole("img", { name: front })).toBeOnTheScreen();
      expect(drawnBody(front)).toBe("female");
    });

    it("should not draw a figure until the stored setting has been read", async () => {
      let finishRead: (value: string | null) => void = () => undefined;
      mockGetItem.mockImplementation(
        () =>
          new Promise<string | null>((resolve) => {
            finishRead = resolve;
          }),
      );

      await render(inTheme(<ExerciseMusclesEntry exercise={romanianDeadlift} />));

      expect(screen.queryAllByRole("img")).toHaveLength(0);
      expect(screen.getByRole("heading", { name: "Romanian Deadlift" })).toBeOnTheScreen();
      await act(() => {
        finishRead("female");
      });
      const front = figureName("Romanian Deadlift", "front");
      expect(await screen.findByRole("img", { name: front })).toBeOnTheScreen();
      expect(drawnBody(front)).toBe("female");
    });

    it("should stay 2D when 3D is chosen in More, with no stage and no side switch", async () => {
      mockStorageItems.set("bodyMap.renderer", "3d");
      await render(inTheme(<ExerciseMusclesEntry exercise={romanianDeadlift} />));

      expect(await screen.findAllByRole("img")).toHaveLength(2);
      expect(mockBody3D).not.toHaveBeenCalled();
      expect(screen.queryAllByRole("radio")).toHaveLength(0);
    });
  });

  describe("the thread", () => {
    it("should draw two cards for two entries, after the reply", async () => {
      const thread = buildAssistantSheetThread({
        items: [
          { kind: "user", id: "u1", text: "Which works my hamstrings more?" },
          {
            kind: "reply",
            id: "r1",
            text: "Both count a full set for your hamstrings.",
            answerMeta: null,
            stopped: false,
          },
          { kind: "exercise_muscles", id: "e1", exercise: romanianDeadlift },
          { kind: "exercise_muscles", id: "e2", exercise: seatedLegCurl },
        ],
        sent: null,
        live: null,
        isStreaming: false,
      });

      await render(
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
        ),
      );

      expect(await screen.findAllByRole("heading")).toHaveLength(2);
      expect(screen.getByRole("heading", { name: "Romanian Deadlift" })).toBeOnTheScreen();
      expect(screen.getByRole("heading", { name: "Seated Leg Curl" })).toBeOnTheScreen();
      expect(screen.getAllByLabelText(EXERCISE_MUSCLES.listLabel)).toHaveLength(2);
      expect(screen.getAllByRole("img")).toHaveLength(4);
      expect(screen.getByText("Both count a full set for your hamstrings.")).toBeOnTheScreen();
    });
  });
});
