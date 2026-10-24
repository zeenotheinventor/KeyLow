import type { ExpenditureMeasurement, TargetsBasis } from "../schemas";

/*
 * What the program model reads is what the screens already hold: the camelCase rows of
 * `@keylow/api-client`'s programme read (`ExpenditureSnapshot`, `TargetsRow`), with `measurement` and
 * `basis` parsed by core's schemas. These types name only the fields the model uses, so those rows go in
 * as they are, and core does not import the client.
 */

/** One expenditure estimate. A `start` snapshot has no measurement and a `checkin` snapshot always has one. */
export type ProgramSnapshot = Readonly<
  | {
      kind: "start";
      asOfDate: string;
      muKcal: number;
      varKcal2: number;
      measurement: null;
    }
  | {
      kind: "checkin";
      asOfDate: string;
      muKcal: number;
      varKcal2: number;
      measurement: ExpenditureMeasurement;
    }
>;

/** One row of targets: its calories, and the basis it was worked out from. */
export type ProgramTargets = Readonly<{
  caloriesKcal: number;
  basis: TargetsBasis;
}>;
