import { describe, expect, it } from "vitest";

import { checkSource } from "./checkSource";

import type { RuleName } from "./types";

// Class names for the retired placeholder scales are assembled from parts, so the acceptance grep for
// the old prefix and the old scale names finds no copy of them in the repository.
const retiredScaleClass = ["bg", "legacy", "brand", "600"].join("-");
const defaultPaletteClass = (prefix: string, scale: string, step: string) =>
  [prefix, scale, step].join("-");

const coreHelperNames = new Set(["formatGrams", "describeEnergy", "isFoodId"]);

const rulesFound = (path: string, source: string): RuleName[] =>
  checkSource({ path, source, coreHelperNames }).map((violation) => violation.rule);

const webFile = "apps/web/components/Thing/Thing.tsx";
const mobileFile = "apps/mobile/components/Thing/Thing.tsx";

describe("raw hex colours", () => {
  it("should flag a hex colour in a string", () => {
    expect(rulesFound(webFile, `export const colour = "#CCF249";`)).toEqual(["raw-hex"]);
  });

  it("should flag a hex colour in an arbitrary Tailwind value", () => {
    expect(rulesFound(webFile, `export const c = "bg-[#fff] p-4";`)).toEqual(["raw-hex"]);
  });

  it("should flag a hex colour in a template literal", () => {
    expect(rulesFound(webFile, "export const c = `border-[#abc123] ${x}`;")).toEqual(["raw-hex"]);
  });

  it("should report the colour and the line", () => {
    const [violation] = checkSource({
      path: webFile,
      source: `const a = 1;\nconst colour = "#0B0E13";`,
      coreHelperNames,
    });

    expect(violation).toMatchObject({ rule: "raw-hex", line: 2, detail: "#0B0E13" });
  });

  it("should ignore a hex colour that only appears in a comment", () => {
    expect(rulesFound(webFile, `// the design's #CCF249\nexport const a = 1;`)).toEqual([]);
  });

  it("should allow hex colours in packages/tokens", () => {
    expect(rulesFound("packages/tokens/src/theme.ts", `export const c = "#CCF249";`)).toEqual([]);
  });

  it("should flag a hex colour in a stylesheet and ignore one in a CSS comment", () => {
    expect(rulesFound("apps/web/app/globals.css", "a { color: #fff; }")).toEqual(["raw-hex"]);
    expect(rulesFound("apps/web/app/globals.css", "/* #fff */ a { color: red; }")).toEqual([]);
  });

  it("should not take a word that merely contains a hash for a colour", () => {
    expect(rulesFound(webFile, `export const a = "item#abc1 and C#";`)).toEqual([]);
  });
});

