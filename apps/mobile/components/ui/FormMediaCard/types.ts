/** What an exercise demo shows. The same three values as core's `FormMediaPreference`, so the kit needs nothing from core's training types. */
export type FormMediaChoice = "video" | "photos" | "both";

/** The quick switch under the media: it names what is shown now, and says what the person picked. */
export type FormMediaPreferenceSwitch = {
  value: FormMediaChoice;
  onChange: (choice: FormMediaChoice) => void;
};

/** The video card's own fields. */
type FormVideoFields = {
  /** The video's title, two lines at most. */
  title: string;
  /** The channel that published it. */
  channel: string;
  /** The video's thumbnail, cropped to 16:9 with cover because YouTube's own is 4:3 with letterbox bars. */
  thumbnailUrl: string;
  /** The page the card opens in YouTube. The card opens it itself, so no surface repeats the handler. */
  watchUrl: string;
};

/** The photos card's own fields. */
type FormPhotosFields = {
  exerciseName: string;
  startUrl: string;
  endUrl: string;
};

/**
 * What the card shows. The `video` and `photos` shapes match `exerciseFormMediaDisplayOf` field for field,
 * so a surface spreads that result into the card, and `both` is the two together. They are plain values
 * here, so the kit needs nothing from core's training types. A media card may carry the quick switch, which
 * the surface passes only when the exercise has both kinds.
 */
export type FormMediaCardProps =
  | ({ kind: "video"; preferenceSwitch?: FormMediaPreferenceSwitch | undefined } & FormVideoFields)
  | ({
      kind: "photos";
      preferenceSwitch?: FormMediaPreferenceSwitch | undefined;
    } & FormPhotosFields)
  | ({
      kind: "both";
      preferenceSwitch?: FormMediaPreferenceSwitch | undefined;
    } & FormVideoFields &
      FormPhotosFields)
  | { kind: "loading" }
  | { kind: "unavailable" };
