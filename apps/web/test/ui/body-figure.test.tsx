import { readFileSync } from "node:fs";
import { join } from "node:path";

import { MUSCLE_NAMES } from "@keylow/core/copy";
import { BODY_ARTWORK, MUSCLE_IDS, ROLE_FIGURE_VALUES } from "@keylow/core/training";
import { act, cleanup, fireEvent, render, screen } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import { compileUtilities } from "./compileUtilities";

import type { BodyFigureProps } from "@/components/ui/BodyFigure";
import type { MuscleId } from "@keylow/core/training";
import type { ReactNode } from "react";

import { BodyFigure } from "@/components/ui/BodyFigure";

const label = "Body map, front";

const bodies = ["male", "female"] as const;

function renderFigure(props: Partial<BodyFigureProps> = {}) {
  return render(
    <BodyFigure label={label} scale="heat" side="front" values={{}} w={120} {...props} />,
  );
}

/** The button of a muscle, found by its name and value, as a screen reader reads it. */
function muscleButton(muscle: MuscleId, value: string) {
  return screen.getByRole("button", { name: `${MUSCLE_NAMES[muscle]}, ${value}` });
}

const noop = () => {};

/** The screen around the figure, which takes a click on the empty figure to toggle the view. */
function AroundTheFigure({ children, onClick }: { children: ReactNode; onClick: () => void }) {
  return (
    <div onClick={onClick} onKeyDown={noop} role="presentation">
      {children}
    </div>
  );
}

