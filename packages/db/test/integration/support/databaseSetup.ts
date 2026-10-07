import { requireStack } from "./globalSetup";

import type { TestProject } from "vitest/node";

/** Global setup for the suites that need only the database: the stack must be running, nothing else. */
export default async function setup(project: TestProject) {
  project.provide("stack", await requireStack());
}
