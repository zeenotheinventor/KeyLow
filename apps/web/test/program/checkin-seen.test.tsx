import { act, cleanup, render, screen } from "@testing-library/react";
import { hydrateRoot } from "react-dom/client";
import { renderToString } from "react-dom/server";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import { CHECKIN_SEEN_KEY, useCheckinArrival } from "@/lib/checkinSeen";

function Probe({ checkinDate }: { checkinDate: string | null }) {
  const { isNew } = useCheckinArrival(checkinDate);
  return <p role="status">{isNew ? "new" : "seen"}</p>;
}

const CHECKIN = "2026-11-06";
const EARLIER_CHECKIN = "2026-10-30";

beforeEach(() => {
  window.localStorage.clear();
});

afterEach(() => {
  cleanup();
  vi.restoreAllMocks();
});

describe("whether a check-in has just arrived in this browser", () => {
  it("should be new when this browser has seen no check-in, and remember its date", () => {
    render(<Probe checkinDate={CHECKIN} />);

    expect(screen.getByRole("status").textContent).toBe("new");
    expect(window.localStorage.getItem(CHECKIN_SEEN_KEY)).toBe(CHECKIN);
  });

  it("should be new when the date seen is an earlier check-in's", () => {
    window.localStorage.setItem(CHECKIN_SEEN_KEY, EARLIER_CHECKIN);

    render(<Probe checkinDate={CHECKIN} />);

    expect(screen.getByRole("status").textContent).toBe("new");
    expect(window.localStorage.getItem(CHECKIN_SEEN_KEY)).toBe(CHECKIN);
  });

  it("should not be new when this browser has seen this check-in", () => {
    window.localStorage.setItem(CHECKIN_SEEN_KEY, CHECKIN);
    const setItem = vi.spyOn(Storage.prototype, "setItem");

    render(<Probe checkinDate={CHECKIN} />);

    expect(screen.getByRole("status").textContent).toBe("seen");
    expect(setItem).not.toHaveBeenCalled();
  });

  it("should stay new for the rest of the visit although the date is stored at once", () => {
    const { rerender } = render(<Probe checkinDate={CHECKIN} />);

    rerender(<Probe checkinDate={CHECKIN} />);

    expect(screen.getByRole("status").textContent).toBe("new");
  });

  it("should find the check-in seen on the next visit", () => {
    render(<Probe checkinDate={CHECKIN} />);
    cleanup();

    render(<Probe checkinDate={CHECKIN} />);

    expect(screen.getByRole("status").textContent).toBe("seen");
  });

  it("should be new again for a newer check-in", () => {
    window.localStorage.setItem(CHECKIN_SEEN_KEY, CHECKIN);

    render(<Probe checkinDate="2026-11-13" />);

    expect(screen.getByRole("status").textContent).toBe("new");
  });

  it("should not be new while there is no check-in, and store nothing", () => {
    const setItem = vi.spyOn(Storage.prototype, "setItem");

    render(<Probe checkinDate={null} />);

    expect(screen.getByRole("status").textContent).toBe("seen");
    expect(setItem).not.toHaveBeenCalled();
  });

  it("should take a stored value that is not a date as nothing seen", () => {
    window.localStorage.setItem(CHECKIN_SEEN_KEY, "yesterday");

    render(<Probe checkinDate={CHECKIN} />);

    expect(screen.getByRole("status").textContent).toBe("new");
  });

  describe("when storage fails", () => {
    it("should play nothing when storage cannot be read, as the motion is never played from a guess", () => {
      vi.spyOn(Storage.prototype, "getItem").mockImplementation(() => {
        throw new DOMException("blocked", "SecurityError");
      });

      render(<Probe checkinDate={CHECKIN} />);

      expect(screen.getByRole("status").textContent).toBe("seen");
    });

    it("should still be new for the visit when the date cannot be saved", () => {
      vi.spyOn(Storage.prototype, "setItem").mockImplementation(() => {
        throw new DOMException("full", "QuotaExceededError");
      });

      render(<Probe checkinDate={CHECKIN} />);

      expect(screen.getByRole("status").textContent).toBe("new");
    });
  });

  describe("on the server and at hydration", () => {
    it("should not read storage on the server, so the first draw is not new", () => {
      window.localStorage.setItem(CHECKIN_SEEN_KEY, EARLIER_CHECKIN);
      const getItem = vi.spyOn(Storage.prototype, "getItem");

      const page = document.createElement("div");
      page.innerHTML = renderToString(<Probe checkinDate={CHECKIN} />);

      expect(page.textContent).toBe("seen");
      expect(getItem).not.toHaveBeenCalled();
    });

    it("should hydrate a page the server drew, with no mismatch, and then say the check-in is new", async () => {
      window.localStorage.setItem(CHECKIN_SEEN_KEY, EARLIER_CHECKIN);
      const consoleError = vi.spyOn(console, "error").mockImplementation(() => undefined);
      const container = document.createElement("div");
      document.body.appendChild(container);
      container.innerHTML = renderToString(<Probe checkinDate={CHECKIN} />);

      await act(async () => {
        hydrateRoot(container, <Probe checkinDate={CHECKIN} />);
        await Promise.resolve();
      });

      expect(consoleError).not.toHaveBeenCalled();
      expect(container.textContent).toBe("new");
      container.remove();
    });
  });
});
