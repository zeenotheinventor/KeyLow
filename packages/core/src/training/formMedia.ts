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

const imagePathsSchema = z.tuple([freeExerciseDbImagePathSchema, freeExerciseDbImagePathSchema]);

/**
 * The two kinds that show something, for a payload that only ever carries a shown one. A video may also
 * carry the two photo paths, for a surface that shows both.
 */
export const shownExerciseFormMediaSchema = z.discriminatedUnion("kind", [
  z.strictObject({
    kind: z.literal("video"),
    videoId: youtubeVideoIdSchema,
    title: z.string().min(1).max(MAX_VIDEO_TITLE_LENGTH),
    channel: z.string().min(1).max(MAX_VIDEO_CHANNEL_LENGTH),
    imagePaths: imagePathsSchema.optional(),
  }),
  z.strictObject({
    kind: z.literal("photos"),
    imagePaths: imagePathsSchema,
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

/** The curated video of an exercise, as ids and text only. */
export type ExerciseFormVideo = { videoId: string; title: string; channel: string };

/** The start and end photos of an exercise, as paths only. */
export type ExerciseFormPhotos = { imagePaths: readonly [start: string, end: string] };

/** Everything an exercise has for its form: its video, its photos, both or neither. */
export type ExerciseFormMediaSet = {
  video: ExerciseFormVideo | null;
  photos: ExerciseFormPhotos | null;
};

/**
 * What an exercise has for its form, from its row: the video when its id is valid and it has a title and a
 * channel, and the photos when at least two paths are valid (the first is the start and the last the end).
 * A bad value never throws, it drops out.
 */
export function exerciseFormMediaSetOf(row: ExerciseFormMediaRow | null): ExerciseFormMediaSet {
  if (row === null) {
    return { video: null, photos: null };
  }
  const { video_id, video_title, video_channel, image_paths } = row;
  const video =
    video_id !== null &&
    youtubeVideoIdSchema.safeParse(video_id).success &&
    isPresent(video_title) &&
    isPresent(video_channel)
      ? { videoId: video_id, title: video_title, channel: video_channel }
      : null;
  const paths = (image_paths ?? []).filter(
    (path) => freeExerciseDbImagePathSchema.safeParse(path).success,
  );
  const [start] = paths;
  const end = paths.at(-1);
  const photos: ExerciseFormPhotos | null =
    paths.length >= 2 && start !== undefined && end !== undefined
      ? { imagePaths: [start, end] }
      : null;
  return { video, photos };
}

/**
 * The form media of an exercise from its row: the video when it has one, else the photos, else none. Use
 * `exerciseFormMediaSetOf` with `formMediaToShow` to honour a preference.
 */
export function exerciseFormMediaOf(row: ExerciseFormMediaRow | null): ExerciseFormMedia {
  return formMediaToShow(exerciseFormMediaSetOf(row), "video");
}

/** What the lifter chose to see of an exercise's form. */
export const FORM_MEDIA_PREFERENCES = ["video", "photos", "both"] as const;

export type FormMediaPreference = (typeof FORM_MEDIA_PREFERENCES)[number];

/** The preference of someone who never chose: one card, the same as before the choice existed. */
export const DEFAULT_FORM_MEDIA_PREFERENCE: FormMediaPreference = "video";

/** The preference a stored value names, or null when it names none. */
export const formMediaPreferenceOf = (stored: string | null): FormMediaPreference | null =>
  FORM_MEDIA_PREFERENCES.find((preference) => preference === stored) ?? null;

/** What to draw once a preference is applied: one kind, both together, or nothing. */
export type ExerciseFormMediaToShow =
  | ExerciseFormMedia
  | { kind: "both"; video: ExerciseFormVideo; imagePaths: readonly [start: string, end: string] };

/**
 * What to draw for an exercise's media and a preference. A kind the exercise lacks falls back to the other:
 * video chosen without a video shows the photos, photos chosen without photos shows the video, and both
 * chosen with only one shows that one. Nothing at all is none. A video or photos preference never gives
 * both, so a surface that offers only those can draw the result without a both case.
 */
export function formMediaToShow(
  set: ExerciseFormMediaSet,
  preference: "video" | "photos",
): ExerciseFormMedia;
export function formMediaToShow(
  set: ExerciseFormMediaSet,
  preference: FormMediaPreference,
): ExerciseFormMediaToShow;
export function formMediaToShow(
  { video, photos }: ExerciseFormMediaSet,
  preference: FormMediaPreference,
): ExerciseFormMediaToShow {
  if (preference === "both" && video !== null && photos !== null) {
    return { kind: "both", video, imagePaths: photos.imagePaths };
  }
  if (preference === "photos" && photos !== null) {
    return { kind: "photos", imagePaths: photos.imagePaths };
  }
  if (video !== null) {
    return { kind: "video", ...video };
  }
  if (photos !== null) {
    return { kind: "photos", imagePaths: photos.imagePaths };
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

/** The URLs for both the video and the photos together. */
export type ExerciseFormMediaToShowDisplay =
  | ExerciseFormMediaDisplay
  | {
      kind: "both";
      title: string;
      channel: string;
      thumbnailUrl: string;
      watchUrl: string;
      startUrl: string;
      endUrl: string;
    };

const videoUrlsOf = ({ videoId, title, channel }: ExerciseFormVideo) => ({
  title,
  channel,
  thumbnailUrl: youtubeThumbnailUrl(videoId),
  watchUrl: youtubeWatchUrl(videoId),
});

const photoUrlsOf = ([start, end]: readonly [string, string]) => ({
  startUrl: freeExerciseDbImageUrl(start),
  endUrl: freeExerciseDbImageUrl(end),
});

/** What a surface draws for its media, with every URL made by the builders above. */
export function exerciseFormMediaDisplayOf(media: ExerciseFormMedia): ExerciseFormMediaDisplay;
export function exerciseFormMediaDisplayOf(
  media: ExerciseFormMediaToShow,
): ExerciseFormMediaToShowDisplay;
export function exerciseFormMediaDisplayOf(
  media: ExerciseFormMediaToShow,
): ExerciseFormMediaToShowDisplay {
  switch (media.kind) {
    case "video":
      return { kind: "video", ...videoUrlsOf(media) };
    case "photos":
      return { kind: "photos", ...photoUrlsOf(media.imagePaths) };
    case "both":
      return { kind: "both", ...videoUrlsOf(media.video), ...photoUrlsOf(media.imagePaths) };
    case "none":
      return { kind: "none" };
  }
}
