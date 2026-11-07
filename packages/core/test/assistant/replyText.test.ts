import { describe, expect, it } from "vitest";

import { parseReplyText, replyWords } from "../../src/assistant";

import type { ReplyBlock, ReplySpan } from "../../src/assistant";

const finished = { isPartial: false };
const partial = { isPartial: true };

const plain = (text: string): ReplySpan => ({
  text,
  isStrong: false,
  isEmphasis: false,
  isCode: false,
});
const strong = (text: string): ReplySpan => ({ ...plain(text), isStrong: true });
const emphasis = (text: string): ReplySpan => ({ ...plain(text), isEmphasis: true });
const code = (text: string): ReplySpan => ({ ...plain(text), isCode: true });

const line = (...spans: ReplySpan[]): ReplyBlock => ({ kind: "line", spans });
const heading = (...spans: ReplySpan[]): ReplyBlock => ({ kind: "heading", spans });
const bullet = (...spans: ReplySpan[]): ReplyBlock => ({
  kind: "item",
  number: null,
  depth: 0,
  spans,
});
const numbered = (number: string, ...spans: ReplySpan[]): ReplyBlock => ({
  kind: "item",
  number,
  depth: 0,
  spans,
});

const parse = (text: string) => parseReplyText(text, finished);

const allText = (blocks: readonly ReplyBlock[]) =>
  blocks.map((block) => block.spans.map((span) => span.text).join("")).join("\n");

