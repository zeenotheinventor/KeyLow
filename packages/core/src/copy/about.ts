import { DATA_SOURCE_ATTRIBUTION } from "../foods/attribution";

/**
 * The About screen, reached from More: where the app credits the data it shows. The credits are the
 * attribution each source's licence asks for, held once in `DATA_SOURCE_ATTRIBUTION`, and each has the
 * name of its source, the statement and the address it links to.
 */
export const ABOUT_SCREEN = {
  title: "About",
  back: "Back",
  dataSources: {
    title: "Data sources",
    cofid: DATA_SOURCE_ATTRIBUTION.cofid,
    off: DATA_SOURCE_ATTRIBUTION.off,
  },
};
