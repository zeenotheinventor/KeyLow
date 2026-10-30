/** What draws the mark itself, with or without the word beside it. */
export type KiLoMarkGlyphProps = {
  /** Names the mark when it stands alone. Without one the mark is decorative, for beside the wordmark or a heading. */
  title?: string;
  /** The size of the mark, such as `size-7`. */
  className?: string;
};

export type KiLoMarkProps =
  | (KiLoMarkGlyphProps & { wordmark?: false })
  | {
      className?: string;
      /**
       * Adds the word Ki-Lo after the mark, sized for a `size-10` mark. The two are then one image
       * named Ki-Lo, so a `title` is not allowed.
       */
      wordmark: true;
      title?: never;
    };
