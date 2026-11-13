import { cleanup, render, screen, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { Check } from "lucide-react";
import { afterEach, describe, expect, it, vi } from "vitest";

import { AssistantActionCard, AssistantLinkRow } from "@/components/ui/AssistantActionCard";

const logged = {
  icon: Check,
  title: "Logged 2 eggs and toast at 08:10",
  rows: [
    { name: "Egg, boiled", detail: "2 large eggs (100 g) · 08:10", value: "144 kcal" },
    { name: "Toast, white bread", detail: "1 slice (30 g) · 08:10", value: "88 kcal" },
  ],
  total: "232 kcal · P 15 g · C 17 g · F 10 g",
} as const;

describe("AssistantActionCard", () => {
  afterEach(() => {
    cleanup();
  });

  it("should be one group named for what the assistant did", () => {
    render(<AssistantActionCard {...logged} undo={{ state: "available", label: "Undo" }} />);

    const card = screen.getByRole("group", { name: "Logged 2 eggs and toast at 08:10" });
    expect(within(card).getByText("Egg, boiled")).toBeTruthy();
    expect(within(card).getByText("144 kcal")).toBeTruthy();
    expect(within(card).getByText("232 kcal · P 15 g · C 17 g · F 10 g")).toBeTruthy();
  });

  it("should draw the subtitle and the note when it has them", () => {
    render(
      <AssistantActionCard
        icon={Check}
        title="Changed your calorie target to 2,000 kcal"
        subtitle="Was 2,140 kcal from your programme"
        note="Undo puts back 2,140 kcal."
        undo={{ state: "available", label: "Undo" }}
      />,
    );

    expect(screen.getByText("Was 2,140 kcal from your programme")).toBeTruthy();
    expect(screen.getByText("Undo puts back 2,140 kcal.")).toBeTruthy();
  });

  describe("the Undo", () => {
    it("should be a button that runs its action when pressed", async () => {
      const onPress = vi.fn();
      render(
        <AssistantActionCard {...logged} undo={{ state: "available", label: "Undo", onPress }} />,
      );

      await userEvent.click(screen.getByRole("button", { name: "Undo" }));

      expect(onPress).toHaveBeenCalledTimes(1);
    });

    it("should do nothing when pressed while busy", async () => {
      const onPress = vi.fn();
      render(<AssistantActionCard {...logged} undo={{ state: "busy", label: "Undo", onPress }} />);

      const button = screen.getByRole("button", { name: "Undo" });
      await userEvent.click(button);

      expect(button.getAttribute("aria-busy")).toBe("true");
      expect(onPress).not.toHaveBeenCalled();
    });

    it("should be plain words and no button when it is unavailable", () => {
      render(
        <AssistantActionCard {...logged} undo={{ state: "unavailable", label: "Can't undo" }} />,
      );

      expect(screen.getByText("Can't undo")).toBeTruthy();
      expect(screen.queryByRole("button")).toBeNull();
    });

    it("should draw no action when done", () => {
      render(
        <AssistantActionCard
          icon={Check}
          title="Undone"
          undo={{ state: "done", label: "Undone" }}
        />,
      );

      expect(screen.getByText("Undone")).toBeTruthy();
      expect(screen.queryByRole("button")).toBeNull();
    });
  });

  describe("the rows of an imported recipe", () => {
    it("should tick a matched line and flag an unmatched one", () => {
      render(
        <AssistantActionCard
          icon={Check}
          title="Added recipe"
          rows={[
            {
              name: "2 tbsp olive oil",
              detail: "Olive oil · UK CoFID",
              match: "matched",
              matchLabel: "Matched",
            },
            {
              name: "A splash of white wine",
              detail: "Not counted. Choose a food in the recipe editor.",
              match: "unresolved",
              matchLabel: "Not matched",
            },
          ]}
          undo={{ state: "available", label: "Undo" }}
        />,
      );

      expect(screen.getAllByRole("img", { name: "Matched" })).toHaveLength(1);
      expect(screen.getByText("Not matched")).toBeTruthy();
    });

    it("should mark only the line whose amount was estimated", () => {
      render(
        <AssistantActionCard
          icon={Check}
          title="Added recipe"
          rows={[
            { name: "Milk", detail: "50 ml", estimateLabel: "Estimate" },
            { name: "Flour", detail: "200 g" },
          ]}
          undo={{ state: "available", label: "Undo" }}
        />,
      );

      expect(screen.getAllByText("Estimate")).toHaveLength(1);
    });
  });

  it("should end with a link that opens what the card made", async () => {
    const onPress = vi.fn();
    render(
      <AssistantActionCard
        {...logged}
        link={{ label: "Open in recipe editor", onPress }}
        undo={{ state: "available", label: "Undo" }}
      />,
    );

    await userEvent.click(screen.getByRole("button", { name: "Open in recipe editor" }));

    expect(onPress).toHaveBeenCalledTimes(1);
  });
});

describe("AssistantLinkRow", () => {
  afterEach(() => {
    cleanup();
  });

  it("should be a button named for what it opens", async () => {
    const onPress = vi.fn();
    render(<AssistantLinkRow isStandalone label="Open in routine editor" onPress={onPress} />);

    await userEvent.click(screen.getByRole("button", { name: "Open in routine editor" }));

    expect(onPress).toHaveBeenCalledTimes(1);
  });
});
