import { foodRowSchema } from "@keylow/core/schemas";

/** Whether `value` has the shape of a food id. Seed ids are not RFC 4122 uuids, so this is a guid check. */
export const isFoodId = (value: string) => foodRowSchema.shape.id.safeParse(value).success;
