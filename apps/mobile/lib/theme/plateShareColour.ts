// The board draws the plate's share of a bar in the nutrient colour at 45 per cent over the track.
const plateShareOpacity = 0.45;

const hexColourPattern = /^#[0-9a-fA-F]{6}$/;

const channelAt = (hexColour: string, start: number): number =>
  parseInt(hexColour.slice(start, start + 2), 16);

/** A `#RRGGBB` token colour at the plate share's opacity: `rgba(79, 209, 197, 0.45)`. */
export function plateShareColour(hexColour: string): string {
  if (!hexColourPattern.test(hexColour)) {
    throw new RangeError(`Expected a #RRGGBB colour, got "${hexColour}"`);
  }
  const [red, green, blue] = [1, 3, 5].map((start) => channelAt(hexColour, start));

  return `rgba(${red}, ${green}, ${blue}, ${plateShareOpacity})`;
}
