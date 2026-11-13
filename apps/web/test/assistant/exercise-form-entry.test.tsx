import { EXERCISE_FORM, describeFormPhoto, describeFormVideoLink } from "@keylow/core/copy";
import { cleanup, render, screen } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import type { ExerciseFormEntryProps } from "@/components/assistant/ExerciseFormEntry";

import { ExerciseFormEntry } from "@/components/assistant/ExerciseFormEntry";

const videoEntry: ExerciseFormEntryProps["entry"] = {
  kind: "exerciseFormMedia",
  key: "form-1",
  exercise: {
    exerciseName: "Barbell back squat",
    media: {
      kind: "video",
      videoId: "abcdefghijk",
      title: "How to do a barbell back squat",
      channel: "Strength Basics",
    },
  },
};

const photosEntry: ExerciseFormEntryProps["entry"] = {
  kind: "exerciseFormMedia",
  key: "form-2",
  exercise: {
    exerciseName: "Romanian deadlift",
    media: { kind: "photos", imagePaths: ["Romanian_Deadlift/0.jpg", "Romanian_Deadlift/1.jpg"] },
  },
};

describe("ExerciseFormEntry", () => {
  beforeEach(() => {
    vi.stubGlobal("matchMedia", (query: string) => ({
      matches: false,
      media: query,
      addEventListener: () => undefined,
      removeEventListener: () => undefined,
    }));
  });

  afterEach(() => {
    cleanup();
    vi.unstubAllGlobals();
  });

  it("should draw a video as a link to its watch address, made by core from the id", () => {
    render(<ExerciseFormEntry entry={videoEntry} />);

    const link = screen.getByRole("link", {
      name: describeFormVideoLink("How to do a barbell back squat", "Strength Basics"),
    });
    expect(link.getAttribute("href")).toBe("https://www.youtube.com/watch?v=abcdefghijk");
    expect(link.getAttribute("target")).toBe("_blank");
    expect(
      screen.getByRole("img", { name: "How to do a barbell back squat" }).getAttribute("src"),
    ).toBe("https://i.ytimg.com/vi/abcdefghijk/hqdefault.jpg");
    expect(screen.getByText(EXERCISE_FORM.opensInYouTube)).toBeTruthy();
  });

  it("should draw the start and end photos, named for the exercise, when there is no video", () => {
    render(<ExerciseFormEntry entry={photosEntry} />);

    expect(
      screen
        .getByRole("img", { name: describeFormPhoto("Romanian deadlift", "start") })
        .getAttribute("src"),
    ).toContain("/exercises/Romanian_Deadlift/0.jpg");
    expect(
      screen
        .getByRole("img", { name: describeFormPhoto("Romanian deadlift", "end") })
        .getAttribute("src"),
    ).toContain("/exercises/Romanian_Deadlift/1.jpg");
    expect(screen.queryByRole("link")).toBeNull();
  });

  it("should draw nothing when the media is neither", () => {
    // The schema refuses a `none` media, so the type cannot say it. The entry still has to draw nothing for it.
    const neither = {
      ...videoEntry,
      exercise: { ...videoEntry.exercise, media: { kind: "none" } },
    } as unknown as ExerciseFormEntryProps["entry"];

    const { container } = render(<ExerciseFormEntry entry={neither} />);

    expect(container.childElementCount).toBe(0);
  });
});