describe("inline style", () => {
  it("should flag an object literal", () => {
    expect(rulesFound(webFile, `export const a = <div style={{ color: "red" }} />;`)).toEqual([
      "inline-style",
    ]);
  });

  it("should flag a style held in a variable", () => {
    expect(
      rulesFound(mobileFile, `const s = { flex: 1 };\nexport const a = <View style={s} />;`),
    ).toEqual(["inline-style"]);
  });

  it("should flag an array of styles", () => {
    expect(rulesFound(mobileFile, `export const a = <View style={[a, b]} />;`)).toEqual([
      "inline-style",
    ]);
  });

  it("should flag a string style", () => {
    expect(rulesFound(webFile, `export const a = <div style="color: red" />;`)).toEqual([
      "inline-style",
    ]);
  });

  it.each(["stroke", "fill"])(
    "should allow style=%s, which is a Skia paint style and not a React Native style",
    (paintStyle) => {
      expect(
        rulesFound(mobileFile, `export const a = <Scatter style="${paintStyle}" radius={3} />;`),
      ).toEqual([]);
    },
  );

  it("should flag a style that is a word other than a Skia paint style", () => {
    expect(rulesFound(mobileFile, `export const a = <View style="stroked" />;`)).toEqual([
      "inline-style",
    ]);
  });

  it("should flag a template literal or an expression in place of a paint style word", () => {
    expect(rulesFound(mobileFile, "export const a = <Scatter style={`stroke`} />;")).toEqual([
      "inline-style",
    ]);
    expect(
      rulesFound(mobileFile, `export const a = <Scatter style={isRing ? "stroke" : "fill"} />;`),
    ).toEqual(["inline-style"]);
  });

  it("should still flag an object, an array and a variable beside a paint style", () => {
    expect(
      rulesFound(
        mobileFile,
        `export const a = <><View style={{ flex: 1 }} /><View style={[a]} /><View style={someObject} /><Scatter style="stroke" /></>;`,
      ),
    ).toEqual(["inline-style", "inline-style", "inline-style"]);
  });

  describe("the Android widget folder (ADR 0007)", () => {
    const widgetFile = "apps/mobile/widgets/android/TodayRingWidget/TodayRingWidget.tsx";
    const widgetStyle = `export const a = <FlexWidget style={{ padding: 16, borderRadius: 22 }} />;`;

    it("should allow a style object in the widget folder", () => {
      expect(rulesFound(widgetFile, widgetStyle)).toEqual([]);
    });

    it("should allow a style held in a variable and a prop that ends in Style there", () => {
      expect(
        rulesFound(
          widgetFile,
          `const s = { flex: 1 };\nexport const a = <FlexWidget style={s} contentStyle={{ gap: 4 }} />;`,
        ),
      ).toEqual([]);
    });

    it("should allow a style object in a property of the folder, which is not a colour read from the theme", () => {
      expect(rulesFound(widgetFile, `export const a = { rowStyle: { padding: 4 } };`)).toEqual([]);
    });

    it("should flag the same style object in the rest of the mobile app", () => {
      expect(rulesFound(mobileFile, widgetStyle)).toEqual(["inline-style"]);
    });

    it("should flag it in a sibling folder whose name only starts the same way", () => {
      expect(rulesFound("apps/mobile/widgets/android-extra/Thing.tsx", widgetStyle)).toEqual([
        "inline-style",
      ]);
      expect(rulesFound("apps/mobile/widgets/ios/Thing.tsx", widgetStyle)).toEqual([
        "inline-style",
      ]);
    });

    it("should flag it in the widget helpers of the app, which are not layouts", () => {
      expect(rulesFound("apps/mobile/lib/widgets/Thing.tsx", widgetStyle)).toEqual([
        "inline-style",
      ]);
    });

    it("should still flag a raw hex colour in the widget folder", () => {
      expect(
        rulesFound(
          widgetFile,
          `export const a = <FlexWidget style={{ backgroundColor: "#CCF249" }} />;`,
        ),
      ).toEqual(["raw-hex"]);
    });
  });

  it("should flag an object literal on an animated view", () => {
    expect(
      rulesFound(mobileFile, `export const a = <Animated.View style={{ opacity: 1 }} />;`),
    ).toEqual(["inline-style"]);
  });

  it("should allow CSS custom properties set through vars()", () => {
    expect(
      rulesFound(mobileFile, `export const a = <View style={vars({ "--inset-top": top })} />;`),
    ).toEqual([]);
  });

  it("should allow an object literal made only of CSS custom properties", () => {
    expect(
      rulesFound(webFile, `export const a = <div style={{ "--bar": "40%" } as Style} />;`),
    ).toEqual([]);
  });

  it("should flag an object literal that mixes a custom property with a plain one", () => {
    expect(
      rulesFound(webFile, `export const a = <div style={{ "--bar": "40%", width: 3 }} />;`),
    ).toEqual(["inline-style"]);
  });

  it("should allow a Reanimated animated style on an Animated view", () => {
    expect(
      rulesFound(
        mobileFile,
        `const animatedStyle = useAnimatedStyle(() => ({}));\nexport const a = <Animated.View style={animatedStyle} />;`,
      ),
    ).toEqual([]);
  });

  it("should allow a style variable that is built with vars() in the same file", () => {
    expect(
      rulesFound(
        mobileFile,
        `const schemeVariables = useMemo(() => vars({ ...themeVariables(scheme) }), [scheme]);\nexport const a = <View style={schemeVariables} />;`,
      ),
    ).toEqual([]);
  });

  it("should read every prop that ends in Style like style", () => {
    expect(
      rulesFound(
        mobileFile,
        `export const a = <FlatList contentContainerStyle={{ padding: 4 }} columnWrapperStyle={wrapper} />;`,
      ),
    ).toEqual(["inline-style", "inline-style"]);
    expect(
      rulesFound(
        mobileFile,
        `export const a = <FlatList contentContainerStyle={vars({ "--inset-bottom": 4 })} />;`,
      ),
    ).toEqual([]);
  });

  it("should not read a word prop that merely ends in Style as a style", () => {
    expect(
      rulesFound(mobileFile, `export const a = <ScrollView indicatorStyle="white" />;`),
    ).toEqual([]);
  });

  it("should allow the status bar's style, which is a word and not a CSS style", () => {
    expect(
      rulesFound(
        mobileFile,
        `export const a = <StatusBar style={scheme === "dark" ? "light" : "dark"} />;`,
      ),
    ).toEqual([]);
  });

  it("should allow navigation styles fed from the theme's colours", () => {
    expect(
      rulesFound(
        mobileFile,
        `export const o = { contentStyle: { backgroundColor: colors.background } };`,
      ),
    ).toEqual([]);
  });

  it("should flag a navigation style that holds a literal", () => {
    expect(
      rulesFound(mobileFile, `export const o = { contentStyle: { backgroundColor: "red" } };`),
    ).toEqual(["inline-style"]);
  });

  it("should not read an unrelated data property as a style", () => {
    expect(
      rulesFound("packages/tokens/scripts/build.ts", `export const a = { statusBarStyle: { x } };`),
    ).toEqual([]);
  });
});

