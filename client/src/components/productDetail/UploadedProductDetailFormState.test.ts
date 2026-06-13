import { describe, expect, test } from "vitest";
import {
  buildFormState,
  buildPayload,
  getMissingRequiredFields,
} from "./UploadedProductDetailFormState";

const t = (key: string) =>
  ({
    "wardrobe.uploadedDetail.required.audience": "audience",
    "wardrobe.uploadedDetail.required.category": "category",
    "wardrobe.uploadedDetail.required.name": "name",
    "wardrobe.uploadedDetail.required.season": "at least one season",
  })[key] ?? key;

describe("UploadedProductDetailFormState", () => {
  test("normalizes text, aliases, and comma-separated option values from uploaded items", () => {
    const form = buildFormState({
      id: "uploaded-1",
      source: "uploaded",
      name: "  Updated shirt  ",
      description: "  Updated description  ",
      brand: "  Updated brand  ",
      audience: "men",
      category: "dress",
      season: "winter, summer",
      formalityLevel: "formal",
      style: ["sporty", "sporty"],
      occasions: ["date night"],
      colorBase: "light-blue, black",
      pattern: "stripe",
      finish: "matte",
      composition: "linen, wool",
      silhouette: "straight",
      fit: "slim",
      closureType: "zipper",
    });

    expect(form).toMatchObject({
      audience: "man",
      brand: "Updated brand",
      category: "dress",
      composition: "linen, wool",
      compositionValues: ["linen", "wool"],
      description: "Updated description",
      finish: "matte",
      fit: "slim",
      name: "Updated shirt",
      pattern: "stripe",
      silhouette: "straight",
    });
    expect(form.season).toEqual(["winter", "summer"]);
    expect(form.formalityLevel).toEqual(["formal"]);
    expect(form.style).toEqual(["sporty"]);
    expect(form.occasions).toEqual(["date_night"]);
    expect(form.colorBase).toEqual(["light_blue", "black"]);
    expect(form.closureType).toEqual(["zipper"]);
  });

  test("builds the trimmed API payload and derives composition from selected material values", () => {
    const payload = buildPayload({
      name: "  Updated shirt  ",
      description: "  Updated description  ",
      brand: "  Updated brand  ",
      audience: "man",
      category: "dress",
      season: ["winter"],
      formalityLevel: ["formal"],
      style: ["sporty"],
      occasions: ["date_night"],
      colorBase: ["black"],
      pattern: "stripe",
      finish: "matte",
      composition: "stale display value",
      compositionValues: ["linen", "wool"],
      silhouette: "straight",
      fit: "slim",
      closureType: ["zipper"],
    });

    expect(payload).toEqual({
      audience: "man",
      brand: "Updated brand",
      category: "dress",
      closureType: ["zipper"],
      colorBase: ["black"],
      composition: "linen, wool",
      description: "Updated description",
      finish: "matte",
      fit: "slim",
      formalityLevel: ["formal"],
      name: "Updated shirt",
      occasions: ["date_night"],
      pattern: "stripe",
      season: ["winter"],
      silhouette: "straight",
      style: ["sporty"],
    });
  });

  test("reports missing required fields from normalized form state", () => {
    expect(
      getMissingRequiredFields(
        {
          ...buildFormState(null),
          name: " ",
          audience: "",
          category: "",
          season: [],
        },
        t,
      ),
    ).toEqual(["name", "audience", "category", "at least one season"]);
  });
});
