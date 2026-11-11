import { z } from "zod";

/**
 * The commit of the free-exercise-db repository the exercise library was imported from. The photos are
 * served from it, so a photo never changes under a logged set. It must stay equal to `SOURCE_COMMIT` of
 * the import (a test in `@keylow/db` holds the two together).
 */
export const FREE_EXERCISE_DB_COMMIT = "f00c92c7dcf1216a928a52c3706c7ce8e2f71ed5";

const MAX_VIDEO_TITLE_LENGTH = 200;
const MAX_VIDEO_CHANNEL_LENGTH = 100;

/** A YouTube video id: 11 characters of letters, digits, underscore and hyphen. */
export const youtubeVideoIdSchema = z.string().regex(/^[A-Za-z0-9_-]{11}$/);

/** A path of one photo relative to the upstream `exercises/` folder, such as `Barbell_Squat/0.jpg`. */
export const freeExerciseDbImagePathSchema = z.string().regex(/^[A-Za-z0-9_-]+\/[0-9]+\.jpg$/);

/**
 * What an exercise shows for its form: the curated video, the start and end photos, or nothing. Ids and
 * paths only, never URLs, so what is stored or sent stays small and a URL is made in one place.
 */
export type ExerciseFormMedia =
  | { kind: "video"; videoId: string; title: string; channel: string }
  | { kind: "photos"; imagePaths: readonly [start: string, end: string] }
  | { kind: "none" };

/** The two kinds that show something, for a payload that only ever carries a shown one. */
export const shownExerciseFormMediaSchema = z.discriminatedUnion("kind", [
  z.strictObject({
    kind: z.literal("video"),
    videoId: youtubeVideoIdSchema,
    title: z.string().min(1).max(MAX_VIDEO_TITLE_LENGTH),
    channel: z.string().min(1).max(MAX_VIDEO_CHANNEL_LENGTH),
  }),
  z.strictObject({
    kind: z.literal("photos"),
    imagePaths: z.tuple([freeExerciseDbImagePathSchema, freeExerciseDbImagePathSchema]),
  }),
]);

/** One row of the `exercise_form_media` database function. */
export type ExerciseFormMediaRow = {
  video_id: string | null;
  video_title: string | null;
  video_channel: string | null;
  image_paths: readonly string[] | null;
};

const isPresent = (text: string | null): text is string => text !== null && text.trim() !== "";

/**
 * The form media of an exercise from its row: the video when its id is valid and it has a title and a
 * channel, else the photos when at least two paths are valid (the first is the start and the last the
 * end), else none. A bad value never throws, it drops to the next option.
 */
export function exerciseFormMediaOf(row: ExerciseFormMediaRow | null): ExerciseFormMedia {
  if (row === null) {
    return { kind: "none" };
  }
  const { video_id, video_title, video_channel, image_paths } = row;
  if (
    video_id !== null &&
    youtubeVideoIdSchema.safeParse(video_id).success &&
    isPresent(video_title) &&
    isPresent(video_channel)
  ) {
    return { kind: "video", videoId: video_id, title: video_title, channel: video_channel };
  }
  const paths = (image_paths ?? []).filter(
    (path) => freeExerciseDbImagePathSchema.safeParse(path).success,
  );
  const [start] = paths;
  const end = paths.at(-1);
  if (paths.length >= 2 && start !== undefined && end !== undefined) {
    return { kind: "photos", imagePaths: [start, end] };
  }
  return { kind: "none" };
}

/** Where a video plays. The only place a watch URL is made. */
export const youtubeWatchUrl = (videoId: string): string =>
  `https://www.youtube.com/watch?v=${videoId}`;

/** The picture YouTube holds for a video. The only place a thumbnail URL is made. */
export const youtubeThumbnailUrl = (videoId: string): string =>
  `https://i.ytimg.com/vi/${videoId}/hqdefault.jpg`;

/**
 * One free-exercise-db photo at the pinned commit. The only place the photo URL is made, so moving the
 * photos elsewhere later is this function and `FREE_EXERCISE_DB_COMMIT`.
 */
export const freeExerciseDbImageUrl = (imagePath: string): string =>
  `https://raw.githubusercontent.com/yuhonas/free-exercise-db/${FREE_EXERCISE_DB_COMMIT}/exercises/${imagePath}`;

/** The URLs a surface draws, ready to spread into the form media card. */
export type ExerciseFormMediaDisplay =
  | { kind: "video"; title: string; channel: string; thumbnailUrl: string; watchUrl: string }
  | { kind: "photos"; startUrl: string; endUrl: string }
  | { kind: "none" };

/** What a surface draws for its media, with every URL made by the builders above. */
export function exerciseFormMediaDisplayOf(media: ExerciseFormMedia): ExerciseFormMediaDisplay {
  switch (media.kind) {
    case "video":
      return {
        kind: "video",
        title: media.title,
        channel: media.channel,
        thumbnailUrl: youtubeThumbnailUrl(media.videoId),
        watchUrl: youtubeWatchUrl(media.videoId),
      };
    case "photos":
      return {
        kind: "photos",
        startUrl: freeExerciseDbImageUrl(media.imagePaths[0]),
        endUrl: freeExerciseDbImageUrl(media.imagePaths[1]),
      };
    case "none":
      return { kind: "none" };
  }
}
