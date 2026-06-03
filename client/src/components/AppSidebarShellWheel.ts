import type { WheelEvent } from "react";

const primaryScrollTargetSelector = '[data-app-primary-scroll-target="true"]';

function getWheelScrollDelta(
  event: WheelEvent<HTMLElement>,
  target: HTMLElement,
) {
  if (event.deltaMode === 1) {
    return event.deltaY * 16;
  }

  if (event.deltaMode === 2) {
    return event.deltaY * target.clientHeight;
  }

  return event.deltaY;
}

function canScrollVertically(element: HTMLElement, deltaY: number) {
  if (deltaY > 0) {
    return element.scrollTop + element.clientHeight < element.scrollHeight - 1;
  }

  if (deltaY < 0) {
    return element.scrollTop > 0;
  }

  return false;
}

function isWheelScrollable(element: HTMLElement) {
  return /auto|scroll|overlay/.test(window.getComputedStyle(element).overflowY);
}

function findScrollableAncestorInside(
  target: EventTarget | null,
  boundary: HTMLElement,
  deltaY: number,
) {
  let current = target instanceof HTMLElement ? target : null;

  while (current && boundary.contains(current)) {
    if (isWheelScrollable(current) && canScrollVertically(current, deltaY)) {
      return current;
    }

    if (current === boundary) {
      break;
    }

    current = current.parentElement;
  }

  return null;
}

function getPrimaryScrollTarget() {
  const target = document.querySelector(primaryScrollTargetSelector);
  return target instanceof HTMLElement ? target : null;
}

function handleDesktopSidebarWheel(event: WheelEvent<HTMLElement>) {
  const sidebar = event.currentTarget;
  const sidebarDelta = getWheelScrollDelta(event, sidebar);

  if (
    sidebarDelta === 0 ||
    findScrollableAncestorInside(event.target, sidebar, sidebarDelta)
  ) {
    return;
  }

  const scrollTarget = getPrimaryScrollTarget();
  if (!scrollTarget) {
    return;
  }

  const scrollDelta = getWheelScrollDelta(event, scrollTarget);
  if (!canScrollVertically(scrollTarget, scrollDelta)) {
    return;
  }

  scrollTarget.scrollTop += scrollDelta;
  event.preventDefault();
}

export { handleDesktopSidebarWheel };
