import { useLayoutEffect, useRef, useState } from "react";

import type { RefObject } from "react";

type TableScroll = { isWide: boolean; isAtEnd: boolean };

/**
 * Whether a table is wider than its reply, and whether its scroller is at the last column. Both are read
 * before the first paint, when the scroller or the grid inside it changes size, and on every scroll, because
 * the end moves as longer rows arrive.
 *
 * A table once judged wide stays wide until its own width, its number of columns or its number of rows change.
 * Wrapped names in the capped first column can measure narrower than the same names given the spare width, so
 * without this a table could flip between the two layouts.
 */
export function useTableScroll(
  scroller: RefObject<HTMLElement | null>,
  grid: RefObject<HTMLElement | null>,
  shape: { columnCount: number; rowCount: number },
) {
  const [state, setState] = useState<TableScroll>({ isWide: false, isAtEnd: false });
  const wideShape = useRef<string | null>(null);
  const { columnCount, rowCount } = shape;

  // Read from an effect, an observer and a scroll event, so it is given what it needs and keeps no closure.
  function measure(element: HTMLElement | null) {
    if (element === null) {
      return;
    }
    const { scrollWidth, clientWidth, scrollLeft } = element;
    // 1 px of slack, so a table that fits to the pixel is not a scroller.
    const isOverflowing = scrollWidth > clientWidth + 1;
    const shapeKey = `${clientWidth}:${columnCount}:${rowCount}`;
    if (isOverflowing) {
      wideShape.current = shapeKey;
    }
    const isWide = isOverflowing || wideShape.current === shapeKey;
    const isAtEnd = scrollLeft >= scrollWidth - clientWidth - 1;
    setState((before) =>
      before.isWide === isWide && before.isAtEnd === isAtEnd ? before : { isWide, isAtEnd },
    );
  }

  useLayoutEffect(() => {
    const element = scroller.current;
    measure(element);
    if (typeof ResizeObserver === "undefined") {
      return;
    }
    const observer = new ResizeObserver(() => {
      measure(element);
    });
    for (const observed of [element, grid.current]) {
      if (observed !== null) {
        observer.observe(observed);
      }
    }
    return () => {
      observer.disconnect();
    };
    // `measure` reads only the two counts, so a change in either measures again.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [scroller, grid, columnCount, rowCount]);

  return {
    ...state,
    onScroll: () => {
      measure(scroller.current);
    },
  };
}
