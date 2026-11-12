/**
 * The region of a browser language tag, such as GB for en-GB, or undefined when the tag has none or is not a
 * tag. It stands in for the phone's `getLocales`, and decides the units the body step starts in.
 */
export function regionOfLanguage(language: string | undefined): string | undefined {
  if (language === undefined) {
    return undefined;
  }
  try {
    return new Intl.Locale(language).region;
  } catch {
    return undefined;
  }
}
