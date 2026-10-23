type QueryParam = string | string[] | undefined;

/**
 * Reads the id of the recipe editor's scan request from a route's query parameters. A route with one is in
 * ingredient mode: what it finds goes back to the editor and not to the diary. The id means nothing until
 * the hand-back store says it is the pending one, so a link someone made up reads as a request here and
 * is ignored there.
 */
export function readIngredientRequestId(param: QueryParam): string | undefined {
  const requestId = Array.isArray(param) ? param[0] : param;

  return requestId === undefined || requestId === "" ? undefined : requestId;
}

/** A path with the scan request as its `ingredient` parameter, after any extra parameters, so the next screen is in the same mode. */
export function withIngredientRequest(
  path: string,
  requestId: string,
  extra: Record<string, string> = {},
): string {
  const query = Object.entries({ ...extra, ingredient: requestId })
    .map(([name, value]) => `${name}=${encodeURIComponent(value)}`)
    .join("&");

  return `${path}?${query}`;
}
