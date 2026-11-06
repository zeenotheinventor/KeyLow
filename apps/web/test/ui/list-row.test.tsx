import { cleanup, fireEvent, render, screen, within } from "@testing-library/react";
import { Shield } from "lucide-react";
import { afterEach, describe, expect, it, vi } from "vitest";

import { renderWithRouter } from "./appRouter";
import { compileUtilities, reducedMotionRules } from "./compileUtilities";

import { ListRow } from "@/components/ui/ListRow";

function renderInList(row: React.ReactNode) {
  return render(<ul>{row}</ul>);
}

describe("ListRow", () => {
  afterEach(() => {
    cleanup();
  });

  it("should be a list item that shows the title and subtitle", () => {
    renderInList(<ListRow title="Weight" subtitle="Coming soon" />);

    const item = screen.getByRole("listitem");

    expect(item.textContent).toContain("Weight");
    expect(item.textContent).toContain("Coming soon");
  });

  it("should show a value after the title, before the chevron", () => {
    renderWithRouter(
      <ul>
        <ListRow title="Targets" subtitle="Set by you" value="2,200 kcal" href="/more/targets" />
      </ul>,
    );

    const link = screen.getByRole("link", { name: /Targets/ });

    expect(link.textContent).toBe("TargetsSet by you2,200 kcal");
    expect(screen.getByText("2,200 kcal").className).toContain("tabular-nums");
  });

  it("should be plain text with no control when it goes nowhere", () => {
    renderInList(<ListRow title="Expenditure" />);

    expect(screen.queryByRole("button")).toBeNull();
    expect(screen.queryByRole("link")).toBeNull();
  });

  describe("as a submit button", () => {
    it("should submit the form it is in, as a button named by its text", () => {
      const onSubmit = vi.fn((event: React.SyntheticEvent) => {
        event.preventDefault();
      });
      render(
        <form onSubmit={onSubmit}>
          <ul>
            <ListRow title="Sign out" subtitle="ada@example.com" submit chevron={false} />
          </ul>
        </form>,
      );

      fireEvent.click(screen.getByRole("button", { name: /Sign out/ }));

      expect(onSubmit).toHaveBeenCalledOnce();
    });
  });

  describe("as a link", () => {
    it("should be a link named by its text", () => {
      renderInList(
        <ListRow title="Your foods" subtitle="Foods you created or copied" href="/foods" />,
      );

      const link = screen.getByRole("link", { name: /Your foods/ });

      expect(link.getAttribute("href")).toBe("/foods");
    });

    it("should open the page through the router, so the app is not loaded again", () => {
      const { push } = renderWithRouter(
        <ul>
          <ListRow title="Your foods" href="/foods?scope=own" />
        </ul>,
      );

      const notCancelled = fireEvent.click(screen.getByRole("link", { name: "Your foods" }));

      expect(notCancelled).toBe(false);
      expect(push).toHaveBeenCalledExactlyOnceWith("/foods?scope=own", expect.anything());
    });

    it("should not be reachable when disabled", () => {
      renderInList(<ListRow title="Your foods" href="/foods" disabled />);

      const link = screen.getByRole("link", { name: "Your foods" });

      expect(link.getAttribute("href")).toBeNull();
      expect(link.getAttribute("aria-disabled")).toBe("true");
    });
  });

  describe("as a button", () => {
    it("should be a button that reports a click", () => {
      const onClick = vi.fn();
      renderInList(
        <ListRow title="Sign out" subtitle="sam.taylor@example.com" onClick={onClick} />,
      );

      fireEvent.click(screen.getByRole("button", { name: /Sign out/ }));

      expect(onClick).toHaveBeenCalledTimes(1);
    });

    it("should be disabled when told", () => {
      const onClick = vi.fn();
      renderInList(<ListRow title="Weight" onClick={onClick} disabled />);

      const button = screen.getByRole("button", { name: "Weight" });
      fireEvent.click(button);

      expect(button).toHaveProperty("disabled", true);
      expect(onClick).not.toHaveBeenCalled();
    });

    it("should dim itself when disabled", () => {
      renderInList(<ListRow title="Weight" onClick={() => undefined} disabled />);

      expect(screen.getByRole("button", { name: "Weight" }).className).toContain("opacity-50");
    });
  });

  describe("loading", () => {
    it("should be busy and draw a spinner in place of the chevron", () => {
      renderInList(<ListRow title="Pull" onClick={() => undefined} loading />);

      const button = screen.getByRole("button", { name: /^Pull/ });

      expect(button.getAttribute("aria-busy")).toBe("true");
      expect(button.querySelector("svg")).toBeNull();
      expect(within(button).getByRole("img", { name: "Loading" })).toBeTruthy();
    });

    it("should ignore a press while it works, and report one again once it clears", () => {
      const onClick = vi.fn();
      const { rerender } = renderInList(<ListRow title="Pull" onClick={onClick} loading />);

      fireEvent.click(screen.getByRole("button", { name: /^Pull/ }));
      expect(onClick).not.toHaveBeenCalled();

      rerender(
        <ul>
          <ListRow title="Pull" onClick={onClick} />
        </ul>,
      );
      fireEvent.click(screen.getByRole("button", { name: "Pull" }));
      expect(onClick).toHaveBeenCalledTimes(1);
    });

    it("should stay enabled, so focus is not lost while it works", () => {
      renderInList(<ListRow title="Pull" onClick={() => undefined} loading />);

      expect(screen.getByRole("button", { name: /^Pull/ })).toHaveProperty("disabled", false);
    });

    it("should not be busy and keep its chevron when not loading", () => {
      renderInList(<ListRow title="Pull" onClick={() => undefined} />);

      const button = screen.getByRole("button", { name: "Pull" });

      expect(button.getAttribute("aria-busy")).toBeNull();
      expect(button.querySelector("svg")).not.toBeNull();
    });
  });

  describe("chevron", () => {
    it("should show a decorative chevron on a row that goes somewhere", () => {
      renderInList(<ListRow title="Your foods" href="/foods" />);

      const chevron = screen.getByRole("link", { name: "Your foods" }).querySelector("svg");

      expect(chevron?.getAttribute("aria-hidden")).toBe("true");
    });

    it("should leave the chevron off when told", () => {
      renderInList(<ListRow title="Sign out" onClick={() => undefined} chevron={false} />);

      expect(screen.getByRole("button", { name: "Sign out" }).querySelector("svg")).toBeNull();
    });

    it("should not draw a chevron on a row that goes nowhere", () => {
      renderInList(<ListRow title="Expenditure" />);

      expect(screen.getByRole("listitem").querySelector("svg")).toBeNull();
    });
  });

  describe("icon", () => {
    // Lucide icons carry no role, so a stand-in that does lets the test find the one the row draws.
    function MarkerIcon(props: {
      className?: string;
      strokeWidth?: number;
      "aria-hidden"?: boolean;
    }) {
      return <svg role="img" aria-label="Marker" {...props} />;
    }

    it("should draw no icon unless it is given one", () => {
      renderInList(<ListRow title="Your foods" href="/foods" />);

      expect(screen.queryByRole("img", { hidden: true })).toBeNull();
    });

    it("should draw the icon, decorative and 20 px, in a 36 px tile on the raised surface", () => {
      renderInList(<ListRow icon={MarkerIcon} title="Privacy Policy" href="/privacy" />);

      const icon = screen.getByRole("img", { hidden: true });
      expect(icon.getAttribute("aria-hidden")).toBe("true");
      expect(icon.getAttribute("class")).toContain("size-5");
      expect(icon.getAttribute("stroke-width")).toBe("1.75");
      expect(icon.parentElement?.className).toContain("h-control-sm");
      expect(icon.parentElement?.className).toContain("w-control-sm");
      expect(icon.parentElement?.className).toContain("rounded-small");
      expect(icon.parentElement?.className).toContain("bg-surface-raised");
      expect(icon.parentElement?.className).toContain("text-text-secondary");
    });

    it("should leave the row named by its title alone", () => {
      renderInList(<ListRow icon={Shield} title="Privacy Policy" href="/privacy" />);

      expect(screen.getByRole("link", { name: "Privacy Policy" })).toBeTruthy();
    });
  });

  describe("a weigh-in row: badge, unit and the figure's look", () => {
    it("should show a badge in its tone between the text and the value, and say it in the row's text", () => {
      renderInList(
        <ListRow
          title="Wed 14 Oct"
          subtitle="08:31 · Added by you"
          badge={{ label: "Left out of trend", tone: "warning" }}
          value="88.9"
          unit="kg"
        />,
      );

      const badge = screen.getByText("Left out of trend");
      expect(badge.className).toContain("bg-warning-muted");
      expect(screen.getByRole("listitem").textContent).toBe(
        "Wed 14 Oct08:31 · Added by youLeft out of trend88.9kg",
      );
    });

    it("should draw no badge unless one is given, and leave the text column as it was", () => {
      renderInList(<ListRow title="Today" subtitle="07:10 · Added by you" />);

      expect(screen.getByRole("listitem").textContent).toBe("Today07:10 · Added by you");
      expect(screen.getByText("Today").parentElement?.className).not.toContain("md:flex-row");
    });

    it("should put the unit after the value in the muted caption look", () => {
      renderInList(<ListRow title="Today" value="81.4" unit="kg" valueLook="numeral" />);

      const unit = screen.getByText("kg");
      expect(unit.className).toContain("text-caption");
      expect(unit.className).toContain("text-text-muted");
      expect(unit.previousElementSibling?.textContent).toBe("81.4");
    });

    it("should draw a numeral value strong and in the primary colour, and a muted one in the muted colour", () => {
      renderInList(
        <>
          <ListRow title="Today" value="81.4" unit="kg" valueLook="numeral" />
          <ListRow title="Wed" value="88.9" unit="kg" valueLook="numeral" valueTone="muted" />
        </>,
      );

      expect(screen.getByText("81.4").className).toContain("text-body-strong");
      expect(screen.getByText("81.4").className).toContain("text-text-primary");
      expect(screen.getByText("88.9").className).toContain("text-text-muted");
      expect(screen.getByText("88.9").className).not.toContain("text-text-primary");
    });

    it("should draw no unit on a row that has no value", () => {
      renderInList(<ListRow title="Today" unit="kg" valueLook="numeral" />);

      expect(screen.queryByText("kg")).toBeNull();
    });

    it("should leave a value without a look as the quiet secondary text it was", () => {
      renderInList(<ListRow title="Targets" value="2,200 kcal" />);

      expect(screen.getByText("2,200 kcal").className).toContain("text-text-secondary");
    });
  });

  describe("reduced motion", () => {
    it("should drop the press scale under prefers-reduced-motion", async () => {
      renderInList(<ListRow title="Your foods" href="/foods" />);
      const css = await compileUtilities(screen.getByRole("link").className);

      expect(reducedMotionRules(css, "motion-reduce\\:active\\:scale-100")).toContain("transform");
    });
  });
});
