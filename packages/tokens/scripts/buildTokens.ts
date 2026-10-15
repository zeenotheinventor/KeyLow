import { parseCssScopes } from "./parseCss.ts";

export type TokenSourceTexts = {
  json: string;
  colorsCss: string;
  spacingCss: string;
  typographyCss: string;
  motionCss: string;
};

type FlatTokens = Record<string, string>;

export const darkSelector = ":root";
export const lightSelector = '[data-theme="light"]';
export const reducedMotionSelector = "@media (prefers-reduced-motion:reduce) :root";
const statusBarStyleName = "status-bar-style";

const isFlatTokens = (value: unknown): value is FlatTokens =>
  typeof value === "object" &&
  value !== null &&
  Object.values(value).every((entry) => typeof entry === "string");

const readTokenJson = (text: string): { dark: FlatTokens; light: FlatTokens } => {
  const parsed: unknown = JSON.parse(text);
  if (
    typeof parsed === "object" &&
    parsed !== null &&
    "dark" in parsed &&
    "light" in parsed &&
    isFlatTokens(parsed.dark) &&
    isFlatTokens(parsed.light)
  ) {
    return { dark: parsed.dark, light: parsed.light };
  }
  throw new Error("The token JSON needs a dark and a light theme of string values");
};

export const declarationsUnder = (
  stylesheets: ReturnType<typeof parseCssScopes>[],
  selector: string,
): FlatTokens =>
  Object.fromEntries(stylesheets.flatMap((scopes) => Object.entries(scopes[selector] ?? {})));

const customProperties = (declarations: FlatTokens): FlatTokens =>
  Object.fromEntries(
    Object.entries(declarations)
      .filter(([property]) => property.startsWith("--"))
      .map(([property, value]) => [property.slice(2), value]),
  );

const assertSameTokens = (label: string, fromJson: FlatTokens, fromCss: FlatTokens): void => {
  const names = new Set([...Object.keys(fromJson), ...Object.keys(fromCss)]);
  const differing = [...names].filter((name) => fromJson[name] !== fromCss[name]);
  if (differing.length > 0) {
    throw new Error(`The JSON and the CSS disagree for ${label}: ${differing.join(", ")}`);
  }
};

const assertSameNames = (label: string, dark: FlatTokens, light: FlatTokens): void => {
  const names = new Set([...Object.keys(dark), ...Object.keys(light)]);
  const missing = [...names].filter((name) => !(name in dark) || !(name in light));
  if (missing.length > 0) {
    throw new Error(`The dark and light themes name different ${label}: ${missing.join(", ")}`);
  }
};

const createLedger = (label: string, tokens: FlatTokens) => {
  const remaining = new Map(Object.entries(tokens));

  const take = (name: string): string => {
    const value = remaining.get(name);
    if (value === undefined) throw new Error(`The ${label} theme has no token ${name}`);
    remaining.delete(name);
    return value;
  };

  const takeMatching = (pattern: RegExp): FlatTokens => {
    const matched: FlatTokens = {};
    for (const [name, value] of [...remaining]) {
      const suffix = pattern.exec(name)?.[1];
      if (suffix !== undefined) {
        matched[suffix] = value;
        remaining.delete(name);
      }
    }
    return matched;
  };

  const namesMatching = (pattern: RegExp): string[] =>
    [...remaining.keys()].flatMap((name) => {
      const suffix = pattern.exec(name)?.[1];
      return suffix === undefined ? [] : [suffix];
    });

  const assertEmpty = (): void => {
    if (remaining.size > 0) {
      throw new Error(
        `These ${label} tokens have no export yet: ${[...remaining.keys()].join(", ")}`,
      );
    }
  };

  return { take, takeMatching, namesMatching, assertEmpty };
};

const mapValues = <Input, Output>(
  record: Record<string, Input>,
  convert: (value: Input) => Output,
): Record<string, Output> =>
  Object.fromEntries(Object.entries(record).map(([name, value]) => [name, convert(value)]));

