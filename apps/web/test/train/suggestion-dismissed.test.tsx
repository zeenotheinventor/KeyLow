import { act, cleanup, renderHook } from "@testing-library/react";
import { renderToString } from "react-dom/server";
import { afterEach, beforeEach, describe, expect, it } from "vitest";

import {
  SUGGESTION_DISMISSED_KEY,
  readDismissedDays,
  useSuggestionDismissed,
} from "@/lib/suggestionDismissed";

function Probe() {
  const { dismissedDays } = useSuggestionDismissed();
  return <p>{dismissedDays === undefined ? "unread" : "read"}</p>;
}

describe("the days whose suggestion was put off with Not now in this browser", () => {
  beforeEach(() => {
    window.localStorage.clear();
  });

  afterEach(cleanup);

  it("should be unknown until the browser has been read, so the card does not flicker", () => {
    expect(renderToString(<Probe />)).toContain("unread");
  });

  it("should read the days that were stored", () => {
    window.localStorage.setItem(SUGGESTION_DISMISSED_KEY, "2026-10-14,2026-10-15");

    const { result } = renderHook(() => useSuggestionDismissed());

    expect(result.current.dismissedDays).toEqual(["2026-10-14", "2026-10-15"]);
  });

  it("should keep a day once, however often it is put off", () => {
    const { result } = renderHook(() => useSuggestionDismissed());

    act(() => {
      result.current.dismiss("2026-10-15");
      result.current.dismiss("2026-10-15");
    });

    expect(readDismissedDays()).toEqual(["2026-10-15"]);
  });

  it("should keep only the newest fourteen days", () => {
    const { result } = renderHook(() => useSuggestionDismissed());

    act(() => {
      for (let day = 1; day <= 15; day += 1) {
        result.current.dismiss(`2026-10-${String(day).padStart(2, "0")}`);
      }
    });

    const kept = readDismissedDays();
    expect(kept).toHaveLength(14);
    expect(kept[0]).toBe("2026-10-02");
    expect(kept.at(-1)).toBe("2026-10-15");
  });

  it("should count stored data that is not a list of days as none", () => {
    window.localStorage.setItem(SUGGESTION_DISMISSED_KEY, "2026-10-14,soon");

    const { result } = renderHook(() => useSuggestionDismissed());

    expect(result.current.dismissedDays).toEqual([]);
  });

  it("should count storage that cannot be read as none", () => {
    const blocked = Object.getOwnPropertyDescriptor(window, "localStorage");
    Object.defineProperty(window, "localStorage", {
      configurable: true,
      get: () => {
        throw new Error("blocked");
      },
    });

    const { result } = renderHook(() => useSuggestionDismissed());

    expect(result.current.dismissedDays).toEqual([]);
    if (blocked !== undefined) {
      Object.defineProperty(window, "localStorage", blocked);
    }
  });
});
