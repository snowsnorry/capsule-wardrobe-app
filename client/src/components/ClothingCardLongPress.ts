import type { PointerEvent } from "react";
import { useCallback, useEffect, useRef, useState } from "react";
import type {
  ClothingCardItem,
  MobileContextMenuOriginRect,
  ProductMenuOpenOptions,
} from "./ClothingCardTypes";

const LONG_PRESS_THRESHOLD_MS = 520;
const LONG_PRESS_MOVE_TOLERANCE_PX = 10;
const LONG_PRESS_CLICK_SUPPRESSION_MS = 750;

type ProductMenuOpenHandler = (
  anchor: HTMLElement,
  productUrl: string,
  item: ClothingCardItem,
  options: ProductMenuOpenOptions,
) => void;

type LongPressPointerState = {
  anchor: HTMLElement;
  menuOpened: boolean;
  originRect: MobileContextMenuOriginRect;
  pointerId: number;
  startX: number;
  startY: number;
};

function getElementOriginRect(
  element: HTMLElement,
): MobileContextMenuOriginRect {
  const rect = element.getBoundingClientRect();
  return {
    top: rect.top,
    left: rect.left,
    width: rect.width,
    height: rect.height,
  };
}

function trySetPointerCapture(element: HTMLElement, pointerId: number) {
  try {
    element.setPointerCapture?.(pointerId);
  } catch {
    // Some browser/test targets reject capture for synthetic or inactive pointers.
  }
}

function tryReleasePointerCapture(element: HTMLElement, pointerId: number) {
  try {
    if (!element.hasPointerCapture || element.hasPointerCapture(pointerId)) {
      element.releasePointerCapture?.(pointerId);
    }
  } catch {
    // Capture may already be released when the browser ends the touch sequence.
  }
}

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
  const pointerRef = useRef<LongPressPointerState | null>(null);
  const suppressNextClickRef = useRef(false);
  const suppressClickTimerRef = useRef<number | null>(null);

  const clearPressTimer = useCallback(() => {
    if (timerRef.current !== null) {
      window.clearTimeout(timerRef.current);
      timerRef.current = null;
    }
  }, []);

  const clearPress = useCallback(
    ({
      releasePointer = true,
      resetState = true,
    }: { releasePointer?: boolean; resetState?: boolean } = {}) => {
      clearPressTimer();
      const pointer = pointerRef.current;
      if (releasePointer && pointer) {
        tryReleasePointerCapture(pointer.anchor, pointer.pointerId);
      }
      pointerRef.current = null;
      if (resetState) {
        setIsPressing(false);
      }
    },
    [clearPressTimer],
  );

  const finishPendingPress = useCallback(() => {
    clearPressTimer();
    if (pointerRef.current) {
      pointerRef.current.menuOpened = true;
    }
    setIsPressing(false);
  }, [clearPressTimer]);

  const openMobileMenu = useCallback(
    (anchor: HTMLElement, originRect?: MobileContextMenuOriginRect) => {
      if (!enabled || !productMenuKey || typeof onOpen !== "function") {
        return;
      }

      finishPendingPress();
      navigator.vibrate?.(10);
      onOpen(anchor, productMenuKey, item, {
        presentation: "mobile-context",
        ...(originRect ? { originRect } : {}),
      });
    },
    [enabled, finishPendingPress, item, onOpen, productMenuKey],
  );

  const clearClickSuppression = useCallback(() => {
    if (suppressClickTimerRef.current !== null) {
      window.clearTimeout(suppressClickTimerRef.current);
      suppressClickTimerRef.current = null;
    }
    suppressNextClickRef.current = false;
  }, []);

  useEffect(
    () => () => {
      clearPress({ releasePointer: true, resetState: false });
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

  const startClickSuppression = () => {
    suppressNextClickRef.current = true;
    suppressClickTimerRef.current = window.setTimeout(() => {
      suppressNextClickRef.current = false;
      suppressClickTimerRef.current = null;
    }, LONG_PRESS_CLICK_SUPPRESSION_MS);
  };

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
    trySetPointerCapture(anchor, event.pointerId);
    pointerRef.current = {
      anchor,
      menuOpened: false,
      originRect: getElementOriginRect(anchor),
      pointerId: event.pointerId,
      startX: event.clientX,
      startY: event.clientY,
    };
    setIsPressing(true);
    timerRef.current = window.setTimeout(() => {
      const pointer = pointerRef.current;
      if (!pointer || pointer.pointerId !== event.pointerId) {
        return;
      }

      startClickSuppression();
      openMobileMenu(anchor, pointer.originRect);
    }, LONG_PRESS_THRESHOLD_MS);
  };

  const handlePointerMove = (event: PointerEvent<HTMLDivElement>) => {
    const pointer = pointerRef.current;
    if (
      !pointer ||
      pointer.pointerId !== event.pointerId ||
      pointer.menuOpened
    ) {
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
