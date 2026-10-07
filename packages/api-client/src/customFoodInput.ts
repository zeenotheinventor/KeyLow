import { customFoodInputSchema } from "@keylow/core/schemas";

import type { CustomFoodInput } from "@keylow/core/schemas";

type CustomFoodInputError = Extract<
  ReturnType<typeof customFoodInputSchema.safeParse>,
  { success: false }
>["error"];

/** Thrown before any network call when the form input does not satisfy the core schema. */
export class CustomFoodValidationError extends Error {
  readonly issues: CustomFoodInputError["issues"];

  constructor(cause: CustomFoodInputError) {
    const summary = cause.issues
      .map((issue) => `${issue.path.join(".") || "input"}: ${issue.message}`)
      .join(", ");

    super(`Invalid custom food: ${summary}`, { cause });
    this.name = "CustomFoodValidationError";
    this.issues = cause.issues;
  }
}

export function parseCustomFoodInput(input: unknown): CustomFoodInput {
  const result = customFoodInputSchema.safeParse(input);

  if (!result.success) {
    throw new CustomFoodValidationError(result.error);
  }

  return result.data;
}
