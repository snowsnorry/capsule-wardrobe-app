import { afterEach, describe, expect, test, vi } from "vitest";
import { cleanup, render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { ThemeProvider, createTheme } from "@mui/material/styles";
import { AnchorSelectedRows } from "./ProfileFiltersAnchorSelectedRows";

vi.mock("../i18n", async (importOriginal) => ({
  ...(await importOriginal<typeof import("../i18n")>()),
  translateOption: (_group: string, value: string) =>
    value === "coat" ? "Coat" : value,
}));

const theme = createTheme();

function t(key: string, params?: Record<string, unknown>) {
  if (key === "capsule.anchors.edit") return "Edit anchors";
  if (key === "capsule.anchors.remove") return `Remove ${params?.name}`;
  if (key === "capsule.anchors.unnamed") return `Unnamed ${params?.id}`;
  return key;
}

describe("AnchorSelectedRows", () => {
  afterEach(() => {
    cleanup();
  });

  test("renders selected rows and forwards edit and remove actions", async () => {
    const user = userEvent.setup();
    const onChange = vi.fn();
    const onEdit = vi.fn();
    const itemById = new Map([
      [
        "uploaded\u0000wardrobe://7",
        {
          id: "uploaded\u0000wardrobe://7",
          wardrobeId: 7,
          url: "wardrobe://7",
          name: "Wool coat",
          imageUrl: null,
          category: "coat",
          isLiked: false,
          source: "uploaded" as const,
        },
      ],
    ]);

    render(
      <ThemeProvider theme={theme}>
        <AnchorSelectedRows
          canEdit
          itemById={itemById}
          locale="en"
          onChange={onChange}
          onEdit={onEdit}
          selectedIds={[
            "uploaded\u0000wardrobe://7",
            "from_catalog\u0000https://example.com/item",
          ]}
          t={t}
        />
      </ThemeProvider>,
    );

    expect(screen.getByText("Wool coat")).toBeInTheDocument();
    expect(screen.getByText("Coat")).toBeInTheDocument();
    expect(
      screen.getByText("Unnamed from_catalog\u0000https://example.com/item"),
    ).toBeInTheDocument();

    await user.click(screen.getByRole("button", { name: "Edit anchors" }));
    await user.click(screen.getByRole("button", { name: "Remove Wool coat" }));

    expect(onEdit).toHaveBeenCalledTimes(1);
    expect(onChange).toHaveBeenCalledWith([
      "from_catalog\u0000https://example.com/item",
    ]);
  });
});
