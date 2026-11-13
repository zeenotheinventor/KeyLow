/** What draws the mark itself, with or without the word beside it. */
export type KiLoMarkGlyphProps = {
  /** Names the mark when it stands alone. Without one the mark is decorative, for beside the wordmark or a heading. */
  title?: string;
  /** The size of the mark, such as `size-7`. */
  className?: string;
  /**
   * Plays the "Loading the bar" loop: plates slide onto the bar one at a time and each draws its half of
   * the ring, then they come off and it starts again. It starts on the complete logo, and under reduced
   * motion it stays there. The mark is decoration, so it is hidden from a screen reader and takes no
   * `title`.
   */
  isAnimated?: boolean;
};

type AnimatedGlyphProps = Omit<KiLoMarkGlyphProps, "title" | "isAnimated"> & {
  isAnimated: true;
  wordmark?: false;
  title?: never;
};

export type KiLoMarkProps =
  | (Omit<KiLoMarkGlyphProps, "isAnimated"> & { isAnimated?: false; wordmark?: false })
  | AnimatedGlyphProps
  | {
      className?: string;
      /**
       * Adds the word Ki-Lo after the mark, sized for a `size-10` mark. The two are then one image
       * named Ki-Lo, so a `title` is not allowed.
       */
      wordmark: true;
      title?: never;
    };
