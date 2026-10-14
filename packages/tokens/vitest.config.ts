import { defineConfig } from "vitest/config";

export default defineConfig({
  test: {
    include: ["test/**/*.test.ts"],
    // A Tailwind run takes 0.2s here but up to 3.4s on a loaded machine, so the 5s default leaves too little room.
    testTimeout: 15_000,
  },
});
