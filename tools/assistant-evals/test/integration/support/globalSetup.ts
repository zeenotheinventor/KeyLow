// The stack check and the stack clients are @keylow/db's own, as for the api-client suite, so the suites
// cannot drift apart. A run without the stack stops here with how to start it.
import { requireStack } from "../../../../../packages/db/test/integration/support/requireStack";

import type { TestProject } from "vitest/node";

export default async function setup(project: TestProject) {
  project.provide("stack", await requireStack());
}
