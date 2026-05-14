import { afterEach, beforeEach, describe, expect, test, vi } from "vitest";
import { cleanup, render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { ThemeProvider, createTheme } from "@mui/material/styles";
import MyWardrobeScreen from "./MyWardrobeScreen";

const api = vi.hoisted(() => ({
  fetchMyWardrobeItems: vi.fn(),
}));
const useI18nMock = vi.hoisted(() => vi.fn());

vi.mock("../api/myWardrobe", () => api);
vi.mock("../i18n/useI18n", () => ({
  useI18n: useI18nMock,
}));
vi.mock("@mui/material/useMediaQuery", () => ({
  default: () => false,
}));
vi.mock("../components/ClothingCard", () => ({
  default: ({ item, showProductMenu }) => (
    <div
      data-testid={`wardrobe-card-${item.id}`}
      data-show-product-menu={String(showProductMenu)}
    >
      {item.name}
    </div>
  ),
}));
vi.mock("../components/ClothingGridPlaceholder", () => ({
  default: ({ count }) => <div data-testid="wardrobe-placeholder">{count}</div>,
  buildClothingGridTemplateColumns: () => "repeat(2, minmax(0, 1fr))",
  buildClothingGridGap: () => 2,
}));

const theme = createTheme();
const translations: Record<string, string> = {
  "myWardrobe.title": "My Wardrobe",
  "myWardrobe.subtitle":
    "Saved catalog pieces and uploaded items in one place.",
  "myWardrobe.upload": "Upload item photo",
  "myWardrobe.filterLabel": "My Wardrobe source",
  "myWardrobe.loadFailed": "Failed to load My Wardrobe.",
  "myWardrobe.emptyTitle": "No saved items yet",
  "myWardrobe.emptyBody":
    "Save products from a capsule or upload item photos later.",
  "myWardrobe.filters.all": "All",
  "myWardrobe.filters.uploaded": "Uploaded",
  "myWardrobe.filters.fromCatalog": "From Catalog",
};

function renderScreen() {
  return render(
    <ThemeProvider theme={theme}>
      <MyWardrobeScreen />
    </ThemeProvider>,
  );
}

describe("MyWardrobeScreen", () => {
  beforeEach(() => {
    api.fetchMyWardrobeItems.mockReset();
    api.fetchMyWardrobeItems.mockResolvedValue({
      items: [
        {
          id: "wardrobe-1",
          name: "Linen Shirt",
          url: "https://example.com/1",
          image_url: "https://example.com/1.jpg",
        },
      ],
    });
    useI18nMock.mockReturnValue({
      t: (key: string) => translations[key] || key,
    });
  });

  afterEach(cleanup);

  test("renders toolbar, upload button, filters, and wardrobe cards", async () => {
    renderScreen();

    expect(
      screen.getByRole("button", { name: "Upload item photo" }),
    ).toBeInTheDocument();
    expect(
      screen.getByRole("group", { name: "My Wardrobe source" }),
    ).toBeInTheDocument();
    expect(screen.getByTestId("wardrobe-placeholder")).toBeInTheDocument();

    expect(
      await screen.findByTestId("wardrobe-card-wardrobe-1"),
    ).toHaveTextContent("Linen Shirt");
    expect(screen.getByTestId("wardrobe-card-wardrobe-1")).toHaveAttribute(
      "data-show-product-menu",
      "false",
    );
    expect(api.fetchMyWardrobeItems).toHaveBeenCalledWith({ source: null });
  });

  test("reloads when source filter changes", async () => {
    const user = userEvent.setup();
    renderScreen();

    await screen.findByTestId("wardrobe-card-wardrobe-1");
    await user.click(screen.getByRole("button", { name: "Uploaded" }));

    await waitFor(() => {
      expect(api.fetchMyWardrobeItems).toHaveBeenLastCalledWith({
        source: "uploaded",
      });
    });
  });

  test("renders empty and error states", async () => {
    api.fetchMyWardrobeItems.mockResolvedValueOnce({ items: [] });
    renderScreen();

    expect(await screen.findByText("No saved items yet")).toBeInTheDocument();

    cleanup();
    api.fetchMyWardrobeItems.mockRejectedValueOnce(new Error("down"));
    renderScreen();

    expect(
      await screen.findByText("Failed to load My Wardrobe."),
    ).toBeInTheDocument();
  });
});