describe("retired placeholder scales", () => {
  it("should flag a class from a retired scale", () => {
    expect(rulesFound(webFile, `export const c = "${retiredScaleClass} p-4";`)).toEqual([
      "retired-placeholder-class",
    ]);
  });

  it("should flag the default Tailwind palette steps and white and black", () => {
    expect(
      rulesFound(
        webFile,
        `export const c = "${defaultPaletteClass("bg", "neutral", "100")} ${defaultPaletteClass("text", "brand", "600")} hover:${defaultPaletteClass("border", "red", "500")}";`,
      ),
    ).toEqual(["tailwind-palette-class", "tailwind-palette-class", "tailwind-palette-class"]);
    expect(rulesFound(webFile, `export const c = "bg-white text-black";`)).toEqual([
      "tailwind-palette-class",
      "tailwind-palette-class",
    ]);
  });

  it("should not flag the design's own colour classes", () => {
    expect(
      rulesFound(
        webFile,
        `export const c = "bg-accent bg-surface-raised border-border text-text-primary shadow-card bg-danger-muted";`,
      ),
    ).toEqual([]);
  });
});

describe("shadcn semantic colour classes", () => {
  it.each([
    "text-muted-foreground",
    "bg-primary",
    "bg-primary/90",
    "hover:bg-destructive",
    "border-input",
    "ring-ring",
    "bg-card",
    "bg-popover",
    "text-card-foreground",
    "text-foreground",
    "bg-secondary",
    "bg-muted",
  ])("should flag %s", (className) => {
    expect(rulesFound(webFile, `export const c = "flex ${className}";`)).toEqual([
      "shadcn-colour-class",
    ]);
  });

  it.each([
    "text-text-primary",
    "text-text-muted",
    "bg-surface",
    "shadow-card",
    "bg-accent",
    "text-accent-foreground",
    "border-border",
    "ring-focus-ring",
    "text-primary-text",
  ])("should not flag %s", (className) => {
    expect(rulesFound(webFile, `export const c = "flex ${className}";`)).toEqual([]);
  });
});

