import type { Targets } from "@keylow/api-client";
import type { ReactNode } from "react";

export type TargetsFormProps = {
  /** The stored targets, which the fields start with. */
  initial: Targets;
  /** Drawn at the top of the form's scrolling content, above Calories, so it scrolls with the fields. */
  header?: ReactNode;
  /**
   * For a person whose programme runs: a save ends it, so the form says so in place of its usual note and asks
   * first, in a dialog, before it saves. Leave it out for someone with no programme.
   */
  endsProgramme?: boolean;
};
