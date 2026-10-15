import { z } from "zod";

const entryIdSchema = z.guid();

/** Whether `value` has the shape of a diary entry's id, such as the one in the entry screen's address. */
export const isEntryId = (value: string): boolean => entryIdSchema.safeParse(value).success;
