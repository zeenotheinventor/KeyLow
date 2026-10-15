// `pnpm check:affected`: runs the checks the change on this branch can affect, measured against
// origin/main (or `--base <ref>`, for a branch stacked on another). CI runs the full gate on the pull
// request, so this is what to run before a push. It needs git and turbo.
import { execFileSync, spawnSync } from "node:child_process";
import { pathToFileURL } from "node:url";

// Turbo only maps a file inside a package to that package. A change anywhere else (root config, the
// lockfile, a workflow) can reach any package without turbo seeing it, so it runs every check. Markdown
// is the exception: the formatting step and the repository-wide suites already cover it.
const insideAPackageOrMarkdown = /^(apps|packages|tools)\/|\.md$/;

/**
 * @param {string[]} changedFiles
 * @param {() => string[]} listAffectedPackages
 */
export function scopeOf(changedFiles, listAffectedPackages) {
  if (changedFiles.some((file) => !insideAPackageOrMarkdown.test(file))) {
    return { full: true, packages: [] };
  }
  return { full: false, packages: listAffectedPackages() };
}

const git = (/** @type {string[]} */ args) =>
  execFileSync("git", args, { encoding: "utf8", maxBuffer: 64 * 1024 * 1024 });

const run = (/** @type {string} */ program, /** @type {string[]} */ args) => {
  console.log(`\n> ${program} ${args.join(" ")}`);
  const { status } = spawnSync(program, args, { stdio: "inherit" });
  if (status !== 0) process.exit(status ?? 1);
};

// Turbo starts up to ten tasks at once and each test task starts a worker per core. Half the cores per
// turbo run (and per test task, see the vitest and jest configs) keeps a run near the machine's core
// count, so several agents can run it side by side.
const concurrency = "--concurrency=50%";

function check() {
  const baseOption = process.argv.indexOf("--base");
  const base = baseOption === -1 ? "origin/main" : (process.argv[baseOption + 1] ?? "origin/main");
  // A stale origin/main gives the wrong set of packages. Without a network the old copy serves.
  if (
    base === "origin/main" &&
    spawnSync("git", ["fetch", "origin", "main"], { stdio: "inherit" }).status !== 0
  ) {
    console.warn("Could not fetch origin/main, so the comparison uses the copy already here.");
  }

  // Everything the working tree differs in from where the branch left the base: commits, staged and
  // unstaged edits, and files git does not track yet. --no-renames lists both sides of a move.
  const mergeBase = git(["merge-base", base, "HEAD"]).trim();
  const nulSeparated = (/** @type {string} */ output) => output.split("\0").filter(Boolean);
  const changedFiles = [
    ...new Set([
      ...nulSeparated(git(["diff", "--name-only", "--no-renames", "-z", mergeBase])),
      ...nulSeparated(git(["ls-files", "--others", "--exclude-standard", "-z"])),
    ]),
  ];
  if (changedFiles.length === 0) {
    console.log(`Nothing changed against ${base}, so nothing to run.`);
    return;
  }

  // Filtering on one commit (not `commit...HEAD`) also counts edits that are not committed yet.
  const { full, packages } = scopeOf(changedFiles, () =>
    JSON.parse(
      execFileSync("turbo", ["ls", `--filter=...[${mergeBase}]`, "--output=json"], {
        encoding: "utf8",
        stdio: ["ignore", "pipe", "inherit"],
      }),
    ).packages.items.map((/** @type {{ name: string }} */ item) => item.name),
  );

  if (full) {
    console.log("A file outside apps/, packages/ and tools/ changed, so every check runs.");
    return run("turbo", ["run", "format:check", "lint", "typecheck", "test", concurrency]);
  }
  console.log(`Affected packages: ${packages.join(" ") || "none"}`);
  if (packages.length > 0) {
    run("turbo", ["run", "lint", "typecheck", "test", `--filter=...[${mergeBase}]`, concurrency]);
  }
  // The root format task belongs to no package, so a package filter skips it, and Prettier takes seconds.
  run("prettier", ["--check", "."]);
  // These two suites read files across the repository instead of importing them, so turbo never counts
  // them as affected.
  run("turbo", [
    "run",
    "test",
    "--filter=@keylow/config",
    "--filter=@keylow/design-export",
    concurrency,
  ]);
}

if (import.meta.url === pathToFileURL(process.argv[1] ?? "").href) check();
