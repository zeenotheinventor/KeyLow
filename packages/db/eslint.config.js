import base from "@keylow/config/eslint/base";

// Edge Functions are Deno code, checked by `check:functions` and invisible to the Node toolchain.
export default [
  ...base,
  { ignores: ["node_modules/", "src/types.gen.ts", "supabase/functions/**"] },
];
