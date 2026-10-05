import react from "@keylow/config/eslint/react";
import nextPlugin from "@next/eslint-plugin-next";

export default [
  ...react,
  nextPlugin.configs["core-web-vitals"],
  { ignores: ["node_modules/", ".next/", "next-env.d.ts"] },
];
