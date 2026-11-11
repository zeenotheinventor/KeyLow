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

/** Which of the two photos of an exercise. */
export type FormPhotoPosition = "start" | "end";

/** The name of the video card: what it plays, who made it and where it opens. */
export const describeFormVideoLink = (title: string, channel: string): string =>
  `Watch ${title} by ${channel} on YouTube`;

/** The name of one photo of an exercise. */
export const describeFormPhoto = (exerciseName: string, position: FormPhotoPosition): string =>
  `${exerciseName}, ${position} position`;
