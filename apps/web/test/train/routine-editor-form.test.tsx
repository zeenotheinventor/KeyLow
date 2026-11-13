import {
  EXERCISE_FORM,
  EXERCISE_MUSCLES,
  ROUTINE_EDITOR,
  describeFormAndMusclesButton,
  describeMoveExercise,
  describeRemoveExercise,
  describeFormVideoLink,
} from "@keylow/core/copy";
import { cleanup, fireEvent, screen, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import {
  formMediaBackend,
  noRows,
  photosRow,
  resetFormMediaBackend,
  serveFormMedia,
  videoRow,
} from "./formMediaBackend";
import { goldenRoutine, renderWithTrain, resetTrainBackend, trainBackend } from "./support";

import { RoutineEditorScreen } from "@/components/train/RoutineEditorScreen";
import { ToastProvider } from "@/components/ui/Toast";
import { resetBodyFigureForTests } from "@/lib/bodyFigure/testing";

const router = vi.hoisted(() => ({ push: vi.fn(), replace: vi.fn() }));
vi.mock("next/navigation", () => ({ useRouter: () => router }));

/** The row of Barbell Squat in the Legs day, the first of its exercises. */
const squatRow = async () => {
  const legs = await screen.findByRole("region", { name: "Legs, Thu" });
  return within(within(legs).getAllByRole("listitem")[0] ?? legs);
};

/**
 * Serves the muscles of Barbell Squat, whose row in the golden routine is the thin one the plan embeds and has
 * no `source`, which the exercise read the dialog makes needs. Form media is served by the function's own fake.
 */
function serveSquatMuscles() {
  const serveFormMediaRoute = trainBackend.extraRoute;
  trainBackend.extraRoute = (request, url) => {
    if (url.pathname.endsWith("/exercises") && url.searchParams.has("id")) {
      trainBackend.reads.push("exercise");
      // The read asks for one row as an object.
      return new Response(
        JSON.stringify({
          id: url.searchParams.get("id")?.replace("eq.", ""),
          name: "Barbell Squat",
          equipment: "barbell",
          mechanic: "compound",
          source: "free_exercise_db",
          exercise_muscles: [
            { muscle_id: "quads", role: "primary", weight: 1 },
            { muscle_id: "glute_max", role: "secondary", weight: 0.5 },
          ],
        }),
        { status: 200, headers: { "Content-Type": "application/json" } },
      );
    }
    return serveFormMediaRoute?.(request, url) ?? null;
  };
}

async function openEditor() {
  trainBackend.routine = goldenRoutine;
  renderWithTrain(
    <ToastProvider>
      <RoutineEditorScreen id={String(goldenRoutine["id"])} />
    </ToastProvider>,
  );
  await screen.findByRole("textbox", { name: ROUTINE_EDITOR.nameLabel });
}

describe("the form and muscles dialog of the routine editor", () => {
  beforeEach(() => {
    resetTrainBackend();
    resetFormMediaBackend();
    resetBodyFigureForTests();
    serveFormMedia();
    serveSquatMuscles();
    formMediaBackend.rows = [videoRow];
  });

  afterEach(cleanup);

  it("should start each exercise's row actions with Form and muscles, before Move up", async () => {
    await openEditor();
    const row = await squatRow();

    expect(row.getAllByRole("button").map((button) => button.getAttribute("aria-label"))).toEqual([
      null,
      describeFormAndMusclesButton("Barbell Squat"),
      describeMoveExercise("Barbell Squat", "up"),
      describeMoveExercise("Barbell Squat", "down"),
      describeRemoveExercise("Barbell Squat"),
    ]);
    expect(row.getByRole("button", { name: "Barbell Squat" })).toBeTruthy();
  });

  it("should keep the name out of the tab order and the Form and muscles action in it", async () => {
    await openEditor();
    const row = await squatRow();

    expect(row.getByRole("button", { name: "Barbell Squat" }).getAttribute("tabindex")).toBe("-1");
    expect(
      row
        .getByRole("button", { name: describeFormAndMusclesButton("Barbell Squat") })
        .getAttribute("tabindex"),
    ).toBeNull();
  });

  it("should open the dialog with the video from the Form and muscles action", async () => {
    await openEditor();
    const row = await squatRow();

    await userEvent.click(
      row.getByRole("button", { name: describeFormAndMusclesButton("Barbell Squat") }),
    );

    const dialog = await screen.findByRole("dialog", { name: "Barbell Squat" });
    expect(
      await within(dialog).findByRole("link", {
        name: describeFormVideoLink("How to do a barbell bench press", "Strength Basics"),
      }),
    ).toBeTruthy();
    expect(
      await within(dialog).findByRole("list", { name: EXERCISE_MUSCLES.listLabel }),
    ).toBeTruthy();
    expect(document.querySelector("iframe")).toBeNull();
  });

  it("should open the same dialog from the exercise's name", async () => {
    await openEditor();
    const row = await squatRow();

    await userEvent.click(row.getByRole("button", { name: "Barbell Squat" }));

    const dialog = await screen.findByRole("dialog", { name: "Barbell Squat" });
    expect(await within(dialog).findByRole("link")).toBeTruthy();
    expect(
      await within(dialog).findByRole("list", { name: EXERCISE_MUSCLES.listLabel }),
    ).toBeTruthy();
  });

  it("should show the photos for an exercise with photos only", async () => {
    formMediaBackend.rows = [photosRow];
    await openEditor();
    const row = await squatRow();

    await userEvent.click(
      row.getByRole("button", { name: describeFormAndMusclesButton("Barbell Squat") }),
    );

    const dialog = await screen.findByRole("dialog", { name: "Barbell Squat" });
    expect(await within(dialog).findAllByRole("img", { name: /position$/ })).toHaveLength(2);
    expect(within(dialog).queryByRole("link")).toBeNull();
  });

  it("should show only the muscles for an exercise with no form media", async () => {
    formMediaBackend.rows = noRows;
    await openEditor();
    const row = await squatRow();

    await userEvent.click(
      row.getByRole("button", { name: describeFormAndMusclesButton("Barbell Squat") }),
    );

    const dialog = await screen.findByRole("dialog", { name: "Barbell Squat" });
    expect(
      await within(dialog).findByRole("list", { name: EXERCISE_MUSCLES.listLabel }),
    ).toBeTruthy();
    expect(within(dialog).queryByRole("link")).toBeNull();
    expect(within(dialog).queryByText(EXERCISE_FORM.unavailable)).toBeNull();
  });

  it("should give focus back to the action that opened it when the dialog closes", async () => {
    await openEditor();
    const row = await squatRow();
    const opener = row.getByRole("button", { name: describeFormAndMusclesButton("Barbell Squat") });
    // A click that does not focus the button, as Safari's does not, so focus must be given back by the dialog.
    fireEvent.click(opener);
    await screen.findByRole("dialog", { name: "Barbell Squat" });

    await userEvent.keyboard("{Escape}");

    expect(screen.queryByRole("dialog", { name: "Barbell Squat" })).toBeNull();
    expect(document.activeElement).toBe(opener);
  });

  it("should give focus back to the name when it opened the dialog", async () => {
    await openEditor();
    const row = await squatRow();
    const name = row.getByRole("button", { name: "Barbell Squat" });
    fireEvent.click(name);
    await screen.findByRole("dialog", { name: "Barbell Squat" });

    await userEvent.keyboard("{Escape}");

    expect(document.activeElement).toBe(name);
  });

  it("should leave the draft as it was, so closing the dialog asks nothing and saves nothing", async () => {
    await openEditor();
    const row = await squatRow();
    await userEvent.click(
      row.getByRole("button", { name: describeFormAndMusclesButton("Barbell Squat") }),
    );
    await screen.findByRole("dialog", { name: "Barbell Squat" });
    await userEvent.keyboard("{Escape}");

    expect(trainBackend.savedRoutines).toEqual([]);
    expect(screen.queryByRole("dialog")).toBeNull();
  });
});
