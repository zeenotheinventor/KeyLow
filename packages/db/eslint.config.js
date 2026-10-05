import base from "@keylow/config/eslint/base";

export default [...base, { ignores: ["node_modules/", "src/types.gen.ts"] }];
