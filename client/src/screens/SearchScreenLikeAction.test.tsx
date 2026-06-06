import { beforeEach, describe, expect, test, vi } from "vitest";
import {
  cleanup,
  fireEvent,
  render,
  screen,
  waitFor,
} from "@testing-library/react";
import SearchScreen from "./SearchScreen";

const searchController = vi.hoisted(() => ({
  markResultLikeState: vi.fn(),
}));

vi.mock("@mui/material/useMediaQuery", () => ({
  default: () => false,
}));
vi.mock("../i18n/useI18n", () => ({
  useI18n: () => ({
    locale: "en",
    t: (key: string) => key,
  }),
}));
vi.mock("./searchScreen/useSearchScreenState", () => ({
  default: () => searchController,
}));
vi.mock("./searchScreen/SearchScreenDialogs", () => ({
  default: () => null,
}));
vi.mock("./searchScreen/SearchScreenLayout", () => ({
  SearchScreenDesktop: ({ onSetItemLike }) => (
    <button
      type="button"
      onClick={() =>
        void onSetItemLike?.(
          { id: "1", url: "https://example.com/1", isLiked: false },
          true,
        )?.catch(() => undefined)
      }
    >
      like from layout
    </button>
  ),
  SearchScreenMobile: () => <div>mobile</div>,
}));

describe("SearchScreen like action wiring", () => {
  beforeEach(() => {
    cleanup();
    vi.clearAllMocks();
  });

  test("optimistically patches results before delegating to the app handler", async () => {
    const onSetItemLike = vi.fn(async () => undefined);
    render(<SearchScreen onSetItemLike={onSetItemLike} />);

    fireEvent.click(screen.getByRole("button", { name: "like from layout" }));

    expect(searchController.markResultLikeState).toHaveBeenCalledWith(
      expect.objectContaining({ url: "https://example.com/1" }),
      true,
    );
    await waitFor(() => {
      expect(onSetItemLike).toHaveBeenCalledWith(
        expect.objectContaining({ url: "https://example.com/1" }),
        true,
      );
    });
  });

  test("rolls back optimistic search result state when the app handler fails", async () => {
    const onSetItemLike = vi.fn(async () => {
      throw new Error("network");
    });
    render(<SearchScreen onSetItemLike={onSetItemLike} />);

    fireEvent.click(screen.getByRole("button", { name: "like from layout" }));

    await waitFor(() => {
      expect(searchController.markResultLikeState).toHaveBeenLastCalledWith(
        expect.objectContaining({ url: "https://example.com/1" }),
        false,
      );
    });
  });
});
