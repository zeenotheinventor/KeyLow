import { onlineManager } from "@tanstack/react-query";
import { act } from "@testing-library/react-native";

import { writeWhenOnline } from "../lib/writeWhenOnline";

describe("writeWhenOnline", () => {
  afterEach(async () => {
    await act(() => {
      onlineManager.setOnline(true);
    });
  });

  it("should run the write, and say nothing, when there is a connection", async () => {
    const write = jest.fn().mockResolvedValue(undefined);
    const onFailed = jest.fn();

    await writeWhenOnline(write, onFailed);

    expect(write).toHaveBeenCalledTimes(1);
    expect(onFailed).not.toHaveBeenCalled();
  });

  it("should not run the write, and say it failed once, when there is no connection", async () => {
    await act(() => {
      onlineManager.setOnline(false);
    });
    const write = jest.fn().mockResolvedValue(undefined);
    const onFailed = jest.fn();

    await writeWhenOnline(write, onFailed);

    expect(write).not.toHaveBeenCalled();
    expect(onFailed).toHaveBeenCalledTimes(1);
  });

  it("should say it failed once, and not pass the error on, when the write throws", async () => {
    const write = jest.fn().mockRejectedValue(new Error("a routine called Upper Lower"));
    const onFailed = jest.fn();

    await writeWhenOnline(write, onFailed);

    expect(onFailed).toHaveBeenCalledTimes(1);
    expect(onFailed).toHaveBeenCalledWith();
  });
});
