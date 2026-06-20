import { afterEach, describe, expect, test, vi } from "vitest";
import type { ComponentProps } from "react";
import { cleanup, render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { ThemeProvider, createTheme } from "@mui/material/styles";
import WardrobeToolbar from "./WardrobeToolbar";

const theme = createTheme();

const labels: Record<string, string> = {
  "wardrobe.analyzePersonalItems": "Analyze",
  "wardrobe.filterLabel": "Personal item source",
  "wardrobe.filters.all": "All",
  "wardrobe.filters.fromCatalog": "Catalog",
  "wardrobe.filters.likedOnly": "Liked only",
  "wardrobe.filters.uploaded": "Uploaded",
  "wardrobe.openMenu": "Open Personal items menu",
  "wardrobe.uploadMenu": "Choose upload method",
  "wardrobe.uploadMenuLabel": "Upload methods",
  "wardrobe.uploadPhoto": "Upload photo",
  "wardrobe.uploadUrl": "Upload URL",
};

const t = (key: string) => labels[key] || key;

function renderToolbar(
  overrides: Partial<ComponentProps<typeof WardrobeToolbar>> = {},
) {
  return render(
    <ThemeProvider theme={theme}>
      <WardrobeToolbar
        canAnalyze
        filter="all"
        hasReport={false}
        isLoading={false}
        isMobile={false}
        likedOnly={false}
        t={t}
        onAnalyze={vi.fn()}
        onFilterChange={vi.fn()}
        onLikedOnlyChange={vi.fn()}
        onOpenMenu={vi.fn()}
        onOpenUpload={vi.fn()}
        onOpenUrlUpload={vi.fn()}
        {...overrides}
      />
    </ThemeProvider>,
  );
}

afterEach(cleanup);

describe("WardrobeToolbar", () => {
  test("shows desktop Analyze only before a report exists", async () => {
    const onAnalyze = vi.fn();
    const user = userEvent.setup();
    const { rerender } = renderToolbar({ onAnalyze });

    await user.click(screen.getByRole("button", { name: "Analyze" }));
    expect(onAnalyze).toHaveBeenCalledTimes(1);

    rerender(
      <ThemeProvider theme={theme}>
        <WardrobeToolbar
          canAnalyze
          filter="all"
          hasReport
          isLoading={false}
          isMobile={false}
          likedOnly={false}
          t={t}
          onAnalyze={onAnalyze}
          onFilterChange={vi.fn()}
          onLikedOnlyChange={vi.fn()}
          onOpenMenu={vi.fn()}
          onOpenUpload={vi.fn()}
          onOpenUrlUpload={vi.fn()}
        />
      </ThemeProvider>,
    );
    expect(screen.queryByRole("button", { name: "Analyze" })).toBeNull();
  });

  test("disables Analyze when no personal items are available", () => {
    renderToolbar({ canAnalyze: false });

    expect(screen.getByRole("button", { name: "Analyze" })).toBeDisabled();
  });
});