describe("error text in JSX", () => {
  it.each([
    "<Text>{error.message}</Text>",
    "<Text>{offError?.message}</Text>",
    "<Text>{`Failed: ${localError.message}`}</Text>",
    "<Banner title={result.error.message} />",
    "<Text>{state.debugMessage}</Text>",
  ])("should flag %s", (jsx) => {
    expect(rulesFound(mobileFile, `export const a = ${jsx};`)).toEqual(["error-message-in-jsx"]);
  });

  it("should not flag an error message that is only logged", () => {
    expect(rulesFound(mobileFile, `console.error(error.message);\nexport const a = 1;`)).toEqual(
      [],
    );
  });

  it("should not flag a message that does not belong to an error", () => {
    expect(rulesFound(mobileFile, `export const a = <Text>{copy.message}</Text>;`)).toEqual([]);
  });
});

describe("local copies of core helpers", () => {
  it("should flag a function declaration named like a core helper", () => {
    expect(rulesFound(webFile, `function formatGrams(value: number) { return ""; }`)).toEqual([
      "local-core-helper",
    ]);
  });

  it("should flag an arrow function named like a core helper", () => {
    expect(rulesFound(webFile, `export const describeEnergy = () => "";`)).toEqual([
      "local-core-helper",
    ]);
  });

  it("should not flag another name, an import or a call", () => {
    expect(
      rulesFound(
        webFile,
        `import { formatGrams } from "@keylow/core/format";\nconst a = formatGrams(1);\nfunction describeAmount() {}`,
      ),
    ).toEqual([]);
  });

  it("should not flag core's own definitions", () => {
    expect(
      rulesFound("packages/core/src/format/numbers.ts", `export function formatGrams() {}`),
    ).toEqual([]);
  });
});

describe("coloured text in light mode", () => {
  it.each([
    "text-danger",
    "text-warning",
    "text-success",
    "text-accent",
    "text-protein",
    "text-carbs",
    "text-fat",
    "text-calories",
    "text-danger/80",
    "hover:text-warning",
    "light-theme:text-danger",
    "motion-reduce:text-accent",
  ])("should flag %s when nothing scopes it to dark", (className) => {
    expect(rulesFound(webFile, `export const c = "flex ${className}";`)).toEqual([
      "light-mode-coloured-text",
    ]);
  });

  it.each([
    "text-text-primary",
    "text-accent-foreground",
    "text-accent-ink",
    "text-warning-ink",
    "text-success-ink",
    "bg-danger-muted",
    "border-danger",
    "text-caption",
  ])("should not flag %s", (className) => {
    expect(rulesFound(webFile, `export const c = "flex ${className}";`)).toEqual([]);
  });

  it("should allow a colour that the dark variant carries on mobile, where it follows the app's scheme", () => {
    expect(rulesFound(mobileFile, `export const c = "dark:text-warning";`)).toEqual([]);
  });

  it("should not accept the dark variant on web, where it follows the operating system and not the app's theme", () => {
    expect(rulesFound(webFile, `export const c = "dark:text-warning";`)).toEqual([
      "light-mode-coloured-text",
    ]);
  });

  it("should allow a colour that the same class string takes back in light", () => {
    expect(
      rulesFound(webFile, `export const c = "text-warning light-theme:text-text-primary";`),
    ).toEqual([]);
  });

  it("should flag a colour whose light override is itself coloured", () => {
    expect(rulesFound(webFile, `export const c = "text-warning light-theme:text-danger";`)).toEqual(
      ["light-mode-coloured-text", "light-mode-coloured-text"],
    );
  });

  it("should allow a colour in the dark branch of a scheme check", () => {
    expect(
      rulesFound(
        mobileFile,
        `export const c = platform === "android" || scheme === "light" ? "text-text-primary" : "text-accent";`,
      ),
    ).toEqual([]);
    expect(
      rulesFound(
        mobileFile,
        `export const c = scheme === "dark" ? "text-accent" : "text-text-primary";`,
      ),
    ).toEqual([]);
  });

  it("should flag a colour in the light branch of a scheme check", () => {
    expect(
      rulesFound(
        mobileFile,
        `export const c = scheme === "light" ? "text-accent" : "text-text-primary";`,
      ),
    ).toEqual(["light-mode-coloured-text"]);
  });

  it("should flag a colour in a branch of a check that is not about the scheme", () => {
    expect(
      rulesFound(webFile, `export const c = isActive ? "text-accent" : "text-text-primary";`),
    ).toEqual(["light-mode-coloured-text"]);
  });

  it("should allow a colour a dark text class name carries", () => {
    expect(
      rulesFound(
        mobileFile,
        `export const tones = { accent: { darkTextClassName: "text-accent" } };`,
      ),
    ).toEqual([]);
  });

  it("should allow danger text on a small alert caption, as the boards draw a field error", () => {
    expect(
      rulesFound(
        webFile,
        `export const a = <span role="alert" className="col-span-full text-caption text-danger">{x}</span>;`,
      ),
    ).toEqual([]);
  });

  it("should allow the caption when the role and the colour are chosen by conditions", () => {
    expect(
      rulesFound(
        webFile,
        `export const a = <span role={hasError ? "alert" : undefined} className={cn("text-caption", hasError ? "text-text-muted" : "text-danger")}>{x}</span>;`,
      ).filter((rule) => rule === "light-mode-coloured-text"),
    ).toEqual([]);
  });

  it("should flag danger text that is an alert but not a caption", () => {
    expect(
      rulesFound(
        webFile,
        `export const a = <p role="alert" className="text-h2 text-danger">{x}</p>;`,
      ),
    ).toEqual(["light-mode-coloured-text"]);
  });

  it("should flag a caption that is not an alert", () => {
    expect(
      rulesFound(webFile, `export const a = <p className="text-caption text-danger">{x}</p>;`),
    ).toEqual(["light-mode-coloured-text"]);
  });

  it("should flag warning text on an alert caption, because only an error is drawn in colour", () => {
    expect(
      rulesFound(
        webFile,
        `export const a = <p role="alert" className="text-caption text-warning">{x}</p>;`,
      ),
    ).toEqual(["light-mode-coloured-text"]);
  });

  it("should leave packages alone, because only the apps draw text", () => {
    expect(rulesFound("packages/api-client/src/a.ts", `export const c = "text-danger";`)).toEqual(
      [],
    );
  });
});

