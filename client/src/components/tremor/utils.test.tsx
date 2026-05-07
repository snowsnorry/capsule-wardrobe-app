import { afterEach, describe, expect, test, vi } from "vitest";
import { cleanup, render } from "@testing-library/react";
import { cx, useOnWindowResize } from "./utils";

function ResizeConsumer({ onResize }: { onResize?: (() => void) | null }) {
  useOnWindowResize(onResize);
  return <div>resize consumer</div>;
}

describe("tremor utils", () => {
  afterEach(() => {
    cleanup();
    vi.restoreAllMocks();
  });

  test("merges conditional classes with Tailwind conflict resolution", () => {
    const maybeHidden: string | false = false;
    expect(cx("px-2", maybeHidden, "px-4", ["text-sm"])).toBe("px-4 text-sm");
  });

  test("registers and removes window resize handlers", () => {
    const onResize = vi.fn();
    const addSpy = vi.spyOn(window, "addEventListener");
    const removeSpy = vi.spyOn(window, "removeEventListener");

    const { unmount } = render(<ResizeConsumer onResize={onResize} />);
    window.dispatchEvent(new Event("resize"));
    unmount();

    expect(onResize).toHaveBeenCalledTimes(1);
    expect(addSpy).toHaveBeenCalledWith("resize", onResize);
    expect(removeSpy).toHaveBeenCalledWith("resize", onResize);
  });

  test("ignores missing resize handlers", () => {
    const addSpy = vi.spyOn(window, "addEventListener");

    render(<ResizeConsumer onResize={null} />);

    expect(addSpy).not.toHaveBeenCalled();
  });
});
