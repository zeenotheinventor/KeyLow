import { NONCE, SESSION_ID, EXERCISE_ID } from "../../../test/support/widgetFixtures";
import {
  pendingUndoOf,
  quickLogSnapshot,
  readyModel,
  readySource,
  sessionSnapshot,
} from "../test/viewModels";
import {
  backgroundColours,
  borderColourOf,
  colourOfText,
  customTaps,
  taps,
  textsOf,
  treeOf,
} from "../test/widgetTree";
import { widgetThemeFor } from "../theme";
import { TrainingWidget } from "./TrainingWidget";

describe.each(["dark", "light"] as const)("the Training widget in %s", (scheme) => {
  const theme = widgetThemeFor(scheme);

  describe("with a day planned", () => {
    const viewModel = readyModel("training", readySource(quickLogSnapshot()));
    const tree = treeOf(<TrainingWidget viewModel={viewModel} theme={theme} />);

    it("should draw the day, what is in it and the two start buttons", () => {
      expect(textsOf(tree)).toEqual([
        "TRAIN · TODAY",
        "Pull day",
        "5 exercises · Rows, Pull-ups, Curls and 2 more",
        "Start session",
        "Empty session",
      ]);
      expect(colourOfText(tree, "Start session")).toBe(theme.palette.onAccent);
      expect(backgroundColours(tree)).toContain(theme.palette.accent);
    });

    it("should open Train from the card and start the session through links that carry the nonce", () => {
      expect(taps(tree).map((tap) => tap.uri)).toEqual([
        "keylow://train",
        `keylow://session?start=planned&nonce=${NONCE}`,
        `keylow://session?start=empty&nonce=${NONCE}`,
      ]);
      expect(customTaps(tree)).toEqual([]);
    });
  });

  describe("with a session running", () => {
    const viewModel = readyModel("training", readySource(sessionSnapshot()));
    const tree = treeOf(<TrainingWidget viewModel={viewModel} theme={theme} />);

    it("should draw the eyebrow in the accent colour inside an accent border", () => {
      expect(colourOfText(tree, "IN SESSION · 32 MIN")).toBe(theme.palette.accent);
      expect(borderColourOf(tree)).toBe(theme.palette.accent);
    });

    it("should draw the exercise, the set, the prefilled load and reps and last time", () => {
      expect(textsOf(tree)).toEqual([
        "IN SESSION · 32 MIN",
        "Exercise 2 of 5",
        "Barbell row",
        "Set 3 of 4",
        "70",
        "kg",
        "×",
        "8",
        "reps",
        "Last time 67.5 × 8",
        "Log set",
      ]);
    });

    it("should log the set with only ids and the set position in the click data", () => {
      expect(customTaps(tree)).toEqual([
        {
          action: "LOG_SET",
          data: { sessionId: SESSION_ID, exerciseId: EXERCISE_ID, setNumber: 3 },
          label: "Log set",
        },
      ]);
    });

    it("should show Logged with Undo in place of the button while the window is open", () => {
      const withUndo = readyModel("training", readySource(sessionSnapshot()), {
        pendingUndo: pendingUndoOf("log_set"),
      });
      const undoTree = treeOf(<TrainingWidget viewModel={withUndo} theme={theme} />);

      expect(textsOf(undoTree).slice(-2)).toEqual(["Logged", "Undo"]);
      expect(textsOf(undoTree)).not.toContain("Log set");
      expect(customTaps(undoTree).map((tap) => tap.action)).toEqual(["UNDO"]);
    });
  });
});
