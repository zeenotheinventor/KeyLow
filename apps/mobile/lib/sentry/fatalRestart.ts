import AsyncStorage from "@react-native-async-storage/async-storage";
import { addBreadcrumb } from "@sentry/react-native";
import * as Updates from "expo-updates";

import type { ErrorUtils } from "react-native";

export const fatalRestartStorageKey = "sentry.fatalRestartTimes";

// expo-updates watches a start for 10 s after the first screen appears, and a fatal error in that time sends
// the app back to the update it last launched safely (and marks a bad one as failed). A fatal error this soon
// after the JavaScript starts is left to it, with a margin over the 10 s. This is also what stops a fatal error
// on every start from looping, because a restart is never made until a start has run this long.
export const fatalRestartArmedWindowMilliseconds = 20_000;

// No more than this many restarts in the period after it. A third fatal error inside the period ends the app as
// it would have, so a fault that comes back after every restart cannot keep the app restarting.
export const fatalRestartLimit = 2;
export const fatalRestartPeriodMilliseconds = 600_000;

// How long a restart may take. A reload goes through expo-updates' queue of work, so it can wait behind an
// update check or download. A reload that has started ends this JavaScript within moments, so if it is still
// running after this, the restart did nothing, and the error goes to the handler beneath.
export const fatalRestartFailsafeMilliseconds = 5_000;

// How recent the last restart must be for the app to know this start followed one, for the note in the trail.
// A restart is made within moments of the error, and the app starts again within seconds, so an older time is
// from a start long ago and says nothing about this one.
const followedRestartMilliseconds = 60_000;

/**
 * Restarts the app on a fatal JavaScript error, so a person is not left on a black screen. Call it before
 * `initSentry()`, not after: the Sentry SDK takes the handler it finds when it starts and calls it last,
 * after it has captured the error and flushed. This handler is then what the SDK calls where React Native's
 * own would be, so the error is sent once, by the SDK and through its scrubbing, and only then does the
 * app restart. A handler installed after the SDK could not wait for that, because the SDK's call to the
 * handler beneath it is out of reach.
 *
 * Without Sentry (no DSN) the restart still happens. These all go to the handler beneath, which ends the app
 * as it would have: a non-fatal error, a fatal error in a development build, an app that cannot reload
 * (`Updates.isEnabled` is false), a fatal error in the first 20 s of a start, a third restart in 10 minutes,
 * a reload that fails, and a reload that has not happened after 5 s. The times of the restarts are kept in the
 * phone's small store, and a store that cannot be read or written means no restart.
 */
export function installFatalRestart(): void {
  const errorUtils = findErrorUtils();
  if (errorUtils === undefined) {
    return;
  }

  const handlerBeneath = errorUtils.getGlobalHandler();
  const startedAt = Date.now();
  // Not known until the store is read, and a read that fails leaves it so: no restart.
  let restartTimes: number[] | undefined;
  let isRestarting = false;

  void readRestartTimes().then((times) => {
    restartTimes = times;
    const lastRestartedAt = times?.at(-1);
    if (
      lastRestartedAt !== undefined &&
      startedAt - lastRestartedAt < followedRestartMilliseconds
    ) {
      addBreadcrumb({ category: "app.restart", data: { reason: "fatal" } });
    }
  });

  errorUtils.setGlobalHandler((error: unknown, isFatal?: boolean) => {
    if (isFatal !== true) {
      handlerBeneath(error, isFatal);
      return;
    }
    if (isRestarting) {
      return;
    }
    const now = Date.now();
    const recentRestartTimes = restartTimes?.filter(
      // A time in the future is from a clock that was set back, and would count as recent for as long.
      (time) => time <= now && now - time < fatalRestartPeriodMilliseconds,
    );
    if (
      __DEV__ ||
      !Updates.isEnabled ||
      now - startedAt < fatalRestartArmedWindowMilliseconds ||
      recentRestartTimes === undefined ||
      recentRestartTimes.length >= fatalRestartLimit
    ) {
      handlerBeneath(error, isFatal);
      return;
    }

    isRestarting = true;
    // The attempt counts from here, so one that gives up still counts toward the limit in this session.
    restartTimes = [...recentRestartTimes, now];
    let hasGivenUp = false;
    const giveUp = () => {
      if (hasGivenUp) {
        return;
      }
      hasGivenUp = true;
      clearTimeout(failsafe);
      isRestarting = false;
      handlerBeneath(error, isFatal);
    };
    const failsafe = setTimeout(giveUp, fatalRestartFailsafeMilliseconds);
    // A reload that works ends this JavaScript, and the timer with it, so a timer still running at the failsafe
    // means the app did not restart, even when `reloadAsync` resolved (it does so before the relaunch).
    restart(restartTimes).catch(giveUp);
  });
}

// React Native puts `ErrorUtils` on the global object. Where it is not there, there is no handler to wrap.
function findErrorUtils(): ErrorUtils | undefined {
  const candidate: unknown = Reflect.get(globalThis, "ErrorUtils");

  return isErrorUtils(candidate) ? candidate : undefined;
}

function isErrorUtils(candidate: unknown): candidate is ErrorUtils {
  return (
    typeof candidate === "object" &&
    candidate !== null &&
    "getGlobalHandler" in candidate &&
    typeof candidate.getGlobalHandler === "function" &&
    "setGlobalHandler" in candidate &&
    typeof candidate.setGlobalHandler === "function"
  );
}

// The times of the restarts, none as an empty list, and `undefined` when the store cannot be read or holds
// anything but a list of times.
async function readRestartTimes(): Promise<number[] | undefined> {
  try {
    const stored = await AsyncStorage.getItem(fatalRestartStorageKey);
    if (stored === null) {
      return [];
    }
    const times: unknown = JSON.parse(stored);

    return isListOfTimes(times) ? times : undefined;
  } catch {
    return undefined;
  }
}

function isListOfTimes(value: unknown): value is number[] {
  return (
    Array.isArray(value) && value.every((item) => typeof item === "number" && Number.isFinite(item))
  );
}

// The times go into the store first, so a restart that is not recorded is not made.
async function restart(restartTimes: number[]): Promise<void> {
  await AsyncStorage.setItem(fatalRestartStorageKey, JSON.stringify(restartTimes));
  await Updates.reloadAsync();
}
