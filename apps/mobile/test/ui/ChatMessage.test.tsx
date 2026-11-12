import { render, screen } from "@testing-library/react-native";

import { ChatMessage } from "../../components/ui";
import { ThemeProvider } from "../../lib/theme";
import { compileKitStyles } from "../support/kitStyles";
import { registerAppStyles } from "../support/nativeWindStyles";
import { resolvedColor } from "../support/themeColor";
import { viewsDrawn } from "../support/viewsDrawn";

import type { ChatMessageProps } from "../../components/ui";
import type { ThemeScheme } from "@keylow/tokens";

jest.mock("@react-native-async-storage/async-storage", () => ({
  __esModule: true,
  default: { getItem: () => Promise.resolve(null), setItem: () => Promise.resolve() },
}));

function renderMessage(props: ChatMessageProps, scheme: ThemeScheme = "dark") {
  return render(
    <ThemeProvider fixedPreference={scheme}>
      <ChatMessage {...props} />
    </ThemeProvider>,
  );
}

const yourMessage: ChatMessageProps = {
  role: "you",
  speakerLabel: "You",
  paragraphs: ["What did I eat yesterday?"],
};

const answer: ChatMessageProps = {
  role: "assistant",
  speakerLabel: "Assistant",
  paragraphs: ["First invented paragraph.", "Second invented paragraph."],
};

// The caret is the 8 by 18 block the board draws after the last word, found by the look it was drawn with.
const caretStyle = { width: 8, height: 18 };

