import { useEffect, useState } from "react";

/**
 * How far a ring or a bar is drawn, from 0 to 1. It is empty on the first draw and takes `fraction`
 * two frames later, once the empty draw has been painted, so the CSS transition on the fill whips it
 * in. After that it follows `fraction` at once, and the transition whips it again.
 */
export function useWhipFill(fraction: number): number {
  const [isPainted, setIsPainted] = useState(false);

  useEffect(() => {
    let innerFrame = 0;
    const outerFrame = requestAnimationFrame(() => {
      innerFrame = requestAnimationFrame(() => {
        setIsPainted(true);
      });
    });

    return () => {
      cancelAnimationFrame(outerFrame);
      cancelAnimationFrame(innerFrame);
    };
  }, []);

  return isPainted ? fraction : 0;
}
