import { cleanup, fireEvent, render, screen, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { ArrowUp, Shield } from "lucide-react";
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

  describe("trailing icon and regular title", () => {
    it("should draw a muted 16 px icon at the end in place of the chevron", () => {
      const { container } = renderInList(
        <ListRow
          title="Copy yesterday to today"
          chevron={false}
          trailingIcon={ArrowUp}
          onClick={vi.fn()}
        />,
      );

      const icon = container.querySelector("button svg");

      expect(icon?.getAttribute("aria-hidden")).toBe("true");
      expect(icon?.getAttribute("class")).toContain("size-4");
      expect(icon?.getAttribute("class")).toContain("text-text-muted");
      expect(screen.getByRole("button", { name: "Copy yesterday to today" })).toBeTruthy();
    });

    it("should draw the trailing icon even where the chevron is on, and not both", () => {
      const { container } = renderInList(
        <ListRow title="Starter" trailingIcon={ArrowUp} onClick={vi.fn()} />,
      );

      expect(container.querySelectorAll("button svg")).toHaveLength(1);
      expect(container.querySelector("button svg")?.getAttribute("class")).not.toContain(
        "lucide-chevron-right",
      );
    });

    it("should set the title in the body weight when asked, and strong otherwise", () => {
      renderInList(
        <>
          <ListRow title="Regular title" titleWeight="regular" />
          <ListRow title="Default title" />
        </>,
      );

      expect(screen.getByText("Regular title").className).toContain("text-body");
      expect(screen.getByText("Regular title").className).not.toContain("text-body-strong");
      expect(screen.getByText("Default title").className).toContain("text-body-strong");
    });
  });

  describe("trailing tick", () => {
    it("should draw a tick named by its label, in the success colour, at the end of the row", () => {
      renderInList(
        <ListRow
          title="ki-lo-export-2026-10-25.json"
          trailing={{ kind: "tick", label: "Ready" }}
        />,
      );

      const tick = screen.getByRole("img", { name: "Ready" });

      const icon = tick.querySelector("svg");
      expect(icon?.getAttribute("class")).toContain("stroke-success");
      expect(icon?.getAttribute("class")).toContain("size-5");
      expect(tick.parentElement?.lastElementChild).toBe(tick);
    });

    it("should draw the spinner alone while the row is loading, not a done tick beside it", () => {
      renderInList(
        <ListRow
          title="Pull"
          onClick={() => undefined}
          loading
          trailing={{ kind: "tick", label: "Ready" }}
        />,
      );

      expect(screen.getByRole("img", { name: "Loading" })).toBeTruthy();
      expect(screen.queryByRole("img", { name: "Ready" })).toBeNull();
    });

    it("should keep the tick before the chevron on a row that goes somewhere", () => {
      renderWithRouter(
        <ul>
          <ListRow title="Export" href="/more/export" trailing={{ kind: "tick", label: "Ready" }} />
        </ul>,
      );

      const link = screen.getByRole("link", { name: /Export/ });
      const tick = screen.getByRole("img", { name: "Ready" });

      expect(tick.nextElementSibling?.tagName.toLowerCase()).toBe("svg");
      expect(link.lastElementChild).toBe(tick.nextElementSibling);
    });

    it("should draw no tick on a row that has none", () => {
      renderInList(<ListRow title="Expenditure" />);

      expect(screen.queryByRole("img")).toBeNull();
    });
  });

  describe("a danger title", () => {
    it("should draw the title in the danger colour and keep its weight, for a destructive action", () => {
      renderInList(
        <ListRow
          title="Delete all conversations"
          titleTone="danger"
          onClick={vi.fn()}
          chevron={false}
        />,
      );

      const title = screen.getByText("Delete all conversations");

      expect(title.className).toContain("text-danger");
      expect(title.className).toContain("text-body-strong");
    });

    it("should draw the title in the primary colour when no tone is given", () => {
      renderInList(<ListRow title="Weight" />);

      expect(screen.getByText("Weight").className).not.toContain("text-danger");
    });
  });

  describe("with a toggle", () => {
    it("should be a switch named by the toggle label that reports the state a press asks for", () => {
      const onValueChange = vi.fn();
      renderInList(
        <ListRow
          title="Use the assistant"
          toggle={{ isOn: false, label: "Use the assistant", onValueChange }}
        />,
      );

      const toggle = screen.getByRole("switch", { name: "Use the assistant" });
      fireEvent.click(toggle);

      expect(toggle.getAttribute("aria-checked")).toBe("false");
      expect(onValueChange).toHaveBeenCalledExactlyOnceWith(true);
    });

    it("should say it is on, and ask to turn off when pressed", () => {
      const onValueChange = vi.fn();
      renderInList(<ListRow title="Use" toggle={{ isOn: true, label: "Use", onValueChange }} />);

      const toggle = screen.getByRole("switch", { name: "Use" });
      fireEvent.click(toggle);

      expect(toggle.getAttribute("aria-checked")).toBe("true");
      expect(onValueChange).toHaveBeenCalledExactlyOnceWith(false);
    });

    it("should have the switch as its one control, with no button or link around it", () => {
      renderInList(
        <ListRow title="Use" toggle={{ isOn: false, label: "Use", onValueChange: vi.fn() }} />,
      );

      expect(screen.getAllByRole("switch")).toHaveLength(1);
      expect(screen.queryByRole("button")).toBeNull();
      expect(screen.queryByRole("link")).toBeNull();
    });

    it("should hide the visible title from assistive technology so the name is not read twice", () => {
      renderInList(
        <ListRow title="Use" toggle={{ isOn: false, label: "Use", onValueChange: vi.fn() }} />,
      );

      expect(screen.getByText("Use").closest("[aria-hidden]")?.getAttribute("aria-hidden")).toBe(
        "true",
      );
    });

    it("should ignore a press and say it is disabled, keeping focus, when disabled", () => {
      const onValueChange = vi.fn();
      renderInList(
        <ListRow
          title="Use"
          toggle={{ isOn: false, label: "Use", onValueChange, disabled: true }}
        />,
      );

      const toggle = screen.getByRole("switch", { name: "Use" });
      toggle.focus();
      fireEvent.click(toggle);

      expect(onValueChange).not.toHaveBeenCalled();
      expect(toggle.getAttribute("aria-disabled")).toBe("true");
      expect(document.activeElement).toBe(toggle);
    });
  });

  describe("a long title", () => {
    it("should break anywhere, so a long file name wraps inside the row", () => {
      renderInList(<ListRow title="ki-lo-export-2026-10-25.json" />);

      expect(screen.getByText("ki-lo-export-2026-10-25.json").className).toContain(
        "[overflow-wrap:anywhere]",
      );
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

  describe("a macro key", () => {
    // The key is decoration, so the only way to find it is by what it is: a hidden square before the title.
    const keyOf = (item: HTMLElement) => item.querySelector("span[aria-hidden='true']");

    it.each([
      ["calories", "bg-calories"],
      ["protein", "bg-protein"],
      ["carbs", "bg-carbs"],
      ["fat", "bg-fat"],
    ] as const)(
      "should draw the %s colour as an 8 px square with a 2 px radius",
      (macro, colour) => {
        renderInList(<ListRow macro={macro} title="Protein" value="126" unit="g" />);

        const key = keyOf(screen.getByRole("listitem"));

        expect(key?.className).toContain(colour);
        expect(key?.className).toContain("size-2");
        expect(key?.className).toContain("rounded-[2px]");
        expect(key?.className).toContain("shrink-0");
      },
    );

    it("should come before the title and leave the row named by its title alone", () => {
      renderInList(<ListRow macro="protein" title="Protein" value="126" unit="g" />);

      const item = screen.getByRole("listitem");

      expect(keyOf(item)?.nextElementSibling?.textContent).toBe("Protein");
      expect(item.textContent).toBe("Protein126g");
    });

    it("should set the title in the body weight, where a row without a key sets it strong", () => {
      renderInList(
        <>
          <ListRow macro="fat" title="Fat" />
          <ListRow title="Plain" />
        </>,
      );

      expect(screen.getByText("Fat").className).toContain("text-body");
      expect(screen.getByText("Fat").className).not.toContain("text-body-strong");
      expect(screen.getByText("Plain").className).toContain("text-body-strong");
    });

    it("should draw no key on a row that has no macro", () => {
      renderInList(<ListRow title="Plain" value="2,200" unit="kcal" />);

      expect(keyOf(screen.getByRole("listitem"))).toBeNull();
    });

    it("should come after a leading icon, before the title", () => {
      renderInList(<ListRow icon={Shield} macro="carbs" title="Carbohydrate" />);

      const key = keyOf(screen.getByRole("listitem"));

      expect(key?.className).toContain("bg-carbs");
      expect(key?.previousElementSibling?.querySelector("svg")).not.toBeNull();
      expect(key?.nextElementSibling?.textContent).toBe("Carbohydrate");
    });

    it("should stay on a row that goes somewhere, and on one that is loading", () => {
      renderWithRouter(
        <ul>
          <ListRow macro="protein" title="Linked" href="/somewhere" />
          <ListRow macro="fat" title="Busy" onClick={() => undefined} loading />
        </ul>,
      );

      expect(keyOf(screen.getByRole("link", { name: "Linked" }))?.className).toContain(
        "bg-protein",
      );
      const busy = screen.getByRole("button", { name: /^Busy/ });
      expect(keyOf(busy)?.className).toContain("bg-fat");
      expect(within(busy).getByRole("img", { name: "Loading" })).toBeTruthy();
    });

    it("should leave a done tick at the end of the row", () => {
      renderInList(
        <ListRow macro="calories" title="Calories" trailing={{ kind: "tick", label: "Set" }} />,
      );

      const tick = screen.getByRole("img", { name: "Set" });

      expect(keyOf(screen.getByRole("listitem"))?.className).toContain("bg-calories");
      expect(tick.parentElement?.lastElementChild).toBe(tick);
    });
  });

  describe("a row with an action or a label at the end", () => {
    it("should draw an Undo button named by its label and the row's title, in its own tab stop", async () => {
      const onPress = vi.fn();
      renderInList(
        <ListRow
          title="Logged 2 eggs and toast at 08:10"
          subtitle="08:11 · 2 entries"
          trailing={{ kind: "action", label: "Undo", onPress }}
        />,
      );

      const button = screen.getByRole("button", { name: "Undo, Logged 2 eggs and toast at 08:10" });
      await userEvent.click(button);

      expect(button.textContent).toBe("Undo");
      expect(button.className).toContain("text-accent-ink");
      expect(onPress).toHaveBeenCalledTimes(1);
      expect(screen.getAllByRole("button")).toHaveLength(1);
      expect(button.closest("button")?.parentElement?.closest("button")).toBeNull();
      expect(screen.getByText("08:11 · 2 entries").className).toContain("tabular-nums");
    });

    it("should mark the action busy and ignore a press while it is busy, keeping focus", async () => {
      const onPress = vi.fn();
      renderInList(
        <ListRow
          title="Archived recipe"
          trailing={{ kind: "action", label: "Undo", onPress, busy: true }}
        />,
      );

      const button = screen.getByRole("button", { name: "Undo, Archived recipe" });
      await userEvent.click(button);

      expect(button.getAttribute("aria-busy")).toBe("true");
      expect(button.hasAttribute("disabled")).toBe(false);
      expect(onPress).not.toHaveBeenCalled();
    });

    it("should not mark the action busy when it is not", () => {
      renderInList(
        <ListRow
          title="Archived recipe"
          trailing={{ kind: "action", label: "Undo", onPress: vi.fn() }}
        />,
      );

      expect(
        screen.getByRole("button", { name: "Undo, Archived recipe" }).getAttribute("aria-busy"),
      ).toBeNull();
    });

    it("should draw a label as muted text after the words, not as a control", () => {
      renderInList(
        <ListRow title="Copied 8 entries" trailing={{ kind: "label", label: "Undone" }} />,
      );

      const label = screen.getByText("Undone");

      expect(screen.queryByRole("button")).toBeNull();
      expect(label.className).toContain("text-text-muted");
      expect(label.className).toContain("text-caption");
      expect(screen.getByRole("listitem").textContent).toBe("Copied 8 entriesUndone");
    });

    it("should draw the secondary title tone for a row that is done", () => {
      renderInList(
        <ListRow
          title="Copied 8 entries"
          titleTone="secondary"
          trailing={{ kind: "label", label: "Undone" }}
        />,
      );

      expect(screen.getByText("Copied 8 entries").className).toContain("text-text-secondary");
    });

    it("should draw the primary title tone by default", () => {
      renderInList(<ListRow title="Logged" trailing={{ kind: "label", label: "Can't undo" }} />);

      expect(screen.getByText("Logged").className).not.toContain("text-text-secondary");
    });

    it("should refuse, at compile time, what the end-action row would drop", () => {
      renderInList(
        <>
          {/* @ts-expect-error a value is not drawn on a row with an end label */}
          <ListRow title="A" value="1" trailing={{ kind: "label", label: "Undone" }} />
          {/* @ts-expect-error a chevron is not drawn on a row with an end action */}
          <ListRow
            title="B"
            chevron
            trailing={{ kind: "action", label: "Undo", onPress: vi.fn() }}
          />
          {/* @ts-expect-error a danger title is not drawn on a row with an end label */}
          <ListRow title="C" titleTone="danger" trailing={{ kind: "label", label: "Undone" }} />
        </>,
      );

      expect(screen.getAllByRole("listitem")).toHaveLength(3);
    });

    it("should be 60 high at least, as the changes board draws its rows", () => {
      renderInList(<ListRow title="Logged" trailing={{ kind: "label", label: "Can't undo" }} />);

      expect(screen.getByText("Logged").closest("div")?.className).toContain("min-h-[60px]");
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
