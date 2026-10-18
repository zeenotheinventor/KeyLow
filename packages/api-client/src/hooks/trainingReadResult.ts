import type { UseQueryResult } from "@tanstack/react-query";

/**
 * What a training read hook gives. A training number is worked out from several cached reads (the
 * rows, the active routine and the user's time zone), so the hook reports them as one:
 * `data` is undefined until all are there, `isPending` is true while it is, and `isError` is true when
 * a read failed and there is nothing to show yet. `error` then holds an error that names the action and
 * the database code only. A background refetch that fails never replaces data already on screen.
 */
export type TrainingReadResult<Data> = {
  data: Data | undefined;
  isPending: boolean;
  isError: boolean;
  error: Error | null;
};

/**
 * One result from the read the number is computed in and the reads it waits for. `gates` are the reads
 * whose data must be there before any number is given, even when the computed read has rows already
 * (a restored cache can hold the rows and not the routine, and a number worked out without the routine
 * would call every muscle targeted). `prerequisites` are every read the computed one depends on, and a
 * failure of any of them, or of the computed read itself, is the error while there is no data to show.
 */
export function toTrainingReadResult<Data>(
  computed: UseQueryResult<Data>,
  prerequisites: readonly UseQueryResult[],
  gates: readonly UseQueryResult[],
): TrainingReadResult<Data> {
  if (computed.data !== undefined && gates.every((gate) => gate.data !== undefined)) {
    return { data: computed.data, isPending: false, isError: false, error: null };
  }

  const failed = [...prerequisites, computed].find(
    (read) => read.isError && read.data === undefined,
  );
  return failed === undefined
    ? { data: undefined, isPending: true, isError: false, error: null }
    : { data: undefined, isPending: false, isError: true, error: failed.error };
}
