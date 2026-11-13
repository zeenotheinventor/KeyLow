// The one way an Edge Function writes a log line. A line is an event and a few allow-listed fields:
// ids, counts, durations, codes, the route, the model, the transport and the tool name. A key outside
// the list is a type error, and at run time it is dropped, so a food, a weight, a diary entry or an
// error message cannot reach the logs by a new field. A text value that does not have the shape of its
// key is written as `unknown`. The source guard fails a raw `console.*` in the
// functions, so this file is the only caller of the console.

const uuidPattern = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
const toolNamePattern = /^[a-z][a-z0-9_]*$/;
const codePattern = /^[A-Za-z0-9_.:-]{1,64}$/;
// A function name may hold spaces, such as `assistant tool copy_day`. It is a constant the code
// chooses, never a value read from a request, so it only has to be short and plain.
const functionNamePattern = /^[A-Za-z0-9_.: -]{1,64}$/;

// The text keys, each with the shape its value must have. A value of another shape is logged as
// `unknown`, so a food name or a message put in a code slot shows up as `unknown` and never leaks.
const textPatterns = {
  user: uuidPattern,
  conversation: uuidPattern,
  turn: uuidPattern,
  tool: toolNamePattern,
  function: functionNamePattern,
  route: codePattern,
  gate: codePattern,
  step: codePattern,
  branch: codePattern,
  code: codePattern,
  result: codePattern,
  ending: codePattern,
  model: codePattern,
  transport: codePattern,
  errorType: codePattern,
} as const;

const numberKeys = [
  "users",
  "ran",
  "failed",
  "modelCalls",
  "toolCalls",
  "promptTokens",
  "noteTokens",
  "status",
  "milliseconds",
] as const;

export const allowedLogKeys: readonly string[] = [...Object.keys(textPatterns), ...numberKeys];

export type LogFields = {
  [Key in keyof typeof textPatterns]?: string | undefined;
} & {
  [Key in (typeof numberKeys)[number]]?: number | undefined;
};

export type LogLevel = "info" | "warn" | "error";

const isTextKey = (key: string): key is keyof typeof textPatterns =>
  Object.hasOwn(textPatterns, key);
const isNumberKey = (key: string): boolean => (numberKeys as readonly string[]).includes(key);

// One value, one token: a space or a line break would let a value pose as another field or line.
const singleToken = (text: string): string => text.replace(/\s/g, "_");

const checked = (key: keyof typeof textPatterns, value: string): string =>
  textPatterns[key].test(value) ? singleToken(value) : "unknown";

function pairOf(key: string, value: unknown): string | undefined {
  if (isTextKey(key) && typeof value === "string") {
    return `${key}=${checked(key, value)}`;
  }
  if (isNumberKey(key) && typeof value === "number") {
    return `${key}=${value}`;
  }
  return undefined;
}

/** Writes `event` and the allowed fields as `key=value` pairs, the duration last as `12ms`. */
export function logLine(level: LogLevel, event: string, fields: LogFields = {}): void {
  const { milliseconds, ...rest } = fields;
  const pairs = Object.entries(rest).flatMap(([key, value]) => pairOf(key, value) ?? []);
  const duration = typeof milliseconds === "number" ? [`${milliseconds}ms`] : [];
  console[level]([event, ...pairs, ...duration].join(" "));
}
