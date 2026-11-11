/**
 * What the card shows. The `video` and `photos` shapes match `exerciseFormMediaDisplayOf` field for field,
 * so a surface spreads that result into the card. They are plain values here, so the kit needs nothing
 * from core's training types.
 */
export type FormMediaCardProps =
  | {
      kind: "video";
      /** The video's title, two lines at most. */
      title: string;
      /** The channel that published it. */
      channel: string;
      /** The video's thumbnail, cropped to 16:9 with cover because YouTube's own is 4:3 with letterbox bars. */
      thumbnailUrl: string;
      /** The page the card opens in YouTube. The card opens it itself, so no surface repeats the handler. */
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
