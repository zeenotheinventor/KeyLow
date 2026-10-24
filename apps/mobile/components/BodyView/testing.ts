import { failureMemory } from "./useBody3DSupport";

/** Forgets that 3D failed, so each test starts from a fresh launch. For tests only. */
export function resetBody3DSupportForTests(): void {
  failureMemory.hasFailed = false;
}
