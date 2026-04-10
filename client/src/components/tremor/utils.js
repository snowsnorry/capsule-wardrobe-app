import clsx from "clsx";
import { twMerge } from "tailwind-merge";
import { useEffect } from "react";

function cx(...args) {
  return twMerge(clsx(...args));
}

function useOnWindowResize(handler) {
  useEffect(() => {
    if (typeof window === "undefined" || typeof handler !== "function") {
      return undefined;
    }

    window.addEventListener("resize", handler);
    return () => window.removeEventListener("resize", handler);
  }, [handler]);
}

export { cx, useOnWindowResize };

