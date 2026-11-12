import { describe, expect, it } from "vitest";

import { parseReplyText, replyWords } from "../../src/assistant";

import type { ReplyBlock, ReplySpan } from "../../src/assistant";

const finished = { isPartial: false };
const partial = { isPartial: true };
const arriving = { isPartial: true, isArriving: true };

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

const spansText = (spans: readonly ReplySpan[]) => spans.map((span) => span.text).join("");

const allText = (blocks: readonly ReplyBlock[]) =>
  blocks
    .map((block) =>
      block.kind === "table"
        ? [block.headings, ...block.rows].map((cells) => cells.map(spansText).join("\t")).join("\n")
        : spansText(block.spans),
    )
    .join("\n");

const textBlocks = (blocks: readonly ReplyBlock[]) =>
  blocks.filter((block) => block.kind !== "table");

const table = (
  headings: ReplySpan[][],
  rows: ReplySpan[][][],
  isNumeric: boolean[],
  isOpen = false,
): ReplyBlock => ({ kind: "table", headings, rows, isNumeric, isOpen });
const cell = (...spans: ReplySpan[]): ReplySpan[] => spans;
const words = (value: string): ReplySpan[] => [plain(value)];

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
      const spans = textBlocks(parse(reply)).flatMap((block) => block.spans);

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
        const lines = textBlocks(blocks).map((block) =>
          block.spans.map((span) => span.text).join(""),
        );

        for (const drawn of lines) {
          expect(drawn, `prefix ${JSON.stringify(prefix)}`).not.toMatch(
            /[*_`[]|\]\(|https?:|^[-+•>#]/,
          );
          expect(drawn, `prefix ${JSON.stringify(prefix)}`).not.toMatch(/^\d{1,3}[.)]?$/);
        }
        for (const block of textBlocks(blocks)) {
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

describe("tables", () => {
  const foodTable = "| Food | kcal |\n| --- | --- |\n| Toast | 90 |\n| Egg | 70 |";
  const foodBlock = table(
    [words("Food"), words("kcal")],
    [
      [words("Toast"), words("90")],
      [words("Egg"), words("70")],
    ],
    [false, true],
  );

  describe("reading", () => {
    it("should read a table with outer pipes", () => {
      expect(parse(foodTable)).toEqual([foodBlock]);
    });

    it("should read a table with no outer pipes", () => {
      expect(parse("Food | kcal\n--- | ---\nToast | 90\nEgg | 70")).toEqual([foodBlock]);
    });

    it("should ignore the colons of the divider", () => {
      expect(parse("| Food | kcal |\n|:---|---:|\n| Toast | 90 |\n| Egg | 70 |")).toEqual([
        foodBlock,
      ]);
    });

    it("should read two or more lines that start with a pipe and have no divider, the first as headings", () => {
      expect(parse("| Food | kcal |\n| Toast | 90 |\n| Egg | 70 |")).toEqual([foodBlock]);
    });

    it("should leave one lone pipe line as typed", () => {
      expect(parse("| Food | kcal |")).toEqual([line(plain("| Food | kcal |"))]);
    });

    it("should draw nothing for a divider under a line with no pipe", () => {
      expect(parse("Before\n| --- |\nAfter")).toEqual([
        line(plain("Before")),
        line(plain("After")),
      ]);
    });

    it("should draw the lines around a table as lines", () => {
      expect(parse(`Here:\n${foodTable}\nThat is all.`)).toEqual([
        line(plain("Here:")),
        foodBlock,
        line(plain("That is all.")),
      ]);
    });

    it("should read a table with no rows", () => {
      expect(parse("| Food |\n| --- |")).toEqual([table([words("Food")], [], [false])]);
    });

    it("should pad a short row with blank cells", () => {
      expect(parse("| A | B | C |\n| - | - | - |\n| x |")).toEqual([
        table([words("A"), words("B"), words("C")], [[words("x"), [], []]], [false, true, true]),
      ]);
    });

    it("should cut the extra cells of a long row", () => {
      expect(parse("| A | B |\n| - | - |\n| x | y | z | w |")).toEqual([
        table([words("A"), words("B")], [[words("x"), words("y")]], [false, false]),
      ]);
    });

    it("should keep an escaped pipe as a literal pipe in the cell", () => {
      expect(parse("| A | B |\n| - | - |\n| a \\| b | c |")).toEqual([
        table([words("A"), words("B")], [[words("a | b"), words("c")]], [false, false]),
      ]);
    });

    it("should read bold, italic and code in a cell", () => {
      expect(parse("| A | B |\n| - | - |\n| **x** *y* | `z` |")).toEqual([
        table(
          [words("A"), words("B")],
          [[cell(strong("x"), plain(" "), emphasis("y")), cell(code("z"))]],
          [false, false],
        ),
      ]);
    });

    it("should leave a blank heading and a blank cell empty", () => {
      expect(parse("| | B |\n| - | - |\n| | |")).toEqual([
        table([[], words("B")], [[[], []]], [false, true]),
      ]);
    });
  });

  describe("numeric columns", () => {
    const numericFlags = (rows: string) => {
      const [block] = parse(`| A | B |\n| - | - |\n${rows}`);
      return block?.kind === "table" ? block.isNumeric : [];
    };

    it("should flag a column of digits", () => {
      expect(numericFlags("| a | 1 |\n| b | 22 |")).toEqual([false, true]);
    });

    it("should flag a column of quantities that start with a digit", () => {
      expect(numericFlags("| a | 1 roll (190 g) |\n| b | 2 |")).toEqual([false, true]);
    });

    it("should flag a column of bold numbers", () => {
      expect(numericFlags("| a | **2,024** |\n| b | *3* |")).toEqual([false, true]);
    });

    it("should let a dash or a blank cell stay in a numeric column", () => {
      expect(numericFlags("| a | 1 |\n| b | – |\n| c | |")).toEqual([false, true]);
    });

    it("should leave a mixed column left aligned", () => {
      expect(numericFlags("| a | 1 |\n| b | about 2 |")).toEqual([false, false]);
    });

    it("should never flag the first column", () => {
      expect(numericFlags("| 1 | 1 |\n| 2 | 2 |")).toEqual([false, true]);
    });
  });

  describe("a partial reply", () => {
    const parsePartial = (value: string) => parseReplyText(value, arriving);

    it.each([
      ["mid heading", "Intro\n| Food | kc"],
      ["heading ended with no next line", "Intro\n| Food | kcal |\n"],
      ["mid divider", "Intro\n| Food | kcal |\n| --- | -"],
      ["a pipe line after a pipe heading", "Intro\n| Food | kcal |\n| Toast"],
    ])("should hold back the lines of a table that is not decided yet: %s", (_name, value) => {
      expect(parsePartial(value)).toEqual([line(plain("Intro"))]);
    });

    it("should show a heading with no outer pipes as a line until its divider arrives", () => {
      expect(parsePartial("Intro\nFood | kcal\n")).toEqual([
        line(plain("Intro")),
        line(plain("Food | kcal")),
      ]);
      expect(parsePartial("Food | kcal\n--- | ---\n")).toEqual([
        table([words("Food"), words("kcal")], [], [false, true], true),
      ]);
    });

    it("should hold back only a line that starts with a pipe, not one with a pipe among its words", () => {
      expect(parsePartial("Eat rice | beans and then keep going")).toEqual([
        line(plain("Eat rice | beans and then keep going")),
      ]);
    });

    it("should draw an open table with no rows when the divider has ended", () => {
      expect(parsePartial("| Food | kcal |\n| --- | --- |\n")).toEqual([
        table([words("Food"), words("kcal")], [], [false, true], true),
      ]);
    });

    it("should hold back a row until its line has ended", () => {
      const expected = table([words("Food"), words("kcal")], [], [false, true], true);

      expect(parsePartial("| Food | kcal |\n| --- | --- |\n| Toa")).toEqual([expected]);
      expect(parsePartial("| Food | kcal |\n| --- | --- |\n| Toast | 90")).toEqual([expected]);
    });

    it("should draw a row once its line has ended and stay open", () => {
      expect(parsePartial("| Food | kcal |\n| --- | --- |\n| Toast | 90 |\n")).toEqual([
        table([words("Food"), words("kcal")], [[words("Toast"), words("90")]], [false, true], true),
      ]);
    });

    it("should read a table with no divider once its second line has ended", () => {
      expect(parsePartial("| Food | kcal |\n| Toast | 90 |\n")).toEqual([
        table([words("Food"), words("kcal")], [[words("Toast"), words("90")]], [false, true], true),
      ]);
    });

    it("should close the table when words start after it", () => {
      expect(parsePartial(`${foodTable}\nThat is`)).toEqual([foodBlock, line(plain("That is"))]);
    });

    it("should close the table when a line has ended after it", () => {
      expect(parsePartial(`${foodTable}\nDone.\n`)).toEqual([foodBlock, line(plain("Done."))]);
    });

    it("should show every line of a stopped reply, its unfinished last row included", () => {
      expect(parseReplyText("Rice is good.\nkcal | protein per 100 g", partial)).toEqual([
        line(plain("Rice is good.")),
        line(plain("kcal | protein per 100 g")),
      ]);
      expect(parseReplyText("| Food | kcal |\n| --- | --- |\n| Toast | 90", partial)).toEqual([
        table([words("Food"), words("kcal")], [[words("Toast"), words("90")]], [false, true]),
      ]);
    });

    it("should hold nothing back in a finished reply", () => {
      expect(parse(`${foodTable}\n`)).toEqual([foodBlock]);
      expect(parse("Intro\n| Food | kcal |")).toEqual([
        line(plain("Intro")),
        line(plain("| Food | kcal |")),
      ]);
    });

    it("should read the same table at every length of a streaming reply without a pipe showing", () => {
      const reply = `Here:\n${foodTable}\nThat is all.`;
      for (let length = 0; length <= reply.length; length += 1) {
        expect(allText(parsePartial(reply.slice(0, length)))).not.toContain("|");
      }
    });
  });

  describe("what a screen reader hears", () => {
    const wordsOf = (value: string) => replyWords(value, finished);

    it("should say the table, its body row count and a sentence for each row", () => {
      expect(wordsOf(foodTable)).toBe("Table, 2 rows. Toast, kcal 90. Egg, kcal 70.");
    });

    it("should say 1 row for one", () => {
      expect(wordsOf("| A | B |\n| - | - |\n| x | 1 |")).toBe("Table, 1 row. x, B 1.");
    });

    it("should not count the headings as a row", () => {
      expect(wordsOf("| A | B |\n| - | - |")).toBe("Table, 0 rows.");
    });

    it("should read the board's two example rows exactly", () => {
      const reply = [
        "| Food | Amount (g) | kcal | Protein (g) | Fat (g) | Carbs (g) | Fibre (g) |",
        "| --- | --- | --- | --- | --- | --- | --- |",
        "| Potato wedges, with skin, cooked in sunflower oil | 300 | 435 | 8.7 | 11 | 80 | 9 |",
      ].join("\n");
      const baileys = [
        "| Food | Amount (ml) | kcal | Protein (g) | Fat (g) | Carbs (g) | Fibre (g) |",
        "| --- | --- | --- | --- | --- | --- | --- |",
        "| Baileys Original Irish Cream | 25 | 79 | – | – | – | – |",
      ].join("\n");

      expect(wordsOf(reply)).toBe(
        "Table, 1 row. Potato wedges, with skin, cooked in sunflower oil, Amount 300 g, kcal 435, Protein 8.7 g, Fat 11 g, Carbs 80 g, Fibre 9 g.",
      );
      expect(wordsOf(baileys)).toBe(
        "Table, 1 row. Baileys Original Irish Cream, Amount 25 ml, kcal 79, Protein no value, Fat no value, Carbs no value, Fibre no value.",
      );
    });

    it("should skip a blank cell", () => {
      expect(wordsOf("| A | B | C |\n| - | - | - |\n| x | | 3 |")).toBe("Table, 1 row. x, C 3.");
    });

    it("should read a word around the table in order", () => {
      expect(wordsOf(`Here:\n${foodTable}\nDone.`)).toBe(
        "Here: Table, 2 rows. Toast, kcal 90. Egg, kcal 70. Done.",
      );
    });

    it("should read a bold row as its words", () => {
      expect(wordsOf("| A | B |\n| - | - |\n| **Total** | **160** |")).toBe(
        "Table, 1 row. Total, B 160.",
      );
    });

    it("should say the table words of the open table without an empty row", () => {
      expect(replyWords("| A | B |\n| - | - |\n| x | 1 |\n", partial)).toBe(
        "Table, 1 row. x, B 1.",
      );
    });
  });

  describe("a hostile table", () => {
    const takesUnderASecond = (hostile: string) => {
      for (const options of [finished, partial, arriving]) {
        const startedAt = performance.now();

        parseReplyText(hostile, options);

        expect(performance.now() - startedAt).toBeLessThan(1_000);
      }
    };

    it("should read one 100,000 character pipe line quickly", () => {
      takesUnderASecond("|".repeat(100_000));
      takesUnderASecond(`${"| a ".repeat(25_000)}|`);
      takesUnderASecond(`${"|-".repeat(50_000)}\n${"| a ".repeat(25_000)}`);
    });

    it("should read 50,000 cells on one line quickly", () => {
      const cells = "| a ".repeat(50_000);

      takesUnderASecond(`${cells}|\n${"| - ".repeat(50_000)}|\n${cells}|`);
    });

    it("should read 20,000 rows quickly", () => {
      takesUnderASecond(`| A | B |\n| - | - |\n${"| x | 1 |\n".repeat(20_000)}`);
      takesUnderASecond(`| A | B |\n${"| x | 1 |\n".repeat(20_000)}`);
    });

    it("should read thousands of heading cells over thousands of short rows quickly, in at most 12 columns", () => {
      const headings = `${"| h ".repeat(20_000)}|`;
      const rows = "| x |\n".repeat(10_000);

      takesUnderASecond(`${headings}\n${"| - ".repeat(20_000)}|\n${rows}`);
      takesUnderASecond(`${"| h ".repeat(3_000)}|\n${"| x\n".repeat(3_000)}`);
      const [block] = parseReplyText(`${headings}\n${"| - ".repeat(20_000)}|\n${rows}`, finished);
      expect(block?.kind === "table" && block.headings.length).toBe(12);
      expect(block?.kind === "table" && block.rows.every((cells) => cells.length === 12)).toBe(
        true,
      );
    });

    it("should read 100,000 characters of escapes in a cell quickly", () => {
      takesUnderASecond(`| A |\n| - |\n| ${"\\|".repeat(50_000)} |`);
      takesUnderASecond(`| A |\n| - |\n| ${"*a ".repeat(33_000)} |`);
    });
  });
});
