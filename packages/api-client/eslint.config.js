import hermes from "@keylow/config/eslint/hermes";
import react from "@keylow/config/eslint/react";

export default [...react, ...hermes, { ignores: ["node_modules/"] }];
