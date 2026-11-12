import { startPageServer } from "./pageServer.ts";
import { fixturePages } from "../fixtures/pages/index.ts";

import type { PageServer } from "./pageServer.ts";

// The page server of a run, started when the first case that reads a page needs it and stopped when the session
// closes. It is not started with the session, because integration tests open sessions in parallel and every one
// would bind the one fixed port (the `.env.test` of the served functions names it), and a run of the ask set has no
// use for a server at all. Every case that reads a page calls `ensurePageServer()` in its `setup`, so KEY-702's
// page cases use the same start, and the pages they add to `fixtures/pages/index.ts` are served by it.

type Start = (pages: ReadonlyMap<string, string>) => Promise<PageServer>;

/** A holder of one page server. `ensure` starts it once and `stop` closes it, whether or not it was started. */
export function createPageServerHolder(pages: ReadonlyMap<string, string>, start: Start) {
  let running: Promise<PageServer> | null = null;
  return {
    /** Starts the server on the first call and does nothing after. A start that failed is tried again by the next call. */
    ensure: async (): Promise<void> => {
      running ??= start(pages);
      try {
        await running;
      } catch (error) {
        running = null;
        throw error;
      }
    },
    /** Closes the server if one was started. Never throws for a start that failed. */
    stop: async (): Promise<void> => {
      const started = running;
      running = null;
      const server = await started?.catch(() => null);
      await server?.close();
    },
  };
}

const holder = createPageServerHolder(fixturePages, (pages) => startPageServer(pages));

/** Starts the run's page server if no case has yet. */
export const ensurePageServer = holder.ensure;

/** Stops it. The session calls this when it closes. */
export const stopPageServer = holder.stop;
