import { DATA_SOURCE_ATTRIBUTION } from "../foods/attribution";

// The 3D body is adapted from both models and shared under CC BY-SA 4.0, so each credit is the licence's
// attribution line, kept word for word, then one plain sentence saying so. The sentence ends with the
// licence address as plain text, because the licence asks an adaptation to point at it.
const BODY_MODEL_LICENCE_URL = "https://creativecommons.org/licenses/by-sa/4.0/";

const BODY_MODEL_SOURCES = {
  bodyParts3d: {
    name: "BodyParts3D",
    text: `BodyParts3D - The Database Center for Life Science - CC-BY-SA 2.1 Japan. Ki-Lo's 3D body is adapted from BodyParts3D and shared under CC BY-SA 4.0 (${BODY_MODEL_LICENCE_URL}).`,
    url: "https://lifesciencedb.jp/bp3d/",
  },
  zAnatomy: {
    name: "Z-Anatomy",
    text: `Z-Anatomy - The libre 3D atlas of anatomy - CC-BY-SA 4.0. Ki-Lo's 3D body is adapted from Z-Anatomy and shared under CC BY-SA 4.0 (${BODY_MODEL_LICENCE_URL}).`,
    url: "https://github.com/Z-Anatomy/Models-of-human-anatomy",
  },
};

/**
 * The About screen, reached from More: where the app credits the data and the 3D body model it shows,
 * and where it links to the Privacy Policy and the Terms. The credits are the attribution each source's
 * licence asks for. The food credits are held once in `DATA_SOURCE_ATTRIBUTION`. Each credit has the
 * name of its source, the statement and the address it links to.
 */
export const ABOUT_SCREEN = {
  title: "About",
  back: "Back",
  dataSources: {
    title: "Data sources",
    cofid: DATA_SOURCE_ATTRIBUTION.cofid,
    usda: DATA_SOURCE_ATTRIBUTION.usda,
    off: DATA_SOURCE_ATTRIBUTION.off,
    ...BODY_MODEL_SOURCES,
  },
  legal: {
    title: "Legal",
    privacy: "Privacy Policy",
    terms: "Terms",
  },
};
