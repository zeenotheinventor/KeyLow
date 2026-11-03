/**
 * Puts a test on Jest's fake clock, so a press costs no real time.
 *
 * Every `user.press` from Testing Library holds the press for 130 ms. On real timers that is a real
 * sleep with the worker idle. On the fake clock the same press advances virtual time and fires the same
 * events in the same order. Use this in a file that presses a lot and has no need of real elapsed time.
 *
 * Call it in `beforeEach` and call `jest.useRealTimers()` in `afterEach`, after any cleanup that waits.
 * `userEvent.setup()` needs no options: it already advances Jest's fake clock. `waitFor` and `findBy*`
 * advance it on every poll, so fetches, debounces and polling settle in virtual time. A bare `setTimeout`
 * sleep in a test would hang, so move the clock instead with
 * `await act(() => jest.advanceTimersByTimeAsync(ms))`.
 *
 * Every timer and `Date` are faked, microtasks included. React, React Query and Reanimated settle under
 * it, checked on the files that use it. Pass `now` to pin the date.
 */
export function installVirtualClock(options: { now?: Date } = {}) {
  jest.useFakeTimers(options.now ? { now: options.now } : {});
}
