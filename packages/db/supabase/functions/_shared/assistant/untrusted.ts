// Every tool result reaches the model inside <untrusted_data>, and the system prompt says content in
// it is never an instruction. Food names from Open Food Facts and the user's own text are content, so
// a result may hold a sentence that reads like an order, and the wrapper is what marks it as data.
// This is also the last place a result is minimised (ADR 0006, rule b): a fixed list of keys is removed
// at any depth before wrapping. The tools select named columns and never `*`, so this is the backstop
// and not the first defence.

export type JsonValue =
  string | number | boolean | null | JsonValue[] | { [key: string]: JsonValue };

// Keys are compared in lower case with everything but letters and digits removed, so `user_id`,
// `userId`, `user-id` and `USER ID` are one key. The profile fields are the ones of `profiles` (sex,
// birth_date, height_cm) and the user's email.
const deniedKeys: ReadonlySet<string> = new Set([
  "userid",
  "ownerid",
  "email",
  "emailaddress",
  "sex",
  "age",
  "birthdate",
  "dateofbirth",
  "dob",
  "height",
  "heightcm",
]);

function isDeniedKey(key: string): boolean {
  return deniedKeys.has(key.toLowerCase().replace(/[^a-z0-9]/g, ""));
}

type Minimised = { value: JsonValue; removedAny: boolean };

function minimise(value: JsonValue): Minimised {
  if (Array.isArray(value)) {
    const items = value.map(minimise);
    return {
      value: items.map((item) => item.value),
      removedAny: items.some((item) => item.removedAny),
    };
  }
  if (typeof value === "object" && value !== null) {
    const kept: { [key: string]: JsonValue } = {};
    let removedAny = false;
    for (const [key, child] of Object.entries(value)) {
      if (isDeniedKey(key)) {
        removedAny = true;
        continue;
      }
      const minimised = minimise(child);
      kept[key] = minimised.value;
      removedAny ||= minimised.removedAny;
    }
    return { value: kept, removedAny };
  }
  return { value, removedAny: false };
}

// The source is written into an attribute, so anything but a plain tool name is replaced.
function safeSource(source: string): string {
  return /^[a-z][a-z0-9_]*$/.test(source) ? source : "unknown";
}

// `<` becomes the JSON escape <, so no closing tag, in any case or spacing, can appear in the
// payload, and the payload still parses as the same JSON.
function escapeForWrapper(json: string): string {
  return json.replaceAll("<", "\\u003c");
}

const removedMarker = "[removed]";

const uuidPattern = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

const escapeForRegularExpression = (text: string) => text.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");

// The user's id is removed by value, from any key and any string at any depth, because a tool can copy
// it into a field the deny-list does not know. Case does not matter, so a shouted copy goes too.
function scrubValue(json: string, value: string): { json: string; removedAny: boolean } {
  const pattern = new RegExp(escapeForRegularExpression(value), "gi");
  return pattern.test(json)
    ? { json: json.replace(pattern, removedMarker), removedAny: true }
    : { json, removedAny: false };
}

// `userId` is the caller's id, when the result must not carry it.
export function wrapUntrusted(source: string, payload: JsonValue, userId?: string): string {
  const name = safeSource(source);
  const minimised = minimise(payload);
  if (minimised.removedAny) {
    // The tool name and a code, never the key's value.
    console.warn(`assistant ${name} denied_key_removed`);
  }
  let json = JSON.stringify(minimised.value);
  if (userId !== undefined && userId !== "") {
    if (!uuidPattern.test(userId)) {
      // A short id would match inside numbers and break the JSON, so it is not scrubbed at all.
      console.warn(`assistant ${name} user_id_not_uuid`);
    } else {
      const scrubbed = scrubValue(json, userId);
      json = scrubbed.json;
      if (scrubbed.removedAny) {
        console.warn(`assistant ${name} user_id_value_removed`);
      }
    }
  }
  return `<untrusted_data source="${name}">${escapeForWrapper(json)}</untrusted_data>`;
}
