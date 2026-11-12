import { useLayoutEffect, useRef, useState } from "react";

/** An element's box in CSS pixels, as the page lays it out. */
export type ElementSize = {
  width: number;
  height: number;
};

/**
 * The size of an element as the page lays it out, read before the first paint and again whenever it changes,
 * so a drawing that fills its column follows the column at a new window width or breakpoint. It is null until
 * the element has a size, which it does not in the server's markup or in a browser that has not laid it out.
 */
export function useElementSize<ElementType extends Element>() {
  const reference = useRef<ElementType>(null);
  const [size, setSize] = useState<ElementSize | null>(null);

  useLayoutEffect(() => {
    const element = reference.current;
    if (element === null) {
      return;
    }
    function read() {
      const { width, height } = element?.getBoundingClientRect() ?? { width: 0, height: 0 };
      setSize((previous) =>
        previous?.width === width && previous.height === height ? previous : { width, height },
      );
    }
    read();
    if (typeof ResizeObserver === "undefined") {
      return;
    }
    const observer = new ResizeObserver(read);
    observer.observe(element);
    return () => {
      observer.disconnect();
    };
  }, []);

  return { reference, size: size !== null && size.width > 0 && size.height > 0 ? size : null };
}