const toNumber = (value: string, unit: "px" | "ms" | ""): number => {
  const match = new RegExp(`^(-?\\d+(?:\\.\\d+)?)${unit}$`).exec(value);
  if (match?.[1] === undefined)
    throw new Error(`Expected a number in ${unit || "unitless"}: ${value}`);
  return Number(match[1]);
};

const toBezier = (value: string): [number, number, number, number] => {
  const body = /^cubic-bezier\(([^)]+)\)$/.exec(value)?.[1];
  const [x1, y1, x2, y2, ...rest] = (body ?? "").split(",").map(Number);
  if (
    x1 === undefined ||
    y1 === undefined ||
    x2 === undefined ||
    y2 === undefined ||
    rest.length > 0
  ) {
    throw new Error(`Expected cubic-bezier(x1,y1,x2,y2): ${value}`);
  }
  return [x1, y1, x2, y2];
};

const splitFontStack = (value: string): string[] => value.match(/"[^"]*"|[^,]+/g) ?? [];

const takeColors = (ledger: ReturnType<typeof createLedger>, colorNames: string[]): FlatTokens =>
  Object.fromEntries(colorNames.map((name) => [name, ledger.take(name)]));

const takeElevation = (ledger: ReturnType<typeof createLedger>): FlatTokens =>
  ledger.takeMatching(/^elevation-(.+)$/);

/**
 * Turns the design system's JSON and CSS into the data `src/source.generated.ts` holds. It throws
 * when the JSON and the CSS disagree, when the themes are not the same set, or when a token has no
 * export, so a design edit never slips past unnoticed.
 */
