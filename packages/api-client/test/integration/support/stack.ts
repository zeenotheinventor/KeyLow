// The stack clients are the ones @keylow/db's integration suites use, so the two cannot drift apart.
// This file only keeps the import path that this suite's test files already use.
export { adminClient, anonClient } from "../../../../db/test/integration/support/stack";
