import { describe, expect, it, vi } from "vitest";

import { blenderCommand, findBlenderExecutable, runBlender } from "../src/runBlender.ts";

describe("findBlenderExecutable", () => {
  it("prefers the BLENDER environment variable", () => {
    expect(findBlenderExecutable({ BLENDER: "/custom/blender" }, () => true)).toBe(
      "/custom/blender",
    );
  });

  it("falls back to the Homebrew install when it exists", () => {
    expect(findBlenderExecutable({}, (path) => path === "/opt/homebrew/bin/blender")).toBe(
      "/opt/homebrew/bin/blender",
    );
  });

  it("falls back to blender on the path when nothing else is found", () => {
    expect(findBlenderExecutable({}, () => false)).toBe("blender");
  });
});

describe("blenderCommand", () => {
  it("runs the named script headless from a factory start with the arguments after a double dash", () => {
    const command = blenderCommand("/usr/bin/blender", "inspect_bundle", [
      "--source",
      "/data/bundle",
    ]);

    expect(command.executable).toBe("/usr/bin/blender");
    expect(command.args).toEqual([
      "--background",
      "--factory-startup",
      "--disable-autoexec",
      "--python",
      expect.stringMatching(/tools\/body-model\/blender\/inspect_bundle\.py$/),
      "--",
      "--source",
      "/data/bundle",
    ]);
  });
});

describe("runBlender", () => {
  it("returns 127 and says so when Blender cannot be found", () => {
    const original = process.env.BLENDER;
    process.env.BLENDER = "/nonexistent/blender";
    const messages: unknown[] = [];
    const errorSpy = vi
      .spyOn(console, "error")
      .mockImplementation((message) => messages.push(message));

    try {
      expect(runBlender("inspect_bundle", [])).toBe(127);
      expect(messages).toEqual(["Blender not found. Set BLENDER or install it."]);
    } finally {
      errorSpy.mockRestore();
      if (original === undefined) {
        delete process.env.BLENDER;
      } else {
        process.env.BLENDER = original;
      }
    }
  });
});
