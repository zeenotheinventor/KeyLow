import { ESLint } from "eslint";
import { describe, expect, it } from "vitest";

// Type-aware linting is slow on a loaded machine, so the 5s default leaves too little room.
const TYPE_AWARE_LINT_TIMEOUT_MILLISECONDS = 180_000;

const eslint = new ESLint({ cwd: new URL("../", import.meta.url).pathname });

// The imports are linted as if they stood in a source file of the package, so its own rules apply to them.
const restrictedImportsIn = async (packageName: string) => {
  const [result] = await eslint.lintText(`import "${packageName}";\n`, {
    filePath: new URL("../src/loadBodyModel.ts", import.meta.url).pathname,
  });
  return result?.messages.filter((message) => message.ruleId === "no-restricted-imports") ?? [];
};

describe("the imports the package source may not make", () => {
  it.each([
    "react",
    "react-dom",
    "react-native",
    "react-native-svg",
    "expo",
    "expo-gl",
    "next",
    "@react-three/fiber",
    "@react-three/fiber/native",
    "@expo/vector-icons",
    "@react-native/assets-registry",
    "@react-native-async-storage/async-storage",
  ])(
    "should forbid %s",
    async (packageName) => {
      expect(await restrictedImportsIn(packageName)).toHaveLength(1);
    },
    TYPE_AWARE_LINT_TIMEOUT_MILLISECONDS,
  );

  it(
    "should allow three, which every renderer shares",
    async () => {
      expect(await restrictedImportsIn("three")).toEqual([]);
    },
    TYPE_AWARE_LINT_TIMEOUT_MILLISECONDS,
  );
});
