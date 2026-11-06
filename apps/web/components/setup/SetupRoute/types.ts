import type { SetupMode } from "@/lib/setupRoutes";

export type SetupRouteProps = {
  /** The `[step]` segment of the address, or `undefined` for `/setup`, which is the first step. */
  segment: string | undefined;
  mode: SetupMode;
};
