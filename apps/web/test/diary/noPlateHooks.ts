/**
 * The plate's reads and its write for a test that mocks the api-client's hooks and is not about the plate: the
 * day's bars cannot be read, so the strip is left out, and logging the plate fails. Spread it into the mock
 * beside the others.
 */
export const noPlateHooks = {
  useDiaryDay: () => ({ data: undefined, isError: true, fetchStatus: "idle" }),
  useTargets: () => ({ data: undefined, isError: true, fetchStatus: "idle" }),
  useLogPlateEntries: () => ({ mutateAsync: () => Promise.reject(new Error("not used")) }),
};
