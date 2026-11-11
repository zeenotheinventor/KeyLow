import { describe, expect, it } from "vitest";

import {
  FREE_EXERCISE_DB_COMMIT,
  exerciseFormMediaDisplayOf,
  exerciseFormMediaOf,
  freeExerciseDbImagePathSchema,
  freeExerciseDbImageUrl,
  shownExerciseFormMediaSchema,
  youtubeThumbnailUrl,
  youtubeVideoIdSchema,
  youtubeWatchUrl,
} from "../../src/training";

const VIDEO_ID = "aB3_-xYz012";

const videoRow = {
  video_id: VIDEO_ID,
  video_title: "Barbell squat form",
  video_channel: "Form Channel",
  image_paths: ["Barbell_Squat/0.jpg", "Barbell_Squat/1.jpg"],
};

describe("FREE_EXERCISE_DB_COMMIT", () => {
  it("should be the commit the exercise library was imported from", () => {
    expect(FREE_EXERCISE_DB_COMMIT).toBe("f00c92c7dcf1216a928a52c3706c7ce8e2f71ed5");
  });
});

describe("youtubeVideoIdSchema", () => {
  it.each(["aB3_-xYz012", "00000000000", "___________", "-----------"])(
    "should accept %s",
    (id) => {
      expect(youtubeVideoIdSchema.safeParse(id).success).toBe(true);
    },
  );

  it.each(["", "short", "aB3_-xYz0123", "aB3_-xYz01!", "aB3_-xYz01 ", "aB3_-xYz01\n"])(
    "should refuse %j",
    (id) => {
      expect(youtubeVideoIdSchema.safeParse(id).success).toBe(false);
    },
  );
});

describe("freeExerciseDbImagePathSchema", () => {
  it.each(["Barbell_Squat/0.jpg", "3_4_Sit-Up/1.jpg", "Ab_Roller/12.jpg"])(
    "should accept %s",
    (path) => {
      expect(freeExerciseDbImagePathSchema.safeParse(path).success).toBe(true);
    },
  );

  it.each([
    "",
    "Barbell_Squat",
    "Barbell_Squat/0.png",
    "../Barbell_Squat/0.jpg",
    "Barbell_Squat/../0.jpg",
    "/Barbell_Squat/0.jpg",
    "Barbell_Squat/0.jpg?x=1",
    "Barbell Squat/0.jpg",
    "https://example.com/Barbell_Squat/0.jpg",
    "Barbell_Squat/0.jpg\n",
  ])("should refuse %j", (path) => {
    expect(freeExerciseDbImagePathSchema.safeParse(path).success).toBe(false);
  });
});

describe("shownExerciseFormMediaSchema", () => {
  it("should accept a video with its id, title and channel", () => {
    const shown = { kind: "video", videoId: VIDEO_ID, title: "Squat", channel: "Channel" };

    expect(shownExerciseFormMediaSchema.parse(shown)).toEqual(shown);
  });

  it("should accept photos with a start and an end path", () => {
    const shown = { kind: "photos", imagePaths: ["A_B/0.jpg", "A_B/1.jpg"] };

    expect(shownExerciseFormMediaSchema.parse(shown)).toEqual(shown);
  });

  it.each([
    ["none, which is nothing to show", { kind: "none" }],
    [
      "a video with an extra key",
      { kind: "video", videoId: VIDEO_ID, title: "t", channel: "c", url: "x" },
    ],
    ["a video with a bad id", { kind: "video", videoId: "bad", title: "t", channel: "c" }],
    ["a video with a blank title", { kind: "video", videoId: VIDEO_ID, title: "", channel: "c" }],
    ["photos with one path", { kind: "photos", imagePaths: ["A_B/0.jpg"] }],
    ["photos with three paths", { kind: "photos", imagePaths: ["A/0.jpg", "A/1.jpg", "A/2.jpg"] }],
    ["photos with a url", { kind: "photos", imagePaths: ["https://x.test/0.jpg", "A/1.jpg"] }],
  ])("should refuse %s", (_label, shown) => {
    expect(shownExerciseFormMediaSchema.safeParse(shown).success).toBe(false);
  });
});

