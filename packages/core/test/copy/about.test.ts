import { describe, expect, it } from "vitest";

import { ABOUT_SCREEN } from "../../src/copy";
import { DATA_SOURCE_ATTRIBUTION } from "../../src/foods";

describe("the About screen copy", () => {
  it("should pin the title, the back control and the Data sources heading", () => {
    expect(ABOUT_SCREEN.title).toBe("About");
    expect(ABOUT_SCREEN.back).toBe("Back");
    expect(ABOUT_SCREEN.dataSources.title).toBe("Data sources");
  });

  it("should pin the Legal group and its two rows as the About board draws them", () => {
    expect(ABOUT_SCREEN.legal).toEqual({
      title: "Legal",
      privacy: "Privacy Policy",
      terms: "Terms",
    });
  });

  it("should carry the CoFID Open Government Licence statement and its source address", () => {
    expect(ABOUT_SCREEN.dataSources.cofid.text).toContain(
      "Contains public sector information licensed under the Open Government Licence v3.0.",
    );
    expect(ABOUT_SCREEN.dataSources.cofid.url).toBe(
      "https://www.gov.uk/government/publications/composition-of-foods-integrated-dataset-cofid",
    );
  });

  it("should carry the Open Food Facts Open Database Licence credit and its address", () => {
    expect(ABOUT_SCREEN.dataSources.off.text).toBe(
      "Data from Open Food Facts, available under the Open Database Licence.",
    );
    expect(ABOUT_SCREEN.dataSources.off.url).toBe("https://world.openfoodfacts.org");
  });

  it("should carry the USDA FoodData Central public domain credit and its address", () => {
    expect(ABOUT_SCREEN.dataSources.usda.name).toBe("USDA FoodData Central");
    expect(ABOUT_SCREEN.dataSources.usda.text).toContain("CC0 1.0");
    expect(ABOUT_SCREEN.dataSources.usda.url).toBe("https://fdc.nal.usda.gov");
  });

  it("should carry the BodyParts3D attribution line exactly, then one plain sentence, and its address", () => {
    expect(ABOUT_SCREEN.dataSources.bodyParts3d.name).toBe("BodyParts3D");
    expect(ABOUT_SCREEN.dataSources.bodyParts3d.text).toBe(
      "BodyParts3D - The Database Center for Life Science - CC-BY-SA 2.1 Japan. Ki-Lo's 3D body is adapted from BodyParts3D and shared under CC BY-SA 4.0 (https://creativecommons.org/licenses/by-sa/4.0/).",
    );
    expect(ABOUT_SCREEN.dataSources.bodyParts3d.url).toBe("https://lifesciencedb.jp/bp3d/");
  });

  it("should carry the Z-Anatomy attribution line exactly, then one plain sentence, and its address", () => {
    expect(ABOUT_SCREEN.dataSources.zAnatomy.name).toBe("Z-Anatomy");
    expect(ABOUT_SCREEN.dataSources.zAnatomy.text).toBe(
      "Z-Anatomy - The libre 3D atlas of anatomy - CC-BY-SA 4.0. Ki-Lo's 3D body is adapted from Z-Anatomy and shared under CC BY-SA 4.0 (https://creativecommons.org/licenses/by-sa/4.0/).",
    );
    expect(ABOUT_SCREEN.dataSources.zAnatomy.url).toBe(
      "https://github.com/Z-Anatomy/Models-of-human-anatomy",
    );
  });

  it("should reuse the attribution the food detail credit used, not a copy of it", () => {
    expect(ABOUT_SCREEN.dataSources.cofid).toBe(DATA_SOURCE_ATTRIBUTION.cofid);
    expect(ABOUT_SCREEN.dataSources.off).toBe(DATA_SOURCE_ATTRIBUTION.off);
    expect(ABOUT_SCREEN.dataSources.usda).toBe(DATA_SOURCE_ATTRIBUTION.usda);
  });
});
