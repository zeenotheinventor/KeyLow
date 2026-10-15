import type { CSSProperties } from "react";

type CustomProperties = Record<`--${string}`, string>;

/**
 * A style that sets only CSS custom properties, which a class reads for a value known at runtime, as
 * in `w-[var(--fill)]`. React's types name only the standard properties, so this gives the custom
 * ones a type.
 */
export const vars = (properties: CustomProperties): CSSProperties & CustomProperties => properties;
