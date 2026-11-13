import { cleanup, render, screen } from "@testing-library/react";
import { afterEach, describe, expect, it } from "vitest";

import { ChatMessage } from "@/components/ui/ChatMessage";

const assistantProps = { sender: "assistant", speakerLabel: "Assistant" } as const;

describe("ChatMessage", () => {
  afterEach(() => {
    cleanup();
  });

  describe("your message", () => {
    it("should be one group named for who said it and what they said", () => {
      render(<ChatMessage sender="you" speakerLabel="You" paragraphs={["What did I eat?"]} />);

      expect(screen.getByRole("group", { name: "You: What did I eat?" })).toBeTruthy();
    });

    it("should show your words as typed, never read as markdown", () => {
      render(<ChatMessage sender="you" speakerLabel="You" paragraphs={["2 **eggs**"]} />);

      expect(screen.getByText("2 **eggs**")).toBeTruthy();
    });
  });

  describe("the assistant's message", () => {
    it("should be named for the assistant and its words without the markers", () => {
      render(<ChatMessage {...assistantProps} paragraphs={["You have **1,693 kcal** left."]} />);

      expect(
        screen.getByRole("group", { name: "Assistant: You have 1,693 kcal left." }),
      ).toBeTruthy();
    });

    it("should draw bold words strong and italic words emphasised", () => {
      render(<ChatMessage {...assistantProps} paragraphs={["Eat **well** and *often*"]} />);

      expect(screen.getByText("well").tagName).toBe("STRONG");
      expect(screen.getByText("often").tagName).toBe("EM");
    });

    it("should draw a heading line and bullet and numbered items", () => {
      render(
        <ChatMessage
          {...assistantProps}
          paragraphs={["## Today\n- Eggs\n- Toast\n1. Walk\n2. Rest"]}
        />,
      );

      expect(screen.getByText("Today")).toBeTruthy();
      expect(screen.getAllByText("•")).toHaveLength(2);
      expect(screen.getByText("1.")).toBeTruthy();
      expect(screen.getByText("Rest")).toBeTruthy();
    });

    it("should draw a table's rows as plain lines until it has a table of its own", () => {
      render(
        <ChatMessage
          {...assistantProps}
          paragraphs={["| Food | kcal |\n| --- | --- |\n| Toast | 88 |\n| Egg | 72 |"]}
        />,
      );

      expect(screen.getByText("Toast · 88")).toBeTruthy();
      expect(screen.getByText("Egg · 72")).toBeTruthy();
    });

    it("should draw the stopped line under a reply that was cut short", () => {
      render(
        <ChatMessage
          {...assistantProps}
          paragraphs={["Yesterday you logged"]}
          stoppedLabel="Stopped when you closed the assistant"
        />,
      );

      expect(
        screen.getByRole("group", {
          name: "Assistant: Yesterday you logged Stopped when you closed the assistant",
        }),
      ).toBeTruthy();
      expect(screen.getByText("Stopped when you closed the assistant")).toBeTruthy();
    });

    it("should draw the Estimate badge and the citation under the words", () => {
      render(
        <ChatMessage
          {...assistantProps}
          paragraphs={["Your trend is 80 kg."]}
          estimate={{ badgeLabel: "Estimate", label: "Trend weight is an estimate" }}
          citation="Based on 38 entries"
        />,
      );

      expect(screen.getByText("Trend weight is an estimate")).toBeTruthy();
      expect(screen.getByText("Based on 38 entries")).toBeTruthy();
    });

    it("should not be a live region while it streams, because the panel announces the finished answer", () => {
      render(<ChatMessage {...assistantProps} paragraphs={["Yesterday"]} isStreaming />);

      expect(screen.queryByRole("status")).toBeNull();
      expect(screen.queryByRole("log")).toBeNull();
      expect(
        screen.getByRole("group", { name: "Assistant: Yesterday" }).getAttribute("aria-live"),
      ).toBeNull();
    });

    it("should show a caret while it streams that no one reads", () => {
      const { rerender } = render(
        <ChatMessage {...assistantProps} paragraphs={["Yesterday"]} isStreaming />,
      );
      const message = screen.getByRole("group", { name: "Assistant: Yesterday" });
      expect(message.querySelectorAll("[aria-hidden='true']")).toHaveLength(1);

      rerender(<ChatMessage {...assistantProps} paragraphs={["Yesterday"]} />);

      expect(message.querySelectorAll("[aria-hidden='true']")).toHaveLength(0);
    });
  });
});
