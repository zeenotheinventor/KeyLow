import { vi } from "vitest";

/** The board's own drawing sizes: 754 by 220 at 1280 and 341 by 160 at 375. */
export const DESKTOP = { width: 754, height: 220 };
export const PHONE = { width: 341, height: 160 };

/** Makes every element report this box, as the column and the breakpoint would lay it out. */
export function stubSize(size: { width: number; height: number }) {
  vi.spyOn(Element.prototype, "getBoundingClientRect").mockImplementation(
    () => new DOMRect(0, 0, size.width, size.height),
  );
}

// A ResizeObserver that tells a test's callback when the test says the column changed.
const resizeCallbacks: ResizeObserverCallback[] = [];

export class FakeResizeObserver implements ResizeObserver {
  private readonly callback: ResizeObserverCallback;

  constructor(callback: ResizeObserverCallback) {
    this.callback = callback;
    resizeCallbacks.push(callback);
  }

  observe() {}
  unobserve() {}
  disconnect() {
    resizeCallbacks.splice(resizeCallbacks.indexOf(this.callback), 1);
  }
}

/** Tells every observer the column changed to this box. */
export function resizeTo(size: { width: number; height: number }) {
  stubSize(size);
  for (const callback of [...resizeCallbacks]) {
    callback([], new FakeResizeObserver(() => undefined));
  }
}
