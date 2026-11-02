import { describe, expect, it } from "vitest";

import { turnResult } from "./helpers.ts";
import { createStubDriver } from "../src/driver.ts";

describe("createStubDriver", () => {
  it("should answer each message with the next reply and record what was sent", async () => {
    const first = turnResult({ answer: "one" });
    const second = turnResult({ answer: "two" });
    const driver = createStubDriver([first, second]);

    const firstReply = await driver.sendMessage({ conversationId: null, text: "hello" });
    const secondReply = await driver.sendMessage({
      conversationId: "conversation-1",
      text: "again",
    });

    expect([firstReply, secondReply]).toEqual([first, second]);
    expect(driver.sent).toEqual([
      { conversationId: null, text: "hello" },
      { conversationId: "conversation-1", text: "again" },
    ]);
  });

  it("should fail with a clear message when it has no reply left", async () => {
    const driver = createStubDriver([]);

    await expect(driver.sendMessage({ conversationId: null, text: "hello" })).rejects.toThrow(
      "The stub driver has no reply left",
    );
  });
});
