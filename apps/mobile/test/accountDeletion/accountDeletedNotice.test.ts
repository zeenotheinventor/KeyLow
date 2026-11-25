import {
  announceAccountDeleted,
  hasAccountDeletedNotice,
  subscribeToAccountDeletedNotice,
  takeAccountDeletedNotice,
} from "../../lib/accountDeletion/accountDeletedNotice";

describe("the account deleted notice", () => {
  afterEach(() => {
    takeAccountDeletedNotice();
  });

  it("should be waiting once it is announced", () => {
    expect(hasAccountDeletedNotice()).toBe(false);

    announceAccountDeleted();

    expect(hasAccountDeletedNotice()).toBe(true);
  });

  it("should be taken once and then be gone", () => {
    announceAccountDeleted();

    expect(takeAccountDeletedNotice()).toBe(true);
    expect(takeAccountDeletedNotice()).toBe(false);
    expect(hasAccountDeletedNotice()).toBe(false);
  });

  it("should tell a listener when it is announced and when it is taken, and not once the listener stops", () => {
    const listener = jest.fn();
    const stop = subscribeToAccountDeletedNotice(listener);

    announceAccountDeleted();
    takeAccountDeletedNotice();
    expect(listener).toHaveBeenCalledTimes(2);

    stop();
    announceAccountDeleted();
    expect(listener).toHaveBeenCalledTimes(2);
  });

  it("should tell the listener once when it is announced twice", () => {
    const listener = jest.fn();
    const stop = subscribeToAccountDeletedNotice(listener);

    announceAccountDeleted();
    announceAccountDeleted();

    expect(listener).toHaveBeenCalledTimes(1);
    stop();
  });
});
