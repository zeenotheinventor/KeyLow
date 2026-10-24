import {
  announceNewTargets,
  hasNewTargets,
  subscribeToNewTargets,
  takeNewTargets,
} from "./checkinToast";

describe("the new targets signal", () => {
  afterEach(() => {
    takeNewTargets();
  });

  it("should not be waiting before anything announces new targets", () => {
    expect(hasNewTargets()).toBe(false);
  });

  it("should be waiting once new targets are announced", () => {
    announceNewTargets();

    expect(hasNewTargets()).toBe(true);
  });

  it("should hand the signal over once and then be clear", () => {
    announceNewTargets();

    expect(takeNewTargets()).toBe(true);
    expect(takeNewTargets()).toBe(false);
    expect(hasNewTargets()).toBe(false);
  });

  it("should take nothing when nothing was announced", () => {
    expect(takeNewTargets()).toBe(false);
  });

  it("should stay one signal when it is announced twice", () => {
    announceNewTargets();
    announceNewTargets();

    expect(takeNewTargets()).toBe(true);
    expect(takeNewTargets()).toBe(false);
  });

  it("should tell a subscriber when it is announced and when it is taken", () => {
    const listener = jest.fn();
    const unsubscribe = subscribeToNewTargets(listener);

    announceNewTargets();
    takeNewTargets();

    expect(listener).toHaveBeenCalledTimes(2);
    unsubscribe();
  });

  it("should tell no one when there was nothing to take", () => {
    const listener = jest.fn();
    const unsubscribe = subscribeToNewTargets(listener);

    takeNewTargets();

    expect(listener).not.toHaveBeenCalled();
    unsubscribe();
  });

  it("should stop telling a subscriber once it unsubscribes", () => {
    const listener = jest.fn();
    subscribeToNewTargets(listener)();

    announceNewTargets();

    expect(listener).not.toHaveBeenCalled();
  });
});
