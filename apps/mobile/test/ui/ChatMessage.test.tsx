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

const schemes: ThemeScheme[] = ["dark", "light"];

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

    it("should be a polite live region", async () => {
      await renderMessage(streaming);

      expect(screen.getByRole("group", { name: /^Assistant/ })).toHaveProp("aria-live", "polite");
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

  describe.each(schemes)("in the %s scheme", (scheme) => {
    const colorOf = (name: Parameters<typeof resolvedColor>[1]) => resolvedColor(scheme, name);

    it("should draw your message as a bubble on the page background with a hairline border, at the right", async () => {
      await renderMessage(yourMessage, scheme);
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
      await renderMessage(yourMessage, scheme);
      await screen.findByText("What did I eat yesterday?");

      expect(screen.getByText("What did I eat yesterday?")).toHaveStyle({
        fontFamily: "Geist-Regular",
        fontSize: 16,
        color: colorOf("text-primary"),
      });
    });

    it("should draw the answer as plain paragraphs, 8 apart with 16 clear on the right and no bubble", async () => {
      await renderMessage(answer, scheme);
      await screen.findByText("First invented paragraph.");

      expect(viewsDrawn({ borderWidth: 1 })).toHaveLength(0);
      expect(screen.getByRole("group", { name: /^Assistant/ })).toHaveStyle({
        rowGap: 8,
        paddingRight: 16,
      });
    });

    it("should draw the caret as a 2 point rounded block in the accent, 2 points after the word", async () => {
      await renderMessage({ ...answer, isStreaming: true }, scheme);
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
        scheme,
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
});
