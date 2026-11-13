import { cleanup, render, screen } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";

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

    describe("a table", () => {
      const tableMarkdown = "| Food | kcal |\n| --- | --- |\n| Toast | 88 |\n| Egg | 72 |";

      afterEach(() => {
        vi.restoreAllMocks();
      });

      it("should draw its headings and cells", () => {
        render(<ChatMessage {...assistantProps} paragraphs={[tableMarkdown]} />);

        expect(screen.getByText("Food")).toBeTruthy();
        expect(screen.getByText("kcal")).toBeTruthy();
        expect(screen.getByText("Toast")).toBeTruthy();
        expect(screen.getByText("72")).toBeTruthy();
      });

      it("should be read once in the message's name, a sentence a row", () => {
        render(<ChatMessage {...assistantProps} paragraphs={["Your day.", tableMarkdown]} />);

        expect(
          screen.getByRole("group", {
            name: "Assistant: Your day. Table, 2 rows. Toast, kcal 88. Egg, kcal 72.",
          }),
        ).toBeTruthy();
      });

      it("should hide the words around it from a screen reader, which reads them in the name", () => {
        render(<ChatMessage {...assistantProps} paragraphs={["Your day.", tableMarkdown]} />);

        expect(screen.getByText("Your day.").closest("[aria-hidden='true']")).not.toBeNull();
      });

      it("should hide the lines under a table from a screen reader, which reads them in the name", () => {
        render(
          <ChatMessage
            {...assistantProps}
            paragraphs={[tableMarkdown]}
            citation="Based on 38 entries"
            estimate={{ badgeLabel: "Estimate", label: "Trend weight is an estimate" }}
            stoppedLabel="Stopped when you closed the assistant"
          />,
        );

        for (const line of [
          "Based on 38 entries",
          "Trend weight is an estimate",
          "Stopped when you closed the assistant",
        ]) {
          expect(screen.getByText(line).closest("[aria-hidden='true']")).not.toBeNull();
        }
      });

      it("should leave the lines of a message with no table to a screen reader", () => {
        render(
          <ChatMessage
            {...assistantProps}
            paragraphs={["Hello."]}
            citation="Based on 38 entries"
          />,
        );

        expect(screen.getByText("Based on 38 entries").closest("[aria-hidden='true']")).toBeNull();
      });

      it("should name its scroll region by its rows when wider than the reply", () => {
        vi.spyOn(HTMLElement.prototype, "scrollWidth", "get").mockReturnValue(900);
        vi.spyOn(HTMLElement.prototype, "clientWidth", "get").mockReturnValue(300);
        render(<ChatMessage {...assistantProps} paragraphs={[tableMarkdown]} />);

        expect(screen.getByRole("region", { name: "Table, 2 rows." })).toBeTruthy();
      });

      it("should name one row as a row", () => {
        vi.spyOn(HTMLElement.prototype, "scrollWidth", "get").mockReturnValue(900);
        vi.spyOn(HTMLElement.prototype, "clientWidth", "get").mockReturnValue(300);
        render(
          <ChatMessage
            {...assistantProps}
            paragraphs={["| Food | kcal |\n| --- | --- |\n| Toast | 88 |"]}
          />,
        );

        expect(screen.getByRole("region", { name: "Table, 1 row." })).toBeTruthy();
      });

      it("should hold the next row back and put the caret in an empty row while it arrives", () => {
        vi.spyOn(HTMLElement.prototype, "scrollWidth", "get").mockReturnValue(900);
        vi.spyOn(HTMLElement.prototype, "clientWidth", "get").mockReturnValue(300);
        render(
          <ChatMessage
            {...assistantProps}
            isStreaming
            paragraphs={["| Food | kcal |\n| --- | --- |\n| Toast | 88 |\n| Egg | 7"]}
          />,
        );

        expect(screen.getByRole("region", { name: "Table, 1 row." })).toBeTruthy();
        expect(screen.queryByText("Egg")).toBeNull();
        const grid = screen.getByText("Food").closest("[aria-hidden='true']");
        // Two columns: the headings, one row, then the empty row that holds the caret.
        expect(grid?.children).toHaveLength(6);
        expect(grid?.children[4]?.querySelector("[aria-hidden='true']")).not.toBeNull();
      });

      it("should put the caret after the words that follow the table", () => {
        render(
          <ChatMessage
            {...assistantProps}
            isStreaming
            paragraphs={[`${tableMarkdown}\n\nThat is`]}
          />,
        );

        expect(screen.getByText("That is").querySelector("[aria-hidden='true']")).not.toBeNull();
        const grid = screen.getByText("Food").closest("[aria-hidden='true']");
        expect(grid?.children).toHaveLength(6);
        expect(grid?.querySelector("[aria-hidden='true']")).toBeNull();
      });
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
