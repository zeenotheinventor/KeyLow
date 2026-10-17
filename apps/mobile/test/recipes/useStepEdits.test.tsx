import { MAX_RECIPE_STEPS, newRecipeDraft } from "@keylow/core/recipes";
import { render, screen, userEvent } from "@testing-library/react-native";
import { useState } from "react";
import { AccessibilityInfo, Text } from "react-native";
import { setUpTests } from "react-native-reanimated";

import { useStepEdits } from "../../components/RecipeEditor/useStepEdits";
import { ToastProvider } from "../../components/ui";
import { ThemeProvider } from "../../lib/theme";
import { compileKitStyles } from "../support/kitStyles";
import { registerAppStyles } from "../support/nativeWindStyles";

import type { RecipeDraft } from "@keylow/core/recipes";

// The list changes the editor's Instructions section makes, and the Undo that follows a removal. The list is
// core's, so these tests are about what the hook does around it: a full list, a list that changed since.

jest.mock("@react-native-async-storage/async-storage", () => ({
  __esModule: true,
  default: { getItem: () => Promise.resolve(null), setItem: () => Promise.resolve() },
}));
jest.mock(
  "react-native-safe-area-context",
  () =>
    jest.requireActual<{ default: unknown }>("react-native-safe-area-context/jest/mock").default,
);

setUpTests();

// A screen holding a draft, with a button for each thing the hook does and one for an edit made elsewhere,
// such as the step sheet adding a step.
function Harness({ start }: { start: RecipeDraft }) {
  const [draft, setDraft] = useState(start);
  const edits = useStepEdits(draft.steps, setDraft);

  return (
    <>
      <Text accessibilityLabel="In the draft">{draft.steps.join(", ")}</Text>
      <Text accessibilityLabel="Number in the draft">{draft.steps.length}</Text>
      <Text
        onPress={() => {
          edits.remove(1);
        }}
      >
        Remove second
      </Text>
      <Text
        onPress={() => {
          edits.remove(5);
        }}
      >
        Remove sixth
      </Text>
      <Text
        onPress={() => {
          edits.replace(0, "Replaced");
        }}
      >
        Replace first
      </Text>
      <Text
        onPress={() => {
          edits.replace(9, "Replaced");
        }}
      >
        Replace tenth
      </Text>
      <Text
        onPress={() => {
          edits.add("Added");
        }}
      >
        Add one
      </Text>
      <Text
        onPress={() => {
          edits.moveUp(1);
        }}
      >
        Move second up
      </Text>
      <Text
        onPress={() => {
          edits.moveUp(0);
        }}
      >
        Move first up
      </Text>
      <Text
        onPress={() => {
          edits.moveDown(1);
        }}
      >
        Move second down
      </Text>
      <Text
        onPress={() => {
          edits.moveDown(2);
        }}
      >
        Move last down
      </Text>
      <Text
        onPress={() => {
          setDraft((current) => ({ ...current, steps: [...current.steps, "Added elsewhere"] }));
        }}
      >
        Add elsewhere
      </Text>
    </>
  );
}

async function showHarness(steps: string[]) {
  const user = userEvent.setup({ advanceTimers: jest.advanceTimersByTime });
  await render(
    <ThemeProvider fixedPreference="dark">
      <ToastProvider>
        <Harness start={{ ...newRecipeDraft("Frittata"), steps }} />
      </ToastProvider>
    </ThemeProvider>,
  );
  return user;
}

const inTheDraft = () => screen.getByLabelText("In the draft");
const count = () => screen.getByLabelText("Number in the draft");
const undo = () => screen.getByRole("button", { name: "Undo" });

