import { afterEach, describe, expect, test, vi } from "vitest";
import {
  cleanup,
  fireEvent,
  render,
  screen,
  waitFor,
} from "@testing-library/react";
import { AnchorImage } from "./ProfileFiltersAnchorImage";
import type { AnchorItem } from "./ProfileFiltersAnchorTypes";

vi.mock("../api/config", () => ({
  THUMBNAIL_ASSET_BASE_URL: "https://assets.example.test/thumbnails",
}));

const item: AnchorItem = {
  id: "item-1",
  wardrobeId: 1,
  url: "wardrobe://1",
  name: "Jacket",
  imageUrl: "https://assets.example.test/wardrobe/user/jacket.webp",
  category: "outerwear",
  isLiked: false,
  source: "uploaded",
};

describe("AnchorImage", () => {
  afterEach(() => {
    cleanup();
  });

  test("loads the smallest uploaded thumbnail before falling back to the original image", async () => {
    const { container } = render(
      <AnchorImage item={item} label="Jacket" large />,
    );

    expect(container.querySelector("img")).not.toBeInTheDocument();

    const image = await screen.findByRole("img", { name: "Jacket" });
    expect(image).toHaveAttribute(
      "src",
      "https://assets.example.test/wardrobe/user/jacket_320.webp",
    );
    expect(image).not.toHaveAttribute("srcset");

    fireEvent.error(image);

    await waitFor(() => {
      expect(screen.getByRole("img", { name: "Jacket" })).toHaveAttribute(
        "src",
        item.imageUrl,
      );
    });
  });
});
