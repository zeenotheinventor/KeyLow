// The recipe import tool fetches only a URL the user wrote in their own message (ADR 0006), so a link
// found inside fetched content can never be followed. The match is exact and case sensitive.

const trailingPunctuation = /[.,;:!?)\]}>'"]+$/;
const leadingPunctuation = /^[(\[{<'"]+/;

export function urlInUserMessage(url: string, text: string): boolean {
  if (url === "") {
    return false;
  }
  return text.split(/\s+/).some((word) => {
    const withoutLeading = word.replace(leadingPunctuation, "");
    return withoutLeading === url || withoutLeading.replace(trailingPunctuation, "") === url;
  });
}
