// Lists any board that canvas.json has and docs/design lacks, and any file docs/design has that the
// canvas does not list. Exits 1 when there is a difference.
//
//   pnpm --filter @keylow/design-export check:boards [--design <docs/design folder>]
import { resolve } from "node:path";
import { parseArgs } from "node:util";

import { checkBoards } from "./checkBoards.ts";

const { values } = parseArgs({
  options: {
    design: { type: "string", default: resolve(import.meta.dirname, "../../../docs/design") },
  },
});
const result = checkBoards(resolve(values.design));
console.log(`${result.boardCount} boards in ${result.screenCount} screens.`);
for (const path of result.missing) {
  console.log(`missing: ${path}`);
}
for (const path of result.extra) {
  console.log(`extra: ${path}`);
}
process.exit(result.missing.length === 0 && result.extra.length === 0 ? 0 : 1);
