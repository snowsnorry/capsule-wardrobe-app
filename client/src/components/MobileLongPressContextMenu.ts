import type { PointerEvent as ReactPointerEvent } from "react";
import { useCallback, useEffect, useRef, useState } from "react";
import type { MobileContextMenuOriginRect } from "./MobileContextMenuTypes";

const LONG_PRESS_THRESHOLD_MS = 520;
const LONG_PRESS_MOVE_TOLERANCE_PX = 10;
const LONG_PRESS_CLICK_SUPPRESSION_MS = 750;
const LONG_PRESS_CONTEXT_MENU_SUPPRESSION_MS = 750;

type LongPressPointerState = {
  anchor: HTMLElement;
  menuOpened: boolean;
  originRect: MobileContextMenuOriginRect;
  pointerId?: number;
  startX: number;
  startY: number;
};

type LongPressOpenHandler = (
  anchor: HTMLElement,
  originRect?: MobileContextMenuOriginRect,
) => void;

type LongPressStartGuard = (event: ReactPointerEvent<HTMLElement>) => boolean;

type PointerLikeEvent = {
  clientX: number;
  clientY: number;
  pointerId?: number;
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

function isDifferentPointer(
  pointer: LongPressPointerState,
  event: Pick<PointerLikeEvent, "pointerId">,
) {
  return (
    typeof pointer.pointerId === "number" &&
    typeof event.pointerId === "number" &&
    pointer.pointerId !== event.pointerId
  );
}

// Owns one gesture lifecycle so timers, pointer state, and click suppression stay synchronized.
// eslint-disable-next-line max-lines-per-function
function useMobileLongPressContextMenu({
  enabled,
  onOpen,
  shouldStart,
}: {
  enabled: boolean;
  onOpen?: LongPressOpenHandler;
  shouldStart?: LongPressStartGuard;
}) {
  const [isPressing, setIsPressing] = useState(false);
  const timerRef = useRef<number | null>(null);
  const pointerRef = useRef<LongPressPointerState | null>(null);
  const suppressNextClickRef = useRef(false);
  const suppressClickTimerRef = useRef<number | null>(null);
  const suppressContextMenuTimerRef = useRef<number | null>(null);

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
      if (releasePointer && pointer && typeof pointer.pointerId === "number") {
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
      if (!enabled || typeof onOpen !== "function") {
        return;
      }

      finishPendingPress();
      navigator.vibrate?.(10);
      onOpen(anchor, originRect);
    },
    [enabled, finishPendingPress, onOpen],
  );

  const clearClickSuppression = useCallback(() => {
    if (suppressClickTimerRef.current !== null) {
      window.clearTimeout(suppressClickTimerRef.current);
      suppressClickTimerRef.current = null;
    }
    suppressNextClickRef.current = false;
  }, []);

  const suppressNativeContextMenu = useCallback((event: Event) => {
    event.preventDefault();
    event.stopPropagation();
    event.stopImmediatePropagation?.();
  }, []);

  const clearContextMenuSuppression = useCallback(() => {
    if (suppressContextMenuTimerRef.current !== null) {
      window.clearTimeout(suppressContextMenuTimerRef.current);
      suppressContextMenuTimerRef.current = null;
    }
    window.removeEventListener("contextmenu", suppressNativeContextMenu, true);
  }, [suppressNativeContextMenu]);

  useEffect(
    () => () => {
      clearPress({ releasePointer: true, resetState: false });
      clearClickSuppression();
      clearContextMenuSuppression();
    },
    [clearClickSuppression, clearContextMenuSuppression, clearPress],
  );

  const startClickSuppression = () => {
    clearClickSuppression();
    suppressNextClickRef.current = true;
    suppressClickTimerRef.current = window.setTimeout(() => {
      suppressNextClickRef.current = false;
      suppressClickTimerRef.current = null;
    }, LONG_PRESS_CLICK_SUPPRESSION_MS);
  };

  const startContextMenuSuppression = () => {
    clearContextMenuSuppression();
    window.addEventListener("contextmenu", suppressNativeContextMenu, true);
    suppressContextMenuTimerRef.current = window.setTimeout(() => {
      clearContextMenuSuppression();
    }, LONG_PRESS_CONTEXT_MENU_SUPPRESSION_MS);
  };

  const handlePointerDown = (event: ReactPointerEvent<HTMLElement>) => {
    const pointerType = event.pointerType as string | undefined;
    const isTouchPointer =
      pointerType === "touch" ||
      ((!pointerType || pointerType === "") &&
        typeof window.PointerEvent === "undefined");
    if (!enabled || !isTouchPointer || (shouldStart && !shouldStart(event))) {
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
      if (!pointer || isDifferentPointer(pointer, event)) {
        return;
      }

      startClickSuppression();
      startContextMenuSuppression();
      openMobileMenu(anchor, pointer.originRect);
    }, LONG_PRESS_THRESHOLD_MS);
  };

  const cancelPressIfMoved = useCallback(
    (event: PointerLikeEvent) => {
      const pointer = pointerRef.current;
      if (
        !pointer ||
        isDifferentPointer(pointer, event) ||
        pointer.menuOpened
      ) {
        return;
      }

      const moved =
        Math.abs(event.clientX - pointer.startX) >
          LONG_PRESS_MOVE_TOLERANCE_PX ||
        Math.abs(event.clientY - pointer.startY) > LONG_PRESS_MOVE_TOLERANCE_PX;
      if (moved) {
        clearPress();
      }
    },
    [clearPress],
  );

  const clearPressForPointerEnd = useCallback(
    (event: Pick<PointerLikeEvent, "pointerId">) => {
      const pointer = pointerRef.current;
      if (!pointer || !isDifferentPointer(pointer, event)) {
        clearPress();
      }
    },
    [clearPress],
  );

  const handlePointerMove = (event: ReactPointerEvent<HTMLElement>) => {
    cancelPressIfMoved(event);
  };

  const handlePointerEnd = (event: ReactPointerEvent<HTMLElement>) => {
    clearPressForPointerEnd(event);
  };

  useEffect(() => {
    if (!isPressing) {
      return undefined;
    }

    const cancelOnScroll = () => clearPress();
    const cancelOnMove = (event: PointerEvent) => {
      cancelPressIfMoved(event);
    };
    const cancelOnPointerEnd = (event: PointerEvent) => {
      clearPressForPointerEnd(event);
    };
    window.addEventListener("scroll", cancelOnScroll, true);
    window.addEventListener("pointermove", cancelOnMove, true);
    window.addEventListener("pointerup", cancelOnPointerEnd, true);
    window.addEventListener("pointercancel", cancelOnPointerEnd, true);
    return () => {
      window.removeEventListener("scroll", cancelOnScroll, true);
      window.removeEventListener("pointermove", cancelOnMove, true);
      window.removeEventListener("pointerup", cancelOnPointerEnd, true);
      window.removeEventListener("pointercancel", cancelOnPointerEnd, true);
    };
  }, [cancelPressIfMoved, clearPress, clearPressForPointerEnd, isPressing]);

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

export { useMobileLongPressContextMenu };