describe("ChatMessage", () => {
  let kitStyles: string;

  beforeAll(async () => {
    kitStyles = await compileKitStyles();
  });

  beforeEach(() => {
    registerAppStyles(kitStyles);
  });

  describe("your message", () => {
    it("should be one group named for who said it, followed by the words", async () => {
      await renderMessage(yourMessage);

      expect(
        screen.getByRole("group", { name: "You: What did I eat yesterday?" }),
      ).toBeOnTheScreen();
      expect(screen.getByText("What did I eat yesterday?")).toBeOnTheScreen();
    });

    it("should not be a live region, because the person typed it", async () => {
      await renderMessage(yourMessage);

      expect(screen.getByRole("group", { name: /^You/ })).not.toHaveProp("aria-live", "polite");
    });
  });

  describe("an answer", () => {
    it("should be one group named for who said it, with every paragraph in the name", async () => {
      await renderMessage(answer);

      expect(
        screen.getByRole("group", {
          name: "Assistant: First invented paragraph. Second invented paragraph.",
        }),
      ).toBeOnTheScreen();
    });

    it("should show each paragraph on its own", async () => {
      await renderMessage(answer);

      expect(screen.getByText("First invented paragraph.")).toBeOnTheScreen();
      expect(screen.getByText("Second invented paragraph.")).toBeOnTheScreen();
    });

    it("should let a screen reader tell your message from the answer in one thread", async () => {
      await render(
        <ThemeProvider fixedPreference="dark">
          <ChatMessage {...yourMessage} />
          <ChatMessage {...answer} />
        </ThemeProvider>,
      );

      expect(screen.getAllByRole("group")).toHaveLength(2);
      expect(screen.getByRole("group", { name: /^You/ })).toBeOnTheScreen();
      expect(screen.getByRole("group", { name: /^Assistant/ })).toBeOnTheScreen();
    });

    it("should not be a live region once it is complete", async () => {
      await renderMessage(answer);

      expect(screen.getByRole("group", { name: /^Assistant/ })).not.toHaveProp(
        "aria-live",
        "polite",
      );
    });

    it("should draw no caret, stopped line, Estimate badge or citation unless it is given them", async () => {
      await renderMessage(answer);

      expect(viewsDrawn(caretStyle)).toHaveLength(0);
      expect(screen.queryByText("Estimate")).not.toBeOnTheScreen();
      expect(screen.queryByRole("img")).not.toBeOnTheScreen();
    });
  });

  describe("a streaming answer", () => {
    const streaming: ChatMessageProps = { ...answer, isStreaming: true };

    it("should not be a live region, so Android does not read the whole text again for each chunk", async () => {
      await renderMessage(streaming);

      expect(screen.getByRole("group", { name: /^Assistant/ })).not.toHaveProp("aria-live");
    });

    it("should draw the caret once, hidden from a screen reader", async () => {
      await renderMessage(streaming);

      const carets = viewsDrawn(caretStyle);
      expect(carets).toHaveLength(1);
      expect(carets[0]).toHaveProp("aria-hidden", true);
    });

    it("should keep the caret out of the accessible name, which reads the text only", async () => {
      await renderMessage(streaming);

      expect(
        screen.getByRole("group", {
          name: "Assistant: First invented paragraph. Second invented paragraph.",
        }),
      ).toBeOnTheScreen();
    });

    it("should put the caret after the last word of the last paragraph", async () => {
      await renderMessage(streaming);

      const [caret] = viewsDrawn(caretStyle);
      const caretsIn = (paragraph: string) =>
        screen.getByText(paragraph).queryAll((node) => node === caret);
      expect(caretsIn("Second invented paragraph.")).toHaveLength(1);
      expect(caretsIn("First invented paragraph.")).toHaveLength(0);
    });
  });

  describe("a stopped answer", () => {
    it("should show the stopped line when it is given", async () => {
      await renderMessage({
        ...answer,
        stoppedLabel: "Stopped when you closed the assistant",
      });

      expect(screen.getByText("Stopped when you closed the assistant")).toBeOnTheScreen();
    });

    it("should read the stopped line as part of the message", async () => {
      await renderMessage({ ...answer, stoppedLabel: "Stopped when you closed the assistant" });

      expect(
        screen.getByRole("group", { name: /Stopped when you closed the assistant$/ }),
      ).toBeOnTheScreen();
    });

    it("should show no stopped line when it is not given", async () => {
      await renderMessage(answer);

      expect(screen.queryByText("Stopped when you closed the assistant")).not.toBeOnTheScreen();
    });
  });

  describe("an answer with a citation", () => {
    const cited: ChatMessageProps = { ...answer, citation: "Based on 38 entries, 12 to 18 Oct" };

    it("should show the citation line when it is given", async () => {
      await renderMessage(cited);

      expect(screen.getByText("Based on 38 entries, 12 to 18 Oct")).toBeOnTheScreen();
    });

    it("should keep the database glyph out of the accessible tree, as a decoration", async () => {
      await renderMessage(cited);

      expect(screen.queryByRole("img")).not.toBeOnTheScreen();
    });

    it("should read the citation as part of the message", async () => {
      await renderMessage(cited);

      expect(
        screen.getByRole("group", { name: /Based on 38 entries, 12 to 18 Oct$/ }),
      ).toBeOnTheScreen();
    });

    it("should show no citation when it is not given", async () => {
      await renderMessage(answer);

      expect(screen.queryByText("Based on 38 entries, 12 to 18 Oct")).not.toBeOnTheScreen();
    });
  });

  describe("an answer with the Estimate badge", () => {
    const estimated: ChatMessageProps = {
      ...answer,
      estimate: { badgeLabel: "Estimate", label: "Trend weight is an estimate" },
      citation: "Based on 24 weigh-ins, 21 Sep to 18 Oct",
    };

    it("should show the badge and the line beside it when they are given", async () => {
      await renderMessage(estimated);

      expect(screen.getByText("Estimate")).toBeOnTheScreen();
      expect(screen.getByText("Trend weight is an estimate")).toBeOnTheScreen();
    });

    it("should read the badge and its line before the citation", async () => {
      await renderMessage(estimated);

      expect(
        screen.getByRole("group", {
          name: "Assistant: First invented paragraph. Second invented paragraph. Estimate Trend weight is an estimate Based on 24 weigh-ins, 21 Sep to 18 Oct",
        }),
      ).toBeOnTheScreen();
    });

    it("should show neither when no estimate is given", async () => {
      await renderMessage(answer);

      expect(screen.queryByText("Estimate")).not.toBeOnTheScreen();
      expect(screen.queryByText("Trend weight is an estimate")).not.toBeOnTheScreen();
    });
  });

  describe("an answer with markdown", () => {
    const formatted: ChatMessageProps = {
      role: "assistant",
      speakerLabel: "Assistant",
      paragraphs: ["**Log food:**\n- Two eggs\n- Toast"],
    };
    const caretIn = (words: string) => {
      const [caret] = viewsDrawn(caretStyle);
      return screen.getByText(words).queryAll((node) => node === caret);
    };

    it("should be one group named by the words alone, with no marker in the name", async () => {
      await renderMessage(formatted);

      expect(
        screen.getByRole("group", { name: "Assistant: Log food: Two eggs Toast" }),
      ).toBeOnTheScreen();
    });

    it("should draw the bold line in the body-strong look", async () => {
      await renderMessage(formatted);
      await screen.findByText("Log food:");

      expect(screen.getByText("Log food:")).toHaveStyle({
        fontFamily: "Geist-SemiBold",
        fontSize: 16,
      });
    });

    it("should show the item words with a bullet and no dash", async () => {
      await renderMessage(formatted);

      expect(screen.getByText("Two eggs")).toBeOnTheScreen();
      expect(screen.getByText("Toast")).toBeOnTheScreen();
      expect(screen.getAllByText("•")).toHaveLength(2);
      expect(screen.queryByText(/-/)).not.toBeOnTheScreen();
      expect(screen.queryByText(/\*/)).not.toBeOnTheScreen();
    });

    it("should draw the bullet in the secondary tone in a column that is at least 20 points", async () => {
      await renderMessage(formatted, "dark");
      await screen.findAllByText("•");

      expect(screen.getAllByText("•")[0]).toHaveStyle({
        color: resolvedColor("dark", "text-secondary"),
        minWidth: 20,
      });
    });

    it("should show the number of a numbered item as written, followed by a full stop", async () => {
      await renderMessage({ ...answer, paragraphs: ["Order:\n1. Flat white\n2) Eggs"] });

      expect(screen.getByText("1.")).toBeOnTheScreen();
      expect(screen.getByText("2.")).toBeOnTheScreen();
      expect(screen.getByText("Flat white")).toBeOnTheScreen();
    });

    it("should let the marker column grow for a number of two digits", async () => {
      await renderMessage({ ...answer, paragraphs: ["10. Tenth"] });
      await screen.findByText("10.");

      expect(screen.getByText("10.")).toHaveStyle({ minWidth: 20, flexShrink: 0 });
      expect(screen.getByText("10.")).not.toHaveStyle({ width: 20 });
    });

    it("should keep the weight of the heading on emphasis inside it", async () => {
      await renderMessage({ ...answer, paragraphs: ["## A *b* c"] });
      await screen.findByText("b");

      expect(screen.getByText("b")).toHaveStyle({
        fontFamily: "Geist-SemiBold",
        fontStyle: "italic",
      });
    });

    it("should draw the heading in the body-strong look, never larger", async () => {
      await renderMessage({ ...answer, paragraphs: ["### Today so far"] });
      await screen.findByText("Today so far");

      expect(screen.getByText("Today so far")).toHaveStyle({
        fontFamily: "Geist-SemiBold",
        fontSize: 16,
      });
    });

    it("should draw italic words slanted and code without its backticks", async () => {
      await renderMessage({ ...answer, paragraphs: ["Some *slanted* and `code` words"] });
      await screen.findByText("slanted");

      expect(screen.getByText("slanted")).toHaveStyle({ fontStyle: "italic" });
      expect(screen.queryByText(/`/)).not.toBeOnTheScreen();
      expect(
        screen.getByRole("group", { name: "Assistant: Some slanted and code words" }),
      ).toBeOnTheScreen();
    });

    it("should show the words of a link and nothing tappable", async () => {
      await renderMessage({
        ...answer,
        paragraphs: ["See [the guide](https://example.com/guide) now"],
      });

      expect(screen.getByText("See the guide now")).toBeOnTheScreen();
      expect(screen.queryByText(/example\.com/)).not.toBeOnTheScreen();
      expect(screen.queryByRole("link")).not.toBeOnTheScreen();
      expect(screen.queryByRole("button")).not.toBeOnTheScreen();
    });

    it("should leave 2*3 and 5 * 6 as typed", async () => {
      await renderMessage({ ...answer, paragraphs: ["It is 2*3 and 5 * 6"] });

      expect(screen.getByText("It is 2*3 and 5 * 6")).toBeOnTheScreen();
    });

    it("should draw no paragraph that holds only a rule", async () => {
      await renderMessage({ ...answer, paragraphs: ["Before", "---", "After"] });

      expect(screen.getByText("Before")).toBeOnTheScreen();
      expect(screen.getByText("After")).toBeOnTheScreen();
      expect(screen.queryByText("---")).not.toBeOnTheScreen();
    });

    it("should indent an item one step when it is nested", async () => {
      await renderMessage({ ...answer, paragraphs: ["- Top\n  - Inner"] });
      await screen.findByText("Inner");

      expect(viewsDrawn({ paddingLeft: 20 })).toHaveLength(1);
    });

    it("should show a streaming **Log fo as bold words with no asterisks, and the caret once", async () => {
      await renderMessage({ ...answer, paragraphs: ["**Log fo"], isStreaming: true });
      await screen.findByText("Log fo");

      expect(screen.getByText("Log fo")).toHaveStyle({ fontFamily: "Geist-SemiBold" });
      expect(screen.queryByText(/\*/)).not.toBeOnTheScreen();
      expect(viewsDrawn(caretStyle)).toHaveLength(1);
      // The bold words are a nested Text, and the caret follows them inside the line's own Text.
      const [caret] = viewsDrawn(caretStyle);
      expect(screen.getByText("Log fo").parent?.queryAll((node) => node === caret)).toHaveLength(1);
    });

    it("should hold back a streaming last line of - and keep the caret after the last word", async () => {
      await renderMessage({
        ...answer,
        paragraphs: ["Two things:\n- Two eggs\n-"],
        isStreaming: true,
      });

      expect(screen.queryByText("-")).not.toBeOnTheScreen();
      expect(viewsDrawn(caretStyle)).toHaveLength(1);
      expect(caretIn("Two eggs")).toHaveLength(1);
    });

    it("should put the caret in the last paragraph that draws while the newest one draws nothing yet", async () => {
      await renderMessage({
        ...answer,
        paragraphs: ["First words.", "-"],
        isStreaming: true,
      });

      expect(viewsDrawn(caretStyle)).toHaveLength(1);
      expect(caretIn("First words.")).toHaveLength(1);
    });

    it("should keep the same nodes while chunks arrive, so nothing mounts again", async () => {
      const arriving = (words: string): ChatMessageProps => ({
        ...answer,
        paragraphs: [words],
        isStreaming: true,
      });
      const tree = (props: ChatMessageProps) => (
        <ThemeProvider fixedPreference="dark">
          <ChatMessage {...props} />
        </ThemeProvider>
      );
      const rendered = await render(tree(arriving("Two things:\n- **Log fo")));
      const bold = screen.getByText("Log fo");
      const item = screen.getByText("Log fo").parent;

      await rendered.rerender(tree(arriving("Two things:\n- **Log food:** add foods")));

      expect(screen.getByText("Log food:")).toBe(bold);
      expect(screen.getByText("Log food:").parent).toBe(item);
    });

    it("should draw the caret alone when nothing draws yet", async () => {
      await renderMessage({ ...answer, paragraphs: [""], isStreaming: true });

      expect(viewsDrawn(caretStyle)).toHaveLength(1);
    });

    it("should keep the caret out of the name of a streaming message", async () => {
      await renderMessage({ ...answer, paragraphs: ["**Log fo"], isStreaming: true });

      expect(screen.getByRole("group", { name: "Assistant: Log fo" })).toBeOnTheScreen();
    });

    it("should show no asterisks on a stopped reply that ends in **Log fo, and still show the stopped line", async () => {
      await renderMessage({
        ...answer,
        paragraphs: ["**Log fo"],
        stoppedLabel: "Stopped when you closed the assistant",
      });

      expect(screen.getByText("Log fo")).toBeOnTheScreen();
      expect(screen.queryByText(/\*/)).not.toBeOnTheScreen();
      expect(screen.getByText("Stopped when you closed the assistant")).toBeOnTheScreen();
    });

    it("should leave an unclosed marker as typed in a finished reply", async () => {
      await renderMessage({ ...answer, paragraphs: ["**note"] });

      expect(screen.getByText("**note")).toBeOnTheScreen();
    });
  });

  describe("your message with markdown characters", () => {
    it("should show **2** * 3 exactly as typed", async () => {
      await renderMessage({ ...yourMessage, paragraphs: ["**2** * 3"] });

      expect(screen.getByText("**2** * 3")).toBeOnTheScreen();
      expect(screen.getByRole("group", { name: "You: **2** * 3" })).toBeOnTheScreen();
    });
  });

  describe("in the dark scheme", () => {
    const colorOf = (name: Parameters<typeof resolvedColor>[1]) => resolvedColor("dark", name);

    it("should draw your message as a bubble on the page background with a hairline border, at the right", async () => {
      await renderMessage(yourMessage, "dark");
      await screen.findByText("What did I eat yesterday?");

      const [bubble] = viewsDrawn({
        backgroundColor: colorOf("background"),
        borderColor: colorOf("border"),
        borderWidth: 1,
      });
      expect(bubble).toHaveStyle({
        alignSelf: "flex-end",
        maxWidth: 288,
        paddingLeft: 14,
        paddingRight: 14,
        paddingTop: 10,
        paddingBottom: 10,
        borderRadius: 12,
        borderBottomRightRadius: 6,
      });
    });

    it("should draw your words in the body style and the primary text colour", async () => {
      await renderMessage(yourMessage, "dark");
      await screen.findByText("What did I eat yesterday?");

      expect(screen.getByText("What did I eat yesterday?")).toHaveStyle({
        fontFamily: "Geist-Regular",
        fontSize: 16,
        color: colorOf("text-primary"),
      });
    });

    it("should draw the answer as plain paragraphs, 8 apart with 16 clear on the right and no bubble", async () => {
      await renderMessage(answer, "dark");
      await screen.findByText("First invented paragraph.");

      expect(viewsDrawn({ borderWidth: 1 })).toHaveLength(0);
      expect(screen.getByRole("group", { name: /^Assistant/ })).toHaveStyle({
        rowGap: 8,
        paddingRight: 16,
      });
    });

    it("should draw the caret as a 2 point rounded block in the accent, 2 points after the word", async () => {
      await renderMessage({ ...answer, isStreaming: true }, "dark");
      await screen.findByText("Second invented paragraph.");

      const [caret] = viewsDrawn(caretStyle);
      expect(caret).toHaveStyle({
        backgroundColor: colorOf("accent"),
        borderRadius: 1,
        marginLeft: 2,
      });
    });

    it("should draw the citation and the stopped line in the muted caption style", async () => {
      await renderMessage(
        {
          ...answer,
          citation: "Based on 38 entries, 12 to 18 Oct",
          stoppedLabel: "Stopped when you closed the assistant",
        },
        "dark",
      );
      await screen.findByText("Based on 38 entries, 12 to 18 Oct");

      for (const line of [
        "Based on 38 entries, 12 to 18 Oct",
        "Stopped when you closed the assistant",
      ]) {
        expect(screen.getByText(line)).toHaveStyle({
          fontFamily: "Geist-Medium",
          fontSize: 12,
          color: colorOf("text-muted"),
        });
      }
    });
  });

  // Light keeps the two cases whose tokens share a dark value with ones that differ in light.
  describe("in the light scheme", () => {
    const colorOf = (name: Parameters<typeof resolvedColor>[1]) => resolvedColor("light", name);

    it("should draw your message as a bubble on the page background with a hairline border, at the right", async () => {
      await renderMessage(yourMessage, "light");
      await screen.findByText("What did I eat yesterday?");

      const [bubble] = viewsDrawn({
        backgroundColor: colorOf("background"),
        borderColor: colorOf("border"),
        borderWidth: 1,
      });
      expect(bubble).toHaveStyle({
        alignSelf: "flex-end",
        maxWidth: 288,
        paddingLeft: 14,
        paddingRight: 14,
        paddingTop: 10,
        paddingBottom: 10,
        borderRadius: 12,
        borderBottomRightRadius: 6,
      });
    });

    it("should draw the caret as a 2 point rounded block in the accent, 2 points after the word", async () => {
      await renderMessage({ ...answer, isStreaming: true }, "light");
      await screen.findByText("Second invented paragraph.");

      const [caret] = viewsDrawn(caretStyle);
      expect(caret).toHaveStyle({
        backgroundColor: colorOf("accent"),
        borderRadius: 1,
        marginLeft: 2,
      });
    });
  });

  describe("an answer with a table", () => {
    const christmasMarket = [
      "Your Christmas market total: 2,024 kcal.",
      "| Entry | Amount | kcal |\n| --- | --- | --- |\n| Potato wedges | 300 g | 435 |\n| Baileys | 25 ml | – |\n| **Total** | | **2,024** |",
      "The Baileys has no macros.",
    ];
    const tableAndWords: ChatMessageProps = {
      role: "assistant",
      speakerLabel: "Assistant",
      paragraphs: christmasMarket,
    };
    const arriving = "| Entry | kcal |\n| --- | --- |\n| Potato wedges | 435 |\n";
    const tableIsLast: ChatMessageProps = {
      ...answer,
      paragraphs: ["Your total:", arriving],
    };
    const caretIn = (words: string) => {
      const [caret] = viewsDrawn(caretStyle);
      return screen.getByText(words).queryAll((node) => node === caret);
    };

    it("should draw every cell's words and no pipe", async () => {
      await renderMessage(tableAndWords);

      for (const words of [
        "Entry",
        "Potato wedges",
        "300 g",
        "435",
        "Baileys",
        "–",
        "Total",
        "2,024",
      ]) {
        expect(screen.getByText(words)).toBeOnTheScreen();
      }
      expect(screen.queryByText(/\|/)).not.toBeOnTheScreen();
    });

    it("should read the table in order inside the one group, and add no other stop", async () => {
      await renderMessage(tableAndWords);

      expect(
        screen.getByRole("group", {
          name: /^Assistant: Your Christmas market total: 2,024 kcal\. Table, 3 rows\. Potato wedges, Amount 300 g, kcal 435\..* The Baileys has no macros\.$/,
        }),
      ).toBeOnTheScreen();
      expect(screen.getAllByRole("group")).toHaveLength(1);
    });

    it("should cancel the reply's 16 points on its right, so the table spans the thread", async () => {
      await renderMessage(tableAndWords);

      expect(screen.getByTestId("reply-table")).toHaveStyle({ marginRight: -16 });
    });

    it("should draw the caret once, in the empty row under the last, while the table arrives", async () => {
      await renderMessage({ ...tableIsLast, isStreaming: true });

      expect(viewsDrawn(caretStyle)).toHaveLength(1);
      expect(screen.queryByText("Your total:")).toBeOnTheScreen();
      expect(caretIn("Your total:")).toHaveLength(0);
    });

    it("should move the caret to the end of the words that follow the table", async () => {
      await renderMessage({ ...tableAndWords, isStreaming: true });

      expect(viewsDrawn(caretStyle)).toHaveLength(1);
      expect(caretIn("The Baileys has no macros.")).toHaveLength(1);
    });

    it("should show every line of a stopped reply, a pipe among its words included", async () => {
      await renderMessage({
        ...answer,
        paragraphs: ["Rice is good.\nkcal | protein per 100 g"],
        stoppedLabel: "Stopped when you closed the assistant",
      });

      expect(screen.getByText("kcal | protein per 100 g")).toBeOnTheScreen();
    });

    it("should draw no empty row and no caret for a table that was stopped", async () => {
      await renderMessage({
        ...tableIsLast,
        stoppedLabel: "Stopped when you closed the assistant",
      });

      expect(viewsDrawn(caretStyle)).toHaveLength(0);
      expect(screen.getByText("Potato wedges")).toBeOnTheScreen();
    });
  });
});
