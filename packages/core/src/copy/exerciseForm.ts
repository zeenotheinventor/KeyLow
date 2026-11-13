/*
 * The words of the exercise form media card (KEY-958), as the board `exercise-form · form-media-card`
 * draws them. The surfaces that place the card add their own strings to this module.
 */

/** The fixed words of the card. The two names are for a screen reader, the board draws them without words. */
export const EXERCISE_FORM = {
  /** The trailing line of the video card. */
  opensInYouTube: "Opens in YouTube",
  /** The badges on the start and the end photo. */
  startLabel: "Start",
  endLabel: "End",
  loadingName: "Loading the form guide",
  /** Offline or a failed read. One quiet line. */
  unavailable: "The form guide isn't available right now.",
  /** The placeholder tile that stands in for a thumbnail or a photo that did not load. */
  imageFailedName: "Image not available",
} as const;

/** The quick switch under the media of the exercise sheet, which changes what every exercise demo shows. */
export const FORM_MEDIA_SWITCH = {
  /** The name of the radio group. */
  label: "Show form as",
  options: { video: "Video", photos: "Photos", both: "Both" },
} as const;

/** Which of the two photos of an exercise. */
export type FormPhotoPosition = "start" | "end";

/** The name of the video card: what it plays, who made it and where it opens. */
export const describeFormVideoLink = (title: string, channel: string): string =>
  `Watch ${title} by ${channel} on YouTube`;

/** The name of one photo of an exercise. */
export const describeFormPhoto = (exerciseName: string, position: FormPhotoPosition): string =>
  `${exerciseName}, ${position} position`;

/** The routine editor's way to the exercise sheet, where the sheet shows the form guide and the muscles. */
export const ROUTINE_EXERCISE_FORM = {
  /** The first item of an exercise's menu. */
  menuAction: "Form and muscles",
} as const;

/** The name of the Form and muscles button of an exercise in a routine row: it opens the sheet. */
export const describeFormAndMusclesButton = (exerciseName: string): string =>
  `${ROUTINE_EXERCISE_FORM.menuAction}, ${exerciseName}`;
