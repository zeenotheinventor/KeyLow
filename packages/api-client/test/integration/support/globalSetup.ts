import {
  requireServedFunction,
  startOffMockOrExplain,
} from "../../../../db/test/integration/support/functionsLane";
import { requireStack } from "../../../../db/test/integration/support/requireStack";

import type { TestProject } from "vitest/node";

// Besides the stack, the barcode suite needs `off-product` served and the Open Food Facts mock
// that the served function fetches from, so both are required for every run of this suite.
export default async function setup(project: TestProject) {
  const stack = await requireStack();
  await requireServedFunction(stack, "off-product");
  project.provide("stack", stack);
  return await startOffMockOrExplain();
}
