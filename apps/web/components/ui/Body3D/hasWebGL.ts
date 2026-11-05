/**
 * Whether this browser can start a WebGL context at all. It is asked before the drawing code and the 2.6 MB model are
 * fetched, so a browser that cannot draw the body downloads neither. The context it makes is given back at once.
 */
export function hasWebGL(): boolean {
  if (typeof document === "undefined") {
    return false;
  }
  const canvas = document.createElement("canvas");
  const context = canvas.getContext("webgl2") ?? canvas.getContext("webgl");
  if (context === null) {
    return false;
  }
  context.getExtension("WEBGL_lose_context")?.loseContext();
  return true;
}
