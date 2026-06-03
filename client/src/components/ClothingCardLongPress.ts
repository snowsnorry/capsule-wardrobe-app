import type { PointerEvent } from "react";
import { useCallback, useEffect, useRef, useState } from "react";
import type {
  ClothingCardItem,
  ProductMenuPresentation,
} from "./ClothingCardTypes";

const LONG_PRESS_THRESHOLD_MS = 520;
const LONG_PRESS_MOVE_TOLERANCE_PX = 10;
const LONG_PRESS_CLICK_SUPPRESSION_MS = 750;

type ProductMenuOpenHandler = (
  anchor: HTMLElement,
  productUrl: string,
  item: ClothingCardItem,
  options: { presentation: ProductMenuPresentation },
) => void;

// The hook owns one gesture lifecycle so timers, pointer state, and click suppression stay synchronized.
// eslint-disable-next-line max-lines-per-function
function useMobileLongPressMenu({
  enabled,
  item,
  onOpen,
  productMenuKey,
}: {
  enabled: boolean;
  item: ClothingCardItem;
  onOpen?: ProductMenuOpenHandler;
  productMenuKey: string;
}) {
  const [isPressing, setIsPressing] = useState(false);
  const timerRef = useRef<number | null>(null);
  const pointerRef = useRef<{
    pointerId: number;
    startX: number;
    startY: number;
  } | null>(null);
  const suppressNextClickRef = useRef(false);
  const suppressClickTimerRef = useRef<number | null>(null);

  const clearPress = useCallback((resetState = true) => {
    if (timerRef.current !== null) {
      window.clearTimeout(timerRef.current);
      timerRef.current = null;
    }
    pointerRef.current = null;
    if (resetState) {
      setIsPressing(false);
    }
  }, []);

  const clearClickSuppression = useCallback(() => {
    if (suppressClickTimerRef.current !== null) {
      window.clearTimeout(suppressClickTimerRef.current);
      suppressClickTimerRef.current = null;
    }
    suppressNextClickRef.current = false;
  }, []);

  useEffect(
    () => () => {
      clearPress(false);
      clearClickSuppression();
    },
    [clearClickSuppression, clearPress],
  );

  useEffect(() => {
    if (!isPressing) {
      return undefined;
    }

    const cancelOnScroll = () => clearPress();
    window.addEventListener("scroll", cancelOnScroll, true);
    return () => window.removeEventListener("scroll", cancelOnScroll, true);
  }, [clearPress, isPressing]);

  const openMobileMenu = useCallback(
    (anchor: HTMLElement) => {
      if (!enabled || !productMenuKey || typeof onOpen !== "function") {
        return;
      }

      clearPress();
      navigator.vibrate?.(10);
      onOpen(anchor, productMenuKey, item, { presentation: "mobile-context" });
    },
    [clearPress, enabled, item, onOpen, productMenuKey],
  );

  const handlePointerDown = (event: PointerEvent<HTMLDivElement>) => {
    const pointerType = event.pointerType as string | undefined;
    const isTouchPointer =
      pointerType === "touch" ||
      ((!pointerType || pointerType === "") &&
        typeof window.PointerEvent === "undefined");
    if (!enabled || !isTouchPointer) {
      return;
    }

    const anchor = event.currentTarget;
    pointerRef.current = {
      pointerId: event.pointerId,
      startX: event.clientX,
      startY: event.clientY,
    };
    setIsPressing(true);
    timerRef.current = window.setTimeout(() => {
      suppressNextClickRef.current = true;
      suppressClickTimerRef.current = window.setTimeout(() => {
        suppressNextClickRef.current = false;
        suppressClickTimerRef.current = null;
      }, LONG_PRESS_CLICK_SUPPRESSION_MS);
      openMobileMenu(anchor);
    }, LONG_PRESS_THRESHOLD_MS);
  };

  const handlePointerMove = (event: PointerEvent<HTMLDivElement>) => {
    const pointer = pointerRef.current;
    if (!pointer || pointer.pointerId !== event.pointerId) {
      return;
    }

    const moved =
      Math.abs(event.clientX - pointer.startX) > LONG_PRESS_MOVE_TOLERANCE_PX ||
      Math.abs(event.clientY - pointer.startY) > LONG_PRESS_MOVE_TOLERANCE_PX;
    if (moved) {
      clearPress();
    }
  };

  const handlePointerEnd = (event: PointerEvent<HTMLDivElement>) => {
    const pointer = pointerRef.current;
    if (!pointer || pointer.pointerId === event.pointerId) {
      clearPress();
    }
  };

  const shouldSuppressClick = () => {
    if (!suppressNextClickRef.current) {
      return false;
    }

    clearClickSuppression();
    return true;
  };

  return {
    isPressing,
    openMobileMenu,
    pointerHandlers: enabled
      ? {
          onPointerCancel: handlePointerEnd,
          onPointerDown: handlePointerDown,
          onPointerLeave: handlePointerEnd,
          onPointerMove: handlePointerMove,
          onPointerUp: handlePointerEnd,
        }
      : {},
    shouldSuppressClick,
  };
}

export { useMobileLongPressMenu };