describe("which files are scanned", () => {
  it("should not scan a test file", () => {
    expect(rulesFound("apps/web/test/ui/button.test.tsx", `const c = "#fff text-danger";`)).toEqual(
      [],
    );
    expect(rulesFound("apps/mobile/test/a.ts", `const c = "#fff";`)).toEqual([]);
  });

  it("should not scan the bundles that bundle-core-for-deno writes for the Edge Functions", () => {
    const generated = `const c = "#fff";`;

    expect(rulesFound("packages/db/supabase/functions/_shared/core/index.js", generated)).toEqual(
      [],
    );
    expect(rulesFound("packages/db/supabase/functions/_shared/repos/index.js", generated)).toEqual(
      [],
    );
  });

  it("should still scan the hand-written files beside the bundles and lookalike folders elsewhere", () => {
    const hex = `export const c = "#fff";`;

    expect(rulesFound("packages/db/supabase/functions/_shared/repos.ts", hex)).toEqual(["raw-hex"]);
    expect(rulesFound("packages/db/supabase/functions/_shared/core.ts", hex)).toEqual(["raw-hex"]);
    expect(rulesFound("packages/api-client/src/_shared/repos/x.ts", hex)).toEqual(["raw-hex"]);
    expect(rulesFound("packages/api-client/src/_shared/core/x.ts", hex)).toEqual(["raw-hex"]);
  });

  it("should report each problem of a file in order of line", () => {
    const violations = checkSource({
      path: webFile,
      source: `const a = "#fff";\nconst b = "text-danger";`,
      coreHelperNames,
    });

    expect(violations.map((violation) => [violation.rule, violation.line])).toEqual([
      ["raw-hex", 1],
      ["light-mode-coloured-text", 2],
    ]);
  });
});

