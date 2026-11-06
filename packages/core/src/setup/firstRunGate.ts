/**
 * Whether the first run gate sends an account to the setup wizard, the one definition of "not set up" for the phone
 * and the web. Only a finished read of an account that is not set up counts. A failed read, a read under way (the
 * cache may hold another account's answer, left there when someone signed out and another signed in) and no read
 * at all (offline with nothing cached) all say no, so nobody is trapped. An account with no profile row reads as set
 * up, so it is never sent either.
 */
export function shouldSendToSetup({
  isError,
  isFetching,
  isSetUp,
}: Readonly<{
  isError: boolean;
  isFetching: boolean;
  /** `undefined` while nothing has been read. */
  isSetUp: boolean | undefined;
}>): boolean {
  return !isError && !isFetching && isSetUp === false;
}
