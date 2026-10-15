import { requireServedFunction, startOffMockOrExplain } from "./functionsLane";
import { requireStack } from "./requireStack";

import type { TestProject } from "vitest/node";

export default async function setup(project: TestProject) {
  const stack = await requireStack();
  await requireServedFunction(stack, "off-product");
  await requireServedFunction(stack, "off-search");
  project.provide("stack", stack);
  return await startOffMockOrExplain();
}