describe("BodyFigure", () => {
  afterEach(() => {
    cleanup();
    vi.useRealTimers();
  });

  describe("as an image", () => {
    it("should be one image named by its label and nothing to tab to when no handler is given", () => {
      renderFigure();

      const figure = screen.getByRole("img", { name: label });
      expect(screen.queryAllByRole("button")).toHaveLength(0);
      expect(figure.innerHTML).not.toContain("tabindex");
    });

    it("should be as tall as the 200 by 440 drawing for its width", () => {
      renderFigure({ w: 96 });

      const figure = screen.getByRole("img", { name: label });
      expect(figure.getAttribute("viewBox")).toBe("0 0 200 440");
      expect(figure.getAttribute("width")).toBe("96");
      expect(figure.getAttribute("height")).toBe("211.2");
    });

    it("should keep its width in a flex row that would squeeze it", () => {
      renderFigure();

      expect(screen.getByRole("img", { name: label }).getAttribute("class")).toContain("shrink-0");
    });

    it("should draw the male figure when no body is given", () => {
      renderFigure({ onPressMuscle: noop });

      expect(muscleButton("quads", "Rested").getAttribute("d")).toBe(
        BODY_ARTWORK.male.front.muscles.quads,
      );
    });

    it("should draw the silhouette under the muscles in the silhouette token", () => {
      renderFigure();

      expect(screen.getByRole("img", { name: label }).innerHTML).toContain("fill-body-silhouette");
    });
  });

  describe.each(bodies)("the %s drawing", (body) => {
    it("should draw each of the 22 muscles once across the two sides, each a button with a name", () => {
      render(
        <>
          <BodyFigure
            body={body}
            label="Front"
            onPressMuscle={noop}
            scale="heat"
            side="front"
            values={{}}
            w={120}
          />
          <BodyFigure
            body={body}
            label="Back"
            onPressMuscle={noop}
            scale="heat"
            side="back"
            values={{}}
            w={120}
          />
        </>,
      );

      const names = screen
        .getAllByRole("button")
        .map((button) => button.getAttribute("aria-label"));
      const expected = MUSCLE_IDS.map((muscle) => `${MUSCLE_NAMES[muscle]}, Rested`);
      expect(names).toHaveLength(22);
      expect([...names].sort()).toEqual([...expected].sort());
    });

    it("should draw the path of that figure for a muscle", () => {
      renderFigure({ body, onPressMuscle: noop });

      expect(muscleButton("quads", "Rested").getAttribute("d")).toBe(
        BODY_ARTWORK[body].front.muscles.quads,
      );
    });

    it("should fill each muscle with the token class of its heat step", () => {
      const values = Object.fromEntries(MUSCLE_IDS.map((muscle, index) => [muscle, index % 6]));
      render(
        <>
          <BodyFigure
            body={body}
            label="Front"
            onPressMuscle={noop}
            scale="heat"
            side="front"
            values={values}
            w={120}
          />
          <BodyFigure
            body={body}
            label="Back"
            onPressMuscle={noop}
            scale="heat"
            side="back"
            values={values}
            w={120}
          />
        </>,
      );

      MUSCLE_IDS.forEach((muscle, index) => {
        const button = screen.getByRole("button", {
          name: new RegExp(`^${MUSCLE_NAMES[muscle]}, `),
        });
        expect(button.getAttribute("class")).toContain(`fill-heat-${index % 6}`);
      });
    });
  });

  describe("the fill of each value", () => {
    const cases = [
      ["heat", 0, "Rested", "fill-heat-0"],
      ["heat", 1, "Ready", "fill-heat-1"],
      ["heat", 2, "Warm", "fill-heat-2"],
      ["heat", 3, "Hot", "fill-heat-3"],
      ["heat", 4, "Very hot", "fill-heat-4"],
      ["heat", 5, "Peak", "fill-heat-5"],
      ["volume", 0, "Not trained", "fill-volume-not-trained"],
      ["volume", 1, "Maintaining", "fill-volume-maintaining"],
      ["volume", 2, "Growing", "fill-volume-growing"],
      ["volume", 3, "Productive", "fill-volume-productive"],
      ["volume", 4, "High", "fill-volume-high"],
      ["gap", 0, "Behind", "fill-gap-behind"],
      ["gap", 1, "On plan", "fill-gap-on-plan"],
      ["gap", 2, "Ahead", "fill-gap-ahead"],
      ["gap", 3, "Not in plan", "fill-volume-not-trained"],
      ["role", 0, "Not worked", "fill-heat-0"],
      ["role", ROLE_FIGURE_VALUES.stabiliser, "Assisting", "fill-role-assist"],
      ["role", ROLE_FIGURE_VALUES.secondary, "Secondary", "fill-role-secondary"],
      ["role", ROLE_FIGURE_VALUES.primary, "Primary", "fill-role-primary"],
    ] as const;

    it.each(cases)(
      "should fill a %s value of %s, read as %s, with %s",
      (scale, value, word, fill) => {
        renderFigure({ scale, values: { quads: value }, onPressMuscle: noop });

        expect(muscleButton("quads", word).getAttribute("class")).toContain(fill);
      },
    );

    it("should read a muscle with no value as at rest on heat and not worked on role", () => {
      renderFigure({ scale: "role", values: {}, onPressMuscle: noop });

      expect(muscleButton("quads", "Not worked").getAttribute("class")).toContain("fill-heat-0");
    });
  });

  describe("the token classes", () => {
    it("should all be emitted by Tailwind from the component's own source", async () => {
      const source = readFileSync(
        join(__dirname, "../../components/ui/BodyFigure/muscleClasses.ts"),
        "utf8",
      );
      const wanted = [
        "fill-heat-0",
        "fill-heat-5",
        "fill-volume-not-trained",
        "fill-volume-maintaining",
        "fill-volume-growing",
        "fill-volume-productive",
        "fill-volume-high",
        "fill-gap-behind",
        "fill-gap-on-plan",
        "fill-gap-ahead",
        "fill-role-primary",
        "fill-role-secondary",
        "fill-role-assist",
        "stroke-body-separator",
        "stroke-text-primary",
      ];

      const css = await compileUtilities(source);

      for (const className of wanted) {
        expect(css).toContain(`.${className}`);
      }
      expect(css).toContain(".focus-visible\\:stroke-focus-ring:focus-visible");
      expect(css).toContain(".focus-visible\\:\\[stroke-width\\:3\\]:focus-visible");
    });
  });

  describe("the glow", () => {
    it("should glow a muscle at heat step 5 and no other", () => {
      renderFigure({ values: { quads: 5, abs: 4 }, onPressMuscle: noop });

      expect(muscleButton("quads", "Peak").getAttribute("filter")).toMatch(/^url\(#\w+\)$/);
      expect(muscleButton("abs", "Very hot").hasAttribute("filter")).toBe(false);
    });

    it("should point the glow at a filter in the figure", () => {
      renderFigure({ values: { quads: 5 }, onPressMuscle: noop });

      const reference = muscleButton("quads", "Peak").getAttribute("filter") ?? "";
      const id = reference.slice("url(#".length, -1);
      expect(document.getElementById(id)?.tagName.toLowerCase()).toBe("filter");
    });

    it("should give two figures on a page their own filters", () => {
      render(
        <>
          <BodyFigure
            label="One"
            onPressMuscle={noop}
            scale="heat"
            side="front"
            values={{ quads: 5 }}
            w={120}
          />
          <BodyFigure
            label="Two"
            onPressMuscle={noop}
            scale="heat"
            side="front"
            values={{ quads: 5 }}
            w={120}
          />
        </>,
      );

      const [first, second] = screen.getAllByRole("button", { name: "Quads, Peak" });
      expect(first?.getAttribute("filter")).not.toBe(second?.getAttribute("filter"));
    });

    it("should not glow on the volume scale, whatever the value", () => {
      renderFigure({ scale: "volume", values: { quads: 5 }, onPressMuscle: noop });

      expect(muscleButton("quads", "Not trained").hasAttribute("filter")).toBe(false);
    });

    it("should draw no filter when no muscle glows", () => {
      renderFigure({ values: { quads: 3 } });

      expect(screen.getByRole("img", { name: label }).innerHTML).not.toContain("<filter");
    });
  });

  describe("selected and dimmed", () => {
    it("should outline the selected muscle in the primary text colour, thicker than the rest", () => {
      renderFigure({ selected: "quads", values: { quads: 3, abs: 3 }, onPressMuscle: noop });

      const quads = muscleButton("quads", "Hot");
      const abs = muscleButton("abs", "Hot");
      expect(quads.getAttribute("class")).toContain("stroke-text-primary");
      expect(quads.getAttribute("stroke-width")).toBe("2.6");
      expect(abs.getAttribute("class")).toContain("stroke-body-separator");
      expect(abs.getAttribute("stroke-width")).toBe("1.4");
    });

    it("should fade the whole figure by dim", () => {
      renderFigure({ dim: 0.4, onPressMuscle: noop });

      expect(muscleButton("quads", "Rested").parentElement?.getAttribute("opacity")).toBe("0.4");
    });

    it("should leave the figure at full strength by default", () => {
      renderFigure({ onPressMuscle: noop });

      expect(muscleButton("quads", "Rested").parentElement?.getAttribute("opacity")).toBe("1");
    });

    it("should fade every muscle but the selected one by unselectedOpacity", () => {
      renderFigure({ selected: "quads", unselectedOpacity: 0.3, onPressMuscle: noop });

      expect(muscleButton("quads", "Rested").getAttribute("opacity")).toBe("1");
      expect(muscleButton("abs", "Rested").getAttribute("opacity")).toBe("0.3");
    });

    it("should leave the muscles alone when nothing is selected", () => {
      renderFigure({ unselectedOpacity: 0.3, onPressMuscle: noop });

      expect(muscleButton("abs", "Rested").getAttribute("opacity")).toBe("1");
    });
  });

  describe("the keyboard", () => {
    it("should put every muscle on the tab order when a handler is given", () => {
      renderFigure({ onPressMuscle: noop });

      const buttons = screen.getAllByRole("button");
      expect(buttons).toHaveLength(12);
      for (const button of buttons) {
        expect(button.getAttribute("tabindex")).toBe("0");
      }
    });

    it("should put the muscles of the back on the tab order too", () => {
      renderFigure({ side: "back", onLongPressMuscle: noop });

      expect(screen.getAllByRole("button")).toHaveLength(10);
    });

    it("should draw a focus ring from the focus token on the focused muscle", () => {
      renderFigure({ onPressMuscle: noop });

      expect(muscleButton("quads", "Rested").getAttribute("class")).toContain(
        "focus-visible:stroke-focus-ring",
      );
    });

    it.each(["Enter", " "])("should press a muscle on %j", (key) => {
      const onPressMuscle = vi.fn();
      renderFigure({ onPressMuscle });

      fireEvent.keyDown(muscleButton("quads", "Rested"), { key });

      expect(onPressMuscle).toHaveBeenCalledExactlyOnceWith("quads");
    });

    it.each(["Enter", " "])("should open the details on %j when the screen passes them", (key) => {
      const onPressMuscle = vi.fn();
      const onLongPressMuscle = vi.fn();
      renderFigure({ onPressMuscle, onLongPressMuscle });

      fireEvent.keyDown(muscleButton("quads", "Rested"), { key });

      expect(onLongPressMuscle).toHaveBeenCalledExactlyOnceWith("quads");
      expect(onPressMuscle).not.toHaveBeenCalled();
    });

    it("should leave other keys alone", () => {
      const onPressMuscle = vi.fn();
      renderFigure({ onPressMuscle });

      fireEvent.keyDown(muscleButton("quads", "Rested"), { key: "a" });

      expect(onPressMuscle).not.toHaveBeenCalled();
    });

    it("should press once for a key held down, not once for each repeat", () => {
      const onPressMuscle = vi.fn();
      renderFigure({ onPressMuscle });
      const quads = muscleButton("quads", "Rested");

      fireEvent.keyDown(quads, { key: "Enter" });
      fireEvent.keyDown(quads, { key: "Enter", repeat: true });
      fireEvent.keyDown(quads, { key: "Enter", repeat: true });

      expect(onPressMuscle).toHaveBeenCalledExactlyOnceWith("quads");
    });

    it("should still not scroll the page while Space is held down", () => {
      renderFigure({ onPressMuscle: noop });

      const wasNotPrevented = fireEvent.keyDown(muscleButton("quads", "Rested"), {
        key: " ",
        repeat: true,
      });

      expect(wasNotPrevented).toBe(false);
    });

    it("should not scroll the page on Space", () => {
      renderFigure({ onPressMuscle: noop });

      const wasNotPrevented = fireEvent.keyDown(muscleButton("quads", "Rested"), { key: " " });

      expect(wasNotPrevented).toBe(false);
    });
  });

  describe("the pointer", () => {
    beforeEach(() => {
      vi.useFakeTimers();
    });

    const down = (element: Element, x = 50, y = 50) =>
      fireEvent.pointerDown(element, { clientX: x, clientY: y, button: 0, isPrimary: true });
    const move = (element: Element, x: number, y: number) =>
      fireEvent.pointerMove(element, { clientX: x, clientY: y, isPrimary: true });
    const up = (element: Element, x = 50, y = 50) =>
      fireEvent.pointerUp(element, { clientX: x, clientY: y, button: 0, isPrimary: true });

    it("should press a muscle on a click", () => {
      const onPressMuscle = vi.fn();
      const onLongPressMuscle = vi.fn();
      renderFigure({ onPressMuscle, onLongPressMuscle });
      const quads = muscleButton("quads", "Rested");

      down(quads);
      up(quads);
      fireEvent.click(quads);

      expect(onPressMuscle).toHaveBeenCalledExactlyOnceWith("quads");
      expect(onLongPressMuscle).not.toHaveBeenCalled();
    });

    it("should press a muscle on a click with no pointer events, as a screen reader sends it", () => {
      const onPressMuscle = vi.fn();
      renderFigure({ onPressMuscle });

      fireEvent.click(muscleButton("quads", "Rested"));

      expect(onPressMuscle).toHaveBeenCalledExactlyOnceWith("quads");
    });

    it("should long press once after 500 milliseconds and send no press after it", () => {
      const onPressMuscle = vi.fn();
      const onLongPressMuscle = vi.fn();
      renderFigure({ onPressMuscle, onLongPressMuscle });
      const quads = muscleButton("quads", "Rested");

      down(quads);
      act(() => {
        vi.advanceTimersByTime(499);
      });
      expect(onLongPressMuscle).not.toHaveBeenCalled();
      act(() => {
        vi.advanceTimersByTime(1);
      });
      up(quads);
      fireEvent.click(quads);
      act(() => {
        vi.advanceTimersByTime(2000);
      });

      expect(onLongPressMuscle).toHaveBeenCalledExactlyOnceWith("quads");
      expect(onPressMuscle).not.toHaveBeenCalled();
    });

    it("should not long press a pointer lifted before the delay, and press it", () => {
      const onPressMuscle = vi.fn();
      const onLongPressMuscle = vi.fn();
      renderFigure({ onPressMuscle, onLongPressMuscle });
      const quads = muscleButton("quads", "Rested");

      down(quads);
      act(() => {
        vi.advanceTimersByTime(300);
      });
      up(quads);
      fireEvent.click(quads);
      act(() => {
        vi.advanceTimersByTime(2000);
      });

      expect(onLongPressMuscle).not.toHaveBeenCalled();
      expect(onPressMuscle).toHaveBeenCalledExactlyOnceWith("quads");
    });

    it("should do neither when the pointer moves 15 pixels", () => {
      const onPressMuscle = vi.fn();
      const onLongPressMuscle = vi.fn();
      renderFigure({ onPressMuscle, onLongPressMuscle });
      const quads = muscleButton("quads", "Rested");

      down(quads, 50, 50);
      move(quads, 65, 50);
      act(() => {
        vi.advanceTimersByTime(1000);
      });
      up(quads, 65, 50);
      fireEvent.click(quads);

      expect(onLongPressMuscle).not.toHaveBeenCalled();
      expect(onPressMuscle).not.toHaveBeenCalled();
    });

    it("should still long press a pointer that wobbles within the slop", () => {
      const onLongPressMuscle = vi.fn();
      renderFigure({ onLongPressMuscle });
      const quads = muscleButton("quads", "Rested");

      down(quads, 50, 50);
      move(quads, 56, 56);
      act(() => {
        vi.advanceTimersByTime(500);
      });

      expect(onLongPressMuscle).toHaveBeenCalledExactlyOnceWith("quads");
    });

    it("should not long press when the pointer is cancelled, as when the page scrolls", () => {
      const onLongPressMuscle = vi.fn();
      renderFigure({ onLongPressMuscle });
      const quads = muscleButton("quads", "Rested");

      down(quads);
      fireEvent.pointerCancel(quads);
      act(() => {
        vi.advanceTimersByTime(1000);
      });

      expect(onLongPressMuscle).not.toHaveBeenCalled();
    });

    it("should not long press after the figure has gone", () => {
      const onLongPressMuscle = vi.fn();
      const { unmount } = renderFigure({ onLongPressMuscle });

      down(muscleButton("quads", "Rested"));
      unmount();
      act(() => {
        vi.advanceTimersByTime(1000);
      });

      expect(onLongPressMuscle).not.toHaveBeenCalled();
    });

    it("should not long press for a button other than the main one", () => {
      const onLongPressMuscle = vi.fn();
      renderFigure({ onLongPressMuscle });

      fireEvent.pointerDown(muscleButton("quads", "Rested"), {
        clientX: 50,
        clientY: 50,
        button: 2,
        isPrimary: true,
      });
      act(() => {
        vi.advanceTimersByTime(1000);
      });

      expect(onLongPressMuscle).not.toHaveBeenCalled();
    });

    it("should press on a click with no pointer down, after a press has ended and the pointer moved on", () => {
      const onPressMuscle = vi.fn();
      renderFigure({ onPressMuscle });
      const quads = muscleButton("quads", "Rested");
      const figure = screen.getByRole("group", { name: label });

      down(quads, 50, 50);
      up(quads, 50, 50);
      fireEvent.click(quads);
      move(figure, 200, 200);
      fireEvent.click(quads);

      expect(onPressMuscle).toHaveBeenCalledTimes(2);
    });

    it("should press on a click with no pointer down, after a press was cancelled and the pointer moved on", () => {
      const onPressMuscle = vi.fn();
      renderFigure({ onPressMuscle });
      const quads = muscleButton("quads", "Rested");
      const figure = screen.getByRole("group", { name: label });

      down(quads, 50, 50);
      fireEvent.pointerCancel(quads);
      move(figure, 200, 200);
      fireEvent.click(quads);

      expect(onPressMuscle).toHaveBeenCalledExactlyOnceWith("quads");
    });

    it("should press on the next click when a hold was released outside the figure", () => {
      const onPressMuscle = vi.fn();
      const onLongPressMuscle = vi.fn();
      renderFigure({ onPressMuscle, onLongPressMuscle });
      const quads = muscleButton("quads", "Rested");

      down(quads);
      act(() => {
        vi.advanceTimersByTime(500);
      });
      // The pointer is lifted off the figure, so neither a pointer up nor a click reaches it.
      down(quads);
      up(quads);
      fireEvent.click(quads);

      expect(onLongPressMuscle).toHaveBeenCalledOnce();
      expect(onPressMuscle).toHaveBeenCalledExactlyOnceWith("quads");
    });

    it("should not long press when the pointer leaves the figure", () => {
      const onLongPressMuscle = vi.fn();
      renderFigure({ onLongPressMuscle });
      const quads = muscleButton("quads", "Rested");

      down(quads);
      fireEvent.pointerLeave(screen.getByRole("group", { name: label }));
      act(() => {
        vi.advanceTimersByTime(1000);
      });

      expect(onLongPressMuscle).not.toHaveBeenCalled();
    });

    it("should keep the browser's context menu off a muscle that can be held", () => {
      renderFigure({ onLongPressMuscle: noop });

      const wasNotPrevented = fireEvent.contextMenu(muscleButton("quads", "Rested"));

      expect(wasNotPrevented).toBe(false);
    });

    it("should leave the context menu alone when no muscle can be held", () => {
      renderFigure({ onPressMuscle: noop });

      const wasNotPrevented = fireEvent.contextMenu(muscleButton("quads", "Rested"));

      expect(wasNotPrevented).toBe(true);
    });

    it("should keep a click on a muscle from reaching the screen around the figure", () => {
      const onClickAround = vi.fn();
      render(
        <AroundTheFigure onClick={onClickAround}>
          <BodyFigure
            label={label}
            onPressMuscle={noop}
            scale="heat"
            side="front"
            values={{}}
            w={120}
          />
        </AroundTheFigure>,
      );

      fireEvent.click(muscleButton("quads", "Rested"));

      expect(onClickAround).not.toHaveBeenCalled();
    });

    it("should let a click on the empty figure reach the screen around it", () => {
      const onClickAround = vi.fn();
      render(
        <AroundTheFigure onClick={onClickAround}>
          <BodyFigure
            label={label}
            onPressMuscle={noop}
            scale="heat"
            side="front"
            values={{}}
            w={120}
          />
        </AroundTheFigure>,
      );
      const figure = screen.getByRole("group", { name: label });

      down(figure);
      up(figure);
      fireEvent.click(figure);

      expect(onClickAround).toHaveBeenCalledOnce();
    });

    it("should let a click on a plain image reach the screen around it", () => {
      const onClickAround = vi.fn();
      render(
        <AroundTheFigure onClick={onClickAround}>
          <BodyFigure label={label} scale="heat" side="front" values={{}} w={120} />
        </AroundTheFigure>,
      );

      fireEvent.click(screen.getByRole("img", { name: label }));

      expect(onClickAround).toHaveBeenCalledOnce();
    });

    it("should not send a drag across the empty figure to the screen around it", () => {
      const onClickAround = vi.fn();
      render(
        <AroundTheFigure onClick={onClickAround}>
          <BodyFigure
            label={label}
            onPressMuscle={noop}
            scale="heat"
            side="front"
            values={{}}
            w={120}
          />
        </AroundTheFigure>,
      );
      const figure = screen.getByRole("group", { name: label });

      down(figure, 50, 50);
      move(figure, 80, 50);
      up(figure, 80, 50);
      fireEvent.click(figure);

      expect(onClickAround).not.toHaveBeenCalled();
    });

    it("should let the next click through after a drag", () => {
      const onPressMuscle = vi.fn();
      renderFigure({ onPressMuscle });
      const quads = muscleButton("quads", "Rested");

      down(quads, 50, 50);
      move(quads, 80, 50);
      up(quads, 80, 50);
      fireEvent.click(quads);
      down(quads, 50, 50);
      up(quads, 50, 50);
      fireEvent.click(quads);

      expect(onPressMuscle).toHaveBeenCalledExactlyOnceWith("quads");
    });
  });
});
