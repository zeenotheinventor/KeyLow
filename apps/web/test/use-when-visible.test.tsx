import { act, renderHook } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import { useWhenVisible } from "@/lib/useWhenVisible";

type Entries = Array<{ isIntersecting: boolean }>;

// jsdom has no IntersectionObserver, so a test keeps the ones the hook makes and tells them what they see.
const observers: FakeIntersectionObserver[] = [];

class FakeIntersectionObserver {
  isObserving = false;
  readonly callback: (entries: Entries) => void;

  constructor(callback: (entries: Entries) => void) {
    this.callback = callback;
    observers.push(this);
  }

  observe() {
    this.isObserving = true;
  }

  disconnect() {
    this.isObserving = false;
  }
}

const liveObservers = () => observers.filter((observer) => observer.isObserving);

function see(isIntersecting: boolean) {
  act(() => {
    liveObservers().forEach((observer) => {
      observer.callback([{ isIntersecting }]);
    });
  });
}

function renderWhenVisible(onVisible: () => void, enabled: boolean) {
  const rendered = renderHook(
    (props: { enabled: boolean }) => useWhenVisible(onVisible, props.enabled),
    { initialProps: { enabled } },
  );
  act(() => {
    rendered.result.current(document.createElement("div"));
  });
  return rendered;
}

describe("useWhenVisible", () => {
  beforeEach(() => {
    vi.stubGlobal("IntersectionObserver", FakeIntersectionObserver);
  });

  afterEach(() => {
    observers.length = 0;
    vi.unstubAllGlobals();
  });

  it("should call back when the element comes into view, and not when it is out of view", () => {
    const onVisible = vi.fn();
    renderWhenVisible(onVisible, true);

    see(false);
    expect(onVisible).not.toHaveBeenCalled();
    see(true);

    expect(onVisible).toHaveBeenCalledTimes(1);
  });

  it("should observe nothing while it is not enabled", () => {
    renderWhenVisible(vi.fn(), false);

    expect(liveObservers()).toHaveLength(0);
  });

  it("should stop observing when it is disabled and observe again when it is enabled again", () => {
    const onVisible = vi.fn();
    const { rerender } = renderWhenVisible(onVisible, true);
    expect(liveObservers()).toHaveLength(1);

    rerender({ enabled: false });
    expect(liveObservers()).toHaveLength(0);
    see(true);
    expect(onVisible).not.toHaveBeenCalled();

    rerender({ enabled: true });
    expect(liveObservers()).toHaveLength(1);
    see(true);
    expect(onVisible).toHaveBeenCalledTimes(1);
  });

  it("should stop observing when it is unmounted", () => {
    const { unmount } = renderWhenVisible(vi.fn(), true);
    expect(liveObservers()).toHaveLength(1);

    unmount();

    expect(liveObservers()).toHaveLength(0);
  });
});
