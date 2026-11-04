import { describe, expect, it } from "vitest";

import { accountExportReducer, initialAccountExportState } from "../../src/export";

import type { AccountExportState } from "../../src/export";

const preparing: AccountExportState = { status: "preparing" };
const ready: AccountExportState = { status: "ready", sizeBytes: 1_849_999 };
const saving: AccountExportState = { status: "saving", sizeBytes: 1_849_999 };
const saved: AccountExportState = {
  status: "saved",
  sizeBytes: 1_849_999,
  folderName: "Downloads",
};
const failedWhilePreparing: AccountExportState = { status: "failed", step: "preparing" };

describe("accountExportReducer", () => {
  it("should begin idle", () => {
    expect(initialAccountExportState).toEqual({ status: "idle" });
  });

  describe("the way through", () => {
    it("should start preparing when the export starts", () => {
      expect(accountExportReducer(initialAccountExportState, { type: "start" })).toEqual(preparing);
    });

    it("should be ready with the file's size once it is prepared", () => {
      expect(accountExportReducer(preparing, { type: "prepared", sizeBytes: 1_849_999 })).toEqual(
        ready,
      );
    });

    it("should be saving when Save file is pressed on a ready file", () => {
      expect(accountExportReducer(ready, { type: "save" })).toEqual(saving);
    });

    it("should be saved to the folder that was picked, keeping the size", () => {
      expect(accountExportReducer(saving, { type: "savedTo", folderName: "Downloads" })).toEqual(
        saved,
      );
    });
  });

  describe("a cancelled picker", () => {
    it("should go back to ready with the same size, and no failure", () => {
      expect(accountExportReducer(saving, { type: "pickerCancelled" })).toEqual(ready);
    });

    it("should let the person save again afterwards", () => {
      const cancelled = accountExportReducer(saving, { type: "pickerCancelled" });

      expect(accountExportReducer(cancelled, { type: "save" })).toEqual(saving);
    });
  });

  describe("a failure", () => {
    it("should fail while preparing", () => {
      expect(accountExportReducer(preparing, { type: "failedWhile", step: "preparing" })).toEqual(
        failedWhilePreparing,
      );
    });

    it("should fail while saving", () => {
      expect(accountExportReducer(saving, { type: "failedWhile", step: "saving" })).toEqual({
        status: "failed",
        step: "saving",
      });
    });

    it("should prepare again on Try again, whichever step failed", () => {
      expect(accountExportReducer(failedWhilePreparing, { type: "retry" })).toEqual(preparing);
      expect(accountExportReducer({ status: "failed", step: "saving" }, { type: "retry" })).toEqual(
        preparing,
      );
    });
  });

  describe("leaving the screen", () => {
    it.each([
      ["preparing", preparing],
      ["ready", ready],
      ["saving", saving],
      ["saved", saved],
      ["failed", failedWhilePreparing],
    ])("should forget everything and be idle again from %s", (_name, state) => {
      expect(accountExportReducer(state, { type: "reset" })).toEqual(initialAccountExportState);
    });

    it("should be able to start again after a reset", () => {
      const reset = accountExportReducer(ready, { type: "reset" });

      expect(accountExportReducer(reset, { type: "start" })).toEqual(preparing);
    });
  });

  describe("events that do not belong to the state", () => {
    it("should not start again once the export is under way or done", () => {
      for (const state of [preparing, ready, saving, saved, failedWhilePreparing]) {
        expect(accountExportReducer(state, { type: "start" })).toBe(state);
      }
    });

    it("should not save before the file is ready, or twice", () => {
      for (const state of [initialAccountExportState, preparing, saving, saved]) {
        expect(accountExportReducer(state, { type: "save" })).toBe(state);
      }
    });

    it("should ignore a late result once the screen has moved on", () => {
      expect(accountExportReducer(ready, { type: "prepared", sizeBytes: 5 })).toBe(ready);
      expect(accountExportReducer(ready, { type: "savedTo", folderName: "Downloads" })).toBe(ready);
      expect(accountExportReducer(ready, { type: "pickerCancelled" })).toBe(ready);
      expect(accountExportReducer(saved, { type: "failedWhile", step: "saving" })).toBe(saved);
      expect(accountExportReducer(ready, { type: "failedWhile", step: "preparing" })).toBe(ready);
    });

    it("should only retry from failed", () => {
      for (const state of [initialAccountExportState, preparing, ready, saving, saved]) {
        expect(accountExportReducer(state, { type: "retry" })).toBe(state);
      }
    });
  });
});
