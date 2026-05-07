import { describe, expect, test } from "vitest";
import { render, screen } from "@testing-library/react";
import { FilterSectionTitle } from "./ProfileFilterSectionTitle";

describe("FilterSectionTitle", () => {
  test("renders optional helper text only when a hint is provided", () => {
    const { rerender } = render(<FilterSectionTitle title="Occasions" />);

    expect(screen.getByText("Occasions")).toBeInTheDocument();
    expect(screen.queryByText("Choose one or more")).not.toBeInTheDocument();

    rerender(
      <FilterSectionTitle title="Occasions" hint="Choose one or more" />,
    );

    expect(screen.getByText("Choose one or more")).toBeInTheDocument();
  });
});
