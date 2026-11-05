// The check:assistant command: `pnpm --filter @keylow/assistant-evals check:assistant`, run by hand or from
// the assistant-evals workflow (workflow_dispatch only). The case sets (KEY-699 to KEY-702) are added by their
// own tickets. The ask set (KEY-699) and the compaction set (KEY-706) are registered here. A run talks to the served `assistant`
// function on the local stack through the HTTP driver.
import { runCli } from "./cli.ts";
import { openLocalHttpSession } from "./httpSession.ts";
import { askCases } from "../cases/ask.ts";
import { compactionCases } from "../cases/compaction.ts";

const output = await runCli(process.argv.slice(2), process.env, {
  cases: [...askCases, ...compactionCases],
  openSession: openLocalHttpSession,
});

if (output.stdout !== "") {
  console.log(output.stdout);
}
if (output.stderr !== "") {
  console.error(output.stderr);
}
process.exitCode = output.exitCode;
