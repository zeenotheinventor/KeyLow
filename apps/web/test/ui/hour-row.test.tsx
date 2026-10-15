import { cleanup, fireEvent, render, screen, within } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";

import type { HourRowProps } from "@/components/ui/HourRow";

import { HourRow } from "@/components/ui/HourRow";

function renderHour(props: Partial<HourRowProps> = {}) {
  const onAdd = vi.fn();
  render(
    <HourRow hour={8} label="08:00" foodCount={0} onAdd={onAdd} {...props}>
      {props.children}
    </HourRow>,
  );
  return { onAdd };
}

afterEach(() => {
  cleanup();
});

describe("HourRow", () => {
  it("should show the hour on a chip", () => {
    renderHour();

    expect(screen.getByText("08:00")).toBeTruthy();
  });

  it("should add food at its hour from a plus named for the hour", () => {
    const { onAdd } = renderHour();

    fireEvent.click(screen.getByRole("button", { name: "Add food at 08:00" }));

    expect(onAdd).toHaveBeenCalledExactlyOnceWith(8);
  });

  it("should draw no button at all when there is nowhere to add yet", () => {
    renderHour({ onAdd: undefined, foodCount: 0 });

    expect(screen.queryByRole("button")).toBeNull();
    expect(screen.getByText("08:00")).toBeTruthy();
  });

  it("should draw the plus as the quiet ring, not a filled button", () => {
    renderHour();

    const plus = screen.getByRole("button", { name: "Add food at 08:00" });

    expect(plus.className).toContain("after:border-border");
    expect(plus.className).toContain("rounded-pill");
    expect(plus.className).not.toContain("bg-accent");
  });

  it("should show a focus ring on the plus for the keyboard", () => {
    renderHour();

    expect(screen.getByRole("button", { name: "Add food at 08:00" }).className).toContain(
      "focus-visible:ring-2",
    );
  });

  describe("its name", () => {
    it.each([
      [0, "08:00, nothing logged"],
      [1, "08:00, 1 food"],
      [2, "08:00, 2 foods"],
    ])("should be a group with %i foods named %s", (foodCount, name) => {
      renderHour({ foodCount });

      expect(screen.getByRole("group", { name })).toBeTruthy();
    });
  });

  describe("its foods", () => {
    it("should hold them in a card named for the hour", () => {
      renderHour({ foodCount: 1, children: <p>Porridge oats</p> });

      const card = screen.getByRole("region", { name: "Foods at 08:00" });

      expect(within(card).getByText("Porridge oats")).toBeTruthy();
    });

    it("should draw no card for an hour with nothing logged", () => {
      renderHour();

      expect(screen.queryByRole("region")).toBeNull();
    });
  });

  describe("the current hour", () => {
    it("should carry a dot named Current hour", () => {
      renderHour({ isNow: true });

      expect(screen.getByRole("img", { name: "Current hour" })).toBeTruthy();
    });

    it("should carry no dot on another hour", () => {
      renderHour();

      expect(screen.queryByRole("img", { name: "Current hour" })).toBeNull();
    });
  });

  describe("the guide line", () => {
    it("should be decoration that a screen reader does not meet", () => {
      renderHour();
      const group = screen.getByRole("group");
      const decoration = group.querySelectorAll('[aria-hidden="true"]');

      expect(decoration.length).toBeGreaterThanOrEqual(2);
    });

    it("should be trimmed at the first and the last hour only, so the 24 rows draw one line", () => {
      renderHour();
      const line = screen.getByRole("group").querySelector('[aria-hidden="true"] > span');

      expect(line?.className).toContain("group-first/hour:top-[22px]");
      expect(line?.className).toContain("group-last/hour:bottom-[calc(100%-22px)]");
    });

    it("should leave no gap or margin between hours", () => {
      renderHour();

      expect(screen.getByRole("group").className).not.toMatch(
        /(^|\s)(m[tby]-|gap-\d|gap-y-|space-y-)/,
      );
    });
  });

  it("should put the pluses in hour order for the keyboard", () => {
    render(
      <div>
        {[7, 8, 9].map((hour) => (
          <HourRow
            key={hour}
            hour={hour}
            label={`0${hour}:00`}
            foodCount={0}
            onAdd={() => undefined}
          />
        ))}
      </div>,
    );

    expect(
      screen.getAllByRole("button").map((button) => button.getAttribute("aria-label")),
    ).toEqual(["Add food at 07:00", "Add food at 08:00", "Add food at 09:00"]);
  });
});
