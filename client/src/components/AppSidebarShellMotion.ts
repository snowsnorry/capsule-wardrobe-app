import { useLayoutEffect, useRef, useState } from "react";

const naturalEase = "cubic-bezier(0.2, 0, 0, 1)";
const shellMotionTransition = `transform 240ms ${naturalEase}`;

function getPixelValue(value: string | 0): number {
  return value === 0 ? 0 : Number.parseFloat(value) || 0;
}

function useShellOffsetMotion({
  isOverlaySidebar,
  offset,
}: {
  isOverlaySidebar: boolean;
  offset: string | 0;
}) {
  const offsetPx = getPixelValue(offset);
  const previousOffsetPxRef = useRef(offsetPx);
  const [offsetDelta, setOffsetDelta] = useState(0);

  useLayoutEffect(() => {
    const previousOffsetPx = previousOffsetPxRef.current;
    previousOffsetPxRef.current = offsetPx;

    if (isOverlaySidebar || previousOffsetPx === offsetPx) {
      setOffsetDelta(0);
      return undefined;
    }

    setOffsetDelta(previousOffsetPx - offsetPx);
    const usesAnimationFrame =
      typeof window.requestAnimationFrame === "function";
    const animationFrame = usesAnimationFrame
      ? window.requestAnimationFrame(() => setOffsetDelta(0))
      : window.setTimeout(() => setOffsetDelta(0), 0);

    return () => {
      if (
        usesAnimationFrame &&
        typeof window.cancelAnimationFrame === "function"
      ) {
        window.cancelAnimationFrame(Number(animationFrame));
        return;
      }
      window.clearTimeout(Number(animationFrame));
    };
  }, [isOverlaySidebar, offsetPx]);

  return {
    transform: offsetDelta === 0 ? undefined : `translateX(${offsetDelta}px)`,
    transition:
      !isOverlaySidebar && offsetDelta === 0 ? shellMotionTransition : "none",
  } as const;
}

export { useShellOffsetMotion };
