import { z } from "zod";

/*
 * The contract of the `delete-account` Edge Function. It deletes its caller and nobody else, as a hard
 * delete through the auth admin API. The id comes from the verified token and never from the request, so
 * the request body is empty and a body that names any field is refused. The error codes the function
 * sends are in `edgeErrorCodeSchema`, beside every other function's. One is specific to it:
 * `reauthentication_required` (403), for an account that signs in with a password and has not done so in the
 * last 15 minutes, so nothing was deleted.
 */

/** Request body of the `delete-account` Edge Function: empty. A field, such as a user id, is refused. */
export const deleteAccountRequestSchema = z.object({}).strict();

/** Response body of the `delete-account` Edge Function: the caller's account is gone. */
export const deleteAccountResponseSchema = z.object({ deleted: z.literal(true) }).strict();

export type DeleteAccountRequest = z.infer<typeof deleteAccountRequestSchema>;
export type DeleteAccountResponse = z.infer<typeof deleteAccountResponseSchema>;