export const buildTokens = (sources: TokenSourceTexts): Record<string, unknown> => {
  const tokenJson = readTokenJson(sources.json);
  const stylesheets = [
    sources.colorsCss,
    sources.spacingCss,
    sources.typographyCss,
    sources.motionCss,
  ].map(parseCssScopes);
  const [colorsStylesheet, , , motionStylesheet] = stylesheets;

  const dark = customProperties(declarationsUnder(stylesheets, darkSelector));
  const light = customProperties(declarationsUnder(stylesheets, lightSelector));
  assertSameTokens("the dark theme", tokenJson.dark, dark);
  assertSameTokens("the light theme", tokenJson.light, light);

  const colorNames = Object.keys(customProperties(colorsStylesheet?.[darkSelector] ?? {})).filter(
    (name) => name !== statusBarStyleName,
  );
  const colorSchemeDark = colorsStylesheet?.[darkSelector]?.["color-scheme"];
  const colorSchemeLight = colorsStylesheet?.[lightSelector]?.["color-scheme"];
  if (colorSchemeDark === undefined || colorSchemeLight === undefined) {
    throw new Error("colors.css must declare color-scheme for the dark and the light theme");
  }

  const darkLedger = createLedger("dark", tokenJson.dark);
  const colors = takeColors(darkLedger, colorNames);
  const statusBarStyleDark = darkLedger.take(statusBarStyleName);
  const elevationDark = takeElevation(darkLedger);
  const spacing = darkLedger.takeMatching(/^space-(.+)$/);
  const borderRadius = darkLedger.takeMatching(/^radius-(.+)$/);
  const iconSize = mapValues(darkLedger.takeMatching(/^icon-(?!stroke$)(.+)$/), (value) =>
    toNumber(value, "px"),
  );
  const iconStroke = toNumber(darkLedger.take("icon-stroke"), "");
  const touchTarget = toNumber(darkLedger.take("touch-target"), "px");
  const controlHeight = mapValues(darkLedger.takeMatching(/^control-height-(.+)$/), (value) =>
    toNumber(value, "px"),
  );
  const focusRing = {
    width: toNumber(darkLedger.take("focus-ring-width"), "px"),
    offsetWidth: toNumber(darkLedger.take("focus-ring-offset-width"), "px"),
  };
  const tabBarHeight = toNumber(darkLedger.take("tab-bar-height"), "px");
  const sheetHandle = {
    width: toNumber(darkLedger.take("sheet-handle-width"), "px"),
    height: toNumber(darkLedger.take("sheet-handle-height"), "px"),
  };
  const safeArea = {
    top: darkLedger.take("safe-area-top"),
    bottom: darkLedger.take("safe-area-bottom"),
  };

  const fontFamily = { sans: splitFontStack(darkLedger.take("font-sans")) };
  const fontNumeric = darkLedger.take("font-numeric");
  const fontWeight = darkLedger.takeMatching(/^weight-(.+)$/);
  const fontSize = Object.fromEntries(
    darkLedger.namesMatching(/^type-(.+)-size$/).map((name) => [
      name,
      [
        darkLedger.take(`type-${name}-size`),
        {
          lineHeight: darkLedger.take(`type-${name}-line`),
          letterSpacing: darkLedger.take(`type-${name}-tracking`),
          fontWeight: darkLedger.take(`type-${name}-weight`),
        },
      ],
    ]),
  );

  const transitionDuration = darkLedger.takeMatching(/^duration-(.+)$/);
  const motionDuration = mapValues(transitionDuration, (value) => toNumber(value, "ms"));
  const stagger = toNumber(darkLedger.take("stagger"), "ms");
  const skeletonDelay = toNumber(darkLedger.take("skeleton-delay"), "ms");
  const transitionTimingFunction = darkLedger.takeMatching(/^ease-(.+)$/);
  const easingCurve = mapValues(transitionTimingFunction, toBezier);
  const motionScale = {
    distance: toNumber(darkLedger.take("motion-distance"), ""),
    skew: toNumber(darkLedger.take("motion-skew"), ""),
  };
  const pressScale = toNumber(darkLedger.take("press-scale"), "");
  const pressScaleRow = toNumber(darkLedger.take("press-scale-row"), "");
  const haptic = darkLedger.takeMatching(/^haptic-(.+)$/);
  darkLedger.assertEmpty();

  const lightLedger = createLedger("light", tokenJson.light);
  const lightColors = takeColors(lightLedger, colorNames);
  const statusBarStyleLight = lightLedger.take(statusBarStyleName);
  const elevationLight = takeElevation(lightLedger);
  lightLedger.assertEmpty();
  assertSameNames("elevation shadows", elevationDark, elevationLight);

  const reducedMotionLedger = createLedger(
    "reduced-motion",
    customProperties(motionStylesheet?.[reducedMotionSelector] ?? {}),
  );
  const reducedMotion = {
    distance: toNumber(reducedMotionLedger.take("motion-distance"), ""),
    skew: toNumber(reducedMotionLedger.take("motion-skew"), ""),
    pressScale: toNumber(reducedMotionLedger.take("press-scale"), ""),
    pressScaleRow: toNumber(reducedMotionLedger.take("press-scale-row"), ""),
    timingFunction: reducedMotionLedger.takeMatching(/^ease-(.+)$/),
  };
  reducedMotionLedger.assertEmpty();

  return {
    colors,
    lightColors,
    statusBarStyle: { dark: statusBarStyleDark, light: statusBarStyleLight },
    colorScheme: { dark: colorSchemeDark, light: colorSchemeLight },
    elevation: { dark: elevationDark, light: elevationLight },
    spacing,
    borderRadius,
    iconSize,
    iconStroke,
    touchTarget,
    controlHeight,
    focusRing,
    tabBarHeight,
    sheetHandle,
    safeArea,
    fontFamily,
    fontNumeric,
    fontWeight,
    fontSize,
    transitionDuration,
    motionDuration,
    stagger,
    skeletonDelay,
    transitionTimingFunction,
    easingCurve,
    motionScale,
    pressScale,
    pressScaleRow,
    reducedMotion,
    haptic,
  };
};
