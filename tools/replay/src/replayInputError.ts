/**
 * A problem with what the person running the tool passed in: an option, a fixture name, a file. The message
 * says what is wrong and names the field or option. It never holds a value from the file, because the file
 * is a health history.
 */
export class ReplayInputError extends Error {
  override readonly name = "ReplayInputError";
}
