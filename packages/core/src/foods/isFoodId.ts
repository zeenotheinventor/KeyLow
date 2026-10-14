import { foodRowSchema } from "../schemas/food";

/** Whether `value` has the shape of a food id. Seed ids are not RFC 4122 uuids, so this is a guid check. */
export const isFoodId = (value: string): boolean => foodRowSchema.shape.id.safeParse(value).success;