describe("parseReplyText", () => {
  describe("the reply Zee saw on his phone", () => {
    const reply = "**Log food:**\n- Two eggs and toast\n- A flat white\n- Banana at 10:00";

    it("should give one line with a strong span, then one item for each dash line", () => {
      expect(parse(reply)).toEqual([
        line(strong("Log food:")),
        bullet(plain("Two eggs and toast")),
        bullet(plain("A flat white")),
        bullet(plain("Banana at 10:00")),
      ]);
    });

    it("should leave no asterisk or dash in any span", () => {
      const spans = parse(reply).flatMap((block) => block.spans);

      expect(spans.some((span) => span.text.includes("*") || span.text.startsWith("-"))).toBe(
        false,
      );
    });
  });

  describe("inline styles", () => {
    it("should draw ** and __ as strong", () => {
      expect(parse("a **bold** b")).toEqual([line(plain("a "), strong("bold"), plain(" b"))]);
      expect(parse("a __bold__ b")).toEqual([line(plain("a "), strong("bold"), plain(" b"))]);
    });

    it("should draw * and _ as emphasis", () => {
      expect(parse("a *it* b")).toEqual([line(plain("a "), emphasis("it"), plain(" b"))]);
      expect(parse("a _it_ b")).toEqual([line(plain("a "), emphasis("it"), plain(" b"))]);
    });

    it("should draw *** as both", () => {
      expect(parse("***both***")).toEqual([
        line({ text: "both", isStrong: true, isEmphasis: true, isCode: false }),
      ]);
    });

    it("should let a longer run close the outer opener, so the inner one still closes", () => {
      expect(parse("**bold *it***")).toEqual([
        line(strong("bold "), { ...strong("it"), isEmphasis: true }),
      ]);
      expect(parse("*a **b***")).toEqual([
        line(emphasis("a "), { ...emphasis("b"), isStrong: true }),
      ]);
    });

    it("should not let a longer run close an outer opener when nothing inside it was opened", () => {
      expect(parse("*a **b** c*")).toEqual([
        line(emphasis("a "), { ...emphasis("b"), isStrong: true }, emphasis(" c")),
      ]);
    });

    it("should draw emphasis inside strong", () => {
      expect(parse("**a *b* c**")).toEqual([
        line(strong("a "), { ...strong("b"), isEmphasis: true }, strong(" c")),
      ]);
    });

    it("should draw code with nothing inside it parsed", () => {
      expect(parse("run `**x** [a](b)` now")).toEqual([
        line(plain("run "), code("**x** [a](b)"), plain(" now")),
      ]);
    });

    it("should draw an escaped marker as the character itself", () => {
      expect(parse("\\*not italic\\* and \\_x\\_ and \\# and \\\\")).toEqual([
        line(plain("*not italic* and _x_ and # and \\")),
      ]);
    });

    it("should keep a backslash before an ordinary character", () => {
      expect(parse("C:\\temp")).toEqual([line(plain("C:\\temp"))]);
    });

    it("should not let an escaped marker close emphasis", () => {
      expect(parse("*a\\* b")).toEqual([line(plain("*a* b"))]);
    });

    it("should not cross a line break", () => {
      expect(parse("*one\ntwo*")).toEqual([line(plain("*one")), line(plain("two*"))]);
    });
  });

  describe("headings", () => {
    it.each([1, 2, 3, 4, 5, 6])("should draw %i hashes and a space as a heading", (hashes) => {
      expect(parse(`${"#".repeat(hashes)} Today so far`)).toEqual([heading(plain("Today so far"))]);
    });

    it("should keep inline markers out of a heading", () => {
      expect(parse("## **Today** so far")).toEqual([heading(strong("Today"), plain(" so far"))]);
    });

    it("should leave a seventh # as typed", () => {
      expect(parse("####### Seven")).toEqual([line(plain("####### Seven"))]);
    });

    it("should leave a hash with no space as typed", () => {
      expect(parse("#hashtag")).toEqual([line(plain("#hashtag"))]);
    });
  });

  describe("lists", () => {
    it.each(["-", "*", "+", "•"])("should draw %s and a space as a bullet", (marker) => {
      expect(parse(`${marker} Two eggs`)).toEqual([bullet(plain("Two eggs"))]);
    });

    it("should keep the number as written for 1. and 1)", () => {
      expect(parse("1. First\n2) Second\n12. Twelfth")).toEqual([
        numbered("1", plain("First")),
        numbered("2", plain("Second")),
        numbered("12", plain("Twelfth")),
      ]);
    });

    it("should not renumber a list that blank lines split", () => {
      expect(parse("1. One\n\n1. Again\n\n5. Five")).toEqual([
        numbered("1", plain("One")),
        numbered("1", plain("Again")),
        numbered("5", plain("Five")),
      ]);
    });

    it("should indent an item by one step when two or more spaces lead it", () => {
      expect(parse("- Top\n  - Inner\n    - Deeper\n\t1. Tabbed")).toEqual([
        bullet(plain("Top")),
        { kind: "item", number: null, depth: 1, spans: [plain("Inner")] },
        { kind: "item", number: null, depth: 1, spans: [plain("Deeper")] },
        { kind: "item", number: "1", depth: 1, spans: [plain("Tabbed")] },
      ]);
    });

    it("should leave a single leading space at the first step", () => {
      expect(parse(" - One")).toEqual([bullet(plain("One"))]);
    });

    it("should draw bold lead-ins inside an item", () => {
      expect(parse("- **Log food:** add foods")).toEqual([
        bullet(strong("Log food:"), plain(" add foods")),
      ]);
    });
  });

  describe("links and images", () => {
    it("should draw the words of a link and not its address", () => {
      expect(parse("see [the page](https://example.com/a_b) now")).toEqual([
        line(plain("see the page now")),
      ]);
    });

    it("should draw the words of an image, and as typed an image with none", () => {
      expect(parse("![a plate](https://example.com/p.png)")).toEqual([line(plain("a plate"))]);
      expect(parse("![](https://example.com/p.png)")).toEqual([
        line(plain("![](https://example.com/p.png)")),
      ]);
    });

    it("should leave a link whose address holds a space as typed, and lose no word", () => {
      expect(parse("see [note](about 100 kcal) ok")).toEqual([
        line(plain("see [note](about 100 kcal) ok")),
      ]);
      expect(parse("see [note](about\t100) ok")).toEqual([
        line(plain("see [note](about\t100) ok")),
      ]);
    });

    it("should keep the words and links around an address that holds a space", () => {
      expect(parse("[a](b) [c](d e) [f](g)")).toEqual([line(plain("a [c](d e) f"))]);
      expect(parse("[a](x [b](y) z")).toEqual([line(plain("[a](x b z"))]);
    });

    it("should leave brackets with no address as typed", () => {
      expect(parse("see [1] and [2]")).toEqual([line(plain("see [1] and [2]"))]);
    });

    it("should leave an unclosed bracket as typed once the reply is finished", () => {
      expect(parse("a [b (c")).toEqual([line(plain("a [b (c"))]);
    });
  });

  describe("lines that hold no words", () => {
    it.each([
      ["a rule of dashes", "---"],
      ["a rule of asterisks", "***"],
      ["a rule of underscores", "___"],
      ["a spaced rule", "- - -"],
      ["a table divider", "| --- | :---: |"],
      ["a bare table divider", "--- | ---"],
      ["a code fence", "```"],
      ["a code fence with a language", "```ts"],
      ["a tilde fence", "~~~"],
    ])("should draw nothing for %s", (_name, text) => {
      expect(parse(text)).toEqual([]);
      expect(parse(`Before\n${text}\nAfter`)).toEqual([
        line(plain("Before")),
        line(plain("After")),
      ]);
    });

    it("should draw nothing for a blank line or an empty reply", () => {
      expect(parse("")).toEqual([]);
      expect(parse("  \n\n")).toEqual([]);
    });
  });

  describe("block quotes", () => {
    it("should drop the marker and draw an ordinary line", () => {
      expect(parse("> wise **words**")).toEqual([line(plain("wise "), strong("words"))]);
    });

    it("should draw a quoted dash as text, not as an item", () => {
      expect(parse("> - x")).toEqual([line(plain("- x"))]);
    });
  });

  describe("what is left as typed", () => {
    it.each([
      ["a table row", "| Food | kcal |"],
      ["an HTML tag", "<b>x</b>"],
      ["a bare URL", "https://example.com/a_b_c"],
    ])("should leave %s as typed", (_name, text) => {
      expect(parse(text)).toEqual([line(plain(text))]);
    });

    it("should leave the arithmetic and the quantities as one plain line", () => {
      for (const text of [
        "2*3",
        "5 * 6",
        "2*3*4",
        "x**2",
        "snake_case_name",
        "-5 kg",
        "1,693 kcal",
        "2.5 kg",
        "a * b * c",
        "price: 3*4=12",
        "foo*bar*baz",
        "*5 kg",
      ]) {
        expect(parse(text)).toEqual([line(plain(text))]);
      }
    });

    it("should leave an unclosed marker as typed once the reply is finished", () => {
      expect(parse("**note")).toEqual([line(plain("**note"))]);
      expect(parse("a `note")).toEqual([line(plain("a `note"))]);
    });

    it("should leave a lone marker as typed once the reply is finished", () => {
      expect(parse("-")).toEqual([line(plain("-"))]);
      expect(parse("1.")).toEqual([line(plain("1."))]);
      expect(parse("##")).toEqual([line(plain("##"))]);
    });
  });

  describe("while the words are partial", () => {
    const parsePartial = (text: string) => parseReplyText(text, partial);

    it("should draw an opener with no closer styled to the end of the line, with no marker", () => {
      expect(parsePartial("**Log fo")).toEqual([line(strong("Log fo"))]);
      expect(parsePartial("a *it")).toEqual([line(plain("a "), emphasis("it"))]);
      expect(parsePartial("a `co")).toEqual([line(plain("a "), code("co"))]);
    });

    it("should hold back a trailing run of markers and a trailing backslash", () => {
      expect(parsePartial("**Log food:**")).toEqual([line(strong("Log food:"))]);
      expect(parsePartial("Log food*")).toEqual([line(plain("Log food"))]);
      expect(parsePartial("Log food_")).toEqual([line(plain("Log food"))]);
      expect(parsePartial("Log food`")).toEqual([line(plain("Log food"))]);
      expect(parsePartial("Log food\\")).toEqual([line(plain("Log food"))]);
    });

    it.each([
      "-",
      "- ",
      "*",
      "+",
      "•",
      ">",
      "> ",
      "#",
      "######",
      "1",
      "12",
      "123",
      "1.",
      "12)",
      "-  ",
      "  -",
      "--",
    ])("should hold back a last line that is only %j", (last) => {
      expect(parsePartial(`Intro\n${last}`)).toEqual([line(plain("Intro"))]);
    });

    it("should not hold back a last line of four digits or seven hashes", () => {
      expect(parsePartial("1234")).toEqual([line(plain("1234"))]);
      expect(parsePartial("#######")).toEqual([line(plain("#######"))]);
    });

    it("should draw the words of a half-typed link, without the bracket or the address", () => {
      expect(parsePartial("see [wor")).toEqual([line(plain("see wor"))]);
      expect(parsePartial("see [words]")).toEqual([line(plain("see words"))]);
      expect(parsePartial("see [words](")).toEqual([line(plain("see words"))]);
      expect(parsePartial("see [words](http")).toEqual([line(plain("see words"))]);
      expect(parsePartial("see [words](https://example.com/a_b")).toEqual([
        line(plain("see words")),
      ]);
    });

    it("should hide an address only until the first space, and then show the line as typed", () => {
      expect(parsePartial("see [note](about")).toEqual([line(plain("see note"))]);
      expect(parsePartial("see [note](about 100")).toEqual([line(plain("see [note](about 100"))]);
      expect(parsePartial("see [note](about 100 kcal) ok")).toEqual([
        line(plain("see [note](about 100 kcal) ok")),
      ]);
    });

    it("should bring the brackets back when they turn out not to be a link", () => {
      expect(parsePartial("see [1]")).toEqual([line(plain("see 1"))]);
      expect(parsePartial("see [1] and")).toEqual([line(plain("see [1] and"))]);
    });

    it("should draw the words of a half-typed image", () => {
      expect(parsePartial("![a pla")).toEqual([line(plain("a pla"))]);
    });

    it("should leave every earlier line as it is once finished, and change only the last", () => {
      expect(parsePartial("**note\n**Log fo")).toEqual([
        line(plain("**note")),
        line(strong("Log fo")),
      ]);
    });

    it("should draw the item words while the marker has only just arrived", () => {
      expect(parsePartial("- Tw")).toEqual([bullet(plain("Tw"))]);
      expect(parsePartial("1. Fl")).toEqual([numbered("1", plain("Fl"))]);
    });

    it("should draw no empty item for a bullet that holds only a held-back marker", () => {
      expect(parsePartial("- **")).toEqual([]);
      expect(parsePartial("1. `")).toEqual([]);
    });

    it("should draw no marker in any prefix of a reply", () => {
      const reply = [
        "Here is **what** can be *done* in `Ki-Lo`:",
        "- **Log food:** add foods, portions or grams",
        "- Find _foods_ in [the guide](https://example.com/guide_one)",
        "1. First step",
        "2) Second step",
        "![a plate](https://example.com/p.png)",
        "- **bold *it*** and *a **b*** done",
      ].join("\n");

      for (let length = 0; length <= reply.length; length += 1) {
        const prefix = reply.slice(0, length);
        const blocks = parsePartial(prefix);
        const lines = blocks.map((block) => block.spans.map((span) => span.text).join(""));

        for (const drawn of lines) {
          expect(drawn, `prefix ${JSON.stringify(prefix)}`).not.toMatch(
            /[*_`[]|\]\(|https?:|^[-+•>#]/,
          );
          expect(drawn, `prefix ${JSON.stringify(prefix)}`).not.toMatch(/^\d{1,3}[.)]?$/);
        }
        for (const block of blocks) {
          expect(block.spans.length, `prefix ${JSON.stringify(prefix)}`).toBeGreaterThan(0);
        }
      }
    });
  });

  describe("a finished reply keeps every word", () => {
    const nonsense = [
      "<b>x</b> and **note",
      "| Food | kcal |",
      "| --- | --- |",
      "| Egg | 72 |",
      "[unclosed link and `open code",
      "plain \\ trailing",
      "*",
      "-",
      "1.",
      "####### seven",
      "a_b_c and x*y*z",
    ].join("\n");

    it("should keep every non-marker word in replyWords", () => {
      const words = replyWords(nonsense, finished);

      for (const word of [
        "<b>x</b>",
        "and",
        "note",
        "Food",
        "kcal",
        "Egg",
        "72",
        "unclosed",
        "link",
        "open",
        "code",
        "plain",
        "trailing",
        "seven",
        "a_b_c",
        "x*y*z",
      ]) {
        expect(words).toContain(word);
      }
    });

    it("should leave an unclosed ** as typed", () => {
      expect(replyWords("an unclosed **note", finished)).toBe("an unclosed **note");
    });
  });

  describe("a hostile line", () => {
    it("should parse 20,000 characters of *a  in the default test timeout", () => {
      const hostile = "*a ".repeat(20_000 / 3);

      expect(allText(parse(hostile))).toBe(hostile.trimEnd());
    });

    it.each([
      ["tildes then a backtick", `${"~".repeat(100_000)}\``],
      ["backticks then a letter", `${"`".repeat(100_000)}a`],
    ])("should drop 100,000 characters of %s as a fence, quickly", (_name, hostile) => {
      expect(parse(hostile)).toEqual([]);
    });

    it.each([
      ["finished", finished],
      ["partial", partial],
    ])(
      "should stop searching for an address that a far-off space ends, when %s",
      (_name, options) => {
        const hostile = `${"[a](".repeat(35_000)} z`;
        const startedAt = performance.now();

        parseReplyText(hostile, options);

        expect(performance.now() - startedAt).toBeLessThan(1_000);
      },
    );

    it.each([
      ["open brackets", "[a ".repeat(7_000)],
      ["open links", "[a](b ".repeat(4_000)],
      ["open code", "`a ".repeat(7_000)],
      ["open strong", "**a ".repeat(5_000)],
      ["open underscores", "_a ".repeat(7_000)],
      ["closed pairs", "*a* ".repeat(5_000)],
      ["open links with no space", "[a](b".repeat(4_000)],
      ["open links ending in a space", `${"[a](".repeat(8_750)} z`],
      ["open images ending in a space", `${"![a](".repeat(7_000)} z`],
      ["a backtick fence with a second run", `\`\`\`${"`a".repeat(30_000)}`],
    ])("should parse 20,000 characters of %s quickly", (_name, hostile) => {
      expect(parse(hostile).length).toBeGreaterThan(0);
      expect(parseReplyText(hostile, partial).length).toBeGreaterThan(0);
    });
  });
});

describe("replyWords", () => {
  it("should join spans with nothing and blocks with a space, with no marker in it", () => {
    expect(replyWords("**Log food:**\n- Two eggs\n- Toast", finished)).toBe(
      "Log food: Two eggs Toast",
    );
  });

  it("should keep the number of a numbered item and add no word for a bullet", () => {
    expect(replyWords("Order:\n1. Flat white\n2) Eggs\n- Toast", finished)).toBe(
      "Order: 1 Flat white 2 Eggs Toast",
    );
  });

  it("should read a link as its words and a heading as its words", () => {
    expect(replyWords("# Plan\nsee [the guide](https://example.com)", finished)).toBe(
      "Plan see the guide",
    );
  });

  it("should draw nothing for a reply of only a rule", () => {
    expect(replyWords("---", finished)).toBe("");
  });

  it("should hold back what a partial reply holds back", () => {
    expect(replyWords("Intro\n- **Log fo", partial)).toBe("Intro Log fo");
    expect(replyWords("Intro\n-", partial)).toBe("Intro");
  });
});