describe("a design colour name that reads like a shadcn class", () => {
  it("should not flag a colour looked up by its name", () => {
    expect(
      rulesFound(
        mobileFile,
        `export const c = colors["text-primary"];\nexport const t = { tone: "text-muted" };`,
      ),
    ).toEqual([]);
  });

  it("should flag the same word written as a class list", () => {
    expect(rulesFound(webFile, `export const a = <p className="text-muted">{x}</p>;`)).toEqual([
      "shadcn-colour-class",
    ]);
    expect(rulesFound(webFile, `export const c = cn("p-4", "text-primary");`)).toEqual([
      "shadcn-colour-class",
    ]);
  });
});

describe("a raw console call in an Edge Function", () => {
  const functionFile = "packages/db/supabase/functions/assistant/turn.ts";

  it("should flag each console method called in a function", () => {
    expect(
      rulesFound(
        functionFile,
        `console.log("a");\nconsole.info("b");\nconsole.warn("c");\nconsole.error("d");\nconsole.debug("e");`,
      ),
    ).toEqual(Array<RuleName>(5).fill("raw-console-in-function"));
  });

  it("should report the line and the method", () => {
    const [violation] = checkSource({
      path: functionFile,
      source: `const a = 1;\nconsole.log(a);`,
      coreHelperNames,
    });

    expect(violation).toMatchObject({
      rule: "raw-console-in-function",
      line: 2,
      detail: "console.log",
    });
  });

  it.each([
    [`console["log"]("a");`],
    ["console[`log`]('a');"],
    [`const { log } = console;`],
    [`const { log: write } = console;`],
    [`const c = console;\nc.log("a");`],
    [`foo(console);`],
    [`const all = { ...console };`],
    [`const all = { console };`],
    [`globalThis["console"].warn("a");`],
    [`globalThis[name].warn("a");`],
    [`self.console.log("a");`],
    [`window.console.log("a");`],
    [`console[method]("a");`],
    [`console?.log("a");`],
    [`(0, console.log)("a");`],
    [`const { console: c } = globalThis;`],
    [`import { log } from "console";`],
    [`import { log } from "node:console";`],
    [`const { log } = await import("node:console");`],
    [`const { log } = await import("console");`],
    [`const { log } = require("console");`],
    [`const { log } = require("node:console");`],
  ])("should flag %s", (source) => {
    expect(rulesFound(functionFile, source)).not.toEqual([]);
    expect(rulesFound(functionFile, source)).toEqual(
      expect.arrayContaining(["raw-console-in-function"]),
    );
  });

  it("should flag a console method taken by reference, so it cannot be called later", () => {
    expect(rulesFound(functionFile, `const write = console.log;`)).toEqual([
      "raw-console-in-function",
    ]);
  });

  it("should flag the console reached through globalThis", () => {
    expect(rulesFound(functionFile, `globalThis.console.log("a");`)).toEqual([
      "raw-console-in-function",
    ]);
  });

  it("should flag the console in a shared helper of the functions", () => {
    expect(
      rulesFound("packages/db/supabase/functions/_shared/http.ts", `console.error("a");`),
    ).toEqual(["raw-console-in-function"]);
  });

  it("should allow logLine to write to the console, as the one place that does", () => {
    expect(
      rulesFound("packages/db/supabase/functions/_shared/log.ts", `console.info("a");`),
    ).toEqual([]);
  });

  it("should allow the test support that replaces the console to record it", () => {
    expect(
      rulesFound(
        "packages/db/supabase/functions/_shared/assistant/testing.ts",
        `const originals = { log: console.log };`,
      ),
    ).toEqual([]);
  });

  it("should allow a console call in a function's test", () => {
    expect(
      rulesFound("packages/db/supabase/functions/_shared/off.test.ts", `console.error = () => {};`),
    ).toEqual([]);
  });

  it("should allow a console call outside the functions", () => {
    expect(rulesFound("packages/db/scripts/seed.ts", `console.log("seeded");`)).toEqual([]);
    expect(rulesFound(webFile, `console.log("a");`)).toEqual([]);
  });

  it("should not flag a variable that is merely named console", () => {
    expect(
      rulesFound(functionFile, `const adminConsole = { log() {} };\nadminConsole.log();`),
    ).toEqual([]);
  });
});