describe("exerciseFormMediaOf", () => {
  it("should give the video when the row has a valid id, a title and a channel", () => {
    expect(exerciseFormMediaOf(videoRow)).toEqual({
      kind: "video",
      videoId: VIDEO_ID,
      title: "Barbell squat form",
      channel: "Form Channel",
    });
  });

  it("should give the photos when the row has no video", () => {
    const row = { ...videoRow, video_id: null, video_title: null, video_channel: null };

    expect(exerciseFormMediaOf(row)).toEqual({
      kind: "photos",
      imagePaths: ["Barbell_Squat/0.jpg", "Barbell_Squat/1.jpg"],
    });
  });

  it.each([
    ["an invalid video id", { video_id: "not-valid" }],
    ["a blank title", { video_title: "   " }],
    ["a missing title", { video_title: null }],
    ["a blank channel", { video_channel: "" }],
    ["a missing channel", { video_channel: null }],
  ])("should fall back to the photos for %s", (_label, change) => {
    expect(exerciseFormMediaOf({ ...videoRow, ...change })).toEqual({
      kind: "photos",
      imagePaths: ["Barbell_Squat/0.jpg", "Barbell_Squat/1.jpg"],
    });
  });

  it("should take the first valid path as the start and the last as the end", () => {
    const row = {
      ...videoRow,
      video_id: null,
      image_paths: ["A_B/0.jpg", "A_B/1.jpg", "A_B/2.jpg"],
    };

    expect(exerciseFormMediaOf(row)).toEqual({
      kind: "photos",
      imagePaths: ["A_B/0.jpg", "A_B/2.jpg"],
    });
  });

  it("should drop an invalid path and still use the valid ones", () => {
    const row = {
      ...videoRow,
      video_id: null,
      image_paths: ["A_B/0.jpg", "../x.jpg", "A_B/1.jpg"],
    };

    expect(exerciseFormMediaOf(row)).toEqual({
      kind: "photos",
      imagePaths: ["A_B/0.jpg", "A_B/1.jpg"],
    });
  });

  it.each([
    ["no paths", []],
    ["one path", ["A_B/0.jpg"]],
    ["one valid path among invalid ones", ["A_B/0.jpg", "nope", "../x.jpg"]],
  ])("should give none for no video and %s", (_label, imagePaths) => {
    const row = { ...videoRow, video_id: null, image_paths: imagePaths };

    expect(exerciseFormMediaOf(row)).toEqual({ kind: "none" });
  });

  it("should give none for a missing row", () => {
    expect(exerciseFormMediaOf(null)).toEqual({ kind: "none" });
  });

  it("should give none for a row with no paths at all", () => {
    expect(exerciseFormMediaOf({ ...videoRow, video_id: null, image_paths: null })).toEqual({
      kind: "none",
    });
  });
});

describe("the URL builders", () => {
  it("should build the YouTube watch URL", () => {
    expect(youtubeWatchUrl(VIDEO_ID)).toBe("https://www.youtube.com/watch?v=aB3_-xYz012");
  });

  it("should build the YouTube thumbnail URL", () => {
    expect(youtubeThumbnailUrl(VIDEO_ID)).toBe("https://i.ytimg.com/vi/aB3_-xYz012/hqdefault.jpg");
  });

  it("should build the commit-pinned free-exercise-db image URL", () => {
    expect(freeExerciseDbImageUrl("Barbell_Squat/0.jpg")).toBe(
      "https://raw.githubusercontent.com/yuhonas/free-exercise-db/f00c92c7dcf1216a928a52c3706c7ce8e2f71ed5/exercises/Barbell_Squat/0.jpg",
    );
  });
});

describe("exerciseFormMediaDisplayOf", () => {
  it("should give the title, channel, thumbnail and watch URLs of a video", () => {
    expect(
      exerciseFormMediaDisplayOf({
        kind: "video",
        videoId: VIDEO_ID,
        title: "Barbell squat form",
        channel: "Form Channel",
      }),
    ).toEqual({
      kind: "video",
      title: "Barbell squat form",
      channel: "Form Channel",
      thumbnailUrl: "https://i.ytimg.com/vi/aB3_-xYz012/hqdefault.jpg",
      watchUrl: "https://www.youtube.com/watch?v=aB3_-xYz012",
    });
  });

  it("should give the start and end URLs of photos", () => {
    expect(
      exerciseFormMediaDisplayOf({
        kind: "photos",
        imagePaths: ["Barbell_Squat/0.jpg", "Barbell_Squat/1.jpg"],
      }),
    ).toEqual({
      kind: "photos",
      startUrl:
        "https://raw.githubusercontent.com/yuhonas/free-exercise-db/f00c92c7dcf1216a928a52c3706c7ce8e2f71ed5/exercises/Barbell_Squat/0.jpg",
      endUrl:
        "https://raw.githubusercontent.com/yuhonas/free-exercise-db/f00c92c7dcf1216a928a52c3706c7ce8e2f71ed5/exercises/Barbell_Squat/1.jpg",
    });
  });

  it("should give none for none", () => {
    expect(exerciseFormMediaDisplayOf({ kind: "none" })).toEqual({ kind: "none" });
  });
});
