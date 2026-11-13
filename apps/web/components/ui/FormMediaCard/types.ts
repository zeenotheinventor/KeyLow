/**
 * What the card shows. The `video` and `photos` shapes match core's `exerciseFormMediaDisplayOf` field for
 * field, so a surface spreads that result into the card. They are plain values here, so the kit needs nothing
 * from core's training types.
 */
export type FormMediaCardProps =
  | {
      kind: "video";
      /** The video's title, two lines at most. */
      title: string;
      /** The channel that published it. */
      channel: string;
      /** The poster, cropped to 16:9 with cover because YouTube's own is 4:3 with letterbox bars. */
      thumbnailUrl: string;
      /** The page the card opens in a new tab. The card is the link, so no surface repeats a handler. */
      watchUrl: string;
    }
  | {
      kind: "photos";
      exerciseName: string;
      startUrl: string;
      endUrl: string;
    }
  | { kind: "loading" }
  | { kind: "unavailable" };
