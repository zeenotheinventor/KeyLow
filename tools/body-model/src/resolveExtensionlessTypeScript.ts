// A Node module hook for the verify script. @keylow/core is consumed as source with extensionless imports, which
// the bundlers and Vitest resolve and plain Node does not, so a relative import with no extension is tried as
// <name>.ts and then <name>/index.ts.
import type { ResolveHook } from "node:module";

export const resolve: ResolveHook = async (specifier, context, nextResolve) => {
  try {
    return await nextResolve(specifier, context);
  } catch (error) {
    if (!specifier.startsWith(".")) {
      throw error;
    }
    try {
      return await nextResolve(`${specifier}.ts`, context);
    } catch {
      return nextResolve(`${specifier}/index.ts`, context);
    }
  }
};
