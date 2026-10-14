import type ts from "typescript";

export type RuleName =
  | "raw-hex"
  | "inline-style"
  | "retired-placeholder-class"
  | "shadcn-colour-class"
  | "tailwind-palette-class"
  | "error-message-in-jsx"
  | "local-core-helper"
  | "light-mode-coloured-text";

export type Violation = {
  rule: RuleName;
  /** Relative to the repository root, with forward slashes. */
  path: string;
  line: number;
  /** What was found, such as the colour or the class. An allowlist entry can name it. */
  detail?: string;
  message: string;
};

/** What a rule reads: one source file, parsed. */
export type SourceContext = {
  path: string;
  sourceFile: ts.SourceFile;
  /** The names core exports as format, copy, search and food helpers. */
  coreHelperNames: ReadonlySet<string>;
};

/** Reports a problem at a node. */
export type Report = (rule: RuleName, node: ts.Node, message: string, detail?: string) => void;
