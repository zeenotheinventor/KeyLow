import { useLayoutEffect, useState } from "react";

import type { RefObject } from "react";

/**
 * How far from the top of the window the page under the top bar starts: the bar's height while it shows, and 0
 * once the page has scrolled past it. The top bar is not sticky, so a panel fixed under it has to follow it out
 * of view, or the page would show through above the panel. It follows the scroll and the window's size while
 * `isActive`.
 */
export function useVisibleTopBarBottom(
  pageRef: RefObject<HTMLElement | null>,
  isActive: boolean,
): number {
  const [top, setTop] = useState(0);

  useLayoutEffect(() => {
    if (!isActive) {
      return;
    }
    const read = () => {
      setTop(Math.max(0, Math.round(pageRef.current?.getBoundingClientRect().top ?? 0)));
    };
    read();
    window.addEventListener("scroll", read, { passive: true });
    window.addEventListener("resize", read);
    return () => {
      window.removeEventListener("scroll", read);
      window.removeEventListener("resize", read);
    };
  }, [isActive, pageRef]);

  return top;
}
