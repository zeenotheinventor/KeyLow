/**
 * The columns of a set table, in points as the `session · active` board draws them: the set mark 32, the
 * Previous the rest, the load 60, the reps 52, the RIR 44 and the check 40, with 6 between and 12 at the
 * sides. The card's headings and the rows' cells share them, so the two cannot drift apart. The classes are
 * written out so Tailwind sees them.
 */
export const setColumnClassName = {
  // 6 points, as the board draws; `gap-1.5` is 5.25 under the rem base of 14.
  row: "gap-[6px] px-3",
  mark: "w-8",
  previous: "min-w-0 flex-1",
  load: "w-[60px]",
  reps: "w-[52px]",
  rir: "w-11",
  check: "w-10",
} as const;