describe("useStepEdits", () => {
  let kitStyles: string;

  beforeAll(async () => {
    kitStyles = await compileKitStyles();
  });

  beforeEach(() => {
    jest.useFakeTimers();
    registerAppStyles(kitStyles);
    jest.spyOn(AccessibilityInfo, "announceForAccessibility").mockImplementation(() => undefined);
    jest.spyOn(AccessibilityInfo, "isReduceMotionEnabled").mockResolvedValue(false);
  });

  afterEach(() => {
    jest.useRealTimers();
    jest.restoreAllMocks();
  });

  const three = () => ["Rinse", "Chop", "Fry"];

  it("should replace the step in its place", async () => {
    const user = await showHarness(three());

    await user.press(screen.getByText("Replace first"));

    expect(inTheDraft()).toHaveTextContent("Replaced, Chop, Fry");
  });

  it("should add the step at the end", async () => {
    const user = await showHarness(three());

    await user.press(screen.getByText("Add one"));

    expect(inTheDraft()).toHaveTextContent("Rinse, Chop, Fry, Added");
  });

  it("should move a step up a place", async () => {
    const user = await showHarness(three());

    await user.press(screen.getByText("Move second up"));

    expect(inTheDraft()).toHaveTextContent("Chop, Rinse, Fry");
  });

  it("should move a step down a place", async () => {
    const user = await showHarness(three());

    await user.press(screen.getByText("Move second down"));

    expect(inTheDraft()).toHaveTextContent("Rinse, Fry, Chop");
  });

  it("should not move the first step up, nor the last step down, and not throw", async () => {
    const user = await showHarness(three());

    await user.press(screen.getByText("Move first up"));
    await user.press(screen.getByText("Move last down"));

    expect(inTheDraft()).toHaveTextContent("Rinse, Chop, Fry");
  });

  it("should remove the step at once and say so with an Undo", async () => {
    const user = await showHarness(three());

    await user.press(screen.getByText("Remove second"));

    expect(inTheDraft()).toHaveTextContent("Rinse, Fry");
    expect(screen.getByText("Step removed")).toBeOnTheScreen();
    expect(undo()).toBeOnTheScreen();
  });

  it("should put the same step back in its place on Undo", async () => {
    const user = await showHarness(three());
    await user.press(screen.getByText("Remove second"));

    await user.press(undo());

    expect(inTheDraft()).toHaveTextContent("Rinse, Chop, Fry");
  });

  it("should put the last step back at the end", async () => {
    const user = await showHarness(["A", "B", "C", "D", "E", "F"]);
    await user.press(screen.getByText("Remove sixth"));

    await user.press(undo());

    expect(inTheDraft()).toHaveTextContent("A, B, C, D, E, F");
  });

  it("should put it back in the list as it is by then, when another edit was made after the removal", async () => {
    const user = await showHarness(three());
    await user.press(screen.getByText("Remove second"));
    await user.press(screen.getByText("Add elsewhere"));

    await user.press(undo());

    expect(inTheDraft()).toHaveTextContent("Rinse, Chop, Fry, Added elsewhere");
  });

  describe("at the limit", () => {
    const full = () => Array.from({ length: MAX_RECIPE_STEPS }, (_, place) => `Step ${place}`);

    it("should say there is no room, and change nothing, when Undo comes after the list was filled again", async () => {
      const user = await showHarness(full());
      await user.press(screen.getByText("Remove second"));
      await user.press(screen.getByText("Add elsewhere"));
      expect(count()).toHaveTextContent(String(MAX_RECIPE_STEPS));

      await user.press(undo());

      expect(count()).toHaveTextContent(String(MAX_RECIPE_STEPS));
      expect(inTheDraft()).not.toHaveTextContent(/Step 1,/);
      expect(screen.getByText("Up to 50 steps")).toBeOnTheScreen();
    });

    it("should add nothing, and not throw, to a list that is full", async () => {
      const user = await showHarness(full());

      await user.press(screen.getByText("Add one"));

      expect(count()).toHaveTextContent(String(MAX_RECIPE_STEPS));
      expect(inTheDraft()).not.toHaveTextContent(/Added/);
    });

    it("should still put the step back when there is room", async () => {
      const user = await showHarness(full());
      await user.press(screen.getByText("Remove second"));

      await user.press(undo());

      expect(count()).toHaveTextContent(String(MAX_RECIPE_STEPS));
      expect(inTheDraft()).toHaveTextContent("Step 0, Step 1, Step 2,", { exact: false });
    });
  });

  it("should leave the draft alone for a place that is not in the list", async () => {
    const user = await showHarness(["Rinse", "Chop"]);

    await user.press(screen.getByText("Remove sixth"));
    await user.press(screen.getByText("Replace tenth"));

    expect(inTheDraft()).toHaveTextContent("Rinse, Chop");
    expect(screen.queryByText("Step removed")).not.toBeOnTheScreen();
  });
});
