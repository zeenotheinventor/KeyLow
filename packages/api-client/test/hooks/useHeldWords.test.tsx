import { act, renderHook } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import { MINIMUM_WORDS_TIME_MS, useHeldWords } from "../../src/hooks/useHeldWords";

beforeEach(() => {
  vi.useFakeTimers();
  vi.setSystemTime(new Date("2026-11-12T10:00:00Z"));
});
afterEach(() => {
  vi.useRealTimers();
});

const advance = (milliseconds: number) => {
  act(() => {
    vi.advanceTimersByTime(milliseconds);
  });
};

function renderWords(initial: string) {
  return renderHook(({ text }) => useHeldWords(text), { initialProps: { text: initial } });
}

describe("useHeldWords", () => {
  it("should hold the words for 700 ms", () => {
    expect(MINIMUM_WORDS_TIME_MS).toBe(700);
  });

  it("should show the first words at once", () => {
    const { result } = renderWords("Reading your diary");

    expect(result.current).toBe("Reading your diary");
  });

  it("should show new words at once when the current ones have been up for the minimum time", () => {
    const { result, rerender } = renderWords("Reading your diary");
    advance(MINIMUM_WORDS_TIME_MS);

    rerender({ text: "Adding it up" });

    expect(result.current).toBe("Adding it up");
  });

  it("should keep the current words until the minimum time is up, then show the new ones", () => {
    const { result, rerender } = renderWords("Reading your diary");
    advance(300);

    rerender({ text: "Adding it up" });
    expect(result.current).toBe("Reading your diary");

    advance(399);
    expect(result.current).toBe("Reading your diary");

    advance(1);
    expect(result.current).toBe("Adding it up");
  });

  it("should skip to the last words of a burst and never show the ones between", () => {
    const seen: string[] = [];
    const { result, rerender } = renderHook(
      ({ text }) => {
        const words = useHeldWords(text);
        if (seen.at(-1) !== words) {
          seen.push(words);
        }
        return words;
      },
      { initialProps: { text: "one" } },
    );

    advance(100);
    rerender({ text: "two" });
    advance(100);
    rerender({ text: "three" });
    advance(100);
    rerender({ text: "four" });
    advance(MINIMUM_WORDS_TIME_MS);

    expect(result.current).toBe("four");
    expect(seen).toEqual(["one", "four"]);
  });

  it("should not drop the final words when a step lands just before the held ones are due", () => {
    const { result, rerender } = renderWords("one");
    advance(100);
    rerender({ text: "two" });
    advance(550);
    rerender({ text: "three" });

    advance(49);
    expect(result.current).toBe("one");
    advance(1);
    expect(result.current).toBe("three");
  });

  it("should hold the words that just replaced others for the full minimum time, so a fast step does not flicker", () => {
    const { result, rerender } = renderWords("one");
    advance(MINIMUM_WORDS_TIME_MS);
    rerender({ text: "two" });
    expect(result.current).toBe("two");

    advance(10);
    rerender({ text: "three" });
    advance(MINIMUM_WORDS_TIME_MS - 11);
    expect(result.current).toBe("two");

    advance(1);
    expect(result.current).toBe("three");
  });

  it("should settle on the words it is back to when a step returns before the wait is over", () => {
    const { result, rerender } = renderWords("one");
    advance(100);
    rerender({ text: "two" });
    rerender({ text: "one" });

    advance(MINIMUM_WORDS_TIME_MS);

    expect(result.current).toBe("one");
    expect(vi.getTimerCount()).toBe(0);
  });

  it("should clear the wait when the line goes away", () => {
    const { rerender, unmount } = renderWords("one");
    advance(100);
    rerender({ text: "two" });
    expect(vi.getTimerCount()).toBe(1);

    unmount();

    expect(vi.getTimerCount()).toBe(0);
  });
});
