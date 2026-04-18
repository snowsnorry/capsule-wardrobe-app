import clsx from "clsx";
import type { ClassValue } from "clsx";
import { twMerge } from "tailwind-merge";
import { useEffect } from "react";

function cx(...args: ClassValue[]) {
  return twMerge(clsx(...args));
}

function useOnWindowResize(handler?: (() => void) | null) {
  useEffect(() => {
    if (typeof window === "undefined" || typeof handler !== "function") {
      return undefined;
    }

    window.addEventListener("resize", handler);
    return () => window.removeEventListener("resize", handler);
  }, [handler]);
}

export { cx, useOnWindowResize };
