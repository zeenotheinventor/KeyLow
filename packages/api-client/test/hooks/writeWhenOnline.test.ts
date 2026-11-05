import { onlineManager } from "@tanstack/react-query";
import { afterEach, describe, expect, it, vi } from "vitest";

import { writeWhenOnline } from "../../src/hooks/writeWhenOnline";

describe("writeWhenOnline", () => {
  afterEach(() => {
    onlineManager.setOnline(true);
  });

  it("should run the write, and say nothing, when there is a connection", async () => {
    const write = vi.fn().mockResolvedValue(undefined);
    const onFailed = vi.fn();

    await writeWhenOnline(write, onFailed);

    expect(write).toHaveBeenCalledTimes(1);
    expect(onFailed).not.toHaveBeenCalled();
  });

  it("should not run the write, and say it failed once, when there is no connection", async () => {
    onlineManager.setOnline(false);
    const write = vi.fn().mockResolvedValue(undefined);
    const onFailed = vi.fn();

    await writeWhenOnline(write, onFailed);

    expect(write).not.toHaveBeenCalled();
    expect(onFailed).toHaveBeenCalledTimes(1);
  });

  it("should say it failed once, and not pass the error on, when the write throws", async () => {
    const write = vi.fn().mockRejectedValue(new Error("a routine called Upper Lower"));
    const onFailed = vi.fn();

    await writeWhenOnline(write, onFailed);

    expect(onFailed).toHaveBeenCalledTimes(1);
    expect(onFailed).toHaveBeenCalledWith();
  });
});
