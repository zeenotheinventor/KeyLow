import { act, cleanup, renderHook } from "@testing-library/react";
import { hydrateRoot } from "react-dom/client";
import { renderToString } from "react-dom/server";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import { useBodyMapHint } from "@/lib/bodyMapHint";

function Probe() {
  const { isRead, hasSeen } = useBodyMapHint();
  return <p>{isRead ? (hasSeen ? "seen" : "unseen") : "not read"}</p>;
}

describe("useBodyMapHint", () => {
  beforeEach(() => {
    window.localStorage.clear();
  });

  afterEach(() => {
    cleanup();
    vi.restoreAllMocks();
  });

  it("should be read and unseen on a first visit", () => {
    const { result } = renderHook(() => useBodyMapHint());

    expect(result.current).toMatchObject({ isRead: true, hasSeen: false });
  });

  it("should be seen when the browser has it stored as seen", () => {
    window.localStorage.setItem("bodyMap.hintSeen", "true");

    const { result } = renderHook(() => useBodyMapHint());

    expect(result.current).toMatchObject({ isRead: true, hasSeen: true });
  });

  it("should be unseen when what is stored is not the seen mark", () => {
    window.localStorage.setItem("bodyMap.hintSeen", "yes");

    const { result } = renderHook(() => useBodyMapHint());

    expect(result.current.hasSeen).toBe(false);
  });

  it("should be seen when storage cannot be read, so the hint is never shown from a guess", () => {
    vi.spyOn(Storage.prototype, "getItem").mockImplementation(() => {
      throw new Error("blocked");
    });

    const { result } = renderHook(() => useBodyMapHint());

    expect(result.current).toMatchObject({ isRead: true, hasSeen: true });
  });

  it("should store the mark when marked seen", () => {
    const { result } = renderHook(() => useBodyMapHint());

    act(() => {
      result.current.markSeen();
    });

    expect(result.current.hasSeen).toBe(true);
    expect(window.localStorage.getItem("bodyMap.hintSeen")).toBe("true");
  });

  it("should stay seen for the visit when the mark cannot be stored", () => {
    vi.spyOn(Storage.prototype, "setItem").mockImplementation(() => {
      throw new Error("full");
    });
    const { result } = renderHook(() => useBodyMapHint());

    act(() => {
      result.current.markSeen();
    });

    expect(result.current.hasSeen).toBe(true);
  });

  it("should stay seen after a reload", () => {
    const first = renderHook(() => useBodyMapHint());
    act(() => {
      first.result.current.markSeen();
    });
    first.unmount();

    const reloaded = renderHook(() => useBodyMapHint());

    expect(reloaded.result.current.hasSeen).toBe(true);
  });

  it("should be unseen in a second browser, which has its own storage", () => {
    const first = renderHook(() => useBodyMapHint());
    act(() => {
      first.result.current.markSeen();
    });
    window.localStorage.clear();

    const second = renderHook(() => useBodyMapHint());

    expect(second.result.current.hasSeen).toBe(false);
  });

  it("should not be read on the server, and should agree with it on the first render in the browser", () => {
    window.localStorage.setItem("bodyMap.hintSeen", "true");
    const html = renderToString(<Probe />);
    const container = document.createElement("div");
    container.innerHTML = html;
    document.body.append(container);
    const mismatches = vi.spyOn(console, "error").mockImplementation(() => undefined);

    expect(html).toContain("not read");
    act(() => {
      hydrateRoot(container, <Probe />);
    });

    expect(mismatches).not.toHaveBeenCalled();
    expect(container.textContent).toBe("seen");
    container.remove();
  });
});
