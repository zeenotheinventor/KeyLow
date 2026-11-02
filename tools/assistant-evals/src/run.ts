// The check:assistant command: `pnpm --filter @keylow/assistant-evals check:assistant`, run by hand or from
// the assistant-evals workflow (workflow_dispatch only). The case sets (KEY-699 to KEY-702) and the HTTP
// driver (KEY-682) are added by their own tickets, so for now no case is registered.
import { runCli } from "./cli.ts";

const output = await runCli(process.argv.slice(2), process.env, {
  cases: [],
  openSession: () =>
    Promise.reject(new Error("The HTTP driver is not built yet, the turn-loop ticket adds it")),
});

if (output.stdout !== "") {
  console.log(output.stdout);
}
if (output.stderr !== "") {
  console.error(output.stderr);
}
process.exitCode = output.exitCode;
