import { WEIGH_IN_NOTE_MAX_CHARS } from "./bounds";
import { characterCount } from "../recipes/characterCount";

export type NoteResult =
  Readonly<{ ok: true; note: string | null }> | Readonly<{ ok: false; reason: "too-long" }>;

/**
 * Trims a note and turns a blank one into null, the way the column stores it. A note over 200
 * characters is refused with a reason code. Characters count as the database counts them.
 */
export function validateNote(text: string): NoteResult {
  const note = text.trim();

  if (note === "") {
    return { ok: true, note: null };
  }
  if (characterCount(note) > WEIGH_IN_NOTE_MAX_CHARS) {
    return { ok: false, reason: "too-long" };
  }
  return { ok: true, note };
}
