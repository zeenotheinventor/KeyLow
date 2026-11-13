import { parseReplyText } from "@keylow/core";
import { act, cleanup, fireEvent, render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import type { ReplyTableProps } from "@/components/ui/ReplyTable";

import { ReplyTable } from "@/components/ui/ReplyTable";

function tableFrom(markdown: string): ReplyTableProps["table"] {
  const table = parseReplyText(markdown, { isPartial: false }).find(
    (block) => block.kind === "table",
  );
  if (table === undefined) {
    throw new Error("The test's markdown holds no table");
  }
  return table;
}

const market = tableFrom(
  [
    "| Entry | Amount | kcal | Protein (g) |",
    "| --- | --- | --- | --- |",
    "| Bratwurst roll | 1 roll (190 g) | 520 | 21 |",
    "| Baileys | 25 ml | 79 | – |",
  ].join("\n"),
);
const label = "Table, 2 rows.";

// jsdom lays nothing out, so a test says how wide the scroller's content is and how wide its box is.
const box = { scrollWidth: 0, clientWidth: 0, scrollLeft: 0 };
const observers: (() => void)[] = [];

class FakeResizeObserver {
  private readonly callback: () => void;

  constructor(callback: () => void) {
    this.callback = callback;
    observers.push(callback);
  }

  observe() {}
  unobserve() {}
  disconnect() {
    observers.splice(observers.indexOf(this.callback), 1);
  }
}

function resize(next: Partial<typeof box>) {
  Object.assign(box, next);
  act(() => {
    for (const callback of [...observers]) {
      callback();
    }
  });
}

describe("ReplyTable", () => {
  beforeEach(() => {
    Object.assign(box, { scrollWidth: 300, clientWidth: 300, scrollLeft: 0 });
    for (const property of ["scrollWidth", "clientWidth", "scrollLeft"] as const) {
      vi.spyOn(HTMLElement.prototype, property, "get").mockImplementation(() => box[property]);
    }
    vi.stubGlobal("ResizeObserver", FakeResizeObserver);
  });

  afterEach(() => {
    cleanup();
    vi.restoreAllMocks();
    vi.unstubAllGlobals();
    observers.length = 0;
  });

  it("should draw the headings and the cells", () => {
    render(<ReplyTable table={market} label={label} />);

    expect(screen.getByText("Entry")).toBeTruthy();
    expect(screen.getByText("Protein (g)")).toBeTruthy();
    expect(screen.getByText("Bratwurst roll")).toBeTruthy();
    expect(screen.getByText("1 roll (190 g)")).toBeTruthy();
  });

  it("should right align a numeric column and not a text one", () => {
    render(<ReplyTable table={market} label={label} />);

    expect(screen.getByText("520").className).toContain("text-right");
    expect(screen.getByText("Bratwurst roll").className).not.toContain("text-right");
  });

  it("should draw a lone dash muted", () => {
    render(<ReplyTable table={market} label={label} />);

    expect(screen.getByText("–").className).toContain("text-text-muted");
    expect(screen.getByText("21").className).not.toContain("text-text-muted");
  });

  it("should stop observing when it unmounts", () => {
    const { unmount } = render(<ReplyTable table={market} label={label} />);
    expect(observers.length).toBeGreaterThan(0);

    unmount();

    expect(observers).toHaveLength(0);
  });

  it("should hide the cells from a screen reader, which the message reads once as words", () => {
    render(<ReplyTable table={market} label={label} />);

    expect(screen.getByText("Entry").closest("[aria-hidden='true']")).not.toBeNull();
  });

  describe("a table that fits", () => {
    it("should not be a scroll region and cannot be focused", () => {
      render(<ReplyTable table={market} label={label} />);

      expect(screen.queryByRole("region")).toBeNull();
    });

    it("should show no fade", () => {
      render(<ReplyTable table={market} label={label} />);

      expect(screen.queryByTestId("reply-table-fade")).toBeNull();
    });
  });

  describe("a table wider than its reply", () => {
    beforeEach(() => {
      Object.assign(box, { scrollWidth: 900, clientWidth: 300 });
    });

    it("should be a named scroll region the keyboard can reach", async () => {
      render(<ReplyTable table={market} label={label} />);

      await userEvent.tab();

      const region = screen.getByRole("region", { name: label });
      expect(document.activeElement).toBe(region);
    });

    it("should keep the scroll region outside what is hidden from a screen reader", () => {
      render(<ReplyTable table={market} label={label} />);

      expect(
        screen.getByRole("region", { name: label }).closest("[aria-hidden='true']"),
      ).toBeNull();
    });

    it("should fade the right edge while columns are left to see", () => {
      render(<ReplyTable table={market} label={label} />);

      expect(screen.getByTestId("reply-table-fade").getAttribute("aria-hidden")).toBe("true");
    });

    it("should take the fade away at the last column", () => {
      render(<ReplyTable table={market} label={label} />);

      box.scrollLeft = 600;
      fireEvent.scroll(screen.getByRole("region", { name: label }));

      expect(screen.queryByTestId("reply-table-fade")).toBeNull();
    });

    it("should bring the fade back when longer rows move the end", () => {
      render(<ReplyTable table={market} label={label} />);
      box.scrollLeft = 600;
      fireEvent.scroll(screen.getByRole("region", { name: label }));

      resize({ scrollWidth: 1200 });

      expect(screen.getByTestId("reply-table-fade")).toBeTruthy();
    });

    it("should stay wide when its words later measure narrower at the same width", () => {
      render(<ReplyTable table={market} label={label} />);

      resize({ scrollWidth: 280 });

      expect(screen.getByRole("region", { name: label })).toBeTruthy();
    });

    it("should fit again when its width changes", () => {
      render(<ReplyTable table={market} label={label} />);

      resize({ scrollWidth: 280, clientWidth: 400 });

      expect(screen.queryByRole("region")).toBeNull();
    });
  });

  describe("a table arriving", () => {
    function cells() {
      return Array.from(screen.getByText("Entry").closest("[aria-hidden='true']")?.children ?? []);
    }

    it("should draw the mark in the first cell of an empty row under the last row", () => {
      render(<ReplyTable table={market} label={label} pendingMark={<span>caret</span>} />);

      // Four columns: the headings, two rows, then the empty row.
      expect(cells()).toHaveLength(16);
      expect(cells()[12]?.textContent).toBe("caret");
      expect(
        cells()
          .slice(13)
          .map((cell) => cell.textContent),
      ).toEqual(["", "", ""]);
    });

    it("should draw no extra row without the mark", () => {
      render(<ReplyTable table={market} label={label} />);

      expect(cells()).toHaveLength(12);
    });
  });
});
