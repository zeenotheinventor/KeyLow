import type { ReplayRow } from "./replayRow.ts";

const COLUMN_HEADINGS = [
  "Date",
  "Check-in",
  "mu",
  "80% band",
  "K",
  "Step",
  "Trend kg",
  "kcal",
  "P g",
  "F g",
  "C g",
  "Clamps",
];

const COLUMN_GAP = "  ";
const NOT_AVAILABLE = "-";

function describeStep(row: ReplayRow): string {
  if (row.stepKcal === null) {
    return NOT_AVAILABLE;
  }
  const signed = `${row.stepKcal < 0 ? "-" : "+"}${Math.abs(row.stepKcal).toFixed(1)}`;
  return row.stepClamped === true ? `${signed} clamped` : signed;
}

function toCells(row: ReplayRow): string[] {
  return [
    row.asOfDate,
    row.eligible ? "eligible" : `ineligible (${row.reasons.join(", ")})`,
    row.muKcal.toFixed(2),
    `${row.bandLowKcal}-${row.bandHighKcal}`,
    row.gain === null ? NOT_AVAILABLE : row.gain.toFixed(3),
    describeStep(row),
    row.trendWeightKg === null ? NOT_AVAILABLE : row.trendWeightKg.toFixed(2),
    String(row.caloriesKcal),
    String(row.proteinG),
    String(row.fatG),
    String(row.carbsG),
    row.clamps.length === 0 ? NOT_AVAILABLE : row.clamps.join(", "),
  ];
}

/** The rows as a table with the column headings first, each column as wide as its widest cell. */
export function formatTable(rows: readonly ReplayRow[]): string {
  const lines = [COLUMN_HEADINGS, ...rows.map(toCells)];
  const widths = COLUMN_HEADINGS.map((_, column) =>
    Math.max(...lines.map((cells) => cells[column]?.length ?? 0)),
  );
  return lines
    .map((cells) =>
      cells
        .map((cell, column) => cell.padEnd(widths[column] ?? 0))
        .join(COLUMN_GAP)
        .trimEnd(),
    )
    .join("\n");
}
