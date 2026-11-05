import { cleanup, render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { useState } from "react";
import { afterEach, describe, expect, it, vi } from "vitest";

import { OptionCard, OptionCardGroup } from "@/components/ui/OptionCard";

afterEach(cleanup);

const goals = [
  { id: "aesthetic", title: "Look better", description: "Build muscle where it shows." },
  { id: "strength", title: "Get stronger", description: "Lift more on the big lifts." },
  { id: "hybrid", title: "Both", description: "Strength and size." },
] as const;

type Goal = (typeof goals)[number]["id"];

function Goals({ initial, onChange }: { initial?: Goal; onChange?: (id: Goal) => void }) {
  const [value, setValue] = useState<Goal | undefined>(initial);
  return (
    <OptionCardGroup
      label="What are you training for?"
      options={goals}
      value={value}
      onChange={(id) => {
        setValue(id);
        onChange?.(id);
      }}
    />
  );
}

const focuses = [
  { id: "chest", title: "Chest", description: "Upper and lower chest" },
  { id: "arms", title: "Arms", description: "Biceps and triceps" },
] as const;

function Focuses({ initial = [] }: { initial?: ("chest" | "arms")[] }) {
  const [value, setValue] = useState(initial);
  return (
    <OptionCardGroup
      selection="multiple"
      label="Anything to focus on?"
      options={focuses}
      value={value}
      onChange={setValue}
    />
  );
}

describe("OptionCard", () => {
  it("should name the card by its title, badge, description, reason and value, without closing full stops", () => {
    render(
      <OptionCard
        title="Steady"
        description="A steady pace."
        badge={{ children: "Suggested" }}
        value="0.4 kg"
        valueCaption="a week"
        disabledReason="Not offered under 18."
        checked={false}
        onPress={() => undefined}
      />,
    );

    const card = screen.getByRole<HTMLButtonElement>("radio", {
      name: "Steady, Suggested, A steady pace, Not offered under 18, 0.4 kg a week",
    });
    expect(card.disabled).toBe(true);
  });

  it("should say the value as its label when it has one", () => {
    render(
      <OptionCard
        title="Steady"
        value="0.4 kg"
        valueCaption="a week"
        valueLabel="about 0.4 kilograms a week"
        checked={false}
        onPress={() => undefined}
      />,
    );

    expect(screen.getByRole("radio", { name: "Steady, about 0.4 kilograms a week" })).toBeTruthy();
  });

  it("should not respond to a press while it carries a reason it is not offered", async () => {
    const onPress = vi.fn();
    render(
      <OptionCard title="Lose" disabledReason="Not offered." checked={false} onPress={onPress} />,
    );

    await userEvent.click(screen.getByRole("radio", { name: /^Lose/ }));

    expect(onPress).not.toHaveBeenCalled();
  });
});

describe("OptionCardGroup choosing one", () => {
  it("should be a radio group named by the question, with a radio for each option", () => {
    render(<Goals />);

    const group = screen.getByRole("radiogroup", { name: "What are you training for?" });
    expect(group).toBeTruthy();
    expect(screen.getAllByRole("radio")).toHaveLength(3);
  });

  it("should check the chosen option and hand its id on when another is pressed", async () => {
    const onChange = vi.fn();
    render(<Goals initial="aesthetic" onChange={onChange} />);

    await userEvent.click(screen.getByRole("radio", { name: /^Both/ }));

    expect(onChange).toHaveBeenCalledWith("hybrid");
    expect(screen.getByRole("radio", { name: /^Both/ }).getAttribute("aria-checked")).toBe("true");
    expect(screen.getByRole("radio", { name: /^Look better/ }).getAttribute("aria-checked")).toBe(
      "false",
    );
  });

  it("should say nothing when the chosen option is pressed again", async () => {
    const onChange = vi.fn();
    render(<Goals initial="aesthetic" onChange={onChange} />);

    await userEvent.click(screen.getByRole("radio", { name: /^Look better/ }));

    expect(onChange).not.toHaveBeenCalled();
  });

  it("should make the first radio the only tab stop when none is chosen", () => {
    render(<Goals />);

    expect(screen.getByRole("radio", { name: /^Look better/ }).getAttribute("tabindex")).toBe("0");
    expect(screen.getByRole("radio", { name: /^Get stronger/ }).getAttribute("tabindex")).toBe(
      "-1",
    );
  });

  it("should make the chosen radio the only tab stop", () => {
    render(<Goals initial="hybrid" />);

    expect(screen.getByRole("radio", { name: /^Both/ }).getAttribute("tabindex")).toBe("0");
    expect(screen.getByRole("radio", { name: /^Look better/ }).getAttribute("tabindex")).toBe("-1");
  });

  it("should move the choice and the focus with the arrow keys, wrapping at the ends", async () => {
    render(<Goals initial="aesthetic" />);
    await userEvent.tab();

    await userEvent.keyboard("{ArrowDown}");
    expect(screen.getByRole("radio", { name: /^Get stronger/ }).getAttribute("aria-checked")).toBe(
      "true",
    );
    expect(document.activeElement).toBe(screen.getByRole("radio", { name: /^Get stronger/ }));

    await userEvent.keyboard("{ArrowUp}{ArrowUp}");
    expect(screen.getByRole("radio", { name: /^Both/ }).getAttribute("aria-checked")).toBe("true");
    expect(document.activeElement).toBe(screen.getByRole("radio", { name: /^Both/ }));
  });

  it("should skip an option that is not offered when an arrow key moves on", async () => {
    render(
      <OptionCardGroup
        label="Goal"
        options={[
          { id: "a", title: "A" },
          { id: "b", title: "B", disabledReason: "Not offered." },
          { id: "c", title: "C" },
        ]}
        value="a"
        onChange={() => undefined}
      />,
    );
    await userEvent.tab();

    await userEvent.keyboard("{ArrowDown}");

    expect(document.activeElement).toBe(screen.getByRole("radio", { name: /^C/ }));
  });
});

describe("OptionCardGroup choosing several", () => {
  it("should be a group of checkboxes, each its own tab stop", async () => {
    render(<Focuses />);

    expect(screen.getByRole("group", { name: "Anything to focus on?" })).toBeTruthy();
    await userEvent.tab();
    expect(document.activeElement).toBe(screen.getByRole("checkbox", { name: /^Chest/ }));
    await userEvent.tab();
    expect(document.activeElement).toBe(screen.getByRole("checkbox", { name: /^Arms/ }));
  });

  it("should add a pressed card at the end and take a checked one out when it is pressed again", async () => {
    render(<Focuses initial={["chest"]} />);

    await userEvent.click(screen.getByRole("checkbox", { name: /^Arms/ }));
    expect(screen.getByRole("checkbox", { name: /^Arms/ }).getAttribute("aria-checked")).toBe(
      "true",
    );
    expect(screen.getByRole("checkbox", { name: /^Chest/ }).getAttribute("aria-checked")).toBe(
      "true",
    );

    await userEvent.click(screen.getByRole("checkbox", { name: /^Chest/ }));
    expect(screen.getByRole("checkbox", { name: /^Chest/ }).getAttribute("aria-checked")).toBe(
      "false",
    );
  });

  it("should toggle the focused card with Space", async () => {
    render(<Focuses />);
    await userEvent.tab();

    await userEvent.keyboard(" ");

    expect(screen.getByRole("checkbox", { name: /^Chest/ }).getAttribute("aria-checked")).toBe(
      "true",
    );
  });
});
